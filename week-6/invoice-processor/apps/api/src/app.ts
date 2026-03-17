import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { lookup as lookupMimeType } from 'mime-types';
import { cors } from 'hono/cors';
import { Hono } from 'hono';
import { env, type AppEnv } from './env.js';
import { createSqliteDb, type SqliteDatabase } from '@invoice-processor/db';
import { HttpError } from './lib/http-error.js';
import {
  ensureUploadsDir,
  resolveUploadPath,
} from './lib/file-storage.js';
import {
  createOpenAiInvoiceExtractor,
  type InvoiceExtractor,
} from './lib/extractor.js';
import {
  prepareDocumentForExtraction,
  type DocumentPreparer,
} from './lib/document-preparer.js';
import { createCategoriesRouter } from './routes/categories.js';
import { createInvoicesRouter } from './routes/invoices.js';
import { createReportsRouter } from './routes/reports.js';

export type AppDependencies = {
  env: AppEnv;
  db: SqliteDatabase;
  extractor: InvoiceExtractor;
  prepareDocument: DocumentPreparer;
};

export async function createDependencies(
  runtimeEnv: AppEnv = env,
): Promise<AppDependencies> {
  if (!runtimeEnv.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required to start the API.');
  }

  await ensureUploadsDir(runtimeEnv.uploadsDir);

  return {
    env: runtimeEnv,
    db: createSqliteDb(runtimeEnv.databaseUrl),
    extractor: createOpenAiInvoiceExtractor({
      apiKey: runtimeEnv.OPENAI_API_KEY,
      model: runtimeEnv.OPENAI_MODEL,
    }),
    prepareDocument: prepareDocumentForExtraction,
  };
}

export function createApp(deps: AppDependencies) {
  const app = new Hono();

  app.use('*', cors());

  app.onError((error, c) => {
    if (error instanceof HttpError) {
      c.status(error.status as never);
      return c.json(error.payload);
    }

    console.error(error);

    return c.json({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Ocurrió un error inesperado procesando la solicitud.',
    }, 500);
  });

  app.get('/', (c) => c.json({ service: 'invoice-processor-api', ok: true }));

  app.get('/uploads/*', async (c) => {
    const absolutePath = resolveUploadPath(deps.env.uploadsDir, c.req.path);
    const buffer = await readFile(absolutePath);
    const mimeType = lookupMimeType(extname(absolutePath)) || 'application/octet-stream';

    c.header('Content-Type', mimeType);
    return c.body(buffer);
  });

  app.route('/categories', createCategoriesRouter(deps));
  app.route('/invoices', createInvoicesRouter(deps));
  app.route('/reports', createReportsRouter(deps));

  return app;
}
