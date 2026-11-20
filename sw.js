/* Taiwan 2026 home-screen app: keeps the last copy of the page (still encrypted), the fonts and the photos already seen,
   so the planner opens with no signal. Nothing here is decrypted or stored in readable form. */
var SHELL = "tw26-shell-v1", MEDIA = "tw26-media-v1";
var FILES = ["./", "icon-180.png", "icon-192.png", "icon-512.png", "manifest.webmanifest"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(SHELL).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== SHELL && k !== MEDIA; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);

  /* The page and its own files: always try the network first so updates arrive, fall back to the saved copy offline. */
  if (url.origin === self.location.origin) {
    var key = req.mode === "navigate" ? "./" : url.origin + url.pathname;
    e.respondWith(fetch(req).then(function (r) {
      if (r.ok) { var copy = r.clone(); caches.open(SHELL).then(function (c) { c.put(key, copy); }); }
      return r;
    }).catch(function () {
      return caches.open(SHELL).then(function (c) { return c.match(key); }).then(function (hit) { return hit || Response.error(); });
    }));
    return;
  }

  /* Fonts and photos never change at a given address: serve the saved copy, fetch and keep it the first time. */
  var host = url.hostname;
  if (host === "fonts.googleapis.com" || host === "fonts.gstatic.com" || host === "thumb.wikimedia.org" || host === "upload.wikimedia.org") {
    e.respondWith(caches.open(MEDIA).then(function (c) {
      return c.match(req.url).then(function (hit) {
        if (hit) return hit;
        return fetch(req.url, { mode: "cors", credentials: "omit" }).then(function (r) {
          if (r.ok) c.put(req.url, r.clone());
          return r;
        }).catch(function () { return fetch(req); });
      });
    }));
  }
  /* Everything else (sync, weather, exchange rate, uploads) goes straight to the network. */
});
