/* Test della logica pura: js/utils.js, js/tasks.js, js/storage.js. */
(function () {
  'use strict';

  const { test, assert, assertEqual } = window.AuraTest;
  const { utils, tasks: T, points: P, storage } = window.Aura;

  // Attività di prova con tutti i campi; `overrides` cambia solo quelli che servono.
  function make(overrides) {
    return {
      id: 'id-' + Math.random().toString(36).slice(2, 8),
      title: 'Prova',
      duration: 30,
      energy: 'medium',
      date: null,
      time: null,
      done: false,
      createdAt: 1,
      completedAt: null,
      pointsAwarded: null,
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

  test('formatNumber usa il separatore delle migliaia italiano', () => {
    // Con 4 cifre l'italiano di solito non separa ("1240"): si controllano solo i casi certi.
    assertEqual(utils.formatNumber(0), '0');
    assertEqual(utils.formatNumber(240), '240');
    assertEqual(utils.formatNumber(12345), '12.345');
    assertEqual(utils.formatNumber(1234567), '1.234.567');
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
    assertEqual(value, { title: 'Fare la spesa', duration: 45, energy: 'low', date: null, time: null });
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
      id: 'x', title: 'Leggere', duration: 20, energy: 'low', date: '2026-10-30', time: null,
      done: false, createdAt: 1000, completedAt: null, pointsAwarded: null
    });
  });

  test('setDone imposta e azzera completedAt e punti senza modificare l\'originale', () => {
    const list = [make({ id: 'a' }), make({ id: 'b' })];
    const done = T.setDone(list, 'a', true, 5000, 24);
    assertEqual([done[0].done, done[0].completedAt, done[0].pointsAwarded], [true, 5000, 24]);
    assertEqual(list[0].done, false, 'originale intatto');
    assert(done[1] === list[1], 'le altre attività restano le stesse');
    const undone = T.setDone(done, 'a', false, 6000);
    assertEqual([undone[0].done, undone[0].completedAt, undone[0].pointsAwarded], [false, null, null]);
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

  test('summarize conta le attività da fare e la loro durata', () => {
    const list = [
      make({ duration: 20 }),
      make({ duration: 25 }),
      make({ done: true, completedAt: 9, pointsAwarded: 24 })
    ];
    assertEqual(T.summarize(list), { openCount: 2, openMinutes: 45 });
  });

  /* ---------- Salvataggio ---------- */

  test('storage.parse: nessun dato → elenco vuoto e registro vuoto', () => {
    const empty = { version: storage.SCHEMA_VERSION, tasks: [], stats: P.emptyStats() };
    assertEqual(storage.parse(null), empty);
    assertEqual(storage.parse(''), empty);
    assertEqual(storage.SCHEMA_VERSION, 3);
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
      future: { x: 1 },
      stats: { totalPoints: 10, bestStreak: 1, milestones: [], days: { '2026-10-29': { done: 1, points: 10 } }, level: 2 },
      tasks: [{ id: 'a', title: 'X', duration: 10, energy: 'low', date: null, done: false, createdAt: 1, completedAt: null, extra: 'ok' }]
    });
    const state = storage.parse(raw);
    assertEqual(state.version, 7);
    assertEqual(state.future, { x: 1 });
    assertEqual([state.stats.totalPoints, state.stats.level], [10, 2], 'registro e suoi campi sconosciuti');
    assertEqual(state.tasks[0].extra, 'ok');
  });

  test('storage.parse: dati senza versione vengono portati alla versione attuale', () => {
    assertEqual(storage.parse(JSON.stringify({ tasks: [] })).version, storage.SCHEMA_VERSION);
  });

  test('storage.parse: dalla v1 alla v2 ricostruisce punti e registro', () => {
    const at = (day, hour) => new Date(2026, 9, day, hour).getTime();
    const raw = JSON.stringify({
      version: 1,
      tasks: [
        { id: 'a', title: 'Spesa', duration: 30, energy: 'medium', date: null, done: true, createdAt: 1, completedAt: at(27, 18) },
        { id: 'b', title: 'Palestra', duration: 60, energy: 'high', date: null, done: true, createdAt: 1, completedAt: at(28, 9) },
        { id: 'c', title: 'Email', duration: 15, energy: 'low', date: null, done: true, createdAt: 1, completedAt: at(29, 8) },
        { id: 'd', title: 'Libro', duration: 15, energy: 'low', date: null, done: true, createdAt: 1, completedAt: at(29, 23) },
        { id: 'e', title: 'Da fare', duration: 20, energy: 'low', date: null, done: false, createdAt: 1, completedAt: null }
      ]
    });
    const state = storage.parse(raw);
    assertEqual(state.version, 3, 'dalla v1 si arriva fino all\'ultima versione');
    assertEqual(state.tasks.map(t => t.pointsAwarded), [24, 44, 13, 13, null]);
    assertEqual(state.stats.days, {
      '2026-10-27': { done: 1, points: 24 },
      '2026-10-28': { done: 1, points: 44 },
      '2026-10-29': { done: 2, points: 26 }
    });
    assertEqual([state.stats.totalPoints, state.stats.bestStreak], [94, 3]);
    assertEqual(state.stats.milestones, [3], 'traguardo già superato: segnato senza festa');
  });

  test('storage.sanitizeStats scarta i giorni non validi e conserva i campi sconosciuti', () => {
    const stats = storage.sanitizeStats({
      totalPoints: -5,
      bestStreak: 'tanti',
      milestones: [7, 3, 3, 0, 'x'],
      days: {
        '2026-10-28': { done: 1, points: 24 },
        '2026-10-29': { done: 2, points: -1, note: 'ok' },
        '2026-02-30': { done: 1, points: 10 },
        '2026-10-27': { done: 0, points: 10 },
        ieri: { done: 1, points: 5 }
      },
      future: true
    });
    assertEqual(Object.keys(stats.days).sort(), ['2026-10-28', '2026-10-29']);
    assertEqual(stats.days['2026-10-29'], { done: 2, points: 0, note: 'ok' });
    assertEqual([stats.totalPoints, stats.bestStreak], [24, 2], 'totale e record ricalcolati dai giorni');
    assertEqual(stats.milestones, [3, 7]);
    assertEqual(stats.future, true);
  });

  test('storage: serialize e parse sono l\'uno l\'inverso dell\'altro', () => {
    const state = {
      version: storage.SCHEMA_VERSION,
      tasks: [make({ id: 'a', title: 'Andata e ritorno' }), make({ id: 'b', done: true, completedAt: 9, pointsAwarded: 24 })],
      stats: { totalPoints: 24, bestStreak: 1, milestones: [], days: { '1970-01-01': { done: 1, points: 24 } } }
    };
    assertEqual(storage.parse(storage.serialize(state)), state);
  });

  /* ---------- Orario (schema v3) ---------- */

  test('isTime accetta solo orari HH:MM validi', () => {
    assert(utils.isTime('00:00') && utils.isTime('09:05') && utils.isTime('23:59'), 'orari validi');
    assert(!utils.isTime('24:00') && !utils.isTime('9:05') && !utils.isTime('12:60') && !utils.isTime('') && !utils.isTime(null), 'orari non validi');
  });

  test('validateInput: orario valido, non valido, o senza giorno', () => {
    const base = { title: 'Dentista', duration: '30', energy: 'medium', date: '2026-10-30' };
    const ok = T.validateInput({ ...base, time: '10:00' });
    assertEqual([ok.errors, ok.value.time], [{}, '10:00']);
    assert(T.validateInput({ ...base, time: '25:00' }).errors.time, 'orario impossibile');
    assert(T.validateInput({ ...base, date: '', time: '10:00' }).errors.time, 'orario senza giorno');
    assertEqual(T.validateInput(base).value.time, null, 'senza orario');
  });

  test('createTask salva l\'orario solo insieme al giorno', () => {
    assertEqual(T.createTask({ title: 'A', duration: 30, energy: 'low', date: '2026-10-30', time: '10:00' }, 1).time, '10:00');
    assertEqual(T.createTask({ title: 'A', duration: 30, energy: 'low', date: null, time: '10:00' }, 1).time, null);
  });

  test('groupTasks: nello stesso giorno prima le attività con orario, in ordine d\'ora', () => {
    const today = '2026-10-29';
    const list = [
      make({ id: 'senza-1', date: today, createdAt: 1 }),
      make({ id: 'alle-15', date: today, time: '15:00', createdAt: 2 }),
      make({ id: 'senza-2', date: today, createdAt: 3 }),
      make({ id: 'alle-9', date: today, time: '09:00', createdAt: 4 }),
      make({ id: 'ritardo-sera', date: '2026-10-27', time: '20:00', createdAt: 5 }),
      make({ id: 'ritardo-mattina', date: '2026-10-27', time: '08:00', createdAt: 6 })
    ];
    const { sections } = T.groupTasks(list, today);
    assertEqual(sections.find(s => s.key === 'today').tasks.map(t => t.id), ['alle-9', 'alle-15', 'senza-1', 'senza-2']);
    assertEqual(sections.find(s => s.key === 'overdue').tasks.map(t => t.id), ['ritardo-mattina', 'ritardo-sera']);
  });

  test('groupTasks: senza orari l\'ordine resta quello di prima (creazione)', () => {
    const today = '2026-10-29';
    const list = [make({ id: 'c', date: today, createdAt: 3 }), make({ id: 'a', date: today, createdAt: 1 }), make({ id: 'b', date: today, createdAt: 2 })];
    assertEqual(T.groupTasks(list, today).sections[0].tasks.map(t => t.id), ['a', 'b', 'c']);
  });

  test('storage.parse: dalla v2 alla v3 aggiunge solo l\'orario, punti e registro restano intatti', () => {
    const stats = { totalPoints: 37, bestStreak: 3, milestones: [3], days: { '2026-10-27': { done: 1, points: 13 }, '2026-10-28': { done: 1, points: 24 } }, level: 4 };
    const raw = JSON.stringify({
      version: 2,
      future: 'ok',
      stats,
      tasks: [
        { id: 'a', title: 'Fatta', duration: 30, energy: 'medium', date: '2026-10-28', done: true, createdAt: 1, completedAt: 5, pointsAwarded: 24, extra: 1 },
        { id: 'b', title: 'Da fare', duration: 15, energy: 'low', date: null, done: false, createdAt: 2, completedAt: null, pointsAwarded: null }
      ]
    });
    const state = storage.parse(raw);
    assertEqual(state.version, 3);
    assertEqual(state.stats, stats, 'registro identico');
    assertEqual(state.tasks.map(t => [t.time, t.pointsAwarded]), [[null, 24], [null, null]]);
    assertEqual([state.future, state.tasks[0].extra], ['ok', 1]);
  });

  test('storage.sanitizeTask: orario tenuto solo se valido e con un giorno', () => {
    const t = (date, time) => storage.sanitizeTask({ id: 'x', title: 'X', duration: 10, energy: 'low', date, time, done: false, createdAt: 1 }).time;
    assertEqual([t('2026-10-30', '10:00'), t('2026-10-30', '99:99'), t(null, '10:00')], ['10:00', null, null]);
  });
})();
