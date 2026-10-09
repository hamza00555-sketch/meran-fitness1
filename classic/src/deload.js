// ── Deload ────────────────────────────────────────────────────
// A dated stretch of lighter weights. Same movements, same sets, same
// reps — less load. It is active recovery, not time off: the plan still
// runs, missing a day still misses it, and the streak is not protected.
//
// The whole feature rests on one restraint: a deload changes what the
// app *suggests*, never what it *stored*. Nothing is backed up because
// nothing is overwritten, so when the stretch ends the old weights are
// simply there again.
//
// Pure: no React, no DOM, no storage. Dates are local `YYYY-MM-DD`
// strings throughout, compared lexicographically, never Date objects —
// the same contract recovery.js keeps, and the reason a session logged
// at 01:00 in UTC+3 lands on the right day.

import { dayKey, todayKey } from './day.js'
import { dayDiff, addDays } from './recovery.js'
import { roundToPlate, PLATE_STEP } from './utils.js'

export const DELOAD_DAYS = 7
export const DELOAD_PCT  = 40

// A deload is not a taper to nothing and not a rounding error.
export const MIN_PCT = 10
export const MAX_PCT = 60
export const MIN_DAYS = 3
export const MAX_DAYS = 21

// The suggestion needs a training history to have an opinion about,
// and it has to take no for an answer.
export const SUGGEST_AFTER_WEEKS   = 8
export const SUGGEST_COOLDOWN_DAYS = 14
export const SUGGEST_MIN_STALLED   = 2

/** The lighter weight a deload asks for. */
export function deloadWeight(kg, pct = DELOAD_PCT) {
  const w = parseFloat(kg)
  if (!(w > 0)) return kg
  const factor = 1 - clampPct(pct) / 100
  // Never below one plate: a suggestion of zero is not a suggestion.
  return Math.max(PLATE_STEP, roundToPlate(w * factor))
}

const clampPct  = (p) => Math.min(MAX_PCT, Math.max(MIN_PCT, Math.round(Number(p) || DELOAD_PCT)))
const clampDays = (d) => Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.round(Number(d) || DELOAD_DAYS)))

const INACTIVE = Object.freeze({
  active: false, lapsed: false,
  from: null, until: null, pct: 0,
  day: 0, totalDays: 0, daysLeft: 0,
})

/**
 * Where today sits in the stored deload.
 *
 * `lapsed` means a deload is still recorded but its last day has
 * passed — nobody was there to close it, usually because the app was
 * shut when the day turned. The caller finalises it; this only reports.
 */
export function deloadState(config = {}, today = todayKey()) {
  const d = config?.deload
  if (!d || !d.from || !d.plannedUntil) return INACTIVE

  const day = dayKey(today)
  if (day < d.from) return INACTIVE                       // scheduled, not started
  if (day > d.plannedUntil) return { ...INACTIVE, lapsed: true, from: d.from, until: d.plannedUntil, pct: d.pct }

  const totalDays = dayDiff(d.from, d.plannedUntil) + 1
  const dayNo = dayDiff(d.from, day) + 1
  return {
    active: true, lapsed: false,
    from: d.from, until: d.plannedUntil, pct: d.pct,
    day: dayNo,
    totalDays,
    daysLeft: totalDays - dayNo,
  }
}

/** Begin a deload today. */
export function startDeload(config = {}, today = todayKey(), { days = DELOAD_DAYS, pct = DELOAD_PCT } = {}) {
  const from = dayKey(today)
  const n = clampDays(days)
  return {
    ...config,
    deload: { from, plannedUntil: addDays(from, n - 1), pct: clampPct(pct) },
    // Starting one answers the question the suggestion was asking.
    deloadSuggestDismissedAt: null,
  }
}

/**
 * Close the current deload and file it.
 *
 * `plannedUntil` and `until` are both kept. Ending on day three of
 * seven must not leave the remaining four looking like deload days to
 * anything that reads the history later — the report draws its
 * calendar from `until`, and the difference is what says it was cut
 * short rather than run to term.
 */
export function endDeload(config = {}, today = todayKey()) {
  const d = config?.deload
  if (!d || !d.from) return config

  const day = dayKey(today)
  // Ending it today means today was its last day, which is also what
  // any session already started under it recorded.
  const until = day < d.plannedUntil ? day : d.plannedUntil
  const entry = {
    from: d.from,
    plannedUntil: d.plannedUntil,
    until,
    pct: d.pct,
    endedEarly: until < d.plannedUntil,
  }

  return {
    ...config,
    deload: null,
    deloadHistory: [...(config.deloadHistory || []), entry].slice(-40),
  }
}

/**
 * The stamp a session started right now should carry.
 *
 * Sessions record the deload they began under, not a bare flag: a
 * percentage and a range keep the entry readable even if the rules
 * change later, and reading history should never require knowing what
 * the settings happened to be at the time.
 *
 * Null when no deload is running — the caller stores nothing.
 */
export function sessionDeloadStamp(config = {}, today = todayKey()) {
  const s = deloadState(config, today)
  if (!s.active) return null
  return { pct: s.pct, from: s.from, until: s.until }
}

/**
 * Was this session performed under a deload?
 *
 * Answered from the session's own stamp and nothing else. The decision
 * is made once, when the session starts, and stays made — a stretch
 * that ends mid-workout does not retroactively make the weights on
 * screen count as normal training.
 */
export const isDeloadSession = (session) => !!session?.deload

/** Did this calendar day fall inside a deload, past or present? */
export function wasDeloadDay(config = {}, day) {
  const d = dayKey(day)
  const active = config?.deload
  if (active?.from && d >= active.from && d <= active.plannedUntil) return true
  for (const h of config?.deloadHistory || []) {
    if (h?.from && d >= h.from && d <= (h.until || h.plannedUntil)) return true
  }
  return false
}

/** Days since the last deload ended, or null if there has never been one. */
export function daysSinceLastDeload(config = {}, today = todayKey()) {
  const hist = config?.deloadHistory || []
  if (!hist.length) return null
  const last = hist.reduce((a, h) => ((h.until || h.plannedUntil) > (a.until || a.plannedUntil) ? h : a), hist[0])
  return dayDiff(last.until || last.plannedUntil, dayKey(today))
}

/** How many weeks of actual training history exist. */
export function weeksOfHistory(sessions = [], today = todayKey()) {
  if (!sessions.length) return 0
  let earliest = null
  for (const s of sessions) {
    const d = dayKey(s.date)
    if (!earliest || d < earliest) earliest = d
  }
  return Math.floor(dayDiff(earliest, dayKey(today)) / 7)
}

/**
 * Should the app raise a deload?
 *
 * Two conditions, and it takes both. Stalled lifts alone is a bad week;
 * time alone is just a calendar. Together they are the thing a deload
 * answers, and requiring both is what keeps this from nagging.
 *
 * `stalledCount` is passed in rather than computed here so this module
 * stays free of the progression engine — the caller already runs it.
 *
 * Returns a reason object or null. Never returns a reason for someone
 * whose history is too short to have earned one.
 */
export function suggestDeload({ sessions = [], config = {}, today = todayKey(), stalledCount = 0 } = {}) {
  const day = dayKey(today)

  // Already in one, or one is stored and waiting to be closed.
  if (config?.deload) return null

  // A new user has nothing to deload from. Weeks of real history, not
  // weeks since install.
  const weeks = weeksOfHistory(sessions, day)
  if (weeks < SUGGEST_AFTER_WEEKS) return null

  // Turning it down has to mean something for a while.
  const dismissed = config?.deloadSuggestDismissedAt
  if (dismissed && dayDiff(dismissed, day) < SUGGEST_COOLDOWN_DAYS) return null

  const since = daysSinceLastDeload(config, day)
  const longEnough = since === null ? true : since >= SUGGEST_AFTER_WEEKS * 7
  if (!longEnough) return null

  if (stalledCount < SUGGEST_MIN_STALLED) return null

  return {
    stalledCount,
    weeksOfHistory: weeks,
    daysSinceLastDeload: since,
    suggestedDays: DELOAD_DAYS,
    suggestedPct: DELOAD_PCT,
  }
}

/** Record that the suggestion was turned down today. */
export const dismissSuggestion = (config = {}, today = todayKey()) => ({
  ...config,
  deloadSuggestDismissedAt: dayKey(today),
})
