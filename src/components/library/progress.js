// ── What the history says about each exercise ─────────────────
//
// Read-only views over the saved sessions, for the library's «تقدمي»
// and «المعدات» and for the info sheet's «سجلك». Nothing here writes,
// and nothing here changes what is stored: the old design reads the
// same sessions.
//
// One entry per session the exercise was trained in, oldest first:
//   maxW   the heaviest weight lifted that day
//   reps   the reps done at that weight (the best of them)
//   e1rm   the day's best estimated one-rep max (Epley, utils.calc1RM),
//          the number that moves while double progression keeps the
//          weight flat for weeks (critique F37)

import { calc1RM, getWeightsResetAt, resolveExerciseName } from '../../utils.js'

/** Sessions → `[{ name, muscle, aliases, entries }]`, keyed by the canonical name. */
export function buildProgress(sessions, mapping = {}) {
  const map = {}
  const resetAt = getWeightsResetAt()
  const sorted = [...(sessions || [])]
    .filter(s => (s.id || 0) >= resetAt)
    .sort((a, b) => a.id - b.id)
  for (const session of sorted) {
    for (const ex of session.exercises || []) {
      const validSets = (ex.sets || []).filter(s => parseFloat(s.weight) > 0)
      if (!validSets.length) continue
      const maxW = Math.max(...validSets.map(s => parseFloat(s.weight)))
      const reps = Math.max(0, ...validSets.filter(s => parseFloat(s.weight) === maxW).map(s => parseInt(s.reps) || 0))
      const e1rm = Math.max(...validSets.map(s => calc1RM(s.weight, s.reps) || parseFloat(s.weight)))
      const totalReps = validSets.reduce((t, s) => t + (parseInt(s.reps) || 0), 0)
      const lowerName = ex.name?.toLowerCase() || ''
      const mappedKey = Object.entries(mapping).find(([k]) => k.toLowerCase() === lowerName)?.[1]
      const key = mappedKey || ex.name
      if (!map[key]) map[key] = { name: key, muscle: ex.muscle, aliases: new Set(), entries: [] }
      map[key].aliases.add(ex.name)
      map[key].entries.push({
        sessionId: session.id, date: session.date, deload: !!session.deload,
        maxW, reps, e1rm, sets: validSets.length, totalReps,
      })
    }
  }
  return Object.values(map).map(ex => ({ ...ex, aliases: [...ex.aliases] }))
}

/** The summary a row or the sheet shows. Null when there is no history. */
export function summarize(ex) {
  if (!ex || !ex.entries?.length) return null
  const entries = ex.entries
  const last = entries[entries.length - 1]
  const best = Math.max(...entries.map(e => e.maxW))
  return {
    last,
    best,
    sessions: entries.length,
    e1rm: Math.round(last.e1rm),
    trend: entries.map(e => e.e1rm),
  }
}

/** One exercise's history, matched through the user's name mapping. */
export function recordFor(progress, name, mapping = {}) {
  const want = resolveExerciseName(name, mapping)
  return progress.find(p =>
    p.name.toLowerCase() === want ||
    resolveExerciseName(p.name, mapping) === want ||
    p.aliases.some(a => resolveExerciseName(a, mapping) === want)) || null
}

/** «جلسة وحدة · جلستين · 5 جلسات · 30 جلسة» — Arabic counts agree with the noun. */
export function countWord(n, [one, two, few, many]) {
  if (n === 1) return { n: null, word: one }
  if (n === 2) return { n: null, word: two }
  return { n, word: n >= 3 && n <= 10 ? few : many }
}
export const SESSION_WORDS = ['جلسة وحدة', 'جلستين', 'جلسات', 'جلسة']
export const EXERCISE_WORDS = ['تمرين واحد', 'تمرينين', 'تمارين', 'تمرين']

/** «80» or «77.5» — never «77.50». */
export const fmtKg = (kg) => {
  const v = Number(kg)
  if (!Number.isFinite(v)) return String(kg ?? '')
  return Number.isInteger(v) ? String(v) : String(+v.toFixed(2))
}
