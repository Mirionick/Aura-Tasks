/*
 * Test dello scorrimento sulle card (P-005, passo 5.2): le regole pure di js/swipe.js. Il dito o la penna, i bordi dello
 * schermo, il blocco della direzione dopo 10 px, la card che segue il dito, la soglia del 40%, il colpo veloce e un gesto
 * intero, dal dito appoggiato al rilascio.
 */
(function () {
  'use strict';

  const { test, assert, assertEqual } = window.AuraTest;
  const { swipe: S } = window.Aura;

  const WIDTH = 350; // una card su un iPhone da 390 px, con i margini

  test('swipe.accepts: il dito e la penna sì, il mouse no', () => {
    assertEqual(['touch', 'pen', 'mouse', '', undefined].map(S.accepts), [true, true, false, false, false]);
  });

  test('swipe.atEdge: a meno di 24 px da un bordo dello schermo la card non si muove', () => {
    assertEqual([0, 23.9, 24, 195, 366, 366.1, 390].map(x => S.atEdge(x, 390)), [true, true, false, false, false, true, true]);
  });

  test('swipe.lock: niente prima di 10 px, poi di lato solo se 1,5 volte più che in verticale', () => {
    assertEqual(S.lock(0, 0), null);
    assertEqual(S.lock(6, 7), null, '9,2 px: ancora niente');
    assertEqual(S.lock(10, 0), 'x');
    assertEqual(S.lock(-10, 0), 'x', 'anche verso sinistra');
    assertEqual(S.lock(0, 10), 'y');
    assertEqual(S.lock(15, 10), 'x', 'esattamente 1,5 volte');
    assertEqual(S.lock(14, 10), 'y', 'poco meno: è la pagina che scorre');
    assertEqual(S.lock(-12, -9), 'y', 'in diagonale: la pagina');
  });

  test('swipe.offset: la card segue il dito, al massimo di una sua larghezza', () => {
    assertEqual([0, 120, -80, 400, -400].map(dx => S.offset(dx, WIDTH)), [0, 120, -80, WIDTH, -WIDTH]);
    assertEqual(S.offset(50, 0), 0, 'senza larghezza resta ferma');
  });

  test('swipe.side: verso destra «Fatto», verso sinistra «Elimina»', () => {
    assertEqual([12, -12, 0].map(S.side), ['done', 'delete', null]);
  });

  test('swipe.armed: dal 40% della larghezza della card', () => {
    assertEqual([139, 140, -140, 0].map(x => S.armed(x, WIDTH)), [false, true, true, false]);
    assert(!S.armed(10, 0), 'card senza larghezza');
  });

  test('swipe.velocity: px/ms degli ultimi 100 ms; il dito fermo prima di lasciare non è un colpo veloce', () => {
    assertEqual(S.velocity([{ x: 0, t: 0 }, { x: 50, t: 50 }, { x: 100, t: 100 }]), 1);
    assertEqual(S.velocity([{ x: 0, t: 0 }, { x: 10, t: 200 }, { x: 60, t: 250 }]), 1, 'contano solo gli ultimi 100 ms');
    assertEqual(S.velocity([{ x: 300, t: 0 }, { x: 240, t: 40 }, { x: 200, t: 80 }]), -1.25, 'verso sinistra: negativa');
    assertEqual(S.velocity([{ x: 0, t: 0 }, { x: 100, t: 50 }, { x: 100, t: 300 }]), 0, 'fermo per 250 ms');
    assertEqual([S.velocity([{ x: 5, t: 1 }]), S.velocity([]), S.velocity(null)], [0, 0, 0]);
  });

  test('swipe.decide: oltre la soglia, oppure un colpo veloce di almeno 48 px nella stessa direzione', () => {
    assertEqual(S.decide(140, WIDTH, 0), 'done', 'soglia, lentamente');
    assertEqual(S.decide(-200, WIDTH, -0.1), 'delete');
    assertEqual(S.decide(139, WIDTH, 0.2), null, 'sotto la soglia e lento: torna al suo posto');
    assertEqual(S.decide(48, WIDTH, 0.5), 'done', 'colpo veloce');
    assertEqual(S.decide(-60, WIDTH, -0.9), 'delete');
    assertEqual(S.decide(47, WIDTH, 2), null, 'veloce ma troppo corto');
    assertEqual(S.decide(60, WIDTH, 0.49), null, 'appena troppo lento');
    assertEqual(S.decide(200, WIDTH, -0.6), null, 'colpo veloce all\'indietro: annulla anche oltre la soglia');
    assertEqual(S.decide(-200, WIDTH, 0.6), null);
    assertEqual(S.decide(0, WIDTH, 3), null, 'al suo posto');
  });

  test('swipe.track: di lato la card parte da dove si decide, senza saltare, e segue il dito', () => {
    const g = S.track(100, 300, 0, WIDTH);
    assertEqual(g.state, 'wait');
    assertEqual(g.move(106, 301, 16), 'wait', '6 px: ancora niente');
    assertEqual(g.move(112, 302, 32), 'swipe', '12 px di lato: scorre');
    assertEqual(g.x, 0, 'nessun salto');
    g.move(172, 310, 48);
    assertEqual(g.x, 60, 'poi segue il dito, anche se va un po\' in verticale');
    g.move(1000, 310, 64);
    assertEqual(g.x, WIDTH, 'al massimo una larghezza');
    assertEqual(g.width, WIDTH);
  });

  test('swipe.track: un gesto in verticale è della pagina fino alla fine', () => {
    const g = S.track(100, 300, 0, WIDTH);
    assertEqual(g.move(104, 315, 16), 'scroll');
    assertEqual(g.move(250, 315, 32), 'scroll', 'anche se poi va di lato');
    assertEqual(g.x, 0);
    assertEqual(g.release(), null);
  });

  test('swipe.track: rilascio oltre la soglia, colpo veloce, sotto la soglia, tocco e annullamento', () => {
    const slow = S.track(40, 300, 0, WIDTH);
    [[60, 100], [120, 300], [200, 500], [202, 700]].forEach(([x, t]) => slow.move(x, 300, t));
    assertEqual(slow.x, 142, 'dal punto in cui ha cominciato a scorrere');
    assertEqual(slow.release(), 'done', '142 px su 350 (oltre i 140 della soglia), lentamente');
    assertEqual(slow.state, 'end');
    assertEqual(slow.move(300, 300, 800), 'end', 'dopo il rilascio non si muove più');

    const flick = S.track(300, 300, 0, WIDTH);
    [[288, 8], [260, 24], [230, 40]].forEach(([x, t]) => flick.move(x, 300, t));
    assertEqual(flick.x, -58);
    assertEqual(flick.release(), 'delete', '58 px a quasi 2 px/ms verso sinistra');

    const back = S.track(100, 300, 0, WIDTH);
    [[120, 100], [180, 300], [190, 500]].forEach(([x, t]) => back.move(x, 300, t));
    assertEqual(back.release(), null, '70 px lentamente: torna al suo posto');

    const tap = S.track(100, 300, 0, WIDTH);
    tap.move(103, 302, 40);
    assertEqual(tap.release(), null, 'un tocco: la spunta o la modifica, come sempre');

    const cancelled = S.track(100, 300, 0, WIDTH);
    cancelled.move(300, 300, 100);
    cancelled.cancel();
    assertEqual([cancelled.state, cancelled.release()], ['end', null], 'il browser si è preso il gesto');
  });
})();
