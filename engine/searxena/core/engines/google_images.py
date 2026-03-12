from selectolax.parser import HTMLParser
from urllib.parse import urlencode, unquote
from utils import LANGUAGE_MAP

CATEGORIES = ["images"]

def request(query, params):
    # Google Images modo móvil es más fácil de scrapear sin JS
    lang = params.get("language", "es")
    lang_code = LANGUAGE_MAP.get("google", {}).get(lang, "es")
    
    query_params = {
        "q": query,
        "tbm": "isch",
        "tbs": "rimg",
        "hl": lang_code
    }
    params["url"] = f"https://www.google.com/search?{urlencode(query_params)}"
    params["headers"]["User-Agent"] = "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
    
    import random
    cb_val = random.randint(20230000, 20249999)
    params["cookies"]["CONSENT"] = f"YES+cb.{cb_val}-04-p0.{lang}+FX+414"

def response(resp):
    results = []
    tree = HTMLParser(resp.text)
    
    # Exclude patterns common for icons, favicons, or tracking pixels
    exclude_patterns = [
        "favicon", "logo", "icon", "pixel", "tracker", "sprite", 
        "nav_", "button", "menu", "avatar", "profile", "social",
        "plus.google.com", "facebook.com/tr"
    ]
    
    # Look for bigger images and typical containers in Google Images Mobile
    for node in tree.css('div.islrc img, div.isv-r img, img.rg_i, img.y_a'):
        src = node.attributes.get('src') or node.attributes.get('data-src') or node.attributes.get('data-iurl')
        
        if not src or not src.startswith('http'):
            continue
            
        # 1. Filter by URL pattern
        if any(p in src.lower() for p in exclude_patterns):
            continue
            
        # 2. Filter by potential dimensions in URL (e.g., =s32-c)
        import re
        dim_match = re.search(r'=[swh](\d{1,3})', src)
        if dim_match:
            size = int(dim_match.group(1))
            if size < 64: # Too small, probably an icon/favicon
                continue

        title = node.attributes.get('alt', '').strip()
        # If title is generic icon text, skip
        if not title or any(p in title.lower() for p in ["icon", "favicon", "logo"]):
            if not title: # If no title, we might want it if it looks like a real image URL
                 pass
            else:
                 continue

        results.append({
            "template": "images.html",
            "title": title or "Imagen de Google",
            "url": src,
            "img_src": src,
            "thumbnail_src": src,
            "source": "google_images",
            "content": "Google Images"
        })
            
    return results
