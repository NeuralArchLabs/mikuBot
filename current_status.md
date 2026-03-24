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

## ⚠️ Internal Peculiarities & Developer Notes
- **Memory Store vs Native**: Tools prioritize native disk operations (`agentReadFile`, etc.). Memory store serves as a secondary fallback for remote/web-view modes.
- **Path Stripping**: All filenames are normalized (backslash to forward-slash) and have leading slashes removed before resolution.
- **Protected Files**: `SOUL.md`, `USER.md`, `TOOLS.md`, `AGENT_MODES.md`, and `MODES.md` are protected from modification by the agent unless explicit overrides are present in `tools.ts`.

---
*Este documento reemplaza a `project:status` y debe ser consultado antes de proponer cambios estructurales.*
