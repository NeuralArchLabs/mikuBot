import mermaid from 'mermaid';

/**
 * 🎨 AUTO-CONTRAST ENGINE (Live DOM)
 * Scans a rendered Mermaid SVG in the live DOM for nodes with light fill
 * colors and flips their text to dark for legibility.
 * Operates on live elements — NO DOMParser/XMLSerializer roundtrip.
 */
function fixMermaidTextContrastDOM(container: HTMLElement): void {
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;

    const parseColor = (c: string): [number, number, number] | null => {
        if (!c) return null;
        c = c.trim().toLowerCase();
        const hex = c.match(/^#([0-9a-f]{3,8})$/);
        if (hex) {
            let h = hex[1];
            if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
            return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
        }
        const rgb = c.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
        if (rgb) return [+rgb[1], +rgb[2], +rgb[3]];
        const named: Record<string,[number,number,number]> = {
            white:[255,255,255], lightyellow:[255,255,224], lightgreen:[144,238,144],
            lightgray:[211,211,211], lightgrey:[211,211,211], lightcyan:[224,255,255],
            lightpink:[255,182,193], ivory:[255,255,240], honeydew:[240,255,240],
            lavender:[230,230,250], aliceblue:[240,248,255], beige:[245,245,220],
            yellow:[255,255,0], gold:[255,215,0], orange:[255,165,0],
            khaki:[240,230,140], wheat:[245,222,179], bisque:[255,228,196],
        };
        return named[c] || null;
    };

    const luminance = ([r,g,b]: [number,number,number]) => {
        const f = (v: number) => { const s = v/255; return s <= 0.03928 ? s/12.92 : Math.pow((s+0.055)/1.055, 2.4); };
        return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b);
    };

    const isLight = (color: string) => {
        const rgb = parseColor(color);
        return rgb ? luminance(rgb) > 0.45 : false;
    };

    const DARK = '#1a1a2e';

    // Fix node text
    svgEl.querySelectorAll('g.node rect, g.node polygon, g.node circle, g.node ellipse, g.node path').forEach(shape => {
        const fill = shape.getAttribute('fill') || (shape as SVGElement).style?.fill;
        if (fill && isLight(fill)) {
            const group = shape.closest('g.node') || shape.closest('g');
            group?.querySelectorAll('text, tspan, .nodeLabel, foreignObject span, foreignObject div, foreignObject p').forEach(t => {
                (t as SVGElement).setAttribute('fill', DARK);
                if ((t as HTMLElement).style) (t as HTMLElement).style.color = DARK;
            });
        }
    });

    // Fix cluster/subgraph labels
    svgEl.querySelectorAll('g.cluster rect').forEach(rect => {
        const fill = rect.getAttribute('fill') || (rect as SVGElement).style?.fill;
        if (fill && isLight(fill)) {
            const cluster = rect.closest('g.cluster') || rect.closest('g');
            cluster?.querySelectorAll('text, tspan').forEach(t => {
                (t as SVGElement).setAttribute('fill', DARK);
            });
        }
    });
}


/** Shared Mermaid config object — `base` theme with darkMode for full control */

const MERMAID_CONFIG = {
    startOnLoad: false,
    theme: 'base' as const,
    securityLevel: 'loose' as const,
    suppressErrorRendering: true,
    darkMode: true,
    fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    themeVariables: {
        // ── Core palette ──
        darkMode: true,
        background: '#0f172a',
        primaryColor: '#06b6d4',
        primaryTextColor: '#e2e8f0',
        primaryBorderColor: '#0891b2',
        secondaryColor: '#6366f1',
        secondaryTextColor: '#e2e8f0',
        secondaryBorderColor: '#4f46e5',
        tertiaryColor: '#10b981',
        tertiaryTextColor: '#e2e8f0',
        tertiaryBorderColor: '#059669',
        lineColor: '#22d3ee',
        textColor: '#e2e8f0',
        mainBkg: '#1e293b',
        nodeBorder: '#06b6d4',
        nodeTextColor: '#e2e8f0',

        // ── Flowchart ──
        clusterBkg: 'rgba(30, 41, 59, 0.7)',
        clusterBorder: '#334155',
        titleColor: '#06b6d4',
        edgeLabelBackground: '#0f172a',
        defaultLinkColor: '#22d3ee',

        // ── Sequence ──
        actorBkg: '#1e293b',
        actorBorder: '#06b6d4',
        actorTextColor: '#e2e8f0',
        actorLineColor: '#334155',
        signalColor: '#22d3ee',
        signalTextColor: '#e2e8f0',
        labelBoxBkgColor: '#1e293b',
        labelBoxBorderColor: '#334155',
        labelTextColor: '#e2e8f0',
        loopTextColor: '#e2e8f0',
        noteBkgColor: '#1e293b',
        noteTextColor: '#e2e8f0',
        noteBorderColor: '#06b6d4',
        activationBkgColor: '#334155',
        activationBorderColor: '#06b6d4',

        // ── Class ──
        classText: '#e2e8f0',

        // ── State ──
        labelColor: '#e2e8f0',
        altBackground: '#1e293b',

        // ── ER ──
        attributeBackgroundColorOdd: '#1e293b',
        attributeBackgroundColorEven: '#0f172a',

        // ── Gantt ──
        gridColor: '#334155',
        doneTaskBkgColor: '#10b981',
        doneTaskBorderColor: '#059669',
        activeTaskBkgColor: '#06b6d4',
        activeTaskBorderColor: '#0891b2',
        critBkgColor: '#ef4444',
        critBorderColor: '#dc2626',
        taskTextColor: '#e2e8f0',
        taskTextDarkColor: '#1e293b',
        taskTextOutsideColor: '#e2e8f0',
        sectionBkgColor: '#1e293b',
        sectionBkgColor2: '#0f172a',
        todayLineColor: '#f97316',

        // ── Journey ──
        fillType0: '#06b6d4',
        fillType1: '#6366f1',
        fillType2: '#8b5cf6',
        fillType3: '#ec4899',
        fillType4: '#10b981',
        fillType5: '#f97316',
        fillType6: '#ef4444',
        fillType7: '#eab308',

        // ── Pie ──
        pie1: '#06b6d4',
        pie2: '#6366f1',
        pie3: '#10b981',
        pie4: '#f97316',
        pie5: '#ec4899',
        pie6: '#eab308',
        pie7: '#ef4444',
        pie8: '#8b5cf6',
        pie9: '#14b8a6',
        pie10: '#f43f5e',
        pie11: '#a855f7',
        pie12: '#22d3ee',
        pieTitleTextSize: '14px',
        pieTitleTextColor: '#e2e8f0',
        pieSectionTextSize: '12px',
        pieSectionTextColor: '#fff',
        pieLegendTextSize: '12px',
        pieLegendTextColor: '#e2e8f0',
        pieStrokeColor: '#0f172a',
        pieStrokeWidth: '2px',
        pieOuterStrokeWidth: '2px',
        pieOuterStrokeColor: '#0f172a',
        pieOpacity: '1',

        // ── Git ──
        git0: '#06b6d4',
        git1: '#6366f1',
        git2: '#10b981',
        git3: '#f97316',
        git4: '#ec4899',
        git5: '#eab308',
        git6: '#ef4444',
        git7: '#8b5cf6',
        gitBranchLabel0: '#e2e8f0',
        gitBranchLabel1: '#e2e8f0',
        gitBranchLabel2: '#e2e8f0',
        gitBranchLabel3: '#e2e8f0',
        gitInv0: '#0f172a',
        commitLabelColor: '#e2e8f0',
        commitLabelBackground: '#1e293b',
        tagLabelColor: '#e2e8f0',
        tagLabelBackground: '#6366f1',
        tagLabelBorder: '#4f46e5',
    },
    // Injected CSS for auto-contrast: any node/element with a light inline fill gets dark text
    themeCSS: `
        .node .label, .node .nodeLabel { color: #e2e8f0; fill: #e2e8f0; }
        .cluster-label .nodeLabel { fill: #e2e8f0; }
        .label text, .label tspan { fill: #e2e8f0 !important; }
    `,
};

/**
 * 🎨 PRE-PROCESS: Auto-inject `color` into Mermaid `style` directives
 * When a light fill is detected without an explicit color, adds dark text color.
 */
function autoContrastMermaidCode(code: string): string {
    const parseHex = (h: string): [number,number,number] | null => {
        h = h.replace('#', '');
        if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
        if (h.length < 6) return null;
        return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
    };
    const lum = ([r,g,b]: [number,number,number]) => {
        const f = (v: number) => { const s = v/255; return s <= 0.03928 ? s/12.92 : Math.pow((s+0.055)/1.055, 2.4); };
        return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b);
    };

    return code.replace(
        /^(\s*style\s+\S+\s+.*?fill\s*:\s*)(#[0-9a-fA-F]{3,6})(.*?)$/gm,
        (match, prefix, fillColor, suffix) => {
            // Don't add color if already specified
            if (/color\s*:/i.test(suffix) || /color\s*:/i.test(prefix)) return match;
            const rgb = parseHex(fillColor);
            if (rgb && lum(rgb) > 0.4) {
                return `${prefix}${fillColor}${suffix},color:#1a1a2e`;
            }
            return match;
        }
    );
}


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
        position: fixed; inset: 0; z-index: 99999;
        background: rgba(2, 6, 23, 0.97);
        -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px);
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        animation: mermaid-overlay-in 0.3s ease-out;
        cursor: grab;
    `;

    // ── Bottom Control Bar (avoids overlap with app buttons in top-right) ──
    const controlBar = document.createElement('div');
    controlBar.style.cssText = `
        position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
        display: flex; align-items: center; gap: 16px;
        padding: 10px 24px;
        background: rgba(15, 23, 42, 0.85);
        border: 1px solid rgba(6, 182, 212, 0.15);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        z-index: 10; user-select: none;
        -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
    `;
    controlBar.innerHTML = `
        <span style="color: #06b6d4; font-size: 10px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; opacity: 0.6;">
            <i class="fas fa-search-plus" style="margin-right: 6px;"></i>INSPECTOR
        </span>
        <span style="width: 1px; height: 16px; background: rgba(255,255,255,0.1);"></span>
        <span id="mermaid-zoom-label" style="color: #94a3b8; font-size: 12px; font-family: monospace; min-width: 40px; text-align: center;">100%</span>
        <button id="mermaid-zoom-in" style="color: #94a3b8; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; width: 28px; height: 28px; cursor: pointer; font-size: 14px; transition: all 0.2s; display: flex; align-items: center; justify-content: center;" title="Acercar">
            <i class="fas fa-plus" style="font-size: 10px;"></i>
        </button>
        <button id="mermaid-zoom-out" style="color: #94a3b8; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; width: 28px; height: 28px; cursor: pointer; font-size: 14px; transition: all 0.2s; display: flex; align-items: center; justify-content: center;" title="Alejar">
            <i class="fas fa-minus" style="font-size: 10px;"></i>
        </button>
        <button id="mermaid-zoom-reset" style="color: #94a3b8; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 4px 12px; height: 28px; cursor: pointer; font-size: 11px; transition: all 0.2s;">
            Reset
        </button>
        <span style="width: 1px; height: 16px; background: rgba(255,255,255,0.1);"></span>
        <button id="mermaid-close-btn" style="color: #f87171; background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.2); border-radius: 6px; width: 28px; height: 28px; cursor: pointer; font-size: 14px; transition: all 0.2s; display: flex; align-items: center; justify-content: center;" title="Cerrar (Esc)">
            <i class="fas fa-times" style="font-size: 11px;"></i>
        </button>
    `;
    overlay.appendChild(controlBar);

    // ── SVG container — pan + zoom target ──
    const container = document.createElement('div');
    container.id = 'mermaid-fullscreen-content';
    container.style.cssText = `
        width: 100%; height: 100%;
        display: flex; align-items: center; justify-content: center;
        overflow: hidden; position: relative;
        padding: 40px;
    `;

    const svgWrapper = document.createElement('div');
    svgWrapper.style.cssText = `
        transform-origin: center center;
        transition: transform 0.15s ease-out;
        will-change: transform;
        display: flex; align-items: center; justify-content: center;
    `;
    svgWrapper.innerHTML = svgSource;

    // Make SVG properly visible and sized for the viewport
    const svgEl = svgWrapper.querySelector('svg');
    if (svgEl) {
        // Preserve viewBox for proper scaling; remove hardcoded width/height
        const vb = svgEl.getAttribute('viewBox');
        if (!vb) {
            // If no viewBox, create one from current dimensions
            const w = svgEl.getAttribute('width') || svgEl.getBoundingClientRect()?.width || 800;
            const h = svgEl.getAttribute('height') || svgEl.getBoundingClientRect()?.height || 600;
            svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
        }
        svgEl.removeAttribute('width');
        svgEl.removeAttribute('height');
        svgEl.setAttribute('width', '85vw');
        svgEl.setAttribute('height', '80vh');
        svgEl.style.maxWidth = '85vw';
        svgEl.style.maxHeight = '80vh';
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

    // Reset button
    overlay.querySelector('#mermaid-zoom-reset')?.addEventListener('click', () => {
        scale = 1; panX = 0; panY = 0;
        svgWrapper.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        applyTransform();
    });

    // Zoom in/out buttons
    overlay.querySelector('#mermaid-zoom-in')?.addEventListener('click', () => {
        scale = Math.min(5, scale * 1.25);
        svgWrapper.style.transition = 'transform 0.2s ease-out';
        applyTransform();
    });
    overlay.querySelector('#mermaid-zoom-out')?.addEventListener('click', () => {
        scale = Math.max(0.2, scale * 0.8);
        svgWrapper.style.transition = 'transform 0.2s ease-out';
        applyTransform();
    });

    // Close handlers — also clean up global listeners to prevent memory leaks
    const onMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        applyTransform();
    };
    const onMouseUp = () => {
        isDragging = false;
        overlay.style.cursor = 'grab';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    const closeOverlay = () => {
        overlay.style.animation = 'mermaid-overlay-out 0.2s ease-in forwards';
        setTimeout(() => overlay.remove(), 200);
        window.removeEventListener('keydown', escHandler);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
    };

    const escHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') closeOverlay();
    };
    window.addEventListener('keydown', escHandler);
    overlay.querySelector('#mermaid-close-btn')?.addEventListener('click', closeOverlay);

    // Double-click on background to close
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
        
        // 🎨 PRE-PROCESS: Auto-inject dark text color for light-filled nodes
        const processedContent = autoContrastMermaidCode(content.trim());
        
        // 📡 STEP 1: Headless calculation
        const { svg } = await mermaid.render(id, processedContent);

        
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

            // 🎨 STEP 4.5: AUTO-CONTRAST on live DOM (safe, no serialization)
            fixMermaidTextContrastDOM(block);
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
