/*
 * Aura — connettore MCP per Claude (P-006): un solo strumento, «Aggiungi ad Aura», che scrive nella casella di Siri.
 * Parla le due epoche del protocollo, come prevede la specifica per un server «dual-era»:
 * - 2025-11-25, 2025-06-18 e 2025-03-26: si comincia con `initialize`;
 * - 2026-07-28: niente stretta di mano, versione e capacità in ogni richiesta (`_meta` e intestazioni).
 * In tutte e due niente sessioni (Mcp-Session-Id) e niente flussi: ogni POST riceve una risposta JSON.
 * Specifica: app-attivita/docs/connettore-claude.md.
 */
import { cleanText, json, randomToken, readBody } from './http.js';
import { linkFromRequest, unauthorized } from './oauth.js';
import { MCP_TEXTS } from './text.js';

export const MODERN_VERSIONS = ['2026-07-28'];
export const LEGACY_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'];
const ALL_VERSIONS = MODERN_VERSIONS.concat(LEGACY_VERSIONS);

export const MCP_LIMITS = {
  phrases: 10,        // attività per chiamata
  phraseLength: 200,  // caratteri di una frase
  perDay: 50,         // attività al giorno per dispositivo (giorno UTC), con tutti i suoi collegamenti
  totalPerDay: 1000,  // attività al giorno per tutto il server (variabile MAX_CLAUDE_PER_DAY): ~10.000 scritture D1
  body: 16 * 1024
};
const TOTAL = '*'; // riga del totale di tutti in claude_usage, come in assistant_usage

const META = {
  version: 'io.modelcontextprotocol/protocolVersion',
  capabilities: 'io.modelcontextprotocol/clientCapabilities',
  serverInfo: 'io.modelcontextprotocol/serverInfo'
};

const SERVER_INFO = { name: 'aura-tasks', title: 'Aura Tasks', version: '1.0.0' };
const CACHE = { ttlMs: 60 * 60 * 1000, cacheScope: 'public' }; // la lista è uguale per tutti

export const TOOL = {
  name: 'aggiungi_ad_aura',
  title: 'Aggiungi ad Aura',
  description: MCP_TEXTS.toolDescription,
  inputSchema: {
    type: 'object',
    properties: {
      attivita: {
        type: 'array',
        description: MCP_TEXTS.argDescription,
        items: { type: 'string', minLength: 1, maxLength: MCP_LIMITS.phraseLength },
        minItems: 1,
        maxItems: MCP_LIMITS.phrases
      }
    },
    required: ['attivita'],
    additionalProperties: false
  },
  annotations: { title: 'Aggiungi ad Aura', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
};

/**
 * POST /mcp (GET e DELETE: 405). Prima il token, poi il messaggio JSON-RPC.
 * `limits.inboxItems` = frasi in attesa per dispositivo, lo stesso tetto della casella di Siri.
 */
export async function handleMcp(request, env, deps, limits) {
  if (request.method !== 'POST') {
    const response = json({ error: 'Metodo non ammesso: il connettore usa solo POST' }, 405);
    response.headers.set('Allow', 'POST');
    return response;
  }
  const auth = await linkFromRequest(request, env, deps);
  if (!auth.link) return unauthorized(request, auth.presented);

  let message;
  try {
    message = JSON.parse(await readBody(request, MCP_LIMITS.body));
  } catch (err) {
    if (err && err.status === 413) return rpcError(null, -32600, 'Richiesta troppo grande', 413);
    return rpcError(null, -32700, 'JSON non valido', 400);
  }
  if (!message || typeof message !== 'object' || Array.isArray(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return rpcError(null, -32600, 'Richiesta JSON-RPC non valida', 400);
  }
  const context = { request, env, deps, link: auth.link, limits };
  return isModern(message, request) ? modern(message, context) : legacy(message, context);
}

/** Epoca della richiesta: `initialize` apre la vecchia; `_meta` con la versione, o l'intestazione nuova, la nuova. */
function isModern(message, request) {
  if (message.method === 'initialize') return false;
  const meta = message.params && message.params._meta;
  if (meta && typeof meta === 'object' && META.version in meta) return true;
  return MODERN_VERSIONS.includes((request.headers.get('MCP-Protocol-Version') || '').trim());
}

/* ---------- 2025-11-25 e precedenti ---------- */

async function legacy(message, context) {
  const header = (context.request.headers.get('MCP-Protocol-Version') || '').trim();
  // Dalla 2025-06-18 il client ripete la versione in ogni richiesta: una versione sconosciuta riceve 400.
  if (message.method !== 'initialize' && header && !LEGACY_VERSIONS.includes(header)) {
    return rpcError(idOf(message), -32600, 'Versione del protocollo non supportata', 400, { supported: ALL_VERSIONS, requested: header });
  }
  if (!('id' in message)) return accepted(); // notifiche (notifications/initialized, notifications/cancelled…)
  switch (message.method) {
    case 'initialize': {
      const requested = message.params && message.params.protocolVersion;
      return rpcResult(message.id, {
        protocolVersion: LEGACY_VERSIONS.includes(requested) ? requested : LEGACY_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: MCP_TEXTS.instructions
      });
    }
    case 'ping':
      return rpcResult(message.id, {});
    case 'tools/list':
      return rpcResult(message.id, { tools: [TOOL] });
    case 'tools/call':
      return callTool(message, context, false);
    default:
      return rpcError(message.id, -32601, 'Metodo sconosciuto: ' + String(message.method).slice(0, 64));
  }
}

/* ---------- 2026-07-28 ---------- */

async function modern(message, context) {
  const { request } = context;
  if (!('id' in message)) return accepted(); // questa versione non ha notifiche dal client su HTTP: si accettano e basta
  const params = message.params && typeof message.params === 'object' ? message.params : {};
  const meta = params._meta && typeof params._meta === 'object' ? params._meta : {};
  const version = meta[META.version];
  if (typeof version !== 'string') return rpcError(message.id, -32602, 'Manca ' + META.version + ' in _meta', 400);
  if (!MODERN_VERSIONS.includes(version)) {
    return rpcError(message.id, -32022, 'Unsupported protocol version', 400, { supported: ALL_VERSIONS, requested: version });
  }
  const capabilities = meta[META.capabilities];
  if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) {
    return rpcError(message.id, -32602, 'Manca ' + META.capabilities + ' in _meta', 400);
  }
  const mismatch = headerMismatch(request, message, version, params);
  if (mismatch) return rpcError(message.id, -32020, mismatch, 400);
  switch (message.method) {
    case 'server/discover':
      return rpcResult(message.id, {
        resultType: 'complete',
        supportedVersions: ALL_VERSIONS,
        capabilities: { tools: {} },
        instructions: MCP_TEXTS.instructions,
        ...CACHE,
        _meta: { [META.serverInfo]: SERVER_INFO }
      });
    case 'tools/list':
      return rpcResult(message.id, { resultType: 'complete', tools: [TOOL], ...CACHE, _meta: { [META.serverInfo]: SERVER_INFO } });
    case 'tools/call':
      return callTool(message, context, true);
    default:
      return rpcError(message.id, -32601, 'Method not found: ' + String(message.method).slice(0, 64), 404);
  }
}

/** Le intestazioni devono ripetere il corpo: MCP-Protocol-Version, Mcp-Method e, per tools/call, Mcp-Name. */
function headerMismatch(request, message, version, params) {
  const checks = [['MCP-Protocol-Version', version], ['Mcp-Method', message.method]];
  if (message.method === 'tools/call') checks.push(['Mcp-Name', typeof params.name === 'string' ? params.name : '']);
  for (const [name, expected] of checks) {
    const value = headerValue(request.headers.get(name));
    if (value !== expected) {
      return 'Header mismatch: ' + name + " header value '" + String(value === null ? '' : value).slice(0, 64) +
        "' does not match body value '" + String(expected).slice(0, 64) + "'";
    }
  }
  return null;
}

/** Valore di un'intestazione, decodificato se è nella forma «=?base64?…?=». null se manca o non si decodifica. */
export function headerValue(raw) {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  const match = /^=\?base64\?([A-Za-z0-9+/]*={0,2})\?=$/.exec(value);
  if (!match) return value;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(match[1]), char => char.charCodeAt(0)));
  } catch (err) {
    return null;
  }
}

/* ---------- Lo strumento ---------- */

async function callTool(message, context, modernEra) {
  const params = message.params && typeof message.params === 'object' ? message.params : {};
  if (params.name !== TOOL.name) return rpcError(message.id, -32602, 'Unknown tool: ' + String(params.name).slice(0, 64));
  const outcome = await addPhrases(params.arguments, context);
  const result = { content: [{ type: 'text', text: outcome.text }], isError: !outcome.ok };
  return rpcResult(message.id, modernEra ? { resultType: 'complete', ...result } : result);
}

/**
 * Mette le frasi nella casella del dispositivo collegato, con id «claude:…» (i due punti non ci sono mai negli
 * id di Siri). Frasi pulite come quelle di Siri, al massimo 10 per volta. Tutto o niente: la stessa INSERT che
 * scrive controlla i tre limiti (casella, giorno del dispositivo, giorno del server), così due chiamate insieme
 * non li superano; i conteggi crescono solo delle frasi scritte davvero.
 */
export async function addPhrases(args, { env, deps, link, limits }) {
  const list = args && typeof args === 'object' && Array.isArray(args.attivita) ? args.attivita : null;
  if (!list || !list.length) return { ok: false, text: MCP_TEXTS.none };
  if (list.length > MCP_LIMITS.phrases) return { ok: false, text: MCP_TEXTS.tooMany };
  const phrases = [];
  for (const item of list) {
    const text = cleanText(item);
    if (!text) return { ok: false, text: MCP_TEXTS.empty };
    if (text.length > MCP_LIMITS.phraseLength) return { ok: false, text: MCP_TEXTS.tooLong };
    phrases.push(text);
  }
  const day = utcDay(deps.now);
  const caps = { inbox: limits.inboxItems, device: MCP_LIMITS.perDay, total: totalPerDay(env) };
  // Prima una lettura, per dire a Claude quale limite manca; la scrittura ricontrolla comunque tutto.
  const before = limitText(await readCounts(env, link.deviceId, day), phrases.length, caps);
  if (before) return { ok: false, text: before };

  const n = phrases.length;
  const ids = phrases.map(() => 'claude:' + randomToken(12));
  const idList = JSON.stringify(ids);
  const [inserted] = await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO inbox (id, device_id, text, created_at) SELECT column1, ?, column2, ? FROM (VALUES ' +
      phrases.map(() => '(?, ?)').join(', ') + ') ' +
      'WHERE (SELECT COUNT(*) FROM inbox WHERE device_id = ?) + ? <= ? ' +
      'AND COALESCE((SELECT added FROM claude_usage WHERE device_id = ? AND day = ?), 0) + ? <= ? ' +
      'AND COALESCE((SELECT added FROM claude_usage WHERE device_id = ? AND day = ?), 0) + ? <= ?'
    ).bind(link.deviceId, deps.now, ...ids.flatMap((id, index) => [id, phrases[index]]),
      link.deviceId, n, caps.inbox, link.deviceId, day, n, caps.device, TOTAL, day, n, caps.total),
    // Conteggi del dispositivo e del totale: crescono di quante frasi con questi id sono entrate (0 o n).
    env.DB.prepare(
      'INSERT INTO claude_usage (device_id, day, added) SELECT who.value, ?, written.n ' +
      'FROM json_each(?) AS who, (SELECT COUNT(*) AS n FROM inbox WHERE id IN (SELECT value FROM json_each(?))) AS written ' +
      'WHERE written.n > 0 ON CONFLICT (device_id, day) DO UPDATE SET added = added + excluded.added'
    ).bind(day, JSON.stringify([link.deviceId, TOTAL]), idList),
    env.DB.prepare('UPDATE claude_links SET used_at = ? WHERE id = ? AND EXISTS (SELECT 1 FROM inbox WHERE id = ?)')
      .bind(deps.now, link.id, ids[0])
  ]);
  if (inserted.meta.changes === n) return { ok: true, text: MCP_TEXTS.added(n) };
  // Un'altra chiamata è arrivata prima: niente è stato scritto.
  return { ok: false, text: limitText(await readCounts(env, link.deviceId, day), n, caps) || MCP_TEXTS.retry };
}

/** Frasi in attesa del dispositivo, e frasi di Claude di oggi: sue e di tutti. */
async function readCounts(env, deviceId, day) {
  const row = await env.DB.prepare(
    'SELECT (SELECT COUNT(*) FROM inbox WHERE device_id = ?) AS pending, ' +
    'COALESCE((SELECT added FROM claude_usage WHERE device_id = ? AND day = ?), 0) AS device, ' +
    'COALESCE((SELECT added FROM claude_usage WHERE device_id = ? AND day = ?), 0) AS total'
  ).bind(deviceId, deviceId, day, TOTAL, day).first();
  return { pending: Number(row.pending), device: Number(row.device), total: Number(row.total) };
}

/** Il primo limite che `count` frasi in più supererebbero, come testo per Claude; null se c'è posto. */
function limitText(counts, count, caps) {
  if (counts.device + count > caps.device) return MCP_TEXTS.daily(Math.max(0, caps.device - counts.device));
  if (counts.total + count > caps.total) return MCP_TEXTS.allToday(Math.max(0, caps.total - counts.total));
  if (counts.pending + count > caps.inbox) return MCP_TEXTS.full(Math.max(0, caps.inbox - counts.pending));
  return null;
}

function totalPerDay(env) {
  const value = Math.floor(Number(env.MAX_CLAUDE_PER_DAY));
  return value > 0 ? value : MCP_LIMITS.totalPerDay;
}

const utcDay = now => new Date(now).toISOString().slice(0, 10);

/** «Scollega questo dispositivo»: via i suoi conteggi. Il totale di tutti resta, come per l'assistente. */
export function forgetClaudeUsage(env, deviceId) {
  return env.DB.prepare('DELETE FROM claude_usage WHERE device_id = ?').bind(deviceId);
}

/** Pulizia oraria: i conteggi di più di due giorni fa. */
export function pruneClaudeUsage(env, now) {
  return env.DB.prepare('DELETE FROM claude_usage WHERE day < ?').bind(utcDay(now - 2 * 24 * 60 * 60 * 1000));
}

/* ---------- JSON-RPC ---------- */

const idOf = message => (message && 'id' in message ? message.id : null);

function rpcResult(id, result) {
  return json({ jsonrpc: '2.0', id, result });
}

function rpcError(id, code, text, status = 200, data) {
  const error = { code, message: text };
  if (data) error.data = data;
  return json({ jsonrpc: '2.0', id: id === undefined ? null : id, error }, status);
}

function accepted() {
  return new Response(null, { status: 202, headers: { 'Cache-Control': 'no-store' } });
}
