/**
 * ──────────────────────────────────────────────────────────────────────
 *  Tool Call Normalizer — "Hallucination Dictionary" & Recovery Engine
 * ──────────────────────────────────────────────────────────────────────
 *
 *  Local LLMs (Gemma 3, Qwen, DeepSeek-R1, Llama, etc.) frequently
 *  hallucinate tool names, use wrong JSON keys, emit Pythonic syntax,
 *  or wrap valid JSON in conversational text / XML tags.
 *
 *  This module implements a cascading normalizer that:
 *    1.  Maps hallucinated tool names → real tool names (fuzzy dictionary)
 *    2.  Normalizes JSON key variations (function→name, args→arguments …)
 *    3.  Fixes Pythonic syntax (single quotes, True/False/None, trailing commas)
 *    4.  Strips XML ghost tags (<tool_call>, <function_call>, etc.)
 *    5.  Strips extra parameters not in the schema
 *    6.  Detects Python-style function call syntax (fn_name({...}))
 *
 *  It is designed to NEVER throw; every function returns the best-effort
 *  result or a harmless fallback.
 * ──────────────────────────────────────────────────────────────────────
 */

import { ToolCall, ToolDefinition } from '../types';

/* ═══════════════════════════════════════════════════════════════════════
   §1  HALLUCINATION DICTIONARY — Name Mapping
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Maps every known hallucinated tool name → canonical tool name.
 * Built from Research3 "Table 1" + observed patterns in Gemma 3, Qwen, Llama, DeepSeek.
 *
 * The keys are always lowercase for case-insensitive lookup.
 */
const TOOL_NAME_ALIASES: Record<string, string> = {
    // ── read_file variants ──────────────────────────────────────────
    'readfile': 'read_file',
    'read_file': 'read_file',
    'ReadFile': 'read_file',
    'open_file': 'read_file',
    'openfile': 'read_file',
    'open': 'read_file',
    'cat': 'read_file',
    'get_file': 'read_file',
    'getfile': 'read_file',
    'file_read': 'read_file',
    'read_file_content': 'read_file',
    'read_content': 'read_file',
    'load_file': 'read_file',
    'view_file': 'read_file',
    'show_file': 'read_file',
    'read_document': 'read_file',
    'get_file_content': 'read_file',
    'read': 'read_file',

    // ── update_file variants ────────────────────────────────────────
    'updatefile': 'update_file',
    'update_file': 'update_file',
    'UpdateFile': 'update_file',
    'write_file': 'update_file',
    'writefile': 'update_file',
    'save_file': 'update_file',
    'savefile': 'update_file',
    'create_file': 'update_file',
    'createfile': 'update_file',
    'write_to_file': 'update_file',
    'edit_file': 'update_file',
    'modify_file': 'update_file',
    'put_file': 'update_file',
    'file_write': 'update_file',
    'file_update': 'update_file',
    'overwrite_file': 'update_file',
    'append_file': 'update_file',
    'write': 'update_file',
    'save': 'update_file',

    // ── list_files variants ─────────────────────────────────────────
    'listfiles': 'list_files',
    'list_files': 'list_files',
    'ListFiles': 'list_files',
    'ls': 'list_files',
    'dir': 'list_files',
    'list_directory': 'list_files',
    'listdir': 'list_files',
    'list_dir': 'list_files',
    'get_files': 'list_files',
    'show_files': 'list_files',
    'directory_list': 'list_files',
    'browse_files': 'list_files',
    'file_list': 'list_files',

    // ── search_files variants ───────────────────────────────────────
    'searchfiles': 'search_files',
    'search_files': 'search_files',
    'SearchFiles': 'search_files',
    'file_search': 'search_files',
    'filesearch': 'search_files',
    'grep': 'search_files',
    'find_file': 'search_files',
    'find_files': 'search_files',
    'search_in_files': 'search_files',
    'search_content': 'search_files',
    'find_in_files': 'search_files',
    'search': 'search_files',

    // ── web_search variants ─────────────────────────────────────────
    'websearch': 'web_search',
    'web_search': 'web_search',
    'WebSearch': 'web_search',
    'google_search': 'web_search',
    'googlesearch': 'web_search',
    'GoogleSearch': 'web_search',
    'google_query': 'web_search',
    'bing_search': 'web_search',
    'internet_search': 'web_search',
    'search_web': 'web_search',
    'searchweb': 'web_search',
    'browser': 'web_search',
    'browse': 'web_search',
    'browse_web': 'web_search',
    'online_search': 'web_search',
    'search_online': 'web_search',
    'query_web': 'web_search',

    // ── read_url variants ───────────────────────────────────────────
    'readurl': 'read_url',
    'read_url': 'read_url',
    'ReadUrl': 'read_url',
    'get_url': 'read_url',
    'geturl': 'read_url',
    'fetch_url': 'read_url',
    'fetch': 'read_url',
    'visit_page': 'read_url',
    'browse_website': 'read_url',
    'scrape_url': 'read_url',
    'scrape_page': 'read_url',
    'extract_text': 'read_url',
    'read_page': 'read_url',
    'visit_url': 'read_url',
    'open_url': 'read_url',
    'load_url': 'read_url',
    'get_page': 'read_url',
    'summarize_page': 'read_url',
    'ask_page': 'read_url',

    // ── run_console variants ────────────────────────────────────────
    'runconsole': 'run_console',
    'run_console': 'run_console',
    'RunConsole': 'run_console',
    'shell_execute': 'run_console',
    'execute_shell': 'run_console',
    'run_shell': 'run_console',
    'run_command': 'run_console',
    'runcommand': 'run_console',
    'RunCommand': 'run_console',
    'cmd': 'run_console',
    'bash': 'run_console',
    'terminal': 'run_console',
    'exec': 'run_console',
    'execute': 'run_console',
    'os_command': 'run_console',
    'system_command': 'run_console',
    'subprocess_run': 'run_console',
    'eval': 'run_console',
    'shell': 'run_console',
    'console': 'run_console',
    'execute_command': 'run_console',
    'code_execution': 'run_console',
    'run_code': 'run_console',
};

/* ═══════════════════════════════════════════════════════════════════════
   §2  JSON KEY NORMALIZATION
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Models hallucinate different JSON key names for the call structure.
 * This maps every known variant to the expected canonical key.
 */
const KEY_ALIASES: Record<string, string> = {
    // Name field variants
    'function': 'name',
    'func': 'name',
    'tool': 'name',
    'tool_name': 'name',
    'tool_code': 'name',
    'action': 'name',
    'command': 'name',
    'method': 'name',

    // Arguments field variants
    'args': 'arguments',
    'params': 'arguments',
    'parameters': 'arguments',
    'input': 'arguments',
    'inputs': 'arguments',
    'kwargs': 'arguments',
    'data': 'arguments',
    'payload': 'arguments',
    'body': 'arguments',
    'options': 'arguments',
};

/* ═══════════════════════════════════════════════════════════════════════
   §3  ARGUMENT KEY NORMALIZATION (per-tool)
   ═══════════════════════════════════════════════════════════════════════

   Models sometimes use slightly different argument names.
   For example: "file" instead of "filename", "text" instead of "content", etc.
 */

const ARG_KEY_ALIASES: Record<string, Record<string, string>> = {
    read_file: {
        'file': 'filename',
        'filepath': 'filename',
        'file_path': 'filename',
        'path': 'filename',
        'name': 'filename',
        'file_name': 'filename',
    },
    update_file: {
        'file': 'filename',
        'filepath': 'filename',
        'file_path': 'filename',
        'path': 'filename',
        'name': 'filename',
        'file_name': 'filename',
        'text': 'content',
        'body': 'content',
        'data': 'content',
        'value': 'content',
        'file_content': 'content',
    },
    list_files: {
        'folder': 'source',
        'directory': 'source',
        'dir': 'source',
        'target': 'source',
        'location': 'source',
        'path': 'source',
    },
    search_files: {
        'search': 'query',
        'term': 'query',
        'pattern': 'query',
        'keyword': 'query',
        'text': 'query',
        'q': 'query',
        'search_query': 'query',
        'search_term': 'query',
        'folder': 'source',
        'directory': 'source',
        'dir': 'source',
    },
    web_search: {
        'search': 'query',
        'term': 'query',
        'q': 'query',
        'search_query': 'query',
        'search_term': 'query',
        'keyword': 'query',
        'keywords': 'query',
        'text': 'query',
        'depth': 'search_depth',
    },
    read_url: {
        'link': 'url',
        'href': 'url',
        'page': 'url',
        'website': 'url',
        'address': 'url',
        'page_url': 'url',
        'target_url': 'url',
        'site': 'url',
    },
    run_console: {
        'cmd': 'command',
        'shell': 'command',
        'exec': 'command',
        'run': 'command',
        'instruction': 'command',
        'script': 'command',
        'arguments': 'args',
        'parameters': 'args',
        'params': 'args',
        'flags': 'args',
        'options': 'args',
        'dir': 'cwd',
        'directory': 'cwd',
        'path': 'cwd',
        'working_dir': 'cwd',
        'workdir': 'cwd',
    },
};

/* ═══════════════════════════════════════════════════════════════════════
   §4  SECURITY — Blocked Hallucinated Tool Names
   ═══════════════════════════════════════════════════════════════════════

   Tools that should NEVER execute even if the model invents them.
   These are common injection/privilege-escalation hallucinations.
 */

const BLOCKED_TOOL_NAMES = new Set([
    'system_reset', 'reset_system', 'grant_access', 'revoke_access',
    'update_system_prompt', 'modify_prompt', 'set_instructions',
    'delete_all', 'rm_rf', 'format', 'shutdown', 'reboot',
    'export_database', 'drop_database', 'sql_query', 'execute_sql',
    'send_email', 'gmail_search', 'upload_file', 'download_file',
    'delete_file', 'remove_file', 'curl', 'wget', 'install',
    'sudo', 'chmod', 'chown', 'kill', 'pkill', 'passwd',
]);

/**
 * These are hallucinated tool names that models use when they want to "finish".
 * We map these to null so the recovery pipeline treats it as "no tool", 
 * which triggers our completion summaries.
 */
const COMPLETion_TOOL_HALLUCINATIONS = new Set([
    'final_summary', 'summary', 'task_complete', 'job_done', 'done', 'exit', 'finish'
]);

/* ═══════════════════════════════════════════════════════════════════════
   §5  LAYER 1 — Pythonic Syntax Fixer
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Fixes common "Pythonic Drift" in model output:
 *  - Single quotes → double quotes (careful around apostrophes)
 *  - True/False → true/false
 *  - None → null
 *  - Trailing commas in arrays/objects
 *  - Python-style # comments
 */
export function fixPythonicJson(raw: string): string {
    let s = raw;

    // Remove Python-style comments (# ...)
    s = s.replace(/#[^\n]*/g, '');

    // Replace Python booleans and None with JSON equivalents
    // Only match when preceded/followed by JSON structural chars or whitespace
    s = s.replace(/\bTrue\b/g, 'true');
    s = s.replace(/\bFalse\b/g, 'false');
    s = s.replace(/\bNone\b/g, 'null');

    // Convert single-quoted strings to double-quoted
    // Strategy: replace single quotes that act as string delimiters (around JSON keys/values)
    // This regex is deliberately conservative to avoid breaking apostrophes in natural text
    s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (match, inner) => {
        // Escape any unescaped double quotes inside
        const escaped = inner.replace(/(?<!\\)"/g, '\\"');
        return `"${escaped}"`;
    });

    // Remove trailing commas before } or ]
    s = s.replace(/,\s*([}\]])/g, '$1');

    return s;
}

/* ═══════════════════════════════════════════════════════════════════════
   §6  LAYER 2 — XML/Tag Stripper
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Strips known XML-like ghost tags that Gemma 3 / FunctionGemma emit:
 *   <tool_call>, <function_call>, <TOOLCALL>, <call>, <tool_use>,
 *   <tool_code>, </...>, <|tool_call|>, <start_function_call>, etc.
 *
 * Returns the inner content (hopefully valid JSON).
 */
export function stripXmlTags(text: string): string {
    // List of known tag names (case-insensitive)
    const tagNames = [
        'tool_call', 'function_call', 'TOOLCALL', 'call', 'tool_use',
        'tool_code', 'function', 'tool_response', 'tool_result',
        'start_function_call', 'end_function_call',
    ];

    let cleaned = text;

    // Strip matching open/close tags and extract content
    for (const tag of tagNames) {
        const re = new RegExp(
            `<\\|?${tag}\\|?>([\\s\\S]*?)<\\|?\\/?${tag}\\|?>`,
            'gi'
        );
        cleaned = cleaned.replace(re, '$1');
    }

    // Strip any remaining orphan tags
    for (const tag of tagNames) {
        const reOrphan = new RegExp(`<\\|?\\/?${tag}\\|?>`, 'gi');
        cleaned = cleaned.replace(reOrphan, '');
    }

    return cleaned.trim();
}

/* ═══════════════════════════════════════════════════════════════════════
   §7  LAYER 3 — Conversational Wrapper Remover
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Strips the conversational text that often wraps tool calls:
 *   "Sure, I can help you! Here's the tool call: {...} Hope this helps!"
 *
 * Also strips <think>...</think> blocks from reasoning models.
 */
export function stripConversationalWrapper(text: string): string {
    let s = text;

    // Remove <think>...</think> blocks
    s = s.replace(/<think>[\s\S]*?<\/think>/gi, '');

    // Remove markdown code fences and extract JSON content
    const fenceMatch = s.match(/```(?:json|JSON|python|PYTHON)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
        s = fenceMatch[1].trim();
    }

    return s.trim();
}

/* ═══════════════════════════════════════════════════════════════════════
   §8  CORE — normalizeToolName
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Given a possibly-hallucinated tool name, returns the canonical name
 * or null if it's not a valid/known tool at all.
 *
 * Lookup order:
 *  1. Exact match in allowlist (fast path)
 *  2. Case-insensitive match in alias dictionary
 *  3. Blocked tool detection → returns { blocked: true }
 */
export function normalizeToolName(
    rawName: string,
    validToolNames: string[]
): { canonical: string | null; blocked: boolean; original: string } {
    const clean = rawName.trim();
    const lower = clean.toLowerCase();

    // Fast path: exact match to a real tool
    if (validToolNames.includes(clean)) {
        return { canonical: clean, blocked: false, original: clean };
    }

    // Check the alias dictionary (case-insensitive)
    const alias = TOOL_NAME_ALIASES[lower] || TOOL_NAME_ALIASES[clean];
    if (alias && validToolNames.includes(alias)) {
        return { canonical: alias, blocked: false, original: clean };
    }

    // Check if this is a completion hallucination
    if (COMPLETion_TOOL_HALLUCINATIONS.has(lower)) {
        return { canonical: null, blocked: false, original: clean };
    }

    // No match found
    return { canonical: null, blocked: false, original: clean };
}

/* ═══════════════════════════════════════════════════════════════════════
   §9  CORE — normalizeJsonKeys
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Normalizes the top-level JSON keys of a parsed tool call object.
 *
 * Input examples that all map to { name, arguments }:
 *   { "function": "read_file", "args": {...} }
 *   { "tool_name": "read_file", "parameters": {...} }
 *   { "tool_code": "read_file", "kwargs": {...} }
 *   { "name": "read_file", "arguments": {...} }  (already correct)
 */
export function normalizeJsonKeys(obj: Record<string, any>): { name: string; arguments: Record<string, any> } | null {
    let name: string | undefined;
    let args: Record<string, any> | undefined;

    for (const [key, value] of Object.entries(obj)) {
        const canonical = KEY_ALIASES[key] || key;

        if (canonical === 'name' && typeof value === 'string' && !name) {
            name = value;
        } else if (canonical === 'arguments' && typeof value === 'object' && value !== null && !args) {
            args = value;
        }
    }

    if (!name) return null;

    return { name, arguments: args || {} };
}

/* ═══════════════════════════════════════════════════════════════════════
   §10  CORE — normalizeArgKeys
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Normalizes argument keys for a specific tool.
 * E.g., for read_file: { "file": "x.md" } → { "filename": "x.md" }
 */
export function normalizeArgKeys(
    toolName: string,
    args: Record<string, any>
): Record<string, any> {
    const aliases = ARG_KEY_ALIASES[toolName];
    const normalized: Record<string, any> = {};

    for (const [key, value] of Object.entries(args)) {
        const canonicalKey = aliases?.[key] || key;
        normalized[canonicalKey] = value;
    }

    return normalizeArgValues(toolName, normalized);
}

/**
 * Normalizes argument VALUES (e.g., mapping "src" -> "sandbox")
 */
function normalizeArgValues(toolName: string, args: Record<string, any>): Record<string, any> {
    const normalized = { ...args };

    // ── Fix 'source' Enum Hallucinations ────────────────────────────
    if (normalized.source) {
        const s = String(normalized.source).toLowerCase().trim();
        const sandboxAliases = ['src', './src', 'sandbox', 'root', '.', './', 'current', 'workdir', 'workspace', 'project'];
        const coreAliases = ['core', 'brain', 'identity', 'system'];
        const libraryAliases = ['library', 'extra', 'docs', 'reference'];

        if (sandboxAliases.includes(s)) normalized.source = 'sandbox';
        else if (coreAliases.includes(s)) normalized.source = 'core';
        else if (libraryAliases.includes(s)) normalized.source = 'library';
    }

    return normalized;
}

/* ═══════════════════════════════════════════════════════════════════════
   §11  CORE — stripUnknownArgs
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Removes argument keys that don't exist in the tool's parameter schema.
 * This handles the "Parameter Hallucination" pattern (Research3 §2.2.1).
 */
export function stripUnknownArgs(
    toolName: string,
    args: Record<string, any>,
    tools: ToolDefinition[]
): { cleaned: Record<string, any>; stripped: string[] } {
    const toolDef = tools.find(t => t.function.name === toolName);
    if (!toolDef) return { cleaned: args, stripped: [] };

    const knownKeys = new Set(Object.keys(toolDef.function.parameters.properties || {}));
    const cleaned: Record<string, any> = {};
    const stripped: string[] = [];

    for (const [key, value] of Object.entries(args)) {
        if (knownKeys.has(key)) {
            cleaned[key] = value;
        } else {
            stripped.push(key);
        }
    }

    return { cleaned, stripped };
}

/* ═══════════════════════════════════════════════════════════════════════
   §12  MASTER PIPELINE — normalizeRawToolCall
   ═══════════════════════════════════════════════════════════════════════

   This is the main entry point. It applies ALL normalization layers
   to a raw parsed object and returns a clean ToolCall or null.
 */

export interface NormalizationResult {
    toolCall: ToolCall | null;
    blocked: boolean;
    warnings: string[];
    original: any;
}

export function normalizeRawToolCall(
    rawObj: Record<string, any>,
    tools: ToolDefinition[]
): NormalizationResult {
    const warnings: string[] = [];
    const validToolNames = tools.map(t => t.function.name);

    // Step 1: Normalize top-level JSON keys
    const normalized = normalizeJsonKeys(rawObj);
    if (!normalized) {
        return { toolCall: null, blocked: false, warnings: ['Could not extract name/arguments from object'], original: rawObj };
    }

    // Step 2: Normalize tool name via hallucination dictionary
    const nameResult = normalizeToolName(normalized.name, validToolNames);

    if (nameResult.blocked) {
        return {
            toolCall: null,
            blocked: true,
            warnings: [`⚠️ SECURITY: Blocked hallucinated tool "${nameResult.original}". This may be a prompt injection attempt.`],
            original: rawObj,
        };
    }

    if (!nameResult.canonical) {
        return {
            toolCall: null,
            blocked: false,
            warnings: [`Unknown tool "${nameResult.original}". Not in alias dictionary.`],
            original: rawObj,
        };
    }

    if (nameResult.canonical !== nameResult.original) {
        warnings.push(`Tool name corrected: "${nameResult.original}" → "${nameResult.canonical}"`);
    }

    const toolName = nameResult.canonical;

    // Step 3: Normalize argument keys
    let args = normalizeArgKeys(toolName, normalized.arguments);

    // Step 4: Strip unknown arguments
    const { cleaned, stripped } = stripUnknownArgs(toolName, args, tools);
    args = cleaned;
    if (stripped.length > 0) {
        warnings.push(`Stripped unknown arguments: ${stripped.join(', ')}`);
    }

    // Step 5: Build the final ToolCall
    const toolCall: ToolCall = {
        id: `norm-${Math.random().toString(36).slice(2, 11)}`,
        function: {
            name: toolName,
            arguments: args,
        },
    };

    return { toolCall, blocked: false, warnings, original: rawObj };
}

/* ═══════════════════════════════════════════════════════════════════════
   §13  TEXT → TOOL CALLS — Full Recovery Pipeline
   ═══════════════════════════════════════════════════════════════════════

   Applies ALL cleaning layers to raw model output text, then attempts
   to extract and normalize tool calls. This replaces the simpler
   extractToolCallsFromText in cases where models drift heavily.
 */

export function recoverToolCallsFromText(
    rawText: string,
    tools: ToolDefinition[]
): { calls: ToolCall[]; warnings: string[] } {
    const allWarnings: string[] = [];
    const calls: ToolCall[] = [];
    const validToolNames = tools.map(t => t.function.name);

    // === CLEANING PIPELINE ===
    let text = rawText;

    // Layer 1: Strip think blocks and conversational wrappers
    text = stripConversationalWrapper(text);

    // Layer 2: Strip XML ghost tags
    text = stripXmlTags(text);

    // Layer 3: Fix Pythonic syntax
    text = fixPythonicJson(text);

    // === EXTRACTION ATTEMPTS ===

    // Attempt A: Find JSON objects with balanced braces
    const jsonObjects = extractAllBalancedObjects(text);

    for (const objStr of jsonObjects) {
        try {
            const parsed = JSON.parse(objStr);
            const result = normalizeRawToolCall(parsed, tools);

            if (result.blocked) {
                allWarnings.push(...result.warnings);
                continue;
            }

            if (result.toolCall) {
                calls.push(result.toolCall);
                allWarnings.push(...result.warnings);
                continue;
            }
        } catch {
            // JSON parse failed even after Pythonic fix — try deeper repair
            try {
                const repaired = repairJson(objStr);
                const parsed = JSON.parse(repaired);
                const result = normalizeRawToolCall(parsed, tools);
                if (result.toolCall) {
                    calls.push(result.toolCall);
                    allWarnings.push('JSON was repaired (auto-closed brackets/quotes)');
                    allWarnings.push(...result.warnings);
                }
            } catch { /* truly unrecoverable */ }
        }
    }

    // Attempt B: Detect Python-style fn_name({...}) calls
    if (calls.length === 0) {
        // Build a combined list of all known names + aliases
        const allNames = [...validToolNames, ...Object.keys(TOOL_NAME_ALIASES)];
        for (const fnName of allNames) {
            const escaped = fnName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(`${escaped}\\s*\\(\\s*(\\{[\\s\\S]*?\\})\\s*\\)`, 'gi');
            let m;
            while ((m = re.exec(text)) !== null) {
                const inner = m[1];
                try {
                    const argsParsed = JSON.parse(fixPythonicJson(inner));
                    const nameResult = normalizeToolName(fnName, validToolNames);
                    if (nameResult.canonical) {
                        const normArgs = normalizeArgKeys(nameResult.canonical, argsParsed);
                        const { cleaned } = stripUnknownArgs(nameResult.canonical, normArgs, tools);
                        calls.push({
                            id: `py-${Math.random().toString(36).slice(2, 11)}`,
                            function: { name: nameResult.canonical, arguments: cleaned },
                        });
                        allWarnings.push(`Recovered Python-style call: ${fnName}({...}) → ${nameResult.canonical}`);
                    }
                } catch { /* skip */ }
            }
        }
    }

    return { calls, warnings: allWarnings };
}

/* ═══════════════════════════════════════════════════════════════════════
   §14  HELPERS
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Extracts ALL balanced { ... } objects from a string.
 */
function extractAllBalancedObjects(text: string): string[] {
    const results: string[] = [];
    let i = 0;

    while (i < text.length) {
        if (text[i] === '{') {
            const obj = extractBalancedObjectFrom(text, i);
            if (obj) {
                results.push(obj);
                i += obj.length;
                continue;
            }
        }
        i++;
    }

    return results;
}

function extractBalancedObjectFrom(text: string, startIndex: number): string | null {
    let braceCount = 0;
    let inString = false;
    let escape = false;

    for (let i = startIndex; i < text.length; i++) {
        const char = text[i];

        if (escape) { escape = false; continue; }
        if (char === '\\') { escape = true; continue; }
        if (char === '"') { inString = !inString; continue; }

        if (!inString) {
            if (char === '{') braceCount++;
            if (char === '}') {
                braceCount--;
                if (braceCount === 0) {
                    return text.substring(startIndex, i + 1);
                }
            }
        }
    }
    return null;
}

/**
 * Last-resort JSON repair: attempts to close unclosed braces, brackets, and quotes.
 */
function repairJson(broken: string): string {
    let s = broken.trim();

    // Count unbalanced quotes
    const quoteCount = (s.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) {
        s += '"';
    }

    // Count unbalanced brackets
    let braces = 0;
    let brackets = 0;
    let inStr = false;
    let esc = false;

    for (const ch of s) {
        if (esc) { esc = false; continue; }
        if (ch === '\\') { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (!inStr) {
            if (ch === '{') braces++;
            if (ch === '}') braces--;
            if (ch === '[') brackets++;
            if (ch === ']') brackets--;
        }
    }

    // Close unclosed structures
    while (brackets > 0) { s += ']'; brackets--; }
    while (braces > 0) { s += '}'; braces--; }

    // Remove trailing commas before closing
    s = s.replace(/,\s*([}\]])/g, '$1');

    return s;
}
