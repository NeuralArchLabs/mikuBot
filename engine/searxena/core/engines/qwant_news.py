import json
from urllib.parse import urlencode
from utils import LANGUAGE_MAP

CATEGORIES = ["news"]
WEIGHT = 1.0

def request(query, params):
    lang = params.get("language", "es")
    lang_code = LANGUAGE_MAP.get("qwant", {}).get(lang, lang)
    
    query_params = {
        "q": query,
        "count": 15,
        "offset": (params.get("pageno", 1) - 1) * 15,
        "locale": f"{lang_code}_{lang_code.upper()}"
    }
    
    params["url"] = f"https://api.qwant.com/v3/search/news?{urlencode(query_params)}"
    params["headers"]["Accept"] = "application/json"
    params["headers"]["Accept-Encoding"] = "gzip, deflate"

def response(resp):
    results = []
    try:
        data = resp.json()
        if "data" in data and "result" in data["data"]:
            for item in data["data"]["result"].get("items", []):
                title = item.get("title", "")
                url = item.get("url", "")
                
                # Format time and source
                source = item.get("domain", "Noticia")
                desc = item.get("desc", "")
                
                results.append({
                    "title": title,
                    "url": url,
                    "content": f"{source}: {desc}",
                    "source": "qwant_news"
                })
    except Exception:
        pass
    
    return results
