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
