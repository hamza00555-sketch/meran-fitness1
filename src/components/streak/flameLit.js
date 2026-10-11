// ── The flame lights once a day ───────────────────────────────
//
// The first time Home sees today counted, the flame on the streak
// number fills from the bottom, hops, and lets off three embers; after a
// workout the number rolls up to its new value as well. Once a day — the
// day it happened is remembered in localStorage['meran_flame_lit'], a
// new raw key of its own (like meran_design) that nothing the old design
// reads depends on.
//
// Not while something covers Home (the session summary, the level-up
// screen): the moment is kept until Home can be seen.

export const FLAME_LIT_KEY = 'meran_flame_lit'

const TRAINED = new Set(['counted-trained'])

/**
 * Should the flame light now? null, or { from } — the number to roll up
 * from (null: no roll, only the flame; a rest day counted at 03:00
 * doesn't change in front of you).
 */
export function flameIgnition({ counted, kind, number = 0, today, lit = null, hold = false }) {
  if (!counted || hold || !today || lit === today) return null
  return { from: TRAINED.has(kind) && number > 0 ? number - 1 : null }
}

export function readLit() {
  try { return localStorage.getItem(FLAME_LIT_KEY) } catch { return null }
}

export function writeLit(day) {
  try { localStorage.setItem(FLAME_LIT_KEY, day) } catch { /* private mode: it may light again */ }
}
