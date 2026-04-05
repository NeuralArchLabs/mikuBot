from selectolax.parser import HTMLParser
from urllib.parse import urlencode
from utils import LANGUAGE_MAP

CATEGORIES = ["images"]
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
        "first": (params.get("pageno", 1) - 1) * 35 + 1,
        "scenario": "ImageBasicHover",
        "datsrc": "I",
        "setlang": lang_code,
        "cc": country
    }
    params["url"] = f"https://www.bing.com/images/search?{urlencode(query_params)}"
    params["headers"]["Accept-Language"] = f"{lang_code},{lang};q=0.9,en;q=0.8"

def response(resp):
    results = []
    tree = HTMLParser(resp.text)
    
    for node in tree.css('div.imgpt'):
        img_node = node.css_first('img.mimg')
        url_node = node.css_first('a.iusc')
        
        if img_node:
            src = img_node.attributes.get('src')
            if src and not src.startswith('http'): src = "https://www.bing.com" + src
            
            results.append({
                "template": "images.html",
                "title": img_node.attributes.get('alt', 'Bing Image'),
                "url": url_node.attributes.get('href', src) if url_node else src,
                "img_src": src,
                "thumbnail_src": src,
                "source": "bing"
            })
    return results
