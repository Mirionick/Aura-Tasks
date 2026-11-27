/*
 * Aura Tasks — connettore per Claude (P-006, passo 6.2; specifica in docs/connettore-claude.md): logica pura.
 * Come si mostra il codice per collegare, quanto vale ancora, che cosa dice ogni collegamento e quando ne è arrivato
 * uno nuovo. Niente DOM, niente localStorage, niente rete: tutto arriva come parametro, così i test sono ripetibili.
 */
(function (Aura) {
  'use strict';

  const { utils } = Aura;

  // Come sul server (server/src/oauth.js): 8 caratteri, senza 0, O, 1, I e L, e vale 10 minuti.
  const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const CODE_LENGTH = 8;
  const CODE_TTL_MS = 10 * 60 * 1000;
  // Mentre il codice è in vista, lo stato si controlla ogni 4 secondi.
  const POLL_MS = 4000;
  // Scritto il codice, Claude ha ancora un minuto per finire il collegamento (il codice d'accesso del server vale 60 s).
  const USED_GRACE_MS = 60 * 1000;

  const dayMonth = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long' });
  const dayMonthYear = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  const lowerFirst = text => text.charAt(0).toLowerCase() + text.slice(1);

  function isPairCode(value) {
    return typeof value === 'string' && value.length === CODE_LENGTH && [...value].every(char => CODE_ALPHABET.includes(char));
  }

  /** «K7PM4QRT» → «K7PM-4QRT»: due gruppi da quattro, come nell'esempio della pagina di Aura. '' se non è un codice. */
  function groupCode(code) {
    return isPairCode(code) ? code.slice(0, 4) + '-' + code.slice(4) : '';
  }

  /** Per il lettore di schermo, un carattere alla volta: «K 7 P M, 4 Q R T». '' se non è un codice. */
  function spellCode(code) {
    return isPairCode(code) ? [...code.slice(0, 4)].join(' ') + ', ' + [...code.slice(4)].join(' ') : '';
  }

  /**
   * Fino a quando vale il codice, sull'orologio del telefono: la scadenza del server, ma mai oltre 10 minuti da adesso
   * (se l'orologio del telefono è indietro, il codice non sembra valere più del vero).
   */
  function codeDeadline(expiresAt, now) {
    const left = Number.isFinite(expiresAt) ? expiresAt - now : 0;
    return now + Math.max(0, Math.min(CODE_TTL_MS, left));
  }

  /** «Vale ancora 10 minuti», «Vale ancora 1 minuto», «Vale meno di un minuto»; null quando è scaduto. */
  function timeLeft(deadline, now) {
    const ms = deadline - now;
    if (!(ms > 0)) return null;
    if (ms < 60 * 1000) return 'Vale meno di un minuto';
    const minutes = Math.ceil(ms / 60000);
    return minutes === 1 ? 'Vale ancora 1 minuto' : 'Vale ancora ' + minutes + ' minuti';
  }

  /** La risposta di GET /api/claude, ripulita: { links: [{ createdAt, usedAt }], code: { expiresAt } | null }; null se non va. */
  function readStatus(data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.links)) return null;
    const links = data.links
      .filter(link => link && Number.isFinite(link.createdAt) && link.createdAt > 0)
      .map(link => ({ createdAt: link.createdAt, usedAt: Number.isFinite(link.usedAt) && link.usedAt > 0 ? link.usedAt : null }))
      .sort((a, b) => a.createdAt - b.createdAt);
    const code = data.code && typeof data.code === 'object' && Number.isFinite(data.code.expiresAt) ? { expiresAt: data.code.expiresAt } : null;
    return { links, code };
  }

  /**
   * È arrivato un collegamento che prima non c'era? Si riconosce dalla data, non dal numero: con il quarto collegamento
   * il server toglie quello usato meno di recente, e il numero resta 3.
   */
  function hasNewLink(before, after) {
    const known = new Set((before || []).map(link => link.createdAt));
    return (after || []).some(link => !known.has(link.createdAt));
  }

  /**
   * Quando il server ha dato il codice, sul suo orologio (la scadenza meno i 10 minuti): lo stesso orologio delle date
   * dei collegamenti. null se la scadenza non è un numero.
   */
  function codeIssuedAt(expiresAt) {
    return Number.isFinite(expiresAt) ? expiresAt - CODE_TTL_MS : null;
  }

  /**
   * C'è un collegamento creato dopo che il server ha dato il codice (`issuedAt`, da `codeIssuedAt`)? Serve quando i
   * collegamenti di prima non si sapevano: non c'è niente con cui confrontare, ma la data dice quale è nuovo.
   */
  function linkedSince(links, issuedAt) {
    return Number.isFinite(issuedAt) && (links || []).some(link => link.createdAt >= issuedAt);
  }

  /** «23 novembre», con l'anno se non è quello di adesso. */
  function dayLabel(ms, now) {
    const date = new Date(ms);
    return (date.getFullYear() === new Date(now).getFullYear() ? dayMonth : dayMonthYear).format(date);
  }

  /**
   * Una riga per collegamento: «Collegato dal 23 novembre · ultimo uso oggi alle 15:02». Collegato oggi:
   * «Collegato oggi alle 10:15»; mai usato: «· non ancora usato».
   */
  function linkLine(link, now) {
    const today = utils.todayISO(now);
    const since = utils.toISODate(new Date(link.createdAt)) === today
      ? 'Collegato ' + lowerFirst(utils.formatMoment(link.createdAt, today))
      : 'Collegato dal ' + dayLabel(link.createdAt, now);
    if (!link.usedAt) return since + ' · non ancora usato';
    return since + ' · ultimo uso ' + lowerFirst(utils.formatMoment(link.usedAt, today));
  }

  /** L'indirizzo da scrivere in Claude: quello del server più /mcp, senza la barra finale. */
  function connectorUrl(serverUrl) {
    return String(serverUrl || '').replace(/\/+$/, '') + '/mcp';
  }

  Aura.claude = {
    CODE_TTL_MS,
    POLL_MS,
    USED_GRACE_MS,
    isPairCode,
    groupCode,
    spellCode,
    codeDeadline,
    timeLeft,
    readStatus,
    hasNewLink,
    codeIssuedAt,
    linkedSince,
    linkLine,
    connectorUrl
  };
})(window.Aura = window.Aura || {});
