// Specs for the training day's boundary.
//
//   node --test tests/day.test.mjs
//
// The gym closes at 03:00 and late sessions are common, so the day
// turns at three, not at midnight. A session at 01:00 belongs to the
// evening before.

import test from 'node:test'
import assert from 'node:assert/strict'

const { dayKey, calendarKey, nextDayTurn, DAY_START_HOUR } = await import('../src/day.js')

const at = (h, m = 0) => new Date(2026, 9, 1, h, m)   // 1 October, local

test('the day turns at three', () => assert.equal(DAY_START_HOUR, 3))

test('late evening is that day', () => assert.equal(dayKey(at(23, 40)), '2026-10-01'))

test('after midnight, before three, is still the evening before', () => {
  assert.equal(dayKey(at(0, 30)), '2026-09-30')
  assert.equal(dayKey(at(1, 0)),  '2026-09-30')
  assert.equal(dayKey(at(2, 59)), '2026-09-30')
})

test('three o\'clock starts the new day', () => {
  assert.equal(dayKey(at(3, 0)), '2026-10-01')
  assert.equal(dayKey(at(10, 0)), '2026-10-01')
})

test('a stored ISO timestamp is read the same way', () => {
  assert.equal(dayKey(at(1, 30).toISOString()), '2026-09-30')
})

test('a day key passes through untouched — never shifted twice', () => {
  assert.equal(dayKey('2026-10-01'), '2026-10-01')
})

test('calendarKey is the plain date, unshifted', () => {
  assert.equal(calendarKey(at(0, 0)), '2026-10-01')
})

test('the next turn is today at three before it, tomorrow at three after', () => {
  assert.equal(nextDayTurn(at(1, 0)).getTime(), at(3, 0).getTime())
  assert.equal(nextDayTurn(at(10, 0)).getTime(), new Date(2026, 9, 2, 3, 0).getTime())
})
