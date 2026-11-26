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

## Altre idee (non prioritarie)
- Statistiche settimanali, ordinamento manuale con trascinamento.
- **Promemoria**: anticipo diverso per ogni attività (per esempio "avvisami un'ora prima" detto nella frase); un secondo avviso all'ora esatta.

## Passate a una proposta o scartate
- **Attività che si ripetono** e **scorrimento laterale per completare o eliminare**: sono in [P-005](../../docs/proposte/P-005.md), passi 5.1 e 5.2. Il 5.1 è fatto (vedi [ripetizioni.md](ripetizioni.md)).
- **Promemoria nel calendario (`.ics`)**: non si fa. Il Product Owner, il 20 novembre 2026: «la d no perché tanto abbiamo già un calendario dentro l'app, voglio un sistema centralizzato non che faccia affidamento a cose esterne». Il calendario è l'Agenda; i promemoria sono le notifiche push di Aura.
- **Promemoria del backup**: non si fa. Lo stesso giorno: «la c non serve perché creeremo il collegamento o con l'account google o con uno proprio dell'app». I dati passeranno da un telefono all'altro con l'account.
