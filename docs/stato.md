# Stato del lavoro

Fotografia breve di dove siamo, per chi comincia un intervento. La aggiorna chi apre una Pull Request, dentro la Pull Request stessa.

Non ripete gli altri documenti: decisioni, funzioni e verifiche sono in [decisioni.md](decisioni.md), le regole in [AGENTS.md](../AGENTS.md).

**Aggiornato il** 26 novembre 2026, con la PR della proposta P-004 (negozio e musica nel focus), unita dopo le PR 21 e 22.

## Pubblicato su `main`
- **App**: fino al passo 1 dell'assistente («Scrivi ad Aura», 13 novembre 2026), più i passi 0b e 1 di P-002 (il focus a tutto schermo resta fermo; la rotella apre le Impostazioni) e i passi 3.1 (cambio di scheda e aurora nel focus), 3.2 (Agenda a calendario), 3.3 (Motivazione) e 3.4 («I tuoi premi») di P-003. Cache `aura-tasks-v18` (20 novembre 2026); dati alla versione 5 dello schema.
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
- **PR 11 — passo 3.4 di P-003** (20 novembre 2026, `97f9301`): «I tuoi premi» in Motivazione, con il saldo da spendere, il riscatto con coriandoli e «Annulla»; spendere non fa mai scendere di livello. Dati alla versione 5 dello schema. **Da provare sull'iPhone** (vedi [tre-modalita.md](../app-attivita/docs/tre-modalita.md), «P-003, passo 3.4»).

## In lavorazione
- **Le PR dalla 12 alla 20**, aperte: la proposta P-004 e i suoi passi 4.1, 4.2 e 4.4, la proposta P-005 e i suoi passi 5.1 e 5.2, e due PR di rifiniture. Ognuna aggiorna questo file con il suo stato; si uniscono in ordine, dalla 12.
- **P-004 v3** (livello A, autore Claude Project, revisione di ChatGPT / Codex): negozio e musica nel focus, in [proposte/P-004.md](proposte/P-004.md). Quattro passi: 4.1 negozio (pagato con i punti ★, con lo stesso saldo dei premi, con «Ripara la serie» e i pacchetti di punti «Presto»), 4.2 musica senza account, 4.3 Spotify collegato (da ricollegare ogni sei mesi, regola di Spotify), 4.4 suoni del focus. Il Product Owner ha già deciso che le stelle a pagamento arrivano con la versione per altri, e che il negozio si costruisce subito.
- **Proposta P-006** (livello A, revisione di ChatGPT / Codex): il connettore per Claude. Nelle chat con Claude si dice «mettilo su Aura» (o lo propone Claude) e le attività arrivano nella casella di Siri, con l'etichetta «Da Claude». Claude può solo aggiungere. Ci si collega una volta, con un codice che Aura mostra per 10 minuti (OAuth sul server di Aura); il server parla le due versioni del protocollo MCP, 2025-11-25 e 2026-07-28. Due passi: 6.1 il server, 6.2 l'app. Il testo è in [proposte/P-006.md](proposte/P-006.md) (v2, con il tetto di 1.000 frasi al giorno per tutto il server), approvata il 23 novembre 2026 con il merge della PR 21; la costruisce Claude Project.
- **Passo 6.1 di P-006** (livello A, revisione di Codex): il server del connettore, scritto e provato. Accesso con il codice di Aura, connettore MCP nelle due versioni del protocollo, lo strumento «Aggiungi ad Aura» con i suoi limiti, quattro tabelle nuove. Specifica in [connettore-claude.md](../app-attivita/docs/connettore-claude.md). Dopo il merge va pubblicato: `npm run db:init`, poi `npm run deploy`, da Claude Code sul PC con il via del Product Owner. Non cambia niente per chi non usa Claude.

## In attesa
- Le prove sull'iPhone rimandate, segnate «da verificare» in [decisioni.md](decisioni.md), sezione 2: assistente scritto, promemoria push anche ad app chiusa, Siri, pagina di prova della voce. I passi 3 e 4 di P-002 aspettano queste prove.

## Punti aperti
- **Controlli automatici di conformità** (passo 0a di P-002, livello B, esecutore ChatGPT / Codex): (a) segreti e percorsi locali nei file e nei messaggi dei commit della PR; (b) divieto di `innerHTML` nel codice dell'app; (c) `CACHE_VERSION` aggiornata quando cambiano i file dell'app.
- **Pagina che scorre dietro gli altri fogli**: il difetto del passo 0b fa pensare che su iPhone il blocco dello scorrimento dei fogli non basti. Va controllato con la prova del passo 0b (con un foglio aperto, trascinare sullo sfondo scuro). Se la pagina si muove, serve una correzione a parte.
- **Testo di P-001 v2**: non è nel repository. Qui ci sono la sua approvazione ([decisioni.md](decisioni.md), sezione 1) e ciò che stabilisce ([AGENTS.md](../AGENTS.md)).

## Prossimi passi
- **P-002**: 0a e passo 2 (Aura con un volto) toccano a ChatGPT / Codex e aspettano che il Product Owner crei l'ambiente di Codex. I passi 3 e 4 aspettano le prove sull'iPhone.
- **P-003**: resta il passo 3.5 («Sfide di oggi», ChatGPT / Codex), nell'ordine di [proposte/P-003.md](proposte/P-003.md), senza aspettare il passo 2 di P-002, perché tocca altre parti. Se arriva dopo il passo 4.1 di P-004, porterà i dati alla versione 7.
- **P-004**: dopo l'approvazione, il passo 4.1 (negozio, dati alla versione 6).
- **P-006**: dopo il merge della proposta e del passo 6.1, la pubblicazione del server (Claude Code sul PC, con il via del Product Owner); poi il passo 6.2 (app), dopo le PR dell'app già aperte, e la prova con Claude vero.
