/*
 * Aura Tasks — «Suoni del focus» (P-004, passo 4.4; vedi docs/suoni.md): il pulsante «Suono» del focus a tutto schermo, con
 * il menu dei suoni che hai, e l'audio che li suona. Il suono in uso è look.sound (js/shop.js): suona quando il focus conta
 * il tempo, e si ferma in pausa, a tempo finito, all'uscita e quando Aura va in secondo piano. Nel negozio (js/ui-shop.js)
 * un tocco su un suono lo fa ascoltare per qualche secondo. I suoni li calcola js/sound.js; l'AudioContext è quello del
 * focus (js/ui-focus.js), che lo crea e lo sblocca dentro un tocco, come vuole l'iPhone. Tocca la pagina come app.js, che
 * con init() gli passa quello che serve.
 */
(function (Aura) {
  'use strict';

  const { shop: SH, sound: S } = Aura;

  const byId = id => document.getElementById(id);
  // Tempi in secondi: il suono entra piano e se ne va più in fretta; tra due suoni, una dissolvenza incrociata.
  const FADE = { in: 1.6, out: 0.6, swap: 0.8, now: 0.03 };
  const START_DELAY_MS = 380; // all'apertura (o alla ripresa) il suono parte quando il foglio è fermo
  const PREVIEW = { ms: 4200, in: 0.25, out: 0.9 }; // l'ascolto di prova: nel negozio, e nel menu con il focus fermo
  const CACHE_MAX = 2;        // pezzi calcolati tenuti in memoria (1–2 MB l'uno)
  const WAVES = { ahead: 10, everyMs: 1500, foamHz: 2500, q: -3 }; // onde programmate per i prossimi 10 s
  const SESSION_RESET_MS = 2000; // dopo l'ultimo suono l'audio torna com'era (il suono di fine, insieme a Spotify)
  // Ritocchi dopo la normalizzazione: così i tre suoni si sentono forti uguali, circa −22 LUFS (le onde −23 in media, con le
  // creste più forti), un po' sotto il suono di fine (vedi docs/suoni.md, «Volume»).
  const VOLUME = { brown: 0.54, rain: 0.39, waves: 1.35 };

  let ctx = null;
  const els = {};
  const pieces = new Map(); // pezzo ('brown', 'rain', 'sea') → AudioBuffer, il più recente in fondo
  const loading = new Map(); // pezzo → Promise dell'AudioBuffer, mentre si calcola
  let worker = null;        // il lavoratore dei calcoli (js/sound-worker.js); false se non c'è o non parte
  const jobs = new Map();   // calcoli chiesti al lavoratore: id → { done, here }
  let lastJob = 0;
  let voice = null;         // quello che suona: { value, preview, gain, sources, timer, stopping }
  let running = false;      // il focus conta il tempo (lo dice js/ui-focus.js)
  let startTimer = 0;
  let previewTimer = 0;
  let sessionTimer = 0;
  let previewDone = null;   // chi aspetta la fine dell'ascolto di prova (il riquadro del negozio che si anima)
  let shownOptions = '';

  const seed = () => (Date.now() % 1000003) + 1;

  /**
   * Il suono in uso (look.sound). Uno che questa versione non conosce (comprato con una più nuova: resta nei dati) qui vale
   * silenzio.
   */
  function currentValue() {
    const look = ctx.getState().look;
    const value = look && look.sound;
    return SH.SHOP.looks.sound.some(item => item.value === value) ? value : SH.defaultLook().sound;
  }

  /* ---------- Audio ---------- */

  /**
   * Il tipo di sessione audio dell'iPhone (Audio Session API, Safari 16.4 e successivi): con un suono, «playback», che si
   * sente anche con il silenzioso e ferma la musica delle altre app, come fa ogni app che suona; senza, «auto», com'era
   * prima (il suono di fine si mescola alla musica e il silenzioso lo zittisce). Dove non c'è, non fa niente.
   */
  function setSession(type) {
    clearTimeout(sessionTimer);
    sessionTimer = 0;
    try {
      if (navigator.audioSession && navigator.audioSession.type !== type) navigator.audioSession.type = type;
    } catch (err) {
      // Non permesso: resta il tipo di prima.
    }
  }

  function resetSessionLater() {
    clearTimeout(sessionTimer);
    sessionTimer = setTimeout(() => {
      sessionTimer = 0;
      if (!voice) setSession('auto');
    }, SESSION_RESET_MS);
  }

  /* ---------- I pezzi: calcolati fuori dal thread principale, poi tenuti ---------- */

  /**
   * Calcola qui, quando la pagina ha già disegnato: serve solo se il lavoratore non c'è (per esempio aprendo index.html
   * come file). Così il tocco che fa partire il suono non aspetta i calcoli.
   */
  function computeHere(name, rate, value) {
    return new Promise(resolve => {
      requestAnimationFrame(() => setTimeout(() => {
        let channels = null;
        try {
          channels = S.piece(name, rate, value);
        } catch (err) {
          channels = null;
        }
        resolve(channels);
      }, 0));
    });
  }

  /** Il lavoratore dei calcoli, creato la prima volta che serve; null se non c'è o non parte. */
  function getWorker() {
    if (worker === null) {
      try {
        worker = new Worker('js/sound-worker.js');
        worker.addEventListener('message', event => {
          const job = jobs.get(event.data && event.data.id);
          if (!job) return;
          jobs.delete(event.data.id);
          if (event.data.channels) job.done(event.data.channels);
          else job.here();
        });
        // Non parte (file mancante, file:, memoria): da qui in poi si calcola nella pagina, anche quello che aspettava.
        worker.addEventListener('error', () => {
          worker = false;
          const waiting = Array.from(jobs.values());
          jobs.clear();
          waiting.forEach(job => job.here());
        });
      } catch (err) {
        worker = false;
      }
    }
    return worker || null;
  }

  /**
   * I canali del pezzo `name` (vedi Aura.sound.piece): calcolati nel lavoratore (js/sound-worker.js), che li passa senza
   * copiarli, così l'aurora non si ferma (la pioggia costa 60–90 ms, il triplo su un telefono lento). Promise, poi null se
   * il calcolo non riesce.
   */
  function compute(name, rate, value) {
    const w = getWorker();
    if (!w) return computeHere(name, rate, value);
    return new Promise(resolve => {
      const id = ++lastJob;
      jobs.set(id, { done: resolve, here: () => computeHere(name, rate, value).then(resolve) });
      w.postMessage({ id, name, rate, seed: value });
    });
  }

  /**
   * Il pezzo `name` pronto da suonare (un AudioBuffer), oppure null: calcolato la prima volta, poi tenuto (al massimo
   * CACHE_MAX). Mentre si calcola, chi lo chiede di nuovo aspetta lo stesso calcolo.
   */
  function loadPiece(audio, name) {
    const ready = pieces.get(name);
    if (ready) {
      pieces.delete(name);
      pieces.set(name, ready); // il più recente in fondo
      return Promise.resolve(ready);
    }
    if (loading.has(name)) return loading.get(name);
    // Metà della frequenza dell'audio (24 kHz su iPhone): basta per questi suoni e costa la metà.
    const rate = audio.sampleRate >= 44100 ? Math.round(audio.sampleRate / 2) : audio.sampleRate;
    const promise = compute(name, rate, seed()).then(channels => {
      loading.delete(name);
      if (!channels) return null;
      const buffer = audio.createBuffer(channels.length, channels[0].length, rate);
      channels.forEach((data, index) => buffer.getChannelData(index).set(data));
      pieces.set(name, buffer);
      while (pieces.size > CACHE_MAX) pieces.delete(pieces.keys().next().value);
      return buffer;
    }).catch(() => {
      loading.delete(name);
      return null;
    });
    loading.set(name, promise);
    return promise;
  }

  const pieceOf = value => (value === 'waves' ? 'sea' : value);

  /** Un pezzo che si ripete, da un punto a caso: ogni volta un po' diverso. */
  function loopSource(audio, buffer) {
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.start(0, Math.random() * buffer.duration);
    return source;
  }

  /** Rumore marrone e pioggia: il pezzo che si ripete, direttamente nel volume del suono. */
  function buildLoop(audio, v, buffer) {
    const source = loopSource(audio, buffer);
    source.connect(v.gain);
    v.sources.push(source);
  }

  /**
   * Onde: il mare (un pezzo che si ripete) passa in un filtro che si apre sulla cresta e in un volume che sale e scende,
   * più la sua parte alta, la schiuma, con un volume suo. Le onde si programmano sull'orologio dell'audio con le curve di
   * js/sound.js, sempre diverse, per i prossimi 10 secondi; un controllo ogni 1,5 s aggiunge le successive.
   */
  function buildWaves(audio, v, buffer) {
    const { wave } = S.SOUND;
    const source = loopSource(audio, buffer);
    const body = audio.createBiquadFilter();
    body.type = 'lowpass';
    body.Q.value = WAVES.q; // in dB per questo filtro: −3 dB è un filtro senza picco
    const swell = audio.createGain();
    const crest = audio.createBiquadFilter();
    crest.type = 'highpass';
    crest.frequency.value = WAVES.foamHz;
    const foam = audio.createGain();
    source.connect(body);
    body.connect(swell);
    swell.connect(v.gain);
    source.connect(crest);
    crest.connect(foam);
    foam.connect(v.gain);
    const start = audio.currentTime;
    swell.gain.setValueAtTime(wave.floor, start);
    body.frequency.setValueAtTime(wave.low, start);
    foam.gain.setValueAtTime(0, start);
    v.sources.push(source);

    const rng = S.random(seed());
    let until = start + 0.05; // fine dell'ultima onda programmata
    let first = v.preview;    // nell'ascolto di prova la prima onda arriva subito
    const schedule = () => {
      if (v.stopping) return;
      const now = audio.currentTime;
      if (until < now) until = now + 0.05; // la pagina era ferma: si riparte da adesso, dal mare calmo
      try {
        while (until < now + WAVES.ahead) {
          const next = S.nextWave(until, rng, { first });
          first = false;
          const curves = S.waveCurves(next);
          swell.gain.setValueCurveAtTime(curves.gain, next.start, next.duration);
          body.frequency.setValueCurveAtTime(curves.cutoff, next.start, next.duration);
          foam.gain.setValueCurveAtTime(curves.foam, next.start, next.duration);
          until = next.start + next.duration;
        }
      } catch (err) {
        until = now + WAVES.ahead; // un programma rifiutato: resta il mare calmo, e si riprova più avanti
      }
    };
    schedule();
    v.timer = setInterval(schedule, WAVES.everyMs);
  }

  /**
   * Fa partire `value` (non 'none'): la voce c'è subito, e suona, con la sua dissolvenza in entrata, appena il pezzo è
   * pronto (subito, se è già in memoria). Restituisce la voce, oppure null.
   */
  function startVoice(value, preview) {
    const audio = ctx.getAudio();
    if (!audio || value === 'none') return null;
    setSession('playback');
    let v;
    try {
      v = { value, preview, gain: audio.createGain(), sources: [], timer: 0, stopping: false };
      v.gain.gain.value = 0;
      v.gain.connect(audio.destination);
    } catch (err) {
      resetSessionLater();
      return null; // niente suono: il focus va avanti lo stesso
    }
    loadPiece(audio, pieceOf(value)).then(buffer => {
      if (v.stopping) return; // fermata mentre si calcolava
      try {
        if (!buffer) throw new Error('pezzo mancante');
        const now = audio.currentTime;
        v.gain.gain.setValueAtTime(0, now);
        v.gain.gain.linearRampToValueAtTime(VOLUME[value] || 1, now + (preview ? PREVIEW.in : FADE.in));
        if (value === 'waves') buildWaves(audio, v, buffer);
        else buildLoop(audio, v, buffer);
      } catch (err) {
        // Niente suono: la voce se ne va, e l'ascolto di prova finisce (le barrette del negozio si fermano).
        const wasPreview = voice === v && v.preview;
        stopVoice(v, FADE.now);
        if (wasPreview) endPreview();
      }
    });
    return v;
  }

  /** Ferma una voce con una dissolvenza di `fade` secondi, poi la stacca. */
  function stopVoice(v, fade) {
    if (!v || v.stopping) return;
    v.stopping = true;
    clearInterval(v.timer);
    if (voice === v) voice = null;
    const audio = ctx.getAudio();
    try {
      const now = audio.currentTime;
      const param = v.gain.gain;
      if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
      else {
        param.cancelScheduledValues(now);
        param.setValueAtTime(param.value, now);
      }
      param.linearRampToValueAtTime(0, now + fade);
      v.sources.forEach(source => source.stop(now + fade + 0.05));
    } catch (err) {
      v.sources.forEach(source => { try { source.stop(); } catch (e) { /* già fermo */ } });
    }
    // Staccato comunque, anche se l'orologio dell'audio è fermo (iPhone in secondo piano): così non riparte da solo.
    setTimeout(() => v.gain.disconnect(), (fade + 0.15) * 1000);
    resetSessionLater();
  }

  /** Passa a `value`: dissolvenza incrociata da quello che suona; 'none' ferma e basta. */
  function play(value, preview) {
    if (voice && voice.value === value && voice.preview === preview && !preview) return;
    if (voice) stopVoice(voice, preview ? FADE.out : FADE.swap);
    voice = value === 'none' ? null : startVoice(value, preview);
  }

  /** Ferma tutto: con la dissolvenza, oppure subito (`now`), per esempio quando Aura va in secondo piano. */
  function stopAll(now) {
    clearTimeout(startTimer);
    startTimer = 0;
    endPreview();
    if (voice) stopVoice(voice, now ? FADE.now : FADE.out);
  }

  /* ---------- Il focus: suona quando conta il tempo ---------- */

  /**
   * Suona quello che serve adesso: il suono in uso mentre il focus conta il tempo, altrimenti niente (un ascolto di prova
   * finisce da solo). Partendo dal silenzio aspetta che il foglio sia fermo, salvo `immediate` (una scelta nel menu).
   */
  function apply(immediate = false) {
    const want = running ? currentValue() : 'none';
    if (want === 'none') {
      clearTimeout(startTimer);
      startTimer = 0;
      if (voice && !voice.preview) stopVoice(voice, FADE.out);
      return;
    }
    if (voice && voice.value === want && !voice.preview) return;
    if (!ctx.getAudio()) {
      // Audio non ancora sbloccato: si riprova al primo tocco (onAudioUnlocked). Se non c'è proprio, la sessione torna com'era.
      resetSessionLater();
      return;
    }
    endPreview();
    if (voice || immediate) {
      clearTimeout(startTimer);
      startTimer = 0;
      play(want, false);
      return;
    }
    if (startTimer) return;
    loadPiece(ctx.getAudio(), pieceOf(want)); // intanto il pezzo si calcola
    startTimer = setTimeout(() => {
      startTimer = 0;
      if (running && currentValue() === want && !voice) play(want, false);
    }, START_DELAY_MS);
  }

  /** Lo chiama js/ui-focus.js ogni volta che decide se il focus conta il tempo (pagina visibile, non in pausa né finito). */
  function sync(isRunning) {
    running = isRunning;
    if (!running && document.hidden) {
      stopAll(true);
      return;
    }
    apply();
  }

  /**
   * Prima di sbloccare l'audio dentro un tocco: se il focus conta il tempo con un suono in uso, la sessione «playback» va
   * scelta prima di suonare. Gli altri tocchi del focus («Pausa», «Esci») non la toccano: poco dopo l'ultimo suono torna
   * «auto» (resetSessionLater).
   */
  function beforeAudio() {
    if (running && currentValue() !== 'none') setSession('playback');
  }

  /* ---------- Ascolto di prova ---------- */

  function endPreview() {
    clearTimeout(previewTimer);
    previewTimer = 0;
    const done = previewDone;
    previewDone = null;
    if (done) done();
  }

  /**
   * Fa ascoltare `value` per qualche secondo (nel negozio, o nel menu a focus fermo); 'none' ferma l'ascolto. Va chiamata
   * dentro un tocco: sblocca l'audio. `onEnd` arriva quando l'ascolto finisce o viene interrotto. true se suona.
   */
  function preview(value, onEnd) {
    endPreview();
    if (value === 'none') {
      if (voice && voice.preview) stopVoice(voice, FADE.out);
      return false;
    }
    setSession('playback');
    ctx.unlockAudio();
    play(value, true);
    if (!voice) {
      resetSessionLater(); // niente audio (un browser senza Web Audio): la sessione torna com'era
      return false;
    }
    previewDone = onEnd || null;
    const own = voice;
    previewTimer = setTimeout(() => {
      previewTimer = 0;
      const done = previewDone;
      previewDone = null;
      if (voice === own) stopVoice(own, PREVIEW.out);
      if (done) done();
    }, PREVIEW.ms);
    return true;
  }

  /** Ferma l'ascolto di prova (il foglio del negozio si chiude). */
  function stopPreview() {
    if (voice && voice.preview) stopVoice(voice, FADE.out);
    endPreview();
  }

  /* ---------- Il pulsante «Suono» e il suo menu ---------- */

  /**
   * Le scelte del menu: i suoni che hai (Silenzio e Rumore marrone sono di tutti), con la spunta su `current`, quello che
   * suona (Silenzio anche per un suono che questa versione non conosce). Ridisegnate solo se cambiano.
   */
  function renderOptions(items, current) {
    const owned = items.filter(item => item.owned);
    const key = owned.map(item => item.value).join(',');
    if (key !== shownOptions) {
      shownOptions = key;
      els.options.replaceChildren(...owned.map(item => {
        const label = document.createElement('label');
        label.className = 'sound-option';
        const input = document.createElement('input');
        input.className = 'sound-option__input';
        input.type = 'radio';
        input.name = 'focus-sound';
        input.value = item.value;
        const name = document.createElement('span');
        name.className = 'sound-option__name';
        name.textContent = item.name;
        const check = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        check.setAttribute('class', 'icon sound-option__check');
        check.setAttribute('aria-hidden', 'true');
        check.setAttribute('focusable', 'false');
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', '#i-check');
        check.append(use);
        label.append(input, name, check);
        return label;
      }));
    }
    els.options.querySelectorAll('.sound-option').forEach(label => {
      const input = label.querySelector('input');
      const checked = input.value === current;
      if (input.checked !== checked) input.checked = checked;
      label.classList.toggle('is-checked', checked);
    });
    const note = S.shopNote(items.filter(item => !item.owned).map(item => item.name));
    els.note.hidden = !note;
    if (els.note.textContent !== note) els.note.textContent = note;
  }

  /** Pulsante e menu secondo il suono in uso e quelli che hai. La chiama render() di app.js, a ogni modifica. */
  function render() {
    const items = SH.catalog(ctx.getState()).sound;
    const current = items.find(item => item.inUse) || items[0];
    const icon = current.value === 'none' ? '#i-sound-off' : '#i-sound';
    if (els.icon.getAttribute('href') !== icon) els.icon.setAttribute('href', icon);
    const label = S.buttonLabel(current);
    if (els.button.getAttribute('aria-label') !== label) els.button.setAttribute('aria-label', label);
    els.button.classList.toggle('is-on', current.value !== 'none');
    renderOptions(items, current.value);
  }

  function isMenuOpen() {
    return !els.menu.hidden;
  }

  function openMenu() {
    if (isMenuOpen()) return;
    els.menu.hidden = false;
    els.button.setAttribute('aria-expanded', 'true');
    const checked = els.options.querySelector('input:checked') || els.options.querySelector('input');
    if (checked) checked.focus({ preventScroll: true });
  }

  /** Chiude il menu; con `restore` il focus torna sul pulsante (Esc, o il pulsante stesso). true se era aperto. */
  function closeMenu(restore = true) {
    if (!isMenuOpen()) return false;
    const inside = els.menu.contains(document.activeElement);
    els.menu.hidden = true;
    els.button.setAttribute('aria-expanded', 'false');
    if (restore && inside) els.button.focus({ preventScroll: true });
    return true;
  }

  /**
   * Una scelta nel menu: diventa il suono in uso (look.sound, con il colore e i coriandoli). Con il focus che conta il
   * tempo suona subito, al posto di quello di prima; in pausa o a tempo finito si ascolta per qualche secondo.
   */
  function choose(value) {
    const state = ctx.getState();
    const look = SH.use(state.look, state.stats, 'sound', value, Date.now());
    if (!look) return;
    if (value !== 'none') setSession('playback'); // prima di sbloccare l'audio, dentro il tocco
    ctx.unlockAudio();
    if (look !== state.look && !ctx.commitState({ look })) return;
    if (running) apply(true);
    else preview(value);
  }

  /* ---------- Avvio ---------- */

  function init(context) {
    ctx = context;
    Object.assign(els, {
      sheet: byId('focus-sheet'),
      wrap: byId('focus-sound'),
      button: byId('focus-sound-btn'),
      icon: byId('focus-sound-icon'),
      menu: byId('focus-sound-menu'),
      options: byId('focus-sound-options'),
      note: byId('focus-sound-note')
    });

    els.button.addEventListener('click', () => {
      if (isMenuOpen()) closeMenu();
      else openMenu();
    });
    els.options.addEventListener('change', event => {
      if (event.target.name === 'focus-sound') choose(event.target.value);
    });
    // Un tocco fuori dal menu lo chiude (senza spostare il focus); il menu si chiude anche con il foglio.
    els.sheet.addEventListener('pointerdown', event => {
      if (isMenuOpen() && !els.wrap.contains(event.target)) closeMenu(false);
    });
    els.sheet.addEventListener('close', () => closeMenu(false));
    // In secondo piano l'iPhone ferma l'audio: qui si ferma tutto subito, anche l'ascolto di prova del negozio.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopAll(true);
    });
    render();
    return { render, sync, beforeAudio, refresh: () => apply(), closeMenu, preview, stopPreview };
  }

  Aura.soundUI = { init };
})(window.Aura = window.Aura || {});
