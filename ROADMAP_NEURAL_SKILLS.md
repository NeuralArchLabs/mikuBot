# Roadmap: Neural Skills System 🛠️🚀

Este documento detalla la ruta técnica para implementar el sistema de habilidades modulares en MikuBot, permitiendo que el agente adquiera nuevas capacidades sin modificar el núcleo de la aplicación.

## 1. Fase de Infraestructura (Backend) 🏗️ ✅
El proceso principal de Electron debe ser capaz de gestionar las habilidades físicas en el disco.

- [x] **IPC: `list-skills`**: Handler que escanea `engine/skills/**/manifest.json` y devuelve un array de objetos de herramienta compatibles con OpenAI/Ollama.
- [x] **IPC: `execute-skill`**: Handler genérico que recibe el nombre de la skill y los argumentos, identifica el punto de entrada (`main.py` o `logic.js`) y lo ejecuta devolviendo el resultado en JSON.
- [x] **Carpeta de Habilidades**: Creación de la estructura base en el sistema de archivos.

## 2. Fase de Integración (Agent Logic) 🧠 ✅
El `agent.ts` se ha transformado de un sistema estático a uno dinámico.

- [x] **Dynamic Tool Injection**: El loop del agente llama a `window.electron.invoke('list-skills')` al inicio de cada sesión, filtrando las skills desactivadas por el usuario.
- [x] **Generic Tool Executor**: El switch-case de herramientas en `agent.ts` ejecuta skills no-core a través del IPC genérico `execute-skill`.

## 3. Fase de Estandarización 📋
Definir el formato de una "Skill" para que Armando pueda crear las suyas.

- **`manifest.json`**:
  ```json
  {
    "name": "get_weather",
    "description": "Obtiene el clima de una ciudad",
    "parameters": {
      "type": "object",
      "properties": { "city": { "type": "string" } }
    },
    "runtime": "python",
    "entry": "main.py"
  }
  ```

## 4. Fase de Prueba (PoC) 🧪 ✅
- [x] **Skill: `miku_clock`**: Una skill simple en Python que devuelva la hora con un mensaje personalizado de Miku.
- [x] **Verificación**: El agente es capaz de ver la herramienta en su "toolbelt" y usarla con éxito.
- [x] **Nuevas Skills Beta**: `crypto_tracker`, `deep_research`, `web_research`, `gmail_imap`.

## 5. Próximos Pasos tras el Sistema de Skills
Una vez que el sistema sea estable, las siguientes skills serán:
1. **RAG Skill**: Búsqueda en memoria semántica local.
2. **Surfing Skill**: Navegación autónoma con Playwright.

## 6. Fase de Control de Usuario (v1.7.0) 🎛️ ✅
- [x] **Selective Skill Toggles**: Switch inline por cada skill para activar/desactivar su inyección al agente.
- [x] **Filtrado en System Prompt**: Skills desactivadas se excluyen tanto de las herramientas dinámicas como del bloque de configuración del prompt.
- [x] **Persistencia**: El estado de activación se persiste en `config.disabledSkills[]`.
- [x] **Visual Balance**: Tipografía refinada en todo el panel (tarjetas, labels, tabs, botones) para una lectura más cómoda.
- [x] **No Auto-Select**: Al entrar a Neural Skills, ninguna skill está seleccionada por defecto — se muestra el estado "Neural Standby".

## 7. Fase de Infraestructura de Ejecución (v1.8.0) ⚡ ✅
- [x] **State Sychronization**: Introducción de `isInstructionMode` en el `AgentStatus` para mapear el estado de ejecución de herramientas con efectos visuales premium (Halo).
- [x] **Dev Pipeline Compatibility**: Ajustes en el entorno de red (puerto 3001) para permitir el desarrollo paralelo de múltiples aplicaciones agénticas.

---
**Objetivo Final**: Que MikuBot sea un orquestador que solo "pida las herramientas que necesita" de su biblioteca personal.
