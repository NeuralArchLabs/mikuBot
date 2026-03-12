# searXena AI Integration Guide

Esta guía documenta cómo los Modelos de Inteligencia Artificial (LLMs, Agentes, Asistentes de Código) pueden interactuar con **searXena** de manera nativa mediante herramientas (Tool Calling) y su API en formato JSON.

## Endpoints Disponibles

searXena provee dos nuevos endpoints bajo la ruta `/api/v1/` diseñados estrictamente para respuestas estructuradas sin componentes de Front-End (HTML/CSS):

### 1. Obtener el Esquema de Herramienta (`GET /api/v1/tools_schema`)

Devuelve un objeto JSON alineado a los estándares de OpenAI, Anthropic y Gemini para la definición de funciones.

**Uso de ejemplo:**
```bash
curl -X GET http://localhost:8000/api/v1/tools_schema
```

### 2. Ejecutar la Búsqueda Estructurada (`POST /api/v1/search`)

Este es el endpoint donde el LLM enviará su "Tool Call". Devuelve un objeto con los resultados y metadatos de contexto.

**Headers:** `Content-Type: application/json`

**Cuerpo de la Petición:**

| Parámetro         | Tipo       | Requerido | Descripción |
|-------------------|------------|-----------|-------------|
| `query`           | `string`   | **Sí**    | La consulta o pregunta a buscar. |
| `category`        | `string`   | No        | `general` (default), `it`, `news`, `shopping`, `images`, `videos`. |
| `pageno`          | `integer`  | No        | Número de página. Default `1`. |
| `language`        | `string`   | No        | ISO code: `es`, `en`, `it`, `fr`, `de`, `zh`, `pt`, `ja`. |
| `include_engines` | `string[]` | No        | Lista blanca de motores (ej. `["google", "duckduckgo"]`). |
| `exclude_engines` | `string[]` | No        | Lista negra de motores. |
| `limit`           | `integer`  | No        | Máximo de resultados. Default `10`. |

**Ejemplo de Respuesta Estructurada:**
```json
{
  "results": [
    {
      "title": "What's New In Python 3.12",
      "url": "https://docs.python.org/3/whatsnew/3.12.html",
      "content": "This article explains the new features in Python 3.12...",
      "source": "google"
    }
  ],
  "meta": {
    "total_found": 35,
    "limit_applied": 1,
    "has_more": true,
    "suggestion": "Hay 35 resultados en total. Estás viendo 1. Para ver más, aumenta el parámetro 'limit'."
  }
}
```

## Recomendaciones para Agentes (System Prompt)

Para optimizar el uso de searXena, instruye a tu modelo con lo siguiente:

1.  **Prioriza Consultas Simples:** Envía solo el campo `query` si no hay necesidades especiales para ahorrar latencia.
2.  **Uso de Categorías:** Usa `category: "it"` para temas técnicos y `category: "shopping"` para productos.
3.  **Gestión de Contexto (Metadata):** Observa la propiedad `meta.has_more`. Si necesitas profundizar, re-lanza la búsqueda aumentando el `limit`.
4.  **Lógica de Ranking Unificada:** searXena filtra automáticamente el ruido. En la categoría `it`, se priorizan fuentes de alta curación (**HackerNews, Wikipedia, StackOverflow**) y se ocultan repositorios vacíos o PDFs densos de ArXiv/GitHub/NPM.
5.  **Respuestas Directas:** Los "Infoboxes" aparecen como el primer elemento en categorías generales. Úsalos como respuesta prioritaria.

## Integración Rápida (Python)

```python
import httpx

def search_ai(query: str, category: str = "general", limit: int = 10, language: str = None):
    url = "http://localhost:8000/api/v1/search"
    payload = {"query": query, "category": category, "limit": limit, "language": language}
    return httpx.post(url, json=payload).json()

# Ejemplo: Búsqueda técnica curada en inglés
results = search_ai("FastAPI async patterns", category="it", language="en")
print(f"Top Result: {results['results'][0]['title']}")
```
