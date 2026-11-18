// Increment this version when changing any cached app asset.
const CACHE = "pump-service-v2.1.0";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./core.js",
  "./workbook.js",
  "./schema.js",
  "./report.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./vendor/jspdf.umd.min.js",
  "./vendor/jspdf.plugin.autotable.min.js",
];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});
// An update waits until all old app tabs close, avoiding mixed code versions mid-test.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("pump-service-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request)),
  );
});
