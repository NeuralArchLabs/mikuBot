import httpx
from utils import fetch_vqd, LANGUAGE_MAP
from urllib.parse import urlencode

CATEGORIES = ["images"]
WEIGHT = 2.0

async def request(query, params):
    # Usar el cliente compartido para obtener el VQD
    client = params['client']
    vqd = await fetch_vqd(query, client)
        
    lang = params.get("language", "es")
    kl = LANGUAGE_MAP.get("duckduckgo", {}).get(lang, "wt-wt")

    if not vqd:
        # Fallback si falla el VQD (usando versión Lite pre-renderizada)
        params["url"] = f"https://duckduckgo.com/html/?q={query}&iax=images&ia=images&kl={kl}"
        return

    # Usar el API JSON de DuckDuckGo para imágenes (mucho más rico)
    query_params = {
        "l": kl,
        "o": "json",
        "q": query,
        "vqd": vqd,
        "f": ",,,",
        "p": 1
    }
    params["url"] = f"https://duckduckgo.com/i.js?{urlencode(query_params)}"
    params["headers"]["Accept-Language"] = f"{lang},en;q=0.8"

def response(resp):
    results = []
    # Si es JSON (API real)
    try:
        data = resp.json()
        for item in data.get("results", []):
            results.append({
                "template": "images.html",
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "img_src": item.get("image", ""),
                "thumbnail_src": item.get("thumbnail", ""),
                "source": "duckduckgo"
            })
        if results: return results
    except Exception:
        pass
        
    # Fallback Scraper (si el API falló)
    from selectolax.parser import HTMLParser
    tree = HTMLParser(resp.text)
    for node in tree.css('div.tile--img'):
        img_node = node.css_first('img.tile--img__img')
        if img_node:
            src = img_node.attributes.get('src')
            if src and not src.startswith('http'): src = "https:" + src
            results.append({
                "template": "images.html",
                "title": img_node.attributes.get('alt', 'Imagen'),
                "url": src,
                "img_src": src,
                "thumbnail_src": src,
                "source": "duckduckgo"
            })
    return results
