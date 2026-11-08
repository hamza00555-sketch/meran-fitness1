// ── What sits at the top of Home ──────────────────────────────
// The streak number by default; Hamza can swap it in Settings (حمزة:
// «ابغى الخيار اني اقدر استبدل معلومة الكم يوم استريك عندي بمعلومة
// ثانية … الاوزان … سكرولينج ما بين الاوزان»). He chose four:
//   · streak   the flame and the number, as before
//   · weights  his best weight in each exercise of his plan, one after
//              another, today's first
//   · month    this month in a number at a time: sessions (against his
//              goal, if he set one), tons lifted, new best weights
//   · level    his level and the XP left to the next one
// The choice is a key of the new design's own (HOME_TOP_KEY); the old
// design never reads it. Pure: no React, no storage.

import { dayKey } from './day.js'
import { getExerciseStats, substitutedName, xpProgress } from './utils.js'
import { sessionVolume } from './sets.js'
import { monthGoalOf } from './monthReport.js'
import { isDeloadSession } from './deload.js'

export const HOME_TOP_KEY = 'meran_home_top'
export const HOME_TOPS = [
  { id: 'streak',  label: 'الستريك',       line: 'كم يوم ستريك عندك' },
  { id: 'weights', label: 'أوزانك',         line: 'أعلى وزن بكل تمرين من خطتك، يتقلب كل كم ثانية' },
  { id: 'month',   label: 'هالشهر',         line: 'جلساتك وهدفك، والأطنان، والأوزان الجديدة' },
  { id: 'level',   label: 'المستوى',        line: 'مستواك وكم باقي على اللي بعده' },
]
export const homeTopOf = (v) => (HOME_TOPS.some(t => t.id === v) ? v : 'streak')

// One item on screen for this long before the next comes.
export const HOME_TOP_EVERY_MS = 4000

/**
 * His best weight in each exercise of his plan (as he does it: with his
 * swaps), today's plan day first, then the rest in plan order; one entry
 * per exercise, those he has lifted only. With no plan, the exercises of
 * his last sessions.
 * @returns {{ name: string, kg: number }[]}
 */
export function bestWeights({ plan, planIndex = 0, sessions = [], mapping = {}, subs = {}, alternatives = {} }) {
  const days = plan?.weeklySchedule || []
  const order = []
  if (days.length) {
    const at = ((planIndex % days.length) + days.length) % days.length
    for (let k = 0; k < days.length; k++) {
      for (const ex of days[(at + k) % days.length]?.exercises || []) order.push(substitutedName(ex.name, subs, alternatives))
    }
  } else {
    for (const s of sessions || []) for (const ex of s.exercises || []) order.push(ex.name)
  }
  const seen = new Set()
  const out = []
  for (const name of order) {
    if (!name || seen.has(name)) continue
    seen.add(name)
    const { maxWeight } = getExerciseStats(sessions, name, mapping)
    if (maxWeight > 0) out.push({ name, kg: maxWeight })
  }
  return out
}

/**
 * This month, one number at a time.
 * @returns {{ id: string, value: number, of?: number, unit: string, label: string }[]}
 */
export function monthNumbers({ sessions = [], today, goals = {} }) {
  const month = String(dayKey(today)).slice(0, 7)
  const inMonth = (sessions || []).filter(s => s?.date && dayKey(s.date).slice(0, 7) === month)
  const out = []
  const goal = monthGoalOf(goals, month)
  out.push(goal?.kind === 'sessions'
    ? { id: 'sessions', value: inMonth.length, of: goal.target, unit: 'جلسة', label: 'هدف الشهر' }
    : { id: 'sessions', value: inMonth.length, unit: inMonth.length === 1 ? 'جلسة' : 'جلسات', label: 'هالشهر' })
  const tons = Math.round(inMonth.reduce((t, s) => t + sessionVolume(s), 0) / 100) / 10
  if (tons > 0) out.push({ id: 'tons', value: tons, unit: 'طن', label: 'شلتها هالشهر' })
  const records = newBestsIn(sessions, month)
  if (records > 0) out.push({ id: 'records', value: records, unit: records === 1 ? 'وزن جديد' : 'أوزان جديدة', label: 'هالشهر' })
  return out
}

/** How many exercises beat their best weight this month (each counted once). */
export function newBestsIn(sessions = [], month) {
  const best = new Map()
  const beat = new Set()
  const sorted = [...(sessions || [])].filter(s => s?.date).sort((a, b) => (a.id || 0) - (b.id || 0))
  for (const s of sorted) {
    if (isDeloadSession(s)) continue
    const thisMonth = dayKey(s.date).slice(0, 7) === month
    for (const ex of s.exercises || []) {
      const top = Math.max(0, ...(ex.sets || []).filter(x => x?.done).map(x => parseFloat(x.weight) || 0))
      if (!(top > 0)) continue
      const before = best.get(ex.name)
      if (thisMonth && before != null && top > before) beat.add(ex.name)
      if (before == null || top > before) best.set(ex.name, top)
    }
  }
  return beat.size
}

/** His level and what is left to the next. */
export function levelNow(xp = 0) {
  const p = xpProgress(xp || 0)
  return { level: p.level, left: Math.max(0, p.neededXP - p.currentXP), frac: p.neededXP > 0 ? p.currentXP / p.neededXP : 1 }
}
