import { Hono } from 'hono';
import { z } from 'zod';
import {
  invoiceFiltersSchema,
  updateInvoiceInputSchema,
  type ListInvoicesResponse,
  type ProcessInvoiceSuccess,
} from '@invoice-processor/types';
import { HttpError } from '../lib/http-error.js';
import { deleteStoredUpload, saveUpload, validateUpload } from '../lib/file-storage.js';
import {
  approveInvoiceRecord,
  createInvoiceRecord,
  getInvoiceDetail,
  listInvoices,
  updateInvoiceRecord,
} from '../lib/invoice-service.js';
import type { AppDependencies } from '../app.js';

const listInvoicesQuerySchema = invoiceFiltersSchema.extend({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(10),
});

export function createInvoicesRouter(deps: AppDependencies) {
  const router = new Hono();

  router.get('/', (c) => {
    const query = listInvoicesQuerySchema.parse(c.req.query());
    const response: ListInvoicesResponse = listInvoices(
      deps.db,
      query.page,
      query.pageSize,
      {
        categoryId: query.categoryId,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        producerName: query.producerName,
        consumerName: query.consumerName,
      },
    );

    return c.json(response);
  });

  router.post('/process', async (c) => {
    const formData = await c.req.formData();
    const uploaded = formData.get('file');

    if (!(uploaded instanceof File)) {
      throw new HttpError(400, {
        code: 'FILE_REQUIRED',
        message: 'Debes adjuntar un archivo para procesar.',
      });
    }

    const { extension, mimeType } = validateUpload(uploaded);
    const stored = await saveUpload({
      file: uploaded,
      uploadsDir: deps.env.uploadsDir,
      extension,
      mimeType,
    });

    try {
      const preparedDocument = await deps.prepareDocument({
        absolutePath: stored.absolutePath,
        mimeType,
        filename: stored.originalFilename,
      });

      const extraction = await deps.extractor(preparedDocument);

      if (!extraction.isInvoice || !extraction.invoice) {
        await deleteStoredUpload(stored.absolutePath);
        console.info('[invoice-rejected]', {
          filename: stored.originalFilename,
          reason: extraction.rejectionReason ?? 'Documento no identificado como factura',
        });

        return c.json({
          code: 'NOT_AN_INVOICE',
          message: 'El archivo subido no contiene una factura válida.',
          reason: extraction.rejectionReason,
        }, 422);
      }

      const invoice = createInvoiceRecord(deps.db, {
        sourceFilePath: stored.publicPath,
        sourceMimeType: stored.mimeType,
        originalFilename: stored.originalFilename,
        payload: extraction.invoice,
      });

      const response: ProcessInvoiceSuccess = {
        invoiceId: invoice.id,
        status: invoice.status,
        extractedData: extraction.invoice,
      };

      return c.json(response, 201);
    } catch (error) {
      await deleteStoredUpload(stored.absolutePath);
      throw error;
    }
  });

  router.get('/:invoiceId', (c) => {
    return c.json(getInvoiceDetail(deps.db, c.req.param('invoiceId')));
  });

  router.patch('/:invoiceId', async (c) => {
    const body = await c.req.json();
    const input = updateInvoiceInputSchema.parse(body);
    return c.json(updateInvoiceRecord(deps.db, c.req.param('invoiceId'), input));
  });

  router.post('/:invoiceId/approve', (c) => {
    return c.json(approveInvoiceRecord(deps.db, c.req.param('invoiceId')));
  });
  return router;
}
