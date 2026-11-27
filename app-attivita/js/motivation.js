/*
 * Aura Tasks — logica della scheda Motivazione (P-003, passo 3.3; vedi docs/tre-modalita.md, «Motivazione»).
 * Solo funzioni pure: il livello dai punti guadagnati (mai salvato), la settimana da lunedì con le stelle del cielo,
 * l'obiettivo con le stelle che mancano, la settimana scorsa e «I tuoi numeri». Tutto viene dal registro (stats.days e
 * stats.focus), non dall'elenco delle completate: «Svuota» non spegne niente. Niente DOM, niente localStorage:
 * l'interfaccia sta in js/ui-motivation.js.
 */
(function (Aura) {
  'use strict';

  const { utils, points: P, focus: F, agenda: AG } = Aura;

  /**
   * Scelte e misure della scheda:
   * - goals: gli obiettivi della settimana (prefs.weeklyGoal); null vuol dire nessun obiettivo;
   * - auroraStep: dopo Aurora si continua, un livello ogni 5.000 punti (Aurora 2 a 12.000, Aurora 3 a 17.000…);
   * - maxStarsPerDay: stelle disegnate al massimo in un giorno (il numero scritto resta quello vero);
   * - sky: il cielo, in unità del viewBox dell'SVG. Le stelle stanno tra `top` e `height - bottom`: sopra c'è «N di M».
   */
  const MOTIVATION = {
    goals: [5, 10, 15, 20, 30, 50],
    auroraStep: 5000,
    maxStarsPerDay: 30,
    sky: { width: 336, height: 150, top: 46, bottom: 18, spread: 0.6 }
  };

  /** I livelli, con i punti da cui partono e il distintivo (images/level-N-<badge>.webp, vedi docs/illustrazioni.md). */
  const LEVELS = [
    { name: 'Scintilla', from: 0, badge: 'spark' },
    { name: 'Fiamma', from: 150, badge: 'flame' },
    { name: 'Bagliore', from: 400, badge: 'glow' },
    { name: 'Stella', from: 900, badge: 'star' },
    { name: 'Cometa', from: 1800, badge: 'comet' },
    { name: 'Costellazione', from: 3500, badge: 'constellation' },
    { name: 'Aurora', from: 7000, badge: 'aurora' }
  ];

  const LETTERS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
  const weekdayName = new Intl.DateTimeFormat('it-IT', { weekday: 'long' });

  const tasksLabel = count => count + ' attività';
  const daysLabel = count => (count === 1 ? '1 giorno' : count + ' giorni');
  const pointsLabel = count => (count === 1 ? '1 punto' : utils.formatNumber(count) + ' punti');
  const dayName = day => weekdayName.format(utils.parseISODate(day));

  /* ---------- Livello ---------- */

  /**
   * Il livello di `points` punti guadagnati (stats.totalPoints), calcolato e mai salvato:
   * { index, number, rank, name, badge, from, to, next, missing, progress }.
   * - number: da 1 a 7. Dopo Aurora si continua con Aurora 2, 3… (rank), con il distintivo di Aurora;
   * - index: cresce di uno a ogni livello, Aurore comprese: dice se un completamento ha fatto salire;
   * - from e to: i punti da cui parte questo livello e il prossimo; next: il nome del prossimo; missing: i punti che mancano;
   * - progress: da 0 a 1, la barra verso il prossimo livello.
   */
  function levelOf(points) {
    const total = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
    const last = LEVELS.length - 1;
    let i = 0;
    while (i < last && total >= LEVELS[i + 1].from) i++;
    const level = LEVELS[i];
    if (i < last) return describe(i, 1, level, level.from, LEVELS[i + 1].from, LEVELS[i + 1].name, total);
    const rank = 1 + Math.floor((total - level.from) / MOTIVATION.auroraStep);
    const from = level.from + (rank - 1) * MOTIVATION.auroraStep;
    return describe(last + rank - 1, rank, level, from, from + MOTIVATION.auroraStep, level.name + ' ' + (rank + 1), total);
  }

  function describe(index, rank, level, from, to, next, total) {
    return {
      index,
      number: Math.min(index, LEVELS.length - 1) + 1,
      rank,
      name: rank > 1 ? level.name + ' ' + rank : level.name,
      badge: level.badge,
      from,
      to,
      next,
      missing: to - total,
      progress: (total - from) / (to - from)
    };
  }

  /** «livello 4 di 7». Dopo Aurora niente: il numero è già nel nome («Aurora 2») e sul distintivo. */
  function levelStep(level) {
    return level.rank > 1 ? '' : 'livello ' + level.number + ' di ' + LEVELS.length;
  }

  /** «Ancora 240 punti per Cometa». */
  function levelNote(level) {
    return 'Ancora ' + pointsLabel(level.missing) + ' per ' + level.next;
  }

  /** Il livello raggiunto passando da `before` ad `after` punti, se è più alto; altrimenti null (anche scendendo). */
  function levelUp(before, after) {
    const next = levelOf(after);
    return next.index > levelOf(before).index ? next : null;
  }

  /* ---------- Settimana ---------- */

  /** I sette giorni da lunedì `monday`, ognuno con { day, letter, done, focus } dal registro. */
  function daysFrom(stats, monday) {
    return AG.weekOf(monday).map((day, i) => ({
      day,
      letter: LETTERS[i],
      done: P.dayTotals(stats, day).done,
      points: P.pointsOn(stats, day), // completamenti e sfide
      focus: F.minutesOn(stats, day)
    }));
  }

  const sum = (list, field) => list.reduce((total, item) => total + item[field], 0);

  /**
   * La settimana di `today`, da lunedì a domenica: { start, days, todayIndex, done, focus }.
   * Ogni giorno ha le attività completate (done), i punti, i minuti di focus, isToday e isFuture.
   */
  function weekOf(stats, today) {
    const days = daysFrom(stats, AG.mondayOf(today)).map(entry => ({
      ...entry,
      isToday: entry.day === today,
      isFuture: entry.day > today
    }));
    return { start: days[0].day, days, todayIndex: days.findIndex(entry => entry.isToday), done: sum(days, 'done'), focus: sum(days, 'focus') };
  }

  /**
   * La settimana prima di quella di `today`: { start, done, focus, activeDays, best }.
   * `best` è il giorno con più attività completate (a parità, quello con più punti, poi il primo), oppure null.
   */
  function lastWeek(stats, today) {
    const days = daysFrom(stats, utils.addDays(AG.mondayOf(today), -7));
    const active = days.filter(entry => entry.done > 0);
    const best = active.reduce((top, entry) => (!top || entry.done > top.done || (entry.done === top.done && entry.points > top.points) ? entry : top), null);
    return { start: days[0].day, done: sum(days, 'done'), focus: sum(days, 'focus'), activeDays: active.length, best: best ? best.day : null };
  }

  /**
   * La riga sulla settimana scorsa, solo con le cose positive: «23 attività · 4 h 10 min di focus · il giorno migliore è
   * stato martedì». Il giorno migliore si dice solo se i giorni attivi sono almeno due. '' se non c'è niente da dire.
   */
  function lastWeekText(recap) {
    const parts = [];
    if (recap.done > 0) parts.push(tasksLabel(recap.done));
    if (recap.focus > 0) parts.push(utils.formatDuration(recap.focus) + ' di focus');
    if (recap.best && recap.activeDays >= 2) parts.push('il giorno migliore è stato ' + dayName(recap.best));
    return parts.join(' · ');
  }

  /* ---------- Obiettivo ---------- */

  /** L'obiettivo salvato, ripulito: uno di MOTIVATION.goals, altrimenti null (nessun obiettivo). */
  function sanitizeGoal(value) {
    return MOTIVATION.goals.includes(value) ? value : null;
  }

  /** L'obiettivo dopo un tocco sul pulsante: nessuno → 5 → 10 → 15 → 20 → 30 → 50 → nessuno. */
  function nextGoal(goal) {
    const i = MOTIVATION.goals.indexOf(goal);
    if (i === -1) return MOTIVATION.goals[0];
    return i === MOTIVATION.goals.length - 1 ? null : MOTIVATION.goals[i + 1];
  }

  /** true se con `goal` la settimana è già una costellazione. */
  function isReached(week, goal) {
    return goal !== null && week.done >= goal;
  }

  /* ---------- Cielo ---------- */

  const GOLDEN = 0.6180339887; // passi che spargono bene i punti: altezza, lato e grandezza di stelle successive
  const SIDE = 0.7548776662;
  const SIZE = 0.5698402910;
  const frac = value => value - Math.floor(value);
  const round1 = value => Math.round(value * 10) / 10;

  /** Tre numeri tra 0 e 1 che dipendono solo dal giorno 'YYYY-MM-DD' (FNV-1a, poi un generatore piccolo). */
  function daySeeds(day) {
    let hash = 2166136261;
    for (let i = 0; i < day.length; i++) {
      hash ^= day.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    const next = () => {
      hash = (hash + 0x6D2B79F5) >>> 0;
      let t = hash;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return [next(), next(), next()];
  }

  /**
   * Dove sta la stella numero `order` (da 0) del giorno `day`, nella colonna `column` (0 = lunedì): { x, y, r }.
   * Dipende solo dal giorno e dal numero d'ordine. Le stelle di uno stesso giorno salgono e scendono a passi d'oro,
   * quindi non si ammucchiano.
   */
  function starAt(day, column, order) {
    const { width, height, top, bottom, spread } = MOTIVATION.sky;
    const col = width / 7;
    const [a, b, c] = daySeeds(day);
    return {
      x: round1(column * col + col / 2 + (frac(b + order * SIDE) - 0.5) * col * spread),
      y: round1(top + frac(a + order * GOLDEN) * (height - top - bottom)),
      r: round1(2 + frac(c + order * SIZE) * 1.8)
    };
  }

  /**
   * Le linee della costellazione: l'albero che unisce tutte le stelle con le distanze più corte (algoritmo di Prim,
   * partendo dalla prima). Coppie di indici in `stars`; a parità di distanza vince l'indice più basso.
   */
  function constellation(stars) {
    const n = stars.length;
    if (n < 2) return [];
    const inTree = new Array(n).fill(false);
    const best = new Array(n).fill(Infinity);
    const from = new Array(n).fill(-1);
    best[0] = 0;
    const lines = [];
    for (let step = 0; step < n; step++) {
      let u = -1;
      for (let i = 0; i < n; i++) if (!inTree[i] && (u === -1 || best[i] < best[u])) u = i;
      inTree[u] = true;
      if (from[u] >= 0) lines.push([from[u], u]);
      for (let i = 0; i < n; i++) {
        if (inTree[i]) continue;
        const dx = stars[u].x - stars[i].x;
        const dy = stars[u].y - stars[i].y;
        const distance = dx * dx + dy * dy;
        if (distance < best[i]) {
          best[i] = distance;
          from[i] = u;
        }
      }
    }
    return lines;
  }

  /**
   * Il cielo della settimana: { stars, ghosts, lines, reached, missing }.
   * - stars: una stella per ogni attività completata, nella colonna del suo giorno ({ x, y, r, column });
   * - ghosts: con un obiettivo, un cerchio tratteggiato per ogni stella che manca, nei giorni che restano (da oggi a
   *   domenica, a turno). Ognuno sta proprio dove si accenderà la prossima stella di quel giorno;
   * - lines: raggiunto l'obiettivo, le coppie di stelle unite nella costellazione; altrimenti vuoto.
   */
  function sky(week, goal) {
    const cap = MOTIVATION.maxStarsPerDay;
    const stars = [];
    week.days.forEach((entry, column) => {
      for (let order = 0; order < Math.min(entry.done, cap); order++) stars.push({ ...starAt(entry.day, column, order), column });
    });
    const reached = isReached(week, goal);
    const missing = goal === null ? 0 : Math.max(0, goal - week.done);
    const ghosts = [];
    const open = week.days.map((entry, column) => column).filter(column => column >= Math.max(0, week.todayIndex));
    const extra = week.days.map(() => 0);
    for (let k = 0; k < missing && open.length; k++) {
      const column = open[k % open.length];
      const order = week.days[column].done + extra[column];
      extra[column] += 1;
      if (order < cap) {
        const spot = starAt(week.days[column].day, column, order);
        ghosts.push({ x: spot.x, y: spot.y, column });
      }
    }
    return { stars, ghosts, lines: reached ? constellation(stars) : [], reached, missing };
  }

  /* ---------- Frasi della settimana ---------- */

  /** «5 di 15» con un obiettivo; «5 stelle» senza, e quando l'obiettivo è superato («18 di 15» si legge male). */
  function countText(week, goal) {
    if (goal !== null && week.done <= goal) return { value: String(week.done), rest: 'di ' + goal };
    return { value: String(week.done), rest: week.done === 1 ? 'stella' : 'stelle' };
  }

  /** Il pulsante dell'obiettivo: «Obiettivo: 15», oppure l'invito a sceglierlo. */
  function goalButtonText(goal) {
    return goal === null ? 'Scegli l\'obiettivo' : 'Obiettivo: ' + goal;
  }

  /** La frase sotto il cielo: che cosa accende le stelle e quante ne mancano, mai un rimprovero. */
  function skyNote(week, goal) {
    if (goal === null) return 'Ogni attività completata accende una stella. Scegli un obiettivo: le stelle che mancano compaiono come cerchi da accendere.';
    if (isReached(week, goal)) return 'Obiettivo raggiunto: la settimana è diventata una costellazione ✨';
    const missing = goal - week.done;
    return 'Ogni attività completata accende una stella. Ancora ' + missing + ' e la settimana diventa una costellazione.';
  }

  /** Che cosa dice il cielo, per il lettore di schermo: totale, obiettivo e attività di ogni giorno fino a oggi. */
  function skyLabel(week, goal) {
    const done = week.done === 1 ? '1 attività completata' : week.done + ' attività completate';
    let head = 'La tua settimana: ' + done;
    if (goal !== null) head += isReached(week, goal) ? ', obiettivo di ' + goal + ' raggiunto' : ' su ' + goal;
    const days = week.days
      .filter(entry => !entry.isFuture)
      .map(entry => dayName(entry.day) + (entry.isToday ? ' (oggi)' : '') + ' ' + entry.done);
    return head + '. ' + utils.capitalize(days.join(', ')) + '.';
  }

  /** Che cosa dice il lettore di schermo dopo un tocco sul pulsante dell'obiettivo. */
  function goalAnnouncement(goal) {
    return goal === null ? 'Nessun obiettivo per la settimana' : 'Obiettivo della settimana: ' + goal + ' attività';
  }

  /* ---------- I tuoi numeri ---------- */

  /**
   * «I tuoi numeri», dal registro: minuti di focus di oggi, della settimana e in tutto; la serie più lunga (il record);
   * le attività del giorno migliore; le completate in tutto. «Svuota» non li cambia.
   */
  function numbers(stats, today) {
    const days = stats.days || {};
    const counts = Object.keys(days).map(day => days[day].done);
    return {
      focusToday: F.minutesOn(stats, today),
      focusWeek: AG.weekOf(today).reduce((total, day) => total + F.minutesOn(stats, day), 0),
      focusTotal: F.totalMinutes(stats),
      bestStreak: stats.bestStreak || 0,
      bestDay: counts.reduce((top, count) => Math.max(top, count), 0),
      completed: counts.reduce((total, count) => total + count, 0)
    };
  }

  /** Le sei righe di «I tuoi numeri», in ordine: prima i tre del focus, poi serie, giorno migliore e completate. */
  function numberRows(values) {
    return [
      { key: 'focus-today', label: 'Focus oggi', value: utils.formatDuration(values.focusToday) },
      { key: 'focus-week', label: 'Focus in settimana', value: utils.formatDuration(values.focusWeek) },
      { key: 'focus-total', label: 'Focus in tutto', value: utils.formatDuration(values.focusTotal) },
      { key: 'best-streak', label: 'Serie più lunga', value: daysLabel(values.bestStreak) },
      { key: 'best-day', label: 'Giorno migliore', value: tasksLabel(values.bestDay) },
      { key: 'completed', label: 'Completate in tutto', value: utils.formatNumber(values.completed) }
    ];
  }

  Aura.motivation = {
    MOTIVATION,
    LEVELS,
    levelOf,
    levelStep,
    levelNote,
    levelUp,
    weekOf,
    lastWeek,
    lastWeekText,
    sanitizeGoal,
    nextGoal,
    isReached,
    starAt,
    constellation,
    sky,
    countText,
    goalButtonText,
    skyNote,
    skyLabel,
    goalAnnouncement,
    numbers,
    numberRows
  };
})(window.Aura = window.Aura || {});
