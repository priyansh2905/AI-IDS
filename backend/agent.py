import os
import sys
import time
import requests
import argparse
import logging

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AI-HIDS-Agent")

from sensor import Sensor

# Read config from environment or default
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")
HEARTBEAT_ENDPOINT = f"{BACKEND_URL}/api/collector/heartbeat"
ALERTS_ENDPOINT = f"{BACKEND_URL}/api/alerts"

def send_alert(alert_payload):
    """Dispatches a lightweight alert notification to the FastAPI backend."""
    logger.info(f"[🚨 DETECTION] Flagged PID {alert_payload['pid']} ({alert_payload['process_name']}) - Risk Score: {alert_payload['risk_score']}%")
    try:
        response = requests.post(ALERTS_ENDPOINT, json=alert_payload, timeout=2.0)
        if response.status_code == 200 or response.status_code == 201:
            logger.info(f"[+] Alert synced to backend successfully.")
        else:
            logger.warning(f"[-] Backend returned status: {response.status_code}")
    except requests.exceptions.RequestException as e:
        # Gracefully handle server offline cases
        logger.warning(f"[-] Failed to sync alert. Backend server offline: {e}")

def send_heartbeat(processes_list):
    """Sends process risk state summaries to the FastAPI backend."""
    try:
        response = requests.post(HEARTBEAT_ENDPOINT, json=processes_list, timeout=2.0)
        if response.status_code != 200:
            logger.warning(f"[-] Heartbeat status code: {response.status_code}")
    except requests.exceptions.RequestException as e:
        # Gracefully handle server offline cases
        pass

def main():
    global BACKEND_URL, HEARTBEAT_ENDPOINT, ALERTS_ENDPOINT
    parser = argparse.ArgumentParser(description="AI-HIDS Local Intrusion Detection Agent")
    parser.add_argument("--simulate", action="store_true", help="Launch simulated threat generator alongside real processes")
    parser.add_argument("--backend", default=BACKEND_URL, help="FastAPI backend base URL")
    args = parser.parse_args()
    
    BACKEND_URL = args.backend
    HEARTBEAT_ENDPOINT = f"{BACKEND_URL}/api/collector/heartbeat"
    ALERTS_ENDPOINT = f"{BACKEND_URL}/api/alerts"

    print("=============================================")
    print("      AI-HIDS Local Intrusion Sensor Agent   ")
    print("=============================================")
    print(f"[*] Connect target backend: {BACKEND_URL}")
    print("[*] Initializing local detection sensor...")
    
    sensor = Sensor(on_alert=send_alert, on_heartbeat=send_heartbeat)
    
    print("[+] Sensor initialized. Starting active polling...")
    sensor.start(simulate=args.simulate)
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[*] Stopping sensor agent...")
        sensor.stop()
        print("[+] Sensor agent successfully stopped.")

if __name__ == "__main__":
    main()
