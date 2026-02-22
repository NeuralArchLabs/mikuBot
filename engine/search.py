import sys
import json
import io
import re
from duckduckgo_search import DDGS

# Force UTF-8 encoding
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Technical keywords for context boosting
TECH_KEYWORDS = ["ai", "ia", "artificial intelligence", "model", "llm", "software", "api", "code", "programming", "google", "microsoft", "meta", "nvidia"]

def calculate_relevance(query, title, snippet):
    query_terms = set(re.findall(r'\w+', query.lower()))
    content_text = (title + " " + snippet).lower()
    content_terms = re.findall(r'\w+', content_text)
    
    score = 0
    # Base match: how many terms from the query are in the content?
    for term in query_terms:
        if term in content_text:
            score += content_text.count(term) * 2
            
    # Context boost: if query has tech terms, boost results with tech terms
    is_tech_query = any(t in query.lower() for t in TECH_KEYWORDS)
    if is_tech_query:
        tech_hits = sum(1 for t in TECH_KEYWORDS if t in content_text)
        score += tech_hits * 3
        
    return score

def search(query):
    try:
        # We don't use aggressive negative filters anymore
        # Instead, we fetch more and rank them
        with DDGS() as ddgs:
            raw_results = [r for r in ddgs.text(query, max_results=20)]
            
            scored_results = []
            for r in raw_results:
                title = r.get("title", "")
                snippet = r.get("body", r.get("snippet", ""))
                url = r.get("href", r.get("url", ""))
                
                score = calculate_relevance(query, title, snippet)
                
                scored_results.append({
                    "title": title,
                    "url": url,
                    "content": snippet,
                    "relevance_score": score
                })
            
            # Sort by relevance score (highest first)
            scored_results.sort(key=lambda x: x["relevance_score"], reverse=True)
                
            return {
                "success": True,
                "results": scored_results[:10],
                "count": len(scored_results[:10]),
                "original_query": query
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No query provided"}))
        sys.exit(1)
        
    query = sys.argv[1]
    output = search(query)
    sys.stdout.write(json.dumps(output, ensure_ascii=False) + "\n")
