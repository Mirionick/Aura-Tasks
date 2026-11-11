/*
 * Aura Tasks — prova tecnica della voce (passo 0 dell'assistente, vedi docs/assistente.md).
 * Pagina provvisoria: registra con MediaRecorder, manda la registrazione al server di Aura (che la fa trascrivere
 * a Whisper) e prova la voce del telefono (speechSynthesis). Misura formato, tempi e domande di permesso,
 * e prepara un riepilogo da copiare. Sparisce con il passo 2.
 */
(function (Aura) {
  'use strict';

  const R = Aura.remote;
  const byId = id => document.getElementById(id);

  const MAX_MS = 30000;   // durata massima di una registrazione
  const MIN_MS = 500;     // sotto, è un tocco per sbaglio: non si manda
  const BITRATE = 32000;  // per la voce bastano 32 kbit/s: 30 secondi sono circa 120 kB
  const SLOW_MIC_MS = 700; // un microfono pronto dopo più di così ha quasi sempre aspettato la finestra di iOS
  const SILENT_AFTER_MS = 4000; // una frase non partita entro questo tempo è rimasta muta
  // Formati da provare, in ordine di preferenza: l'iPhone registra in mp4 (AAC); da iOS 18.4 anche in webm.
  const TYPES = ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  const PREFERRED_VOICES = ['alice', 'federica', 'emma', 'luca', 'paola', 'elsa', 'isabella', 'diego'];

  const els = {};
  [
    'envList:env-list', 'linkStatus:link-status', 'activate:activate', 'micType:mic-type', 'mic:mic', 'micStatus:mic-status',
    'micLong:mic-long', 'speakAfter:speak-after', 'playback:playback', 'micLog:mic-log', 'voice:voice', 'sayNow:say-now',
    'sayUnlocked:say-unlocked', 'sayLocked:say-locked', 'reload:reload', 'speechLog:speech-log', 'report:report',
    'copy:copy', 'copyStatus:copy-status'
  ].forEach(pair => {
    const parts = pair.split(':');
    els[parts[0]] = byId(parts[1]);
  });

  let settings = R.load();
  let active = false;     // «Attiva la prova» toccato in questa visita
  let recording = null;   // registrazione in corso
  let chosenType = '';    // formato scelto per la registrazione ('' = quello del browser)
  let chosenVoice = 0;    // posizione della voce scelta in `voices`
  let voices = [];
  let unlockedAt = null;  // quando la voce è stata sbloccata (o ha parlato dentro un tocco) in questa pagina
  let lastPointerAt = 0;
  let playbackUrl = null;
  const attempts = [];    // registrazioni fatte, dalla prima
  const speeches = [];    // prove della voce, dalla prima
  const environment = readEnvironment();

  /* ---------- Dispositivo ---------- */

  function supports(type) {
    try {
      return typeof window.MediaRecorder === 'function' && window.MediaRecorder.isTypeSupported(type);
    } catch (err) {
      return false;
    }
  }

  function readEnvironment() {
    const agent = navigator.userAgent;
    const version = /OS (\d+)[_.](\d+)/.exec(agent);
    const ios = R.isIOS();
    return {
      device: ios ? (/iPhone|iPod/.test(agent) ? 'iPhone' : 'iPad') : 'non è un iPhone',
      ios: ios && version ? version[1] + '.' + version[2] : null,
      installed: navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches,
      secure: window.isSecureContext === true,
      microphone: Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      recorder: typeof window.MediaRecorder === 'function',
      types: TYPES.filter(supports),
      speech: 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function',
      agent
    };
  }

  /** Stato del permesso del microfono, dove il browser lo dice: "granted", "denied", "prompt"; altrimenti "non lo dice". */
  async function micPermission() {
    try {
      if (!navigator.permissions || !navigator.permissions.query) return 'non lo dice';
      return (await navigator.permissions.query({ name: 'microphone' })).state;
    } catch (err) {
      return 'non lo dice';
    }
  }

  const yesNo = value => (value ? 'sì' : 'no');
  const seconds = ms => (ms / 1000).toFixed(1).replace('.', ',') + ' s';
  const clock = date => date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const kilobytes = bytes => (bytes < 10240 ? (bytes / 1024).toFixed(1).replace('.', ',') : Math.round(bytes / 1024)) + ' kB';

  function renderEnvironment(permission) {
    const rows = [
      ['Dispositivo', environment.device + (environment.ios ? ', iOS ' + environment.ios : '')],
      ['Aura installata', environment.installed ? 'sì, aperta dalla schermata Home' : 'no, aperta nel browser'],
      ['Microfono', environment.microphone ? 'disponibile' : 'non disponibile' + (environment.secure ? '' : ' (serve https)')],
      ['Permesso', permission],
      ['Registrazione', environment.recorder ? (environment.types.join(', ') || 'nessun formato dichiarato') : 'MediaRecorder non c\'è'],
      ['Voce', environment.speech ? (voices.length ? voices.length + ' in italiano' : 'nessuna voce italiana trovata') : 'non disponibile']
    ];
    els.envList.replaceChildren(...rows.reduce((nodes, row) => {
      const term = document.createElement('dt');
      term.textContent = row[0];
      const value = document.createElement('dd');
      value.textContent = row[1];
      return nodes.concat(term, value);
    }, []));
  }

  /**
   * Una scelta fatta di chip, come nel resto dell'app. Niente <select>: in Safari ognuno fa scrivere in console
   * un avviso della Content-Security-Policy.
   */
  function fillChips(container, items, selected, onPick) {
    container.replaceChildren(...items.map(item => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.dataset.value = String(item.value);
      chip.textContent = item.label;
      chip.setAttribute('aria-pressed', String(item.value === selected));
      chip.addEventListener('click', () => onPick(item.value));
      return chip;
    }));
  }

  const TYPE_LABELS = {
    'audio/mp4': 'mp4',
    'audio/mp4;codecs=mp4a.40.2': 'mp4 con AAC',
    'audio/webm;codecs=opus': 'webm con Opus',
    'audio/webm': 'webm',
    'audio/ogg;codecs=opus': 'ogg con Opus'
  };

  function fillTypes() {
    const types = environment.types.length ? environment.types : [''];
    if (types.indexOf(chosenType) === -1) chosenType = types[0];
    fillChips(els.micType, types.map(type => ({ value: type, label: TYPE_LABELS[type] || 'quello del browser' })), chosenType, value => {
      if (recording) return;
      chosenType = value;
      fillTypes();
    });
  }

  /* ---------- Collegamento al server ---------- */

  function setStatus(el, text, tone) {
    el.textContent = text;
    el.dataset.tone = tone || 'off';
    el.hidden = false;
  }

  /** Registra il codice del dispositivo sul server: usa quello che c'è già (promemoria, Siri), altrimenti lo crea. */
  async function register() {
    settings = R.load();
    const code = settings.code || R.newDeviceCode();
    const result = await R.api.register(code);
    if (!result.ok) return R.troubleMessage(result, navigator.onLine);
    if (settings.code !== code) {
      settings.code = code;
      R.save(settings);
    }
    return null;
  }

  async function onActivate() {
    const availability = R.availability();
    if (availability !== 'ok') {
      setStatus(els.linkStatus, availability === 'file' ? 'Questa pagina va aperta dall\'indirizzo https di Aura.' : 'Il server di Aura non è configurato.', 'warn');
      return;
    }
    if (!environment.microphone || !environment.recorder) {
      setStatus(els.linkStatus, 'Questo browser non può registrare: la prova del microfono non si può fare.', 'warn');
    }
    els.activate.disabled = true;
    setStatus(els.linkStatus, 'Collegamento…', 'busy');
    const trouble = await register();
    els.activate.disabled = false;
    if (trouble) {
      setStatus(els.linkStatus, trouble, 'warn');
      return;
    }
    active = true;
    setStatus(els.linkStatus, 'Attiva su questo dispositivo', 'on');
    els.activate.hidden = true;
    const ready = environment.microphone && environment.recorder;
    els.mic.disabled = !ready;
    els.micLong.disabled = !ready;
    setStatus(els.micStatus, ready ? 'Pronto' : 'Qui non si può registrare', ready ? 'off' : 'warn');
    updateReport();
  }

  /* ---------- Registrazione ---------- */

  const MIC_LABELS = {
    idle: 'Tieni premuto e parla',
    asking: 'Apro il microfono…',
    hold: 'Ti ascolto… rilascia per inviare',
    tap: 'Ti ascolto… tocca per inviare',
    sending: 'Trascrivo…'
  };

  function setMic(state) {
    els.mic.dataset.state = state;
    els.mic.textContent = MIC_LABELS[state];
    els.micLong.textContent = recording && recording.mode === 'long' && recording.recorder ? 'Ferma e invia' : 'Registra 30 secondi';
    els.micLong.disabled = !active || (Boolean(recording) && recording.mode !== 'long') || state === 'sending';
    els.micType.querySelectorAll('.chip').forEach(chip => {
      chip.disabled = Boolean(recording) || state === 'sending';
    });
  }

  function tick() {
    if (!recording || !recording.recorder) return;
    const elapsed = Math.floor((performance.now() - recording.startedAt) / 1000);
    const text = 'Registro: 0:' + String(elapsed).padStart(2, '0') + (recording.mode === 'long' ? ' di 0:30' : '');
    if (els.micStatus.textContent !== text) setStatus(els.micStatus, text, 'busy');
  }

  /**
   * Apre il microfono e comincia a registrare. `mode`: 'hold' (tenendo premuto), 'tap' (da tastiera o VoiceOver)
   * oppure 'long' (i 30 secondi). Se in 'hold' il dito non è più giù quando il microfono è pronto (di solito perché
   * iOS ha chiesto il permesso), si registra lo stesso e si invia con un tocco: è la regola prevista per l'assistente.
   */
  async function begin(mode) {
    if (recording || !active) return;
    const session = recording = { mode, released: false, blurred: false, askedAt: performance.now(), chunks: [] };
    const attempt = { n: attempts.length + 1, at: new Date(), mode, asked: null };
    setMic('asking');
    setStatus(els.micStatus, 'Apro il microfono…', 'busy');
    const before = micPermission();
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      recording = null;
      attempt.permissionBefore = await before;
      attempt.error = err && err.name === 'NotAllowedError' ? 'Permesso del microfono negato' : 'Microfono non disponibile (' + ((err && err.name) || 'errore') + ')';
      closeAttempt(attempt);
      return;
    }
    attempt.readyMs = Math.round(performance.now() - session.askedAt);
    attempt.permissionBefore = await before;
    attempt.permissionAfter = await micPermission();
    attempt.blurred = session.blurred;
    attempt.interrupted = mode === 'hold' && session.released;
    if (session.cancelled) { // la pagina è finita in secondo piano mentre il microfono si apriva
      stream.getTracks().forEach(track => track.stop());
      recording = null;
      attempt.error = session.cancelled;
      closeAttempt(attempt);
      return;
    }

    const type = chosenType;
    let recorder;
    try {
      recorder = type ? new MediaRecorder(stream, { mimeType: type, audioBitsPerSecond: BITRATE }) : new MediaRecorder(stream, { audioBitsPerSecond: BITRATE });
    } catch (err) {
      try {
        recorder = new MediaRecorder(stream); // il browser non accetta le opzioni: si registra con le sue
      } catch (err2) {
        stream.getTracks().forEach(track => track.stop());
        recording = null;
        attempt.error = 'Il browser non riesce a registrare (' + ((err2 && err2.name) || 'errore') + ')';
        closeAttempt(attempt);
        return;
      }
    }
    session.stream = stream;
    session.recorder = recorder;
    session.attempt = attempt;
    session.tapToSend = mode !== 'hold' || session.released;
    recorder.addEventListener('dataavailable', event => {
      if (event.data && event.data.size) session.chunks.push(event.data);
    });
    recorder.addEventListener('stop', () => onRecorded(session));
    recorder.start();
    session.startedAt = performance.now();
    session.limit = setTimeout(finish, MAX_MS);
    session.ticker = setInterval(tick, 250);
    setMic(session.tapToSend ? 'tap' : 'hold');
    tick();
  }

  /** Ferma la registrazione e la manda. Chiude subito il microfono, prima che il telefono parli. */
  function finish() {
    const session = recording;
    if (!session || !session.recorder || session.finishing) return;
    session.finishing = true;
    clearTimeout(session.limit);
    clearInterval(session.ticker);
    session.durationMs = performance.now() - session.startedAt;
    setMic('sending');
    try {
      session.recorder.stop();
    } catch (err) {
      onRecorded(session);
    }
    session.stream.getTracks().forEach(track => track.stop());
  }

  /** Annulla senza mandare niente (pagina nascosta mentre si registra). */
  function cancel(reason) {
    const session = recording;
    if (!session || session.finishing) return;
    session.cancelled = reason; // se il microfono non è ancora pronto, begin() se ne accorge e si ferma
    if (!session.recorder) return;
    session.finishing = true;
    session.attempt.error = reason;
    session.durationMs = performance.now() - session.startedAt;
    try {
      session.recorder.stop();
    } catch (err) {
      onRecorded(session);
    }
    session.stream.getTracks().forEach(track => track.stop());
  }

  function toBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result);
        resolve(url.slice(url.indexOf(',') + 1));
      };
      reader.onerror = () => reject(reader.error || new Error('lettura non riuscita'));
      reader.readAsDataURL(blob);
    });
  }

  /** Manda la registrazione al server; se il server non conosce più il codice (401), lo ricollega e riprova una volta. */
  async function send(base64, type) {
    let result = await R.api.transcribe(settings.code, base64, type);
    if (result.status === 401 && !(await register())) result = await R.api.transcribe(settings.code, base64, type);
    return result;
  }

  async function onRecorded(session) {
    if (session.done) return;
    session.done = true;
    clearTimeout(session.limit);
    clearInterval(session.ticker);
    if (recording === session) recording = null;
    const attempt = session.attempt;
    const type = String(session.recorder.mimeType || (session.chunks[0] && session.chunks[0].type) || chosenType || '');
    const blob = new Blob(session.chunks, type ? { type } : {});
    attempt.type = type || 'non dichiarato';
    attempt.bytes = blob.size;
    // Se la registrazione si è fermata da sola (microfono tolto dal sistema), la durata si misura adesso.
    attempt.durationMs = session.durationMs || performance.now() - session.startedAt;
    showPlayback(blob);
    if (session.cancelled) {
      closeAttempt(attempt);
      return;
    }
    if (attempt.durationMs < MIN_MS && session.mode === 'hold' && !session.tapToSend) {
      attempt.error = 'Troppo breve: tieni premuto mentre parli';
      closeAttempt(attempt);
      return;
    }
    if (!blob.size) {
      attempt.error = 'La registrazione è vuota';
      closeAttempt(attempt);
      return;
    }
    setMic('sending');
    setStatus(els.micStatus, 'Trascrivo…', 'busy');
    try {
      const base64 = await toBase64(blob);
      attempt.chars = base64.length;
      const started = performance.now();
      const result = await send(base64, (type.split(';')[0] || 'audio/mp4').trim());
      attempt.totalMs = Math.round(performance.now() - started);
      attempt.status = result.status;
      if (result.ok && result.data) {
        attempt.text = typeof result.data.text === 'string' ? result.data.text : '';
        attempt.counted = result.data.seconds;
      } else {
        const data = result.data || {};
        attempt.error = [data.error || R.troubleMessage(result, navigator.onLine), data.reason, data.detail].filter(Boolean).join(' · ');
      }
    } catch (err) {
      attempt.error = 'Non riesco a leggere la registrazione (' + ((err && err.name) || 'errore') + ')';
    }
    closeAttempt(attempt);
    if (els.speakAfter.checked && attempt.text !== undefined) {
      speak(attempt.text ? 'Hai detto: ' + attempt.text : 'Non ho sentito niente.', 'dopo la registrazione ' + attempt.n);
    }
  }

  /** L'ultima registrazione si può riascoltare dal lettore sotto il microfono. */
  function showPlayback(blob) {
    if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    playbackUrl = blob.size ? URL.createObjectURL(blob) : null;
    els.playback.hidden = !playbackUrl;
    if (playbackUrl) els.playback.src = playbackUrl;
    else els.playback.removeAttribute('src');
  }

  function closeAttempt(attempt) {
    attempts.push(attempt);
    setMic('idle');
    setStatus(els.micStatus, attempt.error ? attempt.error : attempt.text ? 'Fatto' : 'Non ho sentito niente', attempt.error ? 'warn' : 'on');
    renderAttempts();
    updateReport();
    micPermission().then(renderEnvironment);
  }

  /* ---------- Gesto del microfono ---------- */

  function onMicDown(event) {
    if (event.button) return;
    lastPointerAt = performance.now();
    try {
      els.mic.setPointerCapture(event.pointerId); // il rilascio arriva anche se il dito scivola fuori dal pulsante
    } catch (err) {
      // Senza cattura: il rilascio fuori dal pulsante vale come un'interruzione.
    }
    if (!recording) begin('hold');
    else if (recording.tapToSend && recording.recorder) recording.sendOnUp = true;
  }

  function onMicUp() {
    lastPointerAt = performance.now();
    unlockSpeech(); // dentro il tocco: così la risposta, che arriva dopo, potrà parlare
    const session = recording;
    if (!session) return;
    if (session.sendOnUp) finish();
    else if (session.mode === 'hold' && !session.tapToSend) {
      if (session.recorder) finish();
      else session.released = true; // il microfono non è ancora pronto
    }
  }

  /** Tocco interrotto dal sistema (di solito la finestra del permesso): si continua, e si invierà con un tocco. */
  function onMicCancel() {
    const session = recording;
    if (!session || session.mode !== 'hold' || session.tapToSend) return;
    if (!session.recorder) {
      session.released = true;
      return;
    }
    session.tapToSend = true;
    session.attempt.interrupted = true;
    setMic('tap');
  }

  /** Da tastiera o con VoiceOver non si può tenere premuto: un tocco avvia, un altro invia. */
  function onMicClick() {
    if (performance.now() - lastPointerAt < 700) return; // clic nato da un tocco già gestito
    unlockSpeech();
    if (!recording) begin('tap');
    else if (recording.tapToSend && recording.recorder) finish();
  }

  function onLongClick() {
    unlockSpeech();
    if (!recording) begin('long');
    else if (recording.mode === 'long' && recording.recorder) finish();
  }

  /* ---------- Voce del telefono ---------- */

  function loadVoices() {
    if (!environment.speech) return;
    const italian = window.speechSynthesis.getVoices().filter(voice => /^it([-_]|$)/i.test(voice.lang));
    if (els.voice.children.length && italian.length === voices.length) return; // niente di nuovo
    voices = italian;
    const rank = voice => {
      const index = PREFERRED_VOICES.findIndex(name => voice.name.toLowerCase().indexOf(name) !== -1);
      return (index === -1 ? PREFERRED_VOICES.length : index) + (voice.default ? -0.5 : 0);
    };
    voices.sort((a, b) => rank(a) - rank(b));
    chosenVoice = 0;
    fillVoices();
    micPermission().then(renderEnvironment);
    updateReport();
  }

  function fillVoices() {
    const items = voices.length
      ? voices.map((voice, index) => ({ value: index, label: voice.name + ' (' + voice.lang + ')' }))
      : [{ value: 0, label: 'quella del telefono' }];
    fillChips(els.voice, items, chosenVoice, value => {
      chosenVoice = value;
      fillVoices();
    });
  }

  /** Una frase vuota dentro un tocco: su iPhone sblocca la voce per le frasi che arrivano dopo. */
  function unlockSpeech() {
    if (!environment.speech) return;
    try {
      const silent = new SpeechSynthesisUtterance(' ');
      silent.volume = 0;
      silent.lang = 'it-IT';
      window.speechSynthesis.speak(silent);
      if (unlockedAt === null) unlockedAt = performance.now();
    } catch (err) {
      // Niente voce: restano le risposte scritte.
    }
  }

  function speak(text, label) {
    const entry = { label, at: new Date(), unlocked: unlockedAt !== null, voice: null, started: null, ended: null, error: null };
    speeches.push(entry);
    if (!environment.speech) {
      entry.error = 'voce non disponibile';
      renderSpeeches();
      return;
    }
    const asked = performance.now();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'it-IT';
    const voice = voices[chosenVoice];
    if (voice) {
      utterance.voice = voice;
      entry.voice = voice.name;
    }
    utterance.onstart = () => {
      entry.started = Math.round(performance.now() - asked);
      renderSpeeches();
    };
    utterance.onend = () => {
      entry.ended = Math.round(performance.now() - asked);
      renderSpeeches();
    };
    utterance.onerror = event => {
      entry.error = (event && event.error) || 'errore';
      renderSpeeches();
    };
    try {
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      entry.error = (err && err.name) || 'errore';
    }
    setTimeout(() => {
      if (entry.started === null && !entry.error) {
        entry.error = 'non è partita';
        renderSpeeches();
      }
    }, SILENT_AFTER_MS);
    renderSpeeches();
  }

  /* ---------- Elenchi e riepilogo ---------- */

  const MODES = { hold: 'tenendo premuto', tap: 'con un tocco', long: '30 secondi' };

  function line(className, text) {
    const p = document.createElement('p');
    p.className = className;
    p.textContent = text;
    return p;
  }

  function attemptFacts(attempt) {
    const facts = [];
    if (attempt.readyMs !== undefined) {
      const slow = attempt.readyMs > SLOW_MIC_MS || attempt.blurred;
      facts.push('microfono pronto in ' + attempt.readyMs + ' ms' + (slow ? ' (finestra di iOS: probabile)' : ''));
      facts.push('permesso prima: ' + attempt.permissionBefore + ', dopo: ' + attempt.permissionAfter);
      if (attempt.interrupted) facts.push('tocco interrotto: inviato con un tocco');
    }
    if (attempt.type) facts.push(attempt.type + ' · ' + seconds(attempt.durationMs) + ' · ' + kilobytes(attempt.bytes));
    if (attempt.chars) facts.push(attempt.chars + ' caratteri in base64');
    if (attempt.status !== undefined) facts.push('server: ' + attempt.status + ' in ' + attempt.totalMs + ' ms' + (attempt.counted !== undefined ? ' · ' + String(attempt.counted).replace('.', ',') + ' s contati' : ''));
    return facts;
  }

  function renderAttempts() {
    els.micLog.replaceChildren(...attempts.slice().reverse().map(attempt => {
      const item = document.createElement('li');
      item.className = 'log__item';
      item.appendChild(line('log__head', attempt.n + ' · ' + clock(attempt.at) + ' · ' + MODES[attempt.mode]));
      if (attempt.error) item.appendChild(line('log__text log__text--error', attempt.error));
      else item.appendChild(line('log__text', attempt.text ? '«' + attempt.text + '»' : '(niente)'));
      attemptFacts(attempt).forEach(fact => item.appendChild(line('log__line', fact)));
      // La domanda di iOS non si può leggere dalla pagina: la segna chi fa la prova.
      const ask = document.createElement('div');
      ask.className = 'log__ask';
      const label = document.createElement('span');
      label.textContent = 'iOS ha chiesto il permesso?';
      ask.appendChild(label);
      [['Sì', true], ['No', false]].forEach(pair => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chip';
        button.textContent = pair[0];
        button.setAttribute('aria-pressed', String(attempt.asked === pair[1]));
        button.addEventListener('click', () => {
          attempt.asked = pair[1];
          renderAttempts();
          updateReport();
        });
        ask.appendChild(button);
      });
      item.appendChild(ask);
      return item;
    }));
  }

  function speechOutcome(entry) {
    if (entry.error) return 'muta (' + entry.error + ')';
    if (entry.started === null) return 'in attesa…';
    return 'è partita dopo ' + entry.started + ' ms' + (entry.ended !== null ? ', finita dopo ' + seconds(entry.ended) : '');
  }

  function renderSpeeches() {
    els.speechLog.replaceChildren(...speeches.slice().reverse().map(entry => {
      const item = document.createElement('li');
      item.className = 'log__item';
      item.appendChild(line('log__head', clock(entry.at) + ' · ' + entry.label));
      item.appendChild(line('log__text' + (entry.error ? ' log__text--error' : ''), speechOutcome(entry)));
      item.appendChild(line('log__line', (entry.unlocked ? 'voce già sbloccata in questa pagina' : 'voce mai sbloccata in questa pagina') + (entry.voice ? ' · ' + entry.voice : '')));
      return item;
    }));
    updateReport();
  }

  /** Il riepilogo da copiare: dispositivo, registrazioni e prove della voce. Non contiene il codice del dispositivo. */
  function buildReport() {
    const lines = [];
    lines.push('Prova della voce di Aura · ' + new Date().toLocaleString('it-IT'));
    lines.push('Dispositivo: ' + environment.device + (environment.ios ? ', iOS ' + environment.ios : '') + ' · installata: ' + yesNo(environment.installed));
    lines.push('Browser: ' + environment.agent);
    lines.push('Formati: ' + (environment.recorder ? environment.types.join(', ') || 'nessuno dichiarato' : 'MediaRecorder non c\'è'));
    lines.push('Voci italiane: ' + (voices.length ? voices.map(voice => voice.name + ' (' + voice.lang + ')').join(', ') : 'nessuna'));
    lines.push('');
    lines.push('Registrazioni: ' + (attempts.length || 'nessuna'));
    attempts.forEach(attempt => {
      const asked = attempt.asked === null ? 'non segnato' : yesNo(attempt.asked);
      lines.push(attempt.n + ') ' + clock(attempt.at) + ' · ' + MODES[attempt.mode] + ' · iOS ha chiesto il permesso: ' + asked);
      attemptFacts(attempt).forEach(fact => lines.push('   ' + fact));
      lines.push('   ' + (attempt.error ? 'errore: ' + attempt.error : attempt.text ? '«' + attempt.text + '»' : '(niente)'));
    });
    lines.push('');
    lines.push('Voce: ' + (speeches.length || 'nessuna prova'));
    speeches.forEach(entry => {
      lines.push('- ' + clock(entry.at) + ' · ' + entry.label + ' · ' + speechOutcome(entry) + ' · ' + (entry.unlocked ? 'già sbloccata' : 'mai sbloccata') + (entry.voice ? ' · ' + entry.voice : ''));
    });
    return lines.join('\n');
  }

  function updateReport() {
    els.report.value = buildReport();
  }

  async function onCopy() {
    updateReport();
    let copied = false;
    try {
      await navigator.clipboard.writeText(els.report.value);
      copied = true;
    } catch (err) {
      els.report.focus();
      els.report.select();
      try {
        copied = document.execCommand('copy');
      } catch (err2) {
        copied = false;
      }
    }
    setStatus(els.copyStatus, copied ? 'Copiato: incollalo nella conversazione' : 'Non riesco a copiare: seleziona il testo qui sopra e copialo a mano', copied ? 'on' : 'warn');
  }

  /* ---------- Avvio ---------- */

  fillTypes();
  micPermission().then(renderEnvironment);
  updateReport();
  setMic('idle');

  els.activate.addEventListener('click', onActivate);
  els.mic.addEventListener('pointerdown', onMicDown);
  els.mic.addEventListener('pointerup', onMicUp);
  els.mic.addEventListener('pointercancel', onMicCancel);
  els.mic.addEventListener('click', onMicClick);
  els.mic.addEventListener('contextmenu', event => event.preventDefault()); // niente menu al tocco lungo
  els.micLong.addEventListener('click', onLongClick);
  // La finestra del permesso di iOS toglie il fuoco alla pagina: è un indizio in più.
  window.addEventListener('blur', () => {
    if (recording && !recording.recorder) recording.blurred = true;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancel('Interrotta: la pagina è finita in secondo piano');
  });

  els.sayNow.addEventListener('click', () => {
    speak('Ciao, sono Aura. Questa è la voce del tuo telefono.', 'subito, dentro il tocco');
    if (unlockedAt === null) unlockedAt = performance.now();
  });
  els.sayUnlocked.addEventListener('click', () => {
    unlockSpeech();
    setTimeout(() => speak('Questa frase parte tre secondi dopo il tocco, con lo sblocco.', 'dopo 3 secondi, con lo sblocco'), 3000);
  });
  els.sayLocked.addEventListener('click', () => {
    setTimeout(() => speak('Questa frase parte tre secondi dopo il tocco, senza sblocco.', 'dopo 3 secondi, senza sblocco'), 3000);
  });
  els.reload.addEventListener('click', () => location.reload());
  els.copy.addEventListener('click', onCopy);

  if (environment.speech) {
    loadVoices();
    if (typeof window.speechSynthesis.addEventListener === 'function') window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    // Safari non sempre avvisa quando le voci sono pronte: si riprova poco dopo.
    setTimeout(loadVoices, 500);
    setTimeout(loadVoices, 2000);
  }
})(window.Aura = window.Aura || {});
