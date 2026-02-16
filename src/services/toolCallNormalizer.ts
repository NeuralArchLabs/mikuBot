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
    'leer': 'read_file',
    'ver_archivo': 'read_file',
    'mostrar': 'read_file',
    'abrir': 'read_file',
    'open_document': 'read_file',
    'view': 'read_file',
    'cat_file': 'read_file',

    // ── update_file variants ────────────────────────────────────────
    'updatefile': 'update_file',
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
    'escribir': 'update_file',
    'escribir_archivo': 'update_file',
    'guardar': 'update_file',
    'guardar_archivo': 'update_file',
    'crear_archivo': 'update_file',
    'file_generator': 'update_file',
    'generate_file': 'update_file',
    'content_generator': 'update_file',

    // ── patch_file variants ────────────────────────────────────────
    'patchfile': 'patch_file',
    'edit_section': 'patch_file',
    'replace_in_file': 'patch_file',
    'file_patch': 'patch_file',
    'modify_section': 'patch_file',
    'partial_update': 'patch_file',
    'replace_text': 'patch_file',
    'find_and_replace': 'patch_file',
    'find_replace': 'patch_file',
    'sed': 'patch_file',
    'patch': 'patch_file',
    'modify_part': 'patch_file',
    'edit_block': 'patch_file',
    'replace_block': 'patch_file',
    // Fallback for delete attempts -> will fail validation if not properly structured, 
    // but at least it hits the right tool for "modifications"
    'delete_file': 'patch_file',
    'remove_file': 'patch_file',
    'delete': 'patch_file',
    'remove': 'patch_file',
    'rm': 'patch_file',

    // ── list_files variants ─────────────────────────────────────────
    'listfiles': 'list_files',
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
    'file_search': 'search_files',
    'filesearch': 'search_files',
    'grep': 'search_files',
    'find_file': 'search_files',
    'find_files': 'search_files',
    'search_in_files': 'search_files',
    'search_content': 'search_files',
    'find_in_files': 'search_files',
    'search': 'search_files',
    'recursive_search': 'search_files',
    'search_recursive': 'search_files',
    'locate_file': 'search_files',

    // ── web_search variants ─────────────────────────────────────────
    'websearch': 'web_search',
    'google_search': 'web_search',
    'googlesearch': 'web_search',
    'google_query': 'web_search',
    'bing_search': 'web_search',
    'internet_search': 'web_search',
    'search_web': 'web_search',
    'searchweb': 'web_search',
    'browser': 'web_search',
    'browse': 'web_search',
    'browse_web': 'web_search',
    'online_search': 'web_search',
    'search_internet': 'web_search',
    'buscar_internet': 'web_search',
    'buscar_web': 'web_search',
    'busqueda_web': 'web_search',
    'search_online': 'web_search',
    'internet_query': 'web_search',
    'query_web': 'web_search',

    // ── read_url variants ───────────────────────────────────────────
    'readurl': 'read_url',
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
    'shell_execute': 'run_console',
    'execute_shell': 'run_console',
    'run_shell': 'run_console',
    'run_command': 'run_console',
    'runcommand': 'run_console',
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

    // ── final_answer variants ───────────────────────────────────────
    'finalanswer': 'final_answer',
    'final_summary': 'final_answer',
    'summary': 'final_answer',
    'answer': 'final_answer',
    'talk': 'final_answer',
    'say': 'final_answer',
    'respond': 'final_answer',
    'response': 'final_answer',
    'complete': 'final_answer',
    'done': 'final_answer',
    'finish': 'final_answer',
    'report': 'final_answer',
    'task_complete': 'final_answer',
    'print': 'final_answer',
    'log': 'final_answer',
    'display': 'final_answer',
    'conclude': 'final_answer',
    'result': 'final_answer',
    'resultado': 'final_answer',
    'terminar': 'final_answer',
    'final': 'final_answer',
    'respuesta': 'final_answer',
    'respuesta_final': 'final_answer',
    'resumen_final': 'final_answer',
    'fin': 'final_answer',
    'conclusión': 'final_answer',
    'conclusion': 'final_answer',
    'reply': 'final_answer',
    'message_user': 'final_answer',

    // ── telegram variants ───────────────────────────────────────────
    'telegram': 'send_telegram_message',
    'telegram_message': 'send_telegram_message',
    'send_telegram': 'send_telegram_message',
    'notify_telegram': 'send_telegram_message',
    'telegram_notify': 'send_telegram_message',
    'msg_telegram': 'send_telegram_message',
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
    'function_call': 'name',
    'function': 'name',
    'func': 'name',
    'tool': 'name',
    'tool_name': 'name',
    'tool_code': 'name',
    'tool_call': 'name',
    'call': 'name',
    'call_tool': 'name',
    'action': 'name',
    'command': 'name',
    'method': 'name',
    'call_function': 'name',
    'function_name': 'name',
    'function_name_call': 'name',

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
    'tool_input': 'arguments',
    'tool_args': 'arguments',
    'tool_params': 'arguments',
    'tool_parameters': 'arguments',
    'tool_kwargs': 'arguments',
    'tool_data': 'arguments',
    'tool_payload': 'arguments',
    'tool_body': 'arguments',
    'tool_options': 'arguments',
};

/* ═══════════════════════════════════════════════════════════════════════
   §3  ARGUMENT KEY NORMALIZATION (per-tool)
   ═══════════════════════════════════════════════════════════════════════

   Models sometimes use slightly different argument names.
   For example: "file" instead of "filename", "text" instead of "content", etc.
 */

const ARG_KEY_ALIASES: Record<string, Record<string, string>> = {
    read_file: {
        // -> filename
        'file': 'filename',
        'filepath': 'filename',
        'file_path': 'filename',
        'path': 'filename',
        'name': 'filename',
        'file_name': 'filename',
        'archivo': 'filename',
        'ruta': 'filename',
        'nombre': 'filename',
        // -> source
        'folder': 'source',
        'directory': 'source',
        'ubicación': 'source',
        'carpeta': 'source',
    },
    update_file: {
        // -> filename
        'file': 'filename',
        'filepath': 'filename',
        'file_path': 'filename',
        'path': 'filename',
        'name': 'filename',
        'file_name': 'filename',
        'archivo': 'filename',
        'ruta': 'filename',
        // -> content
        'text': 'content',
        'body': 'content',
        'data': 'content',
        'value': 'content',
        'file_content': 'content',
        'contenido': 'content',
        'texto': 'content',
        'datos': 'content',
    },
    patch_file: {
        // -> filename
        'file': 'filename',
        'filepath': 'filename',
        'file_path': 'filename',
        'path': 'filename',
        'name': 'filename',
        'file_name': 'filename',
        'archivo': 'filename',
        // -> find
        'search': 'find',
        'old_text': 'find',
        'old': 'find',
        'original': 'find',
        'target': 'find',
        'match': 'find',
        'pattern': 'find',
        'buscar': 'find',
        'encontrar': 'find',
        'original_text': 'find',
        'context': 'find',
        'código_original': 'find',
        'original_code': 'find',
        // -> replace
        'new_text': 'replace',
        'new': 'replace',
        'replacement': 'replace',
        'with': 'replace',
        'substitute': 'replace',
        'reemplazar': 'replace',
        'nuevo': 'replace',
        'sustituir': 'replace',
        'content': 'replace',
        'texto': 'replace',
        'código': 'replace',
        'code': 'replace',
        'body': 'replace',
        // Common hallucinations for "delete" actions -> mapped to replace (usually with empty string)
        'delete': 'replace',
        'remove': 'replace',
        'del': 'replace',
        'action': 'replace',
        'command': 'replace',
        // -> source
        'folder': 'source',
        'directory': 'source',
        'ubicación': 'source',
        'carpeta': 'source',
    },
    list_files: {
        // -> source
        'folder': 'source',
        'directory': 'source',
        'dir': 'source',
        'target': 'source',
        'location': 'source',
        'path': 'source',
        'carpeta': 'source',
        'ubicacion': 'source',
        'ubicación': 'source',
        'ubidación': 'source',
        'directorio': 'source',
        'destino': 'source',
    },
    search_files: {
        // -> query
        'search': 'query',
        'term': 'query',
        'pattern': 'query',
        'keyword': 'query',
        'text': 'query',
        'q': 'query',
        'search_query': 'query',
        'search_term': 'query',
        'consulta': 'query',
        'termino': 'query',
        'busqueda': 'query',
        'búsqueda': 'query',
        // -> source
        'folder': 'source',
        'directory': 'source',
        'dir': 'source',
        'carpeta': 'source',
        'destino': 'source',
        'destinos': 'source',
    },
    web_search: {
        // -> query
        'search': 'query',
        'term': 'query',
        'q': 'query',
        'search_query': 'query',
        'search_term': 'query',
        'keyword': 'query',
        'keywords': 'query',
        'text': 'query',
        'consulta': 'query',
        // -> search_depth
        'profundidad': 'search_depth',
        'depth': 'search_depth',
    },
    read_url: {
        // -> url
        'link': 'url',
        'href': 'url',
        'page': 'url',
        'website': 'url',
        'address': 'url',
        'page_url': 'url',
        'target_url': 'url',
        'site': 'url',
        'enlace': 'url',
        'pagina': 'url',
        'página': 'url',
        'dirección': 'url',
    },
    run_console: {
        // -> command
        'cmd': 'command',
        'shell': 'command',
        'exec': 'command',
        'run': 'command',
        'instruction': 'command',
        'script': 'command',
        'comando': 'command',
        'instruccion': 'command',
        'instrucción': 'command',
        // -> args
        'arguments': 'args',
        'parameters': 'args',
        'params': 'args',
        'flags': 'args',
        'options': 'args',
        'argumentos': 'args',
        'parametros': 'args',
        'parámetros': 'args',
        // -> cwd
        'dir': 'cwd',
        'directory': 'cwd',
        'path': 'cwd',
        'working_dir': 'cwd',
        'workdir': 'cwd',
        'carpeta': 'cwd',
        'directorio': 'cwd',
    },
    final_answer: {
        // -> text
        'message': 'text',
        'response': 'text',
        'answer': 'text',
        'summary': 'text',
        'content': 'text',
        'output': 'text',
        'result': 'text',
        'solución': 'text',
        'párrafo': 'text',
        'texto': 'text',
        'respuesta': 'text',
        'mensaje': 'text',
        'conclusíon': 'text',
        'conclusión': 'text',
        'texto_final': 'text',
        'resultado_final': 'text',
        // -> reasoning
        'thought': 'reasoning',
        'logic': 'reasoning',
        'razonamiento': 'reasoning',
        'pensamiento': 'reasoning',
        // -> sources
        'url': 'sources',
        'links': 'sources',
        'file': 'sources',
        'fuentes': 'sources',
        'referencias': 'sources',
        'archivos': 'sources',
    },
    send_telegram_message: {
        'message': 'text',
        'msg': 'text',
        'content': 'text',
        'body': 'text',
        'texto': 'text',
        'mensaje': 'text',
        'id': 'chat_id',
        'chat': 'chat_id',
        'to': 'chat_id',
        'recipient': 'chat_id',
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
const COMPLETION_TOOL_HALLUCINATIONS = new Set([
    'final_summary', 'summary', 'task_complete', 'job_done', 'done', 'exit', 'finish'
]);

/**
 * §4  VALUE NORMALIZATION
 * Models often use "." for sandbox, or Spanish terms for enums.
 */
const VALUE_ALIASES: Record<string, Record<string, any>> = {
    source: {
        '.': 'workSpace',
        './': 'workSpace',
        'current': 'workSpace',
        'here': 'workSpace',
        'local': 'workSpace',
        'workSpace_folder': 'workSpace',
        'sandbox_folder': 'workSpace',
        'sandbox': 'workSpace',
        'principal': 'workSpace',
        'biblioteca': 'library',
        'librería': 'library',
        'nucleo': 'core',
        'núcleo': 'core',
        'identidad': 'core'
    },
    search_depth: {
        'básico': 'basic',
        'basico': 'basic',
        'avanzado': 'advanced',
        'profundo': 'advanced',
        'completo': 'advanced'
    }
};

/* ═══════════════════════════════════════════════════════════════════════
   §5  LAYER 1 — Pythonic Syntax Fixer & String Stabilizer
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Fixes common "Pythonic Drift" and handles multiline strings safely.
 */
export function fixPythonicJson(raw: string): string {
    let s = raw;

    // Remove Python-style comments (# ...)
    s = s.replace(/#[^\n]*/g, '');

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
    // Enhanced with a lookahead to allow internal quotes.
    const multilineKeys = ["content", "replace", "text", "texto", "respuesta", "body", "reasoning", "sources"];
    for (const key of multilineKeys) {
        // This regex looks for "key": "..." and stops ONLY when it sees a comma or brace followed by another potential key.
        const re = new RegExp(`("${key}"|'${key}')\\s*:\\s*(['"])([\\s\\S]*?)\\2(?=\\s*[,}]\\s*(?:['"][a-zA-Z0-9_]+['"]\\s*:|\\s*}))`, 'gi');
        s = s.replace(re, (match, k, q, content) => {
            // Only escape stuff that ISN'T already escaped
            const escaped = content
                .replace(/(?<!\\)\\/g, '\\\\')
                .replace(/(?<!\\)"/g, '\\"')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r');
            return `${k}: "${escaped}"`;
        });
    }

    // Fix raw newlines inside any double-quoted strings
    s = s.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match, content) => {
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

    // 1. Strip think blocks
    s = s.replace(/<think>[\s\S]*?<\/think>/gi, '');

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

function normalizeJsonKeys(obj: any): { name: string; arguments: any } | null {
    if (!obj || typeof obj !== 'object') return null;

    let name = '';
    let args: any = {};

    // Find name/function field
    for (const key in obj) {
        const canonical = KEY_ALIASES[key.toLowerCase()];
        if (canonical === 'name') name = obj[key];
        if (canonical === 'arguments') args = obj[key];
        // Direct match if alias not found
        if (key.toLowerCase() === 'name') name = obj[key];
        if (key.toLowerCase() === 'arguments') args = obj[key];
    }

    // Handle nested cases: { "tool_call": { "name": "...", "arguments": {...} } }
    if (!name && obj.tool_call) return normalizeJsonKeys(obj.tool_call);
    if (!name && obj.function_call) return normalizeJsonKeys(obj.function_call);

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

    // 2. content="delete" -> content="" (Clear File)
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

    // === CLEANING PIPELINE ===
    let text = rawText;

    // Layer 1: Strip think blocks and conversational wrappers
    text = stripConversationalWrapper(text);

    // Layer 2: Strip XML ghost tags
    text = stripXmlTags(text);

    // Layer 3: Fix Pythonic syntax & Stabilize strings
    text = fixPythonicJson(text);

    // === EXTRACTION ATTEMPTS (UNIFIED SCAN) ===
    const foundCalls: RecoveredCall[] = [];

    // Attempt A: JSON objects with balanced braces
    const jsonObjects = extractAllBalancedObjects(text);
    for (const obj of jsonObjects) {
        try {
            const parsed = JSON.parse(obj.content);
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

    // Sort by start position for easier chronological processing
    foundCalls.sort((a, b) => a.start - b.start);

    // Final internal cleanup: If we have multiple hits for the EXACT same span, keep only one.
    const uniqueSpans: RecoveredCall[] = [];
    const seenSpans = new Set<string>();
    for (const c of foundCalls) {
        const key = `${c.start}-${c.end}-${c.toolCall.function.name}`;
        if (!seenSpans.has(key)) {
            uniqueSpans.push(c);
            seenSpans.add(key);
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

                // Improved Regex: capture quotes or allow direct values (including bracketed arrays)
                const argRe = new RegExp(`["']?${alias}["']?\\s*[:=]\\s*(?:(["'])([\\s\\S]*?)\\1|(\\[[\\s\\S]*?\\])|([\\s\\S]*?)(?=\\s*[,}\\n]\\s*[a-zA-Z0-9_]+[:=]|\\s*[}\\n]|$))`, 'gi');
                let argMatch;
                while ((argMatch = argRe.exec(textToScan)) !== null) {
                    let value = argMatch[2] || argMatch[3] || argMatch[4];
                    if (value) {
                        value = value.trim();
                        // If it looks like a JSON array, try to parse it to avoid fingerprint mismatch
                        if (value.startsWith('[') && value.endsWith(']')) {
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
