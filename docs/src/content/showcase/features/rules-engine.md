---
title: Contextual rules engine
summary: Live badges and messages that react to what's happening in the tournament.
order: 8
icon: bolt
badge: Beta
pillar: platform
---

A configurable rules engine surfaces contextual messages and badges based on
match and tournament state — delivered live over WebSocket, so players see what
matters the moment it happens.

This feature is actively evolving and currently ships as **beta**: today it only
reacts when a match is submitted (more triggers are planned), and editing a rule
doesn't instantly re-score past matches — badge recalculation runs as a nightly
batch job rather than live.
