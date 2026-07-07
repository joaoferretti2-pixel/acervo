/* Acervo — service worker: casca offline, sempre buscando a versão nova primeiro */
var CACHE = "acervo-v1";
var SHELL = ["./", "index.html", "og-image.png", "icon-192.png", "icon-512.png", "manifest.webmanifest"];

self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(SHELL).catch(function(){}); }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener("fetch", function(e){
  var url = new URL(e.request.url);
  if(e.request.method!=="GET") return;

  /* Navegação e o próprio index: rede primeiro (atualizações chegam sempre), cache como reserva offline */
  if(e.request.mode==="navigate" || url.pathname.endsWith("/index.html")){
    e.respondWith(
      fetch(e.request).then(function(r){
        var copy=r.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
        return r;
      }).catch(function(){ return caches.match(e.request).then(function(m){ return m || caches.match("index.html"); }); })
    );
    return;
  }

  /* Demais arquivos do mesmo domínio: cache primeiro */
  if(url.origin===location.origin){
    e.respondWith(
      caches.match(e.request).then(function(m){
        return m || fetch(e.request).then(function(r){
          var copy=r.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
          return r;
        });
      })
    );
  }
});
