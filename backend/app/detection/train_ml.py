import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from app.config import settings

def generate_synthetic_data(num_samples=1000):
    """
    Generate synthetic dataset based on process characteristics and 
    system call patterns similar to ADFA-LD.
    """
    np.random.seed(42)
    
    data = []
    
    # Class labels: 0 for Benign, 1 for Malicious
    for _ in range(num_samples):
        is_malicious = np.random.choice([0, 1], p=[0.8, 0.2])
        
        if is_malicious == 0:
            # Benign behavior simulation (e.g., browsers, word processing, system services)
            num_reads = np.random.randint(10, 500)
            num_writes = np.random.randint(5, 200)
            num_connections = np.random.randint(0, 20)
            num_child_processes = np.random.randint(0, 3)
            unique_files = np.random.randint(2, 50)
            unique_ips = np.random.randint(0, 5)
            sensitive_files = np.random.choice([0, 1], p=[0.98, 0.02])
            network_intensity = num_connections / (num_reads + num_writes + num_connections + 1)
            write_ratio = num_writes / (num_reads + 1)
            run_from_temp = np.random.choice([0, 1], p=[0.99, 0.01])
            syscall_entropy = np.random.uniform(1.0, 2.5)
            seq_anomaly_score = np.random.uniform(0.0, 0.2)
        else:
            # Malicious behavior simulation: Ransomware, Credential Theft, Exfiltration
            threat_type = np.random.choice(["ransomware", "credential_theft", "exfiltration", "shell_spawn"])
            
            if threat_type == "ransomware":
                # High writes, high unique files, high write ratio
                num_reads = np.random.randint(500, 3000)
                num_writes = np.random.randint(400, 2800)
                num_connections = np.random.randint(0, 2)
                num_child_processes = np.random.randint(0, 2)
                unique_files = np.random.randint(100, 1000)
                unique_ips = np.random.randint(0, 2)
                sensitive_files = np.random.choice([0, 1], p=[0.9, 0.1])
                network_intensity = num_connections / (num_reads + num_writes + num_connections + 1)
                write_ratio = num_writes / (num_reads + 1)
                run_from_temp = np.random.choice([0, 1], p=[0.7, 0.3])
                syscall_entropy = np.random.uniform(0.5, 1.5) # Repetitive read/write
                seq_anomaly_score = np.random.uniform(0.6, 0.95)
                
            elif threat_type == "credential_theft":
                # Reading LSASS or sensitive registry locations
                num_reads = np.random.randint(50, 200)
                num_writes = np.random.randint(2, 20)
                num_connections = np.random.randint(1, 5)
                num_child_processes = np.random.randint(0, 2)
                unique_files = np.random.randint(1, 10)
                unique_ips = np.random.randint(1, 3)
                sensitive_files = 1 # Always accesses sensitive files
                network_intensity = num_connections / (num_reads + num_writes + num_connections + 1)
                write_ratio = num_writes / (num_reads + 1)
                run_from_temp = np.random.choice([0, 1], p=[0.5, 0.5])
                syscall_entropy = np.random.uniform(1.8, 3.2)
                seq_anomaly_score = np.random.uniform(0.7, 0.99)
                
            elif threat_type == "exfiltration":
                # High reads, high connections and outbound IP diversity
                num_reads = np.random.randint(500, 2000)
                num_writes = np.random.randint(10, 100)
                num_connections = np.random.randint(50, 300)
                num_child_processes = np.random.randint(0, 2)
                unique_files = np.random.randint(20, 100)
                unique_ips = np.random.randint(10, 50)
                sensitive_files = np.random.choice([0, 1], p=[0.5, 0.5])
                network_intensity = num_connections / (num_reads + num_writes + num_connections + 1)
                write_ratio = num_writes / (num_reads + 1)
                run_from_temp = np.random.choice([0, 1], p=[0.6, 0.4])
                syscall_entropy = np.random.uniform(2.0, 3.5)
                seq_anomaly_score = np.random.uniform(0.5, 0.85)
                
            else: # shell_spawn / privilege escalation
                # Many child processes quickly, commands executed
                num_reads = np.random.randint(10, 100)
                num_writes = np.random.randint(10, 100)
                num_connections = np.random.randint(1, 10)
                num_child_processes = np.random.randint(5, 20)
                unique_files = np.random.randint(5, 30)
                unique_ips = np.random.randint(1, 5)
                sensitive_files = np.random.choice([0, 1], p=[0.7, 0.3])
                network_intensity = num_connections / (num_reads + num_writes + num_connections + 1)
                write_ratio = num_writes / (num_reads + 1)
                run_from_temp = np.random.choice([0, 1], p=[0.4, 0.6])
                syscall_entropy = np.random.uniform(2.5, 4.0)
                seq_anomaly_score = np.random.uniform(0.65, 0.95)
                
        data.append([
            num_reads, num_writes, num_connections, num_child_processes,
            unique_files, unique_ips, sensitive_files, network_intensity,
            write_ratio, run_from_temp, syscall_entropy, seq_anomaly_score,
            is_malicious
        ])
        
    columns = [
        "num_reads", "num_writes", "num_connections", "num_child_processes",
        "unique_files", "unique_ips", "sensitive_files", "network_intensity",
        "write_ratio", "run_from_temp", "syscall_entropy", "seq_anomaly_score",
        "label"
    ]
    
    return pd.DataFrame(data, columns=columns)

def train_and_save_model():
    """Generate dataset, train model and scaler, and serialize to disk."""
    print("Generating synthetic HIDS telemetry dataset...")
    df = generate_synthetic_data(1200)
    
    X = df.drop("label", axis=1)
    y = df["label"]
    
    print("Scaling features...")
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    print("Training Random Forest Classifier...")
    model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
    model.fit(X_scaled, y)
    
    os.makedirs(settings.MODEL_DIR, exist_ok=True)
    
    # Save the pipeline components
    joblib.dump(model, settings.MODEL_PATH)
    joblib.dump(scaler, settings.SCALER_PATH)
    
    print(f"Model successfully saved to {settings.MODEL_PATH}")
    print(f"Scaler successfully saved to {settings.SCALER_PATH}")
    
    # Print feature importances
    importances = model.feature_importances_
    features = X.columns
    print("\nFeature Importances:")
    for f, imp in sorted(zip(features, importances), key=lambda x: x[1], reverse=True):
        print(f"  {f}: {imp:.4f}")

if __name__ == "__main__":
    train_and_save_model()
