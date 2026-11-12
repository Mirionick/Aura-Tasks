# Tre modalità: Focus, Agenda e Motivazione (in corso: fasi 1 e 2a fatte, da provare sull'iPhone)

Nuovo capitolo: animazioni più fluide e l'app divisa in **tre schede**, una per ogni modo di usarla. Assorbe il vecchio punto 4 di "Funzioni future" («Cosa faccio adesso?» e modalità focus): le specifiche sono qui, aggiornate.

**Regola: niente si toglie né peggiora.** Ogni funzione di oggi resta; al massimo cambia posto (vedi "Dove va ogni funzione di oggi").

## Fasi
Ogni fase si pubblica da sola, con i suoi test, la prova WebKit e la prova dell'utente sull'iPhone prima della successiva.

| Fase | Contenuto | Stato |
|---|---|---|
| 1 | Animazioni più fluide in tutta l'app | fatta, da provare sull'iPhone |
| 2a | Barra delle schede e Focus, con «Cosa faccio adesso?», il timer e i minuti di focus | fatta e pubblicata con la v9, da provare sull'iPhone |
| 2b | Notifica push alla fine del focus | approvata: passo a parte, dopo la prova della 2a sull'iPhone (vedi "Notifica push alla fine del focus") |
| — | Passo a parte: apertura più leggera del foglio «Nuova attività» | da fare, dopo la 2a |
| — | Passo a parte: rispettare «Dimensione testo» dell'iPhone | da fare, dopo la 2a |
| 3 | Agenda | da fare |
| 4 | Motivazione, con le illustrazioni | da fare |

### Fase 1: animazioni più fluide
- **Token**: durate (`--dur-*`) e curve (`--ease-*`) stanno solo in `:root`. Il JavaScript le legge con `Aura.motion` (`js/motion.js`): nessuna durata scritta a mano.
- **Movimenti, keyframes ed elementi grandi** (card, fogli, intestazione, pagina) si animano **solo con `transform` e `opacity`**. I piccoli controlli (pulsanti, chip, campi, spunta, titolo barrato) tengono transizioni di colore brevi, al massimo 200 ms (`--dur-color`).
- **Le card scivolano al loro posto** (tecnica FLIP) quando entrano, escono o cambiano sezione. Una card completata con «Completate» chiusa scivola verso il suo titolo.
- **Niente sfocatura** (`backdrop-filter`): né sullo sfondo dei fogli, che su iPhone pesa, né sui riquadri dell'intestazione.
- **Bagliori**: sfuma un livello con l'ombra già disegnata, invece di animare `box-shadow`.
- **Cambio tema**: di colpo e tutto insieme, invece dei colori che sfumano su tutta la pagina. Quella sfumatura costava circa 100 fotogrammi persi su un telefono lento. Una dissolvenza con le View Transitions era il piano, ma faceva cadere WebKit nelle prove sul PC.
- **«Completate»** si apre e si chiude morbida, come un blocco unico. Il piano prevedeva le card una dopo l'altra, ma un'animazione per card costava troppi fotogrammi: si anima sempre il blocco più grande che si muove insieme (anche le sezioni intere).
- **«Riduci movimento»** spegne tutto.
- **Fotogrammi persi** misurati prima e dopo.

#### Risultati della fase 1 (9 novembre 2026)
Fotogrammi persi, mediana delle prove: gli stessi gesti sulla versione pubblicata («prima») e su quella nuova («dopo»), a 390 px, in tema chiaro e scuro.

| Gesto | Edge, CPU 4 volte più lenta | Edge a piena velocità | WebKit "iPhone 13" |
|---|---|---|---|
| cambiare tema e tornare | 100,5 → 20 | 65,5 → 1 | 91 → 32,5 |
| aprire e chiudere un foglio | 78 → 59,5 | 4 → 4,5 | 94 → 82,5 |
| aggiungere | 39 → 24,5 | 0,5 → 1 | 85 → 82,5 |
| spostare a domani | 44,5 → 31 | 0 → 1 | 73 → 75,5 |
| completare | 32 → 28 | 0 → 1 | 50 → 52,5 |
| "Annulla" del completamento | 26,5 → 21 | 0 → 0 | 19,5 → 28 |
| eliminare | 18 → 16 | 0 → 0 | 30,5 → 32,5 |
| "Annulla" dell'eliminazione | 9,5 → 11,5 | 0 → 0,5 | 20,5 → 30,5 |
| aprire e chiudere «Completate» | 10 → 19 | 0 → 0 | 50 → 39,5 |
| scorrere giù e su | 0 → 0 | 0 → 0 | 37 → 30,5 |

- Il guadagno più grande è il cambio tema, che prima faceva sfumare i colori di tutta la pagina.
- Dove prima c'era un salto (i due "Annulla" e «Completate») adesso c'è un'animazione. Con la CPU rallentata costa qualche fotogramma; a piena velocità non costa nulla, o al massimo un fotogramma al momento del tocco, quando si prepara lo scivolamento.
- Le animazioni girano sul compositore (verificato nella traccia di Edge). Con la CPU rallentata pesa il lavoro del thread principale a ogni fotogramma, che dipende da quanti elementi si animano: per questo si anima il blocco più grande che si muove insieme.
- WebKit headless su Windows perde circa 42 fotogrammi al secondo anche da fermo: i suoi numeri valgono solo come confronto.
- La prova vera è quella sull'iPhone.

### Fase 2a: barra delle schede e Focus
Le specifiche stanno nelle sezioni qui sotto ("Navigazione", "Focus: per fare"). Qui ci sono le scelte fatte costruendola.

- **Niente sparisce**: finché le fasi 3 e 4 non ci sono, Agenda e Motivazione mostrano in modo semplice le parti di prima che spettano a loro.
  - **Agenda**: le sezioni «Domani» e «Prossimi giorni» di sempre.
  - **Motivazione**: i riquadri grandi di serie e punti (nell'intestazione), la riga dei minuti di focus, lo storico di tutte le completate con «Svuota», e in fondo «I dati restano…» con «Backup dei dati».
- **Intestazione di Focus compatta** (da una prova in emulazione iPhone 13: era alta 331 px su 664 e si vedevano 2 attività):
  - nella riga del saluto ci sono serie e punti, in due chip, con gli effetti di sempre;
  - «Da fare», «Tempo» e «Fatte oggi» stanno in una riga sola, con etichetta e valore affiancati. «Tempo stimato» è scritto «Tempo» sotto i 430 px di larghezza, perché in una riga non ci sta; il lettore di schermo legge sempre «Tempo stimato»;
  - «Cosa faccio adesso?» è su una riga, a cavallo del bordo dell'intestazione (`.hero--cta`);
  - le card sono 4 px più basse (84 → 80 px).
- **Niente ▶ sulle card**: toglierebbe 48 px al titolo (il corpo della card ha 248 px a 390 di larghezza). «Inizia focus» sta nel foglio «Modifica attività», per le attività da fare, e nella proposta di «Cosa faccio adesso?». Dal foglio di modifica salva prima le modifiche: il timer parte con la durata appena scritta.
- **Ora già passata in rosso** nelle card di oggi, come «Ieri» (`Aura.tasks.isTimePassed`). La lista si ridisegna da sola quando un'ora passa.
- **Attività che finisce in un'altra scheda**: l'avviso lo dice («Attività aggiunta in Agenda · Domani», con «Mostra»; «Modifiche salvate · ora in Agenda», con «Annulla»).
- **Uscita dal focus**: Esc, il gesto «indietro» ed «Esci» chiudono la sessione; l'avviso «Focus terminato · 12 min» ha «Annulla», che la riapre com'era.
- **Suono di fine**: l'`AudioContext` si crea quando il dito tocca «Inizia focus» (`pointerdown`) e si sblocca nel tocco (`click`). Crearlo costa: a freddo, in Edge, circa 200 ms, cioè 9–14 fotogrammi persi all'apertura del focus; così ne perde 0.
- **Illustrazioni**: sono entrate `suggest-none` ed `empty-focus`, al posto del disegno SVG dello stato vuoto.
  - `empty-focus` è entrata **così com'è**, per scelta dell'utente, senza aspettare la versione rifatta: ha un alone attorno al vapore, che l'ottimizzazione fa sfumare invece di tagliare (vedi [illustrazioni.md](illustrazioni.md)). Verrà sostituita.
  - Le altre entrano con la fase che le usa, nella versione che c'è in quel momento.

#### Risultati della fase 2a (10 novembre 2026)
**Intestazione e card visibili all'apertura**, su «iPhone 13» in Safari (390×664), misurate in WebKit e in Edge:

| | Prima (v8) | Dopo |
|---|---|---|
| Altezza dell'intestazione di Focus | 331 px | 188 px |
| Card intere visibili, giornata tipica (6 attività oggi, una riga di dettagli) | 3 | 4 |
| Card intere visibili, dati delle prove (3 in ritardo, una con i dettagli su due righe) | 2 | 3 |

- L'obiettivo era un'intestazione sotto i 220 px e almeno 4 card visibili: raggiunto nella giornata tipica.
- Con una card più alta in cima (dettagli su due righe, o titolo su due righe) e un cambio di sezione, le card intere sono 3.
- «+ Nuova attività» copre il lato destro dell'ultima card visibile, come prima.

**Fotogrammi persi**, con il metodo della fase 1: mediana di 5 ripetizioni nei due temi, a 390 px. «Prima» è la v8 pubblicata, «dopo» la versione con le schede.

| Gesto | Edge, CPU 4 volte più lenta | Edge a piena velocità | WebKit "iPhone 13" |
|---|---|---|---|
| aprire e chiudere un foglio | 28 → 31 | 1 → 2 | 65 → 63 |
| completare | 9 → 8,5 | 0 → 0 | 37,5 → 41 |
| "Annulla" del completamento | 6,5 → 5 | 0 → 0 | 25 → 23 |
| eliminare | 7 → 5 | 0 → 0 | 23 → 22,5 |
| "Annulla" dell'eliminazione | 5 → 3 | 0 → 0 | 21,5 → 22 |
| aggiungere | 10,5 → 7 | 0 → 0 | 65,5 → 65 |
| spostare a domani | 10,5 → 10 | 0 → 0 | 63,5 → 36,5 |
| aprire e chiudere «Completate» (dopo: «Completate oggi») | 4 → 1,5 | 0 → 0 | 28,5 → 69 |
| cambiare tema e tornare | 9 → 6 | 0 → 0 | 17 → 15,5 |
| scorrere giù e su | 0 → 0 | 0 → 0 | 22,5 → 21 |
| fermo, per un secondo | 0 → 0 | 0 → 0 | 33 → 24 |

Gesti nuovi, misurati solo sulla versione con le schede:

| Gesto | Edge, CPU 4 volte più lenta | Edge a piena velocità | WebKit "iPhone 13" |
|---|---|---|---|
| passare ad Agenda | 1 | 0 | 30 |
| passare a Motivazione | 10,5 | 0 | 25 |
| tornare a Focus | 3 | 0 | 23 |
| aprire e chiudere «Cosa faccio adesso?» | 7 | 0 | 53,5 |
| fermo, per 10 secondi | 0 | 0 | 38 |
| aprire il focus a tutto schermo | 5 | 0 | 57 |
| 10 secondi di focus in corso, con lo sfondo che respira | 0 | 0 | 186,5 |
| 10 secondi di focus con «Riduci movimento» (sfondo fermo) | 0 | 0 | 72 |
| mettere in pausa e riprendere | 1 | 0 | 18,5 |
| chiudere il focus con «Esci» | 2,5 | 0 | 21 |

- **In Edge** nessun gesto di prima peggiora: a piena velocità al massimo di un fotogramma (il foglio, da 1 a 2), con la CPU rallentata al massimo di 3 (sempre il foglio, da 28 a 31). Gli altri gesti sono uguali o migliori.
- **Cambio di scheda**: a piena velocità non perde fotogrammi. Con la CPU rallentata costa da 1 a 10,5 fotogrammi, cioè meno di un foglio che si apre (31). La più cara è Motivazione, che ha i riquadri grandi e lo storico.
- **Focus in corso**: in Edge 10 secondi di timer con lo sfondo che respira non perdono fotogrammi, neanche con la CPU rallentata. Il respiro gira sul compositore.
- **Apertura del focus**: creare l'`AudioContext` dentro il tocco costava da 9 a 14 fotogrammi a piena velocità. Creandolo al `pointerdown` ne costa 0.
- **WebKit headless su Windows** vale solo come confronto, e qui meno del solito, per due motivi misurati:
  - da fermo serve meno fotogrammi (38 "persi" in 10 secondi), mentre con un puntino di 8 px che sfuma ne perde 0. Per questo un gesto che anima poco, come «Completate oggi» che si apre in fondo alla pagina, sembra peggiore (da 28,5 a 69);
  - non ha accelerazione grafica: un'animazione a tutto schermo, anche solo di `opacity`, scende a circa 7 fotogrammi al secondo. Lo sfondo del focus lì perdeva 510 fotogrammi in 10 secondi; con il controllo che lo ferma da solo ne perde 186,5, quasi tutti nei primi 4 secondi.
- La prova vera è quella sull'iPhone, dove quei livelli li muove la scheda grafica: lo sfondo del focus è la prima cosa da guardare.
- Le misure sono di prima che entrasse l'illustrazione `empty-focus`. Non sono state rifatte, perché lo stato vuoto di Focus non compare in nessuno dei gesti misurati; le prove di funzionamento invece sono state rifatte tutte.

### Passi a parte, dopo la fase 2a
Ognuno si pubblica da solo, con le sue misure.

- **Apertura del foglio «Nuova attività»**: è il gesto più pesante.
  - In Chromium con la CPU 4 volte più lenta, l'apertura costa 316 ms sul thread principale, di cui 85 ms di ricalcolo dello stile in 57 ricalcoli.
  - Serve una traccia dell'apertura per trovare dove va il tempo. I candidati: `resetAddSheet()` e i `sync*()` che ricompilano il modulo a ogni apertura, `showModal()`, `is-locked`.
  - Poi si riduce, con la misura prima e dopo.
- **«Dimensione testo» dell'iPhone**: oggi il testo ha dimensioni fisse in px.
  - Si passa a `font: -apple-system-body` con il font dell'app, e a dimensioni in rem.
  - I campi restano sempre ad almeno 16 px.
  - Servono schermate con il testo grande, senza rompere i layout a 375 px.

## Navigazione
- **Barra delle schede** in basso: **Focus**, **Agenda**, **Motivazione**.
  - Ogni scheda ha icona e testo; aree di tocco ≥ 44 px; margine sotto con `env(safe-area-inset-bottom)`.
  - Un **indicatore**, una pillola tenue dietro la scheda attiva, scivola sulla scheda scelta con `transform`.
  - È un `<nav>` con tre pulsanti (`aria-current="page"` su quello attivo). Le schede sono tre `<section>`; quelle non attive hanno `hidden`.
- **Cambio di scheda**: dissolvenza con un leggero scorrimento (circa 24 px) nella direzione del cambio, in `--dur-move`. Ogni scheda ricorda dov'era arrivato lo scorrimento. La scheda nuova entra come un blocco unico (`Aura.motion.slideIn`); la vecchia sparisce subito. Un tocco sulla scheda già aperta riporta in cima.
- **All'apertura** l'app parte da **Focus**. Se si ricarica entro 30 minuti dall'ultimo uso (su iPhone succede spesso tornando dallo sfondo), riparte dall'ultima scheda.
- **Intestazione "aura"** in tutte le schede, con logo, campanella e tema. In Agenda e Motivazione è più bassa.
- «+ Nuova attività» e gli avvisi stanno sopra la barra.

## Focus: per fare
- **In cima**, «Cosa faccio adesso?». Poi **In ritardo**, **Oggi** (in ordine d'ora) e **Senza data**. In fondo, «Completate oggi», chiusa.
- **Intestazione**, compatta (sotto i 220 px su iPhone 13): saluto, data e i riquadri "Da fare", "Tempo" e "Fatte oggi" in una riga sola, con etichetta e valore affiancati.
- **Serie e punti** restano visibili in piccolo, in due chip nella riga del saluto (fiamma con i giorni, stella con i punti), con gli effetti di sempre. Un tocco porta a Motivazione.
- **Niente ▶ sulle card**: toglierebbe spazio al titolo. Il focus si avvia dal foglio «Modifica attività» o dalla proposta di «Cosa faccio adesso?».
- Nelle card di oggi l'ora già passata è in rosso, come «Ieri».

### «Cosa faccio adesso?»
- Un pulsante in cima a Focus, largo quanto la lista e a cavallo del bordo dell'intestazione, apre un foglio con due domande:
  - "Quanto tempo hai?", con i chip 10/15/30/45/60/90/120+ («120+» vuol dire nessun limite; nello sfruttamento del tempo conta come 120);
  - "Come ti senti?", con energia bassa/media/alta.
- Ricorda l'ultima scelta (`aura-tasks:prefs`); la prima volta propone 30 minuti ed energia media.
- La proposta compare subito sotto le domande e si aggiorna a ogni scelta. Sotto ci sono due alternative: un tocco ne fa la proposta principale.
- Il pulsante è nascosto quando non c'è niente da fare adesso.
- **Algoritmo**: funzione pura `suggest(tasks, { minutes, energy, today, now, exclude, random })` in `js/suggest.js`. `now` è l'istante attuale in millisecondi.
  - **Candidate**: attività non completate, con `duration ≤ minutes`, con `ENERGY[t.energy].order ≤ ENERGY[energy].order` e con data nulla oppure `≤ oggi`.
  - **Orario** (correzione del 12 novembre 2026): un'attività di oggi con l'orario è candidata solo quando l'ora è passata o mancano al massimo 15 minuti (`SUGGEST.soonMinutes`). Di mattina «Dentista» delle 16:30 non si propone. Quelle in ritardo si propongono a qualsiasi ora.
  - **Punteggio** (i pesi stanno in costanti):
    - urgenza: in ritardo +50, più 5 per ogni giorno di ritardo fino a +30; oggi +30; senza data +10;
    - sfruttamento del tempo: `20 × durata / minuti`;
    - energia: +10 se uguale a quella disponibile (con energia alta si preferiscono le attività impegnative);
    - anzianità: +1 ogni 2 giorni dalla creazione, fino a +10;
    - un pizzico di casualità (±5) per variare. Si disattiva nei test passando `random: () => 0.5`.
  - **Risultato**: la migliore più qualche alternativa, con il **motivo** in italiano. Per esempio: "È in ritardo da 2 giorni e ci sta nei tuoi 30 minuti".
- **Azioni**:
  - "Inizia focus" chiude il foglio e apre il timer;
  - "Fatto" chiude il foglio e completa l'attività come la spunta, con punti e "Annulla";
  - "Un'altra proposta" esclude le attività già proposte finché il foglio resta aperto. Finite tutte, compare "Ricomincia".
- **Nessuna candidata**: un messaggio gentile con l'illustrazione `suggest-none`, e uno di questi suggerimenti (`fallback` di `suggest()`):
  - "Hai più tempo?", con il valore che basterebbe ("Ho 45 minuti");
  - "Una pausa ☕?", con l'attività più breve se con questa energia non c'è niente di adatto ("Proponimela lo stesso");
  - "Una pausa ☕?" e basta, se adesso non c'è niente da fare.

### Focus a tutto schermo con timer
- **Avvio**: "Inizia focus" dal foglio «Modifica attività» (solo per le attività da fare; prima salva le modifiche) oppure dalla proposta.
- **Interfaccia**: foglio a tutto schermo con il titolo dell'attività, un anello SVG che fa il conto alla rovescia partendo dalla durata stimata e il tempo grande (mm:ss). Comandi: Pausa/Riprendi, +5 min, Completa, Esci.
- **Una sessione per volta**. Se l'attività del focus viene completata o eliminata, la sessione si chiude e i suoi minuti restano.
- **Uscita**: Esc, il gesto "indietro" ed "Esci" chiudono la sessione. L'avviso "Focus terminato · 12 min" ha "Annulla", che la riapre com'era e toglie i minuti.
- **Sfondo che respira**, come l'aura dell'intestazione: bagliori ciano e rosa disegnati come gradienti in livelli separati, che si muovono solo con `transform` e `opacity` in un ciclo lento (`--dur-breath`).
  - È l'**unica animazione continua** dell'app, un'eccezione a "mai infinite": gira solo mentre il foglio è aperto, la pagina è visibile e il tempo scorre. Si ferma in pausa e alla fine del tempo (`.is-breathing`).
  - Con «Riduci movimento» lo sfondo resta fermo.
  - I bagliori sono disegnati piccoli (30vmax) e ingranditi con `scale`: occupano un quarto della memoria.
  - **Si ferma da solo dove pesa troppo**: dopo l'apertura `ui-focus.js` guarda 24 fotogrammi (`watchBreath()`); se più della metà dura oltre 45 ms, lo sfondo resta fermo per il resto della sessione.
- **Schermi bassi**: l'anello si adatta all'altezza (38vh). Sotto i 700 px di altezza (iPhone SE, Safari con le sue barre) tutto è più raccolto e il titolo sta su due righe: titolo, anello e comandi stanno in una schermata da 320×568 in su. In orizzontale i comandi si raggiungono scorrendo.
- **Tempo affidabile**
  - Lo stato sta in `aura-tasks:focus`: `{ taskId, startedAt, durationMs, pausedAt, pausedTotalMs }`.
  - Tempo rimanente = `durationMs − (adesso − startedAt − pausedTotalMs)`.
  - **Non contare mai i "tick"** di `setInterval`: su iOS i timer si fermano in background e col blocco schermo. Al ritorno (`visibilitychange`) si ricalcola, e ricaricando la pagina il focus riprende.
  - La logica pura sta in `js/focus.js` ed è testabile passando `now`.
- **Aggiornamento**: un intervallo di 250 ms, solo mentre la pagina è visibile. L'anello cambia `stroke-dashoffset` a scatti, senza transizioni.
- **Schermo acceso**: `navigator.wakeLock.request('screen')` dove supportato. Va richiesto di nuovo dopo `visibilitychange`, ed è facoltativo: senza, si continua lo stesso.
- **Fine del tempo**
  - Suono breve con Web Audio, generato (nessun file). L'`AudioContext` va sbloccato al tocco su "Inizia focus", altrimenti iOS lo blocca. Si crea un attimo prima, quando il dito tocca il pulsante (`pointerdown`), perché crearlo costa tempo.
  - Riaprendo Aura con un focus in corso l'audio non è sbloccato: lo sblocca il primo tocco nel foglio.
  - Vibrazione solo su Android: `navigator.vibrate` su iOS non esiste.
  - Poi si propone "Completata" oppure "+5 min". A tempo finito "+5 min" dà altri 5 minuti da adesso.
  - Se il tempo finisce con Aura nascosta, al ritorno si vede "Tempo finito", senza suono.
- **Notifiche**: senza promemoria attivi non ci sono avvisi ad app chiusa, perché le notifiche programmate offline non esistono.
- **Notifica push alla fine del focus (fase 2b)**: con i promemoria attivi, arriva anche a telefono bloccato. L'utente l'ha approvata il 10 novembre 2026, come **passo a parte**: si fa dopo la sua prova della 2a sull'iPhone, e si pubblica da sola.
  - **Come**: all'avvio l'app aggiunge all'elenco dei promemoria un elemento per la fine (`id: focus-<id dell'attività>`, ora = fine prevista). Lo toglie in pausa e lo aggiorna con Riprendi, +5 min, Completa ed Esci.
  - **Server**: nessun cambio. `cleanReminder()` lo accetta già com'è: l'id rispetta `ITEM_ID`, `fireAt` è uguale ad `at`, l'orario è nel formato HH:MM. Va fissato con un test del server.
  - **Testo**: il titolo ("Tempo finito: …") lo scrive l'app; il service worker riconosce la notifica dal tag e cambia la riga sotto, che dal server arriva come "Adesso, alle 10:25".
  - **Pro**: su iPhone è l'unico modo per avvisare a telefono bloccato o con Aura chiusa; usa cose che ci sono già; vale solo per chi ha già attivato i promemoria.
  - **Contro**:
    - il Cron gira ogni minuto, quindi l'avviso può arrivare fino a un minuto dopo;
    - serve internet all'avvio e a ogni cambio; offline resta il suono, ad app aperta;
    - il titolo dell'attività in focus va al server, come per i promemoria: va aggiornata la nota del foglio "Promemoria e Siri";
    - su iPhone funziona solo con l'app installata e il permesso concesso, come i promemoria;
    - con Aura aperta alla fine può arrivare la notifica oltre al suono;
    - i promemoria push sono ancora da provare sull'iPhone, e questa notifica dipende da loro.
- **Minuti di focus**:
  - alla chiusura della sessione (Completa, Esci, attività completata o eliminata) i minuti effettivi si sommano in `stats.focus`;
  - contano le pause escluse e al massimo la durata impostata, arrotondati al minuto;
  - il giorno è quello locale in cui il focus si è fermato: la pausa, la fine del tempo, oppure la chiusura;
  - sotto un minuto non si registra nulla;
  - non danno punti e non toccano la serie;
  - si vedono nell'avviso ("Completata · +24 punti · 25 min di focus") e in una riga di Motivazione ("Focus: 25 min oggi · 5 h 40 min in tutto").
- **Idee per dopo**: modalità Pomodoro (25/5); bonus punti per il focus.

## Agenda: per pianificare
- **Striscia della settimana**, da lunedì a domenica:
  - ogni giorno ha nome e numero, e un **puntino** se ha attività da fare;
  - il giorno scelto è evidenziato;
  - frecce e scorrimento laterale portano alla settimana prima e dopo; «Oggi» riporta a oggi.
- **Il giorno scelto**:
  - in alto, le attività **senza orario**;
  - sotto, la **linea del tempo**, proporzionale:
    - ogni attività con orario sta alla sua ora ed è alta quanto la sua durata, almeno 44 px per il tocco;
    - le ore mostrate vanno dalla prima all'ultima attività del giorno, almeno dalle 8 alle 20;
    - oggi c'è anche la linea "adesso";
  - le attività che **si sovrappongono** stanno **affiancate**, in colonne di uguale larghezza. Conta anche l'altezza minima: due attività vicine che a schermo si toccherebbero vanno affiancate;
  - un giorno passato mostra le attività rimaste da fare (in ritardo) e quelle completate, barrate.
- **«Prossimi giorni»**, subito sotto il giorno scelto:
  - contiene tutte le attività da fare da domani in poi, in ordine di data e ora, con la data su ogni card;
  - fa quello che oggi fanno le sezioni «Domani» e «Prossimi giorni», così nessuna attività lontana resta nascosta;
  - non dipende dal giorno scelto.
- **Prossimi promemoria**: i prossimi tre avvisi (titolo e ora dell'avviso), presi da `Aura.reminders.buildReminders`, con un collegamento al foglio della campanella. A promemoria spenti c'è "Attiva i promemoria", che apre lo stesso foglio.
- **Senza data, da pianificare**: le attività senza giorno. Un tocco apre la modifica, come oggi.
- Il **«+»** propone il giorno scelto.
- La logica pura sta in `js/agenda.js`, con i suoi test:
  - giorni della settimana e puntini;
  - attività del giorno divise tra senza orario e linea del tempo;
  - colonne delle sovrapposizioni (`layoutTimeline()`);
  - elenco dei prossimi giorni.

## Motivazione: per vedere i progressi
- **Serie e record in grande**, con la fiamma e la barra verso il prossimo traguardo.
- **Punti** di oggi e totali.
- **Livello**, calcolato dai punti totali e mai salvato. Mostra distintivo, nome e barra verso il prossimo livello. Le soglie stanno in `LEVELS` (`js/points.js`):

  | Livello | Nome | Da punti |
  |---|---|---|
  | 1 | Scintilla | 0 |
  | 2 | Fiamma | 150 |
  | 3 | Bagliore | 400 |
  | 4 | Stella | 900 |
  | 5 | Cometa | 1.800 |
  | 6 | Costellazione | 3.500 |
  | 7 | Aurora | 7.000 |

  - **Dopo Aurora si continua**: Aurora 2 a 12.000 punti, Aurora 3 a 17.000 e così via, uno ogni 5.000 punti. Il distintivo è quello di Aurora, con il numero scritto dall'app.
  - Con circa 100 punti al giorno, Stella arriva in poco più di una settimana e Aurora in circa due mesi.
  - Al passaggio di livello, l'avviso del completamento diventa "✨ Livello Stella · +24 punti".
- **Traguardi** raggiunti (3, 7, 14, 30 e 100 giorni) e quanti giorni mancano al prossimo.
- **Obiettivo settimanale**, scelto dall'utente: attività completate da lunedì a domenica (5, 10, 15, 20, 30 o 50). Un anello mostra il progresso. Senza obiettivo, c'è un invito a sceglierlo.
- **Calendario delle ultime 8 settimane**:
  - un quadratino per giorno, con 4 gradi di colore secondo le attività fatte (0, 1–2, 3–4, 5 o più), definiti nei due temi;
  - oggi ha il bordo;
  - il lettore di schermo legge data e numero.
- **Minuti di focus**: oggi, questa settimana e in tutto.
- **Storico delle completate**, raggruppate per giorno di completamento (Oggi, Ieri, poi la data). Spunta, modifica e cestino funzionano come oggi, e c'è «Svuota».
- **Frase del giorno**: una frase incoraggiante da un elenco locale, scelta in base al giorno e uguale per tutto il giorno.
- **Mai sensi di colpa**: a serie interrotta niente "hai perso", ma un invito a ripartire, con l'illustrazione `streak-restart`: "Ogni giorno è buono per ricominciare: completa un'attività e la fiamma si riaccende".
- In fondo: "I dati restano solo su questo dispositivo" e «Backup dei dati».
- **Invito al backup**: «Esporta» salva la data dell'ultimo backup (`lastBackupAt` nelle preferenze). Se sono passati 30 giorni, o se un backup non c'è mai stato, Motivazione mostra un invito gentile a farne uno.
- La logica pura sta in `js/motivation.js`: obiettivo, calendario, minuti, frase del giorno, invito al backup.

## Dati
- **Minuti di focus**: `stats.focus = { 'YYYY-MM-DD': minuti }`, una mappa del registro separata da `days`. Così le regole della serie non cambiano, e i minuti finiscono anche nel backup.
  - **Schema v4** (fase 2a): `migrate()` cambia solo il numero di versione.
  - `sanitizeStats()` aggiunge `focus: {}` e scarta giorni non validi e minuti non interi o fuori da 1–1440 (`Aura.focus.sanitizeMinutes`).
  - `emptyStats()` parte con `focus: {}`, quindi anche `rebuildStats()`.
  - I backup della v1, v2 e v3 si importano ancora: passano dalle stesse migrazioni.
- **Preferenze**: `aura-tasks:prefs = { lastTab, lastTabAt, suggest: { minutes, energy } }`. Nella fase 4 si aggiungono `weeklyGoal` e `lastBackupAt`.
  - È senza versione, come `aura-tasks:remote`, e fuori dal backup, come il tema.
  - La scrive e la legge solo `js/storage.js` (`loadPrefs()` e `savePrefs()`). `sanitizePrefs()` pulisce i valori e conserva i campi sconosciuti.
  - `suggest.minutes` è una delle scelte del foglio; `null` vuol dire «120+».
- **Focus in corso**: `aura-tasks:focus` (vedi "Tempo affidabile"). Lo scrive e lo legge solo `js/storage.js` (`loadFocus()`, `saveFocus()`, `clearFocus()`); lo pulisce `Aura.focus.sanitizeSession()`. È fuori dal backup.
- **Livello**: si calcola dai punti, non si salva.

## Collegamenti e notifiche
- `?add=`, casella di Siri, promemoria, modifica e backup restano come oggi. Il foglio "Nuova attività" si apre sopra la scheda in cui si è.
- **Notifica toccata** (`?task=id` o messaggio `open-task`): `showTask(id)` apre la scheda in cui l'attività si vede, la porta in vista e la evidenzia:
  - In ritardo, Oggi o Senza data → Focus;
  - un giorno futuro → Agenda, su quel giorno;
  - completata → Motivazione, nello storico.

## Dove va ogni funzione di oggi

| Oggi | Dopo |
|---|---|
| Logo, campanella e tema nell'intestazione | Intestazione di tutte le schede |
| Saluto, data e riquadri "Da fare", "Tempo stimato", "Fatte oggi" | Intestazione di Focus |
| Riquadri "Serie" e "Punti", con i loro effetti | In piccolo in Focus, in grande in Motivazione |
| Sezioni "In ritardo" e "Oggi" | Focus |
| Sezioni "Domani" e "Prossimi giorni" | Agenda: nel giorno scelto e nell'elenco «Prossimi giorni», con tutte le attività da domani in poi in ordine di data |
| Sezione "Senza data" | Focus (da fare) e Agenda (da pianificare) |
| «Completate» con «Svuota» | Storico in Motivazione, con «Svuota». In Focus resta «Completate oggi» |
| Spunta, modifica, cestino e "Annulla" | Su ogni card, in ogni scheda |
| «+ Nuova attività» | Sopra la barra, in tutte le schede. In Agenda propone il giorno scelto |
| Lista vuota con l'illustrazione | Uno stato vuoto per scheda, con la sua illustrazione |
| "I dati restano solo su questo dispositivo" e «Backup dei dati» | In fondo a Motivazione |
| Fogli "Nuova attività" / "Modifica attività", "Tema", "Promemoria e Siri", "Backup dei dati" | Invariati, sopra qualsiasi scheda |
| Frase, link `?add=`, casella di Siri | Invariati |
| Promemoria e tocco sulla notifica | Invariati; la notifica apre la scheda giusta |
| Avvisi con "Annulla" | Sopra la barra delle schede |
| Fascia sotto la barra di stato, tema, uso offline | Invariati |

## Icone
Tutte le icone dell'interfaccia, nuove comprese, sono SVG disegnati a mano nello sprite di `index.html` (`<use href="#i-…">`), con il tratto in `currentColor`, come oggi. Quelle nuove:
- **barra**: Focus (anelli dell'aura), Agenda (calendario con puntini), Motivazione (medaglia);
- **Focus**: inizia (▶), pausa, «Cosa faccio adesso?» (bussola), "Un'altra proposta" (frecce incrociate);
- **Agenda**: frecce sinistra e destra, «Oggi»;
- **Motivazione**: obiettivo (bersaglio), traguardi, storico, frase del giorno, minuti di focus (clessidra);
- **distintivi di riserva** dei 7 livelli (scintilla, fiamma, bagliore, stella, cometa, costellazione, aurora), usati finché mancano le illustrazioni.

## Illustrazioni
Elenco, flusso e prompt stanno in [illustrazioni.md](illustrazioni.md).
- Ogni immagine entra con la fase che la usa, nella versione che c'è in quel momento.
- Nell'app ci sono `suggest-none` ed `empty-focus`, dalla fase 2a.
- Dove un'immagine non è ancora entrata, l'app usa le icone (distintivi) o uno stato vuoto di solo testo.

## Premium
Le categorie stanno nella tabella di `CLAUDE.md`:
- **gratuite**: animazioni, barra delle schede, Focus, Agenda e la base di Motivazione, perché ci finiscono funzioni di oggi;
- **da decidere**: «Cosa faccio adesso?», timer e minuti di focus, livelli, obiettivo settimanale, calendario, frase del giorno, illustrazioni.

## Codice
- **Moduli puri nuovi**:
  - `js/suggest.js` e `js/focus.js` (fase 2);
  - `js/agenda.js` (fase 3);
  - `js/motivation.js` (fase 4);
  - `LEVELS` e il calcolo del livello, Aurora 2, 3… compresi, in `js/points.js`.
- `js/motion.js` (fase 1) tocca la pagina solo per le animazioni. `slideIn()` (fase 2a) fa entrare una scheda come un blocco unico.
- Ogni scheda può avere un suo file che tocca la pagina, come `app.js`: così `app.js` non cresce troppo.
  - `js/ui-focus.js` (fase 2a): i fogli «Cosa faccio adesso?» e Focus, il suono di fine e lo schermo acceso. `app.js` gli passa con `Aura.focusUI.init()` quello che gli serve: stato, `commit()`, fogli, avvisi, preferenze.
  - `js/ui-agenda.js` e `js/ui-motivation.js` arrivano con le fasi 3 e 4.
- Ogni file nuovo va in `index.html`, in `tests/index.html` se ha logica pura, e in `APP_FILES` di `sw.js`.
