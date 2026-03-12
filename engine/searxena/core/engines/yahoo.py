from selectolax.parser import HTMLParser
from urllib.parse import urlencode, unquote
from utils import LANGUAGE_MAP

CATEGORIES = ["general"]
WEIGHT = 1.0

def request(query, params):
    lang = params.get("language", "es")
    lang_code = LANGUAGE_MAP.get("yahoo", {}).get(lang, "en-US")
    
    query_params = {
        "p": query,
        "ei": "UTF-8",
        "b": (params.get("pageno", 1) - 1) * 10 + 1,
        "setlang": lang_code
    }
    params["url"] = f"https://search.yahoo.com/search?{urlencode(query_params)}"
    params["headers"]["Accept-Language"] = f"{lang_code},{lang};q=0.9,en;q=0.8"

def response(resp):
    results = []
    tree = HTMLParser(resp.text)
    
    for node in tree.css('div.dd.algo, .algo-sr, li div.compTitle'):
        title_node = node.css_first('h3 a, a.d-ib')
        snippet_node = node.css_first('div.compText, span.fc-recos, .compText')
        
        if title_node:
            url = title_node.attributes.get('href', '')
            # Yahoo suele usar redirecciones
            if "r.search.yahoo.com" in url:
                try:
                    # Intento de limpieza rapida
                    if '/RU=' in url:
                        url = unquote(url.split('/RU=')[1].split('/RK=')[0])
                except: pass
                
            results.append({
                "title": title_node.text().strip(),
                "url": url,
                "content": snippet_node.text().strip() if snippet_node else "Información de Yahoo Search.",
                "source": "yahoo"
            })
    return results
