from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class EventCreate(BaseModel):
    pid: int
    process_name: str
    event_type: str  # file, network, process, syscall
    action: str      # read, write, connect, spawn, open, etc.
    target_path: Optional[str] = ""
    details: Optional[str] = ""
    timestamp: Optional[str] = None

class ProcessUpdate(BaseModel):
    pid: int
    name: str
    exe: Optional[str] = ""
    cmdline: Optional[str] = ""
    username: Optional[str] = ""
    parent_pid: Optional[int] = 0
    parent_name: Optional[str] = ""
    cpu_percent: Optional[float] = 0.0
    memory_percent: Optional[float] = 0.0

class ProcessResponse(BaseModel):
    pid: int
    name: str
    exe: str
    cmdline: str
    username: str
    parent_pid: int
    parent_name: str
    cpu_percent: float
    memory_percent: float
    risk_score: float
    classification: str
    status: str
    first_seen: str
    last_seen: str

class AlertResponse(BaseModel):
    timestamp: str
    pid: int
    process_name: str
    risk_score: float
    classification: str
    confidence: float
    rule_triggers: List[str]
    explanation: str
    status: str

class MitigateAction(BaseModel):
    pid: int
    action: str  # kill, quarantine, ignore
