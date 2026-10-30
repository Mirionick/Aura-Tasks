# Aura Tasks — guida al progetto

App web installabile (PWA) **in italiano**: un **segretario personale** sul telefono.

## La visione
Aura deve permettere di **catturare un impegno in pochi secondi**, con una frase o con la voce ("domani alle 10 dentista"), e poi di **ricordarlo** al momento giusto.
- Le scelte di prodotto si misurano su due domande:
  - quanto è più veloce mettere dentro un impegno?
  - quanto è più affidabile che venga ricordato?
- Tutti i dati restano nel `localStorage` del dispositivo.
- L'unica eccezione prevista a "niente server" è un piccolo server per le notifiche push (vedi "Funzioni future", punto 3). Riceverà solo l'orario e il testo dei promemoria.

## Cosa sa fare oggi
- **Attività**: ognuna ha titolo, durata stimata in minuti, livello di energia (bassa/media/alta), data facoltativa e **orario** facoltativo.
- **Gestione**: aggiungere, completare (con "Annulla"), eliminare (con "Annulla") e svuotare le completate.
- **Scrivere una frase**, che compila il modulo da sola ("domani alle 10 dentista 30 min").
- **Aprire il link `…/?add=testo`**, che apre il modulo già compilato (vedi "Linguaggio naturale").
- **Lista** divisa per giorno, con le attività in ordine d'ora.
- **Riepilogo** nell'intestazione.
- **Tema** Automatico/Chiaro/Scuro e **uso offline**.
- **Punti e serie**: ogni attività completata dà punti. I giorni di fila con almeno un completamento formano la **serie** 🔥, con record e traguardi festeggiati (vedi "Punti e serie di giorni").

---

## Note per Claude

- Rispondi all'utente **in italiano**.
- L'utente prova l'app su un **iPhone vero**. I controlli automatici su questo PC usano solo Edge headless, che non riproduce i difetti di Safari/WebKit. Quando una modifica tocca layout, animazioni o API del browser, di' chiaramente che cosa va provato sull'iPhone.
- Quando l'utente dice **"pubblica"**, segui i passi di "Pubblicare con Git".

## Vincoli da rispettare sempre

- **Solo HTML, CSS e JavaScript "vanilla"**: niente framework, librerie, npm, build, CDN o font esterni.
- L'app deve funzionare anche **aprendo `index.html` con un doppio clic** (`file://`). Per questo:
  - niente `type="module"` né `import`/`export`, perché da `file://` i moduli sono bloccati;
  - si usano script classici con `defer`, che condividono il namespace globale `window.Aura`;
  - i percorsi sono sempre **relativi** (`css/style.css`, mai `/css/style.css`): l'app deve funzionare anche in una sottocartella, come su GitHub Pages.
- L'interfaccia è **tutta in italiano**: `lang="it"` e date formattate con `Intl` e `'it-IT'`.
- **Prima il telefono**: i bersagli principali sono iPhone (Safari) e Android (Chrome). Ogni modifica va provata prima a 375–390 px di larghezza.
- Identificatori del codice in inglese; testi dell'interfaccia e commenti in italiano.

## Avvio, pubblicazione e installazione

### Sul computer
Doppio clic su `index.html` (Edge, Chrome, Firefox o Safari).
- Da `file://` il service worker non viene registrato e l'installazione non è disponibile: è normale.
- In console può comparire un errore CORS sul manifest: è innocuo.

Per provare la PWA (offline, installazione) serve un indirizzo `http://localhost` o `https://`.

### Pubblicare con Git
- **Repository**: https://github.com/Mirionick/Aura-Tasks (pubblico, ramo `main`).
  - L'app sta in `app-attivita/`.
  - Alla radice ci sono solo `CLAUDE.md`, che rimanda a questo file, e `.gitignore`.
- **Copia di lavoro**: `C:\Users\Valentino.Battilana\Documents\Aura-Tasks`.
- **Sito**: https://mirionick.github.io/Aura-Tasks/app-attivita/, servito da GitHub Pages ("Deploy from a branch", `main`, `/ (root)`). Si aggiorna circa un minuto dopo il push.
- **Identità dei commit**: è impostata solo in questo repository, con `Mirionick` e l'indirizzo noreply di GitHub. Non usare l'email personale: il repository è pubblico.

Quando l'utente dice **"pubblica"**:
1. Controlla `git status`: cosa è cambiato, e che non ci siano file estranei.
2. Esegui i test (vedi "Test"): devono essere tutti verdi.
   - Se sono cambiati file dell'app, controlla anche `sw.js` (`APP_FILES`, `CACHE_VERSION`).
3. Fai il commit con un messaggio chiaro in italiano: la prima riga dice cosa cambia per chi usa l'app, le righe dopo danno i dettagli.
   - Su Windows PowerShell 5.1 scrivi il messaggio in un file UTF-8 e usa `git commit -F <file>`. Con `-m`, le virgolette dentro il messaggio si perdono o fanno fallire il comando.
4. Esegui `git push`. Se Git chiede di accedere a GitHub, avvisa l'utente: farà il login dalla finestra del browser.
   - Dagli strumenti di Claude la finestra di login non si apre (`GCM_INTERACTIVE=never`): chiedi all'utente di eseguire `git push` una volta dal suo terminale. Dopo il login le credenziali restano salvate in Windows e i push successivi funzionano anche da qui.

Il telefono scarica la nuova versione alla prima apertura con internet, perché il service worker prova prima la rete.

### Installare sul telefono
- **iPhone (Safari)**: apri l'indirizzo → Condividi → "Aggiungi alla schermata Home".
- **Android (Chrome)**: apri l'indirizzo → menu ⋮ → "Installa app" oppure "Aggiungi a schermata Home".

⚠️ **Su iPhone l'app installata ha un archivio separato da Safari**: le attività inserite in Safari non compaiono nell'app installata, e viceversa. Conviene installarla subito e usarla sempre dall'icona.

⚠️ I dati sono legati al dispositivo e al browser: cancellare i dati di navigazione li elimina, e non si sincronizzano tra dispositivi (vedi "Altre idee: backup").

## Struttura dei file

| File | Ruolo |
|---|---|
| `index.html` | Struttura della pagina e meta per mobile e PWA. Contiene lo sprite delle icone SVG, i fogli `<dialog>` ("Nuova attività", "Tema") e il `<template>` della card |
| `css/style.css` | Design system: token (variabili) per i due temi, componenti, animazioni |
| `js/theme.js` | Tema Automatico/Chiaro/Scuro. Caricato nel `<head>` **senza `defer`** per applicare il tema prima del primo disegno (niente lampi) |
| `js/utils.js` | Date locali, formattazione in italiano, saluto, id univoci |
| `js/tasks.js` | Logica pura delle attività: livelli di energia, limiti, validazione, creazione, completamento, eliminazione e ripristino, sezioni, riepilogo |
| `js/nlp.js` | Logica pura del linguaggio naturale: `parseTaskText(testo, adesso)` riconosce giorno, orario, durata ed energia in una frase |
| `js/points.js` | Logica pura di punti e serie: regole (`POINTS`), completamento con punti, registro dei giorni, serie, record, traguardi, ricostruzione del registro per la migrazione |
| `js/storage.js` | Lettura e scrittura del `localStorage`, versione dello schema, migrazioni, pulizia di attività e registro |
| `js/app.js` | Interfaccia: disegno, eventi, fogli, avvisi con "Annulla", riquadri di serie e punti con i loro effetti, registrazione del service worker. Unico file che tocca la pagina |
| `sw.js` | Service worker per l'uso offline |
| `manifest.webmanifest` | Nome, icone e colori per l'installazione |
| `icons/` | `icon.svg` (favicon e sorgente), PNG 192 e 512 "any", 512 "maskable", `apple-touch-icon` 180 |
| `tests/` | Test della logica pura (`core.test.js`, `points.test.js`, `nlp.test.js`): si aprono con `tests/index.html` |

**Ordine di caricamento**: `theme.js` → `utils.js` → `tasks.js` → `nlp.js` → `points.js` → `storage.js` → `app.js`.
- Ogni file aggiunge il suo modulo a `window.Aura` (`Aura.theme`, `Aura.utils`, `Aura.tasks`, `Aura.nlp`, `Aura.points`, `Aura.storage`).
- `points.js` va prima di `storage.js`, che lo usa per la migrazione.

Un nuovo modulo `js/<nome>.js` va aggiunto in tre punti:
1. in `index.html`, con `defer`, prima di `app.js`;
2. in `tests/index.html`, se contiene logica testabile;
3. in `APP_FILES` di `sw.js`.

## Modello dati

La chiave `aura-tasks:data` contiene:
```json
{
  "version": 3,
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
      "pointsAwarded": 24
    }
  ],
  "stats": {
    "totalPoints": 24,
    "bestStreak": 1,
    "milestones": [],
    "days": { "2026-10-29": { "done": 1, "points": 24 } }
  }
}
```
- `duration`: minuti interi tra 1 e 600 (`Aura.tasks.LIMITS`).
- `energy`: `low` | `medium` | `high`. Etichetta, ordine (1/2/3) e frase d'aiuto sono in `Aura.tasks.ENERGY`.
- `date`: `'YYYY-MM-DD'` **locale** oppure `null`.
- `time`: `'HH:MM'` locale oppure `null`. Esiste **solo insieme a `date`**: `sanitizeTask()` lo azzera se manca il giorno, e nel modulo il campo "Ora" è spento finché non c'è una data. Nello stesso giorno le attività vanno in ordine d'ora, prima di quelle senza orario.
- `createdAt` e `completedAt`: millisecondi (`Date.now()`). `completedAt` vale `null` se l'attività non è completata.
- `pointsAwarded`: punti dati al completamento, oppure `null` se l'attività non è completata. "Annulla" toglie esattamente questo valore.
- `stats` è il registro di punti e serie. È **separato dalle attività**: eliminarle o usare "Svuota" non cancella la storia.
  - `days`: completamenti e punti per giorno, dove il giorno è quello locale di `completedAt`. Un giorno che torna a 0 completamenti viene tolto.
  - **Non sfoltire mai `days`**: serie e record si calcolano da qui.
  - `totalPoints`: il totale dei punti.
  - `bestStreak`: il record, cioè la serie più lunga in `days`. Si ricalcola a ogni modifica.
  - `milestones`: i traguardi già festeggiati. Restano anche dopo "Annulla", così la festa non si ripete.
- Le altre chiavi sono `aura-tasks:theme` (`auto` | `light` | `dark`) e `aura-tasks:backup-<timestamp>`. Quest'ultima è la copia di dati illeggibili trovati all'avvio: l'app la crea e riparte da una lista vuota.

**Dalla v1 alla v2**:
1. `migrate()` mette `stats = null`.
2. `parse()` ripulisce le attività e `sanitizeTask()` assegna `pointsAwarded` alle completate che non ce l'hanno.
3. `parse()` ricostruisce `stats` con `Aura.points.rebuildStats()`. I traguardi già superati si segnano senza festa.

**Dalla v2 alla v3**: `migrate()` cambia solo il numero di versione, e `sanitizeTask()` aggiunge `time: null` alle attività. Punti, registro e campi sconosciuti restano intatti, come verifica un test.

I dati migrati vengono salvati alla prima modifica.

### Cambiare lo schema
1. Aumenta `SCHEMA_VERSION` in `js/storage.js`.
2. In `migrate()` aggiungi un passo `if (state.version === N) { …; state.version = N + 1; }`. I passi si eseguono in ordine: un utente fermo alla v1 deve arrivare all'ultima versione.
3. Se aggiungi campi alle attività, aggiorna `sanitizeTask()`; se cambi il registro, `sanitizeStats()`. Poi scrivi i test della migrazione.
4. **Non cambiare mai il significato di un campo esistente**: aggiungine uno nuovo.

`parse()` conserva i campi che non conosce e non abbassa mai il numero di versione. Così una versione più vecchia dell'app non rovina i dati scritti da una più nuova.

## Convenzioni

- **Logica pura e pagina sono separate.** `utils.js`, `tasks.js` e le parti pure di `storage.js` non toccano né il DOM né il `localStorage`. Restituiscono sempre nuovi oggetti invece di modificare quelli esistenti, quindi sono facili da testare e da annullare. Solo `app.js` tocca la pagina.
- **Ogni modifica passa da `commit()`** in `app.js`, che salva e ridisegna. `render()` ridisegna tutto partendo da `state`: i dati sono pochi, quindi è veloce e non ci sono stati "sfasati".
- **Date**: usa sempre `Aura.utils` (`todayISO`, `addDays`, `daysBetween`, `parseISODate`, `isISODate`…).
  - Mai `toISOString()` per la data di oggi: è in UTC, e dopo mezzanotte in Italia darebbe il giorno prima.
  - Mai `new Date('YYYY-MM-DD')`: anche questa legge la data in UTC.
- **Sicurezza**: i testi dell'utente vanno sempre in `textContent`, mai in `innerHTML`.
- **"Annulla" invece di chiedere conferma**: le azioni distruttive si eseguono subito e l'avviso offre "Annulla". Niente `confirm()`.
- **CSS**:
  - colori, ombre e raggi passano solo dalle variabili in `:root` (tema chiaro) e `:root[data-theme="dark"]` (tema scuro);
  - un colore nuovo va definito **in entrambi i temi** e verificato col contrasto **WCAG AA** (testo ≥ 4,5:1);
  - nel tema scuro le ombre non bastano: servono bordi sottili e superfici più chiare;
  - `--hero-top` deve restare uguale a `BAR_COLORS` in `theme.js`, che dà il colore della barra di stato;
  - nei contenitori flex in colonna senza altezza fissa (come i fogli `<dialog>`) usa `flex: 1 1 auto`, mai `flex: 1`: su Safari la base 0% fa collassare l'elemento a 0 px e il foglio diventa invisibile.
- **Telefono**:
  - testo dei campi ≥ 16 px, altrimenti iOS ingrandisce la pagina;
  - aree di tocco ≥ 44 px;
  - margini con `env(safe-area-inset-*)`;
  - animazioni brevi, disattivate con `prefers-reduced-motion`, e **mai infinite** perché consumano batteria.
- **Fogli `<dialog>`**: aprili e chiudili con `openSheet()` e `closeSheet()` di `app.js`, che gestiscono animazione, blocco dello scorrimento e chiusura con Esc, "indietro" o tocco sullo sfondo. Non contare sull'evento `close` per pulizie indispensabili.
- **Service worker**: quando aggiungi o rinomini un file dell'app, aggiungilo ad `APP_FILES` in `sw.js` e aumenta `CACHE_VERSION`.
- **Test**: ogni nuova logica pura ha i suoi test in `tests/`.
- **Premium**: qualsiasi controllo premium passa **solo** da `isPremium()` (vedi la sezione "Funzioni premium").

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
- Con il tempo virtuale anche le Web Animations (`element.animate`) restano ferme e `requestAnimationFrame` è inaffidabile. Per questo ogni effetto ha un timer di riserva che porta allo stato finale.
- Per fotografare un'animazione a metà: `document.getAnimations()`, poi `pause()` e `currentTime = …` su ciascuna.
- I service worker vanno provati in tempo reale, su `http://localhost`.
- La finestra headless è larga almeno 500 px: per simulare un telefono, carica l'app in un `<iframe>` largo 390 px.

## Design

- **Intestazione "aura"**: gradiente viola-indaco con bagliori ciano e rosa e testo bianco, in entrambi i temi. Su iPhone, nell'app installata (`black-translucent`), la barra di stato le sta sopra. Una fascia (`.statusbar-scrim`) la mantiene leggibile quando si scorre.
- **Tema scuro**:
  - blu-notte profondo, non nero puro;
  - superfici a livelli via via più chiari;
  - testo avorio;
  - accento schiarito (`--accent-text`);
  - colori dell'energia ricalibrati su sfondi tenui.
- **Energia**: verde acqua per bassa, ambra per media, rosa per alta. C'è sempre l'icona a barre più il testo, mai solo il colore.
- **Serie e punti**: seconda riga di riquadri nell'intestazione.
  - Serie "accesa" quando oggi c'è già un completamento: gradiente caldo arancio-rosa e fiamma colorata.
  - Serie "da accendere" negli altri casi: fiamma grigia.
  - Per il testo sul riquadro acceso: `--streak-tile-a/b` sono scelti per il contrasto ≥ 4,5:1 col bianco.
  - Fiamma e stella sono SVG scritti direttamente in `index.html`, non nello sprite, perché il CSS ne cambia i colori in base allo stato.
  - Gli effetti (anello sulla spunta, "+N" che vola nel riquadro dei punti, conteggio, fiamma che si accende, coriandoli ai traguardi):
    - sono brevi e finiti;
    - si spengono con "Riduci movimento";
    - animano il **contenuto** dei riquadri, non il riquadro con `backdrop-filter`, perché su Safari sfarfalla.
- Font di sistema. Le icone SVG stanno nello sprite di `index.html` (`<use href="#i-…">`) e il tratto usa `currentColor`.
- **Icone dell'app**:
  - le PNG derivano da `icons/icon.svg`;
  - per "maskable" e `apple-touch-icon` si usa lo stesso disegno con `rx="0"`, cioè senza angoli arrotondati e senza trasparenza;
  - le versioni da 512 si ottengono con uno screenshot di Edge headless (`--window-size=512,512 --default-background-color=00000000`);
  - quelle da 192 e 180 si ottengono rimpicciolendo le 512.

---

## Punti e serie di giorni (realizzata, gratuita)

**Obiettivo**: motivare con piccole ricompense quotidiane. La logica pura sta in `js/points.js` e le regole in `POINTS`.

**Punti**
- Formula: `Math.round((10 + Math.min(durata, 120) / 5) × moltiplicatore)`, con moltiplicatore 1 per energia bassa, 1,5 per media e 2 per alta.
  - 15 min bassa → 13; 30 min media → 24; 60 min alta → 44; 120 min alta → 68.
- Al completamento i punti si salvano su `pointsAwarded`.
- "Annulla", o togliere la spunta, sottrae gli stessi punti dal giorno in cui erano stati dati: spuntare e togliere la spunta non fa accumulare.
- Eliminare un'attività completata o usare "Svuota" **non** toglie punti.

**Serie**
- È il numero di giorni consecutivi con almeno un completamento, contati all'indietro da oggi.
- Se oggi non c'è ancora nessun completamento si parte da ieri: la serie resta "viva", ma "da accendere", fino a mezzanotte.
- Il record (`bestStreak`) è la serie più lunga del registro.

**Traguardi**
- A 3, 7, 14, 30 e 100 giorni partono coriandoli, un avviso festoso e, su Android, una vibrazione.
- Succede una volta sola per traguardo (`stats.milestones`).

**Interfaccia**
- Riquadro "Serie" (vedi "Design"):
  - giorni e fiamma;
  - etichetta "🏆 record N", oppure "🏆 record!" quando la serie in corso è il record, da 3 giorni in su;
  - barra e scritta verso il prossimo traguardo, oppure "Accendila oggi" / "Tienila accesa oggi".
- Riquadro "Punti": totale, che sale contando, e "+N oggi".
- "Fatte oggi" legge il registro, non l'elenco delle attività.
- Avvisi al completamento:
  - "Completata · +24 punti";
  - al primo completamento del giorno: "🔥 Serie iniziata · …" oppure "🔥 4 giorni di fila · …";
  - ai traguardi: "🎉 7 giorni di fila! · …".

**Casi limite (coperti dai test)**
- Completamenti a cavallo di mezzanotte: fa fede il giorno locale di `completedAt`.
- Annullare un completamento di ieri: si sottrae da ieri.
- Cambio d'ora e capodanno: si usano `addDays` e `daysBetween`.
- Cambio di fuso orario: i giorni restano quelli registrati quando si è completato.

**Idee per dopo**: livelli, statistiche settimanali dal registro, bonus punti per il focus.

## Linguaggio naturale con orario e link ?add= (realizzata, gratuita)

È il punto 1 della visione: catturare un impegno con una frase.

**Interfaccia**
- In cima al foglio "Nuova attività" c'è il campo **"Scrivi in una frase"**. Mentre scrivi, i campi sotto si compilano e restano modificabili. Una riga dice cosa è stato capito: "Capito: Domani · alle 10:00 · 30 min".
- La frase sovrascrive solo i campi di cui parla. Se modifichi un campo a mano, quella diventa la nuova base.
- **Campo "Ora"**: selettore nativo, più il chip "Nessuna". È spento finché non c'è un giorno, e togliere il giorno svuota l'ora.
- L'orario compare sulla card con l'icona della sveglia.

**Link `?add=`**: `https://mirionick.github.io/Aura-Tasks/app-attivita/?add=domani%20alle%2010%20dentista`
- Apre il foglio **già compilato**: si controlla e si tocca "Aggiungi". Un errore di dettatura non finisce in lista da solo.
- Il parametro viene tolto dall'indirizzo con `history.replaceState`, così ricaricando la pagina il foglio non si riapre.
- Funziona anche offline, perché il service worker ignora la query.
- È il punto d'aggancio per il Comando Rapido di Siri (punto 2).

**Parser**: `Aura.nlp.parseTaskText(testo, adesso)` in `js/nlp.js`. È a regole, offline e senza API.
- Restituisce `{ title, duration, energy, date, time }`. Un campo non riconosciuto vale `null`, e il titolo vale `''`.
- `adesso` è **sempre un parametro**: serve per "oggi o domani?". Nei test si usa un adesso fisso: **giovedì 29/10/2026 alle 9:00**.
- Le parole si riconoscono su una copia minuscola e senza accenti, lunga quanto il testo, così il titolo conserva gli accenti originali.
- Ordine di lettura: prima l'orario, poi durata, data ed energia. Così "alle 10" non diventa una durata.
- Nelle regex niente lookbehind né gruppi con nome: Safari meno recente non li supporta.

Cosa riconosce:
- **Orario**:
  - "alle 10", "alle 10:30", "alle 10.30", "ore 15", "alle ore 9", "all'una", "a mezzogiorno", "a mezzanotte";
  - "alle 8 di sera", "alle 3 del pomeriggio", "alle 5 di mattina".
- **Regole sull'orario**:
  - le ore **dalle 1 alle 7** senza "mattina" si intendono del pomeriggio: "alle 3" → 15:00, "alle 3:30" → 15:30;
  - dalle 8 in su l'ora resta com'è;
  - "stasera alle 9" → 21:00;
  - un orario impossibile, come "alle 25", resta nel titolo;
  - con un orario ma senza giorno: oggi, oppure domani se a quell'ora siamo già passati (l'ora esatta di adesso conta come passata).
- **Durata**: "30 min", "30m", "30 minuti", "dieci minuti", "1h", "1 ora", "un'ora", "2 ore", "1h30", "1 ora e mezza", "mezz'ora", "un quarto d'ora", "tre quarti d'ora". Va da 1 a 600 minuti.
- **Data**:
  - "oggi", "stamattina" e "stasera" (= oggi), "domani", "dopodomani";
  - "tra/fra 3 giorni", "tra una settimana";
  - giorni della settimana ("venerdì", "venerdi", "ven"): sempre il prossimo, escluso oggi. "Venerdì prossimo" è quello della settimana dopo;
  - "il 15" (il prossimo 15, oggi compreso), "15/11", "15-11-2026", "15 novembre". Senza anno vale la prossima data esistente: il 29/02 diventa il prossimo anno bisestile.
- **Energia**:
  - "energia bassa/media/alta";
  - "facile", "leggera" e "veloce" → bassa;
  - "impegnativa", "difficile", "pesante" e "concentrazione" → alta.
- **Titolo**: il testo che resta, senza le preposizioni rimaste ai bordi ("alle", "il", "per"…), con l'iniziale maiuscola.

**Esempi** (sono anche test, con adesso = giovedì 29/10/2026 alle 9:00):

| Testo | Titolo | Durata | Energia | Data | Ora |
|---|---|---|---|---|---|
| "domani chiamare il dentista 10 min" | Chiamare il dentista | 10 | — | 2026-10-30 | — |
| "palestra 1h energia alta venerdì" | Palestra | 60 | alta | 2026-10-30 | — |
| "rispondere alle email mezz'ora facile" | Rispondere alle email | 30 | bassa | — | — |
| "studiare storia un'ora e mezza il 15/11" | Studiare storia | 90 | — | 2026-11-15 | — |
| "comprare il pane" | Comprare il pane | — | — | — | — |
| "domani alle 10 dentista" | Dentista | — | — | 2026-10-30 | 10:00 |
| "alle 3 dentista" | Dentista | — | — | 2026-10-29 | 15:00 |
| "colazione alle 8:30" | Colazione | — | — | 2026-10-30 (già passata) | 08:30 |

**Casi limite coperti dai test**
- "leggere 2 capitoli": il 2 resta nel titolo.
- Date impossibili come il 31/02.
- Con due durate vale la prima.
- Testo vuoto.
- Accenti nel titolo.

**Idea per dopo**: dettatura dentro l'app con la Web Speech API (`webkitSpeechRecognition`, `lang = 'it-IT'`), dove disponibile. Su iPhone è più affidabile la dettatura del Comando Rapido (punto 2).

---

## Funzioni future

Sono nell'ordine della visione. Per ciascuna sono indicati comportamento, dati e casi limite. Prima di implementarne una, decidi se è **gratuita o premium** e annotalo nella tabella di "Funzioni premium".

### 2. Comando Rapido di Siri, Web Share Target e scorciatoie
**Obiettivo**: aggiungere un impegno senza aprire l'app, con la voce o con la condivisione.

**iPhone: Comando Rapido "Aggiungi ad Aura"** (app Comandi)
1. Azione "Dettatura testo" (lingua italiana).
2. Azione "URL" con `https://mirionick.github.io/Aura-Tasks/app-attivita/?add=` seguito dal testo dettato, codificato con l'azione "Codifica URL".
3. Azione "Apri URL".

Si avvia con "Ehi Siri, Aggiungi ad Aura" e si conferma nel foglio.
- Da scrivere: una guida passo passo per l'utente, con le schermate, e il link per installare il comando già pronto.
- ⚠️ "Apri URL" apre Safari, non l'app installata, e i due hanno archivi separati (vedi "Installare sul telefono"). Da verificare sul dispositivo: se l'app installata non si apre, bisogna capire come farla aprire; in alternativa conviene usare Aura da Safari.

**Android**
- `share_target` nel manifest (GET): `"action": "./"`, con il testo condiviso passato come `add`, per esempio `"params": { "text": "add", "title": "add" }`. Condividendo un testo verso Aura si apre il foglio compilato. Funziona solo con l'app installata.
- Se ci sono sia `title` sia `text`, vanno uniti prima del parsing.
- `shortcuts` nel manifest: "Nuova attività" (`./?add=`), che si vede tenendo premuta l'icona. Su iPhone le shortcuts del manifest non esistono.

**Test**: unione di `title` e `text`; link con caratteri speciali (accenti, `&`, `+`).

### 3. Promemoria
**Obiettivo**: che il segretario ricordi gli impegni anche ad app chiusa.

**3a. Esportazione `.ics`** (prima, senza server)
- Un pulsante sulla card ("Aggiungi al calendario") e un'azione "Esporta tutte con data".
- Generano un file `.ics` (iCalendar, RFC 5545) che il Calendario di iPhone o Android importa con un promemoria vero, per esempio 15 minuti prima.
- Logica pura in `js/ics.js`:
  - `VEVENT` con `DTSTART` locale e `TZID=Europe/Rome`, oppure in UTC calcolato dall'ora locale;
  - durata = durata stimata;
  - senza orario: evento di un giorno intero;
  - `VALARM` con `TRIGGER:-PT15M`;
  - `UID` = id dell'attività.
- Si scarica con un `Blob` e `<a download>`. Su iPhone Safari apre il file e propone "Aggiungi al calendario".
- **Test**: testo esatto del file, con escape di virgole, punti e virgola e a capo; giorno intero; cambio dell'ora.

**3b. Notifiche Web Push** (poi, con un piccolo server gratuito)
- Funzionano su iOS dalla 16.4, **solo con l'app installata** e dopo il permesso, che va chiesto con un tocco dell'utente.
- Il service worker riceve il `push` e mostra la notifica. Toccandola si apre l'app sull'attività.
- **Server**: piccolo e gratuito, per esempio Cloudflare Workers con Cron Trigger e KV. Conserva solo endpoint di sottoscrizione, orario e testo del promemoria, e alla scadenza invia il push firmato VAPID.
  - La chiave privata VAPID sta solo nel server, mai nel repository.
  - Completare o eliminare l'attività cancella il promemoria sul server.
- È l'unica eccezione al vincolo "niente server": va scritta qui con cosa riceve il server, e in app va spiegato all'utente.
- Da decidere: gratuita o premium.

### 4. "Cosa faccio adesso?" e modalità focus
Vengono dopo i promemoria. Le specifiche restano quelle sotto.

#### Modalità focus con timer
**Avvio**: pulsante ▶ "Focus" sulla card, oppure "Inizia" dalla proposta di "Cosa faccio adesso?".

**Interfaccia**
- Foglio a tutto schermo con il titolo dell'attività e un anello SVG che fa il conto alla rovescia partendo dalla durata stimata, con il tempo grande (mm:ss).
- Comandi: Pausa/Riprendi, +5 min, Completa, Esci.

**Tempo affidabile**
- Lo stato sta in `aura-tasks:focus`: `{ taskId, startedAt, durationMs, pausedAt, pausedTotalMs }`.
- Tempo rimanente = `durationMs − (adesso − startedAt − pausedTotalMs)`.
- **Non contare mai i "tick"** di `setInterval`: su iOS i timer si fermano in background e col blocco schermo. Al ritorno (`visibilitychange`) si ricalcola, e ricaricando la pagina il focus riprende.
- La logica pura sta in `js/focus.js` ed è testabile passando `now`.

**Aggiornamento**: `requestAnimationFrame`, oppure un intervallo di 250 ms, solo mentre la pagina è visibile.

**Schermo acceso**: `navigator.wakeLock.request('screen')` dove supportato. Va richiesto di nuovo dopo `visibilitychange`, ed è facoltativo: senza, si continua lo stesso.

**Fine del tempo**
- Suono breve con Web Audio. L'`AudioContext` va creato o sbloccato al tocco su "Inizia", altrimenti iOS lo blocca.
- Vibrazione solo su Android: `navigator.vibrate` su iOS non esiste.
- Poi si propone "Completata" oppure "+5 min".

**Notifiche**: su iOS solo con l'app installata (iOS 16.4+) e il permesso concesso. Non esistono notifiche programmate offline, quindi non promettere avvisi ad app chiusa.

**Idee in più**: modalità Pomodoro (25/5); minuti di focus nelle statistiche, con un eventuale bonus punti.

#### "Cosa faccio adesso?"
**Interfaccia**
- Pulsante ben visibile nell'intestazione, che apre un foglio con due domande:
  - "Quanto tempo hai?", con i chip 10/15/30/45/60/90/120+;
  - "Come ti senti?", con energia bassa/media/alta.
- Ricorda l'ultima scelta.

**Algoritmo**: funzione pura `suggest(tasks, { minutes, energy, today, exclude, random })` in `js/suggest.js`.
- **Candidate**: attività non completate, con `duration ≤ minutes`, con `ENERGY[t.energy].order ≤ ENERGY[energy].order` e con data nulla oppure `≤ oggi`.
- **Punteggio** (i pesi stanno in costanti):
  - urgenza: in ritardo +50, più 5 per ogni giorno di ritardo fino a +30; oggi +30; senza data +10;
  - sfruttamento del tempo: `20 × durata / minuti`;
  - energia: +10 se uguale a quella disponibile (con energia alta si preferiscono le attività impegnative);
  - anzianità: +1 ogni 2 giorni dalla creazione, fino a +10;
  - un pizzico di casualità (±5) per variare. Si disattiva nei test passando `random: () => 0.5`.
- **Risultato**: la migliore più qualche alternativa, con il **motivo** in italiano. Per esempio: "È in ritardo da 2 giorni e ci sta nei tuoi 30 minuti".

**Azioni**: "Inizia focus", "Fatto", "Un'altra proposta". Quest'ultima esclude le attività già proposte nella sessione.

**Nessuna candidata**: un messaggio gentile con un suggerimento ("Hai più tempo?", "Una pausa ☕?") oppure l'attività più breve.

---

## Funzioni premium (in futuro)

In futuro alcune funzioni saranno **premium**, sbloccate con un **codice di licenza**.

Ogni nuova funzione va aggiunta a questa tabella con la sua categoria:

| Funzione | Categoria |
|---|---|
| Base: attività, lista per giorno, tema, uso offline | gratuita |
| Punti e serie di giorni | gratuita |
| Linguaggio naturale con orario e link ?add= | gratuita |

### Regola fondamentale
**Tutti i controlli passano da un'unica funzione `isPremium()`.**
- È prevista in `js/license.js` come `Aura.license.isPremium()`.
- Non è permesso:
  - leggere `aura-tasks:license` in altri file;
  - tenere flag "premium" sparsi;
  - duplicare controlli o confronti sul codice di licenza.
- Il resto del codice chiede soltanto `if (Aura.license.isPremium()) …`.

### Funzionamento previsto
- `isPremium()` è **sincrona**:
  - il codice salvato (`aura-tasks:license`) viene verificato all'avvio con `Aura.license.init()`, prima del primo `render()`;
  - viene verificato anche quando l'utente lo inserisce, con `Aura.license.activate(code)`, che restituisce una Promise<boolean>;
  - poi `isPremium()` restituisce il risultato tenuto in memoria.
- **Proposta per la verifica offline**:
  - il codice è un payload (per esempio `{ ordine, scadenza?, funzioni? }`) più una firma ECDSA P-256, in base64url;
  - nell'app c'è solo la **chiave pubblica**, e la verifica usa `crypto.subtle.verify`;
  - la chiave privata, che serve a generare i codici, **non entra mai** nel progetto né nel repository.
- `crypto.subtle` richiede un contesto sicuro (https o localhost). Se non è disponibile, `isPremium()` resta `false`, senza errori.
- **Limite da sapere**: tutto gira sul dispositivo, quindi chi modifica il JavaScript può aggirare il controllo. Serve solo come deterrente. Una protezione vera richiede un server di verifica, in conflitto con il vincolo "niente server": è una decisione da prendere più avanti.

### Interfaccia e dati
- Ogni funzione premium mostra la stessa etichetta "Premium".
- Se la funzione è bloccata, si apre il foglio "Sblocca con un codice", con il campo del codice e lo stato della licenza. Lo stesso foglio permette di rimuovere la licenza.
- Se la licenza manca, non è valida o scade, la funzione si blocca, **ma i dati creati restano**: non vanno mai cancellati.
- Per i test, `init()` accetta una chiave pubblica di prova: così si possono generare codici di test validi senza scorciatoie nel codice.

---

## Altre idee (non prioritarie)
- **Modificare un'attività**: riusare il foglio "Nuova attività" in modalità modifica.
- **Backup**: esportare e importare un file JSON. È importante perché i dati vivono solo nel browser. Utile anche per passare a un altro telefono.
- Attività ricorrenti: ogni giorno, ogni lunedì e così via.
- Statistiche settimanali, ordinamento manuale con trascinamento, scorrimento laterale per completare o eliminare.

## Ordine consigliato (visione "segretario personale")
Già fatto: punti e serie (schema v2), linguaggio naturale con orario e link `?add=` (schema v3).
1. ~~**Linguaggio naturale con orario** e aggiunta con il link `?add=testo`~~: fatto.
2. **Comando Rapido di Siri** che detta e apre il link, più **Web Share Target** e **shortcuts** nel manifest per Android.
3. **Promemoria**: prima l'esportazione `.ics`, poi le notifiche **Web Push** con un piccolo server gratuito.
4. **"Cosa faccio adesso?"** e **modalità focus**.

Licenza premium e backup vanno fatti quando servono. Il backup conviene prima di far usare l'app ad altre persone.

## Checklist prima di chiudere una modifica
- [ ] `tests/index.html` è tutto verde, con test nuovi per la logica nuova.
- [ ] Provato a 375–390 px di larghezza e su desktop, **in tema chiaro e scuro**.
- [ ] Se sono cambiati layout o animazioni: detto all'utente cosa provare sull'iPhone.
- [ ] Nessun errore in console, sia aprendo da `file://` sia da `http://localhost`.
- [ ] `sw.js` è aggiornato (`APP_FILES`, `CACHE_VERSION`) se sono cambiati file.
- [ ] Se lo schema è cambiato: `SCHEMA_VERSION` aumentato e passo aggiunto in `migrate()`.
- [ ] Questo file è aggiornato, compresa la categoria gratuita/premium delle funzioni nuove.
