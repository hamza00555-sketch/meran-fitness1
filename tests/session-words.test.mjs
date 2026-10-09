// Specs for how the workout player writes a set, run against the real
// ES module.
//
//   node --test tests/session-words.test.mjs
//
// The owner circled «السابق · 45×15» and said he didn't understand it.
// The player now prints a set one way everywhere — the rows, their
// «آخر مرة», the coach line, the screen-reader labels — weight first,
// units always: «72.5 كجم × 9 عدّات». These pin that format and the
// Arabic counting of reps (3–10 take the plural).

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

const { repsWord, setWords, setParts } = await import('../src/components/player/sessionWords.js')

test('reps count in Arabic: 3–10 take «عدّات», the rest «عدّة»', () => {
  assert.equal(repsWord(8), 'عدّات')
  assert.equal(repsWord(3), 'عدّات')
  assert.equal(repsWord(10), 'عدّات')
  assert.equal(repsWord(11), 'عدّة')
  assert.equal(repsWord(12), 'عدّة')
  assert.equal(repsWord(1), 'عدّة')
})

test('a set reads weight first, with its units', () => {
  assert.equal(setWords({ weight: '72.5', reps: '9' }), '72.5 كجم × 9 عدّات')
  assert.equal(setWords({ weight: '75', reps: '12' }), '75 كجم × 12 عدّة')
  assert.equal(setWords({ weight: '202.50', reps: '8' }), '202.5 كجم × 8 عدّات')
})

test('never the bare «72.5×9» shorthand', () => {
  for (const s of [{ weight: '72.5', reps: '9' }, { weight: '100', reps: '15' }]) {
    assert.doesNotMatch(setWords(s), /\d×|×\d/)
  }
})

test('half a set still reads: weight alone, or reps alone', () => {
  assert.equal(setWords({ weight: '75', reps: '' }), '75 كجم')
  assert.equal(setWords({ weight: '', reps: '12' }), '12 عدّة')
  assert.equal(setWords({ weight: '', reps: '0' }), '')
  assert.equal(setWords(null), '')
  assert.equal(setParts({ weight: '', reps: '' }), null)
})
