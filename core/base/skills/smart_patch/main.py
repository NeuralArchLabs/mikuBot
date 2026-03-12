#!/usr/bin/env python3
"""Skill: Smart Patch - Edición quirúrgica de archivos"""

import json
import sys
import io
import shutil
from pathlib import Path
from datetime import datetime

# Force UTF-8 encoding in stdout for Windows compatibility
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


def smart_patch(path: str, find: str, replace: str, create_backup: bool = True) -> dict:
    """
    Reemplaza un bloque exacto de texto en un archivo.
    
    Args:
        path: Ruta del archivo
        find: Bloque exacto a buscar
        replace: Texto de reemplazo
        create_backup: Crear backup antes de cambiar
    
    Returns:
        Dict con resultado de la operación
    """
    try:
        filepath = Path(path).expanduser()
        
        if not filepath.exists():
            return {
                "success": False,
                "error": f"Archivo no encontrado: {path}"
            }
        
        # Leer contenido actual
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Verificar que el bloque a encontrar existe
        if find not in content:
            return {
                "success": False,
                "error": "El bloque a buscar no se encontró en el archivo",
                "find_snippet": find[:100] + "..." if len(find) > 100 else find
            }
        
        # Crear backup si se solicita
        backup_info = None
        if create_backup:
            backup_path = Path(str(filepath) + '.bak')
            shutil.copy2(filepath, backup_path)
            backup_info = {
                "backup_path": str(backup_path),
                "timestamp": datetime.now().isoformat()
            }
        
        # Realizar reemplazo
        new_content = content.replace(find, replace, 1)  # Reemplazar solo la primera ocurrencia
        
        # Escribir nuevo contenido
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        return {
            "success": True,
            "path": str(filepath),
            "changes_made": 1,
            "bytes_changed": len(replace.encode('utf-8')) - len(find.encode('utf-8')),
            "backup": backup_info
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
        result = smart_patch(**args)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }))
