# Product screenshots

The landing page shows real screens of the running app, not mockups. This folder
holds the pipeline that produces them.

Output lands in `docs/src/assets/screenshots/` as `<screen>-desktop.png` and
`<screen>-mobile.png`, and is committed: the build must not need a database.

## Why a second database

The app renders genuinely different components below 768px, so every screen is
captured twice. It also needs data that looks like a competition somebody has
actually played, which the e2e fixtures deliberately are not. So this runs on its
own throwaway Postgres (port 5436, next to dev on 5432 and e2e on 5435) seeded by
`backend/scripts/seed-showcase.ts`.

That seed is deterministic: twelve players with fixed hidden skill ratings, a
seeded PRNG, and a frozen "today". Re-running it on an empty database reproduces
the same standings and the same ladder, so a re-capture only shows real UI
changes rather than churn.

## Full run

```bash
cd docs
bun run shots:db:up        # Postgres on :5436
bun run shots:seed         # runs the migrations itself, then seeds
```

Then start the app against that database, from `backend/`:

```bash
DATABASE_URL=postgres://skolarena:skolarena@localhost:5436/skolarena_showcase \
BETTER_AUTH_SECRET='showcase-secret-at-least-32-characters!!' \
BETTER_AUTH_URL=http://localhost:3000 \
NODE_ENV=development ENABLE_EMAIL_PASSWORD=true \
KEYCLOAK_CLIENT_ID= KEYCLOAK_CLIENT_SECRET= KEYCLOAK_ISSUER= \
bun run src/index.ts
```

The dev frontend hardcodes `http://localhost:3000`, so this backend has to own
that port: stop the normal dev stack first. Start the frontend from `frontend/`
with `bun run dev`, then capture:

```bash
cd docs && bun run shots:capture
```

Tear down with `bun run shots:db:down`.

## Re-capturing

Re-run the whole sequence whenever the app's UI changes in a way the landing page
claims. A partial re-capture is fine, but the desktop and mobile files of one
screen belong together: the page shows the phone inline and the desktop one in the
zoom view behind it.

## Screens

| File          | Route                              |
| ------------- | ---------------------------------- |
| `tournaments` | `/`                                |
| `standings`   | `/tournaments/<championship>/standings` |
| `ranked`      | `/tournaments/<season>/standings`  |
| `bracket`     | `/tournaments/<cup>/bracket`       |
| `player`      | `/players/<id>`                    |
| `match`       | `/matches/<id>` (awaiting confirmation) |
