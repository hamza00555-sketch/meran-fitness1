// ── Which design is showing ───────────────────────────────────
//
// حمزة asked for a switch: the new design (this app, at /) or the old
// one he is used to (a frozen copy, at /classic/). Both run on the same
// origin, so they read and write the very same localStorage — the
// workouts, the streak and the tickets are one set of data, whichever
// face is showing. The choice is one raw key, outside the per-user
// namespace, read by an inline script in each index.html so that
// opening the app from the home screen lands straight on the chosen
// design.
//
// This file exists, identical, in src/ and classic/src/.

export const DESIGN_KEY = 'meran_design'
export const CLASSIC_PATH = '/classic/'

export function currentDesign() {
  try { return localStorage.getItem(DESIGN_KEY) === 'classic' ? 'classic' : 'new' } catch { return 'new' }
}

export function switchDesign(to) {
  try { localStorage.setItem(DESIGN_KEY, to) } catch { /* private mode: still navigate */ }
  window.location.assign(to === 'classic' ? CLASSIC_PATH : '/')
}
