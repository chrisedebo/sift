# Sift Agent Instructions

## Overview
`sift` is an open-source, containerized application designed to index, categorize, enrich via web search, and organize media, software, documents, and archives on NAS drives using local or cloud LLMs.

## Tech Stack & Architecture
- **Backend**: Python 3.11+ (FastAPI, SQLite, AsyncIO, HTTPX)
- **Frontend**: Next.js 14+ (React, Tailwind CSS, Lucide icons)
- **LLM Provider**: OpenAI-compatible REST API client (`/v1/chat/completions`) connecting by default to LM Studio (`http://localhost:1234/v1`)
- **Search Engine**: SearXNG JSON API (`/search?format=json`) with caching
- **Storage Access**: Host-mounted SMB directory (bind-mounted to container)
- **Safety System**: Dry-run preview with explicit user approval queue before file execution
- **License**: MIT License

## Code Style & Conventions
- Use async/await for I/O operations in FastAPI endpoints and external API calls.
- Enforce Pydantic typing for request/response schemas.
- Ensure all file manipulation operations generate a preview action item before execution.
- Maintain dark-mode aesthetic for the frontend UI.
