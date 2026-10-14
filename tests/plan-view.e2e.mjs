#!/usr/bin/env node
// End-to-end checks for «خطتي» (src/pages/planview) and the session's
// swap sheet, on a phone, with the art pack installed.
//
//   npm run build && npx vite preview --port 4901 --strictPort --host 127.0.0.1 &
//   APP=http://127.0.0.1:4901/ node tests/plan-view.e2e.mjs
//   SHOTS=/some/dir …   also saves screenshots (390×844 and 320×568)
//
// حمزة: «أحتاج إنه لما أبغى في زر حق الخطة أضغط عليه أشوف خطتي كلها بشكل
// كروت واضحة … وبعدين يكون سهل علي إن أنا في تمرين ما عجبني أغيره». What a
// browser is needed for: that the three doors open it (Home › تقدّم
// البرنامج, Settings › الخطة › «شوف خطتي», the session's ⋯); that its
// cards are the plan he really runs (a remembered swap, a set he added,
// his own reps, the template's reps not his) with the machines'
// pictures from the pack; that a swap from a card offers picture cards
// and writes his plan — which the old design at /classic/ then reads;
// that the steppers write sets, his own reps (repsOwn) and rest; that
// «شيله» leaves «تراجع»; and that the session's swap shows the
// alternatives as pictures and the rest of the session, then «بس هالمرة»
// touches only the session and «دايماً بخطتي» the plan too. Nothing may
// stick out sideways at 320, 390 or 430.
//
// The pack is installed once, from Settings, the way pack-install.e2e
// does it: the preview serves dist/pack at /pack/.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { mkdirSync } from 'node:fs'
import { APP_VERSION, ACHIEVEMENTS, BUILT_IN_PLANS } from '../src/constants.js'

const APP = process.env.APP || 'http://127.0.0.1:4901/'
const SHOTS = process.env.SHOTS || null
if (SHOTS) mkdirSync(SHOTS, { recursive: true })

const results = []
const ok = (name, cond, extra = '') => results.push([name, !!cond, extra])

// His plan: the machines plan, on its Pull day today (index 7 of 3), with
// a set he added to the cable row (was: 4), his own 8–12 on the hammer
// press, and the pec deck remembered as its first alternative (the cable fly).
const machine = JSON.parse(JSON.stringify(BUILT_IN_PLANS.find(p => p.planId === 'machine_beginner_3day')))
machine.startDate = '2026-09-01'
Object.assign(machine.weeklySchedule[1].exercises[1], { sets: 5, was: { sets: 4 } })
Object.assign(machine.weeklySchedule[0].exercises[0], { repsMin: 8, repsMax: 12, repsOwn: true })
const SUBS = { 'Pec Deck': 1 }
const DAY = 86400000
const sess = (daysAgo, dayIdx, list) => ({
  id: Date.now() - daysAgo * DAY, date: new Date(Date.now() - daysAgo * DAY).toISOString(), duration: 50,
  planDayIndex: dayIdx, planDayName: machine.weeklySchedule[dayIdx % 3].name,
  exercises: list.map(([name, muscle, w, r], i) => ({ id: `s${daysAgo}${i}`, name, muscle, sets: [w, w, w + 2.5].map(x => ({ weight: String(x), reps: String(r), done: true })) })),
})
const SESSIONS = [
  sess(2, 6, [['Hammer Strength Machine Bench Press', 'Chest', 70, 10], ['Machine Shoulder Press', 'Shoulders', 40, 10]]),
  sess(3, 5, [['Hack Squat', 'Legs', 100, 10], ['Leg Curl', 'Legs', 45, 12]]),
  sess(5, 4, [['Lat Pulldown', 'Back', 60, 10], ['Seated Cable Row', 'Back', 55, 12], ['Machine Preacher Curl', 'Biceps', 25, 12]]),
]
const SEED = {
  hf_plan: machine, hf_plan_index: 7, hf_exercise_subs: SUBS, hf_sessions: SESSIONS,
  hf_recovery: { daysPerWeek: 4 }, hf_profile: { name: 'حمزة', gymType: 'commercial' },
  hf_pack_prompted: '1', hf_seen_version: APP_VERSION, hf_weights_reset_v2: true, hf_onboarded: true,
  hf_unlocked: ACHIEVEMENTS.map(a => a.id), hf_rep_target: { id: 'volume', base: 12, top: 15 },
}

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar', timezoneId: 'Asia/Riyadh',
  serviceWorkers: 'block', hasTouch: true,
})
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(String(e)))
page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource/.test(m.text())) errors.push(m.text()) })

const settle = (ms = 700) => page.waitForTimeout(ms)
const get = (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), k)
const view = () => page.locator('[data-testid="plan-view"]')
const card = (day, name) => page.locator(`.pv-page[data-page="${day}"] [data-testid="plan-card"][data-name="${name}"]`)
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }) }
async function seed(extra = {}) {
  await page.evaluate(([s, extra]) => {
    for (const k of ['hf_active', 'hf_rest_timer', 'hf_plan_prev']) localStorage.removeItem(k)
    for (const [k, v] of Object.entries({ ...s, ...extra })) localStorage.setItem(k, JSON.stringify(v))
  }, [SEED, extra])
  await page.reload(); await settle(1300)
}
async function home() {
  await page.locator('nav.f-tabs > button').first().click(); await settle(500)
}
async function openFromHome() {
  await home()
  const row = page.locator('.k-row').filter({ hasText: machine.planName }).first()
  await row.scrollIntoViewIfNeeded()
  await row.click()
  await view().waitFor({ timeout: 8000 }).catch(() => {})
  await settle(1100)
}
async function closeView() {
  await page.locator('[data-testid="plan-view-close"]').click(); await settle(700)
}
/* Nothing sticks out sideways (clipped by an ancestor that clips is fine). */
async function noOverflow(label, root = '[data-testid="plan-view"], .k-sheet') {
  const bad = await page.evaluate((root) => {
    const vw = document.documentElement.clientWidth
    const out = []
    for (const top of document.querySelectorAll(root)) {
      for (const el of [top, ...top.querySelectorAll('*')]) {
        const r = el.getBoundingClientRect()
        if (!r.width || !r.height) continue
        let left = r.left, right = r.right
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
          const cs = getComputedStyle(a)
          if (cs.overflowX !== 'visible') { const ar = a.getBoundingClientRect(); left = Math.max(left, ar.left); right = Math.min(right, ar.right) }
        }
        if (right <= left) continue
        if (right > vw + 1.5 || left < -1.5) out.push(`${(el.className?.baseVal ?? el.className) || el.tagName}: ${Math.round(left)}–${Math.round(right)}`)
      }
    }
    return out.slice(0, 5)
  }, root)
  ok(`${label} — nothing overflows sideways`, bad.length === 0, bad.join(' | '))
}
/* Text that runs into the next line: every line box at least its font size tall. */
async function noCrowding(label) {
  const bad = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('[data-testid="plan-view"] .pv-card *, .k-sheet *')) {
      if (!el.childNodes.length || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue
      const cs = getComputedStyle(el)
      const lh = parseFloat(cs.lineHeight), fs = parseFloat(cs.fontSize)
      if (lh && fs && lh < fs * 1.1) out.push(`${el.className || el.tagName} ${fs}/${lh}`)
    }
    return out.slice(0, 5)
  })
  ok(`${label} — no line set tighter than its letters`, bad.length === 0, bad.join(' | '))
}

// ── 0. The pack, from Settings ────────────────────────────────
await page.goto(APP); await settle(800)
await seed()
await page.locator('button[aria-label="الإعدادات"]').first().click(); await settle(500)
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('حزمة الصور'))?.click()); await settle(600)
let phase = null
if (await page.locator('[data-pack="install"]').count()) {
  await page.locator('[data-pack="install"]').click()
  for (let i = 0; i < 300; i++) {
    phase = await page.locator('[data-pack-phase]').getAttribute('data-pack-phase').catch(() => null)
    if (['ready', 'error', 'offline', 'nospace'].includes(phase)) break
    await settle(500)
  }
}
ok('the art pack installs from the site\'s /pack/', phase === 'ready', `phase=${phase}`)
await seed()

// ── 1. Door 1: Home › تقدّم البرنامج ───────────────────────────
{
  await openFromHome()
  ok('home: the plan\'s row opens «خطتي»', await view().count() === 1 && await view().getAttribute('data-from') === 'home')
  ok('home: the app behind is inert', await page.evaluate(() => document.getElementById('root').inert === true))
  const sel = page.locator('.pv-tab[aria-selected="true"]')
  const selText = (await sel.innerText()).replace(/\s+/g, ' ')
  ok('it opens on today\'s day (index 7 of 3 → سحب), marked «اليوم»', /سحب/.test(selText) && /اليوم/.test(selText), selText)
  ok('three days, one tab each', await page.locator('.pv-tab').count() === 3)
  const pull = page.locator('.pv-page[data-page="1"] [data-testid="plan-card"]')
  ok('the day: one card per exercise (5)', await pull.count() === 5)
  ok('the day header: the word, the muscles, the count and minutes', /سحب/.test(await page.locator('.pv-page[data-page="1"] .pv-word').innerText())
    && /5/.test(await page.locator('.pv-page[data-page="1"] .pv-meta').innerText()) && /د/.test(await page.locator('.pv-page[data-page="1"] .pv-meta').innerText()))
  ok('the day header: the muscles lit on the body', await page.locator('.pv-page[data-page="1"] .pv-body .pv-b-lit').count() > 0)
  const imgs = await page.locator('.pv-page[data-page="1"] [data-testid="plan-card"] .pv-art img').evaluateAll(els => els.map(i => i.src))
  ok('the cards show the machines\' own pictures, from the installed pack', imgs.length === 5 && imgs.every(s => s.startsWith('blob:')), imgs.slice(0, 2).join(' '))
  const lat = (await card(1, 'Lat Pulldown').innerText()).replace(/\s+/g, ' ')
  ok('a card: Arabic name, English, muscle, tool', /سحب أمامي/.test(lat) && /Lat Pulldown/.test(lat) && /ظهر/.test(lat) && /جهاز/.test(lat), lat)
  ok('a card: sets × his Settings reps (the template\'s 10 is not his) and rest', /4/.test(lat) && /12–15/.test(lat) && /راحة/.test(lat), lat)
  ok('a card: last time\'s weight × reps and his best', /آخر مرة 62\.5 كجم × 10/.test(lat) && /أعلى 62\.5 كجم/.test(lat), lat)
  const row = (await card(1, 'Seated Cable Row').innerText()).replace(/\s+/g, ' ')
  ok('a set he added says so: «مجموعة زيادة», on 5 sets', /مجموعة زيادة/.test(row) && /\b5\b/.test(row), row)
  ok('nothing changed, nothing said: no badge on the pulldown', await card(1, 'Lat Pulldown').locator('.pv-badge').count() === 0)
  await shot('390-plan-view-today')
  await page.locator('.pv-tab[data-day="0"]').click(); await settle(1100)
  ok('a tab moves to its day', (await page.locator('.pv-tab[aria-selected="true"]').innerText()).includes('دفع'))
  const fly = card(0, 'Cable Fly')
  ok('a remembered swap shows what he really does: the cable fly, «بدّلته بدل» the pec deck',
    await fly.count() === 1 && /بدّلته بدل تفتيح جهاز \(بك دك\)/.test((await fly.innerText()).replace(/\s+/g, ' ')))
  const ham = (await card(0, 'Hammer Strength Machine Bench Press').innerText()).replace(/\s+/g, ' ')
  ok('his own reps: 8–12, «عدّاتك أنت»', /8–12/.test(ham) && /عدّاتك أنت/.test(ham), ham)
  await shot('390-plan-view-push')
  // a swipe to the next day moves the tab with it
  await page.locator('.pv-pages').evaluate(el => el.scrollTo({ left: -el.clientWidth * 2, behavior: 'auto' })); await settle(700)
  ok('a swipe to a day moves its tab', (await page.locator('.pv-tab[aria-selected="true"]').innerText()).includes('أرجل'))
  await noOverflow('390: the plan view')
  await noCrowding('390: the cards')
  for (const w of [320, 430]) {
    await page.setViewportSize({ width: w, height: w === 320 ? 568 : 932 }); await settle(600)
    await noOverflow(`${w}: the plan view`)
    if (w === 320) {
      await page.locator('.pv-tab[data-day="1"]').click(); await settle(900)
      await shot('320-plan-view')
    }
  }
  await page.setViewportSize({ width: 390, height: 844 }); await settle(500)
  await closeView()
  ok('× closes it, the app usable again', await view().count() === 0
    && await page.evaluate(() => !document.getElementById('root').inert && document.body.style.overflow !== 'hidden'))
}

// ── 2. Door 2: Settings › الخطة › «شوف خطتي» ───────────────────
{
  await page.locator('button[aria-label="الإعدادات"]').first().click(); await settle(500)
  await page.locator('.k-row').filter({ hasText: 'الخطة' }).first().click(); await settle(600)
  const row = page.locator('.k-row').filter({ hasText: 'شوف خطتي' })
  ok('settings › الخطة: «شوف خطتي» is there', await row.count() === 1)
  await row.click(); await view().waitFor({ timeout: 8000 }).catch(() => {}); await settle(900)
  ok('settings: it opens «خطتي»', await view().count() === 1 && await view().getAttribute('data-from') === 'settings')
  await page.keyboard.press('Escape'); await settle(700)
  ok('Escape closes it', await view().count() === 0)
  await home()
}

// ── 3. From a card: swap, steppers, remove and تراجع ──────────
{
  await openFromHome()
  await card(1, 'Lat Pulldown').click(); await settle(800)
  ok('a card opens its sheet', await page.locator('[data-testid="exercise-sheet"]').count() === 1)
  await shot('390-card-sheet')
  await noOverflow('390: a card\'s sheet', '.k-sheet')
  await page.locator('[data-testid="xs-swap"]').click(); await settle(800)
  const alts = page.locator('.k-sheet [data-testid="alt-card"]')
  const n = await alts.count()
  const altImgs = await alts.locator('img').evaluateAll(els => els.map(i => i.src))
  ok('«بدّله»: the alternatives as picture cards', n >= 4 && altImgs.length === n && altImgs.slice(0, 4).every(s => s.startsWith('blob:')), `${n} cards`)
  ok('«بدّله»: the same muscle first, then the same movement with another tool',
    await page.locator('.k-sheet .ac-group[data-group="muscle"]').count() === 1
    && await page.locator('.k-sheet .ac-group').first().getAttribute('data-group') === 'muscle')
  const names = await alts.evaluateAll(els => els.map(e => e.dataset.name))
  ok('«بدّله»: never one already on the day', !names.some(x => ['Seated Cable Row', 'Machine Pullover', 'Machine Preacher Curl', 'Cable Hammer Curls'].includes(x)), names.join(', '))
  const firstText = (await alts.first().innerText()).replace(/\s+/g, ' ')
  ok('a card says its tool and his last weight on it (or that he never did it)', /(جهاز|كيبل|دمبل|بار|وزن الجسم)/.test(firstText) && /(آخر مرة|ما جرّبته)/.test(firstText), firstText)
  await shot('390-alternatives')
  await noOverflow('390: the alternatives', '.k-sheet')
  const pick = names[0]
  await alts.first().click(); await settle(1200)
  const plan = await get('hf_plan')
  const r0 = plan.weeklySchedule[1].exercises[0]
  ok('the swap is written into his plan, noting what it replaced', r0.name === pick && r0.was?.name === 'Lat Pulldown', JSON.stringify(r0))
  ok('his plan stays one both designs open (sets, reps, rest kept)', r0.sets === 4 && r0.restSeconds === 120 && typeof r0.muscle === 'string')
  ok('the day he reached is kept, the streak\'s rule untouched', await get('hf_plan_index') === 7 && !(await get('hf_recovery'))?.lastSettingsChangeAt)
  const swapped = card(1, pick)
  ok('the card shows the new machine, «بدّلته بدل سحب أمامي»', await swapped.count() === 1
    && /بدّلته بدل سحب أمامي/.test((await swapped.innerText()).replace(/\s+/g, ' ')))
  ok('«رجّع خطتك القديمة» keeps the plan before the edit', (await get('hf_plan_prev'))?.plan?.weeklySchedule?.[1]?.exercises?.[0]?.name === 'Lat Pulldown')

  // sets, reps, rest
  await card(1, 'Seated Cable Row').click(); await settle(800)
  await page.locator('[data-testid="xs-sets"] button[aria-label$="أكثر"]').click(); await settle(400)
  await page.locator('[data-testid="xs-reps"] button[aria-label$="أكثر"]').click(); await settle(400)
  await page.locator('[data-testid="xs-rest"] button[aria-label$="أكثر"]').click(); await settle(400)
  const r1 = (await get('hf_plan')).weeklySchedule[1].exercises[1]
  ok('sets +1: 6, noted against the 4 it had', r1.sets === 6 && r1.was?.sets === 4, JSON.stringify(r1))
  ok('reps stepped from his Settings 12–15: 12–20, and his own now (repsOwn)', r1.repsMin === 12 && r1.repsMax === 20 && r1.repsOwn === true, JSON.stringify(r1))
  ok('rest stepped: 120 → 150', r1.restSeconds === 150, String(r1.restSeconds))
  ok('the sheet says it: «عدّاتك أنت»', /عدّاتك أنت/.test(await page.locator('[data-testid="xs-reps"]').innerText()))
  await shot('390-card-sheet-edited')
  await page.locator('.k-sheet [aria-label="إغلاق"]').click(); await settle(600)
  const c1 = (await card(1, 'Seated Cable Row').innerText()).replace(/\s+/g, ' ')
  ok('the card follows: «مجموعتين زيادة», 12–20, «عدّاتك أنت»', /مجموعتين زيادة/.test(c1) && /12–20/.test(c1) && /عدّاتك أنت/.test(c1), c1)
  ok('the old plan saved stays the one before today\'s first edit', (await get('hf_plan_prev'))?.plan?.weeklySchedule?.[1]?.exercises?.[0]?.name === 'Lat Pulldown')

  // remove, تراجع
  await card(1, 'Machine Pullover').click(); await settle(800)
  await page.locator('[data-testid="xs-remove"]').click(); await settle(900)
  ok('«شيله»: gone from his plan', (await get('hf_plan')).weeklySchedule[1].exercises.length === 4
    && !(await get('hf_plan')).weeklySchedule[1].exercises.some(x => x.name === 'Machine Pullover'))
  const undo = page.locator('[data-testid="plan-undo"]')
  ok('«شيله»: «تراجع» in its place, naming it', await undo.count() === 1 && /بلأوفر جهاز/.test(await undo.innerText()))
  await shot('390-removed-undo')
  await undo.getByRole('button', { name: 'تراجع' }).click(); await settle(900)
  const back = (await get('hf_plan')).weeklySchedule[1].exercises
  ok('«تراجع»: back where it was', back.length === 5 && back[2].name === 'Machine Pullover', back.map(x => x.name).join(', '))
  ok('«تراجع»: the card is back', await card(1, 'Machine Pullover').count() === 1 && await undo.count() === 0)
  await closeView()

  // the old design reads the plan written here
  const cp = await ctx.newPage()
  const cerr = []
  cp.on('pageerror', e => cerr.push(String(e)))
  await cp.addInitScript(() => localStorage.setItem('meran_design', 'classic'))
  await cp.goto(new URL('/classic/', APP).href); await cp.waitForTimeout(2200)
  ok('classic: the old design opens', new URL(cp.url()).pathname === '/classic/')
  await cp.evaluate(() => [...document.querySelectorAll('button')].find(b => /عرض التمارين|التمارين/.test(b.textContent))?.click())
  await cp.waitForTimeout(900)
  const ctext = await cp.locator('body').innerText()
  ok('classic: reads the swap and the sets written from «خطتي»', ctext.includes(pick) && ctext.includes('×6'), ctext.slice(0, 300))
  ok('classic: no NaN, no page errors', !ctext.includes('NaN') && cerr.length === 0, cerr.join(' | '))
  await cp.evaluate(() => localStorage.setItem('meran_design', 'new'))
  await cp.close()
}

// ── 4. The session: «شوف خطتي», and the swap with its pictures ─
{
  await seed()
  await home()
  await page.getByRole('button', { name: 'ابدأ التمرين' }).first().click(); await settle(1600)
  const act0 = await get('hf_active')
  ok('session: starts on today\'s day', act0?.planDayIndex === 7 && act0.exercises[0].name === 'Lat Pulldown')
  // door 3: ⋯ › «شوف خطتي»
  await page.getByRole('button', { name: 'خيارات التمرين' }).click(); await settle(600)
  const planRow = page.locator('.k-sheet').last().getByRole('button', { name: /شوف خطتي/ })
  ok('session ⋯: «شوف خطتي» is there', await planRow.count() === 1)
  await planRow.click(); await view().waitFor({ timeout: 8000 }).catch(() => {}); await settle(1000)
  ok('session: «خطتي» opens over it, on the session\'s day', await view().getAttribute('data-from') === 'session'
    && /جلستك الحين/.test(await page.locator('.pv-tab[aria-selected="true"]').innerText()))
  ok('session: it says an edit is for the next session', /الجلسة الجاية/.test(await page.locator('.pv-live').innerText()))
  await closeView()
  ok('session: back in the session after ×', await page.locator('[data-testid="session"]').count() === 1)

  // the swap sheet
  await page.getByRole('button', { name: 'خيارات التمرين' }).click(); await settle(600)
  await page.locator('.k-sheet').last().getByRole('button', { name: /استبدال التمرين/ }).click(); await settle(900)
  const sheet = page.locator('[data-testid="swap-sheet"]')
  const cards = sheet.locator('[data-testid="alt-card"]')
  const cimgs = await cards.locator('img').evaluateAll(els => els.map(i => i.src))
  ok('session swap: the alternatives as picture cards', await cards.count() >= 4 && cimgs.slice(0, 4).every(s => s.startsWith('blob:')), `${await cards.count()}`)
  const up = sheet.locator('[data-testid="swap-upcoming"] li')
  const upText = (await up.first().innerText()).replace(/\s+/g, ' ')
  ok('session swap: what comes next, with pictures — «التالي» first', await up.count() === 4 && /التالي/.test(upText) && /تجديف كيبل جالس/.test(upText)
    && (await up.locator('img').evaluateAll(els => els.every(i => i.src.startsWith('blob:')))), upText)
  ok('session swap: nothing changes before he picks', (await get('hf_active')).exercises[0].name === 'Lat Pulldown'
    && await page.locator('[data-testid="swap-foot"]').count() === 0)
  const cnames = await cards.evaluateAll(els => els.map(e => e.dataset.name))
  ok('session swap: never an exercise already in the session', !cnames.some(x => ['Seated Cable Row', 'Machine Pullover', 'Machine Preacher Curl', 'Cable Hammer Curls'].includes(x)), cnames.join(', '))
  await cards.first().click(); await settle(600)
  ok('session swap: a pick offers «بس هالمرة» and «دايماً بخطتي»', await page.locator('[data-testid="swap-once"]').count() === 1
    && await page.locator('[data-testid="swap-always"]').count() === 1)
  await shot('390-session-swap')
  await noOverflow('390: the session swap', '.k-sheet')
  await page.setViewportSize({ width: 320, height: 568 }); await settle(600)
  await noOverflow('320: the session swap', '.k-sheet')
  await shot('320-session-swap')
  await page.setViewportSize({ width: 390, height: 844 }); await settle(400)
  const once = cnames[0]
  await page.locator('[data-testid="swap-once"]').click(); await settle(900)
  const a1 = await get('hf_active')
  ok('«بس هالمرة»: the session runs on it, «بدل» the pulldown', a1.exercises[0].name === once && a1.exercises[0].originalName === 'Lat Pulldown'
    && (await page.getByTestId('exercise-name').textContent()).length > 0)
  ok('«بس هالمرة»: his plan untouched', (await get('hf_plan')).weeklySchedule[1].exercises[0].name === 'Lat Pulldown')
  ok('«بس هالمرة»: the sets kept, none done, no rest started', a1.exercises[0].sets.length === 4 && a1.exercises[0].sets.every(s => !s.done) && !(await get('hf_rest_timer')))

  await page.getByRole('button', { name: 'خيارات التمرين' }).click(); await settle(600)
  await page.locator('.k-sheet').last().getByRole('button', { name: /استبدال التمرين/ }).click(); await settle(900)
  ok('swapped already: the plan\'s own comes first, «الأصلي»', await sheet.locator('.ac-group[data-group="original"] [data-name="Lat Pulldown"]').count() === 1)
  const always = (await sheet.locator('.ac-group[data-group="muscle"] [data-testid="alt-card"]').evaluateAll(els => els.map(e => e.dataset.name))).find(x => x !== once)
  await sheet.locator(`[data-testid="alt-card"][data-name="${always}"]`).click(); await settle(500)
  await page.locator('[data-testid="swap-always"]').click(); await settle(1100)
  const a2 = await get('hf_active')
  const p2 = (await get('hf_plan')).weeklySchedule[1].exercises[0]
  ok('«دايماً بخطتي»: the session runs on it', a2.exercises[0].name === always, a2.exercises[0].name)
  ok('«دايماً بخطتي»: his plan\'s row is it now, noting the pulldown', p2.name === always && p2.was?.name === 'Lat Pulldown', JSON.stringify(p2))
  ok('«دايماً بخطتي»: free — the day he reached and the streak\'s rule untouched', await get('hf_plan_index') === 7 && !(await get('hf_recovery'))?.lastSettingsChangeAt)
  // and «خطتي» shows it
  await page.getByRole('button', { name: 'خيارات التمرين' }).click(); await settle(600)
  await page.locator('.k-sheet').last().getByRole('button', { name: /شوف خطتي/ }).click(); await settle(1100)
  ok('«خطتي» shows the swap made in the session', /بدّلته بدل سحب أمامي/.test((await card(1, always).innerText().catch(() => '')).replace(/\s+/g, ' ')))
  await closeView()
  // a set done: no swap any more (sets are never moved to another machine)
  await page.locator('[data-testid="complete-set"]').click(); await settle(900)
  await page.locator('.s-dock').getByRole('button', { name: /تخطي/ }).click().catch(() => {}); await settle(600)
  await page.getByRole('button', { name: 'خيارات التمرين' }).click(); await settle(600)
  ok('after a set is done there is no swap', await page.locator('.k-sheet').last().getByRole('button', { name: /استبدال التمرين/ }).count() === 0)
  await page.keyboard.press('Escape'); await settle(500)
}

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

for (const [n, p, e] of results) console.log(p ? '✅' : '❌', n, !p && e ? `— ${e}` : '')
await browser.close()
const failed = results.filter(r => !r[1]).length
console.log(failed ? `\n${failed} failed` : `\nall ${results.length} passed`)
process.exit(failed ? 1 : 0)
