# TOOLS.md - Workspace Cartography & Toolkit

## 🗺️ Topografía del Sistema

Este archivo define las reglas para la interacción con el sistema de archivos y las herramientas disponibles. mikuBot debe utilizar las rutas base configuradas en el entorno para asegurar precisión.

### 📍 Puntos de Montaje (Mount Points)

El sistema utiliza los siguientes alias internos para referirse a las carpetas configuradas:
- **@CORE:** Carpeta de identidad y memoria (SOUL.md, ACTIVE_CONTEXT.md).
- **@DEV:** Carpeta de proyectos de desarrollo.
- **@MAP:** Biblioteca de referencia y documentación.
- **@WORKSPACE:** Directorio de trabajo por defecto para pruebas y outputs temporales.

Las rutas reales son inyectadas dinámicamente según la configuración de Armando. No asumas rutas absolutas fijas a menos que sean necesarias para un comando específico del sistema.

## ⚙️ Reglas de Generación de Comandos (CLI Protocol)

Cuando mikuBot sugiera comandos de terminal, debe adherirse a lo siguiente:

1.  **Navegación:** Usa rutas relativas al punto de montaje actual o solicita confirmación si necesitas moverte entre unidades.
2.  **Sintaxis Windows:**
    * Usar comillas dobles `""` para rutas con espacios.
    * Los comandos se ejecutan sobre PowerShell / CMD según disponibilidad.
3.  **Contexto:** El agente inicia por defecto en el directorio @WORKSPACE.

## 🛠️ Stack & Environment
- **Sistema Operativo:** Windows 11.
- **Herramientas de desarrollo** Antigravity, Jules, Google AI studio.
- **Gestor de Paquetes:** npm / pip / maven (según proyecto).
- **Git:** Instalado y configurado globalmente.

## 🖥️ Console Access (`run_console`)

The `run_console` tool provides workspace console access. **Security restrictions apply:**

### Allowed Commands
`git`, `node`, `npm`, `npx`, `ls`, `dir`, `cat`, `type`, `echo`, `mkdir`, `cd`, `pwd`, `grep`, `find`, `head`, `tail`, `wc`, `tree`, `tsc`, `python`, `pip`

### Blocked Patterns
The following are **NEVER** allowed in arguments:
- `&&`, `||`, `;` (command chaining)
- `|` (piping)
- `` ` `` or `$(` (subshell execution)
- `../` or `..\` (path traversal)
- `rm -rf` or `rm -R` (recursive delete)

### Usage Format
```json
{
  "name": "run_console",
  "arguments": {
    "command": "npm",
    "args": "install lodash",
    "cwd": ""
  }
}
```

> ⚠️ Console commands require **elevated approval** from the user.

## 📂 File Management (`read_file`, `update_file`, `patch_file`)

### `read_file`
Read content from any mount point.
- **Param:** `filename` (path/to/file.ext)
- **Param:** `source` (workSpace, core, library)

### `update_file`
Create or overwrite files. Directories are created automatically.
- **Param:** `filename`, `content`, `source`

### `patch_file` / `smart_patch` (Version 2.0)
Efficiently edit files using various strategies. Always creates a `.bak` backup.
- **Param:** `filename`, `find`, `replace`, `strategy` (auto, exact, lineNumber, fuzzy, regex).
- **Supports:** `patches` array for multiple edits in a single call.
- **Fuzzy Strategy:** Matches a line containing `find`. Highly resilient to minor whitespace changes.
- **Note:** `find` must be a substantial block for `auto` strategy. Use `lineNumber` for precise edits.

### `undo_patch`
Reverts the last patch to a file using the `.bak` file.
- **Param:** `filename`

## 🔍 Discovery & Search (`list_files`, `search_files`)

### `list_files`
List all files in a mount point. Use ONLY when lost.
- **Param:** `source`

### `search_files`
High-performance native search across all files in a folder.
- **Param:** `query` (The text to find).
- **Param:** `filePattern` (e.g., "*.js", "!node_modules/*").
- **Param:** `caseSensitive` (boolean).
- **Param:** `searchPath` (sub-folder to start search).

### `get_file_outline`
Extract classes, functions, and interfaces from a source file.
- **Param:** `filename`, `source`

### `batch_operation`
Perform bulk file operations (copy, move, delete) using glob patterns.
- **Param:** `operation` (copy, move, delete), `source_path`, `destination_path` (optional), `pattern` (optional glob)

## 🛰️ System & Environment tools (`get_system_metrics`)

### `get_system_metrics`
Get real-time OS metrics (CPU, Memory, Uptime, Hostname).

### `get_git_info`
Get repository status, branch name, and modified files count.

## 🛰️ Jerarquía de Investigación (Tiers 1-3)

### Tier 1: `web_search` [Base Tool]
Búsqueda superficial rápida. Devuelve títulos y resúmenes cortos (snippets).

### Tier 2: `web_research` [Skill Intermedia]
Investigación con lectura de contenido real (Top 3-5 sitios). Evita alucinaciones.

### Tier 3: `deep_research` [Artillería Pesada]
Investigación exhaustiva. Multi-idioma, Auditoría interna de calidad, Descarte de ruido y Dossier de justificación técnica.

## ⏳ Neural Scheduling (`add_scheduled_task`)

### `add_scheduled_task`
Program a proactive task for the agent to execute in the future.
- **Param:** `name` (Short task identifier)
- **Param:** `prompt` (Detailed instruction for the agent)
- **Param:** `scheduleType` (once, interval, cron)
- **Param:** `schedule` (ISO date for 'once', minutes for 'interval', cron for 'cron')
- **Param:** `channel` (telegram, ui, both)
- **Param:** `mode` (chat, agent)

## 🏁 Conclusion (`final_answer`)

### `final_answer`
Conclude the task with a synthesis.
- **Param:** `text` (The answer)
- **Param:** `sources` (Array of files or URLs actually used)
- **Rule:** Do NOT hallucinate sources. Only cite what you actually touched.

---
*Nota: Este archivo sirve como referencia espacial y técnica. El sistema inyectará estas reglas automáticamente si detecta fallos.*