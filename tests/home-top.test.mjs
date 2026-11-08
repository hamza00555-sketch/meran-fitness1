// The top of Home (src/homeTop.js): the streak, or what Hamza chose
// instead — «ابغى الخيار اني اقدر استبدل معلومة الكم يوم استريك عندي
// بمعلومة ثانية … الاوزان … سكرولينج ما بين الاوزان».
//
//   node --test tests/home-top.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

globalThis.localStorage = {
  _d: new Map(),
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null },
  setItem(k, v) { this._d.set(k, String(v)) },
  removeItem(k) { this._d.delete(k) },
  clear() { this._d.clear() },
  key(i) { return [...this._d.keys()][i] ?? null },
  get length() { return this._d.size },
}

const { bestWeights, monthNumbers, newBestsIn, levelNow, homeTopOf, HOME_TOPS, HOME_TOP_KEY } = await import('../src/homeTop.js')
const { PER_USER_KEYS, xpProgress } = await import('../src/utils.js')

const at = (d) => new Date(`2026-11-${String(d).padStart(2, '0')}T18:00:00+03:00`)
const lift = (d, list, extra = {}) => ({
  id: at(d).getTime(), date: at(d).toISOString(),
  exercises: list.map(([name, w]) => ({ name, muscle: 'Chest', sets: [{ weight: String(w), reps: '10', done: true }] })),
  ...extra,
})
const PLAN = { weeklySchedule: [
  { name: 'Push', exercises: [{ name: 'Bench Press' }, { name: 'Pec Deck' }] },
  { name: 'Legs', exercises: [{ name: 'Leg Press' }, { name: 'Leg Curl' }] },
] }

test('the choices: the streak by default, and the three he picked', () => {
  assert.deepEqual(HOME_TOPS.map(t => t.id), ['streak', 'weights', 'month', 'level'])
  assert.equal(homeTopOf('weights'), 'weights')
  assert.equal(homeTopOf('nonsense'), 'streak')
  assert.equal(homeTopOf(undefined), 'streak')
})

test('weights: his best in each plan exercise, today\'s day first, lifted ones only', () => {
  const sessions = [
    lift(2, [['Bench Press', 80], ['Leg Press', 120]]),
    lift(4, [['Bench Press', 85], ['Leg Press', 110], ['Pec Deck', 50]]),
  ]
  // plan index 1: today is Legs, then Push; Leg Curl never lifted — left out
  assert.deepEqual(bestWeights({ plan: PLAN, planIndex: 1, sessions }), [
    { name: 'Leg Press', kg: 120 }, { name: 'Bench Press', kg: 85 }, { name: 'Pec Deck', kg: 50 },
  ])
  assert.deepEqual(bestWeights({ plan: PLAN, planIndex: 2, sessions }).map(w => w.name), ['Bench Press', 'Pec Deck', 'Leg Press'])
})

test('weights: a deload\'s light session is never his best', () => {
  const sessions = [lift(2, [['Bench Press', 80]]), lift(4, [['Bench Press', 100]], { deload: { pct: 40, from: '2026-11-04', until: '2026-11-10' } })]
  assert.deepEqual(bestWeights({ plan: PLAN, planIndex: 0, sessions }), [{ name: 'Bench Press', kg: 80 }])
})

test('weights: with no plan, the exercises of his sessions', () => {
  const sessions = [lift(4, [['Bench Press', 85], ['Bench Press', 85]])]
  assert.deepEqual(bestWeights({ plan: null, sessions }), [{ name: 'Bench Press', kg: 85 }])
})

test('the month: sessions against his goal, tons, new bests', () => {
  const oct = { id: new Date('2026-10-20T18:00:00+03:00').getTime(), date: new Date('2026-10-20T18:00:00+03:00').toISOString(),
    exercises: [{ name: 'Bench Press', sets: [{ weight: '80', reps: '10', done: true }] }] }
  const nov = [lift(2, [['Bench Press', 85]]), lift(5, [['Bench Press', 90]])]
  const all = [oct, ...nov]
  const goals = { '2026-11': { kind: 'sessions', target: 12 } }
  const out = monthNumbers({ sessions: all, today: '2026-11-08', goals })
  assert.deepEqual(out.map(x => x.id), ['sessions', 'tons', 'records'])
  assert.deepEqual([out[0].value, out[0].of, out[0].label], [2, 12, 'هدف الشهر'])
  assert.equal(out[1].value, 1.8, '850 + 900 kg = 1.75 t, shown to one decimal')
  assert.deepEqual([out[2].value, out[2].unit], [1, 'وزن جديد'], 'Bench beat its best, counted once')
  const plain = monthNumbers({ sessions: all, today: '2026-11-08', goals: {} })
  assert.deepEqual([plain[0].value, plain[0].of, plain[0].unit, plain[0].label], [2, undefined, 'جلسات', 'هالشهر'])
})

test('the month: nothing yet is still a number, not an empty place', () => {
  const out = monthNumbers({ sessions: [], today: '2026-11-08', goals: {} })
  assert.deepEqual(out.map(x => [x.id, x.value]), [['sessions', 0]])
})

test('new bests: the first time an exercise is lifted is no record; deloads never are', () => {
  const s = [lift(2, [['Leg Press', 100]]), lift(4, [['Leg Press', 110]], { deload: { pct: 40 } }), lift(6, [['Leg Press', 100]])]
  assert.equal(newBestsIn(s, '2026-11'), 0)
  assert.equal(newBestsIn([...s, lift(8, [['Leg Press', 105]])], '2026-11'), 1)
})

test('the level: as the app counts it, and what is left', () => {
  for (const xp of [0, 900, 9200, 40000]) {
    const p = xpProgress(xp), l = levelNow(xp)
    assert.equal(l.level, p.level)
    assert.equal(l.left, p.neededXP - p.currentXP)
    assert.ok(l.frac >= 0 && l.frac <= 1)
  }
})

test('the choice is per user, and the old design never reads it', async () => {
  assert.equal(HOME_TOP_KEY, 'meran_home_top')
  assert.ok(PER_USER_KEYS.includes(HOME_TOP_KEY))
  const classic = await readFile(new URL('../classic/src/utils.js', import.meta.url), 'utf8').catch(() => '')
  assert.ok(!classic.includes(HOME_TOP_KEY))
})
