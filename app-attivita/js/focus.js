/*
 * Aura Tasks — modalità focus: logica pura.
 * Sessione: { taskId, startedAt, durationMs, pausedAt, pausedTotalMs }. Il tempo si calcola sempre dagli istanti
 * (millisecondi), mai contando i "tick" di un timer: su iPhone i timer si fermano in background e a schermo bloccato.
 * I minuti di focus finiti stanno nel registro: stats.focus = { 'YYYY-MM-DD': minuti } (schema v4).
 * Niente DOM, niente localStorage: `now` è sempre un parametro, così i test non dipendono dall'orologio.
 */
(function (Aura) {
  'use strict';

  const { utils } = Aura;

  const MINUTE_MS = 60 * 1000;

  const FOCUS = {
    extendMinutes: 5,             // "+5 min"
    minRecordMs: MINUTE_MS,       // sotto un minuto di focus non si registra nulla
    maxDayMinutes: 24 * 60,       // minuti di focus al massimo in un giorno
    maxDurationMinutes: 24 * 60   // durata massima di una sessione, "+5 min" compresi
  };

  /** Sessione nuova per un'attività: dura quanto la sua durata stimata. */
  function start(task, now) {
    return { taskId: task.id, startedAt: now, durationMs: task.duration * MINUTE_MS, pausedAt: null, pausedTotalMs: 0 };
  }

  const isPaused = session => session.pausedAt !== null;

  /** Tempo di focus passato, pause escluse: in pausa resta fermo. */
  function elapsedMs(session, now) {
    const until = isPaused(session) ? session.pausedAt : now;
    return Math.max(0, until - session.startedAt - session.pausedTotalMs);
  }

  /** Tempo che manca, mai negativo. */
  function remainingMs(session, now) {
    return Math.max(0, session.durationMs - elapsedMs(session, now));
  }

  function isFinished(session, now) {
    return elapsedMs(session, now) >= session.durationMs;
  }

  /** Istante in cui finisce il tempo, oppure null in pausa. */
  function endsAt(session) {
    return isPaused(session) ? null : session.startedAt + session.pausedTotalMs + session.durationMs;
  }

  /** Pausa, se il tempo scorre ancora. */
  function pause(session, now) {
    if (isPaused(session) || isFinished(session, now)) return session;
    return { ...session, pausedAt: now };
  }

  /** Riprende dopo una pausa: il tempo passato in pausa non conta. */
  function resume(session, now) {
    if (!isPaused(session)) return session;
    return { ...session, pausedAt: null, pausedTotalMs: session.pausedTotalMs + Math.max(0, now - session.pausedAt) };
  }

  /**
   * "+5 min": allunga la sessione. Se il tempo era già finito, i minuti in più partono da adesso:
   * il tempo passato dopo la fine non conta, come una pausa.
   */
  function extend(session, now, minutes = FOCUS.extendMinutes) {
    const overtime = isPaused(session) ? 0 : Math.max(0, elapsedMs(session, now) - session.durationMs);
    const durationMs = Math.min(session.durationMs + minutes * MINUTE_MS, FOCUS.maxDurationMinutes * MINUTE_MS);
    return { ...session, durationMs, pausedTotalMs: session.pausedTotalMs + overtime };
  }

  /**
   * Fine di una sessione (Completa, Esci, un'altra attività): { minutes, day } da registrare.
   * Contano i minuti effettivi, pause escluse e al massimo la durata impostata; sotto un minuto, 0.
   * Il giorno è quello locale in cui il focus si è fermato: la pausa, la fine del tempo, oppure adesso.
   */
  function sessionResult(session, now) {
    const effective = Math.min(elapsedMs(session, now), session.durationMs);
    const minutes = effective < FOCUS.minRecordMs ? 0 : Math.round(effective / MINUTE_MS);
    const stoppedAt = isPaused(session) ? session.pausedAt : Math.min(now, endsAt(session));
    return { minutes, day: utils.todayISO(stoppedAt) };
  }

  /** Minuti di focus di un giorno. */
  function minutesOn(stats, day) {
    return (stats.focus && stats.focus[day]) || 0;
  }

  /** Minuti di focus in tutto. */
  function totalMinutes(stats) {
    const focus = stats.focus || {};
    return Object.keys(focus).reduce((sum, day) => sum + focus[day], 0);
  }

  /**
   * Aggiunge (o toglie, con un numero negativo) minuti di focus a un giorno, tra 0 e il massimo di un giorno.
   * Un giorno che torna a 0 sparisce. Restituisce un registro NUOVO; il resto del registro non cambia.
   */
  function recordMinutes(stats, day, delta) {
    if (!delta || !utils.isISODate(day)) return stats;
    const focus = { ...(stats.focus || {}) };
    const next = Math.min(FOCUS.maxDayMinutes, Math.max(0, minutesOn(stats, day) + delta));
    if (next > 0) focus[day] = next;
    else delete focus[day];
    return { ...stats, focus };
  }

  /** La mappa dei minuti letta dall'archivio, ripulita: solo giorni validi, con minuti interi tra 1 e il massimo di un giorno. */
  function sanitizeMinutes(raw) {
    const focus = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return focus;
    Object.keys(raw).forEach(day => {
      const minutes = raw[day];
      if (utils.isISODate(day) && Number.isInteger(minutes) && minutes >= 1 && minutes <= FOCUS.maxDayMinutes) focus[day] = minutes;
    });
    return focus;
  }

  /** La sessione letta dall'archivio, ripulita; null se è illeggibile. */
  function sanitizeSession(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const { taskId, startedAt, durationMs } = raw;
    if (typeof taskId !== 'string' || !taskId || !Number.isFinite(startedAt)) return null;
    if (!Number.isInteger(durationMs) || durationMs < MINUTE_MS || durationMs > FOCUS.maxDurationMinutes * MINUTE_MS) return null;
    const pausedTotalMs = Number.isFinite(raw.pausedTotalMs) && raw.pausedTotalMs >= 0 ? raw.pausedTotalMs : 0;
    const pausedAt = Number.isFinite(raw.pausedAt) && raw.pausedAt >= startedAt ? raw.pausedAt : null;
    return { taskId, startedAt, durationMs, pausedAt, pausedTotalMs };
  }

  /** Tempo da mostrare: "24:59", "1:05:00". Arrotonda per eccesso, così "00:00" compare solo alla fine. */
  function clockLabel(ms) {
    const total = Math.ceil(Math.max(0, ms) / 1000);
    const pad = n => String(n).padStart(2, '0');
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return (hours ? hours + ':' + pad(minutes) : pad(minutes)) + ':' + pad(seconds);
  }

  Aura.focus = {
    FOCUS,
    MINUTE_MS,
    start,
    isPaused,
    elapsedMs,
    remainingMs,
    isFinished,
    endsAt,
    pause,
    resume,
    extend,
    sessionResult,
    minutesOn,
    totalMinutes,
    recordMinutes,
    sanitizeMinutes,
    sanitizeSession,
    clockLabel
  };
})(window.Aura = window.Aura || {});
