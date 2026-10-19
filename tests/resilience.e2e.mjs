#!/usr/bin/env node
// «خطتي» never leaves a black screen — end to end, on the built app.
//
//   npm run build && npx vite preview --port 5211 --strictPort --host 127.0.0.1 &
//   APP=http://127.0.0.1:5211/ node tests/resilience.e2e.mjs
//   SHOTS=/some/dir …   also saves the fallback card at 390 and 320
//
// حمزة: «احيانا لما ادخل خطتي البرنامج يعلق على شاشة سودا وماعاد يفتح».
// The cause, reproduced in section 5 on the build before the fix: a deploy
// while the app was open. The service worker took over at once and
// deleted the old version's files from its cache; the old page then asked
// for its «خطتي» chunk, the server answered with index.html, the import
// failed, nothing caught it, and React unmounted the whole app — #root
// empty, the ground colour, black, for good.
//
//   1. a chunk that 404s once: the app reloads by itself, once, and
//      «خطتي» is open after it — no second tap, never a black screen;
//   2. a chunk that never arrives: one automatic reload and no more, then
//      the card «ما قدرنا نفتح خطتي» with «جرّب مرة ثانية» (which reloads
//      and opens it, now that it arrives) and «رجوع» (Home usable: it
//      scrolls, it is not inert, the tabs work);
//   3. a slow chunk: «نفتح خطتي…» after 300 ms instead of nothing, then
//      the page; its × closes;
//   4. an error thrown inside «خطتي» — on its first render, and after it
//      opened (its scroll lock and the inert app then held): the card,
//      the lock and inert released, Home usable, «خطتي» opens again;
//   5. a new deploy under an open page (service worker on, a stand-in
//      for Vercel: tests/deploy-origin.mjs): the new version WAITS — the
//      page keeps its files, «خطتي» opens — and goes in when the app is
//      put away with nothing open (not while «خطتي» is open);
//   6. «خطتي» is fetched at idle after Home, so opening it needs nothing
//      from the network.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { mkdirSync, readdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { APP_VERSION, ACHIEVEMENTS, BUILT_IN_PLANS } from '../src/constants.js'
import { deployOrigin, nextBuild } from './deploy-origin.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP = process.env.APP || 'http://127.0.0.1:5211/'
const DIST = process.env.DIST || path.join(ROOT, 'dist')
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
const SEED = {
  hf_plan: plan, hf_plan_index: 1, hf_onboarded: true, hf_pack_prompted: true,
  hf_seen_version: APP_VERSION, meran_seen_version: APP_VERSION, hf_weights_reset_v2: true,
  hf_profile: { name: 'حمزة' }, meran_rest_announced: [], hf_unlocked: ACHIEVEMENTS.map(a => a.id),
}
const PLANVIEW_JS = /\/assets\/PlanView-[A-Za-z0-9_-]{8}\.js(\?.*)?$/

const browser = await chromium.launch()

async function open({ sw = false, size = 'iPhone 13', viewport = null, routes = [] } = {}) {
  const ctx = await browser.newContext({
    ...devices[size], ...(viewport ? { viewport } : null),
    locale: 'ar', timezoneId: 'Asia/Riyadh', serviceWorkers: sw ? 'allow' : 'block',
  })
  await ctx.route(u => u.pathname.startsWith('/pack/'), r => r.abort())
  await ctx.addInitScript((seed) => {
    try {
      if (localStorage.getItem('__seeded')) return
      localStorage.setItem('__seeded', '1')
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v))
    } catch { /* the browser's own error page */ }
  }, SEED)
  const page = await ctx.newPage()
  for (const [match, handler] of routes) await page.route(match, handler)
  const errors = []
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)))
  let loads = 0
  page.on('load', () => { loads++ })
  return { ctx, page, errors, loads: () => loads }
}

/** Something is on screen: the app, or one of its cards — never the bare ground. */
const screenState = (page) => page.evaluate(() => {
  const root = document.getElementById('root')
  return {
    rootChildren: root ? root.children.length : 0,
    text: document.body.innerText.trim().length,
    inert: !!root?.inert,
    overflow: document.body.style.overflow,
    view: !!document.querySelector('[data-testid="plan-view"]'),
    fail: !!document.querySelector('[data-testid="page-fail"]'),
    appFail: !!document.querySelector('[data-testid="app-fail"]'),
    loading: !!document.querySelector('[data-testid="page-loading"]'),
  }
})
const notBlack = (s) => s.rootChildren > 0 && s.text > 20
const tapPlan = async (page) => {
  const row = page.locator('.hm-plan-row')
  await row.waitFor({ timeout: 10000 })
  await row.scrollIntoViewIfNeeded()
  await row.click()
}
const homeUsable = async (page, label) => {
  const s = await screenState(page)
  ok(`${label}: Home is not inert and scrolls (no lock left behind)`, !s.inert && s.overflow === '', JSON.stringify(s))
  await page.locator('nav.f-tabs > button').nth(1).click()
  await page.waitForTimeout(500)
  const hist = await page.evaluate(() => /السجل/.test(document.querySelector('main')?.innerText || ''))
  await page.locator('nav.f-tabs > button').first().click()
  await page.waitForTimeout(500)
  ok(`${label}: the tabs answer`, hist && await page.locator('[data-testid="streak-number"]').count() === 1)
}

// ══ 1. A chunk that 404s once: one reload by itself, «خطتي» open after it ══
{
  // 404 for the first page only: the page that comes back after the
  // reload finds it (the deploy has finished).
  const nav = { count: 0 }
  const { ctx, page, errors, loads } = await open({
    routes: [[u => PLANVIEW_JS.test(u.href), (r) => (nav.count <= 1 ? r.fulfill({ status: 404, body: 'gone' }) : r.continue())]],
  })
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) nav.count++ })
  await page.goto(APP, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  const reloaded = page.waitForEvent('load', { timeout: 15000 }).then(() => true, () => false)
  const before = loads()
  await tapPlan(page)
  const samples = []
  for (let i = 0; i < 6; i++) { samples.push(await screenState(page).catch(() => null)); await page.waitForTimeout(120) }
  const didReload = await reloaded
  await page.locator('[data-testid="plan-view"]').waitFor({ timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const s = await screenState(page)
  ok('404 once: the app reloads by itself', didReload && loads() - before === 1, `loads +${loads() - before}`)
  ok('404 once: «خطتي» is open after the reload, without a second tap', s.view && !s.fail, JSON.stringify(s))
  ok('404 once: never a black screen on the way', samples.filter(Boolean).every(notBlack) && notBlack(s), JSON.stringify(samples.filter(x => x && !notBlack(x)).slice(0, 2)))
  ok('404 once: the reopen note is used up', await page.evaluate(() => sessionStorage.getItem('meran_reopen')) === null)
  ok('404 once: no uncaught page errors', errors.length === 0, errors.slice(0, 2).join(' | '))
  await ctx.close()
}

// ══ 2. A chunk that never arrives: one reload, then the card ══
for (const [w, h] of [[390, 844], [320, 568]]) {
  let failing = true
  const { ctx, page, errors, loads } = await open({
    viewport: { width: w, height: h },
    routes: [[u => PLANVIEW_JS.test(u.href), (r) => (failing ? r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>مران</title>' }) : r.continue())]],
  })
  await page.goto(APP, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  const first = loads()
  await tapPlan(page)
  await page.waitForEvent('load', { timeout: 15000 }).catch(() => {})
  await page.locator('[data-testid="page-fail"]').waitFor({ timeout: 12000 }).catch(() => {})
  await page.waitForTimeout(3500)   // long enough for a second reload, if there were going to be one
  const s = await screenState(page)
  const card = s.fail ? await page.locator('[data-testid="page-fail"]').innerText() : ''
  ok(`never arrives @${w}: exactly one automatic reload`, loads() - first === 1, `loads +${loads() - first}`)
  ok(`never arrives @${w}: the card «ما قدرنا نفتح خطتي», not a black screen`, s.fail && /ما قدرنا نفتح خطتي/.test(card) && notBlack(s), JSON.stringify(s))
  ok(`never arrives @${w}: it says the data is safe, in plain words`, /بياناتك كلها محفوظة/.test(card) && !/Error|TypeError|chunk|module/i.test(card), card)
  ok(`never arrives @${w}: «جرّب مرة ثانية» and «رجوع»`, await page.locator('[data-testid="page-retry"]').count() === 1
    && await page.locator('[data-testid="page-fail-close"]').count() === 1)
  const fits = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    return [...document.querySelectorAll('.k-sheet, .k-sheet *')].every(el => { const r = el.getBoundingClientRect(); return !r.width || (r.left >= -1 && r.right <= vw + 1) })
  })
  ok(`never arrives @${w}: the card fits the screen`, fits)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/fallback-card-${w}.png` })
  if (w === 390) {
    // «رجوع»: Home again, usable
    await page.locator('[data-testid="page-fail-close"]').click()
    await page.waitForTimeout(700)
    ok('never arrives: «رجوع» takes the card away', !(await screenState(page)).fail)
    await homeUsable(page, 'never arrives, after «رجوع»')
    // «جرّب مرة ثانية», now that the chunk arrives: a reload (his tap), and «خطتي» open
    await tapPlan(page)
    await page.locator('[data-testid="page-fail"]').waitFor({ timeout: 8000 }).catch(() => {})
    failing = false
    const before = loads()
    await page.locator('[data-testid="page-retry"]').click()
    await page.waitForEvent('load', { timeout: 15000 }).catch(() => {})
    await page.locator('[data-testid="plan-view"]').waitFor({ timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(800)
    const s2 = await screenState(page)
    ok('never arrives: «جرّب مرة ثانية» reloads and «خطتي» opens', loads() - before === 1 && s2.view && !s2.fail, JSON.stringify(s2))
  }
  ok(`never arrives @${w}: no uncaught page errors`, errors.length === 0, errors.slice(0, 2).join(' | '))
  await ctx.close()
}

// ══ 3. A slow chunk: «نفتح خطتي…» instead of nothing ══
{
  let hold = true
  const { ctx, page, errors } = await open({
    routes: [[u => PLANVIEW_JS.test(u.href), async (r) => { while (hold) await new Promise(res => setTimeout(res, 50)); await r.continue() }]],
  })
  await page.goto(APP, { waitUntil: 'domcontentloaded' })
  await tapPlan(page)
  await page.waitForTimeout(150)
  const early = await screenState(page)
  await page.waitForTimeout(450)
  const later = await screenState(page)
  const text = later.loading ? await page.locator('[data-testid="page-loading"]').innerText() : ''
  ok('slow: nothing for a blink (under 300 ms)', !early.loading && notBlack(early), JSON.stringify(early))
  ok('slow: then «نفتح خطتي…» on the scrim', later.loading && /نفتح خطتي/.test(text) && notBlack(later), JSON.stringify(later))
  // its × closes; a later tap opens «خطتي» once the chunk comes
  await page.locator('[data-testid="page-loading"] button[aria-label="إغلاق"]').click()
  await page.waitForTimeout(300)
  const closed = await screenState(page)
  ok('slow: its × closes it and Home is usable', !closed.loading && !closed.inert && closed.overflow === '', JSON.stringify(closed))
  hold = false
  await tapPlan(page)
  await page.locator('[data-testid="plan-view"]').waitFor({ timeout: 8000 }).catch(() => {})
  ok('slow: once the chunk comes, «خطتي» opens', (await screenState(page)).view)
  ok('slow: no uncaught page errors', errors.length === 0, errors.slice(0, 2).join(' | '))
  await ctx.close()
}

// ══ 4. An error thrown inside «خطتي» ══
// The chunk is served as a wrapper around the real one (fetched under
// ?real): the real page renders — its hooks, its scroll lock, the inert
// app — and throws whenever window.__breakPlanView is set.
{
  const wrapper = (real) => `import Real from ${JSON.stringify(real)};
export default function PlanViewThatBreaks(props) {
  const out = Real(props)
  if (window.__breakPlanView) throw new Error('boom inside خطتي')
  return out
}`
  const { ctx, page, errors } = await open({
    routes: [[u => PLANVIEW_JS.test(u.href), (r) => {
      const u = new URL(r.request().url())
      if (u.search === '?real') return r.continue()
      return r.fulfill({ status: 200, contentType: 'text/javascript', body: wrapper(u.pathname + '?real') })
    }]],
  })
  await page.goto(APP, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)

  // a) on its first render
  await page.evaluate(() => { window.__breakPlanView = true })
  await tapPlan(page)
  await page.locator('[data-testid="page-fail"]').waitFor({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(400)
  let s = await screenState(page)
  ok('throws at once: the card, not a black screen', s.fail && !s.view && !s.appFail && notBlack(s), JSON.stringify(s))
  ok('throws at once: «ما قدرنا نفتح خطتي» · «صار خلل بسيط»', /ما قدرنا نفتح خطتي/.test(await page.locator('[data-testid="page-fail"]').innerText())
    && /صار خلل بسيط/.test(await page.locator('[data-testid="page-fail"]').innerText()))
  await page.locator('[data-testid="page-fail-close"]').click()
  await page.waitForTimeout(700)
  await homeUsable(page, 'throws at once, after «رجوع»')

  // b) after it opened: the page holds the scroll lock and the inert app, then throws
  await page.evaluate(() => { window.__breakPlanView = false })
  await tapPlan(page)
  await page.locator('[data-testid="plan-view"]').waitFor({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(900)
  s = await screenState(page)
  ok('throws later: «خطتي» opened first (holding the lock and inert)', s.view && s.inert && s.overflow === 'hidden', JSON.stringify(s))
  await page.evaluate(() => { window.__breakPlanView = true })
  // another day's tab: a re-render of the open page
  await page.locator('.pv-tab[aria-selected="false"]').first().click().catch(() => {})
  await page.locator('[data-testid="page-fail"]').waitFor({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(500)
  s = await screenState(page)
  ok('throws later: the page goes, the card comes', s.fail && !s.view && notBlack(s), JSON.stringify(s))
  // the card itself holds a lock while it is up; once it goes, nothing does
  await page.evaluate(() => { window.__breakPlanView = false })
  await page.locator('[data-testid="page-fail-close"]').click()
  await page.waitForTimeout(700)
  await homeUsable(page, 'throws later, after «رجوع»')
  await tapPlan(page)
  await page.locator('[data-testid="plan-view"]').waitFor({ timeout: 8000 }).catch(() => {})
  ok('throws later: «خطتي» opens again afterwards', (await screenState(page)).view)
  await page.locator('[data-testid="plan-view-close"]').click()
  await page.waitForTimeout(700)
  ok('the error inside the page never reaches the window as uncaught', errors.length === 0, errors.slice(0, 2).join(' | '))
  await ctx.close()
}

// ══ 5. A new deploy under an open page ══
{
  const work = mkdtempSync(path.join(tmpdir(), 'meran-deploy-'))
  const A = path.join(work, 'a'), B = path.join(work, 'b')
  nextBuild(DIST, A, { salt: 'a' })
  nextBuild(A, B, { salt: 'b' })
  const chunk = (dir, re) => readdirSync(path.join(dir, 'assets')).find(n => re.test(n))
  const oldPlanView = chunk(A, /^PlanView-.*\.js$/)
  const newEntry = chunk(B, /^index-.*\.js$/)
  const origin = await deployOrigin(A)
  const { ctx, page, errors, loads } = await open({ sw: true })
  await page.goto(origin.url, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(2500)
  ok('deploy: the worker controls the page', await page.evaluate(() => !!navigator.serviceWorker.controller))

  origin.deploy(B)
  const before = loads()
  const after = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration()
    let changed = false
    navigator.serviceWorker.addEventListener('controllerchange', () => { changed = true })
    await reg.update()
    for (let i = 0; i < 100 && !reg.waiting; i++) await new Promise(r => setTimeout(r, 100))
    await new Promise(r => setTimeout(r, 1500))
    return { waiting: !!reg.waiting, changed }
  })
  ok('deploy: the new version waits instead of taking over the open page', after.waiting && !after.changed && loads() === before, JSON.stringify(after))
  const res = await page.evaluate(async (f) => {
    const r = await fetch(`/assets/${f}`)
    return { status: r.status, type: r.headers.get('content-type') || '' }
  }, oldPlanView)
  ok('deploy: the open page still gets its own «خطتي» chunk (JavaScript, not index.html)', res.status === 200 && /javascript/.test(res.type), JSON.stringify(res))
  await tapPlan(page)
  await page.locator('[data-testid="plan-view"]').waitFor({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(700)
  const s = await screenState(page)
  ok('deploy: «خطتي» opens after the deploy (the black screen, before the fix)', s.view && !s.fail && notBlack(s), JSON.stringify(s))

  // put away with «خطتي» open: it stays as it is
  const hide = () => page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  const show = () => page.evaluate(() => {
    delete document.visibilityState
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await hide()
  await page.waitForTimeout(3000)
  ok('deploy: not put in while «خطتي» is open, even in the background', loads() === before && (await screenState(page)).view)
  await show()
  await page.locator('[data-testid="plan-view-close"]').click()
  await page.waitForTimeout(800)
  // put away with nothing open: the new version goes in
  const reloaded = page.waitForEvent('load', { timeout: 15000 }).then(() => true, () => false)
  await hide()
  const did = await reloaded
  await page.waitForTimeout(1500)
  const entry = await page.evaluate(() => [...document.scripts].map(s => s.src).find(s => /\/assets\/index-/.test(s)) || '')
  ok('deploy: put away with nothing open, the app reloads into the new version', did && entry.endsWith(newEntry), `${entry} vs ${newEntry}`)
  ok('deploy: and it is the app on screen', notBlack(await screenState(page)) && await page.locator('[data-testid="streak-number"]').count() === 1)
  ok('deploy: no uncaught page errors', errors.length === 0, errors.slice(0, 2).join(' | '))
  await ctx.close()
  await origin.close()
  rmSync(work, { recursive: true, force: true })
}

// ══ 6. «خطتي» is fetched at idle after Home ══
{
  const seen = []
  const { ctx, page, errors } = await open({ routes: [[u => PLANVIEW_JS.test(u.href), (r) => { seen.push(Date.now()); r.continue() }]] })
  await page.goto(APP, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4000)
  ok('prefetch: the «خطتي» chunk arrives at idle, before any tap', seen.length === 1, String(seen.length))
  await page.route(u => PLANVIEW_JS.test(u.href), r => r.abort())
  await tapPlan(page)
  await page.waitForTimeout(250)
  const s = await screenState(page)
  ok('prefetch: then «خطتي» opens at once, with the network to it cut', s.view && !s.loading && !s.fail, JSON.stringify(s))
  ok('prefetch: no uncaught page errors', errors.length === 0, errors.slice(0, 2).join(' | '))
  await ctx.close()
}

await browser.close()
process.exit(report() ? 1 : 0)
