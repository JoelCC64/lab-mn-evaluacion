// Service worker de la app (GENERADO por scripts/precache.mjs desde scripts/sw-plantilla.js; no editar sw.js a mano).
// Guarda todos los archivos de la app para que funcione sin conexión.
// En localhost usa primero la red (desarrollo); publicada, usa primero lo guardado (rápido y sin conexión).

const VERSION = '__VERSION__';
const CACHE = `lab-mn-${VERSION}`;
const ARCHIVOS = __ARCHIVOS__;
const LOCAL = ['localhost', '127.0.0.1'].includes(self.location.hostname);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS.map((a) => new Request(a, { cache: 'reload' })))));
  // Primera instalación: activar de una vez. Actualizaciones: esperar a que Joel toque «Actualizar».
  if (!self.registration.active) self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('lab-mn-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data?.tipo === 'activar') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    const indice = new URL('index.html', self.registration.scope).href;
    e.respondWith(LOCAL ? redPrimero(req, indice) : guardadoPrimero(indice));
    return;
  }
  e.respondWith(LOCAL ? redPrimero(req) : guardadoPrimero(req));
});

async function guardadoPrimero(req) {
  const guardado = await caches.match(req, { ignoreSearch: true });
  return guardado ?? fetch(req);
}

async function redPrimero(req, alternativa) {
  try {
    const r = await fetch(req);
    if (r.ok && !alternativa) (await caches.open(CACHE)).put(req, r.clone());
    return r;
  } catch (error) {
    const guardado = await caches.match(alternativa ?? req, { ignoreSearch: true });
    if (guardado) return guardado;
    throw error;
  }
}
