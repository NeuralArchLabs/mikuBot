# Neural System Architecture: MikuBot 🧠⚡

Este documento define las especificaciones técnicas para resolver los dos desafíos más grandes de MikuCentral: la **consistencia cognitiva** y la **extensibilidad modular**.

---

## 1. Robust Agent Loop (Dynamic Task Anchoring) 🔄

Para evitar que Miku "olvide" su propósito en tareas largas, implementaremos un sistema de anclaje de estado.

### 1.1 El Protocolo `TASKS.md`
`TASKS.md` dejará de ser una sugerencia para convertirse en la **Memoria de Trabajo Obligatoria**.

*   **Estructura del Archivo:**
    ```markdown
    # PLAN ACTUAL: [Nombre de la Tarea]
    - [x] Paso completado -> [Link a resultado o archivo generado]
    - [/] Paso en curso...
    - [ ] Paso pendiente
    
    ## Contexto de Resultados
    - Resultado 1: [Breve descripción de qué se logró]
    ```

*   **Regla de Oro:** Si una tarea tiene >2 pasos, el Agente **NO PUEDE** realizar acciones de ejecución sin haber actualizado primero `TASKS.md`.
*   **Re-inyección de Estado:** El contenido de `TASKS.md` se inyectará en el System Prompt en cada turno como `[MEMORIA DE TRABAJO]`.

### 1.2 Auditoría Pre-Final (The Exit Gate)
Antes de enviar un `final_answer`, el Agente debe ejecutar un pensamiento de auditoría interna:
1.  **Check Plan:** ¿Están todos los checks de `TASKS.md` marcados como `[x]`?
2.  **Check Original:** ¿La respuesta satisface el primer mensaje de la sesión?
3.  **Check Integrity:** ¿Los archivos generados son consistentes entre sí?

---

## 2. Neural Skills System (Modular Library) 🛠️

Miku debe poder aprender habilidades nuevas sin ser recompilada. Inspirado en el sistema de "AgentSkills" de OpenClaw.

### 2.1 Arquitectura de Skills
Cada Skill vivirá en `engine/skills/[skill-name]/`.

*   **Estructura de una Skill:**
    *   `manifest.json`: Define el nombre, descripción y parámetros de la herramienta (formato compatible con OpenAI/Ollama Tools).
    *   `main.py` o `logic.js`: El script que ejecuta la acción.
    *   `README.md`: Documentación para la IA sobre cómo usarla correctamente.

### 2.2 El Skills Indexer (Miku's Library)
Crearemos un servicio en el Backend (Electron/Python) que:
1.  Escanea la carpeta `engine/skills/`.
2.  Valida los manifiestos.
3.  **Auto-inyecta** las herramientas en el `systemInstruction` del Agente en tiempo de ejecución.
4.  Carga solo las herramientas necesarias para ahorrar ventana de contexto (Dynamic Loading).

### 2.3 Beneficios
*   **Ligereza:** El core de Miku se mantiene pequeño y rápido.
*   **Comunidad:** Armando o cualquier desarrollador puede crear un `.zip` con una carpeta de skill y Miku la "aprenderá" al instante.
*   **Orden:** Separación total entre la lógica de la UI y las capacidades de acción del agente.

---

## 3. Hoja de Ruta de Implementación 🗺️

1.  **Fase 1 (Inmediata):** Reforzar `AGENTS_MODES.MD` con el protocolo estricto de `TASKS.md`.
2.  **Fase 2:** Crear la carpeta `engine/skills/` con la primera skill de prueba (`hello_skill`).
3.  **Fase 3:** Modificar `src/services/agent.ts` para que lea y cargue herramientas dinámicamente desde el sistema de archivos local.
4.  **Fase 4 (v1.8.0):** Sincronización de estado de instrucción (`isInstructionMode`) para una respuesta visual coherente del sistema.

---
*Diseño Evolutivo mikuCentral v1.8.0*
