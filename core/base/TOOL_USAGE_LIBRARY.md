# 📚 Toolkit Snippets Library (Neural JIT)

Este archivo contiene fragmentos de código JSON válidos para cada herramienta. El sistema extrae estos bloques automáticamente cuando el agente comete errores de sintaxis o parámetros.

## [read_file]
```json
{
  "name": "read_file",
  "arguments": {
    "filename": "nombre_archivo.md",
    "source": "workSpace"
  }
}
```

## [update_file]
```json
{
  "name": "update_file",
  "arguments": {
    "filename": "ruta/nuevo_archivo.txt",
    "content": "Contenido completo del archivo aquí...",
    "source": "workSpace"
  }
}
```

## [patch_file]
```json
{
  "name": "patch_file",
  "arguments": {
    "filename": "archivo.js",
    "find": "bloque de texto exacto a buscar",
    "replace": "nuevo bloque de texto",
    "source": "workSpace"
  }
}
```

## [list_files]
```json
{
  "name": "list_files",
  "arguments": {
    "source": "workSpace"
  }
}
```

## [search_files]
```json
{
  "name": "search_files",
  "arguments": {
    "query": "patrón o texto a buscar",
    "source": "workSpace"
  }
}
```

## [web_search]
```json
{
  "name": "web_search",
  "arguments": {
    "query": "pregunta o término de búsqueda",
    "search_depth": "basic"
  }
}
```

## [read_url]
```json
{
  "name": "read_url",
  "arguments": {
    "url": "https://ejemplo.com/articulo"
  }
}
```

## [run_console]
```json
{
  "name": "run_console",
  "arguments": {
    "command": "npm",
    "args": "install package_name",
    "cwd": ""
  }
}
```

## [send_telegram_message]
```json
{
  "name": "send_telegram_message",
  "arguments": {
    "text": "Mensaje para enviar al bot",
    "chat_id": "opcional_id"
  }
}
```

## [final_answer]
```json
{
  "name": "final_answer",
  "arguments": {
    "text": "Respuesta final sintetizada...",
    "reasoning": "Breve explicación de los pasos seguidos.",
    "sources": ["archivo1.md", "https://url-usada.com"]
  }
}
```

## [get_crypto_price]
```json
{
  "name": "get_crypto_price",
  "arguments": {
    "coin_id": "bitcoin",
    "vs_currency": "usd"
  }
}
```

## [miku_clock]
```json
{
  "name": "miku_clock",
  "arguments": {
    "format": "24h"
  }
}
```
