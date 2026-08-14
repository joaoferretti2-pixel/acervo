/* Acervo — service worker: casca offline, sempre priorizando a versão mais
   nova em vez de servir cache antigo por padrão.

   Como funciona a atualização:
   1. skipWaiting() no install: o SW novo não fica "esperando" — assume assim
      que termina de instalar, sem precisar fechar todas as abas.
   2. clients.claim() no activate: o SW novo passa a controlar as abas já
      abertas imediatamente, não só as próximas.
   3. index.html usa estratégia network-first: toda navegação busca a rede
      primeiro; o cache é só reserva pra quando estiver offline. Isso evita
      ficar preso numa versão antiga mesmo sem trocar de service worker.
   4. O index.html (script principal) escuta "controllerchange" e recarrega
      a aba sozinha quando esse SW novo assume — então a pessoa não precisa
      mais fazer hard refresh manual pra ver a versão nova. */
var CACHE = "acervo-v2";
var SHELL = ["./", "index.html", "og-image.png", "icon-192.png", "icon-512.png", "manifest.webmanifest"];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c){ return c.addAll(SHELL).catch(function(){}); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys()
      .then(function(keys){
        return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
      })
      .then(function(){ return self.clients.claim(); })
  );
});

/* Alguns navegadores não disparam updatefound/controllerchange sozinhos se o
   registro nunca é "checado" de novo — esse listener permite a página pedir
   pro SW pular a espera manualmente também, como reforço. */
self.addEventListener("message", function(e){
  if(e.data && e.data.type==="SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", function(e){
  var url = new URL(e.request.url);
  if(e.request.method!=="GET") return;

  /* Navegação e o próprio index: rede primeiro (atualizações chegam sempre),
     cache como reserva offline. */
  if(e.request.mode==="navigate" || url.pathname.endsWith("/index.html")){
    e.respondWith(
      fetch(e.request, { cache:"no-store" }).then(function(r){
        var copy=r.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
        return r;
      }).catch(function(){
        return caches.match(e.request).then(function(m){ return m || caches.match("index.html"); });
      })
    );
    return;
  }

  /* Demais arquivos do mesmo domínio (ícones, manifest, etc.): cache
     primeiro, com atualização em segundo plano (stale-while-revalidate) —
     rápido offline, mas nunca fica desatualizado por muito tempo. */
  if(url.origin===location.origin){
    e.respondWith(
      caches.match(e.request).then(function(cached){
        var network = fetch(e.request).then(function(r){
          var copy=r.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
          return r;
        }).catch(function(){ return cached; });
        return cached || network;
      })
    );
  }
});
