/**
 * main.js - Lógica compartida para searXena
 * Enfocado en privacidad local y rendimiento.
 */

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('search-input');
    const sbox = document.getElementById('suggestions-box');
    const form = document.getElementById('search-form');
    let timeout = null;

    if (input && sbox) {
        // Create Clear Button (X)
        const clearBtn = document.createElement('div');
        clearBtn.id = 'clear-search';
        clearBtn.className = 'clear-btn';
        clearBtn.innerHTML = '&times;';
        clearBtn.style.display = input.value ? 'flex' : 'none';
        input.parentNode.appendChild(clearBtn);

        input.addEventListener('input', () => {
            clearBtn.style.display = input.value.length > 0 ? 'flex' : 'none';
            clearTimeout(timeout);
            const q = input.value.trim();

            if (q.length < 2) {
                sbox.style.display = 'none';
                return;
            }

            timeout = setTimeout(async () => {
                try {
                    const r = await fetch(`/autoc?q=${encodeURIComponent(q)}`);
                    const data = await r.json();

                    if (data && data.length > 0) {
                        sbox.innerHTML = data.map(s =>
                            `<div class="suggestion-item" data-val="${s}">${s}</div>`
                        ).join('');
                        sbox.style.display = 'block';

                        sbox.querySelectorAll('.suggestion-item').forEach(item => {
                            item.onclick = () => {
                                input.value = item.getAttribute('data-val');
                                sbox.style.display = 'none'; // Hide immediately
                                form.requestSubmit(); // Triggers the SPA logic
                            };
                        });
                    } else {
                        sbox.style.display = 'none';
                    }
                } catch (e) {
                    sbox.style.display = 'none';
                }
            }, 250);
        });

        clearBtn.onclick = () => {
            input.value = '';
            input.focus();
            clearBtn.style.display = 'none';
            sbox.style.display = 'none';
        };
    }

    // Cerrar sugerencias al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (sbox && !e.target.closest('.search-box') && !e.target.closest('.search-box-header')) {
            sbox.style.display = 'none';
        }
    });

    // Botón Volver Arriba
    const backToTop = document.getElementById('back-to-top');
    if (backToTop) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 400) {
                backToTop.classList.add('visible');
            } else {
                backToTop.classList.remove('visible');
            }
        });

        backToTop.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
});

/**
 * Single Page App Navigation & Caching (Avoid redundant API requests)
 */
const CACHE_PREFIX = 'sxq_';

// Handle Browser Back/Forward buttons
window.addEventListener('popstate', (e) => {
    if (e.state && e.state.url) {
        performSearch(e.state.url, false);
    } else {
        window.location.reload();
    }
});

// Intercept main search form to clear cache on NEW searches
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('search-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            // Clear old cache for new queries manually if needed, or simply let it fetch.
            // On a new text query, it's fine to just do standard submit, 
            // but we can also handle it via SPA:
            e.preventDefault();
            const url = getSearchUrl();
            performSearch(url, true, true);
        });
    }
});

function getSearchUrl() {
    const q = document.getElementById('search-input')?.value.trim() || '';
    const cat = document.getElementById('cat-input')?.value || 'general';
    const page = document.getElementById('page-input')?.value || 1;
    return `/search?q=${encodeURIComponent(q)}&category=${cat}&pageno=${page}`;
}

async function performSearch(url, pushState = true, isNewQuery = false) {
    const layout = document.querySelector('.results-page-layout');

    // Only intercept if we are already on the results page
    if (!layout) {
        window.location.href = url;
        return;
    }

    if (layout) layout.style.opacity = '0.4';
    
    // Hide suggestions box on search
    const sbox = document.getElementById('suggestions-box');
    if (sbox) sbox.style.display = 'none';

    try {
        let htmlContent = null;

        // Check SessionStorage Cache (Only if it's not a fresh new text query)
        if (!isNewQuery) {
            htmlContent = sessionStorage.getItem(CACHE_PREFIX + url);
        }

        if (!htmlContent) {
            const resp = await fetch(url);
            const text = await resp.text();

            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const newLayout = doc.querySelector('.results-page-layout');

            if (newLayout) {
                htmlContent = newLayout.innerHTML;
                // Save to cache to avoid refetches when returning to tab
                try {
                    sessionStorage.setItem(CACHE_PREFIX + url, htmlContent);
                } catch (e) {
                    sessionStorage.clear(); // Free up space if full
                    sessionStorage.setItem(CACHE_PREFIX + url, htmlContent);
                }
            } else {
                window.location.href = url; // Fallback
                return;
            }
        }

        if (layout) {
            layout.innerHTML = htmlContent;
            layout.style.opacity = '1';
            
            // Remove focus from search input
            document.getElementById('search-input')?.blur();
        }

        if (pushState) {
            window.history.pushState({ url: url }, '', url);
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
        window.location.href = url; // Fallback
    }
}

/**
 * Cambia la categoría de búsqueda y usa SPA Cache
 */
function changeCat(cat) {
    const catInput = document.getElementById('cat-input');
    const pageInput = document.getElementById('page-input');

    if (catInput) {
        catInput.value = cat;
        if (pageInput) pageInput.value = 1;
        performSearch(getSearchUrl(), true, false);
    }
}

/**
 * Navegación de páginas con SPA Cache
 */
function goPage(p) {
    const pageInput = document.getElementById('page-input');

    if (pageInput) {
        pageInput.value = p;
        performSearch(getSearchUrl(), true, false);
    }
}
/**
 * Muestra una vista previa del resultado en el sidebar
 */
function setPreview(el) {
    const pane = document.getElementById('preview-pane');
    if (!pane) return;

    // Extraer datos
    const title = el.getAttribute('data-title');
    const content = el.getAttribute('data-content');
    const url = el.getAttribute('data-url');
    const icon = el.getAttribute('data-icon');

    // Actualizar elementos del pane
    document.getElementById('preview-title').innerText = title;
    document.getElementById('preview-content').innerText = content;
    document.getElementById('preview-url').innerText = url;
    document.getElementById('preview-icon').src = icon;
    document.getElementById('preview-link').href = url;

    // Manejar preview de imagen grande
    const fullImg = el.getAttribute('data-full-img');
    const imgContainer = document.getElementById('preview-image-container');
    const imgMain = document.getElementById('preview-image-main');

    if (fullImg && imgContainer && imgMain) {
        imgMain.src = fullImg;
        imgContainer.style.display = 'block';
    } else if (imgContainer) {
        imgContainer.style.display = 'none';
    }

    // Mostrar el pane
    pane.style.display = 'block';
    pane.closest('.sidebar').classList.add('active-preview');

    // Highlight visual
    document.querySelectorAll('.result-card, .video-card, .shopping-card, .image-card').forEach(c => c.classList.remove('selected-preview'));
    el.classList.add('selected-preview');

    // Scroll suave al top si es necesario o simplemente asegurar visibilidad
    if (window.innerWidth < 1250) {
        pane.scrollIntoView({ behavior: 'smooth' });
    }
}

/**
 * Cierra la vista previa y el overlay de móvil
 */
function closePreview() {
    const pane = document.getElementById('preview-pane');
    if (pane) {
        pane.style.display = 'none';
        pane.closest('.sidebar').classList.remove('active-preview');
        document.querySelectorAll('.selected-preview').forEach(c => c.classList.remove('selected-preview'));
    }
}

/**
 * Abre la imagen del sidebar en pantalla completa (Lightbox)
 */
function openLightbox() {
    const mainImg = document.getElementById('preview-image-main');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');

    if (mainImg && lightbox && lightboxImg && mainImg.src) {
        lightboxImg.src = mainImg.src; // Ya es una URL proxificada
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Cierra el Lightbox
 */
function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.classList.remove('active');
        document.body.style.overflow = ''; // Restaura scroll
    }
}
