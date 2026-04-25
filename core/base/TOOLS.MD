# TOOLS.md - Workspace Cartography & Toolkit

## 🗺️ System Topography

This file defines the rules for interacting with the file system and available tools. mikuBot must use the base paths configured in the environment to ensure precision.

### 📍 Mount Points

The system uses the following internal aliases to refer to configured folders:
- **@CORE:** Identity and memory folder (SOUL.md, ACTIVE_CONTEXT.md).
- **@DEV:** Development projects folder.
- **@MAP:** Reference library and documentation.
- **@WORKSPACE:** Default working directory for tests and temporary outputs.
- **@ROOT:** Project Root directory (where `config.json` lives).

Actual paths are injected dynamically according to Armando's configuration. Do not assume fixed absolute paths unless required for a specific system command.

## ⚙️ Command Generation Rules (CLI Protocol)

When mikuBot suggests terminal commands, it must adhere to the following:

1.  **Navigation:** Use paths relative to the current mount point or request confirmation if you need to move between drives.
2.  **Windows Syntax:**
    * Use double quotes `""` for paths with spaces.
    * Commands are executed over PowerShell / CMD depending on availability.
3.  **Context:** The agent starts by default in the @WORKSPACE directory.

## 🛠️ Stack & Environment
- **Operating System:** Windows 11.
- **Development Tools:** Antigravity, Jules, Google AI Studio.
- **Package Manager:** npm / pip / maven (according to project).
- **Git:** Installed and configured globally.

## 🖥️ Console Access (`run_console`)

The `run_console` tool provides workspace console access. **Security restrictions apply:**

### Allowed Commands
`git`, `node`, `npm`, `npx`, `ls`, `dir`, `cat`, `type`, `echo`, `mkdir`, `cd`, `pwd`, `grep`, `find`, `head`, `tail`, `wc`, `tree`, `tsc`, `python`, `pip`, `curl`, `wget`, `gh`, `sqlite3`, `awk`, `sed`, `perl`, `jq`, `ping`

### Blocked Patterns
The following are **NEVER** allowed in arguments:
- `&&`, `||`, `;` (command chaining)
- `|` (piping)
- `` ` `` or `$(` (subshell execution)
- `../` or `..\` (path traversal)
- `rm -rf` or `rm -R` (recursive delete)

### Usage Format
```json
{
  "name": "run_console",
  "arguments": {
    "command": "npm",
    "args": "install lodash",
    "cwd": ""
  }
}
```

> ⚠️ **HIGH SECURITY TOOLS:** All console commands (`run_console`), batch deletions (`batch_operation: delete`), and file deletions (`delete_file`) require **mandatory manual approval** from the user, even in Agent Mode or Remote sessions.

## 📂 File Management (`read_file`, `update_file`, `patch_file`)

### `read_file`
Read content from any mount point.
- **Param:** `filename` (path/to/file.ext)
- **Param:** `source` (workSpace, core, library)

### `update_file`
Create or overwrite files. Directories are created automatically.
- **Param:** `filename`, `content`, `source`

### `patch_file` (Version 2.0)
Efficiently edit files using various strategies. Always creates a `.bak` backup.
- **Param:** `filename`, `find`, `replace`, `strategy` (auto, exact, lineNumber, fuzzy, regex).
- **Supports:** `patches` array for multiple edits in a single call.
- **Fuzzy Strategy:** Matches a line containing `find`. Highly resilient to minor whitespace changes.
- **Note:** `find` must be a substantial block for `auto` strategy. Use `lineNumber` for precise edits.

### `undo_patch`
Reverts the last patch to a file using the `.bak` file.
- **Param:** `filename`

### `delete_file`
Delete a file or clear @CORE/tasks.md once completed.
- **Param:** `filename`, `source`

## 🔍 Discovery & Search (`list_files`, `search_files`)

### `list_files`
List all files in a mount point. Use ONLY when lost.
- **Param:** `source`

### `search_files`
High-performance native search across all files in a folder.
- **Param:** `query` (The text to find).
- **Param:** `filePattern` (e.g., "*.js", "!node_modules/*").
- **Param:** `caseSensitive` (boolean).
- **Param:** `searchPath` (sub-folder to start search).

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
Quick superficial search. Returns short titles and snippets.
- **Param:** `query`
- **Param:** `category` (general, images, videos, news, maps, shopping, it, social)
- **Param:** `search_depth` (basic, advanced)

### Tier 2: `read_url` [Base Tool]
Directly read a URL to extract textual content and clean HTML.

### Tier 3: `web_research` / `deep_research` [Skills]
Deep research with auditing and multiple sources. Avoids hallucinations.

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
- **`deep_research`**: Multi-language technical investigation with multi-category audit.
- **`web_research`**: Content extraction from multiple sources using diverse search categories.
- **`list_available_skills`**: Auto-discovery of new installed skills.
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

### AgentGrowth — Your own memory, not the user's:
Use `AgentGrowth` subcategories to store **your own** evolution as an agent:
- After being corrected → `AgentGrowth/Feedback_Applied`
- After a complex task → `AgentGrowth/Lessons_Learned` or `AgentGrowth/Successful_Strategies`
- When you notice a pattern in how this user works → `AgentGrowth/User_Adaptations/Workflow_Preferences`
- When you identify a capability gap → `AgentGrowth/Knowledge_Gaps`


---
*Note: This file serves as a spatial and technical reference. The system will automatically inject these rules if failures are detected.*