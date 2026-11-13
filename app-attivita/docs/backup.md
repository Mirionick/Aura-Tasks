# Backup dei dati (realizzata, gratuita)

**Foglio "Backup dei dati"**: si apre dal link in fondo alla scheda Motivazione. Riparte sempre dallo stato normale, che ha tre riquadri.
- **Esporta**: "Esporta il backup", con due note.
  - Il file contiene le attività **in chiaro**: chi lo apre può leggerle, quindi va tenuto in un posto proprio.
  - Nel file non ci sono il codice segreto di Siri né le impostazioni dei promemoria.
- **Importa**: "Scegli un file di backup". Solo su iPhone compare una nota con «Scegli file» e gli archivi separati di Safari e dell'app installata: il backup serve anche a spostare i dati tra i due.
- **Ripristina**: visibile **finché esiste** `aura-tasks:before-import`, con "Copia salvata: Oggi alle 10:30".
- Esiti ed errori vanno nella riga di stato del foglio.

**Esportare**: file `aura-tasks-backup-AAAA-MM-GG.json` (vedi "Modello dati" in `CLAUDE-GUIDE.md`).
- Su iPhone e iPad si condivide (`navigator.share`), prima come `application/json`, poi come `text/plain` se iOS rifiuta il tipo. Altrove si scarica (vedi "Convenzioni" in `CLAUDE-GUIDE.md`).
- Chiudere la condivisione senza scegliere non è un errore.

**Importare**
1. Scelta del file: oltre 5 MB è un errore. Poi `readBackup()`: file illeggibile, non di Aura o senza attività danno un messaggio, e i dati non cambiano.
2. **Riepilogo** al posto dei riquadri, con il focus sul titolo:
   - "Importare questo backup?";
   - **Nel file**: attività, punti e "Esportato: Ieri alle 10:30";
   - **Adesso**: attività e punti;
   - «Sostituisci» e «Annulla».
3. «Sostituisci» chiama `storage.replaceData(state, nuovo, adesso)`:
   - prima salva la copia dei dati di adesso in `aura-tasks:before-import`. **Se non c'è spazio per la copia, non importa nulla** (`'no-copy'`);
   - poi salva i dati nuovi. Se non ci stanno, rimette la copia precedente e i dati restano quelli di prima (`'no-space'`);
   - se va tutto bene, `applyState()` ridisegna, la riga di stato dice "Backup importato: 3 attività e 340 punti." e compare il riquadro di ripristino.
- **Sostituisce, non unisce**: unendo due archivi con la stessa storia, punti e giorni del registro si raddoppierebbero.
- Non tocca mai `aura-tasks:remote`: codice, promemoria e casella restano. Con i promemoria attivi, l'elenco nuovo va al server.

**Ripristinare**: «Ripristina i dati di prima dell'importazione» apre lo stesso riepilogo ("Nella copia" / "Adesso", «Ripristina» / «Annulla»).
- `restoreBeforeImport()` rimette i dati e cancella la copia, quindi il riquadro sparisce.
- Se il salvataggio non riesce, la copia resta.

**Test**: `tests/backup.test.js`, con un archivio finto che può rifiutare la scrittura di una chiave (memoria piena).
