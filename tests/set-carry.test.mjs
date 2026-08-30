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
