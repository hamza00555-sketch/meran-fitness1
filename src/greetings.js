// ── The line under the date on Home ───────────────────────────
//
// حمزة: «العبارات التشجيعية مكررة وكلها تتكلم عن الستريك». They were.
// The old picker (utils.js pickGreeting) chose a pool from a few flags,
// and from a streak of 7 onwards every training day landed in the
// `streak` pool — sixteen ways of saying «N يوم». The days after a paid
// rest and the plan's own rest days had ten-odd lines each, the lines
// for a paid rest mentioned the streak too, and every cold start of the
// app dealt a new card from the pool, so a few opens a day went through
// a pool in days.
//
// Now, in two steps:
//
//   1. The situation. greetingFacts() reads what is true today from the
//      engines that already decide it (recovery, the plan, the
//      progression engine, the month goal and report, XP, the clock),
//      and greetingContext() takes the most specific one: a state of the
//      day first (nothing saved yet, a milestone, trained, resting,
//      back after days away, a deload, yesterday's rest or miss), then
//      something worth saying on a training day (a new weight last
//      session, a raise waiting, a swapped-in exercise, a month goal in
//      reach, the report, a level, the week's first session), then the
//      hour and Friday, and last the day's own muscles. The streak is
//      mentioned on one kind of day only: a milestone.
//
//      The «worth saying» facts would otherwise say the same thing
//      every day they are true (a raise stays true until he raises), so
//      each has a key that rests for some days once said, and a kind
//      that waits a few days before leading again.
//
//   2. The line. Within the pool, the lines not yet shown come first; a
//      line comes round again only when every line of its pool has been
//      shown, and then the one shown longest ago. The draw is seeded by
//      the day, and the day's line is remembered: reopening the app, or
//      any render, gives the same line until the day turns (03:00) — or
//      until the day itself changes (he trains, he rests, or the early
//      morning / late night hour he opened in is over).
//
// Memory: localStorage['meran_greetings'] (per user, see PER_USER_KEYS)
//   { v: 1,
//     log:   [{ d: 'YYYY-MM-DD', c: context, t: lineId }]   last 40 shown
//     seen:  { [context]: [lineId …] }   per pool, least recent first
//     facts: { [factKey]: 'YYYY-MM-DD' } when each fact was last said }
// A new key: the old design keeps its own hf_greeting_bags and
// hf_last_greeting, which nothing here reads or writes.

import { GREETINGS, EXERCISE_ALTERNATIVES } from './constants.js'
import { DAY_STATUS, addDays, dayDiff } from './recovery.js'
import { todayStreak, COUNTED } from './streak.js'
import { todayKey, dayKey } from './day.js'
import {
  ls, substitutedName, resolveExerciseName, getWeightsResetAt,
  roundToPlate, PLATE_STEP, xpProgress,
} from './utils.js'
import { setCounts } from './sets.js'
import { analyzeProgression, effectiveRepTarget, isCompleted, DEFAULT_REP_TARGET } from './progression.js'
import {
  countWord, kgText, monthName, monthReportWindow, monthGoalOf, MONTH_GOAL_KEY, daysInMonth,
} from './monthReport.js'
import { storySeen, REPORT_SEEN_KEY } from './reportStory.js'
import { arabicName } from './exerciseMedia.js'
import { dayWord, musclesLine } from './components/home/dayParts.js'
import { weekStartKey } from './components/history/model.js'

export const GREETING_KEY = 'meran_greetings'

// ── Tunables ──────────────────────────────────────────────────
/** Streak days worth a line of their own. Every 100 after 365. */
export const GREETING_MILESTONES = new Set([7, 14, 30, 50, 75, 100, 150, 200, 250, 300, 365])
export const isGreetingMilestone = (n) => GREETING_MILESTONES.has(n) || (n > 365 && n % 100 === 0)

export const COMEBACK_DAYS = 5        // days since the last session
export const NEW_WEIGHT_WITHIN = 3    // a record this many days back is still news
export const GOAL_SESSIONS_NEAR = 3   // sessions left on a month goal
export const GOAL_KG_NEAR = 5         // kilos left on a lift goal
export const LEVEL_NEAR_XP = 600      // about two sessions of XP
export const FIRST_OF_WEEK_DAYS = 2   // Saturday, Sunday, Monday
export const EARLY = [5, 9]           // [from, to) hours
export const LATE_FROM = 23           // until the day turns at 03:00
const LOG_MAX = 40
const FACTS_KEEP_DAYS = 120

// The training-day facts, in order of how much they matter today.
//   gap  — days before this kind of line may lead again
//   rest — days a given fact (its key) stays quiet once said
export const SOFT = [
  { ctx: 'newWeight',   gap: 0, rest: 365 },
  { ctx: 'raise',       gap: 5, rest: 7 },
  { ctx: 'planChange',  gap: 0, rest: 365 },
  { ctx: 'goal',        gap: 3, rest: 3 },
  { ctx: 'report',      gap: 2, rest: 3 },
  { ctx: 'level',       gap: 4, rest: 5 },
  { ctx: 'firstOfWeek', gap: 0, rest: 365 },
]
// The hour and the weekday: true, but only flavour, so they give way to
// the day's own lines in between.
const FLAVOUR_GAP = { early: 2, late: 2, friday: 6 }

// The day's word → its pool. A plan with its own Arabic labels keeps
// them as {day} in the generic pool.
const FOCUS = {
  'دفع': 'push', 'سحب': 'pull', 'أرجل': 'legs',
  'علوي': 'upper', 'سفلي': 'lower', 'شامل': 'full', 'انفجاري': 'full',
}

// ── Small helpers ─────────────────────────────────────────────
const utcDay = (key) => { const [y, m, d] = String(key).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)) }
const weekdayOf = (key) => utcDay(key).getUTCDay()   // 0 Sunday … 5 Friday, 6 Saturday
const lc = (s) => String(s || '').trim().toLowerCase()

/** A stable id for a line: its text, hashed (djb2), base 36. */
export const lineId = (tpl) => {
  let h = 5381
  for (let i = 0; i < tpl.length; i++) h = ((h << 5) + h + tpl.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

const seedOf = (s) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// ── Rendering ─────────────────────────────────────────────────
const TOKEN = /\{(\+?)([a-zA-Z]+)(?::([a-zA-Z]+))?\}/g

const has = (v) => v !== null && v !== undefined && v !== '' && v !== false

/** Can this line be said with today's values? */
export function fillable(tpl, vars = {}) {
  for (const [, flag, key, noun] of tpl.matchAll(TOKEN)) {
    if (key === 'name') continue
    if (flag) { if (!vars[key]) return false; continue }
    if (noun) { if (!(Number(vars[key]) >= 1)) return false; continue }
    if (!has(vars[key])) return false
  }
  return true
}

/** The line with its values in. «يا {name}» reads «يا بطل» without a name. */
export function renderLine(tpl, vars = {}, name = '') {
  const who = String(name || '').trim()
  const nm = who && who !== 'البطل' ? who : 'بطل'
  return tpl
    .replace(TOKEN, (_, flag, key, noun) => {
      if (key === 'name') return nm
      if (flag) return ''
      if (noun) return countWord(vars[key], noun)
      return String(vars[key] ?? '')
    })
    .replace(/\s+([،,.!؟])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// ── Memory ────────────────────────────────────────────────────
export function normalizeMemory(m) {
  const ok = m && typeof m === 'object' && !Array.isArray(m)
  const log = ok && Array.isArray(m.log)
    ? m.log.filter(e => e && typeof e.d === 'string' && typeof e.c === 'string' && typeof e.t === 'string') : []
  const seen = {}
  if (ok && m.seen && typeof m.seen === 'object') {
    for (const [k, v] of Object.entries(m.seen)) if (Array.isArray(v)) seen[k] = v.filter(x => typeof x === 'string')
  }
  const facts = {}
  if (ok && m.facts && typeof m.facts === 'object') {
    for (const [k, v] of Object.entries(m.facts)) if (typeof v === 'string') facts[k] = v
  }
  return { v: 1, log, seen, facts }
}

const lastShown = (mem, ctx, today) => {
  for (let i = mem.log.length - 1; i >= 0; i--) {
    const e = mem.log[i]
    if (e.c === ctx && e.d !== today) return e.d
  }
  return null
}
const gapOk = (mem, ctx, gap, today) => {
  if (!gap) return true
  if (mem.log.some(e => e.d === today && e.c === ctx)) return true
  const last = lastShown(mem, ctx, today)
  return !last || dayDiff(last, today) >= gap
}
const restOk = (mem, key, rest, today) => {
  const used = mem.facts[key]
  return !used || used === today || dayDiff(used, today) >= rest
}

// ── The facts ─────────────────────────────────────────────────

/** The heaviest done weight of an exercise entry, or 0. */
const topOf = (ex) => {
  let top = 0
  for (const s of ex?.sets || []) if (isCompleted(s)) top = Math.max(top, parseFloat(s.weight))
  return top
}

/** The best weight per exercise (canonical name) across sessions. */
function bests(sessions, mapping, resetAt) {
  const out = new Map()
  for (const s of sessions) {
    if ((s.id || 0) < resetAt) continue
    for (const ex of s.exercises || []) {
      const t = topOf(ex)
      if (!t) continue
      const k = resolveExerciseName(ex.name, mapping)
      if (t > (out.get(k) || 0)) out.set(k, t)
    }
  }
  return out
}

/** The biggest new weight in `these` against everything before `beforeDay`. */
function recordIn(these, all, beforeDay, mapping) {
  const resetAt = getWeightsResetAt()
  const before = bests(all.filter(s => dayKey(s.date) < beforeDay), mapping, resetAt)
  let best = null
  for (const s of these) {
    if (s.deload || (s.id || 0) < resetAt) continue
    for (const ex of s.exercises || []) {
      const top = topOf(ex)
      const prev = before.get(resolveExerciseName(ex.name, mapping)) || 0
      if (!(top > 0 && prev > 0 && top > prev)) continue
      const gain = (top - prev) / prev
      if (!best || gain > best.gain) {
        best = { gain, name: ex.name, exercise: arabicName(ex.name, mapping) || ex.name, weight: kgText(top), id: s.id }
      }
    }
  }
  return best
}

const whenWord = (n) => (n === 1 ? 'أمس' : n === 2 ? 'قبل يومين' : `قبل ${n} أيام`)

/** One plan day as the lines name it, or null. */
function dayInfo(day) {
  if (!day) return null
  const w = dayWord(day)
  if (!w.word || w.latin) return { word: null, muscles: musclesLine(day, ''), focus: 'train' }
  return { word: w.word, muscles: musclesLine(day, w.word) || null, focus: FOCUS[w.word] || 'train' }
}

/**
 * What is true today, as plain data. Pure: storage is read by
 * greetingToday() and passed in (goals, reportSeen).
 */
export function greetingFacts({
  sessions = [], plan = null, planIndex = 0, subs = {}, mapping = {}, repTarget = DEFAULT_REP_TARGET,
  recovery = null, config = {}, deload = null, xp = 0, active = null,
  today = todayKey(), now = new Date(), goals = {}, reportSeen = {},
} = {}) {
  const list = (sessions || []).filter(s => s && s.date)
  const dayOfS = (s) => dayKey(s.date)
  const status = recovery?.status
  const todays = list.filter(s => dayOfS(s) === today)
  const f = {
    today, hour: now.getHours(), weekday: weekdayOf(today), month: monthName(today.slice(0, 7)),
    fresh: !list.length && !active,
    done: status === DAY_STATUS.COMPLETED || todays.length > 0,
    restTaken: status === DAY_STATUS.REST_TAKEN,
    rest: status === DAY_STATUS.RECOVERY,
    milestone: null, comeback: null, deload: null, yesterday: null,
    day: null, tomorrow: null, restTomorrow: recovery?.tomorrowExpected === DAY_STATUS.RECOVERY,
    doneDay: null, setsToday: 0, record: null,
    soft: {},
  }

  // The streak, only when today already counts and lands on a milestone.
  const streak = recovery?.consistencyStreak || 0
  if (recovery && COUNTED.has(todayStreak(recovery, { config, active, today })) && isGreetingMilestone(streak)) {
    f.milestone = streak
  }

  const away = recovery?.daysSinceLastWorkout
  if (!f.done && Number.isFinite(away) && away >= COMEBACK_DAYS) f.comeback = away
  if (deload?.active) f.deload = { pct: deload.pct, daysLeft: deload.daysLeft }

  const yRow = (recovery?.ledger || []).find(r => r.date === addDays(today, -1))
  if (yRow?.kind === 'paid') f.yesterday = 'paid'
  else if (yRow?.kind === 'miss') f.yesterday = 'miss'

  // The plan day up next: today's on a training day, the next one on a
  // rest day or once today is trained (the index has moved on by then).
  const schedule = plan?.weeklySchedule
  const n = schedule?.length || 0
  const planDay = n ? schedule[(((planIndex ?? 0) % n) + n) % n] : null
  f.day = dayInfo(planDay)
  if (recovery?.tomorrowExpected === DAY_STATUS.WORKOUT && f.day?.word) f.tomorrow = f.day.word

  // Today, trained.
  if (f.done && todays.length) {
    const last = [...todays].sort((a, b) => (b.id || 0) - (a.id || 0))[0]
    const w = dayWord({ name: last.planDayName || last.name || '', exercises: last.exercises || [] })
    f.doneDay = w.word && !w.latin ? w.word : null
    f.setsToday = todays.reduce((t, s) => t + (s.exercises || []).flatMap(e => e.sets || []).filter(setCounts).length, 0)
    f.record = recordIn(todays, list, today, mapping)
  }

  // ── Training-day facts ──
  const soft = f.soft

  // A new weight in the last session, one to three days ago.
  const prev = list.filter(s => dayOfS(s) < today && !s.deload).sort((a, b) => (b.id || 0) - (a.id || 0))[0]
  if (prev) {
    const ago = dayDiff(dayOfS(prev), today)
    const rec = ago >= 1 && ago <= NEW_WEIGHT_WITHIN ? recordIn([prev], list, dayOfS(prev), mapping) : null
    if (rec) soft.newWeight = [{ key: `pr:${prev.id}`, exercise: rec.exercise, weight: rec.weight, when: whenWord(ago) }]
  }

  // Raises waiting in today's day (silent in a deload, as the player is).
  if (planDay && !deload?.active) {
    const out = []
    for (const ex of planDay.exercises || []) {
      const shown = substitutedName(ex.name, subs, EXERCISE_ALTERNATIVES)
      const a = analyzeProgression(list, shown, mapping, effectiveRepTarget(ex, repTarget))
      if (a.hint !== 'raise' || !(a.workingWeight > 0)) continue
      out.push({
        key: `raise:${resolveExerciseName(shown, mapping)}`,
        exercise: arabicName(shown, mapping) || shown,
        weight: kgText(roundToPlate(a.workingWeight + PLATE_STEP)),
      })
    }
    if (out.length) soft.raise = out
  }

  // An exercise swapped into today's day and never done yet.
  if (planDay) {
    const done = new Set(list.flatMap(s => (s.exercises || []).map(e => resolveExerciseName(e.name, mapping))))
    const out = []
    for (const ex of planDay.exercises || []) {
      if (!ex?.was?.name || lc(ex.was.name) === lc(ex.name)) continue
      const k = resolveExerciseName(ex.name, mapping)
      if (done.has(k)) continue
      out.push({ key: `plan:${k}`, exercise: arabicName(ex.name, mapping) || ex.name })
    }
    if (out.length) soft.planChange = out
  }

  // This month's goal, in reach.
  const thisMonth = today.slice(0, 7)
  const goal = monthGoalOf(goals, thisMonth)
  if (goal?.kind === 'sessions') {
    const days = new Set(list.map(dayOfS).filter(d => d.slice(0, 7) === thisMonth && d <= today))
    const left = goal.target - days.size
    // Only while it can still be reached: one session a day at most.
    const daysLeft = daysInMonth(thisMonth) - Number(today.slice(8, 10)) + 1
    if (left >= 1 && left <= GOAL_SESSIONS_NEAR && left <= daysLeft) {
      soft.goal = [{ key: `goal:${thisMonth}`, n: left, month: f.month }]
    }
  } else if (goal?.kind === 'lift') {
    const resetAt = getWeightsResetAt()
    let best = 0
    for (const s of list) {
      if (s.deload || (s.id || 0) < resetAt || dayOfS(s).slice(0, 7) !== thisMonth) continue
      for (const ex of s.exercises || []) if (resolveExerciseName(ex.name, mapping) === goal.lift) best = Math.max(best, topOf(ex))
    }
    const left = Math.round((goal.target - best) * 10) / 10
    if (best > 0 && left > 0 && left <= GOAL_KG_NEAR) {
      soft.goal = [{
        key: `goal:${thisMonth}`, kg: kgText(left), weight: kgText(goal.target),
        exercise: arabicName(goal.exercise, mapping) || goal.exercise,
      }]
    }
  }

  // Last month's report, not opened yet.
  const rm = monthReportWindow(today)
  if (rm && rm < thisMonth && list.some(s => dayOfS(s).slice(0, 7) === rm) && !storySeen(reportSeen, rm, today)) {
    soft.report = [{ key: `report:${rm}`, month: monthName(rm) }]
  }

  // The next level, a session or two away.
  if (xp > 0) {
    const p = xpProgress(xp)
    const left = p.neededXP - p.currentXP
    if (left > 0 && left <= LEVEL_NEAR_XP) soft.level = [{ key: `level:${p.level + 1}`, level: p.level + 1 }]
  }

  // Nothing yet this training week (Saturday to Friday), while the week
  // is young: by Tuesday «أول الأسبوع» is no longer what the day is about.
  const ws = weekStartKey(today)
  if (list.length && dayDiff(ws, today) <= FIRST_OF_WEEK_DAYS
      && !list.some(s => { const d = dayOfS(s); return d >= ws && d < today })) {
    soft.firstOfWeek = [{ key: `week:${ws}` }]
  }

  f.band = f.hour >= EARLY[0] && f.hour < EARLY[1] ? 'early'
    : (f.hour >= LATE_FROM || f.hour < 3) ? 'late' : null
  return f
}

// ── The situation ─────────────────────────────────────────────

const anyFillable = (pools, ctx, vars) => (pools[ctx] || []).some(t => fillable(t, vars))

/**
 * The most specific thing true about today: { ctx, vars, key }.
 * `memory` decides only between training-day facts (what was said
 * lately); the states of the day never depend on it.
 */
export function greetingContext(facts, memory = null, pools = GREETINGS) {
  const f = facts || {}
  const mem = normalizeMemory(memory)
  const today = f.today
  const day = f.day || {}
  const dayVars = { day: day.word, muscles: day.muscles }
  const pick = (ctx, vars = {}, key = null) => (anyFillable(pools, ctx, vars) ? { ctx, vars, key } : null)

  const hard = [
    () => f.fresh && pick('fresh'),
    () => f.milestone && pick('milestone', { n: f.milestone }),
    // Shares its key with newWeight: a record greeted on its own day is
    // not announced again the next morning.
    () => f.done && f.record && pick('doneRecord', { weight: f.record.weight, exercise: f.record.exercise, day: f.doneDay }, `pr:${f.record.id}`),
    () => f.done && pick('done', { day: f.doneDay, n: f.setsToday, tomorrow: f.tomorrow, restTomorrow: f.restTomorrow }),
    () => f.restTaken && pick('restTaken', { tomorrow: f.tomorrow }),
    () => f.rest && pick('rest', { tomorrow: f.tomorrow }),
    () => f.comeback && pick('comeback', { n: f.comeback, day: day.word }),
    () => f.deload && pick('deload', { pct: f.deload.pct, n: f.deload.daysLeft, day: day.word }),
    () => f.yesterday === 'paid' && pick('afterRest', { day: day.word }),
    () => f.yesterday === 'miss' && pick('missed', { day: day.word }),
  ]
  for (const h of hard) { const r = h(); if (r) return r }

  // A training day: the first fact worth saying that has not just been said.
  for (const { ctx, gap, rest } of SOFT) {
    const cands = f.soft?.[ctx]
    if (!cands?.length || !gapOk(mem, ctx, gap, today)) continue
    for (const c of cands) {
      if (!restOk(mem, c.key, rest, today)) continue
      const { key, ...vars } = c
      const r = pick(ctx, { ...dayVars, ...vars }, key)
      if (r) return r
    }
  }
  if (f.band && gapOk(mem, f.band, FLAVOUR_GAP[f.band], today)) {
    const r = pick(f.band, dayVars)
    if (r) return r
  }
  if (f.weekday === 5 && gapOk(mem, 'friday', FLAVOUR_GAP.friday, today)) {
    const r = pick('friday', dayVars)
    if (r) return r
  }
  return pick(day.focus || 'train', dayVars) || { ctx: 'train', vars: dayVars, key: null }
}

// ── The line ──────────────────────────────────────────────────

/**
 * Today's line and the memory after it. Pure: pass the memory in, store
 * what comes back. → { text, ctx, id, memory, changed }
 */
export function pickGreeting({ facts, memory = null, name = '', pools = GREETINGS } = {}) {
  const mem = normalizeMemory(memory)
  const today = facts?.today || todayKey()
  const { ctx, vars, key } = greetingContext(facts, mem, pools)
  const pool = pools[ctx] || []
  const ok = pool.filter(t => fillable(t, vars))

  // Already chosen today for this situation: the same line.
  let kept = null
  for (let i = mem.log.length - 1; i >= 0 && !kept; i--) {
    if (mem.log[i].d === today && mem.log[i].c === ctx) kept = mem.log[i]
  }
  const keptTpl = kept && ok.find(t => lineId(t) === kept.t)
  if (keptTpl) return { text: renderLine(keptTpl, vars, name), ctx, id: kept.t, memory: mem, changed: false }

  const ids = new Set(pool.map(lineId))
  const seen = (mem.seen[ctx] || []).filter(id => ids.has(id))
  const unseen = ok.filter(t => !seen.includes(lineId(t)))
  let tpl
  if (unseen.length) {
    const rnd = mulberry32(seedOf(`${today}|${ctx}|${seen.length}`))
    tpl = unseen[Math.floor(rnd() * unseen.length)]
  } else {
    // The pool is spent: the line shown longest ago.
    tpl = [...ok].sort((a, b) => seen.indexOf(lineId(a)) - seen.indexOf(lineId(b)))[0]
  }
  const id = lineId(tpl)

  const next = {
    v: 1,
    log: [...mem.log, { d: today, c: ctx, t: id }].slice(-LOG_MAX),
    seen: { ...mem.seen, [ctx]: [...seen.filter(x => x !== id), id] },
    facts: Object.fromEntries(Object.entries(mem.facts).filter(([, d]) => dayDiff(d, today) <= FACTS_KEEP_DAYS)),
  }
  if (key) next.facts[key] = today
  return { text: renderLine(tpl, vars, name), ctx, id, memory: next, changed: true }
}

/** The app's call: reads storage, picks, stores. Returns the line. */
export function greetingToday({ name, ...state } = {}) {
  const facts = greetingFacts({
    ...state,
    goals: ls.get(MONTH_GOAL_KEY, {}),
    reportSeen: ls.get(REPORT_SEEN_KEY, {}),
  })
  const out = pickGreeting({ facts, memory: ls.get(GREETING_KEY, null), name })
  if (out.changed) ls.set(GREETING_KEY, out.memory)
  return out.text
}
