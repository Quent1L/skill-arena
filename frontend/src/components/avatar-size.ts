/**
 * Avatar footprint, shared by PlayerAvatar and anything that has to line up with it
 * (the "+N" chip of PlayerAvatarStack). Kept out of the SFCs so the two can never drift.
 */
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg'

const SIZE_CLASS: Record<AvatarSize, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-16 h-16 text-xl',
}

export function avatarSizeClass(size?: AvatarSize): string {
  return SIZE_CLASS[size ?? 'md']
}
