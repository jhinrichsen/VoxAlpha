/**
 * Service Worker for VoxAlpha
 * Handles offline caching and resource management
 * Version: __VERSION__
 */

// Cache names
const CACHE_NAME = 'voxalpha-v1';
const RUNTIME_CACHE = 'voxalpha-runtime-v1';

// Core files that must be cached for offline functionality
const CORE_ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './storage.js',
    './manifest.json',
    './alphabets.json',
    './whisper-wrapper.js',
    './tts-wrapper.js',
    './lib/whisper/main.js',
    './lib/whisper/libmain.wasm',
    './lib/whisper/helpers.js',
    './lib/whisper/coi-serviceworker.js'
    // Note: Model file (ggml-small-q8_0.bin) is cached in IndexedDB by whisper-wrapper.js
];

/**
 * Install event - cache core assets
 */
self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Install event');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[ServiceWorker] Caching core assets');
                return cache.addAll(CORE_ASSETS);
            })
            .then(() => {
                console.log('[ServiceWorker] Core assets cached');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[ServiceWorker] Failed to cache core assets:', error);
            })
    );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activate event');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((cacheName) => {
                            return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
                        })
                        .map((cacheName) => {
                            console.log('[ServiceWorker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        })
                );
            })
            .then(() => {
                console.log('[ServiceWorker] Old caches cleaned up');
                return self.clients.claim();
            })
    );
});

/**
 * Fetch event - serve from cache, fallback to network
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip cross-origin requests
    if (url.origin !== location.origin) {
        return;
    }

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    console.log('[ServiceWorker] Serving from cache:', request.url);
                    // Add COOP/COEP headers for SharedArrayBuffer support
                    const headers = new Headers(cachedResponse.headers);
                    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
                    headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
                    return new Response(cachedResponse.body, {
                        status: cachedResponse.status,
                        statusText: cachedResponse.statusText,
                        headers: headers
                    });
                }

                // Not in cache, fetch from network
                return fetch(request)
                    .then((response) => {
                        // Don't cache invalid responses
                        if (!response || response.status !== 200 || response.type === 'error') {
                            return response;
                        }

                        // Clone the response
                        const responseToCache = response.clone();

                        // Cache the fetched response for future use
                        caches.open(RUNTIME_CACHE)
                            .then((cache) => {
                                console.log('[ServiceWorker] Caching new resource:', request.url);
                                cache.put(request, responseToCache);
                            });

                        // Add COOP/COEP headers for SharedArrayBuffer support
                        const headers = new Headers(response.headers);
                        headers.set('Cross-Origin-Opener-Policy', 'same-origin');
                        headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
                        return new Response(response.body, {
                            status: response.status,
                            statusText: response.statusText,
                            headers: headers
                        });
                    })
                    .catch((error) => {
                        console.error('[ServiceWorker] Fetch failed:', error);

                        // Return a custom offline page if available
                        if (request.destination === 'document') {
                            return caches.match('./index.html');
                        }

                        // Return a basic error response
                        return new Response('Offline - Resource not available', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({
                                'Content-Type': 'text/plain'
                            })
                        });
                    });
            })
    );
});

/**
 * Message event - handle commands from the app
 */
self.addEventListener('message', (event) => {
    console.log('[ServiceWorker] Message received:', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CACHE_URLS') {
        const urls = event.data.urls;
        event.waitUntil(
            caches.open(RUNTIME_CACHE)
                .then((cache) => {
                    console.log('[ServiceWorker] Caching URLs:', urls);
                    return cache.addAll(urls);
                })
        );
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys()
                .then((cacheNames) => {
                    return Promise.all(
                        cacheNames.map((cacheName) => {
                            console.log('[ServiceWorker] Clearing cache:', cacheName);
                            return caches.delete(cacheName);
                        })
                    );
                })
        );
    }
});

/**
 * Sync event - handle background sync (future enhancement)
 */
self.addEventListener('sync', (event) => {
    console.log('[ServiceWorker] Sync event:', event.tag);

    if (event.tag === 'sync-practice-data') {
        // Future: sync practice history when back online
        event.waitUntil(syncPracticeData());
    }
});

/**
 * Sync practice data (placeholder for future implementation)
 */
async function syncPracticeData() {
    console.log('[ServiceWorker] Syncing practice data...');
    // Future implementation: sync with server if needed
}
