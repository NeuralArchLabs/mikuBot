from selectolax.parser import HTMLParser
from urllib.parse import urlencode

CATEGORIES = ['it_science']
WEIGHT = 1.0

def request(query, params):
    query_params = {
        "query": query,
        "searchtype": "all"
    }
    params["url"] = f"https://arxiv.org/search/?{urlencode(query_params)}"

def response(resp):
    results = []
    tree = HTMLParser(resp.text)
    
    for node in tree.css('li.arxiv-result'):
        title_node = node.css_first('p.title')
        link_node = node.css_first('p.list-title a')
        snippet_node = node.css_first('span.abstract-full')
        
        if title_node and link_node:
            results.append({
                "title": f"ArXiv: {title_node.text().strip()}",
                "url": link_node.attributes.get('href', ''),
                "content": snippet_node.text().strip() if snippet_node else "Paper académico.",
                "source": "arxiv"
            })
    return results
