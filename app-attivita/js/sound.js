/*
 * Aura Tasks — «Suoni del focus» (P-004, passo 4.4; vedi docs/suoni.md).
 * Solo funzioni pure: i tre suoni fatti da Aura, calcolati come numeri, senza file audio, senza diritti da pagare e senza
 * rete. Rumore marrone e pioggia sono un pezzo di qualche secondo che si ripete senza scatti; le onde sono un fruscio che
 * sale e scende con un programma sempre diverso (nextWave e waveCurves). Niente DOM e niente Web Audio: suonarli e il
 * pulsante «Suono» stanno in js/ui-sound.js; prezzi, acquisti e il suono in uso (look.sound) in js/shop.js.
 */
(function (Aura) {
  'use strict';

  const SOUND = {
    // Quanto dura il pezzo che si ripete (s); la giunta sfuma in `seam` secondi; `warm` secondi iniziali si buttano, perché
    // i filtri partono da fermi.
    loop: { brown: 9, rain: 7, waves: 6 },
    seam: 0.4,
    warm: 0.1,
    // Volume medio (RMS) dei pezzi e picco massimo: tutti alla stessa altezza. Quanto forte si sentono lo decidono poi i
    // ritocchi di js/ui-sound.js (VOLUME), misurati con la pesatura K (vedi docs/suoni.md).
    rms: 0.12,
    peak: 0.9,
    // Pioggia: gocce al secondo, in media; quanto dura una goccia (s); centro (Hz) e larghezza (Q) dei filtri del fruscio
    // e del corpo; da dove partono le gocce (Hz).
    rain: { drops: 140, decay: [0.002, 0.012], hiss: [2500, 0.4], body: [650, 0.6], tick: 1800 },
    // Onde: quanto salgono e quanto si ritirano (s), quanto mare calmo tra due onde (s), quanto sono forti (0–1), il volume
    // e il filtro del mare calmo, il filtro sul punto più alto (Hz) e quanta schiuma resta dopo che l'onda si è frangiata.
    wave: { rise: [2.6, 4.2], fall: [3.4, 5.6], gap: [0.3, 1.6], level: [0.55, 1], floor: 0.3, low: 500, high: [1500, 3000], foam: 0.55, points: 96 }
  };

  const between = (rng, [min, max]) => min + (max - min) * rng();

  /** Numeri casuali ripetibili (mulberry32), tra 0 e 1: lo stesso seme dà lo stesso suono, anche nei test. */
  function random(seed) {
    let a = seed >>> 0;
    return function next() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- Mattoni ---------- */

  // I calcoli si fanno con Float64Array (più veloce: niente conversioni a ogni misura); i pezzi finiti sono Float32Array,
  // come vuole AudioBuffer (vedi loopable).

  /** Rumore bianco: tutte le frequenze con la stessa forza. */
  function white(length, rng) {
    const out = new Float64Array(length);
    for (let i = 0; i < length; i++) out[i] = rng() * 2 - 1;
    return out;
  }

  /** Rumore marrone: il bianco «integrato», con una piccola perdita, così resta intorno allo zero. Più forte in basso. */
  function brownNoise(length, rng) {
    const out = new Float64Array(length);
    let last = 0;
    for (let i = 0; i < length; i++) {
      last = (last + 0.02 * (rng() * 2 - 1)) / 1.02;
      out[i] = last;
    }
    return out;
  }

  /** Rumore rosa (filtro di Paul Kellet): la stessa forza in ogni ottava, a metà tra il bianco e il marrone. */
  function pinkNoise(length, rng) {
    const out = new Float64Array(length);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const w = rng() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      out[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
    }
    return out;
  }

  /**
   * I coefficienti di un filtro biquad (le formule di Robert Bristow-Johnson, le stesse del BiquadFilterNode):
   * 'lowpass', 'highpass' oppure 'bandpass' (0 dB al centro). `q` è lineare: 0,707 = nessun picco.
   */
  function biquad(type, frequency, q, rate) {
    const w = 2 * Math.PI * Math.min(frequency, rate * 0.49) / rate;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    let b0;
    let b1;
    let b2;
    if (type === 'lowpass') {
      b0 = (1 - cos) / 2;
      b1 = 1 - cos;
      b2 = b0;
    } else if (type === 'highpass') {
      b0 = (1 + cos) / 2;
      b1 = -(1 + cos);
      b2 = b0;
    } else {
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
    }
    const a0 = 1 + alpha;
    return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: -2 * cos / a0, a2: (1 - alpha) / a0 };
  }

  /** Passa `signal` nel filtro `c` (vedi biquad), sul posto. */
  function filter(signal, c) {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < signal.length; i++) {
      const x = signal[i];
      const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      signal[i] = y;
    }
    return signal;
  }

  /**
   * Un pezzo che si ripete senza scatto: `signal` è lungo `length + fade`; le ultime `fade` misure sfumano sulle prime
   * (dissolvenza a potenza costante). Così dopo l'ultima misura viene quella che la seguiva davvero, e la giunta non si
   * sente.
   */
  function loopable(signal, length, fade) {
    const out = Float32Array.from(signal.subarray(0, length));
    for (let i = 0; i < fade; i++) {
      const x = (i + 0.5) / fade;
      out[i] = signal[i] * Math.sin(x * Math.PI / 2) + signal[length + i] * Math.cos(x * Math.PI / 2);
    }
    return out;
  }

  /** Volume medio (RMS) di tutti i canali insieme. */
  function rmsOf(channels) {
    let sum = 0;
    let count = 0;
    channels.forEach(channel => {
      for (let i = 0; i < channel.length; i++) sum += channel[i] * channel[i];
      count += channel.length;
    });
    return count ? Math.sqrt(sum / count) : 0;
  }

  /** Porta i canali al volume medio `rms`, senza superare `peak`; sul posto. */
  function normalize(channels, rms = SOUND.rms, peak = SOUND.peak) {
    const now = rmsOf(channels);
    const gain = now > 0 ? rms / now : 0;
    channels.forEach(channel => {
      for (let i = 0; i < channel.length; i++) channel[i] = Math.max(-peak, Math.min(peak, channel[i] * gain));
    });
    return channels;
  }

  /**
   * Due canali (sinistro e destro, diversi tra loro: il suono si apre attorno) di `seconds` secondi a `rate` misure al
   * secondo, che si ripetono senza scatto. `render(total, rate, rng)` fa un canale lungo `total`.
   */
  function stereo(rate, seconds, rng, render) {
    const warm = Math.round(SOUND.warm * rate);
    const length = Math.round(seconds * rate);
    const fade = Math.round(SOUND.seam * rate);
    const channels = [0, 1].map(() => loopable(render(warm + length + fade, rate, rng).subarray(warm), length, fade));
    return normalize(channels);
  }

  /* ---------- I tre suoni ---------- */

  /** Rumore marrone: un fruscio profondo e uniforme, come una cascata lontana. */
  function brown(rate, rng) {
    return stereo(rate, SOUND.loop.brown, rng, (total, _rate, random) => brownNoise(total, random));
  }

  /**
   * Pioggia, in tre strati dallo stesso rumore bianco: il fruscio fine (intorno a 2,5 kHz, largo), il corpo della pioggia
   * che cade (intorno a 650 Hz) e le gocce, colpetti brevi a caso, tanti piccoli e pochi più forti, filtrati in alto. Le
   * parti di un rumore bianco su frequenze diverse sono indipendenti tra loro: un rumore solo basta, e costa meno.
   */
  function rainChannel(total, rate, rng) {
    const { rain } = SOUND;
    const noise = white(total, rng);
    const hiss = filter(noise.slice(), biquad('bandpass', rain.hiss[0], rain.hiss[1], rate));
    const body = filter(noise.slice(), biquad('bandpass', rain.body[0], rain.body[1], rate));
    const drops = new Float64Array(total);
    const chance = rain.drops / rate;
    let envelope = 0;
    let decay = 0;
    for (let i = 0; i < total; i++) {
      if (rng() < chance) {
        const size = rng();
        envelope = Math.max(envelope, 0.25 + 0.75 * size * size * size);
        decay = Math.exp(-1 / (between(rng, rain.decay) * rate));
      }
      drops[i] = envelope * noise[i];
      envelope *= decay;
    }
    filter(drops, biquad('highpass', rain.tick, 0.707, rate));
    // Ogni strato pesa per il suo volume, così le proporzioni restano queste qualunque sia la forza dei filtri.
    const weights = [0.5 / (rmsOf([hiss]) || 1), 0.45 / (rmsOf([body]) || 1), 0.6 / (rmsOf([drops]) || 1)];
    for (let i = 0; i < total; i++) hiss[i] = weights[0] * hiss[i] + weights[1] * body[i] + weights[2] * drops[i];
    return hiss;
  }

  function rain(rate, rng) {
    return stereo(rate, SOUND.loop.rain, rng, rainChannel);
  }

  /**
   * Il mare sotto le onde: rosa e marrone insieme. Da solo è un fruscio fermo; js/ui-sound.js lo fa salire e scendere con
   * waveCurves (volume e filtro) e ne prende anche la parte alta per la schiuma.
   */
  function seaChannel(total, rate, rng) {
    const pink = pinkNoise(total, rng);
    const deep = brownNoise(total, rng);
    const weights = [0.6 / (rmsOf([pink]) || 1), 0.4 / (rmsOf([deep]) || 1)];
    for (let i = 0; i < total; i++) pink[i] = weights[0] * pink[i] + weights[1] * deep[i];
    return pink;
  }

  function sea(rate, rng) {
    return stereo(rate, SOUND.loop.waves, rng, seaChannel);
  }

  /**
   * Il pezzo `name` ('brown', 'rain' o 'sea', il mare delle onde) a `rate` misure al secondo, dal seme `seed`: i suoi due
   * canali; null per un nome o una frequenza che non vanno. Lo usa js/sound-worker.js, che calcola fuori dal thread
   * principale (e js/ui-sound.js, se il lavoratore non c'è).
   */
  function piece(name, rate, seed) {
    const make = name === 'brown' ? brown : name === 'rain' ? rain : name === 'sea' ? sea : null;
    if (!make || !Number.isInteger(rate) || rate < 8000 || rate > 96000) return null;
    return make(rate, random(seed));
  }

  /* ---------- Le onde: un programma sempre diverso ---------- */

  /**
   * La prossima onda dopo l'istante `from` (secondi, sull'orologio dell'audio): { start, duration, crest, level, bright }.
   * Prima un po' di mare calmo (`gap`), poi l'onda cresce per `rise` secondi fino alla cresta, si frange e si ritira in
   * `fall` secondi. `crest` è dove sta la cresta (0–1 della durata), `level` quanto è forte, `bright` quanto si apre il
   * suono sulla cresta. Con `first` l'onda parte subito e cresce più in fretta: serve all'ascolto di prova nel negozio.
   */
  function nextWave(from, rng, { first = false } = {}) {
    const { wave } = SOUND;
    const gap = first ? 0 : between(rng, wave.gap);
    const rise = first ? wave.rise[0] * 0.8 : between(rng, wave.rise);
    const fall = between(rng, wave.fall);
    return {
      start: from + gap,
      duration: rise + fall,
      crest: rise / (rise + fall),
      level: between(rng, wave.level),
      bright: rng()
    };
  }

  /**
   * Le curve di un'onda (per AudioParam.setValueCurveAtTime, `points` valori dall'inizio alla fine dell'onda):
   * - gain: il volume del mare, da `floor` alla cresta (`level`) e di nuovo a `floor`: sale piano e poi in fretta, si
   *   frange e scende subito, poi si ritira lentamente;
   * - cutoff: il filtro, in Hz: chiuso (cupo) sul mare calmo, aperto sulla cresta, quando l'onda si frange;
   * - foam: la schiuma, la parte alta del fruscio: niente finché l'onda sale, poi arriva con la cresta e se ne va più piano.
   */
  function waveCurves(w, points = SOUND.wave.points) {
    const { wave } = SOUND;
    const gain = new Float32Array(points);
    const cutoff = new Float32Array(points);
    const foam = new Float32Array(points);
    const high = wave.high[0] + (wave.high[1] - wave.high[0]) * w.bright;
    for (let i = 0; i < points; i++) {
      const t = i / (points - 1);
      let shape;
      let froth;
      if (t <= w.crest) {
        shape = Math.pow(t / w.crest, 2.2);
        froth = t < w.crest * 0.85 ? 0 : (t - w.crest * 0.85) / (w.crest * 0.15);
      } else {
        const u = (t - w.crest) / (1 - w.crest);
        shape = Math.pow(1 - u, 2.4);
        froth = Math.pow(1 - u, 1.3);
      }
      gain[i] = wave.floor + (w.level - wave.floor) * shape;
      cutoff[i] = wave.low + (high - wave.low) * shape;
      foam[i] = wave.foam * w.level * Math.min(1, froth);
    }
    return { gain, cutoff, foam };
  }

  /* ---------- Frasi ---------- */

  /**
   * Sotto il menu «Suono», se qualche suono non è ancora tuo: «Pioggia e Onde sono nel negozio, in Motivazione.»; con un
   * nome solo, «Onde è nel negozio, in Motivazione.»; con nessuno, ''.
   */
  function shopNote(names) {
    if (!names.length) return '';
    const list = names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' e ' + names[names.length - 1];
    return list + (names.length === 1 ? ' è' : ' sono') + ' nel negozio, in Motivazione.';
  }

  /** L'etichetta del pulsante «Suono»: «Suono: Pioggia», oppure «Suono: silenzio». */
  function buttonLabel(item) {
    return 'Suono: ' + (!item || item.value === 'none' ? 'silenzio' : item.name);
  }

  Aura.sound = {
    SOUND,
    random,
    white,
    brownNoise,
    pinkNoise,
    biquad,
    filter,
    loopable,
    rmsOf,
    normalize,
    brown,
    rain,
    sea,
    piece,
    nextWave,
    waveCurves,
    shopNote,
    buttonLabel
  };
})(window.Aura = window.Aura || {});
