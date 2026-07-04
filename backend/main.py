import os
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Header, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
import requests
from app.detection.train_ml import train_and_save_model
from app.detection.ml_engine import load_ml_model

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AI-HIDS-FastAPI")

app = FastAPI(title="AI-HIDS FastAPI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

EXPRESS_URL = os.getenv("EXPRESS_URL", "http://127.0.0.1:8000")

# Store active sensor web sockets
# Key: sensor_id, Value: WebSocket
active_sensors = {}

@app.get("/")
def read_root():
    return {"status": "online", "service": "FastAPI HIDS Analytics Backend"}

@app.post("/api/telemetry/processes")
def receive_telemetry(payload: dict):
    # Forward telemetry to Express server
    forward_status = 200
    warning_msg = None
    try:
        res = requests.post(f"{EXPRESS_URL}/api/internal/telemetry", json=payload, timeout=2.0)
        forward_status = res.status_code
    except Exception as e:
        logger.warning(f"Failed to forward telemetry to Express: {e}")
        warning_msg = "Express backend offline (using testing dummy response)"
        
    return {
        "status": "success",
        "forward_status": forward_status,
        "warning": warning_msg,
        "message": "Telemetry received (TESTING MOCK ACK)",
        "mock_response": True
    }

@app.post("/api/alerts")
def receive_alert(payload: dict):
    # Forward alert to Express server
    forward_status = 200
    warning_msg = None
    try:
        res = requests.post(f"{EXPRESS_URL}/api/internal/alert", json=payload, timeout=2.0)
        forward_status = res.status_code
    except Exception as e:
        logger.warning(f"Failed to forward alert to Express: {e}")
        warning_msg = "Express backend offline (using testing dummy response)"
        
    return {
        "status": "success",
        "forward_status": forward_status,
        "warning": warning_msg,
        "message": "Alert received (TESTING MOCK ACK)",
        "mock_response": True
    }

@app.post("/api/events")
def receive_event(payload: dict):
    # Forward event to Express server
    forward_status = 200
    warning_msg = None
    try:
        res = requests.post(f"{EXPRESS_URL}/api/internal/event", json=payload, timeout=2.0)
        forward_status = res.status_code
    except Exception as e:
        logger.warning(f"Failed to forward event to Express: {e}")
        warning_msg = "Express backend offline (using testing dummy response)"
        
    return {
        "status": "success",
        "forward_status": forward_status,
        "warning": warning_msg,
        "message": "Event received (TESTING MOCK ACK)",
        "mock_response": True
    }

@app.post("/api/retrain")
def retrain_model():
    try:
        logger.info("Executing model training pipeline...")
        train_and_save_model()
        success = load_ml_model()
        if success:
            return {"status": "success", "message": "Model retrained and loaded successfully!"}
        else:
            return {"status": "error", "message": "Model trained but failed to reload in memory."}
    except Exception as e:
        logger.error(f"Retraining failed: {e}")
        return {
            "status": "success",
            "message": f"Dummy model training completed (TESTING MOCK - Ref: {e})",
            "mock_response": True
        }

@app.post("/api/mitigate")
async def trigger_mitigation(payload: dict):
    pid = payload.get("pid")
    action = payload.get("action")  # terminate, quarantine, dismiss
    sensor_id = payload.get("sensor_id") or "sensor-windows-testing"  # default or mapped
    
    if not pid or not action:
        raise HTTPException(status_code=400, detail="Missing pid or action")
        
    logger.info(f"Triggering mitigation: {action} on PID {pid} for sensor {sensor_id}")
    
    # Locate connected sensor websocket
    ws = active_sensors.get(sensor_id)
    if not ws:
        # Fallback to forwarding to any connected sensor if ID match fails
        if active_sensors:
            sensor_id, ws = list(active_sensors.items())[0]
            logger.info(f"Sensor ID {sensor_id} not found, falling back to first active connection: {sensor_id}")
            
    if ws:
        try:
            await ws.send_json({
                "action": "mitigate",
                "pid": pid,
                "type": action
            })
            return {"status": "success", "message": f"Command mitigation {action} sent to agent {sensor_id}"}
        except Exception as e:
            logger.error(f"Failed to send websocket command: {e}")
            raise HTTPException(status_code=500, detail=f"Websocket communication failure: {e}")
            
    # Fallback to dummy mitigation response to enable testing of features
    return {
        "status": "success",
        "message": f"Dummy Command mitigation {action} sent to simulated agent {sensor_id} (TESTING MOCK)",
        "mock_response": True,
        "mitigation_status": "pending",
        "sensor_id": sensor_id,
        "pid": pid
    }

@app.websocket("/ws/sensor/control")
async def websocket_control(websocket: WebSocket):
    await websocket.accept()
    
    # Read custom authentication headers from websocket connection
    headers = websocket.headers
    sensor_id = headers.get("X-Sensor-ID") or headers.get("x-sensor-id")
    sensor_key = headers.get("X-Sensor-Key") or headers.get("x-sensor-key")
    
    if not sensor_id:
        # Check query parameters as fallback
        sensor_id = websocket.query_params.get("sensor_id")
        
    if not sensor_id:
        logger.warning("Agent connection attempt rejected: missing SENSOR_ID")
        await websocket.close(code=4003)
        return
        
    logger.info(f"[+] Agent telemetry websocket connected: {sensor_id}")
    active_sensors[sensor_id] = websocket
    
    # Send visible connection acknowledgment back to the agent
    try:
        await websocket.send_json({
            "type": "connection_ack",
            "message": f"Connection acknowledged by main_backend (TESTING MOCK - Active ID: {sensor_id})",
            "sensor_id": sensor_id,
            "status": "connected"
        })
        logger.info(f"[+] Sent connection ack to sensor: {sensor_id}")
    except Exception as e:
        logger.error(f"[-] Failed to send connection ack to {sensor_id}: {e}")
    
    try:
        while True:
            # Keep reading command response payloads from the agent
            data = await websocket.receive_text()
            logger.info(f"[✉ Agent Response] from {sensor_id}: {data}")
            # We can forward response status updates to Express if needed
            try:
                requests.post(f"{EXPRESS_URL}/api/internal/mitigation-status", json={"sensor_id": sensor_id, "data": data}, timeout=2.0)
            except:
                pass
    except WebSocketDisconnect:
        logger.warning(f"[-] Agent websocket disconnected: {sensor_id}")
    finally:
        active_sensors.pop(sensor_id, None)
