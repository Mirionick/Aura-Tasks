/*
 * Aura Tasks — «I tuoi premi» nella scheda Motivazione (P-003, passo 3.4; vedi docs/punti-e-serie.md, «Premi»).
 * La card: il saldo da spendere, i premi dal più vicino con la barra e «Riscatta», «Aggiungi un premio» e, chiusi, i
 * riscatti. Il foglio del premio: nome, emoji da un elenco fisso, prezzo; modificando, anche «Elimina».
 * Tocca la pagina come app.js, che con init() gli passa quello che serve: stato, salvataggio (commitState), avvisi, fogli
 * e coriandoli. La logica sta in js/rewards.js; qui solo disegno e gesti. Nella pagina i premi si chiamano «prize»:
 * «rewards» è già il riquadro di serie e punti.
 */
(function (Aura) {
  'use strict';

  const { utils, rewards: R, motion: M } = Aura;

  const byId = id => document.getElementById(id);
  const finePointer = window.matchMedia('(pointer: fine)');
  const ERROR_FIELDS = ['title', 'cost'];
  const TAP_GUARD_MS = 450; // dopo un riscatto, un secondo tocco sullo stesso premio così vicino è un doppio tocco

  let ctx = null;
  const els = {};
  let editingId = null;     // premio nel foglio; null = premio nuovo. Si imposta a ogni apertura.
  let emojiChosen = false;  // l'emoji l'ha scelta l'utente (o il premio ce l'ha già): il nome non la cambia più
  let focusAfterClose = null; // chiuso il foglio, il focus torna qui: { id } di una riga, oppure 'add'
  let shownBalance = null;  // saldo mostrato: quando cambia con la scheda aperta, la pillola fa un piccolo salto
  let shownLog = '';        // impronta dei riscatti disegnati: si ridisegnano solo quando cambiano
  const guarded = new Set(); // premi appena riscattati: i doppi tocchi vengono ignorati

  const span = (className, text) => {
    const node = document.createElement('span');
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  /* ---------- Disegno ---------- */

  /** Saldo, premi, aggiunta e riscatti, adesso `now` (Date). La chiama render() di app.js, dentro commit(). */
  function render(now) {
    const state = ctx.getState();
    const available = R.balance(state.stats);
    els.balanceValue.textContent = utils.formatNumber(available);
    if (shownBalance !== null && shownBalance !== available && ctx.isActive()) M.flash(els.balance, 'is-bumping');
    shownBalance = available;

    renderList(R.rows(state));
    const full = !R.canAdd(state.rewards);
    els.add.hidden = full;
    els.full.hidden = !full;
    renderLog(R.history(state, utils.toISODate(now)));
  }

  /** I premi, ridisegnati da capo (al massimo 30). Il focus resta sul pulsante che lo aveva, se c'è ancora. */
  function renderList(rows) {
    const active = document.activeElement;
    const focused = active && els.list.contains(active) && active.dataset.prize
      ? { id: active.closest('.prize').dataset.id, action: active.dataset.prize }
      : null;
    els.empty.hidden = rows.length > 0;
    els.card.classList.toggle('prizes--empty', rows.length === 0);
    els.list.replaceChildren(...rows.map(buildRow));
    if (focused) focusRow(focused.id, focused.action);
  }

  /**
   * Una riga: emoji, nome, barra e stato in un pulsante che apre il foglio; a destra «Riscatta». I due pulsanti si
   * riconoscono da data-prize, non da data-action: quello è dei pulsanti delle card delle attività (vedi app.js).
   */
  function buildRow(row) {
    const { reward } = row;
    const item = document.createElement('li');
    item.className = 'prize' + (row.ready ? ' is-ready' : '');
    item.dataset.id = reward.id;
    item.dataset.flip = 'prize:' + reward.id;

    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'prize__open';
    open.dataset.prize = 'edit';
    open.setAttribute('aria-haspopup', 'dialog');
    const emoji = span('prize__emoji', reward.emoji);
    emoji.setAttribute('aria-hidden', 'true');
    const text = span('prize__text');
    const bar = span('prize__bar');
    bar.setAttribute('aria-hidden', 'true');
    const fill = span('prize__fill');
    fill.style.transform = 'scaleX(' + row.progress + ')';
    bar.append(fill);
    text.append(span('prize__title', reward.title), bar, span('prize__status', row.status));
    open.append(emoji, text);

    // Con il saldo che non basta resta toccabile (aria-disabled, non disabled): un tocco dice quanto manca.
    const redeem = document.createElement('button');
    redeem.type = 'button';
    redeem.className = 'prize__redeem';
    redeem.dataset.prize = 'redeem';
    redeem.textContent = 'Riscatta';
    redeem.setAttribute('aria-label', 'Riscatta ' + reward.title);
    if (!row.ready) redeem.setAttribute('aria-disabled', 'true');

    item.append(open, redeem);
    return item;
  }

  /** «Riscattati»: chiusi, con il numero; dentro, dal più recente, emoji, nome, giorno e punti spesi. */
  function renderLog(entries) {
    els.history.hidden = entries.length === 0;
    els.historyCount.textContent = String(entries.length);
    const key = JSON.stringify(entries);
    if (key === shownLog) return;
    shownLog = key;
    els.log.replaceChildren(...entries.map(entry => {
      const item = document.createElement('li');
      item.className = 'prizes__entry';
      const emoji = span('prizes__entry-emoji', entry.emoji);
      emoji.setAttribute('aria-hidden', 'true');
      item.append(emoji, span('prizes__entry-title', entry.title), span('prizes__entry-meta', entry.when + ' · ' + entry.cost));
      return item;
    }));
  }

  function focusRow(id, action) {
    const row = els.list.querySelector('.prize[data-id="' + CSS.escape(id) + '"]');
    const button = row && row.querySelector('[data-prize="' + action + '"]');
    if (button) button.focus({ preventScroll: true });
    return Boolean(button);
  }

  /* ---------- Riscatto ---------- */

  /**
   * «Riscatta»: il riscatto va nel registro (il livello e il riquadro Punti non cambiano), poi coriandoli dal pulsante e
   * l'avviso «Te lo sei meritato: … · −400 punti» con «Annulla». Se il saldo non basta, l'avviso dice quanto manca.
   */
  function onRedeem(id, button) {
    if (guarded.has(id)) return;
    const state = ctx.getState();
    const reward = state.rewards.find(item => item.id === id);
    if (!reward) return;
    const result = R.redeem(state, id, Date.now());
    if (!result) {
      ctx.showToast(R.missingText(reward, R.balance(state.stats)));
      return;
    }
    guarded.add(id);
    setTimeout(() => guarded.delete(id), TAP_GUARD_MS);
    const from = button.getBoundingClientRect(); // prima del disegno: la riga viene ridisegnata
    if (!ctx.commitState({ stats: result.stats })) return;
    ctx.vibrate([16, 50, 24]);
    ctx.burstConfetti(from.left + from.width / 2, from.top + from.height / 2);
    ctx.showToast(R.redeemText(result.entry), {
      action: 'Annulla',
      duration: 6500,
      onAction: () => ctx.commitState({ stats: R.undoRedeem(ctx.getState().stats, result.entry.id) })
    });
  }

  /**
   * Dopo un completamento (`result` di Aura.points.setDone): il premio che è appena diventato riscattabile, oppure null.
   * L'avviso lo scrive app.js («🍕 Ora puoi riscattare: …»), dopo traguardi, livello e obiettivo.
   */
  function celebrate(result) {
    const { rewards, stats } = ctx.getState();
    const after = R.balance(stats);
    const before = R.balance({ ...stats, totalPoints: Math.max(0, stats.totalPoints - result.points) });
    return R.newlyReady(rewards, before, after);
  }

  /* ---------- Foglio del premio ---------- */

  /** Apre il foglio: vuoto per un premio nuovo (`id` null), compilato per modificarne uno. */
  function openPrize(id) {
    const state = ctx.getState();
    const reward = id ? state.rewards.find(item => item.id === id) : null;
    if (id && !reward) return;
    if (!reward && !R.canAdd(state.rewards)) return;
    editingId = reward ? reward.id : null;
    focusAfterClose = reward ? { id: reward.id } : 'add';
    els.form.reset();
    setErrors({});
    els.heading.textContent = reward ? 'Modifica premio' : 'Nuovo premio';
    els.submitText.textContent = reward ? 'Salva modifiche' : 'Aggiungi premio';
    els.submitIcon.setAttribute('href', reward ? '#i-check' : '#i-plus');
    els.remove.hidden = !reward;
    els.title.value = reward ? reward.title : '';
    setEmoji(reward ? reward.emoji : R.REWARDS.emoji[0].char);
    emojiChosen = Boolean(reward);
    els.cost.value = reward ? String(reward.cost) : '';
    syncCostChips();
    els.costHint.textContent = R.priceHint(state.stats, utils.todayISO());
    const count = reward ? R.redeemedCount(state.stats, reward.id) : 0;
    els.noteText.textContent = count ? R.takenNote(count) : '';
    els.note.hidden = !count;
    // Sul computer si scrive subito; sul telefono prima si vede tutto il foglio (la tastiera ne coprirebbe metà).
    ctx.setAutofocus(els.sheet, finePointer.matches ? els.title : els.heading);
    ctx.openSheet(els.sheet);
  }

  function setEmoji(char) {
    const radio = Array.from(els.emojiGrid.querySelectorAll('input')).find(input => input.value === char);
    if (radio) radio.checked = true;
  }

  /** Scrivendo il nome, finché l'emoji non l'ha scelta l'utente, si sceglie da sola («Pizza…» → 🍕; nessuna → 🎁). */
  function onTitleInput() {
    setError('title', null);
    if (!emojiChosen) setEmoji(R.guessEmoji(els.title.value) || R.REWARDS.emoji[0].char);
  }

  /** Il prezzo pronto uguale a quello scritto è premuto. */
  function syncCostChips() {
    els.costs.querySelectorAll('[data-cost]').forEach(chip => {
      chip.setAttribute('aria-pressed', String(chip.dataset.cost === els.cost.value.trim()));
    });
  }

  function setError(field, message) {
    const el = field === 'title' ? els.errTitle : els.errCost;
    el.textContent = message || '';
    el.hidden = !message;
    const input = field === 'title' ? els.title : els.cost;
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  function setErrors(errors) {
    ERROR_FIELDS.forEach(field => setError(field, errors[field]));
  }

  /** «Aggiungi premio» o «Salva modifiche». Le righe si muovono mentre il foglio si chiude; «Annulla» torna indietro. */
  function onSubmit(event) {
    event.preventDefault();
    const { value, errors } = R.validateInput({ title: els.title.value, emoji: els.form.elements.emoji.value, cost: els.cost.value });
    setErrors(errors);
    const firstError = ERROR_FIELDS.find(field => errors[field]);
    if (firstError) {
      (firstError === 'title' ? els.title : els.cost).focus();
      return;
    }
    const state = ctx.getState();
    const motion = { delay: M.ms('exit') };
    if (editingId) {
      const id = editingId;
      const result = R.updateReward(state.rewards, id, value);
      if (!result.changed) {
        ctx.closeSheet(els.sheet);
        if (!result.previous) ctx.showToast('Questo premio non c\'è più'); // eliminato in un'altra scheda
        return;
      }
      const saved = ctx.commitState({ rewards: result.rewards }, motion);
      ctx.closeSheet(els.sheet);
      if (!saved) return;
      const before = { title: result.previous.title, emoji: result.previous.emoji, cost: result.previous.cost };
      ctx.showToast('Modifiche salvate', {
        action: 'Annulla',
        onAction: () => {
          const undo = R.updateReward(ctx.getState().rewards, id, before);
          if (undo.changed) ctx.commitState({ rewards: undo.rewards });
        }
      });
      return;
    }
    const added = R.addReward(state.rewards, value, Date.now());
    if (!added.reward) { // 30 premi, aggiunti nel frattempo in un'altra scheda
      ctx.closeSheet(els.sheet);
      return;
    }
    focusAfterClose = { id: added.reward.id };
    const saved = ctx.commitState({ rewards: added.rewards }, motion);
    ctx.closeSheet(els.sheet);
    if (saved) ctx.showToast('Premio aggiunto');
  }

  /** «Elimina premio»: esce scivolando, con «Annulla». I suoi riscatti restano nello storico, con il nome. */
  function onRemove() {
    const id = editingId;
    const { rewards, removed, index } = R.removeReward(ctx.getState().rewards, id);
    if (!removed) {
      ctx.closeSheet(els.sheet);
      return;
    }
    focusAfterClose = 'add';
    const saved = ctx.commitState({ rewards }, { delay: M.ms('exit'), slide: 'prize:' + id });
    ctx.closeSheet(els.sheet);
    if (!saved) return;
    ctx.showToast('Premio eliminato', {
      action: 'Annulla',
      onAction: () => ctx.commitState({ rewards: R.restoreReward(ctx.getState().rewards, removed, index) })
    });
  }

  /** Chiuso il foglio: il pulsante che l'aveva aperto è stato ridisegnato, quindi il focus va sulla riga (o su «Aggiungi»). */
  function onSheetClose() {
    const target = focusAfterClose;
    focusAfterClose = null;
    if (!target || !ctx.isActive()) return;
    if (target !== 'add' && focusRow(target.id, 'edit')) return;
    if (!els.add.hidden) els.add.focus({ preventScroll: true });
  }

  /* ---------- Avvio ---------- */

  function init(context) {
    ctx = context;
    Object.assign(els, {
      card: byId('prizes'),
      balance: byId('prizes-balance'),
      balanceValue: byId('prizes-balance-value'),
      empty: byId('prizes-empty'),
      list: byId('prizes-list'),
      add: byId('prize-add'),
      full: byId('prizes-full'),
      history: byId('prizes-history'),
      historyCount: byId('prizes-history-count'),
      log: byId('prizes-log'),
      sheet: byId('prize-sheet'),
      form: byId('prize-form'),
      heading: byId('prize-sheet-title'),
      note: byId('prize-note'),
      noteText: byId('prize-note-text'),
      title: byId('prize-title'),
      errTitle: byId('err-prize-title'),
      emojiGrid: byId('prize-emoji'),
      cost: byId('prize-cost'),
      costs: byId('prize-costs'),
      costHint: byId('prize-cost-hint'),
      errCost: byId('err-prize-cost'),
      remove: byId('prize-delete'),
      submitIcon: byId('prize-submit-icon'),
      submitText: byId('prize-submit-text')
    });

    // Le emoji dell'elenco fisso, come pulsanti di opzione (il nome è per il lettore di schermo), e i prezzi pronti.
    els.emojiGrid.replaceChildren(...R.REWARDS.emoji.map(item => {
      const label = document.createElement('label');
      label.className = 'emoji-pick';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'emoji';
      input.value = item.char;
      input.setAttribute('aria-label', item.name);
      const face = span('emoji-pick__face', item.char);
      face.setAttribute('aria-hidden', 'true');
      label.append(input, face);
      return label;
    }));
    els.costs.replaceChildren(...R.REWARDS.costs.map(cost => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.dataset.cost = String(cost);
      chip.setAttribute('aria-pressed', 'false');
      chip.setAttribute('aria-label', utils.formatNumber(cost) + ' punti');
      chip.textContent = utils.formatNumber(cost);
      return chip;
    }));

    els.list.addEventListener('click', event => {
      const button = event.target.closest('[data-prize]');
      const row = button && button.closest('.prize');
      if (!row) return;
      if (button.dataset.prize === 'redeem') onRedeem(row.dataset.id, button);
      else openPrize(row.dataset.id);
    });
    els.add.addEventListener('click', () => openPrize(null));
    els.form.addEventListener('submit', onSubmit);
    els.title.addEventListener('input', onTitleInput);
    els.emojiGrid.addEventListener('change', () => { emojiChosen = true; });
    els.cost.addEventListener('input', () => {
      syncCostChips();
      setError('cost', null);
    });
    els.costs.addEventListener('click', event => {
      const chip = event.target.closest('[data-cost]');
      if (!chip) return;
      els.cost.value = chip.dataset.cost;
      syncCostChips();
      setError('cost', null);
    });
    els.remove.addEventListener('click', onRemove);
    ctx.setupSheet(els.sheet);
    els.sheet.addEventListener('close', onSheetClose);
    return { render, celebrate };
  }

  Aura.rewardsUI = { init };
})(window.Aura = window.Aura || {});
