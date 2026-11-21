/*
 * Aura Tasks — scorrimento sulle card (P-005, passo 5.2; specifica in docs/scorrimento.md): la parte che tocca la pagina.
 * Sulle card da fare di Focus e Agenda, con il dito: verso destra si completa (come la spunta), verso sinistra si elimina
 * (come il cestino); tutti e due con «Annulla». Spunta e cestino restano: lo scorrimento è un modo in più.
 * Le liste si ridisegnano a ogni cambio, quindi gli ascoltatori stanno su #main, uno per tipo di evento per tutte le liste.
 * La card si muove solo con transform, con una scrittura per fotogramma; dietro, lo sfondo («Fatto» o «Elimina») viene
 * dal <template id="swipe-template">. Le regole (direzione, soglia, colpo veloce, bordi) stanno in js/swipe.js.
 * app.js passa ciò che serve con Aura.swipeUI.init().
 */
(function (Aura) {
  'use strict';

  const { swipe: S, motion: M } = Aura;

  const CLICK_GUARD = 400; // ms: il clic che arriva subito dopo uno scorrimento non apre niente e non cambia la spunta

  let ctx = null;
  let root = null;
  let template = null;
  let gesture = null;   // il gesto in corso (un dito alla volta)
  let guardUntil = 0;

  /** La card si può far scorrere: da fare, non in «Completate» né nella cronologia, nessun foglio aperto. */
  function swipeable(card) {
    if (!card || !card.dataset.id || card.classList.contains('is-done')) return false;
    if (card.classList.contains('task--pending') || card.classList.contains('task--completing')) return false;
    if (card.closest('#completed-list, #history-list, .motion-ghosts')) return false;
    if (document.querySelector('dialog[open]')) return false;
    return ctx.canSwipe(card.dataset.id);
  }

  function onDown(event) {
    guardUntil = 0;
    if (gesture || !event.isPrimary || !S.accepts(event.pointerType)) return;
    const card = event.target.closest('.task');
    if (!swipeable(card) || S.atEdge(event.clientX, window.innerWidth)) return;
    gesture = {
      pointerId: event.pointerId,
      card,
      list: card.parentElement,
      track: S.track(event.clientX, event.clientY, event.timeStamp, card.offsetWidth),
      bg: null,
      side: null,
      armed: false,
      frame: 0
    };
  }

  function onMove(event) {
    const g = gesture;
    if (!g || event.pointerId !== g.pointerId) return;
    if (!g.card.isConnected) { // la lista si è ridisegnata sotto il dito (un minuto nuovo, un'altra scheda del browser)
      abort(g);
      return;
    }
    const was = g.track.state;
    const state = g.track.move(event.clientX, event.clientY, event.timeStamp);
    if (state === 'scroll') { // scorre la pagina: la card resta dov'è fino alla fine del gesto
      gesture = null;
      return;
    }
    if (state !== 'swipe') return;
    if (was !== 'swipe') begin(g);
    if (!g.frame) g.frame = requestAnimationFrame(() => paint(g));
  }

  /** La card comincia a scorrere: lo sfondo dietro, al suo posto. Prima tutte le letture, poi solo scritture. */
  function begin(g) {
    const { card, list } = g;
    card.getAnimations().forEach(animation => animation.cancel()); // uno spostamento FLIP ancora in corso
    const cardRect = card.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    const top = cardRect.top - listRect.top - list.clientTop;
    const left = cardRect.left - listRect.left - list.clientLeft;
    const bg = template.content.firstElementChild.cloneNode(true);
    bg.dataset.flip = 'swipe:' + card.dataset.id; // se la card viene eliminata, lo sfondo sfuma con lei (Aura.motion)
    bg.style.top = top + 'px';
    bg.style.left = left + 'px';
    bg.style.width = cardRect.width + 'px';
    bg.style.height = cardRect.height + 'px';
    list.classList.add('is-swiping');
    root.classList.add('is-swiping');
    card.classList.add('task--swiping');
    list.insertBefore(bg, card);
    g.bg = bg;
  }

  /** Al fotogramma: una scrittura sola per tutti i movimenti arrivati intanto. */
  function paint(g) {
    g.frame = 0;
    if (gesture === g && g.bg) write(g);
  }

  /** Dove sta la card; lo sfondo cambia solo quando cambiano il lato o la soglia. */
  function write(g) {
    const x = g.track.x;
    g.card.style.transform = x ? 'translateX(' + x + 'px)' : '';
    const side = S.side(x) || g.side; // al suo posto resta lo sfondo di prima: niente cambia per un attimo
    if (side !== g.side) {
      g.side = side;
      g.bg.dataset.side = side;
    }
    const armed = S.armed(x, g.track.width);
    if (armed !== g.armed) {
      g.armed = armed;
      g.bg.classList.toggle('is-armed', armed);
      if (armed) ctx.vibrate(8);
    }
  }

  function onUp(event) {
    const g = gesture;
    if (!g || event.pointerId !== g.pointerId) return;
    gesture = null;
    if (g.track.state !== 'swipe') return; // un tocco: la spunta, la modifica o il cestino, come sempre
    guardUntil = performance.now() + CLICK_GUARD;
    if (g.frame) cancelAnimationFrame(g.frame);
    g.frame = 0;
    if (!g.card.isConnected) {
      abort(g);
      return;
    }
    g.track.move(event.clientX, event.clientY, event.timeStamp); // anche il punto in cui si lascia conta per la velocità
    const decision = g.track.release();
    const id = g.card.dataset.id;
    if (decision === 'delete') {
      // Come il cestino: la card continua verso sinistra mentre le altre salgono, poi «Attività eliminata» con «Annulla».
      write(g); // l'ultima posizione: da lì parte il fantasma della card
      const deleted = ctx.onDelete(id, -Math.round(Math.max(48, g.track.width - Math.abs(g.track.x))));
      cleanup(g);
      if (!deleted && g.card.isConnected) settle(g);
      return;
    }
    // Verso destra come la spunta (punti, festa, «Annulla»; per una ripetizione arriva la prossima), dopo che la card è
    // tornata al suo posto. Sotto la soglia torna al suo posto e basta.
    settle(g, decision === 'done' ? () => ctx.onDone(id, g.card) : null);
  }

  function onCancel(event) {
    const g = gesture;
    if (!g || event.pointerId !== g.pointerId) return;
    gesture = null;
    g.track.cancel();
    if (g.frame) cancelAnimationFrame(g.frame);
    g.frame = 0;
    if (!g.bg) return;
    guardUntil = performance.now() + CLICK_GUARD;
    if (g.card.isConnected) settle(g);
    else abort(g);
  }

  /**
   * La card torna al suo posto, poi `then`. Con «Riduci movimento» subito, senza rimbalzi; altrimenti scivola, senza
   * superare il posto (niente sfondo dell'altro lato per un attimo).
   */
  function settle(g, then) {
    const x = g.track.x;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      cleanup(g);
      if (then) then();
    };
    g.card.style.transform = '';
    if (!x || !M.canAnimate()) {
      finish();
      return;
    }
    const duration = M.ms(then ? 'quick' : 'move');
    const animation = g.card.animate([{ transform: 'translateX(' + x + 'px)' }, { transform: 'none' }], { duration, easing: M.ease('out') });
    animation.finished.then(finish, finish);
    setTimeout(finish, duration + 100); // rete di sicurezza: fotogrammi fermi (pagina nascosta)
  }

  /** Via lo sfondo e le classi del gesto. Lo sfondo che sta già uscendo come fantasma (Aura.motion) resta. */
  function cleanup(g) {
    if (g.bg && g.bg.parentNode === g.list) g.bg.remove();
    g.list.classList.remove('is-swiping');
    root.classList.remove('is-swiping');
    g.card.classList.remove('task--swiping');
    if (g.card.parentNode === g.list) g.card.style.transform = '';
  }

  /** Il gesto finisce senza fare niente (la card non c'è più). */
  function abort(g) {
    if (gesture === g) gesture = null;
    g.track.cancel();
    if (g.frame) cancelAnimationFrame(g.frame);
    g.frame = 0;
    cleanup(g);
  }

  /** In cattura, prima della spunta e della modifica: il clic subito dopo uno scorrimento non fa niente. */
  function onClick(event) {
    if (!guardUntil) return;
    const guarded = performance.now() <= guardUntil;
    guardUntil = 0;
    if (!guarded) return;
    event.preventDefault();
    event.stopPropagation();
  }

  /**
   * `options`: root (#main), canSwipe(id), onDone(id, card) (come la spunta), onDelete(id, slideX) (come il cestino; il
   * fantasma della card continua di slideX px; restituisce true se l'ha eliminata), vibrate(ms).
   */
  function init(options) {
    ctx = options;
    root = options.root;
    template = document.getElementById('swipe-template');
    if (!root || !template) return { active: () => false };
    root.addEventListener('pointerdown', onDown, { passive: true });
    root.addEventListener('pointermove', onMove, { passive: true });
    root.addEventListener('pointerup', onUp, { passive: true });
    root.addEventListener('pointercancel', onCancel, { passive: true });
    root.addEventListener('click', onClick, true);
    return { active: () => Boolean(gesture && gesture.bg) };
  }

  Aura.swipeUI = { init };
})(window.Aura = window.Aura || {});
