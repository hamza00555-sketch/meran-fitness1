// Specs for completing a set, run against the real ES module.
//
//   node --test tests/set-carry.test.mjs
//
// The bug these pin down: a session pre-fills every set from history,
// so on a familiar lift all the boxes arrive filled. On an exercise
// with no history — a plan just started, an exercise added mid-session,
// a swapped machine — every set is blank, and completing one used to
// leave the next one blank too. Each rest ended on two empty boxes and
// the weight just lifted had to be typed again from memory.
//
// Carrying forward fixes that, but it must not destroy intent: a
// deliberate ramp, an already-logged set, and an un-tick all have to
// survive it.

import test from 'node:test'
import assert from 'node:assert/strict'

// utils.js reads a reset watermark out of localStorage at import time.
globalThis.localStorage = {
  _d: new Map(),
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null },
  setItem(k, v) { this._d.set(k, String(v)) },
  removeItem(k) { this._d.delete(k) },
  clear() { this._d.clear() },
  key(i) { return [...this._d.keys()][i] ?? null },
  get length() { return this._d.size },
}

const { markSetDone } = await import('../src/utils.js')

const blank = () => ({ weight: '', reps: '', done: false })

test('it marks the set done', () => {
  const out = markSetDone([blank(), blank()], 0, true)
  assert.equal(out[0].done, true)
})

test('what you just lifted fills the blank sets after it', () => {
  const sets = [{ weight: '80', reps: '12', done: false }, blank(), blank()]
  const out = markSetDone(sets, 0, true)
  assert.deepEqual(
    out.map(s => [s.weight, s.reps]),
    [['80', '12'], ['80', '12'], ['80', '12']],
  )
})

test('a deliberate ramp is never overwritten', () => {
  const sets = [
    { weight: '60', reps: '12', done: false },
    { weight: '70', reps: '10', done: false },
    blank(),
  ]
  const out = markSetDone(sets, 0, true)
  assert.deepEqual(out[1], { weight: '70', reps: '10', done: false })
  assert.deepEqual(out[2], { weight: '60', reps: '12', done: false })
})

test('a half-filled set keeps the half it has', () => {
  const sets = [{ weight: '80', reps: '12', done: false }, { weight: '', reps: '8', done: false }]
  const out = markSetDone(sets, 0, true)
  assert.equal(out[1].weight, '80')
  assert.equal(out[1].reps, '8')
})

test('sets already logged are left alone', () => {
  const sets = [
    { weight: '50', reps: '10', done: true },
    { weight: '80', reps: '12', done: false },
    blank(),
  ]
  const out = markSetDone(sets, 1, true)
  assert.deepEqual(out[0], { weight: '50', reps: '10', done: true })
  assert.deepEqual(out[2], { weight: '80', reps: '12', done: false })
})

test('it never writes backwards', () => {
  const sets = [blank(), { weight: '80', reps: '12', done: false }, blank()]
  const out = markSetDone(sets, 1, true)
  assert.deepEqual(out[0], blank())
})

test('un-ticking a set changes nothing but the tick', () => {
  const sets = [{ weight: '80', reps: '12', done: true }, blank()]
  const out = markSetDone(sets, 0, false)
  assert.equal(out[0].done, false)
  assert.deepEqual(out[1], blank())
})

test('completing a blank set carries nothing and crashes nothing', () => {
  const out = markSetDone([blank(), blank()], 0, true)
  assert.deepEqual(out[1], blank())
})

test('whitespace and undefined both count as blank', () => {
  const sets = [{ weight: '80', reps: '12', done: false }, { weight: '  ', reps: undefined, done: false }]
  const out = markSetDone(sets, 0, true)
  assert.equal(out[1].weight, '80')
  assert.equal(out[1].reps, '12')
})

test('an index that is not there returns the sets untouched', () => {
  const sets = [blank()]
  assert.equal(markSetDone(sets, 5, true), sets)
})

// ══ Only what happened counts ═════════════════════════════════
//
// Reported from real use: a leg day read 10.1 tons beside "10 sets".
// The ten ticked sets come to 7,185 kg. The other 2.9 tons were three
// exercises never started, still carrying the planner's suggested
// weights — and the old rule counted any set with a weight in it.

const { sessionVolume, setCounts, keepDone } = await import('../src/utils.js')

const set = (w, r, done = true) => ({ weight: String(w), reps: String(r), done })
const LEG_DAY = {
  id: 1, date: '2026-09-19T18:00:00.000Z', duration: 36,
  exercises: [
    { name: 'Goblet Squat', muscle: 'Legs', sets: [set(20, 12, false), set(20, 12, false), set(20, 12, false)] },
    { name: 'Leg Press', muscle: 'Legs', sets: [set(65, 15), set(75, 15), set(75, 15), set(75, 15)] },
    { name: 'Leg Curl', muscle: 'Legs', sets: [set(35, 15), set(35, 15), set(35, 15)] },
    { name: 'Leg Extension', muscle: 'Legs', sets: [set(35, 12), set(35, 12), set(35, 12)] },
    { name: 'Bulgarian Split Squat', muscle: 'Legs', sets: [set(20, 10, false), set(20, 10, false), set(20, 10, false)] },
    { name: 'Calf Raise', muscle: 'Legs', sets: [set(60, 15, false), set(60, 15, false), set(60, 15, false)] },
  ],
}

test('the reported leg day weighs what was lifted: 7,185 kg', () => {
  assert.equal(sessionVolume(LEG_DAY), 7185)
})

test('a set with a weight in it but no tick is not a set', () => {
  assert.equal(setCounts(set(100, 10, false)), false)
  assert.equal(sessionVolume({ exercises: [{ sets: [set(100, 10, false)] }] }), 0)
})

test('keepDone drops the skipped exercises and the unticked sets', () => {
  const kept = keepDone(LEG_DAY)
  assert.deepEqual(kept.exercises.map(e => e.name), ['Leg Press', 'Leg Curl', 'Leg Extension'])
  assert.ok(kept.exercises.every(e => e.sets.every(s => s.done)))
  assert.equal(sessionVolume(kept), 7185)
  assert.equal(kept.duration, 36, 'the rest of the session is untouched')
})

test('keepDone of a session where nothing was done is null — nothing to save', () => {
  assert.equal(keepDone({ exercises: [{ sets: [set(50, 10, false)] }] }), null)
})
