#!/usr/bin/env python3
"""Skill: Get Project Tree - Genera árbol del proyecto"""

import json
import sys
import io
from pathlib import Path
from fnmatch import fnmatch

# Force UTF-8 encoding in stdout for Windows compatibility
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


def get_project_tree(path: str = "./", depth: int = 3, max_items: int = 50,
                    ignore_patterns: list = None) -> dict:
    """
    Genera árbol del proyecto.
    
    Args:
        path: Ruta raíz
        depth: Profundidad máxima
        max_items: Máximo de items por nivel
        ignore_patterns: Patrones a ignorar
    
    Returns:
        Dict con estructura del árbol
    """
    try:
        if ignore_patterns is None:
            ignore_patterns = [".git", "node_modules", "__pycache__", ".venv", "dist", "build"]
        
        dirpath = Path(path).expanduser()
        
        if not dirpath.exists() or not dirpath.is_dir():
            return {
                "success": False,
                "error": f"Directorio no válido: {path}"
            }
        
        def build_tree(p: Path, current_depth: int = 0) -> dict:
            """Construye árbol recursivamente"""
            if current_depth > depth:
                return None
            
            tree = {
                "name": p.name,
                "type": "directory",
                "children": []
            }
            
            try:
                items = sorted(p.iterdir())
                count = 0
                
                for item in items:
                    # Verificar patrones ignorados
                    if any(fnmatch(item.name, pattern) for pattern in ignore_patterns):
                        continue
                    
                    if count >= max_items:
                        tree["children"].append({"name": f"... y {len(items) - count} más"})
                        break
                    
                    if item.is_dir():
                        subtree = build_tree(item, current_depth + 1)
                        if subtree:
                            tree["children"].append(subtree)
                    else:
                        tree["children"].append({
                            "name": item.name,
                            "type": "file",
                            "size": item.stat().st_size
                        })
                    
                    count += 1
            
            except PermissionError:
                pass
            
            return tree
        
        tree = build_tree(dirpath)
        
        def tree_to_string(node, prefix="") -> str:
            """Convierte árbol a string visual"""
            lines = []
            if prefix == "":
                lines.append(node["name"] + "/")
            
            if "children" in node:
                for i, child in enumerate(node["children"]):
                    is_last = (i == len(node["children"]) - 1)
                    current = "└── " if is_last else "├── "
                    next_prefix = prefix + ("    " if is_last else "│   ")
                    
                    if "children" in child:
                        lines.append(prefix + current + child["name"] + "/")
                        lines.extend(tree_to_string(child, next_prefix).split('\n')[1:])
                    else:
                        lines.append(prefix + current + child["name"])
            
            return '\n'.join(lines)
        
        return {
            "success": True,
            "path": str(dirpath),
            "depth": depth,
            "tree": tree,
            "tree_string": tree_to_string(tree)
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
        result = get_project_tree(**args)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }))
