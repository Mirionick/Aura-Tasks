/*
 * Aura Tasks — «Negozio» nella scheda Motivazione (P-004, passo 4.1; vedi docs/punti-e-serie.md, «Negozio»).
 * La card: il saldo da spendere (lo stesso di «I tuoi premi»), «Ripara la serie» quando si può e «Apri il negozio».
 * Il foglio: «Ripara la serie», i colori dell'aurora, le forme dei coriandoli e i pacchetti di punti, che si vedono ma non
 * si comprano ancora («Presto»). Tocca la pagina come app.js, che con init() gli passa quello che serve: stato,
 * salvataggio (commitState), avvisi, fogli e coriandoli. La logica sta in js/shop.js; qui solo disegno e gesti.
 */
(function (Aura) {
  'use strict';

  const { utils, rewards: R, shop: SH, motion: M } = Aura;

  const byId = id => document.getElementById(id);
  const TAP_GUARD_MS = 450; // dopo un acquisto, un secondo tocco sullo stesso oggetto così vicino è un doppio tocco
  const STAR = '★';

  let ctx = null;
  const els = {};
  let shownBalance = null; // saldo mostrato: quando cambia con la scheda aperta, la pillola fa un piccolo salto
  let shownItems = '';     // impronta degli oggetti mostrati: si aggiornano solo quando cambiano
  const itemEls = new Map(); // id dell'oggetto → { button, status }: disegnati una volta, poi aggiornati sul posto
  const guarded = new Set(); // oggetti (e 'repair') appena comprati: i doppi tocchi vengono ignorati

  const span = (className, text) => {
    const node = document.createElement('span');
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const pointsLabel = count => utils.formatNumber(count) + ' punti';

  /** L'avviso compare sopra il foglio quando è aperto (un foglio copre la pagina), altrimenti nella pagina. */
  const toast = (message, options = {}) => ctx.showToast(message, { ...options, host: els.sheet.open ? els.sheet : null });

  /* ---------- Disegno ---------- */

  /** Saldo, «Ripara la serie» e oggetti, adesso `now` (Date). La chiama render() di app.js, dentro commit(). */
  function render(now) {
    const state = ctx.getState();
    const today = utils.toISODate(now);
    const available = R.balance(state.stats);
    const value = utils.formatNumber(available);
    els.balanceValue.textContent = value;
    els.sheetBalanceValue.textContent = value;
    if (shownBalance !== null && shownBalance !== available) {
      if (ctx.isActive()) M.flash(els.balance, 'is-bumping');
      if (els.sheet.open) M.flash(els.sheetBalance, 'is-bumping');
    }
    shownBalance = available;
    renderRepair(state.stats, today, available);
    renderItems(SH.catalog(state));
  }

  /**
   * «Ripara la serie»: nella card solo quando si può riparare; nel foglio sempre, con quando si usa o perché adesso no.
   * Con il saldo che non basta il pulsante resta toccabile (aria-disabled): un tocco dice quanto manca.
   */
  function renderRepair(stats, today, available) {
    const offer = SH.repairOffer(stats, today);
    const text = SH.repairText(stats, today);
    const cost = SH.SHOP.repair.cost;
    const label = 'Ripara la serie per ' + pointsLabel(cost);
    els.repair.hidden = !offer;
    els.sheetRepairButton.hidden = !offer;
    [[els.repairTitle, els.repairText], [els.sheetRepairTitle, els.sheetRepairText]].forEach(([title, note]) => {
      title.textContent = text.title;
      note.textContent = text.text;
    });
    [els.repairButton, els.sheetRepairButton].forEach(button => {
      button.setAttribute('aria-label', label);
      if (available < cost) button.setAttribute('aria-disabled', 'true');
      else button.removeAttribute('aria-disabled');
    });
    els.sheetRepair.classList.toggle('is-ready', Boolean(offer));
  }

  /**
   * Gli oggetti dei due gruppi: disegnati la prima volta, poi aggiornati sul posto solo se cambiano. Così dopo un acquisto
   * le anteprime non si rifanno e il focus resta sull'oggetto che lo aveva.
   */
  function renderItems(groups) {
    const key = JSON.stringify(groups);
    if (key === shownItems) return;
    shownItems = key;
    if (!itemEls.size) {
      els.aurora.replaceChildren(...groups.aurora.map(buildItem));
      els.confetti.replaceChildren(...groups.confetti.map(buildItem));
    }
    SH.GROUPS.forEach(group => groups[group].forEach(updateItem));
  }

  /** Un oggetto: anteprima, nome e, sotto, lo stato (lo scrive updateItem). */
  function buildItem(item) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.item = item.id;
    const preview = span('shop-item__preview shop-item__preview--' + item.group);
    preview.setAttribute('aria-hidden', 'true');
    if (item.group === 'aurora') preview.dataset.aurora = item.value;
    else {
      preview.dataset.shape = item.value;
      for (let i = 0; i < 6; i++) preview.append(span('confetti__piece'));
    }
    const status = span('shop-item__status');
    button.append(preview, span('shop-item__name', item.name), status);
    li.append(button);
    itemEls.set(item.id, { button, status });
    return li;
  }

  const setClass = (node, value) => {
    if (node.className !== value) node.className = value;
  };

  /**
   * Lo stato di un oggetto, cioè che cosa fa un tocco: «In uso», «Usa», oppure il prezzo, con l'etichetta per il lettore
   * di schermo. Quelli che costano più del saldo restano toccabili (aria-disabled): un tocco dice quanto manca.
   */
  function updateItem(item) {
    const { button, status } = itemEls.get(item.id);
    let text;
    let kind;
    let label;
    if (item.inUse) {
      text = 'In uso';
      kind = 'used';
      label = item.name + ', in uso';
    } else if (item.owned) {
      text = 'Usa';
      kind = 'use';
      label = 'Usa ' + item.name;
    } else {
      text = STAR + ' ' + utils.formatNumber(item.cost);
      kind = 'price';
      label = item.ready ? 'Compra ' + item.name + ' per ' + pointsLabel(item.cost)
        : item.name + ', ' + pointsLabel(item.cost) + ': te ne mancano ' + utils.formatNumber(item.missing);
    }
    setClass(button, 'shop-item' + (item.owned ? ' is-owned' : '') + (item.inUse ? ' is-used' : '') + (item.ready ? ' is-ready' : ''));
    setClass(status, 'shop-item__status shop-item__status--' + kind);
    if (status.textContent !== text) status.textContent = text;
    if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
    if (!item.owned && !item.ready) button.setAttribute('aria-disabled', 'true');
    else button.removeAttribute('aria-disabled');
  }

  /** I pacchetti di punti: si vedono, con «Presto», ma non si comprano ancora. Disegnati una volta sola. */
  function buildPacks() {
    els.packs.replaceChildren(...SH.SHOP.packs.map((count, index) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'shop-item shop-item--pack';
      button.dataset.pack = String(count);
      button.setAttribute('aria-disabled', 'true');
      button.setAttribute('aria-label', 'Pacchetto da ' + pointsLabel(count) + ', presto');
      const preview = span('shop-item__preview shop-item__preview--pack');
      preview.setAttribute('aria-hidden', 'true');
      preview.textContent = STAR.repeat(index + 1); // una, due o tre stelle
      button.append(preview, span('shop-item__name', pointsLabel(count)), span('shop-item__status shop-item__status--soon', 'Presto'));
      li.append(button);
      return li;
    }));
  }

  /* ---------- Gesti ---------- */

  /** Il centro di un elemento, per far partire i coriandoli da lì. */
  function centerOf(node) {
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  /** Coriandoli dal centro di `from` (un rettangolo), sopra il foglio se è aperto. */
  function confettiFrom(from) {
    ctx.burstConfetti(from.x, from.y, els.sheet.open ? els.sheet : null);
  }

  /**
   * Tocco su un oggetto: se è tuo lo usa (i coriandoli si provano subito); se il saldo basta lo compra e lo usa, con
   * coriandoli e l'avviso «Comprato: Tramonto · −400 punti» con «Annulla», che toglie l'acquisto e rimette quello che era
   * in uso; altrimenti l'avviso dice quanti punti mancano.
   */
  function onItem(id, button) {
    if (guarded.has(id)) return;
    const state = ctx.getState();
    const item = SH.itemOf(id);
    const group = id.split(':')[0];
    const value = id.split(':')[1];
    const now = Date.now();
    if (SH.isOwned(state.stats, group, value)) {
      const look = SH.use(state.look, state.stats, group, value, now);
      if (!look) return;
      const from = centerOf(button);
      if (look !== state.look && !ctx.commitState({ look })) return;
      if (group === 'confetti') confettiFrom(from); // la forma nuova, subito
      return;
    }
    if (!item) return;
    const result = SH.buy(state.stats, id, now);
    if (!result) {
      toast(SH.missingText(item.name, item.cost, R.balance(state.stats)));
      return;
    }
    guarded.add(id);
    setTimeout(() => guarded.delete(id), TAP_GUARD_MS);
    const previous = state.look[group];
    const look = SH.use(state.look, result.stats, group, value, now) || state.look;
    const from = centerOf(button);
    if (!ctx.commitState({ stats: result.stats, look })) return;
    ctx.vibrate([16, 50, 24]);
    confettiFrom(from);
    toast(SH.boughtText(result.entry), {
      action: 'Annulla',
      duration: 6500,
      onAction: () => undoPurchase(result.entry, group, value, previous)
    });
  }

  /** «Annulla» dopo un acquisto: toglie l'acquisto e, se quell'oggetto è ancora in uso, rimette quello di prima. */
  function undoPurchase(entry, group, value, previous) {
    const current = ctx.getState();
    const stats = SH.undo(current.stats, entry.id);
    if (stats === current.stats) return;
    const look = current.look[group] === value ? { ...current.look, [group]: previous, at: Date.now() } : current.look;
    ctx.commitState({ stats, look: SH.sanitizeLook(look, stats.shop) });
  }

  /**
   * «Ripara»: la riparazione va nel registro (i punti guadagnati non cambiano), poi coriandoli, la fiamma che si riaccende
   * (con un traguardo, la festa dei traguardi) e l'avviso «🔥 Serie riparata: 13 giorni di fila · −150 punti» con
   * «Annulla». Se il saldo non basta, l'avviso dice quanto manca.
   */
  function onRepair(button) {
    if (guarded.has('repair')) return;
    const state = ctx.getState();
    const today = utils.todayISO();
    const result = SH.repair(state.stats, today, Date.now());
    if (!result) {
      if (SH.repairOffer(state.stats, today)) {
        toast(SH.missingText(SH.SHOP.repair.name, SH.SHOP.repair.cost, R.balance(state.stats)));
      }
      return;
    }
    guarded.add('repair');
    setTimeout(() => guarded.delete('repair'), TAP_GUARD_MS);
    const from = centerOf(button);
    if (!ctx.commitState({ stats: result.stats })) return;
    ctx.vibrate(result.reached.length ? [20, 60, 30, 60, 50] : [16, 50, 24]);
    confettiFrom(from);
    ctx.celebrateRepair(result.reached);
    toast(SH.repairedText(result), {
      action: 'Annulla',
      duration: 6500,
      onAction: () => ctx.commitState({ stats: SH.undo(ctx.getState().stats, result.entry.id) })
    });
  }

  /** Apre il foglio del negozio, dall'inizio. */
  function openShop() {
    els.sheet.querySelector('.sheet__body').scrollTop = 0;
    ctx.setAutofocus(els.sheet, els.heading);
    ctx.openSheet(els.sheet);
  }

  /* ---------- Avvio ---------- */

  function init(context) {
    ctx = context;
    Object.assign(els, {
      card: byId('shop'),
      balance: byId('shop-balance'),
      balanceValue: byId('shop-balance-value'),
      repair: byId('shop-repair'),
      repairTitle: byId('shop-repair-title'),
      repairText: byId('shop-repair-text'),
      repairButton: byId('shop-repair-btn'),
      open: byId('shop-open'),
      sheet: byId('shop-sheet'),
      heading: byId('shop-sheet-title'),
      sheetBalance: byId('shop-sheet-balance'),
      sheetBalanceValue: byId('shop-sheet-balance-value'),
      sheetRepair: byId('shop-sheet-repair'),
      sheetRepairTitle: byId('shop-sheet-repair-title'),
      sheetRepairText: byId('shop-sheet-repair-text'),
      sheetRepairButton: byId('shop-sheet-repair-btn'),
      aurora: byId('shop-aurora'),
      confetti: byId('shop-confetti'),
      packs: byId('shop-packs')
    });
    const repairLabel = 'Ripara · ' + utils.formatNumber(SH.SHOP.repair.cost) + ' ' + STAR;
    els.repairButton.textContent = repairLabel;
    els.sheetRepairButton.textContent = repairLabel;
    buildPacks();

    els.open.addEventListener('click', openShop);
    els.repairButton.addEventListener('click', () => onRepair(els.repairButton));
    els.sheetRepairButton.addEventListener('click', () => onRepair(els.sheetRepairButton));
    [els.aurora, els.confetti].forEach(list => list.addEventListener('click', event => {
      const button = event.target.closest('[data-item]');
      if (button) onItem(button.dataset.item, button);
    }));
    els.packs.addEventListener('click', event => {
      if (event.target.closest('[data-pack]')) toast(SH.PACKS_TEXT);
    });
    ctx.setupSheet(els.sheet);
    return { render };
  }

  Aura.shopUI = { init };
})(window.Aura = window.Aura || {});
