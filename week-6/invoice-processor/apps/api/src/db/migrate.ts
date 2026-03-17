import { env } from '../env.js';
import { runMigrations } from './migration-runner.js';

await runMigrations({
  databaseUrl: env.databaseUrl,
  repoRoot: env.repoRoot,
});
console.info(`Database migrated at ${env.databaseUrl}`);

