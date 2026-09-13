const POWER_STATE_CHANNEL = 'scheduler-power-state';

/** Retain native power state so renderer reloads can recover missed resume events. */
function registerPowerLifecycle({ powerMonitor, ipcMain, getMainWindow, now = Date.now }) {
    let state = { suspended: false, revision: 0, resumedAt: null };
    let disposed = false;
    const snapshot = () => ({ ...state });
    const getReceiver = () => {
        const window = getMainWindow();
        if (!window || window.isDestroyed?.()) return null;
        const receiver = window.webContents;
        return receiver && !receiver.isDestroyed?.() ? receiver : null;
    };

    ipcMain.handle(POWER_STATE_CHANNEL, event => {
        const receiver = getReceiver();
        if (!receiver || event?.sender !== receiver || !event.senderFrame ||
            event.senderFrame !== receiver.mainFrame) {
            throw new Error('Scheduler power state is only available from the main Miku window.');
        }
        return snapshot();
    });

    const publish = () => {
        const receiver = getReceiver();
        if (!receiver) return;
        try {
            receiver.send(POWER_STATE_CHANNEL, snapshot());
        } catch {
            // A renderer may disappear between the liveness check and delivery.
            // The retained snapshot remains available to its replacement via IPC.
        }
    };
    const suspend = () => {
        state = { ...state, suspended: true, revision: state.revision + 1 };
        publish();
    };
    const resume = () => {
        state = { suspended: false, revision: state.revision + 1, resumedAt: now() };
        publish();
    };
    powerMonitor.on('suspend', suspend);
    powerMonitor.on('resume', resume);

    return {
        dispose() {
            if (disposed) return;
            disposed = true;
            powerMonitor.removeListener('suspend', suspend);
            powerMonitor.removeListener('resume', resume);
            ipcMain.removeHandler(POWER_STATE_CHANNEL);
        }
    };
}

module.exports = { registerPowerLifecycle };
