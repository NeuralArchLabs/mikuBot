from selectolax.parser import HTMLParser
from urllib.parse import urlencode
from utils import LANGUAGE_MAP

CATEGORIES = ["news"]
WEIGHT = 1.5

def request(query, params):
    lang = params.get("language", "es")
    lang_code = LANGUAGE_MAP.get("bing", {}).get(lang, "en-US")
    country = lang_code.split('-')[1].lower() if '-' in lang_code else "us"
    
    # Cookies to force market and avoid redirects
    params["cookies"]["_EDGE_CD"] = f"m={lang_code}&u={lang_code}"
    params["cookies"]["_EDGE_S"] = f"mkt={lang_code}&ui={lang_code}"
    
    query_params = {
        "q": query,
        "qft": "interval:\"1\"", # Últimas 24h opcional, pero mejor general
        "form": "QBNH",
        "setlang": lang_code,
        "cc": country
    }
    params["url"] = f"https://www.bing.com/news/search?{urlencode(query_params)}"
    params["headers"]["Accept-Language"] = f"{lang_code},{lang};q=0.9,en;q=0.8"

def response(resp):
    results = []
    tree = HTMLParser(resp.text)
    
    # Selectores para Bing News
    for node in tree.css('div.news-card, div.news-card-wrapper'):
        title_node = node.css_first('a.title')
        snippet_node = node.css_first('div.snippet')
        # Intentar sacar solo el nombre de la fuente sin el tiempo
        source_name_node = node.css_first('div.source a, div.source span:first-child')
        time_node = node.css_first('span[aria-label], span.news-pubtime')
        
        if title_node:
            title = title_node.text().strip()
            url = title_node.attributes.get('href', '')
            
            if url.startswith('/news/'):
                url = "https://www.bing.com" + url
                
            source = source_name_node.text().strip() if source_name_node else "Noticia"
            time_str = time_node.text().strip() if time_node else ""
            
            # Formatear contenido sin duplicados
            content_text = snippet_node.text().strip() if snippet_node else ""
            display_content = f"{source} ({time_str}): {content_text}" if time_str else f"{source}: {content_text}"
            
            results.append({
                "title": title,
                "url": url,
                "content": display_content,
                "source": "bing_news"
            })
            
    return results
