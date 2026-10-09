// Specs for the library search (src/search.js).
//
//   node --test tests/search.test.mjs
//
// The field said «ابحث عن تمرين...» in Arabic and matched English only,
// so «بنش» gave an empty page (critique F62). These pin the words a
// Saudi gym actually types.

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

const { normalize, searchExercises, buildIndex, search, catalogueEntries } = await import('../src/search.js')
const { MUSCLE_GROUPS } = await import('../src/constants.js')
const { EXERCISE_MEDIA } = await import('../src/exerciseMedia.js')

const names = (q) => searchExercises(q).map(h => h.entry.name)
const top = (q, n = 1) => names(q).slice(0, n)

test('normalize folds the letters people type interchangeably', () => {
  assert.equal(normalize('أإآٱ'), 'اااا')
  assert.equal(normalize('رفرفة'), 'رفرفه')
  assert.equal(normalize('مستوى'), 'مستوي')
  assert.equal(normalize('ضَغْطٌ'), 'ضغط')
  assert.equal(normalize('بنـــش'), 'بنش')
  assert.equal(normalize('٣×١٢'), '3 12')
  assert.equal(normalize('Push-Up'), 'push up')
  assert.equal(normalize('  تفتيح جهاز (بك دك) '), 'تفتيح جهاز بك دك')
  assert.equal(normalize('ليگ'), 'ليق')
})

test('«بنش» finds the bench presses, not an empty page', () => {
  const r = names('بنش')
  assert.ok(r.length >= 4, `only ${r.length} results`)
  for (const n of ['Bench Press', 'Incline Bench Press', 'Decline Bench Press', 'Close-Grip Bench']) {
    assert.ok(r.includes(n), `${n} missing from ${r}`)
  }
  assert.ok(!r.includes('Barbell Squat'))
})

test('colloquial names land on the right lift', () => {
  assert.ok(top('سكوات', 3).includes('Barbell Squat'))
  assert.deepEqual(top('لات'), ['Lat Pulldown'])
  assert.equal(top('ديدلفت')[0], 'Deadlift')
  assert.ok(names('ديدلفت').includes('Romanian Deadlift'))
  assert.ok(top('ليق برس').includes('Leg Press'))
  assert.ok(top('بك دك').includes('Pec Deck'))
  assert.ok(top('عقلة').includes('Pull-Up'))
  assert.ok(top('هاك').includes('Hack Squat'))
  assert.ok(names('rdl').includes('Romanian Deadlift'))
})

test('muscle words list the whole muscle first', () => {
  const muscleOf = (q) => searchExercises(q).map(h => h.entry.muscle)
  const biceps = MUSCLE_GROUPS.Biceps.exercises.length
  assert.deepEqual(new Set(muscleOf('بايسبس').slice(0, biceps)), new Set(['Biceps']))
  const triceps = MUSCLE_GROUPS.Triceps.exercises.length
  assert.deepEqual(new Set(muscleOf('ترايسبس').slice(0, triceps)), new Set(['Triceps']))
  const shoulders = MUSCLE_GROUPS.Shoulders.exercises.length
  assert.deepEqual(new Set(muscleOf('كتف').slice(0, shoulders)), new Set(['Shoulders']))
  assert.deepEqual(new Set(muscleOf('الصدر').slice(0, MUSCLE_GROUPS.Chest.exercises.length)), new Set(['Chest']))
})

test('every word of the query has to land', () => {
  const r = names('بنش مائل')
  assert.ok(r.includes('Incline Bench Press'))
  assert.ok(!r.includes('Bench Press'))
  assert.ok(!r.includes('Incline Dumbbell Press'))
})

test('Arabic names and spelling variants all match', () => {
  assert.ok(top('رفرفة جانبية', 3).includes('Lateral Raise'))
  assert.ok(top('رفرفه جانبيه', 3).includes('Lateral Raise'))
  assert.ok(top('سحب امامي').includes('Lat Pulldown'))
  assert.ok(top('سحب أمامي').includes('Lat Pulldown'))
})

test('English still works, prefixes included', () => {
  assert.equal(top('bench')[0].includes('Bench'), true)
  assert.ok(names('pull').includes('Pull-Up'))
  assert.ok(names('db shoulder').includes('Dumbbell Shoulder Press'))
  assert.ok(top('leg ext').includes('Leg Extension'))
})

test('a word the gym never says finds nothing, and an empty query is empty', () => {
  assert.deepEqual(names('زومبا'), [])
  assert.deepEqual(names(''), [])
  assert.deepEqual(names('   '), [])
})

test('every catalogue exercise finds itself by its Arabic and English name', () => {
  for (const { name } of catalogueEntries()) {
    assert.ok(names(name).includes(name), `English: ${name}`)
    const ar = EXERCISE_MEDIA[name]?.ar
    if (ar) assert.ok(top(ar, 3).includes(name), `Arabic: ${ar} → ${top(ar, 3)}`)
  }
})

test('any list of names can be indexed (custom exercises from history)', () => {
  const idx = buildIndex([{ name: 'Barbell Bench Press', muscle: 'Chest' }, { name: 'My Weird Lift' }])
  assert.deepEqual(search(idx, 'بنش').map(h => h.entry.name), ['Barbell Bench Press'])
  assert.deepEqual(search(idx, 'weird').map(h => h.entry.name), ['My Weird Lift'])
})
