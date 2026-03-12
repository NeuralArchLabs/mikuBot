#!/usr/bin/env python3
"""Skill: Run Command - Ejecuta comandos del sistema"""

import json
import sys
import io
import subprocess
import os
import platform
from pathlib import Path

# Force UTF-8 encoding in stdout for Windows compatibility
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


def run_command(command: str, shell: str = "auto", cwd: str = "./", timeout: int = 60) -> dict:
    """
    Ejecuta un comando del sistema.
    
    Args:
        command: Comando a ejecutar
        shell: Shell a usar
        cwd: Directorio de trabajo
        timeout: Timeout en segundos
    
    Returns:
        Dict con resultado de la ejecución
    """
    try:
        # Determinar shell automáticamente
        if shell == "auto":
            shell = "powershell" if platform.system() == "Windows" else "bash"
        
        # Convertir shell a comando
        shell_cmd = None
        if shell == "powershell":
            shell_cmd = ["powershell", "-NoProfile", "-Command"]
        elif shell == "cmd":
            shell_cmd = ["cmd", "/c"]
        elif shell in ["bash", "sh"]:
            shell_cmd = ["bash", "-c"]
        else:
            return {
                "success": False,
                "error": f"Shell no soportado: {shell}"
            }
        
        # Expandir ruta de trabajo
        work_dir = Path(cwd).expanduser()
        
        # Construir comando completo
        full_cmd = shell_cmd + [command]
        
        # Ejecutar comando
        process = subprocess.Popen(
            full_cmd,
            cwd=str(work_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        try:
            stdout, stderr = process.communicate(timeout=timeout if timeout > 0 else None)
            
            return {
                "success": True,
                "command": command,
                "shell": shell,
                "return_code": process.returncode,
                "stdout": stdout,
                "stderr": stderr,
                "timeout": False
            }
        
        except subprocess.TimeoutExpired:
            process.kill()
            return {
                "success": False,
                "command": command,
                "shell": shell,
                "error": f"Timeout después de {timeout} segundos",
                "timeout": True
            }
    
    except Exception as e:
        return {
            "success": False,
            "command": command,
            "error": str(e),
            "error_type": type(e).__name__
        }


if __name__ == "__main__":
    try:
        args = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
        result = run_command(**args)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }))
