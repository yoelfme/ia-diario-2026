import { sql } from 'drizzle-orm';
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  slugIdx: uniqueIndex('categories_slug_idx').on(table.slug),
}));

export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  status: text('status', { enum: ['POR_REVISAR', 'APROBADA'] }).notNull(),
  sourceFilePath: text('source_file_path').notNull(),
  sourceMimeType: text('source_mime_type').notNull(),
  originalFilename: text('original_filename').notNull(),
  consumerName: text('consumer_name').notNull(),
  consumerNit: text('consumer_nit'),
  producerName: text('producer_name').notNull(),
  producerNit: text('producer_nit'),
  categoryId: text('category_id').references(() => categories.id),
  invoiceDate: text('invoice_date'),
  subtotalCents: integer('subtotal_cents').notNull(),
  taxesCents: integer('taxes_cents').notNull(),
  totalCents: integer('total_cents').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  filePathIdx: uniqueIndex('invoices_source_file_path_idx').on(table.sourceFilePath),
}));

export const invoiceItems = sqliteTable('invoice_items', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull(),
  description: text('description').notNull(),
  priceCents: integer('price_cents').notNull(),
  sortOrder: integer('sort_order').notNull(),
});

export type CategoryRow = typeof categories.$inferSelect;
export type NewCategoryRow = typeof categories.$inferInsert;
export type InvoiceRow = typeof invoices.$inferSelect;
export type NewInvoiceRow = typeof invoices.$inferInsert;
export type InvoiceItemRow = typeof invoiceItems.$inferSelect;
export type NewInvoiceItemRow = typeof invoiceItems.$inferInsert;
