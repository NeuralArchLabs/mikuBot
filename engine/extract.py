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
    Extracts text from a URL using internal O-ZEN engine (from searXena).
    Maintained for backward compatibility and web research tasks.
    """
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
    New logic for local file extraction.
    Supports PDF via PyMuPDF and common text formats via direct read.
    """
    try:
        if not os.path.exists(file_path):
            return {"success": False, "error": f"File not found: {file_path}"}
            
        ext = os.path.splitext(file_path)[1].lower()
        
        # 1. PDF Handling
        if ext == '.pdf':
            try:
                import fitz # PyMuPDF
                print(f"DEBUG: Opening PDF with PyMuPDF: {file_path}", file=sys.stderr)
                doc = fitz.open(file_path)
                text = ""
                for page in doc:
                    text += page.get_text()
                doc.close()
                print(f"DEBUG: Extraction success, length: {len(text)} chars", file=sys.stderr)
                return {
                    "success": True,
                    "path": file_path,
                    "content": text,
                    "type": "pdf"
                }
            except ImportError:
                return {"success": False, "error": "PyMuPDF (fitz) is not installed in the internal engine."}
            except Exception as e:
                return {"success": False, "error": f"PDF Extraction error: {str(e)}"}
        else:
            # Code/Text Handling
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
            return {
                "success": True,
                "path": file_path,
                "content": content,
                "type": "text"
            }
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
