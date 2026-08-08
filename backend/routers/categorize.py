from typing import List, Optional
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from db.database import get_db
from db.models import FileRecord, ActionItem
from services.categorizer import categorize_and_enrich_file
from services.intent_service import parse_user_intent, IntentType

logger = logging.getLogger("sift.categorize_router")

router = APIRouter(prefix="/api/categorize", tags=["Categorize"])

class SingleCategorizeRequest(BaseModel):
    custom_prompt: Optional[str] = None

class BatchCategorizeRequest(BaseModel):
    file_ids: Optional[List[int]] = None
    limit: Optional[int] = 50
    custom_prompt: Optional[str] = None

@router.post("/file/{file_id}")
async def categorize_single_file(
    file_id: int,
    req: Optional[SingleCategorizeRequest] = None,
    db: Session = Depends(get_db)
):
    file_record = db.query(FileRecord).filter(FileRecord.id == file_id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="File record not found.")

    custom_prompt = req.custom_prompt if req else None
    res = await categorize_and_enrich_file(file_record, db, custom_prompt=custom_prompt)
    return res

@router.post("/batch")
async def categorize_batch(req: BatchCategorizeRequest, db: Session = Depends(get_db)):
    prompt_text = (req.custom_prompt or "").strip()
    parsed_intent = parse_user_intent(prompt_text)

    # Intent Handling: Auto-clear queue if intent requests it
    if parsed_intent.intent_type == IntentType.CLEAR_QUEUE:
        logger.info("Auto-clearing queue based on IntentType.CLEAR_QUEUE")
        non_executed = db.query(ActionItem).filter(ActionItem.status.in_(["pending", "approved", "rejected", "failed"])).all()
        for action in non_executed:
            if action.file:
                action.file.status = "indexed"
            db.delete(action)
        db.commit()

    query = db.query(FileRecord).filter(FileRecord.status.in_(["indexed", "categorized", "action_pending"]))
    
    # Check if explicit file_ids were sent
    if req.file_ids:
        query = query.filter(FileRecord.id.in_(req.file_ids))
    elif prompt_text:
        # Smart File Matching: Check if prompt mentions specific file names or file paths
        all_files = db.query(FileRecord).all()
        prompt_lower = prompt_text.lower()
        matched_ids = []
        for file_rec in all_files:
            fn_lower = file_rec.filename.lower()
            fp_lower = file_rec.file_path.lower()
            if (len(fn_lower) > 3 and fn_lower in prompt_lower) or (len(fp_lower) > 5 and fp_lower in prompt_lower):
                matched_ids.append(file_rec.id)

        if matched_ids:
            logger.info("Smart prompt targeting matched %d specific file(s): %s", len(matched_ids), matched_ids)
            query = query.filter(FileRecord.id.in_(matched_ids))
        elif req.limit and req.limit > 0:
            query = query.limit(req.limit)
    elif req.limit and req.limit > 0:
        query = query.limit(req.limit)

    files_to_process = query.all()
    results = []

    for file_record in files_to_process:
        res = await categorize_and_enrich_file(file_record, db, custom_prompt=req.custom_prompt)
        results.append(res)

    return {
        "processed_count": len(results),
        "results": results
    }
