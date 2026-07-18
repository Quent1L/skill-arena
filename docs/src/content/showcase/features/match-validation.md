---
title: Configurable match validation
summary: Choose how much trust a tournament extends before a reported score locks in.
order: 1
icon: shield
pillar: platform
---

Every championship and ranked tournament picks its own **validation mode** — how much confirmation a reported match result needs before it's locked in:

- **None** — results finalize the instant they're reported. Still disputable for 7 days afterward if something was wrong.
- **Auto** — finalizes automatically after an organizer-set delay (1 to 168 hours), unless disputed first. An opponent can also confirm early to finalize immediately.
- **Strict** (the default for new tournaments) — requires explicit confirmation from a player on the opposing side before the result locks in. No timer, no automatic finalization.
- **Admin** — full manual control: only a tournament admin can validate and finalize a reported result.

Layered on top of Auto and Strict, a **Trust Score** system lets the app learn who to rely on: a player with a strong track record of clean, undisputed reports gets their results auto-finalized instantly, skipping the wait entirely. Disputing someone's report resets their trust score, so trust has to be earned back.
