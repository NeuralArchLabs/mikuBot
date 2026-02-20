# Changelog

## [1.5.0] - 2026-02-20

### 🛡️ Config Persistence & Neural Stability
- **Single Source of Truth (config.json)**:
    - Eliminación completa de `localStorage` para configuraciones globales en entornos nativos de Electron. Ahora el sistema confía íntegramente en `config.json` como la única fuente de verdad autoritativa.
    - Sincronización bidireccional atómica: Los cambios en el panel de Ajustes se escriben directamente al disco y se inyectan en el estado neural en tiempo real.
- **Master Path Enforcement**:
    - Las operaciones de sistema de archivos (Sync, Save, Delete) ahora priorizan las rutas configuradas en `config.json` sobre los handles temporales de IndexedDB cuando se ejecuta en modo escritorio. Esto garantiza que la estructura del Workspace se mantenga íntegra tras reinicios de la aplicación sin requerir re-autorizaciones manuales de carpetas.
- **Configuración Auto-Sanable (Self-Healing)**:
    - Implementación de un motor de recuperación de configuración. Si el sistema detecta la ausencia de `config.json` (borrado accidental o primer arranque), genera automáticamente una configuración base con presets de seguridad.
- **Neural Component Refactoring**:
    - Reestructuración masiva de `App.tsx` para eliminar la anidación excesiva de funciones de ciclo de vida (hooks), resolviendo bugs de "Race Conditions" durante el arranque del motor de inferencia.
    - Consolidación de `restoreHandlers` para una reconexión inmediata a los subsistemas neurales al inicio.

## [1.4.2] - 2026-02-20

### 🚀 Instalación y Onboarding Guiado (First Run)
- **Onboarding Wizard Integration**: 
    - Implementación de un asistente visual "First Run" de 3 pasos para primera configuración.
    - Creación y selección automática de las carpetas internas de la arquitectura (core, commands, workspace, library) en el equipo huésped (Ej. `C:\Users\...\mikuCentral`).
    - Recopilación inicial de Claves API (Gemini, Groq) y URL Local (Ollama) desde la primera pantalla.
    - **IPC Auto-Sync & Fallback**: MikuCentral ahora sincroniza las carpetas automáticamente usando procesos nativos del File System de Node.js (via IPC) si detecta que está corriendo dentro de Electron. Esto elimina por completo los pop-ups de permisos manuales de la Web File System Access API de navegadores durante el despliegue nativo.
- **Smart NSIS Installer**:
    - Abandono del instalador fantasma (`oneClick: true`); se pasa a un Instalador Nativo Interactivo (`nsis`) que permite seleccionar ruta y atajos de escritorio.
    - Script Nativo de Setup (`installer.nsh`) con requerimientos de sistema. Detecta el entorno e instala dependencias críticas y recomendadas automáticamente bajo demanda:
        - Requisito Crítico Estructural: Instalación silenciosa de `Microsoft Visual C++ Redistributable 2015-2022 (x64)`.
        - Dependencias de Motor Recomendadas: `Ollama` y `Git for Windows`.

## [1.4.1] - 2026-02-20

### 🖥️ Native OS Integration & Production Build
- **Application Menus Natives (MacOS/Windows)**:
    - Reemplazo completo del menú estándar de Electron por opciones de herramientas específicas de **MikuCentral** (Nueva Sesión, Cargar/Exportar Configuración).
    - Menú dinámico transversal: Aislado canal bidireccional entre eventos IPC y React State.
    - Opciones exclusivas bajo `Neural Engine`: `Sync Models (Ctrl+R)` y `Reset Global Config`.
- **Electron Build Fixes**:
    - Ajuste de iconos y configuración del empaquetador para heredar la iconografía en dependencias `.exe` compiladas por NSIS.
    - Definición robusta de motores (`app.isPackaged` y `resourcesPath`) evitando la pérdida de la ejecución Python externa tras el Build de ASAR.

## [1.4.0] - 2026-02-20

### 🛡️ Neural Security & File Management
- **Implementación de File Deletion**:
    - **Capa de Seguridad Multinivel**: Introducción de un flujo de borrado irreversible con confirmación obligatoria en Library Manager, Cortex y Command Editor.
    - **Risk Disclaimers**: Las áreas críticas (Cortex y Commands) ahora presentan un aviso de riesgo técnico previo a la confirmación final para prevenir pérdida de datos del sistema.
    - **Borrado Físico Real**: Integración directa con el File System Access API para eliminar entradas del disco y sincronizar el estado reactivo inmediatamente.
- **Rediseño del Secure Credential Vault**:
    - **Arquitectura de Tres Secciones**: El panel de configuración se ha reestructurado visualmente para elevar la seguridad a una sección primaria propia, separándola de la orquestación de modelos.
    - **Identidad Visual Ámbar**: Nueva iconografía (`shield-alt`) y separadores de gradiente premium para enfatizar el área de bóveda de credenciales y protocolo de Telegram.

## [1.3.1] - 2026-02-20

### 🚀 Optimización de Rendimiento & Auditoría
- **Memoización de Componentes Core**: Se implementó `React.memo` en componentes clave de alto nivel (como `SessionList` y relacionados) para evitar re-renderizados innecesarios del DOM cuando el estado global cambia, mejorando la fluidez neta de la aplicación sin alterar su comportamiento visual o funcional.
- **Auditoría UI/UX Responsiva**: Resolución de problemas de visualización en distintas relaciones de aspecto. Los botones de `SettingsPanel` ahora tienen fuentes e iconografía dinámicas (`md:`, `lg:`, `xl:`) garantizando que los textos no colisionen ni se trunquen en vistas de 4 columnas, y aprovechando el espacio horizontal en móviles.

### 🎨 Dialogs Inteligentes y Conciencia Espacial
- **Notificaciones Flexibles**: El motor del `SystemDialog` (alertas personalizadas) advierte desde qué lado de la pantalla fue disparada la acción y ajusta su animación de entrada y acople final basándose en ello (derecha para guardados, izquierda para eliminaciones).
- **Control de Resoluciones (`@media`)**: Comportamiento adaptativo real. En pantallas grandes (`1280px`+) las alertas obedecerán su conciencia lateral. En pantallas más reducidas y móviles, priorizarán siempre centrarse para no desbordar el viewport del usuario.

## [1.3.0] - 2026-02-19

### 🎨 Ultra UI Polish & Cinematic Experience
- **Sistema de Animaciones "Genie" (Style macOS)**:
    - Implementación de transiciones de expansión y contracción elásticas para los modales de Sesiones y Biblioteca de Contexto.
    - Orígenes dinámicos: Las sesiones emergen desde el lateral izquierdo (25% superior) y la biblioteca desde la parte inferior, optimizando la jerarquía visual.
    - Aceleración por GPU (`will-change`) para asegurar 60fps constantes durante las transiciones.
- **Transiciones de Pestañas Suaves**:
    - **Cortex & Command Editors**: Nueva animación de deslizamiento lateral lento (0.6s) que aporta elegancia al navegar entre códigos.
    - **Neural Chat**: Efecto de revelado gradual desde el fondo para una transición inmersiva.
    - **Control Room**: Animación de oscurecimiento y escalado sutil para enfatizar la profundidad del panel de configuración.
- **Easter Egg: Neural Signature**: Nueva interacción cinemática al hacer clic en el logo de mikuBot que revela la firma dinámica del agente (`{{🧠≈̼^.┬.̼^≈‿⟆✨}}`) con una secuencia de "succión" y reversión simétrica.

### 🛠️ Mejoras de Navegación y Estructura
- **Deep Session Modal**: El visualizador de sesiones ahora es un modal centralizado inmersivo con backdrop-blur, permitiendo una gestión mucho más cómoda que en la barra lateral estrecha.
- **Slim Mode (Context Library)**: Nuevo icono de "Libro" en la barra lateral contraída (slim) para acceso instantáneo a la biblioteca en resoluciones mínimas.
- **Resolución Crítica Optimizada**: Ajuste del ancho mínimo de la aplicación a **640px** (breakpoint SM estándar), asegurando que todos los elementos se vean perfectos sin amontonarse.
- **Renombrado Estratégico**: Cambio de "Library Context" a **Context Library** para una mejor semántica en el flujo de trabajo.

### 🐛 Bug Fixes
- **Z-Index Layering**: Reparación de colisiones visuales entre modales y banners de conexión pendientes. Los modales ahora se sitúan siempre por encima de cualquier otro elemento del sistema.
- **Dynamic New Doc Button**: El botón de "New Document" ahora detecta el ancho de pantalla y se contrae a "New Doc" para evitar solapamientos en ventanas pequeñas.


## [1.2.0] - 2026-02-18

### ✨ Mejoras en el Contexto del Agente
- **Memoria de Corto Plazo Activa**: El agente ahora mantiene los últimos 3 turnos (6 mensajes) del chat en modo Instrucción/Agente. Esto permite una mayor continuidad en tareas complejas sin degradar el rendimiento por saturación de contexto.
- **Filtro de Comandos**: Se eliminan del historial de contexto los logs técnicos de ejecución de comandos para mantener la ventana de contexto limpia y enfocada en la conversación.

### 📱 Optimización para Telegram y Remoto
- **Telegram HTML Formatter**: Implementación de un nuevo motor de formateo específico para Telegram (`telegramFormatter.ts`).
    - Conversión automática de Markdown a HTML compatible con Telegram.
    - Soporte para encabezados, negritas, cursivas y bloques de código.
    - Escapado de caracteres especiales para evitar fallos en la entrega de mensajes.
- **Preservación de Estructura**: Mejoras en el manejo de saltos de línea dobles para asegurar que Telegram respete la separación de párrafos y listas.

### 🛠️ Estabilidad y Refactorización
- **Answer Formatting Utility**: Creación de `answerFormatter.ts` para capturar y limpiar artefactos de los modelos locales (secuencias `\n` mal escapadas, comillas redundantes, etc.) en el dashboard principal.
- **Limpieza de Proyecto (Git Hygiene)**: Configuración avanzada de `.gitignore` para excluir automáticamente archivos de caché de Python y limpieza del índice del repositorio para eliminar archivos compilados preexistentes.
- **Normalización de Saltos de Línea**: Soporte nativo para saltos de línea Windows/Unix en todas las respuestas del agente.


## [1.1.0] - 2026-02-15

### ✨ Características Principales
- **Sistema de Identidad & Idioma (MikuBot Protocol)**: 
    - Implementación de inyección persistente de `IDENTITY.md` en el prompt del sistema.
    - Protocolo de idioma español obligatorio para todos los reportes y razonamientos internos.
    - Personalidad proactiva y amigable (mikuBot) integrada estructuralmente.
- **Visualización de Razonamiento Premium**:
    - Introducción de bloques semánticos `'thought'` (pensamientos) y `'answer'` (respuestas finales).
    - Intercalado cronológico de razonamiento y acciones para una narrativa de flujo neural.
    - "Debug Mode" en la interfaz para alternar la visibilidad de los procesos técnicos internos.
    - Limpieza agresiva de ruidos técnicos (JSON shards, firmas, frases repetitivas).

### 🚀 Mejoras en el Motor de Agente
- **Sincronización de Workspace en Tiempo Real**:
    - Implementación de "Proxy Stores" locales en el bucle del agente.
    - El agente ahora puede ver, leer y modificar archivos creados en el mismo turno de pensamiento sin errores de "Archivo no encontrado".
- **Extractor de Narrativa Avanzado**:
    - Mejora en la recuperación de llamadas a herramientas desde texto plano.
    - Normalización de parámetros complejos (arrays de fuentes) para evitar duplicación visual.
    - Sistema de "Dynamic Recovery" que inyecta manuales de herramientas desde `TOOLS.md` cuando se detectan fallos de sintaxis.

### 🛠️ Correcciones y Estética
- **Zero-Hallucination Policy**: Eliminación de ejemplos estáticos engañosos en los protocolos para evitar que el agente cite fuentes ficticias.
- **Corrección de Colapsables**: Mejora en el componente `CollapsibleTextBlock` para manejar correctamente el estado de los pensamientos antiguos.
- **Nudge de Protocolo**: Refactorización de los avisos de "Protocolo Incompleto" para ser menos intrusivos y más técnicos.

---

## [1.0.0] - 2026-02-13
- Versión inicial del sistema mikuCentral con soporte para múltiples proveedores (Ollama, Groq, Gemini).
- Estructura básica de herramientas de archivos y consola.
- Interfaz basada en React + Vite con estética cibernética.
