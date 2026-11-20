/*
 * Aura Tasks — «I tuoi premi» (P-003, passo 3.4; vedi docs/punti-e-serie.md, «Premi»).
 * Solo funzioni pure: i premi (state.rewards), i riscatti nel registro (stats.spent), il saldo da spendere, i limiti,
 * la pulizia dei dati letti e le frasi. Spendere non toglie niente a stats.totalPoints: il livello e il riquadro Punti
 * contano tutti i punti guadagnati. Il saldo da spendere è uno solo, per i premi e per il negozio (P-004, js/shop.js).
 * Niente DOM, niente localStorage: l'interfaccia sta in js/ui-rewards.js.
 */
(function (Aura) {
  'use strict';

  const { utils, points: P } = Aura;

  /**
   * Regole e limiti:
   * - max: premi al massimo; titleMax: caratteri del nome; costMin e costMax: il prezzo, intero, in punti;
   * - costs: i prezzi pronti nel foglio del premio;
   * - emoji: l'elenco fisso tra cui scegliere (15, cinque per riga nel foglio), con il nome per il lettore di schermo.
   *   La prima è quella di partenza. `words` sono inizi di parola (uno spazio in fondo = parola intera) che la fanno
   *   scegliere da sola dal nome del premio (guessEmoji): vince la prima emoji dell'elenco che ne trova uno.
   */
  const REWARDS = {
    max: 30,
    titleMax: 60,
    costMin: 10,
    costMax: 100000,
    costs: [100, 250, 500, 1000, 2500, 5000],
    emoji: [
      { char: '🎁', name: 'Regalo', words: ['regal', 'sorpres', 'pacco'] },
      { char: '🍕', name: 'Pizza', words: ['pizz'] },
      { char: '🍝', name: 'Cena fuori', words: ['cena', 'cene', 'ristorant', 'pranz', 'sushi', 'pasta', 'spaghett',
        'carbonar', 'tortell', 'ramen', 'burger', 'hamburger'] },
      { char: '🍦', name: 'Gelato', words: ['gelat', 'dolc', 'tort', 'cioccolat', 'pastic', 'tiramis', 'cannol',
        'biscott'] },
      { char: '☕', name: 'Caffè', words: ['caff', 'colazion', 'cappucc', 'brioch', 'cornett'] },
      { char: '🍷', name: 'Aperitivo', words: ['aperitiv', 'apericena', 'spritz', 'vino', 'vini', 'birr', 'cocktail'] },
      { char: '🎬', name: 'Cinema', words: ['cinem', 'film', 'serie', 'netflix', 'teatr', 'spettacol'] },
      { char: '🎮', name: 'Videogiochi', words: ['videogioc', 'playstation', 'ps5', 'switch', 'xbox', 'nintendo'] },
      { char: '📚', name: 'Libro', words: ['libr', 'fumett', 'manga', 'kindle'] },
      { char: '🎧', name: 'Musica', words: ['music', 'concert', 'cuffi', 'disco', 'vinil', 'canzon'] },
      { char: '🛍️', name: 'Shopping', words: ['shopping', 'vestit', 'magli', 'borsa', 'borse', 'giacc', 'compr',
        'negozi'] },
      { char: '👟', name: 'Sport', words: ['sport', 'scarp', 'palestr', 'corsa', 'partit', 'calcett', 'padel', 'tennis',
        'bici', 'nuot', 'yoga'] },
      { char: '🧖', name: 'Relax', words: ['relax', 'massagg', 'spa ', 'terme', 'bagno', 'manicure', 'parrucch'] },
      { char: '✈️', name: 'Viaggio', words: ['viagg', 'vacanz', 'gita', 'weekend', 'week end', 'mare', 'montagn', 'lago',
        'treno', 'volo'] },
      { char: '🛌', name: 'Riposo', words: ['dorm', 'ripos', 'pisolin', 'divano', 'pigr', 'giornata libera',
        'mattina libera', 'pomeriggio libero', 'serata libera'] }
    ]
  };
  const DEFAULT_EMOJI = REWARDS.emoji[0].char;
  const MINUS = '−'; // il segno meno tipografico, come nell'avviso «−400 punti»

  const bare = text => String(text).replace(/\uFE0F/g, ''); // l'emoji con o senza il selettore di variante è la stessa
  const pointsLabel = count => (count === 1 ? '1 punto' : utils.formatNumber(count) + ' punti');
  const timesLabel = count => (count === 1 ? '1 volta' : count + ' volte');
  const cleanTitle = value => String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
  const isCost = value => Number.isInteger(value) && value >= REWARDS.costMin && value <= REWARDS.costMax;

  /** L'emoji dell'elenco uguale a `value` (anche senza il selettore di variante); null se non c'è. */
  function emojiOf(value) {
    if (typeof value !== 'string' || !value) return null;
    const found = REWARDS.emoji.find(item => bare(item.char) === bare(value));
    return found ? found.char : null;
  }

  /** L'emoji che il nome fa pensare («Pizza del venerdì» → 🍕), cercando l'inizio delle parole; null se nessuna. */
  function guessEmoji(title) {
    const text = ' ' + String(title == null ? '' : title).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() + ' ';
    const found = REWARDS.emoji.find(item => item.words.some(word => text.includes(' ' + word)));
    return found ? found.char : null;
  }

  /* ---------- Pulizia dei dati letti ---------- */

  /**
   * Un premio letto dall'archivio o da un backup, ripulito; null se è irrecuperabile (senza nome o senza un prezzo).
   * Il nome si taglia a 60 caratteri, il prezzo si arrotonda e si riporta tra 10 e 100.000, un'emoji fuori dall'elenco
   * diventa 🎁. I campi sconosciuti vengono conservati.
   */
  function sanitizeReward(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const title = typeof raw.title === 'string' ? cleanTitle(raw.title).slice(0, REWARDS.titleMax).trim() : '';
    if (!title || !Number.isFinite(raw.cost)) return null;
    return {
      ...raw,
      id: typeof raw.id === 'string' && raw.id ? raw.id : utils.uid(),
      title,
      emoji: emojiOf(raw.emoji) || DEFAULT_EMOJI,
      cost: Math.min(REWARDS.costMax, Math.max(REWARDS.costMin, Math.round(raw.cost))),
      createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now()
    };
  }

  /** L'elenco dei premi ripulito: un id doppio diventa nuovo, e si tengono al massimo i primi 30. Non un elenco → []. */
  function sanitizeRewards(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    return raw.map(sanitizeReward).filter(Boolean).slice(0, REWARDS.max).map(reward => {
      const unique = seen.has(reward.id) ? { ...reward, id: utils.uid() } : reward;
      seen.add(unique.id);
      return unique;
    });
  }

  /**
   * I riscatti del registro (stats.spent), ripuliti come i giorni: si scarta un riscatto senza un prezzo intero positivo o
   * senza un istante valido. Un id ripetuto è lo stesso riscatto (gli id servono a non contarlo due volte): resta il primo.
   * Senza id ne riceve uno; il nome si taglia a 60 caratteri («Premio» se manca); `rewardId` è il premio, oppure null.
   * I campi sconosciuti vengono conservati. Non un elenco → [].
   */
  function sanitizeSpent(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    const spent = [];
    raw.forEach(entry => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
      if (!Number.isInteger(entry.cost) || entry.cost <= 0 || !Number.isFinite(entry.at) || entry.at <= 0) return;
      const id = typeof entry.id === 'string' && entry.id ? entry.id : utils.uid();
      if (seen.has(id)) return;
      seen.add(id);
      const title = typeof entry.title === 'string' ? cleanTitle(entry.title).slice(0, REWARDS.titleMax).trim() : '';
      spent.push({
        ...entry,
        id,
        rewardId: typeof entry.rewardId === 'string' && entry.rewardId ? entry.rewardId : null,
        title: title || 'Premio'
      });
    });
    return spent;
  }

  /* ---------- Saldo e riscatti ---------- */

  const spentOf = stats => (stats && Array.isArray(stats.spent) ? stats.spent : []);

  /** I punti spesi in premi, in tutto. */
  function spentPoints(stats) {
    return spentOf(stats).reduce((sum, entry) => sum + entry.cost, 0);
  }

  /** I punti spesi nel negozio (stats.shop, P-004, passo 4.1): colori, coriandoli e serie riparate. */
  function shopPoints(stats) {
    const shop = stats && Array.isArray(stats.shop) ? stats.shop : [];
    return shop.reduce((sum, entry) => sum + entry.cost, 0);
  }

  /**
   * Il saldo da spendere, uno solo per premi e negozio: punti guadagnati meno punti spesi nei premi e nel negozio, mai
   * sotto zero. Annullando un completamento dopo una spesa il saldo può restare a zero finché quei punti non si guadagnano
   * di nuovo.
   */
  function balance(stats) {
    return Math.max(0, stats.totalPoints - spentPoints(stats) - shopPoints(stats));
  }

  /** Quante volte è stato riscattato un premio. */
  function redeemedCount(stats, rewardId) {
    return spentOf(stats).filter(entry => entry.rewardId === rewardId).length;
  }

  /**
   * Riscatta un premio: aggiunge al registro { id, rewardId, title, cost, at }. Restituisce { stats, entry }, oppure null
   * se il premio non c'è o il saldo non basta. `state` ha `rewards` e `stats`; `now` è l'istante (ms).
   */
  function redeem(state, rewardId, now) {
    const reward = state.rewards.find(item => item.id === rewardId);
    if (!reward || balance(state.stats) < reward.cost) return null;
    const entry = { id: utils.uid(), rewardId: reward.id, title: reward.title, cost: reward.cost, at: now };
    return { stats: { ...state.stats, spent: spentOf(state.stats).concat(entry) }, entry };
  }

  /** «Annulla» dopo un riscatto: toglie quel riscatto (per id). Se non c'è più, il registro resta lo stesso. */
  function undoRedeem(stats, entryId) {
    const spent = spentOf(stats);
    if (!spent.some(entry => entry.id === entryId)) return stats;
    return { ...stats, spent: spent.filter(entry => entry.id !== entryId) };
  }

  /**
   * Il premio che un completamento ha appena reso riscattabile (il saldo è passato da `before` ad `after`): il più caro tra
   * quelli che prima non bastavano e adesso sì, cioè il traguardo più grande appena raggiunto. null se nessuno.
   */
  function newlyReady(rewards, before, after) {
    const ready = rewards.filter(reward => reward.cost > before && reward.cost <= after);
    return ready.length ? ready.reduce((best, reward) => (reward.cost > best.cost ? reward : best)) : null;
  }

  /* ---------- Premi: aggiungere, modificare, eliminare ---------- */

  /**
   * Controlla i dati del foglio del premio. Restituisce { value, errors }: `value` è normalizzato ({ title, emoji, cost }),
   * `errors` ha un messaggio per ogni campo sbagliato. Un'emoji fuori dall'elenco diventa 🎁.
   */
  function validateInput(input) {
    const errors = {};
    const title = cleanTitle(input.title);
    if (!title) errors.title = 'Dai un nome al premio.';
    else if (title.length > REWARDS.titleMax) errors.title = 'Al massimo ' + REWARDS.titleMax + ' caratteri.';

    const rawCost = String(input.cost == null ? '' : input.cost).trim();
    const cost = rawCost === '' ? NaN : Math.round(Number(rawCost));
    if (!isCost(cost)) {
      errors.cost = 'Indica un prezzo tra ' + utils.formatNumber(REWARDS.costMin) + ' e ' +
        utils.formatNumber(REWARDS.costMax) + ' punti.';
    }
    return { value: { title, emoji: emojiOf(input.emoji) || DEFAULT_EMOJI, cost }, errors };
  }

  /** true se c'è ancora posto per un premio (al massimo 30). */
  function canAdd(rewards) {
    return rewards.length < REWARDS.max;
  }

  /** Aggiunge un premio da dati già controllati con validateInput(): { rewards, reward }; con 30 premi reward è null. */
  function addReward(rewards, value, now) {
    if (!canAdd(rewards)) return { rewards, reward: null };
    const reward = { id: utils.uid(), title: value.title, emoji: value.emoji, cost: value.cost, createdAt: now };
    return { rewards: rewards.concat(reward), reward };
  }

  const EDITABLE_FIELDS = ['title', 'emoji', 'cost'];

  /**
   * Modifica nome, emoji e prezzo di un premio, con dati già controllati. I riscatti di prima restano come sono stati fatti
   * (con il loro nome e il loro prezzo). Restituisce { rewards, previous, changed }, come Aura.tasks.updateTask.
   */
  function updateReward(rewards, id, value) {
    const index = rewards.findIndex(reward => reward.id === id);
    if (index === -1) return { rewards, previous: null, changed: false };
    const previous = rewards[index];
    const next = { ...previous, title: value.title, emoji: value.emoji, cost: value.cost };
    if (EDITABLE_FIELDS.every(field => next[field] === previous[field])) return { rewards, previous, changed: false };
    return { rewards: rewards.map((reward, i) => (i === index ? next : reward)), previous, changed: true };
  }

  /**
   * Elimina un premio: { rewards, removed, index }, per poterlo rimettere con restoreReward(). I suoi riscatti restano nel
   * registro, con il nome.
   */
  function removeReward(rewards, id) {
    const index = rewards.findIndex(reward => reward.id === id);
    if (index === -1) return { rewards, removed: null, index: -1 };
    return { rewards: rewards.filter((_, i) => i !== index), removed: rewards[index], index };
  }

  /** «Annulla» dopo l'eliminazione: il premio torna dov'era (o in fondo). Se c'è già, o non c'è più posto, niente. */
  function restoreReward(rewards, reward, index) {
    if (rewards.some(item => item.id === reward.id) || !canAdd(rewards)) return rewards;
    const next = rewards.slice();
    next.splice(Math.min(Math.max(index, 0), next.length), 0, reward);
    return next;
  }

  /* ---------- Per la pagina ---------- */

  /**
   * Le righe della card «I tuoi premi», dal prezzo più basso (il più vicino) al più alto; a parità, dal più vecchio.
   * Ogni riga: { reward, ready, missing, progress, count, status }. `progress` va da 0 a 1 (la barra).
   */
  function rows(state) {
    const available = balance(state.stats);
    return state.rewards
      .slice()
      .sort((a, b) => a.cost - b.cost || a.createdAt - b.createdAt)
      .map(reward => {
        const ready = available >= reward.cost;
        const missing = Math.max(0, reward.cost - available);
        const count = redeemedCount(state.stats, reward.id);
        const progress = Math.min(1, available / reward.cost);
        return { reward, ready, missing, progress, count, status: statusText(ready, missing, reward.cost, count) };
      });
  }

  /** «Pronto · 400 punti · preso 2 volte» oppure «Ancora 240 · 800 punti». */
  function statusText(ready, missing, cost, count) {
    const head = ready ? 'Pronto · ' + pointsLabel(cost) : 'Ancora ' + utils.formatNumber(missing) + ' · ' + pointsLabel(cost);
    return count ? head + ' · preso ' + timesLabel(count) : head;
  }

  /** L'avviso dopo un riscatto: «Te lo sei meritato: Pizza del venerdì · −400 punti». */
  function redeemText(entry) {
    return 'Te lo sei meritato: ' + entry.title + ' · ' + MINUS + pointsLabel(entry.cost);
  }

  /**
   * Lo storico dei riscatti, dal più recente: { id, emoji, title, when, cost }. L'emoji è quella del premio, se c'è ancora
   * (🎁 per un premio eliminato, che resta con il suo nome); `when` è il giorno («Oggi», «Ieri», «ven 13 nov»).
   */
  function history(state, today) {
    const emojiById = new Map(state.rewards.map(reward => [reward.id, reward.emoji]));
    return spentOf(state.stats)
      .slice()
      .sort((a, b) => b.at - a.at)
      .map(entry => ({
        id: entry.id,
        emoji: emojiById.get(entry.rewardId) || DEFAULT_EMOJI,
        title: entry.title,
        when: utils.formatDateLabel(utils.todayISO(entry.at), today),
        cost: MINUS + utils.formatNumber(entry.cost)
      }));
  }

  /**
   * Sotto il prezzo, nel foglio: quanti punti si sono guadagnati negli ultimi 7 giorni (oggi compreso), per scegliere un
   * prezzo raggiungibile. Senza punti in quei giorni, quanto vale un'attività tipica.
   */
  function priceHint(stats, today) {
    let points = 0;
    for (let i = 0; i < 7; i++) {
      const entry = stats.days[utils.addDays(today, -i)];
      if (entry) points += entry.points;
    }
    if (points > 0) return 'Negli ultimi 7 giorni hai guadagnato ' + pointsLabel(points) + '.';
    const typical = P.pointsFor({ duration: 30, energy: 'medium' });
    return 'Per darti un\'idea: un\'attività di 30 minuti con energia media vale ' + pointsLabel(typical) + '.';
  }

  /** Toccando «Riscatta» quando il saldo non basta: «Ancora 240 punti per Serata al cinema». */
  function missingText(reward, available) {
    return 'Ancora ' + pointsLabel(Math.max(0, reward.cost - available)) + ' per ' + reward.title;
  }

  /** Nell'avviso di un completamento che rende riscattabile un premio: «🍕 Ora puoi riscattare: Pizza del venerdì». */
  function readyText(reward) {
    return reward.emoji + ' Ora puoi riscattare: ' + reward.title;
  }

  /** Nel foglio di un premio già preso: «Preso 2 volte: i riscatti fatti restano come sono». */
  function takenNote(count) {
    return 'Preso ' + timesLabel(count) + ': i riscatti fatti restano come sono';
  }

  Aura.rewards = {
    REWARDS,
    emojiOf,
    guessEmoji,
    sanitizeReward,
    sanitizeRewards,
    sanitizeSpent,
    spentPoints,
    shopPoints,
    balance,
    redeemedCount,
    redeem,
    undoRedeem,
    newlyReady,
    validateInput,
    canAdd,
    addReward,
    updateReward,
    removeReward,
    restoreReward,
    rows,
    statusText,
    redeemText,
    history,
    priceHint,
    missingText,
    readyText,
    takenNote
  };
})(window.Aura = window.Aura || {});
