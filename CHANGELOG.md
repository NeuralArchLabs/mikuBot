# Changelog

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
