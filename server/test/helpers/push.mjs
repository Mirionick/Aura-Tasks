/*
 * Strumenti di prova per il Web Push: chiavi VAPID, una sottoscrizione finta con la sua chiave privata
 * e la decifratura dei messaggi (fatta qui in modo indipendente, come farebbe il telefono).
 */
import { base64urlDecode, base64urlEncode } from '../../src/webpush.js';

const encoder = new TextEncoder();

/** Chiavi VAPID nuove, nel formato dei secrets (base64url). */
export async function createVapidKeys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicKey: base64urlEncode(raw), privateKey: jwk.d };
}

/** Sottoscrizione come la crea il browser (toJSON), più la chiave privata che nel browser resta segreta. */
export async function createSubscription(endpoint) {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const p256dh = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { endpoint, keys: { p256dh: base64urlEncode(p256dh), auth: base64urlEncode(auth) }, privateKey: pair.privateKey };
}

/** Chiave privata ECDH da `d` (32 byte) e dalla chiave pubblica non compressa, entrambe in base64url. */
export function importPrivateKey(d, publicKey) {
  const raw = base64urlDecode(publicKey);
  const jwk = { kty: 'EC', crv: 'P-256', d, x: base64urlEncode(raw.subarray(1, 33)), y: base64urlEncode(raw.subarray(33)) };
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
}

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

/** Decifra un corpo aes128gcm (RFC 8291) con la chiave privata della sottoscrizione. Restituisce il testo. */
export async function decryptPayload(body, subscription) {
  const bytes = new Uint8Array(body);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const salt = bytes.slice(0, 16);
  const recordSize = view.getUint32(16);
  const idLength = bytes[20];
  const asPublic = bytes.slice(21, 21 + idLength);
  const ciphertext = bytes.slice(21 + idLength);
  if (recordSize < 18 || ciphertext.length > recordSize) throw new Error('Record non valido');

  const uaPublic = base64urlDecode(subscription.keys.p256dh);
  const auth = base64urlDecode(subscription.keys.auth);
  const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, subscription.privateKey, 256));
  const keyInfo = new Uint8Array([...encoder.encode('WebPush: info\0'), ...uaPublic, ...asPublic]);
  const ikm = await hkdf(auth, secret, keyInfo, 32);
  const cek = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const padded = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ciphertext));

  let end = padded.length - 1;
  while (end >= 0 && padded[end] === 0) end--;
  if (padded[end] !== 2) throw new Error('Delimitatore di fine record mancante');
  return new TextDecoder().decode(padded.slice(0, end));
}
