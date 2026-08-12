// Specs for the progression cycle, run against the real ES module.
//
//   node --test tests/progression.test.mjs
//
// The cycle under test, in order:
//   hold 12 twice → "try 15" → 15 on half the sets → "add weight"
//   → new weight starts the cycle over
// and independently: fall short of 12 twice → "drop the weight".

import test from 'node:test'
import assert from 'node:assert/strict'

// analyzeProgression reads a reset watermark out of localStorage.
globalThis.localStorage = {
  _d: new Map(),
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null },
  setItem(k, v) { this._d.set(k, String(v)) },
  removeItem(k) { this._d.delete(k) },
  key(i) { return [...this._d.keys()][i] ?? null },
  get length() { return this._d.size },
}

const { analyzeProgression } = await import('../src/progression.js')

const TARGET = { id: 'volume', base: 12, top: 15 }   // 12 → 15
const NAME = 'Bench Press'

/** A session at one weight. `reps` is per set; `done` defaults to all true. */
let seq = 0
const session = (weight, reps, done = reps.map(() => true)) => ({
  id: ++seq,
  date: new Date(2026, 0, seq).toISOString(),
  exercises: [{
    name: NAME,
    sets: reps.map((r, i) => ({ weight: String(weight), reps: String(r), done: !!done[i] })),
  }],
})

// Newest-first is what the engine sorts to, but callers pass history in
// any order; these helpers pass oldest-first like the real app.
const analyse = (...sessions) => analyzeProgression(sessions, NAME, {}, TARGET)

// ══ the cycle ═════════════════════════════════════════════════

test('a fresh exercise suggests nothing', () => {
  assert.equal(analyse().hint, null)
})

test('one session holding 12 is not yet enough for "try 15"', () => {
  const r = analyse(session(60, [12, 12, 12]))
  assert.equal(r.sessionsAtBase, 1)
  assert.equal(r.inTopPhase, false)
  assert.equal(r.hint, null)
})

test('two sessions holding 12 open the top phase and suggest 15', () => {
  const r = analyse(session(60, [12, 12, 11]), session(60, [12, 12, 12]))
  assert.equal(r.sessionsAtBase, 2)
  assert.equal(r.inTopPhase, true)
  assert.equal(r.hint, 'push')
  assert.equal(r.suggestedReps, 15, 'the reps box aims for the top')
})

test('12 on only a third of the sets does not count as holding it', () => {
  // 1 of 3 reached 12; half of 3 rounds up to 2.
  const r = analyse(session(60, [12, 10, 10]), session(60, [12, 10, 10]))
  assert.equal(r.sessionsAtBase, 0)
  assert.equal(r.hint, 'lower', 'two short sessions is the drop signal')
})

test('once in the top phase, 15 on half the sets suggests more weight', () => {
  const r = analyse(
    session(60, [12, 12, 12]),
    session(60, [12, 12, 12]),
    session(60, [15, 15, 13]),
  )
  assert.equal(r.hint, 'raise')
  assert.equal(r.suggestedReps, 12, 'the new weight restarts at the bottom')
})

test('50% is literal: one of two sets at 15 is enough', () => {
  const r = analyse(
    session(60, [12, 12]),
    session(60, [12, 12]),
    session(60, [15, 12]),
  )
  assert.equal(r.needAtTop, 1)
  assert.equal(r.hint, 'raise')
})

test('hitting 15 before the top phase is open does NOT suggest more weight', () => {
  // Rule 1: landing on a weight never suggests adding more straight away.
  const r = analyse(session(60, [15, 15, 15]))
  assert.equal(r.inTopPhase, false)
  assert.equal(r.hint, null)
})

test('raising the weight starts the cycle over at 12', () => {
  const r = analyse(
    session(60, [12, 12, 12]),
    session(60, [12, 12, 12]),
    session(60, [15, 15, 15]),   // earned the raise at 60
    session(65, [15, 15, 15]),   // first session at 65 — smashed it
  )
  assert.equal(r.workingWeight, 65)
  assert.equal(r.sessionsAtBase, 1, 'the count restarts at the new weight')
  assert.equal(r.inTopPhase, false, 'the top phase does not carry across')
  assert.equal(r.hint, null, 'no raise on the first session at a new weight')
})

test('a second session at the new weight re-opens the top phase', () => {
  const r = analyse(
    session(65, [12, 12, 12]),
    session(65, [15, 15, 15]),
  )
  assert.equal(r.inTopPhase, true)
  assert.equal(r.hint, 'raise')
})

// ══ dropping the weight ═══════════════════════════════════════

test('one short session is not a signal', () => {
  const r = analyse(session(60, [10, 9, 9]))
  assert.equal(r.failedAtWeight, 1)
  assert.equal(r.hint, null)
})

test('two short sessions running suggest dropping the weight', () => {
  const r = analyse(session(60, [10, 9, 9]), session(60, [11, 10, 9]))
  assert.equal(r.failedAtWeight, 2)
  assert.equal(r.hint, 'lower')
  assert.equal(r.suggestedWeight, 55, '10% lighter, rounded to a plate step')
})

test('a good session between two bad ones resets the failure count', () => {
  const r = analyse(
    session(60, [10, 9, 9]),
    session(60, [12, 12, 12]),
    session(60, [10, 9, 9]),
  )
  assert.equal(r.failedAtWeight, 1)
  assert.equal(r.hint, null)
})

test('exactly half reaching 12 counts as holding it, not failing', () => {
  // 2 of 4 → half of 4 is 2 → success.
  const r = analyse(session(60, [12, 12, 10, 10]), session(60, [12, 12, 10, 10]))
  assert.equal(r.failedAtWeight, 0)
  assert.equal(r.hint, 'push')
})

// ══ completed sets only ═══════════════════════════════════════

test('an unticked set is ignored entirely', () => {
  // Three rows typed in, only the two 12s ticked off.
  const r = analyse(session(60, [12, 12, 15], [true, true, false]))
  assert.equal(r.totalSets, 2, 'the unticked set is not counted')
  assert.equal(r.setsAtTop, 0, 'its 15 does not count toward the top')
})

test('a session with nothing ticked does not exist to the engine', () => {
  const r = analyse(
    session(60, [12, 12, 12]),
    session(60, [12, 12, 12], [false, false, false]),
  )
  assert.equal(r.sessionsAtBase, 1, 'only the completed session counts')
  assert.equal(r.inTopPhase, false)
})

test('unticked sets cannot earn the raise', () => {
  const r = analyse(
    session(60, [12, 12, 12]),
    session(60, [12, 12, 12]),
    session(60, [15, 15, 15], [true, false, false]),
  )
  // One completed set at 15, half of one is one → the raise is honest.
  assert.equal(r.totalSets, 1)
  assert.equal(r.hint, 'raise')
})

test('unticked sets cannot trigger a false failure', () => {
  // The ticked sets both hit 12; the unticked shortfalls are noise.
  const r = analyse(
    session(60, [12, 12, 5, 5], [true, true, false, false]),
    session(60, [12, 12, 5, 5], [true, true, false, false]),
  )
  assert.equal(r.failedAtWeight, 0)
  assert.equal(r.hint, 'push')
})

test('unticked sets do not sway the working weight', () => {
  // Two ticked sets at 60, three unticked rows left at 80.
  const r = analyse(session(60, [12, 12], [true, true]))
  assert.equal(r.workingWeight, 60)
  const mixed = {
    id: 999,
    date: new Date(2026, 5, 1).toISOString(),
    exercises: [{
      name: NAME,
      sets: [
        { weight: '60', reps: '12', done: true },
        { weight: '60', reps: '12', done: true },
        { weight: '80', reps: '12', done: false },
        { weight: '80', reps: '12', done: false },
        { weight: '80', reps: '12', done: false },
      ],
    }],
  }
  assert.equal(analyzeProgression([mixed], NAME, {}, TARGET).workingWeight, 60)
})

// ══ the tags can never contradict ═════════════════════════════

test('exactly one hint is ever active', () => {
  const cases = [
    analyse(),
    analyse(session(60, [12, 12, 12])),
    analyse(session(60, [12, 12, 12]), session(60, [12, 12, 12])),
    analyse(session(60, [12, 12, 12]), session(60, [12, 12, 12]), session(60, [15, 15, 15])),
    analyse(session(60, [9, 9, 9]), session(60, [9, 9, 9])),
  ]
  for (const r of cases) {
    const on = [r.readyToIncrease, r.readyToDecrease, r.readyToPush].filter(Boolean)
    assert.ok(on.length <= 1, `two hints at once: ${JSON.stringify(r.hint)}`)
    if (r.hint) assert.equal(on.length, 1)
  }
})
