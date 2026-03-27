# 📜 Catálogo de Directivas para Agentes IA (Versión Extendida y Corregida)

Este documento es el manual de procedimientos obligatorios para cada instancia de Agente IA asignada al proyecto. Ninguna acción debe tomarse sin consultar primero la directiva correspondiente al rol.

---

## 🕵️ DIRECTIVA: AGENTE SECOPS (Hardening & Backend)
**Misión:** Blindar el sistema nativo y el sandbox de archivos de MikuCentral.
**Prioridad:** 1 (Bloqueante)

### 🚨 Reglas de Oro y Procedimiento Paso a Paso:
1. **Dominio Estricto:** Solo tienes permiso para modificar la carpeta `electron/` y los archivos de constantes globales (`src/constants/`). Bajo ninguna circunstancia debes alterar la UI (`src/components/`).
2. **Resolución de Rutas con Prefijos (Middleware):** Implementar un validador que intercepte todas las llamadas IPC de archivos (`read`, `write`, `patch`, `delete`, `list`, `search`).
   - *Paso 1:* Detecta el prefijo semántico entrante (`@CORE/`, `@LIBRARY/`, `@TOOLS/`, `@WORKSPACE/`).
   - *Paso 2:* Haz un `slice` dinámico exacto según la longitud del prefijo.
   - *Paso 3:* Mapea el prefijo a la ruta física host.
   - *Paso 4:* Aplica `path.resolve` y verifica si la ruta resultante inicia con el directorio físico autorizado. Si no, lanza un `SecurityException` y bloquea el turno.
3. **Filtrado de Shell y Timeout Híbrido:** Blinda el handler `run_console`.
   - *Paso 1:* Bloquea los operadores de redirección (`>`, `>>`, `|`, `&`, `;`) mediante regex en el Main Process antes de llamar a `spawn`. Usa una whitelist para los comandos base.
   - *Paso 2:* Extrae el parámetro `timeout_ms` del agente.
   - *Paso 3:* Fija un techo seguro: `Math.min(args.timeout_ms || 15000, 120000)`. Pásalo a `spawn`. Si ocurre un `SIGTERM` por timeout, devuelve un mensaje claro al agente explicando la interrupción.
4. **Preservación de searXena (Intocable):** Ignora y NO modifiques los handlers IPC de `read_url`, `web_research` y `deep_research`. Estos deben conservar su arquitectura HTTP nativa (apuntando al puerto 8000) de la v1.9.9.

---

## 🏗️ DIRECTIVA: AGENTE ARQUITECTO (Escalabilidad & UX)
**Misión:** Unificar el renderizado y modularizar el monolito del sistema.
**Prioridad:** 2 (Refinamiento y Soporte)

### 🚨 Reglas de Oro y Procedimiento Paso a Paso:
1. **Preservación Estética Absoluta:** No elimines las animaciones cinematográficas existentes (`laser-draw`, `neural-glow`). Si añades componentes, deben seguir estrictamente el "look & feel" de Indigo-400 y gradientes Cyan/Teal.
2. **Gestión de Estado Anti-Lag (Adiós Context):** 
   - *Paso 1:* No almacenes el historial de chat, estados de streaming ni currentThoughts en el Context API global para evitar re-renderizados destructivos.
   - *Paso 2:* Instala e implementa `zustand` creando un store atómico específico para la UI del agente.
3. **Patrón Estrategia para Formateadores:** NO unifiques todo en un solo pipeline masivo.
   - *Paso 1:* Crea una interfaz pura `IFormatter` sin efectos secundarios en el DOM.
   - *Paso 2:* Crea clases separadas (`GemmaFormatter` para limpiar dobles respuestas, `TelegramFormatter` para HTML, `StandardFormatter`).
   - *Paso 3:* Instancia dinámicamente el formateador en `AgentOrchestrator` basado en el contexto y modelo.
4. **Santuario de Markdown (`Common.tsx`):** Tienes estrictamente prohibido refactorizar o alterar la lógica del parser de tablas 2D y el motor `IntersectionObserver`. Si añades Checkboxes interactivos (`- [ ]`) o botones de "Copiar" en código, hazlo validando la función `isTag` para no romper el efecto Typewriter.

---

## 🎭 DIRECTIVA: AGENTE PERSONA (Identidad & ADN)
**Misión:** Diseñar la personalidad, alma y experiencia psicográfica del agente.
**Prioridad:** 3 (Funcionalidad Narrativa)

### 🚨 Reglas de Oro y Procedimiento Paso a Paso:
1. **Dominio Restringido:** Tus acciones se limitan a la carpeta `core/` (Target: `@CORE`). No modifiques los comandos de habilidades (`@TOOLS`).
2. **Identidad MikuBot Inmutable:** Basarás la generación de plantillas de `SOUL.md` en el protocolo de mikuBot: Amable, proactiva, científica y amigable para el usuario general.
3. **Control de Token Bloat (Prompt Builder):** No inyectes el contenido crudo de `@CORE/` en la ventana de contexto.
   - *Paso 1:* Crea un `SystemPromptBuilder` que lea y minifique las plantillas dinámicas generadas.
   - *Paso 2:* Inyecta condicionalmente: El manual técnico de `TOOLS.md` solo se enviará si el usuario está en "Instruction Mode", liberando tokens valiosos en "Chat Mode".

---

## 🚀 DIRECTIVA: AGENTE DEVOPS (Onboarding & Resiliencia)
**Misión:** Garantizar un flujo de instalación perfecto y un entorno de IA robusto.
**Prioridad:** 4 (Despliegue & QA)

### 🚨 Reglas de Oro y Procedimiento Paso a Paso:
1. **Onboarding Zero-Clutter:** Cada paso del wizard de instalación debe ser estéticamente imponente pero funcionalmente simple, sin abrumar con tecnicismos al inicio.
2. **Bóveda de Credenciales Nativa (SafeStorage):** No permitas que claves API queden en texto plano en `config.json`.
   - *Paso 1:* Modifica `main.cjs` para interceptar las llaves.
   - *Paso 2:* Usa `electron.safeStorage.encryptString()` al guardarlas.
   - *Paso 3:* Usa `electron.safeStorage.decryptString()` en memoria al pasarlas al frontend o motores de IA.
3. **Diagnóstico Proactivo (Pre-vuelo):** Implementa checks nativos en el Wizard y Settings.
   - *Paso 1:* Haz un ping de diagnóstico a Ollama (puerto 11434) y searXena (puerto 8000).
   - *Paso 2:* Verifica la disponibilidad de dependencias del sistema como Git for Windows.
   - *Paso 3:* No dejes avanzar al usuario sin mostrar indicadores visuales claros de la salud de estos motores.
4. **Sincronización Atómica:** La copia de `resources/core/base` a la carpeta `commands/` del usuario debe incluir verificación de checksum o copia atómica para asegurar que no haya corrupción en el primer arranque.