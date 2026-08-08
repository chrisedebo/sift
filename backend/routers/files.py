import os
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from db.database import get_db
from db.models import FileRecord, ActionItem
from services.scanner import scan_directory
from services.metadata_extractor import extract_file_metadata
from config import settings

router = APIRouter(prefix="/api/files", tags=["Files"])

class ScanRequest(BaseModel):
    target_path: Optional[str] = None
    force_rescan: Optional[bool] = True

@router.get("/")
def list_files(
    skip: int = 0,
    limit: int = 50,
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(FileRecord)

    if category:
        query = query.filter(FileRecord.category == category)
    if status:
        query = query.filter(FileRecord.status == status)
    if search:
        query = query.filter(FileRecord.filename.ilike(f"%{search}%"))

    total = query.count()
    items = query.order_by(FileRecord.updated_at.desc()).offset(skip).limit(limit).all()

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": [
            {
                "id": item.id,
                "file_path": item.file_path,
                "filename": item.filename,
                "file_size": item.file_size,
                "extension": item.extension,
                "mime_type": item.mime_type,
                "category": item.category,
                "summary": item.summary,
                "status": item.status,
                "created_at": item.created_at.isoformat() if item.created_at else None,
                "updated_at": item.updated_at.isoformat() if item.updated_at else None
            }
            for item in items
        ]
    }

@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total_files = db.query(FileRecord).count()
    total_bytes = db.query(FileRecord).with_entities(FileRecord.file_size).all()
    sum_bytes = sum(b[0] for b in total_bytes if b[0])

    categories = {}
    for cat in ["Software & Apps", "Media", "Documents", "Archives & Other"]:
        categories[cat] = db.query(FileRecord).filter(FileRecord.category == cat).count()

    statuses = {}
    for st in ["indexed", "categorized", "action_pending", "completed"]:
        statuses[st] = db.query(FileRecord).filter(FileRecord.status == st).count()

    return {
        "total_files": total_files,
        "total_bytes": sum_bytes,
        "categories": categories,
        "statuses": statuses
    }

@router.get("/{file_id}/details")
def get_file_details(file_id: int, db: Session = Depends(get_db)):
    file_record = db.query(FileRecord).filter(FileRecord.id == file_id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="File record not found.")

    action_item = db.query(ActionItem).filter(
        ActionItem.file_id == file_id,
        ActionItem.status.in_(["pending", "approved", "rejected", "executed"])
    ).first()

    disk_meta = extract_file_metadata(file_record.file_path)

    return {
        "file": {
            "id": file_record.id,
            "filename": file_record.filename,
            "file_path": file_record.file_path,
            "file_size": file_record.file_size,
            "extension": file_record.extension,
            "mime_type": file_record.mime_type,
            "category": file_record.category,
            "summary": file_record.summary,
            "status": file_record.status,
            "created_at": file_record.created_at.isoformat() if file_record.created_at else None,
            "updated_at": file_record.updated_at.isoformat() if file_record.updated_at else None,
        },
        "disk_metadata": disk_meta,
        "action_item": {
            "id": action_item.id,
            "action_type": action_item.action_type,
            "source_path": action_item.source_path,
            "target_path": action_item.target_path,
            "category": action_item.category,
            "reasoning": action_item.reasoning,
            "status": action_item.status
        } if action_item else None
    }

@router.get("/{file_id}/preview")
def preview_file(file_id: int, db: Session = Depends(get_db)):
    file_record = db.query(FileRecord).filter(FileRecord.id == file_id).first()
    if not file_record or not os.path.exists(file_record.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk.")

    return FileResponse(
        path=file_record.file_path,
        media_type=file_record.mime_type,
        filename=file_record.filename
    )

@router.post("/scan")
def trigger_directory_scan(req: ScanRequest, db: Session = Depends(get_db)):
    target_path = req.target_path or settings.NAS_MOUNT_PATH
    force_rescan = req.force_rescan if req.force_rescan is not None else True

    # Clean path string in case user pasted conversation text with embedded mount path
    if "/mnt/big-storage" in target_path:
        target_path = "/mnt/big-storage" + target_path.split("/mnt/big-storage", 1)[1]

    if not os.path.isabs(target_path) and not os.path.exists(target_path):
        target_path = os.path.join("/mnt/big-storage", target_path.lstrip("/"))

    try:
        result = scan_directory(target_path, db, force_rescan=force_rescan)
        return {
            "status": "success",
            "message": f"Scan completed: {result['new_indexed']} new indexed, {result['updated_indexed']} metadata refreshed.",
            "data": result
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scan error: {str(e)}")
