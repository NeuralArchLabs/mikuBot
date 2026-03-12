import sys
import json
import io
import requests

# Force UTF-8 encoding
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def search(query):
    try:
        # searXena local instance (Native Windows Engine)
        url = "http://127.0.0.1:8000/api/v1/search"
        payload = {
            "query": query,
            "limit": 10
        }
        
        # Native searXena uses POST with JSON payload
        response = requests.post(url, json=payload, timeout=15)
        response.raise_for_status()
        
        data = response.json()
        results = data.get("results", [])
        
        scored_results = []
        for r in results:
            # searXena returns 'title', 'url', 'content', and metadata
            scored_results.append({
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "content": r.get("content", ""),
                "relevance_score": 100 # searXena pre-ranks results
            })
                
        return {
            "success": True,
            "results": scored_results[:10],
            "count": len(scored_results),
            "original_query": query,
            "engine": "searXena"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"searXena Error: {str(e)}"
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No query provided"}))
        sys.exit(1)
        
    query = sys.argv[1]
    output = search(query)
    sys.stdout.write(json.dumps(output, ensure_ascii=False) + "\n")
