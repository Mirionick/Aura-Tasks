/*
 * Prova del connettore per Claude con i client MCP ufficiali (P-006, passo 6.1). Non fa parte di `npm test`
 * né della CI: i due SDK non sono dipendenze del server e si installano solo per questa prova, senza salvarli.
 *
 *   npm install --no-save @modelcontextprotocol/client@2.4.0 @modelcontextprotocol/sdk@1.32.2
 *   node scripts/prova-connettore.mjs
 *
 * Il server gira in memoria, con il database finto dei test (SQLite vero): ogni fetch dei client va dritta a
 * handle(), senza rete e senza toccare Cloudflare. La «persona» apre la pagina di Aura, scrive il codice che
 * l'app ha chiesto al server e segue il ritorno a Claude. Non stampa mai token né codici.
 */
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { handle } from '../src/index.js';
import { createD1 } from '../test/helpers/d1.mjs';

let v2;
let v1Client;
let v1Transport;
try {
  v2 = await import('@modelcontextprotocol/client');
  ({ Client: v1Client } = await import('@modelcontextprotocol/sdk/client/index.js'));
  ({ StreamableHTTPClientTransport: v1Transport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js'));
} catch (err) {
  console.error('Mancano i client MCP. Prima: npm install --no-save @modelcontextprotocol/client@2.4.0 @modelcontextprotocol/sdk@1.32.2');
  process.exit(1);
}
const { Client, StreamableHTTPClientTransport, UnauthorizedError } = v2;

const BASE = 'https://aura.prova';
const MCP_URL = new URL(BASE + '/mcp');
const APP = 'https://app.prova';
const DEVICE = 'dispositivoDiProva_0123456789abcdef';
const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';
const CIMD = 'https://claude.ai/oauth/mcp-oauth-client-metadata';

const env = { DB: createD1(fileURLToPath(new URL('../schema.sql', import.meta.url))), ALLOWED_ORIGINS: APP };
const deps = { now: Date.UTC(2026, 10, 23, 15, 0), fetch: async () => { throw new Error('nessuna chiamata esterna'); } };
const seen = [];

/** fetch dei client: niente rete, la richiesta va dritta al Worker. */
async function serverFetch(input, init) {
  const request = new Request(input, init);
  const url = new URL(request.url);
  assert.equal(url.origin, BASE, 'il client prova a uscire: ' + url.origin);
  const response = await handle(request, env, deps);
  const method = request.headers.get('mcp-method');
  seen.push(request.method + ' ' + url.pathname + ' ' + response.status + (method ? ' [' + method + ']' : ''));
  return response;
}

/** L'app di Aura, con il codice del dispositivo. */
async function app(method, path) {
  const response = await handle(new Request(BASE + path, { method, headers: { Authorization: 'Bearer ' + DEVICE, Origin: APP } }), env, deps);
  return { status: response.status, data: await response.json().catch(() => null) };
}

/** Il client OAuth di Claude, in memoria: identità pubblicata (CIMD) oppure registrazione automatica (DCR). */
class Provider {
  constructor({ cimd }) { this.cimd = cimd; this.authUrls = []; }
  get redirectUrl() { return REDIRECT; }
  get clientMetadataUrl() { return this.cimd ? CIMD : undefined; }
  get clientMetadata() {
    return { client_name: 'Claude', redirect_uris: [REDIRECT], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' };
  }
  clientInformation() { return this.client; }
  saveClientInformation(info) { this.client = info; }
  tokens() { return this.saved; }
  saveTokens(tokens) { this.saved = tokens; }
  redirectToAuthorization(url) { this.authUrls.push(new URL(url)); }
  saveCodeVerifier(verifier) { this.verifier = verifier; }
  codeVerifier() { return this.verifier; }
}

const unescapeHtml = text => text.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** La persona: apre la pagina di Aura, legge il modulo, scrive il codice come lo scriverebbe a mano, segue il 303. */
async function personTypesCode(authUrl) {
  assert.equal(authUrl.origin + authUrl.pathname, BASE + '/oauth/authorize');
  const page = await handle(new Request(authUrl), env, deps);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('Content-Security-Policy'), /form-action 'self' https:\/\/claude\.ai/);
  const form = new URLSearchParams();
  for (const match of (await page.text()).matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)">/g)) form.append(match[1], unescapeHtml(match[2]));
  const pair = await app('POST', '/api/claude/code');
  assert.equal(pair.status, 201);
  form.set('codice', pair.data.code.slice(0, 4) + ' ' + pair.data.code.slice(4).toLowerCase());
  const submit = await handle(new Request(BASE + '/oauth/authorize', {
    method: 'POST', body: form.toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: BASE }
  }), env, deps);
  assert.equal(submit.status, 303);
  const back = new URL(submit.headers.get('Location'));
  assert.equal(back.origin + back.pathname, REDIRECT);
  assert.equal(back.searchParams.get('state'), authUrl.searchParams.get('state'));
  assert.equal(back.searchParams.get('iss'), BASE);
  return back.searchParams;
}

/** Collega un client v2 da zero: 401, scoperta, pagina, finishAuth, poi di nuovo connect. */
async function linkV2(provider, versionNegotiation) {
  const options = versionNegotiation ? { versionNegotiation } : {};
  const first = new StreamableHTTPClientTransport(MCP_URL, { fetch: serverFetch, authProvider: provider });
  await assert.rejects(new Client({ name: 'prova', version: '1.0.0' }, options).connect(first),
    error => error instanceof UnauthorizedError || /authoriz/i.test(String(error && error.message)));
  assert.equal(provider.authUrls.length, 1, 'il client doveva aprire la pagina di Aura');
  const authUrl = provider.authUrls[0];
  assert.equal(authUrl.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(authUrl.searchParams.get('resource'), MCP_URL.href);
  await first.finishAuth(await personTypesCode(authUrl));
  await first.close().catch(() => {});
  const client = new Client({ name: 'prova', version: '1.0.0' }, options);
  await client.connect(new StreamableHTTPClientTransport(MCP_URL, { fetch: serverFetch, authProvider: provider }));
  return { client, authUrl };
}

async function useTool(client, phrases) {
  assert.deepEqual((await client.listTools()).tools.map(tool => tool.name), ['aggiungi_ad_aura']);
  const result = await client.callTool({ name: 'aggiungi_ad_aura', arguments: { attivita: phrases } });
  assert.equal(result.isError, false, JSON.stringify(result));
  return result;
}

const report = [];
async function step(name, fn) {
  const from = seen.length;
  await fn();
  report.push('✓ ' + name + '\n    ' + seen.slice(from).join('\n    '));
}

// Il client v2 avvisa che il provider di prova non salva lo stato della scoperta: qui non serve.
const warn = console.warn;
console.warn = (...args) => { if (!String(args[0]).includes('discoveryState')) warn(...args); };

await app('POST', '/api/devices');

await step('v2, versione 2026-07-28 fissata, identità pubblicata di Claude (CIMD), rinnovo dopo un 401', async () => {
  const provider = new Provider({ cimd: true });
  const { client, authUrl } = await linkV2(provider, { mode: { pin: '2026-07-28' } });
  assert.equal(authUrl.searchParams.get('client_id'), CIMD);
  assert.match((await useTool(client, ['Chiamare il dentista', 'Comprare il latte'])).content[0].text, /2 attività/);
  const oldAccess = provider.saved.access_token;
  deps.now += 61 * 60 * 1000; // il token d'accesso è scaduto: 401, il client rinnova e riprova
  await useTool(client, ['Dopo il rinnovo']);
  assert.notEqual(provider.saved.access_token, oldAccess);
  await client.close();
});

await step('v2, negoziazione automatica (server/discover), registrazione automatica (DCR)', async () => {
  const provider = new Provider({ cimd: false });
  const { client, authUrl } = await linkV2(provider, { mode: 'auto' });
  assert.match(authUrl.searchParams.get('client_id'), /^aura-/);
  await useTool(client, ['Frase dalla negoziazione automatica']);
  await client.close();
});

await step('v2, modo predefinito (initialize, 2025-11-25)', async () => {
  const { client } = await linkV2(new Provider({ cimd: true }));
  await useTool(client, ['Frase dal modo predefinito']);
  await client.close();
});

await step('v1 (@modelcontextprotocol/sdk), initialize 2025-11-25, con un token appena ottenuto', async () => {
  const provider = new Provider({ cimd: true });
  await (await linkV2(provider)).client.close();
  const transport = new v1Transport(MCP_URL, { fetch: serverFetch, requestInit: { headers: { Authorization: 'Bearer ' + provider.saved.access_token } } });
  const client = new v1Client({ name: 'prova-v1', version: '1.0.0' });
  await client.connect(transport);
  assert.equal(transport.protocolVersion, '2025-11-25');
  assert.equal((await client.listTools()).tools[0].name, 'aggiungi_ad_aura');
  assert.equal((await client.callTool({ name: 'aggiungi_ad_aura', arguments: { attivita: ['Frase dal client v1'] } })).isError, false);
  assert.equal((await client.callTool({ name: 'aggiungi_ad_aura', arguments: { attivita: [] } })).isError, true);
  await client.close();
});

const inbox = await app('GET', '/api/inbox');
const fromClaude = inbox.data.items.filter(item => item.source === 'claude').map(item => item.text);
assert.deepEqual(fromClaude.sort(), ['Chiamare il dentista', 'Comprare il latte', 'Dopo il rinnovo', 'Frase dal client v1',
  'Frase dal modo predefinito', 'Frase dalla negoziazione automatica'].sort());
const status = await app('GET', '/api/claude');
assert.equal(status.data.links.length, 3);
report.push('✓ casella di Aura: ' + fromClaude.length + ' frasi «Da Claude»; collegamenti attivi: ' + status.data.links.length + ' (al massimo 3)');
console.log(report.join('\n'));
