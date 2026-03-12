from selectolax.parser import HTMLParser
from urllib.parse import urlencode

CATEGORIES = ['it_science']
WEIGHT = 1.0

def request(query, params):
    params["url"] = f"https://stackoverflow.com/search?{urlencode({'q': query})}"
    params["headers"]["Referer"] = "https://stackoverflow.com/"
    params["headers"]["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
    # StackOverflow is sensitive to UA and Referer

def response(resp):
    results = []
    tree = HTMLParser(resp.text)
    
    for node in tree.css('div.s-post-summary, .search-result'):
        title_node = node.css_first('h3 a, .result-link a')
        snippet_node = node.css_first('div.s-post-summary--content-excerpt, .excerpt')
        
        if title_node:
            href = title_node.attributes.get('href', '')
            url = href if href.startswith('http') else "https://stackoverflow.com" + href
            results.append({
                "title": title_node.text().strip(),
                "url": url,
                "content": snippet_node.text().strip() if snippet_node else "Pregunta en StackOverflow.",
                "source": "stackoverflow"
            })
    return results
