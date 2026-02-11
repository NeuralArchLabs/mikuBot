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
    apiKeys: { groq: '', gemini: '', ollama: '' },
    ollamaUrl: 'http://localhost:11434',
    temperature: 0.7,
    tavilyApiKey: '',
    braveApiKey: ''
};

export const AGENT_TOOLS: ToolDefinition[] = [
    {
        type: 'function',
        function: {
            name: 'read_file',
            description: 'Read the contents of a file. Source defaults to "sandbox". Use "core" for identity/memory files, "library" for reference material.',
            parameters: {
                type: 'object',
                properties: {
                    filename: { type: 'string', description: 'The filename to read (e.g. SOUL.md, project/index.html)' },
                    source: { type: 'string', description: 'Where to read from. Defaults to "sandbox".', enum: ['sandbox', 'core', 'library'] }
                },
                required: ['filename']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'update_file',
            description: 'Create or update a file. By default files are saved in the sandbox working directory. Use "core" only for memory files like ACTIVE_CONTEXT.md. Use "library" for reference notes. Directories are auto-created.',
            parameters: {
                type: 'object',
                properties: {
                    filename: { type: 'string', description: 'The file path to write (e.g. project/index.html). Directories auto-created.' },
                    content: { type: 'string', description: 'The full content for the file' },
                    source: { type: 'string', description: 'Where to save. Defaults to "sandbox".', enum: ['sandbox', 'core', 'library'] }
                },
                required: ['filename', 'content']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'list_files',
            description: 'List all files in a folder. Source defaults to "sandbox".',
            parameters: {
                type: 'object',
                properties: {
                    source: { type: 'string', description: 'Which folder to list. Defaults to "sandbox".', enum: ['sandbox', 'core', 'library'] }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'search_files',
            description: 'Search for a text pattern across all files in a folder. Source defaults to "sandbox".',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'The text pattern to search for' },
                    source: { type: 'string', description: 'Which folder to search. Defaults to "sandbox".', enum: ['sandbox', 'core', 'library'] }
                },
                required: ['query']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'web_search',
            description: 'Search the web for real-time information. Use to find news, documentation, or any data not present in local files.',
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
            description: 'Execute a console command in the sandbox workspace. RESTRICTED: only whitelisted commands are allowed (git, node, npm, npx, ls, dir, cat, type, echo, mkdir, cd, pwd, grep, find, head, tail, wc, tree, tsc, python). This tool requires elevated security approval. Use it for running scripts, checking file contents, or development tasks.',
            parameters: {
                type: 'object',
                properties: {
                    command: { type: 'string', description: 'The command/binary to run (e.g. "git", "node", "npm"). Must be in the allowed list.' },
                    args: { type: 'string', description: 'Arguments to pass to the command as a single string (e.g. "status", "run dev", "install lodash")' },
                    cwd: { type: 'string', description: 'Optional working directory relative to sandbox root. Defaults to sandbox root.' }
                },
                required: ['command']
            }
        }
    }
];

export const PROTECTED_CORE_FILES = ['SOUL.md', 'USER.md', 'TOOLS.md', 'AGENT_MODES.md'];

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
