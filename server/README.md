# Server di Aura

Un piccolo server su **Cloudflare Workers**, piano gratuito, per due funzioni dell'app. Entrambe sono facoltative:

- **Promemoria**: una notifica push prima delle attività con giorno e ora, anche ad app chiusa. Il Cron controlla ogni minuto.
- **Casella del Comando Rapido di Siri**: il comando scrive la frase dettata; quando apri Aura, l'app la ritira e mostra il foglio "Nuova attività" già compilato.

Ogni dispositivo ha un **codice segreto casuale**, generato dall'app. Senza un codice valido il server rifiuta.

## Che cosa conserva
Il server conserva solo:
- l'**impronta SHA-256** del codice di ogni dispositivo, mai il codice;
- la **sottoscrizione push** del dispositivo;
- per ogni promemoria: **titolo, ora e momento dell'avviso**, cancellati quando l'attività è passata;
- le **frasi di Siri**, cancellate quando l'app le ritira (al massimo dopo 30 giorni).

Tutto il resto resta sul telefono.

**Il repository è pubblico.** Le chiavi VAPID stanno solo nei *secrets* di Cloudflare e non vanno mai scritte nei file. Git ignora `.dev.vars` (chiavi delle prove in locale), `.wrangler/` e `node_modules/`.

## Prima installazione (una volta sola)

1. **Node.js**: installa la versione LTS da https://nodejs.org. Serve per Wrangler, lo strumento di Cloudflare.
2. **Account Cloudflare** gratuito:
   - registrati su https://dash.cloudflare.com/sign-up e conferma l'email;
   - in **Workers & Pages** scegli il sottodominio `workers.dev`.
3. Da questa cartella (`server/`), nel terminale:
   ```
   npm install                 # installa Wrangler (solo in questa cartella)
   npx wrangler login          # si apre il browser: accedi e premi "Allow"
   npx wrangler d1 create aura # crea il database: copia il "database_id" in wrangler.toml
   npm run db:init             # crea le tabelle
   npm run deploy              # pubblica il server: https://aura.<sottodominio>.workers.dev
   npm run vapid               # crea le chiavi VAPID e le salva nei secrets (non le mostra)
   ```
4. **Prova**: apri `https://aura.<sottodominio>.workers.dev/api/health`. Deve rispondere `{"ok":true}`.
5. Metti l'indirizzo del server in `app-attivita/js/remote.js` (`SERVER_URL`) e pubblica l'app.

## Aggiornare il server
- `npm test`, poi `npm run deploy`. **Il push su GitHub aggiorna solo l'app, non il server.**
- Se cambia `schema.sql`, esegui `npm run db:init`. Usa solo `CREATE … IF NOT EXISTS`, quindi non cancella nulla. Per modificare una tabella che esiste già serve un `ALTER TABLE`.
- Le chiavi VAPID non si cambiano: con chiavi nuove le notifiche si fermano finché ogni telefono non rifà la sottoscrizione. L'app se ne accorge entro un giorno. Se serve davvero: `npm run vapid -- --force`.

## Prove
- **`npm test`**: test con Node, senza installare altro. Coprono:
  - la cifratura, confrontata byte per byte con l'esempio della RFC 8291;
  - la firma VAPID;
  - tutte le API su un vero SQLite in memoria;
  - il Cron, con un servizio push finto.
- **In locale, col runtime vero di Cloudflare**:
  ```
  npm run vapid -- --local    # chiavi usa e getta in .dev.vars (Git lo ignora)
  npm run db:init:local
  npm run dev                 # http://localhost:8787
  ```
  Per far partire il Cron a mano: apri `http://localhost:8787/__scheduled?cron=*+*+*+*+*`.
  In `.dev.vars`:
  - `ALLOWED_ORIGINS` indica da quale indirizzo locale arriva l'app;
  - `PUSH_TEST_ORIGIN` ammette un finto servizio push locale (solo nelle prove).

## API
Il codice del dispositivo viaggia nell'intestazione `Authorization: Bearer <codice>`.

| Richiesta | A cosa serve |
|---|---|
| `GET /api/health` | Il server è vivo? |
| `GET /api/push/key` | Chiave pubblica VAPID, per la sottoscrizione |
| `POST /api/devices` · `DELETE /api/devices` | Registra il codice · "Scollega": cancella casella, sottoscrizione e promemoria; il codice smette di valere |
| `POST /api/inbox` | Il Comando Rapido scrive una frase (`text` come JSON, modulo o testo semplice). Risponde in testo semplice: "Aggiunto ad Aura: …" oppure l'errore |
| `GET /api/inbox` · `POST /api/inbox/ack` | L'app ritira le frasi, poi conferma quelle salvate |
| `PUT /api/push/subscription` · `DELETE` | Sottoscrizione push del dispositivo (solo servizi noti: Apple, Google, Mozilla, Microsoft) |
| `PUT /api/reminders` | Elenco completo dei promemoria del dispositivo (`id`, `at`, `fireAt`, `title`, `time`) |
| `POST /api/push/test` | "Prova una notifica" |

## Il Comando Rapido di Siri (sull'iPhone)
L'indirizzo e il codice da copiare sono in Aura: campanella → "Comando Rapido di Siri" → "Crea il codice per Siri".
1. Apri l'app **Comandi**, tocca **+** e aggiungi l'azione **Detta testo**.
2. Aggiungi **Ottieni contenuti dell'URL** e incolla l'indirizzo. Apri le opzioni:
   - metodo **POST**;
   - in **Intestazioni** aggiungi **Authorization** con il valore copiato;
   - in **Corpo richiesta** scegli **JSON** e aggiungi il campo di testo **text** con la variabile **Testo dettato**.
3. Aggiungi **Mostra notifica** con la variabile **Contenuti dell'URL**.
4. Chiama il comando **Aura**.

Di' "Ehi Siri, Aura", poi detta per esempio "domani alle 10 dentista". Quando apri Aura, il foglio è già compilato.

## Problemi comuni
- **Su iPhone non si attivano i promemoria**: le notifiche push funzionano solo con Aura aggiunta alla schermata Home e aperta dall'icona, con iOS 16.4 o successivo.
- **"Il servizio di notifiche ha rifiutato l'invio (403 …)"**: se il motivo è `BadJwtToken`, prova a mettere un indirizzo `mailto:…` in `VAPID_SUBJECT` (in `wrangler.toml`), poi `npm run deploy`.
- **Limiti del piano gratuito**, ampi per un uso personale:
  - 100.000 richieste al giorno;
  - 10 ms di CPU per richiesta;
  - D1 permette 100.000 scritture al giorno.
  - Il Cron invia al massimo 10 notifiche al minuto.

## Limiti contro gli abusi
- **Per indirizzo IP**, con il binding Rate Limiting dei Workers (in `wrangler.toml`). Le regole WAF non valgono su `workers.dev`.
  - `POST /api/devices`: 10 al minuto.
  - `POST /api/push/test`: 10 al minuto, con un contatore suo.
  - `POST /api/inbox`: 20 al minuto.
  - Tutte le altre `/api/…`: 120 al minuto. `OPTIONS` e `/api/health` non contano.
  - Per IPv6 conta la rete /64.
  - Oltre il limite: **429** con `Retry-After: 60`. Il Comando Rapido riceve il messaggio in testo semplice.
  - ⚠️ Cloudflare conta in modo **approssimato** e separato per ogni sede: su raffiche brevi passano più richieste. Se il servizio non risponde, le richieste passano.
- **Al massimo 20 nuove registrazioni in 24 ore, in tutto**, con un indice su `devices.created_at` (variabile facoltativa `MAX_NEW_DEVICES_PER_DAY`).
  - È un limite esatto. I dispositivi già registrati passano sempre.
  - A tetto raggiunto: **503** con `Retry-After`.
  - Si controlla prima del conteggio completo dei dispositivi, che così gira al massimo 20 volte al giorno.
  - "Scollega" e i tentativi a server pieno lasciano un segno anonimo, che conta per 24 ore: così il limite non si aggira.
- Nelle prove in locale, riparti da un database vuoto (cancella `.wrangler/state`, poi `npm run db:init:local`), altrimenti le prove ripetute riempiono il tetto.
