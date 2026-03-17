import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSqliteDb } from '@invoice-processor/db';
import {
  invoiceExtractionResultSchema,
  type InvoiceExtractionResult,
  type ListCategoriesResponse,
  type ProcessedInvoicePayload,
  type UpdateInvoiceInput,
} from '@invoice-processor/types';
import { createApp, type AppDependencies } from './app.js';
import { runMigrations } from './db/migration-runner.js';

type TestContext = {
  tempDir: string;
  uploadsDir: string;
  databaseUrl: string;
  deps: AppDependencies;
};

const sampleInvoicePayload: ProcessedInvoicePayload = {
  consumerName: 'Cliente Demo',
  consumerNit: '1234567',
  producerName: 'Proveedor Demo',
  producerNit: '7654321',
  categorySlug: 'transporte',
  invoiceDate: '2026-03-01',
  items: [
    {
      quantity: 2,
      description: 'Servicio de taxi al aeropuerto',
      price: 25,
    },
  ],
  subtotal: 50,
  taxes: 6,
  total: 56,
};

function toUpdateInput(overrides?: Partial<UpdateInvoiceInput>): UpdateInvoiceInput {
  return {
    consumerName: sampleInvoicePayload.consumerName,
    consumerNit: sampleInvoicePayload.consumerNit,
    producerName: sampleInvoicePayload.producerName,
    producerNit: sampleInvoicePayload.producerNit,
    categoryId: 'cat_transporte',
    invoiceDate: sampleInvoicePayload.invoiceDate,
    items: sampleInvoicePayload.items,
    subtotal: sampleInvoicePayload.subtotal,
    taxes: sampleInvoicePayload.taxes,
    total: sampleInvoicePayload.total,
    ...overrides,
  };
}

const sampleInvoice: InvoiceExtractionResult = {
  isInvoice: true,
  invoice: sampleInvoicePayload,
};

let context: TestContext;

async function listFilesRecursively(baseDir: string): Promise<string[]> {
  const entries = await readdir(baseDir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(baseDir, entry.name);

    if (entry.isDirectory()) {
      return listFilesRecursively(fullPath);
    }

    return [fullPath];
  }));

  return nested.flat();
}

async function createTestContext(overrides?: Partial<AppDependencies>): Promise<TestContext> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'invoice-processor-api-'));
  const uploadsDir = path.join(tempDir, 'uploads');
  const databaseUrl = path.join(tempDir, 'data', 'test.db');
  const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');

  await runMigrations({ databaseUrl, repoRoot });

  const deps: AppDependencies = {
    env: {
      OPENAI_API_KEY: 'test-key',
      DATABASE_URL: './data/test.db',
      UPLOADS_DIR: './uploads',
      API_PORT: 3001,
      OPENAI_MODEL: 'gpt-4.1-mini',
      DB_DRIVER: 'sqlite',
      NEXT_PUBLIC_API_URL: 'http://localhost:3001',
      appDir: path.resolve(import.meta.dirname, '..'),
      repoRoot,
      databaseUrl,
      uploadsDir,
    },
    db: createSqliteDb(databaseUrl),
    extractor: vi.fn(async () => sampleInvoice),
    prepareDocument: vi.fn(async ({ filename, mimeType }) => ({
      buffer: Buffer.from('prepared'),
      mimeType,
      filename,
    })),
    ...overrides,
  };

  return {
    tempDir,
    uploadsDir,
    databaseUrl,
    deps,
  };
}

async function processInvoiceThroughApi(app: ReturnType<typeof createApp>, filename = 'invoice.png') {
  const formData = new FormData();
  formData.append('file', new File([Buffer.from('png')], filename, { type: filename.endsWith('.pdf') ? 'application/pdf' : 'image/png' }));

  const response = await app.request('/invoices/process', {
    method: 'POST',
    body: formData,
  });

  const body = await response.json() as { invoiceId: string };
  return { response, body };
}

async function listCategories(app: ReturnType<typeof createApp>) {
  const response = await app.request('/categories');
  expect(response.status).toBe(200);
  return await response.json() as ListCategoriesResponse;
}

async function updateInvoiceThroughApi(
  app: ReturnType<typeof createApp>,
  invoiceId: string,
  payload: UpdateInvoiceInput,
) {
  return app.request(`/invoices/${invoiceId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

beforeEach(async () => {
  context = await createTestContext();
});

afterEach(async () => {
  await rm(context.tempDir, { recursive: true, force: true });
});

describe('invoice API', () => {
  it('accepts empty rejectionReason when the model marks the document as an invoice', () => {
    const parsed = invoiceExtractionResultSchema.parse({
      ...sampleInvoice,
      rejectionReason: '',
    });

    expect(parsed.isInvoice).toBe(true);
    expect(parsed.rejectionReason).toBeUndefined();
    expect(parsed.invoice?.producerName).toBe('Proveedor Demo');
  });

  it('returns the seeded standard categories', async () => {
    const app = createApp(context.deps);

    const response = await app.request('/categories');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [
        { id: 'cat_alimentacion', slug: 'alimentacion', name: 'Alimentación' },
        { id: 'cat_hospedaje', slug: 'hospedaje', name: 'Hospedaje' },
        { id: 'cat_impuestos', slug: 'impuestos', name: 'Impuestos' },
        { id: 'cat_otros', slug: 'otros', name: 'Otros' },
        { id: 'cat_servicios', slug: 'servicios', name: 'Servicios' },
        { id: 'cat_suministros', slug: 'suministros', name: 'Suministros' },
        { id: 'cat_transporte', slug: 'transporte', name: 'Transporte' },
      ],
    });
  });

  it('rejects unsupported file types', async () => {
    const app = createApp(context.deps);
    const formData = new FormData();
    formData.append('file', new File([Buffer.from('hello')], 'notes.txt', { type: 'text/plain' }));

    const response = await app.request('/invoices/process', {
      method: 'POST',
      body: formData,
    });

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({
      code: 'UNSUPPORTED_FILE_TYPE',
    });
  });

  it('returns 422 and removes the file when the document is not an invoice', async () => {
    const deps = {
      ...context.deps,
      extractor: vi.fn(async () => ({
        isInvoice: false,
        rejectionReason: 'No se detectó una factura',
      })),
    } satisfies AppDependencies;
    const app = createApp(deps);
    const formData = new FormData();
    formData.append('file', new File([Buffer.from('png')], 'invoice.png', { type: 'image/png' }));

    const response = await app.request('/invoices/process', {
      method: 'POST',
      body: formData,
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      code: 'NOT_AN_INVOICE',
    });
    expect((await listFilesRecursively(context.uploadsDir)).length).toBe(0);
  });

  it('blocks approval until category and invoice date are completed', async () => {
    const app = createApp(context.deps);
    const { response: processResponse, body: processed } = await processInvoiceThroughApi(app);

    expect(processResponse.status).toBe(201);

    const categories = await listCategories(app);
    const transportCategory = categories.items.find((item) => item.slug === 'transporte');
    expect(transportCategory).toBeDefined();

    const clearRequiredFieldsResponse = await updateInvoiceThroughApi(app, processed.invoiceId, {
      ...toUpdateInput(),
      categoryId: null,
      invoiceDate: null,
    });

    expect(clearRequiredFieldsResponse.status).toBe(200);

    const approveResponse = await app.request(`/invoices/${processed.invoiceId}/approve`, {
      method: 'POST',
    });

    expect(approveResponse.status).toBe(409);
    await expect(approveResponse.json()).resolves.toMatchObject({
      code: 'INVOICE_APPROVAL_REQUIREMENTS_NOT_MET',
      reason: 'Faltan: categoría y fecha.',
    });

    const completedResponse = await updateInvoiceThroughApi(app, processed.invoiceId, {
      ...toUpdateInput(),
      categoryId: transportCategory?.id ?? null,
      invoiceDate: '2026-03-02',
    });

    expect(completedResponse.status).toBe(200);

    const approvedResponse = await app.request(`/invoices/${processed.invoiceId}/approve`, {
      method: 'POST',
    });

    expect(approvedResponse.status).toBe(200);
    await expect(approvedResponse.json()).resolves.toMatchObject({
      status: 'APROBADA',
      categoryId: transportCategory?.id,
      invoiceDate: '2026-03-02',
    });
  });

  it('processes, updates and approves an invoice, then blocks further edits', async () => {
    const app = createApp(context.deps);
    const { response: processResponse, body: processed } = await processInvoiceThroughApi(app);
    const categories = await listCategories(app);
    const servicesCategory = categories.items.find((item) => item.slug === 'servicios');

    expect(processResponse.status).toBe(201);

    const patchResponse = await updateInvoiceThroughApi(app, processed.invoiceId, {
      ...toUpdateInput(),
      consumerName: 'Cliente Editado',
      categoryId: servicesCategory?.id ?? null,
    });

    expect(patchResponse.status).toBe(200);
    await expect(patchResponse.json()).resolves.toMatchObject({
      consumerName: 'Cliente Editado',
      categoryId: servicesCategory?.id,
      categoryName: 'Servicios',
    });

    const approveResponse = await app.request(`/invoices/${processed.invoiceId}/approve`, {
      method: 'POST',
    });

    expect(approveResponse.status).toBe(200);
    await expect(approveResponse.json()).resolves.toMatchObject({
      status: 'APROBADA',
    });

    const blockedPatchResponse = await updateInvoiceThroughApi(app, processed.invoiceId, {
      ...toUpdateInput(),
      categoryId: servicesCategory?.id ?? null,
    });

    expect(blockedPatchResponse.status).toBe(409);
    await expect(blockedPatchResponse.json()).resolves.toMatchObject({
      code: 'INVOICE_ALREADY_APPROVED',
    });
  });

  it('lists invoices with filters and generates an approved-only category report', async () => {
    const app = createApp(context.deps);
    const categories = await listCategories(app);
    const transportCategory = categories.items.find((item) => item.slug === 'transporte');
    const servicesCategory = categories.items.find((item) => item.slug === 'servicios');

    expect(transportCategory).toBeDefined();
    expect(servicesCategory).toBeDefined();

    const firstInvoice = await processInvoiceThroughApi(app);
    await updateInvoiceThroughApi(app, firstInvoice.body.invoiceId, {
      ...toUpdateInput(),
      producerName: 'Proveedor Uno',
      consumerName: 'Cliente Norte',
      invoiceDate: '2026-03-02',
      categoryId: transportCategory?.id ?? null,
    });
    await app.request(`/invoices/${firstInvoice.body.invoiceId}/approve`, { method: 'POST' });

    const secondInvoice = await processInvoiceThroughApi(app);
    await updateInvoiceThroughApi(app, secondInvoice.body.invoiceId, {
      ...toUpdateInput(),
      producerName: 'Proveedor Dos',
      consumerName: 'Cliente Sur',
      invoiceDate: '2026-03-05',
      subtotal: 100,
      taxes: 12,
      total: 112,
      categoryId: servicesCategory?.id ?? null,
    });
    await app.request(`/invoices/${secondInvoice.body.invoiceId}/approve`, { method: 'POST' });

    const pendingInvoice = await processInvoiceThroughApi(app);
    await updateInvoiceThroughApi(app, pendingInvoice.body.invoiceId, {
      ...toUpdateInput(),
      producerName: 'Proveedor Uno Pendiente',
      consumerName: 'Cliente Norte',
      invoiceDate: '2026-03-03',
      categoryId: transportCategory?.id ?? null,
    });

    const filteredInvoicesResponse = await app.request(
      `/invoices?categoryId=${transportCategory?.id}&dateFrom=2026-03-01&dateTo=2026-03-04&producerName=proveedor%20uno&consumerName=cliente%20norte`,
    );

    expect(filteredInvoicesResponse.status).toBe(200);
    const filteredInvoicesBody = await filteredInvoicesResponse.json();
    expect(filteredInvoicesBody).toMatchObject({
      totalItems: 2,
    });
    expect(filteredInvoicesBody).toEqual(expect.objectContaining({
      items: expect.arrayContaining([
        expect.objectContaining({
          categoryId: transportCategory?.id,
          categoryName: 'Transporte',
          consumerName: 'Cliente Norte',
        }),
      ]),
    }));

    const reportResponse = await app.request(
      `/reports/invoices-by-category?categoryId=${transportCategory?.id}&dateFrom=2026-03-01&dateTo=2026-03-04&producerName=proveedor%20uno&consumerName=cliente%20norte`,
    );

    expect(reportResponse.status).toBe(200);
    await expect(reportResponse.json()).resolves.toMatchObject({
      items: [
        {
          categoryId: transportCategory?.id,
          categoryName: 'Transporte',
          invoiceCount: 1,
          totalAmount: 56,
        },
      ],
      totalInvoices: 1,
      totalAmount: 56,
    });
  });

  it('processes PDF uploads through the PDF v1 path and hands an image to the extractor', async () => {
    const extractor = vi.fn(async () => sampleInvoice);
    const prepareDocument = vi.fn(async () => ({
      buffer: Buffer.from('converted-image'),
      mimeType: 'image/png',
      filename: 'invoice.png',
    }));
    const deps = {
      ...context.deps,
      extractor,
      prepareDocument,
    } satisfies AppDependencies;
    const app = createApp(deps);
    const { response } = await processInvoiceThroughApi(app, 'invoice.pdf');

    expect(response.status).toBe(201);
    expect(prepareDocument).toHaveBeenCalledWith(expect.objectContaining({
      mimeType: 'application/pdf',
      filename: 'invoice.pdf',
    }));
    expect(extractor).toHaveBeenCalledWith(expect.objectContaining({
      mimeType: 'image/png',
      filename: 'invoice.png',
    }));
  });

  it('assigns the extracted category automatically when creating the invoice', async () => {
    const app = createApp(context.deps);

    const { response, body } = await processInvoiceThroughApi(app);
    expect(response.status).toBe(201);

    const detailResponse = await app.request(`/invoices/${body.invoiceId}`);
    expect(detailResponse.status).toBe(200);
    await expect(detailResponse.json()).resolves.toMatchObject({
      categoryId: 'cat_transporte',
      categoryName: 'Transporte',
      items: [
        {
          quantity: 2,
        },
      ],
    });
  });
});
