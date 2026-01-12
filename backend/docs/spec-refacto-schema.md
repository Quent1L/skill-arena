Parfait.
Je te réécris **le schéma refactorisé complet**, **cohérent**, **orienté “plateforme de tournois”**, en tenant **explicitement compte de Mario Kart (FFA, classement, multi-manches)** **sans sur-ingénierie**.

Je vais être **très rigoureux** :

* chaque table a **une responsabilité claire**
* aucune donnée métier critique en JSONB
* les règles variables (points, formats) sont **pilotées par la discipline**

---

# 🎯 Objectifs du schéma final

Ce schéma permet de gérer **sans changement structurel** :

| Type                            | Supporté |
| ------------------------------- | -------- |
| Duel 1v1                        | ✅        |
| Équipe fixe                     | ✅        |
| Partenaires variables           | ✅        |
| Free For All (Mario Kart)       | ✅        |
| Championnat                     | ✅        |
| Bracket simple / double         | ✅        |
| Matchs multi-manches (GP, BO3…) | ✅        |

---

# 1️⃣ Disciplines & règles de scoring

## disciplines

```sql
CREATE TABLE disciplines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,

  -- capacités fonctionnelles
  max_participants_per_match int4 NOT NULL,
  supports_teams boolean NOT NULL DEFAULT false,
  supports_draw boolean NOT NULL DEFAULT false,
  uses_ranking boolean NOT NULL DEFAULT false,
  supports_multi_games boolean NOT NULL DEFAULT false
);
```

👉 Mario Kart :

* `max_participants_per_match = 12`
* `uses_ranking = true`
* `supports_multi_games = true`

---

## scoring_rules (Mario Kart, championnat, etc.)

```sql
CREATE TABLE scoring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discipline_id uuid NOT NULL,
  position int4 NOT NULL,
  points int4 NOT NULL,

  UNIQUE (discipline_id, position),
  FOREIGN KEY (discipline_id) REFERENCES disciplines(id) ON DELETE CASCADE
);
```

---

# 2️⃣ Tournoi

```sql
CREATE TABLE tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  discipline_id uuid NOT NULL,

  mode tournament_mode NOT NULL, -- championship / bracket / hybrid
  team_mode team_mode NOT NULL,

  start_date date NOT NULL,
  end_date date NOT NULL,
  status tournament_status NOT NULL DEFAULT 'draft',

  created_by uuid NOT NULL,
  created_at timestamp DEFAULT now(),

  FOREIGN KEY (discipline_id) REFERENCES disciplines(id),
  FOREIGN KEY (created_by) REFERENCES app_users(id)
);
```

---

# 3️⃣ Participants du tournoi (clé du modèle)

## tournament_entries

```sql
CREATE TABLE tournament_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL,
  entry_type text CHECK (entry_type IN ('PLAYER', 'TEAM')) NOT NULL,
  team_id uuid NULL,

  created_at timestamp DEFAULT now(),

  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,

  CHECK (
    (entry_type = 'PLAYER' AND team_id IS NULL)
    OR
    (entry_type = 'TEAM' AND team_id IS NOT NULL)
  )
);
```

---

## tournament_entry_players

```sql
CREATE TABLE tournament_entry_players (
  entry_id uuid NOT NULL,
  player_id uuid NOT NULL,

  PRIMARY KEY (entry_id, player_id),

  FOREIGN KEY (entry_id) REFERENCES tournament_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES app_users(id) ON DELETE CASCADE
);
```

👉 Mario Kart :
1 entry = 1 player
👉 Padel double :
1 entry = 2 players
👉 Team esport :
1 entry = N players

---

# 4️⃣ Structure du tournoi

## stages

```sql
CREATE TABLE stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL,
  name text NOT NULL,
  stage_type text NOT NULL, -- group / bracket / final
  settings jsonb NOT NULL,

  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);
```

---

## groups

```sql
CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL,
  group_number int4 NOT NULL,

  FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE
);
```

---

## rounds

```sql
CREATE TABLE rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL,
  group_id uuid NULL,
  round_number int4 NOT NULL,

  FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);
```

---

# 5️⃣ Match (structure pure)

```sql
CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL,
  stage_id uuid NOT NULL,
  group_id uuid NULL,
  round_id uuid NULL,

  match_number int4 NOT NULL,
  scheduled_at timestamp NULL,

  status match_status NOT NULL DEFAULT 'scheduled',

  -- Bracket graph
  bracket_type bracket_type NULL,
  next_match_win_id uuid NULL,
  next_match_lose_id uuid NULL,

  created_at timestamp DEFAULT now(),

  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
  FOREIGN KEY (next_match_win_id) REFERENCES matches(id),
  FOREIGN KEY (next_match_lose_id) REFERENCES matches(id)
);
```

---

# 6️⃣ Qui joue le match (clé Mario Kart)

## match_sides

```sql
CREATE TABLE match_sides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  entry_id uuid NOT NULL,

  -- sens :
  -- duel: position = 1 / 2
  -- mario kart: position = classement final
  position int4 NOT NULL,

  score int4 NULL,
  points_awarded int4 NULL,

  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (entry_id) REFERENCES tournament_entries(id) ON DELETE CASCADE,

  UNIQUE (match_id, entry_id)
);
```

✔️ 2 joueurs ou 12
✔️ classement ou duel
✔️ compatible bracket & championnat

---

# 7️⃣ Match multi-manches (Grand Prix, BO3…)

## match_games

```sql
CREATE TABLE match_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  game_number int4 NOT NULL,

  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  UNIQUE (match_id, game_number)
);
```

---

## match_game_sides

```sql
CREATE TABLE match_game_sides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_game_id uuid NOT NULL,
  entry_id uuid NOT NULL,

  position int4 NOT NULL,
  score int4 NULL,

  FOREIGN KEY (match_game_id) REFERENCES match_games(id) ON DELETE CASCADE,
  FOREIGN KEY (entry_id) REFERENCES tournament_entries(id) ON DELETE CASCADE,

  UNIQUE (match_game_id, entry_id)
);
```

👉 Mario Kart :

* game = course
* match = GP
* agrégation → `match_sides`

---

# 8️⃣ Validation & arbitrage

## match_results

```sql
CREATE TABLE match_results (
  match_id uuid PRIMARY KEY,
  reported_by uuid NULL,
  reported_at timestamp NULL,
  finalized_by uuid NULL,
  finalized_at timestamp NULL,

  outcome_type_id uuid NULL,
  outcome_reason_id uuid NULL,

  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (reported_by) REFERENCES app_users(id),
  FOREIGN KEY (finalized_by) REFERENCES app_users(id),
  FOREIGN KEY (outcome_type_id) REFERENCES outcome_types(id),
  FOREIGN KEY (outcome_reason_id) REFERENCES outcome_reasons(id)
);
```

---

## match_confirmations

```sql
CREATE TABLE match_confirmations (
  match_id uuid NOT NULL,
  player_id uuid NOT NULL,

  is_confirmed boolean DEFAULT false,
  is_contested boolean DEFAULT false,
  contestation_reason text NULL,

  PRIMARY KEY (match_id, player_id),

  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES app_users(id) ON DELETE CASCADE
);
```

---

# 9️⃣ Classement championnat (projection assumée)

```sql
CREATE TABLE championship_standings (
  tournament_id uuid NOT NULL,
  entry_id uuid NOT NULL,

  points int4 NOT NULL DEFAULT 0,
  wins int4 NOT NULL DEFAULT 0,
  draws int4 NOT NULL DEFAULT 0,
  losses int4 NOT NULL DEFAULT 0,
  matches_played int4 NOT NULL DEFAULT 0,

  PRIMARY KEY (tournament_id, entry_id),

  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY (entry_id) REFERENCES tournament_entries(id) ON DELETE CASCADE
);
```

---

# 🧠 Verdict final (sans langue de bois)

✔️ Ce schéma :

* est **suffisamment générique**
* **sans devenir abstrait inutilement**
* permet Mario Kart **sans hack**
* reste compréhensible pour un dev dans 1 an

🚨 **Le point clé à respecter absolument** :

> `tournament_entries` est **la seule entité qui “joue”**

Si tu casses ça, tout devient flou.

