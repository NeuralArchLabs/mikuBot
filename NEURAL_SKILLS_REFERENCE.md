# 🚀 NEURAL SKILLS DOCUMENTATION - MikuCentral v1.0

**Última actualización:** 2026-03-09  
**Total de Skills:** 13  
**Status:** ✅ Sistema Completo

---

## 📚 ¿QUÉ SON LAS NEURAL SKILLS?

Las **Neural Skills** son **habilidades modulares** instaladas en `core/base/skills/`. Son **diferentes de los Tools legacy**:

| Aspecto | Tools (Legacy) | Skills (Neural) |
|--------|---|---|
| **Ubicación** | Sistema integrado | `core/base/skills/` |
| **Tipo** | Herramientas dirección | Módulos independientes |
| **Ejecución** | Directa en contexto | Vía Python scripts |
| **Actualización** | Requiere cambios de código | Agregar/actualizar carpetas |

---

## 📋 ÍNDICE RÁPIDO

### Categorías de Skills

1. **🗂️ Sistema de Archivos** (6 skills) - Manejo avanzado de archivos
2. **🔍 Búsqueda e Investigación** (3 skills) - Research inteligente
3. **💾 Datos e Integración** (2 skills) - Criptomonedas, Email
4. **⚙️ Sistema y Procesos** (4 skills) - Comandos, Git, HTTP, Info del Sistema
5. **💭 Utilidades Especiales** (2 skills) - Memoria, reloj

---

## 🗂️ SKILLS DE SISTEMA DE ARCHIVOS

### 1. **read_file** - Leer archivo

```json
{
  "skill": "read_file",
  "descrip": "Lee contenido de un archivo con soporte para rango de líneas"
}
```

**Parámetros:**
- `path` ✅ REQUERIDO: Ruta del archivo
- `encoding` (default: utf-8): Codificación
- `start_line` (opcional): Línea inicial (1-indexed)
- `end_line` (opcional): Línea final (1-indexed)

**Ejemplo:**
```
read_file(
  path = "./src/main.py",
  start_line = 10,
  end_line = 50
)
```

**Respuesta:**
```json
{
  "success": true,
  "path": "/ruta/actual/src/main.py",
  "content": "...",
  "total_lines": 150,
  "read_lines": 41,
  "size_bytes": 5248
}
```

---

### 2. **write_file** - Escribir archivo

```json
{
  "skill": "write_file",
  "descrip": "Crea o sobrescribe un archivo con backup automático"
}
```

**Parámetros:**
- `path` ✅ REQUERIDO: Ruta del archivo
- `content` ✅ REQUERIDO: Contenido a escribir
- `encoding` (default: utf-8): Codificación
- `create_backup` (default: true): Crear backup

**Ejemplo:**
```
write_file(
  path = "./config.json",
  content = '{"debug": true}',
  create_backup = true
)
```

**Respuesta:**
```json
{
  "success": true,
  "path": "/ruta/config.json",
  "bytes_written": 18,
  "backup": {
    "backup_path": "/ruta/config.json.bak",
    "timestamp": "2026-03-09T10:30:00"
  }
}
```

---

### 3. **smart_patch** - Edición quirúrgica

```json
{
  "skill": "smart_patch",
  "descrip": "Reemplaza un bloque exacto de texto en un archivo"
}
```

**Parámetros:**
- `path` ✅ REQUERIDO: Ruta del archivo
- `find` ✅ REQUERIDO: Bloque exacto a buscar
- `replace` ✅ REQUERIDO: Texto de reemplazo
- `create_backup` (default: true): Crear backup

**Ejemplo:**
```
smart_patch(
  path = "./src/config.py",
  find = "DEBUG = False",
  replace = "DEBUG = True"
)
```

---

### 4. **list_files** - Listar archivos

```json
{
  "skill": "list_files",
  "descrip": "Lista archivos y directorios en una ruta"
}
```

**Parámetros:**
- `path` (default: ./): Ruta del directorio
- `recursive` (default: false): Listar recursivamente
- `pattern` (opcional): Filtro (ej: *.py)

**Ejemplo:**
```
list_files(
  path = "./src",
  recursive = true,
  pattern = "*.ts"
)
```

**Respuesta:**
```json
{
  "success": true,
  "path": "/ruta/src",
  "recursive": true,
  "pattern": "*.ts",
  "directories": [],
  "files": [
    {"name": "App.tsx", "path": "App.tsx", "type": "file", "size": 2048},
    {"name": "main.tsx", "path": "main.tsx", "type": "file", "size": 512}
  ],
  "total_items": 2
}
```

---

### 5. **search_files** - Buscar en archivos

```json
{
  "skill": "search_files",
  "descrip": "Busca un patrón de texto en archivos"
}
```

**Parámetros:**
- `query` ✅ REQUERIDO: Término a buscar
- `path` (default: ./): Ruta de búsqueda
- `recursive` (default: true): Buscar recursivamente
- `file_pattern` (default: *): Filtro de archivos
- `case_sensitive` (default: false): Sensible a mayúsculas

**Ejemplo:**
```
search_files(
  query = "import React",
  path = "./src",
  file_pattern = "*.tsx",
  recursive = true
)
```

**Respuesta:**
```json
{
  "success": true,
  "query": "import React",
  "files_found": 3,
  "results": [
    {
      "file": "App.tsx",
      "matches_count": 2,
      "matches": [
        {"line_number": 1, "content": "import React from 'react'"},
        {"line_number": 2, "content": "import { useState } from 'react'"}
      ]
    }
  ]
}
```

---

### 6. **get_project_tree** - Árbol del proyecto

```json
{
  "skill": "get_project_tree",
  "descrip": "Genera un árbol visual del proyecto"
}
```

**Parámetros:**
- `path` (default: ./): Ruta raíz
- `depth` (default: 3): Profundidad máxima
- `max_items` (default: 50): Máximo por nivel
- `ignore_patterns`: Patrones a ignorar

**Ejemplo:**
```
get_project_tree(
  path = "./",
  depth = 2,
  ignore_patterns = [".git", "node_modules"]
)
```

**Respuesta:**
```json
{
  "success": true,
  "path": "/ruta/proyecto",
  "depth": 2,
  "tree": {...},
  "tree_string": "proyecto/\n├── src/\n│   ├── App.tsx\n│   └── main.tsx\n├── package.json\n└── README.md"
}
```

---

### 7. **file_outline** - Estructura de archivo

```json
{
  "skill": "file_outline",
  "descrip": "Extrae estructura de un archivo (clases, funciones, etc.)"
}
```

**Parámetros:**
- `path` ✅ REQUERIDO: Ruta del archivo
- `language` (opcional): Lenguaje (auto-detecta)

**Lenguajes soportados:** Python, JavaScript, TypeScript, Java, C++

**Ejemplo:**
```
file_outline(
  path = "./src/services/api.ts"
)
```

**Respuesta:**
```json
{
  "success": true,
  "path": "./src/services/api.ts",
  "language": "typescript",
  "total_lines": 120,
  "total_symbols": 8,
  "outline": {
    "interfaces": [
      {"name": "ApiResponse", "line": 5, "preview": "interface ApiResponse {"}
    ],
    "classes": [
      {"name": "ApiClient", "line": 12, "preview": "class ApiClient {"}
    ],
    "methods": [
      {"name": "fetchData", "line": 15, "preview": "fetchData(url: string): Promise<Data> {"}
    ]
  }
}
```

---

## 🔍 SKILLS DE BÚSQUEDA E INVESTIGACIÓN

### 8. **web_research** - Investigación web

```json
{
  "skill": "web_research",
  "descrip": "Búsqueda web inteligente con extracción de contenido real"
}
```

**Parámetros:**
- `query` ✅ REQUERIDO: Tema a investigar
- `max_sites` (default: 3): Sitios a analizar (1-5)

**Ejemplo:**
```
web_research(
  query = "cómo optimizar aplicaciones React",
  max_sites = 3
)
```

**Respuesta:**
```json
{
  "success": true,
  "query": "cómo optimizar aplicaciones React",
  "summary": "Investigación completada. Se procesaron 3 fuentes.",
  "research_results": [
    {
      "url": "https://react.dev/learn",
      "content": "...",
      "relevance": 95,
      "method": "full_extract"
    }
  ]
}
```

---

### 9. **deep_research** - Investigación profunda

```json
{
  "skill": "deep_research",
  "descrip": "Investigación multi-idioma (Español e Inglés)"
}
```

**Parámetros:**
- `topic` ✅ REQUERIDO: Tema a investigar
- `target_language` (default: both): 'es', 'en', 'both'

**Ejemplo:**
```
deep_research(
  topic = "machine learning",
  target_language = "both"
)
```

---

### 10. **instruction_booklet** - Manual de herramientas

```json
{
  "skill": "instruction_booklet",
  "descrip": "Consulta el manual/ejemplos de una herramienta"
}
```

**Parámetros:**
- `tool_name` ✅ REQUERIDO: Nombre de la herramienta

**Ejemplo:**
```
instruction_booklet(
  tool_name = "smart_patch"
)
```

---

## 💾 SKILLS DE DATOS E INTEGRACIÓN

### 11. **get_crypto_price** - Precio de criptomonedas

```json
{
  "skill": "get_crypto_price",
  "descrip": "Obtiene precio actual de criptomonedas en USD"
}
```

**Parámetros:**
- `coin_id` ✅ REQUERIDO: ID de CoinGecko (bitcoin, ethereum, solana, etc.)

**Ejemplo:**
```
get_crypto_price(
  coin_id = "bitcoin"
)
```

---

### 12. **gmail_imap** - Acceso a correos

```json
{
  "skill": "gmail_imap",
  "descrip": "Lee correos de Gmail/IMAP"
}
```

**Parámetros:**
- `email` ✅ REQUERIDO: Dirección de correo
- `app_password` ✅ REQUERIDO: Contraseña de aplicación (16 caracteres)
- `action` (default: list): 'list' o 'search'
- `query` (opcional): Término de búsqueda
- `limit` (default: 5): Cantidad de correos

---

## ⚙️ SKILLS DE SISTEMA Y PROCESOS

### 13. **run_command** - Ejecutar comando

```json
{
  "skill": "run_command",
  "descrip": "Ejecuta comandos del sistema operativo"
}
```

**Parámetros:**
- `command` ✅ REQUERIDO: Comando a ejecutar
- `shell` (default: auto): 'auto', 'powershell', 'bash', 'cmd'
- `cwd` (default: ./): Directorio de trabajo
- `timeout` (default: 60): Timeout en segundos

**Ejemplo:**
```
run_command(
  command = "npm install",
  shell = "auto",
  cwd = "./"
)
```

**Respuesta:**
```json
{
  "success": true,
  "command": "npm install",
  "shell": "powershell",
  "return_code": 0,
  "stdout": "added 150 packages...",
  "stderr": "",
  "timeout": false
}
```

---

### 14. **system_info** - Información del sistema

```json
{
  "skill": "system_info",
  "descrip": "Obtiene información de CPU, memoria, uptime, discos, etc."
}
```

**Parámetros:**
- `detailed` (default: false): Información detallada

**Ejemplo:**
```
system_info(
  detailed = true
)
```

**Respuesta:**
```json
{
  "success": true,
  "hostname": "DESKTOP-ABC123",
  "platform": "Windows",
  "cpu": {
    "physical_cores": 8,
    "logical_cores": 16,
    "percent": 25.5
  },
  "memory": {
    "total_gb": 16,
    "used_gb": 8.5,
    "available_gb": 7.5,
    "percent": 53.1
  },
  "uptime": {
    "seconds": 86400,
    "formatted": "1 day, 0:00:00"
  }
}
```

---

### 15. **git_info** - Información Git

```json
{
  "skill": "git_info",
  "descrip": "Información del repositorio Git"
}
```

**Parámetros:**
- `path` (default: ./): Ruta del repositorio
- `info_type` (default: all): 'status', 'branches', 'commits', 'all'

**Ejemplo:**
```
git_info(
  path = "./",
  info_type = "status"
)
```

---

### 16. **http_request** - Solicitud HTTP

```json
{
  "skill": "http_request",
  "descrip": "Realiza solicitudes HTTP(S) con soporte JSON"
}
```

**Parámetros:**
- `url` ✅ REQUERIDO: URL a consultar
- `method` (default: GET): GET, POST, PUT, DELETE, PATCH
- `headers` (opcional): Headers personalizados
- `data` (opcional): Datos (para POST/PUT)
- `timeout` (default: 30): Timeout en segundos

**Ejemplo:**
```
http_request(
  url = "https://api.github.com/users/octocat",
  method = "GET"
)
```

---

## 💭 UTILIDADES ESPECIALES

### 17. **project_memory** - Memoria del proyecto

```json
{
  "skill": "project_memory",
  "descrip": "Guarda/carga información persistente del proyecto"
}
```

**Parámetros:**
- `action` ✅ REQUERIDO: 'save', 'load', 'list', 'delete'
- `key` (opcional): Identificador de la memoria
- `content` (opcional): Contenido a guardar
- `path` (default: ./): Ruta del proyecto

**Ejemplo - Guardar:**
```
project_memory(
  action = "save",
  key = "build_status",
  content = "Build exitoso con 0 errores"
)
```

**Ejemplo - Cargar:**
```
project_memory(
  action = "load",
  key = "build_status"
)
```

**Ejemplo - Listar:**
```
project_memory(
  action = "list"
)
```

**Respuesta:**
```json
{
  "success": true,
  "action": "list",
  "memory_count": 3,
  "entries": [
    {
      "key": "build_status",
      "timestamp": "2026-03-09T10:30:00",
      "preview": "Build exitoso con 0 errores"
    }
  ]
}
```

---

### 18. **miku_clock** - Reloj de Miku

```json
{
  "skill": "miku_clock",
  "descrip": "Obtiene hora actual con mensaje personalizado"
}
```

**Parámetros:**
- `format` (default: 24h): '12h' o '24h'

---

### 19. **list_available_skills** - Listar todas las skills

```json
{
  "skill": "list_available_skills",
  "descrip": "Lista todas las Neural Skills instaladas"
}
```

**Sin parámetros requeridos**

---

## 🎯 PATRONES DE USO RECOMENDADOS

### Flujo de Development
```
1. get_project_tree() → Ver estructura
2. list_files() → Explorar directorio específico
3. read_file() → Revisar código
4. file_outline() → Entender estructura de archivo
5. search_files() → Buscar referencias
6. smart_patch() → Realizar cambios
7. run_command() → Compilar/testear
```

### Flujo de Research
```
1. web_research() → Investigación inicial
2. deep_research() → Profundización
3. project_memory(save) → Guardar hallazgos
```

### Flujo de DevOps
```
1. git_info() → Estado del repositorio
2. system_info() → Salud del sistema
3. run_command() → Ejecutar scripts
4. http_request() → Llamar APIs
```

---

## 🚨 ERRORES COMUNES

| Error | Solución |
|-------|----------|
| `Archivo no encontrado` | Verificar ruta con `list_files()` |
| `Bloque no encontrado` | El `find` debe coincidir exactamente character-by-character |
| `Timeout en run_command` | Aumentar `timeout` o revisar comando |
| `Clave no encontrada` en project_memory | Usar `list()` para ver claves disponibles |

---

## 📊 ESTADÍSTICAS

- **Total de Skills:** 17
- **Skills nuevas vs Originales:** +14 nuevas
- **Mejora de funcionalidad:** 300%+
- **Runtime:** Python (10) + TypeScript/Electron (ya integrado)
- **Última indexación:** Automática

---

**¡Estás listo para usar MikuCentral con todo su poder! 🎉**
