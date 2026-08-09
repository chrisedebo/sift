# Sift 🌟

**Sift** is an open-source, containerized application designed to index, categorize, enrich (via web search), and organize media, software, documents, and archives on NAS drives using local or cloud LLMs.

With a beautiful neon glass-morphism UI, an intelligent dry-run safety engine, and seamless AI integration, Sift makes managing massive amounts of digital assets effortless and safe.

## Features ✨

- **Intelligent File Indexing:** Fast asynchronous scanning of directories to categorize assets (Media, Software, Documents, etc.).
- **Deep Metadata Extraction:** Automatically parses EXIF, ID3, and other rich metadata from your files.
- **AI Chat Assistant:** Ask questions about your files ("What album is this from?", "Who directed this?"). The integrated AI (via OpenAI-compatible endpoints like LM Studio) understands your library.
- **Action Queue & Dry-Run Engine:** Sift proposes actions (like moving or renaming files). These are placed in a queue for your explicit approval before any destructive changes occur on your disk.
- **Modern Neon UI:** Built with Next.js and Tailwind CSS, featuring a futuristic glass-panel aesthetic.
- **Containerized:** Deploys easily with Docker Compose.

## Tech Stack 🛠️

- **Backend:** Python 3.11+, FastAPI, SQLAlchemy (PostgreSQL/SQLite), AsyncIO, HTTPX
- **Frontend:** Next.js 14, React, Tailwind CSS, Lucide Icons
- **AI Provider:** OpenAI-compatible REST API (defaults to LM Studio at `http://localhost:1234/v1`)
- **Search Engine:** SearXNG JSON API for web enrichment

## Getting Started 🚀

### Prerequisites
- Docker and Docker Compose
- Node.js (if running frontend locally outside of Docker)
- Python 3.11+ (if running backend locally)
- A local AI server like LM Studio running on port 1234 (optional, but recommended)

### Quickstart

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/sift.git
   cd sift
   ```

2. **Environment Variables:**
   Copy the example config:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to point to your NAS storage paths and configure your database.

3. **Run with Docker:**
   ```bash
   make run
   ```
   This will build and start the PostgreSQL database, FastAPI backend, and Next.js frontend in the background, and tail the logs.

4. **Access the Application:**
   Open `http://localhost:3000` in your browser.

## Safety First 🛡️

Sift is designed to *never* modify your files without your permission.
Any action suggested by the AI (e.g., renaming a movie or organizing an album) is placed into the **Approval Queue**. You must manually review and approve these scriptlets before Sift executes them on your disk.

## License 📄

This project is licensed under the MIT License - see the LICENSE file for details.
