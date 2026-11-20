# Scorrimento sulle card (passo 5.2 realizzato, gratuito; da provare sull'iPhone)

Passo 5.2 di [P-005](../../docs/proposte/P-005.md): sulle card delle attività da fare, con il dito, **verso destra si completa** e **verso sinistra si elimina**, tutti e due con «Annulla». È un modo in più: la spunta e il cestino restano, per la tastiera, per il lettore di schermo e per chi non vuole scorrere.

Regole pure in `js/swipe.js` (`Aura.swipe`), con i test in `tests/swipe.test.js`; gli eventi della pagina in `js/ui-swipe.js` (`Aura.swipeUI`), avviato da `app.js`; lo sfondo dietro la card nel `<template id="swipe-template">` di `index.html`.

## Dove
- Sulle card **da fare** di Focus e di Agenda (anche «Con orario» e «Prossimi giorni»).
- Non sulle completate (in «Completate» e nella cronologia di Motivazione), non su una card che sta finendo di completarsi, non con un foglio aperto.
- Solo con il dito e con la penna: con il mouse trascinare serve a selezionare il testo, e niente si muove.

## Il gesto
| Che cosa | Misura |
|---|---|
| La direzione si decide dopo | 10 px dal punto in cui il dito si appoggia |
| La card scorre di lato se il dito va di lato almeno | 1,5 volte più che in verticale (altrimenti è la pagina che scorre, e la card non si muove fino alla fine del gesto) |
| Un dito che parte vicino al bordo dello schermo | a meno di 24 px non sposta la card: in Safari quei bordi servono per tornare indietro |
| Soglia | 40% della larghezza della card |
| Colpo veloce | almeno 0,5 px al millisecondo e almeno 48 px, nella stessa direzione |
| Velocità | quella degli ultimi 100 ms: il dito fermo prima di lasciare non è un colpo veloce |

- La pagina continua a scorrere in verticale come prima: le card da fare hanno `touch-action: pan-y pinch-zoom`, così il browser tiene per sé lo scorrimento verticale e lo zoom, e solo i movimenti di lato arrivano alla card.
- La card segue il dito dal punto in cui la direzione si decide, senza saltare dei 10 px già fatti, al massimo di una sua larghezza.
- Dietro, dalla parte che si scopre: verso destra, verde con la spunta e «Fatto»; verso sinistra, rosso con il cestino e «Elimina». Sotto la soglia il colore è tenue; oltre, lo strato pieno appare e l'icona si ingrandisce un attimo (su Android anche una piccola vibrazione: su iOS `navigator.vibrate` non c'è). Lasciando sotto la soglia, la card torna al suo posto.
- Un colpo veloce nella direzione opposta annulla, anche oltre la soglia: è un ripensamento.
- Lasciando la card dopo uno scorrimento la modifica non si apre e la spunta non cambia: se alla fine del gesto il browser manda un clic, nei 400 ms dopo, quel clic non fa niente. Un tocco nuovo funziona come sempre, anche subito.
- Mentre la card scorre, la pagina non si allarga di lato (`overflow-x: clip` su `#main`, solo durante il gesto).

## Che cosa succede
- **Verso destra**, come la spunta: la card torna al suo posto, poi punti, festa e «Annulla»; per una ripetizione arriva la prossima, con «torna …» (passo 5.1).
- **Verso sinistra**, come il cestino: la card continua verso sinistra e sfuma, le altre salgono al suo posto, «Attività eliminata» con «Annulla», che la rimette dov'era.

## Accessibilità e movimento
- Lo sfondo è solo per gli occhi (`aria-hidden`): la tastiera e il lettore di schermo usano la spunta e il cestino, che restano uguali.
- Contrasto del testo «Fatto» ed «Elimina» di almeno 4,5 a 1, sul colore tenue e su quello pieno, nei due temi: nel tema chiaro testo bianco sul pieno, nel tema scuro testo scuro (`--on-swipe`).
- Con «Riduci movimento» la card segue comunque il dito (lo muove chi la tocca), ma al rilascio niente rimbalzi: torna subito al suo posto, oppure l'azione parte come oggi, senza animazioni.
- Solo `transform` e `opacity`. Una scrittura per fotogramma: i movimenti arrivati intanto si raccolgono e la card si sposta una volta, con `requestAnimationFrame`; lo sfondo cambia solo quando cambiano il lato o la soglia. Durante il gesto la card ha `will-change: transform`.

## Codice
- `js/swipe.js`: `accepts` (dito o penna), `atEdge` (bordi), `lock` (direzione), `offset` (dove sta la card), `side`, `armed` (soglia), `velocity`, `decide` (al rilascio) e `track`, un gesto intero passo per passo. Niente DOM.
- `js/ui-swipe.js`: un solo ascoltatore per tipo di evento (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`, e il clic in cattura) su `#main`, per tutte le liste, che si ridisegnano a ogni cambio. Se la lista si ridisegna sotto il dito (un minuto nuovo, un'altra scheda del browser), il gesto finisce senza fare niente.
- `js/motion.js`: l'opzione `slideX` di `play()`, perché il fantasma della card eliminata continui il gesto (con `ease-out`); senza, l'eliminazione con il cestino scivola di 28 px a destra come prima.
- `js/app.js`: `onDelete(id, slideX)` restituisce se ha eliminato; avvio di `Aura.swipeUI`. Il calendario dell'Agenda, che già si scorre di lato, e il carosello della musica stanno fuori dalle card: nessun conflitto.
- Niente dati nuovi: lo schema resta alla versione 7, il backup è uguale, al server non va niente.

## Risultati del passo 5.2
Prove del 20 novembre 2026 in Chromium 153 con Playwright 1.63, contesto «iPhone 13» (390×664), con il dito simulato dal protocollo di Chrome (`Input.dispatchTouchEvent`): come un dito vero, un gesto in verticale fa scorrere la pagina e il browser manda `pointercancel`. WebKit qui non c'è: Safari va provato sull'iPhone.

- **Il gesto, 48 controlli superati su 48**: le card da fare con `touch-action: pan-y pinch-zoom`; un gesto in verticale sopra le card fa scorrere la pagina e la card resta ferma; mentre la card scorre la pagina non si allarga di lato; verso destra oltre la soglia completa, con lo strato pieno, punti e «Annulla» che la rimette da fare, punti compresi; sotto la soglia lo sfondo è tenue e la card torna al suo posto; lasciando, la modifica non si apre e la spunta non cambia, e un tocco nuovo apre la modifica come sempre (in una prova a parte anche 90 ms dopo il rilascio); verso sinistra la card continua e sfuma mentre le altre salgono, «Annulla» la rimette al suo posto; un colpo veloce di 72 px elimina, gli stessi 72 px lenti no; dai bordi (12 e 380 px) e con il mouse niente si muove; niente in «Completate» e con un foglio aperto; una ripetizione completata scorrendo dice «torna domani»; in Agenda, «Prossimi giorni» e «Con orario»; «Riduci movimento»; 320 e 430 px; l'intestazione resta di 188 px; nessun errore e nessun messaggio della CSP.
- **Contrasto** del testo sullo sfondo, tenue e pieno: nel tema chiaro «Fatto» 4,64 e 5,31, «Elimina» 4,78 e 5,48; nel tema scuro 8,56 e 10,53, 7,22 e 8,48. axe-core 4.10.2 con il dito ancora giù: nessuna violazione in `#main`, nei due temi.
- **Ripasso con le skill accessibility, make-interfaces-feel-better e browser-qa, 27 controlli superati su 27**: con Tab i primi 24 passi in Focus sono gli stessi del passo 5.1; lo sfondo è `aria-hidden`, non ha niente che prenda il focus e «Fatto» ed «Elimina» non arrivano al lettore di schermo; con la spaziatura del testo di WCAG 1.4.12, a 320, 375 e 430 px, l'azione sta tutta nello sfondo, al 30% e al 60%, dalle due parti; lo sfondo ha il raggio e la sagoma della card (16 px), nessuna `transition: all`; «Attività eliminata» entra nella regione «live» dell'avviso, che c'era già, e «Annulla» si tocca su 48 px; spunta e cestino di 44×44 px anche a 320 px.
- **A riposo** Focus, Agenda, Motivazione e la parte alta del foglio «Nuova attività» sono identici pixel per pixel al passo 5.1, nei due temi.
- **Fluidità**, fotogrammi persi (mediana di 8 prove; con la CPU normale 0 dappertutto). Con la CPU 4 volte più lenta: la card che segue il dito 0, come la pagina che scorre con lo stesso gesto (0); completare scorrendo 0,5 contro 2 della spunta; eliminare scorrendo 1 contro 1 del cestino. Il primo completamento, o la prima eliminazione, di una pagina costa di più anche con la spunta e il cestino: ogni prova ne fa uno prima, che non si misura, e l'ordine si alterna.
- **Velocità** contro il passo 5.1, mediana di 5 prove alternate, con gli stessi gesti (aprire «Nuova attività», «Domani», «Ogni settimana» e un giorno, chiudere, completare con il clic, poi toccare con il dito una spunta, che ora passa anche dagli ascoltatori dello scorrimento): LCP 124 contro 148 ms, INP 24 contro 32 ms, il tocco con il dito 24 contro 24 ms; con la CPU 4 volte più lenta LCP 404 contro 472 ms, INP 104 contro 104 ms, il tocco 32 contro 48 ms; CLS 0. Le differenze stanno nel rumore della misura: niente è più lento.
- **Test**: 335 test dell'app superati su 335 (11 nuovi in `tests/swipe.test.js`), con il fuso di Roma, New York, Auckland, San Paolo e UTC; il server non cambia.

## Da verificare sull'iPhone
1. Scorrere la lista in su e in giù con il dito sopra le card: deve scorrere la pagina, e le card non si muovono.
2. Una card verso destra oltre la soglia: «Fatto», poi punti, festa e «Annulla». Con una ripetizione, «torna …».
3. Una card verso sinistra: «Elimina», la card che esce, le altre che salgono, «Annulla» che la rimette.
4. Un colpo veloce corto, e uno lento sotto la soglia (la card torna al suo posto). Lasciando la card non si apre la modifica; toccandola dopo, sì, come sempre.
5. Il gesto dal bordo sinistro dello schermo: in Safari torna indietro la pagina; nell'app installata niente. La card non si muove.
6. La soglia (40%), la velocità del colpo e i colori vanno bene così?
7. Facoltativa: tema scuro, «Riduci movimento», l'Agenda con «Prossimi giorni».
