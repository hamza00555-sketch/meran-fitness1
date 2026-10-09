#!/usr/bin/env node
// End-to-end checks for the التقدم tab and the two celebration screens.
//
//   npm run build && npx vite preview --port 4173 &
//   node tests/progress.e2e.mjs
//
// What it proves on a phone-sized page: the deload-end and level-up
// screens appear, speak Arabic only and dismiss the way App expects;
// the achievements view has its stage, ladder, «التالي» and 40 medals
// with no gold on it and no text under 12px; the numbers view draws its
// two twelve-week charts; and photos can be added from the library
// through a preview step, compared, and deleted only after a confirm —
// stored in exactly the shape the old design reads — and a full store
// says so instead of showing a photo that was never saved.
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
async function open(fixture, extra = {}) {
  const f = resolve(fixture)
  const ctx = await browser.newContext({ ...devices['iPhone 13'], timezoneId: 'Asia/Riyadh', locale: 'ar' })
  await ctx.route('**/*.r2.dev/**', r => r.abort())
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  await ctx.addInitScript(init, [{ hf_onboarded: true, ...f.seed, ...extra }, f.clock])
  await page.goto(APP, { waitUntil: 'networkidle' })
  return { ctx, page, errors }
}
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
  ok('ach: no errors', !errors.length, errors.join('; '))
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

// 6. Photos: storage full says so and keeps state honest
{
  const { ctx, page, errors } = await open('veteran')
  await page.waitForTimeout(800)
  await toProgress(page, 'الصور')
  // Fill localStorage to the brim with a throwaway key.
  await page.evaluate(() => {
    let chunk = 'x'.repeat(1024 * 256)
    let i = 0
    try { for (;;) localStorage.setItem('__fill' + i++, chunk) } catch {}
    chunk = 'x'.repeat(1024 * 8)
    try { for (;;) localStorage.setItem('__fillb' + i++, chunk) } catch {}
  })
  await page.getByRole('button', { name: 'أضف صورة' }).first().click()
  await page.waitForTimeout(300)
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /اختر من الصور/ }).click()])
  await chooser.setFiles(PHOTO)
  await page.waitForTimeout(900)
  await page.getByRole('button', { name: 'احفظ الصورة' }).click()
  await page.waitForTimeout(500)
  const t = await page.evaluate(() => document.body.innerText)
  ok('photos full: says the store is full', /التخزين ممتلئ/.test(t))
  ok('photos full: no phantom photo', await page.locator('.ph-thumb').count() === 0)
  ok('photos full: no errors', !errors.length, errors.join('; '))
  await ctx.close()
}

await browser.close()
let fail = 0
for (const [n, p, x] of results) { console.log(p ? 'PASS' : 'FAIL', n, p ? '' : x); if (!p) fail++ }
console.log(`${results.length - fail}/${results.length}`)
process.exit(fail ? 1 : 0)
