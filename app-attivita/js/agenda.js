/*
 * Aura Tasks — logica dell'Agenda a calendario (P-003, passo 3.2; vedi docs/tre-modalita.md, «Agenda a calendario»).
 * Solo funzioni pure: griglia del mese e settimana del giorno scelto, con i puntini; il giorno scelto diviso tra
 * «In giornata» e «Con orario», con spazi liberi, linea dell'ora e sovrapposizioni; «Prossimi giorni», «Da pianificare»
 * e le frasi. Niente DOM, niente localStorage: l'interfaccia sta in js/ui-agenda.js.
 * Date 'YYYY-MM-DD' e mesi 'YYYY-MM', sempre in ora locale (vedi utils.js); orari in minuti dalla mezzanotte.
 */
(function (Aura) {
  'use strict';

  const { utils, tasks: T } = Aura;

  /** Scelte e soglie dell'Agenda. `views`: viste del calendario, salvate in prefs.agendaView (la prima è quella di partenza). */
  const AGENDA = {
    views: ['month', 'week'],
    maxDots: 3,  // puntini sotto un giorno, al massimo
    minFree: 30, // minuti: uno spazio libero più corto non si mostra
    nowStep: 5   // oggi gli spazi liberi partono da adesso, arrotondato ai 5 minuti dopo
  };
  const DAY_MINUTES = 24 * 60;

  const monthName = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });
  const longDay = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  const longDayWithYear = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const shortDay = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric' });
  const shortDayWithMonth = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });

  const pad2 = n => String(n).padStart(2, '0');

  /* ---------- Mesi e settimane ---------- */

  /** 'YYYY-MM-DD' → 'YYYY-MM'. */
  function monthOf(iso) {
    return iso.slice(0, 7);
  }

  /** true se `value` è un mese 'YYYY-MM' valido. */
  function isMonth(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}$/.test(value) && utils.isISODate(value + '-01');
  }

  /** Il mese `step` mesi dopo `month` (prima, se negativo). */
  function addMonths(month, step) {
    const [year, number] = month.split('-').map(Number);
    const date = new Date(year, number - 1 + step, 1);
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1);
  }

  /** Il lunedì della settimana di `iso`: le settimane partono da lunedì. */
  function mondayOf(iso) {
    return utils.addDays(iso, -((utils.parseISODate(iso).getDay() + 6) % 7));
  }

  /** I sette giorni della settimana di `iso`, da lunedì a domenica. */
  function weekOf(iso) {
    const monday = mondayOf(iso);
    return Array.from({ length: 7 }, (_, i) => utils.addDays(monday, i));
  }

  /**
   * Le settimane del mese, da lunedì, con null al posto dei giorni degli altri mesi (restano vuoti).
   * Da 4 righe (un febbraio di 28 giorni che comincia di lunedì) a 6 (un mese di 30 giorni che comincia di domenica).
   */
  function monthWeeks(month) {
    const last = utils.addDays(addMonths(month, 1) + '-01', -1);
    const weeks = [];
    for (let monday = mondayOf(month + '-01'); monday <= last; monday = utils.addDays(monday, 7)) {
      weeks.push(weekOf(monday).map(day => (monthOf(day) === month ? day : null)));
    }
    return weeks;
  }

  /* ---------- Calendario ---------- */

  /** Le attività da fare con un giorno, divise per giorno: { 'YYYY-MM-DD': [attività in ordine d'ora] }. */
  function openByDay(tasks) {
    const days = Object.create(null);
    tasks.forEach(task => {
      if (task.done || !task.date) return;
      if (!days[task.date]) days[task.date] = [];
      days[task.date].push(task);
    });
    Object.keys(days).forEach(day => days[day].sort(T.compareByTime));
    return days;
  }

  /**
   * I puntini di un giorno: fino a tre, uno per attività da fare (`list`, in ordine d'ora), del colore della sua energia
   * ('low', 'medium', 'high'); in un giorno passato sono tutti 'late' (rossi: in ritardo).
   */
  function dots(list, past) {
    return list.slice(0, AGENDA.maxDots).map(task => (past ? 'late' : task.energy));
  }

  /**
   * Il calendario da disegnare. `view`: { mode: 'month' | 'week', month: 'YYYY-MM', selected: giorno scelto }.
   * Restituisce { month, rows }: `month` è il mese del titolo; `rows` sono le settimane, ognuna di sette caselle:
   * null (un giorno di un altro mese, vuoto) oppure { date, day, isToday, isSelected, isPast, count, dots }.
   * Nella vista settimana c'è una riga sola, la settimana del giorno scelto, con tutti e sette i giorni.
   */
  function calendar(tasks, view, today) {
    const byDay = openByDay(tasks);
    const week = view.mode === 'week';
    const cell = date => {
      if (!date) return null;
      const list = byDay[date] || [];
      const isPast = date < today;
      return {
        date,
        day: Number(date.slice(8)),
        isToday: date === today,
        isSelected: date === view.selected,
        isPast,
        count: list.length,
        dots: dots(list, isPast)
      };
    };
    const rows = week ? [weekOf(view.selected)] : monthWeeks(view.month);
    return { month: week ? monthOf(view.selected) : view.month, rows: rows.map(row => row.map(cell)) };
  }

  /**
   * Frecce e scorrimento di lato: il mese o la settimana prima (step -1) o dopo (+1). Restituisce { month, selected }.
   * Nel mese si sceglie il primo giorno, oppure oggi se è il mese di oggi; nella settimana lo stesso giorno, 7 giorni prima o dopo.
   */
  function navigate(view, step, today) {
    if (view.mode === 'week') {
      const selected = utils.addDays(view.selected, 7 * step);
      return { month: monthOf(selected), selected };
    }
    const month = addMonths(view.month, step);
    return { month, selected: month === monthOf(today) ? today : month + '-01' };
  }

  /* ---------- Il giorno scelto ---------- */

  /** Il giorno di un'attività completata nel calendario: il suo giorno, oppure quello in cui è stata completata, se non ne aveva. */
  function doneDay(task) {
    if (task.date) return task.date;
    return Number.isFinite(task.completedAt) ? utils.todayISO(task.completedAt) : null;
  }

  /**
   * Il giorno scelto: le attività da fare di quel giorno e, se è un giorno passato, anche le completate (barrate).
   * Restituisce { untimed, timed, openCount, openMinutes, doneCount }: `untimed` («In giornata») ha prima quelle da fare,
   * in ordine di creazione; `timed` («Con orario») è in ordine d'ora.
   */
  function dayTasks(tasks, day, today) {
    const past = day < today;
    const list = tasks.filter(task => (task.done ? past && doneDay(task) === day : task.date === day));
    const open = list.filter(task => !task.done);
    const untimed = list
      .filter(task => !task.time)
      .sort((a, b) => (a.done === b.done ? T.compareByCreation(a, b) : a.done ? 1 : -1));
    const timed = list.filter(task => task.time).sort(T.compareByTime);
    return { untimed, timed, openCount: open.length, openMinutes: T.totalMinutes(open), doneCount: list.length - open.length };
  }

  /** 'HH:MM' → minuti dalla mezzanotte. */
  function toMinutes(time) {
    return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  }

  /** Minuti dalla mezzanotte → 'HH:MM'. Oltre la mezzanotte si riparte da 00:00. */
  function formatMinutes(minutes) {
    const value = ((Math.round(minutes) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
    return pad2(Math.floor(value / 60)) + ':' + pad2(value % 60);
  }

  /**
   * Le righe di «Con orario» per il giorno `day`, adesso `now` (Date). `timed`: le attività con orario, in ordine d'ora.
   * - { kind: 'task', task, start, end, overlap }: `overlap` è il titolo dell'attività a cui si sovrappone (quella, tra le
   *   precedenti, che finisce più tardi), oppure null;
   * - { kind: 'free', from, to }: tra due attività, se c'è almeno mezz'ora libera;
   * - { kind: 'now', at }: solo oggi, al suo posto nell'ordine (prima della prima attività che comincia dopo adesso).
   * Orari in minuti dalla mezzanotte: un'attività può finire dopo la mezzanotte (end oltre 1440) e allora dopo di lei non
   * c'è spazio libero. Oggi gli spazi liberi contano da adesso, arrotondato ai 5 minuti dopo.
   * Un giorno passato ha solo le attività: niente spazi liberi, linea dell'ora o sovrapposizioni.
   */
  function schedule(timed, day, now) {
    const today = utils.toISODate(now);
    const past = day < today;
    const isToday = day === today;
    const nowAt = now.getHours() * 60 + now.getMinutes();
    const freeFrom = Math.ceil(nowAt / AGENDA.nowStep) * AGENDA.nowStep;
    const rows = [];
    let nowPlaced = !isToday;
    let latest = null; // tra le attività già in elenco, quella che finisce più tardi: { end, title }
    timed.forEach(task => {
      const start = toMinutes(task.time);
      const end = start + task.duration;
      if (past) {
        rows.push({ kind: 'task', task, start, end, overlap: null });
        return;
      }
      if (!nowPlaced && start > nowAt) {
        rows.push({ kind: 'now', at: nowAt });
        nowPlaced = true;
      }
      if (latest) {
        const from = isToday ? Math.max(latest.end, freeFrom) : latest.end;
        if (start - from >= AGENDA.minFree) rows.push({ kind: 'free', from, to: start });
      }
      rows.push({ kind: 'task', task, start, end, overlap: latest && start < latest.end ? latest.title : null });
      if (!latest || end > latest.end) latest = { end, title: task.title };
    });
    if (!nowPlaced) rows.push({ kind: 'now', at: nowAt });
    return rows;
  }

  /* ---------- Sotto il giorno scelto ---------- */

  /** «Prossimi giorni»: le attività da fare da domani in poi, in ordine di data e ora, tranne quelle del giorno scelto. */
  function upcoming(tasks, today, selected) {
    return tasks.filter(task => !task.done && task.date && task.date > today && task.date !== selected).sort(T.compareByDate);
  }

  /** «Da pianificare»: le attività da fare senza giorno, in ordine di creazione. */
  function unplanned(tasks) {
    return tasks.filter(task => !task.done && !task.date).sort(T.compareByCreation);
  }

  /** Il giorno che «Metti a…» e «Nuova attività» propongono: il giorno scelto, mai uno passato (allora null). */
  function planDate(selected, today) {
    return selected >= today ? selected : null;
  }

  /**
   * true se l'attività si vede nell'Agenda con questo giorno scelto: da fare senza giorno («Da pianificare») o da domani in
   * poi («Prossimi giorni»), da fare nel giorno scelto (anche oggi o un giorno passato), completata in un giorno passato scelto.
   */
  function isInAgenda(task, today, selected) {
    if (task.done) return selected < today && doneDay(task) === selected;
    return !task.date || task.date > today || task.date === selected;
  }

  /* ---------- Frasi ---------- */

  const longLabel = (day, today) =>
    (day.slice(0, 4) === today.slice(0, 4) ? longDay : longDayWithYear).format(utils.parseISODate(day));

  /** "Novembre 2026". */
  function monthTitle(month) {
    return utils.capitalize(monthName.format(utils.parseISODate(month + '-01')));
  }

  /** Titolo del giorno scelto: "Oggi · giovedì 19 novembre", "Domani · …", "Ieri · …", altrimenti "Sabato 21 novembre". */
  function dayTitle(day, today) {
    const diff = utils.daysBetween(today, day);
    const label = longLabel(day, today);
    if (diff === 0) return 'Oggi · ' + label;
    if (diff === 1) return 'Domani · ' + label;
    if (diff === -1) return 'Ieri · ' + label;
    return utils.capitalize(label);
  }

  /** "oggi", "domani", "gio 19" (nel mese di oggi) oppure "gio 3 dic": per «Metti a…» e per il suo avviso. */
  function dayShort(day, today) {
    const diff = utils.daysBetween(today, day);
    if (diff === 0) return 'oggi';
    if (diff === 1) return 'domani';
    return (monthOf(day) === monthOf(today) ? shortDay : shortDayWithMonth).format(utils.parseISODate(day));
  }

  /** Riga accanto al titolo del giorno, da dayTasks(): "5 attività · 3 h 30 min" e, in un giorno passato, "2 completate". */
  function dayInfo(day) {
    const parts = [];
    if (day.openCount) parts.push(day.openCount + ' attività · ' + utils.formatDuration(day.openMinutes));
    if (day.doneCount) parts.push(day.doneCount === 1 ? '1 completata' : day.doneCount + ' completate');
    return parts.join(' · ');
  }

  /** "oggi", "domani" oppure "giovedì 26 novembre": il giorno per esteso, nelle frasi e per il lettore di schermo. */
  function dayWords(day, today) {
    const diff = utils.daysBetween(today, day);
    return diff === 0 ? 'oggi' : diff === 1 ? 'domani' : longLabel(day, today);
  }

  /** Un giorno vuoto: libero, con l'invito ad aggiungere qualcosa; un giorno passato non ha inviti. */
  function emptyText(day, today) {
    if (day < today) return 'Nessuna attività in questo giorno.';
    return 'Giornata libera. Con «Nuova attività» aggiungi qualcosa per ' + dayWords(day, today) + '.';
  }

  /** Quello che il lettore di schermo dice di un giorno del calendario: "Giovedì 19 novembre, oggi, 3 attività". */
  function cellLabel(cell, today) {
    const parts = [utils.capitalize(longLabel(cell.date, today))];
    if (cell.isToday) parts.push('oggi');
    if (cell.count) parts.push(cell.count + ' attività' + (cell.isPast ? ' in ritardo' : ''));
    else parts.push(cell.isPast ? 'nessuna attività' : 'libero');
    return parts.join(', ');
  }

  /** "Libero dalle 09:30 alle 11:30 · 2 h". */
  function freeLabel(from, to) {
    return 'Libero dalle ' + formatMinutes(from) + ' alle ' + formatMinutes(to) + ' · ' + utils.formatDuration(to - from);
  }

  Aura.agenda = {
    AGENDA,
    monthOf,
    isMonth,
    addMonths,
    mondayOf,
    weekOf,
    monthWeeks,
    openByDay,
    dots,
    calendar,
    navigate,
    doneDay,
    dayTasks,
    toMinutes,
    formatMinutes,
    schedule,
    upcoming,
    unplanned,
    planDate,
    isInAgenda,
    monthTitle,
    dayTitle,
    dayShort,
    dayWords,
    dayInfo,
    emptyText,
    cellLabel,
    freeLabel
  };
})(window.Aura = window.Aura || {});
