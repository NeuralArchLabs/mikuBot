## [2.4.0] - 2026-04-29
### Added
- **🧩 Generative Dynamic Widgets Framework**: A new modular architecture for neural micro-apps. Miku can now create, launch, and save custom widgets on demand, providing a truly extensible command center.
- **🧠 Recall Skill (Long-Term Memory Upgrade)**: Significant overhaul of the semantic memory system. Miku now maintains a recursive, deep-directory synaptic structure for efficient cross-session retrieval and persistent context.
- **✨ High-Fidelity Chat Renderer**:
    - **Mermaid Syntax Healing**: Implemented an automated normalization layer for Mermaid diagrams to correct AI-generated syntax errors (specifically for `gitGraph` and flowcharts).
    - **Nested Code Block Integrity**: Fixed rendering regressions for complex nested code blocks within blockquotes and markdown structures.
    - **Atmospheric Visual Polish**: Refined chat bubble `backdrop-blur` effects and transition animations for a smoother interface experience.

## [2.3.2] - 2026-04-19
### Added
- **🎭 Multidimensional Themes System**: Complete overhaul of the application's visual engine. Introduced 5 premium themes: `Miku` (Default), `Cloud` (Atmospheric Light), `Midnight` (Deep Blue), `Cyberpunk` (Neon/Fuchsia), and `Forest` (Emerald/Amber).
- **🛡️ Neural Credential Vault**: Enhanced security with the `processVault` system. API keys are now automatically managed and encrypted at rest, ensuring the "Sovereign Privacy" protocol across all providers.
- **🖼️ High-Performance Atmospheric Backgrounds**: Switched to native `local://` protocol for background image loading, eliminating memory overhead and rendering latency. Added a dynamic background gallery for deep customization.
- **⚡ Proactive Automation Presets**: Integrated 10 high-value automation templates in the Scheduler (Heartbeat, News Radar, Social Pulse, etc.) with localized support for ES, EN, and ZH.
- **💎 Premium UI Fidelity**:
    - Unified blue iconography across the Scheduler and navigation panels.
    - Implemented a "Ghost-like" interaction state for task action buttons (translucent idle, solid hover).
    - Refined TitleBar height (36px) and added deep atmospheric shadows for improved structural depth.
    - Integrated the high-fidelity successful execution "strobe" animation for Neural Skill triggering.
- **🧠 Advanced Agent Logic**:
    - Implemented a universal, depth-aware HTML tag protection system to prevent renderer regressions while maintaining support for complex HTML structures.
    - Standardized system tools classification as "Core Tools" to distinguish them from dynamic Neural Skills.

## [2.3.1] - 2026-04-14
### Added
- **Append-Only Streaming Renderer**: Eliminated chat bubble flickering during LLM streaming. The renderer now uses `insertAdjacentHTML` to append complete paragraphs to the DOM without touching existing content — zero re-renders, zero flicker.
- **Streaming Paragraph Fade-In**: New `stream-paragraph-enter` animation (0.35s ease-out, subtle translateY + opacity) for paragraphs appearing during streaming.
- **Renderer Animation Freeze During Streaming**: All post-streaming animations (blockquote typewriter, code fade-in, dividers, mermaid) are frozen at their first frame while streaming is active. Only the signature scan effect (`global-sig-scan`) keeps running.
- **Ollama Native HTTP Streaming**: Replaced Electron's built-in `fetch` (undici) with Node.js native `http.request` for Ollama streams, eliminating internal buffering that caused the UI to appear hung during slow local inference.
- **Ollama Keep-Alive & IPv4**: Added `keep_alive: 30m` to prevent model unloads between requests, and forced `127.0.0.1` to skip Windows DNS resolution delays.
- **Model Loading Status**: Added `modelLoading` status handling in the stream proxy to gracefully ignore Ollama VRAM loading heartbeats.
- **Markdown Inside HTML Tags**: The formatter now correctly renders markdown headers (`# h1`–`###### h6`) and markdown tables inside HTML container tags (`<div>`, `<section>`, `<article>`, `<aside>`, `<main>`, `<figure>`, `<details>`, `<summary>`).
- **Auto-Centered Images & Iframes**: `<img>` and `<iframe>` tags without explicit alignment attributes are automatically centered in the chat.
- **CSS for Inline Code & Underline**: Added explicit `.markdown-body` styles for `<code>` (indigo background, monospace) and `<u>` (underline with offset) to ensure correct rendering regardless of Tailwind resets.

### Changed
- **Responsive Chat Bubble Alignment**: Chat bubbles now center on small screens (when the sidebar collapses to icon-only mode) and use natural left/right alignment on large screens, maximizing content width at all resolutions.
- **Streaming Buffer Strategy**: Switched from token-level flushing (200ms) to paragraph-level flushing with a 1.5s safety timeout, dramatically reducing DOM updates during streaming.

### Fixed
- **Streaming Flicker**: Resolved persistent chat bubble flickering caused by `dangerouslySetInnerHTML` replacing the entire DOM on every chunk update.
- **Signature Animation Override**: Fixed a CSS cascade conflict where a later `.markdown-body.is-streaming` rule was overriding the `global-sig-scan` signature animation.
- **Premature Signature Reveal**: Removed a `useEffect` that was adding `is-visible` to signature wrappers during streaming, which caused post-streaming animations to skip.
- **Typewriter Speed**: Restored original adaptive typewriter speeds (3500–12000ms, 1/2/4 chars/tick) that were incorrectly accelerated in a prior session.

## [2.3.0] - 2026-04-10
### Added
- **Persistent Background Agents**: Enabled true multi-session execution. Miku now runs complex agent tasks autonomously in the background natively. Switching to another neural branch preserves the task state, showing real-time background status indicators.
- **Dynamic Neural Prompt Injection**: Engineered a zero-duplication injection pipeline for system instructions and reinforcements, maximizing context window alignment on models like Gemini 1.5 and Groq.
- **Deep System Protection**: Implemented hardcoded execution barriers. Attempts to modify `SOUL.md`, `USER.md`, or `IDENTITY.md` will universally trigger a manual user confirmation prompt, overriding automatic agent approvals.
- **Unified Translation Core (Slash Commands)**: Fully localized the internal Command Editor (`/mode`, `/status`, `/new`, etc.) and native Telegram interactive dashboards to EN, ES, and ZH.

### Changed
- **Breaking Change (`MODES.md` Structure)**: Dramatically overhauled the main logic directives inside `MODES.md`. Users upgrading to v2.3.0 MUST copy the new baseline configuration from the official repository and replace their local file to maintain agent accuracy. Legacy Factory resets are NOT required.

## [2.2.1] - 2026-04-07
### Added
- **Studio Elite Markdown Engine**: A complete overhaul of the rendering pipeline.
    - **Advanced LaTeX Math Engine**: Professional-grade, high-performance renderer supporting complex multiline formulas ($$), inline math ($), matrices, binomials, and physics constants. Essential for technical documentation and scientific research.
    - **Intelligent Mermaid Diagrams**: Native visualization for `mermaid`, `flowchart`, `gitGraph`, `mindmap`, and `erDiagram`. Eliminates the need for external tools by rendering architecture and logic directly within the chat.
    - **Obsidian-Style Command Callouts**: Robust support for `> [!TYPE]` (collapsible/expanded) with 14+ reactive styles. Perfect for organizing multi-step instructions, logs, and structured knowledge.
    - **Studio Spoiler & Privacy Filter**: Premium glassmorphic blur for `||spoiler||` content that reveals on interaction. Ideal for hiding sensitive data or API keys during shared sessions.
    - **Kinetic Emoji & Typography**: Organic animation engine for the neural signature and emojis, where every symbol follows a unique pattern (bounce, pulse, shimmer) to provide visual feedback and a "living" response feel.
    - **Technical Footnote Orchestration**: Advanced support for `[^1]` markers and interactive definition blocks, ensuring publication-quality referencing for long-form analysis.
- **Asset Protection Pipeline (3-Phase)**: Overhauled structural normalization that prevents images, links, and nested code blocks from corruption. Guarantees 100% reliability for complex technical content.
- **Neural Streaming Synchronization**: Fully synchronized progressive text reveal for callouts and blockquotes, ensuring the UI evolves in real-time with the assistant's internal reasoning.
### Changed
- **Optimized Build Configuration**: Refined Rollup chunking strategy to isolate the heavy `mermaid` dependency and FontAwesome icons, significantly reducing the primary vendor bundle size.
- **Circular Dependency Fix**: Consolidated framework-related chunks into the vendor bundle to eliminate circular references between React and architectural libraries.

### Fixed
- **Version Synchronization**: Ensured version parity (`2.2.1`) across `package.json`, internal configuration constants, and localized documentation (READMEs).

## [2.1.6] - 2026-04-04
### Fixed
- **UTF-8 Encoding Restoration**: Successfully repaired corrupted accented characters (á, é, í, ó, ú, ñ) in `es.json` caused by previous tool interactions. All Spanish text now renders correctly with proper encoding.
- **System Dialog Localization**: Fully migrated all hardcoded strings in backup, restore, factory reset, and voice download dialogs to the i18n layer. All alerts now respect the active system language.
- **UI Icon Stabilization**: Removed broken diagnostic symbols (diamond-question marks) from dialog titles. Implemented a robust emoji-based detection system in `SystemDialog` to trigger matching status colors (Red/Success/Warning).
- **Architectural Nomenclature Preservation**: Reverted accidental translations of core directory headers. Routes now correctly display as `WorkSpace`, `Core`, `Library`, and `Commands` to maintain technical nomenclature while keeping descriptions in the user's language.

### Added
- **Diagnostic Emoji Logic**: Added support for standard status emojis (✅, 🔴, ⚠️, ♻️) as triggers for automated dialog skinning, ensuring a "High-Tech" reactive aesthetic without manual icon overrides.
- **Enhanced Restore Warnings**: Updated the restoration confirmation with explicit, localized warnings about irreversible data overwrites.


## [2.1.5] - 2026-04-02
### Added
- **Full UI Localization**: Refactored `TitleBar` and `AboutDialog` to use `i18next`, ensuring 100% language parity across the core interface in English, Spanish, and Chinese.
- **Dynamic Identity Integration**: Integrated configured `userName` and `assistantAlias` directly into chat role labels, replacing static translations with dynamic, personality-driven identity.
- **Iconography Consistency**: Migrated manual unicode symbols and text-based markers to the unified `Icon` component across the `ChatArea` and `AgentStatusPanel`.

### Changed
- **"Zero-Border" Aesthetic**: Implemented a minimalist, high-density design for chat bubbles and input controls. Borders are now hidden by default (`border-transparent`) and only reveal on `hover` to create a reactive, clutter-free experience.
- **Asymmetric Dialogue Bubbles**: Refined chat bubble geometry with sharp external corners to simulate a character dialogue tail, improving visual storytelling.
- **Compact Control Layout**: Optimized the spatial footprint and alignment of mode toggle buttons (Auto, Safe, Debug) with a standardized height (`h-6`) and robust centering logic.
- **Input Area Refinement**: Restored a subtle persistent border specifically for the main textarea to provide a clear interaction target while maintaining the overall minimalist look.

### Fixed
- **Internationalization Gaps**: Resolved missing translation keys in the `About` and `TitleBar` components and standardized the `close` action across all locales.


## [2.1.4] - 2026-03-31
### Added
- **Multilingual Auto-Ticking Engine**: Expanded `toolSynonyms` in `src/services/core/agent/chat.ts` to support English, Spanish, and Chinese verbs (e.g., `读取`, `写`, `运行`). This allows the agent to maintain high-accuracy progress tracking regardless of its persona's language.
- **Normalization Helper**: Introduced `normalizeForMatch` to strip path prefixes (`@WORKSPACE/`, etc.) and extensions during task matching, significantly improving tick reliability across multi-root environments.

### Changed
- **Unified Core Documentation**: Fully localized `MODES.md`, `TOOLS.md`, and `TOOL_USAGE_LIBRARY.md` into English as the primary operational standard for optimized LLM reasoning.
- **Synchronized Prompt Logic**: Refactored `App.tsx` and `agent.ts` to use unified English tags (e.g., `[AGENT_STATE]`, `[CURRENT_WORK_PLAN]`, `[OPERATION_FOCUS]`) and translated internal loop feedback messages.
- **Refined Task Matching**: Fixed a "short-argument" bug where commands like `ls` or `npm` were ignored. The system now supports variable-length arguments for auto-ticking.

### Fixed
- **Prefix Collision**: Resolved an issue where absolute/prefixed paths in tool calls failed to match relative task descriptions in `tasks.md`.

## [2.1.2] - 2026-03-29
### Fixed
- **batch_operation Zero Leak Enforcement**: Applied `SafePathResolver.resolvePath()` to destination parameter in `handleBatchOperation`. This ensures destination paths are validated against the Zero Leak sandbox, preventing unauthorized file operations outside configured workspace directories.

## [2.1.1] - 2026-03-29
### Fixed
- **batch_operation Path Duplication (Frontend)**: Fixed duplicated directory paths in `batch_operation` tool. The frontend now builds absolute paths consistent with `patch_file` and `read_file` tools instead of using relative paths.
- **batch_operation Absolute Path Handling (Backend)**: Updated `handleBatchOperation` in `agentActions.cjs` to properly detect and handle absolute paths in destination parameter. Previously assumed all paths were relative from root, causing errors when frontend passed absolute paths.

## [2.1.0] - 2026-03-29
### Fixed
- **Backup System Path Normalization**: Fixed duplicated backslashes in PowerShell `Compress-Archive` command. Changed from `'${currentWorkspacePath}\\*'` to `'${currentWorkspacePath}/*'` using forward slashes for cross-platform compatibility, preventing compression failures on Windows.
- **Backup File Validation**: Added validation before import operations to verify that the selected file exists and is readable. Prevents confusing errors when users attempt to import invalid files.
- **Backup Confirmation Enhancement**: Updated import confirmation dialog with detailed warnings about what files will be overwritten and the use of `-Force` flag in PowerShell, improving user awareness of the operation's impact.
- **MASTER_RELEASE_MANIFEST Compliance**: Completed comprehensive audit of all changes specified in MASTER_RELEASE_MANIFEST v2.1.0. All 4 Sprints fully implemented with 100% completion rate for Sprint 1, 2, 3 and 4.

### Verified
- **PowerShell Modules**: Confirmed that both `Compress-Archive` and `Expand-Archive` commands are available (Microsoft.PowerShell.Archive 1.0.1.0).
- **All Security Features**: SafePathResolver, timeout hybrid console, and SafeStorage encryption all verified as functioning correctly.

## [2.0.0] - 2026-03-25
### Added
- **Temporal Awareness**: Injected formatted timestamps (`[DD/MM HH:mm]`) into user message history for the AI agent, providing session-long temporal context.
- **UI Metadata Refinement**: Implemented external timestamps for chat bubbles (not part of content) and displayed them in the raw neural logs viewer.
- **Enhanced Scrollbars**: Increased scrollbar width and added active/hover states for better accessibility on desktop environments.
- **Improved Auto-scroll**: Optimized the chat container to follow streaming output more reliably while respecting user manual scrolling.

### Fixed
- **Tool Execution Indicators**: Restored the original rotating gear (`cog`) as the tool execution block's activity indicator, ensuring consistent visual feedback.
- **Clock Volatility**: Fixed the "running clock" effect in the tool execution summary by capturing and locking individual start/end timestamps.

## [1.9.9] - 2026-03-25
### Changed
- **Native searXena API Integration**: Refactored the `run-search` and `run-extract` IPC handlers to communicate directly with the searXena FastAPI server (port 8000) via Node.js `http`. This eliminates dependencies on broken Python bridge scripts (`search.py`, `extract.py`) and missing libraries (`requests`, `trafilatura`).
- **Multi-byte Character Support**: Optimized API requests to use `Buffer.byteLength` for `Content-Length` headers, ensuring stable searches for queries containing accents (e.g., "San Andrés"), emojis, or special characters.
- **Robust Engine Detection**: Updated `searxena:status` to prioritize active port checks over file-system presence, enabling seamless linking with manually started engine instances.

### Fixed
- **Engine Environment Recovery**: Restored the missing Python virtual environment (`local/py3`) in the `engine/searxena` directory to fix UI status detection and auto-start capabilities.
- **Extraction Logic Migration**: Successfully migrated the `read_url` tool to use searXena's native **O-ZEN Engine** extraction endpoint, replacing the deprecated external trafilatura bridge.

## [1.9.8] - 2026-03-24
### Fixed
- **Session Corruption during Crashes**: Integrated `fsyncSync` into `safeWriteJSON` to ensure data is physically written to the disk platter, preventing 0-byte files during OS/hardware interruptions.
- **Corrupted Session Auto-Cleanup**: Enhanced `get-sessions` to proactively identify and remove 0-byte or unreadable session files from disk, maintaining UI integrity.
- **Atomic Persistence Reliability**: Refactored the file-saving bridge to use native file descriptors for guaranteed write completion.

### Changed
- **Version Bump**: Global application "version": "2.1.6", updated.

## [1.9.7] - 2026-03-24
### Added
- **Rapid Document Creation (+)**: Integrated a '+' button in the Context Library header that creates a new documented and immediately opens the Library Manager in edit mode.
- **Deep-Linking Library Editor**: Added a new edit request state to enable seamless transitions from the sidebar to the full-screen library editor.

### Changed
- **Vertical Sidebar Breakpoint**: Implemented a responsive vertical collapse for sidebar sections when viewport height is below 650px. Sections now transform into compact, interactive tabs.
- **Asymmetric Gradient Aesthetics**: Refined section separators and primary borders with non-linear gradients for a more professional neural look.
- **Unified Indigo Accents**: Standardized library hover states to Indigo-400 for structural visual consistency.

### Fixed
- **Library Overflow**: Resolved layout breakage in the Context Library when viewing long file lists in small viewports.

## [1.9.6] - 2026-03-17
### Fixed
- **Ollama/Gemini Restoration (POO Core)**: Fully restored streaming and tool performance for non-SSE providers (Ollama) and cumulative providers (Gemini), reverting regressions from recent Z.AI optimizations.
- **Gemma 3 Compatibility**: Re-implemented specialized history serialization and system-prompt injection for Gemma models which do not support native instructions or function calling via the Gemini API.
- **Double Answer Suppression**: Added an intelligent filter in the agent loop to hide redundant narrative thought blocks when they match the final authoritative answer, preventing UI duplication.
- **Thematic Break Scaling**: Enhanced `answerFormatter.ts` to ensure markdown horizontal rules (`---`) render correctly by enforcing proper spacing.
- **Gemma Loop Integrity**: Fixed a crash where Gemma models would attempt to send native tool history, causing API errors (HTTP 400).
- **Streaming Speed**: Optimized the internal delta-to-UI update loop to batch changes, restoring "instant" response feel for high-speed models like Gemma 3.

## [2.1.0] - 2026-03-16
### Added
- **Session Manager Header Controls**: Integrated "Import" and "New Session" buttons directly into the Session Manager modal header for rapid access.
- **Inline Library Renaming**: Enabled direct file renaming within the Context Library sidebar with automatic extension preservation and UI sync.
- **Action Button Persistence**: Implemented a "Smart Hover" system where active library items show controls persistently, while others reveal them on hover.

### Changed
- **Sidebar Visual Alignment**: Synchronized "Context Library" and "Neural Sessions" headers with matching paddings, typography (`tracking-widest`), and gradient separators.
- **Vertical Density Optimization**: Reduced vertical padding and margins across sidebar headers to maximize information density without sacrificing clarity.
- **Header Indentation**: Specially aligned the Library title with the item status indicators (dots) for a cleaner vertical scan line.
- **Redundancy Cleanup**: Removed the duplicated delete button from the document viewer header in Library Manager.

### Fixed
- **Modal vs Sidebar Collision**: Resolved a layout conflict where sidebar expansion logic was interfering with the fixed-width Session Manager modal. Reverted Modal to a stable Flexbox structure.

## [2.0.0] - 2026-03-14
### Added
- **Real-Time Task Sync (UI Priority)**: Implemented sequential task ticking in `TASKS.md` at the end of every turn to enable fluid UI progress animations.
- **Universal Tool Detection**: Expanded task-matching logic to recognize all available skills, including `web_research`, `miku_clock`, and `get_system_metrics`.
- **Spanish Intent Recognition**: Added a comprehensive dictionary of Spanish synonyms for tools, allowing the agent to plan in natural language while maintaining automated tracking.
- **Pre-Deletion Sincronization**: System now performs a "pre-tick" of all pending tasks (including the deletion itself) before `TASKS.md` is removed, ensuring the user sees the final progress checks.
- **Agent Awareness Block**: Injected a direct instruction into the agent's status block confirming that `[PLAN_DE_TRABAJO_ACTUAL]` is an exact reflection of the disk file, eliminating redundant `read_file` calls.

### Changed
- **Robust `patch_file` Engine**: Introduced `flexibleIncludes` to the patching logic, making it resilient to minor variations in search patterns (whitespace, quotes, backticks).
- **Silent Sincronization Feedback**: When the agent manually tries to mark a task already checked by the system, it now receives a "Synchronized" confirmation instead of an error, preventing confusion loops.

### Fixed
- **Loop Syntax Integrity**: Resolved a critical bracket mismatch in `src/services/core/agent.ts` that caused the application to crash during turn transitions.


## [1.9.5] - 2026-03-12
### Added
- **Automated searXena Setup**: The engine now handles its own Python environment creation. If `py3` is missing, it automatically creates a venv, upgrades core tools (`pip`, `wheel`, `setuptools`), and installs dependencies from `requirements.txt`.
- **Orphan Process Prevention**: Implemented a multi-layered shutdown protocol (`before-quit`, `will-quit`, `process exit`). Added a synchronous `stopSearXenaSync` to ensure the engine is killed before the app terminates.
- **PS Fallback Cleanup**: Refined the PowerShell process cleanup to safely ignore system processes (PID < 10), avoiding "critical process" errors on exit.
- **Background Engine Execution**: Added `windowsHide: true` to the engine spawn, ensuring the search core runs invisibly without popping up console windows.

### Changed
- **Branding Cleanup**: Removed "Powered by searXena" text from the title bar and settings header for a cleaner, unified UI.

## [1.9.3] - 2026-03-11
### Added
- **Native Search Engine Integration (searXena)**: Completely replaced SearXNG with our own native search engine **searXena**. This engine runs as a native core in Windows via a dedicated Python environment, providing structured API access (`/api/v1/search`) with POST support.
- **Improved Tool Schema**: searXena provides standardized JSON outputs optimized for AI tool calling, reducing parsing latency and improving search accuracy.

### Removed
- **SearXNG**: Fully decoupled and removed SearXNG from the codebase, including its engine directory and management logic.

## [1.9.2] - 2026-03-05
### Changed
- **Local Search Engine Integration**: Migrated the `web_research` and `deep_research` neural skills from the external `duckduckgo_search` python library to the internal, locally hosted **SearXNG** engine. This ensures completely private, self-hosted, and stable search capabilities for the agent without API rate limits.
- **SearXNG Engine Stability**: Patched the local engine boot sequence to dynamically inject the required `SEARXNG_SECRET` on startup, preventing "fatal 10106" boot blocking errors.

## [1.9.1] - 2026-02-23
### Added
- **Semantic Scheduler Messaging**: 
    - Integrated "Orange" (prompt) and "Indigo" (response) visual cues for scheduled activities.
    - Automated task messages are now centered and initially collapsed to maintain focus.
    - Dynamic Error Reporting: Failures in background tasks are now explicitly notified in the UI.
- **Neural Skills Caching**: Implemented a 30s hardware-aware cache for dynamic tool discovery in `App.tsx`, significantly reducing disk I/O latency.

### Changed
- **Agent Autonomy (Chat Mode)**: Refined `MODES.md` instructions to mandate tool usage over hallucinations for environmental queries.
- **Streamlined UI Logic**: Removed redundant summary messages from the scheduler to ensure a snappy, lag-free experience after task execution.

### Fixed
- **Collapsible Button Alignment**: Corrected the positioning of collapse/expand buttons for system and centered messages.

## [1.9.0] - 2026-02-23
### Added
- **Neural Scheduler (Core Engine)**: Introduced a robust scheduling system for automated agent tasks. Supports `interval`, `cron` (with custom parser), and `one-time` execution modes.
- **Dynamic Task Queueing**: Implemented an intelligent task manager that executes scheduled prompts only when the user is inactive to avoid context interference.
- **Premium Scheduler UI**: A dedicated management tab within the Control Room to create, edit, monitor, and debug scheduled tasks with real-time status updates.
- **Scheduled Presets**: Added high-value templates like "Morning Briefing", "Periodic Check-in", and "Evening Journal" for instant automation.
- **Execution History (Logs)**: Comprehensive logging system for scheduled tasks, recording status, response time, and detailed agent output.
- **Cinematic Transitions**: Added `panel-fade-in` and `clock-pulse-spin` animations using CSS bezier curves and blur filters for a state-of-the- art visual experience.

### Changed
- **Header Redesign**: Merged the scheduler access into the primary action group (next to Load/Export) with a premium cyan-to-teal gradient button, maximizing space efficiency and visual balance.
- **Decoupled Persistence**: Refactored the storage layer to strictly prioritize Electron JSON files (`scheduler-tasks.json`, `scheduler-logs.json`) over localStorage in desktop environments, ensuring zero "stale cache" issues.
- **Integrated Navigation**: Replaced the separate tab bar with a sleek, context-aware "Back" system within the scheduler panel.

### Fixed
- **Input Accessibility**: Resolved lint warnings by adding proper `title` attributes to all form elements in the scheduler tab.
- **Layout Collisions**: Fixed a "crowding" issue in the Settings panel by restoring proper vertical spacing (`space-y-10`) within the new animation wrappers.

## [1.8.0] - 2026-02-23
### Added
- **Dynamic Port Migration**: Project moved from port `3000` to `3001` to prevent conflicts with other development servers (specifically **Next.js**), enabling multi-app development workflows.
- **Instruction Mode State**: Introduced `isInstructionMode` in `AgentStatus` for granular UI control over the "Halo" (rainbow aura) effect on the stop button.

### Changed
- **Cyan-to-Purple Neural Aura**: Replaced the full rainbow aura with a cleaner, cooler-toned gradient (cyan/blue/purple) to align with the system's core identity.
- **Selective UX Transitions**:
    - **Fast Response**: Accelerated entry to agent mode (1.2s durations, tighter scale) for snappier feedback.
    - **Legacy Expansive**: Maintained original dramatic expansion (2.5s duration, 3.5x scale) when returning to chat mode.
- **Mechanical Stop Animation**: Refined the stop button spin to a manual/mechanical feel (2.2s duration, `cubic-bezier(0.85, 0, 0.15, 1)`), providing clear visual feedback of acceleration and braking.
- **UI Architecture Polish**:
    - **Delimited Labels**: Wrapped the "Mode:" indicator in a small aesthetic box to improve delimitation and visual structure.
    - **Status Icon Deduplication**: Refined the summary displays — changed "Safe" emoji to `💠` to avoid redundancy with the primary intervention button's shield.
- **Animation Refresh Logic**: Added a keyed render pattern to the stop icon, forcing a complete animation restart on every process lifecycle change to avoid frame skips.

### Fixed
- **Halo Trigger Reliability**: Resolved an issue where the rainbow aura wouldn't reliably appear during certain agent executions by tying it directly to the new `isInstructionMode` state.

## [1.7.0] - 2026-02-22
### Added
- **Selective Skill Toggles**: Each Neural Skill now has an inline switch to enable/disable its injection into the agent's toolset. Disabled skills are excluded from both tool definitions and system prompt configuration blocks.
- **Cinematic Session Transitions**: The "TV On" entrance animation now re-triggers when switching between sessions, creating an immersive channel-switching experience.
- **Bottom-Aligned Chat**: Messages now grow from bottom to top using a flex spacer, keeping user attention near the input area (modern messaging app pattern).
- **`disabledSkills`**: New persistent config field (`string[]`) to store which skills the user has toggled off.

### Changed
- **Visual Typography Balance (Skills Panel)**: Reduced font weight across the entire Neural Skills panel — headers, cards, tabs, labels, and buttons — from `font-black` to `font-semibold`/`font-bold` for a cleaner, more balanced visual hierarchy.
- **Chat Animation Isolation**: The "TV On" effect now only applies to the message history area; the prompt bar remains static and immediately usable.
- **Animation Cleanup**: Removed `filter: brightness()` from `chat-reveal-kf` and `control-room-enter` keyframes to eliminate visual flashes during transitions.
- **No Auto-Select in Skills**: Neural Skills panel no longer auto-selects the first skill on load — shows "Neural Standby" by default.

### Fixed
- **System Prompt Leak**: Disabled skill configurations were still being injected into the system prompt. Now `buildSkillsConfigBlock` filters out disabled skills.
- **Tab Transition Flash**: Eliminated the visual "flash" caused by background/blur styles being re-applied during tab transitions via a persistent UI shell.

## [1.5.1] - 2026-02-21
### Added
- **Native Explorer Integration**: Añadidos iconos de acceso directo ("External Link") en las tarjetas de carpeta para apertura rápida.
- **Architectural Refinement**: Consolidación de lógica en `services/` y `App.tsx`, optimizando la carpeta `hooks/`.

### Fixed
- **Config Import Fix**: Corregido bug crítico donde la importación de JSON no persistía inmediatamente en disco ni sincronizaba las carpetas en tiempo real. Ahora la importación es atómica y persistente.
- **Path Protocol**: Mejora en la interpretación de rutas absolutas de Windows en modo producción (`isPackaged`).

## [1.5.0] - 2026-02-20
### Added
- **Single Source of Truth**: Migración completa a `config.json` como base de datos de configuración única para Electron.
- **Native IPC Persistencia**: Implementación de handlers robustos para carga/salvado de estado neural.
- **UI Redesign**: Reposicionamiento de los botones de apertura de carpeta a la esquina superior derecha con nuevos iconos.
- **Master Path Enforcement**:
    - Las operaciones de sistema de archivos (Sync, Save, Delete) ahora priorizan las rutas configuradas en `config.json` sobre los handles temporales de IndexedDB cuando se ejecuta en modo escritorio. Esto garantiza que la estructura del Workspace se mantenga íntegra tras reinicios de la aplicación sin requerir re-autorizaciones manuales de carpetas.
- **Configuración Auto-Sanable (Self-Healing)**:
    - Implementación de un motor de recuperación de configuración. Si el sistema detecta la ausencia de `config.json` (borrado accidental o primer arranque), genera automáticamente una configuración base con presets de seguridad.
- **Neural Component Refactoring**:
    - Reestructuración masiva de `App.tsx` para eliminar la anidación excesiva de funciones de ciclo de vida (hooks), resolviendo bugs de "Race Conditions" durante el arranque del motor de inferencia.
    - Consolidación de `restoreHandlers` para una reconexión inmediata a los subsistemas neurales al inicio.

### Fixed
- **Native Explorer Integration**:
    - Corregida la lógica de rutas: ahora se pasan rutas absolutas del motor neural al shell nativo.
    - Se ha migrado a llamadas IPC directas (`invoke`) para garantizar la compatibilidad en modo desarrollo.

## [1.4.2] - 2026-02-20

### 🚀 Instalación y Onboarding Guiado (First Run)
- **Onboarding Wizard Integration**: 
    - Implementación de un asistente visual "First Run" de 3 pasos para primera configuración.
    - Creación y selección automática de las carpetas internas de la arquitectura (core, commands, workspace, library) en el equipo huésped (Ej. `C:\Users\...\mikuCentral`).
    - Recopilación inicial de Claves API (Gemini, Groq) y URL Local (Ollama) desde la primera pantalla.
    - **IPC Auto-Sync & Fallback**: MikuCentral ahora sincroniza las carpetas automáticamente usando procesos nativos del File System de Node.js (via IPC) si detecta que está corriendo dentro de Electron. Esto elimina por completo los pop-ups de permisos manuales de la Web File System Access API de navegadores durante el despliegue nativo.
- **Smart NSIS Installer**:
    - Abandono del instalador fantasma (`oneClick: true`); se pasa a un Instalador Nativo Interactivo (`nsis`) que permite seleccionar ruta y atajos de escritorio.
    - Script Nativo de Setup (`installer.nsh`) con requerimientos de sistema. Detecta el entorno e instala dependencias críticas y recomendadas automáticamente bajo demanda:
        - Requisito Crítico Estructural: Instalación silenciosa de `Microsoft Visual C++ Redistributable 2015-2022 (x64)`.
        - Dependencias de Motor Recomendadas: `Ollama` y `Git for Windows`.

## [1.4.1] - 2026-02-20

### 🖥️ Native OS Integration & Production Build
- **Application Menus Natives (MacOS/Windows)**:
    - Reemplazo completo del menú estándar de Electron por opciones de herramientas específicas de **MikuCentral** (Nueva Sesión, Cargar/Exportar Configuración).
    - Menú dinámico transversal: Aislado canal bidireccional entre eventos IPC y React State.
    - Opciones exclusivas bajo `Neural Engine`: `Sync Models (Ctrl+R)` y `Reset Global Config`.
- **Electron Build Fixes**:
    - Ajuste de iconos y configuración del empaquetador para heredar la iconografía en dependencias `.exe` compiladas por NSIS.
    - Definición robusta de motores (`app.isPackaged` y `resourcesPath`) evitando la pérdida de la ejecución Python externa tras el Build de ASAR.

## [1.4.0] - 2026-02-20

### 🛡️ Neural Security & File Management
- **Implementación de File Deletion**:
    - **Capa de Seguridad Multinivel**: Introducción de un flujo de borrado irreversible con confirmación obligatoria en Library Manager, Cortex y Command Editor.
    - **Risk Disclaimers**: Las áreas críticas (Cortex y Commands) ahora presentan un aviso de riesgo técnico previo a la confirmación final para prevenir pérdida de datos del sistema.
    - **Borrado Físico Real**: Integración directa con el File System Access API para eliminar entradas del disco y sincronizar el estado reactivo inmediatamente.
- **Rediseño del Secure Credential Vault**:
    - **Arquitectura de Tres Secciones**: El panel de configuración se ha reestructurado visualmente para elevar la seguridad a una sección primaria propia, separándola de la orquestación de modelos.
    - **Identidad Visual Ámbar**: Nueva iconografía (`shield-alt`) y separadores de gradiente premium para enfatizar el área de bóveda de credenciales y protocolo de Telegram.

## [1.3.1] - 2026-02-20

### 🚀 Optimización de Rendimiento & Auditoría
- **Memoización de Componentes Core**: Se implementó `React.memo` en componentes clave de alto nivel (como `SessionList` y relacionados) para evitar re-renderizados innecesarios del DOM cuando el estado global cambia, mejorando la fluidez neta de la aplicación sin alterar su comportamiento visual o funcional.
- **Auditoría UI/UX Responsiva**: Resolución de problemas de visualización en distintas relaciones de aspecto. Los botones de `SettingsPanel` ahora tienen fuentes e iconografía dinámicas (`md:`, `lg:`, `xl:`) garantizando que los textos no colisionen ni se trunquen en vistas de 4 columnas, y aprovechando el espacio horizontal en móviles.

### 🎨 Dialogs Inteligentes y Conciencia Espacial
- **Notificaciones Flexibles**: El motor del `SystemDialog` (alertas personalizadas) advierte desde qué lado de la pantalla fue disparada la acción y ajusta su animación de entrada y acople final basándose en ello (derecha para guardados, izquierda para eliminaciones).
- **Control de Resoluciones (`@media`)**: Comportamiento adaptativo real. En pantallas grandes (`1280px`+) las alertas obedecerán su conciencia lateral. En pantallas más reducidas y móviles, priorizarán siempre centrarse para no desbordar el viewport del usuario.

## [1.3.0] - 2026-02-19

### 🎨 Ultra UI Polish & Cinematic Experience
- **Sistema de Animaciones "Genie" (Style macOS)**:
    - Implementación de transiciones de expansión y contracción elásticas para los modales de Sesiones y Biblioteca de Contexto.
    - Orígenes dinámicos: Las sesiones emergen desde el lateral izquierdo (25% superior) y la biblioteca desde la parte inferior, optimizando la jerarquía visual.
    - Aceleración por GPU (`will-change`) para asegurar 60fps constantes durante las transiciones.
- **Transiciones de Pestañas Suaves**:
    - **Cortex & Command Editors**: Nueva animación de deslizamiento lateral lento (0.6s) que aporta elegancia al navegar entre códigos.
    - **Neural Chat**: Efecto de revelado gradual desde el fondo para una transición inmersiva.
    - **Control Room**: Animación de oscurecimiento y escalado sutil para enfatizar la profundidad del panel de configuración.
- **Easter Egg: Neural Signature**: Nueva interacción cinemática al hacer clic en el logo de mikuBot que revela la firma dinámica del agente (`{{🧠≈̼^.┬.̼^≈‿⟆✨}}`) con una secuencia de "succión" y reversión simétrica.

### 🛠️ Mejoras de Navegación y Estructura
- **Deep Session Modal**: El visualizador de sesiones ahora es un modal centralizado inmersivo con backdrop-blur, permitiendo una gestión mucho más cómoda que en la barra lateral estrecha.
- **Slim Mode (Context Library)**: Nuevo icono de "Libro" en la barra lateral contraída (slim) para acceso instantáneo a la biblioteca en resoluciones mínimas.
- **Resolución Crítica Optimizada**: Ajuste del ancho mínimo de la aplicación a **640px** (breakpoint SM estándar), asegurando que todos los elementos se vean perfectos sin amontonarse.
- **Renombrado Estratégico**: Cambio de "Library Context" a **Context Library** para una mejor semántica en el flujo de trabajo.

### 🐛 Bug Fixes
- **Z-Index Layering**: Reparación de colisiones visuales entre modales y banners de conexión pendientes. Los modales ahora se sitúan siempre por encima de cualquier otro elemento del sistema.
- **Dynamic New Doc Button**: El botón de "New Document" ahora detecta el ancho de pantalla y se contrae a "New Doc" para evitar solapamientos en ventanas pequeñas.


## [1.2.0] - 2026-02-18

### ✨ Mejoras en el Contexto del Agente
- **Memoria de Corto Plazo Activa**: El agente ahora mantiene los últimos 3 turnos (6 mensajes) del chat en modo Instrucción/Agente. Esto permite una mayor continuidad en tareas complejas sin degradar el rendimiento por saturación de contexto.
- **Filtro de Comandos**: Se eliminan del historial de contexto los logs técnicos de ejecución de comandos para mantener la ventana de contexto limpia y enfocada en la conversación.

### 📱 Optimización para Telegram y Remoto
- **Telegram HTML Formatter**: Implementación de un nuevo motor de formateo específico para Telegram (`telegramFormatter.ts`).
    - Conversión automática de Markdown a HTML compatible con Telegram.
    - Soporte para encabezados, negritas, cursivas y bloques de código.
    - Escapado de caracteres especiales para evitar fallos en la entrega de mensajes.
- **Preservación de Estructura**: Mejoras en el manejo de saltos de línea dobles para asegurar que Telegram respete la separación de párrafos y listas.

### 🛠️ Estabilidad y Refactorización
- **Answer Formatting Utility**: Creación de `answerFormatter.ts` para capturar y limpiar artefactos de los modelos locales (secuencias `\n` mal escapadas, comillas redundantes, etc.) en el dashboard principal.
- **Limpieza de Proyecto (Git Hygiene)**: Configuración avanzada de `.gitignore` para excluir automáticamente archivos de caché de Python y limpieza del índice del repositorio para eliminar archivos compilados preexistentes.
- **Normalización de Saltos de Línea**: Soporte nativo para saltos de línea Windows/Unix en todas las respuestas del agente.


## [1.1.0] - 2026-02-15

### ✨ Características Principales
- **Sistema de Identidad & Idioma (MikuBot Protocol)**: 
    - Implementación de inyección persistente de `IDENTITY.md` en el prompt del sistema.
    - Protocolo de idioma español obligatorio para todos los reportes y razonamientos internos.
    - Personalidad proactiva y amigable (mikuBot) integrada estructuralmente.
- **Visualización de Razonamiento Premium**:
    - Introducción de bloques semánticos `'thought'` (pensamientos) y `'answer'` (respuestas finales).
    - Intercalado cronológico de razonamiento y acciones para una narrativa de flujo neural.
    - "Debug Mode" en la interfaz para alternar la visibilidad de los procesos técnicos internos.
    - Limpieza agresiva de ruidos técnicos (JSON shards, firmas, frases repetitivas).

### 🚀 Mejoras en el Motor de Agente
- **Sincronización de Workspace en Tiempo Real**:
    - Implementación de "Proxy Stores" locales en el bucle del agente.
    - El agente ahora puede ver, leer y modificar archivos creados en el mismo turno de pensamiento sin errores de "Archivo no encontrado".
- **Extractor de Narrativa Avanzado**:
    - Mejora en la recuperación de llamadas a herramientas desde texto plano.
    - Normalización de parámetros complejos (arrays de fuentes) para evitar duplicación visual.
    - Sistema de "Dynamic Recovery" que inyecta manuales de herramientas desde `TOOLS.md` cuando se detectan fallos de sintaxis.

### 🛠️ Correcciones y Estética
- **Zero-Hallucination Policy**: Eliminación de ejemplos estáticos engañosos en los protocolos para evitar que el agente cite fuentes ficticias.
- **Corrección de Colapsables**: Mejora en el componente `CollapsibleTextBlock` para manejar correctamente el estado de los pensamientos antiguos.
- **Nudge de Protocolo**: Refactorización de los avisos de "Protocolo Incompleto" para ser menos intrusivos y más técnicos.

---

## [1.0.0] - 2026-02-13
- Versión inicial del sistema mikuCentral con soporte para múltiples proveedores (Ollama, Groq, Gemini).
- Estructura básica de herramientas de archivos y consola.
- Interfaz basada en React + Vite con estética cibernética.
