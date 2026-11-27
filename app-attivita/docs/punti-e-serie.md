# Punti e serie di giorni (realizzata, gratuita)

**Obiettivo**: motivare con piccole ricompense quotidiane. La logica pura sta in `js/points.js` e le regole in `POINTS`.

**Punti**
- Formula: `Math.round((10 + Math.min(durata, 120) / 5) × moltiplicatore)`, con moltiplicatore 1 per energia bassa, 1,5 per media e 2 per alta.
  - 15 min bassa → 13; 30 min media → 24; 60 min alta → 44; 120 min alta → 68.
- Al completamento i punti si salvano su `pointsAwarded`.
- "Annulla", o togliere la spunta, sottrae gli stessi punti dal giorno in cui erano stati dati: spuntare e togliere la spunta non fa accumulare.
- Eliminare un'attività completata o usare "Svuota" **non** toglie punti.
- **Attività che si ripetono** (P-005, passo 5.1; vedi [ripetizioni.md](ripetizioni.md)): ogni volta completata dà i suoi punti come un'attività qualsiasi. «Salta questa volta» non dà punti e non conta per la serie; «Annulla» dopo un completamento toglie i punti e anche la prossima.
- **Scorrimento sulle card** (P-005, passo 5.2; vedi [scorrimento.md](scorrimento.md)): completare scorrendo verso destra è come la spunta, con gli stessi punti, la stessa festa e lo stesso «Annulla».

**Serie**
- È il numero di giorni consecutivi con almeno un completamento, contati all'indietro da oggi. Un giorno riparato nel negozio conta come un giorno con completamenti (vedi «Negozio»).
- Se oggi non c'è ancora nessun completamento si parte da ieri: la serie resta "viva", ma "da accendere", fino a mezzanotte.
- Il record (`bestStreak`) è la serie più lunga del registro.

**Traguardi**
- A 3, 7, 14, 30 e 100 giorni partono coriandoli, un avviso festoso e, su Android, una vibrazione.
- Succede una volta sola per traguardo (`stats.milestones`).

**Interfaccia**
- Serie e punti si vedono in due posti, con gli stessi effetti: in piccolo nell'intestazione di Focus (due chip: fiamma con i giorni, stella con i punti; un tocco porta a Motivazione) e in grande nell'intestazione di Motivazione, con i due riquadri qui sotto.
- Riquadro "Serie" (vedi "Design" in `CLAUDE-GUIDE.md`):
  - giorni e fiamma;
  - etichetta "🏆 record N", oppure "🏆 record!" quando la serie in corso è il record, da 3 giorni in su;
  - barra e scritta verso il prossimo traguardo, oppure "Accendila oggi" / "Tienila accesa oggi".
- Riquadro "Punti": totale, che sale contando, e "+N oggi".
- "Fatte oggi" legge il registro, non l'elenco delle attività.
- Avvisi al completamento:
  - "Completata · +24 punti";
  - al primo completamento del giorno: "🔥 Serie iniziata · …" oppure "🔥 4 giorni di fila · …";
  - ai traguardi: "🎉 7 giorni di fila! · …";
  - completando dal focus a tutto schermo, in coda: "· 25 min di focus". I minuti di focus non danno punti e non toccano la serie.

**Premi** (P-003, passo 3.4; gratuita o premium: da decidere). Logica pura in `js/rewards.js`, regole in `REWARDS`; interfaccia in `js/ui-rewards.js`, nella scheda Motivazione.
- Ognuno scrive i suoi premi: nome fino a 60 caratteri, un'emoji da un elenco fisso di 15 e un prezzo intero da 10 a 100.000 punti. Al massimo 30 premi.
  - Scrivendo il nome l'emoji si sceglie da sola («Pizza del venerdì» → 🍕), finché non la sceglie l'utente; senza un'idea resta 🎁.
  - Sotto il prezzo ci sono sei prezzi pronti (100, 250, 500, 1000, 2500 e 5000) e un aiuto: i punti guadagnati negli ultimi 7 giorni, oppure quanto vale un'attività di 30 minuti con energia media.
- **Saldo da spendere** = punti guadagnati (`totalPoints`) − punti spesi (la somma di `stats.spent` e, dal passo 4.1 di P-004, degli acquisti del negozio in `stats.shop`), mai sotto zero.
  - **Spendere non fa mai scendere di livello**: livello, riquadro Punti, serie e traguardi contano tutti i punti guadagnati, e i riscatti non li toccano.
  - Se si annulla un completamento dopo aver riscattato, il saldo può restare a zero finché quei punti non si guadagnano di nuovo.
- I premi stanno in ordine di prezzo, ognuno con una barra e quanto manca. Con il saldo che basta «Riscatta» si accende; prima è grigio, ma un tocco dice «Ancora 240 punti per Serata al cinema».
- **Riscatto**: va nel registro (`stats.spent`, `{ id, rewardId, title, cost, at }`, con il nome e il prezzo di quel momento); poi coriandoli dal pulsante e l'avviso «Te lo sei meritato: Pizza del venerdì · −400 punti» con «Annulla», che toglie quel riscatto. Un doppio tocco conta una volta sola.
- Un premio si modifica e si elimina dal suo foglio, con «Annulla». I riscatti già fatti restano come sono stati fatti: cambiare il prezzo non li cambia, e un premio eliminato resta nello storico con il suo nome (e 🎁).
- «Riscattati», chiusa sotto i premi: dal più recente, emoji, nome, giorno e punti spesi.
- Dopo un completamento, quando il saldo arriva al prezzo di un premio, l'avviso dice «🍕 Ora puoi riscattare: Pizza del venerdì · +24 punti», se non c'è già un traguardo, un livello nuovo o l'obiettivo della settimana da dire. Con più premi pronti insieme nomina il più caro.
- Premi e riscatti finiscono nel backup (vedi [backup.md](backup.md)). `rebuildStats()`, che ricostruisce il registro dalle attività, conserva i riscatti.
- Test: `tests/rewards.test.js`.

**Negozio** (P-004, passo 4.1; gratuito). Logica pura in `js/shop.js`, catalogo e regole in `SHOP`; interfaccia in `js/ui-shop.js`, nella scheda Motivazione dopo «I tuoi premi».
- **Si paga con il saldo da spendere**, lo stesso dei premi: la card dei premi e quella del negozio mostrano lo stesso numero. Come i riscatti, gli acquisti non toccano `totalPoints`: livello e riquadro Punti non scendono mai.
- **Che cosa si compra**:
  - «Ripara la serie», 150 punti, che si consuma (regole qui sotto);
  - i colori dell'aurora, 400 punti l'uno: Tramonto, Foresta, Oceano, Notte polare. «Aurora» è quello di partenza, gratis. Cambiano il bagliore dell'intestazione di Focus e l'aurora del focus a tutto schermo;
  - le forme dei coriandoli, 250 punti l'una: Stelline, Cuori, Foglie, Fiocchi di neve. «Classici» è quella di partenza, gratis. Valgono per tutti i coriandoli dell'app: traguardi, livelli, premi, acquisti;
  - i suoni del focus (passo 4.4), 300 punti l'uno: Pioggia e Onde. Silenzio (quello di partenza) e Rumore marrone sono gratis. Suonano nel focus a tutto schermo, scelti con «Suono» (vedi [suoni.md](suoni.md));
  - «Compra punti»: pacchetti da 500, 2.000 e 5.000 punti, con «Presto» e senza prezzo. Un tocco dice «I pacchetti di punti arriveranno con la versione di Aura per gli altri». Nessun pagamento e nessun dato verso fuori (decisione del Product Owner del 20 novembre 2026).
- **Comprare**: un colore o una forma si compra una volta, poi si usa quando si vuole. Con il saldo che basta, un tocco lo compra e lo mette in uso, con coriandoli e l'avviso «Comprato: Tramonto · −400 punti» e «Annulla», che toglie l'acquisto e rimette quello che era in uso. Un doppio tocco conta una volta sola. Senza punti abbastanza il pulsante è grigio, e un tocco dice «Ancora 120 punti per Tramonto». Un oggetto tuo si usa con un tocco, e quello in uso dice «In uso»; scegliendo una forma di coriandoli, una piccola festa la fa vedere.
- **I suoni si ascoltano**: un tocco su un suono lo fa sentire per circa 4 secondi, con le barrette della sua anteprima che si muovono, anche senza i punti per comprarlo (il pulsante allora dice «Ascolta Onde, 300 punti: te ne mancano 200», e l'avviso quanti ne mancano). «Annulla» dopo un acquisto e la chiusura del foglio fermano l'ascolto.
- **Ripara la serie**:
  - si ripara un giorno mancato alla volta: ieri, oppure l'altro ieri se ieri ha almeno un completamento (mai due giorni mancati di fila);
  - il giorno prima di quello mancato ha almeno un completamento: c'era una serie da salvare;
  - al massimo 2 giorni riparati negli ultimi 30, oggi compreso;
  - un giorno riparato conta per la serie, il record e i traguardi come un giorno con completamenti, ma non dà punti né stelle nel cielo della settimana. Un traguardo raggiunto riparando si festeggia: «🎉 Serie riparata: 7 giorni di fila, nuovo traguardo · −150 punti»; altrimenti «🔥 Serie riparata: 13 giorni di fila · −150 punti». Sempre con «Annulla»;
  - quando si può riparare, il riquadro della serie lo dice («Puoi ripararla nel negozio») e la card del negozio mostra in cima «Ieri è saltato un giorno», «Riparalo e la serie torna a 13 giorni di fila.» e «Ripara · 150 ★». Nel foglio la riga resta sempre, e quando non si può riparare dice perché.
- Gli acquisti stanno nel registro (`stats.shop`: `{ id, item, cost, at }`, più `day` per un giorno riparato) e quello che è in uso in `look` (vedi «Modello dati» in [CLAUDE-GUIDE.md](CLAUDE-GUIDE.md)). Finiscono nel backup (vedi [backup.md](backup.md)); `rebuildStats()` conserva gli acquisti.
- Un acquisto di un oggetto che questa versione non conosce (fatto con una versione di Aura più nuova) resta: conta nel saldo e non si usa.
- Test: `tests/shop.test.js`.

**Sfide di oggi** (P-003, passo 3.5; gratuita). Logica pura in `js/challenges.js`, regole in `CHALLENGES`; interfaccia in `js/ui-challenges.js`, nella scheda Motivazione dopo «I tuoi premi». Questa è la specifica che P-003 chiede prima del codice; dove la cambia, lo dice e spiega perché.
- **Quando nascono**: il primo giorno in cui Aura si apre (o torna in primo piano, o passa la mezzanotte con Aura aperta) senza le sfide di oggi, nascono le tre sfide di oggi e si salvano subito, con l'istante in cui sono nate (`at`). Succede anche dopo l'aggiornamento a questa versione e dopo un'importazione, se il backup non ha le sfide di oggi. Le sfide di un giorno non cambiano più: si sceglie una volta sola, con i dati di quel momento.
- **Le tre sfide**, sempre in quest'ordine:
  1. **quante** (`count`): «Completa N attività». N è la media dei completamenti nei giorni attivi dei 7 giorni prima di oggi (i giorni del registro con almeno un completamento; i giorni riparati non contano, perché non hanno completamenti), arrotondata all'intero più vicino (2,5 diventa 3) e poi portata tra 2 e 6. Senza giorni attivi, N è 2.
  2. **focus** (`focus`): «Fai 25 minuti di focus», oppure 10 se nel registro non c'è ancora nessun minuto di focus.
  3. **la più vecchia** (`oldest`): «Chiudi «…»», l'attività da fare creata da più tempo (a pari `createdAt`, quella con l'`id` che viene prima), se è stata creata almeno 3 giorni fa (3 giorni di calendario tra il giorno di `createdAt` e oggi). **In più rispetto a P-003**: non conta un'attività fissata in un giorno futuro, perché non è da fare adesso. Senza un'attività così, una sfida di tempo, sempre possibile quando nasce (`before`): «Completa un'attività entro le H», con H la prima tra le 12, le 18 e le 22 che arriva almeno 2 ore dopo `at`. Se nessuna arriva almeno 2 ore dopo (le sfide nascono dopo le 20), semplicemente «Completa un'attività» (`any`).
- **Quando una sfida è fatta**:
  - `count`: i completamenti del giorno nel registro (`stats.days`) arrivano a N;
  - `focus`: i minuti di focus del giorno (`stats.focus`) arrivano al numero della sfida;
  - `oldest`: quell'attività è completata, e il giorno del suo completamento è quello della sfida;
  - `before`: un'attività completata in quel giorno prima delle H:00, ora locale;
  - `any`: almeno un completamento nel giorno.
  - Una sfida fatta segna quando (`done`, l'istante): «Fatto alle 10:40». Se poi non vale più (per esempio con «Annulla» sul completamento che l'aveva fatta, o togliendo la spunta in «Completate», anche per un giorno passato), torna da fare e i suoi punti si tolgono. Se torna a valere lo stesso giorno, l'istante è quello nuovo.
  - **Eliminare non disfa una sfida fatta**, come non toglie i punti di un completamento: per `count`, `focus` e `any` i numeri del registro non cambiano eliminando; per `oldest` e `before`, se l'attività che l'ha fatta non c'è più, la sfida resta fatta. Per questo `before` ricorda quale attività l'ha fatta (`by`). Un'attività eliminata prima di essere completata lascia la sfida `oldest` da fare: non si può più fare.
  - Un giorno passato non guadagna sfide: dopo la mezzanotte una sfida non fatta resta così, anche se arrivano minuti di focus registrati per quel giorno (un focus a cavallo della mezzanotte). Può solo perderne, con «Annulla» o togliendo una spunta.
- **Punti**: +10 per sfida e +20 se si fanno tutte e tre, quindi al massimo 50 al giorno.
  - **Cambia rispetto a P-003**, che li voleva ricalcolati dai dati e mai salvati: si aggiungono a `totalPoints` quando una sfida diventa fatta e si tolgono quando torna da fare, come i punti di un completamento. Ricalcolati e basta, sparirebbero quando il giorno esce dai 30 conservati, o eliminando con «Svuota» l'attività che li ha fatti guadagnare, e il livello potrebbe scendere. Così invece «Annulla» li toglie (la regola di P-003 resta) e niente li toglie col tempo.
  - Contano come gli altri: nel livello, nel riquadro Punti, nel saldo da spendere, nei «+N oggi» e nei punti degli ultimi 7 giorni sotto il prezzo di un premio. Non toccano serie, record, traguardi e stelle della settimana, che contano i completamenti.
- **Dati** (schema v8):
  - `stats.challenges`: un oggetto con una chiave per giorno (`AAAA-MM-GG`; al massimo i 30 giorni più recenti) e per valore `{ at, items }`: `at` è quando sono nate, `items` le tre sfide, ognuna `{ kind, target }` più, se servono, `taskId`, `done` e `by`.
    - `kind` è `count`, `focus`, `oldest`, `before` o `any`; la prima è sempre `count`, la seconda `focus` e la terza una tra `oldest`, `before` e `any`;
    - `target` è un intero: da 2 a 6 per `count`; 10 o 25 per `focus`; l'ora, 12, 18 o 22, per `before`; 1 per `oldest` e `any`;
    - `taskId` c'è solo per `oldest`; `done` (un istante, in millisecondi) solo per una sfida fatta; `by` (l'`id` di un'attività) solo per `before` fatta.
  - Quando nascono le sfide di un giorno nuovo, i giorni oltre i 30 più recenti si tolgono. I loro punti restano in `totalPoints`.
  - La migrazione alla v8 aggiunge un oggetto vuoto: i dati di prima non hanno sfide, e quelle di oggi nascono alla prima apertura.
  - All'importazione e a ogni lettura, `sanitizeStats()` tiene un giorno solo se la data è valida, `at` è un istante valido e le sue tre sfide sono valide e nell'ordine giusto, e al massimo i 30 giorni più recenti; il resto lo scarta. Un `done` o un `by` non validi si tolgono (la sfida torna da fare, e la prima volta che Aura guarda le sfide di oggi la rivaluta). Se scarta il giorno di oggi, le sfide di oggi rinascono. Se `totalPoints` non è valido, si ricalcola dai giorni del registro più i punti delle sfide conservate.
  - Il backup esporta e importa le sfide con il resto del registro; `rebuildStats()` conserva `challenges` e conta i loro punti nel totale.
  - Con la sincronizzazione (P-002, passo 5b), se due dispositivi hanno sfide diverse per lo stesso giorno, restano quelle nate prima (`at`).
- **Interfaccia**: la card «Sfide di oggi», sotto «I tuoi premi» (come nell'[anteprima di P-003](../../docs/proposte/P-003/anteprima-motivazione-premi.jpg)).
  - In alto il titolo e quante sono fatte: «1 di 3».
  - Una riga per sfida: un anello che si riempie (`count`: completamenti su N; `focus`: minuti su obiettivo; le altre: vuoto o pieno), il testo, sotto lo stato e a destra «+10», con la spunta quando è fatta. Sotto il testo: «2 su 3», «10 su 25 min», «Aspetta da 6 giorni», «Hai tempo fino alle 18» (dopo le 18, se non è fatta, solo «Entro le 18»: nessun rimprovero), «Una qualsiasi, entro stasera»; fatta, «Fatto alle 10:40». Se l'attività di `oldest` non c'è più: «Chiudi l'attività più vecchia» e «Non c'è più».
  - In fondo: «Tutte e tre: +20 punti in più. Domattina ne arrivano di nuove; quelle non fatte spariscono e basta.» Con tutte e tre fatte: «Tutte e tre fatte: +50 punti oggi. Domattina ne arrivano di nuove.»
  - **Avvisi**: completando un'attività che fa una sfida, l'avviso lo dice e somma i punti: «🎯 Sfida fatta · +34 punti», «🎯 2 sfide fatte · +44 punti», «🏆 Tutte e tre le sfide! · +64 punti». Un traguardo della serie e un livello nuovo vengono prima; tutte e tre le sfide vengono prima dell'obiettivo della settimana, una sfida dopo. Chiudendo un focus con «Esci» che fa la sfida del focus: «Focus terminato · 25 min · 🎯 Sfida fatta +10». «Annulla» toglie anche le sfide e i loro punti. Nessun avviso per una sfida non fatta.
- Test: `tests/challenges.test.js`: scelta delle sfide (media con i decimali, senza giorni attivi, giorni riparati, attività fissate nel futuro, a pari età, a ore diverse del giorno, dopo le 20), sfida fatta e non più fatta («Annulla», spunta tolta anche per ieri), eliminazioni, giorni passati, focus a cavallo della mezzanotte, punti con tutte e tre, cambio di giorno e giorni oltre i 30, migrazione, pulizia e importazione (anche con sfide non valide), `rebuildStats()`.

**Casi limite (coperti dai test)**
- Completamenti a cavallo di mezzanotte: fa fede il giorno locale di `completedAt`.
- Annullare un completamento di ieri: si sottrae da ieri.
- Cambio d'ora e capodanno: si usano `addDays` e `daysBetween`.
- Cambio di fuso orario: i giorni restano quelli registrati quando si è completato.

**Idee per dopo**: bonus punti per il focus. Livelli e statistiche settimanali sono nella scheda Motivazione (vedi [tre-modalita.md](tre-modalita.md)).
