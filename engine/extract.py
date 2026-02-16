import sys
import json
import io
import trafilatura

# Force UTF-8 encoding
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def extract_url(url):
    try:
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            return {"success": False, "error": f"Failed to fetch content from {url}"}
            
        result = trafilatura.extract(downloaded, include_links=False, include_comments=False, include_tables=True)
        
        if not result:
            return {"success": False, "error": f"No readable content found at {url}"}
            
        return {
            "success": True,
            "url": url,
            "content": result,
            "raw_text": result # For compatibility
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No URL provided"}))
        sys.exit(1)
        
    url = sys.argv[1]
    output = extract_url(url)
    sys.stdout.write(json.dumps(output, ensure_ascii=False) + "\n")
