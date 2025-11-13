/**
 * Storage module for VoxAlpha
 * Handles IndexedDB operations for persisting language selection,
 * model caching, and practice history
 */

const DB_NAME = 'VoxAlphaDB';
const DB_VERSION = 1;
const STORES = {
    SETTINGS: 'settings',
    MODELS: 'models',
    HISTORY: 'history'
};

class Storage {
    constructor() {
        this.db = null;
    }

    /**
     * Initialize IndexedDB
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                reject(new Error('Failed to open IndexedDB'));
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create settings store
                if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
                    db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
                }

                // Create models store for caching STT/TTS models
                if (!db.objectStoreNames.contains(STORES.MODELS)) {
                    db.createObjectStore(STORES.MODELS, { keyPath: 'name' });
                }

                // Create history store for practice results
                if (!db.objectStoreNames.contains(STORES.HISTORY)) {
                    const historyStore = db.createObjectStore(STORES.HISTORY, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    historyStore.createIndex('timestamp', 'timestamp', { unique: false });
                    historyStore.createIndex('language', 'language', { unique: false });
                }
            };
        });
    }

    /**
     * Get a value from a store
     */
    async get(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(new Error(`Failed to get ${key} from ${storeName}`));
            };
        });
    }

    /**
     * Set a value in a store
     */
    async set(storeName, value) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(value);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(new Error(`Failed to set value in ${storeName}`));
            };
        });
    }

    /**
     * Delete a value from a store
     */
    async delete(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(new Error(`Failed to delete ${key} from ${storeName}`));
            };
        });
    }

    /**
     * Get all values from a store
     */
    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(new Error(`Failed to get all from ${storeName}`));
            };
        });
    }

    /**
     * Save language preference
     */
    async saveLanguage(language) {
        return this.set(STORES.SETTINGS, { key: 'language', value: language });
    }

    /**
     * Get language preference
     */
    async getLanguage() {
        const result = await this.get(STORES.SETTINGS, 'language');
        return result ? result.value : 'en';
    }

    /**
     * Save model data (STT/TTS models)
     */
    async saveModel(name, data) {
        return this.set(STORES.MODELS, {
            name,
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Get model data
     */
    async getModel(name) {
        const result = await this.get(STORES.MODELS, name);
        return result ? result.data : null;
    }

    /**
     * Save practice history entry
     */
    async saveHistory(entry) {
        return this.set(STORES.HISTORY, {
            ...entry,
            timestamp: Date.now()
        });
    }

    /**
     * Get practice history
     */
    async getHistory(limit = 100) {
        const all = await this.getAll(STORES.HISTORY);
        return all
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    /**
     * Clear all data
     */
    async clear() {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const stores = [STORES.SETTINGS, STORES.MODELS, STORES.HISTORY];

        for (const storeName of stores) {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            await new Promise((resolve, reject) => {
                const request = store.clear();
                request.onsuccess = resolve;
                request.onerror = reject;
            });
        }
    }
}

// Export singleton instance
export const storage = new Storage();
