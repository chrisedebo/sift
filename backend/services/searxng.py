import json
import logging
import time
import httpx
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from config import settings
from db.models import SearxCache

logger = logging.getLogger("sift.searxng")

class SearXNGService:
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or settings.SEARXNG_URL).rstrip("/")

    async def check_health(self) -> Dict[str, Any]:
        """Check if SearXNG instance is online."""
        url = f"{self.base_url}/search?q=test&format=json"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    logger.info("SearXNG health check succeeded | endpoint='%s'", self.base_url)
                    return {
                        "status": "healthy",
                        "endpoint": self.base_url
                    }
                else:
                    logger.warning("SearXNG health check degraded | status_code=%d endpoint='%s'", res.status_code, self.base_url)
                    return {
                        "status": "degraded",
                        "endpoint": self.base_url,
                        "error": f"HTTP {res.status_code}"
                    }
        except Exception as e:
            logger.error("SearXNG connection unreachable | endpoint='%s' error='%s'", self.base_url, str(e))
            return {
                "status": "unreachable",
                "endpoint": self.base_url,
                "error": str(e)
            }

    async def search(self, query: str, db: Optional[Session] = None, max_results: int = 3) -> List[Dict[str, str]]:
        """Perform search on SearXNG with optional DB caching."""
        clean_query = query.strip()
        if not clean_query:
            return []

        # Check DB cache first
        if db:
            cached = db.query(SearxCache).filter(SearxCache.query == clean_query).first()
            if cached:
                try:
                    results = json.loads(cached.results_json)
                    logger.info("SearXNG search cache hit | query='%s' results_count=%d", clean_query, len(results))
                    return results
                except Exception:
                    pass

        start_time = time.time()
        url = f"{self.base_url}/search"
        params = {"q": clean_query, "format": "json"}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, params=params)
                if res.status_code != 200:
                    logger.warning("SearXNG query non-200 response | query='%s' status_code=%d", clean_query, res.status_code)
                    res.raise_for_status()

                data = res.json()
                results = data.get("results", [])

                clean_results = []
                for item in results[:max_results]:
                    clean_results.append({
                        "title": item.get("title", ""),
                        "url": item.get("url", ""),
                        "snippet": item.get("content", item.get("snippet", ""))
                    })

                # Save to cache
                if db and clean_results:
                    try:
                        cache_entry = SearxCache(
                            query=clean_query,
                            results_json=json.dumps(clean_results)
                        )
                        db.add(cache_entry)
                        db.commit()
                    except Exception as e:
                        db.rollback()
                        logger.warning("Failed to cache SearXNG results | query='%s' error='%s'", clean_query, str(e))

                elapsed_ms = int((time.time() - start_time) * 1000)
                logger.info("SearXNG search completed | query='%s' results_count=%d duration_ms=%d", clean_query, len(clean_results), elapsed_ms)
                return clean_results
        except Exception as e:
            logger.error("SearXNG search failed | query='%s' error='%s'", clean_query, str(e))
            return []

searx_client = SearXNGService()
