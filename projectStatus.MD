# Project Status: MikuCentral v1.8.0 🚀

> **Última actualización**: 23 de febrero de 2026
> **Autor del análisis**: Antigravity AI Engine

Este documento detalla el análisis exhaustivo del proyecto **MikuCentral**, una interfaz de IA neural y asistente personal integral diseñada para la soberanía tecnológica local, la ejecución de agentes autónomos y la persistencia automodificable en todas las facetas de la vida del usuario (personal, profesional y financiera).

---

## 1. Capacidades Actuales (¿Qué puede hacer?) 🌟

MikuCentral es mucho más que un simple chat; es un orquestador de agentes con las siguientes capacidades:

### 🤖 Inteligencia Multimodelo
*   **Soporte de Proveedores**: Integración nativa con **Ollama** (local), **Gemini** (Google Cloud) y **Groq** (LPU de baja latencia).
*   **Inferencia Estructurada**: Capacidad de forzar salidas JSON y manejar herramientas (function calling) incluso en modelos que no lo soportan de forma nativa mediante su motor de extracción.
*   **Visual Feedback Loop**: La UI reacciona mediante animaciones CSS complejas (Halo effects, glifo pulsante) al estado del agente en tiempo real.
*   **Fallback Automático**: Si un modelo no soporta native tool calling (HTTP 400), se desactiva transparentemente y se cae a extracción por texto.

### 🛠️ Herramientas de Agencia (Toolbelt) — 8 herramientas
| Herramienta | Tipo | Descripción |
|-------------|------|-------------|
| `read_file` | 📖 Lectura | Leer archivos de core, library o workSpace |
| `update_file` | ✏️ Escritura | Crear o sobrescribir archivos completos |
| `patch_file` | 🩹 Escritura parcial | Edición quirúrgica por bloques (find/replace) |
| `list_files` | 📂 Lectura | Listar archivos de cualquier carpeta |
| `search_files` | 🔍 Lectura | Buscar texto dentro de archivos |
| `web_search` | 🌐 Externa | Búsqueda web vía Tavily o Brave Search |
| `read_url` | 🌐 Externa | Scraping de contenido de URLs |
| `run_console` | ⚡ Ejecución | Comandos de consola whitelisteados |

### 🧠 Robustez Cognitiva (The Agent Loop)
*   **Bucle ReAct**: Ciclo de pensamiento/acción para tareas de múltiples pasos.
*   **Recuperación de Errores**: Normalización avanzada que "repara" llamadas malformadas (873 líneas de normalización).
*   **Detección de Bucles**: Monitoreo por fingerprint de acciones repetidas (threshold: 3).
*   **Per-Tool Failure Nudge**: Aislamiento automático de herramientas que fallan 5+ veces consecutivas.
*   **Human-in-the-Loop**: Panel de aprobación manual glassmórfico para acciones sensibles.
*   **Ejecución Paralela**: Herramientas read-only se ejecutan concurrentemente con `Promise.allSettled`.
*   **Graceful Shutdown**: Al alcanzar MAX_RETRIES (10), se le pide al modelo una explicación final antes de cortar.

### 📚 Librería de Contexto & Identidad
*   **Gestión de Planes de Vida**: Co-creación de hojas de ruta, cronogramas y presupuestos.
*   **Sistema de Identidad (mikuBot)**: Inyección persistente de `IDENTITY.md` y reglas de idioma español.
*   **Assistant Blueprints**: 4 plantillas pre-construidas (Presupuesto, Proyecto, Rutina, Aprendizaje).
*   **Editor Enriquecido**: Vista dividida con editor + preview Markdown en tiempo real.

---

## 2. Implementación Técnica (¿Cómo lo hace?) 🏗️

| Componente | Tecnología | Rol |
|------------|-----------|-----|
| Frontend | React 19 + TypeScript + Tailwind CSS 4 | UI premium con glassmorphism y animaciones |
| Runtime | Electron 40 + Node.js | Acceso nativo al SO, IPC bridge |
| Build | Vite 6 | Dev server + bundler |
| AI APIs | Ollama (local), Gemini, Groq | Endpoints de chat y streaming |
| Búsqueda | Tavily, Brave Search | Herramientas de web search |
| Persistencia | IndexedDB (handles) + FileSystem Access API (contenido) + Electron FS (sesiones/config) | Triple capa de almacenamiento |
| Normalización | `toolCallNormalizer.ts` (891 líneas) | Diccionario de alucinaciones, reparación JSON, limpieza XML |

### Arquitectura de Archivos
```
src/
├── App.tsx               (1248 líneas) — Orquestador principal de estado y routing
├── components/
│   ├── features/
│   │   ├── ChatArea.tsx       (436 líneas) — Área de chat con bloques de herramientas
│   │   ├── LibraryManager.tsx (320 líneas) — Gestor de contexto con blueprints y editor
│   │   ├── FileEditor.tsx     (137 líneas) — Editor de archivos core (Cortex)
│   │   ├── SessionList.tsx    (113 líneas) — Lista de sesiones
│   │   └── OnboardingWizard.tsx (234 líneas) — Setup inicial guiado
│   ├── panels/
│   │   ├── SettingsPanel.tsx  (651 líneas) — Configuración de proveedores y carpetas
│   │   ├── AgentStatusPanel.tsx (173 líneas) — Panel de estado del agente
│   │   └── ToolApprovalPanel.tsx (148 líneas) — Panel de aprobación glassmórfico
│   ├── layout/
│   │   └── Sidebar.tsx        (285 líneas) — Navegación y gestión de sesiones
│   └── common/
│       ├── ToolBlock.tsx      (129 líneas) — Rendering de bloques de herramientas
│       ├── Common.tsx         (15 líneas)  — Icon + MarkdownRenderer compartidos
│       └── CollapsibleTextBlock.tsx (59 líneas) — Texto colapsable
├── hooks/                 (Vacío) — Lógica consolidada en Services/App.tsx.
├── services/
│   ├── core/
│   │   ├── agent.ts           (975 líneas) — Motor del agent loop + Proxy Stores
│   │   ├── fileSystem.ts      (27 líneas)  — IndexedDB para handles
│   │   └── persistence.ts     (191 líneas) — Persistencia Electron
│   ├── integrations/
│   │   ├── api.ts             (190 líneas) — Streaming para Groq/Gemini
│   │   └── telegramService.ts (81 líneas)  — Integración remota
│   └── formatters/
│       ├── toolCallNormalizer.ts (545 líneas) — Reparación de alucinaciones
│       └── normalization/dictionaries.ts (547 líneas) — Diccionario de corrección
├── types/global.ts        (173 líneas) — Definiciones de tipos globales
├── utils/helpers/index.ts (89 líneas)  — safeFetch, validation, etc.
├── constants/core.ts      (394 líneas) — Herramientas, proveedores, blueprints
└── index.css              (608 líneas) — Estilos custom + animaciones
electron/
├── main.cjs               (534 líneas) — Proceso principal Electron
└── preload.cjs            (27 líneas)  — Bridge IPC
```

---

## 3. Limitaciones y Deuda Técnica Identificada ⚠️

### 3.1 Resueltas ✅
| # | Problema | Solución Implementada |
|---|---------|----------------------|
| 1 | Escritura Destructiva (`update_file` sobrescribía completo) | `patch_file` con find/replace exacto + match leniente |
| 2 | Falta de Plantillas | 4 Blueprints en `BLUEPRINT_TEMPLATES` |
| 3 | Ejecución Secuencial de herramientas | Ejecución paralela automática para read-only tools |
| 4 | Editor de contexto básico | Split-view editor + live Markdown preview |
| 5 | **Deadlock en ejecución paralela** | Eliminé `onToolApproval` del path paralelo (read-only = siempre seguro). Antes pedía aprobación individual pero el UI solo soporta 1 panel → deadlock |
| 6 | **Agente pedía permiso para TODO** | Smart Auto-Approval (eje `approvalMode`): reads auto-aprobados, escrituras nuevas en sandbox auto-aprobadas, solo pide permiso para `run_console`, `patch_file`, y ediciones a archivos existentes/core/library |
| 7 | **Sin modo paso a paso** | Safe Mode (eje `safeMode`): ejecuta herramientas una a la vez con render entre cada una. Ortogonal al modo de aprobación — puede combinarse con auto o manual |
| 8 | **Workspace Caducado** | ✅ Done | Implementados **Proxy Stores** mutables en `agent.ts`. El agente ahora ve archivos creados en el mismo turno. |
| 9 | **Razonamiento redundante** | ✅ Done | Implementado sistema de bloques semánticos (`thought`/`answer`) + Intercalado cronológico + Swallowing de JSON duplicado. |
| 10 | **Confusión de Idioma** | ✅ Done | Inyección estructural de `IDENTITY.md` + protocolo de idioma español obligatorio en `App.tsx`. |
| 11 | **Refactor Sandbox → WorkSpace** | ✅ Done | Renombrado masivo de `sandbox` a `workSpace` en tipos, servicios, UI y herramientas para mayor claridad conceptual. |
| 12 | **Inestabilidad en Persistencia** | ✅ Done | v1.5.0: `config.json` como Single Source of Truth. Eliminados handles de IndexedDB caducos y `localStorage` en modo escritorio. |
| 13 | **Acceso a Carpetas Externo** | ✅ Done | Integración con el Shell nativo para abrir directorios del Control Room directamente en el explorador de archivos. |
| 14 | **Consolidación Arquitectónica** | ✅ Done | Simplificación del flujo de datos migrando lógica de `hooks/` a `services/` y `App.tsx` para evitar race conditions y asegurar un despliegue atómico de la configuración. |
| 15 | **Confusión entre Sesiones** | ✅ Done | v1.6.0: Implementada persistencia de modo (Agent/Chat), safeMode y borradores por sesión única. |
| 16 | **Falta de Feedback Visual** | ✅ Done | v1.6.0: Animaciones de Halo, spin-reverse y bolt-glow sincronizadas con el `AgentStatus`. |
| 17 | **Clipping en UI Premium** | ✅ Done | Ajustado `overflow` y `background-clip` en botones para permitir efectos de resplandor externos. |

### 3.2 Pendientes (Originales) ⏳
| # | Problema | Severidad | Detalle |
|---|---------|-----------|---------|
| 8 | **Aislamiento de Consola** | 🟠 Media | `run_console` ejecuta directamente en el host con whitelisting + pattern blocking. Sin embargo, un comando como `git push --force` aún podría ejecutarse. Mitigado con el smart approval (siempre pide permiso para `run_console`). |
| 9 | **Migración a MCP** | 🟡 Media | Las herramientas siguen un esquema propio. Migrar a Model Context Protocol facilitaría interop con otros clientes MCP. |

### 3.3 Nuevas Áreas Detectadas 🆕

#### 🔴 CRÍTICAS

**C1. Robustez del Agent Loop (Amnesia de Tareas)**
- **Problema**: El agente pierde el hilo en tareas largas o ignora resultados de pasos anteriores.
- **Riesgo**: Tareas incompletas, repetición de errores y pérdida de confianza del usuario.
- **Solución propuesta**: Implementar "Dynamic Task Anchoring" en `TASKS.md` y una auditoría pre-final obligatoria.

**C2. Sistema de Skills Modular**
- **Estado**: ✅ Done (v1.7.0)
- **Solución implementada**: Arquitectura completa de Neural Skills con manifiestos auto-indexables, editor integrado, blueprints de creación (Python/Node.js), y **toggles selectivos** para activar/desactivar skills individualmente. Las skills desactivadas no se inyectan al agente ni en herramientas ni en el system prompt.

**C3. API Keys expuestas en el Frontend**

**C1. API Keys expuestas en el Frontend**
- Las API keys de Gemini se pasan directamente en la URL (`?key=${config.apiKeys.gemini}`) en `api.ts:15,87`.
- Las keys de Groq se envían en headers desde el renderer process.
- **Riesgo**: En modo browser (sin Electron), las keys viajan sin proxy. Cualquier extensión del navegador puede interceptarlas.
- **Solución propuesta**: Enrutar TODAS las llamadas a APIs externas a través del `fetch-proxy` de Electron (ya existe), nunca directo desde el renderer.

**C2. `preload.cjs` es un canal IPC abierto**
- La línea `invoke: (channel, data) => ipcRenderer.invoke(channel, data)` permite invocar **cualquier** handler IPC desde el renderer, no solo los registrados.
- **Riesgo**: Si se inyecta código malicioso en el renderer, puede invocar handlers arbitrarios.
- **Solución propuesta**: Reemplazar el `invoke` genérico con handlers explícitos por canal (ya tiene helpers como `saveSettings`, pero el genérico sigue expuesto).
- **Update v1.5.0**: Las operaciones críticas de persistencia ahora usan handlers explícitos en `persistence.ts`.

**C3. `sendStreamingMessage` no tiene agent loop para Groq/Gemini**
- En `api.ts`, los proveedores Groq y Gemini solo soportan modo chat (streaming de texto). No tienen capacidad de ejecutar herramientas.
- **Riesgo**: El usuario selecciona modo "Agent" + Gemini → no pasa nada, falla silenciosamente.
- **Solución propuesta**: Implementar function calling nativo de Gemini (ya lo soporta vía `tools` parameter) y OpenAI-compatible para Groq.

#### 🟡 IMPORTANTES

**I1. Descomposición de App.tsx**
- **Estado v1.5.0**: Se ha realizado una refactorización parcial para aplanar funciones y mejorar la legibilidad, reduciendo la complejidad de `App.tsx` considerablemente, aunque sigue operando como God Component. Se ha priorizado la estabilidad de la persistencia JSON.

**I2. Renderer Markdown con regex inseguro (`toHtml`)**
- `utils/index.ts:149-187` usa regex para convertir Markdown → HTML y luego lo inyecta con `dangerouslySetInnerHTML`.
- Los links se renderizan con `<a href="${url}">` sin sanitización.
- **Riesgo**: XSS si el modelo genera Markdown con payloads maliciosos (ej: `[click](javascript:alert(1))`).
- **Solución propuesta**: Usar una librería establecida como `marked` + `DOMPurify`, o al mínimo sanitizar URLs en el regex de links.

**I3. Sin timeout en streaming de Ollama**
- `agent.ts:310-358` hace `fetch` a Ollama sin timeout. Si Ollama se cuelga, el agent loop queda bloqueado indefinidamente.
- El `AbortSignal` del usuario es la única forma de cortar, pero requiere acción manual.
- **Solución propuesta**: Envolver la llamada con un `Promise.race` contra un `setTimeout` de N segundos (configurable).

**I4. Sesiones se cargan completas en memoria (`get-sessions`)**
- `electron/main.cjs:99-119`: Para listar sesiones, se lee y parsea CADA archivo JSON completo solo para extraer `id`, `title`, y `messageCount`.
- **Riesgo**: Con cientos de sesiones, esto se vuelve lento y consume memoria.
- **Solución propuesta**: Mantener un índice ligero (`sessions_index.json`) que solo guarde metadata, actualizado al guardar/borrar sesiones.

**I5. `constructSystemInstruction` re-inyecta TODO el prompt en cada iteración**
- En `agent.ts:461-476`, el prompt del sistema completo se re-inyecta como `statusUpdate` en cada iteración del loop.
- **Riesgo**: El context window se inflama exponencialmente. En iteración 10, el mismo prompt aparece 11 veces.
- **Solución propuesta**: Solo inyectar el `NEURAL CORTEX HISTORY` y `PROTOCOL RULE`, sin re-inyectar `systemPrompt` completo en el status update.

#### 🟢 NICE-TO-HAVE

**N1. Sin soporte offline para búsquedas**
- `web_search` falla si no hay Tavily/Brave key. No hay fallback local.
- **Solución propuesta**: Implementar un fallback que busque en los archivos locales del usuario cuando no hay keys configuradas.

**N2. Sin export/import de sesiones**
- Las sesiones viven en `sessions/` como JSONs, pero no hay botón para exportar/importar.
- **Solución propuesta**: Botón "Exportar Sesión" que genera un `.json` descargable, y "Importar" que acepte un file upload.

**N3. Sin indicador visual de ejecución paralela**
- Cuando las herramientas se ejecutan en paralelo, el UI muestra un solo status genérico.
- **Solución propuesta**: Mostrar múltiples barras de progreso simultáneas con el nombre de cada herramienta.

**N4. `toHtml` no maneja tablas Markdown**
- El renderer custom no parsea tablas (`| header | header |`), que son fundamentales para presupuestos y planes.
- **Solución propuesta**: Agregar regex para tablas o migrar a `marked`.

**N5. Sin tema claro (Light Mode)**
- Todo el CSS está hardcodeado a dark mode (`bg-slate-900`, `text-slate-200`).
- **Solución propuesta**: Implementar CSS variables para theming con toggle en Settings.

**N6. Sin mecanismo de auto-actualización**
- La app Electron no tiene auto-update integrado.
- **Solución propuesta**: Integrar `electron-updater` con releases de GitHub.

---

## 4. Hoja de Ruta de Reparaciones Completadas 🔧 ✅

| # | Reparación | Estado | Cambio Realizado |
|---|-----------|--------|-----------------|
| 1 | `patch_file` | ✅ Done | `constants/index.ts` + `agent.ts` + `toolCallNormalizer.ts` |
| 2 | Sincronización de Contexto | ✅ Done | In-memory sync en `agent.ts` para `patch_file`, atomic write en `saveFile` |
| 3 | Paralelismo en el Loop | ✅ Done | `Promise.allSettled` para read-only tools en `agent.ts` |
| 4 | Assistant Blueprints | ✅ Done | 4 plantillas en `constants/index.ts` + drawer en `LibraryManager.tsx` |
| 5 | Editor Enriquecido | ✅ Done | Split-view editor con live preview en `LibraryManager.tsx` |
| 6 | TOOLS.md | ✅ Done | Documentadas 8 herramientas (era 4) |

---

## 5. Ruta de Acción Propuesta (Próximos Sprints) 🗺️

### Sprint 1: Seguridad Crítica 🔐 (Prioridad Máxima)
| Tarea | Archivo(s) | Complejidad | Impacto |
|-------|-----------|-------------|---------|
| **C1**: Enrutar Gemini/Groq por Electron proxy | `api.ts`, `main.cjs` | Media | Las API keys dejan de viajar por el renderer |
| **C2**: Cerrar canal IPC genérico | `preload.cjs` | Baja | Eliminar `invoke` genérico, usar solo handlers explícitos |
| **I2**: Sanitizar `toHtml` contra XSS | `utils/index.ts` | Media | Prevenir ejecución de scripts vía markdown malicioso |

### Sprint 2: Capacidad de Agente Expandida 🤖
| Tarea | Archivo(s) | Complejidad | Impacto |
|-------|-----------|-------------|---------|
| **C3**: Function Calling para Gemini | `api.ts`, `App.tsx` | Alta | Gemini puede ejecutar herramientas como Ollama |
| **C3b**: Function Calling para Groq | `api.ts`, `App.tsx` | Alta | Groq (OpenAI-compatible) puede ejecutar herramientas |
| **I3**: Timeout configurable en Ollama | `agent.ts`, `SettingsPanel.tsx` | Baja | Prevenir cuelgues infinitos |
| **I5**: Optimizar re-inyección de prompt | `agent.ts` | Baja | Ahorrar tokens de context window |

### Sprint 3: Arquitectura y Rendimiento 🏗️
| Tarea | Archivo(s) | Complejidad | Impacto |
|-------|-----------|-------------|---------|
| **I1**: Descomponer `App.tsx` en hooks | `App.tsx` → nuevos hooks | Alta | Código mantenible y testeable |
| **I4**: Índice ligero de sesiones | `main.cjs` | Media | Carga instantánea de lista de sesiones |
| **N4**: Parser de tablas en `toHtml` (o migrar a `marked`) | `utils/index.ts` | Media | Los presupuestos se ven correctamente |

### Sprint 4: Experiencia de Usuario 🎨
| Tarea | Archivo(s) | Complejidad | Impacto |
|-------|-----------|-------------|---------|
| **N2**: Export/Import de sesiones | `Sidebar.tsx`, `main.cjs` | Baja | Portabilidad de conversaciones |
| **N3**: Indicador visual de paralelismo | `AgentStatusPanel.tsx` | Baja | UX clara en ejecuciones paralelas |
| **N5**: Light Mode / Theming | `index.css`, `SettingsPanel.tsx` | Media | Accesibilidad visual |

### Sprint 5: Características Avanzadas 🚀
| Tarea | Archivo(s) | Complejidad | Impacto |
|-------|-----------|-------------|---------|
| Auto-Snapshots de progreso | `agent.ts`, nuevo componente | Media | Resúmenes automáticos de cumplimiento |
| Memoria Semántica (RAG) | Nuevo servicio + backend vectorial | Muy Alta | Recuerdo de aprendizajes pasados |
| Migración a MCP | Refactoring completo de tools | Alta | Interoperabilidad con ecosistema MCP |
| Gestión de Rutinas Dinámicas | Nuevo servicio de notificaciones | Alta | Recordatorios basados en archivos de horarios |

---

## 7. Log de Cambios 📋

### v1.8 — 23 Feb 2026 (Mechanical UX & Infrastructure Multi-App)
| Archivo | Cambio |
|---------|--------|
| `package.json` / `vite.config.ts` | **Port Migration**: Movido de puerto `3000` a `5173` para evitar conflictos con servidores Next.js y otros frameworks. |
| `src/index.css` | **Mechanical Spin**: Refinamiento estético del botón de stop (2.2s, `cubic-bezier(0.85, 0, 0.15, 1)`) para un visual de aceleración/frenado suave. |
| `src/components/features/ChatArea.tsx` | **Animation Refresh**: Uso de `key={isLoading}` en el icono de stop para forzar el reinicio de la animación y evitar glitches visuales. |
| `src/types/global.ts` | **isInstructionMode**: Nuevo campo en `AgentStatus` para sincronización precisa del efecto "Halo" durante ejecuciones de herramientas. |

### v1.7 — 22 Feb 2026 (Cinematic UX, Selective Skills & Visual Balance)
| Archivo | Cambio |
|---------|--------|
| `src/components/panels/SkillsPanel.tsx` | **Selective Skill Toggles**: Switch inline por skill para activar/desactivar inyección al agente. **Visual Balance**: Reducción de peso tipográfico (`font-black` → `font-semibold/bold`) en tarjetas, header, tabs, labels y botones. No auto-selecciona skill al entrar. |
| `src/components/features/ChatArea.tsx` | **Bottom-Aligned Chat**: Mensajes crecen de abajo hacia arriba con flex spacer. **Cinematic Session Transitions**: Efecto "TV On" se re-ejecuta al cambiar de sesión usando `sessionId` como React key. Animación aislada al área de mensajes (prompt bar estable). |
| `src/App.tsx` | **Skill Filtering**: Skills desactivadas se filtran tanto de las herramientas dinámicas como del bloque de configuración del system prompt. `sessionId` pasado como prop a ChatArea. |
| `src/types/global.ts` | **disabledSkills**: Nuevo campo `string[]` en `AppConfig` para persistir skills desactivadas. |
| `src/constants/core.ts` | **Default**: Añadido `disabledSkills: []` en configuración por defecto. |
| `src/index.css` | **Animation Cleanup**: Eliminados `filter: brightness()` de `chat-reveal-kf` y `control-room-enter` para evitar flashes. |

### v1.6 — 22 Feb 2026 (Cinematic Dynamics & Session Context)
| Archivo | Cambio |
|---------|--------|
| `src/components/layout/Sidebar.tsx` | **Refinamiento Logo**: Nueva secuencia de firma neural con símbolos de escape corregidos y timing cinemático. |
| `src/components/features/ChatArea.tsx` | **Visual Reactions & UX**: Implementación de `.btn-halo` y atajos de teclado (`Alt+Enter` para instrucciones/aprobación, `Esc` para abortar, `Enter` para reanudar si el input está vacío). |
| `src/components/panels/ToolApprovalPanel.tsx` | **Keyboard Control**: Implementada escucha global para `Alt+Enter` (Autorizar) y `Alt+Backspace` (Denegar). |
| `src/App.tsx` | **Progression Dynamics**: Auto-nombramiento de sesión a los 3 turnos y actualización progresiva cada 10 turnos basado en el nuevo contexto. |
| `src/services/core/agent.ts` | **Feedback Sync**: Inyección de `lastExecutionFeedback` en el canal de estado para notificar a la UI sobre el éxito/fallo de tareas. |
| `core/base/skills/gmail_imap` | **Communication Skill**: Integración neural con Gmail vía IMAP para lectura y búsqueda de correos. |
| `src/index.css` | **Premium Styles**: Optimización de `box-shadows`, eliminación de bordes cortados y nuevas `@keyframes` de vuelo de icono. |

### v1.3 — 19 Feb 2026 (Cinematic UI & Experience Overhaul)
| Archivo | Cambio |
|---------|--------|
| `src/index.css` | `@keyframes` Genie (macOS expand/shrink) + GPU acceleration (`will-change`). |
| `src/App.tsx` | Contenedores animados para Chat, Editors (Slide) y Control Room (Darken). |
| `src/components/layout/Sidebar.tsx` | `DeepSessionModal` con origen lateral (25% superior). + Icono bibliotecas en Slim Mode. + Versión v1.3.0. + Easter Egg: Neural Signature. |
| `src/components/features/LibraryManager.tsx` | Animación Genie (origen inferior) + Close delay sync. + Botón responsivo ("New Doc"). |
| `src/components/features/SessionList.tsx` | Botón expansible en el encabezado para el modal inmersivo. |
| `src/utils/easterEgg.ts` | **Nuevo**: Motor de firmas dinámicas con sets de emojis aleatorios. |
| `electron/main.cjs` | `minWidth` ajustado a 640px para estabilidad visual. |

### v1.1 — 15 Feb 2026 (Sprint 0: Reparaciones Iniciales)
| Archivo | Cambio |
|---------|--------|
| `src/constants/index.ts` | + Tool definition `patch_file` + `BLUEPRINT_TEMPLATES` (4 plantillas) |
| `src/services/agent.ts` | + `patch_file` execution logic + Parallel execution (read-only tools) + In-memory sync para patches |
| `src/services/toolCallNormalizer.ts` | + 16 aliases de nombre para `patch_file` + 22 aliases de argumentos |
| `src/components/LibraryManager.tsx` | Reescrito: Blueprints drawer, split-view editor con live preview, búsqueda |
| `src/App.tsx` | System prompt actualizado con `patch_file` + run_console |
| `src/index.css` | + Blueprint card animations + Parallel execution indicator |
| `TOOLS.md` | Actualizado de 4 → 8 herramientas documentadas |

### v1.2 — 15 Feb 2026 (Fix: Agent Loop + Safe Mode)
| Archivo | Cambio |
|---------|--------|
| `src/services/agent.ts` | Refactor a 2 ejes ortogonales: `safeMode` (secuencial vs batch) y `approvalMode` (auto vs manual). Helpers extraídos: `needsApproval()`, `requestApproval()`, `executeAndProcess()`, `validateAndReport()`. Fix deadlock paralelo. |
| `src/types/index.ts` | + `ApprovalMode` type. + Campo `approvalMode` en `AppState`. JSDoc actualizado para `safeMode`. |
| `src/components/ChatArea.tsx` | 2 toggles independientes (MANUAL/AUTO + SAFE/BATCH) solo visibles en modo Agent. Descripción dinámica por combinación. |
| `src/App.tsx` | + Import `ApprovalMode`, init `approvalMode: 'auto'`, props pasados a `sendAgentMessage` y `ChatArea`. |
| `projectStatus.MD` | Documentado sistema de 2 ejes. |

### v1.3 — 15 Feb 2026 (Refinement: Identity, Language & Proxy Sync)
| Archivo | Cambio |
|---------|--------|
| `src/services/agent.ts` | + Proxy Stores mutables para sync inmediato de archivos. + Bloques semánticos `thought`/`answer`. + Limpieza de basura técnica. |
| `src/services/toolCallNormalizer.ts` | + Normalización de parámetros arrays (sources). + Eliminación de deduplicación interna para soportar interleaving. |
| `src/components/ChatArea.tsx` | + Filtrado de 'thought' blocks vía Debug Mode. + Renderizado de 'answer' como Markdown prioritario. |
| `src/App.tsx` | + Inyección de `IDENTITY.md` + Protocolo de idioma español obligatorio en `constructSystemInstruction`. |
| `core/base/*` | + Actualización masiva de `AGENTS_MODES.MD`, `TOOLS.MD` e `IDENTITY.md` con manuales técnicos de recuperación. |

### v1.4 — 15 Feb 2026 (Refactor: Sandbox to WorkSpace)
| Archivo | Cambio |
|---------|--------|
| `src/types/index.ts` | Refactor de `FileTarget` y `AppState` para usar `workSpace` en lugar de `sandbox`. |
| `src/App.tsx` | Actualización de manejadores de archivos, estados y permisos (`workSpaceHandle`, `workSpaceFiles`). |
| `src/services/agent.ts` | Resolución de paths `@WORKSPACE/` y migración de lógica interna a nomenclatura WorkSpace. |
| `src/constants/index.ts` | Herramientas `read_file`, `update_file`, etc. ahora usan `workSpace` como valor por defecto. |
| `src/services/toolCallNormalizer.ts` | Actualizado diccionario de alucinaciones para mapear `sandbox` → `workSpace`. |
| `TOOLS.md` | Actualizada topografía del sistema con `@WORKSPACE`. |

### v1.5 — 18 Feb 2026 (Feature: Persistence, Context & Remote Formatting)
| Archivo | Cambio |
|---------|--------|
| `src/services/agent.ts` | + Contexto histórico de 3 turnos (6 mensajes). + Filtro de logs de comandos en contexto. + Integración de `formatFinalResponse`. |
| `src/services/answerFormatter.ts` | **Nuevo servicio**: Normalización de saltos de línea (Win/Unix), unescapado de artefactos JSON y preservación de párrafos. |
| `src/services/telegramFormatter.ts` | **Nuevo servicio**: Convertidor de Markdown a HTML para Telegram, soporte de encabezados y escapado de seguridad. |
| `src/App.tsx` | + Integración de `formatTelegramResponse` en respuestas remotas. |
| `.gitignore` | + Reglas para excluir cache de Python (`__pycache__`). Limpieza del índice del repo. |
| `Sidebar.tsx` | + Actualización de versión visual a `v1.2.0-alpha`. |

---
 
**Estado Final del Análisis**: El sistema ha dado un salto cualitativo hacia la **Omnipresencia**. Con la mejora en la memoria de contexto (3 turnos), el agente ya no "olvida" instrucciones inmediatas. La implementación de los formateadores de respuesta (`answerFormatter` y `telegramFormatter`) garantiza que la comunicación sea impecable tanto en el dashboard como en Telegram (móvil), respetando la jerarquía visual y la legibilidad. La arquitectura ahora es más robusta frente a las alucinaciones de formato de los modelos locales.

**Prioridades inmediatas**:
1.  **Agent Loop Repair**: Implementación de protocolo de persistencia de objetivos en `TASKS.md`.
2.  **Neural Engines Phase 1**: Memoria Semántica (RAG) en Python.
3.  **Security Sprint**: Enrutar API keys por Electron proxy y cerrar canal IPC genérico.

---

## 8. El Camino de la Miku Suprema (Project Phoenix) 🚀🔥

Para superar a OpenClaw y cualquier otro asistente, Miku debe evolucionar de un "Chatbot con Herramientas" a un "Agente de Agencia Total". Esta es la ruta lógica de integración de motores.

### 8.1 Los Nuevos Neural Engines (Python-Based)

| Fase | Motor | Capacidad | Prioridad |
| :--- | :--- | :--- | :--- |
| **1. Cerebro** | `knowledge_engine.py` | **RAG Semántico**: Memoria a largo plazo usando bases vectoriales locales (LanceDB). | 🔴 Crítica |
| **2. Sentidos** | `perception_engine.py` | **Miku Vision/Voice**: OCR de documentos, lectura de PDFs complejos y procesamiento de audio local (Whisper). | 🟡 Alta |
| **3. Acción** | `automation_engine.py` | **Navegador Autónomo**: Control de Playwright para "surfear" la web en tiempo real sin depender de Google/DuckDuckGo (Búsqueda Agéntica). | 🟡 Alta |
| **4. Manos** | `system_engine.py` | **Control de OS**: Automatización de ratón/teclado y gestión de ventanas vía `PyAutoGUI`. | 🔵 Media |
| **5. Vida** | `heartbeat_engine.py` | **Proactividad**: Bucle persistente que vigila eventos y envía alertas por Telegram sin intervención humana. | 🔵 Media |

### 8.2 Expansión Multi-Motor (Más allá de Python)

Para una soberanía total y rendimiento extremo, integraremos:

1.  **Docker Engine (Sandbox)**: Para ejecutar código generado por la IA en un entorno totalmente aislado. Si Miku escribe un script erróneo, el daño queda en el contenedor, no en tu PC.
2.  **Rust/Go Modules**: Para tareas de alto rendimiento como la búsqueda indexada instantánea en todo tu disco duro (reemplazando a `rg` o `fd` con lógica propia).
3.  **FFmpeg Engine**: Integración nativa para que Miku sea capaz de editar videos, extraer audios de clips de YouTube y optimizar medios profesionalmente.
4.  **Database Core (SQLite/Neo4j)**: Para la construcción de un **Knowledge Graph**. Miku no solo recordará textos, entenderá las conexiones lógicas entre tus ideas.

---

## 10. Arquitectura de Seguridad vs. Otros Agentes (OpenClaw) 🛡️

A diferencia de otros agentes que usan Gateways centralizados, MikuCentral se basa en un modelo de **Soberanía Individual**.

*   **Sin Intermediarios**: La comunicación Remote-to-Local (Telegram) es directa usando el Bot Token del usuario y filtrado por `chat_id`. No hay un servidor central que pueda ser hackeado para acceder a múltiples usuarios.
*   **Aislamiento del Entorno**: El motor de Python vive en una carpeta externa (`engine/`), facilitando la creación futura de contenedores (Docker) para aislar ejecuciones críticas.
*   **Human-in-the-Loop Nativo**: El panel de aprobación en Electron garantiza que ningún comando destructivo se ejecute sin supervisión visual del usuario, algo que se pierde en agentes de solo-mensajería.

---

## 11. Métricas del Codebase 📊

| Métrica | Valor |
|---------|-------|
| **Total de líneas (src/)** | ~4,200 |
| **Total de líneas (electron/)** | ~212 |
| **Componentes React** | 11 |
| **Servicios** | 5 |
| **Herramientas del Agente** | 10+ (Expandiendo) |
| **Neural Engines (Py)** | 2 (Search, Extract) |
| **Fases de Phoenix** | 5 Planificadas |
| **Proveedores de IA** | 3 |
| **Dependencias producción** | 5 |
| **Dependencias desarrollo** | 9 |

---

> **Nota final**: MikuCentral está entrando en su fase más ambiciosa. La arquitectura está lista para la transición de un asistente reactivo a un agente autónomo proactivo. La soberanía local es la base, la inteligencia distribuida es el futuro. 🌸🌐
