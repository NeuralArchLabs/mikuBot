#!/usr/bin/env python3
"""Skill: List Files - Lista archivos y directorios"""

import json
import sys
import io
from pathlib import Path
from fnmatch import fnmatch

# Force UTF-8 encoding in stdout for Windows compatibility
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


def list_files(path: str = "./", recursive: bool = False, pattern: str = None) -> dict:
    """
    Lista archivos y directorios.
    
    Args:
        path: Ruta del directorio
        recursive: Listar recursivamente
        pattern: Filtro de patrón (ej: *.py)
    
    Returns:
        Dict con lista de archivos
    """
    try:
        dirpath = Path(path).expanduser()
        
        if not dirpath.exists():
            return {
                "success": False,
                "error": f"Directorio no encontrado: {path}"
            }
        
        if not dirpath.is_dir():
            return {
                "success": False,
                "error": f"La ruta no es un directorio: {path}"
            }
        
        files = []
        directories = []
        
        if recursive:
            items = sorted(dirpath.rglob('*'))
        else:
            items = sorted(dirpath.iterdir())
        
        for item in items:
            # Filtrar por patrón si se especifica
            if pattern and not fnmatch(item.name, pattern):
                continue
            
            item_info = {
                "name": item.name,
                "path": str(item.relative_to(dirpath)),
                "type": "directory" if item.is_dir() else "file"
            }
            
            if item.is_file():
                item_info["size"] = item.stat().st_size
                files.append(item_info)
            else:
                directories.append(item_info)
        
        return {
            "success": True,
            "path": str(dirpath),
            "recursive": recursive,
            "pattern": pattern,
            "directories": directories,
            "files": files,
            "total_items": len(files) + len(directories)
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
        result = list_files(**args)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }))
