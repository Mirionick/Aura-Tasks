# Aura Tasks — guida al progetto

> **Guida tecnica di riferimento.** È la guida completa del progetto, che prima era `app-attivita/CLAUDE.md`. Claude Code **non la carica da sola**: si leggono le sezioni che servono al compito. I percorsi scritti qui restano relativi ad `app-attivita/` (`js/app.js`, `docs/…`, `../server/`).
>
> **Ogni regola sta in un solo posto.** Questa guida è la fonte delle convenzioni tecniche (struttura, dati, convenzioni, test, design) e non ripete ciò che sta altrove:
> - le regole fisse condivise da tutti gli agenti, i ruoli e i livelli sono in `../AGENTS.md`;
> - le istruzioni di lavoro e i vincoli sempre attivi sono nei `CLAUDE.md` (`../CLAUDE.md`, `CLAUDE.md`, `../server/CLAUDE.md`);
> - le procedure sono nelle skill (`../.claude/skills/`);
> - i file in `../.claude/rules/` sono richiami: dicono quali sezioni di questa guida leggere per i file che si stanno modificando.

App web installabile (PWA) **in italiano**: un **segretario personale** sul telefono.

## La visione
Aura deve permettere di **catturare un impegno in pochi secondi**, con una frase o con la voce ("domani alle 10 dentista"), e poi di **ricordarlo** al momento giusto.
- Le scelte di prodotto si misurano su due domande:
  - quanto è più veloce mettere dentro un impegno?
  - quanto è più affidabile che venga ricordato?
- Tutti i dati restano nel `localStorage` del dispositivo.
- L'unica eccezione a "niente server" è il **server di Aura** (cartella `server/` del repository, Cloudflare Workers, piano gratuito). È facoltativo: se l'utente attiva promemoria o Siri, riceve solo titolo e ora dei promemoria e le frasi dettate a Siri (vedi [docs/promemoria-e-siri.md](promemoria-e-siri.md)).
  - Con l'**assistente** acceso (facoltativo, dopo il consenso; vedi [docs/assistente.md](assistente.md)) il server riceve anche i messaggi scritti ad Aura, le frasi di Siri e l'elenco delle attività da fare, per passarli a Workers AI **senza salvarli**. Le registrazioni della voce arrivano col passo 2: per ora le manda solo la pagina di prova.
  - Con il **connettore per Claude** (facoltativo; vedi [docs/connettore-claude.md](connettore-claude.md)) il server riceve le frasi che Claude aggiunge, nella casella di Siri. Claude non può leggere niente di Aura.

## Cosa sa fare oggi
- **Attività**: ognuna ha titolo, durata stimata in minuti, livello di energia (bassa/media/alta), data facoltativa e **orario** facoltativo.
- **Tre schede**, con una barra in basso (vedi [docs/tre-modalita.md](tre-modalita.md)):
  - **Focus**, per fare: in ritardo, oggi, senza data e «Completate oggi»;
  - **Agenda**, per pianificare: un calendario del mese (o solo della settimana) con i puntini delle attività; sotto, il giorno scelto con «In giornata» e «Con orario» (spazi liberi con il «+», linea dell'ora, sovrapposizioni), «Prossimi giorni» e «Da pianificare» con «Metti a…»;
  - **Motivazione**, per i progressi: il livello con il distintivo, serie e punti in grande, «La tua settimana» (una stella per ogni attività completata e l'obiettivo della settimana, che raggiunto la fa diventare una costellazione), «I tuoi premi» (premi scelti da te con un prezzo in punti, da riscattare con il saldo), «I tuoi numeri» (minuti di focus, serie più lunga, giorno migliore, completate in tutto), le completate e il backup.
- **«Cosa faccio adesso?»**: dici quanto tempo hai e come ti senti, e Aura propone un'attività, con il motivo. La proposta è già scritta nella striscia in cima a Focus.
- **Assistente «Aura»** (facoltativo, con l'IA del server di Aura): le scrivi una frase («domani devo chiamare il medico», «ho 40 minuti e sono cotto») e lei propone, aggiunge o sposta secondo i permessi che scegli. Completare ed eliminare restano sempre un tuo tocco. Spento, senza internet o a quota finita, tutto funziona come prima.
- **Focus a tutto schermo**: un timer sull'attività scelta, con pausa, +5 min e un suono alla fine. I **minuti di focus** finiscono nel registro.
- **Musica nel focus**, senza account: nelle Impostazioni si sceglie Spotify, Apple Music o Amazon Music; in Focus, sotto «Cosa faccio adesso?», cinque playlist per umore che si aprono nell'app del servizio, e nel focus a tutto schermo «🎧» riapre l'ultima. Senza un servizio scelto c'è un avviso, che si rimanda o si toglie per sempre (vedi [docs/musica.md](musica.md)).
- **Suoni del focus**, fatti da Aura con la Web Audio API, senza file audio e anche senza rete: nel focus a tutto schermo «Suono», in alto a sinistra, sceglie tra Silenzio, Rumore marrone (gratis), Pioggia e Onde (300 punti l'uno, nel negozio, dove si ascoltano con un tocco anche prima di comprarli). Il suono c'è mentre il focus conta il tempo (vedi [docs/suoni.md](suoni.md)).
- **Gestione**: aggiungere, **modificare** (tocco sulla card), completare (con "Annulla"), eliminare (con "Annulla") e svuotare le completate.
- **Attività che si ripetono**: nel foglio, «Si ripete» ogni giorno, ogni settimana nei giorni scelti oppure ogni mese. Completandola arriva la prossima, una sola da fare per volta; «Salta questa volta» la porta al primo giorno giusto; sulla card c'è ↻. Si scrive anche nella frase: «palestra ogni lunedì e giovedì alle 18» (vedi [docs/ripetizioni.md](ripetizioni.md)).
- **Scorrimento sulle card**: con il dito, sulle card da fare di Focus e Agenda, verso destra si completa e verso sinistra si elimina, tutti e due con «Annulla». La spunta e il cestino restano (vedi [docs/scorrimento.md](scorrimento.md)).
- **Backup dei dati**: esportare e importare un file JSON con attività, punti, serie, minuti di focus, premi e riscatti (link "Backup dei dati" in fondo a Motivazione, e riga nelle Impostazioni).
- **Scrivere una frase**, che compila il modulo da sola ("domani alle 10 dentista 30 min").
- **Aprire il link `…/?add=testo`**, che apre il modulo già compilato (vedi [docs/linguaggio-naturale.md](linguaggio-naturale.md)).
- **Liste** divise per giorno, con le attività in ordine d'ora. In quelle di oggi l'ora già passata è in rosso.
- **Riepilogo** nell'intestazione di Focus, compatta: "Da fare", "Tempo" e "Fatte oggi" in una riga, serie e punti in due chip.
- **Impostazioni**: la rotella nell'intestazione, in tutte le schede, apre un indice. Ogni riga dice lo stato di adesso e apre il foglio della sua funzione; il **tema** Automatico/Chiaro/Scuro si sceglie nella riga. Il foglio **Privacy** dice in un posto solo che cosa resta sul telefono e che cosa va al server, e «Scollega questo dispositivo» ha il suo «Annulla» (vedi [docs/impostazioni.md](impostazioni.md)).
- **Uso offline**.
- **Punti e serie**: ogni attività completata dà punti. I giorni di fila con almeno un completamento formano la **serie** 🔥, con record e traguardi festeggiati (vedi [docs/punti-e-serie.md](punti-e-serie.md)).
- **Promemoria push** (facoltativi): un avviso prima delle attività con giorno e ora, anche ad app chiusa. L'anticipo si sceglie.
- **Casella di Siri**: "Ehi Siri, Aura" e si detta l'impegno; aprendo Aura il foglio è già compilato (con l'assistente acceso, la frase passa da lui). Promemoria, casella e assistente usano il server di Aura.
- **Connettore per Claude** (facoltativo): nelle chat con Claude si dice «mettilo su Aura» (o lo propone Claude) e le attività arrivano nella casella di Siri, con «Da Claude». Ci si collega una volta dalle Impostazioni, riga «Claude», con un codice che vale 10 minuti; Claude può solo aggiungere (vedi [docs/connettore-claude.md](connettore-claude.md)).

---

## Note per Claude

- L'utente prova l'app su un **iPhone vero**. I controlli automatici su questo PC usano Edge headless e, con Playwright, il motore di Safari (WebKit), che però non è iOS (vedi "Test").
- **Specifiche in `docs/`**: questa guida tiene visione, convenzioni e struttura; la specifica di ogni funzione sta in un file di `docs/` (vedi "Indice delle specifiche").
- Le istruzioni di lavoro (lingua, specifica da leggere e da aggiornare, che cosa dire delle prove sull'iPhone, «pubblica», Node.js nel terminale) stanno nei `CLAUDE.md` indicati in cima.

## Vincoli da rispettare sempre

I vincoli non sono ripetuti qui:
- quelli condivisi da tutti gli agenti sono le «Regole fisse» di `../AGENTS.md`;
- quelli propri dell'app sono i «Vincoli sempre attivi» di `CLAUDE.md`;
- la lingua di testi, commenti e identificatori è in `../CLAUDE.md`.

Una precisazione sul server: in `server/` npm serve solo a installare Wrangler, lo strumento di Cloudflare; il codice del server non ha dipendenze.

## Avvio, pubblicazione e installazione

### Sul computer
Doppio clic su `index.html` (Edge, Chrome, Firefox o Safari).
- Da `file://` il service worker non viene registrato e l'installazione non è disponibile: è normale.
- In console può comparire un errore CORS sul manifest: è innocuo.

Per provare la PWA (offline, installazione) serve un indirizzo `http://localhost` o `https://`.

### Pubblicare con Git
- **Repository**: https://github.com/Mirionick/Aura-Tasks (pubblico, ramo `main`).
  - L'app sta in `app-attivita/`, il server in `server/` (vedi [docs/promemoria-e-siri.md](promemoria-e-siri.md)).
  - Alla radice ci sono poi `AGENTS.md` (regole condivise da tutti gli agenti), `docs/` (stato del lavoro, decisioni e proposte), `CLAUDE.md` (istruzioni per Claude Code: non importa più questa guida), `CLAUDE-WORKFLOW.md`, `.claude/` (richiami per area, skill e permessi di Claude Code), `.github/` (modello delle Pull Request) e `.gitignore`.
- **Copia di lavoro**: `Documenti\Aura-Tasks`.
- **Sito**: https://mirionick.github.io/Aura-Tasks/app-attivita/, servito da GitHub Pages ("Deploy from a branch", `main`, `/ (root)`). Si aggiorna circa un minuto dopo ogni aggiornamento di `main`.
- **Server**: https://aura.auramirionick.workers.dev, sull'account Cloudflare dell'utente (sottodominio `auramirionick`, database D1 `aura` in Europa occidentale). Wrangler su questo PC ha già fatto il login.
- **Identità dei commit**: è impostata solo in questo repository, con `Mirionick` e l'indirizzo noreply di GitHub.

Pubblicare vuol dire portare il lavoro su `main` secondo la regola 5 di `../AGENTS.md`. Quando l'utente dice **"pubblica"**:
1. Esegui i controlli della skill `/release-check` (`../.claude/skills/release-check/SKILL.md`): stato di Git e file estranei, file dei segreti ignorati, controllo privacy, identità dei commit.
2. Esegui i test (vedi "Test"), che devono essere tutti verdi, e passa la "Checklist prima di chiudere una modifica".
   - Se è cambiato `server/`: `npm test`. Poi, con il via del Product Owner, `npm run deploy` in `server/`, **prima** del merge se l'app pubblicata ne ha bisogno: il merge aggiorna solo l'app.
     - Se è cambiato `schema.sql`: `npm run db:init` **prima** di `npm run deploy` (aggiunge solo ciò che manca, non cancella nulla).
3. Fai il commit sul branch di lavoro, con un messaggio chiaro in italiano: la prima riga dice cosa cambia per chi usa l'app, le righe dopo danno i dettagli.
   - Su Windows PowerShell 5.1 scrivi il messaggio in un file UTF-8 e usa `git commit -F <file>`. Con `-m`, le virgolette dentro il messaggio si perdono o fanno fallire il comando.
4. Esegui il `git push` del branch e apri, o aggiorna, la Pull Request verso `main` con il modello `../.github/pull_request_template.md`. Se Git chiede di accedere a GitHub, avvisa l'utente: farà il login dalla finestra del browser.
   - Dagli strumenti di Claude la finestra di login non si apre (`GCM_INTERACTIVE=never`): chiedi all'utente di eseguire `git push` una volta dal suo terminale. Dopo il login le credenziali restano salvate in Windows e i push successivi funzionano anche da qui.

Dopo il merge il telefono scarica la nuova versione alla prima apertura con internet, perché il service worker prova prima la rete.

### Installare sul telefono
- **iPhone (Safari)**: apri l'indirizzo → Condividi → "Aggiungi alla schermata Home".
- **Android (Chrome)**: apri l'indirizzo → menu ⋮ → "Installa app" oppure "Aggiungi a schermata Home".

⚠️ **Su iPhone l'app installata ha un archivio separato da Safari**: le attività inserite in Safari non compaiono nell'app installata, e viceversa. Conviene installarla subito e usarla sempre dall'icona.

⚠️ I dati sono legati al dispositivo e al browser: cancellare i dati di navigazione li elimina, e non si sincronizzano tra dispositivi. Per conservarli o spostarli c'è il backup (vedi [docs/backup.md](backup.md)).

## Struttura dei file

| File | Ruolo |
|---|---|
| `index.html` | Struttura della pagina e meta per mobile e PWA. Contiene lo sprite delle icone SVG, l'intestazione, le tre schede (`<section class="tab">`) con la barra (`<nav class="tabbar">`), i fogli `<dialog>` ("Nuova attività", che fa anche da "Modifica attività"; «Impostazioni»; «Privacy»; "Promemoria e Siri"; "Backup dei dati"; «Cosa faccio adesso?», che con l'assistente acceso si chiama «Aura»; «Assistente»; Focus a tutto schermo; il foglio del premio, «Nuovo premio» o «Modifica premio»; il foglio «Negozio»; «Quando te lo ricordo?», dall'avviso della musica) e il `<template>` della card |
| `css/style.css` | Design system: token (variabili) per i due temi, componenti, animazioni. Le tavolozze dei colori dell'aurora (`[data-aurora]`, con il bagliore dell'intestazione di Focus per tema) e le forme dei coriandoli (`[data-shape]`) |
| `js/theme.js` | Tema Automatico/Chiaro/Scuro. Caricato nel `<head>` **senza `defer`** per applicare il tema prima del primo disegno (niente lampi) |
| `js/utils.js` | Date e orari locali, formattazione in italiano, saluto, id univoci |
| `js/repeat.js` | Logica pura delle attività che si ripetono (P-005, passo 5.1; specifica in [docs/ripetizioni.md](ripetizioni.md)): le regole e la loro pulizia (`clean`, `same`, `fromKind`), il giorno dopo (`nextAfter`, `onOrAfter`), completare e saltare (`afterDone`, `afterSkip`), i testi (`label`, `spokenLabel`, `dayLabel`, `returnLabel`), i campi letti (`sanitize`). Lavora sui giorni, non sulle ore |
| `js/tasks.js` | Logica pura delle attività: livelli di energia, limiti, validazione, creazione, modifica, completamento, eliminazione e ripristino, sezioni, riepilogo. Ripetizioni (P-005, passo 5.1): completare prepara la prossima (`toggleDone`), «Salta questa volta» (`skipOccurrence`), la volta da fare di una serie (`openInSeries`), confronto dei campi del foglio (`sameFields`). Schede: quali sezioni mostra ognuna (`TAB_SECTIONS`), in quale scheda si vede un'attività (`tabOf`, `isInTab`), completate di un giorno (`completedOn`), ora già passata (`isTimePassed`). Ordini delle liste, usati anche dall'Agenda (`compareByTime`, `compareByDate`, `compareByCreation`) |
| `js/nlp.js` | Logica pura del linguaggio naturale: `parseTaskText(testo, adesso)` riconosce giorno, orario, durata ed energia in una frase. `parseDetails()` dà gli stessi campi più `dateSaid` (la frase nomina un giorno?), per l'assistente |
| `js/points.js` | Logica pura di punti e serie: regole (`POINTS`), completamento con punti, registro dei giorni, serie, record, traguardi, ricostruzione del registro per la migrazione. Serie e record contano anche i giorni riparati nel negozio (`repairedDays`). I punti spesi in premi e nel negozio non toccano il totale: li conta `rewards.js` |
| `js/focus.js` | Logica pura della modalità focus: sessione (`start`, `pause`, `resume`, `extend`), tempo che manca calcolato dagli istanti, esito di una sessione (`sessionResult`), minuti di focus nel registro (`recordMinutes`), pulizia di sessione e minuti |
| `js/suggest.js` | Logica pura di «Cosa faccio adesso?»: `suggest(tasks, { minutes, energy, today, now, exclude, random })` sceglie la proposta e ne dice il motivo (un'attività di oggi con l'orario solo da 15 minuti prima); pesi e scelte in `SUGGEST`. Con `first` la proposta è un'attività già scelta (quella scritta nella striscia). `candidates()` dà tutte le candidate, senza caso: una proposta dell'IA vale solo se è lì dentro |
| `js/assistant.js` | Logica pura dell'assistente: ciò che si manda al server (`buildRequest`: attività con sigle al posto degli id, memoria breve), controllo della risposta con le regole del modulo e con i freni (`planReply`), permessi (`isAutomatic`), applicare e annullare (`applyAuto`, `undoEntries`), frasi scritte dall'app, copia della proposta all'apertura, pulizia dei dati salvati. Limiti e valori di partenza in `ASSISTANT` |
| `js/agenda.js` | Logica pura dell'Agenda a calendario: griglia del mese e settimana del giorno scelto (`calendar`, `monthWeeks`, `weekOf`), frecce (`navigate`), puntini, attività del giorno (`dayTasks`), «Con orario» con spazi liberi, linea dell'ora e sovrapposizioni (`schedule`), «Prossimi giorni» e «Da pianificare» (`upcoming`, `unplanned`), che cosa si vede (`isInAgenda`), il giorno di «Metti a…» (`planDate`), frasi per la pagina e per il lettore di schermo. Valori in `AGENDA` |
| `js/motivation.js` | Logica pura della scheda Motivazione, tutta dal registro: livelli dai punti guadagnati, mai salvati (`LEVELS`, `levelOf`, `levelUp`, Aurora 2, 3… compresi), la settimana da lunedì e quella scorsa (`weekOf`, `lastWeek`), l'obiettivo (`nextGoal`, `sanitizeGoal`), il cielo con le stelle, i cerchi che mancano e la costellazione (`sky`, `starAt`, `constellation`), «I tuoi numeri» (`numbers`, `numberRows`), frasi per la pagina e per il lettore di schermo. Valori in `MOTIVATION` |
| `js/rewards.js` | Logica pura di «I tuoi premi» (P-003, passo 3.4; regole in [docs/punti-e-serie.md](punti-e-serie.md), «Premi»): il saldo da spendere (`balance`: punti guadagnati meno punti spesi in premi e nel negozio), il riscatto e il suo «Annulla» (`redeem`, `undoRedeem`), aggiungere, modificare, eliminare e rimettere un premio, il controllo del foglio (`validateInput`), le righe della card (`rows`), lo storico dei riscatti (`history`), il premio che un completamento rende riscattabile (`newlyReady`), l'emoji scelta dal nome (`guessEmoji`), la pulizia di premi e riscatti letti, le frasi. Limiti, prezzi pronti ed emoji in `REWARDS` |
| `js/shop.js` | Logica pura del «Negozio» (P-004, passo 4.1; regole in [docs/punti-e-serie.md](punti-e-serie.md), «Negozio»): il catalogo con i prezzi e le regole (`SHOP`), comprare, usare e «Annulla» (`buy`, `use`, `undo`), «Ripara la serie» (`repairOffer`, `repair`, `repairsUsed`), che cosa è tuo (`isOwned`), gli oggetti del foglio (`catalog`), quello che è in uso all'inizio (`defaultLook`), la pulizia di acquisti e `look` letti, le frasi. Paga con il saldo di `rewards.js` |
| `js/music.js` | Logica pura della musica nel focus, senza account (P-004, passo 4.2; specifica in [docs/musica.md](musica.md)): i servizi (`SERVICES`, più «Nessuno»), gli umori (`MOODS`), le playlist di ogni servizio (`PLAYLISTS`, `link`), che cosa mostra Focus (`view`: l'avviso, il carosello aperto o ridotto, oppure niente), i rimandi di «Quando te lo ricordo?» (`LATER`, `later`), il servizio scelto (`choose`), l'ultimo umore (`remember`, `focusLink`), le card (`cards`), le frasi della riga «Musica» (`stateLabel`), le preferenze ripulite (`sanitize`) |
| `js/sound.js` | Logica pura dei suoni del focus (P-004, passo 4.4; specifica in [docs/suoni.md](suoni.md)): numeri casuali ripetibili (`random`), rumore bianco, marrone e rosa (`white`, `brownNoise`, `pinkNoise`), i filtri (`biquad`, `filter`), la giunta senza scatto (`loopable`), volume medio e picco (`rmsOf`, `normalize`), i tre pezzi (`brown`, `rain`, `sea`, e `piece` che li chiama per nome), il programma delle onde (`nextWave`, `waveCurves`), le frasi (`shopNote`, `buttonLabel`). Misure in `SOUND`. Niente DOM e niente Web Audio |
| `js/sound-worker.js` | Il lavoratore (Web Worker) che calcola i pezzi dei suoni fuori dal thread principale: carica `sound.js` con `importScripts`, riceve `{ id, name, rate, seed }` e risponde con i due canali (passati senza copia) oppure con `{ id, error: true }`. Un pezzo di pioggia costa 60–90 ms, il triplo su un telefono lento: così il tocco che fa partire un suono non lo aspetta |
| `js/swipe.js` | Logica pura dello scorrimento sulle card (P-005, passo 5.2; specifica in [docs/scorrimento.md](scorrimento.md)): dito o penna (`accepts`), bordi dello schermo (`atEdge`), direzione dopo 10 px (`lock`), dove sta la card (`offset`), lato e soglia del 40% (`side`, `armed`), velocità degli ultimi 100 ms (`velocity`), decisione al rilascio con il colpo veloce (`decide`) e un gesto intero passo per passo (`track`). Niente DOM |
| `js/storage.js` | Lettura e scrittura del `localStorage`, versione dello schema, migrazioni, pulizia di attività, premi, registro (con gli acquisti del negozio) e `look`. File di backup (esportazione e lettura, con gli stessi controlli) e copia dei dati di prima di un'importazione. Preferenze (`aura-tasks:prefs`), focus in corso (`aura-tasks:focus`) e dati dell'assistente (`aura-tasks:assistant`) |
| `js/reminders.js` | Logica pura dei promemoria: dalle attività con giorno e ora all'elenco per il server (`at`, `fireAt`), anticipi, impronta dell'elenco |
| `js/remote.js` | Collegamento al server di Aura, senza DOM: richieste (anche quelle dell'assistente: `api.transcribe`, `api.chat`, e di Claude: `api.claudeCode`, `api.claudeStatus`, `api.claudeUnlink`), codice del dispositivo, sottoscrizione push, impostazioni in `aura-tasks:remote`, con l'origine delle frasi in coda (`source`: Siri o Claude) e la loro intestazione (`inboxLabel`). Le funzioni pure sono testate |
| `js/settings.js` | Logica pura delle Impostazioni: che cosa dice ogni riga del foglio con i dati di adesso (`describe`, anche la riga «Claude»), la frase su dove stanno i dati, intera e breve (`privacyLine`, `privacyShort`), i tre temi con nome e descrizione (`THEMES`) |
| `js/claude.js` | Logica pura del connettore per Claude (P-006, passo 6.2; specifica in [docs/connettore-claude.md](connettore-claude.md)): il codice per collegare in due gruppi e scritto un carattere alla volta (`groupCode`, `spellCode`), quanto vale ancora (`codeDeadline`, `timeLeft`), lo stato del server ripulito (`readStatus`), un collegamento nuovo riconosciuto dalla data (`hasNewLink`), la riga di ogni collegamento (`linkLine`), l'indirizzo del connettore (`connectorUrl`) |
| `js/motion.js` | Movimento: durate e curve lette dai token di `style.css`, tecnica FLIP (`snapshot()` prima di `render()`, `play()` dopo), fantasmi degli elementi tolti (con `slideX` il fantasma di una card eliminata scorrendo continua il gesto), entrata di un blocco (`slideIn()`), cambio di scheda (`staggerIn()` a blocchi e `shiftIn()` per lo sfondo dell'intestazione), `flash()`. Tocca la pagina solo per le animazioni; `planFlip()` e `staggerDelays()` sono pure e testate |
| `js/ui-focus.js` | Interfaccia dei fogli «Cosa faccio adesso?» e Focus a tutto schermo: proposta, timer, suono di fine (Web Audio), schermo acceso (wake lock), aurora che sale con il tempo. Tocca la pagina come `app.js`, che gli passa ciò che serve con `Aura.focusUI.init()`. `openSuggest({ taskId, reason })` apre il foglio sull'attività scritta nella striscia. Per i suoni del focus: `ctx.onRunning(running)` ogni volta che decide se il tempo conta, `ctx.beforeAudio()` prima di sbloccare l'audio e `ctx.onAudioUnlocked()` dopo; `getAudio()` e `unlockAudio()` danno l'`AudioContext` |
| `js/ui-assistant.js` | Interfaccia dell'assistente: la striscia in cima a Focus (proposta delle regole o dell'IA), il campo «Scrivi ad Aura…» con le righe delle azioni nel foglio «Aura», il consenso, il foglio «Assistente» (interruttori, elenco «Cosa ha fatto l'assistente», privacy, «Scollega»), la proposta all'apertura e le frasi di Siri. Avviato da `app.js` con `Aura.assistantUI.init()`, dopo `ui-focus.js` |
| `js/ui-claude.js` | Interfaccia del foglio «Claude», aperto dalla riga delle Impostazioni: i passi con l'indirizzo e «Copia», «Mostra il codice» (con il tempo che resta e «Nuovo codice»; intanto lo stato si controlla ogni 4 secondi), i collegamenti con le loro date e «Scollega Claude» con la conferma. Lo stato sta solo in memoria: si chiede al server all'avvio, aprendo le Impostazioni (al massimo ogni 30 secondi) e aprendo il foglio. Mostra gli elementi con `data-if-claude` solo con Claude collegato. Avviato da `app.js` con `Aura.claudeUI.init()`, prima di `ui-settings.js`, che ne usa `open()` e `refresh()`; per «Scollega questo dispositivo» `app.js` ne usa `settle()` (chiede se Claude è collegato, prima) e `forget()` (dopo) |
| `js/ui-settings.js` | Interfaccia della rotella e dei fogli «Impostazioni» e «Privacy»: le righe con lo stato di adesso (le frasi le scrive `settings.js`), il tema scelto nella riga, le copie dei testi sulla privacy, «Scollega questo dispositivo». Le righe aprono, sopra, i fogli che ci sono già. Avviato da `app.js` con `Aura.settingsUI.init()`, dopo `ui-assistant.js` |
| `js/ui-agenda.js` | Interfaccia dell'Agenda: calendario (mese o settimana, frecce, scorrimento di lato, «Oggi», maniglia), giorno scelto con «In giornata» e «Con orario», «Prossimi giorni» e «Da pianificare» con «Metti a…», movimenti. Tiene il giorno scelto. Avviato da `app.js` con `Aura.agendaUI.init()`, dopo `ui-settings.js`; ogni minuto `tick()` fa avanzare la linea dell'ora |
| `js/ui-motivation.js` | Interfaccia della scheda Motivazione: nell'intestazione il livello (distintivo, nome, barra, quanto manca), «La tua settimana» con il cielo in SVG e il pulsante dell'obiettivo, «I tuoi numeri», le stelle che si accendono all'apertura e la costellazione che appare. Avviato da `app.js` con `Aura.motivationUI.init()`, dopo `ui-agenda.js`; `celebrate()` dice ad `app.js` se un completamento ha fatto salire di livello o raggiungere l'obiettivo |
| `js/ui-rewards.js` | Interfaccia di «I tuoi premi» in Motivazione: la pillola del saldo, le righe dei premi con la barra e «Riscatta» (coriandoli e avviso con «Annulla»), «Aggiungi un premio», i riscatti chiusi, e il foglio del premio (nome, emoji da un elenco fisso, prezzo con i prezzi pronti; modificando, «Elimina»). Nella pagina i premi si chiamano `prize` (`#prizes`, `.prize`, `#prize-sheet`): `rewards` è già il riquadro di serie e punti. Avviato da `app.js` con `Aura.rewardsUI.init()`, dopo `ui-motivation.js`; salva con `commitState()`; `celebrate()` dice ad `app.js` quale premio un completamento ha reso riscattabile |
| `js/ui-shop.js` | Interfaccia del «Negozio» in Motivazione: la card (la pillola del saldo, «Ripara la serie» quando si può, «Apri il negozio» con i colori) e il foglio con cinque gruppi, «Ripara la serie», «Colori dell'aurora», «Coriandoli», «Suoni del focus» (con le anteprime a barrette) e «Compra punti» (pacchetti «Presto», che non si comprano). Comprare: coriandoli e avviso con «Annulla»; un oggetto tuo si usa con un tocco. Un tocco su un suono lo fa anche ascoltare, prima di comprarlo (`previewSound`, `stopSound`, da `ui-sound.js`). Con il foglio aperto, avviso e coriandoli vanno dentro il foglio. Avviato da `app.js` con `Aura.shopUI.init()`, dopo `ui-rewards.js`; salva con `commitState()` |
| `js/ui-music.js` | Interfaccia della musica: in Focus, sotto la striscia, l'avviso (tutta la riga apre le Impostazioni sulla riga «Musica», la × il foglio «Quando te lo ricordo?», con «Annulla») oppure il carosello «Musica per concentrarti» con «Nascondi»; nelle Impostazioni il gruppo «Musica»; nel focus a tutto schermo il link «🎧». Avviato da `app.js` con `Aura.musicUI.init()`, dopo `ui-settings.js`, che gli dà `open({ part, focus })`; `app.js` chiama il suo `render(striscia)` a ogni `render()`. Salva in `prefs.music` con `setPrefs()` |
| `js/ui-sound.js` | Interfaccia e audio dei suoni del focus: i pezzi (calcolati nel lavoratore; se non parte, nella pagina dopo il disegno) e tenuti in memoria, al massimo due; la «voce» che suona, con le dissolvenze; il programma delle onde sull'orologio dell'audio; la sessione audio dell'iPhone (`navigator.audioSession`); il pulsante «Suono» e il suo menu nel focus a tutto schermo; l'ascolto di prova del negozio. Usa l'`AudioContext` di `ui-focus.js`. Avviato da `app.js` con `Aura.soundUI.init()`, dopo `ui-shop.js`; `app.js` chiama `render()` a ogni `render()`, e gli passa da `ui-focus.js` `sync(running)`, `beforeAudio()` e `refresh()`. Salva `look.sound` con `commitState()` |
| `js/ui-swipe.js` | Interfaccia dello scorrimento sulle card: un ascoltatore per tipo di evento su `#main` per tutte le liste, la card che segue il dito con `transform` (una scrittura per fotogramma), lo sfondo «Fatto» o «Elimina» dal `<template id="swipe-template">`, il clic subito dopo che non fa niente. Avviato da `app.js` con `Aura.swipeUI.init()`, che gli dà `canSwipe(id)`, `onDone(id, card)` (come la spunta) e `onDelete(id, slideX)` (come il cestino) |
| `js/app.js` | Interfaccia: schede e barra, disegno, eventi, fogli (anche la modifica delle attività), avvisi con "Annulla", serie e punti con i loro effetti, foglio "Backup dei dati", foglio "Promemoria e Siri", casella di Siri, registrazione del service worker. Tocca la pagina insieme a `ui-focus.js`, a `ui-assistant.js`, a `ui-settings.js`, a `ui-claude.js`, a `ui-agenda.js`, a `ui-motivation.js`, a `ui-rewards.js`, a `ui-shop.js`, a `ui-music.js`, a `ui-sound.js`, a `ui-swipe.js` e, per le animazioni, a `motion.js`. Mette il colore dell'aurora in uso (`data-aurora`) sull'aurora del focus a tutto schermo e sul bagliore di Focus, e la forma in uso sui coriandoli (`data-shape`) |
| `sw.js` | Service worker: uso offline, notifiche dei promemoria (`push`) e tocco sulla notifica (`notificationclick`) |
| `manifest.webmanifest` | Nome, icone e colori per l'installazione |
| `icons/` | `icon.svg` (favicon e sorgente), PNG 192 e 512 "any", 512 "maskable", `apple-touch-icon` 180 |
| `images/` | Illustrazioni in WebP, ottimizzate dagli originali che restano fuori dal repository (vedi [docs/illustrazioni.md](illustrazioni.md)). Per ora `suggest-none.webp`, `empty-focus.webp` e i distintivi dei livelli 1, 2, 3, 5, 6 e 7 (`level-N-<nome>.webp`); Stella è disegnata in `index.html` finché `level-4-star` non è rifatta |
| `prove/` | Pagine **provvisorie** di prova, fuori da `APP_FILES`. Per ora `voce.html` (con `voce.css` e `voce.js`): prova tecnica di microfono, trascrizione e voce del telefono per l'assistente. Si apre dal link in fondo a Motivazione e sparisce con il passo 2 di [docs/assistente.md](assistente.md) |
| `tests/` | Test della logica pura (`core.test.js`, `points.test.js`, `nlp.test.js`, `reminders.test.js`, `backup.test.js`, `motion.test.js`, `focus.test.js`, `suggest.test.js`, `assistant.test.js`, `settings.test.js`, `agenda.test.js`, `motivation.test.js`, `rewards.test.js`, `shop.test.js`, `music.test.js`, `sound.test.js`, `repeat.test.js`, `swipe.test.js`): si aprono con `tests/index.html` |
| `docs/` | Le specifiche delle funzioni, una per file (vedi "Indice delle specifiche"), e questa guida (`docs/CLAUDE-GUIDE.md`) |
| `../server/` | Il server di Aura (Cloudflare Workers): vedi [docs/promemoria-e-siri.md](promemoria-e-siri.md), [docs/connettore-claude.md](connettore-claude.md) e `server/README.md` |
| `../AGENTS.md`, `../docs/`, `../.github/` | Per tutti gli agenti: regole condivise (`AGENTS.md`), stato del lavoro, decisioni e proposte (`docs/` alla radice), modello delle Pull Request (`.github/`) |
| `CLAUDE.md`, `../CLAUDE.md`, `../server/CLAUDE.md`, `../.claude/`, `../CLAUDE-WORKFLOW.md` | Istruzioni per Claude Code: istruzioni di lavoro e vincoli sempre attivi (`CLAUDE.md`), richiami per area (`.claude/rules/`), procedure a richiesta (`.claude/skills/`), permessi (`.claude/settings.json`) e flusso di lavoro con Claude Project |

**Ordine di caricamento**: `theme.js` → `utils.js` → `repeat.js` → `tasks.js` → `nlp.js` → `points.js` → `focus.js` → `suggest.js` → `assistant.js` → `agenda.js` → `motivation.js` → `rewards.js` → `shop.js` → `music.js` → `sound.js` → `swipe.js` → `storage.js` → `reminders.js` → `remote.js` → `motion.js` → `settings.js` → `claude.js` → `ui-focus.js` → `ui-assistant.js` → `ui-settings.js` → `ui-claude.js` → `ui-agenda.js` → `ui-motivation.js` → `ui-rewards.js` → `ui-shop.js` → `ui-music.js` → `ui-sound.js` → `ui-swipe.js` → `app.js`.
- Ogni file aggiunge il suo modulo a `window.Aura` (`Aura.theme`, `Aura.utils`, `Aura.repeat`, `Aura.tasks`, `Aura.nlp`, `Aura.points`, `Aura.focus`, `Aura.suggest`, `Aura.assistant`, `Aura.agenda`, `Aura.motivation`, `Aura.rewards`, `Aura.shop`, `Aura.music`, `Aura.sound`, `Aura.swipe`, `Aura.storage`, `Aura.reminders`, `Aura.remote`, `Aura.motion`, `Aura.settings`, `Aura.claude`, `Aura.focusUI`, `Aura.assistantUI`, `Aura.settingsUI`, `Aura.claudeUI`, `Aura.agendaUI`, `Aura.motivationUI`, `Aura.rewardsUI`, `Aura.shopUI`, `Aura.musicUI`, `Aura.soundUI`, `Aura.swipeUI`).
- `repeat.js` va dopo `utils.js` e prima di `tasks.js`, `nlp.js` e `storage.js`, che la usano (le regole, la frase con «ogni …», la pulizia di `repeat` e `seriesId`).
- `swipe.js` non usa altri moduli. `ui-swipe.js` va dopo `swipe.js` e `motion.js`, che usa, e prima di `app.js`, che lo avvia.
- `claude.js` va dopo `utils.js`, di cui usa le date. `ui-claude.js` va dopo `claude.js` e `remote.js`, che usa, e prima di `app.js`, che lo avvia prima di `ui-settings.js`: la riga «Claude» delle Impostazioni apre il suo foglio e gli chiede lo stato.
- `sound.js` non usa altri moduli; `sound-worker.js` non sta nella pagina: lo crea `ui-sound.js` (`new Worker`) e carica `sound.js` con `importScripts`. `ui-sound.js` va dopo `sound.js`, che usa, e prima di `app.js`, che lo avvia dopo `ui-shop.js`.
- `points.js`, `focus.js`, `suggest.js`, `assistant.js`, `agenda.js`, `motivation.js`, `rewards.js`, `shop.js` e `music.js` vanno prima di `storage.js`, che li usa per la migrazione e per pulire registro, premi e riscatti, acquisti del negozio e `look`, sessione, preferenze (anche la vista dell'Agenda, l'obiettivo della settimana e la musica) e dati dell'assistente. `agenda.js` va dopo `tasks.js`, di cui usa gli ordini delle liste. `motivation.js` va dopo `points.js`, `focus.js` e `agenda.js`, che usa (totali dei giorni, minuti di focus, settimana da lunedì). `rewards.js` va dopo `points.js`, di cui usa i punti di un'attività tipica. `shop.js` va dopo `points.js` e `rewards.js`, di cui usa la serie e il saldo. `assistant.js` va dopo `nlp.js` e `suggest.js`, che usa. `reminders.js` va prima di `remote.js` e di `settings.js`, che ne usano gli anticipi. `ui-focus.js`, `ui-assistant.js`, `ui-settings.js`, `ui-agenda.js`, `ui-motivation.js`, `ui-rewards.js`, `ui-shop.js`, `ui-music.js` e `ui-sound.js` vanno prima di `app.js`, che li avvia in quest'ordine (`ui-music.js` dopo `ui-settings.js`, perché apre le Impostazioni sulla riga «Musica»).

Un nuovo modulo `js/<nome>.js` va aggiunto in tre punti:
1. in `index.html`, con `defer`, prima di `app.js`;
2. in `tests/index.html`, se contiene logica testabile;
3. in `APP_FILES` di `sw.js`.

## Modello dati

La chiave `aura-tasks:data` contiene:
```json
{
  "version": 7,
  "tasks": [
    {
      "id": "3f2c9a…",
      "title": "Fare la spesa",
      "duration": 30,
      "energy": "medium",
      "date": "2026-10-30",
      "time": "10:00",
      "done": true,
      "createdAt": 1793258400000,
      "completedAt": 1793290000000,
      "pointsAwarded": 24,
      "repeat": { "every": "week", "days": [1, 4] },
      "seriesId": "3f2c9a…"
    }
  ],
  "rewards": [
    { "id": "8d1e4b…", "title": "Pizza del venerdì", "emoji": "🍕", "cost": 400, "createdAt": 1793100000000 }
  ],
  "stats": {
    "totalPoints": 24,
    "bestStreak": 1,
    "milestones": [],
    "days": { "2026-10-29": { "done": 1, "points": 24 } },
    "focus": { "2026-10-29": 25 },
    "spent": [
      { "id": "c07a2f…", "rewardId": "8d1e4b…", "title": "Pizza del venerdì", "cost": 400, "at": 1793290500000 }
    ],
    "shop": [
      { "id": "5b9e10…", "item": "aurora:sunset", "cost": 400, "at": 1793291000000 }
    ]
  },
  "look": { "aurora": "sunset", "confetti": "classic", "sound": "brown", "at": 1793291000000 }
}
```
- `duration`: minuti interi tra 1 e 600 (`Aura.tasks.LIMITS`).
- `energy`: `low` | `medium` | `high`. Etichetta, ordine (1/2/3) e frase d'aiuto sono in `Aura.tasks.ENERGY`.
- `date`: `'YYYY-MM-DD'` **locale** oppure `null`.
- `time`: `'HH:MM'` locale oppure `null`. Esiste **solo insieme a `date`**: `sanitizeTask()` lo azzera se manca il giorno, e nel modulo il campo "Ora" è spento finché non c'è una data. Nello stesso giorno le attività vanno in ordine d'ora, prima di quelle senza orario.
- `createdAt` e `completedAt`: millisecondi (`Date.now()`). `completedAt` vale `null` se l'attività non è completata.
- `pointsAwarded`: punti dati al completamento, oppure `null` se l'attività non è completata. "Annulla" toglie esattamente questo valore.
- `repeat`: la regola di un'attività che si ripete (P-005, passo 5.1; vedi [docs/ripetizioni.md](ripetizioni.md)), oppure `null`. `{ "every": "day" }`, `{ "every": "week", "days": [1, 4] }` (1 = lunedì … 7 = domenica, in ordine e senza doppi) o `{ "every": "month", "day": 31 }` (nei mesi più corti vale l'ultimo giorno). Esiste **solo insieme a `date`**, come `time`. Le volte completate tengono la loro regola; ce n'è una sola da fare per serie.
- `seriesId`: lo stesso in tutte le volte di una serie (l'id della prima), oppure `null` per un'attività che non si è mai ripetuta. Stringa fino a 100 caratteri; un valore non valido diventa l'id dell'attività.
- `stats` è il registro di punti e serie. È **separato dalle attività**: eliminarle o usare "Svuota" non cancella la storia.
  - `days`: completamenti e punti per giorno, dove il giorno è quello locale di `completedAt`. Un giorno che torna a 0 completamenti viene tolto.
  - **Non sfoltire mai `days`**: serie e record si calcolano da qui.
  - `totalPoints`: il totale dei punti.
  - `bestStreak`: il record, cioè la serie più lunga in `days`. Si ricalcola a ogni modifica.
  - `milestones`: i traguardi già festeggiati. Restano anche dopo "Annulla", così la festa non si ripete.
  - `focus`: i minuti di focus per giorno (interi tra 1 e 1440). È una mappa separata da `days`: non tocca punti, serie e record. Il giorno è quello locale in cui il focus si è fermato.
  - `spent`: i riscatti dei premi, dal più vecchio, con il nome e il prezzo di quel momento (`rewardId` è il premio, oppure `null`). **Non tolgono niente a `totalPoints`**: il saldo da spendere è `totalPoints` meno la somma dei `cost`, mai sotto zero (`Aura.rewards.balance()`), e livello e riquadro Punti contano tutti i punti guadagnati. Un riscatto resta anche se il premio viene eliminato; «Annulla» lo toglie per `id`.
  - `shop`: gli acquisti del negozio, dal più vecchio (P-004, passo 4.1; regole in [docs/punti-e-serie.md](punti-e-serie.md), «Negozio»). `item` è l'oggetto (`repair`, `aurora:sunset`, `confetti:stars`…), `cost` il prezzo di quel momento, `at` l'istante; «Ripara la serie» ha anche `day`, il giorno riparato. Come i riscatti, **non tolgono niente a `totalPoints`**: il saldo da spendere toglie anche questi. Un giorno riparato conta come un giorno con completamenti per la serie, il record e i traguardi, ma non aggiunge punti né completamenti. Un `item` che questa versione non conosce (comprato con una più nuova) resta: conta nel saldo e non si usa. «Annulla» toglie un acquisto per `id`.
- `rewards`: i premi scelti dall'utente, al massimo 30 (P-003, passo 3.4; regole in [docs/punti-e-serie.md](punti-e-serie.md), «Premi»). `title` fino a 60 caratteri, `emoji` dall'elenco fisso di `Aura.rewards.REWARDS.emoji` (🎁 se è un'altra), `cost` intero tra 10 e 100.000 punti. Nella pagina sono in ordine di prezzo.
- `look`: quello che è in uso (P-004, passi 4.1 e 4.4). `aurora` è il colore dell'aurora (`aurora`, `sunset`, `forest`, `ocean`, `night`), `confetti` la forma dei coriandoli (`classic`, `stars`, `hearts`, `leaves`, `snow`), `sound` il suono del focus (`none`, cioè Silenzio, all'inizio; `brown`, `rain`, `waves`; vedi [docs/suoni.md](suoni.md), «Dati»), `at` quando è cambiato l'ultima volta (0 = mai). Vale un valore gratis o uno comprato, anche con una versione più nuova (qui vale quello di partenza); un altro torna quello di partenza (`Aura.shop.sanitizeLook()`). Le chiavi che questa versione non conosce restano, dopo `at`. Sta nel backup con il resto dei dati.
- Le altre chiavi:
  - `aura-tasks:theme`: `auto` | `light` | `dark`;
  - `aura-tasks:prefs`: preferenze, **senza versione** e fuori dal backup. La scrive e la legge solo `js/storage.js` (`loadPrefs()`, `savePrefs()`), che pulisce i valori e conserva i campi sconosciuti. Contiene:
    - `lastTab` e `lastTabAt`: l'ultima scheda e quando è stata usata. Riaprendo Aura entro 30 minuti si riparte da lì, altrimenti da Focus;
    - `suggest`: `{ minutes, energy }`, l'ultima scelta di «Cosa faccio adesso?» (`minutes: null` vuol dire «120+»);
    - `assistant`: `{ enabled, voice, autoAdd, autoEdit, consentAt }`, interruttori e permessi dell'assistente. All'inizio è spento, con «aggiungere da solo» acceso e «cambiare da solo» spento; `enabled` vale solo con `consentAt`, il momento del consenso;
    - `agendaView`: `'month'` o `'week'`, la vista del calendario dell'Agenda (P-003, passo 3.2);
    - `weeklyGoal`: l'obiettivo della settimana in Motivazione, 5, 10, 15, 20, 30 o 50 attività, oppure `null` (nessun obiettivo, all'inizio). Un valore diverso torna `null` (P-003, passo 3.3);
    - `music`: `{ service, remind, mood, folded }`, la musica nel focus (P-004, passo 4.2; vedi [docs/musica.md](musica.md), «Dati»). `service` è `'spotify'`, `'apple'`, `'amazon'`, `'none'` («Nessuno») o `null` (da scegliere, all'inizio); `remind` il giorno da cui l'avviso torna, `'never'` o `null`; `mood` l'ultimo umore aperto (`'lofi'` all'inizio); `folded` il carosello ridotto. La pulisce `Aura.music.sanitize()`;
  - `aura-tasks:assistant`: i dati dell'assistente, **senza versione** e fuori dal backup. La scrive e la legge solo `js/storage.js` (`loadAssistant()`, `saveAssistant()`), che li pulisce con `Aura.assistant.sanitizeStore()`. Contiene:
    - `log`: l'elenco «Cosa ha fatto l'assistente» (ultime 50 azioni automatiche, per 30 giorni), con i campi di prima e di dopo per «Annulla»;
    - `memory`: la memoria breve (ultimi 3 scambi, per 10 minuti);
    - `open` e `opens`: la copia dell'ultima proposta all'apertura (vale 3 ore) e quante ne sono partite oggi (al massimo 8);
    - `left`: i messaggi rimasti oggi, come li ha detti il server;
  - `aura-tasks:focus`: il focus in corso, `{ taskId, startedAt, durationMs, pausedAt, pausedTotalMs }`. Fuori dal backup. La scrive e la legge solo `js/storage.js` (`loadFocus()`, `saveFocus()`, `clearFocus()`). Ricaricando la pagina il focus riprende da qui;
  - `aura-tasks:backup-<timestamp>`: copia di dati illeggibili trovati all'avvio; l'app la crea e riparte da una lista vuota;
  - `aura-tasks:remote`: collegamento al server, scritto solo da `js/remote.js` e separato dai dati, quindi **senza versione dello schema**. Contiene:
    - `code`: codice segreto del dispositivo, oppure `null` finché l'utente non attiva promemoria o Siri;
    - `reminders`: `{ enabled, lead }`;
    - `vapidKey`: chiave del server usata per la sottoscrizione;
    - `sent`: `{ endpoint, at, key }`, l'ultimo stato confermato dal server;
    - `inbox`: frasi di Siri ritirate e non ancora mostrate;
    - `done`: id delle frasi già mostrate;
  - `aura-tasks:server`: indirizzo di un server di prova. Vale solo su `localhost` o da `file://`. Per via della CSP deve essere sulla stessa origine dell'app (vedi "Prova completa in locale" in [docs/promemoria-e-siri.md](promemoria-e-siri.md));
  - `aura-tasks:before-import`: copia dei dati di prima dell'ultima importazione di un backup, nel formato del file di backup (compatto), con l'ora della copia in `exportedAt`. **Ce n'è una sola**: ogni importazione la sovrascrive, il ripristino la cancella. La scrive e la legge solo `js/storage.js` (vedi [docs/backup.md](backup.md)).

**File di backup** (`aura-tasks-backup-AAAA-MM-GG.json`, giorno locale):
```json
{ "format": "aura-tasks-backup", "exportedAt": 1793…, "data": { "version": 6, "tasks": […], "rewards": […], "stats": {…}, "look": {…} } }
```
- `data` è tutto `aura-tasks:data` così com'è, compresi i campi sconosciuti, i minuti di focus, i premi e i riscatti, gli acquisti del negozio e `look`.
- Non contiene mai `aura-tasks:remote` (codice segreto del dispositivo, promemoria, casella di Siri), il tema, le preferenze, il focus in corso o i dati dell'assistente: il backup legge solo lo stato.
- Leggendo un file si usa solo `data`, che passa da `fromData()`, cioè dagli stessi controlli e dalle stesse migrazioni dei dati salvati.

**Dalla v1 alla v2**:
1. `migrate()` mette `stats = null`.
2. `parse()` ripulisce le attività e `sanitizeTask()` assegna `pointsAwarded` alle completate che non ce l'hanno.
3. `parse()` ricostruisce `stats` con `Aura.points.rebuildStats()`. I traguardi già superati si segnano senza festa.

**Dalla v2 alla v3**: `migrate()` cambia solo il numero di versione, e `sanitizeTask()` aggiunge `time: null` alle attività. Punti, registro e campi sconosciuti restano intatti, come verifica un test.

**Dalla v3 alla v4**: `migrate()` cambia solo il numero di versione, e `sanitizeStats()` aggiunge `focus: {}` al registro. Attività, punti, serie e campi sconosciuti restano intatti, come verifica un test.

**Dalla v4 alla v5**: `migrate()` cambia solo il numero di versione; `fromData()` aggiunge `rewards: []` e `sanitizeStats()` aggiunge `spent: []` al registro (li puliscono `Aura.rewards.sanitizeRewards()` e `sanitizeSpent()`). Attività, punti, serie, minuti di focus e campi sconosciuti restano intatti, come verifica un test. I backup della v1, v2, v3 e v4 si importano ancora.

**Dalla v5 alla v6**: `migrate()` cambia solo il numero di versione; `sanitizeStats()` aggiunge `shop: []` al registro (lo pulisce `Aura.shop.sanitizeShop()`) e `fromData()` aggiunge `look` con i valori di partenza (`Aura.shop.sanitizeLook()`). Attività, premi, punti, serie, minuti di focus e campi sconosciuti restano intatti, come verifica un test. I backup dalla v1 alla v5 si importano ancora.

**Dalla v6 alla v7**: `migrate()` cambia solo il numero di versione; `sanitizeTask()` aggiunge `repeat: null` e `seriesId: null` alle attività (li pulisce `Aura.repeat.sanitize()`). Le attività che c'erano non si ripetono; punti, serie, premi, negozio e campi sconosciuti restano intatti, come verifica un test. I backup dalla v1 alla v6 si importano ancora.

I dati migrati vengono salvati alla prima modifica.

### Cambiare lo schema
1. Aumenta `SCHEMA_VERSION` in `js/storage.js`.
2. In `migrate()` aggiungi un passo `if (state.version === N) { …; state.version = N + 1; }`. I passi si eseguono in ordine: un utente fermo alla v1 deve arrivare all'ultima versione.
3. Se aggiungi campi alle attività, aggiorna `sanitizeTask()`; se cambi il registro, `sanitizeStats()`; un elenco o un oggetto nuovo accanto a `tasks` (come `rewards` o `look`) si pulisce in `fromData()`. Poi scrivi i test della migrazione.
4. **Non cambiare mai il significato di un campo esistente**: aggiungine uno nuovo.

`parse()` conserva i campi che non conosce e non abbassa mai il numero di versione. Così una versione più vecchia dell'app non rovina i dati scritti da una più nuova.

Backup e copia di prima dell'importazione seguono lo schema da soli: `readBackup()` usa `fromData()`, la stessa funzione di `parse()`. Un backup vecchio arriva all'ultima versione con le stesse migrazioni; uno più nuovo resta intatto.

## Convenzioni

- **Logica pura e pagina sono separate.** `utils.js`, `repeat.js`, `tasks.js`, `focus.js`, `suggest.js`, `assistant.js`, `agenda.js`, `motivation.js`, `rewards.js`, `shop.js`, `music.js`, `sound.js`, `swipe.js`, `claude.js` e le parti pure di `storage.js` non toccano né il DOM né il `localStorage`. Restituiscono sempre nuovi oggetti invece di modificare quelli esistenti, quindi sono facili da testare e da annullare. La pagina la toccano solo `app.js`, `ui-focus.js`, `ui-assistant.js`, `ui-settings.js`, `ui-claude.js`, `ui-agenda.js`, `ui-motivation.js`, `ui-rewards.js`, `ui-shop.js`, `ui-music.js`, `ui-sound.js` e `ui-swipe.js`, insieme a `motion.js` per le animazioni.
- **Schede**: sono tre `<section class="tab">` dentro `#main`; quelle non attive hanno `hidden`. Si cambiano solo con `showTab()`.
  - `render()` ridisegna tutte e tre: una stessa attività può avere una card in due schede (completata oggi: «Completate oggi» in Focus e lo storico in Motivazione; senza data: Focus e «Da pianificare» in Agenda; di oggi, con oggi scelto nel calendario: Focus e il giorno scelto in Agenda). Per cercare una card si usa `cardOf(id)`, che guarda solo la scheda attiva.
  - Se un'attività si vede nella scheda aperta lo dice `isVisibleIn(task, tab, today)`: per l'Agenda dipende anche dal giorno scelto (`Aura.agendaUI` → `Aura.agenda.isInAgenda`). Lo usano gli avvisi di aggiunta e modifica e `showTask()`.
  - **Agenda** (P-003, passo 3.2): il giorno scelto vive in `ui-agenda.js` e non si salva; si salva solo la vista, mese o settimana (`prefs.agendaView`). «Nuova attività» aperta dall'Agenda propone il giorno scelto, mai un giorno passato (`addPreset()`).
  - **Motivazione** (P-003, passo 3.3): livello, cielo e numeri vengono dal registro (`stats`), non dalle completate: «Svuota» non spegne le stelle. Si salva solo l'obiettivo (`prefs.weeklyGoal`). L'avviso «🌌 Obiettivo della settimana raggiunto» parte una volta per settimana, quando un completamento porta il conto esattamente all'obiettivo; dopo «Annulla» non si ripete (la memoria è in `ui-motivation.js`, non si salva).
  - **I tuoi premi** (P-003, passo 3.4): premi (`state.rewards`) e riscatti (`stats.spent`) passano da `commitState()`, che salva solo le parti che cambiano. Riscattare non tocca `totalPoints`: cambiano solo il saldo e lo storico, mai il livello o il riquadro Punti. Dopo un completamento l'avviso dice «🍕 Ora puoi riscattare: …» quando il saldo arriva al prezzo di un premio, se non c'è già un traguardo, un livello nuovo o l'obiettivo raggiunto. I pulsanti delle righe si riconoscono da `data-prize`: `data-action` è dei pulsanti delle card delle attività, gestiti da `app.js` su tutto `#main`.
  - **Negozio** (P-004, passo 4.1): acquisti (`stats.shop`) e `look` passano da `commitState()`. Si paga con lo stesso saldo dei premi, e comprare non tocca `totalPoints`. «Ripara la serie» aggiorna serie, record e traguardi, e un traguardo raggiunto riparando si festeggia (`celebrateRepair()`). Il colore in uso va come `data-aurora` sui due elementi che lo usano, `.focus__aura` (i token `--aurora-*`) e `.hero__tint--focus` (il bagliore, `--hero-glow-*`): lo mette `applyLook()` a ogni `render()`. **Non su `<html>`**: lì un cambio ricalcola lo stile di tutta la pagina (circa 17 ms con la CPU 4 volte più lenta, contro meno di 1), proprio mentre partono i coriandoli dell'acquisto; la forma dei coriandoli va su ogni loro livello come `data-shape`. I pulsanti del foglio si riconoscono da `data-item` e `data-pack`. I fogli aperti stanno sopra tutta la pagina e la rendono inerte: appena si apre il foglio del negozio, `hostToast(foglio)` ci porta dentro l'avviso, così la sua regione live (`role="status"`) c'è già prima del primo messaggio e il lettore di schermo lo legge; con il foglio aperto `showToast(testo, { host })` e `burstConfetti(x, y, host)` mettono avviso e coriandoli dentro il foglio. L'avviso torna nel `body` appena il foglio comincia a chiudersi (`closeSheet()`): dentro il foglio scenderebbe con lui e poi ricomparirebbe più in alto.
  - **Musica** (P-004, passo 4.2): avviso e carosello stanno in Focus sotto la striscia, solo quando la striscia si vede (`render(!els.suggestButton.hidden)`): senza attività in Focus non ci sono. Le preferenze passano da `setPrefs({ music })`, mai dal backup. L'avviso che esce e il carosello che si riduce usano FLIP su `#main` (`data-flip` su avviso, carosello e lista). Le card si ridisegnano solo quando cambia il servizio. I link si aprono come link normali (`target="_blank"`, `rel="noopener noreferrer"`): nessuno script dei servizi, CSP invariata.
  - **Suoni del focus** (P-004, passo 4.4): l'`AudioContext` è quello del focus, creato al `pointerdown` e sbloccato nel tocco da `ui-focus.js`. `ui-focus.js` dice a `ui-sound.js` quando il tempo conta (`onRunning`) e, prima di sbloccare l'audio, chiama `beforeAudio()`: la sessione audio dell'iPhone si sceglie prima di suonare. I pezzi si calcolano in `js/sound-worker.js`; se il lavoratore non parte (per esempio aprendo `index.html` come file) si calcolano nella pagina, dopo il disegno. Il suono in uso è `look.sound` e passa da `commitState()` come il resto di `look`. Niente rete: i file sono nella cache del service worker, anche quelli del lavoratore. Nel negozio un suono è sempre un pulsante, anche senza i punti, perché un tocco lo fa ascoltare.
  - Le animazioni FLIP lavorano su `#main` e saltano da sole ciò che sta sotto `[hidden]`.
  - Serie e punti hanno due copie, i chip di Focus e i riquadri grandi di Motivazione: gli effetti vanno su quella che si vede (`rewardTargets()`).
  - **Intestazione di Focus compatta**: su iPhone 13 in Safari (390×664) resta sotto i 220 px e lascia vedere 4 card. Prima di aggiungerle qualcosa, misura.
  - **Striscia della proposta** (in cima a Focus, la scrive `ui-assistant.js`): ha altezza fissa (48 px) e il testo cambia solo con una dissolvenza (`opacity`), così nessuna card si sposta quando arriva la risposta dell'IA. Toccandola, il foglio si apre sulla **stessa attività e lo stesso motivo** scritti nella striscia: il caso torna solo con «Un'altra proposta».
- **Assistente** (vedi [docs/assistente.md](assistente.md)):
  - **l'IA propone, l'app decide**: ogni azione del modello passa da `Aura.assistant.planReply()`, che la ricontrolla con `validateInput`, con i freni e con i permessi. Completare ed eliminare non sono mai automatici, con nessun permesso (lo fissa un test);
  - **le frasi delle azioni le scrive l'app, dai dati veri** («Aggiunta: … · Domani»): il modello può dire di aver fatto una cosa che l'app non ha fatto;
  - **a quale attività va una correzione senza nome** («no, facciamo alle 5», «anzi domani») lo decide l'app (`correctionTarget()`), non il modello, che nelle misure indicava spesso un'altra attività: va a quella dell'ultimo scambio, se era una sola e il messaggio non ne indica un'altra con il titolo, l'ora o il giorno;
  - **se il modello e le regole di `nlp.js` leggono un'ora diversa**, l'app chiede sempre, e nella domanda propone l'ora delle regole («alle 6» sono le 18:00), come nel foglio "Nuova attività" (`agreedTime()`);
  - **nessuna richiesta prima del primo disegno**, né con l'assistente spento, senza consenso o da `file://`: lì vale la proposta delle regole;
  - gli id delle attività non partono mai: al server vanno le sigle `t1`, `t2`… di `buildRequest()`.
- **Ogni modifica passa da `commit()`** in `app.js`, che salva e ridisegna; premi e riscatti passano da `commitState()`, la stessa cosa per le parti di `state` indicate. `render()` ridisegna tutto partendo da `state`: i dati sono pochi, quindi è veloce e non ci sono stati "sfasati". `commit()` fa anche scivolare le card al loro posto (vedi "Movimento").
  - Unica eccezione: importare un backup e ripristinare la copia sostituiscono **tutto** lo stato. Salvano `storage.replaceData()` e `storage.restoreBeforeImport()`, poi `applyState()` ridisegna.
- **Date**: usa sempre `Aura.utils` (`todayISO`, `addDays`, `daysBetween`, `parseISODate`, `isISODate`…).
  - Mai `toISOString()` per la data di oggi: è in UTC, e dopo mezzanotte in Italia darebbe il giorno prima.
  - Mai `new Date('YYYY-MM-DD')`: anche questa legge la data in UTC.
- **Content-Security-Policy** (`<meta>` subito dopo `charset` in `index.html`). Che resti rigida, e che i testi dell'utente passino da `textContent`, lo fissa `../AGENTS.md`; qui c'è com'è fatta:
  - permette solo i file dell'app e, in `connect-src`, il server di Aura;
  - **niente script, `<style>` o attributi `style=` inline**: sarebbero bloccati. Lo stile da JavaScript passa per il CSSOM (`el.style.prop = …`) o per `element.animate()`, che la CSP permette;
  - **niente `<select>`**: con questa CSP, in WebKit ogni `<select>` fa comparire in console un avviso («Refused to apply a stylesheet…»). Visto con Playwright sul PC, in una pagina minima; in Edge no. Per le scelte si usano i chip, come nel resto dell'app;
  - un servizio esterno nuovo va aggiunto a `connect-src`;
  - `file:` nella CSP serve solo per il doppio clic su `index.html` e non ha effetto su https;
  - con la CSP via `<meta>` non si possono usare `frame-ancestors` né i report: GitHub Pages non permette di impostare intestazioni HTTP;
  - dopo una modifica, da `file://` e da `localhost` non deve comparire nessun messaggio "Content Security Policy" in console.
- **"Annulla" invece di chiedere conferma**: le azioni distruttive si eseguono subito e l'avviso offre "Annulla". Niente `confirm()`.
  - Eccezione voluta: importare un backup e ripristinare la copia sostituiscono **tutti** i dati. Prima, dentro il foglio "Backup dei dati", c'è un riepilogo con «Sostituisci» (o «Ripristina») e «Annulla». Mai `confirm()`.
- **File da salvare e da scegliere** (backup):
  - su iPhone e iPad si **condivide** il file (`navigator.share({ files })`: "Salva su File", AirDrop…). Nell'app installata un `<a download>` apre una schermata senza via d'uscita ([WebKit bug 236943](https://bugs.webkit.org/show_bug.cgi?id=236943)). Altrove si scarica con `Blob` + `<a download>`;
  - `share()` va chiamata subito nel tocco, senza attese prima: Safari la permette solo lì;
  - `<input type="file">` **senza `accept`**: su iPhone un filtro per estensione può rendere il file non selezionabile. Il contenuto si controlla dopo;
  - link del download e input del file stanno **dentro** il foglio: fuori da un `<dialog>` modale la pagina è inerte.
- **CSS**:
  - colori, ombre e raggi passano solo dalle variabili in `:root` (tema chiaro) e `:root[data-theme="dark"]` (tema scuro);
  - un colore nuovo va definito **in entrambi i temi** e verificato col contrasto **WCAG AA** (testo ≥ 4,5:1);
  - nel tema scuro le ombre non bastano: servono bordi sottili e superfici più chiare;
  - `--hero-top` deve restare uguale a `BAR_COLORS` in `theme.js`, che dà il colore della barra di stato;
  - la regola su `flex: 1` nei fogli (iOS) è tra i «Vincoli sempre attivi» di `CLAUDE.md`.
- **Telefono**:
  - testo dei campi ≥ 16 px, altrimenti iOS ingrandisce la pagina;
  - aree di tocco ≥ 44 px;
  - margini con `env(safe-area-inset-*)`;
  - animazioni brevi, disattivate con `prefers-reduced-motion`, e **mai infinite** perché consumano batteria (vedi "Movimento"). Unica eccezione: lo sfondo del focus a tutto schermo.
- **Movimento** (`js/motion.js`, token in `:root`):
  - durate e curve solo dai token `--dur-*` e `--ease-*`, anche come multipli con `calc()`. Il JavaScript li legge con `Aura.motion.ms('move')` e `Aura.motion.ease('out')`, timer di riserva compresi: nessuna durata scritta a mano;
  - movimenti, keyframes ed elementi grandi (card, fogli, intestazione, pagina) si animano **solo con `transform` e `opacity`**. I piccoli controlli (pulsanti, chip, campi, spunta, interruttori, titolo barrato, opzioni del tema, righe delle Impostazioni, fiamma) possono sfumare i colori, con `--dur-color` (al massimo 200 ms);
  - un'ombra o un bagliore che cambia è un livello (`::before`/`::after`) con l'ombra già disegnata, che sfuma con `opacity`. Su un contenitore flex o griglia il livello è `position: absolute` (con il genitore `relative`) e `pointer-events: none`, altrimenti diventa un elemento della riga o della griglia e ruba i tocchi;
  - niente `backdrop-filter`: su iPhone pesa;
  - **FLIP**: gli elementi con `data-flip` (sezioni `section:<chiave>`, card `task:<id>`, blocco `completed-body` e gli altri elementi fissi della lista; in Agenda calendario, giorno scelto e liste `agenda-*`, gruppi `day:*` e righe di «Con orario» `task:<id>`, `free:<fine>`, `now`) scivolano al loro posto. `commit()` chiama `Aura.motion.snapshot()` prima di `render()` e `play()` dopo; i disegni che non nascono da un gesto (avvio, ritorno nell'app, mezzanotte, importazione) non si animano;
  - **si anima il blocco più grande che si muove insieme**: le chiavi si annidano (le card dentro le sezioni). Una sezione scivola intera, e una sua card si sposta solo per la parte che la sezione non fa già; il contenuto di «Completate» entra ed esce come un blocco unico. Ogni elemento animato costa lavoro a ogni fotogramma: con una card per volta, «Completate» perdeva 15 fotogrammi invece di 2 (Edge con la CPU rallentata);
  - gli elementi tolti escono come **fantasmi** nel livello `.motion-ghosts`: senza `id`, `data-id` e `data-flip`, `inert`, tolti a fine animazione. Il loro aspetto non deve dipendere dal contenitore (per esempio il rosso di «In ritardo» sta sul titolo);
  - il cambio tema è istantaneo (`.theme-instant` spegne per un attimo le transizioni): far sfumare tutta la pagina pesava troppo, e le View Transitions facevano cadere WebKit nelle prove;
  - **cambio di scheda** (P-003, passo 3.1): lo sfondo dell'intestazione (`.hero__bg`, un livello che sale 640 px sopra l'intestazione e ne segue il fondo) scivola dalla vecchia altezza alla nuova con `Aura.motion.shiftIn()`, e il bagliore della scheda sfuma (`.hero[data-tab]`). La scheda nuova entra a blocchi con `Aura.motion.staggerIn()`: i suoi figli visibili, al massimo 5 gradini a 55 ms, mai le singole card. La pillola (`.tabbar__pill`, un elemento e non `::before`, così `flash()` ne vede la fine) si allunga e si ferma con `--ease-bounce`; l'icona fa il suo gesto (`.is-popping`). La vecchia scheda sparisce subito;
  - **Agenda** (P-003, passo 3.2): cambiando mese o settimana il calendario nuovo entra di lato con `slideIn()` (40 px) e il giorno scelto sfuma; «Prossimi giorni» e «Da pianificare» scivolano al posto nuovo con `shiftIn()`. La maniglia usa FLIP su `#main`. Ogni minuto, se si guarda oggi, cambia solo l'ora della linea; le righe di «Con orario» si ridisegnano solo quando cambiano, e il fuoco torna sullo stesso pulsante;
  - **aurora del focus a tutto schermo** (P-003, passo 3.1): è l'unica animazione continua. Fasce e stelline girano solo con la classe `.is-breathing` (il nome è rimasto), cioè a foglio aperto, pagina visibile e tempo che scorre.
    - Le fasce sono disegnate piccole (30vmax) e ingrandite con `scale`, con `will-change`: così occupano poca memoria. Lo stato di riposo di ogni livello è il primo fotogramma della sua animazione: con «Riduci movimento» l'aurora c'è, ferma.
    - Sale con il tempo (`Aura.focus.auroraRise()`, una volta al secondo); allo scadere un bagliore, una volta sola.
    - `ui-focus.js` misura una volta i fotogrammi a regime (`watchBreath()`): se il dispositivo non regge, l'aurora resta ferma;
  - **lavoro pesante nel tocco**: ciò che blocca il thread principale all'inizio di un'animazione le fa perdere fotogrammi. L'`AudioContext` del focus si crea al `pointerdown`, mentre il dito è ancora giù, e si sblocca nel `click`. I pezzi dei suoni del focus si calcolano nel lavoratore `js/sound-worker.js`: la pioggia, calcolata nel tocco, costava 60–90 ms (il triplo con la CPU 4 volte più lenta);
  - con `prefers-reduced-motion` il CSS azzera le durate e `Aura.motion` non anima nulla.
- **Fogli `<dialog>`**: aprili e chiudili con `openSheet()` e `closeSheet()` di `app.js`, che gestiscono animazione, blocco dello scorrimento e chiusura con Esc, "indietro" o tocco sullo sfondo. Non contare sull'evento `close` per pulizie indispensabili.
  - `setupSheet(dialog, { onCancel, backdropClose })`: il focus a tutto schermo non si chiude toccando fuori, e per lui Esc e "indietro" valgono «Esci».
  - **Il blocco dello scorrimento (`html.is-locked`) su iPhone può non bastare**: nella prova del 16 novembre 2026, con il focus aperto, sul bordo si vedeva muoversi la barra di scorrimento. Il foglio non aveva niente da scorrere, quindi scorreva la pagina dietro: è una deduzione, sull'iPhone non si è potuto misurare. Il focus a tutto schermo si difende da solo: quando il contenuto ci sta, `.is-static` toglie lo scorrimento con il dito (`touch-action`, vedi [docs/tre-modalita.md](tre-modalita.md), «Schermata ferma»). Gli altri fogli non sono stati controllati.
  - Un foglio si può aprire sopra a un altro: le righe di «Impostazioni» aprono così i fogli che ci sono già. Chiudendolo si torna a quello sotto, con il fuoco sulla riga toccata. `showPart(dialog, titolo)` fa partire un foglio appena aperto da un suo riquadro («Comando Rapido di Siri», «Cosa ha fatto l'assistente»).
  - Dentro un foglio aperto gli avvisi in basso non si vedono, e il loro «Annulla» non si può toccare: un `<dialog>` modale sta sopra tutta la pagina. Un'azione che ne ha bisogno, come «Fatto» o «Completa», prima chiude il foglio; se i fogli aperti possono essere più di uno, li chiude tutti con `closeAllSheets()` (non il focus a tutto schermo), come «Scollega questo dispositivo» e «Mostra» dell'elenco dell'assistente. Un'azione che lascia il foglio aperto mostra l'esito **dentro** il foglio: le azioni automatiche dell'assistente sono righe con il loro «Annulla».
- **Service worker**: quando aggiungi, rinomini o togli un file dell'app, aggiorna `APP_FILES` in `sw.js` e aumenta `CACHE_VERSION`.
  - Con la rete lenta o assente `index.html` fa da riserva **solo per la pagina dell'app** (`isAppPage()` in `sw.js`). Le altre pagine, come `prove/voce.html`, stanno fuori da `APP_FILES`: si salvano in cache alla prima apertura, e prima di allora senza rete il browser mostra il suo errore.
- **Premium**: vedi "Regola fondamentale" nella sezione "Funzioni premium".

## Test

Apri `tests/index.html` nel browser: in alto compare il riepilogo, e tutti verdi significa che va tutto bene.

Per eseguirli da terminale su Windows, dalla cartella `app-attivita`:
```powershell
$page = 'file:///' + ((Resolve-Path tests\index.html).Path -replace '\\', '/')
& "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu `
  --user-data-dir="$env:TEMP\aura-test" --virtual-time-budget=3000 --dump-dom $page | Out-String
```
Nel `<title>` dell'output compare `PASS` oppure `FAIL`. Il `| Out-String` serve: `msedge.exe` è un programma grafico e senza una pipe PowerShell non aspetta che finisca, quindi l'output si perde. I nuovi file di test si chiamano `tests/<nome>.test.js` e vanno aggiunti in `tests/index.html`.

Note per i controlli automatici con Edge headless:
- Con `--virtual-time-budget` gli eventi `close` dei `<dialog>` e `animationend` non arrivano, e le animazioni infinite bloccano la pagina.
- Con il tempo virtuale anche le Web Animations (`element.animate`) restano ferme e `requestAnimationFrame` è inaffidabile. Per questo ogni effetto ha un timer di riserva che porta allo stato finale, anche `Aura.motion.play()`.
- Per fotografare un'animazione a metà: `document.getAnimations()`, poi `pause()` e `currentTime = …` su ciascuna.
- I service worker vanno provati in tempo reale, su `http://localhost`.
- La finestra headless è larga almeno 500 px: per simulare un telefono, carica l'app in un `<iframe>` largo 390 px.

**Server** (`server/`): `npm test` esegue i test con Node, senza installare altro. Coprono:
- la cifratura Web Push, confrontata byte per byte con l'esempio della RFC 8291;
- la firma VAPID;
- tutte le API, sull'SQL vero (D1 simulato con `node:sqlite`);
- il Cron, con un servizio push finto e i messaggi decifrati;
- l'assistente, con un'IA finta al posto di Workers AI: limiti, conteggi, ciò che va al modello e ciò che ne torna. Non consuma quota;
- il connettore per Claude (`test/claude.test.mjs`): accesso OAuth con il codice di Aura, le due epoche del protocollo MCP, lo strumento e i suoi limiti.

**I client MCP ufficiali** si provano con `server/scripts/prova-connettore.mjs`, fuori da `npm test`: vedi `server/README.md`.

**Workers AI vero** si prova solo con `wrangler dev` (anche in locale consuma la quota gratuita) e con `server/scripts/eval-assistant.mjs`, la prova dei modelli sulle frasi italiane: vedi `server/README.md`.

**Prova completa in locale** (app + server vero): vedi [docs/promemoria-e-siri.md](promemoria-e-siri.md). Va rifatta quando cambiano server, `remote.js`, la casella o la CSP.

**Screenshot**: la CSP blocca gli `<style>` aggiunti dall'esterno. Per fermare le animazioni si avvia Edge con `--force-prefers-reduced-motion`.

**Pagine di prova da `file://`** che leggono l'app in un `<iframe>`: Edge va avviato con `--allow-file-access-from-files`, altrimenti l'iframe risulta di un'altra origine.

**Motore di Safari (WebKit) sul PC, con Playwright**
- Si installa **fuori dal repository**, nella cartella temporanea: `npm i playwright@<versione di almeno due settimane>`, poi `npx playwright install webkit`, con `PLAYWRIGHT_BROWSERS_PATH` nella stessa cartella (circa 170 MB). Edge si usa con `channel: 'msedge'`, senza scaricare altro.
- Serve per JavaScript e CSS di WebKit:
  - test della logica;
  - prove con tocchi veri in un contesto "iPhone 13" (user agent e touch);
  - le prove di prima, confrontate con la versione pubblicata (copia di `HEAD` con `git archive`);
  - screenshot.
- **Non è iOS**: niente foglio di condivisione, app File o app installata. E non riproduce tutti i difetti di layout dell'iPhone: con il vecchio `flex: 1` nei fogli, WebKit 27.2 su Windows mostrava i fogli interi (verificato a novembre 2026). Il layout va provato anche sull'iPhone.
- La condivisione di iOS si simula sostituendo `navigator.share` e `navigator.canShare` prima degli script dell'app (`addInitScript`).
- Con un codice del dispositivo finto: `aura-tasks:server` sulla stessa origine e richieste a workers.dev bloccate, così non si registra nulla sul server vero.
- Per toccare la card in un punto preciso (per esempio la riga della durata) si usano le coordinate (`page.touchscreen.tap(x, y)`): lì il tocco arriva al `::after` del pulsante, e Playwright altrimenti si rifiuta di toccare.
- La spunta si tocca su `.check` (l'etichetta), non sull'input invisibile che le sta sotto.
- WebKit su Windows è caduto (crash della pagina) con le View Transitions, dopo una lunga sequenza di prove in un `<iframe>`: per questo l'app non le usa.
- **Tempo finto** (`page.clock`, da installare prima di aprire la pagina): serve per il timer del focus e per l'ora che passa. `fastForward()` salta in avanti, ma tra un passo e l'altro l'orologio continua a scorrere: i controlli sul tempo mostrato tollerano qualche secondo.
- WebKit su Windows **non ha `AudioContext`**: il suono di fine focus e i suoni del focus si possono provare solo sull'iPhone (in Chromium, con Playwright, si misura l'uscita con un `AnalyserNode`). L'app continua senza errori.
- Una scheda nascosta non è "visibile" per Playwright: dopo un ricaricamento si aspetta `#hero`, non un elemento della lista.
- **Intestazione e card visibili**: si misurano a 390×664, cioè iPhone 13 in Safari, contando le card intere sopra la barra delle schede.
- **Pagina che scorre dietro un foglio** (difetto visto solo sull'iPhone): Chromium la ferma in due modi, con `html.is-locked` e con `overscroll-behavior: contain` del foglio. Per riprodurla si tolgono tutti e due dal CSSOM (`classList.remove('is-locked')`, `style.overscrollBehavior = 'auto'` sul foglio e su `.focus`), si porta la pagina a metà con `scrollTo` e si trascina con tocchi veri via CDP (`Input.dispatchTouchEvent`: `touchStart`, una decina di `touchMove`, `touchEnd`). Poi si confronta `window.scrollY`. Lo zoom con due dita si prova allo stesso modo, con due punti di tocco, e si legge `visualViewport.scale`.
- **Margini dell'iPhone** (`env(safe-area-inset-*)`): in Chromium si simulano via CDP con `Emulation.setSafeAreaInsetsOverride` (iPhone 13 installato: 47 px sopra e 34 sotto, a 390×844).

**Animazioni** (con Playwright, script nella cartella temporanea):
- **regola**: a ogni fotogramma si legge `document.getAnimations()`. Keyframes, `element.animate` e transizioni degli elementi grandi devono toccare solo `transform` e `opacity`; le transizioni di colore solo i piccoli controlli, per al massimo 200 ms. In più un controllo statico di `style.css`: `@keyframes` e `transition` con le stesse regole, tempi solo dai token, niente `backdrop-filter`;
- **FLIP**: dopo ogni gesto, alla fine non restano fantasmi, animazioni o trasformazioni, e le posizioni sono uguali a quelle della stessa sequenza con «Riduci movimento»;
- **fotogrammi persi**: gli stessi scenari su due copie servite su localhost, «prima» (`git archive HEAD`) e «dopo» (copia di lavoro).
  - Si misurano gli intervalli tra i fotogrammi con `requestAnimationFrame`: un intervallo oltre 1,5 × 16,7 ms conta come fotogrammi persi, tanti quanti ne salta.
  - Edge gira con la CPU rallentata 4 volte via CDP (`Emulation.setCPUThrottlingRate`), come un telefono di fascia media; WebKit gira come "iPhone 13".
  - Si fanno 5 ripetizioni e si usa la mediana.
  - WebKit headless su Windows vale solo come confronto, e con due avvertenze misurate a novembre 2026:
    - da fermo serve meno fotogrammi (circa 74 "persi" in 6 secondi), mentre con un puntino di 8 px che sfuma ne perde 0: un gesto che anima poco può sembrare peggiore di uno che anima molto;
    - non ha accelerazione grafica: un'animazione a tutto schermo, anche solo di `opacity`, scende a circa 7 fotogrammi al secondo. Su iPhone quei livelli li muove la scheda grafica.
  - Un tocco di Playwright è istantaneo. Per misurare ciò che succede mentre il dito è giù, in Edge si usano `touchStart` e `touchEnd` separati via CDP (`Input.dispatchTouchEvent`).

## Design

- **Intestazione "aura"**: gradiente viola-indaco con bagliori ciano e rosa e testo bianco, in entrambi i temi. Su iPhone, nell'app installata (`black-translucent`), la barra di stato le sta sopra. Una fascia (`.statusbar-scrim`) la mantiene leggibile quando si scorre.
- **Tema scuro**:
  - blu-notte profondo, non nero puro;
  - superfici a livelli via via più chiari;
  - testo avorio;
  - accento schiarito (`--accent-text`);
  - colori dell'energia ricalibrati su sfondi tenui.
- **Energia**: verde acqua per bassa, ambra per media, rosa per alta. C'è sempre l'icona a barre più il testo, mai solo il colore.
- **Barra delle schede**: in basso, con Focus, Agenda e Motivazione (icona e testo). Una pillola tenue dietro la scheda attiva scivola con `transform`. «+ Nuova attività» e gli avvisi stanno sopra la barra (`--tabbar-h`).
- **Intestazione per scheda**:
  - in Focus è compatta: saluto con i due chip di serie e punti, data, e "Da fare", "Tempo", "Fatte oggi" in una riga, con etichetta e valore affiancati. «Cosa faccio adesso?» sta a cavallo del suo bordo inferiore (`.hero--cta`);
  - in Agenda il nome della scheda e «Pianifica i tuoi giorni». Il calendario (`.cal`) sta a cavallo del bordo inferiore, come «Cosa faccio adesso?» in Focus;
  - in Motivazione il nome della scheda, poi il livello (distintivo di 60 px, nome, «livello N di 7», barra e quanto manca) e sotto i riquadri grandi di serie e punti. Il sottotitolo non c'è.
- **Agenda** (P-003, passo 3.2): nel calendario oggi ha l'anello e il giorno scelto è pieno dell'accento; i puntini hanno i colori dell'energia, rossi (`--danger`) nei giorni passati. In «Con orario» l'ora sta in una colonna di 46 px; gli spazi liberi sono riquadri tratteggiati con il «+»; la linea dell'ora è rossa. «Metti a…» è una pillola tenue dell'accento, con l'area di tocco allargata.
- **Motivazione** (P-003, passo 3.3):
  - il distintivo è l'illustrazione del livello (WebP 336×336, ritagliata sul cerchio); per Stella, e se un'immagine non si carica, c'è il distintivo disegnato in SVG con i token `--level-*`. Da Aurora 2 il numero sta in un bollino d'oro sul distintivo;
  - «La tua settimana» è un riquadro (`.card-block`) con un cielo notturno (`--sky-*`, uguale come forma nei due temi): la colonna di oggi più chiara, una stella con l'alone per ogni attività (al massimo 30 per giorno), i cerchi tratteggiati delle stelle che mancano nei giorni che restano, le linee della costellazione (albero minimo) solo a obiettivo raggiunto. «N di M» in alto a sinistra: le stelle restano sotto `MOTIVATION.sky.top`, anche a 320 px;
  - all'apertura della scheda le stelle si accendono una dopo l'altra (al massimo 24, entro `--dur-tab`); la costellazione appena formata appare con una dissolvenza. Solo `opacity` e `transform`; con «Riduci movimento» niente;
  - «I tuoi numeri» sono sei riquadri in tre colonne (due sotto i 360 px), con i valori allineati in basso; senza minuti di focus una riga dice da dove arrivano;
  - «Completate» è chiusa, con il numero, come «Completate oggi» in Focus; «Svuota» sta dentro.
- **I tuoi premi** (P-003, passo 3.4), tra «La tua settimana» e «I tuoi numeri»:
  - un riquadro (`.card-block`) con il titolo e la pillola d'oro del saldo («1360 da spendere», `--points-chip-*`), che sugli schermi stretti va sotto il titolo;
  - ogni premio è una riga: l'emoji in un riquadro di 48 px (40 sotto i 360 px), il nome, una barra d'oro (`--star`) e lo stato («Pronto» in verde, `--low`; «Ancora 240 · 800 punti»); a destra «Riscatta», pieno dell'accento, oppure grigio ma toccabile (`aria-disabled`): un tocco dice quanto manca;
  - senza premi, una frase e «Aggiungi un premio» in evidenza; «Riscattati» è chiusa, con il numero, come «Completate»;
  - riscattando, coriandoli dal pulsante e la pillola che salta; con «Riduci movimento» niente;
  - nel foglio del premio le 15 emoji stanno in cinque colonne (pulsanti di opzione di almeno 48 px) e i sei prezzi pronti in due righe da tre.
- **Focus a tutto schermo**: i colori dell'intestazione "aura" in entrambi i temi, con testo chiaro, un grande anello del tempo che manca e un'aurora che scorre piano e sale con il tempo (P-003, passo 3.1).
- **Serie e punti**: due chip nell'intestazione di Focus e due riquadri grandi in quella di Motivazione, con gli stessi effetti.
  - Serie "accesa" quando oggi c'è già un completamento: gradiente caldo arancio-rosa e fiamma colorata.
  - Serie "da accendere" negli altri casi: fiamma grigia.
  - Per il testo sul riquadro acceso: `--streak-tile-a/b` sono scelti per il contrasto ≥ 4,5:1 col bianco.
  - Fiamma e stella sono SVG scritti direttamente in `index.html`, non nello sprite, perché il CSS ne cambia i colori in base allo stato.
  - Gli effetti (anello sulla spunta, "+N" che vola nel riquadro dei punti, conteggio, fiamma che si accende, coriandoli ai traguardi):
    - sono brevi e finiti;
    - si spengono con "Riduci movimento";
    - animano il **contenuto** dei riquadri. Il bagliore dei traguardi è un livello della griglia (`.stats--rewards::before`), perché il riquadro ha `overflow: hidden` e lo taglierebbe. Nel chip della serie il bagliore e lo sfondo caldo sono due livelli del chip (`.mini--streak::before` e `::after`).
- **Promemoria e Siri**:
  - la campanella nell'intestazione ha un puntino dorato quando i promemoria sono attivi;
  - il foglio ha due riquadri (`.panel`);
  - lo stato (`.status`) è sempre un puntino più il testo, con i colori già verificati dell'energia: verde acqua = attivi, ambra = attenzione;
  - dentro un foglio aperto i messaggi vanno nelle righe di stato, non negli avvisi in basso, che resterebbero sotto lo sfondo scuro del foglio.
- **Impostazioni**:
  - la rotella sta nella riga dei pulsanti dell'intestazione, accanto alla campanella, quindi l'intestazione non cresce (188 px in Focus a 390×664, prima e dopo);
  - il foglio è un indice a gruppi (`.settings`): ogni riga (`.setting`) ha icona, nome, stato di adesso e freccia, ed è alta almeno 60 px. Lo stato è verde (`--low`) quando la funzione è in uso;
  - il tema si sceglie nella sua riga, con tre anteprime affiancate (`.theme-option`); la scelta di adesso ha un bollino con la spunta;
  - senza il server (file aperto dal computer) le righe dell'assistente sono spente ma leggibili, e lo stato dice perché.
- Font di sistema. Le icone SVG stanno nello sprite di `index.html` (`<use href="#i-…">`) e il tratto usa `currentColor`.
- **Icone dell'app**:
  - le PNG derivano da `icons/icon.svg`;
  - per "maskable" e `apple-touch-icon` si usa lo stesso disegno con `rx="0"`, cioè senza angoli arrotondati e senza trasparenza;
  - le versioni da 512 si ottengono con uno screenshot di Edge headless (`--window-size=512,512 --default-background-color=00000000`);
  - quelle da 192 e 180 si ottengono rimpicciolendo le 512.
- **Rifiniture per tutta l'app** (20 novembre 2026, con le liste delle skill browser-qa, accessibility e make-interfaces-feel-better):
  - titoli (`h1`–`h3`, i titoli delle attività e le righe di stato) con `text-wrap: balance`, paragrafi e stato dei premi con `text-wrap: pretty`: niente parola sola sull'ultima riga. I testi che devono stare su una riga hanno `white-space: nowrap` in una regola con una classe, che vince;
  - le righe di chip sono colonne uguali (`.chips--grid`, con `--chip-cols`), così nessun chip resta da solo su una riga: le durate 6 (3 sotto i 360 px), i minuti di «Cosa faccio adesso?» 4 + 3 (7 dai 480 px), gli anticipi dei promemoria 3 + 3 (6 dai 560 px). Ogni chip è alto almeno `--tap` (44 px);
  - il contrasto del testo sugli sfondi sfumati o a livelli (intestazione, focus a tutto schermo, pulsanti con il gradiente) si misura sui pixel, perché axe non vede lo sfondo: almeno 4,5:1 nel punto più chiaro dietro il testo. Per questo `--hero-text-2` è al 92% nel tema chiaro e «Esci» del focus sta sul vetro (`--glass`), come gli altri comandi;
  - dentro un riquadro (`.panel`) il pulsante principale ha l'ombra corta: quella piena arrivava sulla nota sotto e la rendeva meno leggibile;
  - un foglio di solo testo che scorre (Privacy) ha `tabindex="0"` e `role="region"` sul corpo, così scorre anche con la tastiera; il contorno del focus sta dentro il riquadro.
- **Etichette mai accorciate** (20 novembre 2026, rifiniture per gli schermi piccoli): un'etichetta che diventa «T…» non dice più niente. Dove una riga non basta, il riquadro va su due righe. Nell'intestazione di Focus lo fa `fitStats()` in `app.js` per «Da fare», «Tempo» e «Fatte oggi» (`.stats--inline.is-stacked`), misurando con un `ResizeObserver`: vedi [tre-modalita.md](tre-modalita.md), «Intestazione di Focus compatta».

---

## Indice delle specifiche (`docs/`)
Ogni funzione ha la sua specifica in un file di `docs/`: comportamento, dati, casi limite e test.

| File | Funzione | Stato |
|---|---|---|
| [docs/punti-e-serie.md](punti-e-serie.md) | Punti, serie di giorni, record e traguardi; premi da riscattare con i punti; negozio | realizzata; i premi (P-003, passo 3.4) e il negozio (P-004, passi 4.1 e 4.4) da provare sull'iPhone |
| [docs/linguaggio-naturale.md](linguaggio-naturale.md) | Frase che compila il modulo, con l'orario; link `?add=` | realizzata |
| [docs/promemoria-e-siri.md](promemoria-e-siri.md) | Server di Aura: promemoria push, casella di Siri, limiti; prova completa in locale | realizzata |
| [docs/modifica.md](modifica.md) | Modificare un'attività | realizzata |
| [docs/backup.md](backup.md) | Esportare, importare e ripristinare i dati | realizzata |
| [docs/tre-modalita.md](tre-modalita.md) | Schede Focus, Agenda e Motivazione; animazioni più fluide | in corso: fasi 1 e 2a provate sull'iPhone; passi 3.1, 3.2, 3.3 e 3.4 di P-003 e passo 4.1 di P-004 fatti, da provare sull'iPhone |
| [docs/illustrazioni.md](illustrazioni.md) | Illustrazioni: flusso, revisione, elenco e prompt per Nano Banana | in corso: 8 nell'app (`empty-focus` da sostituire), 5 da rifare |
| [docs/assistente.md](assistente.md) | Assistente con l'IA: scrivere o parlare ad Aura, permessi, memoria breve, frasi di Siri, server e limiti | in corso: passi 0 (prova tecnica) e 1 (assistente scritto) pubblicati, da provare sull'iPhone |
| [docs/connettore-claude.md](connettore-claude.md) | Connettore per Claude: «Aggiungi ad Aura», accesso con il codice di Aura, protocollo MCP, limiti, prove | in corso: passo 6.1 (server) scritto, da pubblicare; passo 6.2 (app) da fare |
| [docs/impostazioni.md](impostazioni.md) | Rotella e foglio «Impostazioni»: indice con lo stato di ogni funzione, tema nella riga, foglio «Privacy», «Scollega questo dispositivo» con «Annulla» | realizzata, da provare sull'iPhone |
| [docs/ripetizioni.md](ripetizioni.md) | Attività che si ripetono: regole, foglio, completare, «Salta questa volta», frase e Siri, dati (schema v7) | passo 5.1 di P-005 fatto, da provare sull'iPhone |
| [docs/scorrimento.md](scorrimento.md) | Scorrimento sulle card: dove, il gesto con le sue misure, completare ed eliminare con «Annulla», accessibilità e movimento | passo 5.2 di P-005 fatto, da provare sull'iPhone |
| [docs/musica.md](musica.md) | Musica nel focus: servizio scelto nelle Impostazioni, avviso con «Quando te lo ricordo?», carosello «Musica per concentrarti», «🎧» nel focus a tutto schermo | passo 4.2 di P-004 (senza account) fatto, da provare sull'iPhone; 4.3 (Spotify collegato) da fare |
| [docs/suoni.md](suoni.md) | Suoni del focus: Rumore marrone, Pioggia e Onde fatti da Aura, «Suono» nel focus a tutto schermo, ascolto di prova nel negozio, volume, sessione audio dell'iPhone | passo 4.4 di P-004 fatto, da provare sull'iPhone |
| [docs/funzioni-future.md](funzioni-future.md) | Web Share Target e scorciatoie (Android), altre idee; le idee passate a una proposta o scartate | da fare |
| [docs/premium.md](premium.md) | Licenza premium: verifica offline, interfaccia e dati | da fare |

### Tre modalità, in breve
L'app si divide in tre schede, con una barra in basso:
- **Focus**, per fare: in ritardo, oggi e senza data, con «Cosa faccio adesso?», la musica per concentrarsi (P-004, passo 4.2) e il timer, con i suoni del focus (passo 4.4);
- **Agenda**, per pianificare: il calendario del mese o della settimana, il giorno scelto con gli orari e gli spazi liberi, i prossimi giorni e le attività da pianificare (P-003, passo 3.2);
- **Motivazione**, per i progressi: livello, serie e punti, «La tua settimana» con l'obiettivo, «I tuoi premi», «I tuoi numeri» e le completate (P-003, passi 3.3 e 3.4), con il «Negozio» dopo i premi (P-004, passo 4.1); poi «Sfide di oggi» (passo 3.5).

Per la regola 2 di `../AGENTS.md` ogni funzione di oggi resta: al massimo cambia posto. Le fasi sono quattro; ognuna si pubblica da sola e si prova sull'iPhone prima della successiva:
1. animazioni più fluide (fatta, provata sull'iPhone il 16 novembre 2026);
2. barra delle schede e Focus:
   - 2a, con «Cosa faccio adesso?», il timer e i minuti di focus (fatta e pubblicata con la v9, provata sull'iPhone il 16 novembre 2026);
   - 2b, la notifica push alla fine del focus (approvata: è un passo a parte, da fare dopo la prova della 2a sull'iPhone);
   - due passi a parte dopo la 2a: apertura più leggera di «Nuova attività» e «Dimensione testo» dell'iPhone;
3. Agenda: sostituita da [P-003](../../docs/proposte/P-003.md), passo 3.2, l'Agenda a calendario (fatta con la v16, da provare sull'iPhone);
4. Motivazione, con le illustrazioni: sostituita da P-003, passi 3.3–3.5 (il 3.3 fatto con la v17 e il 3.4 con la v18, da provare sull'iPhone).

Ogni illustrazione entra con la fase che la usa, nella versione che c'è in quel momento (vedi [docs/illustrazioni.md](illustrazioni.md)).

## Funzioni premium (in futuro)

In futuro alcune funzioni saranno **premium**, sbloccate con un **codice di licenza**.

Ogni nuova funzione va aggiunta a questa tabella con la sua categoria:

| Funzione | Categoria |
|---|---|
| Base: attività, lista per giorno, tema, uso offline | gratuita |
| Punti e serie di giorni | gratuita |
| Linguaggio naturale con orario e link ?add= | gratuita |
| Promemoria push e casella del Comando Rapido di Siri (server di Aura) | gratuita |
| Modificare un'attività | gratuita |
| Attività che si ripetono (P-005, passo 5.1) | gratuita |
| Scorrimento sulle card (P-005, passo 5.2) | gratuita |
| Backup dei dati (esporta, importa, ripristina) | gratuita |
| Animazioni più fluide | gratuita |
| Barra delle schede | gratuita |
| Scheda Focus | gratuita |
| Scheda Agenda, con il calendario (P-003, passo 3.2) | gratuita |
| Scheda Motivazione: serie, record, punti, traguardi, storico delle completate, backup | gratuita |
| «Cosa faccio adesso?» | da decidere |
| Focus a tutto schermo con timer, e minuti di focus | da decidere |
| Livelli | da decidere |
| Obiettivo settimanale | da decidere |
| Calendario delle ultime settimane | da decidere |
| «La tua settimana»: il cielo con una stella per attività e la costellazione dell'obiettivo (P-003, passo 3.3) | da decidere |
| «I tuoi numeri» (P-003, passo 3.3) | da decidere |
| «I tuoi premi»: premi con un prezzo in punti, da riscattare con il saldo (P-003, passo 3.4) | da decidere |
| Frase del giorno | da decidere |
| Illustrazioni | da decidere |
| Assistente con l'IA (scrivere e parlare ad Aura) | da decidere |
| Connettore per Claude: «Aggiungi ad Aura» (P-006) | gratuita, come la casella di Siri |
| Impostazioni: indice, tema nella riga, foglio «Privacy», «Scollega questo dispositivo» | gratuita |

Le funzioni di oggi restano gratuite anche dove cambiano posto (vedi [docs/tre-modalita.md](tre-modalita.md)).

### Regola fondamentale
**Tutti i controlli passano da un'unica funzione `isPremium()`.**
- È prevista in `js/license.js` come `Aura.license.isPremium()`.
- Non è permesso:
  - leggere `aura-tasks:license` in altri file;
  - tenere flag "premium" sparsi;
  - duplicare controlli o confronti sul codice di licenza.
- Il resto del codice chiede soltanto `if (Aura.license.isPremium()) …`.

Come funzionerà la licenza (verifica offline, interfaccia e dati): vedi [docs/premium.md](premium.md).

## Ordine consigliato (visione "segretario personale")
Già fatto: punti e serie (schema v2), linguaggio naturale con orario e link `?add=` (schema v3), server di Aura con promemoria push e casella di Siri, modifica delle attività, backup dei dati, animazioni più fluide, barra delle schede e Focus con «Cosa faccio adesso?» e il timer (schema v4), Agenda a calendario, Motivazione con livelli, settimana e premi (schema v5), negozio (schema v6), musica nel focus senza account, attività che si ripetono (schema v7), scorrimento sulle card, suoni del focus.
1. ~~**Linguaggio naturale con orario** e aggiunta con il link `?add=testo`~~: fatto.
2. ~~**Comando Rapido di Siri**~~: fatto, con la casella del server. Restano **Web Share Target** e **shortcuts** nel manifest per Android.
3. ~~**Promemoria con notifiche Web Push**~~: fatto. L'esportazione `.ics` non si fa: il calendario è l'Agenda (decisione del Product Owner del 20 novembre 2026).
4. **«Tre modalità»**: Focus (con «Cosa faccio adesso?» e la modalità focus), Agenda e Motivazione, in quattro fasi (vedi [docs/tre-modalita.md](tre-modalita.md)).
5. **Assistente con l'IA**: scrivere o parlare ad Aura, che propone, aggiunge e sposta secondo i permessi dell'utente. Quattro passi, a partire da una prova tecnica (vedi [docs/assistente.md](assistente.md)). Fatti i passi 0 (prova tecnica) e 1 (assistente scritto); restano la voce (passo 2) e l'organizzazione della giornata (passo 3).

La licenza premium va fatta quando serve.

## Checklist prima di chiudere una modifica
- [ ] `tests/index.html` è tutto verde, con test nuovi per la logica nuova.
- [ ] Provato a 375–390 px di larghezza e su desktop, **in tema chiaro e scuro**.
- [ ] Se sono cambiati layout o animazioni: detto all'utente cosa provare sull'iPhone.
- [ ] Nessun errore in console, sia aprendo da `file://` sia da `http://localhost`.
- [ ] `sw.js` è aggiornato (`APP_FILES`, `CACHE_VERSION`) se sono cambiati file.
- [ ] Se lo schema è cambiato: `SCHEMA_VERSION` aumentato e passo aggiunto in `migrate()`.
- [ ] Se è cambiato `server/`: `npm test` verde, prova completa in locale, nessun segreto nei file; `npm run db:init` (se è cambiato `schema.sql`) e `npm run deploy` con il via del Product Owner (vedi "Pubblicare con Git").
- [ ] Questa guida (`docs/CLAUDE-GUIDE.md`) e la specifica della funzione in `docs/` sono aggiornate, compresa la categoria gratuita/premium delle funzioni nuove; una regola cambiata è aggiornata nel suo unico posto (vedi la nota in cima).
- [ ] `../docs/stato.md` e `../docs/decisioni.md` sono aggiornati.
