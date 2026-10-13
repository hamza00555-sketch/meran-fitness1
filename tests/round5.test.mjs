// Regressions from the fifth review round: the report, the planner and
// the session must judge the same plan the same way.
//
//   node --test tests/round5.test.mjs

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

const { nextMonthPlan } = await import('../src/monthReport.js')
const { analyzeProgression, liftRepTarget, planRepTarget, DEFAULT_REP_TARGET } = await import('../src/progression.js')

// September on train-train-rest, every set at the top of a 10–10 range.
function topOfRangeMonth({ withTarget = true } = {}) {
  const out = []
  for (let d = 1; d <= 30; d++) {
    if ((d - 1) % 3 === 2) continue
    const date = `2026-09-${String(d).padStart(2, '0')}T18:00:00`
    out.push({
      id: new Date(date).getTime(), date,
      exercises: [{
        name: 'Lat Pulldown', muscle: 'Back',
        ...(withTarget ? { target: { min: 10, max: 10 } } : null),
        sets: [1, 2, 3].map(() => ({ weight: '50', reps: '10', done: true })),
      }],
    })
  }
  return out.reverse()
}
const PLAN_10 = { weeklySchedule: [{ name: 'A', exercises: [{ name: 'Lat Pulldown', sets: 3, repsMin: 10, repsMax: 10 }] }] }

test('a 10–10 plan range hit at the top never reads as «lower» in the report', () => {
  for (const withTarget of [true, false]) {
    const sessions = topOfRangeMonth({ withTarget })
    const next = nextMonthPlan({ sessions, month: '2026-09', repTarget: DEFAULT_REP_TARGET, plan: PLAN_10 })
    assert.ok(!next.some(n => n.kind === 'lower'), JSON.stringify(next))
    const raise = next.find(n => n.kind === 'raise')
    assert.equal(raise?.exercise, 'Lat Pulldown')
  }
})

test('liftRepTarget: latest session range, then plan, then Settings', () => {
  const sessions = topOfRangeMonth()
  assert.deepEqual(liftRepTarget(sessions, 'Lat Pulldown', {}, { plan: null }), planRepTarget({ repsMin: 10, repsMax: 10 }))
  const bare = topOfRangeMonth({ withTarget: false })
  assert.equal(liftRepTarget(bare, 'Lat Pulldown', {}, { plan: PLAN_10 }).top, 10)
  assert.equal(liftRepTarget(bare, 'Lat Pulldown', {}, { plan: null }), DEFAULT_REP_TARGET)
  // and the deload count reads the same lift as not stalled
  const t = liftRepTarget(bare, 'Lat Pulldown', {}, { plan: PLAN_10 })
  const p = analyzeProgression(bare, 'Lat Pulldown', {}, t)
  assert.ok(!(p.hint === 'lower' || p.failedAtWeight >= 2))
})

const B = await import('../src/plan/builder.js')
const { BUILT_IN_PLANS } = await import('../src/constants.js')

test('his Upper/Lower plan switched to push·pull·legs: every exercise lands on a day that takes it', () => {
  const ul = BUILT_IN_PLANS.find(p => p.planId === 'upper_lower_4day')
  const st = B.fromHfPlan(ul, { days: 4 })
  const cycle = ['push', 'pull', 'legs']
  B.fitPins(st.picks, cycle)
  const plan = B.buildFromPicks({ days: 4, spw: 4.67, goal: 'muscle', eq: st.eq, excluded: new Set(), dismissed: new Set(), picks: st.picks, mtool: {}, cycle, split: 'ppl', keepOrder: true })
  const orphans = plan.days.flatMap(d => d.items.filter(it => it.orphan).map(it => it.id))
  assert.deepEqual(orphans, [])
  // a pin that still fits is kept: Upper A's chest press stays on day 1 (push)
  const st2 = B.fromHfPlan(ul, { days: 4 })
  const chest = st2.picks.find(p => p.day === 0 && B.EXI[p.id].area === 'chest')
  B.fitPins(st2.picks, cycle)
  assert.equal(chest.day, 0)
})

test('opening his plan and saving it unchanged keeps a back-off row and his cardio sets', () => {
  const hf = { planName: 'x', weeklySchedule: [{ name: 'Push — صدر', exercises: [
    { name: 'Bench Press', muscle: 'Chest', sets: 3, repsMin: 8, repsMax: 10 },
    { name: 'Bench Press', muscle: 'Chest', sets: 2, repsMin: 12, repsMax: 15 },
    { name: 'Treadmill Run', muscle: 'Cardio', sets: 3, repsMin: 10, repsMax: 10 },
  ] }] }
  const st = B.fromHfPlan(hf, { days: 3 })
  const cfg = { days: 3, goal: 'muscle', eq: st.eq, excluded: new Set(), dismissed: new Set(), picks: st.picks, mtool: {}, cycle: st.cycle, split: st.split, keepOrder: true }
  const plan = B.buildFromPicks(cfg)
  const back = B.toHfPlan(plan, cfg, { today: '2026-10-13', base: hf })
  const rows = back.weeklySchedule[0].exercises.map(e => `${e.name} ${e.sets}x${e.repsMin}-${e.repsMax}`)
  assert.ok(rows.includes('Bench Press 3x8-10'), rows.join(' | '))
  assert.ok(rows.includes('Bench Press 2x12-15'), rows.join(' | '))
  assert.ok(rows.some(r => r.startsWith('Treadmill Run 3x')), rows.join(' | '))
})

const RS = await import('../src/reportStory.js')

test('«طبّقها» is remembered per month, and its undo forgets it', () => {
  const m = RS.withApplied({}, '2026-09', '2026-10-01')
  assert.equal(RS.appliedOn(m, '2026-09'), '2026-10-01')
  assert.equal(RS.appliedOn(m, '2026-08'), null)
  assert.equal(RS.appliedOn(RS.withApplied(m, '2026-09', null), '2026-09'), null)
  assert.equal(RS.appliedOn([1], '2026-09'), null)
})

test('a story seen before its month is over plays once more when it is', () => {
  const early = RS.withStorySeen({}, '2026-09', '2026-09-29')
  assert.equal(RS.storySeen(early, '2026-09', '2026-09-30'), true, 'seen while the month runs')
  assert.equal(RS.storySeen(early, '2026-09', '2026-10-01'), false, 'the finished month plays again')
  const done = RS.withStorySeen(early, '2026-09', '2026-10-01')
  assert.equal(RS.storySeen(done, '2026-09', '2026-10-05'), true)
  // an old mark (true) stays seen
  assert.equal(RS.storySeen({ '2026-03': true }, '2026-03', '2026-10-01'), true)
})

test('a backup restore hands back the old plan too, and skips a plan both designs could not open', async () => {
  const { restorePlan } = await import('../src/utils.js')
  const plan = { planName: 'A', weeklySchedule: [{ name: 'Push', exercises: [{ name: 'Bench Press', muscle: 'Chest', sets: 3 }] }] }
  const prev = { plan: { ...plan, planName: 'B' }, planIndex: 2, savedAt: '2026-10-01' }
  const back = restorePlan({ plan, planIndex: 4, planPrev: prev })
  assert.deepEqual(back, { plan, planIndex: 4, planPrev: prev })
  assert.equal(restorePlan({ plan: { weeklySchedule: [{ name: 'x', exercises: [] }] } }), null, 'an empty day')
  assert.equal(restorePlan({ plan: { weeklySchedule: [{ name: 'x', exercises: [{ name: 'X', muscle: 'Forearms' }] }] } }), null)
})
