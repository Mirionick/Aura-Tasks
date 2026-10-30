/*
 * Aura Tasks — salvataggio nel localStorage.
 * Le funzioni pure (parse, migrate, sanitizeTask, sanitizeStats, serialize) sono separate da quelle che toccano
 * l'archivio del browser (load, save), così si possono testare senza localStorage.
 */
(function (Aura) {
  'use strict';

  const { utils, tasks: T, points: P } = Aura;

  const KEY = 'aura-tasks:data';
  const BACKUP_PREFIX = 'aura-tasks:backup-';
  // Per cambiare lo schema: aumenta questo numero e aggiungi un passo in migrate() (vedi CLAUDE.md).
  const SCHEMA_VERSION = 3;

  const isCount = value => Number.isInteger(value) && value >= 0;

  function emptyState() {
    return { version: SCHEMA_VERSION, tasks: [], stats: P.emptyStats() };
  }

  /** Porta i dati salvati da versioni precedenti a quella attuale, un passo alla volta. */
  function migrate(data) {
    const state = { ...data };
    if (!(state.version >= 1)) state.version = 1; // dati senza versione: trattati come v1
    if (state.version === 1) {
      // v2: punti e serie. Il registro si ricostruisce in parse(), dalle attività completate già ripulite.
      state.stats = null;
      state.version = 2;
    }
    if (state.version === 2) {
      // v3: orario facoltativo. Le attività lo ricevono (null) da sanitizeTask(); punti e registro restano intatti.
      state.version = 3;
    }
    return state;
  }

  /**
   * Ripulisce un'attività letta dall'archivio. I campi non validi tornano ai valori predefiniti;
   * senza titolo l'attività è irrecuperabile (null). I campi sconosciuti vengono conservati.
   */
  function sanitizeTask(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, T.LIMITS.titleMax) : '';
    if (!title) return null;

    const validDuration = Number.isInteger(raw.duration) &&
      raw.duration >= T.LIMITS.durationMin && raw.duration <= T.LIMITS.durationMax;
    const duration = validDuration ? raw.duration : T.DEFAULTS.duration;
    const energy = T.ENERGY_KEYS.includes(raw.energy) ? raw.energy : T.DEFAULTS.energy;
    const createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now();
    const done = raw.done === true;
    // Completata senza punti (dati della v1): si calcolano con la formula attuale.
    const pointsAwarded = !done ? null : isCount(raw.pointsAwarded) ? raw.pointsAwarded : P.pointsFor({ duration, energy });

    const date = utils.isISODate(raw.date) ? raw.date : null;

    return {
      ...raw,
      id: typeof raw.id === 'string' && raw.id ? raw.id : utils.uid(),
      title,
      duration,
      energy,
      date,
      time: date && utils.isTime(raw.time) ? raw.time : null, // l'orario ha senso solo con un giorno
      done,
      createdAt,
      completedAt: done ? (Number.isFinite(raw.completedAt) ? raw.completedAt : createdAt) : null,
      pointsAwarded
    };
  }

  /**
   * Ripulisce il registro di punti e serie. I giorni non validi vengono scartati; totale e record
   * non validi si ricalcolano dai giorni. I campi sconosciuti vengono conservati.
   */
  function sanitizeStats(raw) {
    const rawDays = raw.days && typeof raw.days === 'object' ? raw.days : {};
    const days = {};
    Object.keys(rawDays).forEach(day => {
      const entry = rawDays[day];
      if (!utils.isISODate(day) || !entry || typeof entry !== 'object' || !isCount(entry.done) || entry.done === 0) return;
      days[day] = { ...entry, points: isCount(entry.points) ? entry.points : 0 };
    });
    const sum = Object.keys(days).reduce((total, day) => total + days[day].points, 0);
    const milestones = Array.isArray(raw.milestones)
      ? Array.from(new Set(raw.milestones.filter(m => Number.isInteger(m) && m > 0))).sort((a, b) => a - b)
      : [];
    return {
      ...raw,
      totalPoints: isCount(raw.totalPoints) ? raw.totalPoints : sum,
      bestStreak: isCount(raw.bestStreak) ? raw.bestStreak : P.longestStreak(days),
      milestones,
      days
    };
  }

  /** Testo salvato → stato valido. Lancia un errore se il testo non è leggibile. */
  function parse(raw) {
    if (raw === null || raw === undefined || raw === '') return emptyState();
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !Array.isArray(data.tasks)) {
      throw new Error('Formato dei dati non riconosciuto');
    }
    const state = migrate(data);
    const seen = new Set();
    state.tasks = state.tasks.map(sanitizeTask).filter(Boolean).map(task => {
      const unique = seen.has(task.id) ? { ...task, id: utils.uid() } : task;
      seen.add(unique.id);
      return unique;
    });
    // Registro mancante (dati appena portati dalla v1) o illeggibile: si ricostruisce dalle attività completate.
    const hasStats = state.stats && typeof state.stats === 'object' && !Array.isArray(state.stats);
    state.stats = hasStats ? sanitizeStats(state.stats) : P.rebuildStats(state.tasks);
    // Mai abbassare la versione: i dati scritti da una versione più nuova dell'app restano intatti.
    state.version = Math.max(state.version, SCHEMA_VERSION);
    return state;
  }

  function serialize(state) {
    return JSON.stringify(state);
  }

  /**
   * Legge i dati salvati. Restituisce { state, warning }: `warning` è un messaggio per l'utente
   * quando qualcosa non va (archivio non disponibile o dati illeggibili), altrimenti null.
   */
  function load() {
    let raw;
    try {
      raw = window.localStorage.getItem(KEY);
    } catch (err) {
      return {
        state: emptyState(),
        warning: 'Questo browser non permette di salvare i dati: le attività andranno perse alla chiusura.'
      };
    }
    try {
      return { state: parse(raw), warning: null };
    } catch (err) {
      backup(raw);
      return {
        state: emptyState(),
        warning: 'I dati salvati erano illeggibili: ne è stata conservata una copia e l\'elenco riparte da zero.'
      };
    }
  }

  /** Conserva una copia dei dati illeggibili, per non perderli del tutto. */
  function backup(raw) {
    try {
      window.localStorage.setItem(BACKUP_PREFIX + Date.now(), raw);
    } catch (err) {
      // Spazio esaurito: non c'è altro da fare.
    }
  }

  /** Salva lo stato. Restituisce false se il browser non lo permette (spazio pieno, archiviazione disattivata). */
  function save(state) {
    try {
      window.localStorage.setItem(KEY, serialize(state));
      return true;
    } catch (err) {
      return false;
    }
  }

  /** Chiede al browser di non cancellare i dati in automatico (utile soprattutto su Safari). */
  function requestPersistence() {
    const manager = navigator.storage;
    if (!manager || typeof manager.persist !== 'function') return;
    Promise.resolve(typeof manager.persisted === 'function' ? manager.persisted() : false)
      .then(already => already || manager.persist())
      .catch(() => {});
  }

  Aura.storage = {
    KEY,
    SCHEMA_VERSION,
    emptyState,
    migrate,
    sanitizeTask,
    sanitizeStats,
    parse,
    serialize,
    load,
    save,
    requestPersistence
  };
})(window.Aura = window.Aura || {});
