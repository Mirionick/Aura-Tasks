# Stato del lavoro

Fotografia breve di dove siamo, per chi comincia un intervento. La aggiorna chi apre una Pull Request, dentro la Pull Request stessa.

Non ripete gli altri documenti: decisioni, funzioni e verifiche sono in [decisioni.md](decisioni.md), le regole in [AGENTS.md](../AGENTS.md).

**Aggiornato il** 19 novembre 2026, con la PR del passo 3.4 di P-003 («I tuoi premi»).

## Pubblicato su `main`
- **App**: fino al passo 1 dell'assistente («Scrivi ad Aura», 13 novembre 2026), più i passi 0b e 1 di P-002 (il focus a tutto schermo resta fermo; la rotella apre le Impostazioni) e i passi 3.1 (cambio di scheda e aurora nel focus), 3.2 (Agenda a calendario) e 3.3 (Motivazione) di P-003. Cache `aura-tasks-v17` (19 novembre 2026). Con questa PR: passo 3.4 di P-003, cache `aura-tasks-v18` e dati alla versione 5 dello schema.
- **Server**: quello pubblicato con il passo 0 dell'assistente (11 novembre 2026); il passo 1 non lo ha cambiato.
- **CI**: test del server e dell'app in Chrome headless su ogni PR (PR 2, unita il 16 novembre 2026 con `4351b18`), con un minimo di 251 test dell'app (233 prima del passo 3.4 di P-003).
- **Protezione di `main`** (16 novembre 2026): solo PR, con il controllo «Test backend e frontend» obbligatorio, niente force push né cancellazione, nessuna eccezione. Attivi secret scanning, push protection, avvisi di Dependabot e CodeQL. Codex rivede ogni PR: la revisione parte all'apertura oppure con il commento `@codex review` (così è partita sulla PR 3).

L'elenco delle funzioni realizzate è in [decisioni.md](decisioni.md), sezione 2.

## Completato di recente
- **PR 1 — P-001 v2**: documentazione e configurazione condivisa, unita il 16 novembre 2026 (`b318b6d`).
- **PR 2 — CI automatica**: unita il 16 novembre 2026 (`4351b18`).
- **PR 3 — P-002 v2 e ciclo di lavoro** (16 novembre 2026): la proposta in [proposte/P-002.md](proposte/P-002.md) e `AGENTS.md` con il nuovo ciclo.
- **PR 5 — passo 0b di P-002** (16 novembre 2026, `49fac71`): nel focus a tutto schermo un dito che trascina non muove più niente. **Da provare sull'iPhone** (vedi [tre-modalita.md](../app-attivita/docs/tre-modalita.md), «Schermata ferma»).
- **PR 6 — passo 1 di P-002** (17 novembre 2026, `4473775`): la rotella apre «Impostazioni», un indice con lo stato di ogni funzione; il tema si sceglie nella riga; un foglio unico «Privacy»; «Scollega» con «Annulla»; la regola del giorno dell'assistente. **Da provare sull'iPhone** (vedi [impostazioni.md](../app-attivita/docs/impostazioni.md), «Da verificare sull'iPhone»).
- **PR 7 — P-003 v3** (18 novembre 2026, `0b0f766`): la proposta in [proposte/P-003.md](proposte/P-003.md), rivista tre volte da Codex. Il Product Owner ha tenuto tutte e tre le idee di Motivazione: la tua settimana, i tuoi premi, sfide di oggi.
- **PR 8 — passo 3.1 di P-003** (19 novembre 2026, `9626161`): cambio di scheda con un movimento d'insieme e, nel focus a tutto schermo, l'aurora che sale con il tempo. **Da provare sull'iPhone** (vedi [tre-modalita.md](../app-attivita/docs/tre-modalita.md), «P-003, passo 3.1»).
- **PR 9 — passo 3.2 di P-003** (19 novembre 2026, `5a76a08`): l'Agenda diventa un calendario del mese o della settimana, con il giorno scelto (orari, spazi liberi, linea dell'ora), «Prossimi giorni» e «Da pianificare» con «Metti a…». **Da provare sull'iPhone** (vedi [tre-modalita.md](../app-attivita/docs/tre-modalita.md), «P-003, passo 3.2»).
- **PR 10 — passo 3.3 di P-003** (19 novembre 2026, `8ebc23c`): Motivazione con il livello nell'intestazione, «La tua settimana» (il cielo, l'obiettivo e la costellazione), «I tuoi numeri» e «Completate» chiusa; i distintivi dei livelli 1, 2, 3, 5, 6 e 7. **Da provare sull'iPhone** (vedi [tre-modalita.md](../app-attivita/docs/tre-modalita.md), «P-003, passo 3.3»).

## In lavorazione
- **Passo 3.4 di P-003** (livello A, esecutore Claude Project, revisione di ChatGPT / Codex): «I tuoi premi» in Motivazione. Ognuno scrive i suoi premi (nome, emoji da un elenco fisso, prezzo in punti) e li riscatta con il saldo da spendere, con coriandoli e «Annulla»; spendere non fa mai scendere di livello. I dati passano alla versione 5 dello schema (`rewards` e `stats.spent`), nel backup anche premi e riscatti. Specifica in [proposte/P-003.md](proposte/P-003.md), passo 3.4, regole in [punti-e-serie.md](../app-attivita/docs/punti-e-serie.md), «Premi», misure in [tre-modalita.md](../app-attivita/docs/tre-modalita.md), «Risultati del passo 3.4». Provato nel browser; **da provare sull'iPhone** dopo il merge.

## In attesa
- Le prove sull'iPhone rimandate, segnate «da verificare» in [decisioni.md](decisioni.md), sezione 2: assistente scritto, promemoria push anche ad app chiusa, Siri, pagina di prova della voce. I passi 3 e 4 di P-002 aspettano queste prove.

## Punti aperti
- **Controlli automatici di conformità** (passo 0a di P-002, livello B, esecutore ChatGPT / Codex): (a) segreti e percorsi locali nei file e nei messaggi dei commit della PR; (b) divieto di `innerHTML` nel codice dell'app; (c) `CACHE_VERSION` aggiornata quando cambiano i file dell'app.
- **Pagina che scorre dietro gli altri fogli**: il difetto del passo 0b fa pensare che su iPhone il blocco dello scorrimento dei fogli non basti. Va controllato con la prova del passo 0b (con un foglio aperto, trascinare sullo sfondo scuro). Se la pagina si muove, serve una correzione a parte.
- **Testo di P-001 v2**: non è nel repository. Qui ci sono la sua approvazione ([decisioni.md](decisioni.md), sezione 1) e ciò che stabilisce ([AGENTS.md](../AGENTS.md)).

## Prossimi passi
- **P-002**: 0a e passo 2 (Aura con un volto) toccano a ChatGPT / Codex e aspettano che il Product Owner crei l'ambiente di Codex. I passi 3 e 4 aspettano le prove sull'iPhone.
- **P-003**: dopo il passo 3.4, il 3.5 («Sfide di oggi», ChatGPT / Codex) nell'ordine di [proposte/P-003.md](proposte/P-003.md), senza aspettare il passo 2 di P-002, perché tocca altre parti. Porterà i dati alla versione 6.
