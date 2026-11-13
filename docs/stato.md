# Stato del lavoro

Fotografia breve di dove siamo, per chi comincia un intervento. La aggiorna chi apre una Pull Request, dentro la Pull Request stessa.

Non ripete gli altri documenti: decisioni, funzioni e verifiche sono in [decisioni.md](decisioni.md), le regole in [AGENTS.md](../AGENTS.md).

**Aggiornato il** 13 novembre 2026, con la PR 1 (P-001 v2).

## Pubblicato su `main`
- **App**: fino al passo 1 dell'assistente («Scrivi ad Aura»), con la cache `aura-tasks-v12` (13 novembre 2026).
- **Server**: quello pubblicato con il passo 0 dell'assistente (11 novembre 2026); il passo 1 non lo ha cambiato.

L'elenco delle funzioni realizzate è in [decisioni.md](decisioni.md), sezione 2.

## In lavorazione
- **PR 1 — P-001 v2: documentazione e configurazione condivisa** (branch `ottimizzazione-claude`, livello B). Solo documentazione e configurazione degli agenti: il codice dell'app e del server non cambia. Aspetta la revisione dell'altro agente e il merge del Product Owner.

## In attesa
- Le prove su iPhone segnate «da verificare» in [decisioni.md](decisioni.md), sezione 2.

## Punti aperti
- **CI**: i livelli A e B la prevedono, ma nel repository non c'è ancora nessun controllo automatico. Per ora i test si eseguono a mano e l'esito si scrive nella Pull Request.
- **Testo di P-001 v2**: non è nel repository. Qui ci sono la sua approvazione ([decisioni.md](decisioni.md), sezione 1) e ciò che stabilisce ([AGENTS.md](../AGENTS.md)).
- **Login con Google** e **nuovi promemoria**: decisi, ma senza proposta né specifica nel repository.

## Prossimi passi
1. Revisione e merge della PR 1.
2. Le funzioni pianificate sono in [decisioni.md](decisioni.md), sezione 3: l'ordine lo decide il Product Owner.
