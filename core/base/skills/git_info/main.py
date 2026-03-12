#!/usr/bin/env python3
"""Skill: Git Info - Obtiene información de repositorios Git"""

import json
import sys
import io
import subprocess
from pathlib import Path

# Force UTF-8 encoding in stdout for Windows compatibility
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


def run_git_command(cmd: list, cwd: str) -> str:
    """Ejecuta comando git y retorna output"""
    try:
        result = subprocess.run(
            ["git"] + cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.stdout.strip()
    except Exception as e:
        return f"Error: {str(e)}"


def git_info(path: str = "./", info_type: str = "all") -> dict:
    """
    Obtiene información Git.
    
    Args:
        path: Ruta del repositorio
        info_type: Tipo de información
    
    Returns:
        Dict con información Git
    """
    try:
        repo_path = Path(path).expanduser()
        
        if not repo_path.exists() or not repo_path.is_dir():
            return {
                "success": False,
                "error": f"Directorio no válido: {path}"
            }
        
        # Verificar que es un repositorio Git
        git_dir = repo_path / ".git"
        if not git_dir.exists():
            return {
                "success": False,
                "error": f"No es un repositorio Git: {path}"
            }
        
        result = {
            "success": True,
            "path": str(repo_path),
            "is_git_repo": True
        }
        
        # Status
        if info_type in ["status", "all"]:
            status = run_git_command(["status", "--porcelain"], str(repo_path))
            result["status"] = status
            
            # Rama actual
            current_branch = run_git_command(["rev-parse", "--abbrev-ref", "HEAD"], str(repo_path))
            result["current_branch"] = current_branch
        
        # Ramas
        if info_type in ["branches", "all"]:
            branches_output = run_git_command(["branch", "-a"], str(repo_path))
            branches = [line.strip().lstrip("* ") for line in branches_output.split("\n") if line.strip()]
            result["branches"] = branches
        
        # Commits
        if info_type in ["commits", "all"]:
            commits_output = run_git_command(
                ["log", "--oneline", "-10"],
                str(repo_path)
            )
            commits = []
            for line in commits_output.split("\n"):
                if line.strip():
                    parts = line.split(" ", 1)
                    commits.append({
                        "hash": parts[0],
                        "message": parts[1] if len(parts) > 1 else ""
                    })
            result["recent_commits"] = commits
            
            # Información general
            commit_count = run_git_command(["rev-list", "--count", "HEAD"], str(repo_path))
            result["total_commits"] = int(commit_count) if commit_count.isdigit() else 0
        
        return result
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }


if __name__ == "__main__":
    try:
        args = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
        result = git_info(**args)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }))
