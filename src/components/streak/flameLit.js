// ── The flame lights once a day ───────────────────────────────
//
// The first time Home sees today counted, the flame on the streak
// number fills from the bottom, hops, and lets off three embers; after a
// workout the number rolls up to its new value as well. Once a day — the
// day it happened is remembered under 'meran_flame_lit', a new key of
// its own that nothing the old design reads depends on. It is kept per
// user, like every other piece of his data (the first user keeps the
// bare key): on a shared phone one person's flame must not use up
// another's, and a data reset (PER_USER_KEYS) starts it over.
//
// Not while something covers Home (the session summary, the level-up
// screen): the moment is kept until Home can be seen.

import { userKey } from '../../utils.js'

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
  try { return localStorage.getItem(userKey(FLAME_LIT_KEY)) } catch { return null }
}

export function writeLit(day) {
  try { localStorage.setItem(userKey(FLAME_LIT_KEY), day) } catch { /* private mode: it may light again */ }
}
