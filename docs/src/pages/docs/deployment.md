---
layout: ../../layouts/DocsLayout.astro
title: Deployment
description: Docker image, Docker Compose setup, first boot, and platform notes.
---

## Docker image

Official images are published to GitHub Container Registry:

```
ghcr.io/quent1l/skol-arena:latest
ghcr.io/quent1l/skol-arena:<version>   # e.g. 1.15.0
```

The image is built from the repository's multi-stage `Dockerfile`: it compiles the
shared types package, builds the Vue frontend, bundles the Bun backend, and copies
only the production artifacts into a minimal `oven/bun:1.3-alpine` runtime running
as a non-root user.

**Platform note**: published images are currently `linux/amd64` only. If you're on
ARM (Raspberry Pi, or Apple Silicon without Rosetta-backed Docker Desktop), build
the image yourself from the `Dockerfile` at the repo root:

```bash
docker build -t skol-arena:local .
```

## Docker Compose

A minimal setup with Postgres alongside the app:

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: skol
      POSTGRES_PASSWORD: change-me
      POSTGRES_DB: skol_arena
    volumes:
      - skol-db-data:/var/lib/postgresql/data

  app:
    image: ghcr.io/quent1l/skol-arena:latest
    restart: unless-stopped
    depends_on:
      - db
    ports:
      - '3000:3000'
    environment:
      DATABASE_URL: postgres://skol:change-me@db:5432/skol_arena
      BETTER_AUTH_SECRET: change-me-to-a-long-random-string
      BETTER_AUTH_URL: http://localhost:3000
      FRONTEND_BUILD_PATH: /app/frontend/dist

volumes:
  skol-db-data:
```

The app has no other stateful dependency — no upload directory or extra volume is
needed beyond the Postgres data volume.

Add SMTP, VAPID, or Keycloak variables from the
[Environment Variables](/docs/environment-variables) reference as needed; none of
them are required to get a working instance running.

## First boot

Two things happen automatically the first time the container starts against an
empty database:

1. **Migrations run.** The app applies all pending Drizzle migrations before
   accepting any HTTP traffic. If a migration fails, the process exits — check
   the container logs and fix the underlying issue rather than retrying blindly.
2. **An initial super-admin account is created**, but only if the `appUsers` table
   is completely empty. The account email is `INITIAL_ADMIN_EMAIL` (defaults to
   `admin@skol-arena.local`), and a random password is generated and printed
   **once** to the container logs:

   ```bash
   docker compose logs app | grep -A2 "initial admin"
   ```

   Log in with that email/password at `/login?native=true`, then change the
   password from the account settings.

## Single-container frontend serving

Setting `FRONTEND_BUILD_PATH=/app/frontend/dist` (as in the Compose example
above) tells the backend to serve the built Vue app itself — static assets plus
an SPA fallback to `index.html` — so a single container and a single port cover
both the API and the web app. This is not enabled by default: without the
variable, the container only exposes the API, and `/` returns a plain
placeholder response.
