// Specs for the share ladder and the poster's layout arithmetic.
//
//   node --test tests/report-share.test.mjs
//
// Sharing a file from a PWA fails in different ways on different
// devices, and every one of them looks the same to the user: a button
// that did nothing. What is pinned here is that each device gets a
// route, and that closing the share sheet is never treated as an error.

import test from 'node:test'
import assert from 'node:assert/strict'

// The poster module reaches for the DOM at import time only through
// the registry, which is safe to import headless.
globalThis.localStorage = {
  _d: new Map(),
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null },
  setItem(k, v) { this._d.set(k, String(v)) },
  removeItem(k) { this._d.delete(k) },
  get length() { return this._d.size },
  key() { return null },
}

const {
  canShareFiles, supportsDownload, SHARE_RESULT, POSTER_W, POSTER_H,
} = await import('../src/reportPoster.js')

const FILE = { name: 'meran-2026-03.png', type: 'image/png' }

// ══ the story canvas ══════════════════════════════════════════

test('the poster is a story-shaped canvas', () => {
  assert.equal(POSTER_W, 1080)
  assert.equal(POSTER_H, 1920)
  assert.equal(POSTER_H / POSTER_W, 16 / 9)
})

// ══ can this device share a file? ═════════════════════════════

test('a browser with both share and canShare can share files', () => {
  const nav = { share: () => {}, canShare: () => true }
  assert.equal(canShareFiles(FILE, nav), true)
})

test('canShare alone is not enough — share has to exist too', () => {
  assert.equal(canShareFiles(FILE, { canShare: () => true }), false)
})

test('a browser without canShare cannot be trusted with files', () => {
  // Some browsers expose share() for text but reject files outright.
  assert.equal(canShareFiles(FILE, { share: () => {} }), false)
})

test('a canShare that throws is a no, not a crash', () => {
  const nav = { share: () => {}, canShare: () => { throw new TypeError('bad') } }
  assert.equal(canShareFiles(FILE, nav), false)
})

test('no navigator at all is a no', () => {
  assert.equal(canShareFiles(FILE, null), false)
  assert.equal(canShareFiles(FILE, undefined), false)
})

// ══ can this device download? ═════════════════════════════════

const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36'
const DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

test('iOS is never offered a download', () => {
  // Safari on iOS ignores the download attribute, so offering it
  // produces a button that visibly does nothing.
  assert.equal(supportsDownload(IOS, false), false)
  assert.equal(supportsDownload(IOS, true), false)
})

test('an iPad reporting itself as a Mac is still iOS', () => {
  // iPadOS claims to be Macintosh; the touch check is what gives it away.
  globalThis.document = { createElement: () => ({}), ontouchend: null }
  const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15'
  assert.equal(supportsDownload(IPAD, false), false)
  delete globalThis.document
})

test('Android Chrome downloads fine', () => {
  globalThis.document = { createElement: () => ({ download: '' }) }
  assert.equal(supportsDownload(ANDROID, false), true)
  delete globalThis.document
})

test('desktop downloads fine', () => {
  globalThis.document = { createElement: () => ({ download: '' }) }
  assert.equal(supportsDownload(DESKTOP, false), true)
  delete globalThis.document
})

test('an installed Safari PWA is not offered a download either', () => {
  globalThis.document = { createElement: () => ({ download: '' }) }
  assert.equal(supportsDownload(DESKTOP.replace('Chrome/122.0.0.0 ', ''), true), false)
  delete globalThis.document
})

// ══ the rungs are distinct ════════════════════════════════════

test('every outcome has its own name', () => {
  const names = Object.values(SHARE_RESULT)
  assert.deepEqual([...new Set(names)].sort(), ['cancelled', 'downloaded', 'inline', 'shared'])
})

test('cancelling is its own outcome, not a failure', () => {
  // The caller shows nothing for a cancel. If it shared a name with a
  // failure it would apologise every time the sheet was dismissed.
  assert.notEqual(SHARE_RESULT.CANCELLED, SHARE_RESULT.INLINE)
  assert.ok(SHARE_RESULT.CANCELLED)
})

// ══ the ladder always lands somewhere ═════════════════════════

test('every device shape reaches a rung', () => {
  globalThis.document = { createElement: () => ({ download: '' }) }
  const devices = [
    { name: 'android chrome', nav: { share: () => {}, canShare: () => true }, ua: ANDROID },
    { name: 'ios pwa',        nav: { share: () => {}, canShare: () => false }, ua: IOS },
    { name: 'old browser',    nav: {},                                        ua: DESKTOP },
  ]
  for (const d of devices) {
    const rung = canShareFiles(FILE, d.nav)
      ? SHARE_RESULT.SHARED
      : supportsDownload(d.ua, false) ? SHARE_RESULT.DOWNLOADED : SHARE_RESULT.INLINE
    assert.ok(Object.values(SHARE_RESULT).includes(rung), `${d.name} fell off the ladder`)
  }
  // iOS specifically must reach the press-and-hold sheet, because the
  // two rungs above it do nothing there.
  assert.equal(
    canShareFiles(FILE, { share: () => {}, canShare: () => false })
      ? SHARE_RESULT.SHARED
      : supportsDownload(IOS, true) ? SHARE_RESULT.DOWNLOADED : SHARE_RESULT.INLINE,
    SHARE_RESULT.INLINE,
  )
  delete globalThis.document
})
