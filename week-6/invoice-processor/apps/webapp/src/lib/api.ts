import {
  apiErrorSchema,
  invoicesByCategoryReportResponseSchema,
  invoiceFiltersSchema,
  listCategoriesResponseSchema,
  invoiceDetailSchema,
  listInvoicesResponseSchema,
  processInvoiceSuccessSchema,
  type ApiError,
  type InvoiceFilters,
  type InvoiceDetail,
  type InvoicesByCategoryReportResponse,
  type ListCategoriesResponse,
  type ListInvoicesResponse,
  type ProcessInvoiceSuccess,
  type UpdateInvoiceInput,
} from '@invoice-processor/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiClientError extends Error {
  readonly status: number;
  readonly payload: ApiError;

  constructor(status: number, payload: ApiError) {
    super(payload.message);
    this.status = status;
    this.payload = payload;
  }
}

async function parseResponse<T>(
  response: Response,
  parser: { parse: (value: unknown) => T },
): Promise<T> {
  const json = await response.json();

  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      apiErrorSchema.parse({
        code: json.code ?? 'UNKNOWN_ERROR',
        message: json.message ?? 'Ocurrió un error inesperado.',
        reason: json.reason,
      }),
    );
  }

  return parser.parse(json);
}

function buildQueryString(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') {
      continue;
    }

    searchParams.set(key, String(value));
  }

  return searchParams.toString();
}

export async function fetchInvoices(params?: {
  page?: number;
  pageSize?: number;
  filters?: InvoiceFilters;
}): Promise<ListInvoicesResponse> {
  const parsedFilters = invoiceFiltersSchema.parse(params?.filters ?? {});
  const query = buildQueryString({
    page: params?.page ?? 1,
    pageSize: params?.pageSize ?? 12,
    categoryId: parsedFilters.categoryId,
    dateFrom: parsedFilters.dateFrom,
    dateTo: parsedFilters.dateTo,
    producerName: parsedFilters.producerName,
    consumerName: parsedFilters.consumerName,
  });
  const response = await fetch(`${API_URL}/invoices?${query}`, {
    cache: 'no-store',
  });
  return parseResponse(response, listInvoicesResponseSchema);
}

export async function fetchCategories(): Promise<ListCategoriesResponse> {
  const response = await fetch(`${API_URL}/categories`, {
    cache: 'no-store',
  });
  return parseResponse(response, listCategoriesResponseSchema);
}

export async function fetchInvoicesByCategoryReport(
  filters?: InvoiceFilters,
): Promise<InvoicesByCategoryReportResponse> {
  const parsedFilters = invoiceFiltersSchema.parse(filters ?? {});
  const query = buildQueryString({
    categoryId: parsedFilters.categoryId,
    dateFrom: parsedFilters.dateFrom,
    dateTo: parsedFilters.dateTo,
    producerName: parsedFilters.producerName,
    consumerName: parsedFilters.consumerName,
  });
  const response = await fetch(`${API_URL}/reports/invoices-by-category?${query}`, {
    cache: 'no-store',
  });
  return parseResponse(response, invoicesByCategoryReportResponseSchema);
}

export async function fetchInvoice(invoiceId: string): Promise<InvoiceDetail> {
  const response = await fetch(`${API_URL}/invoices/${invoiceId}`, {
    cache: 'no-store',
  });
  return parseResponse(response, invoiceDetailSchema);
}

export async function processInvoice(file: File): Promise<ProcessInvoiceSuccess> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/invoices/process`, {
    method: 'POST',
    body: formData,
  });

  return parseResponse(response, processInvoiceSuccessSchema);
}

export async function updateInvoice(invoiceId: string, payload: UpdateInvoiceInput) {
  const response = await fetch(`${API_URL}/invoices/${invoiceId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(response, invoiceDetailSchema);
}

export async function approveInvoice(invoiceId: string) {
  const response = await fetch(`${API_URL}/invoices/${invoiceId}/approve`, {
    method: 'POST',
  });

  return parseResponse(response, invoiceDetailSchema);
}

export function getAssetUrl(relativePath: string) {
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }

  return `${API_URL}${relativePath}`;
}
