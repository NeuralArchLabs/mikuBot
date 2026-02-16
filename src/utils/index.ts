import { ToolCall, AgentStatus } from '../types';
import { AGENT_TOOLS } from '../constants';

export async function safeFetch(url: string, options: any = {}) {
    const isElectron = !!(window as any).electron?.invoke;
    console.log(`[mikuBot] safeFetch: ${url} (Mode: ${isElectron ? 'Electron Proxy' : 'Browser Direct'})`);

    if (isElectron) {
        const result = await (window as any).electron.invoke('fetch-proxy', { url, options });
        if (!result.ok) {
            const errorDetails = result.data ? JSON.stringify(result.data) : '';
            throw new Error(`${result.error || `HTTP ${result.status}`} ${errorDetails}`);
        }
        return result.data;
    }
    const response = await fetch(url, options);
    // ... rest of the function stays the same
    if (!response.ok) {
        let errText = '';
        try { errText = await response.text(); } catch { }
        throw new Error(errText || `HTTP ${response.status}`);
    }
    return response.json();
}

export function validateToolArgs(toolCall: ToolCall): { valid: boolean; error?: string } {
    const { name, arguments: args } = toolCall.function;
    const toolDef = AGENT_TOOLS.find(t => t.function.name === name);
    if (!toolDef) {
        return { valid: false, error: `Unknown tool "${name}". Available: ${AGENT_TOOLS.map(t => t.function.name).join(', ')}` };
    }
    const params = toolDef.function.parameters;
    for (const field of params.required) {
        if (args[field] === undefined || args[field] === null) {
            return { valid: false, error: `Missing required field "${field}" for tool "${name}". Expected: ${params.properties[field]?.description || field}` };
        }
    }
    for (const [key, value] of Object.entries(args)) {
        const paramDef = params.properties[key];
        if (paramDef?.enum && !paramDef.enum.includes(value as string)) {
            return { valid: false, error: `Invalid value "${value}" for "${key}". Must be one of: ${paramDef.enum.join(', ')}` };
        }
    }
    return { valid: true };
}

export function extractToolCallsFromText(text: string): ToolCall[] {
    const calls: ToolCall[] = [];
    const toolNames = AGENT_TOOLS.map(t => t.function.name);

    // 1. Match fn_name({...}) style
    for (const tn of toolNames) {
        // Regex to find fn_name followed by a balanced brace object
        const fnRegex = new RegExp(`${tn}\\s*\\(\\s*(\\{)`, 'g');
        let match;
        while ((match = fnRegex.exec(text)) !== null) {
            const startIdx = match.index + match[0].length - 1; // index of '{'
            const obj = extractBalancedObject(text, startIdx);
            if (obj) {
                try {
                    const args = JSON.parse(obj);
                    calls.push({
                        id: `ext-${Math.random().toString(36).slice(2, 11)}`,
                        function: { name: tn, arguments: args }
                    });
                } catch { /* skip */ }
            }
        }
    }

    // 2. Match { "name": "...", "arguments": {...} } style
    // Look for any object start that contains "name" and "arguments" keys
    const objStartRegex = /\{/g;
    let objMatch;
    while ((objMatch = objStartRegex.exec(text)) !== null) {
        const obj = extractBalancedObject(text, objMatch.index);
        if (obj) {
            try {
                const parsed = JSON.parse(obj);
                if (parsed.name && parsed.arguments && toolNames.includes(parsed.name)) {
                    // Check if already captured
                    if (!calls.some(c => c.function.name === parsed.name && JSON.stringify(c.function.arguments) === JSON.stringify(parsed.arguments))) {
                        calls.push({
                            id: `ext-${Math.random().toString(36).slice(2, 11)}`,
                            function: { name: parsed.name, arguments: parsed.arguments }
                        });
                    }
                }
            } catch { /* skip */ }
        }
    }

    return calls;
}

/**
 * Extracts a balanced JSON object string starting from a given index in a text.
 */
function extractBalancedObject(text: string, startIndex: number): string | null {
    let braceCount = 0;
    let inString = false;
    let escape = false;

    for (let i = startIndex; i < text.length; i++) {
        const char = text[i];

        if (escape) {
            escape = false;
            continue;
        }

        if (char === '\\') {
            escape = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            continue;
        }

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

export function createDefaultAgentStatus(): AgentStatus {
    return {
        phase: 'idle',
        iteration: 0,
        retries: 0,
        maxRetries: 10,
        elapsedMs: 0,
        currentTool: null,
        log: [],
        streamedText: '',
        errorCount: 0,
    };
}

export const toHtml = (md: string): string => {
    if (!md) return '';

    let html = md
        .replace(/<think>([\s\S]*?)<\/think>/g, '<details class="think-block"><summary>Thinking Process</summary>$1</details>')
        .replace(/<think>([\s\S]*?)$/g, '<details class="think-block"><summary>Thinking Process</summary>$1</details>');

    html = html
        .replace(/<details/g, '‹details')
        .replace(/<\/details>/g, '‹/details›')
        .replace(/<summary>/g, '‹summary›')
        .replace(/<\/summary>/g, '‹/summary›');

    html = html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    html = html
        .replace(/‹details/g, '<details')
        .replace(/‹\/details›/g, '</details>')
        .replace(/‹summary›/g, '<summary>')
        .replace(/‹\/summary›/g, '</summary>');

    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-black/30 p-3 rounded-lg my-2 overflow-x-auto border border-white/10"><code class="text-sm shadow-none">$2</code></pre>');
    html = html.replace(/`([^`\n]+)`/g, '<code class="bg-black/30 px-1.5 py-0.5 rounded text-amber-300 font-mono text-xs border border-white/10">$1</code>');

    html = html.replace(/^### (.+)$/gm, '<h3 class="text-md font-bold text-slate-300 mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-slate-200 mt-6 mb-3 border-b border-white/5 pb-1">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 class="text-xl font-extrabold text-white mt-8 mb-4 border-b border-white/10 pb-2">$1</h1>');

    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="text-amber-200"><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-blue-200">$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em class="text-slate-400">$1</em>');

    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">$1</a>');
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-4 border-blue-500/30 pl-4 italic text-slate-400 my-2 bg-blue-500/5 py-2 pr-2 rounded-r">$1</blockquote>');

    // Lists with proper indentation
    html = html.replace(/^- (.+)$/gm, '<li class="ml-5 list-disc list-outside marker:text-slate-500 pl-1">$1</li>');
    html = html.replace(/^(\d+)\. (.+)$/gm, '<li class="ml-5 list-decimal list-outside marker:text-slate-500 pl-1">$2</li>');

    return html;
};
