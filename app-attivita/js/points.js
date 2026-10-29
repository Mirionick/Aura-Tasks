/*
 * Aura Tasks — punti e serie di giorni.
 * Solo funzioni pure: ricevono dati e restituiscono NUOVI dati. Niente DOM, niente localStorage.
 * Tutte le regole stanno in POINTS (vedi CLAUDE.md, "Punti e serie di giorni").
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

  function emptyStats() {
    return { totalPoints: 0, bestStreak: 0, milestones: [], days: {} };
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

  const isActive = (days, day) => Boolean(days[day] && days[day].done > 0);

  /**
   * Serie in corso: giorni consecutivi con almeno un completamento, contati all'indietro da oggi.
   * Se oggi non c'è ancora niente si parte da ieri: la serie resta viva fino a mezzanotte.
   */
  function currentStreak(days, today) {
    let day = isActive(days, today) ? today : utils.addDays(today, -1);
    let streak = 0;
    while (isActive(days, day)) {
      streak++;
      day = utils.addDays(day, -1);
    }
    return streak;
  }

  /** La serie più lunga di tutto il registro: è il record. */
  function longestStreak(days) {
    const active = Object.keys(days).filter(day => isActive(days, day)).sort();
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
   * Restituisce { tasks, stats, points, streak, reached }:
   * - points: i punti dati, o tolti, in questo passaggio;
   * - streak: la serie in corso dopo la modifica;
   * - reached: i traguardi raggiunti adesso per la prima volta (da festeggiare).
   * Se non c'è niente da cambiare, `tasks` e `stats` sono gli stessi oggetti ricevuti.
   */
  function setDone(state, id, done, now) {
    const today = utils.todayISO(now);
    const task = state.tasks.find(t => t.id === id);
    if (!task || task.done === done) {
      return { tasks: state.tasks, stats: state.stats, points: 0, streak: currentStreak(state.stats.days, today), reached: [] };
    }
    // Annullando si toglie esattamente quanto era stato dato, dal giorno in cui era stato dato.
    const points = done ? pointsFor(task) : task.pointsAwarded || 0;
    const day = done ? today : utils.todayISO(task.completedAt);
    const tasks = T.setDone(state.tasks, id, done, now, done ? points : null);

    const changed = changeDay(state.stats, day, done ? 1 : -1, done ? points : -points);
    const streak = currentStreak(changed.days, today);
    const reached = done ? POINTS.milestones.filter(m => streak >= m && !changed.milestones.includes(m)) : [];
    const stats = { ...changed, bestStreak: longestStreak(changed.days), milestones: changed.milestones.concat(reached) };
    return { tasks, stats, points, streak, reached };
  }

  /**
   * Registro ricostruito dalle attività completate (migrazione alla v2).
   * I traguardi già superati si segnano come raggiunti, senza festa.
   */
  function rebuildStats(tasks) {
    const stats = tasks
      .filter(task => task.done && Number.isFinite(task.completedAt))
      .reduce((acc, task) => {
        const points = Number.isInteger(task.pointsAwarded) ? task.pointsAwarded : pointsFor(task);
        return changeDay(acc, utils.todayISO(task.completedAt), 1, points);
      }, emptyStats());
    const bestStreak = longestStreak(stats.days);
    return { ...stats, bestStreak, milestones: POINTS.milestones.filter(m => m <= bestStreak) };
  }

  Aura.points = {
    POINTS,
    pointsFor,
    emptyStats,
    dayTotals,
    currentStreak,
    longestStreak,
    nextMilestone,
    setDone,
    rebuildStats
  };
})(window.Aura = window.Aura || {});
