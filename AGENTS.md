# Aura Tasks — regole condivise da tutti gli agenti

Queste regole valgono per chiunque lavori sul repository, persone e agenti, e si leggono prima di ogni intervento. Vengono dal protocollo **P-001 v2**, approvato da Claude Project, ChatGPT e Product Owner (vedi `docs/decisioni.md`).

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
   - I testi dell'utente si scrivono con `textContent`, mai con `innerHTML` o con HTML costruito a mano.
4. **Ogni nuova logica ha i propri test**: quelli dell'app in `app-attivita/tests/`, quelli del server in `server/test/`.
5. **Si lavora esclusivamente su branch, con Pull Request**: niente push su `main`, niente merge e niente deploy senza il Product Owner.
6. **Chi scrive il codice non lo approva.**

## Ruoli

| Ruolo | Chi |
|---|---|
| Product Owner | Mirionick |
| Requisiti | Claude Project |
| Technical Lead | ChatGPT |
| Sviluppo | Claude Code |

Che cosa fa ciascuno, intervento per intervento, è scritto nei livelli qui sotto.

## Livelli di intervento

Ogni intervento ha un livello, che si dichiara nella Pull Request (modello in `.github/pull_request_template.md`).

- **Livello A — Modifiche significative:** dati salvati, server, sicurezza e privacy, CSP e permessi, nuove funzionalità o cambiamenti di comportamento. Processo: proposta → revisione tecnica ChatGPT → specifica concordata → approvazione Product Owner → implementazione su branch → revisione dell'altro agente, verifica requisiti di Claude Project e CI → merge del Product Owner.
- **Livello B — Modifiche piccole:** testi, stile, test e documentazione, senza cambiare il comportamento dell'app. Processo: PR → CI → revisione dell'altro agente → merge del Product Owner.
- **Livello C — Emergenze di sicurezza:** intervento immediato, con coinvolgimento del Product Owner e di un revisore; documentazione della modifica successivamente.
