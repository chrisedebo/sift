from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import ActionItem, FileRecord
from services.file_ops import execute_action, reject_action

router = APIRouter(prefix="/api/queue", tags=["Queue"])

@router.get("/")
def list_queue(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    query = db.query(ActionItem)
    if status:
        query = query.filter(ActionItem.status == status)

    total = query.count()
    items = query.order_by(ActionItem.created_at.desc()).offset(skip).limit(limit).all()

    return {
        "total": total,
        "items": [
            {
                "id": item.id,
                "file_id": item.file_id,
                "filename": item.file.filename if item.file else "",
                "action_type": item.action_type,
                "source_path": item.source_path,
                "target_path": item.target_path,
                "category": item.category,
                "reasoning": item.reasoning,
                "status": item.status,
                "created_at": item.created_at.isoformat() if item.created_at else None,
                "executed_at": item.executed_at.isoformat() if item.executed_at else None
            }
            for item in items
        ]
    }

@router.post("/{action_id}/approve")
def approve_action(action_id: int, db: Session = Depends(get_db)):
    action = db.query(ActionItem).filter(ActionItem.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action item not found.")
    action.status = "approved"
    db.commit()
    return {"id": action_id, "status": "approved"}

@router.post("/{action_id}/reject")
def reject_action_route(action_id: int, db: Session = Depends(get_db)):
    try:
        res = reject_action(action_id, db)
        return res
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{action_id}/execute")
def execute_action_route(action_id: int, db: Session = Depends(get_db)):
    try:
        res = execute_action(action_id, db)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/execute-all-approved")
def execute_all_approved(db: Session = Depends(get_db)):
    approved_items = db.query(ActionItem).filter(ActionItem.status == "approved").all()
    executed = []
    failed = []

    for item in approved_items:
        try:
            res = execute_action(item.id, db)
            executed.append(res)
        except Exception as e:
            failed.append({"action_id": item.id, "error": str(e)})

    return {
        "executed_count": len(executed),
        "failed_count": len(failed),
        "executed": executed,
        "failed": failed
    }

@router.post("/clear")
def clear_queue(status: Optional[str] = None, db: Session = Depends(get_db)):
    """Clears non-executed proposed items from the queue and resets file status."""
    query = db.query(ActionItem)
    if status:
        query = query.filter(ActionItem.status == status)
    else:
        query = query.filter(ActionItem.status.in_(["pending", "approved", "rejected", "failed"]))

    deleted_count = 0
    for action in query.all():
        if action.file:
            action.file.status = "indexed"
        db.delete(action)
        deleted_count += 1

    db.commit()
    return {"status": "cleared", "deleted_count": deleted_count}
