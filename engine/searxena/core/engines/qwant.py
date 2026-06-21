"""
Motor de búsqueda Qwant para searXena.

Qwant es un motor europeo enfocado en privacidad que no rastrea usuarios
y es menos agresivo con el bloqueo de bots que Google o Bing.
"""
from selectolax.parser import HTMLParser
from urllib.parse import urlencode, parse_qs, urlparse
from utils import LANGUAGE_MAP

CATEGORIES = ["general", "news", "images"]
WEIGHT = 1.5


def request(query, params):
    """Construye la petición a Qwant Search."""
    lang = params.get("language", "es")
    lang_code = LANGUAGE_MAP.get("qwant", {}).get(lang, lang)
    category = params.get("category", "general")

    type_map = {
        "general": "web",
        "news": "news",
        "images": "images",
        "it": "web",
        "social": "web"
    }
    search_type = type_map.get(category, "web")

    page = params.get("pageno", 1)

    query_params = {
        "q": query,
        "t": search_type,
        "locale": f"{lang_code}_{lang_code.upper()}",
        "r": lang_code,
        "sr": lang_code,
    }

    if page > 1:
        query_params["p"] = page - 1

    params["url"] = f"https://www.qwant.com/?{urlencode(query_params)}"
    params["headers"]["Referer"] = "https://www.qwant.com/"


def response(resp):
    """Parsea la respuesta HTML de Qwant."""
    results = []
    tree = HTMLParser(resp.text)

    # Resultados web
    for node in tree.css('div.result, .result-web, [data-testid="webResult"]'):
        title_node = node.css_first('a, h2 a, h3 a, [data-testid="resultTitle"] a')
        snippet_node = node.css_first('p, .result-snippet, [data-testid="resultDesc"]')

        if title_node:
            url = title_node.attributes.get('href', '')
            # Qwant puede usar redirecciones internas
            if url.startswith('/url?') or url.startswith('/link?'):
                try:
                    parsed = urlparse(url)
                    qs = parse_qs(parsed.query)
                    if 'url' in qs:
                        url = qs['url'][0]
                    elif 'r' in qs:
                        url = qs['r'][0]
                except:
                    pass

            if url and url.startswith('http') and "qwant.com" not in url:
                results.append({
                    "title": title_node.text().strip(),
                    "url": url,
                    "content": snippet_node.text().strip() if snippet_node else "Resultado de Qwant.",
                    "source": "qwant"
                })

    # Fallback
    if not results:
        for node in tree.css('article, .web-result'):
            title_link = node.css_first('a[href^="http"]')
            snippet = node.css_first('p, .description')

            if title_link:
                url = title_link.attributes.get('href', '')
                if url and "qwant.com" not in url:
                    results.append({
                        "title": title_link.text().strip(),
                        "url": url,
                        "content": snippet.text().strip() if snippet else "Resultado de Qwant.",
                        "source": "qwant"
                    })

    return results