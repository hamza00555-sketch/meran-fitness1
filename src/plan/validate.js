// ── مران · the check every saved plan passes ─────────────────
//
// Kept apart from the builder's engine (builder.js) so Settings' import
// and the report's «طبّقها على خطتي» can use it without pulling the
// exercise catalogue into the main bundle.
import { MUSCLE_GROUPS } from '../constants.js'

const MUSCLES = Object.keys(MUSCLE_GROUPS)

/**
 * Can both designs open this plan? null when they can, otherwise why not:
 *   'empty'   — no days
 *   'day'     — a day with no exercises (the old design opens a black screen)
 *   'muscle'  — a muscle that is not one of the eight
 *   'name'    — an exercise with no name
 * `at` says which day.
 */
export function validatePlan(hf) {
  const s = hf && hf.weeklySchedule
  if (!Array.isArray(s) || !s.length) return { error: 'empty' }
  for (let i = 0; i < s.length; i++) {
    const ex = s[i] && s[i].exercises
    if (!Array.isArray(ex) || !ex.length) return { error: 'day', at: i }
    for (const x of ex) {
      if (!x || !String(x.name || '').trim()) return { error: 'name', at: i }
      if (!MUSCLES.includes(x.muscle)) return { error: 'muscle', at: i }
    }
  }
  return null
}
