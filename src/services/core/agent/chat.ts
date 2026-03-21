/**
 * Agent Chat & Conversation Utilities
 * Path: src/services/core/agent/chat.ts
 * REWIRED: Literal copy from original agent.ts
 */
import { MessageBlock, ToolCall, FileTarget } from '../../../types';
import { TOOL_NAME_ALIASES } from '../../formatters/normalization/dictionaries';

/**
 * Cleans technical noise, protocol echoes, and JSON fragments from segments.
 */
export function cleanTechnicalNoise(text: string, signatureRegex?: RegExp): string {
    let s = (text || '').trim();
    if (!s) return '';

    // 1. ELIMINAR ETIQUETAS XML (Ghost tools) Y PENSAMIENTO FORZADO
    s = s.replace(/<\|?tool_call\|?>[\s\S]*?<\|?\/?tool_call\|?>/gi, '');
    s = s.replace(/<think>[\s\S]*?<\/think>/gi, '');

    // 2. ELIMINAR BLOQUES JSON COMPLETOS Y FRAGMENTADOS
    s = s.replace(/```(?:json|JSON)?\s*\{[\s\S]*?\}\s*```/gi, '');

    // Objetos JSON técnicos por marcadores
    s = s.replace(/\{[\s\S]*?\}/g, (match) => {
        const lowerMatch = match.toLowerCase();
        const toolMarkers = [
            '"name":', '"action":', '"function":', '"filename":',
            '"content":', '"url":', '"query":', '"coin_id":',
            '"text":', '"args":', '"arguments":'
        ];
        return toolMarkers.some(m => lowerMatch.includes(m.toLowerCase())) ? '' : match;
    });

    s = s.replace(/\{\s*"(?:name|action|function|tool_call|arguments|args)"\s*:.*$/gim, '');
    s = s.replace(/^\s*[\}\],]+\s*$/gm, '');
    s = s.replace(/[\}\],]+\s*$/g, '');

    // 3. ELIMINAR BLOQUES DE IDENTIDAD (Soul signature) para evitar duplicados en narrativa
    // Si se pasa un regex específico, lo usamos; si no, usamos el patrón universal
    const sigPattern = signatureRegex || /\{\{?[\s\S]*?[🌅🌌🌑✨⚡🧩🧠🌊🔥🔋].*?\}\}?/g;
    s = s.replace(sigPattern, '');

    // 4. ELIMINAR ECOS DEL PROTOCOLO Y LOGS TÉCNICOS
    const noisePatterns = [
        /^(?:I apologize|My apologies|You are right|You are correct)[\s\S]*?(?={|\[|{{)/i,
        /^(?:Thinking Process|Neural Flow|Neural Core|Proceso de Razonamiento|Active Reasoning|Razonamiento Activo|Flujo Neural|Core de Miku|Razonamiento)[\s\S]*?(?={|\[|{{)/i,
        /^\s*(?:Active Reasoning|Razonamiento Activo|Razonamiento|Neural Core|Miku Core|READY|SUCCESS|ERROR|FAILURE|WEB_SEARCH|SEARCHING|ANALYZING|DONE|COMPLETED)\s*$/gim,
        /\[[x\s]\]\s*@?(?:CORE|EXTRA|WORKSPACE|TOOLS|LIBRARY)\/[^\s]*/gi,
        /^(?:tool_call|web_search|read_file|update_file|patch_file|delete_file|run_console|add_scheduled_task|final_answer|list_files|search_files|read_url)[:\s]*/gim,
        /Tool Calls:\s*\[[\s\S]*?\]/gi, 
        /(?:^|\n)Tool Calls[:\s]*/gi,
        /\[\s*\{\s*"id":[\s\S]*?\}\s*\]/gi,
        /^(?:\[assistant\]|\[tool\]|\[user\]|\[system\])[:\s]*/gim,
        /^\s*[-*=_]{3,}\s*\n/i, // Strip leading separator line
        /\n\s*[-*=_]{3,}\s*$/i // Strip trailing separator line
    ];
    noisePatterns.forEach(p => s = s.replace(p, ''));

    // 5. LIMPIEZA DE CERCAS Y ESPACIOS SOBRANTES
    s = s.replace(/```(?:json|JSON)?/gi, '');
    s = s.replace(/```/g, '');

    return s.trim();
}

/**
 * Segments a text into thought and narrative blocks, preserving <think> content.
 */
export function segmentThoughtsAndNarrative(text: string, signatureRegex: RegExp): MessageBlock[] {
    if (!text) return [];
    
    // Check for <think> tags
    const thinkRegex = /<think>([\s\S]*?)(?:<\/think>|$)/gi;
    const blocks: MessageBlock[] = [];
    let lastIdx = 0;
    let match;

    while ((match = thinkRegex.exec(text)) !== null) {
        // Text before the <think> tag
        const preamble = text.substring(lastIdx, match.index);
        if (preamble.trim()) {
            const cleaned = cleanTechnicalNoise(preamble, signatureRegex);
            if (cleaned) blocks.push({ type: 'answer', content: cleaned, isFromNarrative: true });
        }
        
        // The thought content itself
        if (match[1].trim()) {
            blocks.push({ type: 'thought', content: match[1].trim() });
        }
        lastIdx = thinkRegex.lastIndex;
    }

    // Remaining text after last <think> tag
    const remaining = text.substring(lastIdx);
    if (remaining.trim()) {
        const cleaned = cleanTechnicalNoise(remaining, signatureRegex);
        if (cleaned) blocks.push({ type: 'answer', content: cleaned, isFromNarrative: true });
    }

    return blocks;
}

export function extractToolSnippet(toolName: string, currentFiles: any, currentTools: any): string {
    // 1. Try to find in CORE Library
    const libraryFile = Object.keys(currentFiles).find(k => k.toLowerCase().endsWith('tool_usage_library.md'));
    const libraryContent = libraryFile ? currentFiles[libraryFile] : '';

    if (libraryContent) {
        const escapedName = toolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`## \\[${escapedName}\\]\\s*\\r?\\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
        const match = libraryContent.match(regex);
        if (match) return match[1].trim();
    }

    // 2. Try to find in Skill Folder (usage.md)
    const skillUsageFile = Object.keys(currentTools).find(k =>
        k.toLowerCase().includes(toolName.toLowerCase()) && k.toLowerCase().endsWith('usage.md')
    );
    if (skillUsageFile) return currentTools[skillUsageFile];

    return "";
}

export function autoExtractSources(actions: string[], history: any[], tools: any[]): string[] {
    const found: Set<string> = new Set();

    // 1. Scan for filenames (exclude internal protocol files)
    actions.forEach(a => {
        const fileMatch = a.match(/"filename"\s*:\s*"(.*?)"/i);
        if (fileMatch) {
            const fn = fileMatch[1];
            const isInternal = fn.startsWith('@CORE/') || fn.toLowerCase() === 'tasks.md' || fn.toLowerCase() === 'active_context.md';
            if (!isInternal) found.add(fn);
        }
    });

    // 2. Cross-reference actions with dynamic tool metadata
    actions.forEach(a => {
        tools.forEach(t => {
            const toolName = t.function.name;
            // Check if toolName is present in the action string (e.g. "tool_name(...)")
            const nameRegex = new RegExp(`(^|[^a-zA-Z0-9_])${toolName}([^a-zA-Z0-9_]|$)`, 'i');
            if (nameRegex.test(a)) {
                const canonical = (TOOL_NAME_ALIASES as any)[toolName.toLowerCase()] || toolName;
                if (['web_search', 'read_url'].includes(canonical)) {
                    found.add("Investigación Web");
                } else if (canonical !== 'final_answer' && !['read_file', 'update_file', 'patch_file', 'delete_file', 'list_files', 'search_files'].includes(canonical)) {
                    // Use the first part of the description as the source name
                    const desc = t.function.description.split('.')[0].split('|')[0].trim();
                    found.add(`Neural Skill: ${desc || toolName}`);
                }
            }
        });
    });

    // 3. Scan for URLs in tool responses
    history.forEach(m => {
        if (m.role === 'tool' && typeof m.content === 'string' && m.content.length < 5000) {
            const urls = m.content.match(/https?:\/\/[a-z0-9.-]+\.[a-z]{2,}/gi);
            if (urls) urls.slice(0, 2).forEach(u => found.add(u));
        }
    });
    return Array.from(found);
}

export async function applyBatchTaskTicking(
    toolCalls: ToolCall[], 
    currentFiles: any, 
    currentWorkSpace: any, 
    saveFileFn: any,
    onLog: (msg: string) => void
): Promise<{ modified: boolean, turnAutoTasks: string[] }> {
    const turnAutoTasks: string[] = [];
    if (toolCalls.length === 0) return { modified: false, turnAutoTasks };
    
    const findTaskStore = () => {
        // Enforce STRICT predefined route: @CORE/tasks.md
        const keys = Object.keys(currentFiles);
        const taskKey = keys.find(k => k.toLowerCase() === 'tasks.md');
        if (taskKey) return { store: currentFiles, target: 'core' as FileTarget, key: taskKey };
        return null;
    };



    const taskInfo = findTaskStore();
    if (!taskInfo) return { modified: false, turnAutoTasks };

    const { store, target, key } = taskInfo;
    const content = store[key];
    if (!content || !content.trim()) return { modified: false, turnAutoTasks };

    let lines = content.split('\n');
    let modified = false;

    // Mapping tool names to natural language synonyms for better detection
    const toolSynonyms: Record<string, string[]> = {
        'read_file': ['leer', 'consultar', 'revisar', 'analizar', 'ver'],
        'update_file': ['escribir', 'crear', 'guardar', 'modificar', 'actualizar', 'generar'],
        'patch_file': ['parchear', 'aplicar', 'arreglar', 'corregir', 'editar'],
        'list_files': ['listar', 'explorar', 'ver archivos', 'inspeccionar'],
        'search_files': ['buscar', 'encontrar', 'localizar'],
        'web_search': ['investigar', 'noticias', 'google', 'buscar en internet', 'web_research', 'deep_research'],
        'web_research': ['investigar', 'noticias', 'google', 'buscar en internet', 'web_search', 'deep_research'],
        'deep_research': ['investigar', 'noticias', 'google', 'buscar en internet', 'web_search', 'web_research'],
        'run_console': ['ejecutar', 'comando', 'terminal', 'consola', 'git'],
        'get_system_metrics': ['métricas', 'cpu', 'ram', 'estado del sistema', 'salud'],
        'list_available_skills': ['habilidades', 'skills', 'capacidades', 'funciones extra'],
        'miku_clock': ['hora', 'reloj', 'tiempo', 'quién eres'],
        'get_crypto_price': ['bitcoin', 'crypto', 'precio', 'cripto', 'cotización', 'moneda'],
        'delete_file': ['borrar', 'eliminar', 'quitar', 'limpiar', 'suprimir'],
        'final_answer': ['finalizar', 'terminar', 'concluir', 'respuesta', 'completar', 'reportar', 'informar', 'conclusión']
    };

    for (const toolCall of toolCalls) {
        const toolName = toolCall.function.name;
        const args = toolCall.function.arguments || {};
        const mainArg = (args.filename || args.query || args.topic || args.url || args.command || args.path || '').toString();
        
        let markedInThisPass = false;
        lines = lines.map(line => {
            // Skip already done or empty
            if (markedInThisPass || !line.trim().startsWith('- [ ]')) return line;

            const lowerLine = line.toLowerCase();
            const lowerTool = toolName.toLowerCase();
            const lowerArg = mainArg.toLowerCase();
            
            // Rule 1: Direct name match (e.g., "- [ ] @web_search")
            const directMatch = lowerLine.includes(lowerTool) || lowerLine.includes(`@${lowerTool}`);
            
            // Rule 2: Synonym match
            const hasSynonym = (toolSynonyms[lowerTool] || []).some(s => lowerLine.includes(s));
            const toolMatch = directMatch || hasSynonym;
            
            // Rule 3: Argument match (if applicable)
            const argMatch = lowerArg.length > 2 && lowerLine.includes(lowerArg);
            
            // Exclude meta-updates to tasks.md
            if (lowerTool === 'update_file' || lowerTool === 'patch_file') {
                if (lowerArg.includes('tasks.md')) return line;
            }

            // COHERENCE POLICY: Match if tool concept matches target concept
            if (toolMatch && (argMatch || lowerArg === "")) {
                modified = true;
                markedInThisPass = true;
                const taskName = line.replace('- [ ]', '').trim();
                if (!turnAutoTasks.includes(taskName)) turnAutoTasks.push(taskName);
                return line.replace('- [ ]', '- [x]');
            }
            return line;
        });
    }

    if (modified) {
        const newContent = lines.join('\n').trim();
        await saveFileFn(key, newContent, target);
        store[key] = newContent;
    }
    
    return { modified, turnAutoTasks };
}

export function getActionFingerprint(toolName: string, args: Record<string, any>): string {
    const sortedArgs = Object.keys(args).sort().reduce((acc, key) => {
        acc[key] = args[key];
        return acc;
    }, {} as Record<string, any>);
    return `${toolName}|${JSON.stringify(sortedArgs)}`;
}
