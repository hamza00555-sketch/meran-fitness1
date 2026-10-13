// ── The month report as a story ───────────────────────────────
// What the story (components/report/Story.jsx) and its cards need on
// top of the month's numbers (monthReport.js): which cards have
// something to say, the geometry of the charts we draw ourselves, the
// before/after pair, whether this month's story was already seen, and
// what «طبّقها على خطتي» changes in the plan. Pure — no React, no DOM,
// no storage — so all of it runs under `node --test`.
//
// The approved order (plans/report.html, version 2):
//   cover · cal · jump · lifts · muscles · ba · goal · next · share
// A card with nothing to say is dropped: no new weight, no «أكبر قفزة»;
// fewer than two progress photos three weeks apart, no «قبل وبعد»; no
// goal set for the month, no «هدف الشهر».
//
// Time runs right to left in every chart, like every bar in the app:
// the start of the month is on the right, its end on the left.

import { dayKey } from './day.js'
import { addDays, dayDiff, patternFor } from './recovery.js'
import { countAr } from './streak.js'
import { resolveExerciseName, roundToPlate, PLATE_STEP } from './utils.js'
import {
  firstDayOf, lastDayOf, daysInMonth, monthName, prevMonth, nextMonth, monthKey,
  countWord, WEEKLY_SETS, creditsOf,
} from './monthReport.js'

// ── Seen ──────────────────────────────────────────────────────
// hf_report_seen = { 'YYYY-MM': true }. New in the redesign; the old
// design never reads it. The first time a month's report opens it plays
// as a story; after that it opens on the summary.

export const REPORT_SEEN_KEY = 'hf_report_seen'
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

// The report opens on the month's last two days too (monthReportWindow),
// before the month is over. A story seen then is marked 'partial': it
// stays seen while the month runs, and plays once more, whole, when the
// month is over (the final goal and streak).
//   storySeen(seen, month, today?) — `today` omitted: any mark counts.
//   withStorySeen(seen, month, today?) — `today` past the month (or
//   omitted): seen for good; otherwise 'partial'.

const isMap = (v) => !!(v && typeof v === 'object' && !Array.isArray(v))
const monthOver = (month, today) => !today || String(today).slice(0, 10) > lastDayOf(month)

export const storySeen = (seen, month, today) => {
  if (!isMap(seen) || !seen[month]) return false
  return seen[month] === 'partial' ? !monthOver(month, today) : true
}

export function withStorySeen(seen, month, today) {
  const next = isMap(seen) ? { ...seen } : {}
  if (!MONTH_RE.test(String(month))) return next
  if (next[month] === true) return next
  next[month] = monthOver(month, today) ? true : 'partial'
  return next
}

// ── Applied ───────────────────────────────────────────────────
// hf_report_applied = { 'YYYY-MM': 'YYYY-MM-DD' }: the day «طبّقها على
// خطتي» was used for that month's report. A new key; the old design
// never reads it. Once set, the button is not offered again (a second
// tap would add the sets twice and overwrite the saved old plan).

export const REPORT_APPLIED_KEY = 'hf_report_applied'

export const appliedOn = (map, month) =>
  (map && typeof map === 'object' && !Array.isArray(map) && typeof map[month] === 'string') ? map[month] : null

export function withApplied(map, month, day) {
  const next = map && typeof map === 'object' && !Array.isArray(map) ? { ...map } : {}
  if (!MONTH_RE.test(String(month))) return next
  if (day) next[month] = String(day)
  else delete next[month]
  return next
}

// ── The cards ─────────────────────────────────────────────────

export const CARD_ORDER = ['cover', 'cal', 'jump', 'lifts', 'muscles', 'ba', 'goal', 'next', 'share']

/** How long each card stays before the story turns on its own (ms).
 *  The last one waits for him. About a minute for all nine. */
export const CARD_MS = {
  cover: 5500, cal: 6500, jump: 7500, lifts: 6000, muscles: 6500,
  ba: 6500, goal: 6500, next: 7000, share: 0,
}

/** The cards this month has something to say on, in order. */
export function storyCards(report, { pair = null } = {}) {
  if (!report?.hasData) return []
  const out = ['cover', 'cal']
  if (report.jump) out.push('jump')
  if (liftRows(report).length) out.push('lifts')
  if ((report.muscles || []).length) out.push('muscles')
  if (pair) out.push('ba')
  if (report.goal) out.push('goal')
  out.push('next', 'share')
  return out
}

// ── «صرت أقوى؟» — the other lifts ─────────────────────────────
// The biggest jump has its own card, so it is left out here. Lifts that
// went up first, then the ones that held; a lift first done this month
// with nothing above its first session is a starting point, not a lift
// that failed to go up, and is not listed.

export const MAX_LIFT_ROWS = 4

export function liftRows(report, max = MAX_LIFT_ROWS) {
  const jumpLift = report?.jump?.lift
  return (report?.gains || [])
    .filter(g => g.lift !== jumpLift && (g.gain > 0 || !g.firstTime))
    .slice(0, max)
    .map(g => ({
      lift: g.lift, exercise: g.exercise, before: g.before, top: g.top,
      gain: g.gain, up: g.gain > 0, firstTime: !!g.firstTime,
    }))
}

/** The card's one sentence. */
export function liftsLine(report) {
  const rows = liftRows(report, Infinity)
  const up = rows.filter(r => r.up).length
  if (!up) {
    return report?.jump
      ? 'باقي تمارينك ما تعدّت أثقل وزن لها.'
      : 'ما تعدّيت أثقل وزن لك في ولا تمرين هالشهر.'
  }
  if (!report?.jump) return `وزنك زاد في ${countAr(up, 'workout')}.`
  if (up === 1) return 'ووزنك زاد في تمرين ثاني.'
  if (up === 2) return 'ووزنك زاد في تمرينين ثانيين.'
  const r = up % 100
  return `ووزنك زاد في ${countAr(up, 'workout')} ${r >= 3 && r <= 10 ? 'ثانية' : 'ثاني'}.`
}

/** One shared ruler for the gain bars: its end, its ticks, and the
 *  scale (a little past the end, so the last bar keeps room for its
 *  number). */
export function liftScale(rows = []) {
  const most = Math.max(0, ...rows.map(r => r.gain || 0))
  const top = most <= 2.5 ? 2.5 : most <= 5 ? 5 : most <= 10 ? 10 : Math.ceil(most / 10) * 10
  const ticks = top === 2.5 ? [0, 2.5] : [0, top / 2, top]
  return { top, ticks, max: top * 1.2 }
}

// ── «وين راح شغلك؟» ───────────────────────────────────────────

/** The muscles ruler: past the biggest bar and past the start of every
 *  row's band, so each band reads as a band. A band that runs past the
 *  end (the legs' 17–60) is drawn to the edge. */
export function muscleScale(rows = []) {
  const most = Math.max(0, ...rows.map(m => m.shown ?? m.perWeek ?? 0))
  const bands = Math.max(0, ...rows.map(m => Math.min(m.max ?? WEEKLY_SETS.max, Math.max(WEEKLY_SETS.max, (m.min ?? 0) + 6))))
  return Math.max(bands + 4, Math.ceil((most + 2) / 4) * 4)
}

// ── «أكبر قفزة» — one lift, week by week ─────────────────────
// The weekly series from monthReport's weeklyTop (oldest first). x and y
// are percentages of the plot. The horizontal line is the heaviest
// weight before the month; whatever part of the line is above it is
// drawn gold — a new weight. A deload week is a hollow dot, never joined
// to the line: it is neither a new weight nor a step back.

const fix = (n) => Math.round(n * 100) / 100

function niceTicks(lo, hi, want = 3) {
  const span = Math.max(1, hi - lo)
  const steps = [1, 2, 2.5, 5, 10, 20, 25, 50, 100]
  const step = steps.find(s => span / s <= want + 0.5) || 100
  const out = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 10) / 10)
  return out
}

export function jumpChart(jump, month) {
  const weeks = jump?.weekly || []
  const n = weeks.length
  if (!n) return null
  const prior = Number(jump.prevBest) || 0
  const X = (i) => fix(n === 1 ? 50 : 97 - (i * 94) / (n - 1))

  const vals = []
  for (const w of weeks) {
    if (w.top != null) vals.push(w.top)
    else if (w.deloadTop != null) vals.push(w.deloadTop)
  }
  if (prior > 0) vals.push(prior)
  if (!vals.length) return null
  const lo = Math.min(...vals), hi = Math.max(...vals)
  const range = hi - lo || 10
  const yMin = Math.max(0, lo - range * 0.45)
  const yMax = hi + range * 0.22
  const Y = (v) => fix(100 - ((v - yMin) / (yMax - yMin)) * 100)

  // The week the new weight was lifted in; failing a date, the heaviest.
  let prIndex = jump.date ? weeks.findIndex(w => w.from <= jump.date && jump.date <= w.to) : -1
  if (prIndex < 0) {
    let best = -1
    weeks.forEach((w, i) => { if (w.top != null && w.top >= best) { best = w.top; prIndex = i } })
  }

  const pts = weeks.map((w, i) => {
    const light = w.top == null && w.deloadTop != null
    const v = w.top != null ? w.top : w.deloadTop
    if (v == null) return null
    return {
      i, x: X(i), y: Y(v), v, t: n === 1 ? 0 : fix(i / (n - 1)),
      kind: i === prIndex ? 'pr' : light ? 'dl' : v > prior && prior > 0 ? 'up' : 'pt',
    }
  }).filter(Boolean)
  const joined = pts.filter(p => p.kind !== 'dl')
  const line = joined.length ? 'M' + joined.map(p => `${p.x} ${p.y}`).join(' L') : ''
  const area = joined.length > 1
    ? `${line} L${joined[joined.length - 1].x} 100 L${joined[0].x} 100 Z`
    : ''

  // Where the month starts: between the last week that ended before it
  // and the first that reaches into it.
  const first = firstDayOf(month)
  const k = weeks.findIndex(w => w.to >= first)
  const sep = k > 0 ? fix((X(k - 1) + X(k)) / 2) : null
  const labels = []
  if (k > 0) labels.push({ x: fix((X(0) + X(k - 1)) / 2), text: monthName(prevMonth(month)) })
  labels.push({ x: fix((X(Math.max(0, k)) + X(n - 1)) / 2), text: monthName(month) })

  const band = n > 1 ? 94 / (n - 1) : 20
  const deloads = weeks
    .map((w, i) => (w.deload ? { x: fix(X(i) - band / 2), w: fix(band) } : null))
    .filter(Boolean)

  const prPt = pts.find(p => p.kind === 'pr') || null
  return {
    pts, line, area,
    refY: prior > 0 ? Y(prior) : null, prior,
    ticks: niceTicks(yMin, yMax).filter(v => v > yMin && v < yMax).map(v => ({ v, y: Y(v) })),
    pr: prPt ? { ...prPt, v: jump.weight, date: jump.date } : null,
    sep, labels, deloads,
  }
}

// ── «هدف الشهر» — sessions adding up through the month ────────
// A step for every session he came to; the horizontal line is the goal,
// the dot the day he reached it.

export function goalSteps(calendar = [], target = 0, month) {
  const days = daysInMonth(month)
  const X = (d) => fix(98 - ((d - 1) / Math.max(1, days - 1)) * 96)
  const trained = calendar.filter(d => d.kind === 'trained').map(d => Number(d.date.slice(8))).sort((a, b) => a - b)
  const top = Math.max(target, trained.length, 1)
  const yMax = Math.ceil(top * 1.12)
  const Y = (c) => fix(100 - (c / yMax) * 100)
  let path = `M${X(1)} 100`
  let c = 0, hitDay = null
  for (const d of trained) {
    c++
    path += ` H${X(d)} V${Y(c)}`
    if (c === target) hitDay = d
  }
  const end = calendar.some(d => d.kind === 'ahead')
    ? Number(calendar.filter(d => d.kind !== 'ahead').slice(-1)[0]?.date.slice(8) || days)
    : days
  path += ` H${X(end)}`
  const step = target <= 8 ? 2 : target <= 16 ? 4 : target <= 30 ? 5 : 10
  const ticks = []
  for (let v = 0; v < target - step * 0.6; v += step) ticks.push({ v, y: Y(v) })
  return {
    path, area: `${path} V100 H${X(1)} Z`,
    goalY: Y(target), target, done: trained.length,
    hit: hitDay ? { day: hitDay, x: X(hitDay), y: Y(target), t: fix((hitDay - 1) / Math.max(1, days - 1)) } : null,
    ticks,
    xTicks: [1, 8, 15, 22, 29].filter(d => d <= days).map(d => ({ d, x: X(d) })),
  }
}

// ── «قبل وبعد» ────────────────────────────────────────────────
// The first and the last progress photo of the month, when they are at
// least three weeks apart; otherwise there is no card.

export const BA_MIN_DAYS = 21

export function beforeAfter(photos = [], month) {
  const mine = (photos || [])
    .filter(p => p && p.src && p.date && monthKey(p.date) === month)
    .sort((a, b) => (dayKey(a.date) < dayKey(b.date) ? -1 : dayKey(a.date) > dayKey(b.date) ? 1 : (a.id || 0) - (b.id || 0)))
  if (mine.length < 2) return null
  const before = mine[0], after = mine[mine.length - 1]
  const days = dayDiff(dayKey(before.date), dayKey(after.date))
  if (days < BA_MIN_DAYS) return null
  return { before, after, days }
}

// ── Next month ────────────────────────────────────────────────

/** A goal can be set for the month after this one only while that
 *  month has not ended: an old report does not set goals for the past. */
export const goalEditable = (month, today) => nextMonth(month) >= String(today).slice(0, 7)

/** The lifts a weight goal can be about: the month's own, most trained
 *  first, each with a target one plate step past its best. */
export function liftGoalOptions(report, max = 6) {
  return [...(report?.gains || [])]
    .filter(g => g.top > 0)
    .sort((a, b) => b.sessions - a.sessions || b.top - a.top)
    .slice(0, max)
    .map(g => ({ lift: g.lift, exercise: g.exercise, best: g.top, target: roundToPlate(g.top + PLATE_STEP) }))
}

// ── «طبّقها على خطتي» ─────────────────────────────────────────
// Only after the tap, and only in fields the old design reads the same
// way: the weight to pre-fill (hf_last_weights, canonical name → kg, as
// a finished session writes it) and the number of sets of a plan
// exercise (hf_plan … exercises[].sets, a whole number). Nothing is
// renamed, removed or reshaped. Editing the plan this way is free — it
// is not a change of plan, so the streak's rule is not involved.
//
//   raise — the next session starts one plate step up
//   lower — the next session starts at the engine's lighter weight
//   sets  — a muscle under 10 sets a week gets sets added to the plan's
//           exercises for it, spread across them, until it reaches
//           about 12 a week (never past 5 sets on one exercise)

export const MAX_PLAN_SETS = 5
const DEFAULT_SETS = 3

/** Sessions a week on the plan's rolling cycle (2 on 1 off ≈ 4.7). */
export const sessionsPerWeek = (config = {}) => {
  const p = patternFor(config)
  const on = p.reduce((n, x) => n + x, 0)
  return (7 * on) / (on + p.length)
}

const copyPlan = (plan) => ({
  ...plan,
  weeklySchedule: (plan.weeklySchedule || []).map(d => ({
    ...d,
    exercises: (d.exercises || []).map(e => ({ ...e })),
  })),
})

export function applyNext({ plan = null, lastWeights = {}, items = [], mapping = {}, config = {} } = {}) {
  const weights = { ...(lastWeights && typeof lastWeights === 'object' ? lastWeights : {}) }
  const next = plan && Array.isArray(plan.weeklySchedule) ? copyPlan(plan) : plan
  const changes = []
  const skipped = []

  for (const item of items || []) {
    if (item.kind === 'raise' || item.kind === 'lower') {
      const to = Number(item.to)
      if (!(to > 0)) { skipped.push({ ...item, why: 'no-weight' }); continue }
      weights[resolveExerciseName(item.exercise, mapping)] = to
      changes.push({ kind: item.kind, exercise: item.exercise, from: item.weight, to })
      continue
    }
    if (item.kind === 'sets') {
      const days = next?.weeklySchedule || []
      const slots = []
      days.forEach((d, di) => (d.exercises || []).forEach((e, ei) => {
        // Timed moves (the builder's cardio, unit 'min') are one long set:
        // the builder never adds sets to them, and neither does this.
        if (e.unit === 'min') return
        // The exercises that work the short area directly (the builder's
        // count), else, for an old item with no area, its group's.
        const hit = item.area ? (creditsOf(e)?.[item.area] || 0) >= 1 : e.muscle === item.muscle
        if (hit) slots.push([di, ei])
      }))
      if (!slots.length) { skipped.push({ ...item, why: 'not-in-plan' }); continue }
      const perDay = sessionsPerWeek(config) / Math.max(1, days.length)
      const shown = item.shown ?? Math.round(item.perWeek || 0)
      const goal = Math.min(item.max ?? WEEKLY_SETS.max, (item.min ?? WEEKLY_SETS.min) + 2)
      const want = Math.max(1, Math.ceil(Math.max(0, goal - shown) / perDay))
      let added = 0
      for (let round = 0; added < want && round < MAX_PLAN_SETS; round++) {
        for (const [di, ei] of slots) {
          if (added >= want) break
          const ex = days[di].exercises[ei]
          const now = Number(ex.sets) || DEFAULT_SETS
          if (now >= MAX_PLAN_SETS) continue
          ex.sets = now + 1
          added++
        }
      }
      if (!added) { skipped.push({ ...item, why: 'full' }); continue }
      changes.push({
        kind: 'sets', muscle: item.muscle, label: item.label, added,
        perWeek: Math.round(shown + added * perDay),
      })
    }
  }
  return { plan: next, lastWeights: weights, changes, skipped }
}

/** What the undo toast says after the tap. */
export function appliedLine({ changes = [], skipped = [] } = {}) {
  const n = changes.length
  const did = n === 0 ? 'ما تغيّر شي في خطتك.'
    : n === 1 ? 'تغيّر شي واحد في خطتك.'
    : `تغيّرت ${countWord(n, 'thing')} في خطتك.`
  const miss = skipped.filter(s => s.why === 'not-in-plan').map(s => s.label)
  return miss.length ? `${did} ما في خطتك تمرين لـ${miss.join(' و')}.` : did
}

// ── Small things the cards share ──────────────────────────────

/** Leading blanks so the 1st sits under its weekday (Sunday first). */
export const calendarPad = (month) => {
  const [y, m] = String(month).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
}

/** The planned dashes around the cover's ring, as SVG arcs on a 100 box,
 *  anticlockwise from twelve o'clock (time runs right to left). */
export function ringArcs(slots = [], { r = 45, gap = 3.2 } = {}) {
  const n = slots.length
  if (!n) return []
  const seg = 360 / n
  const g = Math.min(gap, seg * 0.3)
  const pt = (a) => {
    const t = (a * Math.PI) / 180
    return `${fix(50 - r * Math.sin(t))} ${fix(50 - r * Math.cos(t))}`
  }
  let lit = 0
  return slots.map((s, i) => {
    const a0 = i * seg + g, a1 = (i + 1) * seg - g
    const large = a1 - a0 > 180 ? 1 : 0
    const d = n === 1
      ? `M50 ${50 - r} A${r} ${r} 0 1 0 50 ${50 + r} A${r} ${r} 0 1 0 50 ${50 - r}`
      : `M${pt(a0)} A${r} ${r} 0 ${large} 0 ${pt(a1)}`
    return { d, state: s.state, deload: !!s.deload, date: s.date, i: s.state === 'done' ? lit++ : 0 }
  })
}

export { addDays, lastDayOf, nextMonth }
