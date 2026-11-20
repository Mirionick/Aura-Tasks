/*
 * Aura Tasks — scorrimento sulle card (P-005, passo 5.2).
 * Solo funzioni pure: chi può far scorrere una card (il dito o la penna, non dai bordi dello schermo), il blocco della
 * direzione, dove sta la card, la soglia, il colpo veloce e la decisione al rilascio. Gli eventi della pagina stanno in
 * js/ui-swipe.js. Misure in px CSS, tempi in millisecondi (come event.timeStamp). Niente DOM.
 */
(function (Aura) {
  'use strict';

  const LIMITS = Object.freeze({
    lock: 10,        // px: prima di questa distanza dal punto di partenza non si decide niente
    ratio: 1.5,      // la card si muove solo se il dito va di lato almeno 1,5 volte più che in verticale
    edge: 24,        // px dal bordo dello schermo: lì Safari torna indietro o avanti, la card resta ferma
    threshold: 0.4,  // frazione della larghezza della card: da qui, lasciando, succede
    flickSpeed: 0.5, // px/ms: un colpo veloce
    flickMin: 48,    // px: quanto deve essersi spostata la card per un colpo veloce
    window: 100      // ms: gli ultimi movimenti che contano per la velocità
  });

  /** Solo il dito e la penna: con il mouse trascinare serve a selezionare il testo. */
  function accepts(pointerType) {
    return pointerType === 'touch' || pointerType === 'pen';
  }

  /** Un dito che parte a meno di 24 px da un bordo dello schermo largo `viewportWidth` non sposta la card. */
  function atEdge(x, viewportWidth, limits = LIMITS) {
    return x < limits.edge || x > viewportWidth - limits.edge;
  }

  /**
   * Direzione di un gesto spostato di (dx, dy) dal punto di partenza: null finché non si è mosso di 10 px; poi 'x' (la
   * card scorre di lato) se va di lato almeno 1,5 volte più che in verticale, altrimenti 'y' (scorre la pagina).
   */
  function lock(dx, dy, limits = LIMITS) {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (Math.hypot(ax, ay) < limits.lock) return null;
    return ax >= limits.ratio * ay ? 'x' : 'y';
  }

  /** Dove sta la card spostata di `dx`: segue il dito, al massimo di una sua larghezza da una parte o dall'altra. */
  function offset(dx, width) {
    const max = Math.max(0, width || 0);
    return Math.min(max, Math.max(-max, dx));
  }

  /** Che cosa si scopre dietro la card spostata di `x`: 'done' (verso destra), 'delete' (verso sinistra), null al suo posto. */
  function side(x) {
    if (x > 0) return 'done';
    if (x < 0) return 'delete';
    return null;
  }

  /** Oltre la soglia (40% della larghezza della card): lasciando, succede. */
  function armed(x, width, limits = LIMITS) {
    return width > 0 && Math.abs(x) >= limits.threshold * width;
  }

  /**
   * Velocità del dito in px/ms negli ultimi 100 ms. `samples`: [{ x, t }] in ordine di tempo. Con meno di due punti in
   * quella finestra (per esempio il dito fermo prima di lasciare) è 0.
   */
  function velocity(samples, limits = LIMITS) {
    if (!Array.isArray(samples) || samples.length < 2) return 0;
    const last = samples[samples.length - 1];
    let first = last;
    for (let i = samples.length - 2; i >= 0 && last.t - samples[i].t <= limits.window; i--) first = samples[i];
    const dt = last.t - first.t;
    return dt > 0 ? (last.x - first.x) / dt : 0;
  }

  /**
   * Al rilascio della card spostata di `x` (larga `width`), con il dito a `speed` px/ms: 'done', 'delete' oppure null
   * (torna al suo posto). Succede oltre la soglia, oppure con un colpo veloce (almeno 0,5 px/ms e 48 px) nella stessa
   * direzione. Un colpo veloce nella direzione opposta annulla, anche oltre la soglia: è un ripensamento.
   */
  function decide(x, width, speed, limits = LIMITS) {
    const where = side(x);
    if (!where) return null;
    const fast = Math.abs(speed) >= limits.flickSpeed;
    if (fast && Math.sign(speed) !== Math.sign(x)) return null;
    if (armed(x, width, limits)) return where;
    if (fast && Math.abs(x) >= limits.flickMin) return where;
    return null;
  }

  const MAX_SAMPLES = 12;

  /**
   * Un gesto intero, dal dito appoggiato in (x, y) al tempo t su una card larga `width`. Stati: 'wait' (non ancora
   * deciso), 'swipe' (la card scorre), 'scroll' (scorre la pagina: la card non si muove più fino alla fine del gesto),
   * 'end'. move() restituisce lo stato; `x` è dove sta la card. La card parte da dove si decide la direzione, senza
   * saltare dei 10 px già fatti. release() dà la decisione (vedi decide); cancel() chiude senza decisione.
   */
  function track(x0, y0, t0, width, limits = LIMITS) {
    let state = 'wait';
    let origin = 0;
    let x = 0;
    const samples = [{ x: x0, t: t0 }];

    function move(px, py, pt) {
      if (state === 'scroll' || state === 'end') return state;
      if (state === 'wait') {
        const dir = lock(px - x0, py - y0, limits);
        if (!dir) return state;
        if (dir === 'y') {
          state = 'scroll';
          return state;
        }
        state = 'swipe';
        origin = px;
      }
      x = offset(px - origin, width);
      samples.push({ x: px, t: pt });
      if (samples.length > MAX_SAMPLES) samples.shift();
      return state;
    }

    function release() {
      const was = state;
      state = 'end';
      return was === 'swipe' ? decide(x, width, velocity(samples, limits), limits) : null;
    }

    function cancel() {
      state = 'end';
    }

    return {
      move,
      release,
      cancel,
      get state() { return state; },
      get x() { return x; },
      get width() { return width; }
    };
  }

  Aura.swipe = { LIMITS, accepts, atEdge, lock, offset, side, armed, velocity, decide, track };
})(window.Aura = window.Aura || {});
