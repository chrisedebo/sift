from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from config import settings
from services.llm_provider import llm_client
from services.searxng import searx_client

router = APIRouter(prefix="/api/settings", tags=["Settings"])

class SettingsUpdate(BaseModel):
    lm_studio_url: Optional[str] = None
    searxng_url: Optional[str] = None
    nas_mount_path: Optional[str] = None

@router.get("/")
def get_current_settings():
    return {
        "lm_studio_url": settings.LM_STUDIO_URL,
        "searxng_url": settings.SEARXNG_URL,
        "nas_mount_path": settings.NAS_MOUNT_PATH,
        "database_url": settings.DATABASE_URL
    }

@router.get("/health")
async def get_services_health():
    lm_health = await llm_client.check_health()
    searx_health = await searx_client.check_health()
    
    return {
        "lm_studio": lm_health,
        "searxng": searx_health
    }

@router.post("/")
def update_settings(update: SettingsUpdate):
    if update.lm_studio_url:
        settings.LM_STUDIO_URL = update.lm_studio_url
        llm_client.base_url = update.lm_studio_url.rstrip("/")
    if update.searxng_url:
        settings.SEARXNG_URL = update.searxng_url
        searx_client.base_url = update.searxng_url.rstrip("/")
    if update.nas_mount_path:
        settings.NAS_MOUNT_PATH = update.nas_mount_path

    return {
        "status": "success",
        "settings": get_current_settings()
    }
