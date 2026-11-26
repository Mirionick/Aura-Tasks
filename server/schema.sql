-- Database D1 "aura". Si applica (anche più volte, non cancella nulla) con:
--   npm run db:init          sul server pubblicato
--   npm run db:init:local    per le prove con `wrangler dev`

-- Dispositivi: solo l'impronta SHA-256 del codice segreto, mai il codice.
-- Le righe con id "segno:…" sono segni anonimi (dispositivi scollegati o tentativi a server pieno):
-- contano nel tetto di nuove registrazioni al giorno e la pulizia le toglie dopo 24 ore.
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS devices_seen ON devices (seen_at);
CREATE INDEX IF NOT EXISTS devices_created ON devices (created_at);

-- Casella del Comando Rapido: frasi in attesa che l'app le ritiri.
CREATE TABLE IF NOT EXISTS inbox (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS inbox_device ON inbox (device_id, created_at);
CREATE INDEX IF NOT EXISTS inbox_age ON inbox (created_at);

-- Una sottoscrizione push per dispositivo (formato di PushSubscription.toJSON()).
CREATE TABLE IF NOT EXISTS subscriptions (
  device_id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Promemoria: at = ora dell'attività, fire_at = quando avvisare, sent_at = quando è partito (millisecondi).
-- Un promemoria inviato resta, segnato, finché l'ora dell'attività non è passata: così, se l'app rimanda
-- l'elenco, non riparte una seconda volta.
CREATE TABLE IF NOT EXISTS reminders (
  device_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  at INTEGER NOT NULL,
  fire_at INTEGER NOT NULL,
  title TEXT NOT NULL,
  time TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at INTEGER,
  PRIMARY KEY (device_id, task_id)
);
CREATE INDEX IF NOT EXISTS reminders_due ON reminders (fire_at);
CREATE INDEX IF NOT EXISTS reminders_at ON reminders (at);

-- Conteggi dell'assistente, per i limiti: solo numeri, mai contenuti (né messaggi, né audio, né attività).
-- Una riga per dispositivo e giorno, più la riga del totale di tutti (device_id = '*').
-- day è il giorno UTC ('AAAA-MM-GG'), come la quota di Workers AI, che riparte alle 00:00 UTC.
-- neurons_milli = millesimi di neurone. La pulizia oraria toglie le righe più vecchie di due giorni.
CREATE TABLE IF NOT EXISTS assistant_usage (
  device_id TEXT NOT NULL,
  day TEXT NOT NULL,
  messages INTEGER NOT NULL DEFAULT 0,
  opens INTEGER NOT NULL DEFAULT 0,
  audio_ms INTEGER NOT NULL DEFAULT 0,
  neurons_milli INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (device_id, day)
);
CREATE INDEX IF NOT EXISTS assistant_usage_day ON assistant_usage (day);

-- Connettore per Claude (P-006, app-attivita/docs/connettore-claude.md). Solo impronte SHA-256: mai codici né token.
-- Un collegamento per ogni accesso fatto da Claude con il codice di Aura (al massimo 3 per dispositivo).
CREATE TABLE IF NOT EXISTS claude_links (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  resource TEXT NOT NULL,
  access_hash TEXT NOT NULL,
  access_expires INTEGER NOT NULL,
  refresh_hash TEXT NOT NULL,
  refresh_expires INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS claude_links_access ON claude_links (access_hash);
CREATE UNIQUE INDEX IF NOT EXISTS claude_links_refresh ON claude_links (refresh_hash);
CREATE INDEX IF NOT EXISTS claude_links_device ON claude_links (device_id);
CREATE INDEX IF NOT EXISTS claude_links_expires ON claude_links (refresh_expires);

-- Codici di breve durata: kind 'pair' = il codice che l'app mostra (10 minuti); kind 'auth' = il codice
-- d'autorizzazione OAuth (60 secondi), con in data client, indirizzo di ritorno, code_challenge e resource.
CREATE TABLE IF NOT EXISTS claude_codes (
  hash TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  device_id TEXT NOT NULL,
  data TEXT,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS claude_codes_device ON claude_codes (device_id, kind);
CREATE INDEX IF NOT EXISTS claude_codes_expires ON claude_codes (expires_at);

-- Registrazioni automatiche di Claude (DCR), solo con il suo indirizzo di ritorno. Al massimo 50; la pulizia
-- toglie quelle non usate da 30 giorni.
CREATE TABLE IF NOT EXISTS oauth_clients (
  id TEXT PRIMARY KEY,
  redirect_uris TEXT NOT NULL,
  name TEXT,
  created_at INTEGER NOT NULL,
  used_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS oauth_clients_used ON oauth_clients (used_at);

-- Frasi di Claude per dispositivo e per giorno UTC, per il limite di 50 al giorno, più la riga del totale di
-- tutti (device_id = '*') per il tetto di 1.000: solo numeri, come assistant_usage. «Scollega Claude» non le
-- tocca, così ricollegarsi non azzera il conto; la pulizia oraria toglie le righe più vecchie di due giorni.
CREATE TABLE IF NOT EXISTS claude_usage (
  device_id TEXT NOT NULL,
  day TEXT NOT NULL,
  added INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (device_id, day)
);
CREATE INDEX IF NOT EXISTS claude_usage_day ON claude_usage (day);
