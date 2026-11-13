/*
 * Aura Tasks — assistente con l'IA: logica pura (specifica in docs/assistente.md).
 * Prepara ciò che si manda al server (attività con sigle, memoria breve), ricontrolla la risposta con le regole del
 * modulo, decide che cosa è automatico e che cosa chiede secondo i permessi, applica, registra nell'elenco e annulla.
 * Niente DOM, niente localStorage, niente rete: l'ora è sempre un parametro, così i test sono ripetibili.
 * Regola fissa: completare ed eliminare non sono mai automatici, con nessun permesso.
 */
(function (Aura) {
  'use strict';

  const { utils, tasks: T, nlp, suggest: SG } = Aura;

  const ASSISTANT = {
    messageMax: 500,
    tasksMax: 40,
    titleMax: 120,
    horizonDays: 7,      // oltre a in ritardo, oggi e senza data: i prossimi 7 giorni
    memory: { max: 3, ttlMs: 10 * 60 * 1000, said: 500, reply: 200 },
    autoMax: 3,          // più di 3 azioni automatiche nello stesso messaggio: diventano tutte domande
    open: { reuseMs: 3 * 60 * 60 * 1000, perDay: 8, waitMs: 4000, returnMs: 30 * 60 * 1000 },
    log: { max: 50, keepMs: 30 * utils.DAY_MS },
    // Permessi e interruttori, all'inizio (aura-tasks:prefs.assistant). Senza consenso (consentAt) non parte niente.
    defaults: { enabled: false, voice: true, autoAdd: true, autoEdit: false, consentAt: null }
  };

  // Scelte di «Quanto tempo hai?» con un numero (senza «120+»): i minuti detti si salvano sulla più vicina per difetto.
  const CHIPS = SG.SUGGEST.minutes.filter(minutes => minutes !== null);
  const ORIGINS = ['text', 'voice', 'siri'];
  const LOG_TYPES = ['add', 'update', 'correct'];
  const DID_TYPES = ['add', 'update', 'suggest', 'ask'];
  const CHANGE_TYPES = ['add', 'update', 'complete', 'delete']; // le azioni che cambiano qualcosa (non le proposte)

  const TEXTS = {
    failed: 'Non ci sono riuscita: prova a dirlo in un altro modo.',
    nothingFits: 'Con questo tempo e questa energia non trovo niente di adatto.'
  };

  /* ---------- Piccoli aiuti ---------- */

  const clean = value => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  const cut = (text, max) => (text.length <= max ? text : text.slice(0, max - 1).trimEnd() + '…');
  /** Titoli confrontati senza maiuscole, accenti e spazi doppi: «Caffè» e «caffe» sono lo stesso titolo. */
  const fold = text => clean(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const momentOf = ms => ({ date: utils.todayISO(ms), time: utils.formatTime(new Date(ms)) });

  function sameFields(a, b) {
    return Boolean(a && b) && T.EDITABLE_FIELDS.every(field => (a[field] == null ? null : a[field]) === (b[field] == null ? null : b[field]));
  }

  /** Fascia della giornata, come il saluto: mattina (5–12), pomeriggio (12–18), sera. */
  function partOfDay(ms) {
    const hour = new Date(ms).getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    return 'evening';
  }

  /** Solo l'ora, senza giorno: oggi, oppure domani se a quell'ora siamo già passati (come l'aggiunta rapida). */
  function dayForTime(time, at) {
    const today = utils.todayISO(at);
    return time > utils.formatTime(new Date(at)) ? today : utils.addDays(today, 1);
  }

  /** Impronta breve di un testo (djb2), per riconoscere la stessa lista senza salvarla. */
  function hash(text) {
    let value = 5381;
    for (let i = 0; i < text.length; i++) value = ((value << 5) + value + text.charCodeAt(i)) | 0;
    return (value >>> 0).toString(36);
  }

  /* ---------- Memoria breve ---------- */

  /** Gli scambi degli ultimi 10 minuti, al massimo 3, dal più vecchio. */
  function recentExchanges(memory, now) {
    const { max, ttlMs } = ASSISTANT.memory;
    return (Array.isArray(memory) ? memory : []).filter(item => item && now - item.at <= ttlMs && item.at <= now + 60000).slice(-max);
  }

  /** Aggiunge uno scambio: { said, reply, did: [{ type, taskId, after? }] }. Restituisce la memoria nuova. */
  function addExchange(memory, exchange, now) {
    const { max, said, reply } = ASSISTANT.memory;
    const item = {
      at: now,
      said: cut(clean(exchange.said), said),
      reply: cut(clean(exchange.reply), reply),
      did: (exchange.did || []).filter(entry => entry && DID_TYPES.includes(entry.type) && typeof entry.taskId === 'string')
    };
    return recentExchanges(memory, now).concat([item]).slice(-max);
  }

  /* ---------- Ciò che si manda ---------- */

  /** Le attività da mandare: in ritardo, oggi, senza data e prossimi 7 giorni, in quest'ordine; al massimo 40. */
  function selectTasks(tasks, today) {
    const limit = utils.addDays(today, ASSISTANT.horizonDays);
    const rank = task => (!task.date ? 2 : task.date < today ? 0 : task.date === today ? 1 : 3);
    return tasks
      .filter(task => !task.done && (!task.date || task.date <= limit))
      .sort((a, b) => rank(a) - rank(b) ||
        (a.date || '').localeCompare(b.date || '') ||
        (a.time ? 0 : 1) - (b.time ? 0 : 1) || (a.time || '').localeCompare(b.time || '') ||
        a.createdAt - b.createdAt)
      .slice(0, ASSISTANT.tasksMax);
  }

  /**
   * La richiesta per POST /api/assistant/chat. Opzioni:
   * - kind: 'message', 'open' (proposta all'apertura) oppure 'siri';
   * - message: il testo dell'utente (vuoto per 'open');
   * - now: l'istante attuale; at: il momento a cui riferire giorno e ora (per Siri, la dettatura). Di base at = now;
   * - context: l'ultima scelta di tempo ed energia { minutes, energy };
   * - memory: la memoria breve.
   * Restituisce { payload, refs }: `refs` traduce le sigle (t1, t2…) negli id delle attività. Gli id non partono mai.
   */
  function buildRequest(tasks, { kind = 'message', message = '', now, at = now, context = {}, memory = [] }) {
    const list = selectTasks(tasks, utils.todayISO(at));
    const refs = {};
    const refOf = {};
    const payloadTasks = list.map((task, index) => {
      const ref = 't' + (index + 1);
      refs[ref] = task.id;
      refOf[task.id] = ref;
      const date = task.date || null;
      return { ref, title: cut(clean(task.title), ASSISTANT.titleMax), duration: task.duration, energy: task.energy, date, time: date && task.time ? task.time : null };
    });
    const recent = recentExchanges(memory, now).map(item => ({
      said: item.said,
      reply: item.reply,
      did: item.did.filter(entry => refOf[entry.taskId]).map(entry => entry.type + ' ' + refOf[entry.taskId])
    }));
    const payload = {
      kind,
      message: kind === 'open' ? '' : cut(clean(message), ASSISTANT.messageMax),
      now: momentOf(at),
      context: { minutes: context.minutes == null ? null : context.minutes, energy: context.energy || null },
      tasks: payloadTasks,
      recent
    };
    return { payload, refs };
  }

  /* ---------- Tempo ed energia detti ---------- */

  /** La scelta di «Quanto tempo hai?» da salvare per dei minuti detti: la più vicina per difetto; da 120 in su «120+». */
  function chipFor(minutes) {
    if (minutes >= 120) return null;
    const below = CHIPS.filter(chip => chip <= minutes);
    return below.length ? below[below.length - 1] : CHIPS[0];
  }

  /**
   * Tempo ed energia detti nel messaggio (`context` della risposta), rispetto alla scelta attuale.
   * Restituisce null se non ha detto niente, altrimenti { use, save }: `use` vale per la proposta di adesso
   * (i minuti così come sono stati detti), `save` va nelle preferenze (la scelta più vicina per difetto).
   */
  function contextOf(said, choice) {
    if (!said || (!said.minutes && !said.energy)) return null;
    const use = { minutes: said.minutes || choice.minutes, energy: said.energy || choice.energy };
    const save = { minutes: said.minutes ? chipFor(said.minutes) : choice.minutes, energy: use.energy };
    if (save.minutes !== null && !CHIPS.includes(save.minutes)) save.minutes = chipFor(save.minutes);
    return { use, save };
  }

  /* ---------- La risposta: che cosa è automatico e che cosa chiede ---------- */

  /**
   * Ricontrolla la risposta del server e decide. Opzioni:
   * - tasks, refs (da buildRequest), perms { autoAdd, autoEdit };
   * - now: adesso; at: il momento della frase (per Siri, la dettatura; «domani» si conta da lì);
   * - message: il testo dell'utente, letto anche con le regole di js/nlp.js;
   * - memory: la memoria breve (per le correzioni); choice: la scelta attuale di tempo ed energia.
   * Restituisce { auto, ask, proposal, context, say, modelSay }:
   * - auto e ask: le azioni, già validate. Ognuna ha `kind` (add, update, complete, delete) e, se diventa domanda per
   *   un freno, `brake` ('words', 'past', 'duplicate', 'many');
   * - proposal: { taskId, reason } solo se l'attività è tra tutte le candidate delle regole (Aura.suggest.candidates);
   * - say: la frase del modello quando vale (proposte, nessuna azione), oppure una frase dell'app; null se le frasi
   *   le scrive l'app dalle azioni (describeDone, askText).
   */
  function planReply(reply, { tasks, refs, perms, now, at = now, message = '', memory = [], choice }) {
    const today = utils.todayISO(now);
    const spokenDay = utils.todayISO(at);
    const actions = Array.isArray(reply && reply.actions) ? reply.actions : [];
    const context = contextOf(reply && reply.context, choice);
    const use = context ? context.use : choice;
    const edits = actions.filter(action => action && (action.type === 'add' || action.type === 'update')).length;
    // Giorno e ora letti dalle regole: valgono solo con una sola aggiunta o modifica (la frase non dice a quale va un'ora).
    const words = message && edits === 1 ? nlp.parseDetails(message, new Date(at)) : null;
    const recent = recentExchanges(memory, now);
    const openTask = id => tasks.find(task => task.id === id && !task.done) || null;
    // Una sola modifica e nient'altro: può essere una correzione senza nome («no, facciamo alle 5»), che va
    // all'attività dell'ultimo scambio anche se il modello ne ha indicata un'altra.
    const changes = actions.filter(action => action && CHANGE_TYPES.includes(action.type));
    const lone = changes.length === 1 && changes[0].type === 'update' ? changes[0] : null;
    const redirect = lone ? correctionTarget(lone, { tasks, refs, recent, message, at }) : null;
    const entries = [];
    let invalid = 0;
    let unchanged = null; // la prima modifica che non cambia niente (l'attività è già così)
    let proposal = null;
    let suggested = false;

    actions.forEach(action => {
      if (!action || typeof action !== 'object') return;
      if (action.type === 'suggest') {
        suggested = true;
        const id = refs[action.task];
        const fits = id && SG.candidates(tasks, { minutes: use.minutes, energy: use.energy, today, now }).some(task => task.id === id);
        // Il motivo del modello arriva spesso con la minuscola («è breve»): nel foglio comincia la riga.
        if (fits && !proposal) proposal = { taskId: id, reason: utils.capitalize(clean(action.reason)) || null };
        return;
      }
      let entry = null;
      if (action.type === 'add') entry = planAdd(action, { tasks, entries, words, today, spokenDay, at });
      else if (action.type === 'update') entry = planUpdate(action, { refs, openTask, words, today, spokenDay, at, recent, target: action === lone ? redirect : null });
      else if (action.type === 'complete' || action.type === 'delete') {
        const task = openTask(refs[action.task]);
        entry = task ? { kind: action.type, taskId: task.id, title: task.title } : null;
      }
      if (entry && entry.same) { // una modifica che non cambia niente
        unchanged = unchanged || entry;
        return;
      }
      if (entry) entries.push(entry);
      else invalid++;
    });

    entries.forEach(entry => { entry.auto = isAutomatic(entry, perms); });
    if (entries.filter(entry => entry.auto).length > ASSISTANT.autoMax) {
      entries.forEach(entry => {
        if (!entry.auto) return;
        entry.auto = false;
        entry.brake = 'many';
      });
    }
    const auto = entries.filter(entry => entry.auto);
    const ask = entries.filter(entry => !entry.auto);

    let say = null;
    let modelSay = false;
    if (!auto.length && !ask.length) {
      const dropped = (Number(reply && reply.dropped) || 0) + invalid;
      if (suggested && !proposal) {
        // Il modello ha proposto un'attività che le regole non ammettono: vale la proposta delle regole.
        const best = SG.suggest(tasks, { minutes: use.minutes, energy: use.energy, today, now, random: () => 0.5 }).best;
        proposal = best ? { taskId: best.task.id, reason: null } : null;
        say = best ? 'Ti propongo «' + best.task.title + '».' : TEXTS.nothingFits;
      } else if (dropped > 0 && !proposal) {
        say = TEXTS.failed;
      } else if (unchanged && !proposal) {
        // Il modello direbbe «Ho spostato…», magari con un'ora letta a modo suo: ma non c'era niente da cambiare.
        say = '«' + unchanged.title + '» è già così.';
      } else {
        say = clean(reply && reply.say);
        modelSay = true;
      }
    }
    return { auto, ask, proposal, context, say, modelSay };
  }

  /**
   * L'ora da proporre quando il modello e le regole di js/nlp.js ne leggono una diversa: quella delle regole, come nel
   * foglio «Nuova attività» («alle 6»: il modello scrive 06:00, le regole 18:00, e la domanda dice 18:00).
   * I minuti che le regole non sanno leggere («alle 5 e mezza», «alle 5 meno un quarto») restano quelli del modello:
   * se la sua ora, portata nella stessa metà del giorno di quella delle regole, le sta a meno di un'ora, vale quella
   * (17:30 e non 17:00). Più lontana di così è un'altra ora, e vale quella delle regole.
   */
  function agreedTime(modelTime, ruleTime) {
    const minutesOf = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    const rule = minutesOf(ruleTime);
    let model = minutesOf(modelTime);
    const gap = () => Math.min(Math.abs(model - rule), 1440 - Math.abs(model - rule));
    if (gap() > 360) model = (model + 720) % 1440; // era nell'altra metà del giorno
    return gap() < 60 ? two(Math.floor(model / 60)) + ':' + two(model % 60) : ruleTime;
  }

  /** Un'aggiunta: giorno e ora con la regola dell'aggiunta rapida, poi la validazione del modulo e i freni. */
  function planAdd(action, { tasks, entries, words, today, spokenDay, at }) {
    let date = action.date || null;
    let time = action.time || null;
    let brake = null;
    if (words) {
      if (!words.dateSaid) {
        // L'utente non ha nominato un giorno: vale quello delle regole (nessuno, oppure oggi o domani se c'è l'ora).
        if (date === null || date === spokenDay) date = words.date;
        else brake = 'words';
      } else if (date !== words.date) {
        brake = 'words';
      }
      // Un'ora diversa da quella letta dalle regole: l'app chiede, e nella domanda propone la sua (vedi agreedTime).
      if (words.time && time !== words.time) {
        time = time ? agreedTime(time, words.time) : words.time;
        brake = 'words';
      }
    }
    if (time && !date) date = dayForTime(time, at);
    const { value, errors } = T.validateInput({
      title: action.title,
      duration: action.duration || T.DEFAULTS.duration,
      energy: action.energy || T.DEFAULTS.energy,
      date,
      time
    });
    if (Object.keys(errors).length) return null;
    if (!brake && value.date && value.date < today) brake = 'past';
    const twin = item => fold(item.title) === fold(value.title) && (item.date || null) === value.date;
    if (!brake && (tasks.some(task => !task.done && twin(task)) || entries.some(entry => entry.kind === 'add' && twin(entry.value)))) brake = 'duplicate';
    return { kind: 'add', value, title: value.title, brake };
  }

  /**
   * Una modifica: cambiano solo i campi dati dal modello (giorno, ora, durata, energia; mai il titolo).
   * `correction` è true se l'attività l'ha appena aggiunta l'assistente (memoria breve) e nessuno l'ha toccata dopo.
   * `target` è l'attività dell'ultimo scambio, quando la modifica è una correzione senza nome (vedi correctionTarget):
   * allora i campi del modello vanno su quella, e l'azione porta `redirected: true`.
   */
  function planUpdate(action, { refs, openTask, words, today, spokenDay, at, recent, target = null }) {
    const task = target || openTask(refs[action.task]);
    if (!task) return null;
    const before = T.editableFields(task);
    const next = { ...before };
    let brake = null;
    if ('date' in action) {
      // Un giorno che l'utente non ha nominato: «oggi» messo dal modello non sposta niente, un altro giorno chiede.
      if (words && !words.dateSaid && action.date) {
        if (action.date !== spokenDay && action.date !== before.date) {
          next.date = action.date; // la domanda mostra il giorno proposto dal modello
          brake = 'words';
        } else {
          next.date = before.date;
        }
      } else {
        next.date = action.date || null;
      }
      if (!next.date) next.time = null;
    }
    if ('time' in action) next.time = action.time || null;
    // Un'ora diversa da quella letta dalle regole: l'app chiede, e nella domanda propone la sua (vedi agreedTime).
    // Togliere l'ora (time: null) non è un'ora letta in un altro modo: lì la domanda resta quella del modello.
    const otherTime = Boolean(words && words.time && 'time' in action && next.time !== words.time);
    if (otherTime && next.time) next.time = agreedTime(next.time, words.time);
    if (action.duration) next.duration = action.duration;
    if (action.energy) next.energy = action.energy;
    if (next.time && !next.date) next.date = dayForTime(next.time, at);
    if (words) {
      if (words.dateSaid && 'date' in action && next.date !== words.date) brake = 'words';
      if (otherTime) brake = 'words';
    }
    const { value, errors } = T.validateInput(next);
    if (Object.keys(errors).length) return null;
    if (sameFields(value, before)) return { same: true, title: task.title };
    if (!brake && value.date && value.date < today && value.date !== before.date) brake = 'past';
    // L'ultimo stato lasciato dall'assistente su questa attività, se l'ha aggiunta lui in questa conversazione.
    let added = false;
    let last = null;
    recent.forEach(item => item.did.forEach(entry => {
      if (entry.taskId !== task.id || !entry.after) return;
      if (entry.type === 'add') added = true;
      if (entry.type === 'add' || entry.type === 'update') last = entry.after;
    }));
    const correction = added && sameFields(last, before);
    return { kind: 'update', taskId: task.id, title: task.title, before, value, brake, correction, redirected: Boolean(target) };
  }

  /* ---------- Correzioni senza nome: «no, facciamo alle 5», «anzi domani» ---------- */

  /**
   * L'attività a cui va una modifica che il messaggio non lega a nessuna attività. Il modello dovrebbe correggere
   * quella dell'ultimo scambio, ma spesso ne indica un'altra (misure in docs/assistente.md): qui decide l'app.
   * Restituisce l'attività dell'ultimo scambio, oppure null se resta la scelta del modello. Resta la scelta del modello se:
   * - l'ultimo scambio della memoria breve non ha toccato una sola attività (aggiunta, cambiata, proposta o in attesa
   *   di conferma), o quell'attività non è più da fare, o è già quella indicata dal modello;
   * - il messaggio indica l'attività del modello: con una parola del titolo («la riunione»), con la sua ora («quella
   *   delle 9») o con il suo giorno («quella di domani»). L'ora e il giorno nuovi («alle 5», «domani») non contano;
   * - il messaggio indica comunque qualcos'altro: un'ora o un giorno che non sono quelli dell'attività dell'ultimo
   *   scambio, o una parola del titolo di un'altra attività mandata al modello.
   */
  function correctionTarget(action, { tasks, refs, recent, message, at }) {
    const open = id => tasks.find(task => task.id === id && !task.done) || null;
    const chosen = open(refs[action.task]);
    const last = recent[recent.length - 1];
    if (!chosen || !last) return null;
    const touched = Array.from(new Set((last.did || []).map(entry => entry.taskId)));
    if (touched.length !== 1 || touched[0] === chosen.id) return null;
    const target = open(touched[0]);
    if (!target) return null;

    const hints = hintsOf(message, action, utils.todayISO(at));
    const titleFits = (task, list) => keyWords(task.title).some(word => list.some(other => sameWord(word, other)));
    const timeFits = task => hints.times.some(list => list.includes(task.time));
    const dayFits = task => hints.days.some(list => list.includes(task.date));
    if (titleFits(chosen, hints.words) || timeFits(chosen) || dayFits(chosen)) return null;
    if (hints.times.some(list => !list.includes(target.time)) || hints.days.some(list => !list.includes(target.date))) return null;
    // Le parole che stanno anche nel titolo dell'attività dell'ultimo scambio non indicano un'altra attività.
    const free = hints.words.filter(word => !titleFits(target, [word]));
    const others = Object.keys(refs).map(ref => open(refs[ref])).filter(task => task && task.id !== target.id);
    return others.some(task => titleFits(task, free)) ? null : target;
  }

  const WEEKDAYS = ['domenica', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato'];
  const DAY_WORDS = { oggi: 0, stamattina: 0, stasera: 0, stanotte: 0, domani: 1, dopodomani: 2, ieri: -1 };
  // Parole che non dicono di quale attività si parla: articoli e preposizioni, e le parole di giorni e ore.
  const STOP_WORDS = new Set(('gli una uno del dei dal dai per con che non piu poi tra fra sul sui nel nei alla alle allo agli ' +
    'della delle dello degli dalla dalle dallo nella nelle sulla sulle quella quello quelle quelli questa questo anzi invece meglio ' +
    'mattina mattino pomeriggio sera notte ore ora minuti min mezza mezzo mezzogiorno mezzanotte prossimo prossima settimana ' +
    Object.keys(DAY_WORDS).join(' ') + ' ' + WEEKDAYS.join(' ')).split(' '));

  const tokens = text => fold(text).split(/[^a-z0-9]+/).filter(Boolean);
  /** Le parole che contano per riconoscere un titolo: da 3 lettere, senza quelle di STOP_WORDS. */
  const keyWords = text => tokens(text).filter(word => word.length >= 3 && !STOP_WORDS.has(word));
  /** La stessa parola, anche al plurale o coniugata: uguali, oppure lunghe almeno 5 lettere con le prime 5 uguali. */
  const sameWord = (a, b) => a === b || (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5));
  const two = number => String(number).padStart(2, '0');
  // Un'ora nominata: «alle 5», «delle 9:30», «verso le 6 e mezza», «alle cinque meno un quarto», «all'una»; oppure
  // scritta da sola («17:30»); oppure «mezzogiorno» e «mezzanotte».
  const HOUR_WORDS = ['una', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci', 'undici', 'dodici'];
  const SAID_TIME = new RegExp(
    '(?:\\b(?:alle|delle|dalle|ore|per le|verso le|entro le)\\s+|\\b(?:all|dell|dall)[\'’]\\s?)' +
    '(\\d{1,2}|' + HOUR_WORDS.join('|') + ')\\b(?:[:.](\\d{2}))?' +
    '(?:\\s+(e\\s+mezz[ao]|e\\s+un\\s+quarto|e\\s+tre\\s+quarti|meno\\s+un\\s+quarto|e\\s+\\d{2})\\b)?' +
    '|\\b(\\d{1,2}):(\\d{2})\\b|\\b(mezzogiorno|mezzanotte)\\b', 'g');

  /**
   * Ciò che in un messaggio può indicare un'attività: le parole (`words`), le ore (`times`) e i giorni (`days`) nominati.
   * Ogni ora e ogni giorno è l'elenco dei valori possibili («delle 9» = 09:00 o 21:00; «lunedì» = quello passato o il
   * prossimo). L'ora e il giorno che la modifica mette (`action.time`, `action.date`) si tolgono: sono il valore nuovo.
   */
  function hintsOf(message, action, today) {
    const text = fold(message);
    const times = [];
    const clock = minutes => two(Math.floor(minutes / 60) % 24) + ':' + two(minutes % 60);
    const addTime = (hour, minutes) => {
      const total = hour * 60 + minutes;
      if (hour > 23 || total < 0) return;
      times.push(hour >= 1 && hour <= 12 ? [clock(total), clock((total + 720) % 1440)] : [clock(total)]);
    };
    let found;
    SAID_TIME.lastIndex = 0;
    while ((found = SAID_TIME.exec(text))) {
      if (found[6]) addTime(found[6] === 'mezzogiorno' ? 12 : 0, 0);
      else if (found[4]) addTime(Number(found[4]), Number(found[5]));
      else {
        const hour = /^\d/.test(found[1]) ? Number(found[1]) : HOUR_WORDS.indexOf(found[1]) + 1;
        const part = (found[3] || '').replace(/\s+/g, ' ');
        const extra = !part ? 0 : /mezz/.test(part) ? 30 : part === 'e un quarto' ? 15 : part === 'e tre quarti' ? 45 : part === 'meno un quarto' ? -15 : Number(part.slice(2));
        addTime(hour, Number(found[2] || 0) + extra);
      }
    }
    const days = [];
    tokens(message).forEach(word => {
      if (Object.prototype.hasOwnProperty.call(DAY_WORDS, word)) days.push([utils.addDays(today, DAY_WORDS[word])]);
      const weekday = WEEKDAYS.indexOf(word);
      if (weekday < 0) return;
      const list = [];
      for (let offset = -6; offset <= 7; offset++) {
        const day = utils.addDays(today, offset);
        if (utils.parseISODate(day).getDay() === weekday) list.push(day);
      }
      days.push(list);
    });
    const newTime = typeof action.time === 'string' ? action.time : null;
    const newDate = typeof action.date === 'string' ? action.date : null;
    return {
      words: keyWords(message),
      times: times.filter(list => !list.includes(newTime)),
      days: days.filter(list => !list.includes(newDate))
    };
  }

  /** Automatico o domanda, secondo i permessi. Completare ed eliminare: sempre una domanda. */
  function isAutomatic(entry, perms) {
    if (entry.brake) return false;
    if (entry.kind === 'add') return perms.autoAdd === true;
    if (entry.kind === 'update') return perms.autoEdit === true || (entry.correction === true && perms.autoAdd === true);
    return false;
  }

  /* ---------- Applicare, registrare, annullare ---------- */

  /**
   * Applica le azioni automatiche. Restituisce { tasks, log, did }: `log` sono le righe per l'elenco
   * «Cosa ha fatto l'assistente», `did` ciò che va nella memoria breve.
   */
  function applyAuto(tasks, auto, { now, origin = 'text', said = '' }) {
    let list = tasks;
    const log = [];
    const did = [];
    auto.forEach(entry => {
      if (entry.kind === 'add') {
        const task = T.createTask(entry.value, now);
        list = list.concat(task);
        const after = T.editableFields(task);
        log.push(logEntry({ now, origin, said, type: 'add', task, before: null, after }));
        did.push({ type: 'add', taskId: task.id, after });
      } else if (entry.kind === 'update') {
        const result = T.updateTask(list, entry.taskId, entry.value);
        if (!result.changed) return;
        list = result.tasks;
        const task = list.find(item => item.id === entry.taskId);
        const after = T.editableFields(task);
        log.push(logEntry({ now, origin, said, type: entry.correction ? 'correct' : 'update', task, before: T.editableFields(result.previous), after }));
        did.push({ type: 'update', taskId: task.id, after });
      }
    });
    return { tasks: list, log, did };
  }

  function logEntry({ now, origin, said, type, task, before, after }) {
    return { id: utils.uid(), at: now, origin, said: cut(clean(said), ASSISTANT.memory.said), type, taskId: task.id, title: task.title, before, after, undone: false };
  }

  /** Si può annullare finché l'attività c'è, non è completata ed è ancora come l'ha lasciata l'assistente. */
  function canUndo(tasks, entry) {
    if (!entry || entry.undone) return false;
    const task = tasks.find(item => item.id === entry.taskId);
    return Boolean(task) && !task.done && sameFields(T.editableFields(task), entry.after);
  }

  /** Annulla una o più righe (dall'ultima). Restituisce { tasks, undone }: gli id delle righe davvero annullate. */
  function undoEntries(tasks, entries) {
    let list = tasks;
    const undone = [];
    entries.slice().reverse().forEach(entry => {
      if (!canUndo(list, entry)) return;
      if (entry.type === 'add') list = list.filter(task => task.id !== entry.taskId);
      else list = T.updateTask(list, entry.taskId, entry.before).tasks;
      undone.push(entry.id);
    });
    return { tasks: list, undone };
  }

  /** Nuove righe in cima all'elenco; restano le ultime 50 degli ultimi 30 giorni. */
  function addToLog(log, entries, now) {
    return pruneLog(entries.slice().reverse().concat(Array.isArray(log) ? log : []), now);
  }

  function pruneLog(log, now) {
    return (Array.isArray(log) ? log : []).filter(entry => now - entry.at <= ASSISTANT.log.keepMs).slice(0, ASSISTANT.log.max);
  }

  function markUndone(log, ids) {
    const set = new Set(ids);
    return log.map(entry => (set.has(entry.id) ? { ...entry, undone: true } : entry));
  }

  /* ---------- Frasi scritte dall'app, dai dati veri ---------- */

  const lowerFirst = text => text.charAt(0).toLowerCase() + text.slice(1);

  /** "Domani alle 18:00", "Oggi", "mar 3 nov", "Senza data". */
  function whenLabel(fields, today) {
    if (!fields.date) return 'Senza data';
    return utils.formatDateLabel(fields.date, today) + (fields.time ? ' alle ' + fields.time : '');
  }

  function changeParts(before, after, today) {
    const parts = [];
    if (after.date !== before.date || after.time !== before.time) {
      if (!after.date) parts.push('senza giorno');
      else if (!after.time && before.time && after.date === before.date) parts.push('senza ora');
      else parts.push(lowerFirst(whenLabel(after, today)));
    }
    if (after.duration !== before.duration) parts.push(utils.formatDuration(after.duration));
    if (after.energy !== before.energy) parts.push('energia ' + T.ENERGY[after.energy].label.toLowerCase());
    return parts;
  }

  const onlyMoved = (before, after) => after.duration === before.duration && after.energy === before.energy;

  /** Cosa ha fatto un'azione automatica: «Aggiunta: Chiamare il medico · Domani», «Corretta: …», «Spostata: …». */
  function describeDone(entry, today) {
    if (entry.type === 'add') return 'Aggiunta: ' + entry.title + ' · ' + whenLabel(entry.after, today);
    const verb = entry.type === 'correct' ? 'Corretta' : onlyMoved(entry.before, entry.after) ? 'Spostata' : 'Cambiata';
    if (verb !== 'Cambiata') return verb + ': ' + entry.title + ' · ' + whenLabel(entry.after, today);
    return verb + ': ' + entry.title + ' · ' + changeParts(entry.before, entry.after, today).join(', ');
  }

  /** L'avviso per più azioni insieme: «Aggiunte 3 attività», «Aggiunte 2 attività e cambiata 1». Da Siri con il prefisso. */
  function summarizeDone(entries, today, origin) {
    let text;
    if (entries.length === 1) {
      const one = describeDone(entries[0], today);
      text = origin === 'siri' ? one.replace(/^(\w+): (.*?) · /, (all, verb, title) => lowerFirst(verb) + ' «' + title + '» · ') : one;
    } else {
      const adds = entries.filter(entry => entry.type === 'add').length;
      const changes = entries.length - adds;
      const parts = [];
      if (adds) parts.push(adds === 1 ? 'aggiunta 1 attività' : 'aggiunte ' + adds + ' attività');
      if (changes) parts.push(changes === 1 ? 'cambiata 1' : 'cambiate ' + changes);
      text = parts.join(' e ');
      if (origin !== 'siri') text = text.charAt(0).toUpperCase() + text.slice(1);
    }
    return origin === 'siri' ? 'Da Siri: ' + lowerFirst(text) : text;
  }

  /**
   * La stessa azione con una frase intera, per la memoria breve che torna al modello:
   * «Ho aggiunto «Chiamare il medico» per domani.», «Ho spostato «Palestra» a domani alle 18:00.».
   * È scritta come le frasi del modello (l'esempio delle sue istruzioni è questo). Nelle misure lo aiuta a riconoscere
   * l'attività di una correzione («no, facciamo alle 5») più della forma corta degli avvisi («Aggiunta: … · Domani»),
   * ma da sola non basta: vedi «Risultati del passo 1» in docs/assistente.md.
   */
  function recallDone(entry, today) {
    const title = '«' + entry.title + '»';
    const { before, after } = entry;
    if (entry.type === 'add') return 'Ho aggiunto ' + title + (after.date ? ' per ' + lowerFirst(whenLabel(after, today)) : '') + '.';
    if (!onlyMoved(before, after)) return 'Ho cambiato ' + title + ': ' + changeParts(before, after, today).join(', ') + '.';
    if (!after.date) return 'Ho tolto il giorno a ' + title + '.';
    if (!after.time && before.time && after.date === before.date) return 'Ho tolto l\'ora a ' + title + '.';
    return 'Ho spostato ' + title + ' a ' + lowerFirst(whenLabel(after, today)) + '.';
  }

  /**
   * Ciò che Aura «ha risposto» in uno scambio, per la memoria breve: la sua frase (se c'è), poi le azioni fatte
   * (`log`, le righe di applyAuto) e le domande rimaste in attesa (`ask`).
   */
  function recallReply({ say = '', log = [], ask = [] }, today) {
    return [clean(say)].concat(log.map(entry => recallDone(entry, today)), ask.map(entry => askText(entry, today))).filter(Boolean).join(' ');
  }

  /** La domanda di un'azione che aspetta un tocco: «Sposto «Palestra» a domani alle 18:00?», «Elimino «X»?». */
  function askText(entry, today) {
    const title = '«' + entry.title + '»';
    if (entry.kind === 'complete') return 'Segno ' + title + ' come fatta?';
    if (entry.kind === 'delete') return 'Elimino ' + title + '?';
    if (entry.kind === 'add') {
      const when = whenLabel(entry.value, today);
      if (entry.brake === 'duplicate') return 'C\'è già ' + title + ' · ' + when + ': la aggiungo lo stesso?';
      if (entry.brake === 'past') return title + ' sarebbe per ' + lowerFirst(when) + ', che è passato: la aggiungo lo stesso?';
      return 'Aggiungo ' + title + ' · ' + when + '?';
    }
    const { before, value } = entry;
    if (onlyMoved(before, value)) {
      if (!value.date) return 'Tolgo il giorno a ' + title + '?';
      if (!value.time && before.time && value.date === before.date) return 'Tolgo l\'ora a ' + title + '?';
      return 'Sposto ' + title + ' a ' + lowerFirst(whenLabel(value, today)) + '?';
    }
    return 'Cambio ' + title + ': ' + changeParts(before, value, today).join(', ') + '?';
  }

  /** Il pulsante che conferma una domanda. */
  function confirmLabel(entry) {
    if (entry.kind === 'add') return 'Aggiungi';
    if (entry.kind === 'complete') return 'Fatto';
    if (entry.kind === 'delete') return 'Elimina';
    return onlyMoved(entry.before, entry.value) ? 'Sposta' : 'Cambia';
  }

  /* ---------- Proposta all'apertura: copia per 3 ore, al massimo 8 al giorno ---------- */

  /** Impronta di ciò che decide la proposta: attività mandate, scelta di tempo ed energia, giorno e fascia. */
  function openKey(payload, at) {
    return hash(JSON.stringify([payload.tasks, payload.context, utils.todayISO(at), partOfDay(at)]));
  }

  function canReuseOpen(cache, key, now) {
    return Boolean(cache) && cache.key === key && now >= cache.at && now - cache.at < ASSISTANT.open.reuseMs;
  }

  function openAllowed(opens, now) {
    return !opens || opens.day !== utils.todayISO(now) || opens.count < ASSISTANT.open.perDay;
  }

  function countOpen(opens, now) {
    const day = utils.todayISO(now);
    return { day, count: opens && opens.day === day ? opens.count + 1 : 1 };
  }

  /* ---------- Dati salvati (aura-tasks:assistant e prefs.assistant), ripuliti ---------- */

  const isText = value => typeof value === 'string';
  const isMs = value => Number.isFinite(value) && value > 0;

  function cleanFields(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const { value, errors } = T.validateInput(raw);
    return Object.keys(errors).length ? null : value;
  }

  function cleanLogEntry(raw) {
    if (!raw || typeof raw !== 'object' || !isText(raw.id) || !isMs(raw.at) || !ORIGINS.includes(raw.origin) ||
      !LOG_TYPES.includes(raw.type) || !isText(raw.taskId) || !isText(raw.title)) return null;
    const after = cleanFields(raw.after);
    const before = raw.type === 'add' ? null : cleanFields(raw.before);
    if (!after || (raw.type !== 'add' && !before)) return null;
    return { id: raw.id, at: raw.at, origin: raw.origin, said: isText(raw.said) ? cut(raw.said, ASSISTANT.memory.said) : '',
      type: raw.type, taskId: raw.taskId, title: raw.title, before, after, undone: raw.undone === true };
  }

  function cleanExchange(raw) {
    if (!raw || typeof raw !== 'object' || !isMs(raw.at)) return null;
    const did = (Array.isArray(raw.did) ? raw.did : [])
      .filter(entry => entry && DID_TYPES.includes(entry.type) && isText(entry.taskId))
      .map(entry => (entry.after ? { type: entry.type, taskId: entry.taskId, after: cleanFields(entry.after) } : { type: entry.type, taskId: entry.taskId }));
    return { at: raw.at, said: isText(raw.said) ? raw.said : '', reply: isText(raw.reply) ? raw.reply : '', did };
  }

  /**
   * I dati dell'assistente letti dal localStorage, ripuliti: elenco, memoria breve, copia della proposta all'apertura,
   * conteggio delle proposte automatiche del giorno, messaggi rimasti. Ciò che non è valido si scarta.
   */
  function sanitizeStore(raw) {
    const base = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const open = base.open && typeof base.open === 'object' && isText(base.open.key) && isMs(base.open.at) && isText(base.open.taskId)
      ? { key: base.open.key, at: base.open.at, taskId: base.open.taskId, say: isText(base.open.say) ? base.open.say : '',
        reason: isText(base.open.reason) ? base.open.reason : null }
      : null;
    const opens = base.opens && utils.isISODate(base.opens.day) && Number.isInteger(base.opens.count) && base.opens.count >= 0
      ? { day: base.opens.day, count: base.opens.count } : null;
    const left = base.left && isMs(base.left.at) && Number.isInteger(base.left.count) && base.left.count >= 0
      ? { at: base.left.at, count: base.left.count } : null;
    return {
      log: (Array.isArray(base.log) ? base.log : []).map(cleanLogEntry).filter(Boolean).slice(0, ASSISTANT.log.max),
      memory: (Array.isArray(base.memory) ? base.memory : []).map(cleanExchange).filter(Boolean).slice(-ASSISTANT.memory.max),
      open,
      opens,
      left
    };
  }

  /** Interruttori e permessi: valori non validi tornano a quelli di partenza; acceso solo dopo il consenso. */
  function sanitizePrefs(raw) {
    const base = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const d = ASSISTANT.defaults;
    const consentAt = isMs(base.consentAt) ? base.consentAt : null;
    return {
      enabled: consentAt !== null && base.enabled === true,
      voice: typeof base.voice === 'boolean' ? base.voice : d.voice,
      autoAdd: typeof base.autoAdd === 'boolean' ? base.autoAdd : d.autoAdd,
      autoEdit: typeof base.autoEdit === 'boolean' ? base.autoEdit : d.autoEdit,
      consentAt
    };
  }

  Aura.assistant = {
    ASSISTANT,
    TEXTS,
    partOfDay,
    dayForTime,
    recentExchanges,
    addExchange,
    selectTasks,
    buildRequest,
    chipFor,
    contextOf,
    planReply,
    isAutomatic,
    applyAuto,
    canUndo,
    undoEntries,
    addToLog,
    pruneLog,
    markUndone,
    whenLabel,
    describeDone,
    summarizeDone,
    recallDone,
    recallReply,
    askText,
    confirmLabel,
    openKey,
    canReuseOpen,
    openAllowed,
    countOpen,
    sanitizeStore,
    sanitizePrefs
  };
})(window.Aura = window.Aura || {});
