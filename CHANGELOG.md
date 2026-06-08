# Changelog

## [1.12.2](https://github.com/Quent1L/skill-arena/compare/1.12.1...1.12.2) (2026-06-08)

### 🐛 Correctifs

* **ranked:** disable swipe to provisional when showModeToggle is false ([4a32502](https://github.com/Quent1L/skill-arena/commit/4a32502f159e544b34018282f91e9504870eb26f))
* **ranked:** fix provisional leaderboard streak/order divergence ([1faae3a](https://github.com/Quent1L/skill-arena/commit/1faae3a53df36bea1189f5eab26024a2983e6f08))

## [1.12.1](https://github.com/Quent1L/skill-arena/compare/1.12.0...1.12.1) (2026-06-07)

### 🐛 Correctifs

* **ranked:** show all outcome types regardless of match count ([41dc149](https://github.com/Quent1L/skill-arena/commit/41dc149742ce687a6850fb556f13268f265c496e))

### ♻️ Refactoring

* **stats:** replace doughnut chart with MatchOutcomeDistribution ([57d15bb](https://github.com/Quent1L/skill-arena/commit/57d15bb3e639de9249b4d5c7dbe1b8673e989f1b))

## [1.12.0](https://github.com/Quent1L/skill-arena/compare/1.11.1...1.12.0) (2026-06-05)

### ✨ Nouvelles fonctionnalités

* **ranked:** add outcome distribution to player MMR profile ([ae55f2d](https://github.com/Quent1L/skill-arena/commit/ae55f2d2661f3a5069df69a8dc0b5dc3edd21872))

### 🐛 Correctifs

* **match:** drag-and-drop crashes on mobile when long-press ([f58a5f7](https://github.com/Quent1L/skill-arena/commit/f58a5f7d9d712cfd1b67692a2a4f8474983e1184))
* **player:** carry tournamentId in players stats link ([14d14d3](https://github.com/Quent1L/skill-arena/commit/14d14d340ac171a0eeba5703768d3c38bb2810fe))
* **ranked:** reload animation queue on mobile reconnect ([2816645](https://github.com/Quent1L/skill-arena/commit/2816645f512cdb508cbee07dec8caab5e061d6a7))
* **router:** redirect authenticated users away from /login ([d1008b1](https://github.com/Quent1L/skill-arena/commit/d1008b1346bdf99173fa34a32511a7024b84bd90))

### 🔧 Maintenance

* **deps:** bump all dependencies across workspaces ([4cfe50d](https://github.com/Quent1L/skill-arena/commit/4cfe50d58ff959eefa07e0fcac52ceb95319a28a))

## [1.11.1](https://github.com/Quent1L/skill-arena/compare/1.11.0...1.11.1) (2026-05-31)

### 🐛 Correctifs

* **player:** replace v-tooltip with Popover on RecentFormSection info icon ([a08cfc4](https://github.com/Quent1L/skill-arena/commit/a08cfc4023f8472d38eefa5cf71d3517f0c5dc4a))
* **ranked:** prevent winStreak/recentResults mismatch on leaderboard ([2c96bfb](https://github.com/Quent1L/skill-arena/commit/2c96bfb8ffdebe1ba966b8f225bb4c42a5d53f44))

## [1.11.0](https://github.com/Quent1L/skill-arena/compare/1.10.0...1.11.0) (2026-05-31)

### ✨ Nouvelles fonctionnalités

* **ux:** suppress non-error toasts on mobile ([0b9cc4d](https://github.com/Quent1L/skill-arena/commit/0b9cc4d6d494b444200b2b0199376dc2d9b3f24d))

### 🐛 Correctifs

* **pwa:** make dismiss button reactively hide install banner ([ff46cb0](https://github.com/Quent1L/skill-arena/commit/ff46cb00a7f3a069a94271e96af46258e29e9073))
* **ranked:** prevent no-MMR flash while player profile loads ([96ee980](https://github.com/Quent1L/skill-arena/commit/96ee98006bc35f33e3a4f43edcab6da9ec35a173))

### 🔧 Maintenance

* **docker:** cache bun install packages between builds ([5887c51](https://github.com/Quent1L/skill-arena/commit/5887c51cb7fe286962bde10f7b3a35b6741678dd))
* **release:** prevent release-it from bumping package.json ([7d70bc1](https://github.com/Quent1L/skill-arena/commit/7d70bc16632c6fbe7f7d18fcc3a9ce3582e3252a))

## [1.10.0](https://github.com/Quent1L/skill-arena/compare/1.9.0...1.10.0) (2026-05-31)

### ✨ Nouvelles fonctionnalités

* **stats:** add 5 new player stat sections ([2382d4b](https://github.com/Quent1L/skill-arena/commit/2382d4bdff675997b2b57637d1a5dc106493f2c8))
* **tournament:** refresh data on WS reconnect and leaderboard update ([1500ae8](https://github.com/Quent1L/skill-arena/commit/1500ae89bffb8dbef649db2d790fc32db3958681))
* **ux:** show update overlay before SW-triggered reload ([1a7a967](https://github.com/Quent1L/skill-arena/commit/1a7a96791a44aaf2037fe26bff25d785e6fca459))

### 🐛 Correctifs

* **mobile:** load player profile on stats tab refresh ([5289efe](https://github.com/Quent1L/skill-arena/commit/5289efe7cfabc6d4b9b8919636fe76949db27b86))

### ⚡ Performances

* **player-stats:** cache per-tournament stats in player_computed_data ([4e7eb2c](https://github.com/Quent1L/skill-arena/commit/4e7eb2c0508d559fd1bef40e7aa0d2c343e9fa9a))

### ♻️ Refactoring

* extract helpers and dedupe across stats/match logic ([29e5d28](https://github.com/Quent1L/skill-arena/commit/29e5d283d5cceb79faa2edb0a83044c52c8f6838))
* **player:** extract stat sections + add discipline filter ([1505ba6](https://github.com/Quent1L/skill-arena/commit/1505ba68cb290b000343d9a9278bae538d3b3322))

### 🎨 Style

* **stats:** modify grid of filter on PlayerStat ([fc7251d](https://github.com/Quent1L/skill-arena/commit/fc7251dfb435a2bb9b7fd78e4d6395619615ded4))

## [1.9.0](https://github.com/Quent1L/skill-arena/compare/1.8.1...1.9.0) (2026-05-26)

### ✨ Nouvelles fonctionnalités

* **mobile:** add clearable search in PlayerPickerDialog ([fea6072](https://github.com/Quent1L/skill-arena/commit/fea6072df8da205bc7443a2c78e20d614c766a50))
* **stats:** add solo & asymmetric solo player rankings ([510f3fd](https://github.com/Quent1L/skill-arena/commit/510f3fdc173f0e0651f5b64f7a2f0b91304ef325))
* **tournament:** add admin cache-clear action ([2b569ef](https://github.com/Quent1L/skill-arena/commit/2b569eff9160f93676e2e53fc65b484c9cb7c0cb))

### 🐛 Correctifs

* **mobile:** link players stats into RankedLeaderboard ([f77e3a2](https://github.com/Quent1L/skill-arena/commit/f77e3a2bf82e0867e0da1e1b670fdc695ce40ed0))

### 🔧 Maintenance

* add release-it ([716f132](https://github.com/Quent1L/skill-arena/commit/716f132386e2c8bd3ff6a4d9fb6e0e2a071006b8))
