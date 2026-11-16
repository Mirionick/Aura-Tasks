# Workflow Aura Tasks: Claude Project e Claude Code

## Ruoli
I ruoli di tutti gli agenti e i livelli di intervento sono in `AGENTS.md`. In questo flusso i due strumenti di Claude si dividono il lavoro così:
- **Claude Project** (Claude, in un Progetto di claude.ai): analisi funzionale, discussione dei requisiti, revisione dei piani e dei risultati, piano di test, analisi di screenshot/errori e preparazione del prompt operativo.
- **Claude Code**: verifica del repository, implementazione nel codice, test automatici e riepilogo tecnico.

## Ciclo consigliato
1. In Claude Project descrivi un solo problema o una sola funzionalità. Chiedi una diagnosi e un prompt autonomo ma breve per Claude Code.
2. In Claude Code apri il repository e avvia una sessione nuova per un task distinto. Chiedi di leggere solo specifiche e file pertinenti.
   - Per un lavoro grande chiedi prima il piano e fallo rivedere in Claude Project: Claude Code scrive codice solo dopo il tuo via.
3. Claude Code implementa il task, esegue i test pertinenti e restituisce file modificati, esito dei test e verifiche manuali.
   - Il lavoro si fa su un branch e arriva a `main` con una Pull Request, secondo il livello dell'intervento (`AGENTS.md`).
4. Riporta in Claude Project solo il riepilogo e gli eventuali errori rilevanti, non tutta la cronologia di terminale.
5. Usa `/handoff` prima di chiudere un task lungo; usa `/clear` quando inizi un task realmente distinto. Usa `/compact` solo quando devi continuare lo stesso task e il contesto precedente è ancora necessario.

## Regole per risparmiare contesto
- Non chiedere a Claude Project e a Claude Code di rifare la stessa esplorazione della codebase.
- Il prompt di Claude Project deve contenere obiettivo, comportamento attuale, risultato atteso, criteri di accettazione, vincoli, file noti (se verificati) e test richiesti.
- Non inserire nel prompt l'intera architettura: è già nei file `CLAUDE.md` e nelle specifiche.
- Non usare subagent per operazioni semplici. Delegare conviene soprattutto quando l'esplorazione è ampia e il risultato può essere sintetizzato.
- Evita output completi di log e file: chiedi le righe dell'errore e i passaggi pertinenti.
- Non cambiare modello nel mezzo di una sessione lunga senza motivo: il cambio modello può richiedere il riempimento di una nuova cache del prompt.

## Prompt breve da usare in Claude Project

> Analizza questa richiesta di Aura Tasks senza rispiegare l'intera architettura. Consulta solo le specifiche pertinenti. Distingui i fatti verificati dalle ipotesi. Restituisci: diagnosi breve, criteri di accettazione, casi limite e un solo prompt pronto per Claude Code. Nel prompt includi esclusivamente obiettivo, comportamento attuale, risultato atteso, vincoli, file già identificati (solo se verificati) e test. Non chiedere un audit generale né refactoring non necessari.
