/*
 * Aura Tasks — interfaccia.
 * Unico file che tocca la pagina: disegna la lista partendo da `state` e trasforma i gesti
 * dell'utente in chiamate ad Aura.tasks e Aura.storage. Ogni modifica passa da commit().
 */
(function (Aura) {
  'use strict';

  const { utils, tasks: T, storage, theme } = Aura;

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
    title: byId('task-title'),
    duration: byId('task-duration'),
    durationChips: byId('duration-chips'),
    energyHint: byId('energy-hint'),
    dateChips: byId('date-chips'),
    datePicker: byId('date-picker'),
    dateInput: byId('task-date'),
    dateLabel: byId('date-label'),
    themeButton: byId('theme-button'),
    themeSheet: byId('theme-sheet'),
    themeHeading: byId('theme-sheet-title'),
    toast: byId('toast'),
    toastText: byId('toast-text'),
    toastAction: byId('toast-action'),
    taskTemplate: byId('task-template')
  };

  const THEME_LABELS = { auto: 'Automatico', light: 'Chiaro', dark: 'Scuro' };
  const DATED_SECTIONS = ['overdue', 'upcoming']; // nelle altre sezioni la data è già nel titolo
  const ERROR_FIELDS = ['title', 'duration', 'energy', 'date'];
  const FIELD_INPUTS = { title: els.title, duration: els.duration, date: els.dateInput };

  const loaded = storage.load();
  let state = loaded.state;
  let renderedDay = null;
  let highlightId = null; // attività appena aggiunta, da evidenziare al prossimo disegno
  const busy = new Set(); // attività in animazione: i doppi tocchi vengono ignorati

  /* ---------- Stato ---------- */

  /** Applica un nuovo elenco: salva e ridisegna. Restituisce false (e avvisa) se il salvataggio non riesce. */
  function commit(nextTasks) {
    state = { ...state, tasks: nextTasks };
    const saved = storage.save(state);
    render();
    if (!saved) showToast('Impossibile salvare: la memoria del browser è piena o disattivata.', { duration: 6000 });
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
    renderEmpty(sections.length === 0, completed.length);

    // Se l'elemento che aveva il focus è stato ridisegnato, il focus resta nella lista (utile da tastiera).
    if (hadFocus && !els.main.contains(document.activeElement)) els.main.focus({ preventScroll: true });
    renderedDay = today;
    highlightId = null;
  }

  function renderHeader(now, today) {
    const summary = T.summarize(state.tasks, today);
    els.greeting.textContent = utils.greeting(now);
    els.today.textContent = utils.formatLongDate(now);
    els.statOpen.textContent = summary.openCount;
    els.statTime.textContent = utils.formatDuration(summary.openMinutes);
    els.statDone.textContent = summary.doneToday;
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

  function renderEmpty(isEmpty, completedCount) {
    els.empty.hidden = !isEmpty;
    if (!isEmpty) return;
    const allDone = completedCount > 0;
    els.emptyTitle.textContent = allDone ? 'Hai fatto tutto! 🎉' : 'Tutto libero ✨';
    els.emptyText.textContent = allDone
      ? 'Goditi il momento, oppure aggiungi una nuova attività.'
      : 'Aggiungi la tua prima attività con il pulsante qui sotto.';
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
    }
    later(done ? 450 : 0, () => {
      busy.delete(id);
      if (!commit(T.setDone(state.tasks, id, done, Date.now())) || !done) return;
      showToast('Completata 🎉', {
        action: 'Annulla',
        onAction: () => commit(T.setDone(state.tasks, id, false, Date.now()))
      });
    });
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
    dialog.addEventListener('close', releaseScroll);
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

  function openAddSheet() {
    els.form.reset();
    setErrors({});
    els.dateInput.min = utils.todayISO();
    syncDuration();
    syncEnergyHint();
    syncDate();
    // Sul computer si scrive subito; sul telefono prima si vede tutto il modulo (la tastiera ne coprirebbe metà).
    setAutofocus(els.addSheet, finePointer.matches ? els.title : els.addHeading);
    openSheet(els.addSheet);
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
      date: els.dateInput.value
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
  els.addButton.addEventListener('click', openAddSheet);
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

  els.themeButton.addEventListener('click', openThemeSheet);
  els.themeSheet.addEventListener('change', event => {
    if (event.target.name === 'theme') theme.setMode(event.target.value);
  });
  theme.onChange(syncThemeUI);

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

  [els.addSheet, els.themeSheet].forEach(setupSheet);

  // Tornando nell'app (o dopo mezzanotte) "Oggi" e "In ritardo" devono essere giusti.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') render();
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
  if (loaded.warning) showToast(loaded.warning, { duration: 8000 });
})(window.Aura = window.Aura || {});
