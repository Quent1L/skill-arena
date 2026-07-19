---
layout: ../../layouts/DocsLayout.astro
title: Self-Hosting
description: Run Skol Arena on your own infrastructure with Docker.
---

Skol Arena ships as a single Docker image containing the API, the built frontend,
and automatic database migrations. All you need is a PostgreSQL database.

## Quick start

```bash
docker run -d \
  --name skol-arena \
  -p 3000:3000 \
  -e DATABASE_URL="postgres://user:password@your-db-host:5432/skol_arena" \
  -e BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
  -e FRONTEND_BUILD_PATH="/app/frontend/dist" \
  quent1l/skol-arena:latest
```

On first boot the app runs its database migrations automatically, then creates an
initial super-admin account if the database is empty. Watch the container logs for
the generated password: it is regenerated and logged again on every restart until
that account logs in for the first time — see [Deployment](/docs/deployment) for
details.

Only two variables are truly required to get a working instance: `DATABASE_URL` and
`BETTER_AUTH_SECRET`. `FRONTEND_BUILD_PATH` is what turns the image into a
single-container deployment serving both the API and the web app — without it, the
container only exposes the API.

## Where to go next

- **[Environment Variables](/docs/environment-variables)** — every variable the app
  reads, what it configures, and whether it's required.
- **[Deployment](/docs/deployment)** — the full Docker Compose setup (app +
  Postgres), how migrations and the first admin account work, and notes on
  architecture support.

## Prerequisites

- A PostgreSQL database (any recent version) reachable from the container.
- Docker (or a Docker-compatible runtime) able to pull from [Docker Hub](https://hub.docker.com/r/quent1l/skol-arena) .
