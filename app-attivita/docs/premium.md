# Licenza premium (in futuro)

In futuro alcune funzioni saranno **premium**, sbloccate con un **codice di licenza**. La regola `isPremium()` e la tabella con la categoria di ogni funzione stanno in `CLAUDE.md` ("Funzioni premium").

## Funzionamento previsto
- `isPremium()` è **sincrona**:
  - il codice salvato (`aura-tasks:license`) viene verificato all'avvio con `Aura.license.init()`, prima del primo `render()`;
  - viene verificato anche quando l'utente lo inserisce, con `Aura.license.activate(code)`, che restituisce una Promise<boolean>;
  - poi `isPremium()` restituisce il risultato tenuto in memoria.
- **Proposta per la verifica offline**:
  - il codice è un payload (per esempio `{ ordine, scadenza?, funzioni? }`) più una firma ECDSA P-256, in base64url;
  - nell'app c'è solo la **chiave pubblica**, e la verifica usa `crypto.subtle.verify`;
  - la chiave privata, che serve a generare i codici, **non entra mai** nel progetto né nel repository.
- `crypto.subtle` richiede un contesto sicuro (https o localhost). Se non è disponibile, `isPremium()` resta `false`, senza errori.
- **Limite da sapere**: tutto gira sul dispositivo, quindi chi modifica il JavaScript può aggirare il controllo. Serve solo come deterrente. Una protezione vera richiede un server di verifica, in conflitto con il vincolo "niente server": è una decisione da prendere più avanti.

## Interfaccia e dati
- Ogni funzione premium mostra la stessa etichetta "Premium".
- Se la funzione è bloccata, si apre il foglio "Sblocca con un codice", con il campo del codice e lo stato della licenza. Lo stesso foglio permette di rimuovere la licenza.
- Se la licenza manca, non è valida o scade, la funzione si blocca, **ma i dati creati restano**: non vanno mai cancellati.
- Per i test, `init()` accetta una chiave pubblica di prova: così si possono generare codici di test validi senza scorciatoie nel codice.
