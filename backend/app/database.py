import logging
import asyncio
from datetime import datetime
import json
from typing import List, Dict, Any, Optional

# SQLAlchemy imports for SQLite fallback
# pyrefly: ignore [missing-import]
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import declarative_base, sessionmaker

# MongoDB imports

from motor.motor_asyncio import AsyncIOMotorClient

from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Database")

# Global DB connection status and client refs
db_type = "sqlite" # fallback default
mongo_db = None
sqlite_session_factory = None

Base = declarative_base()

# --- SQLite SQLAlchemy Models ---

class ProcessModel(Base):
    __tablename__ = "processes"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    pid = Column(Integer, unique=True, index=True)
    name = Column(String(255), index=True)
    exe = Column(Text)
    cmdline = Column(Text)
    username = Column(String(255))
    parent_pid = Column(Integer)
    parent_name = Column(String(255))
    cpu_percent = Column(Float, default=0.0)
    memory_percent = Column(Float, default=0.0)
    risk_score = Column(Float, default=0.0)
    classification = Column(String(50), default="Benign")
    status = Column(String(50), default="Running")
    first_seen = Column(String(50))
    last_seen = Column(String(50))

class EventModel(Base):
    __tablename__ = "events"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(String(50), index=True)
    pid = Column(Integer, index=True)
    process_name = Column(String(255))
    event_type = Column(String(100)) # file, network, process, syscall
    action = Column(String(100))      # read, write, connect, spawn
    target_path = Column(Text)
    details = Column(Text)

class AlertModel(Base):
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(String(50), index=True)
    pid = Column(Integer, index=True)
    process_name = Column(String(255))
    risk_score = Column(Float)
    classification = Column(String(50))
    confidence = Column(Float)
    rule_triggers = Column(Text) # JSON serialized list
    explanation = Column(Text)
    status = Column(String(50), default="Active")

# --- DB Initialization ---

async def init_db():
    global db_type, mongo_db, sqlite_session_factory
    
    # Try MongoDB
    try:
        logger.info("Attempting to connect to MongoDB...")
        client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=2000)
        # Verify connection by running server_info
        await client.server_info()
        mongo_db = client[settings.DATABASE_NAME]
        db_type = "mongodb"
        logger.info("Successfully connected to MongoDB. Using MongoDB as primary database.")
    except (ConnectionFailure, ServerSelectionTimeoutError, Exception) as e:
        logger.warning(f"MongoDB connection failed: {e}. Falling back to SQLite.")
        db_type = "sqlite"
        
        # Init SQLite
        engine = create_engine(settings.SQLITE_URL, connect_args={"check_same_thread": False})
        Base.metadata.create_all(bind=engine)
        sqlite_session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        logger.info("SQLite database initialized successfully.")

# --- Database Repository Helpers ---

async def save_process(process_data: Dict[str, Any]):
    """Insert or update process metrics."""
    global db_type, mongo_db, sqlite_session_factory
    now_str = datetime.now().isoformat()
    
    if db_type == "mongodb":
        # Upsert process
        await mongo_db.processes.update_one(
            {"pid": process_data["pid"]},
            {
                "$set": {
                    **process_data,
                    "last_seen": now_str
                },
                "$setOnInsert": {
                    "first_seen": now_str,
                    "status": "Running"
                }
            },
            upsert=True
        )
    else:
        # SQLite
        session = sqlite_session_factory()
        try:
            db_proc = session.query(ProcessModel).filter(ProcessModel.pid == process_data["pid"]).first()
            if db_proc:
                db_proc.name = process_data.get("name", db_proc.name)
                db_proc.exe = process_data.get("exe", db_proc.exe)
                db_proc.cmdline = process_data.get("cmdline", db_proc.cmdline)
                db_proc.username = process_data.get("username", db_proc.username)
                db_proc.parent_pid = process_data.get("parent_pid", db_proc.parent_pid)
                db_proc.parent_name = process_data.get("parent_name", db_proc.parent_name)
                db_proc.cpu_percent = process_data.get("cpu_percent", db_proc.cpu_percent)
                db_proc.memory_percent = process_data.get("memory_percent", db_proc.memory_percent)
                db_proc.risk_score = process_data.get("risk_score", db_proc.risk_score)
                db_proc.classification = process_data.get("classification", db_proc.classification)
                db_proc.status = process_data.get("status", db_proc.status)
                db_proc.last_seen = now_str
            else:
                db_proc = ProcessModel(
                    pid=process_data["pid"],
                    name=process_data.get("name"),
                    exe=process_data.get("exe"),
                    cmdline=process_data.get("cmdline"),
                    username=process_data.get("username"),
                    parent_pid=process_data.get("parent_pid"),
                    parent_name=process_data.get("parent_name"),
                    cpu_percent=process_data.get("cpu_percent", 0.0),
                    memory_percent=process_data.get("memory_percent", 0.0),
                    risk_score=process_data.get("risk_score", 0.0),
                    classification=process_data.get("classification", "Benign"),
                    status="Running",
                    first_seen=now_str,
                    last_seen=now_str
                )
                session.add(db_proc)
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"SQLite save_process error: {e}")
        finally:
            session.close()

async def get_processes() -> List[Dict[str, Any]]:
    """Retrieve all processes."""
    global db_type, mongo_db, sqlite_session_factory
    
    if db_type == "mongodb":
        cursor = mongo_db.processes.find({})
        results = await cursor.to_list(length=1000)
        for r in results:
            r["_id"] = str(r["_id"])
        return results
    else:
        session = sqlite_session_factory()
        try:
            procs = session.query(ProcessModel).all()
            return [
                {
                    "pid": p.pid,
                    "name": p.name,
                    "exe": p.exe,
                    "cmdline": p.cmdline,
                    "username": p.username,
                    "parent_pid": p.parent_pid,
                    "parent_name": p.parent_name,
                    "cpu_percent": p.cpu_percent,
                    "memory_percent": p.memory_percent,
                    "risk_score": p.risk_score,
                    "classification": p.classification,
                    "status": p.status,
                    "first_seen": p.first_seen,
                    "last_seen": p.last_seen
                }
                for p in procs
            ]
        finally:
            session.close()

async def get_process(pid: int) -> Optional[Dict[str, Any]]:
    """Retrieve a single process by PID."""
    global db_type, mongo_db, sqlite_session_factory
    
    if db_type == "mongodb":
        p = await mongo_db.processes.find_one({"pid": pid})
        if p:
            p["_id"] = str(p["_id"])
        return p
    else:
        session = sqlite_session_factory()
        try:
            p = session.query(ProcessModel).filter(ProcessModel.pid == pid).first()
            if p:
                return {
                    "pid": p.pid,
                    "name": p.name,
                    "exe": p.exe,
                    "cmdline": p.cmdline,
                    "username": p.username,
                    "parent_pid": p.parent_pid,
                    "parent_name": p.parent_name,
                    "cpu_percent": p.cpu_percent,
                    "memory_percent": p.memory_percent,
                    "risk_score": p.risk_score,
                    "classification": p.classification,
                    "status": p.status,
                    "first_seen": p.first_seen,
                    "last_seen": p.last_seen
                }
            return None
        finally:
            session.close()

async def save_event(event_data: Dict[str, Any]):
    """Insert system event."""
    global db_type, mongo_db, sqlite_session_factory
    
    if db_type == "mongodb":
        await mongo_db.events.insert_one(event_data)
    else:
        session = sqlite_session_factory()
        try:
            db_event = EventModel(
                timestamp=event_data.get("timestamp", datetime.now().isoformat()),
                pid=event_data["pid"],
                process_name=event_data.get("process_name"),
                event_type=event_data.get("event_type"),
                action=event_data.get("action"),
                target_path=event_data.get("target_path"),
                details=event_data.get("details", "")
            )
            session.add(db_event)
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"SQLite save_event error: {e}")
        finally:
            session.close()

async def get_events(limit: int = 200, pid: Optional[int] = None) -> List[Dict[str, Any]]:
    """Retrieve system events."""
    global db_type, mongo_db, sqlite_session_factory
    
    if db_type == "mongodb":
        query = {"pid": pid} if pid is not None else {}
        cursor = mongo_db.events.find(query).sort("timestamp", -1).limit(limit)
        results = await cursor.to_list(length=limit)
        for r in results:
            r["_id"] = str(r["_id"])
        return results
    else:
        session = sqlite_session_factory()
        try:
            query = session.query(EventModel)
            if pid is not None:
                query = query.filter(EventModel.pid == pid)
            events = query.order_by(EventModel.timestamp.desc()).limit(limit).all()
            return [
                {
                    "timestamp": e.timestamp,
                    "pid": e.pid,
                    "process_name": e.process_name,
                    "event_type": e.event_type,
                    "action": e.action,
                    "target_path": e.target_path,
                    "details": e.details
                }
                for e in events
            ]
        finally:
            session.close()

async def save_alert(alert_data: Dict[str, Any]):
    """Insert or update security alert."""
    global db_type, mongo_db, sqlite_session_factory
    
    if db_type == "mongodb":
        await mongo_db.alerts.update_one(
            {"pid": alert_data["pid"]},
            {"$set": alert_data},
            upsert=True
        )
    else:
        session = sqlite_session_factory()
        try:
            db_alert = session.query(AlertModel).filter(AlertModel.pid == alert_data["pid"]).first()
            rule_triggers_json = json.dumps(alert_data.get("rule_triggers", []))
            
            if db_alert:
                db_alert.timestamp = alert_data.get("timestamp", db_alert.timestamp)
                db_alert.process_name = alert_data.get("process_name", db_alert.process_name)
                db_alert.risk_score = alert_data.get("risk_score", db_alert.risk_score)
                db_alert.classification = alert_data.get("classification", db_alert.classification)
                db_alert.confidence = alert_data.get("confidence", db_alert.confidence)
                db_alert.rule_triggers = rule_triggers_json
                db_alert.explanation = alert_data.get("explanation", db_alert.explanation)
                db_alert.status = alert_data.get("status", db_alert.status)
            else:
                db_alert = AlertModel(
                    timestamp=alert_data.get("timestamp", datetime.now().isoformat()),
                    pid=alert_data["pid"],
                    process_name=alert_data.get("process_name"),
                    risk_score=alert_data.get("risk_score"),
                    classification=alert_data.get("classification"),
                    confidence=alert_data.get("confidence"),
                    rule_triggers=rule_triggers_json,
                    explanation=alert_data.get("explanation"),
                    status=alert_data.get("status", "Active")
                )
                session.add(db_alert)
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"SQLite save_alert error: {e}")
        finally:
            session.close()

async def get_alerts() -> List[Dict[str, Any]]:
    """Retrieve security alerts."""
    global db_type, mongo_db, sqlite_session_factory
    
    if db_type == "mongodb":
        cursor = mongo_db.alerts.find({}).sort("timestamp", -1)
        results = await cursor.to_list(length=100)
        for r in results:
            r["_id"] = str(r["_id"])
        return results
    else:
        session = sqlite_session_factory()
        try:
            alerts = session.query(AlertModel).order_by(AlertModel.timestamp.desc()).all()
            return [
                {
                    "timestamp": a.timestamp,
                    "pid": a.pid,
                    "process_name": a.process_name,
                    "risk_score": a.risk_score,
                    "classification": a.classification,
                    "confidence": a.confidence,
                    "rule_triggers": json.loads(a.rule_triggers),
                    "explanation": a.explanation,
                    "status": a.status
                }
                for a in alerts
            ]
        finally:
            session.close()

async def update_process_status(pid: int, status: str):
    """Update running state of a process (e.g. Quarantined, Terminated)."""
    global db_type, mongo_db, sqlite_session_factory
    
    if db_type == "mongodb":
        await mongo_db.processes.update_one({"pid": pid}, {"$set": {"status": status}})
        await mongo_db.alerts.update_one({"pid": pid}, {"$set": {"status": status}})
    else:
        session = sqlite_session_factory()
        try:
            p = session.query(ProcessModel).filter(ProcessModel.pid == pid).first()
            if p:
                p.status = status
            a = session.query(AlertModel).filter(AlertModel.pid == pid).first()
            if a:
                a.status = status
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"SQLite update_process_status error: {e}")
        finally:
            session.close()
