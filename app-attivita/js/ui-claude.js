/*
 * Aura Tasks — connettore per Claude (P-006, passo 6.2; specifica in docs/connettore-claude.md): la parte che tocca la
 * pagina. Il foglio «Claude», aperto dalla riga delle Impostazioni: che cosa fa, i passi con l'indirizzo da copiare,
 * «Mostra il codice» (in grande, con il tempo che resta e «Nuovo codice»; intanto lo stato si controlla ogni 4 secondi),
 * i collegamenti con le loro date e «Scollega Claude», con la conferma nel foglio.
 * Lo stato dei collegamenti sta solo in memoria e si chiede al server: all'avvio, aprendo le Impostazioni (al massimo
 * ogni 30 secondi) e aprendo questo foglio. Non si salva niente. Gli elementi con `data-if-claude` (le note sotto
 * «Scollega questo dispositivo») si vedono solo con Claude collegato.
 * Le frasi e i calcoli stanno in js/claude.js; app.js passa ciò che serve con Aura.claudeUI.init().
 */
(function (Aura) {
  'use strict';

  const { claude: C, remote: R } = Aura;

  const REFRESH_MS = 30 * 1000;
  const TEXTS = {
    linked: 'Claude è collegato: in una chat puoi dirgli «mettilo su Aura».',
    justLinked: 'Claude è collegato. Prova a scrivergli «metti su Aura: comprare il latte»: l\'attività arriva quando riapri Aura.',
    unlinked: 'Claude non è collegato.',
    checking: 'Controllo se Claude è collegato…',
    preparing: 'Preparo il codice…',
    ready: 'Codice pronto: scrivilo nella pagina di Aura che si apre da Claude.',
    used: 'Codice usato: aspetto Claude…',
    expired: 'Il codice è scaduto: tocca «Mostra il codice» per averne uno nuovo.',
    unfinished: 'Claude non ha finito il collegamento: tocca «Mostra il codice» e riprova.',
    unlinking: 'Scollego Claude…',
    unlinkedNow: 'Claude è scollegato: non può più aggiungere attività.',
    odd: 'Il server di Aura ha risposto in modo strano: riprova tra poco.',
    notReady: 'Il server di Aura non è ancora pronto per Claude: va aggiornato.',
    noCopy: 'Non riesco a copiare: tieni premuto sull\'indirizzo per selezionarlo.'
  };

  const byId = id => document.getElementById(id);
  const els = {};
  let ctx = null;

  let links = null;     // i collegamenti, [{ createdAt, usedAt }]; null finché non si sa
  let checking = false; // GET /api/claude in corso (stato o controllo del codice)
  let inFlight = null;  // la stessa richiesta: chi chiede mentre è in corso aspetta quella risposta
  let checkedAt = 0;
  let trouble = null;   // perché lo stato non si sa (internet, server)
  let busy = false;     // «Mostra il codice», «Nuovo codice» o «Scollega Claude» in corso
  let asking = false;   // la conferma di «Scollega Claude» è aperta
  let message = null;   // { text, tone }: l'esito dell'ultima azione, al posto della riga di stato normale
  // Il codice in vista: { value, deadline, issuedAt, before, usedAt }. `issuedAt` è quando il server l'ha dato, sul suo
  // orologio; `before` sono i collegamenti di quando è apparso (null se non si sapevano: li dà il primo controllo);
  // `usedAt` è quando il server non l'ha più dato come valido.
  let shown = null;
  let timer = null;
  let polledAt = 0;
  let urlShown = '';

  const linkedNow = () => Boolean(links && links.length);
  const isOpen = () => Boolean(els.sheet && els.sheet.open);

  /* ---------- Stato ---------- */

  /** Per le righe delle Impostazioni (js/settings.js): quanti collegamenti (null = non si sa) e se lo si sta chiedendo. */
  function state() {
    return { links: links ? links.length : null, checking };
  }

  /** Dopo ogni cambio: il foglio, le note `data-if-claude` e, in app.js, le righe delle Impostazioni e la privacy. */
  function changed() {
    render();
    document.querySelectorAll('[data-if-claude]').forEach(el => { el.hidden = !linkedNow(); });
    ctx.onChange();
  }

  /**
   * Perché una richiesta non è andata. 404 vuol dire che il server è di prima del passo 6.1 e non conosce ancora questi
   * indirizzi: il suo «Indirizzo sconosciuto» non direbbe niente.
   */
  function troubleText(result) {
    return result && result.status === 404 ? TEXTS.notReady : R.troubleMessage(result, navigator.onLine);
  }

  /** GET /api/claude. Restituisce lo stato ripulito, oppure null (e il motivo in `trouble`). */
  async function askStatus() {
    checking = true;
    const result = await ctx.withDevice(device => R.api.claudeStatus(device));
    checking = false;
    checkedAt = Date.now();
    const status = result.ok ? C.readStatus(result.data) : null;
    if (status) {
      links = status.links;
      trouble = null;
    } else {
      trouble = result.ok ? TEXTS.odd : troubleText(result);
    }
    return status;
  }

  /** Una domanda alla volta: se ce n'è già una in corso, si aspetta quella invece di farne un'altra. */
  function fetchStatus() {
    if (!inFlight) inFlight = askStatus().finally(() => { inFlight = null; });
    return inFlight;
  }

  /**
   * Chiede lo stato al server. Senza `force`, non prima di 30 secondi dall'ultima volta. Senza il codice del
   * dispositivo non chiede niente: non c'è nessun collegamento.
   */
  async function refresh({ force = false } = {}) {
    if (!ctx.getRemote().code) {
      if (!links || links.length) {
        links = [];
        changed();
      }
      return;
    }
    if (R.availability() !== 'ok') return;
    if (inFlight) {
      await inFlight; // la risposta che sta arrivando basta
      changed();
      return;
    }
    if (!force && links && Date.now() - checkedAt < REFRESH_MS) return;
    if (navigator.onLine === false) {
      trouble = R.troubleMessage(null, false);
      changed();
      return;
    }
    const pending = fetchStatus();
    changed(); // «Controllo…» finché non si sa
    await pending;
    changed();
  }

  /**
   * Prima di «Scollega questo dispositivo», che toglie anche i collegamenti di Claude: lo stato di adesso, chiesto al
   * server (o la risposta già in arrivo), perché quello in memoria può mancare (la prima domanda non è finita, o non è
   * andata) o essere vecchio. Restituisce true se Claude è collegato, false se no, null se non si è potuto sapere: allora
   * l'avviso di «Annulla» lo dice con un «se».
   */
  async function settle() {
    const status = await fetchStatus();
    changed();
    if (status) return status.links.length > 0;
    return linkedNow() ? true : null;
  }

  /** Dopo «Scollega questo dispositivo»: il server ha tolto anche i collegamenti. */
  function forget() {
    stopTimer();
    shown = null;
    asking = false;
    message = null;
    trouble = null;
    links = [];
    checkedAt = Date.now();
    changed();
  }

  /* ---------- Il codice ---------- */

  function stopTimer() {
    clearInterval(timer);
    timer = null;
  }

  function startTimer() {
    stopTimer();
    timer = setInterval(tick, 1000);
  }

  /**
   * Il codice non c'è più (scaduto, o il collegamento non è finito): torna «Mostra il codice», con il motivo. Se il
   * focus era nel riquadro del codice, che sparisce, va su «Mostra il codice» (tastiera, lettore di schermo).
   */
  function dropCode(text) {
    const focusWasIn = els.code.contains(document.activeElement);
    stopTimer();
    shown = null;
    message = { text, tone: 'warn' };
    changed();
    if (focusWasIn) els.show.focus();
  }

  /** Ogni secondo, con il codice in vista: il tempo che resta e, ogni 4 secondi, lo stato dal server. */
  function tick() {
    if (!shown || !isOpen()) {
      stopTimer();
      return;
    }
    const now = Date.now();
    if (shown.usedAt && now - shown.usedAt > C.USED_GRACE_MS) {
      dropCode(TEXTS.unfinished);
      return;
    }
    if (!shown.usedAt && !C.timeLeft(shown.deadline, now)) {
      dropCode(TEXTS.expired);
      return;
    }
    renderCode(now);
    // Con Aura in secondo piano non si chiede niente: si riprende appena si torna (visibilitychange).
    if (!checking && !busy && document.visibilityState !== 'hidden' && now - polledAt >= C.POLL_MS) poll();
  }

  async function poll() {
    polledAt = Date.now();
    const status = await fetchStatus();
    if (!status || !shown) return; // problemi di rete: si riprova al prossimo giro
    // È arrivato il collegamento? Si confronta con i collegamenti di prima. Se non si sapevano (la domanda prima del
    // codice non è andata), uno creato dopo il codice è quello nuovo: non va preso come punto di partenza.
    const linked = shown.before === null ? C.linkedSince(status.links, shown.issuedAt) : C.hasNewLink(shown.before, status.links);
    if (linked) {
      const focusWasIn = els.code.contains(document.activeElement);
      stopTimer();
      shown = null;
      message = { text: TEXTS.justLinked, tone: 'on' };
      changed();
      if (focusWasIn) els.linksTitle.focus();
      return;
    }
    if (shown.before === null) shown.before = status.links; // tutti di prima del codice: da qui si confronta
    // Il server non lo dà più come valido: è stato scritto (o è scaduto). Claude finisce il collegamento in pochi secondi.
    if (!status.code && !shown.usedAt) {
      shown.usedAt = Date.now();
      message = { text: TEXTS.used, tone: 'busy' };
    }
    changed();
  }

  /** «Mostra il codice» e «Nuovo codice». Come «Crea il codice per Siri», la prima volta registra il dispositivo. */
  async function onShowCode() {
    if (busy) return;
    busy = true;
    stopTimer();
    message = { text: TEXTS.preparing, tone: 'busy' };
    render();
    let result;
    try {
      if (!ctx.getRemote().code) await ctx.ensureDevice();
      if (!links) await fetchStatus(); // i collegamenti di adesso, per riconoscere quello nuovo
      result = await ctx.withDevice(device => R.api.claudeCode(device));
    } catch (err) {
      result = { ok: false, status: 0, data: null, message: err && err.message };
    }
    busy = false;
    const data = result.data;
    if (!result.ok || !data || !C.isPairCode(data.code)) {
      const text = result.message || (result.ok ? TEXTS.odd : troubleText(result));
      if (shown) dropCode(text);
      else {
        message = { text, tone: 'warn' };
        changed();
      }
      return;
    }
    const now = Date.now();
    shown = {
      value: data.code,
      deadline: C.codeDeadline(data.expiresAt, now),
      issuedAt: C.codeIssuedAt(data.expiresAt),
      before: links ? links.slice() : null,
      usedAt: 0
    };
    polledAt = now; // il primo controllo tra 4 secondi
    message = { text: TEXTS.ready, tone: 'busy' };
    changed();
    startTimer();
    // Il pulsante toccato è sparito o è cambiato: il focus va sul codice, che il lettore di schermo legge. Il riquadro
    // si porta in vista tutto intero (tempo, «Nuovo codice» e nota compresi), non solo la riga del codice.
    els.codeValue.focus({ preventScroll: true });
    els.code.scrollIntoView({ block: 'nearest' });
  }

  async function onCopy() {
    const url = C.connectorUrl(R.serverUrl());
    if (!await ctx.copyText(url, els.sheet)) {
      message = { text: TEXTS.noCopy, tone: 'warn' };
      render();
      return;
    }
    els.copy.textContent = 'Copiato ✓';
    setTimeout(() => { els.copy.textContent = 'Copia'; }, 1800);
  }

  /* ---------- «Scollega Claude» ---------- */

  function onAskUnlink() {
    asking = true;
    message = null;
    render();
    els.confirmText.focus();
  }

  function onCancelUnlink() {
    asking = false;
    render();
    els.unlink.focus();
  }

  async function onConfirmUnlink() {
    if (busy) return;
    busy = true;
    message = { text: TEXTS.unlinking, tone: 'busy' };
    render();
    const result = await ctx.withDevice(device => R.api.claudeUnlink(device));
    busy = false;
    asking = false;
    if (!result.ok) {
      message = { text: troubleText(result), tone: 'warn' };
      render();
      els.unlink.focus();
      return;
    }
    stopTimer();
    shown = null;
    links = [];
    checkedAt = Date.now();
    message = { text: TEXTS.unlinkedNow, tone: 'off' };
    changed();
    els.connectTitle.focus(); // il riquadro dei collegamenti è sparito
  }

  /* ---------- Foglio ---------- */

  /**
   * L'indirizzo, con i punti dove può andare a capo (<wbr>): dopo «https://», prima di ogni «.» e di ogni «/». Così
   * ogni riga è un pezzo intero dell'indirizzo, non un taglio a caso; il testo, e quello copiato, non cambia.
   */
  function showUrl(url) {
    if (url === urlShown) return;
    urlShown = url;
    const parts = url.match(/^[a-z][a-z0-9+.-]*:\/\/|[./]?[^./]+|[./]/gi) || [url];
    els.url.replaceChildren(...parts.flatMap((part, i) => (i ? [document.createElement('wbr'), part] : [part])));
  }

  function statusLine() {
    if (message) return message;
    if (linkedNow()) return { text: TEXTS.linked, tone: 'on' };
    if (!links && checking) return { text: TEXTS.checking, tone: 'busy' };
    if (!links && trouble) return { text: trouble, tone: 'warn' };
    return { text: TEXTS.unlinked, tone: 'off' };
  }

  function renderCode(now) {
    if (!shown) return;
    els.codeText.textContent = C.groupCode(shown.value);
    els.codeSpoken.textContent = 'Codice per Claude: ' + C.spellCode(shown.value);
    els.codeTime.textContent = shown.usedAt ? 'Codice usato' : C.timeLeft(shown.deadline, now) || '';
  }

  function render() {
    if (!els.sheet) return;
    const now = Date.now();
    const status = statusLine();
    els.status.textContent = status.text;
    els.status.dataset.tone = status.tone;

    const linked = linkedNow();
    els.linksPanel.hidden = !linked;
    els.links.replaceChildren(...(links || []).map(link => {
      const li = document.createElement('li');
      li.textContent = C.linkLine(link, now);
      return li;
    }));
    els.unlink.hidden = asking;
    els.unlink.disabled = busy;
    els.confirm.hidden = !asking;
    els.confirmOk.disabled = busy;
    els.confirmCancel.disabled = busy;

    showUrl(C.connectorUrl(R.serverUrl()));
    els.show.hidden = Boolean(shown);
    els.show.disabled = busy;
    // Già collegato: «Mostra il codice» resta, per un altro collegamento, ma non è più il pulsante principale
    els.show.classList.toggle('btn--primary', !linked);
    els.show.classList.toggle('btn--soft', linked);
    els.code.hidden = !shown;
    els.newCode.disabled = busy;
    renderCode(now);
    els.sheet.setAttribute('aria-busy', String(busy));
  }

  /** Apre il foglio dall'inizio e chiede lo stato al server. Un codice ancora valido resta in vista. */
  function open() {
    asking = false;
    message = null;
    if (shown && (shown.usedAt || !C.timeLeft(shown.deadline, Date.now()))) shown = null;
    if (shown) message = { text: TEXTS.ready, tone: 'busy' };
    render();
    ctx.setAutofocus(els.sheet, els.heading);
    ctx.openSheet(els.sheet);
    ctx.showPart(els.sheet, null);
    if (shown) startTimer();
    refresh({ force: true });
  }

  /* ---------- Avvio ---------- */

  function init(context) {
    ctx = context;
    [
      'sheet:claude-sheet', 'heading:claude-sheet-title', 'status:claude-status',
      'linksPanel:claude-links-panel', 'linksTitle:claude-links-title', 'links:claude-links', 'unlink:claude-unlink',
      'confirm:claude-confirm', 'confirmText:claude-confirm-text', 'confirmOk:claude-confirm-ok', 'confirmCancel:claude-confirm-cancel',
      'connectTitle:claude-connect-title', 'url:claude-url', 'copy:claude-copy', 'show:claude-show',
      'code:claude-code', 'codeValue:claude-code-value', 'codeText:claude-code-text', 'codeSpoken:claude-code-spoken',
      'codeTime:claude-code-time', 'newCode:claude-new-code'
    ].forEach(pair => {
      const [key, id] = pair.split(':');
      els[key] = byId(id);
    });

    ctx.setupSheet(els.sheet);
    els.sheet.addEventListener('close', stopTimer); // chiuso il foglio, niente più controlli: riaprendolo si riprende
    els.show.addEventListener('click', onShowCode);
    els.newCode.addEventListener('click', onShowCode);
    els.copy.addEventListener('click', onCopy);
    els.unlink.addEventListener('click', onAskUnlink);
    els.confirmCancel.addEventListener('click', onCancelUnlink);
    els.confirmOk.addEventListener('click', onConfirmUnlink);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && shown && timer) {
        polledAt = 0; // tornando su Aura (per esempio da Claude) si controlla subito
        tick();
      }
    });
    render();
    return { open, refresh, state, settle, forget };
  }

  Aura.claudeUI = { init };
})(window.Aura = window.Aura || {});
