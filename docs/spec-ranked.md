# Spécification Fonctionnelle — Mode Ranked
**Application SKOL** — Compétitions inter-entreprises multi-disciplines

---

## 1. Vue d'ensemble

Le mode **Ranked** est un système de matchmaking compétitif permanent, indépendant des tournois organisés (Championnat, Bracket). Il permet à tout joueur de défier un adversaire à tout moment, en dehors de tout événement planifié, et de faire évoluer son classement au fil du temps.

Contrairement aux autres modes, le Ranked n'a pas de structure d'arbre ou de phase de groupes. C'est une **couche permanente** organisée en **saisons**, à l'intérieur desquelles chaque match contribue à un classement individuel.

---

## 2. Saisons

### 2.1 Principe général

Le Ranked est organisé en **saisons d'une durée de 3 mois** (trimestriel). Chaque saison est liée à une **discipline spécifique**.

**Règle fondamentale :** une seule saison ranked peut être active à un instant donné par discipline. Plusieurs saisons peuvent coexister en parallèle si elles concernent des disciplines différentes (ex: une saison Billard et une saison Fléchettes simultanées).

Un joueur peut donc avoir un rang différent par discipline, et progresser indépendamment sur chacune d'elles.

### 2.2 Création d'une saison

Seul un **administrateur** peut créer une saison ranked. Si une saison est déjà active sur une discipline, il est impossible d'en créer une nouvelle sur cette même discipline avant qu'elle ne soit terminée.

À la création, l'administrateur configure :

| Paramètre | Obligatoire | Description |
|---|---|---|
| Discipline | ✅ | La discipline concernée |
| Date de début | ✅ | Date de lancement de la saison |
| Date de fin | ✅ | Date de clôture de la saison |
| MMR de départ (base) | ✅ | MMR attribué aux joueurs sans historique ranked sur cette discipline (défaut : 1000) |
| S'appuyer sur le MMR précédent | ✅ | Si activé, le MMR de la saison précédente est repris (avec reset partiel). Si désactivé, tout le monde repart au MMR de base. |
| K-factor | ✅ | Valeur par défaut : 32 |
| Matchs de placement | ✅ | Nombre de matchs avant affichage du rang (défaut : 5) |
| Nombre de joueurs par équipe | ✅ | Reprise du paramétrage existant — définit la taille standard des équipes (ex: 1, 2, 3...) |
| Autoriser les matchs asymétriques | ❌ | Permet des confrontations déséquilibrées en nombre de joueurs (ex: 1v2). Voir section 3.1. |

### 2.3 Cycle de vie d'une saison

```
Créée → En cours → Terminée → [Délai libre] → Nouvelle saison créée
```

Une période creuse entre deux saisons est possible — l'administrateur choisit quand lancer la suivante.

### 2.4 Fin de saison

À la clôture d'une saison :

1. Les **rangs finaux** de chaque joueur sont archivés (consultables à tout moment)
2. La discipline est libérée pour qu'un admin puisse créer une nouvelle saison

### 2.5 MMR de départ d'une nouvelle saison

À la création de chaque nouvelle saison, l'admin choisit si elle s'appuie ou non sur le MMR de la saison précédente.

**Sans historique (premier reset ou reset total)**
Tous les joueurs repartent au MMR de base défini par l'admin (défaut : 1000). C'est le comportement par défaut pour une première saison sur une discipline.

**Avec historique (reset partiel)**
Le MMR de chaque joueur est **ramené vers la moyenne** (MMR de base) sans effacement total. Exemple avec un MMR de base à 1000 :
- Un joueur à 2200 MMR repart à ~1400
- Un joueur à 600 MMR repart à ~900

Les joueurs **sans historique** sur la saison précédente (nouveaux participants) repartent toujours au MMR de base, quel que soit le mode choisi.

Cela permet à l'admin d'adapter la dynamique selon le contexte : reset total pour une nouvelle compétition ouverte à tous, reset partiel pour conserver la mémoire du niveau sur le long terme.

---

## 3. Matchs Ranked

### 3.1 Lancement d'un match

Le mode de lancement est **déclaratif** : les joueurs se trouvent en dehors de l'application et saisissent leur résultat manuellement après la partie. Il n'y a pas de matchmaking automatique.

La composition des équipes suit le **paramétrage de la saison** (nombre de joueurs par équipe), repris du système existant de l'application.

**Matchs asymétriques :** si l'option est activée par l'admin, des confrontations déséquilibrées sont autorisées (ex: 1 joueur contre 2). Dans ce cas, le MMR de l'équipe à effectif réduit est comparé à la **moyenne MMR** de l'équipe adverse, comme pour tout match en équipe. C'est un mode optionnel qui peut être pertinent pour certaines disciplines où l'handicap est une pratique courante.

### 3.2 Saisie du résultat

Après chaque partie, les joueurs renseignent :

- **Le score de chaque équipe** (ex: billes rentrées au billard)
- **Le type de fin de match** via le système `OutcomeType` existant

Le système `OutcomeType` existant est enrichi d'un nouveau booléen :

| Booléen | Existant | Description |
|---|---|---|
| `isDefault` | ✅ | Type de fin par défaut proposé à la saisie |
| `scoreCountsForMmr` | 🆕 | Indique si le score saisi doit être pris en compte dans le calcul du multiplicateur MMR |

Quand `scoreCountsForMmr = false`, le score est conservé pour l'historique et les statistiques mais le multiplicateur de score est ignoré — le K de base est appliqué.

Exemples au billard :

| OutcomeType | isDefault | scoreCountsForMmr |
|---|---|---|
| Victoire normale | ✅ | ✅ |
| Faute de noire | ❌ | ❌ |
| Forfait | ❌ | ❌ |

### 3.3 Validation du résultat

La validation des matchs ranked s'appuie sur le **système de validation existant** de l'application, déjà en place.

---

## 4. Calcul du MMR

### 4.1 Saisie et limite temporelle

Un match ranked ne peut être saisi que dans les **48 heures suivant sa date/heure réelle**. Passé ce délai, la saisie est refusée par l'application.

Cette contrainte garantit que la fenêtre de désordre chronologique reste bornée et que les recalculs de MMR restent légers.

### 4.2 Ordonnancement et calcul

La **date/heure réelle du match** (saisie par les joueurs) est le champ de référence pour tous les calculs — pas la date de saisie, ni la date de validation.

> Le MMR confirmé d'un joueur est toujours le résultat du recalcul séquentiel de tous ses matchs **validés**, triés par date/heure réelle croissante, depuis son MMR de départ de saison.

Dès qu'un match est validé, le système recalcule le MMR du joueur en rejouant la séquence complète de ses matchs validés dans l'ordre chronologique. Grâce à la limite de 48h, cette séquence ne peut être perturbée que sur une fenêtre glissante courte.

**Matchs en attente de validation :** ils sont affichés au joueur avec leur date/heure et un gain/perte **estimé** basé sur le MMR confirmé actuel. Cette estimation n'est pas garantie car un match antérieur en attente peut encore arriver dans la fenêtre des 48h et modifier la base de calcul.

**Auto-validation :** le système existant d'auto-validation à 3 jours s'applique sans modification. Si aucun joueur n'a contesté dans ce délai, le match est validé automatiquement et le recalcul est déclenché.

### 4.3 Système de base — Elo

Le MMR est calculé selon le système **Elo**, adapté pour prendre en compte l'écart de score.

Formule de base :
```
Nouveau MMR = Ancien MMR + K × (Résultat - Probabilité de victoire)
```

- **Résultat** : 1 si victoire, 0 si défaite
- **Probabilité de victoire** : calculée automatiquement selon l'écart de MMR entre les deux parties

### 4.4 K-factor

Le K-factor définit l'amplitude maximale de points gagnables ou perdables par match.

| K-factor | Comportement |
|---|---|
| 16 | Stable, évolution lente |
| **32** | Standard recommandé |
| 64 | Volatile, classement très réactif |

**K évolutif sur les matchs de placement :** pendant les N premiers matchs d'un joueur dans une saison, le K-factor est doublé (K=64) pour permettre un placement rapide. Il revient ensuite à la valeur standard.

### 4.5 Influence du score sur le MMR

Le score détaillé (ex: billes rentrées) influence le MMR via un **multiplicateur appliqué au K-factor**, uniquement pour les fins de type `NORMAL`.

```
Écart de domination = (score_gagnant - score_perdant) / score_total
K_effectif = K_base × (1 + écart_de_domination)
```

Exemples au billard (K base = 32) :

| Score | Écart | K effectif |
|---|---|---|
| 7-0 | 1.0 | 64 |
| 7-3 | 0.4 | 44.8 |
| 7-6 | 0.08 | 34.6 |

> Pour les `OutcomeType` dont `scoreCountsForMmr = false`, le multiplicateur est ignoré et le K de base est appliqué.

### 4.6 Calcul en équipe

Quand les équipes comptent plusieurs joueurs, chaque joueur est comparé individuellement à la **moyenne MMR de l'équipe adverse**. Les gains et pertes de MMR sont calculés par joueur, pas par équipe.

Le score étant une statistique d'équipe et non individuelle, le multiplicateur s'applique identiquement à tous les membres de l'équipe gagnante ou perdante.

**Cas des matchs asymétriques (ex: 1v2) :** le joueur seul est comparé à la moyenne MMR des deux adversaires, et chaque joueur de l'équipe adverse est comparé au MMR du joueur seul. La formule Elo s'applique normalement — l'écart de MMR calculé reflétera naturellement le déséquilibre d'effectif.

---

## 5. Rangs

### 5.1 Les quatre rangs

| Rang | Description |
|---|---|
| 🪙 Challenger | Tu entres dans l'arène |
| 🧠 Stratège | Tu joues avec méthode |
| 🏆 Maître | Tu domines ta discipline |
| 👑 Légende | Tu transcendes le jeu |

### 5.2 Calcul des bornes — Percentiles dynamiques

Les rangs sont basés sur la **distribution réelle des joueurs**, pas sur des seuils fixes.

| Rang | Percentile |
|---|---|
| Challenger | 0 – 40% |
| Stratège | 40 – 70% |
| Maître | 70 – 90% |
| Légende | Top 10% |

**Les bornes en MMR sont calculées au début de chaque saison** (snapshot de la distribution) et restent fixes pendant toute la durée de la saison. Elles sont recalculées uniquement à la création de la saison suivante.

Cela garantit qu'un joueur ne change pas de rang sans avoir joué.

### 5.3 Affichage du rang

Le rang n'est **pas affiché** pendant les matchs de placement (N matchs définis par l'admin). Cela évite d'être catalogué dès le premier jour.

### 5.4 Rétrogradation

La rétrogradation est **immédiate et fidèle au MMR réel**. Dès qu'un joueur passe sous le seuil de son rang, son rang affiché est mis à jour sans délai ni zone tampon.

---

## 6. Progression et expérience joueur

### 6.1 Ce qui est mis en avant

Au-delà du rang, l'interface valorise la **progression personnelle** :

- Évolution du MMR depuis le début de saison
- Nombre de matchs joués cette saison
- Séries de victoires en cours
- Historique des matchs avec delta MMR

L'objectif est qu'un joueur Challenger qui progresse de +80 MMR en une saison en soit fier, même s'il n'atteint pas Stratège.

### 6.2 Protection des joueurs moins expérimentés

Grâce au système Elo, les écarts de niveau sont naturellement pris en compte :

- Un Challenger qui perd contre un Légende perd très peu de MMR
- Un Challenger qui bat un Légende gagne énormément de MMR

Les gros outsiders sont donc structurellement protégés par la formule elle-même.

---

## 7. Règles spécifiques par discipline

Chaque discipline configure ses `OutcomeType` avec le booléen `scoreCountsForMmr` pour définir quels types de fin intègrent le score dans le calcul MMR.

### Billard — Règles spécifiques

| OutcomeType | isDefault | scoreCountsForMmr |
|---|---|---|
| Victoire normale | ✅ | ✅ |
| Faute de noire adverse | ❌ | ❌ |
| Forfait / abandon | ❌ | ❌ |

**Unité de match :** une partie = un match ranked.  
**Score saisi :** nombre de billes rentrées par équipe.

---

## 8. Modèle de données — Orientations

Le mode Ranked s'appuie sur la table `tournament` existante comme **concept parent** (discipline, dates, créateur, statut), étendue par une configuration spécifique `ranked_season_config` contenant les paramètres propres au ranked (K-factor, MMR de base, reprise du MMR précédent, nombre de joueurs par équipe, autorisation des matchs asymétriques, règles de rang, etc.).

Le modèle `OutcomeType` existant est enrichi d'un booléen `scoreCountsForMmr` indiquant si le score doit être intégré au calcul du multiplicateur MMR pour ce type de fin.

Les matchs ranked restent liés à la structure de match existante, enrichis de métadonnées spécifiques : score détaillé, OutcomeType sélectionné, delta MMR calculé par joueur. Le système de validation de match existant est réutilisé sans modification.

---

*Document rédigé dans le cadre de la conception fonctionnelle de SKOL — à compléter lors de la phase d'implémentation technique.*
impementation plan at ~/.claude/plans/mighty-dreaming-trinket.md