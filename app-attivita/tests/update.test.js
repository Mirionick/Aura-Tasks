/*
 * Test della versione nuova con l'app rimasta aperta: le regole pure di js/update.js. Al massimo un controllo al minuto,
 * il service worker nuovo riconosciuto (non quello della prima installazione, né quello trovato dal browser
 * all'apertura) e quando l'avviso «C'è una versione nuova di Aura» si può mostrare.
 */
(function () {
  'use strict';

  const { test, assert, assertEqual } = window.AuraTest;
  const { update: U } = window.Aura;

  const MIN = 60 * 1000;
  const NOW = Date.UTC(2026, 10, 27, 14, 0);

  test('update.shouldCheck: la prima volta sì, poi al massimo una volta al minuto', () => {
    assert(U.shouldCheck(NOW, 0), 'mai chiesto prima');
    assert(!U.shouldCheck(NOW, NOW), 'appena chiesto');
    assert(!U.shouldCheck(NOW, NOW - MIN + 1), 'un millisecondo prima del minuto');
    assert(U.shouldCheck(NOW, NOW - MIN), 'esattamente un minuto dopo');
    assert(U.shouldCheck(NOW, NOW - 3 * 60 * MIN), 'tre ore dopo');
    assertEqual(U.LIMITS.check, MIN);
  });

  test('update.arrived: conta solo un service worker che prima non c\'era', () => {
    const old = { name: 'v25' };
    const next = { name: 'v26' };
    const found = { name: 'v26, trovato dal browser all\'apertura' };
    const empty = { installing: null, waiting: null, active: null };
    assert(!U.arrived({ ...empty, active: old }, { ...empty, active: old }), 'sw.js uguale: niente di nuovo');
    assert(U.arrived({ ...empty, active: old }, { ...empty, installing: next, active: old }), 'il nuovo si installa');
    assert(U.arrived({ ...empty, active: old }, { ...empty, waiting: next, active: old }), 'il nuovo aspetta');
    assert(U.arrived({ ...empty, active: old }, { ...empty, active: next }), 'il nuovo è già attivo');
    assert(!U.arrived({ ...empty, installing: found, active: old }, { ...empty, installing: found, active: old }), 'si installava già prima del controllo');
    assert(!U.arrived({ ...empty, installing: found, active: old }, { ...empty, active: found }), 'quello di prima, ora attivo');
    assert(!U.arrived({ ...empty, installing: next }, { ...empty, active: next }), 'prima installazione: nessun attivo prima');
    assert(!U.arrived(null, { ...empty, active: next }), 'senza la lettura di prima');
    assert(!U.arrived({ ...empty, active: old }, null), 'senza la lettura di dopo');
  });

  test('update.canOffer: solo con la versione pronta, l\'app che si vede, senza fogli né altri avvisi', () => {
    const base = { ready: true, visible: true, sheetOpen: false, toastShown: false, now: NOW, offeredAt: 0 };
    assert(U.canOffer(base), 'tutto a posto');
    assert(!U.canOffer({ ...base, ready: false }), 'la versione nuova non è ancora pronta');
    assert(!U.canOffer({ ...base, visible: false }), 'l\'app non si vede');
    assert(!U.canOffer({ ...base, sheetOpen: true }), 'un foglio aperto, o il focus a tutto schermo');
    assert(!U.canOffer({ ...base, toastShown: true }), 'c\'è un altro avviso, magari con «Annulla»');
  });

  test('update.canOffer: dopo un avviso senza «Aggiorna», di nuovo solo dopo 15 minuti', () => {
    const base = { ready: true, visible: true, sheetOpen: false, toastShown: false, now: NOW };
    assert(!U.canOffer({ ...base, offeredAt: NOW - MIN }), 'un minuto dopo');
    assert(!U.canOffer({ ...base, offeredAt: NOW - 15 * MIN + 1 }), 'un millisecondo prima dei 15 minuti');
    assert(U.canOffer({ ...base, offeredAt: NOW - 15 * MIN }), 'esattamente 15 minuti dopo');
    assertEqual(U.LIMITS.remind, 15 * MIN);
  });
})();
