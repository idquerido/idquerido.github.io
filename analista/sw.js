// Service worker exclusivo do Querido Analista. Não intercepta requisições.
self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
