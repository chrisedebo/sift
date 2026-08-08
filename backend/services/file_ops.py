import os
import shutil
import logging
from datetime import datetime
from typing import Dict, Any
from sqlalchemy.orm import Session

from db.models import ActionItem, FileRecord

logger = logging.getLogger("sift.file_ops")

def execute_action(action_id: int, db: Session) -> Dict[str, Any]:
    """
    Safely executes an approved file organization proposal on disk.
    Moves/renames source_path -> target_path, ensuring target directory exists.
    """
    action = db.query(ActionItem).filter(ActionItem.id == action_id).first()
    if not action:
        logger.error("Action execution failed | action_id=%d error='Action not found'", action_id)
        raise ValueError(f"Action item ID {action_id} not found.")

    if action.status not in ["pending", "approved"]:
        logger.warning("Action execution skipped | action_id=%d status='%s'", action_id, action.status)
        raise ValueError(f"Action item ID {action_id} is in status '{action.status}' and cannot be executed.")

    source_path = os.path.abspath(action.source_path)
    target_path = os.path.abspath(action.target_path)

    # Path safety check
    if not os.path.exists(source_path):
        action.status = "failed"
        action.reasoning += " | Error: Source file missing on disk."
        db.commit()
        logger.error("Action execution failed | action_id=%d source_missing='%s'", action_id, source_path)
        raise FileNotFoundError(f"Source file missing: {source_path}")

    if source_path == target_path:
        action.status = "executed"
        action.executed_at = datetime.utcnow()
        if action.file:
            action.file.status = "completed"
        db.commit()
        logger.info("Action executed (identical paths) | action_id=%d path='%s'", action_id, source_path)
        return {"action_id": action_id, "status": "executed", "message": "Source and target path identical."}

    try:
        # Ensure target parent directory exists
        target_dir = os.path.dirname(target_path)
        os.makedirs(target_dir, exist_ok=True)

        # Move/Rename file
        shutil.move(source_path, target_path)

        # Update action and file records
        action.status = "executed"
        action.executed_at = datetime.utcnow()

        if action.file:
            action.file.file_path = target_path
            action.file.filename = os.path.basename(target_path)
            action.file.status = "completed"
            action.file.updated_at = datetime.utcnow()

        db.commit()

        logger.info(
            "Executed file action | action_id=%d source='%s' target='%s'",
            action_id, source_path, target_path
        )

        return {
            "action_id": action_id,
            "status": "executed",
            "source_path": source_path,
            "target_path": target_path
        }

    except Exception as e:
        action.status = "failed"
        action.reasoning += f" | Error during move: {str(e)}"
        db.commit()
        logger.error("Failed to execute file move | action_id=%d error='%s'", action_id, str(e), exc_info=True)
        raise RuntimeError(f"Failed to execute action: {str(e)}")

def reject_action(action_id: int, db: Session) -> Dict[str, Any]:
    """Rejects a proposed action item without modifying files on disk."""
    action = db.query(ActionItem).filter(ActionItem.id == action_id).first()
    if not action:
        logger.error("Action rejection failed | action_id=%d error='Action not found'", action_id)
        raise ValueError(f"Action item ID {action_id} not found.")

    action.status = "rejected"
    if action.file:
        action.file.status = "categorized"

    db.commit()
    logger.info("Rejected action proposal | action_id=%d file_id=%d", action_id, action.file_id)

    return {
        "action_id": action_id,
        "status": "rejected"
    }
