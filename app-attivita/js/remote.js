/*
 * Aura Tasks — collegamento al server di Aura (Cloudflare Workers, cartella server/ del repository):
 * casella del Comando Rapido di Siri e promemoria push.
 * Niente DOM: richieste al server, sottoscrizione push del browser, impostazioni in `aura-tasks:remote`.
 * Le funzioni pure (codice del dispositivo, coda della casella, impostazioni) hanno i loro test in tests/.
 * Tutto è facoltativo: finché l'utente non attiva promemoria o Siri, l'app non fa nessuna richiesta.
 */
(function (Aura) {
  'use strict';

  const { reminders: RM } = Aura;

  /** Indirizzo del server pubblicato (vedi server/README.md). Vuoto = server non ancora configurato. */
  const SERVER_URL = 'https://aura.auramirionick.workers.dev';
  const KEY = 'aura-tasks:remote';
  const SERVER_OVERRIDE_KEY = 'aura-tasks:server'; // solo per le prove, su localhost o da file://
  const TIMEOUT_MS = 12000;
  const CODE_BYTES = 24; // 192 bit casuali → 32 caratteri
  const CODE_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;
  const INBOX_MAX = 30;
  const DONE_MAX = 100;
  const TEXT_MAX = 500;

  /* ---------- Funzioni pure ---------- */

  /** Byte → base64url senza "=". */
  function toBase64url(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /** base64url → byte (serve per la chiave del server in pushManager.subscribe). */
  function fromBase64url(text) {
    const base64 = String(text).replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function isDeviceCode(value) {
    return typeof value === 'string' && CODE_PATTERN.test(value);
  }

  /** Codice segreto del dispositivo, dai byte casuali indicati (nei test sono fissi). */
  function makeDeviceCode(bytes) {
    return toBase64url(bytes);
  }

  function emptySent() {
    // Ultimo stato confermato dal server: sottoscrizione (endpoint, quando) ed elenco dei promemoria (impronta).
    return { endpoint: null, at: 0, key: null };
  }

  function defaults() {
    return {
      code: null,                                           // codice segreto del dispositivo
      reminders: { enabled: false, lead: RM.DEFAULT_LEAD }, // promemoria push
      vapidKey: null,                                       // chiave del server usata per la sottoscrizione
      sent: emptySent(),
      inbox: [],                                            // frasi di Siri ritirate dal server, da mostrare
      done: []                                              // id delle frasi già mostrate (per non rivederle)
    };
  }

  /** Aggiunge alla coda le frasi nuove (non già in coda né già mostrate), dalla più vecchia; al massimo INBOX_MAX. */
  function mergeInbox(queue, items, done) {
    const known = new Set(queue.map(item => item.id).concat(done || []));
    const fresh = [];
    (Array.isArray(items) ? items : []).forEach(item => {
      if (!item || typeof item.id !== 'string' || !item.id || known.has(item.id)) return;
      const text = typeof item.text === 'string' ? item.text.replace(/\s+/g, ' ').trim().slice(0, TEXT_MAX) : '';
      if (!text) return;
      known.add(item.id);
      fresh.push({ id: item.id, text, createdAt: Number.isFinite(item.createdAt) ? item.createdAt : 0 });
    });
    fresh.sort((a, b) => a.createdAt - b.createdAt);
    return queue.concat(fresh).slice(0, INBOX_MAX);
  }

  /**
   * Messaggio per una richiesta al server andata male. Se il server ha spiegato il motivo (limite di richieste,
   * tetto di nuovi dispositivi, server pieno…) vale la sua spiegazione; altrimenti un messaggio generico.
   */
  function troubleMessage(result, online) {
    const status = result ? result.status : 0;
    const error = result && result.data && typeof result.data.error === 'string' ? result.data.error.trim() : '';
    if (status && error) return /[.!?]$/.test(error) ? error : error + '.';
    if (status === 429) return 'Troppe richieste: riprova tra un minuto.';
    if (online === false) return 'Serve internet: riprova quando sei online.';
    return 'Il server di Aura non risponde: riprova tra poco.';
  }

  /** Impostazioni lette dal localStorage, ripulite: valori mancanti o sbagliati tornano ai predefiniti. */
  function normalizeSettings(raw) {
    const result = defaults();
    if (!raw || typeof raw !== 'object') return result;
    const code = isDeviceCode(raw.code) ? raw.code : null;
    const reminders = raw.reminders && typeof raw.reminders === 'object' ? raw.reminders : {};
    const sent = raw.sent && typeof raw.sent === 'object' ? raw.sent : {};
    result.code = code;
    result.reminders = {
      enabled: Boolean(code) && reminders.enabled === true,
      lead: RM.LEADS.includes(reminders.lead) ? reminders.lead : RM.DEFAULT_LEAD
    };
    result.vapidKey = typeof raw.vapidKey === 'string' && raw.vapidKey.length <= 200 ? raw.vapidKey : null;
    result.sent = {
      endpoint: typeof sent.endpoint === 'string' ? sent.endpoint : null,
      at: Number.isFinite(sent.at) ? sent.at : 0,
      key: typeof sent.key === 'string' ? sent.key : null
    };
    result.inbox = mergeInbox([], raw.inbox, []);
    result.done = Array.isArray(raw.done) ? raw.done.filter(id => typeof id === 'string').slice(0, DONE_MAX) : [];
    return result;
  }

  /* ---------- Impostazioni salvate ---------- */

  function load() {
    try {
      return normalizeSettings(JSON.parse(localStorage.getItem(KEY)));
    } catch (err) {
      return defaults();
    }
  }

  function save(settings) {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
      return true;
    } catch (err) {
      return false;
    }
  }

  /** Codice nuovo, da 24 byte casuali del generatore crittografico del browser. */
  function newDeviceCode() {
    return makeDeviceCode(window.crypto.getRandomValues(new Uint8Array(CODE_BYTES)));
  }

  /* ---------- Server ---------- */

  function isLocal() {
    return location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  }

  /** Indirizzo del server. Nelle prove (localhost o file://) si può puntare a un server locale. */
  function serverUrl() {
    if (isLocal()) {
      try {
        const override = localStorage.getItem(SERVER_OVERRIDE_KEY);
        if (override) return override.replace(/\/+$/, '');
      } catch (err) {
        // localStorage non disponibile: si usa l'indirizzo normale.
      }
    }
    return SERVER_URL;
  }

  /** 'ok', 'file' (pagina aperta dal computer: niente https) oppure 'unconfigured' (manca l'indirizzo del server). */
  function availability() {
    const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!secure) return 'file';
    if (!serverUrl()) return 'unconfigured';
    return 'ok';
  }

  /** Richiesta al server. Non lancia mai: { ok, status, data }, con status 0 se la rete non risponde. */
  async function request(method, path, { code, body } = {}) {
    const base = serverUrl();
    if (!base) return { ok: false, status: 0, data: null };
    const headers = {};
    if (code) headers.Authorization = 'Bearer ' + code;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;
    try {
      const response = await fetch(base + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
        signal: controller ? controller.signal : undefined
      });
      let data = null;
      try {
        data = await response.json();
      } catch (err) {
        data = null;
      }
      return { ok: response.ok, status: response.status, data };
    } catch (err) {
      return { ok: false, status: 0, data: null };
    } finally {
      clearTimeout(timer);
    }
  }

  const api = {
    pushKey: () => request('GET', '/api/push/key'),
    register: code => request('POST', '/api/devices', { code }),
    unregister: code => request('DELETE', '/api/devices', { code }),
    inbox: code => request('GET', '/api/inbox', { code }),
    ackInbox: (code, ids) => request('POST', '/api/inbox/ack', { code, body: { ids } }),
    putSubscription: (code, subscription) => request('PUT', '/api/push/subscription', { code, body: subscription }),
    deleteSubscription: code => request('DELETE', '/api/push/subscription', { code }),
    putReminders: (code, list) => request('PUT', '/api/reminders', { code, body: { reminders: list } }),
    testPush: code => request('POST', '/api/push/test', { code })
  };

  /* ---------- Notifiche push del browser ---------- */

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isStandalone() {
    return navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  }

  /**
   * Si possono usare le notifiche push qui? { ok: true }, oppure { ok: false, reason }:
   * 'ios-install' (iPhone, Aura non installata sulla schermata Home), 'unsupported', 'denied' (permesso negato).
   */
  function pushSupport() {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!supported) return { ok: false, reason: isIOS() && !isStandalone() ? 'ios-install' : 'unsupported' };
    if (Notification.permission === 'denied') return { ok: false, reason: 'denied' };
    return { ok: true };
  }

  /** Registrazione del service worker quando è pronta, oppure null (per esempio da file://) dopo qualche secondo. */
  function registration() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    return Promise.race([
      navigator.serviceWorker.ready,
      new Promise(resolve => setTimeout(() => resolve(null), 5000))
    ]).catch(() => null);
  }

  async function currentSubscription(reg) {
    try {
      return reg ? await reg.pushManager.getSubscription() : null;
    } catch (err) {
      return null;
    }
  }

  /** Sottoscrizione con la chiave del server. Se ce n'è una fatta con un'altra chiave, la toglie e la rifà. */
  async function subscribe(reg, vapidKey) {
    const options = { userVisibleOnly: true, applicationServerKey: fromBase64url(vapidKey) };
    try {
      return await reg.pushManager.subscribe(options);
    } catch (err) {
      const old = await currentSubscription(reg);
      if (!old) throw err;
      await old.unsubscribe();
      return reg.pushManager.subscribe(options);
    }
  }

  Aura.remote = {
    // pure
    toBase64url,
    fromBase64url,
    isDeviceCode,
    makeDeviceCode,
    defaults,
    emptySent,
    mergeInbox,
    normalizeSettings,
    troubleMessage,
    // impostazioni e codice
    KEY,
    load,
    save,
    newDeviceCode,
    // server
    serverUrl,
    availability,
    api,
    // dispositivo (serve anche al backup: su iPhone si condivide il file invece di scaricarlo)
    isIOS,
    // notifiche push
    pushSupport,
    registration,
    currentSubscription,
    subscribe
  };
})(window.Aura = window.Aura || {});
