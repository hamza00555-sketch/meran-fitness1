#!/usr/bin/env node
// End-to-end checks for deload mode on a phone.
//
//   npm run build && npx vite preview --port 4173 &
//   node tests/deload.e2e.mjs
//
// The Node specs already prove the arithmetic. What only a browser can
// answer is whether the design mode actually landed: whether the
// computed accent is blue, whether any green survived the tokenisation,
// whether the app genuinely slowed down, and whether all of it reverts
// on the day the period ends.
//
// It also writes before/after screenshots, because "يبين تخفيف وراحة"
// is a visual judgement and no assertion settles it.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { ACHIEVEMENTS } from '../src/constants.js'

const APP = process.env.APP || 'http://localhost:4173/'
const OUT = process.env.OUT || '/tmp/meran-deload-e2e'
mkdirSync(OUT, { recursive: true })

const results = []
const ok = (name, cond, extra = '') => results.push([name, !!cond, extra])

// ── A history worth deloading out of ──────────────────────────
// Ten weeks of bench at a steady 80kg, so the suggested weight is a
// known number and the drop to 60% is unmistakable.
let seq = 0
const SESSIONS = []
for (let n = 0; n < 30; n++) {
  const d = new Date(2026, 4, 1 + n * 2, 18)     // May-June 2026, every other day
  SESSIONS.push({
    id: d.getTime() + (++seq),
    date: d.toISOString(),
    duration: 45,
    exercises: [{
      id: 'e' + seq, muscle: 'Chest', name: 'Bench Press',
      sets: [['80', '12'], ['80', '12']].map(([weight, reps]) => ({ weight, reps, done: true })),
    }],
  })
}

const BASE_RECOVERY = {
  daysPerWeek: 3, overrides: [], restDays: [],
  patternHistory: [], streakResetAt: null, autoSpendFrom: null,
  deload: null, deloadHistory: [], deloadSuggestDismissedAt: null,
}

const DELOAD = { from: '2026-07-06', plannedUntil: '2026-07-12', pct: 40 }

const browser = await chromium.launch()

/** A page with the clock pinned to `iso`, optionally mid-deload. */
async function open(iso, { deload = null, reduced = false, sessions = SESSIONS, recovery = null } = {}) {
  const ctx = await browser.newContext({
    ...devices['iPhone 13'], timezoneId: 'Asia/Riyadh', locale: 'ar',
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  await page.route('**/*.r2.dev/**', r => r.abort())

  await page.addInitScript(([sessions, recovery, iso, unlocked]) => {
    localStorage.setItem('hf_sessions', JSON.stringify(sessions))
    localStorage.setItem('hf_recovery', JSON.stringify(recovery))
    localStorage.setItem('hf_xp', '4200')
    localStorage.setItem('hf_profile', JSON.stringify({ name: 'حمزة' }))
    localStorage.setItem('hf_pack_prompted', '1')
    localStorage.setItem('hf_seen_version', JSON.stringify('2.2'))
    localStorage.setItem('hf_unlocked', JSON.stringify(unlocked))
    localStorage.setItem('hf_weights_reset_v2', 'true')
    localStorage.setItem('hf_last_weights', JSON.stringify({ 'bench press': 80 }))

    const real = Date
    const fixed = new real(iso).getTime()
    class D extends real {
      constructor(...a) { return a.length ? new real(...a) : new real(fixed) }
      static now() { return fixed }
    }
    globalThis.Date = D
  }, [sessions, recovery || { ...BASE_RECOVERY, deload }, iso, ACHIEVEMENTS.map(a => a.id)])

  await page.goto(APP, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  return { ctx, page, errors }
}

/** The colour the browser actually resolved, not the one we wrote. */
const accentOf = (page) => page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue('--cyan').trim())

// ══ 1. The attribute drives everything ════════════════════════
{
  const { ctx, page, errors } = await open('2026-07-08T10:00:00+03:00', { deload: DELOAD })
  const attr = await page.evaluate(() => document.documentElement.getAttribute('data-deload'))
  ok('mid-deload: the root carries data-deload', attr === '1', String(attr))
  const accent = await accentOf(page)
  ok('mid-deload: the accent is glacier blue', accent.toUpperCase() === '#5CC9EE', accent)
  const radius = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--radius').trim())
  ok('mid-deload: corners softened', radius === '22px', radius)
  ok('mid-deload: no page errors', errors.length === 0, errors.join('; '))
  await page.screenshot({ path: `${OUT}/home-deload.png`, fullPage: true })
  await page.screenshot({ path: `${OUT}/fold-deload.png` })
  await ctx.close()
}

// ══ 2. Nothing green survived ═════════════════════════════════
// Every visible element, every colour-bearing property. The rank badge
// and the muscle bars are data — their colour is their identity, not
// the app's accent — so they are named exceptions rather than a blanket
// tolerance.
{
  const { ctx, page, errors } = await open('2026-07-08T10:00:00+03:00', { deload: DELOAD })
  const strays = await page.evaluate(() => {
    const GREEN = /(#5EC32A|#6DD636|#3EA812|#A8F060|rgba?\(\s*94\s*,\s*195\s*,\s*42)/i
    const PROPS = ['color', 'backgroundColor', 'backgroundImage', 'borderTopColor',
                   'borderBottomColor', 'borderLeftColor', 'borderRightColor',
                   'boxShadow', 'outlineColor', 'filter', 'textShadow', 'fill', 'stroke']
    const found = []
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) continue
      const cs = getComputedStyle(el)
      for (const p of PROPS) {
        const v = cs[p]
        if (v && GREEN.test(v)) {
          found.push(`${el.tagName.toLowerCase()}.${p} = ${v.slice(0, 70)} :: ${(el.textContent || '').trim().slice(0, 24)}`)
          break
        }
      }
    }
    return found
  })
  // rgb(94,195,42) is the rank-D tier colour and the muscle-bar
  // fallback. Both are data. Anything else is a leak.
  const leaks = strays.filter(s => !/LV\d|متوسط|^div\.backgroundColor = rgb\(94, 195, 42\)/.test(s))
  ok('mid-deload: no green chrome left on screen', leaks.length === 0,
    leaks.slice(0, 6).join(' | '))
  ok('sweep: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 3. The app breathes instead of pulsing ════════════════════
{
  const { ctx, page } = await open('2026-07-08T10:00:00+03:00', { deload: DELOAD })
  const breath = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--breath').trim())
  ok('mid-deload: the tempo dial is turned down', parseFloat(breath) > 1.2, breath)
  const glow = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--glow-mul').trim())
  ok('mid-deload: the glow is dimmed', parseFloat(glow) < 1, glow)
  // The dials have to reach a real rule, not just sit in :root.
  const probe = await page.evaluate(() => {
    const el = document.createElement('div')
    el.className = 'glow-pulse'
    document.body.appendChild(el)
    const d = getComputedStyle(el).animationDuration
    el.remove()
    return d
  })
  ok('mid-deload: glowPulse actually runs slower', parseFloat(probe) > 3, probe)
  await ctx.close()
}

// ══ 4. Before / after, same clock-free comparison ═════════════
{
  const { ctx, page, errors } = await open('2026-07-08T10:00:00+03:00', { deload: null })
  const attr = await page.evaluate(() => document.documentElement.getAttribute('data-deload'))
  ok('no deload: the root carries no attribute', attr === null, String(attr))
  const accent = await accentOf(page)
  ok('no deload: the accent is green', accent.toUpperCase() === '#5EC32A', accent)
  ok('no deload: no page errors', errors.length === 0, errors.join('; '))
  await page.screenshot({ path: `${OUT}/home-normal.png`, fullPage: true })
  await page.screenshot({ path: `${OUT}/fold-normal.png` })
  await ctx.close()
}

// ══ 5. It ends by itself ══════════════════════════════════════
// The day after plannedUntil, with the same stored config: the app has
// to notice, clear the mode, and go back to green without being told.
{
  const { ctx, page, errors } = await open('2026-07-13T10:00:00+03:00', { deload: DELOAD })
  const attr = await page.evaluate(() => document.documentElement.getAttribute('data-deload'))
  ok('after the last day: the mode is gone', attr === null, String(attr))
  const accent = await accentOf(page)
  ok('after the last day: green is back', accent.toUpperCase() === '#5EC32A', accent)
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_recovery')))
  ok('after the last day: the period is filed in history',
    stored?.deload === null && stored?.deloadHistory?.length === 1,
    JSON.stringify({ deload: stored?.deload, history: stored?.deloadHistory }))
  ok('lapse: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 6. The boundary days ══════════════════════════════════════
for (const [iso, expect, label] of [
  ['2026-07-05T22:00:00+03:00', null, 'the day before it starts'],
  ['2026-07-06T00:30:00+03:00', '1',  'the first day, just after midnight'],
  ['2026-07-12T23:30:00+03:00', '1',  'the last day, just before midnight'],
]) {
  const { ctx, page, errors } = await open(iso, { deload: DELOAD })
  const attr = await page.evaluate(() => document.documentElement.getAttribute('data-deload'))
  ok(`boundary: ${label}`, attr === expect, `expected ${expect}, got ${attr}`)
  ok(`boundary: ${label} — no errors`, errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 7. Reduced motion still wins ══════════════════════════════
{
  const { ctx, page, errors } = await open('2026-07-08T10:00:00+03:00', { deload: DELOAD, reduced: true })
  const moving = await page.evaluate(() => {
    let n = 0
    for (const el of document.querySelectorAll('.tag-pulse, .mr-bar, .mr-cell')) {
      if (getComputedStyle(el).animationName !== 'none') n++
    }
    return n
  })
  ok('reduced motion: the guarded animations stay off', moving === 0, String(moving))
  ok('reduced motion: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 8. Starting one from Settings ═════════════════════════════
// The whole point of stage 7: a person can turn this on. Drives the
// real controls rather than writing the config directly.
{
  const { ctx, page, errors } = await open('2026-07-01T10:00:00+03:00', { deload: null })
  await page.getByRole('button', { name: 'الإعدادات' }).click()
  await page.waitForTimeout(500)

  const section = page.getByText('الديلود · فترة تخفيف', { exact: false }).first()
  ok('settings: the deload section is there', await section.count() > 0)

  await section.scrollIntoViewIfNeeded()
  const start = page.getByRole('button', { name: /ابدأ فترة ديلود/ }).first()
  ok('settings: the start button is there', await start.count() > 0)
  await start.click()
  await page.waitForTimeout(200)

  // It asks once before committing a week.
  const confirm = page.getByRole('button', { name: /أكيد/ }).first()
  ok('settings: it confirms before starting', await confirm.count() > 0)
  await confirm.click()
  await page.waitForTimeout(700)

  const attr = await page.evaluate(() => document.documentElement.getAttribute('data-deload'))
  ok('settings: starting one turns the app blue', attr === '1', String(attr))

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_recovery')))
  ok('settings: the period is stored with a range and a percentage',
    stored?.deload?.from === '2026-07-01' && stored?.deload?.plannedUntil === '2026-07-07' && stored?.deload?.pct === 40,
    JSON.stringify(stored?.deload))

  const text = await page.evaluate(() => document.body.innerText)
  // The hero splits these across a chip and its neighbour text now.
  ok('settings: it lands back on the home screen with the counter',
    /ديلود[\s\S]{0,40}اليوم 1 من 7/.test(text), text.slice(0, 120))

  ok('settings: no page errors', errors.length === 0, errors.join('; '))
  await page.screenshot({ path: `${OUT}/fold-banner.png` })
  await ctx.close()
}

// ══ 9. Ending it early keeps both dates ═══════════════════════
{
  const { ctx, page, errors } = await open('2026-07-08T10:00:00+03:00', { deload: DELOAD })
  await page.getByRole('button', { name: 'الإعدادات' }).click()
  await page.waitForTimeout(500)
  const end = page.getByRole('button', { name: /أنهِ الديلود الآن/ }).first()
  ok('settings: the running card offers an early end', await end.count() > 0)
  await end.scrollIntoViewIfNeeded()
  await end.click()
  await page.waitForTimeout(700)

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_recovery')))
  const h = stored?.deloadHistory?.[0]
  ok('early end: plannedUntil and until are both kept, and differ',
    h?.plannedUntil === '2026-07-12' && h?.until === '2026-07-08' && h?.endedEarly === true,
    JSON.stringify(h))
  const attr = await page.evaluate(() => document.documentElement.getAttribute('data-deload'))
  ok('early end: the mode is off', attr === null, String(attr))
  ok('early end: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 10. The closing screen ════════════════════════════════════
// Shown once, the first time the app opens after the period closes.
{
  const { ctx, page, errors } = await open('2026-07-13T10:00:00+03:00', { deload: DELOAD })
  await page.waitForTimeout(600)
  const text = await page.evaluate(() => document.body.innerText)
  ok('end screen: it appears once the period lapses', /خلص الديلود/.test(text), text.slice(0, 200))
  ok('end screen: it names the weight being returned to', /كجم/.test(text) && /80/.test(text), text.slice(0, 300))
  await page.screenshot({ path: `${OUT}/end-screen.png` })

  await page.getByRole('button', { name: /يلا نكمل/ }).first().click()
  await page.waitForTimeout(400)
  const after = await page.evaluate(() => document.body.innerText)
  ok('end screen: dismissing it sticks', !/خلص الديلود/.test(after))

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_recovery')))
  ok('end screen: the dismissal is recorded against that end date',
    stored?.deloadEndSeenAt === '2026-07-12', JSON.stringify(stored?.deloadEndSeenAt))
  ok('end screen: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 11. A new user is never nagged ════════════════════════════
{
  const { ctx, page } = await open('2026-07-01T10:00:00+03:00', { deload: null })
  const text = await page.evaluate(() => document.body.innerText)
  // The seeded history is ~9 weeks but every lift is progressing, so
  // the stalled half of the condition is unmet.
  ok('suggestion: it stays quiet when nothing is stalled', !/يمكن وقت ديلود/.test(text))
  await ctx.close()
}

// ══ 12. The deload artwork actually arrives ═══════════════════
// Every other block blocks the bucket and exercises the fallback. This
// one serves the pack this checkout built, from disk, so the whole
// install path runs: manifest, 63 blobs, then the two deload slots the
// home screen asks for. Served locally rather than fetched because a
// test that depends on a live CDN fails for reasons that have nothing
// to do with the code.
{
  const ctx = await browser.newContext({
    ...devices['iPhone 13'], timezoneId: 'Asia/Riyadh', locale: 'ar',
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))

  let served = 0
  await page.route('**/*.r2.dev/**', async route => {
    const rel = new URL(route.request().url()).pathname.replace(/^\//, '')
    try {
      const body = await readFile(`pack/${rel}`)
      served++
      route.fulfill({
        status: 200,
        contentType: rel.endsWith('.json') ? 'application/json' : 'image/webp',
        body,
      })
    } catch { route.abort() }
  })

  await page.addInitScript(([sessions, recovery, iso, unlocked]) => {
    localStorage.setItem('hf_sessions', JSON.stringify(sessions))
    localStorage.setItem('hf_recovery', JSON.stringify(recovery))
    localStorage.setItem('hf_profile', JSON.stringify({ name: 'حمزة' }))
    localStorage.setItem('hf_seen_version', JSON.stringify('2.2'))
    localStorage.setItem('hf_weights_reset_v2', 'true')
    localStorage.setItem('hf_xp', '4200')
    // A returning user: nothing left to unlock, so the pack offer is not
    // buried under a stack of achievement toasts and a level-up screen.
    localStorage.setItem('hf_unlocked', JSON.stringify(unlocked))
    const real = Date
    const fixed = new real(iso).getTime()
    class D extends real {
      constructor(...a) { return a.length ? new real(...a) : new real(fixed) }
      static now() { return fixed }
    }
    globalThis.Date = D
  }, [SESSIONS, { ...BASE_RECOVERY, deload: DELOAD }, '2026-07-08T10:00:00+03:00', ACHIEVEMENTS.map(a => a.id)])

  await page.goto(APP, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)

  await page.getByRole('button', { name: /تنزيل الآن/ }).click()
  // ~12MB of blobs, verified and written to IndexedDB one at a time.
  await page.waitForTimeout(75000)

  const pointer = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_pack') || 'null'))
  ok('pack: it installs', pointer?.count === 182, JSON.stringify(pointer))
  ok('pack: every object came from the built pack', served >= 183, String(served))

  const arts = await page.evaluate(() =>
    [...document.querySelectorAll('img[data-art]')].map(i => ({
      slot: i.dataset.art, ok: i.complete && i.naturalWidth > 0,
    })))
  const bySlot = Object.fromEntries(arts.map(a => [a.slot, a.ok]))
  ok('pack: the iced hero replaces the training art', bySlot.deload_hero === true, JSON.stringify(bySlot))
  ok('pack: the droplet badge renders in the counter', bySlot.deload_badge === true, JSON.stringify(bySlot))
  // A blob: URL is same-origin, which is what keeps the poster's canvas
  // untainted — worth asserting rather than assuming.
  const blobbed = await page.evaluate(() =>
    [...document.querySelectorAll('img[data-art]')].every(i => i.src.startsWith('blob:')))
  ok('pack: served from blob URLs, so the canvas stays untainted', blobbed)
  ok('pack: no page errors', errors.length === 0, errors.join('; '))

  await page.screenshot({ path: `${OUT}/with-pack.png` })
  await ctx.close()
}

// ══ 13. The month report tells a taper from a slump ═══════════
// A month that ends on a deload week is the case the report used to
// get wrong: arithmetically down, and completely misleading. Checked
// through the DOM rather than a screenshot, because "is the band
// there" and "did the verdict flip" are both exact questions.
{
  const ctx = await browser.newContext({
    ...devices['iPhone 13'], timezoneId: 'Asia/Riyadh', locale: 'ar',
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  await page.route('**/*.r2.dev/**', r => r.abort())

  // Nine climbing days, then a four-day taper at the end of the month.
  let n = 0
  const day = (d, w, deload) => ({
    id: Date.UTC(2026, 2, d) + (++n),
    date: new Date(2026, 2, d, 18).toISOString(),
    duration: 45,
    ...(deload ? { deload: { pct: 40, from: '2026-03-20', until: '2026-03-26' } } : {}),
    exercises: [{
      id: `x${n}`, muscle: 'Chest', name: 'Bench Press',
      sets: [{ weight: String(w), reps: '10', done: true }],
    }],
  })
  const MARCH = [
    ...[1, 3, 5, 7, 9, 11, 13, 15, 17].map(d => day(d, 90 + d)),
    ...[20, 22, 24, 26].map(d => day(d, 45, true)),
  ]
  const CFG = {
    daysPerWeek: 3, overrides: [], restDays: [], patternHistory: [],
    streakResetAt: null, autoSpendFrom: null, deload: null,
    deloadHistory: [{
      from: '2026-03-20', plannedUntil: '2026-03-26',
      until: '2026-03-26', pct: 40, endedEarly: false,
    }],
    deloadEndSeenAt: '2026-03-26',
  }

  await page.addInitScript(([sessions, recovery]) => {
    localStorage.setItem('hf_sessions', JSON.stringify(sessions))
    localStorage.setItem('hf_recovery', JSON.stringify(recovery))
    localStorage.setItem('hf_profile', JSON.stringify({ name: 'حمزة' }))
    localStorage.setItem('hf_pack_prompted', '1')
    localStorage.setItem('hf_seen_version', JSON.stringify('2.2'))
    localStorage.setItem('hf_weights_reset_v2', 'true')
    localStorage.setItem('hf_xp', '4200')
    const real = Date
    const fixed = new real('2026-04-02T10:00:00+03:00').getTime()
    class D extends real {
      constructor(...a) { return a.length ? new real(...a) : new real(fixed) }
      static now() { return fixed }
    }
    globalThis.Date = D
  }, [MARCH, CFG])

  await page.goto(APP, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)

  await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find(e =>
      /تقرير مارس/.test(e.textContent || '') && e.children.length &&
      getComputedStyle(e).cursor === 'pointer')
    el?.click()
  })
  await page.waitForTimeout(3000)
  ok('report: it opened', await page.locator('.mr-section').count() > 0)

  // The chart shades the taper rather than marking each point.
  const band = await page.locator('svg rect[fill="#5CC9EE"]').count()
  ok('report: the trend chart shades the deload stretch', band === 1, String(band))

  // The verdict. Four light days at the END of the month is exactly the
  // arrangement a least-squares fit is dragged down by, so "up" here is
  // the exclusion doing its job — not an accident of the fixture.
  const verdict = await page.evaluate(() => {
    const svg = document.querySelector('svg[aria-label*="الاتجاه"]')
    return svg?.getAttribute('aria-label') || ''
  })
  ok('report: the taper does not turn the month into a decline',
    /صاعد/.test(verdict), verdict)

  // Every stored deload day is rimmed, trained or not.
  const rimmed = await page.evaluate(() =>
    [...document.querySelectorAll('[title*="ديلود"]')].map(e => e.getAttribute('title')))
  ok('report: the calendar rims the whole stored stretch', rimmed.length === 7, String(rimmed.length))
  ok('report: a rimmed day keeps saying what kind of day it was',
    rimmed.every(t => /تمرّنت|راحة|غياب/.test(t)), rimmed.slice(0, 3).join(' | '))

  ok('report: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ The rest-day balance says what it spent ═══════════════════
//
// A credit is spent without a tap. The engine decides it while it
// replays the calendar, so the streak on screen never collapses — but
// unless the spend is named and dated, a paid day reads as a day that
// silently vanished. That is what was reported: "I missed one day and
// found no balance and a broken streak."

/** Sessions on the given days of July 2026. */
const julySessions = (...days) => days.map((n, i) => ({
  id: Date.UTC(2026, 6, n) + i,
  date: new Date(2026, 6, n, 18).toISOString(),
  duration: 45,
  exercises: [{
    id: 'j' + i, muscle: 'Chest', name: 'Bench Press',
    sets: [{ weight: '80', reps: '12', done: true }],
  }],
}))

const CLEAN_RECOVERY = { ...BASE_RECOVERY, autoSpendFrom: '2026-07-01' }

{
  // Ten eligible days earn two credits; 11 July was a workout day and
  // he did not go. Opened on the 12th.
  const { ctx, page, errors } = await open('2026-07-12T10:00:00+03:00', {
    sessions: julySessions(1, 3, 5, 7, 9),
    recovery: CLEAN_RECOVERY,
  })
  await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true }))
  await page.waitForTimeout(300)

  const spent = page.locator('[data-testid="credit-spent"]')
  ok('credit: the spend is stated', await spent.count() === 1)
  const text = (await spent.count()) ? await spent.innerText() : ''
  // fmtDate renders ar-SA, so the date reads as a Hijri day and month.
  ok('credit: it names the date it paid for', /السبت/.test(text), text)
  ok('credit: it says what is left', /بقي لك رصيد واحد/.test(text), text)
  ok('credit: it says the streak survived', /ستريكك سليم/.test(text), text)
  ok('credit: no break warning while there is balance',
    await page.locator('[data-testid="credit-warning"]').count() === 0)

  // The screen was right before this happened — the Node specs pin that
  // down — but the decision is still written to storage afterwards, so
  // the day stays on the record as one that was bought.
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('hf_recovery') || '{}').restDays || [])
  ok('credit: the spend is recorded after the fact',
    stored.includes('2026-07-11'), JSON.stringify(stored))

  await page.screenshot({ path: `${OUT}/credit-spent.png`, fullPage: false })
  ok('credit: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

{
  // Both credits gone on the 11th and 12th. Opened on the 13th: a
  // training day, an empty balance and a live ten-day streak — the last
  // moment the warning is still worth giving.
  const { ctx, page, errors } = await open('2026-07-13T10:00:00+03:00', {
    sessions: julySessions(1, 3, 5, 7, 9),
    recovery: CLEAN_RECOVERY,
  })
  await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true }))
  await page.waitForTimeout(300)

  const warn = page.locator('[data-testid="credit-warning"]')
  ok('credit: the break is warned about before it happens', await warn.count() === 1)
  const wt = (await warn.count()) ? await warn.innerText() : ''
  ok('credit: the warning says what is at stake', /ينكسر ستريكك/.test(wt), wt)
  ok('credit: it warns about today, not a day already gone', /اليوم/.test(wt), wt)

  // Both notices apply here — a day was paid for AND the balance is now
  // empty. The fold has room for one line, and it must be the one that
  // needs acting on today, not the one in red saying everything is fine.
  const fold = await page.locator('summary').first().innerText()
  ok('credit: the warning outranks the paid notice on the fold',
    /ينكسر ستريكك/.test(fold) && !/ستريكك سليم/.test(fold), fold)

  await page.screenshot({ path: `${OUT}/credit-warning.png`, fullPage: false })
  ok('credit: no page errors on the warning state', errors.length === 0, errors.join('; '))
  await ctx.close()
}

await browser.close()

console.log(`\n  screenshots in ${OUT} — home-normal.png vs home-deload.png\n`)

let failed = 0
for (const [name, pass, extra] of results) {
  if (!pass) failed++
  console.log(`${pass ? '✅' : '❌'} ${name}${extra && !pass ? `  — ${extra}` : ''}`)
}
console.log(`\n${failed ? `${failed} of ${results.length} failed` : `all ${results.length} passed`}`)
process.exit(failed ? 1 : 0)
