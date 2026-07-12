import os
import sys
import logging
from datetime import datetime

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AI-HIDS-Sensor-Bridge")

# Ensure correct path context for loading relative app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.detection.ml_engine import predict_process_risk, load_ml_model
from app.detection.rules import evaluate_rules
from app.detection.explain import generate_explanation

class Sensor:
    def __init__(self, on_alert=None, on_telemetry=None, on_event=None):
        """
        on_alert: Callback when a threat is identified locally. Takes a dict alert payload.
        on_telemetry: Callback when process sweeps are updated with risk scores. Takes a list of processes.
        on_event: Callback for raw file/network/process events.
        """
        self.on_alert = on_alert
        self.on_telemetry = on_telemetry
        self.on_event = on_event
        
        self.process_histories = {}
        self.collector = None
        self.platform = "windows" if sys.platform == "win32" else "linux"
        
        logger.info(f"[*] Detected Host Environment: {self.platform.upper()}")
        logger.info("Initializing Local ML Detection Engine...")
        load_ml_model()

    def start(self, simulate=False):
        """Instantiate and start the platform-specific collector."""
        if self.platform == "windows":
            from windows_collector import WindowsCollector
            logger.info("[+] Starting Windows collector & threat detection engine...")
            self.collector = WindowsCollector(
                on_event=self._handle_raw_event,
                on_telemetry=self._handle_raw_telemetry,
                simulate=simulate
            )
        else:
            from ebpf_collector import eBPFCollector
            logger.info("[+] Starting Linux eBPF kernel collector & threat detection engine...")
            self.collector = eBPFCollector(
                on_event=self._handle_raw_event,
                on_telemetry=self._handle_raw_telemetry
            )
            
        self.collector.start()
        logger.info("[+] Sensor Bridge started successfully.")

    def stop(self):
        """Shutdown underlying collector."""
        if self.collector:
            self.collector.stop()
            logger.info("[-] Sensor Bridge shut down successfully.")

    def _get_or_create_history(self, pid, name=""):
        if pid not in self.process_histories:
            self.process_histories[pid] = {
                "pid": pid,
                "name": name,
                "num_reads": 0,
                "num_writes": 0,
                "num_connections": 0,
                "num_child_processes": 0,
                "unique_files": set(),
                "unique_ips": set(),
                "syscall_sequence": [],
                "sensitive_files": 0,
                "run_from_temp": 0,
                "exe": "",
                "cmdline": "",
                "username": "",
                "parent_pid": 0,
                "parent_name": ""
            }
        if name and not self.process_histories[pid]["name"]:
            self.process_histories[pid]["name"] = name
        return self.process_histories[pid]

    def _handle_raw_telemetry(self, processes_list):
        """Sweeps running processes, runs baseline local predictions, and emits process telemetry updates."""
        processed_processes = []
        
        for p in processes_list:
            history = self._get_or_create_history(p["pid"], p["name"])
            
            # Update history fields
            history["exe"] = p["exe"] or history["exe"]
            history["cmdline"] = p["cmdline"] or history["cmdline"]
            history["username"] = p["username"] or history["username"]
            history["parent_pid"] = p["parent_pid"] or history["parent_pid"]
            history["parent_name"] = p["parent_name"] or history["parent_name"]
            
            # Update path location info
            if history["exe"]:
                exe_lower = history["exe"].lower()
                if any(loc in exe_lower for loc in [r"\temp", r"\tmp", r"\appdata\local\temp", "/tmp/"]):
                    history["run_from_temp"] = 1
                    
            # Compute feature sets
            ml_feat = {
                "num_reads": history["num_reads"],
                "num_writes": history["num_writes"],
                "num_connections": history["num_connections"],
                "num_child_processes": history["num_child_processes"],
                "unique_files": len(history["unique_files"]),
                "unique_ips": len(history["unique_ips"]),
                "sensitive_files": history["sensitive_files"],
                "run_from_temp": history["run_from_temp"]
            }
            
            # Run local prediction
            ml_result = predict_process_risk(ml_feat, history["syscall_sequence"])
            
            processed_processes.append({
                "pid": p["pid"],
                "name": p["name"],
                "exe": p["exe"],
                "cmdline": p["cmdline"],
                "username": p["username"],
                "parent_pid": p["parent_pid"],
                "parent_name": p["parent_name"],
                "cpu_percent": p["cpu_percent"],
                "memory_percent": p["memory_percent"],
                "risk_score": ml_result["risk_score"],
                "classification": ml_result["classification"],
                "read_count": history["num_reads"],
                "write_count": history["num_writes"]
            })
            
        if self.on_telemetry:
            self.on_telemetry(processed_processes)

    def _handle_raw_event(self, event):
        """Processes live event, evaluates rules + ML locally, and triggers alerts."""
        pid = event["pid"]
        name = event["process_name"]
        timestamp = event.get("timestamp") or datetime.now().isoformat()
        
        history = self._get_or_create_history(pid, name)
        target_path = event.get("target_path") or ""
        details = event.get("details") or ""
        
        # Accumulate behavior statistics locally
        if event["event_type"] == "file":
            if event["action"] == "read":
                history["num_reads"] += 1
                if target_path:
                    history["unique_files"].add(target_path)
            elif event["action"] in ["write", "delete", "unlink"]:
                history["num_writes"] += 1
                if target_path:
                    history["unique_files"].add(target_path)
        elif event["event_type"] == "network":
            if event["action"] == "connect":
                history["num_connections"] += 1
                ip_val = target_path or details
                if ip_val:
                    history["unique_ips"].add(ip_val)
        elif event["event_type"] == "process":
            if event["action"] == "spawn":
                history["num_child_processes"] += 1
                
        # Keep sliding call window
        history["syscall_sequence"].append(event["action"])
        if len(history["syscall_sequence"]) > 30:
            history["syscall_sequence"].pop(0)
            
        # 1. Run local Rules Engine
        triggered_rules, rule_penalty = evaluate_rules(event, history)
        if "SENSITIVE_FILE_ACCESS" in triggered_rules:
            history["sensitive_files"] += 1
            
        # 2. Run local Machine Learning Classifier
        ml_feat = {
            "num_reads": history["num_reads"],
            "num_writes": history["num_writes"],
            "num_connections": history["num_connections"],
            "num_child_processes": history["num_child_processes"],
            "unique_files": len(history["unique_files"]),
            "unique_ips": len(history["unique_ips"]),
            "sensitive_files": history["sensitive_files"],
            "run_from_temp": history["run_from_temp"]
        }
        ml_result = predict_process_risk(ml_feat, history["syscall_sequence"])
        
        # Compute hybrid combined score
        raw_risk = max(ml_result["risk_score"], rule_penalty)
        final_risk = min(max(raw_risk, 0.0), 100.0)
        classification = "Malicious" if final_risk >= 50.0 else "Benign"
        
        # Threat detected logic
        if final_risk >= 40.0 or len(triggered_rules) > 0:
            # Generate description locally
            explanation = generate_explanation(triggered_rules, {
                "risk_score": final_risk,
                "classification": classification,
                "feature_contributions": ml_result["feature_contributions"],
                "syscall_entropy": ml_result["syscall_entropy"],
                "seq_anomaly_score": ml_result["seq_anomaly_score"]
            }, name)
            
            alert_payload = {
                "timestamp": timestamp,
                "pid": pid,
                "process_name": name,
                "risk_score": round(final_risk, 2),
                "classification": classification,
                "confidence": ml_result["confidence"],
                "rule_triggers": triggered_rules,
                "explanation": explanation,
                "status": "Active"
            }
            
            if self.on_alert:
                self.on_alert(alert_payload)
                
        # Forward raw event to the telemetry broker
        if self.on_event:
            self.on_event(event)
