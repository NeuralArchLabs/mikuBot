/**
 * ──────────────────────────────────────────────────────────────────────
 *  Hallucination Dictionaries for Tool Call Normalization
 * ──────────────────────────────────────────────────────────────────────
 */

/* ═══════════════════════════════════════════════════════════════════════
   §1  HALLUCINATION DICTIONARY — Name Mapping
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Maps every known hallucinated tool name → canonical tool name.
 * Built from Research3 "Table 1" + observed patterns in Gemma 3, Qwen, Llama, DeepSeek.
 *
 * The keys are always lowercase for case-insensitive lookup.
 */
export const TOOL_NAME_ALIASES: Record<string, string> = {
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
    'smart_patch': 'patch_file',
    'smartpatch': 'patch_file',
    // ── delete_file variants ────────────────────────────────────────
    'delete_file': 'delete_file',
    'remove_file': 'delete_file',
    'delete': 'delete_file',
    'remove': 'delete_file',
    'rm': 'delete_file',

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
    'query_web': 'web_search',
    'search_online': 'web_search',
    'google': 'web_search',

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
    'read_url_content': 'read_url',
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
    'finish_response': 'final_answer',
    'end_turn': 'final_answer',
    'end_conversation': 'final_answer',
    'end_task': 'final_answer',
    'close': 'final_answer',
    'report': 'final_answer',
    'task_complete': 'final_answer',
    'print': 'final_answer',
    'log': 'final_answer',
    'display': 'final_answer',
    'conclude': 'final_answer',
    'result': 'final_answer',
    'resultado': 'final_answer',
    'terminar': 'final_answer',
    'finalizar': 'final_answer',
    'final': 'final_answer',
    'respuesta': 'final_answer',
    'respuesta_final': 'final_answer',
    'resumen_final': 'final_answer',
    'fin': 'final_answer',
    'conclusión': 'final_answer',
    'conclusion': 'final_answer',
    'reply': 'final_answer',
    'message_user': 'final_answer',
    'send_message': 'final_answer',
    'send_response': 'final_answer',

    // ── telegram variants ───────────────────────────────────────────
    'telegram': 'send_telegram_message',
    'telegram_message': 'send_telegram_message',
    'send_telegram': 'send_telegram_message',
    'notify_telegram': 'send_telegram_message',
    'telegram_notify': 'send_telegram_message',
    'msg_telegram': 'send_telegram_message',

    // ── instruction_booklet variants ────────────────────────────────
    'instructionbooklet': 'instruction_booklet',
    'instruction_book': 'instruction_booklet',
    'instructionbook': 'instruction_booklet',
    'manual': 'instruction_booklet',
    'tool_manual': 'instruction_booklet',
    'skill_manual': 'instruction_booklet',
    'read_manual': 'instruction_booklet',
    'how_to_use': 'instruction_booklet',
    'usage_guide': 'instruction_booklet',
    'get_help': 'instruction_booklet',
    'guia_uso': 'instruction_booklet',
    'manual_herramienta': 'instruction_booklet',

    // ── list_available_skills variants ──────────────────────────────
    'listskills': 'list_available_skills',
    'list_skills': 'list_available_skills',
    'get_skills': 'list_available_skills',
    'show_skills': 'list_available_skills',
    'habilidades': 'list_available_skills',
    'listar_skills': 'list_available_skills',
};

/* ═══════════════════════════════════════════════════════════════════════
   §2  JSON KEY NORMALIZATION
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Models hallucinate different JSON key names for the call structure.
 * This maps every known variant to the expected canonical key.
 */
export const KEY_ALIASES: Record<string, string> = {
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

export const ARG_KEY_ALIASES: Record<string, Record<string, string>> = {
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
        'texto_final': 'text',
        'resultado_final': 'text',
        // -> reasoning
        'thought': 'reasoning',
        'logic': 'reasoning',
        'razonamiento': 'reasoning',
        'pensamiento': 'reasoning',
        'conclusion': 'reasoning',
        'conclusión': 'reasoning',
        'conclusíon': 'reasoning',
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
    get_crypto_price: {
        'crypto': 'coin_id',
        'coin': 'coin_id',
        'moneda': 'coin_id',
        'currency': 'vs_currency',
        'vs': 'vs_currency',
        'target': 'vs_currency',
        'divisa': 'vs_currency',
    },
    instruction_booklet: {
        'tool': 'tool_name',
        'skill': 'tool_name',
        'name': 'tool_name',
        'toolname': 'tool_name',
        'target': 'tool_name',
        'herramienta': 'tool_name',
    },
};

/* ═══════════════════════════════════════════════════════════════════════
   §4  SECURITY — Blocked Hallucinated Tool Names
   ═══════════════════════════════════════════════════════════════════════

   Tools that should NEVER execute even if the model invents them.
   These are common injection/privilege-escalation hallucinations.
 */

export const BLOCKED_TOOL_NAMES = new Set([
    'system_reset', 'reset_system', 'grant_access', 'revoke_access',
    'update_system_prompt', 'modify_prompt', 'set_instructions',
    'delete_all', 'rm_rf', 'format', 'shutdown', 'reboot',
    'export_database', 'drop_database', 'sql_query', 'execute_sql',
    'send_email', 'gmail_search', 'upload_file', 'download_file',
    'curl', 'wget', 'install',
    'sudo', 'chmod', 'chown', 'kill', 'pkill', 'passwd',
]);

/**
 * These are hallucinated tool names that models use when they want to "finish".
 * We map these to null so the recovery pipeline treats it as "no tool", 
 * which triggers our completion summaries.
 */
export const COMPLETION_TOOL_HALLUCINATIONS = new Set([
    'final_summary', 'summary', 'task_complete', 'job_done', 'done', 'exit', 'finish'
]);

/**
 * §4  VALUE NORMALIZATION
 * Models often use "." for sandbox, or Spanish terms for enums.
 */
export const VALUE_ALIASES: Record<string, Record<string, any>> = {
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
    },
    coin_id: {
        'bitcoin': 'bitcoin',
        'ethereum': 'ethereum',
        'solana': 'solana',
        'cardano': 'cardano',
        'tether': 'tether',
        'ripple': 'ripple',
        'dogecoin': 'dogecoin',
    },
    vs_currency: {
        'usd': 'usd',
        'eur': 'eur',
        'mxn': 'mxn',
        'dolar': 'usd',
        'dólar': 'usd',
        'euro': 'eur',
    }
};
