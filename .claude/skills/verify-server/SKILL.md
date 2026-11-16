---
name: verify-server
description: Esegue i test automatici locali del Cloudflare Worker senza chiamare servizi esterni.
user-invocable: true
disable-model-invocation: true
---

# Verifica server Aura

1. Controlla quali file sotto `server/` sono cambiati.
2. Controlla la versione di Node.js con `node --version` (il requisito è in `server/CLAUDE.md`).
3. Dalla cartella `server/`, esegui `npm test`.
4. Una normale verifica usa solo le simulazioni già presenti: le operazioni remote elencate in `server/CLAUDE.md` restano escluse.
5. Se cambia `schema.sql`, controlla la compatibilità e i test relativi.

## Output

Riporta il numero/esito dei test, eventuali errori, test non coperti e verifiche Cloudflare che richiedono autorizzazione o credenziali dell'utente.
