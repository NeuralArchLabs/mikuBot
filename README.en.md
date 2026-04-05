<div align="center">

<img src="./public/mikuBotICON.png" width="120" style="border-radius: 24px" alt="MikuBot Icon" />

# 🌟 MikuBot v2.1.6 — Your Personal AI Assistant for Windows

![Status](https://img.shields.io/badge/Status-Stable-green.svg?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-Windows_10%2F11-0078D4.svg?style=for-the-badge&logo=windows)
![License](https://img.shields.io/badge/License-AGPL--3.0-blue.svg?style=for-the-badge)

[Español](README.md) | [中文](README.zh.md)

<br/>

<a href="https://github.com/NeuralArchLabs/mikuCentralv1.0">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=32&pause=3000&color=60A5FA&center=true&vCenter=true&width=600&height=60&lines=mikuCentral;%7B%7B%F0%9F%A7%A0%E2%89%88%5E.%E2%94%AC.%5E%E2%89%88%E2%80%BF%E2%9F%86%E2%9C%A8%7D%7D;mikuCentral" alt="Neural Signature" />
</a>

<br/>

<a href="https://github.com/NeuralArchLabs/mikuBot/releases/download/v2.1.6/MikuBot-Setup-2.1.6.exe">
  <img src="https://img.shields.io/badge/DOWNLOAD_LATEST_VERSION-v2.1.6-60A5FA?style=for-the-badge&logo=windows&logoColor=white" height="40" />
</a>

<br/>

An AI agent and assistant directed at the general public. Designed as a friendly alternative, easy to install and use compared to more complex tools like OpenClaw, ideal for users without high technical knowledge.

</div>

---

## ✨ Main Features

*   **Deep Onboarding and Personalization:** Features an initial configuration process that guides you step-by-step. From the first moment, you can nurture the assistant with all the information you want it to know about you, achieving absolute personalization so it understands exactly your context, needs, and how to help you.
*   **Autonomy and Operation Modes:** Features a Chat Mode and an Agent Mode focused on different types of assistance, both with native tool execution. Choose between a *fully autonomous* mode, a *safe mode* (requires prior authorization), and the creation of **scheduled tasks** for total autonomy.
*   **Context Library:** A module that allows you to create, store, and reference protocols and documents to review, improve, or apply with the assistant at any time.
*   **Neural Editing (Cortex & Command Editors):** MikuBot includes specialized editors to directly modify the assistant's instructions and base knowledge. While you can adjust these files at any time for technical customization, **it is recommended to follow the Onboarding Wizard process** for optimal results. Critical files like `MODES.md` dictate the agent's operating protocols, and manual changes require caution to maintain system stability.
*   **Voice and 24/7 Connectivity:** Includes native voice recognition out-of-the-box (via Vosk) in English and Spanish. Additionally, it allows easy linking with Telegram (via BotFather) to operate 24/7.
*   **100% Multilingual Support (EN/ES/ZH):** Unlike other alternatives on the market that are usually limited to a single language, MikuBot is **fully translated and optimized** to function perfectly in **English, Spanish, and Chinese**. From the interface to the agent's reasoning, the system offers a native and fluid experience in all three languages, providing technical superiority and global usability.
*   **Portability and Backup:** Allows a full memory dump into a compressed file to backup everything, including sessions, personalizations, memory, *skills*, and access keys.
*   **Windows-First Focus:** Programmed in Electron for scalability, but 100% focused on Windows for perfect native integration with **searXena**.

---

## 🤓 Under the Hood (For Developers and Power Users)

Beneath its friendly interface, MikuBot is a professional-grade autonomous agent execution environment designed for technological sovereignty.

### 🏛️ Origin and Project Integrity
MikuBot is **not a fork of OpenClaw** nor does it reuse any logic from the **Claude Code** (March 31, 2026) leaks. This project is 100% independent, having started in early **February 2026** as an effort to optimize Small Language Models (SLMs) for tool execution and agentic tasks. 

Its development was planned and executed under agile methodologies, based strictly on research, trial, and error until reaching its current state. We believe in transparency and proprietary architecture as the foundation of a secure, sovereign system.

### 🧠 Multi-Model Neural Intelligence
- **Ollama:** 100% local and private inference.
- **Google AI (Gemini):** Massive models with massive context windows.
- **Groq:** A wide catalog of models at reasonable prices.
- **Z.AI (BigModel):** Advanced coding capabilities.
- **Neural Flow:** Interface that visually separates internal thought (*Internal Monologue*) from executed technical actions.

### 🛠️ Tool Ecosystem and Security
**Multi-Root File System (`SafePathResolver`):**
- `@WORKSPACE/` — Main project directory.
- `@CORE/` — System logic and base prompts.
- `@LIBRARY/` — Protocols and knowledge bases.
- `@TOOLS/` — Skill blueprints and scripts.

Includes native tools like `read_file`, `smart_patch`, `search_files`, and shell injection protection (`run_console` whitelist).

### 💻 Tech Stack
- **Frontend:** React 19 + TypeScript
- **Styling:** Vanilla CSS + Tailwind CSS 4.1
- **Desktop Runtime:** Electron 40.2 (Native Node.js integration)
- **Build Tool:** Vite 6.2
- **State Management:** Zustand 5.0
- **Inference:** Google GenAI SDK, fetch-proxy for Ollama, OpenAI-compatible

---

## 🚀 Local Installation and Development
```bash
# 1. Clone this repository
git clone https://github.com/NeuralArchLabs/mikuBot.git
cd mikuBot

# 2. Install dependencies
npm install

# 3. Run in Development mode
npm run electron:dev

# 4. Build for Production
npm run electron:build
```

---

## ⚖️ License and Attributions
Distributed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

**Embedded Python Motor:**
MikuCentral includes embedded Python 3.11.9. Distributed under the **Python Software Foundation License Version 2**.

---

## 🏛️ Credits and Disclaimer
MikuBot is an initiative developed and maintained by **Neural Arch Labs**.

**Trademark Notice:** This software uses names and logos of AI providers (Google Gemini, Groq, Ollama, Z.AI, etc.) for referential and informational purposes only. **Neural Arch Labs does not own these rights**.

*Developed with precision by Neural Arch Labs.*
