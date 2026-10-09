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
import { ACHIEVEMENTS, BUILT_IN_PLANS } from '../src/constants.js'
import { deloadWeight } from '../src/deload.js'

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
async function open(iso, { deload = null, reduced = false, sessions = SESSIONS, recovery = null, plan = null, device = 'iPhone 13', extra = null } = {}) {
  const ctx = await browser.newContext({
    ...devices[device], timezoneId: 'Asia/Riyadh', locale: 'ar',
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  await page.route('**/*.r2.dev/**', r => r.abort())

  await page.addInitScript(([sessions, recovery, iso, unlocked, plan, extra]) => {
    localStorage.setItem('hf_sessions', JSON.stringify(sessions))
    for (const [k, v] of Object.entries(extra || {})) localStorage.setItem(k, JSON.stringify(v))
    if (plan) { localStorage.setItem('hf_plan', JSON.stringify(plan)); localStorage.setItem('hf_plan_index', '0') }
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
  }, [sessions, recovery || { ...BASE_RECOVERY, deload }, iso, ACHIEVEMENTS.map(a => a.id), plan, extra])

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
  // Floodlight keeps one radius in every mode (a deload changes the
  // load and the light, not the shapes), so a card is never mistaken for
  // a different component.
  const radius = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--radius').trim())
  ok('mid-deload: corners stay on the one radius', radius === '16px', radius)
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
  ok('mid-deload: no glow, in this mode either', parseFloat(glow) === 0, glow)
  // The dial has to reach a real rule, not just sit in :root: the one
  // endless motion left — the live session's dot — breathes slower.
  const probe = await page.evaluate(() => {
    const el = document.createElement('i')
    el.className = 'hm-live-dot'
    document.body.appendChild(el)
    const d = getComputedStyle(el).animationDuration
    el.remove()
    return d
  })
  ok('mid-deload: the live dot actually breathes slower', parseFloat(probe) > 3, probe)
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
  // The training day turns at 03:00, so 00:30 on the 6th is still the
  // 5th, and 02:30 on the 13th is still the deload's last day.
  ['2026-07-05T22:00:00+03:00', null, 'the day before it starts'],
  ['2026-07-06T00:30:00+03:00', null, 'just after midnight is still the day before'],
  ['2026-07-06T03:30:00+03:00', '1',  'the first day, just after three'],
  ['2026-07-12T23:30:00+03:00', '1',  'the last day, late evening'],
  ['2026-07-13T02:30:00+03:00', '1',  'the last day, after midnight but before three'],
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

// Settings is a list of sub-pages now; the deload one is its own row.
async function openDeloadSettings(page) {
  await page.getByRole('button', { name: 'الإعدادات' }).first().click()
  await page.waitForTimeout(500)
  await page.getByText('الديلود', { exact: true }).first().click()
  await page.waitForTimeout(500)
}

// ══ 8. Starting one from Settings ═════════════════════════════
// The whole point of stage 7: a person can turn this on. Drives the
// real controls rather than writing the config directly.
{
  const { ctx, page, errors } = await open('2026-07-01T10:00:00+03:00', { deload: null })
  await openDeloadSettings(page)
  ok('settings: the deload page is there', await page.getByText('ابدأ فترة ديلود').count() > 0)

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
  await openDeloadSettings(page)
  const end = page.getByRole('button', { name: /أنهِ الديلود الآن/ }).first()
  ok('settings: the running card offers an early end', await end.count() > 0)
  await end.scrollIntoViewIfNeeded()
  await end.click()
  await page.waitForTimeout(300)
  // It asks once, like starting does.
  await page.getByRole('button', { name: /^أنهِ الديلود$/ }).last().click()
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

  await page.locator('[data-pack="offer-accept"]').click()
  // ~12MB of blobs, verified and written to IndexedDB one at a time.
  await page.waitForTimeout(75000)

  const pointer = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_pack') || 'null'))
  // The pack this checkout built says how many objects it holds; the
  // number grows as art is added, so it is read rather than pinned.
  const builtManifest = JSON.parse(await readFile('pack/manifest.json', 'utf8').catch(() => 'null'))
  const expected = builtManifest?.assets?.length ?? 182
  ok('pack: it installs', pointer?.count === expected, `${JSON.stringify(pointer)} vs ${expected}`)
  ok('pack: every object came from the built pack', served >= expected, String(served))

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

// ══ The streak on Home is its number, nothing else ════════════
//
// حمزة: «انا اللي همني فقط رقم الستريك لا اكثر». Home shows the flame,
// the number and «يوم/أيام» — filled once today counts, an outline while
// it is owed — and none of the scoreboard around it. The status line,
// the 03:00 deadline, the cost of a miss, the seven days and the tickets
// live in «ليش N؟», which the number opens (App's sheet).

const BOARD_IDS = ['streak-board', 'streak-status', 'streak-note', 'streak-detail', 'streak-tickets']

/** What Home says about the streak: the number, whether today counts,
 *  how many scoreboard pieces survived, and the column's text without
 *  the greeting (App's line, which has a voice of its own). */
const streakOnHome = (page) => page.evaluate((ids) => {
  const btn = document.querySelector('[data-testid="streak-number"]')
  const col = document.querySelector('.hm')?.cloneNode(true)
  col?.querySelector('.h-greet')?.remove()
  return {
    count: document.querySelectorAll('[data-testid="streak-number"]').length,
    number: btn?.querySelector('b')?.textContent.trim() ?? null,
    counted: !!btn?.classList.contains('counted'),
    firstInTop: document.querySelector('.h-top-text')?.firstElementChild === btn,
    board: ids.map(id => document.querySelectorAll(`[data-testid="${id}"]`).length).reduce((a, b) => a + b, 0),
    text: col?.innerText || '',
    top: btn?.getBoundingClientRect().top ?? null,
  }
}, BOARD_IDS)

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
  await page.waitForTimeout(300)

  // Home: the number, held at 10 by the ticket, the flame an outline
  // because today is still owed — and nothing else about the streak.
  const st = await streakOnHome(page)
  ok('streak: the number is on Home, once', st.count === 1, String(st.count))
  ok('streak: it is the first thing in the top bar', st.firstInTop)
  ok('credit: the number held at 10', st.number === '10', String(st.number))
  ok('credit: today still owed — the flame is an outline', !st.counted)
  ok('streak: no scoreboard on Home (status, note, cost, tickets)', st.board === 0, String(st.board))
  ok('streak: no deadline, cost or ticket line on Home',
    !/3 الفجر|لو فاتك|تذكرة غطّت|تذاكر|باقي تمرين اليوم/.test(st.text), st.text.slice(0, 200))
  // The flame's own label says what tapping it does.
  const label = await page.locator('[data-testid="streak-number"]').getAttribute('aria-label')
  ok('streak: the number is a button that says it opens the details', /الستريك 10 أيام — اضغط تشوف التفاصيل/.test(label || ''), label)

  // The number comes before Today's button.
  const order = await page.evaluate(() => {
    const b = document.querySelector('[data-testid="streak-number"]')?.getBoundingClientRect().top
    const h = [...document.querySelectorAll('button')].find(x => /ابدأ التمرين/.test(x.textContent))?.getBoundingClientRect().top
    return { b, h }
  })
  ok('streak: the number sits above the start button', order.b != null && order.h != null && order.b < order.h, JSON.stringify(order))

  // The toast the engine's spend raises: dated, with what is left.
  const toast = await page.evaluate(() => document.body.innerText)
  ok('credit: the spend toast is dated and Gregorian', /انصرفت تذكرة عن السبت 11 يوليو/.test(toast))

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
  // training day, an empty balance and a live ten-day streak.
  const { ctx, page, errors } = await open('2026-07-13T10:00:00+03:00', {
    sessions: julySessions(1, 3, 5, 7, 9),
    recovery: CLEAN_RECOVERY,
  })
  await page.waitForTimeout(300)

  // No tickets left and the run at stake: Home still shows only the
  // number (the cost is the sheet's to say), with the flame an outline.
  const st = await streakOnHome(page)
  ok('credit: an empty balance — Home still shows just the number', st.number === '10' && !st.counted, JSON.stringify({ n: st.number, c: st.counted }))
  ok('credit: no scoreboard and no cost line on Home', st.board === 0 && !/يرجع 10 إلى صفر|خلصت تذاكرك/.test(st.text), st.text.slice(0, 200))
  ok('credit: the old folded warning is gone',
    await page.locator('[data-testid="credit-warning"]').count() === 0)

  await page.screenshot({ path: `${OUT}/credit-warning.png`, fullPage: false })
  ok('credit: no page errors on the warning state', errors.length === 0, errors.join('; '))
  await ctx.close()
}

{
  // «تخطي اليوم» with a plan: the sheet states the cost, Escape and
  // «رجوع» leave the plan alone, «انقل الخطة» moves it and says the day
  // is still a workout day.
  const { ctx, page, errors } = await open('2026-07-12T10:00:00+03:00', {
    sessions: julySessions(1, 3, 5, 7, 9),
    recovery: CLEAN_RECOVERY,
    plan: BUILT_IN_PLANS[0],
  })
  await page.waitForTimeout(300)
  // «تخطي اليوم» is a rare decision: it sits behind ⋯ on the Today
  // stage, not beside the start button.
  ok('skip: not a button beside the start button any more',
    await page.locator('.hm-today > .hm-dock button', { hasText: 'تخطي اليوم' }).count() === 0)
  const more = page.getByRole('button', { name: 'خيارات اليوم' })
  ok('skip: ⋯ is there with a plan', await more.count() === 1)
  const openSkip = async () => {
    await more.click()
    await page.waitForTimeout(450)
    await page.getByRole('button', { name: /تخطي اليوم/ }).first().click()
    await page.waitForTimeout(450)
  }
  await more.click()
  await page.waitForTimeout(450)
  ok('skip: the menu offers it', await page.getByRole('button', { name: /تخطي اليوم/ }).count() === 1)
  ok('skip: the menu offers the full list too', await page.getByRole('button', { name: /عرض التمارين/ }).count() === 1)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await openSkip()
  const sheet = page.locator('[data-testid="skip-sheet"]')
  ok('skip: a sheet asks first', await sheet.count() === 1)
  const st = (await sheet.count()) ? await sheet.innerText() : ''
  ok('skip: it says the day still wants a workout', /الستريك لسا يبي تمرين اليوم/.test(st), st)
  ok('skip: it states the cost', /آخر تذكرة ويوقف على 10/.test(st), st)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  ok('skip: Escape closes it', await sheet.count() === 0)
  ok('skip: closing leaves the plan where it was',
    await page.evaluate(() => localStorage.getItem('hf_plan_index')) === '0')
  await openSkip()
  await page.locator('[data-testid="skip-confirm"]').click()
  await page.waitForTimeout(300)
  ok('skip: confirming moves the plan',
    await page.evaluate(() => localStorage.getItem('hf_plan_index')) === '1')
  // Toasts queue one at a time; the spend notice for the 11th is ahead.
  const toasted = await page.waitForFunction(
    () => /انتقلت الخطة لليوم الجاي — اليوم لسا يوم تمرين/.test(document.body.innerText),
    null, { timeout: 12000 }).then(() => true, () => false)
  ok('skip: the toast says today still wants a workout', toasted)
  ok('skip: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

{
  // The same day at 23:40: the last hours, said out loud.
  const { ctx, page, errors } = await open('2026-07-13T23:40:00+03:00', {
    sessions: julySessions(1, 3, 5, 7, 9),
    recovery: CLEAN_RECOVERY,
  })
  await page.waitForTimeout(300)
  // The last hours: still the number alone — no countdown on Home.
  const st = await streakOnHome(page)
  ok('late: the number, owed', st.number === '10' && !st.counted, JSON.stringify({ n: st.number, c: st.counted }))
  ok('late: no countdown on Home', st.board === 0 && !/باقي \d+ س|3 الفجر|الليلة/.test(st.text), st.text.slice(0, 200))
  await page.screenshot({ path: `${OUT}/credit-late.png`, fullPage: false })
  ok('late: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ Home, «تحت الأضواء» ═══════════════════════════════════════
//
// The Today stage says the day as one Arabic word, shows the first
// three exercises and carries ONE green fill; the rare choices live
// behind ⋯; nothing is drawn under 12px; and on the smallest phone the
// start button is on screen above the tab bar from the first frame.

/** Visible elements in the page column whose own background is the
 *  accent fill — the screen's green actions. */
const greenFills = (page) => page.evaluate(() => {
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toLowerCase()
  const hex = (rgb) => '#' + (rgb.match(/\d+/g) || []).slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('')
  return [...document.querySelectorAll('main button, main a')].filter(el => {
    const r = el.getBoundingClientRect()
    return r.width && r.height && hex(getComputedStyle(el).backgroundColor) === accent
  }).map(el => el.textContent.trim())
})

{
  const { ctx, page, errors } = await open('2026-07-08T10:00:00+03:00', { plan: BUILT_IN_PLANS[0] })
  const word = page.locator('.hm-word').first()
  const wordText = (await word.count()) ? (await word.innerText()).trim() : ''
  ok('home: the day is one Arabic word', wordText === 'دفع', wordText)
  const wordSize = await word.evaluate(el => parseFloat(getComputedStyle(el).fontSize))
  ok('home: the day word is the display size', wordSize >= 44, String(wordSize))
  const stage = await page.locator('.hm-stage').innerText()
  ok('home: the muscles under it, in Arabic', /صدر/.test(stage), stage)
  ok('home: the count and the length', /6 تمارين/.test(stage) && /≈\s?\d+\s?د/.test(stage), stage)
  const art = await page.locator('.hm-stage img.k-stage-art').getAttribute('src')
  ok('home: the stage lights the day\'s main muscle', /muscle_chest/.test(art || ''), String(art))

  const main = await page.evaluate(() => document.querySelector('main').innerText)
  ok('home: no English day label', !/Push Day|Pull Day|Legs Day/.test(main))
  ok('home: no rank or XP strip', !/\bLv\s?\d|\bLVL\b|\d+%\s*$/m.test(main.split('تقدم البرنامج')[0]))
  ok('home: no «sets»', !/\bsets?\b/i.test(main))

  ok('home: the first three exercises are listed', await page.locator('.hm-row').count() === 3)
  const firstRow = await page.locator('.hm-row').first().innerText()
  ok('home: Arabic name first, English under it', /ضغط صدر/.test(firstRow) && /Hammer Strength/.test(firstRow), firstRow)
  const moreRow = page.locator('.hm-more')
  ok('home: the rest as «+N تمارين»', /\+3 تمارين/.test(await moreRow.innerText()), await moreRow.innerText())

  const fills = await greenFills(page)
  ok('home: one green fill, and it is «ابدأ التمرين»', fills.length === 1 && /ابدأ التمرين/.test(fills[0]), JSON.stringify(fills))
  ok('home: no ⚡ on the button', !/⚡/.test(fills.join('')))

  // Nothing readable under 12px anywhere in the column.
  const small = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('main *')) {
      const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())
      if (!own) continue
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) continue
      const fs = parseFloat(getComputedStyle(el).fontSize)
      if (fs < 12) out.push(`${fs}px «${el.textContent.trim().slice(0, 20)}»`)
    }
    return out
  })
  ok('home: no text under 12px', small.length === 0, small.slice(0, 5).join(' | '))

  // «+N تمارين» opens the whole day on the kit sheet, start docked at its foot.
  await moreRow.click()
  await page.waitForTimeout(600)
  const dialog = page.getByRole('dialog')
  ok('preview: the day opens as a sheet', await dialog.count() === 1)
  const dtext = (await dialog.count()) ? await dialog.innerText() : ''
  ok('preview: every exercise is in it', /Triceps Pushdown/.test(dtext) && /Pec Deck/.test(dtext), dtext.slice(0, 200))
  ok('preview: start is there', await dialog.getByRole('button', { name: /ابدأ التمرين/ }).count() === 1)
  ok('preview: swap is a real button with a name', await dialog.getByRole('button', { name: /استبدال التمرين|رجوع للتمرين الأصلي/ }).count() > 0)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  ok('preview: Escape closes it', await page.getByRole('dialog').count() === 0)

  // Starting from the stage starts the planned day.
  await page.getByRole('button', { name: 'ابدأ التمرين' }).click()
  await page.waitForTimeout(700)
  const activeName = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_active') || 'null')?.planDayName || '')
  ok('home: «ابدأ التمرين» starts the planned day', /Push/.test(activeName), activeName)

  ok('home: no page errors', errors.length === 0, errors.join('; '))
  await page.screenshot({ path: `${OUT}/home-redesign.png` })
  await ctx.close()
}

{
  // The smallest phone the app supports, with a plan: the start button is
  // on screen above the tab bar without scrolling.
  const { ctx, page, errors } = await open('2026-07-08T10:00:00+03:00', { plan: BUILT_IN_PLANS[0], device: 'iPhone SE' })
  const pos = await page.evaluate(() => {
    const b = [...document.querySelectorAll('main button')].find(x => /ابدأ التمرين/.test(x.textContent))?.getBoundingClientRect()
    const t = document.querySelector('nav')?.getBoundingClientRect()
    return b && t ? { top: b.top, bottom: b.bottom, tabs: t.top } : null
  })
  ok('SE: the start button is above the tab bar on the first frame',
    pos && pos.top >= 0 && pos.bottom <= pos.tabs, JSON.stringify(pos))
  const streakBox = await page.locator('[data-testid="streak-number"]').boundingBox()
  ok('SE: the streak number is still first', streakBox && pos && streakBox.y < pos.top, JSON.stringify(streakBox))
  // The first exercise is readable above the button, not under it.
  const row1 = await page.locator('.hm-row').first().boundingBox()
  ok('SE: the first exercise is fully above the start button', row1 && pos && row1.y + row1.height <= pos.top, JSON.stringify(row1))
  ok('SE: no page errors', errors.length === 0, errors.join('; '))
  await page.screenshot({ path: `${OUT}/home-se.png` })
  await ctx.close()
}

{
  // A scheduled rest day: no green anywhere in the column, the word in
  // the rest blue, and a quiet way to train anyway.
  const { ctx, page, errors } = await open('2026-07-10T09:00:00+03:00', {
    sessions: julySessions(1, 3, 5, 7, 9), recovery: CLEAN_RECOVERY,
  })
  const word = page.locator('.hm-word-rest')
  ok('rest: the day word is «راحة»', (await word.count()) && (await word.innerText()).trim() === 'راحة')
  const colors = await page.evaluate(() => ({
    word: getComputedStyle(document.querySelector('.hm-word-rest')).color,
    rest: getComputedStyle(document.documentElement).getPropertyValue('--rest').trim(),
  }))
  const toHex = (rgb) => '#' + (rgb.match(/\d+/g) || []).slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('')
  ok('rest: in the rest blue', toHex(colors.word).toLowerCase() === colors.rest.toLowerCase(), JSON.stringify(colors))
  ok('rest: no green fill on a rest day', (await greenFills(page)).length === 0, JSON.stringify(await greenFills(page)))
  ok('rest: «أبي أتمرّن» is there', await page.getByRole('button', { name: 'أبي أتمرّن' }).count() === 1)
  ok('rest: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

{
  // The rest day with a plan: «تمارين بكرة» shows tomorrow's list and
  // adds no green and no skip to the day; training anyway goes the
  // stage's way (the override), after which the day is a training day.
  const { ctx, page, errors } = await open('2026-07-10T09:00:00+03:00', {
    sessions: julySessions(1, 3, 5, 7, 9), recovery: CLEAN_RECOVERY, plan: BUILT_IN_PLANS[0],
  })
  await page.getByRole('button', { name: 'تمارين بكرة' }).click()
  await page.waitForTimeout(600)
  const dialog = page.getByRole('dialog')
  ok('rest sheet: it opens', await dialog.count() === 1)
  const sheetGreen = await page.evaluate(() => {
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toLowerCase()
    const hex = (rgb) => '#' + (rgb.match(/\d+/g) || []).slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('')
    return [...document.querySelectorAll('[role="dialog"] button')].filter(b => hex(getComputedStyle(b).backgroundColor) === accent).map(b => b.textContent.trim())
  })
  ok('rest sheet: no green fill', sheetGreen.length === 0, JSON.stringify(sheetGreen))
  ok('rest sheet: no skip on a rest day', await dialog.getByRole('button', { name: /تخطي اليوم/ }).count() === 0)
  const anyway = dialog.getByRole('button', { name: 'أبي أتمرّن' })
  ok('rest sheet: «أبي أتمرّن» is the way to train', await anyway.count() === 1)
  await anyway.click()
  await page.waitForTimeout(900)
  const overrides = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_recovery') || '{}').overrides || [])
  ok('rest sheet: it goes through the override', overrides.includes('2026-07-10'), JSON.stringify(overrides))
  ok('rest sheet: the day is now a training day with its one green button',
    (await greenFills(page)).join('') === 'ابدأ التمرين', JSON.stringify(await greenFills(page)))
  ok('rest sheet: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

{
  // A deload over a history that has earned «ارفع الوزن»: the arrow is
  // silenced on Home and in the day sheet, exactly as the player
  // silences it, and the row shows the weight the session will load.
  const at = (d) => new Date(2026, 6, d, 18)
  const raiseSessions = [1, 3, 5].map(d => ({
    id: at(d).getTime(), date: at(d).toISOString(), duration: 40,
    exercises: [{
      id: 'r' + d, muscle: 'Chest', name: 'Hammer Strength Machine Bench Press',
      sets: [1, 2, 3, 4].map(() => ({ weight: '60', reps: '15', done: true })),
    }],
  }))
  const sessions = [...SESSIONS, ...raiseSessions]

  // Without a deload the same history does earn the arrow (so the check
  // below is a real one).
  {
    const { ctx, page } = await open('2026-07-08T10:00:00+03:00', { sessions, plan: BUILT_IN_PLANS[0] })
    ok('raise: the history earns «ارفع الوزن» on Home', await page.locator('.hm-row .hm-raise').count() === 1)
    await ctx.close()
  }
  const { ctx, page, errors } = await open('2026-07-08T10:00:00+03:00', { sessions, plan: BUILT_IN_PLANS[0], deload: DELOAD })
  ok('deload: no gold raise arrow on Home', await page.locator('.hm-raise').count() === 0)
  const w = await page.locator('.hm-row').first().locator('.hm-row-w').innerText()
  ok('deload: the row shows the deload weight, not the last one',
    w.includes(String(deloadWeight(60, DELOAD.pct))) && !/\b60\b/.test(w), w)
  // The muscle art in the rows is cooled like the stage's: no lime.
  const thumbs = await page.evaluate(() => [...document.querySelectorAll('.hm-row .hm-thumb:not(.is-still) img')]
    .map(i => getComputedStyle(i).filter))
  ok('deload: the row pictures are cooled', thumbs.length > 0 && thumbs.every(f => /hue-rotate/.test(f)), JSON.stringify(thumbs))
  await page.locator('.hm-more').click()
  await page.waitForTimeout(600)
  ok('deload: no gold raise arrow in the day sheet', await page.locator('[role="dialog"] .hm-raise').count() === 0)
  const first = await page.locator('.dp-row').first().innerText()
  ok('deload: the sheet names the deload weight and the last one',
    /ديلود/.test(first) && first.includes(String(deloadWeight(60, DELOAD.pct))) && /آخر مرة/.test(first), first)
  ok('deload rows: no page errors', errors.length === 0, errors.join('; '))
  await page.screenshot({ path: `${OUT}/deload-rows.png` })
  await ctx.close()
}

for (const device of ['iPhone 13', 'iPhone SE']) {
  // A session under way: the live bar at the foot is the way back; the
  // stage offers «أكمل التمرين» quietly, never under the live bar, and
  // Home carries no green button of its own.
  const now = new Date('2026-07-08T10:00:00+03:00').getTime()
  const active = {
    id: now - 5 * 60000, date: new Date(now - 5 * 60000).toISOString(), name: 'Push — صدر، أكتاف، ترايسبس',
    planDayName: 'Push — صدر، أكتاف، ترايسبس',
    exercises: [
      { id: 'a', muscle: 'Chest', name: 'Hammer Strength Machine Bench Press',
        sets: [{ weight: '75', reps: '12', done: true }, { weight: '75', reps: '12', done: false }] },
      { id: 'b', muscle: 'Chest', name: 'Pec Deck', sets: [{ weight: '50', reps: '12', done: false }] },
    ],
  }
  const { ctx, page, errors } = await open('2026-07-08T10:00:00+03:00', { plan: BUILT_IN_PLANS[0], device, extra: { hf_active: active } })
  const shrink = page.getByRole('button', { name: 'صغّر الجلسة' })
  if (await shrink.count()) { await shrink.click(); await page.waitForTimeout(800) }
  const geo = await page.evaluate(() => {
    const r = (el) => el && el.getBoundingClientRect()
    const btn = [...document.querySelectorAll('.hm-today button')].find(b => /أكمل التمرين/.test(b.textContent))
    const bar = document.querySelector('.f-livebar')
    const b = r(btn), l = r(bar)
    return {
      btn: b && [Math.round(b.top), Math.round(b.bottom)],
      bar: l && [Math.round(l.top), Math.round(l.bottom)],
      overlap: !!(b && l && b.bottom > l.top && b.top < l.bottom),
    }
  })
  ok(`active (${device}): «أكمل التمرين» is on the stage`, !!geo.btn, JSON.stringify(geo))
  ok(`active (${device}): it never sits under the live bar`, !geo.overlap, JSON.stringify(geo))
  ok(`active (${device}): no green button on Home`, (await greenFills(page)).length === 0, JSON.stringify(await greenFills(page)))
  await page.locator('.hm-today button', { hasText: 'أكمل التمرين' }).click()
  await page.waitForTimeout(700)
  ok(`active (${device}): it opens the session`, await page.getByRole('button', { name: 'صغّر الجلسة' }).count() === 1)
  ok(`active (${device}): no page errors`, errors.length === 0, errors.join('; '))
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
