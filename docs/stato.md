# Stato del lavoro

Fotografia breve di dove siamo, per chi comincia un intervento. La aggiorna chi apre una Pull Request, dentro la Pull Request stessa.

Non ripete gli altri documenti: decisioni, funzioni e verifiche sono in [decisioni.md](decisioni.md), le regole in [AGENTS.md](../AGENTS.md).

**Aggiornato il** 17 novembre 2026, con la PR del passo 1 di P-002 (Impostazioni e regola del giorno).

## Pubblicato su `main`
- **App**: fino al passo 1 dell'assistente («Scrivi ad Aura», 13 novembre 2026), più il passo 0b di P-002: il focus a tutto schermo resta fermo. Cache `aura-tasks-v13` (16 novembre 2026). Con questa PR: passo 1 di P-002, cache `aura-tasks-v14`.
- **Server**: quello pubblicato con il passo 0 dell'assistente (11 novembre 2026); il passo 1 non lo ha cambiato.
- **CI**: test del server e dell'app in Chrome headless su ogni PR (PR 2, unita il 16 novembre 2026 con `4351b18`), con un minimo di 194 test dell'app (184 prima del passo 1).
- **Protezione di `main`** (16 novembre 2026): solo PR, con il controllo «Test backend e frontend» obbligatorio, niente force push né cancellazione, nessuna eccezione. Attivi secret scanning, push protection, avvisi di Dependabot e CodeQL. Codex rivede ogni PR: la revisione parte all'apertura oppure con il commento `@codex review` (così è partita sulla PR 3).

L'elenco delle funzioni realizzate è in [decisioni.md](decisioni.md), sezione 2.

## Completato di recente
- **PR 1 — P-001 v2**: documentazione e configurazione condivisa, unita il 16 novembre 2026 (`b318b6d`).
- **PR 2 — CI automatica**: unita il 16 novembre 2026 (`4351b18`).
- **PR 3 — P-002 v2 e ciclo di lavoro** (16 novembre 2026): la proposta in [proposte/P-002.md](proposte/P-002.md) e `AGENTS.md` con il nuovo ciclo.
- **PR 5 — passo 0b di P-002** (16 novembre 2026, `49fac71`): nel focus a tutto schermo un dito che trascina non muove più niente. **Da provare sull'iPhone** (vedi [tre-modalita.md](../app-attivita/docs/tre-modalita.md), «Schermata ferma»).

## In lavorazione
- **Passo 1 di P-002** (livello A, esecutore Claude Project, revisione di ChatGPT / Codex): la rotella nell'intestazione apre «Impostazioni», un indice che dice lo stato di ogni funzione e apre il suo foglio; il tema si sceglie nella riga; un foglio unico «Privacy»; «Scollega questo dispositivo» con «Annulla». Nello stesso passo, la regola del giorno dell'assistente e la decisione 1 («valore già uguale»). Specifiche in [impostazioni.md](../app-attivita/docs/impostazioni.md) e [assistente.md](../app-attivita/docs/assistente.md). Provato nel browser; **da provare sull'iPhone** dopo il merge.

## In attesa
- Le prove sull'iPhone rimandate, segnate «da verificare» in [decisioni.md](decisioni.md), sezione 2: assistente scritto, promemoria push anche ad app chiusa, Siri, pagina di prova della voce. I passi 3 e 4 di P-002 aspettano queste prove.

## Punti aperti
- **Controlli automatici di conformità** (passo 0a di P-002, livello B, esecutore ChatGPT / Codex): (a) segreti e percorsi locali nei file e nei messaggi dei commit della PR; (b) divieto di `innerHTML` nel codice dell'app; (c) `CACHE_VERSION` aggiornata quando cambiano i file dell'app.
- **Pagina che scorre dietro gli altri fogli**: il difetto del passo 0b fa pensare che su iPhone il blocco dello scorrimento dei fogli non basti. Va controllato con la prova del passo 0b (con un foglio aperto, trascinare sullo sfondo scuro). Se la pagina si muove, serve una correzione a parte.
- **Testo di P-001 v2**: non è nel repository. Qui ci sono la sua approvazione ([decisioni.md](decisioni.md), sezione 1) e ciò che stabilisce ([AGENTS.md](../AGENTS.md)).

## Prossimi passi
L'ordine è in [proposte/P-002.md](proposte/P-002.md): 0a (ChatGPT / Codex, aspetta l'ambiente di Codex), poi passo 2 (Aura con un volto). Le richieste nuove del 16 novembre (Agenda a calendario, Motivazione, animazioni) andranno in una P-003.
