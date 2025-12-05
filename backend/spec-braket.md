Voici **ce qu’il faut ajouter dans ton schéma** pour supporter **un tournoi en bracket à double élimination**, puis **une spécification complète** expliquant le fonctionnement attendu.

---

# ✅ 1. Changements à apporter au schéma

Actuellement, ton modèle permet des « rounds », des matches teamA/teamB, etc.
Pour un **double elimination bracket**, il manque trois choses essentielles :

---

## **(A) Ajouter un type de bracket**

Pour distinguer Winner Bracket / Loser Bracket / Grand Final.

```ts
export const bracketTypeEnum = pgEnum("bracket_type", [
  "winner",
  "loser",
  "grand_final",
]);
```

Puis l’ajouter dans `matches` :

```ts
bracketType: bracketTypeEnum("bracket_type").default("winner").notNull(),
```

---

## **(B) Ajouter un champ `sequence` pour ordonner les matchs**

Le numéro de round ne suffit pas : dans un double élimination, il peut y avoir :

* Round 1 du Winner Bracket
* Round 1 du Loser Bracket Upper
* Round 1 du Loser Bracket Lower
* etc.

Donc :
---

# 6. Exemple concret (8 joueurs)

### WB Round 1 :

4 matchs → vainqueurs vont dans WB Round 2 → perdants dans LB Round 1

### LB Round 1 (Upper)

4 équipes descendues → 2 matchs

### LB Round 2 (Lower)

etc.

Jusqu’à :

* **WB Final**
* **LB Final**
* **Grand Final**
* **Reset Final** (si besoin)


```ts
sequence: integer("sequence").notNull(),
```

> Cela te permet de gérer un ordre strict d’exécution même si deux matchs ont le même numéro de round.

---

## **(C) Ajouter les liens entre matches (`nextMatchIdA` et `nextMatchIdB`)**

Pour savoir :

* où le **vainqueur** va
* où le **perdant** va (typique du loser bracket)

```ts
nextMatchWinId: uuid("next_match_win_id").references(() => matches.id, {
  onDelete: "set null",
}),
nextMatchLoseId: uuid("next_match_lose_id").references(() => matches.id, {
  onDelete: "set null",
}),
```

> Ce lien transforme ta BDD en **graphe dirigé**, parfait pour les brackets.

---

## **(D) Ajouter un champ `matchPosition`**

Permet de placer le match dans le bracket visuel (slot 1, slot 2, etc.)

```ts
matchPosition: integer("match_position"),
```

---

## Résultat : match = unité atomique capable d’exprimer un bracket simple, double ou custom

Tu ne touches pas aux autres tables : elles sont déjà compatibles.

---

# ✅ 2. Spécification fonctionnelle : Tournoi Double Élimination

Voici une **spécification complète**, prête à intégrer dans ta documentation produit ou Confluence.

---

# **Spécification – Tournoi en Bracket à Double Élimination**

## 🎯 Objectif

Permettre l’organisation d’un tournoi à double élimination où chaque équipe/joueur :

* commence en **Winner Bracket (WB)**
* descend en **Loser Bracket (LB)** en cas de défaite
* est éliminé définitivement uniquement après **deux défaites**
* rejoint une **Grande Finale** si elle gagne le LB
* peut déclencher une **bracket reset** si le gagnant du LB bat le gagnant du WB

Le tout doit être représenté dans la base sous forme d’un graphe de matchs reliés entre eux.

---

# 1. Structure du tournoi

## 1.1 Arbres de matchs

Le tournoi comporte 3 sections :

### ✔ Winner Bracket (WB)

* Bracket principal
* Une seule défaite : on descend dans le LB

### ✔ Loser Bracket (LB)

* Composé de deux sous-rounds par phase :
  **Loser Round Upper (LRU)** et **Loser Round Lower (LRL)**
* Une défaite ici → élimination

### ✔ Grande Finale

Peut comprendre :

1. **Grand Final (GF1)**
   WB Winner vs LB Winner

2. **Grand Final Reset (GF2)** (si nécessaire)
   Jouée uniquement si le vainqueur du LB gagne la GF1.

---

# 2. Génération du bracket

## 2.1 Inputs pour générer le bracket

* Nombre de participants/équipes **N**
* Format : **bracket double elimination**
* Eventuellement :

  * Seed (aléatoire ou manuel)
  * Matchs BO1 / BO3 / BO5 (si géré plus tard)
  * Positionnement visuel (optionnel)

---

## 2.2 Création des matchs et liens

Pour chaque match, le système doit :

1. **Créer un match WB**

2. Déterminer :

   * `nextMatchWinId` → match du WB suivant
   * `nextMatchLoseId` → match du LB

3. Pour les matches du LB :

   * `nextMatchWinId` → match du LB suivant
   * `nextMatchLoseId` = **null** (défaite = élimination)

4. Pour la grande finale :

   * GF1 :

     * Win → champion
     * Lose → si LB Winner → GF2
   * GF2 :

     * Win → champion
     * Lose → runner-up

---

# 3. Gestion automatique du bracket

Lorsqu’un match est **finalisé** :

1. Le système vérifie son `winnerId`.
2. Il insère automatiquement l’équipe dans :

   * `nextMatchWinId` → côté A ou B libre
3. Si le perdant existe et que `nextMatchLoseId` n'est pas null :

   * Il est inséré dans `nextMatchLoseId`
4. Si `nextMatchLoseId` est null → élimination

Cela représente le flux complet du bracket.

---

# 4. Vue front (pour toi en Vue.js)

Le système doit fournir au front :

* un **JSON du graphe complet**
* contenant pour chaque match :

  ```json
  {
    "id": "...",
    "round": 2,
    "sequence": 5,
    "bracketType": "loser",
    "teamAId": "...",
    "teamBId": "...",
    "winnerId": "...",
    "nextMatchWinId": "...",
    "nextMatchLoseId": "...",
    "matchPosition": 12
  }
  ```

Avec ça, un bracket double élimination peut être rendu visuellement sans recalculer la structure côté UI.

---

# 5. API nécessaires

## 5.1 POST /tournaments/:id/generate-bracket

Crée tous les matchs, liens et positions.

## 5.2 POST /matches/:id/report

Déclare un résultat → déclenche le routage vers les matchs suivants.

## 5.3 GET /tournaments/:id/bracket

Retourne le graphe complet pour affichage.

