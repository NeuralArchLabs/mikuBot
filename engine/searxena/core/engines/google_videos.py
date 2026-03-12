from selectolax.parser import HTMLParser
from urllib.parse import urlencode, unquote
from utils import LANGUAGE_MAP

CATEGORIES = ["videos"]
WEIGHT = 2.0

def request(query, params):
    start = (params.get("pageno", 1) - 1) * 10
    lang = params.get("language", "es")
    lang_code = LANGUAGE_MAP.get("google", {}).get(lang, "es")
    country = lang_code.upper() if len(lang_code) == 2 else "US"
    
    query_params = {
        "q": query,
        "tbm": "vid",
        "start": start,
        "hl": lang_code,
        "gl": country
    }
    params["url"] = f"https://www.google.com/search?{urlencode(query_params)}"
    
    import random
    cb_val = random.randint(20230000, 20249999)
    params["cookies"]["CONSENT"] = f"YES+cb.{cb_val}-04-p0.{lang}+FX+414"

def response(resp):
    results = []
    tree = HTMLParser(resp.text)
    
    # En Google Videos, los resultados suelen estar en bloques div.g
    for node in tree.css('div.MjjYud, div.g'):
        title_node = node.css_first('h3')
        url_node = node.css_first('a')
        img_node = node.css_first('img')
        snippet_node = node.css_first('div.VwiC3b')
        
        if title_node and url_node:
            url = url_node.attributes.get('href', '')
            if url.startswith('/url?q='):
                url = unquote(url[7:].split('&sa=')[0])
                
            if url.startswith('http') and not "google.com" in url:
                img_src = None
                
                # 1. YouTube HQ Extraction (Priority)
                import re
                yt_match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11}).*", url)
                if yt_match and ("youtube.com" in url or "youtu.be" in url):
                    try:
                        v_id = yt_match.group(1)
                        img_src = f"https://i.ytimg.com/vi/{v_id}/mqdefault.jpg"
                    except: pass
                
                # 2. Generic attributes fallback
                if not img_src and img_node:
                    img_src = img_node.attributes.get('src') or \
                              img_node.attributes.get('data-src') or \
                              img_node.attributes.get('data-iurl') or \
                              img_node.attributes.get('imgsrc')
                
                # 3. Clean Google tracking from img_src if it's there
                if img_src and img_src.startswith('/url?'):
                    try:
                        from urllib.parse import parse_qs, urlparse
                        img_src = parse_qs(urlparse(img_src).query).get('q', [None])[0]
                    except: pass

                results.append({
                    "template": "videos.html",
                    "title": title_node.text().strip(),
                    "url": url,
                    "img_src": img_src,
                    "content": snippet_node.text().strip() if snippet_node else "Video de Google.",
                    "source": "google_videos"
                })
    return results
