/**
 * Network Helpers
 * HTTP request utilities with Electron proxy support
 */

/**
 * Safe fetch that uses Electron proxy when available
 */
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
    if (!response.ok) {
        let errText = '';
        try { errText = await response.text(); } catch { }
        throw new Error(errText || `HTTP ${response.status}`);
    }
    return response.json();
}
