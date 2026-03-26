# 🟢 MikuCentral Project Status (v2.1.1)
**Last Update:** 2026-03-25 | **Status:** Stable / Enhanced Awareness

## 🏗️ Core Architecture
MikuCentral is a hybrid AI interface combining a **Vite/React** frontend with an **Electron** backend.
- **Backend (`electron/`)**: Manages the native bridge, system metrics, and deep filesystem access via `agentActions.cjs`.
- **Frontend (`src/`)**: Orchestrates the agentic loops, LLM request streaming, and UI components.
- **Data Persistence**: Uses a combination of indexedDB (via `persistence.ts`) and direct disk writing for session logs and settings.

## 🤖 Agentic Toolchain
The system implements a robust, multi-stage tool execution engine.
- **`read_file`**: Prioritizes native disk reading for reliability. 
- **`update_file` / `patch_file`**: Native atomic writes with automatic directory creation and `.bak` backup generation.
- **`list_files` / `search_files`**: Fully native implementations using Electron's `fs` for real-time disk exploration (independent of memory store). 
  - *Fix:* Strips `.` and `./` prefixes to provide accurate matching against relative workspace paths.
- **`run_console`**: Whitelisted execution with shell injection protection (`CONSOLE_BLOCKED_PATTERNS`).

## 🗺️ System Path Mapping ("@ Strings")
The agent uses semantic prefixes to resolve paths across multiple physical directories:
| Prefix | Source | Default Folder Name | Purpose |
| :--- | :--- | :--- | :--- |
| `@CORE/` | `core` | `core` | System logic, identity, base prompts. |
| `@LIBRARY/` | `extra` | `library` | Protocols, knowledge bases, static data. |
| `@TOOLS/` | `tools` | `commands` | Skill blueprints and custom scripts. |
| `@WORKSPACE/` | `workSpace`| `workspace` | The primary project/sandbox directory. |

> [!IMPORTANT]
> **Resolution Logic:** Handled in `src/services/core/agent/utils.ts`. 
> **Bug Fixed:** `@LIBRARY/` now correctly uses a `9` character slice (fixing the "Y/filename" error).

## 🚀 Recent Performance & Stability Enhancements

### 1. Unified Native Multi-Root Bridge
The IPC bridge (`main.cjs`) now accepts an optional `rootPath`. This allows the agent to perform `list`, `search`, and `batch` operations on any of the four major system directories natively, resolving the limitation where it could only see the active workspace.

### 2. High-Capacity Output Model (Token Limits)
To handle complex coding or research tasks without truncation:
- **Z.AI / OpenAI-Compatible**: `max_tokens` set to `32,768`.
- **Gemini**: `maxOutputTokens` set to `128,000`.
- **Detection**: The agent loop captures `finishReason: "length"`. If detected, the system warns the model about output truncation so it can continue or optimize its answer.

### 3. Smart Folder Initialization
The `OnboardingWizard.tsx` ensures the initial environment is set correctly. By default, it creates:
- `.../core`
- `.../commands`
- `.../workspace`
- `.../library`

### 4. UI Rendering & Markdown Engine Resiliency
- **Table Auto-Healing:** The `convertTablesToHtml` parser was refactored with a 2D-array engine. It no longer fails on missing `|` pipes or unmatched header columns. It measures Max Width dynamically and fills missing data with `&nbsp;` to ensure UI stability against LLM hallucinations. Guarded by `inPre` to avoid misinterpreting ASCII inside `<pre>` blocks.
- **Dynamic Viewport Animations (`Common.tsx`):**
  - Uses an integrated `IntersectionObserver` attached to generated Markdown blocks.
  - **Thematic Breaks (`---`):** Transformed into `<div class="divider-container">`. It triggers an outward "laser-draw" effect where two glowing dots trace from the `center` to the edges (`width: 0` to `width: 100%`) when scrolled into view. Padding is compressed to `0.5rem` for spatial optimization.
  - **Blockquotes (`> text`):** Features an HTML-aware JavaScript typewriter engine directly in the Observer. It locks the `minHeight` before clearing innerHTML (to prevent scroll jitter) and types text out frame-by-frame. Critically, it accurately parses tags (`isTag` logic) to prevent breaking inline HTML (`<strong>`, links) during the print stream.
- **Vite Build Optimization:** Memory warnings (500kB chunks) are neutralized via Manual Chunk Splitting (`vite.config.ts`), partitioning `react` and `react-dom` into a distinct `vendor` pool. Empty chunk warnings typical to FontAwesome assets were successfully mitigated.
56: 
57: ### 5. Quick Workflow & UX Refinement (v1.9.7)
58: - **Rapid Document Creation (+):** Integrated a '+' button in the Context Library header that creates a new documented and immediately opens the Library Manager in edit mode.
59: - **Deep-Linking Library Editor:** The `LibraryManager` now supports external edit requests via `libraryEditFile` state, enabling seamless transitions from the sidebar.
60: - **Vertical Sidebar Breakpoint:** Implemented a responsive vertical collapse for sidebar sections when height < 650px, transforming them into compact, interactive tabs.
61: - **Asymmetric Gradient Aesthetics:** Refined section separators and primary sidebar borders with non-linear gradients (fast fade-in, long fade-out) for a professional neural look.
62: - **Indigo Accents:** Standardized library hover states to Indigo-400 to match minimized mobile icons for visual consistency.

### 6. Atomic Persistence & Session Stability (v1.9.8)
- **Data Integrity Fix**: Integrated `fsyncSync` in `safeWriteJSON` to ensure file writes are flushed to physical disk, preventing 0-byte file corruption during power loss or system crashes.
- **Self-Healing Session List**: Added proactive cleanup in the `get-sessions` handler to remove unreadable/corrupted files, preventing UI clutter.
- **Native Descriptor Writing**: Refactored the file-saving bridge to use native file descriptors for guaranteed write completion.

### 7. Temporal Awareness & UX Refinement (v2.1.1)
- **Session Timestamping**: Injected formatted timestamps (`[DD/MM HH:mm]`) into historical messages, providing the model with accurate session-long temporal context.
- **Desktop Scroll Experience**: Re-engineered scrollbars (10px width + active/hover states) and implemented smart auto-scroll to follow output during streaming if user is near the bottom.
- **Output Sanitization**: The `answerFormatter` now filters out the injected timestamps from the model's final response, ensuring a clean UI and Telegram experience.
- **Stable Tool Timestamps**: Tool execution blocks now lock to a static "Executed" timestamp once the process reaches its final state (success or error).

## ⚠️ Internal Peculiarities & Developer Notes
- **Memory Store vs Native**: Tools prioritize native disk operations (`agentReadFile`, etc.). Memory store serves as a secondary fallback for remote/web-view modes.
- **Path Stripping**: All filenames are normalized (backslash to forward-slash) and have leading slashes removed before resolution.
- **Protected Files**: `SOUL.md`, `USER.md`, `TOOLS.md`, `AGENT_MODES.md`, and `MODES.md` are protected from modification by the agent unless explicit overrides are present in `tools.ts`.

---
*Este documento reemplaza a `project:status` y debe ser consultado antes de proponer cambios estructurales.*
