from typing import List, Dict, Any

RULE_DESCRIPTIONS = {
    "SENSITIVE_FILE_ACCESS": "The process accessed or attempted to access sensitive system files (e.g., security configurations, credential databases, hosts file, or SSH keys). This is typical of credential dumping or configuration modification.",
    "SUSPICIOUS_EXECUTABLE_LOCATION": "The process is executing from a temporary or volatile directory (e.g., Temp, AppData, Recycle Bin). Malicious payloads often hide in these locations to bypass default write restrictions.",
    "SHELL_OUTBOUND_CONNECTION": "An active command shell (e.g. cmd.exe, PowerShell, bash) established an external network connection. This is highly indicative of reverse shells or remote control command & control (C2) activity.",
    "EXCESSIVE_PROCESS_SPAWNING": "The process is spawning child processes at an extremely rapid rate. This pattern matches fork bomb behavior, active exploitation, or multi-threaded vulnerability scanning.",
    "PRIVILEGE_ESCALATION_ATTEMPT": "An elevated system process was spawned directly from a restricted, lower-privilege parent workspace or shell. This indicates potential local privilege escalation (LPE)."
}

FEATURE_DESCRIPTIONS = {
    "num_reads": "An abnormally high volume of file reads.",
    "num_writes": "An abnormally high volume of file writes.",
    "num_connections": "Multiple active network socket connections.",
    "num_child_processes": "Frequent spawning of secondary child processes.",
    "unique_files": "A high number of distinct files accessed.",
    "unique_ips": "Communication with multiple external IP addresses.",
    "sensitive_files": "Direct interaction with restricted system files.",
    "network_intensity": "Heavy network traffic generation relative to local operations.",
    "write_ratio": "An extreme ratio of file writes over reads, a strong indicator of bulk directory encryption (Ransomware).",
    "run_from_temp": "Running from a user temp folder rather than standard Program Files or System directories.",
    "syscall_entropy": "A highly abnormal system call complexity.",
    "seq_anomaly_score": "System call order transitions that strongly deviate from standard operating behavior."
}

def generate_explanation(
    rules_triggered: List[str], 
    ml_result: Dict[str, Any], 
    process_name: str
) -> str:
    """
    Synthesizes a coherent, human-readable explanation for a security alert.
    """
    risk_score = ml_result.get("risk_score", 0.0)
    classification = ml_result.get("classification", "Benign")
    contributions = ml_result.get("feature_contributions", {})
    
    explanation_parts = []
    
    # 1. Threat Summary Statement
    explanation_parts.append(
        f"Process '{process_name}' has been classified as **{classification}** with a calculated **Risk Score of {risk_score}%**."
    )
    
    # 2. Rule Evidence
    if rules_triggered:
        explanation_parts.append("\n### Triggered Security Policies:")
        for rule in rules_triggered:
            desc = RULE_DESCRIPTIONS.get(rule, "Triggered security policy rule.")
            explanation_parts.append(f"- **{rule}**: {desc}")
            
    # 3. ML Feature Deviations
    if contributions:
        explanation_parts.append("\n### Machine Learning Behavioral Anomalies:")
        for feat, z_score in contributions.items():
            desc = FEATURE_DESCRIPTIONS.get(feat, f"Behavioral feature '{feat}' is highly anomalous.")
            severity = "critical" if z_score > 3.0 else "moderate"
            explanation_parts.append(f"- **{feat}** ({severity} deviation): {desc}")
            
    # 4. Sequence Analysis
    entropy = ml_result.get("syscall_entropy", 0.0)
    anomaly_score = ml_result.get("seq_anomaly_score", 0.0)
    if anomaly_score > 0.4:
        explanation_parts.append(
            f"\n### Sequence Analysis (ADFA-LD Sequence Scoring):\n"
            f"- System call sequence anomaly score is **{anomaly_score:.2f}** (threshold 0.40). "
            f"The progression of kernel events matches known attack transition templates. "
            f"Call pattern complexity/entropy is {entropy:.2f}."
        )

    # 5. Recommendation Action
    explanation_parts.append("\n### Suggested Remediation:")
    if risk_score >= 75.0:
        explanation_parts.append(
            "**CRITICAL ACTION REQUIRED**: Immediately **Terminate** the process. "
            "This behavior profile represents an active threat (e.g. ransomware encryption or active reverse shell)."
        )
    elif risk_score >= 40.0:
        explanation_parts.append(
            "**RECOMMENDED ACTION**: **Quarantine** the process and inspect the parent process. "
            "The combination of behavior patterns is suspicious, though it may represent developer operations or non-standard tools."
        )
    else:
        explanation_parts.append(
            "**NO ACTION REQUIRED**: Monitor process. The behavior falls within safe baseline parameters."
        )
        
    return "\n".join(explanation_parts)
