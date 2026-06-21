from selectolax.parser import HTMLParser
from urllib.parse import urlencode, unquote
from utils import LANGUAGE_MAP, fetch_fallback_search, detect_block

CATEGORIES = ["general"]
WEIGHT = 1.8

def request(query, params):
    # DDG HTML version - GET request, stable and clean
    lang = params.get("language", "es")
    kl = LANGUAGE_MAP.get("duckduckgo", {}).get(lang, "wt-wt")
    
    query_params = {
        "q": query,
        "kl": kl,
        "df": ""
    }
    params["url"] = f"https://duckduckgo.com/html/?{urlencode(query_params)}"
    params["method"] = "GET"
    params["headers"]["Referer"] = "https://duckduckgo.com/"
    params["headers"]["Accept-Language"] = f"{lang},en;q=0.8"

async def response(resp):
    results = []
    html = resp.text
    
    is_blocked, _ = detect_block(html, resp.status_code, resp.url)
    
    if not is_blocked:
        tree = HTMLParser(html)
        # DDG HTML version: results are in div.result
        for node in tree.css('div.result'):
            title_node = node.css_first('a.result__a') or node.css_first('.result__title a')
            snippet_node = node.css_first('.result__snippet')
            
            if title_node:
                title = title_node.text().strip()
                url = title_node.attributes.get('href', '')
                
                if 'uddg=' in url:
                    try:
                        url = unquote(url.split('uddg=')[1].split('&')[0])
                    except:
                        pass
                
                if url.startswith('http') and not "duckduckgo.com" in url:
                    content = snippet_node.text().strip() if snippet_node else "Información de DuckDuckGo."
                    results.append({
                        "title": title,
                        "url": url,
                        "content": content,
                        "source": "duckduckgo"
                    })
                    
    # Fallback if blocked or no results found
    if not results or is_blocked:
        try:
            lang = resp.search_params.get("language", "es")
            fallback_results = await fetch_fallback_search(resp.search_params.get("query", ""), lang, resp.client)
            for r in fallback_results:
                r["source"] = "duckduckgo"
                results.append(r)
        except Exception as e:
            print(f"Duckduckgo fallback failed: {e}")
            
    return results
