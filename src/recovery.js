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

// ── Optional rest days: the rules, by the day they apply to ──────
//
// حمزة: «ابا نظام الراحة الاختيارية يكون اسهل بس يلتزم بالحد الاقصى».
// Until 20 October 2026 one optional rest day came every 5 counted days
// and the balance had no real ceiling (MAX_REST_CREDITS only capped the
// number drawn). From 21 October one comes every 3 counted days, and he
// can never hold more than 5.
//
// The rules are DATED, not switched in place. Everything here is
// replayed from the history on every render, so changing 5 to 3 (or
// making the cap real) for all days would re-judge every day he ever
// trained: rest days earned in August, misses they covered, streaks that
// broke — all of it would move. Each day is judged by the rules in force
// on that day instead, exactly as patternForDay does for the plan.
//
// Why a date in the code and not a field written to hf_recovery the
// first time the new rules run (like autoSpendFrom): a constant keeps
// the engine a pure function of the history. Nothing has to be written
// before the numbers are right (no first frame on the old rules and a
// flip a moment later, no second announcement), the old design — which
// also writes hf_recovery — cannot lose it, a backup restored on another
// phone replays the same, and tests can pin it. 21 October is the day
// this ships, so no day he has already seen is judged by the new rules.
//
// At the switch (the first day of a run on or after the date):
//   · a balance above the cap is trimmed to it — written on that day's
//     ledger row as `trimmed`, and the oldest ones held go first;
//   · counted days already made toward the next one carry over, now
//     toward 3: with 3 or 4 of 5 done, one is earned that morning and
//     the rest carry (4 of 5 → earned + 1 of 3);
//   · at the cap, counted days still count for the streak but build no
//     progress — the bar is empty and earning starts again after one is
//     used. (Filling the bar and waiting would hand the next rest day
//     back the moment one was used: a sixth in all but name.)
export const REST_RULES_V2_FROM = '2026-10-21'
export const REST_RULES_V1 = Object.freeze({ every: 5, cap: null })
export const REST_RULES_V2 = Object.freeze({ every: 3, cap: 5 })
/** The rules in force on a day: { every, cap } (cap null = no ceiling). */
export const restRulesOn = (day) => (day && day >= REST_RULES_V2_FROM ? REST_RULES_V2 : REST_RULES_V1)

export const REST_CREDIT_EVERY = REST_RULES_V2.every   // the rule today
export const MAX_REST_CREDITS  = 5                     // the cap from 21 Oct; before it, only a display clamp

// You start on zero and earn one rest day for every `every` *eligible*
// days. There is deliberately no `creditsEarnedFor(streak)` shortcut: the
// streak and the eligible-day count are not the same number once a paid
// rest day is in play, and the rule changed on a date, so the reward is
// replayed day by day in computeRecovery instead of divided out of the
// streak.
//
// One run's balance, stepped a day at a time. Both walks in
// computeRecovery use these, so the walk that decides whether a miss is
// covered and the ledger that shows it can never disagree.
const freshCredits = () => ({ earned: 0, spent: 0, trimmed: 0, progress: 0, v2: false })
const balanceOf = (c) => c.earned - c.spent - c.trimmed

// The morning the v2 rules take over this run: { earned, trimmed } that day.
function switchRules(c, rules) {
  c.v2 = true
  let bal = balanceOf(c), earned = 0, trimmed = 0
  if (bal > rules.cap) { trimmed = bal - rules.cap; c.trimmed += trimmed; bal = rules.cap }
  while (c.progress >= rules.every && bal < rules.cap) { c.earned++; earned++; c.progress -= rules.every; bal++ }
  if (bal >= rules.cap) c.progress = 0
  return { earned, trimmed }
}

// A counted day: 1 when it completes a rest day, else 0.
function countDay(c, rules) {
  if (rules.cap != null && balanceOf(c) >= rules.cap) { c.progress = 0; return 0 }
  c.progress++
  if (c.progress >= rules.every) { c.earned++; c.progress = 0; return 1 }
  return 0
}

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

  // The rest-day rules today. creditCap, atCap and creditsTrimmed exist
  // only from the day the v2 rules apply, so on any day before it this
  // returns exactly what the engine returned before them
  // (tests/rest-rules.test.mjs compares the two).
  const rulesToday = restRulesOn(today)
  const capFields = (atCap, creditsTrimmed) => (rulesToday.cap != null
    ? { creditCap: rulesToday.cap, atCap, creditsTrimmed } : {})

  // No history yet — start training today, cycle begins fresh.
  if (!sortedDates.length) {
    return {
      status: didWorkoutToday ? DAY_STATUS.COMPLETED : DAY_STATUS.WORKOUT,
      pattern, cyclePosition: 0, cycleLimit: pattern[0],
      consecutiveWorkoutDays: 0, workoutStreak: 0, consistencyStreak: 0,
      restCredits: 0, usableCredits: 0, spentInStreak: 0, creditsEarned: 0, creditsSpent: 0,
      eligibleDays: 0, streakStart: null, ledger: [],
      tomorrowExpected: DAY_STATUS.WORKOUT, workoutsBeforeRest: pattern[0],
      runs: [], bestRun: null, lastBreak: null,
      creditProgress: 0, creditTarget: rulesToday.every, daysToNextCredit: rulesToday.every,
      ...capFields(false, 0),
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

  // What tomorrow is, if today goes the way the plan says: a workout day
  // is trained (that is the only way it counts), a rest day is rested.
  // Training on a rest day already happened if it did, and pushes the
  // rest to tomorrow exactly as the walk above would. Every «بكرة …»
  // line reads this rather than assuming a pattern.
  let tomorrowExpected, workoutsBeforeRest
  {
    const restsToday = !todayEntry.trained && todayEntry.expected === DAY_STATUS.RECOVERY
    const c = restsToday ? 0 : consecutive + 1
    const p = restsToday ? position + 1 : position
    const tPattern = patternForDay(config, addDays(today, 1))
    const tLimit = tPattern[p % tPattern.length]
    tomorrowExpected   = c >= tLimit ? DAY_STATUS.RECOVERY : DAY_STATUS.WORKOUT
    workoutsBeforeRest = Math.max(0, tLimit - c)
  }

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

  // Where the current streak begins, and which missed days the balance
  // absorbs on its own.
  //
  // This has to be walked FORWARDS. Whether a missed day breaks the run
  // depends on what had been earned by the time that day arrived, and
  // that is only knowable in order. Scanning backwards for the last miss
  // — which is what this used to do — cut the run at every miss whether
  // or not there was a credit sitting there to cover it. One skipped
  // workout therefore read as: streak zero, balance zero, everything
  // before it gone. The true numbers were then restored from outside by
  // a side effect that wrote a rest day into storage, so the collapsed
  // state was what the app showed until that write landed — and what it
  // kept showing if the write never happened.
  //
  // A credit is spent here, the moment it is needed. Storage records the
  // decision afterwards; it no longer makes it.
  const autoPaid = new Set()
  // Misses that actually ended a run, with the length lost. Only the
  // first miss after a run breaks anything; the days after it had no
  // streak left to lose, and calling each of them «كسر» showed one
  // break as six.
  const brokeOn = new Map()
  // Every run that ended, oldest first: { start, end, length, endedBy,
  // breakDay }. endedBy is 'miss' (a workout day with nothing to pay for
  // it), 'settings' (a second plan change inside 30 days) or
  // 'windowEdge' (a break manufactured by the 400-day replay cap, never
  // shown as a miss). Replayed from history like everything else here.
  const runs = []
  const capped = sortedDates.length && dayDiff(sortedDates[0], today) > 400
  let startIdx = 0
  {
    let c = freshCredits(), runLen = 0, runStart = null
    const endRun = (i, endedBy) => {
      if (runLen > 0) {
        runs.push({
          start: runStart, end: i > 0 ? dayLog[i - 1].date : runStart, length: runLen,
          endedBy: capped && i < 14 && endedBy === 'miss' ? 'windowEdge' : endedBy,
          breakDay: dayLog[i].date,
        })
      }
    }
    // The run restarts, but days already bought stay bought: they were
    // paid for out of a balance that really existed at the time. Wiping
    // them here would reclassify a settled day as a miss the moment a
    // later, unrelated break came along.
    const restart = (i) => { startIdx = i + 1; c = freshCredits(); runLen = 0; runStart = null }
    for (let i = 0; i < dayLog.length; i++) {
      const e = dayLog[i]
      // A settings change made over quota deliberately ends the streak;
      // the reset day itself does not count, so the streak reads 0
      // straight away and builds again from the next day.
      if (resetAt && e.date <= resetAt) { restart(i); continue }
      const rules = restRulesOn(e.date)
      // The new rules take over this run in the morning, before the day
      // itself is judged: a rest day the carry-over earns can cover it.
      if (rules.cap != null && !c.v2) switchRules(c, rules)
      const kind = kindOf(e)
      // Today can never be a miss — it is still unfolding.
      if (kind === 'miss' && e.date !== today) {
        if (balanceOf(c) >= 1) { c.spent++; autoPaid.add(e.date) }
        else { if (runLen > 0) brokeOn.set(e.date, runLen); endRun(i, 'miss'); restart(i) }
      } else if (kind === 'paid') {
        c.spent++
      } else {
        if (runLen === 0) runStart = e.date
        runLen++
        countDay(c, rules)
      }
    }
  }

  // A missed day the balance covered is a rest day that was bought, and
  // every reader downstream should see it as one.
  const effectiveKind = (e) => {
    const k = kindOf(e)
    return k === 'miss' && autoPaid.has(e.date) ? 'paid' : k
  }

  // ── Rest-day ledger ────────────────────────────────────────
  // Replayed forward, one day at a time, from the real history. Three
  // separate facts come out of this walk and the UI shows them apart:
  //
  //   consistencyStreak — how many eligible days are in the current run
  //   creditProgress    — eligible days since the *last reward*, 0…every−1
  //                       (0 while at the cap)
  //   restCredits       — rewards earned in this run minus rewards spent
  //                       (minus any the cap trimmed at the switch)
  //
  // Derived, never accumulated: nothing is stored, so a deploy, a code
  // change or a reinstall cannot move any of these numbers. The same
  // history always replays to the same ledger.
  let consistencyStreak = 0   // eligible days in the run
  const credits = freshCredits()  // earned, spent, trimmed and progress in the run
  let streakStart       = null

  // A transcript of the walk, so the numbers on screen can be audited
  // against the days that produced them. Written by the same pass that
  // decides them — never recomputed elsewhere, or it could agree with
  // itself while both were wrong.
  const ledger = []

  for (let i = 0; i < dayLog.length; i++) {
    const e = dayLog[i]
    const kind = effectiveKind(e)
    const inRun = i >= startIdx
    const row = {
      date: e.date,
      scheduled: e.expected === DAY_STATUS.RECOVERY ? 'rest' : 'workout',
      completed: e.trained,
      inRestDays: e.logged,
      kind,
      inRun,
      pending: e.date === today && kind === 'miss',
      broke: brokeOn.get(e.date) || 0,   // run length this miss ended, if any
      streakDelta: 0, earned: 0, spent: 0,
      streak: null, progress: null, balance: null,
    }

    const rules = restRulesOn(e.date)
    if (inRun && rules.cap != null && !credits.v2) {
      // The morning the new rules took over this run (see switchRules).
      const sw = switchRules(credits, rules)
      row.earned += sw.earned
      if (sw.trimmed) row.trimmed = sw.trimmed   // written down, never silent
    }

    if (inRun && kind !== 'miss') {
      if (streakStart === null) streakStart = e.date
      if (kind === 'paid') {
        credits.spent++
        row.spent = 1
      } else {
        consistencyStreak++
        row.streakDelta = 1
        row.earned += countDay(credits, rules)
      }
    }

    if (inRun) {
      row.streak   = consistencyStreak
      row.progress = credits.progress
      // The real balance on that day — the one a miss was charged against.
      row.balance  = Math.max(0, balanceOf(credits))
    }
    ledger.push(row)
  }

  const creditProgress = credits.progress
  const creditsEarned  = credits.earned
  const spentInStreak  = credits.spent
  const daysToNextCredit = rulesToday.every - creditProgress
  const restCredits = Math.max(0, Math.min(MAX_REST_CREDITS, balanceOf(credits)))
  // What a miss is actually charged against. Before 21 October the walk
  // above spent from earned − spent with no ceiling, so MAX_REST_CREDITS
  // only ever capped the number on screen: someone holding 8 saw 5, and
  // the 5 stayed put through three spends. From 21 October the cap is
  // real (restRulesOn), so the two agree. Every surface that tells the
  // user what a miss costs reads this one.
  const usableCredits = Math.max(0, balanceOf(credits))
  const atCap = rulesToday.cap != null && balanceOf(credits) >= rulesToday.cap

  const past = dayLog.filter(e => e.date !== today)
  const recoveryDayHistory = past.filter(e => !e.trained && e.expected === DAY_STATUS.RECOVERY).map(e => e.date)
  // Only days actually bought with a credit; a tap on a scheduled recovery
  // day belongs to recoveryDayHistory above, not here.
  const restTakenHistory   = past.filter(e => effectiveKind(e) === 'paid').map(e => e.date)
  // A workout day that was neither trained nor logged as rest: this is
  // what breaks the consistency streak, and what the UI offers to fix.
  // Only the misses nothing could pay for: these are what actually break
  // the streak. Days the balance absorbed are in autoPaidDays instead.
  const missedDays = past.filter(e => effectiveKind(e) === 'miss').map(e => e.date)
  const brokenBy   = missedDays.length ? missedDays[missedDays.length - 1] : null
  const lastRest = [...recoveryDayHistory, ...restTakenHistory].sort().pop() || null
  const lastWorkout = sortedDates[sortedDates.length - 1]

  // A plan reset voids every day up to it, so the run it ended (and any
  // before) cannot come out of this walk. Replay once without the reset,
  // up to the day before it, and put those runs first.
  if (resetAt && resetAt <= today) {
    const before = computeRecovery(sessions, { ...config, streakResetAt: null }, addDays(resetAt, -1))
    const head = [...(before.runs || [])]
    if (before.consistencyStreak > 0) {
      head.push({ start: before.streakStart, end: addDays(resetAt, -1), length: before.consistencyStreak, endedBy: 'settings', breakDay: resetAt })
    }
    runs.unshift(...head)
  }
  const lastBreak = [...runs].reverse().find(r => r.endedBy === 'miss') || null
  // The longest run the replay can see, the current one included. The
  // app also keeps a stored high-water mark (hf_streak_best) so a record
  // survives the 400-day replay window.
  const bestRun =[...runs.filter(r => r.endedBy !== 'windowEdge'), { length: consistencyStreak, start: streakStart, end: today, current: true }]
    .reduce((a, r) => (r.length > (a?.length || 0) ? r : a), null)

  return {
    runs,
    bestRun,
    lastBreak,
    restCredits,
    usableCredits,
    tomorrowExpected,
    workoutsBeforeRest,
    spentInStreak,
    creditProgress,
    creditTarget: rulesToday.every,    // counted days per rest day, by today's rules
    daysToNextCredit,                  // meaningless while atCap: nothing builds then
    // From 21 Oct: the cap (5), whether he is at it, and how many the
    // switch trimmed off this run's balance. Absent before.
    ...capFields(atCap, credits.trimmed),
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
    // Days a credit covered on its own. App persists these into
    // restDays so the decision is auditable — it does not make it.
    autoPaidDays: [...autoPaid].sort(),
    streakStart,       // first day of the running consistency streak
    brokenBy,          // most recent day that broke the streak, if any
    loggedRestToday: loggedRest.has(today),
    dayLog,
    isOverride,
  }
}
