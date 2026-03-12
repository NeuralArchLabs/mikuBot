from selectolax.parser import HTMLParser
from urllib.parse import urlencode
from utils import LANGUAGE_MAP

CATEGORIES = ["videos"]
WEIGHT = 1.3

def request(query, params):
    lang = params.get("language", "es")
    lang_code = LANGUAGE_MAP.get("bing", {}).get(lang, "en-US")
    country = lang_code.split('-')[1].lower() if '-' in lang_code else "us"
    
    # Cookies to force market and avoid redirects
    params["cookies"]["_EDGE_CD"] = f"m={lang_code}&u={lang_code}"
    params["cookies"]["_EDGE_S"] = f"mkt={lang_code}&ui={lang_code}"
    
    query_params = {
        "q": query,
        "qft": "",
        "first": (params.get("pageno", 1) - 1) * 35 + 1,
        "setlang": lang_code,
        "cc": country
    }
    params["url"] = f"https://www.bing.com/videos/search?{urlencode(query_params)}"
    params["headers"]["Accept-Language"] = f"{lang_code},{lang};q=0.9,en;q=0.8"

def response(resp):
    results = []
    tree = HTMLParser(resp.text)
    
    for node in tree.css('div.dg_u'):
        title_node = node.css_first('div.title')
        url_node = node.css_first('a')
        img_node = node.css_first('img')
        
        if title_node and url_node:
            results.append({
                "template": "videos.html",
                "title": title_node.text().strip(),
                "url": "https://www.bing.com" + url_node.attributes.get('href', ''),
                "img_src": img_node.attributes.get('src') if img_node else None,
                "content": "Video de Bing.",
                "source": "bing"
            })
    return results
