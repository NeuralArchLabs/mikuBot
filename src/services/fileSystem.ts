import { DB_NAME, STORE_NAME } from '../constants';

export const db = {
    init: () => new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    }),
    set: async (key: string, val: any) => {
        const database = await db.init();
        return new Promise<void>((resolve, reject) => {
            const tx = database.transaction(STORE_NAME, 'readwrite');
            const req = tx.objectStore(STORE_NAME).put(val, key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },
    get: async (key: string) => {
        const database = await db.init();
        return new Promise<any>((resolve, reject) => {
            const tx = database.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
};
