#!/usr/bin/env node
// End-to-end checks for the monthly report on a phone.
//
//   npm run build && npx vite preview --port 4173 &
//   node tests/report.e2e.mjs
//
// What is worth testing through a browser rather than in Node: the
// date window as the app's own clock actually sees it, whether the
// report renders without throwing, whether reduced motion really
// stops everything, and whether the poster's Arabic survives canvas.
//
// The last one is the reason this file writes a PNG to /tmp: shaping
// cannot be asserted, it has to be looked at.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'

const APP = process.env.APP || 'http://localhost:4173/'
const OUT = process.env.OUT || '/tmp/meran-report-e2e'
mkdirSync(OUT, { recursive: true })

const results = []
const ok = (name, cond, extra = '') => results.push([name, !!cond, extra])

// ── A month worth reporting on ────────────────────────────────
// March 2026: trained every other day, one optional rest paid for on
// the 15th, a squat that climbs, and a back that barely appears.
let seq = 0
const mk = (n, muscle, name, sets) => ({
  id: Date.UTC(2026, 2, n) + (++seq),
  date: new Date(2026, 2, n, 18).toISOString(),
  duration: 45,
  exercises: [{
    id: 'e' + seq, muscle, name,
    sets: sets.map(([w, r]) => ({ weight: String(w), reps: String(r), done: true })),
  }],
})
const SESSIONS = []
for (const [i, n] of [1, 3, 5, 7, 9, 11, 13, 16, 18, 20, 22, 24, 26, 28, 30].entries()) {
  SESSIONS.push(mk(n, 'Chest', 'Bench Press', [[60 + i * 1.5, 12], [60 + i * 1.5, 10]]))
  if (i % 2 === 0) SESSIONS.push(mk(n, 'Legs', 'Squat', [[100 + i * 2, 8]]))
  if (i % 3 === 0) SESSIONS.push(mk(n, 'Back', 'Barbell Row', [[50, 10]]))
}

const RECOVERY = {
  daysPerWeek: 3, overrides: [], restDays: ['2026-03-15'],
  patternHistory: [], streakResetAt: null, autoSpendFrom: null,
}

const browser = await chromium.launch()

/** A page with the clock pinned to `iso` and a seeded history. */
async function open(iso, { sessions = SESSIONS, reduced = false } = {}) {
  const ctx = await browser.newContext({
    ...devices['iPhone 13'], timezoneId: 'Asia/Riyadh', locale: 'ar',
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  // The bucket is not reachable from the test runner; fail fast rather
  // than let the pack download hang the page.
  await page.route('**/*.r2.dev/**', r => r.abort())

  await page.addInitScript(([sessions, recovery, iso]) => {
    localStorage.setItem('hf_sessions', JSON.stringify(sessions))
    localStorage.setItem('hf_recovery', JSON.stringify(recovery))
    localStorage.setItem('hf_xp', '4200')
    localStorage.setItem('hf_profile', JSON.stringify({ name: 'حمزة' }))
    localStorage.setItem('hf_pack_prompted', '1')
    localStorage.setItem('hf_seen_version', '99')
    // The app stamps a weights-reset watermark on first run for anyone
    // with history, which would put the whole seeded month behind the
    // cutoff and hide every record.
    localStorage.setItem('hf_weights_reset_v2', 'true')

    const real = Date
    const fixed = new real(iso).getTime()
    class D extends real {
      constructor(...a) { return a.length ? new real(...a) : new real(fixed) }
      static now() { return fixed }
    }
    globalThis.Date = D
  }, [sessions, RECOVERY, iso])

  await page.goto(APP, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1400)
  return { ctx, page, errors }
}

// ══ 1. The date window ════════════════════════════════════════
// The button reports on a month that has finished: the last two days
// of it, and the first week of the one after.

const WINDOW = [
  ['2026-03-29T18:00:00+03:00', null,        'two days before the end is too early'],
  ['2026-03-30T18:00:00+03:00', 'مارس 2026', 'the second-to-last day'],
  ['2026-03-31T18:00:00+03:00', 'مارس 2026', 'the last day'],
  ['2026-04-01T18:00:00+03:00', 'مارس 2026', 'the first of the next month'],
  ['2026-04-07T18:00:00+03:00', 'مارس 2026', 'the seventh'],
  ['2026-04-08T18:00:00+03:00', null,        'the eighth is out of window'],
  ['2026-04-20T18:00:00+03:00', null,        'mid-month is out of window'],
]

for (const [iso, expect, label] of WINDOW) {
  const { ctx, page, errors } = await open(iso)
  const text = await page.evaluate(() => document.body.innerText)
  const shown = /تقرير\s+(\S+\s+\d{4})/.exec(text)?.[1] || null
  ok(`window: ${label}`, shown === expect, `expected ${expect ?? 'no button'}, got ${shown ?? 'no button'}`)
  ok(`window: ${label} — no errors`, errors.length === 0, errors.join('; '))
  await ctx.close()
}

// The turn of the year is where month arithmetic usually breaks.
{
  const { ctx, page } = await open('2026-01-03T18:00:00+03:00', {
    sessions: SESSIONS.map(s => ({
      ...s,
      id: s.id - 7776000000,
      date: new Date(new Date(s.date).getTime() - 7776000000).toISOString(),
    })),
  })
  const text = await page.evaluate(() => document.body.innerText)
  ok('window: 3 January reports December', /تقرير\s+ديسمبر\s+2025/.test(text), text.slice(0, 200))
  await ctx.close()
}

// A month with nothing in it must not offer a report at all.
{
  const { ctx, page } = await open('2026-04-02T18:00:00+03:00', { sessions: [] })
  const text = await page.evaluate(() => document.body.innerText)
  ok('window: an empty month offers nothing', !/تقرير\s+\S+\s+\d{4}/.test(text))
  await ctx.close()
}

// ══ 2. The report renders ═════════════════════════════════════

const SECTIONS = ['نصائح هذا الشهر', 'الحجم والأرقام', 'الالتزام', 'العضلات والتوازن', 'التقدم والإنجازات']

async function openReport(page) {
  await page.getByText('تقرير مارس 2026', { exact: false }).first().dispatchEvent('click')
  await page.waitForTimeout(300)
  // Skip the opening sequence.
  await page.locator('body').click({ position: { x: 200, y: 400 } }).catch(() => {})
  await page.waitForTimeout(700)
}

// Sections carry `content-visibility: auto`, which is what keeps the
// report cheap — but it also means a section scrolled far away is not
// laid out, so innerText does not contain it. Reading the text once at
// the bottom would therefore "lose" the top of the report. Walk the
// whole thing and union what was on screen at each step.
async function textWhileScrolling(page) {
  const scroller = page.locator('div[style*="overflow-y: auto"]').last()
  let seen = await page.evaluate(() => document.body.innerText)
  for (let i = 1; i <= 6; i++) {
    await scroller.evaluate((el, i) => { el.scrollTop = el.clientHeight * i * 0.8 }, i)
    await page.waitForTimeout(500)
    seen += '\n' + await page.evaluate(() => document.body.innerText)
  }
  return seen
}

{
  const { ctx, page, errors } = await open('2026-04-02T18:00:00+03:00')
  await openReport(page)
  const text = await textWhileScrolling(page)
  for (const s of SECTIONS) ok(`section rendered: ${s}`, text.includes(s))
  ok('report: no page errors', errors.length === 0, errors.join('; '))

  const moving = await page.evaluate(() => {
    const root = [...document.querySelectorAll('div')]
      .find(d => getComputedStyle(d).zIndex === '1000' && getComputedStyle(d).position === 'fixed')
    return root ? [...root.querySelectorAll('*')]
      .filter(el => { const a = getComputedStyle(el).animationName; return a && a !== 'none' }).length : -1
  })
  ok('report: it actually moves', moving > 20, `${moving} animating elements`)
  await ctx.close()
}

// ══ 3. Reduced motion means none ══════════════════════════════

{
  const { ctx, page, errors } = await open('2026-04-02T18:00:00+03:00', { reduced: true })
  await openReport(page)
  const still = await page.evaluate(() => {
    const root = [...document.querySelectorAll('div')]
      .find(d => getComputedStyle(d).zIndex === '1000' && getComputedStyle(d).position === 'fixed')
    return root ? [...root.querySelectorAll('*')]
      .filter(el => { const a = getComputedStyle(el).animationName; return a && a !== 'none' }).length : -1
  })
  ok('reduced motion: nothing animates', still === 0, `${still} still moving`)

  const text = await textWhileScrolling(page)
  ok('reduced motion: the report still renders in full',
    SECTIONS.every(s => text.includes(s)),
    SECTIONS.filter(s => !text.includes(s)).join(', '))
  ok('reduced motion: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 4. The poster ═════════════════════════════════════════════
// Arabic inside a canvas is the one thing here that cannot be
// asserted — the PNG is written out to be looked at.

{
  const { ctx, page, errors } = await open('2026-04-02T18:00:00+03:00')
  const poster = await page.evaluate(async () => {
    const mod = await import('/assets/index.js').catch(() => null)
    return mod ? 'bundled' : 'unbundled'
  }).catch(() => 'unbundled')

  // The built bundle does not expose modules, so the poster is exercised
  // through the button the user actually presses.
  await openReport(page)

  const shot = await page.evaluate(async () => {
    // Intercept the share so the test never opens a real sheet.
    let captured = null
    const realShare = navigator.share
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
    Object.defineProperty(navigator, 'share', {
      value: async ({ files }) => {
        const buf = await files[0].arrayBuffer()
        let s = ''
        const b = new Uint8Array(buf)
        for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i])
        captured = { b64: btoa(s), name: files[0].name, type: files[0].type, bytes: b.length }
      },
      configurable: true,
    })

    document.querySelector('button[style*="var(--cyan)"]')?.click()
    const btn = [...document.querySelectorAll('button')].find(b => /مشاركة/.test(b.textContent))
    btn?.click()
    // Give the draw, the encode and the share a moment.
    for (let i = 0; i < 60 && !captured; i++) await new Promise(r => setTimeout(r, 100))
    if (realShare) Object.defineProperty(navigator, 'share', { value: realShare, configurable: true })
    return captured
  })

  ok('poster: the share button produced a file', !!shot, poster)
  if (shot) {
    ok('poster: it is a PNG', shot.type === 'image/png' && /\.png$/.test(shot.name), shot.name)
    ok('poster: it is not an empty image', shot.bytes > 50_000, `${(shot.bytes / 1024).toFixed(0)} KB`)
    const buf = Buffer.from(shot.b64, 'base64')
    // PNG header carries its own dimensions; no decoder needed.
    ok('poster: 1080×1920', buf.readUInt32BE(16) === 1080 && buf.readUInt32BE(20) === 1920,
      `${buf.readUInt32BE(16)}×${buf.readUInt32BE(20)}`)
    writeFileSync(`${OUT}/poster.png`, buf)
    console.log(`\n  poster written to ${OUT}/poster.png — open it and check the Arabic is joined up\n`)
  }
  ok('poster: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

await browser.close()

// ── Report ────────────────────────────────────────────────────
let failed = 0
for (const [name, pass, extra] of results) {
  if (!pass) failed++
  console.log(`${pass ? '✅' : '❌'} ${name}${extra && !pass ? `  — ${extra}` : ''}`)
}
console.log(`\n${failed ? `${failed} of ${results.length} failed` : `all ${results.length} passed`}`)
process.exit(failed ? 1 : 0)
