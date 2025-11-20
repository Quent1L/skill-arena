# --- Base ------------------------------------------------------
FROM oven/bun:1-alpine AS base
WORKDIR /app


# --- Dependencies ---------------------------------------------
FROM base AS deps

# Copier uniquement ce qui est nécessaire à l'installation
COPY package.json bun.lock ./

# Copier les package.json des workspaces
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Installer TOUTES les deps (y compris devDependencies pour le build)
RUN bun install --frozen-lockfile


# --- Build (shared + frontend + backend) -----------------------
FROM base AS build
WORKDIR /app

# Copier dépendances
COPY --from=deps /app/node_modules ./node_modules

# Copier l'intégralité du workspace
COPY . .

# Build shared
RUN bun run --cwd ./shared build

# Build frontend
RUN bun run --cwd ./frontend build-only

# Build backend en JS bundlé (sans node_modules)
RUN bun build ./backend/src/index.ts \
    --target bun \
    --outdir ./backend/dist \
    --minify \
    --sourcemap=none \
    --loader .json:json


# --- Production ------------------------------------------------
FROM oven/bun:1-alpine AS production
WORKDIR /app

# Créer un utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copier uniquement ce qui est nécessaire à l'exécution
COPY --from=build --chown=nodejs:nodejs /app/backend/dist ./backend/dist
COPY --from=build --chown=nodejs:nodejs /app/frontend/dist ./frontend/dist

# Si le backend a vraiment besoin du package.json (rare avec un build bundlé)
# COPY --chown=nodejs:nodejs backend/package.json ./backend/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Utiliser l'utilisateur non-root
USER nodejs

CMD ["bun", "./backend/dist/index.js"]