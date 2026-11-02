/*
 * Test dell'API e del Cron, con l'SQL vero (SQLite in memoria) e un servizio push finto.
 * Adesso fisso: giovedì 29/10/2026 alle 9:00 in Italia.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { LIMITS, handle, runCron } from '../src/index.js';
import { reminderBody } from '../src/text.js';
import { createD1 } from './helpers/d1.mjs';
import { createSubscription, createVapidKeys, decryptPayload } from './helpers/push.mjs';

const SCHEMA = fileURLToPath(new URL('../schema.sql', import.meta.url));
const MINUTE = 60 * 1000;
const NOW = Date.UTC(2026, 9, 29, 8, 0);
const APP = 'https://mirionick.github.io';
const CODE_A = 'codiceDiProvaA_0123456789abcdefXYZ';
const CODE_B = 'codiceDiProvaB_0123456789abcdefXYZ';
const APPLE = 'https://web.push.apple.com/QGuQyavXutnMHp-prova';
const GOOGLE = 'https://fcm.googleapis.com/fcm/send/prova';

const vapidKeys = await createVapidKeys();

/** Server nuovo, con database vuoto, orologio fermo e servizio push finto che registra gli invii. */
function setup() {
  const pushes = [];
  let answer = () => 201;
  const env = {
    DB: createD1(SCHEMA),
    ALLOWED_ORIGINS: APP,
    VAPID_SUBJECT: 'https://example.test/app/',
    VAPID_PUBLIC_KEY: vapidKeys.publicKey,
    VAPID_PRIVATE_KEY: vapidKeys.privateKey
  };
  const deps = {
    now: NOW,
    fetch: async (url, init) => {
      pushes.push({ url, init });
      const status = answer(url);
      if (status === 'rete') throw new TypeError('fetch failed');
      return new Response(status === 201 ? '' : '{"reason":"Prova"}', { status });
    }
  };
  async function call(method, path, { code, body, type, origin, headers } = {}) {
    const h = new Headers(headers);
    if (code) h.set('Authorization', 'Bearer ' + code);
    if (origin) h.set('Origin', origin);
    let payload = body;
    if (body !== undefined && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof URLSearchParams)) {
      payload = JSON.stringify(body);
      h.set('Content-Type', 'application/json');
    }
    if (type) h.set('Content-Type', type);
    const response = await handle(new Request('https://aura.test' + path, { method, headers: h, body: payload }), env, deps);
    const text = await response.text();
    let data = null;
    try { data = JSON.parse(text); } catch (err) { data = null; }
    return { status: response.status, headers: response.headers, text, data };
  }
  return {
    env, deps, pushes, call,
    answer: fn => { answer = fn; },
    tick: () => runCron(env, deps),
    rows: (sql, ...params) => env.DB.query(sql, ...params)
  };
}

/** Dispositivo registrato, con sottoscrizione e (facoltativi) promemoria. */
async function device(s, code, { endpoint = APPLE, reminders } = {}) {
  assert.equal((await s.call('POST', '/api/devices', { code })).status, 201);
  const subscription = await createSubscription(endpoint);
  assert.equal((await s.call('PUT', '/api/push/subscription', { code, body: { endpoint, keys: subscription.keys } })).status, 200);
  if (reminders) assert.equal((await s.call('PUT', '/api/reminders', { code, body: { reminders } })).status, 200);
  return subscription;
}

/** Promemoria per un'attività tra `minutesFromNow` minuti (da `base`); l'ora è quella italiana (UTC+1 dopo il cambio dell'ora). */
function reminder(id, minutesFromNow, { lead = 10, title = 'Dentista', base = NOW } = {}) {
  const at = base + minutesFromNow * MINUTE;
  const local = new Date(at + 60 * MINUTE); // ora italiana (UTC+1) letta in UTC
  const time = String(local.getUTCHours()).padStart(2, '0') + ':' + String(local.getUTCMinutes()).padStart(2, '0');
  return { id, at, fireAt: at - lead * MINUTE, title, time };
}

/* ---------- Base, CORS, indirizzi ---------- */

test('salute e chiave pubblica; senza chiavi nei secrets: 503', async () => {
  const s = setup();
  assert.deepEqual((await s.call('GET', '/api/health')).data, { ok: true });
  assert.deepEqual((await s.call('GET', '/api/push/key')).data, { publicKey: vapidKeys.publicKey });
  delete s.env.VAPID_PRIVATE_KEY;
  const missing = await s.call('GET', '/api/push/key');
  assert.equal(missing.status, 503);
  assert.match(missing.data.error, /chiavi/);
});

test('CORS: l\'app è ammessa, gli altri siti no, Siri e curl (senza Origin) sì', async () => {
  const s = setup();
  const preflight = await s.call('OPTIONS', '/api/inbox', { origin: APP });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), APP);
  assert.match(preflight.headers.get('Access-Control-Allow-Headers'), /Authorization/);
  const fromApp = await s.call('GET', '/api/health', { origin: APP });
  assert.equal(fromApp.headers.get('Access-Control-Allow-Origin'), APP);
  assert.match(fromApp.headers.get('Vary'), /Origin/);
  assert.equal((await s.call('GET', '/api/health', { origin: 'https://sito-qualsiasi.example' })).status, 403);
  assert.equal((await s.call('GET', '/api/health', { origin: 'null' })).status, 403);
  const noOrigin = await s.call('GET', '/api/health');
  assert.equal(noOrigin.status, 200);
  assert.equal(noOrigin.headers.get('Access-Control-Allow-Origin'), null);
});

test('indirizzo sconosciuto 404, metodo sbagliato 405, risposte mai in cache', async () => {
  const s = setup();
  assert.equal((await s.call('GET', '/api/niente')).status, 404);
  assert.equal((await s.call('DELETE', '/api/health')).status, 405);
  assert.equal((await s.call('GET', '/api/health')).headers.get('Cache-Control'), 'no-store');
});

/* ---------- Dispositivi e codice ---------- */

test('senza codice, con un codice malformato o sconosciuto: 401', async () => {
  const s = setup();
  assert.equal((await s.call('POST', '/api/devices')).status, 401);
  assert.equal((await s.call('POST', '/api/devices', { code: 'corto' })).status, 401);
  assert.equal((await s.call('GET', '/api/inbox', { code: CODE_A })).status, 401, 'codice mai registrato');
  assert.equal((await s.call('PUT', '/api/reminders', { code: CODE_A, body: { reminders: [] } })).status, 401);
  assert.equal((await s.call('GET', '/api/inbox', { headers: { Authorization: 'Basic ' + CODE_A } })).status, 401);
});

test('registrazione: 201 la prima volta, 200 dopo; il server salva solo l\'impronta del codice', async () => {
  const s = setup();
  assert.deepEqual((await s.call('POST', '/api/devices', { code: CODE_A })).data, { ok: true, created: true });
  const again = await s.call('POST', '/api/devices', { code: CODE_A });
  assert.equal(again.status, 200);
  assert.equal(again.data.created, false);
  const ids = s.rows('SELECT id FROM devices').map(row => row.id);
  assert.deepEqual(ids, [createHash('sha256').update(CODE_A).digest('hex')]);
  assert.ok(!JSON.stringify(s.rows('SELECT * FROM devices')).includes(CODE_A), 'il codice non è nel database');
});

test('numero massimo di dispositivi: 503', async () => {
  const s = setup();
  s.env.MAX_DEVICES = '1';
  assert.equal((await s.call('POST', '/api/devices', { code: CODE_A })).status, 201);
  assert.equal((await s.call('POST', '/api/devices', { code: CODE_B })).status, 503);
  assert.equal((await s.call('POST', '/api/devices', { code: CODE_A })).status, 200, 'chi c\'è già resta');
});

test('"Scollega": il dispositivo sparisce con casella, sottoscrizione e promemoria', async () => {
  const s = setup();
  await device(s, CODE_A, { reminders: [reminder('t1', 60)] });
  await device(s, CODE_B, { reminders: [reminder('t2', 60)] });
  await s.call('POST', '/api/inbox', { code: CODE_A, body: 'dentista domani', type: 'text/plain' });
  assert.equal((await s.call('DELETE', '/api/devices', { code: CODE_A })).status, 200);
  assert.equal((await s.call('POST', '/api/inbox', { code: CODE_A, body: 'ancora', type: 'text/plain' })).status, 401);
  assert.equal(s.rows('SELECT * FROM devices').length, 1);
  assert.equal(s.rows('SELECT * FROM inbox').length, 0);
  assert.deepEqual(s.rows('SELECT task_id FROM reminders').map(row => row.task_id), ['t2'], 'l\'altro dispositivo non è toccato');
  assert.equal(s.rows('SELECT * FROM subscriptions').length, 1);
});

/* ---------- Casella del Comando Rapido ---------- */

test('Siri scrive una frase come JSON, modulo o testo: risposta in testo semplice', async () => {
  const s = setup();
  await s.call('POST', '/api/devices', { code: CODE_A });
  const asJson = await s.call('POST', '/api/inbox', { code: CODE_A, body: { text: 'domani alle 10 dentista' } });
  assert.equal(asJson.status, 201);
  assert.equal(asJson.text, 'Aggiunto ad Aura: domani alle 10 dentista');
  assert.match(asJson.headers.get('Content-Type'), /^text\/plain/);
  const asForm = await s.call('POST', '/api/inbox', { code: CODE_A, body: new URLSearchParams({ text: 'chiamare Marco' }) });
  assert.equal(asForm.status, 201);
  const form = new FormData();
  form.append('text', 'pagare la bolletta');
  assert.equal((await s.call('POST', '/api/inbox', { code: CODE_A, body: form })).status, 201);
  assert.equal((await s.call('POST', '/api/inbox', { code: CODE_A, body: 'comprare il pane', type: 'text/plain' })).status, 201);
  assert.equal((await s.call('POST', '/api/inbox', { code: CODE_A, body: { testo: 'campo con un altro nome' } })).status, 201);
  const items = (await s.call('GET', '/api/inbox', { code: CODE_A })).data.items;
  assert.deepEqual(items.map(item => item.text), ['domani alle 10 dentista', 'chiamare Marco', 'pagare la bolletta', 'comprare il pane', 'campo con un altro nome']);
  assert.ok(items.every(item => /^[\w-]{16}$/.test(item.id) && item.createdAt === NOW));
});

test('Siri: senza codice valido, frase vuota, troppo lunga o JSON rotto → errore leggibile', async () => {
  const s = setup();
  const noCode = await s.call('POST', '/api/inbox', { body: { text: 'ciao' } });
  assert.equal(noCode.status, 401);
  assert.match(noCode.text, /^Codice mancante o non valido/);
  assert.equal((await s.call('POST', '/api/inbox', { code: CODE_A, body: { text: 'ciao' } })).status, 401, 'codice non registrato');
  await s.call('POST', '/api/devices', { code: CODE_A });
  assert.equal((await s.call('POST', '/api/inbox', { code: CODE_A, body: { text: '   ' } })).text, 'Non ho ricevuto nessuna frase.');
  assert.equal((await s.call('POST', '/api/inbox', { code: CODE_A, body: { text: 'x'.repeat(501) } })).status, 400);
  assert.equal((await s.call('POST', '/api/inbox', { code: CODE_A, body: { text: 'x'.repeat(500) } })).status, 201);
  assert.equal((await s.call('POST', '/api/inbox', { code: CODE_A, body: '{rotto', type: 'application/json' })).status, 400);
  assert.equal((await s.call('POST', '/api/inbox', { code: CODE_A, body: 'y'.repeat(LIMITS.smallBody + 1), type: 'text/plain' })).status, 413);
});

test('Siri: spazi e a capo compressi, caratteri di controllo tolti, accenti conservati', async () => {
  const s = setup();
  await s.call('POST', '/api/devices', { code: CODE_A });
  await s.call('POST', '/api/inbox', { code: CODE_A, body: { text: '  venerdì\n alle 3\t\u0007 parrucchiere  ' } });
  assert.equal((await s.call('GET', '/api/inbox', { code: CODE_A })).data.items[0].text, 'venerdì alle 3 parrucchiere');
});

test('casella piena dopo 30 frasi: 429', async () => {
  const s = setup();
  await s.call('POST', '/api/devices', { code: CODE_A });
  for (let i = 0; i < LIMITS.inboxItems; i++) {
    assert.equal((await s.call('POST', '/api/inbox', { code: CODE_A, body: { text: 'frase ' + i } })).status, 201);
  }
  const full = await s.call('POST', '/api/inbox', { code: CODE_A, body: { text: 'una di troppo' } });
  assert.equal(full.status, 429);
  assert.match(full.text, /piena/);
});

test('ritiro e conferma: ogni dispositivo vede e cancella solo le sue frasi', async () => {
  const s = setup();
  await s.call('POST', '/api/devices', { code: CODE_A });
  await s.call('POST', '/api/devices', { code: CODE_B });
  await s.call('POST', '/api/inbox', { code: CODE_A, body: { text: 'di A' } });
  s.deps.now = NOW + 1000;
  await s.call('POST', '/api/inbox', { code: CODE_A, body: { text: 'ancora di A' } });
  await s.call('POST', '/api/inbox', { code: CODE_B, body: { text: 'di B' } });
  const itemsA = (await s.call('GET', '/api/inbox', { code: CODE_A })).data.items;
  const itemsB = (await s.call('GET', '/api/inbox', { code: CODE_B })).data.items;
  assert.deepEqual(itemsA.map(item => item.text), ['di A', 'ancora di A']);
  assert.deepEqual(itemsB.map(item => item.text), ['di B']);
  // B prova a cancellare le frasi di A: non succede nulla.
  assert.equal((await s.call('POST', '/api/inbox/ack', { code: CODE_B, body: { ids: itemsA.map(item => item.id) } })).data.deleted, 0);
  const ack = await s.call('POST', '/api/inbox/ack', { code: CODE_A, body: { ids: [itemsA[0].id, 'id-inesistente'] } });
  assert.deepEqual(ack.data, { ok: true, deleted: 1 });
  assert.deepEqual((await s.call('GET', '/api/inbox', { code: CODE_A })).data.items.map(item => item.text), ['ancora di A']);
  assert.equal((await s.call('POST', '/api/inbox/ack', { code: CODE_A, body: { ids: 'no' } })).status, 400);
});

/* ---------- Sottoscrizione e promemoria ---------- */

test('sottoscrizione: solo https verso servizi push noti, con chiavi valide', async () => {
  const s = setup();
  await s.call('POST', '/api/devices', { code: CODE_A });
  const { keys } = await createSubscription(APPLE);
  const put = endpoint => s.call('PUT', '/api/push/subscription', { code: CODE_A, body: { endpoint, keys } });
  assert.equal((await put('http://web.push.apple.com/abc')).status, 400, 'http');
  assert.equal((await put('https://sito-qualsiasi.example/push')).status, 400, 'host sconosciuto');
  assert.equal((await put('https://push.apple.com.example/push')).status, 400, 'finto sottodominio');
  assert.equal((await put('http://localhost:9999/push')).status, 400, 'localhost solo nelle prove');
  assert.equal((await put(GOOGLE)).status, 200);
  assert.equal((await put('https://updates.push.services.mozilla.com/wpush/v2/abc')).status, 200);
  assert.equal((await put('https://wns2-db5p.notify.windows.com/w/?token=abc')).status, 200);
  assert.equal((await put(APPLE)).status, 200);
  assert.deepEqual(s.rows('SELECT endpoint FROM subscriptions').map(row => row.endpoint), [APPLE], 'una sola, l\'ultima');
  const badKeys = await s.call('PUT', '/api/push/subscription', { code: CODE_A, body: { endpoint: APPLE, keys: { p256dh: keys.p256dh.slice(0, 40), auth: keys.auth } } });
  assert.equal(badKeys.status, 400);
  assert.equal((await s.call('PUT', '/api/push/subscription', { code: CODE_A, body: { endpoint: APPLE, keys: { p256dh: keys.p256dh, auth: 'AAAA' } } })).status, 400);
  s.env.PUSH_TEST_ORIGIN = 'http://localhost:9999';
  assert.equal((await put('http://localhost:9999/push')).status, 200, 'con la variabile di prova');
});

test('promemoria: l\'elenco sostituisce il precedente, con controlli sui dati', async () => {
  const s = setup();
  await s.call('POST', '/api/devices', { code: CODE_A });
  const put = reminders => s.call('PUT', '/api/reminders', { code: CODE_A, body: { reminders } });
  assert.deepEqual((await put([reminder('t1', 60), reminder('t2', 120), reminder('t1', 90)])).data, { ok: true, count: 2 });
  assert.deepEqual((await put([reminder('t3', 30)])).data.count, 1);
  assert.deepEqual(s.rows('SELECT task_id, title, time, attempts FROM reminders'), [{ task_id: 't3', title: 'Dentista', time: '09:30', attempts: 0 }]);
  const valid = reminder('t4', 60);
  assert.equal((await put([{ ...valid, time: '25:00' }])).status, 400);
  assert.equal((await put([{ ...valid, fireAt: valid.at + 1 }])).status, 400, 'avviso dopo l\'attività');
  assert.equal((await put([{ ...valid, id: 'con spazi' }])).status, 400);
  assert.equal((await put([{ ...valid, title: '  ' }])).status, 400);
  assert.equal((await put([{ ...valid, at: String(valid.at) }])).status, 400);
  assert.equal((await put(Array.from({ length: LIMITS.reminders + 1 }, (_, i) => reminder('t' + i, 60)))).status, 400);
  assert.equal((await put([{ ...valid, title: 'x'.repeat(300) }])).status, 200);
  assert.equal(s.rows('SELECT title FROM reminders')[0].title.length, LIMITS.titleLength, 'titolo accorciato');
  assert.deepEqual((await put([])).data.count, 0);
  assert.equal(s.rows('SELECT * FROM reminders').length, 0);
});

test('promemoria spenti: via la sottoscrizione e i promemoria', async () => {
  const s = setup();
  await device(s, CODE_A, { reminders: [reminder('t1', 60)] });
  assert.equal((await s.call('DELETE', '/api/push/subscription', { code: CODE_A })).status, 200);
  assert.equal(s.rows('SELECT * FROM subscriptions').length, 0);
  assert.equal(s.rows('SELECT * FROM reminders').length, 0);
});

/* ---------- Cron ---------- */

const unsent = s => s.rows('SELECT task_id FROM reminders WHERE sent_at IS NULL ORDER BY task_id').map(row => row.task_id);

test('Cron: invia solo i promemoria arrivati all\'ora, cifrati, e li segna come inviati', async () => {
  const s = setup();
  const subscription = await device(s, CODE_A, { reminders: [reminder('t1', 10), reminder('t2', 11), reminder('t3', 60)] });
  await s.tick();
  assert.equal(s.pushes.length, 1, 'solo t1 (avviso alle 9:00)');
  const { url, init } = s.pushes[0];
  assert.equal(url, APPLE);
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['Content-Encoding'], 'aes128gcm');
  assert.equal(init.headers.Urgency, 'high');
  assert.ok(Number(init.headers.TTL) >= 60 && Number(init.headers.TTL) <= 3600);
  assert.match(init.headers.Authorization, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
  assert.ok(init.headers.Authorization.endsWith('k=' + vapidKeys.publicKey));
  const message = JSON.parse(await decryptPayload(init.body, subscription));
  assert.deepEqual(message, { title: 'Dentista', body: 'Tra 10 minuti, alle 09:10', tag: 'aura-t1', url: './?task=t1' });
  assert.deepEqual(unsent(s), ['t2', 't3']);
  assert.deepEqual(s.rows("SELECT sent_at FROM reminders WHERE task_id = 't1'"), [{ sent_at: NOW }]);

  s.deps.now = NOW + MINUTE;
  await s.tick();
  assert.equal(s.pushes.length, 2);
  assert.equal(JSON.parse(await decryptPayload(s.pushes[1].init.body, subscription)).body, 'Tra 10 minuti, alle 09:11');
});

test('Cron: dentro l\'anticipo (avviso già passato) si avvisa subito; troppo tardi si scarta', async () => {
  const s = setup();
  // Attività alle 9:05 con 10 minuti di anticipo, sincronizzata alle 9:00: avviso subito.
  // Attività alle 8:40: passati più di 15 minuti dall'ora, non si avvisa più.
  const subscription = await device(s, CODE_A, { reminders: [reminder('subito', 5), reminder('tardi', -20)] });
  await s.tick();
  assert.equal(s.pushes.length, 1);
  assert.equal(JSON.parse(await decryptPayload(s.pushes[0].init.body, subscription)).body, 'Tra 5 minuti, alle 09:05');
  assert.deepEqual(s.rows('SELECT task_id, sent_at FROM reminders'), [{ task_id: 'subito', sent_at: NOW }], '"tardi" cancellato');
});

test('elenco rimandato: un promemoria già inviato non riparte; con un altro anticipo sì; tolto dall\'elenco sparisce', async () => {
  const s = setup();
  await device(s, CODE_A, { reminders: [reminder('t1', 5), reminder('t2', 60)] });
  await s.tick();
  assert.equal(s.pushes.length, 1);
  const put = reminders => s.call('PUT', '/api/reminders', { code: CODE_A, body: { reminders } });
  // L'app rimanda lo stesso elenco (per esempio dopo aver aggiunto un'altra attività): t1 non riparte.
  assert.equal((await put([reminder('t1', 5), reminder('t2', 60), reminder('t3', 120)])).status, 200);
  s.deps.now = NOW + MINUTE;
  await s.tick();
  assert.equal(s.pushes.length, 1, 'nessun doppione');
  // Anticipo cambiato (5 minuti): è un promemoria nuovo, e parte di nuovo.
  await put([reminder('t1', 5, { lead: 5 }), reminder('t2', 60), reminder('t3', 120)]);
  await s.tick();
  assert.equal(s.pushes.length, 2);
  // Attività completata: non è più nell'elenco e il server la dimentica.
  await put([reminder('t3', 120)]);
  assert.deepEqual(s.rows('SELECT task_id FROM reminders').map(row => row.task_id), ['t3']);
});

test('Cron: sottoscrizione scaduta (410) → via sottoscrizione e promemoria di quel dispositivo', async () => {
  const s = setup();
  await device(s, CODE_A, { reminders: [reminder('a1', 10), reminder('a2', 90)] });
  await device(s, CODE_B, { endpoint: GOOGLE, reminders: [reminder('b1', 10)] });
  s.answer(url => (url === APPLE ? 410 : 201));
  await s.tick();
  assert.equal(s.pushes.length, 2);
  assert.deepEqual(s.rows('SELECT endpoint FROM subscriptions').map(row => row.endpoint), [GOOGLE]);
  assert.deepEqual(s.rows('SELECT task_id, sent_at FROM reminders'), [{ task_id: 'b1', sent_at: NOW }], 'a1 e a2 dimenticati, b1 inviato');
});

test('Cron: errore del servizio o della rete → nuovo tentativo, al massimo 5', async () => {
  const s = setup();
  await device(s, CODE_A, { reminders: [reminder('t1', 10)] });
  s.answer(() => 500);
  for (let i = 1; i <= 4; i++) {
    await s.tick();
    assert.deepEqual(s.rows('SELECT attempts FROM reminders'), [{ attempts: i }]);
  }
  s.answer(() => 'rete');
  await s.tick();
  assert.equal(s.pushes.length, 5);
  assert.deepEqual(s.rows('SELECT attempts, sent_at FROM reminders'), [{ attempts: 4, sent_at: NOW }], 'dopo 5 tentativi si rinuncia');
  await s.tick();
  assert.equal(s.pushes.length, 5);
});

test('Cron: al massimo 10 invii per giro, una firma per servizio', async () => {
  const s = setup();
  const list = Array.from({ length: 12 }, (_, i) => reminder('t' + i, 5 + i % 3));
  await device(s, CODE_A, { reminders: list });
  await s.tick();
  assert.equal(s.pushes.length, LIMITS.cronBatch);
  assert.equal(unsent(s).length, 2);
  assert.equal(new Set(s.pushes.map(push => push.init.headers.Authorization)).size, 1);
  await s.tick();
  assert.equal(s.pushes.length, 12);
});

test('Cron: senza chiavi VAPID non invia nulla e non perde i promemoria', async () => {
  const s = setup();
  await device(s, CODE_A, { reminders: [reminder('t1', 5)] });
  delete s.env.VAPID_PUBLIC_KEY;
  await s.tick();
  assert.equal(s.pushes.length, 0);
  assert.equal(s.rows('SELECT * FROM reminders').length, 1);
});

test('Cron: pulizia oraria di frasi vecchie, promemoria passati e dispositivi spariti', async () => {
  const s = setup();
  const DAY = 24 * 60 * MINUTE;
  s.deps.now = NOW - 200 * DAY;
  await device(s, CODE_B, { reminders: [reminder('di-B', 230 * 24 * 60, { base: NOW - 200 * DAY })] });
  await s.call('POST', '/api/inbox', { code: CODE_B, body: { text: 'vecchia' } });
  s.deps.now = NOW - 40 * DAY;
  await s.call('POST', '/api/devices', { code: CODE_A });
  await s.call('POST', '/api/inbox', { code: CODE_A, body: { text: 'di 40 giorni fa' } });
  s.deps.now = NOW - 2 * MINUTE;
  await s.call('POST', '/api/inbox', { code: CODE_A, body: { text: 'recente' } });
  await device(s, 'codiceDiProvaC_0123456789abcdefXYZ', { reminders: [reminder('passato', -20), reminder('futuro', 120)] });
  s.deps.now = NOW; // 8:00 UTC: minuto 0, c'è la pulizia
  await s.tick();
  assert.equal(s.rows('SELECT * FROM devices').length, 2, 'B non si vede da 200 giorni');
  assert.deepEqual(s.rows('SELECT text FROM inbox').map(row => row.text), ['recente']);
  assert.deepEqual(s.rows('SELECT task_id FROM reminders').map(row => row.task_id), ['futuro']);
});

test('"Prova una notifica": invio immediato; senza sottoscrizione 409; scaduta 410; rifiutata 502', async () => {
  const s = setup();
  await s.call('POST', '/api/devices', { code: CODE_A });
  assert.equal((await s.call('POST', '/api/push/test', { code: CODE_A })).status, 409);
  const subscription = await device(s, CODE_B);
  const ok = await s.call('POST', '/api/push/test', { code: CODE_B });
  assert.deepEqual(ok.data, { ok: true, status: 201 });
  assert.deepEqual(JSON.parse(await decryptPayload(s.pushes[0].init.body, subscription)), { title: 'Aura', body: 'Le notifiche funzionano ✓', tag: 'aura-test', url: './' });
  s.answer(() => 403);
  const refused = await s.call('POST', '/api/push/test', { code: CODE_B });
  assert.equal(refused.status, 502);
  assert.deepEqual([refused.data.status, refused.data.reason], [403, '{"reason":"Prova"}']);
  s.answer(() => 410);
  assert.equal((await s.call('POST', '/api/push/test', { code: CODE_B })).status, 410);
  assert.equal(s.rows('SELECT * FROM subscriptions').length, 0);
});

test('il dispositivo risulta "visto" al massimo una volta al giorno', async () => {
  const s = setup();
  await s.call('POST', '/api/devices', { code: CODE_A });
  s.deps.now = NOW + 60 * MINUTE;
  await s.call('GET', '/api/inbox', { code: CODE_A });
  assert.equal(s.rows('SELECT seen_at FROM devices')[0].seen_at, NOW);
  s.deps.now = NOW + 25 * 60 * MINUTE;
  await s.call('GET', '/api/inbox', { code: CODE_A });
  assert.equal(s.rows('SELECT seen_at FROM devices')[0].seen_at, NOW + 25 * 60 * MINUTE);
});

test('testi delle notifiche in italiano', () => {
  const at = NOW + 30 * MINUTE;
  assert.equal(reminderBody('10:00', at, at - 10 * MINUTE), 'Tra 10 minuti, alle 10:00');
  assert.equal(reminderBody('10:00', at, at - 60 * 1000), 'Tra un minuto, alle 10:00');
  assert.equal(reminderBody('10:00', at, at - 60 * MINUTE), "Tra un'ora, alle 10:00");
  assert.equal(reminderBody('10:00', at, at), 'Adesso, alle 10:00');
  assert.equal(reminderBody('10:00', at, at + 5 * MINUTE), 'Adesso, alle 10:00');
  assert.equal(reminderBody('10:00', at, at - 90 * MINUTE), 'Alle 10:00');
});
