// ── Dynamic recovery engine ───────────────────────────────────
// Rest days are NOT tied to weekday names. Whether today is a
// training day or a recovery day is derived entirely from the
// workouts the user actually completed, their chosen weekly
// frequency, and the recovery cycle that frequency implies.
//
// This engine never touches the plan sequence: if the last completed
// workout was Push, the next one is Pull no matter how many days pass.

import { dayKey, todayKey } from './day.js'

const DAY = 86400000
// Anchor at midday UTC so DST shifts can never move a date by a day.
const stamp = (iso) => Date.parse(`${iso}T12:00:00Z`)
export const dayDiff = (fromISO, toISO) => Math.round((stamp(toISO) - stamp(fromISO)) / DAY)
export const addDays = (iso, n) => new Date(stamp(iso) + n * DAY).toISOString().split('T')[0]
export const dateKey = dayKey

// How many consecutive workouts before each recovery day. Treated as a
// rolling cycle, not a fixed Saturday-to-Friday week.
export const TRAINING_FREQUENCIES = [
  { id: 3, label: '٣ أيام', pattern: [1],    desc: 'تمرين ثم يوم راحة' },
  { id: 4, label: '٤ أيام', pattern: [2],    desc: 'تمرينان ثم يوم راحة' },
  { id: 5, label: '٥ أيام', pattern: [3, 2], desc: '٣ تمارين · راحة · تمرينان · راحة' },
  { id: 6, label: '٦ أيام', pattern: [3, 3], desc: '٣ تمارين · راحة · ٣ تمارين · راحة' },
]

export const DEFAULT_RECOVERY = {
  daysPerWeek: 5, customPattern: [3, 2], overrides: [], restDays: [],
  // Optional rest days are a reward: one is earned for every
  // REST_CREDIT_EVERY days of consistency, and spending one protects
  // the streak on a day off the cycle had not yet earned.
  restCredits: 1, creditMilestone: 0,
}

export const REST_CREDIT_EVERY = 5
export const MAX_REST_CREDITS  = 5

// How many credits the streak has earned in total, and what is owed now.
export const creditsEarnedFor = (consistencyStreak = 0) =>
  Math.floor(consistencyStreak / REST_CREDIT_EVERY)

export const patternFor = (config = {}) => {
  const { daysPerWeek, customPattern } = config
  if (daysPerWeek === 'custom') {
    const p = (customPattern || []).map(n => Math.max(1, Math.round(n))).filter(Boolean)
    return p.length ? p : [2]
  }
  return TRAINING_FREQUENCIES.find(f => f.id === daysPerWeek)?.pattern
    || TRAINING_FREQUENCIES.find(f => f.id === 5).pattern
}

// Day classifications used across the app
export const DAY_STATUS = {
  WORKOUT:   'workout',    // today you train
  RECOVERY:  'recovery',   // the engine scheduled rest
  REST_TAKEN:'rest_taken', // a day off the user took on their own
  COMPLETED: 'completed',  // already trained today
}

/**
 * Replays the user's real workout history day by day to work out where
 * they are in their recovery cycle and what today should be.
 */
export function computeRecovery(sessions = [], config = {}, today = todayKey()) {
  const pattern   = patternFor(config)
  const overrides = new Set(config.overrides || [])
  // Days the user deliberately logged as rest. They count as keeping to
  // the plan — an unplanned day off used to wipe the consistency streak.
  const loggedRest = new Set(config.restDays || [])
  const workoutDates = new Set((sessions || []).map(s => dateKey(s.date)).filter(Boolean))

  const sortedDates = [...workoutDates].sort()
  const didWorkoutToday = workoutDates.has(today)

  // No history yet — start training today, cycle begins fresh.
  if (!sortedDates.length) {
    return {
      status: didWorkoutToday ? DAY_STATUS.COMPLETED : DAY_STATUS.WORKOUT,
      pattern, cyclePosition: 0, cycleLimit: pattern[0],
      consecutiveWorkoutDays: 0, workoutStreak: 0, consistencyStreak: 0,
      daysSinceLastWorkout: null, daysSinceLastRest: null,
      recoveryDayHistory: [], restTakenHistory: [], dayLog: [],
      isOverride: false,
    }
  }

  // Bound the replay; a year of history is far more than enough.
  let cursor = sortedDates[0]
  if (dayDiff(cursor, today) > 400) cursor = addDays(today, -400)

  let consecutive = 0
  let position    = 0
  const dayLog = []

  for (; dayDiff(cursor, today) >= 0; cursor = addDays(cursor, 1)) {
    const limit    = pattern[position % pattern.length]
    const expected = consecutive >= limit ? DAY_STATUS.RECOVERY : DAY_STATUS.WORKOUT
    const trained  = workoutDates.has(cursor)
    const logged = loggedRest.has(cursor)
    dayLog.push({ date: cursor, expected, trained, logged, override: trained && expected === DAY_STATUS.RECOVERY })

    if (cursor === today) break // today is still unfolding — don't advance past it

    if (trained) {
      consecutive += 1
    } else if (expected === DAY_STATUS.RECOVERY || logged) {
      position = (position + 1) % pattern.length   // rest that was planned or logged
      consecutive = 0
    } else {
      position = 0                                  // unplanned break → fresh cycle
      consecutive = 0
    }
  }

  const todayEntry  = dayLog[dayLog.length - 1]
  const cycleLimit  = pattern[position % pattern.length]
  const isOverride  = overrides.has(today)

  let status
  if (didWorkoutToday)                                status = DAY_STATUS.COMPLETED
  else if (isOverride)                                status = DAY_STATUS.WORKOUT
  else if (loggedRest.has(today))                     status = DAY_STATUS.REST_TAKEN
  else                                                status = todayEntry.expected

  // ── Streaks ────────────────────────────────────────────────
  // Actual back-to-back training days; a rest day resets it.
  const workoutStreak = consecutive + (didWorkoutToday ? 1 : 0)

  // Days the user did what the engine asked. A recovery day taken as
  // rest counts as a win and never breaks the streak.
  let consistencyStreak = 0
  for (let i = dayLog.length - 1; i >= 0; i--) {
    const e = dayLog[i]
    if (e.date === today) {
      if (e.trained || e.logged || e.expected === DAY_STATUS.RECOVERY) consistencyStreak++
      continue // a pending workout today neither counts nor breaks
    }
    const complied = e.trained || e.logged || e.expected === DAY_STATUS.RECOVERY
    if (!complied) break
    consistencyStreak++
  }

  const past = dayLog.filter(e => e.date !== today)
  const recoveryDayHistory = past.filter(e => !e.trained && e.expected === DAY_STATUS.RECOVERY).map(e => e.date)
  const restTakenHistory   = past.filter(e => !e.trained && e.logged).map(e => e.date)
  // A workout day that was neither trained nor logged as rest: this is
  // what breaks the consistency streak, and what the UI offers to fix.
  const missedDays = past.filter(e => !e.trained && !e.logged && e.expected === DAY_STATUS.WORKOUT).map(e => e.date)
  const brokenBy   = missedDays.length ? missedDays[missedDays.length - 1] : null
  const lastRest = [...recoveryDayHistory, ...restTakenHistory].sort().pop() || null
  const lastWorkout = sortedDates[sortedDates.length - 1]

  return {
    status,
    pattern,
    cyclePosition: position % pattern.length,
    cycleLimit,
    consecutiveWorkoutDays: workoutStreak,
    workoutStreak,
    consistencyStreak,
    daysSinceLastWorkout: dayDiff(lastWorkout, today),
    daysSinceLastRest: lastRest ? dayDiff(lastRest, today) : null,
    recoveryDayHistory,
    restTakenHistory,
    missedDays,
    brokenBy,          // most recent day that broke the streak, if any
    loggedRestToday: loggedRest.has(today),
    dayLog,
    isOverride,
  }
}
