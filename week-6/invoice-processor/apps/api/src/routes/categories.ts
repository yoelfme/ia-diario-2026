import { Hono } from 'hono';
import type { ListCategoriesResponse } from '@invoice-processor/types';
import { listCategories } from '../lib/invoice-service.js';
import type { AppDependencies } from '../app.js';

export function createCategoriesRouter(deps: AppDependencies) {
  const router = new Hono();

  router.get('/', (c) => {
    const response: ListCategoriesResponse = listCategories(deps.db);
    return c.json(response);
  });

  return router;
}
