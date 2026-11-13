# Funzioni future

Sono nell'ordine della visione. Per ciascuna sono indicati comportamento, dati e casi limite. Prima di implementarne una, decidi se è **gratuita o premium** e annotalo nella tabella di "Funzioni premium" in `CLAUDE-GUIDE.md`.

## 2. Web Share Target e scorciatoie (Android)
**Obiettivo**: aggiungere un impegno senza aprire l'app, con la condivisione.

Su iPhone c'è già il Comando Rapido di Siri con la casella del server (vedi [promemoria-e-siri.md](promemoria-e-siri.md)). Il vecchio Comando con "Apri URL" + `?add=` aprirebbe Safari, che ha un archivio separato dall'app installata.

**Android**
- `share_target` nel manifest (GET): `"action": "./"`, con il testo condiviso passato come `add`, per esempio `"params": { "text": "add", "title": "add" }`. Condividendo un testo verso Aura si apre il foglio compilato. Funziona solo con l'app installata.
- Se ci sono sia `title` sia `text`, vanno uniti prima del parsing.
- `shortcuts` nel manifest: "Nuova attività" (`./?add=`), che si vede tenendo premuta l'icona. Su iPhone le shortcuts del manifest non esistono.

**Test**: unione di `title` e `text`; link con caratteri speciali (accenti, `&`, `+`).

## 3. Promemoria nel calendario (`.ics`)
**Obiettivo**: un'alternativa senza server alle notifiche push, che sono già realizzate (vedi [promemoria-e-siri.md](promemoria-e-siri.md)). Il promemoria vive nel Calendario del telefono.

**Esportazione `.ics`**
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

## Altre idee (non prioritarie)
- Attività ricorrenti: ogni giorno, ogni lunedì e così via.
- **Backup**: un promemoria gentile se l'ultimo backup è vecchio. Oggi l'app non ricorda quando è stato fatto.
- Statistiche settimanali, ordinamento manuale con trascinamento, scorrimento laterale per completare o eliminare.
- **Promemoria**: anticipo diverso per ogni attività (per esempio "avvisami un'ora prima" detto nella frase); un secondo avviso all'ora esatta.
