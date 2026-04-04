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

def web_research(query, max_sites=3, categories=None):
    """
    WEB RESEARCH (Mid-Point): 
    Diferente de web_search por leer el contenido real de los sitios via SearXena extract API.
    Permite seleccionar múltiples categorías para una búsqueda diversa.
    """
    if not categories: categories = ["general"]
    
    seen_urls = set()
    total_results = []
    
    try:
        with httpx.Client(timeout=20.0) as client:
            # Step 1: Multi-Category Search
            for cat in categories:
                payload = {"query": query, "limit": max_sites + 2, "category": cat}
                try:
                    response = client.post(f"{SEARXENA_BASE}/search", json=payload)
                    if response.status_code == 200:
                        results = response.json().get("results", [])
                        for r in results:
                            url = r.get("url")
                            if url and url not in seen_urls:
                                seen_urls.add(url)
                                total_results.append({"url": url, "snippet": r.get("content", ""), "category": cat})
                except: continue

            if not total_results:
                return {"success": False, "error": f"No se encontraron resultados para: {query}"}

            # Step 2: Extract & Analyze
            # Limitamos para no saturar si hay muchas categorías
            items_to_process = total_results[:max_sites + 2]
            
            extracted_data = []
            for item in items_to_process:
                res = extract_one(client, item["url"], query, item["snippet"])
                if res:
                    res["category"] = item["category"]
                    extracted_data.append(res)

            extracted_data.sort(key=lambda x: x["relevance"], reverse=True)
            final_selection = extracted_data[:max_sites]

            return {
                "success": True,
                "type": "mid_point_research",
                "query": query,
                "categories_used": categories,
                "extracted_sources": final_selection,
                "summary": f"Análisis completado en {len(final_selection)} fuentes de categorías: {', '.join(categories)}."
            }
    except Exception as e:
        return {"success": False, "error": f"Error en web_research: {str(e)}"}

if __name__ == "__main__":
    try:
        args = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
        query = args.get('query')
        max_sites = args.get('max_sites', 3)
        categories = args.get('categories', ['general'])
        if not query:
            sys.exit(1)
        output = web_research(query, max_sites, categories)
        sys.stdout.write(json.dumps(output, ensure_ascii=False) + "\n")
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
