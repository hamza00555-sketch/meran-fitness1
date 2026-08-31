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
  mediaSlotFor, animSlotFor, arabicName, equipLabel, wordSetKey,
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

// ── The word-set fallback ─────────────────────────────────────
//
// People type the same movement with the words in a different order, a
// singular where the catalogue has a plural, or the handle named as
// part of the exercise. That used to fall past every rung of the media
// ladder and land on a generic emoji.

test('the same words in another order find the same artwork', () => {
  assert.equal(mediaSlotFor('Rope Triceps Pushdown'), 'ex_triceps_pushdown')
  assert.equal(
    mediaSlotFor('Overhead Cable Triceps Extension'),
    mediaSlotFor('Cable Overhead Triceps Extension'),
  )
})

test('tricep and triceps are the same word, and rope is a handle', () => {
  // The exact name that sent حمزة's screenshot to a generic emoji.
  assert.equal(mediaSlotFor('Tricep Rope Pushdown'), 'ex_triceps_pushdown')
  assert.equal(arabicName('Tricep Rope Pushdown'), arabicName('Triceps Pushdown'))
})

test('exercises that differ by equipment or position never share a picture', () => {
  // Each of these is a real, distinct movement. Matching one to a
  // neighbour would show the wrong machine mid-set, which is worse
  // than showing nothing at all.
  for (const name of [
    'Cable Chest Press', 'Chest Press Machine', 'Close Grip Bench Press',
    'Seated Calf Raise', 'Smith Machine Bench Press',
  ]) {
    assert.equal(mediaSlotFor(name), null, name)
  }
})

test('an explicit row always beats the fallback', () => {
  assert.equal(mediaSlotFor('Bench Press'), 'ex_bench_press')
  assert.equal(mediaSlotFor('Incline Bench Press'), 'ex_incline_bench_press')
})

test('no two catalogue exercises collide on the word-set key', () => {
  // The guard that keeps the fallback safe as the catalogue grows: if
  // a new exercise is ever ambiguous with an existing one, it fails
  // here rather than showing the wrong artwork in the gym.
  const seen = new Map()
  const collisions = []
  for (const name of Object.keys(EXERCISE_MEDIA)) {
    const key = wordSetKey(name)
    if (seen.has(key)) collisions.push([seen.get(key), name])
    seen.set(key, name)
  }
  assert.deepEqual(collisions, [])
})

test('the key ignores order, case and punctuation but nothing else', () => {
  assert.equal(wordSetKey('Seated Cable Row'), wordSetKey('cable seated row'))
  assert.equal(wordSetKey('Push-Up'), wordSetKey('push up'))
  assert.notEqual(wordSetKey('Standing Calf Raise'), wordSetKey('Seated Calf Raise'))
  assert.equal(wordSetKey(''), '')
  assert.equal(wordSetKey(null), '')
})
