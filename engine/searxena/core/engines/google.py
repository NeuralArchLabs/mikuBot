STATUS = "experimental"
import random
from urllib.parse import urlencode, unquote
from utils import LANGUAGE_MAP
from selectolax.parser import HTMLParser

CATEGORIES = ["general", "news", "videos", "images"]
WEIGHT = 1.5

def request(query, params):
    # Google with udm=14 (clean Web view, less bot detection)
    offset = (params.get("pageno", 1) - 1) * 10
    
    lang_code = LANGUAGE_MAP.get("google", {}).get(params.get("language"), "es")
    
    query_params = {
        "q": query,
        "hl": lang_code,
        "start": offset,
        "udm": 14, # New Web search view
    }
    
    if params.get("category") == "news":
        query_params["tbm"] = "nws"
        query_params.pop("udm", None)
    elif params.get("category") == "videos":
        query_params["tbm"] = "vid"
        query_params.pop("udm", None)
    elif params.get("category") == "images":
        query_params["tbm"] = "isch"
        query_params.pop("udm", None)
        
    params["url"] = f"https://www.google.com/search?{urlencode(query_params)}"
    params["headers"]["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
    params["headers"]["Referer"] = "https://www.google.com/"
    
    import random
    cb_val = random.randint(20230000, 20249999)
    # Consent cookies to bypass 'Before you continue'
    params["cookies"]["CONSENT"] = f"YES+cb.{cb_val}-04-p0.{params.get('language', 'es')}+FX+414"

def response(resp):
    results = []
    tree = HTMLParser(resp.text)
    
    # 1. Main Search Results (Desktop/Modern)
    # Improved selectors: .g, .MjjYud, .Gx5S9b (mobile)
    for node in tree.css('div.g, .MjjYud, .Gx5S9b, div.WwS1ce, .ZIN69b, .MjjYud'):
        title_node = node.css_first('h3, .vv14be, .BNeawe')
        url_node = node.css_first('a[href]')
        
        # Snippets: .VwiC3b (modern), .s31JSe (mobile), .st (old)
        snippet_node = node.css_first('div.VwiC3b, .BNeawe, .s3v9rd, span.st, .yXK7lf')
        
        # Miniatures
        img_node = node.css_first('img')
        
        if title_node and url_node:
            url = _clean_url(url_node.attributes.get('href', ''))
            if _valid_url(url):
                title = title_node.text().strip()
                if title:
                    item = {
                        "title": title,
                        "url": url,
                        "content": snippet_node.text().strip() if snippet_node else "Google result.",
                        "source": "google"
                    }
                    if img_node:
                        src = img_node.attributes.get('src') or img_node.attributes.get('data-src')
                        if src and 'http' in src:
                            item["thumbnail_src"] = src
                            item["img_src"] = src
                    results.append(item)
    
    # 2. Ultra-Fallback: Any <h3> inside an <a> or similar
    if not results:
        # Search for any h3 link
        for node in tree.css('h3'):
            link = node.parent
            # Try to find the closest wrapping link
            limit = 5
            while link and link.tag != 'a' and limit > 0:
                link = link.parent
                limit -= 1
            
            if link and link.tag == 'a':
                url = _clean_url(link.attributes.get('href', ''))
                if _valid_url(url):
                    results.append({
                        "title": node.text().strip(),
                        "url": url,
                        "content": "Ver en Google.",
                        "source": "google"
                    })

    # Images (isch)
    if "tbm=isch" in resp.url:
        for node in tree.css('div.isv-r, .isv-r'):
            img_node = node.css_first('img')
            link_node = node.css_first('a[href^="http"]')
            if img_node:
                src = img_node.attributes.get('src') or img_node.attributes.get('data-src')
                if src:
                    results.append({
                        "template": "images.html",
                        "title": "Imagen de Google",
                        "url": link_node.attributes.get('href', '#') if link_node else "#",
                        "img_src": src,
                        "source": "google"
                    })

    return results

def _clean_url(url):
    """Clean Google redirect URLs."""
    if url.startswith('/url?q='):
        url = unquote(url[7:].split('&sa=')[0])
    if '/url?esrc=' in url:
        try:
            url = unquote(url.split('url=')[1].split('&')[0])
        except:
            pass
    return url

def _valid_url(url):
    """Check if URL is a valid external result."""
    return url.startswith('http') and "google.com" not in url
