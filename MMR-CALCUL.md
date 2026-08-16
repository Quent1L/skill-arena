# Calcul du MMR — récapitulatif

Portée : mode `ranked` uniquement (`tournaments.mode === "ranked"`). Un tournoi
classique n'écrit jamais de MMR.

Sources :

- `backend/src/services/mmr-engine.ts` — **le** moteur, fonction pure sans accès DB
- `backend/src/services/mmr-calculation.service.ts` — persistance et recalculs
- `backend/src/services/mmr-animation-event.service.ts` — aperçu avant validation
- `backend/src/services/ranked-season.service.ts` — leaderboard provisoire + soft reset
- `backend/src/workers/mmr-recalculation.worker.ts` — déclencheurs asynchrones

Principe directeur : **un match transfère du MMR d'un camp à l'autre, il n'en crée
pas.** Le calcul se fait en deux temps strictement séparés — d'abord *à quel point
le résultat était attendu* (Elo sur les moyennes d'équipe → un delta d'équipe),
ensuite *qui en prend quelle part* (`teamInteractionMode` → parts normalisées).

---

## 1. Les paramètres qui influent sur le calcul

### Niveau saison (`ranked_season_configs`)

| Champ | Plage | Effet |
|---|---|---|
| `baseMmr` | 100–5000 | MMR de départ d'un joueur sans historique ni report |
| `kFactor` | 8–128 | Amplitude de base du delta d'équipe |
| `placementMatches` | 0–20 | Nombre de matchs où le delta du joueur est **doublé** |
| `usePreviousMmr` | bool | Active le report du MMR de la saison précédente |
| `softResetFactor` | 0–1 | Part de l'écart à la médiane source conservée |
| `sourceMmrSeasonId` | uuid/null | Saison source du report (null = dernière saison terminée de la discipline) |
| `sourceTierSeasonId` + `tierScalingMode` | `keep` \| `percentile` | Recopie ou recalcule les seuils de paliers — n'affecte **pas** le MMR, seulement le rang affiché |
| `allowAsymmetricMatches` | bool | Autorise des effectifs déséquilibrés (1v2…). Aucune compensation MMR : voir §8 |

### Niveau discipline (`disciplines`)

| Champ | Valeurs | Effet |
|---|---|---|
| `teamInteractionMode` | `INDIVIDUAL` \| `SHARED_RESOURCE` \| `COLLABORATIVE` | Répartition du delta d'équipe entre coéquipiers (§3). `null` → `COLLABORATIVE` |

### Niveau type de résultat (`outcome_types`, rattaché à une discipline)

| Champ | Défaut | Effet |
|---|---|---|
| `scoreCountsForMmr` | true | `false` → **delta 0 pour tout le monde** (sortie anticipée) ; `true` → le score amplifie `K` |
| `mmrMultiplier` | 1 | Multiplie le delta d'équipe (0 = match sans impact, 2 = double) |
| `points` | 3 | Points de championnat. **Aucun effet sur le MMR** |

### Constantes du moteur (`mmr-engine.ts`)

| Constante | Valeur | Rôle |
|---|---|---|
| `WEIGHT_CLAMP_MIN` / `MAX` | 0.75 / 1.25 | Bornes du ratio de niveau utilisé pour pondérer les parts |
| `MODE_ALPHA` | 0 / 0.5 / 1 | Intensité de la pondération par mode |
| `PLACEMENT_MULTIPLIER` | 2 | Accélération pendant le placement |
| `MIN_MMR` | 1 | Plancher du MMR |

---

## 2. Le calcul officiel

```
1. Court-circuit   scoreCountsForMmr === false → tous les deltas à 0
2. Moyennes        avgA, avgB = moyenne arithmétique des MMR de chaque côté
3. Score attendu   E_A = 1 / (1 + 10^((avgB − avgA)/400))
4. K effectif      kEff = kFactor × scoreMult × mmrMultiplier
                   scoreMult = 1 + |scoreA − scoreB| / (scoreA + scoreB)   ∈ [1, 2]
5. Delta d'équipe  teamDeltaA = round(kEff × (W_A − E_A))
                   teamDeltaB = −teamDeltaA        ← posé, pas recalculé
6. Parts           share_i par côté, Σ share = 1   (§3)
7. Allocation      entiers par plus fort reste, somme exacte (§4)
8. Placement       delta_i ×2 si le joueur est en placement
9. Plancher        newMmr = max(1, mmr + delta)
```

`W` vaut 1 (victoire), 0 (défaite) ou 0.5 (nul). L'amplification par le score va
de ×1 (score égal, 0-0, ou score absent) à ×2 (blanchissage) et dépend de l'écart,
pas du vainqueur — les deux camps la subissent identiquement.

`teamDeltaB` est **posé** égal à `−teamDeltaA` au lieu d'être recalculé depuis
`E_B` : c'est ce qui fait que les deux côtés s'annulent exactement, `Math.round`
n'étant pas symétrique sur les demis (`round(2.5) = 3` mais `round(−2.5) = −2`).

---

## 3. Variation par discipline : `teamInteractionMode`

Seul levier de calcul porté par la discipline. Il n'intervient qu'à l'étape 6 :
il ne change **jamais** la force du résultat, seulement sa répartition.

### 3.1. Formule des parts

```ts
r_i     = clamp(oppAvgMmr / max(1, mmr_i), 0.75, 1.25)
sign    = teamDelta >= 0 ? +1 : −1
exp     = mode === 'INDIVIDUAL' ? MODE_ALPHA.INDIVIDUAL × sign : MODE_ALPHA[mode]
w_i     = r_i ^ exp
share_i = w_i / Σ w
```

Une seule formule, trois α :

| Mode | α | Exposant en victoire | Exposant en défaite |
|---|---|---|---|
| `COLLABORATIVE` | 0 | 0 | 0 |
| `SHARED_RESOURCE` | 0.5 | +0.5 | +0.5 |
| `INDIVIDUAL` | 1 | +1 | **−1** |

`COLLABORATIVE` avec α = 0 donne `w = 1` pour tout le monde, donc `share = 1/n` :
la répartition égale n'est pas un cas particulier, c'est le cas dégénéré de la
formule générale.

### 3.2. Les 3 modes lus comme des courbes

| Mode | Comportement | Disciplines visées |
|---|---|---|
| `COLLABORATIVE` | Parts strictement égales, quel que soit le MMR individuel. | Sports d'équipe, MOBA, FPS — la défaite est collective. |
| `SHARED_RESOURCE` | Le moins bien classé prend la plus grosse part, **en victoire comme en défaite**. Volatilité indexée sur le niveau. | Pétanque en double, formats où chacun dispose d'une part comparable de la ressource commune. |
| `INDIVIDUAL` | Exposant inversé en défaite : le faible gagne plus **et** perd moins, le fort gagne moins **et** perd plus. Force de rappel vers le niveau adverse. | Fléchettes, billard, bowling — chacun joue sa partie, le fort assume sa défaite. |

### 3.3. Effet en 1v1 : aucun

`n = 1` → `share = 1` → `delta = teamDelta`, quel que soit le mode. L'invariance
est structurelle, il n'y a aucune branche `if (n === 1)` dans le moteur.

### 3.4. Chiffré — 2v2 {900, 1400} contre {1150, 1150}

`avg = 1150` des deux côtés → `E = 0.5`, `kEff = 32` → `teamDelta = ±16`, partagé
entre les deux joueurs.

| Cas | p900 | p1400 | Adversaires |
|---|---|---|---|
| Victoire, `COLLABORATIVE` | +8 | +8 | −8 / −8 |
| Victoire, `SHARED_RESOURCE` | +9 | +7 | −8 / −8 |
| Victoire, `INDIVIDUAL` | +10 | +6 | −8 / −8 |
| Défaite, `COLLABORATIVE` | −8 | −8 | +8 / +8 |
| Défaite, `SHARED_RESOURCE` | −9 | −7 | +8 / +8 |
| Défaite, `INDIVIDUAL` | **−6** | **−10** | +8 / +8 |

La dernière ligne est ce qui distingue `INDIVIDUAL` de `SHARED_RESOURCE` : même
équipe, même match, responsabilités inversées.

**Conséquence d'échelle** : en 2v2, chaque joueur encaisse la moitié du delta
d'équipe. Le MMR bouge donc deux fois moins vite par match qu'en 1v1 — c'est le
prix de la conservation, et le `kFactor` de la saison est le levier pour le
compenser si besoin.

---

## 4. Un seul moteur, trois chemins

Les trois chemins appellent `calculateMatchMmr()` et ne diffèrent **que par le
snapshot de MMR** qu'ils lui fournissent. La parité est vérifiée par un test
dédié (`backend/src/services/__tests__/mmr-parity.test.ts`).

| | A. Officiel | B. Aperçu par match | C. Leaderboard provisoire |
|---|---|---|---|
| Point d'entrée | `mmr-calculation.service` | `mmr-animation-event.service` | `ranked-season.service.replayMatch` |
| Déclencheur | Match finalisé / annulé / recalcul | Match `reported`, avant validation | Matchs non finalisés, cache provisoire |
| Snapshot | Historique du match, puis MMR courant | MMR courant | MMR courant, avancé match après match |
| Persisté | `player_mmr` + `mmr_history` | `mmr_animation_events` (`provisional`) | cache leaderboard |
| Moyennes d'équipe | oui | oui | oui |
| `mmrMultiplier` | oui | oui | oui |
| `teamInteractionMode` | oui | oui | oui |
| Placement (delta ×2) | oui | oui | oui |
| `scoreCountsForMmr = false` | delta 0 | delta 0 | delta 0 |

Autrement dit : le delta affiché avant validation est, par construction, celui qui
sera appliqué à la finalisation.

L'arrondi est déterministe : allocation par **plus fort reste**, départage des
restes égaux par `playerId` croissant. L'ordre d'itération des joueurs n'influe
donc sur aucun résultat — condition nécessaire au rejeu déterministe de saison.

---

## 5. Départ de saison : report et soft reset

`syncMmrSeeds()` remplit `season_mmr_seeds` (jamais `player_mmr` : un joueur seedé
qui ne joue pas ne doit apparaître ni au classement ni dans les percentiles).

```
éligibles = joueurs de la saison source avec matchsJoués ≥ max(1, placementMatches source)
ancre     = médiane des MMR courants des éligibles
seed      = max(1, round(baseMmr + (mmr − ancre) × softResetFactor))
```

- `usePreviousMmr = false` → aucun seed, tout le monde démarre à `baseMmr`.
- `softResetFactor = 0` → reset dur ; `= 1` → écart à la médiane conservé, recentré.
- Médiane et non moyenne : quelques joueurs en fuite ne doivent pas tirer le point
  de reset de toute la ladder.

Ordre de résolution du MMR d'entrée, partout dans le moteur :

```
historique du match  →  MMR courant  →  seed de report  →  baseMmr
```

---

## 6. Recalculs

| Cas | Méthode | Portée |
|---|---|---|
| Match finalisé | `processMatchFinalization` | Participants directs à partir de `playedAt`, puis propagation en vagues |
| Match annulé | `cascadeRecalculateAfterCancellation` | Idem, tag `match_cancelled` |
| Recalcul forcé (admin) | `recalculateSeasonMmrDeterministic` | Toute la saison, rejeu chronologique global |

La cascade existe parce qu'un match antidaté réécrit l'historique de joueurs qui
n'y participaient pas : elle recalcule par vagues successives tous ceux qui ont
croisé un joueur dont le MMR a bougé, jusqu'à stabilisation.

Le rejeu déterministe traite chaque match une seule fois dans l'ordre
(`playedAt asc, id asc`), avec un `CheckpointState` en mémoire par joueur, et un
**seul appel moteur par match** : tous les participants sont valorisés sur le même
snapshot d'avant-match.

---

## 7. Exemples chiffrés

Base : `kFactor = 32`, deux joueurs à 1000, `mmrMultiplier = 1`, hors placement.

| Scénario | K effectif | Deltas |
|---|---|---|
| 1v1, sans score | 32 | +16 / −16 |
| 1v1, score 10-0 | 64 | +32 / −32 |
| 1v1, score 6-4 | 38.4 | +19 / −19 |
| 1v1, vainqueur en placement, 10-0 | 128 (lui) / 64 | **+64** / −32 |
| 1v1, `mmrMultiplier = 2` | 64 | +32 / −32 |
| 1v1, `scoreCountsForMmr = false` | 0 | 0 / 0 |
| 1v1, 900 bat 1400 | 32 | +30 / −30 |
| 1v1, nul 1000 contre 1400 | 32 | +13 / −13 |

Le nul est un vrai résultat Elo : l'outsider gagne du MMR, le favori en perd.

---

## 8. Invariant et exceptions

```
Σ delta(côté A) + Σ delta(côté B) = 0
```

Exact, à deux exceptions près, toutes deux volontaires :

1. **Placement** — le delta du joueur en placement est doublé après la
   répartition. Un rookie converge deux fois plus vite sans que ses adversaires
   risquent le double. L'injection est bornée à `placementMatches × K` par joueur
   et disparaît une fois le placement terminé.
2. **Plancher `newMmr ≥ 1`** — garde-fou, inatteignable en pratique avec `K ≤ 128`.

## 9. Points d'attention

1. **`allowAsymmetricMatches` n'apporte aucune compensation.** En 1v2, le joueur
   seul encaisse 100 % du delta de son côté, contre 50 % chacun en face : son MMR
   bouge deux fois plus vite par match. C'est cohérent (il a fourni tout l'effort)
   mais c'est un choix, pas une conséquence mécanique.
2. **`outcomeType.points` ne joue plus aucun rôle dans le MMR.** Il ne sert qu'aux
   points de championnat. Modifier les points d'un type de résultat n'a plus
   d'effet sur le classement ranked.
3. **`mmrMultiplier = 0` et `scoreCountsForMmr = false`** donnent tous deux un
   delta nul, mais seul le second court-circuite le calcul complet.
4. **Le mode par défaut est silencieux** : une discipline créée sans
   `teamInteractionMode` tourne en `COLLABORATIVE`.
5. **Le `kEffective` stocké en historique** est le K du match, doublé pour un
   joueur en placement. Ce n'est plus une valeur d'affichage recalculée à part.
6. **Un changement de formule invalide les MMR calculés — le rattrapage est
   automatique.** `MMR_ENGINE_VERSION` (dans `mmr-engine.ts`) est estampillée par
   saison dans `computed_data`. Au démarrage, `recalculateOutdatedRankedSeasons()`
   enfile un rejeu déterministe pour chaque saison ranked non terminée restée sur
   une version antérieure, puis pose la nouvelle estampille — un déploiement
   embarque donc sa propre migration de données. Les saisons terminées restent
   figées (rewinds et seeds de report déjà dérivés) et conservent l'estampille de
   la version qui les a calculées. Pour forcer un rejeu hors upgrade,
   `POST /tournaments/:id/recalculate-points` réenfile la saison.

   **Toute modification future de la formule doit incrémenter
   `MMR_ENGINE_VERSION`**, sinon les ladders en cours resteront sur l'ancien
   calcul.
