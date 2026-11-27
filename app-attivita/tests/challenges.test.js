/*
 * Test di «Sfide di oggi» (js/challenges.js; P-003, passo 3.5): scelta delle tre sfide, quando sono fatte e quando non
 * lo sono più («Annulla», spunta tolta, eliminazioni, giorni passati), punti in totalPoints, giorni conservati, testi
 * della card e dell'avviso, pulizia dei dati letti, migrazione alla v8, backup e rebuildStats(). Specifica in
 * docs/punti-e-serie.md, «Sfide di oggi».
 */
(function () {
  'use strict';

  const { test, assert, assertEqual } = window.AuraTest;
  const { utils, points: P, focus: F, challenges: C, rewards: R, storage } = window.Aura;

  const TODAY = '2026-11-27'; // venerdì
  const day = offset => utils.addDays(TODAY, offset); // day(-1) = ieri
  /** Istante locale di oggi (o del giorno `offset`) alle `hour`:`minute`. */
  const at = (hour, minute = 0, offset = 0) => {
    const date = utils.parseISODate(day(offset));
    date.setHours(hour, minute, 0, 0);
    return date.getTime();
  };
  const NOW = at(9, 30);

  function task(overrides) {
    return {
      id: 't', title: 'Prova', duration: 30, energy: 'medium', date: null, time: null,
      done: false, createdAt: at(8, 0), completedAt: null, pointsAwarded: null, repeat: null, seriesId: null,
      ...overrides
    };
  }

  /** Registro con `done` completamenti (da 10 punti l'uno) in ciascuno dei giorni dati come { offset: completamenti }. */
  function statsWith(doneByOffset = {}, extra = {}) {
    const days = {};
    Object.keys(doneByOffset).forEach(offset => { days[day(Number(offset))] = { done: doneByOffset[offset], points: 10 * doneByOffset[offset] }; });
    const totalPoints = Object.keys(days).reduce((sum, d) => sum + days[d].points, 0);
    return { ...P.emptyStats(), totalPoints, days, ...extra };
  }

  /** Completa (o rimette da fare) come fa l'app: P.setDone e poi la rivalutazione delle sfide. */
  function setDone(state, id, done, now) {
    const result = P.setDone(state, id, done, now);
    const challenges = C.refresh(result.stats, result.tasks, now);
    return { tasks: result.tasks, stats: challenges.stats, result, challenges };
  }

  const kinds = entry => entry.items.map(item => item.kind + ':' + item.target);

  /* ---------- Regole ---------- */

  test('CHALLENGES e POINTS: le regole di P-003 in un posto solo', () => {
    assertEqual([P.POINTS.challenge, P.POINTS.allChallenges], [10, 20]);
    const { CHALLENGES } = C;
    assertEqual([CHALLENGES.keepDays, CHALLENGES.count.min, CHALLENGES.count.max, CHALLENGES.count.fallback], [30, 2, 6, 2]);
    assertEqual([CHALLENGES.focus.first, CHALLENGES.focus.regular, CHALLENGES.oldest.minAgeDays], [10, 25, 3]);
    assertEqual(CHALLENGES.before.hours, [12, 18, 22]);
  });

  test('challengePoints: 10 per sfida fatta e 20 in più con tutte e tre, al massimo 50', () => {
    const entry = done => ({ at: NOW, items: [0, 1, 2].map(i => (i < done ? { kind: 'x', target: 1, done: NOW } : { kind: 'x', target: 1 })) });
    assertEqual([0, 1, 2, 3].map(n => P.challengePoints(entry(n))), [0, 10, 20, 50]);
    assertEqual([P.challengePoints(undefined), P.challengePoints({ at: NOW, items: [] })], [0, 0]);
    assertEqual(P.challengeTotal({ [day(0)]: entry(3), [day(-1)]: entry(1) }), 60);
    const stats = { ...statsWith({ 0: 2 }), challenges: { [day(0)]: entry(2) } };
    assertEqual([P.pointsOn(stats, day(0)), P.pointsOn(stats, day(-1))], [40, 0], '+N oggi: completamenti e sfide');
  });

  /* ---------- Come nascono ---------- */

  test('countTarget: la media dei giorni attivi dei 7 giorni prima, arrotondata e tra 2 e 6', () => {
    assertEqual(C.countTarget(statsWith({ '-1': 2, '-3': 3 }), TODAY), 3, '2,5 diventa 3');
    assertEqual(C.countTarget(statsWith({ '-1': 2, '-2': 2, '-4': 3 }), TODAY), 2, '2,33 diventa 2');
    assertEqual(C.countTarget(statsWith({ '-2': 11, '-5': 9 }), TODAY), 6, 'al massimo 6');
    assertEqual(C.countTarget(statsWith({ '-1': 1 }), TODAY), 2, 'almeno 2');
    assertEqual(C.countTarget(statsWith({}), TODAY), 2, 'senza giorni attivi');
    assertEqual(C.countTarget(statsWith({ 0: 5, '-8': 5 }), TODAY), 2, 'oggi e 8 giorni fa non contano');
    const repaired = statsWith({ '-1': 4 }, { shop: [{ id: 'r', item: 'repair', cost: 150, at: NOW, day: day(-2) }] });
    assertEqual(C.countTarget(repaired, TODAY), 4, 'un giorno riparato non ha completamenti: non abbassa la media');
  });

  test('focusTarget: 10 finché il registro non ha minuti di focus, poi 25', () => {
    assertEqual(C.focusTarget(statsWith({})), 10);
    assertEqual(C.focusTarget(statsWith({}, { focus: { [day(-40)]: 5 } })), 25, 'anche minuti vecchi');
    assertEqual(C.focusTarget({ totalPoints: 0, days: {} }), 10, 'registro senza focus');
  });

  test('oldestTask: l\'attività da fare creata da più tempo, da almeno 3 giorni, non fissata nel futuro', () => {
    const tasks = [
      task({ id: 'b', createdAt: at(10, 0, -5) }),
      task({ id: 'a', createdAt: at(9, 0, -6), date: day(3) }),                  // la più vecchia, ma per fra 3 giorni
      task({ id: 'c', createdAt: at(7, 0, -9), done: true, completedAt: NOW - 1 }), // già fatta
      task({ id: 'd', createdAt: at(7, 0, -5), date: day(-1) }),                 // in ritardo: conta
      task({ id: 'e', createdAt: at(23, 0, -2) })                                // 2 giorni: troppo giovane
    ];
    assertEqual(C.oldestTask(tasks, TODAY).id, 'd');
    assertEqual(C.oldestTask([task({ id: 'x', createdAt: at(23, 59, -3) })], TODAY).id, 'x', '3 giorni di calendario bastano');
    assertEqual(C.oldestTask([task({ id: 'x', createdAt: at(0, 0, -2) })], TODAY), null);
    assertEqual(C.oldestTask([task({ id: 'x', createdAt: at(8, 0, -4), date: TODAY })], TODAY).id, 'x', 'fissata oggi: conta');
    const same = at(8, 0, -4);
    assertEqual(C.oldestTask([task({ id: 'z', createdAt: same }), task({ id: 'y', createdAt: same })], TODAY).id, 'y', 'a pari età, l\'id che viene prima');
  });

  test('beforeHour: la prima tra le 12, le 18 e le 22 che arriva almeno 2 ore dopo', () => {
    const hour = (h, m) => C.beforeHour(at(h, m));
    assertEqual([hour(6, 0), hour(10, 0), hour(10, 1), hour(16, 0), hour(16, 30), hour(20, 0), hour(20, 1), hour(23, 30)],
      [12, 12, 18, 18, 22, 22, null, null]);
  });

  test('create: le tre sfide in ordine, con l\'attività più vecchia o una sfida di tempo', () => {
    const stats = statsWith({ '-1': 3, '-2': 4 }, { focus: { [day(-1)]: 30 } });
    const old = task({ id: 'vecchia', createdAt: at(8, 0, -6) });
    const withOld = C.create(stats, [old], NOW);
    assertEqual([withOld.at, kinds(withOld), withOld.items[2].taskId], [NOW, ['count:4', 'focus:25', 'oldest:1'], 'vecchia']);
    assertEqual(kinds(C.create(stats, [], at(11, 0))), ['count:4', 'focus:25', 'before:18']);
    assertEqual(kinds(C.create(statsWith({}), [], at(21, 15))), ['count:2', 'focus:10', 'any:1'], 'dopo le 20');
  });

  /* ---------- refresh: nascita, giorni conservati, punti ---------- */

  test('refresh: le sfide di oggi nascono una volta sola; poi, senza cambiamenti, niente cambia', () => {
    const stats = statsWith({ '-1': 2 });
    const first = C.refresh(stats, [], NOW);
    assertEqual([kinds(first.stats.challenges[TODAY]), first.stats.challenges[TODAY].at, first.points], [['count:2', 'focus:10', 'before:12'], NOW, 0]);
    assertEqual(stats.challenges, {}, 'il registro di prima non cambia');
    const again = C.refresh(first.stats, [], NOW + 3600e3);
    assert(again.stats === first.stats, 'stesso oggetto: niente da salvare');
    assertEqual([again.gained, again.all, again.points], [[], false, 0]);
  });

  test('refresh: a un giorno nuovo si tengono i 30 giorni più recenti, e i punti dei giorni tolti restano', () => {
    const challenges = {};
    const days = {};
    for (let i = 1; i <= 30; i++) {
      challenges[day(-i)] = { at: at(8, 0, -i), items: [{ kind: 'count', target: 2, done: at(9, 0, -i) }, { kind: 'focus', target: 10 }, { kind: 'any', target: 1 }] };
      days[day(-i)] = { done: 2, points: 0 };
    }
    const stats = { ...P.emptyStats(), totalPoints: 300, days, challenges };
    const next = C.refresh(stats, [], NOW).stats;
    const kept = Object.keys(next.challenges).sort();
    assertEqual([kept.length, kept[0], kept[29]], [30, day(-29), TODAY], 'il giorno più vecchio esce');
    assertEqual(next.totalPoints, 300, 'i suoi 10 punti restano nel totale');
  });

  test('refresh: un giorno passato non guadagna sfide, anche con minuti di focus arrivati dopo', () => {
    const yesterday = { at: at(8, 0, -1), items: [{ kind: 'count', target: 2 }, { kind: 'focus', target: 25 }, { kind: 'any', target: 1 }] };
    const stats = statsWith({ '-1': 3 }, { focus: { [day(-1)]: 40 }, challenges: { [day(-1)]: yesterday } });
    const next = C.refresh(stats, [], NOW).stats;
    assertEqual(next.challenges[day(-1)], yesterday, 'ieri resta com\'era');
    assertEqual(next.totalPoints, stats.totalPoints);
  });

  /* ---------- Quante attività ---------- */

  test('count: completando si arriva a N, la sfida è fatta (+10); «Annulla» la toglie con i suoi punti', () => {
    const tasks = [task({ id: 'a' }), task({ id: 'b', duration: 15, energy: 'low' })];
    const start = C.refresh(statsWith({ '-1': 2 }), tasks, NOW).stats;
    assertEqual(kinds(start.challenges[TODAY]), ['count:2', 'focus:10', 'before:12'], 'attività nuove: la terza è «entro le 12»');
    const one = setDone({ tasks, stats: start }, 'a', true, at(9, 40));
    assertEqual([one.challenges.gained.map(item => item.kind), one.stats.totalPoints - start.totalPoints], [['before'], 24 + 10], 'una su due: solo «entro le 12»');
    const two = setDone(one, 'b', true, at(10, 40));
    assertEqual([two.challenges.gained.map(item => item.kind), two.challenges.points, two.stats.totalPoints - one.stats.totalPoints], [['count'], 10, 13 + 10]);
    assertEqual(two.stats.challenges[TODAY].items[0].done, at(10, 40), 'segna quando');
    assertEqual(C.gainedText(two.challenges), '🎯 Sfida fatta');
    const undo = setDone(two, 'b', false, at(10, 41));
    assertEqual([undo.challenges.points, undo.stats.challenges[TODAY].items[0].done, undo.stats.totalPoints], [-10, undefined, one.stats.totalPoints],
      'la sfida di quante torna da fare; «entro le 12» resta, grazie ad «a»');
  });

  test('count: togliere la spunta a un completamento di ieri disfa anche la sfida di ieri', () => {
    const tasks = [task({ id: 'a', done: true, completedAt: at(18, 0, -1), pointsAwarded: 24 }), task({ id: 'b', done: true, completedAt: at(19, 0, -1), pointsAwarded: 24 })];
    const yesterday = { at: at(8, 0, -1), items: [{ kind: 'count', target: 2, done: at(19, 0, -1) }, { kind: 'focus', target: 10 }, { kind: 'any', target: 1, done: at(18, 0, -1) }] };
    const stats = { ...P.emptyStats(), totalPoints: 48 + 20, days: { [day(-1)]: { done: 2, points: 48 } }, challenges: { [day(-1)]: yesterday } };
    const next = setDone({ tasks, stats }, 'b', false, NOW);
    assertEqual(next.stats.challenges[day(-1)].items.map(item => Boolean(item.done)), [false, false, true]);
    assertEqual(next.stats.totalPoints, 24 + 10, '−24 del completamento e −10 della sfida');
    const again = setDone(next, 'b', true, at(9, 45));
    assertEqual(again.stats.challenges[day(-1)].items[0].done, undefined, 'rifatta oggi: ieri non torna');
  });

  /* ---------- Tutte e tre ---------- */

  test('tutte e tre: +50 punti al giorno e il testo dell\'avviso; disfarne una toglie anche i 20 in più', () => {
    const old = task({ id: 'vecchia', createdAt: at(8, 0, -6) });
    const tasks = [old, task({ id: 'b' })];
    const start = C.refresh(statsWith({}, { focus: { [day(-2)]: 30 } }), tasks, NOW).stats;
    assertEqual(kinds(start.challenges[TODAY]), ['count:2', 'focus:25', 'oldest:1']);
    const withFocus = C.refresh(F.recordMinutes(start, TODAY, 25), tasks, at(9, 55));
    assertEqual([withFocus.gained.map(item => item.kind), C.gainedText(withFocus), withFocus.points], [['focus'], '🎯 Sfida fatta', 10]);
    const one = setDone({ tasks, stats: withFocus.stats }, 'b', true, at(10, 0));
    const all = setDone(one, 'vecchia', true, at(10, 5));
    assertEqual([all.challenges.gained.map(item => item.kind), all.challenges.all, C.gainedText(all.challenges), all.challenges.points], [['count', 'oldest'], true, '🏆 Tutte e tre le sfide!', 40]);
    assertEqual(P.challengePoints(all.stats.challenges[TODAY]), 50);
    assertEqual(all.stats.totalPoints, 24 + 24 + 50);
    const undo = setDone(all, 'vecchia', false, at(10, 6));
    assertEqual([undo.challenges.points, undo.stats.totalPoints], [-40, 24 + 10], 'via la più vecchia, quante (1 su 2) e i 20 in più');
  });

  /* ---------- La più vecchia ---------- */

  test('oldest: eliminare dopo averla chiusa non la disfa; eliminata prima, non si può più fare', () => {
    const tasks = [task({ id: 'vecchia', createdAt: at(8, 0, -6) })];
    const start = C.refresh(statsWith({}), tasks, NOW).stats;
    const closed = setDone({ tasks, stats: start }, 'vecchia', true, at(10, 0));
    assertEqual(closed.stats.challenges[TODAY].items[2].done, at(10, 0));
    const deleted = C.refresh(closed.stats, [], at(10, 30));
    assert(deleted.stats === closed.stats, 'eliminata dopo: resta fatta, punti compresi');
    const gone = C.refresh(start, [], at(10, 30));
    assert(gone.stats === start, 'eliminata prima: resta da fare');
    const view = C.forToday(start, [], at(10, 30));
    assertEqual([view.rows[2].title, view.rows[2].note, view.rows[2].done], ["Chiudi l'attività più vecchia", "Non c'è più", false]);
  });

  /* ---------- Entro le H ---------- */

  test('before: vale un completamento prima delle H:00; ricorda quale, e un altro prende il suo posto', () => {
    const tasks = [task({ id: 'a' }), task({ id: 'b' }), task({ id: 'c' })];
    const start = C.refresh(statsWith({}), tasks, at(11, 0)).stats;
    assertEqual(kinds(start.challenges[TODAY])[2], 'before:18');
    let s = setDone({ tasks, stats: start }, 'a', true, at(14, 0));
    s = setDone(s, 'b', true, at(15, 0));
    const item = () => s.stats.challenges[TODAY].items[2];
    assertEqual([item().done, item().by], [at(14, 0), 'a']);
    s = setDone(s, 'a', false, at(15, 30));
    assertEqual([item().done, item().by], [at(14, 0), 'b'], '«b» la tiene fatta, con l\'istante di prima');
    s = setDone(s, 'b', false, at(15, 31));
    assertEqual(item().done, undefined, 'nessuna prima delle 18: torna da fare');
    s = setDone(s, 'c', true, at(18, 0));
    assertEqual(item().done, undefined, 'alle 18:00 è tardi');
  });

  test('before: eliminare l\'attività che l\'ha fatta non la disfa', () => {
    const tasks = [task({ id: 'a' })];
    const start = C.refresh(statsWith({}), tasks, at(11, 0)).stats;
    const done = setDone({ tasks, stats: start }, 'a', true, at(12, 0));
    const deleted = C.refresh(done.stats, [], at(12, 5));
    assert(deleted.stats === done.stats);
  });

  /* ---------- Focus ---------- */

  test('focus: fatta quando i minuti arrivano all\'obiettivo; «Annulla» sui minuti la disfa', () => {
    const start = C.refresh(statsWith({}), [], NOW).stats;
    const ten = C.refresh(F.recordMinutes(start, TODAY, 10), [], at(9, 50));
    assertEqual([ten.gained.map(item => item.kind), ten.stats.challenges[TODAY].items[1].done], [['focus'], at(9, 50)]);
    const undo = C.refresh(F.recordMinutes(ten.stats, TODAY, -10), [], at(9, 51));
    assertEqual([undo.points, undo.stats.challenges[TODAY].items[1].done, undo.stats.totalPoints], [-10, undefined, start.totalPoints]);
  });

  /* ---------- Card e avvisi ---------- */

  test('forToday: i testi della card, con l\'anello e lo stato', () => {
    const old = task({ id: 'v', title: 'Leggere 20 pagine', createdAt: at(8, 0, -6) });
    const stats = statsWith({ 0: 2, '-1': 3 }, { focus: { [TODAY]: 10, [day(-1)]: 5 } });
    const entry = { at: NOW, items: [{ kind: 'count', target: 3 }, { kind: 'focus', target: 25, done: at(10, 40) }, { kind: 'oldest', target: 1, taskId: 'v' }] };
    const view = C.forToday({ ...stats, challenges: { [TODAY]: entry } }, [old], at(11, 0));
    assertEqual(view.rows.map(row => [row.title, row.note, Math.round(row.progress * 100), row.done]), [
      ['Completa 3 attività', '2 su 3', 67, false],
      ['Fai 25 minuti di focus', 'Fatto alle 10:40', 100, true],
      ['Chiudi «Leggere 20 pagine»', 'Aspetta da 6 giorni', 0, false]
    ]);
    assertEqual([view.done, view.total, view.points, view.all], [1, 3, 10, false]);
    const focusView = C.forToday({ ...stats, challenges: { [TODAY]: { ...entry, items: [entry.items[0], { kind: 'focus', target: 25 }, entry.items[2]] } } }, [old], at(11, 0));
    assertEqual(focusView.rows[1].note, '10 su 25 min');
    assertEqual(C.forToday(stats, [], NOW), null, 'oggi non ci sono ancora');
  });

  test('forToday: entro le H e una qualsiasi, prima e dopo l\'ora, senza rimproveri', () => {
    const entry = { at: NOW, items: [{ kind: 'count', target: 2 }, { kind: 'focus', target: 10 }, { kind: 'before', target: 18 }] };
    const stats = { ...statsWith({}), challenges: { [TODAY]: entry } };
    assertEqual([C.forToday(stats, [], at(17, 59)).rows[2].title, C.forToday(stats, [], at(17, 59)).rows[2].note], ["Completa un'attività entro le 18", 'Hai tempo fino alle 18']);
    assertEqual(C.forToday(stats, [], at(18, 0)).rows[2].note, 'Entro le 18');
    const any = { ...stats, challenges: { [TODAY]: { ...entry, items: [entry.items[0], entry.items[1], { kind: 'any', target: 1 }] } } };
    assertEqual([C.forToday(any, [], NOW).rows[2].title, C.forToday(any, [], NOW).rows[2].note], ["Completa un'attività", 'Una qualsiasi, entro stasera']);
  });

  test('gainedText: niente da dire senza sfide nuove', () => {
    assertEqual([C.gainedText(null), C.gainedText({ gained: [], all: false })], ['', '']);
  });

  /* ---------- Dati letti ---------- */

  test('sanitize: tiene solo giorni e sfide valide, nell\'ordine giusto; toglie done e by non validi', () => {
    const good = { at: NOW, items: [{ kind: 'count', target: 3, done: NOW }, { kind: 'focus', target: 25 }, { kind: 'before', target: 18, done: NOW, by: 'a' }], nota: 'ok' };
    const raw = {
      [TODAY]: good,
      [day(-1)]: { ...good, items: [good.items[1], good.items[0], good.items[2]] },                 // ordine sbagliato
      [day(-2)]: { ...good, items: [{ kind: 'count', target: 7 }, good.items[1], good.items[2]] },   // N oltre 6
      [day(-3)]: { ...good, items: [good.items[0], { kind: 'focus', target: 15 }, good.items[2]] },  // minuti non previsti
      [day(-4)]: { ...good, items: [good.items[0], good.items[1], { kind: 'before', target: 13 }] }, // ora non prevista
      [day(-5)]: { ...good, items: [good.items[0], good.items[1], { kind: 'oldest', target: 1 }] },  // senza attività
      [day(-6)]: { ...good, items: good.items.slice(0, 2) },                                       // due sfide
      [day(-7)]: { ...good, at: 'ieri' },
      '2026-02-30': good,
      [day(-8)]: { at: NOW, items: [{ kind: 'count', target: 2, done: -5, taskId: 'x' }, { kind: 'focus', target: 10, by: 'a' }, { kind: 'oldest', target: 1, taskId: 'v', done: NOW }] }
    };
    const clean = C.sanitize(raw);
    assertEqual(Object.keys(clean).sort(), [day(-8), TODAY]);
    assertEqual(clean[TODAY], good, 'una sfida valida resta com\'è, campi sconosciuti compresi');
    assertEqual(clean[day(-8)].items, [{ kind: 'count', target: 2 }, { kind: 'focus', target: 10 }, { kind: 'oldest', target: 1, taskId: 'v', done: NOW }]);
    assertEqual([C.sanitize(null), C.sanitize([]), C.sanitize('rotto')], [{}, {}, {}]);
    const many = {};
    for (let i = 0; i < 35; i++) many[day(-i)] = good;
    assertEqual(Object.keys(C.sanitize(many)).length, 30, 'al massimo i 30 giorni più recenti');
  });

  test('sanitizeStats: le sfide passano dalla pulizia, e il totale mancante conta anche i loro punti', () => {
    const entry = { at: NOW, items: [{ kind: 'count', target: 2, done: NOW }, { kind: 'focus', target: 10, done: NOW }, { kind: 'any', target: 1, done: NOW }] };
    const stats = storage.sanitizeStats({ ...statsWith({ 0: 2 }), totalPoints: 'rotto', challenges: { [TODAY]: entry, rotto: 1 } });
    assertEqual([stats.challenges, stats.totalPoints], [{ [TODAY]: entry }, 20 + 50]);
  });

  test('migrazione: i dati della v7 arrivano alla v8 con le sfide vuote; il resto è intatto', () => {
    const stats = { totalPoints: 24, bestStreak: 1, milestones: [], days: { [day(-1)]: { done: 1, points: 24 } }, focus: {}, spent: [], shop: [] };
    const state = storage.parse(JSON.stringify({ version: 7, tasks: [], rewards: [], stats, look: { aurora: 'aurora', confetti: 'classic', sound: 'none', at: 0 } }));
    assertEqual([state.version, storage.SCHEMA_VERSION], [8, 8]);
    assertEqual(state.stats, { ...stats, challenges: {} });
    const born = C.refresh(state.stats, state.tasks, NOW).stats;
    assertEqual(Object.keys(born.challenges), [TODAY], 'quelle di oggi nascono alla prima apertura');
  });

  test('backup: esporta e importa le sfide, pulite come il resto', () => {
    const entry = { at: NOW, items: [{ kind: 'count', target: 2, done: NOW }, { kind: 'focus', target: 10 }, { kind: 'oldest', target: 1, taskId: 'v' }] };
    const state = {
      version: storage.SCHEMA_VERSION,
      tasks: [],
      rewards: [],
      stats: { ...statsWith({ 0: 2 }), totalPoints: 30, challenges: { [TODAY]: entry } },
      look: { aurora: 'aurora', confetti: 'classic', sound: 'none', at: 0 }
    };
    const file = storage.backupFile(state, NOW);
    assertEqual(JSON.parse(file.text).data.stats.challenges, { [TODAY]: entry });
    const back = storage.readBackup(file.text);
    assertEqual([back.error, back.state], [null, state], 'andata e ritorno identici');
    const dirty = { ...state, stats: { ...state.stats, challenges: { [TODAY]: entry, [day(-1)]: { at: NOW, items: [] } } } };
    const cleaned = storage.readBackup(JSON.stringify({ format: storage.BACKUP_FORMAT, exportedAt: NOW, data: dirty })).state;
    assertEqual(cleaned.stats.challenges, { [TODAY]: entry });
    assertEqual(R.balance(cleaned.stats), 30, 'i punti delle sfide sono nel saldo da spendere');
  });

  test('rebuildStats: conserva le sfide e conta i loro punti nel totale', () => {
    const entry = { at: NOW, items: [{ kind: 'count', target: 2, done: NOW }, { kind: 'focus', target: 10 }, { kind: 'any', target: 1, done: NOW }] };
    const tasks = [task({ id: 'a', done: true, completedAt: at(9, 0), pointsAwarded: 24 })];
    const rebuilt = P.rebuildStats(tasks, { challenges: { [TODAY]: entry } });
    assertEqual([rebuilt.challenges, rebuilt.totalPoints], [{ [TODAY]: entry }, 24 + 20]);
    assertEqual(P.rebuildStats(tasks).challenges, {}, 'senza registro di prima, nessuna sfida');
  });

  test('priceHint: i punti degli ultimi 7 giorni contano anche le sfide', () => {
    const entry = { at: NOW, items: [{ kind: 'count', target: 2, done: NOW }, { kind: 'focus', target: 10 }, { kind: 'any', target: 1 }] };
    assertEqual(R.priceHint({ ...statsWith({ '-1': 2 }), challenges: { [TODAY]: entry } }, TODAY), 'Negli ultimi 7 giorni hai guadagnato 30 punti.');
  });
})();
