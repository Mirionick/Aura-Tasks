/* Test di js/assistant.js. "Adesso" è fisso: giovedì 12/11/2026 alle 9:00 (ora locale). Le risposte del server sono
   scritte a mano, nella forma che restituisce POST /api/assistant/chat dopo i suoi controlli. */
(function () {
  'use strict';

  const { test, assert, assertEqual } = window.AuraTest;
  const { assistant: A } = window.Aura;

  const at = (d, h, m) => new Date(2026, 10, d, h, m || 0).getTime();
  const NOW = at(12, 9);
  const TODAY = '2026-11-12';
  const TOMORROW = '2026-11-13';
  const ON = { autoAdd: true, autoEdit: false };
  const CHOICE = { minutes: 30, energy: 'medium' };
  let seq = 0;

  function make(overrides) {
    seq++;
    return {
      id: 'id' + seq, title: 'Attività ' + seq, duration: 30, energy: 'medium', date: null, time: null,
      done: false, createdAt: at(10, 8, seq % 60), completedAt: null, pointsAwarded: null,
      ...overrides
    };
  }
  const reply = (actions, extra) => ({ say: 'Fatto.', context: null, actions, dropped: 0, left: 50, ...extra });
  /** planReply con i valori più comuni: le sigle vengono da buildRequest, come nell'app. */
  function plan(tasks, actions, options = {}) {
    const { refs } = A.buildRequest(tasks, { kind: 'message', message: options.message || '', now: NOW, at: options.at || NOW, context: CHOICE, memory: options.memory || [] });
    return A.planReply(options.reply || reply(actions, options.extra), {
      tasks, refs, perms: options.perms || ON, now: NOW, at: options.at || NOW, message: options.message || '',
      memory: options.memory || [], choice: options.choice || CHOICE
    });
  }
  const kinds = list => list.map(entry => entry.kind + (entry.brake ? ':' + entry.brake : ''));

  /* ---------- Richiesta ---------- */

  test('assistente: la richiesta manda solo le attività da fare (in ritardo, oggi, senza data, 7 giorni), con le sigle', () => {
    const list = [
      make({ id: 'senza', title: 'Senza data' }),
      make({ id: 'lontana', date: '2026-11-25' }),
      make({ id: 'oggi10', date: TODAY, time: '10:00' }),
      make({ id: 'fatta', done: true, completedAt: 1 }),
      make({ id: 'ritardo', date: '2026-11-10' }),
      make({ id: 'oggi', date: TODAY }),
      make({ id: 'settimana', date: '2026-11-19', time: '18:00' })
    ];
    const { payload, refs } = A.buildRequest(list, { kind: 'message', message: '  ho  mezz\'ora  ', now: NOW, context: CHOICE });
    assertEqual(payload.tasks.map(task => task.ref + '=' + refs[task.ref]), ['t1=ritardo', 't2=oggi10', 't3=oggi', 't4=senza', 't5=settimana']);
    assertEqual(payload.tasks[1], { ref: 't2', title: 'Attività 3', duration: 30, energy: 'medium', date: TODAY, time: '10:00' });
    assertEqual([payload.kind, payload.message, payload.now, payload.context], ['message', 'ho mezz\'ora', { date: TODAY, time: '09:00' }, CHOICE]);
    assert(!/id\d|senza"|ritardo"/.test(JSON.stringify(payload.tasks.map(({ ref, ...rest }) => rest))), 'gli id non partono mai');
  });

  test('assistente: al massimo 40 attività, titoli fino a 120 caratteri; «open» senza messaggio; Siri con l\'ora della dettatura', () => {
    const many = Array.from({ length: 45 }, () => make({ title: 'x'.repeat(130) }));
    const { payload } = A.buildRequest(many, { kind: 'open', message: 'ignorato', now: NOW, context: { minutes: null, energy: 'high' } });
    assertEqual([payload.tasks.length, payload.tasks[0].title.length, payload.message, payload.context.minutes], [40, 120, '', null]);
    const siri = A.buildRequest([], { kind: 'siri', message: 'domani dentista', now: NOW, at: at(11, 22, 15), context: CHOICE }).payload;
    assertEqual(siri.now, { date: '2026-11-11', time: '22:15' }, 'il momento della dettatura');
  });

  test('assistente: memoria breve, ultimi 3 scambi degli ultimi 10 minuti, con le sigle di adesso', () => {
    const a = make({ id: 'a' });
    const b = make({ id: 'b' });
    let memory = [];
    memory = A.addExchange(memory, { said: 'uno', reply: 'r1', did: [{ type: 'add', taskId: 'a' }] }, at(12, 8, 45));
    memory = A.addExchange(memory, { said: 'due', reply: 'r2', did: [{ type: 'suggest', taskId: 'b' }, { type: 'boh', taskId: 'b' }] }, at(12, 8, 52));
    memory = A.addExchange(memory, { said: 'tre', reply: 'r3', did: [{ type: 'add', taskId: 'sparita' }] }, at(12, 8, 55));
    memory = A.addExchange(memory, { said: 'quattro', reply: 'x'.repeat(300), did: [{ type: 'update', taskId: 'a' }] }, at(12, 8, 58));
    assertEqual(memory.map(item => item.said), ['due', 'tre', 'quattro'], 'al massimo 3');
    assertEqual(memory[2].reply.length, 200, 'risposta tagliata a 200 caratteri');
    const { payload } = A.buildRequest([a, b], { now: NOW, message: 'x', context: CHOICE, memory });
    assertEqual(payload.recent.map(item => [item.said, item.did]), [['due', ['suggest t2']], ['tre', []], ['quattro', ['update t1']]],
      'i tipi sconosciuti e le attività sparite si tolgono');
    assertEqual(A.recentExchanges(memory, at(12, 9, 3)).map(item => item.said), ['tre', 'quattro'], 'dopo 10 minuti uno scambio sparisce');
    assertEqual(A.recentExchanges(memory, at(12, 9, 30)), [], 'dopo mezz\'ora non resta niente');
  });

  /* ---------- Permessi ---------- */

  test('assistente: completare ed eliminare non sono mai automatici, con nessun permesso', () => {
    const task = make({ id: 'x', title: 'Fare la spesa' });
    [[false, false], [true, false], [false, true], [true, true]].forEach(([autoAdd, autoEdit]) => {
      const result = plan([task], [{ type: 'complete', task: 't1' }, { type: 'delete', task: 't1' }], { perms: { autoAdd, autoEdit } });
      assertEqual([result.auto, kinds(result.ask)], [[], ['complete', 'delete']], 'permessi ' + autoAdd + '/' + autoEdit);
      assertEqual(A.isAutomatic({ kind: 'complete' }, { autoAdd, autoEdit }) || A.isAutomatic({ kind: 'delete', correction: true }, { autoAdd, autoEdit }), false);
    });
  });

  test('assistente: aggiungere da solo solo con «Aggiungere da solo»; cambiare solo con «Cambiare da solo»', () => {
    const task = make({ id: 'p', title: 'Palestra', date: TODAY, time: '18:00' });
    const add = { type: 'add', title: 'Chiamare il medico', duration: 10, energy: 'low', date: TOMORROW, time: null };
    const move = { type: 'update', task: 't1', date: TOMORROW };
    assertEqual(kinds(plan([task], [add], { message: 'domani chiamare il medico' }).auto), ['add']);
    assertEqual(kinds(plan([task], [add], { message: 'domani chiamare il medico', perms: { autoAdd: false, autoEdit: true } }).ask), ['add']);
    assertEqual(kinds(plan([task], [move], { message: 'sposta la palestra a domani' }).ask), ['update']);
    const edited = plan([task], [move], { message: 'sposta la palestra a domani', perms: { autoAdd: false, autoEdit: true } });
    assertEqual([kinds(edited.auto), edited.auto[0].value.date, edited.auto[0].value.time], [['update'], TOMORROW, '18:00']);
  });

  test('assistente: durata ed energia mancanti prendono i valori del modulo; dati non validi si scartano', () => {
    const result = plan([], [
      { type: 'add', title: 'Comprare il pane', duration: null, energy: null, date: null, time: null },
      { type: 'add', title: '   ', duration: 10, energy: 'low', date: null, time: null },
      { type: 'add', title: 'Maratona', duration: 900, energy: 'high', date: null, time: null }
    ]);
    assertEqual(result.auto.map(entry => entry.value), [{ title: 'Comprare il pane', duration: 30, energy: 'medium', date: null, time: null }]);
    const none = plan([], [{ type: 'add', title: '', duration: 10, energy: 'low', date: null, time: null }]);
    assertEqual([none.auto, none.ask, none.say, none.modelSay], [[], [], A.TEXTS.failed, false], 'niente di valido: la frase di riserva');
  });

  test('assistente: azioni scartate dal server e nessuna azione rimasta → «Non ci sono riuscita»', () => {
    assertEqual(plan([], [], { extra: { say: 'Ho aggiunto «X».', dropped: 1 } }).say, A.TEXTS.failed);
    const asked = plan([], [], { extra: { say: 'Puoi ripetere?' } });
    assertEqual([asked.say, asked.modelSay], ['Puoi ripetere?', true], 'nessuna azione e niente scartato: la frase del modello');
  });

  /* ---------- Un'ora senza giorno, Siri, freni ---------- */

  test('assistente: un\'ora senza giorno la decide l\'app, come l\'aggiunta rapida', () => {
    const dentist = date => [{ type: 'add', title: 'Dentista', duration: 60, energy: 'medium', date, time: '15:00' }];
    const value = (date, nowAt) => {
      const result = plan([], dentist(date), { message: 'alle 3 dentista', at: nowAt });
      return [kinds(result.auto).concat(kinds(result.ask)).join(), (result.auto[0] || result.ask[0]).value.date];
    };
    assertEqual(value(null, NOW), ['add', TODAY], 'giorno vuoto: oggi');
    assertEqual(value(TODAY, NOW), ['add', TODAY], 'il modello mette oggi: vale la regola');
    assertEqual(value('2026-11-14', NOW), ['add:words', '2026-11-14'], 'il modello mette un altro giorno: chiede');
    // Alle 16 l'ora è passata: domani (vale per la dettatura di Siri come per un messaggio scritto).
    const late = plan([], dentist(TODAY), { message: 'alle 3 dentista', at: at(12, 16) });
    assertEqual([kinds(late.auto), late.auto[0].value.date], [['add'], TOMORROW]);
    const otherTime = plan([], [{ type: 'add', title: 'Dentista', duration: 60, energy: 'medium', date: null, time: '03:00' }], { message: 'alle 3 dentista' });
    assertEqual(kinds(otherTime.ask), ['add:words'], 'un\'ora diversa da quella delle regole: chiede');
  });

  test('assistente: per Siri «domani» si conta dalla dettatura; un giorno già passato chiede', () => {
    const add = date => [{ type: 'add', title: 'Dentista', duration: 30, energy: 'medium', date, time: '10:00' }];
    const lastNight = plan([], add(TODAY), { message: 'domani alle 10 dentista', at: at(11, 22) });
    assertEqual([kinds(lastNight.auto), lastNight.auto[0].value.date], [['add'], TODAY], 'dettata ieri sera: «domani» è oggi');
    const old = plan([], add('2026-11-11'), { message: 'domani alle 10 dentista', at: at(10, 20) });
    assertEqual(kinds(old.ask), ['add:past'], 'dettata due giorni fa: il giorno è passato, chiede');
  });

  test('assistente: freni — più di 3 azioni, stesso titolo nello stesso giorno, data passata', () => {
    const add = (title, date) => ({ type: 'add', title, duration: 15, energy: 'low', date, time: null });
    const four = plan([], [add('Uno', null), add('Due', null), add('Tre', null), add('Quattro', null)], { message: 'quattro cose' });
    assertEqual([four.auto.length, kinds(four.ask)], [0, ['add:many', 'add:many', 'add:many', 'add:many']]);
    const three = plan([], [add('Uno', null), add('Due', null), add('Tre', null)], { message: 'tre cose' });
    assertEqual(three.auto.length, 3, 'tre vanno ancora da sole');
    const existing = make({ title: 'Caffè con Anna', date: TOMORROW });
    const twin = plan([existing], [add('caffe con  anna', TOMORROW)], { message: 'domani caffè con Anna' });
    assertEqual(kinds(twin.ask), ['add:duplicate'], 'stesso titolo (senza accenti e maiuscole) nello stesso giorno');
    assertEqual(kinds(plan([existing], [add('Caffè con Anna', '2026-11-14')], { message: 'sabato caffè con Anna' }).auto), ['add'], 'un altro giorno va bene');
    assertEqual(kinds(plan([], [add('Doppia', null), add('Doppia', null)], { message: 'x' }).ask), ['add:duplicate'], 'doppione nella stessa risposta');
    assertEqual(kinds(plan([], [add('Ieri', '2026-11-11')]).ask), ['add:past']);
  });

  /* ---------- Correzioni ---------- */

  test('assistente: «no, facciamo alle 5» corregge da sola solo l\'attività appena aggiunta e non toccata', () => {
    const fields = { title: 'Chiamare il medico', duration: 10, energy: 'low', date: TOMORROW, time: '15:00' };
    const task = make({ id: 'med', ...fields });
    const memory = A.addExchange([], { said: 'domani alle 3 chiamare il medico', reply: 'Aggiunta', did: [{ type: 'add', taskId: 'med', after: fields }] }, at(12, 8, 57));
    const fix = [{ type: 'update', task: 't1', time: '17:00' }];
    const done = plan([task], fix, { message: 'no, facciamo alle 5', memory });
    assertEqual([kinds(done.auto), done.auto[0].correction, done.auto[0].value.date, done.auto[0].value.time], [['update'], true, TOMORROW, '17:00']);
    // Il modello mette anche oggi come giorno: l'utente non l'ha nominato, quindi resta domani.
    const withToday = plan([task], [{ type: 'update', task: 't1', date: TODAY, time: '17:00' }], { message: 'no, facciamo alle 5', memory });
    assertEqual([kinds(withToday.auto), withToday.auto[0].value.date], [['update'], TOMORROW]);
    const touched = plan([{ ...task, duration: 20 }], fix, { message: 'no, facciamo alle 5', memory });
    assertEqual(kinds(touched.ask), ['update'], 'toccata dall\'utente nel frattempo: chiede');
    assertEqual(kinds(plan([task], fix, { message: 'no, facciamo alle 5', memory, perms: { autoAdd: false, autoEdit: false } }).ask), ['update'], 'con «Aggiungere da solo» spento: chiede');
    const later = A.addExchange([], { said: 'x', reply: 'y', did: [{ type: 'add', taskId: 'med', after: fields }] }, at(12, 8, 45));
    assertEqual(kinds(plan([task], fix, { message: 'no, facciamo alle 5', memory: later }).ask), ['update'], 'più di 10 minuti fa: chiede');
    const other = make({ id: 'other', ...fields, title: 'Altra' });
    assertEqual(kinds(plan([other], fix, { message: 'no, facciamo alle 5', memory }).ask), ['update'], 'un\'attività che non ha aggiunto l\'assistente: chiede');
    // Seconda correzione di fila: vale l'ultimo stato lasciato dall'assistente.
    const moved = { ...fields, time: '17:00' };
    const twice = A.addExchange(memory, { said: 'no, alle 5', reply: 'Corretta', did: [{ type: 'update', taskId: 'med', after: moved }] }, at(12, 8, 58));
    assertEqual(kinds(plan([{ ...task, time: '17:00' }], [{ type: 'update', task: 't1', time: '18:00' }], { message: 'anzi alle 6', memory: twice }).auto), ['update']);
  });

  /* ---------- Correzioni senza nome: decide l'app, non il modello ---------- */

  // La lista delle misure con l'IA vera: il modello, invece dell'attività appena aggiunta, sposta spesso la riunione.
  const fieldsOf = ({ title, duration, energy, date, time }) => ({ title, duration, energy, date, time });
  const day = () => [
    make({ id: 'bol', title: 'Pagare la bolletta', duration: 15, energy: 'low', date: '2026-11-10' }),
    make({ id: 'riu', title: 'Riunione di lavoro', duration: 60, energy: 'high', date: TODAY, time: '09:00' }),
    make({ id: 'pal', title: 'Palestra', duration: 60, energy: 'high', date: TODAY, time: '18:00' }),
    make({ id: 'non', title: 'Chiamare la nonna', duration: 15, energy: 'low', date: TODAY }),
    make({ id: 'scr', title: 'Riordinare la scrivania' }),
    make({ id: 'mec', title: 'Portare la macchina dal meccanico', duration: 45, date: TOMORROW, time: '08:30' })
  ];
  const medico = () => make({ id: 'med', title: 'Chiamare il medico', duration: 20, energy: 'low', date: TOMORROW });
  const dentista = () => make({ id: 'den', title: 'Dentista', date: TODAY, time: '15:00' });
  const refFor = (tasks, id) => {
    const { refs } = A.buildRequest(tasks, { kind: 'message', message: '', now: NOW, context: CHOICE });
    return Object.keys(refs).find(ref => refs[ref] === id);
  };
  /** La memoria breve dopo un'aggiunta fatta dall'assistente tre minuti fa. */
  const afterAdd = (task, said) => A.addExchange([], { said, reply: A.recallDone({ type: 'add', title: task.title, after: fieldsOf(task) }, TODAY), did: [{ type: 'add', taskId: task.id, after: fieldsOf(task) }] }, at(12, 8, 57));
  /** Il modello risponde con una sola modifica sull'attività `id`; restituisce [dove finisce, automatica?, spostata dall'app?]. */
  function fix(tasks, id, change, options) {
    const result = plan(tasks, [{ type: 'update', task: refFor(tasks, id), ...change }], options);
    const entry = result.auto[0] || result.ask[0];
    return [result.auto.length + result.ask.length, entry.taskId, Boolean(result.auto.length), entry.redirected];
  }

  test('assistente: «no, facciamo alle 5» va all\'attività appena aggiunta, anche se il modello ne indica un\'altra', () => {
    const tasks = day().concat(medico());
    const memory = afterAdd(tasks[6], 'domani devo chiamare il medico');
    const wrong = plan(tasks, [{ type: 'update', task: refFor(tasks, 'riu'), time: '17:00' }], { message: 'no, facciamo alle 5', memory });
    assertEqual([wrong.ask, kinds(wrong.auto)], [[], ['update']], 'una sola azione, automatica');
    const entry = wrong.auto[0];
    assertEqual([entry.taskId, entry.redirected, entry.correction, entry.value.date, entry.value.time], ['med', true, true, TOMORROW, '17:00']);
    assertEqual(A.applyAuto(tasks, wrong.auto, { now: NOW }).tasks.find(task => task.id === 'riu').time, '09:00', 'la riunione non si muove');
    assertEqual(fix(tasks, 'med', { time: '17:00' }, { message: 'no, facciamo alle 5', memory }), [1, 'med', true, false], 'se il modello indica quella giusta non cambia niente');
    // Con «Cambiare da solo» acceso l'errore del modello veniva fatto: adesso no.
    assertEqual(fix(tasks, 'riu', { time: '17:00' }, { message: 'no, facciamo alle 5', memory, perms: { autoAdd: true, autoEdit: true } }), [1, 'med', true, true]);
    assertEqual(fix(tasks, 'riu', { time: '17:00' }, { message: 'no, facciamo alle 5', memory, perms: { autoAdd: false, autoEdit: false } }), [1, 'med', false, true], 'senza permessi: chiede, ma sull\'attività giusta');
    assertEqual(fix(tasks, 'riu', { time: '17:00' }, { message: 'facciamo verso le cinque', memory }), [1, 'med', true, true], 'l\'ora nuova scritta in lettere');
    // «Alle 5 e mezza»: l'ora nuova sono le 17:30 e non indica nessuna attività. Le regole di nlp.js leggono 17:00,
    // quindi scatta il freno e l'app chiede: ma sull'attività giusta.
    const half = plan(tasks, [{ type: 'update', task: refFor(tasks, 'riu'), time: '17:30' }], { message: 'no, facciamo alle 5 e mezza', memory });
    assertEqual([half.auto.length, kinds(half.ask), half.ask[0].taskId, half.ask[0].redirected, half.ask[0].value.time], [0, ['update:words'], 'med', true, '17:30']);
  });

  test('assistente: «anzi domani» va all\'attività appena aggiunta; il giorno nuovo non la indica', () => {
    const tasks = day().concat(dentista());
    const memory = afterAdd(tasks[6], 'alle 3 dentista');
    const wrong = plan(tasks, [{ type: 'update', task: refFor(tasks, 'riu'), date: TOMORROW }], { message: 'anzi domani', memory });
    assertEqual([kinds(wrong.auto), wrong.auto[0].taskId, wrong.auto[0].redirected, wrong.auto[0].value.date, wrong.auto[0].value.time], [['update'], 'den', true, TOMORROW, '15:00']);
    // Il modello indica un'attività che è già di domani: per lei non cambierebbe niente, ma la correzione va fatta lo stesso.
    assertEqual(fix(tasks, 'mec', { date: TOMORROW }, { message: 'anzi domani', memory }), [1, 'den', true, true]);
    assertEqual(fix(tasks, 'den', { date: TOMORROW }, { message: 'anzi domani', memory }), [1, 'den', true, false]);
  });

  test('assistente: se il messaggio indica l\'attività del modello (titolo, ora, giorno) resta la scelta del modello', () => {
    const tasks = day().concat(medico());
    const memory = afterAdd(tasks[6], 'domani devo chiamare il medico');
    assertEqual(fix(tasks, 'riu', { time: '17:00' }, { message: 'sposta quella delle 9 alle 5', memory }), [1, 'riu', false, false], '«quella delle 9»: la sua ora');
    assertEqual(fix(tasks, 'riu', { time: '17:00' }, { message: 'sposta la riunione alle 5', memory }), [1, 'riu', false, false], '«la riunione»: il suo titolo');
    assertEqual(fix(tasks, 'riu', { time: '17:00' }, { message: 'sposta le riunioni alle 17:00', memory }), [1, 'riu', false, false], 'anche al plurale');
    assertEqual(fix(tasks, 'pal', { time: '17:00' }, { message: 'sposta quella delle 6 alle 5', memory }), [1, 'pal', false, false], '«delle 6» sono anche le 18:00');
    assertEqual(fix(tasks, 'riu', { time: '17:00' }, { message: 'sposta quella delle nove alle cinque', memory }), [1, 'riu', false, false], 'ore scritte in lettere');
    assertEqual(fix(tasks, 'riu', { time: '09:30' }, { message: 'sposta quella delle 9 alle 9 e mezza', memory }), [1, 'riu', false, false], 'l\'ora nuova (9:30) non cancella «delle 9»');
    // «Quella di domani»: il giorno dell'attività del modello. Il lunedì è il giorno nuovo e non conta.
    const withDentist = day().concat(dentista());
    const dentistMemory = afterAdd(withDentist[6], 'alle 3 dentista');
    assertEqual(fix(withDentist, 'mec', { date: '2026-11-16' }, { message: 'sposta quella di domani a lunedì', memory: dentistMemory }), [1, 'mec', false, false]);
    assertEqual(fix(withDentist, 'riu', { date: '2026-11-16' }, { message: 'sposta quella di oggi a lunedì', memory: dentistMemory }), [1, 'riu', false, false], 'a parità di giorno resta il modello');
  });

  test('assistente: la correzione senza nome non scatta se l\'ultimo scambio non ha toccato una sola attività, o se il messaggio indica altro', () => {
    const tasks = day().concat(medico());
    const med = tasks[6];
    const memory = afterAdd(med, 'domani devo chiamare il medico');
    const said = { message: 'no, facciamo alle 5' };
    const stays = (list, options, why) => assertEqual(fix(list, 'riu', { time: '17:00' }, { ...said, ...options }), [1, 'riu', false, false], why);
    stays(tasks, {}, 'memoria breve vuota');
    const two = A.addExchange([], { said: 'x', reply: 'y', did: [{ type: 'add', taskId: 'med', after: fieldsOf(med) }, { type: 'ask', taskId: 'pal' }] }, at(12, 8, 57));
    stays(tasks, { memory: two }, 'l\'ultimo scambio ha toccato due attività');
    stays(tasks, { memory: A.addExchange(memory, { said: 'che tempo fa?', reply: 'Non lo so.', did: [] }, at(12, 8, 58)) }, 'l\'ultimo scambio non ha toccato niente');
    stays(tasks, { memory: A.addExchange([], { said: 'x', reply: 'y', did: [{ type: 'add', taskId: 'med', after: fieldsOf(med) }] }, at(12, 8, 45)) }, 'più di 10 minuti fa');
    stays(tasks.map(task => (task.id === 'med' ? { ...task, done: true, completedAt: NOW } : task)), { memory }, 'l\'attività dell\'ultimo scambio è già fatta');
    stays(tasks, { memory, message: 'sposta quella delle 7 alle 5' }, 'un\'ora che non è né dell\'una né dell\'altra');
    stays(tasks, { memory, message: 'sposta quella di ieri alle 5' }, 'un giorno che non è quello dell\'attività dell\'ultimo scambio');
    stays(tasks, { memory, message: 'sposta la palestra alle 5' }, 'il titolo di una terza attività');
    // Due modifiche nella stessa risposta: nessuna è «la» correzione.
    const both = plan(tasks, [{ type: 'update', task: refFor(tasks, 'riu'), time: '17:00' }, { type: 'update', task: refFor(tasks, 'pal'), time: '19:00' }], { ...said, memory });
    assertEqual(both.ask.map(entry => [entry.taskId, entry.redirected]), [['riu', false], ['pal', false]]);
    // Una parola che sta anche nel titolo dell'attività dell'ultimo scambio («chiamare») non indica la nonna.
    assertEqual(fix(tasks, 'riu', { time: '17:00' }, { memory, message: 'no, chiamalo alle 5' }), [1, 'med', true, true]);
    assertEqual(fix(tasks, 'non', { time: '17:00' }, { memory, message: 'no, chiamalo alle 5' }), [1, 'non', false, false], 'a parità resta la scelta del modello');
    assertEqual(fix(tasks, 'riu', { time: '17:00' }, { memory, message: 'no, alle 5: constructor toString' }), [1, 'med', true, true], 'parole strane non rompono niente');
    // L'ora e il giorno dell'attività dell'ultimo scambio la indicano: la correzione va lì.
    const timed = tasks.map(task => (task.id === 'med' ? { ...task, time: '15:00' } : task));
    assertEqual(fix(timed, 'riu', { time: '17:00' }, { memory: afterAdd(timed[6], 'domani alle 3 chiamare il medico'), message: 'sposta quella delle 3 alle 5' }), [1, 'med', true, true]);
    // Dopo una proposta («Ti propongo «Chiamare la nonna»»): la modifica va alla proposta, ma chiede, perché non l'ha aggiunta l'assistente.
    const proposed = A.addExchange([], { said: 'ho un quarto d\'ora', reply: 'Ti propongo «Chiamare la nonna».', did: [{ type: 'suggest', taskId: 'non' }] }, at(12, 8, 57));
    assertEqual(fix(tasks, 'riu', { time: '17:00' }, { memory: proposed, message: 'facciamo alle 5' }), [1, 'non', false, true]);
  });

  test('assistente: se il modello e le regole leggono un\'ora diversa, la domanda propone quella delle regole', () => {
    const tasks = day().concat(medico());
    const memory = afterAdd(tasks[6], 'domani devo chiamare il medico');
    /** Il modello mette `time` sull'attività `id`: restituisce [automatiche, domande, attività della domanda, ora proposta]. */
    const asked = (id, time, message, options) => {
      const result = plan(tasks, [{ type: 'update', task: refFor(tasks, id), time }], { message, memory, ...options });
      return [result.auto.length, kinds(result.ask), result.ask[0].taskId, result.ask[0].value.time];
    };
    // «Alle 6»: il modello scrive 06:00, le regole leggono 18:00. L'app chiede, e propone le 18:00.
    assertEqual(asked('med', '06:00', 'no, facciamo alle 6'), [0, ['update:words'], 'med', '18:00']);
    assertEqual(asked('riu', '06:00', 'no, facciamo alle 6'), [0, ['update:words'], 'med', '18:00'], 'anche quando il modello indica un\'altra attività');
    assertEqual(asked('med', '15:00', 'no, facciamo alle 5'), [0, ['update:words'], 'med', '17:00'], 'un\'altra ora del tutto: vale quella delle regole');
    assertEqual(asked('med', '06:00', 'no, facciamo alle 6', { perms: { autoAdd: true, autoEdit: true } }), [0, ['update:words'], 'med', '18:00'], 'resta una domanda con ogni permesso');
    // I minuti che le regole non leggono restano quelli del modello, nella metà del giorno delle regole.
    assertEqual(asked('med', '17:30', 'no, facciamo alle 5 e mezza'), [0, ['update:words'], 'med', '17:30']);
    assertEqual(asked('med', '05:30', 'no, facciamo alle 5 e mezza'), [0, ['update:words'], 'med', '17:30']);
    assertEqual(asked('med', '16:45', 'no, alle 5 meno un quarto'), [0, ['update:words'], 'med', '16:45']);
    assertEqual(asked('med', '04:45', 'no, alle 5 meno un quarto'), [0, ['update:words'], 'med', '16:45']);
    // Togliere l'ora non è un'ora letta in un altro modo: la domanda resta quella del modello.
    const removal = plan(tasks, [{ type: 'update', task: refFor(tasks, 'pal'), time: null }], { message: 'alle 6 togli l\'ora alla palestra' });
    assertEqual([kinds(removal.ask), removal.ask[0].taskId, removal.ask[0].value.time], [['update:words'], 'pal', null]);
    // Un'aggiunta: stessa regola, e senza un giorno detto il giorno segue l'ora delle regole (alle 9:00, le 18:00 sono di oggi).
    const add = time => plan([], [{ type: 'add', title: 'Dentista', duration: 30, energy: 'medium', date: null, time }], { message: 'alle 6 dentista' });
    assertEqual([add('06:00').auto.length, kinds(add('06:00').ask), add('06:00').ask[0].value.date, add('06:00').ask[0].value.time], [0, ['add:words'], TODAY, '18:00']);
    assertEqual([kinds(add(null).ask), add(null).ask[0].value.time], [['add:words'], '18:00'], 'il modello non ha letto l\'ora: vale quella delle regole');
    assertEqual(kinds(add('18:00').auto), ['add'], 'stessa ora per tutti e due: nessun freno');
  });

  test('assistente: una modifica che non cambia niente si ignora; il titolo non cambia mai', () => {
    const task = make({ id: 'p', title: 'Palestra', date: TODAY, time: '18:00' });
    const same = plan([task], [{ type: 'update', task: 't1', time: '18:00' }], { perms: { autoAdd: true, autoEdit: true } });
    assertEqual([same.auto, same.ask], [[], []]);
    assertEqual([same.say, same.modelSay], ['«Palestra» è già così.', false], 'lo dice l\'app, non la frase del modello («Ho spostato…»)');
    // «Alle 6» su un'attività che è già alle 18:00: il modello scrive 06:00, ma per le regole non c'è niente da cambiare.
    const already = plan([task], [{ type: 'update', task: 't1', time: '06:00' }], { message: 'facciamo alle 6', perms: { autoAdd: true, autoEdit: true } });
    assertEqual([already.auto, already.ask, already.say], [[], [], '«Palestra» è già così.']);
    const titled = plan([task], [{ type: 'update', task: 't1', title: 'Altro', duration: 45 }], { perms: { autoAdd: true, autoEdit: true } });
    assertEqual(titled.auto[0].value.title, 'Palestra');
    assertEqual(plan([task], [{ type: 'update', task: 't1', time: null }], { perms: { autoAdd: true, autoEdit: true } }).auto[0].value, { title: 'Palestra', duration: 30, energy: 'medium', date: TODAY, time: null }, 'togliere l\'ora');
  });

  /* ---------- Proposte ---------- */

  test('assistente: la proposta dell\'IA vale se è tra TUTTE le candidate delle regole, sempre con lo stesso esito', () => {
    const list = [make({ id: 'a', duration: 10 }), make({ id: 'b', duration: 20 }), make({ id: 'c', duration: 25 }), make({ id: 'd', duration: 30 }),
      make({ id: 'domani', date: TOMORROW }), make({ id: 'lunga', duration: 50 })];
    const suggestOf = ref => plan(list, [{ type: 'suggest', task: ref, reason: 'È breve', alternatives: [] }], { extra: { say: 'Ti propongo questa:' } });
    for (let i = 0; i < 10; i++) assertEqual(suggestOf('t4').proposal, { taskId: 'd', reason: 'È breve' }, 'anche fuori dalle prime tre');
    const lower = plan(list, [{ type: 'suggest', task: 't1', reason: 'è breve e ti sblocca', alternatives: [] }]);
    assertEqual(lower.proposal.reason, 'È breve e ti sblocca', 'il motivo del modello comincia con la maiuscola');
    const later = suggestOf('t6');
    assertEqual(later.proposal.taskId === 'domani', false, 'un\'attività di domani non si propone');
    assertEqual(later.say.startsWith('Ti propongo «'), true, 'la frase dice la proposta delle regole, non quella del modello');
    const long = suggestOf('t5');
    assertEqual(long.proposal.taskId === 'lunga', false, 'non sta nei 30 minuti');
    const said = plan(list, [{ type: 'suggest', task: 't5', reason: '', alternatives: [] }], { extra: { context: { minutes: 60, energy: null } } });
    assertEqual([said.proposal, said.context], [{ taskId: 'lunga', reason: null }, { use: { minutes: 60, energy: 'medium' }, save: { minutes: 60, energy: 'medium' } }],
      'con i minuti detti nel messaggio');
  });

  test('assistente: i minuti detti valgono così come sono; nelle preferenze la scelta più vicina per difetto', () => {
    assertEqual([A.chipFor(40), A.chipFor(5), A.chipFor(90), A.chipFor(119), A.chipFor(150)], [30, 10, 90, 90, null]);
    assertEqual(A.contextOf({ minutes: 40, energy: 'low' }, CHOICE), { use: { minutes: 40, energy: 'low' }, save: { minutes: 30, energy: 'low' } });
    assertEqual(A.contextOf({ minutes: null, energy: 'high' }, { minutes: null, energy: 'low' }), { use: { minutes: null, energy: 'high' }, save: { minutes: null, energy: 'high' } });
    assertEqual(A.contextOf(null, CHOICE), null);
  });

  /* ---------- Applicare e annullare ---------- */

  test('assistente: applica, registra e annulla finché l\'attività non è cambiata', () => {
    const gym = make({ id: 'p', title: 'Palestra', date: TODAY, time: '18:00' });
    const result = plan([gym], [
      { type: 'add', title: 'Chiamare il medico', duration: 10, energy: 'low', date: TOMORROW, time: null },
      { type: 'update', task: 't1', date: TOMORROW }
    ], { message: 'x', perms: { autoAdd: true, autoEdit: true } });
    const applied = A.applyAuto([gym], result.auto, { now: NOW, origin: 'text', said: 'x' });
    assertEqual(applied.tasks.length, 2);
    assertEqual(applied.log.map(entry => [entry.type, entry.title, entry.origin, entry.after.date]), [['add', 'Chiamare il medico', 'text', TOMORROW], ['update', 'Palestra', 'text', TOMORROW]]);
    assertEqual(applied.did.map(entry => entry.type), ['add', 'update']);
    assert(applied.log.every(entry => A.canUndo(applied.tasks, entry)));
    const undo = A.undoEntries(applied.tasks, applied.log);
    assertEqual([undo.tasks, undo.undone.length], [[gym], 2], 'tutto come prima');
    // Cambiata dall'utente dopo: non si annulla più (e nemmeno completata).
    const added = applied.tasks.find(task => task.title === 'Chiamare il medico');
    const changed = applied.tasks.map(task => (task === added ? { ...task, duration: 25 } : task));
    assertEqual(A.canUndo(changed, applied.log[0]), false);
    assertEqual(A.canUndo(applied.tasks.map(task => (task === added ? { ...task, done: true } : task)), applied.log[0]), false);
    assertEqual(A.canUndo(applied.tasks, { ...applied.log[0], undone: true }), false, 'già annullata');
    assertEqual(A.undoEntries(changed, applied.log).undone, [applied.log[1].id], 'si annulla solo ciò che si può');
  });

  test('assistente: l\'elenco tiene le ultime 50 azioni degli ultimi 30 giorni, la più recente in cima', () => {
    const entry = (id, ms) => ({ id, at: ms });
    let log = [];
    for (let i = 0; i < 60; i++) log = A.addToLog(log, [entry('e' + i, NOW - (60 - i) * 1000)], NOW);
    assertEqual([log.length, log[0].id, log[49].id], [50, 'e59', 'e10']);
    assertEqual(A.pruneLog([entry('vecchia', NOW - 31 * 86400000), entry('nuova', NOW)], NOW).map(item => item.id), ['nuova']);
    assertEqual(A.markUndone([{ id: 'x', undone: false }, { id: 'y', undone: false }], ['y']).map(item => item.undone), [false, true]);
  });

  /* ---------- Frasi scritte dall'app ---------- */

  test('assistente: le frasi delle azioni le scrive l\'app, dai dati veri', () => {
    const fields = { title: 'Palestra', duration: 60, energy: 'high', date: TODAY, time: '18:00' };
    const add = { type: 'add', title: 'Chiamare il medico', before: null, after: { title: 'Chiamare il medico', duration: 10, energy: 'low', date: TOMORROW, time: null } };
    assertEqual(A.describeDone(add, TODAY), 'Aggiunta: Chiamare il medico · Domani');
    assertEqual(A.describeDone({ type: 'correct', title: 'Chiamare il medico', before: add.after, after: { ...add.after, time: '17:00' } }, TODAY), 'Corretta: Chiamare il medico · Domani alle 17:00');
    assertEqual(A.describeDone({ type: 'update', title: 'Palestra', before: fields, after: { ...fields, duration: 45, energy: 'medium' } }, TODAY), 'Cambiata: Palestra · 45 min, energia media');
    assertEqual(A.summarizeDone([add], TODAY, 'text'), 'Aggiunta: Chiamare il medico · Domani');
    assertEqual(A.summarizeDone([{ ...add, title: 'Dentista', after: { ...add.after, time: '10:00' } }], TODAY, 'siri'), 'Da Siri: aggiunta «Dentista» · Domani alle 10:00');
    assertEqual(A.summarizeDone([add, add, add], TODAY, 'siri'), 'Da Siri: aggiunte 3 attività');
    assertEqual(A.summarizeDone([add, add, { type: 'update', title: 'Palestra', before: fields, after: { ...fields, date: TOMORROW } }], TODAY, 'text'), 'Aggiunte 2 attività e cambiata 1');
    const move = { kind: 'update', title: 'Palestra', before: fields, value: { ...fields, date: TOMORROW } };
    // Per la memoria breve le stesse azioni sono frasi intere, scritte come quelle del modello.
    const corrected = { type: 'correct', title: 'Chiamare il medico', before: add.after, after: { ...add.after, time: '17:00' } };
    const changed = { type: 'update', title: 'Palestra', before: fields, after: { ...fields, duration: 45, energy: 'medium' } };
    assertEqual(A.recallDone(add, TODAY), 'Ho aggiunto «Chiamare il medico» per domani.');
    assertEqual(A.recallDone({ ...add, after: { ...add.after, time: '15:00' } }, TODAY), 'Ho aggiunto «Chiamare il medico» per domani alle 15:00.');
    assertEqual(A.recallDone({ ...add, after: { ...add.after, date: null } }, TODAY), 'Ho aggiunto «Chiamare il medico».');
    assertEqual(A.recallDone(corrected, TODAY), 'Ho spostato «Chiamare il medico» a domani alle 17:00.');
    assertEqual(A.recallDone(changed, TODAY), 'Ho cambiato «Palestra»: 45 min, energia media.');
    assertEqual(A.recallDone({ ...changed, after: { ...fields, time: null } }, TODAY), 'Ho tolto l\'ora a «Palestra».');
    assertEqual(A.recallDone({ ...changed, after: { ...fields, date: null, time: null } }, TODAY), 'Ho tolto il giorno a «Palestra».');
    assertEqual(A.recallReply({ log: [add], ask: [move] }, TODAY), 'Ho aggiunto «Chiamare il medico» per domani. Sposto «Palestra» a domani alle 18:00?');
    assertEqual(A.recallReply({ say: ' Ti propongo «Palestra». ' }, TODAY), 'Ti propongo «Palestra».', 'senza azioni resta la frase');
    assertEqual(A.recallReply({}, TODAY), '');
    assertEqual([A.askText(move, TODAY), A.confirmLabel(move)], ['Sposto «Palestra» a domani alle 18:00?', 'Sposta']);
    assertEqual(A.askText({ ...move, value: { ...fields, time: null } }, TODAY), 'Tolgo l\'ora a «Palestra»?');
    assertEqual(A.askText({ ...move, value: { ...fields, duration: 45 } }, TODAY), 'Cambio «Palestra»: 45 min?');
    assertEqual([A.askText({ kind: 'complete', title: 'Fare la spesa' }), A.confirmLabel({ kind: 'complete' })], ['Segno «Fare la spesa» come fatta?', 'Fatto']);
    assertEqual([A.askText({ kind: 'delete', title: 'Riunione' }), A.confirmLabel({ kind: 'delete' })], ['Elimino «Riunione»?', 'Elimina']);
    assertEqual(A.askText({ kind: 'add', title: 'Dentista', value: { ...fields, title: 'Dentista', time: null }, brake: 'duplicate' }, TODAY), 'C\'è già «Dentista» · Oggi: la aggiungo lo stesso?');
    assertEqual(A.askText({ kind: 'add', title: 'Dentista', value: { ...fields, title: 'Dentista', date: '2026-11-11', time: null }, brake: 'past' }, TODAY), '«Dentista» sarebbe per ieri, che è passato: la aggiungo lo stesso?');
  });

  /* ---------- Proposta all'apertura ---------- */

  test('assistente: proposta all\'apertura riusata per 3 ore con la stessa lista e la stessa fascia; al massimo 8 al giorno', () => {
    const list = [make({ id: 'a' }), make({ id: 'b', date: TODAY })];
    const keyAt = (ms, tasks = list, context = CHOICE) => A.openKey(A.buildRequest(tasks, { kind: 'open', now: ms, context }).payload, ms);
    const key = keyAt(NOW);
    assertEqual(keyAt(at(12, 11, 30)), key, 'stessa mattina, stessa lista');
    assert(keyAt(at(12, 12, 30)) !== key, 'pomeriggio: un\'altra fascia');
    assert(keyAt(NOW, list.concat(make({}))) !== key, 'un\'attività in più');
    assert(keyAt(NOW, list, { minutes: 60, energy: 'medium' }) !== key, 'un\'altra scelta di tempo');
    const cache = { key, at: NOW, taskId: 'a', say: 'Per cominciare ti propongo:', reason: null };
    assertEqual([A.canReuseOpen(cache, key, NOW + 2 * 3600000), A.canReuseOpen(cache, key, NOW + 3 * 3600000), A.canReuseOpen(cache, 'altra', NOW), A.canReuseOpen(null, key, NOW)],
      [true, false, false, false]);
    let opens = null;
    for (let i = 0; i < 8; i++) {
      assert(A.openAllowed(opens, NOW), 'richiesta ' + (i + 1));
      opens = A.countOpen(opens, NOW);
    }
    assertEqual([A.openAllowed(opens, NOW), A.openAllowed(opens, at(13, 9))], [false, true], 'la nona no; domani si riparte');
    assertEqual([A.partOfDay(at(12, 4, 59)), A.partOfDay(at(12, 5)), A.partOfDay(at(12, 12)), A.partOfDay(at(12, 18))], ['evening', 'morning', 'afternoon', 'evening']);
  });
})();
