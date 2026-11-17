# Decisioni, funzioni e verifiche

Registro condiviso da tutti gli agenti. Tiene separate quattro cose che non vanno confuse:

1. ciò che è stato **deciso**;
2. ciò che è stato **realizzato**;
3. ciò che è soltanto **pianificato**;
4. ciò che è stato **verificato davvero**.

Una voce sta in una sola sezione e, quando cambia stato, si sposta. Il resto non si ripete qui: le regole sono in [AGENTS.md](../AGENTS.md), il lavoro in corso in [stato.md](stato.md), il comportamento di ogni funzione nella sua specifica (`app-attivita/docs/`).

## 1. Decisioni approvate

| Decisione | Che cosa stabilisce | Registrata il |
|---|---|---|
| **P-001 v2 approvata** | È il protocollo di lavoro tra gli agenti, approvato da Claude Project, ChatGPT e Product Owner. Le regole fisse, i ruoli e i livelli che ne derivano sono in [AGENTS.md](../AGENTS.md). | 13 novembre 2026 |
| **Login facoltativo con Google** | Il login con Google è deciso, e sarà facoltativo. La funzione è pianificata, non realizzata (sezione 3). | 13 novembre 2026 |
| **Chiavi VAPID già ruotate** | Le chiavi VAPID del server (promemoria push) sono già state ruotate. Lo dichiara il Product Owner: le chiavi non stanno nel repository, quindi da qui non si può controllare. | 13 novembre 2026 |
| **Nuovi promemoria senza migrazione D1** | I nuovi promemoria si realizzano senza migrazione del database D1. La funzione è pianificata, non realizzata (sezione 3). | 13 novembre 2026 |
| **Ciclo di lavoro con una sola approvazione** | Il Product Owner approva una volta sola, con il merge, dopo un riassunto; implementazione e revisione tra agenti avvengono da sole. Ruoli e passi in [AGENTS.md](../AGENTS.md), «Ciclo di lavoro». | 16 novembre 2026 |
| **P-002 v2: finire l'app del telefono** | Ordine, contenuti, condizioni tecniche e decisioni di prodotto 1–5 in [proposte/P-002.md](proposte/P-002.md). Approvata con il merge della PR che la introduce. | 16 novembre 2026 |
| **Test dell'app nel browser** | I test dell'app si eseguono in un browser reale, aprendo `app-attivita/tests/index.html`. | 13 novembre 2026 |

Le decisioni prese prima di questo registro restano scritte nelle specifiche delle funzioni.

## 2. Funzionalità realizzate

Sono nell'app o nel server pubblicati. Il comportamento è nella specifica: qui c'è solo l'elenco.

**«Da verificare»** nell'ultima colonna vuol dire che la prova sull'iPhone vero non è ancora stata fatta. Resta scritto così finché la prova non viene eseguita e registrata nella sezione 4.

| Funzione | Specifica | Prova su iPhone |
|---|---|---|
| Base: attività, liste per giorno, tema, uso offline | [Guida tecnica](../app-attivita/docs/CLAUDE-GUIDE.md), «Cosa sa fare oggi» | — |
| Punti, serie di giorni, record e traguardi | [punti-e-serie.md](../app-attivita/docs/punti-e-serie.md) | — |
| Frase che compila il modulo, con l'orario; link `?add=` | [linguaggio-naturale.md](../app-attivita/docs/linguaggio-naturale.md) | — |
| Server di Aura: promemoria push e casella di Siri | [promemoria-e-siri.md](../app-attivita/docs/promemoria-e-siri.md) | Promemoria push: **da verificare** |
| Modificare un'attività | [modifica.md](../app-attivita/docs/modifica.md) | — |
| Backup: esportare, importare e ripristinare i dati | [backup.md](../app-attivita/docs/backup.md) | — |
| Tre modalità, fase 1: animazioni più fluide | [tre-modalita.md](../app-attivita/docs/tre-modalita.md) | Verificata il 16 novembre 2026 (sezione 4) |
| Tre modalità, fase 2a: barra delle schede e Focus, con «Cosa faccio adesso?», il timer e i minuti di focus | [tre-modalita.md](../app-attivita/docs/tre-modalita.md) | Verificata il 16 novembre 2026 (sezione 4). Il difetto trovato allora è corretto con il passo 0b di P-002 (riga sotto) |
| P-002, passo 0b: il focus a tutto schermo resta fermo quando il contenuto ci sta | [tre-modalita.md](../app-attivita/docs/tre-modalita.md), «Schermata ferma» | **Da verificare** |
| P-002, passo 1: rotella e foglio «Impostazioni» (indice con lo stato di adesso, tema nella riga, foglio «Privacy», «Scollega» con «Annulla») | [impostazioni.md](../app-attivita/docs/impostazioni.md) | **Da verificare**: rotella sotto la barra di stato nell'app installata, foglio sopra un altro, cambio tema, «Scollega» con «Annulla» |
| P-002, passo 1: regola del giorno dell'assistente e decisione 1 («valore già uguale») | [assistente.md](../app-attivita/docs/assistente.md), «Cosa può fare l'assistente» | **Da verificare**, con le prove dell'assistente |
| Assistente, passo 0: prova tecnica (server e pagina di prova) | [assistente.md](../app-attivita/docs/assistente.md), «Risultati del passo 0» | **Da verificare** |
| Assistente, passo 1: assistente scritto («Scrivi ad Aura») | [assistente.md](../app-attivita/docs/assistente.md), «Risultati del passo 1» | **Da verificare** |
| Illustrazioni: due nell'app, una delle quali da sostituire | [illustrazioni.md](../app-attivita/docs/illustrazioni.md) | — |

«—» vuol dire soltanto che nelle specifiche non risulta una prova in sospeso: questo registro non contiene verifiche precedenti al 13 novembre 2026.

## 3. Funzionalità pianificate

**Non sono realizzate**: ciò che è elencato qui non è ancora nell'app né nel server. Una voce passa alla sezione 2 solo dopo la pubblicazione.

| Funzione | Dove è descritta | Nota |
|---|---|---|
| Notifica push alla fine del focus (tre modalità, fase 2b) | [tre-modalita.md](../app-attivita/docs/tre-modalita.md) | Approvata il 10 novembre 2026 come passo a parte, dopo la prova della fase 2a sull'iPhone |
| Apertura più leggera del foglio «Nuova attività»; rispetto di «Dimensione testo» dell'iPhone | [tre-modalita.md](../app-attivita/docs/tre-modalita.md), «Passi a parte, dopo la fase 2a» | |
| Agenda completa (tre modalità, fase 3) | [tre-modalita.md](../app-attivita/docs/tre-modalita.md) | Oggi la scheda mostra solo «Domani» e «Prossimi giorni» |
| Motivazione completa, con le illustrazioni (tre modalità, fase 4) | [tre-modalita.md](../app-attivita/docs/tre-modalita.md), [illustrazioni.md](../app-attivita/docs/illustrazioni.md) | Cinque illustrazioni sono da rifare |
| Assistente, passo 2: voce | [assistente.md](../app-attivita/docs/assistente.md) | |
| Assistente, passo 3: organizzare la giornata | [assistente.md](../app-attivita/docs/assistente.md) | Da specificare prima |
| Web Share Target e scorciatoie (Android) | [funzioni-future.md](../app-attivita/docs/funzioni-future.md) | |
| Promemoria nel calendario (`.ics`) | [funzioni-future.md](../app-attivita/docs/funzioni-future.md) | |
| Altre idee, non prioritarie | [funzioni-future.md](../app-attivita/docs/funzioni-future.md) | |
| Licenza premium | [premium.md](../app-attivita/docs/premium.md) | |
| Login facoltativo con Google e sincronizzazione | [proposte/P-002.md](proposte/P-002.md), passi 5a e 5b | 5b richiede prima una specifica testabile |
| Aura con un volto, voce, promemoria completi | [proposte/P-002.md](proposte/P-002.md), passi 2–4 | Promemoria senza migrazione D1 (sezione 1) |
| Agenda a calendario, Motivazione ripensata, animazioni più curate | Richieste del Product Owner del 16 novembre 2026 | Da scrivere in una P-003 |

## 4. Verifiche effettivamente eseguite

Qui entra solo ciò che è stato eseguito davvero, con la data e l'esito. Una verifica non eseguita non si scrive come superata: le prove su iPhone ancora da fare restano «da verificare» nella sezione 2.

| Data | Verifica | Come | Esito | Chi |
|---|---|---|---|---|
| 13 novembre 2026 | Test del server | `npm test` in `server/`, con Node.js 26.13.0 | 70 test superati su 70 | Claude Code |
| 13 novembre 2026 | Test dell'app | `app-attivita/tests/index.html` aperto in Microsoft Edge 157, in una finestra e in modalità headless | PASS in entrambe le prove; 183 test superati su 183 (conteggio letto nella prova headless) | Claude Code |
| 13 novembre 2026 | Controllo privacy | Ricerca di dati personali, percorsi locali, email e segreti nei file della PR 1 | Nessuna occorrenza | Claude Code |
| 13 novembre 2026 | Riferimenti tra i documenti | Controllo che ogni file citato dai documenti esista nel branch della PR 1 | Tutti validi; fuori dal conto, per scelta, i file che le specifiche prevedono per il futuro e le cartelle ignorate da Git | Claude Code |
| 16 novembre 2026 | Prove sull'iPhone delle fasi 1 e 2a | Il Product Owner, nell'app installata: intestazione con 4 card, schede fluide, foglio di aggiunta, «Cosa faccio adesso?» (prima le scadute, poi le vicine), timer e minuti di focus, ripresa dell'ultima scheda, i due temi | Superate; trovato un difetto: nel focus a tutto schermo, trascinando verso il basso, sul bordo destro si vede muoversi la barra di scorrimento, mentre la schermata dovrebbe restare ferma | Product Owner |
| 16 novembre 2026 | Passo 0b di P-002: il focus resta fermo | Chromium 153 con Playwright 1.63, contesto «iPhone 13», tocchi veri via CDP, sulla versione di prima e su quella nuova. Per riprodurre il difetto sono state tolte a mano le due protezioni che in Chromium fermano la pagina | 29 controlli superati su 29: prima la pagina dietro il focus si muove, dopo resta ferma (390×844, 390×664, 320×568); pulsanti, uscita, orizzontale, rotazione, tempo finito, titolo lungo, «Riduci movimento» e zoom con due dita a posto. Non eseguito in WebKit | Claude Project |
| 16 novembre 2026 | Test dell'app e del server, con il passo 0b | `app-attivita/tests/index.html` in Chromium 153 headless; `npm test` in `server/`, con Node.js 22.22.0 | App: PASS, 184 test superati su 184. Server: 70 superati su 70 | Claude Project |
| 17 novembre 2026 | Passo 1 di P-002: Impostazioni | Chromium 153 con Playwright 1.63, contesto «iPhone 13» e 320×568, nei due temi; un server finto (risposte simulate) per «Scollega»; anche da `file://` | 60 controlli superati su 60: rotella da 44 px nelle tre schede; ogni riga apre il foglio giusto dalla parte giusta e l'indice si aggiorna al ritorno; tema dalla riga; copie del foglio «Privacy» uguali ai testi di origine; «Scollega» chiude i fogli e l'avviso con «Annulla» si tocca e rimette lo stesso codice; nessun errore in console né di CSP. Intestazione di Focus a 390×664: 187,8 px prima e dopo, 4 card intere. Non eseguito in WebKit | Claude Project |
| 17 novembre 2026 | Test dell'app e del server, con il passo 1 | `app-attivita/tests/index.html` in Chromium 153 headless; `npm test` in `server/`, con Node.js 22.22.0. In più, i due test nuovi della regola del giorno girati con il `js/assistant.js` di prima | App: PASS, 194 test superati su 194. Server: 70 superati su 70. Con il codice di prima i due test nuovi falliscono, quindi controllano davvero la regola | Claude Project |
