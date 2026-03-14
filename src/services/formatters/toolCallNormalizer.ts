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

import { ToolCall, ToolDefinition } from '../../types';

import {
    TOOL_NAME_ALIASES,
    KEY_ALIASES,
    ARG_KEY_ALIASES,
    BLOCKED_TOOL_NAMES,
    COMPLETION_TOOL_HALLUCINATIONS,
    VALUE_ALIASES
} from './normalization/dictionaries';

/* ═══════════════════════════════════════════════════════════════════════
   §5  LAYER 1 — Pythonic Syntax Fixer & String Stabilizer
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Fixes common "Pythonic Drift" and handles multiline strings safely.
 */
export function fixPythonicJson(raw: string): string {
    let s = raw;

    // Remove Python-style comments (# ...) - but only if not inside quotes
    // (Simplified: only remove if it's start of line or preceded by whitespace)
    s = s.replace(/(?:\s|^)#[^\n]*/g, '');

    // Replace Python booleans and None with JSON equivalents
    s = s.replace(/\bTrue\b/g, 'true');
    s = s.replace(/\bFalse\b/g, 'false');
    s = s.replace(/\bNone\b/g, 'null');

    // Convert single-quoted strings to double-quoted
    // Strategy: Only replace single quotes that appear to be JSON delimiters.
    s = s.replace(/([{,\[:])\s*'([^'\\]*(?:\\.[^'\\]*)*)'(?=\s*[:}\],])/g, (match, p1, inner) => {
        const escaped = inner.replace(/(?<!\\)"/g, '\\"');
        return `${p1}"${escaped}"`;
    });

    // Handle "Greedy Multiline Fields" (common in Markdown/Code blocks)
    // Targets keys like content, replace, text, which often break due to raw newlines.
    const multilineKeys = ["content", "replace", "text", "texto", "respuesta", "body", "reasoning", "sources", "find"];
    for (const key of multilineKeys) {
        // This regex looks for "key": "..." and stops ONLY when it sees a comma or brace followed by another potential key or end of object.
        // We use [\s\S] to match across newlines.
        const re = new RegExp(`("${key}"|'${key}')\\s*:\\s*(['"])([\\s\\S]*?)\\2(?=\\s*[,}]\\s*(?:['"][a-zA-Z0-9_]+['"]\\s*:|\\s*}|$))`, 'gi');
        s = s.replace(re, (match, k, q, content) => {
            const escaped = content
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r');
            // We don't escape quotes here because it's hard to distinguish between 
            // internal quotes intended to be part of the string vs hallucinated unescaped quotes.
            // But we MUST at least preserve the string.
            return `${k}: "${escaped}"`;
        });
    }

    // Fix raw newlines inside any double-quoted strings - use [\s\S] to cross lines
    // We use a non-greedy match that respects escaped quotes.
    s = s.replace(/"((?:\\.|[^"\\])*)"/g, (match, content) => {
        return '"' + content.replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
    });

    // Remove trailing commas before } or ]
    s = s.replace(/,\s*([}\]])/g, '$1');

    return s;
}

/* ═══════════════════════════════════════════════════════════════════════
   §6  LAYER 2 — XML/Tag Stripper
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Strips known XML-like ghost tags.
 */
export function stripXmlTags(text: string): string {
    const tagNames = [
        'tool_call', 'function_call', 'TOOLCALL', 'call', 'tool_use',
        'tool_code', 'function', 'tool_response', 'tool_result',
        'start_function_call', 'end_function_call',
    ];

    let cleaned = text;
    for (const tag of tagNames) {
        const re = new RegExp(`<\\|?${tag}\\|?>([\\s\\S]*?)<\\|?\\/?${tag}\\|?>`, 'gi');
        cleaned = cleaned.replace(re, '$1');
    }
    return cleaned;
}

/* ═══════════════════════════════════════════════════════════════════════
   §7  LAYER 3 — Conversational Wrapper Stripper
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Removes think blocks, markdown fences, and conversational preambles.
 */
export function stripConversationalWrapper(text: string): string {
    let s = text.trim();

    // 1. Strip think blocks (including possible markdown/backtick wrappers)
    s = s.replace(/`*<think>[\s\S]*?<\/think>`*/gi, '');

    // 2. Strip Markdown code fences (```json ... ```)
    s = s.replace(/```[a-z]*\n?([\s\S]*?)\n?```/gi, '$1');

    // 3. Strip common conversational preambles (English & Spanish)
    const preambles = [
        /^here is the tool call:\s*/i,
        /^i will use the (.*) tool:\s*/i,
        /^certainly, i will (.*):\s*/i,
        /^i'll help you with that\.\s*/i,
        /^i will now (.*):\s*/i,
        /^aquí está el llamado:\s*/i,
        /^voy a usar la herramienta (.*):\s*/i,
        /^claro, voy a (.*):\s*/i,
        /^entendido, voy a (.*):\s*/i,
        /^te ayudaré con eso\.\s*/i,
        /^ahora voy a (.*):\s*/i,
    ];
    for (const p of preambles) {
        s = s.replace(p, '');
    }

    return s.trim();
}

/* ═══════════════════════════════════════════════════════════════════════
   §10  NORMALIZE - Helpers
   ═══════════════════════════════════════════════════════════════════════ */

function normalizeJsonKeys(obj: any, validToolNames: string[] = []): { name: string; arguments: any } | null {
    if (!obj || typeof obj !== 'object') return null;

    // Recursive search for tool_calls array (Mercury/OpenAI style)
    if (obj.tool_calls && Array.isArray(obj.tool_calls) && obj.tool_calls.length > 0) {
        return normalizeJsonKeys(obj.tool_calls[0], validToolNames);
    }

    let name = '';
    let args: any = {};

    // 1. Standard Extraction (name, arguments labels)
    for (const key in obj) {
        const lowerKey = key.toLowerCase();
        const canonical = KEY_ALIASES[lowerKey];
        if (canonical === 'name') name = obj[key];
        else if (canonical === 'arguments') args = obj[key];
        else if (lowerKey === 'name') name = obj[key];
        else if (lowerKey === 'arguments') args = obj[key];

        // Handle specialized "function" wrapper: { "function": { "name": "...", "arguments": "..." } }
        if (lowerKey === 'function' && typeof obj[key] === 'object') {
            const inner = normalizeJsonKeys(obj[key], validToolNames);
            if (inner) {
                name = inner.name;
                args = inner.arguments;
            }
        }
    }

    // NEW: Heuristic for Flat JSON Structures
    // If we found a tool name but the 'arguments'/'args' field is still empty/null,
    // we search for all other fields and collect them as arguments.
    if (name && (!args || (typeof args === 'object' && Object.keys(args).length === 0))) {
        const flatArgs: any = {};
        for (const key in obj) {
            const lowerKey = key.toLowerCase();
            const canonical = KEY_ALIASES[lowerKey];
            // If it's not a known structural key (name, arguments, function), it's probably an argument
            if (canonical !== 'name' && canonical !== 'arguments' && lowerKey !== 'name' && lowerKey !== 'arguments' && lowerKey !== 'function') {
                flatArgs[key] = obj[key];
            }
        }
        if (Object.keys(flatArgs).length > 0) {
            args = flatArgs;
        }
    }

    // 2. Specialized Shorthand Detection: { "final_answer": "..." }

    // 2. Specialized Shorthand Detection: { "final_answer": "..." }
    // If we don't have a 'name' but we have a key that matches a common tool name
    if (!name) {
        for (const key in obj) {
            const lowerKey = key.toLowerCase().trim();
            // Check if this key itself is a tool name (direct or alias)
            const aliasedTool = TOOL_NAME_ALIASES[lowerKey] || (validToolNames.includes(lowerKey) ? lowerKey : null);

            if (aliasedTool) {
                name = aliasedTool;
                const val = obj[key];

                if (typeof val === 'string') {
                    // Map value to the primary field of that tool
                    if (aliasedTool === 'final_answer') args = { text: val };
                    else if (aliasedTool === 'update_file') args = { content: val };
                    else if (aliasedTool === 'read_file') args = { filename: val };
                    else if (aliasedTool === 'web_search') args = { query: val };
                    else args = { [key]: val }; // Fallback
                } else if (val && typeof val === 'object' && !Array.isArray(val)) {
                    args = val; // Nested arguments
                }
                break;
            }
        }
    }

    // 3. Heuristic Tool Inference: { "filename": "...", "content": "..." } -> update_file
    // If we have no name but we have keys that uniquely identify a tool
    if (!name) {
        const objKeys = Object.keys(obj).map(k => k.toLowerCase());

        // Profiles for inference
        if (objKeys.includes('filename') && (objKeys.includes('content') || objKeys.includes('text'))) {
            name = 'update_file';
            args = obj;
        } else if (objKeys.includes('filename') && objKeys.includes('find') && objKeys.includes('replace')) {
            name = 'patch_file';
            args = obj;
        } else if (objKeys.includes('filename') && objKeys.length === 1) {
            name = 'read_file';
            args = obj;
        } else if (objKeys.includes('query') && (objKeys.length === 1 || objKeys.includes('search_depth'))) {
            name = 'web_search';
            args = obj;
        } else if (objKeys.includes('coin_id')) {
            name = 'get_crypto_price';
            args = obj;
        } else if ((objKeys.includes('text') || objKeys.includes('mensaje') || objKeys.includes('content')) && (objKeys.length <= 3)) {
            // High probability it's a final_answer if it only has text/reasoning/sources
            const finalKeys = ['text', 'mensaje', 'message', 'content', 'reasoning', 'razonamiento', 'sources', 'fuentes'];
            if (objKeys.every(k => finalKeys.includes(k))) {
                name = 'final_answer';
                args = obj;
            }
        }
    }

    // Handle nested cases: { "tool_call": { "name": "...", "arguments": {...} } }
    if (!name && obj.tool_call) return normalizeJsonKeys(obj.tool_call, validToolNames);
    if (!name && obj.function_call) return normalizeJsonKeys(obj.function_call, validToolNames);

    if (name) return { name, arguments: args || {} };
    return null;
}

function normalizeToolName(name: string, validNames: string[]): { canonical: string | null; original: string; blocked?: boolean } {
    if (!name) return { canonical: null, original: '' };
    const lower = name.toLowerCase().trim();

    // Check direct match
    if (validNames.includes(name)) return { canonical: name, original: name };

    // Check case-insensitive valid names
    const ciMatch = validNames.find(v => v.toLowerCase() === lower);
    if (ciMatch) return { canonical: ciMatch, original: name };

    // Check aliases
    const aliased = TOOL_NAME_ALIASES[lower];
    if (aliased) return { canonical: aliased, original: name };

    // Security check
    if (BLOCKED_TOOL_NAMES.has(lower)) {
        return { canonical: null, original: name, blocked: true } as any;
    }

    return { canonical: null, original: name };
}

function normalizeArgKeys(toolName: string, args: any): any {
    if (!args || typeof args !== 'object' || Array.isArray(args)) return args;

    const toolAliases = ARG_KEY_ALIASES[toolName] || {};
    const normalized: any = {};

    for (const key in args) {
        let canonicalKey = toolAliases[key.toLowerCase()] || key;
        let value = args[key];

        // Clean string values
        if (typeof value === 'string') {
            value = cleanStringValue(value);
        }

        // Apply Value Normalization for this key if it exists globally
        const valueMap = VALUE_ALIASES[canonicalKey.toLowerCase()];
        if (valueMap && typeof value === 'string' && valueMap[value.toLowerCase()]) {
            value = valueMap[value.toLowerCase()];
        }

        normalized[canonicalKey] = value;
    }

    return normalized;
}

/**
 * Removes surrounding quotes if they were double-escaped or hallucinated by the model.
 * E.g. "https://example.com"" -> https://example.com
 */
function cleanStringValue(val: string): string {
    let s = val.trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        // Only strip if length > 2 (don't strip empty string "" to nothing)
        if (s.length > 2) {
            return s.slice(1, -1);
        }
    }
    return s;
}

function stripUnknownArgs(toolName: string, args: any, tools: ToolDefinition[]): { cleaned: any; stripped: string[] } {
    if (!args || typeof args !== 'object' || Array.isArray(args)) return { cleaned: args, stripped: [] };

    const def = tools.find(t => t.function.name === toolName);
    if (!def) return { cleaned: args, stripped: [] };

    const schema = def.function.parameters.properties;
    const cleaned: any = {};
    const stripped: string[] = [];

    for (const key in args) {
        if (schema[key]) {
            cleaned[key] = args[key];
        } else {
            stripped.push(key);
        }
    }

    return { cleaned, stripped };
}

/* ═══════════════════════════════════════════════════════════════════════
   §12  ENTRY POINT — Object Normalizer
   ═══════════════════════════════════════════════════════════════════════ */

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
    const normalized = normalizeJsonKeys(rawObj, validToolNames);
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

    let toolName = nameResult.canonical;

    // Step 3: Normalize argument keys
    let args = normalizeArgKeys(toolName, normalized.arguments);

    // Step 4: Strip unknown arguments
    const { cleaned, stripped } = stripUnknownArgs(toolName, args, tools);
    args = cleaned;
    if (stripped.length > 0) {
        warnings.push(`Stripped unknown arguments: ${stripped.join(', ')}`);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // NEW: Heuristic Corrections
    // ─────────────────────────────────────────────────────────────────────────────

    // 1. patch_file missing 'find' -> treat as update_file (overwrite)
    if (toolName === 'patch_file') {
        const hasFind = args.find && typeof args.find === 'string' && args.find.trim().length > 0;

        if (!hasFind) {
            toolName = 'update_file';
            // Remap 'replace' -> 'content' if 'content' is missing
            if (args.replace && !args.content) {
                args.content = args.replace;
                delete args.replace;
            }
            warnings.push('Converted "patch_file" to "update_file" (missing "find" parameter → assuming full overwrite).');
        }
    }

    // 2. NEW: update_file WITH patches -> treat as patch_file (canonical name)
    if (toolName === 'update_file' && args.patches && Array.isArray(args.patches)) {
        toolName = 'patch_file';
        warnings.push('Converted "update_file" + "patches[]" to "patch_file".');
    }

    // 3. content="delete" -> content="" (Clear File)
    // Applies to update_file (and converted patch_file)
    if (toolName === 'update_file') {
        const c = args.content;
        if (typeof c === 'string') {
            const pattern = /^(delete|remove|borrar|eliminar|del|rm|delete_file|remove_file)$/i;
            if (pattern.test(c.trim())) {
                args.content = '';
                warnings.push(`Interpreted content="${c}" as a request to CLEAR the file.`);
            }
        }
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
 */
export interface RecoveredCall {
    toolCall: ToolCall;
    start: number;
    end: number;
}

export function recoverToolCallsFromText(
    rawText: string,
    tools: ToolDefinition[]
): { calls: RecoveredCall[]; warnings: string[] } {
    const allWarnings: string[] = [];
    const validToolNames = tools.map(t => t.function.name);

    // === SCAN ORIGINAL TEXT ===
    // We MUST use the original text for scanning to ensure offsets (start/end)
    // correctly map back to the raw content for narrative segmentation in agent.ts
    const text = rawText;
    const foundCalls: RecoveredCall[] = [];

    // Attempt A: JSON objects with balanced braces
    const jsonObjects = extractAllBalancedObjects(text);
    for (const obj of jsonObjects) {
        try {
            // Internal stabilization for the JSON blob itself
            const stabilized = fixPythonicJson(obj.content);
            const parsed = JSON.parse(stabilized);
            const result = normalizeRawToolCall(parsed, tools);
            if (result.toolCall && !result.blocked) {
                foundCalls.push({ toolCall: result.toolCall, start: obj.start, end: obj.end });
                allWarnings.push(...result.warnings);
            }
        } catch {
            try {
                const repaired = repairJson(obj.content);
                const parsed = JSON.parse(repaired);
                const result = normalizeRawToolCall(parsed, tools);
                if (result.toolCall) {
                    foundCalls.push({ toolCall: result.toolCall, start: obj.start, end: obj.end });
                    allWarnings.push('JSON repaired');
                }
            } catch { /* skip */ }
        }
    }

    // Attempt B: Abbreviated calls {tool_name noisy content}
    const allNames = [...validToolNames, ...Object.keys(TOOL_NAME_ALIASES)];
    for (const fnName of allNames) {
        const escaped = fnName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`\\{\\s*${escaped}\\s*([^}]*)\\}`, 'gi');
        let m;
        while ((m = re.exec(text)) !== null) {
            const nameResult = normalizeToolName(fnName, validToolNames);
            if (nameResult.canonical) {
                const noise = m[1].trim();
                let args: Record<string, any> = {};
                if (nameResult.canonical === 'final_answer') {
                    const stringMatch = noise.match(/"([^"]+)"|'([^']+)'/);
                    args.text = stringMatch ? (stringMatch[1] || stringMatch[2]) : noise;
                }
                foundCalls.push({
                    toolCall: {
                        id: `ab-${Math.random().toString(36).slice(2, 11)}`,
                        function: { name: nameResult.canonical, arguments: args },
                    },
                    start: m.index,
                    end: m.index + m[0].length
                });
            }
        }
    }

    // Attempt C: Narrative Fragment Reconstructor
    const narrResult = reconstructFromNarrative(text, tools);
    if (narrResult.calls.length > 0) {
        foundCalls.push(...narrResult.calls);
        allWarnings.push(...narrResult.warnings);
    }

    // Attempt D: Bare-Key Recovery (e.g. "final_answer: content" or "update_file: filename: tasks.md content: ...")
    // This handles models that output key-value pairs without JSON braces.
    const bareKeys = [...validToolNames, ...Object.keys(TOOL_NAME_ALIASES)];
    for (const keyCandidate of bareKeys) {
        const escaped = keyCandidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Match: /^final_answer:\s*(.*)/ or /final_answer:\s*(.*)/
        const bareRe = new RegExp(`(?:^|\\n)(${escaped})\\s*[:=]\\s*([\\s\\S]*?)(?=\\n[a-z0-9_]+\\s*[:=]|\\n[^\\s]|$)`, 'gi');
        let m;
        while ((m = bareRe.exec(text)) !== null) {
            const rawName = m[1];
            const rawValue = m[2].trim();
            const nameResult = normalizeToolName(rawName, validToolNames);
            if (!nameResult.canonical) continue;

            const canonical = nameResult.canonical;
            const args: Record<string, any> = {};

            // If the rawValue itself has sub-keys (e.g. "filename: foo.md\ncontent: key"), parse them
            const subKeyPattern = /^(?:\s*)([a-z0-9_]+)\s*[:=]\s*(.*)$/gm;
            let subMatch;
            let foundSubKeys = false;
            while ((subMatch = subKeyPattern.exec(rawValue)) !== null) {
                args[subMatch[1].trim()] = subMatch[2].trim();
                foundSubKeys = true;
            }

            if (!foundSubKeys) {
                // If no sub-keys, map the whole value to the primary field
                if (canonical === 'final_answer') args.text = rawValue;
                else if (canonical === 'read_file') args.filename = rawValue;
                else if (canonical === 'update_file') args.content = rawValue;
                else args.text = rawValue; // fallback
            }

            foundCalls.push({
                toolCall: {
                    id: `bare-${Math.random().toString(36).slice(2, 11)}`,
                    function: { name: canonical, arguments: normalizeArgKeys(canonical, args) }
                },
                start: m.index,
                end: m.index + m[0].length
            });
            allWarnings.push(`Recovered via Bare-Key Heuristic: ${canonical}`);
        }
    }

    // Sort by start position for easier chronological processing
    foundCalls.sort((a, b) => a.start - b.start);

    // Final internal cleanup: If we have multiple hits for the EXACT same span, keep only one.
    // Also, if one span completely swallows another for the same tool (e.g. JSON vs Narrative), keep the larger one.
    const uniqueSpans: RecoveredCall[] = [];
    for (const c of foundCalls) {
        // Check if `c` is already subsumed by an existing span of the same tool
        const isSubsumed = uniqueSpans.some(existing =>
            existing.toolCall.function.name === c.toolCall.function.name &&
            (
                (c.start >= existing.start && c.end <= existing.end) ||
                // Alternatively, if they overlap more than 50%
                (c.start <= existing.start && c.end >= existing.end)
            )
        );

        if (!isSubsumed) {
            // Remove any existing spans that `c` completely swallows
            const filteredSpans = uniqueSpans.filter(existing => !(
                existing.toolCall.function.name === c.toolCall.function.name &&
                existing.start >= c.start && existing.end <= c.end
            ));

            uniqueSpans.length = 0;
            uniqueSpans.push(...filteredSpans, c);
        }
    }

    return { calls: uniqueSpans, warnings: allWarnings };
}

/**
 * §14  NARRATIVE RECONSTRUCTOR
 * Scans raw text for keyword structures resembling tool calls, even without JSON.
 */
function reconstructFromNarrative(text: string, tools: ToolDefinition[]): { calls: RecoveredCall[], warnings: string[] } {
    const calls: RecoveredCall[] = [];
    const warnings: string[] = [];
    const validToolNames = tools.map(t => t.function.name);

    // 1. Find potential tool names in the text
    const allKnownNames = [...validToolNames, ...Object.keys(TOOL_NAME_ALIASES)];
    for (const nameCandidate of allKnownNames) {
        const escaped = nameCandidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Match: "name": "tool_name" or tool_name(...) or action: tool_name
        const nameRe = new RegExp(`(?:["']?name["']?\\s*[:=]\\s*["']?|tool[:=]\\s*|action[:=]\\s*|execute\\s+)(${escaped})\\b`, 'gi');

        let match;
        while ((match = nameRe.exec(text)) !== null) {
            const toolName = match[1];
            const nameResult = normalizeToolName(toolName, validToolNames);
            if (!nameResult.canonical) continue;

            const canonical = nameResult.canonical;
            const args: Record<string, any> = {};

            // 2. Scan for argument fragments in the vicinity (Limit window to 1000 chars after name)
            const textToScan = text.substring(nameRe.lastIndex, nameRe.lastIndex + 1000);

            const possibleArgKeys = {
                ...ARG_KEY_ALIASES[canonical],
                ...Object.fromEntries(Object.keys(tools.find(t => t.function.name === canonical)?.function.parameters.properties || {}).map(k => [k, k]))
            };

            let maxArgEnd = 0;
            for (const [alias, realKey] of Object.entries(possibleArgKeys)) {
                if (alias.length < 3) continue;

                // Improved Regex: capture quotes (handling escapes) or allow unquoted values until common delimiters
                // 1. (["'])(?:\\.|[^\1])*?\1  -> Quoted string with escape support
                // 2. (\\[[\\s\\S]*?\\])      -> JSON-like array
                // 3. ([\\s\\S]*?)(?=\\s*[,}\\n]\\s*[a-zA-Z0-9_]+[:=]|\\s*[}\\n]|$) -> Unquoted text until next key or end
                const argRe = new RegExp(`["']?${alias}["']?\\s*[:=]\\s*(?:(["'])([\\s\\S]*?)\\1|(\\[[\\s\\S]*?\\])|([\\s\\S]*?)(?=\\s*[,}\\n]\\s*[a-zA-Z0-9_]+[:=]|\\s*[}\\n]|$))`, 'gi');
                let argMatch;
                while ((argMatch = argRe.exec(textToScan)) !== null) {
                    let value: any = argMatch[2] || argMatch[3] || argMatch[4];
                    if (value !== undefined) {
                        value = value.trim();
                        // If it's a quoted string, we might need to unescape some characters
                        if (argMatch[1]) {
                            value = value.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\\\/g, '\\');
                        }

                        // If it looks like a JSON array, try to parse it
                        if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
                            try {
                                const parsedArr = JSON.parse(value.replace(/'/g, '"'));
                                if (Array.isArray(parsedArr)) value = parsedArr;
                            } catch { /* keep as string if not valid JSON */ }
                        }
                        args[realKey] = value;
                        maxArgEnd = Math.max(maxArgEnd, argMatch.index + argMatch[0].length);
                    }
                }
            }

            // Normalize EVERYTHING before pushing (Crucial for aliases like '.' -> 'sandbox')
            const normalizedArgs = normalizeArgKeys(canonical, args);

            // Special Case: If final_answer has no text but there's "noise" in the window, use that noise.
            if (canonical === 'final_answer' && !normalizedArgs.text && textToScan.trim()) {
                const line = textToScan.trim().split(/\n/)[0].replace(/^[:=\s]+/, '');
                normalizedArgs.text = line;
                maxArgEnd = Math.max(maxArgEnd, textToScan.indexOf(line) + line.length);
            }

            if (Object.keys(normalizedArgs).length > 0 || canonical === 'final_answer') {
                calls.push({
                    toolCall: {
                        id: `narr-${Math.random().toString(36).slice(2, 11)}`,
                        function: { name: canonical, arguments: normalizedArgs }
                    },
                    start: match.index,
                    end: nameRe.lastIndex + maxArgEnd
                });
                warnings.push(`Recovered via Narrative Fragment Reconstructor: ${canonical}`);
            }
        }
    }

    return { calls, warnings };
}

/* ═══════════════════════════════════════════════════════════════════════
   §14  HELPERS
   ═══════════════════════════════════════════════════════════════════════ */

export function extractAllBalancedObjects(text: string): { content: string; start: number; end: number }[] {
    const results: { content: string; start: number; end: number }[] = [];
    let i = 0;

    while (i < text.length) {
        if (text[i] === '{') {
            const obj = extractBalancedObjectFrom(text, i);
            if (obj) {
                results.push({ content: obj, start: i, end: i + obj.length });
                i += obj.length;
                continue;
            } else {
                // LINGERING FRAGMENT: If we found a '{' but no closing '}', and we are near the end,
                // we treat the rest of the string as a potential fragment for repairJson.
                const remaining = text.substring(i);
                if (remaining.includes('"') || remaining.includes(':')) {
                    results.push({ content: remaining, start: i, end: text.length });
                }
                break;
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
                if (braceCount === 0) return text.substring(startIndex, i + 1);
            }
        }
    }
    return null;
}

function repairJson(broken: string): string {
    let s = broken.trim();
    const quoteCount = (s.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) s += '"';

    let braces = 0, brackets = 0, inStr = false, esc = false;
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
    while (brackets > 0) { s += ']'; brackets--; }
    while (braces > 0) { s += '}'; braces--; }
    s = s.replace(/,\s*([}\]])/g, '$1');
    return s;
}
