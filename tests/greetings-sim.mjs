// A month of Home's greeting, simulated on the real engines.
//
// Used by tests/greetings.test.mjs (no repeats, the streak a small
// minority), and handy for printing a month to read by eye.
//
// The athlete runs a PPL plan on the 4-days rhythm (two on, one off),
// trains every day the recovery engine asks for, follows the app when it
// says raise, and opens the app before training (14:00 unless the day
// says otherwise) and after it (21:30). Every number on the way —
// streak, rest days, raises, records, XP, the month goal — comes from the
// app's own modules; only the athlete's choices are scripted.
//
// Needs a localStorage on globalThis (the caller provides it).

import { computeRecovery, DAY_STATUS, addDays, DEFAULT_RECOVERY } from '../src/recovery.js'
import { analyzeProgression, effectiveRepTarget, DEFAULT_REP_TARGET } from '../src/progression.js'
import { greetingFacts, pickGreeting } from '../src/greetings.js'
import { deloadState } from '../src/deload.js'
import { substitutedName, roundToPlate, PLATE_STEP } from '../src/utils.js'
import { EXERCISE_ALTERNATIVES } from '../src/constants.js'

export const START_WEIGHTS = {
  'Bench Press': 80, 'Incline Bench Press': 60, 'Overhead Press': 45, 'Lateral Raise': 12, 'Triceps Pushdown': 30,
  'Lat Pulldown': 65, 'Barbell Row': 70, 'T-Bar Row': 50, 'Seated Cable Row': 60, 'Barbell Curl': 30, 'Hammer Curl': 16,
  'Barbell Squat': 100, 'Romanian Deadlift': 90, 'Leg Press': 180, 'Leg Extension': 55, 'Standing Calf Raise': 80,
}

export const pplPlan = () => ({
  planId: 'sim_ppl', planName: 'PPL', durationWeeks: 8,
  weeklySchedule: [
    { name: 'Push — صدر، أكتاف، ترايسبس', exercises: [
      { muscle: 'Chest', name: 'Bench Press', sets: 3 }, { muscle: 'Chest', name: 'Incline Bench Press', sets: 3 },
      { muscle: 'Shoulders', name: 'Overhead Press', sets: 3 }, { muscle: 'Shoulders', name: 'Lateral Raise', sets: 3 },
      { muscle: 'Triceps', name: 'Triceps Pushdown', sets: 3 },
    ] },
    { name: 'Pull — ظهر، بايسبس', exercises: [
      { muscle: 'Back', name: 'Lat Pulldown', sets: 3 }, { muscle: 'Back', name: 'Barbell Row', sets: 3 },
      { muscle: 'Back', name: 'Seated Cable Row', sets: 3 }, { muscle: 'Biceps', name: 'Barbell Curl', sets: 3 },
      { muscle: 'Biceps', name: 'Hammer Curl', sets: 3 },
    ] },
    { name: 'Legs — أرجل', exercises: [
      { muscle: 'Legs', name: 'Barbell Squat', sets: 3 }, { muscle: 'Legs', name: 'Romanian Deadlift', sets: 3 },
      { muscle: 'Legs', name: 'Leg Press', sets: 3 }, { muscle: 'Legs', name: 'Leg Extension', sets: 3 },
      { muscle: 'Legs', name: 'Standing Calf Raise', sets: 3 },
    ] },
  ],
})

const at = (day, hhmm) => {
  const [y, m, d] = day.split('-').map(Number)
  const [hh, mm] = hhmm.split(':').map(Number)
  // A time after midnight belongs to the training day before it (03:00 turn).
  const next = hh < 3 ? 1 : 0
  return new Date(y, m - 1, d + next, hh, mm, 0, 0)
}

/**
 * Runs the month. Options:
 *   start, days         first day and length of what is recorded
 *   history             days of regular training before `start`
 *   restTap(day, i, r)  → true to tap «خذ راحة» on a workout day
 *   miss(day, i, r)     → true to skip a workout day without a tap
 *   topOn               { exercise: n } the n-th time it is trained in the month,
 *                       every set reaches the top of the range (so the next
 *                       time, the engine says raise)
 *   noPostOpen          days he closes the app after the summary
 *   opens               { day: { early?: 'hh:mm', pre: 'hh:mm', train: 'hh:mm', post: 'hh:mm' } }
 *                       (`early`: an extra open before `pre`)
 *   swapOn              { day, dayIndex, from, to } a «خطتي» swap made that morning
 *   goals, reportSeenOn, xp
 * → { entries: [{ day, time, phase, ctx, text, id, event, streak }], memory }
 */
export function simulate({
  start = '2026-10-20', days = 30, history = 45, name = 'حمزة',
  restTap = () => false, miss = () => false, topOn = {}, noPostOpen = [], opens = {}, swapOn = null,
  goals = {}, reportSeenOn = null, xp: xp0 = 40000, xpAtStart = null, repTarget = DEFAULT_REP_TARGET,
  spendInHistory = (r) => (r.usableCredits || 0) >= 2,
} = {}) {
  const plan = pplPlan()
  let planIndex = 0
  let xp = xp0
  const weights = { ...START_WEIGHTS }
  const sessions = []
  let config = { ...DEFAULT_RECOVERY, daysPerWeek: 4, patternHistory: [], restDays: [], autoSpendFrom: addDays(start, -history) }
  let memory = null
  let reportSeen = {}
  const entries = []
  const mapping = {}

  const timesTrained = {}
  const train = (day, time, recording = true) => {
    const schedDay = plan.weeklySchedule[planIndex % plan.weeklySchedule.length]
    const exercises = schedDay.exercises.map((ex, j) => {
      const shown = substitutedName(ex.name, {}, EXERCISE_ALTERNATIVES)
      const a = analyzeProgression(sessions, shown, mapping, effectiveRepTarget(ex, repTarget))
      if (a.hint === 'raise' && a.workingWeight > 0) weights[shown] = roundToPlate(a.workingWeight + PLATE_STEP)
      const w = String(weights[shown] ?? 20)
      if (recording) timesTrained[shown] = (timesTrained[shown] || 0) + 1
      const reps = recording && topOn[shown] === timesTrained[shown] ? ['15', '15', '14'] : ['12', '12', '11']
      return { id: `${day}-${j}`, muscle: ex.muscle, name: shown, sets: reps.map(r => ({ weight: w, reps: r, done: true })) }
    })
    const when = at(day, time)
    sessions.unshift({ id: when.getTime(), date: when.toISOString(), duration: 60, exercises, planDayName: schedDay.name, planDayIndex: planIndex, planId: plan.planId })
    planIndex++
    xp += 50 + 10 * exercises.reduce((t, e) => t + e.sets.length, 0) + 60
  }

  const greet = (day, time, phase, event) => {
    const now = at(day, time)
    const recovery = computeRecovery(sessions, config, day)
    const facts = greetingFacts({
      sessions, plan, planIndex, subs: {}, mapping, repTarget, recovery, config,
      deload: deloadState(config, day), xp, active: null, today: day, now, goals, reportSeen,
    })
    const out = pickGreeting({ facts, memory, name })
    memory = out.memory
    entries.push({ day, time, phase, ctx: out.ctx, text: out.text, id: out.id, event,
                   streak: recovery.consistencyStreak, restDays: recovery.usableCredits })
  }

  for (let i = -history; i < days; i++) {
    const day = addDays(start, i)
    const recording = i >= 0
    if (i === 0 && xpAtStart != null) xp = xpAtStart
    if (swapOn && day === swapOn.day) {
      const ex = plan.weeklySchedule[swapOn.dayIndex].exercises.find(e => e.name === swapOn.from)
      if (ex) { ex.was = { name: ex.name, muscle: ex.muscle }; ex.name = swapOn.to }
    }
    if (reportSeenOn && day === reportSeenOn.day) reportSeen = { ...reportSeen, [reportSeenOn.month]: true }
    const r = computeRecovery(sessions, config, day)
    const o = opens[day] || {}
    const workout = r.status === DAY_STATUS.WORKOUT
    let event = workout ? 'train' : 'rest'
    if (workout && !recording && spendInHistory(r)) event = 'restTap'
    if (workout && recording && restTap(day, i, r)) event = 'restTap'
    else if (workout && recording && miss(day, i, r)) event = 'miss'

    if (event === 'restTap') config = { ...config, restDays: [...config.restDays, day] }
    if (!recording) {
      if (event === 'train') train(day, '18:00', false)
      continue
    }
    if (o.early) greet(day, o.early, 'pre', event)
    greet(day, o.pre || '14:00', 'pre', event)
    if (event === 'train') {
      train(day, o.train || '18:00')
      if (!noPostOpen.includes(day)) greet(day, o.post || '21:30', 'post', event)
    }
  }
  return { entries, memory, sessions, config, xp }
}

/** The entries one per (day, situation): what he actually saw, without
 *  the same line counted again for a second open the same day. */
export const shown = (entries) => {
  const seen = new Set()
  return entries.filter(e => {
    const k = `${e.day}|${e.ctx}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
