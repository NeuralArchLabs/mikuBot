import { Provider, ProviderConfig, AppConfig, ToolDefinition } from '../types';

export const PROVIDERS: Record<Provider, ProviderConfig> = {
    groq: {
        name: 'Groq',
        icon: 'bolt',
        color: 'from-orange-500 to-amber-500',
        apiKeyRequired: true,
        baseUrl: 'https://api.groq.com/openai/v1',
        getApiKeyUrl: 'https://console.groq.com/keys'
    },
    gemini: {
        name: 'Google Gemini',
        icon: 'gem',
        color: 'from-blue-500 to-cyan-500',
        apiKeyRequired: true,
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        getApiKeyUrl: 'https://aistudio.google.com/apikey'
    },
    ollama: {
        name: 'Ollama (Local)',
        icon: 'server',
        color: 'from-emerald-500 to-green-500',
        apiKeyRequired: false,
        baseUrl: 'http://localhost:11434'
    }
};

export const DEFAULT_FILES: Record<string, string> = {};

export const DEFAULT_CONFIG: AppConfig = {
    provider: 'groq',
    model: '',
    chatProvider: 'groq',
    chatModel: '',
    agentProvider: 'groq',
    agentModel: '',
    apiKeys: { groq: '', gemini: '', ollama: '' },
    ollamaUrl: 'http://localhost:11434',
    temperature: 0.7,
    tavilyApiKey: '',
    braveApiKey: '',
    telegramBotToken: '',
    telegramChatId: '',
    folderNames: { core: '', extra: '', workSpace: '', tools: '' },
    folderPaths: { core: '', extra: '', workSpace: '', tools: '' },
    skillsConfig: {},
    disabledSkills: []
};

export const AGENT_TOOLS: ToolDefinition[] = [
    {
        type: 'function',
        function: {
            name: 'read_file',
            description: 'Read a file content. Do not check if it exists via list_files first; if you know the name, just read it. Source defaults to "workSpace".',
            parameters: {
                type: 'object',
                properties: {
                    filename: { type: 'string', description: 'The filename to read (e.g. SOUL.md, project/index.html)' },
                    source: { type: 'string', description: 'Where to read from. Defaults to "workSpace".', enum: ['workSpace', 'core', 'library'] }
                },
                required: ['filename']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'update_file',
            description: 'Create or update a file. Directories are AUTO-CREATED. Do not use list_files to "check" paths before writing. Source defaults to "workSpace".',
            parameters: {
                type: 'object',
                properties: {
                    filename: { type: 'string', description: 'The file path (e.g. docs/api.md). Directories auto-created.' },
                    content: { type: 'string', description: 'The full content for the file' },
                    source: { type: 'string', description: 'Where to save. Defaults to "workSpace".', enum: ['workSpace', 'core', 'library'] }
                },
                required: ['filename', 'content']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'patch_file',
            description: 'Patch a section of an existing file. Preferred for partial edits on large files. The "find" text must match EXACTLY.',
            parameters: {
                type: 'object',
                properties: {
                    filename: { type: 'string', description: 'The file to patch.' },
                    find: { type: 'string', description: 'The exact text block to find. Must match character-for-character.' },
                    replace: { type: 'string', description: 'The replacement text.' },
                    source: { type: 'string', description: 'Where the file lives. Defaults to "workSpace".', enum: ['workSpace', 'core', 'library'] }
                },
                required: ['filename', 'find', 'replace']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'list_files',
            description: 'List all files in a folder. Use this ONLY if you are genuinely lost or need to discover a file name you don\'t already know.',
            parameters: {
                type: 'object',
                properties: {
                    source: { type: 'string', description: 'Which folder to list. Defaults to "workSpace".', enum: ['workSpace', 'core', 'library'] }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'search_files',
            description: 'Search for a text pattern across all files in a folder.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'The text pattern to search for' },
                    source: { type: 'string', description: 'Which folder to search. Defaults to "workSpace".', enum: ['workSpace', 'core', 'library'] }
                },
                required: ['query']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'web_search',
            description: 'Search the web for real-time information. Use for news, documentation, or public data.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'The search query' },
                    search_depth: { type: 'string', description: 'Search depth', enum: ['basic', 'advanced'] }
                },
                required: ['query']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'read_url',
            description: 'Fetch and extract the main content from a URL.',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'The URL to read' }
                },
                required: ['url']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'run_console',
            description: 'Execute whitelisted console commands (git, node, npm, etc). Requires elevated approval.',
            parameters: {
                type: 'object',
                properties: {
                    command: { type: 'string', description: 'The command binary (e.g. "git").' },
                    args: { type: 'string', description: 'Arguments string (e.g. "status").' },
                    cwd: { type: 'string', description: 'Optional working directory.' }
                },
                required: ['command']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'send_telegram_message',
            description: 'Envía un mensaje a un bot de Telegram. Útil para notificaciones o comunicación remota fuera de la PC.',
            parameters: {
                type: 'object',
                properties: {
                    text: { type: 'string', description: 'El contenido del mensaje a enviar.' },
                    chat_id: { type: 'string', description: 'Opcional. ID de chat de Telegram; si no se provee se usa el configurado por defecto.' }
                },
                required: ['text']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'delete_file',
            description: 'Delete a file. Use this to clean up temporary files or specifically to remove @CORE/TASKS.md after completing a plan.',
            parameters: {
                type: 'object',
                properties: {
                    filename: { type: 'string', description: 'The filename to delete.' },
                    source: { type: 'string', description: 'Where the file lives. Defaults to "workSpace".', enum: ['workSpace', 'core', 'library'] }
                },
                required: ['filename']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'final_answer',
            description: 'Synthesize all gathered data into a final response. Cite sources. Use this ONLY to conclude the task.',
            parameters: {
                type: 'object',
                properties: {
                    text: { type: 'string', description: 'The final synthesized result.' },
                    reasoning: { type: 'string', description: 'Brief internal logic.' },
                    sources: { type: 'array', items: { type: 'string', description: 'Source reference' }, description: 'List of URLs or files used.' }
                },
                required: ['text']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'add_scheduled_task',
            description: 'Programar una nueva tarea autónoma para que Miku la ejecute proactivamente en el futuro.',
            parameters: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Nombre de la tarea' },
                    prompt: { type: 'string', description: 'Instrucción detallada para el agente' },
                    scheduleType: { type: 'string', enum: ['once', 'interval', 'cron'], description: 'Tipo de programación' },
                    schedule: { type: 'string', description: 'Valor (ISO date, minutos, o cron expression)' },
                    channel: { type: 'string', enum: ['telegram', 'ui', 'both'], default: 'both', description: 'Canal de salida para la respuesta del agente' },
                    mode: { type: 'string', enum: ['chat', 'agent'], default: 'agent', description: 'El modo en que el agente debe procesar la tarea' },
                    enabled: { type: 'boolean', default: true, description: 'Si la tarea debe estar activa inmediatamente' },
                    maxExecutionsPerDay: { type: 'number', default: 0, description: 'Límite opcional de ejecuciones por día (0 = ilimitado)' }
                },
                required: ['name', 'prompt', 'scheduleType', 'schedule']
            }
        }
    }
];

export const PROTECTED_CORE_FILES = ['SOUL.md', 'USER.md', 'TOOLS.md', 'AGENT_MODES.md', 'MODES.md'];

/**
 * Whitelist of allowed console binaries.
 * Anything NOT on this list will be rejected before execution.
 */
export const CONSOLE_ALLOWED_COMMANDS = [
    'git', 'node', 'npm', 'npx', 'ls', 'dir', 'cat', 'type',
    'echo', 'mkdir', 'cd', 'pwd', 'grep', 'find', 'head', 'tail',
    'wc', 'tree', 'tsc', 'python', 'pip',
];

/**
 * Patterns that should NEVER appear in command arguments.
 * These block shell injection via metacharacters and path traversal.
 */
export const CONSOLE_BLOCKED_PATTERNS: RegExp[] = [
    /&&/,           // command chaining
    /\|\|/,         // OR chaining
    /\|/,           // pipe
    /;/,            // semicolon chaining
    /`/,            // backtick execution
    /\$\(/,         // subshell
    />\s*\//,       // redirect to root
    /rm\s+(-[rRf]|--)/,  // recursive/force delete
    /del\s+\//,     // Windows delete with root path
    /\.\.\//,       // path traversal
    /\.\.\\/,       // Windows path traversal
];

export const DB_NAME = 'mikuBot_DB';
export const STORE_NAME = 'handles';

export const MAX_TOOL_ITERATIONS = 10;

// Blueprints are now loaded dynamically from core/base/blueprints/ via listBlueprints IPC
