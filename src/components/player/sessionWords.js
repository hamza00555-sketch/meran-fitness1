// ── Words and small numbers for session mode ──────────────────
//
// Pure helpers the player and its sheets share: the day as one Arabic
// word, the clock, Arabic counting of sets, kilos printed without
// trailing zeros, and what this exercise looked like last time. Nothing
// here writes anything; the engines stay where they are.

import { planDayType, resolveExerciseName, getWeightsResetAt } from '../../utils.js'

// The day word the home stage uses: one Arabic word, never «Push Day».
const DAY_WORDS = {
  push: 'دفع', pull: 'سحب', legs: 'أرجل', leg: 'أرجل', upper: 'علوي', lower: 'سفلي',
  'full body': 'جسم كامل', fullbody: 'جسم كامل', arms: 'ذراعين', chest: 'صدر',
  back: 'ظهر', shoulders: 'أكتاف', core: 'بطن', cardio: 'كارديو',
}

export function dayWord(active) {
  const type = planDayType({
    name: active?.planDayName || active?.name || '',
    exercises: active?.exercises || [],
  })
  const key = String(type || '').trim().toLowerCase().replace(/\s*day$/, '')
  if (DAY_WORDS[key]) return DAY_WORDS[key]
  if (/[؀-ۿ]/.test(type || '')) return String(type).trim()
  return 'تمرين'
}

/** 07:42, or 1:07:42 past the hour. */
export function clock(secs) {
  const s = Math.max(0, Math.floor(secs || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(r).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** 1:26 for a rest — minutes unpadded, the way a stopwatch reads. */
export function restClock(secs) {
  const s = Math.max(0, Math.round(secs || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** 77.5 → "77.5", 75 → "75", "" → "". */
export function kg(v) {
  const n = parseFloat(v)
  if (!Number.isFinite(n)) return ''
  return String(Math.round(n * 100) / 100)
}

/** Arabic counting for «مجموعة»: واحدة، مجموعتين، 3 مجموعات، 11 مجموعة. */
export function setsPhrase(n) {
  if (n === 1) return { num: null, word: 'مجموعة واحدة' }
  if (n === 2) return { num: null, word: 'مجموعتين' }
  if (n >= 3 && n <= 10) return { num: n, word: 'مجموعات' }
  return { num: n, word: 'مجموعة' }
}

/**
 * The sets of the last real session that had this exercise, in order —
 * the «السابق» column. Same filters as the stats engines: weights reset
 * and deload weeks are not what the exercise is worked at.
 */
export function previousSets(sessions, name, mapping = {}) {
  const resolved = resolveExerciseName(name, mapping)
  const resetAt = getWeightsResetAt()
  let best = null
  let bestId = -Infinity
  for (const s of sessions || []) {
    if ((s.id || 0) < resetAt || s.deload) continue
    for (const ex of s.exercises || []) {
      if (resolveExerciseName(ex.name, mapping) !== resolved) continue
      const done = (ex.sets || []).filter(st => st.done && (parseFloat(st.weight) > 0 || parseInt(st.reps) > 0))
      if (done.length && (s.id || 0) > bestId) { bestId = s.id || 0; best = done }
    }
  }
  return best || []
}

/** «75×12», or «75» when the reps were never typed. */
export function setLabel(s) {
  if (!s) return ''
  const w = kg(s.weight)
  const r = parseInt(s.reps)
  if (w && r > 0) return `${w}×${r}`
  return w || (r > 0 ? `×${r}` : '')
}
