/*
 * Aura Tasks — interfaccia.
 * Unico file che tocca la pagina: disegna la lista partendo da `state` e trasforma i gesti
 * dell'utente in chiamate ad Aura.tasks, Aura.points e Aura.storage. Ogni modifica passa da commit().
 * Promemoria e casella di Siri (facoltativi) passano da Aura.remote, che parla con il server di Aura.
 */
(function (Aura) {
  'use strict';

  const { utils, tasks: T, nlp, points: P, storage, theme, reminders: RM, remote: R } = Aura;

  const byId = id => document.getElementById(id);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(pointer: fine)');

  const els = {
    hero: byId('hero'),
    scrim: byId('statusbar-scrim'),
    greeting: byId('greeting'),
    today: byId('today-label'),
    statOpen: byId('stat-open'),
    statTime: byId('stat-time'),
    statDone: byId('stat-done'),
    statStreak: byId('stat-streak'),
    streakValue: byId('streak-value'),
    streakRecord: byId('streak-record'),
    streakRecordText: byId('streak-record-text'),
    streakNote: byId('streak-note'),
    streakProgress: byId('streak-progress'),
    statPoints: byId('stat-points'),
    pointsValue: byId('points-value'),
    pointsToday: byId('points-today'),
    main: byId('main'),
    sections: byId('sections'),
    empty: byId('empty-state'),
    emptyTitle: byId('empty-title'),
    emptyText: byId('empty-text'),
    completed: byId('completed'),
    completedCount: byId('completed-count'),
    completedList: byId('completed-list'),
    clearCompleted: byId('clear-completed'),
    addButton: byId('add-button'),
    addSheet: byId('add-sheet'),
    addHeading: byId('add-sheet-title'),
    form: byId('add-form'),
    phrase: byId('task-phrase'),
    phraseSummary: byId('phrase-summary'),
    title: byId('task-title'),
    duration: byId('task-duration'),
    durationChips: byId('duration-chips'),
    energyHint: byId('energy-hint'),
    dateChips: byId('date-chips'),
    datePicker: byId('date-picker'),
    dateInput: byId('task-date'),
    dateLabel: byId('date-label'),
    timeField: byId('time-field'),
    timePicker: byId('time-picker'),
    timeInput: byId('task-time'),
    timeLabel: byId('time-label'),
    timeClear: byId('time-clear'),
    timeHint: byId('time-hint'),
    themeButton: byId('theme-button'),
    themeSheet: byId('theme-sheet'),
    themeHeading: byId('theme-sheet-title'),
    inboxNote: byId('inbox-note'),
    inboxNoteText: byId('inbox-note-text'),
    footnoteText: byId('footnote-text'),
    remoteButton: byId('remote-button'),
    remoteSheet: byId('remote-sheet'),
    remoteHeading: byId('remote-sheet-title'),
    remoteNotice: byId('remote-notice'),
    reminderStatus: byId('reminder-status'),
    reminderLeads: byId('reminder-leads'),
    reminderOn: byId('reminder-on'),
    reminderTest: byId('reminder-test'),
    reminderOff: byId('reminder-off'),
    siriStatus: byId('siri-status'),
    siriSetup: byId('siri-setup'),
    siriDetails: byId('siri-details'),
    siriUrl: byId('siri-url'),
    siriAuth: byId('siri-auth'),
    siriShow: byId('siri-show'),
    remoteDisconnect: byId('remote-disconnect'),
    toast: byId('toast'),
    toastText: byId('toast-text'),
    toastAction: byId('toast-action'),
    taskTemplate: byId('task-template')
  };

  const THEME_LABELS = { auto: 'Automatico', light: 'Chiaro', dark: 'Scuro' };
  const DATED_SECTIONS = ['overdue', 'upcoming']; // nelle altre sezioni la data è già nel titolo
  const ERROR_FIELDS = ['title', 'duration', 'energy', 'date', 'time'];
  const FIELD_INPUTS = { title: els.title, duration: els.duration, date: els.dateInput, time: els.timeInput };

  const loaded = storage.load();
  let state = loaded.state;
  let renderedDay = null;
  let highlightId = null; // attività appena aggiunta, da evidenziare al prossimo disegno
  const busy = new Set(); // attività in animazione: i doppi tocchi vengono ignorati
  let remote = R.load(); // collegamento al server: codice del dispositivo, promemoria, frasi di Siri in coda

  /* ---------- Stato ---------- */

  /**
   * Applica un nuovo elenco (e il registro dei punti, se cambia): salva e ridisegna.
   * Restituisce false (e avvisa) se il salvataggio non riesce.
   */
  function commit(nextTasks, nextStats = state.stats) {
    state = { ...state, tasks: nextTasks, stats: nextStats };
    const saved = storage.save(state);
    render();
    if (!saved) showToast('Impossibile salvare: la memoria del browser è piena o disattivata.', { duration: 6000 });
    scheduleReminderSync(); // con i promemoria spenti non fa nulla
    return saved;
  }

  /* ---------- Disegno ---------- */

  function render() {
    const now = new Date();
    const today = utils.toISODate(now);
    const hadFocus = els.main.contains(document.activeElement) && document.activeElement !== els.main;
    const { sections, completed } = T.groupTasks(state.tasks, today);

    renderHeader(now, today);
    renderSections(sections, today);
    renderCompleted(completed, today);
    renderEmpty(sections.length === 0, completed.length, today);

    // Se l'elemento che aveva il focus è stato ridisegnato, il focus resta nella lista (utile da tastiera).
    if (hadFocus && !els.main.contains(document.activeElement)) els.main.focus({ preventScroll: true });
    renderedDay = today;
    highlightId = null;
  }

  function renderHeader(now, today) {
    const summary = T.summarize(state.tasks);
    const todayTotals = P.dayTotals(state.stats, today);
    els.greeting.textContent = utils.greeting(now);
    els.today.textContent = utils.formatLongDate(now);
    els.statOpen.textContent = summary.openCount;
    els.statTime.textContent = utils.formatDuration(summary.openMinutes);
    els.statDone.textContent = todayTotals.done; // dal registro: "Svuota" non lo azzera
    renderRewards(today, todayTotals);
  }

  const daysLabel = count => (count === 1 ? '1 giorno' : count + ' giorni');

  /** Riquadri della serie (accesa se oggi c'è già un completamento) e dei punti. */
  function renderRewards(today, todayTotals) {
    const { stats } = state;
    const streak = P.currentStreak(stats.days, today);
    const lit = todayTotals.done > 0;
    const next = P.nextMilestone(streak);
    const isRecord = streak >= 3 && streak >= stats.bestStreak;

    els.statStreak.classList.toggle('is-lit', lit);
    els.streakValue.textContent = daysLabel(streak);
    els.streakRecord.hidden = !isRecord && !(stats.bestStreak > streak && stats.bestStreak >= 2);
    els.streakRecordText.textContent = isRecord ? 'record!' : 'record ' + stats.bestStreak;
    els.streakProgress.style.transform = 'scaleX(' + (next ? streak / next : 1) + ')';
    if (!lit) els.streakNote.textContent = streak > 0 ? 'Tienila accesa oggi' : 'Accendila oggi';
    else els.streakNote.textContent = next ? 'Traguardo: ' + daysLabel(next) : 'Tutti i traguardi!';

    els.pointsToday.textContent = '+' + utils.formatNumber(todayTotals.points) + ' oggi';
    showPoints(stats.totalPoints);
  }

  let shownPoints = null; // valore mostrato nel riquadro dei punti
  let countFrame = 0;
  let countTimer = null;

  /** Aggiorna il totale dei punti contando (circa 0,65 s), così si vede salire. */
  function showPoints(total) {
    const from = shownPoints;
    shownPoints = total;
    cancelAnimationFrame(countFrame);
    clearTimeout(countTimer);
    const show = value => { els.pointsValue.textContent = utils.formatNumber(value); };
    if (from === null || from === total || reducedMotion.matches || document.hidden) {
      show(total);
      return;
    }
    let start = null;
    const step = now => {
      // Si parte dal primo fotogramma: misurare l'inizio con un altro orologio può dare tempi negativi.
      if (start === null) start = now;
      const progress = Math.min(1, (now - start) / 650);
      show(Math.round(from + (total - from) * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) countFrame = requestAnimationFrame(step);
    };
    countFrame = requestAnimationFrame(step);
    // Rete di sicurezza: se i fotogrammi si fermano (pagina in background), il valore finale arriva lo stesso.
    countTimer = setTimeout(() => {
      cancelAnimationFrame(countFrame);
      show(total);
    }, 800);
  }

  function renderSections(sections, today) {
    const fragment = document.createDocumentFragment();
    sections.forEach(section => {
      const el = document.createElement('section');
      el.className = 'section section--' + section.key;
      el.setAttribute('aria-labelledby', 'section-' + section.key);

      const header = document.createElement('div');
      header.className = 'section__header';
      const title = document.createElement('h2');
      title.className = 'section__title';
      title.id = 'section-' + section.key;
      title.textContent = section.title;
      const info = document.createElement('span');
      info.className = 'section__info';
      info.textContent = section.tasks.length + ' attività · ' + utils.formatDuration(section.minutes);
      header.append(title, info);

      const list = document.createElement('ul');
      list.className = 'task-list';
      const showDate = DATED_SECTIONS.includes(section.key);
      section.tasks.forEach(task => list.appendChild(buildTask(task, today, showDate)));

      el.append(header, list);
      fragment.appendChild(el);
    });
    els.sections.replaceChildren(fragment);
  }

  function renderCompleted(completed, today) {
    els.completed.hidden = completed.length === 0;
    els.completedCount.textContent = completed.length;
    els.completedList.replaceChildren(...completed.map(task => buildTask(task, today, false)));
  }

  function renderEmpty(isEmpty, completedCount, today) {
    els.empty.hidden = !isEmpty;
    if (!isEmpty) return;
    const allDone = completedCount > 0;
    const streak = P.currentStreak(state.stats.days, today);
    const lit = P.dayTotals(state.stats, today).done > 0;
    els.emptyTitle.textContent = allDone ? 'Hai fatto tutto! 🎉' : 'Tutto libero ✨';
    if (!allDone) els.emptyText.textContent = 'Aggiungi la tua prima attività con il pulsante qui sotto.';
    else if (lit && streak >= 2) els.emptyText.textContent = 'Serie di ' + daysLabel(streak) + ' 🔥: domani continuala.';
    else els.emptyText.textContent = 'Goditi il momento, oppure aggiungi una nuova attività.';
  }

  /** Card di un'attività, copiata dal <template> e riempita con textContent. */
  function buildTask(task, today, showDate) {
    const node = els.taskTemplate.content.firstElementChild.cloneNode(true);
    const energy = T.ENERGY[task.energy];
    node.dataset.id = task.id;
    node.classList.toggle('is-done', task.done);
    if (task.id === highlightId) node.classList.add('task--new');

    const checkbox = node.querySelector('.check__input');
    checkbox.checked = task.done;
    checkbox.setAttribute('aria-label', (task.done ? 'Segna come da fare: ' : 'Segna come completata: ') + task.title);

    node.querySelector('.task__title').textContent = task.title;
    if (task.time) node.querySelector('.meta__at').textContent = task.time;
    else node.querySelector('.meta--at').remove();
    node.querySelector('.meta__time').textContent = utils.formatDuration(task.duration);

    const pill = node.querySelector('.pill');
    pill.classList.add('pill--' + task.energy);
    pill.querySelector('.energy-bars').setAttribute('data-level', energy.order);
    pill.querySelector('.pill__text').textContent = energy.label;

    const dateMeta = node.querySelector('.meta--date');
    if (showDate && task.date) {
      dateMeta.querySelector('.meta__date').textContent = utils.formatDateLabel(task.date, today);
      dateMeta.classList.toggle('meta--overdue', task.date < today);
    } else {
      dateMeta.remove();
    }

    node.querySelector('.task__delete').setAttribute('aria-label', 'Elimina: ' + task.title);
    return node;
  }

  /* ---------- Azioni sulla lista ---------- */

  /** Esegue `fn` dopo `ms` millisecondi (il tempo di un'animazione), o subito se il movimento è ridotto. */
  function later(ms, fn) {
    if (reducedMotion.matches || ms <= 0) fn();
    else setTimeout(fn, ms);
  }

  function vibrate(ms) {
    if (typeof navigator.vibrate !== 'function') return; // iPhone: non disponibile
    try {
      navigator.vibrate(ms);
    } catch (err) {
      // Alcuni browser lo bloccano: non è importante.
    }
  }

  function onToggle(id, done, node) {
    if (busy.has(id)) return;
    busy.add(id);
    if (done) {
      vibrate(12);
      node.classList.add('task--completing');
      const task = state.tasks.find(t => t.id === id);
      if (task) floatPoints(P.pointsFor(task), node.querySelector('.check'));
    }
    later(done ? 450 : 0, () => {
      busy.delete(id);
      const firstToday = done && P.dayTotals(state.stats, utils.todayISO()).done === 0;
      const result = P.setDone(state, id, done, Date.now());
      if (result.tasks === state.tasks) return; // niente da cambiare
      if (!commit(result.tasks, result.stats) || !done) return;
      celebrate(id, result, firstToday);
    });
  }

  /** Dopo un completamento: avviso con i punti, e festa se la serie si accende o tocca un traguardo. */
  function celebrate(id, result, firstToday) {
    const milestone = result.reached.length ? Math.max(...result.reached) : 0;
    if (firstToday) flash(els.statStreak, 'is-igniting', 3200);
    if (milestone) {
      vibrate([20, 60, 30, 60, 50]);
      flash(els.statStreak, 'is-celebrating', 1100);
      const tile = els.statStreak.getBoundingClientRect();
      const tileVisible = tile.bottom > 0;
      burstConfetti(tileVisible ? tile.left + tile.width / 2 : window.innerWidth / 2, tileVisible ? tile.top + tile.height / 2 : 96);
    }

    const points = '+' + result.points + ' punti';
    let message = 'Completata · ' + points;
    if (milestone) message = '🎉 ' + daysLabel(milestone) + ' di fila! · ' + points;
    else if (firstToday) message = (result.streak === 1 ? '🔥 Serie iniziata · ' : '🔥 ' + daysLabel(result.streak) + ' di fila · ') + points;

    showToast(message, {
      action: 'Annulla',
      duration: milestone ? 6500 : undefined,
      onAction: () => {
        const undo = P.setDone(state, id, false, Date.now());
        commit(undo.tasks, undo.stats);
      }
    });
  }

  /** Aggiunge per un attimo una classe che fa partire un'animazione CSS, poi la toglie (così si può ripetere). */
  function flash(el, className, ms) {
    if (reducedMotion.matches) return;
    el.classList.remove(className);
    void el.offsetWidth; // ricomincia l'animazione se era già in corso
    el.classList.add(className);
    setTimeout(() => el.classList.remove(className), ms);
  }

  const canAnimate = () => !reducedMotion.matches && typeof Element.prototype.animate === 'function';

  /** "+24" che sale dalla spunta e, se l'intestazione si vede, vola nel riquadro dei punti. */
  function floatPoints(points, fromEl) {
    if (!canAnimate() || !fromEl) return;
    const from = fromEl.getBoundingClientRect();
    const target = els.statPoints.getBoundingClientRect();
    const toTile = target.bottom > 0 && target.top < window.innerHeight;
    const chip = document.createElement('div');
    chip.className = 'points-float';
    chip.setAttribute('aria-hidden', 'true');
    chip.textContent = '+' + points;
    chip.style.left = from.left + from.width / 2 + 'px';
    chip.style.top = from.top + from.height / 2 + 'px';
    document.body.appendChild(chip);

    // Stessa sequenza di funzioni in ogni fotogramma: l'interpolazione resta lineare anche su Safari.
    const frame = (x, y, scale, opacity, offset) =>
      ({ transform: 'translate(-50%, -50%) translate(' + x + 'px, ' + y + 'px) scale(' + scale + ')', opacity, offset });
    const dx = target.left + target.width / 2 - (from.left + from.width / 2);
    const dy = target.top + target.height / 2 - (from.top + from.height / 2);
    const animation = chip.animate([
      frame(0, 0, 0.5, 0, 0),
      frame(0, -34, 1.12, 1, 0.25),
      frame(0, -46, 1, 1, 0.45),
      toTile ? frame(dx, dy, 0.45, 0.2, 1) : frame(0, -84, 0.9, 0, 1)
    ], { duration: toTile ? 1050 : 900, easing: 'cubic-bezier(.45, 0, .25, 1)', fill: 'forwards' });

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      chip.remove();
      if (toTile) flash(els.statPoints, 'is-bumping', 650);
    };
    animation.finished.then(finish, finish);
    setTimeout(finish, 1500); // rete di sicurezza
  }

  const CONFETTI_PIECES = 28;

  /** Pioggia di coriandoli per i traguardi: dura poco più di un secondo, poi sparisce. */
  function burstConfetti(x, y) {
    if (!canAnimate()) return;
    const layer = document.createElement('div');
    layer.className = 'confetti';
    layer.setAttribute('aria-hidden', 'true');
    layer.style.left = x + 'px';
    layer.style.top = y + 'px';
    document.body.appendChild(layer);

    const animations = [];
    for (let i = 0; i < CONFETTI_PIECES; i++) {
      const piece = document.createElement('span');
      piece.className = 'confetti__piece';
      layer.appendChild(piece);
      const angle = (i / CONFETTI_PIECES) * Math.PI * 2 + Math.random() * 0.5;
      const distance = 60 + Math.random() * 80;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance * 0.8 - 30;
      const spin = (Math.random() < 0.5 ? -1 : 1) * (240 + Math.random() * 360);
      animations.push(piece.animate([
        { transform: 'translate(0px, 0px) rotate(0deg) scale(.6)', opacity: 1 },
        { transform: 'translate(' + dx + 'px, ' + dy + 'px) rotate(' + spin * 0.6 + 'deg) scale(1)', opacity: 1, offset: 0.55 },
        { transform: 'translate(' + dx * 1.15 + 'px, ' + (dy + 110) + 'px) rotate(' + spin + 'deg) scale(.9)', opacity: 0 }
      ], { duration: 1100 + Math.random() * 300, easing: 'cubic-bezier(.2, .6, .35, 1)', fill: 'forwards' }));
    }

    let removed = false;
    const cleanup = () => {
      if (removed) return;
      removed = true;
      layer.remove();
    };
    Promise.all(animations.map(animation => animation.finished)).then(cleanup, cleanup);
    setTimeout(cleanup, 2000); // rete di sicurezza
  }

  function onDelete(id, node) {
    if (busy.has(id)) return;
    busy.add(id);
    node.classList.add('task--leaving');
    later(230, () => {
      busy.delete(id);
      const { tasks: next, removed, index } = T.removeTask(state.tasks, id);
      if (!removed || !commit(next)) return;
      showToast('Attività eliminata', {
        action: 'Annulla',
        onAction: () => commit(T.restoreTask(state.tasks, removed, index))
      });
    });
  }

  function onClearCompleted() {
    const { tasks: next, removed } = T.removeCompleted(state.tasks);
    if (!removed.length || !commit(next)) return;
    const message = removed.length === 1
      ? 'Eliminata 1 attività completata'
      : 'Eliminate ' + removed.length + ' attività completate';
    showToast(message, {
      action: 'Annulla',
      onAction: () => commit(T.restoreMany(state.tasks, removed))
    });
  }

  /* ---------- Avvisi (toast) ---------- */

  let toastTimer = null;    // chiusura automatica (o pulizia del testo dopo la chiusura)
  let announceTimer = null; // riscrittura del testo per i lettori di schermo
  let toastHandler = null;

  function showToast(message, options = {}) {
    const action = options.action || null;
    const duration = options.duration || (action ? 5000 : 2600);
    clearTimeout(toastTimer);
    clearTimeout(announceTimer);
    toastHandler = options.onAction || null;
    els.toastAction.hidden = !action;
    if (action) els.toastAction.textContent = action;
    if (els.toastText.textContent === message) {
      // Stesso testo di prima: svuota e riscrivi, così il lettore di schermo lo annuncia di nuovo.
      els.toastText.textContent = '';
      announceTimer = setTimeout(() => { els.toastText.textContent = message; }, 60);
    } else {
      els.toastText.textContent = message;
    }
    els.toast.classList.add('is-visible');
    toastTimer = setTimeout(hideToast, duration);
  }

  function hideToast() {
    clearTimeout(toastTimer);
    clearTimeout(announceTimer);
    toastHandler = null;
    els.toast.classList.remove('is-visible');
    toastTimer = setTimeout(() => { els.toastText.textContent = ''; }, 300);
  }

  /* ---------- Fogli (dialog) ---------- */

  const closing = new WeakMap(); // foglio → funzione che completa la chiusura in corso

  function openSheet(dialog) {
    const pending = closing.get(dialog);
    if (pending) pending(false); // riaperto mentre si chiudeva: resta aperto
    if (dialog.open) return;
    document.documentElement.classList.add('is-locked');
    dialog.showModal();
  }

  /** Sblocca lo scorrimento della pagina quando non resta nessun foglio aperto. */
  function releaseScroll() {
    if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('is-locked');
  }

  /** Chiude con l'animazione di uscita, poi chiama close(). */
  function closeSheet(dialog) {
    if (!dialog.open || closing.has(dialog)) return;
    if (reducedMotion.matches) {
      dialog.close();
      releaseScroll();
      onSheetClosed(dialog);
      return;
    }
    let timer = null;
    const finish = (shouldClose = true) => {
      clearTimeout(timer);
      dialog.removeEventListener('animationend', onEnd);
      closing.delete(dialog);
      dialog.classList.remove('is-closing');
      if (shouldClose && dialog.open) dialog.close();
      releaseScroll();
      if (shouldClose) onSheetClosed(dialog);
    };
    const onEnd = event => {
      if (event.target === dialog) finish();
    };
    dialog.classList.add('is-closing');
    dialog.addEventListener('animationend', onEnd);
    timer = setTimeout(finish, 400); // rete di sicurezza se animationend non arriva
    closing.set(dialog, finish);
  }

  function setupSheet(dialog) {
    // Tasto Esc o gesto "indietro" su Android: chiusura animata.
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      closeSheet(dialog);
    });
    // Chiusure "native" (per esempio Esc quando il browser non permette di animarla).
    dialog.addEventListener('close', () => {
      releaseScroll();
      onSheetClosed(dialog);
    });
    // Tocco sullo sfondo scuro: chiude (solo se anche la pressione è iniziata sullo sfondo).
    let pressedBackdrop = false;
    dialog.addEventListener('pointerdown', event => { pressedBackdrop = event.target === dialog; });
    dialog.addEventListener('click', event => {
      if (event.target === dialog && pressedBackdrop) closeSheet(dialog);
      pressedBackdrop = false;
    });
    dialog.querySelectorAll('[data-close]').forEach(button => {
      button.addEventListener('click', () => closeSheet(dialog));
    });
  }

  /** Decide chi riceve il focus all'apertura di un foglio (attributo autofocus letto da showModal). */
  function setAutofocus(dialog, target) {
    dialog.querySelectorAll('[autofocus]').forEach(el => el.removeAttribute('autofocus'));
    target.setAttribute('autofocus', '');
  }

  /* ---------- Foglio "Nuova attività" ---------- */

  /**
   * Apre il foglio vuoto, oppure già compilato da una frase (dal link ?add= o dalla casella di Siri).
   * `note` è la riga sopra la frase, per esempio "Da Siri · 1 di 2".
   */
  function openAddSheet(phrase, note) {
    els.form.reset();
    setErrors({});
    els.inboxNoteText.textContent = note || '';
    els.inboxNote.hidden = !note;
    els.dateInput.min = utils.todayISO();
    phraseBase = null;
    els.phraseSummary.textContent = PHRASE_HINT;
    syncDuration();
    syncEnergyHint();
    syncDate();
    if (phrase) {
      els.phrase.value = phrase;
      applyPhrase();
    }
    // Sul computer si scrive subito; sul telefono prima si vede tutto il modulo (la tastiera ne coprirebbe metà).
    // Con una frase già capita si mostra il risultato, da controllare prima di "Aggiungi".
    setAutofocus(els.addSheet, finePointer.matches && !phrase ? els.title : els.addHeading);
    openSheet(els.addSheet);
  }

  /* ---------- Frase libera ---------- */

  const PHRASE_HINT = 'Giorno, ora, durata ed energia: i campi sotto si compilano da soli.';
  let phraseBase = null; // valori dei campi prima della frase: la frase li sovrascrive solo dove dice qualcosa

  function readFields() {
    return {
      title: els.title.value,
      duration: els.duration.value,
      energy: els.form.elements.energy.value,
      date: els.dateInput.value,
      time: els.timeInput.value
    };
  }

  function writeFields(values) {
    els.title.value = values.title;
    els.duration.value = values.duration;
    const radio = els.form.querySelector('input[name="energy"][value="' + values.energy + '"]');
    if (radio) radio.checked = true;
    els.dateInput.value = values.date;
    els.timeInput.value = values.time;
    syncDuration();
    syncEnergyHint();
    syncDate(); // abilita l'ora solo se c'è un giorno
  }

  function applyPhrase() {
    if (!phraseBase) phraseBase = readFields();
    const parsed = nlp.parseTaskText(els.phrase.value, new Date());
    const next = { ...phraseBase };
    if (parsed.title) next.title = parsed.title;
    if (parsed.duration) next.duration = String(parsed.duration);
    if (parsed.energy) next.energy = parsed.energy;
    if (parsed.date) next.date = parsed.date;
    if (parsed.time) next.time = parsed.time;
    writeFields(next);
    setErrors({});
    els.phraseSummary.textContent = phraseSummary(parsed);
  }

  /** "Capito: Domani · alle 10:00 · 30 min · energia alta". */
  function phraseSummary(parsed) {
    if (!els.phrase.value.trim()) return PHRASE_HINT;
    const parts = [];
    if (parsed.date) parts.push(utils.formatDateLabel(parsed.date, utils.todayISO()));
    if (parsed.time) parts.push('alle ' + parsed.time);
    if (parsed.duration) parts.push(utils.formatDuration(parsed.duration));
    if (parsed.energy) parts.push('energia ' + T.ENERGY[parsed.energy].label.toLowerCase());
    return parts.length ? 'Capito: ' + parts.join(' · ') : 'Lo uso come titolo.';
  }

  function syncDuration() {
    const value = Number(els.duration.value);
    els.durationChips.querySelectorAll('[data-minutes]').forEach(chip => {
      chip.setAttribute('aria-pressed', String(Number(chip.dataset.minutes) === value));
    });
  }

  /** Pulsanti − e +: passi da 5 minuti, agganciati ai multipli di 5. */
  function stepDuration(direction) {
    const current = Math.round(Number(els.duration.value)) || T.DEFAULTS.duration;
    const next = direction > 0 ? Math.floor(current / 5) * 5 + 5 : Math.ceil(current / 5) * 5 - 5;
    els.duration.value = Math.min(T.LIMITS.durationMax, Math.max(T.LIMITS.durationMin, next));
    syncDuration();
    setError('duration', null);
  }

  function syncEnergyHint() {
    const level = T.ENERGY[els.form.elements.energy.value];
    els.energyHint.textContent = level ? level.hint : '';
  }

  function syncDate() {
    const value = els.dateInput.value;
    const today = utils.todayISO();
    const preset = !value ? 'none' : value === today ? 'today' : value === utils.addDays(today, 1) ? 'tomorrow' : null;
    els.dateChips.querySelectorAll('[data-date]').forEach(chip => {
      chip.setAttribute('aria-pressed', String(chip.dataset.date === preset));
    });
    const valid = utils.isISODate(value);
    els.datePicker.classList.toggle('is-custom', valid && preset === null);
    els.dateLabel.textContent = valid ? utils.formatLongDate(utils.parseISODate(value)) : 'Scegli un altro giorno';
    // L'ora ha senso solo con un giorno: senza, il campo è spento e vuoto.
    els.timeField.disabled = !valid;
    if (!valid) els.timeInput.value = '';
    syncTime();
  }

  function syncTime() {
    const value = els.timeInput.value;
    const valid = utils.isTime(value);
    els.timePicker.classList.toggle('is-custom', valid);
    els.timeLabel.textContent = valid ? 'Alle ' + value : 'Scegli un orario';
    els.timeClear.setAttribute('aria-pressed', String(!valid));
    els.timeHint.hidden = !els.timeField.disabled;
  }

  function pickDatePreset(preset) {
    const today = utils.todayISO();
    els.dateInput.value = preset === 'today' ? today : preset === 'tomorrow' ? utils.addDays(today, 1) : '';
    syncDate();
    setError('date', null);
  }

  function setError(field, message) {
    const el = byId('err-' + field);
    if (el) {
      el.textContent = message || '';
      el.hidden = !message;
    }
    const input = FIELD_INPUTS[field];
    if (!input) return;
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  function setErrors(errors) {
    ERROR_FIELDS.forEach(field => setError(field, errors[field]));
  }

  function onSubmit(event) {
    event.preventDefault();
    const { value, errors } = T.validateInput({
      title: els.title.value,
      duration: els.duration.value,
      energy: els.form.elements.energy.value,
      date: els.dateInput.value,
      time: els.timeInput.value
    });
    setErrors(errors);
    const firstError = ERROR_FIELDS.find(field => errors[field]);
    if (firstError) {
      if (FIELD_INPUTS[firstError]) FIELD_INPUTS[firstError].focus();
      return;
    }

    const task = T.createTask(value, Date.now());
    const isFirst = state.tasks.length === 0;
    highlightId = task.id;
    const saved = commit(state.tasks.concat(task));
    closeSheet(els.addSheet);
    if (!saved) return;
    showToast('Attività aggiunta');
    revealTask(task.id);
    if (isFirst) storage.requestPersistence();
  }

  /** Porta in vista la card appena aggiunta, dopo la chiusura del foglio. */
  function revealTask(id) {
    const node = els.main.querySelector('.task[data-id="' + CSS.escape(id) + '"]');
    if (!node) return;
    later(260, () => node.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'auto' : 'smooth' }));
  }

  /* ---------- Foglio "Tema" ---------- */

  function syncThemeUI() {
    const mode = theme.getMode();
    els.themeSheet.querySelectorAll('input[name="theme"]').forEach(radio => {
      radio.checked = radio.value === mode;
    });
    els.themeButton.setAttribute('aria-label', 'Tema: ' + THEME_LABELS[mode] + '. Cambia tema');
    els.themeButton.querySelector('use').setAttribute('href', '#i-theme-' + mode);
  }

  function openThemeSheet() {
    syncThemeUI();
    const checked = els.themeSheet.querySelector('input[name="theme"]:checked');
    setAutofocus(els.themeSheet, checked || els.themeHeading);
    openSheet(els.themeSheet);
  }

  /* ---------- Foglio "Promemoria e Siri" (server di Aura) ---------- */

  const AVAILABILITY_NOTES = {
    file: 'Promemoria e Siri funzionano nell\'app pubblicata (https), non aprendo il file dal computer.',
    unconfigured: 'Il server di Aura non è ancora configurato.'
  };
  const SUPPORT_NOTES = {
    'ios-install': 'Su iPhone i promemoria funzionano con Aura aggiunta alla schermata Home (Condividi → "Aggiungi alla schermata Home") e aperta dall\'icona, con iOS 16.4 o successivo.',
    unsupported: 'Questo browser non supporta le notifiche push.',
    denied: 'Le notifiche per Aura sono bloccate: riattivale nelle impostazioni (su iPhone: Impostazioni → Notifiche → Aura Tasks).'
  };

  /** Errore con un messaggio già pronto da mostrare nel foglio. */
  class RemoteError extends Error {}

  let remoteBusy = false;
  let codeVisible = false;
  let pushRegistration = null; // service worker pronto: preparato all'apertura del foglio
  let serverKey = null; // chiave pubblica del server (VAPID)
  const messages = { reminders: null, siri: null }; // esito dell'ultima azione, al posto dello stato normale

  function saveRemote() {
    R.save(remote);
  }

  function serverTrouble() {
    return navigator.onLine === false ? 'Serve internet: riprova quando sei online.' : 'Il server di Aura non risponde: riprova tra poco.';
  }

  function syncRemoteUI() {
    const availability = R.availability();
    const available = availability === 'ok';
    const support = R.pushSupport();
    const enabled = remote.reminders.enabled;
    const connected = Boolean(remote.code);

    els.remoteNotice.hidden = available;
    els.remoteNotice.textContent = AVAILABILITY_NOTES[availability] || '';

    let status = { text: 'Spenti', tone: 'off' };
    if (messages.reminders) status = messages.reminders;
    else if (enabled) status = { text: 'Attivi · ' + RM.leadLabel(remote.reminders.lead), tone: 'on' };
    else if (available && !support.ok) status = { text: SUPPORT_NOTES[support.reason], tone: 'warn' };
    els.reminderStatus.textContent = status.text;
    els.reminderStatus.dataset.tone = status.tone;
    els.reminderLeads.querySelectorAll('[data-lead]').forEach(chip => {
      chip.setAttribute('aria-pressed', String(Number(chip.dataset.lead) === remote.reminders.lead));
    });
    els.reminderOn.hidden = enabled;
    els.reminderTest.hidden = !enabled;
    els.reminderOff.hidden = !enabled;
    els.reminderOn.disabled = remoteBusy || !available || !support.ok;
    els.reminderTest.disabled = remoteBusy || !available;
    els.reminderOff.disabled = remoteBusy;

    els.siriStatus.hidden = !messages.siri;
    if (messages.siri) {
      els.siriStatus.textContent = messages.siri.text;
      els.siriStatus.dataset.tone = messages.siri.tone;
    }
    els.siriSetup.hidden = connected;
    els.siriSetup.disabled = remoteBusy || !available;
    els.siriDetails.hidden = !connected;
    if (connected) {
      els.siriUrl.textContent = R.serverUrl() + '/api/inbox';
      els.siriAuth.textContent = 'Bearer ' + (codeVisible ? remote.code : '•'.repeat(12));
      els.siriShow.textContent = codeVisible ? 'Nascondi il codice' : 'Mostra il codice';
      els.siriShow.setAttribute('aria-pressed', String(codeVisible));
    }
    els.remoteDisconnect.hidden = !connected;
    els.remoteDisconnect.disabled = remoteBusy;
    els.remoteSheet.setAttribute('aria-busy', String(remoteBusy));
    syncRemoteBadges();
  }

  /** Puntino sulla campanella e frase in fondo alla pagina: dicono se il server è in uso. */
  function syncRemoteBadges() {
    els.remoteButton.classList.toggle('has-dot', remote.reminders.enabled);
    els.remoteButton.setAttribute('aria-label', remote.reminders.enabled ? 'Promemoria e Siri: promemoria attivi' : 'Promemoria e Siri');
    els.footnoteText.textContent = remote.code
      ? 'I dati restano su questo dispositivo: al server di Aura arrivano solo promemoria e frasi di Siri.'
      : 'I dati restano solo su questo dispositivo.';
  }

  function setMessage(area, text, tone) {
    messages[area] = text ? { text, tone: tone || 'warn' } : null;
    syncRemoteUI();
  }

  function openRemoteSheet() {
    messages.reminders = null;
    messages.siri = null;
    codeVisible = false;
    syncRemoteUI();
    setAutofocus(els.remoteSheet, els.remoteHeading);
    openSheet(els.remoteSheet);
    preparePush();
  }

  /** Prepara ciò che serve al tocco su "Attiva": su iPhone il permesso va chiesto subito, senza attese di rete prima. */
  async function preparePush() {
    if (R.availability() !== 'ok' || !R.pushSupport().ok) return;
    pushRegistration = await R.registration();
    await fetchServerKey();
  }

  async function fetchServerKey() {
    const result = await R.api.pushKey();
    if (result.ok && result.data && typeof result.data.publicKey === 'string') serverKey = result.data.publicKey;
    return serverKey;
  }

  /** Chiamata al server col codice del dispositivo. Se il server non lo conosce più (401), lo ricollega e riprova una volta. */
  async function withDevice(call) {
    let result = await call(remote.code);
    if (result.status === 401 && remote.code) {
      const again = await R.api.register(remote.code);
      if (again.ok) result = await call(remote.code);
    }
    return result;
  }

  /** Il codice del dispositivo, registrato sul server: la prima volta lo crea. */
  async function ensureDevice() {
    const code = remote.code || R.newDeviceCode();
    const result = await R.api.register(code);
    if (!result.ok) throw new RemoteError(R.troubleMessage(result, navigator.onLine));
    if (remote.code !== code) {
      remote.code = code;
      saveRemote();
    }
  }

  /** Manda al server la sottoscrizione push di questo dispositivo. */
  async function sendSubscription(subscription, key) {
    const result = await withDevice(code => R.api.putSubscription(code, subscription.toJSON()));
    if (!result.ok) {
      throw new RemoteError(result.status === 400 ? 'Il servizio di notifiche di questo browser non è supportato.' : R.troubleMessage(result, navigator.onLine));
    }
    remote.vapidKey = key;
    remote.sent = { endpoint: subscription.endpoint, at: Date.now(), key: null }; // l'elenco va rimandato
    saveRemote();
  }

  async function onEnableReminders() {
    if (remoteBusy) return;
    if (!R.pushSupport().ok) {
      syncRemoteUI();
      return;
    }
    // Su iPhone il permesso va chiesto subito, dentro il tocco: nessuna attesa di rete prima di questa riga.
    let permission;
    try {
      permission = await Notification.requestPermission();
    } catch (err) {
      permission = Notification.permission;
    }
    if (permission !== 'granted') {
      setMessage('reminders', permission === 'denied' ? SUPPORT_NOTES.denied : 'Per i promemoria serve il permesso per le notifiche.');
      return;
    }
    remoteBusy = true;
    setMessage('reminders', 'Attivo i promemoria…', 'busy');
    try {
      const reg = pushRegistration || await R.registration();
      if (!reg) throw new RemoteError('Il service worker non è attivo: ricarica Aura e riprova.');
      const key = serverKey || await fetchServerKey();
      if (!key) throw new RemoteError(serverTrouble());
      const subscription = await R.subscribe(reg, key);
      await ensureDevice();
      await sendSubscription(subscription, key);
      remote.reminders.enabled = true;
      saveRemote();
      await syncReminders(true);
      messages.reminders = null;
    } catch (err) {
      messages.reminders = {
        text: err instanceof RemoteError ? err.message : 'Non sono riuscito ad attivare i promemoria. Riprova tra poco.',
        tone: 'warn'
      };
    }
    remoteBusy = false;
    syncRemoteUI();
  }

  async function onDisableReminders() {
    if (remoteBusy) return;
    remote.reminders.enabled = false;
    saveRemote();
    remoteBusy = true;
    setMessage('reminders', 'Spengo i promemoria…', 'busy');
    // Se il server non risponde, ci si riprova da soli (refreshRemote): intanto qui risultano già spenti.
    await forgetServerSubscription();
    messages.reminders = null;
    remoteBusy = false;
    syncRemoteUI();
  }

  /** Toglie dal server sottoscrizione e promemoria; se non ci riesce, resta segnato e ci si riprova. */
  async function forgetServerSubscription() {
    const result = await R.api.deleteSubscription(remote.code);
    if (result.ok || result.status === 401) {
      remote.sent = R.emptySent();
      saveRemote();
    }
  }

  async function onTestPush() {
    if (remoteBusy) return;
    remoteBusy = true;
    setMessage('reminders', 'Invio una notifica di prova…', 'busy');
    let result = await withDevice(code => R.api.testPush(code));
    if ((result.status === 409 || result.status === 410) && await refreshPush({ force: true })) {
      // Il server non aveva (più) la sottoscrizione: rimandata, si riprova.
      result = await R.api.testPush(remote.code);
    }
    messages.reminders = result.ok
      ? { text: 'Notifica inviata: arriva tra pochi secondi.', tone: 'on' }
      : { text: testFailure(result), tone: 'warn' };
    remoteBusy = false;
    syncRemoteUI();
  }

  /** Perché la notifica di prova non è partita, con il codice del servizio push (utile se Apple o Google rifiutano). */
  function testFailure(result) {
    if (result.status === 0) return serverTrouble();
    const data = result.data || {};
    const detail = data.status ? ' (' + data.status + (data.reason ? ': ' + String(data.reason).slice(0, 80) : '') + ')' : '';
    return (data.error || 'Invio non riuscito') + detail + '.';
  }

  async function onSiriSetup() {
    if (remoteBusy) return;
    remoteBusy = true;
    setMessage('siri', 'Creo il codice…', 'busy');
    try {
      await ensureDevice();
      messages.siri = null;
    } catch (err) {
      messages.siri = { text: err instanceof RemoteError ? err.message : serverTrouble(), tone: 'warn' };
    }
    remoteBusy = false;
    syncRemoteUI();
  }

  /** Copia negli appunti; restituisce true se ci è riuscito. */
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) {
      // Si prova il metodo vecchio, qui sotto.
    }
    // Il campo d'appoggio sta dentro il foglio: fuori da un <dialog> modale non si può selezionare.
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.className = 'sr-only';
    els.remoteSheet.appendChild(area);
    area.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (err) {
      copied = false;
    }
    area.remove();
    return copied;
  }

  async function onCopy(button) {
    const text = button.dataset.copy === 'auth' ? 'Bearer ' + remote.code : R.serverUrl() + '/api/inbox';
    if (!await copyText(text)) {
      // Niente appunti: si mostra tutto, da selezionare a mano.
      codeVisible = true;
      setMessage('siri', 'Non riesco a copiare: tieni premuto sul testo per selezionarlo.');
      return;
    }
    button.dataset.label = button.dataset.label || button.textContent;
    button.textContent = 'Copiato ✓';
    setTimeout(() => { button.textContent = button.dataset.label; }, 1800);
  }

  /** "Scollega": il server dimentica il dispositivo (codice, casella, promemoria). Si può annullare. */
  async function onDisconnect() {
    if (remoteBusy || !remote.code) return;
    remoteBusy = true;
    setMessage('siri', 'Scollego il dispositivo…', 'busy');
    await checkInbox({ force: true }); // prima si ritirano le frasi in attesa: non vanno perse
    const previous = remote;
    const result = await R.api.unregister(previous.code);
    remoteBusy = false;
    if (!result.ok && result.status !== 401) {
      setMessage('siri', R.troubleMessage(result, navigator.onLine));
      return;
    }
    remote = Object.assign(R.defaults(), { inbox: previous.inbox, done: previous.done });
    remote.reminders.lead = previous.reminders.lead;
    saveRemote();
    messages.siri = null;
    syncRemoteUI();
    closeSheet(els.remoteSheet);
    showToast('Dispositivo scollegato', { action: 'Annulla', onAction: () => restoreConnection(previous) });
  }

  /** "Annulla" dopo "Scollega": torna lo stesso codice, così il Comando Rapido continua a funzionare. */
  async function restoreConnection(previous) {
    const result = await R.api.register(previous.code);
    if (!result.ok) {
      showToast('Non sono riuscito a ricollegare il dispositivo. ' + R.troubleMessage(result, navigator.onLine), { duration: 5000 });
      return;
    }
    remote = Object.assign({}, previous, { inbox: remote.inbox, done: remote.done, sent: R.emptySent() });
    saveRemote();
    syncRemoteUI();
    showToast('Dispositivo ricollegato');
    if (remote.reminders.enabled) await refreshPush({ force: true });
  }

  /* ---------- Casella del Comando Rapido di Siri ---------- */

  const INBOX_INTERVAL_MS = 15 * 1000;
  let inboxCheckedAt = 0;
  let inboxShowing = null; // id della frase mostrata adesso nel foglio "Nuova attività"
  let inboxShown = 0; // frasi già mostrate in questa serie, per "2 di 3"

  /** Ritira le frasi dal server, le salva nella coda e solo dopo le conferma al server: così nessuna si perde. */
  async function checkInbox({ force = false } = {}) {
    if (!remote.code || R.availability() !== 'ok' || navigator.onLine === false) return;
    if (!force && Date.now() - inboxCheckedAt < INBOX_INTERVAL_MS) return;
    inboxCheckedAt = Date.now();
    const result = await withDevice(code => R.api.inbox(code));
    const items = result.ok && result.data && Array.isArray(result.data.items) ? result.data.items : [];
    if (items.length) {
      remote.inbox = R.mergeInbox(remote.inbox, items, remote.done);
      saveRemote();
      // Si confermano solo le frasi in coda o già viste; quelle in più restano sul server per la prossima volta.
      const kept = new Set(remote.inbox.map(item => item.id).concat(remote.done));
      const ids = items.map(item => item.id).filter(id => kept.has(id));
      if (ids.length) await R.api.ackInbox(remote.code, ids);
    }
    showNextInboxItem();
  }

  /** Apre la prossima frase in coda nel foglio "Nuova attività", se non c'è già un foglio aperto. */
  function showNextInboxItem() {
    if (inboxShowing || !remote.inbox.length || document.querySelector('dialog[open]')) return;
    const item = remote.inbox[0];
    const total = inboxShown + remote.inbox.length;
    inboxShowing = item.id;
    openAddSheet(item.text, total > 1 ? 'Da Siri · ' + (inboxShown + 1) + ' di ' + total : 'Da Siri');
  }

  /** Dopo la chiusura di un foglio: la frase mostrata è fatta (aggiunta o annullata), poi tocca alla prossima. */
  function onSheetClosed(dialog) {
    if (dialog === els.addSheet && inboxShowing) {
      const id = inboxShowing;
      inboxShowing = null;
      inboxShown++;
      remote.inbox = remote.inbox.filter(item => item.id !== id);
      remote.done = [id].concat(remote.done.filter(other => other !== id)).slice(0, 100);
      saveRemote();
    }
    if (!remote.inbox.length) {
      inboxShown = 0;
      return;
    }
    // Sempre con un timer (anche con "Riduci movimento"): prima arriva l'evento "close" del foglio appena chiuso.
    setTimeout(showNextInboxItem, 250);
  }

  /* ---------- Promemoria (notifiche push) ---------- */

  let syncTimer = null;
  let syncChain = Promise.resolve();

  /** Dopo ogni modifica: l'elenco va al server dopo 2 secondi (le modifiche vicine si sommano). Spenti: nulla. */
  function scheduleReminderSync() {
    if (!remote.reminders.enabled) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncReminders(false), 2000);
  }

  /** Manda l'elenco dei promemoria se è cambiato da quello già confermato. Un invio alla volta, nell'ordine. */
  function syncReminders(force) {
    syncChain = syncChain.then(() => sendReminders(force)).catch(() => {});
    return syncChain;
  }

  async function sendReminders(force) {
    if (!remote.reminders.enabled || !remote.code || R.availability() !== 'ok' || navigator.onLine === false) return;
    const list = RM.buildReminders(state.tasks, { lead: remote.reminders.lead, now: Date.now() });
    const key = RM.listKey(list);
    if (!force && key === remote.sent.key) return;
    const result = await withDevice(code => R.api.putReminders(code, list));
    if (result.ok) {
      remote.sent.key = key;
      saveRemote();
    }
  }

  /**
   * Controlla che il server abbia la sottoscrizione giusta e la ripara se serve: browser che l'ha cambiata,
   * chiavi del server cambiate, server che l'ha persa, o un giorno passato dall'ultima conferma.
   * Restituisce true se la sottoscrizione è stata rimandata.
   */
  async function refreshPush({ force = false } = {}) {
    if (!R.pushSupport().ok) return false; // permesso tolto: lo dice il foglio
    const reg = await R.registration();
    if (!reg) return false;
    let subscription = await R.currentSubscription(reg);
    const due = force || !subscription || subscription.endpoint !== remote.sent.endpoint ||
      Date.now() - remote.sent.at > utils.DAY_MS;
    if (!due) {
      await syncReminders(false);
      return false;
    }
    const key = (await fetchServerKey()) || remote.vapidKey;
    if (!key) return false;
    if ((!subscription || key !== remote.vapidKey) && Notification.permission === 'granted') {
      try {
        subscription = await R.subscribe(reg, key);
      } catch (err) {
        subscription = null;
      }
    }
    if (!subscription) return false;
    try {
      await sendSubscription(subscription, key);
    } catch (err) {
      return false;
    }
    await syncReminders(true);
    return true;
  }

  let refreshing = false;

  /** All'avvio, al ritorno nell'app e quando torna internet: casella di Siri e promemoria. Senza codice non fa nulla. */
  async function refreshRemote({ force = false } = {}) {
    if (refreshing || !remote.code || R.availability() !== 'ok' || navigator.onLine === false) return;
    refreshing = true;
    try {
      await checkInbox({ force });
      if (remote.reminders.enabled) await refreshPush();
      else if (remote.sent.endpoint) await forgetServerSubscription(); // spegnimento che non era arrivato al server
    } catch (err) {
      // Problemi di rete: si riprova alla prossima occasione.
    } finally {
      refreshing = false;
    }
  }

  /** Dalla notifica di un promemoria: evidenzia l'attività e la porta in vista. */
  function showTask(id) {
    if (!id || !state.tasks.some(task => task.id === id)) return;
    highlightId = id;
    render();
    revealTask(id);
  }

  /* ---------- Fascia sotto la barra di stato (iPhone, app installata) ---------- */

  let scrimThreshold = 0;
  let scrimVisible = false;

  function measureHero() {
    scrimThreshold = els.hero.offsetHeight - els.scrim.offsetHeight - 8;
    updateScrim();
  }

  function updateScrim() {
    const visible = els.scrim.offsetHeight > 0 && window.scrollY > scrimThreshold;
    if (visible === scrimVisible) return;
    scrimVisible = visible;
    els.scrim.classList.toggle('is-visible', visible);
  }

  /* ---------- Link "…/?add=testo" e "…/?task=id" (dalla notifica di un promemoria) ---------- */

  /**
   * ?add=testo apre "Nuova attività" già compilato; ?task=id evidenzia l'attività di una notifica.
   * I parametri spariscono dall'indirizzo.
   */
  function openFromLink() {
    let text = null;
    let taskId = null;
    try {
      const params = new URLSearchParams(location.search);
      text = params.get('add');
      taskId = params.get('task');
      if (text === null && taskId === null) return;
      params.delete('add');
      params.delete('task');
      const query = params.toString();
      // Così ricaricando la pagina il foglio non si riapre.
      history.replaceState(history.state, '', location.pathname + (query ? '?' + query : '') + location.hash);
    } catch (err) {
      // Da file:// alcuni browser non permettono di cambiare l'indirizzo: il foglio si apre lo stesso.
    }
    if (taskId) showTask(taskId);
    if (text !== null) openAddSheet(text.trim());
  }

  /* ---------- Service worker (uso offline) ---------- */

  function registerServiceWorker() {
    const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!('serviceWorker' in navigator) || !secure) return; // da file:// non si può: va bene così
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        // Senza service worker l'app funziona lo stesso, solo non offline.
      });
    });
  }

  /* ---------- Eventi ---------- */

  els.main.addEventListener('change', event => {
    const checkbox = event.target.closest('.check__input');
    if (!checkbox) return;
    const node = checkbox.closest('.task');
    onToggle(node.dataset.id, checkbox.checked, node);
  });

  els.main.addEventListener('click', event => {
    const button = event.target.closest('[data-action="delete"]');
    if (!button) return;
    const node = button.closest('.task');
    onDelete(node.dataset.id, node);
  });

  els.clearCompleted.addEventListener('click', onClearCompleted);
  els.addButton.addEventListener('click', () => openAddSheet());
  els.form.addEventListener('submit', onSubmit);

  els.title.addEventListener('input', () => setError('title', null));
  els.duration.addEventListener('input', () => {
    syncDuration();
    setError('duration', null);
  });
  els.durationChips.addEventListener('click', event => {
    const chip = event.target.closest('[data-minutes]');
    if (!chip) return;
    els.duration.value = chip.dataset.minutes;
    syncDuration();
    setError('duration', null);
  });
  els.form.querySelectorAll('[data-step]').forEach(button => {
    button.addEventListener('click', () => stepDuration(Number(button.dataset.step)));
  });
  els.form.addEventListener('change', event => {
    if (event.target.name === 'energy') syncEnergyHint();
  });
  els.dateChips.addEventListener('click', event => {
    const chip = event.target.closest('[data-date]');
    if (chip) pickDatePreset(chip.dataset.date);
  });
  els.dateInput.addEventListener('input', () => {
    syncDate();
    setError('date', null);
  });
  els.dateInput.addEventListener('change', syncDate);
  els.timeInput.addEventListener('input', () => {
    syncTime();
    setError('time', null);
  });
  els.timeInput.addEventListener('change', syncTime);
  els.timeClear.addEventListener('click', () => {
    els.timeInput.value = '';
    syncTime();
    setError('time', null);
  });

  els.phrase.addEventListener('input', applyPhrase);
  // Una modifica fatta a mano diventa la nuova base: la frase non la riporta indietro.
  const forgetPhraseBase = event => {
    if (event.target !== els.phrase) phraseBase = null;
  };
  els.form.addEventListener('input', forgetPhraseBase);
  els.form.addEventListener('change', forgetPhraseBase);
  els.form.addEventListener('click', event => {
    if (event.target.closest('button')) phraseBase = null;
  });

  els.themeButton.addEventListener('click', openThemeSheet);
  els.themeSheet.addEventListener('change', event => {
    if (event.target.name === 'theme') theme.setMode(event.target.value);
  });
  theme.onChange(syncThemeUI);

  els.remoteButton.addEventListener('click', openRemoteSheet);
  els.reminderOn.addEventListener('click', onEnableReminders);
  els.reminderOff.addEventListener('click', onDisableReminders);
  els.reminderTest.addEventListener('click', onTestPush);
  els.reminderLeads.addEventListener('click', event => {
    const chip = event.target.closest('[data-lead]');
    if (!chip) return;
    remote.reminders.lead = Number(chip.dataset.lead);
    saveRemote();
    syncRemoteUI();
    syncReminders(false); // con i promemoria attivi il server riceve subito i nuovi orari
  });
  els.siriSetup.addEventListener('click', onSiriSetup);
  els.siriShow.addEventListener('click', () => {
    codeVisible = !codeVisible;
    syncRemoteUI();
  });
  els.siriDetails.addEventListener('click', event => {
    const button = event.target.closest('[data-copy]');
    if (button) onCopy(button);
  });
  els.remoteDisconnect.addEventListener('click', onDisconnect);

  // Tocco su una notifica con l'app già aperta: il service worker chiede di mostrare l'attività.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
      const data = event.data || {};
      if (data.type === 'open-task') showTask(data.id);
    });
  }
  // Tornata la connessione: frasi di Siri e promemoria rimasti in sospeso.
  window.addEventListener('online', () => refreshRemote({ force: true }));

  els.toastAction.addEventListener('click', () => {
    const handler = toastHandler;
    hideToast();
    if (handler) handler();
  });
  // Finché il dito o il mouse sono sull'avviso, non sparisce.
  els.toast.addEventListener('pointerenter', () => clearTimeout(toastTimer));
  els.toast.addEventListener('pointerleave', () => {
    if (!els.toast.classList.contains('is-visible')) return;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 2000);
  });

  [els.addSheet, els.themeSheet, els.remoteSheet].forEach(setupSheet);

  // Tornando nell'app (o dopo mezzanotte) "Oggi" e "In ritardo" devono essere giusti.
  // E si guarda se Siri ha lasciato frasi nella casella (solo con un dispositivo collegato).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    render();
    refreshRemote();
  });
  setInterval(() => {
    const now = new Date();
    if (utils.toISODate(now) !== renderedDay) render();
    else els.greeting.textContent = utils.greeting(now);
  }, 60 * 1000);

  // Dati modificati in un'altra scheda.
  window.addEventListener('storage', event => {
    if (event.key !== storage.KEY && event.key !== null) return;
    state = storage.load().state;
    render();
  });

  window.addEventListener('scroll', updateScrim, { passive: true });
  window.addEventListener('resize', measureHero);

  /* ---------- Avvio ---------- */

  render();
  syncThemeUI();
  measureHero();
  registerServiceWorker();
  // All'apertura la fiamma accesa fa qualche guizzo, poi si ferma (niente animazioni infinite).
  if (els.statStreak.classList.contains('is-lit')) flash(els.statStreak, 'is-flickering', 3800);
  if (loaded.warning) showToast(loaded.warning, { duration: 8000 });
  openFromLink();
  syncRemoteBadges();
  showNextInboxItem(); // frasi di Siri già ritirate ma non ancora viste (anche offline)
  refreshRemote({ force: true });
})(window.Aura = window.Aura || {});
