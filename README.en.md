<div align="center">

<img src="./public/mikuBotICON.png" width="120" style="border-radius: 24px" alt="mikuBot Icon" />

# 🌟 mikuBot v2.4.0 — The Memory & Widgets Update

![Status](https://img.shields.io/badge/Status-Stable-green.svg?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-Windows_10%2F11-0078D4.svg?style=for-the-badge&logo=windows)
![License](https://img.shields.io/badge/License-AGPL--3.0-blue.svg?style=for-the-badge)

[Español](README.md) | [中文](README.zh.md)

<br/>

<a href="https://github.com/NeuralArchLabs/mikuCentralv1.0">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=32&pause=3000&color=60A5FA&center=true&vCenter=true&width=600&height=60&lines=mikuCentral;%7B%7B%F0%9F%A7%A0%E2%89%88%5E.%E2%94%AC.%5E%E2%89%88%E2%80%BF%E2%9F%86%E2%9C%A8%7D%7D;mikuCentral" alt="Neural Signature" />
</a>

<br/>

<a href="https://github.com/NeuralArchLabs/mikuBot/releases/download/v2.4.0/mikuBot-Setup-2.4.0.exe">
  <img src="https://img.shields.io/badge/DOWNLOAD_LATEST_VERSION-v2.4.0-60A5FA?style=for-the-badge&logo=windows&logoColor=white" height="40" />
</a>

<br/>

An AI agent and assistant directed at the general public. Designed as a friendly alternative, easy to install and use compared to more complex tools like OpenClaw, ideal for users without high technical knowledge.

<br/>

<img src="./public/preview.gif" width="100%" style="border-radius: 12px; border: 1px solid #30363d" alt="mikuBot Preview" />

</div>

---

## ✨ Main Features

*   **Deep Onboarding and Personalization:** Features an initial configuration process that guides you step-by-step. From the first moment, you can nurture the assistant with all the information you want it to know about you, achieving absolute personalization so it understands exactly your context, needs, and how to help you.
*   **Autonomy and Operation Modes:** Features a Chat Mode and an Agent Mode focused on different types of assistance, both with native tool execution. Choose between a *fully autonomous* mode, a *safe mode* (requires prior authorization), and the creation of **scheduled tasks** for total autonomy.
*   **Persistent & Multi-session Execution (Studio Elite):** Miku no longer stops when switching neural branches. Agents can complete complex tasks autonomously in the background while you interact with other sessions, maintaining a persistent and visually reactive link that notifies you of process status in other branches.
*   **Multidimensional Themes (Atmosphere Engine):** Absolute visual personalization with 5 premium themes (`Miku`, `Cloud`, `Midnight`, `Cyberpunk`, `Forest`). Each theme adapts the entire interface to provide an immersive experience tailored to your workspace.
*   **Neural Credential Vault:** Your API keys are now protected by the `processVault` system, automatically encrypting them at rest. Sovereign security with zero manual intervention.
*   **Context Library:** A specialized module for creating, storing, and managing protocols, technical documents, and static knowledge bases. It allows Miku to access curated reference information for specific tasks without cluttering dynamic memory.
*   **Semantic Memory (Recall Skill):** Unlike the static library, Recall is an autonomous long-term memory skill. Miku records preferences, user details, and key concepts across sessions, creating a recursive navigation structure and a user model that evolves with every interaction.
*   **Generative Dynamic Widgets (Micro-Apps):** mikuBot now supports a generative widgets architecture. You can ask the assistant to create any custom widget for a specific task; Miku will program it, launch it in your workspace, and save it for future sessions. You can even close the main application and the widgets will remain active and functional on your Windows desktop.
*   **mikuBot Markdown Engine (Studio Elite):** mikuBot integrates a professional-grade rendering engine designed for technological sovereignty and technical precision. This "Studio Elite" suite redefines visual interaction:
    *   **Mermaid Syntax Healing:** Native ability to correct and normalize syntax errors in AI-generated diagrams (especially `gitGraph`), ensuring the visual architecture always renders correctly.
    *   **Documentation Integrity (Protection Pipeline):** A 3-phase pipeline ensuring that images, links, and nested code blocks maintain their perfect structure, even within complex markdown layouts.
    *   **Professional-Grade Scientific Rendering (LaTeX):** High-precision engine for complex mathematics ($$ and $), integrals, matrices, and physical constants.
    *   **Architecture & Data Logic (Mermaid):** Native visualization for flowcharts, GitGraphs, and mindmaps directly within the chat thread.
    *   **Structured Knowledge Management (Callouts):** Universal Obsidian-style support (`> [!TYPE]`) for organizing instructions with 14 reactive styles.
    *   **Kinetic & Progressive Canvas:** Organic animation system that synchronizes information reveal with the assistant's real-time thinking.
*   **Neural Editing (Cortex & Command Editors):** mikuBot includes specialized editors to directly modify the assistant's instructions and base knowledge. While you can adjust these files at any time for technical customization, **it is recommended to follow the Onboarding Wizard process** for optimal results. Critical files like `MODES.md` dictate the agent's operating protocols, and manual changes require caution to maintain system stability.
*   **Voice, Connectivity & Pro Backgrounds:** Includes native voice recognition (Vosk) out-of-the-box in English and Spanish. Additionally, features an **Atmospheric Background Gallery** with high-performance mapping via `local://` protocol for lag-free customization. Also allows easy linking with Telegram (via BotFather).
*   **100% Multilingual Support (EN/ES/ZH):** Unlike other alternatives on the market that are usually limited to a single language, mikuBot is **fully translated and optimized** to function perfectly in **English, Spanish, and Chinese**. From the interface to the agent's reasoning, the system offers a native and fluid experience in all three languages, providing technical superiority and global usability.
*   **Portability and Backup:** Allows a full memory dump into a compressed file to backup everything, including sessions, personalizations, memory, *skills*, and access keys.
*   **Windows-First Focus:** Programmed in Electron for scalability, but 100% focused on Windows for perfect native integration with **searXena**, with no short-term plans to be ported to other systems.

---

## 🤓 Under the Hood (For Developers and Power Users)

Beneath its friendly interface, mikuBot is a professional-grade autonomous agent execution environment designed for technological sovereignty.

### 🏛️ Origin and Project Integrity
mikuBot is a 100% independent project started in early **February 2026** (see evidence image below) as an effort to optimize Small Language Models (SLMs) for tool execution and agentic tasks. Its development was planned and executed under agile methodologies, based strictly on research, trial, and error until reaching its current state. 

It is **not a fork of OpenClaw** nor does it reuse any logic from the **Claude Code** (March 31, 2026) leaks. We believe in transparency and proprietary architecture as the foundation of a secure, sovereign system.

<div align="center">
  <img src="./public/startDateEvidence.png" width="600" style="border-radius: 8px; border: 1px solid #30363d" alt="Project Start Evidence" />
  <p><i>Snapshot of the very first logical core commits of mikuBot (February 2026).</i></p>
</div>

> [!NOTE]
> For repository history security reasons (preventing accidental leaks of development keys or other sensitive data from the early environment), the code was published to GitHub as a "clean" release at a later date than its actual inception.

### 🧠 Multi-Model Neural Intelligence
- **Ollama:** 100% local and private inference and access to cloud models with a very generous free tier.
- **Google AI:** Massive models with massive context windows, free tier available.
- **Groq:** A wide catalog of models to choose from at reasonable prices.
- **Z.AI (BigModel):** Access to models specialized in coding and technical reasoning.
- **Neural Flow:** Interface that visually separates internal thought (*Internal Monologue*) from executed technical actions.

### 🛠️ Tool Ecosystem and Security
mikuBot utilizes a robust ecosystem of tools divided into two main categories to ensure efficiency and technical sovereignty:

**1. Core Tools (System Tools):**
- **File Management:** `read_file`, `update_file`, `patch_file` (with smart patching engine), `delete_file`, and `batch_operation` for bulk actions.
- **Proactive Exploration:** `list_files`, `search_files` (high-performance native search), and `get_file_outline` for code mapping.
- **Execution & Control:** `run_console` (security whitelist for Windows commands), `undo_patch`, `get_system_metrics`, and `add_scheduled_task` (autonomous task scheduling).

**2. Neural Skills (Advanced Skills):**
- **Semantic Memory (`recall`):** Long-term memory skill that allows the assistant to remember preferences, facts, and evolve its user model.
- **Micro-Apps (`dynamic_widgets`):** Ability to generate, launch, and manage independent visual interfaces on the desktop.
- **Deep Investigation (`deep_research` / `web_research`):** Web search and auditing engines to avoid hallucinations and obtain precise technical data.
- **Universal Connectivity (`api_fetcher`):** Integrated HTTP client to consume any external REST API.
- **Self-Documentation (`instruction_booklet`):** Internal query system for the agent to understand its own capabilities and technical parameters.
- **Skill Discovery (`list_available_skills`):** Ability to auto-explore and learn to use new dynamically installed skills.

**Multi-Root File System (`SafePathResolver`):**
- `@WORKSPACE/` — Main project directory.
- `@CORE/` — System logic and base prompts.
- `@LIBRARY/` — Protocols and knowledge bases.
- `@TOOLS/` — Skill blueprints and scripts.

### 🏆 Why mikuBot? (Competitive Analysis)

mikuBot is not just another AI client; it is an agentic execution environment designed for data sovereignty and technical precision. Below, we compare our approach against other local agents and the most popular web-based clients.

#### 🏛️ Tier 1: Local Autonomous Agents

| Feature / Approach | 🌐 **mikuBot (Our Focus)** | 🏛️ **Hermes Agent** | 🦞 **OpenClaw** | 🧠 **memUBot (NevaMind-AI)** |
| :--- | :--- | :--- | :--- | :--- |
| **Paradigm & Interface** | **Hybrid (Desktop + 24/7).** Full visual control with persistent background execution and Telegram integration. | **Always-on / Autonomous.** Persistent assistant operating 24/7 as a background service. | **Headless Daemon / Messaging.** Controlled via WhatsApp, Telegram, or CLI (TUI). | **Enterprise Team Bot.** Primarily integrated into Slack, Discord, or Feishu. |
| **Windows Execution** | **100% Native (`.exe`).** Optimized to run directly on the Windows kernel. | **Server-side / VPS.** Designed for persistent self-hosted infrastructure. | **Requires WSL2 (Ubuntu).** Depends on a Linux subsystem and manual bash scripts. | Native / Cross-platform, but heavy server-side architecture. |
| **Learning Curve** | **Instant (Wizard-led).** Step-by-step installation and guided setup for any user. | **Moderate-High.** Requires configuring messaging gateways and servers. | **High.** Requires deep CLI knowledge and Linux environment configuration. | **Moderate.** Setup geared toward IT departments and enterprise workflows. |
| **Learning / Memory** | **Dual (Recall + Library).** User semantic memory + curated knowledge base. | **Learning Loop.** Automatically creates and refines reusable skills autonomously. | **File-Based.** Context management via local file reading. | **Enterprise History.** Data centralization for work teams. |
| **Visual Reasoning** | **Neural Flow.** Real-time visual stream of thoughts, tool usage, and states. | **Logs / Messaging.** Interaction via external chat interfaces. | **Text Logs.** Raw terminal output without visual internal state representation. | **Standard History.** Conventional chat interface without visual technical breakdown. |
| **Languages (Sovereignty)** | **Universal (ES/EN/ZH).** Absolute feature and reasoning parity in 3 languages. | **EN-Centric.** Optimized for English reasoning and models. | **EN-Centric.** Optimized support almost exclusively for the English language. | **EN-Centric.** Limited multilingual support. |

#### ☁️ Tier 2: Web-Based AI Clients

| Feature | 🌐 **mikuBot (Local Gateway)** | 🌐 **Open Web UI** | 🤖 **ChatGPT / Gemini / Perplexity** |
| :--- | :--- | :--- | :--- |
| **Data Access** | **Deep Context.** Direct access to your file system (@WORKSPACE) and local assets. | **RAG / File Upload.** Document management via local vectorization. | **Web Sandbox.** Limited to manually uploaded files or generic web search. |
| **Tool Execution** | **Total Sovereignty.** Native execution of Python, SearXena, and scripts with no middlemen. | **Docker / Sandbox.** Supports functions and scripts within containers. | **Restricted Cloud.** Code execution in isolated, remote servers with limited permissions. |
| **Privacy & Control** | **You are the Owner.** Data stays yours; you choose the provider and what to share. | **Local / Self-hosted.** Full control if running locally. | **Closed Ecosystem.** Your data is often used to train the provider's future models. |
| **Visualization** | **Studio Elite.** Scientific-grade high-fidelity rendering of LaTeX, Mermaid, and Callouts. | **Standard Web UI.** Clean and functional browser-based interface. | **Basic Markdown.** Standard browser visualization with low technical flexibility. |
| **Local Optimization** | **Ultra-efficient.** Designed to maximize performance of small models (SLMs). | **Generalist.** Optimized for large-scale models via server. | **Cloud Dependent.** Requires constant connection and massive models. |

#### 🚀 The mikuBot Edge: The 4 Pillars of Excellence

1.  **Native Performance & Local Sovereignty:** mikuBot is fully functional with models executed locally via **Ollama**. We have proven that small models (SLMs) such as **Gemma 3 4B** perform exceptionally well in chat mode, surpassing massive models in presentation and UX.
2.  **Precision and Personalization (Powered by [searXena](https://github.com/NeuralArchLabs/searXena)):** No guessing. Miku consults your files and leverages the **searXena** sovereign metasearch engine (developed natively by us) before responding, ensuring exact, updated results.
3.  **Absolute Transparency (Anti-Black Box):** You have full control. Every model decision, prompt, and data byte is auditable in real-time.
4.  **Provider Freedom:** Switch brains (Ollama, Gemini, Groq, Z.AI) in seconds without losing your workflow. Miku is your universal sovereign interface.

### 💻 Tech Stack
| Component | Technology |
| :--- | :--- |
| **Frontend** | React 19 + TypeScript |
| **Styling** | Vanilla CSS + Tailwind CSS 4.1 |
| **Desktop Runtime** | Electron 40.2 (Native Node.js integration) |
| **Build Tool** | Vite 6.2 |
| **State Management** | Zustand 5.0 |
| **Inference** | Google GenAI SDK, fetch-proxy for Ollama, OpenAI-compatible |

### 🚀 Local Installation and Development
```bash
# 1. Clone this repository
git clone https://github.com/NeuralArchLabs/mikuBot.git
cd mikuBot

# 2. Install dependencies
npm install

# 3. Run in Development mode (with Electron HMR)
npm run electron:dev

```

### ⚖️ License and Open Source Attributions
This project is distributed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. If you modify this program and offer it as a network service, you must make the source code available to your users.

**Third-Party Acknowledgments:**
mikuBot is made possible thanks to open-source technologies like React (MIT), Vite (MIT), Electron (MIT), Mermaid.js (MIT), Font Awesome Free (CC BY 4.0 / MIT / SIL OFL 1.1), **Outfit Font (SIL OFL 1.1)**, **Vosk Engine (Apache 2.0)**, Tailwind CSS (MIT), Zustand (MIT), i18next (MIT), unzipper (MIT), FastAPI (MIT), **PyMuPDF / fitz (AGPL-3.0)**, and AI SDKs like Ollama and Google GenAI (Apache 2.0). Refer to the [`LICENSE`](./LICENSE) file for more details.

**Embedded Python Engine:**
mikuCentral includes Python 3.11.9 embedded as a general engine for all Python-based functionalities (SearXena, voice recognition, skill execution). Python is distributed under the **Python Software Foundation License Version 2**, a permissive license that allows its use in proprietary software without an open-source obligation. The package also includes components under MIT (libffi), BSD (bzip2, Tcl/Tk), and Microsoft Distributable Code for Windows licenses. Refer to [`engine/python/LICENSE.txt`](./engine/python/LICENSE.txt) for the complete Python distribution terms.

---

## 🏛️ Credits and Legal Disclaimer
mikuBot is an initiative developed and maintained by [**Neural Arch Labs**](https://github.com/NeuralArchLabs).

**Trademark Notice:** This software uses names, logos, and trademarks of Artificial Intelligence inference providers (such as Google Gemini, Groq, Ollama, Z.AI, among others) strictly for referential and informational purposes oriented toward end-user navigation. **[Neural Arch Labs](https://github.com/NeuralArchLabs) does not own the rights to these logos or tradenames**, has no official affiliation or sponsorship from said entities, and does not obtain any gain, profit, or economic benefit derived from their use or inclusion in the interface. mikuBot acts solely as a neutral client (tool) for the user to consume services via their own configurations.

🤝 **Collaborations and Sponsorships:** We are an independent laboratory committed to open-source technology and digital sovereignty. We are fully open to corporate collaborations, official integrations, and external sponsorships. If you represent an AI provider or wish to financially support the continuous development of mikuBot, feel free to contact us!

---

## 🐾 The Origin of Our Name

It's common to think that **mikuBot** takes its name from the well-known virtual idol *Hatsune Miku*. However, the origin is personal. "Miku" is a word that means "sky", which is why I named the kitten in the photo (the middle one) this way. I rescued her along with her two siblings, and since then she has been with me and always stays by my side while I am programming.

<div align="center">
  <img src="./public/Zanahorio_Miku_Freya.png" alt="Zanahorio, Miku and Freya" width="100%" style="max-width: 500px; border-radius: 12px; margin: 15px 0;" />
  <p><i>From left to right: Zanahorio, Miku, and Freya.</i></p>
</div>

mikuBot is simply an acknowledgment of her unconditional company in the lab.

---
*Developed with precision by [Neural Arch Labs](https://github.com/NeuralArchLabs).*
