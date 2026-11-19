/*
 * Aura Tasks — scheda Motivazione (P-003, passo 3.3; vedi docs/tre-modalita.md, «Motivazione»).
 * Nell'intestazione il livello: distintivo, nome, barra e quanto manca (serie e punti, sotto, restano di app.js).
 * Nella scheda «La tua settimana», con il cielo, l'obiettivo e la settimana scorsa, e «I tuoi numeri». «Completate» la
 * disegna app.js, come «Completate oggi» in Focus.
 * Tocca la pagina come app.js, che con init() gli passa quello che serve: stato e preferenze. La logica sta in
 * js/motivation.js; qui solo disegno, il pulsante dell'obiettivo e i movimenti (Aura.motion, solo transform e opacity).
 */
(function (Aura) {
  'use strict';

  const { utils, motivation: Mo, motion: M } = Aura;

  const byId = id => document.getElementById(id);
  const SVG = 'http://www.w3.org/2000/svg';
  // Distintivi disegnati invece dell'illustrazione: Stella, finché level-4-star non è rifatta (docs/illustrazioni.md).
  const DRAWN = ['star'];
  const HALO = 4.6; // raggio dell'alone di una stella, in volte il raggio della stella
  const GLINT_MAX = 24; // all'apertura della scheda si accendono una dopo l'altra al massimo 24 stelle

  let ctx = null;
  const els = {};
  let badgeFile = undefined; // illustrazione del distintivo mostrato (null = disegnato): si cambia solo quando cambia
  let shownSky = '';         // impronta del cielo disegnato: si ridisegna solo quando cambia
  let shownWeek = null;      // settimana dell'ultimo cielo e se era già una costellazione: le linee nuove appaiono piano
  let shownReached = false;
  let celebratedWeek = null; // settimana in cui l'avviso «obiettivo raggiunto» è già partito: una volta per settimana
  let glints = [];           // le stelle che si stanno accendendo: un'altra apertura della scheda le ferma e riparte

  /* ---------- Disegno ---------- */

  /** Livello, settimana e numeri, adesso `now` (Date). La chiama render() di app.js, dentro commit(). */
  function render(now) {
    const today = utils.toISODate(now);
    const { stats } = ctx.getState();
    renderLevel(stats);
    renderWeek(stats, today);
    renderNumbers(stats, today);
  }

  function renderLevel(stats) {
    const level = Mo.levelOf(stats.totalPoints);
    els.levelName.textContent = level.name;
    els.levelStep.textContent = Mo.levelStep(level);
    els.levelStep.hidden = !els.levelStep.textContent;
    els.levelNote.textContent = Mo.levelNote(level);
    els.levelFill.style.transform = 'scaleX(' + level.progress + ')';
    els.levelRank.hidden = level.rank < 2;
    els.levelRank.textContent = level.rank > 1 ? String(level.rank) : '';
    showBadge(DRAWN.includes(level.badge) ? null : 'images/level-' + level.number + '-' + level.badge + '.webp');
  }

  /** L'illustrazione del livello, oppure (file = null, o immagine che non si carica) il distintivo disegnato. */
  function showBadge(file) {
    if (file === badgeFile) return;
    badgeFile = file;
    els.levelImg.hidden = !file;
    // È un <svg>: la proprietà hidden esiste solo sugli elementi HTML, quindi si cambia l'attributo.
    els.levelDrawn.toggleAttribute('hidden', Boolean(file));
    if (file) els.levelImg.src = file;
  }

  function renderWeek(stats, today) {
    const goal = ctx.getPrefs().weeklyGoal;
    const week = Mo.weekOf(stats, today);
    const count = Mo.countText(week, goal);
    els.goalButton.textContent = Mo.goalButtonText(goal);
    els.skyDone.textContent = count.value;
    els.skyRest.textContent = count.rest;
    els.skyNote.textContent = Mo.skyNote(week, goal);
    els.skyFrame.setAttribute('aria-label', Mo.skyLabel(week, goal));
    renderDays(week);
    const recap = Mo.lastWeekText(Mo.lastWeek(stats, today));
    els.recap.hidden = !recap;
    els.recapText.textContent = recap;
    renderSky(week, goal);
  }

  /** Sotto il cielo, i giorni con il numero di attività; quelli che devono ancora venire hanno un puntino. */
  function renderDays(week) {
    els.skyDays.replaceChildren(...week.days.map(entry => {
      const cell = document.createElement('span');
      cell.className = 'sky__day' + (entry.isToday ? ' is-today' : '');
      const value = document.createElement('b');
      value.textContent = entry.isFuture ? '·' : String(entry.done);
      cell.append(value, document.createTextNode(entry.letter));
      return cell;
    }));
  }

  function svg(name, attrs) {
    const node = document.createElementNS(SVG, name);
    Object.keys(attrs).forEach(key => node.setAttribute(key, attrs[key]));
    return node;
  }

  /**
   * Il cielo: la fascia di oggi, le linee della costellazione (raggiunto l'obiettivo), i cerchi delle stelle che mancano e
   * le stelle, ognuna con il suo alone. Si ridisegna solo se cambia. Se la settimana è appena diventata una costellazione
   * e la scheda si vede, le linee appaiono piano (opacity).
   */
  function renderSky(week, goal) {
    const sky = Mo.sky(week, goal);
    const key = JSON.stringify([week.start, week.todayIndex, sky.stars, sky.ghosts, sky.lines]);
    const appeared = sky.reached && shownWeek === week.start && !shownReached;
    shownWeek = week.start;
    shownReached = sky.reached;
    if (key === shownSky) return;
    shownSky = key;

    const { width, height } = Mo.MOTIVATION.sky;
    const col = width / 7;
    const nodes = [];
    if (week.todayIndex >= 0) {
      nodes.push(svg('rect', { class: 'sky-band', x: week.todayIndex * col + 3, y: 6, width: col - 6, height: height - 12, rx: 12 }));
    }
    let lines = null;
    if (sky.lines.length) {
      const point = star => star.x + ' ' + star.y;
      lines = svg('path', { class: 'sky-line', d: sky.lines.map(([a, b]) => 'M' + point(sky.stars[a]) + 'L' + point(sky.stars[b])).join('') });
      nodes.push(lines);
    }
    sky.ghosts.forEach(ghost => nodes.push(svg('circle', { class: 'sky-ghost', cx: ghost.x, cy: ghost.y, r: 2.4 })));
    sky.stars.forEach(star => {
      const group = svg('g', { class: 'sky-star' });
      group.append(
        svg('circle', { class: 'sky-halo', cx: star.x, cy: star.y, r: Math.round(star.r * HALO * 10) / 10 }),
        svg('circle', { class: 'sky-dot', cx: star.x, cy: star.y, r: star.r })
      );
      nodes.push(group);
    });
    els.skyLayer.replaceChildren(...nodes);
    if (appeared && lines && ctx.isActive()) M.flash(lines, 'is-appearing');
  }

  /** «I tuoi numeri»: sei riquadri; senza minuti di focus, una riga dice da dove arrivano. */
  function renderNumbers(stats, today) {
    const values = Mo.numbers(stats, today);
    els.numsGrid.replaceChildren(...Mo.numberRows(values).map(row => {
      const item = document.createElement('div');
      item.className = 'num';
      const label = document.createElement('dt');
      label.textContent = row.label;
      const value = document.createElement('dd');
      value.textContent = row.value;
      item.append(label, value);
      return item;
    }));
    els.numsHint.hidden = values.focusTotal > 0;
  }

  /* ---------- Gesti ed effetti ---------- */

  /** Un tocco sull'obiettivo passa al successivo (nessuno → 5 → 10 → 15 → 20 → 30 → 50 → nessuno) e lo salva. */
  function onGoal() {
    const goal = Mo.nextGoal(ctx.getPrefs().weeklyGoal);
    ctx.setPrefs({ weeklyGoal: goal });
    renderWeek(ctx.getState().stats, utils.todayISO());
    els.goalLive.textContent = Mo.goalAnnouncement(goal);
  }

  /**
   * La scheda si è appena aperta: le stelle si accendono una dopo l'altra (opacity e scale), dopo l'entrata del riquadro.
   * Un gradino ogni quarto di --dur-quick, tutte entro --dur-tab; le prime 24, le altre ci sono già.
   * Con «Riduci movimento» niente.
   */
  function enter() {
    glints.forEach(animation => animation.cancel());
    glints = [];
    if (!M.canAnimate()) return;
    const stars = Array.from(els.skyLayer.querySelectorAll('.sky-star')).slice(0, GLINT_MAX);
    if (!stars.length) return;
    const step = stars.length > 1 ? Math.min(M.ms('quick') / 4, M.ms('tab') / (stars.length - 1)) : 0;
    const animations = stars.map((star, i) => star.animate([
      { opacity: 0, transform: 'scale(.4)' },
      { opacity: 1, transform: 'none' }
    ], { duration: M.ms('move'), delay: M.ms('quick') + i * step, easing: M.ease('out'), fill: 'backwards' }));
    glints = animations;
    // Rete di sicurezza: se i fotogrammi si fermano (pagina nascosta), le stelle arrivano comunque accese.
    const end = M.ms('quick') + (stars.length - 1) * step + M.ms('move');
    setTimeout(() => animations.forEach(animation => {
      if (animation.playState === 'running' || animation.playState === 'paused') animation.finish();
    }), end + 100);
  }

  /**
   * Dopo un completamento (`result` di Aura.points.setDone): { level, reached }. `level` è il livello raggiunto, se il
   * completamento ha fatto salire; `reached` dice se la settimana è appena diventata una costellazione: l'avviso parte una
   * volta per settimana. Con la scheda aperta il distintivo fa un piccolo salto. Le frasi dell'avviso le scrive app.js.
   */
  function celebrate(result) {
    const total = result.stats.totalPoints;
    const level = Mo.levelUp(total - result.points, total);
    const week = Mo.weekOf(result.stats, utils.todayISO());
    const goal = ctx.getPrefs().weeklyGoal;
    let reached = false;
    if (goal !== null && week.done === goal && celebratedWeek !== week.start) {
      celebratedWeek = week.start;
      reached = true;
    }
    if (level && ctx.isActive()) M.flash(els.levelBadge, 'is-leveling');
    return { level, reached };
  }

  /* ---------- Avvio ---------- */

  function init(context) {
    ctx = context;
    Object.assign(els, {
      levelBadge: byId('level-badge'),
      levelDrawn: byId('level-drawn'),
      levelRank: byId('level-rank'),
      levelName: byId('level-name'),
      levelStep: byId('level-step'),
      levelFill: byId('level-fill'),
      levelNote: byId('level-note'),
      goalButton: byId('goal-button'),
      goalLive: byId('goal-live'),
      skyFrame: byId('sky-frame'),
      skyLayer: byId('sky-layer'),
      skyDone: byId('sky-done'),
      skyRest: byId('sky-rest'),
      skyDays: byId('sky-days'),
      skyNote: byId('sky-note'),
      recap: byId('sky-recap'),
      recapText: byId('sky-recap-text'),
      numsGrid: byId('nums-grid'),
      numsHint: byId('nums-hint')
    });
    // L'illustrazione del livello: decorativa (il nome è scritto accanto). Se non si carica, resta il distintivo disegnato.
    const img = document.createElement('img');
    img.className = 'lvl__img';
    img.width = 60;
    img.height = 60;
    img.alt = '';
    img.decoding = 'async';
    img.hidden = true;
    img.addEventListener('error', () => {
      img.hidden = true;
      els.levelDrawn.removeAttribute('hidden');
    });
    els.levelBadge.prepend(img);
    els.levelImg = img;

    els.goalButton.addEventListener('click', onGoal);
    return { render, enter, celebrate };
  }

  Aura.motivationUI = { init };
})(window.Aura = window.Aura || {});
