import httpx
from utils import fetch_vqd, LANGUAGE_MAP
from urllib.parse import urlencode

CATEGORIES = ["news"]
WEIGHT = 1.5

async def request(query, params):
    client = params['client']
    vqd = await fetch_vqd(query, client)
        
    if not vqd: return

    lang = params.get("language", "es")
    kl = LANGUAGE_MAP.get("duckduckgo", {}).get(lang, "wt-wt")

    query_params = {
        "l": kl,
        "o": "json",
        "q": query,
        "vqd": vqd,
        "p": 1
    }
    params["url"] = f"https://duckduckgo.com/news.js?{urlencode(query_params)}"
    params["headers"]["Accept-Language"] = f"{lang},en;q=0.8"

def response(resp):
    results = []
    try:
        data = resp.json()
        for item in data.get("results", []):
            # Limpiar fecha si es un timestamp basico
            date_val = str(item.get('date', ''))
            if date_val.isdigit() and len(date_val) > 8:
                import time
                try:
                    ts = int(date_val)
                    diff = int(time.time()) - ts
                    if diff < 3600: date_val = f"Hace {diff//60} min"
                    elif diff < 86400: date_val = f"Hace {diff//3600} h"
                    else: date_val = f"Hace {diff//86400} d"
                except: pass

            results.append({
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "content": f"{item.get('source', 'Noticia')} - {date_val}: {item.get('excerpt', '')}",
                "source": "duckduckgo_news",
                "img_src": item.get("image", "")
            })
    except Exception:
        pass
    return results
