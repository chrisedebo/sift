import os
from typing import Optional, List, Dict, Any
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

@router.get("/tree")
def get_directory_tree(db: Session = Depends(get_db)):
    """
    Build a nested directory tree from all indexed file records in the database.
    This endpoint provides the complete directory structure regardless of pagination limits.
    """
    records = db.query(FileRecord).all()
    tree: Dict[str, Any] = {}

    for rec in records:
        parts = rec.file_path.strip('/').split('/')
        current = tree
        for part in parts[:-1]:
            if part not in current:
                current[part] = {"_dir": {}}
            current = current[part]["_dir"]
        current[parts[-1]] = {
            "_file": {
                "id": rec.id,
                "filename": rec.filename,
                "file_size": rec.file_size,
                "extension": rec.extension,
                "mime_type": rec.mime_type,
                "category": rec.category,
                "summary": rec.summary,
                "status": rec.status,
                "file_path": rec.file_path,
            }
        }

    def extract_dirs(node):
        """Extract only directory names from the tree node."""
        dirs = []
        for key, value in node.items():
            if isinstance(value, dict) and "_dir" in value:
                dirs.append(key)
        return dirs

    def build_tree(node):
        """Build a clean tree structure with folders and files keys."""
        result = {"folders": [], "files": []}
        for key, value in node.items():
            if isinstance(value, dict) and "_dir" in value:
                child = build_tree(value["_dir"])
                if child["folders"] or child["files"]:
                    result["folders"].append({"name": key, "children": child})
            elif isinstance(value, dict) and "_file" in value:
                result["files"].append(value["_file"])
        return result

    tree_data = build_tree(tree)

    return {
        "total_files": len(records),
        "tree": tree_data
    }


@router.get("/dir")
def get_directory_contents(
    path: str = Query(..., description="Directory path to list contents for"),
    db: Session = Depends(get_db)
):
    """
    Get immediate children (folders and files) for a specific directory path.
    Uses the database index to efficiently find all files under the given path.
    Only returns direct children, not recursive descendants.
    """
    # Ensure path ends with / for proper prefix matching
    if not path.endswith('/'):
        search_path = path + '/'
    else:
        search_path = path

    # Get all records under this path
    records = db.query(FileRecord).filter(
        FileRecord.file_path.like(search_path + '%')
    ).all()

    folders = set()
    direct_files = []

    for rec in records:
        # Get the relative path from the search path
        remainder = rec.file_path[len(search_path):]

        # If there's a slash, the first segment is a subdirectory
        if '/' in remainder:
            first_segment = remainder.split('/')[0]
            folders.add(first_segment)
        elif remainder:
            # Direct file child
            direct_files.append({
                "id": rec.id,
                "filename": rec.filename,
                "file_size": rec.file_size,
                "extension": rec.extension,
                "mime_type": rec.mime_type,
                "category": rec.category,
                "summary": rec.summary,
                "status": rec.status,
                "file_path": rec.file_path,
            })

    return {
        "path": path,
        "folders": sorted(folders),
        "files": sorted(direct_files, key=lambda f: f["filename"].lower())
    }


@router.post("/scan")
def trigger_directory_scan(req: ScanRequest, db: Session = Depends(get_db)):
    target_path = req.target_path or settings.NAS_MOUNT_PATH
    force_rescan = req.force_rescan if req.force_rescan is not None else True

    import pathlib
    try:
        if not os.path.isabs(target_path):
            target_path = os.path.join(settings.NAS_MOUNT_PATH, target_path.lstrip("/"))

        resolved_path = pathlib.Path(target_path).resolve()
        nas_mount_path = pathlib.Path(settings.NAS_MOUNT_PATH).resolve()

        if not resolved_path.is_relative_to(nas_mount_path):
            raise ValueError(f"Path '{target_path}' is outside the authorized NAS mount path.")

        target_path = str(resolved_path)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid path provided: {str(e)}")

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
