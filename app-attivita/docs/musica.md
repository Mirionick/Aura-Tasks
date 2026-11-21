# Musica nel focus (passo 4.2 realizzato, gratuito; da provare sull'iPhone)

Passo 4.2 di [P-004](../../docs/proposte/P-004.md): la musica per concentrarsi, **senza collegare nessun account**. Si sceglie il servizio una volta, nelle Impostazioni; poi in Focus ci sono cinque playlist, una per umore, che si aprono nell'app del servizio. Il collegamento vero con Spotify (canzoni nel carosello, comandi nel focus a tutto schermo) è il passo 4.3, che aspetta la risposta del Product Owner su Spotify Premium; i suoni del focus sono il passo 4.4, fatto ([suoni.md](suoni.md)): suonano dentro Aura, e con la musica di un'altra app si provano sull'iPhone.

Logica pura in `js/music.js` (`Aura.music`), con i test in `tests/music.test.js`; la pagina la tocca `js/ui-music.js` (`Aura.musicUI`), avviato da `app.js`.

## Il servizio: riga «Musica» delle Impostazioni
- Nel foglio «Impostazioni», dopo «Tema», il gruppo «Musica»: quattro scelte in due colonne, **Spotify**, **Apple Music**, **Amazon Music** e **Nessuno**, come le scelte del tema (bordo dell'accento e spunta su quella di adesso).
- Toccandone una la scelta vale subito e il foglio resta aperto. La riga dice che cosa succede:

| Scelta | Che cosa dice la riga |
|---|---|
| ancora nessuna | «Da scegliere: le playlist si aprono nell'app del servizio» |
| Spotify | «Spotify: le playlist si aprono nell'app Spotify» |
| Apple Music | «Apple Music: le playlist si aprono nell'app Musica» |
| Amazon Music | «Amazon Music: le playlist si aprono nell'app Amazon Music» |
| Nessuno | «Nessuno: niente musica in Focus» |

- Sotto le scelte una nota: «Aura apre solo il link della playlist, nell'app del servizio: non collega il tuo account e non manda niente di tuo.»
- Per la tastiera e i lettori di schermo è un gruppo di scelte (`role="radiogroup"`) che si chiama «Musica» e ha come descrizione lo stato della riga; le frecce cambiano la scelta.
- La scelta resta su questo telefono, nelle preferenze (`aura-tasks:prefs`), e **non va nel backup** (lo fissa un test).

## L'avviso, in Focus
- Dove: nella scheda Focus, sotto la striscia «Cosa faccio adesso?», prima delle sezioni. Una riga sola, alta 48 px come la striscia: «🎧», «Musica mentre ti concentri?» e, sotto, «Scegli il tuo servizio»; a destra la ×.
- Quando c'è (`Aura.music.view()`):
  - nessun servizio scelto e nessun rimando, oppure è arrivato il giorno del rimando;
  - solo quando c'è la striscia, cioè con almeno un'attività in Focus: senza attività prima viene la prima attività;
  - mai in Agenda, in Motivazione e nel focus a tutto schermo, che resta calmo.
- **«Scegli»**: è tutta la riga, come la striscia «Cosa faccio adesso?», e il suo titolo è «Scegli il tuo servizio». Apre le Impostazioni sulla riga «Musica», con il focus sulla prima scelta. È il «Scegli» della proposta, in una riga sola: così a 320 px il testo non si taglia.
- **×** (nome per il lettore di schermo: «Non ora: scegli quando ricordarmelo») apre il foglio piccolo **«Quando te lo ricordo?»**: una frase («La musica per concentrarti si sceglie quando vuoi, nelle Impostazioni, riga «Musica».») e quattro righe, ognuna con il giorno in cui l'avviso torna:

| Scelta | Che cosa dice | Nelle preferenze | Avviso in basso |
|---|---|---|---|
| Tra 3 giorni | «Torna lunedì 23 novembre» (il giorno vero) | `remind`: oggi + 3 | «Va bene: te lo ricordo tra 3 giorni.» |
| Tra una settimana | «Torna venerdì 27 novembre» | oggi + 7 | «Va bene: te lo ricordo tra una settimana.» |
| Tra un mese | «Torna domenica 20 dicembre» | oggi + 30 | «Va bene: te lo ricordo tra un mese.» |
| Non ricordarmelo più | «Puoi sempre sceglierla nelle Impostazioni» | `'never'` | «Va bene: non te lo ricordo più. La musica resta nelle Impostazioni.» |

- Scegliendo, il foglio si chiude, l'avviso esce e le card delle attività salgono al loro posto. L'avviso in basso ha **«Annulla»**, che rimette l'avviso com'era, con il focus sulla riga. Il focus, dopo la scelta, va alla striscia «Cosa faccio adesso?».
- Chiudendo il foglio senza scegliere (× del foglio, Esc, tocco fuori) non cambia niente e il focus torna sulla × dell'avviso.
- Scegliendo un servizio, oppure «Nessuno», l'avviso sparisce: da lì decidono le Impostazioni, e i rimandi non contano più.

## Il carosello «Musica per concentrarti»
- Nello stesso posto dell'avviso, quando c'è un servizio: il titolo «Musica per concentrarti» con «Nascondi», e sotto cinque card, una per umore, in quest'ordine: **Lo-fi** 🎧, **Piano** 🎹, **Ambient** 🌌, **Jazz** 🎷, **Natura** 🌿.
- Le card le disegna Aura, con un colore e un'emoji per umore (token `--mood-*` nei due temi): nessuna copertina presa da fuori. Ogni card ha l'emoji e la freccia del link in alto, poi l'umore e il nome del servizio.
- **Un tocco apre la playlist** di quell'umore nell'app del servizio. È un link normale (`<a href>`, in un'altra scheda, `rel="noopener noreferrer"`), con un nome che contiene il testo che si vede: «Lo-fi, Spotify: apri la playlist nell'app Spotify».
- L'ultimo umore aperto si ricorda (`mood`): lo usa «🎧» nel focus a tutto schermo.
- **«Nascondi»** riduce il carosello a una riga, con il titolo e «Mostra» (`aria-expanded`), e la scelta si ricorda (`folded`).
- Misure, a 390×664 (iPhone 13 in Safari):
  - l'intestazione di Focus resta di 188 px in tutti i casi;
  - l'avviso è alto 48 px, il carosello aperto 146 px, ridotto 46 px (la proposta chiede al massimo 56, 150 e 56);
  - card intere sopra la barra: 3, come prima, con l'avviso, con il carosello ridotto e con «Nessuno»; 2 con il carosello aperto.
- **Quante card del carosello si vedono**: su un telefono le card scorrono di lato fino al bordo dello schermo e sono larghe tra 120 e 160 px, secondo lo schermo: se ne vedono sempre due intere e metà della terza, così si capisce che la fila continua (a 390 px, card da 139 px e la terza al 55%). Oltre 640 px, dove la lista non arriva più ai bordi dello schermo, le cinque card stanno tutte in fila, larghe quanto la lista delle attività.
- Con la tastiera: «Nascondi», poi le cinque card in ordine; la card col focus scorre tutta dentro lo schermo, e la lista ha 4 px sopra e sotto perché l'anello del focus non si tagli.

## «🎧» nel focus a tutto schermo
- Un pulsante discreto da 44 px, in alto a destra, alla stessa altezza dell'etichetta «Focus». C'è solo con un servizio scelto.
- Apre la playlist dell'**ultimo umore aperto** dal carosello (all'inizio Lo-fi), sul servizio scelto. Nome: «Musica: Jazz nell'app Spotify».
- Il focus continua a contare mentre si è nell'altra app: il tempo si calcola dagli istanti di inizio e di pausa (`js/focus.js`).

## Le playlist
Pubbliche e curate dai servizi stessi, non da utenti; controllate il 20 novembre 2026. Stanno in `PLAYLISTS` di `js/music.js`: se un link smette di funzionare, si cambia lì (un test controlla che ogni servizio abbia cinque link https diversi, sul sito del servizio e senza parametri).

| Umore | Spotify | Apple Music | Amazon Music |
|---|---|---|---|
| Lo-fi | lofi beats | Lo-Fi Chill | Lo-Fi Hip-Hop |
| Piano | Peaceful Piano | Piano Chill | Relaxing Piano |
| Ambient | Deep Focus | Pure Focus | Ultimate Ambient |
| Jazz | Jazz Vibes | Jazz Chill | Chill Contemporary Jazz |
| Natura | Nature Sounds | Nature Sounds | Nature Sounds for Focus |

## Dati
`aura-tasks:prefs.music`, sulle preferenze di questo telefono e fuori dal backup. La pulisce `Aura.music.sanitize()`, chiamata da `Aura.storage.sanitizePrefs()`:
- `service`: `'spotify'`, `'apple'`, `'amazon'`, `'none'` («Nessuno») oppure `null` (non ancora scelto, all'inizio);
- `remind`: il giorno da cui l'avviso torna (`AAAA-MM-GG`), `'never'`, oppure `null` (nessun rimando);
- `mood`: l'ultimo umore aperto, `'lofi'` all'inizio;
- `folded`: `true` se il carosello è ridotto.

Un valore non valido torna quello di partenza; i campi sconosciuti restano, come nelle altre preferenze.

## Privacy
- I link si aprono come link normali: Aura non aggiunge niente all'indirizzo e non manda dati a nessuno. Il servizio vede solo che qualcuno apre una sua playlist pubblica.
- Nessuno script dei servizi entra in Aura e la **CSP non cambia** (la cambia solo il passo 4.3, con gli indirizzi scritti nella proposta).
- Il riquadro «Musica» del foglio «Privacy» arriva con il passo 4.3, quando qualcosa andrà davvero a Spotify.

## Movimento
- L'avviso che esce e il carosello che si riduce o si riapre usano la tecnica FLIP di `js/motion.js` su `#main`: le card delle attività scivolano al posto nuovo, solo con `transform` e `opacity`. L'avviso esce mentre il foglio «Quando te lo ricordo?» scende.
- Con «Riduci movimento» niente si muove e i passaggi di colore e di scala delle parti nuove sono spenti.

## Test
`tests/music.test.js`: servizi, umori e link delle playlist (anche per valori sconosciuti e per i nomi dell'oggetto, come `toString`), quando si vedono l'avviso e il carosello, i rimandi di «Quando te lo ricordo?» (anche oltre la fine del mese e dell'anno), il servizio scelto, l'ultimo umore per «🎧», le frasi della riga «Musica», le preferenze ripulite, salvate e lette, e il backup che non le contiene.

## Da verificare sull'iPhone
- Nell'app installata sulla schermata Home, un tocco su una card e su «🎧» apre la playlist giusta: nell'app del servizio, oppure nella pagina del servizio dentro Aura con il suo pulsante per aprire l'app. Annotare che cosa succede con Spotify, Apple Music e Amazon Music.
- Tornando in Aura il focus a tutto schermo ha continuato a contare.
- L'avviso, «Quando te lo ricordo?» con «Annulla», la riga «Musica» e «Nascondi» nei due temi; le card che scorrono di lato con il dito; schermo stretto; «Riduci movimento».
