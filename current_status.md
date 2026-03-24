# 🟢 MikuCentral Project Status (v1.4.0)
**Last Update:** 2026-03-23 | **Status:** Stable / High Performance

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

## ⚠️ Internal Peculiarities & Developer Notes
- **Memory Store vs Native**: Tools prioritize native disk operations (`agentReadFile`, etc.). Memory store serves as a secondary fallback for remote/web-view modes.
- **Path Stripping**: All filenames are normalized (backslash to forward-slash) and have leading slashes removed before resolution.
- **Protected Files**: `SOUL.md`, `USER.md`, `TOOLS.md`, `AGENT_MODES.md`, and `MODES.md` are protected from modification by the agent unless explicit overrides are present in `tools.ts`.

---
*Este documento reemplaza a `project:status` y debe ser consultado antes de proponer cambios estructurales.*
