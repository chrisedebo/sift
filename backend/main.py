import sys
import os
import logging
from contextlib import asynccontextmanager

from config import settings

# Configure structured, clean logging to stdout with dynamic LOG_LEVEL
log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.DEBUG)
logging.basicConfig(
    level=log_level,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("sift.main")

# Ensure backend directory is in python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db.database import init_db
from routers import files, categorize, queue, settings as settings_router, assistant

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for database initialization and graceful startup/shutdown."""
    try:
        init_db()
        logger.info("Sift API initialized with log_level=%s. Database ready.", settings.LOG_LEVEL)
    except Exception as e:
        logger.error("Startup database initialization error: %s", str(e), exc_info=True)
    yield
    logger.info("Sift API shutting down gracefully.")

app = FastAPI(
    title="Sift API",
    description="Intelligent NAS File & Media Organizer with Local LLM and SearXNG Web Search",
    version="0.1.0",
    lifespan=lifespan
)

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {
        "name": "Sift API",
        "version": "0.1.0",
        "docs": "/docs",
        "status": "online"
    }

# Include API routers
app.include_router(files.router)
app.include_router(categorize.router)
app.include_router(queue.router)
app.include_router(settings_router.router)
app.include_router(assistant.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
