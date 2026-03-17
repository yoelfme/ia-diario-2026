'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import type { InvoiceDetail, UpdateInvoiceInput } from '@invoice-processor/types';
import {
  ApiClientError,
  approveInvoice,
  fetchCategories,
  fetchInvoice,
  getAssetUrl,
  updateInvoice,
} from '../lib/api';

const moneyFormatter = new Intl.NumberFormat('es-GT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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
    return 'Pendiente';
  }

  return new Intl.DateTimeFormat('es-GT', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function toDraft(invoice: InvoiceDetail): UpdateInvoiceInput {
  return {
    consumerName: invoice.consumerName,
    consumerNit: invoice.consumerNit,
    producerName: invoice.producerName,
    producerNit: invoice.producerNit,
    categoryId: invoice.categoryId,
    invoiceDate: invoice.invoiceDate,
    subtotal: invoice.subtotal,
    taxes: invoice.taxes,
    total: invoice.total,
    items: invoice.items.map((item) => ({
      quantity: item.quantity,
      description: item.description,
      price: item.price,
    })),
  };
}

function ErrorBanner({ error }: { error: unknown }) {
  if (!(error instanceof ApiClientError)) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-900">
      <p className="font-semibold">{error.payload.message}</p>
      {error.payload.reason ? <p className="mt-1">{error.payload.reason}</p> : null}
    </div>
  );
}

export function InvoiceDetailView({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const invoiceQuery = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => fetchInvoice(invoiceId),
  });
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });
  const [draft, setDraft] = useState<UpdateInvoiceInput | null>(null);

  useEffect(() => {
    if (invoiceQuery.data) {
      setDraft(toDraft(invoiceQuery.data));
    }
  }, [invoiceQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: UpdateInvoiceInput) => updateInvoice(invoiceId, payload),
    onSuccess: async (invoice) => {
      queryClient.setQueryData(['invoice', invoiceId], invoice);
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      await queryClient.invalidateQueries({ queryKey: ['invoiceReports'] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (payload: UpdateInvoiceInput) => {
      await updateInvoice(invoiceId, payload);
      return approveInvoice(invoiceId);
    },
    onSuccess: async (invoice) => {
      queryClient.setQueryData(['invoice', invoiceId], invoice);
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      await queryClient.invalidateQueries({ queryKey: ['invoiceReports'] });
    },
  });

  if (invoiceQuery.isLoading || !draft) {
    return (
      <main className="min-h-screen px-5 py-10 md:px-8">
        <div className="mx-auto h-[70vh] max-w-6xl animate-pulse rounded-[2rem] border border-[var(--border)] bg-white/60" />
      </main>
    );
  }

  if (invoiceQuery.isError) {
    return (
      <main className="min-h-screen px-5 py-10 md:px-8">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-red-200 bg-red-50 p-8 text-red-900">
          No se pudo cargar el detalle de la factura.
        </div>
      </main>
    );
  }

  const invoice = invoiceQuery.data as InvoiceDetail;
  const isApproved = invoice.status === 'APROBADA';
  const fileUrl = getAssetUrl(invoice.sourceFilePath);
  const missingApprovalFields = [
    !draft.categoryId ? 'categoría' : null,
    !draft.invoiceDate ? 'fecha de la factura' : null,
  ].filter(Boolean);

  return (
    <main className="min-h-screen px-5 py-8 md:px-8 md:py-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link className="text-sm uppercase tracking-[0.2em] text-[var(--muted)] transition hover:text-[var(--accent)]" href="/">
              Volver al tablero
            </Link>
            <h1 className="mt-3 text-4xl font-semibold">{invoice.producerName}</h1>
            <p className="mt-2 text-[var(--muted)]">Procesada el {formatDateTime(invoice.createdAt)} desde {invoice.originalFilename}</p>
          </div>

          <span
            className={clsx(
              'rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-[0.16em]',
              isApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
            )}
          >
            {isApproved ? 'Aprobada' : 'Por revisar'}
          </span>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
          <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[0_24px_80px_rgba(56,32,11,0.08)] backdrop-blur md:p-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Datos extraídos</p>
                <h2 className="mt-2 text-2xl font-semibold">Revisión manual</h2>
              </div>
              <div className="text-right text-sm text-[var(--muted)]">
                <p>Última actualización</p>
                <p className="font-semibold text-[var(--foreground)]">{formatDateTime(invoice.updatedAt)}</p>
              </div>
            </div>

            <div className="space-y-4">
              {categoriesQuery.isError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                  No se pudo cargar el catálogo de categorías.
                </div>
              ) : null}
              {!isApproved && missingApprovalFields.length > 0 ? (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Debes completar {missingApprovalFields.join(' y ')} antes de aprobar.
                </div>
              ) : null}
              <ErrorBanner error={saveMutation.error} />
              <ErrorBanner error={approveMutation.error} />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold">Nombre del consumidor</span>
                <input
                  className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                  disabled={isApproved}
                  onChange={(event) => setDraft((current) => current ? { ...current, consumerName: event.target.value } : current)}
                  value={draft.consumerName}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">NIT consumidor</span>
                <input
                  className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                  disabled={isApproved}
                  onChange={(event) => setDraft((current) => current ? { ...current, consumerNit: event.target.value || null } : current)}
                  value={draft.consumerNit ?? ''}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Nombre del productor</span>
                <input
                  className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                  disabled={isApproved}
                  onChange={(event) => setDraft((current) => current ? { ...current, producerName: event.target.value } : current)}
                  value={draft.producerName}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">NIT productor</span>
                <input
                  className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                  disabled={isApproved}
                  onChange={(event) => setDraft((current) => current ? { ...current, producerNit: event.target.value || null } : current)}
                  value={draft.producerNit ?? ''}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Categoría</span>
                <select
                  className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                  disabled={isApproved || categoriesQuery.isLoading}
                  onChange={(event) => setDraft((current) => current ? { ...current, categoryId: event.target.value || null } : current)}
                  value={draft.categoryId ?? ''}
                >
                  <option value="">Selecciona una categoría</option>
                  {categoriesQuery.data?.items.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Fecha de la factura</span>
                <input
                  className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                  disabled={isApproved}
                  onChange={(event) => setDraft((current) => current ? { ...current, invoiceDate: event.target.value || null } : current)}
                  type="date"
                  value={draft.invoiceDate ?? ''}
                />
              </label>
            </div>

            <div className="mt-8 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-semibold">Ítems</h3>
                {!isApproved ? (
                  <button
                    className="rounded-full border border-[var(--border)] bg-white/80 px-4 py-2 text-sm font-semibold transition hover:border-[var(--accent)]"
                    type="button"
                    onClick={() => setDraft((current) => current ? {
                      ...current,
                      items: [
                        ...current.items,
                        { quantity: 1, description: '', price: 0 },
                      ],
                    } : current)}
                  >
                    Agregar ítem
                  </button>
                ) : null}
              </div>

              <div className="space-y-3">
                {draft.items.map((item, index) => (
                  <div className="grid gap-3 rounded-[1.5rem] border border-[var(--border)] bg-white/70 p-4 md:grid-cols-[120px_1fr_140px_auto]" key={`${index}-${invoice.id}`}>
                    <input
                      className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 outline-none focus:border-[var(--accent)]"
                      disabled={isApproved}
                      min="1"
                      onChange={(event) => setDraft((current) => {
                        if (!current) return current;
                        const items = [...current.items];
                        items[index] = {
                          ...items[index],
                          quantity: Number.parseInt(event.target.value || '1', 10),
                        };
                        return { ...current, items };
                      })}
                      step="1"
                      type="number"
                      value={item.quantity}
                    />
                    <input
                      className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 outline-none focus:border-[var(--accent)]"
                      disabled={isApproved}
                      onChange={(event) => setDraft((current) => {
                        if (!current) return current;
                        const items = [...current.items];
                        items[index] = { ...items[index], description: event.target.value };
                        return { ...current, items };
                      })}
                      value={item.description}
                    />
                    <input
                      className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 outline-none focus:border-[var(--accent)]"
                      disabled={isApproved}
                      min="0"
                      onChange={(event) => setDraft((current) => {
                        if (!current) return current;
                        const items = [...current.items];
                        items[index] = {
                          ...items[index],
                          price: Number(event.target.value || 0),
                        };
                        return { ...current, items };
                      })}
                      step="0.01"
                      type="number"
                      value={item.price}
                    />
                    {!isApproved ? (
                      <button
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                        type="button"
                        onClick={() => setDraft((current) => current ? {
                          ...current,
                          items: current.items.filter((_, currentIndex) => currentIndex !== index),
                        } : current)}
                      >
                        Quitar
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className="text-sm font-semibold">Subtotal</span>
                <input
                  className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                  disabled={isApproved}
                  min="0"
                  onChange={(event) => setDraft((current) => current ? { ...current, subtotal: Number(event.target.value || 0) } : current)}
                  step="0.01"
                  type="number"
                  value={draft.subtotal}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Impuestos</span>
                <input
                  className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                  disabled={isApproved}
                  min="0"
                  onChange={(event) => setDraft((current) => current ? { ...current, taxes: Number(event.target.value || 0) } : current)}
                  step="0.01"
                  type="number"
                  value={draft.taxes}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Total</span>
                <input
                  className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                  disabled={isApproved}
                  min="0"
                  onChange={(event) => setDraft((current) => current ? { ...current, total: Number(event.target.value || 0) } : current)}
                  step="0.01"
                  type="number"
                  value={draft.total}
                />
              </label>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isApproved || saveMutation.isPending || approveMutation.isPending}
                type="button"
                onClick={() => saveMutation.mutate(draft)}
              >
                {saveMutation.isPending ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button
                className="rounded-full border border-emerald-300 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isApproved || missingApprovalFields.length > 0 || approveMutation.isPending || saveMutation.isPending}
                type="button"
                onClick={() => approveMutation.mutate(draft)}
              >
                {approveMutation.isPending ? 'Guardando y aprobando…' : 'Guardar y aprobar'}
              </button>
              <button
                className="rounded-full border border-[var(--border)] bg-white/80 px-5 py-3 text-sm font-semibold transition hover:border-[var(--accent)]"
                type="button"
                onClick={() => router.push('/')}
              >
                Regresar al listado
              </button>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[0_24px_80px_rgba(56,32,11,0.08)] backdrop-blur">
              <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Documento fuente</p>
              <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-white/70">
                {invoice.sourceMimeType === 'application/pdf' ? (
                  <div className="space-y-4 p-5">
                    <p className="text-sm leading-6 text-[var(--muted)]">
                      El archivo fuente es un PDF. En v1 el backend procesa sólo la primera página para extraer la factura.
                    </p>
                    <a
                      className="inline-flex rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                      href={fileUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Abrir PDF original
                    </a>
                  </div>
                ) : (
                  <img
                    alt={`Factura ${invoice.originalFilename}`}
                    className="h-auto w-full object-cover"
                    src={fileUrl}
                  />
                )}
              </div>
            </section>

            <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[0_24px_80px_rgba(56,32,11,0.08)] backdrop-blur">
              <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Resumen</p>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[var(--muted)]">Categoría</dt>
                  <dd className="font-semibold">{invoice.categoryName ?? 'Pendiente'}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[var(--muted)]">Fecha factura</dt>
                  <dd className="font-semibold">{formatInvoiceDate(invoice.invoiceDate)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[var(--muted)]">Subtotal</dt>
                  <dd className="font-semibold">{formatMoney(invoice.subtotal)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[var(--muted)]">Impuestos</dt>
                  <dd className="font-semibold">{formatMoney(invoice.taxes)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-[var(--border)] pt-3 text-lg">
                  <dt className="font-semibold">Total</dt>
                  <dd className="font-semibold text-[var(--accent)]">{formatMoney(invoice.total)}</dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
