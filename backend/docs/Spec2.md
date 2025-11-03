# 🧩 Modèle de données Skill Arena — version "Tournoi Billard"

## 1. 🧑 Table `app_users`

> Représente un utilisateur fonctionnel dans Skill Arena, relié à un compte BetterAuth **sans dépendance directe** (via un `external_id`).

| Champ          | Type                                                | Description                                              | Contraintes                      |
| -------------- | --------------------------------------------------- | -------------------------------------------------------- | -------------------------------- |
| `id`           | `uuid`                                              | Identifiant interne Skill Arena                          | **PK**, `defaultRandom()`        |
| `external_id`  | `text`                                              | Identifiant de l’utilisateur dans BetterAuth (`user.id`) | **unique**, **not null**         |
| `display_name` | `text`                                              | Nom d’affichage public (par ex. pseudo du joueur)        | **not null**                     |
| `role`         | `enum('player', 'tournament_admin', 'super_admin')` | Type de rôle fonctionnel                                 | **not null**, `default 'player'` |
| `created_at`   | `timestamp`                                         | Date de création                                         | `defaultNow()`                   |
| `updated_at`   | `timestamp`                                         | Dernière mise à jour                                     | `defaultNow()`, `$onUpdate`      |

**Remarques :**

- `external_id` permet la synchronisation avec BetterAuth.
- Les rôles sont **fonctionnels**, pas techniques (gérés dans ton app).
- Un `super_admin` peut gérer tous les tournois.
- Un `tournament_admin` ne gère que les tournois qu’il a créés ou dont il est administrateur.

---

## 2. 🏆 Table `tournaments`

| Champ                          | Type                                        | Description                              | Contraintes                                 |
| ------------------------------ | ------------------------------------------- | ---------------------------------------- | ------------------------------------------- |
| `id`                           | `uuid`                                      | Identifiant du tournoi                   | **PK**, `defaultRandom()`                   |
| `name`                         | `text`                                      | Nom du tournoi                           | **unique**, **not null**                    |
| `description`                  | `text`                                      | Description libre                        | optionnel                                   |
| `mode`                         | `enum('championship','bracket')`            | Type de tournoi                          | **not null**                                |
| `team_mode`                    | `enum('static','flex')`                     | Type de formation d'équipe               | **not null**                                |
| `team_size`                    | `integer`                                   | Taille d’équipe (1 ou 2)                 | **not null**, `check 1<=team_size<=2`       |
| `max_matches_per_player`       | `integer`                                   | Nombre max de matchs par joueur (ex. 10) | **default 10**                              |
| `max_times_with_same_partner`  | `integer`                                   | Limite de matchs avec le même partenaire | **default 2**                               |
| `max_times_with_same_opponent` | `integer`                                   | Limite de matchs avec le même adversaire | **default 2**                               |
| `point_per_victory`            | `integer`                                   | Points pour une victoire                 | **default 3, nullable pour les bracket**    |
| `point_per_draw`               | `integer`                                   | Points pour un match nul                 | **default 1, nullable pour les bracket**    |
| `point_per_loss`               | `integer`                                   | Points pour une défaite                  | **default 0, nullable pour les bracket**    |
| `allow_draw`                   | `boolean`                                   | Autoriser les matchs nuls                | **default true, nullable pour les bracket** |
| `start_date`                   | `date`                                      | Début du tournoi                         | **not null**                                |
| `end_date`                     | `date`                                      | Fin du tournoi                           | **not null**                                |
| `status`                       | `enum('draft','open','ongoing','finished')` | Statut du tournoi                        | **default 'draft'**                         |
| `created_by`                   | `uuid`                                      | Créateur (`app_users.id`)                | **FK**, **not null**                        |
| `created_at`                   | `timestamp`                                 | Création                                 | `defaultNow()`                              |

**Règles métier principales :**

- `start_date < end_date`
- `team_size` ∈ {1, 2}
- `max_matches_per_player = 10` (par défaut pour le championnat)
- `max_times_with_same_opponent = 2`
- `max_times_with_same_partner = 2`
- Les tournois `bracket` référencent le tournoi `championship` via `linked_tournament_id`
- Seuls les `tournament_admin` ou `super_admin` peuvent créer/éditer
- Si les équipes sont static alors classement par équipe, sinon individuel

---

## 3. 👥 Table `tournament_participants`

| Champ            | Type                       | Description                        | Contraintes                           |
| ---------------- | -------------------------- | ---------------------------------- | ------------------------------------- |
| `id`             | `uuid`                     | Identifiant                        | **PK**                                |
| `tournament_id`  | `uuid`                     | Tournoi concerné                   | **FK → tournaments.id**, **not null** |
| `user_id`        | `uuid`                     | Joueur concerné                    | **FK → app_users.id**, **not null**   |
| `team_id`        | `uuid`                     | Équipe (si 2v2)                    | **FK → teams.id**, nullable           |
| `matches_played` | `integer`                  | Nombre de matchs déjà joués        | **default 0**                         |
| `joined_at`      | `timestamp`                | Date d’inscription                 | `defaultNow()`                        |
| **UNIQUE**       | `(tournament_id, user_id)` | Un joueur ne participe qu’une fois |                                       |

**Règles métier :**

- `matches_played <= max_matches_per_player`
- Vérification côté app que les partenaires et adversaires ne dépassent pas les limites définies dans le tournoi

---

## 3. 👥 Table `tournament_admins`

> Lien entre les administrateurs et les tournois.

| Champ           | Type                       | Description                   | Contraintes                        |
| --------------- | -------------------------- | ----------------------------- | ---------------------------------- |
| `id`            | `uuid`                     | Identifiant                   | **PK**                             |
| `tournament_id` | `uuid`                     | Référence du tournoi          | **FK → tournaments.id**            |
| `user_id`       | `uuid`                     | Référence de l’administrateur | **FK → app_users.id**              |
| `role`          | `enum('owner','co_admin')` | Rôle au sein du tournoi       | **not null**, `default 'co_admin'` |
| `added_at`      | `timestamp`                | Date d’ajout                  | `defaultNow()`                     |
| **UNIQUE**      | `(tournament_id, user_id)` | Empêche doublons              |                                    |

**Règles métier :**

- Un tournoi a **au moins un “owner”** (le créateur).
- Un “co_admin” ne peut pas modifier les admins, mais peut gérer les matchs, équipes, etc.

## 4. 🧑‍🤝‍🧑 Table `teams`

> Équipes d’un tournoi (utilisées pour les modes `team` ou `flex`).

| Champ           | Type        | Description          | Contraintes                           |
| --------------- | ----------- | -------------------- | ------------------------------------- |
| `id`            | `uuid`      | Identifiant          | **PK**                                |
| `tournament_id` | `uuid`      | Référence tournoi    | **FK → tournaments.id**, **not null** |
| `name`          | `text`      | Nom d’équipe         | **not null**, **unique par tournoi**  |
| `hash`          | `text`      | Hash de l’équipe     | **not null**, **unique par tournoi**  |
| `created_by`    | `uuid`      | Créateur de l’équipe | **FK → app_users.id**                 |
| `created_at`    | `timestamp` | Création             | `defaultNow()`                        |

---

## 4. ⚔️ Table `matches`

| Champ             | Type                                                                                     | Description                         | Contraintes                           |
| ----------------- | ---------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------- |
| `id`              | `uuid`                                                                                   | Identifiant du match                | **PK**                                |
| `tournament_id`   | `uuid`                                                                                   | Référence tournoi                   | **FK → tournaments.id**, **not null** |
| `round`           | `integer`                                                                                | Numéro du tour                      | nullable (utile pour bracket)         |
| `team_a_id`       | `uuid`                                                                                   | Équipe A                            | **FK → teams.id**                     |
| `team_b_id`       | `uuid`                                                                                   | Équipe B                            | **FK → teams.id**                     |
| `score_a`         | `integer`                                                                                | Score équipe A                      | `default 0`                           |
| `score_b`         | `integer`                                                                                | Score équipe B                      | `default 0`                           |
| `winner_id`       | `uuid`                                                                                   | Équipe gagnante                     | **FK → teams.id**, nullable           |
| `status`          | `enum('scheduled','reported','pending_confirmation','confirmed','disputed','cancelled')` | État du match                       | **default 'scheduled'**               |
| `reported_by`     | `uuid`                                                                                   | Joueur ayant saisi le score         | nullable                              |
| `reported_at`     | `timestamp`                                                                              | Date de saisie du score             | nullable                              |
| `confirmation_by` | `uuid`                                                                                   | Joueur ayant confirmé               | nullable                              |
| `confirmation_at` | `timestamp`                                                                              | Date de confirmation                | nullable                              |
| `report_proof`    | `text`                                                                                   | Lien ou méta (photo, capture, etc.) | nullable                              |
| **UNIQUE**        | `(tournament_id, team_a_id, team_b_id)`                                                  | Empêche doublons                    |                                       |

**Règles métier :**

- Un match ne peut être créé que si aucun des joueurs n’a dépassé ses limites (`max_matches_per_player`, partenaires/adversaires).
- Lors de la création d'un match, si un des joueurs n'a pas encore atteint `max_matches_per_player` mais a des match en attente non confirmés, l'app doit prévenir le joueur.
- Lors de la validation (`status = confirmed`), incrémenter `matches_played` pour les joueurs concernés et mettre à jour le classement.

---

## 5. 📊 Table `championship_standings`

| Champ            | Type        | Description            |
| ---------------- | ----------- | ---------------------- |
| `id`             | `uuid`      | Identifiant            |
| `tournament_id`  | `uuid`      | Tournoi associé        |
| `user_id`        | `uuid`      | Joueur concerné        |
| `points`         | `integer`   | Total de points        |
| `wins`           | `integer`   | Matchs gagnés          |
| `losses`         | `integer`   | Matchs perdus          |
| `draws`          | `integer`   | Matchs nuls            |
| `matches_played` | `integer`   | Nombre de matchs joués |
| `last_updated`   | `timestamp` | Dernière maj           |

> Sert de base pour sélectionner les 8 meilleurs pour la phase 2 (bracket).

---

## 8. 💬 Saisie et validation des résultats

Workflow :

1. Le joueur A saisit le score (`reported_by`, `reported_at`, `status='reported'`) et peut le modifier tant que ce n'est pas confirmé.
2. Le joueur B confirme (`confirmation_by`, `confirmation_at`, `status='confirmed'`).
3. Si pas de confirmation sous 48h → auto-confirmation par le système.
4. En cas de désaccord → `status='disputed'` et notification à un `tournament_admin`.
5. Après confirmation → mise à jour de `standings` et `matches_played`.

---
