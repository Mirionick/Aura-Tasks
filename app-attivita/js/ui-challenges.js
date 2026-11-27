/*
 * Aura Tasks — «Sfide di oggi» nella scheda Motivazione (P-003, passo 3.5; vedi docs/punti-e-serie.md, «Sfide di oggi»).
 * La card: quante sono fatte («1 di 3»), una riga per sfida con l'anello che si riempie, il testo, lo stato e «+10», e in
 * fondo i 20 punti in più. Le righe non si toccano: dicono solo a che punto sei.
 * Tocca la pagina come app.js, che con init() gli passa quello che serve: lo stato e la scheda attiva. La logica sta in
 * js/challenges.js; le sfide nascono e si aggiornano in app.js (in commitState() e all'apertura), qui solo il disegno.
 */
(function (Aura) {
  'use strict';

  const { utils, challenges: C, motion: M } = Aura;

  const byId = id => document.getElementById(id);
  const SVG = 'http://www.w3.org/2000/svg';
  const RING = 2 * Math.PI * 15; // lunghezza dell'anello: r = 15 nel viewBox 36 (vedi .challenge__arc in style.css)
  const NOTES = {
    open: 'Tutte e tre: +20 punti in più. Domattina ne arrivano di nuove; quelle non fatte spariscono e basta.',
    all: 'Tutte e tre fatte: +50 punti oggi. Domattina ne arrivano di nuove.'
  };

  let ctx = null;
  const els = {};
  let rows = [];        // le righe disegnate, con i loro pezzi: { node, ring, arc, state, label, note, offset }
  let builtKey = '';    // giorno e tipi delle righe disegnate: con le sfide di un giorno nuovo si rifanno da capo
  let shownDone = null; // sfide fatte mostrate: quando sale con la scheda aperta, «N di 3» fa un piccolo salto

  const span = (className, text) => {
    const node = document.createElement('span');
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const svgNode = (name, attrs) => {
    const node = document.createElementNS(SVG, name);
    Object.keys(attrs).forEach(key => node.setAttribute(key, attrs[key]));
    return node;
  };

  /* ---------- Disegno ---------- */

  /**
   * Le sfide di oggi, adesso `now` (Date). La chiama render() di app.js, dentro commit(), e ogni minuto tick(): «Hai tempo
   * fino alle 18» diventa «Entro le 18» quando l'ora passa. Si riscrive solo quello che cambia.
   */
  function render(now) {
    const state = ctx.getState();
    const today = C.forToday(state.stats, state.tasks, now.getTime());
    els.card.hidden = !today;
    if (!today) return;

    const key = utils.toISODate(now) + ':' + today.rows.map(row => row.kind).join(',');
    if (key !== builtKey) {
      rows = today.rows.map(buildRow);
      els.list.replaceChildren(...rows.map(row => row.node));
      builtKey = key;
      shownDone = null;
    }
    const animate = shownDone !== null && ctx.isActive();
    today.rows.forEach((row, i) => updateRow(rows[i], row, animate));

    setText(els.done, String(today.done));
    setText(els.total, String(today.total));
    setText(els.note, today.all ? NOTES.all : NOTES.open);
    els.card.classList.toggle('is-all', today.all);
    if (animate && today.done > shownDone) M.flash(els.count, 'is-bumping');
    shownDone = today.done;
  }

  /** Riscrive un testo solo se cambia: il lettore di schermo non rilegge quello che è rimasto uguale. */
  function setText(node, text) {
    if (node.textContent !== text) node.textContent = text;
  }

  /**
   * Una riga: l'anello (traccia, arco e spunta) e il testo insieme, il titolo con «Fatta:» per il lettore di schermo e lo
   * stato sotto; a destra «+10», con la spunta quando è fatta. Il resto lo scrive updateRow().
   */
  function buildRow(row) {
    const node = document.createElement('li');
    node.className = 'challenge';
    node.dataset.kind = row.kind;

    const ring = span('challenge__ring');
    ring.setAttribute('aria-hidden', 'true');
    const svg = svgNode('svg', { class: 'challenge__svg', viewBox: '0 0 36 36', focusable: 'false' });
    const arc = svgNode('circle', { class: 'challenge__arc', cx: '18', cy: '18', r: '15', transform: 'rotate(-90 18 18)' });
    svg.append(
      svgNode('circle', { class: 'challenge__track', cx: '18', cy: '18', r: '15' }),
      arc,
      svgNode('path', { class: 'challenge__tick', d: 'M12 18.6l4 4 8.2-8.8' })
    );
    ring.appendChild(svg);

    const text = span('challenge__text');
    const title = span('challenge__title');
    const state = span('sr-only');
    const label = span('challenge__label');
    title.append(state, label);
    const note = span('challenge__note');
    text.append(title, note);
    // Anello e testo stanno sempre insieme: con il testo grande va a capo solo «+10» (vedi .challenge in style.css)
    const main = span('challenge__main');
    main.append(ring, text);

    const points = span('challenge__points', '+' + row.points);
    points.appendChild(span('sr-only', ' punti'));
    const check = svgNode('svg', { class: 'icon challenge__check', 'aria-hidden': 'true', focusable: 'false' });
    check.appendChild(svgNode('use', { href: '#i-check' }));
    points.appendChild(check);

    node.append(main, points);
    return { node, ring, arc, state, label, note };
  }

  /** Testi, anello e spunta di una riga. Con `animate`, una sfida appena fatta fa saltare l'anello. */
  function updateRow(parts, row, animate) {
    const wasDone = parts.node.classList.contains('is-done');
    parts.node.classList.toggle('is-done', row.done);
    setText(parts.state, row.done ? 'Fatta: ' : '');
    setText(parts.label, row.title);
    setText(parts.note, row.note);
    const offset = (RING * (1 - row.progress)).toFixed(2);
    if (parts.offset !== offset) {
      parts.offset = offset;
      parts.arc.style.strokeDashoffset = offset;
    }
    // Con l'anello vuoto l'arco non si vede: con le punte tonde, anche lungo zero, sarebbe un puntino
    parts.arc.classList.toggle('is-empty', row.progress <= 0);
    if (animate && row.done && !wasDone) M.flash(parts.ring, 'is-popping');
  }

  /** Ogni minuto, da app.js: lo stato di «entro le H» cambia con l'ora, il resto no. */
  function tick(now) {
    render(now);
  }

  /* ---------- Avvio ---------- */

  function init(context) {
    ctx = context;
    Object.assign(els, {
      card: byId('challenges'),
      count: byId('challenges-count'),
      done: byId('challenges-done'),
      total: byId('challenges-total'),
      list: byId('challenges-list'),
      note: byId('challenges-note')
    });
    return { render, tick };
  }

  Aura.challengesUI = { init };
})(window.Aura = window.Aura || {});
