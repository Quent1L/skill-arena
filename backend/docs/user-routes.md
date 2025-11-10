# Route utilisateur - GET /api/users/me

## Description

Cette route permet de récupérer les détails de l'utilisateur actuellement connecté.

## Endpoint

```
GET /api/users/me
```

## Authentification

✅ **Requiert une authentification** via le middleware `requireAuth`

## Réponse

### Succès (200)

```json
{
  "id": "app-user-uuid",
  "externalId": "better-auth-user-id",
  "displayName": "Nom d'affichage",
  "role": "player",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "betterAuth": {
    "id": "better-auth-user-id",
    "email": "user@example.com",
    "name": "User Name",
    "image": "https://example.com/avatar.jpg",
    "emailVerified": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Erreurs

- **401 Unauthorized** : Token d'authentification manquant ou invalide
- **404 Not Found** : Utilisateur non trouvé
- **500 Internal Server Error** : Erreur serveur

## Exemple d'utilisation

```javascript
// Avec fetch
const response = await fetch("/api/users/me", {
  headers: {
    Authorization: "Bearer your-token-here",
  },
});

const userData = await response.json();
console.log("User details:", userData);
```

## Modifications apportées

1. **Service utilisateur** (`user.service.ts`) :

   - Ajout de `getAppUserById()` pour récupérer un utilisateur par ID
   - Ajout de `getAppUserByExternalId()` pour récupérer par ID externe
   - Nettoyage des imports inutilisés

2. **Route utilisateur** (`user.route.ts`) :

   - Création de la route `GET /me`
   - Utilisation du middleware `requireAuth`
   - Retour des données app_user + Better Auth

3. **Index principal** (`index.ts`) :
   - Ajout du montage de la route `/api/users`

## Architecture

```
GET /api/users/me
     ↓
requireAuth middleware
     ↓
userService.getAppUserById()
     ↓
userRepository.getById()
     ↓
Database query
```
