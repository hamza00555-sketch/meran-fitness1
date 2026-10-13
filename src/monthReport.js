// ── Monthly report ────────────────────────────────────────────
// One month of training, derived in one pass and handed to the UI as
// plain data. No React, no DOM, no storage — so it runs under
// `node --test` and every number can be checked without a browser.
//
// Everything here reuses the engines that already decide these facts
// elsewhere in the app: computeRecovery for the day-by-day plan,
// analyzeProgression for whether a lift is ready to go up, the deload
// stamps for which sessions were light on purpose. The report must
// never disagree with the screen that shows the same thing.
//
// What the report says, and nothing else (حمزة approved the list):
//   · how many sessions the plan asked for and how many he came to
//   · the month on a calendar, each day lit by how heavy it was
//   · the streak, as one number — the same one Home shows
//   · which lifts went up, against the best before the month
//   · completed sets per muscle per week, against the 10–20 range
//   · up to three things to do next month
// The tonnage headline, the verdict word, the daily volume bars, the
// push/pull ratio and the generic tips are gone on purpose.

import { dayKey, todayKey } from './day.js'
import {
  sessionVolume, resolveExerciseName, getWeightsResetAt,
  xpProgress, getRank, roundToPlate, PLATE_STEP,
} from './utils.js'
import { setCounts } from './sets.js'
import { analyzeProgression, isCompleted, DEFAULT_REP_TARGET, liftRepTarget } from './progression.js'
import { computeRecovery, addDays, dayDiff, patternFor } from './recovery.js'
import { countAr, unitAr, fmtDayAr } from './streak.js'
import { isDeloadSession } from './deload.js'
import { MUSCLE_GROUPS, ACHIEVEMENTS } from './constants.js'
import { arabicName } from './exerciseMedia.js'

// ── Calendar arithmetic ───────────────────────────────────────

/** 'YYYY-MM' for anything date-like, on the user's own training day
 *  (which turns at 03:00, not midnight — see day.js). */
export const monthKey = (dateLike) => dayKey(dateLike).slice(0, 7)

export const daysInMonth = (month) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export const prevMonth = (month) => {
  const [y, m] = month.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

export const nextMonth = (month) => {
  const [y, m] = month.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

/** First and last day keys of a month. */
export const firstDayOf = (month) => `${month}-01`
export const lastDayOf = (month) => `${month}-${String(daysInMonth(month)).padStart(2, '0')}`

const MONTH_NAMES = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

export const monthLabel = (month) => {
  const [y, m] = month.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

/** The month's name alone: «مارس». */
export const monthName = (month) => MONTH_NAMES[Number(month.slice(5, 7)) - 1]

/** The cover slot for a month — one piece of art per calendar month. */
export const coverSlot = (month) => `cover_${month.slice(5, 7)}`

// ── When the button is offered ────────────────────────────────
// The report is about a month that has finished, so it appears while
// that is still fresh: the last two days of the month (the result is
// settled by then) and the first week of the next one.
export const REPORT_WINDOW_TAIL = 2   // last N days of the month itself
export const REPORT_WINDOW_HEAD = 7   // first N days of the month after

/** The month a report should cover today, or null when out of window. */
export function monthReportWindow(today) {
  const key = dayKey(today)
  const month = key.slice(0, 7)
  const day = Number(key.slice(8, 10))

  if (day <= REPORT_WINDOW_HEAD) return prevMonth(month)
  if (day > daysInMonth(month) - REPORT_WINDOW_TAIL) return month
  return null
}

// ── Counting in Arabic ────────────────────────────────────────
// streak.js owns day/ticket/workout/session; these are the report's
// own nouns, on the same rule: 1 and 2 are words, 3–10 the plural,
// 11 and up the singular.
const NOUNS = {
  set:       { one: 'مجموعة وحدة', two: 'مجموعتين',   few: 'مجموعات',     many: 'مجموعة' },
  rep:       { one: 'عدّة وحدة',   two: 'عدّتين',     few: 'عدّات',       many: 'عدّة' },
  muscle:    { one: 'عضلة وحدة',   two: 'عضلتين',     few: 'عضلات',       many: 'عضلة' },
  thing:     { one: 'شي واحد',     two: 'شيئين',      few: 'أشياء',       many: 'شي' },
  newWeight: { one: 'وزن جديد',    two: 'وزنين جداد', few: 'أوزان جديدة', many: 'وزن جديد' },
}
const fewForm = (k) => { const r = k % 100; return k === 0 || (r >= 3 && r <= 10) }
export const countWord = (n, noun) => {
  if (!NOUNS[noun]) return countAr(n, noun)
  const f = NOUNS[noun]
  const k = Math.max(0, Math.round(Number(n) || 0))
  if (k === 1) return f.one
  if (k === 2) return f.two
  return `${k} ${fewForm(k) ? f.few : f.many}`
}

/** The plural or the singular, for a number drawn apart from its word
 *  (a figure on the poster): «5 أوزان جديدة», «12 وزن جديد», «1 وزن جديد».
 *  Pass the two forms, or a noun this file or streak.js knows. */
export const unitWord = (n, few, many) => {
  const k = Math.max(0, Math.round(Number(n) || 0))
  if (many === undefined) {
    if (!NOUNS[few]) return unitAr(k, few)
    return fewForm(k) ? NOUNS[few].few : NOUNS[few].many
  }
  return fewForm(k) ? few : many
}

/** Home's row for the report: «5 جلسات حضرتها من 28 · 8 أوزان جديدة». */
export function reportRowLine(report) {
  if (!report?.hasData) return ''
  const attended = report.attendance?.attended ?? report.sessionCount ?? 0
  let line = `${attended} ${unitAr(attended, 'session')} حضرتها`
  if (report.attendance?.planned) line += ` من ${report.attendance.planned}`
  if (report.prs?.length) line += ` · ${countWord(report.prs.length, 'newWeight')}`
  return line
}

/** «60» or «62.5» — a weight as a person writes it. */
export const kgText = (n) => String(Math.round(Number(n) * 10) / 10)

const nameOf = (exercise, mapping) => arabicName(exercise, mapping) || exercise

// ── Muscles ───────────────────────────────────────────────────

// A plan the user imported can carry any muscle string it likes. The
// home screen drops unknown ones on the floor; a report that quietly
// loses sets is worse than one that says "other".
const OTHER = { key: 'Other', label: 'أخرى', color: '#6B7280' }

const groupOf = (muscle) => {
  const g = MUSCLE_GROUPS[muscle]
  if (!g) return OTHER
  return { key: muscle, label: g.label, color: g.color }
}

/** The heaviest ticked set of one exercise entry, or 0. */
const topOf = (ex) => {
  let top = 0
  for (const s of ex?.sets || []) {
    if (!isCompleted(s)) continue          // a weight has to be lifted, not typed
    top = Math.max(top, parseFloat(s.weight))
  }
  return top
}

// ── Each day, as light ────────────────────────────────────────
// The calendar lights a trained day by how many kilos it moved, as a
// share of the month's heaviest day, in five steps: a day with 90% of
// the heaviest is lit almost as bright, one with a third of it is dim.
// Measured from zero, never from the month's lightest day — stretched
// between the two, days 4% apart read as «أخف يوم» and «أثقل يوم», and
// an arms day always looked like slacking beside a legs day.
// Deload days are left out of the scale: they are light on purpose, and
// a deload day is never what sets the heaviest.

export const DAY_LEVELS = 5

/** { 'YYYY-MM-DD': 1…5 } for ordinary days, null for deload days. */
export function dayLevels(series = [], bins = DAY_LEVELS) {
  const scale = series.filter(p => !p.deload)
  const out = {}
  const hi = scale.length ? Math.max(...scale.map(p => p.value)) : 0
  for (const p of series) {
    if (p.deload || !(hi > 0)) { out[p.date] = p.deload ? null : bins; continue }
    out[p.date] = Math.min(bins, Math.max(1, Math.ceil((p.value / hi) * bins)))
  }
  return out
}

// ── The month, day by day, read off the recovery ledger ───────
// computeRecovery already decides whether each day was meant for
// training and whether it was kept, and the streak on Home trusts that
// decision. The report filters it rather than re-deriving it.
//
// For a month that has finished the replay runs to the day after it, so
// its last day is judged like any other (the replay's own "today" is
// never called a miss). For the month still running it stops at today,
// and the days after it are «ahead» — not misses, not rests.
function consistencyIn(sessions, config, month, today, deloadRanges = []) {
  const first = firstDayOf(month)
  const last = lastDayOf(month)
  const running = today <= last
  const until = running ? today : addDays(last, 1)
  // A streak reset (a second plan change inside 30 days) voids every day
  // up to it. One that came after the month had not happened when the
  // month closed, so it cannot take that month's streak or tickets away.
  const resetAt = config?.streakResetAt
  const asOf = resetAt && resetAt > last ? { ...config, streakResetAt: null } : config
  const recovery = computeRecovery(sessions, asOf, until)
  const rows = new Map((recovery.ledger || []).filter(r => r.date.startsWith(month)).map(r => [r.date, r]))
  const trainedOn = new Set(sessions.map(s => dayKey(s.date)))

  const calendar = []
  for (let d = first; d <= last; d = addDays(d, 1)) {
    const r = rows.get(d)
    const deload = inRanges(deloadRanges, d)
    if (!r) {
      // After today: the plan for tomorrow is known, beyond it is not.
      if (running && d > today) {
        const planned = d === addDays(today, 1) && recovery.tomorrowExpected === 'workout'
        calendar.push({ date: d, kind: 'ahead', planned, deload })
      } else if (trainedOn.has(d)) {
        // Older than the replay reaches (it is capped at 400 days): the
        // session is still a session, only the plan around it is unknown.
        calendar.push({ date: d, kind: 'trained', planned: false, deload })
      } else {
        // Before the first session ever logged: not a day of the plan.
        calendar.push({ date: d, kind: 'none', planned: false, deload })
      }
      continue
    }
    const planned = r.scheduled === 'workout'
    const kind =
      r.completed ? 'trained' :
      r.kind === 'paid' ? 'paid' :
      r.pending ? 'ahead' :                // today, still unfolding
      r.kind === 'miss' ? 'miss' :
      'rest'
    calendar.push({ date: d, kind, planned, deload })
  }

  const count = (k) => calendar.filter(d => d.kind === k).length
  // The streak when the month closed: the ledger's own running figure on
  // its last day. While the month is running it is today's.
  const endStreak = running
    ? recovery.consistencyStreak
    : (rows.get(last)?.streak ?? 0)

  return {
    trainedDays: count('trained'),
    scheduledRests: count('rest'),
    paidRests: count('paid'),
    missedDays: calendar.filter(d => d.kind === 'miss').map(d => d.date),
    endStreak,
    running,
    calendar,
  }
}

// ── Planned against attended ──────────────────────────────────
// One slot for every session the plan asked for, plus any session done
// on a day it did not. A deload session is still a session: it counts
// as attended, its slot is only marked so it can be drawn blue.

export function attendanceOf(calendar = []) {
  const slots = calendar
    .filter(d => d.planned || d.kind === 'trained')
    .map(d => ({
      date: d.date,
      state: d.kind === 'trained' ? 'done'
        : d.kind === 'paid' ? 'ticket'
        : d.kind === 'ahead' ? 'ahead'
        : 'missed',
      planned: !!d.planned,
      deload: !!d.deload,
    }))
  const planned = calendar.filter(d => d.planned).length
  return {
    planned,
    attended: slots.filter(s => s.state === 'done').length,
    extra: slots.filter(s => s.state === 'done' && !s.planned).length,
    missed: slots.filter(s => s.state === 'missed').length,
    tickets: slots.filter(s => s.state === 'ticket').length,
    ahead: slots.filter(s => s.state === 'ahead').length,
    deload: slots.filter(s => s.deload).length,
    slots,
  }
}

/** The cover's one sentence about showing up. */
export function attendanceLine(a) {
  if (!a) return ''
  const skipped = a.missed + a.tickets
  if (!a.planned) return `حضرت ${countAr(a.attended, 'session')} هالشهر.`
  const of = `من ${countAr(a.planned, 'session')} في خطتك`
  const parts = []
  if (skipped) parts.push(`فاتتك ${skipped === 1 ? 'وحدة' : countAr(skipped, 'session')}`)
  if (a.ahead) parts.push(`باقي ${a.ahead === 1 ? 'وحدة' : countAr(a.ahead, 'session')}`)
  if (!parts.length) {
    return a.extra
      ? `حضرت كل جلسات خطتك، وزدت عليها ${a.extra === 1 ? 'وحدة' : countAr(a.extra, 'session')}.`
      : 'حضرت كل جلسات خطتك هالشهر.'
  }
  // «فاتتك وحدة بس» reads as the good month it was.
  if (parts.length === 1 && skipped === 1) return `${of}، فاتتك وحدة بس.`
  return `${of}، ${parts.join('، و')}.`
}

const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
/** «الأربعاء 18» — the month is already on the screen. */
const weekdayAndDay = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}`
}

/** The calendar's one sentence: did he keep to the plan, and where not.
 *  A day a ticket paid for is still a planned session that did not
 *  happen — the cover counts it as missed, so this does too; the ticket
 *  line under the calendar says the streak survived it. */
export function calendarLine(calendar = []) {
  const misses = calendar.filter(d => d.kind === 'miss' || d.kind === 'paid').map(d => d.date)
  const running = calendar.some(d => d.kind === 'ahead')
  if (!calendar.some(d => d.planned || d.kind === 'trained')) return ''
  if (!misses.length) return running ? 'مشيت على خطتك لين اليوم.' : 'مشيت على خطتك الشهر كله.'
  if (misses.length === 1) return `مشيت على خطتك، إلا ${weekdayAndDay(misses[0])}.`
  if (misses.length === 2) return `مشيت على خطتك، إلا يومين: ${weekdayAndDay(misses[0])} و${weekdayAndDay(misses[1])}.`
  return `فاتك ${countAr(misses.length, 'day')} من خطتك هالشهر.`
}

/** «صرت أقوى؟» answered in one line. */
export function strongerLine(newCount) {
  if (!newCount) return 'ما تعدّيت أثقل وزن لك في ولا تمرين هالشهر.'
  return `وزنك زاد في ${countAr(newCount, 'workout')}.`
}

// ── Deload, as the report says it ─────────────────────────────
// From the stored history and from the sessions' own stamps, so a
// deload is found even when only one of the two survived an import.
//
// The stored entry decides where a deload ended. A session's stamp
// carries the end that was PLANNED when the session started, so a
// deload cut short on day three still has stamps saying day seven; read
// alongside the history, they would call ordinary training days light.
// A stamp only speaks for a deload the history has no entry for, and
// then an ordinary (unstamped) session inside its planned days shows it
// had already ended: it stops at the last stamped day before that.

export function deloadRangesIn(config = {}, month, sessions = []) {
  const first = firstDayOf(month)
  const last = lastDayOf(month)
  const stored = new Map()
  const keep = (from, to) => {
    if (from && to && !(stored.get(from) >= to)) stored.set(from, to)
  }
  for (const h of config?.deloadHistory || []) keep(h?.from, h?.until || h?.plannedUntil)
  if (config?.deload?.from) keep(config.deload.from, config.deload.plannedUntil)

  // Stamp-only deloads, keyed by their own start.
  const stamped = new Map()
  const days = sessions.map(s => ({ s, day: dayKey(s.date) })).sort((a, b) => (a.day < b.day ? -1 : 1))
  for (const { s, day } of days) {
    if (!isDeloadSession(s) || !s.deload.from || !s.deload.until || stored.has(s.deload.from)) continue
    const row = stamped.get(s.deload.from) || { from: s.deload.from, until: s.deload.until, lastDay: day }
    if (s.deload.until > row.until) row.until = s.deload.until
    if (day > row.lastDay) row.lastDay = day
    stamped.set(s.deload.from, row)
  }
  for (const row of stamped.values()) {
    const ordinary = days.find(({ s, day }) => !isDeloadSession(s) && day > row.lastDay && day <= row.until)
    stored.set(row.from, ordinary ? row.lastDay : row.until)
  }

  return [...stored.entries()]
    .filter(([from, to]) => from <= last && to >= first)
    .map(([from, to]) => ({ from, to }))
    .sort((a, b) => (a.from < b.from ? -1 : 1))
}

/** Is this day inside one of the ranges deloadRangesIn found? */
const inRanges = (ranges, day) => ranges.some(r => day >= r.from && day <= r.to)

/** «فيه أسبوع تخفيف من 25 إلى 31. خفيف عن قصد، وما ينحسب ضدك.» */
export function deloadLine(ranges = [], month) {
  if (!ranges.length) return ''
  const inMonth = (d) => d.slice(0, 7) === month
  const spans = ranges.map(({ from, to }) => {
    const both = inMonth(from) && inMonth(to)
    const a = both ? String(Number(from.slice(8))) : fmtDayAr(from, { weekday: false })
    const b = both ? String(Number(to.slice(8))) : fmtDayAr(to, { weekday: false })
    return from === to ? `يوم ${a}` : `من ${a} إلى ${b}`
  })
  const days = dayDiff(ranges[0].from, ranges[0].to) + 1
  const word = ranges.length === 1 && days >= 6 && days <= 8 ? 'أسبوع تخفيف' : 'تخفيف'
  return `فيه ${word} ${spans.join('، و')}. خفيف عن قصد، وما ينحسب ضدك.`
}

// ── Lifts: what went up ───────────────────────────────────────
// Per lift trained in the month: the heaviest ticked set inside it,
// against the heaviest before it. Deload sessions are left out of both
// sides — a planned taper is neither a new weight nor a step back.
//
// The first weight ever logged is a starting point, not a gain: a lift
// first done this month uses its first session as the bar, and only a
// later session above it counts.
//
// «وزن جديد» means one thing in the whole report: heavier than any
// weight lifted in that exercise before. Not an estimated max, not more
// reps at the same weight.

export function liftGains(sessions = [], month, { mapping = {}, resetAt = 0 } = {}) {
  const last = lastDayOf(month)
  const ordered = sessions
    .filter(s => (s.id || 0) >= resetAt && !isDeloadSession(s))
    .map(s => ({ s, day: dayKey(s.date) }))
    .filter(x => x.day <= last)                          // the future cannot move this month
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : (a.s.id || 0) - (b.s.id || 0)))

  const before = new Map()      // lift → heaviest before the month
  const visits = new Map()      // lift → [{ day, top, name }] inside it

  for (const { s, day } of ordered) {
    const inMonth = day.slice(0, 7) === month
    for (const ex of s.exercises || []) {
      const lift = resolveExerciseName(ex.name, mapping)
      const top = topOf(ex)
      if (!lift || !top) continue
      if (!inMonth) { before.set(lift, Math.max(before.get(lift) || 0, top)); continue }
      if (!visits.has(lift)) visits.set(lift, [])
      visits.get(lift).push({ day, top, name: ex.name })
    }
  }

  const rows = []
  for (const [lift, list] of visits) {
    const prior = before.get(lift) || 0
    const firstTime = prior <= 0
    const bar = firstTime ? list[0].top : prior
    const rest = firstTime ? list.slice(1) : list
    let top = bar, at = null
    for (const v of rest) if (v.top > top) { top = v.top; at = v }
    const gain = top > bar ? Math.round((top - bar) * 10) / 10 : 0
    rows.push({
      lift,
      exercise: (at || list[list.length - 1]).name,
      before: bar,
      top: gain ? top : Math.max(...list.map(v => v.top)),
      gain,
      date: at ? at.day : null,
      steps: rest.filter(v => v.top > bar).length,
      sessions: list.length,
      firstTime,
    })
  }
  return rows.sort((a, b) => b.gain - a.gain || b.sessions - a.sessions)
}

/** The new weights only, biggest jump first — the report's «وزن جديد».
 *  firstTime: the lift was started this month, so prevBest is its first
 *  session's weight, not a best from before. */
export const newWeights = (gains = []) => gains
  .filter(g => g.gain > 0)
  .map(g => ({
    exercise: g.exercise, lift: g.lift, weight: g.top, prevBest: g.before,
    gain: g.gain, date: g.date, steps: g.steps, firstTime: !!g.firstTime,
  }))

/** What a new weight is measured from: «كان 60» for a best from before
 *  the month, «بدأته على 40» for a lift first done in it. */
export const fromWord = (pr) => (pr?.firstTime ? 'بدأته على' : 'كان')

// ── One lift, week by week ────────────────────────────────────
// The heaviest ticked set of a lift in each of the last `weeks` weeks,
// oldest first, the last one ending on `end`. Weeks are seven days
// counted back from `end`, so the last week is always a whole week of
// this month. A deload session never sets a week's top; its own weight
// is kept apart (deloadTop) so a chart can draw it hollow and unjoined.

export function weeklyTop(sessions = [], liftId, weeks = 9, { end, mapping = {}, resetAt = 0 } = {}) {
  const target = resolveExerciseName(liftId, mapping)
  const stop = dayKey(end || todayKey())
  const out = []
  for (let k = weeks - 1; k >= 0; k--) {
    const to = addDays(stop, -7 * k)
    out.push({ from: addDays(to, -6), to, top: null, deloadTop: null, deload: false })
  }
  const start = out[0].from
  for (const s of sessions) {
    if ((s.id || 0) < resetAt) continue
    const day = dayKey(s.date)
    if (day < start || day > stop) continue
    const week = out[Math.floor(dayDiff(start, day) / 7)]
    const light = isDeloadSession(s)
    if (light) week.deload = true
    for (const ex of s.exercises || []) {
      if (resolveExerciseName(ex.name, mapping) !== target) continue
      const t = topOf(ex)
      if (!t) continue
      if (light) week.deloadTop = Math.max(week.deloadTop || 0, t)
      else week.top = Math.max(week.top || 0, t)
    }
  }
  return out
}

// ── Sets per muscle per week ──────────────────────────────────
// Completed sets, by muscle group, averaged over the weeks the month
// actually covered — from its first day (or the first session ever, in
// the month someone started) to its last day (or today, while it runs).
// The range is the plan builder's: 10–20 sets a week is where a muscle
// grows. Cardio has no sets in that sense and is left out; an unknown
// muscle is shown but not judged.

export const WEEKLY_SETS = { min: 10, max: 20 }

export function muscleSets(sessions = [], month, { today = todayKey(), firstEver = null } = {}) {
  const first = firstDayOf(month)
  const last = lastDayOf(month)
  const from = firstEver && firstEver > first ? firstEver : first
  const to = today < last ? today : last
  const weeks = Math.max(1, (dayDiff(from, to) + 1) / 7)

  const by = new Map()
  for (const s of sessions) {
    if (monthKey(s.date) !== month) continue
    for (const ex of s.exercises || []) {
      if (ex.muscle === 'Cardio') continue
      const n = (ex.sets || []).filter(setCounts).length
      if (!n) continue
      const g = groupOf(ex.muscle)
      const row = by.get(g.key) || { ...g, sets: 0 }
      row.sets += n
      by.set(g.key, row)
    }
  }
  return [...by.values()]
    .map(m => {
      const perWeek = Math.round((m.sets / weeks) * 10) / 10
      // Judged on the whole number the screen shows: 9.7 is drawn as
      // «10», and «10 · أقل من اللازم» beside a range that starts at 10
      // would contradict itself.
      const shown = Math.round(perWeek)
      const status = m.key === OTHER.key ? null
        : shown < WEEKLY_SETS.min ? 'low'
        : shown > WEEKLY_SETS.max ? 'high'
        : 'ok'
      return { ...m, perWeek, shown, status }
    })
    .sort((a, b) => b.perWeek - a.perWeek)
}

// The groups whose Arabic name is a plural: «الأرجل», «الأكتاف». A
// plural of things takes the feminine verb — «الأرجل أخذت أقل من حقها»
// — where «الظهر» and «البايسبس» take «أخذ … حقه».
const PLURAL_GROUPS = new Set(['Legs', 'Shoulders'])
const tookVerb = (key) => (PLURAL_GROUPS.has(key) ? 'أخذت' : 'أخذ')
const itsDue = (key) => (PLURAL_GROUPS.has(key) ? 'حقها' : 'حقه')

/** «الظهر أخذ أقل من حقه.» / «الأرجل أخذت أقل من حقها.» */
export function musclesLine(muscles = []) {
  const judged = muscles.filter(m => m.status)
  if (!judged.length) return ''
  const low = judged.filter(m => m.status === 'low').sort((a, b) => a.perWeek - b.perWeek)
  if (!low.length) return 'كل عضلاتك أخذت حقها.'
  if (low.length === 1) return `${low[0].label} ${tookVerb(low[0].key)} أقل من ${itsDue(low[0].key)}.`
  if (low.length === 2) return `${low[0].label} و${low[1].label} أخذوا أقل من حقهم.`
  return `${countWord(low.length, 'muscle')} أخذت أقل من حقها.`
}

// ── Next month: three things at most ──────────────────────────
// Straight from the progression engine — the same verdict the session
// screen shows — plus the muscles that sat under the range:
//   raise  — held the reps at this weight, time for more
//   sets   — a muscle under 10 sets a week
//   lower  — missed the bottom of the range twice in a row
// One of each kind first, so three raises can never bury the muscle
// that is being skipped. Read as of the month's last day, so an old
// report gives the advice it would have given then.

export const MAX_NEXT = 3

export function nextMonthPlan({ sessions = [], month, mapping = {}, repTarget = DEFAULT_REP_TARGET, muscles = [], plan = null } = {}) {
  const last = lastDayOf(month)
  const upTo = sessions.filter(s => dayKey(s.date) <= last)

  const trained = new Map()   // lift → { name, n }
  for (const s of upTo) {
    if (monthKey(s.date) !== month) continue
    for (const ex of s.exercises || []) {
      const lift = resolveExerciseName(ex.name, mapping)
      if (!lift) continue
      const row = trained.get(lift) || { name: ex.name, n: 0 }
      row.n++
      row.name = ex.name
      trained.set(lift, row)
    }
  }

  const raise = [], lower = []
  for (const { name, n } of trained.values()) {
    // Judged on the range its sessions ran on — the player's own verdict.
    const t = liftRepTarget(upTo, name, mapping, { plan, fallback: repTarget })
    const a = analyzeProgression(upTo, name, mapping, t)
    if (a.hint === 'raise') {
      // The new weight is the player's own: one plate step up (WorkoutPlayer).
      raise.push({ kind: 'raise', exercise: name, weight: a.workingWeight, to: roundToPlate(a.workingWeight + PLATE_STEP), reps: a.target.top, n })
    } else if (a.hint === 'lower') {
      lower.push({ kind: 'lower', exercise: name, weight: a.workingWeight, to: a.suggestedWeight, reps: a.target.base, n: a.failedAtWeight })
    }
  }
  raise.sort((a, b) => b.n - a.n)
  lower.sort((a, b) => b.n - a.n)
  const sets = muscles
    .filter(m => m.status === 'low')
    .sort((a, b) => a.perWeek - b.perWeek)
    .map(m => ({ kind: 'sets', muscle: m.key, label: m.label, perWeek: m.perWeek, shown: m.shown ?? Math.round(m.perWeek), min: WEEKLY_SETS.min, max: WEEKLY_SETS.max }))

  const out = []
  const queues = [raise, sets, lower]
  while (out.length < MAX_NEXT && queues.some(q => q.length)) {
    for (const q of queues) {
      if (out.length < MAX_NEXT && q.length) out.push(q.shift())
    }
  }
  return out
}

/** One suggestion as a title and its one plain reason. */
export function nextCopy(item, mapping = {}) {
  if (!item) return null
  if (item.kind === 'raise') {
    return {
      title: item.to
        ? `ارفع ${nameOf(item.exercise, mapping)} إلى ${kgText(item.to)} كجم`
        : `ارفع وزن ${nameOf(item.exercise, mapping)}`,
      reason: `وصلت ${countWord(item.reps, 'rep')} على ${kgText(item.weight)} كجم، فالوزن صار خفيف عليك.`,
    }
  }
  if (item.kind === 'lower') {
    return {
      title: `نزّل ${nameOf(item.exercise, mapping)} إلى ${kgText(item.to)} كجم`,
      reason: `ما وصلت ${countWord(item.reps, 'rep')} على ${kgText(item.weight)} كجم مرتين ورا بعض.`,
    }
  }
  if (item.kind === 'sets') {
    const per = item.shown ?? Math.round(item.perWeek)
    const took = per < 1 ? 'أقل من مجموعة' : countWord(per, 'set')
    return {
      title: `زِد مجموعات ${item.label}`,
      reason: `${item.label} ${tookVerb(item.muscle)} ${took} بالأسبوع، والمناسب من ${item.min} إلى ${item.max}.`,
    }
  }
  return null
}

// ── The month's goal ──────────────────────────────────────────
// Stored under its own new key, so the old design never sees it:
//   hf_month_goal = { 'YYYY-MM': { kind: 'sessions', target }
//                              | { kind: 'lift', lift, exercise, target } }
// «sessions» is the default: come to N sessions. «lift» is a weight to
// reach in one exercise (target in kg; lift is the canonical name the
// history is matched by, exercise the name to show). Anything else
// stored there is ignored rather than guessed at.

export const MONTH_GOAL_KEY = 'hf_month_goal'
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

const cleanGoal = (g) => {
  if (!g || typeof g !== 'object') return null
  if (g.kind === 'sessions') {
    const target = Math.round(Number(g.target))
    return target > 0 ? { kind: 'sessions', target } : null
  }
  if (g.kind === 'lift') {
    const target = Math.round(Number(g.target) * 10) / 10
    const lift = typeof g.lift === 'string' ? g.lift.trim() : ''
    if (!(target > 0) || !lift) return null
    const exercise = typeof g.exercise === 'string' && g.exercise.trim() ? g.exercise.trim() : lift
    return { kind: 'lift', lift, exercise, target }
  }
  return null
}

export function monthGoalOf(goals, month) {
  const g = goals && typeof goals === 'object' ? goals[month] : null
  return cleanGoal(g)
}

/** A new goals object with this month's goal set (or removed with null).
 *  A goal given without a kind is a sessions goal. */
export function withMonthGoal(goals, month, goal) {
  const next = { ...(goals && typeof goals === 'object' ? goals : {}) }
  if (!MONTH_RE.test(String(month))) return next
  const clean = goal ? cleanGoal({ kind: 'sessions', ...goal }) : null
  if (!clean) { delete next[month]; return next }
  next[month] = clean
  return next
}

/** How the month went against its goal: reached, on which day, or how
 *  many short. A lift goal reads the month's sessions (deload ones left
 *  out, as everywhere a weight is judged), so they are passed in. */
export function goalResult(goal, calendar = [], { sessions = [], month = null, mapping = {}, resetAt = 0 } = {}) {
  if (!goal) return null
  if (goal.kind === 'lift') {
    const tops = new Map()
    for (const s of sessions) {
      if ((s.id || 0) < resetAt || isDeloadSession(s)) continue
      const day = dayKey(s.date)
      if (month && day.slice(0, 7) !== month) continue
      for (const ex of s.exercises || []) {
        if (resolveExerciseName(ex.name, mapping) !== goal.lift) continue
        const t = topOf(ex)
        if (t > 0) tops.set(day, Math.max(tops.get(day) || 0, t))
      }
    }
    const days = [...tops.keys()].sort()
    const best = days.length ? Math.max(...tops.values()) : 0
    const hit = days.find(d => tops.get(d) >= goal.target) || null
    return {
      kind: 'lift', lift: goal.lift, exercise: goal.exercise,
      name: nameOf(goal.exercise, mapping),
      target: goal.target, best,
      reached: !!hit, reachedOn: hit,
      left: Math.max(0, Math.round((goal.target - best) * 10) / 10),
    }
  }
  const days = calendar.filter(d => d.kind === 'trained').map(d => d.date).sort()
  const done = days.length
  const reached = done >= goal.target
  return {
    kind: goal.kind,
    target: goal.target,
    done,
    reached,
    reachedOn: reached ? days[goal.target - 1] : null,
    left: Math.max(0, goal.target - done),
  }
}

export function goalLine(result, { over = true } = {}) {
  if (!result) return ''
  if (result.kind === 'lift') {
    const kg = `${kgText(result.target)} كجم في ${result.name}`
    if (result.reached) return `هدفك ${kg}، ووصلته يوم ${fmtDayAr(result.reachedOn, { weekday: false })}.`
    if (!over) return `هدفك ${kg}، باقي لك ${kgText(result.left)} كجم.`
    return result.best > 0
      ? `هدفك كان ${kg}، وأثقل وزن رفعته ${kgText(result.best)} كجم.`
      : `هدفك كان ${kg}، وما رفعته هالشهر.`
  }
  const target = countAr(result.target, 'session')
  if (result.reached) return `هدفك ${target}، ووصلته يوم ${fmtDayAr(result.reachedOn, { weekday: false })}.`
  return over
    ? `هدفك كان ${target}، وناقصك ${countAr(result.left, 'session')}.`
    : `هدفك ${target}، باقي لك ${countAr(result.left, 'session')}.`
}

/** The sessions a month holds on the plan's rolling cycle (two on, one
 *  off is two in every three days): the goal offered for a month to come. */
export function expectedSessions(config = {}, month) {
  const p = patternFor(config)
  const on = p.reduce((n, x) => n + x, 0)
  return Math.max(1, Math.round((daysInMonth(month) * on) / (on + p.length)))
}

// ── Past months ───────────────────────────────────────────────

/** Every month with a session in it, up to `upTo`, newest first. */
export function reportMonths(sessions = [], upTo) {
  const set = new Set()
  for (const s of sessions) {
    const m = monthKey(s.date)
    if (!upTo || m <= upTo) set.add(m)
  }
  return [...set].sort().reverse()
}

/** Training days in each of the `n` months ending at `end`, oldest
 *  first — starting no earlier than the first month he trained, so a
 *  new user is not shown a row of empty months from before he began. */
export function monthsTrail(sessions = [], end, n = 6) {
  const months = [end]
  while (months.length < n) months.unshift(prevMonth(months[0]))
  const days = new Map(months.map(m => [m, new Set()]))
  let first = null
  for (const s of sessions) {
    const k = dayKey(s.date)
    days.get(k.slice(0, 7))?.add(k)
    if (!first || k < first) first = k
  }
  const from = first ? first.slice(0, 7) : end
  return months
    .filter(m => m >= from || m === end)
    .map(m => ({ month: m, attended: days.get(m).size }))
}

// ── The report ────────────────────────────────────────────────

export function buildMonthReport({
  sessions = [],
  config = {},
  unlockedAt = {},
  xp = 0,
  mapping = {},
  repTarget = DEFAULT_REP_TARGET,
  plan = null,
  goals = {},
  month,
  today = todayKey(),
} = {}) {
  const resetAt = getWeightsResetAt()
  const day = dayKey(today)
  const inMonth = sessions.filter(s => monthKey(s.date) === month)
  const label = monthLabel(month)

  if (!inMonth.length) {
    return { month, monthLabel: label, cover: coverSlot(month), hasData: false, sessionCount: 0 }
  }

  // ── Sets, reps, time ──
  const total = inMonth.reduce((n, s) => n + sessionVolume(s), 0)
  let setsTotal = 0, setsCompleted = 0, repsTotal = 0
  for (const s of inMonth) {
    for (const ex of s.exercises || []) {
      for (const set of ex.sets || []) {
        const counted = set.done || parseFloat(set.weight) > 0
        if (!counted) continue
        setsTotal++
        // Ticked is done, a pull-up or a plank at body weight included:
        // the rule the muscle bars count by (sets.js).
        if (setCounts(set)) { setsCompleted++; repsTotal += parseInt(set.reps) || 0 }
      }
    }
  }
  const timed = inMonth.filter(s => s.duration > 0)
  const totalMinutes = timed.reduce((n, s) => n + s.duration, 0)

  // ── Each training day's kilos ──
  // Days are merged rather than sessions listed: two sessions on one
  // day is one day's work. A day is a deload day if the work done on it
  // was — read off the session's own stamp, never today's settings.
  const byDay = new Map()
  for (const s of inMonth) {
    const key = dayKey(s.date)
    const row = byDay.get(key) || { value: 0, deload: false }
    row.value += sessionVolume(s)
    if (isDeloadSession(s)) row.deload = true
    byDay.set(key, row)
  }
  const series = [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, r]) => ({ date, value: Math.round(r.value), deload: r.deload }))
  const levels = dayLevels(series)

  // ── The plan, the calendar, the streak ──
  const deloadRanges = deloadRangesIn(config, month, inMonth)
  const consistency = consistencyIn(sessions, config, month, day, deloadRanges)
  const kgOn = new Map(series.map(p => [p.date, p]))
  for (const d of consistency.calendar) {
    const p = kgOn.get(d.date)
    d.kg = p ? p.value : 0
    d.level = d.kind === 'trained' && p ? levels[p.date] : null
    // A day trained under a deload is a deload day even without the
    // stored stretch (an imported history keeps only the stamp).
    if (p?.deload) d.deload = true
  }
  const attendance = attendanceOf(consistency.calendar)

  // ── Lifts ──
  const gains = liftGains(sessions, month, { mapping, resetAt })
  const prs = newWeights(gains)
  const jump = prs[0]
    ? { ...prs[0], weekly: weeklyTop(sessions, prs[0].lift, 9, { end: lastDayOf(month), mapping, resetAt }) }
    : null

  // ── Muscles ──
  let firstEver = null
  for (const s of sessions) {
    const k = dayKey(s.date)
    if (!firstEver || k < firstEver) firstEver = k
  }
  const muscles = muscleSets(sessions, month, { today: day, firstEver })

  // ── Progress ──
  // Only today's XP is stored, so the level is today's. For the month
  // still running that is the month's own; for one that has finished it
  // is not, and the report says so rather than passing it off as then.
  const { level } = xpProgress(xp)
  const levelIsToday = day > lastDayOf(month)
  const achievements = Object.entries(unlockedAt)
    .filter(([, at]) => monthKey(new Date(at)) === month)
    .map(([id]) => ACHIEVEMENTS.find(a => a.id === id))
    .filter(Boolean)
    .map(a => ({ id: a.id, title: a.title, rarity: a.rarity, icon: a.icon, xp: a.xp }))

  return {
    month,
    monthLabel: label,
    cover: coverSlot(month),
    hasData: true,
    sessionCount: inMonth.length,
    attendance,
    deload: deloadRanges.length ? { ranges: deloadRanges, days: consistency.calendar.filter(d => d.deload).length } : null,
    volume: {
      // Kept for the share poster; the report itself no longer leads
      // with kilos.
      total: Math.round(total),
      series,
      deloadDays: series.filter(p => p.deload).length,
      deloadSessions: inMonth.filter(isDeloadSession).length,
    },
    sets: {
      total: setsTotal,
      completed: setsCompleted,
      untrackedPct: setsTotal ? Math.round(((setsTotal - setsCompleted) / setsTotal) * 100) : 0,
    },
    reps: { total: repsTotal },
    time: {
      // duration is absent on imported and in-progress sessions, so the
      // averages are only offered when at least two thirds of the month
      // has it.
      known: timed.length * 3 >= inMonth.length * 2,
      totalMinutes,
      avgMinutes: timed.length ? Math.round(totalMinutes / timed.length) : 0,
      sessionsTimed: timed.length,
    },
    gains,
    prs,
    jump,
    muscles,
    consistency,
    next: nextMonthPlan({ sessions, month, mapping, repTarget, muscles, plan }),
    goal: (() => {
      const g = goalResult(monthGoalOf(goals, month), consistency.calendar, { sessions, month, mapping, resetAt })
      // A weight goal is drawn as its lift, week by week through the month.
      if (g?.kind === 'lift') g.weekly = weeklyTop(sessions, g.lift, 5, { end: lastDayOf(month), mapping, resetAt })
      return g
    })(),
    // The goal already set for the month after this one, if any: the
    // «خطة الشهر الجاي» card shows it rather than offering one.
    nextGoal: monthGoalOf(goals, nextMonth(month)),
    progress: {
      level,
      rank: getRank(level),
      levelIsToday,
      achievements,
    },
  }
}
