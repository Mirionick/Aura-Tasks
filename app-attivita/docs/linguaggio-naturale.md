# Linguaggio naturale con orario e link ?add= (realizzata, gratuita)

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

**Idea per dopo**: dettatura dentro l'app con la Web Speech API (`webkitSpeechRecognition`, `lang = 'it-IT'`), dove disponibile. Su iPhone è più affidabile la dettatura del Comando Rapido (vedi [promemoria-e-siri.md](promemoria-e-siri.md)).
