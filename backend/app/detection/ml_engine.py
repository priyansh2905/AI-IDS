import os
import math
import joblib
import numpy as np
import logging
from collections import Counter
from app.config import settings
from app.detection.train_ml import train_and_save_model

logger = logging.getLogger("MLEngine")

model = None
scaler = None

# List of typical system call identifiers (indexes) or names
# Mapping typical actions to a fixed dictionary for sequence modeling
SYSCALL_MAPPING = {
    "open": 0, "openat": 0,
    "read": 1,
    "write": 2,
    "close": 3,
    "fork": 4, "clone": 4,
    "execve": 5,
    "socket": 6,
    "connect": 7,
    "send": 8, "sendto": 8,
    "recv": 9, "recvfrom": 9,
    "unlink": 10,
    "chmod": 11,
    "mmap": 12,
    "ptrace": 13,
    "other": 14
}

# Pre-defined benign transition n-grams (bigrams) mapping typical operations
# e.g., open -> read (0->1), read -> read (1->1), read -> close (1->3) are highly expected
BENIGN_BIGRAMS = {
    (0, 1): 0.25,  # open -> read
    (1, 1): 0.30,  # read -> read
    (1, 3): 0.15,  # read -> close
    (0, 2): 0.10,  # open -> write
    (2, 2): 0.10,  # write -> write
    (2, 3): 0.05,  # write -> close
    (6, 7): 0.02,  # socket -> connect
    (7, 8): 0.02,  # connect -> send
    (8, 9): 0.01,  # send -> recv
    (3, 0): 0.01,  # close -> open
}

def load_ml_model():
    """Load Random Forest classifier and Scaler. Auto-train if missing."""
    global model, scaler
    
    if not os.path.exists(settings.MODEL_PATH) or not os.path.exists(settings.SCALER_PATH):
        logger.info("ML Model or Scaler not found. Training a new model dynamically...")
        try:
            train_and_save_model()
        except Exception as e:
            logger.error(f"Error training model: {e}")
            return False
            
    try:
        model = joblib.load(settings.MODEL_PATH)
        scaler = joblib.load(settings.SCALER_PATH)
        logger.info("ML Model and Scaler loaded successfully.")
        return True
    except Exception as e:
        logger.error(f"Failed to load ML model: {e}")
        return False

# --- Sequence Analysis Math ---

def calculate_sequence_entropy(sequence: list) -> float:
    """Calculate Shannon Entropy of system call sequences."""
    if not sequence:
        return 0.0
    counts = Counter(sequence)
    total = len(sequence)
    entropy = -sum((count / total) * math.log2(count / total) for count in counts.values())
    return entropy

def calculate_sequence_anomaly_score(sequence: list) -> float:
    """
    Evaluate bigram transitions against a benign dictionary.
    Returns score from 0.0 (perfectly benign) to 1.0 (highly anomalous).
    """
    if len(sequence) < 2:
        return 0.0
    
    # Map sequence names or actions to IDs
    mapped_seq = [SYSCALL_MAPPING.get(action.lower(), SYSCALL_MAPPING["other"]) for action in sequence]
    
    anomalous_transitions = 0
    total_transitions = len(mapped_seq) - 1
    
    for i in range(total_transitions):
        bigram = (mapped_seq[i], mapped_seq[i+1])
        if bigram not in BENIGN_BIGRAMS:
            # Let's check some high-risk combinations specifically
            # e.g., ptrace (13), execve (5) inside other processes, or unlink (10) repetitively
            anomalous_transitions += 1
            
    return anomalous_transitions / total_transitions

def predict_process_risk(features: dict, syscall_sequence: list) -> dict:
    """
    Prepares features, performs scaling, and returns Random Forest classification predictions.
    """
    global model, scaler
    
    # Fallback if model not loaded
    if model is None or scaler is None:
        if not load_ml_model():
            return {"risk_score": 10.0, "classification": "Benign", "confidence": 0.5, "feature_contributions": {}}
            
    # Calculate sequence features dynamically
    syscall_entropy = calculate_sequence_entropy(syscall_sequence)
    seq_anomaly_score = calculate_sequence_anomaly_score(syscall_sequence)
    
    # Pack the feature vector in exact order expected by the training model
    # [
    #     "num_reads", "num_writes", "num_connections", "num_child_processes",
    #     "unique_files", "unique_ips", "sensitive_files", "network_intensity",
    #     "write_ratio", "run_from_temp", "syscall_entropy", "seq_anomaly_score"
    # ]
    num_reads = features.get("num_reads", 0)
    num_writes = features.get("num_writes", 0)
    num_connections = features.get("num_connections", 0)
    
    network_intensity = num_connections / (num_reads + num_writes + num_connections + 1)
    write_ratio = num_writes / (num_reads + 1)
    
    feat_vector = [
        num_reads,
        num_writes,
        num_connections,
        features.get("num_child_processes", 0),
        features.get("unique_files", 0),
        features.get("unique_ips", 0),
        features.get("sensitive_files", 0),
        network_intensity,
        write_ratio,
        features.get("run_from_temp", 0),
        syscall_entropy,
        seq_anomaly_score
    ]
    
    try:
        # Scale and predict
        feat_arr = np.array([feat_vector])
        scaled_feat = scaler.transform(feat_arr)
        
        prob = model.predict_proba(scaled_feat)[0]  # [prob_benign, prob_malicious]
        risk_score = float(prob[1]) * 100.0
        
        classification = "Malicious" if risk_score >= 50.0 else "Benign"
        confidence = float(prob[1]) if risk_score >= 50.0 else float(prob[0])
        
        # Simple feature contribution calculations (local explainability)
        # We compare standard deviation bounds of each feature relative to scaler mean
        contributions = {}
        features_keys = [
            "num_reads", "num_writes", "num_connections", "num_child_processes",
            "unique_files", "unique_ips", "sensitive_files", "network_intensity",
            "write_ratio", "run_from_temp", "syscall_entropy", "seq_anomaly_score"
        ]
        
        # Calculate feature deviations to identify which features pushed the risk score up
        for i, key in enumerate(features_keys):
            mean = scaler.mean_[i]
            scale = scaler.scale_[i]
            val = feat_vector[i]
            # Z-score metric
            z = (val - mean) / (scale + 1e-6)
            if z > 1.5:  # Feature is significantly higher than baseline average
                contributions[key] = float(z)
                
        return {
            "risk_score": round(risk_score, 2),
            "classification": classification,
            "confidence": round(confidence * 100.0, 2),
            "feature_contributions": contributions,
            "syscall_entropy": round(syscall_entropy, 3),
            "seq_anomaly_score": round(seq_anomaly_score, 3)
        }
    except Exception as e:
        logger.error(f"ML inference error: {e}")
        return {"risk_score": 15.0, "classification": "Benign", "confidence": 50.0, "feature_contributions": {}}

# Trigger initial load on import
load_ml_model()
