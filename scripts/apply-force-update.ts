import { execFileSync } from 'node:child_process'
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Marqueur posé par le dev dans la PR qui introduit le changement bloquant. */
export const MARKER_FILE = 'FORCE_UPDATE'
/** Plancher de version exigé des clients. Écrit ici, jamais à la main. */
export const MIN_VERSION_FILE = 'MIN_VERSION'

/**
 * Résout le marqueur FORCE_UPDATE en numéro de version réel.
 *
 * Le dev ne peut pas écrire ce numéro lui-même : release-it le calcule à partir des
 * commits conventionnels au moment du merge. D'où le marqueur sans version, consommé
 * ici depuis le hook `after:bump` — le premier moment où VERSION est connue, et encore
 * avant le commit `chore(release)`.
 *
 * Retourne true quand le marqueur a été consommé.
 */
export function applyForceUpdate(version: string, cwd = process.cwd(), stage = true): boolean {
  const marker = join(cwd, MARKER_FILE)
  if (!existsSync(marker)) return false

  writeFileSync(join(cwd, MIN_VERSION_FILE), `${version}\n`)
  rmSync(marker)
  // Explicite plutôt que de dépendre de la façon dont release-it stage : `git add`
  // enregistre aussi la suppression d'un fichier tracké.
  if (stage) execFileSync('git', ['add', MIN_VERSION_FILE, MARKER_FILE], { cwd })
  return true
}

if (import.meta.main) {
  const version = process.argv[2]
  if (!version) {
    console.error('apply-force-update: version manquante en argument')
    process.exit(1)
  }
  if (applyForceUpdate(version)) {
    console.log(`🔒 Mise à jour bloquante : ${MIN_VERSION_FILE} <- ${version}`)
  }
}
