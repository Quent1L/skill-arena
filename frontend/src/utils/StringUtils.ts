export function getInitials(name?: string | null): string {
  if (!name) return '?'
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = [
  '#1d4ed8',
  '#4338ca',
  '#7e22ce',
  '#be185d',
  '#b91c1c',
  '#c2410c',
  '#b45309',
  '#15803d',
  '#0f766e',
  '#0369a1',
]

export function getAvatarBg(name: string): string {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}
