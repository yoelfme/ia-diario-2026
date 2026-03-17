import { mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';

export async function runMigrations(params: {
  databaseUrl: string;
  repoRoot: string;
}) {
  const migrationsDir = path.resolve(params.repoRoot, 'packages/db/drizzle');
  const dataDir = path.dirname(params.databaseUrl);
  await mkdir(dataDir, { recursive: true });

  const db = new Database(params.databaseUrl);

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      name TEXT PRIMARY KEY,
      executed_at TEXT NOT NULL
    );
  `);

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const exists = db
      .prepare('SELECT 1 FROM app_migrations WHERE name = ?')
      .get(file);

    if (exists) {
      continue;
    }

    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    const transaction = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO app_migrations (name, executed_at) VALUES (?, ?)').run(
        file,
        new Date().toISOString(),
      );
    });

    transaction();
  }

  db.close();
}

