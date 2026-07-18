---
title: Ranked mode
summary: A real Elo-derivative MMR ladder — dynamic tiers, per-discipline team scoring, instant feedback on every match.
order: 0
icon: trophy
pillar: ranked
---

Ranked isn't a leaderboard bolted onto a bracket — it's a full competitive ladder system, season over season.

### Real MMR, tuned per season

Every ranked season runs on an Elo-derivative rating: each match's outcome is compared against what was _expected_ given both sides' current MMR, and ratings adjust accordingly. Organizers tune two knobs per season — a base MMR (where new players start) and a K-factor (how fast ratings move) — and a **placement phase**: a player's first several matches run at double K-factor, so their rating converges to an accurate level fast instead of drifting slowly over dozens of games.

### Team scoring that adapts to the discipline

Team-based disciplines don't all work the same way, so Ranked doesn't force one formula on everyone. Each discipline picks how a team's result is distributed to individual MMR:

- **Individual** — teammates are scored on their own merit. A losing player who was personally stronger than the opposing average loses more; a weaker teammate on a losing team is shielded.
- **Shared Resource** — the inverse: on a loss, the individually _weaker_ teammate absorbs more of the penalty (the "weak link" effect), while a strong carry is shielded.
- **Collaborative** — full shared blame. Every losing teammate takes the exact same flat penalty, win or lose together.

Across all three modes, winning always rewards the biggest personal underdog on the winning team the most — upsets pay off.

On top of that, each discipline's **outcome types** (see Disciplines & outcomes) can amplify or dampen the official MMR change with a multiplier, or turn MMR off entirely for a given result — a forfeit doesn't have to touch anyone's rating.

### Tiers that move with the population

Rank tiers aren't fixed MMR bands — they're percentile-based, and recalculated automatically as the player pool shifts. The default ladder has five tiers (Rookie, Challenger, Confirmé, Expert, and Légende for the top 5%), fully customizable, and a new season can clone an existing season's tier structure instead of starting from scratch.

### Instant feedback, confirmed result

The moment a match is reported, players see a live MMR estimate on a provisional leaderboard — no waiting. Once the match is finalized, the official change locks in. Along the way, the app celebrates tier-ups and flags standout moments with contextual match labels: **Rookie Protection** for new players facing much stronger opposition, **Exploit** for a genuine underdog win, and **Favorite Status** when the odds were clearly in your favor.

### Built for fairness over time

- **Season soft-reset** — carry MMR into a new season pulled halfway back toward the base rating, instead of a jarring hard reset.
- **48-hour reporting window** — ranked results must be reported within 48 hours of being played, keeping the ladder honest.
- **Auto-enrollment** — a player's very first ranked match creates their ladder entry automatically at the season's base MMR. No separate sign-up step.
- **Cascade recalculation** — cancelling a finalized match automatically ripples a recalculation through every match and player affected downstream, so the season's history stays consistent even after the fact.
