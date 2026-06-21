<div align="center">
  <p>
    <a href="README.en.md">English</a> | <a href="README.md">Versión en Español</a> | 🌎 <b>中文版</b>
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

一个敏捷的原生元搜索引擎和高性能数据基础设施，旨在回归网络初衷。专为追求纯净搜索体验的人类以及需要绕过商业 API 密钥限制、降低开发成本的 AI 智能体而设计。
  </p>
  
  <p>
    <a href="#起源与致谢">起源</a> • 
    <a href="#技术栈">技术栈</a> • 
    <a href="#主要功能">功能</a> • 
    <a href="#人工智能与智能体">AI 智能体</a> • 
    <a href="#隐私架构">隐私</a> • 
    <a href="#安装与使用本地模式">安装</a> • 
    <a href="#受限许可与鸣谢">致谢</a>
  </p>
</div>

---

## 📖 起源与致谢

searXena 最初作为一个研究项目诞生，旨在创建一个可在 Windows 操作系统上原生运行的实验性 [SearXNG](https://github.com/searxng/searxng) 移植版，从而摆脱 Docker 容器或 WSL 子系统的开销负担。

随着开发的深入以及对深度交互集成的需求增加，**searXena 逐渐演变成一个独立迭代的软件**。我们在自有微管理架构 (FastAPI) 下重写并构建了代码库，同时保留了开源运动所确立的用户数据主权精神。

我们郑重向原生 SearXNG 项目及其社区贡献者致敬，是他们为透明且私密元搜索引擎的运作方式奠定了通用标准和理论基础（解析器、请求管理、代理请求头）。

## 🛠️ 技术栈

searXena 利用极轻量级的现代技术，确保即使在旧的本地硬件上也能实现超流畅执行：

- **后端:** [Python 3.x](https://www.python.org/) 与 [FastAPI](https://fastapi.tiangolo.com/)（高性能异步框架）。
- **Web 服务器:** [Uvicorn](https://www.uvicorn.org/)（原生 ASGI 支持）。
- **网络处理:** 使用 `httpx` 处理极低延迟的异步、并发 HTTP/2 请求。
- **前端与渲染:** [Jinja2](https://jinja.palletsprojects.com/) 配合原生 JavaScript（零 React 类框架）和纯 CSS3，确保超高响应速度。
- **提取引擎:** `O-ZEN Engine`（原生提取核心 - AGPLv3）。
- **DOM 解析器:** `lxml` 与 `selectolax` 以及模块化选择器。

## ✨ 主要功能

* 🚀 **异步并发元搜索:** 您的一次搜索请求将触发数十个向全球搜索引擎和信息源的异步请求，并在不到1秒内完成聚合。
* 🤖 **AI-First 优先集成:**  原生的 JSON 格式以及内置工具 (Tools) 规范模式，可直接用于将您的 LLM 连入互联网，无需承担刮取渲染后 HTML 带来的资源开销。
* 🛡️ **隐私保护机制:** 作为用户与全球网络之间的中性接口。通过透明地集中处理请求，在不干扰原始服务的前提下提升了匿名性。
* 📦 **100% Windows 原生:** 零复杂环境依赖。只需克隆代码、运行 `.ps1` 脚本即可拥有一个运行在本地且能显著减少外部遥测的自建搜索引擎。
* 📱 **现代动态 UI/UX:** 流畅的动画、极致的深色模式（"太空紫"）、响应式界面，并按类别分页呈现（综合、IT/科学、地图、视频、图片）。
* 🌎 **丰富的信息卡片:** 吸取主流商业搜索引擎优点，引入信息侧边栏（"Infoboxes"）。
* 🧘 **O-ZEN Engine (阅读模式):** 内置工业级提取核心 (AGPLv3)，可在纯净界面中阅读文章和技术文档，自动拦截侵入性脚本。

## 🥊 为什么我们在 Windows 平台没有对手 (searXena vs 其他)

历史上，所有注重隐私的开源元搜索引擎（如 SearXNG 或 Whoogle）最初的**设计目标仅限于 GNU/Linux 环境或云端部署**。如果 Windows 用户想在本地运行它们，往往要面对无尽的技术折磨：安装 **WSL2** (Windows Subsystem for Linux)、为虚拟机分配固定内存资源、配置 **Docker** 守护进程、处理复杂的容器 NAT 桥接网路，并消耗数 G 存储空间仅仅为了启动一个搜索框。

**searXena 完全消除了这些障碍。我们在这个生态中没有对手，因为我们是 100% 原生的。**

| 特性 | 👾 所谓的"对手" (SearXNG / Whoogle) | 👑 searXena |
| :--- | :--- | :--- |
| **Windows 架构** | 强制虚拟化 (Docker / WSL2) | **内核直通** (基于原生 Python) |
| **内存占用** | 约 1 GB 到 2 GB (因为虚拟机/容器开销) | **~30 MB - 60 MB** (纯粹运行开销) |
| **启动时间** | 缓慢 (需先加载 Docker 引擎再加载环境) | **瞬间极速** (不到一秒钟) |
| **安装体验** | 复杂，偏向 Linux 系统管理员的命令行 | **极简** (一键 `.ps1` 自动配置脚本) |
| **LLM 工具调用** | 需额外安装社区适配器 | **原生 JSON API** 架构设计首日内置 |
| **数据提取 (RAG)** | 杂乱的 HTML 抓取 (外部) | **O-ZEN Engine** 原生 (LLM 就绪的阅读模式) |

除非您打算在云端租用 VPS，否则 searXena 是唯一合乎逻辑、可行且具有极致性能的答案；为您这些渴望在 *本地* 获得数据主权的挑剔 Windows 用户量身打造。

## 🤖 人工智能与智能体：零 API 密钥，零摩擦

searXena 消除了人工智能开发者访问网络的传统障碍：

*   **告别 API 密钥:** 无需再管理各种商业 API 密钥或订阅配额。searXena 是您自己的无限搜索节点。
*   **每笔查询零成本:** 即使大规模部署您的智能体或 RAG 系统，也无需为高额账单担忧。
*   **工业级数据流:** 向大语言模型（LLM）提供纯净、结构化的 native 格式数据流。我们将引擎设计为大语言模型 (LLM) 的实时“眼睛”。

*   **辅助 AI 探索互联网:** 提供干净、结构化的数据流，允许智能体在没有视觉渲染摩擦的情况下在 Web 上进行导航和研究。
*   **原生工具调用 (Tool Calling):** 从核心层面兼容 OpenAI/Anthropic 的“函数调用”标准。
*   **为 RAG 优化的排序:** 结果经过优先排序以供 *检索增强生成 (RAG)* 系统使用，过滤商业噪音并优先考虑实质性的技术和百科信息源。

## 🔒 透明的隐私架构

searXena 将确保您的数据不被第三方用于广告画像作为技术实现的出发点，通过在图形界面之下建立保护层来实现。尽管如此，我们的架构也基于几项技术共识，在此公开披露：

### 绝对 DOM 代理化
当您查询综合类内容（新闻、IT 编程）时，searXena 的后台引擎会保护您的身份。我们系统性地调整 `User-Agent`，从商业引擎拉取到的图像网址均经过内部 `/proxify` 代理路由系统处理，从而确保您的本地 IP 不会被直接暴露给第三方服务器。

### 地图模块: OSM (OpenStreetMap)
在专门的地图面板中，由于需要提供可交互体验（缩放、拖拽），searXena 采取了略微宽松的规则，但绝不妥协商业匿名性：
* **干净的地理编码**: 对于地标搜索名（例如 "Search Jalisco"），它首先经过后端屏蔽。OSM 永远不会知道您的搜索词。
* **IP 透明化（动态嵌入框架）**: 为了让您在此页面体验流式加载的可拖拽地图，我们直接嵌入了引向 `openstreetmap.org` 的 `iframe`。这会导致**您的浏览器为了向 OSM 全球节点下载瓦片图块，而暂时表露您的公网 IP**。
* 为何妥协：OSM 是一家坚定奉行[隐私至上](https://wiki.osmfoundation.org/wiki/Privacy_Policy)的开放基金会工程，它既非商业搜索引擎更不会叫卖跟踪 cookie 数据。为了换得功能完整的地图使用体验，该层面的原生通信暴露是被允许也是良性的。

### 可信资产加速 (维基百科/维基媒体)
遵循我们的 "直接媒体交付" (DMD) 架构，在不牺牲隐私的情况下优化性能：
* **高信任节点**: searXena 将维基百科 (Wikipedia) 和维基媒体 (Wikimedia) 服务器识别为高信任度的公共教育基础设施来源。
* **加载优化**: 鉴于这些平台严格不含广告跟踪器和第三方 Cookie，我们允许直接加载其多媒体资源。这在确保流畅、高分辨率用户体验的同时，也符合 searXena 建立的内部隐私协议。

## 🤖 原生的人工智能服务整合 (API)

searXena 并不仅仅为人类消费者设计。从其后台根基开始，它就定位成**供您的本地 or 云端 AI Agent (LLM) 调用的研究型搜索引擎**。它原生提供严格标准化的 *函数调用 (Tool Calling)* 架构支持（全面适配 OpenAI/Anthropic/Gemini 格式）。

您的智能体可通过 `/api/v1/search` 路由，自动化执行查询以获得**纯净无残渣、带明确索引和结构化的 JSON 响应体**，进而完全避免手动刮取 HTML / CSS 时面临的高昂视觉噪音处理成本。

* **AI 准备就绪的端口:**
  * `GET /api/v1/tools_schema`: 返回一个基于 `function_declarations` 协议的 JSON，可直接植入提示词喂给您的 LLM，并宣告支持的参数。
  * `POST /api/v1/search`: 执行搜寻行为并向您的 AI 探针返回带有学术分析潜力的极深数据流。
* **抗幻觉的智能排序引擎:** 启发式算法始终站在 Agent 一侧处理搜索回报；在 "IT科学" 类别下它向 LLM 彻底隐藏内容营销和水军分发网，直接输送来自官方技术文档以及核心开源库的最纯粹技术摘要。

> **您在构建 RAG 大模型助理吗？** 强烈推荐您仔细翻阅随付在此官方储存库下的[**AI 整合指南**](AI_INTEGRATION_GUIDE.md)了解关于通信 Payload、HTTP Headers 以及最佳系统级 prompt 指导建议。
>
> 🚀 **即将推出:** searXena 将默认包含在我们的 **mikuBot Dashboard** 正在开发的项目中。这是一个面向大众的个人 AI 助手，同样是开源的，即将推出。

## 🚀 安装与使用 (本地模式)

1. 克隆储存库到您本地目录中：
   ```bash
   git clone https://github.com/NeuralArchLabs/searXena.git
   cd searXena
   ```
2. (可选) 如果您的 Windows 系统屏蔽了脚本运行，在此授权放行：
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
3. 在基础终端内执行自动设置脚本：
   ```powershell
   .\win_setup.ps1
   ```
4. 启动 searXena 引擎：
   ```powershell
   .\run.ps1
   ```
接下来打开您的常用浏览器直接造访 `http://127.0.0.1:8000` 即可。searXena 现在已经为您挡下一切。

## ⚖️ 许可证与法律免责声明

*   **许可证:** 本项目为自由软件，采用 **GNU Affero General Public License v3.0 (AGPL-3.0)** 许可证分发。
*   **引擎鸣谢:** **O-ZEN Engine** 提取引擎是一个 searXena 原生组件，旨在确保用户数据主权和专业 Copyleft 合规。
*   **鸣谢:** 我们郑重向 SearXNG 项目及其隐私标准设计致敬，其架构风格深度启发了 searXena 的实现。
*   **信息来源:** searXena 作为一个公开信号聚合器运行。我们认可并尊重各大外部搜索引擎所提供的巨大索引工作和技术价值。本软件作为可视化及匿名化公共数据的工具提供给最终用户。
*   **教育与研究用途:** searXena 仅供研究和个人使用。开发人员不鼓励也不对使用本工具违反第三方服务条款的行为负责。searXena 提供中立的搜索体验；如果您需要基于跟踪算法的个性化和便捷功能，我们建议您直接使用商业搜索平台。

**法律通知:** searXena 按“原样”分发，不提供任何形式的保证。用户承担因使用本软件而产生的所有法律责任，包括遵守当地法律以及与外部数据提供商的合同。开发人员不对 IP 封锁、第三方法律行动或因使用本代码而产生的任何其他损害负责。
