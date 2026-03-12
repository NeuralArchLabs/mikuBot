import json

NAME = "hackernews"
CATEGORIES = ['it_science', 'news']
WEIGHT = 1.0
ENABLED = True

async def request(query, params):
    # Usamos la API de Algolia que es oficial y mucho más rápida/privada que el scraping
    params["url"] = f"https://hn.algolia.com/api/v1/search?query={query}&tags=story"

def response(resp):
    results = []
    try:
        data = resp.json()
        for hit in data.get('hits', []):
            if hit.get('title'):
                results.append({
                    "title": hit.get('title'),
                    "url": hit.get('url') or f"https://news.ycombinator.com/item?id={hit.get('objectID')}",
                    "content": f"Points: {hit.get('points', 0)} | Comments: {hit.get('num_comments', 0)} | By: {hit.get('author')}",
                    "source": "hackernews"
                })
    except Exception:
        pass
    return results
