import os
import time
from typing import Dict, Any, List, Tuple

# Sensitive paths dictionary to alert on
SENSITIVE_PATTERNS = [
    r"windows\system32\config\sam",
    r"windows\system32\config\system",
    r"etc\passwd",
    r"etc\shadow",
    r"etc\sudoers",
    r"\.ssh\id_",
    r"\.ssh\authorized_keys",
    r"windows\system32\drivers\etc\hosts",
    r"etc/hosts"
]

SUSPICIOUS_LOCATIONS = [
    r"\temp\\",
    r"\tmp\\",
    r"/tmp/",
    r"\appdata\local\temp",
    r"recycle.bin"
]

SHELLS = ["cmd.exe", "powershell.exe", "pwsh.exe", "bash", "sh", "zsh", "wscript.exe", "cscript.exe"]

# Keep track of child process spawn timings per parent PID to detect excessive spawning
# Format: { parent_pid: [timestamp1, timestamp2, ...] }
spawn_trackers = {}

def evaluate_rules(event: Dict[str, Any], process: Dict[str, Any]) -> Tuple[List[str], float]:
    """
    Evaluates system events against security rules.
    Returns:
        list of rules triggered
        additional risk penalty (0 to 100)
    """
    triggered_rules = []
    penalty = 0.0
    
    pid = event.get("pid")
    proc_name = (event.get("process_name") or "").lower()
    event_type = event.get("event_type")
    action = event.get("action")
    target_path = (event.get("target_path") or "").lower()
    details = (event.get("details") or "").lower()
    
    # 1. Rule: Sensitive File Access
    if event_type == "file" and any(pat in target_path for pat in SENSITIVE_PATTERNS):
        triggered_rules.append("SENSITIVE_FILE_ACCESS")
        penalty += 35.0
        
    # 2. Rule: Suspicious Executable Location
    exe_path = (process.get("exe") or "").lower()
    if any(loc in exe_path for loc in SUSPICIOUS_LOCATIONS):
        triggered_rules.append("SUSPICIOUS_EXECUTABLE_LOCATION")
        penalty += 20.0
        
    # 3. Rule: Unexpected Outbound Connections from shell
    if event_type == "network" and action == "connect":
        if any(shell in proc_name for shell in SHELLS):
            triggered_rules.append("SHELL_OUTBOUND_CONNECTION")
            penalty += 45.0
            
    # 4. Rule: Excessive Process Spawning
    if event_type == "process" and action == "spawn":
        now = time.time()
        parent_pid = pid # The current process spawned a child
        if parent_pid not in spawn_trackers:
            spawn_trackers[parent_pid] = []
            
        # Clean old records (older than 10 seconds)
        spawn_trackers[parent_pid] = [t for t in spawn_trackers[parent_pid] if now - t < 10.0]
        spawn_trackers[parent_pid].append(now)
        
        # Check if more than 6 processes spawned in 10 seconds
        if len(spawn_trackers[parent_pid]) > 6:
            triggered_rules.append("EXCESSIVE_PROCESS_SPAWNING")
            penalty += 30.0

    # 5. Rule: Privilege Escalation
    username = (process.get("username") or "").lower()
    parent_name = (process.get("parent_name") or "").lower()
    # If the process is running as a privileged administrator (SYSTEM, administrator, root)
    # but its parent is a known user process or shell that is non-admin
    is_privileged = any(admin in username for admin in ["system", "administrator", "root", "authority"])
    is_parent_restricted = any(shell in parent_name for shell in SHELLS) or parent_name == "explorer.exe"
    
    if is_privileged and is_parent_restricted:
        # Check if we just spawned or if this process is a fresh high-risk shell
        if any(shell in proc_name for shell in SHELLS):
            triggered_rules.append("PRIVILEGE_ESCALATION_ATTEMPT")
            penalty += 50.0

    # Cap penalty at 100.0
    return triggered_rules, min(penalty, 100.0)
