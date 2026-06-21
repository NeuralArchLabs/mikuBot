from selectolax.parser import HTMLParser
from urllib.parse import urlencode
from utils import LANGUAGE_MAP, gen_mobile_useragent

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
    params["headers"]["User-Agent"] = gen_mobile_useragent()
    params["headers"]["Accept-Language"] = f"{lang_code},{lang};q=0.9,en;q=0.8"
    params["headers"]["Accept-Encoding"] = "gzip, deflate"

def response(resp):
    results = []
    tree = HTMLParser(resp.text)
    
    # Matches both mobile (.newscard) and desktop (.news-card) structures
    for node in tree.css('div.news-card, div.news-card-wrapper, div.newscard, .newscard'):
        title_node = node.css_first('a.title, a[class*="title"], a')
        
        # Use full title attribute if available (especially on mobile)
        title = node.attributes.get('data-title')
        if not title and title_node:
            title = title_node.text().strip()
        if not title:
            continue
            
        url = node.attributes.get('url') or node.attributes.get('data-url')
        if not url and title_node:
            url = title_node.attributes.get('href', '')
            
        if url.startswith('/news/'):
            url = "https://www.bing.com" + url
            
        source = node.attributes.get('data-author')
        if not source:
            source_node = node.css_first('div.source a, div.source span:first-child, span.source, .source, .biglogo_link')
            if source_node:
                source = source_node.text().strip() or source_node.attributes.get('aria-label', '').replace('Buscar noticias de ', '')
        if not source:
            source = "Noticia"
            
        time_node = node.css_first('span.timestamp, span.news-pubtime, span[aria-label], .time')
        time_str = time_node.text().strip() if time_node else ""
        
        snippet_node = node.css_first('div.snippet, div[class*="snippet"], p, span.snippet')
        snippet = snippet_node.text().strip() if snippet_node else ""
        
        display_content = snippet if snippet else f"Noticia de {source}."
        if time_str:
            display_content = f"({time_str}) {display_content}"
            
        results.append({
            "title": title,
            "url": url,
            "content": display_content,
            "source": "bing_news"
        })
        
    return results
