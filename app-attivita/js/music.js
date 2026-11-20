/*
 * Aura Tasks — musica nel focus, senza account (P-004, passo 4.2; specifica in docs/musica.md): logica pura.
 * Il servizio scelto nelle Impostazioni (riga «Musica»), l'avviso in Focus con i suoi rimandi, il carosello degli umori e
 * il link della playlist di ogni umore. Tutto sta nelle preferenze di questo telefono (aura-tasks:prefs.music), fuori dal
 * backup. Niente DOM, niente localStorage, niente rete: i link si aprono come link normali (js/ui-music.js).
 */
(function (Aura) {
  'use strict';

  const { utils } = Aura;

  // I servizi: il nome e l'app in cui si apre la playlist. «Nessuno» (NONE) vuol dire niente musica in Focus.
  const SERVICES = [
    { id: 'spotify', label: 'Spotify', app: 'nell\'app Spotify' },
    { id: 'apple', label: 'Apple Music', app: 'nell\'app Musica' },
    { id: 'amazon', label: 'Amazon Music', app: 'nell\'app Amazon Music' }
  ];
  const NONE = 'none';

  // Gli umori del carosello, in quest'ordine. Le card le disegna Aura (colore ed emoji): nessuna copertina presa da fuori.
  const MOODS = [
    { id: 'lofi', label: 'Lo-fi', emoji: '🎧' },
    { id: 'piano', label: 'Piano', emoji: '🎹' },
    { id: 'ambient', label: 'Ambient', emoji: '🌌' },
    { id: 'jazz', label: 'Jazz', emoji: '🎷' },
    { id: 'nature', label: 'Natura', emoji: '🌿' }
  ];

  /*
   * Le playlist: pubbliche, curate dai servizi stessi (non da utenti), controllate il 20 novembre 2026. Si aprono nell'app
   * del servizio, che le suona con l'account di chi ascolta. Se un link smette di funzionare, si cambia questo elenco.
   */
  const PLAYLISTS = {
    spotify: {
      lofi: 'https://open.spotify.com/playlist/37i9dQZF1DWWQRwui0ExPn',    // lofi beats
      piano: 'https://open.spotify.com/playlist/37i9dQZF1DX4sWSpwq3LiO',   // Peaceful Piano
      ambient: 'https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ', // Deep Focus
      jazz: 'https://open.spotify.com/playlist/37i9dQZF1DX0SM0LYsmbMT',    // Jazz Vibes
      nature: 'https://open.spotify.com/playlist/37i9dQZF1DX4PP3DA4J0N8'   // Nature Sounds
    },
    apple: {
      lofi: 'https://music.apple.com/it/playlist/lo-fi-chill/pl.1d5ead185d8a4a9089f3b952770b762c',
      piano: 'https://music.apple.com/it/playlist/piano-chill/pl.cb4d1c09a2df4230a78d0395fe1f8fde',
      ambient: 'https://music.apple.com/it/playlist/pure-focus/pl.dbd712beded846dca273d5d3259d28aa',
      jazz: 'https://music.apple.com/it/playlist/jazz-chill/pl.63271312c084419891982eab46cc68ac',
      nature: 'https://music.apple.com/it/playlist/nature-sounds/pl.040f99fdd83542a79b28fc4c13f773bd'
    },
    amazon: {
      lofi: 'https://music.amazon.com/playlists/B07M7FZKWQ',    // Lo-Fi Hip-Hop
      piano: 'https://music.amazon.com/playlists/B00KMI3FN4',   // Relaxing Piano
      ambient: 'https://music.amazon.com/playlists/B079VSKYMS', // Ultimate Ambient
      jazz: 'https://music.amazon.com/playlists/B07J26S6YT',    // Chill Contemporary Jazz
      nature: 'https://music.amazon.com/playlists/B00ZVV35VE'   // Nature Sounds for Focus
    }
  };

  // «Quando te lo ricordo?»: dopo quanti giorni l'avviso torna, oppure mai più. `message` è l'avviso in basso.
  const LATER = [
    { id: '3d', days: 3, label: 'Tra 3 giorni', message: 'Va bene: te lo ricordo tra 3 giorni.' },
    { id: '1w', days: 7, label: 'Tra una settimana', message: 'Va bene: te lo ricordo tra una settimana.' },
    { id: '1m', days: 30, label: 'Tra un mese', message: 'Va bene: te lo ricordo tra un mese.' },
    { id: 'never', days: null, label: 'Non ricordarmelo più', message: 'Va bene: non te lo ricordo più. La musica resta nelle Impostazioni.' }
  ];
  const NEVER = 'never';

  const serviceOf = id => SERVICES.find(service => service.id === id) || null;
  const moodOf = id => MOODS.find(mood => mood.id === id) || null;
  const laterOf = id => LATER.find(choice => choice.id === id) || null;
  const isChoice = id => id === NONE || serviceOf(id) !== null;

  /**
   * Le preferenze della musica, ripulite:
   * - service: 'spotify', 'apple', 'amazon', 'none' («Nessuno»), oppure null se non è ancora stato scelto;
   * - remind: il giorno da cui l'avviso torna ('AAAA-MM-GG'), 'never', oppure null (nessun rimando);
   * - mood: l'ultimo umore aperto, per il pulsante «🎧» del focus a tutto schermo ('lofi' all'inizio);
   * - folded: true se il carosello è ridotto a una riga («Nascondi»).
   * I campi sconosciuti restano, come nelle altre preferenze.
   */
  function sanitize(raw) {
    const base = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const clean = {
      service: isChoice(base.service) ? base.service : null,
      remind: base.remind === NEVER || utils.isISODate(base.remind) ? base.remind : null,
      mood: moodOf(base.mood) ? base.mood : MOODS[0].id,
      folded: base.folded === true
    };
    // Prima i campi conosciuti, sempre nello stesso ordine; poi gli altri, come erano
    Object.keys(base).forEach(key => { if (!(key in clean)) clean[key] = base[key]; });
    return clean;
  }

  /**
   * Che cosa mostra la scheda Focus sotto «Cosa faccio adesso?», con le preferenze `music` e il giorno `today`:
   * - 'notice', l'avviso: nessun servizio scelto e nessun rimando, oppure il giorno del rimando è arrivato;
   * - 'carousel', il carosello aperto, oppure 'folded', ridotto a una riga, quando c'è un servizio;
   * - null, niente: «Nessuno», «Non ricordarmelo più», o un rimando non ancora scaduto.
   */
  function view(music, today) {
    const m = sanitize(music);
    if (serviceOf(m.service)) return m.folded ? 'folded' : 'carousel';
    if (m.service === NONE || m.remind === NEVER) return null;
    if (m.remind && today < m.remind) return null;
    return 'notice';
  }

  /** «Quando te lo ricordo?»: le preferenze con il rimando scelto (`choice`: '3d', '1w', '1m' o 'never'). */
  function later(music, choice, today) {
    const m = sanitize(music);
    const option = laterOf(choice);
    if (!option) return m;
    return { ...m, remind: option.days === null ? NEVER : utils.addDays(today, option.days) };
  }

  /** Il servizio scelto nella riga «Musica» (anche «Nessuno»). Un valore sconosciuto lascia tutto com'era. */
  function choose(music, service) {
    const m = sanitize(music);
    return isChoice(service) ? { ...m, service } : m;
  }

  /** L'ultimo umore aperto: lo apre il pulsante «🎧» del focus a tutto schermo. */
  function remember(music, mood) {
    const m = sanitize(music);
    return moodOf(mood) ? { ...m, mood } : m;
  }

  /** Il link della playlist di un umore per un servizio; null per «Nessuno» o per valori sconosciuti. */
  function link(service, mood) {
    const list = Object.prototype.hasOwnProperty.call(PLAYLISTS, service) ? PLAYLISTS[service] : null;
    return list && Object.prototype.hasOwnProperty.call(list, mood) ? list[mood] : null;
  }

  /**
   * Le card del carosello per il servizio scelto: { id, label, emoji, url, name }. `name` è il nome per il lettore di
   * schermo, con il testo che si vede (umore e servizio). Vuoto senza un servizio.
   */
  function cards(music) {
    const m = sanitize(music);
    const service = serviceOf(m.service);
    if (!service) return [];
    return MOODS.map(mood => ({
      id: mood.id,
      label: mood.label,
      emoji: mood.emoji,
      service: service.label,
      url: link(service.id, mood.id),
      name: mood.label + ', ' + service.label + ': apri la playlist ' + service.app
    }));
  }

  /** Il pulsante «🎧» del focus a tutto schermo: la playlist dell'ultimo umore aperto, oppure null senza un servizio. */
  function focusLink(music) {
    const m = sanitize(music);
    const service = serviceOf(m.service);
    if (!service) return null;
    const mood = moodOf(m.mood);
    return { url: link(service.id, mood.id), name: 'Musica: ' + mood.label + ' ' + service.app };
  }

  /** Che cosa dice la riga «Musica» delle Impostazioni. */
  function stateLabel(music) {
    const m = sanitize(music);
    const service = serviceOf(m.service);
    if (service) return service.label + ': le playlist si aprono ' + service.app;
    if (m.service === NONE) return 'Nessuno: niente musica in Focus';
    return 'Da scegliere: le playlist si aprono nell\'app del servizio';
  }

  Aura.music = { SERVICES, MOODS, PLAYLISTS, LATER, NONE, NEVER, sanitize, view, later, choose, remember, link, cards, focusLink, stateLabel, laterOf };
})(window.Aura = window.Aura || {});
