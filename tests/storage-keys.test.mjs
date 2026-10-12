// Specs for the two keys the redesign added to his data — the month
// report's goals (hf_month_goal) and the day Home's flame last lit
// (meran_flame_lit) — handled like the rest of it:
//
//   node --test tests/storage-keys.test.mjs
//
//   · a backup carries the goals and a restore puts them back
//   · the flame's memory is per user, so one person's flame does not use
//     up another's on a shared phone
//   · a data reset clears both
//
// Classic is frozen and never reads either key; nothing here changes
// what it stores.

import test from 'node:test'
import assert from 'node:assert/strict'

globalThis.localStorage = {
  _d: new Map(),
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null },
  setItem(k, v) { this._d.set(k, String(v)) },
  removeItem(k) { this._d.delete(k) },
  clear() { this._d.clear() },
  key(i) { return [...this._d.keys()][i] ?? null },
  get length() { return this._d.size },
}

const { backupData, restoreMonthGoals, ls, PER_USER_KEYS, switchUser, deleteUserData } = await import('../src/utils.js')
const { readLit, writeLit, FLAME_LIT_KEY } = await import('../src/components/streak/flameLit.js')
const { MONTH_GOAL_KEY } = await import('../src/monthReport.js')

const fresh = () => { localStorage.clear(); switchUser('default') }

test('a backup carries the month goals, and a restore puts them back', () => {
  fresh()
  const goals = { '2026-03': { kind: 'sessions', target: 16 } }
  ls.set(MONTH_GOAL_KEY, goals)
  const file = JSON.parse(JSON.stringify(backupData({ sessions: [], xp: 0 })))
  assert.deepEqual(file.monthGoals, goals)
  assert.equal(file.version, '2.1', 'the same file the old design restores')

  localStorage.clear()
  assert.equal(restoreMonthGoals(file), true)
  assert.deepEqual(ls.get(MONTH_GOAL_KEY, null), goals)

  // An older backup has no goals: the phone keeps its own.
  ls.set(MONTH_GOAL_KEY, { '2026-04': { kind: 'sessions', target: 12 } })
  assert.equal(restoreMonthGoals({ sessions: [] }), false)
  assert.deepEqual(ls.get(MONTH_GOAL_KEY, null), { '2026-04': { kind: 'sessions', target: 12 } })
  assert.equal(restoreMonthGoals({ monthGoals: [1, 2] }), false, 'not a goals object')
})

test('the flame\'s memory belongs to the person whose flame lit', () => {
  fresh()
  writeLit('2026-04-03')
  assert.equal(localStorage.getItem(FLAME_LIT_KEY), '2026-04-03', 'the first user keeps the bare key, as before')
  switchUser('u2')
  assert.equal(readLit(), null, 'another person on the same phone has not seen his flame light today')
  writeLit('2026-04-03')
  assert.equal(localStorage.getItem(`u:u2:${FLAME_LIT_KEY}`), '2026-04-03')
  switchUser('default')
  assert.equal(readLit(), '2026-04-03')
})

test('a data reset clears the goals and the flame with everything else', () => {
  fresh()
  assert.ok(PER_USER_KEYS.includes(MONTH_GOAL_KEY))
  assert.ok(PER_USER_KEYS.includes(FLAME_LIT_KEY))

  ls.set(MONTH_GOAL_KEY, { '2026-03': { kind: 'sessions', target: 16 } })
  writeLit('2026-04-03')
  PER_USER_KEYS.forEach(k => ls.remove(k))          // Settings › «مسح البيانات»
  assert.equal(ls.get(MONTH_GOAL_KEY, null), null)
  assert.equal(readLit(), null)

  writeLit('2026-04-03')
  deleteUserData('default')                          // removing the first user
  assert.equal(readLit(), null)
  switchUser('u2')
  writeLit('2026-04-03')
  deleteUserData('u2')
  assert.equal(readLit(), null)
})
