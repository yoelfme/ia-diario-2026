import { defineConfig } from 'drizzle-kit';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const packageDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = path.resolve(packageDir, '..', '..');
const databaseUrl = process.env.DATABASE_URL
  ? path.resolve(repoRoot, process.env.DATABASE_URL)
  : path.resolve(repoRoot, 'apps/api/data/invoices.db');

export default defineConfig({
  out: './drizzle',
  schema: './src/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: databaseUrl,
  },
});
