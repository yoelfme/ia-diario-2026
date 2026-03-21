CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL,
  source_file_path TEXT NOT NULL,
  source_mime_type TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  consumer_name TEXT NOT NULL,
  consumer_nit TEXT,
  producer_name TEXT NOT NULL,
  producer_nit TEXT,
  subtotal_cents INTEGER NOT NULL,
  taxes_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS invoices_source_file_path_idx
  ON invoices(source_file_path);

CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY NOT NULL,
  invoice_id TEXT NOT NULL,
  quantity TEXT NOT NULL,
  description TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  sort_order INTEGER NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

