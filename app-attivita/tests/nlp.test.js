/* Test di js/nlp.js. "Adesso" è sempre fisso: giovedì 29/10/2026 alle 9:00, così i risultati non cambiano col giorno. */
(function () {
  'use strict';

  const { test, assertEqual } = window.AuraTest;
  const { nlp } = window.Aura;

  const NOW = new Date(2026, 9, 29, 9, 0);
  const parse = text => nlp.parseTaskText(text, NOW);
  // Solo i campi indicati, per confronti brevi
  const pick = (text, keys) => { const r = parse(text); return keys.map(k => r[k]); };

  /* ---------- Esempi della tabella di CLAUDE.md ---------- */

  test('nlp: gli esempi di CLAUDE.md', () => {
    assertEqual(parse('domani chiamare il dentista 10 min'), { title: 'Chiamare il dentista', duration: 10, energy: null, date: '2026-10-30', time: null });
    assertEqual(parse('palestra 1h energia alta venerdì'), { title: 'Palestra', duration: 60, energy: 'high', date: '2026-10-30', time: null });
    assertEqual(parse('rispondere alle email mezz\'ora facile'), { title: 'Rispondere alle email', duration: 30, energy: 'low', date: null, time: null });
    assertEqual(parse('studiare storia un\'ora e mezza il 15/11'), { title: 'Studiare storia', duration: 90, energy: null, date: '2026-11-15', time: null });
    assertEqual(parse('comprare il pane'), { title: 'Comprare il pane', duration: null, energy: null, date: null, time: null });
  });

  /* ---------- Orari ---------- */

  test('nlp: "domani alle 10 dentista"', () => {
    assertEqual(parse('domani alle 10 dentista'), { title: 'Dentista', duration: null, energy: null, date: '2026-10-30', time: '10:00' });
  });

  test('nlp: dalle 1 alle 7 senza "mattina" si intende il pomeriggio', () => {
    assertEqual(pick('domani alle 3', ['time']), ['15:00']);
    assertEqual(pick('domani alle 5', ['time']), ['17:00']);
    assertEqual(pick('domani alle 7', ['time']), ['19:00']);
    assertEqual(pick('domani alle 3:30', ['time']), ['15:30']);
    assertEqual(pick('domani all\'una pranzo', ['time', 'title']), ['13:00', 'Pranzo']);
    assertEqual(pick('domani alle 5 di mattina', ['time']), ['05:00']);
    assertEqual(pick('domani alle 8', ['time']), ['08:00'], 'dalle 8 in poi l\'ora resta com\'è');
    assertEqual(pick('domani alle 15:30', ['time']), ['15:30']);
  });

  test('nlp: altre forme dell\'orario', () => {
    assertEqual(pick('cena alle 8 di sera', ['time', 'title']), ['20:00', 'Cena']);
    assertEqual(pick('riunione ore 15:30', ['time', 'title']), ['15:30', 'Riunione']);
    assertEqual(pick('chiamata alle 10.30', ['time']), ['10:30']);
    assertEqual(pick('pranzo a mezzogiorno', ['time', 'title']), ['12:00', 'Pranzo']);
    assertEqual(pick('stasera alle 9 cinema', ['date', 'time', 'title']), ['2026-10-29', '21:00', 'Cinema']);
    assertEqual(pick('appuntamento alle 3 del pomeriggio', ['time']), ['15:00']);
  });

  test('nlp: solo l\'ora → oggi, oppure domani se è già passata', () => {
    assertEqual(pick('alle 3 dentista', ['date', 'time']), ['2026-10-29', '15:00'], 'le 15 di oggi devono ancora arrivare');
    assertEqual(pick('colazione alle 8:30', ['date', 'time']), ['2026-10-30', '08:30'], 'le 8:30 sono già passate');
    assertEqual(pick('alle 9 caffè', ['date']), ['2026-10-30'], 'proprio adesso: conta come passata');
  });

  test('nlp: un orario impossibile resta nel titolo', () => {
    assertEqual(pick('evento alle 25', ['time', 'title']), [null, 'Evento alle 25']);
  });

  /* ---------- Durate ---------- */

  test('nlp: durate in tutte le forme', () => {
    const d = text => parse(text).duration;
    assertEqual([d('corsa 30m'), d('corsa 30 minuti'), d('corsa 1 ora'), d('corsa 2 ore'), d('corsa 1h30')], [30, 30, 60, 120, 90]);
    assertEqual([d('corsa un\'ora'), d('corsa 1 ora e mezza'), d('corsa un quarto d\'ora'), d('corsa tre quarti d\'ora'), d('corsa dieci minuti')], [60, 90, 15, 45, 10]);
  });

  test('nlp: un numero che fa parte del titolo non è una durata', () => {
    assertEqual(parse('leggere 2 capitoli'), { title: 'Leggere 2 capitoli', duration: null, energy: null, date: null, time: null });
  });

  test('nlp: con più durate vale la prima', () => {
    assertEqual(pick('corsa 20 min poi stretching 10 min', ['duration']), [20]);
  });

  test('nlp: orario e durata insieme non si confondono', () => {
    assertEqual(pick('domani alle 10 dentista 30 min', ['time', 'duration', 'title']), ['10:00', 30, 'Dentista']);
  });

  /* ---------- Date ---------- */

  test('nlp: oggi, domani, dopodomani e "tra"', () => {
    const d = text => parse(text).date;
    assertEqual([d('x oggi'), d('x domani'), d('x dopodomani'), d('x tra 3 giorni'), d('x fra una settimana')],
      ['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-05']);
  });

  test('nlp: giorni della settimana (sempre il prossimo, escluso oggi)', () => {
    const d = text => parse(text).date;
    assertEqual([d('x giovedì'), d('x lunedi'), d('x lun'), d('x venerdì prossimo')], ['2026-11-05', '2026-11-02', '2026-11-02', '2026-11-06']);
  });

  test('nlp: date con numeri e mesi', () => {
    const d = text => parse(text).date;
    assertEqual([d('x il 15'), d('x il 29'), d('x il 5'), d('x 15 novembre'), d('x 15-11-2026'), d('x 3/1')],
      ['2026-11-15', '2026-10-29', '2026-11-05', '2026-11-15', '2026-11-15', '2027-01-03']);
  });

  test('nlp: date impossibili e anni bisestili', () => {
    assertEqual(pick('x 31/02', ['date', 'title']), [null, 'X 31/02'], '31 febbraio: resta nel titolo');
    assertEqual(pick('x 29/02/2028', ['date']), ['2028-02-29']);
    assertEqual(pick('x 29/02', ['date']), ['2028-02-29'], 'il prossimo 29 febbraio');
  });

  /* ---------- Energia e titolo ---------- */

  test('nlp: energia da parole', () => {
    const e = text => parse(text).energy;
    assertEqual([e('x energia bassa'), e('x energia media'), e('x leggera'), e('x impegnativa'), e('x concentrazione')], ['low', 'medium', 'low', 'high', 'high']);
  });

  test('nlp: testo vuoto e accenti nel titolo', () => {
    assertEqual(parse(''), { title: '', duration: null, energy: null, date: null, time: null });
    assertEqual(parse('   '), { title: '', duration: null, energy: null, date: null, time: null });
    assertEqual(pick('comprare caffè e però domani', ['title', 'date']), ['Comprare caffè e però', '2026-10-30']);
    assertEqual(pick('Città: prenotare hôtel venerdì', ['title']), ['Città: prenotare hôtel']);
  });
})();
