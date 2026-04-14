// ─────────────────────────────────────────────
//  Suraksha — sw.js  (Service Worker)
//  • Caches static assets for offline use
//  • Queues POST /api/complaints in IndexedDB
//    when offline, syncs when back online
// ─────────────────────────────────────────────

const CACHE_NAME    = 'suraksha-v1';
const IDB_NAME      = 'suraksha-offline';
const IDB_STORE     = 'pending-complaints';
const API_BASE      = '/api';

// ── Assets to pre-cache ───────────────────────
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/report.html',
  '/track.html',
  '/evidence.html',
  '/map.html',
  '/css/global.css',
  '/css/components.css',
  '/css/animations.css',
  '/js/app.js',
  '/js/report.js',
  '/js/track.js',
  '/js/evidence.js',
  '/js/map.js',
  '/manifest.json',
  // CDN assets cached at runtime (Leaflet etc.) — see fetch handler
];

// ═════════════════════════════════════════════
//  INSTALL — pre-cache static shell
// ═════════════════════════════════════════════
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ═════════════════════════════════════════════
//  ACTIVATE — delete old caches
// ═════════════════════════════════════════════
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ═════════════════════════════════════════════
//  FETCH — network-first for API, cache-first
//           for static assets
// ═════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ── POST /api/complaints → queue if offline ─
  if (request.method === 'POST' && url.pathname === `${API_BASE}/complaints`) {
    event.respondWith(handleComplaintPost(request));
    return;
  }

  // ── Other API calls → network only (no cache) ─
  if (url.pathname.startsWith(API_BASE)) {
    event.respondWith(fetch(request));
    return;
  }

  // ── Static assets → cache-first ─────────────
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Cache successful GET responses
        if (response && response.status === 200 && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

// ═════════════════════════════════════════════
//  BACKGROUND SYNC — replay queued complaints
// ═════════════════════════════════════════════
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-complaints') {
    event.waitUntil(syncQueuedComplaints());
  }
});

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

/** Try to POST; if offline, save to IndexedDB and return a fake 202. */
async function handleComplaintPost(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch (_networkErr) {
    // Offline — serialise the request body and queue it
    const body = await request.text();
    await saveToQueue({ url: request.url, body, ts: Date.now() });

    // Register a background sync so it replays when back online
    try {
      await self.registration.sync.register('sync-complaints');
    } catch (_) { /* sync API not available in all browsers */ }

    // Return a synthetic "queued" response to the page
    return new Response(
      JSON.stringify({ queued: true, message: 'Offline — complaint saved and will sync automatically.' }),
      { status: 202, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/** Replay all queued complaints from IndexedDB */
async function syncQueuedComplaints() {
  const db      = await openDB();
  const pending = await getAllFromStore(db);

  for (const item of pending) {
    try {
      const response = await fetch(item.url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    item.body,
      });

      if (response.ok) {
        await deleteFromStore(db, item.id);
        console.log('[SW] Synced queued complaint id', item.id);
      }
    } catch (err) {
      console.warn('[SW] Sync failed for item', item.id, err.message);
      // Will retry on next sync event
    }
  }
}

// ─────────────────────────────────────────────
//  Minimal IndexedDB helpers (no library)
// ─────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

function saveToQueue(item) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx    = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        const req   = store.add(item);
        req.onsuccess = () => resolve(req.result);
        req.onerror   = (e) => reject(e.target.error);
      })
  );
}

function getAllFromStore(db) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const req   = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

function deleteFromStore(db, id) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req   = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}