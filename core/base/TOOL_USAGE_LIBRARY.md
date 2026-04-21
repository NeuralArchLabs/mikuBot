# 📚 Toolkit Snippets Library (Neural JIT)

This file contains valid JSON code snippets for each tool. The system extracts these blocks automatically when the agent makes syntax or parameter errors.

## [read_file]
```json
{
  "name": "read_file",
  "arguments": {
    "filename": "filename.md",
    "source": "workSpace"
  }
}
```

## [update_file]
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

## [undo_patch]
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
```json
{
  "name": "list_files",
  "arguments": {
    "source": "workSpace"
  }
}
```

## [search_files]
```json
{
  "name": "search_files",
  "arguments": {
    "query": "pattern or text to search for",
    "source": "workSpace"
  }
}
```

## [get_file_outline]
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
```json
{
  "name": "web_search",
  "arguments": {
    "query": "claudecode vs antigravity comparison",
    "category": "it",
    "search_depth": "advanced"
  }
}
```

## [web_research]
```json
{
  "name": "web_research",
  "arguments": {
    "query": "Microfrontends arch with Module Federation",
    "categories": ["it", "general"],
    "max_sites": 3
  }
}
```

## [deep_research]
```json
{
  "name": "deep_research",
  "arguments": {
    "topic": "Rust memory safety in embedded systems",
    "categories": ["it", "science", "general"],
    "target_language": "both"
  }
}
```

## [read_url]
```json
{
  "name": "read_url",
  "arguments": {
    "url": "https://example.com/article"
  }
}
```

## [run_console]
```json
{
  "name": "run_console",
  "arguments": {
    "command": "npm",
    "args": "install package_name",
    "cwd": ""
  }
}
```

## [send_telegram_message]
```json
{
  "name": "send_telegram_message",
  "arguments": {
    "text": "Message to send to the bot",
    "chat_id": "optional_id"
  }
}
```


## [get_crypto_price]
```json
{
  "name": "get_crypto_price",
  "arguments": {
    "coin_id": "bitcoin",
    "vs_currency": "usd"
  }
}
```

## [add_scheduled_task]
```json
{
  "name": "add_scheduled_task",
  "arguments": {
    "name": "Check Bitcoin Price",
    "prompt": "Use get_crypto_price for bitcoin and tell me if it went above 90k.",
    "scheduleType": "interval",
    "schedule": "60",
    "channel": "both",
    "mode": "agent"
  }
}
```

## [miku_clock]
```json
{
  "name": "miku_clock",
  "arguments": {
    "format": "24h"
  }
}
```

## [list_available_skills]
```json
{
  "name": "list_available_skills",
  "arguments": {}
}
```

## [gmail_imap]
```json
{
  "name": "gmail_imap",
  "arguments": {
    "email": "your_email@gmail.com",
    "app_password": "abcd efgh ijkl mnop",
    "action": "list",
    "limit": 5
  }
}
```

## [delete_file]
```json
{
  "name": "delete_file",
  "arguments": {
    "filename": "temp_plan.md",
    "source": "workSpace"
  }
}
```

## [api_fetcher]
```json
{
  "name": "api_fetcher",
  "arguments": {
    "url": "https://api.example.com/v1/user",
    "method": "POST",
    "body": { "id": 123 },
    "headers": { "Authorization": "Bearer TOKEN" }
  }
}
```

## [get_system_metrics]
```json
{
  "name": "get_system_metrics",
  "arguments": {}
}
```

## [get_git_info]
```json
{
  "name": "get_git_info",
  "arguments": {}
}
```

## [recall — init]
```json
{
  "name": "recall",
  "arguments": {
    "command": "init"
  }
}
```

## [recall — synapse]
```json
{
  "name": "recall",
  "arguments": {
    "command": "synapse",
    "category": "Emotions",
    "subcategory": "Coping_Strategies",
    "data": "User calms down before stressful events by listening to classical music for 10 minutes.",
    "tags": ["anxiety", "music", "coping", "stress"],
    "linked_to": [
      { "id": "mem_xxxxxxxx", "relation": "caused_by" }
    ]
  }
}
```

## [recall — recall]
```json
{
  "name": "recall",
  "arguments": {
    "command": "recall",
    "query": "how does the user handle stress",
    "depth": 2
  }
}
```

## [recall — refresh]
```json
{
  "name": "recall",
  "arguments": {
    "command": "refresh",
    "query": "mem_xxxxxxxx",
    "data": "Updated content with new information learned.",
    "tags": ["updated", "tag"]
  }
}
```

## [recall — amnesia]
```json
{
  "name": "recall",
  "arguments": {
    "command": "amnesia",
    "query": "mem_xxxxxxxx"
  }
}
```

## [recall — link]
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

## [recall — nexus]
```json
{
  "name": "recall",
  "arguments": {
    "command": "nexus"
  }
}
```
