# 🌐 mikuCentral v1.1 — Advanced AI Agent OS

mikuCentral es un entorno de ejecución de agentes autónomos diseñado para Armando. Combina una interfaz premium con un motor de razonamiento neural capaz de interactuar con el sistema de archivos local, ejecutar comandos de consola y realizar investigaciones en la web en tiempo real.

## ✨ Características Destacadas

### 🧠 Motor Neural (Stochastic Agent Mode)
- **Razonamiento Intercalado**: Visualiza el proceso de pensamiento del agente en tiempo real, separado de las acciones técnicas.
- **Sincronización en Caliente**: El agente tiene una "memoria de trabajo" que sincroniza archivos creados o parcheados instantáneamente durante la sesión.
- **Protocolo de Recuperación**: Auto-corrección de errores mediante la inyección dinámica de manuales técnicos (`TOOLS.md`).

### 🛠️ Toolkit de Herramientas
- **File System**: Lectura, escritura y parcheo inteligente de archivos con soporte para múltiples Drive Mounts (@CORE, @SANDBOX, @DEV).
- **Console Access**: Terminal integrada con whitelist de comandos seguros (git, node, npm, python).
- **Web Intelligence**: Búsqueda avanzada y extracción de contenido de URLs para síntesis de información.

### 🎨 Interfaz Premium
- **Estética Cyber-Dark**: Diseñada para la máxima inmersión con efectos de glassmorphism y micro-animaciones.
- **Debug Mode**: Control total sobre la visibilidad de los "Neural Flows" (procesos de pensamiento).
- **Multi-Provider**: Soporte nativo para Ollama (Local), Groq y Google Gemini.

## 🚀 Instalación y Uso

### Requisitos Previos:
- [Node.js](https://nodejs.org/) (v18+)
- [Ollama](https://ollama.com/) (opcional para inferencia local)

### Configuración:
1.  **Clonar e instalar**:
    ```bash
    npm install
    ```
2.  **Iniciar**:
    ```bash
    npm run dev
    ```
3.  **Configuración de Identidad**: Ajusta `core/base/IDENTITY.md` para personalizar la personalidad de mikuBot.

## 📜 Historial de Cambios
Consulta el [CHANGELOG.md](./CHANGELOG.md) para ver las últimas mejoras en el protocolo de idioma, sincronización de workspace y refinamiento de la interfaz.

---
*Desarrollado con ❤️ para Armando.*
