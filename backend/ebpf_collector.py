#!/usr/bin/env python3
"""
Linux eBPF Telemetry Collector for AI-HIDS.
Consolidated into a callback-driven class.
"""
import sys
import time
import threading
from datetime import datetime

# Check if BCC is available
try:
    from bcc import BPF
except ImportError:
    BPF = None

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
        
        // In actual BPF C, complex formatting is limited, we simulate/store raw bytes
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

class eBPFCollector:
    def __init__(self, on_event=None, on_telemetry=None):
        self.on_event = on_event
        self.on_telemetry = on_telemetry
        self.stop_event = threading.Event()
        self.bpf_instance = None
        self.polling_thread = None

    def start(self):
        if BPF is None:
            print("[-] Cannot initialize eBPFCollector. BCC library (python3-bpfcc) is required.")
            return False
            
        print("[*] Compiling eBPF tracepoints... (Requires root/sudo privileges)")
        try:
            self.bpf_instance = BPF(text=BPF_PROGRAM)
            
            # Attach system call probes
            self.bpf_instance.attach_kprobe(event=self.bpf_instance.get_syscall_fnname("execve"), fn_name="syscall__execve")
            self.bpf_instance.attach_kprobe(event=self.bpf_instance.get_syscall_fnname("openat"), fn_name="syscall__openat")
            self.bpf_instance.attach_kprobe(event=self.bpf_instance.get_syscall_fnname("connect"), fn_name="syscall__connect")
            
            print("[+] eBPF sensors compiled and attached successfully.")
            
            # Open perf buffer
            self.bpf_instance["events"].open_perf_buffer(self._process_perf_event)
            
            self.stop_event.clear()
            self.polling_thread = threading.Thread(target=self._poll_loop, daemon=True)
            self.polling_thread.start()
            return True
        except PermissionError:
            print("[-] Permission Denied. You must run the eBPF collector as root (sudo).")
            return False
        except Exception as e:
            print(f"[-] eBPF collector failed to start: {e}")
            return False

    def stop(self):
        self.stop_event.set()
        if self.polling_thread:
            self.polling_thread.join(timeout=1.0)

    def _process_perf_event(self, cpu, data, size):
        if not self.bpf_instance:
            return
            
        event = self.bpf_instance["events"].event(data)
        
        # Extract fields
        pid = int(event.pid)
        comm = event.comm.decode('utf-8', errors='ignore')
        event_type = event.type.decode('utf-8', errors='ignore')
        action = event.action.decode('utf-8', errors='ignore')
        path = event.path.decode('utf-8', errors='ignore')
        details = event.details.decode('utf-8', errors='ignore')
        
        # Filter out system loop background scripts
        if comm in ["systemd", "ebpf_collector", "python3", "agent"]:
            return
            
        if self.on_event:
            self.on_event({
                "pid": pid,
                "process_name": comm,
                "event_type": event_type,
                "action": action,
                "target_path": path,
                "details": details,
                "timestamp": datetime.now().isoformat()
            })

    def _poll_loop(self):
        import psutil
        last_telemetry = 0
        
        while not self.stop_event.is_set():
            # Poll kernel buffer
            self.bpf_instance.perf_buffer_poll(timeout=100)
            
            # Send process telemetry updates every 3 seconds
            now = time.time()
            if now - last_telemetry > 3.0:
                self._scan_linux_processes()
                last_telemetry = now

    def _scan_linux_processes(self):
        import psutil
        payload = []
        for proc in psutil.process_iter():
            try:
                pinfo = proc.as_dict(attrs=['pid', 'name', 'exe', 'cmdline', 'username', 'ppid', 'cpu_percent', 'memory_percent'])
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
                
        if self.on_telemetry:
            self.on_telemetry(payload)
