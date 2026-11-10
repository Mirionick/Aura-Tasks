# Modificare un'attività (realizzata, gratuita)

**Interfaccia**
- Un tocco sulla card (titolo, ma anche la riga di ora, durata ed energia) apre il foglio "Nuova attività" in modalità modifica:
  - titolo "Modifica attività", pulsante "Salva modifiche" con la spunta;
  - campi già compilati; niente "Scrivi in una frase", che con le parole avanzate riscriverebbe il titolo, e niente riga di Siri;
  - per un'attività completata, la riga "Completata · i suoi 24 punti non cambiano";
  - per un'attività da fare, il pulsante **"Inizia focus"** sopra "Salva modifiche": salva le modifiche fatte, se sono valide, e apre il focus a tutto schermo con la durata appena scritta (vedi [tre-modalita.md](tre-modalita.md)).
- Spunta e cestino funzionano come prima. Si modificano anche le attività completate.
- Dopo il salvataggio:
  - la card si aggiorna, cambia sezione se è cambiato il giorno, si illumina (`.task--edited`: solo il bagliore) e torna in vista;
  - avviso "Modifiche salvate" con "Annulla". Se l'attività è finita in un'altra scheda, l'avviso lo dice: "Modifiche salvate · ora in Agenda";
  - il focus torna sulla card, in `onSheetClosed()`, perché il pulsante che aveva aperto il foglio è stato ridisegnato;
  - senza modifiche il foglio si chiude e basta.
- La prima attività aggiunta mostra "Attività aggiunta: toccala per modificarla".

**Card**: il titolo sta dentro `<button class="task__edit" data-action="edit">`, il cui `::after` (`position: absolute; inset: 0` dentro `.task__body`) copre tutto il corpo della card. Per il lettore di schermo è "Modifica: Dentista".

**Logica** (`js/tasks.js`):
- `editableFields(task)`: titolo, durata, energia, giorno e ora;
- `updateTask(tasks, id, value)` → `{ tasks, previous, changed }`. Cambia **solo** quei 5 campi; `id`, `createdAt`, completamento, **`pointsAwarded`** e campi sconosciuti restano.

**Punti**: modificare un'attività **non cambia i punti già assegnati**.
- `commit()` lascia il registro com'è, e `pointsAwarded` resta quello del completamento: togliendo la spunta si tolgono esattamente quei punti.
- Un'attività ancora da fare prende i punti quando viene completata, con durata ed energia aggiornate.

**`app.js`**
- `openEditSheet(id)` imposta `editingId` a ogni apertura; `openAddSheet()` torna alla modalità "nuova", quindi Siri, `?add=` e "+" non cambiano.
- Il minimo del calendario comprende il giorno di un'attività in ritardo.
- "Annulla" rimette i 5 campi con `updateTask`, quindi resta coerente anche se nel frattempo l'attività è stata completata.
- Una card in animazione (`busy`) non si apre.
- Con i promemoria attivi, `commit()` rimanda già l'elenco al server con il titolo o l'ora nuovi.
