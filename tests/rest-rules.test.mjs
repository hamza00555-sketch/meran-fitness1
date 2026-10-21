// Specs for the dated rest-day rules.
//
//   node --test tests/rest-rules.test.mjs
//
// حمزة: «ابا نظام الراحة الاختيارية يكون اسهل بس يلتزم بالحد الاقصى».
// From 21 October 2026 one optional rest day comes every 3 counted days
// (it was 5) and he can never hold more than 5 (before, 5 only capped the
// number drawn). Every day is judged by the rules in force on that day,
// so:
//
//   · up to the day before the switch, the engine returns exactly what
//     the old one did — compared, whole, against a frozen copy of it
//     (tests/recovery-v1.frozen.mjs) over long, messy histories;
//   · at the switch a balance above 5 is trimmed to 5 (written on that
//     day's row), and progress carries over toward 3;
//   · from it, one every 3 counted days, never more than 5; at 5 counted
//     days build no progress, and using one starts the earning again.

import test from 'node:test'
import assert from 'node:assert/strict'

const NEW = await import('../src/recovery.js')
const OLD = await import('./recovery-v1.frozen.mjs')
const { restDaysView, restDaysCopy, earnedCopy } = await import('../src/restDays.js')
const streakMod = await import('../src/streak.js')
const { computeRecovery, restRulesOn, REST_RULES_V2_FROM, addDays, MAX_REST_CREDITS } = NEW

const SWITCH = REST_RULES_V2_FROM
const BEFORE = addDays(SWITCH, -1)

const S = (d, i = 0) => ({ id: `${d}-${i}`, date: `${d}T18:00:00`, duration: 50,
  exercises: [{ name: 'Bench Press', sets: [{ weight: '80', reps: '10', done: true }] }] })
const range = (from, to) => { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out }
// Three days a week is pattern [1]: train, rest, train … — trained on the
// days given, every day of a clean stretch is a counted day.
const CFG3 = { daysPerWeek: 3, overrides: [], restDays: [], autoSpendFrom: '2026-07-01' }
const every2 = (from, to) => range(from, to).filter((_, i) => i % 2 === 0)

// A small seeded PRNG, so the "messy" histories are the same every run.
function rng(seed) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32 }
}

/**
 * Lives a history day by day the way the app does: on a workout day he
 * trains (or not), now and then trains on a rest day, taps «خذ راحة»,
 * changes the plan; and the days the engine paid for are written into
 * restDays afterwards, as App.jsx does. Driven by the OLD engine — this
 * is history that happened before the switch.
 */
function liveHistory({ seed, from, to, cfg, skip = 0.12, extra = 0.04, tap = 0.02, changeOn = null, resetOn = null }) {
  const rand = rng(seed)
  const sessions = []
  const config = { ...cfg, restDays: [], overrides: [], patternHistory: cfg.patternHistory || [] }
  for (const d of range(from, to)) {
    if (changeOn && d === changeOn.day) {
      config.patternHistory = [
        { from: '2000-01-01', daysPerWeek: config.daysPerWeek, customPattern: config.customPattern },
        { from: d, daysPerWeek: changeOn.daysPerWeek, customPattern: changeOn.customPattern },
      ]
      config.daysPerWeek = changeOn.daysPerWeek
      if (changeOn.customPattern) config.customPattern = changeOn.customPattern
    }
    if (resetOn && d === resetOn) config.streakResetAt = d
    const r = OLD.computeRecovery(sessions, config, d)
    for (const p of r.autoPaidDays || []) if (!config.restDays.includes(p)) config.restDays.push(p)
    const x = rand()
    if (r.status === 'workout') {
      if (x < tap) config.restDays.push(d)          // «خذ راحة», paid on purpose
      else if (x >= skip) sessions.push(S(d, sessions.length))
    } else if (r.status === 'recovery' && x < extra) {
      config.overrides.push(d)
      sessions.push(S(d, sessions.length))
    }
  }
  config.restDays.sort()
  return { sessions, config }
}

const HISTORIES = [
  // like حمزة's: four days a week (two on, one off), from summer 2025 —
  // more than the engine's 400-day replay window by the switch
  ['four a week, 14 months', liveHistory({ seed: 7, from: '2025-08-01', to: BEFORE, cfg: { ...CFG3, daysPerWeek: 4 } })],
  // three a week, rarely missing: a big balance (well above 5) by October
  ['three a week, rarely missing', liveHistory({ seed: 11, from: '2026-03-01', to: BEFORE, cfg: CFG3, skip: 0.04, tap: 0 })],
  // five a week [3,2] with a plan change in June and a plan reset in August
  ['five a week, a plan change, a reset', liveHistory({ seed: 23, from: '2026-01-10', to: BEFORE, cfg: { ...CFG3, daysPerWeek: 5 },
    changeOn: { day: '2026-06-14', daysPerWeek: 'custom', customPattern: [2, 1] }, resetOn: '2026-08-09' })],
  // missing a lot: many breaks and many covered days
  ['missing a lot', liveHistory({ seed: 3, from: '2026-02-01', to: BEFORE, cfg: { ...CFG3, daysPerWeek: 4 }, skip: 0.3, tap: 0.05 })],
]

// ══ 1. The past is never rewritten ═════════════════════════════

test('the rules are dated: every 5 with no ceiling before 21 Oct 2026, every 3 and at most 5 from it', () => {
  assert.equal(SWITCH, '2026-10-21')
  assert.deepEqual({ ...restRulesOn('2026-03-01') }, { every: 5, cap: null })
  assert.deepEqual({ ...restRulesOn(BEFORE) }, { every: 5, cap: null })
  assert.deepEqual({ ...restRulesOn(SWITCH) }, { every: 3, cap: 5 })
  assert.deepEqual({ ...restRulesOn('2027-05-01') }, { every: 3, cap: 5 })
  assert.equal(MAX_REST_CREDITS, 5)
})

for (const [name, h] of HISTORIES) {
  test(`up to 20 Oct the whole output is identical to the old engine: ${name}`, () => {
    const first = h.sessions[0].date.slice(0, 10)
    let compared = 0
    for (let d = first; d <= BEFORE; d = addDays(d, 1)) {
      // every day of the last four months, a day a week before that
      if (d < '2026-06-20' && new Date(`${d}T12:00:00Z`).getUTCDay() !== 0) continue
      const sessions = h.sessions.filter(s => s.date.slice(0, 10) <= d)
      assert.deepEqual(computeRecovery(sessions, h.config, d), OLD.computeRecovery(sessions, h.config, d), d)
      compared++
    }
    assert.ok(compared > 100, String(compared))
    // and the history is a real one: runs that broke, days a rest day paid
    const r = OLD.computeRecovery(h.sessions, h.config, BEFORE)
    assert.ok(r.ledger.some(x => x.kind === 'paid'), 'has paid days')
  })
}

test('after the switch, the days before it keep their numbers', () => {
  // A clean month and a half into October, then going on under the new rules:
  // every row dated before 21 Oct reads exactly as the old engine wrote it.
  const sessions = every2('2026-09-01', '2026-11-15').map(S)
  const old = OLD.computeRecovery(sessions.filter(s => s.date < SWITCH), CFG3, BEFORE)
  for (const today of [SWITCH, '2026-10-25', '2026-11-15']) {
    const r = computeRecovery(sessions.filter(s => s.date.slice(0, 10) <= today), CFG3, today)
    const before = r.ledger.filter(x => x.date < BEFORE)
    assert.deepEqual(before, old.ledger.filter(x => x.date < BEFORE), today)
  }
})

test('the old design (classic) never sees the switch — its engine has no date', () => {
  // classic/src/recovery.js is frozen at every 5 with no ceiling; this
  // repo's copy for the comparison above says the same.
  const r = OLD.computeRecovery(every2('2026-10-01', '2026-11-30').map(S), CFG3, '2026-11-30')
  assert.equal(r.creditTarget, 5)
  assert.equal(r.creditsEarned, Math.floor(r.consistencyStreak / 5))
})

// ══ 2. From the switch: one every 3 ═══════════════════════════

test('a run that starts after the switch earns on every 3rd counted day', () => {
  // 1–10 November, three a week, every workout done: 10 counted days
  const r = computeRecovery(every2('2026-11-01', '2026-11-09').map(S), CFG3, '2026-11-10')
  assert.equal(r.consistencyStreak, 10)
  assert.deepEqual(r.ledger.filter(x => x.earned).map(x => x.date), ['2026-11-03', '2026-11-06', '2026-11-09'])
  assert.equal(r.creditsEarned, 3)
  assert.equal(r.usableCredits, 3)
  assert.equal(r.creditProgress, 1)
  assert.equal(r.creditTarget, 3)
  assert.equal(r.daysToNextCredit, 2)
  assert.equal(r.creditCap, 5)
  assert.equal(r.atCap, false)
  assert.equal(r.creditsTrimmed, 0)
})

test('the fields the new rules added are there from the switch day, and only from it', () => {
  const s = every2('2026-10-01', '2026-10-21').map(S)
  const before = computeRecovery(s.filter(x => x.date < SWITCH), CFG3, BEFORE)
  assert.ok(!('creditCap' in before) && !('atCap' in before) && !('creditsTrimmed' in before))
  const on = computeRecovery(s, CFG3, SWITCH)
  assert.deepEqual([on.creditCap, typeof on.atCap, typeof on.creditsTrimmed], [5, 'boolean', 'number'])
  const empty = computeRecovery([], CFG3, SWITCH)
  assert.deepEqual([empty.creditTarget, empty.daysToNextCredit, empty.creditCap, empty.atCap], [3, 3, 5, false])
})

// ══ 3. The cap is real ═════════════════════════════════════════

test('at 5 the balance stops: counted days still count for the streak, but build nothing', () => {
  // 1–20 November: the 3rd, 6th, 9th, 12th and 15th counted days earn; 16–20 add nothing
  const r = computeRecovery(every2('2026-11-01', '2026-11-19').map(S), CFG3, '2026-11-20')
  assert.equal(r.consistencyStreak, 20, 'the streak is not capped')
  assert.equal(r.creditsEarned, 5)
  assert.equal(r.usableCredits, 5)
  assert.equal(r.restCredits, 5)
  assert.equal(r.atCap, true)
  assert.equal(r.creditProgress, 0, 'no progress while at the cap')
  for (const row of r.ledger.filter(x => x.date > '2026-11-15')) {
    assert.equal(row.earned, 0, row.date)
    assert.equal(row.progress, 0, row.date)
    assert.equal(row.balance, 5, row.date)
    assert.equal(row.streakDelta, 1, `${row.date} still counts`)
  }
})

test('never above 5, however long the run', () => {
  const sessions = every2('2026-10-21', '2027-03-31').map(S)
  for (const today of range('2026-10-21', '2027-03-31').filter((_, i) => i % 3 === 0)) {
    const r = computeRecovery(sessions.filter(s => s.date.slice(0, 10) <= today), CFG3, today)
    assert.ok(r.usableCredits <= 5, `${today}: ${r.usableCredits}`)
    assert.equal(r.restCredits, r.usableCredits, 'the drawn number and the real one agree')
    assert.ok(r.ledger.every(x => x.balance == null || x.balance <= 5))
  }
})

test('using one at the cap starts the earning again, and it stops at 5 again', () => {
  // at 5 on the 20th; the 21st (a workout day) is missed and paid; the
  // paid day freezes the cycle, so the 22nd is still a workout day
  const sessions = [...every2('2026-11-01', '2026-11-19'), '2026-11-22', '2026-11-24', '2026-11-26', '2026-11-28'].map(S)
  const r22 = computeRecovery(sessions.filter(s => s.date.slice(0, 10) <= '2026-11-22'), CFG3, '2026-11-22')
  assert.deepEqual(r22.autoPaidDays, ['2026-11-21'])
  assert.equal(r22.usableCredits, 4)
  assert.equal(r22.atCap, false)
  assert.equal(r22.creditProgress, 1, 'the 22nd is the first counted day toward the next')
  assert.equal(r22.daysToNextCredit, 2)
  const r24 = computeRecovery(sessions.filter(s => s.date.slice(0, 10) <= '2026-11-24'), CFG3, '2026-11-24')
  assert.equal(r24.usableCredits, 5, 'three counted days later: back to 5')
  assert.equal(r24.ledger.find(x => x.date === '2026-11-24').earned, 1)
  const r28 = computeRecovery(sessions, CFG3, '2026-11-28')
  assert.equal(r28.usableCredits, 5)
  assert.equal(r28.creditProgress, 0)
})

// ══ 4. The morning of the switch ═══════════════════════════════

// A clean run from 1 Sep, three a week: N counted days by 20 Oct.
const runFrom = (start, sessionsUntil = '2026-10-31') => every2(start, sessionsUntil).map(S)

test('a balance above 5 is trimmed to 5 on 21 Oct, and the trim is written down', () => {
  // 1 Sep – 20 Oct: 50 counted days, 10 rest days earned under the old rules
  const s = runFrom('2026-09-01')
  const old = OLD.computeRecovery(s.filter(x => x.date < SWITCH), CFG3, BEFORE)
  const was = computeRecovery(s.filter(x => x.date < SWITCH), CFG3, BEFORE)
  assert.equal(old.usableCredits, 10)
  assert.equal(was.usableCredits, 10, 'on 20 Oct he still holds 10 — nothing is trimmed backwards')

  const r = computeRecovery(s.filter(x => x.date.slice(0, 10) <= SWITCH), CFG3, SWITCH)
  assert.equal(r.usableCredits, 5)
  assert.equal(r.restCredits, 5)
  assert.equal(r.creditsTrimmed, 5)
  assert.equal(r.atCap, true)
  assert.equal(r.consistencyStreak, old.consistencyStreak + 1, 'the streak is untouched (21 Oct is trained)')
  const row = r.ledger.find(x => x.date === SWITCH)
  assert.equal(row.trimmed, 5)
  assert.equal(row.balance, 5)
  // the ledger still adds up: earned − spent − trimmed = balance
  const run = r.ledger.filter(x => x.inRun)
  const sum = (k) => run.reduce((a, x) => a + (x[k] || 0), 0)
  assert.equal(sum('earned') - sum('spent') - sum('trimmed'), r.usableCredits)
  // the list drops the oldest five; the five newest are the ones he holds
  const v = restDaysView(r)
  assert.equal(v.count, 5)
  assert.deepEqual(v.held.map(h => h.earnedOn), ['2026-09-30', '2026-10-05', '2026-10-10', '2026-10-15', '2026-10-20'])
  assert.deepEqual(v.trimmed.map(t => t.on), Array(5).fill(SWITCH))
  assert.deepEqual(v.trimmed.map(t => t.earnedOn).sort(), ['2026-09-05', '2026-09-10', '2026-09-15', '2026-09-20', '2026-09-25'])
})

test('a trimmed run that then misses six days breaks on the sixth, not the ninth', () => {
  // He held 10 on 20 Oct. From 21 Oct he stops: 5 cover, the 6th breaks.
  const s = runFrom('2026-09-01', BEFORE)
  const r = computeRecovery(s, CFG3, '2026-10-31')
  const paid = r.autoPaidDays.filter(d => d >= SWITCH)
  assert.equal(paid.length, 5)
  assert.equal(r.lastBreak?.breakDay, addDays(paid[4], 1), 'the sixth missed workout day')
  assert.equal(r.consistencyStreak, 0)
  assert.ok(r.runs.some(x => x.endedBy === 'miss' && x.start === '2026-09-01'))
  // under the old rules the same days would have been covered by the 10
  const old = OLD.computeRecovery(s, CFG3, '2026-10-31')
  assert.ok(old.consistencyStreak > 0, 'the old engine would still be holding')
})

test('progress carries over toward 3: 4 of 5 earns one that morning and keeps 1', () => {
  const start = addDays(BEFORE, -(5 * 2 + 4) + 1)          // 14 counted days by 20 Oct: 2 earned, 4 of 5
  const s = runFrom(start, BEFORE)
  const old = computeRecovery(s, CFG3, BEFORE)
  assert.deepEqual([old.consistencyStreak, old.creditProgress, old.usableCredits], [14, 4, 2])
  const r = computeRecovery(s, CFG3, SWITCH)                  // 21 Oct, the morning: not trained yet
  const row = r.ledger.find(x => x.date === SWITCH)
  assert.equal(row.earned, 1, 'earned on the morning of 21 Oct')
  assert.equal(r.usableCredits, 3)
  assert.equal(r.creditProgress, 1)
  assert.equal(r.daysToNextCredit, 2)
  assert.equal(restDaysView(r).held.at(-1).earnedOn, SWITCH)
})

test('3 of 5 earns one and keeps none; 2 of 5 becomes 2 of 3', () => {
  // [counted by 20 Oct, earned on the morning of 21 Oct, progress after 21 Oct]
  // An even count ends on a rest day, so 21 Oct is a workout day still to
  // come; an odd one ends on a workout, so 21 Oct is a scheduled rest and
  // counts from 03:00 (one more toward the next).
  for (const [counted, earnedNow, progress] of [[12, 0, 2], [14, 1, 1], [8, 1, 0], [10, 0, 0], [13, 1, 1], [11, 0, 2]]) {
    const start = addDays(BEFORE, -counted + 1)
    const r = computeRecovery(runFrom(start, BEFORE), CFG3, SWITCH)
    const row = r.ledger.find(x => x.date === SWITCH)
    assert.equal(row.earned, earnedNow, `${counted} counted`)
    assert.equal(r.creditProgress, progress, `${counted} counted`)
    assert.equal(r.usableCredits, Math.floor(counted / 5) + earnedNow, `${counted} counted`)
  }
})

test('the carry-over never goes past the cap: 4 held and 4 of 5 → 5, and the bar is empty', () => {
  const start = addDays(BEFORE, -24 + 1)                    // 24 counted: 4 earned, 4 of 5
  const r = computeRecovery(runFrom(start, BEFORE), CFG3, SWITCH)
  assert.equal(r.usableCredits, 5)
  assert.equal(r.atCap, true)
  assert.equal(r.creditProgress, 0)
  // 5 held and 3 of 5: nothing more, nothing trimmed
  const r2 = computeRecovery(runFrom(addDays(BEFORE, -28 + 1), BEFORE), CFG3, SWITCH)
  assert.deepEqual([r2.usableCredits, r2.creditsTrimmed, r2.creditProgress, r2.ledger.find(x => x.date === SWITCH).earned], [5, 0, 0, 0])
  // 7 held and 4 of 5: trimmed by 2, at the cap
  const r3 = computeRecovery(runFrom(addDays(BEFORE, -39 + 1), BEFORE), CFG3, SWITCH)
  assert.deepEqual([r3.usableCredits, r3.creditsTrimmed, r3.creditProgress], [5, 2, 0])
})

test('the switch day missed: the rest day the carry-over earns that morning covers it', () => {
  // 4 counted days by 20 Oct (none held), 21 Oct a workout day he misses.
  const s = runFrom(addDays(BEFORE, -3), BEFORE)             // 17, 19 Oct trained; 18, 20 rest
  const r20 = OLD.computeRecovery(s, CFG3, BEFORE)
  assert.deepEqual([r20.consistencyStreak, r20.creditProgress, r20.usableCredits], [4, 4, 0])
  const r = computeRecovery(s, CFG3, '2026-10-22')
  assert.deepEqual(r.autoPaidDays, [SWITCH], 'covered by the one earned that morning')
  assert.equal(r.consistencyStreak, 4)
  assert.equal(r.usableCredits, 0)
  // under the old rules it would have broken
  assert.equal(OLD.computeRecovery(s, CFG3, '2026-10-22').consistencyStreak, 0)
})

// ══ 5. Misses, deloads, resets after the switch ════════════════

test('a miss after the switch is covered by a rest day; with none, it breaks', () => {
  const s = [...every2('2026-11-01', '2026-11-09'), '2026-11-12'].map(S)
  const r = computeRecovery(s, CFG3, '2026-11-13')
  assert.deepEqual(r.autoPaidDays, ['2026-11-11'])
  assert.deepEqual(r.missedDays, [])
  assert.equal(r.consistencyStreak, 12, '10 counted, the 11th paid (held, not counted), 12th, 13th')
  assert.equal(r.usableCredits, 3, '3 earned, one used, one more on the 12th counted day')
  // no rest day yet: the first missed workout day breaks it
  const b = computeRecovery(every2('2026-11-01', '2026-11-01').map(S), CFG3, '2026-11-05')
  assert.equal(b.consistencyStreak, 0)
  assert.ok(b.missedDays.includes('2026-11-03'))
})

test('a deload changes none of it', () => {
  const s = every2('2026-11-01', '2026-11-19').map(S)
  const deload = { ...CFG3, deload: { from: '2026-11-08', plannedUntil: '2026-11-14', pct: 40 } }
  for (const today of ['2026-11-10', '2026-11-20']) {
    const a = computeRecovery(s.filter(x => x.date.slice(0, 10) <= today), CFG3, today)
    const b = computeRecovery(s.filter(x => x.date.slice(0, 10) <= today), deload, today)
    assert.deepEqual(a, b, today)
  }
})

test('a plan reset after the switch starts again from zero, on the new rules', () => {
  const s = every2('2026-10-01', '2026-11-19').map(S)
  const cfg = { ...CFG3, streakResetAt: '2026-11-08' }
  const r = computeRecovery(s, cfg, '2026-11-14')
  assert.equal(r.streakStart, '2026-11-09')
  assert.equal(r.consistencyStreak, 6)
  assert.equal(r.creditsEarned, 2)
  assert.equal(r.creditsTrimmed, 0)
  assert.equal(r.creditProgress, 0)
})

test('across the switch the list always agrees with the balance', () => {
  for (const [name, h] of HISTORIES) {
    // the same person carries on into November, under the new rules
    const rand = rng(99)
    const sessions = h.sessions.slice()
    const config = { ...h.config, restDays: h.config.restDays.slice() }
    for (const d of range(SWITCH, '2026-12-15')) {
      const r = computeRecovery(sessions, config, d)
      for (const p of r.autoPaidDays) if (!config.restDays.includes(p)) config.restDays.push(p)
      assert.equal(restDaysView(r).count, r.usableCredits, `${name} ${d}`)
      assert.ok(r.usableCredits <= 5, `${name} ${d}`)
      assert.equal(r.restCredits, r.usableCredits, `${name} ${d}`)
      const run = r.ledger.filter(x => x.inRun)
      const sum = (k) => run.reduce((a, x) => a + (x[k] || 0), 0)
      assert.equal(Math.max(0, sum('earned') - sum('spent') - sum('trimmed')), r.usableCredits, `${name} ${d}`)
      if (r.status === 'workout' && rand() > 0.15) sessions.push(S(d, sessions.length))
    }
  }
})

// ══ 6. The words read the rule from the engine ═════════════════

test('«ليش N؟»: «من 5», three slots, and at the cap one short line instead', () => {
  // 1–7 November, every workout done: 7 counted days, earned the 3rd and the 6th
  const two = restDaysCopy(restDaysView(computeRecovery(every2('2026-11-01', '2026-11-07').map(S), CFG3, '2026-11-07')), '2026-11-07')
  assert.equal(two.title, 'أيام الراحة الاختيارية: 2 من 5')
  assert.equal(two.every, 3, 'three slots')
  assert.equal(two.progress, 1)
  assert.equal(two.next, 'الجاي بعد يومين محسوبة')
  assert.deepEqual(two.rows.map(r => r.text), ['كسبته 6 نوفمبر', 'كسبته 3 نوفمبر'])
  const full = restDaysCopy(restDaysView(computeRecovery(every2('2026-11-01', '2026-11-19').map(S), CFG3, '2026-11-20')), '2026-11-20')
  assert.equal(full.title, 'أيام الراحة الاختيارية: 5 من 5')
  assert.equal(full.atCap, true)
  assert.equal(full.next, 'وصلت الحد — تكسب بعد ما تستخدم واحد')
  assert.ok(full.next.split(/\s+/).filter(w => /\p{L}/u.test(w)).length <= 7, 'one short line')
  assert.equal(full.progress, 0)
  assert.equal(full.rows.length, 3, 'the three newest held')
  const zero = restDaysCopy(restDaysView(computeRecovery([S('2026-11-01')], CFG3, '2026-11-02')), '2026-11-02')
  assert.equal(zero.title, 'أيام الراحة الاختيارية: 0 من 5')
  assert.equal(zero.next, 'الجاي بعد يوم واحد محسوب')
  for (const c of [two, full, zero]) assert.doesNotMatch(JSON.stringify(c), /تذكر|تذاكر/)
})

test('the trim is told on its day in the calendar, not as a line of its own', () => {
  const { dayLine } = streakMod
  const r = computeRecovery(runFrom('2026-09-01', '2026-10-21'), CFG3, '2026-10-22')
  assert.equal(restDaysView(r).trimmed.length, 5)
  const c = restDaysCopy(restDaysView(r), '2026-10-22')
  // he holds 5 after it: the three lines are the newest three he holds
  assert.deepEqual(c.rows.map(x => x.text), ['كسبته 20 أكتوبر', 'كسبته 15 أكتوبر', 'كسبته 10 أكتوبر'])
  assert.equal(dayLine(r.ledger.find(x => x.date === SWITCH), '2026-10-22'), 'الأربعاء 21 أكتوبر · تمرّنت · صار 51 · انشال 5 أيام راحة بالحد')
  assert.equal(dayLine(r.ledger.find(x => x.date === '2026-10-19'), '2026-10-22'), 'الاثنين 19 أكتوبر · تمرّنت · صار 49')
})

test('a rest day logged with none held is paid back by the next one: the list never reads above the balance', () => {
  // 1 Nov trained, 3 Nov logged as rest with nothing held (an old tap),
  // then a clean run: the engine's balance went to −1 and back.
  const s = ['2026-11-01', '2026-11-04', '2026-11-06', '2026-11-08', '2026-11-10'].map(S)
  const r = computeRecovery(s, { ...CFG3, restDays: ['2026-11-03'] }, '2026-11-11')
  const v = restDaysView(r)
  assert.equal(v.count, r.usableCredits)
  assert.deepEqual(v.used.map(u => u.usedOn), ['2026-11-03'])
})

test('«كسبت يوم راحة» says the rule of the day it came', () => {
  assert.equal(earnedCopy([{ earnedOn: '2026-11-06', streak: 6 }], 2).line, '3 أيام محسوبة جديدة — وصل ستريكك 6')
  assert.equal(earnedCopy([{ earnedOn: '2026-07-10', streak: 10 }], 2).line, '5 أيام محسوبة جديدة — وصل ستريكك 10')
})
