// ── أيام الراحة الاختيارية: كم عندك، ومتى كسبت كل واحد ─────────
//
// حمزة: «اكتشفت ان انا عندي يوم راحة اختيارية وانا ماني داري». The
// engine (recovery.js) calls them credits and the old screens called
// them tickets (تذاكر); to him they are optional rest days. This file
// reads them off the ledger computeRecovery already writes — the same
// walk that decides the balance — so the list can never disagree with
// the number:
//
//   · a row with `earned: 1` is the day a rest day was earned (every 5th
//     counted day until 20 Oct 2026, every 3rd from 21 Oct — the engine's
//     restRulesOn); `streak` on that row is what the streak reached that day
//   · a row with `spent: 1` is a workout day a rest day covered
//   · a row with `trimmed: k` is the morning the cap of 5 came in (21 Oct)
//     and took k off a balance above it — the oldest held go first
//
// Which earned day a spend used is not stored anywhere (and does not
// matter to the engine): the oldest one held goes first. Nothing here is
// stored and nothing expires — a rest day stays until a missed workout
// day uses it. A run that ends (a miss with none left, or a plan reset)
// starts again from zero, exactly like the balance. The rule shown (how
// many counted days per rest day, the cap) is read from the engine for
// the day it is shown, never from a constant here.
//
// The announcement «كسبت يوم راحة» is shown once per earned day. Which
// ones were shown is kept under 'meran_rest_announced' — a new key of
// its own (per user, cleared by a data reset); the old design never
// reads it.

import { REST_CREDIT_EVERY, restRulesOn } from './recovery.js'
import { countAr, fmtDayAr } from './streak.js'

export const REST_ANNOUNCED_KEY = 'meran_rest_announced'

/**
 * { count, held: [{ earnedOn, streak }], used: [{ earnedOn, usedOn }],
 *   trimmed: [{ earnedOn, on }], toNext, every, cap, atCap } — held oldest
 * first, used and trimmed newest first. every/cap are the engine's rules
 * today (cap null before 21 Oct 2026); atCap: he holds the cap, so
 * counted days build nothing until one is used.
 */
export function restDaysView(recovery) {
  const held = []
  const used = []
  const trimmed = []
  // A rest day logged with none held (an old «خذ راحة» tap, or a day the
  // old design paid on its own rules) still holds the streak, and the
  // engine's balance goes below zero for it; the next one earned pays it
  // back rather than appearing in the list. Without this the list read
  // one more than the balance — and, at the cap, «6 من 5».
  let owed = 0
  for (const r of recovery?.ledger || []) {
    if (!r.inRun) continue
    // the order of that morning: the cap trims first, then what is earned
    for (let k = 0; k < (r.trimmed || 0); k++) {
      const first = held.shift()
      trimmed.push({ earnedOn: first?.earnedOn ?? null, on: r.date })
    }
    for (let k = 0; k < (r.earned || 0); k++) {
      if (owed > 0) { owed--; continue }
      held.push({ earnedOn: r.date, streak: r.streak ?? 0 })
    }
    if (r.spent) {
      const first = held.shift()
      if (!first) owed++
      used.push({ earnedOn: first?.earnedOn ?? null, usedOn: r.date })
    }
  }
  const every = recovery?.creditTarget ?? REST_CREDIT_EVERY
  return {
    count: held.length,
    held,
    used: used.reverse(),
    trimmed: trimmed.reverse(),
    toNext: recovery?.daysToNextCredit ?? every,
    every,
    cap: recovery?.creditCap ?? null,
    atCap: !!recovery?.atCap,
  }
}

/** How many rest days he holds — what the flame shows. */
export const restDayCount = (recovery) => restDaysView(recovery).count

/** «يوم راحة اختياري واحد», «يومين راحة اختيارية», «3 أيام راحة
 *  اختيارية», «11 يوم راحة اختياري»; at 0 «ولا يوم راحة اختياري». */
export function restDaysAr(n) {
  const k = Math.max(0, Math.round(Number(n) || 0))
  if (k === 0) return 'ولا يوم راحة اختياري'
  if (k === 1) return 'يوم راحة اختياري واحد'
  const r = k % 100
  const plural = k === 2 || (r >= 3 && r <= 10)
  return `${countAr(k, 'restday')} ${plural ? 'اختيارية' : 'اختياري'}`
}

const when = (iso, today) => (iso === today ? 'اليوم' : fmtDayAr(iso, { weekday: false }))

/**
 * The words for the block at the top of «ليش N؟», short:
 *   title   «أيام الراحة الاختيارية: 2 من 5» («: 2» before the cap existed)
 *   next    when the next one comes — or, at the cap, that it waits
 *   held    one line per rest day held, the day it was earned
 *   used    the last few that covered a day, newest first
 *   rows    what the sheet lists: the held ones (at most 3, newest) and
 *           the last used ones after them, 3 lines in all, newest first
 */
export function restDaysCopy(rv, today) {
  const n = rv?.count || 0
  const every = rv?.every ?? REST_CREDIT_EVERY
  const toNext = rv?.toNext ?? every
  const cap = rv?.cap ?? null
  const atCap = !!rv?.atCap
  const held = (rv?.held || []).map(h => ({ kind: 'held', date: h.earnedOn, text: `كسبته ${when(h.earnedOn, today)}` }))
  const used = (rv?.used || []).slice(0, 3).map(u => ({ kind: 'used', date: u.usedOn, text: `استخدمته ${when(u.usedOn, today)}` }))
  // (A trim at the switch is not a line here: after it he holds 5, so the
  // three lines are his. It is on that day in the calendar — dayLine.)
  const shownHeld = held.slice(-3)
  const rows = [...shownHeld, ...used.slice(0, 3 - shownHeld.length)]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.kind === 'used' ? -1 : 1))
  return {
    count: n,
    cap,
    atCap,
    title: cap ? `أيام الراحة الاختيارية: ${n} من ${cap}` : `أيام الراحة الاختيارية: ${n}`,
    // at the cap counted days build nothing: no slots, one line
    next: atCap ? 'وصلت الحد — تكسب بعد ما تستخدم واحد'
      : toNext === 1 ? 'الجاي بعد يوم واحد محسوب' : `الجاي بعد ${countAr(toNext, 'day')} محسوبة`,
    progress: atCap ? 0 : every - toNext,
    every,
    held,
    used,
    rows,
  }
}

/** The announcement's words, for the rest days just earned. How many
 *  counted days earned one is the engine's rule on the day it came. */
export function earnedCopy(days = [], count = 0) {
  const k = days.length
  const last = days[k - 1]
  return {
    title: k > 1 ? `كسبت ${countAr(k, 'restday')}` : 'كسبت يوم راحة',
    line: last ? `${countAr(restRulesOn(last.earnedOn).every, 'day')} محسوبة جديدة — وصل ستريكك ${last.streak}` : '',
    total: `صار عندك ${restDaysAr(count)}`,
    hint: 'لو فاتك يوم تمرين ينصرف لحاله، والستريك ما ينكسر.',
    aria: `كسبت ${k > 1 ? countAr(k, 'restday') : 'يوم راحة'}، صار عندك ${restDaysAr(count)}`,
  }
}

// ── Announced once ────────────────────────────────────────────

/**
 * The earned days to announce now, oldest first. `announced` is the
 * stored list, or null when nothing was ever stored: then everything he
 * already holds is taken as known (the flame already shows it) and
 * nothing is announced — an update must not greet him with a rest day
 * he earned last month.
 */
export function toAnnounce(held = [], announced = null) {
  if (!Array.isArray(announced)) return []
  const seen = new Set(announced)
  return held.filter(h => !seen.has(h.earnedOn))
}

/** The list to store after `days` were shown (or, the first time, the
 *  days he already holds). Kept short: only recent days can come back. */
export function markAnnounced(announced, days = []) {
  const all = new Set([...(Array.isArray(announced) ? announced : []), ...days])
  return [...all].filter(Boolean).sort().slice(-60)
}
