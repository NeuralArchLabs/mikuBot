from selectolax.parser import HTMLParser

CATEGORIES = ["general"]
WEIGHT = 2.2

def request(query, params):
    # Brave Search
    offset = (params.get("pageno", 1) - 1) * 20
    lang = params.get("language", "es")
    params["url"] = f"https://search.brave.com/search?q={query}&offset={offset}&source=web&hl={lang}"
    params["headers"]["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"

def response(resp):
    results = []
    tree = HTMLParser(resp.text)
    
    # Brave Search modern layout
    for node in tree.css('div.snippet'):
        # Título y Link principal
        title_link = node.css_first('a.l1')
        title_node = node.css_first('div.title.search-snippet-title')
        # Contenido / Snippet
        snippet_node = node.css_first('div.content.desktop-default-regular.t-primary') or \
                       node.css_first('.snippet-description') or \
                       node.css_first('.description')
        
        if title_link and title_node:
            url = title_link.attributes.get('href', '')
            if url and "brave.com" not in url and url.startswith('http'):
                results.append({
                    "title": title_node.text().strip(),
                    "url": url,
                    "content": snippet_node.text().strip() if snippet_node else "Información de Brave Search.",
                    "source": "brave"
                })
    
    # Si no encontramos nada, probar selectores genéricos previos
    if not results:
        for node in tree.css('div.snippet, .snippet'):
            title_link = node.css_first('a[href^="http"]')
            title_text = node.css_first('.title, h2, h3')
            snippet_node = node.css_first('.description, .content, p')
            
            if title_link:
                url = title_link.attributes.get('href', '')
                if url and "brave.com" not in url and url.startswith('http'):
                    results.append({
                        "title": title_text.text().strip() if title_text else title_link.text().strip(),
                        "url": url,
                        "content": snippet_node.text().strip() if snippet_node else "Información de Brave Search.",
                        "source": "brave"
                    })
    
    return results
