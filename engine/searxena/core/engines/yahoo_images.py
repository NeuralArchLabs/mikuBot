import urllib.request
import urllib.parse
import json
import asyncio
from selectolax.parser import HTMLParser
from urllib.parse import urlencode

CATEGORIES = ["images"]
WEIGHT = 1.0

def request(query, params):
    # Use Yahoo Japan image search to bypass WAF / GDPR consent wall
    query_params = {
        "p": query,
        "b": (params.get("pageno", 1) - 1) * 20 + 1
    }
    real_url = f"https://search.yahoo.co.jp/image/search?{urlencode(query_params)}"
    params["engine_data"]["real_url"] = real_url
    params["url"] = "internal://yahoo_images"
    params["headers"]["Accept-Language"] = "es-ES,es;q=0.9,en;q=0.8"
    params["headers"]["Accept-Encoding"] = "identity"

async def response(resp):
    real_url = resp.search_params["engine_data"]["real_url"]
    headers = resp.search_params["headers"]
    
    def fetch():
        req = urllib.request.Request(real_url, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as response_obj:
            return response_obj.read().decode('utf-8', errors='ignore')
            
    try:
        html = await asyncio.to_thread(fetch)
    except Exception as e:
        print(f"Error fetching Yahoo Images via urllib: {e}")
        return []
        
    results = []
    try:
        tree = HTMLParser(html)
        scripts = tree.css("script")
        for s in scripts:
            txt = s.text()
            if txt and txt.strip().startswith('{"props":'):
                data = json.loads(txt)
                algos = data.get("props", {}).get("initialProps", {}).get("pageProps", {}).get("algos", [])
                for item in algos:
                    title = item.get("title", "Yahoo Image")
                    url = item.get("refererUrl", "")
                    img_src = item.get("imageSrc")
                    
                    orig = item.get("original", {})
                    orig_url = orig.get("url") if isinstance(orig, dict) else None
                    
                    if url and (img_src or orig_url):
                        results.append({
                            "template": "images.html",
                            "title": title,
                            "url": url,
                            "img_src": orig_url or img_src,
                            "thumbnail_src": img_src or orig_url,
                            "source": "yahoo_images"
                        })
                break
    except Exception as e:
        print(f"Error parsing Yahoo Images: {e}")
        
    return results
