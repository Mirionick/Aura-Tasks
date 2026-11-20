/*
 * Aura Tasks — impostazioni: la parte che tocca la pagina (specifica in docs/impostazioni.md).
 * La rotella nell'intestazione apre il foglio «Impostazioni», un indice: ogni riga dice lo stato di adesso e apre,
 * sopra a questo, il foglio che c'è già. Il tema si sceglie nella sua riga. Il foglio «Privacy» mette in un posto solo
 * i testi scritti accanto a ogni funzione. Che cosa dice ogni riga lo decide js/settings.js.
 * app.js passa ciò che serve con Aura.settingsUI.init(), come per gli altri moduli dell'interfaccia.
 */
(function (Aura) {
  'use strict';

  const { settings: S, theme } = Aura;

  const byId = id => document.getElementById(id);
  const els = {};
  const ROWS = ['assistant', 'log', 'reminders', 'siri', 'backup', 'privacy'];
  // Senza il server queste funzioni non partono: il foglio lo dice in cima, come «Promemoria e Siri».
  const NOTICES = {
    file: 'Promemoria, Siri e assistente funzionano nell\'app pubblicata (https), non aprendo il file dal computer.',
    unconfigured: 'Il server di Aura non è ancora configurato.'
  };
  let ctx = null;
  let busy = false; // «Scollega» in corso

  /* ---------- Foglio «Impostazioni» ---------- */

  /** Riscrive le righe con lo stato di adesso. Si chiama all'apertura e ogni volta che qualcosa cambia sotto. */
  function sync() {
    const info = ctx.getInfo();
    const rows = S.describe(info);
    ROWS.forEach(name => {
      const row = rows[name];
      const state = els[name + 'State'];
      state.textContent = row.state;
      if (row.tone) state.dataset.tone = row.tone;
      else delete state.dataset.tone;
      els[name].disabled = row.disabled === true;
    });
    els.themeState.textContent = rows.theme.state;
    els.themeIcon.setAttribute('href', '#i-theme-' + info.theme);
    els.themeRadios.forEach(radio => { radio.checked = radio.value === info.theme; });

    const available = info.availability === 'ok';
    els.notice.hidden = available;
    els.notice.textContent = available ? '' : (NOTICES[info.availability] || NOTICES.unconfigured);
    els.device.hidden = !available;
    els.deviceOff.hidden = rows.device.connected;
    els.deviceOn.hidden = !rows.device.connected;
    els.disconnect.disabled = busy;
    els.sheet.setAttribute('aria-busy', String(busy));

    els.privacyNow.textContent = rows.privacy.line;
    els.privacyNow.dataset.tone = rows.privacy.tone;
  }

  /**
   * Apre il foglio dall'inizio. Con `part` (un gruppo del foglio) parte da quel gruppo, e `focus` è l'elemento che riceve
   * il focus: serve all'avviso della musica in Focus, che apre il foglio sulla riga «Musica» (js/ui-music.js).
   */
  function open({ part = null, focus = null } = {}) {
    setStatus(null);
    sync();
    ctx.setAutofocus(els.sheet, focus || els.heading);
    ctx.openSheet(els.sheet);
    ctx.showPart(els.sheet, part);
  }

  function openPrivacy() {
    sync();
    ctx.setAutofocus(els.privacySheet, els.privacyHeading);
    ctx.openSheet(els.privacySheet);
    ctx.showPart(els.privacySheet, null);
  }

  /** Esito di «Scollega» quando non riesce: sta nel foglio, perché gli avvisi in basso restano sotto i fogli. */
  function setStatus(text, tone) {
    els.status.hidden = !text;
    els.status.textContent = text || '';
    els.status.dataset.tone = tone || 'warn';
  }

  /**
   * «Scollega questo dispositivo». Se riesce, tutti i fogli si chiudono: così si vede l'avviso «Dispositivo scollegato»
   * con il suo «Annulla», che rimette tutto com'era (lo scrive app.js).
   */
  async function onDisconnect() {
    if (busy) return;
    busy = true;
    setStatus('Scollego il dispositivo…', 'busy');
    sync();
    const result = await ctx.disconnect();
    busy = false;
    if (result && result.ok) {
      setStatus(null);
      sync();
      ctx.closeAllSheets();
      return;
    }
    setStatus(result && result.message ? result.message : null);
    sync();
  }

  /**
   * I testi sulla privacy stanno una volta sola nella pagina, accanto alla funzione di cui parlano (data-privacy="…").
   * Il foglio «Privacy» ne mostra una copia: così i due posti non possono dire cose diverse.
   */
  function copyPrivacyTexts() {
    els.privacySheet.querySelectorAll('[data-privacy-copy]').forEach(target => {
      const sources = document.querySelectorAll('[data-privacy="' + target.dataset.privacyCopy + '"]');
      target.replaceChildren(...Array.from(sources, source => {
        const copy = document.createElement('p');
        copy.className = 'panel__text';
        copy.textContent = source.textContent;
        return copy;
      }));
    });
  }

  /* ---------- Avvio ---------- */

  function init(context) {
    ctx = context;
    [
      'button:settings-button', 'sheet:settings-sheet', 'heading:settings-sheet-title', 'notice:settings-notice',
      'themeState:setting-theme-state', 'themeIcon:setting-theme-icon',
      'device:setting-device', 'deviceOff:setting-device-off', 'deviceOn:setting-device-on',
      'status:setting-device-status', 'disconnect:setting-disconnect',
      'privacySheet:privacy-sheet', 'privacyHeading:privacy-sheet-title', 'privacyNow:privacy-now'
    ].concat(ROWS.map(name => name + ':setting-' + name), ROWS.map(name => name + 'State:setting-' + name + '-state')).forEach(pair => {
      const [key, id] = pair.split(':');
      els[key] = byId(id);
    });
    els.themeRadios = Array.from(els.sheet.querySelectorAll('input[name="theme"]'));

    ctx.setupSheet(els.sheet);
    ctx.setupSheet(els.privacySheet);
    copyPrivacyTexts();

    els.button.addEventListener('click', () => open());
    els.assistant.addEventListener('click', () => ctx.openAssistant());
    els.log.addEventListener('click', () => ctx.openAssistant('log'));
    els.reminders.addEventListener('click', () => ctx.openRemote());
    els.siri.addEventListener('click', () => ctx.openRemote('siri'));
    els.backup.addEventListener('click', () => ctx.openBackup());
    els.privacy.addEventListener('click', openPrivacy);
    els.disconnect.addEventListener('click', onDisconnect);
    els.sheet.addEventListener('change', event => {
      if (event.target.name === 'theme') theme.setMode(event.target.value);
    });
    theme.onChange(sync); // anche quando il tema cambia da un'altra scheda, o con il telefono in automatico

    sync();
    return { open, sync };
  }

  Aura.settingsUI = { init };
})(window.Aura = window.Aura || {});
