# Aura Tasks — istruzioni per Claude Code

@AGENTS.md

Le regole fisse, i ruoli, i livelli e l'elenco dei documenti condivisi sono in `AGENTS.md`, importato qui sopra. Questo file non li ripete: aggiunge solo ciò che riguarda Claude Code.

## Mappa del progetto
- `app-attivita/`: PWA client-side in HTML, CSS e JavaScript vanilla. I vincoli dell'app sono in `app-attivita/CLAUDE.md`, che si carica quando lavori in quella cartella.
- `server/`: il server di Aura (Cloudflare Worker: API, Web Push, casella del Comando Rapido di Siri, assistente AI). Istruzioni in `server/CLAUDE.md`, guida operativa in `server/README.md`.
- La guida tecnica `app-attivita/docs/CLAUDE-GUIDE.md` non si carica da sola: se ne leggono le sezioni che servono al compito. I file in `.claude/rules/` si caricano per percorso e dicono quali sezioni leggere per i file che stai modificando.
- Il flusso di lavoro tra Claude Project e Claude Code è in `CLAUDE-WORKFLOW.md`.

## Lingua
- **Rispondi sempre in italiano.** Anche documentazione, commenti e testi dell'interfaccia sono in italiano; identificatori e nomi tecnici restano in inglese.

## Regole di lavoro
- Avvia Claude Code dalla cartella radice del repository (`Aura-Tasks/`) per avere un contesto coerente su app e server.
- Prima di lavorare: controlla `git status --short`, identifica il task e leggi solo i file e le specifiche direttamente pertinenti.
- Non esplorare o rileggere l'intero repository per modifiche localizzate. Non ristampare file lunghi: usa ricerche mirate e intervalli brevi.
- Non ripetere nell'output informazioni già presenti nella documentazione. Non generare file di riepilogo o documentazione duplicata senza necessità.
- Mantieni il task circoscritto. Non fare refactoring, rinominare file, aggiungere dipendenze o cambiare architettura se non richiesto e motivato.
- Non usare subagent per modifiche semplici, sequenziali o limitate a pochi file. Usa Explore/Plan solo per esplorazioni ampie o attività indipendenti che isolano molto output dal contesto principale; restituisci un riepilogo breve.
- Non leggere né stampare `.env*`, `server/.dev.vars*`, credenziali, token o chiavi. Gli strumenti di runtime possono usare le variabili senza mostrarne i valori.
- Oltre a ciò che `AGENTS.md` fissa per `main`, merge e deploy: nemmeno commit, push di un branch, migrazioni remote o operazioni distruttive senza richiesta esplicita dell'utente. La parola «pubblica» attiva la procedura di pubblicazione: sezione «Pubblicare con Git» della guida tecnica e passi della skill `/release-check` (`.claude/skills/release-check/SKILL.md`).
- Prima di ogni commit esegui sempre il controllo privacy scritto in quella skill: non deve trovare nulla.
- Prima di concludere, distingui sempre test eseguiti, test non eseguiti e controlli manuali richiesti. Non dichiarare verifiche non effettuate.

## Claude Code: procedure su richiesta
- `/verify-app`: test e controlli della PWA.
- `/verify-server`: test automatici del Worker.
- `/release-check`: checklist pre-pubblicazione; non pubblica da sola.
- `/handoff`: riepilogo breve per passare il lavoro a una nuova sessione o a Claude Project.
