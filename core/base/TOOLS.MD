# TOOLS.md - Workspace Cartography & Toolkit



## 🗺️ System Topography

This file defines the rules for interacting with the file system and available tools. mikuBot must use the base paths configured in the environment to ensure precision.

### 📍 Mount Points

The system uses the following internal aliases to refer to configured folders:
- **@CORE:** Identity and memory folder (SOUL.md, ACTIVE_CONTEXT.md).
- **@DEV:** Development projects folder.
- **@MAP:** Reference library and documentation.
- **@WORKSPACE:** The current session's project directory, or the configured default workspace for sessions without a project. File tools and console tools use the same session context.
- **@ROOT:** Project Root directory (where `config.json` lives).

Actual paths are injected dynamically according to Armando's configuration. Do not assume fixed absolute paths unless required for a specific system command.

## ⚙️ Command Generation Rules (CLI Protocol)

When mikuBot suggests terminal commands, it must adhere to the following:

1.  **Navigation:** Use paths relative to the current mount point. An explicit `cwd` can select a directory in another configured, authorized root.
2.  **Windows Syntax:**
    * Use double quotes `""` for paths with spaces.
    * Shell commands use CMD on Windows and `/bin/sh` on POSIX. Invoke PowerShell explicitly when its syntax is needed.
3.  **Context:** Commands start in the session's @WORKSPACE directory unless `cwd` is supplied. A session's project does not change the global workspace configuration or another session's paths.

## 🛠️ Stack & Environment
- **Operating System:** Windows 11.
- **Development Tools:** Antigravity, Jules, Google AI Studio.
- **Package Manager:** npm / pip / maven (according to project).
- **Git:** Installed and configured globally.

## 🖥️ Console Access (`run_console`, `manage_task`, `get_console_status`, `project_status`)

The `run_console` tool provides workspace console access. Behavior depends on the current **Mode**:

### 🛡️ Chat Mode (Restricted)
Designed for safe, casual use.
- **Allowed Commands:** `git`, `node`, `npm`, `npx`, `ls`, `dir`, `cat`, `type`, `echo`, `mkdir`, `cd`, `pwd`, `grep`, `find`, `head`, `tail`, `wc`, `tree`, `tsc`, `python`, `pip`, `curl`, `wget`, `gh`, `sqlite3`, `awk`, `sed`, `perl`, `jq`, `ping`, `tasklist`, `taskkill`, `systeminfo`, `whoami`, `netstat`, `ipconfig`, `ssh`, `scp`, `rsync`, `findstr`, `powershell`, `cmd`, `vite`, `next`, `react-native`, `expo`, `flutter`, `dart`, `go`, `rustc`, `cargo`, `java`, `javac`, `mvn`, `gradle`, `docker`, `kubectl`.
- **Approval:** Commands outside the automatic-approval rules require user approval. High-risk commands also require manual approval.
- **Working Directory:** `cwd` must remain within an authorized root, including after resolving symlinks or junctions. Changing modes does not bypass directory validation.

### 🔓 Agent / Instruction Mode (Unrestricted)
Completely liberated console.
- **NO Command Whitelist:** Any installed binary can be executed.
- **Shell Syntax:** Shell operators (`&&`, `||`, `|`, `;`, `>`, etc.) follow the selected shell's syntax. Working-directory validation still applies.
- **Auto-Approval:** Commands are automatically approved UNLESS they are detected as **HIGH RISK**.

### 🔴 HIGH RISK Commands
The following commands **ALWAYS** require manual user approval with a specific red warning:
`rm`, `del`, `rd`, `format`, `mkfs`, `fdisk`, `dd`, `chmod`, `chown`, `mv`, `ren`, `wget`, `curl`, `ssh`, `taskkill`, `kill`, `shutdown`, `reboot`.

### ⏳ Asynchronous Execution
`run_console` returns a tracked process result with `commandId`, effective `cwd`, `workspacePath`, `projectId`, and `sessionId`. Verify these paths before interpreting a project build.
- **`cwd`:** Optional directory, absolute or relative to the session's workspace; aliases such as `@WORKSPACE` use that same session context. The directory must exist within an authorized root. The backend checks the session's expected workspace against the registered project or configured default; stale or missing session/project context fails instead of silently running elsewhere. Saving workspace settings refreshes the configured roots.
- **`wait_ms`:** Deliberately pause this tool response for up to the requested time (default 1,000 ms, maximum 30,000 ms). If the child finishes during that window, return its terminal result; otherwise return `running` and keep the process alive. This does not change `timeout_ms`. `WaitMsBeforeAsync` and `waitMs` are accepted legacy aliases.
- **`timeout_ms`:** Execution deadline, default 30,000 ms, maximum 600,000 ms. The deadline remains active after the tool returns a background task.
- **Monitoring:** Use `manage_task` to query, wait, list, or terminate session tasks. `get_console_status` remains a compatibility alias for status queries.
- **Notifications:** An unobserved background completion is reported to its originating session once. The desktop UI also receives a live completion signal so a running console indicator can settle after the model stream ends. Use `commandId` to correlate the task and `eventId` to deduplicate its completion; an initial running response is not a second completion. A terminal result returned by `run_console` or a specific `status`, `wait`, or `terminate` query acknowledges it and prevents a later duplicate notification. `list` does not acknowledge completions.
- **Lifetime:** Task tracking and logs are held in memory; they are not a history that survives an application restart.

### Process Results
The tool's outer `success` means that execution or retrieval was handled. The process result in `data` reports its own `success`: `null` while running, `true` only for a normal exit with `exitCode: 0`, and `false` for other terminal outcomes.
- **`status`:** `running`, `completed`, `failed`, `timed_out`, `cancelled`, or `spawn_error`.
- **`exitCode`:** The child's exit code, or `null` when no exit code is available. Do not fabricate an exit code for a signal or a failure to start.
- **`spawnError`:** Failure to start the child, separate from its output.
- **`stdout` / `stderr`:** Separate output streams. A nonempty `stderr` can contain warnings or normal diagnostics; it does not by itself mean failure.
- **`durationMs`:** Elapsed time, including while the task is running.

### Scheduled Tasks and System Resume
The scheduler retains overdue occurrences across suspension and application startup, including pending one-shot tasks. Native resume events wake the same queue used by automatic and manual runs; each task runs at most once concurrently. Before dispatch, the app checks native power state and whether settings, the session and conversation are ready. In development it also probes Vite's provider-module endpoint; if unavailable, tasks remain pending and retry on reconnect/resume or the next 30-second tick without recording an execution.

When the operating system reports offline, remote-model tasks remain pending; local Ollama/Unsloth tasks can still run. This connectivity signal is not a guarantee that a provider is healthy. Provider implementations are imported at application startup. Actual inference failures and cancellations are recorded as task errors, never successes; a cancelled Codex IPC request does not trigger provider fallback. Already-started tasks are not automatically replayed because they may have executed tools. Compare the timestamp of a saved conversation error with the scheduler log before attributing it to the latest wake. React DevTools and fallback-font notices do not establish a provider failure.

### Shell and Exit Codes
`shell: true` is the default and accepts a shell command with legacy `args` text. Commands are passed without rewriting their quoting or adding `chcp` or PowerShell error preferences. For a direct executable invocation, use `shell: false` and `argv`, an array of individual arguments; shell operators are then literal arguments.

Direct execution preserves the child's exit code. A shell reports its own exit code, so its script must propagate a nested command's result when needed. For example, an explicitly invoked PowerShell script can use `exit $LASTEXITCODE` immediately after a native command. With `$ErrorActionPreference = 'Stop'`, a terminating `Write-Error` can stop the script before a later `exit 17` runs; the tool does not change this PowerShell behavior.

### Usage Format
```json
{
  "name": "run_console",
  "arguments": {
    "command": "npm",
    "args": "run dev",
    "cwd": "@WORKSPACE",
    "wait_ms": 500,
    "timeout_ms": 600000
  }
}
```

### `manage_task`
Manage processes started by `run_console` in the current session.
- **`action`:** `status` (default), `wait`, `list`, or `terminate`.
- **`commandId`:** Required except for `list`.
- **`list`:** Returns compact metadata summaries of retained session tasks, without logs. Use a specific task query to retrieve output.
- **`wait_ms`:** Deliberately pause the tool response for up to the requested time (default 1,000 ms, maximum 30,000 ms) when `action` is `wait` or `terminate`. The wait is event-driven: a process `close` wakes it immediately and returns the terminal snapshot; the timer is only a maximum. Output received while the process is still running remains partial data and does not authorize the agent to continue as if it had finished. If `wait_ms` is supplied without `action`, the backend treats it as `wait`; `waitMs` is a supported camelCase alias. This does not change the execution deadline.
- **`stdoutCursor` / `stderrCursor`:** Omit to read the latest output chunk. Supply the preceding result's stream cursor to page forward through new output; use `0` to request the earliest output still retained.
- **`maxOutputChars`:** Limit characters per stream in a retrieval. Each stream retains at most 512 Ki characters. `output.stdout` and `output.stderr` report `fromCursor`, `nextCursor`, `totalChars`, `bufferStart`, `droppedChars`, `truncated`, and `hasMore`. Continue from `nextCursor` while `hasMore` is true; do not assume truncated history can be recovered.

### `get_console_status`
Compatibility alias for `manage_task` with `action: "status"`. Existing callers can continue supplying `commandId`; prefer `manage_task` for new workflows.

### `project_status`
Read-only evidence about the current session's workspace: effective paths, project association, directory structure, `package.json` and scripts when present, and dependency-directory presence. Use it before selecting a project build command. It does not install dependencies, validate their health, or establish that a build succeeded. Sessions without a project inspect their configured default workspace.
- **`cwd`:** Optional directory to inspect, with the same resolution and validation as `run_console`.

## 📂 File Management (`read_file`, `update_file`, `patch_file`)

### `read_file`
Read content from any mount point.
- **Param:** `filename` (path/to/file.ext)
- **Param:** `source` (workSpace, core, library)

### `update_file`
Create or overwrite files. Directories are created automatically.
- **Param:** `filename`, `content`, `source`

### `patch_file` (Version 2.1)
Efficiently edit text files using protected strategies. Always creates a `.bak` backup and validates the result.
- **Param:** `filename`, `find`, `replace`, `strategy` (auto, exact, lineNumber, fuzzy, regex).
- **Supports:** `patches` array for multiple edits in a single call.
- **Fuzzy Strategy:** Requires at least 60% confidence and protects against partial or duplicated replacements.
- **Safety:** Rejects binary files, unbalanced results, suspicious size changes, and invalid regex patterns.
- **Note:** `find` must be a substantial block for `auto` strategy. Use `lineNumber` for precise edits.

### `undo_patch`
Reverts the last patch to a file using the `.bak` file.
- **Param:** `filename`

### `delete_file`
Delete a file or clear @CORE/tasks.md once completed.
- **Param:** `filename`, `source`

## 🔍 Discovery & Search (`list_files`, `search_files`, `search_pattern`)

### `list_files`
List files and directories in a mount point. The native listing is recursive by default and returns paths relative to the effective mount root; ignored dependency/build folders remain excluded.
- **Param:** `source`
- **Param:** `directory` (optional subfolder)
- **Param:** `recursive` (optional boolean, defaults to `true`)

### `search_files`
Finds file names and relative paths. It does **not** search file contents.
- **Param:** `query` (the file name or path fragment to find).
- **Param:** `filePattern` (e.g., "*.js", "!node_modules/*").
- **Param:** `caseSensitive` (boolean).
- **Param:** `searchPath` (sub-folder to start search).
- **Param:** `head_limit`, `offset` (pagination by file).
- **If you need text, code, or regex content search:** use `search_pattern`.

### `search_pattern`
Searches inside file contents with the bundled RipGrep engine. Use this for code, text, or regular-expression patterns.
- **Param:** `pattern`, `path`, `glob`, `case_sensitive`.
- **Param:** `output_mode` (`content`, `files_with_matches`, `count`).
- **Param:** `context`, `head_limit`, `offset`.
- **Automatic protections:** excludes dependencies, build output, caches, binary/media files, and lock files.

### `get_file_outline`
Extract classes, functions, and interfaces from a source file.
- **Param:** `filename`, `source`

### `batch_operation`
Perform bulk file operations (copy, move, delete) using glob patterns.
- **Param:** `operation` (copy, move, delete), `source_path`, `destination_path` (optional), `pattern` (optional glob)

## 🛰️ System & Environment Tools (`get_system_metrics`)

### `get_system_metrics`
Get real-time OS metrics (CPU, Memory, Uptime, Hostname).

## 🛰️ Research Hierarchy (Tiers 1-4)

### Tier 1: `web_search` [Base Tool]
Searches the web, preserves the complete result set, gives up to five candidate URLs expanded previews of extracted content (about 6,000 characters maximum), and keeps snippets plus reduced typed media entries in `media` (`type` and `url`) for the remaining results. PDF URLs are processed with MarkItDown and YouTube URLs with `video_transcriber` when available. The accepted full extraction is cached; use `read_url` for the complete source without repeating extraction.
- **Param:** `query`
- **Param:** `category` (general, images, videos, news, maps, shopping)
- **Param:** `search_depth` (basic, advanced)

### `web_search_more` [Base Tool]
Continues a previous `web_search` result set by `search_id` and offset without repeating the query. It returns the next page with expanded previews for up to five additional candidate URLs; use `read_url` for complete cached content.

### Tier 2: `read_url` [Base Tool]
Directly read a URL to extract textual content and clean HTML.

### Tier 3: `deep_research` [Skill]
Plan-first deep research with auditing and multiple sources. Avoids hallucinations.

### Tier 4: `api_fetcher` [Universal Skill]
Direct interaction with REST APIs (GET, POST, JSON). Allows the agent to consume any external web service with authentication and complex parameters.

## ⏳ Neural Scheduling (`add_scheduled_task`)

### `add_scheduled_task`
Program a proactive task for the agent to execute in the future.
- **Param:** `name` (Short task identifier)
- **Param:** `prompt` (Detailed instruction for the agent)
- **Param:** `scheduleType` (once, interval, cron)
- **Param:** `schedule` (ISO date for 'once', minutes for 'interval', cron for 'cron')
- **Param:** `channel` (telegram, ui, both)
- **Param:** `mode` (chat, agent)

## 🧠 Neural Skills Library (Dynamic)
Modular skills installed in `@TOOLS/skills/`:
- **`api_fetcher`**: Universal HTTP client for REST APIs.
- **`compute`**: Advanced scientific and symbolic calculator using SymPy (arbitrary precision arithmetic, equation solving, calculus).
- **`deep_research`**: Plan-first, resumable multi-language investigation with source verification and iterative reporting.
- **`video_transcriber`**: Obtains available captions/subtitles from YouTube videos. It does not download audio or transcribe locally; if captions are unavailable, it returns a friendly message.
- **`image_generator`**: Generates and saves images in the active workspace.
- **`list_available_skills`**: Auto-discovery of new installed skills.
- **`instruction_booklet`**: Self-documenting tool usage library to look up parameters and examples. (Use `self_aware` as tool_name to learn about your own UI, architecture, and capabilities).
- **`dynamic_widgets`**: Advanced tool to create, launch, and manage neural micro-apps (exclusive frameless windows).
- **`recall`**: Persistent semantic memory. Store, retrieve, and connect anything worth remembering across sessions.

## 🔮 Memory Protocol (`recall` skill)

The `recall` skill is your **long-term memory**. Use it proactively and habitually.

### When to USE `recall` automatically (no need to ask):

| Trigger | Command | Notes |
|---------|---------|-------|
| User mentions a person, place, project or preference | `recall` first | Check if you already know this entity before asking |
| User shares personal information (feelings, goals, routines, relationships) | `synapse` | Store it for future sessions |
| User corrects you or gives feedback on your behavior | `synapse` → `AgentGrowth/Feedback_Applied` | Internalize it |
| A strategy or approach worked exceptionally well | `synapse` → `AgentGrowth/Successful_Strategies` | Learn from it |
| You realize you lacked context that you *should* have remembered | `synapse` → `AgentGrowth/Knowledge_Gaps` | Flag it |
| Start of a session with the user | `recall` with query about the user or recent context | Re-orient yourself |
| Memory is over 90 days old and the topic is still relevant | `refresh` | Prevent stale data |
| User asks "do you remember...?" or "you know that..." | `recall` immediately | Never say you don't remember without checking |
| Two separate memories are clearly related | `link` | Build the semantic graph actively |

### Command reference:
- `init` — Deploy folder tree. Runs automatically on first use.
- `synapse` — **Store** a new memory. Always include meaningful `tags`. Use `linked_to` if you can see connections.
- `recall` — **Search** memories. Returns direct hits + semantic graph neighbors. Use `depth: 2` normally, `depth: 3` for broad exploration.
- `refresh` — **Update** an existing memory with new information. Preserves original `created` date.
- `amnesia` — **Delete** a memory. Use when the user explicitly says to forget something.
- `link` — **Connect** two existing memories with a typed relation (`influences`, `caused_by`, `same_topic`, `contradicts`, `expands`, `related_to`).
- `nexus` — **Overview** of all stored memories with staleness stats. Use periodically or when the user asks what you know.
- `health` — **Diagnostic** of memory integrity. Checks for dangling entries, broken links, and orphan files.

### AgentGrowth — Your own memory, not the user's:
Use `AgentGrowth` subcategories to store **your own** evolution as an agent:
- After being corrected → `AgentGrowth/Feedback_Applied`
- After a complex task → `AgentGrowth/Lessons_Learned` or `AgentGrowth/Successful_Strategies`
- When you notice a pattern in how this user works → `AgentGrowth/User_Adaptations/Workflow_Preferences`
- When you identify a capability gap → `AgentGrowth/Knowledge_Gaps`


---
*Note: This file serves as a spatial and technical reference. The system will automatically inject these rules if failures are detected.*
