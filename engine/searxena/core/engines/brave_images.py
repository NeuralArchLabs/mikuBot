from selectolax.parser import HTMLParser
from urllib.parse import urlencode

CATEGORIES = ["images"]
WEIGHT = 1.0

def request(query, params):
    params["url"] = f"https://search.brave.com/images?q={query}"

def response(resp):
    results = []
    tree = HTMLParser(resp.text)
    
    for node in tree.css("div.img-result, .image-result, div[data-testid*='image']"):
        img = node.css_first('img')
        link = node.css_first('a')
        if img and link:
            results.append({
                "template": "images.html",
                "title": img.attributes.get('alt', 'Brave Image'),
                "url": link.attributes.get('href', ''),
                "img_src": img.attributes.get('src'),
                "thumbnail_src": img.attributes.get('src'),
                "source": "brave"
            })
    return results
