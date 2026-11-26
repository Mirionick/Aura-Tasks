/*
 * Aura — parti comuni delle richieste: errori con il loro stato HTTP, lettura del corpo con un limite,
 * risposte JSON e in testo semplice, pulizia dei testi, impronte e valori casuali.
 * Le usano index.js, assistant.js, oauth.js e mcp.js.
 */
import { base64urlEncode } from './webpush.js';

/** Errore con il suo stato HTTP: il messaggio arriva all'app. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Una riga di testo pulita: niente caratteri di controllo, spazi compressi. */
export function cleanText(value) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFC').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function checkLength(request, max, message) {
  if (Number(request.headers.get('Content-Length')) > max) throw new HttpError(413, message || 'Richiesta troppo grande');
}

export async function readBody(request, max, message) {
  checkLength(request, max, message);
  const raw = await request.text();
  if (raw.length > max) throw new HttpError(413, message || 'Richiesta troppo grande');
  return raw;
}

export async function readJson(request, max) {
  const raw = await readBody(request, max);
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new HttpError(400, 'Dati non validi');
  }
}

const COMMON_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...COMMON_HEADERS, 'Content-Type': 'application/json; charset=utf-8' } });
}

export function plain(text, status = 200) {
  return new Response(text, { status, headers: { ...COMMON_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' } });
}

/** Impronta SHA-256 di un testo, in esadecimale: il server conserva questa, mai codici o token. */
export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Valore casuale in base64url, da `bytes` byte del generatore crittografico (32 byte = 43 caratteri). */
export function randomToken(bytes = 32) {
  return base64urlEncode(crypto.getRandomValues(new Uint8Array(bytes)));
}
