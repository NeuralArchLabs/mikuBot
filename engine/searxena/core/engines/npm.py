from selectolax.parser import HTMLParser
from urllib.parse import urlencode

CATEGORIES = ['it_science']
WEIGHT = 0.5

def request(query, params):
    # Use registry.npmjs.org API (super reliable)
    query_params = {
        "text": query,
        "size": 10,
        "from": (params.get("pageno", 1) - 1) * 10
    }
    params["url"] = f"https://registry.npmjs.org/-/v1/search?{urlencode(query_params)}"

def response(resp):
    results = []
    try:
        data = resp.json()
        for item in data.get("objects", []):
            pkg = item.get("package", {})
            results.append({
                "title": f"NPM: {pkg.get('name')} {pkg.get('version')}",
                "url": pkg.get("links", {}).get("npm", f"https://www.npmjs.com/package/{pkg.get('name')}"),
                "content": pkg.get("description", "Paquete de Node.js."),
                "source": "npm"
            })
    except Exception:
        pass
    return results[:3]
