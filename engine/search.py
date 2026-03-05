import sys
import json
import io
import requests

# Force UTF-8 encoding
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def search(query):
    try:
        # SearXNG local instance (started by Electron)
        url = "http://127.0.0.1:8888/search"
        params = {
            "q": query,
            "format": "json",
            "language": "es-ES"
        }
        
        # Increase timeout as local SearXNG might take a moment to aggregate results
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        
        data = response.json()
        raw_results = data.get("results", [])
        
        scored_results = []
        for r in raw_results:
            # SearXNG results come with 'title', 'url', 'content', 'score', etc.
            scored_results.append({
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "content": r.get("content", ""),
                "relevance_score": r.get("score", 0)
            })
            
        # Sort by relevance score just in case, though SearXNG usually handles this
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
            "error": f"SearXNG Error: {str(e)}"
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No query provided"}))
        sys.exit(1)
        
    query = sys.argv[1]
    output = search(query)
    sys.stdout.write(json.dumps(output, ensure_ascii=False) + "\n")
