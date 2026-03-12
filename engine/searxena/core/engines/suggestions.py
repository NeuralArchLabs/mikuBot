import httpx
import json
import asyncio
from typing import List

# Cache simple en memoria
suggestion_cache = {}
# Timeout ultra corto para sugerencias (SearXNG style)
client = httpx.AsyncClient(http2=True, timeout=1.5)

async def get_suggestions(query: str) -> List[str]:
    if not query or len(query) < 2:
        return []
        
    # Soporte para Bangs (Sugerir atajos)
    if query.startswith("!"):
        bangs = {
            "!g": "Google", "!w": "Wikipedia", "!yt": "YouTube", 
            "!gh": "GitHub", "!so": "StackOverflow", "!i": "Imágenes",
            "!n": "Noticias", "!v": "Videos", "!red": "Reddit",
            "!py": "Python", "!npm": "NPM", "!wa": "WolframAlpha"
        }
        matches = [f"{b} ({name})" for b, name in bangs.items() if b.startswith(query.lower())]
        if matches: return matches[:8]

    if query in suggestion_cache:
        return suggestion_cache[query]
        
    # Consultar fuentes rápidas en paralelo (Google y DDG son las más veloces)
    tasks = [
        _fetch_google(query),
        _fetch_duckduckgo(query)
    ]
    
    try:
        results = await asyncio.gather(*tasks, return_exceptions=True)
    except Exception:
        results = []
    
    # Combinar y desduplicar
    all_suggestions = []
    for res in results:
        if isinstance(res, list):
            all_suggestions.extend(res)
            
    # Mantener orden de relevancia y eliminar duplicados
    seen = set()
    unique_suggestions = []
    for s in all_suggestions:
        s_low = s.lower().strip()
        if s_low not in seen:
            seen.add(s_low)
            unique_suggestions.append(s)
            
    # Limitar a 8 para no saturar la UI
    final = unique_suggestions[:8]
    suggestion_cache[query] = final
    return final

async def _fetch_google(q: str):
    try:
        url = f"https://suggestqueries.google.com/complete/search?client=firefox&q={q}"
        resp = await client.get(url)
        return resp.json()[1]
    except: return []

async def _fetch_duckduckgo(q: str):
    try:
        # DDG es extremadamente rápido y privado
        url = f"https://duckduckgo.com/ac/?q={q}&type=list"
        resp = await client.get(url)
        return resp.json()[1]
    except: return []
