<div align="center">

<img src="./public/mikuBotICON.png" width="120" style="border-radius: 24px" alt="MikuBot Icon" />

# 🌟 MikuBot v2.1.6 — 您的 Windows 个人 AI 助手

![状态](https://img.shields.io/badge/状态-稳定-green.svg?style=for-the-badge)
![平台](https://img.shields.io/badge/平台-Windows_10%2F11-0078D4.svg?style=for-the-badge&logo=windows)
![许可证](https://img.shields.io/badge/许可证-AGPL--3.0-blue.svg?style=for-the-badge)

[Español](README.md) | [English](README.en.md)

<br/>

<a href="https://github.com/NeuralArchLabs/mikuCentralv1.0">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=32&pause=3000&color=60A5FA&center=true&vCenter=true&width=600&height=60&lines=mikuCentral;%7B%7B%F0%9F%A7%A0%E2%89%88%5E.%E2%94%AC.%5E%E2%89%88%E2%80%BF%E2%9F%86%E2%9C%A8%7D%7D;mikuCentral" alt="Neural Signature" />
</a>

<br/>

<a href="https://github.com/NeuralArchLabs/mikuBot/releases/download/v2.1.6/MikuBot-Setup-2.1.6.exe">
  <img src="https://img.shields.io/badge/下载最新版本-v2.1.6-60A5FA?style=for-the-badge&logo=windows&logoColor=white" height="40" />
</a>

<br/>

面向普通大众的 AI 代理和助手。设计为 OpenClaw 等更复杂工具的友好替代方案，易于安装和使用，非常适合没有高级技术知识的用户。

</div>

---

## ✨ 主要特点

*   **深度入门和个性化：** 具有引导您逐步进行初始配置的过程。从第一刻起，您就可以向助手提供您想让它了解的关于您的所有信息，实现绝对个性化。
*   **自主和操作模式：** 具有专注于不同类型辅助的聊天模式和代理模式，均具有原生工具执行功能。在*完全自主*模式、*安全模式*（需要事先授权）以及创建用于完全自主的**计划任务**之间进行选择。
*   **上下文库：** 一个允许您创建、存储和引用协议和文档的模块，以便随时与助手一起审查、改进或应用。
*   **语音和 24/7 连接：** 包括开箱即用的原生语音识别（通过 Vosk）英语和西班牙语。此外，它允许通过 Telegram（通过 BotFather）轻松链接，以 24/7 全天候运行。
*   **100% 多语言支持 (中/英/西)：** 与市场上其他通常仅限于单一语言的替代方案不同，MikuBot **经过完全翻译和优化**，可在**中文、英语和西班牙语**中完美运行。从界面到代理的推理，系统在所有三种语言中都提供原生且流畅的体验，赋予我们技术上的优越性和全球适用性。
*   **便携性和备份：** 允许将完整内存转储到压缩文件中，以备份所有内容，包括会话、个性化、内存、*技能*和访问密钥。
*   **Windows 优先：** 在 Electron 中编程以实现可扩展性，但 100% 专注于 Windows，与 **searXena** 实现完美的本地集成。

---

## 🤓 技术细节 (针对开发人员和高级用户)

在其友好的界面之下，MikuBot 是一个专业级的自主代理执行环境，专为技术主权而设计。

### 🏛️ 项目起源与完整性
MikuBot **不是 OpenClaw 的分支**，也没有使用任何来自 **Claude Code** (2026年3月31日泄露) 的逻辑。本项目是 100% 独立的，于 **2026 年 2 月**初启动，旨在优化小参数模型 (SLMs) 以高效执行工具和代理任务。

其开发过程采用敏捷方法，严格基于研究、试验和错误，直至达到目前的阶段。我们坚持以透明度和专有架构作为安全、主权系统的基石。

### 🧠 多模型神经智能
- **Ollama:** 100% 本地和私人推理。
- **Google AI (Gemini):** 具有海量上下文窗口的海量模型。
- **Groq:** 提供各种价格合理的模型。
- **Z.AI (BigModel):** 先进的代码编写能力。
- **Neural Flow:** 将内部思考（*内部独白*）与执行的技术动作在视觉上分开的界面。

### 🛠️ 工具生态系统和安全
**多根文件系统 (`SafePathResolver`):**
- `@WORKSPACE/` — 主项目目录。
- `@CORE/` — 系统逻辑和基础提示。
- `@LIBRARY/` — 协议和知识库。
- `@TOOLS/` — 技能蓝图和脚本。

包括 `read_file`, `smart_patch`, `search_files` 等原生工具，以及 shell 注入保护（`run_console` 白名单）。

### 💻 技术栈
- **前端:** React 19 + TypeScript
- **样式:** Vanilla CSS + Tailwind CSS 4.1
- **桌面运行时:** Electron 40.2 (原生 Node.js 集成)
- **构建工具:** Vite 6.2
- **状态管理:** Zustand 5.0
- **推理:** Google GenAI SDK, fetch-proxy for Ollama, OpenAI 兼容

---

## 🚀 本地安装和开发
```bash
# 1. 克隆此仓库
git clone https://github.com/NeuralArchLabs/mikuBot.git
cd mikuBot

# 2. 安装依赖项
npm install

# 3. 在开发模式下运行
npm run electron:dev

# 4. 构建生产版本
npm run electron:build
```

---

## ⚖️ 许可证和归属
在 **GNU Affero General Public License v3.0 (AGPL-3.0)** 下分发。

**嵌入式 Python 引擎:**
MikuCentral 包括嵌入式 Python 3.11.9。在 **Python Software Foundation License Version 2** 下分发。

---

## 🏛️ 致谢和免责声明
MikuBot 是由 **Neural Arch Labs** 开发和维护的一项倡议。

**商标声明:** 本软件出于参考和信息目的使用 AI 提供商（Google Gemini, Groq, Ollama, Z.AI 等）的名称和徽标。**Neural Arch Labs 不拥有这些权利**。

*由 Neural Arch Labs 精确开发。*
