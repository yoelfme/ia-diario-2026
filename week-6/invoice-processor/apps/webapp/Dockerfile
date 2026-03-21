FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@10.21.0 --activate

FROM base AS build

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/webapp/package.json ./apps/webapp/package.json
COPY --from=build /app/apps/webapp/node_modules ./apps/webapp/node_modules
COPY --from=build /app/apps/webapp/.next ./apps/webapp/.next
COPY --from=build /app/apps/webapp/next.config.ts ./apps/webapp/next.config.ts
COPY --from=build /app/packages/types/package.json ./packages/types/package.json
COPY --from=build /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=build /app/packages/types/dist ./packages/types/dist

WORKDIR /app/apps/webapp

EXPOSE 3000

CMD ["node", "/app/apps/webapp/node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
