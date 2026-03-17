import { Hono } from 'hono';
import { invoiceFiltersSchema, type InvoicesByCategoryReportResponse } from '@invoice-processor/types';
import { getInvoicesByCategoryReport } from '../lib/invoice-service.js';
import type { AppDependencies } from '../app.js';

export function createReportsRouter(deps: AppDependencies) {
  const router = new Hono();

  router.get('/invoices-by-category', (c) => {
    const filters = invoiceFiltersSchema.parse(c.req.query());
    const response: InvoicesByCategoryReportResponse = getInvoicesByCategoryReport(deps.db, filters);
    return c.json(response);
  });

  return router;
}
