import type { RuleConditions } from '@skol-arena/shared/types/index'

/**
 * Internal builder representation of the condition tree. Easier to manipulate
 * with drag & drop than the keyed `all`/`any` json-rules-engine format.
 */
export type BuilderNode =
  | { kind: 'group'; operator: 'all' | 'any'; children: BuilderNode[] }
  | { kind: 'leaf'; fact: string; operator: string; value: unknown }

export type PaletteItem = { paletteType: 'leaf' | 'group-all' | 'group-any'; label: string }

/** Option for player-reference facts (winnerId / loserId). */
export interface PlayerOption {
  id: string
  displayName: string
}

export const PALETTE_ITEMS: PaletteItem[] = [
  { paletteType: 'leaf', label: 'Condition' },
  { paletteType: 'group-all', label: 'Groupe ET' },
  { paletteType: 'group-any', label: 'Groupe OU' },
]

export function emptyLeaf(): BuilderNode {
  return { kind: 'leaf', fact: '', operator: '', value: '' }
}

export function emptyGroup(operator: 'all' | 'any' = 'all'): BuilderNode {
  return { kind: 'group', operator, children: [] }
}

/** Build a fresh BuilderNode from a dragged palette descriptor. */
export function nodeFromPalette(item: PaletteItem): BuilderNode {
  if (item.paletteType === 'group-all') return emptyGroup('all')
  if (item.paletteType === 'group-any') return emptyGroup('any')
  return emptyLeaf()
}

/** Serialize the builder tree into the json-rules-engine conditions format. */
export function toConditions(node: BuilderNode): RuleConditions {
  if (node.kind === 'group') {
    const children = node.children.map(toConditions)
    return node.operator === 'all' ? { all: children } : { any: children }
  }
  return { fact: node.fact, operator: node.operator, value: node.value }
}

/** Parse json-rules-engine conditions into the builder tree. */
export function fromConditions(conditions: RuleConditions | null | undefined): BuilderNode {
  if (!conditions) return emptyGroup('all')
  if ('all' in conditions) {
    return { kind: 'group', operator: 'all', children: conditions.all.map(fromConditions) }
  }
  if ('any' in conditions) {
    return { kind: 'group', operator: 'any', children: conditions.any.map(fromConditions) }
  }
  return { kind: 'leaf', fact: conditions.fact, operator: conditions.operator, value: conditions.value }
}

/** True when the tree has at least one leaf with a fact + operator set. */
export function hasValidLeaf(node: BuilderNode): boolean {
  if (node.kind === 'leaf') return !!node.fact && !!node.operator
  return node.children.some(hasValidLeaf)
}
