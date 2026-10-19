#!/usr/bin/env node
// «جديد في مران» — end to end, on the built app.
//
//   npm run build && npx vite preview --port 5211 --strictPort --host 127.0.0.1 &
//   APP=http://127.0.0.1:5211/ node tests/whats-new.e2e.mjs
//   SHOTS=/some/dir …   also saves the sheet at 390 and 320
//
// حمزة: «نبا نرجع ميزة شرح التحديثات الجديدة لما الواحد يدخل التطبيق».
//
//   1. a user whose last seen version is old (2.2, Hamza since July)
//      gets it once, after a pause on Home: every entry since, newest
//      first, each item an icon and one line, nothing sticking out at
//      390 or 320; «تمام» stores the version (meran_seen_version) and
//      leaves hf_seen_version at the old design's 2.2; a reload shows
//      nothing; the old design at /classic/ shows no notice of its own;
//   2. back after two releases: only those two; after one: «الإصدار 3.4»;
//   3. never on a fresh install (the setup questions come, the version is
//      marked seen silently);
//   4. never over the session, nor over its summary: it waits for «تم»;
//   5. it waits for the art offer, and comes after «بعدين»;
//   6. reduced motion: it fades in and «تمام» still works.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { mkdirSync } from 'node:fs'
import { APP_VERSION, ACHIEVEMENTS, BUILT_IN_PLANS, WHATS_NEW } from '../src/constants.js'

const APP = process.env.APP || 'http://127.0.0.1:5211/'
const SHOTS = process.env.SHOTS || null
if (SHOTS) mkdirSync(SHOTS, { recursive: true })

const results = []
const ok = (name, cond, extra = '') => results.push([name, !!cond, extra])
const report = () => {
  for (const [n, p, e] of results) console.log(p ? '✅' : '❌', n, !p && e ? `— ${e}` : '')
  const failed = results.filter(r => !r[1]).length
  console.log(failed ? `\n${failed} failed` : `\nall ${results.length} passed`)
  return failed
}
process.on('uncaughtException', (e) => {
  report()
  console.log(`\n❌ stopped: ${String(e?.message || e).split('\n')[0]}`)
  process.exit(1)
})

const plan = JSON.parse(JSON.stringify(BUILT_IN_PLANS.find(p => p.planId === 'machine_beginner_3day')))
plan.startDate = '2026-10-01'
const DAY = 86400000
const SESSIONS = [3, 5].map((d, i) => ({
  id: Date.now() - d * DAY, date: new Date(Date.now() - d * DAY).toISOString(), duration: 45, planDayIndex: i,
  exercises: [{ id: `x${i}`, muscle: 'Back', name: 'Lat Pulldown', sets: [{ weight: '60', reps: '10', done: true }] }],
}))
const BASE = {
  hf_plan: plan, hf_plan_index: 2, hf_sessions: SESSIONS, hf_onboarded: true, hf_pack_prompted: true,
  hf_weights_reset_v2: true, hf_profile: { name: 'حمزة' }, meran_rest_announced: [],
  hf_unlocked: ACHIEVEMENTS.map(a => a.id), hf_xp: 2600,
}

const browser = await chromium.launch()

async function open({ seed, viewport = null, reduced = false, size = 'iPhone 13' } = {}) {
  const ctx = await browser.newContext({
    ...devices[size], ...(viewport ? { viewport } : null), locale: 'ar', timezoneId: 'Asia/Riyadh',
    serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference',
  })
  await ctx.route(u => u.pathname.startsWith('/pack/'), r => r.abort())
  await ctx.addInitScript((seed) => {
    try {
      if (localStorage.getItem('__seeded')) return
      localStorage.setItem('__seeded', '1')
      for (const [k, v] of Object.entries(seed)) {
        if (v === null) localStorage.removeItem(k)
        else localStorage.setItem(k, JSON.stringify(v))
      }
    } catch { /* the browser's own error page */ }
  }, seed)
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)))
  return { ctx, page, errors }
}
const sheet = (page) => page.locator('[data-testid="whats-new"]')
const shown = async (page) => (await sheet(page).count()) > 0
const stored = (page, k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), k)
const versionsShown = (page) => page.$$eval('[data-testid="whats-new"] [data-version]', els => els.map(e => e.dataset.version))
const tapOk = async (page) => { await page.locator('[data-testid="whats-new-ok"]').click(); await page.waitForTimeout(700) }

// ══ 1. Hamza, at 2.2 since July ══
for (const [w, h] of [[390, 844], [320, 568]]) {
  const { ctx, page, errors } = await open({ seed: { ...BASE, hf_seen_version: '2.2' }, viewport: { width: w, height: h } })
  await page.goto(APP, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(900)
  ok(`old version @${w}: not at once — Home first`, !(await shown(page)))
  await sheet(page).waitFor({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(900)
  ok(`old version @${w}: «جديد في مران» comes up by itself`, await shown(page))
  const vs = await versionsShown(page)
  ok(`old version @${w}: every entry since 2.2, newest first`, JSON.stringify(vs) === JSON.stringify(WHATS_NEW.map(e => e.version)), vs.join(','))
  const text = await sheet(page).innerText()
  ok(`old version @${w}: «وش تغيّر من آخر مرة» with how many releases`, /وش تغيّر من آخر مرة/.test(text) && /تحديثات/.test(text), text.slice(0, 80))
  const items = await page.locator('[data-testid="whats-new"] .wn-item').count()
  ok(`old version @${w}: every item listed, each with its icon`, items === WHATS_NEW.reduce((n, e) => n + e.items.length, 0)
    && await page.locator('[data-testid="whats-new"] .wn-item .wn-glyph svg').count() === items, String(items))
  ok(`old version @${w}: the app's own icon on top`, await page.locator('[data-testid="whats-new"] img.wn-mark').evaluate(i => i.complete && i.naturalWidth > 0))
  const wide = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    return [...document.querySelectorAll('.k-sheet, .k-sheet *')].filter(el => {
      const r = el.getBoundingClientRect()
      return r.width && (r.left < -1 || r.right > vw + 1)
    }).map(el => el.className).slice(0, 3)
  })
  ok(`old version @${w}: nothing sticks out sideways`, wide.length === 0, wide.join(' | '))
  const app = await page.evaluate(() => ({ inert: !!document.getElementById('root').inert, overflow: document.body.style.overflow }))
  ok(`old version @${w}: the app is held behind it (inert, no scroll)`, app.inert && app.overflow === 'hidden', JSON.stringify(app))
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/whats-new-${w}.png` })
    await page.locator('.k-sheet-body').evaluate(el => { el.scrollTop = el.scrollHeight })
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${SHOTS}/whats-new-${w}-end.png` })
  }
  await tapOk(page)
  ok(`old version @${w}: «تمام» closes it`, !(await shown(page)))
  ok(`old version @${w}: «تمام» stores the version`, await stored(page, 'meran_seen_version') === APP_VERSION)
  ok(`old version @${w}: hf_seen_version stays at the old design's 2.2`, await stored(page, 'hf_seen_version') === '2.2')
  const after = await page.evaluate(() => ({ inert: !!document.getElementById('root').inert, overflow: document.body.style.overflow }))
  ok(`old version @${w}: Home is his again (not inert, scrolls)`, !after.inert && after.overflow === '', JSON.stringify(after))
  if (w === 390) {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(4500)
    ok('old version: once only — a reload shows nothing', !(await shown(page)))
    await page.goto(new URL('classic/', APP).href, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    const classic = await page.evaluate(() => document.body.innerText)
    ok('old version: the old design shows no notice of its own after it', !/خطة المبتدأ — ماشينات فقط|إضاءة التمرين النشط/.test(classic), classic.slice(0, 120))
    ok('old version: and hf_seen_version is still 2.2 there', await stored(page, 'hf_seen_version') === '2.2')
  }
  ok(`old version @${w}: no page errors`, errors.length === 0, errors.slice(0, 2).join(' | '))
  await ctx.close()
}

// ══ 2. Back after two releases; after one ══
{
  const { ctx, page, errors } = await open({ seed: { ...BASE, hf_seen_version: '2.2', meran_seen_version: '3.2' } })
  await page.goto(APP, { waitUntil: 'domcontentloaded' })
  await sheet(page).waitFor({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(600)
  ok('at 3.2: only the two releases since', JSON.stringify(await versionsShown(page)) === JSON.stringify(['3.4', '3.3']), (await versionsShown(page)).join(','))
  await tapOk(page)
  ok('at 3.2: «تمام» stores 3.4', await stored(page, 'meran_seen_version') === APP_VERSION)
  ok('at 3.2: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '))
  await ctx.close()
}
{
  const { ctx, page } = await open({ seed: { ...BASE, hf_seen_version: '2.2', meran_seen_version: '3.3' } })
  await page.goto(APP, { waitUntil: 'domcontentloaded' })
  await sheet(page).waitFor({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(600)
  const text = (await shown(page)) ? await sheet(page).innerText() : ''
  ok('at 3.3: one release — «الإصدار 3.4» and its date', /الإصدار\s*3\.4/.test(text) && /19 أكتوبر/.test(text) && !/وش تغيّر/.test(text), text.slice(0, 80))
  await ctx.close()
}
{
  const { ctx, page } = await open({ seed: { ...BASE, hf_seen_version: '2.2', meran_seen_version: APP_VERSION } })
  await page.goto(APP, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4500)
  ok('up to date: nothing', !(await shown(page)))
  await ctx.close()
}

// ══ 3. Never on a fresh install ══
{
  const { ctx, page, errors } = await open({ seed: { hf_pack_prompted: true } })
  await page.goto(APP, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4500)
  ok('fresh install: the setup questions, not the changelog', await page.locator('.ob').count() > 0 && !(await shown(page)))
  ok('fresh install: marked seen silently', await stored(page, 'meran_seen_version') === APP_VERSION && await stored(page, 'hf_seen_version') === '2.2')
  ok('fresh install: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '))
  await ctx.close()
}

// ══ 4. Never over the session, nor over its summary ══
{
  const ACTIVE = {
    id: Date.now() - 20 * 60000, date: new Date().toISOString(),
    exercises: [{ id: 'a', muscle: 'Back', name: 'Lat Pulldown', sets: [{ weight: '60', reps: '10', done: true }, { weight: '60', reps: '10', done: true }] }],
  }
  const { ctx, page, errors } = await open({ seed: { ...BASE, hf_seen_version: '2.2', hf_active: ACTIVE } })
  await page.goto(APP, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="session-cover"]').waitFor({ timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(3500)
  ok('session: a session restored at launch is not covered by it', await page.locator('[data-testid="session-cover"]').count() === 1 && !(await shown(page)))
  await page.getByRole('button', { name: /^إنهاء$/ }).click()
  await page.waitForTimeout(500)
  await page.locator('.k-sheet').last().getByRole('button', { name: 'احفظ وأنهِ' }).click()
  await page.locator('[data-testid="session-summary"]').waitFor({ timeout: 8000 }).catch(() => {})
  let both = false
  for (let i = 0; i < 12; i++) {
    if (await page.locator('[data-testid="session-summary"]').count() && await shown(page)) both = true
    await page.waitForTimeout(300)
  }
  ok('summary: the summary is up, and it waits behind it', await page.locator('[data-testid="session-summary"]').count() === 1 && !(await shown(page)) && !both)
  await page.getByRole('button', { name: /^تم$/ }).click()
  // a level reached in the session has its own screen first
  for (let i = 0; i < 20 && !(await shown(page)); i++) {
    if (await page.locator('[data-testid="level-up"]').count()) await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(400)
  }
  ok('summary: after «تم», it comes up — alone', await shown(page) && await page.locator('[data-testid="session-summary"]').count() === 0
    && await page.locator('[data-testid="level-up"]').count() === 0)
  await tapOk(page)
  ok('summary: «تمام» stores the version', await stored(page, 'meran_seen_version') === APP_VERSION)
  ok('summary: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '))
  await ctx.close()
}

// ══ 5. It waits for the art offer ══
{
  const { ctx, page, errors } = await open({ seed: { ...BASE, hf_seen_version: '2.2', hf_pack_prompted: null } })
  await page.goto(APP, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-pack-prompt]').waitFor({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(2500)
  const offer = await page.locator('[data-pack-prompt]').count()
  ok('art offer: the offer is up and «جديد في مران» waits', offer === 1 && !(await shown(page)), `offer ${offer}`)
  await page.locator('[data-pack="offer-later"]').click()
  await sheet(page).waitFor({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(500)
  ok('art offer: after «بعدين», it comes up, alone', await shown(page) && await page.locator('[data-pack-prompt]').count() === 0)
  ok('art offer: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '))
  await ctx.close()
}

// ══ 6. Reduced motion ══
{
  const { ctx, page, errors } = await open({ seed: { ...BASE, hf_seen_version: '3.3' }, reduced: true })
  await page.goto(APP, { waitUntil: 'domcontentloaded' })
  await sheet(page).waitFor({ timeout: 6000 }).catch(() => {})
  const moved = await page.evaluate(() => document.getAnimations().some(a => {
    const kf = a.effect?.getKeyframes?.() || []
    return kf.some(k => k.transform && k.transform !== 'none')
  }))
  ok('reduced motion: it comes up with a fade, nothing slides or pops', await shown(page) && !moved)
  await tapOk(page)
  ok('reduced motion: «تمام» works', !(await shown(page)) && await stored(page, 'meran_seen_version') === APP_VERSION)
  ok('reduced motion: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '))
  await ctx.close()
}

await browser.close()
process.exit(report() ? 1 : 0)
