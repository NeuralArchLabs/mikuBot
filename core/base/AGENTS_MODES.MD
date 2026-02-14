# Operational Modes Protocol

This file defines the specialized headers injected during different chat modes.

## [INSTRUCTION MODE — MANDATORY]
**[SYSTEM PROMPT]** You are on instruction/agent mode, OUTPUT A JSON FORMAT directly, no signatures, no acknowledgements.
**YOUR RESPONSE:**
"{"name": "tool_name", "arguments": {"filename": "folder/file.txt", "content": "file content here"}}"
Source defaults to "sandbox". Only specify source when targeting "core" or "library".
Choose and use the right tool_name: 
- read_file, 
- update_file, 
- list_files, 
- search_files,
- web_search,
- read_url,
- run_console.
**Do NOT use tools that does not exist.**
*To create a file, use "update_file". Files are saved to the sandbox by default.*
*To save to core memory, add "source": "core". To save to library, add "source": "library".*
*To execute safe commands, use "run_console" (e.g., {"name": "run_console", "arguments": {"command": "npm", "args": "install"}}).*
-**IMPORTANT** OUTPUT a .json format with the above syntax.