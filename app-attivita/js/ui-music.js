/*
 * Aura Tasks — musica nel focus, senza account (P-004, passo 4.2; specifica in docs/musica.md): la parte che tocca la
 * pagina. In Focus, sotto «Cosa faccio adesso?», l'avviso (senza un servizio scelto) oppure il carosello «Musica per
 * concentrarti»; il foglio «Quando te lo ricordo?»; nelle Impostazioni il gruppo «Musica»; nel focus a tutto schermo il
 * pulsante «🎧». Che cosa si vede lo decide js/music.js; le preferenze le salva app.js (aura-tasks:prefs.music).
 * app.js passa ciò che serve con Aura.musicUI.init(), dopo Aura.settingsUI.init().
 */
(function (Aura) {
  'use strict';

  const { music: MU, utils, motion: M } = Aura;

  const SVG = 'http://www.w3.org/2000/svg';
  const byId = id => document.getElementById(id);
  const els = {};
  let ctx = null;
  let stripShown = false; // la striscia di «Cosa faccio adesso?» si vede: avviso e carosello stanno con lei
  let cardsFor = null;    // il servizio delle card disegnate (si ridisegnano solo quando cambia)
  let chosen = false;     // nel foglio «Quando te lo ricordo?» è stata toccata una scelta

  const music = () => ctx.getPrefs().music;
  const today = () => utils.todayISO();
  // Focus arrivato dalla tastiera (non da un tocco); i browser che non conoscono :focus-visible lo contano sempre
  const keyboardFocus = el => {
    try { return el.matches(':focus-visible'); } catch (err) { return true; }
  };

  function span(className, text) {
    const el = document.createElement('span');
    el.className = className;
    el.textContent = text;
    return el;
  }

  function icon(name) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const use = document.createElementNS(SVG, 'use');
    use.setAttribute('href', '#' + name);
    svg.appendChild(use);
    return svg;
  }

  /**
   * Salva le preferenze della musica e ridisegna. Con `motion` (le opzioni di Aura.motion.play) l'avviso o il carosello
   * entrano ed escono, e le card delle attività scivolano al posto nuovo.
   */
  function save(next, motion = null) {
    const before = motion ? M.snapshot(els.main) : null;
    ctx.setPrefs({ music: next });
    render(stripShown);
    if (before) M.play(els.main, before, motion);
  }

  /* ---------- Scheda Focus ---------- */

  /**
   * Avviso, carosello o niente (Aura.music.view). Lo chiama app.js a ogni render(): `strip` dice se la striscia di «Cosa
   * faccio adesso?» si vede (senza attività in Focus non c'è, e allora niente musica: prima viene la prima attività).
   */
  function render(strip) {
    stripShown = strip === true;
    const m = music();
    const view = stripShown ? MU.view(m, today()) : null;
    const block = view === 'carousel' || view === 'folded';
    els.note.hidden = view !== 'notice';
    els.block.hidden = !block;
    if (block) {
      drawCards(m);
      const folded = view === 'folded';
      els.block.classList.toggle('is-folded', folded);
      els.list.hidden = folded;
      els.fold.textContent = folded ? 'Mostra' : 'Nascondi';
      els.fold.setAttribute('aria-expanded', String(!folded));
    }
    syncSettings(m);
    syncFocusLink(m);
  }

  /** Le card degli umori, con textContent: un link normale per card, che si apre nell'app del servizio. */
  function drawCards(m) {
    if (cardsFor === m.service) return;
    cardsFor = m.service;
    els.list.replaceChildren(...MU.cards(m).map(card => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'mood';
      link.dataset.mood = card.id;
      link.href = card.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', card.name);
      const emoji = span('mood__emoji', card.emoji);
      emoji.setAttribute('aria-hidden', 'true');
      link.append(emoji, icon('i-external'), span('mood__name', card.label), span('mood__app', card.service));
      item.appendChild(link);
      return item;
    }));
  }

  /** «Scegli il tuo servizio»: apre le Impostazioni sulla riga «Musica», con il focus sulla prima scelta. */
  function openChoice() {
    const radio = els.radios.find(item => item.checked) || els.radios[0];
    ctx.openSettings({ part: els.group, focus: radio });
  }

  /* ---------- «Quando te lo ricordo?» ---------- */

  /** Le quattro scelte, con il giorno in cui l'avviso torna. */
  function openLater() {
    chosen = false;
    const now = today();
    els.laterList.replaceChildren(...MU.LATER.map(option => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.className = 'setting';
      button.type = 'button';
      button.dataset.later = option.id;
      const text = span('setting__text', '');
      const hint = option.days === null
        ? 'Puoi sempre sceglierla nelle Impostazioni'
        : 'Torna ' + utils.formatLongDate(utils.parseISODate(utils.addDays(now, option.days))).toLowerCase();
      text.append(span('setting__name', option.label), span('setting__state', hint));
      button.appendChild(text);
      item.appendChild(button);
      return item;
    }));
    ctx.setAutofocus(els.laterSheet, els.laterHeading);
    ctx.openSheet(els.laterSheet);
  }

  /** Una scelta: il foglio si chiude, l'avviso esce mentre scende, e l'avviso in basso ha «Annulla». */
  function onLater(event) {
    const button = event.target.closest('[data-later]');
    if (!button) return;
    const option = MU.laterOf(button.dataset.later);
    if (!option) return;
    const previous = music();
    chosen = true;
    save(MU.later(previous, option.id, today()), { delay: M.ms('exit') });
    ctx.closeSheet(els.laterSheet);
    ctx.showToast(option.message, {
      action: 'Annulla',
      onAction: () => {
        save(previous, {});
        if (!els.note.hidden) els.noteChoose.focus({ preventScroll: true });
      }
    });
  }

  /** Chiuso dopo una scelta: l'avviso non c'è più, quindi il focus va alla striscia (o all'inizio della pagina). */
  function onLaterClosed() {
    if (!chosen) return;
    chosen = false;
    if (els.note.hidden) {
      const strip = byId('suggest-button');
      (strip && !strip.hidden ? strip : els.main).focus({ preventScroll: true });
    }
  }

  /* ---------- Impostazioni e focus a tutto schermo ---------- */

  function syncSettings(m) {
    els.state.textContent = MU.stateLabel(m);
    els.radios.forEach(radio => { radio.checked = radio.value === m.service; });
  }

  /** «🎧»: la playlist dell'ultimo umore aperto, solo con un servizio scelto. */
  function syncFocusLink(m) {
    const target = MU.focusLink(m);
    els.focusLink.hidden = !target;
    if (!target) {
      els.focusLink.removeAttribute('href');
      return;
    }
    els.focusLink.href = target.url;
    els.focusLink.setAttribute('aria-label', target.name);
  }

  /* ---------- Avvio ---------- */

  function init(context) {
    ctx = context;
    [
      'main:main', 'note:music-note', 'noteChoose:music-note-choose', 'noteClose:music-note-close',
      'block:music', 'fold:music-fold', 'list:music-list',
      'laterSheet:music-later-sheet', 'laterHeading:music-later-title', 'laterList:music-later-list',
      'group:setting-music', 'state:setting-music-state', 'focusLink:focus-music'
    ].forEach(pair => {
      const [key, id] = pair.split(':');
      els[key] = byId(id);
    });
    els.radios = Array.from(els.group.querySelectorAll('input[name="music-service"]'));

    ctx.setupSheet(els.laterSheet);
    els.noteChoose.addEventListener('click', openChoice);
    els.noteClose.addEventListener('click', openLater);
    els.laterList.addEventListener('click', onLater);
    els.laterSheet.addEventListener('close', onLaterClosed);
    els.fold.addEventListener('click', () => {
      const m = music();
      save({ ...m, folded: !m.folded }, {});
    });
    // Con la tastiera la card col focus entra tutta nello schermo: il browser a volte lascia a metà la terza
    els.list.addEventListener('focusin', event => {
      const card = event.target.closest('.mood');
      if (card && keyboardFocus(card)) card.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    // Un tocco su una card: il link si apre da solo (target _blank); qui si ricorda l'umore per il pulsante «🎧».
    els.list.addEventListener('click', event => {
      const card = event.target.closest('.mood');
      if (!card) return;
      ctx.setPrefs({ music: MU.remember(music(), card.dataset.mood) });
      syncFocusLink(music());
    });
    els.group.addEventListener('change', event => {
      if (event.target.name === 'music-service') save(MU.choose(music(), event.target.value));
    });

    render(false);
    return { render };
  }

  Aura.musicUI = { init };
})(window.Aura = window.Aura || {});
