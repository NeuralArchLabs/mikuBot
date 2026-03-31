# 🌟 MikuBot — Tu Asistente de IA Personal para Windows

![Estado](https://img.shields.io/badge/Estado-Estable-green.svg?style=for-the-badge)
![Plataforma](https://img.shields.io/badge/Plataforma-Windows_10%2F11-0078D4.svg?style=for-the-badge&logo=windows)
![Licencia](https://img.shields.io/badge/Licencia-AGPL--3.0-blue.svg?style=for-the-badge)

Un agente y asistente de IA dirigido al público general. Diseñado como una alternativa amigable, de fácil instalación y uso frente a herramientas más complejas como OpenClaw, ideal para usuarios que no tienen un alto conocimiento técnico.

---

## ✨ Características Principales

*   **Onboarding y Personalización Profunda:** Cuenta con un proceso de configuración inicial que te guía paso a paso. Desde el primer momento, puedes nutrir al asistente con toda la información que desees que sepa sobre ti, logrando un nivel de personalización absoluto para que entienda exactamente tu contexto, tus necesidades y cómo ayudarte de forma hiperespecífica.
*   **Autonomía y Modos de Operación:** Cuenta con un Modo Chat y un Modo Agente enfocados en diferentes tipos de asistencia, pero ambos con ejecución nativa de herramientas en el sistema. Puedes elegir entre un modo *completamente autónomo*, un *modo seguro* (requiere autorización previa a la ejecución), y la creación de **tareas programadas** para autonomía total.
*   **Librería de Contexto:** Un módulo que permite crear, almacenar y tener disponibles protocolos y documentos para referenciarlos, revisarlos, mejorarlos o aplicarlos con el asistente en cualquier momento.
*   **Voz y Conectividad 24/7:** Incluye reconocimiento de voz nativo *out of the box* (vía Vosk) en inglés y español para dictado y reconocimiento de mensajes. Además, permite vincularse fácilmente con Telegram (vía BotFather) para operar 24/7 y mantener una comunicación permanente y eficiente.
*   **Portabilidad y Respaldo:** Permite el volcado completo de memoria en un archivo comprimido para respaldar todo tu asistente, incluyendo sesiones, personalizaciones, memoria, *skills* y claves de acceso.
*   **Enfoque Windows-First:** Programado en Electron para escalabilidad, pero enfocado 100% en Windows para una perfecta integración nativa con **searXena**, sin planes a corto plazo para ser porteado a otros sistemas.

---

## 🤓 Under the Hood (Para Desarrolladores y Power Users)

Debajo de su interfaz amigable, MikuBot es un entorno de ejecución de agentes autónomos de grado profesional diseñado para la soberanía tecnológica. Aquí está la "carne técnica" para quienes desean compilar, modificar o auditar el sistema.

### 🧠 Inteligencia Neural Multimodelo
- **Ollama:** Inferencia 100% local y privada y acceso a modelos cloud con free Tier muy generoso.
- **Google AI:** Modelos Masivos con ventanas Masivas de contexto, free Tier disponible.
- **Groq:** Un amplio catálogo de modelos a escoger a precios razonables.
- **Z.AI (BigModel):** Capacidades avanzadas de codificación a un precio inigualable.
- **Neural Flow:** Interfaz que separa visualmente el pensamiento interno (*Internal Monologue*) de las acciones técnicas ejecutadas.

### 🛠️ Ecosistema de Herramientas y Seguridad
**Sistema de Archivos Multi-Raíz (`SafePathResolver`):**
- `@WORKSPACE/` — Directorio de proyectos principal.
- `@CORE/` — Lógica del sistema y prompts base.
- `@LIBRARY/` — Protocolos y bases de conocimiento.
- `@TOOLS/` — Blueprints de skills y scripts.

El sistema incluye herramientas nativas inyectadas al LLM como `read_file`, `smart_patch`, `search_files`, y protección contra inyecciones de shell (`run_console` whitelist).

### 🏆 ¿Por qué MikuBot? (Análisis Competitivo)
| Característica / Enfoque | 🌐 **MikuBot (Nuestro Enfoque)** | 🦞 **OpenClaw** | 🧠 **memUBot (NevaMind-AI)** |
| :--- | :--- | :--- | :--- |
| **Paradigma e Interfaz** | **App de Escritorio (GUI Premium).** Control visual total del razonamiento y gestión de archivos. | **Daemon Headless / Mensajería.** Se controla a través de WhatsApp, Telegram o la terminal (TUI). | **Bot Empresarial para Equipos.** Integrado principalmente en Slack, Discord o Feishu. |
| **Ejecución en Windows** | **100% Nativo (`.exe`).** Optimizado para correr directamente sobre el kernel de Windows. | **Requiere WSL2 (Ubuntu).** Depende de un subsistema Linux y scripts bash manuales. | Nativo / Multiplataforma, pero arquitectura pesada de servidores. |
| **Seguridad del Sistema** | **SafePathResolver.** Acceso restringido y lista blanca de comandos. *Zero-leak.* | **Riesgo Crítico.** Historial reciente de vulnerabilidades severas (ClawHub exploits). | **Seguridad Empresarial (SOC2).** Requiere configuraciones de permisos complejas. |

### 💻 Stack Tecnológico
| Componente | Tecnología |
| :--- | :--- |
| **Frontend** | React 19 + TypeScript |
| **Styling** | Vanilla CSS + Tailwind CSS 4.1 |
| **Desktop Runtime** | Electron 40.2 (Native Node.js integration) |
| **Build Tool** | Vite 6.2 |
| **State Management** | Zustand 5.0 |
| **Inferencia** | Google GenAI SDK, fetch-proxy para Ollama, OpenAI-compatible |

### 🚀 Instalación y Desarrollo Local
```bash
# 1. Clonar este repositorio
git clone [https://github.com/NeuralArchLabs/mikuBot.git](https://github.com/NeuralArchLabs/mikuBot.git)
cd mikuBot

# 2. Instalar dependencias
npm install

# 3. Ejecutar en modo Desarrollo (con Electron HMR)
npm run electron:dev

# 4. Compilar para Producción (Generar instalador .exe)
npm run electron:build
```

### ⚖️ Licencia y Atribuciones Open Source
Este proyecto se distribuye bajo la licencia **GNU Affero General Public License v3.0 (AGPL-3.0)**. Si modificas este programa y lo ofreces como servicio en red, debes poner el código fuente a disposición de tus usuarios.

**Reconocimientos a Terceros:**
MikuBot es posible gracias a tecnologías de código abierto como React (MIT), Vite (MIT), Electron (MIT), Tailwind CSS (MIT), Zustand (MIT), FastAPI (MIT), y SDKs de IA como Ollama y Google GenAI (Apache 2.0). Consulta el archivo [`LICENSE`](./LICENSE) para más detalles.

---

## 🏛️ Créditos y Aviso Legal (Disclaimer)

MikuBot es una iniciativa desarrollada y mantenida por **Neural Arch Labs**.

**Aviso sobre Marcas Registradas:** Este software utiliza nombres, logotipos y marcas comerciales de proveedores de inferencia de Inteligencia Artificial (tales como Google Gemini, Groq, Ollama, Z.AI, entre otros) con fines estrictamente referenciales e informativos orientados a la navegación del usuario final. **Neural Arch Labs no posee los derechos sobre estos logotipos ni nombres comerciales**, no tiene afiliación oficial ni patrocinio por parte de dichas entidades, y no obtiene ninguna ganancia, lucro o beneficio económico derivado de su uso o inclusión en la interfaz. MikuBot actúa únicamente como un cliente neutral (herramienta) para que el usuario consuma los servicios mediante sus propias configuraciones.

🤝 **Colaboraciones y Patrocinios:** Somos un laboratorio independiente comprometido con la tecnología de código abierto y la soberanía digital. Estamos completamente abiertos a colaboraciones corporativas, integraciones oficiales y patrocinios externos. Si representas a un proveedor de IA o deseas apoyar financieramente el desarrollo continuo de MikuBot, ¡no dudes en contactarnos!

---
*Desarrollado con precisión por Neural Arch Labs.*