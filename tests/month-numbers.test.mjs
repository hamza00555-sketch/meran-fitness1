// Specs for the report's new numbers (phase 2), run against the real
// modules with no browser:
//
//   node --test tests/month-numbers.test.mjs
//
// planned vs attended sessions, each day's light, one lift week by week,
// what went up against the best before the month, sets per muscle per
// week against the 10–20 range, next month's three things, the month's
// goal, and the months that came before.
//
// The suite runs on Riyadh's clock (UTC+3, no DST), the phone the app is
// actually used on, so a session late at night lands where the app's
// 03:00 day boundary says it does — not where UTC would put it.

process.env.TZ = 'Asia/Riyadh'

import test from 'node:test'
import assert from 'node:assert/strict'

globalThis.localStorage = {
  _d: new Map(),
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null },
  setItem(k, v) { this._d.set(k, String(v)) },
  removeItem(k) { this._d.delete(k) },
  key(i) { return [...this._d.keys()][i] ?? null },
  get length() { return this._d.size },
}

const R = await import('../src/monthReport.js')
const {
  buildMonthReport, dayLevels, attendanceOf, attendanceLine, weeklyTop,
  liftGains, newWeights, muscleSets, musclesLine, nextMonthPlan, nextCopy,
  monthGoalOf, withMonthGoal, goalResult, goalLine, reportMonths, monthsTrail,
  deloadRangesIn, deloadLine, countWord, monthKey, WEEKLY_SETS, MAX_NEXT,
  MONTH_GOAL_KEY, nextMonth, lastDayOf, calendarLine, strongerLine,
} = R

// ── Fixtures ──────────────────────────────────────────────────

const CFG = { daysPerWeek: 3, overrides: [], restDays: [] }
let seq = 0

/** A session at a local moment. `sets` is [[weight, reps, done?], …]. */
const at = (y, m, d, h, name, sets, opts = {}) => {
  const date = new Date(y, m - 1, d, h, opts.min || 0, 0)
  return {
    id: date.getTime() + (++seq),
    date: date.toISOString(),
    duration: 45,
    ...(opts.deload ? { deload: opts.deload } : {}),
    exercises: [{
      id: `e${seq}`, muscle: opts.muscle || 'Chest', name,
      sets: sets.map(([w, r, done = true]) => ({ weight: String(w), reps: String(r), done })),
    }],
  }
}
/** A session on day `d` of a month given as 'YYYY-MM', at 18:00. */
const on = (month, d, name, sets, opts = {}) => {
  const [y, m] = month.split('-').map(Number)
  return at(y, m, d, 18, name, sets, opts)
}

const MAR = '2026-03'
const TODAY = '2026-10-11'
const build = (sessions, extra = {}) =>
  buildMonthReport({ sessions, config: CFG, month: MAR, today: TODAY, ...extra })

const three = (w, r = 12) => [[w, r], [w, r], [w, r]]

// ══ each day as light ═════════════════════════════════════════

test('five steps of light, from the lightest ordinary day to the heaviest', () => {
  const lv = dayLevels([
    { date: 'a', value: 1000 }, { date: 'b', value: 1250 }, { date: 'c', value: 1500 },
    { date: 'd', value: 1750 }, { date: 'e', value: 2000 },
  ])
  assert.deepEqual(Object.values(lv), [1, 2, 3, 4, 5])
})

test('a deload day sits outside the scale, whatever it weighed', () => {
  const lv = dayLevels([
    { date: 'a', value: 1000 }, { date: 'b', value: 2000 },
    { date: 'c', value: 200, deload: true }, { date: 'd', value: 5000, deload: true },
  ])
  assert.equal(lv.a, 1)
  assert.equal(lv.b, 5, 'the 5000 deload day does not make 2000 look light')
  assert.equal(lv.c, null)
  assert.equal(lv.d, null)
})

test('one day, or every day alike, is all the month\'s heaviest', () => {
  assert.deepEqual(dayLevels([{ date: 'a', value: 900 }]), { a: 5 })
  assert.deepEqual(dayLevels([{ date: 'a', value: 900 }, { date: 'b', value: 900 }]), { a: 5, b: 5 })
  assert.deepEqual(dayLevels([{ date: 'a', value: 900, deload: true }]), { a: null })
  assert.deepEqual(dayLevels([]), {})
})

// ══ planned against attended ═════════════════════════════════

const day = (date, kind, planned, deload = false) => ({ date, kind, planned, deload })

test('every planned session is a slot, and so is one done on a rest day', () => {
  const a = attendanceOf([
    day('2026-03-01', 'trained', true),
    day('2026-03-02', 'rest', false),
    day('2026-03-03', 'miss', true),
    day('2026-03-04', 'trained', false),          // trained on a rest day
    day('2026-03-05', 'paid', true),              // skipped, a ticket paid
    day('2026-03-06', 'trained', true, true),     // a deload session
  ])
  assert.equal(a.planned, 4)
  assert.equal(a.attended, 3)
  assert.equal(a.extra, 1)
  assert.equal(a.missed, 1)
  assert.equal(a.tickets, 1)
  assert.equal(a.deload, 1)
  assert.deepEqual(a.slots.map(s => s.state), ['done', 'missed', 'done', 'ticket', 'done'])
})

test('the cover sentence says what happened in plain words', () => {
  const line = (o) => attendanceLine({ planned: 18, attended: 18, extra: 0, missed: 0, tickets: 0, ahead: 0, ...o })
  assert.equal(line({}), 'حضرت كل جلسات خطتك هالشهر.')
  assert.equal(line({ attended: 17, missed: 1 }), 'من 18 جلسة في خطتك، فاتتك وحدة بس.')
  assert.equal(line({ attended: 16, missed: 1, tickets: 1 }), 'من 18 جلسة في خطتك، فاتتك جلستين.')
  assert.equal(line({ attended: 13, missed: 5 }), 'من 18 جلسة في خطتك، فاتتك 5 جلسات.')
  assert.equal(line({ attended: 16, ahead: 2 }), 'من 18 جلسة في خطتك، باقي جلستين.')
  assert.equal(line({ attended: 15, missed: 1, ahead: 2 }), 'من 18 جلسة في خطتك، فاتتك وحدة، وباقي جلستين.')
  assert.equal(line({ attended: 20, extra: 2 }), 'حضرت كل جلسات خطتك، وزدت عليها جلستين.')
  assert.equal(line({ planned: 0, attended: 3 }), 'حضرت 3 جلسات هالشهر.')
})

test('the calendar sentence names the days that went missing', () => {
  const cal = (...kinds) => kinds.map((k, i) => day(`2026-03-${String(18 + i).padStart(2, '0')}`, k, k !== 'rest'))
  assert.equal(calendarLine(cal('trained', 'rest', 'trained')), 'مشيت على خطتك الشهر كله.')
  assert.equal(calendarLine(cal('trained', 'paid', 'trained')), 'مشيت على خطتك، إلا الخميس 19.',
    'a ticket held the streak, but the session still did not happen — as the cover says')
  assert.equal(calendarLine(cal('miss', 'rest', 'trained')), 'مشيت على خطتك، إلا الأربعاء 18.')
  assert.equal(calendarLine(cal('miss', 'rest', 'miss')), 'مشيت على خطتك، إلا يومين: الأربعاء 18 والجمعة 20.')
  assert.equal(calendarLine(cal('miss', 'miss', 'miss', 'miss')), 'فاتك 4 أيام من خطتك هالشهر.')
  assert.equal(calendarLine(cal('trained', 'ahead')), 'مشيت على خطتك لين اليوم.')
  assert.equal(calendarLine([]), '')
})

test('«صرت أقوى؟» in one line', () => {
  assert.equal(strongerLine(0), 'ما تعدّيت أثقل وزن لك في ولا تمرين هالشهر.')
  assert.equal(strongerLine(1), 'وزنك زاد في تمرين واحد.')
  assert.equal(strongerLine(2), 'وزنك زاد في تمرينين.')
  assert.equal(strongerLine(3), 'وزنك زاد في 3 تمارين.')
})

// ══ one lift, week by week ════════════════════════════════════

test('nine weeks, oldest first, the last one ending on the month\'s last day', () => {
  const w = weeklyTop([], 'Bench Press', 9, { end: '2026-03-31' })
  assert.equal(w.length, 9)
  assert.equal(w[8].to, '2026-03-31')
  assert.equal(w[8].from, '2026-03-25')
  assert.equal(w[0].from, '2026-01-28', 'nine whole weeks back')
  assert.ok(w.every(x => x.top === null), 'no history is no line, not zeros')
})

test('each week keeps its heaviest ticked set, nothing typed and nothing light', () => {
  const s = [
    on(MAR, 2, 'Bench Press', [[60, 10], [65, 8]]),
    on(MAR, 4, 'Bench Press', [[70, 5], [100, 1, false]]),      // 100 was never lifted
    on(MAR, 26, 'Bench Press', three(40), { deload: { pct: 40, from: '2026-03-25', until: '2026-03-31' } }),
    on(MAR, 9, 'Squat', [[140, 5]], { muscle: 'Legs' }),        // another lift
  ]
  const w = weeklyTop(s, 'Bench Press', 9, { end: '2026-03-31' })
  const wk = (to) => w.find(x => x.to === to)
  assert.equal(wk('2026-03-03').top, 65)
  assert.equal(wk('2026-03-10').top, 70, 'the unticked 100 is not a top')
  assert.equal(wk('2026-03-31').top, null, 'the deload week has no top')
  assert.equal(wk('2026-03-31').deloadTop, 40, 'its weight is kept apart, to be drawn hollow')
  assert.equal(wk('2026-03-31').deload, true)
})

test('an alias in the mapping is the same lift', () => {
  const s = [on(MAR, 2, 'Bench', [[80, 5]])]
  const w = weeklyTop(s, 'Bench Press', 9, { end: '2026-03-31', mapping: { Bench: 'Bench Press' } })
  assert.equal(w.find(x => x.top !== null)?.top, 80)
})

// ══ what went up ══════════════════════════════════════════════

const FEB = '2026-02'

test('a gain is measured against the best before the month', () => {
  const g = liftGains([
    on(FEB, 10, 'Bench Press', [[70, 8]]),
    on(MAR, 3, 'Bench Press', [[72.5, 8]]),
    on(MAR, 17, 'Bench Press', [[82.5, 5]]),
    on(MAR, 24, 'Bench Press', [[80, 6]]),
  ], MAR)
  assert.equal(g.length, 1)
  assert.equal(g[0].before, 70)
  assert.equal(g[0].top, 82.5)
  assert.equal(g[0].gain, 12.5)
  assert.equal(g[0].date, '2026-03-17', 'the day it was first lifted')
  assert.equal(g[0].steps, 3, 'three sessions above February\'s best')
})

test('deload sessions count on neither side', () => {
  const dl = { pct: 40, from: '2026-02-20', until: '2026-02-26' }
  const g = liftGains([
    on(FEB, 10, 'Bench Press', [[70, 8]]),
    on(FEB, 22, 'Bench Press', [[90, 8]], { deload: dl }),     // stamped: cannot raise the bar
    on(MAR, 5, 'Bench Press', [[75, 8]]),
    on(MAR, 28, 'Bench Press', [[95, 8]], { deload: { pct: 40, from: '2026-03-25', until: '2026-03-31' } }),
  ], MAR)
  assert.equal(g[0].before, 70, 'the deload session is not the bar')
  assert.equal(g[0].top, 75, 'and a deload session is not the new weight')
  assert.equal(g[0].gain, 5)
})

test('a lift that did not go up is listed with no gain, not dropped', () => {
  const g = liftGains([
    on(FEB, 10, 'Squat', [[120, 5]], { muscle: 'Legs' }),
    on(FEB, 12, 'Bench Press', [[60, 8]]),
    on(MAR, 3, 'Squat', [[115, 5]], { muscle: 'Legs' }),
    on(MAR, 5, 'Bench Press', [[65, 8]]),
  ], MAR)
  assert.deepEqual(g.map(x => [x.lift, x.gain]), [['bench press', 5], ['squat', 0]])
  assert.equal(g[1].before, 120)
  assert.equal(g[1].top, 115, 'the month\'s own heaviest, for «هالشهر 115 · أثقل وزن لك 120»')
  assert.deepEqual(newWeights(g).map(p => p.exercise), ['Bench Press'], 'only the lift that went up is a new weight')
})

test('a lift first done this month starts from its first session', () => {
  const g = liftGains([
    on(MAR, 2, 'Lat Pulldown', [[50, 10]], { muscle: 'Back' }),
    on(MAR, 9, 'Lat Pulldown', [[55, 10]], { muscle: 'Back' }),
    on(MAR, 4, 'Leg Press', [[150, 10]], { muscle: 'Legs' }),
  ], MAR)
  const lat = g.find(x => x.lift === 'lat pulldown')
  const leg = g.find(x => x.lift === 'leg press')
  assert.equal(lat.firstTime, true)
  assert.equal(lat.before, 50)
  assert.equal(lat.gain, 5)
  assert.equal(leg.gain, 0, 'one session is a starting point, not a gain')
})

test('a session after the month cannot change it', () => {
  const g = liftGains([
    on(FEB, 10, 'Bench Press', [[70, 8]]),
    on(MAR, 3, 'Bench Press', [[70, 8]]),
    on('2026-04', 2, 'Bench Press', [[90, 8]]),
  ], MAR)
  assert.equal(g[0].gain, 0)
})

// ══ sets per muscle per week ══════════════════════════════════

test('completed sets per muscle, per week of the month', () => {
  // March is 31 days: 31 / 7 weeks. 44 back sets ≈ 9.9 a week.
  const s = []
  for (let d = 1; d <= 22; d++) s.push(on(MAR, d, 'Barbell Row', [[50, 10], [50, 10]], { muscle: 'Back' }))
  for (let d = 1; d <= 30; d++) s.push(on(MAR, d, 'Bench Press', three(60).map(x => [...x]), { muscle: 'Chest' }))
  const m = muscleSets([on(FEB, 27, 'Bench Press', three(60)), ...s], MAR, { today: TODAY, firstEver: '2026-02-27' })
  const back = m.find(x => x.key === 'Back')
  const chest = m.find(x => x.key === 'Chest')
  assert.equal(back.sets, 44)
  assert.equal(back.perWeek, 9.9)
  assert.equal(back.shown, 10, 'drawn as a whole number')
  assert.equal(back.status, 'ok', 'judged on the 10 it shows, not on 9.9')
  assert.equal(chest.perWeek, Math.round((90 / (31 / 7)) * 10) / 10)
  assert.equal(chest.perWeek, 20.3)
  assert.equal(chest.status, 'ok', '20.3 is drawn as 20, the top of the range')
  assert.deepEqual([WEEKLY_SETS.min, WEEKLY_SETS.max], [10, 20], 'the plan builder\'s range')
})

test('in the month he started, the weeks count from his first session', () => {
  // First session ever on the 18th: two weeks of March, not four and a half.
  const s = [18, 20, 22, 25, 27, 29, 31].map(d => on(MAR, d, 'Squat', three(100), { muscle: 'Legs' }))
  const [legs] = muscleSets(s, MAR, { today: TODAY, firstEver: '2026-03-18' })
  assert.equal(legs.sets, 21)
  assert.equal(legs.perWeek, Math.round((21 / 2) * 10) / 10)
  assert.equal(legs.status, 'ok')
})

test('the muscles sentence names who fell short', () => {
  const m = (key, label, status, perWeek = 5) => ({ key, label, status, perWeek })
  assert.equal(musclesLine([m('Chest', 'الصدر', 'ok', 14)]), 'كل عضلاتك أخذت حقها.')
  assert.equal(musclesLine([m('Chest', 'الصدر', 'ok', 14), m('Back', 'الظهر', 'low', 6)]), 'الظهر أخذ أقل من حقه.')
  assert.equal(musclesLine([m('Back', 'الظهر', 'low', 6), m('Legs', 'الأرجل', 'low', 4)]), 'الأرجل والظهر أخذوا أقل من حقهم.')
  assert.equal(musclesLine([m('A', 'أ', 'low'), m('B', 'ب', 'low'), m('C', 'ج', 'low')]), '3 عضلات أخذت أقل من حقها.')
  assert.equal(musclesLine([{ key: 'Other', label: 'أخرى', status: null }]), '', 'nothing judged, nothing said')
})

// ══ next month: three things at most ══════════════════════════

// Held 12 at 60 twice, then reached 15 on every set: the engine says raise.
const readyToRaise = (name, muscle = 'Chest') => [
  on(MAR, 2, name, three(60, 12), { muscle }),
  on(MAR, 9, name, three(60, 12), { muscle }),
  on(MAR, 16, name, three(60, 15), { muscle }),
]
// Missed the bottom of the range twice at 100: the engine says lower.
const tooHeavy = (name, muscle = 'Legs') => [
  on(MAR, 4, name, three(100, 8), { muscle }),
  on(MAR, 11, name, three(100, 7), { muscle }),
]

test('a lift ready to go up becomes «ارفع», with its reason', () => {
  const plan = nextMonthPlan({ sessions: readyToRaise('Bench Press'), month: MAR })
  assert.equal(plan.length, 1)
  assert.equal(plan[0].kind, 'raise')
  const c = nextCopy(plan[0])
  assert.equal(c.title, 'ارفع وزن ضغط بنش بالبار', 'called by its Arabic name')
  assert.equal(c.reason, 'وصلت 15 عدّة على 60 كجم، فالوزن صار خفيف عليك.')
})

test('a lift that keeps missing becomes «نزّل», to the engine\'s own weight', () => {
  const plan = nextMonthPlan({ sessions: tooHeavy('Barbell Squat'), month: MAR })
  assert.equal(plan[0].kind, 'lower')
  assert.equal(plan[0].to, 90)
  const c = nextCopy(plan[0])
  assert.equal(c.title, 'نزّل سكوات بالبار إلى 90 كجم')
  assert.equal(c.reason, 'ما وصلت 12 عدّة على 100 كجم مرتين ورا بعض.')
  // A lift the app has no Arabic name for keeps the one he typed.
  assert.equal(nextCopy({ ...plan[0], exercise: 'Hack Pendulum' }).title, 'نزّل Hack Pendulum إلى 90 كجم')
})

test('a muscle under the range becomes «زِد مجموعات»', () => {
  const c = nextCopy({ kind: 'sets', muscle: 'Back', label: 'الظهر', perWeek: 6.2, min: 10, max: 20 })
  assert.equal(c.title, 'زِد مجموعات الظهر')
  assert.equal(c.reason, 'الظهر أخذ 6 مجموعات بالأسبوع، والمناسب من 10 إلى 20.')
  assert.match(nextCopy({ kind: 'sets', label: 'الكور', perWeek: 0.4, min: 10, max: 20 }).reason, /أقل من مجموعة/)
})

test('never more than three, and one of each kind before a second of any', () => {
  const sessions = [
    ...readyToRaise('Bench Press'), ...readyToRaise('Incline Dumbbell Press'),
    ...readyToRaise('Shoulder Press', 'Shoulders'), ...tooHeavy('Squat'),
  ]
  const muscles = [{ key: 'Back', label: 'الظهر', status: 'low', perWeek: 3 }]
  const plan = nextMonthPlan({ sessions, month: MAR, muscles })
  assert.equal(plan.length, MAX_NEXT)
  assert.deepEqual(plan.map(p => p.kind), ['raise', 'sets', 'lower'],
    'three raises cannot bury the muscle being skipped or the lift that stalled')
})

test('an old month gives the advice it would have given then', () => {
  // In April he raised the bench and stalled on it. March's report still
  // says what March said: raise.
  const later = [
    on('2026-04', 2, 'Bench Press', three(62.5, 8)),
    on('2026-04', 6, 'Bench Press', three(62.5, 8)),
  ]
  const plan = nextMonthPlan({ sessions: [...readyToRaise('Bench Press'), ...later], month: MAR })
  assert.equal(plan[0]?.kind, 'raise')
})

test('a deload at the end of the month does not turn into «نزّل»', () => {
  const dl = { pct: 40, from: '2026-03-25', until: '2026-03-31' }
  const plan = nextMonthPlan({
    sessions: [
      ...readyToRaise('Bench Press'),
      on(MAR, 26, 'Bench Press', three(35, 8), { deload: dl }),
      on(MAR, 30, 'Bench Press', three(35, 6), { deload: dl }),
    ],
    month: MAR,
  })
  assert.deepEqual(plan.map(p => p.kind), ['raise'], 'the light week is not a failure to reach the reps')
})

// ══ the month's goal ══════════════════════════════════════════

test('the goal lives under its own new key, one entry per month', () => {
  assert.equal(MONTH_GOAL_KEY, 'hf_month_goal')
  const g = withMonthGoal({ '2026-02': { kind: 'sessions', target: 12 } }, '2026-03', { target: 16 })
  assert.deepEqual(g, { '2026-02': { kind: 'sessions', target: 12 }, '2026-03': { kind: 'sessions', target: 16 } })
  assert.deepEqual(withMonthGoal(g, '2026-03', null), { '2026-02': { kind: 'sessions', target: 12 } })
  assert.deepEqual(withMonthGoal({}, 'March', { target: 3 }), {}, 'a month key is YYYY-MM or nothing')
  const before = { '2026-02': { kind: 'sessions', target: 12 } }
  withMonthGoal(before, '2026-03', { target: 9 })
  assert.deepEqual(Object.keys(before), ['2026-02'], 'never edited in place')
})

test('anything stored that is not a sessions goal is ignored, not guessed', () => {
  assert.equal(monthGoalOf({ '2026-03': { kind: 'weight', target: 85 } }, '2026-03'), null)
  assert.equal(monthGoalOf({ '2026-03': { kind: 'sessions', target: 0 } }, '2026-03'), null)
  assert.equal(monthGoalOf({ '2026-03': 'sixteen' }, '2026-03'), null)
  assert.equal(monthGoalOf(null, '2026-03'), null)
  assert.deepEqual(monthGoalOf({ '2026-03': { kind: 'sessions', target: '16' } }, '2026-03'), { kind: 'sessions', target: 16 })
})

test('the goal is reached on the day of the target-th session', () => {
  const cal = [3, 5, 8, 12].map(d => day(`2026-03-${String(d).padStart(2, '0')}`, 'trained', true))
  assert.deepEqual(goalResult({ kind: 'sessions', target: 3 }, cal),
    { kind: 'sessions', target: 3, done: 4, reached: true, reachedOn: '2026-03-08', left: 0 })
  assert.equal(goalResult({ kind: 'sessions', target: 6 }, cal).left, 2)
  assert.equal(goalResult(null, cal), null)
  assert.equal(goalLine(goalResult({ kind: 'sessions', target: 3 }, cal)), 'هدفك 3 جلسات، ووصلته يوم 8 مارس.')
  assert.equal(goalLine(goalResult({ kind: 'sessions', target: 6 }, cal)), 'هدفك كان 6 جلسات، وناقصك جلستين.')
  assert.equal(goalLine(goalResult({ kind: 'sessions', target: 6 }, cal), { over: false }), 'هدفك 6 جلسات، باقي لك جلستين.')
})

test('the report reads the goal it was given for its own month', () => {
  const s = [1, 3, 5].map(d => on(MAR, d, 'Bench Press', three(60)))
  const r = build(s, { goals: { [MAR]: { kind: 'sessions', target: 3 }, [nextMonth(MAR)]: { kind: 'sessions', target: 20 } } })
  assert.equal(r.goal.target, 3)
  assert.equal(r.goal.reached, true)
  assert.equal(build(s).goal, null, 'no goal set, no goal line')
})

// ══ past months ═══════════════════════════════════════════════

test('every month with a session, newest first, none after the one being offered', () => {
  const s = [
    on('2025-12', 4, 'Bench Press', three(50)),
    on('2026-01', 9, 'Bench Press', three(55)),
    on(MAR, 2, 'Bench Press', three(60)),
    on('2026-04', 1, 'Bench Press', three(60)),   // April is still running
  ]
  assert.deepEqual(reportMonths(s, MAR), ['2026-03', '2026-01', '2025-12'], 'February had nothing, April is not over')
})

test('six months of training days for the picker, oldest first', () => {
  const s = [
    on('2025-08', 4, 'Bench Press', three(45)),          // seven months back: outside
    on('2025-11', 4, 'Bench Press', three(50)),
    on('2026-01', 9, 'Bench Press', three(55)),
    on('2026-01', 9, 'Squat', three(80), { muscle: 'Legs' }),   // same day: one day
    on('2026-01', 11, 'Bench Press', three(55)),
    on(MAR, 2, 'Bench Press', three(60)),
  ]
  assert.deepEqual(monthsTrail(s, MAR, 6), [
    { month: '2025-10', attended: 0 }, { month: '2025-11', attended: 1 },
    { month: '2025-12', attended: 0 }, { month: '2026-01', attended: 2 },
    { month: '2026-02', attended: 0 }, { month: '2026-03', attended: 1 },
  ])
  assert.deepEqual(monthsTrail(s, '2026-01', 2).map(x => x.month), ['2025-12', '2026-01'], 'over the turn of the year')
  // Someone who started in January is not shown four empty months first.
  const fresh = s.filter(x => x.date >= '2026-01')
  assert.deepEqual(monthsTrail(fresh, MAR, 6).map(x => x.month), ['2026-01', '2026-02', '2026-03'])
  assert.deepEqual(monthsTrail([], MAR, 6), [{ month: MAR, attended: 0 }])
})

test('any past month builds its own full report', () => {
  const s = [
    ...[5, 7, 9].map(d => on('2026-01', d, 'Bench Press', three(55))),
    ...[2, 4].map(d => on(MAR, d, 'Bench Press', three(60))),
  ]
  const jan = build(s, { month: '2026-01' })
  assert.equal(jan.hasData, true)
  assert.equal(jan.monthLabel, 'يناير 2026')
  assert.equal(jan.attendance.attended, 3)
  assert.equal(jan.consistency.running, false)
})

// ══ deload, said once ═════════════════════════════════════════

test('the deload line names the stretch in the month\'s own days', () => {
  const r = deloadRangesIn({ deloadHistory: [{ from: '2026-03-25', plannedUntil: '2026-03-31', until: '2026-03-31' }] }, MAR)
  assert.equal(deloadLine(r, MAR), 'فيه أسبوع تخفيف من 25 إلى 31. خفيف عن قصد، وما ينحسب ضدك.')
})

test('a deload that crosses into the next month is named with both months', () => {
  const r = deloadRangesIn({ deloadHistory: [{ from: '2026-03-28', plannedUntil: '2026-04-03', until: '2026-04-03' }] }, MAR)
  assert.equal(deloadLine(r, MAR), 'فيه أسبوع تخفيف من 28 مارس إلى 3 أبريل. خفيف عن قصد، وما ينحسب ضدك.')
  assert.deepEqual(deloadRangesIn({ deloadHistory: [{ from: '2026-04-05', until: '2026-04-11' }] }, MAR), [], 'April\'s deload is not March\'s')
})

test('a deload cut short is the days it ran, and the stamp alone is enough', () => {
  const short = deloadRangesIn({ deloadHistory: [{ from: '2026-03-10', plannedUntil: '2026-03-16', until: '2026-03-12' }] }, MAR)
  assert.equal(deloadLine(short, MAR), 'فيه تخفيف من 10 إلى 12. خفيف عن قصد، وما ينحسب ضدك.')
  const stamped = on(MAR, 20, 'Bench Press', three(40), { deload: { pct: 40, from: '2026-03-18', until: '2026-03-24' } })
  assert.deepEqual(deloadRangesIn({}, MAR, [stamped]), [{ from: '2026-03-18', to: '2026-03-24' }])
})

// ══ four whole months ═════════════════════════════════════════

test('a month that ENDS in a deload week', () => {
  // Bench climbs through March 23, then the last week is a 40% taper.
  const dl = { pct: 40, from: '2026-03-25', until: '2026-03-31' }
  const config = { ...CFG, deloadHistory: [{ from: '2026-03-25', plannedUntil: '2026-03-31', until: '2026-03-31', pct: 40, endedEarly: false }] }
  const s = [
    on(FEB, 20, 'Bench Press', three(60)),
    ...[1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23].map((d, i) => on(MAR, d, 'Bench Press', three(60 + i * 2.5))),
    ...[25, 27, 29, 31].map(d => on(MAR, d, 'Bench Press', three(37.5), { deload: dl })),
  ]
  const r = build(s, { config })

  // Showing up: the taper sessions are attended, drawn blue.
  assert.equal(r.attendance.planned, 16)
  assert.equal(r.attendance.attended, 16)
  assert.equal(r.attendance.missed, 0)
  assert.equal(r.attendance.slots.filter(x => x.deload).length, 4)
  assert.equal(attendanceLine(r.attendance), 'حضرت كل جلسات خطتك هالشهر.')
  assert.equal(deloadLine(r.deload.ranges, MAR), 'فيه أسبوع تخفيف من 25 إلى 31. خفيف عن قصد، وما ينحسب ضدك.')

  // The light week is outside the light scale.
  const tail = r.consistency.calendar.filter(d => d.date >= '2026-03-25')
  assert.ok(tail.every(d => d.deload), 'the whole last week is rimmed')
  assert.ok(tail.every(d => d.level === null))
  assert.equal(r.consistency.calendar.find(d => d.date === '2026-03-01').level, 1, 'the lightest ORDINARY day is the bottom')

  // Stronger: the taper is not a step back, and not a new weight.
  assert.equal(r.prs.length, 1)
  assert.equal(r.prs[0].weight, 87.5)
  assert.equal(r.prs[0].prevBest, 60)
  assert.equal(r.gains.every(g => g.gain >= 0), true)

  // The line: the last week is the deload column, hollow at 37.5.
  const last = r.jump.weekly[8]
  assert.equal(last.to, '2026-03-31')
  assert.equal(last.top, null)
  assert.equal(last.deloadTop, 37.5)
  assert.equal(r.jump.weekly[7].top, 87.5)

  // And next month's advice is not «نزّل».
  assert.ok(!r.next.some(n => n.kind === 'lower'), JSON.stringify(r.next))
})

test('a month with no new weight', () => {
  const s = [
    on(FEB, 10, 'Bench Press', three(80)),
    on(FEB, 12, 'Squat', three(120), { muscle: 'Legs' }),
    ...[2, 9, 16, 23].map(d => on(MAR, d, 'Bench Press', three(77.5))),
    ...[4, 11, 18].map(d => on(MAR, d, 'Squat', three(120), { muscle: 'Legs' })),
  ]
  const r = build(s)
  assert.deepEqual(r.prs, [])
  assert.equal(r.jump, null, 'no «أكبر قفزة» without a new weight')
  assert.equal(r.gains.length, 2, 'both lifts still answer «صرت أقوى؟» — with «ما زاد»')
  assert.ok(r.gains.every(g => g.gain === 0))
  assert.deepEqual(r.gains.map(g => [g.lift, g.before, g.top]), [['bench press', 80, 77.5], ['squat', 120, 120]])
})

test('a month before any history', () => {
  const s = [on(MAR, 18, 'Bench Press', three(60)), on(MAR, 25, 'Bench Press', three(62.5))]

  // February came before the first session: nothing to report, and it
  // is not offered as a past month.
  const feb = build(s, { month: FEB })
  assert.equal(feb.hasData, false)
  assert.equal(feb.sessionCount, 0)
  assert.deepEqual(reportMonths(s, MAR), [MAR])

  // March is the first month: the days before the first session are
  // not misses, the first weight is a starting point, the line has no
  // weeks before it, and the weeks are counted from the 18th.
  const r = build(s)
  assert.equal(r.consistency.calendar.filter(d => d.date < '2026-03-18').every(d => d.kind === 'none'), true)
  assert.equal(r.attendance.missed, r.consistency.calendar.filter(d => d.kind === 'miss').length)
  assert.ok(r.consistency.calendar.filter(d => d.date < '2026-03-18').every(d => !d.planned), 'no plan before he started')
  assert.equal(r.prs.length, 1)
  assert.equal(r.prs[0].prevBest, 60, 'measured from the first session, not from zero')
  assert.ok(r.jump.weekly.slice(0, 6).every(w => w.top === null))
  assert.equal(r.muscles[0].perWeek, Math.round((6 / 2) * 10) / 10, 'six sets over two weeks of March, not 4.4')
})

test('month boundaries follow the local 03:00 day, not UTC', () => {
  // 01:30 on 1 April in Riyadh is still the night of 31 March (the day
  // turns at 03:00). 03:30 on 1 April is April. 23:30 on 31 March is
  // 20:30 UTC — March either way.
  const late = at(2026, 4, 1, 1, 'Bench Press', three(90), { min: 30 })
  const early = at(2026, 4, 1, 3, 'Bench Press', three(95), { min: 30 })
  const night = at(2026, 3, 31, 23, 'Squat', three(140), { muscle: 'Legs', min: 30 })
  const s = [on(FEB, 10, 'Bench Press', three(80)), on(FEB, 10, 'Squat', three(130), { muscle: 'Legs' }), late, early, night]

  assert.equal(monthKey(late.date), MAR)
  assert.equal(monthKey(early.date), '2026-04')
  assert.equal(monthKey(night.date), MAR)

  const r = build(s)
  assert.equal(r.sessionCount, 2, 'the 01:30 session and the 23:30 one')
  assert.equal(r.consistency.calendar.find(d => d.date === '2026-03-31').kind, 'trained')
  assert.equal(r.prs.find(p => p.lift === 'bench press').weight, 90, 'the 03:30 95 belongs to April')
  assert.equal(r.prs.find(p => p.lift === 'bench press').date, '2026-03-31')
  assert.equal(weeklyTop(s, 'Bench Press', 9, { end: lastDayOf(MAR) })[8].top, 90)
  assert.equal(r.muscles.find(m => m.key === 'Chest').sets, 3)

  const apr = build(s, { month: '2026-04' })
  assert.equal(apr.sessionCount, 1)
  assert.equal(apr.prs[0]?.weight, 95)
  assert.equal(apr.prs[0]?.prevBest, 90, 'March\'s late-night 90 was the bar to beat')
})

test('counting words follow the app\'s rule', () => {
  assert.equal(countWord(1, 'set'), 'مجموعة وحدة')
  assert.equal(countWord(2, 'set'), 'مجموعتين')
  assert.equal(countWord(6, 'set'), '6 مجموعات')
  assert.equal(countWord(14, 'set'), '14 مجموعة')
  assert.equal(countWord(3, 'thing'), '3 أشياء')
  assert.equal(countWord(15, 'rep'), '15 عدّة')
})

// ══ a streak reset after the month ════════════════════════════
// A second plan change inside 30 days resets the streak. A reset that
// came after the month had not happened when the month closed: it must
// not zero that month's «الستريك آخر <شهر>», nor turn its tickets into
// misses, nor drop the streak from the poster.

const everyOtherDay = () => {
  const s = []
  for (let d = 1; d <= 27; d += 2) s.push(on(FEB, d, 'Bench Press', three(60)))
  for (let d = 1; d <= 31; d += 2) s.push(on(MAR, d, 'Bench Press', three(d >= 15 ? 65 : 60)))
  return s
}

test('a reset after the month leaves that month\'s streak as it closed', async () => {
  const s = everyOtherDay()
  const plain = build(s, { today: '2026-04-03' })
  assert.equal(plain.consistency.endStreak, 59, 'February 1 to March 31, all kept')

  const later = build(s, { today: '2026-04-03', config: { ...CFG, streakResetAt: '2026-04-02' } })
  assert.equal(later.consistency.endStreak, 59, 'an April reset does not reach back into March')
  assert.equal(later.consistency.endStreak, plain.consistency.endStreak)

  const feb = build(s, { month: FEB, today: '2026-04-03', config: { ...CFG, streakResetAt: '2026-03-20' } })
  assert.equal(feb.consistency.endStreak, 28, 'February\'s streak, before the March reset')

  const nextDay = build(s, { today: '2026-04-03', config: { ...CFG, streakResetAt: '2026-04-01' } })
  assert.equal(nextDay.consistency.endStreak, 59, 'a reset on the first of the next month is still after it')

  // A reset inside the month still counts from the day after it.
  const inside = build(s, { today: '2026-04-03', config: { ...CFG, streakResetAt: '2026-03-20' } })
  assert.equal(inside.consistency.endStreak, 11, 'March 21 to 31')

  const { posterFigures } = await import('../src/reportPoster.js')
  const figs = posterFigures(later, { liveStreak: 1, today: '2026-04-03' }).figs
  assert.ok(figs.some(f => f.flame && f.v === '59'), JSON.stringify(figs))
})

test('a ticket spent in the month stays a ticket after a later reset', () => {
  const s = everyOtherDay().filter(x => monthKey(x.date) !== MAR || new Date(x.date).getDate() !== 9)
  const plain = build(s, { today: '2026-05-12' })
  const reset = build(s, { today: '2026-05-12', config: { ...CFG, streakResetAt: '2026-05-10' } })
  const kind = (r) => r.consistency.calendar.find(d => d.date === '2026-03-09').kind
  assert.equal(kind(plain), 'paid')
  assert.equal(kind(reset), 'paid', 'the May reset does not turn March\'s ticket into a miss')
  assert.equal(reset.consistency.endStreak, plain.consistency.endStreak)
})

// ══ a deload ended early ══════════════════════════════════════
// Each session's stamp carries the end that was planned when it began.
// When the deload was cut short, the stored history says where it
// really stopped, and the cover must say what the calendar rims.

test('a deload ended early ends where the history says, not where its stamps planned', () => {
  const dl = { pct: 40, from: '2026-03-25', until: '2026-03-31' }
  const s = [
    ...[1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23].map(d => on(MAR, d, 'Bench Press', three(60))),
    on(MAR, 25, 'Bench Press', three(40), { deload: dl }),
    on(MAR, 27, 'Bench Press', three(40), { deload: dl }),
    on(MAR, 29, 'Bench Press', three(65)),
    on(MAR, 31, 'Bench Press', three(65)),
  ]
  const config = { ...CFG, deload: null, deloadHistory: [{ from: '2026-03-25', plannedUntil: '2026-03-31', until: '2026-03-27', pct: 40, endedEarly: true }] }
  const r = build(s, { config, today: '2026-04-03' })
  assert.deepEqual(r.deload.ranges, [{ from: '2026-03-25', to: '2026-03-27' }])
  assert.equal(deloadLine(r.deload.ranges, MAR), 'فيه تخفيف من 25 إلى 27. خفيف عن قصد، وما ينحسب ضدك.')
  const rimmed = r.consistency.calendar.filter(d => d.deload).map(d => d.date)
  assert.deepEqual(rimmed, ['2026-03-25', '2026-03-26', '2026-03-27'], 'the calendar rims the days the cover names')
  assert.equal(r.deload.days, 3)

  // The same stamps with the history lost (an import): the ordinary
  // session on the 29th shows the deload was over by then.
  const stampsOnly = build(s, { config: CFG, today: '2026-04-03' })
  assert.deepEqual(stampsOnly.deload.ranges, [{ from: '2026-03-25', to: '2026-03-27' }])
  assert.deepEqual(stampsOnly.consistency.calendar.filter(d => d.deload).map(d => d.date), rimmed)
})

test('a deload run to term keeps its whole week, from the stamp alone too', () => {
  const dl = { pct: 40, from: '2026-03-18', until: '2026-03-24' }
  const s = [on(MAR, 16, 'Bench Press', three(60)), on(MAR, 20, 'Bench Press', three(40), { deload: dl }), on(MAR, 26, 'Bench Press', three(60))]
  const r = build(s, { today: '2026-04-03' })
  assert.deepEqual(r.deload.ranges, [{ from: '2026-03-18', to: '2026-03-24' }], 'no ordinary session inside it: the planned end stands')
  assert.equal(r.consistency.calendar.filter(d => d.deload).length, 7, 'and the calendar rims the same seven days')
  assert.equal(deloadLine(r.deload.ranges, MAR), 'فيه أسبوع تخفيف من 18 إلى 24. خفيف عن قصد، وما ينحسب ضدك.')
})

// ══ a muscle is judged on the number it shows ═════════════════

/** `n` single back sets spread over March (31 days = 31/7 weeks). */
const backSets = (n) => [...Array(n)].map((_, i) => on(MAR, 1 + (i % 31), 'Lat Pulldown', [[50, 10]], { muscle: 'Back' }))

test('a muscle at 9.5–9.9 sets a week reads «10», in range — never «10 · أقل من اللازم»', () => {
  const r = build(backSets(43), { today: '2026-04-03' })
  const back = r.muscles.find(m => m.key === 'Back')
  assert.equal(back.sets, 43)
  assert.equal(back.perWeek, 9.7)
  assert.equal(back.shown, 10)
  assert.equal(back.status, 'ok')
  assert.ok(!r.next.some(n => n.kind === 'sets'), 'no «زِد مجموعات الظهر» at 10 a week')
  assert.equal(musclesLine(r.muscles), 'كل عضلاتك أخذت حقها.')

  const half = muscleSets(backSets(42), MAR, { today: TODAY })[0]
  assert.equal(half.perWeek, 9.5)
  assert.deepEqual([half.shown, half.status], [10, 'ok'], 'half rounds up, as the screen does')

  // 9.3 is drawn as 9: under the range, and the reason says 9.
  const low = muscleSets(backSets(41), MAR, { today: TODAY })
  assert.equal(low[0].perWeek, 9.3)
  assert.deepEqual([low[0].shown, low[0].status], [9, 'low'])
  const [item] = nextMonthPlan({ sessions: [], month: MAR, muscles: low })
  assert.match(nextCopy(item).reason, /أخذ(ت)? 9 مجموعات بالأسبوع/)

  // And over the top only when the shown number is over 20.
  assert.equal(muscleSets(backSets(93), MAR, { today: TODAY })[0].status, 'high', '21 a week')
})
