# Toolkit Snippets Library (Neural JIT)

This file contains valid JSON code snippets, contextual use cases, and parameter explanations for each tool in the MikuBot ecosystem. It is used by the `instruction_booklet` skill to provide detailed manuals to the agent dynamically.

## [self_aware]
**Purpose:** Deep system architecture, capabilities, and UI navigation instructions.

### Your Core Capabilities & Environment
- **Environment:** You execute natively inside **mikuBot/mikuCentral Dashboard**, a Windows 10/11 Desktop application (Electron, React 19).
- **Autonomy:** You support background execution scoped to the originating session while the application is running. Console task tracking is in memory and does not survive an application restart.
- **Anti-Black Box & Neural Flow:** Your `thought` blocks are visible to the user. You stream thoughts and actions visually.
- **Studio Elite Renderer:** You can natively render LaTeX ($$, $), Mermaid diagrams (flowcharts, erDiagrams), and Obsidian-style Callouts (`> [!NOTE]`).
- **searXena Native Search:** You use a private, local Python metacrawler without rate limits.
- **Security:** API keys are encrypted in the `processVault`. Destructive/Console commands prompt the user for manual approval.

### UI & App Navigation (User Guidance)
If the user asks where to find features, use this layout:
- **Control Room / Settings:** For managing API keys, themes (Miku, Midnight, Synthwave, Emerald, Cloud), and Voice/Telegram.
- **Skills:**  Within Control Room tab you can find the Skills tab on the top right side, where the user can toogle ON\OFF the skills you have available Or create more themselves or ask you to create them, if so, Skills must be stored and accessed in @COMMANDS/Skills.
- **Context Library:** Bottom-left sidebar (or Book icon). Where users create custom markdown protocols.
- **Neural Sessions:** Top-left sidebar. Thread management.
- **Scheduler:** Top-right (near Load/Export). For managing automated tasks you create.
- **Cortex & Command Editors:** Specialized UI sections for modifying internal system rules.
- **Mode Toggles (Auto/Sequential/Debug):** Located directly in the chat input area. In Agent Mode, the execution toggle selects sequential or parallel tool execution.

### Example
```json
{
  "name": "instruction_booklet",
  "arguments": {
    "tool_name": "self_aware"
  }
}
```

## [read_file]
**Purpose:** Reads the contents of a file from the specified mount point.
**When to use:** Use this when you need to inspect the contents of an existing file before modifying it, or when searching for specific code/information inside a file.

### Best Practices & Use Cases
- Do not attempt to read extremely large files (like compiled bundles) unless necessary.
- **Param `source`**: Usually `"workSpace"`, `"core"`, or `"tools"`.

### Example
```json
{
  "name": "read_file",
  "arguments": {
    "filename": "path/to/filename.md",
    "source": "workSpace"
  }
}
```

## [update_file]
**Purpose:** Create a new file or completely overwrite an existing one. Directories are created automatically.
**When to use:** Use this when writing a file for the first time or when replacing the entire file makes more sense than patching a small section.

### Best Practices & Use Cases
- **Avoid Overwriting Unintentionally:** If a file already exists and you only want to change one function, use `patch_file` instead to prevent losing other changes.

### Example
```json
{
  "name": "update_file",
  "arguments": {
    "filename": "path/new_file.txt",
    "content": "Full file content goes here...",
    "source": "workSpace"
  }
}
```

## [patch_file]
**Purpose:** Efficiently and safely edit text files using exact, normalized, fuzzy, regex, or line-number strategies. Always creates a `.bak` backup.
**When to use:** Use this for partial file modifications, bug fixes, or injecting new functions into existing code.

### Strategies
- **`auto`**: The default. Tries exact, whitespace-normalized, and confidence-scored fuzzy matching.
- **`regex`**: Applies a regular-expression replacement. Use only when regex semantics are intended.
- **`lineNumber`**: The safest. Replaces a specific line number.
- **Multi-patching**: Use the `patches` array for multiple non-contiguous edits in a single call.
- **Safety:** Rejects binary files, unbalanced structures, suspicious size changes, and duplicate blocks.

### Example 1: Basic Auto Patch
```json
{
  "name": "patch_file",
  "arguments": {
    "filename": "file.js",
    "find": "exact text block to find",
    "replace": "new text block",
    "strategy": "auto",
    "source": "workSpace"
  }
}
```

### Example 2: Line Number Strategy
```json
{
  "name": "patch_file",
  "arguments": {
    "filename": "file.js",
    "lineNumber": 42,
    "replace": "const newVar = true;",
    "strategy": "lineNumber",
    "source": "workSpace"
  }
}
```

### Example 3: Multiple Patches Array
```json
{
  "name": "patch_file",
  "arguments": {
    "filename": "file.js",
    "source": "workSpace",
    "patches": [
      { "find": "old text 1", "replace": "new text 1" },
      { "find": "old text 2", "replace": "new text 2" }
    ]
  }
}
```

## [undo_patch]
**Purpose:** Reverts the last patch applied to a file using the `.bak` backup file.
**When to use:** Use this immediately if you realize a `patch_file` call broke the file structure or logic.

### Example
```json
{
  "name": "undo_patch",
  "arguments": {
    "filename": "file.js",
    "source": "workSpace"
  }
}
```

## [list_files]
**Purpose:** List all files within a mount point or specific directory.
**When to use:** Use this to explore the project structure when you are unsure where files are located.

### Parameters
- **`directory`**: The subfolder to explore (e.g., `"src/components"`). Leave empty for root.
- **`recursive`**: Defaults to `true`; set to `false` for only the requested directory's immediate children.

Native results use relative `path`/`name` values and include `isDirectory`; ignored dependency and build folders are omitted. The response is bounded to protect the UI, so use `search_files` when you need a targeted lookup in a large project.

### Example
```json
{
  "name": "list_files",
  "arguments": {
    "source": "workSpace",
    "directory": "src/components",
    "recursive": true
  }
}
```

## [search_files]
**Purpose:** Find files by name or relative path. It does not inspect file contents.
**When to use:** Use this when you know part of a filename, extension, or path but not its exact location.

### Parameters
- **`query`**: The filename or path fragment to search for.
- **`filePattern`**: (Optional) Glob pattern like `*.js` or `!node_modules/*` to narrow down results.
- **`searchPath`**: (Optional) Subfolder to start searching from.
- **`caseSensitive`**: (Optional) Boolean.

### Example
```json
{
  "name": "search_files",
  "arguments": {
    "query": "FileEditor",
    "source": "workSpace",
    "filePattern": "*.ts",
    "searchPath": "src/utils",
    "caseSensitive": true
  }
}
```

## [search_pattern]
**Purpose:** Search inside file contents using text or regular-expression patterns.
**When to use:** Use this to find functions, API calls, symbols, strings, or code patterns inside files.

### Parameters
- **`pattern`**: Text or regular-expression pattern.
- **`path`**, **`glob`**, **`case_sensitive`**: Optional scope and matching controls.
- **`context`**, **`head_limit`**, **`offset`**: Optional context and pagination controls.
- **`output_mode`**: `content`, `files_with_matches`, or `count`.

If a content search is accidentally sent to `search_files`, explain that `search_files` locates filenames and recommend `search_pattern` politely.

## [get_file_outline]
**Purpose:** Extract classes, functions, and interfaces from a source file without reading the entire content.
**When to use:** Use this to quickly understand the structure of a large file before deciding which parts to read or modify.

### Example
```json
{
  "name": "get_file_outline",
  "arguments": {
    "filename": "src/main.ts",
    "source": "workSpace"
  }
}
```

## [batch_operation]
**Purpose:** Perform bulk file operations (copy, move, delete) using glob patterns.
**When to use:** Use this for refactoring folder structures, backing up logs, or cleaning up multiple generated files at once.

### Parameters
- **`operation`**: Can be `"copy"`, `"move"`, or `"delete"`.
- **`pattern`**: A glob pattern like `"*.log"` or `"temp_*"`.

### Example
```json
{
  "name": "batch_operation",
  "arguments": {
    "operation": "copy",
    "source_path": "temp_logs",
    "destination_path": "backup_logs",
    "pattern": "*.log"
  }
}
```

## [web_search]
**Purpose:** Search SearXena and return the first page from the complete result set. Up to five candidate URLs receive expanded extracted-content previews (about 6,000 characters maximum); the remaining results retain cleaned snippets, URLs, and reduced typed media entries in `media` (`type` and `url`). PDF URLs are processed with MarkItDown and YouTube URLs with `video_transcriber` when available. The accepted full extraction is cached, so `read_url` can read it completely without repeating extraction. The response includes `search_id` and `next_offset` for pagination.
**When to use:** Use this for current facts, recent news, or general context. Use `read_url` when a specific source needs to be read directly.

### Categories
Can be: `general`, `images`, `videos`, `news`, `maps`, `shopping`.

### Example
```json
{
  "name": "web_search",
  "arguments": {
    "query": "claudecode vs antigravity comparison",
    "category": "general"
  }
}
```

## [web_search_more]
**Purpose:** Retrieve another page from a previous `web_search` using its `search_id`, without repeating the search. The page tries to enrich up to five additional URLs with expanded previews and preserves the remaining results as snippets.
**When to use:** Use this when the first page does not contain enough relevant sources or when the model needs to inspect the rest of the original result set.

### Example
```json
{
  "name": "web_search_more",
  "arguments": {
    "search_id": "search-<id>",
    "offset": 10,
    "limit": 10
  }
}
```

## [read_url]
**Purpose:** Directly read a specific URL to extract textual content and clean HTML (Tier 2 Research).
**When to use:** Use this when you already have a specific link (perhaps from a `web_search`) and need to read the full article or documentation page.

### Example
```json
{
  "name": "read_url",
  "arguments": {
    "url": "https://example.com/article"
  }
}
```

## [deep_research]
**Purpose:** Exhaustive multi-language investigation with planning, source verification, iterative report writing and resumable checkpoints.
**When to use:** Use this for deep, complex investigations. First request a plan; execute only after the user approves it. If interrupted, resume the same session instead of restarting.

### Plan request
```json
{
  "name": "deep_research",
  "arguments": {
    "topic": "Rust memory safety in embedded systems",
    "categories": ["general"],
    "target_language": "both",
    "approved": false
  }
}
```

### Execute the approved plan
```json
{
  "name": "deep_research",
  "arguments": {
    "topic": "Rust memory safety in embedded systems",
    "approved": true,
    "plan": { "objectives": ["..."], "steps": ["..."] }
  }
}
```

## [video_transcriber]
**Purpose:** Obtain captions/subtitles exposed by a YouTube video.
**When to use:** Use when the user needs the captioned content of a YouTube URL. If the video has no available captions, report that politely; do not download audio or attempt local transcription.

```json
{
  "name": "video_transcriber",
  "arguments": { "url": "https://www.youtube.com/watch?v=...", "language": "auto" }
}
```

## [image_generator]
**Purpose:** Generate one or more images from a descriptive prompt and save them in the active workspace.
**When to use:** Use when a user asks to create an illustration, image concept or visual asset.

```json
{
  "name": "image_generator",
  "arguments": { "prompt": "A bioluminescent botanical illustration", "aspect_ratio": "1:1" }
}
```

## [api_fetcher]
**Purpose:** Universal HTTP client skill for REST APIs (Tier 4). Allows interaction with external web services with full parameter control.
**When to use:** Use this when you need to pull JSON data from an external API, trigger webhooks, or interact with an authenticated service.

### Example
```json
{
  "name": "api_fetcher",
  "arguments": {
    "url": "https://api.example.com/v1/user",
    "method": "POST",
    "body": { "id": 123 },
    "headers": { "Authorization": "Bearer TOKEN" },
    "params": { "verbose": "true" },
    "timeout": 15
  }
}
```

## [run_console]
**Purpose:** Execute a shell command or a direct executable in the current session's workspace, with bounded waiting and tracked background execution.
**Security:** Behavior depends on the current Mode. In Chat Mode, "LAX" restrictions apply (whitelisted commands). In Agent/Instruction Mode, execution is liberated (any command, all shell operators). **High-risk commands** always require manual approval with a red warning.
**When to use:** Use this for build tasks, git operations, environment checks, or any system-level command.

### Workspace Resolution
File tools and console tools resolve `@WORKSPACE` from the same session context. A project session uses that project's directory; a session without a project retains the configured default workspace. Selecting a project does not mutate global mount points or other sessions. The result includes effective `cwd`, `workspacePath`, `projectId`, and `sessionId`; inspect these before declaring a build successful or failed. Use `project_status` for read-only workspace evidence before choosing a build command.

The renderer supplies its expected workspace to the backend, which checks it against the registered project or configured default before execution. A stale workspace mismatch or an unknown owning session fails instead of silently selecting another directory. Saving workspace settings refreshes the configured roots; project selection still remains local to each session.

### Parameters
- **`command`**: Shell command text, or an executable path/name for `shell: false`.
- **`args`**: Legacy argument text for shell execution (e.g., `"run build"`). Quoting and shell syntax are not rewritten.
- **`shell`**: Optional boolean, defaults to `true`. The default shell is CMD on Windows and `/bin/sh` on POSIX. Use `false` for direct execution.
- **`argv`**: Array of individual arguments for `shell: false`. Use it instead of `args` for direct execution; spaces remain inside their argument and shell operators are literal text. The renderer forwards this array to the process backend.
- **Argument mode rule**: use `args` with `shell: true` (the default), or use `argv` with `shell: false`. Combining them is rejected with an actionable error; it is not a request to merge or quote the two formats.
- **`cwd`**: Optional working directory. Absolute paths within configured authorized roots, session aliases such as `@WORKSPACE`, and paths relative to the session's workspace are supported. The directory must exist and remain within its authorized root after resolving symlinks or junctions; a bad project path must not silently fall back to the generic workspace.
- **`wait_ms`**: Optional observation window before returning, default 1,000 ms, maximum 30,000 ms. The tool call remains pending during this window; if the child finishes, its terminal result is returned to the agent. Otherwise it returns `running` and the process continues in the background. `WaitMsBeforeAsync` and `waitMs` remain accepted aliases for older callers. `0` returns immediately.
- **`timeout_ms`**: Optional execution deadline, default 30,000 ms, maximum 600,000 ms. It remains active after backgrounding. Set it explicitly for builds or development servers expected to run longer than 30 seconds.
- **`commandId`**: Optional unique tracking ID. Use the returned ID for subsequent `manage_task` calls.

### Results and Exit Codes
The tool's outer `success` reports whether the execution/retrieval request was handled. It is not a build verdict. The process result in `data` uses the same fields for the initial result, subsequent status, and completion notification:
- **`commandId`** identifies the task. **`eventId`** identifies its terminal event for deduplication when available.
- **`status`** is `running`, `completed`, `failed`, `timed_out`, `cancelled`, or `spawn_error`.
- **`success`** is `null` while running, `true` only for a normal exit with code zero, and `false` for other terminal outcomes.
- **`exitCode`** is the observed child exit code, or `null` when unavailable. A spawn error or signal must not be diagnosed by inventing a code.
- **`spawnError`** reports a failure to start the process separately from its `stderr`.
- **`stdout`** and **`stderr`** are separate, bounded streams. `stderr` may contain warnings or ordinary diagnostics even when `exitCode` is zero.
- **`durationMs`** reports elapsed execution time, including for a running task.
- **`cwd`** and **`workspacePath`** identify the effective location using session aliases such as `@WORKSPACE` and `@CORE`; host filesystem paths are not returned in these metadata fields. **`projectId`** and **`sessionId`** identify where and for which session the command ran. Command output itself remains verbatim process data.

No PowerShell error preference or `chcp` command is injected. Direct execution preserves the executable's exit code; shell execution returns the shell's exit code. Explicit PowerShell scripts retain PowerShell semantics: with `$ErrorActionPreference = 'Stop'`, `Write-Error` can end the script before a subsequent `exit 17`, yielding a different code. When a PowerShell script must propagate a native program's result, write `exit $LASTEXITCODE` immediately after that program yourself.

### Example 1: Build in the Session Workspace
```json
{
  "name": "run_console",
  "arguments": {
    "command": "npm",
    "args": "run build",
    "cwd": "@WORKSPACE",
    "timeout_ms": 600000
  }
}
```
If this returns `running`, monitor the returned `commandId` with `manage_task`. Confirm the returned `cwd` matches the intended project before interpreting the final exit code.

### Example 2: Direct Execution with an Explicit Exit Code
```json
{
  "name": "run_console",
  "arguments": {
    "command": "node",
    "shell": false,
    "argv": ["-e", "console.error('diagnostic'); process.exit(23)"],
    "wait_ms": 0
  }
}
```
This task should eventually report `exitCode: 23` and process `success: false`. A script that writes the same diagnostic but exits zero succeeds; the diagnostic stream alone is not the verdict.

## [manage_task]
**Purpose:** Monitor, wait for, list, or terminate console processes belonging to the current session.
**When to use:** Use this after `run_console` returns a running task. Continue monitoring the same `commandId`; do not rerun the command just to collect its output.

### Parameters
- **`action`**: `status` (default), `wait`, `list`, or `terminate`.
- **`commandId`**: Required except for `list`; use the ID returned by `run_console`.
- **`wait_ms`**: For `wait` or `terminate`, pause the tool response for up to the requested time (default 1,000 ms, maximum 30,000 ms). The wait is event-driven: a process `close` returns the terminal snapshot immediately; the timer is only a maximum. Output received while the process is still running is partial data, so it does not authorize the agent to continue as if the task had finished. If `wait_ms` is supplied without `action`, the backend treats it as `wait`; `waitMs` is the camelCase compatibility alias. This does not change its execution deadline.
- **`stdoutCursor` / `stderrCursor`**: Omit to read the latest chunk from each stream. Supply a stream's preceding cursor to page forward, or `0` to request its earliest output still retained.
- **`maxOutputChars`**: Limit characters returned per output stream. Each stream retains at most 512 Ki characters; older output may no longer be available.

### Incremental Output
`stdoutCursor` and `stderrCursor` in the result are the next cursors to send. The corresponding `output.stdout` and `output.stderr` metadata contain `fromCursor`, `nextCursor`, `totalChars`, `bufferStart`, `droppedChars`, `truncated`, and `hasMore`. If `hasMore` is true, another read from `nextCursor` retrieves the next retained chunk. `bufferStart` identifies the oldest retained position; a cursor before it advances to that position and reports lost characters in `droppedChars`. A latest-chunk response is a bounded view, not a complete transcript.

### Example 1: Wait for a Known Task
```json
{
  "name": "manage_task",
  "arguments": {
    "action": "wait",
    "commandId": "<commandId returned by run_console>",
    "wait_ms": 1000,
    "maxOutputChars": 12000
  }
}
```

### Example 2: List Session Tasks
```json
{
  "name": "manage_task",
  "arguments": { "action": "list" }
}
```
`list` returns compact metadata summaries in `tasks`, without output logs. It does not acknowledge completion notifications. Retrieve a specific task with `status` or `wait` to inspect its logs.

### Example 3: Terminate a Task
```json
{
  "name": "manage_task",
  "arguments": {
    "action": "terminate",
    "commandId": "<commandId returned by run_console>"
  }
}
```

### Completion and Notifications
The task result separates the outer request `success` from the process `data.success`; inspect process `status`, `exitCode`, and `spawnError` as described under `run_console`. An initial `running` response and a later completion describe different points in the same task. An unobserved background completion is delivered once to its originating session. A terminal result returned by `run_console`, or by `status`, `wait`, or `terminate` for a specific task, acknowledges it and prevents a later duplicate completion notification. Listing task summaries does not acknowledge completions. Correlate by `commandId` and deduplicate terminal events by `eventId`.

Task tracking, retained logs, and completion notifications are in memory. The desktop UI receives a live completion signal so a running console indicator can settle even after the model stream ends. These process records are not available after an application restart.

On system resume, overdue scheduled tasks are retained and dispatched through the same serialized queue as manual runs. Dispatch waits for native power state, application/session readiness and, in development, a successful JavaScript response from the Vite provider-module endpoint. Unavailable infrastructure postpones dispatch until a resume/reconnect event or the next 30-second tick without incrementing execution counters or disabling a one-shot task. Provider code is imported at startup; the readiness probe does not import it again or reload the conversation.

Failures and cancellations after inference starts are recorded as errors and are not automatically replayed. Codex cancellation serialized over Electron IPC is recognized as cancellation and bypasses provider fallback. When diagnosing wake errors, compare the persisted message timestamp with the latest scheduler execution log; an old error visible in a restored conversation is not evidence of a new failure.

## [get_console_status]
**Purpose:** Compatibility alias for `manage_task` with `action: "status"`.
**When to use:** Existing callers can keep using this name to obtain current state and output. Prefer `manage_task` for new workflows, particularly waiting, listing, and termination. The same status/result semantics and stream cursor parameters apply.

### Example
```json
{
  "name": "get_console_status",
  "arguments": {
    "commandId": "<commandId returned by run_console>"
  }
}
```

## [project_status]
**Purpose:** Inspect the current session's effective workspace without executing commands or changing files.
**When to use:** Use this to establish which project or standalone workspace the file tools and console are targeting before choosing a build command.

The result reports aliased workspace paths and project association, top-level structure, `package.json` information and scripts when available, and evidence of dependency directories. Directory presence does not establish dependency health, and this inspection is not a successful build or a substitute for executing the relevant script in the verified `cwd`. Sessions without a project retain their configured generic workspace.

### Parameters
- **`cwd`**: Optional directory to inspect. Defaults to the session's workspace and uses the same resolution and validation as `run_console`.

### Example
```json
{
  "name": "project_status",
  "arguments": {}
}
```

## [delete_file]
**Purpose:** Delete a specific file from the workspace.
**When to use:** Use this to remove temporary files, old backups, or clean up unneeded logs.

### Example
```json
{
  "name": "delete_file",
  "arguments": {
    "filename": "temp_plan.md",
    "source": "workSpace"
  }
}
```

## [get_system_metrics]
**Purpose:** Get real-time OS metrics (CPU, Memory, Uptime, Hostname).
**When to use:** Use this if the user asks about their computer's performance or to check if the system is under heavy load.

### Example
```json
{
  "name": "get_system_metrics",
  "arguments": {}
}
```

## [send_telegram_message]
**Purpose:** Send a message to a configured Telegram chat.
**When to use:** Use this to notify the user of task completion if they are away, or to send alerts from scheduled tasks.

### Example
```json
{
  "name": "send_telegram_message",
  "arguments": {
    "text": "Task finished successfully! ðŸš€",
    "chat_id": "optional_id"
  }
}
```

## [add_scheduled_task]
**Purpose:** Program a proactive task for the agent to execute in the future (cron, interval, or once).
**When to use:** Use this to set up recurring checks, monitors, or reminders.

### Example
```json
{
  "name": "add_scheduled_task",
  "arguments": {
    "name": "Check Bitcoin Price",
    "prompt": "Use web_search to find bitcoin price and tell me if it went above 90k.",
    "scheduleType": "interval",
    "schedule": "60",
    "channel": "both",
    "mode": "agent"
  }
}
```

## [dynamic_widgets]
**Purpose:** Create, manage, and interact with independent frameless neural micro-applications (widgets).
**When to use:** Use this when the user asks for a dashboard, a floating tool, or a visual representation of data that stays on screen.

### Actions
- `create`: Instantiates a new widget with HTML content.
- `launch`: Reopens an existing widget.
- `update_code`: Modifies the HTML/JS/CSS of an existing widget.
- `read_code`: Inspects the code of an existing widget.
- `list`: Lists all created widgets.
- `delete`: Removes a widget.

### Example 1: Create
```json
{
  "name": "dynamic_widgets",
  "arguments": {
    "action": "create",
    "widget_id": "crypto-ticker",
    "description": "Visual real-time Bitcoin price tracker.",
    "html_content": "<html>...</html>",
    "width": 400,
    "height": 150,
    "always_on_top": true
  }
}
```

### Example 2: Update Code
```json
{
  "name": "dynamic_widgets",
  "arguments": {
    "action": "update_code",
    "widget_id": "crypto-ticker",
    "html_content": "<html>Updated code...</html>"
  }
}
```

### Example 3: Launch
```json
{
  "name": "dynamic_widgets",
  "arguments": {
    "action": "launch",
    "widget_id": "crypto-ticker"
  }
}
```

## [list_available_skills]
**Purpose:** Auto-discovery of new installed dynamic skills.
**When to use:** Use this if you are instructed to use a skill you don't know the parameters for, before using `instruction_booklet`.

### Example
```json
{
  "name": "list_available_skills",
  "arguments": {}
}
```

## [recall â€” init]
**Purpose:** Deploy the memory folder tree.
**When to use:** Only if the system says memory is not initialized.
```json
{
  "name": "recall",
  "arguments": { "command": "init" }
}
```

## [recall â€” synapse]
**Purpose:** Store a new long-term memory.
**When to use:** When the user shares personal preferences, workflows, feedback, or when you learn a successful strategy. Always include meaningful `tags`.

### Example
```json
{
  "name": "recall",
  "arguments": {
    "command": "synapse",
    "category": "Emotions",
    "subcategory": "Coping_Strategies",
    "data": "User prefers concise answers when stressed.",
    "tags": ["preferences", "communication"],
    "linked_to": [
      { "id": "mem_xxxxxxxx", "relation": "influences" }
    ]
  }
}
```

## [recall â€” recall]
**Purpose:** Search memories (returns direct hits, semantic graph neighbors, and current dynamic memory structure).
**When to use:** At the start of a session, or when the user asks "do you remember?".

### Example
```json
{
  "name": "recall",
  "arguments": {
    "command": "recall",
    "query": "communication preferences",
    "depth": 2
  }
}
```

## [recall â€” evoke]
**Purpose:** Navigate the memory folder structure or read a specific memory file directly.
**When to use:** Use this after `recall` if you want to see all memories inside a specific subfolder, or if you need to read the full content of a memory file via its ID or relative path. Accepts a folder path (e.g. `User_Model/Active_Context`) to list contents, or a memory ID (`mem_xxxxxx`) to read it.

### Example (List Folder)
```json
{
  "name": "recall",
  "arguments": {
    "command": "evoke",
    "target": "User_Model/Active_Context"
  }
}
```

### Example (Read Memory)
```json
{
  "name": "recall",
  "arguments": {
    "command": "evoke",
    "target": "mem_a1b2c3d4"
  }
}
```

## [recall â€” refresh]
**Purpose:** Update an existing memory with new information.
**When to use:** When a preference changes or you have new data to add to an old memory.

### Example
```json
{
  "name": "recall",
  "arguments": {
    "command": "refresh",
    "query": "mem_xxxxxxxx",
    "data": "Updated context..."
  }
}
```

## [recall â€” amnesia]
**Purpose:** Delete a memory entirely.
**When to use:** When the user explicitly asks to forget something.

### Example
```json
{
  "name": "recall",
  "arguments": {
    "command": "amnesia",
    "query": "mem_xxxxxxxx"
  }
}
```

## [recall â€” link]
**Purpose:** Connect two existing memories with a typed relation.
**When to use:** When you notice two distinct memories are highly related to form a better semantic graph.

### Example
```json
{
  "name": "recall",
  "arguments": {
    "command": "link",
    "from_id": "mem_xxxxxxxx",
    "to_id": "mem_yyyyyyyy",
    "relation": "expands"
  }
}
```

## [recall â€” nexus]
**Purpose:** Get an overview of all stored memories.
**When to use:** To see what categories of memory you hold.

### Example
```json
{
  "name": "recall",
  "arguments": { "command": "nexus" }
}
```
## [recall — health]
**Purpose:** Self-diagnostic and integrity check of the neural memory system.
**When to use:** Use this periodically or after major updates to ensure the memory graph is healthy. It checks for:
- **Dangling entries**: Index entries without corresponding markdown files.
- **Orphan files**: Markdown files not present in the index.
- **Broken links**: Semantic edges pointing to non-existent memory IDs.

### Example
```json
{
  "name": "recall",
  "arguments": { "command": "health" }
}
```

## [compute]
**Purpose:** Advanced scientific and symbolic calculator using SymPy.
**When to use:** Use this when you need precise arithmetic (arbitrary precision), algebraic expression simplification, factoring, expansion, differentiation, integration, or to solve single equations and systems of equations.

### Parameters
- **`expression`**: (Required) The mathematical expression, equation, or list of equations (as a JSON array or list string) to solve/calculate.
- **`mode`**: (Optional) The math operation: `"evaluate"` (default, numeric evaluation), `"solve"` (solve for a variable), `"simplify"` (algebraic simplification), `"differentiate"` (derivative), `"integrate"` (integral), `"factor"` (factorize), or `"expand"` (expand expression).
- **`variables`**: (Optional) A dictionary mapping variable names to their values or sub-expressions for substitution (e.g. `{"x": 2, "y": "z + 1"}`).
- **`variable`**: (Optional) The target variable to solve, differentiate, or integrate for (defaults to `"x"`).

### Example 1: Numeric Evaluation
```json
{
  "name": "compute",
  "arguments": {
    "expression": "2 * sin(pi/4)^2",
    "mode": "evaluate"
  }
}
```

### Example 2: Solving equations
```json
{
  "name": "compute",
  "arguments": {
    "expression": "x^2 - 5x + 6 = 0",
    "mode": "solve",
    "variable": "x"
  }
}
```

### Example 3: Systems of Equations
```json
{
  "name": "compute",
  "arguments": {
    "expression": "[x + y = 3, x - y = 1]",
    "mode": "solve"
  }
}
```
