// Service worker exclusivo do Hub Pessoal (/hub-pessoal/): nao faz cache nem intercepta requisicoes.
self.addEventListener('install',function(){self.skipWaiting();});
self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim());});
self.addEventListener('fetch',function(){});
