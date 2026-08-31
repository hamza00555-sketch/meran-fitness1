// Specs for what a plan day is called, run against the real ES module.
//
//   node --test tests/plan-day-name.test.mjs
//
// Plan days are stored as "<type> — <muscles>". The muscle list is what
// the day trains, not what the day IS, so the heading shows the type
// and the muscles stay in the day preview.
//
// The case that forced the muscle fallback: plans saved by older
// versions name their days "Day 1", "Day 2". Splitting on the dash
// there yields a number, so every bubble in the progress card read
// "Day" and the hero's heading read "Day 1".

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

const { planDayType, planDayTitle } = await import('../src/utils.js')

const day = (name, muscles = []) => ({ name, exercises: muscles.map(m => ({ muscle: m })) })

test('the type is the label before the dash', () => {
  assert.equal(planDayType(day('Push — صدر، أكتاف، ترايسبس')), 'Push')
  assert.equal(planDayType(day('Legs — أرجل')), 'Legs')
  assert.equal(planDayType(day('Push A — صدر، أكتاف')), 'Push A')
})

test('the heading says it as a day', () => {
  assert.equal(planDayTitle(day('Push — صدر، أكتاف، ترايسبس')), 'Push Day')
  assert.equal(planDayTitle(day('Legs — أرجل')), 'Legs Day')
})

test('a label that is already a day is not doubled', () => {
  assert.equal(planDayTitle(day('Leg Day — أرجل')), 'Leg Day')
})

test('a numbered label falls back to the muscles it trains', () => {
  assert.equal(planDayType(day('Day 1 — صدر، أكتاف', ['Chest', 'Chest', 'Shoulders', 'Triceps'])), 'Push')
  assert.equal(planDayType(day('Day 2 — ظهر، بايسبس', ['Back', 'Back', 'Biceps'])), 'Pull')
  assert.equal(planDayType(day('Day 3 — أرجل', ['Legs', 'Legs', 'Legs'])), 'Legs')
  assert.equal(planDayTitle(day('Day 1 — صدر', ['Chest', 'Shoulders', 'Triceps'])), 'Push Day')
})

test('Arabic numbering is just as generic as English', () => {
  assert.equal(planDayType(day('يوم ٢ — ظهر', ['Back', 'Biceps'])), 'Pull')
})

test('an upper day mixes push and pull without legs', () => {
  assert.equal(planDayType(day('Day 1', ['Chest', 'Back', 'Shoulders', 'Biceps'])), 'Upper')
})

test('legs alongside upper work is a full body day', () => {
  assert.equal(planDayType(day('Day 4', ['Chest', 'Back', 'Legs'])), 'Full Body')
})

test('a legs-dominant day is a legs day even with an accessory', () => {
  assert.equal(planDayType(day('Day 3', ['Legs', 'Legs', 'Legs', 'Chest'])), 'Legs')
})

test('core and cardio never name a day', () => {
  assert.equal(planDayType(day('Day 5', ['Core', 'Cardio'])), 'Day 5')
})

test('a day with nothing to go on does not crash', () => {
  assert.equal(planDayType(undefined), '')
  assert.equal(planDayTitle(undefined), '')
  assert.equal(planDayType(day('')), '')
})

test('a name with no dash is left as it is', () => {
  assert.equal(planDayType(day('Chest Blast')), 'Chest Blast')
})
