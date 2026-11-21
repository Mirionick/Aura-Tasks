/*
 * Test dei suoni del focus (js/sound.js; P-004, passo 4.4): i numeri casuali ripetibili, i tre suoni (volume, picco, giunta
 * senza scatto, canali diversi, colore: il marrone cupo, la pioggia chiara), i pezzi per nome del lavoratore dei calcoli,
 * il programma delle onde e le loro curve, le frasi del menu «Suono». Non si ascolta niente: si misura.
 */
(function () {
  'use strict';

  const { test, assert, assertEqual } = window.AuraTest;
  const { sound: S } = window.Aura;

  const RATE = 8000; // basso apposta: i test restano veloci, e le misure valgono lo stesso
  const close = (actual, expected, tolerance) => Math.abs(actual - expected) <= tolerance;

  /** Quanto un suono è «chiaro»: il volume delle differenze tra misure vicine diviso per il volume. Il bianco fa circa 1,4. */
  function brightness(channel) {
    let diff = 0;
    let sum = 0;
    for (let i = 1; i < channel.length; i++) {
      diff += (channel[i] - channel[i - 1]) ** 2;
      sum += channel[i] ** 2;
    }
    return Math.sqrt(diff / sum);
  }

  /** Il salto alla giunta (dall'ultima misura alla prima) diviso per il salto medio tra due misure vicine. */
  function seamJump(channel) {
    let mean = 0;
    for (let i = 1; i < channel.length; i++) mean += Math.abs(channel[i] - channel[i - 1]);
    mean /= channel.length - 1;
    return Math.abs(channel[0] - channel[channel.length - 1]) / mean;
  }

  function correlation(a, b) {
    let ab = 0;
    let aa = 0;
    let bb = 0;
    for (let i = 0; i < a.length; i++) {
      ab += a[i] * b[i];
      aa += a[i] * a[i];
      bb += b[i] * b[i];
    }
    return ab / Math.sqrt(aa * bb);
  }

  const peakOf = channel => channel.reduce((max, value) => Math.max(max, Math.abs(value)), 0);

  test('random: lo stesso seme dà gli stessi numeri, tra 0 e 1, in media a metà', () => {
    const a = S.random(42);
    const b = S.random(42);
    const first = Array.from({ length: 5 }, () => a());
    assertEqual(first, Array.from({ length: 5 }, () => b()));
    const c = S.random(43);
    assert(first[0] !== c(), 'un altro seme, altri numeri');
    const many = Array.from({ length: 20000 }, S.random(7));
    assert(many.every(value => value >= 0 && value < 1), 'tra 0 e 1');
    const mean = many.reduce((sum, value) => sum + value, 0) / many.length;
    assert(close(mean, 0.5, 0.01), 'media ' + mean);
  });

  test('loopable: la giunta del pezzo che si ripete non salta, e la lunghezza è quella chiesta', () => {
    const rng = S.random(1);
    const noise = S.brownNoise(1200 + 200, rng);
    const loop = S.loopable(noise, 1200, 200);
    assertEqual([loop.length, loop instanceof Float32Array], [1200, true]);
    // Dopo l'ultima misura viene quella che la seguiva davvero nel rumore: la prima è (quasi) noise[1200].
    assert(close(loop[0], noise[1200], 0.02), 'la prima misura continua l\'ultima');
    assert(close(loop[1199], noise[1199], 1e-6), 'la fine non cambia');
    assert(seamJump(loop) < 4, 'salto alla giunta: ' + seamJump(loop).toFixed(2));
  });

  test('normalize: porta al volume medio chiesto, senza superare il picco', () => {
    const channels = [Float32Array.from([0.5, -0.5, 0.5, -0.5]), Float32Array.from([2, -2, 0, 0])];
    S.normalize(channels, 0.1, 0.12);
    assert(Math.max(...channels[0].map(Math.abs), ...channels[1].map(Math.abs)) <= 0.12 + 1e-6, 'picco');
    const silent = [new Float32Array(4)];
    assertEqual(Array.from(S.normalize(silent)[0]), [0, 0, 0, 0], 'il silenzio resta silenzio');
  });

  test('i tre suoni: due canali diversi della durata giusta, volume medio 0,12, picco sotto 0,9, giunta senza scatto', () => {
    [['brown', S.SOUND.loop.brown], ['rain', S.SOUND.loop.rain], ['sea', S.SOUND.loop.waves]].forEach(([name, seconds]) => {
      const channels = S[name](RATE, S.random(5));
      assertEqual([channels.length, channels[0].length, channels[1].length], [2, seconds * RATE, seconds * RATE], name + ': durata');
      assert(close(S.rmsOf(channels), S.SOUND.rms, 0.002), name + ': volume ' + S.rmsOf(channels));
      channels.forEach(channel => assert(peakOf(channel) <= S.SOUND.peak, name + ': picco ' + peakOf(channel)));
      channels.forEach(channel => assert(seamJump(channel) < 4, name + ': giunta ' + seamJump(channel).toFixed(2)));
      assert(Math.abs(correlation(channels[0], channels[1])) < 0.1, name + ': i canali sono diversi');
    });
  });

  test('colore: il rumore marrone è cupo, la pioggia chiara, il mare delle onde nel mezzo', () => {
    const brown = brightness(S.brown(RATE, S.random(2))[0]);
    const sea = brightness(S.sea(RATE, S.random(2))[0]);
    const rain = brightness(S.rain(RATE, S.random(2))[0]);
    const white = brightness(Float32Array.from(S.white(RATE, S.random(2))));
    assert(brown < 0.4, 'marrone ' + brown.toFixed(2));
    assert(brown < sea && sea < rain, 'marrone < onde < pioggia: ' + [brown, sea, rain].map(v => v.toFixed(2)).join(' < '));
    assert(rain > 0.8 && close(white, Math.SQRT2, 0.05), 'pioggia ' + rain.toFixed(2) + ', bianco ' + white.toFixed(2));
  });

  test('i suoni sono ripetibili: lo stesso seme dà lo stesso pezzo', () => {
    const a = S.rain(RATE, S.random(9));
    const b = S.rain(RATE, S.random(9));
    assertEqual([a[0][123], a[1][4567]], [b[0][123], b[1][4567]]);
  });

  test('piece: i pezzi per nome, come li calcola il lavoratore; un nome o una frequenza che non vanno danno null', () => {
    const a = S.piece('rain', RATE, 9);
    const b = S.rain(RATE, S.random(9));
    assertEqual([a.length, a[0][123], a[1][4567]], [2, b[0][123], b[1][4567]], 'la stessa pioggia dallo stesso seme');
    assertEqual([S.piece('brown', RATE, 3)[0].length, S.piece('sea', RATE, 3)[1].length], [S.SOUND.loop.brown * RATE, S.SOUND.loop.waves * RATE]);
    assertEqual(['waves', 'random', 'constructor', '__proto__', '', null].map(name => S.piece(name, RATE, 1)), [null, null, null, null, null, null]);
    assertEqual([0, NaN, 8000.5, 200000, '8000'].map(rate => S.piece('brown', rate, 1)), [null, null, null, null, null]);
  });

  test('biquad e filter: il passa-basso tiene i suoni bassi e toglie quelli alti; il passa-alto il contrario', () => {
    const tone = (frequency, length = 4000) => Float64Array.from({ length }, (_, i) => Math.sin(2 * Math.PI * frequency * i / RATE));
    const level = (signal, kind, cut) => S.rmsOf([S.filter(signal, S.biquad(kind, cut, 0.707, RATE)).subarray(1000)]) / Math.SQRT1_2;
    assert(level(tone(100), 'lowpass', 1000) > 0.95 && level(tone(3000), 'lowpass', 1000) < 0.15, 'passa-basso');
    assert(level(tone(3000), 'highpass', 300) > 0.95 && level(tone(50), 'highpass', 300) < 0.05, 'passa-alto');
    assert(close(level(tone(1000), 'bandpass', 1000), 1, 0.03), 'passa-banda: 0 dB al centro');
  });

  test('nextWave: dopo un po\' di mare calmo, onde di 6–10 s con la cresta nel primo terzo o a metà, che non si sovrappongono', () => {
    const { wave } = S.SOUND;
    const rng = S.random(11);
    let from = 100;
    for (let i = 0; i < 40; i++) {
      const next = S.nextWave(from, rng);
      const rise = next.duration * next.crest;
      const fall = next.duration - rise;
      assert(next.start >= from + wave.gap[0] && next.start <= from + wave.gap[1], 'mare calmo prima dell\'onda ' + i);
      assert(rise >= wave.rise[0] && rise <= wave.rise[1] && fall >= wave.fall[0] && fall <= wave.fall[1], 'durate dell\'onda ' + i);
      assert(next.level >= wave.level[0] && next.level <= wave.level[1] && next.bright >= 0 && next.bright <= 1, 'forza dell\'onda ' + i);
      from = next.start + next.duration;
    }
    const first = S.nextWave(10, S.random(1), { first: true });
    assertEqual(first.start, 10, 'nell\'ascolto di prova la prima onda parte subito');
    assert(first.duration * first.crest < wave.rise[0], 'e cresce più in fretta');
  });

  test('waveCurves: il volume parte e finisce sul mare calmo e tocca la cresta; il filtro si apre lì; la schiuma arriva dopo', () => {
    const { wave } = S.SOUND;
    const w = { start: 0, duration: 8, crest: 0.4, level: 0.9, bright: 1 };
    const { gain, cutoff, foam } = S.waveCurves(w);
    assertEqual([gain.length, cutoff.length, foam.length], [wave.points, wave.points, wave.points]);
    assert(close(gain[0], wave.floor, 1e-6) && close(gain[gain.length - 1], wave.floor, 1e-6), 'mare calmo all\'inizio e alla fine');
    const top = gain.indexOf(Math.max(...gain));
    assert(close(Math.max(...gain), w.level, 0.02) && Math.abs(top / (wave.points - 1) - w.crest) < 0.02, 'la cresta al suo posto');
    assert(close(cutoff[0], wave.low, 1e-6) && close(Math.max(...cutoff), wave.high[1], 60), 'il filtro si apre sulla cresta');
    assertEqual([foam[0], foam[Math.floor(wave.points * 0.2)]], [0, 0], 'niente schiuma mentre l\'onda sale');
    assert(foam[top + 4] > 0.2 && foam[foam.length - 1] < 0.01, 'la schiuma dopo la cresta, poi se ne va');
    for (let i = 1; i <= top; i++) assert(gain[i] >= gain[i - 1] - 1e-6, 'sale senza scendere');
    for (let i = top + 1; i < gain.length; i++) assert(gain[i] <= gain[i - 1] + 1e-6, 'poi scende senza risalire');
  });

  test('frasi: la nota del menu «Suono» e l\'etichetta del pulsante', () => {
    assertEqual(S.shopNote([]), '');
    assertEqual(S.shopNote(['Onde']), 'Onde è nel negozio, in Motivazione.');
    assertEqual(S.shopNote(['Pioggia', 'Onde']), 'Pioggia e Onde sono nel negozio, in Motivazione.');
    assertEqual(S.shopNote(['A', 'B', 'C']), 'A, B e C sono nel negozio, in Motivazione.');
    assertEqual([S.buttonLabel({ value: 'rain', name: 'Pioggia' }), S.buttonLabel({ value: 'none', name: 'Silenzio' }), S.buttonLabel(null)],
      ['Suono: Pioggia', 'Suono: silenzio', 'Suono: silenzio']);
  });
})();
