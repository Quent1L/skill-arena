---
layout: ../../layouts/DocsLayout.astro
title: Disciplines & Scoring
description: Configure the games you play once, then define exactly how their results score, rank and reward.
---

A discipline describes what is being played. Everything that scores a match — points,
outcome types, MMR weighting — hangs off it, so it is configured once and reused by every
bracket, championship and ranked season.

## Disciplines and outcome types

A **discipline** is the game or activity being played — chess, foosball, a video game,
anything. Admins configure a discipline once (name, icon, scoring instructions) and reuse it
across every bracket, championship, or ranked season.

- **Team scoring mode** — each discipline picks a team interaction mode that decides how a
  team's result affects each teammate's ranked MMR: _Individual_, _Shared Resource_, or
  _Collaborative_. See [MMR Rating](/docs/mmr) for exactly how each one plays out.
- **Outcome types** — each discipline defines its own set of outcome types (there's no fixed
  list — create "Normal", "Forfeit", "Walkover", whatever fits). Every outcome type carries:
  - **Points** — its weight in championship standings ("victory quality").
  - **MMR multiplier** — scales how much the official ranked MMR change is amplified or
    dampened.
  - **Counts for MMR** — a simple on/off switch. Turn it off for outcomes like a forfeit, and
    the match is recorded but nobody's rating moves.
- **Outcome reasons** — optional sub-labels under a parent outcome type, for finer
  record-keeping (e.g. "Forfeit" → "No-show" or "Injury withdrawal"). Reasons don't carry
  their own scoring — they inherit whatever points, multiplier, and MMR toggle their parent
  outcome type has.

Championships and brackets also have a simple, flat points system (points per victory / draw
/ loss) for standings — separate from the per-outcome weighting above, and always available
even without any custom outcome types configured.

## Game rules pages

Admins write tournament rules with a full WYSIWYG editor and link them to any tournament.
Players get a clean, always-current rules page — no more PDFs buried in a Discord channel.

## Contextual rules engine

A configurable rules engine surfaces contextual messages and badges based on match and
tournament state — delivered live over WebSocket, so players see what matters the moment it
happens.

Badges are season trophies by default: each new season puts them back up for grabs, and a
player's profile shows how many times they have won each one and in which seasons. A badge
meant to be earned once in a lifetime can be marked as such instead.

This feature is actively evolving and currently ships as **beta**: today it only reacts when
a match is submitted (more triggers are planned), and editing a rule doesn't instantly
re-score past matches — badge recalculation runs as a nightly batch job rather than live.
