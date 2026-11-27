/*
 * Aura Tasks — una versione nuova mentre l'app è rimasta aperta.
 * Su iPhone, tornando in un'app installata, la pagina non si ricarica: resta quella di quando è stata aperta, anche ore
 * dopo un aggiornamento. Tornando nell'app, js/app.js chiede al browser se sw.js è cambiato. Se sì, il service worker
 * nuovo scarica i file e prende il posto del vecchio (skipWaiting e clients.claim in sw.js), e un avviso propone
 * «Aggiorna», che ricarica la pagina.
 * Solo funzioni pure: quando chiedere, se il controllo ha trovato un service worker nuovo, quando mostrare l'avviso.
 * Tempi in millisecondi. Niente DOM.
 */
(function (Aura) {
  'use strict';

  const LIMITS = Object.freeze({
    check: 60 * 1000,      // al massimo un controllo al minuto, anche passando spesso da un'app all'altra
    remind: 15 * 60 * 1000 // l'avviso passato senza «Aggiorna» torna dopo 15 minuti, a un altro ritorno nell'app
  });

  /** true se è ora di chiedere al browser: mai chiesto prima, oppure l'ultima volta è di almeno un minuto fa. */
  function shouldCheck(now, checkedAt, limits = LIMITS) {
    return !checkedAt || now - checkedAt >= limits.check;
  }

  /**
   * true se il controllo ha portato un service worker che prima non c'era. `before` e `after` sono i tre posti di una
   * ServiceWorkerRegistration ({ installing, waiting, active }), letti prima e dopo `update()`.
   * - Senza un service worker attivo prima, è la prima installazione: la pagina è già quella nuova.
   * - Uno che si installava già prima non conta: lo ha trovato il browser all'apertura, con la pagina già nuova.
   */
  function arrived(before, after) {
    if (!before || !before.active || !after) return false;
    const known = [before.installing, before.waiting, before.active].filter(Boolean);
    return [after.installing, after.waiting, after.active].some(worker => Boolean(worker) && !known.includes(worker));
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

  Aura.update = { LIMITS, shouldCheck, arrived, canOffer };
})(window.Aura = window.Aura || {});
