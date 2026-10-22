// The session summary's picture (src/summaryArt.js): a different one each
// day, the same all day, none again before every one has been shown.
//
//   node --test tests/summary-art.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

globalThis.localStorage = {
  _d: new Map(),
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null },
  setItem(k, v) { this._d.set(k, String(v)) },
  removeItem(k) { this._d.delete(k) },
  clear() { this._d.clear() },
  key(i) { return [...this._d.keys()][i] ?? null },
  get length() { return this._d.size },
}

const { pickSummaryArt, SUMMARY_ART_KEY } = await import('../src/summaryArt.js')
const { SUMMARY_ART, allSlots } = await import('../src/assets/slots.js')
const { PER_USER_KEYS } = await import('../src/utils.js')

const day = (n) => `2026-11-${String(n).padStart(2, '0')}`

/** Days 1..n, each picking from `ids`; the picture shown each day. */
function run(n, ids, seed = 7) {
  let s = seed
  const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
  let memory = null
  const shown = []
  for (let d = 1; d <= n; d++) {
    const a = pickSummaryArt({ today: day(d), memory, ids, rand })
    memory = a.memory
    // a second session the same day: the same picture, nothing written
    const b = pickSummaryArt({ today: day(d), memory, ids, rand })
    assert.equal(b.id, a.id, `day ${d}: the same picture all day`)
    assert.equal(b.changed, false)
    shown.push(a.id)
  }
  return shown
}

test('every picture shows once before any comes round again', () => {
  const ids = SUMMARY_ART
  for (const seed of [1, 7, 42, 99, 1234]) {
    const shown = run(ids.length * 5, ids, seed)
    for (let r = 0; r < 5; r++) {
      const round = shown.slice(r * ids.length, (r + 1) * ids.length)
      assert.deepEqual([...round].sort(), [...ids].sort(), `seed ${seed}, round ${r + 1}`)
    }
    for (let i = 1; i < shown.length; i++) assert.notEqual(shown[i], shown[i - 1], `seed ${seed}: two days in a row`)
  }
})

test('only pictures that can show are picked; none at all writes nothing', () => {
  assert.deepEqual(pickSummaryArt({ today: day(1), memory: null, ids: [] }), { id: null, memory: null, changed: false })
  const a = pickSummaryArt({ today: day(1), memory: { day: day(1), id: 'summary_9', seen: ['summary_9'] }, ids: ['summary_1'] })
  assert.equal(a.id, 'summary_1', 'yesterday\'s pick is gone from the pack: another one, the same day')
  const one = run(4, ['summary_1'])
  assert.deepEqual(one, ['summary_1', 'summary_1', 'summary_1', 'summary_1'])
})

test('a broken memory starts over instead of throwing', () => {
  for (const memory of [null, 'x', 3, { seen: 'no' }, { day: day(1), id: 'gone' }]) {
    const a = pickSummaryArt({ today: day(1), memory, ids: SUMMARY_ART })
    assert.ok(SUMMARY_ART.includes(a.id))
    assert.deepEqual(a.memory.seen, [a.id])
  }
})

test('the memory is per user, and the old design never reads it', async () => {
  assert.equal(SUMMARY_ART_KEY, 'meran_summary_art')
  assert.ok(PER_USER_KEYS.includes(SUMMARY_ART_KEY))
  const classic = await readFile(new URL('../classic/src/utils.js', import.meta.url), 'utf8').catch(() => '')
  assert.ok(!classic.includes(SUMMARY_ART_KEY))
})

test('the pictures are pack slots, and Home\'s resting figure ships with the app', async () => {
  assert.ok(SUMMARY_ART.length >= 6)
  const kinds = new Map(allSlots().map(s => [s.id, s]))
  for (const id of SUMMARY_ART) {
    assert.equal(kinds.get(id)?.kind, 'summary', id)
    assert.deepEqual([kinds.get(id).w, kinds.get(id).h], [960, 640], id)
  }
  const hero = await readFile(new URL('../public/assets/hero_done.webp', import.meta.url))
  assert.equal(hero.subarray(8, 12).toString(), 'WEBP')
  assert.ok(hero.length < 80_000, `${hero.length} bytes: it is precached for everyone`)
})
