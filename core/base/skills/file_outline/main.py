#!/usr/bin/env python3
"""Skill: File Outline - Extrae estructura de archivos"""

import json
import sys
import io
import re
from pathlib import Path

# Force UTF-8 encoding in stdout for Windows compatibility
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


LANGUAGE_PATTERNS = {
    "python": {
        "extensions": [".py"],
        "class": r"^class\s+(\w+)(?:\(.*?\))?:",
        "function": r"^def\s+(\w+)\s*\(",
        "async_function": r"^async\s+def\s+(\w+)\s*\("
    },
    "javascript": {
        "extensions": [".js", ".jsx"],
        "class": r"class\s+(\w+)(?:\s+extends\s+\w+)?[\s{]",
        "function": r"function\s+(\w+)\s*\(",
        "arrow": r"const\s+(\w+)\s*=\s*(?:async\s*)?\(",
        "method": r"(\w+)\s*:\s*(?:async\s*)?function"
    },
    "typescript": {
        "extensions": [".ts", ".tsx"],
        "interface": r"interface\s+(\w+)",
        "type": r"type\s+(\w+)\s*=",
        "class": r"class\s+(\w+)(?:\s+extends\s+\w+)?[\s{]",
        "function": r"function\s+(\w+)\s*\(",
        "method": r"(\w+)\s*:\s*(?:async\s*)?\("
    },
    "java": {
        "extensions": [".java"],
        "class": r"(?:public\s+)?class\s+(\w+)",
        "method": r"(?:public|private|protected)?\s*(?:static\s*)?(?:\w+\s+)*(\w+)\s*\(",
        "interface": r"interface\s+(\w+)"
    },
    "cpp": {
        "extensions": [".cpp", ".h", ".hpp"],
        "class": r"class\s+(\w+)",
        "struct": r"struct\s+(\w+)",
        "function": r"(?:[\w:*&\s]+)\s+(\w+)\s*\("
    }
}


def detect_language(filepath: str) -> str:
    """Detecta lenguaje por extensión"""
    ext = Path(filepath).suffix.lower()
    for lang, config in LANGUAGE_PATTERNS.items():
        if ext in config.get("extensions", []):
            return lang
    return "unknown"


def extract_outline(path: str, language: str = None) -> dict:
    """
    Extrae estructura de un archivo.
    
    Args:
        path: Ruta del archivo
        language: Lenguaje (auto-detecta si no se especifica)
    
    Returns:
        Dict con estructura del archivo
    """
    try:
        filepath = Path(path).expanduser()
        
        if not filepath.exists():
            return {
                "success": False,
                "error": f"Archivo no encontrado: {path}"
            }
        
        if not filepath.is_file():
            return {
                "success": False,
                "error": f"No es un archivo: {path}"
            }
        
        # Detectar lenguaje
        if not language:
            language = detect_language(str(filepath))
        
        language_config = LANGUAGE_PATTERNS.get(language, {})
        
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        
        outline = {
            "classes": [],
            "functions": [],
            "methods": [],
            "interfaces": [],
            "types": [],
            "structs": []
        }
        
        for line_num, line in enumerate(lines, 1):
            line_stripped = line.strip()
            
            # Buscar patrones
            for pattern_type, pattern in language_config.items():
                if pattern_type in ["extensions"]:
                    continue
                
                match = re.search(pattern, line)
                if match:
                    name = match.group(1)
                    item = {
                        "name": name,
                        "line": line_num,
                        "preview": line_stripped[:80]
                    }
                    
                    if pattern_type == "class":
                        outline["classes"].append(item)
                    elif pattern_type in ["function", "async_function"]:
                        outline["functions"].append(item)
                    elif pattern_type == "method":
                        outline["methods"].append(item)
                    elif pattern_type == "interface":
                        outline["interfaces"].append(item)
                    elif pattern_type == "type":
                        outline["types"].append(item)
                    elif pattern_type == "struct":
                        outline["structs"].append(item)
        
        # Limpiar items vacíos
        outline = {k: v for k, v in outline.items() if v}
        
        total_items = sum(len(v) for v in outline.values())
        
        return {
            "success": True,
            "path": str(filepath),
            "language": language,
            "total_lines": len(lines),
            "total_symbols": total_items,
            "outline": outline
        }
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }


if __name__ == "__main__":
    try:
        args = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
        result = extract_outline(**args)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }))
