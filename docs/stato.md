# Stato del lavoro

Fotografia breve di dove siamo, per chi comincia un intervento. La aggiorna chi apre una Pull Request, dentro la Pull Request stessa.

Non ripete gli altri documenti: decisioni, funzioni e verifiche sono in [decisioni.md](decisioni.md), le regole in [AGENTS.md](../AGENTS.md).

**Aggiornato il** 18 novembre 2026, con la PR della proposta P-003 (Agenda a calendario, Motivazione, animazioni), approvata con tutte e tre le idee di Motivazione.

## Pubblicato su `main`
- **App**: fino al passo 1 dell'assistente («Scrivi ad Aura», 13 novembre 2026), più i passi 0b e 1 di P-002: il focus a tutto schermo resta fermo; la rotella apre le Impostazioni. Cache `aura-tasks-v14` (17 novembre 2026).
- **Server**: quello pubblicato con il passo 0 dell'assistente (11 novembre 2026); il passo 1 non lo ha cambiato.
- **CI**: test del server e dell'app in Chrome headless su ogni PR (PR 2, unita il 16 novembre 2026 con `4351b18`), con un minimo di 194 test dell'app (184 prima del passo 1).
- **Protezione di `main`** (16 novembre 2026): solo PR, con il controllo «Test backend e frontend» obbligatorio, niente force push né cancellazione, nessuna eccezione. Attivi secret scanning, push protection, avvisi di Dependabot e CodeQL. Codex rivede ogni PR: la revisione parte all'apertura oppure con il commento `@codex review` (così è partita sulla PR 3).

L'elenco delle funzioni realizzate è in [decisioni.md](decisioni.md), sezione 2.

## Completato di recente
- **PR 1 — P-001 v2**: documentazione e configurazione condivisa, unita il 16 novembre 2026 (`b318b6d`).
- **PR 2 — CI automatica**: unita il 16 novembre 2026 (`4351b18`).
- **PR 3 — P-002 v2 e ciclo di lavoro** (16 novembre 2026): la proposta in [proposte/P-002.md](proposte/P-002.md) e `AGENTS.md` con il nuovo ciclo.
- **PR 5 — passo 0b di P-002** (16 novembre 2026, `49fac71`): nel focus a tutto schermo un dito che trascina non muove più niente. **Da provare sull'iPhone** (vedi [tre-modalita.md](../app-attivita/docs/tre-modalita.md), «Schermata ferma»).
- **PR 6 — passo 1 di P-002** (17 novembre 2026, `4473775`): la rotella apre «Impostazioni», un indice con lo stato di ogni funzione; il tema si sceglie nella riga; un foglio unico «Privacy»; «Scollega» con «Annulla»; la regola del giorno dell'assistente. **Da provare sull'iPhone** (vedi [impostazioni.md](../app-attivita/docs/impostazioni.md), «Da verificare sull'iPhone»).
- **PR 7 — P-003 v3** (18 novembre 2026): la proposta in [proposte/P-003.md](proposte/P-003.md), rivista tre volte da Codex. Il Product Owner ha tenuto tutte e tre le idee di Motivazione: la tua settimana, i tuoi premi, sfide di oggi.

## In lavorazione
- **Passo 3.1 di P-003** (Claude Project): cambio di scheda con un movimento d'insieme e aurora nel focus a tutto schermo.

## In attesa
- Le prove sull'iPhone rimandate, segnate «da verificare» in [decisioni.md](decisioni.md), sezione 2: assistente scritto, promemoria push anche ad app chiusa, Siri, pagina di prova della voce. I passi 3 e 4 di P-002 aspettano queste prove.

## Punti aperti
- **Controlli automatici di conformità** (passo 0a di P-002, livello B, esecutore ChatGPT / Codex): (a) segreti e percorsi locali nei file e nei messaggi dei commit della PR; (b) divieto di `innerHTML` nel codice dell'app; (c) `CACHE_VERSION` aggiornata quando cambiano i file dell'app.
- **Pagina che scorre dietro gli altri fogli**: il difetto del passo 0b fa pensare che su iPhone il blocco dello scorrimento dei fogli non basti. Va controllato con la prova del passo 0b (con un foglio aperto, trascinare sullo sfondo scuro). Se la pagina si muove, serve una correzione a parte.
- **Testo di P-001 v2**: non è nel repository. Qui ci sono la sua approvazione ([decisioni.md](decisioni.md), sezione 1) e ciò che stabilisce ([AGENTS.md](../AGENTS.md)).

## Prossimi passi
- **P-002**: 0a e passo 2 (Aura con un volto) toccano a ChatGPT / Codex e aspettano che il Product Owner crei l'ambiente di Codex. I passi 3 e 4 aspettano le prove sull'iPhone.
- **P-003**: dopo il passo 3.1, i passi 3.2–3.5 nell'ordine di [proposte/P-003.md](proposte/P-003.md), senza aspettare il passo 2 di P-002, perché toccano altre parti. Il 3.2 (Agenda a calendario) e il 3.5 (sfide) toccano a ChatGPT / Codex; il 3.2 lo fa Claude Project se l'ambiente di Codex non c'è ancora.
