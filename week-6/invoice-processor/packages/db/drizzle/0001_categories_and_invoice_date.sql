CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_idx
  ON categories(slug);

INSERT OR IGNORE INTO categories (id, slug, name) VALUES
  ('cat_alimentacion', 'alimentacion', 'Alimentación'),
  ('cat_transporte', 'transporte', 'Transporte'),
  ('cat_hospedaje', 'hospedaje', 'Hospedaje'),
  ('cat_suministros', 'suministros', 'Suministros'),
  ('cat_servicios', 'servicios', 'Servicios'),
  ('cat_impuestos', 'impuestos', 'Impuestos'),
  ('cat_otros', 'otros', 'Otros');

ALTER TABLE invoices ADD COLUMN category_id TEXT REFERENCES categories(id);
ALTER TABLE invoices ADD COLUMN invoice_date TEXT;

UPDATE invoices
SET invoice_date = substr(created_at, 1, 10)
WHERE invoice_date IS NULL;

UPDATE invoices
SET category_id = 'cat_otros'
WHERE status = 'APROBADA' AND category_id IS NULL;

CREATE INDEX IF NOT EXISTS invoices_category_id_idx
  ON invoices(category_id);

CREATE INDEX IF NOT EXISTS invoices_invoice_date_idx
  ON invoices(invoice_date);
