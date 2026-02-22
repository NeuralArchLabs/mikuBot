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
    skillsConfig: {}
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
    }
];

export const PROTECTED_CORE_FILES = ['SOUL.md', 'USER.md', 'TOOLS.md', 'AGENT_MODES.md', 'AGENTS_MODES.md'];

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

// ── Blueprint Templates for Library Manager ─────────────────────────
export const BLUEPRINT_TEMPLATES: Record<string, { title: string; icon: string; content: string }> = {
    budget: {
        title: 'Presupuesto Mensual',
        icon: 'dollar-sign',
        content: `# 💰 Presupuesto Mensual — [MES/AÑO]

## Ingresos
| Concepto | Monto |
|----------|-------|
| Salario principal | $0.00 |
| Freelance / Extras | $0.00 |
| **Total Ingresos** | **$0.00** |

## Gastos Fijos
| Concepto | Monto | Fecha Pago |
|----------|-------|------------|
| Renta / Hipoteca | $0.00 | — |
| Servicios (Luz, Agua, Gas) | $0.00 | — |
| Internet / Teléfono | $0.00 | — |
| Seguros | $0.00 | — |
| Transporte | $0.00 | — |
| **Total Fijos** | **$0.00** | |

## Gastos Variables
| Concepto | Presupuesto | Real | Diferencia |
|----------|-------------|------|------------|
| Alimentación | $0.00 | $0.00 | — |
| Entretenimiento | $0.00 | $0.00 | — |
| Ropa / Personal | $0.00 | $0.00 | — |
| **Total Variables** | **$0.00** | **$0.00** | |

## Ahorro & Inversión
| Destino | Meta | Depositado |
|---------|------|------------|
| Fondo de emergencia | $0.00 | $0.00 |
| Inversiones | $0.00 | $0.00 |

## Balance Final
- **Ingresos**: $0.00
- **Egresos**: $0.00
- **Ahorro**: $0.00
- **Balance**: $0.00
`
    },
    project: {
        title: 'Plan Rector de Proyecto',
        icon: 'project-diagram',
        content: `# 🎯 Plan Rector — [Nombre del Proyecto]

## Visión
> Describe en 1-2 oraciones qué problema resuelve y para quién.

## Objetivos SMART
1. **Específico**: —
2. **Medible**: —
3. **Alcanzable**: —
4. **Relevante**: —
5. **Temporal**: Fecha límite: [DD/MM/AAAA]

## Fases y Entregables
| Fase | Descripción | Entregable | Fecha Límite | Estado |
|------|-------------|------------|--------------|--------|
| 1. Investigación | — | Documento de hallazgos | — | ⬜ |
| 2. Diseño | — | Wireframes / Mockups | — | ⬜ |
| 3. Desarrollo | — | MVP funcional | — | ⬜ |
| 4. Testing | — | Reporte de QA | — | ⬜ |
| 5. Lanzamiento | — | Versión 1.0 | — | ⬜ |

## Stack Tecnológico
- **Frontend**: —
- **Backend**: —
- **Base de Datos**: —
- **Deployment**: —

## Riesgos Identificados
| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| — | Baja/Media/Alta | — | — |

## Notas y Decisiones
- [Fecha]: —
`
    },
    routine: {
        title: 'Rutina Diaria',
        icon: 'clock',
        content: `# 🕐 Rutina Diaria — [Nombre / Contexto]

## Bloque Matutino (6:00 – 12:00)
| Hora | Actividad | Duración | Prioridad |
|------|-----------|----------|-----------|
| 06:00 | Despertar + Hidratación | 15 min | 🔴 Alta |
| 06:15 | Ejercicio / Estiramiento | 30 min | 🔴 Alta |
| 06:45 | Ducha + Preparación | 30 min | 🟡 Media |
| 07:15 | Desayuno | 20 min | 🔴 Alta |
| 07:35 | Revisión de Agenda | 10 min | 🔴 Alta |
| 08:00 | Bloque de Trabajo Profundo #1 | 2 hrs | 🔴 Alta |
| 10:00 | Pausa activa | 15 min | 🟡 Media |
| 10:15 | Bloque de Trabajo Profundo #2 | 1.5 hrs | 🔴 Alta |

## Bloque Vespertino (12:00 – 18:00)
| Hora | Actividad | Duración | Prioridad |
|------|-----------|----------|-----------|
| 12:00 | Almuerzo | 45 min | 🔴 Alta |
| 12:45 | Caminata / Descanso | 15 min | 🟢 Baja |
| 13:00 | Reuniones / Colaboración | 2 hrs | 🟡 Media |
| 15:00 | Bloque de Aprendizaje | 1 hr | 🟡 Media |
| 16:00 | Tareas administrativas | 1 hr | 🟢 Baja |
| 17:00 | Cierre del día laboral | 30 min | 🔴 Alta |

## Bloque Nocturno (18:00 – 22:00)
| Hora | Actividad | Duración | Prioridad |
|------|-----------|----------|-----------|
| 18:00 | Ejercicio / Hobby | 1 hr | 🟡 Media |
| 19:00 | Cena | 30 min | 🔴 Alta |
| 19:30 | Tiempo personal / Familia | 1.5 hrs | 🔴 Alta |
| 21:00 | Lectura / Reflexión | 30 min | 🟡 Media |
| 21:30 | Preparación para dormir | 30 min | 🔴 Alta |

## Reglas de la Rutina
- ⏰ Sin pantallas después de las 21:30
- 💧 Mínimo 2L de agua al día
- 🎯 Completar al menos 1 tarea de alta prioridad antes del mediodía
`
    },
    learning: {
        title: 'Bitácora de Aprendizaje',
        icon: 'graduation-cap',
        content: `# 📓 Bitácora de Aprendizaje — [Tema / Curso]

## Meta de Aprendizaje
> ¿Qué quiero dominar y para cuándo?

**Tema**: —
**Nivel actual**: Principiante / Intermedio / Avanzado
**Nivel objetivo**: —
**Fecha límite**: [DD/MM/AAAA]

## Recursos
| Recurso | Tipo | URL / Ubicación | Completado |
|---------|------|-----------------|------------|
| — | Libro / Curso / Video | — | ⬜ |
| — | Documentación | — | ⬜ |
| — | Proyecto práctico | — | ⬜ |

## Registro de Sesiones
### Sesión 1 — [Fecha]
**Duración**: — min
**Tema cubierto**: —
**Conceptos clave aprendidos**:
- —
- —

**Preguntas pendientes**:
- —

**Próximos pasos**:
- —

## Hitos
| Hito | Descripción | Estado | Fecha |
|------|-------------|--------|-------|
| 1 | Fundamentos | ⬜ | — |
| 2 | Primer proyecto | ⬜ | — |
| 3 | Proyecto intermedio | ⬜ | — |
| 4 | Dominio | ⬜ | — |

## Reflexiones
- [Fecha]: —
`
    }
};
