// Specs for the optional-rest-day reward, run against the real module.
//
//   node --test tests/recovery-credits.test.mjs
//
// The rules under test:
//   an eligible day is a workout you completed OR a rest day the plan
//   scheduled; five of them earn one optional rest day; an optional
//   rest day holds the streak but is frozen out of the count; and a
//   scheduled rest never spends a credit.

import test from 'node:test'
import assert from 'node:assert/strict'

const { computeRecovery, REST_CREDIT_EVERY } = await import('../src/recovery.js')

// 3 days a week is pattern [1]: train, rest, train, rest…  Every day is
// then either a workout or a scheduled recovery, which makes the
// eligible-day count easy to reason about.
const CFG = { daysPerWeek: 3, overrides: [], restDays: [] }

const day = (n) => `2026-03-${String(n).padStart(2, '0')}`
const workoutsOn = (...days) => days.map(n => ({
  id: n, date: `${day(n)}T10:00:00.000Z`, duration: 45,
  exercises: [{ name: 'Squat', sets: [{ weight: '60', reps: '12', done: true }] }],
}))

test('a perfect alternating fortnight counts every day as eligible', () => {
  // Trained on the odd days; the even days are the cycle's own rest.
  const r = computeRecovery(workoutsOn(1, 3, 5, 7, 9), CFG, day(10))
  assert.equal(r.consistencyStreak, 10, 'workouts and scheduled rests both count')
  assert.equal(r.creditTarget, REST_CREDIT_EVERY)
  assert.equal(r.creditProgress, 0)
  assert.equal(r.restCredits, 2, '10 eligible days = two rewards')
})

test('progress toward the next reward is reported separately', () => {
  const r = computeRecovery(workoutsOn(1, 3, 5), CFG, day(6))
  assert.equal(r.consistencyStreak, 6)
  assert.equal(r.creditProgress, 1, '6 % 5')
  assert.equal(r.daysToNextCredit, 4)
  assert.equal(r.restCredits, 1)
})

test('five eligible days earn exactly one rest day', () => {
  const r = computeRecovery(workoutsOn(1, 3, 5), CFG, day(5))
  assert.equal(r.consistencyStreak, 5)
  assert.equal(r.restCredits, 1)
  assert.equal(r.creditProgress, 0)
  assert.equal(r.daysToNextCredit, REST_CREDIT_EVERY)
})

test('a scheduled rest day does not spend a credit', () => {
  // Day 2 is the cycle's rest. It must not appear as a missed day, and
  // so can never be paid for out of the balance.
  const r = computeRecovery(workoutsOn(1, 3), CFG, day(4))
  assert.ok(!r.missedDays.includes(day(2)), 'scheduled rest is not a miss')
  assert.equal(r.spentInStreak, 0)
})

test('an optional rest day holds the streak without advancing the reward', () => {
  // Day 7 was a workout day, skipped, and paid for from the balance.
  // Freezing it means day 8 is still a workout day, so it is trained.
  const spent = { ...CFG, restDays: [day(7)] }
  const r = computeRecovery(workoutsOn(1, 3, 5, 8), spent, day(9))

  assert.deepEqual(r.missedDays, [], 'the paid day is not a miss')
  // Days 1-9 are nine days; the paid one is frozen out, leaving eight.
  assert.equal(r.consistencyStreak, 8, 'the paid day is not an eligible day')
  assert.equal(r.spentInStreak, 1)
})

test('spending a credit takes it out of the balance', () => {
  const spent = { ...CFG, restDays: [day(7)] }
  const r = computeRecovery(workoutsOn(1, 3, 5, 8), spent, day(9))
  assert.equal(r.creditsEarned, 1, '8 eligible days')
  assert.equal(r.restCredits, 0, 'earned one, spent one')
})

test('a missed day with no balance breaks the streak', () => {
  // Day 3 was a workout day, skipped, nothing logged, no history to
  // have earned a credit from.
  const r = computeRecovery(workoutsOn(1), CFG, day(4))
  assert.ok(r.missedDays.includes(day(3)), 'the skipped workout day is a miss')
  assert.equal(r.consistencyStreak, 0)
  assert.equal(r.restCredits, 0)
})

test('the balance is capped', () => {
  // A long clean run, well past five rewards' worth of eligible days.
  const base = Date.UTC(2026, 2, 1)
  const iso = (n) => new Date(base + n * 86400000).toISOString()
  const sessions = []
  for (let n = 0; n < 60; n += 2) {
    sessions.push({ id: n + 1, date: iso(n), exercises: [] })
  }
  const today = iso(59).slice(0, 10)
  const r = computeRecovery(sessions, CFG, today)
  assert.ok(r.creditsEarned > 5, `earned ${r.creditsEarned}`)
  assert.equal(r.restCredits, 5, 'capped at five')
})

test('an empty history reports a clean progress state', () => {
  const r = computeRecovery([], CFG, day(1))
  assert.equal(r.creditProgress, 0)
  assert.equal(r.creditTarget, REST_CREDIT_EVERY)
  assert.equal(r.daysToNextCredit, REST_CREDIT_EVERY)
  assert.equal(r.restCredits, 0)
})

test('progress and streak are genuinely different numbers', () => {
  // This is the reason the UI shows them apart: a streak of 6 is not
  // "6 of 5 toward a reward", it is one reward banked and one day in.
  const r = computeRecovery(workoutsOn(1, 3, 5), CFG, day(6))
  assert.notEqual(r.creditProgress, r.consistencyStreak)
  assert.equal(r.creditProgress, r.consistencyStreak % REST_CREDIT_EVERY)
})
