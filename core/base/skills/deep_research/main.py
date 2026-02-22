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
            
    # Domain Boost
    is_tech_query = any(t in query.lower() for t in TECH_KEYWORDS)
    if is_tech_query:
        score += sum(1 for t in TECH_KEYWORDS if t in text_low) * 2
        
    return score

def extract_one(url, query, snippet=""):
    try:
        downloaded = trafilatura.fetch_url(url)
        content = None
        if downloaded:
            content = trafilatura.extract(downloaded, include_links=False, include_comments=False, include_tables=True)
            
        final_content = content if content and len(content) > 100 else snippet
        score = calculate_relevance(query, final_content)
        return {
            "url": url, 
            "content": (final_content[:3000] + "...") if len(final_content) > 3000 else final_content,
            "relevance": score,
            "method": "full" if content and len(content) > 100 else "fallback"
        }
    except:
        return {"url": url, "content": snippet, "relevance": calculate_relevance(query, snippet), "method": "fail_fallback"}

def PerformResearch(query, count=3, lang="es"):
    try:
        with DDGS() as ddgs:
            # Optimized multi-language query
            q = query
            if lang == "en" and any(t in query.lower() for t in TECH_KEYWORDS):
                q = f"{query} documentation"
            
            raw_results = [r for r in ddgs.text(q, max_results=10)]
            if not raw_results: return []

            items = [{"url": r.get("href"), "snippet": r.get("body", "")} for r in raw_results[:count]]
            
            with ThreadPoolExecutor(max_workers=len(items)) as executor:
                results = list(executor.map(lambda x: extract_one(x["url"], query, x["snippet"]), items))
                extracted_data = [r for r in results if r is not None]
                
            extracted_data.sort(key=lambda x: x["relevance"], reverse=True)
            return extracted_data
    except Exception as e:
        return [{"url": "error", "content": f"Search failed: {str(e)}", "relevance": 0}]

def deep_research(topic, lang="both"):
    results = {}
    
    # Task 1: Spanish Research
    if lang in ["es", "both"]:
        results["spanish_sources"] = PerformResearch(topic, count=3, lang="es")
    
    # Task 2: English Research
    if lang in ["en", "both"]:
        results["english_sources"] = PerformResearch(topic, count=3, lang="en")

    return {
        "success": True,
        "topic": topic,
        "summary": "Investigación profunda completada con soporte de contingencia (snippet-fallback).",
        "data": results
    }

if __name__ == "__main__":
    try:
        args = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
        topic = args.get('topic')
        lang = args.get('target_language', 'both')
        
        if not topic:
            print(json.dumps({"success": False, "error": "No topic provided"}))
            sys.exit(1)
            
        output = deep_research(topic, lang)
        sys.stdout.write(json.dumps(output, ensure_ascii=False) + "\n")
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Fatal Deep Research Error: {str(e)}"}))
