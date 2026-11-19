/*
 * Test di «I tuoi premi» (js/rewards.js; P-003, passo 3.4): saldo, riscatto e «Annulla», saldo a zero, premio eliminato,
 * limiti, pulizia dei dati letti, migrazione alla v5, esportazione e importazione con il backup.
 */
(function () {
  'use strict';

  const { test, assert, assertEqual } = window.AuraTest;
  const { points: P, rewards: R, storage } = window.Aura;

  const NOW = new Date(2026, 10, 19, 10, 30).getTime(); // giovedì 19/11/2026 alle 10:30
  const TODAY = '2026-11-19';

  function reward(overrides) {
    return { id: 'pizza', title: 'Pizza del venerdì', emoji: '🍕', cost: 400, createdAt: 1, ...overrides };
  }

  function spentEntry(overrides) {
    return { id: 's1', rewardId: 'pizza', title: 'Pizza del venerdì', cost: 400, at: NOW - 3600e3, ...overrides };
  }

  /** Stato con i premi e un registro con `total` punti guadagnati (in un giorno solo) e i riscatti `spent`. */
  function stateWith(rewards, total, spent) {
    const days = total ? { [TODAY]: { done: 1, points: total } } : {};
    return { rewards, stats: { ...P.emptyStats(), totalPoints: total, days, spent: spent || [] } };
  }

  /* ---------- Regole ---------- */

  test('REWARDS: 30 premi, nome fino a 60 caratteri, prezzo da 10 a 100.000, 15 emoji fisse', () => {
    assertEqual([R.REWARDS.max, R.REWARDS.titleMax, R.REWARDS.costMin, R.REWARDS.costMax], [30, 60, 10, 100000]);
    const chars = R.REWARDS.emoji.map(item => item.char);
    assertEqual([chars.length, new Set(chars).size, chars[0]], [15, 15, '🎁'], 'emoji diverse, la prima è quella di partenza');
    assert(R.REWARDS.emoji.every(item => item.name && item.words.length), 'ogni emoji ha un nome e delle parole');
  });

  /* ---------- Saldo e riscatti ---------- */

  test('balance: punti guadagnati meno punti spesi, mai sotto zero', () => {
    assertEqual(R.balance(stateWith([], 560, [spentEntry()]).stats), 160);
    assertEqual(R.balance(stateWith([], 560, [spentEntry(), spentEntry({ id: 's2' })]).stats), 0, 'più spesi che guadagnati');
    assertEqual(R.balance(stateWith([], 560).stats), 560);
    assertEqual(R.spentPoints(stateWith([], 0, [spentEntry(), spentEntry({ id: 's2', cost: 25 })]).stats), 425);
  });

  test('redeem: aggiunge il riscatto al registro e non tocca i punti guadagnati (né il livello)', () => {
    const state = stateWith([reward()], 560);
    const result = R.redeem(state, 'pizza', NOW);
    const { entry } = result;
    assert(typeof entry.id === 'string' && entry.id.length > 0, 'id stabile del riscatto');
    assertEqual([entry.rewardId, entry.title, entry.cost, entry.at], ['pizza', 'Pizza del venerdì', 400, NOW]);
    assertEqual(result.stats.spent, [entry]);
    assertEqual([result.stats.totalPoints, result.stats.days], [560, state.stats.days], 'punti e giorni intatti');
    assertEqual(R.balance(result.stats), 160);
    assertEqual(state.stats.spent, [], 'lo stato ricevuto non cambia');
    assertEqual(R.redeem({ ...state, stats: result.stats }, 'pizza', NOW), null, 'il saldo (160) non basta più');
    assertEqual(R.redeem(state, 'non-esiste', NOW), null, 'premio che non c\'è');
  });

  test('undoRedeem: «Annulla» toglie solo quel riscatto e il saldo torna com\'era', () => {
    const state = stateWith([reward({ cost: 100 })], 560);
    const first = R.redeem(state, 'pizza', NOW);
    const second = R.redeem({ ...state, stats: first.stats }, 'pizza', NOW + 1000);
    assertEqual(R.balance(second.stats), 360);
    const undone = R.undoRedeem(second.stats, first.entry.id);
    assertEqual([undone.spent.map(e => e.id), R.balance(undone)], [[second.entry.id], 460]);
    assertEqual(R.undoRedeem(undone, 'non-esiste'), undone, 'niente da togliere: stesso registro');
  });

  test('saldo a zero: annullando un completamento dopo un riscatto resta a zero finché i punti non tornano', () => {
    const task = { id: 't', title: 'Spesa', duration: 30, energy: 'medium', date: null, time: null, done: false, createdAt: 1, completedAt: null, pointsAwarded: null };
    let state = { tasks: [task], ...stateWith([reward()], 400) };
    const done = P.setDone(state, 't', true, NOW); // +24: 424
    state = { ...state, tasks: done.tasks, stats: done.stats };
    state = { ...state, stats: R.redeem(state, 'pizza', NOW + 1000).stats };
    assertEqual([state.stats.totalPoints, R.balance(state.stats)], [424, 24]);
    const spentMore = R.redeem({ ...state, rewards: [reward({ id: 'caffe', cost: 24 })] }, 'caffe', NOW + 2000);
    state = { ...state, stats: spentMore.stats };
    assertEqual(R.balance(state.stats), 0);
    const undo = P.setDone(state, 't', false, NOW + 3000); // −24: 400 guadagnati, 424 spesi
    assertEqual([undo.stats.totalPoints, R.balance(undo.stats)], [400, 0], 'mai sotto zero');
    assertEqual(undo.stats.spent.length, 2, 'i riscatti restano');
    const again = P.setDone({ ...state, tasks: undo.tasks, stats: undo.stats }, 't', true, NOW + 4000); // +24: 424
    assertEqual(R.balance(again.stats), 0, 'i 24 punti ripagano quelli spesi in più');
  });

  test('premio eliminato: i suoi riscatti restano nel registro e nello storico, con il nome', () => {
    const state = stateWith([reward(), reward({ id: 'film', title: 'Serata al cinema', emoji: '🎬', cost: 800 })], 2000,
      [spentEntry({ id: 'a', at: NOW - 2 * 86400e3 }), spentEntry({ id: 'b', rewardId: 'film', title: 'Serata al cinema', cost: 800, at: NOW - 3600e3 })]);
    const { rewards, removed, index } = R.removeReward(state.rewards, 'pizza');
    assertEqual([rewards.map(r => r.id), removed.id, index], [['film'], 'pizza', 0]);
    const after = { ...state, rewards };
    assertEqual(R.balance(after.stats), 800, 'il saldo non cambia');
    assertEqual(R.redeemedCount(after.stats, 'pizza'), 1);
    assertEqual(R.history(after, TODAY), [
      { id: 'b', emoji: '🎬', title: 'Serata al cinema', when: 'Oggi', cost: '−800' },
      { id: 'a', emoji: '🎁', title: 'Pizza del venerdì', when: 'mar 17 nov', cost: '−400' }
    ], 'dal più recente; il premio eliminato ha il nome e l\'emoji di partenza');
    assertEqual(R.restoreReward(rewards, removed, index).map(r => r.id), ['pizza', 'film'], '«Annulla» lo rimette dov\'era');
    assertEqual(R.restoreReward(state.rewards, removed, index), state.rewards, 'c\'è già: niente');
  });

  test('newlyReady: il premio più caro appena raggiunto da un completamento', () => {
    const rewards = [reward(), reward({ id: 'film', cost: 800 }), reward({ id: 'cuffie', cost: 3000 })];
    assertEqual(R.newlyReady(rewards, 390, 414).id, 'pizza');
    assertEqual(R.newlyReady(rewards, 390, 900).id, 'film', 'due raggiunti insieme: il più caro');
    assertEqual(R.newlyReady(rewards, 500, 520), null, 'nessuno nuovo');
    assertEqual(R.newlyReady(rewards, 414, 390), null, 'il saldo scende');
    assertEqual(R.newlyReady(rewards, 380, 400).id, 'pizza', 'esattamente il prezzo basta');
  });

  /* ---------- Premi: limiti, aggiunta, modifica ---------- */

  test('validateInput: nome e prezzo, con i limiti', () => {
    const ok = R.validateInput({ title: '  Pizza   del venerdì ', emoji: '🍕', cost: '400' });
    assertEqual([ok.errors, ok.value], [{}, { title: 'Pizza del venerdì', emoji: '🍕', cost: 400 }]);
    assertEqual(R.validateInput({ title: '', emoji: '🍕', cost: '400' }).errors, { title: 'Dai un nome al premio.' });
    assertEqual(R.validateInput({ title: 'x'.repeat(61), cost: 400 }).errors, { title: 'Al massimo 60 caratteri.' });
    assertEqual(R.validateInput({ title: 'x'.repeat(60), cost: 400 }).errors, {}, '60 caratteri vanno bene');
    ['', '9', '100001', 'tanti', '-50'].forEach(cost => {
      assertEqual(R.validateInput({ title: 'Premio', cost }).errors, { cost: 'Indica un prezzo tra 10 e 100.000 punti.' }, 'prezzo ' + cost);
    });
    assertEqual([R.validateInput({ title: 'A', cost: '10' }).value.cost, R.validateInput({ title: 'A', cost: '100000' }).value.cost], [10, 100000]);
    assertEqual(R.validateInput({ title: 'A', cost: '12.6' }).value.cost, 13, 'arrotondato all\'intero');
    assertEqual(R.validateInput({ title: 'A', emoji: '🤖', cost: 50 }).value.emoji, '🎁', 'emoji fuori dall\'elenco');
  });

  test('addReward: al massimo 30 premi', () => {
    let rewards = [];
    for (let i = 0; i < 30; i++) {
      const added = R.addReward(rewards, { title: 'Premio ' + i, emoji: '🎁', cost: 100 + i }, NOW + i);
      rewards = added.rewards;
      assert(added.reward && added.reward.createdAt === NOW + i, 'aggiunto il ' + (i + 1));
    }
    assertEqual([rewards.length, R.canAdd(rewards), new Set(rewards.map(r => r.id)).size], [30, false, 30]);
    const full = R.addReward(rewards, { title: 'Uno di troppo', emoji: '🎁', cost: 100 }, NOW);
    assertEqual([full.reward, full.rewards === rewards], [null, true]);
    const removed = R.removeReward(rewards, rewards[3].id);
    assertEqual(R.restoreReward(R.addReward(removed.rewards, { title: 'Al suo posto', emoji: '🎁', cost: 100 }, NOW).rewards,
      removed.removed, removed.index).length, 30, 'con 30 premi «Annulla» non ne aggiunge un 31°');
  });

  test('updateReward: cambiano nome, emoji e prezzo; i riscatti di prima restano come sono stati fatti', () => {
    const state = stateWith([reward({ extra: 'campo sconosciuto' })], 560);
    const redeemed = R.redeem(state, 'pizza', NOW);
    const result = R.updateReward(state.rewards, 'pizza', { title: 'Pizza con gli amici', emoji: '🍕', cost: 500 });
    assertEqual([result.changed, result.previous.title], [true, 'Pizza del venerdì']);
    assertEqual(result.rewards[0], { ...reward({ extra: 'campo sconosciuto' }), title: 'Pizza con gli amici', cost: 500 });
    assertEqual([redeemed.entry.title, redeemed.entry.cost], ['Pizza del venerdì', 400], 'il riscatto ha nome e prezzo di allora');
    const same = R.updateReward(state.rewards, 'pizza', { title: 'Pizza del venerdì', emoji: '🍕', cost: 400 });
    assertEqual([same.changed, same.rewards === state.rewards], [false, true]);
    assertEqual(R.updateReward(state.rewards, 'non-esiste', { title: 'A', emoji: '🎁', cost: 10 }).previous, null);
  });

  /* ---------- Per la pagina ---------- */

  test('rows: dal prezzo più basso, con la barra, «Pronto» e quante volte è stato preso', () => {
    const state = stateWith([
      reward({ id: 'cuffie', title: 'Cuffie nuove', emoji: '🎧', cost: 3000, createdAt: 1 }),
      reward({ id: 'film', title: 'Serata al cinema', emoji: '🎬', cost: 800, createdAt: 2 }),
      reward({ createdAt: 3 })
    ], 1360, [spentEntry({ id: 'a' }), spentEntry({ id: 'b' })]);
    const rows = R.rows(state);
    assertEqual(rows.map(row => [row.reward.id, row.ready, row.missing, row.count]), [['pizza', true, 0, 2], ['film', false, 240, 0], ['cuffie', false, 2440, 0]]);
    assertEqual(rows.map(row => row.status), ['Pronto · 400 punti · preso 2 volte', 'Ancora 240 · 800 punti', 'Ancora 2440 · 3000 punti']);
    assertEqual(rows.map(row => Math.round(row.progress * 100)), [100, 70, 19]);
    assertEqual(R.statusText(false, 99950, 100000, 1), 'Ancora 99.950 · 100.000 punti · preso 1 volta');
    const same = R.rows(stateWith([reward({ id: 'b', createdAt: 2 }), reward({ id: 'a', createdAt: 1 })], 0));
    assertEqual(same.map(row => row.reward.id), ['a', 'b'], 'stesso prezzo: dal più vecchio');
  });

  test('frasi: avvisi del riscatto e del premio pronto, quanto manca, suggerimento sul prezzo', () => {
    assertEqual(R.redeemText(spentEntry()), 'Te lo sei meritato: Pizza del venerdì · −400 punti');
    assertEqual(R.redeemText(spentEntry({ cost: 1 })), 'Te lo sei meritato: Pizza del venerdì · −1 punto');
    assertEqual(R.missingText(reward({ title: 'Serata al cinema', cost: 800 }), 560), 'Ancora 240 punti per Serata al cinema');
    assertEqual(R.readyText(reward()), '🍕 Ora puoi riscattare: Pizza del venerdì');
    assertEqual([R.takenNote(1), R.takenNote(2)], ['Preso 1 volta: i riscatti fatti restano come sono', 'Preso 2 volte: i riscatti fatti restano come sono']);
    const days = { [TODAY]: { done: 2, points: 50 }, '2026-11-13': { done: 1, points: 24 }, '2026-11-12': { done: 1, points: 99 } };
    assertEqual(R.priceHint({ ...P.emptyStats(), days }, TODAY), 'Negli ultimi 7 giorni hai guadagnato 74 punti.', 'dal 13 al 19');
    assertEqual(R.priceHint(P.emptyStats(), TODAY), 'Per darti un\'idea: un\'attività di 30 minuti con energia media vale 24 punti.');
  });

  test('guessEmoji ed emojiOf: l\'emoji dal nome, e solo quelle dell\'elenco', () => {
    const cases = {
      'Pizza del venerdì': '🍕',
      'Serata al cinema': '🎬',
      'Cuffie nuove': '🎧',
      'Spaghettata con gli amici': '🍝',
      'Tortellini della nonna': '🍝',
      'Una fetta di torta': '🍦',
      'Giornata alla SPA!': '🧖',
      'Weekend al mare': '✈️',
      'Una giornata libera': '🛌',
      'Spazio per me': null,
      '': null
    };
    Object.keys(cases).forEach(title => assertEqual(R.guessEmoji(title), cases[title], title));
    assertEqual([R.emojiOf('✈'), R.emojiOf('✈️'), R.emojiOf('🛍'), R.emojiOf('🤖'), R.emojiOf(5)], ['✈️', '✈️', '🛍️', null, null]);
  });

  /* ---------- Dati letti: pulizia, migrazione, backup ---------- */

  test('sanitizeRewards: puliti come le attività, al massimo 30', () => {
    const list = R.sanitizeRewards([
      { id: 'a', title: '  Pizza   del venerdì  ', emoji: '🍕', cost: 400, createdAt: 5, extra: 1 },
      { id: 'a', title: 'Doppio', emoji: '✈', cost: 12.4, createdAt: 6 },
      { id: 'c', title: 'x'.repeat(80), emoji: 'boh', cost: 5, createdAt: 7 },
      { id: 'd', title: 'Caro', emoji: '🎧', cost: 999999, createdAt: 8 },
      { id: 'e', title: '', cost: 100 },
      { id: 'f', title: 'Senza prezzo', cost: '100' },
      'non un oggetto',
      null
    ]);
    assertEqual(list.length, 4, 'scartati quelli senza nome o senza prezzo');
    assertEqual(list[0], { id: 'a', title: 'Pizza del venerdì', emoji: '🍕', cost: 400, createdAt: 5, extra: 1 });
    assert(list[1].id !== 'a', 'id doppio sostituito');
    assertEqual([list[1].emoji, list[1].cost], ['✈️', 12]);
    assertEqual([list[2].title.length, list[2].emoji, list[2].cost], [60, '🎁', 10]);
    assertEqual(list[3].cost, 100000);
    const many = Array.from({ length: 35 }, (_, i) => reward({ id: 'r' + i }));
    assertEqual(R.sanitizeRewards(many).map(r => r.id), many.slice(0, 30).map(r => r.id));
    [undefined, null, {}, 'testo', 5].forEach(raw => assertEqual(R.sanitizeRewards(raw), [], JSON.stringify(raw)));
  });

  test('sanitizeSpent: si tengono i riscatti validi, e un id ripetuto conta una volta', () => {
    const spent = R.sanitizeSpent([
      spentEntry({ id: 'a', extra: 'ok' }),
      spentEntry({ id: 'a', cost: 999 }),
      spentEntry({ id: 'b', cost: 0 }),
      spentEntry({ id: 'c', cost: -400 }),
      spentEntry({ id: 'd', cost: 12.5 }),
      spentEntry({ id: 'e', at: 'ieri' }),
      { cost: 50, at: NOW, title: '   ', rewardId: '' },
      'non un oggetto'
    ]);
    assertEqual(spent.length, 2);
    assertEqual(spent[0], spentEntry({ id: 'a', extra: 'ok' }), 'il primo con quell\'id, intatto');
    assert(typeof spent[1].id === 'string' && spent[1].id.length > 0, 'senza id ne riceve uno');
    assertEqual([spent[1].title, spent[1].rewardId, spent[1].cost], ['Premio', null, 50]);
    [undefined, null, {}, 'testo'].forEach(raw => assertEqual(R.sanitizeSpent(raw), [], JSON.stringify(raw)));
  });

  test('migrazione: i dati della v4 arrivano alla v5 con due elenchi vuoti; il resto è intatto', () => {
    const stats = { totalPoints: 24, bestStreak: 1, milestones: [], days: { '2026-11-18': { done: 1, points: 24 } }, focus: { '2026-11-18': 25 }, level: 2 };
    const tasks = [{ id: 'a', title: 'Fatta', duration: 30, energy: 'medium', date: '2026-11-18', time: null, done: true, createdAt: 1, completedAt: 5, pointsAwarded: 24 }];
    const state = storage.parse(JSON.stringify({ version: 4, future: 'ok', tasks, stats }));
    assertEqual([state.version, storage.SCHEMA_VERSION], [5, 5]);
    assertEqual([state.tasks, state.rewards, state.future], [tasks, [], 'ok']);
    assertEqual(state.stats, { ...stats, spent: [] }, 'registro identico, più i riscatti vuoti');
    assertEqual(storage.parse(JSON.stringify({ version: 1, tasks: [] })).rewards, [], 'anche dalla v1');
  });

  test('rebuildStats: il registro ricostruito dalle attività conserva i riscatti', () => {
    const done = { id: 'a', title: 'Fatta', duration: 30, energy: 'medium', date: null, done: true, createdAt: 1, completedAt: NOW, pointsAwarded: 24 };
    const kept = P.rebuildStats([done], { spent: [spentEntry()] });
    assertEqual([kept.totalPoints, kept.spent], [24, [spentEntry()]]);
    assertEqual(P.rebuildStats([done]).spent, [], 'senza registro di prima, nessun riscatto');
  });

  test('backup: esporta e importa premi e riscatti, puliti come il resto', () => {
    const state = {
      version: storage.SCHEMA_VERSION,
      tasks: [],
      rewards: [reward(), reward({ id: 'film', title: 'Serata al cinema', emoji: '🎬', cost: 800, createdAt: 2 })],
      stats: { ...P.emptyStats(), totalPoints: 900, days: { [TODAY]: { done: 3, points: 900 } }, spent: [spentEntry()] }
    };
    const file = storage.backupFile(state, NOW);
    assertEqual(JSON.parse(file.text).data.rewards, state.rewards, 'nel file ci sono i premi');
    const back = storage.readBackup(file.text);
    assertEqual([back.error, back.state], [null, state], 'andata e ritorno identici');
    const dirty = { ...state, rewards: [...state.rewards, { id: 'x', title: '' }, 'rotto'], stats: { ...state.stats, spent: [spentEntry(), spentEntry(), { cost: -5 }] } };
    const cleaned = storage.readBackup(JSON.stringify({ format: storage.BACKUP_FORMAT, exportedAt: NOW, data: dirty })).state;
    assertEqual([cleaned.rewards, cleaned.stats.spent], [state.rewards, [spentEntry()]]);
    assertEqual(R.balance(cleaned.stats), 500);
  });
})();
