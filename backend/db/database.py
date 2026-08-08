import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

from config import settings

logger = logging.getLogger("sift.db")

# Ensure SQLite database connects cleanly if using fallback file
connect_args = {"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """
    Verifies database connection health at application startup.
    Schema migrations (DDL/ALTER/CREATE) are exclusively managed by the Grate db-init container.
    App code executes ONLY CRUD operations.
    """
    if "sqlite" in settings.DATABASE_URL:
        db_file = settings.DATABASE_URL.replace("sqlite:////", "/").replace("sqlite:///", "")
        dir_path = os.path.dirname(db_file)
        if dir_path and not os.path.exists(dir_path):
            try:
                os.makedirs(dir_path, exist_ok=True)
            except Exception as e:
                logger.warning("Could not create database directory '%s': %s", dir_path, str(e))
        # Standalone SQLite fallback for unit tests
        Base.metadata.create_all(bind=engine)

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            logger.info("Database connection health verified successfully.")
    except Exception as e:
        logger.error("Database connection verification failed: %s", str(e), exc_info=True)
        raise
