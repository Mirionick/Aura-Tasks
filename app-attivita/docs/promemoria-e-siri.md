# Server di Aura: promemoria push e casella di Siri (realizzata, gratuita)

Tutto è **facoltativo**. Finché l'utente non tocca "Attiva i promemoria" o "Crea il codice per Siri" (campanella → foglio "Promemoria e Siri"), l'app non fa nessuna richiesta di rete.

**Dove e come**
- Codice in `server/`:
  - Cloudflare Worker `aura`;
  - database **D1** `aura`, scelto al posto di KV perché KV gratuito ha 1.000 scritture e 1.000 elenchi al giorno e non è subito coerente;
  - **Cron** ogni minuto.
- Guida, comandi e API in `server/README.md`.
- Indirizzo del server: costante `SERVER_URL` in `js/remote.js`.
- Pubblicazione: `npm run deploy` in `server/`. Il push su GitHub aggiorna solo l'app.
- **Nessuna dipendenza**: cifratura Web Push (RFC 8291, aes128gcm) e firma VAPID (RFC 8292, ES256) sono scritte con WebCrypto in `server/src/webpush.js`.
- **Segreti**:
  - `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` stanno solo nei secrets di Cloudflare. `npm run vapid` li crea e li passa a Wrangler da stdin, senza mostrarli né scriverli su disco;
  - nel repository pubblico ci sono solo impostazioni pubbliche (`wrangler.toml`: origini ammesse, `VAPID_SUBJECT`, id del database);
  - le prove locali usano `.dev.vars`, che Git ignora.

**Codice del dispositivo**
- 24 byte casuali (`crypto.getRandomValues`), cioè 32 caratteri base64url, generati dall'app e salvati in `aura-tasks:remote`.
- Viaggia in `Authorization: Bearer <codice>`; il server ne conserva solo l'impronta SHA-256. Senza un codice registrato risponde 401.
- "Scollega questo dispositivo" cancella sul server casella, sottoscrizione e promemoria. Il dispositivo diventa un **segno anonimo** (vedi "Tetto di nuove registrazioni") e il codice smette subito di valere. L'avviso offre "Annulla", che registra di nuovo lo stesso codice.
- Se il server non conosce più il codice (401), l'app lo registra di nuovo da sola. Così il Comando Rapido continua a funzionare.

**Casella di Siri**
- Il Comando Rapido manda `POST /api/inbox` con la frase. Il server risponde in testo semplice ("Aggiunto ad Aura: …" oppure l'errore), che il comando mostra in una notifica.
- L'app controlla la casella all'avvio, al ritorno nell'app (al massimo ogni 15 secondi) e quando torna internet:
  - le frasi vanno prima nella coda locale (`inbox`);
  - poi l'app le conferma al server, che le cancella;
  - così nessuna frase si perde.
- Le frasi si aprono una alla volta in "Nuova attività" con `openAddSheet(frase, "Da Siri · 1 di 2")`.
  - "Aggiungi" o "Annulla" la segnano come vista (`done`) e passano alla successiva. L'aggancio è `onSheetClosed()`, chiamato da `closeSheet()` e dall'evento `close`.
  - Se un foglio è già aperto, si aspetta che si chiuda.
  - Le frasi in coda si mostrano anche all'avvio offline.
- Le guide al Comando Rapido stanno nel foglio, con i pulsanti "Copia", e in `server/README.md`. Il link `?add=` resta valido come alternativa senza server.

**Promemoria**
- `Aura.reminders.buildReminders(tasks, { lead, now })` produce l'elenco per il server:
  - include le attività non completate, con giorno e ora, ancora future;
  - `at` = ora dell'attività in ora locale (giusta anche nei giorni del cambio d'ora);
  - `fireAt = at − anticipo`;
  - al massimo 100.
- **Anticipo**: uno per tutte le attività (`LEADS`: 0, 5, 10, 15, 30, 60; predefinito 10).
- **Invio dell'elenco**:
  - l'elenco completo va in `PUT /api/reminders` 2 secondi dopo ogni `commit()`, all'avvio, al ritorno nell'app e quando torna internet;
  - parte solo se l'impronta (`listKey`) è cambiata, e un invio alla volta;
  - la sottoscrizione si ricontrolla e si rimanda almeno una volta al giorno, e subito se cambia endpoint o chiave del server.
- **Server**:
  - il Cron manda i promemoria con `fire_at ≤ adesso`, al massimo 10 per giro e in parallelo, ciascuno con un timeout;
  - se siamo già dentro l'anticipo, l'avviso parte al primo giro;
  - un promemoria inviato resta **segnato** (`sent_at`) fino all'ora dell'attività, così rimandare l'elenco non lo fa ripartire. Riparte solo se cambia `fire_at`;
  - 404/410 cancellano la sottoscrizione; gli altri errori si ritentano fino a 5 volte;
  - passati 15 minuti dall'ora dell'attività, il promemoria si scarta.
- **Notifica**:
  - titolo = titolo dell'attività; testo "Tra 10 minuti, alle 10:00";
  - toccandola si apre o torna in primo piano Aura con `?task=id`, e la card si evidenzia (`showTask`).
- **iPhone**:
  - le notifiche funzionano solo con Aura installata sulla schermata Home e aperta dall'icona, con iOS 16.4 o successivo;
  - `Notification.requestPermission()` va chiamata subito al tocco, senza attese di rete prima: chiave VAPID e service worker si preparano all'apertura del foglio;
  - ogni push deve mostrare una notifica, altrimenti iOS toglie la sottoscrizione.
- "Prova una notifica" (`POST /api/push/test`) mostra l'esito del servizio push, con il codice d'errore di Apple o Google se rifiuta.

**Limiti noti**
- L'elenco arriva al server solo quando l'app ha internet: un'attività aggiunta offline non avvisa finché l'app non si riapre online.
- Il codice va copiato dall'app installata, che su iPhone ha un archivio separato da Safari.

**Limiti del piano gratuito**: 100.000 richieste al giorno, 10 ms di CPU per richiesta, 50 sottorichieste, D1 con 100.000 scritture al giorno. Il server ha i suoi limiti:
- frase ≤ 500 caratteri;
- ≤ 30 frasi in attesa;
- ≤ 200 promemoria per dispositivo;
- ≤ 1000 dispositivi;
- pulizia oraria di frasi vecchie, segni anonimi di oltre un giorno e dispositivi non visti da 180 giorni.

**Limiti di richieste per indirizzo IP**
Su `workers.dev` le regole WAF non valgono, quindi si usa il binding Rate Limiting dei Workers, che non ha costi aggiuntivi. È configurato in `wrangler.toml`; `period` vale solo 10 o 60 secondi.

| Binding | Limite per IP | Richieste |
|---|---|---|
| `RATE_LIMIT_STRICT` | 10 al minuto | `POST /api/devices`; `POST /api/push/test` con un contatore suo |
| `RATE_LIMIT_INBOX` | 20 al minuto | `POST /api/inbox` |
| `RATE_LIMIT_API` | 120 al minuto | tutte le altre `/api/…`; non contano `OPTIONS` e `GET /api/health` |

- **Chiave**: `clientKey()`, cioè `CF-Connecting-IP`, che il client non può falsificare. Per IPv6 vale la rete /64, e `::ffff:a.b.c.d` vale come IPv4.
- **Oltre il limite**: 429 con `Retry-After: 60` e le intestazioni CORS. La casella risponde in testo semplice ("Troppe richieste: riprova tra un minuto."); le altre richieste in JSON ("Troppe richieste da questa rete…").
- **Se manca il binding** (test, prove) **o il servizio non risponde, la richiesta passa**: meglio un limite in meno che un'app bloccata.
- ⚠️ **I conteggi sono approssimati** e separati per ogni sede di Cloudflare: su raffiche brevi passano più richieste del limite. Il binding frena gli abusi prolungati; il freno esatto è il tetto qui sotto.

**Tetto di nuove registrazioni: 20 in 24 ore, in tutto**
Variabile facoltativa: `MAX_NEW_DEVICES_PER_DAY`. `registerDevice` controlla in quest'ordine:
1. **Dispositivo già registrato**: 200, sempre, senza controlli.
2. **Tetto giornaliero**: una query sull'indice `devices_created` (`COUNT` e `MIN(created_at)` delle righe delle ultime 24 ore) legge poche righe. A tetto raggiunto risponde 503 con `Retry-After`: i secondi finché la registrazione più vecchia della finestra compie 24 ore.
3. **Conteggio completo** per il tetto dei 1000 dispositivi: legge tutta la tabella.

Ogni volta che il conteggio completo gira resta una riga con `created_at`, quindi gira **al massimo 20 volte al giorno**:
- in caso di registrazione, è il dispositivo stesso;
- se il server è pieno, è un **segno anonimo**, con id `segno:…` che non può mai coincidere con un'impronta;
- anche "Scollega" trasforma il dispositivo in un segno anonimo: così registrarsi e scollegarsi di continuo non aggira il tetto.

La pulizia oraria toglie i segni più vecchi di 24 ore. Nell'app, `Aura.remote.troubleMessage()` mostra la spiegazione del server: limite per IP, tetto giornaliero, server pieno.

## Prova completa in locale

**Prova completa in locale** (app + server vero), da rifare quando cambiano server, `remote.js`, la casella o la CSP:
1. In `server/`, una volta: `npm run vapid -- --local`.
2. Prima di ogni prova: cancella `server/.wrangler/state` e poi `npm run db:init:local`. Senza un database vuoto, le prove ripetute riempirebbero il tetto di 20 registrazioni al giorno.
3. Avvia `npm run dev` (127.0.0.1:8787, con i limiti per IP simulati da Miniflare) e un finto servizio push su `localhost:9999`.
4. **Server di prova** su `http://localhost:8765`, l'origine ammessa in `.dev.vars`: serve l'app e **inoltra `/api/` e `/__scheduled` a wrangler dev**. Con la CSP l'app parla solo con la sua origine, quindi `aura-tasks:server` = `http://localhost:8765`.
5. Guida Edge headless via DevTools, in tempo reale:
   - `Browser.grantPermissions` per le notifiche;
   - `Page.addScriptToEvaluateOnNewDocument` per un `PushManager` simulato, perché in headless non c'è un servizio push, e per registrare gli eventi `securitypolicyviolation`, che devono essere zero;
   - `ServiceWorker.deliverPushMessage` per provare l'evento `push`, poi `getNotifications()`.
6. Il Cron si fa partire con `GET /__scheduled`.
