/*
 * Test del connettore per Claude (P-006): accesso OAuth con il codice dell'app, registrazione automatica,
 * connettore MCP nelle due epoche del protocollo, strumento «Aggiungi ad Aura», limiti e pulizie.
 * SQL vero (SQLite in memoria), orologio fermo, nessuna chiamata esterna.
 */
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { LIMITS, handle, runCron } from '../src/index.js';
import { MCP_LIMITS, TOOL, headerValue } from '../src/mcp.js';
import { CLAUDE, OAUTH_LIMITS, PAIR_ALPHABET, escapeHtml, newPairCode, normalizePairCode } from '../src/oauth.js';
import { CLAUDE_PAGE, MCP_TEXTS } from '../src/text.js';
import { createD1 } from './helpers/d1.mjs';

const SCHEMA = fileURLToPath(new URL('../schema.sql', import.meta.url));
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const NOW = Date.UTC(2026, 10, 23, 14, 30);
const BASE = 'https://aura.test';
const APP = 'https://mirionick.github.io';
const CODE_A = 'codiceDiProvaA_0123456789abcdefXYZ';
const CODE_B = 'codiceDiProvaB_0123456789abcdefXYZ';
const REDIRECT = CLAUDE.redirectUris[0];
const MODERN = '2026-07-28';

const b64url = buffer => Buffer.from(buffer).toString('base64url');

function setup({ strict } = {}) {
  const env = { DB: createD1(SCHEMA), ALLOWED_ORIGINS: APP };
  if (strict) env.RATE_LIMIT_STRICT = strict;
  const deps = { now: NOW, fetch: async () => { throw new Error('nessuna chiamata esterna nei test'); } };
  async function call(method, path, { code, bearer, body, type, origin, headers } = {}) {
    const h = new Headers(headers);
    if (code) h.set('Authorization', 'Bearer ' + code);
    if (bearer) h.set('Authorization', 'Bearer ' + bearer);
    if (origin) h.set('Origin', origin);
    let payload = body;
    if (body instanceof URLSearchParams) {
      payload = body.toString();
      h.set('Content-Type', 'application/x-www-form-urlencoded');
    } else if (body !== undefined && typeof body === 'object') {
      payload = JSON.stringify(body);
      h.set('Content-Type', 'application/json');
    }
    if (type) h.set('Content-Type', type);
    const response = await handle(new Request(BASE + path, { method, headers: h, body: payload }), env, deps);
    const text = await response.text();
    let data = null;
    try { data = JSON.parse(text); } catch (err) { data = null; }
    return { status: response.status, headers: response.headers, text, data };
  }
  return { env, deps, call, rows: (sql, ...params) => env.DB.query(sql, ...params) };
}

function pkce() {
  const verifier = b64url(randomBytes(48));
  return { verifier, challenge: b64url(createHash('sha256').update(verifier).digest()) };
}

function authorizeParams(challenge, extra = {}) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLAUDE.clientId,
    redirect_uri: REDIRECT,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: 'stato-di-prova',
    scope: OAUTH_LIMITS.scope,
    resource: BASE + '/mcp'
  });
  for (const [key, value] of Object.entries(extra)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  return params;
}

async function registerDevice(s, code = CODE_A) {
  const result = await s.call('POST', '/api/devices', { code });
  assert.ok(result.status === 201 || result.status === 200);
}

async function pairCode(s, code = CODE_A) {
  const result = await s.call('POST', '/api/claude/code', { code, origin: APP });
  assert.equal(result.status, 201);
  return result.data.code;
}

/** Pagina con il codice → codice d'autorizzazione (dal Location del 303). */
async function authorize(s, challenge, pair, extra = {}) {
  const form = authorizeParams(challenge, extra);
  form.set('codice', pair);
  const result = await s.call('POST', '/oauth/authorize', { body: form, origin: BASE });
  return result;
}

async function exchange(s, code, verifier, extra = {}) {
  const form = new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, client_id: CLAUDE.clientId, redirect_uri: REDIRECT, resource: BASE + '/mcp' });
  for (const [key, value] of Object.entries(extra)) {
    if (value === null) form.delete(key);
    else form.set(key, value);
  }
  return s.call('POST', '/oauth/token', { body: form });
}

/** Collegamento completo: dispositivo, codice, pagina, token. */
async function connect(s, deviceCode = CODE_A, { clientId = CLAUDE.clientId } = {}) {
  await registerDevice(s, deviceCode);
  const pair = await pairCode(s, deviceCode);
  const { verifier, challenge } = pkce();
  const page = await authorize(s, challenge, pair, { client_id: clientId });
  assert.equal(page.status, 303, page.text);
  const location = new URL(page.headers.get('Location'));
  const result = await exchange(s, location.searchParams.get('code'), verifier, { client_id: clientId });
  assert.equal(result.status, 200, result.text);
  return result.data;
}

function legacyCall(s, bearer, method, params, { id = 1, version = '2025-11-25', headers = {} } = {}) {
  const body = { jsonrpc: '2.0', method, params };
  if (id !== null) body.id = id;
  return s.call('POST', '/mcp', { bearer, body, headers: { Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': version, ...headers } });
}

function modernCall(s, bearer, method, params = {}, { headers = {}, meta } = {}) {
  const body = {
    jsonrpc: '2.0', id: 7, method,
    params: { ...params, _meta: meta || { 'io.modelcontextprotocol/protocolVersion': MODERN, 'io.modelcontextprotocol/clientCapabilities': {}, 'io.modelcontextprotocol/clientInfo': { name: 'prova', version: '1' } } }
  };
  const h = { Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': MODERN, 'Mcp-Method': method };
  if (method === 'tools/call') h['Mcp-Name'] = params.name;
  return s.call('POST', '/mcp', { bearer, body, headers: { ...h, ...headers } });
}

const addCall = (s, bearer, attivita) => legacyCall(s, bearer, 'tools/call', { name: TOOL.name, arguments: { attivita } });

/* ---------- Metadati ---------- */

test('metadati: la risorsa protetta, ai due indirizzi, e il server di accesso', async () => {
  const s = setup();
  for (const path of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp']) {
    const result = await s.call('GET', path);
    assert.equal(result.status, 200);
    assert.equal(result.data.resource, BASE + '/mcp');
    assert.deepEqual(result.data.authorization_servers, [BASE]);
    assert.deepEqual(result.data.scopes_supported, ['aggiungi']);
  }
  const as = await s.call('GET', '/.well-known/oauth-authorization-server');
  assert.equal(as.status, 200);
  assert.equal(as.data.issuer, BASE);
  assert.equal(as.data.authorization_endpoint, BASE + '/oauth/authorize');
  assert.equal(as.data.token_endpoint, BASE + '/oauth/token');
  assert.equal(as.data.registration_endpoint, BASE + '/oauth/register');
  assert.deepEqual(as.data.code_challenge_methods_supported, ['S256']);
  // Con queste due voci Claude usa la sua identità pubblicata invece della registrazione automatica.
  assert.equal(as.data.client_id_metadata_document_supported, true);
  assert.deepEqual(as.data.token_endpoint_auth_methods_supported, ['none']);
  assert.equal(as.data.authorization_response_iss_parameter_supported, true);
  // Anche con un'Origin qualsiasi: i metadati sono pubblici.
  assert.equal((await s.call('GET', '/.well-known/oauth-authorization-server', { origin: 'https://altro.example' })).status, 200);
  assert.equal((await s.call('GET', '/.well-known/qualcosa')).status, 404);
});

/* ---------- Codice per collegare ---------- */

test('codice per collegare: 8 segni dell\'alfabeto, scritto in qualsiasi modo; solo impronte nel database', async () => {
  for (let i = 0; i < 500; i++) {
    const code = newPairCode();
    assert.match(code, /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
  }
  assert.equal(PAIR_ALPHABET.length, 31);
  assert.equal(normalizePairCode('k7pm-4qrt'), 'K7PM4QRT');
  assert.equal(normalizePairCode(' K7PM 4QRT '), 'K7PM4QRT');
  assert.equal(normalizePairCode('K7PM4QR'), null);
  assert.equal(normalizePairCode('K7PM4QR0'), null); // lo zero non c'è
  assert.equal(normalizePairCode(null), null);

  const s = setup();
  assert.equal((await s.call('POST', '/api/claude/code', { origin: APP })).status, 401);
  await registerDevice(s);
  const first = await s.call('POST', '/api/claude/code', { code: CODE_A, origin: APP });
  assert.equal(first.status, 201);
  assert.equal(first.data.expiresAt, NOW + 10 * MINUTE);
  const dump = JSON.stringify(s.rows('SELECT * FROM claude_codes'));
  assert.ok(!dump.includes(first.data.code), 'il codice non si salva in chiaro');
  // Un codice nuovo prende il posto di quello di prima.
  const second = await pairCode(s);
  assert.equal(s.rows("SELECT * FROM claude_codes WHERE kind = 'pair'").length, 1);
  const { challenge } = pkce();
  assert.equal((await authorize(s, challenge, first.data.code)).status, 400);
  assert.equal((await authorize(s, challenge, second)).status, 303);
});

test('stato per l\'app: collegamenti con le date e scadenza del codice; «Scollega Claude»', async () => {
  const s = setup();
  await registerDevice(s);
  let status = await s.call('GET', '/api/claude', { code: CODE_A, origin: APP });
  assert.deepEqual(status.data, { links: [], code: null });
  await pairCode(s);
  status = await s.call('GET', '/api/claude', { code: CODE_A, origin: APP });
  assert.deepEqual(status.data.code, { expiresAt: NOW + 10 * MINUTE });
  const tokens = await connect(s);
  status = await s.call('GET', '/api/claude', { code: CODE_A, origin: APP });
  assert.deepEqual(status.data, { links: [{ createdAt: NOW, usedAt: null }], code: null });
  s.deps.now = NOW + MINUTE;
  assert.equal((await addCall(s, tokens.access_token, ['Dentista il 27 novembre alle 10'])).status, 200);
  status = await s.call('GET', '/api/claude', { code: CODE_A, origin: APP });
  assert.equal(status.data.links[0].usedAt, NOW + MINUTE);
  assert.equal(status.headers.get('Access-Control-Allow-Origin'), APP);

  const unlink = await s.call('DELETE', '/api/claude', { code: CODE_A, origin: APP });
  assert.deepEqual(unlink.data, { ok: true, deleted: 1 });
  assert.equal((await addCall(s, tokens.access_token, ['Altro'])).status, 401);
  const form = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: CLAUDE.clientId });
  assert.equal((await s.call('POST', '/oauth/token', { body: form })).data.error, 'invalid_grant');
});

/* ---------- Pagina con il codice ---------- */

test('pagina: senza script, con CSP, cornici vietate, form-action solo verso sé e Claude', async () => {
  const s = setup();
  const { challenge } = pkce();
  const result = await s.call('GET', '/oauth/authorize?' + authorizeParams(challenge));
  assert.equal(result.status, 200);
  assert.match(result.headers.get('Content-Type'), /^text\/html/);
  const csp = result.headers.get('Content-Security-Policy');
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /style-src 'nonce-[A-Za-z0-9_-]{22}'/);
  assert.match(csp, /form-action 'self' https:\/\/claude\.ai;/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(result.headers.get('X-Frame-Options'), 'DENY');
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  assert.equal(result.headers.get('Referrer-Policy'), 'same-origin');
  assert.ok(!/<script/i.test(result.text));
  assert.ok(result.text.includes(escapeHtml(CLAUDE_PAGE.intro)));
  assert.ok(result.text.includes('Dopo, torni su claude.ai.')); // l'indirizzo di ritorno si vede
  assert.ok(result.text.includes('name="code_challenge" value="' + challenge + '"'));
  assert.ok(result.text.includes('name="codice"'));
});

test('pagina: i valori arrivano solo come testo (escape HTML)', async () => {
  const s = setup();
  const { challenge } = pkce();
  const evil = '"><script>alert(1)</script><x a=\'';
  const result = await s.call('GET', '/oauth/authorize?' + authorizeParams(challenge, { state: evil, scope: evil }));
  assert.equal(result.status, 200);
  assert.ok(!result.text.includes('<script>'));
  assert.ok(result.text.includes('name="state" value="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;&lt;x a=&#39;"'));
  assert.ok(!result.text.includes('name="scope"'), 'lo scope non serve e non torna nella pagina');
  assert.equal(escapeHtml('<a href="x">\'&'), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
});

test('pagina: client o indirizzo di ritorno sbagliati danno un errore e non rimandano mai altrove', async () => {
  const s = setup();
  const { challenge } = pkce();
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const cases = [
      { client_id: 'https://altro.example/cimd' },
      { client_id: null },
      { redirect_uri: 'https://altro.example/callback' },
      { redirect_uri: 'https://claude.ai/api/mcp/auth_callback/../altro' },
      { redirect_uri: null }
    ];
    for (const extra of cases) {
      const result = await s.call('GET', '/oauth/authorize?' + authorizeParams(challenge, extra));
      assert.equal(result.status, 400, JSON.stringify(extra));
      assert.equal(result.headers.get('Location'), null);
      assert.ok(result.text.includes(escapeHtml(CLAUDE_PAGE.badClient)));
    }
    // Un parametro ripetuto: errore, senza rimandare.
    const twice = authorizeParams(challenge);
    twice.append('redirect_uri', 'https://altro.example/callback');
    const result = await s.call('GET', '/oauth/authorize?' + twice);
    assert.equal(result.status, 400);
    assert.equal(result.headers.get('Location'), null);
  } finally {
    console.warn = original;
  }
  assert.ok(warnings.length >= 4);
  assert.ok(warnings.every(line => !line.includes('altro.example') && !line.includes(challenge)), 'nei log solo il motivo');
});

test('pagina: gli altri errori tornano a Claude, con state e iss', async () => {
  const s = setup();
  const { challenge } = pkce();
  const cases = [
    [{ code_challenge: null }, 'invalid_request'],
    [{ code_challenge_method: 'plain' }, 'invalid_request'],
    [{ code_challenge: 'corto' }, 'invalid_request'],
    [{ response_type: 'token' }, 'unsupported_response_type'],
    [{ resource: 'https://altro.example/mcp' }, 'invalid_target'],
    [{ state: 'x'.repeat(1025) }, 'invalid_request']
  ];
  for (const [extra, error] of cases) {
    const result = await s.call('GET', '/oauth/authorize?' + authorizeParams(challenge, extra));
    assert.equal(result.status, 303, JSON.stringify(extra));
    const location = new URL(result.headers.get('Location'));
    assert.equal(location.origin + location.pathname, REDIRECT);
    assert.equal(location.searchParams.get('error'), error);
    assert.equal(location.searchParams.get('iss'), BASE);
    assert.equal(location.searchParams.get('state'), extra.state ? null : 'stato-di-prova'); // uno state enorme non torna
  }
  // Senza resource si usa il connettore.
  assert.equal((await s.call('GET', '/oauth/authorize?' + authorizeParams(challenge, { resource: null }))).status, 200);
});

test('modulo: il codice giusto torna a Claude con il codice d\'autorizzazione; vale una volta sola', async () => {
  const s = setup();
  await registerDevice(s);
  const pair = await pairCode(s);
  const { challenge } = pkce();
  const ok = await authorize(s, challenge, pair.toLowerCase().slice(0, 4) + '-' + pair.slice(4));
  assert.equal(ok.status, 303);
  const location = new URL(ok.headers.get('Location'));
  assert.equal(location.origin + location.pathname, REDIRECT);
  assert.match(location.searchParams.get('code'), /^[A-Za-z0-9_-]{43}$/);
  assert.equal(location.searchParams.get('state'), 'stato-di-prova');
  assert.equal(location.searchParams.get('iss'), BASE);
  assert.equal(s.rows("SELECT * FROM claude_codes WHERE kind = 'pair'").length, 0);
  const again = await authorize(s, challenge, pair);
  assert.equal(again.status, 400);
  assert.ok(again.text.includes(escapeHtml(CLAUDE_PAGE.badCode)));
  assert.ok(again.text.includes('name="codice"'), 'la pagina resta, per riprovare');
});

test('modulo: codice sbagliato o scaduto, Origin di altri siti, formato sbagliato', async () => {
  const s = setup();
  await registerDevice(s);
  const pair = await pairCode(s);
  const { challenge } = pkce();
  assert.equal((await authorize(s, challenge, 'ZZZZ-ZZZZ')).status, 400);
  assert.equal((await authorize(s, challenge, 'non va')).status, 400);
  const form = authorizeParams(challenge);
  form.set('codice', pair);
  assert.equal((await s.call('POST', '/oauth/authorize', { body: form, origin: 'https://altro.example' })).status, 403);
  assert.equal((await s.call('POST', '/oauth/authorize', { body: form, origin: 'null' })).status, 403);
  assert.equal((await s.call('POST', '/oauth/authorize', { body: { codice: pair } })).status, 400);
  s.deps.now = NOW + 10 * MINUTE + 1;
  assert.equal((await authorize(s, challenge, pair)).status, 400);
});

test('modulo: oltre 10 tentativi al minuto la pagina dice di aspettare (429)', async () => {
  const keys = [];
  const s = setup({ strict: { limit: async ({ key }) => { keys.push(key); return { success: !key.startsWith('claude-pair:') }; } } });
  const { challenge } = pkce();
  const result = await authorize(s, challenge, 'K7PM4QRT');
  assert.equal(result.status, 429);
  assert.equal(result.headers.get('Retry-After'), '60');
  assert.ok(result.text.includes(escapeHtml(CLAUDE_PAGE.tooMany)));
  assert.ok(result.text.includes('name="codice"'));
  assert.ok(keys.some(key => key.startsWith('claude-pair:')));
});

/* ---------- Token ---------- */

test('token e registrazione: limite stretto per IP, ognuno con il suo contatore', async () => {
  const keys = [];
  const s = setup({ strict: { limit: async ({ key }) => { keys.push(key); return { success: false }; } } });
  const token = await s.call('POST', '/oauth/token', { body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: 'x', client_id: CLAUDE.clientId }) });
  assert.equal(token.status, 429);
  assert.equal(token.headers.get('Retry-After'), '60');
  const registration = await s.call('POST', '/oauth/register', { body: { redirect_uris: [REDIRECT] } });
  assert.equal(registration.status, 429);
  assert.deepEqual(keys.map(key => key.split(':')[0]), ['oauth-token', 'oauth-register']);
});

test('token: scambio con PKCE; nel database solo impronte', async () => {
  const s = setup();
  const tokens = await connect(s);
  assert.equal(tokens.token_type, 'Bearer');
  assert.equal(tokens.expires_in, 3600);
  assert.equal(tokens.scope, 'aggiungi');
  assert.match(tokens.access_token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(tokens.refresh_token, /^[A-Za-z0-9_-]{43}$/);
  const dump = JSON.stringify(s.rows('SELECT * FROM claude_links')) + JSON.stringify(s.rows('SELECT * FROM claude_codes'));
  assert.ok(!dump.includes(tokens.access_token) && !dump.includes(tokens.refresh_token));
  const link = s.rows('SELECT * FROM claude_links')[0];
  assert.equal(link.client_id, CLAUDE.clientId);
  assert.equal(link.resource, BASE + '/mcp');
  assert.equal(link.access_expires, NOW + 60 * MINUTE);
  assert.equal(link.refresh_expires, NOW + 180 * DAY);
});

test('token: il codice d\'autorizzazione si consuma alla prima prova, anche se sbagliata', async () => {
  const s = setup();
  await registerDevice(s);
  const { verifier, challenge } = pkce();
  const codeFor = async () => new URL((await authorize(s, challenge, await pairCode(s))).headers.get('Location')).searchParams.get('code');

  let code = await codeFor();
  assert.equal((await exchange(s, code, pkce().verifier)).data.error, 'invalid_grant'); // verificatore sbagliato
  assert.equal((await exchange(s, code, verifier)).data.error, 'invalid_grant');         // ormai consumato
  code = await codeFor();
  assert.equal((await exchange(s, code, verifier, { client_id: 'aura-' + 'x'.repeat(24) })).data.error, 'invalid_grant');
  code = await codeFor();
  assert.equal((await exchange(s, code, verifier, { redirect_uri: 'https://altro.example/cb' })).data.error, 'invalid_grant');
  code = await codeFor();
  assert.equal((await exchange(s, code, verifier, { resource: 'https://altro.example/mcp' })).data.error, 'invalid_target');
  code = await codeFor();
  s.deps.now += 61 * 1000;
  assert.equal((await exchange(s, code, verifier)).data.error, 'invalid_grant'); // scaduto dopo 60 secondi
  code = await codeFor();
  assert.equal((await exchange(s, code, verifier)).status, 200);
  assert.equal((await exchange(s, code, verifier)).data.error, 'invalid_grant'); // una volta sola
  assert.equal((await exchange(s, 'x', verifier)).data.error, 'invalid_grant');
});

test('token: formato, tipo di richiesta, dispositivo scollegato nel frattempo', async () => {
  const s = setup();
  assert.equal((await s.call('POST', '/oauth/token', { body: { grant_type: 'authorization_code' } })).data.error, 'invalid_request');
  assert.equal((await s.call('POST', '/oauth/token', { body: new URLSearchParams({ grant_type: 'password' }) })).data.error, 'unsupported_grant_type');
  await registerDevice(s);
  const { verifier, challenge } = pkce();
  const page = await authorize(s, challenge, await pairCode(s));
  assert.equal((await s.call('DELETE', '/api/devices', { code: CODE_A, origin: APP })).status, 200);
  const code = new URL(page.headers.get('Location')).searchParams.get('code');
  assert.equal((await exchange(s, code, verifier)).data.error, 'invalid_grant');
  // L'Origin di un altro sito non passa; quella di Claude sì.
  assert.equal((await s.call('POST', '/oauth/token', { body: new URLSearchParams({ grant_type: 'x' }), origin: 'https://altro.example' })).status, 403);
  assert.equal((await s.call('POST', '/oauth/token', { body: new URLSearchParams({ grant_type: 'x' }), origin: 'https://claude.ai' })).status, 400);
});

test('rinnovo: il token di rinnovo cambia ogni volta e quello vecchio non vale più', async () => {
  const s = setup();
  const first = await connect(s);
  s.deps.now = NOW + 55 * MINUTE;
  const form = refresh => new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh, client_id: CLAUDE.clientId, resource: BASE + '/mcp' });
  const second = await s.call('POST', '/oauth/token', { body: form(first.refresh_token) });
  assert.equal(second.status, 200);
  assert.notEqual(second.data.refresh_token, first.refresh_token);
  assert.notEqual(second.data.access_token, first.access_token);
  assert.equal((await s.call('POST', '/oauth/token', { body: form(first.refresh_token) })).data.error, 'invalid_grant');
  assert.equal((await addCall(s, first.access_token, ['Vecchio'])).status, 401);
  assert.equal((await addCall(s, second.data.access_token, ['Nuovo'])).status, 200);
  const link = s.rows('SELECT * FROM claude_links')[0];
  assert.equal(link.refresh_expires, NOW + 55 * MINUTE + 180 * DAY);
  // Senza client_id, o con un altro, no.
  const noClient = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: second.data.refresh_token });
  assert.equal((await s.call('POST', '/oauth/token', { body: noClient })).data.error, 'invalid_request');
  noClient.set('client_id', 'aura-' + 'y'.repeat(24));
  assert.equal((await s.call('POST', '/oauth/token', { body: noClient })).data.error, 'invalid_grant');
  // Dopo 180 giorni senza rinnovi il collegamento scade.
  s.deps.now = NOW + 55 * MINUTE + 180 * DAY + 1;
  assert.equal((await s.call('POST', '/oauth/token', { body: form(second.data.refresh_token) })).data.error, 'invalid_grant');
});

test('al massimo 3 collegamenti per dispositivo: il quarto toglie quello usato meno di recente', async () => {
  const s = setup();
  const links = [];
  for (let i = 0; i < 3; i++) {
    s.deps.now = NOW + i * MINUTE;
    links.push(await connect(s));
  }
  s.deps.now = NOW + 10 * MINUTE;
  assert.equal((await addCall(s, links[0].access_token, ['Usato di recente'])).status, 200);
  s.deps.now = NOW + 11 * MINUTE;
  links.push(await connect(s));
  assert.equal(s.rows('SELECT * FROM claude_links').length, 3);
  assert.equal((await addCall(s, links[1].access_token, ['Tolto'])).status, 401); // il meno recente
  for (const index of [0, 2, 3]) assert.equal((await addCall(s, links[index].access_token, ['Resta'])).status, 200);
});

/* ---------- Registrazione automatica ---------- */

test('registrazione automatica: solo con l\'indirizzo di ritorno di Claude, poi l\'accesso funziona', async () => {
  const s = setup();
  const ok = await s.call('POST', '/oauth/register', { body: { redirect_uris: [REDIRECT], client_name: 'Claude', grant_types: ['authorization_code', 'refresh_token'], token_endpoint_auth_method: 'none' } });
  assert.equal(ok.status, 201);
  assert.match(ok.data.client_id, /^aura-[A-Za-z0-9_-]{24}$/);
  assert.equal(ok.data.token_endpoint_auth_method, 'none');
  assert.deepEqual(ok.data.redirect_uris, [REDIRECT]);
  const tokens = await connect(s, CODE_A, { clientId: ok.data.client_id });
  assert.equal((await addCall(s, tokens.access_token, ['Da una registrazione'])).status, 200);
  const refresh = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: ok.data.client_id });
  assert.equal((await s.call('POST', '/oauth/token', { body: refresh })).status, 200);

  assert.equal((await s.call('POST', '/oauth/register', { body: { redirect_uris: ['https://altro.example/cb'] } })).data.error, 'invalid_redirect_uri');
  assert.equal((await s.call('POST', '/oauth/register', { body: { redirect_uris: [REDIRECT, 'https://altro.example/cb'] } })).data.error, 'invalid_redirect_uri');
  assert.equal((await s.call('POST', '/oauth/register', { body: { redirect_uris: [] } })).data.error, 'invalid_redirect_uri');
  assert.equal((await s.call('POST', '/oauth/register', { body: { redirect_uris: [REDIRECT], token_endpoint_auth_method: 'client_secret_basic' } })).data.error, 'invalid_client_metadata');
  assert.equal((await s.call('POST', '/oauth/register', { body: 'redirect_uris=x', type: 'application/x-www-form-urlencoded' })).data.error, 'invalid_client_metadata');
  assert.equal((await s.call('POST', '/oauth/register', { body: '{', type: 'application/json' })).data.error, 'invalid_client_metadata');
  // Un client registrato non può usare un altro indirizzo di ritorno.
  const { challenge } = pkce();
  const page = await s.call('GET', '/oauth/authorize?' + authorizeParams(challenge, { client_id: ok.data.client_id, redirect_uri: 'https://altro.example/cb' }));
  assert.equal(page.status, 400);
});

test('registrazione automatica: al massimo 50, poi esce quella usata meno di recente', async () => {
  const s = setup();
  for (let i = 0; i < OAUTH_LIMITS.clients + 2; i++) {
    s.deps.now = NOW + i;
    assert.equal((await s.call('POST', '/oauth/register', { body: { redirect_uris: [REDIRECT] } })).status, 201);
  }
  const rows = s.rows('SELECT used_at FROM oauth_clients ORDER BY used_at');
  assert.equal(rows.length, OAUTH_LIMITS.clients);
  assert.equal(rows[0].used_at, NOW + 2);
});

/* ---------- Il connettore: accesso ---------- */

test('connettore: senza token o con un token non valido 401 con l\'indirizzo dei metadati', async () => {
  const s = setup();
  const none = await legacyCall(s, null, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'x', version: '1' } });
  assert.equal(none.status, 401);
  assert.equal(none.headers.get('WWW-Authenticate'), 'Bearer resource_metadata="' + BASE + '/.well-known/oauth-protected-resource/mcp", scope="aggiungi"');
  const bad = await legacyCall(s, 'a'.repeat(43), 'tools/list', {});
  assert.equal(bad.status, 401);
  assert.match(bad.headers.get('WWW-Authenticate'), /^Bearer error="invalid_token", resource_metadata=/);
  const tokens = await connect(s);
  s.deps.now = NOW + 60 * MINUTE + 1; // token d'accesso scaduto: Claude lo rinnova
  assert.equal((await legacyCall(s, tokens.access_token, 'tools/list', {})).status, 401);
});

test('connettore: GET e DELETE 405; Origin ammessa solo quella di Claude', async () => {
  const s = setup();
  const tokens = await connect(s);
  for (const method of ['GET', 'DELETE']) {
    const result = await s.call(method, '/mcp', { bearer: tokens.access_token });
    assert.equal(result.status, 405);
    assert.equal(result.headers.get('Allow'), 'POST');
  }
  const foreign = await s.call('POST', '/mcp', { bearer: tokens.access_token, origin: 'https://altro.example', body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } });
  assert.equal(foreign.status, 403);
  const claude = await s.call('POST', '/mcp', { bearer: tokens.access_token, origin: 'https://claude.ai', body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } });
  assert.equal(claude.status, 200);
  assert.equal(claude.headers.get('Access-Control-Allow-Origin'), null); // niente CORS
  const notJson = await s.call('POST', '/mcp', { bearer: tokens.access_token, body: '{', type: 'application/json' });
  assert.equal(notJson.data.error.code, -32700);
  const batch = await s.call('POST', '/mcp', { bearer: tokens.access_token, body: [{ jsonrpc: '2.0', id: 1, method: 'ping' }] });
  assert.equal(batch.data.error.code, -32600);
});

/* ---------- Il connettore: 2025-11-25 e precedenti ---------- */

test('vecchia epoca: initialize, notifica, ping, elenco degli strumenti', async () => {
  const s = setup();
  const { access_token: bearer } = await connect(s);
  const init = await legacyCall(s, bearer, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'claude-ai', version: '1' } }, { version: undefined, headers: { 'MCP-Protocol-Version': '' } });
  assert.equal(init.status, 200);
  assert.equal(init.data.result.protocolVersion, '2025-11-25');
  assert.deepEqual(init.data.result.capabilities, { tools: { listChanged: false } });
  assert.equal(init.data.result.serverInfo.name, 'aura-tasks');
  assert.equal(init.data.result.instructions, MCP_TEXTS.instructions);
  assert.equal(init.headers.get('Mcp-Session-Id'), null); // niente sessioni
  for (const version of ['2025-06-18', '2025-03-26']) {
    assert.equal((await legacyCall(s, bearer, 'initialize', { protocolVersion: version })).data.result.protocolVersion, version);
  }
  assert.equal((await legacyCall(s, bearer, 'initialize', { protocolVersion: '2024-11-05' })).data.result.protocolVersion, '2025-11-25');

  const notification = await legacyCall(s, bearer, 'notifications/initialized', undefined, { id: null });
  assert.equal(notification.status, 202);
  assert.equal(notification.text, '');
  assert.deepEqual((await legacyCall(s, bearer, 'ping', {})).data.result, {});

  const list = await legacyCall(s, bearer, 'tools/list', {});
  assert.equal(list.data.result.tools.length, 1);
  const tool = list.data.result.tools[0];
  assert.equal(tool.name, 'aggiungi_ad_aura');
  assert.equal(tool.title, 'Aggiungi ad Aura');
  assert.equal(tool.description, MCP_TEXTS.toolDescription);
  assert.deepEqual(tool.inputSchema.required, ['attivita']);
  assert.equal(tool.inputSchema.properties.attivita.maxItems, 10);
  assert.equal(tool.inputSchema.properties.attivita.items.maxLength, 200);
  assert.deepEqual(tool.annotations, { title: 'Aggiungi ad Aura', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false });

  const unknown = await legacyCall(s, bearer, 'resources/list', {});
  assert.equal(unknown.status, 200);
  assert.equal(unknown.data.error.code, -32601);
  const badVersion = await legacyCall(s, bearer, 'tools/list', {}, { version: '1999-01-01' });
  assert.equal(badVersion.status, 400);
  assert.deepEqual(badVersion.data.error.data.supported, ['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26']);
});

test('la descrizione dello strumento dice a Claude quando usarlo e di chiedere prima', () => {
  const text = TOOL.description;
  assert.match(text, /chiedi prima «Lo metto su Aura\?»/);
  assert.match(text, /può solo aggiungere/);
  assert.match(text, /scrivi la data/);
  assert.match(text, /Non scrivere password/);
});

test('strumento: le frasi arrivano nella casella con id «claude:» e source «claude»; l\'app le conferma', async () => {
  const s = setup();
  const { access_token: bearer } = await connect(s);
  await s.call('POST', '/api/inbox', { code: CODE_A, body: { text: 'Da Siri' } });
  s.deps.now = NOW + 1000;
  const result = await addCall(s, bearer, ['  Chiamare il dentista il 27 novembre alle 10 ', 'Comprare\nil latte']);
  assert.equal(result.status, 200);
  assert.equal(result.data.result.isError, false);
  assert.equal(result.data.result.content[0].text, MCP_TEXTS.added(2));
  assert.equal(result.data.result.resultType, undefined); // solo nella nuova epoca
  const inbox = await s.call('GET', '/api/inbox', { code: CODE_A, origin: APP });
  assert.deepEqual(inbox.data.items.map(item => [item.text, item.source]), [
    ['Da Siri', 'siri'],
    ['Chiamare il dentista il 27 novembre alle 10', 'claude'],
    ['Comprare il latte', 'claude']
  ]);
  const claudeIds = inbox.data.items.filter(item => item.source === 'claude').map(item => item.id);
  claudeIds.forEach(id => assert.match(id, /^claude:[A-Za-z0-9_-]{16}$/));
  const ack = await s.call('POST', '/api/inbox/ack', { code: CODE_A, origin: APP, body: { ids: inbox.data.items.map(item => item.id) } });
  assert.equal(ack.data.deleted, 3);
  // Un id con i due punti ma non «claude:» non passa.
  assert.equal((await s.call('POST', '/api/inbox/ack', { code: CODE_A, origin: APP, body: { ids: ['siri:abc'] } })).data.deleted, 0);
});

test('strumento: frasi sbagliate, troppe, troppo lunghe; tutto o niente', async () => {
  const s = setup();
  const { access_token: bearer } = await connect(s);
  const cases = [
    [[], MCP_TEXTS.none],
    [undefined, MCP_TEXTS.none],
    [Array(11).fill('Uno'), MCP_TEXTS.tooMany],
    [['Buona', '   '], MCP_TEXTS.empty],
    [['Buona', 42], MCP_TEXTS.empty],
    [['x'.repeat(201)], MCP_TEXTS.tooLong]
  ];
  for (const [attivita, text] of cases) {
    const result = await legacyCall(s, bearer, 'tools/call', { name: TOOL.name, arguments: attivita === undefined ? {} : { attivita } });
    assert.equal(result.status, 200);
    assert.equal(result.data.result.isError, true);
    assert.equal(result.data.result.content[0].text, text);
  }
  assert.equal(s.rows('SELECT * FROM inbox').length, 0);
  assert.equal((await addCall(s, bearer, ['x'.repeat(200)])).data.result.isError, false);
  const unknownTool = await legacyCall(s, bearer, 'tools/call', { name: 'cancella_tutto', arguments: {} });
  assert.equal(unknownTool.data.error.code, -32602);
});

test('strumento: casella piena (contando Siri), tutto o niente', async () => {
  const s = setup();
  const { access_token: bearer } = await connect(s);
  for (let i = 0; i < LIMITS.inboxItems - 2; i++) await s.call('POST', '/api/inbox', { code: CODE_A, body: { text: 'Siri ' + i } });
  const full = await addCall(s, bearer, ['Uno', 'Due', 'Tre']);
  assert.equal(full.data.result.isError, true);
  assert.equal(full.data.result.content[0].text, MCP_TEXTS.full(2));
  assert.equal(s.rows("SELECT * FROM inbox WHERE id LIKE 'claude:%'").length, 0);
  assert.equal(s.rows('SELECT * FROM claude_usage').length, 0, 'niente conteggi per una chiamata rifiutata');
  assert.equal((await addCall(s, bearer, ['Uno', 'Due'])).data.result.isError, false);
  assert.equal((await addCall(s, bearer, ['Tre'])).data.result.content[0].text, MCP_TEXTS.full(0));
  // Le frasi entrano nell'ordine in cui arrivano, dopo quelle di Siri.
  const inbox = await s.call('GET', '/api/inbox', { code: CODE_A, origin: APP });
  assert.deepEqual(inbox.data.items.slice(-2).map(item => [item.text, item.source]), [['Uno', 'claude'], ['Due', 'claude']]);
});

test('strumento: 50 al giorno per dispositivo, anche ricollegando; il giorno dopo si riparte', async () => {
  const s = setup();
  const { access_token: bearer, refresh_token: refresh } = await connect(s);
  const emptyInbox = () => s.env.DB.query('DELETE FROM inbox'); // l'app ritira le frasi; il conto resta
  for (let i = 0; i < 4; i++) {
    emptyInbox();
    assert.equal((await addCall(s, bearer, Array(10).fill('Frase'))).data.result.isError, false);
  }
  emptyInbox();
  assert.equal((await addCall(s, bearer, Array(9).fill('Frase'))).data.result.isError, false); // 49
  const two = await addCall(s, bearer, ['Una', 'Due']);
  assert.equal(two.data.result.content[0].text, MCP_TEXTS.daily(1));
  // «Scollega Claude» e un collegamento nuovo non azzerano il conto del dispositivo.
  assert.equal((await s.call('DELETE', '/api/claude', { code: CODE_A, origin: APP })).status, 200);
  const again = await connect(s);
  assert.equal((await addCall(s, again.access_token, ['Ultima'])).data.result.isError, false); // 50
  const over = await addCall(s, again.access_token, ['Una di troppo']);
  assert.equal(over.data.result.isError, true);
  assert.equal(over.data.result.content[0].text, MCP_TEXTS.daily(0));
  assert.deepEqual(s.rows("SELECT device_id = '*' AS total, added FROM claude_usage ORDER BY total").map(row => row.added), [50, 50]);
  // Il giorno dopo (UTC) il token d'accesso è scaduto: Claude lo rinnova e il conto riparte da zero.
  s.deps.now = Date.UTC(2026, 10, 24, 0, 1);
  assert.equal((await addCall(s, again.access_token, ['Domani'])).status, 401);
  assert.equal((await s.call('POST', '/oauth/token', { body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh, client_id: CLAUDE.clientId }) })).status, 400, 'il collegamento tolto non si rinnova');
  const renewed = await s.call('POST', '/oauth/token', { body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: again.refresh_token, client_id: CLAUDE.clientId }) });
  assert.equal(renewed.status, 200, renewed.text);
  assert.equal((await addCall(s, renewed.data.access_token, ['Domani'])).data.result.isError, false);
  assert.deepEqual(s.rows("SELECT added FROM claude_usage WHERE day = '2026-11-24'").map(row => row.added), [1, 1]);
});

test('strumento: tetto di tutto il server (MAX_CLAUDE_PER_DAY); Siri continua', async () => {
  const s = setup();
  s.env.MAX_CLAUDE_PER_DAY = '12';
  const a = await connect(s, CODE_A);
  const b = await connect(s, CODE_B);
  assert.equal((await addCall(s, a.access_token, Array(10).fill('Per A'))).data.result.isError, false);
  const tooMany = await addCall(s, b.access_token, ['B1', 'B2', 'B3']);
  assert.equal(tooMany.data.result.isError, true);
  assert.equal(tooMany.data.result.content[0].text, MCP_TEXTS.allToday(2));
  assert.equal((await addCall(s, b.access_token, ['B1', 'B2'])).data.result.isError, false);
  const none = await addCall(s, b.access_token, ['B3']);
  assert.equal(none.data.result.content[0].text, MCP_TEXTS.allToday(0));
  assert.equal(s.rows("SELECT added FROM claude_usage WHERE device_id = '*'")[0].added, 12);
  // Siri e il resto del server non ne risentono.
  assert.equal((await s.call('POST', '/api/inbox', { code: CODE_B, body: { text: 'Da Siri' } })).status, 201);
  // Un dispositivo che si scollega porta via i suoi conteggi, non il totale.
  assert.equal((await s.call('DELETE', '/api/devices', { code: CODE_A, origin: APP })).status, 200);
  assert.deepEqual(s.rows('SELECT device_id = ? AS b, added FROM claude_usage ORDER BY added', 'x').map(row => row.added), [2, 12]);
  assert.equal((await addCall(s, b.access_token, ['B3'])).data.result.content[0].text, MCP_TEXTS.allToday(0));
  // Valori non validi: vale il tetto di sempre.
  s.env.MAX_CLAUDE_PER_DAY = 'tanti';
  assert.equal((await addCall(s, b.access_token, ['B3'])).data.result.isError, false);
});

test('strumento: la scrittura ricontrolla i limiti, se un\'altra frase arriva tra la lettura e la scrittura', async () => {
  const s = setup();
  const { access_token: bearer } = await connect(s);
  /** La prossima scrittura del server trova prima `between()`: come una chiamata arrivata nel frattempo. */
  const meanwhile = between => {
    const batch = s.env.DB.batch;
    s.env.DB.batch = async statements => {
      s.env.DB.batch = batch;
      await between();
      return batch(statements);
    };
  };
  for (let i = 0; i < LIMITS.inboxItems - 3; i++) await s.call('POST', '/api/inbox', { code: CODE_A, body: { text: 'Siri ' + i } });
  // La lettura vede 3 posti; prima della scrittura arriva una frase di Siri, e i posti diventano 2.
  meanwhile(() => s.call('POST', '/api/inbox', { code: CODE_A, body: { text: 'Siri in mezzo' } }));
  const late = await addCall(s, bearer, ['A', 'B', 'C']);
  assert.equal(late.data.result.isError, true);
  assert.equal(late.data.result.content[0].text, MCP_TEXTS.full(2));
  assert.equal(s.rows("SELECT * FROM inbox WHERE id LIKE 'claude:%'").length, 0, 'niente a metà');
  assert.equal(s.rows('SELECT * FROM claude_usage').length, 0, 'niente conteggi per ciò che non è entrato');
  assert.equal(s.rows('SELECT * FROM claude_links WHERE used_at IS NOT NULL').length, 0);
  // Lo stesso per il tetto del server: un altro dispositivo prende gli ultimi posti nel frattempo.
  s.env.DB.query('DELETE FROM inbox');
  s.env.MAX_CLAUDE_PER_DAY = '5';
  const other = await connect(s, CODE_B);
  meanwhile(() => addCall(s, other.access_token, ['B1', 'B2', 'B3', 'B4']));
  const total = await addCall(s, bearer, ['A1', 'A2']);
  assert.equal(total.data.result.content[0].text, MCP_TEXTS.allToday(1));
  assert.equal(s.rows("SELECT added FROM claude_usage WHERE device_id = '*'")[0].added, 4);
  assert.equal((await addCall(s, bearer, ['A1'])).data.result.isError, false);
});

test('strumento: un token scrive solo nella casella del suo dispositivo', async () => {
  const s = setup();
  const a = await connect(s, CODE_A);
  const b = await connect(s, CODE_B);
  assert.equal((await addCall(s, a.access_token, ['Per A'])).data.result.isError, false);
  assert.equal((await addCall(s, b.access_token, ['Per B'])).data.result.isError, false);
  const inboxA = await s.call('GET', '/api/inbox', { code: CODE_A, origin: APP });
  const inboxB = await s.call('GET', '/api/inbox', { code: CODE_B, origin: APP });
  assert.deepEqual(inboxA.data.items.map(item => item.text), ['Per A']);
  assert.deepEqual(inboxB.data.items.map(item => item.text), ['Per B']);
});

/* ---------- Il connettore: 2026-07-28 ---------- */

test('nuova epoca: server/discover e tools/list con resultType, ttlMs e cacheScope', async () => {
  const s = setup();
  const { access_token: bearer } = await connect(s);
  const discover = await modernCall(s, bearer, 'server/discover');
  assert.equal(discover.status, 200);
  assert.equal(discover.data.result.resultType, 'complete');
  assert.deepEqual(discover.data.result.supportedVersions, ['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26']);
  assert.deepEqual(discover.data.result.capabilities, { tools: {} });
  assert.equal(discover.data.result.ttlMs, 3600000);
  assert.equal(discover.data.result.cacheScope, 'public');
  assert.equal(discover.data.result._meta['io.modelcontextprotocol/serverInfo'].name, 'aura-tasks');
  const list = await modernCall(s, bearer, 'tools/list');
  assert.equal(list.data.result.resultType, 'complete');
  assert.equal(list.data.result.tools[0].name, TOOL.name);
  assert.equal(list.data.result.cacheScope, 'public');
  const unknown = await modernCall(s, bearer, 'prompts/list');
  assert.equal(unknown.status, 404);
  assert.equal(unknown.data.error.code, -32601);
});

test('nuova epoca: tools/call con Mcp-Name, anche in base64', async () => {
  const s = setup();
  const { access_token: bearer } = await connect(s);
  const result = await modernCall(s, bearer, 'tools/call', { name: TOOL.name, arguments: { attivita: ['Palestra ogni lunedì alle 18'] } });
  assert.equal(result.status, 200);
  assert.equal(result.data.result.resultType, 'complete');
  assert.equal(result.data.result.isError, false);
  const encoded = '=?base64?' + Buffer.from(TOOL.name).toString('base64') + '?=';
  assert.equal(headerValue(encoded), TOOL.name);
  assert.equal(headerValue('=?base64?SGVsbG8sIOS4lueVjA==?='), 'Hello, 世界');
  assert.equal(headerValue('=?base64?//79?='), null); // non è UTF-8 valido
  const viaBase64 = await modernCall(s, bearer, 'tools/call', { name: TOOL.name, arguments: { attivita: ['Seconda'] } }, { headers: { 'Mcp-Name': encoded } });
  assert.equal(viaBase64.status, 200);
  assert.equal(s.rows("SELECT * FROM inbox WHERE id LIKE 'claude:%'").length, 2);
});

test('nuova epoca: intestazioni diverse dal corpo, versione sconosciuta, _meta incompleto', async () => {
  const s = setup();
  const { access_token: bearer } = await connect(s);
  const name = await modernCall(s, bearer, 'tools/call', { name: TOOL.name, arguments: { attivita: ['X'] } }, { headers: { 'Mcp-Name': 'altro' } });
  assert.equal(name.status, 400);
  assert.equal(name.data.error.code, -32020);
  assert.equal(name.data.error.message, "Header mismatch: Mcp-Name header value 'altro' does not match body value 'aggiungi_ad_aura'");
  const method = await modernCall(s, bearer, 'tools/list', {}, { headers: { 'Mcp-Method': 'tools/call' } });
  assert.equal(method.data.error.code, -32020);
  const header = await modernCall(s, bearer, 'tools/list', {}, { headers: { 'Mcp-Method': '' } });
  assert.equal(header.data.error.code, -32020);
  const version = await modernCall(s, bearer, 'tools/list', {}, { headers: { 'MCP-Protocol-Version': '2025-11-25' } });
  assert.equal(version.data.error.code, -32020);
  const future = await modernCall(s, bearer, 'tools/list', {}, {
    headers: { 'MCP-Protocol-Version': '2027-01-01' },
    meta: { 'io.modelcontextprotocol/protocolVersion': '2027-01-01', 'io.modelcontextprotocol/clientCapabilities': {} }
  });
  assert.equal(future.status, 400);
  assert.equal(future.data.error.code, -32022);
  assert.deepEqual(future.data.error.data, { supported: ['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26'], requested: '2027-01-01' });
  const noCaps = await modernCall(s, bearer, 'tools/list', {}, { meta: { 'io.modelcontextprotocol/protocolVersion': MODERN } });
  assert.equal(noCaps.status, 400);
  assert.equal(noCaps.data.error.code, -32602);
  assert.equal(s.rows('SELECT * FROM inbox').length, 0);
});

/* ---------- Scollegare e pulire ---------- */

test('«Scollega questo dispositivo» toglie anche collegamenti, codici e conteggi di Claude', async () => {
  const s = setup();
  const tokens = await connect(s);
  await addCall(s, tokens.access_token, ['Prima']);
  await pairCode(s);
  assert.equal((await s.call('DELETE', '/api/devices', { code: CODE_A, origin: APP })).status, 200);
  assert.equal(s.rows('SELECT * FROM claude_links').length, 0);
  assert.equal(s.rows('SELECT * FROM claude_codes').length, 0);
  assert.deepEqual(s.rows('SELECT device_id FROM claude_usage').map(row => row.device_id), ['*']);
  assert.equal((await addCall(s, tokens.access_token, ['Dopo'])).status, 401);
});

test('pulizia oraria: codici scaduti, conteggi vecchi, collegamenti scaduti, registrazioni ferme da 30 giorni, dispositivi spariti', async () => {
  const s = setup();
  const tokens = await connect(s, CODE_A);
  assert.equal((await addCall(s, tokens.access_token, ['Prima'])).data.result.isError, false);
  await pairCode(s, CODE_A);
  await s.call('POST', '/oauth/register', { body: { redirect_uris: [REDIRECT] } });
  // Alle 15:00, dopo 10 minuti: il codice è scaduto, il resto resta.
  s.deps.now = Date.UTC(2026, 10, 23, 15, 0);
  await runCron(s.env, s.deps);
  assert.equal(s.rows('SELECT * FROM claude_codes').length, 0);
  assert.equal(s.rows('SELECT * FROM claude_links').length, 1);
  assert.equal(s.rows('SELECT * FROM oauth_clients').length, 1);
  assert.equal(s.rows('SELECT * FROM claude_usage').length, 2, 'i conteggi di oggi restano');
  // Dopo 31 giorni la registrazione ferma esce; il collegamento resta (il dispositivo è visto ogni giorno).
  s.deps.now = Date.UTC(2026, 11, 24, 15, 0);
  s.env.DB.query('UPDATE devices SET seen_at = ?', s.deps.now);
  await runCron(s.env, s.deps);
  assert.equal(s.rows('SELECT * FROM oauth_clients').length, 0);
  assert.equal(s.rows('SELECT * FROM claude_usage').length, 0);
  assert.equal(s.rows('SELECT * FROM claude_links').length, 1);
  // Un dispositivo non visto da 180 giorni porta via anche il collegamento.
  s.deps.now = Date.UTC(2027, 5, 30, 15, 0);
  await runCron(s.env, s.deps);
  assert.equal(s.rows('SELECT * FROM devices').length, 0);
  assert.equal(s.rows('SELECT * FROM claude_links').length, 0);
});

test('schema: si può applicare due volte (npm run db:init ripetuto)', () => {
  const db = new DatabaseSync(':memory:');
  const sql = readFileSync(SCHEMA, 'utf8');
  db.exec(sql);
  db.exec(sql);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(row => row.name);
  for (const name of ['claude_links', 'claude_codes', 'oauth_clients', 'claude_usage']) assert.ok(tables.includes(name));
});

test('nei log e negli errori non finiscono mai token, codici o frasi', async () => {
  const s = setup();
  const lines = [];
  const originals = { warn: console.warn, error: console.error, log: console.log };
  console.warn = console.error = console.log = (...args) => lines.push(args.map(String).join(' '));
  let tokens;
  let pair;
  try {
    await registerDevice(s);
    pair = await pairCode(s);
    const { verifier, challenge } = pkce();
    await authorize(s, challenge, 'ZZZZ-ZZZZ');
    const page = await authorize(s, challenge, pair);
    const code = new URL(page.headers.get('Location')).searchParams.get('code');
    await exchange(s, code, 'sbagliato'.repeat(6));
    const { verifier: v2, challenge: c2 } = pkce();
    const page2 = await authorize(s, c2, await pairCode(s));
    tokens = (await exchange(s, new URL(page2.headers.get('Location')).searchParams.get('code'), v2)).data;
    await addCall(s, tokens.access_token, ['Frase segreta di prova']);
    await s.call('GET', '/oauth/authorize?' + authorizeParams(challenge, { redirect_uri: 'https://altro.example/x' }));
    void verifier;
  } finally {
    Object.assign(console, originals);
  }
  const all = lines.join('\n');
  for (const secret of [pair, tokens.access_token, tokens.refresh_token, 'Frase segreta']) assert.ok(!all.includes(secret));
});

test('limiti dichiarati nella proposta', () => {
  assert.equal(MCP_LIMITS.phrases, 10);
  assert.equal(MCP_LIMITS.phraseLength, 200);
  assert.equal(MCP_LIMITS.perDay, 50);
  assert.equal(MCP_LIMITS.totalPerDay, 1000);
  assert.equal(OAUTH_LIMITS.pairTtl, 10 * MINUTE);
  assert.equal(OAUTH_LIMITS.authCodeTtl, 60 * 1000);
  assert.equal(OAUTH_LIMITS.accessTtl, 60 * MINUTE);
  assert.equal(OAUTH_LIMITS.refreshTtl, 180 * DAY);
  assert.equal(OAUTH_LIMITS.linksPerDevice, 3);
  assert.equal(OAUTH_LIMITS.clients, 50);
  assert.equal(CLAUDE.clientId, 'https://claude.ai/oauth/mcp-oauth-client-metadata');
  assert.deepEqual(CLAUDE.redirectUris, ['https://claude.ai/api/mcp/auth_callback']);
});
