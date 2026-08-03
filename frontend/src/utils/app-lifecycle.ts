/**
 * Whether the document is on its way out.
 *
 * Leaving a page aborts every request still in flight, and each abort surfaces as a
 * network failure nobody can act on. Reporting those to the user is noise: the screen
 * they would read is about to be replaced anyway.
 */
let leaving = false

/** Call right before triggering a reload or a full navigation. */
export function markLeaving(): void {
  leaving = true
}

export function isLeaving(): boolean {
  return leaving
}

if (typeof window !== 'undefined') {
  // Covers the departures we do not trigger ourselves: back button, tab close,
  // an external link. `pagehide` also fires when the page goes to the bfcache.
  window.addEventListener('pagehide', markLeaving)
  window.addEventListener('beforeunload', markLeaving)
}
