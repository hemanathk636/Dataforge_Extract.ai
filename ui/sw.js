// Service Worker for Extract Autonomous Web & Document Intelligence PWA
const CACHE_NAME = "extract-pwa-v2.6";

const ASSETS_TO_CACHE = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/icon.svg",
  "/favicon.ico",
  "https://cdn.tailwindcss.com",
  "https://unpkg.com/lucide@latest"
];

// 1. Install Event: Cache Core App Shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Extract PWA] Pre-caching core application shell");
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn("[Extract PWA] Pre-cache warning for external resources:", err);
      });
    })
  );
  self.skipWaiting();
});

// 2. Activate Event: Clean up outdated caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Extract PWA] Removing legacy cache:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch Event: Network-first for /api, Cache-first / Stale-while-revalidate for UI
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Live API requests -> Network First
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Offline: Unable to contact local scraping engine. Check backend server.",
            count: 0,
            data: []
          }),
          {
            headers: { "Content-Type": "application/json" }
          }
        );
      })
    );
    return;
  }

  // App Shell & Static Assets -> Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
