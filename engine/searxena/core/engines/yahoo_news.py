import urllib.request
import urllib.parse
import asyncio
from selectolax.parser import HTMLParser
from urllib.parse import urlencode, unquote
from utils import LANGUAGE_MAP

CATEGORIES = ["news"]
WEIGHT = 1.0

def request(query, params):
    lang = params.get("language", "es")
    lang_code = LANGUAGE_MAP.get("yahoo", {}).get(lang, "en-US")
    
    query_params = {
        "p": query,
        "ei": "UTF-8",
        "b": (params.get("pageno", 1) - 1) * 10 + 1,
        "setlang": lang_code
    }
    
    # Bypass httpx fingerprint block by using urllib
    real_url = f"https://news.search.yahoo.com/search?{urlencode(query_params)}"
    params["engine_data"]["real_url"] = real_url
    params["url"] = "internal://yahoo_news"
    params["headers"]["Accept-Language"] = f"{lang_code},{lang};q=0.9,en;q=0.8"
    params["headers"]["Accept-Encoding"] = "identity"
    params["headers"]["Referer"] = "https://news.search.yahoo.com/"

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
        print(f"Error fetching Yahoo News via urllib: {e}")
        return []
        
    results = []
    tree = HTMLParser(html)
    
    for node in tree.css('div.NewsArticle, .algo-sr, li div.compTitle'):
        title_node = node.css_first('h4 a, h3 a, a.d-ib')
        snippet_node = node.css_first('div.compText, p.s-desc')
        source_node = node.css_first('span.s-source')
        time_node = node.css_first('span.s-time')
        
        if title_node:
            url = title_node.attributes.get('href', '')
            if "r.search.yahoo.com" in url:
                try:
                    if '/RU=' in url:
                        url = unquote(url.split('/RU=')[1].split('/RK=')[0])
                except: pass

            if url and url.startswith('http') and "yahoo.com" not in url:
                source_txt = source_node.text().strip() if source_node else "Noticia"
                time_txt = time_node.text().strip() if time_node else ""
                
                content_prefix = f"{source_txt} - {time_txt}: " if time_txt else f"{source_txt}: "
                snippet_txt = snippet_node.text().strip() if snippet_node else ""
                
                results.append({
                    "title": title_node.text().strip(),
                    "url": url,
                    "content": content_prefix + snippet_txt,
                    "source": "yahoo_news"
                })
    return results
