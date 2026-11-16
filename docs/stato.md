# Stato del lavoro

Fotografia breve di dove siamo, per chi comincia un intervento. La aggiorna chi apre una Pull Request, dentro la Pull Request stessa.

Non ripete gli altri documenti: decisioni, funzioni e verifiche sono in [decisioni.md](decisioni.md), le regole in [AGENTS.md](../AGENTS.md).

**Aggiornato il** 16 novembre 2026, con la PR 2 (CI).

## Pubblicato su `main`
- **App**: fino al passo 1 dell'assistente («Scrivi ad Aura»), con la cache `aura-tasks-v12` (13 novembre 2026).
- **Server**: quello pubblicato con il passo 0 dell'assistente (11 novembre 2026); il passo 1 non lo ha cambiato.

L'elenco delle funzioni realizzate è in [decisioni.md](decisioni.md), sezione 2.

## Completato di recente
- **PR 1 — P-001 v2: documentazione e configurazione condivisa** (branch `ottimizzazione-claude`, livello B). Unita a `main` il 16 novembre 2026 con merge commit `b318b6d`. Ha modificato solo documentazione e configurazione degli agenti; il codice dell'app e del server è rimasto invariato.

## In lavorazione
- **PR 2 — CI automatica** (branch `ci/pr2-github-actions`, livello B). Introduce GitHub Actions per i test del server e della PWA in Chrome headless; non modifica il codice runtime dell'app né del server.

## In attesa
- Le prove su iPhone segnate «da verificare» in [decisioni.md](decisioni.md), sezione 2.

## Punti aperti
- **CI**: il workflow automatico è introdotto nella PR 2; attendiamo l'esito dei controlli su GitHub Actions e la revisione prima del merge. Dopo il merge, la CI sarà obbligatoria per tutte le PR di livello A e B.
- **Testo di P-001 v2**: non è nel repository. Qui ci sono la sua approvazione ([decisioni.md](decisioni.md), sezione 1) e ciò che stabilisce ([AGENTS.md](../AGENTS.md)).
- **Login con Google** e **nuovi promemoria**: decisi, ma senza proposta né specifica nel repository.

## Prossimi passi
1. Revisione e merge della PR 2.
2. Le funzioni pianificate sono in [decisioni.md](decisioni.md), sezione 3: l'ordine lo decide il Product Owner.
