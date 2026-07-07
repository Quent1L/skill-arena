import { execSync } from 'node:child_process'

/**
 * Purge les mutations des runs précédents: les matchs créés par les tests
 * (ids aléatoires, contrairement aux fixtures seedées préfixées "e2e")
 * ne sont ni supprimables ni annulables via l'API une fois finalisés, et
 * déclenchent le contrôle "déjà un match à cette date et heure" (même minute)
 * sur les runs suivants.
 */
export default function globalSetup() {
  const sql = `
    DELETE FROM matches
    WHERE tournament_id = 'e2e00000-0000-4000-8000-00000000f001'
      AND id::text NOT LIKE 'e2e%';
  `
  try {
    execSync(
      `docker exec skol-postgres-e2e psql -U skolarena -d skolarena_e2e -c "${sql.replace(/\s+/g, ' ').trim()}"`,
      { stdio: 'pipe' },
    )
  } catch (err) {
    throw new Error(
      `Purge de la base e2e impossible — conteneur skol-postgres-e2e lancé ? (bun run e2e:db:up)\n${err}`,
    )
  }
}
