import json
import logging
import time
import httpx
from typing import Dict, Any, List, Optional
from config import settings

logger = logging.getLogger("sift.llm")

class LLMProvider:
    def __init__(self, base_url: Optional[str] = None, api_key: Optional[str] = None, model: Optional[str] = None):
        self.base_url = (base_url or settings.LM_STUDIO_URL).rstrip("/")
        self.api_key = api_key or settings.LM_STUDIO_API_KEY
        self.model = model or settings.LM_STUDIO_MODEL

    async def check_health(self) -> Dict[str, Any]:
        """Check if LM Studio / OpenAI endpoint is reachable and list models."""
        url = f"{self.base_url}/models"
        headers = {}
        if self.api_key and self.api_key != "lm-studio":
            headers["Authorization"] = f"Bearer {self.api_key}"

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    models = [m.get("id") for m in data.get("data", [])]
                    logger.info("LM Studio health check succeeded | endpoint='%s' models_count=%d", self.base_url, len(models))
                    return {
                        "status": "healthy",
                        "provider": "LM Studio / OpenAI API",
                        "endpoint": self.base_url,
                        "available_models": models
                    }
                else:
                    logger.warning("LM Studio health check degraded | status_code=%d endpoint='%s'", res.status_code, self.base_url)
                    return {
                        "status": "degraded",
                        "endpoint": self.base_url,
                        "error": f"HTTP {res.status_code}: {res.text}"
                    }
        except Exception as e:
            logger.error("LM Studio connection unreachable | endpoint='%s' error='%s'", self.base_url, str(e))
            return {
                "status": "unreachable",
                "endpoint": self.base_url,
                "error": str(e)
            }

    async def generate_completion(self, messages: List[Dict[str, Any]], temperature: float = 0.2) -> str:
        """Send completion request to OpenAI-compatible endpoint supporting text and vision image inputs."""
        start_time = time.time()
        url = f"{self.base_url}/chat/completions"
        headers = {"Content-Type": "application/json"}
        if self.api_key and self.api_key != "lm-studio":
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature
        }

        # DEBUG Logging: Prompt structure & LLM messages
        logger.debug("--- [LLM REQUEST START] --- | model='%s' messages_count=%d timeout=%.1fs", self.model, len(messages), settings.LM_TIMEOUT)
        for idx, msg in enumerate(messages):
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            if isinstance(content, list):
                logger.debug("[PROMPT MSG #%d (%s) MULTIMODAL]: %d parts", idx + 1, role.upper(), len(content))
            else:
                logger.debug("[PROMPT MSG #%d (%s)]:\n%s", idx + 1, role.upper(), content)
        logger.debug("--- [LLM REQUEST PAYLOAD SENT] ---")

        try:
            async with httpx.AsyncClient(timeout=settings.LM_TIMEOUT) as client:
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code != 200:
                    logger.error("LLM completion request failed | status_code=%d response='%s'", res.status_code, res.text)
                    res.raise_for_status()

                data = res.json()
                choices = data.get("choices", [])
                if not choices:
                    logger.error("Empty choices returned from LLM completion | model='%s'", self.model)
                    raise ValueError("No choices returned from LLM completion.")

                elapsed_ms = int((time.time() - start_time) * 1000)
                content = choices[0].get("message", {}).get("content", "")
                
                # DEBUG Logging: Raw response content
                logger.debug("--- [LLM RESPONSE RAW] --- | duration_ms=%d chars=%d:\n%s\n--- [LLM RESPONSE END] ---", elapsed_ms, len(content), content)
                logger.info("LLM completion generated | model='%s' duration_ms=%d chars=%d", self.model, elapsed_ms, len(content))
                return content
        except httpx.ReadTimeout:
            elapsed_ms = int((time.time() - start_time) * 1000)
            logger.error("LLM completion timed out after %d ms | timeout_setting=%.1fs model='%s'", elapsed_ms, settings.LM_TIMEOUT, self.model)
            raise TimeoutError(f"LM Studio local model generation timed out after {int(settings.LM_TIMEOUT)}s. Please try again or simplify your query.")
        except Exception as e:
            elapsed_ms = int((time.time() - start_time) * 1000)
            logger.error("LLM completion exception after %d ms | error='%s'", elapsed_ms, str(e), exc_info=True)
            raise

llm_client = LLMProvider()
