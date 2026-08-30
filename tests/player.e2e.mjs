#!/usr/bin/env node
// End-to-end checks for the workout player on a phone.
//
//   npm run build && npx vite preview --port 4173 &
//   node tests/player.e2e.mjs
//
// What only a browser can answer: does the flow actually flow — set,
// rest, set, done, next exercise — does the carousel's structural
// protection hold, and does the media ladder decay the way it claims.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { mkdirSync } from 'node:fs'

const APP = process.env.APP || 'http://localhost:4173/'
const OUT = process.env.OUT || '/tmp/meran-player-e2e'
mkdirSync(OUT, { recursive: true })

const results = []
const ok = (name, cond, extra = '') => results.push([name, !!cond, extra])

const ACTIVE = {
  id: Date.now() - 5 * 60000, date: new Date().toISOString(), name: 'Push — اختبار',
  exercises: [
    { id: 'a', muscle: 'Chest', name: 'Hammer Strength Machine Bench Press',
      sets: [{ weight: '75', reps: '12', done: false }, { weight: '75', reps: '12', done: false }] },
    { id: 'b', muscle: 'Chest', name: 'Pec Deck',
      sets: [{ weight: '50', reps: '12', done: false }, { weight: '50', reps: '12', done: false }] },
    { id: 'c', muscle: 'Shoulders', name: 'Machine Shoulder Press',
      sets: [{ weight: '40', reps: '12', done: false }] },
  ],
}

const browser = await chromium.launch()

async function open({ device = 'iPhone 13', blockRemote = true, active = ACTIVE } = {}) {
  const ctx = await browser.newContext({
    ...devices[device], timezoneId: 'Asia/Riyadh', locale: 'ar',
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  if (blockRemote) await page.route('**/*.r2.dev/**', r => r.abort())

  await page.addInitScript(([active]) => {
    localStorage.setItem('hf_profile', JSON.stringify({ name: 'حمزة' }))
    localStorage.setItem('hf_pack_prompted', '1')
    localStorage.setItem('hf_seen_version', JSON.stringify('2.2'))
    localStorage.setItem('hf_weights_reset_v2', 'true')
    if (active) localStorage.setItem('hf_active', JSON.stringify(active))
  }, [active])

  await page.goto(APP, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1400)
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')]
      .find(e => (e.textContent || '').trim() === 'تمرين' && getComputedStyle(e).cursor === 'pointer')
    el?.click()
  })
  await page.waitForTimeout(1200)
  return { ctx, page, errors }
}

const activeStored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('hf_active')))

// ══ 1. The core flow: set → rest → set → done → advance ═══════
{
  const { ctx, page, errors } = await open()

  ok('player: it opens on the first exercise', await page.getByText('المجموعة الحالية').count() > 0)
  ok('player: the working area shows 1 of 2',
    /1 من 2/.test(await page.evaluate(() => document.body.innerText)))

  await page.getByRole('button', { name: /إنهاء المجموعة/ }).click()
  await page.waitForTimeout(700)

  let st = await activeStored(page)
  ok('flow: completing marks the set done in storage', st.exercises[0].sets[0].done === true)
  ok('flow: rest appears inline, not as a floating card',
    await page.getByText('راحة بين المجموعات').count() > 0)
  ok('flow: the floating rest overlay stays away',
    await page.evaluate(() => ![...document.querySelectorAll('div')]
      .some(d => getComputedStyle(d).position === 'fixed' && /تمام ✓/.test(d.textContent || ''))))

  // ±15 actually moves the clock
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_rest_timer'))?.endsAt)
  await page.locator('button', { hasText: '15' }).filter({ hasText: '+' }).first().click()
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_rest_timer'))?.endsAt)
  ok('rest: +15 pushes endsAt by 15s', after - before === 15000, String(after - before))

  await page.getByText('تخطي الراحة').click()
  await page.waitForTimeout(500)
  ok('rest: skip returns to the working area', await page.getByText('المجموعة الحالية').count() > 0)
  ok('rest: skip cleared the stored timer',
    await page.evaluate(() => localStorage.getItem('hf_rest_timer') === null))

  // finish the exercise → transition card → auto-advance
  await page.getByRole('button', { name: /إنهاء المجموعة/ }).click()
  await page.waitForTimeout(600)
  ok('completion: the transition card names the finished exercise',
    /مكتمل ✓/.test(await page.evaluate(() => document.body.innerText)))
  await page.waitForTimeout(2200)
  const heroNames = await page.evaluate(() => {
    const mid = window.innerWidth / 2
    let best = null, dist = Infinity
    for (const el of document.querySelectorAll('div')) {
      if (!/^(Hammer Strength Machine Bench Press|Pec Deck|Machine Shoulder Press)$/.test((el.textContent || '').trim())) continue
      const r = el.getBoundingClientRect()
      const d = Math.abs(r.left + r.width / 2 - mid)
      if (d < dist) { dist = d; best = el.textContent.trim() }
    }
    return best
  })
  ok('completion: the carousel advanced to the next exercise', heroNames === 'Pec Deck', String(heroNames))

  ok('flow: no page errors', errors.length === 0, errors.join('; '))
  await page.screenshot({ path: `${OUT}/flow.png`, fullPage: true })
  await ctx.close()
}

// ══ 2. Protection: edits always land on the exercise on screen ═
{
  const { ctx, page, errors } = await open()

  // Jump to the third exercise via the queue…
  await page.getByRole('button', { name: /Machine Shoulder Press/ }).last().click()
  await page.waitForTimeout(900)

  // …then type a weight in the (single) working area.
  const inputs = page.locator('input[inputmode="decimal"]')
  await inputs.first().fill('99')
  await page.waitForTimeout(400)

  const st = await activeStored(page)
  ok('protection: the edit landed on the exercise on screen',
    st.exercises[2].sets[0].weight === '99', JSON.stringify(st.exercises.map(e => e.sets[0].weight)))
  ok('protection: the other exercises are untouched',
    st.exercises[0].sets[0].weight === '75' && st.exercises[1].sets[0].weight === '50')
  ok('protection: only one working area exists in the DOM',
    await page.getByText('المجموعة الحالية').count() === 1)

  // Editing a past set announces itself
  await page.getByRole('button', { name: /إنهاء المجموعة/ }).click()
  await page.waitForTimeout(600)
  const skipBtn = page.getByRole('button', { name: /تخطي الراحة/ })
  if (await skipBtn.count()) { await skipBtn.click(); await page.waitForTimeout(2400) }
  // back to first exercise, edit its... use queue to first
  await page.getByRole('button', { name: /Hammer Strength/ }).last().click()
  await page.waitForTimeout(900)
  ok('protection: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 3. The media ladder decays, never breaks ══════════════════
{
  // Remote blocked, no pack: the muscle-group art is the floor.
  const { ctx, page, errors } = await open({ blockRemote: true })
  const img = await page.evaluate(() => {
    const media = [...document.querySelectorAll('img')].map(i => i.src)
    return media.some(s => /muscle_chest/.test(s))
  })
  ok('media: with nothing else, the muscle art carries the hero', img)
  ok('media: no page errors on the floor rung', errors.length === 0)
  await ctx.close()
}

// ══ 4. A new exercise does not leave you with empty boxes ═════
//
// The regression: a session pre-fills its sets from history, so a
// familiar lift hides this entirely. On an exercise with no history
// every set arrives blank, and completing one left the next one blank
// too — each rest ended on two empty boxes with the weight you had
// just lifted nowhere on screen.
{
  const FRESH = {
    id: Date.now() - 60000, date: new Date().toISOString(), name: 'Legs — اختبار',
    exercises: [
      { id: 'n', muscle: 'Legs', name: 'Leg Press',
        sets: [{ weight: '', reps: '', done: false }, { weight: '', reps: '', done: false }] },
    ],
  }
  const { ctx, page, errors } = await open({ active: FRESH })
  const fields = () => page.evaluate(() =>
    [...document.querySelectorAll('input[inputmode="decimal"]')].map(i => i.value))

  ok('fresh: an exercise with no history starts blank',
    (await fields()).every(v => v === ''))

  const ins = page.locator('input[inputmode="decimal"]')
  await ins.nth(0).fill('80')
  await ins.nth(1).fill('12')
  await page.getByRole('button', { name: /إنهاء المجموعة/ }).click()
  await page.waitForTimeout(600)

  // End the rest the way the clock would.
  await page.evaluate(() => {
    const t = JSON.parse(localStorage.getItem('hf_rest_timer') || '{}')
    t.endsAt = Date.now() - 300
    localStorage.setItem('hf_rest_timer', JSON.stringify(t))
  })
  await page.waitForTimeout(2600)

  const after = await fields()
  ok('fresh: the next set carries what you just lifted', after[0] === '80' && after[1] === '12',
    JSON.stringify(after))
  ok('fresh: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 5. Swiping during a completion card does not lock the player ═
//
// The regression: the card's dismissal timer used to live in the
// effect keyed on the carousel's current exercise, so swiping inside
// its 1.6s window ran that effect's cleanup, cancelled the dismissal,
// and left the trophy on screen permanently — covering the working
// area for the rest of the session with no way back.
{
  const TWO = {
    id: Date.now() - 60000, date: new Date().toISOString(), name: 'Legs — اختبار',
    exercises: [
      { id: 'p', muscle: 'Legs', name: 'Leg Press', sets: [{ weight: '40', reps: '12', done: false }] },
      { id: 'c', muscle: 'Legs', name: 'Leg Curl',
        sets: [{ weight: '30', reps: '12', done: false }, { weight: '30', reps: '12', done: false }] },
    ],
  }
  const { ctx, page, errors } = await open({ active: TWO })
  const seen = () => page.evaluate(() => ({
    celebrating: /مكتمل ✓/.test(document.body.innerText),
    workingArea: /المجموعة الحالية/.test(document.body.innerText),
    inputs: document.querySelectorAll('input[inputmode="decimal"]').length,
  }))

  await page.getByRole('button', { name: /إنهاء المجموعة/ }).click()
  await page.waitForTimeout(400)
  ok('celebration: completing the last set raises the card', (await seen()).celebrating)

  // Swipe on while the card is still up — the move that used to lock it.
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('button')].find(b => /Leg Curl/.test(b.textContent))
    row?.click()
  })
  await page.waitForTimeout(3400)
  ok('celebration: swiping away clears the card instead of freezing it',
    !(await seen()).celebrating)

  await page.evaluate(() => {
    const t = JSON.parse(localStorage.getItem('hf_rest_timer') || '{}')
    t.endsAt = Date.now() - 300
    localStorage.setItem('hf_rest_timer', JSON.stringify(t))
  })
  await page.waitForTimeout(2600)
  const back = await seen()
  ok('celebration: the working area comes back after the rest',
    back.workingArea && back.inputs === 2, JSON.stringify(back))
  ok('celebration: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 6. A small screen still fits ══════════════════════════════
{
  const { ctx, page, errors } = await open({ device: 'iPhone SE' })
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth)
  ok('SE: no horizontal overflow', overflow <= 1, String(overflow))
  ok('SE: the complete button is on screen', await page.getByRole('button', { name: /إنهاء المجموعة/ }).count() > 0)
  ok('SE: no page errors', errors.length === 0)
  await page.screenshot({ path: `${OUT}/se.png`, fullPage: true })
  await ctx.close()
}

await browser.close()

console.log(`\n  screenshots in ${OUT}\n`)
let failed = 0
for (const [name, pass, extra] of results) {
  if (!pass) failed++
  console.log(`${pass ? '✅' : '❌'} ${name}${extra && !pass ? `  — ${extra}` : ''}`)
}
console.log(`\n${failed ? `${failed} of ${results.length} failed` : `all ${results.length} passed`}`)
process.exit(failed ? 1 : 0)
