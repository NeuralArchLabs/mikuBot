from selectolax.parser import HTMLParser
from urllib.parse import urlencode

CATEGORIES = ['it_science']
WEIGHT = 0.5

def request(query, params):
    # Use MDN JSON API (v1)
    lang = params.get("language", "en-US")
    query_params = {
        "q": query,
        "locale": lang
    }
    params["url"] = f"https://developer.mozilla.org/api/v1/search?{urlencode(query_params)}"

def response(resp):
    results = []
    try:
        data = resp.json()
        for doc in data.get("documents", []):
            results.append({
                "title": f"MDN: {doc.get('title')}",
                "url": "https://developer.mozilla.org" + doc.get('mdn_url'),
                "content": doc.get('summary', "Documentación para desarrolladores."),
                "source": "mdn"
            })
    except Exception:
        pass
    return results[:3]
