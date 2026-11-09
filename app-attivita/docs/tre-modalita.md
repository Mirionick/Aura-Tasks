# Tre modalità: Focus, Agenda e Motivazione (in corso: fase 1 fatta, da provare sull'iPhone)

Nuovo capitolo: animazioni più fluide e l'app divisa in **tre schede**, una per ogni modo di usarla. Assorbe il vecchio punto 4 di "Funzioni future" («Cosa faccio adesso?» e modalità focus): le specifiche sono qui, aggiornate.

**Regola: niente si toglie né peggiora.** Ogni funzione di oggi resta; al massimo cambia posto (vedi "Dove va ogni funzione di oggi").

## Fasi
Ogni fase si pubblica da sola, con i suoi test, la prova WebKit e la prova dell'utente sull'iPhone prima della successiva.

| Fase | Contenuto | Stato |
|---|---|---|
| 1 | Animazioni più fluide in tutta l'app | fatta, da provare sull'iPhone |
| 2 | Barra delle schede e Focus, con «Cosa faccio adesso?» e il timer | da fare |
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

## Navigazione
- **Barra delle schede** in basso: **Focus**, **Agenda**, **Motivazione**.
  - Ogni scheda ha icona e testo; aree di tocco ≥ 44 px; margine sotto con `env(safe-area-inset-bottom)`.
  - Un **indicatore**, una pillola tenue dietro la scheda attiva, scivola sulla scheda scelta con `transform`.
  - È un `<nav>` con tre pulsanti (`aria-current="page"` su quello attivo). Le schede sono tre `<section>`; quelle non attive hanno `hidden`.
- **Cambio di scheda**: dissolvenza con un leggero scorrimento (circa 24 px) nella direzione del cambio, in `--dur-move`. Ogni scheda ricorda dov'era arrivato lo scorrimento.
- **All'apertura** l'app parte da **Focus**. Se si ricarica entro 30 minuti dall'ultimo uso (su iPhone succede spesso tornando dallo sfondo), riparte dall'ultima scheda.
- **Intestazione "aura"** in tutte le schede, con logo, campanella e tema. In Agenda e Motivazione è più bassa.
- «+ Nuova attività» e gli avvisi stanno sopra la barra.

## Focus: per fare
- **In cima**, «Cosa faccio adesso?». Poi **In ritardo**, **Oggi** (in ordine d'ora) e **Senza data**. In fondo, «Completate oggi», chiusa.
- **Intestazione**: saluto, data e i riquadri "Da fare", "Tempo stimato" e "Fatte oggi", come oggi.
- **Serie e punti** restano visibili in piccolo (fiamma con i giorni, stella con i punti), con gli effetti di oggi. Un tocco porta a Motivazione.
- Sulle card da fare c'è in più il pulsante ▶ **Focus**.

### «Cosa faccio adesso?»
- Un pulsante grande in cima a Focus apre un foglio con due domande:
  - "Quanto tempo hai?", con i chip 10/15/30/45/60/90/120+;
  - "Come ti senti?", con energia bassa/media/alta.
- Ricorda l'ultima scelta (`aura-tasks:prefs`).
- **Algoritmo**: funzione pura `suggest(tasks, { minutes, energy, today, exclude, random })` in `js/suggest.js`.
  - **Candidate**: attività non completate, con `duration ≤ minutes`, con `ENERGY[t.energy].order ≤ ENERGY[energy].order` e con data nulla oppure `≤ oggi`.
  - **Punteggio** (i pesi stanno in costanti):
    - urgenza: in ritardo +50, più 5 per ogni giorno di ritardo fino a +30; oggi +30; senza data +10;
    - sfruttamento del tempo: `20 × durata / minuti`;
    - energia: +10 se uguale a quella disponibile (con energia alta si preferiscono le attività impegnative);
    - anzianità: +1 ogni 2 giorni dalla creazione, fino a +10;
    - un pizzico di casualità (±5) per variare. Si disattiva nei test passando `random: () => 0.5`.
  - **Risultato**: la migliore più qualche alternativa, con il **motivo** in italiano. Per esempio: "È in ritardo da 2 giorni e ci sta nei tuoi 30 minuti".
- **Azioni**: "Inizia focus", "Fatto", "Un'altra proposta". Quest'ultima esclude le attività già proposte nella sessione.
- **Nessuna candidata**: un messaggio gentile con un suggerimento ("Hai più tempo?", "Una pausa ☕?") oppure l'attività più breve, con l'illustrazione `suggest-none`.

### Focus a tutto schermo con timer
- **Avvio**: ▶ "Focus" sulla card, oppure "Inizia focus" dalla proposta.
- **Interfaccia**: foglio a tutto schermo con il titolo dell'attività, un anello SVG che fa il conto alla rovescia partendo dalla durata stimata e il tempo grande (mm:ss). Comandi: Pausa/Riprendi, +5 min, Completa, Esci.
- **Sfondo che respira**, come l'aura dell'intestazione: bagliori ciano e rosa disegnati come gradienti in livelli separati, che si muovono solo con `transform` e `opacity` in un ciclo lento (`--dur-breath`).
  - È l'**unica animazione continua** dell'app, un'eccezione a "mai infinite": gira solo mentre il foglio è aperto e la pagina è visibile, e si ferma alla fine del tempo.
  - Con «Riduci movimento» lo sfondo resta fermo.
- **Tempo affidabile**
  - Lo stato sta in `aura-tasks:focus`: `{ taskId, startedAt, durationMs, pausedAt, pausedTotalMs }`.
  - Tempo rimanente = `durationMs − (adesso − startedAt − pausedTotalMs)`.
  - **Non contare mai i "tick"** di `setInterval`: su iOS i timer si fermano in background e col blocco schermo. Al ritorno (`visibilitychange`) si ricalcola, e ricaricando la pagina il focus riprende.
  - La logica pura sta in `js/focus.js` ed è testabile passando `now`.
- **Aggiornamento**: un intervallo di 250 ms, solo mentre la pagina è visibile. L'anello cambia `stroke-dashoffset` a scatti, senza transizioni.
- **Schermo acceso**: `navigator.wakeLock.request('screen')` dove supportato. Va richiesto di nuovo dopo `visibilitychange`, ed è facoltativo: senza, si continua lo stesso.
- **Fine del tempo**
  - Suono breve con Web Audio. L'`AudioContext` va creato o sbloccato al tocco su "Inizia", altrimenti iOS lo blocca.
  - Vibrazione solo su Android: `navigator.vibrate` su iOS non esiste.
  - Poi si propone "Completata" oppure "+5 min".
- **Notifiche**: senza promemoria attivi non ci sono avvisi ad app chiusa, perché le notifiche programmate offline non esistono.
- **Da valutare nella fase 2**: con i promemoria attivi, una **notifica push alla fine del focus**, che arriva anche a telefono bloccato.
  - All'avvio l'app aggiunge all'elenco dei promemoria un avviso per la fine, e lo aggiorna con Pausa, Riprendi, +5 min, Completa ed Esci.
  - Il Cron gira ogni minuto, quindi l'avviso può arrivare fino a un minuto dopo.
  - Il testo ("Tempo finito: …") richiede un piccolo cambio nel server o nel service worker, che oggi scrivono "Tra 10 minuti, alle 10:00".
  - Serve internet all'avvio e a ogni cambio. Offline resta il suono, ad app aperta.
  - Su iPhone funziona solo con l'app installata e il permesso concesso, come i promemoria.
- **Minuti di focus**:
  - alla fine della sessione (Completa, Esci o fine del tempo) i minuti effettivi, pause escluse, si sommano in `stats.focus`, nel giorno locale in cui la sessione finisce;
  - sotto un minuto non si registra nulla;
  - non danno punti e non toccano la serie.
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
- La logica pura sta in `js/motivation.js`: obiettivo, calendario, minuti, frase del giorno.

## Dati
- **Minuti di focus**: `stats.focus = { 'YYYY-MM-DD': minuti }`, una mappa del registro separata da `days`. Così le regole della serie non cambiano, e i minuti finiscono anche nel backup.
  - **Schema v4**: `migrate()` cambia solo il numero di versione.
  - `sanitizeStats()` aggiunge `focus: {}` e scarta giorni non validi e minuti non interi o fuori misura.
  - `rebuildStats()` parte con `focus: {}`.
- **Preferenze**: `aura-tasks:prefs = { weeklyGoal, lastTab, lastTabAt, suggest: { minutes, energy } }`.
  - È senza versione, come `aura-tasks:remote`, e fuori dal backup, come il tema.
  - La scrive e la legge solo `js/storage.js` (`loadPrefs()` e `savePrefs()`, con pulizia dei valori).
- **Focus in corso**: `aura-tasks:focus` (vedi "Tempo affidabile").
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
Elenco, flusso e prompt stanno in [illustrazioni.md](illustrazioni.md). Finché un'immagine manca, l'app usa le icone (distintivi) o l'illustrazione SVG di oggi (stati vuoti).

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
- `js/motion.js` (fase 1) tocca la pagina solo per le animazioni.
- Se `app.js` diventa troppo lungo, ogni scheda va in un suo file (`js/ui-focus.js`, `js/ui-agenda.js`, `js/ui-motivation.js`), che come `app.js` può toccare la pagina.
- Ogni file nuovo va in `index.html`, in `tests/index.html` se ha logica pura, e in `APP_FILES` di `sw.js`.
