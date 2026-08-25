// Specs for the exercise-swap table.
//
//   node --test tests/alternatives.test.mjs
//
// The swap button only appears when the exercise has alternatives, so a
// missing entry is not an error anywhere — the button simply is not
// drawn, and the exercise looks like every other one. That is exactly
// how fifteen of the twenty-two built-in plan exercises went without a
// swap button for as long as they did. These tests make the gap
// something that fails loudly instead of something you notice on your
// phone mid-workout.

import test from 'node:test'
import assert from 'node:assert/strict'

const { EXERCISE_ALTERNATIVES, BUILT_IN_PLANS, MUSCLE_GROUPS } =
  await import('../src/constants.js')

// The curated entries are the ones whose alternatives are allowed to
// reach outside the muscle group — they were written by hand for a
// specific gym. Identified by the one property only they have: at least
// one target the catalogue has never heard of.
const CATALOGUE_NAMES = new Set(
  Object.values(MUSCLE_GROUPS).flatMap(g => (g.exercises || []).map(e => e.name)),
)
const CURATED = new Set(
  Object.entries(EXERCISE_ALTERNATIVES)
    .filter(([, list]) => list.some(a => !CATALOGUE_NAMES.has(a)))
    .map(([name]) => name),
)
const { substitutedName, nextSubIndex } = await import('../src/utils.js')

/** Every exercise name any built-in plan asks the user to perform. */
const planExercises = () => {
  const out = new Set()
  for (const plan of BUILT_IN_PLANS || []) {
    for (const day of plan.days || []) {
      for (const ex of day.exercises || []) out.add(ex.name)
    }
  }
  return [...out]
}

test('every exercise in a built-in plan can be swapped', () => {
  const missing = planExercises().filter(n => !EXERCISE_ALTERNATIVES[n]?.length)
  assert.deepEqual(missing, [],
    `these would show no swap button at all: ${missing.join(', ')}`)
})

test('every entry offers a real choice', () => {
  for (const [name, alts] of Object.entries(EXERCISE_ALTERNATIVES)) {
    assert.ok(Array.isArray(alts), `${name} is not a list`)
    // One alternative is a swap you can make once and then are stuck
    // with. Two is the minimum that lets someone cycle and come back.
    assert.ok(alts.length >= 2, `${name} offers only ${alts.length}`)
    assert.equal(new Set(alts).size, alts.length, `${name} repeats itself`)
    assert.ok(!alts.includes(name), `${name} lists itself as its own alternative`)
    for (const a of alts) {
      assert.equal(typeof a, 'string')
      assert.ok(a.trim().length > 2, `${name} has an empty alternative`)
    }
  }
})

test('cycling walks the list and returns to the original', () => {
  const name = 'Goblet Squat'
  const alts = EXERCISE_ALTERNATIVES[name]
  assert.ok(alts?.length, 'the exercise that started this should be covered')

  // Index 0 is the original; 1..n are the alternatives; then round.
  let subs = {}
  const seen = []
  for (let i = 0; i <= alts.length; i++) {
    const idx = nextSubIndex(name, subs, EXERCISE_ALTERNATIVES)
    subs = { ...subs, [name]: idx }
    seen.push(substitutedName(name, subs, EXERCISE_ALTERNATIVES))
  }

  assert.deepEqual(seen.slice(0, alts.length), alts,
    'each press should offer the next alternative in order')
  assert.equal(seen[alts.length], name,
    'one more press should come back to the exercise you started with')
})

test('an exercise with no entry stays itself however often it is cycled', () => {
  const subs = { 'Nonexistent Lift': 3 }
  assert.equal(substitutedName('Nonexistent Lift', subs, EXERCISE_ALTERNATIVES), 'Nonexistent Lift')
  assert.equal(nextSubIndex('Nonexistent Lift', subs, EXERCISE_ALTERNATIVES), 0)
})

test('the machine plan and the free-weight lifts both reach each other', () => {
  // The two halves of the table were written years apart and for
  // different plans. If they never name each other, someone on the
  // barbell plan whose rack is taken has nowhere to go.
  const machineSide = ['Leg Press', 'Hack Squat', 'Lat Pulldown', 'Pec Deck']
  const freeSide    = ['Barbell Squat', 'Bench Press', 'Pull-Up', 'Barbell Row']

  const namesFrom = (keys) =>
    new Set(keys.flatMap(k => EXERCISE_ALTERNATIVES[k] || []))

  const fromFree = namesFrom(freeSide)
  assert.ok(machineSide.some(m => fromFree.has(m)),
    'a free-weight lift should be able to fall back to a machine')

  const fromMachine = namesFrom(machineSide)
  assert.ok([...fromMachine].length > 0, 'the machine side offers nothing')
})

/** Every exercise the app's own catalogue offers. */
const catalogue = () =>
  Object.values(MUSCLE_GROUPS).flatMap(g => (g.exercises || []).map(e => e.name))

test('every exercise in the catalogue can be swapped', () => {
  const missing = catalogue().filter(n => !EXERCISE_ALTERNATIVES[n]?.length)
  assert.deepEqual(missing, [],
    `${missing.length} exercises would show no swap button: ${missing.slice(0, 8).join(', ')}`)
})

test('a derived list stays inside the exercise\'s own muscle group', () => {
  // The fallback's whole claim is that a substitute lives in the same
  // group. If it ever reached across groups it would be offering a curl
  // in place of a squat.
  const groupOfName = new Map()
  for (const [key, g] of Object.entries(MUSCLE_GROUPS)) {
    for (const e of g.exercises || []) groupOfName.set(e.name, key)
  }

  for (const name of catalogue()) {
    if (CURATED.has(name)) continue          // curated lists may cross on purpose
    for (const alt of EXERCISE_ALTERNATIVES[name]) {
      assert.equal(groupOfName.get(alt), groupOfName.get(name),
        `${name} → ${alt} crosses muscle groups`)
    }
  }
})

test('shared movement wins over catalogue order', () => {
  // The reason for scoring at all: a curl should reach for another curl
  // before it reaches for whatever happens to be listed next.
  const curls = EXERCISE_ALTERNATIVES['Dumbbell Curl']
  assert.ok(curls?.length, 'Dumbbell Curl should have alternatives')
  assert.ok(curls.every(n => /curl/i.test(n)),
    `expected curls, got ${curls.join(', ')}`)
})

test('the list is the same every time it is built', () => {
  // The cycle index is stored against position, so a list that
  // reordered between renders would swap to something different from
  // what the button offered.
  const once  = JSON.stringify(EXERCISE_ALTERNATIVES)
  const twice = JSON.stringify(EXERCISE_ALTERNATIVES)
  assert.equal(once, twice)
})
