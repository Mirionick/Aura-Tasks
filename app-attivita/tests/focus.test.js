/* Test della modalità focus (js/focus.js) e del suo salvataggio (js/storage.js, con un archivio finto). */
(function () {
  'use strict';

  const { test, assert, assertEqual } = window.AuraTest;
  const { focus: F, points: P, storage } = window.Aura;

  const MIN = 60 * 1000;
  const T0 = new Date(2026, 10, 10, 10, 0).getTime(); // martedì 10/11/2026 alle 10:00
  const task = { id: 'palestra', duration: 25 };

  test('focus.start: la sessione dura quanto l\'attività e parte adesso', () => {
    assertEqual(F.start(task, T0), { taskId: 'palestra', startedAt: T0, durationMs: 25 * MIN, pausedAt: null, pausedTotalMs: 0 });
  });

  test('focus: tempo passato e tempo che manca si calcolano dagli istanti, non dai tick', () => {
    const s = F.start(task, T0);
    assertEqual([F.elapsedMs(s, T0 + 10 * MIN), F.remainingMs(s, T0 + 10 * MIN)], [10 * MIN, 15 * MIN]);
    assertEqual([F.remainingMs(s, T0 + 40 * MIN), F.isFinished(s, T0 + 25 * MIN), F.isFinished(s, T0 + 25 * MIN - 1)], [0, true, false]);
    assertEqual(F.endsAt(s), T0 + 25 * MIN);
  });

  test('focus: in pausa il tempo resta fermo, e il tempo in pausa non conta', () => {
    let s = F.start(task, T0);
    s = F.pause(s, T0 + 5 * MIN);
    assert(F.isPaused(s), 'in pausa');
    assertEqual([F.remainingMs(s, T0 + 50 * MIN), F.endsAt(s)], [20 * MIN, null], 'fermo in pausa');
    s = F.resume(s, T0 + 15 * MIN);
    assertEqual([s.pausedTotalMs, F.remainingMs(s, T0 + 20 * MIN), F.endsAt(s)], [10 * MIN, 15 * MIN, T0 + 35 * MIN]);
    assertEqual(F.pause(F.pause(s, T0 + 21 * MIN), T0 + 22 * MIN).pausedAt, T0 + 21 * MIN, 'una seconda pausa non cambia nulla');
    assertEqual(F.resume(s, T0 + 30 * MIN), s, 'riprendere senza pausa non cambia nulla');
    assertEqual(F.pause(F.start(task, T0), T0 + 30 * MIN).pausedAt, null, 'a tempo finito non si va in pausa');
  });

  test('focus.extend: +5 min allunga; a tempo finito i minuti in più partono da adesso', () => {
    const s = F.start(task, T0);
    assertEqual(F.remainingMs(F.extend(s, T0 + 10 * MIN), T0 + 10 * MIN), 20 * MIN, 'mentre scorre');
    const late = F.extend(s, T0 + 40 * MIN); // finito da 15 minuti
    assertEqual([F.remainingMs(late, T0 + 40 * MIN), F.isFinished(late, T0 + 40 * MIN)], [5 * MIN, false]);
    assertEqual(F.sessionResult(late, T0 + 45 * MIN).minutes, 30, 'il tempo dopo la fine non conta come focus');
    assertEqual(F.extend(F.pause(s, T0 + MIN), T0 + 2 * MIN).durationMs, 30 * MIN, 'anche in pausa');
  });

  test('focus.sessionResult: minuti effettivi, pause escluse, al massimo la durata; sotto un minuto niente', () => {
    const s = F.start(task, T0);
    assertEqual(F.sessionResult(s, T0 + 12 * MIN + 20 * 1000), { minutes: 12, day: '2026-11-10' });
    assertEqual(F.sessionResult(s, T0 + 12 * MIN + 40 * 1000).minutes, 13, 'arrotondati al minuto');
    assertEqual(F.sessionResult(s, T0 + 59 * 1000).minutes, 0, 'meno di un minuto');
    assertEqual(F.sessionResult(s, T0 + 3 * 60 * MIN).minutes, 25, 'mai più della durata');
    const paused = F.resume(F.pause(s, T0 + 5 * MIN), T0 + 60 * MIN);
    assertEqual(F.sessionResult(paused, T0 + 70 * MIN).minutes, 15, '5 prima della pausa e 10 dopo');
  });

  test('focus.sessionResult: il giorno è quello in cui il focus si è fermato, anche a cavallo di mezzanotte', () => {
    const night = new Date(2026, 10, 10, 23, 50).getTime();
    const s = F.start(task, night); // il tempo finisce alle 00:15 di mercoledì
    assertEqual(F.sessionResult(s, night + 5 * MIN).day, '2026-11-10', 'fermato prima di mezzanotte');
    assertEqual(F.sessionResult(s, night + 60 * MIN).day, '2026-11-11', 'tempo finito dopo mezzanotte');
    assertEqual(F.sessionResult(F.pause(s, night + 5 * MIN), night + 60 * MIN).day, '2026-11-10', 'in pausa dalle 23:55');
  });

  test('focus.sessionResult: col cambio dell\'ora contano i minuti veri', () => {
    // Domenica 25/10/2026, in Italia, alle 3:00 l'orologio torna alle 2:00.
    const before = new Date(2026, 9, 25, 1, 50).getTime();
    const s = F.start({ id: 'x', duration: 90 }, before);
    assertEqual(F.sessionResult(s, before + 90 * MIN), { minutes: 90, day: '2026-10-25' });
  });

  test('focus.recordMinutes: aggiunge e toglie minuti a un giorno, senza toccare punti e serie', () => {
    const stats = { ...P.emptyStats(), totalPoints: 24, days: { '2026-11-10': { done: 1, points: 24 } } };
    const once = F.recordMinutes(stats, '2026-11-10', 25);
    const twice = F.recordMinutes(once, '2026-11-10', 10);
    assertEqual([F.minutesOn(twice, '2026-11-10'), F.totalMinutes(twice), twice.totalPoints, twice.days], [35, 35, 24, stats.days]);
    assertEqual(stats.focus, {}, 'il registro di prima non cambia');
    assertEqual(F.recordMinutes(twice, '2026-11-10', -35).focus, {}, 'tornato a 0, il giorno sparisce');
    assertEqual(F.recordMinutes(stats, '2026-11-10', 2000).focus, { '2026-11-10': 1440 }, 'al massimo un giorno intero');
    assertEqual(F.recordMinutes(stats, 'ieri', 10), stats, 'giorno non valido');
    assertEqual(F.recordMinutes(stats, '2026-11-10', 0), stats, 'niente da registrare');
    assertEqual(F.minutesOn({ totalPoints: 0, days: {} }, '2026-11-10'), 0, 'registro senza focus (v3)');
  });

  test('focus.clockLabel: mm:ss, con le ore se servono, arrotondato per eccesso', () => {
    assertEqual(
      [F.clockLabel(25 * MIN), F.clockLabel(25 * MIN - 1), F.clockLabel(61 * 1000), F.clockLabel(0), F.clockLabel(-5), F.clockLabel(65 * MIN)],
      ['25:00', '25:00', '01:01', '00:00', '00:00', '1:05:00']
    );
  });

  test('focus.sanitizeSession: sessioni rovinate → null; campi facoltativi ripuliti', () => {
    const good = F.start(task, T0);
    assertEqual(F.sanitizeSession(good), good);
    [null, 'testo', {}, { ...good, taskId: '' }, { ...good, startedAt: 'ieri' }, { ...good, durationMs: 0 }, { ...good, durationMs: 1.5 }, { ...good, durationMs: 25 * 60 * MIN }]
      .forEach(raw => assertEqual(F.sanitizeSession(raw), null, JSON.stringify(raw)));
    assertEqual(F.sanitizeSession({ ...good, pausedAt: T0 - 1, pausedTotalMs: -5 }), good, 'pausa prima dell\'inizio e totale negativo');
  });

  test('storage: loadFocus, saveFocus e clearFocus con un archivio finto', () => {
    const items = new Map();
    const area = { getItem: k => (items.has(k) ? items.get(k) : null), setItem: (k, v) => items.set(k, String(v)), removeItem: k => items.delete(k) };
    assertEqual(storage.loadFocus(area), null, 'nessun focus');
    const s = F.pause(F.start(task, T0), T0 + MIN);
    assert(storage.saveFocus(s, area), 'salvato');
    assertEqual(storage.loadFocus(area), s);
    items.set(storage.FOCUS_KEY, '{rotto');
    assertEqual(storage.loadFocus(area), null, 'illeggibile');
    storage.clearFocus(area);
    assertEqual(items.has(storage.FOCUS_KEY), false);
  });
})();
