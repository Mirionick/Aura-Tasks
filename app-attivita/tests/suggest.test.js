/* Test di «Cosa faccio adesso?» (js/suggest.js). Il caso è spento (random: () => 0.5) tranne dove serve. */
(function () {
  'use strict';

  const { test, assert, assertEqual } = window.AuraTest;
  const { suggest: S } = window.Aura;

  const TODAY = '2026-11-10';
  const day = (d, h) => new Date(2026, 10, d, h || 9).getTime();
  const calm = () => 0.5;

  function make(overrides) {
    return {
      id: 'id-' + Math.random().toString(36).slice(2, 8), title: 'Prova', duration: 30, energy: 'medium', date: null, time: null,
      done: false, createdAt: day(10), completedAt: null, pointsAwarded: null,
      ...overrides
    };
  }
  const run = (tasks, options) => S.suggest(tasks, { today: TODAY, random: calm, ...options });
  const ids = result => (result.best ? [result.best.task.id] : []).concat(result.alternatives.map(item => item.task.id));

  test('suggest: candidate solo da fare adesso, che stanno nel tempo e nell\'energia', () => {
    const list = [
      make({ id: 'ok' }),
      make({ id: 'fatta', done: true, completedAt: 1 }),
      make({ id: 'lunga', duration: 45 }),
      make({ id: 'impegnativa', energy: 'high' }),
      make({ id: 'domani', date: '2026-11-11' }),
      make({ id: 'leggera', energy: 'low', duration: 10 })
    ];
    assertEqual(ids(run(list, { minutes: 30, energy: 'medium' })).sort(), ['leggera', 'ok']);
    assertEqual(ids(run(list, { minutes: 30, energy: 'low' })), ['leggera'], 'con poca energia solo le attività leggere');
    const open = run(list, { minutes: null, energy: 'high' });
    assertEqual([open.alternatives.length, ids(open).includes('domani'), ids(open).includes('fatta')], [2, false, false], '«120+» ed energia alta');
  });

  test('suggest: in ritardo prima di oggi, oggi prima di senza data', () => {
    const list = [make({ id: 'senza' }), make({ id: 'oggi', date: TODAY }), make({ id: 'ritardo', date: '2026-11-09' })];
    assertEqual(ids(run(list, { minutes: 30, energy: 'medium' })), ['ritardo', 'oggi', 'senza']);
  });

  test('suggest.score: i pesi della specifica', () => {
    const opts = { minutes: 30, energy: 'medium', today: TODAY, random: calm };
    const base = make({ duration: 15, energy: 'low', createdAt: day(10) }); // tempo: 20 × 15 / 30 = 10; energia diversa; nuova
    assertEqual(S.score({ ...base, date: null }, opts), 10 + 10, 'senza data');
    assertEqual(S.score({ ...base, date: TODAY }, opts), 30 + 10, 'oggi');
    assertEqual(S.score({ ...base, date: '2026-11-08' }, opts), 50 + 10 + 10, 'in ritardo da 2 giorni');
    assertEqual(S.score({ ...base, date: '2026-10-20' }, opts), 50 + 30 + 10, 'ritardo: al massimo +30');
    assertEqual(S.score({ ...base, energy: 'medium' }, opts), 10 + 10 + 10, 'stessa energia: +10');
    assertEqual(S.score({ ...base, createdAt: day(1) }, opts), 10 + 10 + 4, 'creata 9 giorni fa: +4');
    assertEqual(S.score({ ...base, createdAt: new Date(2026, 8, 1).getTime() }, opts), 10 + 10 + 10, 'anzianità: al massimo +10');
    assertEqual(S.score(base, { ...opts, random: () => 0 }), 20 - 5, 'caso: fino a -5…');
    assertEqual(S.score(base, { ...opts, random: () => 1 }), 20 + 5, '…e fino a +5');
    assertEqual(S.score({ ...base, duration: 200 }, { ...opts, minutes: null }), 10 + 20, '«120+» conta come 120 minuti');
  });

  test('suggest: a parità di urgenza vince quella che usa meglio il tempo', () => {
    const list = [make({ id: 'corta', duration: 10 }), make({ id: 'giusta', duration: 30 })];
    assertEqual(ids(run(list, { minutes: 30, energy: 'medium' }))[0], 'giusta');
  });

  test('suggest: «Un\'altra proposta» salta quelle già proposte', () => {
    const list = [make({ id: 'a', date: '2026-11-08' }), make({ id: 'b', date: TODAY }), make({ id: 'c' })];
    assertEqual(run(list, { exclude: ['a'] }).best.task.id, 'b');
    assertEqual(run(list, { exclude: ['a', 'b', 'c'] }).fallback, { kind: 'exhausted' });
  });

  test('suggest: il motivo in italiano', () => {
    const reason = (overrides, minutes) => run([make(overrides)], { minutes, energy: 'high' }).best.reason;
    assertEqual(reason({ date: '2026-11-08', duration: 20 }, 30), 'È in ritardo da 2 giorni e ci sta nei tuoi 30 minuti');
    assertEqual(reason({ date: '2026-11-09', duration: 15 }, 30), 'È in ritardo da ieri e ci sta nei tuoi 30 minuti');
    assertEqual(reason({ date: TODAY, time: '15:00', duration: 45 }, 45), 'È per oggi alle 15:00 e occupa giusto i tuoi 45 minuti');
    assertEqual(reason({ date: TODAY }, 90), 'È per oggi e ci sta nella tua ora e mezza');
    assertEqual(reason({ date: TODAY, duration: 60 }, 60), 'È per oggi e occupa giusto la tua ora');
    assertEqual(reason({ createdAt: day(1) }, null), 'Aspetta da 9 giorni e dura 30 minuti');
    assertEqual(reason({ duration: 75 }, null), 'Non ha una data e dura 1 h 15 min');
    assertEqual(reason({}, 60), 'Non ha una data e ci sta nella tua ora');
  });

  test('suggest: niente da proporre → con più tempo, una pausa, oppure niente da fare', () => {
    const lunga = make({ id: 'lunga', duration: 40 });
    const tanta = make({ id: 'tanta', duration: 100 });
    assertEqual(run([lunga, tanta], { minutes: 30 }).fallback, { kind: 'more-time', task: lunga, minutes: 45 });
    assertEqual(run([tanta], { minutes: 30 }).fallback.minutes, null, 'serve «120+»');
    const alta = make({ id: 'alta', energy: 'high', duration: 20 });
    const altaLunga = make({ id: 'alta-lunga', energy: 'high', duration: 60 });
    assertEqual(run([altaLunga, alta], { minutes: 30, energy: 'low' }).fallback, { kind: 'rest', task: alta }, 'poca energia: la più breve');
    assertEqual(run([make({ date: '2026-11-12' })], {}).fallback, { kind: 'rest', task: null }, 'niente da fare adesso');
    assertEqual([run([], {}).best, run([], {}).alternatives], [null, []]);
  });

  test('suggest: al massimo due alternative, in ordine di punteggio', () => {
    const list = ['a', 'b', 'c', 'd'].map((id, i) => make({ id, date: i === 0 ? TODAY : null, duration: 30 - i }));
    const result = run(list, {});
    assertEqual(ids(result), ['a', 'b', 'c']);
    assert(result.alternatives[0].score >= result.alternatives[1].score, 'ordinate');
  });

  test('suggest.countNow conta le attività da fare adesso', () => {
    const list = [make({}), make({ date: TODAY }), make({ date: '2026-11-11' }), make({ done: true, completedAt: 1 })];
    assertEqual(S.countNow(list, TODAY), 2);
  });
})();
