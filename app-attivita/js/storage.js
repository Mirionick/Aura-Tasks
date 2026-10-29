/*
 * Aura Tasks — salvataggio nel localStorage.
 * Le funzioni pure (parse, migrate, sanitizeTask, serialize) sono separate da quelle che toccano
 * l'archivio del browser (load, save), così si possono testare senza localStorage.
 */
(function (Aura) {
  'use strict';

  const { utils, tasks: T } = Aura;

  const KEY = 'aura-tasks:data';
  const BACKUP_PREFIX = 'aura-tasks:backup-';
  // Per cambiare lo schema: aumenta questo numero e aggiungi un passo in migrate() (vedi CLAUDE.md).
  const SCHEMA_VERSION = 1;

  function emptyState() {
    return { version: SCHEMA_VERSION, tasks: [] };
  }

  /**
   * Porta i dati salvati da versioni precedenti a quella attuale, un passo alla volta.
   * Esempio per il futuro:
   *   if (state.version === 1) { state.stats = …; state.version = 2; }
   */
  function migrate(data) {
    const state = { ...data };
    if (!(state.version >= 1)) state.version = 1; // dati senza versione: trattati come v1
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
    const createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now();
    const done = raw.done === true;

    return {
      ...raw,
      id: typeof raw.id === 'string' && raw.id ? raw.id : utils.uid(),
      title,
      duration: validDuration ? raw.duration : T.DEFAULTS.duration,
      energy: T.ENERGY_KEYS.includes(raw.energy) ? raw.energy : T.DEFAULTS.energy,
      date: utils.isISODate(raw.date) ? raw.date : null,
      done,
      createdAt,
      completedAt: done ? (Number.isFinite(raw.completedAt) ? raw.completedAt : createdAt) : null
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
    parse,
    serialize,
    load,
    save,
    requestPersistence
  };
})(window.Aura = window.Aura || {});
