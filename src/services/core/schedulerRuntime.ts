import type { AppConfig } from '../../types';

/** Local runtimes can still execute while the OS reports no network. */
export function isScheduledNetworkReady(config: AppConfig, mode: 'chat' | 'agent', online: boolean): boolean {
    const overrideProvider = mode === 'agent' ? config.agentProvider : config.chatProvider;
    const overrideModel = mode === 'agent' ? config.agentModel : config.chatModel;
    const provider = overrideProvider && overrideModel ? overrideProvider : config.provider;
    return online || provider === 'ollama' || provider === 'unsloth';
}

export interface SchedulerPowerState {
    suspended: boolean;
    revision: number;
    resumedAt: number | null;
}

/** Checks infrastructure before dispatch, without invoking a provider or a tool. */
export function createSchedulerRuntime({
    bridge,
    events,
    dev = false,
    origin = '',
    fetch: request = globalThis.fetch,
}: {
    bridge?: {
        getSchedulerPowerState?: () => Promise<SchedulerPowerState>;
        onSchedulerPowerState?: (callback: (state: SchedulerPowerState) => void) => () => void;
    };
    events?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
    dev?: boolean;
    origin?: string;
    fetch?: typeof fetch;
} = {}) {
    let power: SchedulerPowerState = { suspended: false, revision: -1, resumedAt: null };
    const updatePower = (state: SchedulerPowerState) => {
        if (state && Number.isInteger(state.revision) && state.revision >= power.revision) power = state;
    };
    return {
        subscribe(wake: () => void) {
            const unsubscribe = bridge?.onSchedulerPowerState?.(state => {
                updatePower(state);
                wake();
            });
            // A browser without the native bridge can retry on reconnect too.
            events?.addEventListener('online', wake);
            return () => {
                unsubscribe?.();
                events?.removeEventListener('online', wake);
            };
        },
        async isReady(): Promise<boolean> {
            try {
                if (bridge?.getSchedulerPowerState) updatePower(await bridge.getSchedulerPowerState());
                if (power.suspended) return false;
                const revision = power.revision;
                if (dev) {
                    // Vite may still be recovering after wake. Probe its module
                    // endpoint before creating a scheduled turn; never import it
                    // again or reload a conversation with work in progress.
                    const controller = new AbortController();
                    const timer = setTimeout(() => controller.abort(), 3000);
                    try {
                        const response = await request(new URL('/src/services/core/ModelProviders.ts', origin), {
                            method: 'HEAD', cache: 'no-store', signal: controller.signal,
                        });
                        if (!response.ok || !/javascript/i.test(response.headers.get('content-type') || '')) return false;
                    } finally {
                        clearTimeout(timer);
                    }
                }
                return !power.suspended && power.revision === revision;
            } catch {
                // An unavailable renderer server or IPC is a deferred dispatch,
                // not a failed execution. The scheduler retains the due task.
                return false;
            }
        },
    };
}
