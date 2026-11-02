/* Test della cifratura Web Push (RFC 8291) e della firma VAPID (RFC 8292). Si eseguono con `npm test`. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  base64urlDecode, base64urlEncode, createSigner, encryptPayload, importVapidKeys, vapidAuthorization
} from '../src/webpush.js';
import { createSubscription, createVapidKeys, decryptPayload, importPrivateKey } from './helpers/push.mjs';

// Esempio della RFC 8291 (sezione 5 e appendice A).
const RFC = {
  plaintext: 'When I grow up, I want to be a watermelon',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  uaPrivate: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  body: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_' +
    'yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN'
};
const NOW = Date.UTC(2026, 9, 29, 8, 0); // giovedì 29/10/2026, 9:00 in Italia
const decodeJson = part => JSON.parse(new TextDecoder().decode(base64urlDecode(part)));

test('base64url: andata e ritorno, senza "=" finali', () => {
  const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
  const text = base64urlEncode(bytes);
  assert.equal(text, 'AAEC-vv8_f7_');
  assert.deepEqual(base64urlDecode(text), bytes);
  assert.deepEqual(base64urlDecode('AAEC+vv8/f7/'), bytes, 'accetta anche il base64 normale');
  assert.throws(() => base64urlDecode('a$b'));
});

test('cifratura aes128gcm: uguale byte per byte all\'esempio della RFC 8291', async () => {
  const serverKeys = {
    publicKey: await crypto.subtle.importKey('raw', base64urlDecode(RFC.asPublic), { name: 'ECDH', namedCurve: 'P-256' }, true, []),
    privateKey: await importPrivateKey(RFC.asPrivate, RFC.asPublic)
  };
  const body = await encryptPayload(RFC.plaintext, RFC.uaPublic, RFC.auth, { salt: base64urlDecode(RFC.salt), serverKeys });
  assert.equal(base64urlEncode(body), RFC.body);
  // 86 byte di intestazione + 41 di testo + 1 delimitatore + 16 di tag. (L'esempio HTTP della RFC dice
  // "Content-Length: 145", ma il corpo che mostra, 192 caratteri base64url, è di 144 byte.)
  assert.equal(body.length, 144);
});

test('la decifratura di prova riporta in chiaro l\'esempio della RFC', async () => {
  const subscription = { keys: { p256dh: RFC.uaPublic, auth: RFC.auth }, privateKey: await importPrivateKey(RFC.uaPrivate, RFC.uaPublic) };
  assert.equal(await decryptPayload(base64urlDecode(RFC.body), subscription), RFC.plaintext);
});

test('ogni messaggio ha salt e chiave del server nuovi, e si decifra', async () => {
  const subscription = await createSubscription('https://fcm.googleapis.com/fcm/send/prova');
  const a = await encryptPayload('Dentista — alle 10:00 ✓', subscription.keys.p256dh, subscription.keys.auth);
  const b = await encryptPayload('Dentista — alle 10:00 ✓', subscription.keys.p256dh, subscription.keys.auth);
  assert.notDeepEqual(a.slice(0, 16), b.slice(0, 16), 'salt');
  assert.notDeepEqual(a.slice(21, 86), b.slice(21, 86), 'chiave del server');
  assert.equal(await decryptPayload(a, subscription), 'Dentista — alle 10:00 ✓');
  assert.equal(await decryptPayload(b, subscription), 'Dentista — alle 10:00 ✓');
});

test('chiavi della sottoscrizione non valide o messaggio troppo lungo: errore', async () => {
  await assert.rejects(encryptPayload('x', 'BCVxsr7N', RFC.auth));
  await assert.rejects(encryptPayload('x', RFC.uaPublic, 'BTBZMqHH'));
  await assert.rejects(encryptPayload('x'.repeat(5000), RFC.uaPublic, RFC.auth));
});

test('VAPID: JWT ES256 con aud, exp entro 24 ore e sub, firma verificabile con la chiave pubblica', async () => {
  const keys = await createVapidKeys();
  const vapid = await importVapidKeys(keys.publicKey, keys.privateKey, 'https://example.test/app/');
  const header = await vapidAuthorization('https://web.push.apple.com/QGuQ-prova?x=1', vapid, NOW);
  const match = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(header);
  assert.ok(match, header);
  assert.deepEqual(decodeJson(match[1]), { typ: 'JWT', alg: 'ES256' });
  const claims = decodeJson(match[2]);
  assert.equal(claims.aud, 'https://web.push.apple.com');
  assert.equal(claims.sub, 'https://example.test/app/');
  assert.ok(claims.exp > NOW / 1000 && claims.exp - NOW / 1000 <= 24 * 3600, 'exp entro 24 ore');
  assert.equal(match[4], keys.publicKey);
  const signature = base64urlDecode(match[3]);
  assert.equal(signature.length, 64, 'firma nel formato JWS (r e s)');
  const publicKey = await crypto.subtle.importKey('raw', base64urlDecode(keys.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, signature, new TextEncoder().encode(match[1] + '.' + match[2]));
  assert.ok(valid, 'firma valida');
});

test('VAPID: chiavi mancanti o non valide → null, senza errori', async () => {
  const keys = await createVapidKeys();
  assert.equal(await importVapidKeys('', keys.privateKey, 'https://example.test/'), null);
  assert.equal(await importVapidKeys(keys.publicKey, '', 'https://example.test/'), null);
  assert.equal(await importVapidKeys(keys.publicKey, keys.privateKey, ''), null);
  assert.equal(await importVapidKeys('abc', keys.privateKey, 'https://example.test/'), null);
  assert.equal(await importVapidKeys(keys.publicKey, 'non-una-chiave', 'https://example.test/'), null);
});

test('una firma per servizio push, riusata nello stesso giro', async () => {
  const keys = await createVapidKeys();
  const sign = createSigner(await importVapidKeys(keys.publicKey, keys.privateKey, 'https://example.test/'), NOW);
  const apple1 = await sign('https://web.push.apple.com/uno');
  const apple2 = await sign('https://web.push.apple.com/due');
  const google = await sign('https://fcm.googleapis.com/fcm/send/tre');
  assert.equal(apple1, apple2);
  assert.notEqual(apple1, google);
  assert.equal(decodeJson(google.slice(8).split('.')[1]).aud, 'https://fcm.googleapis.com');
});
