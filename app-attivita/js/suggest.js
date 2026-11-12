/*
 * Aura Tasks — «Cosa faccio adesso?»: logica pura.
 * suggest() sceglie, tra le attività da fare adesso, quella che conviene col tempo e l'energia che hai,
 * e dice il perché in italiano. Scelte e pesi stanno in SUGGEST (vedi docs/tre-modalita.md).
 * Niente DOM, niente localStorage; il caso è un parametro (random), così i test sono ripetibili.
 */
(function (Aura) {
  'use strict';

  const { utils, tasks: T } = Aura;

  const SUGGEST = {
    minutes: [10, 15, 30, 45, 60, 90, null], // scelte di «Quanto tempo hai?», in ordine; null = «120+», senza limite
    openEnded: 120,                          // «120+» conta come 120 minuti nello sfruttamento del tempo
    defaults: { minutes: 30, energy: 'medium' },
    alternatives: 2,                         // proposte in più, sotto la migliore
    soonMinutes: 15,                         // un'attività di oggi con l'orario si propone solo da 15 minuti prima
    weights: {
      overdue: 50,       // in ritardo…
      overduePerDay: 5,  // …più 5 per ogni giorno di ritardo…
      overdueMax: 30,    // …fino a +30
      today: 30,
      someday: 10,       // senza data
      timeUse: 20,       // × durata / minuti a disposizione
      energyMatch: 10,   // energia uguale a quella che hai
      ageEveryDays: 2,   // +1 ogni 2 giorni dalla creazione…
      ageMax: 10,        // …fino a +10
      random: 5          // ± un pizzico di caso, per variare
    }
  };

  const minuteOfDay = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

  /**
   * Da fare adesso: non completata, senza data oppure di oggi o in ritardo.
   * Se è di oggi e ha l'orario, solo quando l'ora è passata o manca poco (SUGGEST.soonMinutes):
   * di mattina «Dentista» delle 16:30 non si propone. `now` è un istante in millisecondi.
   */
  function isNow(task, today, now) {
    if (task.done || (task.date && task.date > today)) return false;
    if (task.date !== today || !task.time) return true;
    const moment = new Date(now);
    return minuteOfDay(task.time) - (moment.getHours() * 60 + moment.getMinutes()) <= SUGGEST.soonMinutes;
  }
  const fitsTime = (task, minutes) => minutes === null || task.duration <= minutes;
  const fitsEnergy = (task, energy) => T.ENERGY[task.energy].order <= T.ENERGY[energy].order;
  const ageDays = (task, today) => Math.max(0, utils.daysBetween(utils.todayISO(task.createdAt), today));

  /** Punteggio: urgenza, sfruttamento del tempo, energia, anzianità e un pizzico di caso. */
  function score(task, { minutes, energy, today, random }) {
    const w = SUGGEST.weights;
    let urgency = w.someday;
    if (task.date && task.date < today) {
      urgency = w.overdue + Math.min(w.overdueMax, w.overduePerDay * utils.daysBetween(task.date, today));
    } else if (task.date === today) {
      urgency = w.today;
    }
    const cap = minutes === null ? SUGGEST.openEnded : minutes;
    const timeUse = w.timeUse * Math.min(task.duration, cap) / cap;
    const energyMatch = task.energy === energy ? w.energyMatch : 0;
    const age = Math.min(w.ageMax, Math.floor(ageDays(task, today) / w.ageEveryDays));
    const chance = (random() - 0.5) * 2 * w.random;
    return urgency + timeUse + energyMatch + age + chance;
  }

  /** 1 → "1 minuto", 30 → "30 minuti", 90 → "1 h 30 min". */
  function minutesLabel(minutes) {
    if (minutes === 1) return '1 minuto';
    return minutes < 60 ? minutes + ' minuti' : utils.formatDuration(minutes);
  }

  /** Il tempo che hai, detto bene: "nei tuoi 30 minuti", "nella tua ora e mezza" (inside) oppure "i tuoi 30 minuti", "la tua ora". */
  function yourTime(minutes, inside) {
    if (minutes === 60) return inside ? 'nella tua ora' : 'la tua ora';
    if (minutes === 90) return inside ? 'nella tua ora e mezza' : 'la tua ora e mezza';
    return (inside ? 'nei tuoi ' : 'i tuoi ') + minutesLabel(minutes);
  }

  /** Il motivo della proposta: "È in ritardo da 2 giorni e ci sta nei tuoi 30 minuti". */
  function reasonFor(task, { minutes, today }) {
    let why;
    if (task.date && task.date < today) {
      const late = utils.daysBetween(task.date, today);
      why = late === 1 ? 'È in ritardo da ieri' : 'È in ritardo da ' + late + ' giorni';
    } else if (task.date === today) {
      why = task.time ? 'È per oggi alle ' + task.time : 'È per oggi';
    } else {
      const age = ageDays(task, today);
      why = age >= 7 ? 'Aspetta da ' + age + ' giorni' : 'Non ha una data';
    }
    let fit;
    if (minutes === null) fit = 'dura ' + minutesLabel(task.duration);
    else if (task.duration === minutes) fit = 'occupa giusto ' + yourTime(minutes, false);
    else fit = 'ci sta ' + yourTime(minutes, true);
    return why + ' e ' + fit;
  }

  const byScore = (a, b) => b.score - a.score || a.task.createdAt - b.task.createdAt || (a.task.id < b.task.id ? -1 : a.task.id > b.task.id ? 1 : 0);
  const shortest = list => list.slice().sort((a, b) => a.duration - b.duration || a.createdAt - b.createdAt)[0] || null;

  /** Quando non c'è niente da proporre: perché, e che cosa suggerire al posto della proposta. */
  function fallbackFor(open, fitting, energy) {
    if (fitting.length) return { kind: 'exhausted' }; // c'erano, ma sono già state proposte tutte
    const energyOk = open.filter(task => fitsEnergy(task, energy));
    if (energyOk.length) {
      const task = shortest(energyOk);
      return { kind: 'more-time', task, minutes: SUGGEST.minutes.find(choice => choice === null || choice >= task.duration) };
    }
    return { kind: 'rest', task: shortest(open) };
  }

  /**
   * La proposta per adesso. Opzioni:
   * - minutes: una delle scelte di SUGGEST.minutes (null = «120+»);
   * - energy: 'low' | 'medium' | 'high';
   * - today: 'YYYY-MM-DD';
   * - now: l'istante attuale in millisecondi (per gli orari di oggi; di solito Date.now());
   * - exclude: id già proposti in questa sessione;
   * - random: funzione come Math.random (nei test, () => 0.5 toglie il caso).
   * Restituisce { best, alternatives, fallback }: best e alternatives sono { task, score, reason }.
   * Se non c'è niente da proporre, best è null e fallback è uno di questi:
   * - { kind: 'exhausted' }: le adatte sono già state proposte tutte;
   * - { kind: 'more-time', task, minutes }: con più tempo ci sarebbe `task`; `minutes` è la scelta che basta;
   * - { kind: 'rest', task }: con questa energia non c'è niente; `task` è la più breve da fare adesso, oppure null.
   */
  function suggest(tasks, { minutes = SUGGEST.defaults.minutes, energy = SUGGEST.defaults.energy, today, now = Date.now(), exclude = [], random = Math.random }) {
    const options = { minutes, energy, today, random };
    const excluded = new Set(exclude);
    const open = tasks.filter(task => isNow(task, today, now));
    const fitting = open.filter(task => fitsTime(task, minutes) && fitsEnergy(task, energy));
    const ranked = fitting
      .filter(task => !excluded.has(task.id))
      .map(task => ({ task, score: score(task, options) }))
      .sort(byScore)
      .map(item => ({ ...item, reason: reasonFor(item.task, options) }));
    if (ranked.length) return { best: ranked[0], alternatives: ranked.slice(1, 1 + SUGGEST.alternatives), fallback: null };
    return { best: null, alternatives: [], fallback: fallbackFor(open, fitting, energy) };
  }

  /** Quante attività si possono fare adesso (per mostrare o nascondere il pulsante). */
  function countNow(tasks, today, now = Date.now()) {
    return tasks.filter(task => isNow(task, today, now)).length;
  }

  Aura.suggest = { SUGGEST, suggest, score, reasonFor, minutesLabel, countNow };
})(window.Aura = window.Aura || {});
