# Load Test

Load test k6 pour les endpoints publics de Skol. Lance automatiquement Postgres, l'app, le seed et k6 via Docker Compose.

## Prérequis

- Docker + Docker Compose

## Lancer le test

```bash
cd load-test
docker compose up --build
```

Le démarrage est séquentiel :
1. **postgres** démarre et attend d'être healthy
2. **app** démarre, applique les migrations, attend d'être healthy (~30s)
3. **seed** insère 50 users, 5 tournois et ~175 matchs, puis s'arrête
4. **k6** démarre le test de charge

Les résultats s'affichent en temps réel dans les logs k6. Le test dure ~2 min 30.

## Voir les logs séparément

```bash
docker compose logs app -f    # logs de l'application
docker compose logs k6        # résumé k6 après le test
```

## Nettoyer

```bash
docker compose down -v        # supprime les containers + volumes DB
```

## Profil de charge

| Phase        | Durée | VUs   |
|--------------|-------|-------|
| Ramp-up      | 30s   | 0→100 |
| Sustained    | 1m    | 500   |
| Peak         | 30s   | 2000  |
| Ramp-down    | 30s   | 2000→0|

## Thresholds

- `p(95) < 1000ms`
- `error rate < 5%`

## Relancer sans rebuilder l'image

```bash
docker compose down -v
docker compose up
```

Utiliser `--build` uniquement si le code de l'app a changé.
