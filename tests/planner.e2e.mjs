#!/usr/bin/env node
// End-to-end checks for the plan builder (src/pages/planner) on a phone.
//
//   npm run build && npx vite preview --port 4821 --strictPort --host 127.0.0.1 &
//   APP=http://127.0.0.1:4821/ node tests/planner.e2e.mjs
//   SHOTS=/some/dir …   also saves a screenshot of each screen (and WIDTHS=320,390,430)
//
// What a browser is needed for: that each of the five doors opens the
// page where it should; that his own push·pull·legs plan opens on 4 days
// as it is; that swiping adds (and a tap only shows how); that the tool
// chips filter and are remembered per muscle; that «كثير» suggests what to
// remove and تراجع puts it back; that the build animation plays on
// «خلصت» and «كمّل خطتي» and a tap skips it; that saving writes a plan
// both designs read (the old one at /classic/ included); that the session
// then runs on the plan's reps and rest; and that «رجّع خطتك القديمة»
// brings the old plan back. Nothing on any screen may overflow sideways
// at 320, 390 or 430.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { mkdirSync } from 'node:fs'
import { APP_VERSION, BUILT_IN_PLANS } from '../src/constants.js'

const APP = process.env.APP || 'http://127.0.0.1:4821/'
const SHOTS = process.env.SHOTS || null
const WIDTHS = (process.env.WIDTHS || '320,390,430').split(',').map(Number)
const SKIP_CLASSIC = !!process.env.SKIP_CLASSIC
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
const HEIGHT = { 320: 690, 390: 844, 430: 932 }

const results = []
const ok = (name, cond, extra = '') => results.push([name, !!cond, extra])
const machine = BUILT_IN_PLANS.find(p => p.planId === 'machine_beginner_3day')

const browser = await chromium.launch()

async function phone({ width = 390, plan = machine, planIndex = 7, onboarded = true, extra = {} } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height: HEIGHT[width] || 844 }, deviceScaleFactor: 2,
    serviceWorkers: 'block', locale: 'ar',
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource/.test(m.text())) errors.push(m.text()) })
  // The art pack stays out: every run sees the same fallback pictures.
  await page.route(u => u.pathname.startsWith('/pack/'), r => r.abort())
  await page.addInitScript(([plan, planIndex, onboarded, version, extra]) => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    if (plan) localStorage.setItem('hf_plan', JSON.stringify({ ...plan, startDate: '2026-09-01' }))
    localStorage.setItem('hf_plan_index', String(planIndex))
    localStorage.setItem('hf_recovery', JSON.stringify({ daysPerWeek: 4 }))
    localStorage.setItem('hf_profile', JSON.stringify({ name: 'حمزة', gymType: 'commercial' }))
    localStorage.setItem('hf_pack_prompted', '1')
    localStorage.setItem('hf_seen_version', JSON.stringify(version))
    localStorage.setItem('hf_weights_reset_v2', 'true')
    if (onboarded) localStorage.setItem('hf_onboarded', 'true')
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, JSON.stringify(v))
  }, [plan, planIndex, onboarded, APP_VERSION, extra])
  await page.goto(APP)
  await page.waitForTimeout(1200)
  return { ctx, page, errors }
}

const get = (page, k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), k)
const planner = (page) => page.locator('[data-testid="planner"]')
const screenOn = (page, id) => page.locator(`#s-${id}:not([hidden])`)
const settle = (page, ms = 700) => page.waitForTimeout(ms)
async function shot(page, name, width = 390) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${width}-${name}.png` })
}
/* Nothing sticks out sideways, and no text is clipped with «…». */
async function noOverflow(page, label, width) {
  const bad = await page.evaluate(() => {
    const scr = document.querySelector('.pb .screen'); if (!scr) return ['no screen']
    const box = scr.getBoundingClientRect()
    const out = []
    for (const el of scr.querySelectorAll('*')) {
      if (el.closest('[hidden]') || el.closest('.ghost')) continue
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) continue
      // what is actually visible: clipped by every ancestor that clips
      // (a picture bleeding inside its stage, a row of chips that scrolls)
      let left = r.left, right = r.right
      for (let a = el.parentElement; a && a !== scr; a = a.parentElement) {
        const cs = getComputedStyle(a)
        if (cs.overflowX !== 'visible') { const ar = a.getBoundingClientRect(); left = Math.max(left, ar.left); right = Math.min(right, ar.right) }
      }
      if (right <= left) continue
      if (right > box.right + 1.5 || left < box.left - 1.5) out.push(`${el.className || el.tagName}: ${Math.round(left)}–${Math.round(right)}`)
    }
    return out.slice(0, 5)
  })
  ok(`${width}: ${label} — nothing overflows sideways`, bad.length === 0, bad.join(' | '))
}
async function swipe(page, loc, dx = -150) {
  await loc.scrollIntoViewIfNeeded()
  const b = await loc.boundingBox()
  const x = b.x + b.width / 2, y = b.y + b.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(x + dx * i / 10, y + 1)
  await page.mouse.up()
  await settle(page, 750)
}
const card = (page, ar) => page.locator('#mview .xcard').filter({ hasText: ar }).first()

// ── 1. The five doors ─────────────────────────────────────────
{
  const { ctx, page, errors } = await phone()
  // door 1: Settings › الخطة
  await page.getByRole('button', { name: 'الإعدادات' }).first().click(); await settle(page)
  await page.locator('.k-row').filter({ hasText: 'الخطة' }).first().click(); await settle(page)
  ok('settings › الخطة: «ابنِ خطتك على كيفك» is there', await page.getByText('ابنِ خطتك على كيفك').count() === 1)
  ok('settings › الخطة: the Upper/Lower plan is listed', await page.getByText('علوي/سفلي — 4 أيام').count() >= 1)
  ok('settings › خطتك الحين: «عدّل الخطة»', await page.getByText('عدّل الخطة').count() >= 1)
  await page.getByText('ابنِ خطتك على كيفك').click(); await settle(page, 900)
  ok('door 1 (settings): opens on «البداية»', await screenOn(page, 'start').count() === 1 && await page.getByText('عدّل خطتك الحالية').count() === 1)
  ok('door 1: the app behind is inert while it is open', await page.evaluate(() => document.getElementById('root').inert === true))
  await page.locator('#s-start [data-act="close"]').click(); await settle(page)
  ok('door 1: × closes it', await planner(page).count() === 0)
  ok('door 1: the app is usable again', await page.evaluate(() => !document.getElementById('root').inert && document.body.style.overflow !== 'hidden'))
  // «عدّل الخطة» from settings: his plan by days
  await page.getByText('عدّل الخطة').first().click(); await settle(page, 900)
  ok('settings › «عدّل الخطة»: opens on «خطتك» by days', await screenOn(page, 'plan').count() === 1)
  await page.keyboard.press('Escape'); await settle(page)
  ok('Escape closes it', await planner(page).count() === 0)
  // door 2: Home › تقدّم البرنامج → «خطتي» › «عدّل الخطة كاملة»
  await page.locator('.f-tabs button').first().click(); await settle(page)
  await page.locator('.k-row').filter({ hasText: 'خطة المبتدئ' }).first().click(); await settle(page, 900)
  ok('door 2 (تقدّم البرنامج): opens «خطتي», his plan as cards', await page.locator('[data-testid="plan-view"]').count() === 1)
  await page.locator('.pv-page[data-page="1"] [data-testid="plan-view-builder"]').click(); await settle(page, 1100)
  ok('door 2: «عدّل الخطة كاملة» opens the builder on «خطتك»', await screenOn(page, 'plan').count() === 1)
  ok('door 2: on the day he was looking at (today\'s: index 7 of 3 → سحب)', (await page.locator('.dtab[aria-selected="true"]').innerText()).includes('سحب'))
  await page.keyboard.press('Escape'); await settle(page)
  ok('door 2: closing the builder lands back on «خطتي»', await planner(page).count() === 0 && await page.locator('[data-testid="plan-view"]').count() === 1)
  await page.keyboard.press('Escape'); await settle(page)
  // door 3: Home › ⋯ › عدّل الخطة
  await page.getByRole('button', { name: 'خيارات اليوم' }).click(); await settle(page)
  await page.locator('.k-row').filter({ hasText: 'عدّل الخطة' }).click(); await settle(page, 1100)
  ok('door 3 (⋯ › عدّل الخطة): opens on «خطتك»', await screenOn(page, 'plan').count() === 1)
  await page.keyboard.press('Escape'); await settle(page)
  ok('doors: no page errors', errors.length === 0, errors.join(' | '))
  await ctx.close()
}
{
  // door 4: Home with no plan
  const { ctx, page, errors } = await phone({ plan: null })
  const link = page.locator('[data-testid="build-plan"]')
  ok('door 4: Home with no plan has a quiet «ابنِ خطتك» (not green)', await link.count() === 1
    && await link.evaluate(el => getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)'))
  await link.click(); await settle(page, 900)
  ok('door 4: opens on «البداية», without «عدّل خطتك الحالية»', await screenOn(page, 'start').count() === 1 && await page.getByText('عدّل خطتك الحالية').count() === 0)
  ok('door 4: no page errors', errors.length === 0, errors.join(' | '))
  await ctx.close()
}
{
  // door 5: the first run
  const { ctx, page, errors } = await phone({ plan: null, onboarded: false })
  await page.getByRole('button', { name: 'التالي' }).click(); await settle(page, 400)
  await page.getByRole('button', { name: 'التالي' }).click(); await settle(page, 400)
  const self = page.getByRole('radio', { name: /أبني خطتي بنفسي/ })
  ok('door 5: the first run offers «أبني خطتي بنفسي»', await self.count() === 1)
  await self.click()
  await page.getByRole('button', { name: 'يلا نبدأ' }).click(); await settle(page, 1200)
  ok('door 5: the builder opens on «البداية» after the setup', await screenOn(page, 'start').count() === 1)
  ok('door 5: no plan was set by the setup', (await get(page, 'hf_plan')) === null)
  ok('door 5: no page errors', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

// ── 2. His plan: push·pull·legs on 4 days, edited and saved ───
let saved = null
{
  const { ctx, page, errors } = await phone()
  await page.getByRole('button', { name: 'الإعدادات' }).first().click(); await settle(page)
  await page.locator('.k-row').filter({ hasText: 'الخطة' }).first().click(); await settle(page)
  await page.getByText('ابنِ خطتك على كيفك').click(); await settle(page, 900)
  await page.getByText('عدّل خطتك الحالية').click(); await settle(page, 900)
  ok('his plan: opens on the cards', await screenOn(page, 'deck').count() === 1)
  ok('his plan: «4 أيام · دفع · سحب · أرجل»', (await page.locator('.basics-line').innerText()).includes('دفع · سحب · أرجل') && (await page.locator('.basics-line').innerText()).includes('4 أيام'))
  ok('his plan: 6 of 7 muscles covered', (await page.locator('#cov-n').innerText()).trim() === '6')
  await shot(page, 'deck-current')

  // «كثير» on biceps: the suggestion, شيله, تراجع
  await page.locator('.mcard[data-card="biceps"]').click(); await settle(page, 1100)
  const mfix = page.locator('#mfix .mfix')
  ok('too much biceps: «كثير» shows inside the muscle', await mfix.count() === 1 && (await mfix.innerText()).includes('16'))
  ok('too much biceps: it suggests «شيل مرجحة هامر كيبل»', (await mfix.innerText()).includes('شيل مرجحة هامر كيبل'))
  ok('too much biceps: and says it comes down to 11', (await mfix.innerText()).includes('يصير 11'))
  await shot(page, 'much')
  await page.locator('#mfix [data-act="much-yes"]').click(); await settle(page, 500)
  ok('شيله: the exercise is out', !(await card(page, 'مرجحة هامر كيبل').getAttribute('class')).includes(' on'))
  const undo = page.locator('.toast button', { hasText: 'تراجع' })
  ok('شيله: a toast with تراجع', await undo.count() === 1)
  await undo.click(); await settle(page, 500)
  ok('تراجع: it is back', (await card(page, 'مرجحة هامر كيبل').getAttribute('class')).includes(' on'))
  await page.locator('#mview [data-act="mv-close"]').last().click(); await settle(page, 900)

  // swipe-only adding, the first-time hint, a tap only shows how
  await page.locator('.mcard[data-card="chest"]').click(); await settle(page, 1300)
  ok('swipe hint: shown the first time', await page.locator('#sw-hint').count() === 1)
  ok('no + buttons anywhere', await page.locator('#mview .xc-add').count() === 0)
  const fly = card(page, 'تفتيح كيبل')
  await fly.locator('.xc-in').click(); await settle(page, 1500)
  ok('a tap does not add', !(await fly.getAttribute('class')).includes(' on'))
  await shot(page, 'muscle')
  await swipe(page, fly.locator('.xc-in'))
  ok('a swipe adds', (await fly.getAttribute('class')).includes(' on'))
  ok('the tray counts it', (await page.locator('#mview .tray-l').innerText()).includes('4'))
  ok('the hint goes once he has swiped', await page.locator('#sw-hint').count() === 0 && (await get(page, 'meran_planner'))?.swiped === true)
  await shot(page, 'swipe')
  // a second swipe takes it out; a third puts it back
  await swipe(page, fly.locator('.xc-in'), 150)
  ok('a second swipe takes it out', !(await fly.getAttribute('class')).includes(' on'))
  await swipe(page, fly.locator('.xc-in'))

  // tool chips: filter, remembered per muscle
  await page.locator('#mview [data-act="mtool"][data-v="machine"]').click(); await settle(page, 600)
  const tools = await page.locator('#mview .mv-list > .grp:not(.locked-box) .xcard').evaluateAll(els => els.map(e => e.querySelector('.tag')?.textContent.trim()))
  ok('chips: «جهاز» shows machines (and what he already picked)', tools.length > 0 && tools.every(t => /جهاز|كيبل/.test(t)), tools.join(','))
  await shot(page, 'tools')
  await page.locator('#mview [data-act="mv-close"]').last().click(); await settle(page, 900)
  await page.locator('.mcard[data-card="chest"]').click(); await settle(page, 1300)
  ok('chips: remembered for the chest', await page.locator('#mview [data-act="mtool"][data-v="machine"][aria-pressed="true"]').count() === 1)
  ok('chips: written to meran_planner', JSON.stringify((await get(page, 'meran_planner'))?.mtool?.chest) === '["machine"]')
  await page.locator('#mview [data-act="mtool"][data-v="all"]').click(); await settle(page, 300)
  await page.locator('#mview [data-act="mv-close"]').last().click(); await settle(page, 900)

  // «خلصت»: the build, skipped with a tap
  await page.locator('[data-act="deck-done"]').click(); await settle(page, 700)
  ok('خلصت: the build animation plays', await page.locator('#bld').count() === 1)
  await shot(page, 'build')
  const t0 = Date.now()
  await page.locator('#bld').click()
  await page.locator('#bld').waitFor({ state: 'detached', timeout: 3000 }).catch(() => {})
  ok('خلصت: a tap skips it (gone within a second)', await page.locator('#bld').count() === 0 && Date.now() - t0 < 1500, `${Date.now() - t0}ms`)
  ok('then «وش ناقص خطتك؟»', await screenOn(page, 'gaps').count() === 1 && (await page.locator('#s-gaps .title').innerText()).includes('وش ناقص'))
  await shot(page, 'gaps')

  // «كمّل خطتي»: the build again, played through
  await page.locator('[data-act="fill"]').click(); await settle(page, 400)
  ok('كمّل خطتي: the build animation plays', await page.locator('#bld').count() === 1)
  await page.waitForTimeout(1200)
  await shot(page, 'filling')
  await page.locator('#bld').waitFor({ state: 'detached', timeout: 6000 }).catch(() => {})
  ok('كمّل خطتي: it ends by itself in a few seconds', await page.locator('#bld').count() === 0)
  const added = await page.locator('#gaps .added b').allInnerTexts()
  ok('كمّل خطتي: adds the seated leg curl and the cable crunch', added.includes('مرجحة خلفية جالس') && added.includes('كرانش كيبل'), added.join(','))
  ok('كمّل خطتي: 7 of 7', (await page.locator('#gn').innerText()).trim() === '7')
  await shot(page, 'filled')

  // «خطتك» by days: sets, reps, rest
  await page.locator('#gaps-dock [data-act="to-plan"]').click(); await settle(page, 800)
  ok('خطتك: three days, push pull legs', (await page.locator('.dtab').count()) === 3)
  const row = page.locator('#plist .prow').first()
  await row.locator('.pr-main').click(); await settle(page, 500)
  const restB = row.locator('.tune').nth(1).locator('b')
  const before = await restB.innerText()
  await row.locator('[data-act="rest"][data-v="1"]').click(); await settle(page, 300)
  ok('خطتك: rest steps up', (await restB.innerText()) !== before, `${before} → ${await restB.innerText()}`)
  await row.locator('[data-act="reps"][data-v="-1"]').click(); await settle(page, 300)
  await shot(page, 'plan')
  // reorder: drag the second row above the first
  await row.locator('.pr-main').click(); await settle(page, 400)   // close it again
  const names0 = await page.locator('#plist .pr-ar').allInnerTexts()
  const g = page.locator('#plist .prow').nth(1).locator('[data-grip]')
  await page.locator('#plist').evaluate(el => el.scrollIntoView({ block: 'start' }))
  await settle(page, 300)
  const gb = await g.boundingBox()
  await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2); await page.mouse.down()
  for (let i = 1; i <= 8; i++) await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2 - 200 * i / 8)
  await page.mouse.up(); await settle(page, 600)
  const names1 = await page.locator('#plist .pr-ar').allInnerTexts()
  ok('خطتك: the grip reorders', names1[0] === names0[1], `${names0.slice(0, 2)} → ${names1.slice(0, 2)}`)

  // save: the confirm sheet, then «جاهزة»
  await page.locator('[data-act="plan-start"]').click(); await settle(page, 600)
  const sheet = await page.locator('#sheet').innerText()
  ok('confirm: says editing is free', sheet.includes('التعديل ببلاش'))
  ok('confirm: says the old version is kept', sheet.includes('تنحفظ'))
  await shot(page, 'confirm')
  await page.locator('[data-act="activate"]').click(); await settle(page, 1200)
  ok('«جاهزة»: the done screen', await screenOn(page, 'done').count() === 1)
  await shot(page, 'done')
  saved = await get(page, 'hf_plan')
  const names = saved.weeklySchedule.flatMap(d => d.exercises.map(x => x.name))
  ok('saved: same plan id and name (an edit)', saved.planId === machine.planId && saved.planName === machine.planName)
  ok('saved: his 17 plus the two the app added', names.length >= 19 && names.includes('Seated Leg Curl') && names.includes('Cable Crunch') && names.includes('Cable Fly'))
  ok('saved: the app\'s exercises say so (by: app, why)', saved.weeklySchedule.flatMap(d => d.exercises).filter(x => x.by === 'app').every(x => x.why))
  ok('saved: every day named «English — muscles» and every muscle one of the eight',
    saved.weeklySchedule.every(d => /^[A-Za-z]/.test(d.name) && d.exercises.length && d.exercises.every(x => ['Chest', 'Back', 'Shoulders', 'Legs', 'Biceps', 'Triceps', 'Core', 'Cardio'].includes(x.muscle))))
  ok('saved: the day he reached is kept (same cycle)', (await get(page, 'hf_plan_index')) === 7)
  ok('saved: the old version is kept (hf_plan_prev)', (await get(page, 'hf_plan_prev'))?.plan?.weeklySchedule?.flatMap(d => d.exercises).length === 17)
  ok('saved: an edit does not count as a change', !(await get(page, 'hf_recovery')).lastSettingsChangeAt)

  // the session runs on the plan's numbers
  await page.locator('[data-act="start-workout"]').click(); await settle(page, 1500)
  ok('ابدأ التمرين: the session opens', await page.locator('[data-testid="session-cover"]').count() === 1)
  const active = await get(page, 'hf_active')
  const first = active.exercises[0]
  const planDay = saved.weeklySchedule[7 % 3]
  const planFirst = planDay.exercises[0]
  ok('session: today\'s day of the plan', first.name === planFirst.name, `${first.name} vs ${planFirst.name}`)
  ok('session: the plan\'s rest', first.rest === planFirst.restSeconds, `${first.rest} vs ${planFirst.restSeconds}`)
  // Reps: his own choice wins. Only a range he stepped in the builder is
  // his (repsOwn); the template's ranges are not, so they run on his
  // Settings (12–15 by default).
  const owned = saved.weeklySchedule.flatMap(d => d.exercises).filter(x => x.repsOwn === true)
  ok('saved: the one row he stepped the reps of is his own (repsOwn, from 12–15 down to 10–15)',
    owned.length === 1 && owned[0].repsMin === 10 && owned[0].repsMax === 15, JSON.stringify(owned.map(x => [x.name, x.repsMin, x.repsMax])))
  const want = planFirst.repsOwn ? [planFirst.repsMin, Math.max(planFirst.repsMin, planFirst.repsMax)] : [12, 15]
  ok('session: the reps are his — his own range, else Settings, never the template\'s',
    planFirst.repsOwn ? (first.target?.min === want[0] && first.target?.max === want[1] && first.target?.own === true) : !first.target,
    JSON.stringify({ target: first.target, planFirst }))
  ok('session: the reps box starts at the bottom of his range', first.sets[0].reps === String(want[0]), first.sets[0].reps)
  const coach = await page.locator('.s-coach-adv').first().innerText().catch(() => '')
  ok('session: the coach line says his range', coach.includes(`${want[0]}–${want[1]}`), coach)
  // a set: the rest counts the plan's seconds
  await page.locator('input[inputmode="decimal"]').first().fill('40').catch(() => {})
  await page.locator('[data-testid="complete-set"]').click(); await settle(page, 1200)
  const timer = await get(page, 'hf_rest_timer')
  ok('session: the rest is the plan\'s', timer?.selected === planFirst.restSeconds, JSON.stringify(timer))
  ok('his plan: no page errors', errors.length === 0, errors.join(' | '))

  // the old design reads the saved plan
  if (!SKIP_CLASSIC) {
    const cp = await ctx.newPage()
    const cerr = []
    cp.on('pageerror', e => cerr.push(String(e)))
    await cp.addInitScript(() => localStorage.setItem('meran_design', 'classic'))
    await cp.goto(new URL('/classic/', APP).href); await cp.waitForTimeout(2000)
    const text = await cp.locator('body').innerText()
    ok('classic: opens on the old design', new URL(cp.url()).pathname === '/classic/')
    ok('classic: reads the saved plan (its name is on Home)', text.includes(machine.planName) || text.includes('Pull'), text.slice(0, 200))
    ok('classic: no NaN anywhere', !text.includes('NaN'))
    ok('classic: no page errors', cerr.length === 0, cerr.join(' | '))
    await cp.evaluate(() => localStorage.setItem('meran_design', 'new'))
    await cp.close()
  }
  await ctx.close()
}

// ── 3. A new plan, days changed in the builder, then the old plan back ──
{
  const { ctx, page, errors } = await phone()
  await page.getByRole('button', { name: 'الإعدادات' }).first().click(); await settle(page)
  await page.locator('.k-row').filter({ hasText: 'الخطة' }).first().click(); await settle(page)
  await page.getByText('ابنِ خطتك على كيفك').click(); await settle(page, 900)
  await page.locator('[data-act="start-auto"]').click(); await settle(page, 700)
  await page.locator('[data-act="days"][data-v="3"]').click(); await settle(page, 400)
  ok('basics: days changed here says it changes with the plan', (await page.locator('#days-from').innerText()).includes('تتغيّر معها'))
  await page.locator('[data-act="preset"][data-v="db"]').click(); await settle(page, 300)
  await page.locator('[data-act="basics-next"]').click(); await settle(page, 600)
  ok('سوّ خطتي: the build animation plays', await page.locator('#bld').count() === 1)
  await page.locator('#bld').waitFor({ state: 'detached', timeout: 7000 }).catch(() => {})
  ok('سوّ خطتي: 7 of 7 with dumbbells', (await page.locator('#gn').innerText()).trim() === '7')
  await page.locator('#gaps-dock [data-act="to-plan"]').click(); await settle(page, 800)
  await page.locator('[data-act="plan-start"]').click(); await settle(page, 600)
  const sheet = await page.locator('#sheet').innerText()
  ok('confirm: says the days change from 4 to 3, as one change', sheet.includes('من 4 إلى 3') && sheet.includes('تغيير واحد'))
  ok('confirm: says the switch follows the streak rule', sheet.includes('بالقاعدة'))
  await page.locator('[data-act="activate"]').click(); await settle(page, 1200)
  const p = await get(page, 'hf_plan'), rc = await get(page, 'hf_recovery')
  ok('new plan: its own id', /^custom_\d{8}$/.test(p.planId) && p.source === 'builder')
  ok('new plan: starts on day one', (await get(page, 'hf_plan_index')) === 0)
  ok('new plan: days a week changed with it', rc.daysPerWeek === 3 && p.daysPerWeek === '3')
  ok('new plan: one change stamped', !!rc.lastSettingsChangeAt && (rc.patternHistory || []).length === 2)
  ok('new plan: the machine plan is kept', (await get(page, 'hf_plan_prev'))?.plan?.planId === machine.planId)
  await page.locator('#s-done [data-act="close"]').click(); await settle(page)
  // «رجّع خطتك القديمة»
  await page.getByText('ابنِ خطتك على كيفك').click(); await settle(page, 900)
  const back = page.getByText('رجّع خطتك القديمة')
  ok('start: «رجّع خطتك القديمة» is offered', await back.count() === 1)
  await back.click(); await settle(page, 600)
  ok('restore: asks first, and an undo the same day is free', (await page.locator('#sheet').innerText()).includes('ببلاش'))
  await page.locator('[data-act="restore-yes"]').click(); await settle(page, 900)
  ok('restore: the machine plan is back', (await get(page, 'hf_plan'))?.planId === machine.planId)
  ok('restore: at the day it had reached', (await get(page, 'hf_plan_index')) === 7)
  ok('restore: the builder\'s plan is kept in its place', /^custom_/.test((await get(page, 'hf_plan_prev'))?.plan?.planId || ''))
  ok('new plan and restore: no page errors', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

// ── 4. Every screen at 320, 390 and 430: nothing overflows ─────
for (const width of WIDTHS) {
  const { ctx, page, errors } = await phone({ width })
  await page.getByRole('button', { name: 'الإعدادات' }).first().click(); await settle(page)
  await page.locator('.k-row').filter({ hasText: 'الخطة' }).first().click(); await settle(page)
  await page.getByText('ابنِ خطتك على كيفك').click(); await settle(page, 1300)
  await noOverflow(page, 'start', width); await shot(page, 'w-start', width)
  await page.locator('[data-act="start-build"]').click(); await settle(page, 700)
  await page.locator('[data-act="split"][data-v="free"]').click(); await settle(page, 500)
  await noOverflow(page, 'basics', width); await shot(page, 'w-basics', width)
  await page.locator('[data-act="split"][data-v="ppl"]').click(); await settle(page, 300)
  await page.locator('[data-act="basics-next"]').click(); await settle(page, 800)
  await noOverflow(page, 'cards', width); await shot(page, 'w-deck', width)
  await page.locator('.mcard[data-card="shoulders"]').click(); await settle(page, 2700)
  await noOverflow(page, 'inside a muscle', width); await shot(page, 'w-muscle', width)
  for (const name of ['رفرفة جانبية جهاز', 'ضغط أكتاف جهاز']) await swipe(page, card(page, name).locator('.xc-in'))
  await page.locator('#mview [data-act="mv-close"]').last().click(); await settle(page, 900)
  await page.locator('.mcard[data-card="chest"]').click(); await settle(page, 1300)
  await swipe(page, card(page, 'ضغط صدر جهاز هامر').locator('.xc-in'))
  await page.locator('#mview [data-act="mv-close"]').last().click(); await settle(page, 900)
  await page.locator('[data-act="deck-done"]').click(); await settle(page, 400)
  await page.locator('#bld').click(); await settle(page, 1200)
  await noOverflow(page, 'وش ناقص', width); await shot(page, 'w-gaps', width)
  await page.locator('[data-act="fill"]').click(); await settle(page, 300)
  await page.locator('#bld').click(); await settle(page, 1200)
  await noOverflow(page, 'وش ناقص, filled', width); await shot(page, 'w-filled', width)
  await page.locator('#gaps-dock [data-act="to-plan"]').click(); await settle(page, 800)
  await page.locator('#plist .prow .pr-main').first().click(); await settle(page, 500)
  await noOverflow(page, 'خطتك', width); await shot(page, 'w-plan', width)
  await page.locator('[data-act="plan-start"]').click(); await settle(page, 700)
  await noOverflow(page, 'confirm', width); await shot(page, 'w-confirm', width)
  await page.locator('[data-act="activate"]').click(); await settle(page, 1300)
  await noOverflow(page, 'جاهزة', width); await shot(page, 'w-done', width)
  ok(`${width}: no page errors`, errors.length === 0, errors.join(' | '))
  await ctx.close()
}

// ── 5. Reduced motion: the build is a fade, never a flight ─────
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
  const page = await ctx.newPage()
  await page.route(u => u.pathname.startsWith('/pack/'), r => r.abort())
  await page.addInitScript(([version]) => {
    localStorage.setItem('hf_recovery', JSON.stringify({ daysPerWeek: 4 }))
    localStorage.setItem('hf_onboarded', 'true'); localStorage.setItem('hf_pack_prompted', '1')
    localStorage.setItem('hf_seen_version', JSON.stringify(version))
  }, [APP_VERSION])
  await page.goto(APP); await page.waitForTimeout(1000)
  await page.locator('[data-testid="build-plan"]').click(); await settle(page, 600)
  await page.locator('[data-act="start-auto"]').click(); await settle(page, 300)
  await page.locator('[data-act="basics-next"]').click()
  let ghosts = 0
  for (let i = 0; i < 10; i++) { ghosts += await page.locator('.ghost').count(); await page.waitForTimeout(100) }
  ok('reduced motion: no flying pictures in the build', ghosts === 0)
  await page.locator('#bld').waitFor({ state: 'detached', timeout: 4000 }).catch(() => {})
  ok('reduced motion: the plan is there when it fades out', (await page.locator('#gn').innerText()).trim() === '7')
  await ctx.close()
}

// ── 6. Round 5: the rule, the undo and the old plan ────────────
const dayBefore = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString('en-CA') }
async function autoPlanFromStart(page) {
  await page.locator('[data-act="start-auto"]').click(); await settle(page, 700)
  await page.locator('[data-act="basics-next"]').click(); await settle(page, 600)
  await page.locator('#bld').waitFor({ state: 'detached', timeout: 7000 }).catch(() => {})
  await page.locator('#gaps-dock [data-act="to-plan"]').click(); await settle(page, 800)
  await page.locator('[data-act="plan-start"]').click(); await settle(page, 600)
}
{
  // His first plan from the first run is a setup: no free change spent.
  const { ctx, page, errors } = await phone({ plan: null, onboarded: false })
  await page.getByRole('button', { name: 'التالي' }).click(); await settle(page, 400)
  await page.getByRole('button', { name: 'التالي' }).click(); await settle(page, 400)
  await page.getByRole('radio', { name: /أبني خطتي بنفسي/ }).click()
  await page.getByRole('button', { name: 'يلا نبدأ' }).click(); await settle(page, 1200)
  await autoPlanFromStart(page)
  const sheet = await page.locator('#sheet').innerText()
  ok('first plan: the sheet promises no old plan and no rule', !sheet.includes('تنحفظ') && !sheet.includes('بالقاعدة') && !sheet.includes('يكسر'), sheet)
  await page.locator('[data-act="activate"]').click(); await settle(page, 1200)
  const rc = await get(page, 'hf_recovery')
  ok('first plan: saved', /^custom_/.test((await get(page, 'hf_plan'))?.planId || ''))
  ok('first plan: the free change is not spent', !rc.lastSettingsChangeAt && !rc.streakResetAt, JSON.stringify(rc))
  ok('first plan: nothing to «رجّع»', await page.locator('#s-done [data-act="restore-prev"]').count() === 0)
  ok('first plan: no page errors', errors.length === 0, errors.join(' | '))
  await ctx.close()
}
{
  // A switch that breaks the streak, undone the same day: free, and the
  // rule and the streak go back to how they were.
  const last = dayBefore(12)
  const { ctx, page, errors } = await phone({ extra: { hf_recovery: { daysPerWeek: 4, lastSettingsChangeAt: last } } })
  await page.getByRole('button', { name: 'الإعدادات' }).first().click(); await settle(page)
  await page.locator('.k-row').filter({ hasText: 'الخطة' }).first().click(); await settle(page)
  await page.getByText('ابنِ خطتك على كيفك').click(); await settle(page, 900)
  await autoPlanFromStart(page)
  ok('switch in the cooldown: «فعّل واكسر الستريك»', (await page.locator('[data-act="activate"]').innerText()).includes('واكسر'))
  await page.locator('[data-act="activate"]').click(); await settle(page, 1200)
  const rc1 = await get(page, 'hf_recovery')
  ok('switch: stamped and the streak reset', rc1.lastSettingsChangeAt !== last && !!rc1.streakResetAt)
  await page.locator('#s-done [data-act="restore-prev"]').click(); await settle(page, 600)
  const sheet = await page.locator('#sheet').innerText()
  ok('undo right after: «ببلاش», not «يكسر الستريك»', sheet.includes('ببلاش') && !sheet.includes('يكسر'), sheet)
  await page.locator('[data-act="restore-yes"]').click(); await settle(page, 900)
  const rc2 = await get(page, 'hf_recovery')
  ok('undo: the machine plan is back', (await get(page, 'hf_plan'))?.planId === machine.planId)
  ok('undo: the free change and the streak are given back', rc2.lastSettingsChangeAt === last && !rc2.streakResetAt, JSON.stringify(rc2))
  ok('undo: no page errors', errors.length === 0, errors.join(' | '))
  await ctx.close()
}
{
  // A builder plan replaced from Settings is kept for «رجّع».
  const { ctx, page, errors } = await phone()
  await page.getByRole('button', { name: 'الإعدادات' }).first().click(); await settle(page)
  await page.locator('.k-row').filter({ hasText: 'الخطة' }).first().click(); await settle(page)
  await page.getByText('علوي/سفلي — 4 أيام').first().click(); await settle(page, 700)
  await page.getByRole('button', { name: 'فعّل البرنامج' }).click(); await settle(page, 700)
  await page.getByRole('button', { name: /أكّد التغيير|غيّر واكسر الستريك/ }).click(); await settle(page, 900)
  ok('settings switch: the new plan is in', (await get(page, 'hf_plan'))?.planId === 'upper_lower_4day')
  ok('settings switch: the plan it replaced is kept', (await get(page, 'hf_plan_prev'))?.plan?.planId === machine.planId)
  ok('settings switch: no page errors', errors.length === 0, errors.join(' | '))
  await ctx.close()
}
{
  // An exercise taken out on «خطتك» stays out after going back,
  // on the day it was on, whoever added it: a plan «كمّل خطتي» made is
  // all the app's (by:'app'), and its rows are picks like his own once
  // opened to edit.
  const byApp = { ...machine, planId: 'custom_20260901', source: 'builder', weeklySchedule: machine.weeklySchedule.map(d => ({ ...d, exercises: d.exercises.map(x => ({ ...x, by: 'app', why: 'ناقص' })) })) }
  const total = byApp.weeklySchedule.reduce((s, d) => s + d.exercises.length, 0)
  const { ctx, page, errors } = await phone({ plan: byApp, planIndex: 8 })
  await page.getByRole('button', { name: 'خيارات اليوم' }).click(); await settle(page)
  await page.locator('.k-row').filter({ hasText: 'عدّل الخطة' }).click(); await settle(page, 1100)
  const tab = () => page.evaluate(() => [...document.querySelectorAll('#daytabs .dtab')].findIndex(t => t.getAttribute('aria-selected') === 'true'))
  const ids = () => page.evaluate(() => window.__planner.state().plan.days.flatMap(d => d.items.map(it => it.id)))
  const day = await tab()
  ok('removed on «خطتك»: opened on today\'s day, not the first', day === 2, String(day))
  const row2 = page.locator('#plist .prow').nth(1)
  const gone = await row2.locator('.pr-ar').innerText()
  await row2.locator('.pr-main').click(); await settle(page, 500)
  await row2.locator('[data-act="rm"]').click(); await settle(page, 700)
  const left = await page.locator('#plist .pr-ar').allInnerTexts()
  await page.locator('#s-plan [data-act="back"]').click(); await settle(page, 900)
  await page.locator('#gaps-dock button').last().click(); await settle(page, 900)
  ok('removed on «خطتك», back and forward: the same day is shown', await tab() === day, String(await tab()))
  const names = await page.locator('#plist .pr-ar').allInnerTexts()
  ok('removed on «خطتك», back and forward: still out', !names.includes(gone) && names.join() === left.join(), `${gone} in ${names.join(',')}`)
  ok('removed on «خطتك», back and forward: on no other day either', (await ids()).length === total - 1, String((await ids()).length))
  // «تراجع» puts an app row back, its pick too
  const first = page.locator('#plist .prow').nth(0)
  const kept = await first.locator('.pr-ar').innerText()
  await first.locator('.pr-main').click(); await settle(page, 500)
  await first.locator('[data-act="rm"]').click(); await settle(page, 700)
  await page.locator('.toast button', { hasText: 'تراجع' }).click(); await settle(page, 600)
  await page.locator('#s-plan [data-act="back"]').click(); await settle(page, 900)
  await page.locator('#gaps-dock button').last().click(); await settle(page, 900)
  const names2 = await page.locator('#plist .pr-ar').allInnerTexts()
  ok('removed, «تراجع», back and forward: it is back', names2.includes(kept) && !names2.includes(gone) && (await ids()).length === total - 1, names2.join(','))
  ok('removed and back: no page errors', errors.length === 0, errors.join(' | '))
  await ctx.close()
}
{
  // «خطتك الحين» sits on the system his plan really uses.
  const ul = BUILT_IN_PLANS.find(p => p.planId === 'upper_lower_4day')
  const { ctx, page, errors } = await phone({ plan: ul, planIndex: 0 })
  await page.getByRole('button', { name: 'خيارات اليوم' }).click(); await settle(page)
  await page.locator('.k-row').filter({ hasText: 'عدّل الخطة' }).click(); await settle(page, 1100)
  await page.locator('#s-plan [data-act="back"]').click(); await settle(page, 900)
  await page.locator('#s-gaps [data-act="back"]').click(); await settle(page, 900)
  await page.locator('#s-deck [data-act="to-basics"]').click(); await settle(page, 900)
  const marked = await page.locator('#splits .split').filter({ hasText: 'خطتك الحين' }).allInnerTexts()
  ok('«خطتك الحين» on علوي · سفلي for the Upper/Lower plan', marked.length === 1 && marked[0].includes('علوي · سفلي'), marked.join(' | '))
  ok('«خطتك الحين»: no page errors', errors.length === 0, errors.join(' | '))
  await ctx.close()
}
{
  // «شيله», swiped back in, then a stale «تراجع»: never two of it.
  const { ctx, page, errors } = await phone()
  await page.getByRole('button', { name: 'الإعدادات' }).first().click(); await settle(page)
  await page.locator('.k-row').filter({ hasText: 'الخطة' }).first().click(); await settle(page)
  await page.getByText('ابنِ خطتك على كيفك').click(); await settle(page, 900)
  await page.getByText('عدّل خطتك الحالية').click(); await settle(page, 900)
  await page.locator('.mcard[data-card="biceps"]').click(); await settle(page, 1300)
  await page.locator('#mfix [data-act="much-yes"]').click(); await settle(page, 500)
  const c = card(page, 'مرجحة هامر كيبل')
  await swipe(page, c.locator('.xc-in'))
  const undo = page.locator('.toast button', { hasText: 'تراجع' })
  if (await undo.count()) { await undo.click(); await settle(page, 400) }
  const picks = await page.evaluate(() => window.__planner.state().picks.filter(p => p.id === 'cable_hammer_curl').length)
  ok('much + swipe back + تراجع: one pick, not two', picks === 1, String(picks))
  ok('much + swipe: no page errors', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

{
  // A timed move from the plan: the session counts its seconds.
  const timed = { planId: 'timed_test', planName: 'تجربة', daysPerWeek: '4', weeklySchedule: [
    { name: 'Lower — بطن', exercises: [{ name: 'Plank', muscle: 'Core', sets: 3, repsMin: 30, repsMax: 45, restSeconds: 60, unit: 'sec' }] },
    { name: 'Upper — صدر', exercises: [{ name: 'Bench Press', muscle: 'Chest', sets: 3, repsMin: 8, repsMax: 10 }] },
  ] }
  const { ctx, page, errors } = await phone({ plan: timed, planIndex: 0 })
  await page.getByRole('button', { name: /ابدأ/ }).first().click(); await settle(page, 1500)
  const active = await get(page, 'hf_active')
  ok('timed: the session carries the plan\'s unit', active?.exercises?.[0]?.unit === 'sec')
  const text = await page.locator('[data-testid="session-cover"]').innerText().catch(() => '')
  ok('timed: the target is in seconds', /30–45\s*ثانية/.test(text) || /الهدف[\s\S]*ثانية/.test(text), text.replace(/\s+/g, ' ').slice(0, 300))
  ok('timed: never «عدّة» beside the seconds', !/30–45\s*عدّة/.test(text))
  ok('timed: no page errors', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

await browser.close()

let failed = 0
for (const [name, pass, extra] of results) {
  if (!pass) failed++
  console.log(`${pass ? '✅' : '❌'} ${name}${extra && !pass ? `  — ${extra}` : ''}`)
}
console.log(`\n${failed ? `${failed} of ${results.length} failed` : `all ${results.length} passed`}`)
process.exit(failed ? 1 : 0)
