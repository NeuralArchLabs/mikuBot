from selectolax.parser import HTMLParser
from urllib.parse import urlencode

CATEGORIES = ["general"]
WEIGHT = 1.0

def request(query, params):
    lang = params.get("language", "es")
    query_params = {
        "wd": query,
        "pn": (params.get("pageno", 1) - 1) * 10,
        "ie": "utf-8"
    }
    # Baidu suele requerir headers especificos para no ser bloqueado
    params["url"] = f"https://www.baidu.com/s?{urlencode(query_params)}"
    params["headers"]["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    params["headers"]["Accept-Language"] = f"{lang},en;q=0.8"

def response(resp):
    results = []
    tree = HTMLParser(resp.text)
    
    for node in tree.css('div.result.c-container'):
        title_node = node.css_first('h3 a')
        snippet_node = node.css_first('div.c-abstract, div.content_left')
        
        if title_node:
            results.append({
                "title": title_node.text().strip(),
                "url": title_node.attributes.get('href', ''),
                "content": snippet_node.text().strip() if snippet_node else "Baidu result.",
                "source": "baidu"
            })
    return results
