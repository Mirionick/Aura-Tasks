---
paths:
  - "app-attivita/sw.js"
  - "app-attivita/manifest.webmanifest"
  - "app-attivita/prove/**/*"
---

# PWA, cache e risorse

Le regole non sono scritte qui: stanno in `app-attivita/docs/CLAUDE-GUIDE.md`. Prima di modificare questi file leggi:

- la voce «Service worker» della sezione «Convenzioni» (`APP_FILES`, `CACHE_VERSION`, pagina di riserva);
- la sezione «Struttura dei file», per i tre punti in cui va aggiunto un modulo nuovo e per le pagine di `prove/`;
- nella sezione «Test», le note sui service worker.

In più, scritto solo qui:

- Non dichiarare verificato il comportamento offline con una prova fatta da `file://`.
