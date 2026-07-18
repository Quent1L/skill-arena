---
title: Secure authentication
summary: Native login or Keycloak SSO — enable either, or both at once.
order: 10
icon: lock
pillar: platform
---

Accounts are backed by Better Auth, giving every player a secure login and every
organizer confidence that tournament data is tied to a real, authenticated
identity.

Two authentication methods are supported, independently togglable per deployment:

- **Native email & password** — built in, no extra setup.
- **Keycloak SSO** — OIDC-based single sign-on through Keycloak, with optional PKCE.

Both can be enabled at the same time: players choose either method on the same
login screen. A Keycloak account automatically links to an existing native
account that shares the same email, so nobody ends up with duplicate accounts.
