// Service worker: zorgt dat de site ook zonder bereik werkt (trein, vliegtuig).
// Altijd eerst het netwerk proberen; lukt dat, dan de nieuwe versie bewaren. Lukt het niet, dan
// de laatst bewaarde versie tonen. De pagina laat zelf zien dat je offline bent en van wanneer de
// gegevens zijn.
var CACHE = "eu-monitor-v2";

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (ev) {
  // oude bewaarde versies opruimen
  ev.waitUntil(caches.keys().then(function (namen) {
    return Promise.all(namen.filter(function (n) { return n !== CACHE; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (ev) {
  var req = ev.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // .ics-bestanden en de test-/hulppagina's niet bewaren
  if (/\.ics$/.test(url.pathname)) return;
  // altijd bij de server navragen of er een nieuwere versie is (geen oude kopie uit de browsercache)
  var vers = req.mode === "navigate" ? fetch(req.url, { cache: "no-cache", credentials: "same-origin" }) : fetch(req, { cache: "no-cache" });
  ev.respondWith(
    vers.then(function (antwoord) {
      if (antwoord && antwoord.ok) {
        var kopie = antwoord.clone();
        caches.open(CACHE).then(function (c) { c.put(req.mode === "navigate" ? "./" : req, kopie); });
      }
      return antwoord;
    }).catch(function () {
      return caches.open(CACHE).then(function (c) {
        return c.match(req.mode === "navigate" ? "./" : req, { ignoreSearch: true });
      }).then(function (bewaard) {
        return bewaard || new Response("Offline en nog niets bewaard.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      });
    })
  );
});
