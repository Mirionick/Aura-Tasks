/*
 * Aura Tasks — attività che si ripetono (P-005, passo 5.1).
 * Solo funzioni pure: le regole, il giorno della prossima volta, i testi della regola e la pulizia dei dati letti.
 * Le regole lavorano su date 'AAAA-MM-GG', non su ore: il cambio dell'ora non sposta niente.
 * Una regola è { every: 'day' }, { every: 'week', days: [1, 4] } (1 = lunedì … 7 = domenica, in ordine e senza doppi)
 * oppure { every: 'month', day: 31 } (nei mesi più corti vale l'ultimo giorno). Niente DOM, niente localStorage.
 */
(function (Aura) {
  'use strict';

  const { utils } = Aura;

  const KINDS = ['day', 'week', 'month'];
  /** I giorni della settimana, dal lunedì (1) alla domenica (7): l'indice è il giorno meno uno. */
  const DAY_NAMES = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
  const DAY_LETTERS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
  const WORKDAYS = '1,2,3,4,5';
  const SERIES_ID_MAX = 100;

  const dayMonth = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long' });
  const dayMonthYear = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

  const pad2 = n => String(n).padStart(2, '0');
  const isoOf = (y, m, d) => y + '-' + pad2(m) + '-' + pad2(d);
  /** Quanti giorni ha un mese (`month` da 1 a 12). */
  const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

  /** Giorno della settimana di una data: 1 = lunedì … 7 = domenica. */
  function weekdayOf(iso) {
    const day = utils.parseISODate(iso).getDay();
    return day === 0 ? 7 : day;
  }

  /**
   * Una regola letta (dall'archivio, da un backup o dal foglio) → regola valida, oppure null se non è valida.
   * I giorni della settimana si mettono in ordine e senza doppi. I campi sconosciuti restano, come nelle attività.
   */
  function clean(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !KINDS.includes(raw.every)) return null;
    if (raw.every === 'week') {
      const days = Array.isArray(raw.days) ? raw.days.filter(day => Number.isInteger(day) && day >= 1 && day <= 7) : [];
      if (!days.length) return null;
      return { ...raw, days: Array.from(new Set(days)).sort((a, b) => a - b) };
    }
    if (raw.every === 'month') {
      return Number.isInteger(raw.day) && raw.day >= 1 && raw.day <= 31 ? { ...raw } : null;
    }
    return { ...raw };
  }

  /** Due regole uguali (anche null)? Contano solo tipo, giorni della settimana e giorno del mese. */
  function same(a, b) {
    if (!a || !b) return !a && !b;
    if (a.every !== b.every) return false;
    if (a.every === 'week') return a.days.join() === b.days.join();
    if (a.every === 'month') return a.day === b.day;
    return true;
  }

  /** La regola che le chip del foglio accendono per prima: il giorno della settimana o del mese viene dalla data. */
  function fromKind(kind, date) {
    if (kind === 'day') return { every: 'day' };
    if (kind === 'week') return { every: 'week', days: [weekdayOf(date)] };
    if (kind === 'month') return { every: 'month', day: Number(date.slice(8, 10)) };
    return null;
  }

  /** Il primo giorno della regola DOPO `iso` (escluso). */
  function nextAfter(rule, iso) {
    if (rule.every === 'day') return utils.addDays(iso, 1);
    if (rule.every === 'week') {
      for (let ahead = 1; ahead <= 7; ahead++) {
        const day = utils.addDays(iso, ahead);
        if (rule.days.includes(weekdayOf(day))) return day;
      }
      return null; // non succede con una regola pulita da clean()
    }
    const [year, month, day] = iso.split('-').map(Number);
    const thisMonth = Math.min(rule.day, daysInMonth(year, month));
    if (thisMonth > day) return isoOf(year, month, thisMonth);
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    return isoOf(nextYear, nextMonth, Math.min(rule.day, daysInMonth(nextYear, nextMonth)));
  }

  /** Il primo giorno della regola da `iso` in poi (`iso` compreso). */
  function onOrAfter(rule, iso) {
    return nextAfter(rule, utils.addDays(iso, -1));
  }

  /**
   * Completata: la prossima va al primo giorno della regola dopo il più tardi tra il giorno di questa e oggi.
   * In anticipo (quella di lunedì, il sabato prima) non cade lo stesso lunedì; in ritardo non va nel passato.
   */
  function afterDone(rule, date, today) {
    return nextAfter(rule, date && date > today ? date : today);
  }

  /**
   * «Salta questa volta»: al primo giorno della regola dopo il suo, ma non prima di oggi. Oggi è compreso, a differenza
   * di afterDone(): la volta saltata non è stata fatta, quindi quella di oggi resta da fare.
   */
  function afterSkip(rule, date, today) {
    if (!date) return onOrAfter(rule, today);
    const next = nextAfter(rule, date);
    return next >= today ? next : onOrAfter(rule, today);
  }

  /** [a] → "a"; [a, b] → "a e b"; [a, b, c] → "a, b e c". */
  function joinList(items) {
    return items.length < 2 ? items.join('') : items.slice(0, -1).join(', ') + ' e ' + items[items.length - 1];
  }

  /**
   * Il testo della regola: "Ogni giorno", "Ogni lunedì e giovedì", "Dal lunedì al venerdì", "Ogni mese, il giorno 15",
   * "Ogni mese, il giorno 30 (a febbraio l'ultimo)" e "Ogni mese, l'ultimo giorno" (il 31).
   */
  function label(rule) {
    if (rule.every === 'day' || (rule.every === 'week' && rule.days.length === 7)) return 'Ogni giorno';
    if (rule.every === 'week') {
      if (rule.days.join() === WORKDAYS) return 'Dal lunedì al venerdì';
      return 'Ogni ' + joinList(rule.days.map(day => DAY_NAMES[day - 1]));
    }
    if (rule.day === 31) return 'Ogni mese, l\'ultimo giorno';
    return 'Ogni mese, il giorno ' + rule.day + (rule.day > 28 ? ' (a febbraio l\'ultimo)' : '');
  }

  /** Per il lettore di schermo, sull'icona della card: "Si ripete ogni lunedì e giovedì". */
  function spokenLabel(rule) {
    const text = label(rule);
    return 'Si ripete ' + text.charAt(0).toLowerCase() + text.slice(1);
  }

  /** Un giorno per gli avvisi: "oggi", "domani", "giovedì 26 novembre" (con l'anno, se è un altro). */
  function dayLabel(iso, today) {
    const diff = utils.daysBetween(today, iso);
    if (diff === 0) return 'oggi';
    if (diff === 1) return 'domani';
    const format = iso.slice(0, 4) === today.slice(0, 4) ? dayMonth : dayMonthYear;
    return DAY_NAMES[weekdayOf(iso) - 1] + ' ' + format.format(utils.parseISODate(iso));
  }

  /** Quando torna, per l'avviso del completamento: "domani", "giovedì" (entro una settimana), poi come dayLabel(). */
  function returnLabel(iso, today) {
    const diff = utils.daysBetween(today, iso);
    return diff > 1 && diff < 7 ? DAY_NAMES[weekdayOf(iso) - 1] : dayLabel(iso, today);
  }

  /**
   * I due campi delle ripetizioni di un'attività letta: `repeat` (una regola valida, solo con un giorno, altrimenti null)
   * e `seriesId` (lo stesso in tutte le volte di una serie). Un `seriesId` non valido diventa l'id dell'attività; senza
   * regola e senza serie resta null.
   */
  function sanitize(task) {
    const repeat = task.date ? clean(task.repeat) : null;
    const raw = task.seriesId;
    const valid = typeof raw === 'string' && raw.length > 0 && raw.length <= SERIES_ID_MAX;
    const present = raw !== undefined && raw !== null;
    const seriesId = valid ? raw : (repeat || present ? task.id : null);
    return { repeat, seriesId };
  }

  Aura.repeat = {
    KINDS,
    DAY_NAMES,
    DAY_LETTERS,
    weekdayOf,
    clean,
    same,
    fromKind,
    nextAfter,
    onOrAfter,
    afterDone,
    afterSkip,
    label,
    spokenLabel,
    dayLabel,
    returnLabel,
    sanitize
  };
})(window.Aura = window.Aura || {});
