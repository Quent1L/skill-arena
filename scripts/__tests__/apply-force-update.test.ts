import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { applyForceUpdate, MARKER_FILE, MIN_VERSION_FILE } from '../apply-force-update'

describe('applyForceUpdate', () => {
  let cwd: string

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'force-update-'))
    writeFileSync(join(cwd, MIN_VERSION_FILE), '0.0.0\n')
  })

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true })
  })

  // `stage: false` partout : le dossier temporaire n'est pas un dépôt git, et le
  // staging est de toute façon la responsabilité de release-it, pas de la logique testée.
  it('écrit la version publiée et consomme le marqueur', () => {
    writeFileSync(join(cwd, MARKER_FILE), '')

    expect(applyForceUpdate('1.20.0', cwd, false)).toBe(true)
    expect(readFileSync(join(cwd, MIN_VERSION_FILE), 'utf-8')).toBe('1.20.0\n')
    expect(existsSync(join(cwd, MARKER_FILE))).toBe(false)
  })

  it('laisse le plancher intact quand aucun marqueur n’est posé', () => {
    expect(applyForceUpdate('1.20.0', cwd, false)).toBe(false)
    expect(readFileSync(join(cwd, MIN_VERSION_FILE), 'utf-8')).toBe('0.0.0\n')
  })

  it('crée MIN_VERSION s’il n’existe pas encore', () => {
    rmSync(join(cwd, MIN_VERSION_FILE))
    writeFileSync(join(cwd, MARKER_FILE), '')

    expect(applyForceUpdate('2.0.0', cwd, false)).toBe(true)
    expect(readFileSync(join(cwd, MIN_VERSION_FILE), 'utf-8')).toBe('2.0.0\n')
  })
})
