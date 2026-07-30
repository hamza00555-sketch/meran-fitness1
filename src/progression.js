// ── Double progression ────────────────────────────────────────
// Keep the weight fixed and push reps up to the top of your range;
// once you can hit the top on half your sets or more, the weight goes
// up and reps drop back to the bottom of the range.
//
// Rep ranges follow the standard evidence-based bands: ~1-6 for
// strength, 6-12 for hypertrophy, 12-15 for higher-rep hypertrophy,
// and 15+ for muscular endurance.

import { resolveExerciseName, getWeightsResetAt } from './utils.js'

export const REP_TARGETS = [
  { id: 'strength',   label: 'قوة',          base: 4,  top: 6,  desc: 'أوزان ثقيلة · ٤-٦ عدات' },
  { id: 'muscle',     label: 'بناء عضلي',    base: 8,  top: 12, desc: 'المدى الكلاسيكي · ٨-١٢ عدة' },
  { id: 'volume',     label: 'تضخيم',        base: 12, top: 15, desc: 'عدات أعلى · ١٢-١٥ عدة' },
  { id: 'endurance',  label: 'تحمل عضلي',    base: 15, top: 20, desc: 'وزن أخف · ١٥-٢٠ عدة' },
]

export const DEFAULT_REP_TARGET = { id: 'volume', base: 12, top: 15 }

export const repTargetOf = (cfg = {}) => {
  if (cfg.id === 'custom') {
    const base = Math.max(1, Math.round(cfg.base ?? 12))
    const top  = Math.max(base + 1, Math.round(cfg.top ?? base + 3))
    return { id: 'custom', base, top }
  }
  return REP_TARGETS.find(t => t.id === cfg.id) || DEFAULT_REP_TARGET
}

// The weight a session was actually worked at: the most-used value
// across its sets, breaking ties toward the heavier one.
const workingWeightOf = (sets) => {
  const counts = new Map()
  for (const s of sets) {
    const w = parseFloat(s.weight)
    if (w > 0) counts.set(w, (counts.get(w) || 0) + 1)
  }
  let best = null, bestCount = 0
  for (const [w, n] of counts) {
    if (n > bestCount || (n === bestCount && w > best)) { best = w; bestCount = n }
  }
  return best
}

/**
 * Where this exercise stands in the progression.
 *   suggestedReps    — what to pre-fill the reps box with
 *   readyToIncrease  — show the "ارفع وزنك" tag
 *   sessionsAtWeight — how many sessions in a row at the current weight
 */
export function analyzeProgression(sessions, exerciseName, mapping = {}, targetCfg = DEFAULT_REP_TARGET) {
  const target   = repTargetOf(targetCfg)
  const resolved = resolveExerciseName(exerciseName, mapping)
  const resetAt  = getWeightsResetAt()

  const entries = []
  for (const session of sessions || []) {
    if ((session.id || 0) < resetAt) continue
    for (const ex of session.exercises || []) {
      if (resolveExerciseName(ex.name, mapping) !== resolved) continue
      const sets = (ex.sets || []).filter(s => parseFloat(s.weight) > 0)
      if (sets.length) entries.push({ id: session.id || 0, sets })
    }
  }

  const empty = {
    workingWeight: null, sessionsAtWeight: 0, setsAtTop: 0, totalSets: 0,
    suggestedReps: target.base, readyToIncrease: false, target,
  }
  if (!entries.length) return empty

  entries.sort((a, b) => b.id - a.id) // newest first

  const workingWeight = workingWeightOf(entries[0].sets)
  if (workingWeight == null) return empty

  let sessionsAtWeight = 0
  for (const e of entries) {
    if (workingWeightOf(e.sets) === workingWeight) sessionsAtWeight++
    else break
  }

  // Did the last session clear the top of the range on half its sets?
  const lastSets  = entries[0].sets
  const setsAtTop = lastSets.filter(s => (parseInt(s.reps) || 0) >= target.top).length
  const readyToIncrease = setsAtTop >= Math.ceil(lastSets.length / 2)

  const suggestedReps =
    readyToIncrease        ? target.base :  // heavier weight → restart at the bottom
    sessionsAtWeight >= 2  ? target.top  :  // settled at this weight → push reps
                             target.base

  return {
    workingWeight, sessionsAtWeight, setsAtTop, totalSets: lastSets.length,
    suggestedReps, readyToIncrease, target,
  }
}
