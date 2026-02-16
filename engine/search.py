import sys
import json
import io
from duckduckgo_search import DDGS

# Force UTF-8 encoding for both stdin and stdout
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def search(query):
    try:
        with DDGS() as ddgs:
            # Get up to 10 results
            results = [r for r in ddgs.text(query, max_results=10)]
            
            formatted_results = []
            for r in results:
                formatted_results.append({
                    "title": r.get("title", ""),
                    "url": r.get("href", r.get("url", "")),
                    "content": r.get("body", r.get("snippet", ""))
                })
                
            return {
                "success": True,
                "results": formatted_results,
                "count": len(formatted_results)
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
    # Output only the pure JSON on a single line
    sys.stdout.write(json.dumps(output, ensure_ascii=False) + "\n")
