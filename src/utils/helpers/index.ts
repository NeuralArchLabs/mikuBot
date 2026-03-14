import { ToolCall, ToolDefinition, AgentStatus } from '../../types';
import { AGENT_TOOLS } from '../../constants';

export async function safeFetch(url: string, options: any = {}) {
    const isElectron = !!(window as any).electron?.fetchProxy;
    console.log(`[mikuBot] safeFetch: ${url} (Mode: ${isElectron ? 'Electron Proxy' : 'Browser Direct'})`);

    if (isElectron) {
        const result = await (window as any).electron.fetchProxy({ url, options });
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

export function validateToolArgs(toolCall: ToolCall, tools: ToolDefinition[]): { valid: boolean; error?: string } {
    const { name, arguments: args } = toolCall.function;
    const toolDef = tools.find(t => t.function.name === name);
    if (!toolDef) {
        return { valid: false, error: `Unknown tool "${name}". Available: ${tools.map(t => t.function.name).join(', ')}` };
    }
    const params = toolDef.function.parameters;
    const requiredFields = params?.required || [];
    const properties = params?.properties || {};
    for (const field of requiredFields) {
        if (args[field] === undefined || args[field] === null) {
            return { valid: false, error: `Missing required field "${field}" for tool "${name}". Expected: ${properties[field]?.description || field}` };
        }
    }
    for (const [key, value] of Object.entries(args)) {
        const paramDef = properties[key];
        if (paramDef?.enum && !paramDef.enum.includes(value as string)) {
            return { valid: false, error: `Invalid value "${value}" for "${key}". Must be one of: ${paramDef.enum.join(', ')}` };
        }
    }
    return { valid: true };
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
        streamedReasoning: '',
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

    // Code blocks
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-black/30 p-3 rounded-lg my-2 overflow-x-auto border border-white/10"><code class="text-sm shadow-none">$2</code></pre>');
    html = html.replace(/`([^`\n]+)`/g, '<code class="bg-black/30 px-1.5 py-0.5 rounded text-amber-300 font-mono text-xs border border-white/10">$1</code>');

    // Tables
    const lines = html.split('\n');
    let inTable = false;
    let tableHtml = '';
    const outputLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('|') && line.includes('|')) {
            if (!inTable) {
                inTable = true;
                tableHtml = '<div class="overflow-x-auto my-4"><table class="min-w-full divide-y divide-white/10 border border-white/10 rounded-lg overflow-hidden">';
            }
            
            const cells = line.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
            if (line.match(/^[|:\-\s]+$/)) continue; // Skip separator line

            if (!tableHtml.includes('<thead>')) {
                tableHtml += '<thead class="bg-white/5"><tr>';
                cells.forEach(c => tableHtml += `<th class="px-4 py-2 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">${c.trim()}</th>`);
                tableHtml += '</tr></thead><tbody class="divide-y divide-white/5">';
            } else {
                tableHtml += '<tr class="hover:bg-white/5 transition-colors">';
                cells.forEach(c => tableHtml += `<td class="px-4 py-2 text-sm text-slate-300 border-x border-white/5">${c.trim()}</td>`);
                tableHtml += '</tr>';
            }
        } else {
            if (inTable) {
                tableHtml += '</tbody></table></div>';
                outputLines.push(tableHtml);
                inTable = false;
                tableHtml = '';
            }
            outputLines.push(lines[i]);
        }
    }
    if (inTable) outputLines.push(tableHtml + '</tbody></table></div>');
    html = outputLines.join('\n');

    // Headlines (comfort margins + vibrant colors)
    html = html.replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-slate-100 mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="text-md font-bold text-cyan-400 mt-5 mb-3 border-b border-white/10 pb-1">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 class="text-lg font-extrabold text-white mt-6 mb-4 border-b border-cyan-500/20 pb-1.5 shadow-sm">$1</h1>');

    // Bold/Italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="text-amber-300"><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-amber-400">$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em class="text-slate-300">$1</em>');

    // Links and blockquotes
    const sanitizeUrl = (url: string): string => {
        const decoded = url.replace(/&amp;/g, '&');
        const trimmed = decoded.trim().toLowerCase();
        return (trimmed.startsWith('http:') || trimmed.startsWith('https:') || trimmed.startsWith('mailto:')) ? url : '';
    };

    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
        const safe = sanitizeUrl(url);
        return safe ? `<a href="${safe}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">${text}</a>` : text;
    });

    html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-3 border-cyan-500/50 pl-3 italic text-slate-300 my-2 bg-cyan-500/5 py-1.5 pr-2 rounded-r">$1</blockquote>');

    const contentLines = html.split('\n');
    const processed = [];
    let currentList: 'ul' | 'ol' | null = null;

    for (let i = 0; i < contentLines.length; i++) {
        const line = contentLines[i];
        const trimmed = line.trim();
        
        // Match lists (allow indentation)
        const ulMatch = line.match(/^(\s*)[\*\-] (.*)$/);
        const olMatch = line.match(/^(\s*)(\d+)\. (.*)$/);

        if (ulMatch || olMatch) {
            const isUl = !!ulMatch;
            const type = isUl ? 'ul' : 'ol';
            const content = isUl ? ulMatch[2] : olMatch[3];
            const indent = (isUl ? ulMatch[1] : olMatch[1]).length;

            if (currentList !== type) {
                if (currentList) processed.push(`</${currentList}>`);
                processed.push(`<${type} class="space-y-1.5 my-2 ${indent > 0 ? 'ml-6' : ''}">`);
                currentList = type;
            }
            processed.push(`<li class="ml-6 list-${isUl ? 'disc' : 'decimal'} list-outside marker:text-cyan-400/60 pl-1">${content}</li>`);
        } else if (trimmed === "" && i < contentLines.length - 1 && (contentLines[i+1].match(/^(\s*)[\*\-] /) || contentLines[i+1].match(/^(\s*)\d+\. /))) {
            // Skip empty lines between list items to keep them together
            continue;
        } else {
            if (currentList) {
                processed.push(`</${currentList}>`);
                currentList = null;
            }
            if (trimmed) {
                // If it's not a tag already, wrap in paragraph-like div for better spacing control
                if (!trimmed.startsWith('<') || trimmed.startsWith('<code') || trimmed.startsWith('<strong') || trimmed.startsWith('<em')) {
                    processed.push(`<div class="mb-3 leading-loose">${trimmed}</div>`);
                } else {
                    processed.push(line);
                }
            }
        }
    }
    if (currentList) processed.push(`</${currentList}>`);
    
    return processed.join('').trim();
};
