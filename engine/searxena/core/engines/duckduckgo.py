from selectolax.parser import HTMLParser
from urllib.parse import urlencode, unquote
from utils import LANGUAGE_MAP

CATEGORIES = ["general"]
WEIGHT = 1.8

def request(query, params):
    # DDG Lite version - GET request, very stable and minimal
    lang = params.get("language", "es")
    kl = LANGUAGE_MAP.get("duckduckgo", {}).get(lang, "wt-wt")
    
    query_params = {
        "q": query,
        "kl": kl,
        "df": ""
    }
    params["url"] = f"https://duckduckgo.com/lite/?{urlencode(query_params)}"
    params["method"] = "GET"
    params["headers"]["Referer"] = "https://duckduckgo.com/"
    params["headers"]["Accept-Language"] = f"{lang},en;q=0.8"

def response(resp):
    results = []
    tree = HTMLParser(resp.text)
    
    # DDG Lite version: results are in tables/rows
    for node in tree.css('table tr'):
        title_link = node.css_first('a.result-link')
        if title_link:
            url = title_link.attributes.get('href', '')
            if 'uddg=' in url:
                try:
                    url = unquote(url.split('uddg=')[1].split('&')[0])
                except: pass
            
            if url.startswith('http') and not "duckduckgo.com" in url:
                # Snippet is often in the same row or child td
                snippet_node = node.css_first('td.result-snippet')
                results.append({
                    "title": title_link.text().strip(),
                    "url": url,
                    "content": snippet_node.text().strip() if snippet_node else "Información de DuckDuckGo.",
                    "source": "duckduckgo"
                })
    return results
    # Alternative: search for any link with class result-link
    if not results:
        for link in tree.css('a.result-link'):
            url = link.attributes.get('href', '')
            if 'uddg=' in url:
                url = unquote(url.split('uddg=')[1].split('&')[0])
            
            if url.startswith('http'):
                results.append({
                    "title": link.text().strip(),
                    "url": url,
                    "content": "Ver en DuckDuckGo.",
                    "source": "duckduckgo"
                })
                    
    return results
