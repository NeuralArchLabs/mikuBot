from selectolax.parser import HTMLParser
from urllib.parse import urlencode
from utils import LANGUAGE_MAP

CATEGORIES = ["images"]
WEIGHT = 1.0

def request(query, params):
    lang = params.get("language", "es")
    sp_lang = LANGUAGE_MAP.get("startpage", {}).get(lang, "english")
    
    query_params = {
        "query": query,
        "cat": "pics",
        "cmd": "process_search",
        "language": sp_lang,
        "engine0": "v1all",
        "t": "device",
        "abp": "-1",
        "pg": params.get("pageno", 1),
    }
    params["url"] = "https://www.startpage.com/sp/search"
    params["method"] = "POST"
    params["data"] = query_params
    params["headers"]["Referer"] = "https://www.startpage.com/"
    params["headers"]["Origin"] = "https://www.startpage.com"
    params["headers"]["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    params["headers"]["Accept-Encoding"] = "gzip, deflate"
    params["cookies"]["preferences"] = "language_ui=english&search_engine=google&results_per_page=20"
    params["cookies"]["post_parameters"] = "1"

def response(resp):
    results = []
    tree = HTMLParser(resp.text)

    # Startpage Images
    for node in tree.css('div.image-container, .image, .result-image'):
        img_node = node.css_first('img')
        link_node = node.css_first('a')
        
        if img_node and link_node:
            url = link_node.attributes.get('href', '')
            src = img_node.attributes.get('src') or img_node.attributes.get('data-src')
            
            if url and src:
                results.append({
                    "template": "images.html",
                    "title": img_node.attributes.get('alt', 'Startpage Image'),
                    "url": url,
                    "img_src": src,
                    "thumbnail_src": src,
                    "source": "startpage_images"
                })
    return results
