/*
 * Aura Tasks — utilità generiche.
 * Date sempre in ora LOCALE nel formato 'YYYY-MM-DD', formattazione in italiano, id univoci.
 * Funzioni pure: niente DOM, niente localStorage.
 */
(function (Aura) {
  'use strict';

  const DAY_MS = 24 * 60 * 60 * 1000;

  const shortDate = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  const shortDateWithYear = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const longDate = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  const wholeNumber = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  /** Date → 'YYYY-MM-DD' in ora locale. Mai usare toISOString(): è in UTC e dopo mezzanotte darebbe il giorno prima. */
  function toISODate(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  /** Data di oggi ('YYYY-MM-DD'). `now` (Date o millisecondi) è facoltativo: serve per i test e per i timestamp. */
  function todayISO(now) {
    return toISODate(now === undefined ? new Date() : new Date(now));
  }

  /** 'YYYY-MM-DD' → Date a mezzanotte locale. (new Date('YYYY-MM-DD') la leggerebbe in UTC.) */
  function parseISODate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  /** true se `value` è una data reale nel formato 'YYYY-MM-DD' (rifiuta, per esempio, il 30 febbraio). */
  function isISODate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    return toISODate(parseISODate(value)) === value;
  }

  /** Sposta una data di `days` giorni (anche negativi). Corretto anche nei giorni del cambio d'ora. */
  function addDays(iso, days) {
    const date = parseISODate(iso);
    date.setDate(date.getDate() + days);
    return toISODate(date);
  }

  /** Giorni da `fromIso` a `toIso` (positivo se `toIso` viene dopo). Calcolato in UTC, così il cambio d'ora non conta. */
  function daysBetween(fromIso, toIso) {
    const utc = iso => {
      const [y, m, d] = iso.split('-').map(Number);
      return Date.UTC(y, m - 1, d);
    };
    return Math.round((utc(toIso) - utc(fromIso)) / DAY_MS);
  }

  /** 45 → "45 min", 60 → "1 h", 135 → "2 h 15 min". */
  function formatDuration(minutes) {
    const total = Math.max(0, Math.round(minutes));
    if (total < 60) return total + ' min';
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    return rest ? hours + ' h ' + rest + ' min' : hours + ' h';
  }

  /** Etichetta breve di una data rispetto a oggi: "Oggi", "Domani", "Ieri" oppure "mar 3 nov" (con l'anno, se diverso). */
  function formatDateLabel(iso, today) {
    const diff = daysBetween(today, iso);
    if (diff === 0) return 'Oggi';
    if (diff === 1) return 'Domani';
    if (diff === -1) return 'Ieri';
    const sameYear = iso.slice(0, 4) === today.slice(0, 4);
    return (sameYear ? shortDate : shortDateWithYear).format(parseISODate(iso));
  }

  /** 12345 → "12.345" (separatore delle migliaia italiano; con 4 cifre di solito non si mette: "1240"). */
  function formatNumber(value) {
    return wholeNumber.format(value);
  }

  function capitalize(text) {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
  }

  /** "Giovedì 29 ottobre". */
  function formatLongDate(date) {
    return capitalize(longDate.format(date));
  }

  /** Saluto in base all'ora del giorno. */
  function greeting(date) {
    const hour = date.getHours();
    if (hour >= 5 && hour < 12) return 'Buongiorno';
    if (hour >= 12 && hour < 18) return 'Buon pomeriggio';
    return 'Buonasera';
  }

  /** Id univoco. crypto.randomUUID esiste solo in contesti sicuri (https, localhost): altrimenti si usa un'alternativa. */
  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  Aura.utils = {
    DAY_MS,
    toISODate,
    todayISO,
    parseISODate,
    isISODate,
    addDays,
    daysBetween,
    formatDuration,
    formatDateLabel,
    formatLongDate,
    formatNumber,
    capitalize,
    greeting,
    uid
  };
})(window.Aura = window.Aura || {});
