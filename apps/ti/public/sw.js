const CACHE = "raizes-ti-static-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("raizes-ti-static-") && key !== CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      ),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const cacheable =
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/favicon.svg";
  if (!cacheable) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      const refresh = fetch(request).then((response) => {
        if (response.ok) void cache.put(request, response.clone());
        return response;
      });
      if (cached) {
        event.waitUntil(refresh.then(() => undefined).catch(() => undefined));
        return cached;
      }
      return refresh;
    })(),
  );
});
