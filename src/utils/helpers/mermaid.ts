import mermaid from 'mermaid';

/**
 * Initializes and renders Mermaid diagrams in the DOM.
 * This is designed to be called after the MarkdownRenderer has injected HTML.
 */
export const initMermaid = async () => {
    try {
        mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
            securityLevel: 'loose',
            fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            themeVariables: {
                primaryColor: '#06b6d4', // cyan-500
                primaryTextColor: '#fff',
                primaryBorderColor: '#0891b2', // cyan-600
                lineColor: '#22d3ee', // cyan-400
                secondaryColor: '#6366f1', // indigo-500
                tertiaryColor: '#10b981', // emerald-500
                mainBkg: 'rgba(0, 0, 0, 0.45)',
                nodeBorder: '#06b6d4',
                clusterBkg: 'rgba(30, 41, 59, 0.5)',
                titleColor: '#06b6d4',
                edgeLabelBackground: '#000',
                defaultLinkColor: '#06b6d4',
            }
        });
        await mermaid.run();
    } catch (err) {
        console.error('[Mermaid] Initialization failed:', err);
    }
};

/**
 * Robustly renders a list of mermaid blocks.
 * Useful for incremental updates or specific container refreshes.
 */
export const renderMermaidBlocks = async (container: HTMLElement) => {
    const blocks = container.querySelectorAll('.mermaid:not([data-processed="true"])');
    if (blocks.length === 0) return;

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i] as HTMLElement;
        const id = `mermaid-${Date.now()}-${i}`;
        const encoded = block.getAttribute('data-mermaid-src');
        let content = '';
        
        try {
            content = encoded ? decodeURIComponent(encoded) : (block.textContent || '');
            
            // Re-initialize to ensure theme is applied
            mermaid.initialize({ startOnLoad: false, theme: 'dark' });
            
            const { svg } = await mermaid.render(id, content.trim());
            block.innerHTML = svg;
            block.setAttribute('data-processed', 'true');
            block.classList.remove('opacity-0');
            block.classList.add('opacity-100');
        } catch (err) {
            console.error(`[Mermaid] Failed to render block ${id}:`, err);
            block.innerHTML = `<div class="text-rose-500 text-xs italic p-4 bg-rose-500/10 rounded-xl border border-rose-500/20">Diagram Syntax Error: ${err instanceof Error ? err.message : 'Invalid Syntax'}</div>`;
            block.classList.remove('opacity-0');
            block.classList.add('opacity-100');
        }
    }
};
