/*
 * Aura — accesso di Claude al connettore (P-006): OAuth 2.1 con il codice che l'app mostra per 10 minuti.
 * - Metadati della risorsa (RFC 9728) e del server di accesso (RFC 8414), pagina con il codice, token,
 *   registrazione automatica (RFC 7591). PKCE S256 obbligatorio; `iss` nella risposta (RFC 9207).
 * - Si accetta solo Claude: la sua identità pubblicata (una copia fissa, senza scaricarla) oppure una
 *   registrazione automatica con il suo indirizzo di ritorno. Un'altra app non ottiene niente.
 * - Il server conserva solo impronte SHA-256 di codici e token. Nei log niente codici, token né frasi.
 * Specifica: app-attivita/docs/connettore-claude.md.
 */
import { cleanText, json, readBody, randomToken, sha256Hex } from './http.js';
import { CLAUDE_PAGE } from './text.js';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/** Claude: identità pubblicata (Client ID Metadata Document), indirizzo di ritorno e origine dei suoi siti. */
export const CLAUDE = {
  clientId: 'https://claude.ai/oauth/mcp-oauth-client-metadata',
  clientName: 'Claude',
  redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
  origins: ['https://claude.ai']
};

export const OAUTH_LIMITS = {
  pairLength: 8,
  pairTtl: 10 * MINUTE,      // il codice mostrato dall'app
  authCodeTtl: 60 * 1000,    // il codice d'autorizzazione che va a Claude
  accessTtl: 60 * MINUTE,
  refreshTtl: 180 * DAY,     // come un dispositivo non visto
  linksPerDevice: 3,
  clients: 50,               // registrazioni automatiche, in tutto
  clientIdle: 30 * DAY,
  stateLength: 1024,
  formBody: 8 * 1024,
  scope: 'aggiungi'
};

/** Alfabeto del codice: 31 segni, senza 0, O, 1, I e L, che si confondono. */
export const PAIR_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const TOKEN = /^[A-Za-z0-9_-]{43}$/;            // codici d'autorizzazione e token: 32 byte in base64url
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;        // S256: SHA-256 del verificatore, in base64url
const VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;   // RFC 7636
const CLIENT_ID = /^aura-[A-Za-z0-9_-]{24}$/;   // registrazioni automatiche
const SINGLE = ['client_id', 'redirect_uri', 'response_type', 'code_challenge', 'code_challenge_method', 'state', 'resource', 'scope'];

/** Indirizzi pubblici di questo server: chi rilascia i token (issuer) e la risorsa protetta (il connettore). */
export function serverUrls(request) {
  const issuer = new URL(request.url).origin;
  return { issuer, resource: issuer + '/mcp', metadata: issuer + '/.well-known/oauth-protected-resource/mcp' };
}

/* ---------- Metadati ---------- */

export function protectedResourceMetadata(request) {
  const { issuer, resource } = serverUrls(request);
  return json({
    resource,
    authorization_servers: [issuer],
    scopes_supported: [OAUTH_LIMITS.scope],
    bearer_methods_supported: ['header'],
    resource_name: 'Aura Tasks'
  });
}

export function authorizationServerMetadata(request) {
  const { issuer } = serverUrls(request);
  return json({
    issuer,
    authorization_endpoint: issuer + '/oauth/authorize',
    token_endpoint: issuer + '/oauth/token',
    registration_endpoint: issuer + '/oauth/register',
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: [OAUTH_LIMITS.scope],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true
  });
}

/* ---------- Codice per collegare (dall'app, con il codice del dispositivo) ---------- */

/** Codice nuovo di 8 segni, scelti in modo uniforme (si scartano i byte oltre 247 = 8 × 31 − 1). */
export function newPairCode() {
  const out = [];
  while (out.length < OAUTH_LIMITS.pairLength) {
    for (const byte of crypto.getRandomValues(new Uint8Array(16))) {
      if (byte < 248 && out.length < OAUTH_LIMITS.pairLength) out.push(PAIR_ALPHABET[byte % 31]);
    }
  }
  return out.join('');
}

/** Il codice scritto nella pagina: maiuscole, minuscole, spazi e trattini non contano. null se non è valido. */
export function normalizePairCode(value) {
  if (typeof value !== 'string' || value.length > 32) return null;
  const code = value.toUpperCase().replace(/[\s-]+/g, '');
  if (code.length !== OAUTH_LIMITS.pairLength) return null;
  return [...code].every(char => PAIR_ALPHABET.includes(char)) ? code : null;
}

/** POST /api/claude/code: un codice nuovo prende il posto di quello di prima. Lo vede solo l'app, una volta. */
export async function createPairCode(env, deps, deviceId) {
  const code = newPairCode();
  const expiresAt = deps.now + OAUTH_LIMITS.pairTtl;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM claude_codes WHERE device_id = ? AND kind = 'pair'").bind(deviceId),
    env.DB.prepare("INSERT INTO claude_codes (hash, kind, device_id, data, expires_at) VALUES (?, 'pair', ?, NULL, ?)")
      .bind(await sha256Hex('pair:' + code), deviceId, expiresAt)
  ]);
  return json({ code, expiresAt }, 201);
}

/** GET /api/claude: i collegamenti del dispositivo (solo date) e la scadenza del codice in corso. */
export async function claudeStatus(env, deps, deviceId) {
  const { results } = await env.DB.prepare(
    'SELECT created_at AS createdAt, used_at AS usedAt FROM claude_links WHERE device_id = ? AND refresh_expires > ? ORDER BY created_at, rowid'
  ).bind(deviceId, deps.now).all();
  const code = await env.DB.prepare(
    "SELECT expires_at AS expiresAt FROM claude_codes WHERE device_id = ? AND kind = 'pair' AND expires_at > ?"
  ).bind(deviceId, deps.now).first();
  return json({ links: results, code: code ? { expiresAt: code.expiresAt } : null });
}

/** DELETE /api/claude: «Scollega Claude». I token smettono subito di valere. */
export async function unlinkClaude(env, deps, deviceId) {
  const [links] = await env.DB.batch(forgetClaudeStatements(env, [deviceId]));
  return json({ ok: true, deleted: links.meta.changes });
}

/** Collegamenti e codici dei dispositivi indicati: per «Scollega Claude», «Scollega questo dispositivo» e la pulizia. */
export function forgetClaudeStatements(env, deviceIds) {
  const ids = JSON.stringify(deviceIds);
  return [
    env.DB.prepare('DELETE FROM claude_links WHERE device_id IN (SELECT value FROM json_each(?))').bind(ids),
    env.DB.prepare('DELETE FROM claude_codes WHERE device_id IN (SELECT value FROM json_each(?))').bind(ids)
  ];
}

/** Pulizia oraria: codici scaduti, collegamenti con il rinnovo scaduto, registrazioni non usate da 30 giorni. */
export function oauthCleanupStatements(env, now) {
  return [
    env.DB.prepare('DELETE FROM claude_codes WHERE expires_at < ?').bind(now),
    env.DB.prepare('DELETE FROM claude_links WHERE refresh_expires < ?').bind(now),
    env.DB.prepare('DELETE FROM oauth_clients WHERE used_at < ?').bind(now - OAUTH_LIMITS.clientIdle)
  ];
}

/* ---------- Chi chiede l'accesso ---------- */

/** Il client: l'identità pubblicata di Claude o una registrazione automatica. null se sconosciuto. */
async function findClient(env, clientId) {
  if (clientId === CLAUDE.clientId) return { id: CLAUDE.clientId, redirectUris: CLAUDE.redirectUris, registered: false };
  if (typeof clientId !== 'string' || !CLIENT_ID.test(clientId)) return null;
  const row = await env.DB.prepare('SELECT id, redirect_uris AS uris FROM oauth_clients WHERE id = ?').bind(clientId).first();
  if (!row) return null;
  let uris;
  try {
    uris = JSON.parse(row.uris);
  } catch (err) {
    return null;
  }
  return { id: row.id, redirectUris: Array.isArray(uris) ? uris.filter(uri => CLAUDE.redirectUris.includes(uri)) : [], registered: true };
}

/**
 * I parametri della richiesta d'accesso, da `source` (URLSearchParams della pagina o del modulo).
 * - { fail } se il client o l'indirizzo di ritorno non vanno: si mostra un errore, senza mai rimandare altrove;
 * - { error, redirectUri, state } per gli altri errori, che tornano a Claude (RFC 6749, 4.1.2.1);
 * - altrimenti i valori controllati.
 */
async function readAuthorizeParams(source, env, request) {
  if (SINGLE.some(name => source.getAll(name).length > 1)) return { fail: 'request' };
  const clientId = source.get('client_id');
  const redirectUri = source.get('redirect_uri');
  const client = clientId ? await findClient(env, clientId) : null;
  if (!client) return { fail: 'client', reason: 'client non ammesso' };
  if (!redirectUri || !client.redirectUris.includes(redirectUri)) return { fail: 'client', reason: 'indirizzo di ritorno non ammesso' };
  const state = source.get('state');
  const base = { client, redirectUri, state };
  // Uno state troppo lungo non torna indietro: Claude non ne manda mai di così lunghi.
  if (state !== null && state.length > OAUTH_LIMITS.stateLength) return { ...base, state: null, error: 'invalid_request' };
  if (source.get('response_type') !== 'code') return { ...base, error: 'unsupported_response_type' };
  const challenge = source.get('code_challenge');
  if (source.get('code_challenge_method') !== 'S256' || !challenge || !CHALLENGE.test(challenge)) return { ...base, error: 'invalid_request' };
  const { resource } = serverUrls(request);
  const requested = source.get('resource');
  if (requested !== null && requested !== resource) return { ...base, error: 'invalid_target' };
  return { ...base, challenge, resource }; // scope: c'è un solo permesso, «aggiungi», quindi non si guarda
}

/* ---------- La pagina con il codice ---------- */

/** GET /oauth/authorize: la pagina che chiede il codice di Aura. */
export async function authorizePage(request, env) {
  const params = new URL(request.url).searchParams;
  const check = await readAuthorizeParams(params, env, request);
  if (check.fail) return failPage(check);
  if (check.error) return redirectBack(request, check, { error: check.error });
  return codePage(check, 200);
}

/**
 * POST /oauth/authorize: il codice scritto nella pagina. Se va bene, il codice si consuma e Claude riceve
 * un codice d'autorizzazione, nello stesso passo (un solo batch): due invii insieme non valgono due volte.
 */
export async function authorizeSubmit(request, env, deps) {
  const type = (request.headers.get('Content-Type') || '').toLowerCase();
  if (!type.startsWith('application/x-www-form-urlencoded')) return failPage({ fail: 'request' });
  const form = new URLSearchParams(await readBody(request, OAUTH_LIMITS.formBody));
  const check = await readAuthorizeParams(form, env, request);
  if (check.fail) return failPage(check);
  if (check.error) return redirectBack(request, check, { error: check.error });
  const pair = normalizePairCode(form.get('codice'));
  if (!pair) return codePage(check, 400, CLAUDE_PAGE.badCode);
  const pairHash = await sha256Hex('pair:' + pair);
  const code = randomToken(32);
  const data = JSON.stringify({
    clientId: check.client.id,
    redirectUri: check.redirectUri,
    challenge: check.challenge,
    resource: check.resource
  });
  const [inserted] = await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO claude_codes (hash, kind, device_id, data, expires_at) SELECT ?, 'auth', device_id, ?, ? " +
      "FROM claude_codes WHERE hash = ? AND kind = 'pair' AND expires_at > ?"
    ).bind(await sha256Hex('auth:' + code), data, deps.now + OAUTH_LIMITS.authCodeTtl, pairHash, deps.now),
    env.DB.prepare("DELETE FROM claude_codes WHERE hash = ? AND kind = 'pair'").bind(pairHash)
  ]);
  if (!inserted.meta.changes) return codePage(check, 400, CLAUDE_PAGE.badCode);
  return redirectBack(request, check, { code });
}

/** 429 della pagina: resta la pagina, con il messaggio. Con parametri sbagliati, l'errore di sempre. */
export async function authorizeTooMany(request, env) {
  if (request.method !== 'POST') return failPage({ fail: 'request' }, 429);
  const type = (request.headers.get('Content-Type') || '').toLowerCase();
  let form = new URLSearchParams();
  if (type.startsWith('application/x-www-form-urlencoded')) {
    try {
      form = new URLSearchParams(await readBody(request, OAUTH_LIMITS.formBody));
    } catch (err) {
      form = new URLSearchParams();
    }
  }
  const check = await readAuthorizeParams(form, env, request);
  if (check.fail || check.error) return failPage({ fail: 'request' }, 429);
  return codePage(check, 429, CLAUDE_PAGE.tooMany);
}

/** Torna a Claude (303) con il codice o con l'errore, sempre con `state` e `iss`. */
function redirectBack(request, check, values) {
  const url = new URL(check.redirectUri);
  Object.entries(values).forEach(([key, value]) => url.searchParams.set(key, value));
  if (check.state !== null) url.searchParams.set('state', check.state);
  url.searchParams.set('iss', serverUrls(request).issuer);
  return new Response(null, { status: 303, headers: { ...PAGE_HEADERS, Location: url.toString() } });
}

const PAGE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  // same-origin e non no-referrer: con no-referrer il browser manderebbe «Origin: null» con il modulo.
  'Referrer-Policy': 'same-origin'
};

/** Testo sicuro dentro l'HTML, anche negli attributi. */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function codePage(check, status, error) {
  const hidden = [
    ['client_id', check.client.id],
    ['redirect_uri', check.redirectUri],
    ['response_type', 'code'],
    ['code_challenge', check.challenge],
    ['code_challenge_method', 'S256'],
    ['resource', check.resource],
    ['state', check.state]
  ].filter(([, value]) => value !== null && value !== undefined)
    .map(([name, value]) => '<input type="hidden" name="' + name + '" value="' + escapeHtml(value) + '">').join('');
  const host = new URL(check.redirectUri).host;
  const body =
    '<p>' + escapeHtml(CLAUDE_PAGE.intro) + '</p>' +
    '<p>' + escapeHtml(CLAUDE_PAGE.where) + '</p>' +
    (error ? '<p class="error" role="alert">' + escapeHtml(error) + '</p>' : '') +
    '<form method="post" action="/oauth/authorize">' + hidden +
    '<label for="codice">' + escapeHtml(CLAUDE_PAGE.label) + '</label>' +
    '<input id="codice" name="codice" required autofocus autocomplete="one-time-code" autocapitalize="characters" ' +
    'spellcheck="false" maxlength="16" aria-describedby="aiuto">' +
    '<p id="aiuto" class="muted">' + escapeHtml(CLAUDE_PAGE.hint) + '</p>' +
    '<button type="submit">' + escapeHtml(CLAUDE_PAGE.button) + '</button>' +
    '</form>' +
    '<p class="muted">' + escapeHtml(CLAUDE_PAGE.back(host)) + '</p>';
  return page(body, status, check.redirectUri);
}

function failPage(check, status = 400) {
  if (check.reason) console.warn('Accesso di Claude rifiutato:', check.reason); // mai valori: solo il motivo
  const text = check.fail === 'client' ? CLAUDE_PAGE.badClient : status === 429 ? CLAUDE_PAGE.tooMany : CLAUDE_PAGE.badRequest;
  return page('<p class="error" role="alert">' + escapeHtml(text) + '</p>', status, null);
}

/** Pagina senza script, con lo stile autorizzato da un nonce. `redirectUri` entra in form-action. */
function page(body, status, redirectUri) {
  const nonce = randomToken(16);
  const formTargets = ["'self'"].concat(redirectUri ? [new URL(redirectUri).origin] : []).join(' ');
  const html = '<!doctype html><html lang="it"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="color-scheme" content="light dark"><meta name="robots" content="noindex">' +
    '<title>' + escapeHtml(CLAUDE_PAGE.title) + '</title>' +
    '<style nonce="' + nonce + '">' + PAGE_STYLE + '</style></head>' +
    '<body><main><h1>' + escapeHtml(CLAUDE_PAGE.title) + '</h1>' + body + '</main></body></html>';
  return new Response(html, {
    status,
    headers: {
      ...PAGE_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; style-src 'nonce-" + nonce + "'; form-action " + formTargets +
        "; frame-ancestors 'none'; base-uri 'none'"
    }
  });
}

const PAGE_STYLE =
  ':root{--bg:#f4f1fb;--card:#fff;--text:#1d1a2b;--muted:#585270;--accent:#5b3fd0;--on-accent:#fff;--error:#b42318;--line:#8a84a3}' +
  '@media (prefers-color-scheme:dark){:root{--bg:#121019;--card:#1e1a2c;--text:#f1eefb;--muted:#bdb6d3;--accent:#ad98ff;--on-accent:#14121d;--error:#ff9b91;--line:#8d86a8}}' +
  '*{box-sizing:border-box}' +
  'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;background:var(--bg);color:var(--text);' +
  'font:17px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}' +
  'main{width:100%;max-width:440px;padding:28px 24px;background:var(--card);border-radius:20px;box-shadow:0 12px 32px rgb(0 0 0/.1)}' +
  'h1{font-size:1.4rem;line-height:1.25;margin:0 0 14px}p{margin:0 0 14px}' +
  '.muted{color:var(--muted);font-size:.95rem}.error{color:var(--error);font-weight:600}' +
  'label{display:block;font-weight:600;margin:20px 0 8px}' +
  'input{width:100%;min-height:52px;padding:10px 14px;border:2px solid var(--line);border-radius:12px;background:transparent;color:inherit;' +
  'font:600 1.5rem/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.12em;text-transform:uppercase}' +
  'input:focus{outline:3px solid var(--accent);outline-offset:2px;border-color:var(--accent)}' +
  '#aiuto{margin-top:8px}' +
  'button{width:100%;min-height:48px;margin:6px 0 18px;border:0;border-radius:12px;background:var(--accent);color:var(--on-accent);' +
  'font:600 1.05rem/1 inherit;cursor:pointer}button:focus-visible{outline:3px solid var(--text);outline-offset:2px}';

/* ---------- Token ---------- */

/** POST /oauth/token: scambio del codice d'autorizzazione e rinnovo (application/x-www-form-urlencoded). */
export async function token(request, env, deps) {
  const type = (request.headers.get('Content-Type') || '').toLowerCase();
  if (!type.startsWith('application/x-www-form-urlencoded')) return oauthError('invalid_request', 'Serve un modulo (application/x-www-form-urlencoded)');
  const form = new URLSearchParams(await readBody(request, OAUTH_LIMITS.formBody));
  const grant = form.get('grant_type');
  if (grant === 'authorization_code') return exchangeCode(form, request, env, deps);
  if (grant === 'refresh_token') return refreshTokens(form, request, env, deps);
  return oauthError('unsupported_grant_type', 'Tipo di richiesta non ammesso');
}

async function exchangeCode(form, request, env, deps) {
  const code = form.get('code');
  if (!code || !TOKEN.test(code)) return oauthError('invalid_grant', 'Codice non valido');
  // Il codice si consuma alla prima prova, anche se poi un controllo fallisce.
  const row = await env.DB.prepare(
    "DELETE FROM claude_codes WHERE hash = ? AND kind = 'auth' RETURNING device_id AS deviceId, data, expires_at AS expiresAt"
  ).bind(await sha256Hex('auth:' + code)).first();
  if (!row || row.expiresAt <= deps.now) return oauthError('invalid_grant', 'Codice non valido o scaduto');
  let data;
  try {
    data = JSON.parse(row.data);
  } catch (err) {
    return oauthError('invalid_grant', 'Codice non valido');
  }
  if (form.get('client_id') !== data.clientId) return oauthError('invalid_grant', 'Il codice è di un altro client');
  if (form.get('redirect_uri') !== data.redirectUri) return oauthError('invalid_grant', 'Indirizzo di ritorno diverso');
  const resource = form.get('resource');
  if (resource !== null && resource !== data.resource) return oauthError('invalid_target', 'Risorsa sconosciuta');
  const verifier = form.get('code_verifier');
  if (!verifier || !VERIFIER.test(verifier) || await challengeOf(verifier) !== data.challenge) {
    return oauthError('invalid_grant', 'Verifica PKCE non riuscita');
  }
  const device = await env.DB.prepare('SELECT 1 AS ok FROM devices WHERE id = ?').bind(row.deviceId).first();
  if (!device) return oauthError('invalid_grant', 'Il dispositivo non è più collegato');

  const access = randomToken(32);
  const refresh = randomToken(32);
  const statements = [
    // Al massimo 3 collegamenti per dispositivo: resta posto per questo togliendo quelli usati meno di recente.
    env.DB.prepare(
      'DELETE FROM claude_links WHERE id IN (SELECT id FROM claude_links WHERE device_id = ? ' +
      'ORDER BY COALESCE(used_at, created_at) DESC, rowid DESC LIMIT -1 OFFSET ?)'
    ).bind(row.deviceId, OAUTH_LIMITS.linksPerDevice - 1),
    env.DB.prepare(
      'INSERT INTO claude_links (id, device_id, client_id, resource, access_hash, access_expires, refresh_hash, refresh_expires, created_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(randomToken(12), row.deviceId, data.clientId, data.resource, await sha256Hex(access), deps.now + OAUTH_LIMITS.accessTtl,
      await sha256Hex(refresh), deps.now + OAUTH_LIMITS.refreshTtl, deps.now)
  ];
  if (data.clientId !== CLAUDE.clientId) {
    statements.push(env.DB.prepare('UPDATE oauth_clients SET used_at = ? WHERE id = ?').bind(deps.now, data.clientId));
  }
  await env.DB.batch(statements);
  return tokenResponse(access, refresh);
}

/** Rinnovo: il token di rinnovo cambia ogni volta (client senza segreto); quello vecchio smette subito di valere. */
async function refreshTokens(form, request, env, deps) {
  const value = form.get('refresh_token');
  const clientId = form.get('client_id');
  if (!clientId) return oauthError('invalid_request', 'Manca client_id');
  if (!value || !TOKEN.test(value)) return oauthError('invalid_grant', 'Token di rinnovo non valido');
  const resource = form.get('resource');
  if (resource !== null && resource !== serverUrls(request).resource) return oauthError('invalid_target', 'Risorsa sconosciuta');
  const access = randomToken(32);
  const refresh = randomToken(32);
  const row = await env.DB.prepare(
    'UPDATE claude_links SET access_hash = ?, access_expires = ?, refresh_hash = ?, refresh_expires = ? ' +
    'WHERE refresh_hash = ? AND refresh_expires > ? AND client_id = ? RETURNING id'
  ).bind(await sha256Hex(access), deps.now + OAUTH_LIMITS.accessTtl, await sha256Hex(refresh), deps.now + OAUTH_LIMITS.refreshTtl,
    await sha256Hex(value), deps.now, clientId).first();
  if (!row) return oauthError('invalid_grant', 'Token di rinnovo non valido o scaduto');
  return tokenResponse(access, refresh);
}

async function challengeOf(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function tokenResponse(access, refresh) {
  const response = json({
    access_token: access,
    token_type: 'Bearer',
    expires_in: OAUTH_LIMITS.accessTtl / 1000,
    refresh_token: refresh,
    scope: OAUTH_LIMITS.scope
  });
  response.headers.set('Pragma', 'no-cache');
  return response;
}

/** Errore OAuth (RFC 6749, 5.2): { error, error_description }. */
export function oauthError(error, description, status = 400) {
  const response = json({ error, error_description: description }, status);
  response.headers.set('Pragma', 'no-cache');
  return response;
}

/* ---------- Registrazione automatica (DCR) ---------- */

/** POST /oauth/register: solo con l'indirizzo di ritorno di Claude. Al massimo 50, tolte le meno usate. */
export async function register(request, env, deps) {
  const type = (request.headers.get('Content-Type') || '').toLowerCase();
  if (!type.startsWith('application/json')) return oauthError('invalid_client_metadata', 'Serve un JSON');
  let body;
  try {
    body = JSON.parse(await readBody(request, OAUTH_LIMITS.formBody));
  } catch (err) {
    if (err && err.status === 413) return oauthError('invalid_client_metadata', 'Richiesta troppo grande', 413);
    return oauthError('invalid_client_metadata', 'JSON non valido');
  }
  const uris = body && Array.isArray(body.redirect_uris) ? body.redirect_uris : null;
  if (!uris || !uris.length || uris.length > 5 || !uris.every(uri => CLAUDE.redirectUris.includes(uri))) {
    console.warn('Registrazione rifiutata: indirizzo di ritorno non ammesso');
    return oauthError('invalid_redirect_uri', 'Sono ammessi solo gli indirizzi di ritorno di Claude');
  }
  const method = body.token_endpoint_auth_method;
  if (method !== undefined && method !== 'none') return oauthError('invalid_client_metadata', 'Solo token_endpoint_auth_method "none"');
  const id = 'aura-' + randomToken(18);
  const name = cleanText(body.client_name).slice(0, 100) || CLAUDE.clientName;
  const redirectUris = [...new Set(uris)];
  await env.DB.batch([
    env.DB.prepare('DELETE FROM oauth_clients WHERE id IN (SELECT id FROM oauth_clients ORDER BY used_at DESC, rowid DESC LIMIT -1 OFFSET ?)')
      .bind(OAUTH_LIMITS.clients - 1),
    env.DB.prepare('INSERT INTO oauth_clients (id, redirect_uris, name, created_at, used_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, JSON.stringify(redirectUris), name, deps.now, deps.now)
  ]);
  return json({
    client_id: id,
    client_id_issued_at: Math.floor(deps.now / 1000),
    client_name: name,
    redirect_uris: redirectUris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none'
  }, 201);
}

/* ---------- Il token sul connettore ---------- */

/**
 * Il collegamento del token in "Authorization: Bearer …", se valido, non scaduto e rilasciato per questo
 * connettore (`resource`). `presented` dice se un token c'era, per l'errore nel 401.
 */
export async function linkFromRequest(request, env, deps) {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(request.headers.get('Authorization') || '');
  if (!match) return { link: null, presented: false };
  if (!TOKEN.test(match[1])) return { link: null, presented: true };
  const link = await env.DB.prepare(
    'SELECT id, device_id AS deviceId, resource FROM claude_links WHERE access_hash = ? AND access_expires > ?'
  ).bind(await sha256Hex(match[1]), deps.now).first();
  if (!link || link.resource !== serverUrls(request).resource) return { link: null, presented: true };
  return { link, presented: true };
}

/** 401 con l'indirizzo dei metadati: Claude rinnova il token o rifà l'accesso. */
export function unauthorized(request, presented) {
  const parts = ['resource_metadata="' + serverUrls(request).metadata + '"', 'scope="' + OAUTH_LIMITS.scope + '"'];
  if (presented) parts.unshift('error="invalid_token"');
  const response = json({ error: 'invalid_token', error_description: 'Serve l\'accesso: collega Claude con il codice di Aura' }, 401);
  response.headers.set('WWW-Authenticate', 'Bearer ' + parts.join(', '));
  return response;
}
