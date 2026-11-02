/*
 * Aura Tasks — promemoria: logica pura.
 * Trasforma le attività con giorno e ora nell'elenco che il server usa per le notifiche push.
 * Gli istanti si calcolano qui, con l'ora locale del telefono: il server lavora solo con timestamp,
 * quindi cambio dell'ora e fuso orario sono già giusti.
 * Niente DOM, niente localStorage, niente rete.
 */
(function (Aura) {
  'use strict';

  const { utils } = Aura;

  const MINUTE_MS = 60 * 1000;
  /** Anticipi possibili, in minuti. 0 = all'ora esatta dell'attività. */
  const LEADS = [0, 5, 10, 15, 30, 60];
  const DEFAULT_LEAD = 10;
  const MAX_REMINDERS = 100;
  const TITLE_MAX = 120;

  /** Istante (ms) di un'attività con giorno e ora, in ora locale; null se manca uno dei due. */
  function taskMoment(task) {
    if (!utils.isISODate(task.date) || !utils.isTime(task.time)) return null;
    const moment = utils.parseISODate(task.date);
    const [hours, minutes] = task.time.split(':').map(Number);
    moment.setHours(hours, minutes, 0, 0);
    return moment.getTime();
  }

  /**
   * Elenco per il server: attività non completate, con giorno e ora, ancora da venire.
   * - `at`: ora dell'attività; `fireAt`: quando avvisare, cioè `at` meno l'anticipo (in ms).
   * - Se l'avviso cade nel passato (attività aggiunta a ridosso dell'ora), il server avvisa al giro successivo.
   * - Ordinato per avviso, al massimo MAX_REMINDERS.
   * `now` (Date o ms) è un parametro, così i test non dipendono dall'orologio.
   */
  function buildReminders(tasks, { lead, now }) {
    const nowMs = typeof now === 'number' ? now : now.getTime();
    const leadMs = (LEADS.includes(lead) ? lead : DEFAULT_LEAD) * MINUTE_MS;
    return tasks
      .filter(task => !task.done)
      .map(task => ({ task, at: taskMoment(task) }))
      .filter(item => item.at !== null && item.at > nowMs)
      .map(({ task, at }) => ({ id: task.id, at, fireAt: at - leadMs, title: task.title.slice(0, TITLE_MAX), time: task.time }))
      .sort((a, b) => a.fireAt - b.fireAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .slice(0, MAX_REMINDERS);
  }

  /** Impronta breve di un elenco: se non cambia, non serve rimandarlo al server. */
  function listKey(list) {
    const text = JSON.stringify(list);
    let hash = 0x811c9dc5; // FNV-1a a 32 bit
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return list.length + ':' + hash.toString(16);
  }

  /** 0 → "all'ora esatta", 10 → "10 minuti prima", 60 → "un'ora prima". */
  function leadLabel(lead) {
    if (lead === 0) return 'all\'ora esatta';
    if (lead === 60) return 'un\'ora prima';
    return lead + ' minuti prima';
  }

  Aura.reminders = { LEADS, DEFAULT_LEAD, MAX_REMINDERS, taskMoment, buildReminders, listKey, leadLabel };
})(window.Aura = window.Aura || {});
