// ── أيام الراحة الاختيارية: كم عندك، ومتى كسبت كل واحد ─────────
//
// حمزة: «اكتشفت ان انا عندي يوم راحة اختيارية وانا ماني داري». The
// engine (recovery.js) calls them credits and the old screens called
// them tickets (تذاكر); to him they are optional rest days. This file
// reads them off the ledger computeRecovery already writes — the same
// walk that decides the balance — so the list can never disagree with
// the number:
//
//   · a row with `earned: 1` is the day a rest day was earned (the 5th,
//     10th, … counted day of the run); `streak` on that row is what the
//     streak reached that day
//   · a row with `spent: 1` is a workout day a rest day covered
//
// Which earned day a spend used is not stored anywhere (and does not
// matter to the engine): the oldest one held goes first. Nothing here is
// stored and nothing expires — a rest day stays until a missed workout
// day uses it. A run that ends (a miss with none left, or a plan reset)
// starts again from zero, exactly like the balance.
//
// The announcement «كسبت يوم راحة» is shown once per earned day. Which
// ones were shown is kept under 'meran_rest_announced' — a new key of
// its own (per user, cleared by a data reset); the old design never
// reads it.

import { REST_CREDIT_EVERY } from './recovery.js'
import { countAr, fmtDayAr } from './streak.js'

export const REST_ANNOUNCED_KEY = 'meran_rest_announced'

/**
 * { count, held: [{ earnedOn, streak }], used: [{ earnedOn, usedOn }],
 *   toNext, every } — held oldest first, used newest first.
 */
export function restDaysView(recovery) {
  const held = []
  const used = []
  for (const r of recovery?.ledger || []) {
    if (!r.inRun) continue
    if (r.earned) held.push({ earnedOn: r.date, streak: r.streak ?? 0 })
    if (r.spent) {
      const first = held.shift()
      used.push({ earnedOn: first?.earnedOn ?? null, usedOn: r.date })
    }
  }
  return {
    count: held.length,
    held,
    used: used.reverse(),
    toNext: recovery?.daysToNextCredit ?? REST_CREDIT_EVERY,
    every: REST_CREDIT_EVERY,
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

const when = (iso, today) => (iso === today ? 'اليوم' : fmtDayAr(iso))

/**
 * The words for the block at the top of «ليش N؟».
 *   title   «أيام الراحة الاختيارية: 2»
 *   lead    what that means for a missed workout day
 *   held    one line per rest day held, oldest first
 *   keep    how long they last (they don't run out)
 *   next    when the next one comes
 *   used    the last few that covered a day, newest first
 */
export function restDaysCopy(rv, today) {
  const n = rv?.count || 0
  return {
    count: n,
    title: `أيام الراحة الاختيارية: ${n}`,
    lead: n > 0
      ? `عندك ${restDaysAr(n)}. لو فاتك يوم تمرين ينصرف واحد لحاله الساعة 3 الفجر، والستريك يوقف وما ينكسر.`
      : 'ما عندك ولا يوم راحة اختياري الحين — لو فاتك يوم تمرين يرجع الستريك صفر.',
    held: (rv?.held || []).map(h => ({
      date: h.earnedOn,
      text: `كسبته ${when(h.earnedOn, today)} لما وصل ستريكك ${h.streak}`,
    })),
    keep: n > 0 ? (n === 1 ? 'ما ينتهي — يبقى لك لين يفوتك يوم تمرين.' : 'ما تنتهي — تبقى لك لين يفوتك يوم تمرين.') : '',
    next: rv?.toNext === 1 ? 'الجاي بعد يوم واحد محسوب' : `الجاي بعد ${countAr(rv?.toNext ?? REST_CREDIT_EVERY, 'day')} محسوبة`,
    every: `كل ${rv?.every ?? REST_CREDIT_EVERY} أيام محسوبة تعطيك يوم راحة اختياري (هي نفسها «التذاكر»).`,
    used: (rv?.used || []).slice(0, 3).map(u => ({
      date: u.usedOn,
      text: u.earnedOn
        ? `استخدمته ${when(u.usedOn, today)} — كان من ${fmtDayAr(u.earnedOn, { weekday: false })}`
        : `استخدمته ${when(u.usedOn, today)}`,
    })),
  }
}

/** The announcement's words, for the rest days just earned. */
export function earnedCopy(days = [], count = 0) {
  const k = days.length
  const last = days[k - 1]
  return {
    title: k > 1 ? `كسبت ${countAr(k, 'restday')}` : 'كسبت يوم راحة',
    line: last ? `وصل ستريكك ${last.streak} — كل ${REST_CREDIT_EVERY} أيام محسوبة تعطيك يوم.` : '',
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
