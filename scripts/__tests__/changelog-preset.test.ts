import { describe, expect, it } from 'bun:test'
import createPreset from 'conventional-changelog-conventionalcommits'
import releaseIt from '../../.release-it.json'
import { RELEASABLE_TYPES } from '../release-gate'

/**
 * The conventionalcommits v10 preset replaced `hidden: true` with `effect: "hidden"`.
 * An unknown key is not an error there: it is ignored, the type falls back to
 * `effect: "bump"` and shows up in the release note again. These tests run the real
 * writer rather than reading the JSON back, so the next schema change breaks here.
 */

/** Types kept out of the release note: they change nothing the Docker image ships. */
const HIDDEN_TYPES = ['test', 'ci']

interface WriterCommit {
  type: string
}

interface Preset {
  writer: { transform: (commit: unknown, context: unknown) => WriterCommit | undefined }
  whatBump: (commits: unknown[]) => { level: number } | null
}

const preset = createPreset(
  releaseIt.plugins['@release-it/conventional-changelog'].preset,
) as unknown as Preset

function commit(type: string, header = `${type}: do a thing`) {
  return {
    type,
    scope: '',
    subject: 'do a thing',
    header,
    notes: [],
    references: [],
    hash: 'abcdef1234567890',
    body: '',
    footer: '',
  }
}

/** Section rendered for that type, or `null` when the commit is dropped. */
function sectionOf(type: string): string | null {
  return preset.writer.transform(commit(type), {})?.type ?? null
}

describe('changelog preset', () => {
  it('drops the types that ship nothing', () => {
    for (const type of HIDDEN_TYPES) {
      expect(sectionOf(type)).toBeNull()
    }
  })

  it('renders a section for every releasable type', () => {
    for (const type of RELEASABLE_TYPES) {
      expect(sectionOf(type)).not.toBeNull()
    }
  })

  it('keeps a breaking change visible on a hidden type', () => {
    expect(preset.writer.transform(commit('ci', 'ci!: drop the node workflow'), {})).toBeDefined()
  })
})

describe('bump computation', () => {
  it('does not bump on hidden types alone', () => {
    expect(preset.whatBump(HIDDEN_TYPES.map((type) => commit(type)))).toBeNull()
  })

  it('bumps on every releasable type', () => {
    for (const type of RELEASABLE_TYPES) {
      expect(preset.whatBump([commit(type)])).not.toBeNull()
    }
  })
})
