<div align="center">
  <p>
    🌎 <b>English</b> | <a href="README.md">Versión en Español</a> | <a href="README.zh.md">中文</a>
  </p>

  <img src="core/static/searxena-banner-v2.svg" alt="searXena Logo" width="600"/>

**Search locally, search privately, search the old way.**

  <p>
    
  <br><p>

  <p>
    <img src="https://img.shields.io/badge/O--ZEN_Engine-2.0.0-6a00ff?style=for-the-badge&logoColor=white" alt="O-ZEN Engine"/>
    <img src="https://img.shields.io/badge/Windows-Native-0078D4?style=for-the-badge&logo=windows&logoColor=white" alt="Windows Native"/>
    <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI"/>
    <img src="https://img.shields.io/badge/AI_Infra-Zero_API_Keys-ff9b00?style=for-the-badge" alt="AI Infra"/>
    <img src="https://img.shields.io/badge/License-AGPLv3-blueviolet?style=for-the-badge" alt="AGPLv3"/>
  </p>

An agile native metasearch engine and high-performance data infrastructure built to reclaim the useful web. Designed for humans who want relevance without ads and for AI agents that need to explore the internet without the friction of commercial API keys and their associated costs.
  </p>
  
  <p>
    <a href="#origin-and-acknowledgments">Origin</a> • 
    <a href="#tech-stack">Stack</a> • 
    <a href="#main-features">Features</a> • 
    <a href="#artificial-intelligence-and-agents">AI Agents</a> • 
    <a href="#privacy-architecture">Privacy</a> • 
    <a href="#installation-and-usage">Installation</a> • 
    <a href="#license-and-credits">Credits</a>
  </p>
</div>

---

## 📖 Origin and Acknowledgments

searXena was originally born as a research initiative to create an experimental *port* of [SearXNG](https://github.com/searxng/searxng) aimed at running natively on Windows operating systems without the overhead of Docker containers or WSL subsystems involved. 

As development progressed and the need for deeper interactive integrations arose, **searXena evolved to become an iteratively independent software**. Our codebase was rewritten and structured under its own micro-manager architecture (FastAPI), while retaining the spirit of user sovereignty established by the open-source movement.

We formally recognize and honor the original SearXNG project and its community developers for setting the universal standards and theoretical foundation (parsers, request management, proxy headers) on how a transparent and private metasearch engine should operate.

## 🛠️ Tech Stack

searXena leverages modern and ultra-lightweight technologies to enable hyper-fluid execution even on secondary local hardware:

- **Backend:** [Python 3.x](https://www.python.org/) and [FastAPI](https://fastapi.tiangolo.com/) (High-performance asynchronous framework).
- **Web Server:** [Uvicorn](https://www.uvicorn.org/) (Native ASGI support).
- **Network Processing:** `httpx` for parallel and asynchronous HTTP/2 requests with ultra-low latency.
- **Frontend / Rendering:** [Jinja2](https://jinja.palletsprojects.com/) coupled with Vanilla JavaScript (zero frameworks like React) and Pure CSS3 ensuring instant speed.
- **Extraction Engine:** `O-ZEN Engine` (Native extraction core - AGPLv3).
- **DOM Processors:** `lxml` and `selectolax` coupled with modular selectors.

## ✨ Main Features

* 🚀 **Asynchronous Parallel Metasearch:** A single query from you triggers dozens of asynchronous requests to multiple global engines and information sources, consolidating them in less than 1 second.
* 🤖 **AI-First Integration:** Native JSON formatting and pre-built Tools schemas, ready to connect your LLM deployment to the internet without overheads or unnecessary HTML scraping.
* 🛡️ **Privacy Protection:** Acts as a neutral interface between the user and the global web. Promotes anonymity by transparently centralizing requests through its own network engine.
* 📦 **100% Native on Windows:** Zero complex dependencies. Just clone, install the libraries with `pip`, run the main `.py` file, and you have a private search engine minimizing external telemetry hosted locally on your system.
* 📱 **Modern and Dynamic UI/UX:** Fluid animations, ultra-refined dark mode ("Space Violet"), responsive interface, and categorically separated into tabs (General, IT/Science, Maps, Videos, Images).
* 🌎 **Consolidated Rich Snippets:** Enriched reading consolidating data from Wikipedia or Wikidata in quick-consumption side boxes ("Infoboxes").
* 🧘 **O-ZEN Engine (Reader Mode):** Built-in industrial extraction core (AGPLv3) for reading articles and technical documentation without ads or intrusive scripts.

## 🥊 Why We Have No Rival on Windows (searXena vs The Rest)

Historically, open-source metasearch engines focused on privacy (like SearXNG or Whoogle) were born and designed **strictly intended for GNU/Linux environments or Cloud deployments**. If a Windows user wanted to run them locally, they had to face an odyssey of technical friction: installing **WSL2** (Windows Subsystem for Linux), dedicating fixed memory resources for virtual machines, configuring **Docker** daemons, dealing with container network configurations (NAT bridging), and wasting gigabytes of storage just to start a search bar.

**searXena completely eliminates all these barriers. We have no rivals in this ecosystem because we are 100% native.**

| Feature | 👾 The "Rivals" (SearXNG / Whoogle) | 👑 searXena |
| :--- | :--- | :--- |
| **Windows Architecture** | Forced Virtualization (Docker / WSL2) | **Direct to Kernel** (via native Python) |
| **Memory Consumption** | ~1 GB to 2 GB (Due to VM / Container overhead) | **~30 MB - 60 MB** (Pure Execution) |
| **Startup Time** | Slow (Starts Docker Engine, then boots the stack) | **Instantaneous** (Less than a second) |
| **Installation Experience** | Complex, sysadmin commands oriented to Linux | **Simple** (One-click `.ps1` auto-setup script) |
| **LLM Tool Calling** | External community adapters required | **Native JSON API** built from day one |
| **Data Extraction (RAG)** | Noisy HTML scraping (external) | **O-ZEN Engine** native (LLM-ready reader mode) |

Unless you want to rent a VPS in the cloud, searXena is the only logical, viable, and high-performance answer for the demanding Windows user who desires *in-house* data sovereignty.

## 🤖 Artificial Intelligence and Agents: Zero API Keys, Zero Friction

searXena eliminates web access barriers for Artificial Intelligence development:

*   **Goodbye to API Keys:** Forget about managing multiple API keys or dynamic subscription quotas. searXena is your own infinite search node.
*   **Zero Cost per Query:** Scale your agents and RAG systems without worrying about the bill at the end of the month.
*   **Industrial-Grade Data:** Delivers a clean, structured data stream designed to be processed by LLMs. We have designed the engine to serve as real-time "eyes" for your Large Language Models (LLMs).

*   **Internet Exploration for AI:** Provides a clean, structured data stream that allows agents to navigate and research the web without the friction of visual rendering.
*   **Native Tool Calling:** Core-level compatibility with the OpenAI/Anthropic "Functions" standard.
*   **Curated Ranking for RAG:** Results are prioritized to feed *Retrieval-Augmented Generation* systems, filtering out commercial noise and prioritizing substantial technical and encyclopedic information sources.

## 🔒 Transparent Privacy Architecture

searXena priorities that your data is **never** used for third-party advertising profiling, assuming a technical protection role beneath the graphical interface. Even so, the architecture requires certain technical consensuses, reported here transparently:

### Absolute DOM Proxification
When you search any general query (News, IT, Code), searXena protects your identity through the asynchronous backend engine. We systematically modify the `User-Agent`s. Every image URL returned by commercial engines is coordinated through our internal `/proxify` system, ensuring your IP is not directly exposed to third-party servers.

### Maps Module: OSM (OpenStreetMap)
When interacting with the specialized Maps tab, searXena implements slightly more permeable rules to achieve useful interactivity (drag, zoom), preserving commercial anonymity:
* **Clean Geocoding**: The nominal request (e.g., "Search Jalisco") is shielded through the backend core in favor of anonymity. OSM never knows your search words.
* **IP Transparency (The Interactive Iframe)**: For you to experience a functional draggable map within the Maps section, we inject a dynamic `iframe` referencing `openstreetmap.org`. This causes **your browser to make a direct connection to OSM temporarily revealing your public IP** for downloading visual tiles.
* The trade-off: OSM is a [pro-privacy open](https://wiki.osmfoundation.org/wiki/Privacy_Policy) foundation without engines that auction telemetry or cross-tracking cookies, making the native IP exposure benign and justified in exchange for integrating functional cartography.

### Trusted Asset Acceleration (Wikipedia/Wikimedia)
Following our "Direct Media Delivery" (DMD) architecture to optimize performance without sacrificing privacy:
* **High-Trust Nodes**: searXena identifies Wikipedia and Wikimedia servers as high-trust public educational infrastructure sources.
* **Loading Optimization**: Since these platforms are strictly free of advertising trackers and third-party cookies, we allow the direct loading of their multimedia resources. This ensures a fluid, high-resolution user experience while maintaining the internal privacy protocols established by searXena.

## 🤖 Native Artificial Intelligence Integration (API)

searXena is not just for human consumption. It is designed from its web base to **act as the research search engine for your own local or cloud-based AI agents (LLMs)**, providing native *Tool Calling* support strictly standardized (OpenAI/Anthropic/Gemini format).

Through the `/api/v1/search` route, your assistant can automate queries and receive answers in **clean, indexed, and structured JSON**, suppressing the HTML, CSS, or the costly visual noise derived from raw scrapers.

* **AI-Ready Endpoints:**
  * `GET /api/v1/tools_schema`: Returns a literal `function_declarations` schema directly injectable into your LLM with all available enabled parameters.
  * `POST /api/v1/search`: Communication webhook that executes the search and returns deep analytical metadata.
* **Anti-Hallucination Smart Ranking:** The heuristic filter processes the returns in favor of the agent; under the "IT" category, it hides advertising sites from the LLM and feeds it directly from official technical documentation and substantial open-source repositories.

> **Building a RAG Agent?** Take a deep look at the payloads, pre-built headers, and System Prompt recommendations hosted in the [**AI Integration Guide**](AI_INTEGRATION_GUIDE.md) included in this official repository.
>
> 🚀 **Coming Soon:** searXena will be included by default in our project in development **mikuBot Dashboard**, a personal AI assistant focused on the general public, also open source and coming soon.

## 🚀 Installation and Usage (Local Mode)

1. Clone the repository to a local directory:
   ```bash
   git clone https://github.com/NeuralArchLabs/searXena.git
   cd searXena
   ```
2. (Optional) If your system blocks scripts, allow them:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
3. Run the automatic setup from your base terminal:
   ```powershell
   .\win_setup.ps1
   ```
4. Start the searXena engine:
   ```powershell
   .\run.ps1
   ```
Open your personal or trusted browser and enter directly into `http://127.0.0.1:8000`. searXena is now ready to mask you.

## ⚖️ License and Legal Disclaimer

*   **License:** This project is free software, distributed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.
*   **Engine Credits:** The **O-ZEN Engine** extraction motor is a native component of searXena designed to ensure user data sovereignty and professional copyleft compliance.
*   **Acknowledgments:** We recognize the technical foundation established by the SearXNG ecosystem, whose privacy standards have inspired this native architecture.
*   **Information Sources:** searXena acts as a public signal aggregator. We recognize and respect the immense indexing work and technological value provided by the various external search engines. This software functions as a tool for visualizing and anonymizing public data for the end user.
*   **Educational and Research Use:** searXena is provided solely for research and personal use purposes. The developer does not promote nor is responsible for the use of this tool to violate third-party Terms of Service. searXena provides a neutral search experience; if you require the personalization and conveniences based on tracking algorithms, we recommend using commercial search platforms directly.

**LEGAL NOTICE:** searXena is distributed "AS IS", without warranties of any kind. The user assumes all legal responsibility derived from the use of the software, including compliance with local laws and contracts with external data providers. The developer is not responsible for IP blocks, third-party legal actions, or any other damages resulting from the use of this code.
