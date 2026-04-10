# 🚀 mikuBot v2.3.0 — The Sovereign Persistence Update

![Version](https://img.shields.io/badge/version-2.3.0-blue.svg?style=for-the-badge&logo=github) ![Platform](https://img.shields.io/badge/Windows-10%2F11-0078D4.svg?style=for-the-badge&logo=windows) ![Setup](https://img.shields.io/badge/Native_.exe-Setup-brightgreen.svg?style=for-the-badge) ![Status](https://img.shields.io/badge/Status-Stable-orange.svg?style=for-the-badge)

mikuBot takes a massive leap in autonomy. **v2.3.0** introduces a persistent multi-session agent execution architecture and dynamic system prompts, fundamentally transforming how you interact with your digital assistant.

---

### ✨ What's New in This Release?

*   **⚡ Persistent Background Agents:** No more waiting. Miku now runs complex agent tasks continuously in the background. You can open a new neural branch or switch to another session while the agent is busy, maintaining a visually reactive pipeline that displays its status seamlessly.
*   **🛡️ Multi-Session Mode Isolation:** True multi-tasking without leaks. Switching sessions now meticulously isolates your `agentMode`, `safeMode`, and `approvalMode` configurations, preventing workflow interruptions.
*   **🧠 Dynamic Neural Injections:** The underlying message structure is rebuilt to append immediate reinforcements dynamically to your active interactions without duplicating history, drastically increasing reasoning precision on models like Gemini 1.5, Groq, and Ollama.
*   **🔐 Deep System Protection:** Added hardcoded strict execution barriers. Operations trying to modify `SOUL.md`, `USER.md`, or `IDENTITY.md` will *always* trigger manual user confirmation, even in automatic or chat modes.

---

### 📦 How to Update Safely

Simply download the new installer **mikuBot-Setup-2.3.0.exe** from the **Assets** section below and run it. 

> [!IMPORTANT]
> **Safety First:** The wizard will handle the transition of your workspace folders. However, as with any major architectural update, we strongly recommend: **Run the Backup function** in the Settings Panel first. This preserves your **Sessions, Configuration, Context Library, and Neural Skills** — the unique personality and knowledge you've built.

> [!CAUTION]
> **CRITICAL MANUAL TWEAK EXPECTED (MODES.MD UPGRADE)**
> Because this version completely overhauls the internal System Prompt instruction architecture, your existing `MODES.md` file will NOT work properly, resulting in degraded agent operations.
> 
> To prevent wiping your customizations with a Factory Reset, **please update your [`MODES.md`](https://raw.githubusercontent.com/NeuralArchLabs/mikuBot/main/public/core/MODES.md) manually:**
> 1. Open mikuCentral.
> 2. Go to the **Commands Editor** (lightning bolt icon in the sidebar).
> 3. Navigate and click on `MODES.md`.
> 4. Go to this URL in your browser: [https://raw.githubusercontent.com/NeuralArchLabs/mikuBot/main/public/core/MODES.md](https://raw.githubusercontent.com/NeuralArchLabs/mikuBot/main/public/core/MODES.md)
> 5. **Copy ALL the text** from that website.
> 6. Replace everything in your `MODES.md` editor window with the copied text and save it.

---

### 🧪 Try it, Share it, and Give us Feedback!

*   **🚀 Explore:** Set the agent to scrape or summarize a massive file, switch to a new tab, and chat casually while it works in the background.
*   **📢 Share:** Help us reach more developers and power users by sharing this highly capable release.
*   **💬 Feedback:** Let us know what custom agents you've built using the background execution capabilities!

---

*Developed with precision and commitment by **NeuralArchLabs**.*
