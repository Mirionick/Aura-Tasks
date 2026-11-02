/*
 * Aura — server su Cloudflare Workers (piano gratuito).
 * - Casella del Comando Rapido di Siri: il comando scrive una frase, l'app la ritira quando si apre.
 * - Promemoria Web Push: l'app manda l'elenco dei promemoria, il Cron (ogni minuto) invia quelli arrivati all'ora.
 * Ogni dispositivo si presenta con un codice segreto casuale generato dall'app ("Authorization: Bearer <codice>"):
 * il server ne conserva solo l'impronta SHA-256. Le chiavi VAPID arrivano dai secrets di Cloudflare.
 */
import { base64urlDecode, base64urlEncode, createSigner, importVapidKeys, isUncompressedKey, sendPush } from './webpush.js';
import { INBOX_TEXTS, LIMIT_TEXTS, TEST_MESSAGE, reminderBody } from './text.js';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/** Limiti: tengono il server dentro il piano gratuito e lo proteggono dagli abusi. */
export const LIMITS = {
  textLength: 500,      // caratteri di una frase di Siri
  inboxItems: 30,       // frasi in attesa per dispositivo
  reminders: 200,       // promemoria per dispositivo
  titleLength: 120,
  devices: 1000,        // dispositivi in tutto (si può cambiare con la variabile MAX_DEVICES)
  newDevicesPerDay: 20, // nuove registrazioni in 24 ore, in tutto (variabile MAX_NEW_DEVICES_PER_DAY)
  smallBody: 16 * 1024, // caratteri
  largeBody: 64 * 1024,
  cronBatch: 10,        // invii per giro: CPU (10 ms) e sottorichieste (50) del piano gratuito
  maxAttempts: 5,
  late: 15 * MINUTE,    // passato questo tempo dall'ora dell'attività, il promemoria non si manda più
  inboxDays: 30,
  deviceDays: 180
};

/** Servizi push ammessi (dominio dell'endpoint): così il server non manda richieste a indirizzi qualsiasi. */
const PUSH_HOSTS = ['push.apple.com', 'fcm.googleapis.com', 'push.services.mozilla.com', 'notify.windows.com'];
const CODE = /^[A-Za-z0-9_-]{32,64}$/;
const ITEM_ID = /^[A-Za-z0-9_-]{1,64}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export default {
  fetch(request, env) {
    return handle(request, env, { now: Date.now(), fetch: (url, init) => fetch(url, init) });
  },
  scheduled(controller, env, ctx) {
    ctx.waitUntil(runCron(env, { now: Date.now(), fetch: (url, init) => fetch(url, init) }));
  }
};

/** Errore con il suo stato HTTP: il messaggio arriva all'app. */
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* ---------- Richieste ---------- */

/** Gestisce una richiesta. `deps` = { now, fetch }: nei test sono finti. */
export async function handle(request, env, deps) {
  const origin = request.headers.get('Origin');
  const allowed = allowedOrigin(origin, env);
  // Le pagine di altri siti non possono usare il server. Siri e curl non mandano Origin: per loro decide il codice.
  if (origin && !allowed) return json({ error: 'Origine non ammessa' }, 403);

  let response;
  if (request.method === 'OPTIONS') {
    response = new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '86400'
      }
    });
  } else {
    const rule = rateLimitFor(request.method, new URL(request.url).pathname);
    if (!await withinLimit(request, env, rule)) {
      response = tooManyRequests(rule);
    } else {
      try {
        response = await route(request, env, deps);
      } catch (err) {
        if (err instanceof HttpError) {
          response = json({ error: err.message }, err.status);
        } else {
          console.error('Errore interno:', err && err.name); // mai dati: né codici, né testi, né endpoint
          response = json({ error: 'Errore interno del server' }, 500);
        }
      }
    }
  }
  if (allowed) {
    response.headers.set('Access-Control-Allow-Origin', allowed);
    response.headers.append('Vary', 'Origin');
  }
  return response;
}

const ROUTES = {
  'GET /api/health': () => json({ ok: true }),
  'GET /api/push/key': getPushKey,
  'POST /api/devices': registerDevice,
  'DELETE /api/devices': deleteDevice,
  'POST /api/inbox': addToInbox,
  'GET /api/inbox': listInbox,
  'POST /api/inbox/ack': ackInbox,
  'PUT /api/push/subscription': putSubscription,
  'DELETE /api/push/subscription': deleteSubscription,
  'PUT /api/reminders': putReminders,
  'POST /api/push/test': sendTestPush
};

function route(request, env, deps) {
  const { pathname } = new URL(request.url);
  const handler = ROUTES[request.method + ' ' + pathname];
  if (handler) return handler(request, env, deps);
  const known = Object.keys(ROUTES).some(key => key.endsWith(' ' + pathname));
  throw new HttpError(known ? 405 : 404, known ? 'Metodo non ammesso' : 'Indirizzo sconosciuto');
}

/* ---------- Limiti di richieste per indirizzo IP ---------- */

/** Quale limite vale per una richiesta: binding (vedi wrangler.toml) e prefisso del contatore; null se nessuno. */
function rateLimitFor(method, pathname) {
  if (method === 'OPTIONS' || pathname === '/api/health') return null;
  if (method === 'POST' && pathname === '/api/devices') return { binding: 'RATE_LIMIT_STRICT', prefix: 'devices' };
  if (method === 'POST' && pathname === '/api/push/test') return { binding: 'RATE_LIMIT_STRICT', prefix: 'push-test' };
  if (method === 'POST' && pathname === '/api/inbox') return { binding: 'RATE_LIMIT_INBOX', prefix: 'inbox' };
  return { binding: 'RATE_LIMIT_API', prefix: 'api' };
}

/**
 * true se la richiesta rientra nel limite. Senza binding (test, prove) o se il servizio non risponde
 * la richiesta passa: meglio un limite in meno che un'app bloccata.
 */
async function withinLimit(request, env, rule) {
  const limiter = rule && env[rule.binding];
  if (!limiter || typeof limiter.limit !== 'function') return true;
  try {
    const { success } = await limiter.limit({ key: rule.prefix + ':' + clientKey(request) });
    return success !== false;
  } catch (err) {
    console.error('Limite di richieste non disponibile:', err && err.name);
    return true;
  }
}

/** 429 con Retry-After. Il Comando Rapido riceve testo semplice, che mostra così com'è. */
function tooManyRequests(rule) {
  const response = rule.prefix === 'inbox' ? plain(INBOX_TEXTS.tooMany, 429) : json({ error: LIMIT_TEXTS.tooMany }, 429);
  response.headers.set('Retry-After', '60');
  return response;
}

/**
 * Chiave del client per i limiti: l'indirizzo IP visto da Cloudflare (CF-Connecting-IP, che il client
 * non può falsificare). Per IPv6 vale la rete /64: dentro la propria /64 cambiare indirizzo è banale.
 */
export function clientKey(request) {
  const ip = (request.headers.get('CF-Connecting-IP') || '').trim().toLowerCase();
  if (!ip) return 'sconosciuto';
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  if (mapped) return mapped[1];
  if (!ip.includes(':')) return ip;
  // IPv6, anche in forma compressa ("2001:db8::1"): le prime 4 parti da 16 bit.
  const halves = ip.split('%')[0].split('::');
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length > 1 && halves[1] ? halves[1].split(':') : [];
  const fill = halves.length > 1 ? Array(Math.max(0, 8 - head.length - tail.length)).fill('0') : [];
  return head.concat(fill, tail).slice(0, 4).map(part => part.replace(/^0+/, '') || '0').join(':') + '::/64';
}

/* ---------- Dispositivi ---------- */

/** Impronta SHA-256 (esadecimale) del codice in "Authorization: Bearer …"; null se manca o ha un formato sbagliato. */
async function deviceIdFrom(request) {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(request.headers.get('Authorization') || '');
  if (!match || !CODE.test(match[1])) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(match[1]));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Id del dispositivo registrato, altrimenti errore 401. Segna "visto" al massimo una volta al giorno (meno scritture). */
async function requireDevice(request, env, deps) {
  const id = await deviceIdFrom(request);
  const device = id && await env.DB.prepare('SELECT seen_at FROM devices WHERE id = ?').bind(id).first();
  if (!device) throw new HttpError(401, 'Codice mancante o non valido');
  if (deps.now - device.seen_at > DAY) {
    await env.DB.prepare('UPDATE devices SET seen_at = ? WHERE id = ?').bind(deps.now, id).run();
  }
  return id;
}

/**
 * Registra un dispositivo. Un dispositivo già registrato passa sempre (200).
 * Per uno nuovo: prima il tetto giornaliero, con una query sull'indice devices_created che legge poche righe;
 * solo dopo il conteggio completo, che legge tutta la tabella. Ogni volta che il conteggio completo gira
 * resta una riga con created_at (il dispositivo, oppure un segno anonimo se il server è pieno): così
 * il conteggio completo gira al massimo `newDevicesPerDay` volte in 24 ore.
 */
async function registerDevice(request, env, deps) {
  const id = await deviceIdFrom(request);
  if (!id) throw new HttpError(401, 'Codice mancante o non valido');
  const existing = await env.DB.prepare('SELECT seen_at FROM devices WHERE id = ?').bind(id).first();
  if (existing) {
    await env.DB.prepare('UPDATE devices SET seen_at = ? WHERE id = ?').bind(deps.now, id).run();
    return json({ ok: true, created: false });
  }
  const today = await env.DB.prepare('SELECT COUNT(*) AS n, MIN(created_at) AS oldest FROM devices WHERE created_at > ?')
    .bind(deps.now - DAY).first();
  if (today.n >= newDevicesPerDay(env)) {
    // Finestra mobile di 24 ore: si libera un posto quando la registrazione più vecchia compie un giorno.
    const response = json({ error: LIMIT_TEXTS.dailyCap }, 503);
    response.headers.set('Retry-After', String(Math.max(60, Math.ceil((today.oldest + DAY - deps.now) / 1000))));
    return response;
  }
  const total = await env.DB.prepare("SELECT COUNT(*) AS n FROM devices WHERE id NOT LIKE 'segno:%'").first('n');
  if (total >= maxDevices(env)) {
    await env.DB.prepare('INSERT INTO devices (id, created_at, seen_at) VALUES (?, ?, ?)').bind(markerId(), deps.now, deps.now).run();
    throw new HttpError(503, 'Il server ha raggiunto il numero massimo di dispositivi');
  }
  await env.DB.prepare('INSERT OR IGNORE INTO devices (id, created_at, seen_at) VALUES (?, ?, ?)').bind(id, deps.now, deps.now).run();
  return json({ ok: true, created: true }, 201);
}

/**
 * "Scollega": via casella, sottoscrizione e promemoria; il dispositivo diventa un segno anonimo che conserva
 * created_at. Il codice smette subito di valere, e registrarsi e scollegarsi di continuo non aggira il tetto.
 */
async function deleteDevice(request, env, deps) {
  const id = await requireDevice(request, env, deps);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM reminders WHERE device_id = ?').bind(id),
    env.DB.prepare('DELETE FROM subscriptions WHERE device_id = ?').bind(id),
    env.DB.prepare('DELETE FROM inbox WHERE device_id = ?').bind(id),
    env.DB.prepare('UPDATE devices SET id = ? WHERE id = ?').bind(markerId(), id)
  ]);
  return json({ ok: true });
}

/** Id di un segno anonimo: contiene ":", quindi non può mai coincidere con un'impronta (64 caratteri esadecimali). */
function markerId() {
  return 'segno:' + randomId();
}

function maxDevices(env) {
  const value = Number(env.MAX_DEVICES);
  return value > 0 ? value : LIMITS.devices;
}

function newDevicesPerDay(env) {
  const value = Number(env.MAX_NEW_DEVICES_PER_DAY);
  return value > 0 ? value : LIMITS.newDevicesPerDay;
}

/* ---------- Casella del Comando Rapido ---------- */

/** Il Comando Rapido scrive una frase. Risponde in testo semplice, che il comando mostra in una notifica. */
async function addToInbox(request, env, deps) {
  let id;
  try {
    id = await requireDevice(request, env, deps);
  } catch (err) {
    if (err instanceof HttpError) return plain(INBOX_TEXTS.badCode, 401);
    throw err;
  }
  let text;
  try {
    text = cleanText(await readPhrase(request));
  } catch (err) {
    if (err instanceof HttpError) return plain(err.message, err.status);
    throw err;
  }
  if (!text) return plain(INBOX_TEXTS.empty, 400);
  if (text.length > LIMITS.textLength) return plain(INBOX_TEXTS.tooLong, 400);
  const pending = await env.DB.prepare('SELECT COUNT(*) AS n FROM inbox WHERE device_id = ?').bind(id).first('n');
  if (pending >= LIMITS.inboxItems) return plain(INBOX_TEXTS.full, 429);
  await env.DB.prepare('INSERT INTO inbox (id, device_id, text, created_at) VALUES (?, ?, ?, ?)')
    .bind(randomId(), id, text, deps.now).run();
  return plain(INBOX_TEXTS.added + text, 201);
}

/** Testo della frase: JSON {"text": …}, modulo (text=…) oppure testo semplice, a seconda di come è fatto il comando. */
async function readPhrase(request) {
  const type = (request.headers.get('Content-Type') || '').toLowerCase();
  if (type.startsWith('multipart/form-data')) {
    checkLength(request, LIMITS.smallBody, INBOX_TEXTS.tooLarge);
    const value = (await request.formData()).get('text');
    return value && typeof value.text === 'function' ? value.text() : value;
  }
  const raw = await readBody(request, LIMITS.smallBody, INBOX_TEXTS.tooLarge);
  if (type.startsWith('application/json')) {
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      throw new HttpError(400, INBOX_TEXTS.badJson);
    }
    if (typeof data === 'string') return data;
    if (!data || typeof data !== 'object') return '';
    // Il campo si chiama "text"; se nel comando ha un altro nome, vale il primo testo che si trova.
    return typeof data.text === 'string' ? data.text : Object.values(data).find(value => typeof value === 'string');
  }
  if (type.startsWith('application/x-www-form-urlencoded')) return new URLSearchParams(raw).get('text');
  return raw;
}

/** Le frasi in attesa, dalla più vecchia. */
async function listInbox(request, env, deps) {
  const id = await requireDevice(request, env, deps);
  const { results } = await env.DB.prepare(
    'SELECT id, text, created_at AS createdAt FROM inbox WHERE device_id = ? ORDER BY created_at, rowid LIMIT ?'
  ).bind(id, LIMITS.inboxItems).all();
  return json({ items: results });
}

/** L'app conferma di aver salvato le frasi: si cancellano (solo quelle di questo dispositivo). */
async function ackInbox(request, env, deps) {
  const id = await requireDevice(request, env, deps);
  const body = await readJson(request, LIMITS.smallBody);
  if (!body || !Array.isArray(body.ids)) throw new HttpError(400, 'Dati non validi');
  const ids = body.ids.filter(value => typeof value === 'string' && ITEM_ID.test(value)).slice(0, 100);
  const result = await env.DB.prepare('DELETE FROM inbox WHERE device_id = ? AND id IN (SELECT value FROM json_each(?))')
    .bind(id, JSON.stringify(ids)).run();
  return json({ ok: true, deleted: result.meta.changes });
}

/* ---------- Notifiche push ---------- */

async function getPushKey(request, env) {
  const vapid = await vapidKeys(env);
  if (!vapid) throw new HttpError(503, 'Le chiavi delle notifiche non sono configurate sul server');
  return json({ publicKey: vapid.publicKey });
}

/** Salva (o sostituisce) la sottoscrizione push del dispositivo: è il formato di PushSubscription.toJSON(). */
async function putSubscription(request, env, deps) {
  const id = await requireDevice(request, env, deps);
  const body = await readJson(request, LIMITS.smallBody);
  const endpoint = body && typeof body.endpoint === 'string' ? body.endpoint : '';
  const keys = (body && body.keys) || {};
  if (!isPushEndpoint(endpoint, env)) throw new HttpError(400, 'Servizio di notifiche non riconosciuto');
  if (!isKey(keys.p256dh, 65) || !isKey(keys.auth, 16)) throw new HttpError(400, 'Chiavi della sottoscrizione non valide');
  await env.DB.prepare(
    'INSERT INTO subscriptions (device_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?) ' +
    'ON CONFLICT (device_id) DO UPDATE SET endpoint = excluded.endpoint, p256dh = excluded.p256dh, auth = excluded.auth, created_at = excluded.created_at'
  ).bind(id, endpoint, keys.p256dh, keys.auth, deps.now).run();
  return json({ ok: true });
}

/** Promemoria spenti: niente più sottoscrizione né promemoria. */
async function deleteSubscription(request, env, deps) {
  const id = await requireDevice(request, env, deps);
  await env.DB.batch(forgetStatements(env, [id]));
  return json({ ok: true });
}

/**
 * Sostituisce l'elenco dei promemoria del dispositivo (due query, grazie a json_each).
 * Un promemoria che c'era già, con lo stesso momento d'avviso, conserva il suo stato: se era già partito
 * non riparte. Se il momento cambia (orario o anticipo diversi) è un promemoria nuovo.
 */
async function putReminders(request, env, deps) {
  const id = await requireDevice(request, env, deps);
  const body = await readJson(request, LIMITS.largeBody);
  const list = body && Array.isArray(body.reminders) ? body.reminders : null;
  if (!list || list.length > LIMITS.reminders) throw new HttpError(400, 'Elenco dei promemoria non valido');
  const seen = new Set();
  const clean = [];
  for (const item of list) {
    const reminder = cleanReminder(item, deps.now);
    if (!reminder) throw new HttpError(400, 'Promemoria non valido');
    if (seen.has(reminder.id)) continue;
    seen.add(reminder.id);
    clean.push(reminder);
  }
  const payload = JSON.stringify(clean);
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM reminders WHERE device_id = ? AND task_id NOT IN (SELECT json_extract(value, '$.id') FROM json_each(?))"
    ).bind(id, payload),
    env.DB.prepare(
      'INSERT INTO reminders (device_id, task_id, at, fire_at, title, time) ' +
      "SELECT ?, json_extract(value, '$.id'), json_extract(value, '$.at'), json_extract(value, '$.fireAt'), " +
      "json_extract(value, '$.title'), json_extract(value, '$.time') FROM json_each(?) WHERE 1 " +
      'ON CONFLICT (device_id, task_id) DO UPDATE SET at = excluded.at, title = excluded.title, time = excluded.time, ' +
      'attempts = CASE WHEN reminders.fire_at = excluded.fire_at THEN reminders.attempts ELSE 0 END, ' +
      'sent_at = CASE WHEN reminders.fire_at = excluded.fire_at THEN reminders.sent_at ELSE NULL END, ' +
      'fire_at = excluded.fire_at'
    ).bind(id, payload)
  ]);
  return json({ ok: true, count: clean.length });
}

/** Un promemoria valido e ripulito, oppure null. `at` = ora dell'attività, `fireAt` = quando avvisare (ms). */
function cleanReminder(item, now) {
  if (!item || typeof item !== 'object') return null;
  const { id, at, fireAt, time } = item;
  const title = cleanText(item.title).slice(0, LIMITS.titleLength);
  if (typeof id !== 'string' || !ITEM_ID.test(id)) return null;
  if (!Number.isSafeInteger(at) || !Number.isSafeInteger(fireAt)) return null;
  if (fireAt > at || at - fireAt > DAY) return null;
  if (at < now - DAY || at > now + 400 * DAY) return null;
  if (typeof time !== 'string' || !TIME.test(time) || !title) return null;
  return { id, at, fireAt, title, time };
}

/** "Prova una notifica": invio immediato, con l'esito del servizio push. */
async function sendTestPush(request, env, deps) {
  const id = await requireDevice(request, env, deps);
  const vapid = await vapidKeys(env);
  if (!vapid) throw new HttpError(503, 'Le chiavi delle notifiche non sono configurate sul server');
  const subscription = await env.DB.prepare('SELECT endpoint, p256dh, auth FROM subscriptions WHERE device_id = ?').bind(id).first();
  if (!subscription) throw new HttpError(409, 'Prima attiva i promemoria su questo dispositivo');
  const result = await sendPush(subscription, TEST_MESSAGE, createSigner(vapid, deps.now), { fetch: deps.fetch, ttl: 300 });
  if (isGone(result.status)) {
    await env.DB.batch(forgetStatements(env, [id]));
    throw new HttpError(410, 'La sottoscrizione non è più valida: riattiva i promemoria');
  }
  if (!isSent(result.status)) {
    return json({ error: 'Il servizio di notifiche ha rifiutato l\'invio', status: result.status, reason: result.reason }, 502);
  }
  return json({ ok: true, status: result.status });
}

/* ---------- Cron (ogni minuto) ---------- */

/** Invia i promemoria arrivati all'ora; allo scoccare di ogni ora fa pulizia. */
export async function runCron(env, deps) {
  const vapid = await vapidKeys(env);
  if (vapid) await sendDueReminders(env, deps, vapid);
  if (new Date(deps.now).getUTCMinutes() === 0) await cleanup(env, deps.now);
}

async function sendDueReminders(env, deps, vapid) {
  const { results } = await env.DB.prepare(
    'SELECT r.rowid AS rowid, r.device_id AS deviceId, r.task_id AS taskId, r.at, r.fire_at AS fireAt, r.title, r.time, ' +
    'r.attempts, s.endpoint, s.p256dh, s.auth FROM reminders r JOIN subscriptions s ON s.device_id = r.device_id ' +
    'WHERE r.fire_at <= ? AND r.sent_at IS NULL ORDER BY r.fire_at LIMIT ?'
  ).bind(deps.now, LIMITS.cronBatch).all();
  if (!results.length) return;

  const sign = createSigner(vapid, deps.now);
  const late = results.filter(row => deps.now > row.at + LIMITS.late);
  const due = results.filter(row => deps.now <= row.at + LIMITS.late);
  // Invii in parallelo (ognuno con il suo timeout): il giro finisce ben prima del minuto successivo.
  const outcomes = await Promise.all(due.map(row => sendPush(row, {
    title: row.title,
    body: reminderBody(row.time, row.at, deps.now),
    tag: 'aura-' + row.taskId,
    url: './?task=' + encodeURIComponent(row.taskId)
  }, sign, { fetch: deps.fetch, ttl: ttlFor(row.at, deps.now) })));

  const finished = []; // inviati, oppure lasciati perdere dopo troppi tentativi: restano segnati fino all'ora dell'attività
  const retry = [];
  const gone = new Set();
  due.forEach((row, index) => {
    const { status } = outcomes[index];
    if (isSent(status)) finished.push(row.rowid);
    else if (isGone(status)) gone.add(row.deviceId);
    else if (row.attempts + 1 >= LIMITS.maxAttempts) finished.push(row.rowid);
    else retry.push(row.rowid);
  });

  const statements = [];
  if (late.length) {
    statements.push(env.DB.prepare('DELETE FROM reminders WHERE rowid IN (SELECT value FROM json_each(?))').bind(JSON.stringify(late.map(row => row.rowid))));
  }
  if (finished.length) {
    statements.push(env.DB.prepare('UPDATE reminders SET sent_at = ? WHERE rowid IN (SELECT value FROM json_each(?))').bind(deps.now, JSON.stringify(finished)));
  }
  if (retry.length) {
    statements.push(env.DB.prepare('UPDATE reminders SET attempts = attempts + 1 WHERE rowid IN (SELECT value FROM json_each(?))').bind(JSON.stringify(retry)));
  }
  if (gone.size) statements.push(...forgetStatements(env, [...gone]));
  if (statements.length) await env.DB.batch(statements);
}

/** Per quanto il servizio push conserva il messaggio se il telefono è spento: fino a poco dopo l'ora dell'attività. */
function ttlFor(at, now) {
  return Math.min(3600, Math.max(60, Math.round((at + LIMITS.late - now) / 1000)));
}

/** Pulizia oraria: frasi dimenticate, promemoria passati, segni anonimi di oltre un giorno, dispositivi non più visti. */
async function cleanup(env, now) {
  const oldDevices = 'SELECT id FROM devices WHERE seen_at < ?';
  const deviceLimit = now - LIMITS.deviceDays * DAY;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM devices WHERE id LIKE 'segno:%' AND created_at < ?").bind(now - DAY),
    env.DB.prepare('DELETE FROM inbox WHERE created_at < ?').bind(now - LIMITS.inboxDays * DAY),
    env.DB.prepare('DELETE FROM reminders WHERE at < ?').bind(now - LIMITS.late),
    env.DB.prepare('DELETE FROM reminders WHERE device_id IN (' + oldDevices + ')').bind(deviceLimit),
    env.DB.prepare('DELETE FROM subscriptions WHERE device_id IN (' + oldDevices + ')').bind(deviceLimit),
    env.DB.prepare('DELETE FROM inbox WHERE device_id IN (' + oldDevices + ')').bind(deviceLimit),
    env.DB.prepare('DELETE FROM devices WHERE seen_at < ?').bind(deviceLimit)
  ]);
}

/** Sottoscrizione scaduta o spenta: si dimenticano sottoscrizione e promemoria dei dispositivi indicati. */
function forgetStatements(env, deviceIds) {
  const ids = JSON.stringify(deviceIds);
  return [
    env.DB.prepare('DELETE FROM reminders WHERE device_id IN (SELECT value FROM json_each(?))').bind(ids),
    env.DB.prepare('DELETE FROM subscriptions WHERE device_id IN (SELECT value FROM json_each(?))').bind(ids)
  ];
}

const isSent = status => status >= 200 && status < 300;
const isGone = status => status === 404 || status === 410;

/* ---------- Utilità ---------- */

function vapidKeys(env) {
  return importVapidKeys(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY, env.VAPID_SUBJECT);
}

function allowedOrigin(origin, env) {
  if (!origin) return null;
  const list = String(env.ALLOWED_ORIGINS || '').split(',').map(item => item.trim()).filter(Boolean);
  return list.includes(origin) ? origin : null;
}

/** https verso un servizio push noto. Nelle prove in locale vale anche l'origine PUSH_TEST_ORIGIN (solo in .dev.vars). */
function isPushEndpoint(value, env) {
  if (!value || value.length > 1024) return false;
  let url;
  try {
    url = new URL(value);
  } catch (err) {
    return false;
  }
  if (env.PUSH_TEST_ORIGIN && url.origin === env.PUSH_TEST_ORIGIN) return true;
  if (url.protocol !== 'https:') return false;
  return PUSH_HOSTS.some(host => url.hostname === host || url.hostname.endsWith('.' + host));
}

function isKey(value, length) {
  if (typeof value !== 'string' || value.length > 200) return false;
  try {
    const bytes = base64urlDecode(value);
    return bytes.length === length && (length !== 65 || isUncompressedKey(bytes));
  } catch (err) {
    return false;
  }
}

/** Una riga di testo pulita: niente caratteri di controllo, spazi compressi. */
function cleanText(value) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFC').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function randomId() {
  return base64urlEncode(crypto.getRandomValues(new Uint8Array(12)));
}

function checkLength(request, max, message) {
  if (Number(request.headers.get('Content-Length')) > max) throw new HttpError(413, message || 'Richiesta troppo grande');
}

async function readBody(request, max, message) {
  checkLength(request, max, message);
  const raw = await request.text();
  if (raw.length > max) throw new HttpError(413, message || 'Richiesta troppo grande');
  return raw;
}

async function readJson(request, max) {
  const raw = await readBody(request, max);
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new HttpError(400, 'Dati non validi');
  }
}

const COMMON_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...COMMON_HEADERS, 'Content-Type': 'application/json; charset=utf-8' } });
}

function plain(text, status = 200) {
  return new Response(text, { status, headers: { ...COMMON_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' } });
}
