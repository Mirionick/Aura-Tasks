/*
 * Aura Tasks — logica delle attività.
 * Solo funzioni pure: ricevono dati e restituiscono NUOVI dati (niente modifiche in place),
 * così sono facili da testare e da annullare. Niente DOM, niente localStorage.
 */
(function (Aura) {
  'use strict';

  const { utils, repeat: RP } = Aura;

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

  /** Le schede dell'app, nell'ordine della barra, e le sezioni della lista che mostrano (le completate vanno a parte). */
  const TABS = ['focus', 'agenda', 'motivation'];
  const TAB_SECTIONS = { focus: ['overdue', 'today', 'someday'], agenda: ['tomorrow', 'upcoming'] };

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

    const time = input.time ? String(input.time) : null;
    if (time && !utils.isTime(time)) errors.time = 'L\'orario non è valido.';
    else if (time && !date) errors.time = 'Per l\'orario scegli anche il giorno.';

    // «Si ripete» (P-005, passo 5.1): una regola di Aura.repeat, che ha bisogno di un giorno, come l'ora.
    const repeat = input.repeat ? RP.clean(input.repeat) : null;
    if (input.repeat && !repeat) errors.repeat = 'La ripetizione non è valida.';
    else if (repeat && !date) errors.repeat = 'Per ripeterla scegli anche il giorno.';

    return { value: { title, duration, energy, date, time, repeat }, errors };
  }

  /**
   * Nuova attività da dati già controllati con validateInput(). Se si ripete, è la prima volta della sua serie:
   * `seriesId` è il suo id (P-005, passo 5.1).
   */
  function createTask(value, now) {
    const id = utils.uid();
    const repeat = value.date && value.repeat ? value.repeat : null;
    return {
      id,
      title: value.title,
      duration: value.duration,
      energy: value.energy,
      date: value.date || null,
      time: value.date && value.time ? value.time : null,
      done: false,
      createdAt: now,
      completedAt: null,
      pointsAwarded: null,
      repeat,
      seriesId: repeat ? id : null
    };
  }

  /** Campi che il foglio "Modifica attività" può cambiare. Tutto il resto (completamento e punti compresi) resta com'è. */
  const EDITABLE_FIELDS = ['title', 'duration', 'energy', 'date', 'time', 'repeat'];

  /**
   * I campi modificabili di un'attività, nella stessa forma di validateInput().value. L'ora e la ripetizione ci sono solo
   * con un giorno.
   */
  function editableFields(task) {
    const date = task.date || null;
    return {
      title: task.title,
      duration: task.duration,
      energy: task.energy,
      date,
      time: date && task.time ? task.time : null,
      repeat: date && task.repeat ? task.repeat : null
    };
  }

  /**
   * true se due insiemi di campi modificabili sono uguali: un campo assente vale null, e le regole delle ripetizioni si
   * confrontano con Aura.repeat.same() (sono oggetti). Lo usano anche l'assistente e il suo «Annulla».
   */
  function sameFields(a, b) {
    return Boolean(a && b) && EDITABLE_FIELDS.every(field => {
      const x = a[field] == null ? null : a[field];
      const y = b[field] == null ? null : b[field];
      return field === 'repeat' ? RP.same(x, y) : x === y;
    });
  }

  /**
   * Modifica un'attività con dati già controllati da validateInput(). Cambiano solo titolo, durata, energia, giorno, ora
   * e ripetizione: id, creazione, completamento, punti già assegnati e campi sconosciuti restano com'erano.
   * Una ripetizione nuova ha bisogno di una serie: la sua, se non ce n'è un'altra da fare nella stessa serie, altrimenti
   * una nuova (ce n'è sempre una sola da fare per serie).
   * Restituisce { tasks, previous, changed }: `previous` è l'attività prima della modifica (null se non c'è).
   * Se non cambia niente, `tasks` è lo stesso elenco ricevuto.
   */
  function updateTask(tasks, id, value) {
    const index = tasks.findIndex(task => task.id === id);
    if (index === -1) return { tasks, previous: null, changed: false };
    const previous = tasks[index];
    const next = { ...previous, ...editableFields(value) };
    if (sameFields(next, previous)) return { tasks, previous, changed: false };
    if (next.repeat && !next.done && (!next.seriesId || openInSeries(tasks, next.seriesId, id))) {
      next.seriesId = openInSeries(tasks, id, id) ? utils.uid() : id; // il suo id, se non lo usa già un'altra serie
    }
    return { tasks: tasks.map((task, i) => (i === index ? next : task)), previous, changed: true };
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

  /** La ripetizione da fare di una serie, se c'è (ce n'è al massimo una), tranne `exceptId`. */
  function openInSeries(tasks, seriesId, exceptId) {
    return tasks.find(task => !task.done && task.repeat && task.seriesId === seriesId && task.id !== exceptId) || null;
  }

  /**
   * La prossima volta di una ripetizione completata adesso (P-005, passo 5.1): stesso titolo, durata, energia, ora e
   * regola, la stessa serie, un id nuovo e il giorno di Aura.repeat.afterDone().
   */
  function nextOccurrence(task, now) {
    return {
      id: utils.uid(),
      title: task.title,
      duration: task.duration,
      energy: task.energy,
      date: RP.afterDone(task.repeat, task.date, utils.todayISO(now)),
      time: task.time || null,
      done: false,
      createdAt: now,
      completedAt: null,
      pointsAwarded: null,
      repeat: task.repeat,
      seriesId: task.seriesId || task.id
    };
  }

  /**
   * setDone() con le ripetizioni (P-005, passo 5.1). Restituisce { tasks, next }.
   * - Completando una ripetizione da fare, in fondo all'elenco arriva la prossima volta (`next`). Se nella serie ce n'è
   *   già una da fare, non se ne crea un'altra: ce n'è sempre una sola da fare per volta.
   * - Togliendo la spunta a una volta completata con la sua regola: se la serie ha già la sua prossima da fare, questa
   *   torna da fare come attività normale, senza regola; altrimenti torna con la regola e la serie riparte da lei.
   *   «Annulla» subito dopo un completamento toglie prima la prossima (vedi js/app.js), così torna tutto com'era.
   */
  function toggleDone(tasks, id, done, now, pointsAwarded = null) {
    const task = tasks.find(t => t.id === id);
    if (!task || task.done === done) return { tasks, next: null };
    const list = setDone(tasks, id, done, now, pointsAwarded);
    if (!task.repeat || !task.date) return { tasks: list, next: null };
    const seriesId = task.seriesId || task.id;
    const other = openInSeries(list, seriesId, id);
    if (done) {
      if (other) return { tasks: list, next: null };
      const next = nextOccurrence({ ...task, seriesId }, now);
      return { tasks: list.concat(next), next };
    }
    return { tasks: other ? list.map(t => (t.id === id ? { ...t, repeat: null } : t)) : list, next: null };
  }

  /**
   * «Salta questa volta» (P-005, passo 5.1): la ripetizione da fare passa al giorno di Aura.repeat.afterSkip(), senza
   * punti. Restituisce { tasks, previous, date }: `previous` è l'attività di prima (per «Annulla»), `date` il giorno nuovo.
   * Se l'attività non è una ripetizione da fare, non cambia niente (`previous` e `date` null).
   */
  function skipOccurrence(tasks, id, today) {
    const task = tasks.find(t => t.id === id);
    if (!task || task.done || !task.repeat || !task.date) return { tasks, previous: null, date: null };
    const date = RP.afterSkip(task.repeat, task.date, today);
    return { tasks: tasks.map(t => (t.id === id ? { ...t, date } : t)), previous: task, date };
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

  /** In quale scheda si vede un'attività: completata → Motivazione (storico); da fare → Focus o Agenda, secondo la sezione. */
  function tabOf(task, today) {
    if (task.done) return 'motivation';
    return TAB_SECTIONS.focus.includes(sectionOf(task, today)) ? 'focus' : 'agenda';
  }

  /** true se l'attività si vede nella scheda. Focus mostra anche le completate di oggi («Completate oggi»). */
  function isInTab(task, tab, today) {
    if (task.done) return tab === 'motivation' || (tab === 'focus' && utils.todayISO(task.completedAt) === today);
    return tabOf(task, today) === tab;
  }

  /** true se l'attività è da fare, è di oggi e la sua ora è già passata: la card mostra l'ora in rosso, come «Ieri». */
  function isTimePassed(task, now) {
    const moment = new Date(now);
    return !task.done && Boolean(task.time) && task.date === utils.toISODate(moment) && task.time < utils.formatTime(moment);
  }

  /** Quante attività di oggi hanno l'ora già passata: se cambia, la lista va ridisegnata. */
  function passedCount(tasks, now) {
    return tasks.filter(task => isTimePassed(task, now)).length;
  }

  /** Le completate in un giorno (quello locale di completedAt), dalla più recente. */
  function completedOn(tasks, day) {
    return tasks
      .filter(task => task.done && Number.isFinite(task.completedAt) && utils.todayISO(task.completedAt) === day)
      .sort((a, b) => b.completedAt - a.completedAt);
  }

  function totalMinutes(tasks) {
    return tasks.reduce((sum, task) => sum + task.duration, 0);
  }

  // Ordini delle liste, esportati anche per l'Agenda (js/agenda.js) come compareByCreation, compareByTime e compareByDate.
  const byCreation = (a, b) => a.createdAt - b.createdAt;
  // Nello stesso giorno: prima quelle con orario, in ordine d'ora; quelle senza orario restano in ordine di creazione.
  const byTime = (a, b) => {
    if (a.time && b.time && a.time !== b.time) return a.time < b.time ? -1 : 1;
    if (Boolean(a.time) !== Boolean(b.time)) return a.time ? -1 : 1;
    return byCreation(a, b);
  };
  const byDate = (a, b) => (a.date === b.date ? byTime(a, b) : a.date < b.date ? -1 : 1);

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
    buckets.today.sort(byTime);
    buckets.tomorrow.sort(byTime);
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
    TABS,
    TAB_SECTIONS,
    EDITABLE_FIELDS,
    validateInput,
    createTask,
    editableFields,
    sameFields,
    updateTask,
    setDone,
    openInSeries,
    nextOccurrence,
    toggleDone,
    skipOccurrence,
    removeTask,
    restoreTask,
    removeCompleted,
    restoreMany,
    sectionOf,
    tabOf,
    isInTab,
    isTimePassed,
    passedCount,
    completedOn,
    groupTasks,
    totalMinutes,
    summarize,
    compareByTime: byTime,
    compareByDate: byDate,
    compareByCreation: byCreation
  };
})(window.Aura = window.Aura || {});
