---
name: handoff
description: Prepara un passaggio di consegne breve e verificabile per una nuova sessione Claude Code o Claude Project.
user-invocable: true
disable-model-invocation: true
---

# Passaggio di consegne Aura

Prepara un riepilogo breve basato esclusivamente sullo stato reale del repository e sulla conversazione corrente.

Includi:
- obiettivo del task;
- decisioni tecniche confermate;
- file modificati;
- test effettivamente eseguiti e risultati;
- questioni aperte o verifiche manuali;
- prossimo passo consigliato.

Non ricopiare l'architettura generale già documentata. Non inventare test o decisioni. Non modificare file, creare commit o pubblicare il riepilogo, salvo richiesta esplicita. Fornisci il testo pronto da copiare in Claude Project o nella nuova sessione.
