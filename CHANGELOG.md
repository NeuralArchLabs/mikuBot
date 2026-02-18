# Changelog

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
