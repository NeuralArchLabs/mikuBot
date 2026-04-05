import httpx
import asyncio
from urllib.parse import urlencode

NAME = "wikidata"
CATEGORIES = ['general', 'it_science']
WEIGHT = 1.0

async def request(query, params):
    params["url"] = "internal://wikidata"

async def response(resp):
    results = []
    query = resp.search_params.get("query")
    lang = resp.search_params.get("language", "es")
    headers = {
        "User-Agent": "searXena/1.1 (https://github.com/NeuralArchLabs/searXena) Bot/1.0"
    }
    
    # 1. Buscar la entidad más relevante
    search_params = {
        "action": "wbsearchentities",
        "format": "json",
        "search": query,
        "language": lang,
        "limit": 1
    }
    
    try:
        client = resp.client
        r = await client.get(f"https://www.wikidata.org/w/api.php?{urlencode(search_params)}", headers=headers)
        search_data = r.json()
        search_results = search_data.get("search", [])
        
        if not search_results:
            return []
        
        entity_id = search_results[0].get("id")
        label = search_results[0].get("label", "")
        description = search_results[0].get("description", "")

        # 2. Obtener detalles de la entidad (especialmente imágenes P18)
        detail_params = {
            "action": "wbgetentities",
            "format": "json",
            "ids": entity_id,
            "props": "claims|labels|descriptions",
            "languages": lang
        }
        r_detail = await client.get(f"https://www.wikidata.org/w/api.php?{urlencode(detail_params)}", headers=headers)
        detail_data = r_detail.json()
        entity_info = detail_data.get("entities", {}).get(entity_id, {})
        
        claims = entity_info.get("claims", {})
        img_src = None
        
        # P18 es la propiedad de imagen en Wikidata
        if "P18" in claims:
            img_name = claims["P18"][0].get("mainsnak", {}).get("datavalue", {}).get("value")
            if img_name:
                # Formato para obtener la imagen directa de Wikimedia Commons
                img_src = f"https://commons.wikimedia.org/wiki/Special:FilePath/{img_name.replace(' ', '_')}?width=400"

        # Mejorar descripción si es muy corta
        final_content = description if description else "Información enciclopédica de Wikidata."
        
        results.append({
            "template": "infobox.html",
            "title": label,
            "url": f"https://www.wikidata.org/wiki/{entity_id}",
            "content": final_content,
            "img_src": img_src,
            "source": "wikidata",
            "score": 4.0
        })
            
    except Exception as e:
        print(f"DEBUG Wikidata Error: {e}")
        
    return results
