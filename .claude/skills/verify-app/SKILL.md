---
name: verify-app
description: Esegue o prepara la verifica dei test browser della PWA Aura Tasks.
user-invocable: true
disable-model-invocation: true
---

# Verifica PWA Aura Tasks

1. Controlla il diff e identifica quali parti dell'app sono state modificate. Leggi solo i test e le specifiche pertinenti.
2. La suite ufficiale è `app-attivita/tests/index.html`: i test sono JavaScript eseguiti nel browser, non `node --test`.
3. Eseguila con il comando della sezione «Test» di `app-attivita/docs/CLAUDE-GUIDE.md` (Edge headless, da PowerShell, dalla cartella `app-attivita`).
4. Verifica nel titolo HTML `PASS` o `FAIL` e nel riepilogo che tutti i test siano verdi. Se Edge o PowerShell non sono disponibili nell'ambiente, non dichiarare i test eseguiti: indica il comando all'utente.
5. Passa le voci che riguardano l'app nella «Checklist prima di chiudere una modifica» della stessa guida.
6. Non installare Playwright, browser o dipendenze aggiuntive senza necessità e senza consenso.

## Output

Riporta solo: test eseguiti, esito, aree non coperte e verifiche manuali ancora necessarie, comprese le prove sull'iPhone.
