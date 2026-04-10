import mermaid from 'mermaid';

/** Shared Mermaid config object — NO themeCSS, keeps Mermaid rendering pristine */
const MERMAID_CONFIG = {
    startOnLoad: false,
    theme: 'dark' as const,
    securityLevel: 'loose' as const,
    suppressErrorRendering: true,
    fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    themeVariables: {
        primaryColor: '#06b6d4',
        primaryTextColor: '#fff',
        primaryBorderColor: '#0891b2',
        lineColor: '#22d3ee',
        secondaryColor: '#6366f1',
        tertiaryColor: '#10b981',
        mainBkg: 'rgba(0, 0, 0, 0.45)',
        nodeBorder: '#06b6d4',
        clusterBkg: 'rgba(30, 41, 59, 0.5)',
        titleColor: '#06b6d4',
        edgeLabelBackground: '#000',
        defaultLinkColor: '#06b6d4',
    }
};

/**
 * Initializes and renders Mermaid diagrams in the DOM.
 * This is designed to be called after the MarkdownRenderer has injected HTML.
 */
export const initMermaid = async () => {
    try {
        mermaid.initialize(MERMAID_CONFIG);
        await mermaid.run();
    } catch (err) {
        console.error('[Mermaid] Initialization failed:', err);
    }
};

/**
 * 🔍 Post-render: Attach lightweight hover/click zoom to individual SVG elements.
 * This runs AFTER Mermaid has fully rendered the SVG, so it never interferes
 * with Mermaid's internal rendering pipeline.
 */
function attachInteractiveZoom(block: HTMLElement) {
    const svg = block.querySelector('svg');
    if (!svg) return;

    // Target interactive elements inside the SVG
    const interactiveSelectors = '.node, .actor, .note, .cluster, .state, .entityBox, .pieCircle';
    const elements = svg.querySelectorAll(interactiveSelectors);
    if (elements.length === 0) return;

    elements.forEach((el) => {
        const svgEl = el as SVGGraphicsElement;

        // Lightweight inline styles — no themeCSS, no global stylesheet pollution
        svgEl.style.cursor = 'pointer';
        svgEl.style.transition = 'transform 0.25s ease';
        svgEl.style.transformOrigin = 'center';
        svgEl.style.transformBox = 'fill-box';

        // Hover: subtle scale-up for readability
        svgEl.addEventListener('mouseenter', () => {
            svgEl.style.transform = 'scale(1.15)';
            svgEl.style.zIndex = '10';
        });
        svgEl.addEventListener('mouseleave', () => {
            // Only reset if not pinned by click
            if (svgEl.getAttribute('data-pinned') !== 'true') {
                svgEl.style.transform = '';
                svgEl.style.zIndex = '';
            }
        });

        // Click: toggle pin at larger zoom for reading details
        svgEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const isPinned = svgEl.getAttribute('data-pinned') === 'true';
            if (isPinned) {
                svgEl.setAttribute('data-pinned', 'false');
                svgEl.style.transform = '';
                svgEl.style.zIndex = '';
            } else {
                // Unpin all siblings first
                elements.forEach((sib) => {
                    const s = sib as SVGGraphicsElement;
                    s.setAttribute('data-pinned', 'false');
                    s.style.transform = '';
                    s.style.zIndex = '';
                });
                svgEl.setAttribute('data-pinned', 'true');
                svgEl.style.transform = 'scale(1.45)';
                svgEl.style.zIndex = '20';
            }
        });
    });

    // Click on SVG background to unpin all
    svg.addEventListener('click', (e) => {
        if (e.target === svg || (e.target instanceof Element && e.target.tagName === 'rect' && e.target.classList.contains('er'))) {
            elements.forEach((el) => {
                const s = el as SVGGraphicsElement;
                s.setAttribute('data-pinned', 'false');
                s.style.transform = '';
                s.style.zIndex = '';
            });
        }
    });
}

/**
 * Renders a single mermaid block with smooth expansion and headless calculation.
 */
export const renderSingleMermaidBlock = async (block: HTMLElement, index: number = 0) => {
    if (block.getAttribute('data-processed') === 'true') return;
    
    // Proactive Cleanup: Remove any lingering internal Mermaid error containers
    document.getElementById('mermaid-error-container')?.remove();
    
    const id = `mermaid-${Date.now()}-${index}`;
    const encoded = block.getAttribute('data-mermaid-src');
    
    // 🔕 CONSOLE SILENCER: Backup original console.error to avoid Red Walls of handled errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
        if (args[0] && typeof args[0] === 'string' && (args[0].includes('[Mermaid]') || args[0].includes('Parse error'))) return;
        originalConsoleError.apply(console, args);
    };

    try {
        const content = encoded ? decodeURIComponent(encoded) : (block.textContent || '');
        if (!content.trim() || content.includes('__HIGHLIGHT_')) return;

        /** 
         * ⚡ CPU YIELDING: Pause for 0ms to unlock main thread
         */
        await new Promise(resolve => setTimeout(resolve, 0));

        mermaid.initialize(MERMAID_CONFIG);
        
        // 📡 STEP 1: Headless calculation
        const { svg } = await mermaid.render(id, content.trim());
        
        requestAnimationFrame(() => {
            // 🧪 STEP 2: MEASURE Target Height
            const mirror = document.createElement('div');
            mirror.style.cssText = 'position: absolute; visibility: hidden; width: ' + block.offsetWidth + 'px; pointer-events: none; height: auto;';
            mirror.innerHTML = svg;
            document.body.appendChild(mirror);
            const targetHeight = mirror.offsetHeight;
            document.body.removeChild(mirror);

            // 🏗️ STEP 3: PREPARE TRANSITION
            const currentHeight = block.offsetHeight;
            block.style.height = currentHeight + 'px';
            block.style.transition = 'height 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.8s, transform 0.8s, filter 0.8s';
            block.style.overflow = 'hidden';

            block.offsetHeight; // Force reflow

            // 🚀 STEP 4: EXECUTE SMOOTH EXPANSION
            block.innerHTML = svg;
            block.style.height = targetHeight + 'px';
            block.setAttribute('data-processed', 'true');

            setTimeout(() => {
                block.classList.remove('opacity-0', 'scale-95', 'blur-sm');
                block.classList.add('opacity-100', 'scale-100', 'blur-0');
            }, 50);

            // 🔍 STEP 5: Attach interactive zoom AFTER render is complete
            setTimeout(() => attachInteractiveZoom(block), 100);

            const cleanup = () => {
                block.style.height = 'auto'; 
                block.style.transition = '';
                block.removeEventListener('transitionend', cleanup);
            };
            block.addEventListener('transitionend', (e) => {
                if (e.propertyName === 'height') cleanup();
            });
        });
    } catch (err) {
        // Deep Cleanup of global leaks
        document.getElementById('mermaid-error-container')?.remove();
        
        requestAnimationFrame(() => {
            block.innerHTML = ''; // Full clear before showing our error
            block.innerHTML = `<div class="text-rose-500 text-xs italic p-4 bg-rose-500/10 rounded-xl border border-rose-500/20">Syntax Error: ${err instanceof Error ? err.message : 'Invalid Syntax'}</div>`;
            block.classList.remove('opacity-0', 'scale-95', 'blur-sm');
            block.classList.add('opacity-100', 'scale-100', 'blur-0');
        });
    } finally {
        // 🎙️ RESTORE CONSOLE: Release control
        console.error = originalConsoleError;
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
        await renderSingleMermaidBlock(blocks[i] as HTMLElement, i);
    }
};
