const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    platform: process.platform,
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),

    // Explicit helpers for better DX
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    loadSettings: () => ipcRenderer.invoke('load-settings'),

    getSessions: () => ipcRenderer.invoke('get-sessions'),
    loadSession: (id) => ipcRenderer.invoke('load-session', id),
    saveSession: (session) => ipcRenderer.invoke('save-session', session),
    deleteSession: (id) => ipcRenderer.invoke('delete-session', id),

    // Native FS
    selectFolder: () => ipcRenderer.invoke('fs-select-folder'),
    openFolder: (path) => ipcRenderer.invoke('fs-open-folder', path),
    readFolder: (path) => ipcRenderer.invoke('fs-read-folder', path),
    writeFile: (data) => ipcRenderer.invoke('fs-write-file', data),
    runConsole: (data) => ipcRenderer.invoke('run-console', data),
    runSearch: (data) => ipcRenderer.invoke('run-search', data),
    getDefaultPath: () => ipcRenderer.invoke('get-default-path'),
    setupOnboarding: (data) => ipcRenderer.invoke('setup-onboarding', data),

    // Menu events listener
    onMenuAction: (callback) => {
        const listener = (event, action) => callback(action);
        ipcRenderer.on('menu-action', listener);
        return () => ipcRenderer.removeListener('menu-action', listener);
    }
});
