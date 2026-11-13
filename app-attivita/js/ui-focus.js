/*
 * Aura Tasks — fogli «Cosa faccio adesso?» e Focus a tutto schermo.
 * Tocca la pagina come app.js, che con init() gli passa quello che serve: stato, commit, fogli, avvisi, preferenze.
 * La logica sta in js/suggest.js e js/focus.js; il focus in corso si salva con Aura.storage (aura-tasks:focus),
 * così ricaricando la pagina riprende.
 */
(function (Aura) {
  'use strict';

  const { utils, tasks: T, suggest: SG, focus: F, storage, motion: M } = Aura;

  const byId = id => document.getElementById(id);
  const TICK_MS = 250;           // aggiornamento del tempo, solo a pagina visibile (il tempo vero viene da Date.now())
  const RING = 2 * Math.PI * 54; // lunghezza dell'anello: r = 54 nel viewBox (vedi .focus__arc in style.css)
  const LATE_CHIME_MS = 5000;    // se la fine è passata da più di così (pagina nascosta), niente suono al ritorno
  // Suono di fine: tre note brevi, generate con Web Audio (nessun file). [frequenza in Hz, partenza in secondi]
  const CHIME = { notes: [[660, 0], [880, 0.18], [1320, 0.36]], volume: 0.22, attack: 0.02, length: 0.6 };
  const VIBRATION = [180, 90, 180]; // solo Android: su iPhone navigator.vibrate non esiste
  // Respiro dello sfondo: dopo l'apertura si guardano 24 fotogrammi; se più della metà dura oltre 45 ms (meno di circa
  // 22 al secondo), su questo dispositivo lo sfondo pesa troppo e resta fermo.
  const BREATH = { warmupMs: 600, frames: 24, slowMs: 45 };

  let ctx = null;
  const els = {};

  /* ---------- «Cosa faccio adesso?» ---------- */

  let excluded = []; // id già proposti mentre il foglio è aperto («Un'altra proposta»)
  let first = null;  // attività da proporre per prima: quella scritta nella striscia, un'alternativa toccata, quella dell'IA
  let firstReason = null; // il suo motivo, se viene dalla striscia o dall'IA (altrimenti quello delle regole)
  let forced = null; // la più breve, proposta a mano quando non c'è niente di adatto
  let saidChoice = null; // tempo ed energia detti all'assistente ({ minutes, energy }): valgono finché il foglio è aperto
  let shownProposal = null; // attività della proposta principale mostrata adesso
  let noneAction = null;    // cosa fa il pulsante del messaggio «niente da proporre»

  /** La scelta che vale adesso: quella detta all'assistente in questo foglio, altrimenti l'ultima salvata. */
  const currentChoice = () => saidChoice || ctx.getPrefs().suggest;

  /**
   * Apre il foglio. Opzioni (dalla striscia): taskId e reason fissano la proposta su quella già scritta nella striscia,
   * così il foglio mostra la stessa attività con lo stesso motivo; `focus` è l'elemento che riceve il focus.
   */
  function openSuggest({ taskId = null, reason = null, focus = null } = {}) {
    excluded = [];
    first = taskId;
    firstReason = reason;
    forced = null;
    saidChoice = null;
    syncChoice();
    updateSuggestion();
    if (ctx.onSuggestOpening) ctx.onSuggestOpening(); // l'assistente azzera la sua parte del foglio (js/ui-assistant.js)
    ctx.setAutofocus(els.suggestSheet, focus || els.suggestHeading);
    ctx.openSheet(els.suggestSheet);
  }

  /** Chip del tempo e livello di energia secondo la scelta che vale adesso. Minuti detti senza chip: nessun chip premuto. */
  function syncChoice() {
    const { minutes, energy } = currentChoice();
    const pressed = minutes === null ? 'open' : String(minutes);
    els.suggestMinutes.querySelectorAll('[data-minutes]').forEach(chip => {
      chip.setAttribute('aria-pressed', String(chip.dataset.minutes === pressed));
    });
    const said = saidChoice && minutes !== null && !SG.SUGGEST.minutes.includes(minutes);
    els.suggestSaid.hidden = !said;
    els.suggestSaid.textContent = said ? '· hai detto ' + SG.minutesLabel(minutes) : '';
    const radio = els.suggestSheet.querySelector('input[name="suggest-energy"][value="' + energy + '"]');
    if (radio) radio.checked = true;
  }

  function saveChoice(change) {
    ctx.setPrefs({ suggest: { ...currentChoice(), ...change } });
    saidChoice = null; // un chip toccato vale più di ciò che era stato detto
    syncChoice();
    first = null;
    firstReason = null;
    forced = null;
    updateSuggestion();
  }

  /** Ricalcola la proposta (logica in js/suggest.js) e la mostra; senza proposte, un messaggio gentile. */
  function updateSuggestion() {
    const state = ctx.getState();
    const now = Date.now();
    const today = utils.todayISO(now);
    const { minutes, energy } = currentChoice();
    let result = SG.suggest(state.tasks, { minutes, energy, today, now, exclude: excluded, first });

    const forcedTask = forced && state.tasks.find(task => task.id === forced && !task.done);
    if (forcedTask) {
      result = { best: { task: forcedTask, reason: 'È la più breve da fare adesso' }, alternatives: [], fallback: null };
    } else if (first && firstReason && result.best && result.best.task.id === first) {
      result = { ...result, best: { ...result.best, reason: firstReason } }; // il motivo scritto nella striscia o detto dall'IA
    }

    els.suggestResult.hidden = !result.best;
    els.suggestNone.hidden = Boolean(result.best);
    shownProposal = result.best ? result.best.task : null;
    if (result.best) showProposal(result.best, result.alternatives, today);
    else showNoProposal(result.fallback);
  }

  function showProposal(best, alternatives, today) {
    const { task } = best;
    els.suggestReason.textContent = best.reason;
    els.suggestTitle.textContent = task.title;
    els.suggestDuration.textContent = utils.formatDuration(task.duration);
    els.suggestEnergy.className = 'pill pill--' + task.energy;
    els.suggestEnergy.querySelector('.energy-bars').setAttribute('data-level', T.ENERGY[task.energy].order);
    els.suggestEnergyText.textContent = T.ENERGY[task.energy].label;
    // Il giorno si dice solo se conta: in ritardo, oppure oggi a un'ora precisa.
    const late = task.date && task.date < today;
    els.suggestWhen.hidden = !late && !(task.date === today && task.time);
    els.suggestWhen.classList.toggle('meta--overdue', Boolean(late) || T.isTimePassed(task, Date.now())); // rossa anche l'ora già passata
    const label = late ? utils.formatDateLabel(task.date, today) : '';
    els.suggestWhenText.textContent = late ? 'In ritardo · ' + label.charAt(0).toLowerCase() + label.slice(1) : 'Oggi alle ' + task.time;

    els.suggestAltsBox.hidden = alternatives.length === 0;
    els.suggestAlts.replaceChildren(...alternatives.map(item => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'alt';
      button.dataset.id = item.task.id;
      button.setAttribute('aria-label', 'Proponi invece: ' + item.task.title + ', ' + utils.formatDuration(item.task.duration));
      const title = document.createElement('span');
      title.className = 'alt__title';
      title.textContent = item.task.title;
      const time = document.createElement('span');
      time.className = 'alt__time';
      time.textContent = utils.formatDuration(item.task.duration);
      button.append(title, time);
      li.appendChild(button);
      return li;
    }));
  }

  /** Niente da proporre: perché, e che cosa fare al posto della proposta (vedi fallback in js/suggest.js). */
  function showNoProposal(fallback) {
    const kind = fallback ? fallback.kind : 'rest';
    let title = 'Una pausa ☕?';
    let text = 'Per adesso non c\'è niente da fare: goditi una pausa.';
    let action = null;
    if (kind === 'exhausted') {
      title = 'Le hai viste tutte';
      text = 'Non ci sono altre proposte con questo tempo e questa energia.';
      action = { label: 'Ricomincia', run: () => { excluded = []; updateSuggestion(); } };
    } else if (kind === 'more-time') {
      const minutes = fallback.minutes;
      const label = minutes === null ? '120 minuti o più' : SG.minutesLabel(minutes);
      title = 'Hai più tempo?';
      text = 'Con ' + label + ' c\'è «' + fallback.task.title + '» (' + utils.formatDuration(fallback.task.duration) + ').';
      action = { label: 'Ho ' + label, run: () => saveChoice({ minutes }) };
    } else if (fallback && fallback.task) {
      text = 'Con questa energia non c\'è niente di adatto. La più breve è «' + fallback.task.title + '» (' +
        utils.formatDuration(fallback.task.duration) + ', energia ' + T.ENERGY[fallback.task.energy].label.toLowerCase() + ').';
      const id = fallback.task.id;
      action = { label: 'Proponimela lo stesso', run: () => { forced = id; updateSuggestion(); } };
    }
    els.suggestNoneTitle.textContent = title;
    els.suggestNoneText.textContent = text;
    els.suggestNoneAction.hidden = !action;
    els.suggestNoneAction.textContent = action ? action.label : '';
    noneAction = action ? action.run : null;
  }

  function onStartFromSuggestion() {
    const task = shownProposal;
    if (!task) return;
    unlockAudio(); // dentro il tocco: altrimenti iPhone non lascia suonare alla fine
    ctx.closeSheet(els.suggestSheet);
    startFocus(task.id);
  }

  /** «Fatto»: il foglio si chiude e l'attività si completa come con la spunta, con punti e «Annulla». */
  function onDoneFromSuggestion() {
    const task = shownProposal;
    if (!task) return;
    ctx.closeSheet(els.suggestSheet);
    ctx.completeTask(task.id, { delay: M.ms('exit') });
  }

  function onNextSuggestion() {
    if (shownProposal) excluded.push(shownProposal.id);
    first = null;
    firstReason = null;
    forced = null;
    updateSuggestion();
  }

  /* ---------- Per l'assistente (js/ui-assistant.js) ---------- */

  /** La proposta dell'IA (già controllata: è tra le candidate) diventa quella del foglio, con il suo motivo. */
  function showSuggested({ taskId, reason = null }) {
    first = taskId;
    firstReason = reason;
    forced = null;
    updateSuggestion();
  }

  /** Tempo ed energia detti all'assistente: `use` vale per la proposta di adesso, `save` va nelle preferenze. */
  function setSessionChoice(use, save) {
    ctx.setPrefs({ suggest: { ...ctx.getPrefs().suggest, ...save } });
    saidChoice = { minutes: use.minutes, energy: use.energy };
    first = null;
    firstReason = null;
    forced = null;
    syncChoice();
    updateSuggestion();
  }

  /** La proposta delle regole per la striscia: con l'ultima scelta salvata e senza caso, così è sempre la stessa. */
  function ruleProposal() {
    const now = Date.now();
    const { minutes, energy } = ctx.getPrefs().suggest;
    const best = SG.suggest(ctx.getState().tasks, { minutes, energy, today: utils.todayISO(now), now, random: () => 0.5 }).best;
    return best ? { task: best.task, reason: best.reason } : null;
  }

  /** Dopo una modifica fatta dall'assistente con il foglio aperto: la proposta si ricalcola. */
  function refreshSuggestion() {
    if (els.suggestSheet.open) updateSuggestion();
  }

  const isSuggestOpen = () => els.suggestSheet.open;
  const setSuggestTitle = text => { els.suggestHeading.textContent = text; };

  /* ---------- Focus a tutto schermo ---------- */

  let session = null;   // focus in corso: { taskId, startedAt, durationMs, pausedAt, pausedTotalMs }
  let ticker = null;
  let wakeLock = null;
  let wakeRequest = null;
  let audio = null;
  let ended = false;    // la fine del tempo è già stata segnalata (suono, vibrazione)
  const shown = {};     // testi già scritti nel foglio: si riscrive solo ciò che cambia

  const taskOf = current => (current ? ctx.getState().tasks.find(task => task.id === current.taskId) || null : null);

  /** «Inizia focus» (nella proposta di «Cosa faccio adesso?» o nel foglio di un'attività): una sessione per volta. Va chiamata dentro il tocco (sblocca l'audio). */
  function startFocus(id) {
    const task = ctx.getState().tasks.find(item => item.id === id);
    if (!task || task.done) return;
    unlockAudio();
    if (session && session.taskId === id) {
      openFocusSheet();
      return;
    }
    // Un'altra attività: la sessione di prima si chiude, e i suoi minuti restano.
    if (session) recordMinutes(endSession());
    session = F.start(task, Date.now());
    ended = false;
    storage.saveFocus(session);
    openFocusSheet();
  }

  function openFocusSheet() {
    if (!session) return;
    Object.keys(shown).forEach(key => { delete shown[key]; });
    renderFocus();
    ctx.setAutofocus(els.focusSheet, els.focusTitle);
    ctx.openSheet(els.focusSheet);
    syncRunning();
    if (F.isFinished(session, Date.now())) onTimeUp(); // finito mentre Aura era chiusa: si mostra la fine
  }

  /** Scrive un testo solo se è cambiato (il tempo si aggiorna 4 volte al secondo). */
  function write(key, el, text) {
    if (shown[key] === text) return;
    shown[key] = text;
    el.textContent = text;
  }

  function renderFocus() {
    if (!session) return;
    const now = Date.now();
    const task = taskOf(session);
    const remaining = F.remainingMs(session, now);
    const finished = remaining <= 0;
    const paused = F.isPaused(session);

    write('title', els.focusTitle, task ? task.title : '');
    write('meta', els.focusMeta, task ? utils.formatDuration(task.duration) + ' · energia ' + T.ENERGY[task.energy].label.toLowerCase() : '');
    const clock = F.clockLabel(remaining);
    if (shown.clock !== clock) {
      write('clock', els.focusClock, clock);
      // L'anello si accorcia a scatti, una volta al secondo, senza transizioni.
      els.focusArc.style.strokeDashoffset = String(RING * (1 - remaining / session.durationMs));
    }
    let state = 'Fino alle ' + utils.formatTime(new Date(F.endsAt(session) || now));
    if (finished) state = 'Tempo finito ✨';
    else if (paused) state = 'In pausa';
    write('state', els.focusState, state);
    write('toggle', els.focusToggleText, paused ? 'Riprendi' : 'Pausa');
    write('complete', els.focusCompleteText, finished ? 'Completata' : 'Completa');
    if (shown.icon !== String(paused)) {
      shown.icon = String(paused);
      els.focusToggleIcon.setAttribute('href', paused ? '#i-play' : '#i-pause');
    }
    els.focusToggle.hidden = finished;
    els.focusSheet.classList.toggle('is-paused', paused && !finished);
    els.focusSheet.classList.toggle('is-finished', finished);
  }

  /** Decide se il tempo va aggiornato, se lo schermo va tenuto acceso e se l'aura respira. */
  function syncRunning() {
    const visible = els.focusSheet.open && !els.focusSheet.classList.contains('is-closing') && !document.hidden;
    const running = Boolean(session) && visible && !F.isPaused(session) && !F.isFinished(session, Date.now());
    if (running) {
      if (!ticker) ticker = setInterval(tick, TICK_MS);
      requestWakeLock();
    } else {
      clearInterval(ticker);
      ticker = null;
      releaseWakeLock();
    }
    const breathe = running && M.canAnimate() && breathFits !== false;
    els.focusSheet.classList.toggle('is-breathing', breathe);
    if (breathe) watchBreath();
  }

  let breathFits = null; // null = da misurare; false = lo sfondo che respira pesa troppo qui, e resta fermo
  let breathTimer = 0;

  /**
   * Misura una volta sola se il dispositivo regge lo sfondo che respira: conta i fotogrammi lenti a regime, dopo
   * l'apertura del foglio. Un fotogramma lungo isolato (pagina tornata dallo sfondo) non conta: serve la maggioranza.
   */
  function watchBreath() {
    if (breathFits !== null || breathTimer) return;
    breathTimer = setTimeout(() => {
      let last = 0;
      let count = 0;
      let slow = 0;
      const tick = now => {
        if (!els.focusSheet.classList.contains('is-breathing')) { // fermato nel frattempo: si misura la prossima volta
          breathTimer = 0;
          return;
        }
        if (last) {
          count++;
          if (now - last > BREATH.slowMs) slow++;
        }
        last = now;
        if (count < BREATH.frames) {
          requestAnimationFrame(tick);
          return;
        }
        breathTimer = 0;
        breathFits = slow <= BREATH.frames / 2;
        if (!breathFits) syncRunning();
      };
      requestAnimationFrame(tick);
    }, BREATH.warmupMs);
  }

  function tick() {
    if (!session) return;
    renderFocus();
    if (F.isFinished(session, Date.now())) onTimeUp();
  }

  /** Fine del tempo: suono e vibrazione (una volta sola), poi «Completata» oppure «+5 min». */
  function onTimeUp() {
    if (!session) return;
    renderFocus();
    if (!ended) {
      ended = true;
      const late = Date.now() - F.endsAt(session);
      if (late < LATE_CHIME_MS && !document.hidden) {
        chime();
        ctx.vibrate(VIBRATION);
      }
      if (els.focusSheet.open) els.focusComplete.focus({ preventScroll: true });
    }
    syncRunning();
  }

  function togglePause() {
    if (!session) return;
    const now = Date.now();
    if (F.isFinished(session, now)) return;
    session = F.isPaused(session) ? F.resume(session, now) : F.pause(session, now);
    storage.saveFocus(session);
    renderFocus();
    syncRunning();
  }

  function extendFocus() {
    if (!session) return;
    unlockAudio();
    session = F.extend(session, Date.now());
    ended = false;
    storage.saveFocus(session);
    renderFocus();
    syncRunning();
  }

  /** Chiude la sessione: { minutes, day } da registrare e la sessione di prima (per «Annulla»). */
  function endSession() {
    const previous = session;
    const result = F.sessionResult(previous, Date.now());
    session = null;
    ended = false;
    storage.clearFocus();
    syncRunning();
    return { ...result, previous };
  }

  /** Registra i minuti di una sessione chiusa; restituisce quanti ne sono entrati davvero (per «Annulla»). */
  function recordMinutes(result) {
    if (!result.minutes) return 0;
    const state = ctx.getState();
    const before = F.minutesOn(state.stats, result.day);
    const stats = F.recordMinutes(state.stats, result.day, result.minutes);
    const applied = F.minutesOn(stats, result.day) - before;
    if (applied) ctx.commit(state.tasks, stats);
    return applied;
  }

  /** «Esci», Esc o «indietro»: la sessione si chiude e i minuti restano. «Annulla» la riapre com'era. */
  function exitFocus() {
    if (!session) {
      ctx.closeSheet(els.focusSheet);
      return;
    }
    const result = endSession();
    ctx.closeSheet(els.focusSheet);
    const applied = recordMinutes(result);
    ctx.showToast(applied ? 'Focus terminato · ' + utils.formatDuration(applied) : 'Focus terminato', {
      action: 'Annulla',
      onAction: () => undoExit(result.previous, result.day, applied)
    });
  }

  function undoExit(previous, day, applied) {
    const task = taskOf(previous);
    if (session || !task || task.done) return; // nel frattempo è cambiato qualcosa: non si torna indietro
    if (applied) {
      const state = ctx.getState();
      ctx.commit(state.tasks, F.recordMinutes(state.stats, day, -applied));
    }
    session = previous;
    ended = false;
    storage.saveFocus(session);
    openFocusSheet();
  }

  /** «Completa» (o «Completata» a tempo finito): l'attività si completa con i suoi punti e i minuti di focus. */
  function completeFocus() {
    if (!session) return;
    const result = endSession();
    ctx.closeSheet(els.focusSheet);
    const done = ctx.completeTask(result.previous.taskId, { delay: M.ms('exit'), focus: { minutes: result.minutes, day: result.day } });
    if (!done) recordMinutes(result); // già completata altrove: restano i minuti
  }

  /** Dopo ogni modifica dei dati: se l'attività del focus è stata completata o eliminata, la sessione si chiude. */
  function sync() {
    if (!session) return;
    const task = taskOf(session);
    if (task && !task.done) {
      if (els.focusSheet.open) renderFocus();
      return;
    }
    const result = endSession();
    if (els.focusSheet.open) ctx.closeSheet(els.focusSheet);
    recordMinutes(result);
  }

  /** All'avvio: un focus rimasto aperto riprende (anche dopo aver ricaricato la pagina). */
  function resume() {
    session = storage.loadFocus();
    if (!session) return;
    const task = taskOf(session);
    if (!task || task.done) {
      recordMinutes(endSession());
      return;
    }
    openFocusSheet();
  }

  /* ---------- Schermo acceso e suono di fine ---------- */

  function requestWakeLock() {
    if (wakeLock || wakeRequest || !('wakeLock' in navigator) || document.hidden) return;
    wakeRequest = navigator.wakeLock.request('screen').then(lock => {
      wakeRequest = null;
      // Nel frattempo il focus si è fermato: lo schermo non serve più acceso.
      if (!ticker) {
        lock.release().catch(() => {});
        return;
      }
      wakeLock = lock;
      lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null; });
    }, () => {
      wakeRequest = null; // non permesso (per esempio a batteria scarica): si continua lo stesso
    });
  }

  function releaseWakeLock() {
    const lock = wakeLock;
    wakeLock = null;
    if (lock) lock.release().catch(() => {});
  }

  /**
   * Crea l'audio appena il dito tocca un pulsante che avvia il focus (pointerdown), prima del tocco vero e proprio.
   * Creare l'AudioContext costa (a freddo anche 200 ms): così il lavoro cade mentre il dito è ancora giù, e l'apertura
   * del focus non perde fotogrammi. Nasce "sospeso": lo sblocca unlockAudio(), dentro il tocco.
   */
  function prepareAudio() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context || audio) return;
    try {
      audio = new Context();
    } catch (err) {
      audio = null;
    }
  }

  /** Crea (se manca) e sblocca l'audio: va fatto dentro un tocco, altrimenti iPhone non lascia suonare dopo. */
  function unlockAudio() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    try {
      if (!audio) audio = new Context();
      resumeAudio();
      const silence = audio.createBufferSource(); // un suono vuoto: su iPhone apre l'uscita audio
      silence.buffer = audio.createBuffer(1, 1, 22050);
      silence.connect(audio.destination);
      silence.start(0);
    } catch (err) {
      audio = null; // niente audio: alla fine resta la scritta «Tempo finito»
    }
  }

  /**
   * Riprende l'audio se non sta suonando. Non basta «suspended»: su iPhone, dopo essere usciti e rientrati,
   * Safari può lasciarlo «interrupted» (WebKit bug 263627 e 273511), e allora resta muto finché non si chiama resume().
   */
  function resumeAudio() {
    if (audio.state !== 'running') audio.resume().catch(() => {});
  }

  function chime() {
    if (!audio) return;
    try {
      resumeAudio();
      const start = audio.currentTime + 0.05;
      CHIME.notes.forEach(([frequency, offset]) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const at = start + offset;
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(CHIME.volume, at + CHIME.attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + CHIME.length);
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start(at);
        oscillator.stop(at + CHIME.length + 0.05);
      });
    } catch (err) {
      // Niente suono: resta la scritta «Tempo finito».
    }
  }

  /* ---------- Avvio ---------- */

  function init(context) {
    ctx = context;
    [
      'suggestSheet:suggest-sheet', 'suggestHeading:suggest-sheet-title', 'suggestMinutes:suggest-minutes', 'suggestSaid:suggest-said',
      'suggestResult:suggest-result', 'suggestReason:suggest-reason', 'suggestTitle:suggest-title',
      'suggestWhen:suggest-when', 'suggestWhenText:suggest-when-text', 'suggestDuration:suggest-duration',
      'suggestEnergy:suggest-energy', 'suggestEnergyText:suggest-energy-text', 'suggestStart:suggest-start',
      'suggestDone:suggest-done', 'suggestNext:suggest-next', 'suggestAltsBox:suggest-alts-box', 'suggestAlts:suggest-alts',
      'suggestNone:suggest-none', 'suggestNoneTitle:suggest-none-title', 'suggestNoneText:suggest-none-text',
      'suggestNoneAction:suggest-none-action',
      'focusSheet:focus-sheet', 'focusTitle:focus-title', 'focusMeta:focus-meta', 'focusArc:focus-arc',
      'focusClock:focus-clock', 'focusState:focus-state', 'focusToggle:focus-toggle', 'focusToggleIcon:focus-toggle-icon',
      'focusToggleText:focus-toggle-text', 'focusExtend:focus-extend', 'focusComplete:focus-complete',
      'focusCompleteText:focus-complete-text', 'focusExit:focus-exit'
    ].forEach(pair => {
      const [key, id] = pair.split(':');
      els[key] = byId(id);
    });

    ctx.setupSheet(els.suggestSheet);
    // Il focus non si chiude toccando fuori (è a tutto schermo): Esc e «indietro» valgono «Esci».
    ctx.setupSheet(els.focusSheet, { onCancel: exitFocus, backdropClose: false });

    els.suggestMinutes.addEventListener('click', event => {
      const chip = event.target.closest('[data-minutes]');
      if (chip) saveChoice({ minutes: chip.dataset.minutes === 'open' ? null : Number(chip.dataset.minutes) });
    });
    els.suggestSheet.addEventListener('change', event => {
      if (event.target.name === 'suggest-energy') saveChoice({ energy: event.target.value });
    });
    els.suggestStart.addEventListener('pointerdown', prepareAudio);
    els.suggestStart.addEventListener('click', onStartFromSuggestion);
    els.suggestDone.addEventListener('click', onDoneFromSuggestion);
    els.suggestNext.addEventListener('click', onNextSuggestion);
    els.suggestAlts.addEventListener('click', event => {
      const button = event.target.closest('.alt');
      if (!button) return;
      first = button.dataset.id;
      firstReason = null;
      updateSuggestion();
      els.suggestStart.focus({ preventScroll: true });
    });
    els.suggestNoneAction.addEventListener('click', () => { if (noneAction) noneAction(); });

    els.focusToggle.addEventListener('click', togglePause);
    els.focusExtend.addEventListener('click', extendFocus);
    els.focusComplete.addEventListener('click', completeFocus);
    els.focusExit.addEventListener('click', exitFocus);
    // Riaprendo Aura con un focus in corso l'audio non è sbloccato: basta un tocco qualsiasi nel foglio
    // (touchend e click: su iPhone l'inizio del tocco non vale come gesto per l'audio).
    els.focusSheet.addEventListener('touchend', unlockAudio, { passive: true });
    els.focusSheet.addEventListener('click', unlockAudio);
    els.focusSheet.addEventListener('close', syncRunning);

    // Al ritorno nell'app (o a schermo sbloccato) il tempo si ricalcola dagli istanti: i timer di iPhone erano fermi.
    document.addEventListener('visibilitychange', () => {
      if (!session) return;
      if (!document.hidden) {
        renderFocus();
        if (F.isFinished(session, Date.now())) onTimeUp();
      }
      syncRunning();
    });

    return {
      openSuggest, startFocus, prepareAudio, sync, resume,
      // per l'assistente
      showSuggested, setSessionChoice, ruleProposal, refreshSuggestion, isSuggestOpen, setSuggestTitle, currentChoice
    };
  }

  Aura.focusUI = { init };
})(window.Aura = window.Aura || {});
