/*
 * Test di js/claude.js (P-006, passo 6.2): il codice per collegare Claude, quanto vale ancora, le righe dei
 * collegamenti e il riconoscimento di quello nuovo. "Adesso" è fisso: venerdì 27/11/2026 alle 15:30 (ora locale).
 */
(function () {
  'use strict';

  const { test, assert, assertEqual } = window.AuraTest;
  const { claude: C } = window.Aura;

  const at = (month, day, h, m) => new Date(2026, month - 1, day, h, m || 0).getTime();
  const NOW = at(11, 27, 15, 30);
  const MINUTE = 60 * 1000;

  test('claude: il codice si mostra in due gruppi da quattro, e il lettore di schermo lo legge un carattere alla volta', () => {
    assertEqual(C.groupCode('K7PM4QRT'), 'K7PM-4QRT');
    assertEqual(C.spellCode('K7PM4QRT'), 'K 7 P M, 4 Q R T');
    assert(C.isPairCode('23456789'));
    // Solo l'alfabeto del server: niente 0, O, 1, I, L, niente minuscole, sempre 8 caratteri
    ['K7PM4QR', 'K7PM4QRTX', 'K7PM-QRT', 'k7pm4qrt', 'K0PM4QRT', 'KOPM4QRT', 'K1PM4QRT', 'KIPM4QRT', 'KLPM4QRT', '', null, 12345678]
      .forEach(value => {
        assert(!C.isPairCode(value), String(value));
        assertEqual(C.groupCode(value), '', String(value));
        assertEqual(C.spellCode(value), '', String(value));
      });
  });

  test('claude: quanto vale ancora il codice, con l\'orologio del telefono', () => {
    const deadline = C.codeDeadline(NOW + 10 * MINUTE, NOW);
    assertEqual(deadline, NOW + 10 * MINUTE);
    assertEqual(C.timeLeft(deadline, NOW), 'Vale ancora 10 minuti');
    assertEqual(C.timeLeft(deadline, NOW + 30 * 1000), 'Vale ancora 10 minuti', 'si conta per eccesso');
    assertEqual(C.timeLeft(deadline, NOW + 8 * MINUTE + 1), 'Vale ancora 2 minuti');
    assertEqual(C.timeLeft(deadline, NOW + 9 * MINUTE), 'Vale ancora 1 minuto');
    assertEqual(C.timeLeft(deadline, NOW + 9 * MINUTE + 1), 'Vale meno di un minuto');
    assertEqual(C.timeLeft(deadline, NOW + 10 * MINUTE), null, 'scaduto');
    assertEqual(C.timeLeft(deadline, NOW + 11 * MINUTE), null);
    // Il telefono indietro di 5 minuti: il codice non sembra mai valere più di 10 minuti
    assertEqual(C.codeDeadline(NOW + 15 * MINUTE, NOW), NOW + 10 * MINUTE);
    // Il telefono avanti di 3 minuti: ne restano 7 sul suo orologio
    assertEqual(C.codeDeadline(NOW + 7 * MINUTE, NOW), NOW + 7 * MINUTE);
    // Una scadenza già passata o che non è un numero: vale zero
    assertEqual(C.codeDeadline(NOW - MINUTE, NOW), NOW);
    assertEqual(C.codeDeadline('domani', NOW), NOW);
    assertEqual(C.timeLeft(C.codeDeadline(undefined, NOW), NOW), null);
  });

  test('claude: lo stato del server ripulito, dal collegamento più vecchio', () => {
    assertEqual(C.readStatus({ links: [], code: null }), { links: [], code: null });
    assertEqual(C.readStatus({
      links: [
        { createdAt: at(11, 25, 9), usedAt: null },
        { createdAt: at(11, 23, 10), usedAt: at(11, 27, 15, 2) },
        { createdAt: 'ieri' },
        null,
        { createdAt: at(11, 26, 8), usedAt: 'mai' }
      ],
      code: { expiresAt: NOW + 5 * MINUTE }
    }), {
      links: [
        { createdAt: at(11, 23, 10), usedAt: at(11, 27, 15, 2) },
        { createdAt: at(11, 25, 9), usedAt: null },
        { createdAt: at(11, 26, 8), usedAt: null }
      ],
      code: { expiresAt: NOW + 5 * MINUTE }
    });
    assertEqual(C.readStatus({ links: [], code: { expiresAt: 'presto' } }).code, null);
    assertEqual(C.readStatus(null), null);
    assertEqual(C.readStatus({ error: 'Non autorizzato' }), null);
    assertEqual(C.readStatus({ links: 'tanti' }), null);
  });

  test('claude: un collegamento nuovo si riconosce dalla data, anche quando il server toglie il più vecchio', () => {
    const one = { createdAt: at(11, 20, 9), usedAt: null };
    const two = { createdAt: at(11, 22, 9), usedAt: at(11, 26, 9) };
    const three = { createdAt: at(11, 24, 9), usedAt: null };
    const fresh = { createdAt: NOW, usedAt: null };
    assert(C.hasNewLink([], [fresh]), 'il primo');
    assert(!C.hasNewLink([one], [one]), 'niente di nuovo');
    assert(!C.hasNewLink([one, two], [{ ...two, usedAt: NOW }]), 'uno usato o tolto non è nuovo');
    assert(C.hasNewLink([one, two, three], [two, three, fresh]), 'il quarto prende il posto del primo: restano 3');
    assert(!C.hasNewLink([one], []), 'scollegato da un\'altra parte');
    assert(C.hasNewLink(null, [fresh]));
  });

  test('claude: senza i collegamenti di prima, quello nuovo si riconosce perché è nato dopo il codice', () => {
    // Il server dà il codice alle 15:20 (scade alle 15:30): le date sono tutte sul suo orologio
    const issuedAt = C.codeIssuedAt(at(11, 27, 15, 30));
    assertEqual(issuedAt, at(11, 27, 15, 20));
    assertEqual(C.codeIssuedAt('presto'), null);
    assertEqual(C.codeIssuedAt(undefined), null);
    const old = { createdAt: at(11, 23, 10), usedAt: at(11, 27, 9) };
    const justBefore = { createdAt: issuedAt - 1, usedAt: null };
    const fresh = { createdAt: at(11, 27, 15, 21), usedAt: null };
    assert(C.linkedSince([old, fresh], issuedAt), 'collegato dopo il codice: è quello nuovo');
    assert(C.linkedSince([{ createdAt: issuedAt, usedAt: null }], issuedAt), 'nello stesso istante conta');
    assert(!C.linkedSince([old, justBefore], issuedAt), 'tutti di prima del codice: niente di nuovo');
    assert(!C.linkedSince([], issuedAt));
    assert(!C.linkedSince(null, issuedAt));
    assert(!C.linkedSince([fresh], null), 'senza la data del codice non si può dire');
  });

  test('claude: una riga per collegamento, con le date', () => {
    assertEqual(C.linkLine({ createdAt: at(11, 23, 10), usedAt: at(11, 27, 15, 2) }, NOW), 'Collegato dal 23 novembre · ultimo uso oggi alle 15:02');
    assertEqual(C.linkLine({ createdAt: at(11, 23, 10), usedAt: at(11, 26, 21, 5) }, NOW), 'Collegato dal 23 novembre · ultimo uso ieri alle 21:05');
    assertEqual(C.linkLine({ createdAt: at(11, 23, 10), usedAt: null }, NOW), 'Collegato dal 23 novembre · non ancora usato');
    assertEqual(C.linkLine({ createdAt: at(11, 27, 10, 15), usedAt: null }, NOW), 'Collegato oggi alle 10:15 · non ancora usato');
    // Un altro anno: con l'anno
    assertEqual(C.linkLine({ createdAt: new Date(2025, 11, 30, 9).getTime(), usedAt: null }, NOW), 'Collegato dal 30 dicembre 2025 · non ancora usato');
    const usedLongAgo = C.linkLine({ createdAt: at(11, 2, 9), usedAt: at(11, 10, 8, 5) }, NOW);
    assert(/^Collegato dal 2 novembre · ultimo uso mar 10 nov alle 08:05$/.test(usedLongAgo), usedLongAgo);
  });

  test('claude: l\'indirizzo del connettore è quello del server più /mcp, senza la barra finale', () => {
    assertEqual(C.connectorUrl('https://aura.auramirionick.workers.dev'), 'https://aura.auramirionick.workers.dev/mcp');
    assertEqual(C.connectorUrl('http://localhost:8787/'), 'http://localhost:8787/mcp');
  });
})();
