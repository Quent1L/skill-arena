---
layout: ../../layouts/DocsLayout.astro
title: Deployment
description: Docker image, Docker Compose setup, first boot, and platform notes.
---

## Docker image

Official images are published to GitHub Container Registry:

```
quent1l/skol-arena:latest
quent1l/skol-arena:<version>   # e.g. 2.0.0
```

The image is built from the repository's multi-stage `Dockerfile`: it compiles the
shared types package, builds the Vue frontend, bundles the Bun backend, and copies
only the production artifacts into a minimal `oven/bun:1.4-slim` runtime running
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
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U skol -d skol_arena']
      interval: 5s
      timeout: 5s
      retries: 10

  app:
    image: quent1l/skol-arena:latest
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    ports:
      - '3000:3000'
    environment:
      DATABASE_URL: postgres://skol:change-me@db:5432/skol_arena
      BETTER_AUTH_SECRET: change-me-to-a-long-random-string
      BETTER_AUTH_URL: http://localhost:3000

volumes:
  skol-db-data:
```

The app has no other stateful dependency — no upload directory or extra volume is
needed beyond the Postgres data volume.

The `healthcheck` and `condition: service_healthy` matter more than they look. A
plain `depends_on: - db` only waits for the database _container_ to start, not for
Postgres to accept connections — the app would then fail its startup migrations and,
under `restart: unless-stopped`, crash-loop until the database happens to be ready.

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
   `admin@skol-arena.local`), and a random password is generated and printed to
   the container logs:

   ```bash
   docker compose logs app | grep "INITIAL ADMIN CREDENTIALS"
   ```

   As long as that account has **never logged in**, a **new password is generated
   and logged on every restart**, and the previous one stops working. Missing the
   log line the first time is therefore harmless — restart the container and read
   the fresh password. Rotation stops permanently on the first successful login.

   Log in with the last logged email/password at `/login?native=true`, then change
   the password from the account settings. The generated password appears in
   cleartext in the logs, so treat those logs as a secret until you have replaced
   it.

## Recovering a lost admin password

The rotation described above only covers accounts flagged as awaiting their first
login. Instances created **before** that behaviour existed are never flagged, so
they keep whatever password they already have — restarting them does not print a
new one.

If you are locked out — the initial password was lost and no other super-admin can
log in — re-arm the rotation by hand against the database:

```sql
UPDATE app_users SET bootstrap_pending = true WHERE role = 'super_admin';
```

Restart the container and read the new password from the logs, exactly as on a
first boot. The flag clears itself again on the next successful login.

This is deliberately a manual step. The app cannot tell an admin who has never
logged in from one who simply has not logged in recently — sessions expire and are
deleted — so automatically re-arming the rotation would invalidate working
passwords on healthy instances.

The same procedure works as a general admin password reset, for example if SSO
becomes unavailable and no local credentials are known.

## Single-container frontend serving

The image ships with `FRONTEND_BUILD_PATH=/app/frontend/dist` already set, which
tells the backend to serve the built Vue app itself — static assets plus an SPA
fallback to `index.html` — so a single container and a single port cover both the
API and the web app. Nothing to configure.

Setting the variable to an empty value disables it: the container then only
exposes the API, and `/` returns a plain placeholder response. That is only
useful if you serve the frontend separately (a CDN or a reverse proxy), in which
case set `FRONTEND_URL` so CORS and the auth trusted origins allow it.
