<div align="center">

<img src="./public/mikuBotICON.png" width="120" style="border-radius: 24px" alt="mikuBot Icon" />

# 🌟 mikuBot v2.3.0 — The Sovereign Persistence Update

![Estado](https://img.shields.io/badge/Estado-Estable-green.svg?style=for-the-badge)
![Plataforma](https://img.shields.io/badge/Plataforma-Windows_10%2F11-0078D4.svg?style=for-the-badge&logo=windows)
![Licencia](https://img.shields.io/badge/Licencia-AGPL--3.0-blue.svg?style=for-the-badge)

[English](README.en.md) | [中文](README.zh.md)

<br/>

<a href="https://github.com/NeuralArchLabs/mikuCentralv1.0">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=32&pause=3000&color=60A5FA&center=true&vCenter=true&width=600&height=60&lines=mikuCentral;%7B%7B%F0%9F%A7%A0%E2%89%88%5E.%E2%94%AC.%5E%E2%89%88%E2%80%BF%E2%9F%86%E2%9C%A8%7D%7D;mikuCentral" alt="Neural Signature" />
</a>

<br/>

<a href="https://github.com/NeuralArchLabs/mikuBot/releases/download/v2.3.0/mikuBot-Setup-2.3.0.exe">
  <img src="https://img.shields.io/badge/DESCARGAR_ÚLTIMA_VERSIÓN-v2.3.0-60A5FA?style=for-the-badge&logo=windows&logoColor=white" height="40" />
</a>

<br/>

Un agente y asistente de IA dirigido al público general. Diseñado como una alternativa amigable, de fácil instalación y uso frente a herramientas más complejas como OpenClaw, ideal para usuarios que no tienen un alto conocimiento técnico.

<br/>

<img src="./public/preview.gif" width="100%" style="border-radius: 12px; border: 1px solid #30363d" alt="mikuBot Preview" />

</div>

---

## ✨ Características Principales

*   **Onboarding y Personalización Profunda:** Cuenta con un proceso de configuración inicial que te guía paso a paso. Desde el primer momento, puedes nutrir al asistente con toda la información que desees que sepa sobre ti, lo que permite un nivel de personalización absoluto para que el sistema entienda exactamente tu contexto, tus necesidades y cómo ayudarte de forma hiperespecífica.
*   **Autonomía y Modos de Operación:** Cuenta con un Modo Chat y un Modo Agente enfocados en diferentes tipos de asistencia, pero ambos con ejecución nativa de herramientas en el sistema. Puedes elegir entre un modo *completamente autónomo*, un *modo seguro* (requiere autorización previa a la ejecución), y la creación de **tareas programadas** para autonomía total.
*   **Ejecución Persistente y Multi-sesión (Studio Elite):** Miku ya no se detiene al cambiar de rama neural. Los agentes pueden completar tareas complejas de forma autónoma en segundo plano mientras interactúas con otras sesiones, manteniendo un enlace persistente y visualmente reactivo que te notifica el estado de procesos en otras ramas.
*   **Librería de Contexto:** Un módulo que permite crear, almacenar y tener disponibles protocolos y documentos para referenciarlos, revisarlos, mejorarlos o aplicarlos con el asistente en cualquier momento.
*   **mikuBot Markdown Engine (Studio Elite):** mikuBot integra un motor de renderizado de grado profesional diseñado para la soberanía tecnológica y la precisión técnica. Esta suite "Studio Elite" redefine la interacción visual:
    *   **Renderizado Científico de Grado Profesional (LaTeX):** Motor de alta precisión para matemáticas complejas ($$ y $), integrales, matrices y constantes físicas. Convierte a mikuBot en una herramienta de reporte técnico indispensable para investigadores y estudiantes.
    *   **Arquitectura y Lógica de Datos (Mermaid):** Visualización nativa de diagramas de flujo, GitGraphs y mapas mentales. Elimina la necesidad de herramientas externas al renderizar lógica y arquitectura directamente en el hilo de conversación.
    *   **Gestión de Conocimiento Estructurado (Callouts):** Soporte universal estilo Obsidian (`> [!TYPE]`) para organizar instrucciones, logs y protocolos con 14 estilos reactivos y animación de flujo sincronizada.
    *   **Canvas Cinético y Progresivo:** Sistema de animaciones orgánicas y tipografía dinámica que sincroniza el revelado de información con el pensamiento real del asistente, proporcionando una experiencia viva y reactiva.
    *   **Integridad de Documentación (Protection Pipeline):** Pipeline de 3 fases que garantiza que imágenes, links y bloques de código anidados mantengan su estructura perfecta, independientemente de la complejidad del flujo de datos de IA.
*   **Edición Neural (Cortex & Command Editors):** mikuBot incluye editores especializados para modificar directamente las instrucciones y el conocimiento base del asistente. Aunque puedes ajustar estos archivos en cualquier momento para una personalización técnica, **se recomienda seguir el proceso del Onboarding Wizard** para obtener resultados óptimos. Archivos críticos como `MODES.md` dictan los protocolos de operación del agente y su manipulación manual requiere precaución para mantener la estabilidad del sistema.
*   **Voz y Conectividad 24/7:** Incluye reconocimiento de voz nativo *out of the box* (vía Vosk) en inglés y español para dictado y reconocimiento de mensajes. Además, permite vincularse fácilmente con Telegram (vía BotFather) para operar 24/7 y mantener una comunicación permanente y eficiente.
*   **Soporte Multilingüe al 100% (ES/EN/ZH):** A diferencia de otras alternativas en el mercado que suelen estar limitadas a un solo idioma, mikuBot está **completamente traducida y optimizada** para funcionar plenamente en **Español, Inglés y Chino**. Desde la interfaz hasta el razonamiento del agente, el sistema ofrece una experiencia nativa y fluida en los tres idiomas, dándonos una superioridad técnica y de uso global.
*   **Portabilidad y Respaldo:** Permite el volcado completo de memoria en un archivo comprimido para respaldar todo tu asistente, incluyendo sesiones, personalizaciones, memoria, *skills* y claves de acceso.
*   **Enfoque Windows-First:** Programado en Electron para escalabilidad, pero enfocado 100% en Windows para una perfecta integración nativa con **searXena**, sin planes a corto plazo para ser porteado a otros sistemas.

---

## 🤓 Under the Hood (Para Desarrolladores y Power Users)

Debajo de su interfaz amigable, mikuBot es un entorno de ejecución de agentes autónomos de grado profesional diseñado para la soberanía tecnológica.

### 🏛️ Origen e Integridad del Proyecto
mikuBot es un proyecto 100% independiente, iniciado a principios de **febrero de 2026** (ver imagen de evidencia abajo) como un esfuerzo por optimizar modelos locales de pocos parámetros (SLMs) para ejecutar herramientas y tareas agénticas de forma eficiente. Su desarrollo ha sido planeado y ejecutado bajo metodologías ágiles, basándose estrictamente en investigación, prueba y error hasta alcanzar su estado actual.

No es un fork de OpenClaw ni reutiliza ninguna lógica de las filtraciones de **Claude Code** (31 de marzo 2026). Apostamos por la transparencia y la arquitectura propia como base de un sistema seguro y soberano.

<div align="center">
  <img src="./public/startDateEvidence.png" width="600" style="border-radius: 8px; border: 1px solid #30363d" alt="Evidencia de Inicio del Proyecto" />
  <p><i>Captura de los primeros commits del núcleo lógico de mikuBot (Febrero 2026).</i></p>
</div>

> [!NOTE]
> Por motivos de seguridad del historial del repositorio (prevención de fugas accidentales de claves de desarrollo u otros datos sensibles del entorno temprano), el código se publicó en GitHub de forma "limpia" en una fecha posterior a su inicio real.

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

### 🏆 ¿Por qué mikuBot? (Análisis Competitivo)

mikuBot no es solo otro cliente de IA; es un entorno de ejecución agéntica diseñado para la soberanía de datos y la precisión técnica. A continuación, comparamos nuestro enfoque frente a otros agentes locales y los clientes web más populares.

#### 🏛️ Nivel 1: Agentes Autónomos Locales

| Característica / Enfoque | 🌐 **mikuBot (Nuestro Enfoque)** | 🦞 **OpenClaw** | 🧠 **memUBot (NevaMind-AI)** |
| :--- | :--- | :--- | :--- |
| **Paradigma e Interfaz** | **App de Escritorio (GUI Premium).** Control visual total del razonamiento y gestión de archivos. | **Daemon Headless / Mensajería.** Se controla a través de WhatsApp, Telegram o la terminal (TUI). | **Bot Empresarial para Equipos.** Integrado principalmente en Slack, Discord o Feishu. |
| **Ejecución en Windows** | **100% Nativo (`.exe`).** Optimizado para correr directamente sobre el kernel de Windows. | **Requiere WSL2 (Ubuntu).** Depende de un subsistema Linux y scripts bash manuales. | Nativo / Multiplataforma, pero arquitectura pesada de servidores. |
| **Curva de Aprendizaje** | **Instantánea (Wizard-led).** Instalación y configuración guiada paso a paso para cualquier usuario. | **Alta.** Requiere profundos conocimientos de terminal y entornos Linux. | **Moderada.** Configuración orientada a departamentos de IT y flujos empresariales. |
| **Razonamiento Visual** | **Neural Flow.** Streaming visual de pensamientos, herramientas y estados en tiempo real. | **Logs de Texto.** Salida cruda de terminal sin representación visual del estado interno. | **Historial Estándar.** Interfaz de chat convencional sin desglose técnico visual. |
| **Transparencia** | **Anti-Black Box.** Capacidad de inspeccionar prompts y payloads en tiempo real. | **Caja Negra Parcial.** Lógica interna de prompts oculta tras el CLI. | **Propiedad Cerrada.** Lógica de decisión privada del servidor. |
| **Idiomas (Soberanía)** | **Universal (ES/EN/ZH).** Paridad absoluta de funciones y razonamiento en los 3 idiomas. | **EN-Centric.** Soporte optimizado casi exclusivamente para el inglés. | **EN-Centric.** Soporte multilingüe limitado. |

#### ☁️ Nivel 2: Clientes Web de IA

| Característica | 🌐 **mikuBot (Local Gateway)** | 🤖 **ChatGPT / Gemini / Perplexity** |
| :--- | :--- | :--- |
| **Acceso a Datos** | **Contexto Profundo.** Acceso directo a tu sistema de archivos (@WORKSPACE) y activos locales. | **Sandbox Web.** Limitado a archivos subidos manualmente o búsqueda web genérica. |
| **Ejecución de Herramientas**| **Soberanía Total.** Ejecución nativa de Python, SearXena y scripts sin intermediarios. | **Nube Restringida.** Ejecución de código en servidores remotos aislados y limitados. |
| **Precisión e Información** | **Atención Personalizada.** Prioriza tus archivos y herramientas para evitar suposiciones. | **Propensión al Alucinamiento.** Pueden suponer datos si la búsqueda web es insuficiente. |
| **Privacidad y Control** | **Tú Eres el Dueño.** Los datos son tuyos; tú eliges el proveedor y qué información compartes. | **Ecosistema Cerrado.** Tus datos suelen usarse para entrenar modelos futuros del proveedor. |
| **Visualización** | **Studio Elite.** Renderizado científico de LaTeX, Mermaid y Callouts de alta fidelidad. | **Markdown Básico.** Visualización estándar de navegador con poca flexibilidad técnica. |

#### 🚀 La Ventaja mikuBot: Los 4 Pilares de Excelencia

1.  **Rendimiento Nativo:** Sin capas de traducción ni virtualización; Miku habla el lenguaje de tu PC para una latencia mínima.
2.  **Precisión y Personalización (Powered by [searXena](https://github.com/NeuralArchLabs/searXena)):** Nada de suposiciones. Miku consulta tus archivos y utiliza el motor de metabúsqueda soberano **searXena** (desarrollado nativamente por nosotros) antes de responder, garantizando resultados exactos y actualizados.
3.  **Transparencia Absoluta (Anti-Black Box):** Tú tienes el control total. Cada decisión del modelo, cada prompt y cada dato enviado es auditable en tiempo real.
4.  **Libertad de Proveedor:** Cambia de cerebro (Ollama, Gemini, Groq, Z.AI) en segundos sin perder tu flujo de trabajo. Miku es tu interfaz soberana universal.

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

```

### ⚖️ Licencia y Atribuciones Open Source
Este proyecto se distribuye bajo la licencia **GNU Affero General Public License v3.0 (AGPL-3.0)**. Si modificas este programa y lo ofreces como servicio en red, debes poner el código fuente a disposición de tus usuarios.

**Reconocimientos a Terceros:**
mikuBot es posible gracias a tecnologías de código abierto como React (MIT), Vite (MIT), Electron (MIT), Mermaid.js (MIT), Font Awesome Free (CC BY 4.0 / MIT / SIL OFL 1.1), **Outfit Font (SIL OFL 1.1)**, **Vosk Engine (Apache 2.0)**, Tailwind CSS (MIT), Zustand (MIT), i18next (MIT), unzipper (MIT), FastAPI (MIT), y SDKs de IA como Ollama y Google GenAI (Apache 2.0). Consulta el archivo [`LICENSE`](./LICENSE) para más detalles.

**Motor Python Embebido:**
mikuCentral incluye Python 3.11.9 embebido como motor general para todas las funcionalidades basadas en Python (SearXena, reconocimiento de voz, ejecución de skills). Python se distribuye bajo la **Python Software Foundation License Version 2**, una licencia permissiva que permite su uso en software propietario sin obligación de opensource. El paquete también incluye componentes bajo licencias MIT (libffi), BSD (bzip2, Tcl/Tk), y Microsoft Distributable Code para Windows. Consulta [`engine/python/LICENSE.txt`](./engine/python/LICENSE.txt) para los términos completos de distribución de Python.

---

## 🏛️ Créditos y Aviso Legal (Disclaimer)

mikuBot es una iniciativa desarrollada y mantenida por [**Neural Arch Labs**](https://github.com/NeuralArchLabs).

**Aviso sobre Marcas Registradas:** Este software utiliza nombres, logotipos y marcas comerciales de proveedores de inferencia de Inteligencia Artificial (tales como Google Gemini, Groq, Ollama, Z.AI, entre otros) con fines estrictamente referenciales e informativos orientados a la navegación del usuario final. **[Neural Arch Labs](https://github.com/NeuralArchLabs) no posee los derechos sobre estos logotipos ni nombres comerciales**, no tiene afiliación oficial ni patrocinio por parte de dichas entidades, y no obtiene ninguna ganancia, lucro o beneficio económico derivado de su uso o inclusión en la interfaz. mikuBot actúa únicamente como un cliente neutral (herramienta) para que el usuario consuma los servicios mediante sus propias configuraciones.

🤝 **Colaboraciones y Patrocinios:** Somos un laboratorio independiente comprometido con la tecnología de código abierto y la soberanía digital. Estamos completamente abiertos a colaboraciones corporativas, integraciones oficiales y patrocinios externos. Si representas a un proveedor de IA o deseas apoyar financieramente el desarrollo continuo de mikuBot, ¡no dudes en contactarnos!

---

## 🐾 El Origen de Nuestro Nombre

Es común pensar que **mikuBot** toma su nombre de la conocida idol virtual *Hatsune Miku*. Sin embargo, el origen es personal. "Miku" es una palabra que significa "cielo", y por eso nombré así a la gatita de la foto (la del medio), a quien rescaté junto a sus dos hermanos. Desde entonces ha estado conmigo y siempre se queda a mi lado mientras estoy programando.

<div align="center">
  <img src="./public/Zanahorio_Miku_Freya.png" alt="Zanahorio, Miku y Freya" width="100%" style="max-width: 500px; border-radius: 12px; margin: 15px 0;" />
  <p><i>De izquierda a derecha: Zanahorio, Miku y Freya.</i></p>
</div>

mikuBot es simplemente un agradecimiento a su compañía incondicional en el laboratorio.

---
*Desarrollado con precisión por [Neural Arch Labs](https://github.com/NeuralArchLabs).*