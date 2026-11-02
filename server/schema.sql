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
