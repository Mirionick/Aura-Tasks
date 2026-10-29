/* Test della logica pura: js/utils.js, js/tasks.js, js/storage.js. */
(function () {
  'use strict';

  const { test, assert, assertEqual } = window.AuraTest;
  const { utils, tasks: T, storage } = window.Aura;

  // Attività di prova con tutti i campi; `overrides` cambia solo quelli che servono.
  function make(overrides) {
    return {
      id: 'id-' + Math.random().toString(36).slice(2, 8),
      title: 'Prova',
      duration: 30,
      energy: 'medium',
      date: null,
      done: false,
      createdAt: 1,
      completedAt: null,
      ...overrides
    };
  }

  /* ---------- Date ---------- */

  test('toISODate usa l\'ora locale anche subito dopo mezzanotte', () => {
    assertEqual(utils.toISODate(new Date(2026, 9, 29, 0, 30)), '2026-10-29');
    assertEqual(utils.toISODate(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  });

  test('isISODate accetta solo date reali', () => {
    assert(utils.isISODate('2026-02-28'), '28 febbraio');
    assert(utils.isISODate('2028-02-29'), '29 febbraio di un anno bisestile');
    assert(!utils.isISODate('2026-02-29'), '29 febbraio di un anno non bisestile');
    assert(!utils.isISODate('2026-13-01'), 'mese 13');
    assert(!utils.isISODate('29/10/2026'), 'formato italiano');
    assert(!utils.isISODate(''), 'stringa vuota');
    assert(!utils.isISODate(null), 'null');
  });

  test('addDays attraversa mesi, anni e anni bisestili', () => {
    assertEqual(utils.addDays('2026-12-31', 1), '2027-01-01');
    assertEqual(utils.addDays('2027-01-01', -1), '2026-12-31');
    assertEqual(utils.addDays('2026-03-01', -1), '2026-02-28');
    assertEqual(utils.addDays('2028-02-28', 1), '2028-02-29');
    assertEqual(utils.addDays('2026-10-29', 7), '2026-11-05');
  });

  test('addDays e daysBetween non risentono del cambio dell\'ora', () => {
    // In Italia nel 2026 l'ora legale inizia il 29 marzo e finisce il 25 ottobre.
    assertEqual(utils.addDays('2026-03-28', 1), '2026-03-29');
    assertEqual(utils.addDays('2026-03-29', 1), '2026-03-30');
    assertEqual(utils.addDays('2026-10-25', 1), '2026-10-26');
    assertEqual(utils.daysBetween('2026-03-28', '2026-03-30'), 2);
    assertEqual(utils.daysBetween('2026-10-24', '2026-10-26'), 2);
    assertEqual(utils.daysBetween('2026-10-29', '2026-10-28'), -1);
    assertEqual(utils.daysBetween('2026-12-31', '2027-01-01'), 1);
  });

  test('formatDuration', () => {
    assertEqual(utils.formatDuration(0), '0 min');
    assertEqual(utils.formatDuration(5), '5 min');
    assertEqual(utils.formatDuration(60), '1 h');
    assertEqual(utils.formatDuration(90), '1 h 30 min');
    assertEqual(utils.formatDuration(135), '2 h 15 min');
  });

  test('formatDateLabel: Oggi, Domani, Ieri e date brevi in italiano', () => {
    const today = '2026-10-29';
    assertEqual(utils.formatDateLabel('2026-10-29', today), 'Oggi');
    assertEqual(utils.formatDateLabel('2026-10-30', today), 'Domani');
    assertEqual(utils.formatDateLabel('2026-10-28', today), 'Ieri');
    assertEqual(utils.formatDateLabel('2026-11-03', today), 'mar 3 nov');
    assertEqual(utils.formatDateLabel('2027-01-04', today), 'lun 4 gen 2027');
  });

  test('formatLongDate e greeting', () => {
    assertEqual(utils.formatLongDate(new Date(2026, 9, 29)), 'Giovedì 29 ottobre');
    assertEqual(utils.greeting(new Date(2026, 9, 29, 8)), 'Buongiorno');
    assertEqual(utils.greeting(new Date(2026, 9, 29, 15)), 'Buon pomeriggio');
    assertEqual(utils.greeting(new Date(2026, 9, 29, 21)), 'Buonasera');
    assertEqual(utils.greeting(new Date(2026, 9, 29, 2)), 'Buonasera');
  });

  /* ---------- Validazione e modifiche ---------- */

  test('validateInput normalizza dati corretti', () => {
    const { value, errors } = T.validateInput({ title: '  Fare   la spesa ', duration: '45', energy: 'low', date: '' });
    assertEqual(errors, {});
    assertEqual(value, { title: 'Fare la spesa', duration: 45, energy: 'low', date: null });
  });

  test('validateInput segnala ogni campo sbagliato', () => {
    const { errors } = T.validateInput({ title: '   ', duration: '', energy: 'toString', date: '2026-02-30' });
    assertEqual(Object.keys(errors).sort(), ['date', 'duration', 'energy', 'title']);
  });

  test('validateInput: limiti della durata', () => {
    const ok = duration => !T.validateInput({ title: 'x', duration, energy: 'medium' }).errors.duration;
    assert(ok('1') && ok('600') && ok(30), 'valori ammessi');
    assert(!ok('0') && !ok('601') && !ok('abc') && !ok('-5') && !ok(''), 'valori fuori limite');
  });

  test('createTask crea un\'attività da fare', () => {
    const task = T.createTask({ title: 'Leggere', duration: 20, energy: 'low', date: '2026-10-30' }, 1000);
    assert(typeof task.id === 'string' && task.id.length > 0, 'id presente');
    assertEqual({ ...task, id: 'x' }, {
      id: 'x', title: 'Leggere', duration: 20, energy: 'low', date: '2026-10-30',
      done: false, createdAt: 1000, completedAt: null
    });
  });

  test('setDone imposta e azzera completedAt senza modificare l\'originale', () => {
    const list = [make({ id: 'a' }), make({ id: 'b' })];
    const done = T.setDone(list, 'a', true, 5000);
    assertEqual([done[0].done, done[0].completedAt], [true, 5000]);
    assertEqual(list[0].done, false, 'originale intatto');
    assert(done[1] === list[1], 'le altre attività restano le stesse');
    const undone = T.setDone(done, 'a', false, 6000);
    assertEqual([undone[0].done, undone[0].completedAt], [false, null]);
  });

  test('removeTask + restoreTask rimettono l\'attività al suo posto', () => {
    const list = [make({ id: 'a' }), make({ id: 'b' }), make({ id: 'c' })];
    const { tasks, removed, index } = T.removeTask(list, 'b');
    assertEqual(tasks.map(t => t.id), ['a', 'c']);
    assertEqual(index, 1);
    assertEqual(T.restoreTask(tasks, removed, index).map(t => t.id), ['a', 'b', 'c']);
    assertEqual(T.restoreTask(list, list[0], 2).length, 3, 'nessun doppione se è già presente');
    assertEqual(T.removeTask(list, 'inesistente').removed, null, 'id inesistente');
  });

  test('removeCompleted + restoreMany ripristinano l\'ordine', () => {
    const list = [
      make({ id: 'a', done: true, completedAt: 1 }),
      make({ id: 'b' }),
      make({ id: 'c', done: true, completedAt: 2 }),
      make({ id: 'd' })
    ];
    const { tasks, removed } = T.removeCompleted(list);
    assertEqual(tasks.map(t => t.id), ['b', 'd']);
    assertEqual(T.restoreMany(tasks, removed).map(t => t.id), ['a', 'b', 'c', 'd']);
  });

  /* ---------- Sezioni e riepilogo ---------- */

  test('groupTasks divide per sezioni nell\'ordine giusto', () => {
    const today = '2026-10-29';
    const list = [
      make({ id: 'senza-data', createdAt: 1 }),
      make({ id: 'tra-5', date: '2026-11-03', createdAt: 2 }),
      make({ id: 'tra-2', date: '2026-10-31', createdAt: 3 }),
      make({ id: 'domani', date: '2026-10-30', createdAt: 4 }),
      make({ id: 'oggi', date: today, createdAt: 5 }),
      make({ id: 'ieri', date: '2026-10-28', createdAt: 6 }),
      make({ id: 'settimana-scorsa', date: '2026-10-22', createdAt: 7 }),
      make({ id: 'fatta', date: '2026-10-20', done: true, completedAt: 9 })
    ];
    const { sections, completed } = T.groupTasks(list, today);
    assertEqual(sections.map(s => s.key), ['overdue', 'today', 'tomorrow', 'upcoming', 'someday']);
    assertEqual(sections[0].tasks.map(t => t.id), ['settimana-scorsa', 'ieri'], 'in ritardo: dalla più vecchia');
    assertEqual(sections[3].tasks.map(t => t.id), ['tra-2', 'tra-5'], 'prossimi giorni: in ordine di data');
    assertEqual(completed.map(t => t.id), ['fatta'], 'una completata non è mai in ritardo');
    assertEqual(sections[1].minutes, 30, 'durata totale della sezione');
  });

  test('groupTasks omette le sezioni vuote e ordina le completate dalla più recente', () => {
    const list = [
      make({ id: 'x', done: true, completedAt: 10 }),
      make({ id: 'y', done: true, completedAt: 20 }),
      make({ id: 'z' })
    ];
    const { sections, completed } = T.groupTasks(list, '2026-10-29');
    assertEqual(sections.map(s => s.key), ['someday']);
    assertEqual(completed.map(t => t.id), ['y', 'x']);
  });

  test('summarize conta solo le completate di oggi', () => {
    const thisMorning = new Date(2026, 9, 29, 10).getTime();
    const lastNight = new Date(2026, 9, 28, 23, 50).getTime();
    const list = [
      make({ duration: 20 }),
      make({ duration: 25 }),
      make({ done: true, completedAt: thisMorning }),
      make({ done: true, completedAt: lastNight })
    ];
    assertEqual(T.summarize(list, '2026-10-29'), { openCount: 2, openMinutes: 45, doneToday: 1 });
  });

  /* ---------- Salvataggio ---------- */

  test('storage.parse: nessun dato → elenco vuoto', () => {
    assertEqual(storage.parse(null), { version: storage.SCHEMA_VERSION, tasks: [] });
    assertEqual(storage.parse(''), { version: storage.SCHEMA_VERSION, tasks: [] });
  });

  test('storage.parse: testo illeggibile o formato sbagliato → errore', () => {
    let failures = 0;
    ['{rotto', '"una stringa"', '{"tasks": 5}', 'null'].forEach(raw => {
      try {
        storage.parse(raw);
      } catch (err) {
        failures++;
      }
    });
    assertEqual(failures, 4);
  });

  test('storage.parse: ripulisce le attività e corregge gli id doppi', () => {
    const raw = JSON.stringify({
      version: 1,
      tasks: [
        { id: 'a', title: '  Ok  ', duration: 15, energy: 'high', date: '2026-10-30', done: false, createdAt: 1, completedAt: null },
        { id: 'a', title: 'Doppio', duration: 9999, energy: 'boh', date: '2026-02-30', done: true, createdAt: 2 },
        { id: 'c', title: '' },
        'non un oggetto'
      ]
    });
    const state = storage.parse(raw);
    assertEqual(state.tasks.length, 2, 'scartate quelle senza titolo');
    assertEqual(state.tasks[0].title, 'Ok');
    const fixed = state.tasks[1];
    assert(fixed.id !== 'a', 'id doppio sostituito');
    assertEqual([fixed.duration, fixed.energy, fixed.date, fixed.done, fixed.completedAt], [30, 'medium', null, true, 2]);
  });

  test('storage.parse: conserva i campi sconosciuti e non abbassa la versione', () => {
    const raw = JSON.stringify({
      version: 7,
      stats: { points: 10 },
      tasks: [{ id: 'a', title: 'X', duration: 10, energy: 'low', date: null, done: false, createdAt: 1, completedAt: null, extra: 'ok' }]
    });
    const state = storage.parse(raw);
    assertEqual(state.version, 7);
    assertEqual(state.stats, { points: 10 });
    assertEqual(state.tasks[0].extra, 'ok');
  });

  test('storage.parse: dati senza versione vengono portati alla versione attuale', () => {
    assertEqual(storage.parse(JSON.stringify({ tasks: [] })).version, storage.SCHEMA_VERSION);
  });

  test('storage: serialize e parse sono l\'uno l\'inverso dell\'altro', () => {
    const state = { version: storage.SCHEMA_VERSION, tasks: [make({ id: 'a', title: 'Andata e ritorno' })] };
    assertEqual(storage.parse(storage.serialize(state)), state);
  });
})();
