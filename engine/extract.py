import sys
import json
import io
import os

# Force UTF-8 encoding
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Add searXena core to path for O-ZEN engine
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
zen_core_path = os.path.join(base_dir, 'engine', 'searXena', 'core')
if zen_core_path not in sys.path:
    sys.path.append(zen_core_path)

try:
    # O-ZEN engine is internal to searXena and performs high-fidelity extraction
    from ozen_engine import fetch_url, extract as ozen_extract
except ImportError:
    fetch_url = None
    ozen_extract = None

def extract_url(url):
    """
    Extracts text from a URL.
    Uses MarkItDown for YouTube URLs to retrieve transcripts.
    Otherwise, uses the internal O-ZEN engine.
    """
    # YouTube handling via MarkItDown
    if 'youtube.com' in url.lower() or 'youtu.be' in url.lower():
        try:
            from markitdown import MarkItDown
            print(f"DEBUG: Extracting YouTube transcript with MarkItDown: {url}", file=sys.stderr)
            md = MarkItDown()
            result = md.convert(url)
            print(f"DEBUG: YouTube Extraction success, length: {len(result.text_content)} chars", file=sys.stderr)
            return {
                "success": True,
                "url": url,
                "content": result.text_content,
                "raw_text": result.text_content
            }
        except Exception as e:
            return {"success": False, "error": f"YouTube transcription error: {str(e)}"}

    if not ozen_extract or not fetch_url:
        return {"success": False, "error": "Internal extraction engine (O-ZEN) not found in searXena core."}
    
    try:
        downloaded = fetch_url(url)
        if not downloaded:
            return {"success": False, "error": f"Failed to fetch content from {url}"}
            
        # O-ZEN extraction (replaces trafilatura)
        result = ozen_extract(downloaded)
        
        if not result:
            return {"success": False, "error": f"No readable content found at {url}"}
            
        return {
            "success": True,
            "url": url,
            "content": result,
            "raw_text": result
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

def extract_file(file_path):
    """
    Logic for local file extraction using MarkItDown with text fallback.
    """
    try:
        if not os.path.exists(file_path):
            return {"success": False, "error": f"File not found: {file_path}"}
            
        # First attempt: delegate to MarkItDown for any file type (handles pdf, docx, xlsx, pptx, txt, html, json, xml, zip, etc.)
        try:
            from markitdown import MarkItDown
            print(f"DEBUG: Extracting file with MarkItDown: {file_path}", file=sys.stderr)
            md = MarkItDown()
            result = md.convert(file_path)
            print(f"DEBUG: Extraction success, length: {len(result.text_content)} chars", file=sys.stderr)
            return {
                "success": True,
                "path": file_path,
                "content": result.text_content,
                "type": "markdown"
            }
        except Exception as e:
            # Fallback only for plain text files / source code files that markitdown might not convert directly
            _, ext = os.path.splitext(file_path.lower())
            text_extensions = {
                '.txt', '.md', '.markdown', '.json', '.xml', '.yaml', '.yml',
                '.js', '.ts', '.jsx', '.tsx', '.py', '.html', '.htm', '.css',
                '.csv', '.ini', '.cfg', '.conf', '.sh', '.bat', '.ps1', '.sql',
                '.log', '.diff', '.patch', '.r', '.c', '.cpp', '.h', '.hpp',
                '.java', '.go', '.rs', '.swift', '.kt', '.php', '.rb', '.pl'
            }
            if ext in text_extensions or not ext:
                print(f"DEBUG: MarkItDown failed or unsupported, using text fallback: {str(e)}", file=sys.stderr)
                with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read()
                return {
                    "success": True,
                    "path": file_path,
                    "content": content,
                    "type": "text"
                }
            else:
                print(f"DEBUG: MarkItDown failed on binary file {file_path}: {str(e)}", file=sys.stderr)
                return {"success": False, "error": f"MarkItDown failed to convert binary/document file ({ext}): {str(e)}"}
    except Exception as e:
        return {"success": False, "error": f"Error reading file {file_path}: {str(e)}"}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No input provided"}))
        sys.exit(1)
        
    input_data = sys.argv[1]
    
    # Simple smart dispatch: URLs start with http, Files are local paths
    if input_data.startswith(('http://', 'https://')):
        output = extract_url(input_data)
    else:
        output = extract_file(input_data)
        
    sys.stdout.write(json.dumps(output, ensure_ascii=False) + "\n")
