import os
import json
import hashlib
import mimetypes
import logging
import time
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from db.models import FileRecord
from services.metadata_extractor import extract_file_metadata, make_json_safe
from constants import SOFTWARE_EXTS, VIDEO_EXTS, AUDIO_EXTS, IMAGE_EXTS, DOC_EXTS

logger = logging.getLogger("sift.scanner")

# Initialize mimetypes
mimetypes.init()

def get_file_hash(filepath: str, max_bytes: int = 10 * 1024 * 1024) -> Optional[str]:
    """Calculate SHA256 hash of a file up to max_bytes for speed on large NAS files."""
    try:
        hasher = hashlib.sha256()
        with open(filepath, "rb") as f:
            chunk = f.read(max_bytes)
            if chunk:
                hasher.update(chunk)
        return hasher.hexdigest()
    except Exception:
        return None

def detect_category(filename: str, ext: str, mime: str) -> str:
    """Basic fallback category detector based on extension and MIME type."""
    ext = ext.lower().strip(".")
    mime_lower = (mime or "").lower()
    
    if ext in SOFTWARE_EXTS or "x-executable" in mime_lower or "x-iso9660-image" in mime_lower:
        return "Software & Apps"
    elif ext in VIDEO_EXTS or ext in AUDIO_EXTS or ext in IMAGE_EXTS or mime_lower.startswith("video/") or mime_lower.startswith("audio/") or mime_lower.startswith("image/"):
        return "Media"
    elif ext in DOC_EXTS or mime_lower.startswith("text/") or "pdf" in mime_lower:
        return "Documents"
    else:
        return "Archives & Other"

def scan_directory(target_path: str, db: Session, force_rescan: bool = False) -> Dict[str, Any]:
    """
    Scans a directory tree safely, extracting embedded ID3/EXIF metadata and recording FileRecord entries in SQLite/PostgreSQL.
    If force_rescan is True, re-extracts and refreshes metadata for all existing files.
    Isolates per-record transaction commits to ensure clean persistence.
    """
    if not os.path.exists(target_path):
        logger.error("Scan failed | target_path='%s' error='Directory does not exist'", target_path)
        raise ValueError(f"Directory path '{target_path}' does not exist.")

    start_time = time.time()
    total_scanned = 0
    new_indexed = 0
    updated_indexed = 0

    for root, dirs, files in os.walk(target_path):
        # Skip hidden directories like .git or .tmp
        dirs[:] = [d for d in dirs if not d.startswith(".")]

        for filename in files:
            if filename.startswith("."):
                continue

            full_path = os.path.abspath(os.path.join(root, filename))
            
            try:
                stat = os.stat(full_path)
                file_size = stat.st_size
                raw_ext = os.path.splitext(filename)[1].lower()
                ext = raw_ext[:64] if raw_ext else ""
                raw_mime = mimetypes.guess_type(full_path)[0] or "application/octet-stream"
                mime_type = raw_mime[:128]
                category = detect_category(filename, ext, mime_type)

                # Extract embedded disk metadata (ID3 tags, EXIF camera data, image resolution)
                meta_json = None
                try:
                    disk_meta = extract_file_metadata(full_path)
                    safe_meta = make_json_safe(disk_meta)
                    meta_json = json.dumps(safe_meta, default=str).replace('\\u0000', '')
                except Exception as meta_err:
                    logger.warning("Failed to serialize metadata for '%s': %s", full_path, str(meta_err))

                existing_record = db.query(FileRecord).filter(FileRecord.file_path == full_path).first()

                if existing_record:
                    # Refresh metadata if force_rescan=True OR file_size changed OR enriched_data is missing
                    if force_rescan or existing_record.file_size != file_size or not existing_record.enriched_data or existing_record.category != category:
                        existing_record.file_size = file_size
                        existing_record.category = category
                        if meta_json:
                            existing_record.enriched_data = meta_json
                        existing_record.updated_at = datetime.utcnow()
                        db.commit()
                        updated_indexed += 1
                else:
                    new_record = FileRecord(
                        file_path=full_path,
                        filename=filename,
                        file_size=file_size,
                        extension=ext,
                        mime_type=mime_type,
                        category=category,
                        enriched_data=meta_json,
                        status="indexed"
                    )
                    db.add(new_record)
                    db.commit()
                    new_indexed += 1

                total_scanned += 1

            except (PermissionError, FileNotFoundError):
                continue
            except Exception as item_err:
                db.rollback()
                logger.error("Error processing file '%s' during scan: %s", full_path, str(item_err), exc_info=True)
                continue

    elapsed_ms = int((time.time() - start_time) * 1000)

    logger.info(
        "Directory scan completed | target_path='%s' total_scanned=%d new_indexed=%d updated=%d duration_ms=%d",
        target_path, total_scanned, new_indexed, updated_indexed, elapsed_ms
    )

    return {
        "target_path": target_path,
        "total_scanned": total_scanned,
        "new_indexed": new_indexed,
        "updated_indexed": updated_indexed
    }
