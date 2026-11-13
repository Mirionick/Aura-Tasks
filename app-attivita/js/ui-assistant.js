/*
 * Aura Tasks — assistente con l'IA: la parte che tocca la pagina (specifica in docs/assistente.md).
 * Striscia in cima a Focus, campo «Scrivi ad Aura…» e conferme nel foglio «Aura» (il foglio di «Cosa faccio adesso?»,
 * che resta di js/ui-focus.js), consenso, foglio «Assistente» con l'elenco, proposta all'apertura, frasi di Siri.
 * La logica sta in js/assistant.js; i dati si leggono e si scrivono solo con Aura.storage.
 * Con l'assistente spento, senza consenso o da file:// non parte nessuna richiesta: la striscia mostra la proposta delle regole.
 */
(function (Aura) {
  'use strict';

  const { utils, assistant: A, suggest: SG, storage, remote: R, motion: M } = Aura;

  const byId = id => document.getElementById(id);
  const els = {};
  let ctx = null;
  let focusCtl = null;
  let store = null; // aura-tasks:assistant: elenco, memoria breve, copia della proposta all'apertura, conteggi

  const TEXTS = {
    kicker: 'Cosa faccio adesso?',
    pause: 'Una pausa ☕?',
    emptyKicker: 'Aura',
    emptyTitle: 'Dimmi cosa devi fare',
    openKicker: 'Per cominciare ti propongo:',
    thinking: 'Ci penso…',
    offline: 'Serve internet per scrivere ad Aura.',
    quota: 'Per oggi le risposte sono finite: riprova domani.',
    down: 'Aura non risponde in questo momento.',
    confused: 'Aura non ha capito la risposta del suo server.',
    addSheet: 'ho compilato il foglio con le regole',
    siriAsk: 'Da Siri: serve un tuo tocco.',
    changed: 'Non si può più annullare: l\'attività è cambiata.',
    gone: 'Questa attività non c\'è più.'
  };

  /* ---------- Stato ---------- */

  const prefs = () => ctx.getPrefs().assistant;
  const available = () => R.availability() === 'ok';
  /** Acceso davvero: c'è il server (non da file://), l'utente ha dato il consenso e non l'ha spento. */
  const isActive = () => available() && prefs().enabled === true;
  const online = () => navigator.onLine !== false;

  function setAssistantPrefs(change) {
    ctx.setPrefs({ assistant: { ...prefs(), ...change } });
  }

  function save() {
    storage.saveAssistant(store);
  }

  /* ---------- Striscia ---------- */

  let aiStrip = null;       // proposta dell'IA mostrata nella striscia: { taskId, say, reason }
  let stripShown = null;    // ciò che la striscia mostra adesso: { taskId, reason } (null = niente da proporre)
  let stripTouched = false; // la striscia è stata toccata: una risposta che arriva dopo non la cambia sotto il dito
  let fadeTimer = null;

  /**
   * Scrive la striscia. `focusCount` è il numero di sezioni di Focus (0 = lista vuota).
   * Spenta o senza consenso: la proposta delle regole, e solo se c'è qualcosa in Focus.
   * Accesa: sempre visibile; a lista vuota invita a scrivere; con una proposta dell'IA ancora valida mostra quella.
   */
  function renderStrip({ focusCount = lastFocusCount, animate = false } = {}) {
    lastFocusCount = focusCount;
    const active = isActive();
    els.strip.hidden = !active && focusCount === 0;
    let kicker = TEXTS.kicker;
    let title = TEXTS.pause;
    let shown = null;
    if (active && focusCount === 0) {
      kicker = TEXTS.emptyKicker;
      title = TEXTS.emptyTitle;
    } else {
      const ai = active ? validAi() : null;
      if (ai) {
        kicker = ai.say || TEXTS.openKicker;
        title = ai.task.title;
        shown = { taskId: ai.task.id, reason: ai.reason };
      } else {
        const rule = focusCtl.ruleProposal();
        if (rule) {
          title = rule.task.title;
          shown = { taskId: rule.task.id, reason: null };
        }
      }
    }
    stripShown = shown;
    const write = () => {
      els.stripKicker.textContent = kicker;
      els.stripTitle.textContent = title;
    };
    clearTimeout(fadeTimer);
    if (animate && M.canAnimate() && els.stripTitle.textContent !== title) {
      // Dissolvenza solo con opacity: la striscia ha altezza fissa, nessuna card si sposta.
      els.stripText.classList.add('is-fading');
      fadeTimer = setTimeout(() => {
        write();
        els.stripText.classList.remove('is-fading');
      }, M.ms('quick'));
    } else {
      els.stripText.classList.remove('is-fading');
      write();
    }
  }
  let lastFocusCount = 0;

  /** La proposta dell'IA della striscia, se l'attività è ancora tra le candidate delle regole (con l'ultima scelta). */
  function validAi() {
    if (!aiStrip) return null;
    const now = Date.now();
    const choice = ctx.getPrefs().suggest;
    const task = SG.candidates(ctx.getState().tasks, { minutes: choice.minutes, energy: choice.energy, today: utils.todayISO(now), now })
      .find(item => item.id === aiStrip.taskId);
    return task ? { task, say: aiStrip.say, reason: aiStrip.reason } : null;
  }

  function onStripTap() {
    stripTouched = true;
    if (stripShown) {
      // Il foglio si apre con la stessa attività e lo stesso motivo della striscia.
      focusCtl.openSuggest({ taskId: stripShown.taskId, reason: stripShown.reason });
    } else if (isActive() && lastFocusCount === 0) {
      focusCtl.openSuggest({ focus: els.input });
    } else {
      focusCtl.openSuggest();
    }
  }

  /* ---------- Proposta dell'IA all'apertura ---------- */

  let openRunning = false;
  let hiddenAt = 0;

  /** Una copia ancora valida (stessa lista, stessa fascia, meno di 3 ore): si mostra subito, senza rete. */
  function useCachedOpen() {
    if (!isActive() || !store.open) return false;
    const now = Date.now();
    const { payload } = A.buildRequest(ctx.getState().tasks, { kind: 'open', now, context: ctx.getPrefs().suggest });
    if (!A.canReuseOpen(store.open, A.openKey(payload, now), now)) return false;
    aiStrip = { taskId: store.open.taskId, say: store.open.say, reason: store.open.reason };
    return true;
  }

  /**
   * Proposta dell'IA all'apertura: dopo il caricamento, a pagina visibile. Si riusa la copia se vale; altrimenti, entro
   * il tetto del giorno, una richiesta. Se la risposta arriva entro 4 secondi e la striscia non è stata toccata,
   * il testo cambia con una dissolvenza; se arriva dopo, resta solo la copia per la prossima apertura.
   */
  async function openProposal() {
    if (openRunning || !isActive() || !online() || document.visibilityState !== 'visible') return;
    const state = ctx.getState();
    const now = Date.now();
    const choice = ctx.getPrefs().suggest;
    const today = utils.todayISO(now);
    if (!SG.candidates(state.tasks, { minutes: choice.minutes, energy: choice.energy, today, now }).length) return; // niente da proporre
    const { payload, refs } = A.buildRequest(state.tasks, { kind: 'open', now, context: choice });
    const key = A.openKey(payload, now);
    if (A.canReuseOpen(store.open, key, now)) {
      aiStrip = { taskId: store.open.taskId, say: store.open.say, reason: store.open.reason };
      renderStrip();
      return;
    }
    if (!A.openAllowed(store.opens, now)) return;
    store.opens = A.countOpen(store.opens, now);
    save();
    openRunning = true;
    const started = Date.now();
    let result;
    try {
      result = await chatCall(payload);
    } finally {
      openRunning = false;
    }
    if (!result.ok || !isActive()) return;
    noteLeft(result.data);
    const plan = A.planReply(result.data, {
      tasks: ctx.getState().tasks, refs, perms: { autoAdd: false, autoEdit: false }, now: Date.now(), message: '', memory: [], choice
    });
    // All'apertura vale solo una proposta del modello tra le candidate; nessuna azione.
    if (!plan.proposal || !plan.modelSay) return;
    const say = kickerFrom(plan.say);
    store.open = { key, at: now, taskId: plan.proposal.taskId, say, reason: plan.proposal.reason };
    save();
    if (Date.now() - started > A.ASSISTANT.open.waitMs || stripTouched || focusCtl.isSuggestOpen()) return;
    aiStrip = { taskId: store.open.taskId, say, reason: store.open.reason };
    renderStrip({ animate: true });
  }

  /** La frase dell'apertura per la riga piccola: senza titolo, che sta nella riga grande. */
  function kickerFrom(say) {
    const text = String(say || '').trim();
    if (!text || text.length > 60 || /«/.test(text)) return TEXTS.openKicker;
    return /[:.!?]$/.test(text) ? text.replace(/[.!?]$/, ':') : text + ':';
  }

  /* ---------- Richieste ---------- */

  /** POST /api/assistant/chat con il codice del dispositivo; la prima volta lo registra. Non lancia mai. */
  async function chatCall(payload) {
    if (!online()) return { ok: false, status: 0, data: null };
    try {
      if (!ctx.getRemote().code) await ctx.ensureDevice();
    } catch (err) {
      return { ok: false, status: 0, data: { error: err && err.message } };
    }
    return ctx.withDevice(code => R.api.chat(code, payload));
  }

  function noteLeft(data) {
    if (data && Number.isInteger(data.left)) {
      store.left = { at: Date.now(), count: data.left };
      save();
    }
  }

  /** Perché l'IA non ha risposto, in una frase. */
  function failure(result) {
    const data = result.data || {};
    if ((result.status === 429 || result.status === 503) && /daily-cap|device-/.test(data.reason || '')) return TEXTS.quota;
    if (result.status === 0) return online() ? TEXTS.down : TEXTS.offline;
    if (result.status === 502 && data.reason === 'bad-reply') return TEXTS.confused;
    return R.troubleMessage(result, navigator.onLine);
  }

  /* ---------- Foglio «Aura»: campo, frase, conferme ---------- */

  let busy = false;
  let pendingText = null; // frase scritta prima del consenso: parte dopo «Attiva»

  /** Titolo, campo e ingranaggio secondo lo stato. Da file:// il campo non c'è. */
  function syncSheet() {
    const active = isActive();
    focusCtl.setSuggestTitle(active ? 'Aura' : TEXTS.kicker);
    els.footer.hidden = !available();
    els.settings.hidden = !available();
    els.send.disabled = busy;
    els.input.readOnly = busy;
  }

  /** All'apertura del foglio: frase e conferme di prima spariscono. */
  function resetTop() {
    els.say.textContent = '';
    els.asks.replaceChildren();
    els.top.hidden = true;
    els.consent.hidden = true;
    setStatus(null);
  }

  function setSay(text) {
    els.say.textContent = text || '';
    els.top.hidden = !text && !els.asks.children.length;
  }

  function setStatus(text, tone) {
    els.status.hidden = !text;
    els.status.textContent = text || '';
    if (tone) els.status.dataset.tone = tone;
  }

  function showConsent() {
    els.consentAutoAdd.checked = prefs().autoAdd;
    els.consentAutoEdit.checked = prefs().autoEdit;
    els.consent.hidden = false;
  }

  function onConsentOn() {
    setAssistantPrefs({
      enabled: true,
      consentAt: prefs().consentAt || Date.now(),
      autoAdd: els.consentAutoAdd.checked,
      autoEdit: els.consentAutoEdit.checked
    });
    els.consent.hidden = true;
    syncSheet();
    renderStrip();
    const text = pendingText;
    pendingText = null;
    if (text) {
      els.input.value = text;
      sendMessage(text);
    } else {
      els.input.focus();
    }
  }

  function onConsentLater() {
    els.consent.hidden = true;
    pendingText = null;
  }

  function onSubmit(event) {
    event.preventDefault();
    const text = els.input.value.replace(/\s+/g, ' ').trim();
    if (!text || busy) return;
    if (!isActive()) {
      pendingText = text;
      showConsent();
      return;
    }
    sendMessage(text);
  }

  async function sendMessage(text) {
    busy = true;
    syncSheet();
    setStatus(TEXTS.thinking, 'busy');
    const at = Date.now();
    const choice = focusCtl.currentChoice();
    const { payload, refs } = A.buildRequest(ctx.getState().tasks, { kind: 'message', message: text, now: at, context: choice, memory: store.memory });
    const result = await chatCall(payload);
    busy = false;
    syncSheet();
    setStatus(null);
    if (!result.ok) {
      // Senza IA: la frase non si perde, si apre «Nuova attività» già compilato dalle regole, da confermare.
      els.input.value = '';
      const why = failure(result);
      ctx.closeSheet(els.sheet);
      ctx.openAddSheet(text, why.replace(/[.:]$/, '') + ': ' + TEXTS.addSheet);
      return;
    }
    els.input.value = '';
    noteLeft(result.data);
    handleReply(result.data, { text, refs, at, origin: 'text', choice });
  }

  /**
   * La risposta di un messaggio scritto, con il foglio aperto: tempo ed energia, azioni automatiche (una riga ciascuna,
   * con il suo «Annulla»: l'avviso in basso starebbe sotto il foglio), domande, proposta, frase.
   */
  function handleReply(data, { text, refs, at, origin, choice }) {
    const now = Date.now();
    const today = utils.todayISO(now);
    const plan = A.planReply(data, { tasks: ctx.getState().tasks, refs, perms: prefs(), now, at, message: text, memory: store.memory, choice });
    const did = [];
    const done = [];
    const rows = [];
    if (plan.context) focusCtl.setSessionChoice(plan.context.use, plan.context.save);
    if (plan.auto.length) {
      const applied = applyAuto(plan.auto, { now, origin, said: text });
      applied.log.forEach(entry => rows.push(doneRow(A.describeDone(entry, today), () => undo([entry], { quiet: true }))));
      done.push(...applied.log);
      did.push(...applied.did);
    }
    plan.ask.forEach(entry => {
      rows.push(askRow(entry, today));
      if (entry.taskId) did.push({ type: 'ask', taskId: entry.taskId });
    });
    if (plan.proposal) {
      focusCtl.showSuggested(plan.proposal);
      did.push({ type: 'suggest', taskId: plan.proposal.taskId });
    } else {
      focusCtl.refreshSuggestion();
    }
    // Con delle azioni le righe dicono già tutto (fatte e da confermare): la frase resta per le proposte e per quando
    // non c'è nessuna azione.
    const say = plan.say || '';
    els.asks.replaceChildren(...rows);
    setSay(say);
    store.memory = A.addExchange(store.memory, { said: text, reply: A.recallReply({ say, log: done, ask: plan.ask }, today), did }, now);
    save();
    renderStrip();
  }

  /** Applica le azioni automatiche: un commit solo, le righe nell'elenco. */
  function applyAuto(auto, { now, origin, said }) {
    const applied = A.applyAuto(ctx.getState().tasks, auto, { now, origin, said });
    ctx.commit(applied.tasks);
    store.log = A.addToLog(store.log, applied.log, now);
    save();
    focusCtl.refreshSuggestion();
    return applied;
  }

  /**
   * Annulla azioni automatiche (da una riga del foglio, da un avviso o dall'elenco): solo ciò che non è cambiato nel
   * frattempo. Restituisce true se ha annullato qualcosa; `quiet` non mostra l'avviso quando non si può.
   */
  function undo(entries, { quiet = false } = {}) {
    const result = A.undoEntries(ctx.getState().tasks, entries);
    if (!result.undone.length) {
      if (!quiet) ctx.showToast(TEXTS.changed);
      return false;
    }
    ctx.commit(result.tasks);
    store.log = A.markUndone(store.log, result.undone);
    save();
    focusCtl.refreshSuggestion();
    if (els.assistantSheet.open) renderLog();
    return true;
  }

  /* ---------- Righe in alto nel foglio: azioni fatte e azioni che aspettano un tocco ---------- */

  function button(label, className, onClick) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'btn btn--small ' + className;
    el.textContent = label;
    el.addEventListener('click', onClick);
    return el;
  }

  /** Una riga: il testo e, sotto, i pulsanti; un pulsante toccato lascia al loro posto una frase (e forse «Annulla»). */
  function row(message, buttons) {
    const li = document.createElement('li');
    li.className = 'ask';
    const text = document.createElement('p');
    text.className = 'ask__text';
    text.textContent = message;
    const actions = document.createElement('div');
    actions.className = 'ask__actions';
    actions.append(...buttons(outcome => settle(actions, outcome)));
    li.append(text, actions);
    return li;
  }

  /** Al posto dei pulsanti: la frase dell'esito, con «Annulla» se si può tornare indietro. */
  function settle(actions, { message, undo: back = null }) {
    const done = document.createElement('div');
    done.className = 'ask__actions';
    const note = document.createElement('p');
    note.className = 'ask__done';
    note.textContent = message;
    done.appendChild(note);
    if (back) {
      done.appendChild(button('Annulla', 'btn--ghost', () => {
        const ok = back();
        settle(done, { message: ok ? 'Annullata.' : TEXTS.changed });
      }));
    }
    actions.replaceWith(done);
  }

  /** Azione automatica già fatta: «Aggiunta: … · Domani» con «Annulla». */
  function doneRow(message, back) {
    return row(message, finish => [button('Annulla', 'btn--ghost', () => finish({ message: back() ? 'Annullata.' : TEXTS.changed }))]);
  }

  /** Azione che aspetta un tocco: «Sposto «Palestra» a domani alle 18:00?» con «Sposta» e «No». */
  function askRow(entry, today) {
    return row(A.askText(entry, today), finish => [
      button(A.confirmLabel(entry), 'btn--soft', () => finish(confirmAsk(entry))),
      button('No', 'btn--ghost', () => finish({ message: 'Va bene, lascio com\'è.' }))
    ]);
  }

  /**
   * Esegue una conferma con le funzioni di sempre. Restituisce { message, undo? }.
   * «Fatto» ed «Elimina» chiudono il foglio, come il «Fatto» della proposta: così l'avviso con «Annulla» si vede.
   */
  function confirmAsk(entry) {
    const T = Aura.tasks;
    const state = ctx.getState();
    if (entry.kind === 'add') {
      const task = T.createTask(entry.value, Date.now());
      if (!ctx.commit(state.tasks.concat(task))) return { message: 'Non sono riuscita a salvare.' };
      focusCtl.refreshSuggestion();
      const after = T.editableFields(task);
      return {
        message: 'Aggiunta.',
        undo: () => {
          const now = ctx.getState().tasks.find(item => item.id === task.id);
          if (!now || now.done || JSON.stringify(T.editableFields(now)) !== JSON.stringify(after)) return false;
          ctx.commit(ctx.getState().tasks.filter(item => item.id !== task.id));
          focusCtl.refreshSuggestion();
          return true;
        }
      };
    }
    const task = state.tasks.find(item => item.id === entry.taskId && !item.done);
    if (!task) return { message: TEXTS.gone };
    if (entry.kind === 'complete') {
      ctx.closeSheet(els.sheet);
      ctx.completeTask(task.id, { delay: M.ms('exit') });
      return { message: 'Fatta.' };
    }
    if (entry.kind === 'delete') {
      ctx.closeSheet(els.sheet);
      ctx.onDelete(task.id);
      return { message: 'Eliminata.' };
    }
    const result = T.updateTask(state.tasks, task.id, entry.value);
    if (!result.changed) return { message: 'Era già così.' };
    ctx.commit(result.tasks);
    focusCtl.refreshSuggestion();
    const before = T.editableFields(result.previous);
    const after = T.editableFields(result.tasks.find(item => item.id === task.id));
    return {
      message: 'Fatto.',
      undo: () => {
        const now = ctx.getState().tasks.find(item => item.id === task.id);
        if (!now || now.done || JSON.stringify(T.editableFields(now)) !== JSON.stringify(after)) return false;
        ctx.commit(T.updateTask(ctx.getState().tasks, task.id, before).tasks);
        focusCtl.refreshSuggestion();
        return true;
      }
    };
  }

  /* ---------- Frasi di Siri ---------- */

  /** Le frasi di Siri passano dall'assistente solo se è acceso e c'è internet; altrimenti tutto come prima. */
  const takesSiri = () => isActive() && online();

  /**
   * Le frasi ritirate dalla casella, una richiesta ciascuna («domani» si conta dalla dettatura).
   * Restituisce { done, fallback }: `done` sono gestite (azioni fatte o domande nel foglio «Aura»), `fallback` vanno
   * nel foglio «Nuova attività» già compilato, come prima: senza internet, a quota finita, con un errore, con una
   * risposta non valida o non capita, e quando l'unica azione è un'aggiunta che aspetta un tocco.
   */
  async function handleSiri(items) {
    const done = [];
    const fallback = [];
    const autoLog = [];
    const asks = [];
    let stop = false;
    for (const item of items) {
      if (stop || !isActive()) {
        fallback.push(item.id);
        continue;
      }
      const at = item.createdAt > 0 && item.createdAt <= Date.now() ? item.createdAt : Date.now();
      const choice = ctx.getPrefs().suggest;
      const { payload, refs } = A.buildRequest(ctx.getState().tasks, { kind: 'siri', message: item.text, now: Date.now(), at, context: choice, memory: store.memory });
      const result = await chatCall(payload);
      if (!result.ok) {
        fallback.push(item.id);
        // Rete assente o quota finita: inutile provare le altre, vanno tutte nel foglio.
        if (result.status === 0 || result.status === 429 || result.status === 503) stop = true;
        continue;
      }
      noteLeft(result.data);
      const now = Date.now();
      const plan = A.planReply(result.data, { tasks: ctx.getState().tasks, refs, perms: prefs(), now, at, message: item.text, memory: store.memory, choice });
      const others = plan.ask.filter(entry => entry.kind !== 'add');
      if (!plan.auto.length && !others.length) {
        fallback.push(item.id); // non capita, oppure un'aggiunta da confermare: il foglio di sempre
        continue;
      }
      const did = [];
      let log = [];
      if (plan.auto.length) {
        const applied = applyAuto(plan.auto, { now, origin: 'siri', said: item.text });
        log = applied.log;
        autoLog.push(...log);
        did.push(...applied.did);
      }
      plan.ask.forEach(entry => {
        asks.push(entry);
        if (entry.taskId) did.push({ type: 'ask', taskId: entry.taskId });
      });
      store.memory = A.addExchange(store.memory, { said: item.text, reply: A.recallReply({ log, ask: plan.ask }, utils.todayISO(now)), did }, now);
      save();
      done.push(item.id);
    }
    const today = utils.todayISO(Date.now());
    if (asks.length) {
      // Serve un tocco: il foglio «Aura» con le domande, e le azioni già fatte come righe con «Annulla»
      // (un avviso in basso starebbe sotto il foglio).
      focusCtl.openSuggest(); // l'apertura azzera frase e righe (sheetOpening), poi arrivano quelle di Siri
      els.asks.replaceChildren(
        ...autoLog.map(entry => doneRow(A.summarizeDone([entry], today, 'siri'), () => undo([entry], { quiet: true }))),
        ...asks.map(entry => askRow(entry, today))
      );
      setSay(TEXTS.siriAsk);
    } else if (autoLog.length) {
      ctx.showToast(A.summarizeDone(autoLog, today, 'siri'), { action: 'Annulla', onAction: () => undo(autoLog) });
    }
    renderStrip();
    return { done, fallback };
  }

  /* ---------- Foglio «Assistente» ---------- */

  function openAssistantSheet() {
    els.sheetStatus.hidden = true;
    syncAssistantSheet();
    renderLog();
    ctx.setAutofocus(els.assistantSheet, els.assistantHeading);
    ctx.openSheet(els.assistantSheet);
  }

  function syncAssistantSheet() {
    const p = prefs();
    els.enabled.checked = p.enabled;
    els.state.textContent = p.enabled ? 'Acceso' : 'Spento';
    els.state.dataset.tone = p.enabled ? 'on' : 'off';
    els.autoAdd.checked = p.autoAdd;
    els.autoEdit.checked = p.autoEdit;
    // Qui il giorno è apposta quello UTC (toISOString): i limiti del server ripartono alle 00:00 UTC, non a mezzanotte locale.
    const utcDay = ms => new Date(ms).toISOString().slice(0, 10);
    const left = store.left && utcDay(store.left.at) === utcDay(Date.now()) ? store.left.count : null;
    els.left.hidden = left === null;
    els.left.textContent = left === null ? '' : 'Messaggi rimasti oggi: ' + left;
    const connected = Boolean(ctx.getRemote().code);
    els.disconnect.hidden = !connected;
    els.disconnectNote.hidden = !connected;
  }

  const ORIGIN_LABELS = { text: 'Scritto', voice: 'A voce', siri: 'Da Siri' };

  function renderLog() {
    const now = Date.now();
    const today = utils.todayISO(now);
    store.log = A.pruneLog(store.log, now);
    const tasks = ctx.getState().tasks;
    els.logEmpty.hidden = store.log.length > 0;
    els.log.replaceChildren(...store.log.map(entry => {
      const li = document.createElement('li');
      li.className = 'log__item' + (entry.undone ? ' is-undone' : '');
      const what = document.createElement('p');
      what.className = 'log__what';
      what.textContent = A.describeDone(entry, today) + (entry.undone ? ' (annullata)' : '');
      const meta = document.createElement('p');
      meta.className = 'log__meta';
      meta.textContent = utils.formatMoment(entry.at, today) + ' · ' + ORIGIN_LABELS[entry.origin] + (entry.said ? ': «' + entry.said + '»' : '');
      li.append(what, meta);
      const exists = tasks.some(task => task.id === entry.taskId);
      const undoable = A.canUndo(tasks, entry);
      if (exists || undoable) {
        const actions = document.createElement('div');
        actions.className = 'log__actions';
        if (exists) {
          const show = document.createElement('button');
          show.type = 'button';
          show.className = 'btn btn--soft btn--small';
          show.textContent = 'Mostra';
          show.addEventListener('click', () => {
            ctx.closeSheet(els.assistantSheet);
            ctx.closeSheet(els.sheet);
            ctx.showTask(entry.taskId);
          });
          actions.appendChild(show);
        }
        if (undoable) {
          const back = document.createElement('button');
          back.type = 'button';
          back.className = 'btn btn--ghost btn--small';
          back.textContent = 'Annulla';
          back.addEventListener('click', () => undo([entry]));
          actions.appendChild(back);
        }
        li.appendChild(actions);
      }
      return li;
    }));
  }

  function onEnabledChange() {
    const on = els.enabled.checked;
    if (on) {
      // Il foglio «Assistente» mostra per intero che cosa viene inviato: acceso da qui vale come consenso.
      setAssistantPrefs({ enabled: true, consentAt: prefs().consentAt || Date.now() });
    } else {
      forget();
    }
    syncAssistantSheet();
    syncSheet();
    renderStrip();
  }

  /** Spento (o dispositivo scollegato): via la memoria breve e la proposta dell'IA. L'elenco resta, per 30 giorni. */
  function forget() {
    setAssistantPrefs({ enabled: false });
    store.memory = [];
    store.open = null;
    aiStrip = null;
    save();
  }

  async function onDisconnect() {
    els.disconnect.disabled = true;
    const result = await ctx.disconnect();
    els.disconnect.disabled = false;
    if (result && result.ok) {
      // Si chiudono tutti e due i fogli: l'avviso «Dispositivo scollegato» con «Annulla» sta sotto i fogli aperti.
      ctx.closeSheet(els.assistantSheet);
      ctx.closeSheet(els.sheet);
    }
    els.sheetStatus.hidden = !(result && !result.ok && result.message);
    els.sheetStatus.textContent = result && !result.ok && result.message ? result.message : '';
    syncAssistantSheet();
  }

  /* ---------- Avvio ---------- */

  function init(context) {
    ctx = context;
    focusCtl = context.focusCtl;
    store = storage.loadAssistant();
    [
      'strip:suggest-button', 'stripText:strip-text', 'stripKicker:strip-kicker', 'stripTitle:strip-title',
      'sheet:suggest-sheet', 'settings:assist-settings', 'top:assist-top', 'say:assist-say', 'asks:assist-asks',
      'footer:assist-footer', 'consent:assist-consent', 'consentAutoAdd:consent-auto-add', 'consentAutoEdit:consent-auto-edit',
      'consentOn:assist-consent-on', 'consentLater:assist-consent-later', 'status:assist-status', 'form:assist-form',
      'input:assist-input', 'send:assist-send',
      'assistantSheet:assistant-sheet', 'assistantHeading:assistant-sheet-title', 'enabled:assistant-enabled',
      'state:assistant-state', 'autoAdd:assistant-auto-add', 'autoEdit:assistant-auto-edit', 'log:assistant-log',
      'logEmpty:assistant-log-empty', 'left:assistant-left', 'disconnect:assistant-disconnect', 'disconnectNote:assistant-disconnect-note',
      'sheetStatus:assistant-status'
    ].forEach(pair => {
      const [key, id] = pair.split(':');
      els[key] = byId(id);
    });

    ctx.setupSheet(els.assistantSheet);
    els.strip.addEventListener('pointerdown', () => { stripTouched = true; });
    els.strip.addEventListener('click', onStripTap);
    els.form.addEventListener('submit', onSubmit);
    // Al primo tocco sul campo, prima del consenso: compaiono le due righe e i permessi (la tastiera non si apre).
    els.input.addEventListener('pointerdown', event => {
      if (isActive()) return;
      event.preventDefault();
      showConsent();
    });
    els.input.addEventListener('focus', () => { if (!isActive()) showConsent(); });
    els.consentOn.addEventListener('click', onConsentOn);
    els.consentLater.addEventListener('click', onConsentLater);
    els.settings.addEventListener('click', openAssistantSheet);
    els.enabled.addEventListener('change', onEnabledChange);
    els.autoAdd.addEventListener('change', () => setAssistantPrefs({ autoAdd: els.autoAdd.checked }));
    els.autoEdit.addEventListener('change', () => setAssistantPrefs({ autoEdit: els.autoEdit.checked }));
    els.disconnect.addEventListener('click', onDisconnect);

    useCachedOpen(); // una copia valida si mostra già al primo disegno, senza rete
    // La richiesta all'apertura parte dopo il caricamento, a pagina visibile.
    const start = () => setTimeout(openProposal, 300);
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    // Tornando in Aura dopo almeno 30 minuti è come una nuova apertura.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt && Date.now() - hiddenAt >= A.ASSISTANT.open.returnMs) {
        aiStrip = null;
        stripTouched = false; // è una nuova apertura
        useCachedOpen();
        renderStrip();
        openProposal();
      }
      hiddenAt = 0;
    });

    return {
      renderStrip,
      takesSiri,
      handleSiri,
      forget,
      isActive,
      /** Il foglio «Aura» si è chiuso: la striscia segue l'ultima scelta di tempo ed energia. */
      sheetClosed(dialog) {
        if (dialog === els.sheet) {
          resetTop();
          renderStrip();
        }
      },
      /** Il foglio «Aura» si apre (anche senza passare dalla striscia). */
      sheetOpening() {
        resetTop();
        syncSheet();
      },
      syncSheet
    };
  }

  Aura.assistantUI = { init };
})(window.Aura = window.Aura || {});
