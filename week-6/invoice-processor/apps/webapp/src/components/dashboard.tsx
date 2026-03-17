'use client';

import type { Route } from 'next';
import type { InvoiceFilters } from '@invoice-processor/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDeferredValue, useEffect, useState, useTransition } from 'react';
import {
  ApiClientError,
  fetchCategories,
  fetchInvoices,
  fetchInvoicesByCategoryReport,
  processInvoice,
} from '../lib/api';

const moneyFormatter = new Intl.NumberFormat('es-GT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type DashboardFilters = {
  categoryId: string;
  dateFrom: string;
  dateTo: string;
  producerName: string;
  consumerName: string;
};

const emptyFilters: DashboardFilters = {
  categoryId: '',
  dateFrom: '',
  dateTo: '',
  producerName: '',
  consumerName: '',
};

function formatMoney(value: number) {
  return `Q ${moneyFormatter.format(value)}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-GT', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatInvoiceDate(value: string | null) {
  if (!value) {
    return 'Fecha pendiente';
  }

  return new Intl.DateTimeFormat('es-GT', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function readFilters(searchParams: { get: (name: string) => string | null }): DashboardFilters {
  return {
    categoryId: searchParams.get('categoryId') ?? '',
    dateFrom: searchParams.get('dateFrom') ?? '',
    dateTo: searchParams.get('dateTo') ?? '',
    producerName: searchParams.get('producerName') ?? '',
    consumerName: searchParams.get('consumerName') ?? '',
  };
}

function sameFilters(left: DashboardFilters, right: DashboardFilters) {
  return left.categoryId === right.categoryId
    && left.dateFrom === right.dateFrom
    && left.dateTo === right.dateTo
    && left.producerName === right.producerName
    && left.consumerName === right.consumerName;
}

function buildDashboardUrl(filters: DashboardFilters) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (!value) {
      continue;
    }

    searchParams.set(key, value);
  }

  const query = searchParams.toString();
  return query ? `/?${query}` : '/';
}

function toApiFilters(filters: DashboardFilters): InvoiceFilters {
  return {
    categoryId: filters.categoryId || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    producerName: filters.producerName || undefined,
    consumerName: filters.consumerName || undefined,
  };
}

export function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>(() => readFilters(searchParams));
  const [isNavigating, startTransition] = useTransition();
  const deferredProducerName = useDeferredValue(filters.producerName);
  const deferredConsumerName = useDeferredValue(filters.consumerName);

  useEffect(() => {
    const nextFilters = readFilters(searchParams);
    setFilters((current) => sameFilters(current, nextFilters) ? current : nextFilters);
  }, [searchParams]);

  const apiFilters = toApiFilters({
    ...filters,
    producerName: deferredProducerName,
    consumerName: deferredConsumerName,
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const invoicesQuery = useQuery({
    queryKey: ['invoices', apiFilters],
    queryFn: () => fetchInvoices({
      page: 1,
      pageSize: 12,
      filters: apiFilters,
    }),
  });

  const reportQuery = useQuery({
    queryKey: ['invoiceReports', apiFilters],
    queryFn: () => fetchInvoicesByCategoryReport(apiFilters),
  });

  const uploadMutation = useMutation({
    mutationFn: processInvoice,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      await queryClient.invalidateQueries({ queryKey: ['invoiceReports'] });
      router.push(`/invoices/${result.invoiceId}`);
    },
  });

  const uploadError = uploadMutation.error instanceof ApiClientError
    ? uploadMutation.error.payload
    : null;

  function applyFilters(nextFilters: DashboardFilters) {
    setFilters(nextFilters);
    startTransition(() => {
      router.replace(buildDashboardUrl(nextFilters) as Route, { scroll: false });
    });
  }

  function updateFilter(field: keyof DashboardFilters, value: string) {
    const nextFilters = {
      ...filters,
      [field]: value,
    };

    if (field === 'dateFrom' && value && nextFilters.dateTo && value > nextFilters.dateTo) {
      nextFilters.dateTo = value;
    }

    if (field === 'dateTo' && value && nextFilters.dateFrom && value < nextFilters.dateFrom) {
      nextFilters.dateFrom = value;
    }

    applyFilters(nextFilters);
  }

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <main className="min-h-screen px-5 py-8 md:px-8 md:py-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] shadow-[0_24px_80px_rgba(56,32,11,0.14)] backdrop-blur">
          <div className="grid gap-8 p-6 md:grid-cols-[1.4fr_1fr] md:p-10">
            <div className="space-y-4">
              <p className="inline-flex rounded-full border border-[var(--border)] bg-white/60 px-4 py-1 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Flujo de digitalización
              </p>
              <h1 className="max-w-2xl text-4xl font-semibold leading-tight md:text-6xl">
                Facturas físicas o PDFs, normalizadas y listas para clasificar.
              </h1>
            </div>

            <div className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--muted)]">Nueva carga</p>
                  <h2 className="mt-2 text-2xl font-semibold">Procesar documento</h2>
                </div>

                <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-[1.5rem] border border-dashed border-[var(--border)] bg-[var(--accent-soft)] px-5 text-center transition hover:border-[var(--accent)] hover:bg-white/80">
                  <input
                    accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
                    className="hidden"
                    type="file"
                    onChange={(event) => {
                      setSelectedFile(event.target.files?.[0] ?? null);
                    }}
                  />
                  <span className="text-lg font-semibold">{selectedFile ? selectedFile.name : 'Selecciona un PNG, JPG o PDF'}</span>
                  <span className="text-sm text-[var(--muted)]">Cualquier otro tipo será rechazado por el backend.</span>
                </label>

                {uploadError ? (
                  <div className="rounded-2xl border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-900">
                    <p className="font-semibold">{uploadError.message}</p>
                    {uploadError.reason ? <p className="mt-1">{uploadError.reason}</p> : null}
                  </div>
                ) : null}

                <button
                  className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!selectedFile || uploadMutation.isPending}
                  onClick={() => {
                    if (selectedFile) {
                      uploadMutation.mutate(selectedFile);
                    }
                  }}
                  type="button"
                >
                  {uploadMutation.isPending ? 'Procesando…' : 'Subir y procesar factura'}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[0_18px_50px_rgba(56,32,11,0.08)] backdrop-blur md:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Filtros y reporte</p>
                <h2 className="mt-2 text-2xl font-semibold">Clasificación de facturas</h2>
              </div>
              <button
                className="rounded-full border border-[var(--border)] bg-white/70 px-4 py-2 text-sm font-semibold transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!hasActiveFilters || isNavigating}
                onClick={() => applyFilters(emptyFilters)}
                type="button"
              >
                Limpiar filtros
              </button>
            </div>

            {categoriesQuery.isError ? (
              <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
                No se pudo cargar el catálogo de categorías.
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <label className="space-y-2">
                <span className="text-sm font-semibold">Categoría</span>
                <select
                  className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                  onChange={(event) => updateFilter('categoryId', event.target.value)}
                  value={filters.categoryId}
                >
                  <option value="">Todas</option>
                  {categoriesQuery.data?.items.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Fecha desde</span>
                <input
                  className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                  onChange={(event) => updateFilter('dateFrom', event.target.value)}
                  type="date"
                  value={filters.dateFrom}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Fecha hasta</span>
                <input
                  className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                  onChange={(event) => updateFilter('dateTo', event.target.value)}
                  type="date"
                  value={filters.dateTo}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Productor</span>
                <input
                  className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                  onChange={(event) => updateFilter('producerName', event.target.value)}
                  placeholder="Nombre del productor"
                  value={filters.producerName}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Consumidor</span>
                <input
                  className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                  onChange={(event) => updateFilter('consumerName', event.target.value)}
                  placeholder="Nombre del consumidor"
                  value={filters.consumerName}
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-[1.5rem] border border-[var(--border)] bg-white/70 p-5">
                <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Reporte aprobado</p>
                <p className="mt-3 text-3xl font-semibold text-[var(--accent)]">
                  {reportQuery.data ? reportQuery.data.totalInvoices : '...'}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">Facturas aprobadas dentro del filtro actual.</p>
              </article>
              <article className="rounded-[1.5rem] border border-[var(--border)] bg-white/70 p-5">
                <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Monto aprobado</p>
                <p className="mt-3 text-3xl font-semibold text-[var(--accent)]">
                  {reportQuery.data ? formatMoney(reportQuery.data.totalAmount) : '...'}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">Suma acumulada de facturas aprobadas.</p>
              </article>
              <article className="rounded-[1.5rem] border border-[var(--border)] bg-white/70 p-5 md:col-span-2 xl:col-span-2">
                <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Coincidencias</p>
                <p className="mt-3 text-3xl font-semibold">
                  {invoicesQuery.data ? invoicesQuery.data.totalItems : '...'}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">Facturas visibles en el listado, sin importar su estado.</p>
              </article>
            </div>

            {/* <div className="rounded-[1.5rem] border border-[var(--border)] bg-white/60 p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Resumen</p>
                  <h3 className="mt-2 text-xl font-semibold">Facturas aprobadas por categoría</h3>
                </div>
              </div>

              {reportQuery.isLoading ? (
                <div className="grid gap-3 md:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div className="h-28 animate-pulse rounded-[1.25rem] border border-[var(--border)] bg-white" key={index} />
                  ))}
                </div>
              ) : null}

              {reportQuery.isError ? (
                <div className="rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                  No se pudo generar el reporte por categoría.
                </div>
              ) : null}

              {reportQuery.data && reportQuery.data.items.length === 0 ? (
                <div className="rounded-[1.25rem] border border-dashed border-[var(--border)] bg-white/70 px-5 py-8 text-center text-sm text-[var(--muted)]">
                  No hay facturas aprobadas que coincidan con los filtros actuales.
                </div>
              ) : null}

              {reportQuery.data && reportQuery.data.items.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {reportQuery.data.items.map((item) => (
                    <article className="rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-5" key={item.categoryId}>
                      <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">{item.categoryName}</p>
                      <p className="mt-3 text-3xl font-semibold text-[var(--accent)]">{formatMoney(item.totalAmount)}</p>
                      <p className="mt-2 text-sm text-[var(--muted)]">{item.invoiceCount} factura{item.invoiceCount === 1 ? '' : 's'} aprobada{item.invoiceCount === 1 ? '' : 's'}.</p>
                    </article>
                  ))}
                </div>
              ) : null}
            </div> */}

            <div>
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Repositorio reciente</p>
                  <h3 className="mt-2 text-2xl font-semibold">Facturas procesadas</h3>
                </div>
                {invoicesQuery.data ? (
                  <span className="rounded-full border border-[var(--border)] bg-white/70 px-4 py-2 text-sm text-[var(--muted)]">
                    {invoicesQuery.data.totalItems} coincidencia{invoicesQuery.data.totalItems === 1 ? '' : 's'}
                  </span>
                ) : null}
              </div>

              {invoicesQuery.isLoading ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      className="h-52 animate-pulse rounded-[1.5rem] border border-[var(--border)] bg-white/60"
                      key={index}
                    />
                  ))}
                </div>
              ) : null}

              {invoicesQuery.isError ? (
                <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-5 py-4 text-red-900">
                  No se pudo cargar el listado de facturas.
                </div>
              ) : null}

              {invoicesQuery.data && invoicesQuery.data.items.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-[var(--border)] bg-white/60 px-6 py-10 text-center text-[var(--muted)]">
                  No hay facturas que coincidan con el filtro actual.
                </div>
              ) : null}

              {invoicesQuery.data && invoicesQuery.data.items.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {invoicesQuery.data.items.map((invoice) => (
                    <Link
                      className="group rounded-[1.5rem] border border-[var(--border)] bg-white/70 p-5 transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[0_18px_40px_rgba(165,69,21,0.12)]"
                      href={`/invoices/${invoice.id}`}
                      key={invoice.id}
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">{formatDateTime(invoice.createdAt)}</p>
                          <h3 className="mt-2 text-xl font-semibold">{invoice.producerName}</h3>
                        </div>
                        <span
                          className={clsx(
                            'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]',
                            invoice.status === 'APROBADA'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700',
                          )}
                        >
                          {invoice.status === 'APROBADA' ? 'Aprobada' : 'Por revisar'}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm text-[var(--muted)]">
                        <p><span className="font-semibold text-[var(--foreground)]">Consumidor:</span> {invoice.consumerName}</p>
                        <p><span className="font-semibold text-[var(--foreground)]">Categoría:</span> {invoice.categoryName ?? 'Pendiente'}</p>
                        <p><span className="font-semibold text-[var(--foreground)]">Fecha factura:</span> {formatInvoiceDate(invoice.invoiceDate)}</p>
                        <p><span className="font-semibold text-[var(--foreground)]">Archivo:</span> {invoice.originalFilename}</p>
                      </div>
                      <p className="mt-6 text-2xl font-semibold text-[var(--accent)]">{formatMoney(invoice.total)}</p>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
