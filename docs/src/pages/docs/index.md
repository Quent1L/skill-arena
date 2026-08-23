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
  quent1l/skol-arena:latest
```

On first boot the app runs its database migrations automatically, then creates an
initial super-admin account if the database is empty. Watch the container logs for
the generated password: it is regenerated and logged again on every restart until
that account logs in for the first time — see [Deployment](/docs/deployment) for
details.

Only two variables are truly required to get a working instance: `DATABASE_URL` and
`BETTER_AUTH_SECRET`. Everything else has a usable default — the image already
points `FRONTEND_BUILD_PATH` and `MIGRATIONS_FOLDER` at the bundled frontend build
and migrations, so a single container serves both the API and the web app.

## Where to go next

- **[Environment Variables](/docs/environment-variables)** — every variable the app
  reads, what it configures, and whether it's required.
- **[Deployment](/docs/deployment)** — the full Docker Compose setup (app +
  Postgres), how migrations and the first admin account work, and notes on
  architecture support.

Once the instance is up, these pages cover how it behaves:

- **[Matches](/docs/matches)** — the player-driven match workflow, the four validation
  modes and the trust score, and the team formats a match can take.
- **[Disciplines & Scoring](/docs/disciplines)** — disciplines, outcome types and their
  weights, rules pages, and the contextual rules engine.
- **[MMR Rating](/docs/mmr)** — how ranked ratings are computed: the Elo formula,
  per-discipline sharing between teammates, season seeding and recalculation.
- **[Accounts & Access](/docs/accounts)** — authentication methods, invitation codes, and
  scoping tournaments to an organization.

## Prerequisites

- A PostgreSQL database (any recent version) reachable from the container.
- Docker (or a Docker-compatible runtime) able to pull from [Docker Hub](https://hub.docker.com/r/quent1l/skol-arena) .
