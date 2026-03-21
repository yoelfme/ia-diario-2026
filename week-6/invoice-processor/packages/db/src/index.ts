import Database from 'better-sqlite3';
import postgres from 'postgres';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';

export * from './schema.js';

export function createSqliteDb(databaseUrl: string) {
  const sqlite = new Database(databaseUrl);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return drizzleSqlite(sqlite);
}

export function createPostgresDb(databaseUrl: string) {
  const client = postgres(databaseUrl, { prepare: false });
  return drizzlePg(client);
}

export type SqliteDatabase = ReturnType<typeof createSqliteDb>;
export type PostgresDatabase = ReturnType<typeof createPostgresDb>;
