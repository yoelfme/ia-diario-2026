# Invoice Processor

Monorepo con Turborepo para digitalizar facturas desde `PNG`, `JPG/JPEG` y `PDF`, extraer su contenido con OpenAI y revisarlo manualmente antes de aprobarlo.

## Stack

- `apps/webapp`: Next.js, React, TypeScript, Tailwind CSS, TanStack Query
- `apps/api`: Hono.js, AI SDK de Vercel, Drizzle ORM
- `packages/db`: esquema y migraciones SQL
- `packages/types`: tipos y schemas compartidos

## Requisitos

- Node.js 22+
- pnpm 10+
- `OPENAI_API_KEY` válida

## Variables de entorno

Crea `.env` en la raíz usando [.env.example](/Users/yoel/Code/umg/ia-diario-2026/week-6/invoice-processor/.env.example) como base.

Variables clave:

- `OPENAI_API_KEY`: API key de OpenAI
- `DATABASE_URL`: ruta SQLite relativa a `apps/api`
- `UPLOADS_DIR`: ruta de almacenamiento local relativa a `apps/api`
- `NEXT_PUBLIC_API_URL`: URL pública del API para el frontend

## Comandos

- `pnpm install`: instala dependencias
- `pnpm db:migrate`: crea/aplica migraciones SQLite
- `pnpm dev`: levanta `webapp` y `api` en paralelo
- `pnpm build`: build del monorepo
- `pnpm test`: ejecuta pruebas
- `pnpm typecheck`: verifica tipos en todo el workspace

## Flujo funcional

1. El usuario sube un `PNG`, `JPG/JPEG` o `PDF`.
2. El API valida el tipo, guarda el archivo localmente y prepara el documento para extracción.
3. OpenAI responde con salida estructurada:
   - si no es factura, el archivo se elimina y el usuario recibe un `422`
   - si sí es factura, se crea un registro en estado `POR_REVISAR`
4. Desde la webapp se puede:
   - ver listado de facturas
   - abrir detalle de una factura
   - editar mientras esté en `POR_REVISAR`
   - aprobarla, pasando a `APROBADA`

## Notas

- En v1, los PDFs se procesan usando sólo la primera página.
- Los archivos no válidos o que no son factura no se persisten en base de datos.
- El almacenamiento de archivos es local y el backend expone `/uploads/*` para preview y descarga.
