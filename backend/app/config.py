import os
from pathlib import Path

# Load .env file from the project root (two levels up from this file)
try:
    from dotenv import load_dotenv 
    _env_path = Path(__file__).resolve().parents[2] / ".env"
    load_dotenv(dotenv_path=_env_path)
except ImportError:
    pass  # python-dotenv not installed; fall back to OS env vars

class Settings:
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    DATABASE_NAME: str = os.getenv("DATABASE_NAME", "hids_db")
    SQLITE_URL: str = os.getenv("SQLITE_URL", "sqlite:///./hids.db")
    
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", 8000))
    
    # Sensor authorization configurations
    SENSOR_ID: str = os.getenv("SENSOR_ID", "sensor-windows-testing")
    SENSOR_KEY: str = os.getenv("SENSOR_KEY", "testing-secure-key-321")
    
    MODEL_DIR: str = os.path.join(os.path.dirname(os.path.abspath(__file__)), "detection_models")

    @property
    def MODEL_PATH(self) -> str:
        import sys
        suffix = "_windows" if sys.platform == "win32" else "_linux"
        path = os.path.join(self.MODEL_DIR, f"rf_model{suffix}.joblib")
        if os.path.exists(path):
            return path
        fallback = os.path.join(self.MODEL_DIR, "rf_model.joblib")
        if os.path.exists(fallback):
            return fallback
        return path

    @property
    def SCALER_PATH(self) -> str:
        import sys
        suffix = "_windows" if sys.platform == "win32" else "_linux"
        path = os.path.join(self.MODEL_DIR, f"scaler{suffix}.joblib")
        if os.path.exists(path):
            return path
        fallback = os.path.join(self.MODEL_DIR, "scaler.joblib")
        if os.path.exists(fallback):
            return fallback
        return path

settings = Settings()


# Create model directory if it doesn't exist
os.makedirs(settings.MODEL_DIR, exist_ok=True)
