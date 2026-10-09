#!/usr/bin/env node
// End-to-end checks for the التقدم tab and the two celebration screens.
//
//   npm run build && npx vite preview --port 4173 &
//   node tests/progress.e2e.mjs
//
// What it proves on a phone-sized page: the deload-end and level-up
// screens appear, speak Arabic only and dismiss the way App expects;
// the achievements view has its stage, ladder, «التالي» and 40 medals
// with no gold on it and no text under 12px, «التالي» starts a new
// lifter at «الخطوة الأولى», and the copy says «مجموعة» and names lifts
// in Arabic; the numbers view draws its two twelve-week charts, never
// leads with a bold zero, and in a best week the scale and the newest
// bar's value do not overlap; and photos can be added from the library
// through a preview step, compared, and deleted only after a confirm —
// stored in exactly the shape the old design reads — and a full store
// says so where the user can actually see it (inside the preview sheet,
// not under its scrim), instead of showing a photo that was never saved.
//
// Fixtures come from scripts/screens.manifest.mjs, like the screenshots.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { FIXTURES } from '../scripts/screens.manifest.mjs'

const APP = process.env.APP || 'http://localhost:4173/'
const OUT = process.env.OUT || '/tmp/meran-progress-e2e'
mkdirSync(OUT, { recursive: true })
const PHOTO = fileURLToPath(new URL('../public/assets/hero_training.webp', import.meta.url))
const results = []
const ok = (name, cond, extra = '') => results.push([name, !!cond, extra])

function resolve(name) {
  const f = FIXTURES[name]
  const base = f.extend ? resolve(f.extend) : { seed: {} }
  return { clock: f.clock ?? base.clock ?? null, seed: { ...base.seed, ...f.seed } }
}
function init([seed, clock]) {
  if (!sessionStorage.getItem('__seeded')) {
    sessionStorage.setItem('__seeded', '1')
    localStorage.clear()
    for (const [k, v] of Object.entries(seed)) if (v != null) localStorage.setItem(k, JSON.stringify(v))
  }
  if (clock) {
    const real = Date, fixed = new real(clock).getTime(), start = real.now()
    class D extends real {
      constructor(...a) { return a.length ? new real(...a) : new real(fixed + (real.now() - start)) }
      static now() { return fixed + (real.now() - start) }
    }
    globalThis.Date = D
  }
}

const browser = await chromium.launch()
const SE = { ...devices['iPhone SE'], viewport: { width: 320, height: 568 } }
async function open(fixture, extra = {}, { device = devices['iPhone 13'], photos = 0 } = {}) {
  const f = resolve(fixture)
  const ctx = await browser.newContext({ ...device, timezoneId: 'Asia/Riyadh', locale: 'ar' })
  await ctx.route('**/*.r2.dev/**', r => r.abort())
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  const seed = { hf_onboarded: true, ...f.seed, ...extra }
  if (photos) { await page.goto('about:blank'); seed.hf_photos = await makePhotos(page, photos) }
  await ctx.addInitScript(init, [seed, f.clock])
  await page.goto(APP, { waitUntil: 'networkidle' })
  return { ctx, page, errors }
}

/** Small portrait JPEGs in the stored shape, oldest first. */
function makePhotos(page, n) {
  return page.evaluate((n) => Array.from({ length: n }, (_, i) => {
    const c = document.createElement('canvas'); c.width = 60; c.height = 80
    const g = c.getContext('2d'); g.fillStyle = `hsl(${i * 70},30%,40%)`; g.fillRect(0, 0, 60, 80)
    return { id: 1000 + i, date: new Date(2026, 3 + i, 1, 9).toISOString(), note: '', src: c.toDataURL('image/jpeg', 0.6) }
  }), n)
}

/** Can the user see it? On screen, and the topmost thing at its centre
 *  is the element itself — not a scrim or a sheet drawn over it. */
const seen = (page, sel) => page.evaluate((sel) => {
  const el = document.querySelector(sel)
  if (!el) return 'missing'
  const r = el.getBoundingClientRect()
  if (r.height === 0 || r.bottom <= 0 || r.top >= innerHeight) return 'off screen'
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
  return hit && el.contains(hit) ? 'ok' : `covered by ${hit?.className || hit?.tagName}`
}, sel)

/** Fill localStorage to the brim with throwaway keys. */
const fillStorage = (page) => page.evaluate(() => {
  let chunk = 'x'.repeat(1024 * 256)
  let i = 0
  try { for (;;) localStorage.setItem('__fill' + i++, chunk) } catch {}
  chunk = 'x'.repeat(1024 * 8)
  try { for (;;) localStorage.setItem('__fillb' + i++, chunk) } catch {}
})

/** Text of every chart's scale tick that overlaps a value label —
 *  measured on the glyphs (a Range), not on the padded boxes. */
const chartClashes = (page) => page.evaluate(() => {
  const box = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect() }
  const meet = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5
  const out = [], missing = []
  for (const fig of document.querySelectorAll('.bc')) {
    const vals = [...fig.querySelectorAll('.bc-val')]
    const ticks = [...fig.querySelectorAll('.bc-tick')]
    if (!ticks.some(t => t.textContent.trim()) || !fig.querySelector('.bc-col.on .bc-val')) missing.push(fig.getAttribute('aria-label').slice(0, 30))
    for (const t of ticks) {
      for (const v of vals) if (meet(box(t), box(v))) out.push(`${t.textContent} × ${v.textContent}`)
    }
  }
  return { out, missing }
})
const toProgress = async (page, view) => {
  await page.locator('nav > button').nth(2).click()
  await page.waitForTimeout(400)
  if (view) { await page.getByRole('tab', { name: view }).click(); await page.waitForTimeout(400) }
}

// 1. Deload end: shown, names the weight, dismissal sticks against the end date
{
  const { ctx, page, errors } = await open('deload-ended')
  await page.waitForTimeout(900)
  const text = await page.evaluate(() => document.body.innerText)
  ok('deload end: appears', /خلص الديلود/.test(text))
  ok('deload end: names the weight', /كجم/.test(text) && /80/.test(text))
  ok('deload end: no English eyebrow', !/DELOAD/.test(text))
  await page.getByRole('button', { name: /يلا نكمل/ }).first().click()
  await page.waitForTimeout(400)
  ok('deload end: dismissed', !/خلص الديلود/.test(await page.evaluate(() => document.body.innerText)))
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_recovery')))
  ok('deload end: recorded', stored?.deloadEndSeenAt === '2026-07-12', JSON.stringify(stored?.deloadEndSeenAt))
  ok('deload end: no errors', !errors.length, errors.join('; '))
  await ctx.close()
}

// 2. Level up: appears outside a session, Arabic only, كمّل dismisses, no crown emoji
{
  const one = [{ id: 1, date: '2026-07-07T15:00:00.000Z', duration: 45, exercises: [{ id: 'x', muscle: 'Chest', name: 'Bench Press', sets: [{ weight: '80', reps: '12', done: true }, { weight: '80', reps: '12', done: true }] }] }]
  const { ctx, page, errors } = await open('fresh', { hf_xp: 4000, hf_sessions: one })
  await page.waitForSelector('[data-testid="level-up"]', { timeout: 6000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const lu = page.locator('[data-testid="level-up"]')
  ok('level up: shows', await lu.count() === 1)
  const t = await lu.innerText().catch(() => '')
  ok('level up: says مستوى جديد', /مستوى جديد/.test(t), t.slice(0, 80))
  ok('level up: no LEVEL UP / emoji', !/LEVEL UP|👑|💪/.test(t))
  ok('level up: number 4', /4/.test(t))
  ok('level up: share offered', await page.getByRole('button', { name: 'شارك' }).count() === 1)
  await page.getByRole('button', { name: 'شارك' }).click()
  await page.waitForTimeout(1500)
  const card = await page.evaluate(() => {
    const img = [...document.querySelectorAll('.cel-inline img')][0]
    return img ? { w: img.naturalWidth, h: img.naturalHeight } : null
  })
  ok('level up: share draws a 1080×1920 card', card && card.w === 1080 && card.h === 1920, JSON.stringify(card))
  await page.screenshot({ path: `${OUT}/levelup-share.png` })
  if (card) { await page.getByRole('button', { name: 'إغلاق' }).click(); await page.waitForTimeout(400) }
  await page.getByRole('button', { name: 'كمّل' }).click()
  await page.waitForTimeout(400)
  ok('level up: dismissed', await lu.count() === 0)
  ok('level up: no errors', !errors.length, errors.join('; '))
  await ctx.close()
}

// 3. Achievements: rank stage, ladder, next, grid, sheet; no gold
{
  const { ctx, page, errors } = await open('veteran', { hf_unlocked: ['a1', 'a2', 'c7'], hf_xp: 9100 })
  await page.waitForTimeout(2500)
  const b = page.getByRole('button', { name: 'كمّل' })
  if (await b.count()) { await b.click(); await page.waitForTimeout(300) }
  await toProgress(page, 'الإنجازات')
  ok('ach: stage', await page.locator('.pg-stage').count() === 1)
  ok('ach: ladder has 7 ranks', await page.locator('.rl-node').count() === 7)
  ok('ach: 40 tiles', await page.locator('.pg-tile').count() === 40)
  const next = await page.locator('.pg-next-row').count()
  ok('ach: next row shows up to 3', next >= 1 && next <= 3, String(next))
  await page.getByRole('button', { name: 'القوة' }).click()
  await page.waitForTimeout(200)
  ok('ach: filter narrows to 10', await page.locator('.pg-tile').count() === 10)
  await page.locator('.pg-tile').first().click()
  await page.waitForTimeout(500)
  ok('ach: sheet opens', await page.getByRole('dialog').count() >= 1)
  await page.getByRole('button', { name: 'إغلاق' }).click()
  await page.waitForTimeout(400)
  const gold = await page.evaluate(() => {
    const hits = []
    for (const el of document.querySelectorAll('[data-testid="achievements"] *')) {
      const cs = getComputedStyle(el)
      for (const p of ['color', 'backgroundColor', 'borderTopColor']) {
        if (/251, 191, 36|245, 158, 11|234, 179, 8/.test(cs[p])) hits.push(el.className + ' ' + p)
      }
    }
    return hits
  })
  ok('ach: no gold on the page', gold.length === 0, gold.slice(0, 3).join(', '))
  const small = await page.evaluate(() => [...document.querySelectorAll('[data-testid="achievements"] *')]
    .filter(el => el.childNodes.length && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
    .filter(el => parseFloat(getComputedStyle(el).fontSize) < 12).map(el => el.textContent.slice(0, 20)))
  ok('ach: no text under 12px', small.length === 0, small.slice(0, 3).join(' | '))
  await page.getByRole('button', { name: 'الكل' }).click()
  await page.waitForTimeout(200)
  const wall = await page.locator('[data-testid="achievements"]').innerText()
  ok('ach: «مجموعة», never «سيت»', !/سيت/.test(wall) && /15 مجموعة في جلسة/.test(wall), (wall.match(/.{0,12}سيت.{0,12}/) || [''])[0])
  await page.getByRole('button', { name: /^الثلاثية الكبرى/ }).click()
  await page.waitForTimeout(500)
  const b8 = await page.getByRole('dialog').innerText()
  ok('ach: lifts named in Arabic', /ديدلفت/.test(b8) && /سكوات/.test(b8) && /بنش/.test(b8) && !/Deadlift|Bench|Squat/.test(b8), b8.replace(/\s+/g, ' ').slice(0, 120))
  await page.getByRole('button', { name: 'إغلاق' }).click()
  await page.waitForTimeout(300)
  ok('ach: no errors', !errors.length, errors.join('; '))
  await ctx.close()
}

// 3b. Achievements, day one: «التالي» starts at the first step
{
  const { ctx, page, errors } = await open('fresh')
  await page.waitForTimeout(800)
  await toProgress(page, 'الإنجازات')
  const titles = await page.locator('.pg-next-title').allInnerTexts()
  ok('ach fresh: «التالي» starts with «الخطوة الأولى»', titles[0] === 'الخطوة الأولى', titles.join(' · '))
  ok('ach fresh: no «عاد من جديد» before the first session', !titles.includes('عاد من جديد'), titles.join(' · '))
  ok('ach fresh: no errors', !errors.length, errors.join('; '))
  await ctx.close()
}

// 4. Numbers view renders charts
{
  const { ctx, page, errors } = await open('report')
  await page.waitForTimeout(800)
  await toProgress(page, 'الأرقام')
  ok('numbers: two charts', await page.locator('.bc').count() === 2)
  ok('numbers: 12 weeks each', await page.locator('.bc').first().locator('.bc-col').count() === 12)
  const t = await page.locator('[data-testid="numbers"]').innerText()
  ok('numbers: no English labels', !/\bsets\b|Volume|Streak|kg\b/.test(t), t.slice(0, 100))
  const small = await page.evaluate(() => [...document.querySelectorAll('[data-testid="numbers"] *')]
    .filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
    .filter(el => parseFloat(getComputedStyle(el).fontSize) < 12).map(el => el.textContent.slice(0, 20)))
  ok('numbers: no text under 12px', small.length === 0, small.slice(0, 3).join(' | '))
  ok('numbers: no errors', !errors.length, errors.join('; '))
  await ctx.close()
}

// 4b. Numbers before the first session of the week: no bold zero, and
//     a number never parts from its unit
{
  const { ctx, page, errors } = await open('veteran')
  await page.waitForTimeout(800)
  await toProgress(page, 'الأرقام')
  const hero = await page.locator('.nb-hero').innerText()
  ok('numbers quiet week: leads with last week', /حجم الأسبوع اللي فات/.test(hero) && /1\.9/.test(hero), hero.replace(/\s+/g, ' '))
  ok('numbers quiet week: big number is not zero', (await page.locator('.nb-big').innerText()).trim() !== '0')
  ok('numbers quiet week: says this week is still empty', /ما تمرّنت هذا الأسبوع للحين/.test(hero))
  // A bidi-isolated number makes its own box, so one line can hold
  // several rects: count the lines (distinct centres), not the rects.
  const split = await page.evaluate(() => [...document.querySelectorAll('[data-testid="numbers"] .nb-nw')]
    .filter(el => {
      const mids = [...el.getClientRects()].map(r => (r.top + r.bottom) / 2)
      return Math.max(...mids) - Math.min(...mids) > 4
    }).map(el => el.textContent))
  ok('numbers: units stay with their numbers', split.length === 0, split.join(' | '))
  ok('numbers quiet week: no errors', !errors.length, errors.join('; '))
  await ctx.close()
}

// 4c. A best week — this week is the twelve-week max — on both phones:
//     the scale and the newest bar's value never overlap
{
  const base = resolve('veteran').seed.hf_sessions
  const tmpl = base[base.length - 1]
  const extra = ['2026-07-05T15:00:00.000Z', '2026-07-06T15:00:00.000Z', '2026-07-07T15:00:00.000Z', '2026-07-08T05:00:00.000Z']
    .map((d, i) => ({ ...JSON.parse(JSON.stringify(tmpl)), id: 900000 + i, date: d }))
  for (const [name, device] of [['iPhone 13', devices['iPhone 13']], ['SE', SE]]) {
    const { ctx, page, errors } = await open('veteran', { hf_sessions: [...base, ...extra] }, { device })
    await page.waitForTimeout(800)
    await toProgress(page, 'الأرقام')
    const best = await page.evaluate(() => [...document.querySelectorAll('.bc')].map(fig => {
      const hs = [...fig.querySelectorAll('.bc-bar')].map(b => b.getBoundingClientRect().height)
      return hs[hs.length - 1] >= Math.max(...hs) - 0.5
    }))
    ok(`numbers best week (${name}): this week is the tallest bar`, best.length === 2 && best.every(Boolean), JSON.stringify(best))
    const clash = await chartClashes(page)
    ok(`numbers best week (${name}): each chart has its scale and this week's value`, clash.missing.length === 0, clash.missing.join(' | '))
    ok(`numbers best week (${name}): scale and values do not overlap`, clash.out.length === 0, clash.out.join(' | '))
    const wide = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
    ok(`numbers best week (${name}): no sideways scroll`, wide)
    await page.evaluate(() => document.querySelector('.nb-card').scrollIntoView({ block: 'center' }))
    await page.waitForTimeout(200)
    await page.locator('.nb-card').first().screenshot({ path: `${OUT}/best-week-${name.replace(/\s/g, '')}.png` })
    ok(`numbers best week (${name}): no errors`, !errors.length, errors.join('; '))
    await ctx.close()
  }
}

// 5. Photos: add from library via preview, compare, delete with confirm
{
  const { ctx, page, errors } = await open('veteran')
  await page.waitForTimeout(800)
  await toProgress(page, 'الصور')
  await page.getByRole('button', { name: 'أضف صورة' }).first().click()
  await page.waitForTimeout(400)
  const capture = await page.evaluate(() => [...document.querySelectorAll('input[type=file]')].map(i => i.getAttribute('capture')))
  ok('photos: one camera input and one library input', capture.includes('environment') && capture.includes(null), JSON.stringify(capture))
  for (let i = 0; i < 2; i++) {
    if (i) { await page.getByRole('button', { name: 'أضف صورة' }).first().click(); await page.waitForTimeout(400) }
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /اختر من الصور/ }).click()])
    await chooser.setFiles(PHOTO)
    await page.waitForTimeout(900)
    ok(`photos: preview step ${i}`, await page.getByRole('button', { name: 'احفظ الصورة' }).count() === 1)
    if (!i) await page.locator('.ph-note input').fill('الأسبوع 1')
    await page.getByRole('button', { name: 'احفظ الصورة' }).click()
    await page.waitForTimeout(600)
  }
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_photos') || '[]'))
  ok('photos: stored in the same shape', stored.length === 2 && stored.every(p => p.id && p.date && typeof p.src === 'string' && p.src.startsWith('data:image/jpeg') && 'note' in p) && stored[0].note === 'الأسبوع 1', JSON.stringify(stored.map(p => ({ ...p, src: p.src.slice(0, 20) }))))
  ok('photos: grid shows 2', await page.locator('.ph-thumb').count() === 2)
  await page.getByRole('button', { name: 'قارن' }).click()
  await page.getByRole('button', { name: 'قارن الصورتين' }).click()
  await page.waitForTimeout(400)
  ok('photos: compare opens', await page.locator('.ph-cmp').count() === 1)
  await page.locator('.ph-cmp .ph-view-back').click()
  await page.waitForTimeout(300)
  await page.locator('.ph-thumb').first().click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'حذف الصورة' }).click()
  await page.waitForTimeout(400)
  ok('photos: delete asks first', await page.getByRole('button', { name: 'احذف الصورة' }).count() === 1)
  await page.getByRole('button', { name: 'احذف الصورة' }).click()
  await page.waitForTimeout(500)
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_photos') || '[]'))
  ok('photos: deleted one', after.length === 1)
  ok('photos: no errors', !errors.length, errors.join('; '))
  await ctx.close()
}

// 6. Photos: storage full says so where the user is looking, and keeps
//    state honest — on the small phone, where the sheet covers the most
{
  const { ctx, page, errors } = await open('veteran', {}, { device: SE })
  await page.waitForTimeout(800)
  await toProgress(page, 'الصور')
  await fillStorage(page)
  await page.getByRole('button', { name: 'أضف صورة' }).first().click()
  await page.waitForTimeout(300)
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /اختر من الصور/ }).click()])
  await chooser.setFiles(PHOTO)
  await page.waitForTimeout(900)
  await page.getByRole('button', { name: 'احفظ الصورة' }).click()
  await page.waitForTimeout(500)
  const inSheet = await seen(page, '.k-sheet .k-banner')
  ok('photos full: the notice is visible in the preview sheet', inSheet === 'ok', inSheet)
  ok('photos full: the notice says the store is full', /التخزين ممتلئ/.test(await page.locator('.k-sheet .k-banner').innerText().catch(() => '')))
  ok('photos full: no save button that cannot work', await page.getByRole('button', { name: 'احفظ الصورة' }).count() === 0)
  await page.screenshot({ path: `${OUT}/photos-full-sheet-se.png` })
  await page.getByRole('button', { name: 'إلغاء' }).click()
  await page.waitForTimeout(900)
  const onPage = await seen(page, '.ph-alert .k-banner')
  ok('photos full: after «إلغاء» the notice stays visible on the page', onPage === 'ok', onPage)
  ok('photos full: no phantom photo', await page.locator('.ph-thumb').count() === 0)
  ok('photos full: no errors', !errors.length, errors.join('; '))
  await ctx.close()
}

// 6b. Photos: storage full with old photos — «احذف صور قديمة» leads to
//     the oldest one, and deleting it clears the notice
{
  const { ctx, page, errors } = await open('veteran', {}, { photos: 3 })
  await page.waitForTimeout(800)
  await toProgress(page, 'الصور')
  await fillStorage(page)
  await page.getByRole('button', { name: 'أضف صورة' }).first().click()
  await page.waitForTimeout(300)
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /اختر من الصور/ }).click()])
  await chooser.setFiles(PHOTO)
  await page.waitForTimeout(900)
  await page.getByRole('button', { name: 'احفظ الصورة' }).click()
  await page.waitForTimeout(500)
  ok('photos full + old: notice visible in the sheet', await seen(page, '.k-sheet .k-banner') === 'ok')
  await page.getByRole('button', { name: 'احذف صور قديمة' }).click()
  await page.waitForTimeout(700)
  const pos = await page.locator('.ph-view-pos').innerText().catch(() => '')
  ok('photos full + old: opens the oldest photo', /3\s*\/\s*3/.test(pos), pos)
  await page.getByRole('button', { name: 'حذف الصورة' }).click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'احذف الصورة' }).click()
  await page.waitForTimeout(600)
  const left = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_photos') || '[]').map(p => p.id))
  ok('photos full + old: the oldest is gone', left.length === 2 && !left.includes(1000), JSON.stringify(left))
  await page.locator('.ph-view .ph-view-back').click()
  await page.waitForTimeout(400)
  ok('photos full + old: the notice clears once space is freed', await page.locator('.ph-alert').count() === 0)
  ok('photos full + old: no errors', !errors.length, errors.join('; '))
  await ctx.close()
}

await browser.close()
let fail = 0
for (const [n, p, x] of results) { console.log(p ? 'PASS' : 'FAIL', n, p ? '' : x); if (!p) fail++ }
console.log(`${results.length - fail}/${results.length}`)
process.exit(fail ? 1 : 0)
