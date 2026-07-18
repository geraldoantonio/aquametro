importScripts("js/version.js");
const CACHE = "controle-agua-v" + APP_VERSION;
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./js/version.js",
  "./js/i18n.js",
  "./js/ocr.js",
  "./js/app.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request)
        .then((res) => {
          // Runtime-cache same-origin assets not in the precache list — notably the
          // lazily loaded OCR engine under vendor/tesseract/ — so it works offline
          // after the first use without bloating the install for users who never scan.
          if (res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        // Only navigations fall back to the app shell when offline. Serving index.html
        // for a failed script/wasm request would hand HTML to a <script> and silently
        // break the OCR engine load — let those requests fail properly instead.
        .catch(() => (e.request.mode === "navigate" ? caches.match("./index.html") : Response.error()));
    })
  );
});
