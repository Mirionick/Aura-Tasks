/*
 * Crea le chiavi VAPID (P-256) del server di Aura.
 *
 *   npm run vapid                 le salva nei secrets di Cloudflare (dopo `npx wrangler login` e il primo deploy)
 *   npm run vapid -- --force      le sostituisce: le notifiche si fermano finché ogni dispositivo non riattiva i promemoria
 *   npm run vapid -- --local      scrive chiavi usa e getta in .dev.vars, solo per le prove con `wrangler dev`
 *
 * La chiave privata non viene mai stampata né salvata su disco (tranne quella usa e getta di --local, in .dev.vars,
 * che Git ignora): arriva a Wrangler attraverso lo standard input.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const publicKey = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64url');
const privateKey = (await crypto.subtle.exportKey('jwk', pair.privateKey)).d;

if (args.has('--local')) {
  const file = join(root, '.dev.vars');
  if (existsSync(file) && !args.has('--force')) {
    console.log('.dev.vars esiste già: lo lascio com\'è (con --force lo rifaccio).');
    process.exit(0);
  }
  writeFileSync(file, [
    '# Solo per `wrangler dev` su questo computer: chiavi usa e getta, mai usate dal server pubblicato.',
    '# Git ignora questo file (.gitignore).',
    'VAPID_PUBLIC_KEY=' + publicKey,
    'VAPID_PRIVATE_KEY=' + privateKey,
    'ALLOWED_ORIGINS=http://localhost:8765',
    'PUSH_TEST_ORIGIN=http://localhost:9999',
    ''
  ].join('\n'));
  console.log('Creato .dev.vars con chiavi di prova.');
  process.exit(0);
}

/** Esegue Wrangler; l'eventuale `input` arriva dallo standard input, quindi non compare tra gli argomenti. */
function wrangler(commandArgs, input) {
  const options = { cwd: root, input, encoding: 'utf8', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } };
  // Su Windows npx è un file .cmd e passa dalla shell: il comando è composto solo da parole fisse, scritte in questo file.
  const result = process.platform === 'win32'
    ? spawnSync(['npx', 'wrangler', ...commandArgs].join(' '), { ...options, shell: true })
    : spawnSync('npx', ['wrangler', ...commandArgs], options);
  // Rete di sicurezza: la chiave privata non deve comparire in nessun messaggio.
  const hide = text => String(text || '').split(privateKey).join('[nascosta]');
  return { status: result.status, stdout: hide(result.stdout), stderr: hide(result.stderr) };
}

const list = wrangler(['secret', 'list']);
if (list.status !== 0) {
  console.error('Non riesco a leggere i secrets del Worker "aura". Hai fatto `npx wrangler login` e il primo `npx wrangler deploy`?');
  console.error(list.stderr);
  process.exit(1);
}
if (/VAPID_PRIVATE_KEY/.test(list.stdout) && !args.has('--force')) {
  console.error('Le chiavi VAPID esistono già. Sostituirle ferma le notifiche finché ogni dispositivo non riattiva i promemoria.');
  console.error('Se è proprio quello che vuoi: npm run vapid -- --force');
  process.exit(1);
}

const saved = wrangler(['secret', 'bulk'], JSON.stringify({ VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey }));
if (saved.status !== 0) {
  console.error('Salvataggio delle chiavi non riuscito.');
  console.error(saved.stderr || saved.stdout);
  process.exit(1);
}
console.log('Chiavi VAPID salvate nei secrets di Cloudflare.');
console.log('Chiave pubblica (non è segreta): ' + publicKey);
