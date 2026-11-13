---
name: release-check
description: Prepara e verifica la checklist prima della pubblicazione di Aura Tasks; non esegue deploy o push senza esplicita richiesta.
user-invocable: true
disable-model-invocation: true
---

# Controllo prima della pubblicazione

Questa skill prepara la pubblicazione, ma non autorizza da sola commit, push, deploy o migrazioni remote.

1. Controlla `git status --short`, `git diff --check`, `git diff --cached --check`, `git diff --stat` e `git diff --cached --stat`. Individua file estranei e modifiche non richieste.
2. Verifica che `.env*`, `server/.dev.vars*`, `server/.wrangler/` e `server/node_modules/` siano esclusi da Git (`git check-ignore -v`).
3. **Controllo privacy**, dopo `git add`, in PowerShell dalla radice del repository:

   ```powershell
   git grep --cached -n -i -E -e ($env:USERNAME -replace '\.', '.?') -e 'Users\\[^\\]*~[0-9]'
   ```

   Non deve trovare nulla. Cerca nei file in staging il nome utente di Windows, anche scritto con uno spazio o senza punto, e la sua forma breve con la tilde. Se stampa anche una sola riga, fermati e correggi il file prima del commit. Rileggi anche il messaggio del commit: vale la stessa regola.
4. Controlla l'identità dei commit: `git config user.name` e `git config user.email` devono dare `Mirionick` e l'indirizzo noreply di GitHub (`…@users.noreply.github.com`).
5. Controlla che il diff rispetti la regola 1 di `AGENTS.md`: niente chiavi, token, password, nomi reali, email, dati personali o percorsi utente locali.
6. Esegui i passi di `/verify-app` (`.claude/skills/verify-app/SKILL.md`) se cambia la PWA e quelli di `/verify-server` (`.claude/skills/verify-server/SKILL.md`) se cambia il Worker.
7. Per la sequenza completa (ordine tra server e app, commit, push del branch e Pull Request) segui la sezione «Pubblicare con Git» della guida `app-attivita/docs/CLAUDE-GUIDE.md`.
8. Presenta un riepilogo delle modifiche, dei test, delle operazioni remote e dei rischi. Chiedi autorizzazione se l'utente non ha chiesto esplicitamente «pubblica».
