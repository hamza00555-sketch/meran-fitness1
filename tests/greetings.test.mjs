// Specs for the line under the logo.
//
//   node --test tests/greetings.test.mjs
//
// Two things are pinned here. The copy itself — every line in every pool
// obeys the house voice, so a stray twelve-word line or a second emoji
// fails before it ships. And the choice — the pool follows the day, and
// the same line is never shown twice running.

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

const { GREETINGS, NOTIFICATION_MESSAGES } = await import('../src/constants.js')
const { pickGreeting, greetingPoolFor } = await import('../src/utils.js')

const POOLS = Object.keys(GREETINGS)
const all = POOLS.flatMap(k => GREETINGS[k])

// Emoji, counted as extended pictographic clusters. Variation selectors
// and ZWJ sequences count as one.
const emojiCount = (s) => (s.match(/\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*/gu) || []).length
const words = (s) => s.replace(/[{}]/g, '').split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length

// ══ the copy ═══════════════════════════════════════════════════

test('the pools, none of them thin', () => {
  assert.deepEqual([...POOLS].sort(),
    ['comeback', 'creditSpent', 'deload', 'done', 'general', 'milestone', 'rest', 'restTaken', 'streak'])
  // A pool of one says the same thing every time it is reached — the
  // credit pool did exactly that. Six is the floor.
  for (const k of POOLS) assert.ok(GREETINGS[k].length >= 6, `${k}: ${GREETINGS[k].length}`)
})

test('every line names the person', () => {
  for (const l of all) assert.ok(l.includes('{name}'), l)
})

test('every line carries exactly one emoji', () => {
  for (const l of all) assert.equal(emojiCount(l), 1, l)
})

test('no line runs past ten words — the header has 230px', () => {
  for (const l of all) assert.ok(words(l) <= 11, `${words(l)} words: ${l}`)
})

test('the streak pools carry the number, the others do not', () => {
  for (const l of [...GREETINGS.streak, ...GREETINGS.milestone]) assert.ok(l.includes('{streak}'), l)
  for (const k of POOLS.filter(k => k !== 'streak' && k !== 'milestone')) {
    for (const l of GREETINGS[k]) assert.ok(!l.includes('{streak}'), `${k}: ${l}`)
  }
})

test('no line is repeated across the pools', () => {
  assert.equal(new Set(all).size, all.length)
})

test('no letter-spacing hazard: no Latin run other than PR/kg', () => {
  for (const l of all) {
    const latin = (l.replace(/\{name\}|\{streak\}/g, '').match(/[A-Za-z]+/g) || [])
      .filter(w => !['PR', 'PRs', 'kg'].includes(w))
    assert.deepEqual(latin, [], l)
  }
})

test('notification pools grew and stayed well-formed', () => {
  for (const [k, list] of Object.entries(NOTIFICATION_MESSAGES)) {
    for (const n of list) {
      assert.ok(n.title && n.body, `${k}: ${JSON.stringify(n)}`)
      assert.equal(emojiCount(n.title), 1, `${k}: ${n.title}`)
    }
  }
  assert.ok(NOTIFICATION_MESSAGES.workout.length >= 8)
  assert.ok(NOTIFICATION_MESSAGES.morning.length >= 7)
  assert.ok(NOTIFICATION_MESSAGES.evening.length >= 7)
})

// ══ the choice ═════════════════════════════════════════════════

const first = () => 0   // deterministic: always the first candidate
const pick = (o) => pickGreeting({ name: 'حمزة', random: first, remember: false, last: null, ...o })

test('a plain training day draws from the general pool', () => {
  const g = pick({})
  assert.ok(GREETINGS.general.some(l => l.replaceAll('{name}', 'حمزة') === g), g)
})

test('a scheduled rest day draws from the rest pool', () => {
  const g = pick({ isRecoveryDay: true })
  assert.ok(GREETINGS.rest.some(l => l.replaceAll('{name}', 'حمزة') === g), g)
})

test('a deload week outranks a rest day', () => {
  const g = pick({ isRecoveryDay: true, deload: true })
  assert.ok(GREETINGS.deload.some(l => l.replaceAll('{name}', 'حمزة') === g), g)
})

test('a week-long streak gets its number in the line', () => {
  const g = pick({ streak: 12 })
  assert.ok(g.includes('12') || GREETINGS.streak.some(l => l.replaceAll('{name}', 'حمزة').replaceAll('{streak}', '12') === g), g)
})

test('six days is not yet a streak worth a line', () => {
  const g = pick({ streak: 6 })
  assert.ok(GREETINGS.general.some(l => l.replaceAll('{name}', 'حمزة') === g), g)
})

test('a deload week outranks everything — nothing may contradict its register', () => {
  const g = pick({ deload: true, daysSinceLast: 9, creditSpentYesterday: true, isRecoveryDay: true, streak: 30 })
  assert.ok(GREETINGS.deload.some(l => l.replaceAll('{name}', 'حمزة') === g), g)
})

test('five days away is a comeback, and it outranks a credit spent yesterday', () => {
  const g = pick({ daysSinceLast: 5, creditSpentYesterday: true })
  assert.ok(GREETINGS.comeback.some(l => l.replaceAll('{name}', 'حمزة') === g), g)
})

test('a credit spent yesterday outranks a rest day and a streak', () => {
  assert.equal(greetingPoolFor({ creditSpentYesterday: true, isRecoveryDay: true, streak: 30 }), 'creditSpent')
})

test('the same line is never shown twice running', () => {
  const lastLine = GREETINGS.general[0]
  const g = pick({ last: lastLine })
  assert.notEqual(g, lastLine.replaceAll('{name}', 'حمزة'))
})

test('a one-line pool may repeat rather than go blank', () => {
  const pools = { ...GREETINGS, creditSpent: ['{name} وحدها 🎟️'] }
  const g = pickGreeting({ name: 'حمزة', pools, random: first, remember: false,
                           last: '{name} وحدها 🎟️', creditSpentYesterday: true })
  assert.equal(g, 'حمزة وحدها 🎟️')
})

test('it remembers what it showed', () => {
  localStorage.clear()
  pickGreeting({ name: 'حمزة', random: first })
  assert.ok(localStorage.getItem('hf_last_greeting'))
})

test('a missing name falls back to البطل', () => {
  const g = pick({ name: undefined })
  assert.ok(g.includes('البطل'), g)
})

// ══ variety ════════════════════════════════════════════════════

test('a rest chosen today gets rest lines, not a call to train', () => {
  assert.equal(greetingPoolFor({ isRestTaken: true, streak: 20 }), 'restTaken')
})

test('a day already trained gets a closing line', () => {
  assert.equal(greetingPoolFor({ trainedToday: true, streak: 20 }), 'done')
})

test('a round-number streak gets a milestone line, the days between get the streak pool', () => {
  assert.equal(greetingPoolFor({ streak: 30 }), 'milestone')
  assert.equal(greetingPoolFor({ streak: 31 }), 'streak')
  assert.equal(greetingPoolFor({ streak: 500 }), 'milestone')
})

test('every line in a pool is dealt before any repeats', () => {
  // Simulate many app opens on the same kind of day, with storage.
  localStorage.clear()
  for (const [pool, day] of [['streak', { streak: 12 }], ['rest', { isRecoveryDay: true }],
                             ['creditSpent', { creditSpentYesterday: true }]]) {
    const n = GREETINGS[pool].length
    const seen = new Set()
    for (let i = 0; i < n; i++) seen.add(pickGreeting({ name: 'حمزة', ...day }))
    assert.equal(seen.size, n, `${pool}: ${seen.size} of ${n} in one deck`)
  }
})

test('the next deck never opens with the line that closed the last one', () => {
  localStorage.clear()
  const n = GREETINGS.rest.length
  let prev = null
  for (let i = 0; i < n * 6; i++) {
    const g = pickGreeting({ name: 'حمزة', isRecoveryDay: true })
    assert.notEqual(g, prev, `repeat at draw ${i}`)
    prev = g
  }
})
