---
paths:
  - "server/**/*"
---

# Server: trattamento dei dati

- Mantieni i controlli di consenso, i limiti di quota e anti-abuso, la validazione degli input, le risposte HTTP coerenti e la minimizzazione dei dati descritti nelle specifiche.
- Non ampliare i dati inviati o conservati senza consenso e specifica aggiornata, e non salvare contenuti dell'utente che le specifiche dichiarano transitori o non persistenti. Se cambia il trattamento dei dati, aggiorna prima la specifica e segnala l'impatto.
- Nessun valore sensibile nei log del server, nell'output o nei dati dei test.
