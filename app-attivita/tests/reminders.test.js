/*
 * Test dei promemoria (js/reminders.js) e delle funzioni pure del collegamento al server (js/remote.js).
 * Adesso fisso: giovedì 29/10/2026 alle 9:00, così i risultati non dipendono dal giorno in cui girano.
 */
(function () {
  'use strict';

  const { test, assert, assertEqual } = window.AuraTest;
  const { reminders: RM, remote: R } = window.Aura;

  const NOW = new Date(2026, 9, 29, 9, 0);
  const moment = (y, m, d, h, min) => new Date(y, m - 1, d, h, min).getTime();

  function task(id, fields) {
    return Object.assign({
      id, title: 'Attività ' + id, duration: 30, energy: 'medium', date: null, time: null,
      done: false, createdAt: 1, completedAt: null, pointsAwarded: null
    }, fields);
  }

  /* ---------- Promemoria ---------- */

  test('promemoria: solo attività da fare, con giorno e ora, ancora da venire', () => {
    const list = RM.buildReminders([
      task('ok', { date: '2026-10-29', time: '10:00' }),
      task('senza-ora', { date: '2026-10-29' }),
      task('senza-giorno', { time: '10:00' }),
      task('fatta', { date: '2026-10-29', time: '11:00', done: true }),
      task('passata', { date: '2026-10-29', time: '08:30' }),
      task('adesso', { date: '2026-10-29', time: '09:00' }),
      task('domani', { date: '2026-10-30', time: '08:00' })
    ], { lead: 10, now: NOW });
    assertEqual(list.map(r => r.id), ['ok', 'domani']);
  });

  test('promemoria: istante in ora locale, avviso = ora dell\'attività meno l\'anticipo', () => {
    const list = RM.buildReminders([task('a', { title: 'Dentista', date: '2026-10-30', time: '10:00' })], { lead: 10, now: NOW });
    assertEqual(list, [{ id: 'a', at: moment(2026, 10, 30, 10, 0), fireAt: moment(2026, 10, 30, 9, 50), title: 'Dentista', time: '10:00' }]);
  });

  test('promemoria: dentro l\'anticipo l\'avviso è già passato, e il server avvisa subito', () => {
    const [reminder] = RM.buildReminders([task('a', { date: '2026-10-29', time: '09:05' })], { lead: 10, now: NOW });
    assertEqual(reminder.fireAt, moment(2026, 10, 29, 8, 55));
    assert(reminder.fireAt < NOW.getTime() && reminder.at > NOW.getTime(), 'avviso passato, attività futura');
  });

  test('promemoria: anticipo 0, 60 e non valido (vale 10 minuti)', () => {
    const tasks = [task('a', { date: '2026-10-29', time: '12:00' })];
    assertEqual(RM.buildReminders(tasks, { lead: 0, now: NOW })[0].fireAt, moment(2026, 10, 29, 12, 0));
    assertEqual(RM.buildReminders(tasks, { lead: 60, now: NOW })[0].fireAt, moment(2026, 10, 29, 11, 0));
    assertEqual(RM.buildReminders(tasks, { lead: 7, now: NOW })[0].fireAt, moment(2026, 10, 29, 11, 50));
    assertEqual(RM.buildReminders(tasks, { lead: undefined, now: NOW.getTime() })[0].fireAt, moment(2026, 10, 29, 11, 50), 'adesso anche in millisecondi');
  });

  test('promemoria: in ordine di avviso, al massimo 100 (i più vicini)', () => {
    const tasks = [];
    for (let i = 0; i < 120; i++) tasks.push(task('t' + String(i).padStart(3, '0'), { date: '2026-11-0' + (1 + i % 9), time: '10:00' }));
    const list = RM.buildReminders(tasks, { lead: 10, now: NOW });
    assertEqual(list.length, RM.MAX_REMINDERS);
    assert(list.every((r, i) => i === 0 || list[i - 1].fireAt <= r.fireAt), 'ordinati');
    assertEqual(list[0].at, moment(2026, 11, 1, 10, 0));
    assertEqual(list[99].at, moment(2026, 11, 8, 10, 0), 'restano fuori gli ultimi giorni');
  });

  test('promemoria: giorno del cambio dell\'ora (25/10/2026), le 10 restano le 10', () => {
    const [reminder] = RM.buildReminders([task('a', { date: '2026-10-25', time: '10:00' })], { lead: 0, now: new Date(2026, 9, 24, 20, 0) });
    const local = new Date(reminder.at);
    assertEqual([local.getDate(), local.getHours(), local.getMinutes()], [25, 10, 0]);
    assertEqual(RM.taskMoment({ date: '2026-10-25', time: '23:30' }), moment(2026, 10, 25, 23, 30));
    assertEqual(RM.taskMoment({ date: '2026-10-25', time: null }), null);
    assertEqual(RM.taskMoment({ date: '2026-02-30', time: '10:00' }), null, 'data impossibile');
  });

  test('promemoria: titolo accorciato a 120 caratteri', () => {
    const [reminder] = RM.buildReminders([task('a', { title: 'x'.repeat(200), date: '2026-10-30', time: '10:00' })], { lead: 10, now: NOW });
    assertEqual(reminder.title.length, 120);
  });

  test('promemoria: l\'impronta dell\'elenco non cambia col tempo, cambia con anticipo o titolo', () => {
    const tasks = [task('a', { date: '2026-10-30', time: '10:00' })];
    const key = RM.listKey(RM.buildReminders(tasks, { lead: 10, now: NOW }));
    assertEqual(RM.listKey(RM.buildReminders(tasks, { lead: 10, now: new Date(2026, 9, 29, 9, 30) })), key, 'mezz\'ora dopo è uguale');
    assert(RM.listKey(RM.buildReminders(tasks, { lead: 15, now: NOW })) !== key, 'anticipo diverso');
    assert(RM.listKey(RM.buildReminders([{ ...tasks[0], title: 'Altro' }], { lead: 10, now: NOW })) !== key, 'titolo diverso');
    assert(RM.listKey([]).indexOf('0:') === 0, 'elenco vuoto');
  });

  test('promemoria: etichette dell\'anticipo', () => {
    assertEqual([0, 5, 10, 60].map(RM.leadLabel), ['all\'ora esatta', '5 minuti prima', '10 minuti prima', 'un\'ora prima']);
  });

  /* ---------- Collegamento al server: funzioni pure ---------- */

  test('codice del dispositivo: 24 byte casuali → 32 caratteri base64url', () => {
    const bytes = new Uint8Array(24).map((_, i) => i * 10);
    const code = R.makeDeviceCode(bytes);
    assertEqual(code.length, 32);
    assert(R.isDeviceCode(code), code);
    assertEqual(Array.from(R.fromBase64url(code)), Array.from(bytes), 'andata e ritorno');
    assertEqual(R.toBase64url(new Uint8Array([250, 251, 252, 253, 254, 255])), '-vv8_f7_', 'alfabeto base64url');
    const a = R.newDeviceCode();
    const b = R.newDeviceCode();
    assert(R.isDeviceCode(a) && R.isDeviceCode(b) && a !== b, 'codici nuovi, diversi');
  });

  test('codice del dispositivo: formati non validi', () => {
    assert(!R.isDeviceCode('corto'));
    assert(!R.isDeviceCode('a'.repeat(31)));
    assert(!R.isDeviceCode('a'.repeat(65)));
    assert(!R.isDeviceCode('con spazio ' + 'a'.repeat(30)));
    assert(!R.isDeviceCode(null));
  });

  test('casella: frasi nuove in coda dalla più vecchia, niente doppioni né frasi già viste', () => {
    const merged = R.mergeInbox([{ id: 'a', text: 'prima', createdAt: 1 }], [
      { id: 'c', text: '  terza\n frase ', createdAt: 3 },
      { id: 'a', text: 'doppione', createdAt: 1 },
      { id: 'b', text: 'seconda', createdAt: 2 },
      { id: 'vista', text: 'già mostrata', createdAt: 0 },
      { id: 'vuota', text: '   ', createdAt: 4 },
      { text: 'senza id' },
      null
    ], ['vista']);
    assertEqual(merged, [
      { id: 'a', text: 'prima', createdAt: 1 },
      { id: 'b', text: 'seconda', createdAt: 2 },
      { id: 'c', text: 'terza frase', createdAt: 3 }
    ]);
  });

  test('casella: al massimo 30 frasi in coda', () => {
    const items = Array.from({ length: 40 }, (_, i) => ({ id: 'i' + i, text: 'frase ' + i, createdAt: i }));
    const merged = R.mergeInbox([], items, []);
    assertEqual(merged.length, 30);
    assertEqual([merged[0].id, merged[29].id], ['i0', 'i29']);
  });

  test('impostazioni: dati mancanti o sbagliati tornano ai predefiniti', () => {
    assertEqual(R.normalizeSettings(null), R.defaults());
    assertEqual(R.normalizeSettings('rotto'), R.defaults());
    const settings = R.normalizeSettings({ code: 'x', reminders: { enabled: true, lead: 7 }, sent: { at: 'ieri' }, inbox: 'no', done: [1, 'a'] });
    assertEqual(settings.code, null);
    assertEqual(settings.reminders, { enabled: false, lead: 10 }, 'senza codice i promemoria sono spenti');
    assertEqual(settings.sent, { endpoint: null, at: 0, key: null });
    assertEqual(settings.inbox, []);
    assertEqual(settings.done, ['a']);
  });

  test('impostazioni: i valori validi restano', () => {
    const raw = {
      code: R.makeDeviceCode(new Uint8Array(24).fill(7)),
      reminders: { enabled: true, lead: 30 },
      vapidKey: 'BAbc',
      sent: { endpoint: 'https://web.push.apple.com/x', at: 5, key: '2:abc' },
      inbox: [{ id: 'q', text: 'frase', createdAt: 9 }],
      done: ['z']
    };
    assertEqual(R.normalizeSettings(raw), raw);
  });
})();
