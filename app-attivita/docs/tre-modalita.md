# Tre modalità: Focus, Agenda e Motivazione (in corso: fasi 1 e 2a fatte e provate sull'iPhone)

Nuovo capitolo: animazioni più fluide e l'app divisa in **tre schede**, una per ogni modo di usarla. Assorbe il vecchio punto 4 di "Funzioni future" («Cosa faccio adesso?» e modalità focus): le specifiche sono qui, aggiornate.

**Regola: niente si toglie né peggiora.** Ogni funzione di oggi resta; al massimo cambia posto (vedi "Dove va ogni funzione di oggi").

## Fasi
Ogni fase si pubblica da sola, con i suoi test, la prova WebKit e la prova dell'utente sull'iPhone prima della successiva.

| Fase | Contenuto | Stato |
|---|---|---|
| 1 | Animazioni più fluide in tutta l'app | fatta; provata sull'iPhone il 16 novembre 2026 |
| 2a | Barra delle schede e Focus, con «Cosa faccio adesso?», il timer e i minuti di focus | fatta e pubblicata con la v9; provata sull'iPhone il 16 novembre 2026. Il difetto trovato (il focus a tutto schermo non restava fermo) è corretto con la v13, da riprovare sull'iPhone |
| 2b | Notifica push alla fine del focus | approvata: passo a parte, dopo la prova della 2a sull'iPhone (vedi "Notifica push alla fine del focus") |
| — | Passo a parte: apertura più leggera del foglio «Nuova attività» | misurata di nuovo il 27 novembre 2026: non è più il gesto più pesante, per ora non si cambia (vedi "Passi a parte, dopo la fase 2a") |
| — | Passo a parte: rispettare «Dimensione testo» dell'iPhone | fatto con la v27; da provare sull'iPhone (vedi "Passi a parte, dopo la fase 2a") |
| 3 | Agenda | sostituita da [P-003](../../docs/proposte/P-003.md), passo 3.2: Agenda a calendario |
| 4 | Motivazione, con le illustrazioni | sostituita da [P-003](../../docs/proposte/P-003.md), passi 3.3–3.5 |
| — | [P-003](../../docs/proposte/P-003.md), passo 3.1: cambio di scheda animato e aurora nel focus | fatto con la v15; da provare sull'iPhone (vedi "P-003, passo 3.1") |
| — | [P-003](../../docs/proposte/P-003.md), passo 3.2: Agenda a calendario | fatto con la v16; da provare sull'iPhone (vedi "Agenda: per pianificare" e "P-003, passo 3.2") |
| — | [P-003](../../docs/proposte/P-003.md), passo 3.3: Motivazione con livello, «La tua settimana» e «I tuoi numeri» | fatto con la v17; da provare sull'iPhone (vedi "P-003, passo 3.3") |
| — | [P-003](../../docs/proposte/P-003.md), passo 3.4: «I tuoi premi» | fatto con la v18; da provare sull'iPhone (vedi "P-003, passo 3.4") |
| — | [P-003](../../docs/proposte/P-003.md), passo 3.5: «Sfide di oggi» | fatto con la v28; da provare sull'iPhone (vedi "P-003, passo 3.5") |
| — | [P-004](../../docs/proposte/P-004.md), passo 4.1: negozio | fatto con la v19; da provare sull'iPhone (vedi "P-004, passo 4.1") |
| — | [P-004](../../docs/proposte/P-004.md), passo 4.2: musica nel focus, senza account | fatto con la v20; da provare sull'iPhone (vedi "P-004, passo 4.2" e [musica.md](musica.md)) |

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
  - dove in una riga non ci stanno interi (sotto i 375 px circa, oppure con numeri lunghi come «12 h 45 min»), i tre riquadri vanno su due righe, etichetta sopra e valore sotto, come Serie e Punti: un'etichetta non si accorcia mai («T…»). Lo decide `fitStats()` in `app.js`, che somma le larghezze naturali di etichette e valori, le stesse nei due modi, con un `ResizeObserver` sulla riga e sui valori (prima che la pagina si disegni, senza letture forzate dentro `render()`). Con il testo spaziato di WCAG 1.4.12 a 320 px l'etichetta va a capo tra le parole. A 390 px, con numeri normali, l'intestazione resta quella di prima, pixel per pixel;
  - «Cosa faccio adesso?» è su una riga, a cavallo del bordo dell'intestazione (`.hero--cta`). Con il passo 1 dell'assistente diventa una striscia di due righe, alta 48 px invece di 50: l'intestazione resta di 188 px (vedi [assistente.md](assistente.md));
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
  - **Misura del 27 novembre 2026** (cache v25): Chromium 153 headless con Playwright 1.63, contesto «iPhone 13», CPU 4 volte più lenta, mediana di 8 prove. Fotogrammi persi all'apertura: «Nuova attività» 0,5 (il peggiore di 25 ms), «Modifica attività» 0,5, «Impostazioni» 2 (il peggiore di 50 ms), cambio di scheda 1,5. In tutta l'animazione d'ingresso «Nuova attività» costa 84 ms di thread principale, di cui 22 ms di stile in 25 ricalcoli e 5 ms di layout (mediana di 10 aperture); il primo fotogramma arriva dopo 33 ms. I numeri sopra vengono da un altro computer e non si confrontano: conta l'ordine dei gesti.
  - **Esito**: il foglio non è più il gesto più pesante, quindi per ora non si cambia. Si riapre se sull'iPhone l'apertura sembra lenta.
- **«Dimensione testo» dell'iPhone**: prima il testo aveva dimensioni fisse in px.
  - Si passa a `font: -apple-system-body` con il font dell'app, e a dimensioni in rem.
  - I campi restano sempre ad almeno 16 px.
  - Servono schermate con il testo grande, senza rompere i layout a 375 px.
  - **Fatto con la v27** (27 novembre 2026). Solo su iPhone e iPad la radice prende la misura di «Dimensione testo» (`font: -apple-system-body`, dentro `@supports` con `-webkit-touch-callout`: sul Mac quella misura è di 13 px); altrove è 17 px (`106.25%`), la misura del testo normale dell'iPhone. Le misure del testo si scrivono `calc(N * var(--px))`: `--px` vale 1 px con il testo normale e cresce con quello scelto, fino a 28 px, il primo dei testi grandi di Accessibilità. Le parti strette (calendario, chip in griglia, contatore dei minuti, pacchetti del negozio, nome dell'app) usano `--px-ui`, che si ferma a 21 px. Regole in [CLAUDE-GUIDE.md](CLAUDE-GUIDE.md), «Convenzioni», «Dimensione del testo».
  - Con il testo grande i layout si adattano: Serie e Punti in Motivazione vanno uno sotto l'altro; «I tuoi numeri», i pulsanti del focus e le scelte delle Impostazioni hanno meno colonne; le righe dei premi e quella di data e ora vanno a capo; negli indirizzi da copiare, per Claude e per Siri, «Copia» va sotto; la striscia di «Cosa faccio adesso?» e il calendario a cavallo dell'intestazione crescono con il testo.
  - Restano in px, con il commento `px fisso`: le emoji nei riquadri fissi, la barra delle schede (come quella di iOS), i nomi del tema nelle tre anteprime, il timer del focus e il codice per collegare Claude, che seguono già lo schermo. La CI lo controlla.
  - **Prove** (Chromium 153 con Playwright 1.63, la radice portata a 14, 19, 21, 23, 28 e 40 px come fa iOS): a 320, 375 e 390 px, nelle tre schede e in tutti i fogli, niente esce dallo schermo o dal foglio, niente scorre di lato e niente finisce con i puntini, tranne la striscia di «Cosa faccio adesso?» a 320 px dal testo a 28 px in su (una riga per scelta: l'attività intera è nella lista). Con il testo normale le schermate sono uguali pixel per pixel a quelle di prima (390, 375, 360, 320 e 1280 px, due temi), tranne dove prima c'erano i puntini: «Apple Music» e «Amazon Music» nelle Impostazioni e «Traguardo: 14 giorni» in Motivazione a 320 px, che ora vanno a capo.
  - **Da provare sull'iPhone**: Impostazioni › Schermo e luminosità › Dimensione testo (e Accessibilità › Schermo e dimensione testo › Testo più grande), poi si torna in Aura (se il testo non cambia, la si chiude e riapre). Da guardare le tre schede e i fogli con il testo più piccolo, quello normale, il più grande e uno di Accessibilità.

### P-003, passo 3.1: cambio di scheda e aurora
Il cambio di scheda diventa un movimento d'insieme (vedi "Navigazione") e lo sfondo del focus diventa un'aurora che sale con il tempo (vedi "Focus a tutto schermo con timer").

#### Risultati del passo 3.1 (17 novembre 2026)
Fotogrammi persi, mediana di 10 prove (5 in tema chiaro e 5 in tema scuro): gli stessi gesti sulla versione pubblicata (v14, «prima») e su quella nuova (v15, «dopo»), a 390×844, in Chromium headless. WebKit non è stato eseguito: in questo ambiente non c'è. Le misure valgono come confronto tra prima e dopo; non si confrontano con quelle della fase 2a, fatte in Edge su un altro computer.

| Gesto | Chromium, CPU 4 volte più lenta | Chromium a piena velocità |
|---|---|---|
| passare ad Agenda | 0 → 1 | 0 → 0 |
| passare a Motivazione | 3 → 3 | 0 → 0 |
| tornare a Focus | 0 → 0 | 0 → 0 |
| 10 secondi di focus in corso (prima i bagliori che respirano, dopo l'aurora) | 0 → 0 | 0 → 0 |

- Il cambio di scheda adesso muove molto di più (lo sfondo che scivola, il bagliore, i blocchi uno dopo l'altro, la pillola e l'icona) e costa al massimo un fotogramma in più, solo con la CPU rallentata.
- L'aurora, come i bagliori di prima, non perde fotogrammi: gira sul compositore. La prova vera è quella sull'iPhone, dove la muove la scheda grafica: è la prima cosa da guardare, per qualche minuto di focus.
- Prove di funzionamento, nei due temi: nessun errore nella console e nessuno scorrimento orizzontale a 320×568, 390×844 e 1280×800, e aprendo `index.html` da file. Con «Riduci movimento» nessuna animazione in corso e l'aurora ferma. A riposo l'intestazione è uguale a prima: stessa altezza (188 px in Focus a 390 px) e stessi colori.

### P-003, passo 3.2: Agenda a calendario
La scheda Agenda diventa un calendario con il giorno scelto sotto (vedi "Agenda: per pianificare"). L'ha scritto Claude Project, perché l'ambiente di Codex non c'è ancora.

#### Risultati del passo 3.2 (19 novembre 2026)
Fotogrammi persi, mediana di 20 prove (10 in tema chiaro e 10 in tema scuro), a 390×844 in Chromium 153 headless, con una giornata piena (11 attività da fare, 10 completate). «Prima» è la versione pubblicata (v15), «dopo» quella nuova (v16); i gesti sul calendario prima non c'erano. WebKit non è stato eseguito: in questo ambiente non c'è.

| Gesto | Chromium, CPU 4 volte più lenta | Chromium a piena velocità |
|---|---|---|
| passare ad Agenda | 1 → 3 | 0 → 0 |
| tornare a Focus | 1 → 1 | 0 → 0 |
| scegliere un giorno | 1 | 0 |
| mese dopo | 1 | 0 |
| «Oggi» | 1 | 0 |
| «Solo la settimana» | 2 | 0 |
| «Tutto il mese» | 1 | 0 |

- Passare ad Agenda costa due fotogrammi in più, solo con la CPU rallentata, perché la scheda ha molto più contenuto: il calendario e le card del giorno, dei prossimi giorni e da pianificare. Non dipende dai movimenti: con «Riduci movimento» lo stesso passaggio perde 0,5 fotogrammi prima e 2,5 dopo, e le tracce mostrano il tempo in più nel calcolo del layout e nel disegno. `content-visibility` sulle sezioni sotto il giorno non ha aiutato ed è stato tolto. A piena velocità nessun gesto perde fotogrammi; la prova vera è quella sull'iPhone.
- Il calendario del mese è alto 372 px quando ha 6 righe (la proposta stimava circa 330 px), 152 px con «Solo la settimana».
- Prove di funzionamento, con Playwright 1.63: nessun errore nella console e nessuno scorrimento orizzontale a 390×664 nei due temi, a 320×568 e a 1280×800. Gli stessi gesti danno lo stesso risultato con «Riduci movimento» e aprendo `index.html` da file, senza messaggi della CSP:
  - scegliere un giorno, anche passato (le completate barrate, l'attività in ritardo, niente «Metti a…»); frecce, dito, «Oggi», «Solo la settimana» ricordata dopo il ricaricamento;
  - «Metti a oggi» con «Annulla»; il «+» di uno spazio libero apre «Nuova attività» con giorno e ora, e l'attività finisce in «Con orario»; «Nuova attività» con domani scelto propone domani, con un giorno passato nessun giorno;
  - frecce della tastiera e Invio tra i giorni, con il fuoco che resta, anche oltre il bordo (mese e settimana accanto); completare un'attività dal giorno scelto;
  - con l'orologio finto (`page.clock`): la linea dell'ora avanza ogni minuto; lo spazio libero si accorcia ogni 5 minuti e il «+» tiene il fuoco; alle 14:00 l'attività delle 14:00 diventa rossa e la linea le passa sotto; con un altro giorno scelto il minuto non cambia niente; a mezzanotte il giorno scelto passa al giorno nuovo;
  - una settimana a cavallo di due mesi: scegliendo oggi, «Oggi» sparisce.
- Intestazione di Focus a 390×664: 188 px prima e dopo, con 4 card intere.

### P-003, passo 3.3: Motivazione
La scheda Motivazione diventa quella del passo 3.3 di [P-003](../../docs/proposte/P-003.md): il livello nell'intestazione, «La tua settimana», «I tuoi numeri» e «Completate» chiusa. Vale la proposta; il piano di prima, in «Motivazione: per vedere i progressi», resta per memoria. L'ha scritto Claude Project, come prevede la tabella «Ordine» della proposta.

#### Risultati del passo 3.3 (19 novembre 2026)
Fotogrammi persi, mediana di 20 prove (10 in tema chiaro e 10 in tema scuro), a 390×844 in Chromium 153 headless, con una settimana piena: 30 completate, minuti di focus, obiettivo 30. «Prima» è la versione pubblicata (v16), «dopo» quella nuova (v17); l'obiettivo e «Completate» chiusa prima non c'erano. WebKit non è stato eseguito: in questo ambiente non c'è.

| Gesto | Chromium, CPU 4 volte più lenta | Chromium a piena velocità |
|---|---|---|
| passare a Motivazione | 6 → 4 | 0 → 0 |
| tornare a Focus | 1 → 1 | 0 → 0 |
| cambiare l'obiettivo | 0 | 0 |
| aprire «Completate» | 2 | 0 |
| chiudere «Completate» | 3 | 0 |

- Passare a Motivazione costa meno di prima, anche con le stelle che si accendono: le card delle completate stanno nella sezione chiusa e non si disegnano finché non la si apre.
- Aprire e chiudere «Completate» fa scivolare 30 card e il fondo della pagina, come «Completate oggi» in Focus: 2 o 3 fotogrammi persi, solo con la CPU rallentata. A piena velocità nessun gesto perde fotogrammi; la prova vera è quella sull'iPhone.
- Prove di funzionamento, con Playwright 1.63, a 390×664 nei due temi, a 320×568 e a 1280×800, con «Riduci movimento» e aprendo `index.html` da file (110 controlli, tutti superati; nessun errore nella console né messaggi della CSP; nessuno scorrimento orizzontale):
  - livello giusto in ogni fascia di punti, da Scintilla ad Aurora 2 (con il bollino e senza «livello N di 7»); i distintivi caricati e Stella disegnata;
  - il cielo con le stelle, i cerchi e la fascia di oggi; l'obiettivo gira con un tocco (15 → 20 → 30 → 50 → nessuno → 5), resta salvato e il lettore di schermo lo annuncia; con l'obiettivo già superato la costellazione appare con una dissolvenza e il contatore dice «10 stelle» invece di «10 di 5»;
  - l'avviso «🌌 Obiettivo della settimana raggiunto» parte quando una spunta porta il conto all'obiettivo, e non torna dopo «Annulla» e una nuova spunta; «✨ Livello Stella» quando una spunta fa salire di livello;
  - «Completate» chiusa con il numero, si apre con un tocco e riapre un'attività dalla spunta; il primo giorno, senza dati, non c'è;
  - a 320 px nessuna stella può finire sotto «N di M»: le stelle partono da `MOTIVATION.sky.top` (46) e il contatore ha `line-height: 1`, con almeno 2,4 px di margine;
  - le stelle si accendono solo con `opacity` e `transform`; con «Riduci movimento» nessuna animazione;
  - contrasto dei testi nuovi tra 5,2 e 17,8 a 1, nei due temi.
- Intestazione di Focus a 390×664: 188 px prima e dopo, con 4 card intere. In Motivazione l'intestazione cresce di una riga (il livello, 60 px) e il sottotitolo non c'è più.

### P-003, passo 3.4: «I tuoi premi»
In Motivazione, tra «La tua settimana» e «I tuoi numeri», la card «I tuoi premi» del passo 3.4 di [P-003](../../docs/proposte/P-003.md): i premi scelti dall'utente, con un prezzo in punti, da riscattare con il saldo da spendere. Le regole stanno in [punti-e-serie.md](punti-e-serie.md), «Premi»; i dati in «Dati», qui sotto. L'ha scritto Claude Project, come prevede la tabella «Ordine» della proposta.

In più rispetto alla proposta, piccoli aiuti che non cambiano le regole: l'emoji che si sceglie da sola dal nome, i sei prezzi pronti con i punti degli ultimi 7 giorni, l'avviso «Ora puoi riscattare» dopo una spunta, lo storico «Riscattati».

#### Risultati del passo 3.4 (19 novembre 2026)
Fotogrammi persi, mediana di 20 prove (10 in tema chiaro e 10 in tema scuro), a 390×844 in Chromium 153 headless, con la settimana piena del passo 3.3 più 4 premi e 3 riscatti. «Prima» è la versione pubblicata (v17), «dopo» quella nuova (v18); i gesti dei premi prima non c'erano. WebKit non è stato eseguito: in questo ambiente non c'è.

| Gesto | Chromium, CPU 4 volte più lenta | Chromium a piena velocità |
|---|---|---|
| passare a Motivazione | 4 → 6 | 0 → 0 |
| tornare a Focus | 0 → 0 | 0 → 0 |
| riscattare (coriandoli, avviso, saldo) | 3 | 0 |
| aprire il foglio del premio | 2 | 0 |
| chiudere il foglio del premio | 0 | 0 |

- Passare a Motivazione costa 2 fotogrammi in più, ma solo la prima volta dopo l'apertura dell'app e solo con la CPU rallentata: in un'altra serie di prove la prima apertura passa da 3 a 5, la seconda da 0 a 1, la terza resta a 0. Vengono dal primo disegno delle emoji dei premi: con le emoji sostituite da una lettera, oppure senza la card, si torna a 4 come prima; nascondere i pulsanti «Riscatta» o rimandare il disegno della card (`content-visibility`) non cambia niente. A piena velocità nessun gesto perde fotogrammi; la prova vera è quella sull'iPhone.
- Riscattare perde 3 fotogrammi solo con la CPU rallentata: i coriandoli sono quelli dei traguardi, con l'avviso e la pillola del saldo che salta.
- Prove di funzionamento, con Playwright 1.63, a 390×664 nei due temi, a 320×568 e a 1280×800, con «Riduci movimento» e aprendo `index.html` da file (166 controlli, tutti superati; nessun errore nella console né messaggi della CSP; nessuno scorrimento orizzontale):
  - i dati della v4 arrivano alla v5 e restano intatti; la card vuota invita ad aggiungere un premio;
  - il foglio: errori del nome e del prezzo con il focus sul campo giusto, l'emoji che si sceglie dal nome finché non la sceglie l'utente, i prezzi pronti, «Esc» e la chiusura che riportano il focus dove serve;
  - i premi in ordine di prezzo, con la barra e lo stato; «Riscatta» grigio dice quanto manca; il riscatto con coriandoli, l'avviso «Te lo sei meritato: … · −400 punti», il saldo che scende mentre livello e riquadro Punti restano; «Annulla»; un doppio tocco conta una volta sola;
  - modifica con la nota «Preso 1 volta», il riscatto di prima che resta a −400, «Annulla»; eliminazione con «Annulla», e il premio eliminato che resta nello storico con il suo nome;
  - l'avviso «🍕 Ora puoi riscattare: …» dopo una spunta in Focus (anche con il saldo più basso dei punti), e quello del livello che ha la precedenza;
  - 30 premi al massimo: «Aggiungi» lascia il posto alla nota, e torna eliminandone uno;
  - backup dal foglio: il file ha premi e riscatti, il riepilogo conta i premi, importare e ripristinare li rimettono;
  - a 320 px la pillola del saldo va sotto il titolo e i nomi lunghi vanno a capo senza finire sotto «Riscatta»; le aree di tocco della card e del foglio sono di almeno 44 px;
  - coriandoli e salto della pillola solo con `opacity` e `transform`; con «Riduci movimento» niente;
  - contrasto dei testi nuovi tra 4,7 e 17,8 a 1, nei due temi.
- Intestazione di Focus a 390×664: 188 px prima e dopo, con 4 card intere.

### P-003, passo 3.5: «Sfide di oggi»
In Motivazione, dopo «I tuoi premi», la card «Sfide di oggi» del passo 3.5 di [P-003](../../docs/proposte/P-003.md): ogni giorno tre piccole sfide prese dai propri dati, 10 punti l'una e 20 in più con tutte e tre. Le regole stanno in [punti-e-serie.md](punti-e-serie.md), «Sfide di oggi», scritte prima del codice come chiede la proposta, con i due punti in cui la cambiano e il perché; i dati in «Dati», qui sotto. Nella tabella «Ordine» della proposta l'esecutore è ChatGPT / Codex: l'ha scritto Claude Project, con la revisione di Codex, e il cambio lo decide il Product Owner.

In più rispetto alla proposta, piccoli aiuti che non cambiano le regole: l'avviso della spunta dice le sfide fatte e somma i loro punti («🎯 Sfida fatta · +30 punti», «🏆 Tutte e tre le sfide! · …»), e così «Esci» dal focus («Focus terminato · 25 min · 🎯 Sfida fatta +10»); nella card l'anello di una sfida appena fatta fa un piccolo salto, e anche «1 di 3»; «+N oggi» nel riquadro Punti conta anche le sfide.

#### Risultati del passo 3.5 (27 novembre 2026)
Fotogrammi persi, mediana di 20 prove (10 in tema chiaro e 10 in tema scuro), a 390×844 in Chromium 153 headless, con 7 attività, 9 giorni di completamenti, minuti di focus e 2 premi, e le due versioni alternate a ogni prova. «Prima» è la v27 (quella di «Dimensione testo»), «dopo» quella nuova (v28). La spunta completa un'attività: nella v28 fa anche una sfida, con l'avviso «🎯 Sfida fatta · +30 punti». WebKit non è stato eseguito: in questo ambiente non c'è.

| Gesto | Chromium, CPU 4 volte più lenta | Chromium a piena velocità |
|---|---|---|
| passare a Motivazione (la prima volta dopo l'apertura) | 7 → 7 | 0 → 0 |
| tornare a Focus | 0 → 1,5 | 0 → 0 |
| completare un'attività con la spunta | 2,5 → 4 | 0 → 0 |

- Passare a Motivazione, con la card in più, costa come prima: in tre serie di prove la v27 perde in media 8,5, 7,3 e 7 fotogrammi, la v28 7,7 e 7,5. Tornare a Focus cambia da una serie all'altra anche con la stessa versione: in media 1,2, 1,7 e 0,5 la v27, 1,1 e 1,1 la v28.
- La spunta perde in media 0,7 fotogrammi in più, solo con la CPU rallentata (3 la v27 e 3,7 la v28, in media su tutte le serie). Viene quasi tutto dal primo disegno dell'emoji 🎯 dell'avviso, come le emoji dei premi nel passo 3.4: con lo stesso avviso senza l'emoji, nella stessa serie, 2,9 contro 2,7 della v27 e 3,4 della v28. L'emoji resta: gli altri avvisi speciali hanno già la loro (🎉, ✨, 🌌, 🔥), e sull'iPhone le emoji sono un carattere del sistema. A piena velocità nessun gesto perde fotogrammi; la prova vera è quella sull'iPhone.
- Prove di funzionamento, con Playwright 1.63 e l'orologio finto (`page.clock`), nel contesto «iPhone 13»; nessun errore nella console né messaggi della CSP:
  - dati salvati da una versione di prima (la v5) arrivano alla v8, e le sfide di oggi nascono all'apertura e si salvano subito (che il resto dei dati non cambi lo controllano i test della migrazione); un'attività completata prima, lo stesso giorno, conta già: «entro le 18» nasce fatta, e la card dice «1 di 3»;
  - una spunta che fa una sfida: l'avviso «🎯 Sfida fatta · +30 punti» (20 dell'attività e 10 della sfida), la riga fatta con «Fatto alle 10:30», «2 di 3» e «+64 oggi»; «Annulla» la rimette da fare e toglie esattamente i 30 punti;
  - un focus di 25 minuti chiuso con «Esci» che fa la terza sfida: «Focus terminato · 25 min · 🏆 Tutte e tre le sfide! +30» (10 della sfida e 20 in più), «3 di 3» e la nota «Tutte e tre fatte: +50 punti oggi»; con la sola sfida del focus, «Focus terminato · 26 min · 🎯 Sfida fatta +10», e «Annulla» la rimette da fare, toglie i suoi 10 punti e riapre il focus;
  - con Aura aperta, alle 18:01 «Hai tempo fino alle 18» diventa «Entro le 18», senza ricaricare; a mezzanotte nascono e si salvano le sfide del giorno nuovo, e la card le mostra;
  - a 390 e a 320 px, nei due temi, con il testo normale e a 28 px: nessuno scorrimento orizzontale; con il testo grande l'anello resta accanto al testo e va a capo solo «+10»;
  - axe-core con le regole WCAG 2.2 AA e le «best practice», nei due temi, con il testo normale e a 28 px, con una sfida fatta e con tutte e tre: nessun problema; il lettore di schermo legge «Fatte: 1 di 3», «Fatta: Completa 2 attività» e «+10 punti», e salta l'anello;
  - l'anello cambia con `stroke-dashoffset` senza transizioni, come quello del focus, e fatto sfuma solo il colore (`--dur-color`); i salti usano solo `transform`; con «Riduci movimento» niente salti.

### P-004, passo 4.1: negozio
In Motivazione, dopo «I tuoi premi», la card «Negozio» del passo 4.1 di [P-004](../../docs/proposte/P-004.md): si paga con il saldo da spendere dei premi e si comprano «Ripara la serie», quattro colori dell'aurora e quattro forme dei coriandoli; i pacchetti di punti si vedono, con «Presto». Le regole stanno in [punti-e-serie.md](punti-e-serie.md), «Negozio»; i dati in «Dati», qui sotto. L'ha scritto Claude Project, come prevede la tabella «Ordine» della proposta.

In più rispetto alla proposta, piccoli aiuti che non cambiano le regole: nel foglio la riga «Ripara la serie» resta sempre e dice quando si usa, oppure che le riparazioni sono finite per ora; scegliendo una forma di coriandoli già comprata, una piccola festa la fa vedere; il riepilogo del backup conta anche gli acquisti («· 3 acquisti») e dice che anche loro verranno sostituiti.

#### Risultati del passo 4.1 (20 novembre 2026)
Fotogrammi persi, mediana di 20 prove, a 390×664 in Chromium 153 headless, in tema chiaro, con una serie interrotta ieri, 1.360 punti e un premio. «Prima» è la versione pubblicata (v18), «dopo» quella nuova (v19). Il foglio e l'acquisto si confrontano con i gesti dei premi della v18: aprire il foglio di un premio nuovo e riscattare un premio. WebKit non è stato eseguito: in questo ambiente non c'è.

| Gesto | Chromium, CPU 4 volte più lenta | Chromium a piena velocità |
|---|---|---|
| passare a Motivazione | 4 → 4 | 0 → 0 |
| aprire il foglio (prima quello di un premio, dopo il negozio) | 1 → 1 | 0 → 0 |
| comprare un colore, con coriandoli e avviso (prima: riscattare un premio) | 2 → 2 | 0 → 0 |

- La prima versione, con la CPU rallentata, perdeva 2 fotogrammi in più comprando un colore. La causa: il colore in uso stava su `<html>`, e lì un cambio ricalcolava lo stile di tutta la pagina (circa 17 ms con la CPU 4 volte più lenta, contro meno di 1 ms sull'elemento). Ora il colore va solo sui due elementi che lo usano, l'aurora del focus a tutto schermo e il bagliore della scheda Focus; in più gli oggetti del foglio si aggiornano sul posto invece di essere ridisegnati.
- Passare a Motivazione cambia da una serie all'altra (mediane tra 4 e 6, per le due versioni). In tre serie da 20 la media è sempre un po' più alta dopo, da 0,1 a 0,8 fotogrammi: è il disegno della card in più, solo con la CPU rallentata. A piena velocità nessun gesto perde fotogrammi; la prova vera è quella sull'iPhone.
- Prove di funzionamento, con Playwright 1.63, a 390×664 e a 320×568 nei due temi e a 1280×800, con «Riduci movimento» e aprendo `index.html` da file (120 controlli, tutti superati; nessun errore nella console né messaggi della CSP; nessuno scorrimento orizzontale):
  - i dati della v5 arrivano alla v6 con il registro degli acquisti vuoto e «Aurora» e «Classici» in uso; attività, premi e punti restano intatti;
  - la card sta tra «I tuoi premi» e «I tuoi numeri», con lo stesso saldo dei premi; con la serie interrotta ieri il riquadro della serie dice «Puoi ripararla nel negozio» e la card «Ieri è saltato un giorno»;
  - «Ripara»: la serie torna a 7 giorni, con il record, il traguardo dei 7, i coriandoli e l'avviso «🎉 Serie riparata…» con «Annulla», che rimette serie, saldo e record (il traguardo già festeggiato resta); l'altro ieri si ripara se ieri c'è una spunta; con 2 riparazioni negli ultimi 30 giorni il foglio dice «Riparazioni finite, per ora»; con il saldo che non basta il pulsante è grigio e un tocco dice quanto manca;
  - il foglio: focus sul titolo, quattro gruppi, cinque colori e cinque forme con il prezzo oppure «In uso», i tre pacchetti con «Presto», che dicono che arriveranno e non comprano niente; «Esc» lo chiude e il focus torna su «Apri il negozio»;
  - comprare Tramonto: il saldo scende nelle due card, il colore è subito in uso sul bagliore di Focus e sull'aurora del focus (niente su `<html>`), avviso e coriandoli stanno dentro il foglio, il focus resta sull'oggetto; un doppio tocco compra una volta sola; «Annulla» toglie l'acquisto e rimette il colore di prima; usare un colore o una forma già comprati non costa niente;
  - livello e riquadro Punti uguali dopo ogni acquisto; dopo il ricaricamento acquisti, saldo e colori restano;
  - un acquisto che questa versione non conosce resta e conta nel saldo; un colore in uso che non risulta comprato torna «Aurora»;
  - backup dal foglio: il file ha la v6, gli acquisti e i colori in uso; il riepilogo conta gli acquisti; importare un backup della v5 li toglie e ripristinare li rimette; la riga delle Impostazioni li conta;
  - aree di tocco di almeno 44 px, nomi interi anche a 320 px, contrasto dei testi del negozio di almeno 4,7 a 1 nei due temi;
  - coriandoli solo con `opacity` e `transform`; con «Riduci movimento» niente coriandoli né animazioni, ma acquisti e avvisi sì.
- Intestazione di Focus a 390×664: 188 px prima e dopo, con 3 card intere, nei due temi.

#### Ripasso con tre skill (20 novembre 2026)
Dopo l'apertura della PR il negozio è stato ripassato con le liste di tre skill che usa il PO: **browser-qa** (prove nel browser), **accessibility** (WCAG 2.2) e **make-interfaces-feel-better** (rifiniture). Strumenti: Playwright 1.63 con Chromium 153 headless, axe-core 4.10.2 con le regole WCAG 2.0, 2.1 e 2.2 di livello A e AA, misure a pixel con Pillow. 63 controlli, tutti superati dopo le correzioni (prima 57). «v18» è la versione pubblicata.

| Misura, contesto «iPhone 13», mediana di 5 prove | v18 | v19 | v18, CPU 4 volte più lenta | v19, CPU 4 volte più lenta |
|---|---|---|---|---|
| LCP all'apertura (soglia 2,5 s) | 120 ms | 132 ms | 340 ms | 368 ms |
| CLS, apertura e gesti (soglia 0,1) | 0 | 0 | 0 | 0 |
| INP, il gesto più lento (soglia 200 ms) | 48 ms | 48 ms | 160 ms | 144 ms |
| comprare un colore (v18: riscattare un premio) | 24 ms | 32 ms | 88 ms | 80 ms |

- La tabella è l'ultima di tre serie, con il codice finale. Da una serie all'altra, con la CPU rallentata, LCP cambia fino a 160 ms e i gesti fino a 40 ms: comprare un colore ha richiesto 80, 112 e 120 ms, riscattare un premio sulla v18 80, 88 e 96. Tutto resta sotto le soglie di web.dev, e i fotogrammi persi non cambiano. Rifatti dopo le correzioni contro la v18 (mediana di 20 prove, CPU 4 volte più lenta; la macchina era più carica, quindi tutti i numeri sono più alti della tabella sopra, per le due versioni): passare a Motivazione 6 → 6, aprire il foglio 2 → 2, comprare un colore 2,5 → 3. Contro il negozio di prima delle correzioni, in 30 prove alternate, comprare un colore perde 3 fotogrammi con tutte e due le versioni (media 3,6 prima e 3,3 dopo).
- Nessun errore in console, in rete o della CSP, da telefono e da computer. A 375, 768 e 1440 px nei due temi niente esce dallo schermo. La scheda Focus e la parte di Motivazione sopra il negozio sono identiche alla v18, pixel per pixel, nei due temi, a 375 e a 1440 px; «I tuoi numeri» scende solo dell'altezza della card nuova.
- axe-core: nessuna violazione nella card, nel foglio e dopo un acquisto, e nessuna nuova in Motivazione rispetto alla v18. axe non sa misurare il contrasto di «Ripara» sul fondo sfumato: misurato a mano, il bianco ha almeno 4,76 a 1 sul colore più chiaro della sfumatura nel tema scuro e 5,30 nel chiaro.
- Tastiera: nella card «Ripara» e poi «Apri il negozio»; Invio apre il foglio con il focus sul titolo; Tab segue l'ordine di lettura (chiudi, «Ripara», i cinque colori, le cinque forme, i tre pacchetti) e non esce dal foglio; ogni elemento ha il contorno del focus (contrasto 6,4 a 1 nel chiaro, 7,7 nello scuro) e non resta coperto, nemmeno dall'avviso; Invio e Spazio comprano e il focus resta sull'oggetto; «Esc» chiude e il focus torna su «Apri il negozio». Con la spaziatura del testo più larga (WCAG 1.4.12) a 320 e 390 px niente si taglia.
- Senza WebKit qui, restano per l'iPhone: VoiceOver che legge «Comprato: …» e il contorno nuovo delle anteprime.

Cosa è cambiato:

| Regola | Prima | Dopo |
|---|---|---|
| Regione live dell'avviso | l'avviso (`role="status"`) entrava nel foglio insieme al primo messaggio: VoiceOver può non leggere una regione live che compare già piena | entra nel foglio appena si apre (`hostToast`), prima dei messaggi |
| Avviso mentre il foglio si chiude | dentro il foglio scendeva con lui e poi ricompariva 124 px più in alto | torna subito nella pagina e resta fermo al suo posto |
| Area di tocco di «Annulla» nell'avviso | 81 × 36 px | 93 × 48 px con uno pseudo-elemento, stesso aspetto; vale per tutti gli avvisi |
| Angoli concentrici | anteprima con raggio 10 in un oggetto da 16, a 9 px dal bordo; «Ripara la serie» con raggio 14 intorno a icona e pulsante da 12, a 10 px | anteprima 7 (pacchetti 9); il riquadro 20, come la card che lo contiene (il valore esatto sarebbe 22) |
| Testi a capo | una parola sola sull'ultima riga: «Focus.» a 375 e 390 px, «fila.» a 360 e 375, «serie»», «acquisti.» e «punti» dei pacchetti a 320 | `text-wrap: balance` sui titoli e `pretty` sulle note; nomi dei pacchetti a 13 px sotto i 360 px: nessuna da 320 a 414 px |
| Prezzi in una riga di oggetti | con un nome su due righe, il prezzo di quell'oggetto scendeva più degli altri | lo stato sta in fondo all'oggetto (`grid-template-rows: auto 1fr auto`): prezzi allineati |
| Contorno delle anteprime dei colori | nel tema scuro la parte alta aveva un contrasto di 1,03–1,08 a 1 con l'oggetto, e il bordo si perdeva | contorno neutro di 1 px dentro il bordo (`--preview-edge`, nero o bianco al 10%), anche sui cinque cerchi della card |

Controllati e lasciati come erano: cifre tabellari su saldo, prezzi e «Ripara · 150 ★»; icone centrate (fiamma e freccia entro mezzo pixel); niente `transition: all` né `will-change: all`.

### P-004, passo 4.2: musica senza account
In Focus, sotto «Cosa faccio adesso?», l'avviso «Musica mentre ti concentri?» oppure il carosello «Musica per concentrarti»; nelle Impostazioni la riga «Musica»; nel focus a tutto schermo il pulsante «🎧». È il passo 4.2 di [P-004](../../docs/proposte/P-004.md) e le regole stanno in [musica.md](musica.md). L'ha scritto Claude Project, come prevede la tabella «Ordine» della proposta.

Una lettura da segnalare: la proposta dice «una riga … con «Scegli» e ×». Qui «Scegli» è tutta la riga, con il titolo «Scegli il tuo servizio», come la striscia «Cosa faccio adesso?», perché un pulsante in più a 320 px tagliava il testo. Il comportamento è quello della proposta.

#### Risultati del passo 4.2 (20 novembre 2026)
Fotogrammi persi, mediana di 10 prove, contesto «iPhone 13» in Chromium 153 headless, tema chiaro, con le attività di prova. «main» è la versione pubblicata (v18); «avviso» e «carosello» sono la v20, senza un servizio scelto e con Spotify. WebKit non è stato eseguito: in questo ambiente non c'è.

| Gesto | CPU 4 volte più lenta: main · avviso · carosello | Piena velocità: main · avviso · carosello |
|---|---|---|
| completare la prima attività in Focus | 7,5 · 7 · 9 | 0 · 0 · 0 |
| passare ad Agenda e tornare a Focus | 7 · 7 · 9 | 1 · 1 · 0 |
| aprire le Impostazioni | 3 · 3,5 · 4 | 0 · 1 · 1 |
| la × dell'avviso, che apre «Quando te lo ricordo?» | — · 2 · — | — · 0 · — |
| «Tra 3 giorni»: l'avviso esce e le card salgono | — · 2,5 · — | — · 0 · — |
| «Nascondi», poi «Mostra» | — · — · 1 e 1 | — · — · 0 e 0 |

- In questa serie il carosello, con la CPU rallentata, perdeva 1,5 o 2 fotogrammi in più completando e cambiando scheda. Per cercarne la causa, una seconda serie, con 12 prove alternate per variante (completare, poi cambiare scheda): main 7 e 7; carosello 6 e 6,5; senza emoji 8 e 6; con la lista che non scorre 7 e 6; con `contain` sul carosello 8 e 7; senza card 8 e 6; ridotto 6 e 6. In questa seconda serie nessuna variante si stacca da main. Una terza serie, di 20 prove alternate: main 6 e 5, avviso 6 e 7, carosello 8 e 7. La traccia di Chromium spiega da dove viene la differenza, quando c'è: dopo una spunta il numero dei punti conta per 600 ms, e a ogni fotogramma la pagina si ricalcola tutta. Il carosello aperto aggiunge circa 75 elementi da ricalcolare (510 invece di 435), quindi ogni fotogramma costa un po' di più: con la CPU rallentata il calcolo della pagina passa da 0,76 a 0,93 ms a fotogramma, e il lavoro del thread principale in tutto il gesto da 544 a 580 ms (mediana di 5 tracce). Con il carosello ridotto non cambia niente (546 ms); senza le emoji costa come con le emoji. Con la CPU rallentata vale da 0 a 2 fotogrammi persi in più, secondo la serie; a piena velocità meno di 0,2 ms a fotogramma. Un miglioramento possibile, fuori da questo passo: far contare i punti senza ricalcolare tutta la pagina a ogni fotogramma.
- A piena velocità nessun gesto perde più di un fotogramma, con le tre versioni. La prova vera è quella sull'iPhone.
- Prove di funzionamento, con Playwright 1.63 e l'orologio finto, a 390×664 nei due temi, da 320 a 1440 px, con «Riduci movimento» e aprendo `index.html` da file (134 controlli, tutti superati; nessun errore nella console né messaggi della CSP; nessuno scorrimento di lato):
  - l'avviso alla prima apertura, solo con la striscia: niente senza attività, in Agenda, in Motivazione e nel focus a tutto schermo;
  - «Quando te lo ricordo?» con le quattro date giuste e il focus sul titolo; Esc chiude senza cambiare niente e il focus torna sulla ×; «Tra una settimana» con l'avviso in basso, «Annulla» e il focus sulla striscia; «Annulla» rimette l'avviso; il rimando resta dopo una ricarica; l'avviso torna il giorno del rimando e dopo, non prima, e mai con «Non ricordarmelo più»;
  - la riga dell'avviso apre le Impostazioni sulla riga «Musica», in vista, con il focus sulla prima scelta; frecce e tocchi cambiano servizio e frase; il carosello ha le cinque playlist giuste per ognuno dei tre servizi, https e senza parametri, con il nome e `rel`; «Nessuno» toglie avviso, carosello e «🎧», anche dopo una ricarica;
  - «Nascondi» e «Mostra» con `aria-expanded`, la scelta che resta dopo una ricarica e il focus sul pulsante; la card Jazz apre la sua playlist in un'altra scheda e «🎧» la ricorda («Musica: Jazz nell'app Spotify»), con 44 px e senza coprire il titolo;
  - tastiera: dopo la striscia la riga e poi la ×; nel carosello «Nascondi» e le cinque card in ordine; ogni anello del focus intero e ogni card dentro lo schermo;
  - nove larghezze (320, 375, 390, 402, 414, 430, 768, 1024 e 1440 px), con l'avviso e con i tre servizi: aree di tocco di almeno 44 px, testi interi, contrasto dei testi di almeno 4,73 a 1 nel tema chiaro e 4,8 nello scuro;
  - con «Riduci movimento» niente si muove; da `file://` tutto funziona; il file del backup non contiene la musica, che resta nelle preferenze; CSP uguale a main.
- Intestazione di Focus a 390×664: 188 px in tutti i casi, come main. Card intere sopra la barra: 3, come main, con l'avviso, con il carosello ridotto e con «Nessuno»; 2 con il carosello aperto.
- Prima di aprire la PR, ripasso con le liste delle tre skill del PO: **browser-qa**, **accessibility** e **make-interfaces-feel-better**. axe-core 4.10.2 (WCAG 2.0, 2.1 e 2.2, A e AA, e best practice) non trova violazioni su Focus con l'avviso, «Quando te lo ricordo?», Impostazioni prima e dopo la scelta, carosello aperto e ridotto, focus a tutto schermo con «🎧», nei due temi.

Cosa è cambiato durante il ripasso:

| Regola | Prima | Dopo |
|---|---|---|
| Titolo del carosello a 320 px | «Musica per concentrarti» si tagliava | va su due righe, dentro i 44 px della riga |
| «Amazon Music» nella card | si tagliava, accanto alla freccia del link | la freccia sta in alto a destra nella card e il nome è intero |
| La fila che continua | a 414 px non si vedeva che la fila continua e si può scorrere | le card si adattano allo schermo (da 120 a 160 px): due intere e metà della terza a ogni larghezza |
| Oltre 640 px | le card si tagliavano a metà pagina | cinque in fila, larghe quanto la lista delle attività |
| Anello del focus delle card | tagliato di 2 px in alto dalla lista che scorre | la lista ha 4 px sopra e sotto |
| Tastiera nel carosello | la terza card, col focus, restava a metà fuori dallo schermo | la card col focus scorre tutta dentro lo schermo |

## Navigazione
- **Barra delle schede** in basso: **Focus**, **Agenda**, **Motivazione**.
  - Ogni scheda ha icona e testo; aree di tocco ≥ 44 px; margine sotto con `env(safe-area-inset-bottom)`.
  - Un **indicatore**, una pillola tenue dietro la scheda attiva, scivola sulla scheda scelta con `transform`. Da P-003 (passo 3.1) si allunga mentre scivola e si ferma con un piccolo rimbalzo; l'icona della scheda aperta fa un gesto (gli anelli di Focus pulsano, il calendario fa un salto, la medaglia oscilla).
  - È un `<nav>` con tre pulsanti (`aria-current="page"` su quello attivo). Le schede sono tre `<section>`; quelle non attive hanno `hidden`.
- **Cambio di scheda** (da P-003, passo 3.1: un movimento d'insieme, solo `transform` e `opacity`; con «Riduci movimento» niente):
  - **l'intestazione si allunga o si accorcia** con un movimento invece che di colpo. Il suo sfondo è un livello a parte (`.hero__bg`) che sale 640 px sopra l'intestazione e ne segue il fondo: quando l'altezza cambia, scivola dalla vecchia posizione alla nuova (`Aura.motion.shiftIn`, in `--dur-tab`), con `will-change` solo durante il movimento;
  - **ogni scheda ha il suo bagliore**: Focus ciano e rosa (come prima), Agenda azzurro e lilla, Motivazione oro e rosa. Sono tre livelli dentro lo sfondo che sfumano con `opacity` (`.hero[data-tab]`); i colori sono token nei due temi;
  - **il contenuto entra a blocchi**, uno dopo l'altro, con una dissolvenza e un leggero scorrimento (24 px) nella direzione del cambio (`Aura.motion.staggerIn`). Un blocco è un figlio della scheda (la striscia, una sezione, «Completate»…), mai una card; si animano solo quelli che si vedono, al massimo 5 gradini a 55 ms. Il contenuto dell'intestazione sfuma;
  - ogni scheda ricorda dov'era arrivato lo scorrimento; la vecchia sparisce subito. Un tocco sulla scheda già aperta riporta in cima.
- **All'apertura** l'app parte da **Focus**. Se si ricarica entro 30 minuti dall'ultimo uso (su iPhone succede spesso tornando dallo sfondo), riparte dall'ultima scheda.
- **Intestazione "aura"** in tutte le schede, con logo, campanella e tema. In Agenda e Motivazione è più bassa. Da P-002 (passo 1) al posto del pulsante del tema c'è la rotella delle Impostazioni, e il tema si sceglie lì (vedi [impostazioni.md](impostazioni.md)).
- «+ Nuova attività» e gli avvisi stanno sopra la barra.

## Focus: per fare
- **In cima**, «Cosa faccio adesso?». Poi **In ritardo**, **Oggi** (in ordine d'ora) e **Senza data**. In fondo, «Completate oggi», chiusa.
- **Intestazione**, compatta (sotto i 220 px su iPhone 13): saluto, data e i riquadri "Da fare", "Tempo" e "Fatte oggi" in una riga sola, con etichetta e valore affiancati.
- **Serie e punti** restano visibili in piccolo, in due chip nella riga del saluto (fiamma con i giorni, stella con i punti), con gli effetti di sempre. Un tocco porta a Motivazione.
- **Musica** (P-004, passo 4.2; vedi [musica.md](musica.md)): sotto «Cosa faccio adesso?», senza un servizio scelto, l'avviso «Musica mentre ti concentri?», che si rimanda; con un servizio, il carosello «Musica per concentrarti», che si riduce a una riga. Solo quando c'è la striscia.
- **Niente ▶ sulle card**: toglierebbe spazio al titolo. Il focus si avvia dal foglio «Modifica attività» o dalla proposta di «Cosa faccio adesso?».
- Nelle card di oggi l'ora già passata è in rosso, come «Ieri».

### «Cosa faccio adesso?»
- Un pulsante in cima a Focus, largo quanto la lista e a cavallo del bordo dell'intestazione, apre un foglio con due domande:
  - "Quanto tempo hai?", con i chip 10/15/30/45/60/90/120+ («120+» vuol dire nessun limite; nello sfruttamento del tempo conta come 120);
  - "Come ti senti?", con energia bassa/media/alta.
- Ricorda l'ultima scelta (`aura-tasks:prefs`); la prima volta propone 30 minuti ed energia media.
- La proposta compare subito sotto le domande e si aggiorna a ogni scelta. Sotto ci sono due alternative: un tocco ne fa la proposta principale.
- Il pulsante è nascosto quando non c'è niente da fare adesso.
- **Striscia** (passo 1 dell'assistente, vedi [assistente.md](assistente.md)): il pulsante ha due righe, «Cosa faccio adesso?» e sotto il titolo dell'attività proposta, calcolata senza il pizzico di caso; senza proposta dice «Una pausa ☕?».
  - Toccandola, il foglio si apre sulla **stessa attività**, con lo stesso motivo: `openSuggest({ taskId, reason })` la passa a `suggest()` come `first`. Le due alternative sono le migliori delle altre.
  - Il caso torna solo con «Un'altra proposta». Se nel frattempo l'attività è stata completata o eliminata, il foglio ricalcola.
- **Algoritmo**: funzione pura `suggest(tasks, { minutes, energy, today, now, exclude, first, random })` in `js/suggest.js`. `now` è l'istante attuale in millisecondi.
  - `candidates(tasks, { minutes, energy, today, now })` restituisce tutte le candidate, senza caso. La usa `suggest()`, e l'assistente per controllare una proposta dell'IA.
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
- **«🎧»** (P-004, passo 4.2): con un servizio scelto, in alto a destra, apre la playlist dell'ultimo umore (vedi [musica.md](musica.md)). Il tempo continua a contare nell'altra app.
- **«Suono»** (P-004, passo 4.4): in alto a sinistra, di fronte a «🎧» e uguale a lui. Il menu sceglie tra i suoni che hai (Silenzio, Rumore marrone, e Pioggia e Onde se comprate): il suono in uso suona mentre il tempo conta e si ferma in pausa, a tempo finito, all'uscita e con Aura in secondo piano. Con il menu aperto Esc chiude il menu, non il focus. Vedi [suoni.md](suoni.md).
- **Uscita**: Esc, il gesto "indietro" ed "Esci" chiudono la sessione. L'avviso "Focus terminato · 12 min" ha "Annulla", che la riapre com'era e toglie i minuti.
- **Sfondo: l'aurora** (da [P-003](../../docs/proposte/P-003.md), passo 3.1; prima erano due bagliori che respiravano): quattro fasce di luce (verde acqua, ciano, rosa, lilla) che scorrono piano, ognuna con la sua durata (da 13 a 29 secondi), e due livelli di stelline che brillano. Si muovono solo con `transform` e `opacity`.
  - **Sale con il tempo**: all'inizio sta in basso (16% dello schermo), alla fine riempie lo schermo. Lo spostamento lo calcola `Aura.focus.auroraRise()` e si aggiorna una volta al secondo, insieme all'anello, a passi che a occhio non si vedono. Con «+5 min» scende un poco.
  - **Allo scadere** si apre un bagliore, una volta sola (`Aura.motion.flash`), con il suono di fine; poi tutto si ferma.
  - È l'**unica animazione continua** dell'app, un'eccezione a "mai infinite": gira solo mentre il foglio è aperto, la pagina è visibile e il tempo scorre. Si ferma in pausa e alla fine del tempo (`.is-breathing`, il nome di prima).
  - Con «Riduci movimento» l'aurora c'è, ferma: lo stato di riposo di ogni livello è il primo fotogramma della sua animazione.
  - Le fasce sono disegnate piccole (30vmax di larghezza) e ingrandite con `scale`, come i bagliori di prima: occupano molta meno memoria. I colori sono uguali nei due temi, perché il fondo del focus è sempre viola.
  - **Si ferma da sola dove pesa troppo**: dopo l'apertura `ui-focus.js` guarda 24 fotogrammi (`watchBreath()`); se più della metà dura oltre 45 ms, l'aurora resta ferma per il resto della sessione.
- **Schermi bassi**: l'anello si adatta all'altezza (38vh). Sotto i 700 px di altezza (iPhone SE, Safari con le sue barre) tutto è più raccolto e il titolo sta su due righe: titolo, anello e comandi stanno in una schermata da 320×568 in su. In orizzontale i comandi si raggiungono scorrendo.
- **Schermata ferma** (16 novembre 2026, cache v13; **da verificare sull'iPhone**): quando titolo, anello e comandi ci stanno tutti, un dito che trascina non muove niente.
  - **Il difetto** (prova sull'iPhone del 16 novembre): trascinando verso il basso, sul bordo destro si vedeva muoversi la barra di scorrimento. Nel foglio non c'era niente da scorrere: nelle misure a 390×844 con i margini di iPhone 13 avanzano almeno 66 px, anche con il titolo su tre righe. Quindi scorreva la pagina rimasta dietro: è una deduzione, sull'iPhone non si è potuto misurare.
  - **La correzione**: `ui-focus.js` confronta l'altezza del contenuto con quella che si vede (`syncStatic()`, con `Aura.focus.fitsWithoutScroll`) e mette `.is-static` sul foglio. Lì il CSS toglie lo scorrimento con il dito: `touch-action: pinch-zoom`, scritto anche su `.focus`, perché un contenitore che può scorrere non eredita il divieto da chi lo contiene. Lo zoom con due dita resta.
  - Le misure si ricontrollano da sole quando cambia lo schermo (rotazione) o il contenuto (titolo lungo, pulsanti a tempo finito), con un `ResizeObserver`.
  - Se il contenuto non ci sta (telefono in orizzontale), `.is-static` non c'è e i comandi si raggiungono scorrendo, come prima.
  - **Perché non bastava il blocco dei fogli**: `html.is-locked` (`overflow: hidden`) ferma la pagina in Chromium, e lì la ferma anche `overscroll-behavior: contain` del foglio. Sull'iPhone, a giudicare dalla prova, la pagina scorreva lo stesso. `touch-action` agisce prima, sul gesto, qualunque cosa stia per scorrere.
  - **Prove nel browser** (Chromium 153 «iPhone 13», tocchi veri): tolte a mano le due protezioni, prima della correzione la pagina dietro si muove (da 150 px a 0, poi a 555), dopo resta a 150 px, a 390×844, 390×664 e 320×568. I pulsanti rispondono, in orizzontale il foglio scorre, ruotando la classe segue lo schermo. In WebKit non è stato provato.
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
  - Lo stesso `AudioContext` suona i suoni del focus (passo 4.4): il suono in uso se ne va in 0,6 s mentre arriva il suono di fine, e torna con «+5 min».
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
Da [P-003](../../docs/proposte/P-003.md), passo 3.2 (v16): un calendario, con il giorno scelto sotto. Immagini della proposta: [mese](../../docs/proposte/P-003/anteprima-agenda.jpg) e [settimana](../../docs/proposte/P-003/anteprima-agenda-settimana.jpg).

- **Calendario**, in un riquadro a cavallo del bordo dell'intestazione (`.cal`), come la striscia di Focus:
  - in alto il mese e l'anno, «Oggi» e le frecce. «Oggi» compare quando il giorno scelto non è oggi o si guarda un altro mese, e riporta a oggi;
  - le frecce portano al mese prima e dopo; anche scorrendo di lato con il dito (almeno 40 px, e più di lato che in verticale). Nel mese nuovo il giorno scelto è oggi, se è il mese di oggi, altrimenti il primo del mese;
  - settimane da lunedì; i giorni degli altri mesi restano vuoti; un mese ha da 4 a 6 righe;
  - oggi ha l'anello; il giorno scelto è pieno, del colore dell'accento; i giorni passati hanno il numero più tenue;
  - sotto ogni giorno fino a tre puntini, uno per attività da fare, del colore della sua energia; nei giorni passati sono rossi (in ritardo).
- **Maniglia** in fondo al calendario: «Solo la settimana» lo riduce alla settimana del giorno scelto, e allora frecce e dito spostano il giorno scelto di 7 giorni; «Tutto il mese» lo riapre. All'inizio si vede il mese; la scelta si ricorda.
- **Il giorno scelto**, sotto il calendario:
  - il titolo («Oggi · giovedì 19 novembre»; «Domani · …» e «Ieri · …»; l'anno solo se non è quello di oggi), quante attività da fare e quanto tempo; nei giorni passati anche quante completate;
  - «In giornata»: le attività senza orario, prima quelle da fare, poi in ordine di creazione;
  - «Con orario»: in ordine d'ora, con l'ora a sinistra, rossa se oggi è già passata. Le card sono quelle di sempre, senza l'ora dentro;
  - tra due attività, se c'è almeno mezz'ora libera, una riga «Libero dalle 09:30 alle 11:30 · 2 h» con un «+» che apre «Nuova attività» con il giorno e l'ora già scritti. Lo spazio comincia quando sono finite tutte le attività prima;
  - oggi gli spazi liberi contano da adesso (arrotondato ai 5 minuti dopo), e una linea rossa segna l'ora. La linea avanza ogni minuto; le righe si ridisegnano solo se cambiano (lo spazio libero si accorcia, la linea passa un'attività), e il pulsante che ha il fuoco lo tiene;
  - se un'attività comincia prima che finisca una di quelle prima, sotto il titolo c'è «Si sovrappone a «…»». Un'attività che finisce dopo mezzanotte conta fino alla sua fine;
  - un giorno passato mostra le attività rimaste da fare (in ritardo) e quelle completate quel giorno, barrate, senza spazi liberi né sovrapposizioni. Una completata senza giorno conta nel giorno in cui è stata completata;
  - un giorno senza niente dice «Giornata libera. Con «Nuova attività» aggiungi qualcosa per oggi.» (o per quel giorno); un giorno passato, «Nessuna attività in questo giorno.».
- **«Prossimi giorni»**: tutte le attività da fare da domani in poi, in ordine di data e ora, con la data su ogni card, tranne quelle del giorno scelto, che stanno già sopra. Così nessuna attività lontana resta nascosta.
- **«Da pianificare»**: le attività senza giorno, in ordine di creazione, ognuna con «Metti a gio 26» (il giorno scelto: anche «Metti a oggi», «Metti a domani»). Con un giorno passato scelto il pulsante non c'è. L'avviso «Pianificata per …» ha «Annulla».
- Le due liste spariscono quando sono vuote.
- Il pulsante **«Nuova attività»** propone il giorno scelto, se non è passato. Se un'attività aggiunta o modificata finisce dove l'Agenda non la mostra (per esempio oggi, con domani scelto), l'avviso dice in quale scheda è, come tra le altre schede.
- **Movimenti** (solo `transform` e `opacity`; con «Riduci movimento» niente): cambiando mese o settimana il calendario nuovo entra di lato, dalla parte verso cui si va; il giorno scelto sfuma; «Prossimi giorni» e «Da pianificare» scivolano al posto nuovo. Con la maniglia il contenuto sotto scivola alla nuova altezza e i giorni sfumano.
- **Accessibilità**:
  - i giorni sono pulsanti; il lettore di schermo dice la data, «oggi» e quante attività («Giovedì 19 novembre, oggi, 3 attività»; «…, 2 attività in ritardo»; «…, libero»). Il giorno scelto ha `aria-pressed="true"`; le caselle vuote sono nascoste al lettore;
  - con la tastiera il calendario è un solo passo di Tab (il giorno scelto); le frecce si spostano di un giorno o di una settimana, Invio o Spazio sceglie. Oltre il bordo si passa al mese o alla settimana accanto, come con le frecce in alto, e il fuoco segue;
  - il mese nuovo viene annunciato (`aria-live="polite"`); la maniglia ha `aria-expanded`; le frecce dicono se cambiano mese o settimana;
  - la linea dell'ora si legge «Adesso, 11:07»; un'ora passata «In ritardo, era alle 09:00»; il «+» «Aggiungi un'attività alle 11:10»; «Metti a…» dice anche il titolo dell'attività.
- **Dati**: niente di nuovo, solo la scelta mese o settimana in `prefs.agendaView` (vedi "Dati"). Il giorno scelto non si salva: all'apertura è oggi e, se è oggi, a mezzanotte passa al giorno nuovo.
- **Codice**: la logica pura sta in `js/agenda.js` (`Aura.agenda`), con 16 test in `tests/agenda.test.js`: griglia del mese (4, 5 e 6 righe, febbraio bisestile, giorni del cambio d'ora), puntini e settimana del giorno scelto, frecce, giorno diviso tra senza orario e con orario, spazi liberi (anche con «adesso» in mezzo e dopo mezzanotte), sovrapposizioni, «Prossimi giorni» e «Da pianificare», frasi. La pagina la scrive `js/ui-agenda.js` (vedi "Codice").

### Il piano di prima, per memoria
Non realizzato: P-003 lo ha sostituito (vedi «Rapporto con il piano di prima» nella proposta).

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
**Sostituita da [P-003](../../docs/proposte/P-003.md), passi 3.3–3.5**: vale quella. Qui resta il piano di prima, per memoria; P-003 riprende i livelli, l'obiettivo settimanale, i minuti di focus, lo storico, «mai sensi di colpa» e l'invito al backup.

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
- **Invito al backup**: non si fa. Il Product Owner, il 20 novembre 2026, ha scelto che i dati passino da un telefono all'altro con l'account Google o un account di Aura (vedi [P-005](../../docs/proposte/P-005.md), «Decisioni di prodotto»).
- La logica pura sta in `js/motivation.js`: obiettivo, calendario, minuti, frase del giorno.

## Dati
- **Minuti di focus**: `stats.focus = { 'YYYY-MM-DD': minuti }`, una mappa del registro separata da `days`. Così le regole della serie non cambiano, e i minuti finiscono anche nel backup.
  - **Schema v4** (fase 2a): `migrate()` cambia solo il numero di versione.
  - `sanitizeStats()` aggiunge `focus: {}` e scarta giorni non validi e minuti non interi o fuori da 1–1440 (`Aura.focus.sanitizeMinutes`).
  - `emptyStats()` parte con `focus: {}`, quindi anche `rebuildStats()`.
  - I backup della v1, v2 e v3 si importano ancora: passano dalle stesse migrazioni.
- **Preferenze**: `aura-tasks:prefs = { lastTab, lastTabAt, suggest: { minutes, energy }, agendaView, weeklyGoal, music }`.
  - `agendaView` (P-003, passo 3.2): `'month'` o `'week'`, la vista del calendario dell'Agenda; un valore diverso torna `'month'`.
  - `weeklyGoal` (P-003, passo 3.3): l'obiettivo della settimana, 5, 10, 15, 20, 30 o 50 attività, oppure `null` (all'inizio); un valore diverso torna `null`.
  - `music` (P-004, passo 4.2): `{ service, remind, mood, folded }`, il servizio scelto, il rimando dell'avviso, l'ultimo umore e il carosello ridotto (vedi [musica.md](musica.md), «Dati»).
  - È senza versione, come `aura-tasks:remote`, e fuori dal backup, come il tema.
  - La scrive e la legge solo `js/storage.js` (`loadPrefs()` e `savePrefs()`). `sanitizePrefs()` pulisce i valori e conserva i campi sconosciuti.
  - `suggest.minutes` è una delle scelte del foglio; `null` vuol dire «120+».
- **Focus in corso**: `aura-tasks:focus` (vedi "Tempo affidabile"). Lo scrive e lo legge solo `js/storage.js` (`loadFocus()`, `saveFocus()`, `clearFocus()`); lo pulisce `Aura.focus.sanitizeSession()`. È fuori dal backup.
- **Livello**: si calcola dai punti, non si salva.
- **Premi** (P-003, passo 3.4; regole in [punti-e-serie.md](punti-e-serie.md), «Premi»): `rewards`, accanto a `tasks`, e i riscatti in `stats.spent`.
  - **Schema v5**: `migrate()` cambia solo il numero di versione; `fromData()` aggiunge `rewards: []` e `sanitizeStats()` aggiunge `spent: []`, puliti da `Aura.rewards.sanitizeRewards()` e `sanitizeSpent()`.
  - Il saldo da spendere si calcola, non si salva: `totalPoints` meno i riscatti, mai sotto zero.
  - I backup di tutte le versioni di prima si importano ancora; premi e riscatti finiscono nel backup.
- **Negozio** (P-004, passo 4.1; regole in [punti-e-serie.md](punti-e-serie.md), «Negozio»): gli acquisti in `stats.shop` e quello che è in uso in `look`, accanto a `tasks` e `rewards`.
  - **Schema v6**: `migrate()` cambia solo il numero di versione; `sanitizeStats()` aggiunge `shop: []` e `fromData()` aggiunge `look` con «Aurora» e «Classici», puliti da `Aura.shop.sanitizeShop()` e `sanitizeLook()`.
  - Il saldo da spendere toglie anche gli acquisti; i giorni riparati contano per la serie, il record e i traguardi, non per i punti.
  - I backup di tutte le versioni di prima si importano ancora; acquisti e `look` finiscono nel backup.
- **Attività che si ripetono** (P-005, passo 5.1; regole in [ripetizioni.md](ripetizioni.md)): in ogni attività `repeat` (la regola, oppure `null`) e `seriesId` (lo stesso in tutte le volte di una serie).
  - **Schema v7**: `migrate()` cambia solo il numero di versione; `sanitizeTask()` aggiunge `repeat: null` e `seriesId: null`, puliti da `Aura.repeat.sanitize()`. Le attività che c'erano non si ripetono.
  - Una sola volta da fare per serie: in Focus o in Agenda si vede come ogni attività, con ↻ sulla card.
  - I backup di tutte le versioni di prima si importano ancora; regole e serie finiscono nel backup.
- **Sfide di oggi** (P-003, passo 3.5; regole in [punti-e-serie.md](punti-e-serie.md), «Sfide di oggi»): le sfide di ogni giorno in `stats.challenges`: i 30 giorni più recenti e quelli più vecchi che si possono ancora disfare, al massimo 400.
  - **Schema v8**: `migrate()` cambia solo il numero di versione; `sanitizeStats()` aggiunge `challenges: {}`, pulito da `Aura.challenges.sanitize()`. Quelle di oggi nascono alla prima apertura.
  - I loro punti stanno in `totalPoints`, come quelli dei completamenti: entrano quando una sfida diventa fatta, escono quando torna da fare.
  - I backup di tutte le versioni di prima si importano ancora; le sfide finiscono nel backup.

## Collegamenti e notifiche
- `?add=`, casella di Siri, promemoria, modifica e backup restano come oggi. Il foglio "Nuova attività" si apre sopra la scheda in cui si è.
- **Notifica toccata** (`?task=id` o messaggio `open-task`): `showTask(id)` apre la scheda in cui l'attività si vede, la porta in vista e la evidenzia:
  - In ritardo, Oggi o Senza data → Focus;
  - un giorno futuro → Agenda: nel giorno scelto, se è quello, altrimenti in «Prossimi giorni»;
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
| Fogli "Nuova attività" / "Modifica attività", "Tema", "Promemoria e Siri", "Backup dei dati" | Invariati, sopra qualsiasi scheda. Da P-002 il tema si sceglie nel foglio «Impostazioni» |
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
- Nell'app ci sono `suggest-none` ed `empty-focus`, dalla fase 2a, e i distintivi dei livelli 1, 2, 3, 5, 6 e 7, dal passo 3.3 di P-003. Stella ha un distintivo disegnato finché `level-4-star` non è rifatta.
- Dove un'immagine non è ancora entrata, l'app usa le icone (distintivi) o uno stato vuoto di solo testo.

## Premium
Le categorie stanno nella tabella di `CLAUDE-GUIDE.md`:
- **gratuite**: animazioni, barra delle schede, Focus, Agenda e la base di Motivazione, perché ci finiscono funzioni di oggi;
- **da decidere**: «Cosa faccio adesso?», timer e minuti di focus, livelli, obiettivo settimanale, calendario, frase del giorno, illustrazioni, «I tuoi premi», «Sfide di oggi».

## Codice
- **Moduli puri nuovi**:
  - `js/suggest.js` e `js/focus.js` (fase 2);
  - `js/agenda.js` (P-003, passo 3.2, al posto della fase 3);
  - `js/motivation.js` (P-003, passo 3.3), con `LEVELS` e il calcolo del livello, Aurora 2, 3… compresi: P-003 li mette qui e non in `js/points.js`, che resta com'è;
  - `js/rewards.js` (P-003, passo 3.4): premi, saldo, riscatti e «Annulla», limiti, pulizia dei dati letti;
  - `js/challenges.js` (P-003, passo 3.5): come nascono le sfide, quando sono fatte e quando non lo sono più, i loro punti, la pulizia dei dati letti, i testi della card e dell'avviso.
- `js/motion.js` (fase 1) tocca la pagina solo per le animazioni. `slideIn()` (fase 2a) fa entrare un blocco intero; da P-003 (passo 3.1) la scheda entra a blocchi con `staggerIn()` e lo sfondo dell'intestazione scivola con `shiftIn()`.
- Ogni scheda può avere un suo file che tocca la pagina, come `app.js`: così `app.js` non cresce troppo.
  - `js/ui-focus.js` (fase 2a): i fogli «Cosa faccio adesso?» e Focus, il suono di fine e lo schermo acceso. `app.js` gli passa con `Aura.focusUI.init()` quello che gli serve: stato, `commit()`, fogli, avvisi, preferenze.
  - `js/ui-agenda.js` (P-003, passo 3.2): calendario, giorno scelto, «Prossimi giorni», «Da pianificare», gesti e movimenti dell'Agenda. Tiene il giorno scelto; `app.js` gli passa con `Aura.agendaUI.init()` stato, `commit()`, la card (`buildTask()`), avvisi, il foglio «Nuova attività» e le preferenze, e ogni minuto chiama `tick()` per la linea dell'ora. `isVisible()` dice ad `app.js` se un'attività si vede nell'Agenda (dipende dal giorno scelto), `addPreset()` che giorno propone «Nuova attività».
  - `js/ui-motivation.js` (P-003, passo 3.3): nell'intestazione il livello, poi «La tua settimana» con il cielo e l'obiettivo, «I tuoi numeri» e i movimenti della scheda. `app.js` gli passa con `Aura.motivationUI.init()` stato e preferenze e sapere se la scheda è aperta; disegna lui «Completate». `celebrate()` dice ad `app.js` se un completamento ha fatto salire di livello o raggiungere l'obiettivo, e `app.js` sceglie l'avviso.
  - `js/ui-rewards.js` (P-003, passo 3.4): «I tuoi premi» e il foglio del premio. `app.js` gli passa con `Aura.rewardsUI.init()` stato, `commitState()` (salva solo le parti di `state` che cambiano: `rewards` o `stats`), avvisi, fogli e coriandoli; `celebrate()` dice ad `app.js` quale premio un completamento ha reso riscattabile.
  - `js/ui-challenges.js` (P-003, passo 3.5): la card «Sfide di oggi». `app.js` gli passa con `Aura.challengesUI.init()` lo stato e sapere se la scheda è aperta, chiama `render()` a ogni disegno e `tick()` ogni minuto. Le sfide nascono e cambiano in `app.js` (`withChallenges()` in `commitState()`, `keepChallenges()` fuori), che sceglie anche l'avviso.
- Ogni file nuovo va in `index.html`, in `tests/index.html` se ha logica pura, e in `APP_FILES` di `sw.js`.
