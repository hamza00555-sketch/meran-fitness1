// Specs for the motion foundation: the spring tokens, the rolling
// number's columns, the sounds on disk, and the sound and haptic modules
// staying quiet (never throwing) where there is no audio or no DOM.
//
//   node --test tests/motion.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { springCurve, SPRINGS, rollColumns } from '../src/motion.js'

const ROOT = new URL('..', import.meta.url).pathname
const tokens = readFileSync(path.join(ROOT, 'src/styles/tokens.css'), 'utf8')

test('the CSS spring tokens are the curves motion.js computes', () => {
  for (const [name, [dur, bounce]] of Object.entries(SPRINGS)) {
    const c = springCurve(dur, bounce)
    const css = tokens.match(new RegExp(`--spring-${name}:\\s*(linear\\([^)]*\\))`))
    assert.ok(css, `--spring-${name} has no linear() curve in tokens.css`)
    assert.equal(css[1], `linear(${c.points.join(', ')})`, `--spring-${name} drifted from springCurve(${dur}, ${bounce})`)
    const ms = [...tokens.matchAll(new RegExp(`--spring-${name}-ms:\\s*(\\d+)ms`, 'g'))].map(m => +m[1])
    assert.ok(ms.includes(c.ms), `--spring-${name}-ms should be ${c.ms}ms where linear() is used (found ${ms})`)
    assert.ok(ms.includes(Math.round(dur * 1000)), `--spring-${name}-ms fallback should be ${Math.round(dur * 1000)}ms`)
  }
})

test('a spring starts at 0, ends at exactly 1, and only the bouncy ones overshoot', () => {
  for (const [name, [dur, bounce]] of Object.entries(SPRINGS)) {
    const { points } = springCurve(dur, bounce)
    assert.equal(points[0], 0)
    assert.equal(points.at(-1), 1)
    const peak = Math.max(...points)
    if (bounce === 0) assert.ok(peak <= 1, `${name} should not overshoot`)
    if (bounce >= 0.3) assert.ok(peak > 1.03, `${name} should overshoot visibly`)
  }
})

test('every sound the app plays is on disk in both formats, with its licence', async () => {
  const { SOUNDS } = await import('../src/sound.js')
  for (const name of Object.keys(SOUNDS)) {
    for (const ext of ['m4a', 'mp3']) {
      const f = path.join(ROOT, 'public/sounds', `${name}.${ext}`)
      assert.ok(existsSync(f), `public/sounds/${name}.${ext} is missing`)
      assert.ok(statSync(f).size < 40_000, `${name}.${ext} is too heavy for a UI sound`)
    }
  }
  const lic = readFileSync(path.join(ROOT, 'public/sounds/LICENSES.md'), 'utf8')
  assert.match(lic, /CC0/)
  for (const name of Object.keys(SOUNDS)) assert.ok(lic.includes(`\`${name}\``), `LICENSES.md doesn't account for ${name}`)
})

test('the PWA precaches the sounds, so they play offline at the gym', () => {
  const cfg = readFileSync(path.join(ROOT, 'vite.config.js'), 'utf8')
  assert.match(cfg, /sounds\/\*\.\{m4a,mp3\}/)
})

test('without a browser, sound and haptics are quiet no-ops', async () => {
  const sound = await import('../src/sound.js')
  const session = await import('../src/components/player/sessionAudio.js')
  const { haptic } = await import('../src/haptics.js')
  assert.equal(sound.unlock(), null)
  assert.equal(sound.unlocked(), false)
  const cancel = sound.play('pr')
  assert.equal(typeof cancel, 'function')
  assert.doesNotThrow(cancel)
  assert.equal(await sound.load('set-done'), null)
  assert.equal(session.primeAudio(), null)
  assert.doesNotThrow(session.scheduleRestTones(90))
  assert.equal(session.chimeNow(), false)
  for (const k of ['set', 'pr', 'swipe', 'rest', 'nope']) assert.doesNotThrow(() => haptic(k))
})

test('a rolling number lines up on the decimal point', () => {
  assert.deepEqual(rollColumns('75', '77.5'), [['7', '7'], ['5', '7'], [' ', '.'], [' ', '5']])
  assert.deepEqual(rollColumns('77.5', '75'), [['7', '7'], ['7', '5'], ['.', ' '], ['5', ' ']])
  assert.deepEqual(rollColumns('9', '10'), [[' ', '1'], ['9', '0']])
  assert.deepEqual(rollColumns('97.5', '102.5'), [[' ', '1'], ['9', '0'], ['7', '2'], ['.', '.'], ['5', '5']])
})
