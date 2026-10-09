// The design switch, end to end, on the built app.
//
//   npm run build && npx vite preview --port 4173 &
//   node tests/design-switch.e2e.mjs
//
// One phone, two designs, one set of data: the switch in Settings goes
// to the old design at /classic/ and back, the choice survives a reload
// (so the home-screen icon opens the chosen design), the streak is the
// same number on both sides, and the root service worker never answers
// the old design's pages with the new app.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const APP = process.env.APP || 'http://localhost:4173/'
const results = []
const ok = (name, pass, extra = '') => results.push([name, !!pass, extra])

const july = (...days) => days.map((n, i) => ({
  id: Date.UTC(2026, 6, n) + i, date: new Date(2026, 6, n, 18).toISOString(), duration: 45,
  exercises: [{ id: 'j' + i, muscle: 'Chest', name: 'Bench Press', sets: [{ weight: '80', reps: '12', done: true }] }],
}))
const SEED = {
  hf_sessions: july(1, 3, 5, 7, 9),
  hf_recovery: { daysPerWeek: 3, overrides: [], restDays: [], patternHistory: [], streakResetAt: null, autoSpendFrom: '2026-07-01', deload: null, deloadHistory: [], deloadSuggestDismissedAt: null },
  hf_xp: 4200, hf_profile: { name: 'حمزة' }, hf_pack_prompted: true, hf_seen_version: '2.2', hf_weights_reset_v2: true,
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'], timezoneId: 'Asia/Riyadh', locale: 'ar', serviceWorkers: 'allow' })
await ctx.route('**/*.r2.dev/**', r => r.abort())
// Seed once, on the very first page only — later loads must see what the
// app itself wrote, or the test would prove nothing about persistence.
await ctx.addInitScript((seed) => {
  if (sessionStorage.getItem('seeded')) return
  sessionStorage.setItem('seeded', '1')
  for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v))
}, SEED)
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(String(e)))
await page.clock.install({ time: new Date('2026-07-10T10:00:00+03:00') })

const openSettings = async () => {
  await page.locator('button[aria-label="الإعدادات"]').click()
  await page.waitForTimeout(400)
}
const settle = () => page.waitForLoadState('networkidle').then(() => page.waitForTimeout(800))

// 1. The new design, with the streak board.
await page.goto(APP); await settle()
ok('new: the streak board is on Home', await page.locator('[data-testid="streak-board"]').count() === 1)
const newStreak = (await page.locator('[data-testid="streak-number"]').innerText()).trim()

// 2. Switch off → the old design.
await openSettings()
const sw = page.locator('[data-testid="design-switch"]')
ok('new: the switch is on', await sw.getAttribute('aria-checked') === 'true')
await sw.click()
await page.waitForURL(/\/classic\/$/, { timeout: 10000 }).catch(() => {})
await settle()
ok('switch off: lands on /classic/', new URL(page.url()).pathname === '/classic/', page.url())
ok('classic: no streak board — it is the old design', await page.locator('[data-testid="streak-board"]').count() === 0)
const pill = await page.evaluate(() => (document.querySelector('header')?.innerText || '').match(/🔥\s*(\d+)/)?.[1] || null)
ok('classic: same data — the old header shows the same streak', pill === newStreak, `${pill} vs ${newStreak}`)
ok('classic: the choice is stored', await page.evaluate(() => localStorage.getItem('meran_design')) === 'classic')

// 3. The home-screen icon opens / — it must land on the chosen design.
await page.goto(APP); await settle()
ok('reload /: goes straight to the old design', new URL(page.url()).pathname === '/classic/', page.url())

// 4. With service workers running, a reload of /classic/ is still the old design.
await page.evaluate(() => navigator.serviceWorker?.ready)
await page.reload(); await settle()
ok('classic: survives a reload under the service workers',
  new URL(page.url()).pathname === '/classic/' && await page.locator('[data-testid="streak-board"]').count() === 0)

// 5. Switch on → back to the new design, with everything since.
await openSettings()
const sw2 = page.locator('[data-testid="design-switch"]')
ok('classic: the switch is off', await sw2.getAttribute('aria-checked') === 'false')
await sw2.click()
await page.waitForURL(u => new URL(u).pathname === '/', { timeout: 10000 }).catch(() => {})
await settle()
ok('switch on: back on /', new URL(page.url()).pathname === '/', page.url())
ok('new again: the streak board is back', await page.locator('[data-testid="streak-board"]').count() === 1)
ok('new again: the same streak', (await page.locator('[data-testid="streak-number"]').innerText()).trim() === newStreak)

// 6. /classic/ opened directly while the new design is chosen → back to /.
await page.goto(new URL('/classic/', APP).href); await settle()
ok('direct /classic/ with the new design chosen: back to /', new URL(page.url()).pathname === '/', page.url())

ok('no page errors', errors.length === 0, errors.join('; '))
await browser.close()

let failed = 0
for (const [name, pass, extra] of results) {
  if (!pass) failed++
  console.log(`${pass ? '✅' : '❌'} ${name}${extra && !pass ? `  — ${extra}` : ''}`)
}
console.log(failed ? `\n${failed} failed` : `\nall ${results.length} passed`)
process.exit(failed ? 1 : 0)
