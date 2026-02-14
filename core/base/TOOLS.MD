# TOOLS.md - Workspace Cartography & Toolkit

## 🗺️ Topografía del Sistema (Windows 11)

Este archivo define las rutas absolutas para la generación de comandos. mikuBot debe utilizar estas rutas base para asegurar precisión en la consola.

**Drive Root:** `D:`

### 📍 Puntos de Montaje (Mount Points)

| Alias Interno | Ruta Absoluta (Windows) | Propósito |
| :--- | :--- | :--- |
| **@CORE** | `D:\Armando\Desktop\workSpace\mikuBot_core\mikuBot_core` | **Cerebro.** Aquí viven `IDENTITY.md`, `ACTIVE_CONTEXT.md`, etc. |
| **@DEV** | `D:\Armando\Desktop\workSpace\ProyectosDev` | **Taller.** Aquí viven `VetConnect` y otros repos de código. |
| **@MAP** | `D:\Armando\Desktop\workSpace\ProyectosMap` | **Biblioteca.** Proyectos de referencia y documentación. |
| **@SANDBOX** | `D:\Armando\Desktop\workSpace\ProyectosDev\mikuCentralv1.0\sandBox` | **Sandbox.** Directorio de trabajo por defecto del agente. Los archivos creados sin especificar `source` van aquí. |

## ⚙️ Reglas de Generación de Comandos (CLI Protocol)

Cuando mikuBot sugiera comandos de terminal, debe adherirse a lo siguiente:

1.  **Rutas Absolutas:** Ante la duda, usa la ruta completa para evitar errores de navegación relativa.
    * *Correcto:* `cd "D:\Armando\Desktop\workSpace\ProyectosDev\VetConnect"`
    * *Incorrecto:* `cd ../VetConnect`
2.  **Sintaxis Windows:**
    * Usar comillas dobles `""` para rutas con espacios.
    * Comandos estándar: `PowerShell` o `Git Bash`.
3.  **Navegación de Contexto:**
    * Si estamos editando la memoria: `cd @CORE` (usar la ruta real).
    * Si estamos programando: `cd @DEV`.

## 🛠️ Stack & Environment
- **Sistema Operativo:** Windows 11.
- **Herramientas de desarrollo** Antigravity, Jules, Google AI studio.
- **Gestor de Paquetes:** npm / pip / maven (según proyecto).
- **Git:** Instalado y configurado globalmente.

## 🖥️ Console Access (`run_console`)

The `run_console` tool provides sandboxed console access. **Security restrictions apply:**

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

> ⚠️ Console commands require **elevated approval** from the user. The approval panel will show a RED security banner for console commands.

---
*Nota: Este archivo sirve como referencia espacial. Si mueves carpetas de lugar, actualiza este mapa para evitar comandos rotos.*