// Specs for the exercise media map.
//
//   node --test tests/exercise-media.test.mjs
//
// The map is explicit on purpose, and explicitness only helps if a gap
// is loud. These fail the moment a catalogue exercise lacks a row, two
// rows collide on a slug, or an animated name drifts from the map.

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

const { MUSCLE_GROUPS } = await import('../src/constants.js')
const {
  EXERCISE_MEDIA, ANIMATED_EXERCISES, EQUIP_LABELS,
  mediaSlotFor, animSlotFor, arabicName, equipLabel,
} = await import('../src/exerciseMedia.js')

const catalogue = Object.values(MUSCLE_GROUPS).flatMap(g => (g.exercises || []).map(e => e.name))

test('every catalogue exercise has a media row', () => {
  const missing = catalogue.filter(n => !EXERCISE_MEDIA[n])
  assert.deepEqual(missing, [], `no artwork possible for: ${missing.join(', ')}`)
})

test('every row is complete and well-formed', () => {
  for (const [name, row] of Object.entries(EXERCISE_MEDIA)) {
    assert.match(row.slug, /^[a-z0-9_]+$/, `${name} slug`)
    assert.ok(row.ar && row.ar.trim().length >= 3, `${name} arabic name`)
    assert.ok(EQUIP_LABELS[row.equip], `${name} equip '${row.equip}' unknown`)
  }
})

test('slugs never collide', () => {
  const slugs = Object.values(EXERCISE_MEDIA).map(r => r.slug)
  assert.equal(new Set(slugs).size, slugs.length)
})

test('every animated exercise is a real catalogue exercise', () => {
  const bad = ANIMATED_EXERCISES.filter(n => !EXERCISE_MEDIA[n])
  assert.deepEqual(bad, [])
  assert.equal(ANIMATED_EXERCISES.length, 22, 'the approved animation budget')
})

test('lookups resolve, and unknown names stay quiet', () => {
  assert.equal(mediaSlotFor('Bench Press'), 'ex_bench_press')
  assert.equal(animSlotFor('Bench Press'), 'exa_bench_press')
  assert.equal(animSlotFor('Dumbbell Fly'), null, 'no animation for this one')
  assert.equal(arabicName('Pec Deck'), 'تفتيح جهاز (بك دك)')
  assert.equal(equipLabel('Leg Press'), 'جهاز')
  assert.equal(mediaSlotFor('Nonexistent'), null)
  assert.equal(arabicName(''), null)
})

test('a user alias reaches the canonical artwork', () => {
  // resolveExerciseName lowercases through the mapping; the map has to
  // survive that round trip.
  assert.equal(mediaSlotFor('bench press'), 'ex_bench_press')
})
