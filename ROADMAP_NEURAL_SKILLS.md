# Roadmap: Neural Skills System 🛠️🚀

Este documento detalla la ruta técnica para implementar el sistema de habilidades modulares en MikuBot, permitiendo que el agente adquiera nuevas capacidades sin modificar el núcleo de la aplicación.

## 1. Fase de Infraestructura (Backend) 🏗️ ✅
El proceso principal de Electron debe ser capaz de gestionar las habilidades físicas en el disco.

- [x] **IPC: `list-skills`**: Handler que escanea `engine/skills/**/manifest.json` y devuelve un array de objetos de herramienta compatibles con OpenAI/Ollama.
- [x] **IPC: `execute-skill`**: Handler genérico que recibe el nombre de la skill y los argumentos, identifica el punto de entrada (`main.py` o `logic.js`) y lo ejecuta devolviendo el resultado en JSON.
- [x] **Carpeta de Habilidades**: Creación de la estructura base en el sistema de archivos.

## 2. Fase de Integración (Agent Logic) 🧠
El `agent.ts` debe transformarse de un sistema estático a uno dinámico.

- [ ] **Dynamic Tool Injection**: En lugar de usar la constante `AGENT_TOOLS`, el loop del agente llamará a `window.electron.invoke('list-skills')` al inicio de cada sesión o ráfaga.
- [ ] **Genereic Tool Executor**: Refactorizar el switch-case de herramientas en `agent.ts` para que, si una herramienta no es "core" (como `read_file`), intente ejecutarla como una "Skill" a través del IPC genérico.

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
- [x] **Nuevas Skills Beta**: `crypto_tracker`, `deep_research`, `web_research`.

## 5. Próximos Pasos tras el Sistema de Skills
Una vez que el sistema sea estable, las siguientes skills serán:
1. **RAG Skill**: Búsqueda en memoria semántica local.
2. **Surfing Skill**: Navegación autónoma con Playwright.
3. **Vision Skill**: OCR y análisis de imágenes.

---
**Objetivo Final**: Que MikuBot sea un orquestador que solo "pida las herramientas que necesita" de su biblioteca personal.
