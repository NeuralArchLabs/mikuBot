/**
 * HealthCheck — Silent ping utility for local engine status
 * Path: src/services/core/HealthCheck.ts
 *
 * Provides non-blocking connectivity checks for local engines:
 * - Ollama (http://127.0.0.1:11434)
 * - SearXena (http://127.0.0.1:8000/api/v1/status)
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface EngineStatus {
    name: string;
    url: string;
    online: boolean;
    latencyMs: number | null;
    error?: string;
    lastChecked: number;
}

export interface HealthCheckResult {
    ollama: EngineStatus;
    searxena: EngineStatus;
    timestamp: number;
}

// ─── Constants ───────────────────────────────────────────────────────

const OLLAMA_URL   = 'http://127.0.0.1:11434';
const SEARXENA_URL = 'http://127.0.0.1:8000/api/v1/status';

/** Timeout for each individual ping (ms) */
const PING_TIMEOUT = 4000;

// ─── Core Functions ─────────────────────────────────────────────────

/**
 * Pings a single URL with a timeout and returns the engine status.
 */
async function pingEngine(name: string, url: string): Promise<EngineStatus> {
    const start = performance.now();

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT);

        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            // Avoid CORS preflight for simple GET
            mode: 'no-cors',
        });

        clearTimeout(timeoutId);
        const latencyMs = Math.round(performance.now() - start);

        // `no-cors` yields opaque response with status 0 but we know it connected.
        // If we get ANY response (even opaque), the engine is reachable.
        const isOnline = response.status === 0 || (response.status >= 200 && response.status < 500);

        return {
            name,
            url,
            online: isOnline,
            latencyMs,
            lastChecked: Date.now(),
        };
    } catch (err: any) {
        const latencyMs = Math.round(performance.now() - start);
        const errorMsg = err.name === 'AbortError'
            ? 'Timeout'
            : err.message || 'Connection refused';

        return {
            name,
            url,
            online: false,
            latencyMs,
            error: errorMsg,
            lastChecked: Date.now(),
        };
    }
}

/**
 * Performs a silent health check on all local engines.
 * Returns a snapshot of each engine's status.
 */
export async function runHealthCheck(): Promise<HealthCheckResult> {
    // Run both pings in parallel for speed
    const [ollama, searxena] = await Promise.all([
        pingEngine('Ollama', OLLAMA_URL),
        pingEngine('SearXena', SEARXENA_URL),
    ]);

    return {
        ollama,
        searxena,
        timestamp: Date.now(),
    };
}

/**
 * Pings only the Ollama engine.
 */
export async function pingOllama(): Promise<EngineStatus> {
    return pingEngine('Ollama', OLLAMA_URL);
}

/**
 * Pings only the SearXena engine.
 */
export async function pingSearXena(): Promise<EngineStatus> {
    return pingEngine('SearXena', SEARXENA_URL);
}
