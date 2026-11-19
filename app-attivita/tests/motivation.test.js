/* Test della logica pura di Motivazione: js/motivation.js (P-003, passo 3.3). */
(function () {
  'use strict';

  const { test, assert, assertEqual } = window.AuraTest;
  const { motivation: Mo, points: P, storage, utils } = window.Aura;

  const TODAY = '2026-11-19'; // giovedì: la settimana va da lunedì 16 a domenica 22 novembre

  // Registro di prova: `days` è { 'YYYY-MM-DD': completamenti } (10 punti l'uno), `focus` i minuti per giorno.
  function stats(days = {}, focus = {}, extra = {}) {
    const base = P.emptyStats();
    Object.keys(days).forEach(day => { base.days[day] = { done: days[day], points: days[day] * 10 }; });
    base.focus = { ...focus };
    base.totalPoints = Object.keys(days).reduce((sum, day) => sum + days[day] * 10, 0);
    base.bestStreak = P.longestStreak(base.days);
    return { ...base, ...extra };
  }

  /* ---------- Livello ---------- */

  test('motivation.levelOf: i sette livelli partono dalle soglie della tabella', () => {
    const table = [[0, 'Scintilla'], [150, 'Fiamma'], [400, 'Bagliore'], [900, 'Stella'], [1800, 'Cometa'], [3500, 'Costellazione'], [7000, 'Aurora']];
    table.forEach(([from, name], i) => {
      const level = Mo.levelOf(from);
      assertEqual([level.name, level.number, level.from, level.progress], [name, i + 1, from, 0], name + ' a ' + from + ' punti');
      if (from > 0) assertEqual(Mo.levelOf(from - 1).number, i, 'un punto prima di ' + name);
    });
    assertEqual(Mo.LEVELS.map(level => level.badge), ['spark', 'flame', 'glow', 'star', 'comet', 'constellation', 'aurora']);
  });

  test('motivation.levelOf: quanto manca, la barra e il nome del prossimo livello', () => {
    const level = Mo.levelOf(1560); // l'esempio della proposta: Stella, ancora 240 punti per Cometa
    assertEqual([level.name, level.next, level.missing, level.to], ['Stella', 'Cometa', 240, 1800]);
    assert(Math.abs(level.progress - 660 / 900) < 1e-9, 'barra: 660 punti su 900');
    assertEqual(Mo.levelStep(level), 'livello 4 di 7');
    assertEqual(Mo.levelNote(level), 'Ancora 240 punti per Cometa');
    assertEqual(Mo.levelNote(Mo.levelOf(149)), 'Ancora 1 punto per Fiamma', 'un punto, al singolare');
    assertEqual(Mo.levelNote(Mo.levelOf(0)), 'Ancora 150 punti per Fiamma');
  });

  test('motivation.levelOf: dopo Aurora si continua, uno ogni 5.000 punti', () => {
    const aurora = Mo.levelOf(11999);
    assertEqual([aurora.name, aurora.rank, aurora.number, aurora.next, aurora.missing], ['Aurora', 1, 7, 'Aurora 2', 1]);
    assertEqual(Mo.levelStep(aurora), 'livello 7 di 7');
    const second = Mo.levelOf(12000);
    assertEqual([second.name, second.rank, second.number, second.badge, second.from, second.to], ['Aurora 2', 2, 7, 'aurora', 12000, 17000]);
    assertEqual(Mo.levelStep(second), '', 'il numero è già nel nome');
    assertEqual(Mo.levelNote(second), 'Ancora ' + utils.formatNumber(5000) + ' punti per Aurora 3');
    assertEqual(Mo.levelOf(17000).name, 'Aurora 3');
    assertEqual(Mo.levelOf(52000).name, 'Aurora 10');
    assert(Mo.levelOf(12000).index > Mo.levelOf(11999).index, 'anche tra le Aurore il livello sale');
  });

  test('motivation.levelOf: punti non validi contano come zero', () => {
    [undefined, null, NaN, -40, 'tanti'].forEach(value => assertEqual(Mo.levelOf(value).name, 'Scintilla', JSON.stringify(value)));
    assertEqual(Mo.levelOf(899.9).name, 'Bagliore', 'si contano i punti interi');
  });

  test('motivation.levelUp: solo quando si sale, mai scendendo', () => {
    assertEqual(Mo.levelUp(140, 164).name, 'Fiamma');
    assertEqual(Mo.levelUp(11990, 12010).name, 'Aurora 2');
    assertEqual(Mo.levelUp(100, 140), null, 'stesso livello');
    assertEqual(Mo.levelUp(164, 140), null, '«Annulla» fa scendere senza festa');
    assertEqual(Mo.levelUp(0, 1000).name, 'Stella', 'un salto di due livelli dice quello raggiunto');
  });

  /* ---------- Settimana ---------- */

  test('motivation.weekOf: da lunedì a domenica, con oggi e i giorni che devono ancora venire', () => {
    const week = Mo.weekOf(stats({ '2026-11-15': 4, '2026-11-16': 3, '2026-11-17': 2, '2026-11-19': 1, '2026-11-23': 5 }, { '2026-11-17': 25, '2026-11-19': 10 }), TODAY);
    assertEqual(week.start, '2026-11-16', 'lunedì');
    assertEqual(week.days.map(day => day.day), ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']);
    assertEqual(week.days.map(day => day.letter).join(''), 'LMMGVSD');
    assertEqual(week.days.map(day => day.done), [3, 2, 0, 1, 0, 0, 0], 'domenica 15 e lunedì 23 sono fuori');
    assertEqual([week.done, week.focus, week.todayIndex], [6, 35, 3]);
    assertEqual(week.days.map(day => day.isFuture), [false, false, false, false, true, true, true]);
    assertEqual(week.days.filter(day => day.isToday).map(day => day.day), [TODAY]);
  });

  test('motivation.weekOf: di lunedì e di domenica la settimana è sempre quella giusta', () => {
    assertEqual(Mo.weekOf(stats(), '2026-11-16').start, '2026-11-16', 'lunedì è il primo giorno');
    assertEqual(Mo.weekOf(stats(), '2026-11-22').start, '2026-11-16', 'domenica è l\'ultimo');
    assertEqual(Mo.weekOf(stats(), '2026-11-22').todayIndex, 6);
    assertEqual(Mo.weekOf(stats(), '2027-01-01').start, '2026-12-28', 'a cavallo dell\'anno');
    assertEqual(Mo.weekOf(stats(), '2026-03-29').start, '2026-03-23', 'domenica del cambio d\'ora');
  });

  test('motivation.lastWeek: attività, minuti di focus e il giorno migliore della settimana prima', () => {
    const data = stats({ '2026-11-09': 2, '2026-11-10': 6, '2026-11-12': 6, '2026-11-15': 1, '2026-11-16': 9 }, { '2026-11-10': 130, '2026-11-15': 120, '2026-11-16': 30 });
    data.days['2026-11-12'].points = 90; // stessi completamenti di martedì 10, più punti: vince giovedì
    const recap = Mo.lastWeek(data, TODAY);
    assertEqual([recap.start, recap.done, recap.focus, recap.activeDays, recap.best], ['2026-11-09', 15, 250, 4, '2026-11-12']);
    assertEqual(Mo.lastWeekText(recap), '15 attività · 4 h 10 min di focus · il giorno migliore è stato giovedì');
    const tie = stats({ '2026-11-10': 3, '2026-11-13': 3 });
    assertEqual(Mo.lastWeek(tie, TODAY).best, '2026-11-10', 'a parità di tutto, il primo');
  });

  test('motivation.lastWeekText: solo le cose positive, e niente se la settimana è vuota', () => {
    assertEqual(Mo.lastWeekText(Mo.lastWeek(stats(), TODAY)), '', 'niente da dire');
    assertEqual(Mo.lastWeekText(Mo.lastWeek(stats({}, { '2026-11-11': 45 }), TODAY)), '45 min di focus', 'solo il focus');
    assertEqual(Mo.lastWeekText(Mo.lastWeek(stats({ '2026-11-11': 3 }), TODAY)), '3 attività', 'un giorno solo: nessun «giorno migliore»');
    assertEqual(Mo.lastWeekText(Mo.lastWeek(stats({ '2026-11-11': 1, '2026-11-14': 2 }), TODAY)), '3 attività · il giorno migliore è stato sabato');
  });

  /* ---------- Obiettivo ---------- */

  test('motivation.nextGoal: un tocco passa all\'obiettivo dopo, e dopo 50 a nessuno', () => {
    const seen = [];
    let goal = null;
    for (let i = 0; i < 7; i++) {
      goal = Mo.nextGoal(goal);
      seen.push(goal);
    }
    assertEqual(seen, [5, 10, 15, 20, 30, 50, null]);
    assertEqual(Mo.nextGoal(12), 5, 'un valore strano riparte da 5');
  });

  test('motivation.sanitizeGoal e storage.sanitizePrefs: l\'obiettivo è uno di quelli previsti, altrimenti nessuno', () => {
    Mo.MOTIVATION.goals.forEach(goal => assertEqual(Mo.sanitizeGoal(goal), goal));
    [null, undefined, 0, 7, '15', 15.5, -5, [15], {}].forEach(value => assertEqual(Mo.sanitizeGoal(value), null, JSON.stringify(value)));
    assertEqual(storage.sanitizePrefs({ weeklyGoal: 30 }).weeklyGoal, 30);
    assertEqual(storage.sanitizePrefs({ weeklyGoal: 'tanti' }).weeklyGoal, null);
    assertEqual(storage.sanitizePrefs(null).weeklyGoal, null, 'all\'inizio nessun obiettivo');
  });

  test('motivation.skyNote e i testi del cielo: invito, quante ne mancano, obiettivo raggiunto', () => {
    const week = Mo.weekOf(stats({ '2026-11-16': 3, '2026-11-17': 2 }), TODAY);
    assertEqual(Mo.skyNote(week, 15), 'Ogni attività completata accende una stella. Ancora 10 e la settimana diventa una costellazione.');
    assertEqual(Mo.skyNote(week, 5), 'Obiettivo raggiunto: la settimana è diventata una costellazione ✨');
    assert(/Scegli un obiettivo/.test(Mo.skyNote(week, null)), 'senza obiettivo c\'è l\'invito');
    assertEqual(Mo.goalButtonText(null), 'Scegli l\'obiettivo');
    assertEqual(Mo.goalButtonText(15), 'Obiettivo: 15');
    assertEqual(Mo.countText(week, 15), { value: '5', rest: 'di 15' });
    assertEqual(Mo.countText(week, null), { value: '5', rest: 'stelle' });
    assertEqual(Mo.countText(Mo.weekOf(stats({ '2026-11-16': 1 }), TODAY), null).rest, 'stella');
    assertEqual(Mo.countText(week, 5), { value: '5', rest: 'di 5' }, 'obiettivo appena raggiunto');
    assertEqual(Mo.countText(Mo.weekOf(stats({ '2026-11-16': 4, '2026-11-17': 3 }), TODAY), 5), { value: '7', rest: 'stelle' }, 'obiettivo superato');
    assertEqual(Mo.goalAnnouncement(20), 'Obiettivo della settimana: 20 attività');
    assertEqual(Mo.goalAnnouncement(null), 'Nessun obiettivo per la settimana');
  });

  test('motivation.skyLabel: il lettore di schermo sente il totale, l\'obiettivo e i giorni fino a oggi', () => {
    const week = Mo.weekOf(stats({ '2026-11-16': 3, '2026-11-17': 2 }), TODAY);
    assertEqual(Mo.skyLabel(week, 15), 'La tua settimana: 5 attività completate su 15. Lunedì 3, martedì 2, mercoledì 0, giovedì (oggi) 0.');
    assertEqual(Mo.skyLabel(week, 5), 'La tua settimana: 5 attività completate, obiettivo di 5 raggiunto. Lunedì 3, martedì 2, mercoledì 0, giovedì (oggi) 0.');
    assertEqual(Mo.skyLabel(Mo.weekOf(stats({ '2026-11-16': 4, '2026-11-17': 3 }), TODAY), 5), 'La tua settimana: 7 attività completate, obiettivo di 5 raggiunto. Lunedì 4, martedì 3, mercoledì 0, giovedì (oggi) 0.');
    assertEqual(Mo.skyLabel(Mo.weekOf(stats({ '2026-11-16': 1 }), '2026-11-16'), null), 'La tua settimana: 1 attività completata. Lunedì (oggi) 1.');
  });

  /* ---------- Cielo ---------- */

  test('motivation.sky: una stella per attività nella colonna del suo giorno, uguali a parità di dati', () => {
    const data = stats({ '2026-11-16': 3, '2026-11-17': 2, '2026-11-19': 1 });
    const first = Mo.sky(Mo.weekOf(data, TODAY), null);
    const again = Mo.sky(Mo.weekOf(JSON.parse(JSON.stringify(data)), TODAY), null);
    assertEqual(first, again, 'stessi dati, stesso cielo');
    assertEqual(first.stars.map(star => star.column), [0, 0, 0, 1, 1, 3]);
    const { width, height, top, bottom } = Mo.MOTIVATION.sky;
    const col = width / 7;
    first.stars.forEach(star => {
      assert(star.x > star.column * col && star.x < (star.column + 1) * col, 'nella sua colonna: ' + JSON.stringify(star));
      assert(star.y >= top && star.y <= height - bottom, 'sotto la scritta e sopra il fondo: ' + JSON.stringify(star));
      assert(star.r >= 2 && star.r <= 3.8, 'grandezza: ' + star.r);
    });
    assertEqual([first.ghosts, first.lines, first.reached, first.missing], [[], [], false, 0], 'senza obiettivo niente cerchi né linee');
  });

  test('motivation.starAt: dipende solo dal giorno e dal numero d\'ordine', () => {
    assertEqual(Mo.starAt('2026-11-16', 0, 2), Mo.starAt('2026-11-16', 0, 2));
    assert(JSON.stringify(Mo.starAt('2026-11-16', 0, 0)) !== JSON.stringify(Mo.starAt('2026-11-23', 0, 0)), 'un\'altra settimana, un altro cielo');
    // Completare oggi non sposta le stelle dei giorni prima, né quelle già accese oggi.
    const before = Mo.sky(Mo.weekOf(stats({ '2026-11-16': 2, '2026-11-19': 1 }), TODAY), null).stars;
    const after = Mo.sky(Mo.weekOf(stats({ '2026-11-16': 2, '2026-11-19': 2 }), TODAY), null).stars;
    assertEqual(after.slice(0, 3), before, 'le stelle di prima restano dov\'erano');
    // Le stelle di uno stesso giorno non si ammucchiano: tra le prime cinque almeno 10 unità d'altezza.
    const ys = [0, 1, 2, 3, 4].map(order => Mo.starAt(TODAY, 3, order).y).sort((a, b) => a - b);
    ys.slice(1).forEach((y, i) => assert(y - ys[i] >= 10, 'distanza in altezza: ' + JSON.stringify(ys)));
  });

  test('motivation.sky: con un obiettivo, un cerchio per ogni stella che manca nei giorni che restano', () => {
    const week = Mo.weekOf(stats({ '2026-11-16': 3, '2026-11-17': 2, '2026-11-19': 1 }), TODAY);
    const result = Mo.sky(week, 15);
    assertEqual([result.missing, result.ghosts.length, result.reached], [9, 9, false]);
    assertEqual(result.ghosts.map(ghost => ghost.column), [3, 4, 5, 6, 3, 4, 5, 6, 3], 'da oggi a domenica, a turno');
    // Un cerchio sta proprio dove si accenderà la prossima stella di quel giorno.
    const firstToday = result.ghosts[0];
    const next = Mo.starAt(TODAY, 3, 1);
    assertEqual([firstToday.x, firstToday.y], [next.x, next.y]);
    const sunday = Mo.sky(Mo.weekOf(stats({ '2026-11-16': 3 }), '2026-11-22'), 5);
    assertEqual(sunday.ghosts.map(ghost => ghost.column), [6, 6], 'di domenica resta solo domenica');
  });

  test('motivation.sky: raggiunto l\'obiettivo le stelle si uniscono in una costellazione, senza cerchi', () => {
    const week = Mo.weekOf(stats({ '2026-11-16': 3, '2026-11-17': 2, '2026-11-19': 1 }), TODAY);
    const result = Mo.sky(week, 5);
    assertEqual([result.reached, result.missing, result.ghosts.length], [true, 0, 0]);
    assertEqual(result.lines.length, result.stars.length - 1, 'un albero: una linea in meno delle stelle');
    // Tutte le stelle sono collegate.
    const linked = new Set([0]);
    let grew = true;
    while (grew) {
      grew = false;
      result.lines.forEach(([a, b]) => {
        if (linked.has(a) !== linked.has(b)) { linked.add(a); linked.add(b); grew = true; }
      });
    }
    assertEqual(linked.size, result.stars.length, 'tutte collegate');
    assertEqual(Mo.sky(week, 10).lines, [], 'obiettivo non ancora raggiunto: niente linee');
    assertEqual(Mo.sky(Mo.weekOf(stats({ '2026-11-16': 5 }), TODAY), 5).lines.length, 4);
  });

  test('motivation.constellation: le linee più corte, e niente con meno di due stelle', () => {
    assertEqual(Mo.constellation([]), []);
    assertEqual(Mo.constellation([{ x: 1, y: 1 }]), []);
    // Tre stelle in fila: si uniscono le vicine, mai la prima con l'ultima.
    assertEqual(Mo.constellation([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 10, y: 0 }]), [[0, 2], [2, 1]]);
  });

  test('motivation.sky: un giorno con tantissime attività disegna al massimo 30 stelle', () => {
    const week = Mo.weekOf(stats({ '2026-11-16': 500, '2026-11-19': 2 }), TODAY);
    const result = Mo.sky(week, 50);
    assertEqual(result.stars.length, 32);
    assertEqual([week.done, result.reached], [502, true], 'il conteggio resta quello vero');
  });

  /* ---------- I tuoi numeri ---------- */

  test('motivation.numbers: focus di oggi, della settimana e in tutto, serie, giorno migliore, completate', () => {
    const data = stats(
      { '2026-11-02': 6, '2026-11-17': 2, '2026-11-18': 1, '2026-11-19': 3 },
      { '2026-11-02': 300, '2026-11-17': 25, '2026-11-19': 40, '2026-11-23': 5 }
    );
    const values = Mo.numbers(data, TODAY);
    assertEqual(values, { focusToday: 40, focusWeek: 65, focusTotal: 370, bestStreak: 3, bestDay: 6, completed: 12 });
    assertEqual(Mo.numberRows(values).map(row => row.label + ': ' + row.value), [
      'Focus oggi: 40 min',
      'Focus in settimana: 1 h 5 min',
      'Focus in tutto: 6 h 10 min',
      'Serie più lunga: 3 giorni',
      'Giorno migliore: 6 attività',
      'Completate in tutto: 12'
    ]);
  });

  test('motivation.numbers: all\'inizio tutto a zero, e «Svuota» non li cambia (vengono dal registro)', () => {
    const empty = Mo.numberRows(Mo.numbers(P.emptyStats(), TODAY)).map(row => row.value);
    assertEqual(empty, ['0 min', '0 min', '0 min', '0 giorni', '0 attività', '0']);
    const one = Mo.numberRows(Mo.numbers(stats({ [TODAY]: 1 }), TODAY)).map(row => row.value);
    assertEqual(one.slice(3), ['1 giorno', '1 attività', '1']);
    const big = Mo.numberRows(Mo.numbers(stats({ [TODAY]: 1234 }), TODAY));
    assertEqual(big[5].value, utils.formatNumber(1234));
  });
})();
