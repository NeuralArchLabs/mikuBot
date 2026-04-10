<div align="center">

<img src="./public/mikuBotICON.png" width="120" style="border-radius: 24px" alt="MikuBot Icon" />

# 🌟 MikuBot v2.3.0 — The Sovereign Persistence Update

![状态](https://img.shields.io/badge/状态-稳定-green.svg?style=for-the-badge)
![平台](https://img.shields.io/badge/平台-Windows_10%2F11-0078D4.svg?style=for-the-badge&logo=windows)
![许可证](https://img.shields.io/badge/许可证-AGPL--3.0-blue.svg?style=for-the-badge)

[Español](README.md) | [English](README.en.md)

<br/>

<a href="https://github.com/NeuralArchLabs/mikuCentralv1.0">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=32&pause=3000&color=60A5FA&center=true&vCenter=true&width=600&height=60&lines=mikuCentral;%7B%7B%F0%9F%A7%A0%E2%89%88%5E.%E2%94%AC.%5E%E2%89%88%E2%80%BF%E2%9F%86%E2%9C%A8%7D%7D;mikuCentral" alt="Neural Signature" />
</a>

<br/>

<a href="https://github.com/NeuralArchLabs/mikuBot/releases/download/v2.3.0/MikuBot-Setup-2.3.0.exe">
  <img src="https://img.shields.io/badge/下载最新版本-v2.3.0-60A5FA?style=for-the-badge&logo=windows&logoColor=white" height="40" />
</a>

<br/>

面向普通大众的 AI 代理和助手。设计为 OpenClaw 等更复杂工具的友好替代方案，易于安装 and 使用，非常适合没有高级技术知识的用户。

<br/>

<img src="./public/preview.gif" width="100%" style="border-radius: 12px; border: 1px solid #30363d" alt="MikuBot Preview" />

</div>

---

## ✨ 主要特点

*   **深度入门和个性化：** 具有引导您逐步进行初始配置的过程。从第一刻起，您就可以向助手提供您想让它了解的关于您的所有信息，实现绝对个性化。
*   **自主和操作模式：** 具有专注于不同类型辅助的聊天模式和代理模式，均具有原生工具执行功能。在*完全自主*模式、*安全模式*（需要事先授权）以及创建用于完全自主的**计划任务**之间进行选择。
*   **持久的多会话执行 (Studio Elite)：** Miku 在切换神经分支时不再停止。代理可以在后台自主完成复杂任务，同时您与其他会话交互，保持持久的反应式链接通知您其他分支的处理状态。
*   **上下文库：** 一个允许您创建、存储和引用协议和文档的模块，以便随时与助手一起审查、改进或应用。
*   **MikuBot Markdown Engine (Studio Elite):** MikuBot 集成了一个专业级渲染引擎，专为技术主权和技术精确度而设计。此 "Studio Elite" 套件重新定义了视觉交互：
    *   **专业级科学渲染 (LaTeX):** 针对复杂数学公式 ($$ 和 $)、微积分、矩阵和物理常数的高精度引擎。为研究人员和学生提供出版级的技术报告能力。
    *   **架构与数据逻辑 (Mermaid):** 流程图、Git 图和思维导图的原生可视化。通过在聊天线程中直接呈现架构和逻辑，消除了对外部工具的依赖。
    *   **结构化知识管理 (提示框):** 通用 Obsidian 风格支持 (`> [!TYPE]`)，用于组织指令、日志和协议，具有 14+ 种反应式样式和同步打字动画。
    *   **动力学与渐进式画布:** 有机动画系统和动态排版，将信息揭示与助手的实时推理同步，提供“活的”界面体验。
    *   **文档完整性 (保护管道):** 3 阶段管道，确保图像、链接和嵌套代码块无论 AI 数据流复杂度如何，都能保持完美的结构完整性。*   **语音和 24/7 连接：** 包括开箱即用的原生语音识别（通过 Vosk）英语和西班牙语。此外，它允许通过 Telegram（通过 BotFather）轻松链接，以 24/7 全天候运行。
*   **100% 多语言支持 (中/英/西)：** 与市场上其他通常仅限于单一语言的替代方案不同，MikuBot **经过完全翻译和优化**，可在**中文、英语和西班牙语**中完美运行。从界面到代理的推理，系统在所有三种语言中都提供原生且流畅的体验，赋予我们技术上的优越性和全球适用性。
*   **便携性和备份：** 允许将完整内存转储到压缩文件中，以备份所有内容，包括会话、个性化、内存、*技能*和访问密钥。
*   **Windows 优先：** 在 Electron 中编程以实现可扩展性，但 100% 专注于 Windows，与 **searXena** 实现完美的本地集成，短期内没有移植到其他系统的计划。

---

## 🤓 技术细节 (针对开发人员和高级用户)

在其友好的界面之下，MikuBot 是一个专业级的自主代理执行环境，专为技术主权而设计。

### 🏛️ 项目起源与完整性
MikuBot **不是 OpenClaw 的分支**，也没有使用任何来自 **Claude Code** (2026年3月31日泄露) 的逻辑。本项目是 100% 独立的，于 **2026 年 2 月**初启动（见下方证据图像），旨在优化小参数模型 (SLMs) 以高效执行工具和代理任务。

<div align="center">
  <img src="./public/startDateEvidence.png" width="600" style="border-radius: 8px; border: 1px solid #30363d" alt="项目启动证据" />
  <p><i>MikuBot 逻辑核心第一个提交的快照（2026年2月）。</i></p>
</div>

> [!NOTE]
> 出于存储库历史安全原因（防止开发密钥或其他来自早期环境的敏感数据意外泄露），代码是在其实际启动日期之后以“干净”版本发布到 GitHub 的。

其开发过程采用敏捷方法，严格基于研究、试验和错误，直至达到目前的阶段。我们坚持以透明度和专有架构作为安全、主权系统的基石。

### 🧠 多模型神经智能
- **Ollama:** 100% 本地和私人推理，并可访问具有非常慷慨的免费层的云模型。
- **Google AI:** 具有海量上下文窗口的海量模型，提供免费层。
- **Groq:** 提供各种价格合理的模型供选择。
- **Z.AI (BigModel):** 以无与伦比的价格提供先进的代码编写能力。
- **Neural Flow:** 将内部思考（*内部独白*）与执行的技术动作在视觉上分开的界面。

### 🛠️ 工具生态系统和安全
**多根文件系统 (`SafePathResolver`):**
- `@WORKSPACE/` — 主项目目录。
- `@CORE/` — 系统逻辑和基础提示。
- `@LIBRARY/` — 协议和知识库。
- `@TOOLS/` — 技能蓝图和脚本。

系统包括注入到 LLM 中的原生工具，如 `read_file`、`smart_patch`、`search_files` 和 Shell 注入保护（`run_console` 白名单）。

### 🏆 为什么选择 MikuBot？ (竞争分析)
| 特性 / 重点 | 🌐 **MikuBot (我们的方法)** | 🦞 **OpenClaw** | 🧠 **memUBot (NevaMind-AI)** |
| :--- | :--- | :--- | :--- |
| **范式和界面** | **桌面应用 (高级 GUI)。** 完全的可视化推理和文件管理控制。 | **无头守护进程 / 消息。** 通过 WhatsApp、Telegram 或终端 (TUI) 控制。 | **团队企业机器人。** 主要集成到 Slack、Discord 或飞书。 |
| **Windows 执行** | **100% 原生 (`.exe`)。** 经过优化，可直接在 Windows 内核上运行。 | **需要 WSL2 (Ubuntu)。** 依赖于 Linux 子系统和手动 Bash 脚本。 | 原生/跨平台，但采用繁重的服务器架构。 |
| **系统安全** | **SafePathResolver。** 受限访问和命令白名单。*零泄漏。* | **关键风险。** 最近发生过严重的漏洞历史 (ClawHub 漏洞)。 | **企业级安全 (SOC2)。** 需要复杂的权限配置。 |

### 💻 技术栈
| 组件 | 技术 |
| :--- | :--- |
| **前端** | React 19 + TypeScript |
| **样式** | Vanilla CSS + Tailwind CSS 4.1 |
| **桌面运行时** | Electron 40.2 (原生 Node.js 集成) |
| **构建工具** | Vite 6.2 |
| **状态管理** | Zustand 5.0 |
| **推理** | Google GenAI SDK, fetch-proxy for Ollama, OpenAI 兼容 |

### 🚀 本地安装和开发
```bash
# 1. 克隆此仓库
git clone https://github.com/NeuralArchLabs/mikuBot.git
cd mikuBot

# 2. 安装依赖项
npm install

# 3. 在开发模式下运行 (带 Electron HMR)
npm run electron:dev

```

### ⚖️ 许可证和开源归属
本项目在 **GNU Affero General Public License v3.0 (AGPL-3.0)** 下分发。如果您修改此程序并将其作为网络服务提供，您必须向您的用户提供源代码。

**第三方致谢:**
MikuBot 的实现归功于 React (MIT)、Vite (MIT)、Electron (MIT)、Mermaid.js (MIT)、Font Awesome Free (CC BY 4.0 / MIT / SIL OFL 1.1)、**Outfit 字体 (SIL OFL 1.1)**、**Vosk 引擎 (Apache 2.0)**、Tailwind CSS (MIT)、Zustand (MIT)、i18next (MIT)、unzipper (MIT)、FastAPI (MIT) 以及 Ollama 和 Google GenAI (Apache 2.0) 等 AI SDKs。有关更多详细信息，请参阅 [`LICENSE`](./LICENSE) 文件。

**嵌入式 Python 引擎:**
MikuCentral 包括嵌入式 Python 3.11.9，作为所有基于 Python 的功能 (SearXena、语音识别、技能执行) 的通用引擎。Python 在 **Python Software Foundation License Version 2** 下分发，这是一种允许在专有软件中使用而无需开源义务的许可证。该软件包还包括 MIT (libffi)、BSD (bzip2、Tcl/Tk) 和 Microsoft Distributable Code for Windows 许可证下的组件。有关完整的 Python 分发条款，请参阅 [`engine/python/LICENSE.txt`](./engine/python/LICENSE.txt)。

---

## 🏛️ 致谢和免责声明
MikuBot 是由 **Neural Arch Labs** 开发和维护的一项倡议。

**商标声明:** 本软件使用人工智能推理提供商（如 Google Gemini、Groq、Ollama、Z.AI 等）的名称、徽标和商标，仅出于面向最终用户导航的参考和信息目的。**Neural Arch Labs 不拥有这些徽标或商品名称的权利**，与上述实体没有官方隶属关系或赞助关系，也不从其使用或包含在界面中获得任何收益、利润或经济利益。MikuBot 仅作为中立客户端（工具）供用户通过自己的配置消费服务。

🤝 **协作与赞助:** 我们是一个致力于开源技术和数字主权的独立实验室。我们完全开放企业合作、官方集成和外部赞助。如果您代表 AI 提供商或希望在财务上支持 MikuBot 的持续开发，请随时与我们联系！

---
*由 Neural Arch Labs 精确开发。*
