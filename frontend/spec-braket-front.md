Voici **le meilleur flow mobile-first** pour afficher un bracket (simple ou double élimination) dans ton application de tournoi.
L’objectif :

* que ce soit clair sur petit écran,
* navigable au doigt,
* performant même avec 16–32 équipes,
* et sans “squeezer” un arbre entier sur un smartphone.

---

# 🎯 **Objectif mobile-first : le bracket doit être lisible par round, pas en entier**

Sur mobile, un bracket complet est **illisible** (trop large, zoom désagréable).
La bonne approche : **affichage en “colonnes scrollables”** → un round = une colonne.

Tu vas donc afficher **1 round à la fois**, avec navigation horizontale.

---

# 📱 **1. Layout mobile-first recommandé**

### ✔️ **1 round = 1 colonne verticale**

Chaque colonne contient ses matchs, empilés verticalement :

```
Round 1
  [ Match 1 ]
  [ Match 2 ]
  [ Match 3 ]
Round 2
  [ Match 4 ]
  [ Match 5 ]
Round 3 (Final)
  [ Match 6 ]
```

### ✔️ Navigation horizontale

* **Swipe gauche / droite** pour changer de round
* Ou pagination avec boutons :
  `<  Round 1  >`

### ✔️ UI fluide :

* animations type "slide" (Framer Motion)
* chaque match = "card" clickable

---

# 📚 **2. Navigation entre Winner Bracket et Loser Bracket**

Dans un bracket double élimination :

### Mobile-friendly UX :

```
WB | LB | Finals
```

Un **segmented control** en haut :

* WB = winner bracket
* LB = loser bracket
* Finals = grande finale (GF1, GF2)

Ensuite, **navigation par round à l’intérieur de chaque bracket**.

---

# 🎨 **3. Design d'une carte de match (mobile)**

Ta carte doit être compacte et claire :

```
───────────────
Match R1-M3
[Team A]  12
[Team B]   8
Status: finished / ongoing / TBD
───────────────
```

### Champs affichés recommandés :

* Numéro du match (R2-M1)
* Bracket: (WB / LB / GF)
* Les 2 équipes (ou BYE)
* Scores
* Bouton **“Voir le match / Modifier”**

---

# 🔁 **4. Flow utilisateur (mobile)**

### **Flow optimal :**

#### 1) **User ouvre l’onglet Bracket**

→ Choix Winner / Loser / Finale (si DE)
→ Arrive par défaut sur *Winner Round 1*

#### 2) **Swipe** pour aller au round suivant ou précédent

#### 3) **Cliquer un match**

→ Ouvre une page “Match détail” (modal ou page) :

* score
* équipes
* historique
* actions (saisir score, valider résultat)

#### 4) Une fois le match terminé :

* le bracket se met à jour automatiquement
* on peut cliquer “aller au match suivant”

---

# 🎯 **5. Comment gérer …**

## **5.1. Les connexions entre matchs**

Sur desktop : lignes SVG entre les cartes.
Sur mobile : **pas nécessaire** → trop lourd.

À la place :

* Indiquer “Gagnant va vers R2-M1”
* Indiquer “Perdant va au LB R1-M1”

Petites étiquettes discrètes.

---

## **5.2. Grande finale (double elimination)**

Juste un écran dédié :

```
Finale
  Winner Bracket Winner
        vs
  Loser Bracket Winner

Si LB gagne :
  Reset Match
        vs
  WB Winner
```

Simple, lisible, pas besoin de relier tout visuellement.

---

# 🧠 **6. Architecture front (Vue.js + PWA)**

### Recommandation simple :

```text
/components/bracket/
   BracketView.vue
   BracketRound.vue
   MatchCard.vue
   BracketNavigation.vue
```

### State recommandé :

```ts
rounds = {
  WB: [ Round1, Round2, ... ],
  LB: [ L1, L2, L3, ... ],
  GF: [ GF1, GF2? ]
}
```

---

# 🚀 **7. Résumé rapide du flow mobile-first**

### ✔ Winner / Loser / Finals tabs

### ✔ 1 round = 1 colonne verticale

### ✔ Swipe horizontal entre rounds

### ✔ Matchs en cartes verticales

### ✔ Sans lignes de connexion (trop brouillon mobile)

### ✔ Page "match détail" pour scores & infos

### ✔ GF en écran séparé

