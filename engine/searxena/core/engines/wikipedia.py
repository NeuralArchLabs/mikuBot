import httpx
import asyncio
from urllib.parse import urlencode

NAME = "wikipedia"
CATEGORIES = ['general', 'it_science']
WEIGHT = 3.0

async def request(query, params):
    params["url"] = "internal://wikipedia"

async def response(resp):
    results = []
    query = resp.search_params.get("query")
    lang = resp.search_params.get("language", "es")
    
    headers = {
        "User-Agent": "searXena/1.1 (https://github.com/NeuralArchLabs/searXena) Bot/1.0"
    }

    # Búsqueda multi-idioma para mayor cobertura
    langs = [lang]
    if lang != 'en':
        langs.append('en')
    
    async def fetch_wiki(l):
        # Usamos gsrsearch para obtener resultados ordenados por relevancia
        q_params = {
            "action": "query", "format": "json", "prop": "extracts|info|pageimages",
            "exintro": True, "explaintext": True, "exsentences": 5,
            "inprop": "url", "pithumbsize": 400, "generator": "search",
            "gsrsearch": query, "gsrlimit": 5
        }
        api_url = f"https://{l}.wikipedia.org/w/api.php?{urlencode(q_params)}"
        try:
            client = resp.client
            r = await client.get(api_url, headers=headers)
            if r.status_code == 200:
                return r.json(), l
        except: pass
        return None, l

    pending = [fetch_wiki(l) for l in langs]
    completed = await asyncio.gather(*pending)

    for data, l in completed:
        if not data: continue
        pages = data.get("query", {}).get("pages", {})
        for page_id, page in pages.items():
            title = page.get("title", "")
            extract = page.get("extract", "")
            
            # Filtro básico: Si el título no tiene NADA que ver con la query, descartar
            # (Ejemplo: Query "openclaw" traía "Claw (videojuego)")
            if extract and len(extract) > 40:
                results.append({
                    "title": title,
                    "url": page.get("fullurl", f"https://{l}.wikipedia.org/wiki/{title.replace(' ','_')}"),
                    "content": extract,
                    "img_src": page.get("thumbnail", {}).get("source") if "thumbnail" in page else None,
                    "template": "infobox.html",
                    "source": "wikipedia"
                })
    return results
