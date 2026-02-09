# TOOLS.md - Workspace Cartography & Toolkit

## 🗺️ Topografía del Sistema (Windows 11)

Este archivo define las rutas absolutas para la generación de comandos. mikuBot debe utilizar estas rutas base para asegurar precisión en la consola.

**Drive Root:** `D:`

### 📍 Puntos de Montaje (Mount Points)

| Alias Interno | Ruta Absoluta (Windows) | Propósito |
| :--- | :--- | :--- |
| **@CORE** | `D:\Armando\Desktop\workSpace\mikuBot_core\mikuBot_core` | **Cerebro.** Aquí viven `IDENTITY.md`, `ACTIVE_CONTEXT.md`, etc. |
| **@DEV** | `D:\Armando\Desktop\workSpace\ProyectosDev` | **Taller.** Aquí viven `VetConnect` y otros repos de código. |
| **@MAP** | `D:\Armando\Desktop\workSpace\ProyectosMap` | **Biblioteca.** Biblioteca proyectos donde guardaremos archivos .md que describan los proyectos y su avance. |
| **@MISC** | `D:\Armando\Desktop\workSpace\Misc` | **Sandbox.** Pruebas rápidas, archivos temporales, archivos no clasificados. |

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

---
*Nota: Este archivo sirve como referencia espacial. Si mueves carpetas de lugar, actualiza este mapa para evitar comandos rotos.*