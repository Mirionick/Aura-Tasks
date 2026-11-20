# Attività che si ripetono (passo 5.1 realizzato, gratuito; da provare sull'iPhone)

Passo 5.1 di [P-005](../../docs/proposte/P-005.md): un'attività può ripetersi ogni giorno, ogni settimana nei giorni scelti oppure ogni mese. Ce n'è sempre **una sola da fare per volta**: quando la completi, Aura prepara la prossima. Tutto resta sul telefono, dentro Aura, senza calendari esterni.

Logica pura in `js/repeat.js` (`Aura.repeat`): le regole, il giorno della prossima volta, i testi e la pulizia dei dati letti. Le attività in `js/tasks.js` (`toggleDone()`, `skipOccurrence()`, `openInSeries()`); i punti in `js/points.js` (`setDone()` restituisce anche `next`, la prossima); il foglio, la card e gli avvisi in `js/app.js`. Test in `tests/repeat.test.js`.

## Le regole
| Scelta | Regola salvata | Testo |
|---|---|---|
| Mai | `null` | — |
| Ogni giorno | `{ every: 'day' }` | «Ogni giorno» |
| Ogni settimana | `{ every: 'week', days: [1, 4] }` (1 = lunedì … 7 = domenica, in ordine e senza doppi) | «Ogni lunedì e giovedì»; «Dal lunedì al venerdì»; con tutti e sette i giorni, «Ogni giorno» |
| Ogni mese | `{ every: 'month', day: 15 }` (da 1 a 31) | «Ogni mese, il giorno 15»; dal 29 al 30 «… (a febbraio l'ultimo)»; il 31 «Ogni mese, l'ultimo giorno» |

- Nei mesi più corti vale l'ultimo giorno: «ogni mese il 31» è il 30 aprile e il 28 febbraio (29 negli anni bisestili), poi torna al 31.
- Le regole lavorano sui giorni (`AAAA-MM-GG`), non sulle ore: il cambio dell'ora legale non sposta niente.
- Si ripete solo un'attività **con un giorno**. Toccando una scelta senza giorno, il giorno diventa il primo giusto da oggi in poi, oggi compreso. Togliendo il giorno, «Si ripete» torna «Mai».

## Nel foglio «Nuova attività» e «Modifica attività»
- Dopo «Ora», il campo **«Si ripete»**: quattro chip, due per riga, alte 44 px come le altre (in colonne uguali, come nelle rifiniture della PR 14).
- **Ogni settimana** mostra sotto i sette giorni, L M M G V S D, cerchi da 44 px allineati ai bordi del campo (sotto i 375 px di larghezza si stringono: 37 px a 320). Il lettore di schermo legge il nome intero («Lunedì»). All'inizio è acceso il giorno della data; almeno uno resta acceso.
- **I giorni seguono la data** finché ce n'è uno solo acceso: cambiando la data da mercoledì a giovedì, il giorno acceso diventa giovedì. Con due o più giorni scelti a mano, cambiare la data non li cambia. «Ogni mese» segue il giorno del mese della data, allo stesso modo.
- Sotto, una riga dice la regola e il giorno dopo questa: «Ogni lunedì e giovedì · dopo questa, giovedì 26 novembre». È una regione «live» (`aria-live="polite"`), sempre nella pagina e vuota con «Mai», così il lettore di schermo la annuncia quando cambia; si riscrive solo se il testo cambia.
- **«Salta questa volta»** c'è solo nel foglio di modifica di una ripetizione da fare.
- Per un'attività completata il campo non si vede; salvandola, la sua regola resta.

## Completare
- Punti, serie, festa e «Annulla» sono quelli di sempre: ogni volta completata è un'attività completata e resta in «Completate» con i suoi punti.
- La prossima arriva da sola: stesso titolo, durata, energia e ora, la stessa serie (`seriesId`), nel **primo giorno della regola dopo il più tardi tra il suo giorno e oggi**. Completata in anticipo (quella di lunedì, il sabato prima) non cade lo stesso lunedì; completata in ritardo, la prossima non va nel passato.
- L'avviso dice quando torna: «Completata · +24 punti · torna domani», «… · torna giovedì» (entro una settimana), «… · torna lunedì 7 dicembre» (più in là; con l'anno, se è un altro).
- **Una sola da fare per serie**: un doppio tocco, o un'altra volta della stessa serie già da fare, non crea una seconda prossima.
- **«Annulla»** toglie la prossima (se è ancora da fare) e poi la spunta: tutto torna com'era, punti compresi.
- **Togliere la spunta** più tardi, da «Completate»: se la serie ha già la sua prossima da fare, quella completata torna da fare come attività normale, senza regola; se non ce l'ha più (per esempio è stata eliminata), torna da fare con la sua regola.

## Saltare, mancare, modificare, eliminare
- **«Salta questa volta»**: questa volta non si fa e non dà punti. Va al primo giorno della regola dopo il suo, ma **non prima di oggi** (oggi compreso, perché quella di oggi è ancora da fare). Prima salva le modifiche del foglio, se ce ne sono. Avviso «Spostata a giovedì 26 novembre» o «Spostata a oggi», con «· ora in Agenda» se finisce in un'altra scheda, e «Annulla», che la rimette nel suo giorno se è ancora lì. Se la card esce dalla scheda, il focus resta nella pagina (`#main`).
- **Una volta mancata** resta «In ritardo», come ogni attività di un giorno passato, finché non la completi o la salti. Non se ne accumulano altre.
- **Modificare** la ripetizione da fare cambia lei e le prossime: la regola vive in quella da fare. Le volte completate non cambiano.
- **Eliminare** la ripetizione da fare ferma la serie, con il solito «Annulla». Per fermarla senza eliminarla: «Si ripete: Mai».

## Sulla card
- Dopo l'ora, una piccola icona ↻ del colore dell'accento (`.meta--repeat`). Il lettore di schermo legge la regola: «Si ripete ogni lunedì e giovedì».
- Solo sulle attività da fare: in «Completate» non c'è.

## Nella frase e con Siri
- In «Scrivi in una frase» e nelle frasi di Siri: «ogni giorno» e «tutti i giorni», «ogni lunedì» (anche «ogni lunedì e giovedì», «ogni lun, mer e ven»), «ogni settimana» (nel giorno della data, o di oggi), «ogni mese» (nel giorno della data, o di oggi). Esempio: «palestra ogni lunedì e giovedì alle 18» compila giovedì, le 18:00 e la regola. Vedi [linguaggio-naturale.md](linguaggio-naturale.md).
- Il riepilogo della frase lo dice: «Capito: Domani · ogni lunedì e giovedì · alle 18:00».
- **L'assistente** non sa ancora creare ripetizioni: con l'assistente acceso, una frase di Siri con «ogni …» si apre in «Nuova attività», dove la frase si capisce, invece di passare da lui.

## Promemoria
Il promemoria push riguarda solo la volta da fare, come ogni attività con giorno e ora: ogni salvataggio manda al server l'elenco aggiornato, quindi la prossima ha il suo promemoria. Una volta in ritardo non manda un promemoria nuovo il giorno dopo.

## Dati
- **Schema v7**: nelle attività `repeat` (la regola, oppure `null`) e `seriesId` (lo stesso in tutte le volte di una serie: l'id della prima; `null` per un'attività che non si è mai ripetuta). `migrate()` cambia solo il numero di versione: le attività che c'erano non si ripetono.
- Le pulisce `Aura.repeat.sanitize()`, chiamata da `sanitizeTask()` in `js/storage.js`: una regola vale solo con un giorno; una regola non valida diventa `null`; un `seriesId` non valido (non una stringa, vuota o più lunga di 100 caratteri) diventa l'id dell'attività. I campi sconosciuti della regola restano.
- Il backup contiene `repeat` e `seriesId`; i backup di tutte le versioni di prima si importano ancora.
- Al server non va niente di nuovo.

## Movimento
La prossima entra come ogni card nuova, con la tecnica FLIP di `js/motion.js`. I giorni e le chip usano gli stessi passaggi di colore e di scala delle altre chip; con «Riduci movimento» non si muove niente.

## Test
`tests/repeat.test.js`: le regole e la loro pulizia; il giorno dopo con i mesi corti, gli anni bisestili e il cambio dell'ora; completare e saltare con gli esempi di P-005 e, per tutte le 162 combinazioni di regola, giorno e oggi, mai nel passato; i testi; la validazione, la creazione e la modifica; una sola prossima per serie; togliere la spunta; punti e «Annulla»; la migrazione dalla v6; il backup.

## Risultati del passo 5.1
- **Prove**: 324 test dell'app in Chromium headless con il fuso di Roma, New York, Auckland, San Paolo e UTC; 70 del server.
- **Nel browser** (Chromium 153 con Playwright 1.63, contesto «iPhone 13» e larghezze da 320 a 1440 px, orologio finto): 59 controlli del passo (foglio, giorni, frase, card, avvisi, «Annulla», «Salta questa volta», due temi, axe-core 4.10.2 con WCAG 2.0, 2.1, 2.2 A e AA e best practice, «Riduci movimento», nessun errore e nessun messaggio della CSP).
- **Skill accessibility** (19 controlli): ordine con la tastiera (Mai, Ogni giorno, Ogni settimana, Ogni mese, poi i sette giorni, poi «Salta questa volta»), contorno visibile e non coperto, Spazio e Invio, Esc che riporta il focus su «+ Nuova attività», la riga della regola «live», spaziatura del testo WCAG 1.4.12 da 320 a 430 px senza niente di tagliato, aree di tocco di 44 px.
- **Skill browser-qa**: con attività che non si ripetono, Focus, Agenda, Motivazione e la parte alta del foglio sono identiche pixel per pixel alla base senza il passo, nei due temi. Velocità uguale alla base (mediana di 5 prove alternate): LCP 124 contro 124 ms e INP 32 contro 32 ms; con la CPU 4 volte più lenta LCP 412 contro 400 ms, INP 88 contro 104 ms; completare una ripetizione 32 ms e 3 fotogrammi persi contro 32 ms e 5 per un'attività normale nella base; CLS 0.
- **Skill make-interfaces-feel-better**, prima e dopo:

| Che cosa | Prima | Dopo |
|---|---|---|
| Fila dei giorni | 8 px più larga del campo per lato; cerchi ovali 49×44 a 390 px | allineata ai bordi del campo; cerchi 44×44 da 375 px in su |
| Chip di «Si ripete» | a 390 px tre in una riga e «Ogni mese» da sola sotto, a 320 px due e due: la forma cambiava con lo schermo | due per riga a ogni larghezza, in colonne uguali (quattro in una riga non ci stanno nel foglio del computer, largo 520 px) |
| Riga della regola | «novembre» da solo sull'ultima riga | a capo senza parole sole (`text-wrap: pretty`) |
| «Salta questa volta» | la stessa icona ↻ della card | un'icona sua: una freccia che salta |
| Focus con la tastiera nel foglio | il contorno di «Mai» e «Ogni giorno» tagliato dal bordo che scorre | 12 px di margine (`scroll-padding-block`): il contorno si vede intero |

## Da verificare sull'iPhone
- «palestra ogni lunedì e giovedì alle 18» scritta nella frase e detta a Siri: i campi compilati e il riepilogo.
- Completare una ripetizione: l'avviso «torna …», la prossima nel giorno giusto (in Agenda, se è un altro giorno), «Annulla»; con i promemoria attivi, il promemoria della prossima.
- «Salta questa volta» nel foglio di modifica, e «Annulla».
- I giorni della settimana con il pollice, nei due temi, con «Riduci movimento» e con «Dimensione testo» più grande.
