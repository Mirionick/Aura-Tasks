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
| Tre modalità, fase 1: animazioni più fluide | [tre-modalita.md](../app-attivita/docs/tre-modalita.md) | **Da verificare** |
| Tre modalità, fase 2a: barra delle schede e Focus, con «Cosa faccio adesso?», il timer e i minuti di focus | [tre-modalita.md](../app-attivita/docs/tre-modalita.md) | **Da verificare** |
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
| Login facoltativo con Google | Nessuna proposta né specifica nel repository | Decisione nella sezione 1 |
| Nuovi promemoria | Nessuna proposta né specifica nel repository | Decisione nella sezione 1: senza migrazione D1 |

## 4. Verifiche effettivamente eseguite

Qui entra solo ciò che è stato eseguito davvero, con la data e l'esito. Una verifica non eseguita non si scrive come superata: le prove su iPhone ancora da fare restano «da verificare» nella sezione 2.

| Data | Verifica | Come | Esito | Chi |
|---|---|---|---|---|
| 13 novembre 2026 | Test del server | `npm test` in `server/`, con Node.js 26.13.0 | 70 test superati su 70 | Claude Code |
| 13 novembre 2026 | Test dell'app | `app-attivita/tests/index.html` aperto in Microsoft Edge 157, in una finestra e in modalità headless | PASS in entrambe le prove; 183 test superati su 183 (conteggio letto nella prova headless) | Claude Code |
| 13 novembre 2026 | Controllo privacy | Ricerca di dati personali, percorsi locali, email e segreti nei file della PR 1 | Nessuna occorrenza | Claude Code |
| 13 novembre 2026 | Riferimenti tra i documenti | Controllo che ogni file citato dai documenti esista nel branch della PR 1 | Tutti validi; fuori dal conto, per scelta, i file che le specifiche prevedono per il futuro e le cartelle ignorate da Git | Claude Code |
