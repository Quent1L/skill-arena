---
title: Disciplines & outcomes
summary: Configure the games you play once, then define exactly how results score.
order: 1
icon: layers
---

A **discipline** is the game or activity being played — chess, foosball, a video game, anything. Admins configure a discipline once (name, icon, scoring instructions) and reuse it across every bracket, championship, or ranked season.

- **Team scoring mode** — each discipline picks a team interaction mode that decides how a team's result affects each teammate's Ranked MMR: _Individual_, _Shared Resource_, or _Collaborative_. See the **Ranked mode** section for exactly how each one plays out.
- **Outcome types** — each discipline defines its own set of outcome types (there's no fixed list — create "Normal", "Forfeit", "Walkover", whatever fits). Every outcome type carries:
  - **Points** — its weight in championship standings ("victory quality") and in Ranked's live MMR preview.
  - **MMR multiplier** — scales how much the official Ranked MMR change is amplified or dampened.
  - **Counts for MMR** — a simple on/off switch. Turn it off for outcomes like a forfeit, and the match is recorded but nobody's rating moves.
- **Outcome reasons** — optional sub-labels under a parent outcome type, for finer record-keeping (e.g. "Forfeit" → "No-show" or "Injury withdrawal"). Reasons don't carry their own scoring — they inherit whatever points, multiplier, and MMR toggle their parent outcome type has.

Championships and brackets also have a simple, flat points system (points per victory / draw / loss) for standings — separate from the per-outcome weighting above, and always available even without any custom outcome types configured.
