#!/usr/bin/env python3
"""Skill: HTTP Request - Realiza solicitudes HTTP"""

import json
import sys
import io
import requests

# Force UTF-8 encoding in stdout for Windows compatibility
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


def http_request(url: str, method: str = "GET", headers: dict = None, 
                 data: dict = None, timeout: int = 30) -> dict:
    """
    Realiza una solicitud HTTP.
    
    Args:
        url: URL a consultar
        method: Método HTTP
        headers: Headers personalizados
        data: Datos a enviar
        timeout: Timeout en segundos
    
    Returns:
        Dict con respuesta
    """
    try:
        # Validar URL
        if not url.startswith(("http://", "https://")):
            return {
                "success": False,
                "error": "URL debe comenzar con http:// o https://"
            }
        
        # Preparar headers
        if headers is None:
            headers = {}
        
        # Preparar método
        method = method.upper()
        
        # Realizar solicitud
        if method == "GET":
            response = requests.get(url, headers=headers, timeout=timeout)
        elif method == "POST":
            response = requests.post(url, json=data, headers=headers, timeout=timeout)
        elif method == "PUT":
            response = requests.put(url, json=data, headers=headers, timeout=timeout)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers, timeout=timeout)
        elif method == "PATCH":
            response = requests.patch(url, json=data, headers=headers, timeout=timeout)
        else:
            return {
                "success": False,
                "error": f"Método no soportado: {method}"
            }
        
        # Intentar parsear como JSON
        try:
            body = response.json()
        except:
            body = response.text[:1000]  # Primeros 1000 caracteres
        
        return {
            "success": True,
            "url": url,
            "method": method,
            "status_code": response.status_code,
            "status_text": f"{response.status_code} {response.reason}",
            "headers": dict(response.headers),
            "body": body,
            "response_time_ms": round(response.elapsed.total_seconds() * 1000)
        }
    
    except requests.exceptions.Timeout:
        return {
            "success": False,
            "error": f"Timeout después de {timeout} segundos",
            "url": url
        }
    except requests.exceptions.ConnectionError as e:
        return {
            "success": False,
            "error": f"Error de conexión: {str(e)}",
            "url": url
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__,
            "url": url
        }


if __name__ == "__main__":
    try:
        args = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
        result = http_request(**args)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }))
