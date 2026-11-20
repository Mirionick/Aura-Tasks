/*
 * Aura Tasks — punti e serie di giorni.
 * Solo funzioni pure: ricevono dati e restituiscono NUOVI dati. Niente DOM, niente localStorage.
 * Tutte le regole stanno in POINTS (vedi docs/punti-e-serie.md).
 */
(function (Aura) {
  'use strict';

  const { utils, tasks: T } = Aura;

  const POINTS = {
    base: 10,            // punti per ogni attività completata…
    minutesPerPoint: 5,  // …più 1 punto ogni 5 minuti di durata…
    maxMinutes: 120,     // …contando al massimo 2 ore
    multiplier: { low: 1, medium: 1.5, high: 2 },
    milestones: [3, 7, 14, 30, 100] // giorni di fila da festeggiare (una volta sola)
  };

  /** Punti per un'attività: (10 + minuti / 5, al massimo 120 minuti) × moltiplicatore dell'energia. */
  function pointsFor(task) {
    const minutes = Math.min(task.duration, POINTS.maxMinutes);
    const multiplier = POINTS.multiplier[task.energy] || POINTS.multiplier.medium;
    return Math.round((POINTS.base + minutes / POINTS.minutesPerPoint) * multiplier);
  }

  /**
   * Registro vuoto. `focus` sono i minuti di focus per giorno (schema v4, vedi js/focus.js): non toccano punti e serie.
   * `spent` sono i riscatti dei premi (schema v5, vedi js/rewards.js) e `shop` gli acquisti del negozio (schema v6, vedi
   * js/shop.js): nessuno dei due toglie niente a totalPoints.
   */
  function emptyStats() {
    return { totalPoints: 0, bestStreak: 0, milestones: [], days: {}, focus: {}, spent: [], shop: [] };
  }

  /** Completamenti e punti di un giorno (zero se il giorno non è nel registro). */
  function dayTotals(stats, day) {
    const entry = stats.days[day];
    return entry ? { done: entry.done, points: entry.points } : { done: 0, points: 0 };
  }

  /** Aggiunge (o toglie, con valori negativi) completamenti e punti a un giorno. Un giorno senza completamenti sparisce. */
  function changeDay(stats, day, doneDelta, pointsDelta) {
    const current = dayTotals(stats, day);
    const done = Math.max(0, current.done + doneDelta);
    const days = { ...stats.days };
    if (done > 0) days[day] = { ...stats.days[day], done, points: Math.max(0, current.points + pointsDelta) };
    else delete days[day];
    return { ...stats, days, totalPoints: Math.max(0, stats.totalPoints + pointsDelta) };
  }

  /**
   * I giorni riparati con «Ripara la serie» (P-004, passo 4.1): un Set di giorni `AAAA-MM-GG`, dagli acquisti del negozio
   * nel registro (stats.shop, con `item` 'repair'). Per la serie contano come un giorno con un completamento.
   */
  function repairedDays(stats) {
    const shop = stats && Array.isArray(stats.shop) ? stats.shop : [];
    return new Set(shop.filter(entry => entry && entry.item === 'repair' && utils.isISODate(entry.day)).map(entry => entry.day));
  }

  const hasDone = (days, day) => Boolean(days[day] && days[day].done > 0);
  /** Un giorno conta per la serie se ha almeno un completamento, oppure se è tra i giorni riparati (`repaired`, facoltativo). */
  const isActive = (days, day, repaired) => hasDone(days, day) || Boolean(repaired && repaired.has(day));

  /**
   * Serie in corso: giorni consecutivi con almeno un completamento (o riparati), contati all'indietro da oggi.
   * Se oggi non c'è ancora niente si parte da ieri: la serie resta viva fino a mezzanotte.
   */
  function currentStreak(days, today, repaired) {
    let day = isActive(days, today, repaired) ? today : utils.addDays(today, -1);
    let streak = 0;
    while (isActive(days, day, repaired)) {
      streak++;
      day = utils.addDays(day, -1);
    }
    return streak;
  }

  /** La serie più lunga di tutto il registro, giorni riparati compresi (`repaired`, facoltativo): è il record. */
  function longestStreak(days, repaired) {
    const done = Object.keys(days).filter(day => hasDone(days, day));
    const active = Array.from(new Set(repaired ? done.concat(Array.from(repaired)) : done)).sort();
    let best = 0;
    let run = 0;
    active.forEach((day, i) => {
      run = i > 0 && utils.daysBetween(active[i - 1], day) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
    });
    return best;
  }

  /** Il prossimo traguardo oltre `streak` giorni, oppure null se sono stati superati tutti. */
  function nextMilestone(streak) {
    return POINTS.milestones.find(milestone => milestone > streak) || null;
  }

  /**
   * Completa (done = true) o rimette da fare (done = false) un'attività, aggiornando punti e registro.
   * Restituisce { tasks, stats, points, streak, reached, next }:
   * - points: i punti dati, o tolti, in questo passaggio;
   * - streak: la serie in corso dopo la modifica;
   * - reached: i traguardi raggiunti adesso per la prima volta (da festeggiare);
   * - next: completando una ripetizione, la sua prossima volta (Aura.tasks.toggleDone, P-005), altrimenti null.
   * Se non c'è niente da cambiare, `tasks` e `stats` sono gli stessi oggetti ricevuti.
   */
  function setDone(state, id, done, now) {
    const today = utils.todayISO(now);
    const task = state.tasks.find(t => t.id === id);
    const repaired = repairedDays(state.stats);
    if (!task || task.done === done) {
      return { tasks: state.tasks, stats: state.stats, points: 0, streak: currentStreak(state.stats.days, today, repaired), reached: [], next: null };
    }
    // Annullando si toglie esattamente quanto era stato dato, dal giorno in cui era stato dato.
    const points = done ? pointsFor(task) : task.pointsAwarded || 0;
    const day = done ? today : utils.todayISO(task.completedAt);
    const { tasks, next } = T.toggleDone(state.tasks, id, done, now, done ? points : null);

    const changed = changeDay(state.stats, day, done ? 1 : -1, done ? points : -points);
    const streak = currentStreak(changed.days, today, repaired);
    const reached = done ? POINTS.milestones.filter(m => streak >= m && !changed.milestones.includes(m)) : [];
    const stats = { ...changed, bestStreak: longestStreak(changed.days, repaired), milestones: changed.milestones.concat(reached) };
    return { tasks, stats, points, streak, reached, next };
  }

  /**
   * Registro ricostruito dalle attività completate (migrazione alla v2).
   * I traguardi già superati si segnano come raggiunti, senza festa. Da `previous`, il registro di prima (facoltativo),
   * conserva i riscatti dei premi (`spent`, P-003, passo 3.4) e gli acquisti del negozio (`shop`, con i giorni riparati;
   * P-004, passo 4.1): dalle attività non si possono ricostruire.
   */
  function rebuildStats(tasks, previous) {
    const stats = tasks
      .filter(task => task.done && Number.isFinite(task.completedAt))
      .reduce((acc, task) => {
        const points = Number.isInteger(task.pointsAwarded) ? task.pointsAwarded : pointsFor(task);
        return changeDay(acc, utils.todayISO(task.completedAt), 1, points);
      }, emptyStats());
    const spent = previous && Array.isArray(previous.spent) ? previous.spent : stats.spent;
    const shop = previous && Array.isArray(previous.shop) ? previous.shop : stats.shop;
    const bestStreak = longestStreak(stats.days, repairedDays({ shop }));
    return { ...stats, bestStreak, milestones: POINTS.milestones.filter(m => m <= bestStreak), spent, shop };
  }

  Aura.points = {
    POINTS,
    pointsFor,
    emptyStats,
    dayTotals,
    repairedDays,
    currentStreak,
    longestStreak,
    nextMilestone,
    setDone,
    rebuildStats
  };
})(window.Aura = window.Aura || {});
