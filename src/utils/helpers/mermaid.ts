import mermaid from 'mermaid';

/** Shared Mermaid config object — pristine, no CSS injection */
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
 * 🔍 Creates a fullscreen overlay to inspect a Mermaid diagram at full viewport size.
 * The overlay supports pan (drag) and zoom (wheel) for detailed inspection.
 */
function openMermaidFullscreen(svgSource: string) {
    // Prevent duplicates
    document.getElementById('mermaid-fullscreen-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'mermaid-fullscreen-overlay';
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(2, 6, 23, 0.95);
        backdrop-filter: blur(12px);
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        animation: mermaid-overlay-in 0.3s ease-out;
        cursor: grab;
    `;

    // Header bar
    const header = document.createElement('div');
    header.style.cssText = `
        position: absolute; top: 0; left: 0; right: 0;
        display: flex; align-items: center; justify-content: space-between;
        padding: 16px 24px;
        background: linear-gradient(to bottom, rgba(2,6,23,0.9), transparent);
        z-index: 10; user-select: none;
    `;
    header.innerHTML = `
        <span style="color: #06b6d4; font-size: 11px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; opacity: 0.7;">
            <i class="fas fa-expand" style="margin-right: 8px;"></i>Mermaid Inspector
        </span>
        <div style="display: flex; gap: 12px; align-items: center;">
            <span id="mermaid-zoom-label" style="color: #94a3b8; font-size: 11px; font-family: monospace;">100%</span>
            <button id="mermaid-zoom-reset" style="color: #94a3b8; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 11px; transition: all 0.2s;">
                Reset
            </button>
            <button id="mermaid-close-btn" style="color: #f87171; background: none; border: none; cursor: pointer; font-size: 20px; padding: 4px 8px; transition: transform 0.2s;" title="Cerrar (Esc)">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    overlay.appendChild(header);

    // SVG container — pan + zoom target
    const container = document.createElement('div');
    container.id = 'mermaid-fullscreen-content';
    container.style.cssText = `
        width: 100%; height: 100%;
        display: flex; align-items: center; justify-content: center;
        overflow: hidden; position: relative;
    `;

    const svgWrapper = document.createElement('div');
    svgWrapper.style.cssText = `
        transform-origin: center center;
        transition: transform 0.15s ease-out;
        will-change: transform;
    `;
    svgWrapper.innerHTML = svgSource;

    // Make SVG fill available space
    const svgEl = svgWrapper.querySelector('svg');
    if (svgEl) {
        svgEl.style.maxWidth = '90vw';
        svgEl.style.maxHeight = '85vh';
        svgEl.style.width = 'auto';
        svgEl.style.height = 'auto';
    }

    container.appendChild(svgWrapper);
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    // ── Zoom & Pan State ──────────────────────────────
    let scale = 1;
    let panX = 0, panY = 0;
    let isDragging = false;
    let startX = 0, startY = 0;
    const zoomLabel = overlay.querySelector('#mermaid-zoom-label') as HTMLElement;

    const applyTransform = () => {
        svgWrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
        if (zoomLabel) zoomLabel.textContent = `${Math.round(scale * 100)}%`;
    };

    // Wheel zoom
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        scale = Math.max(0.2, Math.min(5, scale * delta));
        svgWrapper.style.transition = 'transform 0.1s ease-out';
        applyTransform();
    }, { passive: false });

    // Pan (drag)
    container.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
        overlay.style.cursor = 'grabbing';
        svgWrapper.style.transition = 'none';
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        applyTransform();
    });
    window.addEventListener('mouseup', () => {
        isDragging = false;
        overlay.style.cursor = 'grab';
    });

    // Reset button
    overlay.querySelector('#mermaid-zoom-reset')?.addEventListener('click', () => {
        scale = 1; panX = 0; panY = 0;
        svgWrapper.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        applyTransform();
    });

    // Close handlers
    const closeOverlay = () => {
        overlay.style.animation = 'mermaid-overlay-out 0.2s ease-in forwards';
        setTimeout(() => overlay.remove(), 200);
        window.removeEventListener('keydown', escHandler);
    };

    const escHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') closeOverlay();
    };
    window.addEventListener('keydown', escHandler);
    overlay.querySelector('#mermaid-close-btn')?.addEventListener('click', closeOverlay);

    // Click on background (not SVG) to close
    overlay.addEventListener('dblclick', (e) => {
        if (e.target === container || e.target === overlay) closeOverlay();
    });
}

/**
 * 🔍 Attaches the fullscreen expand button to a rendered Mermaid block.
 * Called post-render, finds the parent container and adds the button next to the copy button.
 */
function attachExpandButton(block: HTMLElement) {
    const svg = block.querySelector('svg');
    if (!svg) return;

    // Find the parent container that has the studio header
    const container = block.closest('.group');
    if (!container || container.querySelector('.mermaid-expand-btn')) return; // Already has button

    const expandBtn = document.createElement('button');
    expandBtn.className = 'mermaid-expand-btn absolute top-3 right-14 text-slate-500/50 hover:text-cyan-400 p-1 opacity-0 group-hover:opacity-100 transition hover:scale-110 active:scale-90 cursor-pointer z-20';
    expandBtn.title = 'Inspeccionar diagrama';
    expandBtn.innerHTML = '<i class="fas fa-expand text-[13px]"></i>';
    expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const svgSource = block.querySelector('svg')?.outerHTML;
        if (svgSource) openMermaidFullscreen(svgSource);
    });

    container.appendChild(expandBtn);
}

/**
 * Injects the CSS keyframes needed for the overlay animations.
 * Idempotent — only injects once.
 */
function ensureOverlayStyles() {
    if (document.getElementById('mermaid-overlay-styles')) return;
    const style = document.createElement('style');
    style.id = 'mermaid-overlay-styles';
    style.textContent = `
        @keyframes mermaid-overlay-in {
            from { opacity: 0; }
            to   { opacity: 1; }
        }
        @keyframes mermaid-overlay-out {
            from { opacity: 1; }
            to   { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
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

            // 🔍 STEP 5: Attach expand button AFTER render is complete
            setTimeout(() => {
                ensureOverlayStyles();
                attachExpandButton(block);
            }, 100);

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
