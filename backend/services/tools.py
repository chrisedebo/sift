import json
import logging
from typing import Dict, Any, List, Optional
from enum import Enum
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import or_

from db.models import FileRecord, ActionItem
from services.metadata_extractor import extract_file_metadata
from services.searxng import searx_client

logger = logging.getLogger("sift.tools")

# --- STRICT TOOL PARAMETER SCHEMAS (Prevent SQL Injection & Payload Injection) ---

class FileCategoryEnum(str, Enum):
    SOFTWARE = "Software & Apps"
    MEDIA = "Media"
    DOCUMENTS = "Documents"
    ARCHIVES = "Archives & Other"

class FileStatusEnum(str, Enum):
    INDEXED = "indexed"
    CATEGORIZED = "categorized"
    ACTION_PENDING = "action_pending"
    COMPLETED = "completed"

class SortByEnum(str, Enum):
    FILENAME = "filename"
    FILE_SIZE = "file_size"
    CREATED_AT = "created_at"
    CATEGORY = "category"

class SearchFilesInput(BaseModel):
    search_term: Optional[str] = Field(None, description="Partial or full filename search string")
    category: Optional[FileCategoryEnum] = Field(None, description="Filter by file category")
    extension: Optional[str] = Field(None, description="Filter by file extension (e.g. '.mp3', '.flac', '.jpg')")
    min_size_bytes: Optional[int] = Field(None, description="Minimum file size in bytes")
    max_size_bytes: Optional[int] = Field(None, description="Maximum file size in bytes")
    status: Optional[FileStatusEnum] = Field(None, description="Filter by file status")
    sort_by: Optional[SortByEnum] = Field(SortByEnum.FILENAME, description="Sort field")
    sort_desc: bool = Field(False, description="Sort in descending order if True")
    limit: int = Field(20, ge=1, le=100, description="Max number of files to return (1-100)")

class InspectMetadataInput(BaseModel):
    file_id: Optional[int] = Field(None, description="Database ID of the file")
    filename: Optional[str] = Field(None, description="Filename to look up if file_id is not known")

class ProposeRelocationInput(BaseModel):
    file_id: int = Field(..., description="ID of the file to move/rename")
    target_path: str = Field(..., description="Target destination path on disk (e.g. '/mnt/big-storage/webserver/audio/track.flac')")
    category: Optional[str] = Field(None, description="Proposed category")
    reasoning: str = Field(..., description="Reasoning for this organizational proposal")

# --- SECURE TOOL IMPLEMENTATIONS ---

def tool_search_files(db: Session, args: SearchFilesInput) -> Dict[str, Any]:
    """
    Safely queries the database using SQLAlchemy ORM parameterized filtering.
    Prevents SQL injection completely by using typed parameter bindings.
    """
    logger.info("Executing safe tool: search_files | term='%s' category='%s' limit=%d", args.search_term, args.category, args.limit)
    query = db.query(FileRecord)

    if args.search_term:
        # Parameterized ilike search prevents SQL injection
        term = f"%{args.search_term.strip()}%"
        query = query.filter(or_(FileRecord.filename.ilike(term), FileRecord.file_path.ilike(term)))

    if args.category:
        query = query.filter(FileRecord.category == args.category.value)

    if args.extension:
        ext = args.extension if args.extension.startswith(".") else f".{args.extension}"
        query = query.filter(FileRecord.extension.ilike(ext))

    if args.min_size_bytes is not None:
        query = query.filter(FileRecord.file_size >= args.min_size_bytes)

    if args.max_size_bytes is not None:
        query = query.filter(FileRecord.file_size <= args.max_size_bytes)

    if args.status:
        query = query.filter(FileRecord.status == args.status.value)

    # Safe sorting
    sort_col = getattr(FileRecord, args.sort_by.value, FileRecord.filename)
    if args.sort_desc:
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col.asc())

    files = query.limit(args.limit).all()

    return {
        "count": len(files),
        "files": [
            {
                "id": f.id,
                "filename": f.filename,
                "file_path": f.file_path,
                "file_size": f.file_size,
                "extension": f.extension,
                "category": f.category,
                "status": f.status
            }
            for f in files
        ]
    }

def tool_inspect_metadata(db: Session, args: InspectMetadataInput) -> Dict[str, Any]:
    """
    Reads embedded ID3 tags, EXIF camera data, and technical properties for a file.
    """
    file_record = None
    if args.file_id:
        file_record = db.query(FileRecord).filter(FileRecord.id == args.file_id).first()
    elif args.filename:
        file_record = db.query(FileRecord).filter(FileRecord.filename.ilike(f"%{args.filename}%")).first()

    if not file_record:
        return {"error": "File record not found in database."}

    disk_meta = extract_file_metadata(file_record.file_path)
    return {
        "file_id": file_record.id,
        "filename": file_record.filename,
        "file_path": file_record.file_path,
        "category": file_record.category,
        "disk_metadata": disk_meta
    }

def tool_propose_relocation(db: Session, args: ProposeRelocationInput) -> Dict[str, Any]:
    """
    Safely stages a dry-run ActionItem proposal in the database for approval queue review.
    """
    file_record = db.query(FileRecord).filter(FileRecord.id == args.file_id).first()
    if not file_record:
        return {"error": f"File ID {args.file_id} not found."}

    # Ensure target_path is within NAS mount boundary
    target_clean = args.target_path.strip()
    if not target_clean.startswith("/mnt/big-storage"):
        target_clean = f"/mnt/big-storage/{target_clean.lstrip('/')}"

    existing_action = db.query(ActionItem).filter(
        ActionItem.file_id == file_record.id,
        ActionItem.status == "pending"
    ).first()

    if existing_action:
        existing_action.target_path = target_clean
        existing_action.reasoning = args.reasoning
        if args.category:
            existing_action.category = args.category
    else:
        action = ActionItem(
            file_id=file_record.id,
            action_type="organize",
            source_path=file_record.file_path,
            target_path=target_clean,
            category=args.category or file_record.category,
            reasoning=args.reasoning,
            status="pending"
        )
        db.add(action)

    file_record.status = "action_pending"
    db.commit()

    logger.info("Tool proposed relocation | file_id=%d target='%s'", file_record.id, target_clean)
    return {
        "status": "proposal_staged",
        "file_id": file_record.id,
        "source_path": file_record.file_path,
        "target_path": target_clean,
        "reasoning": args.reasoning
    }

# Tool Registry Declarations for Local LLM JSON Tool Calling
AVAILABLE_TOOLS_SCHEMA = [
    {
        "name": "search_files",
        "description": "Searches and filters indexed files in the NAS database using safe parameterized criteria.",
        "parameters": SearchFilesInput.model_json_schema()
    },
    {
        "name": "inspect_file_metadata",
        "description": "Extracts deep embedded ID3 tags, EXIF camera metadata, resolution, and duration for a specific file.",
        "parameters": InspectMetadataInput.model_json_schema()
    },
    {
        "name": "propose_relocation",
        "description": "Stages a dry-run file relocation or rename proposal in the approval queue.",
        "parameters": ProposeRelocationInput.model_json_schema()
    }
]
