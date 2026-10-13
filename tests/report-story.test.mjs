// Specs for the report as a story (phases 3–5), run against the real
// modules with no browser:
//
//   node --test tests/report-story.test.mjs
//
// which cards a month gets and which are dropped, whether the story was
// seen, the charts' geometry (time right to left, gold above the old
// best, a deload week hollow and unjoined), the before/after pair, the
// month goal (sessions by default, a lift weight too), and what
// «طبّقها على خطتي» writes — only fields the old design reads.

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

const S = await import('../src/reportStory.js')
const R = await import('../src/monthReport.js')
const {
  REPORT_SEEN_KEY, storySeen, withStorySeen, storyCards, CARD_ORDER, CARD_MS,
  liftRows, liftsLine, liftScale, muscleScale, jumpChart, goalSteps, beforeAfter, BA_MIN_DAYS,
  goalEditable, liftGoalOptions, applyNext, appliedLine, sessionsPerWeek, calendarPad, ringArcs,
} = S
const { buildMonthReport, withMonthGoal, monthGoalOf, goalResult, goalLine, expectedSessions } = R

// ── Fixtures ──────────────────────────────────────────────────

const CFG = { daysPerWeek: 4, overrides: [], restDays: [] }
let seq = 0
const on = (month, d, name, sets, opts = {}) => {
  const [y, m] = month.split('-').map(Number)
  const date = new Date(y, m - 1, d, 18, 0, 0)
  return {
    id: date.getTime() + (++seq),
    date: date.toISOString(),
    duration: 50,
    ...(opts.deload ? { deload: opts.deload } : {}),
    exercises: [{
      id: `e${seq}`, muscle: opts.muscle || 'Chest', name,
      sets: sets.map(([w, r]) => ({ weight: String(w), reps: String(r), done: true })),
    }],
  }
}
const three = (w, r = 12) => [[w, r], [w, r], [w, r]]
const MAR = '2026-03'
const build = (sessions, extra = {}) =>
  buildMonthReport({ sessions, config: CFG, month: MAR, today: '2026-04-02', ...extra })

// February at 70, March climbing to 82.5 on the 19th, plus a squat that went up.
const benchMonth = () => [
  ...[3, 10, 17, 24].map(d => on('2026-02', d, 'Bench Press', three(70))),
  on(MAR, 3, 'Bench Press', three(72.5)),
  on(MAR, 10, 'Bench Press', three(75)),
  on(MAR, 19, 'Bench Press', three(82.5)),
  on(MAR, 26, 'Bench Press', three(80)),
  on('2026-02', 5, 'Barbell Squat', three(100), { muscle: 'Legs' }),
  on(MAR, 5, 'Barbell Squat', three(110), { muscle: 'Legs' }),
  on('2026-02', 6, 'Lat Pulldown', three(55), { muscle: 'Back' }),
  on(MAR, 6, 'Lat Pulldown', three(55), { muscle: 'Back' }),
]

// ══ seen ══════════════════════════════════════════════════════

test('the story is seen once per month, under its own new key', () => {
  assert.equal(REPORT_SEEN_KEY, 'hf_report_seen')
  assert.equal(storySeen({}, MAR), false)
  assert.equal(storySeen(null, MAR), false)
  const seen = withStorySeen({ '2026-02': true }, MAR)
  assert.deepEqual(seen, { '2026-02': true, [MAR]: true })
  assert.equal(storySeen(seen, MAR), true)
  assert.equal(storySeen(seen, '2026-04'), false)
  assert.deepEqual(withStorySeen([1], 'March'), {}, 'junk in, nothing marked')
  const before = { '2026-02': true }
  withStorySeen(before, MAR)
  assert.deepEqual(before, { '2026-02': true }, 'never edited in place')
})

// ══ which cards ═══════════════════════════════════════════════

test('a full month has all nine cards, in the approved order', () => {
  const r = build(benchMonth(), { goals: { [MAR]: { kind: 'sessions', target: 8 } } })
  const cards = storyCards(r, { pair: { before: {}, after: {} } })
  assert.deepEqual(cards, CARD_ORDER)
  for (const c of cards) assert.ok(c in CARD_MS)
  assert.equal(CARD_MS.share, 0, 'the last card waits for him')
  const total = cards.reduce((n, c) => n + CARD_MS[c], 0)
  assert.ok(total >= 50_000 && total <= 65_000, `about a minute, got ${total}`)
})

test('cards with nothing to say are dropped', () => {
  // No new weight: no «أكبر قفزة». No photos: no «قبل وبعد». No goal: no «هدف الشهر».
  const flat = [on('2026-02', 3, 'Bench Press', three(80)), on(MAR, 3, 'Bench Press', three(80)), on(MAR, 10, 'Bench Press', three(75))]
  const r = build(flat)
  assert.equal(r.jump, null)
  assert.deepEqual(storyCards(r), ['cover', 'cal', 'lifts', 'muscles', 'next', 'share'])
  assert.deepEqual(storyCards({ hasData: false }), [])
})

test('«صرت أقوى؟» leaves the biggest jump to its own card', () => {
  const r = build(benchMonth())
  assert.equal(r.jump.lift, 'bench press')
  const rows = liftRows(r)
  assert.ok(!rows.some(x => x.lift === 'bench press'))
  assert.deepEqual(rows.map(x => [x.lift, x.gain, x.up]), [['barbell squat', 10, true], ['lat pulldown', 0, false]])
  assert.equal(liftsLine(r), 'ووزنك زاد في تمرين ثاني.')
  const only = build(benchMonth().filter(s => s.exercises[0].name === 'Bench Press'))
  assert.deepEqual(liftRows(only), [], 'nothing else trained: the card is dropped')
  assert.ok(!storyCards(only).includes('lifts'))
})

test('the lifts sentence counts in Arabic', () => {
  const gains = (n) => ({ jump: { lift: 'x' }, gains: [{ lift: 'x', gain: 9 }, ...Array.from({ length: n }, (_, i) => ({ lift: `l${i}`, gain: 2.5 }))] })
  assert.equal(liftsLine(gains(2)), 'ووزنك زاد في تمرينين ثانيين.')
  assert.equal(liftsLine(gains(3)), 'ووزنك زاد في 3 تمارين ثانية.')
  assert.equal(liftsLine(gains(11)), 'ووزنك زاد في 11 تمرين ثاني.')
  assert.equal(liftsLine({ jump: null, gains: [{ lift: 'a', gain: 0 }] }), 'ما تعدّيت أثقل وزن لك في ولا تمرين هالشهر.')
})

test('the gain bars share one ruler with room past its end', () => {
  assert.deepEqual(liftScale([{ gain: 10 }, { gain: 5 }]), { top: 10, ticks: [0, 5, 10], max: 12 })
  assert.deepEqual(liftScale([{ gain: 2.5 }]).ticks, [0, 2.5])
  assert.equal(liftScale([{ gain: 17.5 }]).top, 20)
  assert.equal(liftScale([]).top, 2.5)
  assert.equal(muscleScale([{ shown: 16 }]), 24, 'past the band')
  assert.equal(muscleScale([{ shown: 31 }]), 36)
})

// ══ the jump, week by week ════════════════════════════════════

test('the jump chart: time right to left, gold above the old best, the dot on its week', () => {
  const r = build(benchMonth())
  const c = jumpChart(r.jump, MAR)
  assert.equal(c.prior, 70)
  // Oldest week on the right.
  const xs = c.pts.map(p => p.x)
  assert.ok(xs.every((x, i) => i === 0 || x < xs[i - 1]), xs.join(','))
  assert.equal(c.pr.v, 82.5)
  assert.equal(c.pr.date, '2026-03-19')
  const prWeek = r.jump.weekly.findIndex(w => w.from <= '2026-03-19' && '2026-03-19' <= w.to)
  assert.equal(c.pr.i, prWeek)
  // Above the line is gold: «up» dots are all heavier than 70.
  assert.ok(c.pts.filter(p => p.kind === 'up').every(p => p.v > 70))
  assert.ok(c.pts.filter(p => p.kind === 'pt').every(p => p.v <= 70))
  assert.ok(c.refY > c.pr.y, 'the old best sits below the new weight')
  // February on the right of the separator, March on the left.
  assert.deepEqual(c.labels.map(l => l.text), ['فبراير', 'مارس'])
  assert.ok(c.labels[0].x > c.sep && c.labels[1].x < c.sep)
  assert.ok(c.ticks.length >= 2 && c.ticks.every(t => t.y >= 0 && t.y <= 100))
})

test('a deload week is hollow and never joined to the line', () => {
  const dl = { pct: 40, from: '2026-03-23', until: '2026-03-29' }
  const s = [...benchMonth().filter(x => !(x.exercises[0].name === 'Bench Press' && x.date.startsWith('2026-03-26'))),
    on(MAR, 26, 'Bench Press', three(50), { deload: dl })]
  const r = build(s)
  const c = jumpChart(r.jump, MAR)
  const hollow = c.pts.filter(p => p.kind === 'dl')
  assert.equal(hollow.length, 1)
  assert.equal(hollow[0].v, 50)
  assert.ok(!c.line.includes(`${hollow[0].x} ${hollow[0].y}`), 'not on the line')
  assert.equal(c.deloads.length, 1, 'its week gets the blue band')
})

// ══ the goal ══════════════════════════════════════════════════

test('the goal climbs a step a session and is reached on its day', () => {
  const cal = [2, 5, 9, 14, 20].map(d => ({ date: `2026-03-${String(d).padStart(2, '0')}`, kind: 'trained' }))
  const g = goalSteps(cal, 4, MAR)
  assert.equal(g.done, 5)
  assert.equal(g.hit.day, 14)
  assert.equal((g.path.match(/V/g) || []).length, 5, 'one step per session')
  assert.ok(g.goalY > 0 && g.goalY < 100)
  assert.ok(g.xTicks[0].x > g.xTicks[1].x, 'the 1st on the right')
  assert.equal(goalSteps(cal, 9, MAR).hit, null, 'not reached, no dot')
})

test('a sessions goal is the default, and a lift goal is kept too', () => {
  const s = withMonthGoal({}, '2026-04', { target: 18 })
  assert.deepEqual(s['2026-04'], { kind: 'sessions', target: 18 })
  const l = withMonthGoal(s, '2026-05', { kind: 'lift', lift: 'bench press', exercise: 'Bench Press', target: 85 })
  assert.deepEqual(monthGoalOf(l, '2026-05'), { kind: 'lift', lift: 'bench press', exercise: 'Bench Press', target: 85 })
  assert.equal(monthGoalOf({ m: 1, '2026-05': { kind: 'lift', target: 85 } }, '2026-05'), null, 'a lift goal names its lift')
})

test('a lift goal: reached on the first session at the weight, deloads left out', () => {
  const r = build(benchMonth(), { goals: { [MAR]: { kind: 'lift', lift: 'bench press', exercise: 'Bench Press', target: 80 } } })
  assert.equal(r.goal.kind, 'lift')
  assert.equal(r.goal.reached, true)
  assert.equal(r.goal.reachedOn, '2026-03-19')
  assert.equal(r.goal.best, 82.5)
  assert.equal(goalLine(r.goal), 'هدفك 80 كجم في ضغط بنش بالبار، ووصلته يوم 19 مارس.')
  const short = build(benchMonth(), { goals: { [MAR]: { kind: 'lift', lift: 'bench press', exercise: 'Bench Press', target: 90 } } })
  assert.equal(short.goal.reached, false)
  assert.equal(short.goal.left, 7.5)
  assert.equal(goalLine(short.goal), 'هدفك كان 90 كجم في ضغط بنش بالبار، وأثقل وزن رفعته 82.5 كجم.')
  assert.equal(goalLine(short.goal, { over: false }), 'هدفك 90 كجم في ضغط بنش بالبار، باقي لك 7.5 كجم.')
  const dl = { pct: 40, from: '2026-03-18', until: '2026-03-20' }
  const lifted = goalResult({ kind: 'lift', lift: 'bench press', exercise: 'Bench Press', target: 85 },
    [], { sessions: [on(MAR, 19, 'Bench Press', three(90), { deload: dl })], month: MAR })
  assert.equal(lifted.reached, false, 'a deload session does not reach a weight goal')
})

test('the goal offered for next month is the plan\'s own sessions', () => {
  assert.equal(expectedSessions({ daysPerWeek: 4 }, '2026-04'), 20, '2 on 1 off over 30 days')
  assert.equal(expectedSessions({ daysPerWeek: 3 }, '2026-02'), 14)
  assert.equal(expectedSessions({ daysPerWeek: 5 }, '2026-03'), 22)
  assert.ok(Math.abs(sessionsPerWeek({ daysPerWeek: 4 }) - 14 / 3) < 1e-9)
})

test('a goal is only set for a month that has not ended', () => {
  assert.equal(goalEditable(MAR, '2026-04-02'), true, 'April is this month')
  assert.equal(goalEditable(MAR, '2026-03-30'), true)
  assert.equal(goalEditable('2026-02', '2026-04-02'), false, 'March is over')
})

test('the weight goal offers his own lifts, one plate past their best', () => {
  const opts = liftGoalOptions(build(benchMonth()))
  assert.equal(opts[0].lift, 'bench press')
  assert.equal(opts[0].best, 82.5)
  assert.equal(opts[0].target, 85)
})

// ══ before and after ══════════════════════════════════════════

test('before/after needs two photos three weeks apart in the month', () => {
  const p = (id, iso) => ({ id, date: `${iso}T10:00:00.000Z`, src: 'data:image/jpeg;base64,AA', note: '' })
  assert.equal(beforeAfter([], MAR), null)
  assert.equal(beforeAfter([p(1, '2026-03-02')], MAR), null, 'one photo')
  assert.equal(beforeAfter([p(1, '2026-03-02'), p(2, '2026-03-20')], MAR), null, '18 days')
  const ok = beforeAfter([p(3, '2026-03-28'), p(1, '2026-03-02'), p(2, '2026-03-15'), p(9, '2026-04-02')], MAR)
  assert.equal(ok.before.id, 1)
  assert.equal(ok.after.id, 3)
  assert.equal(ok.days, 26)
  assert.ok(ok.days >= BA_MIN_DAYS)
  assert.equal(beforeAfter([p(1, '2026-03-01'), { ...p(2, '2026-03-30'), src: '' }], MAR), null, 'a photo needs its image')
})

// ══ «طبّقها على خطتي» ═════════════════════════════════════════

const PLAN = {
  planName: 'PPL', durationWeeks: 6,
  weeklySchedule: [
    { name: 'Push', exercises: [{ muscle: 'Chest', name: 'Bench Press', sets: 4, repsMin: 8, repsMax: 12 }] },
    { name: 'Pull', exercises: [{ muscle: 'Back', name: 'Lat Pulldown', sets: 3 }, { muscle: 'Biceps', name: 'Barbell Curl', sets: 2 }] },
    { name: 'Legs', exercises: [{ muscle: 'Legs', name: 'Barbell Squat', sets: 4 }] },
  ],
}

test('raise and lower write the weight the next session starts at', () => {
  const items = [
    { kind: 'raise', exercise: 'Bench Press', weight: 82.5, to: 85 },
    { kind: 'lower', exercise: 'Barbell Squat', weight: 110, to: 100 },
  ]
  const before = { 'bench press': 82.5, 'lat pulldown': 55 }
  const out = applyNext({ plan: PLAN, lastWeights: before, items })
  assert.deepEqual(out.lastWeights, { 'bench press': 85, 'lat pulldown': 55, 'barbell squat': 100 })
  assert.deepEqual(before, { 'bench press': 82.5, 'lat pulldown': 55 }, 'never edited in place')
  assert.equal(out.changes.length, 2)
  assert.equal(typeof out.lastWeights['bench press'], 'number', 'a number, as a finished session writes it')
})

test('a muscle under the range gets sets added to its plan exercises', () => {
  const item = { kind: 'sets', muscle: 'Biceps', label: 'البايسبس', perWeek: 3.1, shown: 3, min: 10, max: 20 }
  const out = applyNext({ plan: PLAN, items: [item], config: { daysPerWeek: 4 } })
  const curl = out.plan.weeklySchedule[1].exercises[1]
  assert.ok(curl.sets > 2 && curl.sets <= 5, String(curl.sets))
  assert.equal(PLAN.weeklySchedule[1].exercises[1].sets, 2, 'the old plan is untouched (undo)')
  assert.equal(out.changes[0].kind, 'sets')
  assert.equal(out.changes[0].added, curl.sets - 2)
  // Every field the old design reads keeps its type and its name.
  for (const d of out.plan.weeklySchedule) {
    for (const e of d.exercises) {
      assert.equal(typeof e.name, 'string')
      assert.equal(typeof e.muscle, 'string')
      assert.ok(Number.isInteger(e.sets))
    }
  }
  assert.deepEqual(Object.keys(out.plan), Object.keys(PLAN))
  assert.equal(out.plan.weeklySchedule[0].exercises[0].repsMin, 8, 'what it does not touch stays')
})

test('a muscle the plan has no exercise for is said, not invented', () => {
  const item = { kind: 'sets', muscle: 'Triceps', label: 'الترايسبس', perWeek: 2, shown: 2, min: 10, max: 20 }
  const out = applyNext({ plan: PLAN, items: [item] })
  assert.equal(out.changes.length, 0)
  assert.equal(out.skipped[0].why, 'not-in-plan')
  assert.equal(appliedLine(out), 'ما تغيّر شي في خطتك. ما في خطتك تمرين لـالترايسبس.')
  assert.equal(applyNext({ plan: null, items: [item] }).skipped.length, 1, 'no plan at all')
})

test('the toast counts what changed', () => {
  assert.equal(appliedLine({ changes: [{}] }), 'تغيّر شي واحد في خطتك.')
  assert.equal(appliedLine({ changes: [{}, {}, {}] }), 'تغيّرت 3 أشياء في خطتك.')
})

// ══ small pieces ══════════════════════════════════════════════

test('the calendar starts under the 1st\'s weekday, Sunday first', () => {
  assert.equal(calendarPad('2026-03'), 0, '1 March 2026 is a Sunday')
  assert.equal(calendarPad('2026-04'), 3, '1 April 2026 is a Wednesday')
})

test('one dash per planned session, the lit ones counted in order', () => {
  const slots = [{ state: 'done' }, { state: 'missed' }, { state: 'done', deload: true }]
  const arcs = ringArcs(slots)
  assert.equal(arcs.length, 3)
  assert.deepEqual(arcs.map(a => a.i), [0, 0, 1])
  assert.ok(arcs.every(a => a.d.startsWith('M')))
  assert.equal(ringArcs([{ state: 'done' }]).length, 1)
})

test('sets are never added to a timed move (the builder\'s cardio)', () => {
  const plan = { weeklySchedule: [{ name: 'Legs', exercises: [
    { muscle: 'Legs', name: 'Treadmill Walk', sets: 1, repsMin: 20, repsMax: 20, unit: 'min' },
    { muscle: 'Legs', name: 'Barbell Squat', sets: 3 },
  ] }] }
  const item = { kind: 'sets', muscle: 'Legs', label: 'الأرجل', perWeek: 3, shown: 3, min: 10, max: 20 }
  const out = applyNext({ plan, items: [item], config: { daysPerWeek: 4 } })
  assert.equal(out.plan.weeklySchedule[0].exercises[0].sets, 1)
  assert.ok(out.plan.weeklySchedule[0].exercises[1].sets > 3)
})
