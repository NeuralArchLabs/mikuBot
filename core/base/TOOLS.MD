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

### `patch_file`
Efficiently edit large files by replacing a specific block.
- **Param:** `filename`, `find` (exact block), `replace` (new text)
- **Note:** `find` must match character-for-character, including whitespace.

## 🔍 Discovery & Search (`list_files`, `search_files`)

### `list_files`
List all files in a mount point. Use ONLY when lost.
- **Param:** `source`

### `search_files`
Search for a text pattern in all files.
- **Param:** `query` (The text to find)
- **Warning:** Do NOT use "filename" as a parameter; use `query`.

## 🌐 Research & Synthesis (`web_search`, `read_url`, `final_answer`)

### `web_search`
Search the internet via Tavily/Brave.
- **Param:** `query`, `search_depth` (basic/advanced)

### `final_answer`
Conclude the task with a synthesis.
- **Param:** `text` (The answer)
- **Param:** `sources` (Array of files or URLs actually used)
- **Rule:** Do NOT hallucinate sources. Only cite what you actually touched.

---
*Nota: Este archivo sirve como referencia espacial y técnica. El sistema inyectará estas reglas automáticamente si detecta fallos.*