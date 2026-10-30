/*
 * Aura Tasks — service worker: permette di aprire l'app anche senza connessione.
 * Strategia "prima la rete": online si vede sempre l'ultima versione pubblicata,
 * offline (o con una rete troppo lenta) si usa la copia salvata in cache.
 */
'use strict';

// Quando aggiungi, togli o rinomini un file dell'app: aggiorna APP_FILES e aumenta la versione.
const CACHE_VERSION = 'aura-tasks-v4';
const APP_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/theme.js',
  './js/utils.js',
  './js/tasks.js',
  './js/nlp.js',
  './js/points.js',
  './js/storage.js',
  './js/app.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_FILES.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith('aura-tasks-') && key !== CACHE_VERSION).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // "no-cache" chiede conferma al server: dopo un aggiornamento non arrivano file vecchi dalla cache HTTP.
  const network = fetch(request, { cache: 'no-cache' });
  // Prima si registra la copia in cache (così la risposta viene duplicata prima che la pagina la legga)…
  event.waitUntil(saveCopy(request, network));
  // …poi si risponde: rete se arriva in tempo, altrimenti cache.
  event.respondWith(respond(request, network));
});

function saveCopy(request, network) {
  return network
    .then(response => {
      if (!response.ok || response.redirected) return undefined;
      const copy = response.clone();
      return caches.open(CACHE_VERSION).then(cache => cache.put(request, copy));
    })
    .catch(() => {}); // offline: non c'è niente da aggiornare
}

async function respond(request, network) {
  try {
    return await withTimeout(network, NETWORK_TIMEOUT_MS);
  } catch (err) {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request, { ignoreSearch: true }) ||
      (request.mode === 'navigate' ? await cache.match('./index.html') : undefined);
    return cached || network; // niente in cache: si aspetta comunque la rete
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); }
    );
  });
}
