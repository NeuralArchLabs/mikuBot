from selectolax.parser import HTMLParser
from urllib.parse import urlencode
from utils import LANGUAGE_MAP

CATEGORIES = ["general"]
WEIGHT = 3.0

def request(query, params):
    # Startpage requires POST for search recently to prevent basic scraping
    lang = params.get("language", "es")
    sp_lang = LANGUAGE_MAP.get("startpage", {}).get(lang, "english")
    
    query_params = {
        "query": query,
        "cat": "web",
        "cmd": "process_search",
        "language": sp_lang,
        "engine0": "v1all",
        "t": "device",
        "abp": "-1"
    }
    params["url"] = "https://www.startpage.com/sp/search"
    params["method"] = "POST"
    params["data"] = query_params
    params["headers"]["Referer"] = "https://www.startpage.com/"
    params["headers"]["Origin"] = "https://www.startpage.com"
    params["headers"]["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"

def response(resp):
    results = []
    tree = HTMLParser(resp.text)
    
    # Robust selectors for Startpage
    for node in tree.css('div.result, .result, article.result'):
        title_link = node.css_first('a.result-link, a.result-title, h2 a')
        snippet_node = node.css_first('p.description, .result-snippet, .description')
        
        if title_link:
            url = title_link.attributes.get('href', '')
            if url.startswith('http') and not "startpage.com" in url:
                results.append({
                    "title": title_link.text().strip(),
                    "url": url,
                    "content": snippet_node.text().strip() if snippet_node else "",
                    "source": "startpage"
                })
    return results
