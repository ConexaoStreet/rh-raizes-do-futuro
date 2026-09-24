const CACHE = "raizes-static-v3";

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
            .filter((key) => key.startsWith("raizes-static-") && key !== CACHE)
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
    url.pathname.startsWith("/brand/") ||
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


self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Raízes do Futuro", body: event.data?.text() || "Nova notificação." };
  }

  const title = data.title || "Raízes do Futuro";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "Você tem uma nova notificação no RH.",
      icon: data.icon || "/icons/icon-192.png",
      badge: data.badge || "/icons/icon-192.png",
      tag: data.tag || "raizes-rh",
      data: { url: data.url || "/#/notificacoes" },
      renotify: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/#/notificacoes";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        for (const client of clients) {
          if ("navigate" in client) {
            await client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
