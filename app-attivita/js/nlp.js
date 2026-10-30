/*
 * Aura Tasks — inserimento in linguaggio naturale.
 * parseTaskText("domani alle 10 dentista", adesso) → { title: 'Dentista', date: '2026-10-30', time: '10:00', … }.
 * Funzioni pure, a regole, offline. Niente DOM, niente localStorage. `now` è sempre un parametro (test ripetibili).
 * Le regex non usano lookbehind né gruppi con nome: Safari su iPhone meno recenti non li supporta.
 */
(function (Aura) {
  'use strict';

  const { utils } = Aura;

  const WEEKDAYS = ['domenica', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato'];
  const WEEKDAYS_SHORT = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const NUMBERS = { un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, venti: 20, trenta: 30, quaranta: 40, cinquanta: 50 };
  const NUMBER = '(\\d{1,3}|' + Object.keys(NUMBERS).join('|') + ')';
  const toNumber = word => (/^\d+$/.test(word) ? Number(word) : NUMBERS[word]);

  /** Parole che, rimaste ai bordi del titolo dopo aver tolto data e ora, non servono più. */
  const LOOSE_WORDS = ['a', 'al', 'alle', 'all', 'il', 'lo', 'la', 'le', 'i', 'gli', 'per', 'di', 'del', 'della', 'da', 'dal', 'dalle',
    'e', 'ed', 'entro', 'verso', 'ore', 'tra', 'fra', 'in', 'con', 'circa', 'poi'];

  /** Ogni carattere in minuscolo e senza accento, con la stessa lunghezza del testo originale. */
  function fold(text) {
    let out = '';
    for (let i = 0; i < text.length; i++) {
      const c = text[i] === '’' || text[i] === '‘' || text[i] === '`' ? '\'' : text[i];
      out += c.normalize('NFD').charAt(0).toLowerCase().charAt(0) || ' ';
    }
    return out;
  }

  /**
   * Cerca i pezzi riconoscibili su una copia "piegata" del testo. take() li segna da togliere dal titolo
   * e li cancella dalla copia, così una regola successiva non li riconosce una seconda volta.
   */
  function scanner(text) {
    let work = fold(text);
    const removed = new Array(text.length).fill(false);
    return {
      find(pattern) {
        const match = new RegExp('(^|[\\s,;(])' + pattern + '(?=$|[\\s,;.!?)])').exec(work);
        if (!match) return null;
        const start = match.index + match[1].length;
        const end = match.index + match[0].length;
        return {
          groups: match.slice(2),
          take() {
            for (let i = start; i < end; i++) removed[i] = true;
            work = work.slice(0, start) + ' '.repeat(end - start) + work.slice(end);
          }
        };
      },
      rest() {
        let out = '';
        for (let i = 0; i < text.length; i++) out += removed[i] ? ' ' : text[i];
        return out;
      }
    };
  }

  const pad2 = n => String(n).padStart(2, '0');
  const isoOf = (y, m, d) => y + '-' + pad2(m) + '-' + pad2(d);

  /* ---------- Orario ---------- */

  /**
   * Ora del giorno da "alle 3", "alle 10:30", "ore 15", "alle 8 di sera"…
   * Senza "mattina" o "sera", le ore dalle 1 alle 7 sono del pomeriggio: "alle 3" → 15:00.
   */
  function toClock(hour, minute, part, evening) {
    let h = hour;
    if (part === 'mattina' || part === 'mattino') {
      if (h === 12) h = 0;
    } else if (part === 'pomeriggio' || part === 'sera') {
      if (h < 12) h += 12;
    } else if (part === 'notte') {
      if (h === 12) h = 0;
      else if (h >= 8 && h < 12) h += 12;
    } else if (evening && h < 12) {
      h += 12; // "stasera alle 9" → 21:00
    } else if (h >= 1 && h <= 7) {
      h += 12;
    }
    if (h > 23 || minute > 59) return null;
    return pad2(h) + ':' + pad2(minute);
  }

  const PART = '(?:\\s+(?:di |del |della )?(mattina|mattino|pomeriggio|sera|notte))?';

  function findTime(scan, evening) {
    const special = scan.find('(?:a |alle )?(mezzogiorno|mezzanotte)');
    if (special) {
      special.take();
      return special.groups[0] === 'mezzogiorno' ? '12:00' : '00:00';
    }
    const one = scan.find('all\'una(?:[:.](\\d{2}))?' + PART);
    if (one) {
      const time = toClock(1, Number(one.groups[0] || 0), one.groups[1], evening);
      if (time) { one.take(); return time; }
    }
    const clock = scan.find('(?:alle(?: ore)?|ore|per le|verso le|dalle)\\s+(\\d{1,2})(?:[:.](\\d{2}))?' + PART);
    if (clock) {
      const time = toClock(Number(clock.groups[0]), Number(clock.groups[1] || 0), clock.groups[2], evening);
      if (time) { clock.take(); return time; }
    }
    return null;
  }

  /* ---------- Durata ---------- */

  function findDuration(scan) {
    const rules = [
      // "1h30", "2 h 15"
      ['(\\d{1,2})\\s*h\\s*(\\d{1,2})', g => Number(g[0]) * 60 + Number(g[1])],
      // "un'ora e mezza", "un'ora e un quarto", "un'ora"
      ['(?:un\'ora|un ora|una ora)(\\s+e\\s+mezza|\\s+e\\s+un\\s+quarto)?', g => 60 + (g[0] ? (/mezza/.test(g[0]) ? 30 : 15) : 0)],
      ['tre quarti d\'ora', () => 45],
      ['(?:un )?quarto d\'ora', () => 15],
      ['(?:mezz\'ora|mezzora|mezza ora)', () => 30],
      // "2 ore e mezza", "1 ora", "1h", "3 ore"
      [NUMBER + '\\s*(?:h|ora|ore)(\\s+e\\s+mezza)?', g => toNumber(g[0]) * 60 + (g[1] ? 30 : 0)],
      // "30 min", "30m", "dieci minuti"
      [NUMBER + '\\s*(?:minuti|minuto|min|m)', g => toNumber(g[0])]
    ];
    for (const [pattern, minutes] of rules) {
      const hit = scan.find(pattern);
      if (hit) {
        hit.take();
        const value = minutes(hit.groups);
        return value >= 1 && value <= 600 ? value : null;
      }
    }
    return null;
  }

  /* ---------- Data ---------- */

  function findDate(scan, today) {
    const base = utils.parseISODate(today);
    const hit = (pattern, toDate) => {
      const found = scan.find(pattern);
      if (!found) return undefined;
      const date = toDate(found.groups);
      if (date) found.take();
      return date || undefined;
    };
    const tries = [
      ['(?:oggi|stamattina|stamane|stasera|stanotte)', () => today],
      ['dopodomani', () => utils.addDays(today, 2)],
      ['domani', () => utils.addDays(today, 1)],
      ['(?:tra|fra)\\s+' + NUMBER + '\\s+(giorni|giorno|settimane|settimana)', g => utils.addDays(today, toNumber(g[0]) * (/^sett/.test(g[1]) ? 7 : 1))],
      ['(?:tra|fra)\\s+(?:una )?settimana', () => utils.addDays(today, 7)],
      // "venerdì", "ven", "venerdì prossimo" (quello della settimana dopo)
      ['(' + WEEKDAYS.join('|') + '|' + WEEKDAYS_SHORT.join('|') + ')(\\s+prossim[oa])?', g => {
        const target = WEEKDAYS.indexOf(g[0]) >= 0 ? WEEKDAYS.indexOf(g[0]) : WEEKDAYS_SHORT.indexOf(g[0]);
        const ahead = (target - base.getDay() + 7) % 7 || 7;
        return utils.addDays(today, ahead + (g[1] ? 7 : 0));
      }],
      // "15/11", "15-11-2026", "15/11/26"
      ['(\\d{1,2})[/-](\\d{1,2})(?:[/-](\\d{4}|\\d{2}))?', g => withYear(Number(g[0]), Number(g[1]), g[2], today)],
      // "15 novembre", "il 15 novembre 2027"
      ['(\\d{1,2})\\s+(' + MONTHS.join('|') + ')(?:\\s+(\\d{4}))?', g => withYear(Number(g[0]), MONTHS.indexOf(g[1]) + 1, g[2], today)],
      // "il 15": il prossimo giorno 15 (oggi compreso)
      ['il\\s+(\\d{1,2})', g => nextDayOfMonth(Number(g[0]), today)]
    ];
    for (const [pattern, toDate] of tries) {
      const date = hit(pattern, toDate);
      if (date) return date;
    }
    return null;
  }

  /** Giorno e mese con l'anno facoltativo: senza anno è il prossimo (oggi compreso). Null se la data non esiste. */
  function withYear(day, month, yearText, today) {
    if (yearText) {
      const year = yearText.length === 2 ? 2000 + Number(yearText) : Number(yearText);
      const iso = isoOf(year, month, day);
      return utils.isISODate(iso) ? iso : null;
    }
    const year = Number(today.slice(0, 4));
    for (let y = year; y <= year + 4; y++) { // 4 anni: il 29 febbraio torna sempre
      const iso = isoOf(y, month, day);
      if (utils.isISODate(iso) && iso >= today) return iso;
    }
    return null;
  }

  function nextDayOfMonth(day, today) {
    if (day < 1 || day > 31) return null;
    let [year, month] = today.split('-').map(Number);
    for (let i = 0; i < 13; i++) {
      const iso = isoOf(year, month, day);
      if (utils.isISODate(iso) && iso >= today) return iso;
      month++;
      if (month > 12) { month = 1; year++; }
    }
    return null;
  }

  /* ---------- Energia ---------- */

  function findEnergy(scan) {
    const explicit = scan.find('energia\\s+(bassa|media|alta)');
    if (explicit) {
      explicit.take();
      return { bassa: 'low', media: 'medium', alta: 'high' }[explicit.groups[0]];
    }
    const low = scan.find('(?:facile|leggera|leggero|veloce)');
    if (low) { low.take(); return 'low'; }
    const high = scan.find('(?:impegnativa|impegnativo|difficile|pesante|concentrazione)');
    if (high) { high.take(); return 'high'; }
    return null;
  }

  /* ---------- Titolo ---------- */

  function cleanTitle(rest) {
    const words = rest.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const loose = word => LOOSE_WORDS.indexOf(fold(word).replace(/[,.;:!?']+$/, '')) >= 0 || /^[,.;:!?-]+$/.test(word);
    while (words.length && loose(words[words.length - 1])) words.pop();
    while (words.length && loose(words[0])) words.shift();
    const title = words.join(' ').replace(/[\s,;:]+$/, '');
    return utils.capitalize(title);
  }

  /**
   * Capisce una frase come "domani alle 10 dentista 30 min".
   * Restituisce { title, duration, energy, date, time }: un campo non riconosciuto vale null
   * (il titolo vale '' se non resta niente). Prima l'orario, che non va confuso con una durata.
   */
  function parseTaskText(text, now) {
    const source = String(text == null ? '' : text).slice(0, 300);
    const today = utils.todayISO(now);
    const scan = scanner(source);
    const evening = Boolean(scan.find('(?:stasera|stanotte)'));

    const time = findTime(scan, evening);
    const duration = findDuration(scan);
    let date = findDate(scan, today);
    const energy = findEnergy(scan);

    if (time && !date) {
      // Solo l'ora: oggi, oppure domani se a quell'ora siamo già passati.
      const current = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
      date = time > current ? today : utils.addDays(today, 1);
    }
    return { title: cleanTitle(scan.rest()), duration, energy, date, time };
  }

  Aura.nlp = { parseTaskText };
})(window.Aura = window.Aura || {});
