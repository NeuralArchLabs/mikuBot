"""
Motor de búsqueda GitHub para searXena.

Usa la API oficial de GitHub Search (REST API) para obtener resultados
confiables sin depender de scraping de páginas React.

La API funciona sin autenticación (10 req/min). Con token, sube a 30 req/min.
"""
import json
from urllib.parse import urlencode
from selectolax.parser import HTMLParser

CATEGORIES = ['general', 'social', 'it_science']
WEIGHT = 1.0

GITHUB_API_URL = "https://api.github.com/search/repositories"


def request(query, params):
    """Construye la petición a GitHub Search API (sin auth)."""
    query_params = {
        "q": query,
        "sort": "stars",
        "order": "desc",
        "per_page": 5,
    }

    if params.get("pageno", 1) > 1:
        query_params["page"] = params["pageno"]

    params["url"] = f"{GITHUB_API_URL}?{urlencode(query_params)}"
    params["method"] = "GET"
    # GitHub API requiere Accept header específico y un User-Agent
    params["headers"]["Accept"] = "application/vnd.github.v3+json"
    params["headers"]["User-Agent"] = "searXena/1.2"


def response(resp):
    """Parsea la respuesta de GitHub Search API."""
    results = []

    try:
        data = resp.json()

        # Verificar si es respuesta de API válida
        if "items" in data:
            for repo in data["items"][:5]:
                result = {
                    "title": f"GitHub: {repo.get('full_name', repo.get('name', ''))}",
                    "url": repo.get("html_url", ""),
                    "content": _format_description(repo),
                    "source": "github"
                }

                if repo.get("stargazers_count") is not None:
                    result["stars"] = repo["stargazers_count"]
                if repo.get("language"):
                    result["language"] = repo["language"]

                results.append(result)

            return results

    except (json.JSONDecodeError, AttributeError):
        pass

    # Fallback a scraping si la API falló (rate limit, etc.)
    try:
        tree = HTMLParser(resp.text)
        for node in tree.css('div.search-result, .repo-list-item, [data-testid="results-list"] div'):
            title_node = node.css_first('a, h3 a, h4 a')
            desc_node = node.css_first('p, .description')

            if title_node:
                href = title_node.attributes.get('href', '')
                if href and not href.startswith('http'):
                    href = "https://github.com" + href
                if href:
                    results.append({
                        "title": f"GitHub: {title_node.text().strip()}",
                        "url": href,
                        "content": desc_node.text().strip() if desc_node else "Repositorio en GitHub.",
                        "source": "github"
                    })
    except Exception:
        pass

    return results[:5]


def _format_description(repo):
    """Formatea una descripción enriquecida del repositorio."""
    parts = []

    desc = repo.get("description", "") or ""
    if desc:
        parts.append(desc[:200])

    meta = []
    if repo.get("stargazers_count") is not None:
        meta.append(f"⭐ {repo['stargazers_count']}")
    if repo.get("language"):
        meta.append(f"🔤 {repo['language']}")
    if repo.get("forks_count") is not None:
        meta.append(f"🔀 {repo['forks_count']}")

    if meta:
        parts.append(" | ".join(meta))

    return " — ".join(parts) if parts else "Repositorio en GitHub."