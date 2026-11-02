/*
 * Web Push senza dipendenze, solo con WebCrypto (la stessa API in Cloudflare Workers, Node e browser):
 * - cifratura del messaggio "aes128gcm" (RFC 8291, con il formato della RFC 8188);
 * - firma VAPID (RFC 8292) con ES256.
 * I test la confrontano byte per byte con l'esempio della RFC 8291 (appendice A).
 */

const encoder = new TextEncoder();
const RECORD_SIZE = 4096;
const JWT_HOURS = 12; // i servizi push accettano al massimo 24 ore
const SEND_TIMEOUT_MS = 10 * 1000;

/** Byte → base64url senza "=" finali. */
export function base64urlEncode(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** base64url (va bene anche il base64 normale, con o senza "=") → byte. Lancia un errore se il testo non è valido. */
export function base64urlDecode(text) {
  const base64 = String(text).replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** true se `bytes` è una chiave pubblica P-256 non compressa: 65 byte che iniziano con 0x04. */
export function isUncompressedKey(bytes) {
  return bytes.length === 65 && bytes[0] === 4;
}

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

/**
 * Cifra `payload` (testo) per una sottoscrizione: `p256dh` e `auth` in base64url, come in PushSubscription.toJSON().
 * Restituisce il corpo da inviare: intestazione aes128gcm seguita dal testo cifrato.
 * `options.salt` e `options.serverKeys` servono solo ai test: di norma sono casuali e nuovi per ogni messaggio.
 */
export async function encryptPayload(payload, p256dh, auth, options = {}) {
  const uaPublic = base64urlDecode(p256dh);
  const authSecret = base64urlDecode(auth);
  if (!isUncompressedKey(uaPublic) || authSecret.length !== 16) throw new Error('Chiavi della sottoscrizione non valide');

  const salt = options.salt || crypto.getRandomValues(new Uint8Array(16));
  const serverKeys = options.serverKeys || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeys.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, serverKeys.privateKey, 256));

  // RFC 8291, sezione 3.4: prima si combinano il segreto ECDH e "auth", poi si ricavano chiave e nonce del contenuto.
  const ikm = await hkdf(authSecret, ecdhSecret, concat(encoder.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12);

  // Un solo record: il testo seguito dal delimitatore 0x02 ("ultimo record"), senza altro riempimento.
  const plaintext = concat(encoder.encode(payload), new Uint8Array([2]));
  if (plaintext.length + 16 > RECORD_SIZE) throw new Error('Messaggio troppo lungo');
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext));

  // Intestazione: salt (16) | dimensione del record (4) | lunghezza dell'id (1) | id = chiave pubblica del server (65)
  const header = new Uint8Array(21 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, ciphertext);
}

/**
 * Prepara le chiavi VAPID lette dai secrets: pubblica (65 byte) e privata (32 byte), in base64url.
 * Restituisce null se mancano o non sono valide.
 */
export async function importVapidKeys(publicKey, privateKey, subject) {
  if (!publicKey || !privateKey || !subject) return null;
  try {
    const raw = base64urlDecode(publicKey);
    if (!isUncompressedKey(raw)) return null;
    const jwk = { kty: 'EC', crv: 'P-256', d: privateKey, x: base64urlEncode(raw.subarray(1, 33)), y: base64urlEncode(raw.subarray(33)) };
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    return { publicKey: base64urlEncode(raw), privateKey: key, subject };
  } catch (err) {
    return null;
  }
}

const JWT_HEADER = base64urlEncode(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));

/** Intestazione "Authorization" VAPID per il servizio push dell'endpoint. `now` in millisecondi. */
export async function vapidAuthorization(endpoint, vapid, now) {
  const claims = { aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + JWT_HOURS * 3600, sub: vapid.subject };
  const unsigned = JWT_HEADER + '.' + base64urlEncode(encoder.encode(JSON.stringify(claims)));
  // WebCrypto restituisce la firma ECDSA già nel formato dei JWT (r e s concatenati, 64 byte).
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, vapid.privateKey, encoder.encode(unsigned));
  return 'vapid t=' + unsigned + '.' + base64urlEncode(new Uint8Array(signature)) + ', k=' + vapid.publicKey;
}

/** Firma un JWT per ogni servizio push (origine dell'endpoint) e lo riusa: una sola firma per giro del Cron. */
export function createSigner(vapid, now) {
  const cache = new Map();
  return endpoint => {
    const audience = new URL(endpoint).origin;
    if (!cache.has(audience)) cache.set(audience, vapidAuthorization(endpoint, vapid, now));
    return cache.get(audience);
  };
}

/**
 * Invia un messaggio (oggetto JSON) a una sottoscrizione { endpoint, p256dh, auth }.
 * Restituisce { status, reason }: status 0 se il servizio non risponde. Non lancia errori.
 */
export async function sendPush(subscription, message, sign, options) {
  try {
    const body = await encryptPayload(JSON.stringify(message), subscription.p256dh, subscription.auth);
    const response = await options.fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: await sign(subscription.endpoint),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(options.ttl),
        Urgency: 'high'
      },
      body,
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS)
    });
    const text = await response.text().catch(() => '');
    return { status: response.status, reason: response.ok ? '' : text.slice(0, 200) };
  } catch (err) {
    return { status: 0, reason: err && err.name === 'TimeoutError' ? 'Nessuna risposta dal servizio push' : 'Invio non riuscito' };
  }
}
