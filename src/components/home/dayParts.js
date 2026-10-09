// ── What a plan day is called on Home ─────────────────────────
//
// The Today stage names the day with ONE Arabic word at display size —
// «دفع», «سحب», «أرجل» — never «Pull Day». The word is derived from
// planDayType(), the same source every other screen reads, so a plan
// with its own Arabic labels keeps them and a built-in plan's «Push A»
// becomes «دفع» with its variant letter kept beside it.
//
// Pure functions only: no React, no storage. UI wording, not engine
// logic — nothing here decides what a day *is*.

import { planDayType } from '../../utils.js'
import { MUSCLE_GROUPS } from '../../constants.js'

const WORDS = {
  push: 'دفع',
  pull: 'سحب',
  legs: 'أرجل',
  leg: 'أرجل',
  upper: 'علوي',
  lower: 'سفلي',
  'full body': 'شامل',
  fullbody: 'شامل',
  'explosive full body': 'انفجاري',
  explosive: 'انفجاري',
  chest: 'صدر',
  back: 'ظهر',
  shoulders: 'أكتاف',
  arms: 'ذراعين',
  core: 'بطن',
  abs: 'بطن',
  cardio: 'كارديو',
  rest: 'راحة',
}

const ARABIC = /[؀-ۿ]/

/**
 * { word, variant, latin } for a plan day.
 *   word    — the Arabic word to print large («دفع»)
 *   variant — a trailing letter/number the plan uses to tell two days of
 *             the same kind apart («A», «B»), or ''
 *   latin   — true when no Arabic word was found and `word` is the raw
 *             label (printed in the Latin face rather than invented)
 */
export function dayWord(day) {
  const raw = String(planDayType(day) || '').replace(/\s+day$/i, '').trim()
  if (!raw) return { word: '', variant: '', latin: false }
  if (ARABIC.test(raw)) return { word: raw, variant: '', latin: false }

  const key = raw.toLowerCase()
  if (WORDS[key]) return { word: WORDS[key], variant: '', latin: false }

  // «Push A», «Pull B», «Legs 2»
  const m = raw.match(/^(.*?)[\s-]+([A-Za-z]|\d{1,2})$/)
  if (m && WORDS[m[1].toLowerCase()]) {
    return { word: WORDS[m[1].toLowerCase()], variant: m[2].toUpperCase(), latin: false }
  }
  // «Push Heavy» — the first word names the kind.
  const first = key.split(/\s+/)[0]
  if (WORDS[first]) return { word: WORDS[first], variant: '', latin: false }

  return { word: raw, variant: '', latin: true }
}

/** The muscles the day trains, in Arabic: the plan's own line after «—»
 *  when it has one, otherwise the groups its exercises name. */
export function musclesLine(day) {
  const name = String(day?.name || '')
  if (name.includes('—')) {
    const tail = name.split('—').slice(1).join('—').trim()
    if (tail) return tail
  }
  const seen = []
  for (const ex of day?.exercises || []) {
    const label = MUSCLE_GROUPS[ex.muscle]?.label
    if (label && !seen.includes(label)) seen.push(label)
  }
  return seen.join('، ')
}

/** The muscle most of the day's exercises work — the one the stage lights. */
export function mainMuscle(day) {
  const counts = new Map()
  for (const ex of day?.exercises || []) {
    if (!ex?.muscle || !MUSCLE_GROUPS[ex.muscle]) continue
    counts.set(ex.muscle, (counts.get(ex.muscle) || 0) + 1)
  }
  let best = null, n = 0
  for (const [m, c] of counts) if (c > n) { best = m; n = c }
  return best
}

/** The shipped artwork for a muscle group (always on disk, works offline). */
export const muscleArt = (muscle) => MUSCLE_GROUPS[muscle]?.img || null

/** A rough length for the session: each set's rest plus ~40s of work,
 *  rounded to five minutes. Shown as «≈45 د», so it only has to be honest
 *  to the nearest few minutes. */
export function estimateMinutes(day) {
  let sec = 0
  for (const ex of day?.exercises || []) {
    const sets = Number(ex.sets) || 3
    const rest = Number(ex.restSeconds) || 90
    sec += sets * (rest + 40)
  }
  if (!sec) return 0
  return Math.max(5, Math.round(sec / 60 / 5) * 5)
}

/** «مجموعة» with the count rules the app uses everywhere else. */
export const setsUnit = (n) => {
  const k = Math.max(0, Math.round(Number(n) || 0))
  const r = k % 100
  return (k === 0 || (r >= 3 && r <= 10)) ? 'مجموعات' : 'مجموعة'
}
