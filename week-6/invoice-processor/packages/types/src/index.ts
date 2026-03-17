import { z } from 'zod';

export const invoiceStatusSchema = z.enum(['POR_REVISAR', 'APROBADA']);
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

export const standardCategorySlugSchema = z.enum([
  'alimentacion',
  'transporte',
  'hospedaje',
  'suministros',
  'servicios',
  'impuestos',
  'otros',
]);
export type StandardCategorySlug = z.infer<typeof standardCategorySlugSchema>;

export const invoiceDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: 'La fecha debe usar el formato YYYY-MM-DD.',
}).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, {
  message: 'La fecha debe ser válida.',
});

export const processedInvoiceItemSchema = z.object({
  quantity: z.number().int().positive(),
  description: z.string().trim().min(1),
  price: z.number().finite().nonnegative(),
});

export const extractedInvoicePayloadSchema = z.object({
  consumerName: z.string().trim().min(1),
  consumerNit: z.string().trim().min(1).nullable(),
  producerName: z.string().trim().min(1),
  producerNit: z.string().trim().min(1).nullable(),
  categorySlug: z.union([standardCategorySlugSchema, z.null()]),
  invoiceDate: z.preprocess((value) => {
    if (value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }, z.union([invoiceDateSchema, z.null()])),
  items: z.array(processedInvoiceItemSchema).min(1),
  subtotal: z.number().finite().nonnegative(),
  taxes: z.number().finite().nonnegative(),
  total: z.number().finite().nonnegative(),
});

export type ProcessedInvoicePayload = z.infer<typeof extractedInvoicePayloadSchema>;
export type ProcessedInvoiceItem = z.infer<typeof processedInvoiceItemSchema>;

const optionalNonEmptyStringSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, z.string().trim().min(1).optional());

const nullableNonEmptyStringSchema = z.preprocess((value) => {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}, z.union([z.string().trim().min(1), z.null()]));

const optionalInvoiceDateSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, invoiceDateSchema.optional());

export const invoiceExtractionResultSchema = z.object({
  isInvoice: z.boolean(),
  rejectionReason: optionalNonEmptyStringSchema,
  invoice: extractedInvoicePayloadSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.isInvoice && !value.invoice) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['invoice'],
      message: 'invoice is required when isInvoice is true',
    });
  }

  if (!value.isInvoice && !value.rejectionReason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rejectionReason'],
      message: 'rejectionReason is required when isInvoice is false',
    });
  }
});

export type InvoiceExtractionResult = z.infer<typeof invoiceExtractionResultSchema>;

export const invoiceItemSchema = z.object({
  id: z.string().uuid(),
  invoiceId: z.string().uuid(),
  quantity: z.number().int().positive(),
  description: z.string().trim().min(1),
  price: z.number().finite().nonnegative(),
  sortOrder: z.number().int().nonnegative(),
});

export const invoiceSummarySchema = z.object({
  id: z.string().uuid(),
  status: invoiceStatusSchema,
  originalFilename: z.string(),
  consumerName: z.string(),
  producerName: z.string(),
  categoryId: z.string().nullable(),
  categoryName: z.string().nullable(),
  invoiceDate: z.union([invoiceDateSchema, z.null()]),
  total: z.number().finite().nonnegative(),
  createdAt: z.string(),
});

export const invoiceDetailSchema = invoiceSummarySchema.extend({
  consumerNit: z.string().nullable(),
  producerNit: z.string().nullable(),
  subtotal: z.number().finite().nonnegative(),
  taxes: z.number().finite().nonnegative(),
  sourceFilePath: z.string(),
  sourceMimeType: z.string(),
  updatedAt: z.string(),
  items: z.array(invoiceItemSchema.omit({ invoiceId: true })),
});

export type InvoiceSummary = z.infer<typeof invoiceSummarySchema>;
export type InvoiceDetail = z.infer<typeof invoiceDetailSchema>;

export const categorySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
});

export type Category = z.infer<typeof categorySchema>;

export const listInvoicesResponseSchema = z.object({
  items: z.array(invoiceSummarySchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
});

export type ListInvoicesResponse = z.infer<typeof listInvoicesResponseSchema>;

export const listCategoriesResponseSchema = z.object({
  items: z.array(categorySchema),
});

export type ListCategoriesResponse = z.infer<typeof listCategoriesResponseSchema>;

export const invoiceFiltersSchema = z.object({
  categoryId: optionalNonEmptyStringSchema,
  dateFrom: optionalInvoiceDateSchema,
  dateTo: optionalInvoiceDateSchema,
  producerName: optionalNonEmptyStringSchema,
  consumerName: optionalNonEmptyStringSchema,
}).superRefine((value, ctx) => {
  if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dateTo'],
      message: 'La fecha final no puede ser anterior a la fecha inicial.',
    });
  }
});

export type InvoiceFilters = z.infer<typeof invoiceFiltersSchema>;

export const invoicesByCategoryReportItemSchema = z.object({
  categoryId: z.string().min(1),
  categoryName: z.string().min(1),
  invoiceCount: z.number().int().nonnegative(),
  totalAmount: z.number().finite().nonnegative(),
});

export const invoicesByCategoryReportResponseSchema = z.object({
  items: z.array(invoicesByCategoryReportItemSchema),
  totalInvoices: z.number().int().nonnegative(),
  totalAmount: z.number().finite().nonnegative(),
});

export type InvoicesByCategoryReportItem = z.infer<typeof invoicesByCategoryReportItemSchema>;
export type InvoicesByCategoryReportResponse = z.infer<typeof invoicesByCategoryReportResponseSchema>;

export const processInvoiceSuccessSchema = z.object({
  invoiceId: z.string().uuid(),
  status: invoiceStatusSchema,
  extractedData: extractedInvoicePayloadSchema,
});

export type ProcessInvoiceSuccess = z.infer<typeof processInvoiceSuccessSchema>;

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  reason: z.string().optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const updateInvoiceInputSchema = z.object({
  consumerName: z.string().trim().min(1),
  consumerNit: z.string().trim().min(1).nullable(),
  producerName: z.string().trim().min(1),
  producerNit: z.string().trim().min(1).nullable(),
  categoryId: nullableNonEmptyStringSchema,
  invoiceDate: z.preprocess((value) => {
    if (value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }, z.union([invoiceDateSchema, z.null()])),
  items: z.array(processedInvoiceItemSchema).min(1),
  subtotal: z.number().finite().nonnegative(),
  taxes: z.number().finite().nonnegative(),
  total: z.number().finite().nonnegative(),
});

export type UpdateInvoiceInput = z.infer<typeof updateInvoiceInputSchema>;
