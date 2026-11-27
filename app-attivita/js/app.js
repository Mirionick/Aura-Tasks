/*
 * Aura Tasks — interfaccia.
 * Disegna le tre schede (Focus, Agenda, Motivazione) partendo da `state` e trasforma i gesti dell'utente in chiamate
 * ad Aura.tasks, Aura.points e Aura.storage. Ogni modifica passa da commit(); solo l'importazione di un backup
 * (e il suo ripristino) sostituisce tutto lo stato, con applyState().
 * I fogli «Cosa faccio adesso?» e Focus stanno in js/ui-focus.js, che riceve da qui quello che gli serve.
 * L'assistente (striscia, campo nel foglio «Aura», foglio «Assistente») sta in js/ui-assistant.js, avviato allo stesso modo.
 * La rotella con i fogli «Impostazioni» e «Privacy» sta in js/ui-settings.js, avviato allo stesso modo.
 * L'Agenda a calendario (calendario, giorno scelto, «Prossimi giorni», «Da pianificare») sta in js/ui-agenda.js, avviato
 * allo stesso modo: render() la ridisegna insieme alle altre schede. Così anche Motivazione (livello, «La tua settimana»,
 * «I tuoi numeri»), in js/ui-motivation.js, i suoi premi («I tuoi premi» e il foglio del premio), in js/ui-rewards.js, e
 * il negozio (la card e il foglio «Negozio»), in js/ui-shop.js; «Completate», serie e punti restano qui. Quello che è in uso
 * dal negozio (colori dell'aurora, forma dei coriandoli) si applica qui: data-aurora su <html> e i coriandoli. Il suono in
 * uso lo suona js/ui-sound.js («Suono» nel focus a tutto schermo e l'ascolto di prova nel negozio).
 * Promemoria, casella di Siri e assistente (facoltativi) passano da Aura.remote, che parla con il server di Aura.
 */
(function (Aura) {
  'use strict';

  const { utils, repeat: RP, tasks: T, nlp, points: P, focus: F, rewards: RW, shop: SH, storage, theme, reminders: RM, remote: R,
    motion: M, settings: Settings, focusUI: FocusUI, assistantUI: AssistantUI, settingsUI: SettingsUI, agendaUI: AgendaUI,
    motivationUI: MotivationUI, rewardsUI: RewardsUI, shopUI: ShopUI, musicUI: MusicUI, swipeUI: SwipeUI, soundUI: SoundUI,
    claudeUI: ClaudeUI } = Aura;

  const byId = id => document.getElementById(id);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(pointer: fine)');

  const els = {
    hero: byId('hero'),
    heroBg: byId('hero-bg'),
    scrim: byId('statusbar-scrim'),
    heroFocus: byId('hero-focus'),
    heroTab: byId('hero-tab'),
    heroTitle: byId('hero-title'),
    heroSubtitle: byId('hero-subtitle'),
    miniRewards: byId('rewards-mini'),
    miniStreak: byId('mini-streak'),
    miniStreakValue: byId('mini-streak-value'),
    miniPoints: byId('mini-points'),
    miniPointsValue: byId('mini-points-value'),
    tabbar: byId('tabbar'),
    tabButtons: Array.from(document.querySelectorAll('.tabbar__tab')),
    tabPill: document.querySelector('.tabbar__pill'),
    tabFocus: byId('tab-focus'),
    tabAgenda: byId('tab-agenda'),
    tabMotivation: byId('tab-motivation'),
    suggestButton: byId('suggest-button'),
    emptyAgendaLink: byId('empty-agenda-link'),
    history: byId('history'),
    historyCount: byId('history-count'),
    historyList: byId('history-list'),
    greeting: byId('greeting'),
    today: byId('today-label'),
    statsRow: document.querySelector('.stats--inline'),
    statOpen: byId('stat-open'),
    statTime: byId('stat-time'),
    statDone: byId('stat-done'),
    statStreak: byId('stat-streak'),
    streakValue: byId('streak-value'),
    streakRecord: byId('streak-record'),
    streakRecordText: byId('streak-record-text'),
    streakNote: byId('streak-note'),
    streakProgress: byId('streak-progress'),
    level: byId('level'),
    rewards: byId('rewards'),
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
    submitIcon: byId('add-submit-icon'),
    submitText: byId('add-submit-text'),
    editFocus: byId('edit-focus'),
    editNote: byId('edit-note'),
    editNoteText: byId('edit-note-text'),
    phraseField: byId('phrase-field'),
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
    repeatField: byId('repeat-field'),
    repeatChips: byId('repeat-chips'),
    repeatDays: byId('repeat-days'),
    repeatHint: byId('repeat-hint'),
    repeatSkip: byId('repeat-skip'),
    timeHint: byId('time-hint'),
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
    siriTitle: byId('siri-title'),
    siriStatus: byId('siri-status'),
    siriText: byId('siri-text'),
    siriAssistantNote: byId('siri-assistant-note'),
    siriSetup: byId('siri-setup'),
    siriDetails: byId('siri-details'),
    siriUrl: byId('siri-url'),
    siriAuth: byId('siri-auth'),
    siriShow: byId('siri-show'),
    remoteDisconnect: byId('remote-disconnect'),
    backupButton: byId('backup-button'),
    backupSheet: byId('backup-sheet'),
    backupHeading: byId('backup-sheet-title'),
    backupStatus: byId('backup-status'),
    backupMain: byId('backup-main'),
    backupExport: byId('backup-export'),
    backupImport: byId('backup-import'),
    backupFile: byId('backup-file'),
    backupIosHint: byId('backup-ios-hint'),
    backupRestore: byId('backup-restore'),
    backupRestoreButton: byId('backup-restore-button'),
    backupRestoreWhen: byId('backup-restore-when'),
    backupConfirm: byId('backup-confirm'),
    backupConfirmTitle: byId('backup-confirm-title'),
    backupConfirmSourceLabel: byId('backup-confirm-source-label'),
    backupConfirmSource: byId('backup-confirm-source'),
    backupConfirmWhen: byId('backup-confirm-when'),
    backupConfirmCurrent: byId('backup-confirm-current'),
    backupConfirmText: byId('backup-confirm-text'),
    backupConfirmOk: byId('backup-confirm-ok'),
    backupConfirmCancel: byId('backup-confirm-cancel'),
    toast: byId('toast'),
    toastText: byId('toast-text'),
    toastAction: byId('toast-action'),
    taskTemplate: byId('task-template'),
    // Dove va il colore dell'aurora in uso (applyLook): l'aurora del focus a tutto schermo e il bagliore della scheda Focus
    auroraTargets: [document.querySelector('.focus__aura'), document.querySelector('.hero__tint--focus')].filter(Boolean)
  };

  const DATED_SECTIONS = ['overdue', 'upcoming']; // nelle altre sezioni la data è già nel titolo
  const ERROR_FIELDS = ['title', 'duration', 'energy', 'date', 'time', 'repeat'];
  const FIELD_INPUTS = { title: els.title, duration: els.duration, date: els.dateInput, time: els.timeInput };
  // Le schede: nome, titolo nell'intestazione (Agenda e Motivazione, che al posto della frase ha il livello) e la loro <section>.
  const TABS = {
    focus: { name: 'Focus', section: els.tabFocus },
    agenda: { name: 'Agenda', title: 'Agenda', subtitle: 'Pianifica i tuoi giorni', section: els.tabAgenda },
    motivation: { name: 'Motivazione', title: 'Motivazione', subtitle: '', section: els.tabMotivation }
  };
  const LAST_TAB_MS = 30 * 60 * 1000; // riaprendo Aura entro 30 minuti dall'ultimo uso si riparte dall'ultima scheda

  const loaded = storage.load();
  let state = loaded.state;
  let prefs = storage.loadPrefs(); // ultima scheda e scelte di «Cosa faccio adesso?» (aura-tasks:prefs)
  let activeTab = Date.now() - prefs.lastTabAt < LAST_TAB_MS ? prefs.lastTab : 'focus';
  const tabScroll = { focus: 0, agenda: 0, motivation: 0 }; // ogni scheda ricorda dov'era arrivato lo scorrimento
  let focusCtl = null; // fogli «Cosa faccio adesso?» e Focus (js/ui-focus.js), pronti all'avvio
  let assistantCtl = null; // striscia, foglio «Aura» e foglio «Assistente» (js/ui-assistant.js), pronti all'avvio
  let settingsCtl = null; // rotella, foglio «Impostazioni» e foglio «Privacy» (js/ui-settings.js), pronti all'avvio
  let claudeCtl = null;   // foglio «Claude» e stato dei collegamenti, solo in memoria (js/ui-claude.js), pronti all'avvio
  let agendaCtl = null;   // scheda Agenda a calendario (js/ui-agenda.js), pronta all'avvio
  let motivationCtl = null; // livello, «La tua settimana» e «I tuoi numeri» (js/ui-motivation.js), pronti all'avvio
  let rewardsCtl = null;    // «I tuoi premi» e il foglio del premio (js/ui-rewards.js), pronti all'avvio
  let shopCtl = null;       // «Negozio»: la card e il foglio (js/ui-shop.js), pronti all'avvio
  let musicCtl = null;      // musica nel focus: avviso o carosello, riga «Musica», «🎧» (js/ui-music.js), pronti all'avvio
  let soundCtl = null;      // suoni del focus: «Suono» nel focus e l'ascolto di prova nel negozio (js/ui-sound.js)
  let renderedDay = null;
  let renderedPassed = 0; // attività di oggi con l'ora già passata all'ultimo disegno: quando cambia si ridisegna
  let highlightId = null; // attività appena aggiunta, da evidenziare al prossimo disegno
  let editedId = null; // attività appena modificata: solo il bagliore, senza l'entrata
  const busy = new Set(); // attività in animazione: i doppi tocchi vengono ignorati
  const pendingDone = new Set(); // spuntate, in attesa di essere completate alla fine dell'animazione della spunta
  let remote = R.load(); // collegamento al server: codice del dispositivo, promemoria, frasi di Siri in coda

  /* ---------- Stato ---------- */

  /**
   * Applica un nuovo elenco (e il registro dei punti, se cambia): salva e ridisegna, e le card scivolano al loro posto.
   * `motion` sono le opzioni di Aura.motion.play, per esempio il ritardo mentre si chiude un foglio.
   * Restituisce false (e avvisa) se il salvataggio non riesce.
   */
  function commit(nextTasks, nextStats = state.stats, motion = {}) {
    return commitState({ tasks: nextTasks, stats: nextStats }, motion);
  }

  /**
   * Come commit(), ma `change` dice quali parti dello stato cambiano: per esempio { rewards } o { stats } dai premi
   * (js/ui-rewards.js). Le altre restano com'erano.
   */
  function commitState(change, motion = {}) {
    const before = M.snapshot(els.main);
    state = { ...state, ...change };
    const saved = storage.save(state);
    render();
    const plan = M.play(els.main, before, motion);
    // Una card finita in «Completate» chiusa vola verso il titolo: quando arriva, il contatore fa un piccolo salto.
    if (plan && plan.exits.some(exit => exit.to === 'completed')) {
      setTimeout(() => M.flash(els.completedCount, 'is-bumping'), M.ms('move'));
    }
    if (!saved) showToast('Impossibile salvare: la memoria del browser è piena o disattivata.', { duration: 6000 });
    scheduleReminderSync(); // con i promemoria spenti non fa nulla
    if (focusCtl) focusCtl.sync(); // l'attività del focus completata o eliminata: la sessione si chiude
    return saved;
  }

  /** Dopo un'importazione o un ripristino: lo stato nuovo è già salvato (storage.replaceData), si ridisegna. */
  function applyState(next) {
    state = next;
    render();
    scheduleReminderSync(); // con i promemoria attivi, il server riceve l'elenco nuovo
    if (focusCtl) focusCtl.sync();
  }

  /* ---------- Schede ---------- */

  /** Barra, intestazione e sezioni secondo la scheda attiva. Quelle non attive hanno `hidden`. */
  function syncTabs() {
    T.TABS.forEach(name => { TABS[name].section.hidden = name !== activeTab; });
    els.tabButtons.forEach(button => {
      if (button.dataset.tab === activeTab) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    els.tabbar.dataset.active = activeTab; // la pillola scivola sulla scheda (CSS, con transform)
    els.hero.dataset.tab = activeTab;      // il bagliore della scheda nell'intestazione (CSS, con opacity)
    const info = TABS[activeTab];
    els.heroFocus.hidden = activeTab !== 'focus';
    els.heroTab.hidden = activeTab === 'focus';
    els.level.hidden = activeTab !== 'motivation';   // livello e, sotto, serie e punti in grande
    els.rewards.hidden = activeTab !== 'motivation';
    if (info.title) {
      els.heroTitle.textContent = info.title;
      els.heroSubtitle.textContent = info.subtitle;
      els.heroSubtitle.hidden = !info.subtitle;
    }
    syncHeroCta();
  }

  /**
   * In Focus «Cosa faccio adesso?» e in Agenda il calendario stanno a cavallo del bordo dell'intestazione, che gli lascia
   * il posto (.hero--cta). Quando la striscia compare o sparisce l'intestazione cambia altezza: va rimisurata per la fascia
   * della barra di stato.
   */
  function syncHeroCta() {
    const on = (activeTab === 'focus' && !els.suggestButton.hidden) || activeTab === 'agenda';
    if (els.hero.classList.contains('hero--cta') === on) return;
    els.hero.classList.toggle('hero--cta', on);
    measureHero();
  }

  /** Ricorda la scheda e quando è stata usata: riaprendo Aura entro 30 minuti si riparte da qui. */
  function rememberTab() {
    prefs = { ...prefs, lastTab: activeTab, lastTabAt: Date.now() };
    storage.savePrefs(prefs);
  }

  /**
   * Apre una scheda, con un movimento d'insieme (P-003, passo 3.1):
   * - lo sfondo dell'intestazione scivola dalla vecchia altezza alla nuova e il bagliore cambia colore (CSS);
   * - il contenuto della scheda entra a blocchi, uno dopo l'altro, dalla parte del cambio; quello dell'intestazione sfuma;
   * - la pillola della barra si allunga mentre scivola e si ferma con un rimbalzo; l'icona della scheda fa il suo gesto.
   * Solo transform e opacity; con «Riduci movimento» niente di tutto questo. Ogni scheda ritrova il suo scorrimento.
   */
  function showTab(tab, { animate = true } = {}) {
    if (!TABS[tab]) tab = 'focus';
    const previous = activeTab;
    if (tab === previous) return;
    const heroBefore = els.hero.offsetHeight;
    tabScroll[previous] = window.scrollY;
    activeTab = tab;
    syncTabs();
    fitStats(); // in Focus la riga dei numeri torna visibile: su due righe se serve, prima di misurare l'intestazione
    measureHero();
    window.scrollTo(0, tabScroll[tab]);
    rememberTab();
    if (!animate) return;
    const direction = T.TABS.indexOf(tab) > T.TABS.indexOf(previous) ? 1 : -1;
    M.shiftIn(els.heroBg, heroBefore - els.hero.offsetHeight);
    M.staggerIn(Array.from(TABS[tab].section.children), direction * 24);
    M.slideIn(activeTab === 'focus' ? els.heroFocus : els.heroTab, 0);
    if (activeTab === 'motivation') {
      M.slideIn(els.level, 0);
      M.slideIn(els.rewards, 0);
      if (motivationCtl) motivationCtl.enter(); // le stelle della settimana si accendono una dopo l'altra
    }
    M.flash(els.tabPill, 'is-moving');
    const button = els.tabButtons.find(item => item.dataset.tab === tab);
    if (button) M.flash(button.querySelector('.icon'), 'is-popping');
  }

  /* ---------- Disegno ---------- */

  function render() {
    const now = new Date();
    const today = utils.toISODate(now);
    const hadFocus = els.main.contains(document.activeElement) && document.activeElement !== els.main;
    const { sections, completed } = T.groupTasks(state.tasks, today);
    const focusSections = sections.filter(section => T.TAB_SECTIONS.focus.includes(section.key));
    // Attività da domani in poi: Focus vuoto le cita, con il link all'Agenda.
    const agendaCount = sections
      .filter(section => T.TAB_SECTIONS.agenda.includes(section.key))
      .reduce((sum, section) => sum + section.tasks.length, 0);

    renderHeader(now, today);
    // Focus: la striscia della proposta, In ritardo, Oggi, Senza data e «Completate oggi»
    if (assistantCtl) assistantCtl.renderStrip({ focusCount: focusSections.length });
    else els.suggestButton.hidden = focusSections.length === 0;
    syncHeroCta();
    // Sotto la striscia, l'avviso o il carosello della musica (js/ui-music.js): solo quando la striscia si vede
    if (musicCtl) musicCtl.render(!els.suggestButton.hidden);
    renderSections(els.sections, focusSections, now);
    renderCompletedToday(T.completedOn(state.tasks, today), now);
    renderEmpty(focusSections.length === 0, completed.length, agendaCount, today);
    // Agenda: calendario, giorno scelto, Prossimi giorni e Da pianificare (js/ui-agenda.js)
    if (agendaCtl) agendaCtl.render(now);
    // Motivazione: livello, «La tua settimana» e «I tuoi numeri» (js/ui-motivation.js), «I tuoi premi» (js/ui-rewards.js),
    // poi «Completate»
    if (motivationCtl) motivationCtl.render(now);
    if (rewardsCtl) rewardsCtl.render(now);
    if (shopCtl) shopCtl.render(now);
    if (soundCtl) soundCtl.render(); // «Suono» nel focus a tutto schermo: il suono in uso e quelli che hai
    applyLook();
    renderHistory(completed, now);
    renderedPassed = T.passedCount(state.tasks, now);

    // Se l'elemento che aveva il focus è stato ridisegnato, il focus resta nella lista (utile da tastiera).
    if (hadFocus && !els.main.contains(document.activeElement)) els.main.focus({ preventScroll: true });
    renderedDay = today;
    highlightId = null;
    editedId = null;
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

  /** La serie in corso, con i giorni riparati nel negozio («Ripara la serie», js/shop.js). */
  const streakOf = (stats, today) => P.currentStreak(stats.days, today, P.repairedDays(stats));

  /**
   * Quello che è in uso dal negozio: il colore dell'aurora va, come data-aurora, sui due elementi che lo usano, l'aurora del
   * focus a tutto schermo e il bagliore della scheda Focus (vedi css/style.css). Non su <html>: lì un cambio ricalcolerebbe
   * lo stile di tutta la pagina, proprio mentre partono i coriandoli dell'acquisto. La forma dei coriandoli la legge
   * burstConfetti().
   */
  function applyLook() {
    const aurora = (state.look && state.look.aurora) || SH.defaultLook().aurora;
    els.auroraTargets.forEach(node => {
      if (node.dataset.aurora !== aurora) node.dataset.aurora = aurora;
    });
  }

  /**
   * Serie (accesa se oggi c'è già un completamento) e punti: in piccolo nell'intestazione di Focus,
   * in grande in quella di Motivazione, con record, nota e barra del traguardo. Quando la serie si può riparare nel
   * negozio, la nota lo dice.
   */
  function renderRewards(today, todayTotals) {
    const { stats } = state;
    const streak = streakOf(stats, today);
    const lit = todayTotals.done > 0;
    const next = P.nextMilestone(streak);
    const isRecord = streak >= 3 && streak >= stats.bestStreak;

    els.miniStreak.classList.toggle('is-lit', lit);
    els.miniStreakValue.textContent = daysLabel(streak);
    els.miniRewards.setAttribute('aria-label', 'Serie: ' + daysLabel(streak) + '. Punti: ' + utils.formatNumber(stats.totalPoints) + '. Apri Motivazione');

    els.statStreak.classList.toggle('is-lit', lit);
    els.streakValue.textContent = daysLabel(streak);
    els.streakRecord.hidden = !isRecord && !(stats.bestStreak > streak && stats.bestStreak >= 2);
    els.streakRecordText.textContent = isRecord ? 'record!' : 'record ' + stats.bestStreak;
    els.streakProgress.style.transform = 'scaleX(' + (next ? streak / next : 1) + ')';
    if (SH.repairOffer(stats, today)) els.streakNote.textContent = 'Puoi ripararla nel negozio';
    else if (!lit) els.streakNote.textContent = streak > 0 ? 'Tienila accesa oggi' : 'Accendila oggi';
    else els.streakNote.textContent = next ? 'Traguardo: ' + daysLabel(next) : 'Tutti i traguardi!';

    els.pointsToday.textContent = '+' + utils.formatNumber(todayTotals.points) + ' oggi';
    showPoints(stats.totalPoints);
  }

  let shownPoints = null; // valore mostrato nel riquadro dei punti
  let countFrame = 0;
  let countTimer = null;

  /** Aggiorna il totale dei punti contando (--dur-reward), così si vede salire. Cambia il testo, non lo stile. */
  function showPoints(total) {
    const from = shownPoints;
    shownPoints = total;
    cancelAnimationFrame(countFrame);
    clearTimeout(countTimer);
    const show = value => {
      const text = utils.formatNumber(value);
      els.pointsValue.textContent = text;
      els.miniPointsValue.textContent = text;
    };
    const duration = M.ms('reward');
    if (from === null || from === total || !duration || document.hidden) {
      show(total);
      return;
    }
    let start = null;
    const step = now => {
      // Si parte dal primo fotogramma: misurare l'inizio con un altro orologio può dare tempi negativi.
      if (start === null) start = now;
      const progress = Math.min(1, (now - start) / duration);
      show(Math.round(from + (total - from) * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) countFrame = requestAnimationFrame(step);
    };
    countFrame = requestAnimationFrame(step);
    // Rete di sicurezza: se i fotogrammi si fermano (pagina in background), il valore finale arriva lo stesso.
    countTimer = setTimeout(() => {
      cancelAnimationFrame(countFrame);
      show(total);
    }, duration + M.ms('exit'));
  }

  /** Sezioni della lista di una scheda. `now` (Date) dice qual è oggi e quali ore sono già passate. */
  function renderSections(container, sections, now) {
    const fragment = document.createDocumentFragment();
    sections.forEach(section => {
      const el = document.createElement('section');
      el.className = 'section section--' + section.key;
      el.setAttribute('aria-labelledby', 'section-' + section.key);
      el.dataset.flip = 'section:' + section.key; // la sezione scivola come un blocco; le card solo per la parte in più

      const header = document.createElement('div');
      header.className = 'section__header';
      const title = document.createElement('h2');
      title.className = 'section__title' + (section.key === 'overdue' ? ' section__title--overdue' : '');
      title.id = 'section-' + section.key;
      title.textContent = section.title;
      const info = document.createElement('span');
      info.className = 'section__info';
      info.textContent = section.tasks.length + ' attività · ' + utils.formatDuration(section.minutes);
      header.append(title, info);

      const list = document.createElement('ul');
      list.className = 'task-list';
      const showDate = DATED_SECTIONS.includes(section.key);
      section.tasks.forEach(task => list.appendChild(buildTask(task, now, { showDate })));

      el.append(header, list);
      fragment.appendChild(el);
    });
    container.replaceChildren(fragment);
  }

  /** «Completate oggi», in fondo a Focus: chiusa, con le card che ci volano dentro. */
  function renderCompletedToday(completed, now) {
    els.completed.hidden = completed.length === 0;
    els.completedCount.textContent = completed.length;
    els.completedList.replaceChildren(...completed.map(task => buildTask(task, now)));
  }

  /**
   * «Completate» in Motivazione: tutte le completate, dalla più recente, in una sezione chiusa con il numero (si apre con
   * un tocco, come «Completate oggi» in Focus) e, dentro, «Svuota». Senza completate non c'è.
   */
  function renderHistory(completed, now) {
    els.history.hidden = completed.length === 0;
    els.historyCount.textContent = completed.length;
    els.historyList.replaceChildren(...completed.map(task => buildTask(task, now)));
  }

  function renderEmpty(isEmpty, completedCount, agendaCount, today) {
    els.empty.hidden = !isEmpty;
    if (!isEmpty) return;
    const allDone = completedCount > 0;
    const streak = streakOf(state.stats, today);
    const lit = P.dayTotals(state.stats, today).done > 0;
    const upcoming = agendaCount === 1 ? 'Hai 1 attività nei prossimi giorni.' : 'Hai ' + agendaCount + ' attività nei prossimi giorni.';
    els.emptyAgendaLink.hidden = agendaCount === 0;
    if (!allDone && agendaCount > 0) {
      els.emptyTitle.textContent = 'Niente per oggi ✨';
      els.emptyText.textContent = upcoming;
      return;
    }
    els.emptyTitle.textContent = allDone ? 'Hai fatto tutto! 🎉' : 'Tutto libero ✨';
    if (!allDone) els.emptyText.textContent = 'Aggiungi la tua prima attività con il pulsante qui sotto.';
    else if (lit && streak >= 2) els.emptyText.textContent = 'Serie di ' + daysLabel(streak) + ' 🔥: domani continuala.';
    else if (agendaCount > 0) els.emptyText.textContent = 'Goditi il momento. ' + upcoming;
    else els.emptyText.textContent = 'Goditi il momento, oppure aggiungi una nuova attività.';
  }

  /**
   * Card di un'attività, copiata dal <template> e riempita con textContent. `now` (Date): oggi, e le ore già passate.
   * Opzioni: `showDate` aggiunge il giorno; `showTime: false` toglie l'ora (in «Con orario» dell'Agenda sta a sinistra).
   */
  function buildTask(task, now, { showDate = false, showTime = true } = {}) {
    const today = utils.toISODate(now);
    const node = els.taskTemplate.content.firstElementChild.cloneNode(true);
    const energy = T.ENERGY[task.energy];
    const pending = pendingDone.has(task.id); // spuntata da poco: resta spuntata e barrata anche se la lista si ridisegna
    node.dataset.id = task.id;
    node.dataset.flip = 'task:' + task.id;
    node.classList.toggle('is-done', task.done);
    node.classList.toggle('task--pending', pending);
    if (task.id === highlightId) node.classList.add('task--new');
    else if (task.id === editedId) node.classList.add('task--edited');

    const checkbox = node.querySelector('.check__input');
    checkbox.checked = task.done || pending;
    checkbox.setAttribute('aria-label', (task.done ? 'Segna come da fare: ' : 'Segna come completata: ') + task.title);

    node.querySelector('.task__title').textContent = task.title;
    node.querySelector('.task__edit').setAttribute('aria-label', 'Modifica: ' + task.title);
    const atMeta = node.querySelector('.meta--at');
    if (task.time && showTime) {
      node.querySelector('.meta__at').textContent = task.time;
      // Oggi, con l'ora già passata: rossa come «Ieri», e detta anche al lettore di schermo.
      if (T.isTimePassed(task, now)) {
        atMeta.classList.add('meta--overdue');
        atMeta.querySelector('.sr-only').textContent = 'In ritardo, era alle';
      }
    } else {
      atMeta.remove();
    }
    // ↻ accanto all'ora, solo sulla ripetizione da fare: il lettore di schermo legge la regola (P-005, passo 5.1).
    const repeatMeta = node.querySelector('.meta--repeat');
    if (!task.done && task.repeat) repeatMeta.querySelector('.sr-only').textContent = RP.spokenLabel(task.repeat);
    else repeatMeta.remove();
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
      pendingDone.add(id);
      node.classList.add('task--completing');
      const task = state.tasks.find(t => t.id === id);
      if (task) floatPoints(P.pointsFor(task), node.querySelector('.check').getBoundingClientRect());
    }
    // Completando, la spunta salta al suo posto; poi la card scivola in «Completate» (Aura.motion, in commit()).
    later(done ? M.ms('move') : 0, () => {
      busy.delete(id);
      pendingDone.delete(id);
      const firstToday = done && P.dayTotals(state.stats, utils.todayISO()).done === 0;
      const result = P.setDone(state, id, done, Date.now());
      if (result.tasks === state.tasks) return; // niente da cambiare
      if (!commit(result.tasks, result.stats) || !done) return;
      celebrate(id, result, firstToday);
    });
  }

  /** Serie e punti che si vedono adesso, per gli effetti: in piccolo in Focus, in grande in Motivazione, nessuno in Agenda. */
  function rewardTargets() {
    if (activeTab === 'focus') return { streak: els.miniStreak, points: els.miniPoints, glow: null }; // il chip ha il suo bagliore
    if (activeTab === 'motivation') return { streak: els.statStreak, points: els.statPoints, glow: els.rewards };
    return null;
  }

  /**
   * Dopo un completamento: avviso con i punti, e festa se la serie si accende o tocca un traguardo.
   * L'avviso dice anche il livello nuovo («✨ Livello Stella»), la settimana che diventa una costellazione (una volta per
   * settimana, vedi js/ui-motivation.js) e il premio che si può riscattare da adesso (js/ui-rewards.js). `focus`
   * ({ minutes, day }): minuti di focus registrati insieme, detti nell'avviso e tolti anche da «Annulla».
   */
  function celebrate(id, result, firstToday, focus) {
    const milestone = result.reached.length ? Math.max(...result.reached) : 0;
    const progress = motivationCtl ? motivationCtl.celebrate(result) : { level: null, reached: false };
    const ready = rewardsCtl ? rewardsCtl.celebrate(result) : null;
    const targets = rewardTargets();
    if (firstToday && targets) M.flash(targets.streak, 'is-igniting');
    if (milestone) {
      vibrate([20, 60, 30, 60, 50]);
      if (targets) {
        M.flash(targets.streak, 'is-celebrating');
        if (targets.glow) M.flash(targets.glow, 'is-celebrating'); // riquadro grande: il bagliore sta in un livello della griglia, fuori dal riquadro
      }
      const tile = targets ? targets.streak.getBoundingClientRect() : null;
      const tileVisible = Boolean(tile) && tile.bottom > 0;
      burstConfetti(tileVisible ? tile.left + tile.width / 2 : window.innerWidth / 2, tileVisible ? tile.top + tile.height / 2 : 96);
    }

    const points = '+' + result.points + ' punti';
    let message = 'Completata · ' + points;
    if (milestone) message = '🎉 ' + daysLabel(milestone) + ' di fila! · ' + points;
    else if (progress.level) message = '✨ Livello ' + progress.level.name + ' · ' + points;
    else if (progress.reached) message = '🌌 Obiettivo della settimana raggiunto · ' + points;
    else if (ready) message = RW.readyText(ready) + ' · ' + points;
    else if (firstToday) message = (result.streak === 1 ? '🔥 Serie iniziata · ' : '🔥 ' + daysLabel(result.streak) + ' di fila · ') + points;
    if (focus) message += ' · ' + utils.formatDuration(focus.minutes) + ' di focus';
    // Una ripetizione: l'avviso dice quando torna (P-005, passo 5.1).
    if (result.next) message += ' · torna ' + RP.returnLabel(result.next.date, utils.todayISO());
    const special = Boolean(milestone || progress.level || progress.reached || ready);

    showToast(message, {
      action: 'Annulla',
      duration: special ? 6500 : undefined,
      onAction: () => {
        // Prima esce la prossima volta, se è ancora quella creata adesso (da fare, né modificata né saltata): così questa
        // torna da fare con la sua regola. Se nel frattempo è cambiata resta, con le modifiche, e questa torna da fare
        // senza ripetersi (Aura.tasks.toggleDone): la serie ha sempre una sola volta da fare.
        const next = result.next && state.tasks.find(t => t.id === result.next.id && !t.done && T.sameFields(t, result.next));
        const tasks = next ? T.removeTask(state.tasks, next.id).tasks : state.tasks;
        const undo = P.setDone({ ...state, tasks }, id, false, Date.now());
        commit(undo.tasks, focus ? F.recordMinutes(undo.stats, focus.day, -focus.minutes) : undo.stats);
      }
    });
  }

  /**
   * Dopo «Ripara la serie» (js/ui-shop.js): la fiamma si riaccende; se la serie riparata tocca un traguardo, il riquadro
   * fa la festa dei traguardi. Solo dove serie e punti si vedono.
   */
  function celebrateRepair(reached) {
    const targets = rewardTargets();
    if (!targets) return;
    M.flash(targets.streak, reached.length ? 'is-celebrating' : 'is-igniting');
    if (reached.length && targets.glow) M.flash(targets.glow, 'is-celebrating');
  }

  /**
   * Completa un'attività senza la spunta: «Fatto» di «Cosa faccio adesso?» e «Completa» del focus.
   * Stessi punti, stessa festa e stesso «Annulla» della spunta. `focus` ({ minutes, day }) registra i minuti di focus
   * nello stesso salvataggio; `delay` è il tempo di chiusura del foglio, così la card si vede scivolare.
   * Restituisce false se l'attività non c'è, è già completata o si sta animando.
   */
  function completeTask(id, { delay = 0, focus = null } = {}) {
    const task = state.tasks.find(t => t.id === id);
    if (!task || task.done || busy.has(id)) return false;
    const firstToday = P.dayTotals(state.stats, utils.todayISO()).done === 0;
    const result = P.setDone(state, id, true, Date.now());
    let stats = result.stats;
    let focusInfo = null;
    if (focus && focus.minutes) {
      const before = F.minutesOn(stats, focus.day);
      stats = F.recordMinutes(stats, focus.day, focus.minutes);
      const applied = F.minutesOn(stats, focus.day) - before;
      if (applied) focusInfo = { minutes: applied, day: focus.day };
    }
    const check = TABS[activeTab].section.querySelector('.task[data-id="' + CSS.escape(id) + '"] .check');
    const from = check ? check.getBoundingClientRect() : null;
    if (!commit(result.tasks, stats, { delay })) return true;
    if (from) setTimeout(() => floatPoints(result.points, from), delay);
    celebrate(id, result, firstToday, focusInfo);
    return true;
  }

  /** "+24" che sale dalla spunta (`from` è il suo rettangolo) e, se serie e punti si vedono, vola nel riquadro dei punti. */
  function floatPoints(points, from) {
    if (!M.canAnimate() || !from) return;
    const targets = rewardTargets();
    const target = targets ? targets.points.getBoundingClientRect() : null;
    const toTile = Boolean(target) && target.bottom > 0 && target.top < window.innerHeight;
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
    const dx = toTile ? target.left + target.width / 2 - (from.left + from.width / 2) : 0;
    const dy = toTile ? target.top + target.height / 2 - (from.top + from.height / 2) : 0;
    const animation = chip.animate([
      frame(0, 0, 0.5, 0, 0),
      frame(0, -34, 1.12, 1, 0.25),
      frame(0, -46, 1, 1, 0.45),
      toTile ? frame(dx, dy, 0.45, 0.2, 1) : frame(0, -84, 0.9, 0, 1)
    ], { duration: M.ms('celebrate'), easing: M.ease('in-out'), fill: 'forwards' });

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      chip.remove();
      if (toTile) M.flash(targets.points, 'is-bumping');
    };
    animation.finished.then(finish, finish);
    setTimeout(finish, M.ms('celebrate') + M.ms('move')); // rete di sicurezza
  }

  const CONFETTI_PIECES = 28;

  /**
   * Pioggia di coriandoli per i traguardi: dura poco più di un secondo, poi sparisce. La forma è quella in uso dal negozio
   * (data-shape; «classic» = rettangoli e cerchi). `host` è un foglio aperto, se i coriandoli partono da lì: un foglio
   * copre la pagina, quindi vanno dentro il foglio (restano fissi sullo schermo, come nella pagina).
   */
  function burstConfetti(x, y, host) {
    if (!M.canAnimate()) return;
    const layer = document.createElement('div');
    layer.className = 'confetti';
    layer.setAttribute('aria-hidden', 'true');
    layer.dataset.shape = (state.look && state.look.confetti) || SH.defaultLook().confetti;
    layer.style.left = x + 'px';
    layer.style.top = y + 'px';
    (host && host.open ? host : document.body).appendChild(layer);

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
      ], { duration: M.ms('celebrate') * (1 + Math.random() * 0.27), easing: M.ease('out'), fill: 'forwards' }));
    }

    let removed = false;
    const cleanup = () => {
      if (removed) return;
      removed = true;
      layer.remove();
    };
    Promise.all(animations.map(animation => animation.finished)).then(cleanup, cleanup);
    setTimeout(cleanup, M.ms('celebrate') * 2); // rete di sicurezza
  }

  /**
   * Elimina subito: la card esce scivolando a destra mentre le altre salgono al suo posto (Aura.motion, in commit()).
   * `slideX`: px dello scivolamento, quando la card è stata fatta scorrere verso sinistra (js/ui-swipe.js), così continua
   * il gesto. Restituisce true se l'ha eliminata.
   */
  function onDelete(id, slideX) {
    if (busy.has(id)) return false; // sta finendo di completarsi
    const { tasks: next, removed, index } = T.removeTask(state.tasks, id);
    if (!removed || !commit(next, undefined, { slide: 'task:' + id, slideX })) return false;
    showToast('Attività eliminata', {
      action: 'Annulla',
      onAction: () => commit(T.restoreTask(state.tasks, removed, index))
    });
    return true;
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

  /**
   * L'avviso sta nella pagina oppure dentro `host`, un foglio aperto: un foglio copre la pagina e la rende inerte, quindi
   * l'avviso si vede (e il lettore di schermo lo legge) solo se è dentro il foglio. js/ui-shop.js ce lo porta appena apre
   * il suo foglio, così la regione live (role="status") c'è già prima del primo messaggio.
   */
  function hostToast(host) {
    const target = host && host.open ? host : document.body;
    if (els.toast.parentNode !== target) target.appendChild(els.toast);
  }

  /**
   * `options`: `action` e `onAction` (il pulsante, per esempio «Annulla»), `duration` (ms) e `host`, un foglio aperto
   * (vedi hostToast). Quando il foglio comincia a chiudersi, l'avviso torna nella pagina (closeSheet).
   */
  function showToast(message, options = {}) {
    hostToast(options.host);
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
    toastTimer = setTimeout(() => { els.toastText.textContent = ''; }, M.ms('move'));
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
    // Un avviso dentro il foglio torna subito nella pagina: resta fermo al suo posto mentre il foglio scende (dentro il
    // foglio scenderebbe con lui e poi ricomparirebbe più in alto)
    if (els.toast.parentNode === dialog) hostToast(null);
    dialog.classList.add('is-closing');
    dialog.addEventListener('animationend', onEnd);
    timer = setTimeout(finish, M.ms('exit') + M.ms('quick')); // rete di sicurezza se animationend non arriva
    closing.set(dialog, finish);
  }

  /**
   * Comportamento comune dei fogli. Opzioni (per il focus a tutto schermo):
   * - onCancel: cosa fanno Esc e il gesto "indietro" al posto della chiusura;
   * - backdropClose: false se un tocco fuori non deve chiudere.
   */
  function setupSheet(dialog, { onCancel = null, backdropClose = true } = {}) {
    // Tasto Esc o gesto "indietro" su Android: chiusura animata.
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      if (onCancel) onCancel();
      else closeSheet(dialog);
    });
    // Chiusure "native" (per esempio Esc quando il browser non permette di animarla).
    dialog.addEventListener('close', () => {
      releaseScroll();
      onSheetClosed(dialog);
    });
    dialog.querySelectorAll('[data-close]').forEach(button => {
      button.addEventListener('click', () => closeSheet(dialog));
    });
    if (!backdropClose) return;
    // Tocco sullo sfondo scuro: chiude (solo se anche la pressione è iniziata sullo sfondo).
    let pressedBackdrop = false;
    dialog.addEventListener('pointerdown', event => { pressedBackdrop = event.target === dialog; });
    dialog.addEventListener('click', event => {
      if (event.target === dialog && pressedBackdrop) closeSheet(dialog);
      pressedBackdrop = false;
    });
  }

  /** Decide chi riceve il focus all'apertura di un foglio (attributo autofocus letto da showModal). */
  function setAutofocus(dialog, target) {
    dialog.querySelectorAll('[autofocus]').forEach(el => el.removeAttribute('autofocus'));
    target.setAttribute('autofocus', '');
  }

  /**
   * Appena aperto, un foglio riparte dall'inizio; con `heading` (il titolo di un riquadro) parte da quel riquadro.
   * Serve alle righe di «Impostazioni», che aprono un foglio su una sua parte («Comando Rapido di Siri»).
   */
  function showPart(dialog, heading) {
    const body = dialog.querySelector('.sheet__body');
    if (!body) return;
    const panel = heading ? heading.closest('.panel') || heading : null;
    body.scrollTop = panel ? Math.max(0, panel.offsetTop - body.offsetTop) : 0;
  }

  /**
   * Chiude tutti i fogli aperti, uno sopra l'altro (non il focus a tutto schermo). Serve quando l'esito è un avviso
   * in basso, che sta sotto i fogli: «Dispositivo scollegato» con «Annulla», oppure un'attività da mostrare.
   */
  function closeAllSheets() {
    document.querySelectorAll('dialog.sheet[open]:not(.sheet--focus)').forEach(dialog => closeSheet(dialog));
  }

  /* ---------- Foglio "Nuova attività" (e "Modifica attività") ---------- */

  let editingId = null; // attività che si sta modificando; null = nuova attività. Si imposta a ogni apertura.
  let focusAfterEdit = null; // card che riceve il focus quando il foglio si è chiuso dopo una modifica
  let repeatRule = null;    // «Si ripete»: la regola scelta nel foglio, oppure null («Mai»)
  let repeatFollows = true; // true se la regola prende il giorno dalla data: cambiando data, cambia anche lei
  let repeatKept = false;   // una volta completata: il campo non si vede e la regola resta quella salvata

  /** Svuota il foglio. In modifica cambiano titolo e pulsante, e spariscono la frase libera e la riga di Siri. */
  function resetAddSheet(editing) {
    focusAfterEdit = null;
    els.form.reset();
    setErrors({});
    els.inboxNote.hidden = true;
    els.editNote.hidden = true;
    els.editFocus.hidden = true;
    els.phraseField.hidden = editing;
    els.addHeading.textContent = editing ? 'Modifica attività' : 'Nuova attività';
    els.submitText.textContent = editing ? 'Salva modifiche' : 'Aggiungi attività';
    els.submitIcon.setAttribute('href', editing ? '#i-check' : '#i-plus');
    els.dateInput.min = utils.todayISO();
    phraseBase = null;
    els.phraseSummary.textContent = PHRASE_HINT;
    repeatRule = null;
    repeatFollows = true;
    repeatKept = false;
    els.repeatField.hidden = false;
  }

  /**
   * Apre il foglio vuoto, oppure già compilato da una frase (dal link ?add= o dalla casella di Siri).
   * `note` è la riga sopra la frase, per esempio "Da Siri · 1 di 2". `preset` ({ date, time }) scrive già giorno e ora:
   * dall'Agenda, il giorno scelto nel calendario e l'inizio di uno spazio libero.
   */
  function openAddSheet(phrase, note, preset) {
    resetAddSheet(false);
    editingId = null;
    els.inboxNoteText.textContent = note || '';
    els.inboxNote.hidden = !note;
    if (preset) {
      els.dateInput.value = preset.date || '';
      els.timeInput.value = preset.time || '';
    }
    syncDuration();
    syncEnergyHint();
    syncDate(); // l'ora resta solo con un giorno valido
    if (phrase) {
      els.phrase.value = phrase;
      applyPhrase();
    }
    // Sul computer si scrive subito; sul telefono prima si vede tutto il modulo (la tastiera ne coprirebbe metà).
    // Con una frase già capita si mostra il risultato, da controllare prima di "Aggiungi".
    setAutofocus(els.addSheet, finePointer.matches && !phrase ? els.title : els.addHeading);
    openSheet(els.addSheet);
  }

  /** Apre il foglio per modificare un'attività, già compilato. Anche le completate: i loro punti non cambiano. */
  function openEditSheet(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task || busy.has(id)) return; // card in animazione (completamento o eliminazione)
    resetAddSheet(true);
    editingId = id;
    repeatKept = task.done; // prima di writeFields(), che passa da syncDate()
    const fields = T.editableFields(task);
    // Un'attività in ritardo tiene il suo giorno: il calendario non deve escluderlo.
    if (fields.date && fields.date < els.dateInput.min) els.dateInput.min = fields.date;
    writeFields({
      title: fields.title,
      duration: String(fields.duration),
      energy: fields.energy,
      date: fields.date || '',
      time: fields.time || '',
      repeat: fields.repeat
    });
    // Una volta completata tiene la sua regola, ma la regola vive in quella da fare: qui «Si ripete» non si vede.
    els.repeatField.hidden = task.done;
    syncRepeat();
    if (task.done) {
      const points = task.pointsAwarded || 0;
      els.editNoteText.textContent = 'Completata · ' + (points === 1 ? 'il suo punto non cambia' : 'i suoi ' + utils.formatNumber(points) + ' punti non cambiano');
      els.editNote.hidden = false;
    }
    els.editFocus.hidden = task.done; // «Inizia focus» solo per le attività da fare
    setAutofocus(els.addSheet, finePointer.matches ? els.title : els.addHeading);
    openSheet(els.addSheet);
  }

  /**
   * «Inizia focus» nel foglio di modifica: salva le modifiche fatte (se sono valide) e apre il focus a tutto schermo
   * su questa attività, con la durata appena scritta.
   */
  function onFocusFromEdit() {
    const id = editingId;
    if (!id) return;
    const { value, errors } = T.validateInput(readFields());
    setErrors(errors);
    const firstError = ERROR_FIELDS.find(field => errors[field]);
    if (firstError) {
      if (FIELD_INPUTS[firstError]) FIELD_INPUTS[firstError].focus();
      return;
    }
    const result = T.updateTask(state.tasks, id, value);
    if (result.changed) {
      editedId = id;
      if (!commit(result.tasks, undefined, { delay: M.ms('exit') })) return;
    }
    closeSheet(els.addSheet);
    focusCtl.startFocus(id); // dentro il tocco: sblocca anche il suono di fine
  }

  /**
   * «Salta questa volta» nel foglio di modifica (P-005, passo 5.1): salva le modifiche fatte (se sono valide), poi la
   * ripetizione passa al giorno di Aura.repeat.afterSkip(), senza punti. «Annulla» la rimette nel suo giorno.
   */
  function onSkipFromEdit() {
    const id = editingId;
    if (!id) return;
    const { value, errors } = T.validateInput(readFields());
    setErrors(errors);
    const firstError = ERROR_FIELDS.find(field => errors[field]);
    if (firstError) {
      if (FIELD_INPUTS[firstError]) FIELD_INPUTS[firstError].focus();
      return;
    }
    const today = utils.todayISO();
    const edited = T.updateTask(state.tasks, id, value);
    const skipped = T.skipOccurrence(edited.tasks, id, today);
    if (!skipped.previous) {
      closeSheet(els.addSheet);
      return;
    }
    editedId = id;
    const saved = commit(skipped.tasks, undefined, { delay: M.ms('exit') });
    focusAfterEdit = saved ? id : null;
    closeSheet(els.addSheet);
    if (!saved) return;
    const previousDate = skipped.previous.date;
    const moved = state.tasks.find(t => t.id === id);
    const where = moved && !isVisibleIn(moved, activeTab, today) ? ' · ora in ' + TABS[T.tabOf(moved, today)].name : '';
    showToast('Spostata a ' + RP.dayLabel(skipped.date, today) + where, {
      action: 'Annulla',
      onAction: () => {
        const task = state.tasks.find(t => t.id === id);
        if (task && !task.done && task.date === skipped.date) commit(state.tasks.map(t => (t.id === id ? { ...t, date: previousDate } : t)));
      }
    });
    revealTask(id);
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
      time: els.timeInput.value,
      // Una volta completata tiene la regola salvata; senza giorno, però, non si ripete (una regola vuole un giorno).
      repeat: repeatKept && !utils.isISODate(els.dateInput.value) ? null : repeatRule
    };
  }

  function writeFields(values) {
    els.title.value = values.title;
    els.duration.value = values.duration;
    const radio = els.form.querySelector('input[name="energy"][value="' + values.energy + '"]');
    if (radio) radio.checked = true;
    els.dateInput.value = values.date;
    els.timeInput.value = values.time;
    repeatRule = values.repeat || null;
    repeatFollows = followsDate(repeatRule, values.date);
    syncDuration();
    syncEnergyHint();
    syncDate(); // abilita l'ora solo se c'è un giorno; senza giorno «Si ripete» torna «Mai»
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
    if (parsed.repeat) next.repeat = parsed.repeat;
    writeFields(next);
    setErrors({});
    els.phraseSummary.textContent = phraseSummary(parsed);
  }

  /** "Capito: Domani · alle 10:00 · 30 min · energia alta". */
  function phraseSummary(parsed) {
    if (!els.phrase.value.trim()) return PHRASE_HINT;
    const parts = [];
    if (parsed.date) parts.push(utils.formatDateLabel(parsed.date, utils.todayISO()));
    if (parsed.repeat) parts.push(RP.label(parsed.repeat).toLowerCase());
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
    // Anche la ripetizione: senza giorno torna «Mai»; cambiando giorno, una regola che lo segue si sposta con lui. Non
    // per una volta completata (repeatKept): la sua regola, che il foglio non mostra, resta quella salvata, così se torna
    // da fare riparte con la regola giusta (vedi readFields()).
    if (repeatKept) {
      // niente da cambiare
    } else if (!valid) {
      repeatRule = null;
    } else if (repeatRule && repeatFollows) {
      const derived = RP.fromKind(repeatRule.every, value);
      if (!RP.same(derived, repeatRule)) repeatRule = derived; // uguale: resta quella di prima, con i suoi campi
    }
    syncRepeat();
  }

  /* ---------- «Si ripete» (P-005, passo 5.1) ---------- */

  /** true se la regola è quella che la data darebbe da sola (un solo giorno della settimana, o il giorno del mese). */
  function followsDate(rule, date) {
    if (!rule || !utils.isISODate(date)) return true;
    return rule.every === 'day' || RP.same(rule, RP.fromKind(rule.every, date));
  }

  function syncRepeat() {
    const kind = repeatRule ? repeatRule.every : 'none';
    els.repeatChips.querySelectorAll('[data-repeat]').forEach(chip => {
      chip.setAttribute('aria-pressed', String(chip.dataset.repeat === kind));
    });
    const weekly = kind === 'week';
    els.repeatDays.hidden = !weekly;
    els.repeatDays.querySelectorAll('[data-day]').forEach(button => {
      button.setAttribute('aria-pressed', String(weekly && repeatRule.days.includes(Number(button.dataset.day))));
    });
    const date = els.dateInput.value;
    const today = utils.todayISO();
    const hint = repeatRule && utils.isISODate(date)
      ? RP.label(repeatRule) + ' · dopo questa, ' + RP.dayLabel(RP.afterDone(repeatRule, date, today), today)
      : '';
    // Solo se cambia: la riga è una regione «live», e riscriverla uguale (a ogni lettera della frase) la ripeterebbe
    if (els.repeatHint.textContent !== hint) els.repeatHint.textContent = hint;
    const task = editingId ? state.tasks.find(t => t.id === editingId) : null;
    els.repeatSkip.hidden = !(task && !task.done && repeatRule);
  }

  /** Una chip di «Si ripete». Senza un giorno, la data diventa il primo giorno giusto da oggi (oggi compreso). */
  function pickRepeat(kind) {
    phraseBase = null; // una scelta fatta a mano: la frase non la riporta indietro
    setError('repeat', null);
    if (kind === 'none') {
      repeatRule = null;
      syncRepeat();
      return;
    }
    if (repeatRule && repeatRule.every === kind) return;
    const date = els.dateInput.value;
    if (utils.isISODate(date)) {
      repeatRule = RP.fromKind(kind, date);
    } else {
      const today = utils.todayISO();
      repeatRule = RP.fromKind(kind, today);
      els.dateInput.value = RP.onOrAfter(repeatRule, today);
    }
    repeatFollows = true;
    syncDate();
  }

  /** Un giorno della settimana acceso o spento; almeno uno resta acceso. */
  function toggleRepeatDay(day) {
    if (!repeatRule || repeatRule.every !== 'week') return;
    phraseBase = null;
    const on = repeatRule.days.includes(day);
    if (on && repeatRule.days.length === 1) return;
    const days = on ? repeatRule.days.filter(d => d !== day) : repeatRule.days.concat(day);
    repeatRule = RP.clean({ ...repeatRule, days });
    repeatFollows = followsDate(repeatRule, els.dateInput.value);
    syncRepeat();
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
    const { value, errors } = T.validateInput(readFields());
    setErrors(errors);
    const firstError = ERROR_FIELDS.find(field => errors[field]);
    if (firstError) {
      if (FIELD_INPUTS[firstError]) FIELD_INPUTS[firstError].focus();
      return;
    }
    if (editingId) {
      saveEdit(editingId, value);
      return;
    }

    const task = T.createTask(value, Date.now());
    const isFirst = state.tasks.length === 0;
    highlightId = task.id;
    // Le card si muovono mentre il foglio si chiude, così la nuova si vede entrare.
    const saved = commit(state.tasks.concat(task), undefined, { delay: M.ms('exit') });
    closeSheet(els.addSheet);
    if (!saved) return;
    if (isFirst) storage.requestPersistence();
    // Finita dove non si vede (per esempio domani, vista da Focus): l'avviso dice dove, e «Mostra» la porta in vista.
    const today = utils.todayISO();
    const tab = T.tabOf(task, today);
    if (!isVisibleIn(task, activeTab, today)) {
      showToast('Attività aggiunta in ' + TABS[tab].name + (task.date ? ' · ' + utils.formatDateLabel(task.date, today) : ''), {
        action: 'Mostra',
        onAction: () => showTask(task.id)
      });
      return;
    }
    // La prima volta si dice anche come correggerla.
    showToast(isFirst ? 'Attività aggiunta: toccala per modificarla' : 'Attività aggiunta');
    revealTask(task.id);
  }

  /**
   * Salva una modifica: cambiano solo i campi del modulo, mentre completamento, punti e registro restano com'erano.
   * "Annulla" rimette i campi di prima, anche se nel frattempo l'attività è stata completata.
   */
  function saveEdit(id, value) {
    const result = T.updateTask(state.tasks, id, value);
    if (!result.changed) {
      closeSheet(els.addSheet);
      if (!result.previous) showToast('Questa attività non c\'è più'); // eliminata in un'altra scheda
      return;
    }
    editedId = id;
    const saved = commit(result.tasks, undefined, { delay: M.ms('exit') }); // il registro dei punti resta quello di prima
    // Il pulsante che aveva aperto il foglio è stato ridisegnato: chiuso il foglio, il focus va sulla card nuova.
    focusAfterEdit = saved ? id : null;
    closeSheet(els.addSheet);
    if (!saved) return;
    const before = T.editableFields(result.previous);
    // Spostata in un'altra scheda (per esempio a domani, da Focus): l'avviso dice dove è finita.
    const today = utils.todayISO();
    const edited = state.tasks.find(t => t.id === id);
    const moved = edited && !isVisibleIn(edited, activeTab, today);
    showToast(moved ? 'Modifiche salvate · ora in ' + TABS[T.tabOf(edited, today)].name : 'Modifiche salvate', {
      action: 'Annulla',
      onAction: () => {
        const undo = T.updateTask(state.tasks, id, before);
        if (undo.changed) commit(undo.tasks);
      }
    });
    revealTask(id);
  }

  /**
   * true se l'attività si vede adesso nella scheda `tab`. Per l'Agenda dipende anche dal giorno scelto nel calendario:
   * un'attività di oggi, per esempio, ci si vede solo con oggi scelto (vedi Aura.agenda.isInAgenda).
   */
  function isVisibleIn(task, tab, today) {
    if (tab === 'agenda' && agendaCtl) return agendaCtl.isVisible(task, today);
    return T.isInTab(task, tab, today);
  }

  /** La card di un'attività nella scheda attiva (la stessa attività può avere una card anche in un'altra scheda). */
  function cardOf(id) {
    return TABS[activeTab].section.querySelector('.task[data-id="' + CSS.escape(id) + '"]');
  }

  /**
   * Porta in vista la card appena aggiunta o modificata, dopo la chiusura del foglio. Se sta in una sezione chiusa
   * («Completate oggi» in Focus, «Completate» in Motivazione), prima la apre.
   */
  function revealTask(id) {
    const node = cardOf(id);
    if (!node) return;
    const closed = node.closest('details:not([open])');
    if (closed) closed.open = true;
    later(M.ms('move'), () => node.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'auto' : 'smooth' }));
  }

  /* ---------- Foglio "Backup dei dati" ---------- */

  const BACKUP_MAX_BYTES = 5 * 1024 * 1024; // un backup vero pesa pochi kB; il localStorage ne contiene circa 5 MB
  const CONFIRM_TEXTS = {
    import: {
      title: 'Importare questo backup?',
      source: 'Nel file',
      when: 'Esportato: ',
      text: 'Attività, punti, serie, premi e acquisti del negozio di adesso verranno sostituiti. Prima ne salvo una copia su questo dispositivo.',
      ok: 'Sostituisci'
    },
    restore: {
      title: 'Ripristinare i dati di prima dell\'importazione?',
      source: 'Nella copia',
      when: 'Salvata: ',
      text: 'Attività, punti, serie, premi e acquisti del negozio di adesso verranno sostituiti da quelli della copia.',
      ok: 'Ripristina'
    }
  };

  let backupBusy = false;
  let pendingBackup = null; // dati in attesa di «Sostituisci» o «Ripristina»: { kind: 'import' | 'restore', state, when }

  const tasksLabel = count => count + ' attività';
  const pointsLabel = points => (points === 1 ? '1 punto' : utils.formatNumber(points) + ' punti');
  const prizesLabel = count => (count === 1 ? '1 premio' : count + ' premi');
  const purchasesLabel = count => (count === 1 ? '1 acquisto' : count + ' acquisti');
  // «12 attività · 1240 punti», più « · 3 premi» e « · 2 acquisti» (nel negozio) se ce ne sono
  const dataLabel = data => tasksLabel(data.tasks.length) + ' · ' + pointsLabel(data.stats.totalPoints) +
    (data.rewards && data.rewards.length ? ' · ' + prizesLabel(data.rewards.length) : '') +
    (data.stats.shop && data.stats.shop.length ? ' · ' + purchasesLabel(data.stats.shop.length) : '');
  const momentLabel = ms => (ms ? utils.formatMoment(ms, utils.todayISO()) : 'data sconosciuta');

  /** Il foglio riparte sempre dallo stato normale: una scelta lasciata a metà si perde (non si conta sull'evento close). */
  function openBackupSheet() {
    pendingBackup = null;
    setBackupMessage(null);
    syncBackupUI();
    setAutofocus(els.backupSheet, els.backupHeading);
    openSheet(els.backupSheet);
  }

  /** Foglio normale (esporta, importa, ripristina) oppure riepilogo prima di sostituire i dati. */
  function syncBackupUI() {
    const confirming = Boolean(pendingBackup);
    els.backupMain.hidden = confirming;
    els.backupConfirm.hidden = !confirming;
    els.backupIosHint.hidden = !R.isIOS();
    // Il ripristino si vede finché esiste la copia dei dati di prima dell'ultima importazione.
    const copy = confirming ? null : storage.loadBeforeImport();
    els.backupRestore.hidden = !copy;
    if (copy) els.backupRestoreWhen.textContent = 'Copia salvata: ' + momentLabel(copy.savedAt);
    els.backupExport.disabled = backupBusy;
    els.backupImport.disabled = backupBusy;
    els.backupSheet.setAttribute('aria-busy', String(backupBusy));
  }

  function setBackupMessage(text, tone) {
    els.backupStatus.hidden = !text;
    if (!text) return;
    els.backupStatus.textContent = text;
    els.backupStatus.dataset.tone = tone || 'warn';
  }

  /** "Esporta il backup": su iPhone e iPad il foglio di condivisione (Salva su File, AirDrop…), altrove un download. */
  async function onExport() {
    if (backupBusy) return;
    const file = storage.backupFile(state, Date.now());
    // Su iPhone, nell'app installata, un download apre una schermata senza via d'uscita: meglio condividere il file.
    const shared = R.isIOS() ? shareableFile(file) : null;
    if (!shared) {
      downloadFile(file);
      setBackupMessage('Backup scaricato (' + file.name + '): tienilo in un posto tuo.', 'on');
      return;
    }
    // Subito, senza attese prima: Safari apre la condivisione solo dentro il tocco.
    let sharing;
    try {
      sharing = Promise.resolve(navigator.share({ files: [shared] }));
    } catch (err) {
      sharing = Promise.reject(err);
    }
    backupBusy = true;
    syncBackupUI();
    try {
      await sharing;
      setBackupMessage('Backup pronto: tienilo in un posto tuo, per esempio il tuo iCloud Drive.', 'on');
    } catch (err) {
      // Condivisione chiusa senza scegliere niente: non è un errore.
      setBackupMessage(err && err.name === 'AbortError' ? null : 'Non sono riuscito ad aprire la condivisione: riprova.');
    }
    backupBusy = false;
    syncBackupUI();
  }

  /** Il file da condividere, se il browser lo accetta: prima come JSON, poi come testo. Altrimenti null. */
  function shareableFile({ name, text }) {
    if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function' || typeof File !== 'function') return null;
    for (const type of ['application/json', 'text/plain']) {
      try {
        const file = new File([text], name, { type });
        if (navigator.canShare({ files: [file] })) return file;
      } catch (err) {
        // Tipo non accettato: si prova il prossimo.
      }
    }
    return null;
  }

  /** Download classico. Il link sta dentro il foglio: fuori da un <dialog> modale la pagina è inerte. */
  function downloadFile({ name, text }) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.hidden = true;
    els.backupSheet.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
  }

  /** File scelto: si legge e si controlla come i dati salvati; se è un backup di Aura, prima si mostra il riepilogo. */
  async function onImportFile() {
    const file = els.backupFile.files && els.backupFile.files[0];
    els.backupFile.value = ''; // così si può scegliere di nuovo lo stesso file
    if (!file || backupBusy) return;
    if (file.size > BACKUP_MAX_BYTES) {
      setBackupMessage('Il file è troppo grande per essere un backup di Aura.');
      return;
    }
    backupBusy = true;
    syncBackupUI();
    let text = null;
    try {
      text = await readText(file);
    } catch (err) {
      text = null;
    }
    backupBusy = false;
    const result = text === null ? null : storage.readBackup(text);
    if (!result || result.error) {
      setBackupMessage(result ? result.error : 'Non riesco a leggere il file: riprova.');
      syncBackupUI();
      return;
    }
    showConfirm({ kind: 'import', state: result.state, when: result.exportedAt });
  }

  /** Testo di un file scelto dall'utente (con FileReader dove manca file.text()). */
  function readText(file) {
    if (typeof file.text === 'function') return file.text();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  function onRestoreClick() {
    const copy = storage.loadBeforeImport();
    if (backupBusy || !copy) {
      syncBackupUI();
      return;
    }
    showConfirm({ kind: 'restore', state: copy.state, when: copy.savedAt });
  }

  /** Riepilogo prima di sostituire tutti i dati: cosa arriva e cosa c'è adesso, con «Sostituisci» (o «Ripristina») e «Annulla». */
  function showConfirm(pending) {
    const texts = CONFIRM_TEXTS[pending.kind];
    pendingBackup = pending;
    setBackupMessage(null);
    els.backupConfirmTitle.textContent = texts.title;
    els.backupConfirmSourceLabel.textContent = texts.source;
    els.backupConfirmSource.textContent = dataLabel(pending.state);
    els.backupConfirmWhen.textContent = texts.when + momentLabel(pending.when);
    els.backupConfirmCurrent.textContent = dataLabel(state);
    els.backupConfirmText.textContent = texts.text;
    els.backupConfirmOk.textContent = texts.ok;
    syncBackupUI();
    els.backupConfirm.closest('.sheet__body').scrollTop = 0;
    els.backupConfirmTitle.focus({ preventScroll: true });
  }

  function onConfirmCancel() {
    const kind = pendingBackup ? pendingBackup.kind : 'import';
    pendingBackup = null;
    syncBackupUI();
    (kind === 'restore' ? els.backupRestoreButton : els.backupImport).focus({ preventScroll: true });
  }

  /** «Sostituisci» o «Ripristina». */
  function onConfirm() {
    const pending = pendingBackup;
    if (!pending) return;
    pendingBackup = null;
    if (pending.kind === 'import') importBackup(pending.state);
    else restoreCopy(pending.state);
    syncBackupUI();
    els.backupHeading.focus({ preventScroll: true });
  }

  /** Sostituisce i dati con quelli del backup. Prima ne salva una copia: senza spazio per la copia non importa nulla. */
  function importBackup(next) {
    const outcome = storage.replaceData(state, next, Date.now());
    if (outcome === 'no-copy') {
      setBackupMessage('Non c\'è spazio per una copia dei dati di adesso: non ho importato nulla.');
      return;
    }
    if (outcome === 'no-space') {
      setBackupMessage('Impossibile salvare: la memoria del browser è piena. I dati sono quelli di prima.');
      return;
    }
    applyState(next);
    setBackupMessage('Backup importato: ' + tasksLabel(next.tasks.length) + ' e ' + pointsLabel(next.stats.totalPoints) + '.', 'on');
    storage.requestPersistence();
  }

  /** Rimette i dati di prima dell'ultima importazione; poi la copia sparisce. */
  function restoreCopy(copyState) {
    if (!storage.restoreBeforeImport(copyState)) {
      setBackupMessage('Impossibile salvare: la memoria del browser è piena. I dati sono quelli di adesso.');
      return;
    }
    applyState(copyState);
    setBackupMessage('Dati di prima dell\'importazione ripristinati.', 'on');
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

  /**
   * Puntino sulla campanella, frase in fondo alla pagina, testo di Siri e righe di «Impostazioni»: dicono se il server è
   * in uso, e per cosa. Lo chiama anche js/ui-claude.js, quando cambia lo stato dei collegamenti di Claude.
   */
  function syncRemoteBadges() {
    const assistantOn = Boolean(assistantCtl && assistantCtl.isActive());
    // true, false, o null finché non si sa se Claude è collegato: allora la frase della privacy lo nomina con un «se»
    const claudeOn = Settings.claudeSends({ availability: R.availability(), connected: Boolean(remote.code), claude: claudeCtl ? claudeCtl.state() : null });
    els.remoteButton.classList.toggle('has-dot', remote.reminders.enabled);
    els.remoteButton.setAttribute('aria-label', remote.reminders.enabled ? 'Promemoria e Siri: promemoria attivi' : 'Promemoria e Siri');
    els.footnoteText.textContent = Settings.privacyLine({ connected: Boolean(remote.code), assistantOn, claudeOn });
    els.siriText.textContent = assistantOn
      ? 'Di\' "Ehi Siri, Aura" e detta l\'impegno: quando apri Aura, l\'assistente lo sistema secondo i suoi permessi.'
      : 'Di\' "Ehi Siri, Aura" e detta l\'impegno: quando apri Aura lo trovi già compilato, da confermare.';
    els.siriAssistantNote.hidden = !assistantOn;
    if (settingsCtl) settingsCtl.sync(); // le righe di «Impostazioni» dicono lo stato di adesso
  }

  function setMessage(area, text, tone) {
    messages[area] = text ? { text, tone: tone || 'warn' } : null;
    syncRemoteUI();
  }

  /** Con `part` = 'siri' (dalla riga di «Impostazioni») il foglio parte dal riquadro del Comando Rapido. */
  function openRemoteSheet(part) {
    const heading = part === 'siri' ? els.siriTitle : null;
    messages.reminders = null;
    messages.siri = null;
    codeVisible = false;
    syncRemoteUI();
    setAutofocus(els.remoteSheet, heading || els.remoteHeading);
    openSheet(els.remoteSheet);
    showPart(els.remoteSheet, heading);
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

  /**
   * Copia negli appunti; restituisce true se ci è riuscito. `host` è il foglio da cui si copia: il campo d'appoggio
   * del metodo vecchio deve stare lì dentro.
   */
  async function copyText(text, host = els.remoteSheet) {
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
    host.appendChild(area);
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

  /**
   * "Scollega": il server dimentica il dispositivo (codice, casella, promemoria, conteggi dell'assistente) e l'assistente
   * si spegne, con la sua memoria breve. Si può annullare. Restituisce { ok, message } (anche al foglio «Assistente»).
   */
  async function disconnectDevice() {
    if (remoteBusy || !remote.code) return { ok: false, message: null };
    remoteBusy = true;
    // Prima si spegne l'assistente, così le frasi di Siri ritirate qui sotto vanno nel foglio di sempre.
    const previousAssistant = prefs.assistant;
    if (assistantCtl) assistantCtl.forget();
    await checkInbox({ force: true }); // prima si ritirano le frasi in attesa: non vanno perse
    // E si chiede se Claude è collegato (true, false o null se non si sa): «Annulla» non lo ricollega, e l'avviso lo dirà
    const hadClaude = claudeCtl ? await claudeCtl.settle() : false;
    const previous = remote;
    const result = await R.api.unregister(previous.code);
    remoteBusy = false;
    if (!result.ok && result.status !== 401) {
      setPrefs({ assistant: previousAssistant });
      syncAfterAssistantChange();
      return { ok: false, message: R.troubleMessage(result, navigator.onLine) };
    }
    remote = Object.assign(R.defaults(), { inbox: previous.inbox, done: previous.done });
    remote.reminders.lead = previous.reminders.lead;
    saveRemote();
    messages.siri = null;
    if (claudeCtl) claudeCtl.forget(); // il server ha tolto anche i collegamenti di Claude
    syncRemoteUI();
    syncAfterAssistantChange();
    showToast('Dispositivo scollegato', { action: 'Annulla', onAction: () => restoreConnection(previous, previousAssistant, hadClaude) });
    return { ok: true, message: null };
  }

  async function onDisconnect() {
    if (remoteBusy || !remote.code) return;
    setMessage('siri', 'Scollego il dispositivo…', 'busy');
    const result = await disconnectDevice();
    if (!result.ok) {
      setMessage('siri', result.message);
      return;
    }
    closeAllSheets(); // anche «Impostazioni», se il foglio è stato aperto da lì: l'avviso con «Annulla» sta sotto i fogli
  }

  /**
   * "Annulla" dopo "Scollega": torna lo stesso codice, così il Comando Rapido continua a funzionare; e l'assistente
   * com'era. Claude no: i suoi collegamenti il server li ha già tolti, e l'avviso lo dice.
   */
  async function restoreConnection(previous, previousAssistant, hadClaude = false) {
    const result = await R.api.register(previous.code);
    if (!result.ok) {
      showToast('Non sono riuscito a ricollegare il dispositivo. ' + R.troubleMessage(result, navigator.onLine), { duration: 5000 });
      return;
    }
    remote = Object.assign({}, previous, { inbox: remote.inbox, done: remote.done, sent: R.emptySent() });
    saveRemote();
    if (previousAssistant) setPrefs({ assistant: previousAssistant });
    syncRemoteUI();
    syncAfterAssistantChange();
    if (hadClaude) showToast('Dispositivo ricollegato. Claude va ricollegato con un codice nuovo.', { duration: 6000 });
    else if (hadClaude === null) showToast('Dispositivo ricollegato. Se avevi collegato Claude, va ricollegato con un codice nuovo.', { duration: 6000 });
    else showToast('Dispositivo ricollegato');
    if (remote.reminders.enabled) await refreshPush({ force: true });
  }

  /* ---------- Casella del Comando Rapido di Siri (dove arrivano anche le frasi di Claude) ---------- */

  const INBOX_INTERVAL_MS = 15 * 1000;
  const ASSISTANT_BUSY = '(assistente)'; // al posto di un id in inboxShowing: l'assistente sta gestendo la coda
  let inboxCheckedAt = 0;
  let inboxShowing = null; // id della frase mostrata adesso nel foglio "Nuova attività"
  let inboxShown = 0; // frasi già mostrate in questa serie, per "2 di 3"
  // Frasi che l'assistente non ha gestito (IA che non risponde, quota finita, non capita): vanno nel foglio di sempre,
  // e quando il foglio si chiude escono dalla coda come prima. Non si riprovano con l'IA.
  const inboxForSheet = new Set();

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

  /**
   * Le frasi in coda, se non c'è già un foglio aperto. Con l'assistente acceso (e internet) passano prima da lui;
   * quelle che non gestisce, e tutte con l'assistente spento, si aprono una alla volta nel foglio "Nuova attività".
   */
  function showNextInboxItem() {
    if (inboxShowing || !remote.inbox.length || document.querySelector('dialog[open]')) return;
    if (assistantCtl && assistantCtl.takesSiri()) {
      // Una frase con «ogni …» si apre nel foglio, dove la ripetizione si capisce: l'assistente non sa ancora crearle (P-005).
      remote.inbox.forEach(item => {
        if (!inboxForSheet.has(item.id) && nlp.parseTaskText(item.text, new Date()).repeat) inboxForSheet.add(item.id);
      });
      const items = remote.inbox.filter(item => !inboxForSheet.has(item.id));
      if (items.length && document.readyState !== 'complete') {
        // Le richieste all'IA partono dopo il caricamento: il primo disegno resta senza attese.
        window.addEventListener('load', () => setTimeout(showNextInboxItem, 0), { once: true });
        return;
      }
      if (items.length) {
        inboxShowing = ASSISTANT_BUSY;
        assistantCtl.handleSiri(items).then(outcome => {
          inboxShowing = null;
          outcome.fallback.forEach(id => inboxForSheet.add(id));
          markInboxDone(outcome.done);
          setTimeout(showNextInboxItem, 250);
        }, () => {
          inboxShowing = null;
          items.forEach(item => inboxForSheet.add(item.id)); // errore imprevisto: il foglio di sempre
          setTimeout(showNextInboxItem, 250);
        });
        return;
      }
    }
    const item = remote.inbox[0];
    const total = inboxShown + remote.inbox.length;
    inboxShowing = item.id;
    openAddSheet(item.text, R.inboxLabel(item, inboxShown + 1, total)); // «Da Siri», «Da Claude · 1 di 3»
  }

  /** Frasi gestite: escono dalla coda e restano tra quelle già viste, così il server non le ridà. */
  function markInboxDone(ids) {
    if (!ids.length) return;
    const set = new Set(ids);
    remote.inbox = remote.inbox.filter(item => !set.has(item.id));
    remote.done = ids.concat(remote.done.filter(id => !set.has(id))).slice(0, 100);
    saveRemote();
  }

  /**
   * Dopo la chiusura di un foglio: la frase mostrata è fatta (aggiunta o annullata), poi tocca alla prossima.
   * Dopo una modifica, il focus torna sulla card (utile da tastiera e con il lettore di schermo).
   */
  function onSheetClosed(dialog) {
    if (els.toast.parentNode === dialog) document.body.appendChild(els.toast); // l'avviso resta, nella pagina
    if (assistantCtl) assistantCtl.sheetClosed(dialog);
    if (settingsCtl) settingsCtl.sync(); // tornando a «Impostazioni» da un altro foglio, le righe sono aggiornate
    if (dialog === els.addSheet && focusAfterEdit) {
      const card = cardOf(focusAfterEdit);
      const button = card && card.querySelector('.task__edit');
      focusAfterEdit = null;
      // Finita in un'altra scheda (per esempio saltata a lunedì, da Focus): il focus resta nella pagina, all'inizio,
      // invece di perdersi; l'avviso dice dove è andata
      if (button && button.getClientRects().length) button.focus({ preventScroll: true });
      else els.main.focus({ preventScroll: true });
    }
    if (dialog === els.addSheet && inboxShowing && inboxShowing !== ASSISTANT_BUSY) {
      const id = inboxShowing;
      inboxShowing = null;
      inboxShown++;
      inboxForSheet.delete(id);
      markInboxDone([id]);
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

  /**
   * All'avvio, al ritorno nell'app e quando torna internet: casella di Siri e promemoria; all'avvio e quando torna
   * internet anche lo stato di Claude. Senza codice non fa nulla.
   */
  async function refreshRemote({ force = false } = {}) {
    if (refreshing || !remote.code || R.availability() !== 'ok' || navigator.onLine === false) return;
    refreshing = true;
    try {
      await checkInbox({ force });
      if (remote.reminders.enabled) await refreshPush();
      else if (remote.sent.endpoint) await forgetServerSubscription(); // spegnimento che non era arrivato al server
      if (force && claudeCtl) await claudeCtl.refresh(); // all'avvio e quando torna internet: Claude è collegato?
    } catch (err) {
      // Problemi di rete: si riprova alla prossima occasione.
    } finally {
      refreshing = false;
    }
  }

  /**
   * Dalla notifica di un promemoria (o da «Mostra»): apre la scheda in cui l'attività si vede, la evidenzia e la porta
   * in vista. Se si vede già nella scheda aperta resta lì; altrimenti in ritardo, oggi e senza data → Focus;
   * un giorno futuro → Agenda; completata → Motivazione.
   */
  function showTask(id) {
    const task = id ? state.tasks.find(item => item.id === id) : null;
    if (!task) return;
    const today = utils.todayISO();
    if (!isVisibleIn(task, activeTab, today)) showTab(T.tabOf(task, today), { animate: false });
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

  /**
   * Numeri di oggi (Da fare, Tempo, Fatte oggi): in una riga se etichette e valori ci stanno interi, altrimenti su due
   * righe (.is-stacked), mai con l'etichetta accorciata. Conta la larghezza naturale di etichette e valori, la stessa
   * nei due modi, quindi la scelta non va avanti e indietro. Gira da un ResizeObserver sulla riga e sui valori: dopo il
   * layout e prima che la pagina si disegni, senza letture forzate dentro render().
   */
  function fitStats() {
    const row = els.statsRow;
    if (!row || !row.clientWidth) return; // nascosta: si misura quando si vede
    const items = row.children;
    let need = (items.length - 1) * (parseFloat(getComputedStyle(row).columnGap) || 0);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const cs = getComputedStyle(item);
      need += item.querySelector('.stat__label').scrollWidth + item.querySelector('.stat__value').scrollWidth
        + (parseFloat(cs.columnGap) || 0) + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
        + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth)
        + 1; // scrollWidth è arrotondato: un pixel di margine per riquadro
    }
    const stacked = need > row.clientWidth;
    if (stacked === row.classList.contains('is-stacked')) return;
    row.classList.toggle('is-stacked', stacked);
    measureHero(); // l'intestazione cambia altezza: la fascia della barra di stato va rimisurata
  }

  function watchStats() {
    if (!els.statsRow) return;
    if (typeof ResizeObserver !== 'function') {
      fitStats();
      window.addEventListener('resize', fitStats);
      return;
    }
    fitStats(); // subito, prima che si misuri l'intestazione all'apertura
    const observer = new ResizeObserver(fitStats);
    observer.observe(els.statsRow);
    els.statsRow.querySelectorAll('.stat__value').forEach(value => observer.observe(value)); // i numeri cambiano larghezza
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
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const node = button.closest('.task');
    if (button.dataset.action === 'delete') onDelete(node.dataset.id);
    else if (button.dataset.action === 'edit') openEditSheet(node.dataset.id);
  });
  els.editFocus.addEventListener('pointerdown', () => focusCtl.prepareAudio()); // l'audio si prepara mentre il dito è ancora giù
  els.editFocus.addEventListener('click', onFocusFromEdit);
  els.repeatSkip.addEventListener('click', onSkipFromEdit);
  els.repeatChips.addEventListener('click', event => {
    const chip = event.target.closest('[data-repeat]');
    if (chip) pickRepeat(chip.dataset.repeat);
  });
  els.repeatDays.addEventListener('click', event => {
    const button = event.target.closest('[data-day]');
    if (button) toggleRepeatDay(Number(button.dataset.day));
  });

  // Barra delle schede: un tocco sulla scheda già aperta torna in cima.
  els.tabbar.addEventListener('click', event => {
    const button = event.target.closest('[data-tab]');
    if (!button) return;
    if (button.dataset.tab !== activeTab) showTab(button.dataset.tab);
    else window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  });
  els.miniRewards.addEventListener('click', () => showTab('motivation'));
  els.emptyAgendaLink.addEventListener('click', () => showTab('agenda'));

  // «Completate oggi» (Focus) e «Completate» (Motivazione) si aprono e si chiudono morbide: il contenuto entra (o esce)
  // come un blocco unico e il fondo pagina scivola.
  [els.completed, els.history].forEach(details => {
    details.querySelector('summary').addEventListener('click', event => {
      event.preventDefault();
      const before = M.snapshot(els.main);
      details.open = !details.open;
      M.play(els.main, before, { enterFrom: 'above', exit: 'up', toCollapsed: false });
    });
  });

  els.clearCompleted.addEventListener('click', onClearCompleted);
  // Dall'Agenda «Nuova attività» propone il giorno scelto nel calendario (mai un giorno passato).
  els.addButton.addEventListener('click', () => openAddSheet(null, null, activeTab === 'agenda' && agendaCtl ? agendaCtl.addPreset() : null));
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

  els.remoteButton.addEventListener('click', () => openRemoteSheet());
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

  els.backupButton.addEventListener('click', openBackupSheet);
  els.backupExport.addEventListener('click', onExport);
  els.backupImport.addEventListener('click', () => {
    if (!backupBusy) els.backupFile.click(); // l'input (invisibile) sta dentro il foglio, come il link del download
  });
  els.backupFile.addEventListener('change', onImportFile);
  els.backupRestoreButton.addEventListener('click', onRestoreClick);
  els.backupConfirmOk.addEventListener('click', onConfirm);
  els.backupConfirmCancel.addEventListener('click', onConfirmCancel);

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

  [els.addSheet, els.remoteSheet, els.backupSheet].forEach(sheet => setupSheet(sheet)); // gli altri in ui-focus.js, ui-assistant.js e ui-settings.js

  // Tornando nell'app (o dopo mezzanotte) "Oggi" e "In ritardo" devono essere giusti.
  // E si guarda se Siri ha lasciato frasi nella casella (solo con un dispositivo collegato).
  // Uscendo, si ricorda la scheda: riaprendo entro 30 minuti si riparte da lì.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') {
      rememberTab();
      return;
    }
    render();
    refreshRemote();
  });
  window.addEventListener('pagehide', rememberTab);
  setInterval(() => {
    const now = new Date();
    // Giorno nuovo, oppure l'ora di un'attività di oggi è appena passata (diventa rossa): si ridisegna.
    if (utils.toISODate(now) !== renderedDay || T.passedCount(state.tasks, now) !== renderedPassed) render();
    else {
      els.greeting.textContent = utils.greeting(now);
      if (agendaCtl) agendaCtl.tick(now); // la linea dell'ora in «Con orario», se il giorno scelto è oggi
    }
  }, 60 * 1000);

  // Dati modificati in un'altra scheda.
  window.addEventListener('storage', event => {
    if (event.key !== storage.KEY && event.key !== null) return;
    state = storage.load().state;
    render();
    if (focusCtl) focusCtl.sync();
  });

  window.addEventListener('scroll', updateScrim, { passive: true });
  window.addEventListener('resize', measureHero);

  /* ---------- Avvio ---------- */

  function setPrefs(change) {
    prefs = storage.sanitizePrefs({ ...prefs, ...change });
    storage.savePrefs(prefs);
    if (change.assistant) syncRemoteBadges(); // testo in fondo alla pagina e pannello di Siri citano l'assistente
  }

  /** Dopo che l'assistente si è acceso o spento da fuori (Scollega e Annulla): striscia, foglio e testi. */
  function syncAfterAssistantChange() {
    syncRemoteBadges();
    if (!assistantCtl) return;
    assistantCtl.syncSheet();
    render();
  }

  /** Lo stato di adesso per le righe di «Impostazioni» (le frasi le scrive Aura.settings.describe). */
  function settingsInfo() {
    const support = R.pushSupport();
    return {
      availability: R.availability(),
      theme: theme.getMode(),
      assistant: prefs.assistant,
      logCount: assistantCtl ? assistantCtl.logCount() : 0,
      reminders: remote.reminders,
      push: support.ok ? null : support.reason,
      connected: Boolean(remote.code),
      claude: claudeCtl ? claudeCtl.state() : { links: null, checking: false },
      dataLabel: dataLabel(state)
    };
  }

  // I fogli «Cosa faccio adesso?»/«Aura», Focus e «Assistente» si preparano prima del primo disegno: la striscia la
  // scrive js/ui-assistant.js. Nessuna richiesta di rete qui: la proposta dell'IA parte dopo il caricamento.
  focusCtl = FocusUI.init({
    getState: () => state,
    commit,
    completeTask,
    openSheet,
    closeSheet,
    setupSheet,
    setAutofocus,
    showToast,
    vibrate,
    getPrefs: () => prefs,
    setPrefs,
    onSuggestOpening: () => { if (assistantCtl) assistantCtl.sheetOpening(); },
    // I suoni del focus (js/ui-sound.js): suonano mentre il focus conta il tempo; scelgono la sessione audio prima dello
    // sblocco e partono appena l'audio è sbloccato; con il menu «Suono» aperto, Esc chiude il menu.
    onRunning: running => { if (soundCtl) soundCtl.sync(running); },
    beforeAudio: () => { if (soundCtl) soundCtl.beforeAudio(); },
    onAudioUnlocked: () => { if (soundCtl) soundCtl.refresh(); },
    onCancel: () => Boolean(soundCtl) && soundCtl.closeMenu()
  });
  assistantCtl = AssistantUI.init({
    focusCtl,
    getState: () => state,
    commit,
    completeTask,
    onDelete,
    openAddSheet,
    showToast,
    showTask,
    openSheet,
    closeSheet,
    setupSheet,
    setAutofocus,
    showPart,
    closeAllSheets,
    getPrefs: () => prefs,
    setPrefs,
    getRemote: () => remote,
    ensureDevice,
    withDevice,
    disconnect: disconnectDevice
  });
  // Il foglio «Claude» (P-006, passo 6.2): i passi, il codice, i collegamenti. Lo stato sta solo in memoria; quando
  // cambia, si aggiornano le righe di «Impostazioni» e la frase della privacy (syncRemoteBadges).
  claudeCtl = ClaudeUI.init({
    getRemote: () => remote,
    ensureDevice,
    withDevice,
    copyText,
    openSheet,
    setupSheet,
    setAutofocus,
    showPart,
    onChange: syncRemoteBadges
  });
  // La rotella e i fogli «Impostazioni» e «Privacy»: un indice che apre i fogli qui sopra.
  settingsCtl = SettingsUI.init({
    getInfo: settingsInfo,
    openSheet,
    closeSheet,
    setupSheet,
    setAutofocus,
    showPart,
    closeAllSheets,
    openAssistant: part => assistantCtl.openSheet(part),
    openRemote: openRemoteSheet,
    openClaude: () => claudeCtl.open(),
    refreshClaude: () => claudeCtl.refresh(),
    openBackup: openBackupSheet,
    disconnect: disconnectDevice
  });
  // La musica nel focus, senza account: l'avviso o il carosello in Focus, il foglio «Quando te lo ricordo?», la riga
  // «Musica» nelle Impostazioni e «🎧» nel focus a tutto schermo. Tutto nelle preferenze (prefs.music), fuori dal backup.
  musicCtl = MusicUI.init({
    getPrefs: () => prefs,
    setPrefs,
    openSheet,
    closeSheet,
    setupSheet,
    setAutofocus,
    showToast,
    openSettings: options => settingsCtl.open(options)
  });

  // L'Agenda a calendario: legge la vista salvata (mese o settimana) e scrive la scheda a ogni render().
  agendaCtl = AgendaUI.init({
    getState: () => state,
    commit,
    buildTask,
    showToast,
    openAddSheet,
    getPrefs: () => prefs,
    setPrefs,
    setEdited: id => { editedId = id; },
    isActive: () => activeTab === 'agenda'
  });

  // Motivazione: livello, «La tua settimana» con l'obiettivo salvato (prefs.weeklyGoal) e «I tuoi numeri», a ogni render().
  motivationCtl = MotivationUI.init({
    getState: () => state,
    getPrefs: () => prefs,
    setPrefs,
    isActive: () => activeTab === 'motivation'
  });
  // «I tuoi premi»: la card in Motivazione e il foglio del premio. Premi e riscatti passano da commitState().
  rewardsCtl = RewardsUI.init({
    getState: () => state,
    commitState,
    showToast,
    openSheet,
    closeSheet,
    setupSheet,
    setAutofocus,
    burstConfetti,
    vibrate,
    isActive: () => activeTab === 'motivation'
  });
  // «Negozio»: la card in Motivazione e il foglio. Acquisti, riparazioni e oggetti in uso passano da commitState().
  shopCtl = ShopUI.init({
    getState: () => state,
    commitState,
    showToast,
    hostToast,
    openSheet,
    setupSheet,
    setAutofocus,
    burstConfetti,
    vibrate,
    celebrateRepair,
    previewSound: (value, onEnd) => soundCtl.preview(value, onEnd),
    stopSound: () => soundCtl.stopPreview(),
    isActive: () => activeTab === 'motivation'
  });
  // Suoni del focus (P-004, passo 4.4): «Suono» nel focus a tutto schermo e l'audio. Il suono in uso (look.sound) passa da
  // commitState(), come i colori; l'audio è quello del focus.
  soundCtl = SoundUI.init({
    getState: () => state,
    commitState,
    getAudio: () => focusCtl.getAudio(),
    unlockAudio: () => focusCtl.unlockAudio()
  });

  // Scorrimento sulle card da fare (P-005, passo 5.2): verso destra come la spunta, verso sinistra come il cestino.
  SwipeUI.init({
    root: els.main,
    canSwipe: id => {
      const task = state.tasks.find(t => t.id === id);
      return Boolean(task) && !task.done && !busy.has(id) && !pendingDone.has(id);
    },
    onDone: (id, node) => {
      const card = node.isConnected ? node : cardOf(id); // la lista può essersi ridisegnata mentre la card tornava
      if (!card) return;
      card.querySelector('.check__input').checked = true;
      onToggle(id, true, card);
    },
    onDelete,
    vibrate
  });

  syncTabs(); // Focus, oppure l'ultima scheda se Aura è stata usata negli ultimi 30 minuti
  render();
  watchStats();
  measureHero();
  registerServiceWorker();
  // All'apertura la fiamma accesa fa qualche guizzo, poi si ferma (niente animazioni infinite).
  const targets = rewardTargets();
  if (targets && targets.streak.classList.contains('is-lit')) M.flash(targets.streak, 'is-flickering');
  if (loaded.warning) showToast(loaded.warning, { duration: 8000 });
  focusCtl.resume(); // un focus rimasto aperto riprende, anche dopo aver ricaricato la pagina
  openFromLink();
  syncRemoteBadges();
  showNextInboxItem(); // frasi di Siri già ritirate ma non ancora viste (anche offline)
  refreshRemote({ force: true });
})(window.Aura = window.Aura || {});
