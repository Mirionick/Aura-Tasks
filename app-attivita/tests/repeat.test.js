/*
 * Test delle attività che si ripetono (P-005, passo 5.1): le regole di js/repeat.js (pulizia, giorni, testi), la
 * prossima volta e «Salta questa volta» in js/tasks.js, i punti in js/points.js, la migrazione alla v7 e il backup.
 */
(function () {
  'use strict';

  const { test, assert, assertEqual } = window.AuraTest;
  const { utils, repeat: RP, tasks: T, points: P, storage } = window.Aura;

  const NOW = new Date(2026, 10, 18, 10, 30).getTime(); // mercoledì 18/11/2026 alle 10:30
  const TODAY = '2026-11-18';
  const DAY = { every: 'day' };
  const MON_THU = { every: 'week', days: [1, 4] };
  const MONDAY = { every: 'week', days: [1] };

  /** Un'attività che si ripete, da fare, con i campi di createTask(). */
  function repeating(overrides) {
    return {
      id: 'a', title: 'Palestra', duration: 60, energy: 'high', date: '2026-11-16', time: '18:00', done: false,
      createdAt: 1, completedAt: null, pointsAwarded: null, repeat: MON_THU, seriesId: 'a', ...overrides
    };
  }

  /* ---------- Regole ---------- */

  test('repeat.weekdayOf: 1 = lunedì … 7 = domenica', () => {
    assertEqual(['2026-11-16', '2026-11-18', '2026-11-21', '2026-11-22'].map(RP.weekdayOf), [1, 3, 6, 7]);
  });

  test('repeat.clean: regole valide, giorni in ordine e senza doppi, campi sconosciuti conservati', () => {
    assertEqual(RP.clean({ every: 'day' }), { every: 'day' });
    assertEqual(RP.clean({ every: 'week', days: [4, 1, 4, 9, 0, 2.5, '3'] }), { every: 'week', days: [1, 4] });
    assertEqual(RP.clean({ every: 'month', day: 31 }), { every: 'month', day: 31 });
    assertEqual(RP.clean({ every: 'week', days: [5], interval: 2 }), { every: 'week', days: [5], interval: 2 }, 'campo di una versione più nuova');
    const invalid = [null, undefined, 'day', 3, [], {}, { every: 'year' }, { every: 'week' }, { every: 'week', days: [] },
      { every: 'week', days: [0, 8] }, { every: 'month' }, { every: 'month', day: 0 }, { every: 'month', day: 32 }, { every: 'month', day: 1.5 }];
    assertEqual(invalid.map(RP.clean), invalid.map(() => null));
  });

  test('repeat.same e repeat.fromKind', () => {
    assert(RP.same(null, null) && RP.same(DAY, { every: 'day' }) && RP.same(MON_THU, { every: 'week', days: [1, 4] }));
    assert(!RP.same(DAY, null) && !RP.same(MON_THU, MONDAY) && !RP.same({ every: 'month', day: 3 }, { every: 'month', day: 4 }));
    assertEqual(['day', 'week', 'month', 'boh'].map(kind => RP.fromKind(kind, '2026-11-19')),
      [DAY, { every: 'week', days: [4] }, { every: 'month', day: 19 }, null], 'dal giovedì 19');
  });

  test('repeat.nextAfter: il primo giorno della regola dopo la data', () => {
    assertEqual(RP.nextAfter(DAY, '2026-12-31'), '2027-01-01');
    assertEqual(['2026-11-16', '2026-11-18', '2026-11-19', '2026-11-22'].map(day => RP.nextAfter(MON_THU, day)),
      ['2026-11-19', '2026-11-19', '2026-11-23', '2026-11-23']);
    assertEqual(RP.nextAfter(MONDAY, '2026-11-16'), '2026-11-23', 'una sola volta a settimana');
    assertEqual(RP.nextAfter({ every: 'month', day: 15 }, '2026-11-10'), '2026-11-15', 'nello stesso mese');
    assertEqual(RP.nextAfter({ every: 'month', day: 15 }, '2026-11-15'), '2026-12-15');
  });

  test('repeat.nextAfter: ogni mese il 31, il 30 e il 29 nei mesi più corti, poi si torna al giorno giusto', () => {
    const on31 = { every: 'month', day: 31 };
    const chain = ['2026-10-31'];
    for (let i = 0; i < 6; i++) chain.push(RP.nextAfter(on31, chain[chain.length - 1]));
    assertEqual(chain, ['2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
    assertEqual(RP.nextAfter({ every: 'month', day: 30 }, '2027-01-30'), '2027-02-28');
    assertEqual(RP.nextAfter({ every: 'month', day: 30 }, '2027-02-28'), '2027-03-30');
    assertEqual(RP.nextAfter({ every: 'month', day: 29 }, '2028-01-29'), '2028-02-29', 'anno bisestile');
    assertEqual(RP.nextAfter({ every: 'month', day: 29 }, '2027-01-29'), '2027-02-28', 'anno non bisestile');
    assertEqual(RP.nextAfter(on31, '2027-02-10'), '2027-02-28', 'l\'ultimo giorno di febbraio viene dopo il 10');
  });

  test('repeat: il cambio dell\'ora non sposta i giorni (25 ottobre 2026 e 29 marzo 2026)', () => {
    assertEqual(RP.nextAfter(DAY, '2026-10-24'), '2026-10-25');
    assertEqual(RP.nextAfter(DAY, '2026-10-25'), '2026-10-26');
    assertEqual(RP.nextAfter({ every: 'week', days: [7] }, '2026-10-18'), '2026-10-25');
    assertEqual(RP.nextAfter(DAY, '2026-03-29'), '2026-03-30');
    assertEqual(RP.onOrAfter(MON_THU, '2026-03-29'), '2026-03-30');
  });

  test('repeat.onOrAfter: il primo giorno della regola da quella data, compresa', () => {
    assertEqual(RP.onOrAfter(MON_THU, '2026-11-16'), '2026-11-16');
    assertEqual(RP.onOrAfter(MON_THU, '2026-11-17'), '2026-11-19');
    assertEqual(RP.onOrAfter({ every: 'month', day: 31 }, '2026-11-18'), '2026-11-30');
  });

  test('repeat.afterDone: dopo il più tardi tra il suo giorno e oggi (gli esempi di P-005)', () => {
    assertEqual(RP.afterDone(MONDAY, '2026-11-23', '2026-11-21'), '2026-11-30', 'quella di lunedì fatta il sabato prima: non lo stesso lunedì');
    assertEqual(RP.afterDone(DAY, '2026-11-16', TODAY), '2026-11-19', 'quella di lunedì fatta il mercoledì: giovedì');
    assertEqual(RP.afterDone(DAY, TODAY, TODAY), '2026-11-19');
    assertEqual(RP.afterDone(MON_THU, '2026-11-16', TODAY), '2026-11-19');
  });

  test('repeat.afterSkip: al primo giorno della regola dopo il suo, ma non prima di oggi (gli esempi di P-005)', () => {
    assertEqual(RP.afterSkip(DAY, TODAY, TODAY), '2026-11-19', 'quella di oggi passa a domani');
    assertEqual(RP.afterSkip(DAY, '2026-11-16', TODAY), TODAY, 'quella di lunedì, saltata il mercoledì, passa a oggi');
    assertEqual(RP.afterSkip(MONDAY, '2026-11-16', TODAY), '2026-11-23', 'ogni lunedì, saltata il mercoledì: il lunedì dopo');
    assertEqual(RP.afterSkip(MONDAY, '2026-11-16', '2026-11-23'), '2026-11-23', 'saltata il lunedì dopo: oggi');
    assertEqual(RP.afterSkip(DAY, '2026-11-20', TODAY), '2026-11-21', 'una volta futura passa al giorno dopo il suo');
  });

  test('repeat: completare o saltare non lascia mai la ripetizione in un giorno passato (tutte le combinazioni)', () => {
    const rules = [DAY, MONDAY, MON_THU, { every: 'week', days: [6, 7] }, { every: 'month', day: 1 }, { every: 'month', day: 31 }];
    const today = '2027-02-27';
    let checked = 0;
    rules.forEach(rule => {
      for (let offset = -40; offset <= 40; offset += 3) {
        const date = utils.addDays(today, offset);
        const done = RP.afterDone(rule, date, today);
        const skipped = RP.afterSkip(rule, date, today);
        assert(done > today && done > date, 'completata ' + JSON.stringify(rule) + ' ' + date + ' → ' + done);
        assert(skipped >= today && skipped > date, 'saltata ' + JSON.stringify(rule) + ' ' + date + ' → ' + skipped);
        assertEqual(RP.onOrAfter(rule, skipped), skipped, 'è un giorno della regola');
        checked++;
      }
    });
    assertEqual(checked, 6 * 27);
  });

  /* ---------- Testi ---------- */

  test('repeat.label e spokenLabel', () => {
    const rules = [DAY, MON_THU, MONDAY, { every: 'week', days: [1, 3, 5] }, { every: 'week', days: [1, 2, 3, 4, 5] },
      { every: 'week', days: [1, 2, 3, 4, 5, 6, 7] }, { every: 'week', days: [6, 7] }, { every: 'month', day: 1 },
      { every: 'month', day: 30 }, { every: 'month', day: 31 }];
    assertEqual(rules.map(RP.label), ['Ogni giorno', 'Ogni lunedì e giovedì', 'Ogni lunedì', 'Ogni lunedì, mercoledì e venerdì',
      'Dal lunedì al venerdì', 'Ogni giorno', 'Ogni sabato e domenica', 'Ogni mese, il giorno 1',
      'Ogni mese, il giorno 30 (a febbraio l\'ultimo)', 'Ogni mese, l\'ultimo giorno']);
    assertEqual([MON_THU, { every: 'week', days: [1, 2, 3, 4, 5] }].map(RP.spokenLabel),
      ['Si ripete ogni lunedì e giovedì', 'Si ripete dal lunedì al venerdì']);
  });

  test('repeat.dayLabel e returnLabel: i giorni negli avvisi', () => {
    assertEqual(['2026-11-18', '2026-11-19', '2026-11-26', '2027-01-04'].map(day => RP.dayLabel(day, TODAY)),
      ['oggi', 'domani', 'giovedì 26 novembre', 'lunedì 4 gennaio 2027']);
    assertEqual(['2026-11-19', '2026-11-20', '2026-11-24', '2026-11-25'].map(day => RP.returnLabel(day, TODAY)),
      ['domani', 'venerdì', 'martedì', 'mercoledì 25 novembre']);
  });

  /* ---------- Pulizia dei campi di un'attività ---------- */

  test('repeat.sanitize: regola solo con un giorno; serie non valida → l\'id dell\'attività', () => {
    assertEqual(RP.sanitize({ id: 'a', date: TODAY, repeat: MON_THU, seriesId: 's' }), { repeat: MON_THU, seriesId: 's' });
    assertEqual(RP.sanitize({ id: 'a', date: null, repeat: MON_THU, seriesId: 's' }), { repeat: null, seriesId: 's' }, 'senza giorno non si ripete');
    assertEqual(RP.sanitize({ id: 'a', date: TODAY, repeat: { every: 'year' } }), { repeat: null, seriesId: null }, 'regola non valida');
    assertEqual(RP.sanitize({ id: 'a', date: TODAY, repeat: DAY }), { repeat: DAY, seriesId: 'a' }, 'serie mancante');
    assertEqual(RP.sanitize({ id: 'a', date: TODAY, repeat: null, seriesId: 5 }), { repeat: null, seriesId: 'a' }, 'serie non valida');
    assertEqual(RP.sanitize({ id: 'a', date: TODAY, repeat: null, seriesId: 'x'.repeat(101) }), { repeat: null, seriesId: 'a' });
    assertEqual(RP.sanitize({ id: 'a', date: null }), { repeat: null, seriesId: null }, 'un\'attività normale');
  });

  /* ---------- Il foglio: controllo, creazione e modifica ---------- */

  test('tasks.validateInput: «Si ripete» ha bisogno di un giorno e di una regola valida', () => {
    const base = { title: 'Palestra', duration: 60, energy: 'high', date: TODAY, time: '18:00' };
    assertEqual(T.validateInput({ ...base, repeat: { every: 'week', days: [4, 1] } }).value.repeat, MON_THU);
    assertEqual(T.validateInput(base).value.repeat, null, 'senza «Si ripete»');
    assertEqual(T.validateInput({ ...base, date: null, time: null, repeat: DAY }).errors,
      { repeat: 'Per ripeterla scegli anche il giorno.' });
    assertEqual(T.validateInput({ ...base, repeat: { every: 'week', days: [] } }).errors, { repeat: 'La ripetizione non è valida.' });
  });

  test('tasks.createTask: una ripetizione è la prima volta della sua serie', () => {
    const value = T.validateInput({ title: 'Palestra', duration: 60, energy: 'high', date: TODAY, time: null, repeat: DAY }).value;
    const task = T.createTask(value, NOW);
    assertEqual([task.repeat, task.seriesId], [DAY, task.id]);
    const plain = T.createTask({ ...value, repeat: null }, NOW);
    assertEqual([plain.repeat, plain.seriesId], [null, null]);
  });

  test('tasks.updateTask: cambiare la regola è una modifica; la stessa regola no; una regola nuova ha la sua serie', () => {
    const task = repeating();
    const same = T.updateTask([task], 'a', { ...T.editableFields(task), repeat: { every: 'week', days: [1, 4] } });
    assertEqual(same.changed, false, 'stessa regola in un oggetto nuovo');
    const changed = T.updateTask([task], 'a', { ...T.editableFields(task), repeat: MONDAY });
    assertEqual([changed.changed, changed.tasks[0].repeat, changed.tasks[0].seriesId], [true, MONDAY, 'a']);
    const stopped = T.updateTask([task], 'a', { ...T.editableFields(task), repeat: null });
    assertEqual([stopped.tasks[0].repeat, stopped.tasks[0].seriesId], [null, 'a'], '«Si ripete: Mai» ferma la serie');

    const plain = { ...repeating({ id: 'p', repeat: null, seriesId: null }) };
    const started = T.updateTask([plain], 'p', { ...T.editableFields(plain), repeat: DAY });
    assertEqual([started.tasks[0].repeat, started.tasks[0].seriesId], [DAY, 'p']);
  });

  test('tasks.updateTask: una volta tornata da fare senza regola, se riprende a ripetersi, comincia una serie nuova', () => {
    const first = repeating({ id: 'a', repeat: null, seriesId: 'a', date: '2026-11-16' }); // la prima volta, tornata da fare
    const open = repeating({ id: 'b', seriesId: 'a', date: '2026-11-19' });                   // la prossima della serie
    const result = T.updateTask([first, open], 'a', { ...T.editableFields(first), repeat: DAY });
    const updated = result.tasks[0];
    assert(updated.seriesId !== 'a' && typeof updated.seriesId === 'string' && updated.seriesId.length > 0, 'serie nuova');
    assertEqual(T.openInSeries(result.tasks, 'a', 'x').id, 'b', 'la serie di prima continua con la sua prossima');
  });

  /* ---------- Completare, togliere la spunta, «Annulla» ---------- */

  test('tasks.toggleDone: completando una ripetizione arriva la prossima, con gli stessi campi e la stessa serie', () => {
    const task = repeating();
    const { tasks, next } = T.toggleDone([task], 'a', true, NOW, 44);
    assertEqual(tasks.length, 2);
    assertEqual([tasks[0].done, tasks[0].pointsAwarded, tasks[0].repeat, tasks[0].completedAt], [true, 44, MON_THU, NOW], 'la completata tiene la sua regola');
    assertEqual(tasks[1], next);
    assert(next.id !== 'a' && typeof next.id === 'string', 'id nuovo');
    assertEqual({ ...next, id: 'x' }, {
      id: 'x', title: 'Palestra', duration: 60, energy: 'high', date: '2026-11-19', time: '18:00', done: false,
      createdAt: NOW, completedAt: null, pointsAwarded: null, repeat: MON_THU, seriesId: 'a'
    }, 'quella di lunedì fatta il mercoledì: giovedì, con la stessa ora');
  });

  test('tasks.toggleDone: una sola prossima per serie, e niente per un\'attività normale', () => {
    const task = repeating();
    const first = T.toggleDone([task], 'a', true, NOW, 44);
    const again = T.toggleDone(first.tasks, 'a', true, NOW + 1, 44);
    assertEqual([again.tasks, again.next], [first.tasks, null], 'già completata: niente cambia');
    const twoOpen = [repeating(), repeating({ id: 'b', date: '2026-11-19' })];
    assertEqual(T.toggleDone(twoOpen, 'a', true, NOW, 44).next, null, 'c\'è già una da fare nella serie');
    const plain = T.toggleDone([repeating({ repeat: null, seriesId: null })], 'a', true, NOW, 44);
    assertEqual([plain.tasks.length, plain.next], [1, null]);
  });

  test('tasks.toggleDone: togliendo la spunta, con la prossima da fare torna da fare senza regola; senza, con la regola', () => {
    const { tasks, next } = T.toggleDone([repeating()], 'a', true, NOW, 44);
    const later = T.toggleDone(tasks, 'a', false, NOW + 1000);
    assertEqual([later.tasks[0].done, later.tasks[0].repeat, later.tasks[0].seriesId], [false, null, 'a'], 'era davvero da fare');
    assertEqual(later.tasks[1], next, 'la serie continua con la sua prossima');
    const alone = T.toggleDone(T.removeTask(tasks, next.id).tasks, 'a', false, NOW + 1000);
    assertEqual([alone.tasks.length, alone.tasks[0].repeat], [1, MON_THU], 'la prossima non c\'è più: torna con la regola');
  });

  test('points.setDone e «Annulla»: punti una volta sola, la prossima nel risultato; annullare rimette tutto com\'era', () => {
    const state = { tasks: [repeating()], stats: P.emptyStats() };
    const result = P.setDone(state, 'a', true, NOW);
    assertEqual([result.points, result.stats.totalPoints, result.tasks.length], [44, 44, 2]);
    assertEqual(result.next.date, '2026-11-19');
    // «Annulla» (js/app.js): prima si toglie la prossima, poi si toglie la spunta.
    const without = T.removeTask(result.tasks, result.next.id).tasks;
    const undo = P.setDone({ tasks: without, stats: result.stats }, 'a', false, NOW + 2000);
    assertEqual([undo.tasks, undo.stats.totalPoints, undo.next], [state.tasks, 0, null], 'come prima del completamento');
  });

  test('tasks.skipOccurrence: «Salta questa volta» sposta solo una ripetizione da fare, senza punti', () => {
    const task = repeating({ repeat: DAY });
    const result = T.skipOccurrence([task], 'a', TODAY);
    assertEqual([result.date, result.tasks[0].date, result.previous], [TODAY, TODAY, task], 'quella di lunedì passa a oggi');
    assertEqual([result.tasks[0].done, result.tasks[0].pointsAwarded], [false, null]);
    const again = T.skipOccurrence(result.tasks, 'a', TODAY);
    assertEqual(again.date, '2026-11-19', 'quella di oggi passa a domani');
    const plain = [repeating({ repeat: null })];
    assertEqual(T.skipOccurrence(plain, 'a', TODAY), { tasks: plain, previous: null, date: null });
    const done = [repeating({ done: true, completedAt: NOW, pointsAwarded: 44 })];
    assertEqual(T.skipOccurrence(done, 'a', TODAY).date, null, 'una volta completata non si salta');
  });

  /* ---------- Dati: migrazione e backup ---------- */

  test('migrazione: i dati della v6 arrivano all\'ultima versione; le attività che c\'erano non si ripetono', () => {
    const tasks = [
      { id: 'a', title: 'Fatta', duration: 30, energy: 'medium', date: '2026-11-17', time: null, done: true, createdAt: 1, completedAt: 5, pointsAwarded: 24 },
      { id: 'b', title: 'Da fare', duration: 15, energy: 'low', date: null, time: null, done: false, createdAt: 2, completedAt: null, pointsAwarded: null }
    ];
    const state = storage.parse(JSON.stringify({ version: 6, tasks, rewards: [], stats: P.emptyStats(), look: { aurora: 'aurora', confetti: 'classic', at: 0 } }));
    assertEqual(state.version, storage.SCHEMA_VERSION);
    assertEqual(state.tasks, tasks.map(task => ({ ...task, repeat: null, seriesId: null })));
  });

  test('storage: le regole lette si puliscono come il resto', () => {
    const raw = JSON.stringify({ version: 7, tasks: [
      repeating({ id: 'ok', repeat: { every: 'week', days: [4, 1] } }),
      repeating({ id: 'senza-giorno', date: null, time: null }),
      repeating({ id: 'rotta', repeat: { every: 'year' }, seriesId: 42 })
    ] });
    const state = storage.parse(raw);
    assertEqual(state.tasks.map(task => [task.id, task.repeat, task.seriesId]),
      [['ok', MON_THU, 'a'], ['senza-giorno', null, 'a'], ['rotta', null, 'rotta']]);
  });

  test('backup: esporta e importa regole e serie', () => {
    const state = {
      version: storage.SCHEMA_VERSION,
      tasks: [repeating({ done: true, completedAt: NOW, pointsAwarded: 44 }), repeating({ id: 'b', date: '2026-11-19' })],
      rewards: [],
      stats: P.emptyStats(),
      look: { aurora: 'aurora', confetti: 'classic', sound: 'none', at: 0 }
    };
    const file = storage.backupFile(state, NOW);
    assertEqual(JSON.parse(file.text).data.tasks.map(task => [task.repeat, task.seriesId]), [[MON_THU, 'a'], [MON_THU, 'a']]);
    const back = storage.readBackup(file.text);
    assertEqual([back.error, back.state], [null, state], 'andata e ritorno identici');
  });
})();
