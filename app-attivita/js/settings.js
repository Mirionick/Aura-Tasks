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
  // Senza il server (file aperto dal computer, o server non configurato) promemoria, Siri e assistente non partono.
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
   * - connected: il dispositivo ha un codice sul server; dataLabel: «12 attività · 340 punti».
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

    return {
      // Senza server il foglio «Assistente» non si apre, come l'ingranaggio del foglio «Aura».
      assistant: available
        ? { state: assistantOn ? assistantState(info.assistant) : 'Spento', tone: assistantOn ? 'on' : 'off', disabled: false }
        : { state: missing, tone: 'off', disabled: true },
      log: available ? { state: logState(info.logCount), disabled: false } : { state: missing, disabled: true },
      reminders,
      siri,
      theme: { state: theme.label + ': ' + theme.hint },
      backup: { state: info.dataLabel },
      // `line` è la frase intera in cima al foglio «Privacy»; verde ('on') solo quando al server non arriva niente.
      privacy: {
        state: privacyShort({ connected: info.connected, assistantOn }),
        line: privacyLine({ connected: info.connected, assistantOn }),
        tone: info.connected || assistantOn ? 'off' : 'on'
      },
      device: { connected: Boolean(info.connected) }
    };
  }

  /** Dove stanno i dati, in una frase intera: sta in fondo a Motivazione e in cima al foglio «Privacy». */
  function privacyLine({ connected, assistantOn }) {
    if (assistantOn) return 'I dati restano su questo dispositivo: al server di Aura arrivano solo promemoria, frasi di Siri e messaggi all\'assistente.';
    if (connected) return 'I dati restano su questo dispositivo: al server di Aura arrivano solo promemoria e frasi di Siri.';
    return 'I dati restano solo su questo dispositivo.';
  }

  /** La stessa cosa in breve, per la riga «Privacy». */
  function privacyShort({ connected, assistantOn }) {
    if (assistantOn) return 'Al server: promemoria, Siri e messaggi all\'assistente';
    if (connected) return 'Al server: solo promemoria e frasi di Siri';
    return 'I dati restano solo su questo dispositivo';
  }

  Aura.settings = { THEMES, describe, privacyLine, privacyShort };
})(window.Aura = window.Aura || {});
