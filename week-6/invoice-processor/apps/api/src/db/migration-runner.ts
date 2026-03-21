import { mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';

const modernBaseline = '0000_hesitant_proudstar.sql';
const legacyChain = new Set([
  '0000_initial.sql',
  '0001_categories_and_invoice_date.sql',
  '0002_invoice_item_quantity_integer.sql',
]);

function tableExists(db: Database.Database, tableName: string) {
  return Boolean(
    db.prepare(`
      SELECT 1
      FROM sqlite_master
      WHERE type = 'table' AND name = ?
    `).get(tableName),
  );
}

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

  const allFiles = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const executedMigrationRows = db
    .prepare('SELECT name FROM app_migrations')
    .all() as Array<{ name: string }>;
  const executedMigrations = new Set(
    executedMigrationRows.map((row) => row.name),
  );
  const hasInvoicesTable = tableExists(db, 'invoices');
  const shouldUseModernBaseline = !hasInvoicesTable && ![...executedMigrations].some((name) => legacyChain.has(name));

  const files = allFiles.filter((file) => {
    if (shouldUseModernBaseline) {
      return !legacyChain.has(file);
    }

    return file !== modernBaseline;
  });

  for (const file of files) {
    if (executedMigrations.has(file)) {
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
    executedMigrations.add(file);
  }

  db.close();
}
