/*
 * Test della musica nel focus, senza account (js/music.js; P-004, passo 4.2): servizi, umori e link delle playlist,
 * quando si vede l'avviso e quando il carosello, i rimandi di «Quando te lo ricordo?», il servizio scelto, l'ultimo
 * umore per «🎧», le frasi della riga «Musica», le preferenze ripulite e il backup che non le contiene.
 */
(function () {
  'use strict';

  const { test, assert, assertEqual } = window.AuraTest;
  const { utils, music: MU, storage } = window.Aura;

  const TODAY = '2026-11-20';
  const day = offset => utils.addDays(TODAY, offset);
  const prefs = overrides => ({ service: null, remind: null, mood: 'lofi', folded: false, ...overrides });

  /* ---------- Servizi, umori e playlist ---------- */

  test('MUSIC: tre servizi più «Nessuno», cinque umori nell\'ordine della proposta', () => {
    assertEqual(MU.SERVICES.map(service => service.id), ['spotify', 'apple', 'amazon']);
    assertEqual(MU.SERVICES.map(service => service.label), ['Spotify', 'Apple Music', 'Amazon Music']);
    assertEqual(MU.NONE, 'none');
    assertEqual(MU.MOODS.map(mood => mood.label), ['Lo-fi', 'Piano', 'Ambient', 'Jazz', 'Natura']);
    MU.MOODS.forEach(mood => assert(mood.emoji && mood.emoji.length <= 4, 'emoji di ' + mood.id));
  });

  test('link: ogni servizio ha una playlist https per ogni umore, sul sito del servizio e senza parametri', () => {
    const sites = {
      spotify: /^https:\/\/open\.spotify\.com\/playlist\/[A-Za-z0-9]{22}$/,
      apple: /^https:\/\/music\.apple\.com\/it\/playlist\/[a-z0-9-]+\/pl\.[0-9a-f]{32}$/,
      amazon: /^https:\/\/music\.amazon\.com\/playlists\/B0[A-Z0-9]{8}$/
    };
    MU.SERVICES.forEach(service => {
      const urls = MU.MOODS.map(mood => MU.link(service.id, mood.id));
      urls.forEach((url, i) => assert(sites[service.id].test(url), service.id + ' ' + MU.MOODS[i].id + ': ' + url));
      assertEqual(new Set(urls).size, MU.MOODS.length, service.id + ': cinque playlist diverse');
    });
  });

  test('link: niente per «Nessuno», per un servizio o un umore sconosciuti e per i nomi dell\'oggetto', () => {
    assertEqual(MU.link('none', 'lofi'), null);
    assertEqual(MU.link('tidal', 'lofi'), null);
    assertEqual(MU.link('spotify', 'metal'), null);
    assertEqual(MU.link('toString', 'lofi'), null);
    assertEqual(MU.link('spotify', 'constructor'), null);
    assertEqual(MU.link(null, null), null);
  });

  /* ---------- Avviso e carosello ---------- */

  test('view: senza un servizio scelto e senza rimandi c\'è l\'avviso', () => {
    assertEqual(MU.view(prefs(), TODAY), 'notice');
    assertEqual(MU.view(undefined, TODAY), 'notice', 'preferenze mancanti');
  });

  test('view: un rimando nasconde l\'avviso fino al suo giorno, che lo rimostra', () => {
    assertEqual(MU.view(prefs({ remind: day(1) }), TODAY), null, 'domani');
    assertEqual(MU.view(prefs({ remind: day(30) }), TODAY), null, 'tra un mese');
    assertEqual(MU.view(prefs({ remind: TODAY }), TODAY), 'notice', 'il giorno del rimando');
    assertEqual(MU.view(prefs({ remind: day(-5) }), TODAY), 'notice', 'rimando passato');
  });

  test('view: «Non ricordarmelo più» e «Nessuno» non mostrano niente', () => {
    assertEqual(MU.view(prefs({ remind: 'never' }), TODAY), null);
    assertEqual(MU.view(prefs({ service: 'none' }), TODAY), null);
    assertEqual(MU.view(prefs({ service: 'none', remind: day(-1) }), TODAY), null);
  });

  test('view: con un servizio c\'è il carosello, aperto o ridotto; i rimandi non contano più', () => {
    ['spotify', 'apple', 'amazon'].forEach(service => {
      assertEqual(MU.view(prefs({ service }), TODAY), 'carousel', service);
      assertEqual(MU.view(prefs({ service, folded: true }), TODAY), 'folded', service + ' ridotto');
      assertEqual(MU.view(prefs({ service, remind: 'never' }), TODAY), 'carousel', service + ' dopo «mai più»');
    });
  });

  /* ---------- «Quando te lo ricordo?» ---------- */

  test('later: tra 3 giorni, una settimana, un mese (30 giorni) o mai più', () => {
    assertEqual(MU.LATER.map(option => option.id), ['3d', '1w', '1m', 'never']);
    assertEqual(MU.later(prefs(), '3d', TODAY).remind, '2026-11-23');
    assertEqual(MU.later(prefs(), '1w', TODAY).remind, '2026-11-27');
    assertEqual(MU.later(prefs(), '1m', TODAY).remind, '2026-12-20');
    assertEqual(MU.later(prefs(), 'never', TODAY).remind, 'never');
    assertEqual(MU.view(MU.later(prefs(), '3d', TODAY), day(2)), null, 'dopo 2 giorni ancora no');
    assertEqual(MU.view(MU.later(prefs(), '3d', TODAY), day(3)), 'notice', 'dopo 3 giorni sì');
  });

  test('later: oltre la fine del mese e dell\'anno, e una scelta sconosciuta che non cambia niente', () => {
    assertEqual(MU.later(prefs(), '1w', '2026-12-28').remind, '2027-01-04');
    assertEqual(MU.later(prefs(), '3d', '2027-02-27').remind, '2027-03-02');
    assertEqual(MU.later(prefs({ remind: day(2) }), 'domani', TODAY).remind, day(2));
    assertEqual(MU.LATER.every(option => option.message && option.label), true, 'testi di ogni scelta');
  });

  /* ---------- Servizio, umore e «🎧» ---------- */

  test('choose: un servizio o «Nessuno»; un valore sconosciuto lascia la scelta di prima', () => {
    assertEqual(MU.choose(prefs(), 'apple').service, 'apple');
    assertEqual(MU.choose(prefs({ service: 'apple' }), 'none').service, 'none');
    assertEqual(MU.choose(prefs({ service: 'apple' }), 'tidal').service, 'apple');
    assertEqual(MU.choose(prefs({ service: 'apple' }), null).service, 'apple');
  });

  test('remember e focusLink: «🎧» apre l\'ultimo umore sul servizio scelto, all\'inizio Lo-fi', () => {
    assertEqual(MU.focusLink(prefs()), null, 'senza servizio');
    assertEqual(MU.focusLink(prefs({ service: 'none' })), null, 'Nessuno');
    const first = MU.focusLink(prefs({ service: 'spotify' }));
    assertEqual(first.url, MU.link('spotify', 'lofi'));
    assertEqual(first.name, 'Musica: Lo-fi nell\'app Spotify');
    const jazz = MU.remember(prefs({ service: 'amazon' }), 'jazz');
    assertEqual(jazz.mood, 'jazz');
    assertEqual(MU.focusLink(jazz).url, MU.link('amazon', 'jazz'));
    assertEqual(MU.remember(jazz, 'metal').mood, 'jazz', 'umore sconosciuto');
  });

  test('cards: cinque card con link, emoji e un nome che contiene il testo che si vede', () => {
    assertEqual(MU.cards(prefs()), [], 'senza servizio');
    assertEqual(MU.cards(prefs({ service: 'none' })), [], 'Nessuno');
    const cards = MU.cards(prefs({ service: 'apple' }));
    assertEqual(cards.map(card => card.id), ['lofi', 'piano', 'ambient', 'jazz', 'nature']);
    cards.forEach(card => {
      assertEqual(card.url, MU.link('apple', card.id));
      assertEqual(card.service, 'Apple Music');
      assert(card.name.includes(card.label) && card.name.includes('Apple Music'), card.name);
    });
    assertEqual(cards[0].name, 'Lo-fi, Apple Music: apri la playlist nell\'app Musica');
  });

  test('stateLabel: che cosa dice la riga «Musica» delle Impostazioni', () => {
    assertEqual(MU.stateLabel(prefs()), 'Da scegliere: le playlist si aprono nell\'app del servizio');
    assertEqual(MU.stateLabel(prefs({ service: 'spotify' })), 'Spotify: le playlist si aprono nell\'app Spotify');
    assertEqual(MU.stateLabel(prefs({ service: 'apple' })), 'Apple Music: le playlist si aprono nell\'app Musica');
    assertEqual(MU.stateLabel(prefs({ service: 'amazon' })), 'Amazon Music: le playlist si aprono nell\'app Amazon Music');
    assertEqual(MU.stateLabel(prefs({ service: 'none' })), 'Nessuno: niente musica in Focus');
  });

  /* ---------- Preferenze ripulite, fuori dal backup ---------- */

  test('sanitize: valori di partenza, valori non validi ripuliti, campi sconosciuti conservati', () => {
    assertEqual(MU.sanitize(null), prefs());
    assertEqual(MU.sanitize([]), prefs());
    assertEqual(MU.sanitize('spotify'), prefs());
    const dirty = MU.sanitize({ service: 'tidal', remind: '2026-02-30', mood: 'metal', folded: 'sì', extra: 1 });
    assertEqual(dirty, { service: null, remind: null, mood: 'lofi', folded: false, extra: 1 });
    assertEqual(MU.sanitize({ remind: 12345 }).remind, null, 'rimando non in formato data');
    const clean = { service: 'amazon', remind: 'never', mood: 'nature', folded: true };
    assertEqual(MU.sanitize(clean), clean);
    assertEqual(MU.sanitize({ service: 'none', remind: day(3) }).remind, day(3));
  });

  test('storage.sanitizePrefs: le preferenze della musica passano da Aura.music.sanitize', () => {
    assertEqual(storage.sanitizePrefs(null).music, prefs(), 'di partenza');
    assertEqual(storage.sanitizePrefs({ music: { service: 'spotify', mood: 'jazz' } }).music, prefs({ service: 'spotify', mood: 'jazz' }));
    assertEqual(storage.sanitizePrefs({ music: 'spotify' }).music, prefs(), 'non un oggetto');
  });

  test('savePrefs e loadPrefs: la scelta resta su questo telefono, in aura-tasks:prefs', () => {
    const items = new Map();
    const area = { getItem: key => (items.has(key) ? items.get(key) : null), setItem: (key, value) => items.set(key, String(value)) };
    const music = { service: 'apple', remind: 'never', mood: 'piano', folded: true };
    assert(storage.savePrefs({ ...storage.sanitizePrefs(null), music }, area), 'salvate');
    assertEqual([...items.keys()], ['aura-tasks:prefs']);
    assertEqual(storage.loadPrefs(area).music, music);
  });

  test('backup: il file non contiene le preferenze della musica', () => {
    const state = storage.load(null).state;
    const text = storage.backupFile(state, new Date(2026, 10, 20, 10, 30)).text;
    assert(!/music|spotify|apple|amazon|remind/i.test(text), 'nel backup: ' + text.slice(0, 200));
  });
})();
