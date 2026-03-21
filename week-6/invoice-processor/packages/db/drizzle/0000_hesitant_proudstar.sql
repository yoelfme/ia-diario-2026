CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_idx` ON `categories` (`slug`);--> statement-breakpoint
INSERT OR IGNORE INTO `categories` (`id`, `slug`, `name`) VALUES
	('cat_alimentacion', 'alimentacion', 'Alimentación'),
	('cat_transporte', 'transporte', 'Transporte'),
	('cat_hospedaje', 'hospedaje', 'Hospedaje'),
	('cat_suministros', 'suministros', 'Suministros'),
	('cat_servicios', 'servicios', 'Servicios'),
	('cat_impuestos', 'impuestos', 'Impuestos'),
	('cat_otros', 'otros', 'Otros');--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`description` text NOT NULL,
	`price_cents` integer NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`source_file_path` text NOT NULL,
	`source_mime_type` text NOT NULL,
	`original_filename` text NOT NULL,
	`consumer_name` text NOT NULL,
	`consumer_nit` text,
	`producer_name` text NOT NULL,
	`producer_nit` text,
	`category_id` text,
	`invoice_date` text,
	`subtotal_cents` integer NOT NULL,
	`taxes_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_source_file_path_idx` ON `invoices` (`source_file_path`);
