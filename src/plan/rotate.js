// ── «بالتناوب»: exercises that take turns on a plan day ───────
//
// حمزة: «نسوي ميزة تسمح انه تمرينين او اكثر يتبادلوا في الايام. يعني اليوم
// رجول بسوي هيب ابدكشن اجي يوم ثاني للرجول يعمل هيب اددكشن. والميزة تسمح لي
// بالاختيار».
//
// Pure logic, no React, no storage; used by «خطتي» (src/pages/planview),
// the session (App.startPlannedWorkout, the player) and Home.
//
// The data: a plan row may carry an optional `rotate` — the names it takes
// turns between, in order, its own `name` first:
//
//   { name: 'Machine Hip Abduction', muscle: 'Legs', sets: 3, …,
//     rotate: ['Machine Hip Abduction', 'Machine Hip Adduction'] }
//
// The old design never reads `rotate`: it shows and runs the row's name,
// a real exercise, so the plan stays one both designs open (validatePlan).
//
// Which one is due is never stored. It is read from his sessions of that
// plan day (sessionPlanDay: this plan's, of that day, from its start),
// newest first: the first that did any of the names says which he did
// last — the latest in the list when it did several (the two rows before
// he merged them) — and the one after it is due; none yet: the first. So
// it is the same on every phone, after a restore, and after the old
// design ran the day (its session did the first, so the second is due).
// Whatever he did counts: the one the session started on, the other one
// chosen before the first set («بدّلها لـ … هالمرة»), one added by hand, a
// «بس هالمرة» swap (by the name he did, else the name it replaced), a
// remembered swap (by the plan's name it ran for), all under his alias
// mapping; a deload's session counts like any. A day he skipped ran
// nothing, so the turn waits for it.
//
// Every edit returns a new hf_plan (never the stored one changed in place)
// and goes in through App's commitPlan, the way the builder saves an edit
// of his own plan: free for the streak, the day he reached kept.

import { MUSCLE_GROUPS } from '../constants.js'
import { normalizeSession } from '../sets.js'
import {
  rotationOf, keysOf, muscleOf, sessionPlanDay, withRow, swapRow, setRowSets, retag, dayId,
} from './view.js'

export { rotationOf }

const lc = (s) => String(s || '').trim().toLowerCase()
const when = (s) => Number(s?.id) || Date.parse(s?.date) || 0
const rowsOf = (plan, d) => plan?.weeklySchedule?.[d]?.exercises || []

/** Names, trimmed, each once (case aside), blanks dropped. */
function dedupe(list) {
  const out = []
  for (const n of list || []) {
    const t = typeof n === 'string' ? n.trim() : ''
    if (t && !out.some(x => lc(x) === lc(t))) out.push(t)
  }
  return out
}

// ── Whose turn it is ─────────────────────────────────────────

/**
 * Which of `members` a session's exercise was, or -1: by the name he did
 * first, else by the plan's name a swap ran it for (originalName); both
 * under his alias mapping and the catalogue's id («Hip Abduction» is the
 * «Machine Hip Abduction» of his mapping).
 */
export function memberIndex(members, ex, { mapping = {} } = {}) {
  const sets = (members || []).map(m => new Set(keysOf(m, mapping)))
  const find = (n) => {
    if (!n) return -1
    const ks = keysOf(n, mapping)
    return sets.findIndex(s => ks.some(k => s.has(k)))
  }
  const i = find(ex?.name)
  return i >= 0 ? i : find(ex?.originalName)
}

/** His sessions of day `d` of this plan, newest first. */
function daySessions(plan, d, sessions) {
  return (sessions || []).filter(s => sessionPlanDay(plan, s) === d).sort((a, b) => when(b) - when(a))
}

function turnFrom(members, mine, opts) {
  const n = members.length
  for (const raw of mine) {
    const s = normalizeSession(raw)
    if (!s) continue
    let last = -1
    for (const ex of s.exercises || []) last = Math.max(last, memberIndex(members, ex, opts))
    if (last >= 0) return { members, due: (last + 1) % n, next: (last + 2) % n, last: { at: last, when: when(raw) } }
  }
  return { members, due: 0, next: 1 % n, last: null }
}

/**
 * Whose turn it is among `members` on day `d`: { members, due, next, last }
 * — indexes into members; `last` { at, when } the one his latest session
 * of the day did (and when), or null when none has yet. Null for fewer
 * than two names.
 */
export function rotationTurn(plan, d, members, sessions, opts = {}) {
  if (!Array.isArray(members) || members.length < 2) return null
  return turnFrom(members, daySessions(plan, d, sessions), opts)
}

/** rotationTurn for the row at [d, j]; null for a row that doesn't rotate. */
export function rowTurn(plan, d, j, sessions, opts = {}) {
  const members = rotationOf(rowsOf(plan, d)[j])
  return members ? rotationTurn(plan, d, members, sessions, opts) : null
}

/** Every row of every day: its turn, or null — [day][row]. */
export function rotationTurns(plan, sessions, opts = {}) {
  const days = Array.isArray(plan?.weeklySchedule) ? plan.weeklySchedule : []
  return days.map((day, d) => {
    let mine = null
    return (day?.exercises || []).map((ex) => {
      const members = rotationOf(ex)
      if (!members) return null
      mine = mine || daySessions(plan, d, sessions)
      return turnFrom(members, mine, opts)
    })
  })
}

/**
 * The turn while a session of that day runs: the one it is on now (he may
 * have chosen the other one for this time), and the one after it. The
 * saved sessions' turn as it is when the session has none of them.
 */
export function liveTurn(turn, active, opts = {}) {
  if (!turn || !active) return turn
  const n = turn.members.length
  for (const ex of active.exercises || []) {
    const i = memberIndex(turn.members, ex, opts)
    if (i >= 0) return { ...turn, due: i, next: (i + 1) % n, live: true }
  }
  return turn
}

/** The members' indexes in turn order: the one due first, then the one after it, … */
export function turnOrder(turn) {
  const n = turn?.members?.length || 0
  return Array.from({ length: n }, (_, k) => (turn.due + k) % n)
}

/**
 * The plan day as a session starts it: each row that takes turns on the
 * one due (its muscle with it), the list kept on it (`rotate`, an
 * optional field the player reads and the old design ignores). Rows that
 * don't rotate as they are. `day` defaults to the plan's own day `d` (a
 * copy already resolved comes out the same).
 */
export function resolveDay(plan, d, sessions, opts = {}, day = plan?.weeklySchedule?.[d]) {
  if (!day || !Array.isArray(day.exercises)) return day
  let mine = null
  let any = false
  const exercises = day.exercises.map((ex) => {
    const members = rotationOf(ex)
    if (!members) return ex
    mine = mine || daySessions(plan, d, sessions)
    const t = turnFrom(members, mine, opts)
    const name = members[t.due]
    any = true
    const muscle = lc(name) === lc(ex.name) ? ex.muscle : muscleOf(name, ex.muscle)
    return { ...ex, name, muscle: MUSCLE_GROUPS[muscle] ? muscle : ex.muscle, rotate: members }
  })
  return any ? { ...day, exercises } : day
}

/** The one after a session's exercise in its turns: what «المرة الجاية» says. */
export function nextMember(members, ex, opts = {}) {
  const n = members?.length || 0
  if (n < 2) return null
  const i = memberIndex(members, ex, opts)
  return members[(i + 1) % n]
}

// ── Edits ────────────────────────────────────────────────────

/**
 * The row at [d, j] takes turns between `members`: the first becomes the
 * row's own name (a swap of it, noted in `was` as every swap is — swapRow;
 * «خطتي» says nothing of it while that name still takes its turns), and
 * under two names the row stops taking turns. Null for no such row.
 */
export function setRotation(plan, d, j, members) {
  const row = rowsOf(plan, d)[j]
  const list = dedupe(members)
  if (!row || !list.length) return null
  let next = plan
  if (lc(list[0]) !== lc(row.name)) {
    next = swapRow(next, d, j, list[0])
    if (!next) return null
  }
  return withRow(next, d, j, (r) => {
    if (list.length >= 2) r.rotate = list
    else delete r.rotate
    return r
  })
}

/**
 * One more name in the row's turns («بالتناوب مع…»). Another row of the
 * day by that name (or taking turns with it) joins instead — mergeRows.
 * → { plan, at } (the row's index after it), or null.
 */
export function addToRotation(plan, d, j, name) {
  const rows = rowsOf(plan, d)
  const row = rows[j]
  const to = String(name || '').trim()
  if (!row || !to) return null
  const members = rotationOf(row) || [row.name]
  if (members.some(m => lc(m) === lc(to))) return null
  const k = rows.findIndex((x, i) => i !== j && (lc(x.name) === lc(to) || (rotationOf(x) || []).some(m => lc(m) === lc(to))))
  if (k >= 0) return mergeRows(plan, d, j, k)
  const next = setRotation(plan, d, j, [...members, to])
  return next ? { plan: next, at: j } : null
}

/** A name out of the row's turns; the last one left is the row alone. */
export function removeFromRotation(plan, d, j, name) {
  const members = rotationOf(rowsOf(plan, d)[j])
  if (!members || !members.some(m => lc(m) === lc(name))) return null
  return setRotation(plan, d, j, members.filter(m => lc(m) !== lc(name)))
}

/** A name one place earlier (dir < 0) or later in the row's turns. */
export function moveInRotation(plan, d, j, name, dir = -1) {
  const members = rotationOf(rowsOf(plan, d)[j])
  if (!members) return null
  const i = members.findIndex(m => lc(m) === lc(name))
  const t = i + (dir < 0 ? -1 : 1)
  if (i < 0 || t < 0 || t >= members.length) return null
  const list = [...members]
  ;[list[i], list[t]] = [list[t], list[i]]
  return setRotation(plan, d, j, list)
}

/**
 * Two rows of a day become one that takes turns («خلّهم بالتناوب»): row
 * j's names, then row k's, in row j's place — its reps and rest kept, its
 * sets the larger of the two (noted against what it had, as every sets
 * change is) — and row k goes. → { plan, at } (the row's index after it).
 */
export function mergeRows(plan, d, j, k) {
  const rows = rowsOf(plan, d)
  const a = rows[j], b = rows[k]
  if (!a || !b || j === k) return null
  const members = dedupe([...(rotationOf(a) || [a.name]), ...(rotationOf(b) || [b.name])])
  if (members.length < 2) return null
  let next = setRotation(plan, d, j, members)
  if (!next) return null
  const sets = Math.max(Number(a.sets) || 3, Number(b.sets) || 3)
  if (sets !== (Number(a.sets) || 3)) next = setRowSets(next, d, j, sets)
  next = {
    ...next,
    weeklySchedule: next.weeklySchedule.map((day, di) => (di !== d ? day : { ...day, exercises: day.exercises.filter((_, i) => i !== k) })),
  }
  return { plan: next, at: k < j ? j - 1 : j }
}

/**
 * «فكّ التناوب»: each name a row of its own again — the first in the row's
 * place, the others right after it — all on the row's numbers (sets,
 * reps — his own stays his — and rest). A name the day already has as a
 * row is not doubled. → { plan, at, count } (count: the rows it added).
 */
export function splitRotation(plan, d, j) {
  const rows = rowsOf(plan, d)
  const row = rows[j]
  const members = rotationOf(row)
  if (!members) return null
  const base = { ...row }
  delete base.rotate
  const others = members.filter(m => lc(m) !== lc(row.name) && !rows.some((x, i) => i !== j && lc(x.name) === lc(m)))
  const added = others.map((name) => {
    const m = muscleOf(name, row.muscle)
    const r = {
      name, muscle: MUSCLE_GROUPS[m] ? m : row.muscle,
      sets: row.sets, repsMin: row.repsMin, repsMax: row.repsMax, restSeconds: row.restSeconds, by: 'user',
    }
    if (row.repsOwn === true) r.repsOwn = true
    if (row.unit) r.unit = row.unit
    return retag(r, name)
  })
  const list = [...rows.slice(0, j), base, ...added, ...rows.slice(j + 1)]
  return {
    plan: { ...plan, weeklySchedule: plan.weeklySchedule.map((day, di) => (di !== d ? day : { ...day, exercises: list })) },
    at: j,
    count: added.length,
  }
}

/**
 * «دايماً بخطتي» on one of the names a row takes turns between: `to` in
 * `from`'s place. Null when `from` isn't one of them, or `to` already is
 * (then there is nothing to write: the turns already have it).
 */
export function swapMember(plan, d, j, from, to) {
  const members = rotationOf(rowsOf(plan, d)[j])
  const t = String(to || '').trim()
  if (!members || !t || members.some(m => lc(m) === lc(t))) return null
  const i = members.findIndex(m => lc(m) === lc(from))
  if (i < 0) return null
  const list = [...members]
  list[i] = t
  return setRotation(plan, d, j, list)
}

// ── «خلّهم بالتناوب»: the pairs offered on a day's cards ─────────

/** Exercises that take turns by nature — one side each, by the keys a
 *  name is known by (keysOf): the hip machines of his request. */
const PAIRS = [
  [['#hip_abduction', 'hip abduction'], ['#hip_adduction', 'hip adduction']],
]
/** [offerId, …]: the offers he answered «لا» to. A key of the new design's own; the old one never reads it. */
export const OFFERS_OFF_KEY = 'meran_rotate_off'
export const offerId = (plan, d, a, b) => `${dayId(plan, d)}|${[lc(a), lc(b)].sort().join('+')}`

/**
 * For each row of day `d`, the row it could take turns with — the other
 * of a natural pair on the same day (the abduction and adduction
 * machines), neither already taking turns — or -1. `off`: the offers he
 * waved off (offerId), never made again.
 */
export function rotationOffers(plan, d, { mapping = {}, off = [] } = {}) {
  const rows = rowsOf(plan, d)
  const out = rows.map(() => -1)
  const no = new Set(Array.isArray(off) ? off : [])
  const is = (x, side) => !!x && !rotationOf(x) && keysOf(x.name, mapping).some(k => side.includes(k))
  for (const [A, B] of PAIRS) {
    const i = rows.findIndex(x => is(x, A))
    const k = rows.findIndex(x => is(x, B))
    if (i < 0 || k < 0 || out[i] >= 0 || out[k] >= 0) continue
    if (no.has(offerId(plan, d, rows[i].name, rows[k].name))) continue
    out[i] = k
    out[k] = i
  }
  return out
}
