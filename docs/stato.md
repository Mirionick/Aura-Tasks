# Stato del lavoro

Fotografia breve di dove siamo, per chi comincia un intervento. La aggiorna chi apre una Pull Request, dentro la Pull Request stessa.

Non ripete gli altri documenti: decisioni, funzioni e verifiche sono in [decisioni.md](decisioni.md), le regole in [AGENTS.md](../AGENTS.md).

**Aggiornato il** 27 novembre 2026, con la PR del passo 6.2 di P-006 (Claude nell'app).

## Pubblicato su `main`
- **App**: fino al passo 1 dell'assistente («Scrivi ad Aura», 13 novembre 2026), più i passi 0b e 1 di P-002 (il focus a tutto schermo resta fermo; la rotella apre le Impostazioni), i passi 3.1 (cambio di scheda e aurora nel focus), 3.2 (Agenda a calendario), 3.3 (Motivazione) e 3.4 («I tuoi premi») di P-003, i passi 4.1 (negozio), 4.2 (musica nel focus, senza account) e 4.4 (suoni del focus) di P-004, i passi 5.1 (attività che si ripetono) e 5.2 (scorrimento sulle card) di P-005 e due giri di rifiniture. Cache `aura-tasks-v24` (26 novembre 2026); dati alla versione 7 dello schema.
- **Server**: quello pubblicato con il passo 0 dell'assistente (11 novembre 2026). Il codice del passo 6.1 di P-006 (il connettore per Claude) è su `main` dal 23 novembre 2026, ma **non è ancora pubblicato**: servono `npm run db:init`, poi `npm run deploy`, da Claude Code sul PC con il via del Product Owner.
- **CI**: test del server e dell'app in Chrome headless su ogni PR (PR 2, unita il 16 novembre 2026 con `4351b18`), con un minimo di 362 test dell'app (251 prima del passo 4.1 di P-004, 279 prima del 4.2, 296 prima del passo 5.1 di P-005, 324 prima del 5.2, 335 prima del passo 4.4, 349 prima del passo 6.2 di P-006).
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
- **PR 21 — P-006 v2** (23 novembre 2026, `da3572f`): la proposta del connettore per Claude, in [proposte/P-006.md](proposte/P-006.md). Nelle chat con Claude si dice «mettilo su Aura» (o lo propone Claude) e le attività arrivano nella casella di Siri; Claude può solo aggiungere.
- **PR 22 — passo 6.1 di P-006** (23 novembre 2026, `52ec5ab`): il server del connettore, con l'accesso tramite il codice di Aura, il protocollo MCP nelle versioni 2025-11-25 e 2026-07-28, lo strumento «Aggiungi ad Aura» con i suoi limiti e quattro tabelle nuove. **Da pubblicare** (vedi sopra).
- **Dalla PR 12 alla PR 20** (26 novembre 2026, unite in ordine): P-004 v3 (PR 12, `a300e30`) e i suoi passi 4.1, il negozio (PR 13, `0704459`), 4.2, la musica nel focus (PR 15, `4c6d31a`) e 4.4, i suoni del focus (PR 20, `10ae56b`); P-005 v3 (PR 16, `2c82324`) e i suoi passi 5.1, le attività che si ripetono (PR 17, `d2307b5`) e 5.2, lo scorrimento sulle card (PR 18, `8065ac0`); le rifiniture di tutta l'app (PR 14, `72fe426`) e quelle per gli schermi piccoli (PR 19, `8ff4853`). **Da provare sull'iPhone**: le prove di ognuno sono in [decisioni.md](decisioni.md), sezione 2.

## In lavorazione
- **Passo 6.2 di P-006** (livello A, esecutore Claude Project, revisione di Codex): Claude nell'app. Nelle Impostazioni, dopo «Comando Rapido di Siri», la riga «Claude» apre il foglio «Claude»: che cosa fa, i passi con l'indirizzo e «Copia», «Mostra il codice» (in grande, con il tempo che resta; intanto l'app controlla ogni 4 secondi se il collegamento è arrivato), i collegamenti con le loro date e «Scollega Claude» con la conferma. Le frasi di Claude arrivano con «Da Claude», con l'assistente spento e acceso; la privacy lo dice. Niente dati nuovi, tranne l'origine delle frasi in coda; cache `aura-tasks-v25`. Specifica in [connettore-claude.md](../app-attivita/docs/connettore-claude.md), «Nell'app». Funziona quando il server del passo 6.1 è pubblicato. Provato nel browser con un server finto; **da provare con Claude vero e sull'iPhone** dopo il merge e la pubblicazione.

## In attesa
- Le prove sull'iPhone rimandate, segnate «da verificare» in [decisioni.md](decisioni.md), sezione 2: assistente scritto, promemoria push anche ad app chiusa, Siri, pagina di prova della voce, e i passi di P-003, P-004 e P-005. I passi 3 e 4 di P-002 aspettano queste prove.
- La pubblicazione del server del passo 6.1 di P-006 (`npm run db:init`, poi `npm run deploy`), con il via del Product Owner.
- La risposta del Product Owner su Spotify Premium (passo 4.3 di P-004), e la sua scelta, dopo la prova sull'iPhone, su che cosa fa il suono del focus quando suona Spotify (passo 4.4).

## Punti aperti
- **Controlli automatici di conformità** (passo 0a di P-002, livello B, esecutore ChatGPT / Codex): (a) segreti e percorsi locali nei file e nei messaggi dei commit della PR; (b) divieto di `innerHTML` nel codice dell'app; (c) `CACHE_VERSION` aggiornata quando cambiano i file dell'app.
- **Pagina che scorre dietro gli altri fogli**: il difetto del passo 0b fa pensare che su iPhone il blocco dello scorrimento dei fogli non basti. Va controllato con la prova del passo 0b (con un foglio aperto, trascinare sullo sfondo scuro). Se la pagina si muove, serve una correzione a parte.
- **Testo di P-001 v2**: non è nel repository. Qui ci sono la sua approvazione ([decisioni.md](decisioni.md), sezione 1) e ciò che stabilisce ([AGENTS.md](../AGENTS.md)).

## Prossimi passi
- **P-002**: 0a e passo 2 (Aura con un volto) toccano a ChatGPT / Codex e aspettano che il Product Owner crei l'ambiente di Codex. I passi 3 e 4 aspettano le prove sull'iPhone.
- **P-003**: resta il passo 3.5 («Sfide di oggi», ChatGPT / Codex), nell'ordine di [proposte/P-003.md](proposte/P-003.md), senza aspettare il passo 2 di P-002, perché tocca altre parti. Porterà i dati alla prima versione libera, la 8 dopo la 7 del passo 5.1 di P-005 (vedi [proposte/P-005.md](proposte/P-005.md), «Rapporto con P-003 e P-004»).
- **P-004**: dopo i passi 4.1, 4.2 e 4.4, il 4.3 (Spotify collegato) aspetta la risposta del Product Owner su Spotify Premium e la prova dei link del 4.2 sull'iPhone.
- **P-005**: dopo i passi 5.1 e 5.2, il 5.3 (le prossime ripetizioni in Agenda, facoltativo) si decide dopo la prova del 5.1 sull'iPhone.
- **P-006**: dopo questa PR e la pubblicazione del server, la prova con Claude vero (dal sito di Claude e dall'app sull'iPhone), da annotare in [decisioni.md](decisioni.md), sezione 4. Poi la riga passa alla sezione 2.
