/*
 * Aura Tasks — «Sfide di oggi» (P-003, passo 3.5): logica pura.
 * Ogni giorno, alla prima apertura, tre sfide prese dai dati: quante attività completare, i minuti di focus e
 * l'attività da fare più vecchia (oppure una sfida di tempo). Stanno nel registro, stats.challenges (schema v8):
 * { 'AAAA-MM-GG': { at, items: [{ kind, target, taskId?, done?, by? }] } }. I punti (10 per sfida, 20 in più con tutte
 * e tre; regole in Aura.points.POINTS) entrano in totalPoints quando una sfida diventa fatta ed escono quando torna da fare.
 * Specifica in docs/punti-e-serie.md, «Sfide di oggi». Niente DOM, niente localStorage: `now` è sempre un parametro.
 */
(function (Aura) {
  'use strict';

  const { utils, points: P } = Aura;

  const HOUR_MS = 60 * 60 * 1000;

  const CHALLENGES = {
    keepDays: 30,                                  // giorni di sfide conservati, i più recenti; i più vecchi finché si
                                                   // possono ancora disfare (vedi stillOpen)
    count: { lookback: 7, min: 2, max: 6, fallback: 2 },
    focus: { first: 10, regular: 25 },             // minuti: 10 finché il registro non ha minuti di focus
    oldest: { minAgeDays: 3 },                     // un'attività da fare creata almeno 3 giorni fa
    before: { hours: [12, 18, 22], marginMs: 2 * HOUR_MS } // la prima ora che arriva almeno 2 ore dopo
  };

  const THIRD = ['oldest', 'before', 'any'];

  /* ---------- Come nascono ---------- */

  /**
   * N di «Completa N attività»: la media dei completamenti nei giorni attivi (almeno un completamento) dei 7 giorni prima
   * di oggi, arrotondata (2,5 → 3) e portata tra 2 e 6. Senza giorni attivi, 2.
   */
  function countTarget(stats, today) {
    const rule = CHALLENGES.count;
    const active = [];
    for (let back = 1; back <= rule.lookback; back++) {
      const done = P.dayTotals(stats, utils.addDays(today, -back)).done;
      if (done > 0) active.push(done);
    }
    if (!active.length) return rule.fallback;
    const average = active.reduce((sum, done) => sum + done, 0) / active.length;
    return Math.min(rule.max, Math.max(rule.min, Math.round(average)));
  }

  /** Minuti della sfida del focus: 25, oppure 10 se nel registro non c'è ancora nessun minuto di focus. */
  function focusTarget(stats) {
    const focus = stats.focus && typeof stats.focus === 'object' ? stats.focus : {};
    const any = Object.keys(focus).some(day => focus[day] > 0);
    return any ? CHALLENGES.focus.regular : CHALLENGES.focus.first;
  }

  /**
   * L'attività da fare creata da più tempo (a pari età, l'id che viene prima), se è stata creata almeno 3 giorni fa.
   * Non conta un'attività fissata in un giorno futuro: non è da fare adesso. null se non ce n'è una.
   */
  function oldestTask(tasks, today) {
    const old = tasks.filter(task => !task.done && Number.isFinite(task.createdAt) && (!task.date || task.date <= today) &&
      utils.daysBetween(utils.todayISO(task.createdAt), today) >= CHALLENGES.oldest.minAgeDays);
    old.sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return old[0] || null;
  }

  /** L'istante di `day` alle `hour`:00, ora locale. */
  function hourOn(day, hour) {
    const date = utils.parseISODate(day);
    date.setHours(hour, 0, 0, 0);
    return date.getTime();
  }

  /** L'ora di «entro le H»: la prima tra le 12, le 18 e le 22 che arriva almeno 2 ore dopo `now`; null se nessuna. */
  function beforeHour(now) {
    const today = utils.todayISO(now);
    return CHALLENGES.before.hours.find(hour => hourOn(today, hour) - now >= CHALLENGES.before.marginMs) || null;
  }

  /** Le tre sfide di oggi, nate adesso: { at, items }. */
  function create(stats, tasks, now) {
    const today = utils.todayISO(now);
    const items = [{ kind: 'count', target: countTarget(stats, today) }, { kind: 'focus', target: focusTarget(stats) }];
    const old = oldestTask(tasks, today);
    const hour = old ? null : beforeHour(now);
    if (old) items.push({ kind: 'oldest', target: 1, taskId: old.id });
    else if (hour) items.push({ kind: 'before', target: hour });
    else items.push({ kind: 'any', target: 1 });
    return { at: now, items };
  }

  /* ---------- Quando una sfida è fatta ---------- */

  const doneOn = (stats, day) => P.dayTotals(stats, day).done;
  const minutesOn = (stats, day) => (stats.focus && Number.isFinite(stats.focus[day]) ? stats.focus[day] : 0);
  const completedOn = (task, day) => task.done && Number.isFinite(task.completedAt) && utils.todayISO(task.completedAt) === day;

  /**
   * Le attività completate, per giorno di completamento, ognuna in ordine di completamento: Map 'AAAA-MM-GG' → [attività].
   * Si fa una volta per refresh(), così una sfida di un giorno non scorre tutte le attività (con migliaia di completate
   * e molti giorni il conto diventava di decine di millisecondi a tocco).
   */
  function completedByDay(tasks) {
    const index = new Map();
    tasks.forEach(task => {
      if (!task.done || !Number.isFinite(task.completedAt)) return;
      const day = utils.todayISO(task.completedAt);
      if (!index.has(day)) index.set(day, []);
      index.get(day).push(task);
    });
    index.forEach(list => list.sort((a, b) => a.completedAt - b.completedAt));
    return index;
  }

  /**
   * Se la sfida `item` del giorno `day` vale con i dati di adesso: { ok, by }. `by` è, per `before`, l'attività
   * completata prima dell'ora (la prima). Eliminare non disfa una sfida fatta: se l'attività che l'ha fatta non c'è
   * più, vale ancora. `index` è completedByDay(tasks).
   */
  function proof(item, day, stats, index, byId) {
    switch (item.kind) {
      case 'count': return { ok: doneOn(stats, day) >= item.target };
      case 'any': return { ok: doneOn(stats, day) >= 1 };
      case 'focus': return { ok: minutesOn(stats, day) >= item.target };
      case 'oldest': {
        const task = byId.get(item.taskId);
        return { ok: task ? completedOn(task, day) : Boolean(item.done) };
      }
      case 'before': {
        const limit = hourOn(day, item.target);
        const first = (index.get(day) || []).find(task => task.completedAt < limit);
        if (first) return { ok: true, by: first.id };
        return { ok: Boolean(item.done && item.by && !byId.has(item.by)), by: item.by };
      }
      default: return { ok: false };
    }
  }

  /** La sfida senza `done` e `by`: torna da fare. */
  function undone(item) {
    const { done, by, ...rest } = item;
    return rest;
  }

  /**
   * La sfida rivalutata. Oggi può diventare fatta (con l'istante `now`) o tornare da fare; un altro giorno può solo
   * tornare da fare: dopo la mezzanotte una sfida non fatta resta così. Se non cambia niente, restituisce `item`.
   */
  function evaluate(item, day, isToday, stats, index, byId, now) {
    if (!item.done && !isToday) return item;
    const check = proof(item, day, stats, index, byId);
    if (item.done) {
      if (!check.ok) return undone(item);
      return item.kind === 'before' && check.by !== item.by ? { ...item, by: check.by } : item;
    }
    if (!check.ok) return item;
    return item.kind === 'before' ? { ...item, done: now, by: check.by } : { ...item, done: now };
  }

  /**
   * Un giorno passato da tenere anche oltre i 30 più recenti: ha una sfida fatta che si può ancora disfare, perché
   * un'attività completata quel giorno è ancora nell'elenco. Togliendole la spunta, anche dopo mesi, la sfida torna da
   * fare e i suoi punti escono dal totale, come per un giorno recente. Il focus no: i minuti di un giorno passato non si
   * tolgono più. `index` è completedByDay(tasks).
   */
  function stillOpen(entry, day, index) {
    return index.has(day) && entry.items.some(item => item.done && item.kind !== 'focus');
  }

  /**
   * I giorni da tenere quando nascono le sfide di oggi: oggi, i 30 più recenti e, prima, tutti quelli che si possono
   * ancora disfare (stillOpen). Nessun tetto: un giorno vecchio resta solo con un'attività completata quel giorno ancora
   * nell'elenco, quindi i giorni non sono mai più dell'elenco. Un giorno tolto non ha più niente da disfare: i suoi
   * punti restano in totalPoints.
   */
  function keptDays(challenges, today, index) {
    return Object.keys(challenges).concat(today).sort().reverse()
      .filter((day, i) => day === today || i < CHALLENGES.keepDays || stillOpen(challenges[day], day, index));
  }

  // L'ultimo registro già al passo, con le sue attività e il suo giorno: con gli stessi dati refresh() non cambierebbe
  // niente (l'ora conta solo per le sfide che diventano fatte), e app.js lo chiede due volte a ogni tocco: prima per
  // l'avviso, poi in commitState(). I dati non si modificano mai sul posto, quindi bastano gli oggetti.
  let settled = null;

  /**
   * Dopo ogni modifica dei dati, all'apertura e a un giorno nuovo: fa nascere le sfide di oggi se mancano (e tiene i
   * giorni di keptDays), rivaluta quelle di tutti i giorni e sposta i punti in totalPoints.
   * Restituisce { stats, gained, all, points }: `gained` sono le sfide di oggi fatte adesso, `all` è true se adesso sono
   * fatte tutte e tre, `points` i punti aggiunti (o tolti, se negativi). Se non cambia niente, `stats` è lo stesso oggetto.
   */
  function refresh(stats, tasks, now) {
    const today = utils.todayISO(now);
    if (settled && settled.stats === stats && settled.tasks === tasks && settled.today === today) {
      return { stats, gained: [], all: false, points: 0 };
    }
    const index = completedByDay(tasks);
    let challenges = stats.challenges && typeof stats.challenges === 'object' ? stats.challenges : {};
    let changed = false;
    if (!challenges[today]) {
      const next = {};
      keptDays(challenges, today, index).forEach(day => { next[day] = day === today ? create(stats, tasks, now) : challenges[day]; });
      challenges = next;
      changed = true;
    }
    const byId = new Map(tasks.map(task => [task.id, task]));
    const next = {};
    let points = 0;
    const gained = [];
    Object.keys(challenges).forEach(day => {
      const entry = challenges[day];
      const items = entry.items.map(item => evaluate(item, day, day === today, stats, index, byId, now));
      if (items.every((item, i) => item === entry.items[i])) {
        next[day] = entry;
        return;
      }
      next[day] = { ...entry, items };
      changed = true;
      points += P.challengePoints(next[day]) - P.challengePoints(entry);
      if (day === today) items.forEach((item, i) => { if (item.done && !entry.items[i].done) gained.push(item); });
    });
    if (!changed) {
      settled = { stats, tasks, today };
      return { stats, gained, all: false, points: 0 };
    }
    const all = gained.length > 0 && next[today].items.every(item => item.done);
    const result = {
      stats: { ...stats, challenges: next, totalPoints: Math.max(0, stats.totalPoints + points) },
      gained,
      all,
      points
    };
    settled = { stats: result.stats, tasks, today };
    return result;
  }

  /* ---------- Pulizia dei dati letti ---------- */

  const isInstant = value => Number.isFinite(value) && value > 0;

  /** Una sfida letta, ripulita; null se non è valida. `position` è il suo posto (0, 1, 2): l'ordine è fisso. */
  function sanitizeItem(raw, position) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const { kind, target } = raw;
    const kindOk = position === 0 ? kind === 'count' : position === 1 ? kind === 'focus' : THIRD.includes(kind);
    if (!kindOk || !Number.isInteger(target)) return null;
    const rule = CHALLENGES[kind];
    if (kind === 'count' && (target < rule.min || target > rule.max)) return null;
    if (kind === 'focus' && target !== rule.first && target !== rule.regular) return null;
    if (kind === 'before' && !rule.hours.includes(target)) return null;
    if ((kind === 'oldest' || kind === 'any') && target !== 1) return null;
    if (kind === 'oldest' && (typeof raw.taskId !== 'string' || !raw.taskId)) return null;
    const item = { ...raw };
    if (kind !== 'oldest') delete item.taskId;
    if (!isInstant(item.done)) delete item.done;
    if (kind !== 'before' || !item.done || typeof item.by !== 'string' || !item.by) delete item.by;
    return item;
  }

  /**
   * stats.challenges letto (dall'archivio o da un backup) → valido. Tiene un giorno solo se la data è valida, `at` è un
   * istante e le tre sfide sono valide e in ordine; quali giorni tenere oltre i 30 più recenti lo decide refresh(), che
   * conosce le attività. Un `done` o un `by` non validi si tolgono. I campi sconosciuti restano.
   */
  function sanitize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const days = Object.keys(raw).filter(day => utils.isISODate(day)).sort().reverse();
    const clean = {};
    days.forEach(day => {
      const entry = raw[day];
      if (!entry || typeof entry !== 'object' || !isInstant(entry.at) || !Array.isArray(entry.items) || entry.items.length !== 3) return;
      const items = entry.items.map(sanitizeItem);
      if (items.every(Boolean)) clean[day] = { ...entry, items };
    });
    return clean;
  }

  /* ---------- Come si vedono ---------- */

  /** «Fatto alle 10:40». */
  const doneText = item => 'Fatto alle ' + utils.formatTime(new Date(item.done));

  /**
   * Una sfida per la card: { kind, title, note, progress (da 0 a 1), done, points }. `task` è l'attività di `oldest`
   * (undefined se non c'è più).
   */
  function describe(item, day, stats, tasks, now) {
    const done = Boolean(item.done);
    const row = { kind: item.kind, done, points: P.POINTS.challenge };
    switch (item.kind) {
      case 'count': {
        const count = doneOn(stats, day);
        return { ...row, title: 'Completa ' + item.target + ' attività', note: done ? doneText(item) : Math.min(count, item.target) + ' su ' + item.target, progress: done ? 1 : Math.min(1, count / item.target) };
      }
      case 'focus': {
        const minutes = minutesOn(stats, day);
        return { ...row, title: 'Fai ' + item.target + ' minuti di focus', note: done ? doneText(item) : Math.min(minutes, item.target) + ' su ' + item.target + ' min', progress: done ? 1 : Math.min(1, minutes / item.target) };
      }
      case 'oldest': {
        const task = tasks.find(t => t.id === item.taskId);
        if (!task) return { ...row, title: "Chiudi l'attività più vecchia", note: done ? doneText(item) : "Non c'è più", progress: done ? 1 : 0 };
        const age = Math.max(0, utils.daysBetween(utils.todayISO(task.createdAt), day));
        return { ...row, title: 'Chiudi «' + task.title + '»', note: done ? doneText(item) : 'Aspetta da ' + age + ' giorni', progress: done ? 1 : 0 };
      }
      case 'before': {
        const open = now < hourOn(day, item.target);
        return { ...row, title: "Completa un'attività entro le " + item.target, note: done ? doneText(item) : (open ? 'Hai tempo fino alle ' : 'Entro le ') + item.target, progress: done ? 1 : 0 };
      }
      default:
        return { ...row, title: "Completa un'attività", note: done ? doneText(item) : 'Una qualsiasi, entro stasera', progress: done ? 1 : 0 };
    }
  }

  /**
   * Le sfide di oggi per la card: { rows, done, total, points, all }, oppure null se oggi non ci sono ancora (nascono alla
   * prima apertura).
   */
  function forToday(stats, tasks, now) {
    const day = utils.todayISO(now);
    const entry = stats.challenges && stats.challenges[day];
    if (!entry) return null;
    const rows = entry.items.map(item => describe(item, day, stats, tasks, now));
    const done = rows.filter(row => row.done).length;
    return { rows, done, total: rows.length, points: P.challengePoints(entry), all: done === rows.length };
  }

  /** Il pezzo dell'avviso per le sfide fatte adesso (`result` di refresh), oppure '' se non ce ne sono. */
  function gainedText(result) {
    if (!result || !result.gained.length) return '';
    if (result.all) return '🏆 Tutte e tre le sfide!';
    return result.gained.length === 1 ? '🎯 Sfida fatta' : '🎯 ' + result.gained.length + ' sfide fatte';
  }

  Aura.challenges = {
    CHALLENGES,
    countTarget,
    focusTarget,
    oldestTask,
    beforeHour,
    create,
    refresh,
    sanitize,
    describe,
    forToday,
    gainedText
  };
})(window.Aura = window.Aura || {});
