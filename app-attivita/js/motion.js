/*
 * Aura Tasks — movimento.
 * Durate e curve vengono dai token di style.css (--dur-*, --ease-*): CSS e JavaScript si muovono con gli stessi tempi.
 * Tecnica FLIP: snapshot() legge dove stanno gli elementi con data-flip prima che la lista cambi; play(), dopo render(),
 * fa scivolare al loro posto quelli spostati, fa entrare i nuovi e uscire come "fantasmi" quelli tolti.
 * Tocca la pagina solo per le animazioni (element.animate, permesso dalla CSP). planFlip() è la parte pura, testata.
 */
(function (Aura) {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const VIEW_MARGIN = 80; // px fuori dallo schermo che contano ancora come "in vista"
  const MIN_SHIFT = 1;    // px: sotto questo spostamento non si anima nulla

  /* ---------- Parte pura ---------- */

  /** "320ms" → 320, "6s" → 6000; altrimenti null. */
  function parseDuration(text) {
    const match = /^\s*(\d*\.?\d+)(ms|s)\s*$/.exec(String(text === undefined || text === null ? '' : text));
    if (!match) return null;
    return Number(match[1]) * (match[2] === 's' ? 1000 : 1);
  }

  /**
   * Decide cosa animare confrontando le posizioni di prima e di dopo (rettangoli nella viewport), per chiave.
   * - before, after: { chiave: { top, left, width, height } } degli elementi visibili;
   * - viewport: { width, height };
   * - collapsed: { chiave: chiave del titolo del contenitore chiuso in cui l'elemento è finito } (per esempio «Completate»);
   * - parents: { chiave: chiave del contenitore con data-flip che lo contiene adesso } (le card stanno nelle sezioni).
   * Restituisce { moves: [{ key, dx, dy }], enters: [chiave], exits: [{ key, to }] }. Si anima solo ciò che si vede;
   * uno spostamento più lungo dello schermo diventa un'uscita più un'entrata.
   * Chiavi annidate: si anima il blocco più grande che si muove insieme. Un figlio si sposta solo per la parte che il
   * genitore non fa già (i due movimenti si sommano), ed entra con il genitore senza un'entrata sua.
   */
  function planFlip(before, after, viewport, collapsed = {}, parents = {}) {
    const inView = rect => !!rect && rect.width > 0 && rect.top + rect.height > -VIEW_MARGIN && rect.top < viewport.height + VIEW_MARGIN;
    const depth = key => { let d = 0; for (let p = parents[key]; p && d < 20; p = parents[p]) d++; return d; };
    const moves = [];
    const enters = [];
    const exits = [];
    const offset = {}; // spostamento con cui ogni elemento parte, suo più quello dei genitori
    const entering = new Set();
    Object.keys(after).sort((a, b) => depth(a) - depth(b)).forEach(key => {
      const parent = parents[key];
      const inherited = (parent && offset[parent]) || { dx: 0, dy: 0 };
      offset[key] = inherited;
      if (parent && entering.has(parent)) { // entra insieme al genitore
        entering.add(key);
        return;
      }
      const now = after[key];
      const was = before[key];
      if (!was) {
        if (inView(now)) { enters.push(key); entering.add(key); }
        return;
      }
      const dx = was.left - now.left - inherited.dx;
      const dy = was.top - now.top - inherited.dy;
      if (Math.abs(dx) < MIN_SHIFT && Math.abs(dy) < MIN_SHIFT) return; // si muove già con il genitore
      if (!inView(was) && !inView(now)) return;
      if (Math.abs(dy) > viewport.height) {
        if (inView(was)) exits.push({ key, to: null });
        if (inView(now)) { enters.push(key); entering.add(key); }
        return;
      }
      moves.push({ key, dx, dy });
      offset[key] = { dx: inherited.dx + dx, dy: inherited.dy + dy };
    });
    Object.keys(before).forEach(key => {
      if (after[key] || !inView(before[key])) return;
      const target = collapsed[key];
      exits.push({ key, to: target && inView(after[target]) ? target : null });
    });
    enters.sort((a, b) => after[a].top - after[b].top);
    return { moves, enters, exits };
  }

  /* ---------- Token ---------- */

  const DURATIONS = ['tap', 'quick', 'color', 'exit', 'move', 'reward', 'celebrate', 'glow', 'breath'];
  const CURVES = ['out', 'in', 'in-out', 'spring'];
  let tokens = null;

  /** Legge una volta i token di style.css. Un token che manca vale 0 ms, cioè nessuna animazione. */
  function readTokens() {
    if (tokens) return tokens;
    const style = getComputedStyle(document.documentElement);
    tokens = { ms: {}, ease: {} };
    DURATIONS.forEach(name => { tokens.ms[name] = parseDuration(style.getPropertyValue('--dur-' + name)) || 0; });
    CURVES.forEach(name => { tokens.ease[name] = style.getPropertyValue('--ease-' + name).trim() || 'ease'; });
    return tokens;
  }

  const reduced = () => reducedMotion.matches;
  const canAnimate = () => !reduced() && typeof Element.prototype.animate === 'function';
  /** Durata del token --dur-<nome> in millisecondi; 0 con «Riduci movimento». */
  const ms = name => (reduced() ? 0 : readTokens().ms[name] || 0);
  /** Curva del token --ease-<nome>. */
  const ease = name => readTokens().ease[name] || 'ease';

  /* ---------- FLIP sulla pagina ---------- */

  const flips = new WeakMap(); // elemento → sua animazione FLIP in corso (una sola per elemento)

  /** Il <details> chiuso che nasconde l'elemento (il suo <summary> resta visibile), oppure null. */
  function closedDetails(el) {
    const details = el.closest('details:not([open])');
    if (!details) return null;
    const summary = details.querySelector(':scope > summary');
    return summary && summary.contains(el) ? null : details;
  }

  /**
   * Rettangoli degli elementi con data-flip visibili, i nodi, il contenitore con data-flip di ciascuno (parents),
   * e per quelli chiusi in un <details> il titolo che li contiene (collapsed).
   */
  function measure(root) {
    const rects = {};
    const nodes = {};
    const parents = {};
    const collapsed = {};
    root.querySelectorAll('[data-flip]').forEach(el => {
      const key = el.dataset.flip;
      if (el.closest('[hidden]')) return;
      const details = closedDetails(el);
      if (details) {
        const summary = details.querySelector(':scope > summary[data-flip]');
        if (summary) collapsed[key] = summary.dataset.flip;
        return;
      }
      const rect = el.getBoundingClientRect();
      rects[key] = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
      nodes[key] = el;
      const parent = el.parentElement && el.parentElement.closest('[data-flip]');
      if (parent && root.contains(parent)) parents[key] = parent.dataset.flip;
    });
    return { rects, nodes, parents, collapsed };
  }

  /** Dove sono adesso gli elementi, animazioni in corso comprese. Da chiamare subito prima di cambiare la lista. */
  function snapshot(root) {
    return canAnimate() ? measure(root) : null;
  }

  function animate(el, keyframes, options) {
    const previous = flips.get(el);
    if (previous) previous.cancel();
    const animation = el.animate(keyframes, options);
    flips.set(el, animation);
    const forget = () => { if (flips.get(el) === animation) flips.delete(el); };
    animation.finished.then(forget, forget);
    return animation;
  }

  /** Il livello dei fantasmi, sempre ultimo figlio di root (sopra la lista). Si sposta solo se serve: ogni spostamento costa un ricalcolo. */
  function ghostLayer(root) {
    let layer = root.querySelector(':scope > .motion-ghosts');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'motion-ghosts';
      layer.setAttribute('aria-hidden', 'true');
      layer.setAttribute('inert', '');
    }
    if (root.lastElementChild !== layer) root.appendChild(layer);
    return layer;
  }

  /**
   * Prepara il fantasma di un elemento appena tolto: torna per un attimo dov'era, nel livello sopra la lista, ed esce.
   * Sfuma (fade), scivola a destra (slide) o in su (up), oppure vola verso il titolo in cui è finito (target).
   * Solo scritture: le posizioni (rect, base, target) sono già state lette, così non si ricalcola la pagina per ogni fantasma.
   */
  function makeGhost(node, rect, base, target, style) {
    const running = flips.get(node);
    if (running) running.cancel();
    const el = node.isConnected ? node.cloneNode(true) : node;
    [el].concat(Array.from(el.querySelectorAll('[id], [data-id], [data-flip]'))).forEach(item => {
      item.removeAttribute('id');
      item.removeAttribute('data-id');
      item.removeAttribute('data-flip');
    });
    el.hidden = false;
    el.classList.add('motion-ghost');
    el.style.top = rect.top - base.top + 'px';
    el.style.left = rect.left - base.left + 'px';
    el.style.width = rect.width + 'px';
    el.style.height = rect.height + 'px';

    let end = style === 'slide' ? 'translateX(28px)' : style === 'up' ? 'translateY(-8px)' : 'scale(.97)';
    let duration = ms('exit');
    let easing = ease('in');
    if (target) {
      const dx = target.left + target.width / 2 - (rect.left + rect.width / 2);
      const dy = target.top + target.height / 2 - (rect.top + rect.height / 2);
      end = 'translate(' + dx + 'px, ' + dy + 'px) scale(.4)';
      duration = ms('move');
      easing = ease('in-out');
    }
    return { el, end, duration, easing };
  }

  function startGhost({ el, end, duration, easing }) {
    // "forwards": finita l'uscita il fantasma resta invisibile finché non viene tolto.
    const animation = el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: end }], { duration, easing, fill: 'forwards' });
    const remove = () => el.remove();
    animation.finished.then(remove, remove);
    return animation;
  }

  /**
   * Dopo render(): fa scivolare dalla vecchia alla nuova posizione gli elementi spostati, fa entrare i nuovi e uscire
   * come fantasmi quelli tolti. `before` viene da snapshot(). Opzioni:
   * - delay: ms prima di partire (per esempio il tempo di chiusura di un foglio);
   * - enterFrom: 'above' per entrare dall'alto;
   * - slide: chiave dell'elemento che esce scivolando a destra (eliminazione); exit: 'up' per le altre uscite;
   * - toCollapsed: false per non far volare verso il titolo gli elementi finiti in un <details> chiuso.
   * Si anima il blocco più grande che si muove insieme (vedi planFlip): meno elementi animati, meno lavoro a ogni fotogramma.
   * Restituisce il piano (vedi planFlip), oppure null se non anima nulla.
   */
  function play(root, before, options = {}) {
    if (!before || !canAnimate()) return null;
    // Gli elementi rimasti al loro posto possono avere ancora uno spostamento in corso: la nuova posizione va letta senza.
    root.querySelectorAll('[data-flip]').forEach(el => {
      const running = flips.get(el);
      if (running) running.cancel();
    });
    // Prima tutte le letture, in un solo calcolo della pagina (anche il livello dei fantasmi); poi solo scritture.
    const layer = ghostLayer(root);
    const after = measure(root);
    const base = layer.getBoundingClientRect();
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const plan = planFlip(before.rects, after.rects, viewport, options.toCollapsed === false ? {} : after.collapsed, after.parents);
    const delay = options.delay || 0;
    const animations = [];

    plan.moves.forEach(({ key, dx, dy }) => {
      animations.push(animate(after.nodes[key], [
        { transform: 'translate(' + dx + 'px, ' + dy + 'px)' },
        { transform: 'none' }
      ], { duration: ms('move'), easing: ease('out'), delay, fill: 'backwards' }));
    });
    plan.enters.forEach(key => {
      const from = options.enterFrom === 'above' ? 'translateY(-8px)' : 'translateY(8px) scale(.98)';
      animations.push(animate(after.nodes[key], [
        { opacity: 0, transform: from },
        { opacity: 1, transform: 'none' }
      ], { duration: ms('move'), easing: ease('out'), delay, fill: 'backwards' }));
    });
    // Un elemento che sta dentro un altro che esce non ha un fantasma suo: è già nel fantasma del contenitore.
    // (Il contenitore ridisegnato non contiene più i nodi vecchi dei figli: quelli escono da soli.)
    const sources = plan.exits.map(({ key }) => before.nodes[key]).filter(Boolean);
    const ghosts = plan.exits
      .filter(({ key }) => before.nodes[key] && !sources.some(other => other !== before.nodes[key] && other.contains(before.nodes[key])))
      .map(({ key, to }) => makeGhost(before.nodes[key], before.rects[key], base, to ? after.rects[to] : null, options.slide === key ? 'slide' : options.exit));
    if (ghosts.length) {
      const fragment = document.createDocumentFragment();
      ghosts.forEach(item => fragment.appendChild(item.el));
      layer.appendChild(fragment); // tutti insieme: un solo inserimento
      ghosts.forEach(item => animations.push(startGhost(item)));
    }

    // Rete di sicurezza: se i fotogrammi si fermano (pagina nascosta, tempo virtuale), tutto arriva comunque alla fine.
    if (animations.length) {
      const end = Math.max.apply(null, animations.map(animation => animation.effect.getComputedTiming().endTime || 0));
      setTimeout(() => {
        animations.forEach(animation => {
          if (animation.playState === 'running' || animation.playState === 'paused') animation.finish();
        });
      }, end + 100);
    }
    return plan;
  }

  /* ---------- Classi che fanno partire un'animazione CSS ---------- */

  const flashes = new WeakMap(); // elemento → { classe: gettone dell'ultima volta }

  /**
   * Aggiunge per un attimo una classe che fa partire un'animazione CSS e la toglie quando finisce, così si può ripetere.
   * La fine si calcola dalle animazioni partite con la classe (getAnimations prima e dopo), non da millisecondi
   * scritti a mano: le altre animazioni già in corso nell'elemento (per esempio la fiamma) non contano.
   */
  function flash(el, className) {
    if (!el || !canAnimate()) return;
    el.classList.remove(className);
    void el.offsetWidth; // ricomincia l'animazione se era già in corso
    const measurable = typeof el.getAnimations === 'function';
    const running = new Set(measurable ? el.getAnimations({ subtree: true }) : []);
    el.classList.add(className);
    const token = {};
    const mine = flashes.get(el) || {};
    mine[className] = token;
    flashes.set(el, mine);
    let end = ms('glow');
    if (measurable) {
      end = el.getAnimations({ subtree: true })
        .filter(animation => !running.has(animation))
        .reduce((longest, animation) => Math.max(longest, animation.effect.getComputedTiming().endTime || 0), 0);
    }
    setTimeout(() => {
      if (mine[className] === token) el.classList.remove(className);
    }, end + 50);
  }

  Aura.motion = { parseDuration, planFlip, ms, ease, reduced, canAnimate, snapshot, play, flash };
})(window.Aura = window.Aura || {});
