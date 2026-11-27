# Backup dei dati (realizzata, gratuita)

**Foglio "Backup dei dati"**: si apre dal link in fondo alla scheda Motivazione, oppure dalla riga «Backup dei dati» delle Impostazioni, che dice quante attività e quanti punti ci sono, e quanti premi e acquisti del negozio se ce ne sono (vedi [impostazioni.md](impostazioni.md)). Riparte sempre dallo stato normale, che ha tre riquadri.
- **Esporta**: "Esporta il backup", con due note.
  - Il file contiene le attività **in chiaro**: chi lo apre può leggerle, quindi va tenuto in un posto proprio.
  - Nel file non ci sono il codice segreto di Siri né le impostazioni dei promemoria.
- **Importa**: "Scegli un file di backup". Solo su iPhone compare una nota con «Scegli file» e gli archivi separati di Safari e dell'app installata: il backup serve anche a spostare i dati tra i due.
- **Ripristina**: visibile **finché esiste** `aura-tasks:before-import`, con "Copia salvata: Oggi alle 10:30".
- Esiti ed errori vanno nella riga di stato del foglio.

**Esportare**: file `aura-tasks-backup-AAAA-MM-GG.json` (vedi "Modello dati" in `CLAUDE-GUIDE.md`), con tutti i dati: attività, punti e serie, minuti di focus, premi e riscatti (dalla v5, P-003 passo 3.4), acquisti del negozio e colori e coriandoli in uso (dalla v6, P-004 passo 4.1), sfide di oggi e dei giorni prima: i 30 più recenti e quelli più vecchi che si possono ancora disfare, al massimo 400 (dalla v8, P-003 passo 3.5). Importando un backup senza le sfide di oggi, nascono subito.
- Su iPhone e iPad si condivide (`navigator.share`), prima come `application/json`, poi come `text/plain` se iOS rifiuta il tipo. Altrove si scarica (vedi "Convenzioni" in `CLAUDE-GUIDE.md`).
- Chiudere la condivisione senza scegliere non è un errore.

**Importare**
1. Scelta del file: oltre 5 MB è un errore. Poi `readBackup()`: file illeggibile, non di Aura o senza attività danno un messaggio, e i dati non cambiano.
2. **Riepilogo** al posto dei riquadri, con il focus sul titolo:
   - "Importare questo backup?";
   - **Nel file**: attività, punti, premi e acquisti del negozio (se ce ne sono) e "Esportato: Ieri alle 10:30";
   - **Adesso**: attività, punti, premi e acquisti (se ce ne sono);
   - "Attività, punti, serie, premi e acquisti del negozio di adesso verranno sostituiti. Prima ne salvo una copia su questo dispositivo.";
   - «Sostituisci» e «Annulla».
3. «Sostituisci» chiama `storage.replaceData(state, nuovo, adesso)`:
   - prima salva la copia dei dati di adesso in `aura-tasks:before-import`. **Se non c'è spazio per la copia, non importa nulla** (`'no-copy'`);
   - poi salva i dati nuovi. Se non ci stanno, rimette la copia precedente e i dati restano quelli di prima (`'no-space'`);
   - se va tutto bene, `applyState()` ridisegna, la riga di stato dice "Backup importato: 3 attività e 340 punti." e compare il riquadro di ripristino.
- **Sostituisce, non unisce**: unendo due archivi con la stessa storia, punti e giorni del registro si raddoppierebbero.
- I backup di tutte le versioni si importano: quelli di prima della v5 arrivano senza premi né riscatti. Premi e riscatti passano dagli stessi controlli dei dati salvati (al massimo 30 premi, nomi e prezzi riportati nei limiti, riscatti illeggibili scartati).
- Quelli di prima della v6 arrivano senza acquisti del negozio, con «Aurora» e «Classici» in uso. Gli acquisti passano dagli stessi controlli (oggetto scritto bene, prezzo da 1 a 100.000, istante valido; un colore comprato due volte conta una volta), e un colore o una forma in uso che non risulta comprato torna quello di partenza.
- Non tocca mai `aura-tasks:remote`: codice, promemoria e casella restano. Con i promemoria attivi, l'elenco nuovo va al server.

**Ripristinare**: «Ripristina i dati di prima dell'importazione» apre lo stesso riepilogo ("Nella copia" / "Adesso", «Ripristina» / «Annulla»).
- `restoreBeforeImport()` rimette i dati e cancella la copia, quindi il riquadro sparisce.
- Se il salvataggio non riesce, la copia resta.

**Test**: `tests/backup.test.js`, con un archivio finto che può rifiutare la scrittura di una chiave (memoria piena).
