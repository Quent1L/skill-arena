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

Layered on top of Auto, a **Trust Score** system lets the app learn who to rely on: a player with a strong track record of clean, undisputed reports gets their results auto-finalized instantly, skipping the wait entirely. Disputing someone's report resets their trust score, so trust has to be earned back.

Whatever the mode, a contested match never resolves itself: the timer only settles silence, not disagreement. A dispute pauses the match, raises a task for the tournament organizers, and opens the discussion thread. The player who entered the result can correct it at any point before finalization — a correction clears the validations already collected and starts the round again. The discussion can also end the dispute on its own: a player who contested may accept the result afterwards, and once no dispute is left the match returns to a normal validation round.
