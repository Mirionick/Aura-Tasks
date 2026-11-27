/*
 * Aura Tasks — una versione nuova mentre l'app è rimasta aperta.
 * Su iPhone, tornando in un'app installata, la pagina non si ricarica: resta quella di quando è stata aperta, anche ore
 * dopo un aggiornamento. Tornando nell'app, js/app.js chiede al browser se sw.js è cambiato. Se sì, il service worker
 * nuovo scarica i file e prende il posto del vecchio (skipWaiting e clients.claim in sw.js), e un avviso propone
 * «Aggiorna», che ricarica la pagina.
 * La pagina sa di che versione è (VERSION): se il service worker che comanda ha i file di una versione più nuova, la
 * pagina è vecchia. Così conta anche il caso dell'apertura con la rete lenta, quando la pagina arriva dalla cache e il
 * service worker nuovo subito dopo.
 * Solo funzioni pure: quando chiedere, se la pagina è vecchia, quando mostrare l'avviso. Tempi in millisecondi. Niente DOM.
 */
(function (Aura) {
  'use strict';

  // La versione di questi file: uguale a CACHE_VERSION in sw.js, si cambiano insieme (lo controlla la CI)
  const VERSION = 'aura-tasks-v26';

  const LIMITS = Object.freeze({
    check: 60 * 1000,      // al massimo un controllo al minuto, anche passando spesso da un'app all'altra
    remind: 15 * 60 * 1000 // l'avviso passato senza «Aggiorna» torna dopo 15 minuti, a un altro ritorno nell'app
  });

  /** true se è ora di chiedere al browser: mai chiesto prima, oppure l'ultima volta è di almeno un minuto fa. */
  function shouldCheck(now, checkedAt, limits = LIMITS) {
    return !checkedAt || now - checkedAt >= limits.check;
  }

  /** Il numero di una versione di Aura: 26 per 'aura-tasks-v26'. null per un altro nome. */
  function versionNumber(name) {
    const match = /^aura-tasks-v(\d+)$/.exec(String(name));
    return match ? Number(match[1]) : null;
  }

  /**
   * true se la pagina (versione `version`) è più vecchia dei file del service worker che comanda. `cacheNames` sono i
   * nomi delle cache (caches.keys()): ognuna ha il nome della sua versione, e il service worker nuovo, quando prende il
   * posto del vecchio, cancella le altre.
   * - La cache della pagina c'è ancora: la pagina è quella giusta, oppure il nuovo si sta ancora installando (si aspetta
   *   che comandi, così «Aggiorna» carica i file nuovi).
   * - Una pagina più nuova della cache non conta: è arrivata dalla rete prima che il browser trovasse il nuovo sw.js.
   */
  function isStale(version, cacheNames) {
    const page = versionNumber(version);
    if (page === null || !Array.isArray(cacheNames) || cacheNames.includes(version)) return false;
    return cacheNames.some(name => versionNumber(name) > page);
  }

  /**
   * true se l'avviso «C'è una versione nuova di Aura» si può mostrare adesso: la versione nuova è pronta, l'app si
   * vede, non c'è un foglio aperto (né il focus a tutto schermo), non c'è un altro avviso (il suo «Annulla» non si
   * copre) e l'avviso non è già comparso negli ultimi 15 minuti.
   */
  function canOffer({ ready, visible, sheetOpen, toastShown, now, offeredAt }, limits = LIMITS) {
    if (!ready || !visible || sheetOpen || toastShown) return false;
    return !offeredAt || now - offeredAt >= limits.remind;
  }

  Aura.update = { VERSION, LIMITS, shouldCheck, versionNumber, isStale, canOffer };
})(window.Aura = window.Aura || {});
