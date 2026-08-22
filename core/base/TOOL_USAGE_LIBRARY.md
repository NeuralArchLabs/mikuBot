# Toolkit Snippets Library (Neural JIT)

This file contains valid JSON code snippets, contextual use cases, and parameter explanations for each tool in the MikuBot ecosystem. It is used by the `instruction_booklet` skill to provide detailed manuals to the agent dynamically.

## [self_aware]
**Purpose:** Deep system architecture, capabilities, and UI navigation instructions.

### Your Core Capabilities & Environment
- **Environment:** You execute natively inside **mikuBot/mikuCentral Dashboard**, a Windows 10/11 Desktop application (Electron, React 19).
- **Autonomy:** You support persistent background execution across multiple sessions.
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
- **Mode Toggles (Auto/Safe/Debug):** Located directly in the chat input area.

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
**Purpose:** Efficiently edit files using various strategies without overwriting the entire file. Always creates a `.bak` backup.
**When to use:** Use this for partial file modifications, bug fixes, or injecting new functions into existing code.

### Strategies
- **`auto`**: The default. Finds a block and replaces it. Requires the `find` block to be substantial and exact (including whitespaces).
- **`lineNumber`**: The safest. Replaces a specific line number.
- **Multi-patching**: Use the `patches` array for multiple non-contiguous edits in a single call.

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
- **`recursive`**: Set to `true` to get all files in all nested folders.

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
**Purpose:** High-performance native search across all files in a folder using a text query.
**When to use:** Extremely useful to find where a function is defined, where an API is called, or to locate specific text across the whole project.

### Parameters
- **`query`**: The exact string to search for.
- **`filePattern`**: (Optional) Glob pattern like `*.js` or `!node_modules/*` to narrow down results.
- **`searchPath`**: (Optional) Subfolder to start searching from.
- **`caseSensitive`**: (Optional) Boolean.

### Example
```json
{
  "name": "search_files",
  "arguments": {
    "query": "function calculateTotal",
    "source": "workSpace",
    "filePattern": "*.ts",
    "searchPath": "src/utils",
    "caseSensitive": true
  }
}
```

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
**Purpose:** Perform a quick superficial search using SearXena (Tier 1 Research). Returns short titles and snippets.
**When to use:** Use this when you need a quick fact, recent news, or general context without reading full articles.

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

## [web_research]
**Purpose:** Intelligent web research skill (Tier 3) that searches and automatically extracts and analyzes the true content of the most relevant sites.
**When to use:** Use this for complex topics where you need accurate information from multiple sources to avoid hallucinations.

### Example
```json
{
  "name": "web_research",
  "arguments": {
    "query": "Microfrontends arch with Module Federation",
    "categories": ["general", "news"],
    "max_sites": 3
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
**Purpose:** Execute commands in the system terminal (PowerShell/CMD).
**Security:** Behavior depends on the current Mode. In Chat Mode, "LAX" restrictions apply (whitelisted commands). In Agent/Instruction Mode, execution is liberated (any command, all shell operators). **High-risk commands** always require manual approval with a red warning.
**When to use:** Use this for build tasks, git operations, environment checks, or any system-level command.

### Parameters
- **`command`**: The binary to execute (e.g., `"npm"`, `"git"`, `"ls"`).
- **`args`**: Arguments for the command (e.g., `"install"`, `"status"`, `"-rf dist && echo done"`).
- **`WaitMsBeforeAsync`**: (Optional) ms to wait before backgrounding the task.
- **`commandId`**: (Optional) Unique ID for tracking.

### Example 1: Sync Execution
```json
{
  "name": "run_console",
  "arguments": {
    "command": "npm",
    "args": "test"
  }
}
```

### Example 2: Async/Background Execution
```json
{
  "name": "run_console",
  "arguments": {
    "command": "npm",
    "args": "run dev",
    "WaitMsBeforeAsync": 500,
    "commandId": "dev_server_1"
  }
}
```

## [get_console_status]
**Purpose:** Check the status and output of a background task.
**When to use:** Use this to poll for results of a long-running task that was backgrounded via `run_console`.

### Example
```json
{
  "name": "get_console_status",
  "arguments": {
    "commandId": "dev_server_1"
  }
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
