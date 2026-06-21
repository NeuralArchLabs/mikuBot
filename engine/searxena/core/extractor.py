"""
OZEN Extractor — Wrapper de extracción para searXena.

Delega toda la lógica de extracción al O-ZEN Engine (core/ozen_engine/).
Las mejoras de extracción viven dentro de O-ZEN, no aquí.
"""
import os
import sys
import time
import logging
from typing import Optional, Dict, Any

try:
    from .ozen_engine import extract_url
except ImportError:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from ozen_engine import extract_url

import httpx
from utils import gen_useragent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("O-ZEN")


class OZENExtractor:
    """Wrapper delgado de extracción. Toda la lógica vive en O-ZEN Engine."""

    def __init__(self, timeout: float = 20.0, cache_ttl: int = 600):
        self.timeout = timeout
        self.cache_ttl = cache_ttl
        self._cache = {}
        self.client = httpx.AsyncClient(
            headers={
                "User-Agent": gen_useragent(),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3",
            },
            follow_redirects=True, timeout=timeout, http2=True, verify=False
        )

    async def extract(self, url: str) -> Dict[str, Any]:
        now = time.time()

        # 1. Check cache
        if url in self._cache:
            data, expiry = self._cache[url]
            if now < expiry:
                return data
            del self._cache[url]

        # 2. Delegate entire extraction pipeline to O-ZEN Engine
        result = await extract_url(url, self.client, self.timeout)

        # 3. Store result in cache if it's successful or has status markers
        if result and ("error" not in result or result.get("status") in ("success", "success (baseline)", "success (liveblog jsonld)", "success (reddit old)", "success (youtube oembed)", "success (msn api)")):
            self._cache[url] = (result, now + self.cache_ttl)
            self._prune_cache()

        return result

    def _prune_cache(self):
        if len(self._cache) < 200:
            return
        now = time.time()
        self._cache = {k: v for k, v in self._cache.items() if now < v[1]}
        if len(self._cache) > 300:
            keys = list(self._cache.keys())
            for k in keys[:100]:
                del self._cache[k]

    async def close(self):
        await self.client.aclose()