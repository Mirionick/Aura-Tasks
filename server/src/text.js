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
  tooLarge: 'Richiesta troppo grande.',
  tooMany: 'Troppe richieste: riprova tra un minuto.'
};

/** Messaggi JSON per l'app: limite di richieste per IP e tetto giornaliero di nuovi dispositivi. */
export const LIMIT_TEXTS = {
  tooMany: 'Troppe richieste da questa rete: riprova tra un minuto',
  dailyCap: 'Oggi il server di Aura ha già accolto il massimo di nuovi dispositivi: riprova domani'
};

/** Messaggi JSON dell'assistente: limiti del giorno, errori dell'IA e della registrazione. */
export const ASSISTANT_TEXTS = {
  dailyCap: 'Per oggi le risposte dell\'assistente sono finite: riprova domani',
  deviceMessages: 'Per oggi hai finito i messaggi all\'assistente: riprova domani',
  deviceOpens: 'Per oggi le proposte all\'apertura sono finite',
  deviceAudio: 'Per oggi hai finito i minuti di voce: scrivi, oppure riprova domani',
  unavailable: 'L\'assistente non è configurato sul server',
  aiDown: 'L\'assistente non risponde: riprova tra poco',
  badReply: 'L\'assistente non ha risposto in modo chiaro: riprova con altre parole',
  badAudio: 'Non riesco a leggere la registrazione',
  audioType: 'Formato della registrazione non ammesso',
  audioTooLarge: 'Registrazione troppo lunga: al massimo 30 secondi',
  audioEmpty: 'Non è arrivata nessuna registrazione'
};

/** Pagina di accesso del connettore per Claude (P-006): la apre Claude, chiede il codice mostrato da Aura. */
export const CLAUDE_PAGE = {
  title: 'Collega Claude ad Aura',
  intro: 'Claude chiede di poter aggiungere attività alla tua Aura. Potrà solo aggiungerle: non vedrà le tue attività.',
  where: 'Apri Aura sul telefono: Impostazioni › Claude › «Mostra il codice». Poi scrivi qui il codice.',
  label: 'Codice di Aura',
  hint: '8 caratteri, per esempio K7PM-4QRT',
  button: 'Collega',
  back: host => 'Dopo, torni su ' + host + '.',
  badCode: 'Il codice non va bene o è scaduto. In Aura tocca «Nuovo codice» e riprova.',
  tooMany: 'Troppi tentativi da questa rete: riprova tra un minuto.',
  badClient: 'Questa richiesta non arriva da Claude, quindi Aura non può collegarla.',
  badRequest: 'La richiesta non è valida. Riprova da Claude: Personalizza › Connettori.',
  failed: 'Qualcosa non ha funzionato. Riprova tra poco.'
};

/** Testi del connettore MCP: istruzioni e descrizione dello strumento (le legge Claude), risposte dello strumento. */
export const MCP_TEXTS = {
  instructions: 'Aura Tasks è l\'app delle cose da fare dell\'utente. Con aggiungi_ad_aura metti nella sua casella ' +
    'le attività che vengono fuori nella conversazione; se l\'idea è tua, chiedi prima. Lo strumento può solo aggiungere: ' +
    'non legge, non cambia e non cancella le attività.',
  toolDescription: 'Mette una o più attività nella casella di Aura Tasks, l\'app delle cose da fare dell\'utente. ' +
    'Arrivano sul suo telefono quando apre Aura, che le mostra «Da Claude» e le può annullare. ' +
    'Usalo quando l\'utente chiede di mettere qualcosa su Aura, di ricordarglielo o di aggiungerlo alle sue attività. ' +
    'Puoi anche proporlo tu, quando nella conversazione viene fuori qualcosa da fare (un impegno, una scadenza, un passo successivo): ' +
    'chiedi prima «Lo metto su Aura?» e aggiungi solo dopo il sì. ' +
    'Ogni attività è una frase breve in italiano che comincia con l\'azione, per esempio «Chiamare il dentista il 27 novembre alle 10». ' +
    'Per il giorno scrivi la data («27 novembre»), non «domani»: Aura potrebbe ritirarla un altro giorno. ' +
    'Per ripetere: «ogni lunedì», «ogni giorno». Non scrivere password, codici o altri dati riservati. ' +
    'Lo strumento può solo aggiungere: non legge, non cambia e non cancella le attività.',
  argDescription: 'Da 1 a 10 attività. Ognuna è una frase breve in italiano, al massimo 200 caratteri, che comincia con l\'azione ' +
    'e, se ha un giorno, lo scrive come data: «Chiamare il dentista il 27 novembre alle 10».',
  added: count => count === 1
    ? 'Fatto: 1 attività nella casella di Aura. L\'utente la vedrà la prossima volta che apre l\'app.'
    : 'Fatto: ' + count + ' attività nella casella di Aura. L\'utente le vedrà la prossima volta che apre l\'app.',
  none: 'Non è arrivata nessuna attività: in «attivita» servono da 1 a 10 frasi.',
  tooMany: 'Troppe attività insieme: al massimo 10 per volta.',
  empty: 'Una delle attività è vuota.',
  tooLong: 'Una delle attività è troppo lunga: al massimo 200 caratteri.',
  daily: left => left > 0
    ? 'Per oggi da Claude si possono aggiungere ancora ' + left + ' attività: mandane di meno.'
    : 'Per oggi le attività da Claude sono finite: riprova domani.',
  allToday: left => left > 0
    ? 'Oggi il server di Aura accetta da Claude ancora ' + left + ' attività in tutto: mandane di meno.'
    : 'Oggi il server di Aura ha già ricevuto da Claude tutte le attività che può accettare: riprova domani.',
  retry: 'Aura non è riuscita ad aggiungere le attività: riprova tra poco.',
  full: left => left > 0
    ? 'Nella casella di Aura c\'è posto solo per ' + left + ' attività: mandane di meno, oppure l\'utente apre Aura per ritirare quelle in attesa.'
    : 'La casella di Aura è piena: l\'utente deve aprire Aura per ritirare le frasi in attesa, poi si può riprovare.'
};
