const CACHE = "raizes-ti-static-v3";

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
  const immutableAsset = url.pathname.startsWith("/assets/");
  const mutableAsset =
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/favicon.svg" ||
    url.pathname === "/manifest.webmanifest";
  if (!immutableAsset && !mutableAsset) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (immutableAsset) {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      }
      try {
        const response = await fetch(request, { cache: "no-store" });
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw new Error("OFFLINE_ASSET_UNAVAILABLE");
      }
    })(),
  );
});
