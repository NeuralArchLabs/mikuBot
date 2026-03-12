#!/usr/bin/env python3
"""Skill: Read File - Lee contenido de archivos con soporte para rango de líneas"""

import json
import sys
import io
import os
from pathlib import Path

# Force UTF-8 encoding in stdout for Windows compatibility
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


def read_file(path: str, encoding: str = "utf-8", start_line: int = None, end_line: int = None) -> dict:
    """
    Lee el contenido de un archivo.
    
    Args:
        path: Ruta del archivo
        encoding: Codificación (default: utf-8)
        start_line: Línea inicial (1-indexed)
        end_line: Línea final (1-indexed)
    
    Returns:
        Dict con contenido y metadata
    """
    try:
        filepath = Path(path).expanduser()
        
        if not filepath.exists():
            return {
                "success": False,
                "error": f"Archivo no encontrado: {path}",
                "path": str(filepath)
            }
        
        if not filepath.is_file():
            return {
                "success": False,
                "error": f"La ruta no es un archivo: {path}",
                "path": str(filepath)
            }
        
        with open(filepath, 'r', encoding=encoding) as f:
            lines = f.readlines()
        
        # Aplicar rango de líneas si se especifica
        if start_line or end_line:
            start = (start_line - 1) if start_line else 0
            end = end_line if end_line else len(lines)
            content = ''.join(lines[start:end])
            total_lines = len(lines)
            read_lines = len(lines[start:end])
        else:
            content = ''.join(lines)
            total_lines = len(lines)
            read_lines = total_lines
        
        return {
            "success": True,
            "path": str(filepath),
            "encoding": encoding,
            "content": content,
            "total_lines": total_lines,
            "read_lines": read_lines,
            "size_bytes": filepath.stat().st_size
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
        result = read_file(**args)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }))
