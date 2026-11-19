/* Test della logica pura dell'Agenda a calendario: js/agenda.js (P-003, passo 3.2). */
(function () {
  'use strict';

  const { test, assert, assertEqual } = window.AuraTest;
  const { agenda: A, storage, utils } = window.Aura;

  const TODAY = '2026-11-19'; // giovedì
  let seq = 0;

  // Attività di prova con tutti i campi; `overrides` cambia solo quelli che servono.
  function make(overrides) {
    seq += 1;
    return {
      id: 'ag-' + seq,
      title: 'Prova ' + seq,
      duration: 30,
      energy: 'medium',
      date: null,
      time: null,
      done: false,
      createdAt: seq,
      completedAt: null,
      pointsAwarded: null,
      ...overrides
    };
  }

  // Quanti giorni ha il mese 'YYYY-MM'.
  function daysIn(month) {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }

  // Controlli comuni di una griglia: righe da 7, giorni del mese tutti presenti e in fila, ognuno sotto il suo giorno della settimana.
  function checkGrid(month) {
    const weeks = A.monthWeeks(month);
    weeks.forEach((row, i) => assertEqual(row.length, 7, month + ', riga ' + (i + 1)));
    const days = [].concat(...weeks).filter(Boolean);
    const expected = Array.from({ length: daysIn(month) }, (_, i) => month + '-' + String(i + 1).padStart(2, '0'));
    assertEqual(days, expected, month + ': tutti i giorni, in fila');
    weeks.forEach(row => row.forEach((day, column) => {
      if (day) assertEqual((utils.parseISODate(day).getDay() + 6) % 7, column, day + ' nella colonna giusta');
    }));
    return weeks;
  }

  /* ---------- Mesi e settimane ---------- */

  test('agenda.monthWeeks: mesi di 4, 5 e 6 righe, con i giorni degli altri mesi vuoti', () => {
    const feb = checkGrid('2027-02'); // comincia di lunedì e ha 28 giorni
    assertEqual(feb.length, 4, 'febbraio 2027');
    assertEqual([feb[0][0], feb[3][6]], ['2027-02-01', '2027-02-28']);
    const oct = checkGrid('2026-10');
    assertEqual(oct.length, 5, 'ottobre 2026');
    assertEqual(oct[0], [null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    assertEqual(oct[4][6], null, 'domenica 1 novembre resta vuota');
    const nov = checkGrid('2026-11'); // comincia di domenica e ha 30 giorni
    assertEqual(nov.length, 6, 'novembre 2026');
    assertEqual(nov[0], [null, null, null, null, null, null, '2026-11-01']);
    assertEqual(nov[5], ['2026-11-30', null, null, null, null, null, null]);
  });

  test('agenda.monthWeeks: febbraio bisestile e tutti i mesi del 2026', () => {
    const leap = checkGrid('2028-02');
    assertEqual(leap.length, 5);
    assertEqual(leap[4], ['2028-02-28', '2028-02-29', null, null, null, null, null]);
    for (let m = 1; m <= 12; m++) checkGrid('2026-' + String(m).padStart(2, '0'));
  });

  test('agenda.monthWeeks e weekOf: i giorni del cambio d\'ora restano in fila', () => {
    // In Italia l'ora legale finisce il 25 ottobre 2026 e comincia il 28 marzo 2027 (due domeniche).
    const march = checkGrid('2027-03');
    assertEqual(march[3][6], '2027-03-28');
    assertEqual(march[4].slice(0, 3), ['2027-03-29', '2027-03-30', '2027-03-31']);
    assertEqual(A.weekOf('2026-10-25'), ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
    assertEqual(A.weekOf('2027-03-29')[0], '2027-03-29');
    assertEqual(A.mondayOf('2027-03-28'), '2027-03-22');
  });

  test('agenda.mondayOf, weekOf e addMonths: settimane da lunedì, anche a cavallo di mesi e anni', () => {
    assertEqual(A.mondayOf('2026-11-16'), '2026-11-16', 'lunedì');
    assertEqual(A.mondayOf('2026-11-22'), '2026-11-16', 'domenica');
    assertEqual(A.weekOf(TODAY), ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']);
    assertEqual(A.weekOf('2026-12-31'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
    assertEqual(A.addMonths('2026-12', 1), '2027-01');
    assertEqual(A.addMonths('2026-01', -1), '2025-12');
    assertEqual(A.addMonths('2026-11', 14), '2028-01');
    assert(A.isMonth('2026-11') && !A.isMonth('2026-13') && !A.isMonth('2026-1') && !A.isMonth(null), 'isMonth');
  });

  /* ---------- Calendario ---------- */

  test('agenda.calendar: puntini (al massimo tre, del colore dell\'energia, rossi nei giorni passati), oggi e giorno scelto', () => {
    const tasks = [
      make({ date: TODAY, time: '15:00', energy: 'high' }),
      make({ date: TODAY, energy: 'low' }),
      make({ date: TODAY, time: '09:00', energy: 'low' }),
      make({ date: TODAY, time: '11:00', energy: 'medium' }),
      make({ date: '2026-11-17', energy: 'high' }),
      make({ date: '2026-11-17', energy: 'low' }),
      make({ date: '2026-11-20', done: true, completedAt: 5 }),
      make({ date: null })
    ];
    const cal = A.calendar(tasks, { mode: 'month', month: '2026-11', selected: '2026-11-17' }, TODAY);
    assertEqual(cal.month, '2026-11');
    assertEqual(cal.rows.length, 6);
    const cells = [].concat(...cal.rows).filter(Boolean);
    const at = date => cells.find(cell => cell.date === date);
    assertEqual(at(TODAY), { date: TODAY, day: 19, isToday: true, isSelected: false, isPast: false, count: 4, dots: ['low', 'medium', 'high'] }, 'oggi: in ordine d\'ora');
    assertEqual(at('2026-11-17'), { date: '2026-11-17', day: 17, isToday: false, isSelected: true, isPast: true, count: 2, dots: ['late', 'late'] });
    assertEqual([at('2026-11-20').count, at('2026-11-20').dots], [0, []], 'le completate non hanno puntini');
    assertEqual(cal.rows[0].slice(0, 6), [null, null, null, null, null, null], 'i giorni di ottobre restano vuoti');
  });

  test('agenda.calendar: la vista settimana è la settimana del giorno scelto, con tutti e sette i giorni', () => {
    const week = A.calendar([], { mode: 'week', month: '2026-12', selected: '2026-12-31' }, TODAY);
    assertEqual(week.rows.length, 1);
    assertEqual(week.rows[0].map(cell => cell.date), A.weekOf('2026-12-31'));
    assertEqual(week.month, '2026-12', 'il titolo è il mese del giorno scelto');
    assertEqual(week.rows[0][3].isSelected, true);
  });

  test('agenda.navigate: nel mese il primo giorno (o oggi, nel mese di oggi); nella settimana 7 giorni', () => {
    assertEqual(A.navigate({ mode: 'month', month: '2026-11', selected: TODAY }, 1, TODAY), { month: '2026-12', selected: '2026-12-01' });
    assertEqual(A.navigate({ mode: 'month', month: '2026-12', selected: '2026-12-01' }, -1, TODAY), { month: '2026-11', selected: TODAY });
    assertEqual(A.navigate({ mode: 'month', month: '2027-01', selected: '2027-01-01' }, -2, TODAY), { month: '2026-11', selected: TODAY });
    assertEqual(A.navigate({ mode: 'week', month: '2026-11', selected: '2026-11-26' }, 1, TODAY), { month: '2026-12', selected: '2026-12-03' });
    assertEqual(A.navigate({ mode: 'week', month: '2026-11', selected: TODAY }, -1, TODAY), { month: '2026-11', selected: '2026-11-12' });
  });

  /* ---------- Il giorno scelto ---------- */

  test('agenda.dayTasks: senza orario e con orario; le completate solo nei giorni passati, anche quelle senza giorno', () => {
    const doneAt = new Date(2026, 10, 17, 18, 0).getTime();
    const a = make({ date: '2026-11-17', time: '10:00' });
    const b = make({ date: '2026-11-17', done: true, completedAt: doneAt });
    const c = make({ date: null, done: true, completedAt: doneAt }); // completata il 17, senza giorno
    const d = make({ date: '2026-11-17' });
    const e = make({ date: '2026-11-17', time: '08:30', done: true, completedAt: doneAt });
    const f = make({ date: TODAY, time: '09:00' });
    const g = make({ date: TODAY, done: true, completedAt: Date.now() });
    const h = make({ date: '2026-11-25', time: '12:00', done: true, completedAt: doneAt }); // fatta in anticipo
    const tasks = [a, b, c, d, e, f, g, h];

    const past = A.dayTasks(tasks, '2026-11-17', TODAY);
    assertEqual(past.untimed.map(t => t.id), [d.id, b.id, c.id], 'prima le da fare, poi le completate');
    assertEqual(past.timed.map(t => t.id), [e.id, a.id], 'in ordine d\'ora');
    assertEqual([past.openCount, past.openMinutes, past.doneCount], [2, 60, 3]);

    const today = A.dayTasks(tasks, TODAY, TODAY);
    assertEqual([today.untimed.length, today.timed.map(t => t.id), today.doneCount], [0, [f.id], 0], 'oggi le completate stanno in Focus');
    assertEqual(A.dayTasks(tasks, '2026-11-25', TODAY).timed, [], 'un giorno futuro non mostra le completate');
    assertEqual(A.doneDay(c), '2026-11-17');
    assertEqual(A.doneDay(make({ done: true, completedAt: null })), null);
  });

  // Attività di un giorno con orario, per schedule(): [ora, durata, titolo].
  const timed = (day, list) => list.map(([time, duration, title]) => make({ date: day, time, duration, title }));
  const kinds = rows => rows.map(row => row.kind === 'task' ? row.task.title + (row.overlap ? ' ⟂ ' + row.overlap : '')
    : row.kind === 'free' ? 'free ' + A.formatMinutes(row.from) + '-' + A.formatMinutes(row.to) : 'now ' + A.formatMinutes(row.at));

  test('agenda.schedule: spazi liberi di almeno mezz\'ora tra due attività, niente linea dell\'ora fuori da oggi', () => {
    const day = '2026-11-21';
    const now = new Date(2026, 10, 19, 11, 7);
    // C e D sono separate da 20 minuti (niente riga), D ed E da 30 esatti (la riga c'è).
    const list = timed(day, [['09:00', 60, 'A'], ['11:30', 30, 'B'], ['12:00', 45, 'C'], ['13:05', 30, 'D'], ['14:05', 30, 'E']]);
    assertEqual(kinds(A.schedule(list, day, now)), ['A', 'free 10:00-11:30', 'B', 'C', 'D', 'free 13:35-14:05', 'E']);
    assertEqual(kinds(A.schedule(list.slice(0, 1), day, now)), ['A'], 'una sola attività: nessuno spazio libero');
    assertEqual(A.schedule([], day, now), [], 'nessuna attività con orario');
  });

  test('agenda.schedule: con «adesso» in mezzo gli spazi liberi contano da adesso, e la linea sta al suo posto', () => {
    const list = timed(TODAY, [['09:00', 60, 'A'], ['14:00', 30, 'B']]);
    assertEqual(kinds(A.schedule(list, TODAY, new Date(2026, 10, 19, 11, 7))), ['A', 'now 11:07', 'free 11:10-14:00', 'B'], 'adesso tra le due');
    assertEqual(kinds(A.schedule(list, TODAY, new Date(2026, 10, 19, 7, 0))), ['now 07:00', 'A', 'free 10:00-14:00', 'B'], 'adesso prima di tutte');
    assertEqual(kinds(A.schedule(list, TODAY, new Date(2026, 10, 19, 15, 0))), ['A', 'B', 'now 15:00'], 'adesso dopo tutte: lo spazio è già passato');
    assertEqual(kinds(A.schedule(list, TODAY, new Date(2026, 10, 19, 13, 40))), ['A', 'now 13:40', 'B'], 'meno di mezz\'ora da adesso');
    const running = timed(TODAY, [['09:00', 120, 'A'], ['14:00', 30, 'B']]);
    assertEqual(kinds(A.schedule(running, TODAY, new Date(2026, 10, 19, 10, 0))), ['A', 'now 10:00', 'free 11:00-14:00', 'B'], 'adesso dentro un\'attività');
    const rows = A.schedule(list, TODAY, new Date(2026, 10, 19, 11, 7));
    assertEqual([rows[1].at, rows[2].from, rows[2].to], [667, 670, 840], 'orari in minuti dalla mezzanotte');
  });

  test('agenda.schedule: sovrapposizioni (con l\'attività che finisce più tardi) e attività che finisce dopo mezzanotte', () => {
    const day = '2026-11-21';
    const now = new Date(2026, 10, 19, 8, 0);
    const list = timed(day, [['09:00', 180, 'Riunione'], ['10:00', 30, 'Telefonata'], ['11:00', 30, 'Email'], ['12:30', 30, 'Pranzo']]);
    assertEqual(kinds(A.schedule(list, day, now)), ['Riunione', 'Telefonata ⟂ Riunione', 'Email ⟂ Riunione', 'free 12:00-12:30', 'Pranzo']);
    const same = timed(day, [['10:00', 30, 'Uno'], ['10:00', 15, 'Due']]);
    assertEqual(kinds(A.schedule(same, day, now)), ['Uno', 'Due ⟂ Uno'], 'stessa ora');
    const late = timed(day, [['22:00', 180, 'Film'], ['23:30', 15, 'Tisana']]);
    const rows = A.schedule(late, day, now);
    assertEqual(kinds(rows), ['Film', 'Tisana ⟂ Film'], 'il film finisce dopo mezzanotte');
    assertEqual([rows[0].end, A.formatMinutes(rows[0].end)], [1500, '01:00']);
    const lateToday = timed(TODAY, [['23:00', 90, 'Treno'], ['23:50', 5, 'Arrivo']]);
    assertEqual(kinds(A.schedule(lateToday, TODAY, new Date(2026, 10, 19, 23, 58))), ['Treno', 'Arrivo ⟂ Treno', 'now 23:58']);
  });

  test('agenda.schedule: un giorno passato ha solo le attività, senza spazi liberi né sovrapposizioni', () => {
    const day = '2026-11-17';
    const list = timed(day, [['09:00', 120, 'A'], ['10:00', 30, 'B'], ['15:00', 30, 'C']]);
    assertEqual(kinds(A.schedule(list, day, new Date(2026, 10, 19, 11, 0))), ['A', 'B', 'C']);
  });

  /* ---------- Sotto il giorno scelto ---------- */

  test('agenda.upcoming e unplanned: da domani in poi tranne il giorno scelto; senza giorno in ordine di creazione', () => {
    const t1 = make({ date: '2026-11-25', time: '10:00' });
    const t2 = make({ date: '2026-11-20' });
    const t3 = make({ date: '2026-11-20', time: '08:00' });
    const t4 = make({ date: '2026-11-22' });
    const t5 = make({ date: TODAY });
    const t6 = make({ date: '2026-11-17' });
    const t7 = make({ date: '2026-11-30', done: true, completedAt: 5 });
    const u2 = make({ createdAt: 50 });
    const u1 = make({ createdAt: 10 });
    const u3 = make({ createdAt: 20, done: true, completedAt: 5 });
    const tasks = [t1, t2, t3, t4, t5, t6, t7, u2, u1, u3];
    assertEqual(A.upcoming(tasks, TODAY, TODAY).map(t => t.id), [t3.id, t2.id, t4.id, t1.id], 'in ordine di data e ora');
    assertEqual(A.upcoming(tasks, TODAY, '2026-11-20').map(t => t.id), [t4.id, t1.id], 'senza quelle del giorno scelto');
    assertEqual(A.unplanned(tasks).map(t => t.id), [u1.id, u2.id]);
  });

  test('agenda.isInAgenda e planDate: che cosa si vede nell\'Agenda, e mai un giorno passato per «Metti a…»', () => {
    const doneAt = new Date(2026, 10, 17, 18, 0).getTime();
    assert(A.isInAgenda(make({ date: null }), TODAY, TODAY), 'senza giorno: «Da pianificare»');
    assert(A.isInAgenda(make({ date: '2026-11-20' }), TODAY, TODAY), 'domani: «Prossimi giorni»');
    assert(A.isInAgenda(make({ date: TODAY }), TODAY, TODAY), 'oggi, con oggi scelto');
    assert(!A.isInAgenda(make({ date: TODAY }), TODAY, '2026-11-20'), 'oggi, con un altro giorno scelto');
    assert(A.isInAgenda(make({ date: '2026-11-17' }), TODAY, '2026-11-17'), 'in ritardo, con il suo giorno scelto');
    assert(!A.isInAgenda(make({ date: '2026-11-17' }), TODAY, TODAY), 'in ritardo, con oggi scelto');
    assert(A.isInAgenda(make({ date: null, done: true, completedAt: doneAt }), TODAY, '2026-11-17'), 'completata il giorno passato scelto');
    assert(!A.isInAgenda(make({ date: TODAY, done: true, completedAt: Date.now() }), TODAY, TODAY), 'completata oggi');
    assertEqual([A.planDate(TODAY, TODAY), A.planDate('2026-11-21', TODAY), A.planDate('2026-11-18', TODAY)], [TODAY, '2026-11-21', null]);
  });

  /* ---------- Frasi ---------- */

  test('agenda: frasi del mese, del giorno scelto, di «Metti a…», degli spazi liberi e del lettore di schermo', () => {
    assertEqual(A.monthTitle('2026-11'), 'Novembre 2026');
    assertEqual(A.dayTitle(TODAY, TODAY), 'Oggi · giovedì 19 novembre');
    assertEqual(A.dayTitle('2026-11-20', TODAY), 'Domani · venerdì 20 novembre');
    assertEqual(A.dayTitle('2026-11-18', TODAY), 'Ieri · mercoledì 18 novembre');
    assertEqual(A.dayTitle('2026-11-21', TODAY), 'Sabato 21 novembre');
    assertEqual(A.dayTitle('2027-01-07', TODAY), 'Giovedì 7 gennaio 2027', 'con l\'anno, se è un altro');
    assertEqual([A.dayShort(TODAY, TODAY), A.dayShort('2026-11-20', TODAY), A.dayShort('2026-11-26', TODAY), A.dayShort('2026-12-03', TODAY)],
      ['oggi', 'domani', 'gio 26', 'gio 3 dic']);
    assertEqual([A.dayWords(TODAY, TODAY), A.dayWords('2026-11-20', TODAY), A.dayWords('2026-11-26', TODAY)], ['oggi', 'domani', 'giovedì 26 novembre']);
    assertEqual(A.dayInfo({ openCount: 5, openMinutes: 210, doneCount: 0 }), '5 attività · 3 h 30 min');
    assertEqual(A.dayInfo({ openCount: 1, openMinutes: 30, doneCount: 2 }), '1 attività · 30 min · 2 completate');
    assertEqual(A.dayInfo({ openCount: 0, openMinutes: 0, doneCount: 1 }), '1 completata');
    assertEqual(A.dayInfo({ openCount: 0, openMinutes: 0, doneCount: 0 }), '');
    assertEqual(A.freeLabel(570, 690), 'Libero dalle 09:30 alle 11:30 · 2 h');
    assertEqual(A.emptyText(TODAY, TODAY), 'Giornata libera. Con «Nuova attività» aggiungi qualcosa per oggi.');
    assertEqual(A.emptyText('2026-11-21', TODAY), 'Giornata libera. Con «Nuova attività» aggiungi qualcosa per sabato 21 novembre.');
    assertEqual(A.emptyText('2026-11-18', TODAY), 'Nessuna attività in questo giorno.');
    const cell = (date, count) => ({ date, count, isToday: date === TODAY, isPast: date < TODAY });
    assertEqual(A.cellLabel(cell(TODAY, 3), TODAY), 'Giovedì 19 novembre, oggi, 3 attività');
    assertEqual(A.cellLabel(cell('2026-11-21', 0), TODAY), 'Sabato 21 novembre, libero');
    assertEqual(A.cellLabel(cell('2026-11-17', 2), TODAY), 'Martedì 17 novembre, 2 attività in ritardo');
    assertEqual(A.cellLabel(cell('2026-11-16', 0), TODAY), 'Lunedì 16 novembre, nessuna attività');
    assertEqual([A.toMinutes('00:00'), A.toMinutes('23:59'), A.formatMinutes(0), A.formatMinutes(1439), A.formatMinutes(1440)], [0, 1439, '00:00', '23:59', '00:00']);
  });

  /* ---------- Preferenza della vista ---------- */

  test('storage.sanitizePrefs: la vista dell\'Agenda è «month» o «week»; altrimenti torna al mese', () => {
    assertEqual(storage.sanitizePrefs({ agendaView: 'week' }).agendaView, 'week');
    assertEqual(storage.sanitizePrefs({ agendaView: 'month' }).agendaView, 'month');
    ['giorno', 1, null, ['week']].forEach(value => assertEqual(storage.sanitizePrefs({ agendaView: value }).agendaView, 'month', JSON.stringify(value)));
    assertEqual(storage.sanitizePrefs(null).agendaView, 'month', 'di partenza');
  });
})();
