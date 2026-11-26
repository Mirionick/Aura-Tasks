# Suoni del focus (passo 4.4 realizzato, gratuito; da provare sull'iPhone)

Passo 4.4 di [P-004](../../docs/proposte/P-004.md): tre suoni di sottofondo per il focus a tutto schermo, fatti da Aura con la Web Audio API, **senza file audio, senza diritti da pagare e anche senza rete**. **Rumore marrone** è di tutti; **Pioggia** e **Onde** costano 300 punti l'uno, nel negozio. All'inizio il suono in uso è **Silenzio**: finché non ne scegli uno, il focus è come prima.

Calcoli in `js/sound.js` (`Aura.sound`, funzioni pure), fatti fuori dal thread principale da `js/sound-worker.js`, con i test in `tests/sound.test.js`; l'audio, il pulsante «Suono» e il suo menu in `js/ui-sound.js` (`Aura.soundUI`), avviato da `app.js`; catalogo, acquisti e suono in uso (`look.sound`) in `js/shop.js`; l'ascolto di prova nel negozio in `js/ui-shop.js`.

## Dove
- **Nel focus a tutto schermo**, in alto a sinistra, il pulsante «Suono», di fronte a «🎧» e uguale a lui: un altoparlante, sbarrato con Silenzio. Il menu mostra i suoni che hai, con la spunta su quello in uso, e una nota per gli altri: «Pioggia e Onde sono nel negozio, in Motivazione.».
- **Nel negozio** (Motivazione, «Apri il negozio»), il gruppo «Suoni del focus»: Silenzio, Rumore marrone, Pioggia e Onde, ognuno con un'anteprima a barrette. Un tocco su un suono lo fa ascoltare per circa 4 secondi, con le barrette che si muovono, anche prima di comprarlo. Se è tuo diventa quello in uso; se il saldo basta lo compra, con «Annulla» (che ferma anche l'ascolto); se non basta, l'avviso dice quanti punti mancano.

## Quando suona
| Momento | Il suono |
|---|---|
| Il focus conta il tempo | quello in uso: parte 0,38 s dopo l'apertura (quando il foglio è fermo) ed entra piano, in 1,6 s |
| «Pausa», tempo finito, «Esci», «Completa» | se ne va in 0,6 s |
| Aura in secondo piano, schermo bloccato | si ferma subito; tornando riparte piano |
| Una scelta nel menu, con il tempo che conta | subito, con una dissolvenza incrociata di 0,8 s |
| Una scelta nel menu in pausa o a tempo finito | si ascolta per circa 4 s, poi si ferma |
| Un tocco su un suono nel negozio | circa 4 s; chiudendo il negozio si ferma |

- Sull'iPhone l'audio nasce solo dentro un tocco. Riaprendo Aura con un focus in corso, il suono parte al primo tocco nel foglio, come già il suono di fine.
- Il volume è quello del telefono.
- A tempo finito il suono del focus se ne va mentre arriva il suono di fine; con «+5 min» riparte.

## I tre suoni
- **Rumore marrone**: rumore bianco «integrato», con una piccola perdita perché resti intorno allo zero. Un fruscio profondo e uniforme, come una cascata lontana. Pezzo di 9 s.
- **Pioggia**: tre strati dallo stesso rumore bianco (le sue parti su frequenze diverse sono indipendenti, e così costa meno): il fruscio fine, passa-banda intorno a 2,5 kHz; il corpo della pioggia che cade, intorno a 650 Hz; e circa 140 gocce al secondo, colpetti di 2–12 ms (tanti piccoli e pochi forti) sopra 1,8 kHz. Pezzo di 7 s.
- **Onde**: il mare, rumore rosa e marrone insieme, in un pezzo di 6 s, passa in un filtro passa-basso e in un volume che salgono e scendono, più la schiuma (la sua parte sopra 2,5 kHz) con un volume suo. Ogni onda dura 6–10 s: cresce in 2,6–4,2 s, si frange e si ritira in 3,4–5,6 s; tra due onde 0,3–1,6 s di mare calmo. Forza 0,55–1; il filtro va da 500 Hz (mare calmo) a 1,5–3 kHz (cresta); la schiuma arriva con la cresta e se ne va più piano. Il programma è sempre diverso: Aura lo scrive sull'orologio dell'audio 10 s in anticipo, con un controllo ogni 1,5 s.
- Ogni pezzo ha due canali diversi (il suono si apre attorno), una giunta senza scatto (le ultime misure sfumano sulle prime per 0,4 s, a potenza costante), lo stesso volume medio (RMS 0,12) e il picco sotto 0,9, e ogni volta parte da un punto a caso. Si calcola a metà della frequenza dell'audio (24 kHz sull'iPhone): 10–45 ms sul PC, ma la pioggia, calcolata nella pagina la prima volta, ne costava 60–90, il triplo con la CPU 4 volte più lenta. Per questo lo calcola un lavoratore (Web Worker, `js/sound-worker.js`), fuori dal thread principale: il tocco che fa partire un suono non lo aspetta e l'aurora del focus non si ferma. Se il lavoratore non parte (per esempio aprendo `index.html` come file), il pezzo si calcola nella pagina, dopo il disegno. Poi resta in memoria (al massimo due pezzi, 1–2 MB l'uno).

## Volume
I tre suoni si sentono forti uguali, un po' sotto il suono di fine. Misura della loudness con la pesatura K (ITU-R BS.1770, approssimata con due filtri biquad) sull'uscita vera di Chromium, sui due canali, durante il focus (`loud-44.js` delle prove):

| Suono | Loudness |
|---|---|
| Rumore marrone | −21,9 LUFS |
| Pioggia | −22,0 LUFS |
| Onde | −23,2 LUFS in media: −27,6 il mare calmo, −17,3 la cresta più forte |
| Suono di fine (per confronto) | −21,3 LUFS al massimo (finestra di 0,68 s) |

Da qui i ritocchi `VOLUME` di `js/ui-sound.js`: 0,54 il rumore marrone, 0,39 la pioggia, 1,35 le onde.

## L'audio dell'iPhone
- Con un suono in uso Aura sceglie la sessione audio **«playback»** (`navigator.audioSession.type`, Safari 16.4 e successivi), prima di suonare: il suono si sente anche con il silenzioso, e la musica delle altre app (Spotify) si ferma, come con ogni app che suona. Due secondi dopo l'ultimo suono la sessione torna **«auto»**, come prima: il suono di fine si mescola alla musica e il silenzioso lo zittisce. Senza un suono in uso non cambia niente. Dove l'API non c'è (Chrome, Android) non fa niente.
- L'altra strada, **«ambient»**, si mescolerebbe con Spotify ma il silenzioso la zittirebbe: la scelta si decide provandola sull'iPhone (domanda 3 qui sotto).
- L'AudioContext è quello del focus (`js/ui-focus.js`), creato e sbloccato dentro un tocco; se Safari lo lascia «interrupted», viene ripreso come per il suono di fine.

## Dati
- `look.sound`: `none` (Silenzio, il valore di partenza), `brown`, `rain` o `waves`. Il catalogo aggiunge `sound:rain` e `sound:waves`, 300 punti l'uno.
- Lo schema resta alla versione 7: `look.sound` è una chiave in più di `look`, pulita da `sanitizeLook`, in ordine `aurora`, `confetti`, `sound`, `at`. Una versione di Aura più vecchia tiene le chiavi di `look` che non conosce, quindi la scelta non si perde. Un suono comprato con una versione più nuova resta nei dati e qui vale Silenzio.
- Il backup lo contiene già, dentro `look`. Al server non va niente.

## Accessibilità e movimento
- «Suono» è un pulsante di 44×44 px con l'etichetta «Suono: Rumore marrone» (o «Suono: silenzio»), `aria-expanded` e `aria-controls`. Con Tab viene prima di «🎧», come si vedono, da sinistra a destra. Il menu è un `radiogroup` con il titolo «Suono» e radio vere: con le frecce si cambia suono, e il suono cambia subito. All'apertura il focus va sul suono in uso; Esc chiude prima il menu (il focus torna sul pulsante) e poi, di nuovo, esce dal focus; un tocco fuori lo chiude. Scelte alte 44 px; con la spaziatura del testo di WCAG 1.4.12 le scritte vanno a capo e niente si taglia.
- Il menu ha un fondo pieno: si legge anche sopra l'aurora che scorre, senza sfocature che costano.
- Nel negozio un suono è sempre un pulsante, anche senza i punti per comprarlo, perché un tocco lo fa ascoltare: l'etichetta lo dice («Ascolta Onde, 300 punti: te ne mancano 200»). Colori e forme restano grigi e toccabili come prima (`aria-disabled`).
- Con «Riduci movimento» il menu compare senza il piccolo ingresso, e le barrette non si muovono; il suono c'è lo stesso, perché non è movimento.
- Niente suona da solo: serve sempre un tocco, e il suono in uso lo sceglie chi usa Aura.

## Codice
- `js/sound.js`: `random` (numeri casuali ripetibili), `white`, `brownNoise`, `pinkNoise`, `biquad` e `filter` (filtri), `loopable` (la giunta), `rmsOf`, `normalize`; i tre suoni `brown`, `rain`, `sea`, e `piece`, che li chiama per nome (lo usa il lavoratore); `nextWave` e `waveCurves` (il programma delle onde); le frasi `shopNote` e `buttonLabel`. Niente DOM e niente Web Audio.
- `js/sound-worker.js`: il lavoratore. Carica `sound.js` con `importScripts`, riceve `{ id, name, rate, seed }` e risponde `{ id, channels }` (i due canali passano senza copia) oppure `{ id, error: true }`. È nella cache del service worker, come `sound.js`: offline i suoni si calcolano lo stesso.
- `js/ui-sound.js`: i pezzi calcolati (nel lavoratore, o nella pagina se non parte) e tenuti in memoria, la «voce» che suona (con le dissolvenze), il programma delle onde, la sessione audio, il pulsante e il menu, l'ascolto di prova. API per `app.js`: `render`, `sync`, `beforeAudio`, `refresh`, `closeMenu`, `preview`, `stopPreview`.
- `js/ui-focus.js`: `ctx.onRunning(running)` ogni volta che decide se il focus conta il tempo; `ctx.beforeAudio()` prima dello sblocco e `ctx.onAudioUnlocked()` dopo; con il menu aperto Esc lo chiude (`ctx.onCancel`); `getAudio` e `unlockAudio` per i suoni.
- `js/shop.js`: il gruppo `sound`, gli oggetti gratis (`isFree`), `defaultLook` con `sound: 'none'`.
- `js/ui-shop.js`: le anteprime a barrette (`BARS`), l'ascolto con un tocco, che si ferma con «Annulla» e chiudendo il foglio.
- `css/style.css`: i colori delle barrette (`--sound-*`, nei due temi), il pulsante, il menu e le barrette che si muovono. Cache del service worker `aura-tasks-v24`.

## Risultati del passo 4.4
Prove del 21 novembre 2026 in Chromium 153 con Playwright 1.63, contesto «iPhone 13» (390×664) e 320 px, nei due temi. L'audio è vero: l'uscita si legge con un `AnalyserNode`; la sessione audio è finta (`navigator.audioSession`); l'audio nasce solo dopo un tocco (`--autoplay-policy=user-gesture-required`); per il tempo finito, l'orologio finto (`page.clock`).

- **111 controlli superati su 111** (`check-44.js` delle prove):
  - niente audio prima di un tocco; il rumore marrone si sente circa 0,95 s dopo il tocco, quando il foglio è fermo; la sessione «playback» è scelta prima di creare l'audio e torna «auto» 2 s dopo «Pausa»; «Pausa», «Esci», Esc e «Silenzio» lo fermano in circa 0,6 s; «Riprendi», «Annulla» e «+5 min» lo fanno tornare; in secondo piano si ferma in 0,13 s e tornando riparte piano; a tempo finito se ne va mentre arriva il suono di fine;
  - il menu con Invio, le frecce (il suono cambia subito), Maiusc+Tab, Esc in due tempi, il tocco fuori, «Esci» con il menu aperto; in pausa un suono si ascolta per circa 4 s e diventa quello in uso; ricaricando, il focus in pausa riapre con il suono giusto e niente audio senza un tocco;
  - le onde: in 16 s il volume va da 0,024 a 0,121 sull'analizzatore, senza silenzi; alti su bassi da −38 dB (mare calmo) a −9 dB (cresta), contro −15,5 dB del rumore marrone e +13,7 dB della pioggia;
  - il negozio: aprirlo non crea l'audio; l'ascolto con le barrette che si muovono e poi si fermano; comprare con «Annulla», che ferma anche l'ascolto; un altro suono che prende il posto; chiudere il foglio; con pochi punti, a 320 px nel tema scuro, un suono si ascolta lo stesso, con l'avviso «Ancora 200 punti per Onde», e niente si compra;
  - un suono di una versione più nuova («thunder»): qui vale Silenzio, e resta nei dati;
  - a 390 e 320 px nei due temi: pulsante di 44×44 e scelte alte 44 px; «Suono» e il menu non toccano «🎧»; il menu sta nello schermo; axe-core 4.10.2 senza violazioni su «Suono» e il suo menu, e niente di nuovo su tutto il focus; con il testo spaziato niente di tagliato;
  - «Riduci movimento»: il menu senza ingresso, le barrette ferme, il suono c'è lo stesso;
  - la pioggia calcolata nel lavoratore, e senza il file del lavoratore nella pagina: suona lo stesso. In tutte le parti nessun errore in console e nessun messaggio della CSP.
- **Ripasso con le skill** accessibility, make-interfaces-feel-better e browser-qa (`ripasso-44.js`), **31 controlli superati su 31**: con Tab «Suono» viene prima di «🎧» e il resto dell'ordine è quello di prima; albero dell'accessibilità con nomi e stati; contorno del focus di 2 px a 2 px, come «🎧»; icone centrate entro 0,3 px; raggi concentrici; nessuna `transition: all`; offline i file del lavoratore arrivano dalla cache di Aura, anche con Aura riaperta senza rete; 768 e 1440 px; INP dei tocchi che fanno partire un suono 24–48 ms (104–120 con la CPU 4 volte più lenta), come comprare un colore (32 e 112). Corretti con il ripasso: «Suono» veniva dopo «🎧» con Tab; la nota della card «Negozio» andava su tre righe e spezzava «Ripara la serie», ora è «Colori, coriandoli, suoni e «Ripara la serie»», su due righe a 390 px come prima.
- **Pixel per pixel** contro il ramo di prima (rifiniture per gli schermi piccoli), a 390 px nei due temi: Focus, Agenda e la parte alta del negozio identiche; Motivazione diversa solo dentro la card «Negozio», nella nota.
- **Velocità** contro il ramo di prima: con il rumore marrone in uso (nel ramo parte con «Inizia»), mediana di 7 prove alternate: con la CPU normale LCP 116 contro 124 ms, INP 48 contro 48, nessun fotogramma perso in nessun gesto (Motivazione, aprire e chiudere il negozio, Focus, «Cosa faccio adesso?», «Inizia», «Pausa», «Esci»); con la CPU 4 volte più lenta LCP 368 contro 396, INP 128 contro 136, gli stessi fotogrammi persi in ogni gesto (6 nel cambio di scheda verso Motivazione, 1 aprendo il negozio, 1 in «Cosa faccio adesso?», 1 in «Inizia», 0 negli altri); CLS 0.
- **Test**: 349 test dell'app superati in cinque fusi orari (Roma, New York, Auckland, San Paolo, UTC); 70 test del server su 70.
- **Non provato**: WebKit (sul PC non ha `AudioContext`) e l'iPhone vero, con il silenzioso e con Spotify: vedi qui sotto.

## Da verificare sull'iPhone
1. Nel focus, «Suono» → «Rumore marrone»: entra piano. «Pausa» lo ferma, «Riprendi» lo fa tornare, «Esci» lo spegne.
2. Con un suono, blocca lo schermo o passa a un'altra app: il suono si ferma. Tornando in Aura riparte (se serve, dopo un tocco nel foglio).
3. **Con Spotify che suona**: avvia il focus con un suono. Con la scelta di adesso («playback») Spotify si ferma e il suono di Aura si sente anche con il silenzioso. Va bene così, o preferisci che i suoni si mescolino con Spotify (ma allora il silenzioso li zittisce)?
4. Nel negozio, tocca «Pioggia» e «Onde» per ascoltarle prima di comprarle.
5. I tre suoni ti piacciono? La pioggia sembra pioggia e le onde sembrano onde? Il volume tra loro, e con il suono di fine, va bene?
6. Facoltativa: tema scuro, «Riduci movimento», il telefono in orizzontale con il menu aperto.
