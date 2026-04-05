from selectolax.parser import HTMLParser
from urllib.parse import urlencode

CATEGORIES = ['social', 'it_science']
WEIGHT = 0.5

def request(query, params):
    # Usar búsqueda de repositorios de GitHub
    params["url"] = f"https://github.com/search?{urlencode({'q': query, 'type': 'repositories'})}"

def response(resp):
    results = []
    tree = HTMLParser(resp.text)
    
    # GitHub results layout (React)
    for node in tree.css('div.search-title, div[data-testid="results-list"] div[class*="Box"], .repo-list-item, div.search-result'):
        title_node = node.css_first('a, h3 a, h4 a')
        desc_node = node.css_first('p, div[class*="Text"], .description')
        
        if title_node:
            results.append({
                "title": f"GitHub: {title_node.text().strip()}",
                "url": "https://github.com" + title_node.attributes.get('href', ''),
                "content": desc_node.text().strip() if desc_node else "Repositorio en GitHub.",
                "source": "github"
            })
    return results[:3]
