/*
 * Test della parte pura del movimento (js/motion.js): durate dei token e piano FLIP (chi si sposta, entra, esce).
 * Schermo finto di 390 × 800 px; i rettangoli sono quelli che getBoundingClientRect darebbe nella viewport.
 */
(function () {
  'use strict';

  const { test, assert, assertEqual } = window.AuraTest;
  const { motion: M } = window.Aura;

  const VIEW = { width: 390, height: 800 };
  const box = (top, height = 60, left = 16, width = 358) => ({ top, left, width, height });

  test('movimento: durate dei token in millisecondi', () => {
    assertEqual(M.parseDuration('320ms'), 320);
    assertEqual(M.parseDuration(' 6s '), 6000);
    assertEqual(M.parseDuration('.5s'), 500);
    assertEqual(M.parseDuration('1100ms'), 1100);
    assertEqual(M.parseDuration(''), null);
    assertEqual(M.parseDuration('veloce'), null);
    assertEqual(M.parseDuration(undefined), null);
  });

  test('FLIP: una card che sale parte dalla vecchia posizione', () => {
    const plan = M.planFlip({ 'task:a': box(200), 'task:b': box(270) }, { 'task:b': box(200) }, VIEW);
    assertEqual(plan.moves, [{ key: 'task:b', dx: 0, dy: 70 }]);
    assertEqual(plan.exits, [{ key: 'task:a', to: null }]);
    assertEqual(plan.enters, []);
  });

  test('FLIP: sotto il pixel non si anima nulla', () => {
    const plan = M.planFlip({ 'task:a': box(200) }, { 'task:a': box(200.4) }, VIEW);
    assertEqual(plan, { moves: [], enters: [], exits: [] });
  });

  test('FLIP: entra solo ciò che si vede, ordinato dall\'alto', () => {
    const plan = M.planFlip({}, { 'task:giu': box(500), 'task:su': box(100), 'task:fuori': box(2000) }, VIEW);
    assertEqual(plan.enters, ['task:su', 'task:giu']);
  });

  test('FLIP: esce solo ciò che si vedeva', () => {
    const plan = M.planFlip({ 'task:visto': box(300), 'task:lontano': box(-900) }, {}, VIEW);
    assertEqual(plan.exits, [{ key: 'task:visto', to: null }]);
  });

  test('FLIP: un elemento poco fuori dallo schermo conta ancora (margine di 80 px)', () => {
    const plan = M.planFlip({ 'task:a': box(840) }, { 'task:a': box(760) }, VIEW);
    assertEqual(plan.moves, [{ key: 'task:a', dx: 0, dy: 80 }]);
  });

  test('FLIP: fuori dallo schermo prima e dopo, niente animazione', () => {
    const plan = M.planFlip({ 'task:a': box(1200) }, { 'task:a': box(1100) }, VIEW);
    assertEqual(plan, { moves: [], enters: [], exits: [] });
  });

  test('FLIP: uno spostamento più lungo dello schermo diventa uscita più entrata', () => {
    const plan = M.planFlip({ 'task:a': box(100) }, { 'task:a': box(100 - 900) }, VIEW);
    assertEqual(plan.moves, []);
    assertEqual(plan.exits, [{ key: 'task:a', to: null }]);
    assertEqual(plan.enters, []); // la nuova posizione non si vede
    const back = M.planFlip({ 'task:a': box(-1500) }, { 'task:a': box(300) }, VIEW);
    assertEqual(back.exits, []);
    assertEqual(back.enters, ['task:a']);
  });

  test('FLIP: una card finita in «Completate» chiusa vola verso il suo titolo, se si vede', () => {
    const before = { 'task:a': box(200), completed: box(600, 44) };
    const after = { completed: box(540, 44) };
    const plan = M.planFlip(before, after, VIEW, { 'task:a': 'completed' });
    assertEqual(plan.exits, [{ key: 'task:a', to: 'completed' }]);
    assertEqual(plan.moves, [{ key: 'completed', dx: 0, dy: 60 }]);
    const hidden = M.planFlip(before, { completed: box(1400, 44) }, VIEW, { 'task:a': 'completed' });
    assertEqual(hidden.exits, [{ key: 'task:a', to: null }], 'titolo fuori dallo schermo: esce sul posto');
  });

  test('FLIP: anche gli spostamenti in orizzontale', () => {
    const plan = M.planFlip({ 'task:a': box(200, 60, 40) }, { 'task:a': box(200, 60, 16) }, VIEW);
    assertEqual(plan.moves, [{ key: 'task:a', dx: 24, dy: 0 }]);
  });

  test('FLIP: un elemento senza larghezza non conta come visibile', () => {
    const plan = M.planFlip({}, { 'task:a': box(200, 60, 16, 0) }, VIEW);
    assert(plan.enters.length === 0, 'niente entrata');
  });

  /* ---------- Blocchi annidati: le card stanno nelle sezioni ---------- */

  const PARENTS = { 'task:a': 'section:oggi', 'task:b': 'section:oggi' };

  test('FLIP annidato: la sezione scivola come un blocco e le sue card la seguono senza animazione propria', () => {
    const before = { 'section:oggi': box(300, 200), 'task:a': box(340), 'task:b': box(410) };
    const after = { 'section:oggi': box(206, 200), 'task:a': box(246), 'task:b': box(316) };
    const plan = M.planFlip(before, after, VIEW, {}, PARENTS);
    assertEqual(plan.moves, [{ key: 'section:oggi', dx: 0, dy: 94 }]);
  });

  test('FLIP annidato: una card si sposta solo per la parte che la sezione non fa già', () => {
    const before = { 'section:oggi': box(300, 200), 'task:a': box(340), 'task:b': box(410) };
    // La sezione sale di 94 px; dentro, la card b sale di altri 70 px (la card a è uscita).
    const after = { 'section:oggi': box(206, 130), 'task:b': box(246) };
    const plan = M.planFlip(before, after, VIEW, {}, { 'task:b': 'section:oggi' });
    assertEqual(plan.moves, [{ key: 'section:oggi', dx: 0, dy: 94 }, { key: 'task:b', dx: 0, dy: 70 }]);
    assertEqual(plan.exits, [{ key: 'task:a', to: null }]);
  });

  test('FLIP annidato: se la sezione resta ferma, le card si muovono da sole', () => {
    const before = { 'section:oggi': box(300, 200), 'task:a': box(340), 'task:b': box(410) };
    const after = { 'section:oggi': box(300, 130), 'task:b': box(340) };
    const plan = M.planFlip(before, after, VIEW, {}, { 'task:b': 'section:oggi' });
    assertEqual(plan.moves, [{ key: 'task:b', dx: 0, dy: 70 }]);
  });

  test('FLIP annidato: le card di un blocco che entra entrano con lui, senza un\'entrata loro', () => {
    const after = { 'completed-body': box(500, 300), 'task:c1': box(540), 'task:c2': box(610) };
    const plan = M.planFlip({}, after, VIEW, {}, { 'task:c1': 'completed-body', 'task:c2': 'completed-body' });
    assertEqual(plan.enters, ['completed-body']);
  });

  test('FLIP annidato: anche i figli di un blocco che esce sono nel piano (il filtro dei fantasmi è nella pagina)', () => {
    const before = { 'completed-body': box(500, 300), 'task:c1': box(540) };
    const plan = M.planFlip(before, {}, VIEW);
    assertEqual(plan.exits.map(exit => exit.key).sort(), ['completed-body', 'task:c1']);
  });

  test('FLIP annidato: una card nuova dentro una sezione che si sposta entra al suo posto', () => {
    const before = { 'section:oggi': box(300, 130), 'task:a': box(340) };
    const after = { 'section:oggi': box(394, 200), 'task:a': box(434), 'task:n': box(504) };
    const plan = M.planFlip(before, after, VIEW, {}, { 'task:a': 'section:oggi', 'task:n': 'section:oggi' });
    assertEqual(plan.moves, [{ key: 'section:oggi', dx: 0, dy: -94 }]);
    assertEqual(plan.enters, ['task:n']);
  });
})();
