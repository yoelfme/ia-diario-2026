PRAGMA foreign_keys=OFF;

CREATE TABLE invoice_items_new (
  id TEXT PRIMARY KEY NOT NULL,
  invoice_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  description TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  sort_order INTEGER NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

INSERT INTO invoice_items_new (id, invoice_id, quantity, description, price_cents, sort_order)
SELECT
  id,
  invoice_id,
  CAST(quantity AS INTEGER),
  description,
  price_cents,
  sort_order
FROM invoice_items;

DROP TABLE invoice_items;
ALTER TABLE invoice_items_new RENAME TO invoice_items;

PRAGMA foreign_keys=ON;
