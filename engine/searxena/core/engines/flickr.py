from selectolax.parser import HTMLParser
from urllib.parse import urlencode

CATEGORIES = ["images"]
WEIGHT = 1.0

def request(query, params):
    params["url"] = f"https://www.flickr.com/search/?text={query}"

def response(resp):
    results = []
    tree = HTMLParser(resp.text)
    
    # Flickr usa mucho JS, pero a veces el HTML base tiene previews
    for node in tree.css('div.photo-list-photo-view'):
        title_node = node.css_first('a.title')
        img_node = node.css_first('div.interaction-view') # A veces la imagen esta en el background
        
        # Como es dificil por CSS, buscaremos el tag img si existe
        img = node.css_first('img')
        if img:
            src = img.attributes.get('src')
            if src and not src.startswith('http'): src = "https:" + src
            
            # Safe extraction
            link_node = node.css_first('a')
            href = link_node.attributes.get('href', '') if link_node else ''
            
            results.append({
                "template": "images.html",
                "title": img.attributes.get('alt', 'Flickr Image'),
                "url": "https://www.flickr.com" + href,
                "img_src": src,
                "thumbnail_src": src,
                "source": "flickr"
            })
    return results
