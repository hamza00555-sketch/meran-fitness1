// ── «خطتي»: his plan as he actually runs it ──────────────────
//
// Pure logic for the plan view (src/pages/planview), the session's swap
// sheet and their tests: no React, no storage.
//
// What a session really runs is not hf_plan alone. Three things change it
// between the stored plan and the first set:
//
//   1. a remembered swap — hf_exercise_subs, { plan name: index into
//      EXERCISE_ALTERNATIVES[plan name] } (1-based, 0 = the original),
//      applied to every day at the start of a session (utils.applySubsToDay).
//      Global by name: Leg Press swapped is swapped on every day that has it.
//   2. the reps rule — a row's range is his only when he set it himself
//      (repsOwn, progression.planRepTarget); every other row runs on
//      Settings › التكرارات.
//   3. the rest — the row's restSeconds, else the player's 90 s.
//
// The rows also say what he changed, honestly: a swap (remembered, or
// written into the plan), sets added or taken away, his own reps. What a
// row was before his first change is kept on the row itself, in an
// optional `was` ({ name, muscle, sets }) that the old design never reads;
// a built-in template row he never touched is compared with the template.
//
// Edits here return a new hf_plan (never a reshaped one): only name,
// muscle, sets, repsMin/repsMax, restSeconds and the optional repsOwn,
// unit, equip, part and was are touched, so both designs keep reading it.
// They are put in through App's commitPlan, the way the builder saves an
// edit of his own plan: free for the streak, the day he reached kept.

import { EXERCISE_ALTERNATIVES, MUSCLE_GROUPS, BUILT_IN_PLANS } from '../constants.js'
import { substitutedName, resolveExerciseName, planDayType } from '../utils.js'
import { normalizeSession } from '../sets.js'
import { effectiveRepTarget, repTargetOf, DEFAULT_REP_TARGET } from '../progression.js'
import { entryForName, EX, EQ } from './catalogue.js'
import { mediaSlotFor } from '../exerciseMedia.js'

export const DEFAULT_REST = 90      // the player's rest when the plan has none (InlineRest)
export const MIN_SETS = 1
export const MAX_SETS = 6           // as the builder's stepper
// The builder's steps (src/pages/planner/ui.js), so a range set here is
// one the builder can step from.
export const REP_STEPS = [[3, 5], [4, 6], [5, 8], [6, 10], [8, 12], [10, 12], [10, 15], [12, 15], [12, 20], [15, 20], [15, 25]]
export const SEC_STEPS = [[20, 30], [30, 45], [45, 60], [60, 90]]
export const REST_STEPS = [30, 45, 60, 75, 90, 120, 150, 180, 240]

/** One step up or down a list of values or [lo, hi] ranges, from any
 *  value (one not on the list steps to its neighbour on the list). */
export function stepList(list, cur, dir) {
  const key = (x) => Array.isArray(x) ? x[0] * 100 + x[1] : x
  const k = key(cur)
  let i = list.findIndex(x => key(x) >= k)
  if (i < 0) i = list.length
  const exact = i < list.length && key(list[i]) === k
  const j = dir > 0 ? (exact ? i + 1 : i) : i - 1
  return list[Math.max(0, Math.min(list.length - 1, j))]
}

/** «90 ث», «2 د», «2½ د» — the builder's way of saying a rest. */
export const restLabel = (s) => {
  const n = Math.max(0, Math.round(Number(s) || 0))
  if (n < 120) return `${n} ث`
  const m = n / 60
  return `${m % 1 ? `${Math.floor(m)}½` : m} د`
}

const lc = (s) => String(s || '').trim().toLowerCase()
const MUSCLE_OF = new Map()
for (const [g, v] of Object.entries(MUSCLE_GROUPS)) for (const e of v.exercises || []) MUSCLE_OF.set(lc(e.name), g)

/** The muscle group (one of the eight) an exercise belongs to, else `fallback`. */
export function muscleOf(name, fallback = null) {
  const hit = MUSCLE_OF.get(lc(name))
  if (hit) return hit
  const e = entryForName(name)
  if (e && !e.foreign && MUSCLE_GROUPS[e.key]) return e.key
  return MUSCLE_GROUPS[fallback] ? fallback : (fallback || null)
}

const isTimedUnit = (u) => u === 'sec' || u === 'min'

// ── What a row runs on ───────────────────────────────────────

/** The built-in template's row at this place, when the plan is one he
 *  activated and never renamed the row of. */
function templateRow(plan, d, name) {
  const tpl = plan?.planId ? BUILT_IN_PLANS.find(p => p.planId === plan.planId) : null
  const day = tpl?.weeklySchedule?.[d]
  return (day?.exercises || []).find(x => lc(x.name) === lc(name)) || null
}

/** Sets more (+) or fewer (−) than the row had before he changed it. */
function extraSets(plan, d, ex) {
  const sets = Number(ex.sets) || 3
  const was = Number(ex.was?.sets)
  if (was > 0) return sets - was
  const tpl = templateRow(plan, d, ex.was?.name || ex.name)
  const t = Number(tpl?.sets)
  return t > 0 ? sets - t : 0
}

/**
 * One row of a plan day as the session will run it.
 *   name      what he will do (a remembered swap applied)
 *   planName  what the stored row says
 *   swap      { from, how: 'sub' | 'plan' } when it is not what the plan
 *             first had («بدّلته بدل …»), else null
 *   extra     sets more (+) or fewer (−) than before he changed it
 *   own       the reps are his own (repsOwn) — they beat Settings
 *   reps      { base, top } — his own range, else Settings
 *   rest      seconds; restSet false when the plan has none (the player's 90)
 */
export function effectiveRow(plan, d, j, { subs = {}, repTarget = DEFAULT_REP_TARGET } = {}) {
  const ex = plan?.weeklySchedule?.[d]?.exercises?.[j]
  if (!ex) return null
  const name = substitutedName(ex.name, subs || {}, EXERCISE_ALTERNATIVES)
  const subbed = name !== ex.name
  const wasName = ex.was?.name && lc(ex.was.name) !== lc(ex.name) ? ex.was.name : null
  // The first thing the plan had in this place: what he swapped away from.
  const from = wasName || (subbed ? ex.name : null)
  const swap = from && lc(from) !== lc(name) ? { from, how: subbed ? 'sub' : 'plan' } : null
  const reps = effectiveRepTarget(ex, repTarget)
  const rest = Number(ex.restSeconds)
  return {
    at: [d, j],
    name,
    planName: ex.name,
    muscle: subbed ? muscleOf(name, ex.muscle) : (MUSCLE_GROUPS[ex.muscle] ? ex.muscle : muscleOf(name, ex.muscle)),
    sets: Number(ex.sets) || 3,
    reps: { base: reps.base, top: reps.top },
    unit: isTimedUnit(ex.unit) ? ex.unit : null,
    rest: rest > 0 ? Math.round(rest) : DEFAULT_REST,
    restSet: rest > 0,
    own: ex.repsOwn === true && !isTimedUnit(ex.unit),
    swap,
    extra: extraSets(plan, d, ex),
  }
}

/** Every day of the plan, each with its rows as the session runs them. */
export function effectivePlan(plan, opts = {}) {
  const days = Array.isArray(plan?.weeklySchedule) ? plan.weeklySchedule : []
  return days.map((day, d) => ({
    index: d,
    day,
    rows: (day?.exercises || []).map((_, j) => effectiveRow(plan, d, j, opts)).filter(Boolean),
  }))
}

/** The plan day as a session would start it: the stored day with the
 *  effective names (for the day words, the muscles line and the minutes). */
export function effectiveDay(plan, d, opts = {}) {
  const day = plan?.weeklySchedule?.[d]
  if (!day) return null
  const rows = (day.exercises || []).map((_, j) => effectiveRow(plan, d, j, opts)).filter(Boolean)
  return { ...day, exercises: rows.map((r, j) => ({ ...day.exercises[j], name: r.name, muscle: r.muscle })) }
}

// ── Which day opens first, and which day is today ────────────

/**
 * The day «خطتي» opens on, and the mark each day tab carries:
 *   'live'  — the session running now is this day
 *   'today' — today's workout, still to do
 *   'done'  — done today
 *   'next'  — the next one (today is done, or a rest day)
 * n: days in the cycle; planIndex: the day reached; status: 'training' |
 * 'completed' | 'recovery'; doneToday: the day index of a planned session
 * saved today (or null); liveIndex: the running session's day (or null).
 */
export function dayMarks({ n, planIndex = 0, status = 'training', doneToday = null, liveIndex = null } = {}) {
  const marks = {}
  if (!(n > 0)) return { first: 0, marks }
  const mod = (i) => ((Number(i) % n) + n) % n
  const next = mod(planIndex || 0)
  if (liveIndex != null && Number.isFinite(Number(liveIndex))) {
    const live = mod(liveIndex)
    marks[live] = 'live'
    return { first: live, marks }
  }
  if (doneToday != null && Number.isFinite(Number(doneToday))) marks[mod(doneToday)] = 'done'
  if (status === 'completed' || status === 'recovery' || doneToday != null) {
    if (!marks[next]) marks[next] = 'next'
  } else {
    marks[next] = 'today'
  }
  return { first: next, marks }
}

// ── The words on a card ──────────────────────────────────────

/** «مجموعة زيادة», «مجموعتين زيادة», «3 مجموعات زيادة», «مجموعة أقل»; '' for 0. */
export function extraWords(n) {
  const k = Math.round(Number(n) || 0)
  if (!k) return ''
  const a = Math.abs(k)
  const tail = k > 0 ? 'زيادة' : 'أقل'
  if (a === 1) return `مجموعة ${tail}`
  if (a === 2) return `مجموعتين ${tail}`
  const r = a % 100
  return `${a} ${r >= 3 && r <= 10 ? 'مجموعات' : 'مجموعة'} ${tail}`
}

// ── Alternatives ─────────────────────────────────────────────

const PART = { quads: 'quads', hams: 'hamstrings', glutes: 'glutes', calves: 'calves' }

/** A swap-table name the catalogue knows under another spelling — the
 *  same words but «machine» («Chest Supported Row Machine» is the
 *  catalogue's «Chest-Supported Row»): its picture and its history. */
const BY_WORDS_NO_MACHINE = new Map()
const wordsNoMachine = (n) => String(n || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
  .filter(w => w && w !== 'machine').sort().join(' ')
for (const x of EX) { const k = wordsNoMachine(x.en); if (k && !BY_WORDS_NO_MACHINE.has(k)) BY_WORDS_NO_MACHINE.set(k, x.en) }
const catalogueName = (n) => (mediaSlotFor(n) ? n : BY_WORDS_NO_MACHINE.get(wordsNoMachine(n)) || n)

/**
 * What to swap an exercise for, as two groups of names:
 *   muscle — the same muscle: the swap table first (EXERCISE_ALTERNATIVES,
 *            tests/alternatives.test.mjs — hand-written for his gym where
 *            it exists, the group's siblings with a shared movement first
 *            otherwise), then the catalogue's exercises for the same part
 *            of the muscle, then for the rest of the muscle group (only
 *            ones that work it directly — a shrug is not a row)
 *   tool   — the same movement with another tool, not offered above (the
 *            machine taken: the dumbbell or barbell version of it)
 * Inside each group, what he has already done comes first (`tried`: name →
 * true when he has a weight on it — his gym's machines); then machines and
 * cables, in the catalogue's order (his gym); names with no picture last.
 * `exclude`: names not to offer (the day's or the session's other
 * exercises).
 */
export function rankAlternatives(name, { muscle = null, exclude = [], tried = null, max = { muscle: 8, tool: 4 } } = {}) {
  const e = entryForName(name)
  const known = e && !e.foreign ? e : null
  const skip = new Set([lc(name), ...(exclude || []).map(lc)])
  const seen = new Set()
  const out = { muscle: [], tool: [], later: [] }
  const add = (n, group) => {
    const k = lc(n)
    if (!n || skip.has(k) || seen.has(k)) return
    seen.add(k)
    out[group].push(n)
  }
  const direct = (a) => (a.cr[a.area] || 0) >= 1
  const otherTool = (a) => !!known && a.mv === known.mv && a.eq !== known.eq
  // The swap table is the first answer, in its own order (Pec Deck → the
  // cable fly first), whatever tool its entries use; a name with no
  // picture waits for the end of the group.
  for (const n of EXERCISE_ALTERNATIVES[name] || []) {
    const c = catalogueName(n)
    add(c, mediaSlotFor(c) ? 'muscle' : 'later')
  }
  if (known) {
    for (const a of EX) if (a.id !== known.id && a.area === known.area && direct(a) && !otherTool(a)) add(a.en, 'muscle')
    for (const a of EX) if (a.id !== known.id && a.key === known.key && a.area !== known.area && direct(a) && !otherTool(a)) add(a.en, 'muscle')
    for (const a of EX) if (a.id !== known.id && otherTool(a)) add(a.en, 'tool')
  } else {
    const g = MUSCLE_GROUPS[muscleOf(name, muscle)]
    for (const x of g?.exercises || []) add(x.name, mediaSlotFor(x.name) ? 'muscle' : 'later')
  }
  const triedFirst = (list) => {
    if (typeof tried !== 'function') return list
    const yes = list.filter(n => tried(n))
    return [...yes, ...list.filter(n => !yes.includes(n))]
  }
  return {
    muscle: triedFirst([...out.muscle, ...out.later]).slice(0, max.muscle ?? 8),
    tool: triedFirst(out.tool).slice(0, max.tool ?? 4),
  }
}

// ── Edits ────────────────────────────────────────────────────

const rowOf = (plan, d, j) => plan?.weeklySchedule?.[d]?.exercises?.[j] || null

/** A copy of the plan with one row replaced by `fn(row)`; null when there is no such row. */
function withRow(plan, d, j, fn) {
  const row = rowOf(plan, d, j)
  if (!row) return null
  return {
    ...plan,
    weeklySchedule: plan.weeklySchedule.map((day, di) => di !== d ? day : {
      ...day,
      exercises: day.exercises.map((x, xi) => xi !== j ? x : fn({ ...x })),
    }),
  }
}

/** The row's `was`, the first value of `field` noted before his first
 *  change of it, and dropped again once the row is back to it. */
function noteWas(row, field, before, after, same = (a, b) => a === b) {
  const was = { ...(row.was || {}) }
  if (!(field in was)) was[field] = before
  if (same(was[field], after)) delete was[field]
  if (field === 'name' && !('name' in was)) delete was.muscle
  if (Object.keys(was).length) row.was = was
  else delete row.was
  return row
}

/** The tool and the part of the leg, as the builder writes them, for a new name. */
function retag(row, name) {
  const e = entryForName(name)
  const app = e && !e.foreign ? EQ[e.eq]?.app : null
  if (app) row.equip = app; else delete row.equip
  const part = e && !e.foreign ? PART[e.area] : null
  if (part) row.part = part; else delete row.part
  // a reason the app gave for the old exercise says nothing about this one
  delete row.why
  if (row.by === 'app') row.by = 'user'
  // a timed move swapped for one with reps (or back): its own unit and range
  const timed = e && !e.foreign && e.k === 'x' ? 'min' : (e && ['plank', 'hollow_body_hold'].includes(e.id) ? 'sec' : null)
  if (timed !== (isTimedUnit(row.unit) ? row.unit : null)) {
    if (timed) {
      row.unit = timed
      const [lo, hi] = timed === 'min' ? [20, 20] : [30, 45]
      row.repsMin = lo; row.repsMax = hi
    } else {
      delete row.unit
      delete row.repsOwn
    }
  }
  return row
}

/** The row at [d, j] becomes `name`. Notes what it was (once). */
export function swapRow(plan, d, j, name) {
  const to = String(name || '').trim()
  if (!to) return null
  return withRow(plan, d, j, (row) => {
    if (lc(row.name) === lc(to)) return row
    const before = { name: row.name, muscle: row.muscle }
    const was = { ...(row.was || {}) }
    const back = was.name && lc(was.name) === lc(to)
    row.name = back ? was.name : to
    row.muscle = back && MUSCLE_GROUPS[was.muscle] ? was.muscle : muscleOf(to, row.muscle)
    if (!MUSCLE_GROUPS[row.muscle]) row.muscle = before.muscle
    retag(row, row.name)
    if (!('name' in was)) { was.name = before.name; was.muscle = before.muscle }
    if (lc(was.name) === lc(row.name)) { delete was.name; delete was.muscle }
    if (Object.keys(was).length) row.was = was; else delete row.was
    return row
  })
}

/** Sets on the row, 1–6. */
export function setRowSets(plan, d, j, sets) {
  const n = Math.max(MIN_SETS, Math.min(MAX_SETS, Math.round(Number(sets) || 0)))
  return withRow(plan, d, j, (row) => {
    const before = Number(row.sets) || 3
    row.sets = n
    return noteWas(row, 'sets', before, n, (a, b) => Number(a) === Number(b))
  })
}

/** His own rep range on the row: it beats Settings from now on (repsOwn). */
export function setRowReps(plan, d, j, range) {
  const lo = Math.max(1, Math.round(Number(range?.[0]) || 0))
  const hi = Math.max(lo, Math.round(Number(range?.[1]) || lo))
  if (!lo) return null
  return withRow(plan, d, j, (row) => {
    row.repsMin = lo
    row.repsMax = hi
    if (!isTimedUnit(row.unit)) row.repsOwn = true
    return row
  })
}

/** Back to Settings › التكرارات: the row's range stays written, but is not his. */
export function clearRowReps(plan, d, j) {
  return withRow(plan, d, j, (row) => { delete row.repsOwn; return row })
}

/** The rest on the row, in seconds. */
export function setRowRest(plan, d, j, secs) {
  const s = Math.max(0, Math.round(Number(secs) || 0))
  return withRow(plan, d, j, (row) => { row.restSeconds = s; return row })
}

/** The plan without the row at [d, j], and the row (for «تراجع»). Null
 *  for the day's last exercise: a day with nothing in it is a plan the
 *  old design cannot open (validatePlan). */
export function removeRow(plan, d, j) {
  const day = plan?.weeklySchedule?.[d]
  if (!day || !day.exercises?.[j] || day.exercises.length <= 1) return null
  const row = day.exercises[j]
  return {
    row,
    plan: {
      ...plan,
      weeklySchedule: plan.weeklySchedule.map((x, di) => di !== d ? x : { ...x, exercises: x.exercises.filter((_, xi) => xi !== j) }),
    },
  }
}

/** The row put back at [d, j] (or the day's end). */
export function insertRow(plan, d, j, row) {
  const day = plan?.weeklySchedule?.[d]
  if (!day || !row) return null
  const list = [...(day.exercises || [])]
  list.splice(Math.max(0, Math.min(list.length, j)), 0, row)
  return { ...plan, weeklySchedule: plan.weeklySchedule.map((x, di) => di !== d ? x : { ...x, exercises: list }) }
}

/**
 * The row of day `d` a session exercise came from: the plan's own name for
 * it (the session keeps it as originalName when it was swapped), else its
 * name, else the row a remembered swap turns into it. -1 when none.
 */
export function findPlanRow(plan, d, { name, originalName = null, subs = {} } = {}) {
  const rows = plan?.weeklySchedule?.[d]?.exercises || []
  for (const want of [originalName, name]) {
    if (!want) continue
    const j = rows.findIndex(x => lc(x.name) === lc(want))
    if (j >= 0) return j
  }
  return rows.findIndex(x => lc(substitutedName(x.name, subs || {}, EXERCISE_ALTERNATIVES)) === lc(name))
}

/** The day index (0…n−1) a session runs on, or null for a free session. */
export function sessionDay(plan, active) {
  const n = plan?.weeklySchedule?.length || 0
  const i = Number(active?.planDayIndex)
  if (!n || active?.planDayIndex == null || !Number.isFinite(i)) return null
  return ((i % n) + n) % n
}

// ── «تسويها بالجلسة»: what he does on a day that his plan doesn't say ──
//
// حمزة: «في خطتي تمارين الرجلين مالقيت تمرين abdication و addactor معناها في
// تمارين كثير مو مضافه» (the hip abduction and adduction machines). He adds
// them in the session (⋯ › إضافة تمرين), and
// until now nothing of that reached his plan, so «خطتي» showed less than he
// really does. These find, per plan day, the exercises his recent sessions
// of that day had and the day hasn't — offered under the day's cards to
// pin («ثبّته بخطتي»: addRow, through the same commit as every edit) or
// to wave off («مو هنا», remembered under DISMISS_KEY, a key of the new
// design's own).

export const FROM_SESSIONS_WINDOW = 4
/** { [dayId]: [exercise key, …] } — what «مو هنا» waved off, per plan day. */
export const DISMISS_KEY = 'meran_plan_dismissed'

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')

/** The kind of day a day's label says: «Legs A — أرجل» → { base: 'legs', v: 'a' }. */
function kindOf(day) {
  const t = norm(planDayType(day)).replace(/\s+day$/, '')
  const m = t.match(/^(.*?)[\s-]+([a-z]|\d{1,2})$/)
  return m ? { base: m[1], v: m[2] } : { base: t, v: '' }
}

/**
 * The day of the plan (0…n−1) a saved session was a session of, or null
 * (a free session, or a day this plan has nothing like). What a planned
 * session stores (App.startPlannedWorkout, both designs): planDayName, the
 * day's name, and planDayIndex, the day reached — a counter that grows
 * past the cycle and starts again at 0 with each new plan. So the name
 * decides; the counter only tells apart two days of one name. A day
 * renamed since (or a session of another plan) goes to the one day of the
 * same kind («Legs A» → «Legs»), the counter choosing among several.
 */
export function sessionPlanDay(plan, s) {
  const days = Array.isArray(plan?.weeklySchedule) ? plan.weeklySchedule : []
  const n = days.length
  if (!n || !s) return null
  const i = Number(s.planDayIndex)
  const at = s.planDayIndex != null && Number.isFinite(i) ? ((Math.round(i) % n) + n) % n : null
  const name = norm(s.planDayName)
  if (!name) return at
  const same = days.map((d, k) => (norm(d?.name) === name ? k : -1)).filter(k => k >= 0)
  if (same.length) return same.includes(at) ? at : same[0]
  const want = kindOf({ name: s.planDayName, exercises: s.exercises })
  if (!want.base) return null
  let kin = days.map((d, k) => [k, kindOf(d)]).filter(([, k]) => k.base === want.base)
  const exact = kin.filter(([, k]) => k.v === want.v)
  if (exact.length) kin = exact
  const ids = kin.map(([k]) => k)
  if (ids.includes(at)) return at
  return ids.length === 1 ? ids[0] : null
}

/** Where «مو هنا» is kept for a day: the plan and the day's name. */
export const dayId = (plan, d) => `${plan?.planId || 'plan'}|${norm(plan?.weeklySchedule?.[d]?.name) || d}`

/** The usual: the count he did most often, the latest on a tie (newest first). */
function usual(list) {
  const seen = new Map()
  list.forEach((v, i) => { const c = seen.get(v); seen.set(v, { n: (c?.n || 0) + 1, first: c ? c.first : i }) })
  let best = null
  for (const [v, c] of seen) if (!best || c.n > best.n || (c.n === best.n && c.first < best.first)) best = { v, ...c }
  return best ? best.v : 3
}

/** The name to pin: one the app has a picture for, under his mapping's same exercise. */
function pinName(logged, key, mapping) {
  if (mediaSlotFor(logged)) return logged
  for (const g of Object.values(MUSCLE_GROUPS)) {
    for (const x of g.exercises || []) if (resolveExerciseName(x.name, mapping) === key && mediaSlotFor(x.name)) return x.name
  }
  for (const x of EX) if (resolveExerciseName(x.en, mapping) === key && mediaSlotFor(x.en)) return x.en
  return catalogueName(logged)
}

/**
 * The exercises he did in his recent sessions of day `d` that the day
 * doesn't have. Pure.
 *
 *   «the day has it» — after his remembered swaps, by the alias mapping
 *       (Hip Abduction = Machine Hip Abduction), counting also what the
 *       day had before a swap (he swapped it away on purpose) and a
 *       session's «بس هالمرة» swap of one of its rows
 *   the rule — of the day's last `window` (4) sessions, done in at least
 *       2; when the day has only been done once or twice, done in the last
 *   dismissed — keys «مو هنا» waved off for this day
 *
 * Each: { key, name, muscle, count, of, sets } — name: the one to pin (a
 * name the app has a picture for); count of `of` sessions; sets: the
 * number of sets he usually does on it. Most often first, then in the
 * order he does them.
 */
export function doneNotInPlan(plan, d, sessions, { subs = {}, mapping = {}, dismissed = [], window = FROM_SESSIONS_WINDOW } = {}) {
  const day = plan?.weeklySchedule?.[d]
  if (!day) return []
  const keyOf = (n) => resolveExerciseName(String(n || ''), mapping)
  const idOf = (n) => { const e = entryForName(n); return e && !e.foreign ? e.id : null }
  const known = new Set(), knownIds = new Set()
  const know = (n) => { if (!n) return; known.add(keyOf(n)); const id = idOf(n); if (id) knownIds.add(id) }
  ;(day.exercises || []).forEach((ex, j) => {
    const r = effectiveRow(plan, d, j, { subs })
    know(ex.name); know(ex.was?.name); know(r?.name); know(r?.swap?.from)
  })
  const inDay = (n) => known.has(keyOf(n)) || (idOf(n) != null && knownIds.has(idOf(n)))

  const when = (s) => Number(s?.id) || Date.parse(s?.date) || 0
  const mine = (sessions || [])
    .filter(s => sessionPlanDay(plan, s) === d)
    .sort((a, b) => when(b) - when(a))
    .map(s => normalizeSession(s))
    .filter(Boolean)
    .slice(0, Math.max(1, window))
  if (!mine.length) return []

  const skip = new Set((dismissed || []).map(String))
  const tally = new Map()
  mine.forEach((s, si) => {
    const here = new Set()
    ;(s.exercises || []).forEach((ex, pos) => {
      if (!ex?.name || inDay(ex.name) || (ex.originalName && inDay(ex.originalName))) return
      const key = keyOf(ex.name)
      if (!key || here.has(key)) return
      here.add(key)
      let t = tally.get(key)
      if (!t) { t = { key, logged: ex.name, muscle: ex.muscle, count: 0, latest: si, pos, sets: [] }; tally.set(key, t) }
      t.count += 1
      t.sets.push((ex.sets || []).length)
    })
  })
  const few = mine.length <= 2
  return [...tally.values()]
    .filter(t => (few ? t.latest === 0 : t.count >= 2) && !skip.has(t.key))
    .sort((a, b) => b.count - a.count || a.latest - b.latest || a.pos - b.pos)
    .map(t => {
      const name = pinName(t.logged, t.key, mapping)
      const muscle = MUSCLE_GROUPS[t.muscle] ? t.muscle : muscleOf(name, null)
      return {
        key: t.key, name, muscle: MUSCLE_GROUPS[muscle] ? muscle : null,
        count: t.count, of: mine.length,
        sets: Math.max(MIN_SETS, Math.min(MAX_SETS, usual(t.sets))),
      }
    })
    // a name with no muscle group can't be a plan row (validatePlan)
    .filter(x => x.muscle)
}

/** doneNotInPlan for every day of the plan; `dismissed` the stored { [dayId]: keys }. */
export function fromSessions(plan, sessions, { dismissed = {}, ...opts } = {}) {
  const days = Array.isArray(plan?.weeklySchedule) ? plan.weeklySchedule : []
  return days.map((_, d) => doneNotInPlan(plan, d, sessions, { ...opts, dismissed: dismissed?.[dayId(plan, d)] || [] }))
}

/** The stored «مو هنا» with one more key for day `d`. */
export function withDismissed(stored, plan, d, key) {
  const id = dayId(plan, d)
  const cur = Array.isArray(stored?.[id]) ? stored[id] : []
  return cur.includes(key) ? (stored || {}) : { ...(stored || {}), [id]: [...cur, key] }
}

/**
 * A new row at the end of day `d`, as the builder writes one: his sets,
 * the reps on Settings (the range written, not his own — repsOwn only
 * when he steps it), the player's rest, the tool and the part of the leg.
 * Null when the day already has it, or for a name with no muscle group.
 */
export function addRow(plan, d, { name, muscle = null, sets = 3 } = {}, { repTarget = DEFAULT_REP_TARGET } = {}) {
  const day = plan?.weeklySchedule?.[d]
  const to = String(name || '').trim()
  if (!day || !to) return null
  if ((day.exercises || []).some(x => lc(x.name) === lc(to))) return null
  const m = MUSCLE_GROUPS[muscle] ? muscle : muscleOf(to, null)
  if (!MUSCLE_GROUPS[m]) return null
  const rt = repTargetOf(repTarget || DEFAULT_REP_TARGET)
  const row = retag({
    name: to, muscle: m,
    sets: Math.max(MIN_SETS, Math.min(MAX_SETS, Math.round(Number(sets) || 3))),
    repsMin: rt.base, repsMax: rt.top, restSeconds: DEFAULT_REST, by: 'user',
  }, to)
  if (row.unit === 'min') row.restSeconds = 0
  return insertRow(plan, d, (day.exercises || []).length, row)
}

/** Several rows at once (one edit, one undo): each that the day doesn't have yet. */
export function addRows(plan, d, rows, opts) {
  let next = plan
  let any = false
  for (const r of rows || []) {
    const p = addRow(next, d, r, opts)
    if (p) { next = p; any = true }
  }
  return any ? next : null
}
