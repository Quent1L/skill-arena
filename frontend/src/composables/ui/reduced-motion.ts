/**
 * The JS half of the reduced-motion contract. `assets/css/main.css` already
 * flattens every CSS animation and transition; anything driven by a timer or a
 * rAF loop has to opt out here instead.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
