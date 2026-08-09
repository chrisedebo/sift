from typing import List, Optional, Dict
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from db.database import get_db
from services.assistant import answer_assistant_query
from services.scriptlet_engine import execute_python_scriptlet
from services.categorizer import categorize_and_enrich_file
from services.intent_service import parse_user_intent, IntentType
from db.models import FileRecord, ActionItem

logger = logging.getLogger("sift.assistant_router")

router = APIRouter(prefix="/api/assistant", tags=["Assistant"])

class ChatHistoryItem(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    file_ids: Optional[List[int]] = None
    history: Optional[List[ChatHistoryItem]] = None

class ScriptletRequest(BaseModel):
    code: str
    timeout_seconds: Optional[int] = 15

@router.post("/chat")
async def assistant_chat(req: ChatRequest, db: Session = Depends(get_db)):
    """
    Unified Conversational Assistant endpoint using IntentService to route requests.
    Supports multi-turn conversation history.
    """
    message_text = req.message.strip()
    parsed = parse_user_intent(message_text)

    # Format history as dict list
    history_dicts = [{"role": h.role, "content": h.content} for h in req.history] if req.history else None

    logger.info("Incoming Assistant Chat Request | intent=%s message='%s' history_len=%d", 
                parsed.intent_type, message_text, len(history_dicts) if history_dicts else 0)

    # 1. Scriptlet Execution Intent
    if parsed.intent_type == IntentType.SCRIPTLET_EXECUTION:
        code_to_run = parsed.extracted_code or message_text
        exec_res = execute_python_scriptlet(code_to_run)
        
        if exec_res["status"] == "success":
            reply = f"**Python Scriptlet Executed Successfully**\n\n```text\n{exec_res['stdout'] or '(No output)'}\n```"
        else:
            reply = f"**Scriptlet Execution Warning / Error** (Exit code: {exec_res['exit_code']})\n\n```text\n{exec_res['stderr'] or exec_res['stdout']}\n```"
        
        return {
            "type": "scriptlet",
            "reply": reply,
            "exec_details": exec_res
        }

    # 2. Conversational Media & Metadata Q&A Intent
    if parsed.intent_type == IntentType.MEDIA_QA:
        res = await answer_assistant_query(message_text, db, req.file_ids, history=history_dicts)
        return {
            "type": "qa",
            "reply": res["answer"],
            "target_files": res.get("target_files", [])
        }

    # 3. Execute Queue Intent (Autonomous Agent Approval & Execution)
    if parsed.intent_type == IntentType.EXECUTE_QUEUE:
        pending = db.query(ActionItem).filter(ActionItem.status == "pending").all()
        for item in pending:
            item.status = "approved"
        db.commit()

        approved = db.query(ActionItem).filter(ActionItem.status == "approved").all()
        executed_count = 0
        from services.file_ops import execute_action
        for item in approved:
            try:
                execute_action(item.id, db)
                executed_count += 1
            except Exception as e:
                logger.error(f"Failed to execute action {item.id}: {e}")
                
        reply = f"**Agent Execution Complete:** Auto-approved and executed {executed_count} actions successfully. The NAS is organized."
        return {
            "type": "qa",
            "reply": reply
        }

    # 4. File Organization / Relocation Action Intent
    query = db.query(FileRecord).filter(FileRecord.status.in_(["indexed", "categorized", "action_pending"]))
    if req.file_ids:
        query = query.filter(FileRecord.id.in_(req.file_ids))
    else:
        all_files = db.query(FileRecord).all()
        msg_lower = message_text.lower()
        matched = [f for f in all_files if (len(f.filename) > 3 and f.filename.lower() in msg_lower)]
        if matched:
            query = query.filter(FileRecord.id.in_([m.id for m in matched]))

    files_to_process = query.all()
    results = []
    for f in files_to_process[:50]:
        r = await categorize_and_enrich_file(f, db, custom_prompt=message_text)
        results.append(r)

    reply = f"Processed {len(results)} file proposal(s) with custom directive. Check the Approval Queue!"
    return {
        "type": "action",
        "reply": reply,
        "processed_count": len(results)
    }

@router.post("/execute-scriptlet")
def execute_scriptlet_endpoint(req: ScriptletRequest):
    """Direct endpoint for running a Python scriptlet in the container."""
    return execute_python_scriptlet(req.code, timeout_seconds=req.timeout_seconds or 15)
