# Impostazioni (realizzata, gratuita; da provare sull'iPhone)

Passo 1 di [P-002](../../docs/proposte/P-002.md): una rotella nell'intestazione apre «Impostazioni», un indice di tutte le funzioni che si regolano. Il foglio non sostituisce i fogli che ci sono già: dice lo stato di ognuno e lo apre.

## Rotella
- Sta nell'intestazione, in tutte e tre le schede, accanto alla campanella, e prende il posto del pulsante del tema. È un pulsante da 44 × 44 px con l'etichetta «Impostazioni».
- **L'intestazione non cresce**: in Focus, a 390 × 664, è di 188 px prima e dopo (187,8 px misurati), con 4 card intere visibili sopra la barra.
- Restano la campanella (foglio «Promemoria e Siri»), l'ingranaggio nel foglio «Aura» (foglio «Assistente») e «Backup dei dati» in fondo a Motivazione.

## Foglio «Impostazioni»
Un indice a gruppi. Ogni riga ha icona, nome, **stato di adesso** e freccia, e apre il suo foglio **sopra** a questo. Chiudendo quel foglio si torna all'indice, già aggiornato, con il fuoco sulla riga toccata.

| Riga | Che cosa dice | Che cosa apre |
|---|---|---|
| Assistente e permessi | «Spento», oppure «Acceso · chiede sempre», «Acceso · aggiunge da solo», «Acceso · cambia da solo», «Acceso · aggiunge e cambia da solo» | foglio «Assistente», dall'inizio |
| Cosa ha fatto l'assistente | «Ancora niente», «1 azione negli ultimi 30 giorni», «7 azioni negli ultimi 30 giorni» | foglio «Assistente», dall'elenco |
| Promemoria | «Attivi · 10 minuti prima» (l'anticipo scelto), «Spenti», oppure perché non si possono attivare: «Spenti · serve Aura sulla schermata Home», «Non supportati da questo browser», «Spenti · notifiche bloccate» | foglio «Promemoria e Siri», dall'inizio |
| Comando Rapido di Siri | «Codice creato» oppure «Da configurare» | foglio «Promemoria e Siri», dal riquadro del Comando Rapido |
| Tema | il tema scelto e che cosa fa: «Automatico: segue le impostazioni del telefono», «Chiaro: luminoso, ideale di giorno», «Scuro: riposante per gli occhi, perfetto la sera» | nessun foglio: le tre scelte sono nella riga |
| Backup dei dati | quante attività e quanti punti ci sono, e quanti premi se ce ne sono: «12 attività · 340 punti · 3 premi» | foglio «Backup dei dati» |
| Privacy | in breve, che cosa va al server: «I dati restano solo su questo dispositivo», «Al server: solo promemoria e frasi di Siri», «Al server: promemoria, Siri e messaggi all'assistente» | foglio «Privacy» |

- Lo stato è verde quando la funzione è in uso (assistente acceso, promemoria attivi, codice di Siri creato). La riga «Privacy» è verde solo quando al server non arriva niente.
- I promemoria seguono il foglio «Promemoria e Siri»: se sono attivi la riga lo dice, anche se nel frattempo il browser li blocca.
- **Senza il server** (file aperto dal computer, o server non configurato):
  - in cima c'è l'avviso, come nel foglio «Promemoria e Siri»;
  - le righe di assistente, elenco, promemoria e Siri dicono «Solo nell'app pubblicata» (oppure «Server non configurato»);
  - le due righe dell'assistente sono spente ma leggibili (allo stesso modo, nel foglio «Aura» l'ingranaggio non compare);
  - la sezione «Server di Aura» in fondo non c'è;
  - tema, backup e privacy funzionano come sempre.

## Tema
- Tre scelte affiancate, ognuna con la sua anteprima: Automatico, Chiaro, Scuro. Quella di adesso ha il bordo dell'accento e un bollino con la spunta.
- Toccandone una il tema cambia subito (`Aura.theme.setMode`) e il foglio resta aperto. La riga dice il nuovo tema, e la sua icona lo segue.
- Per la tastiera e i lettori di schermo è un gruppo di scelte (`role="radiogroup"`) che si chiama «Tema» e ha come descrizione lo stato della riga.
- Il foglio «Tema» e il suo pulsante non ci sono più: la scelta ha cambiato posto, non è sparita (regola 2 di [AGENTS.md](../../AGENTS.md)). Il tema resta in `aura-tasks:theme`, fuori dal backup.

## Foglio «Privacy»
In un posto solo, ciò che prima era scritto qua e là.
- In cima la frase di adesso, la stessa che sta in fondo a Motivazione (`privacyLine`): «I dati restano solo su questo dispositivo.» in verde, oppure che cosa arriva al server.
- «Sul telefono»: attività, punti, serie, premi, minuti di focus e impostazioni restano nella memoria del browser; non c'è nessun account; se i dati del browser vengono cancellati si perdono, e un backup ne tiene una copia.
- Promemoria, Comando Rapido di Siri e assistente sono facoltativi: finché non si attivano, al server non arriva niente.
- Poi un riquadro per «Promemoria», «Comando Rapido di Siri», «Assistente: che cosa viene inviato» e «Backup». Il testo di ognuno è una **copia** delle note scritte accanto alla funzione, segnate con `data-privacy="reminders"`, `"siri"`, `"assistant"` e `"backup"`. `ui-settings.js` le copia all'avvio, con `textContent`.
  - Così una nota si cambia in un posto solo, e i due posti non possono dire cose diverse.
  - Per questo l'ultima nota del foglio «Assistente» dice «l'elenco «Cosa ha fatto l'assistente»» invece di «l'elenco qui sopra», che nel foglio «Privacy» non avrebbe senso.
- In fondo: per cancellare dal server ciò che riguarda il dispositivo, «Scollega questo dispositivo» nelle Impostazioni.

## «Scollega questo dispositivo»
- Sta in fondo al foglio, nella sezione «Server di Aura», solo dove il server c'è.
  - Dispositivo non collegato: una frase dice che si collega da solo quando si attivano i promemoria, si crea il codice per Siri o si usa l'assistente.
  - Collegato: il pulsante, e sotto una riga che dice che cosa spegne: «Spegne i promemoria, il Comando Rapido di Siri e l'assistente, e cancella dal server la casella di Siri, i promemoria e i conteggi. Subito dopo puoi toccare «Annulla».»
- È la stessa azione del foglio «Promemoria e Siri» e del foglio «Assistente» (`disconnectDevice()` in `app.js`).
- Se riesce, **si chiudono tutti i fogli**: l'avviso «Dispositivo scollegato» con «Annulla» sta sotto i fogli aperti, e così si vede e si tocca. «Annulla» registra di nuovo lo stesso codice e riaccende l'assistente com'era.
- Mentre lavora il pulsante è spento e il foglio dice «Scollego il dispositivo…». Se non riesce, il motivo resta nel foglio, nella riga di stato.

## Come è fatto
- **`js/settings.js`**, logica pura con i suoi test (`tests/settings.test.js`):
  - `describe(info)` riceve lo stato di adesso (`availability`, `theme`, `assistant`, `logCount`, `reminders`, `push`, `connected`, `dataLabel`) e dà, per ogni riga, il testo (`state`) e dove serve il colore (`tone`: `'on'` = in uso) e `disabled`;
  - `privacyLine()` e `privacyShort()`: dove stanno i dati, in una frase intera e in breve. `app.js` usa la stessa `privacyLine()` per la frase in fondo a Motivazione;
  - `THEMES`: nome e descrizione dei tre temi.
- **`js/ui-settings.js`** tocca la pagina. `app.js` lo avvia con `Aura.settingsUI.init()`, dopo `ui-assistant.js`, e gli passa:
  - lo stato (`getInfo`);
  - i fogli (`openSheet`, `closeSheet`, `setupSheet`, `setAutofocus`, `showPart`, `closeAllSheets`);
  - le azioni (`openAssistant(parte)`, `openRemote(parte)`, `openBackup`, `disconnect`).
- Le righe si riscrivono (`sync()`) all'apertura, quando si chiude un foglio aperto sopra, quando cambia il tema (anche da un'altra scheda o con il telefono in automatico) e quando cambia lo stato del server (`syncRemoteBadges()` in `app.js`).
- Due funzioni nuove di `app.js`, che usano anche gli altri fogli:
  - `showPart(dialog, titolo)` fa partire un foglio appena aperto da un suo riquadro (Comando Rapido di Siri, elenco dell'assistente), con il fuoco sul titolo;
  - `closeAllSheets()` chiude tutti i fogli aperti, tranne il focus a tutto schermo. La usano «Scollega» (da tutti e tre i fogli) e «Mostra» nell'elenco dell'assistente.
- **File in più** rispetto a quelli nominati in P-002 (`js/ui-settings.js` e questa specifica): `js/settings.js` e `tests/settings.test.js`. La guida vuole la logica pura separata dalla pagina, e la pagina dei test carica solo logica pura.
- **Dati**: niente di nuovo. Il tema resta in `aura-tasks:theme`; tutto il resto si legge dagli stati che ci sono già. Schema invariato, CSP invariata, server invariato. Cache `aura-tasks-v14`, con i due file nuovi in `APP_FILES`.
- Stile: `.settings`, `.setting`, `.theme-option`, `.settings-device__on`, `.privacy-copy` in `css/style.css`, con i token dei due temi. Righe alte almeno 60 px, scelte del tema almeno 44 × 44 px, niente scorrimento orizzontale anche a 320 px.

## Prove
- **Automatiche**: `tests/settings.test.js`, 8 test su ogni riga, con e senza server, permessi, anticipi, motivi dei promemoria, temi e frasi della privacy.
- **Nel browser** (17 novembre 2026), Chromium con iPhone 13 simulato e a 320 × 568, nei due temi:
  - rotella da 44 px nelle tre schede; intestazione di 188 px con 4 card intere;
  - ogni riga apre il foglio giusto, dalla parte giusta; chiudendolo si torna all'indice aggiornato, con il fuoco sulla riga; Esc chiude un foglio alla volta;
  - tema cambiato dalla riga, con il foglio che resta aperto;
  - copie del foglio «Privacy» uguali ai testi di origine;
  - assistente acceso: righe e frase in fondo a Motivazione dicono lo stesso; un permesso cambiato si vede tornando all'indice;
  - «Scollega» con un server finto: fogli chiusi, avviso con «Annulla» toccabile, stesso codice dopo «Annulla»; se il server non risponde, il motivo resta nel foglio;
  - da `file://`: avviso in cima, righe dell'assistente spente, niente sezione «Server di Aura»;
  - nessun errore in console né di CSP.
  - WebKit: non eseguito.
- **Da verificare sull'iPhone**:
  1. la rotella sotto la barra di stato, nell'app installata;
  2. un foglio aperto sopra l'altro (Impostazioni, poi Promemoria e Siri), e la chiusura con la X o toccando lo sfondo;
  3. il cambio tema dalle Impostazioni;
  4. «Scollega» dalle Impostazioni: l'avviso con «Annulla» si vede e funziona.
