// Records inside a session (src/components/player/records.js).
// حمزة: «انا ابا احتفالية وكأس مدام رفعت الوزن الجديد» — every set at a
// new weight that day is a record, and the coach never suggests less
// than he already lifted today.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { prSetsOf, todayTopOf, raiseAdvice } from '../src/components/player/records.js'

const set = (w, r, done = true) => ({ weight: String(w), reps: String(r), done })
// His Machine Shoulder Press: last time 40×12; today 40×15, 45×12, 45×12, 45×12.
const HIS = [set(40, 15), set(45, 12), set(45, 12), set(45, 12)]

test('every done set above the best before today is a record — not only the first', () => {
  assert.deepEqual(prSetsOf(HIS, 40), [1, 2, 3])
  assert.deepEqual(prSetsOf(HIS.slice(0, 3), 40), [1, 2])
})

test('a set at the old best, an unticked set, a deload or a first time is no record', () => {
  assert.deepEqual(prSetsOf([set(40, 15)], 40), [])
  assert.deepEqual(prSetsOf([set(40, 15), set(45, 12, false)], 40), [])
  assert.deepEqual(prSetsOf(HIS, 40, 10), [])
  assert.deepEqual(prSetsOf(HIS, null), [])
})

test('heavier again later in the session: every set above the old best still counts', () => {
  assert.deepEqual(prSetsOf([set(45, 12), set(47.5, 10), set(45, 12)], 40), [0, 1, 2])
})

test('today\'s heaviest done set', () => {
  assert.equal(todayTopOf([]), null)
  assert.equal(todayTopOf([set(45, 12, false)]), null)
  assert.equal(todayTopOf(HIS.slice(0, 2)), 45)
  assert.equal(todayTopOf([set(45, 12), set(40, 15)]), 45)
})

test('the coach: «جرّب 42.5» until he has lifted that or more today, then hold today\'s weight', () => {
  assert.deepEqual(raiseAdvice(42.5, null), { kind: 'try', kg: 42.5 })
  assert.deepEqual(raiseAdvice(42.5, 40), { kind: 'try', kg: 42.5 })      // after 40×15
  assert.deepEqual(raiseAdvice(42.5, 45), { kind: 'hold', kg: 45 })       // after 45×12: never 42.5
  assert.deepEqual(raiseAdvice(42.5, 42.5), { kind: 'hold', kg: 42.5 })
  assert.equal(raiseAdvice(null, 45), null)
})
