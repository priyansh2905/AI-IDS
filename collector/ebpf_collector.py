#!/usr/bin/env python3
"""
Linux eBPF Telemetry Collector for AI-HIDS
Uses BCC (BPF Compiler Collection) to trace kernel syscall events (execve, openat, connect).
Streams live events to the FastAPI backend.
"""
import sys
import time
import requests
import json
from datetime import datetime

# Check if BCC is available
try:
    from bcc import BPF
except ImportError:
    print("[-] BCC library not found. To run this collector on Linux, install: apt install python3-bpfcc bpfcc-tools")
    BPF = None

BACKEND_URL = "http://127.0.0.1:8000"
EVENTS_ENDPOINT = f"{BACKEND_URL}/api/events"
HEARTBEAT_ENDPOINT = f"{BACKEND_URL}/api/collector/heartbeat"

# C BPF Program Code
BPF_PROGRAM = """
#include <uapi/linux/ptrace.h>
#include <linux/sched.h>
#include <linux/fs.h>
#include <uapi/linux/in.h>

struct data_t {
    u32 pid;
    char comm[16];
    char type[16];
    char action[16];
    char path[128];
    char details[128];
};

BPF_PERF_OUTPUT(events);

// 1. Trace execve (Process Spawning)
int syscall__execve(struct pt_regs *ctx, const char __user *filename) {
    struct data_t data = {};
    u64 pid_tgid = bpf_get_current_pid_tgid();
    data.pid = pid_tgid >> 32;
    bpf_get_current_comm(&data.comm, sizeof(data.comm));
    
    bpf_probe_read_user_str(&data.path, sizeof(data.path), filename);
    
    __builtin_memcpy(data.type, "process", 8);
    __builtin_memcpy(data.action, "spawn", 6);
    __builtin_memcpy(data.details, "eBPF execve tracer", 19);
    
    events.perf_submit(ctx, &data, sizeof(data));
    return 0;
}

// 2. Trace openat (File Accesses)
int syscall__openat(struct pt_regs *ctx, int dfd, const char __user *filename, int flags) {
    struct data_t data = {};
    u64 pid_tgid = bpf_get_current_pid_tgid();
    data.pid = pid_tgid >> 32;
    bpf_get_current_comm(&data.comm, sizeof(data.comm));
    
    bpf_probe_read_user_str(&data.path, sizeof(data.path), filename);
    
    __builtin_memcpy(data.type, "file", 5);
    
    // Simple write flag check
    if (flags & O_CREAT || flags & O_WRONLY || flags & O_RDWR) {
         __builtin_memcpy(data.action, "write", 6);
    } else {
         __builtin_memcpy(data.action, "read", 5);
    }
    
    __builtin_memcpy(data.details, "eBPF openat tracer", 19);
    
    events.perf_submit(ctx, &data, sizeof(data));
    return 0;
}

// 3. Trace connect (Outbound sockets)
int syscall__connect(struct pt_regs *ctx, int sockfd, struct sockaddr *addr, int addrlen) {
    struct data_t data = {};
    u64 pid_tgid = bpf_get_current_pid_tgid();
    data.pid = pid_tgid >> 32;
    bpf_get_current_comm(&data.comm, sizeof(data.comm));
    
    __builtin_memcpy(data.type, "network", 8);
    __builtin_memcpy(data.action, "connect", 8);
    
    unsigned short family = 0;
    bpf_probe_read_kernel(&family, sizeof(family), &addr->sa_family);
    
    if (family == AF_INET) {
        struct sockaddr_in addr_in = {};
        bpf_probe_read_kernel(&addr_in, sizeof(addr_in), addr);
        u32 ip = addr_in.sin_addr.s_addr;
        u16 port = addr_in.sin_port;
        // Network byte order translation
        port = ((port & 0xFF) << 8) | ((port & 0xFF00) >> 8);
        
        unsigned char ip_bytes[4];
        ip_bytes[0] = ip & 0xFF;
        ip_bytes[1] = (ip >> 8) & 0xFF;
        ip_bytes[2] = (ip >> 16) & 0xFF;
        ip_bytes[3] = (ip >> 24) & 0xFF;
        
        // Format IP address
        bpf_trace_printk("%d.%d.%d.%d:%d", ip_bytes[0], ip_bytes[1], ip_bytes[2], ip_bytes[3], port);
        
        // Fill string fields safely
        int len = 0;
        // In actual BPF C, complex formatting is limited, we simulate/store raw bytes
        // or let user space read directly. For simplicity, we flag connection
        __builtin_memcpy(data.path, "IPv4 Connection", 16);
        __builtin_memcpy(data.details, "eBPF connect tracer", 20);
    } else {
        __builtin_memcpy(data.path, "non-IPv4", 9);
        __builtin_memcpy(data.details, "eBPF connect tracer (other)", 28);
    }
    
    events.perf_submit(ctx, &data, sizeof(data));
    return 0;
}
"""

def process_event(cpu, data, size):
    """Callback to receive kernel perf buffer events and send to API."""
    if not BPF:
        return
        
    event = b["events"].event(data)
    
    # Extract fields from BPF memory struct
    pid = int(event.pid)
    comm = event.comm.decode('utf-8', errors='ignore')
    event_type = event.type.decode('utf-8', errors='ignore')
    action = event.action.decode('utf-8', errors='ignore')
    path = event.path.decode('utf-8', errors='ignore')
    details = event.details.decode('utf-8', errors='ignore')
    
    # Filter out system and self collector logs
    if comm in ["systemd", "ebpf_collector", "python3"]:
        return
        
    payload = {
        "pid": pid,
        "process_name": comm,
        "event_type": event_type,
        "action": action,
        "target_path": path,
        "details": details,
        "timestamp": datetime.now().isoformat()
    }
    
    print(f"[+] eBPF [{event_type.upper()}] Process: {comm} (PID: {pid}) - Action: {action} on {path}")
    
    try:
        response = requests.post(EVENTS_ENDPOINT, json=payload, timeout=1.0)
        if response.status_code == 200:
            res = response.json()
            if res.get("alert_triggered"):
                print(f"  [!] Alert Raised! Risk Score: {res.get('risk_score')}%")
    except Exception as e:
        # Silently fail during background streaming
        pass

def send_linux_heartbeat():
    """Gathers running processes on Linux (procfs) and posts updates to backend."""
    # Under Linux we would read from /proc
    # Here we mock process sweep using standard psutil if available, or direct list
    import psutil
    payload = []
    for proc in psutil.process_iter():
        try:
            pinfo = proc.as_dict(attrs=['pid', 'name', 'exe', 'cmdline', 'username', 'ppid', 'cpu_percent', 'memory_percent'])
            
            # Parent details
            ppid = pinfo['ppid']
            try:
                p_name = psutil.Process(ppid).name()
            except:
                p_name = "unknown"
                
            payload.append({
                "pid": pinfo['pid'],
                "name": pinfo['name'] or "unknown",
                "exe": pinfo['exe'] or "",
                "cmdline": " ".join(pinfo['cmdline'] or []),
                "username": pinfo['username'] or "root",
                "parent_pid": ppid,
                "parent_name": p_name,
                "cpu_percent": round(pinfo['cpu_percent'] or 0.0, 2),
                "memory_percent": round(pinfo['memory_percent'] or 0.0, 2)
            })
        except:
            continue
            
    try:
        requests.post(HEARTBEAT_ENDPOINT, json=payload, timeout=2.0)
    except Exception as e:
        print(f"[-] Linux heartbeat failed: {e}")

if __name__ == "__main__":
    if BPF is None:
        print("[-] Cannot initialize collector. BCC library is required.")
        sys.exit(1)
        
    print("[*] Compiling BPF tracepoints... (Requires root/sudo privileges)")
    try:
        b = BPF(text=BPF_PROGRAM)
        
        # Attach system call kprobes
        b.attach_kprobe(event=b.get_syscall_fnname("execve"), fn_name="syscall__execve")
        b.attach_kprobe(event=b.get_syscall_fnname("openat"), fn_name="syscall__openat")
        b.attach_kprobe(event=b.get_syscall_fnname("connect"), fn_name="syscall__connect")
        
        print("[+] eBPF sensors compiled and attached successfully.")
        print("[+] Streaming events. Press Ctrl+C to exit.")
        
        # Open perf buffer
        b["events"].open_perf_buffer(process_event)
        
        last_heartbeat = 0
        while True:
            # Poll perf buffer
            b.perf_buffer_poll(timeout=100)
            
            # Send process heartbeats every 3 seconds
            now = time.time()
            if now - last_heartbeat > 3.0:
                send_linux_heartbeat()
                last_heartbeat = now
                
    except PermissionError:
        print("[-] Permission Denied. You must run the eBPF collector as root (sudo).")
    except Exception as e:
        print(f"[-] eBPF collector failed to start: {e}")
