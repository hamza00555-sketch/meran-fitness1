// «خطتي» never leaves a black screen: the rules, without a browser.
// (The browser half is tests/resilience.e2e.mjs.)
//
//   · a failed chunk is told apart from a bug in the page, in the words
//     Chrome, Safari and Firefox use;
//   · the automatic reload happens once per five minutes and never when
//     its flag cannot be written — it can never loop;
//   · what to open again after it is read once, and only while fresh;
//   · the service worker waits for the app to let a new version in, and
//     the app registers it itself (vite.config.js);
//   · App opens its lazy pages through lazyPage and a Guard, never a bare
//     <Suspense fallback={null}>.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const store = new Map()
let broken = false
globalThis.sessionStorage = {
  getItem: (k) => { if (broken) throw new Error('blocked'); return store.has(k) ? store.get(k) : null },
  setItem: (k, v) => { if (broken) throw new Error('blocked'); store.set(k, String(v)) },
  removeItem: (k) => { store.delete(k) },
}

const { isChunkError, ChunkError, claimReload, takeReopen, RELOAD_KEY, REOPEN_KEY } = await import('../src/lazyPage.js')

test('a chunk that did not arrive is told apart from a bug inside the page', () => {
  for (const m of [
    'Failed to fetch dynamically imported module: https://x/assets/PlanView-abc.js',   // Chrome
    'Importing a module script failed.',                                              // Safari
    'error loading dynamically imported module: https://x/assets/PlanView-abc.js',     // Firefox
    'Unable to preload CSS for /assets/PlanView-abc.css',                              // Vite
  ]) assert.equal(isChunkError(new TypeError(m)), true, m)
  assert.equal(isChunkError(new ChunkError('planview', null)), true)
  assert.equal(isChunkError(new TypeError("Cannot read properties of null (reading 'sets')")), false)
  assert.equal(isChunkError(new Error('e.trim is not a function')), false)
  assert.equal(isChunkError(null), false)
})

test('the automatic reload: once per five minutes, never without its flag', () => {
  store.clear()
  const t = 1_800_000_000_000
  assert.equal(claimReload(t), true)
  assert.equal(store.get(RELOAD_KEY), String(t))
  assert.equal(claimReload(t + 10_000), false, 'a second one right after: no')
  assert.equal(claimReload(t + 4 * 60_000), false)
  assert.equal(claimReload(t + 5 * 60_000 + 1), true, 'a deploy later on: yes')
  store.clear()
  broken = true
  assert.equal(claimReload(t), false, 'storage blocked: no reload at all (it could loop)')
  broken = false
})

test('what to open again after the reload: once, and only while fresh', () => {
  store.clear()
  const now = Date.now()
  store.set(REOPEN_KEY, JSON.stringify({ page: 'planview', from: 'home', at: now - 2000 }))
  assert.deepEqual(takeReopen(now), { page: 'planview', from: 'home', at: now - 2000 })
  assert.equal(takeReopen(now), null, 'used up')
  store.set(REOPEN_KEY, JSON.stringify({ page: 'planner', door: 'settings', at: now - 120_000 }))
  assert.equal(takeReopen(now), null, 'two minutes old: not')
  store.set(REOPEN_KEY, '{nope')
  assert.equal(takeReopen(now), null)
  assert.equal(store.has(REOPEN_KEY), false)
})

test('the service worker waits; the app lets the new version in', () => {
  const cfg = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8')
  assert.match(cfg, /registerType:\s*'prompt'/)
  assert.match(cfg, /injectRegister:\s*false/)
  assert.match(cfg, /skipWaiting:\s*false/)
  assert.match(cfg, /clientsClaim:\s*true/)
  const main = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
  assert.match(main, /startUpdates\(\)/)
  assert.match(main, /<AppGuard>/)
  const upd = readFileSync(new URL('../src/appUpdate.js', import.meta.url), 'utf8')
  assert.match(upd, /SKIP_WAITING/)
  assert.match(upd, /register\('\/sw\.js'/)
})

test('the card and the loading state keep to sys- class names (global CSS: .pg is the achievements page, .pl a report cell)', () => {
  const css = readFileSync(new URL('../src/styles/screens/system.css', import.meta.url), 'utf8')
  assert.doesNotMatch(css, /(^|\})\s*\.(pg|pl|wn)[\s{.:-]/m)
  const guard = readFileSync(new URL('../src/components/system/PageGuard.jsx', import.meta.url), 'utf8')
  for (const m of guard.matchAll(/className="([^"]+)"/g)) {
    for (const c of m[1].split(/\s+/)) assert.ok(/^(sys-|k-)/.test(c), `PageGuard class ${c}`)
  }
})

test('nothing outside «خطتي» and the builder wears their root classes (their CSS is global once loaded)', async () => {
  const { readdirSync, statSync } = await import('node:fs')
  const path = await import('node:path')
  const root = new URL('../src/', import.meta.url).pathname
  const walk = (d) => readdirSync(d).flatMap(n => { const p = path.join(d, n); return statSync(p).isDirectory() ? walk(p) : [p] })
  const bad = []
  for (const f of walk(root).filter(p => /\.jsx$/.test(p))) {
    const rel = path.relative(root, f)
    const s = readFileSync(f, 'utf8')
    for (const m of s.matchAll(/className=(?:"([^"]+)"|\{`([^`]+)`\})/g)) {
      for (const tok of (m[1] || m[2]).replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) {
        if (/^pv(-|$)/.test(tok) && !/^pages[\\/]planview[\\/]/.test(rel)) bad.push(`${rel}: ${tok}`)
        if (tok === 'pb' && !/^pages[\\/]planner[\\/]/.test(rel)) bad.push(`${rel}: ${tok}`)
      }
    }
  }
  assert.deepEqual(bad, [], 'a .pv/.pb outside its page turns into «خطتي»/the builder once their stylesheet is in (التقدم went fixed over the tab bar)')
})

test('App opens its lazy pages through lazyPage and a Guard', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(app, /fallback=\{null\}/)
  assert.doesNotMatch(app, /\blazy\(\(\)/, 'React.lazy straight in App: use lazyPage')
  assert.match(app, /const PlanView = lazyPage\(/)
  assert.match(app, /const PlannerPage = lazyPage\(/)
  assert.match(app, /<Guard label="خطتي" lazy=\{PlanView\}/)
  assert.match(app, /<Guard label="باني الخطة" lazy=\{PlannerPage\}/)
  assert.match(app, /PlanView\.preload\(\)/)
})
