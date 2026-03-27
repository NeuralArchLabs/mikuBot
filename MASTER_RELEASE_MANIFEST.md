# 🦾 MASTER RELEASE ORCHESTRATION MANIFEST (v2.1.0 - Corrección Arquitectónica)
**Estado:** Documento de Referencia Técnica Absoluta para el Lanzamiento Público.

Este manifiesto desglosa la visión técnica de MikuCentral en 4 Sprints de Alta Intensidad, delegando a Agentes IA especializados (SecOps, Arquitecto, Persona, DevOps) tareas de precisión quirúrgica. Se han incorporado parches críticos para proteger la lógica de auto-sanado de la v2.0.0 y el manejo de prefijos semánticos.

---

## 👥 Estructura de Roles y Mando (Agentes IA)
> [!IMPORTANT]
> **LEER PRIMERO:** Todas las acciones de los agentes deben regirse estrictamente por el Catálogo de Directivas. Ninguna instancia debe desviarse de estas reglas de oro para evitar regresiones o colisiones técnicas.

### 🕵️ Agente SecOps (Ciberseguridad y Núcleo Nativo)
- **Dominio:** `electron/`, `agentActions.cjs`, IPC Handlers.
- **Misión:** Blindar el sistema contra inyecciones y accesos no autorizados mediante validación determinista de rutas y timeouts híbridos.

### 🏗️ Agente Arquitecto (Estructura, UX y Escalabilidad)
- **Dominio:** `src/App.tsx`, `src/services/formatters/`, `src/stores/`.
- **Misión:** Aislar el estado de renderizado masivo y orquestar el formateo de LLMs sin romper las integraciones específicas (Gemma 3, Telegram).

### 🎭 Agente Persona (Identidad, Psicología y Prompting)
- **Dominio:** `@CORE/` (User-side), `IDENTITY.md`, Lógica de Generación de Perfil.
- **Misión:** Crear el "ADN" del asistente y optimizar la economía de tokens mediante inyección de contexto dinámico.

### 🚀 Agente DevOps (Flujo de Instalación y Estabilidad)
- **Dominio:** `OnboardingWizard.tsx`, `installer.nsh`, `main.cjs` (Setup logic).
- **Misión:** Garantizar que la primera experiencia del usuario sea perfecta ("Zero Friction") y proteger credenciales en el llavero nativo.

---

## 🏃 Sprint 1: Protocolo de Blindaje Total (Fase Crítica)

### [🕵️ SecOps] S1.1: Sistema de Sandbox Consciente de Prefijos ("Zero Leak")
- **Acción:** Creación de `electron/SafePathResolver.cjs`.
- **Lógica Paso a Paso:** 
    1. Interceptar la ruta solicitada por el agente y extraer el prefijo semántico (ej. `@LIBRARY/`, `@CORE/`).
    2. Calcular dinámicamente el `slice` correspondiente a la longitud del prefijo (ej. 9 caracteres para `@LIBRARY/`).
    3. Mapear el prefijo al directorio físico correspondiente en el host.
    4. Aplicar `resolvedPath = path.resolve(mappedRoot, cleanPath)`.
    5. Validar estrictamente: `if (!resolvedPath.startsWith(path.normalize(mappedRoot))) throw SecurityError`.
- **Integración:** Envolver todas las llamadas (`read`, `write`, `patch`, `delete`, `list`, `search`) en `main.cjs` y `agentActions.cjs` con este resolver.

### [🕵️ SecOps] S1.2: Motor de Consola con Timeout Híbrido
- **Acción:** Blindar `run_console` en `main.cjs` y actualizar el schema de la herramienta.
- **Lógica Paso a Paso:**
    1. Modificar el JSON de la herramienta `run_console` para aceptar un `timeout_ms` opcional.
    2. En el handler nativo, capturar el timeout solicitado y aplicar un techo seguro: `const safeTimeout = Math.min(args.timeout_ms || 15000, 120000);`.
    3. Migrar la ejecución principal a `child_process.spawn(command, args, { timeout: safeTimeout })` para evitar inyecciones por concatenación.
    4. Bloquear operadores (`>`, `>>`, `|`, `&`, `;`) mediante regex antes de ejecutar.
    5. Si el proceso termina por `SIGTERM` debido al timeout, retornar al agente el string: `[SYSTEM_ERROR: El comando excedió el límite de tiempo]`.

### [🕵️ SecOps] S1.3: Exclusión y Preservación de searXena
- **Acción:** Mantener la arquitectura nativa HTTP introducida en v1.9.9.
- **Lógica Paso a Paso:** 
    1. Asegurar que las herramientas `read_url`, `web_research` y `deep_research` **NO** pasen por `run_console` ni `spawn`.
    2. Garantizar que se comuniquen exclusivamente mediante peticiones HTTP (Node `http` o `fetch`) al puerto 8000 local, enviando payloads JSON para preservar caracteres multi-byte.

---

## 🏃 Sprint 2: Re-arquitectura de Estado y Orquestación (Fase de Pulido)

### [🏗️ Arquitecto] S2.1: Migración a Estado Atómico (Zustand)
- **Acción:** Eliminar los cuellos de botella de renderizado en `App.tsx` causados por el streaming.
- **Lógica Paso a Paso:**
    1. Instalar Zustand y crear `src/stores/useAgentStore.ts`.
    2. Migrar los estados de alta frecuencia (`chatHistory`, `isStreaming`, `currentThought`) fuera de la jerarquía de React Context o `useState` de nivel superior.
    3. Refactorizar los componentes visuales (como la burbuja de chat) para que se suscriban únicamente al nodo del estado que necesitan (`useAgentStore(state => state.currentThought)`), garantizando que el resto de la UI permanezca inerte a 60fps durante la generación de tokens.

### [🏗️ Arquitecto] S2.2: Patrón Estrategia para Formateadores
- **Acción:** Reestructurar los formateadores sin romper compatibilidad de modelos.
- **Lógica Paso a Paso:**
    1. Crear la interfaz base `IFormatter` en `src/services/formatters/`.
    2. Implementar clases aisladas: `GemmaFormatter` (que mantenga la lógica de supresión de dobles respuestas y limpieza de artefactos), `TelegramFormatter` (para conversión a HTML puro) y `StandardFormatter`.
    3. En `AgentOrchestrator`, inyectar dinámicamente el formateador instanciado dependiendo del `modelID` activo y el contexto de la petición.

---

## 🏃 Sprint 3: Expansión Quirúrgica de Markdown y UI

### [🏗️ Arquitecto] S3.1: Protección y Extensión de `Common.tsx`
- **Acción:** Añadir interactividad sin alterar el motor de auto-sanado.
- **Lógica Paso a Paso:**
    1. **PROTECCIÓN ABSOLUTA:** Inyectar comentarios block-level en la función de conversión de tablas 2D y el `IntersectionObserver` prohibiendo su modificación.
    2. **Listas Interactables:** Implementar la captura de `- [ ]` y `- [x]` para renderizar checkboxes interactivos que actualicen el archivo físico de origen sin re-renderizar todo el chat.
    3. **Copiar Código:** Inyectar un botón `Copy` en la cabecera de los tags `<pre><code>`. Asegurar que el algoritmo `Typewriter` ignore la inyección de este botón validándolo en su comprobación interna `isTag`.

---

## 🏃 Sprint 4: El Portal de Personalización y Seguridad (Fase Funcional)

### [🎭 Persona] S4.1: Arquitectura de Esqueletos y Prompt Builder
- **Acción:** Optimizar la inyección de la personalidad sin saturar la ventana de contexto.
- **Lógica Paso a Paso:**
    1. Crear plantillas en `resources/core/templates` (`IDENTITY.md`, `SOUL.template.md`, `USER.template.md`) con placeholders `{{VAR}}`.
    2. Implementar `SystemPromptBuilder.ts`. En lugar de inyectar el directorio completo, este servicio leerá los archivos de disco y generará un prompt minificado.
    3. Habilitar la inyección condicional: El `SystemPromptBuilder` solo adjuntará las instrucciones completas de las herramientas (`TOOLS.md`) si el agente está operando en "Instruction Mode", reservando tokens valiosos en el "Chat Mode".

### [🚀 DevOps] S4.2: Encriptación de Credenciales (SafeStorage)
- **Acción:** Migrar el guardado de API Keys (Gemini, Groq) en `config.json` al llavero nativo.
- **Lógica Paso a Paso:**
    1. En `main.cjs`, verificar disponibilidad con `safeStorage.isEncryptionAvailable()`.
    2. Interceptar el guardado de llaves y procesarlas con `safeStorage.encryptString(apiKey)`.
    3. Modificar los inyectores de estado inicial para usar `safeStorage.decryptString(buffer)` al enviar la configuración validada al frontend.

### [🚀 DevOps] S4.3: Onboarding y HealthCheck
- **Acción:** Diagnóstico pre-vuelo en el asistente inicial.
- **Lógica Paso a Paso:**
    1. Implementar la recolección de variables psicográficas en la UI (Modo, Tono, Nombre) para compilar los templates del Sprint 4.1.
    2. Ejecutar un ping nativo a los puertos 8000 (searXena) y 11434 (Ollama). Mostrar indicadores verdes/rojos en la UI del instalador para bloquear al usuario de iniciar sesiones inútiles si los motores están caídos.