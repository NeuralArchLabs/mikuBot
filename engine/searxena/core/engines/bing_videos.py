from selectolax.parser import HTMLParser
from urllib.parse import urlencode
from utils import LANGUAGE_MAP, gen_mobile_useragent
import json

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
    params["headers"]["User-Agent"] = gen_mobile_useragent()
    params["headers"]["Accept-Language"] = f"{lang_code},{lang};q=0.9,en;q=0.8"
    params["headers"]["Accept-Encoding"] = "gzip, deflate"

def response(resp):
    results = []
    tree = HTMLParser(resp.text)
    
    for node in tree.css('div.dg_u, div.mc_vtvc'):
        # Check if the node is the video card itself or if it contains it
        vtvc = node if 'mc_vtvc' in node.attributes.get('class', '') else node.css_first('div.mc_vtvc')
        
        url = ""
        title = ""
        img_src = ""
        content = "Video de Bing."
        
        if vtvc:
            mmeta = vtvc.attributes.get('mmeta')
            if mmeta:
                try:
                    meta_data = json.loads(mmeta)
                    url = meta_data.get('murl') or meta_data.get('pgurl', '')
                    if meta_data.get('turl'):
                        img_src = meta_data['turl']
                except:
                    pass
            
            title_el = vtvc.css_first('div.mc_vtvc_title, .mc_vtvc_title')
            if title_el:
                title = title_el.attributes.get('title') or title_el.text().strip()
                
            img_el = vtvc.css_first('img')
            if img_el and not img_src:
                src = img_el.attributes.get('src') or img_el.attributes.get('data-src') or ''
                if src and not src.startswith('data:image'):
                    if not src.startswith('http'):
                        src = "https://www.bing.com" + src
                    img_src = src
                
            if not title and img_el:
                title = img_el.attributes.get('alt', '')
                
            # Duration info
            duration_el = vtvc.css_first('div.mc_bc_rc')
            duration = duration_el.text().strip() if duration_el else ""
            
            provider_el = vtvc.css_first('div.mc_vtvc_meta_row span:last-child, .meta_pd_content')
            provider = provider_el.text().strip() if provider_el else ""
            if provider:
                content = f"{provider} • {duration}" if duration else provider
            elif duration:
                content = f"Video • {duration}"
        
        # Fallbacks
        if not url:
            url_node = node.css_first('a')
            if url_node:
                url = url_node.attributes.get('href', '')
                if url and not url.startswith('http'):
                    url = "https://www.bing.com" + url
                    
        if not title:
            title_node = node.css_first('div.title')
            if title_node:
                title = title_node.text().strip()
                
        if not img_src:
            img_node = node.css_first('img')
            if img_node:
                src = img_node.attributes.get('src') or img_node.attributes.get('data-src') or ''
                if src and not src.startswith('data:image'):
                    if not src.startswith('http'):
                        src = "https://www.bing.com" + src
                    img_src = src
                
        if url and title:
            # Clean url redirects if any
            if url.startswith('/videos/search?'):
                url = "https://www.bing.com" + url
            # Don't include entries with base64 lazy loaded images as sources
            if img_src and img_src.startswith('data:image'):
                img_src = ""
                
            results.append({
                "template": "videos.html",
                "title": title,
                "url": url,
                "img_src": img_src if img_src else None,
                "content": content,
                "source": "bing"
            })
            
    return results
