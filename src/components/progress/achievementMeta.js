// ── What each medal shows, and how far along it is ────────────
//
// The achievements in constants.js only say whether they are earned.
// The medal wall needs two more things for every one of them:
//
//   1. something to engrave on the offline medal, so forty badges do
//      not collapse into four identical pictures — a Phosphor glyph and
//      the badge's own threshold («25», «5 طن»);
//   2. how close a locked one is, for the «التالي» row — computed from
//      the same session data the checks read, never stored.
//
// UI only. Nothing here decides whether an achievement is earned; the
// `check` functions in constants.js still do that.

import {
  Footprints, CalendarCheck, Timer, SunHorizon, Barbell, Stack, PersonSimple,
  Brain, Flame, ArrowCounterClockwise, Target, CalendarBlank, Scales, Mountains,
  Planet, Notepad, ListChecks, Waves,
} from '@phosphor-icons/react'
import { setCounts, sessionVolume } from '../../sets.js'
import { dayKey } from '../../day.js'
import { arabicName } from '../../exerciseMedia.js'

/** The numbers every progress bar is measured from — one pass over the history. */
export function progressContext(sessions = [], streak = 0) {
  const now = Date.now()
  const weekAgo = now - 7 * 86400000
  const monthAgo = now - 30 * 86400000
  const perDay = {}
  const days7 = new Set()
  const days30 = new Set()
  const exercises = new Set()
  let maxDuration = 0, maxWeight = 0, maxSets = 0, totalSets = 0, maxMuscles = 0
  let maxSessionVolume = 0, totalVolume = 0, weekVolume = 0, weightedSets = 0
  let bigTwo = 0, bigThree = 0

  for (const s of sessions) {
    const ex = s.exercises || []
    const t = new Date(s.date).getTime()
    const d = dayKey(s.date)
    perDay[d] = (perDay[d] || 0) + 1
    if (t > weekAgo) days7.add(d)
    if (t > monthAgo) days30.add(d)
    maxDuration = Math.max(maxDuration, s.duration || 0)
    const vol = sessionVolume(s)
    maxSessionVolume = Math.max(maxSessionVolume, vol)
    totalVolume += vol
    if (t > weekAgo) weekVolume += vol
    let setsHere = 0
    const muscles = new Set()
    const names = new Set()
    for (const e of ex) {
      exercises.add(e.name)
      names.add(e.name)
      muscles.add(e.muscle)
      for (const ss of e.sets || []) {
        const w = parseFloat(ss.weight) || 0
        if (w > 0) weightedSets++
        if (setCounts(ss)) {
          setsHere++
          maxWeight = Math.max(maxWeight, w)
        }
      }
    }
    totalSets += setsHere
    maxSets = Math.max(maxSets, setsHere)
    maxMuscles = Math.max(maxMuscles, muscles.size)
    bigTwo = Math.max(bigTwo, ['Deadlift', 'Bench Press'].filter(n => names.has(n)).length)
    bigThree = Math.max(bigThree, ['Deadlift', 'Barbell Squat', 'Bench Press'].filter(n => names.has(n)).length)
  }

  return {
    sessions: sessions.length, streak: streak || 0,
    maxDuration, maxPerDay: Math.max(0, ...Object.values(perDay)),
    maxWeight, maxSets, totalSets, maxMuscles,
    days7: days7.size, days30: days30.size,
    maxSessionVolume, totalVolume, weekVolume, weightedSets,
    exercises: exercises.size, bigTwo, bigThree,
  }
}

// The lifts b7/b8 name, by their Arabic names first — the copy in
// constants.js writes them in English inside an Arabic sentence.
const lifts = (...names) => {
  const ar = names.map(n => arabicName(n) || n)
  const last = ar.pop()
  const andLast = /^[A-Za-z]/.test(last) ? `و ${last}` : `و${last}`
  return ar.length ? `${ar.join('، ')} ${andLast}` : last
}

// One row per achievement. `mark` is what is engraved on the medal
// (n = the number, u = its unit, shown only where there is room);
// `of` reads the current value from the context and `target` is where
// the check flips. `of: null` = a yes/no badge with no meaningful bar.
// `title` / `desc`, where present, replace the constants.js copy on
// screen only: «سيت» becomes «مجموعة», lifts get their Arabic names.
// constants.js — and so the old design and stored data — is untouched.
const T = 1000 // a ton, in kg
const META = {
  a1:  { glyph: Footprints,     mark: { n: '1' },                of: c => c.sessions,         target: 1 },
  a2:  { glyph: CalendarCheck,  mark: { n: '5', u: 'جلسات' },    of: c => c.sessions,         target: 5 },
  a3:  { glyph: CalendarCheck,  mark: { n: '10', u: 'جلسات' },   of: c => c.sessions,         target: 10 },
  a4:  { glyph: CalendarCheck,  mark: { n: '25', u: 'جلسة' },    of: c => c.sessions,         target: 25 },
  a5:  { glyph: CalendarCheck,  mark: { n: '50', u: 'جلسة' },    of: c => c.sessions,         target: 50 },
  a6:  { glyph: CalendarCheck,  mark: { n: '100', u: 'جلسة' },   of: c => c.sessions,         target: 100 },
  a7:  { glyph: CalendarCheck,  mark: { n: '200', u: 'جلسة' },   of: c => c.sessions,         target: 200 },
  a8:  { glyph: Timer,          mark: { n: '1', u: 'س' },   of: c => c.maxDuration,      target: 60 },
  a9:  { glyph: Timer,          mark: { n: '2', u: 'س' },  of: c => c.maxDuration,      target: 120 },
  a10: { glyph: SunHorizon,     mark: { n: '3', u: 'بيوم' },     of: c => c.maxPerDay,        target: 3 },

  b1:  { glyph: Barbell,        mark: { n: '100', u: 'كجم' },    of: c => c.maxWeight,        target: 100 },
  b2:  { glyph: Barbell,        mark: { n: '140', u: 'كجم' },    of: c => c.maxWeight,        target: 140 },
  b3:  { glyph: Barbell,        mark: { n: '180', u: 'كجم' },    of: c => c.maxWeight,        target: 180 },
  b4:  { glyph: Barbell,        mark: { n: '200', u: 'كجم' },    of: c => c.maxWeight,        target: 200 },
  b5:  { glyph: Stack,          mark: { n: '15', u: 'مجموعة' },  of: c => c.maxSets,          target: 15,
         title: '15 مجموعة في جلسة', desc: 'كمّل 15 مجموعة في جلسة وحدة' },
  b6:  { glyph: Stack,          mark: { n: '30', u: 'مجموعة' },  of: c => c.maxSets,          target: 30,
         title: '30 مجموعة في جلسة', desc: 'كمّل 30 مجموعة في جلسة وحدة' },
  b7:  { glyph: Barbell,        mark: { n: '2', u: 'رفعات' },    of: c => c.bigTwo,           target: 2,
         desc: `تمرّن ${lifts('Deadlift', 'Bench Press')} في نفس الجلسة` },
  b8:  { glyph: Barbell,        mark: { n: '3', u: 'رفعات' },    of: c => c.bigThree,         target: 3,
         desc: `تمرّن ${lifts('Deadlift', 'Barbell Squat', 'Bench Press')} في نفس الجلسة` },
  b9:  { glyph: PersonSimple,   mark: { n: '6', u: 'عضلات' },    of: c => c.maxMuscles,       target: 6 },
  b10: { glyph: Brain,          mark: { n: '500', u: 'مجموعة' }, of: c => c.totalSets,        target: 500,
         desc: 'كمّل 500 مجموعة من أول جلسة لين الحين' },

  c1:  { glyph: Flame,          mark: { n: '3', u: 'أيام' },     of: c => c.streak,           target: 3 },
  c2:  { glyph: Flame,          mark: { n: '7', u: 'أيام' },     of: c => c.streak,           target: 7 },
  c3:  { glyph: Flame,          mark: { n: '14', u: 'يوم' },     of: c => c.streak,           target: 14 },
  c4:  { glyph: Flame,          mark: { n: '30', u: 'يوم' },     of: c => c.streak,           target: 30 },
  c5:  { glyph: Flame,          mark: { n: '60', u: 'يوم' },     of: c => c.streak,           target: 60 },
  c6:  { glyph: Flame,          mark: { n: '100', u: 'يوم' },    of: c => c.streak,           target: 100 },
  c7:  { glyph: ArrowCounterClockwise,                            of: c => c.sessions,         target: 1 },
  c8:  { glyph: CalendarBlank,  mark: { n: '5', u: 'أيام' },     of: c => c.days7,            target: 5 },
  c9:  { glyph: Target,                                           of: null },
  c10: { glyph: CalendarBlank,  mark: { n: '20', u: 'يوم' },     of: c => c.days30,           target: 20 },

  d1:  { glyph: Scales,         mark: { n: '1', u: 'طن' },       of: c => c.maxSessionVolume, target: 1 * T },
  d2:  { glyph: Scales,         mark: { n: '5', u: 'طن' },       of: c => c.maxSessionVolume, target: 5 * T },
  d3:  { glyph: Scales,         mark: { n: '10', u: 'طن' },      of: c => c.maxSessionVolume, target: 10 * T },
  d4:  { glyph: Mountains,      mark: { n: '100', u: 'طن' },     of: c => c.totalVolume,      target: 100 * T },
  d5:  { glyph: Planet,         mark: { n: '1000', u: 'طن' },    of: c => c.totalVolume,      target: 1000 * T },
  d6:  { glyph: Notepad,        mark: { n: '10', u: 'مجموعات' }, of: c => c.weightedSets,     target: 10,
         desc: 'سجّل الوزن في 10 مجموعات' },
  d7:  { glyph: Notepad,        mark: { n: '100', u: 'مجموعة' }, of: c => c.weightedSets,     target: 100,
         desc: 'سجّل الوزن في 100 مجموعة' },
  d8:  { glyph: ListChecks,     mark: { n: '5', u: 'تمارين' },   of: c => c.exercises,        target: 5 },
  d9:  { glyph: ListChecks,     mark: { n: '20', u: 'تمرين' },   of: c => c.exercises,        target: 20 },
  d10: { glyph: Waves,          mark: { n: '50', u: 'طن' },      of: c => c.weekVolume,       target: 50 * T },
}

const FALLBACK_GLYPH = { sessions: CalendarCheck, strength: Barbell, streak: Flame, volume: Scales }

/** Glyph + engraving for one achievement. */
export function medalFace(a) {
  const m = META[a.id]
  return { glyph: m?.glyph || FALLBACK_GLYPH[a.cat] || Target, mark: m?.mark || null }
}

/** The title and description to show: the display copy where META has
 *  one, otherwise constants.js as written. */
export function achText(a) {
  const m = a && META[a.id]
  return { title: m?.title || a?.title || '', desc: m?.desc || a?.desc || '' }
}

/**
 * How far along a locked achievement is: { value, target, ratio, label }
 * in display units (tons for volume). null when the badge is a plain
 * yes/no with nothing to count.
 */
export function progressOf(a, ctx) {
  const m = META[a.id]
  if (!m || !m.of || !ctx) return null
  const raw = Math.max(0, m.of(ctx) || 0)
  const ratio = Math.min(1, raw / m.target)
  const tons = m.mark?.u === 'طن'
  const show = (v) => tons ? +(v / T).toFixed(v < 10 * T ? 1 : 0) : Math.floor(v)
  return { value: show(Math.min(raw, m.target)), target: show(m.target), ratio, unit: m.mark?.u || '' }
}

/**
 * The three locked achievements nearest to flipping, closest first.
 * Equal progress keeps the order constants.js lists them in (sessions
 * first, then strength, streak, volume — roughly the order a new lifter
 * meets them).
 *
 * Before the first session «الخطوة الأولى» is pinned first, and
 * «عاد من جديد» («come back after a break») is left out: it flips on
 * the same first session, and it means nothing to someone who has not
 * started yet.
 */
export function nearestLocked(list, isEarned, ctx, n = 3) {
  const first = !ctx || !ctx.sessions
  return list
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => !isEarned(a.id) && !(first && a.id === 'c7'))
    .map(({ a, i }) => ({ a, i, p: progressOf(a, ctx) }))
    .filter(x => x.p)
    .sort((x, y) => (
      (first ? (y.a.id === 'a1') - (x.a.id === 'a1') : 0)
      || (y.p.ratio - x.p.ratio)
      || (x.i - y.i)
    ))
    .slice(0, n)
    .map(({ a, p }) => ({ a, p }))
}

// Dates the way the monthly report writes them: Gregorian months in
// Arabic, Western digits («8 يوليو 2026»), in the user's own timezone.
const LOCALE = 'ar-u-ca-gregory-nu-latn'

/** «8 يوليو» — with the year when it is not this year. */
export function fmtDay(dateLike, { weekday = false } = {}) {
  try {
    const d = new Date(dateLike)
    const opts = { day: 'numeric', month: 'long' }
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric'
    if (weekday) opts.weekday = 'long'
    return d.toLocaleDateString(LOCALE, opts)
  } catch { return '' }
}

/** Earned date and time: «8 يوليو 2026 · 6:40 م». */
export function fmtEarned(ms) {
  try {
    const d = new Date(ms)
    const date = d.toLocaleDateString(LOCALE, { year: 'numeric', month: 'long', day: 'numeric' })
    const time = d.toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit' })
    return `${date} · ${time}`
  } catch { return '' }
}
