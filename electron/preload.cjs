const { contextBridge, ipcRenderer } = require('electron');

// ── Security: IPC Channel Whitelist ──────────────────────────────────
// NEVER expose a generic invoke(channel, data) — it allows any renderer
// code (including browser extensions) to call arbitrary IPC handlers.
// Each channel below is explicitly whitelisted.

contextBridge.exposeInMainWorld('electron', {
    platform: process.platform,

    // Settings
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    loadSettings: () => ipcRenderer.invoke('load-settings'),
    setAutoLaunch: (enabled) => ipcRenderer.invoke('set-auto-launch', enabled),

    // Sessions
    getSessions: () => ipcRenderer.invoke('get-sessions'),
    loadSession: (id) => ipcRenderer.invoke('load-session', id),
    saveSession: (session) => ipcRenderer.invoke('save-session', session),
    deleteSession: (id) => ipcRenderer.invoke('delete-session', id),

    // Neural Scheduler
    saveSchedulerTasks: (data) => ipcRenderer.invoke('save-scheduler-tasks', data),
    loadSchedulerTasks: () => ipcRenderer.invoke('load-scheduler-tasks'),
    saveSchedulerLogs: (data) => ipcRenderer.invoke('save-scheduler-logs', data),
    loadSchedulerLogs: () => ipcRenderer.invoke('load-scheduler-logs'),

    // Native FS
    selectFolder: () => ipcRenderer.invoke('fs-select-folder'),
    openFolder: (path) => ipcRenderer.invoke('fs-open-folder', path),
    readFolder: (path) => ipcRenderer.invoke('fs-read-folder', path),
    writeFile: (data) => ipcRenderer.invoke('fs-write-file', data),
    deleteFile: (data) => ipcRenderer.invoke('fs-delete-file', data),
    getDefaultPath: () => ipcRenderer.invoke('get-default-path'),
    setupOnboarding: (data) => ipcRenderer.invoke('setup-onboarding', data),
    fsCheckExisting: (targetPath) => ipcRenderer.invoke('fs-check-existing', targetPath),
    exportBackup: () => ipcRenderer.invoke('export-backup'),
    importBackup: () => ipcRenderer.invoke('import-backup'),

    // Console & Python engine
    runConsole: (data) => ipcRenderer.invoke('run-console', data),
    runSearch: (data) => ipcRenderer.invoke('run-search', data),
    runExtract: (data) => ipcRenderer.invoke('run-extract', data),

    // Network proxy (keys stay in main process)
    fetchProxy: (data) => ipcRenderer.invoke('fetch-proxy', data),

    // API proxied calls (keys injected by main process, never sent from renderer)
    apiStream: (data) => ipcRenderer.invoke('api-stream', data),

    // Skills
    listSkills: (data) => ipcRenderer.invoke('list-skills', data),
    listBlueprints: (data) => ipcRenderer.invoke('list-blueprints', data),
    executeSkill: (data) => ipcRenderer.invoke('execute-skill', data),

    // Voice & Vosk Models
    listVoiceModels: () => ipcRenderer.invoke('voice:list-models'),
    downloadVoiceModel: (data) => ipcRenderer.invoke('voice:download-model', data),
    deleteVoiceModel: (data) => ipcRenderer.invoke('voice:delete-model', data),
    onVoiceDownloadProgress: (callback) => {
        const listener = (event, data) => callback(data);
        ipcRenderer.on('voice:download-progress', listener);
        return () => ipcRenderer.removeListener('voice:download-progress', listener);
    },

    // Recognition
    startVoiceRecognition: (data) => ipcRenderer.invoke('voice:start-recognition', data),
    stopVoiceRecognition: () => ipcRenderer.invoke('voice:stop-recognition'),
    sendAudioChunk: (buffer) => ipcRenderer.send('voice:audio-chunk', buffer),
    onVoiceEngineReady: (callback) => {
        const listener = (event) => callback();
        ipcRenderer.on('voice:engine-ready', listener);
        return () => ipcRenderer.removeListener('voice:engine-ready', listener);
    },
    onVoiceRecognitionResult: (callback) => {
        const listener = (event, data) => callback(data);
        ipcRenderer.on('voice:recognition-result', listener);
        return () => ipcRenderer.removeListener('voice:recognition-result', listener);
    },
    onVoiceRecognitionError: (callback) => {
        const listener = (event, data) => callback(data);
        ipcRenderer.on('voice:recognition-error', listener);
        return () => ipcRenderer.removeListener('voice:recognition-error', listener);
    },

    // Telegram Voice Processing
    processTelegramVoice: (fileId) => ipcRenderer.invoke('telegram:process-voice', fileId),

    // SearXNG Search Engine
    installSearXNG: () => ipcRenderer.invoke('searxng:install'),
    getSearXNGStatus: () => ipcRenderer.invoke('searxng:status'),

    // API streaming: listen for chunks from main process proxy
    onApiStreamChunk: (callback) => {
        const listener = (event, data) => callback(data);
        ipcRenderer.on('api-stream-chunk', listener);
        return () => ipcRenderer.removeListener('api-stream-chunk', listener);
    },

    // Menu events listener
    onMenuAction: (callback) => {
        const listener = (event, action) => callback(action);
        ipcRenderer.on('menu-action', listener);
        return () => ipcRenderer.removeListener('menu-action', listener);
    }
});
