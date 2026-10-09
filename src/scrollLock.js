// ── One scroll lock for the whole app ─────────────────────────
//
// Every sheet, modal and full-screen moment stops the page behind it
// from scrolling, and the sheets also make the app behind them inert.
// Each used to save `body.style.overflow` and put it back on close. Two
// of them overlapping broke that: the ⋯ sheet closing (220ms on its way
// out) while «معلومات ونصائح» opened meant the second one saved
// «hidden» as the value to restore — so after both closed the page
// stayed locked, and every other tab stopped scrolling until the app was
// restarted. Counting fixes it: the first lock saves and locks, the last
// release restores, in whatever order they open and close.

let scrollLocks = 0
let inertLocks = 0
let savedOverflow = ''

/**
 * Locks page scroll (and, with `inert`, makes #root inert) until the
 * returned release is called. Release is idempotent.
 */
export function lockScroll({ inert = false } = {}) {
  if (typeof document === 'undefined') return () => {}
  if (scrollLocks++ === 0) {
    savedOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  const root = inert ? document.getElementById('root') : null
  if (inert && inertLocks++ === 0 && root) root.inert = true
  let released = false
  return () => {
    if (released) return
    released = true
    if (inert && --inertLocks === 0) {
      const r = document.getElementById('root')
      if (r) r.inert = false
    }
    if (--scrollLocks === 0) document.body.style.overflow = savedOverflow
  }
}

/** For tests: how many locks are held right now. */
export const heldLocks = () => ({ scroll: scrollLocks, inert: inertLocks })
