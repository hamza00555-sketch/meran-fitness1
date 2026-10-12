// The two service workers, end to end, on the built app.
//
//   npm run build && npx vite preview --port 4173 &
//   APP=http://localhost:4173/ node tests/offline.e2e.mjs
//
// One origin, two workers: the root one (scope /, the new design) and
// the old design's (scope /classic/). Until October 2026 the root one
// threw at startup — one URL in its precache under two revisions — so
// it cached nothing: the new design never opened offline, and every
// launch fetched the JS (medal3d included), the fonts and the medal art
// from the network again. This checks, in a browser, that:
//
//   - the root worker starts without an error and fills its precache,
//     with the medal chunk, the fonts and the medal art in it;
//   - a second launch takes the app and its fonts from the worker;
//   - the new design opens and reloads offline;
//   - the root worker's activation leaves the old design's precache
//     alone, so /classic/ — installed first, as on a phone that has used
//     the switch — still opens offline afterwards. (Workbox's
//     cleanupOutdatedCaches() deleted it: the root scope is part of the
//     old design's cache name.)
//
// "Offline" takes the origin down (tests/offline-origin.mjs), for the
// workers' own requests too: a worker that lost its cache must fail
// here, not quietly fetch from the preview.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { offlineOrigin } from './offline-origin.mjs'

const origin = await offlineOrigin(process.env.APP || 'http://localhost:4173/')
const APP = origin.url
const results = []
const ok = (name, pass, extra = '') => results.push([name, !!pass, extra])

const SEED = {
  hf_sessions: [1, 3, 5, 7, 9].map((n, i) => ({
    id: Date.UTC(2026, 6, n) + i, date: new Date(2026, 6, n, 18).toISOString(), duration: 45,
    exercises: [{ id: 'j' + i, muscle: 'Chest', name: 'Bench Press', sets: [{ weight: '80', reps: '12', done: true }] }],
  })),
  hf_recovery: { daysPerWeek: 3, overrides: [], restDays: [], patternHistory: [], streakResetAt: null, autoSpendFrom: '2026-07-01', deload: null, deloadHistory: [], deloadSuggestDismissedAt: null },
  hf_xp: 4200, hf_profile: { name: 'حمزة' }, hf_onboarded: true, hf_pack_prompted: true, hf_seen_version: '2.2', hf_weights_reset_v2: true,
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'], timezoneId: 'Asia/Riyadh', locale: 'ar', serviceWorkers: 'allow' })
await ctx.addInitScript((seed) => {
  try {
    if (localStorage.getItem('__seeded')) return
    localStorage.setItem('__seeded', '1')
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v))
    // A phone that has used the switch: the old design is the chosen one.
    localStorage.setItem('meran_design', 'classic')
  } catch { /* the browser's own error page, when a load fails */ }
}, SEED)

let page = await ctx.newPage()
const errors = []
const swErrors = []
async function watch(p) {
  p.on('pageerror', e => errors.push(String(e)))
  const cdp = await ctx.newCDPSession(p)
  cdp.on('ServiceWorker.workerErrorReported', e => swErrors.push(`${e.errorMessage.sourceURL}: ${e.errorMessage.errorMessage}`.slice(0, 300)))
  await cdp.send('ServiceWorker.enable')
}
await watch(page)

const cacheNames = () => page.evaluate(() => caches.keys())
const rootPrecache = (names) => names.find(n => n.startsWith('meran-v1-precache-'))
const classicPrecache = (names) => names.find(n => n.startsWith('meran-classic-precache-'))
const textLength = () => page.evaluate(() => document.body.innerText.trim().length)
const settle = () => page.waitForLoadState('networkidle').then(() => page.waitForTimeout(800))
async function underWorker() {
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {})
  return page.evaluate(() => navigator.serviceWorker.controller?.scriptURL || null)
}

// 1. The old design first: its worker installs and fills its precache.
await page.goto(new URL('classic/', APP).href); await settle()
ok('classic: opens on /classic/', new URL(page.url()).pathname === '/classic/', page.url())
ok('classic: its worker controls the page', /\/classic\/sw\.js$/.test(await underWorker() || ''))
const before = await cacheNames()
ok('classic: its precache is filled', !!classicPrecache(before), before.join(', '))
ok('classic: the root worker is not installed yet', !(await page.evaluate(() => navigator.serviceWorker.getRegistration('/').then(r => r?.scope || null))))

// 2. The new design: the root worker installs and activates.
await page.evaluate(() => localStorage.setItem('meran_design', 'new'))
await page.goto(APP); await settle()
ok('root: opens on /', new URL(page.url()).pathname === '/', page.url())
ok('root: its worker controls the page', /\/sw\.js$/.test(await underWorker() || '') && !(await page.evaluate(() => navigator.serviceWorker.controller.scriptURL)).includes('/classic/'))
await page.waitForTimeout(500)
const after = await cacheNames()
ok('root: its precache is filled', !!rootPrecache(after), after.join(', '))
ok('root: activating it left the old design\'s precache in place', classicPrecache(after) === classicPrecache(before), after.join(', '))
{
  const keys = rootPrecache(after)
    ? await page.evaluate(async (n) => (await (await caches.open(n)).keys()).map(r => new URL(r.url).pathname), rootPrecache(after))
    : []
  const has = (re) => keys.some(k => re.test(k))
  ok('root: the medal chunk is precached', has(/^\/assets\/medal3d-[^/]+\.js$/), `${keys.length} entries`)
  ok('root: the app and its fonts are precached',
    has(/^\/assets\/index-[^/]+\.js$/) && has(/^\/fonts\/meran-arabic\.woff2$/) && has(/^\/fonts\/meran-latin\.woff2$/))
  ok('root: the medal art is precached', has(/^\/assets\/ach_[^/]+\.webp$/))
  ok('root: nothing from the pack or the old design is', !has(/^\/(pack|classic)\//))
}

// 3. A second launch, online: the app comes from the worker.
await page.close()
page = await ctx.newPage(); await watch(page)
const fromWorker = []
page.on('response', r => {
  const u = new URL(r.url())
  if (/^\/(assets\/index-[^/]+\.js|fonts\/meran-[a-z]+\.woff2)$/.test(u.pathname)) fromWorker.push([u.pathname, r.fromServiceWorker()])
})
await page.goto(APP); await settle()
ok('relaunch: the app script and fonts come from the worker, not the network',
  fromWorker.length >= 2 && fromWorker.every(([, w]) => w), JSON.stringify(fromWorker))
ok('relaunch: Home shows the streak', await page.locator('[data-testid="streak-number"]').count() === 1)

// Up to here, online: installing, activating and relaunching must not
// have thrown in either worker (the old root worker threw right here).
ok('no service-worker error online', swErrors.length === 0, swErrors.slice(0, 2).join(' | '))
const onlineErrors = swErrors.length

// 4. Offline: no signal at all, for the page and both workers.
const offline = async (v) => { origin.setDown(v); await ctx.setOffline(v) }
const open = async (how) => {
  try { await how(); await page.waitForTimeout(2000); return '' } catch (e) { return e.message.split('\n')[0] }
}
await offline(true)
{
  let err = await open(() => page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 15000 }))
  ok('offline: the new design opens', !err && await page.locator('[data-testid="streak-number"]').count() === 1, err)
  err = await open(() => page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 }))
  ok('offline: and reloads', !err && await page.locator('[data-testid="streak-number"]').count() === 1, err)
}
// The switch is flipped online, on a page of the new design — nothing
// under /classic/ is fetched — as حمزة would in Settings.
await offline(false)
await page.goto(APP, { waitUntil: 'domcontentloaded' })
await page.evaluate(() => localStorage.setItem('meran_design', 'classic'))
await offline(true)
{
  const err = await open(() => page.goto(new URL('classic/', APP).href, { waitUntil: 'domcontentloaded', timeout: 15000 }))
  const bundle = err ? null : await page.evaluate(() => [...document.scripts].map(s => s.src).find(s => /\/classic\/assets\/index-[^/]+\.js$/.test(s)) || null).catch(() => null)
  ok('offline: the old design still opens after the root worker activated',
    !err && new URL(page.url()).pathname === '/classic/' && !!bundle && await textLength() > 50, err || `${page.url()} · ${bundle}`)
}
await offline(false)

// Offline, the root worker had everything it was asked for. (The old
// design's worker does report one miss, by design of the frozen copy:
// its Google Fonts stylesheet comes from the CDN, and falls back to
// system fonts offline.)
const rootOffline = swErrors.slice(onlineErrors).filter(e => !/\/classic\//.test(e.split(': ')[0]))
ok('offline: the root worker answered every request', rootOffline.length === 0, rootOffline.slice(0, 2).join(' | '))
ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
await browser.close()
await origin.close()

let failed = 0
for (const [name, pass, extra] of results) {
  if (!pass) failed++
  console.log(`${pass ? '✅' : '❌'} ${name}${extra && !pass ? `  — ${extra}` : ''}`)
}
console.log(failed ? `\n${failed} failed` : `\nall ${results.length} passed`)
process.exit(failed ? 1 : 0)
