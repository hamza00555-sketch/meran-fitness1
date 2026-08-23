// Specs for the monthly report, run against the real modules.
//
//   node --test tests/month-report.test.mjs
//
// Two things are being pinned here: that the month's numbers agree with
// the engines the rest of the app already trusts, and that no tip ever
// fires without the data to back it.

import test from 'node:test'
import assert from 'node:assert/strict'

// The progression and stats helpers read a reset watermark out of
// localStorage; the report reaches them through those helpers.
globalThis.localStorage = {
  _d: new Map(),
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null },
  setItem(k, v) { this._d.set(k, String(v)) },
  removeItem(k) { this._d.delete(k) },
  key(i) { return [...this._d.keys()][i] ?? null },
  get length() { return this._d.size },
}

const {
  buildMonthReport, monthReportWindow, monthKey, prevMonth,
  daysInMonth, monthLabel, coverSlot, MAX_TIPS,
  formatRatio, describeRatio,
} = await import('../src/monthReport.js')
const { calc1RM, sessionVolume } = await import('../src/utils.js')

// 3 days a week is train / rest / train / rest, so every day of the
// month is either a workout or the cycle's own recovery — which makes
// the consistency numbers easy to reason about by hand.
const CFG = { daysPerWeek: 3, overrides: [], restDays: [] }

/** A session on day `n` of March 2026. `sets` is [[weight, reps, done?], …] */
let seq = 0
const session = (n, name, sets, opts = {}) => ({
  id: Date.UTC(2026, 2, n) + (++seq),
  date: new Date(2026, 2, n, 10, 0, 0).toISOString(),
  // `??` would swallow a deliberate `duration: null`, which is exactly
  // the case the time tips have to cope with.
  duration: 'duration' in opts ? opts.duration : 45,
  exercises: [{
    id: `e${seq}`,
    muscle: opts.muscle || 'Chest',
    name,
    sets: sets.map(([w, r, done = true]) => ({ weight: String(w), reps: String(r), done })),
  }],
})

// The report replays recovery to the LAST day of the month, so any
// workout day left empty after the final session is a genuine miss.
// Consistency fixtures therefore have to cover the whole month.
const trainOn = (...days) => days.map(n => session(n, 'Bench Press', [[60, 12]]))
const ODD_MARCH = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31]

const build = (sessions, extra = {}) => buildMonthReport({
  sessions, config: CFG, month: '2026-03', ...extra,
})

// ══ calendar arithmetic ═══════════════════════════════════════

test('month keys come off the local day, not UTC', () => {
  // 01:00 on the first of the month in UTC+3 is still the previous day
  // in UTC. dayKey is what keeps it in the right month.
  assert.equal(monthKey(new Date(2026, 2, 1, 1, 0, 0)), '2026-03')
  assert.equal(monthKey(new Date(2026, 2, 31, 23, 30, 0)), '2026-03')
})

test('the previous month rolls back over the new year', () => {
  assert.equal(prevMonth('2026-01'), '2025-12')
  assert.equal(prevMonth('2026-03'), '2026-02')
})

test('February knows its own length, leap year included', () => {
  assert.equal(daysInMonth('2026-02'), 28)
  assert.equal(daysInMonth('2028-02'), 29)
  assert.equal(daysInMonth('2026-03'), 31)
})

test('every month has its own cover slot', () => {
  assert.equal(coverSlot('2026-01'), 'cover_01')
  assert.equal(coverSlot('2026-12'), 'cover_12')
  assert.equal(monthLabel('2026-03'), 'مارس 2026')
})

// ══ the date window ═══════════════════════════════════════════

test('the last two days of a month report that month', () => {
  assert.equal(monthReportWindow('2026-03-30'), '2026-03')
  assert.equal(monthReportWindow('2026-03-31'), '2026-03')
})

test('the first week of a month reports the month before', () => {
  assert.equal(monthReportWindow('2026-04-01'), '2026-03')
  assert.equal(monthReportWindow('2026-04-07'), '2026-03')
})

test('the middle of a month offers nothing', () => {
  assert.equal(monthReportWindow('2026-04-08'), null)
  assert.equal(monthReportWindow('2026-04-15'), null)
  assert.equal(monthReportWindow('2026-03-29'), null)
})

test('the window survives the turn of the year', () => {
  assert.equal(monthReportWindow('2026-01-03'), '2025-12')
  assert.equal(monthReportWindow('2025-12-31'), '2025-12')
})

test('short months keep a two-day tail', () => {
  assert.equal(monthReportWindow('2026-02-27'), '2026-02')
  assert.equal(monthReportWindow('2026-02-28'), '2026-02')
  assert.equal(monthReportWindow('2026-02-26'), null)
})

// ══ volume and sets ═══════════════════════════════════════════

test('an empty month says so instead of reporting zeros', () => {
  const r = build([session(5, 'Bench Press', [[60, 12]])], { month: '2026-04' })
  assert.equal(r.hasData, false)
  assert.equal(r.sessionCount, 0)
  assert.ok(r.cover, 'it still knows which cover to draw')
})

test('tonnage matches sessionVolume summed by hand', () => {
  const a = session(1, 'Bench Press', [[60, 12], [60, 10]])
  const b = session(3, 'Squat', [[100, 5]])
  const r = build([a, b])
  assert.equal(r.volume.total, sessionVolume(a) + sessionVolume(b))
  assert.equal(r.volume.total, 60 * 12 + 60 * 10 + 100 * 5)
  assert.equal(r.sessionCount, 2)
  assert.equal(r.volume.perSession, Math.round(r.volume.total / 2))
})

test('the muscle slices add up to the total', () => {
  const r = build([
    session(1, 'Bench Press', [[60, 10]], { muscle: 'Chest' }),
    session(3, 'Barbell Row', [[50, 10]], { muscle: 'Back' }),
    session(5, 'Squat', [[100, 5]], { muscle: 'Legs' }),
  ])
  const sum = r.muscles.reduce((n, m) => n + m.volume, 0)
  assert.equal(sum, r.volume.total, 'no tonnage is lost between the slices')
  // Chest 60×10 = 600 beats Legs 100×5 = 500 and Back 50×10 = 500.
  assert.equal(r.muscles[0].key, 'Chest', 'sorted heaviest first')
  assert.deepEqual(r.muscles.map(m => m.volume), [600, 500, 500])
})

test('an unknown muscle lands in "other" rather than vanishing', () => {
  const r = build([
    session(1, 'Bench Press', [[60, 10]], { muscle: 'Chest' }),
    session(3, 'Weird Machine', [[40, 10]], { muscle: 'Forearms' }),
  ])
  const other = r.muscles.find(m => m.key === 'Other')
  assert.ok(other, 'the unknown group is reported')
  assert.equal(other.label, 'أخرى')
  assert.equal(r.muscles.reduce((n, m) => n + m.volume, 0), r.volume.total)
})

test('an unticked set counts for tonnage but not for completion', () => {
  // The app's own rule: a typed-in weight is volume, but only a ticked
  // set is work the progression engine will act on.
  const r = build([session(1, 'Bench Press', [[60, 12, true], [60, 12, false]])])
  assert.equal(r.sets.total, 2)
  assert.equal(r.sets.completed, 1)
  assert.equal(r.sets.untrackedPct, 50)
  assert.equal(r.reps.total, 12, 'only the ticked set contributes reps')
})

test('a month with no previous month has no trend, not a 0% trend', () => {
  const r = build([session(1, 'Bench Press', [[60, 10]])])
  assert.equal(r.volume.trendPct, null)
  assert.equal(r.volume.prevTotal, 0)
})

test('the trend compares against the month before', () => {
  const feb = { ...session(1, 'Bench Press', [[50, 10]]), date: new Date(2026, 1, 10, 10).toISOString() }
  const r = build([feb, session(1, 'Bench Press', [[60, 10]])])
  assert.equal(r.volume.prevTotal, 500)
  assert.equal(r.volume.total, 600)
  assert.equal(r.volume.trendPct, 20)
})

test('missing durations withhold the time averages instead of guessing', () => {
  const r = build([
    session(1, 'Bench Press', [[60, 10]], { duration: 45 }),
    session(3, 'Bench Press', [[60, 10]], { duration: null }),
    session(5, 'Bench Press', [[60, 10]], { duration: undefined }),
  ])
  assert.equal(r.time.known, false, 'only one of three sessions is timed')
  assert.equal(r.time.sessionsTimed, 1)
})

test('durations present on most of the month are reported', () => {
  const r = build([
    session(1, 'Bench Press', [[60, 10]], { duration: 40 }),
    session(3, 'Bench Press', [[60, 10]], { duration: 50 }),
    session(5, 'Bench Press', [[60, 10]], { duration: null }),
  ])
  assert.equal(r.time.known, true)
  assert.equal(r.time.avgMinutes, 45)
})

// ══ personal records ══════════════════════════════════════════

test('the first weight ever logged is not a record', () => {
  const r = build([session(1, 'Bench Press', [[60, 10]])])
  assert.deepEqual(r.prs, [], 'a starting point, not a personal best')
})

test('beating a previous best is a record, with the number it beat', () => {
  const r = build([
    session(1, 'Bench Press', [[60, 10]]),
    session(3, 'Bench Press', [[65, 8]]),
  ])
  assert.equal(r.prs.length, 1)
  assert.equal(r.prs[0].weight, 65)
  assert.equal(r.prs[0].prevBest, 60)
  assert.equal(r.prs[0].date, '2026-03-03')
})

test('a best set before the month counts as the bar to beat', () => {
  const feb = { ...session(1, 'Bench Press', [[70, 8]]), date: new Date(2026, 1, 10, 10).toISOString() }
  const r = build([feb, session(3, 'Bench Press', [[65, 8]])])
  assert.deepEqual(r.prs, [], '65 does not beat February\'s 70')
})

test('an unticked heavy set cannot claim a record', () => {
  const r = build([
    session(1, 'Bench Press', [[60, 10]]),
    session(3, 'Bench Press', [[100, 1, false]]),
  ])
  assert.deepEqual(r.prs, [], 'typed in, not lifted')
})

test('creeping up every session is one record, not a dozen', () => {
  // Adding 2kg a session is the programme working. Reporting each step
  // as its own record buries everything else under one lift.
  const feb = { ...session(1, 'Squat', [[100, 5]], { muscle: 'Legs' }),
                date: new Date(2026, 1, 20, 10).toISOString() }
  const climb = [102, 104, 106, 108, 110, 112]
    .map((w, i) => session(3 + i * 4, 'Squat', [[w, 5]], { muscle: 'Legs' }))
  const r = build([feb, ...climb])

  assert.equal(r.prs.length, 1, 'one entry for the lift, not six')
  assert.equal(r.prs[0].weight, 112, 'the month ended here')
  assert.equal(r.prs[0].prevBest, 100, 'and started from February, not from last week')
  assert.equal(r.prs[0].steps, 6, 'it took six sessions to get there')
})

test('each exercise gets its own entry', () => {
  const feb = (name, w, muscle) => ({
    ...session(1, name, [[w, 5]], { muscle }),
    date: new Date(2026, 1, 20, 10).toISOString(),
  })
  const r = build([
    feb('Squat', 100, 'Legs'), feb('Bench Press', 60, 'Chest'),
    session(3, 'Squat', [[110, 5]], { muscle: 'Legs' }),
    session(5, 'Bench Press', [[62.5, 8]]),
  ])
  assert.deepEqual(r.prs.map(p => p.exercise).sort(), ['Bench Press', 'Squat'])
})

test('records are ordered by how far the lift moved', () => {
  // A 10kg jump matters more than a heavier lift that gained 2.5.
  const feb = (name, w, muscle) => ({
    ...session(1, name, [[w, 5]], { muscle }),
    date: new Date(2026, 1, 20, 10).toISOString(),
  })
  const r = build([
    feb('Squat', 140, 'Legs'), feb('Bench Press', 60, 'Chest'),
    session(3, 'Squat', [[142.5, 5]], { muscle: 'Legs' }),
    session(5, 'Bench Press', [[70, 8]]),
  ])
  assert.equal(r.prs[0].exercise, 'Bench Press', '+10 leads +2.5')
})

test('a lift that stayed flat is not a record', () => {
  const feb = { ...session(1, 'Squat', [[100, 5]], { muscle: 'Legs' }),
                date: new Date(2026, 1, 20, 10).toISOString() }
  const r = build([feb, session(3, 'Squat', [[100, 8]], { muscle: 'Legs' })])
  assert.deepEqual(r.prs, [], 'more reps at the same weight is not a new max')
})

test('a baseline set inside the month still counts as a baseline', () => {
  const r = build([
    session(1, 'Bench Press', [[60, 10]]),
    session(2, 'Squat', [[80, 5]], { muscle: 'Legs' }),
    session(3, 'Bench Press', [[65, 8]]),
    session(4, 'Squat', [[120, 3]], { muscle: 'Legs' }),
  ])
  // Both lifts were first logged this month, so those are baselines;
  // the second session on each is the record. Ordered by the gain:
  // squat moved 40, bench moved 5.
  assert.deepEqual(r.prs.map(p => p.weight), [120, 65])
  assert.deepEqual(r.prs.map(p => p.prevBest), [80, 60])
})

// ══ consistency ═══════════════════════════════════════════════

test('the calendar covers only the month asked for', () => {
  const r = build([session(1, 'Bench Press', [[60, 10]]), session(3, 'Bench Press', [[60, 10]])])
  assert.ok(r.consistency.calendar.length > 0)
  assert.ok(r.consistency.calendar.every(d => d.date.startsWith('2026-03')))
})

test('a perfect month counts every day as trained or scheduled rest', () => {
  // Every odd day trained; the even days are the cycle's own recovery.
  const r = build(trainOn(...ODD_MARCH))
  assert.equal(r.consistency.trainedDays, 16)
  assert.equal(r.consistency.scheduledRests, 15)
  assert.deepEqual(r.consistency.missedDays, [], 'nothing was skipped')
  assert.equal(r.consistency.trainedDays + r.consistency.scheduledRests, 31)
  assert.equal(r.consistency.bestStreak, 31, 'an unbroken month')
})

test('a skipped workout day is a miss and cuts the best streak', () => {
  // Same month, but day 15 was a workout day left empty and unpaid.
  const r = build(trainOn(...ODD_MARCH.filter(n => n !== 15)))
  assert.ok(r.consistency.missedDays.includes('2026-03-15'), r.consistency.missedDays.join(','))
  assert.ok(r.consistency.bestStreak < 31, `got ${r.consistency.bestStreak}`)
})

test('a paid rest day holds the streak without counting as a day', () => {
  // Day 15 skipped but paid for. Freezing it leaves day 16 a workout
  // day, so the trained days shift to even from there on.
  const r = buildMonthReport({
    sessions: trainOn(1, 3, 5, 7, 9, 11, 13, 16, 18, 20, 22, 24, 26, 28, 30),
    month: '2026-03',
    config: { ...CFG, restDays: ['2026-03-15'] },
  })
  assert.equal(r.consistency.paidRests, 1)
  assert.deepEqual(r.consistency.missedDays, [], 'it was paid for, so not a miss')
  assert.equal(r.consistency.trainedDays, 15)
  assert.equal(r.consistency.trainedDays + r.consistency.scheduledRests + r.consistency.paidRests, 31)
  assert.equal(r.consistency.bestStreak, 30, 'the paid day holds but adds nothing')
})

// ══ achievements ══════════════════════════════════════════════

test('only achievements unlocked inside the month are listed', () => {
  const r = build([session(1, 'Bench Press', [[60, 10]])], {
    unlockedAt: {
      a1: new Date(2026, 2, 5).getTime(),    // in March
      a2: new Date(2026, 1, 5).getTime(),    // February
      zz: new Date(2026, 2, 6).getTime(),    // not a real achievement id
    },
  })
  assert.deepEqual(r.progress.achievements.map(a => a.id), ['a1'])
})

// ══ tips ══════════════════════════════════════════════════════

const tipIds = (r) => r.tips.map(t => t.id)

test('never more than a handful of tips, and each carries its evidence', () => {
  const r = build([1, 3, 5, 7, 9].map(n => session(n, 'Bench Press', [[60, 12, n !== 1]])))
  assert.ok(r.tips.length <= MAX_TIPS, `got ${r.tips.length}`)
  for (const t of r.tips) {
    assert.ok(t.id && t.title && t.body, 'a tip is never blank')
    assert.ok(t.evidence, `"${t.id}" states the number behind it`)
    assert.ok(!('weight' in t), 'the internal sort key does not leak out')
  }
})

test('a lopsided split raises the neglected-muscle tip', () => {
  const r = build([
    session(1, 'Bench Press', [[60, 12]], { muscle: 'Chest' }),
    session(3, 'Squat', [[120, 10]], { muscle: 'Legs' }),
    session(5, 'Shoulder Press', [[40, 12]], { muscle: 'Shoulders' }),
    session(7, 'Barbell Curl', [[10, 8]], { muscle: 'Biceps' }),
  ])
  assert.ok(tipIds(r).includes('neglected'), tipIds(r).join(','))
})

test('an even split does not raise it', () => {
  const r = build([
    session(1, 'Bench Press', [[60, 10]], { muscle: 'Chest' }),
    session(3, 'Barbell Row', [[60, 10]], { muscle: 'Back' }),
    session(5, 'Squat', [[60, 10]], { muscle: 'Legs' }),
  ])
  assert.ok(!tipIds(r).includes('neglected'))
})

test('unticked sets raise the untracked tip and name the count', () => {
  const r = build([session(1, 'Bench Press', [[60, 12, true], [60, 12, false], [60, 12, false]])])
  const tip = r.tips.find(t => t.id === 'untracked')
  assert.ok(tip, tipIds(r).join(','))
  assert.equal(tip.evidence, '2/3')
})

test('a fully ticked month does not raise it', () => {
  const r = build([session(1, 'Bench Press', [[60, 12], [60, 12]])])
  assert.ok(!tipIds(r).includes('untracked'))
})

test('a new record is reported as a win', () => {
  const r = build([
    session(1, 'Bench Press', [[60, 10]]),
    session(3, 'Bench Press', [[65, 8]]),
  ])
  const tip = r.tips.find(t => t.id === 'prs')
  assert.ok(tip, tipIds(r).join(','))
  assert.match(tip.body, /65/)
})

test('a long month with no record raises the drought tip', () => {
  const r = build([1, 3, 5, 7, 9, 11, 13].map(n => session(n, 'Bench Press', [[60, 12]])))
  assert.ok(tipIds(r).includes('prdrought'), tipIds(r).join(','))
})

test('a short month does not get scolded for having no record', () => {
  const r = build([session(1, 'Bench Press', [[60, 12]])])
  assert.ok(!tipIds(r).includes('prdrought'))
})

test('the time tips stay silent when duration is missing', () => {
  const r = build([
    session(1, 'Bench Press', [[60, 10]], { duration: 5 }),
    session(3, 'Bench Press', [[60, 10]], { duration: null }),
    session(5, 'Bench Press', [[60, 10]], { duration: null }),
  ])
  assert.equal(r.time.known, false)
  assert.ok(!tipIds(r).includes('short'), 'no advice from one timed session')
  assert.ok(!tipIds(r).includes('long'))
})

test('a real volume drop is reported, a small wobble is not', () => {
  const feb = (n, w) => ({
    ...session(n, 'Bench Press', [[w, 10]]),
    date: new Date(2026, 1, n, 10).toISOString(),
  })
  const dropped = buildMonthReport({
    sessions: [feb(1, 100), feb(3, 100), session(1, 'Bench Press', [[50, 10]])],
    config: CFG, month: '2026-03',
  })
  assert.ok(tipIds(dropped).includes('trend'), tipIds(dropped).join(','))

  const steady = buildMonthReport({
    sessions: [feb(1, 100), session(1, 'Bench Press', [[95, 10]])],
    config: CFG, month: '2026-03',
  })
  assert.ok(!tipIds(steady).includes('trend'), '5% is noise, not a trend')
})

test('tips are ordered with the most serious first', () => {
  const r = build([session(1, 'Bench Press', [[60, 12, false]], { muscle: 'Chest' })])
  const sevRank = { alert: 3, nudge: 2, praise: 1, info: 0 }
  const ranks = r.tips.map(t => sevRank[t.severity])
  assert.deepEqual(ranks, [...ranks].sort((a, b) => b - a))
})

// ══ the month's shape ═════════════════════════════════════════

test('the series is one point per training day, oldest first', () => {
  const r = build(trainOn(5, 1, 3))   // deliberately out of order
  assert.deepEqual(r.volume.series.map(p => p.date), ['2026-03-01', '2026-03-03', '2026-03-05'])
})

test('two sessions on one day are one point, not two', () => {
  // Otherwise the chart draws a spike on a day that was one day's work.
  const r = build([
    session(1, 'Bench Press', [[60, 10]]),
    session(1, 'Squat', [[100, 5]], { muscle: 'Legs' }),
    session(3, 'Bench Press', [[60, 10]]),
  ])
  assert.equal(r.volume.series.length, 2)
  assert.equal(r.volume.series[0].value, 60 * 10 + 100 * 5)
})

test('the series adds up to the month total', () => {
  const r = build(trainOn(1, 3, 5, 7))
  assert.equal(r.volume.series.reduce((n, p) => n + p.value, 0), r.volume.total)
})

test('a climbing month is trending up', () => {
  const r = build([100, 120, 140, 160, 180].map((w, i) =>
    session(1 + i * 2, 'Bench Press', [[w, 10]])))
  assert.equal(r.volume.direction, 'up')
  assert.ok(r.volume.slope > 0)
})

test('a fading month is trending down', () => {
  const r = build([180, 160, 140, 120, 100].map((w, i) =>
    session(1 + i * 2, 'Bench Press', [[w, 10]])))
  assert.equal(r.volume.direction, 'down')
  assert.ok(r.volume.slope < 0)
})

test('one heavy day at the end does not make a falling month rise', () => {
  // A first-to-last comparison would call this an increase. The fit
  // answers for every session, which is the point of using one.
  const r = build([200, 180, 160, 140, 120, 205].map((w, i) =>
    session(1 + i * 2, 'Bench Press', [[w, 10]])))
  assert.equal(r.volume.direction, 'down', `slope ${r.volume.slope}`)
})

test('too few days to have a direction is flat, not a guess', () => {
  const r = build(trainOn(1, 3))
  assert.equal(r.volume.slope, 0)
  assert.equal(r.volume.direction, 'flat')
})

test('an unticked set still shapes the day it was typed on', () => {
  // The series uses sessionVolume, the same rule the total uses, so
  // the chart and the headline can never disagree.
  const r = build([session(1, 'Bench Press', [[60, 10, false]])])
  assert.equal(r.volume.series[0].value, r.volume.total)
})

// ══ talking about a ratio ═════════════════════════════════════

test('an ordinary ratio is shown as a ratio', () => {
  assert.equal(formatRatio(1.62), '1.62')
  assert.match(describeRatio(1.62), /1\.62/)
  assert.equal(formatRatio(0.5), '0.5')
})

test('a lopsided ratio is shown as a multiple, not a decimal', () => {
  // 79.63 is arithmetically right and useless to read.
  assert.equal(formatRatio(79.63), '×80')
  assert.match(describeRatio(79.63), /80 أضعاف/)
  assert.equal(formatRatio(0.02), '×50')
  assert.match(describeRatio(0.02), /50 أضعاف/)
})

test('a split with one side barely trained is an alert, not a nudge', () => {
  const r = build([
    session(1, 'Bench Press', [[60, 12]], { muscle: 'Chest' }),
    session(3, 'Bench Press', [[60, 12]], { muscle: 'Chest' }),
    session(5, 'Barbell Row', [[20, 5]], { muscle: 'Back' }),
  ])
  const tip = r.tips.find(t => t.id === 'pushpull')
  assert.ok(tip, tipIds(r).join(','))
  assert.equal(tip.severity, 'alert')
  assert.match(tip.evidence, /^×/, 'stated as a multiple')
})

test('a balanced split raises no push-pull tip at all', () => {
  const r = build([
    session(1, 'Bench Press', [[60, 10]], { muscle: 'Chest' }),
    session(3, 'Barbell Row', [[60, 10]], { muscle: 'Back' }),
  ])
  assert.ok(!tipIds(r).includes('pushpull'))
})

// ══ estimated 1RM ═════════════════════════════════════════════

test('one rep at a weight is that weight', () => {
  assert.equal(calc1RM(100, 1), 100)
})

test('more reps estimate a higher max', () => {
  assert.equal(calc1RM(100, 10), 133.3)
  assert.ok(calc1RM(100, 5) > 100)
  assert.ok(calc1RM(100, 10) > calc1RM(100, 5))
})

test('nothing lifted estimates nothing', () => {
  assert.equal(calc1RM(0, 10), 0)
  assert.equal(calc1RM(100, 0), 0)
  assert.equal(calc1RM('', ''), 0)
})

// ══ deload ════════════════════════════════════════════════════
// A deload is deliberately light. Read as ordinary training it looks
// like a collapse, and the report's job is to tell the difference
// without ever hiding a real one.

/** The same session, stamped as having been done under a deload. */
const deloaded = (s, pct = 40) => ({
  ...s,
  deload: { pct, from: '2026-03-10', until: '2026-03-16' },
})

const DELOAD_CFG = {
  ...CFG,
  deloadHistory: [{
    from: '2026-03-10', plannedUntil: '2026-03-16',
    until: '2026-03-16', pct: 40, endedEarly: false,
  }],
}

// The taper caps the block, which is both how deloads are actually run
// and the arrangement that a least-squares fit is fooled by: a dip in
// the middle of a month is symmetric and tilts the line not at all.
const HEAVY_DAYS = [1, 3, 5, 7, 9, 11]
const TAPER_DAYS = [20, 22, 24, 26]

test('deload days are marked in the series but left out of the fit', () => {
  const heavy = HEAVY_DAYS.map(n => session(n, 'Bench Press', [[100, 10]]))
  const light = TAPER_DAYS.map(n => deloaded(session(n, 'Bench Press', [[40, 10]])))
  const r = build([...heavy, ...light], { config: DELOAD_CFG })

  const marked = r.volume.series.filter(p => p.deload).map(p => p.date)
  assert.deepEqual(marked, ['2026-03-20', '2026-03-22', '2026-03-24', '2026-03-26'])
  assert.equal(r.volume.deloadDays, 4)
  assert.equal(r.volume.deloadSessions, 4)
  assert.equal(r.volume.slopeExcludesDeload, true)

  // Every remaining day is identical, so the fit through them is flat.
  assert.equal(r.volume.slope, 0, `slope was ${r.volume.slope}`)
  assert.equal(r.volume.direction, 'flat')
})

test('the same month without the stamps does read as a decline', () => {
  // The control: identical numbers, no deload stamps. Without this the
  // test above would pass on a month that was flat anyway, and prove
  // nothing about the exclusion.
  const heavy = HEAVY_DAYS.map(n => session(n, 'Bench Press', [[100, 10]]))
  const light = TAPER_DAYS.map(n => session(n, 'Bench Press', [[40, 10]]))
  const r = build([...heavy, ...light])
  assert.equal(r.volume.deloadDays, 0)
  assert.equal(r.volume.slopeExcludesDeload, false)
  assert.equal(r.volume.direction, 'down')
  assert.ok(r.volume.slope < 0, `slope was ${r.volume.slope}`)
})

test('the headline volume still counts the deload, because it was lifted', () => {
  const r = build(
    [session(1, 'Bench Press', [[100, 10]]), deloaded(session(3, 'Bench Press', [[60, 10]]))],
    { config: DELOAD_CFG },
  )
  // 100×10 + 60×10. The taper does not stop being work that was done.
  assert.equal(r.volume.total, 1600)
})

const feb = (n, w) => ({
  ...session(n, 'Bench Press', [[w, 10]]),
  date: new Date(2026, 1, n, 10).toISOString(),
})

test('a drop that was only the deload is explained, not alarmed about', () => {
  // Six heavy days in February. March runs three heavy days at the same
  // weight and then tapers — which is what a deload block looks like,
  // and which drags the month TOTAL well under February's without a
  // single session having got weaker.
  const r = buildMonthReport({
    sessions: [
      ...[1, 3, 5, 7, 9, 11].map(n => feb(n, 100)),
      ...[1, 3, 5].map(n => session(n, 'Bench Press', [[100, 10]])),
      ...[20, 22, 24].map(n => deloaded(session(n, 'Bench Press', [[20, 5]]))),
    ],
    config: DELOAD_CFG, month: '2026-03',
  })

  assert.ok(r.volume.trendPct <= -15, `raw trend was ${r.volume.trendPct}`)
  // Per ordinary day the two months are identical, which is the whole
  // point: nothing got lighter, there were simply fewer heavy days.
  assert.equal(r.volume.trendPctExDeload, 0, `ex-deload was ${r.volume.trendPctExDeload}`)

  const ids = tipIds(r)
  assert.ok(!ids.includes('trend'), 'the decline tip should not fire on a planned taper')
  assert.ok(ids.includes('deload'), `expected the explaining note, got ${ids.join(',')}`)
})

test('a decline that survives the exclusion is still reported', () => {
  // The case a blanket suppression would have buried: the ordinary days
  // themselves got lighter, in a month that also contained a deload.
  // The advice has to come through, and has to say what it excluded.
  const r = buildMonthReport({
    sessions: [
      ...[1, 3, 5, 7, 9, 11].map(n => feb(n, 100)),
      ...[1, 3, 5].map(n => session(n, 'Bench Press', [[60, 10]])),
      ...[20, 22].map(n => deloaded(session(n, 'Bench Press', [[30, 10]]))),
    ],
    config: DELOAD_CFG, month: '2026-03',
  })

  assert.ok(r.volume.trendPctExDeload <= -15,
    `ex-deload trend was ${r.volume.trendPctExDeload}`)
  const trend = r.tips.find(t => t.id === 'trend')
  assert.ok(trend, `expected the decline tip, got ${tipIds(r).join(',')}`)
  assert.match(trend.body, /استثناء أيام الديلود/,
    'the wording has to say the calculation excluded the deload')
})

test('the calendar rims deload days without changing what they were', () => {
  const r = build(
    [session(1, 'Bench Press', [[100, 10]]), deloaded(session(11, 'Bench Press', [[60, 10]]))],
    { config: DELOAD_CFG },
  )
  const inside  = r.consistency.calendar.filter(d => d.deload).map(d => d.date)
  const outside = r.consistency.calendar.find(d => d.date === '2026-03-01')

  assert.equal(inside.length, 7, 'the whole stored stretch, not only the trained days')
  assert.equal(inside[0], '2026-03-10')
  assert.equal(inside[6], '2026-03-16')
  assert.equal(outside.deload, false)

  // A missed day inside a deload is still a missed day: the flag rides
  // alongside the kind, it does not replace it.
  const kinds = new Set(r.consistency.calendar.filter(d => d.deload).map(d => d.kind))
  assert.ok(kinds.size >= 1)
  assert.ok(!kinds.has('deload'), 'deload is a modifier, never a kind')
})
