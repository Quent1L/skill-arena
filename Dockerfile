# --- Base ------------------------------------------------------
FROM oven/bun:1.3.14-slim AS base
WORKDIR /app


# --- Dependencies ---------------------------------------------
FROM base AS deps

COPY package.json bun.lock ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY docs/package.json ./docs/

# devDependencies included: needed by the build stage
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# --- Build (shared + frontend + backend) -----------------------
FROM base AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN bun run --cwd ./shared build

RUN bun run --cwd ./frontend build-only

# Bundle the backend so the runtime stage needs no node_modules
RUN bun build ./backend/src/index.ts \
    --target bun \
    --outdir ./backend/dist \
    --minify \
    --sourcemap=none \
    --loader .json:json


# --- Production ------------------------------------------------
FROM oven/bun:1.3.14-slim AS production
WORKDIR /app

# --create-home matters: bun writes caches under $HOME and fails without it
RUN groupadd --system --gid 1001 skol && \
    useradd --system --uid 1001 --gid skol --create-home --shell /usr/sbin/nologin skol

COPY --from=build --chown=skol:skol /app/backend/dist ./backend/dist
COPY --from=build --chown=skol:skol /app/backend/drizzle ./backend/drizzle
COPY --from=build --chown=skol:skol /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=3000
ENV MIGRATIONS_FOLDER=./backend/drizzle
ENV FRONTEND_BUILD_PATH=/app/frontend/dist

EXPOSE 3000

USER skol

CMD ["bun", "./backend/dist/index.js"]
