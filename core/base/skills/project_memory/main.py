#!/usr/bin/env python3
"""Skill: Project Memory - Guarda información persistente del proyecto"""

import json
import sys
from pathlib import Path
from datetime import datetime


def project_memory(action: str, key: str = None, content: str = None, path: str = "./") -> dict:
    """
    Gestiona memoria persistente del proyecto.
    
    Args:
        action: Acción (save, load, list, delete)
        key: Clave de la memoria
        content: Contenido a guardar
        path: Ruta del proyecto
    
    Returns:
        Dict con resultado
    """
    try:
        project_path = Path(path).expanduser()
        memory_dir = project_path / ".miku"
        memory_file = memory_dir / "memory.json"
        
        # Crear directorio si no existe (para guardar)
        if action == "save":
            memory_dir.mkdir(parents=True, exist_ok=True)
        
        # Cargar memoria existente
        if memory_file.exists():
            with open(memory_file, 'r', encoding='utf-8') as f:
                memory = json.load(f)
        else:
            memory = {"entries": []}
        
        if action == "save":
            if not key:
                return {
                    "success": False,
                    "error": "Se requiere 'key' para guardar memoria"
                }
            
            # Agregar o actualizar entrada
            entry = {
                "key": key,
                "content": content,
                "timestamp": datetime.now().isoformat()
            }
            
            # Buscar si existe la clave
            for i, e in enumerate(memory["entries"]):
                if e.get("key") == key:
                    memory["entries"][i] = entry
                    break
            else:
                memory["entries"].append(entry)
            
            # Guardar
            with open(memory_file, 'w', encoding='utf-8') as f:
                json.dump(memory, f, ensure_ascii=False, indent=2)
            
            return {
                "success": True,
                "action": "save",
                "key": key,
                "memory_file": str(memory_file),
                "timestamp": entry["timestamp"]
            }
        
        elif action == "load":
            if not key:
                return {
                    "success": False,
                    "error": "Se requiere 'key' para cargar memoria"
                }
            
            for entry in memory["entries"]:
                if entry.get("key") == key:
                    return {
                        "success": True,
                        "action": "load",
                        "key": key,
                        "content": entry["content"],
                        "timestamp": entry["timestamp"]
                    }
            
            return {
                "success": False,
                "action": "load",
                "error": f"Clave no encontrada: {key}"
            }
        
        elif action == "list":
            return {
                "success": True,
                "action": "list",
                "memory_count": len(memory["entries"]),
                "entries": [
                    {
                        "key": e.get("key"),
                        "timestamp": e.get("timestamp"),
                        "preview": e.get("content", "")[:100] + "..." if len(e.get("content", "")) > 100 else e.get("content", "")
                    }
                    for e in memory["entries"]
                ]
            }
        
        elif action == "delete":
            if not key:
                return {
                    "success": False,
                    "error": "Se requiere 'key' para borrar memoria"
                }
            
            initial_count = len(memory["entries"])
            memory["entries"] = [e for e in memory["entries"] if e.get("key") != key]
            
            if len(memory["entries"]) < initial_count:
                with open(memory_file, 'w', encoding='utf-8') as f:
                    json.dump(memory, f, ensure_ascii=False, indent=2)
                
                return {
                    "success": True,
                    "action": "delete",
                    "key": key
                }
            else:
                return {
                    "success": False,
                    "action": "delete",
                    "error": f"Clave no encontrada: {key}"
                }
        
        else:
            return {
                "success": False,
                "error": f"Acción no soportada: {action}. Use 'save', 'load', 'list' o 'delete'"
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
        result = project_memory(**args)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }))
