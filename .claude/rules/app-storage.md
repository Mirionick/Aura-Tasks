---
paths:
  - "app-attivita/js/storage.js"
  - "app-attivita/js/tasks.js"
  - "app-attivita/js/points.js"
  - "app-attivita/js/app.js"
  - "app-attivita/tests/backup.test.js"
  - "app-attivita/tests/core.test.js"
---

# Dati locali e migrazioni

Le regole non sono scritte qui: stanno in `app-attivita/docs/CLAUDE-GUIDE.md`. Prima di cambiare una struttura salvata leggi:

- la sezione «Modello dati», con «Cambiare lo schema» (versione, migrazioni in sequenza, campi sconosciuti, backup);
- la voce «Date» della sezione «Convenzioni»;
- la specifica della funzione interessata.

In più, scritto solo qui:

- Non modificare né togliere un test per far passare una modifica.
- Le chiavi che la guida indica «fuori dal backup» ci restano: includerle richiede una decisione di prodotto esplicita.
