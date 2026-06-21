from selectolax.parser import HTMLParser
from urllib.parse import urlencode
from utils import LANGUAGE_MAP, gen_mobile_useragent
import json

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
    params["headers"]["User-Agent"] = gen_mobile_useragent()
    params["headers"]["Accept-Language"] = f"{lang_code},{lang};q=0.9,en;q=0.8"
    params["headers"]["Accept-Encoding"] = "gzip, deflate"

def response(resp):
    results = []
    tree = HTMLParser(resp.text)
    
    # In both mobile and desktop layouts, image links have class 'iusc'
    for url_node in tree.css('a.iusc'):
        img_node = url_node.css_first('img')
        
        # Default fallback values from HTML attributes
        img_src = ""
        thumbnail_src = ""
        
        if img_node:
            src = img_node.attributes.get('src') or img_node.attributes.get('data-src') or ""
            # Don't use lazy-loading base64 placeholders
            if src and not src.startswith('data:image'):
                if not src.startswith('http'): 
                    src = "https://www.bing.com" + src
                img_src = src
                thumbnail_src = src
        
        web_url = url_node.attributes.get('href', '')
        if web_url and not web_url.startswith('http'):
            web_url = "https://www.bing.com" + web_url
            
        title = img_node.attributes.get('alt', 'Bing Image') if img_node else 'Bing Image'
        
        # Try parsing rich metadata from 'm' JSON attribute
        m_attr = url_node.attributes.get('m')
        if m_attr:
            try:
                m_data = json.loads(m_attr)
                if m_data.get('murl'):
                    img_src = m_data['murl']
                if m_data.get('purl'):
                    web_url = m_data['purl']
                if m_data.get('t'):
                    title = m_data['t']
                if m_data.get('turl'):
                    thumbnail_src = m_data['turl']
            except Exception:
                pass
                
        # If we still have no valid image sources, skip this node
        if not img_src or img_src.startswith('data:image') or (thumbnail_src and thumbnail_src.startswith('data:image')):
            continue
            
        results.append({
            "template": "images.html",
            "title": title,
            "url": web_url,
            "img_src": img_src,
            "thumbnail_src": thumbnail_src,
            "source": "bing"
        })
    return results
