import os
import json
import logging
import time
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from db.models import FileRecord, ActionItem
from services.llm_provider import llm_client
from services.searxng import searx_client
from services.metadata_extractor import extract_file_metadata

logger = logging.getLogger("sift.categorizer")

CATEGORIZATION_SYSTEM_PROMPT = """You are Sift, an expert digital asset manager and file organizer.
Your goal is to inspect a file's metadata, embedded disk tags (ID3/EXIF), web search context, and user custom instructions to categorize it accurately and propose a clean, structured folder path and filename for organization.

You MUST respond ONLY with a raw valid JSON object (no markdown backticks or commentary) adhering strictly to the following schema:
{
  "category": "Software & Apps" | "Media" | "Documents" | "Archives & Other",
  "summary": "Brief 1-2 sentence description of what this file, track, or software is",
  "tags": ["tag1", "tag2", "tag3"],
  "proposed_folder": "Category/Subcategory",
  "proposed_filename": "clean_standardized_filename.ext",
  "reasoning": "Reason for this organization proposal"
}
"""

def clean_json_response(raw_text: str) -> str:
    """Clean markdown code block wrappers if present in LLM output."""
    text = raw_text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if len(lines) > 2 and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text

async def categorize_and_enrich_file(
    file_record: FileRecord,
    db: Session,
    custom_prompt: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes disk metadata extraction, SearXNG search lookup, and queries LM Studio for file categorization.
    Incorporates user custom directives (e.g. keeping original music in webserver/audio).
    Persists summary & enriched_data in FileRecord and creates a pending ActionItem proposal in SQLite.
    """
    start_time = time.time()
    file_record.status = "analyzing"
    db.commit()

    # Extract or parse disk metadata
    disk_meta = extract_file_metadata(file_record.file_path) or {}
    file_record.enriched_data = json.dumps(disk_meta) if disk_meta else file_record.enriched_data

    # Build search query from filename (strip extensions and special chars)
    filename_clean = file_record.filename.rsplit(".", 1)[0].replace("_", " ").replace("-", " ")
    search_query = f"{filename_clean} software release media"
    
    # Pre-fetch search results from SearXNG
    search_snippets = []
    try:
        search_snippets = await searx_client.search(search_query, db=db, max_results=3)
    except Exception as e:
        logger.warning("SearXNG search skipped during categorization: %s", str(e))
    
    # Format search context
    context_text = ""
    if search_snippets:
        context_text = "\n".join([f"- {s['title']}: {s['snippet']}" for s in search_snippets])
    else:
        context_text = "No web search context available."

    # Format custom user instruction block
    custom_directives_text = ""
    if custom_prompt and custom_prompt.strip():
        custom_directives_text = (
            f"\nUser Custom Directives & Preferences:\n"
            f"- {custom_prompt.strip()}\n"
            f"CRITICAL REQUIREMENT: Strictly follow the user's custom instructions above when deciding the proposed folder, path, and category."
        )

    user_prompt = f"""File Metadata:
- Filename: {file_record.filename}
- Extension: {file_record.extension}
- File Size: {file_record.file_size} bytes
- Current MIME Type: {file_record.mime_type}
- Current Path: {file_record.file_path}

Embedded Disk Metadata (ID3/EXIF):
- Media Tags (Artist, Album, Title, Year): {json.dumps(disk_meta.get('embedded_tags', {}))}
- EXIF Camera Metadata: {json.dumps(disk_meta.get('exif_data', {}))}
- Image Info: {json.dumps(disk_meta.get('image_info', {}))}

Web Search Context (SearXNG):
{context_text}
{custom_directives_text}

Provide categorization and proposed path organization in the required JSON format."""

    messages = [
        {"role": "system", "content": CATEGORIZATION_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt}
    ]

    try:
        raw_response = await llm_client.generate_completion(messages)
        cleaned_json_text = clean_json_response(raw_response)
        parsed_json = json.loads(cleaned_json_text)

        category = parsed_json.get("category", file_record.category or "Archives & Other")
        summary = parsed_json.get("summary", "")
        proposed_folder = parsed_json.get("proposed_folder", category)
        proposed_filename = parsed_json.get("proposed_filename", file_record.filename)
        reasoning = parsed_json.get("reasoning", "Categorized by AI model.")

        # Construct target path on NAS drive
        base_dir = os.path.dirname(file_record.file_path)
        nas_root = base_dir
        if "/mnt/big-storage" in file_record.file_path:
            nas_root = "/mnt/big-storage"

        target_path = os.path.normpath(os.path.join(nas_root, proposed_folder, proposed_filename))

        # Save summary and category to FileRecord
        file_record.category = category
        if summary:
            file_record.summary = summary
        file_record.status = "categorized"

        # Check existing ActionItem proposal
        existing_action = db.query(ActionItem).filter(
            ActionItem.file_id == file_record.id,
            ActionItem.status == "pending"
        ).first()

        if existing_action:
            existing_action.target_path = target_path
            existing_action.category = category
            existing_action.reasoning = reasoning
            action_item = existing_action
        else:
            action_item = ActionItem(
                file_id=file_record.id,
                action_type="organize",
                source_path=file_record.file_path,
                target_path=target_path,
                category=category,
                reasoning=reasoning,
                status="pending"
            )
            db.add(action_item)
            file_record.status = "action_pending"

        db.commit()
        elapsed_ms = int((time.time() - start_time) * 1000)

        logger.info(
            "Categorized file with AI prompt | file_id=%d filename='%s' category='%s' duration_ms=%d",
            file_record.id, file_record.filename, category, elapsed_ms
        )

        return {
            "file_id": file_record.id,
            "filename": file_record.filename,
            "category": category,
            "summary": summary,
            "proposed_target_path": target_path,
            "reasoning": reasoning,
            "action_item_id": action_item.id,
            "disk_metadata": disk_meta
        }

    except Exception as e:
        db.rollback()
        file_record.status = "categorized"
        db.commit()
        logger.error("Failed to categorize file | file_id=%d error='%s'", file_record.id, str(e), exc_info=True)
        raise
