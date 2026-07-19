---
title: Invitation codes
summary: Registration is invite-only — a code creates the account, and can carry a group with it.
order: 12
icon: key
pillar: platform
---

There is no open sign-up. Every account starts from an invitation code issued by the
instance administrator — a four-word passphrase like `frost-otter-ridge-plume`, easy to read
out loud or drop in a message.

Each code carries its own rules:

- **A number of uses** — one by default, or a larger batch for a whole team.
- **An optional expiry** — a code can run out after a set number of days, or never expire.
- **An optional organization** — bind a code to a group and redeeming it also makes the new
  player a member, so onboarding a private league is a single link.

There are three ways a code gets used:

- **At sign-up** — enter it on the registration screen, or follow a prefilled invite link
  that fills it in for you.
- **After signing in** — if an account was created without a code, the app asks for one
  before letting it in, rather than leaving a half-open account.
- **To join another group later** — an established player can redeem an organization-bound
  code from their settings to join an extra organization, without touching their account.

The gate applies to **every** login method: Keycloak SSO doesn't bypass it. Signing in
through your identity provider still leaves you on the code screen until a code is redeemed,
so an open SSO realm can't quietly become an open instance.
