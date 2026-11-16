# Server Aura — istruzioni per Claude Code

Le regole condivise sono in `../AGENTS.md` e le istruzioni generali per Claude Code in `../CLAUDE.md`: qui c'è solo ciò che riguarda il server.

- Questo progetto usa Cloudflare Workers e D1. La guida operativa completa è `README.md`; la specifica condivisa con la PWA è `../app-attivita/docs/promemoria-e-siri.md` e, per l'assistente, `../app-attivita/docs/assistente.md`.
- Requisito Node.js: `>=22.13`. `npm test` esegue i test con il test runner nativo di Node.
- Node.js è installato in `$env:ProgramFiles\nodejs`, ma il terminale degli strumenti di Claude può non averlo nel PATH: in quel caso aggiungilo all'inizio del comando (`$env:Path = "$env:ProgramFiles\nodejs;" + $env:Path`).
- Prima di modificare un endpoint, leggi il relativo handler e il test pertinente; non esplorare tutto `src/` se il task è circoscritto.
- Sono operazioni remote, da eseguire solo su richiesta esplicita come dice `../CLAUDE.md`: Workers AI reale, `wrangler dev`, accesso D1 remoto, `db:init`, `deploy` e ogni altra operazione Cloudflare che consuma quota o modifica risorse.
- I test automatici usano Push e Workers AI simulati: nessuna chiamata esterna, nessuna quota consumata. Esegui `npm test` dopo ogni modifica al server.
- Se cambia `schema.sql`, aggiorna in modo compatibile i test e prepara le istruzioni per la migrazione.
- Le regole sul trattamento dei dati sono in `../.claude/rules/server-data-safety.md`, che si carica insieme ai file di questa cartella.
- L'ordine di pubblicazione tra server e app è nella sezione «Pubblicare con Git» di `../app-attivita/docs/CLAUDE-GUIDE.md`.
