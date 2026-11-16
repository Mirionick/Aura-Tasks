# Aura Tasks — vincoli dell'app (PWA)

Aura è una PWA mobile-first in italiano: deve restare veloce da usare, affidabile nei promemoria e funzionare anche offline. Le regole condivise sono in `../AGENTS.md` e le istruzioni generali per Claude Code in `../CLAUDE.md`: qui ci sono solo i vincoli propri dell'app.

## Prima di toccare il codice
- Leggi la specifica della funzione in `docs/` e aggiornala insieme al codice quando il comportamento cambia. Una funzione nuova ha la propria specifica `docs/<nome>.md` e una riga nell'«Indice delle specifiche» della guida tecnica, che elenca tutte le specifiche con il loro stato.
- La guida tecnica è `docs/CLAUDE-GUIDE.md` e non viene caricata da sola: leggine soltanto le sezioni pertinenti, cercandole per titolo.
  - «Struttura dei file»: i moduli, l'ordine degli script e i tre punti in cui va aggiunto un modulo nuovo.
  - «Modello dati», con «Cambiare lo schema»: prima di toccare i dati salvati.
  - «Convenzioni»: le regole tecniche, una voce per argomento (date, Content-Security-Policy, fogli, CSS, telefono, movimento, service worker…).
  - «Funzioni premium»: l'unica funzione da cui passa ogni controllo premium.
  - «Test», «Design», «Pubblicare con Git» e «Checklist prima di chiudere una modifica».
- I file in `../.claude/rules/` ricordano quali voci leggere per i file che stai modificando.

## Vincoli sempre attivi
- **I dati dell'utente restano sul dispositivo**, in `localStorage`. Il server è facoltativo e si usa solo secondo il consenso e le specifiche di promemoria e assistente.
- **L'app deve funzionare anche aprendo `index.html` con un doppio clic (`file://`)**:
  - script classici con `defer`, che condividono il namespace globale `window.Aura`;
  - niente `type="module"` né `import`/`export`, perché da `file://` i moduli sono bloccati;
  - percorsi sempre relativi (`css/style.css`, mai `/css/style.css`): l'app deve funzionare anche in una sottocartella, come su GitHub Pages.
- **Interfaccia tutta in italiano**: `lang="it"` e date formattate con `Intl` e `'it-IT'`.
- **Prima il telefono**: i bersagli principali sono iPhone (Safari) e Android (Chrome). Ogni modifica va provata prima a 375–390 px di larghezza.
- Mantieni tema chiaro e scuro, uso offline e accessibilità al tocco. Niente cambiamenti che richiedono servizi esterni senza approvazione.
- **iOS**: nei contenitori flex in colonna senza altezza fissa (come i fogli `<dialog>`) usa `flex: 1 1 auto`, mai `flex: 1`. Su Safari la base 0% fa collassare l'elemento a 0 px e il foglio diventa invisibile.

## Test e prove
- I test dell'app si aprono nel browser (`tests/index.html`): come eseguirli è scritto nella sezione «Test» della guida, e la skill `/verify-app` ne segue i passi.
- Per modifiche visive, API del browser o animazioni, di' sempre che cosa va provato su un iPhone vero: WebKit sul PC non equivale a iOS.
- Per le modifiche al server segui `../server/CLAUDE.md` e la specifica `docs/promemoria-e-siri.md`.
