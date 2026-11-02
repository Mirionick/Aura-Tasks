/*
 * D1 finto per i test: le stesse chiamate di Cloudflare D1 (prepare/bind/first/all/run/batch)
 * su un vero SQLite in memoria (node:sqlite). Così i test eseguono l'SQL vero del server.
 */
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

export function createD1(schemaPath) {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(schemaPath, 'utf8'));

  const plainRow = row => (row ? { ...row } : null);

  function statement(sql, params = []) {
    const run = () => db.prepare(sql).run(...params);
    return {
      bind: (...values) => statement(sql, values),
      async first(column) {
        const row = plainRow(db.prepare(sql).get(...params));
        if (!row) return null;
        return column ? row[column] : row;
      },
      async all() {
        return { results: db.prepare(sql).all(...params).map(plainRow), success: true, meta: {} };
      },
      async run() {
        return { success: true, meta: { changes: Number(run().changes) } };
      },
      runNow: run
    };
  }

  return {
    prepare: sql => statement(sql),
    async batch(statements) {
      // Come D1: tutte le istruzioni o nessuna.
      db.exec('BEGIN');
      try {
        const results = statements.map(item => ({ success: true, meta: { changes: Number(item.runNow().changes) } }));
        db.exec('COMMIT');
        return results;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
    /** Solo per i controlli dei test. */
    query: (sql, ...params) => db.prepare(sql).all(...params).map(plainRow)
  };
}
