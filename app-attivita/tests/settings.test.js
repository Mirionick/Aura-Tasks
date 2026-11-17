/*
 * Test del foglio «Impostazioni» (js/settings.js): che cosa dice ogni riga con i dati di adesso,
 * e la frase su dove stanno i dati (la stessa in fondo a Motivazione e in cima al foglio «Privacy»).
 */
(function () {
  'use strict';

  const { test, assertEqual } = window.AuraTest;
  const { settings: S } = window.Aura;

  /** Dispositivo appena installato, nell'app pubblicata: niente acceso, niente collegato. */
  function info(fields) {
    return Object.assign({
      availability: 'ok',
      theme: 'auto',
      assistant: { enabled: false, autoAdd: false, autoEdit: false },
      logCount: 0,
      reminders: { enabled: false, lead: 10 },
      push: null,
      connected: false,
      dataLabel: '12 attività · 340 punti'
    }, fields);
  }

  test('impostazioni: appena installata, ogni riga dice lo stato di adesso', () => {
    const rows = S.describe(info());
    assertEqual(rows.assistant, { state: 'Spento', tone: 'off', disabled: false });
    assertEqual(rows.log, { state: 'Ancora niente', disabled: false });
    assertEqual(rows.reminders, { state: 'Spenti', tone: 'off' });
    assertEqual(rows.siri, { state: 'Da configurare', tone: 'off' });
    assertEqual(rows.theme, { state: 'Automatico: segue le impostazioni del telefono' });
    assertEqual(rows.backup, { state: '12 attività · 340 punti' });
    assertEqual(rows.privacy, {
      state: 'I dati restano solo su questo dispositivo',
      line: 'I dati restano solo su questo dispositivo.',
      tone: 'on'
    });
    assertEqual(rows.device, { connected: false });
  });

  test('impostazioni: la riga dell\'assistente dice i permessi, solo se è acceso', () => {
    const state = assistant => S.describe(info({ assistant })).assistant;
    assertEqual(state({ enabled: true, autoAdd: false, autoEdit: false }), { state: 'Acceso · chiede sempre', tone: 'on', disabled: false });
    assertEqual(state({ enabled: true, autoAdd: true, autoEdit: false }).state, 'Acceso · aggiunge da solo');
    assertEqual(state({ enabled: true, autoAdd: false, autoEdit: true }).state, 'Acceso · cambia da solo');
    assertEqual(state({ enabled: true, autoAdd: true, autoEdit: true }).state, 'Acceso · aggiunge e cambia da solo');
    // Spento, i permessi scelti restano ma la riga non li dice
    assertEqual(state({ enabled: false, autoAdd: true, autoEdit: true }), { state: 'Spento', tone: 'off', disabled: false });
  });

  test('impostazioni: la riga dell\'elenco conta le azioni degli ultimi 30 giorni', () => {
    const state = logCount => S.describe(info({ logCount })).log.state;
    assertEqual(state(0), 'Ancora niente');
    assertEqual(state(1), '1 azione negli ultimi 30 giorni');
    assertEqual(state(7), '7 azioni negli ultimi 30 giorni');
  });

  test('impostazioni: promemoria attivi con l\'anticipo, oppure il motivo per cui non si possono attivare', () => {
    const state = fields => S.describe(info(fields)).reminders;
    assertEqual(state({ reminders: { enabled: true, lead: 10 } }), { state: 'Attivi · 10 minuti prima', tone: 'on' });
    assertEqual(state({ reminders: { enabled: true, lead: 0 } }).state, 'Attivi · all\'ora esatta');
    assertEqual(state({ reminders: { enabled: true, lead: 60 } }).state, 'Attivi · un\'ora prima');
    assertEqual(state({ push: 'ios-install' }), { state: 'Spenti · serve Aura sulla schermata Home', tone: 'off' });
    assertEqual(state({ push: 'unsupported' }).state, 'Non supportati da questo browser');
    assertEqual(state({ push: 'denied' }).state, 'Spenti · notifiche bloccate');
    assertEqual(state({ push: 'un-motivo-nuovo' }).state, 'Spenti');
    // Come il foglio «Promemoria e Siri»: se sono attivi lo dice, anche se adesso il browser li blocca
    assertEqual(state({ reminders: { enabled: true, lead: 15 }, push: 'denied' }).state, 'Attivi · 15 minuti prima');
  });

  test('impostazioni: la riga di Siri dice se il codice c\'è', () => {
    assertEqual(S.describe(info({ connected: true })).siri, { state: 'Codice creato', tone: 'on' });
    assertEqual(S.describe(info({ connected: false })).siri, { state: 'Da configurare', tone: 'off' });
    assertEqual(S.describe(info({ connected: true })).device, { connected: true });
  });

  test('impostazioni: senza il server le righe dicono perché, e assistente ed elenco non si aprono', () => {
    const file = S.describe(info({ availability: 'file', assistant: { enabled: true, autoAdd: true, autoEdit: true }, logCount: 3 }));
    assertEqual(file.assistant, { state: 'Solo nell\'app pubblicata', tone: 'off', disabled: true });
    assertEqual(file.log, { state: 'Solo nell\'app pubblicata', disabled: true });
    assertEqual(file.reminders, { state: 'Solo nell\'app pubblicata', tone: 'off' });
    assertEqual(file.siri, { state: 'Solo nell\'app pubblicata', tone: 'off' });
    // L'assistente acceso non parte da qui: al server non arriva niente
    assertEqual(file.privacy.state, 'I dati restano solo su questo dispositivo');
    const unconfigured = S.describe(info({ availability: 'unconfigured' }));
    assertEqual(unconfigured.assistant.state, 'Server non configurato');
    assertEqual(unconfigured.reminders.state, 'Server non configurato');
    assertEqual(S.describe(info({ availability: 'boh' })).siri.state, 'Server non configurato');
    // Il backup e il tema funzionano anche senza server
    assertEqual(file.backup, { state: '12 attività · 340 punti' });
    assertEqual(file.theme.state, 'Automatico: segue le impostazioni del telefono');
  });

  test('impostazioni: la riga del tema dice il nome e che cosa fa', () => {
    assertEqual(S.describe(info({ theme: 'light' })).theme.state, 'Chiaro: luminoso, ideale di giorno');
    assertEqual(S.describe(info({ theme: 'dark' })).theme.state, 'Scuro: riposante per gli occhi, perfetto la sera');
    assertEqual(S.describe(info({ theme: 'sconosciuto' })).theme.state, 'Automatico: segue le impostazioni del telefono');
  });

  test('impostazioni: privacy, la frase intera e quella breve dicono che cosa va al server', () => {
    assertEqual(S.privacyLine({ connected: false, assistantOn: false }), 'I dati restano solo su questo dispositivo.');
    assertEqual(S.privacyLine({ connected: true, assistantOn: false }), 'I dati restano su questo dispositivo: al server di Aura arrivano solo promemoria e frasi di Siri.');
    assertEqual(S.privacyLine({ connected: true, assistantOn: true }), 'I dati restano su questo dispositivo: al server di Aura arrivano solo promemoria, frasi di Siri e messaggi all\'assistente.');
    assertEqual(S.privacyShort({ connected: true, assistantOn: false }), 'Al server: solo promemoria e frasi di Siri');
    assertEqual(S.privacyShort({ connected: false, assistantOn: true }), 'Al server: promemoria, Siri e messaggi all\'assistente');
    const tone = fields => S.describe(info(fields)).privacy.tone;
    assertEqual(tone({}), 'on'); // verde solo quando al server non arriva niente
    assertEqual(tone({ connected: true }), 'off');
    assertEqual(tone({ assistant: { enabled: true, autoAdd: false, autoEdit: false } }), 'off');
    const on = S.describe(info({ connected: true, assistant: { enabled: true, autoAdd: false, autoEdit: false } })).privacy;
    assertEqual(on.line, S.privacyLine({ connected: true, assistantOn: true }));
  });
})();
