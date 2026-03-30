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
    "strategy": "auto",
    "source": "workSpace"
  }
}
```

## [undo_patch]
```json
{
  "name": "undo_patch",
  "arguments": {
    "filename": "archivo.js",
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

## [get_file_outline]
```json
{
  "name": "get_file_outline",
  "arguments": {
    "filename": "src/main.ts",
    "source": "workSpace"
  }
}
```

## [batch_operation]
```json
{
  "name": "batch_operation",
  "arguments": {
    "operation": "copy",
    "source_path": "temp_logs",
    "destination_path": "backup_logs",
    "pattern": "*.log"
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

## [web_research]
```json
{
  "name": "web_research",
  "arguments": {
    "query": "Investigación sobre la arquitectura de microfrontends",
    "max_sites": 3
  }
}
```

## [deep_research]
```json
{
  "name": "deep_research",
  "arguments": {
    "topic": "avances en reactores de fusión nuclear 2024",
    "target_language": "both"
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

## [add_scheduled_task]
```json
{
  "name": "add_scheduled_task",
  "arguments": {
    "name": "Check Bitcoin Price",
    "prompt": "Usa get_crypto_price para bitcoin y dime si subió de 90k.",
    "scheduleType": "interval",
    "schedule": "60",
    "channel": "both",
    "mode": "agent"
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

## [list_available_skills]
```json
{
  "name": "list_available_skills",
  "arguments": {}
}
```

## [gmail_imap]
```json
{
  "name": "gmail_imap",
  "arguments": {
    "email": "tu_correo@gmail.com",
    "app_password": "abcd efgh ijkl mnop",
    "action": "list",
    "limit": 5
  }
}
```

## [delete_file]
```json
{
  "name": "delete_file",
  "arguments": {
    "filename": "temp_plan.md",
    "source": "workSpace"
  }
}
```

## [api_fetcher]
```json
{
  "name": "api_fetcher",
  "arguments": {
    "url": "https://api.example.com/v1/user",
    "method": "POST",
    "body": { "id": 123 },
    "headers": { "Authorization": "Bearer TOKEN" }
  }
}
```

## [get_system_metrics]
```json
{
  "name": "get_system_metrics",
  "arguments": {}
}
```

## [get_git_info]
```json
{
  "name": "get_git_info",
  "arguments": {}
}
```
