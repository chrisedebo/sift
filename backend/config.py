import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    
    # Path configuration
    NAS_MOUNT_PATH: str = "/mnt/big-storage"
    DATABASE_URL: str = "sqlite:///./sift.db"
    
    # External services
    LM_STUDIO_URL: str = "http://localhost:1234/v1"
    LM_STUDIO_MODEL: str = "local-model"
    LM_STUDIO_API_KEY: str = "lm-studio"
    LM_TIMEOUT: float = 180.0  # 3-minute timeout for local LLMs
    
    SEARXNG_URL: str = "http://localhost:8080"
    
    # Execution safety & logging mode
    DRY_RUN_DEFAULT: bool = True
    LOG_LEVEL: str = "DEBUG"
    
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
