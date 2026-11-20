// Service worker minimo: serve a rendere l'app installabile. I prezzi sono sempre live, nessuna cache dei dati.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
