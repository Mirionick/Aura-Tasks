/*
 * Aura Tasks — impostazioni: logica pura (specifica in docs/impostazioni.md).
 * Dai dati di adesso ricava che cosa dice ogni riga del foglio «Impostazioni» e la frase su dove stanno i dati.
 * Niente DOM, niente localStorage, niente rete: tutto arriva come parametro, così i test sono ripetibili.
 */
(function (Aura) {
  'use strict';

  const { reminders: RM } = Aura;

  // I tre temi: nome e, in poche parole, che cosa fa.
  const THEMES = {
    auto: { label: 'Automatico', hint: 'segue le impostazioni del telefono' },
    light: { label: 'Chiaro', hint: 'luminoso, ideale di giorno' },
    dark: { label: 'Scuro', hint: 'riposante per gli occhi, perfetto la sera' }
  };
  // Senza il server (file aperto dal computer, o server non configurato) promemoria, Siri, Claude e assistente non partono.
  const UNAVAILABLE = { file: 'Solo nell\'app pubblicata', unconfigured: 'Server non configurato' };
  // Perché i promemoria non si possono attivare qui (i motivi di Aura.remote.pushSupport).
  const PUSH_TROUBLE = {
    'ios-install': 'Spenti · serve Aura sulla schermata Home',
    unsupported: 'Non supportati da questo browser',
    denied: 'Spenti · notifiche bloccate'
  };

  /** «Acceso · aggiunge da solo», con i permessi di adesso. */
  function assistantState({ autoAdd, autoEdit }) {
    if (autoAdd && autoEdit) return 'Acceso · aggiunge e cambia da solo';
    if (autoAdd) return 'Acceso · aggiunge da solo';
    if (autoEdit) return 'Acceso · cambia da solo';
    return 'Acceso · chiede sempre';
  }

  /** Quante righe ha l'elenco «Cosa ha fatto l'assistente» (resta 30 giorni). */
  function logState(count) {
    if (!count) return 'Ancora niente';
    return count === 1 ? '1 azione negli ultimi 30 giorni' : count + ' azioni negli ultimi 30 giorni';
  }

  /**
   * Che cosa dice ogni riga di «Impostazioni». `info`:
   * - availability: 'ok', 'file' oppure 'unconfigured' (Aura.remote.availability);
   * - theme: 'auto', 'light' o 'dark';
   * - assistant: { enabled, autoAdd, autoEdit }; logCount: righe dell'elenco dell'assistente;
   * - reminders: { enabled, lead }; push: null se le notifiche si possono attivare, altrimenti il motivo;
   * - connected: il dispositivo ha un codice sul server; dataLabel: «12 attività · 340 punti»;
   * - claude: { links, checking } — quanti collegamenti di Claude ci sono (null finché non si sa) e se lo si sta
   *   chiedendo al server adesso. Lo stato sta solo in memoria (js/ui-claude.js).
   * Restituisce, per ogni riga, `state` (il testo) e dove serve `tone` ('on' = in uso) e `disabled`.
   */
  function describe(info) {
    const available = info.availability === 'ok';
    const missing = UNAVAILABLE[info.availability] || UNAVAILABLE.unconfigured;
    const theme = THEMES[info.theme] || THEMES.auto;
    const assistantOn = available && info.assistant.enabled === true;

    let reminders = { state: 'Spenti', tone: 'off' };
    if (info.reminders.enabled) reminders = { state: 'Attivi · ' + RM.leadLabel(info.reminders.lead), tone: 'on' };
    else if (!available) reminders = { state: missing, tone: 'off' };
    else if (info.push) reminders = { state: PUSH_TROUBLE[info.push] || 'Spenti', tone: 'off' };

    let siri = { state: 'Da configurare', tone: 'off' };
    if (info.connected) siri = { state: 'Codice creato', tone: 'on' };
    else if (!available) siri = { state: missing, tone: 'off' };

    const claudeOn = claudeLinked(info);
    const claudeSending = claudeSends(info);
    let claude = { state: 'Da collegare', tone: 'off', disabled: false };
    // Senza il server il foglio «Claude» non si apre, come quello dell'assistente: non si potrebbe fare niente.
    if (!available) claude = { state: missing, tone: 'off', disabled: true };
    else if (claudeOn) claude = { state: 'Collegato', tone: 'on', disabled: false };
    else if (info.connected && claudeLinks(info) === null) {
      const checking = Boolean(info.claude && info.claude.checking);
      claude = { state: checking ? 'Controllo…' : 'Stato non disponibile', tone: 'off', disabled: false };
    }

    return {
      // Senza server il foglio «Assistente» non si apre, come l'ingranaggio del foglio «Aura».
      assistant: available
        ? { state: assistantOn ? assistantState(info.assistant) : 'Spento', tone: assistantOn ? 'on' : 'off', disabled: false }
        : { state: missing, tone: 'off', disabled: true },
      log: available ? { state: logState(info.logCount), disabled: false } : { state: missing, disabled: true },
      reminders,
      siri,
      claude,
      theme: { state: theme.label + ': ' + theme.hint },
      backup: { state: info.dataLabel },
      // `line` è la frase intera in cima al foglio «Privacy»; verde ('on') solo quando al server non arriva niente.
      privacy: {
        state: privacyShort({ connected: info.connected, assistantOn, claudeOn: claudeSending }),
        line: privacyLine({ connected: info.connected, assistantOn, claudeOn: claudeSending }),
        tone: info.connected || assistantOn ? 'off' : 'on'
      },
      // `claude`: sotto «Scollega questo dispositivo» compare la nota che scollega anche Claude
      device: { connected: Boolean(info.connected), claude: claudeOn }
    };
  }

  /** Quanti collegamenti di Claude ci sono: null finché non si sa (senza dispositivo non ce n'è nessuno). */
  function claudeLinks(info) {
    if (!info.connected) return 0;
    const links = info.claude ? info.claude.links : null;
    return Number.isInteger(links) && links >= 0 ? links : null;
  }

  /** Claude è collegato: il dispositivo ha almeno un collegamento, e il server c'è. */
  function claudeLinked(info) {
    return info.availability === 'ok' && claudeLinks(info) > 0;
  }

  /**
   * Per le frasi della privacy: le frasi di Claude possono arrivare al server? true con Claude collegato, false senza,
   * null finché non si sa (la domanda al server non è finita o non è andata). «Non si sa» non vale come «non collegato».
   * Stessi dati di `describe()`: { availability, connected, claude: { links } }.
   */
  function claudeSends(info) {
    if (info.availability !== 'ok') return false;
    const links = claudeLinks(info);
    return links === null ? null : links > 0;
  }

  /**
   * Dove stanno i dati, in una frase intera: sta in fondo a Motivazione e in cima al foglio «Privacy».
   * `claudeOn` (come `claudeSends()`) vale solo con il dispositivo collegato, perché le frasi di Claude arrivano nella
   * sua casella. Con null, finché non si sa se Claude è collegato, la frase lo nomina con un «se».
   */
  function privacyLine({ connected, assistantOn, claudeOn = false }) {
    const claude = connected ? claudeOn : false;
    if (assistantOn && claude) return 'I dati restano su questo dispositivo: al server di Aura arrivano solo promemoria, frasi di Siri e di Claude, e messaggi all\'assistente.';
    if (assistantOn && claude === null) return 'I dati restano su questo dispositivo: al server di Aura arrivano solo promemoria, frasi di Siri e, se è collegato, di Claude, e messaggi all\'assistente.';
    if (assistantOn) return 'I dati restano su questo dispositivo: al server di Aura arrivano solo promemoria, frasi di Siri e messaggi all\'assistente.';
    if (claude) return 'I dati restano su questo dispositivo: al server di Aura arrivano solo promemoria e frasi di Siri e di Claude.';
    if (claude === null) return 'I dati restano su questo dispositivo: al server di Aura arrivano solo promemoria e frasi di Siri e, se è collegato, di Claude.';
    if (connected) return 'I dati restano su questo dispositivo: al server di Aura arrivano solo promemoria e frasi di Siri.';
    return 'I dati restano solo su questo dispositivo.';
  }

  /** La stessa cosa in breve, per la riga «Privacy». «(se collegato)» non si spezza a fine riga (spazio unificatore). */
  function privacyShort({ connected, assistantOn, claudeOn = false }) {
    const claude = connected ? claudeOn : false;
    if (assistantOn && claude) return 'Al server: promemoria, Siri, Claude e messaggi all\'assistente';
    if (assistantOn && claude === null) return 'Al server: promemoria, Siri, Claude (se\u00a0collegato) e messaggi all\'assistente';
    if (assistantOn) return 'Al server: promemoria, Siri e messaggi all\'assistente';
    if (claude) return 'Al server: solo promemoria e frasi di Siri e di Claude';
    if (claude === null) return 'Al server: solo promemoria e frasi di Siri e di Claude (se\u00a0collegato)';
    if (connected) return 'Al server: solo promemoria e frasi di Siri';
    return 'I dati restano solo su questo dispositivo';
  }

  Aura.settings = { THEMES, describe, claudeSends, privacyLine, privacyShort };
})(window.Aura = window.Aura || {});
