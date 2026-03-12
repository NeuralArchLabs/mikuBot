#!/usr/bin/env python3
"""Skill: Write File - Escribe archivos con backup automático"""

import json
import sys
import io
import os
import shutil
from pathlib import Path
from datetime import datetime

# Force UTF-8 encoding in stdout for Windows compatibility
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


def write_file(path: str, content: str, encoding: str = "utf-8", create_backup: bool = True) -> dict:
    """
    Escribe contenido en un archivo.
    
    Args:
        path: Ruta del archivo
        content: Contenido a escribir
        encoding: Codificación (default: utf-8)
        create_backup: Crear backup del archivo anterior
    
    Returns:
        Dict con resultado de la operación
    """
    try:
        filepath = Path(path).expanduser()
        
        # Crear directorios si no existen
        filepath.parent.mkdir(parents=True, exist_ok=True)
        
        backup_info = None
        
        # Crear backup si el archivo existe y se solicita
        if filepath.exists() and create_backup:
            backup_path = Path(str(filepath) + '.bak')
            shutil.copy2(filepath, backup_path)
            backup_info = {
                "backup_path": str(backup_path),
                "timestamp": datetime.now().isoformat()
            }
        
        # Escribir archivo
        with open(filepath, 'w', encoding=encoding) as f:
            f.write(content)
        
        return {
            "success": True,
            "path": str(filepath),
            "encoding": encoding,
            "bytes_written": len(content.encode(encoding)),
            "backup": backup_info if backup_info else None
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
        result = write_file(**args)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }))
