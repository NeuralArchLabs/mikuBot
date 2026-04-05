from selectolax.parser import HTMLParser
from urllib.parse import urlencode

CATEGORIES = ["images"]
WEIGHT = 1.0

def request(query, params):
    params["url"] = f"https://wallhaven.cc/search?q={query}"

def response(resp):
    results = []
    tree = HTMLParser(resp.text)
    
    for node in tree.css('figure.thumb'):
        img = node.css_first('img')
        link = node.css_first('a.preview')
        if img and link:
            results.append({
                "template": "images.html",
                "title": "Wallhaven Wallpaper",
                "url": link.attributes.get('href', ''),
                "img_src": img.attributes.get('data-src') or img.attributes.get('src'),
                "thumbnail_src": img.attributes.get('data-src') or img.attributes.get('src'),
                "source": "wallhaven"
            })
    return results
