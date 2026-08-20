// ── Double progression ────────────────────────────────────────
// One cycle, always in the same order:
//
//   hold the bottom (12) → reach for the top (15) → add weight → 12
//
// Nothing skips a step. Landing on a new weight never suggests adding
// more straight away: you first have to hold the bottom of the range
// for two sessions running, which is what opens the reach-for-the-top
// phase. Raising the weight starts the cycle over — the top-phase
// state does not carry across, because it was earned at a weight you
// are no longer lifting.
//
// Only completed sets count. A set with numbers typed into it but no
// tick is a plan, not a result, and planning to lift something has
// never made anyone stronger.
//
// Rep ranges follow the standard evidence-based bands: ~1-6 for
// strength, 6-12 for hypertrophy, 12-15 for higher-rep hypertrophy,
// and 15+ for muscular endurance.

import { resolveExerciseName, getWeightsResetAt, roundToPlate, PLATE_STEP } from './utils.js'

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

// A set counts only once it is ticked off. Weight alone means the row
// was filled in, not that the work was done.
export const isCompleted = (s) => !!s?.done && parseFloat(s.weight) > 0

// How many of these sets reached at least `reps`.
const setsReaching = (sets, reps) =>
  sets.filter(s => (parseInt(s.reps) || 0) >= reps).length

// Half the sets, rounded up. The single threshold behind every rule
// here, so "half" can never mean two different things in two places.
const halfOf = (n) => Math.ceil(n / 2)

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
 *   hint             — the single coaching tag: raise | lower | push | null
 *   sessionsAtBase   — sessions in a row holding the bottom of the range
 *   inTopPhase       — the reach-for-the-top phase is open
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
      const sets = (ex.sets || []).filter(isCompleted)
      if (sets.length) entries.push({ id: session.id || 0, sets })
    }
  }

  const empty = {
    workingWeight: null, sessionsAtWeight: 0, sessionsAtBase: 0, inTopPhase: false,
    setsAtTop: 0, totalSets: 0, suggestedReps: target.base,
    readyToIncrease: false, readyToDecrease: false, readyToPush: false,
    failedAtWeight: 0, suggestedWeight: null, target, hint: null, needAtTop: 0,
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

  const lastSets  = entries[0].sets
  const setsAtTop = setsReaching(lastSets, target.top)
  const needAtTop = halfOf(lastSets.length)

  // How many sessions running, at this weight, held the bottom of the
  // range on half the sets or more. Two of them is what opens the
  // reach-for-the-top phase. The loop breaks on a change of weight, so
  // raising the weight resets the count and the cycle starts over.
  let sessionsAtBase = 0
  for (const e of entries) {
    if (workingWeightOf(e.sets) !== workingWeight) break
    if (setsReaching(e.sets, target.base) < halfOf(e.sets.length)) break
    sessionsAtBase++
  }
  const inTopPhase = sessionsAtBase >= 2

  // The other direction: if the bottom of the range keeps being out of
  // reach at this weight, the weight is simply too heavy. Counts the
  // run of most-recent sessions at this weight that fell short.
  let failedAtWeight = 0
  for (const e of entries) {
    if (workingWeightOf(e.sets) !== workingWeight) break
    if (setsReaching(e.sets, target.base) >= halfOf(e.sets.length)) break
    failedAtWeight++
  }

  // Adding weight is the last step of the cycle, never the first. It
  // needs the top phase to be open — two sessions holding the bottom —
  // and then the top itself on half the sets or more. Landing on a new
  // weight and hitting the top immediately is a good session, not a
  // reason to load more.
  const readyToIncrease = inTopPhase && setsAtTop >= needAtTop
  // Two sessions falling short is the signal: the suggestion is waiting
  // the next time this exercise comes up.
  const readyToDecrease = !readyToIncrease && failedAtWeight >= 2
  const readyToPush     = inTopPhase && !readyToIncrease && !readyToDecrease

  // Roughly 10% lighter, rounded to the nearest plate step. The step
  // itself lives in utils.js so the one granularity the gym actually
  // has is stated once rather than repeated wherever a weight is
  // rounded.
  const suggestedWeight = readyToDecrease
    ? Math.max(PLATE_STEP, roundToPlate(workingWeight * 0.9))
    : null

  const suggestedReps =
    readyToIncrease ? target.base :  // heavier weight → restart at the bottom
    readyToDecrease ? target.base :  // lighter weight → aim for the bottom
    readyToPush     ? target.top  :  // holding the bottom → reach for the top
                      target.base

  // One coaching hint at a time. Deriving a single state here makes it
  // structurally impossible for the card to show two contradictory tags
  // (e.g. "push to 15" alongside "add weight").
  //   raise → in the top phase and cleared the top, time for more weight
  //   lower → the bottom of the range keeps being out of reach
  //   push  → held the bottom twice, now reach for the top
  const hint =
    readyToIncrease ? 'raise' :
    readyToDecrease ? 'lower' :
    readyToPush     ? 'push'  :
                      null

  return {
    workingWeight, sessionsAtWeight, sessionsAtBase, inTopPhase,
    setsAtTop, totalSets: lastSets.length,
    suggestedReps, readyToIncrease, readyToDecrease, readyToPush,
    failedAtWeight, suggestedWeight, target, hint, needAtTop,
  }
}
