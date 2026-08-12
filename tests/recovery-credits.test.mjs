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
  assert.equal(r.creditProgress, 1)
})

// ══ users who arrive with history behind them ═════════════════
//
// Everything above starts the clock on day one. These do not: they hand
// the engine a run that was already going, which is where the reward bar
// actually went wrong.

// Trained every odd day for a fortnight and a bit. Day 16 is the cycle's
// own rest, so all sixteen days are eligible: 3 rewards, 1 day into the
// fourth.
const LONG_RUN = [1, 3, 5, 7, 9, 11, 13, 15]
const clean = (extra = {}) =>
  computeRecovery(workoutsOn(...LONG_RUN), { ...CFG, ...extra }, day(16))

test('a sixteen-day run reads three rewards and one day into the next', () => {
  const r = clean()
  assert.equal(r.consistencyStreak, 16)
  assert.equal(r.creditsEarned, 3)
  assert.equal(r.spentInStreak, 0)
  assert.equal(r.restCredits, 3)
  assert.equal(r.creditProgress, 1)
  assert.equal(r.daysToNextCredit, 4)
})

test('tapping rest on a day the plan already gave off changes nothing', () => {
  // The bug behind "باقي لك 5 أيام": day 2 was scheduled recovery, so it
  // was free. Charging for it knocked a day off the streak (16 → 15) and
  // a reward off the balance, and 15 % 5 lands the bar back on 0/5.
  const r = clean({ restDays: [day(2)] })
  assert.equal(r.consistencyStreak, 16, 'a free day is not spent')
  assert.equal(r.spentInStreak, 0, 'and it is not charged')
  assert.equal(r.restCredits, 3)
  assert.equal(r.creditProgress, 1)
  assert.equal(r.daysToNextCredit, 4, 'not 5')
  assert.ok(!r.restTakenHistory.includes(day(2)), 'it is a scheduled rest, not a paid one')
})

test('several stray taps on scheduled days still cost nothing', () => {
  const r = clean({ restDays: [day(2), day(6), day(10), day(14)] })
  assert.deepEqual(
    [r.consistencyStreak, r.creditsEarned, r.spentInStreak, r.creditProgress],
    [16, 3, 0, 1],
  )
})

test('a rest entry on a day he actually trained is not a purchase', () => {
  const r = clean({ restDays: [day(3)] })
  assert.equal(r.spentInStreak, 0, 'he trained that day — nothing was skipped')
  assert.equal(r.consistencyStreak, 16)
  assert.equal(r.restCredits, 3)
})

test('a rest entry dated in the future cannot be charged yet', () => {
  const r = clean({ restDays: [day(20)] })
  assert.equal(r.spentInStreak, 0)
  assert.equal(r.restCredits, 3)
})

test('a real optional rest inside a long run costs exactly one reward', () => {
  // Day 15 was a workout day; skipped and paid for. Freezing it leaves
  // day 16 still a workout day, so it is trained instead.
  const r = computeRecovery(
    workoutsOn(1, 3, 5, 7, 9, 11, 13, 16),
    { ...CFG, restDays: [day(15)] },
    day(16),
  )
  assert.deepEqual(r.missedDays, [], 'the paid day is not a miss')
  assert.equal(r.spentInStreak, 1)
  assert.equal(r.consistencyStreak, 15, 'the paid day is held but not eligible')
  assert.equal(r.creditsEarned, 3)
  assert.equal(r.restCredits, 2, 'three earned, one spent')
  assert.equal(r.creditProgress, 0, '15 eligible days is exactly three rewards')
})

test('paid days shift the reward line without shortening the streak', () => {
  // Two optional rests inside the run. The streak still spans the same
  // calendar days, but only the eligible ones move the bar.
  const r = computeRecovery(
    workoutsOn(1, 3, 5, 7, 9, 12, 14, 16),
    { ...CFG, restDays: [day(11)] },
    day(17),
  )
  assert.equal(r.spentInStreak, 1)
  assert.equal(r.streakStart, day(1), 'the run is unbroken back to the start')
  assert.equal(r.consistencyStreak, 16, '17 days, one of them frozen')
  assert.equal(r.creditProgress, 1)
  assert.equal(r.restCredits, 2, 'three earned, one spent')
})

test('the reward counts eligible days, not days on the calendar', () => {
  // The invariant the old shortcut broke: progress is always the eligible
  // count modulo the target, and the streak IS the eligible count.
  const cases = [
    clean(),
    clean({ restDays: [day(2), day(6)] }),
    computeRecovery(workoutsOn(1, 3, 5, 7, 9, 11, 13, 16), { ...CFG, restDays: [day(15)] }, day(16)),
    computeRecovery(workoutsOn(1, 3), CFG, day(9)),   // broken run
  ]
  for (const r of cases) {
    assert.equal(r.eligibleDays, r.consistencyStreak)
    assert.equal(r.creditProgress, r.eligibleDays % REST_CREDIT_EVERY)
    assert.equal(r.creditsEarned, Math.floor(r.eligibleDays / REST_CREDIT_EVERY))
    assert.equal(r.daysToNextCredit, REST_CREDIT_EVERY - r.creditProgress)
    assert.ok(r.creditProgress >= 0 && r.creditProgress < REST_CREDIT_EVERY)
  }
})

test('a broken run restarts the reward from the day it resumed', () => {
  // Trained 1 and 3, then vanished. Day 5 was a workout day, missed.
  // Came back on day 7 and kept going.
  const r = computeRecovery(workoutsOn(1, 3, 7, 9, 11), CFG, day(12))
  assert.ok(r.missedDays.includes(day(5)), 'day 5 broke it')
  assert.equal(r.streakStart, day(7), 'the run starts where he came back')
  assert.equal(r.consistencyStreak, 6, 'days 7 to 12')
  assert.equal(r.creditsEarned, 1)
  assert.equal(r.creditProgress, 1)
})

test('rest days from before the break are not charged to the new run', () => {
  const r = computeRecovery(workoutsOn(1, 7, 9, 11), { ...CFG, restDays: [day(3)] }, day(12))
  assert.equal(r.streakStart, day(7))
  assert.equal(r.spentInStreak, 0, 'day 3 belongs to the run that ended')
  assert.equal(r.consistencyStreak, 6)
  assert.equal(r.restCredits, 1)
})

test('replaying the same history twice gives the same ledger', () => {
  // Nothing about the reward is stored, so a deploy, a reinstall or a
  // code change cannot move it: the numbers come out of the history and
  // only out of the history.
  const cfg = { ...CFG, restDays: [day(2), day(15)] }
  const history = workoutsOn(1, 3, 5, 7, 9, 11, 13, 16)
  const a = computeRecovery(history, cfg, day(16))
  const b = computeRecovery([...history].reverse(), { ...cfg, restDays: [...cfg.restDays].reverse() }, day(16))
  const ledger = (r) => [r.consistencyStreak, r.creditProgress, r.creditsEarned, r.spentInStreak, r.restCredits]
  assert.deepEqual(ledger(a), ledger(b), 'order of the stored records is irrelevant')
  assert.deepEqual(ledger(a), ledger(computeRecovery(history, cfg, day(16))))
})

test('a streak reset does not carry old rewards or old spends across', () => {
  const r = computeRecovery(
    workoutsOn(1, 3, 5, 7, 9, 11, 13, 15),
    { ...CFG, restDays: [day(4)], streakResetAt: day(10) },
    day(16),
  )
  assert.equal(r.streakStart, day(11), 'counting begins after the reset day')
  assert.equal(r.consistencyStreak, 6, 'days 11 to 16')
  assert.equal(r.spentInStreak, 0, 'the old spend is behind the reset')
  assert.equal(r.creditsEarned, 1)
  assert.equal(r.creditProgress, 1)
})
