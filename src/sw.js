const CACHE_NAME = 'powerlog-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/js/app.js',
  '/js/db/schema.js',
  '/js/db/dexie-wrapper.js',
  '/js/modules/planner.js',
  '/js/modules/workoutBuilder.js',
  '/js/modules/logger.js',
  '/js/modules/rmManager.js',
  '/js/modules/competition.js',
  '/js/modules/analytics.js',
  '/js/modules/uiHelpers.js',
  '/js/backup/export.js',
  '/js/backup/import.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
});
