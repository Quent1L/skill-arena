# Fix: Mise à jour de la syntaxe Drizzle ORM

## Problème résolu ✅

L'erreur suivante était générée par l'utilisation d'une signature dépréciée de `pgTable` :

```
The signature '(name: "tournament_admins", columns: { ... }, extraConfig: (self: { ... }) => PgTableExtraConfig): PgTableWithColumns<...> of 'pgTable is deprecated.
```

## Changements apportés

### 1. Mise à jour de la syntaxe `pgTable`

**Ancienne syntaxe (dépréciée) :**

```typescript
export const tournamentAdmins = pgTable(
  "tournament_admins",
  {
    /* colonnes */
  },
  (table) => ({
    uniqueTournamentUser: unique().on(table.tournamentId, table.userId),
  })
);
```

**Nouvelle syntaxe :**

```typescript
export const tournamentAdmins = pgTable(
  "tournament_admins",
  {
    /* colonnes */
  },
  (table) => [unique().on(table.tournamentId, table.userId)]
);
```

### 2. Tables mises à jour

- ✅ `tournamentAdmins` - contrainte unique sur tournamentId + userId
- ✅ `teams` - contraintes uniques sur tournamentId + name et tournamentId + hash
- ✅ `tournamentParticipants` - contrainte unique sur tournamentId + userId
- ✅ `matches` - contrainte unique sur tournamentId + teamAId + teamBId

### 3. Nettoyage des imports

- ✅ Suppression de l'import `check` non utilisé
- ✅ Suppression de l'import `sql` non utilisé

## Résumé technique

La différence principale est que l'ancienne syntaxe attendait un **objet** `{}` avec des propriétés nommées, tandis que la nouvelle syntaxe attend un **tableau** `[]` de contraintes directes.

### Migration pattern :

```typescript
// Ancien ❌
(table) => ({
  constraintName: unique().on(table.col1, table.col2),
})

// Nouveau ✅
(table) => [
  unique().on(table.col1, table.col2),
]
```

## Tests recommandés

Après cette mise à jour, vérifiez que :

1. ✅ Le build compile sans erreurs de dépression
2. ✅ `drizzle-kit push` fonctionne correctement
3. ✅ Les contraintes uniques sont bien appliquées en base
4. ✅ Les relations entre tables fonctionnent toujours

## Versions

Cette correction est compatible avec les versions récentes de :

- `drizzle-orm` >= 0.29.x
- `drizzle-kit` >= 0.20.x
