/*
 * Test della versione nuova con l'app rimasta aperta: le regole pure di js/update.js. Al massimo un controllo al minuto,
 * la pagina vecchia riconosciuta dalle cache del service worker (anche quando, all'apertura con la rete lenta, è
 * arrivata dalla cache) e quando l'avviso «C'è una versione nuova di Aura» si può mostrare.
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

  test('update.VERSION: ha la forma dei nomi delle cache di sw.js', () => {
    assert(/^aura-tasks-v\d+$/.test(U.VERSION), U.VERSION);
    assertEqual(U.versionNumber('aura-tasks-v26'), 26);
    assertEqual(U.versionNumber('aura-tasks-v100'), 100);
    assertEqual(U.versionNumber('aura-tasks-26'), null);
    assertEqual(U.versionNumber('altra-cache-v27'), null);
    assertEqual(U.versionNumber(undefined), null);
  });

  test('update.isStale: la pagina è vecchia solo quando comanda un service worker più nuovo', () => {
    const page = 'aura-tasks-v26';
    assert(!U.isStale(page, ['aura-tasks-v26']), 'stessa versione');
    assert(!U.isStale(page, ['aura-tasks-v26', 'aura-tasks-v27']), 'il nuovo si sta ancora installando: si aspetta');
    assert(U.isStale(page, ['aura-tasks-v27']), 'il nuovo comanda e ha cancellato la cache della pagina');
    assert(U.isStale(page, ['aura-tasks-v30']), 'anche dopo più versioni');
    assert(!U.isStale('aura-tasks-v27', ['aura-tasks-v26']), 'pagina dalla rete, più nuova del service worker');
    assert(!U.isStale(page, []), 'nessuna cache: prima installazione');
    assert(!U.isStale(page, ['altra-cache']), 'solo cache di altri');
    assert(U.isStale(page, ['altra-cache', 'aura-tasks-v27']), 'altre cache non contano');
    assert(!U.isStale('versione-strana', ['aura-tasks-v27']), 'versione della pagina non riconosciuta');
    assert(!U.isStale(page, null), 'senza la lista delle cache');
  });

  test('update.isStale: apertura con la rete lenta, la pagina dalla cache e il service worker nuovo subito dopo', () => {
    // Allo scadere dei 3 secondi sw.js (v26) risponde con la sua copia: la pagina è la v26 anche se è uscita la v27.
    // Il controllo dell'apertura trova la v27: mentre si installa le cache sono due, poi resta solo la sua.
    const page = 'aura-tasks-v26';
    assert(!U.isStale(page, ['aura-tasks-v26']), 'all\'apertura');
    assert(!U.isStale(page, ['aura-tasks-v26', 'aura-tasks-v27']), 'la v27 si installa');
    assert(U.isStale(page, ['aura-tasks-v27']), 'la v27 comanda: c\'è l\'avviso');
    // Con la rete buona la pagina arriva dalla rete, già nuova: nessun avviso, anche se sw.js cambia dopo.
    assert(!U.isStale('aura-tasks-v27', ['aura-tasks-v26', 'aura-tasks-v27']), 'pagina nuova, la v27 si installa');
    assert(!U.isStale('aura-tasks-v27', ['aura-tasks-v27']), 'pagina nuova, la v27 comanda');
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
