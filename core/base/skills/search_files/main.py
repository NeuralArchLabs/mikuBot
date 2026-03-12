#!/usr/bin/env python3
"""Skill: Search Files - Busca patrones en archivos"""

import json
import sys
import io
from pathlib import Path
from fnmatch import fnmatch

# Force UTF-8 encoding in stdout for Windows compatibility
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


def search_files(query: str, path: str = "./", recursive: bool = True, 
                file_pattern: str = "*", case_sensitive: bool = False) -> dict:
    """
    Busca un patrón en archivos.
    
    Args:
        query: Término a buscar
        path: Ruta de búsqueda
        recursive: Buscar recursivamente
        file_pattern: Filtro de archivos
        case_sensitive: Sensible a mayúsculas
    
    Returns:
        Dict con resultados de búsqueda
    """
    try:
        dirpath = Path(path).expanduser()
        
        if not dirpath.exists() or not dirpath.is_dir():
            return {
                "success": False,
                "error": f"Directorio no válido: {path}"
            }
        
        results = []
        search_query = query if case_sensitive else query.lower()
        
        # Obtener archivos
        if recursive:
            items = list(dirpath.rglob('*'))
        else:
            items = list(dirpath.iterdir())
        
        # Filtrar por patrón y tipo
        files = [item for item in items if item.is_file() and fnmatch(item.name, file_pattern)]
        
        for filepath in files:
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    lines = f.readlines()
                
                matches = []
                for line_num, line in enumerate(lines, 1):
                    search_line = line if case_sensitive else line.lower()
                    if search_query in search_line:
                        matches.append({
                            "line_number": line_num,
                            "content": line.strip()[:100]  # Primeros 100 caracteres
                        })
                
                if matches:
                    results.append({
                        "file": str(filepath.relative_to(dirpath)),
                        "matches_count": len(matches),
                        "matches": matches[:5]  # Primeras 5 coincidencias
                    })
            
            except Exception:
                continue
        
        return {
            "success": True,
            "query": query,
            "path": str(dirpath),
            "recursive": recursive,
            "case_sensitive": case_sensitive,
            "files_found": len(results),
            "results": results[:20]  # Primeros 20 resultados
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
        result = search_files(**args)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }))
