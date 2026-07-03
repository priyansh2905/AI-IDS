import os
import sys
import logging
from datetime import datetime
from typing import List, Dict, Any, Set
import asyncio

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware 
import psutil

# Add local path to import sub-modules correctly
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.config import settings
from app.database import (
    init_db, save_process, save_event, save_alert, 
    get_processes, get_process, get_events, get_alerts, 
    update_process_status
)
from app.models import EventCreate, ProcessUpdate, MitigateAction
from app.detection.rules import evaluate_rules
from app.detection.ml_engine import predict_process_risk
from app.detection.explain import generate_explanation

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AI-HIDS-Backend")

app = FastAPI(title="AI-Powered HIDS Backend", version="1.0.0")

# Enable CORS for frontend dashboard communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- WebSocket Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Active: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                # Remove dead connection
                logger.warning(f"Error sending message, connection closed: {e}")

manager = ConnectionManager()

# --- In-Memory State Tracker for Feature Extraction ---
# Stores sliding window and running metrics for ML inference
process_histories: Dict[int, Dict[str, Any]] = {}

def get_or_create_history(pid: int, name: str = "") -> Dict[str, Any]:
    if pid not in process_histories:
        process_histories[pid] = {
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
    if name and not process_histories[pid]["name"]:
        process_histories[pid]["name"] = name
    return process_histories[pid]

# --- FastAPI Event Hooks ---
@app.on_event("startup")
async def startup_event():
    await init_db()

# --- REST Endpoints for Dashboard ---

@app.get("/api/processes")
async def api_get_processes():
    return await get_processes()

@app.get("/api/processes/{pid}")
async def api_get_process_detail(pid: int):
    proc = await get_process(pid)
    if not proc:
        raise HTTPException(status_code=404, detail="Process not found")
    events = await get_events(limit=50, pid=pid)
    return {
        "process": proc,
        "events": events
    }

@app.get("/api/events")
async def api_get_events(limit: int = 100):
    return await get_events(limit=limit)

@app.get("/api/alerts")
async def api_get_alerts():
    return await get_alerts()

# --- Collector Integration Endpoints ---

@app.post("/api/collector/heartbeat")
async def api_process_heartbeat(processes: List[ProcessUpdate]):
    """Receives lists of active processes on the client machine and stores them."""
    now_str = datetime.now().isoformat()
    for p in processes:
        history = get_or_create_history(p.pid, p.name)
        
        # Update static metadata if available
        history["exe"] = p.exe or history["exe"]
        history["cmdline"] = p.cmdline or history["cmdline"]
        history["username"] = p.username or history["username"]
        history["parent_pid"] = p.parent_pid or history["parent_pid"]
        history["parent_name"] = p.parent_name or history["parent_name"]
        
        # Check if running from temp path
        if history["exe"]:
            exe_lower = history["exe"].lower()
            if any(loc in exe_lower for loc in [r"\temp", r"\tmp", r"\appdata\local\temp"]):
                history["run_from_temp"] = 1
                
        # Perform a default baseline prediction
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
        
        db_proc = {
            "pid": p.pid,
            "name": p.name,
            "exe": p.exe,
            "cmdline": p.cmdline,
            "username": p.username,
            "parent_pid": p.parent_pid,
            "parent_name": p.parent_name,
            "cpu_percent": p.cpu_percent,
            "memory_percent": p.memory_percent,
            "risk_score": ml_result["risk_score"],
            "classification": ml_result["classification"]
        }
        await save_process(db_proc)
        
        # Broadcast updated process to dashboard
        await manager.broadcast({
            "type": "PROCESS_UPDATE",
            "data": {
                **db_proc,
                "status": "Running",
                "last_seen": now_str
            }
        })
        
    return {"status": "ok", "processed_count": len(processes)}

@app.post("/api/events")
async def api_receive_event(event: EventCreate):
    """
    Receives individual system events from collectors, triggers the rules and ML models,
    logs results, and broadcasts details to WebSocket dashboard.
    """
    pid = event.pid
    name = event.process_name
    timestamp = event.timestamp or datetime.now().isoformat()
    
    # 1. Fetch or initialize process behavior context
    history = get_or_create_history(pid, name)
    
    # 2. Extract event attributes and update state counters
    target_path = event.target_path or ""
    details = event.details or ""
    
    # Accumulate metrics
    if event.event_type == "file":
        if event.action == "read":
            history["num_reads"] += 1
            if target_path:
                history["unique_files"].add(target_path)
        elif event.action in ["write", "delete", "unlink"]:
            history["num_writes"] += 1
            if target_path:
                history["unique_files"].add(target_path)
                
    elif event.event_type == "network":
        if event.action == "connect":
            history["num_connections"] += 1
            # Try to grab IP from details or target_path
            ip_val = target_path or details
            if ip_val:
                history["unique_ips"].add(ip_val)
                
    elif event.event_type == "process":
        if event.action == "spawn":
            history["num_child_processes"] += 1
            
    # Keep sliding window sequence of system calls/actions
    history["syscall_sequence"].append(event.action)
    if len(history["syscall_sequence"]) > 30:
        history["syscall_sequence"].pop(0)
        
    # 3. Evaluate Rule-Based Engine
    triggered_rules, rule_penalty = evaluate_rules(event.model_dump(), history)
    if "SENSITIVE_FILE_ACCESS" in triggered_rules:
        history["sensitive_files"] += 1
        
    # 4. Evaluate Machine Learning Classifier
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
    
    # Hybrid Risk Score: Maximum of Machine Learning probability or rule-based penalties
    raw_risk = max(ml_result["risk_score"], rule_penalty)
    # Ensure it maps strictly from 0 to 100
    final_risk = min(max(raw_risk, 0.0), 100.0)
    
    classification = "Malicious" if final_risk >= 50.0 else "Benign"
    
    # Update process record in DB
    db_proc = {
        "pid": pid,
        "name": name,
        "risk_score": round(final_risk, 2),
        "classification": classification
    }
    await save_process(db_proc)
    
    # 5. Handle Alert Triggering
    alert_triggered = False
    alert_data = {}
    if final_risk >= 40.0 or triggered_rules:
        alert_triggered = True
        explanation = generate_explanation(triggered_rules, {
            "risk_score": final_risk,
            "classification": classification,
            "feature_contributions": ml_result["feature_contributions"],
            "syscall_entropy": ml_result["syscall_entropy"],
            "seq_anomaly_score": ml_result["seq_anomaly_score"]
        }, name)
        
        alert_data = {
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
        await save_alert(alert_data)
        
    # 6. Save Event logs
    event_data = {
        "timestamp": timestamp,
        "pid": pid,
        "process_name": name,
        "event_type": event.event_type,
        "action": event.action,
        "target_path": target_path,
        "details": details
    }
    await save_event(event_data)
    
    # 7. Real-Time Broadcast to WebSockets
    # Broadcast Event
    await manager.broadcast({
        "type": "EVENT",
        "data": event_data
    })
    
    # Broadcast Process metric update
    stored_proc = await get_process(pid)
    if stored_proc:
        await manager.broadcast({
            "type": "PROCESS_UPDATE",
            "data": stored_proc
        })
        
    # Broadcast Alert if triggered
    if alert_triggered:
        await manager.broadcast({
            "type": "ALERT",
            "data": alert_data
        })
        
    return {"status": "ok", "risk_score": final_risk, "alert_triggered": alert_triggered}

# --- Mitigation Responses Endpoint ---

@app.post("/api/mitigate")
async def api_mitigate_process(action: MitigateAction):
    """
    Executes response actions.
    Supports 'kill' (terminate process) and 'quarantine' (suspend/isolate process).
    """
    pid = action.pid
    op = action.action.lower()
    
    logger.info(f"Received mitigation request: {op.upper()} for PID {pid}")
    
    try:
        proc = psutil.Process(pid)
        name = proc.name()
        
        if op == "kill":
            proc.kill()
            await update_process_status(pid, "Terminated")
            
            # Broadcast update
            await manager.broadcast({
                "type": "MITIGATION",
                "data": {
                    "pid": pid,
                    "process_name": name,
                    "action": "Kill",
                    "status": "Terminated",
                    "timestamp": datetime.now().isoformat()
                }
            })
            return {"status": "success", "message": f"Process {name} (PID {pid}) terminated successfully."}
            
        elif op == "quarantine":
            # Under psutil, quarantine is simulated by suspending the process
            proc.suspend()
            await update_process_status(pid, "Quarantined")
            
            # Broadcast update
            await manager.broadcast({
                "type": "MITIGATION",
                "data": {
                    "pid": pid,
                    "process_name": name,
                    "action": "Quarantine",
                    "status": "Quarantined",
                    "timestamp": datetime.now().isoformat()
                }
            })
            return {"status": "success", "message": f"Process {name} (PID {pid}) suspended and quarantined."}
            
        elif op == "ignore":
            await update_process_status(pid, "Ignored")
            return {"status": "success", "message": f"Alert for PID {pid} set to Ignored."}
            
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported mitigation action: {op}")
            
    except psutil.NoSuchProcess:
        # If the process already terminated naturally
        await update_process_status(pid, "Terminated")
        return {"status": "success", "message": f"Process with PID {pid} is no longer running."}
        
    except Exception as e:
        logger.error(f"Mitigation failed for PID {pid}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to execute mitigation: {str(e)}")

# --- Real-Time Streaming WebSocket ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Maintain connection, handle client pings
            data = await websocket.receive_text()
            # Simple echo check
            await websocket.send_json({"type": "HEARTBEAT", "status": "alive"})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.HOST, port=settings.PORT)
