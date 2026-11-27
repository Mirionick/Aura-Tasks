# Connettore per Claude: «Aggiungi ad Aura» (passi 6.1 e 6.2 scritti; il server è da pubblicare)

In una chat con Claude si dice «mettilo su Aura», oppure è Claude a chiedere «Lo metto su Aura?». Claude usa lo strumento **«Aggiungi ad Aura»** e le attività arrivano nella casella di Aura, la stessa delle frasi di Siri. Claude può solo aggiungere: non legge, non cambia e non cancella niente. La proposta è [P-006](../../docs/proposte/P-006.md).

**Categoria**: gratuita, come la casella di Siri. Il connettore non usa l'IA del server.

## Passi

| Passo | Contenuto | Stato |
|---|---|---|
| 6.1 | Server: accesso OAuth con il codice di Aura, connettore MCP con lo strumento, limiti, pulizie, test | scritto il 23 novembre 2026; da pubblicare con `npm run db:init`, poi `npm run deploy` |
| 6.2 | App: riga e foglio «Claude» nelle Impostazioni (codice, stato, «Scollega Claude»), frasi «Da Claude», testo della Privacy | scritto il 27 novembre 2026 (PR 23); funziona quando il server del 6.1 è pubblicato |

Chi non usa Claude non vede differenze, tranne la riga nuova nelle Impostazioni. Finché il server non è pubblicato, il foglio «Claude» risponde «Il server di Aura non è ancora pronto per Claude: va aggiornato.», e la riga nelle Impostazioni può dire «Stato non disponibile».

## Come ci si collega (una volta sola)
1. Su claude.ai, dal sito o dall'app per il computer: **Personalizza › Connettori › «+» › «Aggiungi connettore personalizzato»** (in inglese Customize › Connectors › Add custom connector). Dall'app del telefono non si aggiunge, ma poi si usa anche lì.
2. Nome: `Aura`. Indirizzo: **`https://aura.auramirionick.workers.dev/mcp`**, esattamente così, senza la barra finale: Claude controlla che sia uguale a quello che il server dichiara.
3. «Connetti» (Connect): si apre la pagina di Aura «Collega Claude ad Aura», che chiede il codice.
4. In Aura: Impostazioni › Claude › «Mostra il codice». Il codice ha 8 caratteri, come `K7PM-4QRT`, e vale 10 minuti.
5. Si scrive il codice e si tocca «Collega». La pagina torna su claude.ai, e il connettore risulta collegato.

Prima di usare lo strumento Claude chiede il permesso nella chat; si può scegliere «Consenti sempre». Nel piano Free di Claude si può aggiungere un solo connettore personalizzato.

## Come funziona sul server

Codice: `server/src/oauth.js` (accesso, pagina, token) e `server/src/mcp.js` (protocollo e strumento); le rotte in `server/src/index.js`; i testi in `server/src/text.js` (`CLAUDE_PAGE`, `MCP_TEXTS`). Nessuna dipendenza.

### Indirizzi

| Richiesta | Chi la fa | A che cosa serve |
|---|---|---|
| `POST /mcp` | Claude, con il suo token | il connettore (MCP); `GET` e `DELETE` rispondono 405 |
| `GET /.well-known/oauth-protected-resource/mcp` (e senza `/mcp`) | Claude | dove si fa l'accesso (RFC 9728) |
| `GET /.well-known/oauth-authorization-server` | Claude | come si fa l'accesso (RFC 8414) |
| `GET /oauth/authorize` · `POST /oauth/authorize` | il browser di chi si collega | la pagina con il codice · il codice scritto |
| `POST /oauth/token` | Claude | riceve e rinnova i token |
| `POST /oauth/register` | Claude | registrazione automatica (DCR), se non usa la sua identità pubblicata |
| `POST /api/claude/code` | l'app, con il codice del dispositivo | un codice nuovo per collegare: `{ code, expiresAt }` |
| `GET /api/claude` | l'app | lo stato: `{ links: [{ createdAt, usedAt }], code: { expiresAt } \| null }` |
| `DELETE /api/claude` | l'app | «Scollega Claude»: tolti tutti i collegamenti e i codici del dispositivo, `{ ok, deleted }` |

Gli indirizzi fuori da `/api/` non hanno CORS: le pagine di altri siti non li possono leggere. L'intestazione `Origin`, quando c'è:
- metadati e pagina in `GET`: qualsiasi;
- modulo della pagina (`POST /oauth/authorize`): solo l'origine del server stesso;
- connettore, token e registrazione: solo `https://claude.ai`. Claude chiama dai suoi server (indirizzi `160.79.104.0/21`), quindi di solito l'intestazione non c'è.

Le altre ricevono 403.

### Il codice per collegare
- 8 caratteri dall'alfabeto `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (31 segni, senza 0, O, 1, I, L), scelti in modo uniforme; l'app li mostra come `K7PM-4QRT`. Maiuscole, minuscole, spazi e trattini non contano.
- Vale 10 minuti e una volta sola; un codice nuovo prende il posto di quello di prima. Il server ne tiene solo l'impronta SHA-256.
- La pagina accetta al massimo 10 tentativi al minuto per IP. Le combinazioni sono circa 850 miliardi.

### L'accesso (OAuth 2.1)
- **Metadati**: `client_id_metadata_document_supported: true` e `token_endpoint_auth_methods_supported: ["none"]`, così Claude usa la sua identità pubblicata; `code_challenge_methods_supported: ["S256"]`; `authorization_response_iss_parameter_supported: true`; un solo permesso, `aggiungi`. La risorsa è `https://aura.auramirionick.workers.dev/mcp`.
- **Chi può chiedere**:
  - l'identità pubblicata di Claude, `client_id` = `https://claude.ai/oauth/mcp-oauth-client-metadata`, con l'indirizzo di ritorno `https://claude.ai/api/mcp/auth_callback`. Il documento non si scarica: il server ne tiene una copia fissa (vedi P-006, «L'accesso»);
  - una registrazione automatica, accettata solo con quell'indirizzo di ritorno e `token_endpoint_auth_method` `none`. Al massimo 50; quella usata meno di recente lascia il posto, e la pulizia toglie quelle ferme da 30 giorni.
- **La pagina** ricontrolla tutti i parametri, prima di mostrare il modulo e di nuovo quando arriva il codice.
  - Un client o un indirizzo di ritorno sbagliati, o un parametro ripetuto: pagina d'errore, senza mai rimandare altrove.
  - Gli altri errori tornano a Claude (303) con `error`, `state` e `iss`: `response_type` diverso da `code`, PKCE mancante o non S256, `resource` diverso dal connettore, `state` oltre 1.024 caratteri (che allora non torna indietro).
  - Niente script; CSP `default-src 'none'`, stile con un nonce, `form-action` verso se stessa e claude.ai, `frame-ancestors 'none'`, `base-uri 'none'`; `Referrer-Policy: same-origin` (con `no-referrer` il browser manderebbe il modulo con `Origin: null`); `Cache-Control: no-store`; `X-Frame-Options: DENY`. Ogni valore passa dall'escape HTML. Due temi, testi in italiano.
- **Il codice giusto** si consuma e diventa, nello stesso batch, un codice d'autorizzazione che vale 60 secondi e una volta sola. Due invii insieme non valgono due volte.
- **Token** (`POST /oauth/token`, solo `application/x-www-form-urlencoded`):
  - `authorization_code`: il codice si consuma alla prima prova, anche se poi un controllo fallisce; devono coincidere client, indirizzo di ritorno, `resource` (se c'è) e la verifica PKCE; il dispositivo deve esistere ancora;
  - `refresh_token`: serve `client_id`; il token di rinnovo cambia a ogni uso e quello vecchio riceve `invalid_grant`;
  - token d'accesso di un'ora, di rinnovo di 180 giorni; 32 byte casuali, nel database solo le impronte SHA-256;
  - al massimo 3 collegamenti per dispositivo: con il quarto si toglie quello usato meno di recente.
- **Senza token valido** il connettore risponde 401 con `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource/mcp", scope="aggiungi"` (più `error="invalid_token"` se un token c'era): Claude rinnova o rifà l'accesso.

### Il connettore (MCP)
Il server parla le due epoche del protocollo e sceglie dalla richiesta, come prevede la specifica per un server «dual-era». In tutte e due: niente sessioni (`Mcp-Session-Id`), niente flussi SSE, ogni `POST` riceve una risposta JSON; le notifiche ricevono 202.

| | 2025-11-25 (e 2025-06-18, 2025-03-26) | 2026-07-28 |
|---|---|---|
| Come comincia | `initialize`, con la versione chiesta se la conosce, altrimenti 2025-11-25 | niente stretta di mano: `server/discover` se il client lo chiede |
| In ogni richiesta | `MCP-Protocol-Version` (se c'è, deve essere una di queste tre; altrimenti 400) | `_meta` con `io.modelcontextprotocol/protocolVersion` e `io.modelcontextprotocol/clientCapabilities`; intestazioni `MCP-Protocol-Version`, `Mcp-Method` e, per `tools/call`, `Mcp-Name` (anche nella forma `=?base64?…?=`), uguali al corpo |
| Metodi | `initialize`, `ping`, `tools/list`, `tools/call` | `server/discover`, `tools/list`, `tools/call` |
| Risultati | come la specifica 2025-11-25 | con `resultType: "complete"`; `server/discover` e `tools/list` con `ttlMs` (un'ora) e `cacheScope: "public"` |
| Errori | metodo sconosciuto: -32601 | `_meta` incompleto: -32602 (400); versione sconosciuta: -32022 (400) con `supported` e `requested`; intestazioni diverse dal corpo: -32020 (400); metodo sconosciuto: -32601 (404) |

Corpo al massimo 16 KB; JSON non valido: -32700 (400); richiesta JSON-RPC non valida: -32600 (400).

### Lo strumento «Aggiungi ad Aura»
- Nome `aggiungi_ad_aura`; ingresso `{ attivita: [frasi] }`, da 1 a 10 frasi di al massimo 200 caratteri, pulite come quelle di Siri (`cleanText`). Annotazioni tutte `false` (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`).
- La descrizione per Claude e le istruzioni del server sono in `MCP_TEXTS` (`server/src/text.js`), con un test: dicono che può solo aggiungere, che quando l'idea è sua chiede prima «Lo metto su Aura?», che il giorno si scrive come data («27 novembre», non «domani»), che le ripetizioni si scrivono «ogni lunedì», e di non scrivere dati riservati.
- La risposta è solo testo: «Fatto: 2 attività nella casella di Aura. L'utente le vedrà la prossima volta che apre l'app.» Gli errori tornano come risultato dello strumento (`isError: true`), così Claude li spiega.
- **I limiti**, controllati tutti nella stessa `INSERT … SELECT` che scrive le frasi: una chiamata entra tutta o non entra, e due chiamate insieme non li superano. Prima una lettura sceglie il messaggio giusto.
  - 50 frasi al giorno (UTC) per dispositivo, con tutti i suoi collegamenti: «Scollega Claude» e un collegamento nuovo non azzerano il conto;
  - 1.000 frasi al giorno per tutto il server (variabile facoltativa `MAX_CLAUDE_PER_DAY`): una frase costa una decina di scritture su D1, quindi al massimo circa 10.000 delle 100.000 del piano gratuito;
  - 30 frasi in attesa per dispositivo, contando anche Siri. Anche la scrittura di Siri (`POST /api/inbox`) conta i posti nella stessa `INSERT … SELECT`: una frase di Claude arrivata nel frattempo non fa superare il tetto.
- Le frasi entrano nella tabella `inbox` con id `claude:` più 16 caratteri casuali: i due punti non ci sono mai negli id di Siri. `GET /api/inbox` aggiunge a ogni frase `source` (`"siri"` o `"claude"`), e `POST /api/inbox/ack` accetta anche questi id.

### Dati
Tabelle nuove in `server/schema.sql`, con `CREATE TABLE IF NOT EXISTS`: `npm run db:init` le aggiunge senza toccare le altre.
- `claude_links`: id casuale, dispositivo, client, risorsa, impronte e scadenze dei token, creazione e ultimo uso.
- `claude_codes`: impronte dei codici per collegare (`pair`, 10 minuti) e d'autorizzazione (`auth`, 60 secondi, con client, indirizzo di ritorno, `code_challenge` e risorsa).
- `oauth_clients`: le registrazioni automatiche (id, indirizzi di ritorno, nome, date).
- `claude_usage`: frasi di Claude per dispositivo e giorno, più la riga del totale di tutti (`device_id = '*'`), come `assistant_usage`: solo numeri.

**Pulizia**
- «Scollega questo dispositivo» toglie collegamenti, codici e conteggi del dispositivo; il totale di tutti resta.
- «Scollega Claude» toglie collegamenti e codici, non i conteggi.
- Ogni ora: codici scaduti, collegamenti con il rinnovo scaduto, registrazioni ferme da 30 giorni, conteggi di più di due giorni fa, collegamenti e codici dei dispositivi non visti da 180 giorni.

**Nei log** non vanno mai token, codici né frasi: solo il motivo di un rifiuto, come «indirizzo di ritorno non ammesso».

### Limiti per indirizzo IP
| Binding | Limite per IP | Richieste |
|---|---|---|
| `RATE_LIMIT_STRICT` | 10 al minuto, ognuna con il suo contatore | `POST /api/claude/code`, `POST /oauth/authorize`, `POST /oauth/token`, `POST /oauth/register` |
| `RATE_LIMIT_API` | 120 al minuto | `/mcp`, metadati, pagina in `GET` (contatore `claude`); `GET` e `DELETE /api/claude` (contatore di sempre) |

Le richieste di Claude arrivano tutte dagli indirizzi di Anthropic, e i limiti per IP le contano insieme: con pochi utenti non è un problema. Oltre il limite: 429 con `Retry-After: 60`; la pagina con il codice resta, con il messaggio «riprova tra un minuto».

## Prove
- **`npm test`** in `server/`: `test/claude.test.mjs` copre metadati, codice per collegare, pagina (escape, intestazioni, errori che non rimandano altrove), modulo, token, rinnovo, registrazione automatica, le due epoche del protocollo, lo strumento con tutti i limiti (anche una frase che arriva tra la lettura e la scrittura), «Scollega», pulizie, `schema.sql` applicato due volte, log senza segreti.
- **Con i client MCP ufficiali** (fuori dalla CI): `scripts/prova-connettore.mjs` fa l'accesso completo e usa lo strumento con `@modelcontextprotocol/client` 2.x (2026-07-28 fissata, negoziazione automatica e modo predefinito 2025-11-25; identità pubblicata e registrazione automatica; rinnovo dopo un 401) e con `@modelcontextprotocol/sdk` 1.x (2025-11-25). Il server gira in memoria, senza rete:
  ```
  npm install --no-save @modelcontextprotocol/client@2.4.0 @modelcontextprotocol/sdk@1.32.2
  node scripts/prova-connettore.mjs
  ```
  I risultati sono in [decisioni.md](../../docs/decisioni.md), sezione 4.
- **Con Claude vero**, dopo la pubblicazione del server e l'unione del passo 6.2 (Product Owner): collegare il connettore, dire «mettimi su Aura: …» dal sito e dall'app di Claude sull'iPhone, poi aprire Aura. Da vedere anche se il connettore si usa nelle chat dei progetti di Claude. Se qualcosa non va, Claude Code legge `wrangler tail`, dove non ci sono mai token né frasi.

## Nell'app (passo 6.2)

Codice: `js/claude.js` (logica pura: come si mostra il codice, quanto vale ancora, le righe dei collegamenti, quando ne arriva uno nuovo) e `js/ui-claude.js` (il foglio); le richieste in `js/remote.js` (`api.claudeCode`, `api.claudeStatus`, `api.claudeUnlink`), la riga in `js/settings.js`.

### La riga «Claude» nelle Impostazioni
Sotto «Comando Rapido di Siri». Dice:
- «Da collegare», finché non c'è un collegamento. Senza il codice del dispositivo non si chiede niente al server;
- «Collegato», con almeno un collegamento;
- «Controllo…» mentre chiede lo stato, «Stato non disponibile» se non riesce a saperlo (senza internet, con il server giù o non ancora aggiornato);
- senza il server (app aperta dal file, server non configurato) la riga è spenta, come quella dell'assistente.

Lo stato si chiede al server all'avvio (solo se il dispositivo ha il suo codice), quando torna internet, aprendo le Impostazioni (al massimo ogni 30 secondi) e aprendo il foglio «Claude». Sta solo in memoria: non si salva.

### Il foglio «Claude»
- In cima, che cosa fa e che cosa no, poi una riga di stato: «Claude non è collegato.», «Claude è collegato: in una chat puoi dirgli «mettilo su Aura».», oppure l'esito dell'ultima azione.
- **Collegamenti**, solo se ce n'è almeno uno: una riga ciascuno, dal più vecchio, come «Collegato dal 23 novembre · ultimo uso oggi alle 15:02» (con l'anno se non è quello di adesso; «Collegato oggi alle 10:15»; «non ancora usato»). Sotto, **«Scollega Claude»** apre una conferma nel foglio: «Scollegare Claude? Non potrà più aggiungere attività, e per ricollegarlo servirà un codice nuovo.», con «Scollega» e «Annulla». «Scollega» toglie tutti i collegamenti e i codici del dispositivo (`DELETE /api/claude`).
- **Come collegarlo**: i tre passi, con l'indirizzo del connettore (quello del server più `/mcp`) e «Copia». L'indirizzo va a capo solo dopo `https://` e prima di un punto o di una barra.
- **«Mostra il codice»**: è il pulsante principale finché Claude non è collegato; dopo resta, più leggero, per un altro collegamento.
  - Se il dispositivo non ha ancora il suo codice sul server, prima lo registra, come «Crea il codice per Siri».
  - Poi chiede un codice (`POST /api/claude/code`) e lo mostra in grande, in due gruppi da quattro (`K7PM-4QRT`), con «Vale ancora 10 minuti», che scende ogni minuto, e «Nuovo codice».
  - Il focus va sul codice, e il lettore di schermo legge «Codice per Claude: K 7 P M, 4 Q R T», un carattere alla volta.
  - Il tempo si conta con l'orologio del telefono, ma mai oltre 10 minuti da quando il codice arriva: con l'orologio indietro il codice non sembra valere più del vero.
- Mentre il codice è in vista e il foglio è aperto, l'app chiede lo stato ogni 4 secondi (`GET /api/claude`). Con Aura in secondo piano si ferma, e al ritorno controlla subito.
  - Un collegamento che prima non c'era (si riconosce dalla data, perché con il quarto il server toglie quello usato meno di recente e il numero resta 3): il codice sparisce, e la riga dice «Claude è collegato. Prova a scrivergli «metti su Aura: comprare il latte»: l'attività arriva quando riapri Aura.».
  - Il server non dà più il codice come valido: «Codice usato: aspetto Claude…». Se entro un minuto il collegamento non arriva: «Claude non ha finito il collegamento: tocca «Mostra il codice» e riprova.».
  - Il tempo finisce: «Il codice è scaduto: tocca «Mostra il codice» per averne uno nuovo.».
- Gli errori si leggono nella riga di stato, con il motivo. Se il server non conosce ancora questi indirizzi (404: è di prima del passo 6.1): «Il server di Aura non è ancora pronto per Claude: va aggiornato.».

### Le frasi «Da Claude»
Le frasi con `source: "claude"` (o con l'id che comincia con `claude:`) restano in coda con la loro origine, nel campo `source` di `remote.inbox`.
- Con l'assistente spento si aprono in «Nuova attività» con l'intestazione «Da Claude · 1 di 2» (e «Da Siri · 2 di 2» per quelle di Siri).
- Con l'assistente acceso passano dall'assistente come quelle di Siri (richiesta `siri`): l'avviso dice «Da Claude: aggiunta …», oppure «Da Siri e da Claude: …» quando arrivano insieme; nell'elenco «Cosa ha fatto l'assistente» l'origine è «Da Claude», come «Da Siri».

### Privacy e «Scollega questo dispositivo»
- Il foglio «Claude» ha due note sulla privacy; il foglio «Privacy» le ripete nella sezione «Claude», dopo Siri.
- Con Claude collegato, la riga della privacy nelle Impostazioni e nel foglio «Privacy» lo nomina: «…arrivano solo promemoria e frasi di Siri e di Claude.».
- «Scollega questo dispositivo» toglie sul server anche i collegamenti di Claude. Per questo, solo con Claude collegato, sotto il pulsante c'è «Scollega anche Claude, che con «Annulla» non torna: per ricollegarlo servirà un codice nuovo.» (e «Scollega anche Claude.» nel foglio dell'assistente). «Annulla» registra di nuovo il dispositivo e rimette promemoria e assistente com'erano, ma non Claude, e l'avviso lo dice: «Dispositivo ricollegato. Claude va ricollegato con un codice nuovo.».
- Per questo avviso, prima di scollegare l'app chiede al server se Claude è collegato: lo stato in memoria può mancare (la prima domanda non è finita o non è andata) o essere vecchio. Se una domanda è già in corso, aspetta quella. Se non riesce a saperlo, scollega lo stesso, e dopo «Annulla» l'avviso dice «Dispositivo ricollegato. Se avevi collegato Claude, va ricollegato con un codice nuovo.».

### Dati e prove
- Niente di nuovo da salvare, tranne `source` nelle frasi in coda. Niente nel backup. La CSP non cambia: il server è già in `connect-src`. Cache del service worker `aura-tasks-v25`.
- `tests/claude.test.js` (codice, tempo che resta, stato del server, collegamento nuovo, righe con le date, indirizzo) e i test di `remote`, `settings` e `assistant` per `source`, «Da Claude», la riga e la privacy: 360 su 360, con l'ora di Roma, New York, Auckland, San Paolo e UTC.
- Nel browser, con un server finto (fuori dal repository): tutto il percorso, dal primo codice al collegamento; codice usato e scaduto; errori, anche del server non aggiornato; frasi «Da Claude» con l'assistente spento e acceso; «Scollega questo dispositivo» con «Annulla», anche con lo stato di Claude ancora in arrivo, non riuscito o non disponibile; il foglio «Privacy»; due temi, 320 e 390 px, aree di tocco, axe senza violazioni.
