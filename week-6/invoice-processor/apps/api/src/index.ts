import { serve } from '@hono/node-server';
import { createApp, createDependencies } from './app.js';
import { env } from './env.js';

const dependencies = await createDependencies(env);
const app = createApp(dependencies);

serve({
  fetch: app.fetch,
  hostname: '0.0.0.0',
  port: env.API_PORT,
});

console.info(`API listening on http://0.0.0.0:${env.API_PORT}`);
