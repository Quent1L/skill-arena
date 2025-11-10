# Refactorisation: Séparation Service/Repository

## Objectif ✅

Éliminer tous les appels Drizzle directs dans le service `TournamentService` et centraliser l'accès aux données dans le repository `TournamentRepository`.

## Architecture

### Avant (problématique)

```
Service → Drizzle ORM directement
- Mélange logique métier et accès données
- Code difficile à tester
- Duplication potentielle
```

### Après (solution)

```
Service → Repository → Drizzle ORM
- Séparation claire des responsabilités
- Service = logique métier uniquement
- Repository = accès données uniquement
- Code plus testable
```

## Nouveaux fichiers créés

### 1. `tournament.repository.ts` ✅

**Responsabilités :**

- Opérations CRUD sur la table `tournaments`
- Gestion des relations (creator, admins)
- Requêtes avec filtres
- Vérifications d'administration

**Méthodes principales :**

```typescript
- create(data): Créer tournoi
- getById(id): Récupérer par ID (avec relations)
- getByIdSimple(id): Récupérer simple
- list(filters): Liste avec filtres
- update(id, data): Mettre à jour
- delete(id): Supprimer
- countByUserAndStatus(): Compter par utilisateur/statut
- isUserTournamentAdmin(): Vérifier admin
- addAdmin(): Ajouter admin
- getUser(): Récupérer utilisateur
```

## Service refactorisé

### 2. `tournament.service.ts` ✅

**Changements :**

- ❌ Plus d'imports Drizzle (`eq`, `and`, `count`, `db`)
- ❌ Plus de requêtes SQL directes
- ✅ Utilisation exclusive du repository
- ✅ Focus sur la logique métier uniquement

**Méthodes simplifiées :**

```typescript
// Avant
async countDraftTournaments(userId: string) {
  const result = await db
    .select({ count: count() })
    .from(tournaments)
    .where(and(eq(tournaments.createdBy, userId), eq(tournaments.status, "draft")));
  return result[0]?.count ?? 0;
}

// Après
async countDraftTournaments(userId: string) {
  return await tournamentRepository.countByUserAndStatus(userId, "draft");
}
```

## Avantages obtenus

### 🧪 **Testabilité**

```typescript
// Mock facile du repository
const mockRepository = {
  countByUserAndStatus: jest.fn().mockResolvedValue(3),
};
```

### 🔧 **Réutilisabilité**

```typescript
// Le repository peut être utilisé par d'autres services
export const tournamentRepository = new TournamentRepository();
```

### 📦 **Séparation des responsabilités**

- **Service** : validation, logique métier, permissions
- **Repository** : accès données, requêtes SQL, relations

### 🚀 **Maintenabilité**

- Changement de base de données → modifier uniquement le repository
- Logique métier → modifier uniquement le service
- Pas de duplication de code SQL

## Pattern utilisé

### Repository Pattern

```typescript
interface Repository<T> {
  create(data: CreateData): Promise<T>;
  getById(id: string): Promise<T | null>;
  update(id: string, data: UpdateData): Promise<T>;
  delete(id: string): Promise<void>;
  // ... autres méthodes CRUD
}
```

## Prochaines étapes recommandées

1. ✅ Tests unitaires du service (mock du repository)
2. ✅ Tests d'intégration du repository
3. ✅ Appliquer le même pattern aux autres services
4. ✅ Interface TypeScript pour standardiser les repositories

## Exemple d'usage

```typescript
// Dans un contrôleur
const tournamentService = new TournamentService();

try {
  const tournament = await tournamentService.createTournament({
    name: "Mon tournoi",
    mode: "championship",
    // ...
  });

  // La logique métier (permissions, validation) est dans le service
  // L'accès données est délégué au repository
} catch (error) {
  // Gestion d'erreurs métier
}
```
