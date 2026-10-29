/*
 * Aura Tasks — logica delle attività.
 * Solo funzioni pure: ricevono dati e restituiscono NUOVI dati (niente modifiche in place),
 * così sono facili da testare e da annullare. Niente DOM, niente localStorage.
 */
(function (Aura) {
  'use strict';

  const { utils } = Aura;

  /** Livelli di energia. La chiave è quella salvata nei dati; `order` permette i confronti (bassa < media < alta). */
  const ENERGY = {
    low: { label: 'Bassa', order: 1, hint: 'Va bene anche nei momenti di stanchezza.' },
    medium: { label: 'Media', order: 2, hint: 'Richiede un po\' di attenzione.' },
    high: { label: 'Alta', order: 3, hint: 'Serve concentrazione ed energia piena.' }
  };
  const ENERGY_KEYS = Object.keys(ENERGY);

  const LIMITS = { titleMax: 120, durationMin: 1, durationMax: 600 };
  const DEFAULTS = { duration: 30, energy: 'medium' };

  /** Sezioni della lista, nell'ordine in cui compaiono. */
  const SECTIONS = [
    { key: 'overdue', title: 'In ritardo' },
    { key: 'today', title: 'Oggi' },
    { key: 'tomorrow', title: 'Domani' },
    { key: 'upcoming', title: 'Prossimi giorni' },
    { key: 'someday', title: 'Senza data' }
  ];

  /**
   * Controlla i dati del modulo "Nuova attività".
   * Restituisce { value, errors }: `value` è normalizzato, `errors` ha un messaggio per ogni campo sbagliato.
   */
  function validateInput(input) {
    const errors = {};

    const title = String(input.title == null ? '' : input.title).trim().replace(/\s+/g, ' ');
    if (!title) errors.title = 'Scrivi cosa devi fare.';
    else if (title.length > LIMITS.titleMax) errors.title = 'Al massimo ' + LIMITS.titleMax + ' caratteri.';

    const rawDuration = String(input.duration == null ? '' : input.duration).trim();
    const duration = rawDuration === '' ? NaN : Math.round(Number(rawDuration));
    if (!Number.isFinite(duration) || duration < LIMITS.durationMin || duration > LIMITS.durationMax) {
      errors.duration = 'Indica una durata tra ' + LIMITS.durationMin + ' e ' + LIMITS.durationMax + ' minuti.';
    }

    const energy = ENERGY_KEYS.includes(input.energy) ? input.energy : null;
    if (!energy) errors.energy = 'Scegli il livello di energia.';

    const date = input.date ? String(input.date) : null;
    if (date && !utils.isISODate(date)) errors.date = 'La data non è valida.';

    return { value: { title, duration, energy, date }, errors };
  }

  /** Nuova attività da dati già controllati con validateInput(). */
  function createTask(value, now) {
    return {
      id: utils.uid(),
      title: value.title,
      duration: value.duration,
      energy: value.energy,
      date: value.date || null,
      done: false,
      createdAt: now,
      completedAt: null,
      pointsAwarded: null
    };
  }

  /**
   * Segna un'attività come completata (done = true) o di nuovo da fare (done = false).
   * `pointsAwarded` sono i punti dati al completamento (li calcola points.js).
   */
  function setDone(tasks, id, done, now, pointsAwarded = null) {
    return tasks.map(task => {
      if (task.id !== id || task.done === done) return task;
      return { ...task, done, completedAt: done ? now : null, pointsAwarded: done ? pointsAwarded : null };
    });
  }

  /** Toglie un'attività. Restituisce anche l'attività tolta e la sua posizione, per poterla ripristinare. */
  function removeTask(tasks, id) {
    const index = tasks.findIndex(task => task.id === id);
    if (index === -1) return { tasks, removed: null, index: -1 };
    return { tasks: tasks.filter((_, i) => i !== index), removed: tasks[index], index };
  }

  /** Rimette un'attività tolta nella posizione di prima (o in fondo, se nel frattempo l'elenco si è accorciato). */
  function restoreTask(tasks, task, index) {
    if (tasks.some(t => t.id === task.id)) return tasks;
    const next = tasks.slice();
    next.splice(Math.min(Math.max(index, 0), next.length), 0, task);
    return next;
  }

  /** Toglie tutte le attività completate. `removed` ({ task, index }) serve per "Annulla". */
  function removeCompleted(tasks) {
    const removed = [];
    const kept = [];
    tasks.forEach((task, index) => {
      if (task.done) removed.push({ task, index });
      else kept.push(task);
    });
    return { tasks: kept, removed };
  }

  /** Ripristina più attività tolte (per esempio dopo "Svuota"), ognuna nella sua posizione. */
  function restoreMany(tasks, removed) {
    return removed
      .slice()
      .sort((a, b) => a.index - b.index)
      .reduce((list, item) => restoreTask(list, item.task, item.index), tasks);
  }

  /** In quale sezione va un'attività da fare, rispetto a oggi. */
  function sectionOf(task, today) {
    if (!task.date) return 'someday';
    const diff = utils.daysBetween(today, task.date);
    if (diff < 0) return 'overdue';
    if (diff === 0) return 'today';
    if (diff === 1) return 'tomorrow';
    return 'upcoming';
  }

  function totalMinutes(tasks) {
    return tasks.reduce((sum, task) => sum + task.duration, 0);
  }

  const byCreation = (a, b) => a.createdAt - b.createdAt;
  const byDate = (a, b) => (a.date === b.date ? byCreation(a, b) : a.date < b.date ? -1 : 1);

  /**
   * Divide le attività per la lista. Restituisce:
   * - `sections`: solo le sezioni non vuote, ognuna con { key, title, tasks, minutes };
   * - `completed`: le completate, dalla più recente.
   */
  function groupTasks(tasks, today) {
    const buckets = {};
    SECTIONS.forEach(section => { buckets[section.key] = []; });
    const completed = [];

    tasks.forEach(task => {
      if (task.done) completed.push(task);
      else buckets[sectionOf(task, today)].push(task);
    });

    buckets.overdue.sort(byDate);
    buckets.upcoming.sort(byDate);
    buckets.today.sort(byCreation);
    buckets.tomorrow.sort(byCreation);
    buckets.someday.sort(byCreation);
    completed.sort((a, b) => b.completedAt - a.completedAt);

    const sections = SECTIONS
      .filter(section => buckets[section.key].length > 0)
      .map(section => ({ ...section, tasks: buckets[section.key], minutes: totalMinutes(buckets[section.key]) }));

    return { sections, completed };
  }

  /** Numeri dell'intestazione: attività da fare e loro durata totale. Le fatte oggi vengono dal registro (points.js). */
  function summarize(tasks) {
    const open = tasks.filter(task => !task.done);
    return { openCount: open.length, openMinutes: totalMinutes(open) };
  }

  Aura.tasks = {
    ENERGY,
    ENERGY_KEYS,
    LIMITS,
    DEFAULTS,
    SECTIONS,
    validateInput,
    createTask,
    setDone,
    removeTask,
    restoreTask,
    removeCompleted,
    restoreMany,
    sectionOf,
    groupTasks,
    totalMinutes,
    summarize
  };
})(window.Aura = window.Aura || {});
