"""
Motor de búsqueda Reddit para searXena.

Usa old.reddit.com para scraping más estable.
Incluye:
- Selectores robustos para la estructura actual de old.reddit
- Fallbacks múltiples
- Headers correctos para evitar bloqueos
"""
from selectolax.parser import HTMLParser
from urllib.parse import urlencode

CATEGORIES = ['general', 'social']


def request(query, params):
    """Construye la petición a Reddit Search."""
    query_params = {
        "q": query,
        "source": "recent",
        "type": "link",
        "sort": "relevance"
    }
    params["url"] = f"https://old.reddit.com/search?{urlencode(query_params)}"
    # Reddit requires a real browser UA to avoid 403
    params["headers"]["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    params["headers"]["Referer"] = "https://www.reddit.com/"
    # Reddit also benefits from encoding negotiation that doesn't trigger Brotli issues
    params["headers"]["Accept-Encoding"] = "gzip, deflate"


def response(resp):
    """Parsea la respuesta de Reddit Search."""
    html = resp.text

    # Verificar que no estamos bloqueados
    if resp.status_code == 403:
        return []
    if len(html) < 1000:
        return []

    results = []
    tree = HTMLParser(html)

    # ── Selectores de old.reddit.com ─────────────────────────────────
    # Selector primario: a.search-title (enlaces de título de resultados)
    for node in tree.css('a.search-title'):
        url = node.attributes.get('href', '')
        title = node.text().strip()

        if not title or not url:
            continue

        if not url.startswith('http'):
            url = "https://www.reddit.com" + url

        # Evitar links internos de búsqueda
        if '/search?' in url and 'reddit.com' in url:
            continue

        # Buscar snippet en el padre o hermano
        parent = node.parent
        snippet = ""
        while parent:
            snippet_node = parent.css_first('.search-expando, .md, .search-result-meta')
            if snippet_node:
                snippet = snippet_node.text().strip()[:200]
                break
            parent = parent.parent

        results.append({
            "title": title,
            "url": url,
            "content": snippet or "Conversación en Reddit.",
            "source": "reddit"
        })

    # ── Fallback 1: div.search-result-link ───────────────────────────
    if not results:
        for node in tree.css('div.search-result-link'):
            title_node = node.css_first('a.search-title, a.search-link, a.title')
            if title_node:
                url = title_node.attributes.get('href', '')
                if not url.startswith('http'):
                    url = "https://www.reddit.com" + url
                if url and '/search?' not in url:
                    results.append({
                        "title": title_node.text().strip(),
                        "url": url,
                        "content": "Conversación en Reddit.",
                        "source": "reddit"
                    })

    # ── Fallback 2: div.thing (formato de lista de Reddit) ───────────
    if not results:
        for node in tree.css('div.thing'):
            title_node = node.css_first('a.title')
            if title_node:
                url = title_node.attributes.get('href', '')
                if not url.startswith('http'):
                    url = "https://www.reddit.com" + url
                if url and '/search?' not in url:
                    results.append({
                        "title": title_node.text().strip(),
                        "url": url,
                        "content": "Conversación en Reddit.",
                        "source": "reddit"
                    })

    # ── Fallback 3: Cualquier enlace con clase title ─────────────────
    if not results:
        for node in tree.css('a.title'):
            url = node.attributes.get('href', '')
            if not url.startswith('http'):
                url = "https://www.reddit.com" + url
            if url and 'reddit.com/search' not in url:
                results.append({
                    "title": node.text().strip(),
                    "url": url,
                    "content": "Conversación en Reddit.",
                    "source": "reddit"
                })

    return results[:10]