/*
 * Test del negozio (js/shop.js; P-004, passo 4.1): saldo unico con i premi, acquisti e «Annulla», oggetti in uso,
 * «Ripara la serie» con tutte le sue condizioni, serie, record e traguardi con i giorni riparati, pulizia dei dati letti,
 * migrazione alla v6, esportazione e importazione con il backup.
 */
(function () {
  'use strict';

  const { test, assert, assertEqual } = window.AuraTest;
  const { utils, points: P, rewards: R, shop: SH, storage } = window.Aura;

  const NOW = new Date(2026, 10, 20, 10, 30).getTime(); // venerdì 20/11/2026 alle 10:30
  const TODAY = '2026-11-20';
  const day = offset => utils.addDays(TODAY, offset); // day(-1) = ieri
  const LOOK = { aurora: 'aurora', confetti: 'classic', at: 0 };

  /**
   * Registro con un completamento da 100 punti in ciascuno dei giorni `done` (offset da oggi: 0 = oggi), più `extra`
   * punti guadagnati, i riscatti dei premi `spent` e gli acquisti `shop`.
   */
  function statsWith({ done = [], extra = 0, spent = [], shop = [] } = {}) {
    const days = {};
    done.forEach(offset => { days[day(offset)] = { done: 1, points: 100 }; });
    return { ...P.emptyStats(), totalPoints: done.length * 100 + extra, days, spent, shop };
  }

  function bought(item, overrides) {
    return { id: 'k-' + item, item, cost: SH.itemOf(item).cost, at: NOW - 3600e3, ...overrides };
  }

  function repaired(offset, overrides) {
    return { id: 'r' + offset, item: 'repair', cost: 150, at: NOW - 3600e3, day: day(offset), ...overrides };
  }

  /* ---------- Catalogo ---------- */

  test('SHOP: i prezzi e le regole di P-004 v2, in un posto solo', () => {
    const { SHOP } = SH;
    assertEqual([SHOP.repair.cost, SHOP.repair.limit, SHOP.repair.period], [150, 2, 30], 'Ripara la serie');
    assertEqual(SHOP.looks.aurora.map(item => [item.value, item.cost]),
      [['aurora', 0], ['sunset', 400], ['forest', 400], ['ocean', 400], ['night', 400]], 'colori dell\'aurora');
    assertEqual(SHOP.looks.confetti.map(item => [item.value, item.cost]),
      [['classic', 0], ['stars', 250], ['hearts', 250], ['leaves', 250], ['snow', 250]], 'coriandoli');
    assertEqual(SHOP.packs, [500, 2000, 5000], 'pacchetti di punti, solo da vedere');
    assertEqual(SH.defaultLook(), LOOK);
    assertEqual(SH.itemOf('aurora:sunset'), { value: 'sunset', name: 'Tramonto', cost: 400, id: 'aurora:sunset', group: 'aurora' });
    assertEqual([SH.itemOf('repair').cost, SH.itemOf('aurora:aurora'), SH.itemOf('boh')], [150, null, null], 'quelli di partenza non si vendono');
  });

  /* ---------- Saldo unico con i premi ---------- */

  test('balance: punti guadagnati meno premi riscattati meno acquisti del negozio, mai sotto zero', () => {
    const spent = [{ id: 's', rewardId: 'p', title: 'Pizza', cost: 300, at: NOW }];
    const stats = statsWith({ done: [0], extra: 900, spent, shop: [bought('aurora:sunset')] });
    assertEqual([stats.totalPoints, R.spentPoints(stats), R.shopPoints(stats), R.balance(stats)], [1000, 300, 400, 300]);
    assertEqual(R.balance({ ...stats, shop: [bought('aurora:sunset'), bought('aurora:night')] }), 0, 'più spesi che guadagnati');
    assertEqual(R.shopPoints(P.emptyStats()), 0);
  });

  test('balance: annullare un completamento toglie i suoi punti anche dal saldo del negozio', () => {
    const task = { id: 't', title: 'Corsa', duration: 30, energy: 'medium', date: null, time: null, done: false, createdAt: 1, completedAt: null, pointsAwarded: null };
    const state = { tasks: [task], stats: statsWith({ extra: 400, shop: [bought('confetti:stars')] }) };
    const done = P.setDone(state, 't', true, NOW);
    assertEqual(R.balance(done.stats), 174, '400 + 24 − 250');
    const undone = P.setDone({ tasks: done.tasks, stats: done.stats }, 't', false, NOW);
    assertEqual([R.balance(undone.stats), undone.stats.shop], [150, state.stats.shop], 'l\'acquisto resta');
  });

  /* ---------- Comprare, usare, annullare ---------- */

  test('buy: aggiunge l\'acquisto al registro e non tocca i punti guadagnati (né il livello)', () => {
    const stats = statsWith({ done: [0], extra: 400 });
    const result = SH.buy(stats, 'aurora:sunset', NOW);
    const { entry } = result;
    assert(typeof entry.id === 'string' && entry.id.length > 0, 'id stabile dell\'acquisto');
    assertEqual([entry.item, entry.cost, entry.at, 'day' in entry], ['aurora:sunset', 400, NOW, false]);
    assertEqual(result.stats.shop, [entry]);
    assertEqual([result.stats.totalPoints, result.stats.days, R.balance(result.stats)], [500, stats.days, 100]);
    assertEqual(stats.shop, [], 'il registro ricevuto non cambia');
    assertEqual(SH.buy(result.stats, 'aurora:sunset', NOW), null, 'già tuo');
    assertEqual(SH.buy(result.stats, 'aurora:night', NOW), null, 'il saldo (100) non basta');
    assertEqual(SH.buy(result.stats, 'confetti:stars', NOW), null, 'nemmeno per 250');
    assertEqual([SH.buy(stats, 'aurora:aurora', NOW), SH.buy(stats, 'repair', NOW), SH.buy(stats, 'boh', NOW)], [null, null, null],
      'quelli di partenza, la riparazione e gli oggetti che non ci sono non si comprano così');
  });

  test('buy: con il saldo giusto giusto si compra, e il saldo va a zero', () => {
    const result = SH.buy(statsWith({ extra: 250 }), 'confetti:hearts', NOW);
    assertEqual([result.entry.cost, R.balance(result.stats)], [250, 0]);
  });

  test('use: si usano gli oggetti comprati e quelli di partenza, gratis', () => {
    const stats = statsWith({ shop: [bought('aurora:ocean')] });
    const look = SH.use(LOOK, stats, 'aurora', 'ocean', NOW);
    assertEqual(look, { aurora: 'ocean', confetti: 'classic', at: NOW });
    assertEqual(SH.use(look, stats, 'aurora', 'aurora', NOW + 1), { aurora: 'aurora', confetti: 'classic', at: NOW + 1 }, 'si torna all\'aurora di partenza');
    assert(SH.use(look, stats, 'aurora', 'ocean', NOW + 1) === look, 'già in uso: lo stesso oggetto');
    assertEqual([SH.use(LOOK, stats, 'aurora', 'night', NOW), SH.use(LOOK, stats, 'confetti', 'stars', NOW)], [null, null], 'non comprati');
    assertEqual([SH.use(LOOK, stats, 'sound', 'rain', NOW), SH.use(LOOK, stats, 'aurora', 'boh', NOW)], [null, null], 'gruppi o valori che non ci sono');
    assertEqual([SH.isOwned(stats, 'aurora', 'ocean'), SH.isOwned(stats, 'aurora', 'aurora'), SH.isOwned(stats, 'aurora', 'night')], [true, true, false]);
  });

  test('undo: «Annulla» toglie solo quell\'acquisto e il saldo torna com\'era', () => {
    const first = SH.buy(statsWith({ extra: 1000 }), 'aurora:forest', NOW);
    const second = SH.buy(first.stats, 'confetti:leaves', NOW + 1);
    const back = SH.undo(second.stats, second.entry.id);
    assertEqual([back.shop, R.balance(back)], [[first.entry], 600]);
    assert(SH.undo(back, 'non-esiste') === back, 'acquisto che non c\'è più: lo stesso registro');
  });

  /* ---------- Serie con i giorni riparati ---------- */

  test('repairedDays, currentStreak e longestStreak: un giorno riparato conta come un giorno con un completamento', () => {
    const stats = statsWith({ done: [-5, -4, -3, -1, 0], shop: [repaired(-2), bought('aurora:sunset')] });
    assertEqual(Array.from(P.repairedDays(stats)), [day(-2)]);
    assertEqual([P.currentStreak(stats.days, TODAY), P.currentStreak(stats.days, TODAY, P.repairedDays(stats))], [2, 6]);
    assertEqual([P.longestStreak(stats.days), P.longestStreak(stats.days, P.repairedDays(stats))], [3, 6]);
    assertEqual(P.repairedDays({ shop: [repaired(-2, { day: 'ieri' }), null, 'rotto'] }).size, 0, 'giorni non validi ignorati');
    assertEqual(P.repairedDays({}).size, 0, 'registro senza acquisti');
  });

  test('setDone: completando dopo una riparazione la serie conta il giorno riparato, anche per i traguardi', () => {
    const task = { id: 't', title: 'Corsa', duration: 30, energy: 'medium', date: null, time: null, done: false, createdAt: 1, completedAt: null, pointsAwarded: null };
    const stats = { ...statsWith({ done: [-6, -5, -4, -3, -2], shop: [repaired(-1)] }), milestones: [3] };
    const result = P.setDone({ tasks: [task], stats }, 't', true, NOW);
    assertEqual([result.streak, result.reached, result.stats.bestStreak, result.stats.milestones], [7, [7], 7, [3, 7]]);
    const undone = P.setDone({ tasks: result.tasks, stats: result.stats }, 't', false, NOW);
    assertEqual([undone.streak, undone.stats.bestStreak, undone.stats.milestones], [6, 6, [3, 7]], 'il traguardo festeggiato resta');
  });

  test('rebuildStats: il registro ricostruito conserva gli acquisti e conta i giorni riparati nel record', () => {
    const at = offset => new Date(2026, 10, 20 + offset, 18).getTime();
    const done = offset => ({ id: 'd' + offset, title: 'Fatta', duration: 30, energy: 'medium', date: null, done: true, createdAt: 1, completedAt: at(offset), pointsAwarded: 24 });
    const shop = [repaired(-2)];
    const rebuilt = P.rebuildStats([done(-4), done(-3), done(-1)], { spent: [], shop });
    assertEqual([rebuilt.shop, rebuilt.bestStreak, rebuilt.milestones], [shop, 4, [3]]);
    assertEqual(P.rebuildStats([done(-1)]).shop, [], 'senza registro di prima, nessun acquisto');
  });

  /* ---------- Ripara la serie ---------- */

  test('repairOffer: ieri saltato, l\'altro ieri attivo → si ripara ieri', () => {
    const stats = statsWith({ done: [-7, -6, -5, -4, -3, -2] });
    assertEqual(SH.repairOffer(stats, TODAY), { day: day(-1), lost: 6, streak: 7 }, 'oggi ancora vuoto');
    const today = statsWith({ done: [-7, -6, -5, -4, -3, -2, 0] });
    assertEqual(SH.repairOffer(today, TODAY), { day: day(-1), lost: 6, streak: 8 }, 'con oggi già attivo');
  });

  test('repairOffer: l\'altro ieri saltato, ieri attivo e il giorno prima attivo → si ripara l\'altro ieri', () => {
    assertEqual(SH.repairOffer(statsWith({ done: [-5, -4, -3, -1] }), TODAY), { day: day(-2), lost: 3, streak: 5 });
    assertEqual(SH.repairOffer(statsWith({ done: [-5, -4, -3, -1, 0] }), TODAY), { day: day(-2), lost: 3, streak: 6 });
  });

  test('repairOffer: niente da riparare', () => {
    const none = done => SH.repairOffer(statsWith({ done }), TODAY);
    assertEqual(none([-3, -2, -1]), null, 'nessun giorno saltato');
    assertEqual(none([-5, -4, -3]), null, 'ieri e l\'altro ieri saltati: due giorni di fila');
    assertEqual(none([-4, -1]), null, 'l\'altro ieri saltato e anche il giorno prima');
    assertEqual(none([-1]), null, 'l\'altro ieri saltato, ma prima non c\'era una serie');
    assertEqual(none([0]), null, 'ieri saltato, ma l\'altro ieri vuoto');
    assertEqual(none([-10, -9, -8]), null, 'serie finita da giorni');
    assertEqual(none([]), null, 'registro vuoto');
  });

  test('repairOffer: mai due giorni riparati di fila, e un giorno riparato non si ripara di nuovo', () => {
    // L'altro ieri riparato e ieri saltato: il giorno prima di ieri non ha completamenti veri.
    assertEqual(SH.repairOffer(statsWith({ done: [-5, -4, -3], shop: [repaired(-2)] }), TODAY), null);
    // Ieri già riparato: niente da fare.
    assertEqual(SH.repairOffer(statsWith({ done: [-4, -3, -2], shop: [repaired(-1)] }), TODAY), null);
  });

  test('repairOffer: al massimo 2 giorni riparati negli ultimi 30, oggi compreso', () => {
    const done = [-7, -6, -5, -4, -3, -2];
    const two = [repaired(-12), repaired(-25)];
    assertEqual(SH.repairsUsed(statsWith({ done, shop: two }), TODAY), 2);
    assertEqual(SH.repairOffer(statsWith({ done, shop: two }), TODAY), null, 'limite raggiunto');
    const old = [repaired(-12), repaired(-30)];
    assertEqual(SH.repairsUsed(statsWith({ done, shop: old }), TODAY), 1, 'trenta giorni fa è fuori');
    assertEqual(SH.repairOffer(statsWith({ done, shop: old }), TODAY).day, day(-1));
  });

  test('repair: aggiunge la riparazione, aggiorna serie, record e traguardi; i punti guadagnati non cambiano', () => {
    const stats = { ...statsWith({ done: [-7, -6, -5, -4, -3, -2, 0], extra: 50 }), milestones: [3] };
    const result = SH.repair(stats, TODAY, NOW);
    const { entry } = result;
    assertEqual([entry.item, entry.cost, entry.at, entry.day], ['repair', 150, NOW, day(-1)]);
    assertEqual([result.streak, result.reached, result.stats.bestStreak, result.stats.milestones], [8, [7], 8, [3, 7]]);
    assertEqual([result.stats.totalPoints, result.stats.days, R.balance(result.stats)], [750, stats.days, 600]);
    assertEqual(P.currentStreak(result.stats.days, TODAY, P.repairedDays(result.stats)), 8);
    assertEqual(SH.repair(result.stats, TODAY, NOW), null, 'già riparato');
    assertEqual(stats.shop, [], 'il registro ricevuto non cambia');
  });

  test('repair: senza saldo o senza niente da riparare → null', () => {
    const poor = statsWith({ done: [-3, -2] });
    poor.totalPoints = 0;
    poor.days = { [day(-3)]: { done: 1, points: 0 }, [day(-2)]: { done: 1, points: 0 } };
    assertEqual([SH.repairOffer(poor, TODAY).day, SH.repair(poor, TODAY, NOW)], [day(-1), null], 'saldo a zero');
    assertEqual(SH.repair(statsWith({ done: [-2, -1] }), TODAY, NOW), null, 'nessun giorno saltato');
  });

  test('undo dopo una riparazione: la serie e il record tornano come prima, i traguardi festeggiati restano', () => {
    const stats = { ...statsWith({ done: [-7, -6, -5, -4, -3, -2, 0] }), milestones: [3] };
    const result = SH.repair(stats, TODAY, NOW);
    const back = SH.undo(result.stats, result.entry.id);
    assertEqual([back.shop, back.bestStreak, back.milestones], [[], 6, [3, 7]]);
    assertEqual(SH.repairOffer(back, TODAY).day, day(-1), 'si può riparare di nuovo');
  });

  /* ---------- Pulizia dei dati letti ---------- */

  test('sanitizeShop: restano solo gli acquisti scritti bene; i doppioni contano una volta', () => {
    const good = [bought('aurora:sunset'), repaired(-1), bought('confetti:snow', { note: 'campo sconosciuto' })];
    const dirty = [
      ...good,
      bought('aurora:sunset', { id: 'altro' }), // stesso colore comprato due volte
      repaired(-1, { id: 'r-altro' }), // stesso giorno riparato due volte
      { ...good[0] }, // stesso id
      bought('aurora:ocean', { cost: 0 }), bought('aurora:ocean', { cost: 12.5 }), bought('aurora:ocean', { cost: 100001 }),
      bought('aurora:ocean', { cost: '400' }), bought('aurora:ocean', { at: 0 }), bought('aurora:ocean', { at: 'ieri' }),
      repaired(-2, { day: undefined }), repaired(-2, { day: '2026-02-30' }),
      { item: 'Aurora:Sunset', cost: 400, at: NOW }, { item: 'a'.repeat(41), cost: 1, at: NOW }, { item: 'x::y', cost: 1, at: NOW },
      { item: 'aurora sunset', cost: 1, at: NOW }, { cost: 400, at: NOW }, null, 'rotto', [], 7
    ];
    assertEqual(SH.sanitizeShop(dirty), good);
    [undefined, null, {}, 'testo', 3].forEach(raw => assertEqual(SH.sanitizeShop(raw), [], JSON.stringify(raw)));
  });

  test('sanitizeShop: senza id ne riceve uno', () => {
    const [entry] = SH.sanitizeShop([{ item: 'confetti:stars', cost: 250, at: NOW }]);
    assert(typeof entry.id === 'string' && entry.id.length > 0);
    assertEqual([entry.item, entry.cost, entry.at], ['confetti:stars', 250, NOW]);
  });

  test('sanitizeShop: gli oggetti che il catalogo non conosce restano e contano nel saldo, ma non si usano', () => {
    // Per esempio i suoni del passo 4.4, letti da una copia di Aura ferma al passo 4.1 (revisione di Codex sulla P-004 v1).
    const rain = { id: 'u1', item: 'sound:rain', cost: 300, at: NOW };
    const twice = { id: 'u2', item: 'freeze', cost: 50, at: NOW };
    const shop = SH.sanitizeShop([rain, twice, { ...twice, id: 'u3' }, { ...rain }]);
    assertEqual(shop, [rain, twice, { ...twice, id: 'u3' }], 'si distinguono solo per id');
    const stats = statsWith({ extra: 1000, shop });
    assertEqual(R.balance(stats), 600, 'nessun rimborso');
    assertEqual([SH.use(LOOK, stats, 'sound', 'rain', NOW), SH.catalog({ stats, look: LOOK }).sound], [null, undefined]);
    assertEqual(SH.boughtText(rain), 'Comprato: oggetto · −300 punti');
  });

  test('sanitizeLook: in uso solo cose comprate, altrimenti i valori di partenza; i gruppi sconosciuti restano', () => {
    const shop = [bought('aurora:night')];
    assertEqual(SH.sanitizeLook({ aurora: 'night', confetti: 'hearts', at: NOW, sound: 'rain' }, shop),
      { aurora: 'night', confetti: 'classic', at: NOW, sound: 'rain' });
    assertEqual(SH.sanitizeLook({ aurora: 'boh', confetti: 7, at: -1 }, shop), LOOK);
    [undefined, null, [], 'testo'].forEach(raw => assertEqual(SH.sanitizeLook(raw, shop), LOOK, JSON.stringify(raw)));
    assertEqual(SH.sanitizeLook({ aurora: 'night' }, undefined), LOOK, 'senza acquisti');
  });

  /* ---------- Per la pagina ---------- */

  test('catalog: per ogni oggetto se è tuo, se è in uso, se si può comprare e quanto manca', () => {
    const stats = statsWith({ extra: 680, shop: [bought('aurora:sunset')] });
    const groups = SH.catalog({ stats, look: { ...LOOK, aurora: 'sunset' } });
    assertEqual(Object.keys(groups), ['aurora', 'confetti']);
    const row = item => [item.id, item.owned, item.inUse, item.ready, item.missing];
    assertEqual(groups.aurora.map(row), [
      ['aurora:aurora', true, false, false, 0],
      ['aurora:sunset', true, true, false, 0],
      ['aurora:forest', false, false, false, 120],
      ['aurora:ocean', false, false, false, 120],
      ['aurora:night', false, false, false, 120]
    ], 'saldo 280');
    assertEqual(groups.confetti.map(row).slice(0, 2), [['confetti:classic', true, true, false, 0], ['confetti:stars', false, false, true, 0]]);
    assertEqual(SH.catalog({ stats: P.emptyStats() }).aurora[0].inUse, true, 'senza look: i valori di partenza');
  });

  test('frasi: acquisto, riparazione, punti che mancano, riga di «Ripara la serie», pacchetti', () => {
    assertEqual(SH.boughtText(bought('aurora:sunset')), 'Comprato: Tramonto · −400 punti');
    assertEqual(SH.repairedText({ streak: 8, entry: repaired(-1) }), '🔥 Serie riparata: 8 giorni di fila · −150 punti');
    assertEqual(SH.repairedText({ streak: 1, entry: repaired(-1, { cost: 1 }), reached: [] }), '🔥 Serie riparata: 1 giorno di fila · −1 punto');
    assertEqual(SH.repairedText({ streak: 7, entry: repaired(-1), reached: [7] }), '🎉 Serie riparata: 7 giorni di fila, nuovo traguardo · −150 punti');
    assertEqual(SH.missingText('Tramonto', 400, 280), 'Ancora 120 punti per Tramonto');
    assertEqual(SH.missingText('Notte polare', 12400, 0), 'Ancora 12.400 punti per Notte polare');
    assertEqual(SH.repairText(statsWith({ done: [-3, -2] }), TODAY),
      { title: 'Ieri è saltato un giorno', text: 'Riparalo e la serie torna a 3 giorni di fila.' });
    assertEqual(SH.repairText(statsWith({ done: [-4, -3, -1] }), TODAY).title, 'L\'altro ieri è saltato un giorno');
    assertEqual(SH.repairText(statsWith({ done: [-1], shop: [repaired(-12), repaired(-25)] }), TODAY),
      { title: 'Riparazioni finite, per ora', text: 'Negli ultimi 30 giorni ne hai già riparati 2, il massimo.' });
    assertEqual(SH.repairText(statsWith({ done: [0] }), TODAY), { title: 'Nessun giorno da riparare',
      text: 'Se salti un giorno, hai due giorni per ripararlo e tenere la serie. Al massimo 2 volte ogni 30 giorni.' });
    assertEqual(SH.PACKS_TEXT, 'I pacchetti di punti arriveranno con la versione di Aura per gli altri.');
  });

  /* ---------- Dati: migrazione e backup ---------- */

  test('migrazione: i dati della v5 arrivano all\'ultima versione con il negozio vuoto e i colori di partenza; il resto è intatto', () => {
    const stats = { totalPoints: 24, bestStreak: 1, milestones: [], days: { '2026-11-19': { done: 1, points: 24 } }, focus: {}, spent: [], level: 2 };
    const tasks = [{ id: 'a', title: 'Fatta', duration: 30, energy: 'medium', date: '2026-11-19', time: null, done: true, createdAt: 1, completedAt: 5, pointsAwarded: 24 }];
    const rewards = [{ id: 'p', title: 'Pizza', emoji: '🍕', cost: 400, createdAt: 1 }];
    const state = storage.parse(JSON.stringify({ version: 5, future: 'ok', tasks, rewards, stats }));
    assertEqual(state.version, storage.SCHEMA_VERSION);
    assertEqual([state.tasks, state.rewards, state.future, state.look], [tasks.map(task => ({ ...task, repeat: null, seriesId: null })), rewards, 'ok', LOOK]);
    assertEqual(state.stats, { ...stats, shop: [] }, 'registro identico, più gli acquisti vuoti');
    assertEqual(storage.parse(JSON.stringify({ version: 1, tasks: [] })).look, LOOK, 'anche dalla v1');
  });

  test('storage: il record mancante si ricalcola contando i giorni riparati', () => {
    const raw = { ...statsWith({ done: [-4, -3, -1], shop: [repaired(-2)] }), bestStreak: 'rotto' };
    assertEqual(storage.sanitizeStats(raw).bestStreak, 4);
  });

  test('backup: esporta e importa acquisti e colori in uso, puliti come il resto', () => {
    const shop = [bought('aurora:ocean'), repaired(-1), bought('confetti:stars')];
    const state = {
      version: storage.SCHEMA_VERSION,
      tasks: [],
      rewards: [],
      stats: { ...statsWith({ done: [-3, -2, 0], extra: 900 }), bestStreak: 4, shop },
      look: { aurora: 'ocean', confetti: 'stars', at: NOW }
    };
    const file = storage.backupFile(state, NOW);
    assertEqual([JSON.parse(file.text).data.stats.shop, JSON.parse(file.text).data.look], [shop, state.look], 'nel file ci sono acquisti e colori');
    const back = storage.readBackup(file.text);
    assertEqual([back.error, back.state], [null, state], 'andata e ritorno identici');
    const dirty = {
      ...state,
      stats: { ...state.stats, shop: [...shop, bought('aurora:ocean', { id: 'doppio' }), { item: 'aurora:night', cost: -1, at: NOW }, 'rotto'] },
      look: { aurora: 'night', confetti: 'stars', at: NOW }
    };
    const cleaned = storage.readBackup(JSON.stringify({ format: storage.BACKUP_FORMAT, exportedAt: NOW, data: dirty })).state;
    assertEqual([cleaned.stats.shop, cleaned.look], [shop, { aurora: 'aurora', confetti: 'stars', at: NOW }], 'Notte polare non è stata comprata');
    assertEqual(R.balance(cleaned.stats), 400, '1.200 − 400 − 150 − 250');
  });

  test('readBackup: dati di una versione più nuova, con oggetti che il catalogo non conosce, si leggono senza perdere niente', () => {
    const rain = { id: 'u1', item: 'sound:rain', cost: 300, at: NOW };
    const data = {
      version: 8, tasks: [], rewards: [], stats: { ...P.emptyStats(), totalPoints: 500, shop: [repaired(-1), rain] },
      look: { aurora: 'aurora', confetti: 'classic', sound: 'rain', at: NOW }
    };
    const { state } = storage.readBackup(JSON.stringify({ format: storage.BACKUP_FORMAT, exportedAt: NOW, data }));
    assertEqual([state.version, state.stats.shop, state.look], [8, [repaired(-1), rain], data.look]);
    assertEqual(R.balance(state.stats), 50, '500 − 150 − 300: niente rimborsato');
  });
})();
