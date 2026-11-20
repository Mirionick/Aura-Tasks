/*
 * Aura Tasks — «Negozio» (P-004, passo 4.1; vedi docs/punti-e-serie.md, «Negozio»).
 * Solo funzioni pure: gli oggetti in vendita, gli acquisti nel registro (stats.shop), quello che è in uso (state.look),
 * «Ripara la serie», la pulizia dei dati letti e le frasi. Si paga con il saldo da spendere, lo stesso dei premi
 * (Aura.rewards.balance): spendere non toglie niente a stats.totalPoints, quindi il livello e il riquadro Punti non
 * scendono mai. Niente DOM, niente localStorage: l'interfaccia sta in js/ui-shop.js.
 */
(function (Aura) {
  'use strict';

  const { utils, points: P, rewards: RW } = Aura;

  /**
   * Il catalogo e le regole, in un posto solo:
   * - repair: «Ripara la serie», con il prezzo e il limite: al massimo `limit` giorni riparati negli ultimi `period`
   *   giorni, oggi compreso. Si ripara un giorno mancato di ieri o dell'altro ieri (vedi repairOffer);
   * - looks: i colori dell'aurora e le forme dei coriandoli. Il primo di ogni gruppo è quello di partenza, gratis; gli
   *   altri si comprano una volta e poi si usano quando si vuole. L'id di un oggetto è `gruppo:valore`;
   * - packs: i pacchetti di punti, che si vedono ma non si comprano ancora: arriveranno con la versione per gli altri.
   */
  const SHOP = {
    costMax: 100000,
    repair: { id: 'repair', name: 'Ripara la serie', cost: 150, limit: 2, period: 30 },
    looks: {
      aurora: [
        { value: 'aurora', name: 'Aurora', cost: 0 },
        { value: 'sunset', name: 'Tramonto', cost: 400 },
        { value: 'forest', name: 'Foresta', cost: 400 },
        { value: 'ocean', name: 'Oceano', cost: 400 },
        { value: 'night', name: 'Notte polare', cost: 400 }
      ],
      confetti: [
        { value: 'classic', name: 'Classici', cost: 0 },
        { value: 'stars', name: 'Stelline', cost: 250 },
        { value: 'hearts', name: 'Cuori', cost: 250 },
        { value: 'leaves', name: 'Foglie', cost: 250 },
        { value: 'snow', name: 'Fiocchi di neve', cost: 250 }
      ]
    },
    packs: [500, 2000, 5000]
  };
  const GROUPS = ['aurora', 'confetti'];
  const MINUS = '−'; // il segno meno tipografico, come nell'avviso «−400 punti»
  // Come è scritto l'id di un oggetto ('repair', 'aurora:sunset'…), anche di uno che il catalogo non conosce ancora.
  const ITEM_PATTERN = /^[a-z0-9-]+(:[a-z0-9-]+)?$/;
  const ITEM_MAX = 40;

  // Gli oggetti che si comprano (tutti tranne quelli di partenza), con il loro id.
  const LOOK_ITEMS = GROUPS.flatMap(group => SHOP.looks[group].slice(1).map(look => ({ ...look, id: group + ':' + look.value, group })));
  const ITEM_IDS = new Set([SHOP.repair.id].concat(LOOK_ITEMS.map(item => item.id)));

  const pointsLabel = count => (count === 1 ? '1 punto' : utils.formatNumber(count) + ' punti');
  const daysLabel = count => (count === 1 ? '1 giorno' : count + ' giorni');
  const shopOf = stats => (stats && Array.isArray(stats.shop) ? stats.shop : []);
  const hasDone = (days, day) => Boolean(days[day] && days[day].done > 0);

  /** Il valore di partenza di un gruppo («aurora», «classic»). */
  const firstOf = group => SHOP.looks[group][0].value;

  /** Quello che è in uso all'inizio: i valori di partenza; `at` = 0, mai cambiato. */
  function defaultLook() {
    return { aurora: firstOf('aurora'), confetti: firstOf('confetti'), at: 0 };
  }

  /** Un oggetto del catalogo per id ('repair', 'aurora:sunset'…): { id, group, value, name, cost }, oppure null. */
  function itemOf(id) {
    if (id === SHOP.repair.id) return { id, group: 'repair', value: null, name: SHOP.repair.name, cost: SHOP.repair.cost };
    return LOOK_ITEMS.find(item => item.id === id) || null;
  }

  /** Gli id dei colori e delle forme comprati. */
  function ownedIds(shop) {
    return new Set(shop.filter(entry => entry && entry.item !== SHOP.repair.id).map(entry => entry.item));
  }

  /** true se `value` del gruppo si può usare: è quello di partenza oppure è stato comprato. */
  function isOwned(stats, group, value) {
    return value === firstOf(group) || ownedIds(shopOf(stats)).has(group + ':' + value);
  }

  /* ---------- Pulizia dei dati letti ---------- */

  const isItemId = value => typeof value === 'string' && value.length <= ITEM_MAX && ITEM_PATTERN.test(value);

  /**
   * Gli acquisti del registro (stats.shop), ripuliti: resta un acquisto con un `item` scritto bene (vedi ITEM_PATTERN), un
   * costo intero tra 1 e 100.000, un istante valido e, per «Ripara la serie», un giorno valido (`day`). Un id ripetuto è
   * lo stesso acquisto: resta il primo; senza id ne riceve uno. Un colore o una forma comprati due volte, o un giorno
   * riparato due volte, contano una volta sola: resta il primo. Un `item` che il catalogo non conosce (comprato con una
   * versione di Aura più nuova) resta: conta nel saldo, così i suoi punti non tornano indietro, ma non si usa. La pulizia
   * guarda il formato, non le regole del momento dell'acquisto. I campi sconosciuti vengono conservati. Non un elenco → [].
   */
  function sanitizeShop(raw) {
    if (!Array.isArray(raw)) return [];
    const ids = new Set();
    const keys = new Set();
    const shop = [];
    raw.forEach(entry => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !isItemId(entry.item)) return;
      if (!Number.isInteger(entry.cost) || entry.cost < 1 || entry.cost > SHOP.costMax) return;
      if (!Number.isFinite(entry.at) || entry.at <= 0) return;
      const isRepair = entry.item === SHOP.repair.id;
      if (isRepair && !utils.isISODate(entry.day)) return;
      const id = typeof entry.id === 'string' && entry.id ? entry.id : utils.uid();
      // Gli oggetti sconosciuti si distinguono solo per id: potrebbero essere cose che si comprano più volte.
      const key = isRepair ? 'repair:' + entry.day : ITEM_IDS.has(entry.item) ? entry.item : null;
      if (ids.has(id) || (key && keys.has(key))) return;
      ids.add(id);
      if (key) keys.add(key);
      shop.push({ ...entry, id });
    });
    return shop;
  }

  /**
   * Quello che è in uso (state.look), ripulito con gli acquisti già ripuliti (`shop`): per ogni gruppo un valore comprato,
   * altrimenti quello di partenza; `at` è quando è cambiato l'ultima volta (0 = mai). I campi sconosciuti vengono
   * conservati.
   */
  function sanitizeLook(raw, shop) {
    const base = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const owned = ownedIds(Array.isArray(shop) ? shop : []);
    const look = { ...base };
    GROUPS.forEach(group => {
      const value = base[group];
      look[group] = typeof value === 'string' && owned.has(group + ':' + value) ? value : firstOf(group);
    });
    look.at = Number.isFinite(base.at) && base.at >= 0 ? base.at : 0;
    return look;
  }

  /* ---------- Comprare e usare ---------- */

  /**
   * Compra un colore o una forma: aggiunge al registro { id, item, cost, at }. Restituisce { stats, entry }, oppure null se
   * l'oggetto non è in vendita, è già tuo o il saldo non basta. `now` è l'istante (ms).
   */
  function buy(stats, itemId, now) {
    const item = LOOK_ITEMS.find(entry => entry.id === itemId);
    if (!item || ownedIds(shopOf(stats)).has(itemId) || RW.balance(stats) < item.cost) return null;
    const entry = { id: utils.uid(), item: item.id, cost: item.cost, at: now };
    return { stats: { ...stats, shop: shopOf(stats).concat(entry) }, entry };
  }

  /**
   * Usa un colore o una forma tuoi (o quelli di partenza): il `look` nuovo, con `at` = `now`; lo stesso `look` se è già in
   * uso; null se non è tuo o non esiste.
   */
  function use(look, stats, group, value, now) {
    if (!GROUPS.includes(group) || !SHOP.looks[group].some(item => item.value === value) || !isOwned(stats, group, value)) return null;
    if (look[group] === value) return look;
    return { ...look, [group]: value, at: now };
  }

  /**
   * «Annulla» dopo un acquisto o una riparazione: toglie quell'acquisto (per id) e ricalcola il record della serie, che
   * conta i giorni riparati. I traguardi già festeggiati restano, come quando si annulla un completamento. Se l'acquisto
   * non c'è più, il registro resta lo stesso.
   */
  function undo(stats, entryId) {
    const shop = shopOf(stats);
    if (!shop.some(entry => entry.id === entryId)) return stats;
    const next = { ...stats, shop: shop.filter(entry => entry.id !== entryId) };
    return { ...next, bestStreak: P.longestStreak(next.days, P.repairedDays(next)) };
  }

  /* ---------- Ripara la serie ---------- */

  /** Quanti giorni sono stati riparati negli ultimi 30 giorni, oggi compreso. */
  function repairsUsed(stats, today) {
    const from = utils.addDays(today, -(SHOP.repair.period - 1));
    return Array.from(P.repairedDays(stats)).filter(day => day >= from && day <= today).length;
  }

  /**
   * Il giorno che si può riparare oggi, oppure null. Il giorno mancato D (senza completamenti e non riparato) è ieri o
   * l'altro ieri; il giorno prima di D ha almeno un completamento (c'era una serie da salvare); se D è l'altro ieri, anche
   * ieri ne ha almeno uno (mai due giorni mancati, o riparati, di fila); negli ultimi 30 giorni, oggi compreso, ci sono
   * meno di 2 giorni riparati. Restituisce { day, lost, streak }: `lost` è la serie che si era fermata (fino al giorno
   * prima di D), `streak` quella che si avrà dopo la riparazione.
   */
  function repairOffer(stats, today) {
    const { days } = stats;
    const repaired = P.repairedDays(stats);
    const missed = day => !hasDone(days, day) && !repaired.has(day);
    const yesterday = utils.addDays(today, -1);
    const before = utils.addDays(today, -2);
    let day = null;
    if (missed(yesterday) && hasDone(days, before)) day = yesterday;
    else if (hasDone(days, yesterday) && missed(before) && hasDone(days, utils.addDays(before, -1))) day = before;
    if (!day || repairsUsed(stats, today) >= SHOP.repair.limit) return null;
    const lost = P.currentStreak(days, utils.addDays(day, -1), repaired);
    const streak = P.currentStreak(days, today, new Set(repaired).add(day));
    return { day, lost, streak };
  }

  /**
   * Ripara la serie, oggi `today`: aggiunge al registro { id, item: 'repair', cost, at, day } e aggiorna record e
   * traguardi (un traguardo raggiunto con la riparazione si festeggia). Restituisce { stats, entry, streak, reached }, oppure
   * null se oggi non c'è niente da riparare o il saldo non basta.
   */
  function repair(stats, today, now) {
    const offer = repairOffer(stats, today);
    if (!offer || RW.balance(stats) < SHOP.repair.cost) return null;
    const entry = { id: utils.uid(), item: SHOP.repair.id, cost: SHOP.repair.cost, at: now, day: offer.day };
    const shop = shopOf(stats).concat(entry);
    const repaired = P.repairedDays({ shop });
    const streak = P.currentStreak(stats.days, today, repaired);
    const reached = P.POINTS.milestones.filter(m => streak >= m && !stats.milestones.includes(m));
    return {
      stats: { ...stats, shop, bestStreak: P.longestStreak(stats.days, repaired), milestones: stats.milestones.concat(reached) },
      entry,
      streak,
      reached
    };
  }

  /* ---------- Per la pagina ---------- */

  /**
   * Gli oggetti del foglio del negozio, per gruppo: { aurora: [...], confetti: [...] }. Ognuno è { id, group, value, name,
   * cost, owned, inUse, ready, missing }: `ready` vuol dire che si può comprare (non è tuo e il saldo basta), `missing` i
   * punti che mancano (0 se è tuo).
   */
  function catalog(state) {
    const available = RW.balance(state.stats);
    const owned = ownedIds(shopOf(state.stats));
    const look = state.look || defaultLook();
    const groups = {};
    GROUPS.forEach(group => {
      groups[group] = SHOP.looks[group].map((item, index) => {
        const id = group + ':' + item.value;
        const mine = index === 0 || owned.has(id);
        return {
          id,
          group,
          value: item.value,
          name: item.name,
          cost: item.cost,
          owned: mine,
          inUse: look[group] === item.value,
          ready: !mine && available >= item.cost,
          missing: mine ? 0 : Math.max(0, item.cost - available)
        };
      });
    });
    return groups;
  }

  /** L'avviso dopo un acquisto: «Comprato: Tramonto · −400 punti». */
  function boughtText(entry) {
    const item = itemOf(entry.item);
    return 'Comprato: ' + (item ? item.name : 'oggetto') + ' · ' + MINUS + pointsLabel(entry.cost);
  }

  /**
   * L'avviso dopo una riparazione: «🔥 Serie riparata: 13 giorni di fila · −150 punti»; se fa raggiungere un traguardo,
   * «🎉 Serie riparata: 7 giorni di fila, nuovo traguardo · −150 punti».
   */
  function repairedText(result) {
    const milestone = Array.isArray(result.reached) && result.reached.length > 0;
    return (milestone ? '🎉' : '🔥') + ' Serie riparata: ' + daysLabel(result.streak) + ' di fila' +
      (milestone ? ', nuovo traguardo' : '') + ' · ' + MINUS + pointsLabel(result.entry.cost);
  }

  /** Toccando un oggetto che costa più del saldo: «Ancora 120 punti per Tramonto». */
  function missingText(name, cost, available) {
    return 'Ancora ' + pointsLabel(Math.max(0, cost - available)) + ' per ' + name;
  }

  /**
   * La riga di «Ripara la serie», in cima al negozio: { title, text }. Con una riparazione possibile, «Ieri è saltato un
   * giorno» e «Riparalo e la serie torna a 13 giorni di fila.»; altrimenti «Nessun giorno da riparare» e quando si usa,
   * oppure che il limite è raggiunto.
   */
  function repairText(stats, today) {
    const offer = repairOffer(stats, today);
    if (offer) {
      const when = offer.day === utils.addDays(today, -1) ? 'Ieri' : 'L\'altro ieri';
      return { title: when + ' è saltato un giorno', text: 'Riparalo e la serie torna a ' + daysLabel(offer.streak) + ' di fila.' };
    }
    const used = repairsUsed(stats, today);
    if (used >= SHOP.repair.limit) {
      return { title: 'Riparazioni finite, per ora', text: 'Negli ultimi ' + SHOP.repair.period + ' giorni ne hai già riparati ' + used + ', il massimo.' };
    }
    return { title: 'Nessun giorno da riparare', text: 'Se salti un giorno, hai due giorni per ripararlo e tenere la serie. Al massimo ' +
      SHOP.repair.limit + ' volte ogni ' + SHOP.repair.period + ' giorni.' };
  }

  /** Toccando un pacchetto di punti: non si vendono ancora. */
  const PACKS_TEXT = 'I pacchetti di punti arriveranno con la versione di Aura per gli altri.';

  Aura.shop = {
    SHOP,
    GROUPS,
    PACKS_TEXT,
    defaultLook,
    itemOf,
    isOwned,
    sanitizeShop,
    sanitizeLook,
    buy,
    use,
    undo,
    repairsUsed,
    repairOffer,
    repair,
    catalog,
    boughtText,
    repairedText,
    missingText,
    repairText
  };
})(window.Aura = window.Aura || {});
