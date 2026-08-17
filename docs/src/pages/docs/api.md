---
layout: ../../layouts/DocsLayout.astro
title: API Versioning
description: How the HTTP API is versioned, negotiated by header, and documented.
---

The HTTP API carries its own major version, negotiated per request with the
`accept-version` header. A client pinned to a version keeps getting that version's
behaviour after a newer one ships, so an API change never forces an app update.

This version is **not** the application version. `VERSION` and `MIN_VERSION` track
releases of Skol Arena itself; a release can ship without touching the API contract,
and an API major can land while every client stays where it is.

## Supported versions

| Version | Status  |
| ------- | ------- |
| `v1`    | Current |

## Negotiating a version

Send `accept-version` on every request:

```bash
curl -H 'accept-version: v1' https://your-instance/api/disciplines
```

The server answers with the version it actually resolved:

```
X-API-VERSION: v1
Vary: accept-version
```

Rules:

- **No header** → the latest version. Convenient for exploring, risky for an
  application: the day a new major ships, an unpinned client moves with it.
- **`v1`, `V1` or `1`** → all resolve to `v1`. Surrounding whitespace is ignored.
- **An unknown version** → `400` with `UNSUPPORTED_API_VERSION`, listing what is
  available. An empty header is treated the same way: it is a client bug, not a
  request for the latest.

```json
{
  "error": {
    "code": "UNSUPPORTED_API_VERSION",
    "message": "Unsupported API version \"v9\". Available versions: v1.",
    "details": { "requested": "v9", "supported": "v1" }
  }
}
```

The version never appears in a URL. Paths stay `/api/…` whatever version is in play.

## Endpoints outside versioning

Three subtrees are not version-negotiated and ignore `accept-version`:

| Path                          | Why                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| `/api/auth/*`                 | Owned by Better Auth, which follows its own compatibility policy.                      |
| `/api/ws`                     | The browser `WebSocket` API cannot send request headers, so no client could negotiate. |
| `/api/docs`, `/api/openapi/*` | They describe the versions rather than living inside one.                              |

## Errors

Every failure uses the same envelope. `code` is a stable identifier — the same
failure carries the same code in every language — while `message` is that code
rendered in the language asked for via `Accept-Language`.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation error",
    "details": { "target": "json", "issues": [{ "path": "code", "message": "…" }] }
  }
}
```

## Reference documentation

Each version publishes an OpenAPI 3.1 document, generated from the same schemas the
server validates against, so the reference cannot drift from the implementation:

```
GET /api/openapi/v1.json
```

An interactive [Scalar](https://scalar.com) reference is served at `/api/docs`, with
a version switcher and a "Try it" console that sends the right `accept-version` for
you.

Both are enabled in development and disabled when `NODE_ENV=production`. Set
`API_DOCS_ENABLED=true` to publish them from a production instance, or `false` to
switch them off anywhere.
