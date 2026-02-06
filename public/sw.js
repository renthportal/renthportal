// RenthPortal Service Worker v8 - Minimal
const CACHE_NAME = 'renth-v8';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => 
      Promise.all(names.filter(n => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Skip chrome-extension and non-GET
  if (event.request.url.startsWith('chrome-extension://')) return;
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('supabase.co')) return;
  
  // Network first, no caching for simplicity
  event.respondWith(fetch(event.request));
});
