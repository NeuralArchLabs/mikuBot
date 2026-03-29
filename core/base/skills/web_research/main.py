import sys
import json
import io
import re
import httpx
from concurrent.futures import ThreadPoolExecutor

# Force UTF-8 encoding
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

SEARXENA_BASE = "http://127.0.0.1:8000/api/v1"

def calculate_relevance(query, text):
    if not text: return 0
    query_terms = set(re.findall(r'\w+', query.lower()))
    text_low = text.lower()
    score = 0
    for term in query_terms:
        if term in text_low:
            score += text_low.count(term)
    return score

def extract_one(client, url, query, snippet=""):
    """Extract full content from a URL using SearXena's /api/v1/extract endpoint."""
    try:
        response = client.post(f"{SEARXENA_BASE}/extract", json={"url": url}, timeout=15.0)
        content = None
        if response.status_code == 200:
            data = response.json()
            # SearXena extract returns the content in various possible fields
            content = data.get("content") or data.get("text") or data.get("extracted_text") or ""
        
        final_content = content if content and len(content) > 200 else snippet
        score = calculate_relevance(query, final_content)
        
        return {
            "url": url, 
            "content": (final_content[:3000] + "...") if len(final_content) > 3000 else final_content,
            "relevance": score,
            "method": "full_extract" if content and len(content) > 200 else "snippet_fallback"
        }
    except:
        return {"url": url, "content": snippet, "relevance": calculate_relevance(query, snippet), "method": "error_fallback"}

def web_research(query, max_sites=3):
    """
    WEB RESEARCH (Mid-Point): 
    Diferente de web_search por leer el contenido real de los sitios via SearXena extract API.
    A diferencia de deep_research, es lineal y no genera reportes ni auditorías.
    """
    try:
        with httpx.Client(timeout=20.0) as client:
            # Step 1: Search
            payload = {"query": query, "limit": 6, "category": "general"}
            response = client.post(f"{SEARXENA_BASE}/search", json=payload)
            if response.status_code != 200:
                return {"success": False, "error": "Motor SearXena fuera de línea."}
            
            search_results = response.json().get("results", [])
            if not search_results:
                return {"success": False, "error": "No se encontraron resultados."}

            items_to_process = [{"url": r.get("url"), "snippet": r.get("content", "")} for r in search_results[:max_sites]]
            
            # Step 2: Extract content from each URL using SearXena extract API
            with ThreadPoolExecutor(max_workers=len(items_to_process)) as executor:
                results = list(executor.map(
                    lambda x: extract_one(httpx.Client(timeout=15.0), x["url"], query, x["snippet"]),
                    items_to_process
                ))
                extracted_data = [r for r in results if r is not None]

            extracted_data.sort(key=lambda x: x["relevance"], reverse=True)

            return {
                "success": True,
                "type": "mid_point_research",
                "query": query,
                "extracted_sources": extracted_data
            }
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    try:
        args = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
        query = args.get('query')
        max_sites = args.get('max_sites', 3)
        if not query:
            sys.exit(1)
        output = web_research(query, max_sites)
        sys.stdout.write(json.dumps(output, ensure_ascii=False) + "\n")
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
