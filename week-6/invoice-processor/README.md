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
- `DOMAIN`: dominio público que apuntará a la VPS
- `LETSENCRYPT_EMAIL`: correo usado por Let's Encrypt

## Comandos

- `pnpm install`: instala dependencias
- `pnpm db:migrate`: crea/aplica migraciones SQLite
- `pnpm dev`: levanta `webapp` y `api` en paralelo
- `pnpm build`: build del monorepo
- `pnpm test`: ejecuta pruebas
- `pnpm typecheck`: verifica tipos en todo el workspace
- `docker compose up -d --build`: construye y levanta `api`, `webapp` y `caddy`

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

## Despliegue En VPS Con Docker Compose

El stack de producción publica:

- `https://<DOMAIN>` para la webapp
- `https://<DOMAIN>/api` para el API

La persistencia queda a cargo de volúmenes Docker:

- `api_data`: base de datos SQLite
- `api_uploads`: archivos subidos y procesados
- `caddy_data`: certificados y estado de Caddy
- `caddy_config`: configuración persistente de Caddy

### Requisitos Previos

- Docker y Docker Compose instalados en la VPS
- un dominio apuntando a la IP pública de la VPS
- `OPENAI_API_KEY` válida
- acceso al repo con una SSH Deployment Key configurada en GitHub

### Flujo Recomendado

1. Agrega una SSH Deployment Key al repositorio en GitHub.
2. Clona el repositorio en la VPS.
3. Copia `.env.example` a `.env`.
4. Configura al menos estas variables en `.env`:
   - `OPENAI_API_KEY`
   - `DOMAIN`
   - `LETSENCRYPT_EMAIL`
   - `NEXT_PUBLIC_API_URL=https://<DOMAIN>/api`
5. Verifica que el dominio ya resuelva a la VPS.
6. Levanta el stack:

```bash
docker compose up -d --build
```

7. Revisa el estado y logs:

```bash
docker compose ps
docker compose logs -f api webapp caddy
```

8. Prueba:
   - `https://<DOMAIN>`
   - `https://<DOMAIN>/api`

### Importante Sobre Let's Encrypt

Let's Encrypt no emite certificados para direcciones IP públicas. Si sólo expones la aplicación por IP, Caddy no podrá obtener un certificado válido para `443`.

Para que HTTPS funcione correctamente con un certificado de navegador:

- el dominio debe resolver a la VPS
- los puertos `80` y `443` deben estar abiertos
- `DOMAIN` y `LETSENCRYPT_EMAIL` deben estar configurados en `.env`

### Operación

- Después de hacer `git pull`, vuelve a desplegar con `docker compose up -d --build`.
- Si recreas contenedores, la base SQLite y los uploads persistirán mientras conserves los volúmenes Docker.
