// Specs for pulling a sheet down to close it (src/sheetDrag.js), held to
// the plan's «اقتراح 4»: past a quarter of its height or faster than
// 0.5px/ms it closes, a flick back up keeps it, and pulled up it gives
// like rubber — never more than its limit.
//
//   node --test tests/sheet-drag.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  rubberBand, releaseVelocity, shouldDismiss, exitDuration,
  DISMISS_FRACTION, DISMISS_VELOCITY, RUBBER_LIMIT, KEEP_VELOCITY,
} from '../src/sheetDrag.js'

test('the thresholds are the plan’s: a quarter of the height, 0.5px/ms', () => {
  assert.equal(DISMISS_FRACTION, 0.25)
  assert.equal(DISMISS_VELOCITY, 0.5)
})

test('down, the sheet follows the finger exactly', () => {
  for (const dy of [0, 1, 40, 250, 900]) assert.equal(rubberBand(dy), dy)
})

test('up, it gives less and less, and never past its limit', () => {
  let prev = 0
  for (const dy of [-10, -40, -80, -160, -400, -2000]) {
    const y = rubberBand(dy)
    assert.ok(y < 0, `${dy} should lift it`)
    assert.ok(y > dy, `${dy}: it must lift less than the finger moved (${y})`)
    assert.ok(y < prev, `${dy}: further up must still lift a little more`)
    assert.ok(y > -RUBBER_LIMIT, `${dy}: never past the limit (${y})`)
    prev = y
  }
  // The first pixels feel almost direct, then it stiffens.
  assert.ok(rubberBand(-10) < -8)
  assert.ok(rubberBand(-160) > -55)
})

test('nonsense in, a still sheet out', () => {
  assert.equal(rubberBand(NaN), 0)
  assert.equal(rubberBand(undefined), 0)
})

test('the release speed is read over the last 80ms, not the whole drag', () => {
  // A slow drag, then a flick: the flick is what counts.
  const slow = Array.from({ length: 30 }, (_, i) => ({ t: i * 16, y: i * 2 }))
  const t0 = slow.at(-1).t, y0 = slow.at(-1).y
  const flick = [...slow, ...Array.from({ length: 6 }, (_, i) => ({ t: t0 + (i + 1) * 16, y: y0 + (i + 1) * 24 }))]
  const v = releaseVelocity(flick)
  assert.ok(v > 1.2 && v < 1.6, `flick ${v}`)
  // A drag that stopped before letting go reads as still.
  const held = [...slow, { t: t0 + 120, y: y0 }, { t: t0 + 200, y: y0 }]
  assert.ok(Math.abs(releaseVelocity(held)) < 0.05, `held ${releaseVelocity(held)}`)
  // Up is negative.
  assert.ok(releaseVelocity([{ t: 0, y: 100 }, { t: 50, y: 60 }]) < 0)
  // Too little to tell: zero.
  assert.equal(releaseVelocity([]), 0)
  assert.equal(releaseVelocity([{ t: 0, y: 1 }]), 0)
  assert.equal(releaseVelocity([{ t: 5, y: 1 }, { t: 5, y: 9 }]), 0)
})

test('let go past a quarter of the height and it closes; short of it, it stays', () => {
  const height = 600
  assert.equal(shouldDismiss({ dy: 151, vy: 0, height }), true)
  assert.equal(shouldDismiss({ dy: 150, vy: 0, height }), true)
  assert.equal(shouldDismiss({ dy: 149, vy: 0, height }), false)
  assert.equal(shouldDismiss({ dy: 20, vy: 0.1, height }), false)
})

test('a quick flick down closes it from anywhere', () => {
  assert.equal(shouldDismiss({ dy: 30, vy: 0.5, height: 600 }), true)
  assert.equal(shouldDismiss({ dy: 30, vy: 0.49, height: 600 }), false)
  assert.equal(shouldDismiss({ dy: 12, vy: 2, height: 800 }), true)
})

test('a flick back up keeps it open, however far it was pulled', () => {
  assert.equal(shouldDismiss({ dy: 400, vy: KEEP_VELOCITY, height: 600 }), false)
  assert.equal(shouldDismiss({ dy: 400, vy: -1.5, height: 600 }), false)
  // Drifting up slowly at the end still closes a long pull.
  assert.equal(shouldDismiss({ dy: 400, vy: -0.1, height: 600 }), true)
})

test('pulled up (or not moved) it never closes', () => {
  assert.equal(shouldDismiss({ dy: 0, vy: 3, height: 600 }), false)
  assert.equal(shouldDismiss({ dy: -50, vy: 3, height: 600 }), false)
})

test('it leaves at the finger’s speed, within a quick, followable range', () => {
  // A hard flick: as fast as allowed.
  assert.equal(exitDuration({ dy: 100, height: 600, vy: 5 }), 120)
  // A slow pull past the line: no slower than a normal exit.
  assert.equal(exitDuration({ dy: 160, height: 600, vy: 0.05 }), 260)
  // In between, the rest of the way at that speed.
  const ms = exitDuration({ dy: 200, height: 600, vy: 2 })
  assert.equal(ms, 200)
  // Almost gone already: still a visible beat.
  assert.equal(exitDuration({ dy: 590, height: 600, vy: 2 }), 120)
})
