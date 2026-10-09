// Specs for the old design kept behind the switch.
//
//   node --test tests/classic.test.mjs
//
// classic/ is the app as حمزة knew it, frozen at 0058119, served at
// /classic/. It has no public/ of its own — it points at the root app's
// images and fonts — so the one way the new design can quietly break it
// is by deleting or renaming one of those files. That is what this
// fails on. It also keeps the switch identical on both sides.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const walk = (dir) => readdirSync(dir).flatMap(f => {
  const p = path.join(dir, f)
  return statSync(p).isDirectory() ? walk(p) : [p]
})

test('every image and font the old design points at exists in the shared public/', () => {
  const files = [...walk(path.join(ROOT, 'classic/src')), path.join(ROOT, 'classic/index.html')]
    .filter(f => /\.(jsx?|css|html)$/.test(f))
  const refs = new Set()
  for (const f of files) {
    const text = readFileSync(f, 'utf8')
    for (const m of text.matchAll(/["'(]\/((?:assets|fonts)\/[^"')?#\s]+\.(?:png|jpe?g|webp|svg|otf|woff2?|mp4))/g)) refs.add(m[1])
  }
  assert.ok(refs.size > 5, `found only ${refs.size} references — the scan is broken`)
  const missing = [...refs].filter(r => !existsSync(path.join(ROOT, 'public', r)))
  assert.deepEqual(missing, [], `the new design removed files the old one uses: ${missing.join(', ')}`)
})

test('the switch is the same file on both sides', () => {
  for (const f of ['design.js', 'components/DesignSwitch.jsx']) {
    assert.equal(
      readFileSync(path.join(ROOT, 'src', f), 'utf8'),
      readFileSync(path.join(ROOT, 'classic/src', f), 'utf8'),
      `${f} differs between src/ and classic/src/`)
  }
})

test('each side renders the switch in the right position', () => {
  assert.match(readFileSync(path.join(ROOT, 'src/pages/SettingsPage.jsx'), 'utf8'), /<DesignSwitch isNew=\{true\} \/>/)
  assert.match(readFileSync(path.join(ROOT, 'classic/src/pages/SettingsPage.jsx'), 'utf8'), /<DesignSwitch isNew=\{false\} \/>/)
})

test('each index.html sends you to the chosen design', () => {
  assert.match(readFileSync(path.join(ROOT, 'index.html'), 'utf8'), /meran_design'\)==='classic'\)location\.replace\('\/classic\/'\)/)
  assert.match(readFileSync(path.join(ROOT, 'classic/index.html'), 'utf8'), /meran_design'\)!=='classic'\)location\.replace\('\/'\)/)
})

test('the old design is the old design: none of the redesign is in it', () => {
  assert.equal(existsSync(path.join(ROOT, 'classic/src/streak.js')), false)
  assert.equal(existsSync(path.join(ROOT, 'classic/src/components/streak')), false)
})
