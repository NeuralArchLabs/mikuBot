import sys
import json
import io
import re
import trafilatura
from duckduckgo_search import DDGS
from concurrent.futures import ThreadPoolExecutor

# Force UTF-8 encoding
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Context keywords for dynamic boosting
TECH_KEYWORDS = ["ai", "ia", "artificial intelligence", "model", "llm", "software", "api", "code", "programming", "google", "microsoft", "meta", "nvidia"]
FASHION_KEYWORDS = ["fashion", "runway", "clothing", "design", "vogue", "style", "brand", "boutique"]

def calculate_relevance(query, text):
    query_terms = set(re.findall(r'\w+', query.lower()))
    text_low = text.lower()
    
    score = 0
    # Term density score
    for term in query_terms:
        if term in text_low:
            score += text_low.count(term)
            
    # Explicit Domain Boost
    is_tech_query = any(t in query.lower() for t in TECH_KEYWORDS)
    is_fashion_query = any(f in query.lower() for f in FASHION_KEYWORDS)
    
    if is_tech_query:
        score += sum(1 for t in TECH_KEYWORDS if t in text_low) * 2
    if is_fashion_query:
        score += sum(1 for f in FASHION_KEYWORDS if f in text_low) * 2
        
    return score

def extract_one(url, query, snippet=""):
    try:
        downloaded = trafilatura.fetch_url(url)
        content = None
        if downloaded:
            content = trafilatura.extract(downloaded, include_links=False, include_comments=False, include_tables=True)
        
        # Fallback to snippet if extraction fails or is too short
        final_content = content if content and len(content) > 100 else snippet
        score = calculate_relevance(query, final_content)
        
        return {
            "url": url, 
            "content": (final_content[:2500] + "...") if len(final_content) > 2500 else final_content,
            "relevance": score,
            "method": "full_extract" if content and len(content) > 100 else "snippet_fallback"
        }
    except Exception as e:
        # Final fallback even on crash
        return {
            "url": url,
            "content": snippet,
            "relevance": calculate_relevance(query, snippet),
            "method": "error_fallback"
        }

def web_research(query, max_sites=3):
    try:
        with DDGS() as ddgs:
            # We fetch more to ensure we have valid items after DDGS internal filters
            search_results = [r for r in ddgs.text(query, max_results=12)]
            if not search_results:
                return {"success": False, "error": "Buscador no devolvió resultados. Intenta con palabras clave más simples."}

            # Map results to extraction with snippet fallback context
            items_to_process = []
            for r in search_results[:max_sites]:
                items_to_process.append({
                    "url": r.get("href"),
                    "snippet": r.get("body", "")
                })
            
            extracted_data = []
            if items_to_process:
                with ThreadPoolExecutor(max_workers=len(items_to_process)) as executor:
                    results = list(executor.map(lambda x: extract_one(x["url"], query, x["snippet"]), items_to_process))
                    extracted_data = [r for r in results if r is not None]

            # Re-rank extracted data
            extracted_data.sort(key=lambda x: x["relevance"], reverse=True)

            return {
                "success": True,
                "query": query,
                "summary": f"Investigación completada. Se procesaron {len(extracted_data)} fuentes.",
                "research_results": extracted_data
            }
    except Exception as e:
        return {"success": False, "error": f"Error en motor de investigación: {str(e)}"}

if __name__ == "__main__":
    try:
        args = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
        query = args.get('query')
        max_sites = args.get('max_sites', 3)
        
        if not query:
            print(json.dumps({"success": False, "error": "No query provided"}))
            sys.exit(1)
            
        output = web_research(query, max_sites)
        sys.stdout.write(json.dumps(output, ensure_ascii=False) + "\n")
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Fatal Skill Error: {str(e)}"}))
