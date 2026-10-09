// Durations: minutes under an hour, hours from 60 on (حمزة: «اذا عدّت
// ٦٠ دقيقة تصير ساعة مو تكمل تحسبها بالدقايق»). And the one scroll lock
// that sheets share, so two overlapping can't leave the app frozen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fmtDuration, durationParts, durationShort, hoursAr } from '../src/utils.js'

test('a duration under an hour is minutes; from 60 on it is hours', () => {
  assert.equal(fmtDuration(45), '45 دقيقة')
  assert.equal(fmtDuration(59.6), 'ساعة')
  assert.equal(fmtDuration(60), 'ساعة')
  assert.equal(fmtDuration(75), 'ساعة و15 دقيقة')
  assert.equal(fmtDuration(120), 'ساعتين')
  assert.equal(fmtDuration(125), 'ساعتين و5 دقيقة')
  assert.equal(fmtDuration(180), '3 ساعات')
  assert.equal(fmtDuration(null), '—')
})

test('hours count in Arabic', () => {
  assert.deepEqual([1, 2, 3, 10, 11].map(hoursAr), ['ساعة', 'ساعتين', '3 ساعات', '10 ساعات', '11 ساعة'])
})

test('a tile gets the number and the unit apart', () => {
  assert.deepEqual(durationParts(48), { value: '48', unit: 'دقيقة' })
  assert.deepEqual(durationParts(60), { value: '1:00', unit: 'ساعة' })
  assert.deepEqual(durationParts(75), { value: '1:15', unit: 'ساعة' })
  assert.deepEqual(durationParts(605), { value: '10:05', unit: 'ساعة' })
})

test('a meta line gets the compact form', () => {
  assert.equal(durationShort(45), '45 د')
  assert.equal(durationShort(75), '1 س 15 د')
  assert.equal(durationShort(120), '2 س')
})

test('the scroll lock counts: overlapping locks release in any order', async () => {
  const root = { inert: false }
  globalThis.document = { body: { style: { overflow: '' } }, getElementById: () => root }
  const { lockScroll, heldLocks } = await import('../src/scrollLock.js')
  // The ⋯ sheet opens, then «معلومات ونصائح» opens while it is still leaving.
  const a = lockScroll({ inert: true })
  const b = lockScroll({ inert: true })
  assert.equal(document.body.style.overflow, 'hidden')
  assert.equal(root.inert, true)
  a()                                   // the first one finishes leaving
  assert.equal(document.body.style.overflow, 'hidden', 'still locked while the second is open')
  assert.equal(root.inert, true)
  b()                                   // the second closes
  assert.equal(document.body.style.overflow, '', 'the page scrolls again')
  assert.equal(root.inert, false)
  b()                                   // a second release does nothing
  assert.deepEqual(heldLocks(), { scroll: 0, inert: 0 })
  // A full-screen moment (no inert) under a sheet, closed in the other order.
  const c = lockScroll(); const d = lockScroll({ inert: true })
  c(); assert.equal(root.inert, true); d()
  assert.equal(document.body.style.overflow, ''); assert.equal(root.inert, false)
  delete globalThis.document
})
