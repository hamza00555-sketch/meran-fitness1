#!/usr/bin/env node
// End-to-end checks for the monthly report on a phone.
//
//   npm run build && npx vite preview --port 4173 &
//   node tests/report.e2e.mjs
//
// What is worth testing through a browser rather than in Node: the
// date window as the app's own clock actually sees it, whether the
// report renders without throwing, whether its chrome stays off the
// text and its index really navigates, whether motion is entrances
// only (and none at all under reduced motion), and whether the
// poster's Arabic survives canvas inside the Stories safe area.
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
// The cover, then five numbered chapters, each with its own heading.

const CHAPTERS = ['نصائح هذا الشهر', 'الحجم', 'الالتزام', 'العضلات', 'التقدم']

async function openReport(page) {
  await page.getByText('تقرير مارس 2026', { exact: false }).first().dispatchEvent('click')
  // No opening sequence to skip: the cover is the first frame.
  await page.waitForTimeout(900)
}

// Walk the whole report so every chapter has had its entrance.
async function scrollThrough(page) {
  const scroller = page.locator('.rp-scroll')
  for (let i = 1; i <= 8; i++) {
    await scroller.evaluate((el, i) => { el.scrollTop = el.clientHeight * i * 0.8 }, i)
    await page.waitForTimeout(350)
  }
}

// Headings of the chapters that are actually laid out.
const chapterTitles = (page) => page.evaluate(() =>
  [...document.querySelectorAll('.rp .rp-ch')]
    .filter(c => c.getBoundingClientRect().height > 40)
    .map(c => c.querySelector('.rp-ch-title')?.textContent.trim()))

// Animations inside the report layer: [how many, how many loop].
const motion = (page) => page.evaluate(() => {
  const root = document.querySelector('.rp')
  if (!root) return [-1, -1]
  const anims = [...root.querySelectorAll('*')].map(el => getComputedStyle(el))
    .filter(cs => cs.animationName && cs.animationName !== 'none')
  return [anims.length, anims.filter(cs => cs.animationIterationCount === 'infinite').length]
})

{
  const { ctx, page, errors } = await open('2026-04-02T18:00:00+03:00')
  await openReport(page)

  // The cover: the month's total is the headline, not a caption.
  const cover = await page.evaluate(() => {
    const hero = document.querySelector('.rp-hero')
    return hero ? { text: hero.textContent.trim(), size: parseFloat(getComputedStyle(hero).fontSize) } : null
  })
  ok('cover: the month total is the headline number',
    !!cover && cover.size >= 72 && /^\d{1,3}(,\d{3})+$/.test(cover.text), JSON.stringify(cover))

  // The chrome is solid and never sits on the text: bar, scroller and
  // index are stacked, and both bar buttons are real 44pt targets.
  const chrome = await page.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect()
    const bar = r('.rp-bar'), scroll = r('.rp-scroll'), index = r('.rp-index')
    const btns = [...document.querySelectorAll('.rp-bar button')].map(b => b.getBoundingClientRect())
    return {
      stacked: !!(bar && scroll && index) && bar.bottom <= scroll.top + 0.5 && scroll.bottom <= index.top + 0.5,
      targets: btns.length === 2 && btns.every(b => b.width >= 44 && b.height >= 44),
    }
  })
  ok('chrome: bar, report and index never overlap', chrome.stacked, JSON.stringify(chrome))
  ok('chrome: close and share are 44pt buttons', chrome.targets, JSON.stringify(chrome))

  // The index is a control, not a picture of one: a tap brings its
  // chapter to the top and marks it current.
  await page.locator('.rp-index button', { hasText: 'العضلات' }).click()
  await page.waitForTimeout(1200)
  const jumped = await page.evaluate(() => {
    const ch = document.getElementById('rp-muscles')
    const top = document.querySelector('.rp-scroll').getBoundingClientRect().top
    const cur = document.querySelector('.rp-index [aria-current="true"]')?.textContent.trim()
    return { offset: Math.round(ch.getBoundingClientRect().top - top), cur }
  })
  ok('index: a tap jumps to its chapter and marks it current',
    Math.abs(jumped.offset) <= 4 && jumped.cur === 'العضلات', JSON.stringify(jumped))

  await scrollThrough(page)
  const titles = await chapterTitles(page)
  for (const s of CHAPTERS) ok(`chapter rendered: ${s}`, titles.includes(s), titles.join(' | '))
  ok('report: no page errors', errors.length === 0, errors.join('; '))

  const [ran, loops] = await motion(page)
  ok('motion: the entrances run', ran > 10, `${ran} animated elements`)
  ok('motion: nothing loops — one beat, then still', loops === 0, `${loops} infinite animations`)
  await ctx.close()
}

// ══ 3. Reduced motion means none ══════════════════════════════

{
  const { ctx, page, errors } = await open('2026-04-02T18:00:00+03:00', { reduced: true })
  await openReport(page)
  await scrollThrough(page)
  const [still] = await motion(page)
  ok('reduced motion: nothing animates', still === 0, `${still} still moving`)

  const titles = await chapterTitles(page)
  ok('reduced motion: the report still renders in full',
    CHAPTERS.every(s => titles.includes(s)),
    CHAPTERS.filter(s => !titles.includes(s)).join(', '))
  ok('reduced motion: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 4. The poster ═════════════════════════════════════════════
// Arabic inside a canvas is the one thing here that cannot be
// asserted — the PNG is written out to be looked at. Where the ink
// sits can be: everything between y 250 and y 1600, clear of the
// Stories header above and the reply bar below.

{
  const { ctx, page, errors } = await open('2026-04-02T18:00:00+03:00')
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
        const file = files[0]
        const b = new Uint8Array(await file.arrayBuffer())
        let s = ''
        for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i])

        // The rows that carry ink: any channel brighter than the stage light.
        const bmp = await createImageBitmap(file)
        const c = document.createElement('canvas')
        c.width = bmp.width
        c.height = bmp.height
        const x = c.getContext('2d')
        x.drawImage(bmp, 0, 0)
        const d = x.getImageData(0, 0, c.width, c.height).data
        let first = -1, last = -1
        for (let y = 0; y < c.height; y++) {
          for (let px = 0; px < c.width; px += 2) {
            const i = (y * c.width + px) * 4
            if (Math.max(d[i], d[i + 1], d[i + 2]) > 120) {
              if (first < 0) first = y
              last = y
              break
            }
          }
        }
        captured = { b64: btoa(s), name: file.name, type: file.type, bytes: b.length, first, last }
      },
      configurable: true,
    })

    document.querySelector('.rp-bar button[aria-label="مشاركة التقرير"]')?.click()
    // Give the draw, the encode and the share a moment.
    for (let i = 0; i < 80 && !captured; i++) await new Promise(r => setTimeout(r, 100))
    if (realShare) Object.defineProperty(navigator, 'share', { value: realShare, configurable: true })
    return captured
  })

  ok('poster: the share button produced a file', !!shot)
  if (shot) {
    ok('poster: it is a PNG', shot.type === 'image/png' && /\.png$/.test(shot.name), shot.name)
    ok('poster: it is not an empty image', shot.bytes > 50_000, `${(shot.bytes / 1024).toFixed(0)} KB`)
    const buf = Buffer.from(shot.b64, 'base64')
    // PNG header carries its own dimensions; no decoder needed.
    ok('poster: 1080×1920', buf.readUInt32BE(16) === 1080 && buf.readUInt32BE(20) === 1920,
      `${buf.readUInt32BE(16)}×${buf.readUInt32BE(20)}`)
    ok('poster: all of it sits between y 250 and y 1600',
      shot.first >= 250 && shot.last <= 1600, `ink from y ${shot.first} to y ${shot.last}`)
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
