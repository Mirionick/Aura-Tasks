/*
 * Testi in italiano: notifiche e risposte al Comando Rapido di Siri.
 */

/**
 * Testo sotto il titolo della notifica: "Tra 10 minuti, alle 10:00".
 * `time` è l'ora locale dell'attività ("10:00"); `at` e `now` sono istanti in millisecondi.
 */
export function reminderBody(time, at, now) {
  const minutes = Math.round((at - now) / 60000);
  if (minutes <= 0) return 'Adesso, alle ' + time;
  if (minutes === 1) return 'Tra un minuto, alle ' + time;
  if (minutes < 60) return 'Tra ' + minutes + ' minuti, alle ' + time;
  if (minutes === 60) return "Tra un'ora, alle " + time;
  return 'Alle ' + time;
}

/** Notifica di prova ("Prova una notifica" nell'app). */
export const TEST_MESSAGE = { title: 'Aura', body: 'Le notifiche funzionano ✓', tag: 'aura-test', url: './' };

/** Risposte in testo semplice alla casella: il Comando Rapido le mostra così come sono. */
export const INBOX_TEXTS = {
  added: 'Aggiunto ad Aura: ',
  badCode: 'Codice mancante o non valido. Copialo di nuovo da Aura: campanella → Comando Rapido di Siri.',
  empty: 'Non ho ricevuto nessuna frase.',
  tooLong: 'La frase è troppo lunga: al massimo 500 caratteri.',
  full: 'La casella è piena: apri Aura per ritirare le frasi.',
  badJson: 'Il corpo della richiesta non è un JSON valido.',
  tooLarge: 'Richiesta troppo grande.'
};
