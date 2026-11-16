# Aura Tasks — regole condivise da tutti gli agenti

Queste regole valgono per chiunque lavori sul repository, persone e agenti, e si leggono prima di ogni intervento. Vengono dal protocollo **P-001 v2**, approvato da Claude Project, ChatGPT e Product Owner, aggiornato dal ciclo di lavoro del 16 novembre 2026 (vedi `docs/decisioni.md`).

Ogni regola è scritta in un solo posto: gli altri documenti la richiamano, non la ripetono.

| Dove | Che cosa contiene |
|---|---|
| `AGENTS.md` (questo file) | Regole fisse, ruoli e livelli di intervento |
| `docs/stato.md` | A che punto è il lavoro; si aggiorna con ogni Pull Request |
| `docs/decisioni.md` | Decisioni approvate, funzioni realizzate, funzioni pianificate e verifiche eseguite |
| `docs/proposte/` | Le proposte, nel formato P-xxx vN |
| `app-attivita/docs/` | Una specifica per ogni funzione dell'app e la guida tecnica `CLAUDE-GUIDE.md` (struttura, dati, convenzioni, test) |
| `CLAUDE.md`, `app-attivita/CLAUDE.md`, `server/CLAUDE.md` | Istruzioni di lavoro per Claude Code e vincoli propri dell'app e del server |

## Regole fisse

1. **Il repository è pubblico: niente segreti, chiavi, dati personali né percorsi locali**, nei file come nei messaggi dei commit.
   - Sono dati personali anche il nome reale, il nome utente del computer e le email personali. Un percorso locale li contiene quasi sempre, anche nella forma breve con la tilde: al suo posto si scrive un percorso relativo o una variabile d'ambiente (per esempio `$env:TEMP`).
   - I commit si firmano solo con l'identità noreply di GitHub.
   - I file dei segreti (`.env*`, `server/.dev.vars*`) restano ignorati da Git.
2. **Niente si toglie né peggiora, e tutto resta gratis.**
   - Il lavoro nuovo si aggiunge a quello che c'è: una funzione può cambiare posto, non sparire né peggiorare.
   - Far girare Aura non deve costare nulla: niente servizi, piani o dipendenze a pagamento. Il server resta nel piano gratuito di Cloudflare.
3. **Nell'app niente librerie né script esterni; CSP rigida e `textContent`.**
   - L'app è solo HTML, CSS e JavaScript vanilla: niente framework, bundler, dipendenze di runtime, CDN o font esterni.
   - La Content Security Policy resta rigida: nessuno script, stile o gestore inline. Com'è fatta e che cosa comporta è scritto nella guida tecnica, sezione «Convenzioni».
     - Il divieto di script, stili e gestori inline vale per l'app: `app-attivita/index.html` e le risorse che essa carica. Le pagine autonome in `app-attivita/tests/` e `app-attivita/prove/` possono avere script e stili inline quando necessari, nel rispetto della loro eventuale CSP specifica. Queste cartelle non sono incluse nel precaricamento `APP_FILES` del Service Worker; le richieste GET riuscite possono comunque entrare nella cache dinamica secondo il comportamento attuale di `sw.js`.
   - I testi dell'utente si scrivono con `textContent`, mai con `innerHTML` o con HTML costruito a mano.
4. **Ogni nuova logica ha i propri test**: quelli dell'app in `app-attivita/tests/`, quelli del server in `server/test/`.
5. **Si lavora esclusivamente su branch, con Pull Request**: niente push su `main`, niente merge e niente deploy senza il Product Owner.
6. **Chi scrive il codice non lo approva.**

## Ruoli

| Ruolo | Chi | Che cosa fa |
|---|---|---|
| Product Owner | Mirionick | Decide e approva: il merge di una PR è la sua approvazione |
| Requisiti e sviluppo | Claude Project | Scrive proposte e criteri di accettazione; implementa su branch, apre le PR e le segue fino al merge |
| Technical Lead e sviluppo | ChatGPT / Codex | Revisione tecnica delle proposte; revisione automatica delle PR (Codex); implementa su branch quando un passo gli è assegnato |
| Sviluppo locale | Claude Code | Ciò che richiede il PC del Product Owner: Windows, Cloudflare (deploy, segreti), prove sull'iPhone |

Come lavorano insieme è scritto nel ciclo di lavoro qui sotto.

## Livelli di intervento

Ogni intervento ha un livello, che si dichiara nella Pull Request (modello in `.github/pull_request_template.md`).

- **Livello A — Modifiche significative:** dati salvati, server, sicurezza e privacy, CSP e permessi, nuove funzionalità o cambiamenti di comportamento. Richiede una proposta in `docs/proposte/` rivista da ChatGPT; poi si segue il ciclo qui sotto.
- **Livello B — Modifiche piccole:** testi, stile, test e documentazione, senza cambiare il comportamento dell'app. Si segue il ciclo qui sotto, senza proposta.
- **Livello C — Emergenze di sicurezza:** intervento immediato, con coinvolgimento del Product Owner e di un revisore; documentazione della modifica successivamente.

## Ciclo di lavoro

Deciso dal Product Owner il 16 novembre 2026: una sola approvazione, la sua, alla fine.

1. L'esecutore del passo (scritto nella proposta) lavora su un branch e apre la PR.
2. Partono la CI e la revisione dell'altro agente: Codex rivede in automatico le PR scritte da Claude; Claude Project rivede quelle scritte da ChatGPT o Codex.
3. L'esecutore corregge finché la CI è verde e la revisione non ha obiezioni aperte.
4. Il Product Owner riceve un riassunto breve: che cosa cambia, esito di test e revisione, che cosa provare sull'iPhone.
5. Il Product Owner approva con il merge (o chiede a Claude Project di farlo); altrimenti dice che cosa non va.
6. Dopo il merge si passa al passo successivo del piano.

Le proposte nuove seguono lo stesso ciclo: la PR che aggiunge la proposta a `docs/proposte/` è approvata con il suo merge.

**CI obbligatoria.** Ogni Pull Request di livello A o B deve superare i controlli automatici della CI prima del merge. Le prove manuali richieste dal tipo di modifica si aggiungono alla CI e non la sostituiscono.
