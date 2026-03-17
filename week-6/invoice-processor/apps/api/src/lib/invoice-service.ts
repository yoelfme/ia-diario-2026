import { randomUUID } from 'node:crypto';
import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import {
  categories,
  invoiceItems,
  invoices,
  type SqliteDatabase,
} from '@invoice-processor/db';
import {
  type Category,
  type InvoiceDetail,
  type InvoiceFilters,
  type InvoiceSummary,
  type InvoicesByCategoryReportResponse,
  type ListCategoriesResponse,
  type ProcessedInvoicePayload,
  type UpdateInvoiceInput,
} from '@invoice-processor/types';
import { HttpError } from './http-error.js';
import { fromCents, toCents } from './money.js';

function mapSummary(row: {
  id: string;
  status: 'POR_REVISAR' | 'APROBADA';
  originalFilename: string;
  consumerName: string;
  producerName: string;
  categoryId: string | null;
  categoryName?: string | null;
  invoiceDate: string | null;
  totalCents: number;
  createdAt: string;
}): InvoiceSummary {
  return {
    id: row.id,
    status: row.status,
    originalFilename: row.originalFilename,
    consumerName: row.consumerName,
    producerName: row.producerName,
    categoryId: row.categoryId,
    categoryName: row.categoryName ?? null,
    invoiceDate: row.invoiceDate,
    total: fromCents(row.totalCents),
    createdAt: row.createdAt,
  };
}

function mapDetail(
  invoice: typeof invoices.$inferSelect,
  categoryName: string | null,
  items: Array<typeof invoiceItems.$inferSelect>,
): InvoiceDetail {
  return {
    ...mapSummary(invoice),
    consumerNit: invoice.consumerNit,
    producerNit: invoice.producerNit,
    categoryName,
    subtotal: fromCents(invoice.subtotalCents),
    taxes: fromCents(invoice.taxesCents),
    sourceFilePath: invoice.sourceFilePath,
    sourceMimeType: invoice.sourceMimeType,
    updatedAt: invoice.updatedAt,
    items: items
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((item) => ({
        id: item.id,
        quantity: item.quantity,
        description: item.description,
        price: fromCents(item.priceCents),
        sortOrder: item.sortOrder,
      })),
  };
}

function invoiceValues(
  data: UpdateInvoiceInput,
  source: {
    sourceFilePath: string;
    sourceMimeType: string;
    originalFilename: string;
  },
  categoryId: string | null,
) {
  return {
    sourceFilePath: source.sourceFilePath,
    sourceMimeType: source.sourceMimeType,
    originalFilename: source.originalFilename,
    consumerName: data.consumerName,
    consumerNit: data.consumerNit,
    producerName: data.producerName,
    producerNit: data.producerNit,
    categoryId,
    invoiceDate: data.invoiceDate,
    subtotalCents: toCents(data.subtotal),
    taxesCents: toCents(data.taxes),
    totalCents: toCents(data.total),
  };
}

function toCaseInsensitiveContains(
  column: typeof invoices.producerName | typeof invoices.consumerName,
  value: string,
) {
  const escaped = value.toLowerCase().replace(/[\\%_]/g, '\\$&');
  return sql`lower(${column}) like ${`%${escaped}%`} escape '\\'`;
}

function buildWhereClause(filters: InvoiceFilters, options?: { approvedOnly?: boolean }) {
  const conditions: SQL<unknown>[] = [];

  if (options?.approvedOnly) {
    conditions.push(eq(invoices.status, 'APROBADA'));
  }

  if (filters.categoryId) {
    conditions.push(eq(invoices.categoryId, filters.categoryId));
  }

  if (filters.dateFrom) {
    conditions.push(gte(invoices.invoiceDate, filters.dateFrom));
  }

  if (filters.dateTo) {
    conditions.push(lte(invoices.invoiceDate, filters.dateTo));
  }

  if (filters.producerName) {
    conditions.push(toCaseInsensitiveContains(invoices.producerName, filters.producerName));
  }

  if (filters.consumerName) {
    conditions.push(toCaseInsensitiveContains(invoices.consumerName, filters.consumerName));
  }

  if (conditions.length === 0) {
    return undefined;
  }

  return conditions.length === 1 ? conditions[0] : and(...conditions);
}

function getCategoryById(db: SqliteDatabase, categoryId: string): Category | null {
  return db.select({
    id: categories.id,
    slug: categories.slug,
    name: categories.name,
  }).from(categories).where(eq(categories.id, categoryId)).get() ?? null;
}

function getCategoryBySlug(db: SqliteDatabase, slug: ProcessedInvoicePayload['categorySlug']): Category | null {
  if (!slug) {
    return null;
  }

  return db.select({
    id: categories.id,
    slug: categories.slug,
    name: categories.name,
  }).from(categories).where(eq(categories.slug, slug)).get() ?? null;
}

export function listCategories(db: SqliteDatabase): ListCategoriesResponse {
  const items = db.select({
    id: categories.id,
    slug: categories.slug,
    name: categories.name,
  }).from(categories).orderBy(categories.name).all();

  return { items };
}

export function listInvoices(
  db: SqliteDatabase,
  page: number,
  pageSize: number,
  filters: InvoiceFilters,
) {
  const offset = (page - 1) * pageSize;
  const whereClause = buildWhereClause(filters);
  const rowsQuery = db
    .select({
      id: invoices.id,
      status: invoices.status,
      originalFilename: invoices.originalFilename,
      consumerName: invoices.consumerName,
      producerName: invoices.producerName,
      categoryId: invoices.categoryId,
      categoryName: categories.name,
      invoiceDate: invoices.invoiceDate,
      totalCents: invoices.totalCents,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .leftJoin(categories, eq(invoices.categoryId, categories.id))
    .orderBy(desc(invoices.createdAt))
    .limit(pageSize)
    .offset(offset);

  const items = (whereClause ? rowsQuery.where(whereClause) : rowsQuery)
    .all()
    .map(mapSummary);

  const countQuery = db
    .select({
      totalItems: sql<number>`count(*)`,
    })
    .from(invoices);

  const countRow = (whereClause ? countQuery.where(whereClause) : countQuery).get();

  return {
    items,
    page,
    pageSize,
    totalItems: countRow?.totalItems ?? 0,
  };
}

export function getInvoiceDetail(db: SqliteDatabase, invoiceId: string) {
  const result = db.select({
    invoice: invoices,
    categoryName: categories.name,
  }).from(invoices)
    .leftJoin(categories, eq(invoices.categoryId, categories.id))
    .where(eq(invoices.id, invoiceId))
    .get();

  if (!result) {
    throw new HttpError(404, {
      code: 'INVOICE_NOT_FOUND',
      message: 'La factura solicitada no existe.',
    });
  }

  const items = db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, result.invoice.id))
    .all();

  return mapDetail(result.invoice, result.categoryName, items);
}

export function createInvoiceRecord(
  db: SqliteDatabase,
  params: {
    sourceFilePath: string;
    sourceMimeType: string;
    originalFilename: string;
    payload: ProcessedInvoicePayload;
  },
) {
  const invoiceId = randomUUID();
  const now = new Date().toISOString();
  const extractedCategory = getCategoryBySlug(db, params.payload.categorySlug);

  const payloadForStorage: UpdateInvoiceInput = {
    consumerName: params.payload.consumerName,
    consumerNit: params.payload.consumerNit,
    producerName: params.payload.producerName,
    producerNit: params.payload.producerNit,
    categoryId: extractedCategory?.id ?? null,
    invoiceDate: params.payload.invoiceDate,
    items: params.payload.items,
    subtotal: params.payload.subtotal,
    taxes: params.payload.taxes,
    total: params.payload.total,
  };

  db.transaction((tx) => {
    tx.insert(invoices)
      .values({
        id: invoiceId,
        status: 'POR_REVISAR',
        createdAt: now,
        updatedAt: now,
        ...invoiceValues(payloadForStorage, {
          sourceFilePath: params.sourceFilePath,
          sourceMimeType: params.sourceMimeType,
          originalFilename: params.originalFilename,
        }, payloadForStorage.categoryId),
      })
      .run();

    tx.insert(invoiceItems)
      .values(params.payload.items.map((item, index) => ({
        id: randomUUID(),
        invoiceId,
        quantity: item.quantity,
        description: item.description,
        priceCents: toCents(item.price),
        sortOrder: index,
      })))
      .run();
  });

  return getInvoiceDetail(db, invoiceId);
}

export function updateInvoiceRecord(
  db: SqliteDatabase,
  invoiceId: string,
  input: UpdateInvoiceInput,
) {
  const current = db.select().from(invoices).where(eq(invoices.id, invoiceId)).get();

  if (!current) {
    throw new HttpError(404, {
      code: 'INVOICE_NOT_FOUND',
      message: 'La factura solicitada no existe.',
    });
  }

  if (current.status === 'APROBADA') {
    throw new HttpError(409, {
      code: 'INVOICE_ALREADY_APPROVED',
      message: 'Las facturas aprobadas ya no se pueden editar.',
    });
  }

  if (input.categoryId && !getCategoryById(db, input.categoryId)) {
    throw new HttpError(400, {
      code: 'CATEGORY_NOT_FOUND',
      message: 'La categoría seleccionada no existe.',
    });
  }

  db.transaction((tx) => {
    tx.update(invoices)
      .set({
        ...invoiceValues(input, {
          sourceFilePath: current.sourceFilePath,
          sourceMimeType: current.sourceMimeType,
          originalFilename: current.originalFilename,
        }, input.categoryId),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(invoices.id, invoiceId))
      .run();

    tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId)).run();

    tx.insert(invoiceItems)
      .values(input.items.map((item, index) => ({
        id: randomUUID(),
        invoiceId,
        quantity: item.quantity,
        description: item.description,
        priceCents: toCents(item.price),
        sortOrder: index,
      })))
      .run();
  });

  return getInvoiceDetail(db, invoiceId);
}

export function approveInvoiceRecord(db: SqliteDatabase, invoiceId: string) {
  const current = db.select().from(invoices).where(eq(invoices.id, invoiceId)).get();

  if (!current) {
    throw new HttpError(404, {
      code: 'INVOICE_NOT_FOUND',
      message: 'La factura solicitada no existe.',
    });
  }

  if (current.status === 'APROBADA') {
    return getInvoiceDetail(db, invoiceId);
  }

  const missingFields: string[] = [];

  if (!current.categoryId) {
    missingFields.push('categoría');
  }

  if (!current.invoiceDate) {
    missingFields.push('fecha');
  }

  if (missingFields.length > 0) {
    throw new HttpError(409, {
      code: 'INVOICE_APPROVAL_REQUIREMENTS_NOT_MET',
      message: 'Debes completar la categoría y la fecha antes de aprobar la factura.',
      reason: `Faltan: ${missingFields.join(' y ')}.`,
    });
  }

  db.update(invoices)
    .set({
      status: 'APROBADA',
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.status, 'POR_REVISAR')))
    .run();

  return getInvoiceDetail(db, invoiceId);
}

export function getInvoicesByCategoryReport(
  db: SqliteDatabase,
  filters: InvoiceFilters,
): InvoicesByCategoryReportResponse {
  const whereClause = buildWhereClause(filters, { approvedOnly: true });
  const totalCentsSql = sql<number>`coalesce(sum(${invoices.totalCents}), 0)`;
  const reportQuery = db.select({
    categoryId: categories.id,
    categoryName: categories.name,
    invoiceCount: sql<number>`count(*)`,
    totalCents: totalCentsSql,
  }).from(invoices)
    .innerJoin(categories, eq(invoices.categoryId, categories.id))
    .groupBy(categories.id, categories.name)
    .orderBy(desc(totalCentsSql));

  const rows = (whereClause ? reportQuery.where(whereClause) : reportQuery).all();
  const items = rows.map((row) => ({
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    invoiceCount: row.invoiceCount,
    totalAmount: fromCents(row.totalCents),
  }));

  return {
    items,
    totalInvoices: items.reduce((total, item) => total + item.invoiceCount, 0),
    totalAmount: items.reduce((total, item) => total + item.totalAmount, 0),
  };
}
