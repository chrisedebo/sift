import os
import json
import base64
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from db.models import FileRecord, ActionItem
from services.llm_provider import llm_client
from services.searxng import searx_client
from services.metadata_extractor import extract_file_metadata
from services.tools import tool_search_files, SearchFilesInput, FileCategoryEnum
from constants import COMMON_SEARCHABLE_EXTS

logger = logging.getLogger("sift.assistant")

ASSISTANT_SYSTEM_PROMPT = """You are Sift, an intelligent AI File Manager & Digital Asset Assistant.
Your job is to answer user questions about files, media, software, and documents on their NAS drive.

You have access to:
1. Exact indexed database records from the SQLite database (filtering by file extension, size, category, status).
2. Embedded metadata extracted directly from disk files (ID3 tags, EXIF camera metadata, dimensions, duration, bitrate).
3. Vision capabilities: When an image file is attached to the query payload, inspect visual features, objects, text, and scene details.
4. Web search context from SearXNG (for identifying albums, music composers, film directors, release dates, software history).

CRITICAL SYSTEM CONSTRAINTS:
- Do NOT claim, promise, or pretend to launch background re-scans, background processes, or worker threads in the future.
- If a user asks to scan or organize files, answer using the available Database Query Results directly and inform them they can click 'Scan' or 'Execute All Approved' in the UI.
- Note that 'action_pending' status means an organizational dry-run proposal is staged in the Approval Queue waiting for user approval.

Your goals:
- Summarize matching files from Database Query Results accurately in markdown tables/lists.
- When an image is provided, describe visual content and EXIF metadata accurately.
- Maintain full multi-turn conversational context from previous chat messages.
- Use clean markdown formatting, bullet points, and concise explanations.
- Be helpful, clear, and friendly.
"""

def encode_image_base64(filepath: str, max_size_mb: int = 5) -> Optional[str]:
    """Encodes image file to base64 data string if under max_size_mb."""
    try:
        if not os.path.exists(filepath):
            return None
        size_mb = os.path.getsize(filepath) / (1024 * 1024)
        if size_mb > max_size_mb:
            logger.info("Skipping base64 encoding for image > %dMB: %s", max_size_mb, filepath)
            return None

        with open(filepath, "rb") as image_file:
            encoded_bytes = base64.b64encode(image_file.read()).decode("utf-8")
            return encoded_bytes
    except Exception as e:
        logger.warning("Failed to encode image to base64 | path='%s' error='%s'", filepath, str(e))
        return None

async def answer_assistant_query(
    user_query: str,
    db: Session,
    target_file_ids: Optional[List[int]] = None,
    history: Optional[List[Dict[str, str]]] = None
) -> Dict[str, Any]:
    """
    Answers user conversational Q&A queries about files, media, directors, albums, images, and metadata.
    Supports vision model base64 image encoding.
    """
    query_text = (user_query or "").strip()
    query_lower = query_text.lower()
    
    # 1. Dynamic Database Tool Search (Extension, Category, or List/Scan Query)
    ext_matched = None
    for ext in COMMON_SEARCHABLE_EXTS:
        tokens = query_lower.replace("?", " ").replace(".", " ").split()
        ext_clean = ext.lstrip(".")
        if ext in query_lower or ext_clean in tokens:
            ext_matched = ext
            break

    cat_matched = None
    if any(w in query_lower for w in ["media", "music", "audio", "song", "track"]):
        cat_matched = FileCategoryEnum.MEDIA
    elif any(w in query_lower for w in ["software", "installer", "app"]):
        cat_matched = FileCategoryEnum.SOFTWARE
    elif any(w in query_lower for w in ["document", "pdf"]):
        cat_matched = FileCategoryEnum.DOCUMENTS

    is_database_query = ext_matched is not None or cat_matched is not None or any(w in query_lower for w in ["list", "find", "show", "search", "scan", "have", "database", "files", "how many"])

    db_search_results = None
    db_tools_formatted = "No active database filter."
    if is_database_query:
        search_args = SearchFilesInput(
            category=cat_matched,
            extension=ext_matched,
            limit=50
        )
        db_search_results = tool_search_files(db, search_args)
        logger.info("Executed tool_search_files for query | extension='%s' category='%s' found_count=%d", 
                    ext_matched, cat_matched, db_search_results.get("count", 0))

        if db_search_results and db_search_results.get("count", 0) > 0:
            file_list = db_search_results["files"]
            lines = [f"Database Search Tool found {len(file_list)} matching file(s):"]
            for f in file_list:
                lines.append(f"- ID {f['id']}: **{f['filename']}** (Path: `{f['file_path']}`, Size: {f['file_size']} bytes, Category: {f['category']}, Status: {f['status']})")
            db_tools_formatted = "\n".join(lines)
        else:
            db_tools_formatted = f"Database Search Tool found 0 files matching extension '{ext_matched or 'any'}' and category '{cat_matched or 'any'}'."

    # 2. Identify target files in database
    target_files: List[FileRecord] = []
    if target_file_ids:
        target_files = db.query(FileRecord).filter(FileRecord.id.in_(target_file_ids)).all()
    else:
        all_files = db.query(FileRecord).all()
        for f in all_files:
            fn_lower = f.filename.lower()
            fp_lower = f.file_path.lower()
            if (len(fn_lower) > 3 and fn_lower in query_lower) or (len(fp_lower) > 5 and fp_lower in query_lower):
                target_files.append(f)

    # 3. Extract embedded disk metadata & encode images for Vision model
    files_context_blocks = []
    search_queries_to_run = []
    base64_images = []

    for file_rec in target_files:
        disk_meta = extract_file_metadata(file_rec.file_path)
        
        file_block = f"""--- TARGET FILE: {file_rec.filename} ---
Path: {file_rec.file_path}
Category: {file_rec.category or 'Unknown'}
File Size: {file_rec.file_size} bytes
Status: {file_rec.status}
Embedded ID3/Media Tags: {json.dumps(disk_meta.get('embedded_tags', {}))}
EXIF Data: {json.dumps(disk_meta.get('exif_data', {}))}
Image Info: {json.dumps(disk_meta.get('image_info', {}))}"""
        files_context_blocks.append(file_block)

        # Check if file is an image to attach base64 for Vision Model
        ext_lower = file_rec.extension.lower()
        if ext_lower in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
            b64_str = encode_image_base64(file_rec.file_path)
            if b64_str:
                mime = "image/png" if ext_lower == ".png" else "image/jpeg"
                base64_images.append((mime, b64_str))

        # Build SearXNG queries based on user question intent
        clean_fn = file_rec.filename.rsplit(".", 1)[0].replace("_", " ").replace("-", " ")
        if any(w in query_lower for w in ["album", "song", "track", "music", "artist", "wrote", "composer"]):
            search_queries_to_run.append(f"{clean_fn} album artist track music")
        elif any(w in query_lower for w in ["director", "directed", "film", "movie", "cast"]):
            search_queries_to_run.append(f"{clean_fn} film director movie release")
        elif any(w in query_lower for w in ["software", "version", "installer", "app"]):
            search_queries_to_run.append(f"{clean_fn} software release history")

    # 4. SearXNG Search Lookup with Exception Guard
    search_results_snippets = []
    for sq in search_queries_to_run[:2]:
        try:
            snippets = await searx_client.search(sq, db=db, max_results=3)
            for s in snippets:
                search_results_snippets.append(f"- {s['title']}: {s['snippet']}")
        except Exception as e:
            logger.warning("SearXNG search error during assistant Q&A: %s", str(e))

    web_context_text = "\n".join(search_results_snippets) if search_results_snippets else "No web search context available."
    files_context_text = "\n\n".join(files_context_blocks) if files_context_blocks else "No specific target file metadata attached."

    # Build clean, high-signal LLM prompt payload
    llm_user_text_prompt = f"""User Question: "{query_text}"

Database Search Results:
{db_tools_formatted}

Target File Disk Metadata:
{files_context_text}

Web Search Context (SearXNG):
{web_context_text}

Answer the user's question directly and conversationally using the Database Search Results and Metadata above."""

    messages: List[Dict[str, Any]] = [{"role": "system", "content": ASSISTANT_SYSTEM_PROMPT}]

    # Include multi-turn conversation history (last 8 turns)
    if history:
        for turn in history[-8:]:
            role = turn.get("role")
            content = turn.get("content")
            if role in ["user", "assistant"] and content:
                messages.append({"role": role, "content": content})

    # Construct user message (Multimodal if images exist)
    if base64_images:
        user_content_list: List[Dict[str, Any]] = [{"type": "text", "text": llm_user_text_prompt}]
        for mime, b64_str in base64_images:
            user_content_list.append({
                "type": "image_url",
                "image_url": {"url": f"data:{mime};base64,{b64_str}"}
            })
        messages.append({"role": "user", "content": user_content_list})
        logger.info("Attached %d image(s) to multimodal Vision model payload.", len(base64_images))
    else:
        messages.append({"role": "user", "content": llm_user_text_prompt})

    try:
        answer_text = await llm_client.generate_completion(messages)
        return {
            "answer": answer_text,
            "target_files_count": len(target_files),
            "target_files": [f.filename for f in target_files],
            "status": "success"
        }
    except Exception as e:
        logger.error("Error generating assistant answer | error='%s'", str(e), exc_info=True)
        return {
            "answer": f"I encountered an error looking up that answer: {str(e)}",
            "status": "error"
        }
