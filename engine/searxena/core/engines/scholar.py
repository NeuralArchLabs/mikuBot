from selectolax.parser import HTMLParser
from urllib.parse import urlencode

CATEGORIES = ['it_science']
WEIGHT = 1.0

def request(query, params):
    lang = params.get("language", "es")
    query_params = {
        "q": query,
        "hl": lang
    }
    params["url"] = f"https://scholar.google.com/scholar?{urlencode(query_params)}"

def response(resp):
    results = []
    tree = HTMLParser(resp.text)
    
    for node in tree.css('div.gs_r.gs_or.gs_scl'):
        title_node = node.css_first('h3.gs_rt a')
        snippet_node = node.css_first('div.gs_rs')
        
        if title_node:
            results.append({
                "title": f"Scholar: {title_node.text().strip()}",
                "url": title_node.attributes.get('href', ''),
                "content": snippet_node.text().strip() if snippet_node else "Artículo académico.",
                "source": "scholar"
            })
    return results
