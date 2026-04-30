<div align="center">

<img src="./public/mikuBotICON.png" width="120" style="border-radius: 24px" alt="mikuBot Icon" />

# 🌟 mikuBot v2.4.0 — 记忆与组件更新 (The Memory & Widgets Update)

![状态](https://img.shields.io/badge/状态-稳定-green.svg?style=for-the-badge)
![平台](https://img.shields.io/badge/平台-Windows_10%2F11-0078D4.svg?style=for-the-badge&logo=windows)
![许可证](https://img.shields.io/badge/许可证-AGPL--3.0-blue.svg?style=for-the-badge)

[Español](README.md) | [English](README.en.md)

<br/>

<a href="https://github.com/NeuralArchLabs/mikuCentralv1.0">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=32&pause=3000&color=60A5FA&center=true&vCenter=true&width=600&height=60&lines=mikuCentral;%7B%7B%F0%9F%A7%A0%E2%89%88%5E.%E2%94%AC.%5E%E2%89%88%E2%80%BF%E2%9F%86%E2%9C%A8%7D%7D;mikuCentral" alt="Neural Signature" />
</a>

<br/>

<a href="https://github.com/NeuralArchLabs/mikuBot/releases/download/v2.4.0/mikuBot-Setup-2.4.0.exe">
  <img src="https://img.shields.io/badge/下载最新版本-v2.4.0-60A5FA?style=for-the-badge&logo=windows&logoColor=white" height="40" />
</a>

<br/>

面向普通大众的 AI 代理和助手。设计为 OpenClaw 等更复杂工具的友好替代方案，易于安装 and 使用，非常适合没有高级技术知识的用户。

<br/>

<img src="./public/preview.gif" width="100%" style="border-radius: 12px; border: 1px solid #30363d" alt="mikuBot Preview" />

</div>

---

## ✨ 主要特点

*   **深度入门和个性化：** 具有引导您逐步进行初始配置的过程。从第一刻起，您就可以向助手提供您想让它了解的关于您的所有信息，实现绝对个性化。
*   **自主和操作模式：** 具有专注于不同类型辅助的聊天模式和代理模式，均具有原生工具执行功能。在*完全自主*模式、*安全模式*（需要事先授权）以及创建用于完全自主的**计划任务**之间进行选择。
*   **持久的多会话执行 (Studio Elite)：** Miku 在切换神经分支时不再停止。代理可以在后台自主完成复杂任务，同时您与其他会话交互，保持持久的反应式链接通知您其他分支的处理状态。
*   **多维主题系统 (Atmosphere Engine)：** 5 款预置的精美主题（`Miku`、`Cloud`、`Midnight`、`Cyberpunk`、`Forest`）带来绝对的视觉个性化。每个主题都能完美适配整个界面，为您打造专属的沉浸式工作环境。
*   **神经凭据保险库：** 您的 API 密钥现在由 `processVault` 系统保护，自动进行静态加密。无需手动干预即可实现主权级安全。
*   **上下文库 (Context Library):** 一个专门用于创建、存储和管理协议、技术文档和静态知识库的模块。它允许 Miku 访问特定任务的精选参考信息，而不会干扰动态记忆。
*   **语义记忆 (Recall Skill):** 与静态库不同，Recall 是一种自主的长期记忆技能。Miku 跨会话记录用户偏好、细节和关键概念，创建一个递归导航结构和随每次交互而演进的用户模型。
*   **生成式动态组件 (Generative Widgets):** mikuBot 现在支持生成式组件 architecture。您可以要求助手为特定任务创建任何自定义组件；Miku 将对其进行编程，在您的工作区中启动它，并将其保存以供将来会话使用。您甚至可以关闭主应用程序，组件仍将在您的 Windows 桌面上保持活动和正常运行。
*   **mikuBot Markdown Engine (Studio Elite):** mikuBot 集成了一个专业级渲染引擎，专为技术主权和技术精确度而设计。此 "Studio Elite" 套件重新定义了视觉交互：
    *   **Mermaid 语法修复:** 原生支持修正和规范化 AI 生成图表中的语法错误（尤其是 `gitGraph`），确保视觉架构始终能够正确渲染。
    *   **文档完整性保障 (Protection Pipeline):** 三阶段流水线，确保图像、链接和嵌套代码块即使在复杂的 Markdown 布局中也能保持完美的结构。
    *   **专业级科学渲染 (LaTeX):** 针对复杂数学公式 ($$ 和 $)、微积分、矩阵和物理常数的高精度引擎。
    *   **架构与数据逻辑 (Mermaid):** 直接在聊天线程中原生可视化流程图、Git 图和思维导图。
    *   **结构化知识管理 (Callouts):** 通用 Obsidian 风格支持 (`> [!TYPE]`)，具有 14 种响应式样式。
    *   **动力学与渐进式画布:** 有机动画系统，将信息揭示与助手的实时思考同步。
*   **语音、連接与专业背景：** 包括开箱即用的原生语音识别（Vosk）。此外，新增 **大气背景图库**，通过 `local://` 协议实现高性能加载，支持零延迟的背景自定义。还支持通过 Telegram (via BotFather) 全天候运行。
*   **100% 多语言支持 (中/英/西)：** 与市场上其他通常仅限于单一语言的替代方案不同，mikuBot **经过完全翻译和优化**，可在**中文、英语和西班牙语**中完美运行。从界面到代理的推理，系统在所有三种语言中都提供原生且流畅的体验，赋予我们技术上的优越性和全球适用性。
*   **便携性和备份：** 允许将完整内存转储到压缩文件中，以备份所有内容，包括会话、个性化、内存、*技能*和访问密钥。
*   **Windows 优先：** 在 Electron 中编程以实现可扩展性，但 100% 专注于 Windows，与 **searXena** 实现完美的本地集成，短期内没有移植到其他系统的计划。

---

## 🤓 技术细节 (针对开发人员和高级用户)

在其友好的界面之下，mikuBot 是一个专业级的自主代理执行环境，专为技术主权而设计。

### 🏛️ 项目起源与完整性
### 🏛️ 项目起源和完整性
mikuBot 是一个 100% 独立的项目，于 **2026 年 2 月**初启动（见下方证据图像），旨在优化小参数模型 (SLMs) 以高效执行工具和代理任务。其开发过程采用敏捷方法，严格基于研究、试验和错误，直至达到目前的阶段。

它**不是 OpenClaw 的分支**，也没有使用任何来自 **Claude Code** (2026年3月31日泄露) 的逻辑。我们坚持以透明度和专有架构作为安全、主权系统的基石。

<div align="center">
  <img src="./public/startDateEvidence.png" width="600" style="border-radius: 8px; border: 1px solid #30363d" alt="项目启动证据" />
  <p><i>mikuBot 逻辑核心第一个提交的快照（2026年2月）。</i></p>
</div>

> [!NOTE]
> 出于存储库历史安全原因（防止开发密钥或其他来自早期环境的敏感数据意外泄露），代码是在其实际启动日期之后以“干净”版本发布到 GitHub 的。

### 🧠 多模型神经智能
- **Ollama:** 100% 本地和私人推理，并可访问具有非常慷慨的免费层的云模型。
- **Google AI:** 具有海量上下文窗口的海量模型，提供免费层。
- **Groq:** 提供各种价格合理的模型供选择。
- **Z.AI (BigModel):** 访问专注于代码编写和技术推理的模型。
- **Neural Flow:** 将内部思考（*内部独白*）与执行的技术动作在视觉上分开的界面。

### 🛠️ 工具生态系统和安全
**多根文件系统 (`SafePathResolver`):**
- `@WORKSPACE/` — 主项目目录。
- `@CORE/` — 系统逻辑和基础提示。
- `@LIBRARY/` — 协议和知识库。
- `@TOOLS/` — 技能蓝图和脚本。

系统包括注入到 LLM 中的原生工具，如 `read_file`、`smart_patch`、`search_files` 和 Shell 注入保护（`run_console` 白名单）。

### 🏆 为什么选择 mikuBot？ (竞品分析)

mikuBot 不仅仅是另一个 AI 客户端；它是一个专为数据主权和技术精度设计的代理执行环境。下面，我们将我们的方法与其他本地代理和最流行的 Web 客户端进行对比。

#### 🏛️ 第 1 层：本地自主代理

| 特性 / 方法 | 🌐 **mikuBot (我们的关注点)** | 🏛️ **Hermes Agent** | 🦞 **OpenClaw** | 🧠 **memUBot (NevaMind-AI)** |
| :--- | :--- | :--- | :--- | :--- |
| **范式与界面** | **混合模式 (桌面 + 24/7).** 全面的视觉控制，支持后台持久运行及 Telegram 远程联动。 | **全天候运行 / 自主代理.** 作为后台服务 24/7 运行的持久助手。 | **无头守护进程 / 消息传递.** 通过 WhatsApp、Telegram 或终端 (TUI) 控制。 | **企业团队机器人.** 主要集成到 Slack、Discord 或飞书。 |
| **Windows 运行** | **100% 原生 (`.exe`).** 优化后直接在 Windows 内核上运行。 | **服务端 / VPS.** 专为持久的自托管基础设施设计。 | **需要 WSL2 (Ubuntu).** 依赖于 Linux 子系统和手动 bash 脚本。 | 原生 / 跨平台，但服务器端架构沉重。 |
| **学习曲线** | **即时 (向导式).** 为任何用户提供逐步安装和引导设置。 | **中等偏高.** 需要配置消息网关和服务器。 | **高.** 需要深厚的 CLI 知识和 Linux 环境配置。 | **中.** 设置面向 IT 部门和企业工作流。 |
| **学习 / 记忆** | **双重架构 (Recall + Library).** 用户语义记忆 + 精选知识库。 | **学习循环.** 自主创建并不断优化可重用的技能。 | **基于文件.** 通过本地文件读取进行上下文管理。 | **企业历史.** 工作团队的数据集中化。 |
| **视觉推理** | **Neural Flow.** 思想、工具使用和状态的实时视觉流。 | **日志 / 消息界面.** 通过外部聊天界面进行交互。 | **文本日志.** 原始终端输出，没有内部状态的视觉表示。 | **标准历史.** 传统的聊天界面，没有视觉技术细分。 |
| **语言 (主权)** | **通用 (中/英/西).** 三种语言的功能和推理绝对对等。 | **以英文为中心.** 针对英语推理和模型进行了优化。 | **以英文为中心.** 几乎专门针对英语进行了优化支持。 | **以英文为中心.** 有限的多语言支持。 |

#### ☁️ 第 2 层：基于 Web 的 AI 客户端

| 特性 | 🌐 **mikuBot (本地网关)** | 🌐 **Open Web UI** | 🤖 **ChatGPT / Gemini / Perplexity** |
| :--- | :--- | :--- | :--- |
| **数据访问** | **深层上下文.** 直接访问您的文件系统 (@WORKSPACE) 和本地资源。 | **RAG / 文件上传.** 通过本地向量化进行文档管理。 | **Web 沙箱.** 仅限于手动上传的文件或通用的 Web 搜索。 |
| **工具执行** | **绝对主权.** 原生执行 Python、SearXena 和脚本，无需中间人。 | **Docker / 沙箱.** 支持在容器内运行函数和脚本。 | **受限云端.** 在受限权限的隔离远程服务器中执行代码。 |
| **隐私与控制** | **您是所有者.** 数据归您所有；您可以选择供应商和分享内容。 | **本地 / 自托管.** 如果在本地运行，则拥有完全控制权。 | **封闭生态系统.** 您的数据通常用于训练供应商未来的模型。 |
| **可视化** | **Studio Elite.** LaTeX、Mermaid 和提示框的高保真科学级渲染。 | **标准 Web UI.** 简洁且功能齐全的浏览器界面。 | **基础 Markdown.** 具有较低技术灵活性的标准浏览器可视化。 |
| **本地优化** | **超高效.** 专为最大化小参数模型 (SLMs) 的性能而设计。 | **通用型.** 针对通过服务端运行的大规模模型进行了优化。 | **依赖云端.** 需要持续联网且依赖海量模型。 |

#### 🚀 mikuBot 优势：卓越的四大支柱

1.  **原生性能与本地主权：** mikuBot 完全支持通过 **Ollama** 在本地运行模型。我们已经证明，即使是像 **Gemma 3 4B** 这样的小参数模型 (SLMs)，在聊天模式下的表现也异常出色，在交互体验和 UI 呈现上超越了依赖海量模型的其他聊天机器人。
2.  **精度与个性化 (由 [searXena](https://github.com/NeuralArchLabs/searXena) 驱动)：** 无需猜测。Miku 在响应前会咨询您的文件，并利用我们原生开发的 **searXena** 主权元搜索引擎，确保准确、实时的结果。
3.  **绝对透明 (反黑盒)：** 您掌控一切。每一个模型决策、提示和数据字节都是实时可审计的。
4.  **供应商自由：** 在几秒钟内切换大脑（Ollama, Gemini, Groq, Z.AI），而不会丢失工作流。Miku 是您的通用主权接口。

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
mikuBot 的实现归功于 React (MIT)、Vite (MIT)、Electron (MIT)、Mermaid.js (MIT)、Font Awesome Free (CC BY 4.0 / MIT / SIL OFL 1.1)、**Outfit 字体 (SIL OFL 1.1)**、**Vosk 引擎 (Apache 2.0)**、Tailwind CSS (MIT)、Zustand (MIT)、i18next (MIT)、unzipper (MIT)、FastAPI (MIT)、**PyMuPDF / fitz (AGPL-3.0)** 以及 Ollama 和 Google GenAI (Apache 2.0) 等 AI SDKs。有关更多详细信息，请参阅 [`LICENSE`](./LICENSE) 文件。

**嵌入式 Python 引擎:**
mikuCentral 包括嵌入式 Python 3.11.9，作为所有基于 Python 的功能 (SearXena、语音识别、技能执行) 的通用引擎。Python 在 **Python Software Foundation License Version 2** 下分发，这是一种允许在专有软件中使用而无需开源义务的许可证。该软件包还包括 MIT (libffi)、BSD (bzip2、Tcl/Tk) 和 Microsoft Distributable Code for Windows 许可证下的组件。有关完整的 Python 分发条款，请参阅 [`engine/python/LICENSE.txt`](./engine/python/LICENSE.txt)。

---

## 🏛️ 致谢和免责声明
mikuBot 是由 [**Neural Arch Labs**](https://github.com/NeuralArchLabs) 开发和维护的一项倡议。

**商标声明:** 本软件使用人工智能推理提供商（如 Google Gemini、Groq、Ollama、Z.AI 等）的名称、徽标和商标，仅出于面向最终用户导航的参考和信息目的。**[Neural Arch Labs](https://github.com/NeuralArchLabs) 不拥有这些徽标或商品名称的权利**，与上述实体没有官方隶属关系或赞助关系，也不从其使用或包含在界面中获得任何收益、利润或经济利益。mikuBot 仅作为中立客户端（工具）供用户通过自己的配置消费服务。

🤝 **协作与赞助:** 我们是一个致力于开源技术和数字主权的独立实验室。我们完全开放企业合作、官方集成和外部赞助。如果您代表 AI 提供商或希望在财务上支持 mikuBot 的持续开发，请随时与我们联系！

---

## 🐾 我们名字的由来

人们通常会认为 **mikuBot** 是以著名的虚拟偶像*初音未来 (Hatsune Miku)*命名的。然而，它的起源非常个人化。“Miku” 这个词的意思是“天空”，这就是为什么我给照片中间的小猫起了这个名字。她是我和她的两个兄弟姐妹一起救助的，从那以后，她一直陪着我，在我编程时总是呆在我身边。

<div align="center">
  <img src="./public/Zanahorio_Miku_Freya.png" alt="Zanahorio, Miku and Freya" width="100%" style="max-width: 500px; border-radius: 12px; margin: 15px 0;" />
  <p><i>从左到右: Zanahorio, Miku 和 Freya。</i></p>
</div>

mikuBot 仅仅是为了感谢她在实验室里无条件的陪伴。

---
*由 [Neural Arch Labs](https://github.com/NeuralArchLabs) 精确开发。*
