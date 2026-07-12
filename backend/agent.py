import os
import sys
import time
import json
import requests
import argparse
import logging
import threading
import websocket

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AI-HIDS-Agent")

from app.config import settings
from sensor import Sensor

# Configuration details
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8001")
TELEMETRY_ENDPOINT = f"{BACKEND_URL}/api/telemetry/processes"
ALERTS_ENDPOINT = f"{BACKEND_URL}/api/alerts"
EVENTS_ENDPOINT = f"{BACKEND_URL}/api/events"

# Purely for local testing: hardcoded toggle to bypass remote sensor C2 control signals
BYPASS_REMOTE_CONTROL = True

# Control states
is_connected = False
offline_logging_enabled = False
sensor_active = BYPASS_REMOTE_CONTROL
sensor_simulate_mode = False
sensor_instance = None

OFFLINE_LOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "offline_alerts.jsonl")
state_lock = threading.Lock()

def _log_offline_alert(alert_payload):
    """Appends an alert to the local offline alerts JSON Lines file."""
    if not offline_logging_enabled:
        return
    logger.info(f"[💾 OFFLINE LOG] Saving alert locally for PID {alert_payload['pid']}")
    try:
        with open(OFFLINE_LOG_PATH, "a") as f:
            f.write(json.dumps(alert_payload) + "\n")
    except Exception as e:
        logger.error(f"[-] Failed to write alert to offline log: {e}")

def _sync_offline_alerts():
    """Reads stored offline alerts and posts them sequentially to the backend."""
    if not os.path.exists(OFFLINE_LOG_PATH) or os.path.getsize(OFFLINE_LOG_PATH) == 0:
        return
        
    logger.info("[🔄 SYNC] Connection restored. Synchronizing offline logs...")
    
    try:
        with open(OFFLINE_LOG_PATH, "r") as f:
            lines = f.readlines()
    except Exception as e:
        logger.error(f"[-] Failed to read offline log file: {e}")
        return

    synced_count = 0
    unsynced_lines = []
    
    headers = {
        "X-Sensor-ID": settings.SENSOR_ID,
        "X-Sensor-Key": settings.SENSOR_KEY,
        "Content-Type": "application/json"
    }

    for line in lines:
        if not line.strip():
            continue
        try:
            alert = json.loads(line.strip())
            response = requests.post(ALERTS_ENDPOINT, json=alert, headers=headers, timeout=3.0)
            if response.status_code in [200, 201]:
                synced_count += 1
            else:
                unsynced_lines.append(line)
        except Exception as e:
            logger.error(f"[-] Error syncing alert line: {e}")
            unsynced_lines.append(line)

    if synced_count > 0:
        logger.info(f"[🔄 SYNC] Successfully synced {synced_count} alerts.")

    # Write back any unsynced lines
    try:
        if unsynced_lines:
            with open(OFFLINE_LOG_PATH, "w") as f:
                f.writelines(unsynced_lines)
        else:
            if os.path.exists(OFFLINE_LOG_PATH):
                os.remove(OFFLINE_LOG_PATH)
    except Exception as e:
        logger.error(f"[-] Failed to clean up offline log file: {e}")

def send_alert(alert_payload):
    """Sends alert over HTTP, falling back to local logs if offline."""
    # Only send threat alerts when risk % is above 80
    if alert_payload.get("risk_score", 0) <= 80:
        return

    global is_connected
    with state_lock:
        active = sensor_active if BYPASS_REMOTE_CONTROL else False
    if not active:
        return
    logger.info(f"[🚨 DETECTION] Flagged PID {alert_payload['pid']} ({alert_payload['process_name']}) - Risk Score: {alert_payload['risk_score']}%")
    
    alert_payload["sensor_id"] = settings.SENSOR_ID
    
    headers = {
        "X-Sensor-ID": settings.SENSOR_ID,
        "X-Sensor-Key": settings.SENSOR_KEY,
        "Content-Type": "application/json"
    }
    
    with state_lock:
        online = is_connected

    if online:
        try:
            response = requests.post(ALERTS_ENDPOINT, json=alert_payload, headers=headers, timeout=2.0)
            if response.status_code in [200, 201]:
                logger.info("[+] Alert synced to backend successfully.")
                return
            else:
                logger.warning(f"[-] Backend rejected alert: status {response.status_code}")
        except requests.exceptions.RequestException as e:
            logger.warning("[-] Sync failed: connection lost during POST.")
            with state_lock:
                is_connected = False
                
        # Fallback to local logs on failed try
        _log_offline_alert(alert_payload)
    else:
        # Agent is offline; log directly
        _log_offline_alert(alert_payload)

def send_telemetry(processes_list):
    """Sends OK indicator instead of process telemetry sweeps if sensor is active."""
    global is_connected
    with state_lock:
        active = sensor_active if BYPASS_REMOTE_CONTROL else False
        online = is_connected
        
    if not active:
        return
        
    payload = {
        "sensor_id": settings.SENSOR_ID,
        "status": "ok"
    }
    headers = {
        "X-Sensor-ID": settings.SENSOR_ID,
        "X-Sensor-Key": settings.SENSOR_KEY,
        "Content-Type": "application/json"
    }
    
    if online:
        try:
            response = requests.post(TELEMETRY_ENDPOINT, json=payload, headers=headers, timeout=2.0)
            if response.status_code != 200:
                logger.warning(f"[-] Telemetry status code: {response.status_code}")
        except requests.exceptions.RequestException:
            with state_lock:
                is_connected = False

def send_event(event_payload):
    """Sends raw file/network/process telemetry events if sensor is active."""
    global is_connected
    with state_lock:
        active = sensor_active if BYPASS_REMOTE_CONTROL else False
        online = is_connected
        
    if not active:
        return
        
    event_payload["sensor_id"] = settings.SENSOR_ID
    headers = {
        "X-Sensor-ID": settings.SENSOR_ID,
        "X-Sensor-Key": settings.SENSOR_KEY,
        "Content-Type": "application/json"
    }
    
    if online:
        try:
            requests.post(EVENTS_ENDPOINT, json=event_payload, headers=headers, timeout=2.0)
        except requests.exceptions.RequestException:
            pass

def connection_monitor_loop():
    """Background loop to ping main backend health and trigger log syncing."""
    global is_connected
    logger.info("[*] Connection monitor thread started.")
    
    # We check by hitting the base URL of the backend (healthcheck)
    check_url = BACKEND_URL + "/"
    
    while True:
        try:
            response = requests.get(check_url, timeout=3.0)
            status_online = (response.status_code == 200)
        except Exception:
            status_online = False
            
        with state_lock:
            old_status = is_connected
            is_connected = status_online
            
        if status_online and not old_status:
            # Transitioned from offline to online
            logger.info("[+] Main backend server detected online!")
            sync_thread = threading.Thread(target=_sync_offline_alerts, daemon=True)
            sync_thread.start()
            
        time.sleep(5)

def dummy_alert_loop():
    """Background thread to send a dummy threat alert every 45 seconds for testing."""
    from datetime import datetime
    logger.info("[*] Testing Dummy Alert loop thread started (Interval: 45s).")
    
    # Wait 10 seconds initially before firing the first alert
    time.sleep(10)
    
    dummy_index = 1
    while True:
        try:
            alert_payload = {
                "sensor_id": settings.SENSOR_ID,
                "pid": 9999 + dummy_index,
                "process_name": f"simulated_threat_x{dummy_index}.exe",
                "risk_score": 85.0 + (dummy_index % 15),
                "exe": f"C:\\Users\\Testing\\simulated_threat_x{dummy_index}.exe",
                "explanations": [
                    "Simulated rule classifier matching signature: SUSPICIOUS_HEURISTIC",
                    f"Routinely generated test alert sequence #{dummy_index}"
                ],
                "timestamp": datetime.now().isoformat()
            }
            
            headers = {
                "X-Sensor-ID": settings.SENSOR_ID,
                "X-Sensor-Key": settings.SENSOR_KEY,
                "Content-Type": "application/json"
            }
            
            logger.info(f"[🔬 TEST ALERT] Dispatching routine 45s test threat alert for PID {alert_payload['pid']}")
            response = requests.post(ALERTS_ENDPOINT, json=alert_payload, headers=headers, timeout=5.0)
            if response.status_code in [200, 201]:
                logger.info("[+] Test alert synced to backend successfully.")
            else:
                logger.warning(f"[-] Backend rejected test alert: status {response.status_code}")
                
            dummy_index += 1
        except Exception as e:
            logger.error(f"[-] Failed to send dummy test alert: {e}")
            
        time.sleep(45)

def websocket_listener_loop():
    """Bidirectional WebSocket control channel thread."""
    logger.info("[*] Command listener thread started.")
    
    ws_proto = "ws" if BACKEND_URL.startswith("http://") else "wss"
    backend_host = BACKEND_URL.split("://")[-1]
    ws_url = f"{ws_proto}://{backend_host}/ws/sensor/control"
    
    headers = [
        f"X-Sensor-ID: {settings.SENSOR_ID}",
        f"X-Sensor-Key: {settings.SENSOR_KEY}"
    ]
    
    while True:
        try:
            ws = websocket.WebSocketApp(
                ws_url,
                header=headers,
                on_message=on_ws_message,
                on_error=on_ws_error,
                on_close=on_ws_close
            )
            logger.info(f"[*] Connecting WebSocket control channel to {ws_url}...")
            ws.run_forever()
        except Exception as e:
            logger.error(f"[-] WebSocket client execution error: {e}")
        time.sleep(5)

def on_ws_message(ws, message):
    global sensor_active, sensor_simulate_mode, sensor_instance, offline_logging_enabled
    logger.info(f"[✉️ COMMAND] Received websocket directive: {message}")
    try:
        cmd = json.loads(message)
        action = cmd.get("action")
        
        if action == "start_sensor":
            if not BYPASS_REMOTE_CONTROL:
                logger.warning("[-] Remote start command ignored: BYPASS_REMOTE_CONTROL is False (sensor disabled locally).")
                ws.send(json.dumps({
                    "status": "warning",
                    "message": "Start command ignored: Sensor disabled locally by testing bypass",
                    "sensor_id": settings.SENSOR_ID
                }))
                return
            simulate = cmd.get("simulate", False)
            with state_lock:
                if not sensor_active:
                    sensor_active = True
                    sensor_simulate_mode = simulate
                    sensor_instance.start(simulate=simulate)
                    logger.info("[+] Remote command: Started local detection sensor.")
            ws.send(json.dumps({"status": "success", "message": "Sensor started", "sensor_id": settings.SENSOR_ID}))
            
        elif action == "stop_sensor":
            if not BYPASS_REMOTE_CONTROL:
                logger.warning("[-] Remote stop command ignored: BYPASS_REMOTE_CONTROL is False (sensor disabled locally).")
                ws.send(json.dumps({
                    "status": "warning",
                    "message": "Stop command ignored: Sensor disabled locally by testing bypass",
                    "sensor_id": settings.SENSOR_ID
                }))
                return
            with state_lock:
                if sensor_active:
                    sensor_active = False
                    sensor_instance.stop()
                    logger.info("[-] Remote command: Stopped local detection sensor.")
            ws.send(json.dumps({"status": "success", "message": "Sensor stopped", "sensor_id": settings.SENSOR_ID}))
            
        elif action == "toggle_offline_logging":
            enabled = cmd.get("enabled", True)
            with state_lock:
                offline_logging_enabled = enabled
                logger.info(f"[+] Remote command: Offline logging set to {enabled}.")
            ws.send(json.dumps({"status": "success", "message": f"Offline logging set to {enabled}", "sensor_id": settings.SENSOR_ID}))
            
        elif action == "mitigate":
            pid = cmd.get("pid")
            mitigation_type = cmd.get("type")  # terminate, quarantine, dismiss
            logger.info(f"[+] Remote command: Mitigation {mitigation_type} requested for PID {pid}")
            success = False
            error_msg = "Mitigation disabled (Detection-only mode enabled)."
            
            # Psutil active mitigation commented out:
            # try:
            #     import psutil
            #     proc = psutil.Process(pid)
            #     if mitigation_type == "terminate":
            #         proc.kill()
            #         success = True
            #     elif mitigation_type == "quarantine":
            #         proc.suspend()
            #         success = True
            #     elif mitigation_type == "dismiss":
            #         try:
            #             proc.resume()
            #         except:
            #             pass
            #         success = True
            # except Exception as e:
            #     error_msg = str(e)
            #     logger.error(f"[-] Mitigation action failed: {e}")
                
            response = {
                "status": "error",
                "message": error_msg,
                "action": "mitigate",
                "pid": pid,
                "type": mitigation_type,
                "sensor_id": settings.SENSOR_ID
            }
            ws.send(json.dumps(response))
            
    except Exception as e:
        logger.error(f"[-] Failed to execute WS command: {e}")
        try:
            ws.send(json.dumps({"status": "error", "message": str(e), "sensor_id": settings.SENSOR_ID}))
        except:
            pass

def on_ws_error(ws, error):
    pass

def on_ws_close(ws, close_status_code, close_msg):
    logger.warning("[-] WebSocket control link disconnected. Reconnecting in 5s...")

def main():
    global BACKEND_URL, TELEMETRY_ENDPOINT, ALERTS_ENDPOINT, EVENTS_ENDPOINT, sensor_instance
    parser = argparse.ArgumentParser(description="AI-HIDS Local Intrusion Detection Agent")
    parser.add_argument("--simulate", action="store_true", help="Launch simulated threat generator alongside real processes")
    parser.add_argument("--backend", default=BACKEND_URL, help="FastAPI backend base URL")
    args = parser.parse_args()
    
    BACKEND_URL = args.backend
    TELEMETRY_ENDPOINT = f"{BACKEND_URL}/api/telemetry/processes"
    ALERTS_ENDPOINT = f"{BACKEND_URL}/api/alerts"
    EVENTS_ENDPOINT = f"{BACKEND_URL}/api/events"

    # Clear offline alert logs at startup
    if os.path.exists(OFFLINE_LOG_PATH):
        try:
            os.remove(OFFLINE_LOG_PATH)
            logger.info("[*] Cleared offline alert logs at startup.")
        except Exception as e:
            logger.warning(f"[-] Could not clear offline logs at startup: {e}")

    print("=============================================")
    print("      AI-HIDS Local Intrusion Sensor Agent   ")
    print("=============================================")
    print(f"[*] Connect target backend: {BACKEND_URL}")
    print("[*] Initializing local detection sensor...")
    
    sensor_instance = Sensor(on_alert=send_alert, on_telemetry=send_telemetry, on_event=send_event)
    
    # Spawn background monitoring threads
    monitor_thread = threading.Thread(target=connection_monitor_loop, daemon=True)
    monitor_thread.start()
    
    ws_thread = threading.Thread(target=websocket_listener_loop, daemon=True)
    ws_thread.start()

    dummy_thread = threading.Thread(target=dummy_alert_loop, daemon=True)
    dummy_thread.start()

    if sensor_active:
        print("[+] Sensor initialized. Starting active polling...")
        sensor_instance.start(simulate=args.simulate)
    else:
        print("[*] Sensor starting in INACTIVE state (BYPASS_REMOTE_CONTROL is False).")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[*] Stopping sensor agent...")
        sensor_instance.stop()
        print("[+] Sensor agent successfully stopped.")

if __name__ == "__main__":
    main()
