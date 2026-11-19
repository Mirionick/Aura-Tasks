/*
 * Aura Tasks — scheda Agenda a calendario (P-003, passo 3.2; vedi docs/tre-modalita.md, «Agenda a calendario»).
 * Il calendario del mese (o della settimana del giorno scelto) con i puntini; sotto, il giorno scelto con «In giornata» e
 * «Con orario» (spazi liberi con il «+», linea dell'ora, sovrapposizioni), «Prossimi giorni» e «Da pianificare» con «Metti a…».
 * Tocca la pagina come app.js, che con init() gli passa quello che serve: stato, commit, card, avvisi, foglio «Nuova attività»,
 * preferenze. La logica sta in js/agenda.js; qui solo disegno, gesti e movimenti (Aura.motion, solo transform e opacity).
 */
(function (Aura) {
  'use strict';

  const { utils, tasks: T, agenda: A, motion: M } = Aura;

  const byId = id => document.getElementById(id);
  const SVG = 'http://www.w3.org/2000/svg';
  // Scorrimento di lato sul calendario: almeno 40 px, e 1,3 volte più in orizzontale che in verticale. Il tocco che arriva
  // subito dopo (lo stesso dito) non sceglie un giorno: si ignora per 400 ms.
  const SWIPE = { min: 40, ratio: 1.3, clickMs: 400 };
  const SLIDE = 40; // px: il mese (o la settimana) nuovo entra dalla parte verso cui si va
  const KEY_STEPS = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }; // frecce della tastiera tra i giorni

  let ctx = null;
  const els = {};
  // Stato della scheda: vista (salvata in prefs.agendaView), mese mostrato, giorno scelto e il giorno di oggi all'ultimo disegno.
  const view = { mode: 'month', month: null, selected: null, today: null };
  let shownSchedule = ''; // impronta delle righe di «Con orario» disegnate: ogni minuto si ridisegnano solo se cambiano
  let swipe = null;       // dove si è appoggiato il dito sul calendario: { x, y }
  let swipedAt = 0;       // quando è finito l'ultimo scorrimento di lato

  /* ---------- Disegno ---------- */

  /** Tutta la scheda, adesso `now` (Date). La chiama render() di app.js, dentro commit() (così le card scivolano). */
  function render(now) {
    const today = utils.toISODate(now);
    if (view.today !== today) {
      // Primo disegno, oppure è cambiato il giorno (mezzanotte, ritorno nell'app): chi guardava oggi resta su oggi.
      if (!view.selected || view.selected === view.today) {
        view.selected = today;
        view.month = A.monthOf(today);
      }
      view.today = today;
    }
    const tasks = ctx.getState().tasks;
    renderCalendar(tasks, today);
    renderDay(tasks, now, today);
    const plan = A.planDate(view.selected, today);
    renderList(els.upcoming, els.upcomingInfo, els.upcomingList, A.upcoming(tasks, today, view.selected), now, { showDate: true });
    renderList(els.unplanned, els.unplannedInfo, els.unplannedList, A.unplanned(tasks), now, { plan, today });
  }

  function renderCalendar(tasks, today) {
    const cal = A.calendar(tasks, view, today);
    const title = A.monthTitle(cal.month);
    if (els.month.textContent !== title) els.month.textContent = title; // annunciato (aria-live) solo quando cambia
    const focused = els.grid.contains(document.activeElement) ? document.activeElement.dataset.date : null;
    const fragment = document.createDocumentFragment();
    cal.rows.forEach(row => row.forEach(cell => fragment.appendChild(cell ? dayButton(cell, today) : blankCell())));
    els.grid.replaceChildren(fragment);
    // Con Tab si raggiunge un giorno solo (quello scelto); con le frecce si va agli altri.
    const buttons = Array.from(els.grid.querySelectorAll('.cal__day'));
    const current = buttons.find(button => button.dataset.date === view.selected) || buttons[0];
    if (current) current.tabIndex = 0;
    const again = focused && buttons.find(button => button.dataset.date === focused);
    if (again) {
      buttons.forEach(button => { button.tabIndex = button === again ? 0 : -1; });
      again.focus({ preventScroll: true }); // il giorno toccato è stato ridisegnato: il fuoco resta lì
    }

    const week = view.mode === 'week';
    els.cal.classList.toggle('is-week', week);
    els.today.hidden = view.selected === today && view.month === A.monthOf(today);
    els.handle.setAttribute('aria-expanded', String(!week));
    els.handleText.textContent = week ? 'Tutto il mese' : 'Solo la settimana';
    els.prev.setAttribute('aria-label', week ? 'Settimana prima' : 'Mese prima');
    els.next.setAttribute('aria-label', week ? 'Settimana dopo' : 'Mese dopo');
  }

  function dayButton(cell, today) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cal__day' + (cell.isToday ? ' is-today' : '') + (cell.isSelected ? ' is-selected' : '') + (cell.isPast ? ' is-past' : '');
    button.dataset.date = cell.date;
    button.tabIndex = -1;
    button.setAttribute('aria-pressed', String(cell.isSelected));
    button.setAttribute('aria-label', A.cellLabel(cell, today));
    const number = document.createElement('span');
    number.className = 'cal__num';
    number.textContent = cell.day;
    const dots = document.createElement('span');
    dots.className = 'cal__dots';
    cell.dots.forEach(kind => {
      const dot = document.createElement('span');
      dot.className = 'cal__dot cal__dot--' + kind;
      dots.appendChild(dot);
    });
    button.append(number, dots);
    return button;
  }

  /** Un giorno di un altro mese, nella griglia del mese: resta vuoto. */
  function blankCell() {
    const blank = document.createElement('span');
    blank.className = 'cal__blank';
    blank.setAttribute('aria-hidden', 'true');
    return blank;
  }

  /** Il giorno scelto: titolo, numeri, «In giornata» e «Con orario», oppure la frase del giorno libero. */
  function renderDay(tasks, now, today) {
    const spot = focusSpot();
    const day = view.selected;
    const info = A.dayTasks(tasks, day, today);
    els.dayTitle.textContent = A.dayTitle(day, today);
    els.dayInfo.textContent = A.dayInfo(info);
    const blocks = [];
    let rows = [];
    if (!info.untimed.length && !info.timed.length) {
      const empty = document.createElement('p');
      empty.className = 'day__empty';
      empty.dataset.flip = 'day:empty';
      empty.textContent = A.emptyText(day, today);
      blocks.push(empty);
    }
    if (info.untimed.length) {
      const list = document.createElement('ul');
      list.className = 'task-list';
      info.untimed.forEach(task => list.appendChild(ctx.buildTask(task, now)));
      blocks.push(group('In giornata', 'untimed', list));
    }
    if (info.timed.length) {
      rows = A.schedule(info.timed, day, now);
      const list = document.createElement('ol');
      list.className = 'sched';
      rows.forEach(row => list.appendChild(scheduleRow(row, now)));
      blocks.push(group('Con orario', 'timed', list));
    }
    els.dayBody.replaceChildren(...blocks);
    shownSchedule = scheduleKey(rows);
    restoreFocus(spot);
  }

  // Se il fuoco era dentro il giorno (per esempio sul «+» di uno spazio libero), dopo il ridisegno torna allo stesso
  // pulsante della stessa riga (stessa chiave data-flip), se c'è ancora: il minuto che passa non lo fa perdere.
  const FOCUSABLE = 'button, [href], input, select, textarea';
  function focusSpot() {
    const el = document.activeElement;
    const row = el && el !== els.dayBody && els.dayBody.contains(el) ? el.closest('[data-flip]') : null;
    return row ? { key: row.dataset.flip, index: Array.from(row.querySelectorAll(FOCUSABLE)).indexOf(el) } : null;
  }
  function restoreFocus(spot) {
    if (!spot || els.dayBody.contains(document.activeElement)) return;
    const row = Array.from(els.dayBody.querySelectorAll('[data-flip]')).find(el => el.dataset.flip === spot.key);
    const target = row && spot.index >= 0 ? row.querySelectorAll(FOCUSABLE)[spot.index] : null;
    if (target) target.focus({ preventScroll: true });
  }

  /** Un gruppo del giorno scelto: titolo piccolo e lista, che scivolano insieme (data-flip). */
  function group(title, key, list) {
    const block = document.createElement('div');
    block.className = 'day__block';
    block.dataset.flip = 'day:' + key;
    const heading = document.createElement('h3');
    heading.className = 'day__group';
    heading.textContent = title;
    block.append(heading, list);
    return block;
  }

  /** Una riga di «Con orario»: un'attività con l'ora a sinistra, uno spazio libero con il «+», oppure la linea dell'ora. */
  function scheduleRow(row, now) {
    const li = document.createElement('li');
    if (row.kind === 'now') {
      li.className = 'sched__now';
      li.dataset.flip = 'now';
      const time = document.createElement('span');
      const label = document.createElement('span');
      label.className = 'sr-only';
      label.textContent = 'Adesso, ';
      const value = document.createElement('span');
      value.className = 'sched__now-value';
      value.textContent = A.formatMinutes(row.at);
      time.append(label, value);
      const line = document.createElement('span');
      line.className = 'sched__line';
      line.setAttribute('aria-hidden', 'true');
      li.append(time, line);
      return li;
    }

    li.className = 'sched__row';
    const time = document.createElement('span');
    time.className = 'sched__time';
    if (row.kind === 'free') {
      const from = A.formatMinutes(row.from);
      li.dataset.flip = 'free:' + row.to; // la fine resta uguale mentre passa il tempo: fuoco e movimento ritrovano la riga
      const box = document.createElement('div');
      box.className = 'sched__free';
      const text = document.createElement('span');
      text.className = 'sched__free-text';
      text.textContent = A.freeLabel(row.from, row.to);
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'icon-btn sched__add';
      add.dataset.addTime = from;
      add.setAttribute('aria-label', 'Aggiungi un\'attività alle ' + from);
      add.appendChild(icon('i-plus'));
      box.append(text, add);
      li.append(time, box);
      return li;
    }

    const task = row.task;
    li.dataset.flip = 'task:' + task.id; // scivola la riga intera, con l'ora: la card dentro non ha una chiave sua
    if (T.isTimePassed(task, now)) {
      // Oggi, con l'ora già passata: rossa come nella card di Focus, e detta anche al lettore di schermo.
      time.classList.add('is-late');
      const late = document.createElement('span');
      late.className = 'sr-only';
      late.textContent = 'In ritardo, era alle ';
      time.appendChild(late);
    }
    time.appendChild(document.createTextNode(task.time));
    const list = document.createElement('ul');
    list.className = 'task-list sched__card';
    const card = ctx.buildTask(task, now, { showTime: false });
    delete card.dataset.flip;
    if (row.overlap) {
      const note = document.createElement('span');
      note.className = 'task__note';
      note.textContent = 'Si sovrappone a «' + row.overlap + '»';
      card.querySelector('.task__body').appendChild(note);
    }
    list.appendChild(card);
    li.append(time, list);
    return li;
  }

  /** «Prossimi giorni» e «Da pianificare»: nascoste se vuote. `plan`: il giorno di «Metti a…» (null: niente pulsante). */
  function renderList(section, info, list, tasks, now, { showDate = false, plan = null, today = null } = {}) {
    section.hidden = tasks.length === 0;
    info.textContent = tasks.length ? tasks.length + ' attività · ' + utils.formatDuration(T.totalMinutes(tasks)) : '';
    list.replaceChildren(...tasks.map(task => {
      const card = ctx.buildTask(task, now, { showDate });
      if (plan) card.querySelector('.task__meta').appendChild(planButton(task, plan, today));
      return card;
    }));
  }

  function planButton(task, date, today) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'plan-btn';
    button.dataset.plan = task.id;
    button.textContent = 'Metti a ' + A.dayShort(date, today);
    button.setAttribute('aria-label', 'Metti a ' + A.dayWords(date, today) + ': ' + task.title);
    return button;
  }

  function icon(name) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const use = document.createElementNS(SVG, 'use');
    use.setAttribute('href', '#' + name);
    svg.appendChild(use);
    return svg;
  }

  // Impronta delle righe di «Con orario»: ordine, attività e spazi liberi (l'ora della linea si aggiorna da sola).
  const scheduleKey = rows => rows.map(row => (row.kind === 'task' ? row.task.id : row.kind === 'free' ? row.from + '-' + row.to : 'now')).join('|');

  /**
   * Ogni minuto (da app.js): se il giorno scelto è oggi, la linea dell'ora segna l'ora nuova. Le righe si ridisegnano solo
   * se cambiano (la linea passa un'attività, uno spazio libero si accorcia), così un pulsante con il fuoco di solito resta.
   */
  function tick(now) {
    const today = utils.toISODate(now);
    if (view.selected !== today || view.today !== today) return;
    const tasks = ctx.getState().tasks;
    const info = A.dayTasks(tasks, today, today);
    const rows = info.timed.length ? A.schedule(info.timed, today, now) : [];
    if (scheduleKey(rows) !== shownSchedule) {
      renderDay(tasks, now, today);
      return;
    }
    const line = rows.find(row => row.kind === 'now');
    const value = els.dayBody.querySelector('.sched__now-value');
    if (line && value) value.textContent = A.formatMinutes(line.at);
  }

  /* ---------- Gesti ---------- */

  /**
   * Ridisegna la scheda dopo un gesto sul calendario, con un movimento: il calendario nuovo entra di lato (`slide`: -1, 1)
   * o sfuma (0); il giorno scelto sfuma; «Prossimi giorni» e «Da pianificare» scivolano al posto nuovo se l'altezza cambia.
   */
  function redraw({ slide = null } = {}) {
    const below = [els.upcoming, els.unplanned];
    const tops = below.map(el => (el.hidden ? null : el.getBoundingClientRect().top));
    render(new Date());
    if (!ctx.isActive() || !M.canAnimate()) return;
    if (slide !== null) M.slideIn(els.grid, slide * SLIDE);
    M.slideIn(els.day, 0);
    below.forEach((el, i) => {
      if (tops[i] !== null && !el.hidden) M.shiftIn(el, tops[i] - el.getBoundingClientRect().top);
    });
  }

  function selectDay(date) {
    if (date === view.selected) return;
    view.selected = date;
    view.month = A.monthOf(date); // anche in settimana, che può stare a cavallo di due mesi: «Oggi» lo guarda
    redraw();
  }

  /** Frecce e scorrimento di lato: il mese o la settimana prima (-1) o dopo (+1). */
  function go(step) {
    Object.assign(view, A.navigate(view, step, utils.todayISO()));
    redraw({ slide: step });
  }

  /** «Oggi»: torna a oggi, dal mese o dalla settimana in cui si è. */
  function goToday() {
    const today = utils.todayISO();
    const step = Math.sign(utils.daysBetween(view.selected, today));
    const sameView = view.mode === 'week' ? A.mondayOf(today) === A.mondayOf(view.selected) : A.monthOf(today) === view.month;
    view.selected = today;
    view.month = A.monthOf(today);
    redraw({ slide: sameView ? null : step });
  }

  /**
   * Maniglia: «Solo la settimana» riduce il calendario alla settimana del giorno scelto, «Tutto il mese» lo riapre.
   * La scelta si ricorda (prefs.agendaView). Le sezioni sotto scivolano al posto nuovo (FLIP, Aura.motion); il calendario,
   * che sta sopra di loro, cambia altezza subito e i suoi giorni sfumano.
   */
  function toggleView() {
    const before = ctx.isActive() ? M.snapshot(els.main) : null;
    view.mode = view.mode === 'week' ? 'month' : 'week';
    view.month = A.monthOf(view.selected);
    ctx.setPrefs({ agendaView: view.mode });
    render(new Date());
    if (!before) return;
    M.play(els.main, before);
    M.slideIn(els.grid, 0);
  }

  /** «Metti a…»: dà a un'attività senza giorno il giorno scelto. L'avviso ha «Annulla». */
  function planTask(id) {
    const today = utils.todayISO();
    const date = A.planDate(view.selected, today);
    const tasks = ctx.getState().tasks;
    const task = tasks.find(item => item.id === id);
    if (!date || !task || task.done || task.date) return;
    const result = T.updateTask(tasks, id, { ...T.editableFields(task), date });
    if (!result.changed) return;
    ctx.setEdited(id); // la card arriva nel giorno scelto (o in «Prossimi giorni») con il bagliore della modifica
    if (!ctx.commit(result.tasks)) return;
    ctx.showToast('Pianificata per ' + A.dayShort(date, today), {
      action: 'Annulla',
      onAction: () => {
        const undo = T.updateTask(ctx.getState().tasks, id, T.editableFields(result.previous));
        if (undo.changed) ctx.commit(undo.tasks);
      }
    });
  }

  function onGridClick(event) {
    const button = event.target.closest('.cal__day');
    if (!button) return;
    if (Date.now() - swipedAt < SWIPE.clickMs) return; // il tocco che chiude uno scorrimento
    selectDay(button.dataset.date);
  }

  function onGridKey(event) {
    const step = KEY_STEPS[event.key];
    const from = event.target.closest('.cal__day');
    if (!step || !from) return;
    const target = els.grid.querySelector('.cal__day[data-date="' + utils.addDays(from.dataset.date, step) + '"]');
    if (!target) return;
    event.preventDefault();
    from.tabIndex = -1;
    target.tabIndex = 0;
    target.focus();
  }

  function onPointerDown(event) {
    swipe = event.isPrimary ? { x: event.clientX, y: event.clientY } : null;
  }

  function onPointerUp(event) {
    if (!swipe) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) < SWIPE.min || Math.abs(dx) < Math.abs(dy) * SWIPE.ratio) return;
    swipedAt = Date.now();
    go(dx < 0 ? 1 : -1);
  }

  /* ---------- Per app.js ---------- */

  /** true se l'attività si vede adesso nell'Agenda (dipende anche dal giorno scelto). */
  function isVisible(task, today) {
    return A.isInAgenda(task, today, view.selected || today);
  }

  /** I campi che «Nuova attività» propone dall'Agenda: il giorno scelto, mai uno passato (allora nessuno). */
  function addPreset() {
    const date = A.planDate(view.selected || utils.todayISO(), utils.todayISO());
    return date ? { date } : null;
  }

  function init(context) {
    ctx = context;
    Object.assign(els, {
      main: byId('main'),
      tab: byId('tab-agenda'),
      cal: byId('cal'),
      month: byId('cal-month'),
      today: byId('cal-today'),
      prev: byId('cal-prev'),
      next: byId('cal-next'),
      grid: byId('cal-grid'),
      handle: byId('cal-handle'),
      handleText: byId('cal-handle-text'),
      day: byId('agenda-day'),
      dayTitle: byId('agenda-day-title'),
      dayInfo: byId('agenda-day-info'),
      dayBody: byId('agenda-day-body'),
      upcoming: byId('agenda-upcoming'),
      upcomingInfo: byId('agenda-upcoming-info'),
      upcomingList: byId('agenda-upcoming-list'),
      unplanned: byId('agenda-unplanned'),
      unplannedInfo: byId('agenda-unplanned-info'),
      unplannedList: byId('agenda-unplanned-list')
    });
    view.mode = ctx.getPrefs().agendaView;

    els.prev.addEventListener('click', () => go(-1));
    els.next.addEventListener('click', () => go(1));
    els.today.addEventListener('click', goToday);
    els.handle.addEventListener('click', toggleView);
    els.grid.addEventListener('click', onGridClick);
    els.grid.addEventListener('keydown', onGridKey);
    els.grid.addEventListener('pointerdown', onPointerDown);
    els.grid.addEventListener('pointerup', onPointerUp);
    els.grid.addEventListener('pointercancel', () => { swipe = null; });
    // «Metti a…» e il «+» degli spazi liberi (spunta, modifica e cestino delle card li gestisce app.js, su tutta la lista).
    els.tab.addEventListener('click', event => {
      const plan = event.target.closest('[data-plan]');
      if (plan) {
        planTask(plan.dataset.plan);
        return;
      }
      const add = event.target.closest('[data-add-time]');
      if (add) ctx.openAddSheet(null, null, { date: view.selected, time: add.dataset.addTime });
    });

    return { render, tick, isVisible, addPreset };
  }

  Aura.agendaUI = { init };
})(window.Aura = window.Aura || {});
