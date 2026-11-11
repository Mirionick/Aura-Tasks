/*
 * Test dell'assistente: trascrizione e risposte, con l'SQL vero (SQLite in memoria) e un'IA finta al posto di
 * Workers AI, che registra che cosa riceve. Non consumano quota.
 * Adesso fisso: giovedì 29/10/2026 alle 9:00 in Italia (le 8:00 UTC).
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ASSISTANT_LIMITS, DEFAULT_MODEL, MODELS, WHISPER, audioNeurons, audioType, buildCalendar, cleanChatInput, cleanTranscript,
  neuronsFor, parseReply, replyText, secondsToUtcMidnight, tokensOf, utcDay
} from '../src/assistant.js';
import { LIMITS, handle, runCron } from '../src/index.js';
import { createD1 } from './helpers/d1.mjs';

const SCHEMA = fileURLToPath(new URL('../schema.sql', import.meta.url));
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 29, 8, 0);
const APP = 'https://mirionick.github.io';
const CODE_A = 'codiceDiProvaA_0123456789abcdefXYZ';
const CODE_B = 'codiceDiProvaB_0123456789abcdefXYZ';
const LLAMA = '@cf/meta/llama-4-scout-17b-16e-instruct';
const MISTRAL = '@cf/mistralai/mistral-small-3.1-24b-instruct';
const AUDIO = { type: 'text/plain', headers: { 'X-Audio-Type': 'audio/mp4' } };

/** Risposta del modello, come la dà Workers AI: testo JSON più i token usati. */
const modelReply = (reply, usage = { prompt_tokens: 1000, completion_tokens: 150 }) => ({ response: JSON.stringify(reply), usage });
const EMPTY_REPLY = { say: 'Va bene.', minutes: 0, energy: 'none', actions: [] };

/** Server nuovo, con database vuoto, orologio fermo e un'IA finta che registra modello e ingresso di ogni chiamata. */
function setup() {
  const calls = [];
  let answer = () => modelReply(EMPTY_REPLY);
  const env = {
    DB: createD1(SCHEMA),
    ALLOWED_ORIGINS: APP,
    AI: {
      async run(model, input) {
        calls.push({ model, input });
        return answer(model, input);
      }
    }
  };
  const deps = { now: NOW, fetch: async () => new Response('') };
  async function call(method, path, { code, body, type, origin, headers } = {}) {
    const h = new Headers(headers);
    if (code) h.set('Authorization', 'Bearer ' + code);
    if (origin) h.set('Origin', origin);
    let payload = body;
    if (body !== undefined && typeof body === 'object') {
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
    env, deps, calls, call,
    answer: fn => { answer = fn; },
    rows: (sql, ...params) => env.DB.query(sql, ...params),
    register: async code => assert.equal((await call('POST', '/api/devices', { code })).status, 201)
  };
}

const hashOf = code => createHash('sha256').update(code).digest('hex');
const usageOf = (s, code) => s.rows('SELECT messages, opens, audio_ms, neurons_milli FROM assistant_usage WHERE device_id = ?', code === '*' ? '*' : hashOf(code))[0];

/** Una richiesta di risposta valida; `change` sostituisce i campi indicati. */
function chatBody(change = {}) {
  return {
    kind: 'message',
    message: 'domani devo chiamare il medico',
    now: { date: '2026-10-29', time: '09:00' },
    context: { minutes: 30, energy: 'medium' },
    tasks: [
      { ref: 't1', title: 'Rispondere alle email', duration: 30, energy: 'low', date: '2026-10-29', time: '10:00' },
      { ref: 't2', title: 'Pagare la bolletta', duration: 15, energy: 'low', date: '2026-10-27', time: null },
      { ref: 't3', title: 'Riordinare la scrivania', duration: 45, energy: 'medium', date: null, time: null }
    ],
    recent: [],
    ...change
  };
}

const promptOf = call => call.input.messages.map(message => message.content).join('\n');

/* ---------- Trascrizione ---------- */

test('trascrizione: senza codice 401; con il codice l\'audio arriva a Whisper così com\'è, in italiano', async () => {
  const s = setup();
  assert.equal((await s.call('POST', '/api/assistant/transcribe', { body: 'QUJDRA==', ...AUDIO })).status, 401);
  assert.equal(s.calls.length, 0, 'senza codice l\'IA non viene chiamata');
  await s.register(CODE_A);
  s.answer(() => ({ text: '  domani devo  chiamare il medico ', transcription_info: { language: 'it', duration: 4.2 } }));
  const result = await s.call('POST', '/api/assistant/transcribe', { code: CODE_A, body: 'QUJDRA==', ...AUDIO });
  assert.equal(result.status, 200);
  assert.deepEqual(result.data, { text: 'domani devo chiamare il medico', seconds: 4.2 });
  assert.equal(s.calls[0].model, WHISPER);
  assert.deepEqual(s.calls[0].input, { audio: 'QUJDRA==', language: 'it', vad_filter: true }, 'il corpo passa senza essere toccato');
  // 4,2 secondi a 46,63 neuroni al minuto = 3,2641 neuroni
  assert.deepEqual(usageOf(s, CODE_A), { messages: 0, opens: 0, audio_ms: 4200, neurons_milli: 3265 });
  assert.deepEqual(usageOf(s, '*'), { messages: 0, opens: 0, audio_ms: 4200, neurons_milli: 3265 }, 'anche nel totale');
});

test('trascrizione: il formato sta in X-Audio-Type; senza, o con un formato non ammesso, 415', async () => {
  const s = setup();
  await s.register(CODE_A);
  s.answer(() => ({ text: 'ciao a tutti', transcription_info: { duration: 1 } }));
  const send = type => s.call('POST', '/api/assistant/transcribe', { code: CODE_A, body: 'QUJDRA==', type: 'text/plain', headers: type ? { 'X-Audio-Type': type } : {} });
  for (const type of ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/webm;codecs=opus', 'AUDIO/WAV']) {
    assert.equal((await send(type)).status, 200, type);
  }
  const before = s.calls.length;
  for (const type of [null, 'video/mp4', 'text/plain', 'audio/qualcosa']) {
    const refused = await send(type);
    assert.equal(refused.status, 415, String(type));
    assert.match(refused.data.error, /Formato/);
  }
  assert.equal(s.calls.length, before, 'un formato non ammesso non arriva all\'IA');
  assert.equal(audioType('audio/mp4; codecs=mp4a.40.2'), 'audio/mp4');
  assert.equal(audioType('audio/x-m4a'), 'audio/x-m4a');
  assert.equal(audioType(''), null);
});

test('trascrizione: corpo vuoto 400; troppo lungo 413, prima di chiamare l\'IA', async () => {
  const s = setup();
  await s.register(CODE_A);
  assert.equal((await s.call('POST', '/api/assistant/transcribe', { code: CODE_A, body: '', ...AUDIO })).status, 400);
  const long = 'A'.repeat(ASSISTANT_LIMITS.audioChars + 1);
  const refused = await s.call('POST', '/api/assistant/transcribe', { code: CODE_A, body: long, ...AUDIO });
  assert.equal(refused.status, 413);
  assert.match(refused.data.error, /30 secondi/);
  const declared = await s.call('POST', '/api/assistant/transcribe', {
    code: CODE_A, body: 'QUJDRA==', type: 'text/plain', headers: { 'X-Audio-Type': 'audio/mp4', 'Content-Length': String(ASSISTANT_LIMITS.audioChars + 1) }
  });
  assert.equal(declared.status, 413, 'basta la lunghezza dichiarata');
  assert.equal(s.calls.length, 0);
  const limit = await s.call('POST', '/api/assistant/transcribe', { code: CODE_A, body: 'A'.repeat(ASSISTANT_LIMITS.audioChars), ...AUDIO });
  assert.equal(limit.status, 200, 'al limite passa');
});

test('trascrizione: le frasi che Whisper inventa sul silenzio si scartano; se la durata manca si contano 30 secondi', async () => {
  const s = setup();
  await s.register(CODE_A);
  s.answer(() => ({ text: 'Sottotitoli creati dalla comunità Amara.org' }));
  const result = await s.call('POST', '/api/assistant/transcribe', { code: CODE_A, body: 'QUJDRA==', ...AUDIO });
  assert.deepEqual(result.data, { text: '', seconds: 30 });
  assert.equal(usageOf(s, CODE_A).audio_ms, 30000);
  assert.equal(cleanTranscript('Sottotitoli e revisione a cura di QTSS'), '');
  assert.equal(cleanTranscript('Grazie a tutti.'), '');
  assert.equal(cleanTranscript('Grazie.'), '');
  assert.equal(cleanTranscript(' Grazie di tutto,  domani  porto il regalo '), 'Grazie di tutto, domani porto il regalo', 'una frase vera resta');
  assert.equal(cleanTranscript('ringraziare la nonna'), 'ringraziare la nonna');
  assert.equal(cleanTranscript(null), '');
  assert.equal(cleanTranscript('a'.repeat(900)).length, ASSISTANT_LIMITS.messageLength);
});

test('trascrizione: se Workers AI rifiuta l\'audio 502 con il motivo; se ha finito la quota 503 fino alle 00:00 UTC', async () => {
  const s = setup();
  await s.register(CODE_A);
  s.answer(() => { throw new Error('3030: Invalid audio input'); });
  const refused = await s.call('POST', '/api/assistant/transcribe', { code: CODE_A, body: 'QUJDRA==', origin: APP, ...AUDIO });
  assert.equal(refused.status, 502);
  assert.equal(refused.data.reason, 'bad-audio');
  assert.match(refused.data.detail, /Invalid audio/);
  assert.equal(refused.headers.get('Access-Control-Allow-Origin'), APP, 'l\'app può leggere il motivo');
  assert.equal(usageOf(s, CODE_A), undefined, 'un rifiuto non si conta');
  s.answer(() => { throw new Error('4006: you have used up your daily free allocation of 10,000 neurons'); });
  const empty = await s.call('POST', '/api/assistant/transcribe', { code: CODE_A, body: 'QUJDRA==', ...AUDIO });
  assert.equal(empty.status, 503);
  assert.equal(empty.data.reason, 'daily-cap');
  assert.equal(empty.headers.get('Retry-After'), String(16 * 3600), 'dalle 8:00 UTC alle 00:00 mancano 16 ore');
});

test('trascrizione: 5 minuti di voce al giorno per dispositivo; un altro dispositivo passa', async () => {
  const s = setup();
  await s.register(CODE_A);
  await s.register(CODE_B);
  s.answer(() => ({ text: 'frase lunga', transcription_info: { duration: 100 } }));
  const send = code => s.call('POST', '/api/assistant/transcribe', { code, body: 'QUJDRA==', ...AUDIO });
  for (let i = 0; i < 3; i++) assert.equal((await send(CODE_A)).status, 200);
  const limited = await send(CODE_A);
  assert.equal(limited.status, 429);
  assert.equal(limited.data.reason, 'device-audio');
  assert.match(limited.data.error, /minuti di voce/);
  assert.equal(s.calls.length, 3, 'oltre il limite l\'IA non viene chiamata');
  assert.equal((await send(CODE_B)).status, 200);
});

test('trascrizione: si conta tutta la durata detta da Whisper, anche un file di 20 minuti preparato apposta', async () => {
  const s = setup();
  await s.register(CODE_A);
  s.answer(() => ({ text: 'frase', transcription_info: { duration: 1200 } }));
  const send = () => s.call('POST', '/api/assistant/transcribe', { code: CODE_A, body: 'QUJDRA==', ...AUDIO });
  const result = await send();
  assert.equal(result.status, 200);
  assert.equal(result.data.seconds, 1200);
  assert.equal(usageOf(s, CODE_A).audio_ms, 1200 * 1000);
  assert.equal(usageOf(s, '*').neurons_milli, Math.ceil(audioNeurons(1200) * 1000), '20 minuti a 46,63 neuroni al minuto, nel totale');
  assert.equal((await send()).status, 429, 'poi il dispositivo ha finito la voce del giorno');
});

test('CORS: il preflight ammette l\'intestazione X-Audio-Type', async () => {
  const s = setup();
  const preflight = await s.call('OPTIONS', '/api/assistant/transcribe', { origin: APP });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('Access-Control-Allow-Headers'), /X-Audio-Type/);
  assert.match(preflight.headers.get('Access-Control-Allow-Headers'), /Authorization/);
});

/* ---------- Risposte ---------- */

test('risposte: senza codice 401; senza IA sul server 503; dati non validi 400', async () => {
  const s = setup();
  assert.equal((await s.call('POST', '/api/assistant/chat', { body: chatBody() })).status, 401);
  await s.register(CODE_A);
  const send = body => s.call('POST', '/api/assistant/chat', { code: CODE_A, body });
  for (const body of [
    { ...chatBody(), kind: 'altro' },
    chatBody({ message: '   ' }),
    chatBody({ now: { date: '2026-02-31', time: '09:00' } }),
    chatBody({ now: { date: '2026-10-29', time: '25:00' } }),
    chatBody({ tasks: 'nessuna' }),
    chatBody({ tasks: [{ ref: 'x1', title: 'Sigla sbagliata', duration: 10, energy: 'low', date: null, time: null }] }),
    chatBody({ tasks: [{ ref: 't1', title: 'Ora senza giorno', duration: 10, energy: 'low', date: null, time: '10:00' }] }),
    chatBody({ tasks: [{ ref: 't1', title: 'Uno', duration: 10, energy: 'low', date: null, time: null }, { ref: 't1', title: 'Doppia', duration: 10, energy: 'low', date: null, time: null }] })
  ]) {
    assert.equal((await send(body)).status, 400, JSON.stringify(body).slice(0, 80));
  }
  assert.equal((await s.call('POST', '/api/assistant/chat', { code: CODE_A, body: '{rotto', type: 'application/json' })).status, 400);
  assert.equal(s.calls.length, 0, 'i dati non validi non arrivano all\'IA');
  delete s.env.AI;
  const missing = await send(chatBody());
  assert.equal(missing.status, 503);
  assert.match(missing.data.error, /non è configurato/);
});

test('risposte: al modello vanno solo istruzioni, calendario, ora, attività e messaggio; mai il codice del dispositivo', async () => {
  const s = setup();
  await s.register(CODE_A);
  const body = chatBody({ segreto: 'SEGRETO-IN-PIU' });
  body.tasks[0].id = 'id-vero-dell-attivita';
  body.tasks[0].note = 'NOTA-IN-PIU';
  body.now.zone = 'FUSO-IN-PIU';
  assert.equal((await s.call('POST', '/api/assistant/chat', { code: CODE_A, body })).status, 200);
  const { model, input } = s.calls[0];
  assert.equal(model, DEFAULT_MODEL);
  assert.equal(input.max_tokens, ASSISTANT_LIMITS.maxTokens);
  assert.equal(input.response_format.type, 'json_schema');
  assert.deepEqual(input.chat_template_kwargs, { enable_thinking: false }, 'Gemma 4 senza ragionamento: altrimenti consuma lì tutti i token');
  assert.deepEqual(input.messages.map(message => message.role), ['system', 'user']);
  const sent = JSON.stringify(input);
  for (const hidden of [CODE_A, hashOf(CODE_A), 'SEGRETO-IN-PIU', 'id-vero-dell-attivita', 'NOTA-IN-PIU', 'FUSO-IN-PIU', 'Bearer']) {
    assert.ok(!sent.includes(hidden), hidden + ' non deve arrivare al modello');
  }
  const prompt = promptOf(s.calls[0]);
  for (const line of [
    'Adesso: giovedì 29 ottobre 2026, ore 09:00.',
    'giovedì 29 ottobre (oggi) = 2026-10-29',
    'venerdì 30 ottobre (domani) = 2026-10-30',
    'sabato 31 ottobre (dopodomani) = 2026-10-31',
    'domenica 1 novembre = 2026-11-01',
    'Ultima scelta dell\'utente: 30 minuti a disposizione, energia media.',
    'Attività da fare adesso (sigla | titolo | durata | energia richiesta | quando):',
    't1 | Rispondere alle email | 30 min | energia bassa | oggi alle 10:00',
    't2 | Pagare la bolletta | 15 min | energia bassa | in ritardo da 2 giorni (2026-10-27)',
    't3 | Riordinare la scrivania | 45 min | energia media | senza data',
    'Messaggio dell\'utente: «domani devo chiamare il medico»'
  ]) {
    assert.ok(prompt.includes(line), 'manca: ' + line);
  }
  assert.ok(!prompt.includes('Scambi recenti'), 'senza memoria breve non se ne parla');
  assert.ok(!prompt.includes('Attività più avanti'), 'nessuna attività dei prossimi giorni');

  // Le attività dei prossimi giorni stanno in un gruppo a parte: non vanno proposte per adesso.
  const later = chatBody();
  later.tasks.push({ ref: 't4', title: 'Corso di inglese', duration: 90, energy: 'high', date: '2026-11-03', time: '19:00' });
  await s.call('POST', '/api/assistant/chat', { code: CODE_A, body: later });
  const grouped = promptOf(s.calls[1]);
  const header = grouped.indexOf('Attività più avanti, da non proporre per adesso:');
  assert.ok(header > grouped.indexOf('t3 | Riordinare la scrivania'), 'prima quelle da fare adesso');
  assert.ok(grouped.indexOf('t4 | Corso di inglese | 90 min | energia alta | martedì 3 novembre (2026-11-03) alle 19:00') > header);
});

test('risposte: la risposta del modello viene ricontrollata (elenco chiuso, sigle vere, valori validi, lunghezze)', async () => {
  const s = setup();
  await s.register(CODE_A);
  s.answer(() => modelReply({
    say: 'Ho  sistemato tutto. ' + 'x'.repeat(300),
    minutes: 40,
    energy: 'low',
    segreto: 'campo in più',
    actions: [
      { type: 'add', title: '  Chiamare   il medico ', date: '2026-10-30', time: '16:00', duration: 10, energy: 'low', altro: 'x' },
      { type: 'add', title: '   ' },
      { type: 'add', title: 'Data impossibile', date: '2026-02-31', time: '25:00', duration: 9999, energy: 'altissima' },
      { type: 'update', task: 't1', time: '17:00' },
      { type: 'update', task: 't9', time: '17:00' },
      { type: 'update', task: 't1' },
      { type: 'update', task: 't2', date: 'none', time: 'none', duration: 0, energy: '' },
      { type: 'email', to: 'qualcuno' },
      { type: 'suggest', task: 't3', reason: 'Ci sta nel tuo tempo', alternatives: ['t2', 't3', 't9', 't2', 't1'] },
      'non è un\'azione'
    ]
  }));
  const result = await s.call('POST', '/api/assistant/chat', { code: CODE_A, body: chatBody() });
  assert.equal(result.status, 200);
  assert.equal(result.data.say.length, ASSISTANT_LIMITS.sayLength);
  assert.ok(result.data.say.startsWith('Ho sistemato tutto. x') && result.data.say.endsWith('…'));
  assert.deepEqual(result.data.context, { minutes: 40, energy: 'low' });
  assert.equal(result.data.segreto, undefined);
  assert.deepEqual(result.data.actions, [
    { type: 'add', title: 'Chiamare il medico', duration: 10, energy: 'low', date: '2026-10-30', time: '16:00' },
    { type: 'add', title: 'Data impossibile', duration: null, energy: null, date: null, time: null },
    { type: 'update', task: 't1', time: '17:00' },
    { type: 'update', task: 't2', date: null, time: null },
    { type: 'suggest', task: 't3', reason: 'Ci sta nel tuo tempo', alternatives: ['t2', 't1'] }
  ]);
  assert.equal(result.data.left, ASSISTANT_LIMITS.messagesPerDay - 1);
  assert.equal(result.data.dropped, 5, 'le azioni scartate si contano: la frase del modello potrebbe vantarle');
  assert.equal(result.data.debug, undefined, 'niente dati di prova sul server pubblicato');

  s.answer(() => modelReply({ say: 'Fatto.', actions: [{ type: 'complete', task: 't1' }, { type: 'delete', task: 't2' }, { type: 'complete', task: 't7' }, { type: 'delete' }] }));
  const second = await s.call('POST', '/api/assistant/chat', { code: CODE_A, body: chatBody() });
  assert.deepEqual(second.data.actions, [{ type: 'complete', task: 't1' }, { type: 'delete', task: 't2' }]);
  assert.equal(second.data.context, null, 'tempo ed energia non detti');
  assert.equal(second.data.dropped, 2);

  s.answer(() => modelReply({ say: 'Tante.', actions: Array.from({ length: 9 }, (_, i) => ({ type: 'add', title: 'Attività ' + (i + 1) })) }));
  const many = await s.call('POST', '/api/assistant/chat', { code: CODE_A, body: chatBody() });
  assert.equal(many.data.actions.length, ASSISTANT_LIMITS.actions);
  assert.equal(many.data.dropped, 3, 'anche quelle oltre il massimo');

  // Il modello dice di aver tolto l'ora, ma l'ha scritta vuota invece di "none": l'azione non vale, e si vede da `dropped`.
  s.answer(() => modelReply({ say: 'Ho rimosso l\'orario da «Rispondere alle email».', actions: [{ type: 'update', task: 't1', time: '' }] }));
  const claimed = await s.call('POST', '/api/assistant/chat', { code: CODE_A, body: chatBody() });
  assert.deepEqual([claimed.data.actions, claimed.data.dropped], [[], 1]);
  s.answer(() => modelReply({ say: 'Va bene.', actions: [{ type: 'update', task: 't1', time: 'none' }] }));
  const removed = await s.call('POST', '/api/assistant/chat', { code: CODE_A, body: chatBody() });
  assert.deepEqual([removed.data.actions, removed.data.dropped], [[{ type: 'update', task: 't1', time: null }], 0]);
});

test('risposte: il JSON si trova anche tra ``` o dopo un ragionamento, e nella forma di OpenAI', async () => {
  const s = setup();
  await s.register(CODE_A);
  const reply = { say: 'Eccomi.', actions: [] };
  const send = () => s.call('POST', '/api/assistant/chat', { code: CODE_A, body: chatBody() });
  s.answer(() => ({ response: '```json\n' + JSON.stringify(reply) + '\n```', usage: { prompt_tokens: 10, completion_tokens: 5 } }));
  assert.equal((await send()).data.say, 'Eccomi.');
  s.answer(() => ({ response: '<think>Forse {non so}.</think>\nEcco: ' + JSON.stringify(reply) }));
  assert.equal((await send()).data.say, 'Eccomi.');
  s.answer(() => ({ response: reply, usage: { prompt_tokens: 10, completion_tokens: 5 } }));
  assert.equal((await send()).data.say, 'Eccomi.', 'risposta già in forma di oggetto');
  s.answer(() => ({ choices: [{ message: { role: 'assistant', content: JSON.stringify(reply) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }));
  assert.equal((await send()).data.say, 'Eccomi.');
  assert.equal(replyText(null), '');
  assert.equal(replyText({ output_text: '{"say":"x"}' }), '{"say":"x"}');
  assert.equal(parseReply('nessun oggetto'), null);
  assert.equal(parseReply('[1, 2]'), null);
  assert.equal(parseReply('{"say": "tagliato'), null);
});

test('risposte: una risposta non valida dà 502 «bad-reply», ma il suo costo si conta', async () => {
  const s = setup();
  await s.register(CODE_A);
  s.answer(() => ({ response: 'Certo! Ti aiuto volentieri.', usage: { prompt_tokens: 1000, completion_tokens: 150 } }));
  const result = await s.call('POST', '/api/assistant/chat', { code: CODE_A, body: chatBody() });
  assert.equal(result.status, 502);
  assert.equal(result.data.reason, 'bad-reply');
  assert.equal(result.data.left, ASSISTANT_LIMITS.messagesPerDay - 1);
  // 1000 token in ingresso e 150 in uscita con Gemma 4: 9,091 + 4,091 = 13,182 neuroni
  assert.deepEqual(usageOf(s, CODE_A), { messages: 1, opens: 0, audio_ms: 0, neurons_milli: 13182 });
  s.answer(() => modelReply({ altro: 'né frase né azioni' }));
  assert.equal((await s.call('POST', '/api/assistant/chat', { code: CODE_A, body: chatBody() })).status, 502);
  s.answer(() => { throw new Error('5007: No such model'); });
  const down = await s.call('POST', '/api/assistant/chat', { code: CODE_A, body: chatBody() });
  assert.equal(down.status, 502);
  assert.equal(down.data.reason, 'ai-error');
  assert.equal(usageOf(s, CODE_A).messages, 2, 'una chiamata fallita non si conta');
});

test('risposte: 60 messaggi al giorno per dispositivo, poi 429; le proposte all\'apertura hanno un contatore loro (8)', async () => {
  const s = setup();
  await s.register(CODE_A);
  await s.register(CODE_B);
  const send = (code, kind = 'message') => s.call('POST', '/api/assistant/chat', { code, body: chatBody({ kind }) });
  const left = [];
  for (let i = 0; i < ASSISTANT_LIMITS.messagesPerDay; i++) left.push((await send(CODE_A)).data.left);
  assert.equal(left[0], 59);
  assert.equal(left[59], 0);
  const limited = await send(CODE_A);
  assert.equal(limited.status, 429);
  assert.equal(limited.data.reason, 'device-messages');
  assert.equal(limited.headers.get('Retry-After'), String(16 * 3600));
  assert.equal((await send(CODE_A, 'siri')).status, 429, 'le frasi di Siri contano come messaggi');
  assert.equal((await send(CODE_B)).status, 200, 'un altro dispositivo ha i suoi');
  // Le proposte all'apertura non tolgono messaggi, e viceversa.
  for (let i = 0; i < ASSISTANT_LIMITS.opensPerDay; i++) {
    const open = await send(CODE_A, 'open');
    assert.equal(open.status, 200);
    assert.equal(open.data.left, 0);
  }
  const noMore = await send(CODE_A, 'open');
  assert.equal(noMore.status, 429);
  assert.equal(noMore.data.reason, 'device-opens');
  assert.deepEqual([usageOf(s, CODE_A).messages, usageOf(s, CODE_A).opens], [60, 8]);
  assert.deepEqual([usageOf(s, '*').messages, usageOf(s, '*').opens], [61, 8]);
  // Il giorno dopo (UTC) si riparte.
  s.deps.now = NOW + DAY;
  assert.equal((await send(CODE_A)).data.left, 59);
});

test('risposte: tetto di tutti a 8.500 neuroni al giorno, poi 503 fino alle 00:00 UTC', async () => {
  const s = setup();
  await s.register(CODE_A);
  await s.register(CODE_B);
  // 500.000 token in ingresso con Gemma 4 = 4.545,5 neuroni a messaggio: al secondo il tetto è passato.
  s.answer(() => modelReply(EMPTY_REPLY, { prompt_tokens: 500000, completion_tokens: 0 }));
  const send = code => s.call('POST', '/api/assistant/chat', { code, body: chatBody() });
  assert.equal((await send(CODE_A)).status, 200);
  assert.equal((await send(CODE_B)).status, 200);
  assert.equal(usageOf(s, '*').neurons_milli, 9091000);
  const capped = await send(CODE_A);
  assert.equal(capped.status, 503);
  assert.equal(capped.data.reason, 'daily-cap');
  assert.match(capped.data.error, /riprova domani/);
  assert.equal(capped.headers.get('Retry-After'), String(16 * 3600));
  const voice = await s.call('POST', '/api/assistant/transcribe', { code: CODE_B, body: 'QUJDRA==', ...AUDIO });
  assert.equal(voice.status, 503, 'il tetto vale anche per la voce');
  assert.equal(s.calls.length, 2, 'a tetto raggiunto l\'IA non viene chiamata');
  s.deps.now = NOW + DAY;
  assert.equal((await send(CODE_A)).status, 200);
  assert.equal(LIMITS.assistant.neuronsPerDay, 8500);
});

test('neuroni: dai token e dai prezzi del modello; senza `usage` si stimano dai caratteri', () => {
  assert.equal(Math.round(neuronsFor(DEFAULT_MODEL, { input: 1000, output: 150 }) * 1000), 13182);
  assert.equal(Math.round(neuronsFor('@cf/meta/llama-3.3-70b-instruct-fp8-fast', { input: 1000, output: 150 }) * 1000), 57389);
  assert.equal(neuronsFor('modello-sconosciuto', { input: 1e6, output: 1e6 }), 31876 + 204805, 'per un modello sconosciuto valgono i prezzi più alti');
  assert.equal(neuronsFor(DEFAULT_MODEL, { input: 1000, output: 150 }, { usage: { neurons: 20.46 } }), 20.46, 'se Workers AI dichiara i neuroni, valgono i suoi');
  assert.equal(Math.round(neuronsFor(DEFAULT_MODEL, { input: 1000, output: 150 }, { usage: { neurons: 0 } }) * 1000), 13182);
  const messages = [{ role: 'system', content: 'a'.repeat(300) }, { role: 'user', content: 'b'.repeat(30) }];
  assert.deepEqual(tokensOf({ usage: { prompt_tokens: 12, completion_tokens: 3 } }, messages, 'ciao'), { input: 12, output: 3, measured: true });
  assert.deepEqual(tokensOf({ usage: { input_tokens: 12, output_tokens: 3 } }, messages, 'ciao'), { input: 12, output: 3, measured: true });
  assert.deepEqual(tokensOf({}, messages, 'ciao!!'), { input: 110, output: 2, measured: false });
  assert.equal(Math.round(audioNeurons(60) * 100), 4663);
  assert.equal(utcDay(NOW), '2026-10-29');
  assert.equal(utcDay(Date.UTC(2026, 9, 29, 23, 59, 59)), '2026-10-29');
  assert.equal(secondsToUtcMidnight(Date.UTC(2026, 9, 29, 23, 59, 30)), 30);
  assert.equal(secondsToUtcMidnight(Date.UTC(2026, 9, 30, 0, 0, 0)), 24 * 3600);
});

test('modello: quello di ASSISTANT_MODEL se è nell\'elenco, altrimenti il predefinito; la richiesta lo sceglie solo nelle prove', async () => {
  const s = setup();
  await s.register(CODE_A);
  const send = headers => s.call('POST', '/api/assistant/chat', { code: CODE_A, body: chatBody(), headers });
  s.env.ASSISTANT_MODEL = LLAMA;
  await send();
  assert.equal(s.calls[0].model, LLAMA);
  s.env.ASSISTANT_MODEL = '@cf/qualcuno/modello-senza-prezzi';
  await send();
  assert.equal(s.calls[1].model, DEFAULT_MODEL);
  const ignored = await send({ 'X-Assistant-Model': MISTRAL });
  assert.equal(s.calls[2].model, DEFAULT_MODEL, 'sul server pubblicato la richiesta non sceglie il modello');
  assert.equal(ignored.data.debug, undefined);
  s.env.ASSISTANT_EVAL = '1';
  const chosen = await send({ 'X-Assistant-Model': MISTRAL });
  assert.equal(s.calls[3].model, MISTRAL);
  assert.ok(s.calls[3].input.guided_json && !s.calls[3].input.response_format, 'Mistral riceve lo schema in guided_json');
  assert.equal(chosen.data.debug.model, MISTRAL);
  assert.deepEqual(chosen.data.debug.tokens, { input: 1000, output: 150, measured: true });
  await send({ 'X-Assistant-Model': 'modello-qualsiasi' });
  assert.equal(s.calls[4].model, DEFAULT_MODEL, 'solo i modelli dell\'elenco');
  assert.ok(Object.keys(MODELS).includes(DEFAULT_MODEL));
});

/* ---------- Memoria breve, Siri, apertura ---------- */

test('memoria breve: al massimo 3 scambi, tagliati, scritti prima del messaggio', async () => {
  const s = setup();
  await s.register(CODE_A);
  const recent = [
    { said: 'primo, troppo vecchio', reply: 'Uno.', did: [] },
    { said: 'secondo, troppo vecchio', reply: 'Due.', did: [] },
    { said: 'ho mezz\'ora', reply: 'Ti propongo «Rispondere alle email».', did: ['suggest t1'] },
    { said: 'domani alle 4 chiamare il medico ' + 'y'.repeat(600), reply: 'Aggiunta. ' + 'z'.repeat(300), did: ['add t3', 'cancella tutto', 'add t99999', 42] },
    { said: 'sposta la bolletta', reply: 'La sposto a domani?', did: ['ask t2', 'update t2'], altro: 'CAMPO-IN-PIU' }
  ];
  await s.call('POST', '/api/assistant/chat', { code: CODE_A, body: chatBody({ message: 'no, facciamo alle 5', recent }) });
  const prompt = promptOf(s.calls[0]);
  assert.ok(!prompt.includes('troppo vecchio'), 'restano solo gli ultimi 3');
  assert.ok(prompt.includes('1. Utente: «ho mezz\'ora» — Aura: «Ti propongo «Rispondere alle email».» (ha proposto t1)'));
  assert.ok(prompt.includes('(ha aggiunto t3)'), 'le azioni non riconosciute si scartano');
  assert.ok(prompt.includes('3. Utente: «sposta la bolletta» — Aura: «La sposto a domani?» (ha chiesto conferma su t2, ha cambiato t2)'));
  assert.ok(!prompt.includes('cancella tutto') && !prompt.includes('CAMPO-IN-PIU') && !prompt.includes('t99999'));
  assert.ok(!prompt.includes('y'.repeat(ASSISTANT_LIMITS.recentSaid)), 'la frase lunga è tagliata');
  assert.ok(!prompt.includes('z'.repeat(ASSISTANT_LIMITS.recentReply)), 'la risposta lunga è tagliata');
  assert.ok(prompt.indexOf('Scambi recenti') < prompt.indexOf('Messaggio dell\'utente: «no, facciamo alle 5»'));
  const clean = cleanChatInput(chatBody({ recent: [{ said: '', reply: '' }, 'testo', null, { said: 'ok', reply: '' }] }));
  assert.deepEqual(clean.recent, [{ said: 'ok', reply: '', did: [] }]);
});

test('Siri: la frase si legge dal momento della dettatura, non da quando si apre l\'app', async () => {
  const s = setup();
  await s.register(CODE_A);
  await s.call('POST', '/api/assistant/chat', {
    code: CODE_A, body: chatBody({ kind: 'siri', message: 'domani alle 10 dentista', now: { date: '2026-10-28', time: '21:40' } })
  });
  const prompt = promptOf(s.calls[0]);
  assert.ok(prompt.includes('Momento in cui l\'utente ha dettato la frase: mercoledì 28 ottobre 2026, ore 21:40.'));
  assert.ok(prompt.includes('mercoledì 28 ottobre (oggi) = 2026-10-28'), 'il calendario parte dal giorno della dettatura');
  assert.ok(prompt.includes('giovedì 29 ottobre (domani) = 2026-10-29'));
  assert.ok(prompt.includes('Frase dettata dall\'utente a Siri: «domani alle 10 dentista»'));
  assert.ok(prompt.includes('t1 | Rispondere alle email | 30 min | energia bassa | domani alle 10:00'), 'anche le attività si contano da lì');
  assert.ok(prompt.indexOf('Attività più avanti') < prompt.indexOf('t1 | Rispondere alle email'), 'quella di «domani» non è da fare adesso');
});

test('apertura: senza messaggio si chiede una proposta; a lista vuota lo si dice', async () => {
  const s = setup();
  await s.register(CODE_A);
  await s.call('POST', '/api/assistant/chat', { code: CODE_A, body: chatBody({ kind: 'open', message: 'TESTO-DA-IGNORARE' }) });
  const prompt = promptOf(s.calls[0]);
  assert.ok(prompt.includes('L\'utente ha appena aperto l\'app'));
  assert.ok(!prompt.includes('TESTO-DA-IGNORARE') && !prompt.includes('Messaggio dell\'utente'));
  assert.deepEqual(usageOf(s, CODE_A), { messages: 0, opens: 1, audio_ms: 0, neurons_milli: 13182 });
  await s.call('POST', '/api/assistant/chat', { code: CODE_A, body: chatBody({ tasks: [], context: {} }) });
  const empty = promptOf(s.calls[1]);
  assert.ok(empty.includes('Non ci sono attività da fare.'));
  assert.ok(!empty.includes('Ultima scelta dell\'utente'));
  const future = [{ ref: 't1', title: 'Corso di inglese', duration: 90, energy: 'high', date: '2026-11-03', time: null }];
  await s.call('POST', '/api/assistant/chat', { code: CODE_A, body: chatBody({ kind: 'open', tasks: future }) });
  assert.ok(promptOf(s.calls[2]).includes('Adesso non c\'è nessuna attività da fare.'), 'solo attività dei prossimi giorni');
});

test('richiesta: attività oltre le 40 e titoli lunghi si tagliano; si tengono solo i campi previsti', () => {
  const tasks = Array.from({ length: 55 }, (_, i) => ({ ref: 't' + (i + 1), title: 'Attività ' + (i + 1), duration: 10, energy: 'low', date: null, time: null }));
  tasks[0].title = 'T'.repeat(300);
  const clean = cleanChatInput(chatBody({ tasks, message: 'm'.repeat(900), context: { minutes: 45.4, energy: 'altissima' } }));
  assert.equal(clean.tasks.length, ASSISTANT_LIMITS.tasks);
  assert.equal(clean.tasks[0].title.length, ASSISTANT_LIMITS.titleLength);
  assert.equal(clean.message.length, ASSISTANT_LIMITS.messageLength);
  assert.deepEqual(clean.context, { minutes: 45, energy: null });
  assert.deepEqual(Object.keys(clean), ['kind', 'message', 'now', 'context', 'tasks', 'recent']);
  assert.deepEqual(Object.keys(clean.tasks[1]), ['ref', 'title', 'duration', 'energy', 'date', 'time']);
  assert.equal(cleanChatInput(null), null);
  assert.equal(cleanChatInput([]), null);
});

test('calendario: 14 giorni da oggi, anche a cavallo dell\'anno e del 29 febbraio', () => {
  const lines = buildCalendar('2026-10-29');
  assert.equal(lines.length, 14);
  assert.equal(lines[0], 'giovedì 29 ottobre (oggi) = 2026-10-29');
  assert.equal(lines[1], 'venerdì 30 ottobre (domani) = 2026-10-30');
  assert.equal(lines[8], 'venerdì 6 novembre = 2026-11-06', 'il venerdì della settimana dopo');
  assert.equal(lines[13], 'mercoledì 11 novembre = 2026-11-11');
  const newYear = buildCalendar('2027-12-30');
  assert.equal(newYear[0], 'giovedì 30 dicembre (oggi) = 2027-12-30');
  assert.equal(newYear[2], 'sabato 1 gennaio (dopodomani) = 2028-01-01');
  assert.ok(buildCalendar('2028-02-27').includes('martedì 29 febbraio (dopodomani) = 2028-02-29'));
  assert.ok(buildCalendar('2027-02-27').includes('lunedì 1 marzo (dopodomani) = 2027-03-01'));
});

/* ---------- Limite per IP, scollegamento, pulizia ---------- */

test('limite per IP: 12 richieste al minuto su /api/assistant/…, con un contatore suo', async () => {
  const s = setup();
  const counts = new Map();
  s.env.RATE_LIMIT_ASSISTANT = {
    async limit({ key }) {
      counts.set(key, (counts.get(key) || 0) + 1);
      return { success: counts.get(key) <= 12 };
    }
  };
  const ip = { 'CF-Connecting-IP': '203.0.113.7' };
  for (let i = 0; i < 12; i++) {
    const path = i % 2 ? '/api/assistant/chat' : '/api/assistant/transcribe';
    assert.equal((await s.call('POST', path, { body: 'x', type: 'text/plain', headers: ip })).status, 401);
  }
  const limited = await s.call('POST', '/api/assistant/chat', { body: chatBody(), headers: ip, origin: APP });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '60');
  assert.deepEqual([...counts.keys()], ['assistant:203.0.113.7']);
  assert.equal((await s.call('GET', '/api/inbox', { headers: ip })).status, 401, 'le altre richieste hanno il loro limite');
});

test('"Scollega" cancella i conteggi del dispositivo; la pulizia oraria toglie quelli di oltre due giorni', async () => {
  const s = setup();
  await s.register(CODE_A);
  await s.register(CODE_B);
  await s.call('POST', '/api/assistant/chat', { code: CODE_A, body: chatBody() });
  await s.call('POST', '/api/assistant/chat', { code: CODE_B, body: chatBody() });
  assert.equal(s.rows('SELECT * FROM assistant_usage').length, 3, 'due dispositivi e il totale');
  assert.equal((await s.call('DELETE', '/api/devices', { code: CODE_A })).status, 200);
  assert.deepEqual(s.rows('SELECT device_id FROM assistant_usage ORDER BY device_id').map(row => row.device_id), ['*', hashOf(CODE_B)]);
  assert.equal(usageOf(s, '*').messages, 2, 'il totale del giorno resta: la quota è già stata consumata');

  const insert = day => s.env.DB.prepare('INSERT INTO assistant_usage (device_id, day, messages) VALUES (?, ?, 5)').bind('vecchio', day).run();
  await insert('2026-10-26');
  await insert('2026-10-27');
  await insert('2026-10-28');
  await runCron(s.env, s.deps); // le 8:00 in punto: gira anche la pulizia
  assert.deepEqual(
    s.rows("SELECT day FROM assistant_usage WHERE device_id = 'vecchio' ORDER BY day").map(row => row.day),
    ['2026-10-27', '2026-10-28'],
    'restano oggi e i due giorni prima'
  );
  const stored = JSON.stringify(s.rows('SELECT * FROM assistant_usage'));
  assert.ok(!stored.includes('medico') && !stored.includes('email'), 'nel database ci sono solo numeri');
});
