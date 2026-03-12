<div align="center">
  <p>
    <a href="README.en.md">English</a> | 🌎 <b>Versión en Español</b> | <a href="README.zh.md">中文</a>
  </p>

  <img src="https://img.shields.io/badge/Sear-Xena-6a00ff?style=for-the-badge&logo=search&logoColor=white" alt="searXena Logo"/>
  <h1>searXena</h1>

  <p>
    Un metabuscador ágil, local y 100% nativo para Windows. Creado como un puente de alto rendimiento entre los LLM (sistemas de IA autónomos) y la web en tiempo real, garantizando mitigación de rastreo y privacidad.
  </p>
  
  <p>
    <a href="#origen-y-agradecimientos">Origen</a> • 
    <a href="#stack-tecnológico">Stack</a> • 
    <a href="#características-principales">Características</a> • 
    <a href="#inteligencia-artificial-y-agentes">Agentes IA</a> • 
    <a href="#arquitectura-de-privacidad">Privacidad</a> • 
    <a href="#instalación-y-uso">Instalación</a> • 
    <a href="#licencia-y-créditos">Créditos</a>
  </p>
</div>

---

## 📖 Origen y Agradecimientos

searXena nació originalmente como una iniciativa de investigación para realizar un *port* experimental de [SearXNG](https://github.com/searxng/searxng) destinado a ejecutarse de forma nativa en sistemas operativos Windows sin el peso de contenedores Docker o subsistemas WSL involucrados. 

A medida que el desarrollo avanzó y la necesidad de integraciones interactivas más profundas surgió, **searXena evolucionó para convertirse en un software iterativamente independiente**. Nuestro código base fue reescrito y estructurado bajo una arquitectura de micro-gestores propia (FastAPI), conservando el espíritu de soberanía del usuario establecido por el movimiento open-source.

Reconocemos y honramos formalmente al proyecto original SearXNG y a sus desarrolladores comunitarios por sentar los estándares universales y la base teórica (parsers, gestión de peticiones, headers proxy) acerca de cómo debe operar un metabuscador transparente y privado.

## 🛠️ Stack Tecnológico

searXena aprovecha tecnologías modernas y ultraligeras para permitir una ejecución hiperfluida inclusive en hardware de uso local secundario:

- **Backend:** [Python 3.x](https://www.python.org/) y [FastAPI](https://fastapi.tiangolo.com/) (Alto rendimiento asíncrono).
- **Servidor Web:** [Uvicorn](https://www.uvicorn.org/) (Soporte nativo ASGI).
- **Procesamiento de Red:** `httpx` para peticiones HTTP/2 paralelas y asíncronas de bajísima latencia.
- **Frontend / Rendering:** [Jinja2](https://jinja.palletsprojects.com/) acoplado con Vanilla JavaScript (cero frameworks tipo React) y CSS3 Puro garantizando velocidad instantánea.
- **Scraping Estructurado:** `lxml` y `BeautifulSoup4` acoplado con selectores modulares para el análisis del DOM.

## ✨ Características Principales

* 🚀 **Metabúsqueda Paralela Asíncrona:** Una sola consulta tuya dispara docenas de solicitudes asíncronas a motores globales (Google, Bing, DuckDuckGo, Brave, GitHub, Wikipedia, MDN, NPM, etc.) consolidándolas en menos de 1 segundo.
* 🤖 **Integración IA First:** Formato JSON y esquemas Tools pre-construidos nativos, listos para conectar tu despliegue LLM a internet sin overheads ni scraping de HTML innecesario.
* 🛡️ **Protección de Privacidad:** Actúa como una interfaz neutral entre el usuario y la web global. Promueve el anonimato al centralizar las peticiones de forma transparente a través de su propio motor de red.
* 📦 **100% Nativo en Windows:** Cero dependencias complejas. Solo clona, instala las librerías con `pip`, corre el archivo `.py` principal y tienes un buscador privado minimizando la telemetría externa hospedado localmente en tu sistema.
* 📱 **UI/UX Moderna y Dinámica:** Animaciones fluidas, modo oscuro ultra refinado ("Space Violet"), interfaz responsiva y separada categóricamente en pestañas (General, TI/Ciencia, Mapas, Videos, Imágenes).
* 🌎 **Rich Snippets Consolidados:** Lectura enriquecida consolidando datos de Wikipedia o Wikidata en recuadros laterales de rápido consumo ("Infoboxes") al estilo de los grandes motores comerciales.

## 🥊 ¿Por qué no tenemos rival en Windows? (searXena vs El Resto)

Históricamente, los metabuscadores open-source enfocados en privacidad (como SearXNG o Whoogle) nacieron y fueron diseñados **estrictamente pensando en entornos GNU/Linux o despliegues Cloud**. Si un usuario de Windows deseaba correrlos localmente, debía enfrentarse a una odisea de fricción técnica: instalar **WSL2** (Subsistema de Windows para Linux), dedicar recursos de memoria fijos para máquinas virtuales, configurar demonios de **Docker**, lidiar con configuraciones de red de contenedores (NAT bridging), y gastar gigabytes de almacenamiento solo para arrancar una barra de búsqueda.

**searXena elimina por completo todas estas barreras. No tenemos rivales en este ecosistema porque somos 100% nativos.**

| Característica | 👾 Los "Rivales" (SearXNG / Whoogle) | 👑 searXena |
| :--- | :--- | :--- |
| **Arquitectura en Windows** | Virtualización Forzada (Docker / WSL2) | **Directa al Kernel** (vía Python nativo) |
| **Consumo de Memoria** | ~1 GB a 2 GB (Por sobrecarga de VM / Contenedores) | **~30 MB - 60 MB** (Ejecución Pura) |
| **Tiempo de Arranque** | Lento (Inicia Docker Engine, luego levanta el stack) | **Instantáneo** (Menor a un segundo) |
| **Experiencia de Instalación** | Compleja, comandos de sysadmin orientados a Linux | **Simple** (Scripts `.ps1` auto-configurables) |
| **Tool Calling LLM** | Adaptadores comunitarios externos requeridos | **API JSON Nativa** construida desde el día uno |

A menos que quieras rentar un VPS en la nube, searXena es la única respuesta lógica, viable y de altísimo rendimiento para el usuario de Windows exigente que desea soberanía de datos *in-house*.

## 🤖 Inteligencia Artificial y Agentes

searXena no es solo una interfaz para humanos; es una **infraestructura de búsqueda optimizada para la era de la IA**. Hemos diseñado el motor para que sirva como el par de "ojos" en tiempo real para tus modelos de lenguaje (LLMs).

*   **Exploración de Internet para IA:** Proporciona un flujo de datos limpio y estructurado que permite a los agentes navegar e investigar en la web sin la fricción del renderizado visual.
*   **Tool Calling Nativo:** Compatible con el estándar de "Functions" de OpenAI/Anthropic desde el núcleo.
*   **Ranking Curado para RAG:** Los resultados están priorizados para alimentar sistemas de *Retrieval-Augmented Generation*, filtrando el ruido comercial y priorizando fuentes sustanciales de información técnica y enciclopédica.

## 🔒 Arquitectura de Privacidad Transparente

searXena prioriza que tus datos **jamás** se utilicen para el perfilado publicitario por parte de terceros, asumiendo un rol de protección técnica por debajo de la interfaz gráfica. Aún así, la arquitectura requiere ciertos consensos técnicos, reportados aquí transparentemente:

### Proxificación del DOM Absoluta
Cuando buscas cualquier consulta general (Noticias, TI, Código), searXena protege tu identidad a través del motor asíncrono backend. Modificamos de forma sistemática los `User-Agent`. Toda URL de imagen devuelta por los motores comerciales pasa de manera coordinada por nuestro sistema interno de `/proxify`, asegurando que tu IP no se exponga directamente a servidores de terceros.

### Módulo de Mapas: OSM (OpenStreetMap)
Al interactuar con la pestaña especializada de Mapas, searXena implementa reglas un poco más permeables para lograr darte interactividad útil (arrastrar, hacer zoom), conservando el anonimato comercial:
* **Geocodificación Limpia**: La petición nominal (ej. "Buscar Jalisco") va blindada mediante el core backend a favor del anonimato. OSM jamás sabe las palabras de tu búsqueda.
* **Transparencia IP (El Iframe Interactivo)**: Para que experimentes un mapa funcional arrastrable dentro de la sección Mapas, inyectamos un `iframe` dinámico referenciando a `openstreetmap.org`. Esto hace que **tu navegador realice una conexión directa a OSM revelando temporalmente tu IP pública** para la descarga de mosaicos visuales (tiles).
* El trade-off: OSM es una fundación [abierta pro-privacidad](https://wiki.osmfoundation.org/wiki/Privacy_Policy) sin motores que subasten telemetría ni cookies inter-rastreo, por lo que la exposición de IP nativa es benigna y se justifica a cambio de integrar la cartografía funcional.

### Aceleración de Activos de Confianza (Wikipedia/Wikimedia)
Siguiendo nuestra arquitectura de "Direct Media Delivery" para optimizar el rendimiento sin sacrificar la privacidad:
* **Nodos de Alta Confianza**: searXena identifica a los servidores de Wikipedia y Wikimedia como fuentes de infraestructura pública educativa de alta confianza. 
* **Optimización de Carga**: Al ser plataformas libres de rastreadores publicitarios y cookies de terceros, permitimos la carga directa de sus recursos multimedia. Esto garantiza una experiencia de usuario fluida y de alta resolución, aprovechando que estas instituciones operan bajo protocolos de confidencialidad estrictos compatibles con la filosofía de searXena.

## 🤖 Integración Nativa con Inteligencia Artificial (API)

searXena no es solo para consumo humano. Está diseñado desde su base web para **actuar como el motor de búsqueda de investigación de tus propios agentes de IA (LLMs) locales o en la nube**, proveyendo soporte nativo de *Tool Calling* estrictamente estandarizado (formato OpenAI/Anthropic/Gemini).

A través de la ruta `/api/v1/search`, tu asistente puede automatizar consultas y recibir respuestas en **JSON limpio, indexado y estructurado**, suprimiendo el HTML, CSS o el costoso ruido visual derivado de los scrapers crudos.

* **Endpoints Listos para IA:**
  * `GET /api/v1/tools_schema`: Devuelve un esquema literal `function_declarations` inyectable directo hacia tu LLM con todos los parámetros habilitados disponibles.
  * `POST /api/v1/search`: Webhook de comunicación que ejecuta la búsqueda y devuelve metadata analítica de profundidad.
* **Smart Ranking Anti-Alucinaciones:** El filtro heurístico procesa los retornos a favor del agente; bajo la categoría "TI", oculta de cara al LLM los sitios publicitarios y le alimenta directamente de StackOverflow, la MDN Web Docs, y repositorios sustanciales de GitHub.

> **¿Construyendo un Agente RAG?** Echa un vistazo profundo a los payloads, headers preconstruidos y recomendaciones del System Prompt alojados en la [**Guía de Integración AI**](AI_INTEGRATION_GUIDE.md) incluida en este repositorio oficial.

## 🚀 Instalación y Uso (Modo Local)

1. Clona el repositorio a un directorio local:
   ```bash
   git clone https://github.com/NeuralArchLabs/searXena.git
   cd searXena
   ```
2. (Opcional) Si tu sistema bloquea los scripts, dales permisos:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
3. Ejecuta el instalador automático en la terminal base:
   ```powershell
   .\win_setup.ps1
   ```
4. Inicia el motor searXena:
   ```powershell
   .\run.ps1
   ```
Abre tu navegador (Brave, Edge, Firefox) y entra directamente en `http://127.0.0.1:8000`. searXena ya está listo para enmascararte.

## ⚖️ Licencia y Renuncia de Responsabilidad

*   **Licencia:** Este proyecto es software libre, distribuido bajo la licencia **GNU Affero General Public License v3.0 (AGPL-3.0)**.
*   **Créditos:** Todo el conocimiento de base técnica para modelar las clases de los módulos de extracción y derivaciones heurísticas pertenece de forma moral a los mantenedores de [Searx](https://github.com/searx/searx) y [SearXNG](https://github.com/searxng/searxng).
*   **Fuentes de Información:** searXena actúa como un agregador de señales públicas. Reconocemos y respetamos la inmensa labor de indexación y el valor tecnológico proporcionado por los distintos motores de búsqueda externos compatibles (Google, Bing, DuckDuckGo, etc.). Este software funciona como una herramienta de visualización y anonimización de datos públicos para el usuario final.
*   **Uso Educativo y de Investigación:** searXena se proporciona únicamente con fines de investigación y uso personal. El desarrollador no promueve ni se responsabiliza por el uso de esta herramienta para violar los Términos de Servicio de terceros. searXena ofrece una experiencia de búsqueda neutral; si requiere de la personalización y comodidades basadas en algoritmos de seguimiento, le recomendamos el uso directo de plataformas comerciales de búsqueda.

**AVISO LEGAL:** searXena se distribuye "TAL CUAL", sin garantías de ningún tipo. El usuario asume toda la responsabilidad legal derivada del uso del software, incluyendo el cumplimiento de las leyes locales y los contratos con proveedores de datos externos. El desarrollador no se hace responsable de bloqueos de IP, acciones legales de terceros o cualquier otro perjuicio derivado del uso de este código.
