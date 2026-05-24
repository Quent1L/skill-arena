# Skol - Tournament Management App

Une application de gestion de tournois avec un backend Hono/Bun et un frontend Vue 3.

## 🚀 Démarrage rapide

### Prérequis

- [Bun](https://bun.sh) (v1.0+)

### Installation

```bash
# Installer toutes les dépendances
bun run install:all
```

### Développement

```bash
# 🎯 Commande principale - Lance TOUT en une fois :
# - Compilation des types partagés en mode watch
# - Backend en mode développement (hot reload)
# - Frontend en mode développement (hot reload)
bun run dev
```

Cette commande unique lance :

- **Shared** (TypeScript en mode watch) → Port interne (compilation)
- **Backend** (Hono + Bun) → http://localhost:3000
- **Frontend** (Vue + Vite) → http://localhost:5173

## 📦 Structure du projet

```
skill-arena/
├── shared/          # 📦 Package TypeScript partagé
│   ├── src/         # Types, interfaces, schemas Zod
│   └── dist/        # Code compilé
├── backend/         # 🛠️ API Backend (Hono + Bun)
│   └── src/         # Services, routes, repositories
└── frontend/        # 🎨 Interface utilisateur (Vue 3)
    └── src/         # Components, views, composables
```

## 🛠️ Commandes disponibles

### Développement

- `bun run dev` - **Lance tout en mode développement** ⭐
- `bun run dev:shared` - Types partagés en mode watch
- `bun run dev:backend` - Backend uniquement
- `bun run dev:frontend` - Frontend uniquement

### Build

- `bun run build` - Build complet pour production
- `bun run build:shared` - Compile les types partagés
- `bun run build:frontend` - Build frontend pour production

### Qualité de code

- `bun run type-check` - Vérification TypeScript complète
- `bun run lint` - Lint du frontend
- `bun run format` - Format du frontend

### Utilitaires

- `bun run install:all` - Install toutes les dépendances
- `bun run clean` - Nettoie les dossiers de build

## 🔄 Package partagé

Le dossier `shared/` contient tous les types TypeScript partagés entre frontend et backend :

- **Enums** : UserRole, TournamentMode, TournamentStatus, etc.
- **Interfaces** : Tournament, User, Match, Team, etc.
- **Schémas Zod** : Validation partagée pour les API

### Avantages

- ✅ Pas de duplication de types
- ✅ Cohérence garantie entre front/back
- ✅ Type safety complet
- ✅ Hot reload des types en développement

## 🌐 URLs en développement

- **Frontend** : http://localhost:5173
- **Backend** : http://localhost:3000
- **API Docs** : http://localhost:3000/doc (si configuré)

## 🔧 Technologies

- **Frontend** : Vue 3, TypeScript, Vite, TailwindCSS, PrimeVue
- **Backend** : Hono, Bun, DrizzleORM, PostgreSQL, Better Auth
- **Shared** : TypeScript, Zod
- **DevTools** : Bun, Concurrently, ESLint, Prettier



---

## Git Hooks & Conventional Commits

Ce projet utilise [Husky](https://typicode.github.io/husky/) pour gérer les hooks Git et [commitlint](https://commitlint.js.org/) pour valider les messages de commit selon la convention [Conventional Commits](https://www.conventionalcommits.org/).

Les hooks sont installés automatiquement lors d'un `bun install` grâce au script `prepare` dans `package.json`.

### Format des commits

```
type(scope): description

# Exemples
feat(ranked): add MMR recalculation
fix(bracket): correct seeding order
docs: update setup instructions
```

Types acceptés : `feat`, `fix`, `perf`, `refactor`, `docs`, `style`, `test`, `chore`, `ci`, `revert`.

### Résolution d'un problème PATH avec Bun (Linux/macOS)

Husky exécute les hooks dans un shell restreint qui ne charge pas le profil utilisateur. Si Bun n'est pas trouvé dans le PATH au moment du commit, tu obtiendras une erreur du type :

```
.husky/commit-msg: bun: not found
husky - commit-msg script failed (code 127)
```

Husky source le fichier `~/.config/husky/init.sh` avant chaque hook Git. C'est l'endroit prévu pour configurer le PATH ou initialiser un gestionnaire de versions. Pour corriger le problème, crée ce fichier en y ajoutant le chemin vers Bun :

```bash
mkdir -p ~/.config/husky
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.config/husky/init.sh
```

> **Note :** ce fichier est propre à ta machine et ne doit pas être commité. Chaque contributeur utilisant Bun devra effectuer cette manipulation une seule fois sur son poste.

Pour vérifier le chemin exact de Bun sur ta machine : `which bun`.

