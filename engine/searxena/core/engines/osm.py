import httpx
import asyncio
from urllib.parse import urlencode

NAME = "osm"
CATEGORIES = ['maps']
WEIGHT = 3.0
ENABLED = True

async def request(query, params):
    """
    Indica que el motor OSM se manejará internamente en la fase de respuesta.
    """
    params["url"] = "internal://osm"

async def response(resp):
    """
    Realiza la búsqueda de geocodificación usando Nominatim (OpenStreetMap).
    """
    results = []
    query = resp.search_params.get("query")
    
    if not query or len(query) < 3:
        return []

    headers = {
        "User-Agent": "searXena/1.0 (https://github.com/NeuralArchLabs/searXena) Bot/1.0"
    }

    # Parámetros para Nominatim
    search_params = {
        "q": query,
        "format": "json",
        "limit": 5,
        "addressdetails": 1,
        "accept-language": resp.search_params.get("language", "es")
    }

    api_url = f"https://nominatim.openstreetmap.org/search?{urlencode(search_params)}"

    try:
        # Nominatim requiere un User-Agent claro para no bloquear
        client = resp.client
        r = await client.get(api_url, headers=headers)
        
        if r.status_code == 200:
                data = r.json()
                if data and isinstance(data, list):
                    for item in data:
                        # Solo nos interesa si tiene una importancia mínima (evitar ruido)
                        importance = float(item.get("importance", 0))
                        
                        # Si no es un resultado muy exacto, tal vez no valga la pena como infobox
                        # pero permitimos si el usuario fue específico
                        if importance < 0.2 and len(query.split()) < 2:
                            continue

                        lat = float(item["lat"])
                        lon = float(item["lon"])
                        display_name = item["display_name"]
                        
                        # Bounding Box para el iframe de OSM
                        # Nominatim retorna [min_lat, max_lat, min_lon, max_lon]
                        bbox = item.get("boundingbox", [])
                        if len(bbox) == 4:
                            # OSM embed usa: bbox=min_lon,min_lat,max_lon,max_lat
                            osm_bbox = f"{bbox[2]},{bbox[0]},{bbox[3]},{bbox[1]}"
                        else:
                            # Fallback simple (aproximadamente 1km)
                            osm_bbox = f"{lon-0.01},{lat-0.01},{lon+0.01},{lat+0.01}"
                        
                        map_url = f"https://www.openstreetmap.org/export/embed.html?bbox={osm_bbox}&layer=mapnik&marker={lat},{lon}"
                        
                        # Tipo de lugar para el subtítulo
                        place_type = item.get("type", "").replace("_", " ").capitalize()
                        category = item.get("category", "").capitalize()
                        
                        content = f"{place_type} ({category}) en {display_name}"

                        results.append({
                            "title": display_name,
                            "url": f"https://www.openstreetmap.org/search?query={urlencode({'query': display_name})}",
                            "content": content,
                            "map_embed_url": map_url,
                            "is_map": True,
                            "template": "infobox.html",
                            "source": "osm",
                            "score": 5.0 + importance  # Puntuación alta + importancia para ordenar
                        })
    except Exception as e:
        print(f"DEBUG OSM Error: {e}")
        
    return results
