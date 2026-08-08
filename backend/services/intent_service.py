import logging
from enum import Enum
from typing import Dict, Any, Optional

logger = logging.getLogger("sift.intent")

class IntentType(str, Enum):
    CLEAR_QUEUE = "clear_queue"
    SCRIPTLET_EXECUTION = "scriptlet_execution"
    MEDIA_QA = "media_qa"
    FILE_ORGANIZATION = "file_organization"

class ParsedIntent:
    def __init__(self, intent_type: IntentType, raw_message: str, extracted_code: Optional[str] = None):
        self.intent_type = intent_type
        self.raw_message = raw_message
        self.extracted_code = extracted_code

def parse_user_intent(message_text: str) -> ParsedIntent:
    """
    Parses natural language user prompts and classifies them into structured system intents.
    """
    text = (message_text or "").strip()
    text_lower = text.lower()

    # 1. Clear Queue Intent
    clear_keywords = ["clear queue", "clear the queue", "clear approval queue", "reset queue", "clear proposals"]
    if any(kw in text_lower for kw in clear_keywords):
        logger.info("Parsed Intent: CLEAR_QUEUE | text='%s'", text)
        return ParsedIntent(IntentType.CLEAR_QUEUE, raw_message=text)

    # 2. Scriptlet Execution Intent
    if text_lower.startswith("run python") or text_lower.startswith("execute script") or "```python" in text or "```" in text:
        code = text
        if "```python" in text:
            code = text.split("```python")[1].split("```")[0].strip()
        elif "```" in text:
            code = text.split("```")[1].split("```")[0].strip()
        
        logger.info("Parsed Intent: SCRIPTLET_EXECUTION | code_len=%d", len(code))
        return ParsedIntent(IntentType.SCRIPTLET_EXECUTION, raw_message=text, extracted_code=code)

    # 3. Conversational Media & Metadata Q&A Intent
    qa_keywords = ["what", "who", "where", "when", "how", "album", "director", "directed", "wrote", "composer", "metadata", "picture of", "exif", "artist", "tag", "?"]
    is_question = any(kw in text_lower for kw in qa_keywords)
    is_action_request = any(kw in text_lower for kw in ["move all", "organize all", "rename all", "move file"])

    if is_question and not is_action_request:
        logger.info("Parsed Intent: MEDIA_QA | text='%s'", text)
        return ParsedIntent(IntentType.MEDIA_QA, raw_message=text)

    # 4. File Organization / Relocation Intent
    logger.info("Parsed Intent: FILE_ORGANIZATION | text='%s'", text)
    return ParsedIntent(IntentType.FILE_ORGANIZATION, raw_message=text)
