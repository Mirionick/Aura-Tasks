/* Test della logica pura di js/points.js: punti, registro dei giorni, serie e traguardi. */
(function () {
  'use strict';

  const { test, assert, assertEqual } = window.AuraTest;
  const { tasks: T, points: P } = window.Aura;

  // Istante in ora locale, nell'ottobre 2026 (giovedì 29 = "oggi" negli esempi di CLAUDE.md).
  const at = (day, hour, minute = 0) => new Date(2026, 9, day, hour, minute).getTime();

  function task(overrides) {
    return {
      id: 't', title: 'Prova', duration: 30, energy: 'medium', date: null,
      done: false, createdAt: 1, completedAt: null, pointsAwarded: null,
      ...overrides
    };
  }

  function state(tasks, stats) {
    return { tasks, stats: { ...P.emptyStats(), ...stats } };
  }

  // Registro con un completamento in ciascuno dei giorni indicati.
  function daysOf(list) {
    const days = {};
    list.forEach(day => { days[day] = { done: 1, points: 10 }; });
    return days;
  }

  /* ---------- Formula ---------- */

  test('pointsFor: gli esempi di CLAUDE.md', () => {
    assertEqual(P.pointsFor(task({ duration: 15, energy: 'low' })), 13);
    assertEqual(P.pointsFor(task({ duration: 30, energy: 'medium' })), 24);
    assertEqual(P.pointsFor(task({ duration: 60, energy: 'high' })), 44);
    assertEqual(P.pointsFor(task({ duration: 120, energy: 'high' })), 68);
  });

  test('pointsFor: oltre 2 ore non conta di più, e il risultato è arrotondato', () => {
    assertEqual(P.pointsFor(task({ duration: 600, energy: 'high' })), 68);
    assertEqual(P.pointsFor(task({ duration: 5, energy: 'medium' })), 17, '16,5 → 17');
    assertEqual(P.pointsFor(task({ duration: 1, energy: 'low' })), 10, '10,2 → 10');
  });

  /* ---------- Completare e annullare ---------- */

  test('setDone: completare dà i punti e li registra nel giorno', () => {
    const r = P.setDone(state([task()]), 't', true, at(29, 10));
    assertEqual([r.tasks[0].done, r.tasks[0].completedAt, r.tasks[0].pointsAwarded], [true, at(29, 10), 24]);
    assertEqual(r.stats.days, { '2026-10-29': { done: 1, points: 24 } });
    assertEqual([r.stats.totalPoints, r.points, r.streak, r.reached], [24, 24, 1, []]);
  });

  test('setDone: annullare toglie i punti dati allora, non quelli ricalcolati', () => {
    const before = state(
      [task({ done: true, completedAt: at(29, 9), pointsAwarded: 99 })],
      { totalPoints: 99, days: { '2026-10-29': { done: 1, points: 99 } } }
    );
    const r = P.setDone(before, 't', false, at(29, 10));
    assertEqual([r.tasks[0].done, r.tasks[0].completedAt, r.tasks[0].pointsAwarded], [false, null, null]);
    assertEqual([r.stats.totalPoints, r.points], [0, 99]);
    assertEqual(r.stats.days, {}, 'il giorno rimasto senza completamenti sparisce');
  });

  test('setDone: annullare un completamento di ieri toglie da ieri', () => {
    const before = state(
      [task({ done: true, completedAt: at(28, 22), pointsAwarded: 24 })],
      { totalPoints: 61, days: { '2026-10-28': { done: 2, points: 48 }, '2026-10-29': { done: 1, points: 13 } } }
    );
    const r = P.setDone(before, 't', false, at(29, 10));
    assertEqual(r.stats.days, { '2026-10-28': { done: 1, points: 24 }, '2026-10-29': { done: 1, points: 13 } });
    assertEqual(r.stats.totalPoints, 37);
  });

  test('setDone: a cavallo della mezzanotte conta il giorno locale del completamento', () => {
    const list = [task({ id: 'a' }), task({ id: 'b' })];
    const first = P.setDone(state(list), 'a', true, at(28, 23, 59));
    const second = P.setDone({ tasks: first.tasks, stats: first.stats }, 'b', true, at(29, 0, 1));
    assertEqual(Object.keys(second.stats.days).sort(), ['2026-10-28', '2026-10-29']);
    assertEqual(second.streak, 2);
  });

  test('setDone: se non c\'è niente da cambiare restituisce gli stessi oggetti', () => {
    const before = state([task({ done: true, completedAt: at(29, 9), pointsAwarded: 24 })]);
    const again = P.setDone(before, 't', true, at(29, 10));
    assert(again.tasks === before.tasks && again.stats === before.stats, 'già completata');
    const missing = P.setDone(before, 'inesistente', true, at(29, 10));
    assert(missing.tasks === before.tasks && missing.points === 0, 'id inesistente');
  });

  test('Eliminare un\'attività completata non toglie punti', () => {
    const r = P.setDone(state([task()]), 't', true, at(29, 10));
    const { tasks } = T.removeTask(r.tasks, 't');
    const after = { tasks, stats: r.stats };
    assertEqual(after.tasks.length, 0);
    assertEqual([after.stats.totalPoints, P.dayTotals(after.stats, '2026-10-29').done], [24, 1]);
  });

  test('dayTotals: zero per un giorno senza completamenti', () => {
    const stats = { ...P.emptyStats(), days: { '2026-10-29': { done: 2, points: 37 } } };
    assertEqual(P.dayTotals(stats, '2026-10-29'), { done: 2, points: 37 });
    assertEqual(P.dayTotals(stats, '2026-10-28'), { done: 0, points: 0 });
  });

  /* ---------- Serie ---------- */

  test('currentStreak: giorni consecutivi fino a oggi', () => {
    assertEqual(P.currentStreak(daysOf(['2026-10-27', '2026-10-28', '2026-10-29']), '2026-10-29'), 3);
  });

  test('currentStreak: con oggi vuoto parte da ieri (la serie è viva fino a mezzanotte)', () => {
    assertEqual(P.currentStreak(daysOf(['2026-10-27', '2026-10-28']), '2026-10-29'), 2);
    assertEqual(P.currentStreak(daysOf(['2026-10-27']), '2026-10-29'), 0, 'anche ieri vuoto: serie finita');
    assertEqual(P.currentStreak({}, '2026-10-29'), 0);
  });

  test('currentStreak: un giorno saltato interrompe la serie', () => {
    assertEqual(P.currentStreak(daysOf(['2026-10-25', '2026-10-26', '2026-10-28', '2026-10-29']), '2026-10-29'), 2);
  });

  test('Serie attraverso i cambi dell\'ora e il capodanno', () => {
    // In Italia nel 2026 l'ora legale inizia il 29 marzo e finisce il 25 ottobre.
    const spring = daysOf(['2026-03-28', '2026-03-29', '2026-03-30']);
    const autumn = daysOf(['2026-10-24', '2026-10-25', '2026-10-26']);
    const newYear = daysOf(['2026-12-30', '2026-12-31', '2027-01-01']);
    assertEqual(P.currentStreak(spring, '2026-03-30'), 3);
    assertEqual(P.currentStreak(autumn, '2026-10-26'), 3);
    assertEqual(P.currentStreak(newYear, '2027-01-01'), 3);
    assertEqual([P.longestStreak(spring), P.longestStreak(autumn), P.longestStreak(newYear)], [3, 3, 3]);
  });

  test('longestStreak: la serie più lunga di tutto il registro', () => {
    const days = daysOf(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-10', '2026-10-11']);
    days['2026-10-12'] = { done: 0, points: 0 }; // giorno vuoto: non conta
    assertEqual(P.longestStreak(days), 4);
    assertEqual(P.longestStreak({}), 0);
  });

  test('bestStreak segue il registro, anche dopo "Annulla"', () => {
    const before = state([task()], { days: daysOf(['2026-10-27', '2026-10-28']), bestStreak: 2 });
    const done = P.setDone(before, 't', true, at(29, 10));
    assertEqual(done.stats.bestStreak, 3);
    const undone = P.setDone({ tasks: done.tasks, stats: done.stats }, 't', false, at(29, 11));
    assertEqual(undone.stats.bestStreak, 2);
  });

  /* ---------- Traguardi ---------- */

  test('Traguardi: si festeggiano una volta sola e restano dopo "Annulla"', () => {
    const before = state([task()], { days: daysOf(['2026-10-27', '2026-10-28']) });
    const first = P.setDone(before, 't', true, at(29, 10));
    assertEqual([first.streak, first.reached, first.stats.milestones], [3, [3], [3]]);
    const undone = P.setDone({ tasks: first.tasks, stats: first.stats }, 't', false, at(29, 11));
    assertEqual(undone.stats.milestones, [3], 'resta registrato');
    const again = P.setDone({ tasks: undone.tasks, stats: undone.stats }, 't', true, at(29, 12));
    assertEqual(again.reached, [], 'niente seconda festa');
  });

  test('Traguardi: più traguardi in una volta, e il prossimo traguardo', () => {
    const days = daysOf(['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28']);
    const r = P.setDone(state([task()], { days }), 't', true, at(29, 10));
    assertEqual([r.streak, r.reached], [7, [3, 7]]);
    assertEqual(P.POINTS.milestones, [3, 7, 14, 30, 100]);
    assertEqual([P.nextMilestone(0), P.nextMilestone(3), P.nextMilestone(7), P.nextMilestone(99), P.nextMilestone(100)], [3, 7, 14, 100, null]);
  });

  /* ---------- Migrazione ---------- */

  test('rebuildStats ricostruisce il registro dalle attività completate', () => {
    const stats = P.rebuildStats([
      task({ id: 'a', done: true, completedAt: at(27, 9), pointsAwarded: 30 }),
      task({ id: 'b', done: true, completedAt: at(28, 9), duration: 15, energy: 'low' }), // senza punti: 13
      task({ id: 'c', done: true, completedAt: at(28, 20), pointsAwarded: 24 }),
      task({ id: 'd' })
    ]);
    assertEqual(stats.days, { '2026-10-27': { done: 1, points: 30 }, '2026-10-28': { done: 2, points: 37 } });
    assertEqual([stats.totalPoints, stats.bestStreak, stats.milestones], [67, 2, []]);
  });
})();
