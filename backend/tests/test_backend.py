import os
import json
import tempfile
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from db.database import Base, get_db, init_db
from services.scanner import scan_directory, detect_category
from services.file_ops import execute_action, reject_action
from services.assistant import encode_image_base64
from db.models import FileRecord, ActionItem, SearxCache
from config import settings

# Create in-memory SQLite DB for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Sift API"
    assert data["version"] == "0.1.0"

def test_category_detector():
    assert detect_category("app.iso", ".iso", "application/x-iso9660-image") == "Software & Apps"
    assert detect_category("movie.mkv", ".mkv", "video/x-matroska") == "Media"
    assert detect_category("track.flac", ".flac", "audio/flac") == "Media"
    assert detect_category("report.pdf", ".pdf", "application/pdf") == "Documents"
    assert detect_category("archive.tar.gz", ".gz", "application/gzip") == "Software & Apps"

def test_database_schema_column_integrity():
    """Verify that all columns defined in SQLAlchemy models exist in the database table schema."""
    inspector = inspect(engine)
    file_cols = [c["name"] for c in inspector.get_columns("file_records")]
    
    # Critical columns that must exist to avoid UndefinedColumn / OperationalError
    required_cols = ["id", "file_path", "filename", "file_size", "extension", "mime_type", "sha256_hash", "category", "summary", "enriched_data", "status", "created_at", "updated_at"]
    for col in required_cols:
        assert col in file_cols, f"Missing column '{col}' in file_records table schema!"

def test_init_sql_matches_orm_models():
    """Verify that backend/db/01-init.sql contains all columns defined in FileRecord ORM model."""
    sql_path = os.path.join(os.path.dirname(__file__), "..", "db", "01-init.sql")
    assert os.path.exists(sql_path), "01-init.sql does not exist!"
    
    with open(sql_path, "r") as f:
        sql_content = f.read()

    # Ensure all ORM column names are present in 01-init.sql
    for col in ["file_path", "filename", "file_size", "extension", "mime_type", "sha256_hash", "category", "summary", "enriched_data", "status"]:
        assert col in sql_content, f"01-init.sql is missing column '{col}'!"

def test_scan_path_sanitization_guardrails():
    """Test that trigger_directory_scan handles dirty/copy-pasted user path strings cleanly."""
    with tempfile.TemporaryDirectory() as temp_dir:
        file1 = os.path.join(temp_dir, "test.mp3")
        with open(file1, "w") as f:
            f.write("audio data")

        original_mount = settings.NAS_MOUNT_PATH
        settings.NAS_MOUNT_PATH = temp_dir
        
        try:
            # Test valid path
            response = client.post("/api/files/scan", json={"target_path": temp_dir})
            assert response.status_code == 200

            # Test non-existent path cleanly returns HTTP 400 with helpful detail
            response = client.post("/api/files/scan", json={"target_path": "/invalid/nonexistent/folder/12345"})
            assert response.status_code == 400
            assert "outside the authorized NAS mount path" in response.json()["detail"] or "does not exist" in response.json()["detail"]
        finally:
            settings.NAS_MOUNT_PATH = original_mount

def test_directory_scan_and_list_files():
    with tempfile.TemporaryDirectory() as temp_dir:
        # Create dummy test files
        file1 = os.path.join(temp_dir, "linux_distro.iso")
        file2 = os.path.join(temp_dir, "vacation_video.mp4")
        
        with open(file1, "w") as f:
            f.write("dummy iso content")
        with open(file2, "w") as f:
            f.write("dummy video content")

        original_mount = settings.NAS_MOUNT_PATH
        settings.NAS_MOUNT_PATH = temp_dir

        try:
            # Trigger scan API
            response = client.post("/api/files/scan", json={"target_path": temp_dir, "force_rescan": True})
            assert response.status_code == 200
            scan_data = response.json()["data"]
            assert scan_data["total_scanned"] == 2
            assert scan_data["new_indexed"] == 2

            # List files API
            response = client.get("/api/files/")
            assert response.status_code == 200
            files_data = response.json()
            assert files_data["total"] == 2

            # Stats API
            response = client.get("/api/files/stats")
            assert response.status_code == 200
            stats = response.json()
            assert stats["total_files"] == 2
        finally:
            settings.NAS_MOUNT_PATH = original_mount

def test_file_details_and_preview_endpoints():
    """Test GET /api/files/{id}/details and GET /api/files/{id}/preview endpoints."""
    with tempfile.TemporaryDirectory() as temp_dir:
        sample_img = os.path.join(temp_dir, "photo.jpg")
        with open(sample_img, "wb") as f:
            f.write(b"dummy image bytes")

        db = TestingSessionLocal()
        record = FileRecord(
            file_path=sample_img,
            filename="photo.jpg",
            file_size=100,
            extension=".jpg",
            mime_type="image/jpeg",
            category="Media",
            enriched_data=json.dumps({"image_info": {"width": 1920, "height": 1080}})
        )
        db.add(record)
        db.commit()

        # Details API
        res = client.get(f"/api/files/{record.id}/details")
        assert res.status_code == 200
        data = res.json()
        assert data["file"]["filename"] == "photo.jpg"
        assert data["disk_metadata"] is not None

        # Preview API
        res_prev = client.get(f"/api/files/{record.id}/preview")
        assert res_prev.status_code == 200
        assert res_prev.headers["content-type"] == "image/jpeg"

        db.close()

def test_dry_run_action_execution():
    with tempfile.TemporaryDirectory() as temp_dir:
        source_file = os.path.join(temp_dir, "unorganized_software.exe")
        target_dir = os.path.join(temp_dir, "Software & Apps")
        target_file = os.path.join(target_dir, "clean_software.exe")

        with open(source_file, "w") as f:
            f.write("installer content")

        db = TestingSessionLocal()
        record = FileRecord(
            file_path=source_file,
            filename="unorganized_software.exe",
            file_size=100,
            extension=".exe",
            category="Software & Apps"
        )
        db.add(record)
        db.commit()

        action = ActionItem(
            file_id=record.id,
            action_type="organize",
            source_path=source_file,
            target_path=target_file,
            category="Software & Apps",
            status="approved"
        )
        db.add(action)
        db.commit()

        # Execute action
        result = execute_action(action.id, db)
        assert result["status"] == "executed"
        assert os.path.exists(target_file)
        assert not os.path.exists(source_file)

        db.close()

def test_image_base64_encoding():
    """Test base64 encoding helper for vision model multimodal payloads."""
    with tempfile.TemporaryDirectory() as temp_dir:
        img_path = os.path.join(temp_dir, "test.png")
        with open(img_path, "wb") as f:
            f.write(b"PNG_DUMMY_IMAGE_DATA")

        b64_str = encode_image_base64(img_path)
        assert b64_str is not None
        assert isinstance(b64_str, str)
        assert len(b64_str) > 0
