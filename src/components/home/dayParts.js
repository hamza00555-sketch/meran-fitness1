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

// «الأرجل» and «أرجل» are the same word for this purpose.
const bare = (s) => String(s || '').trim().replace(/^ال/, '')
const sameWord = (a, b) => !!a && !!b && bare(a) === bare(b)

// A leg day is one group in the catalogue, so its groups only repeat
// «أرجل». What tells two leg days apart is which part of the leg each
// exercise works — read from the name, because that is all a plan
// stores. UI wording only.
const LEG_PARTS = [
  ['front', /squat|leg press|extension|lunge|split|step[- ]?up|sissy/i],
  ['back',  /curl|romanian|\brdl\b|stiff|good morning|hamstring|nordic/i],
  ['glute', /glute|hip thrust|kickback|bridge|abduct/i],
  ['calf',  /calf|calves/i],
]
function legParts(exercises) {
  const found = new Set()
  for (const ex of exercises) {
    if (ex?.muscle !== 'Legs') continue
    const hit = LEG_PARTS.find(([, re]) => re.test(ex.name || ''))
    if (hit) found.add(hit[0])
  }
  const out = []
  if (found.has('front') && found.has('back')) out.push('فخذ')
  else if (found.has('front')) out.push('فخذ أمامي')
  else if (found.has('back')) out.push('فخذ خلفي')
  if (found.has('glute')) out.push('أرداف')
  if (found.has('calf')) out.push('سمانة')
  return out
}

/** The muscles the day trains, in Arabic: the plan's own line after «—»
 *  when it has one, otherwise the groups its exercises name. Never the
 *  day's own word again: «أرجل» over «أرجل» says nothing, so a leg day
 *  names the parts of the leg instead, and a line with nothing new to
 *  say is left out (''). Pass the word the stage already prints. */
export function musclesLine(day, word = dayWord(day).word) {
  const name = String(day?.name || '')
  if (name.includes('—')) {
    // «انفجاري، مؤخرة، بطن» under «انفجاري»: the list without the word.
    const items = name.split('—').slice(1).join('—').split(/[،,]/).map(s => s.trim()).filter(Boolean)
    const fresh = items.filter(s => !sameWord(s, word))
    if (fresh.length) return fresh.join('، ')
  }
  const exercises = day?.exercises || []
  const seen = []
  for (const ex of exercises) {
    const label = GROUP_WORD[ex.muscle] || bare(MUSCLE_GROUPS[ex.muscle]?.label)
    if (label && !seen.includes(label)) seen.push(label)
  }
  const fresh = seen.filter(l => !sameWord(l, word))
  if (fresh.length === seen.length) return seen.join('، ')
  // A group repeats the word (a leg day): the parts of the leg instead.
  return [...legParts(exercises), ...fresh].join('، ')
}

// The groups as the plans write them: «صدر، أكتاف»، not «الصدر، الأكتاف».
const GROUP_WORD = {
  Chest: 'صدر', Back: 'ظهر', Shoulders: 'أكتاف', Legs: 'أرجل',
  Biceps: 'بايسبس', Triceps: 'ترايسبس', Core: 'بطن', Cardio: 'كارديو',
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
