# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for a security vulnerability.**

Report it privately through GitHub:

👉 **[Report a vulnerability](https://github.com/Quent1L/skol-arena/security/advisories/new)**

This creates a private security advisory visible only to you and the maintainers. If you
can't use that form for any reason, open a regular issue saying only that you have a
security report to send — no details — and you'll be contacted to arrange a private
channel.

### What to include

The more of this you can provide, the faster it gets fixed:

- The version affected (shown in the app's footer, and returned by the API)
- How the instance is deployed (Docker image, Compose, reverse proxy in front, SSO enabled)
- What an attacker can do — the actual impact, not just the flaw
- Reproduction steps, ideally against a fresh instance
- Any logs, requests or screenshots that help

### What to expect

Skol Arena is maintained by a single person, so response times are best effort rather than
contractual. You can expect an acknowledgement within a few days. Valid reports get a fix
in the next release, credit in the advisory if you want it, and a heads-up before the
advisory goes public.

Please give a reasonable window for a fix before disclosing publicly.

## Supported versions

| Version | Supported |
|---|---|
| Latest release | ✅ |
| Anything older | ❌ |

Only the most recent published version receives security fixes. Releases are cut
frequently and the Docker image is republished for each one, so staying on `:latest` — or
pinning to the current version tag and updating — is the supported path. There are no
backports to older tags.

## Not a vulnerability

Two behaviours look alarming but are documented and intentional:

- **The initial super-admin password is printed in cleartext to the container logs** on the
  first boot against an empty database, and regenerated on every restart until that account
  logs in once. This is how you get into a fresh instance. Treat those logs as a secret
  until you have changed the password. See the
  [deployment guide](https://skol-arena.com/docs/deployment).
- **The API reference is served at `/api/docs`** in development. It is gated by
  `API_DOCS_ENABLED`, which is off in production. If it is reachable on your production
  instance, check that variable rather than reporting it.

## Hardening your instance

If you self-host, the things that actually matter:

- Set `BETTER_AUTH_SECRET` to a long random string, unique to your instance. Never reuse
  the example value.
- Terminate TLS in front of the container and set `BETTER_AUTH_URL` to the public HTTPS
  origin.
- Change the initial admin password immediately after the first login.
- Keep PostgreSQL off the public internet.

Every variable is documented in the
[environment variables reference](https://skol-arena.com/docs/environment-variables).
