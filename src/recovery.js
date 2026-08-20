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
  autoSpendFrom: null,
  // Which pattern was in force on which day, oldest first. Without it a
  // change of weekly frequency re-judges every day the user ever trained
  // and can wipe a perfect streak. Absent (existing users) is read as a
  // single segment covering all of history, so upgrading changes nothing.
  patternHistory: [],
  lastSettingsChangeAt: null,  // anchors the 30-day free-change window
  streakResetAt: null,         // consistency is not counted before this day

  // ── Deload ──
  // Lives here rather than in a key of its own because hf_recovery is
  // the only derived-state key the backup export carries; a separate
  // key would mean a deload that vanishes on restore. Null and an empty
  // array read as "never had one", so existing users need no migration.
  deload: null,                    // { from, plannedUntil, pct } while running
  deloadHistory: [],               // [{ from, plannedUntil, until, pct, endedEarly }]
  deloadSuggestDismissedAt: null,  // silences the suggestion for a while
}

// One free change of frequency or plan per this many days.
export const SETTINGS_CHANGE_COOLDOWN = 30

// Days still to wait for a free change; 0 means it is free now.
export const changeCooldownLeft = (config = {}, today = todayKey()) => {
  const last = config.lastSettingsChangeAt
  if (!last) return 0
  return Math.max(0, SETTINGS_CHANGE_COOLDOWN - dayDiff(last, today))
}

export const REST_CREDIT_EVERY = 5
export const MAX_REST_CREDITS  = 5

// You start on zero and earn one rest day for every REST_CREDIT_EVERY
// *eligible* days. There is deliberately no `creditsEarnedFor(streak)`
// shortcut: the streak and the eligible-day count are not the same number
// once a paid rest day is in play, so the reward is replayed day by day in
// computeRecovery instead of divided out of the streak.

export const patternFor = (config = {}) => {
  const { daysPerWeek, customPattern } = config
  if (daysPerWeek === 'custom') {
    const p = (customPattern || []).map(n => Math.max(1, Math.round(n))).filter(Boolean)
    return p.length ? p : [2]
  }
  return TRAINING_FREQUENCIES.find(f => f.id === daysPerWeek)?.pattern
    || TRAINING_FREQUENCIES.find(f => f.id === 5).pattern
}

// The pattern in force on a given day. Segments are { from, daysPerWeek,
// customPattern } ordered oldest first; the last one starting on or before
// the day wins. With no history the current config covers everything.
export const patternForDay = (config = {}, day) => {
  const hist = config.patternHistory
  if (!Array.isArray(hist) || !hist.length) return patternFor(config)
  let chosen = null
  for (const seg of hist) {
    if (!seg || !seg.from || seg.from > day) continue
    if (!chosen || seg.from >= chosen.from) chosen = seg
  }
  return chosen ? patternFor(chosen) : patternFor(hist[0])
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
      restCredits: 0, spentInStreak: 0, creditsEarned: 0, creditsSpent: 0,
      eligibleDays: 0, streakStart: null, ledger: [],
      creditProgress: 0, creditTarget: REST_CREDIT_EVERY, daysToNextCredit: REST_CREDIT_EVERY,
      missedDays: [], brokenBy: null, loggedRestToday: false,
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
    // Each day is judged by the pattern that was actually in force then,
    // so changing the frequency never rewrites the past.
    const dayPattern = patternForDay(config, cursor)
    const limit    = dayPattern[position % dayPattern.length]
    const expected = consecutive >= limit ? DAY_STATUS.RECOVERY : DAY_STATUS.WORKOUT
    const trained  = workoutDates.has(cursor)
    const logged = loggedRest.has(cursor)
    dayLog.push({ date: cursor, expected, trained, logged, override: trained && expected === DAY_STATUS.RECOVERY })

    if (cursor === today) break // today is still unfolding — don't advance past it

    if (trained) {
      consecutive += 1
    } else if (expected === DAY_STATUS.RECOVERY) {
      position = (position + 1) % dayPattern.length // the cycle's own rest day
      consecutive = 0
    } else if (logged) {
      // A rest day paid for with an earned credit is frozen out of the
      // plan entirely: the cycle does not advance and the run of
      // workouts is not reset, so tomorrow carries on from yesterday.
    } else {
      position = 0                                  // unplanned break → fresh cycle
      consecutive = 0
    }
  }

  const todayEntry  = dayLog[dayLog.length - 1]
  const cycleLimit  = pattern[position % pattern.length]
  const isOverride  = overrides.has(today)

  let status
  if (didWorkoutToday)                                       status = DAY_STATUS.COMPLETED
  else if (isOverride)                                       status = DAY_STATUS.WORKOUT
  // Only call it an optional rest if the plan actually wanted a workout.
  // On a scheduled recovery day the tap changes nothing and costs nothing,
  // so the card should still read as the cycle's own rest.
  else if (loggedRest.has(today) &&
           todayEntry.expected === DAY_STATUS.WORKOUT)       status = DAY_STATUS.REST_TAKEN
  else                                                       status = todayEntry.expected

  // ── Streaks ────────────────────────────────────────────────
  // Actual back-to-back training days; a rest day resets it.
  const workoutStreak = consecutive + (didWorkoutToday ? 1 : 0)

  const resetAt = config.streakResetAt || null

  // Every day falls into exactly one of three kinds, and the reward only
  // ever reads this classification — never the raw `restDays` list.
  //
  //   eligible — you did what the plan asked: you trained, or the plan
  //              itself scheduled the day as recovery. Free either way,
  //              and the only kind that moves you toward a reward.
  //   paid     — a workout day you chose to skip and paid for out of the
  //              balance. Holds the streak, earns nothing, costs one.
  //   miss     — a workout day skipped with nothing to pay for it. Ends
  //              the streak.
  //
  // A "خذ راحة" tap on a day that was already scheduled recovery, or on a
  // day that was actually trained, is not a purchase: the plan gave that
  // day away for free, so it stays eligible and nothing is charged.
  const kindOf = (e) => {
    if (e.trained || e.expected === DAY_STATUS.RECOVERY) return 'eligible'
    return e.logged ? 'paid' : 'miss'
  }

  // Where the current streak begins. A settings change made over quota
  // deliberately ends the streak; the reset day itself does not count, so
  // the streak reads 0 straight away and builds again from the next day.
  // Today can never be a miss — it is still unfolding.
  let startIdx = dayLog.length
  for (let i = dayLog.length - 1; i >= 0; i--) {
    const e = dayLog[i]
    if (resetAt && e.date <= resetAt) break
    if (e.date !== today && kindOf(e) === 'miss') break
    startIdx = i
  }

  // ── Rest-day ledger ────────────────────────────────────────
  // Replayed forward, one day at a time, from the real history. Three
  // separate facts come out of this walk and the UI shows them apart:
  //
  //   consistencyStreak — how many eligible days are in the current run
  //   creditProgress    — eligible days since the *last reward*, 0…4
  //   restCredits       — rewards earned in this run minus rewards spent
  //
  // Derived, never accumulated: nothing is stored, so a deploy, a code
  // change or a reinstall cannot move any of these numbers. The same
  // history always replays to the same ledger.
  let consistencyStreak = 0   // eligible days in the run
  let creditProgress    = 0   // eligible days since the last reward
  let creditsEarned     = 0   // rewards this run has produced
  let spentInStreak     = 0   // rewards this run has consumed
  let streakStart       = null

  // A transcript of the walk, so the numbers on screen can be audited
  // against the days that produced them. Written by the same pass that
  // decides them — never recomputed elsewhere, or it could agree with
  // itself while both were wrong.
  const ledger = []

  for (let i = 0; i < dayLog.length; i++) {
    const e = dayLog[i]
    const kind = kindOf(e)
    const inRun = i >= startIdx
    const row = {
      date: e.date,
      scheduled: e.expected === DAY_STATUS.RECOVERY ? 'rest' : 'workout',
      completed: e.trained,
      inRestDays: e.logged,
      kind,
      inRun,
      pending: e.date === today && kind === 'miss',
      streakDelta: 0, earned: 0, spent: 0,
      streak: null, progress: null, balance: null,
    }

    if (inRun && kind !== 'miss') {
      if (streakStart === null) streakStart = e.date
      if (kind === 'paid') {
        spentInStreak++
        row.spent = 1
      } else {
        consistencyStreak++
        creditProgress++
        row.streakDelta = 1
        if (creditProgress === REST_CREDIT_EVERY) { creditsEarned++; creditProgress = 0; row.earned = 1 }
      }
    }

    if (inRun) {
      row.streak   = consistencyStreak
      row.progress = creditProgress
      row.balance  = Math.max(0, Math.min(MAX_REST_CREDITS, creditsEarned - spentInStreak))
    }
    ledger.push(row)
  }

  const daysToNextCredit = REST_CREDIT_EVERY - creditProgress
  const restCredits = Math.max(0, Math.min(MAX_REST_CREDITS, creditsEarned - spentInStreak))

  const past = dayLog.filter(e => e.date !== today)
  const recoveryDayHistory = past.filter(e => !e.trained && e.expected === DAY_STATUS.RECOVERY).map(e => e.date)
  // Only days actually bought with a credit; a tap on a scheduled recovery
  // day belongs to recoveryDayHistory above, not here.
  const restTakenHistory   = past.filter(e => kindOf(e) === 'paid').map(e => e.date)
  // A workout day that was neither trained nor logged as rest: this is
  // what breaks the consistency streak, and what the UI offers to fix.
  const missedDays = past.filter(e => kindOf(e) === 'miss').map(e => e.date)
  const brokenBy   = missedDays.length ? missedDays[missedDays.length - 1] : null
  const lastRest = [...recoveryDayHistory, ...restTakenHistory].sort().pop() || null
  const lastWorkout = sortedDates[sortedDates.length - 1]

  return {
    restCredits,
    spentInStreak,
    creditProgress,
    creditTarget: REST_CREDIT_EVERY,
    daysToNextCredit,
    creditsEarned,
    creditsSpent: spentInStreak,       // same number, named to match creditsEarned
    eligibleDays: consistencyStreak,   // the same number, named for what it is
    ledger,
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
    streakStart,       // first day of the running consistency streak
    brokenBy,          // most recent day that broke the streak, if any
    loggedRestToday: loggedRest.has(today),
    dayLog,
    isOverride,
  }
}
