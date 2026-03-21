import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { z } from 'zod';

const appDir = fileURLToPath(new URL('..', import.meta.url));

function findRepoRoot(startDir: string) {
  let currentDir = startDir;

  while (true) {
    if (existsSync(path.join(currentDir, 'pnpm-workspace.yaml'))) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);

    if (parentDir === currentDir) {
      return path.resolve(appDir, '..', '..');
    }

    currentDir = parentDir;
  }
}

const repoRoot = findRepoRoot(appDir);

config({ path: path.join(repoRoot, '.env'), quiet: true });
config({ path: path.join(appDir, '.env'), override: true, quiet: true });

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1).optional(),
  DATABASE_URL: z.string().default('./data/invoices.db'),
  UPLOADS_DIR: z.string().default('./uploads'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  OPENAI_MODEL: z.string().default('gpt-4.1-mini'),
  DB_DRIVER: z.enum(['sqlite', 'postgres']).default('sqlite'),
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3001'),
});

const parsed = envSchema.parse(process.env);

function resolveFromAppDir(target: string) {
  return path.isAbsolute(target) ? target : path.resolve(appDir, target);
}

export const env = {
  ...parsed,
  appDir,
  repoRoot,
  databaseUrl: resolveFromAppDir(parsed.DATABASE_URL),
  uploadsDir: resolveFromAppDir(parsed.UPLOADS_DIR),
};

export type AppEnv = typeof env;
