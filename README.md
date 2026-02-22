# 🌐 mikuCentral v1.6.0 — Neural AI Interface & Agent OS

![Version](https://img.shields.io/badge/version-1.6.0-blue.svg?style=for-the-badge)
![Status](https://img.shields.io/badge/status-stable-green.svg?style=for-the-badge)
![License](https://img.shields.io/badge/license-private-red.svg?style=for-the-badge)

**mikuCentral** es un entorno de ejecución de agentes autónomos de grado profesional diseñado para la soberanía tecnológica. Combina una interfaz estética premium con un motor de razonamiento neural capaz de orquestar flujos de trabajo complejos, interactuar con el sistema de archivos local y ejecutar comandos nativos mediante la infraestructura de **Electron**.

---

## ✨ Características Destacadas

### 🧠 Inteligencia Neural Multimodelo
- **Multi-Provider**: Soporte nativo para **Ollama** (Inferencia 100% local), **Google Gemini Pro** (Cloud) y **Groq** (LPU de ultra-baja latencia).
- **Razonamiento Estructurado**: Un motor de extracción propietario permite que incluso modelos básicos sigan protocolos de herramientas (tool calling) mediante síntesis de texto.
- **Neural Flow**: Interfaz que separa visualmente el pensamiento interno (*Internal Monologue*) de las acciones técnicas ejecutadas por el agente.

### 🛡️ Persistencia y Soberanía (Session States)
- **Session-Scoped Configuration**: Cada chat guarda su propio modo (Chat/Agent), estados de seguridad y borradores de texto inteligentes.
- **Single Source of Truth**: Gestión de configuración centralizada en `config.json`. Sin dependencias de almacenamiento volátil del navegador.
- **Atomic Import/Export**: Capacidad de exportar e importar configuraciones completas de la IA, incluyendo llaves API, rutas de memoria y modelos preferidos.
- **Neural Resilience**: Persistencia de sesiones locales para ramificar conversaciones y mantener contextos históricos infinitos.

### 🛠️ Ecosistema de Herramientas (The Toolbelt)
- **Native File System**: Lectura, escritura, borrado y particionamiento de archivos en tiempo real con rutas absolutas de Windows.
- **Integrated Terminal**: Ejecución de comandos seguros (`git`, `node`, `python`, etc.) directamente desde la interfaz del agente.
- **Web Intelligence**: Motor de búsqueda integrado y extractor de markdown desde URLs para investigación profunda.
- **Native Explorer**: Integración directa con el explorador de Windows para abrir carpetas de proyecto con un solo click.

### 🎨 Estética Cinema-Dark Premium
- **Premium VFX**: Botones con animaciones de "Halo" dinámico, efectos de glifo pulsante y transiciones de "vuelo" para el envío de datos.
- **Visual Feedback Loop**: La interfaz reacciona físicamente al éxito o fallo de las tareas mediante sincronización visual con el motor neural.
- **Glassmorphism UI**: Interfaz diseñada con capas de profundidad, desenfoques dinámicos y micro-animaciones fluidas.
- **Neural Sidebar**: Navegación rápida con animación de firma neural sofisticada al interactuar con el logo del sistema.
- **Onboarding Wizard**: Asistente de configuración inicial para una puesta en marcha automatizada en menos de 60 segundos.

---

## 🛠️ Stack Tecnológico

| Componente | Tecnología |
| :--- | :--- |
| **Frontend** | React 19 + TypeScript |
| **Styling** | Vanilla CSS + Tailwind CSS 4.0 |
| **Desktop Runtime** | Electron 40.2 (Native Node.js integration) |
| **Build Tool** | Vite 6.2 |
| **Inferencia** | Google GenAI SDK, fetch-proxy para Ollama |

---

## 🚀 Instalación y Desarrollo

### Requisitos Previos:
- **Node.js** (v20+ recomendado)
- **npm** o **pnpm**
- **Ollama** (Opcional, para ejecución 100% privada)

### Pasos para Desarrolladores:

1.  **Clonar este repositorio neural**:
    ```bash
    git clone https://github.com/martinezpalomera92/mikuCentralv1.0.git
    cd mikuCentralv1.0
    ```

2.  **Instalar dependencias**:
    ```bash
    npm install
    ```

3.  **Ejecutar en modo Desarrollo (con Electron HMR)**:
    ```bash
    npm run electron:dev
    ```

4.  **Compilar para Producción (Generar instalador .exe)**:
    ```bash
    npm run electron:build
    ```

---

## 📂 Estructura de la Arquitectura Neural

- `electron/`: Proceso principal nativo (main process). Handlers de persistencia y sistema de archivos.
- `src/components/`: Interfaz modular (Chat, Settings, Sidebar, Onboarding).
- `src/services/`: Capa lógica de core (Persistencia, AI Providers, Telegram Sync).
- `engine/`: Modelos de agentes y configuraciones de identidad.
- `config.json`: (Generado automáticamente) El ADN de tu configuración local.

---

## 📜 Historial de Evolución
Consulta el [CHANGELOG.md](./CHANGELOG.md) para detalles técnicos sobre las últimas actualizaciones del protocolo de persistencia y refinamiento de la interfaz.

---
*Desarrollado con precisión por Antigravity AI para Armando.*
