import { serve } from '@hono/node-server';
import { createApp, createDependencies } from './app.js';
import { env } from './env.js';

const dependencies = await createDependencies(env);
const app = createApp(dependencies);

serve({
  fetch: app.fetch,
  port: env.API_PORT,
});

console.info(`API listening on http://localhost:${env.API_PORT}`);

