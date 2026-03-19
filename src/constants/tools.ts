/**
 * Tools Constants
 * Agent tools definitions and limits
 */

import type { ToolDefinition, AppConfig } from '../types';

export const MAX_TOOL_ITERATIONS = 10;

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
                    source: { type: 'string', description: 'Where to read from. Defaults to "workSpace".', enum: ['workSpace', 'core', 'library', 'extra', 'tools'] }
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
                    source: { type: 'string', description: 'Where to save. Defaults to "workSpace".', enum: ['workSpace', 'core', 'library', 'extra', 'tools'] }
                },
                required: ['filename', 'content']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'patch_file',
            description: 'Apply one or more smart patches to a file. Supports "fuzzy" match (line-based), "exact" match, and "lineNumber". Always creates a .bak backup.',
            parameters: {
                type: 'object',
                properties: {
                    filename: { type: 'string', description: 'The file to patch.' },
                    find: { type: 'string', description: 'Text to find (Tier 2/3). For "lineNumber", this is optional.' },
                    replace: { type: 'string', description: 'The replacement text.' },
                    strategy: { type: 'string', enum: ['auto', 'exact', 'lineNumber', 'fuzzy', 'regex'], default: 'auto', description: 'Search strategy. "fuzzy" matches a line containing "find".' },
                    lineNumber: { type: 'number', description: 'Optional for "lineNumber" or "auto" strategies.' },
                    patches: {
                        type: 'array',
                        description: 'Apply multiple patches at once. Each object needs {search, replace}.',
                        items: {
                            type: 'object',
                            properties: {
                                search: { type: 'string' },
                                replace: { type: 'string' },
                                lineNumber: { type: 'number' }
                            }
                        }
                    },
                    source: { type: 'string', description: 'Defaults to "workSpace".', enum: ['workSpace', 'core', 'library', 'extra', 'tools'] }
                },
                required: ['filename']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'undo_patch',
            description: 'Revert the last patch made to a file using the backup (.bak) file.',
            parameters: {
                type: 'object',
                properties: {
                    filename: { type: 'string', description: 'The file to revert.' },
                    source: { type: 'string', description: 'Where file lives.', enum: ['workSpace', 'core', 'library', 'extra', 'tools'] }
                },
                required: ['filename']
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
                    source: { type: 'string', description: 'Which mount point to list. Defaults to "workSpace".', enum: ['workSpace', 'core', 'library', 'extra', 'tools'] },
                    directory: { type: 'string', description: 'Optional sub-folder to list (e.g. "src/components").' }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'search_files',
            description: 'High-performance search using native engines (RipGrep, Grep, Findstr). Finds text across all files in a folder.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'The text pattern to search for' },
                    filePattern: { type: 'string', description: 'Optional glob filter (e.g. "*.js").' },
                    caseSensitive: { type: 'boolean', description: 'Defaults to false.' },
                    searchPath: { type: 'string', description: 'Specific sub-folder to search.' },
                    source: { type: 'string', description: 'Defaults to "workSpace".', enum: ['workSpace', 'core', 'library', 'extra', 'tools'] }
                },
                required: ['query']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_file_outline',
            description: 'Extract Classes, Functions, and Interfaces from a source file.',
            parameters: {
                type: 'object',
                properties: {
                    filename: { type: 'string', description: 'The source file.' },
                    source: { type: 'string', description: 'Where file lives.', enum: ['workSpace', 'core', 'library', 'extra', 'tools'] }
                },
                required: ['filename']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'batch_operation',
            description: 'Perform batch file operations like copy, move, or delete with glob pattern support.',
            parameters: {
                type: 'object',
                properties: {
                    operation: { type: 'string', enum: ['copy', 'move', 'delete'], description: 'Type of operation.' },
                    source_path: { type: 'string', description: 'Source path or directory.' },
                    destination_path: { type: 'string', description: 'Target destination (for copy/move).' },
                    pattern: { type: 'string', description: 'Optional glob pattern (e.g. "*.ts").' },
                    source: { type: 'string', enum: ['workSpace', 'core', 'library', 'extra', 'tools'], description: 'Reference mount point.' }
                },
                required: ['operation', 'source_path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_system_metrics',
            description: 'Retrieve real-time OS performance metrics (CPU, RAM, Uptime).',
            parameters: {
                type: 'object',
                properties: {},
                required: []
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
                    source: { type: 'string', description: 'Where file lives. Defaults to "workSpace".', enum: ['workSpace', 'core', 'library', 'extra', 'tools'] }
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
