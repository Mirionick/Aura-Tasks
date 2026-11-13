# Proposte

Una proposta è il testo con cui si chiede di cambiare il prodotto o il modo di lavorare, prima di farlo. Serve per gli interventi di **livello A**, il cui percorso comincia proprio da una proposta: i livelli sono definiti in [AGENTS.md](../../AGENTS.md).

## Il formato «P-xxx vN»

- **P-xxx** è il numero della proposta: progressivo, a tre cifre, mai riusato (P-001, P-002…).
- **vN** è la versione del testo. La prima stesura è la v1; ogni revisione che cambia il testo dà la versione successiva (v2, v3…).

«P-001 v2» è quindi la seconda versione della proposta numero 1. Quando si cita una proposta si scrive sempre anche la versione: quella approvata è una versione precisa, non «l'ultima».

## Le tre parti: proposta, revisione, decisione

Ogni proposta è un file `P-xxx.md` in questa cartella, con tre parti nell'ordine in cui avvengono:

1. **Proposta**: che cosa si vuole cambiare e perché, che cosa tocca (dati, server, sicurezza, comportamento) e che cosa resta fuori.
2. **Revisione**: le osservazioni di chi la rivede. Se il testo cambia, la proposta sale di versione e le osservazioni accolte entrano nel nuovo testo.
3. **Decisione**: l'esito, con la data e la versione a cui si riferisce. Una proposta approvata si registra in [decisioni.md](../decisioni.md), sezione 1.

Chi rivede e chi decide è scritto nel percorso del livello A, in [AGENTS.md](../../AGENTS.md).

Lo scheletro di un file:

```markdown
# P-xxx vN — Titolo

## Proposta

## Revisione

## Decisione
```

## Proposte presenti

Per ora nessun file. **P-001 v2**, il protocollo di lavoro tra gli agenti, è stata approvata prima che esistesse questa cartella: la sua approvazione è in [decisioni.md](../decisioni.md) e ciò che stabilisce è in [AGENTS.md](../../AGENTS.md).
