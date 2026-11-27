/*
 * Aura Tasks — service worker: permette di aprire l'app anche senza connessione
 * e mostra le notifiche dei promemoria che arrivano dal server di Aura.
 * Strategia "prima la rete": online si vede sempre l'ultima versione pubblicata,
 * offline (o con una rete troppo lenta) si usa la copia salvata in cache.
 */
'use strict';

// Quando aggiungi, togli o rinomini un file dell'app: aggiorna APP_FILES e aumenta la versione.
// La stessa versione va in VERSION di js/update.js: la pagina la confronta con le cache (lo controlla la CI).
const CACHE_VERSION = 'aura-tasks-v29';
const APP_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/theme.js',
  './js/utils.js',
  './js/repeat.js',
  './js/tasks.js',
  './js/nlp.js',
  './js/points.js',
  './js/focus.js',
  './js/challenges.js',
  './js/suggest.js',
  './js/assistant.js',
  './js/agenda.js',
  './js/motivation.js',
  './js/rewards.js',
  './js/shop.js',
  './js/music.js',
  './js/sound.js',
  './js/sound-worker.js',
  './js/swipe.js',
  './js/storage.js',
  './js/reminders.js',
  './js/remote.js',
  './js/motion.js',
  './js/settings.js',
  './js/claude.js',
  './js/update.js',
  './js/ui-focus.js',
  './js/ui-assistant.js',
  './js/ui-settings.js',
  './js/ui-claude.js',
  './js/ui-agenda.js',
  './js/ui-motivation.js',
  './js/ui-rewards.js',
  './js/ui-challenges.js',
  './js/ui-shop.js',
  './js/ui-music.js',
  './js/ui-sound.js',
  './js/ui-swipe.js',
  './js/app.js',
  './images/empty-focus.webp',
  './images/suggest-none.webp',
  './images/level-1-spark.webp',
  './images/level-2-flame.webp',
  './images/level-3-glow.webp',
  './images/level-5-comet.webp',
  './images/level-6-constellation.webp',
  './images/level-7-aurora.webp',
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
      (isAppPage(request) ? await cache.match('./index.html') : undefined);
    return cached || network; // niente in cache: si aspetta comunque la rete
  }
}

/**
 * true se si sta aprendo la pagina dell'app: la sua cartella o index.html, con qualunque parametro (?add=, ?task=).
 * Solo per lei index.html fa da riserva. Per un'altra pagina, come prove/voce.html, comparirebbe l'app al suo posto.
 */
function isAppPage(request) {
  if (request.mode !== 'navigate') return false;
  const path = new URL(request.url).pathname;
  const scope = new URL(self.registration.scope).pathname;
  return path === scope || path === scope + 'index.html';
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

/* ---------- Notifiche dei promemoria (Web Push dal server di Aura) ---------- */

// Fine del focus (tre modalità, fase 2b): l'app manda al server un promemoria con id «focus-<id dell'attività>», e il
// server dà alla notifica il tag «aura-» + id, come agli altri. Dal server la riga sotto il titolo arriva come
// «Adesso, alle 10:25»: qui diventa questa. Il tocco apre Aura senza ?task=, perché il focus si riapre da solo.
const FOCUS_TAG = 'aura-focus-';
const FOCUS_BODY = 'Tocca per completarla o per aggiungere 5 minuti.';

// Ogni push va mostrato: su iPhone un push senza notifica fa perdere la sottoscrizione.
self.addEventListener('push', event => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch (err) {
    message = { body: event.data ? event.data.text() : '' };
  }
  const focusEnd = typeof message.tag === 'string' && message.tag.startsWith(FOCUS_TAG);
  event.waitUntil(self.registration.showNotification(message.title || 'Aura', {
    body: focusEnd ? FOCUS_BODY : (message.body || ''),
    tag: message.tag || 'aura',
    icon: new URL('icons/icon-192.png', self.registration.scope).href,
    data: { url: focusEnd ? './' : (message.url || './') }
  }));
});

// Tocco sulla notifica: porta in primo piano Aura (o la apre) e mostra l'attività. Per la fine del focus basta portarla in
// primo piano: il focus si vede già (o si riapre all'avvio).
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope);
  const taskId = target.searchParams.get('task');
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      const open = windows.find(client => client.url.startsWith(self.registration.scope));
      if (!open) return self.clients.openWindow(target.href);
      return open.focus().catch(() => open).then(client => {
        if (taskId) client.postMessage({ type: 'open-task', id: taskId });
      });
    })
  );
});
