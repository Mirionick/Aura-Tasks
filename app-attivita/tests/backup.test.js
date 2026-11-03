/*
 * Test del backup (js/storage.js): file da esportare, lettura con gli stessi controlli dei dati salvati,
 * copia dei dati di prima di un'importazione e ripristino. La copia usa un archivio finto, non il localStorage.
 */
(function () {
  'use strict';

  const { test, assert, assertEqual } = window.AuraTest;
  const { points: P, storage } = window.Aura;

  const NOW = new Date(2026, 10, 3, 10, 30).getTime(); // martedì 3/11/2026 alle 10:30

  function task(overrides) {
    return {
      id: 't', title: 'Prova', duration: 30, energy: 'medium', date: null, time: null,
      done: false, createdAt: 1, completedAt: null, pointsAwarded: null,
      ...overrides
    };
  }

  function sampleState() {
    return {
      version: storage.SCHEMA_VERSION,
      tasks: [
        task({ id: 'a', title: 'Dentista', date: '2026-11-04', time: '10:00' }),
        task({ id: 'b', title: 'Spesa', done: true, completedAt: NOW - 3600e3, pointsAwarded: 24, extra: 'campo sconosciuto' })
      ],
      stats: { totalPoints: 24, bestStreak: 1, milestones: [], days: { '2026-11-03': { done: 1, points: 24 } } },
      future: { x: 1 }
    };
  }

  // Testo di un file di backup con questi dati (ed eventuali campi in più accanto a "data").
  const wrap = (data, extra) => JSON.stringify({ format: storage.BACKUP_FORMAT, exportedAt: NOW, data, ...extra });

  /** Archivio finto con i metodi del localStorage. Le chiavi in `full` rifiutano la scrittura, come a memoria piena. */
  function fakeArea(initial, full) {
    const items = new Map(Object.entries(initial || {}));
    const refuse = new Set(full || []);
    return {
      items,
      getItem: key => (items.has(key) ? items.get(key) : null),
      setItem: (key, value) => {
        if (refuse.has(key)) throw new Error('QuotaExceededError');
        items.set(key, String(value));
      },
      removeItem: key => { items.delete(key); }
    };
  }

  /* ---------- File di backup ---------- */

  test('backupFile: nome con il giorno locale, anche subito dopo mezzanotte', () => {
    assertEqual(storage.backupFile(sampleState(), NOW).name, 'aura-tasks-backup-2026-11-03.json');
    assertEqual(storage.backupFile(sampleState(), new Date(2026, 10, 4, 0, 15)).name, 'aura-tasks-backup-2026-11-04.json');
  });

  test('backupFile: solo formato, momento e dati (tutto lo stato, nient\'altro)', () => {
    const state = sampleState();
    const file = JSON.parse(storage.backupFile(state, NOW).text);
    assertEqual(Object.keys(file), ['format', 'exportedAt', 'data']);
    assertEqual([file.format, file.exportedAt], ['aura-tasks-backup', NOW]);
    assertEqual(file.data, state, 'attività, registro e campi sconosciuti');
  });

  test('readBackup: andata e ritorno identici, con il momento dell\'esportazione', () => {
    const state = sampleState();
    const result = storage.readBackup(storage.backupFile(state, NOW).text);
    assertEqual([result.error, result.exportedAt], [null, NOW]);
    assertEqual(result.state, state);
  });

  test('readBackup: file illeggibili o non di Aura → errore e nessun dato', () => {
    ['{rotto', '', 'null', '[]', '"testo"', JSON.stringify({ tasks: [] }), JSON.stringify({ format: 'altro', data: { tasks: [] } }),
      wrap({ version: 3 }), JSON.stringify({ format: 'aura-tasks-backup' })].forEach(text => {
      const result = storage.readBackup(text);
      assert(result.state === null && typeof result.error === 'string' && result.error.length > 0, 'errore per ' + text);
    });
    assertEqual(storage.readBackup('{rotto').error, 'Questo file non si può leggere: scegli un backup di Aura (un file .json).');
    assertEqual(storage.readBackup(JSON.stringify({ tasks: [] })).error, 'Questo file non è un backup di Aura.', 'dati senza formato');
    assertEqual(storage.readBackup(wrap({ version: 3 })).error, 'Il backup è danneggiato: mancano le attività.');
  });

  test('readBackup: gli stessi controlli dei dati salvati', () => {
    const dirty = {
      version: 3,
      tasks: [
        { id: 'a', title: '  Ok  ', duration: 9999, energy: 'boh', date: '2026-02-30', time: '10:00', done: false, createdAt: 1 },
        { id: 'a', title: 'Doppio', duration: 15, energy: 'low', date: null, time: '10:00', done: false, createdAt: 2 },
        { id: 'c', title: '' },
        'non un oggetto'
      ],
      stats: { totalPoints: -1, bestStreak: 'x', milestones: [3, 3], days: { ieri: { done: 1, points: 5 }, '2026-11-02': { done: 1, points: 13 } } }
    };
    const fromFile = storage.readBackup(wrap(dirty)).state;
    const fromArchive = storage.parse(JSON.stringify(dirty));
    assertEqual(fromFile.tasks.length, 2, 'scartate quelle senza titolo');
    const first = fromFile.tasks[0];
    assertEqual([first.title, first.duration, first.energy, first.date, first.time], ['Ok', 30, 'medium', null, null]);
    assert(fromFile.tasks[1].id !== 'a', 'id doppio sostituito');
    assertEqual(fromFile.tasks[1].time, null, 'ora senza giorno tolta');
    assertEqual([fromFile.stats.totalPoints, Object.keys(fromFile.stats.days), fromFile.stats.milestones], [13, ['2026-11-02'], [3]]);
    // Uguale alla lettura dall'archivio (tranne l'id nuovo del doppione, che è casuale).
    assertEqual({ ...fromFile, tasks: fromFile.tasks.slice(0, 1) }, { ...fromArchive, tasks: fromArchive.tasks.slice(0, 1) });
  });

  test('readBackup: un backup della v1 arriva all\'ultima versione, con punti e registro', () => {
    const at = (day, hour) => new Date(2026, 9, day, hour).getTime();
    const v1 = {
      version: 1,
      tasks: [
        { id: 'a', title: 'Spesa', duration: 30, energy: 'medium', date: null, done: true, createdAt: 1, completedAt: at(27, 18) },
        { id: 'b', title: 'Palestra', duration: 60, energy: 'high', date: null, done: true, createdAt: 1, completedAt: at(28, 9) },
        { id: 'c', title: 'Email', duration: 15, energy: 'low', date: null, done: false, createdAt: 1, completedAt: null }
      ]
    };
    const { state } = storage.readBackup(wrap(v1));
    assertEqual(state.version, storage.SCHEMA_VERSION);
    assertEqual(state.tasks.map(t => [t.pointsAwarded, t.time]), [[24, null], [44, null], [null, null]]);
    assertEqual([state.stats.totalPoints, state.stats.bestStreak], [68, 2]);
  });

  test('readBackup: versione più nuova e campi sconosciuti restano; quelli accanto a "data" no', () => {
    const newer = { version: 9, future: 'ok', tasks: [task({ id: 'a', extra: 1 })], stats: { ...P.emptyStats(), level: 3 } };
    const { state } = storage.readBackup(wrap(newer, { code: 'codice-finto-di-prova', remote: { code: 'codice-finto' } }));
    assertEqual([state.version, state.future, state.tasks[0].extra, state.stats.level], [9, 'ok', 1, 3]);
    assert(!('code' in state) && !('remote' in state), 'i campi accanto a "data" vengono ignorati');
  });

  test('readBackup: accetta il BOM che alcuni editor aggiungono', () => {
    const result = storage.readBackup('﻿' + storage.backupFile(sampleState(), NOW).text);
    assertEqual([result.error, result.state.tasks.length], [null, 2]);
  });

  /* ---------- Importazione: copia dei dati di prima e ripristino ---------- */

  test('replaceData: prima la copia dei dati di adesso, poi i dati nuovi', () => {
    const current = sampleState();
    const next = { ...storage.emptyState(), tasks: [task({ id: 'n', title: 'Nuova' })] };
    const area = fakeArea({ [storage.KEY]: storage.serialize(current) });
    assertEqual(storage.replaceData(current, next, NOW, area), 'ok');
    assertEqual(storage.parse(area.getItem(storage.KEY)), next, 'dati nuovi salvati');
    const copy = storage.loadBeforeImport(area);
    assertEqual([copy.savedAt, copy.state], [NOW, current], 'copia dei dati di prima, con il momento della copia');
  });

  test('replaceData: la copia è una sola e ogni importazione la sovrascrive', () => {
    const first = sampleState();
    const second = { ...storage.emptyState(), tasks: [task({ id: 'x', title: 'Seconda' })] };
    const area = fakeArea();
    storage.replaceData(first, second, NOW, area);
    storage.replaceData(second, storage.emptyState(), NOW + 1000, area);
    const copy = storage.loadBeforeImport(area);
    assertEqual([copy.state, copy.savedAt], [second, NOW + 1000]);
    assertEqual(Array.from(area.items.keys()).sort(), [storage.BEFORE_IMPORT_KEY, storage.KEY].sort());
  });

  test('replaceData: senza spazio per la copia non importa nulla', () => {
    const current = sampleState();
    const oldCopy = JSON.stringify(storage.backupData(storage.emptyState(), NOW - 1000));
    const area = fakeArea({ [storage.KEY]: storage.serialize(current), [storage.BEFORE_IMPORT_KEY]: oldCopy }, [storage.BEFORE_IMPORT_KEY]);
    assertEqual(storage.replaceData(current, storage.emptyState(), NOW, area), 'no-copy');
    assertEqual([area.getItem(storage.KEY), area.getItem(storage.BEFORE_IMPORT_KEY)], [storage.serialize(current), oldCopy],
      'dati e copia precedente intatti');
  });

  test('replaceData: senza spazio per i dati nuovi, dati e copia precedente tornano com\'erano', () => {
    const current = sampleState();
    const oldCopy = JSON.stringify(storage.backupData(storage.emptyState(), NOW - 1000));
    const withCopy = fakeArea({ [storage.KEY]: storage.serialize(current), [storage.BEFORE_IMPORT_KEY]: oldCopy }, [storage.KEY]);
    assertEqual(storage.replaceData(current, storage.emptyState(), NOW, withCopy), 'no-space');
    assertEqual([withCopy.getItem(storage.KEY), withCopy.getItem(storage.BEFORE_IMPORT_KEY)], [storage.serialize(current), oldCopy]);
    const withoutCopy = fakeArea({ [storage.KEY]: storage.serialize(current) }, [storage.KEY]);
    assertEqual(storage.replaceData(current, storage.emptyState(), NOW, withoutCopy), 'no-space');
    assertEqual(withoutCopy.getItem(storage.BEFORE_IMPORT_KEY), null, 'nessuna copia, se prima non c\'era');
  });

  test('loadBeforeImport: niente copia, copia illeggibile, copia ripulita dai controlli', () => {
    assertEqual(storage.loadBeforeImport(fakeArea()), null);
    assertEqual(storage.loadBeforeImport(fakeArea({ [storage.BEFORE_IMPORT_KEY]: '{rotto' })), null);
    const dirty = wrap({ version: 3, tasks: [{ id: 'a', title: '  Spesa ', duration: 0, energy: 'medium' }] });
    const copy = storage.loadBeforeImport(fakeArea({ [storage.BEFORE_IMPORT_KEY]: dirty }));
    assertEqual([copy.savedAt, copy.state.tasks[0].title, copy.state.tasks[0].duration], [NOW, 'Spesa', 30]);
  });

  test('restoreBeforeImport: rimette i dati e cancella la copia; se non c\'è spazio, la copia resta', () => {
    const before = sampleState();
    const area = fakeArea();
    storage.replaceData(before, storage.emptyState(), NOW, area);
    assert(storage.restoreBeforeImport(storage.loadBeforeImport(area).state, area), 'ripristinata');
    assertEqual([storage.parse(area.getItem(storage.KEY)), area.getItem(storage.BEFORE_IMPORT_KEY)], [before, null]);
    const full = fakeArea({ [storage.BEFORE_IMPORT_KEY]: 'copia' }, [storage.KEY]);
    assert(!storage.restoreBeforeImport(before, full), 'memoria piena');
    assertEqual(full.getItem(storage.BEFORE_IMPORT_KEY), 'copia');
  });
})();
