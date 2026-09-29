import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function createStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS plans (id TEXT PRIMARY KEY, data TEXT NOT NULL);
  `);

  return {
    createSession(profile = { name: 'Alex Morgan', initials: 'AM' }) {
      const token = randomUUID();
      const user = {
        id: randomUUID(),
        name: profile.name,
        initials: profile.initials,
        color: 'sage',
      };
      db.prepare('INSERT INTO sessions VALUES (?, ?)').run(
        token,
        JSON.stringify(user),
      );
      return { token, user };
    },
    getUser(token) {
      const row = db
        .prepare('SELECT user FROM sessions WHERE token = ?')
        .get(token);
      return row ? JSON.parse(row.user) : null;
    },
    saveUser(token, user) {
      db.prepare('UPDATE sessions SET user = ? WHERE token = ?').run(
        JSON.stringify(user),
        token,
      );
    },
    getPlans() {
      return db
        .prepare('SELECT data FROM plans ORDER BY rowid')
        .all()
        .map((row) => JSON.parse(row.data));
    },
    getPlan(id) {
      const row = db.prepare('SELECT data FROM plans WHERE id = ?').get(id);
      return row ? JSON.parse(row.data) : null;
    },
    savePlan(plan) {
      db.prepare(
        'INSERT INTO plans VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data',
      ).run(plan.id, JSON.stringify(plan));
      return plan;
    },
    close() {
      db.close();
    },
  };
}
