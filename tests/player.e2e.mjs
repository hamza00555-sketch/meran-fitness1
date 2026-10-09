#!/usr/bin/env node
// End-to-end checks for session mode (the workout player) on a phone.
//
//   npm run build && npx vite preview --port 4173 &
//   node tests/player.e2e.mjs            # APP=http://localhost:4173/ by default
//
// What only a browser can answer: does the loop actually flow — set,
// rest, «جاهز», set, done, next exercise — do edits land only on the
// exercise on screen, does the raise live on the number, do the counters
// and the docked button fit a 320×568 screen, does the rest make its
// sound and keep the screen awake, does a finger scrolling over a
// stepper leave the weight alone, and does the clock tell wall time.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { mkdirSync } from 'node:fs'
import { APP_VERSION, ACHIEVEMENTS } from '../src/constants.js'

const APP = process.env.APP || 'http://localhost:4173/'
const OUT = process.env.OUT || '/tmp/meran-player-e2e'
mkdirSync(OUT, { recursive: true })

const results = []
const ok = (name, cond, extra = '') => results.push([name, !!cond, extra])

const ACCENT = 'rgb(94, 195, 42)'
const GOLD   = 'rgb(251, 191, 36)'
const DANGER = 'rgb(242, 85, 85)'

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

// Instruments installed before the app loads: a recording AudioContext
// (so the scheduled rest tones can be read back) and a Wake Lock stub.
function instruments() {
  window.__tones = []
  window.__wakeLocks = 0
  class FakeParam { setValueAtTime() {} exponentialRampToValueAtTime() {} }
  class FakeOsc {
    constructor(ctx) { this.ctx = ctx; this.frequency = { value: 0 }; this.type = 'sine' }
    connect() {} disconnect() {}
    start(t) { window.__tones.push({ f: this.frequency.value, at: t - this.ctx.currentTime }) }
    stop() {}
  }
  class FakeCtx {
    constructor() { this.state = 'running'; this.destination = {}; this.t0 = performance.now() }
    get currentTime() { return (performance.now() - this.t0) / 1000 }
    resume() { this.state = 'running'; return Promise.resolve() }
    createOscillator() { return new FakeOsc(this) }
    createGain() { return { gain: new FakeParam(), connect() {}, disconnect() {} } }
  }
  window.AudioContext = FakeCtx
  window.webkitAudioContext = FakeCtx
  try {
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request: async () => { window.__wakeLocks++; return { released: false, release: async () => {} } } },
    })
  } catch {}
}

async function open({ device = 'iPhone 13', viewport = null, blockRemote = true, active = ACTIVE,
  sessions = null, reduced = false, lastWeights = null, mapping = null } = {}) {
  const ctx = await browser.newContext({
    ...devices[device], ...(viewport ? { viewport } : null),
    timezoneId: 'Asia/Riyadh', locale: 'ar',
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  if (blockRemote) await page.route('**/*.r2.dev/**', r => r.abort())

  await page.addInitScript(instruments)
  // Seeded history unlocks achievements on the first paint, each one
  // adds XP, and the level-up screen would cover the session — so a
  // context with history starts with them already unlocked.
  await page.addInitScript(([active, sessions, version, lastWeights, unlocked, mapping]) => {
    if (sessions) localStorage.setItem('hf_unlocked', JSON.stringify(unlocked))
    localStorage.setItem('hf_profile', JSON.stringify({ name: 'حمزة' }))
    localStorage.setItem('hf_pack_prompted', '1')
    localStorage.setItem('hf_seen_version', JSON.stringify(version))
    localStorage.setItem('hf_onboarded', 'true')
    localStorage.setItem('hf_weights_reset_v2', 'true')
    if (active) localStorage.setItem('hf_active', JSON.stringify(active))
    if (sessions) localStorage.setItem('hf_sessions', JSON.stringify(sessions))
    if (lastWeights) localStorage.setItem('hf_last_weights', JSON.stringify(lastWeights))
    if (mapping) localStorage.setItem('hf_exercise_mapping', JSON.stringify(mapping))
  }, [active, sessions, APP_VERSION, lastWeights, ACHIEVEMENTS.map(a => a.id), mapping])

  await page.goto(APP, { waitUntil: 'domcontentloaded' })
  // A stored session opens the full-screen cover by itself.
  await page.locator('[data-testid="session"]').waitFor({ timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(700)
  return { ctx, page, errors }
}

const activeStored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('hf_active')))
const text = (page) => page.evaluate(() => document.body.innerText)
const completeBtn = (page) => page.getByRole('button', { name: /تمّت المجموعة/ })
const endRest = (page, agoMs = 300) => page.evaluate((ago) => {
  const t = JSON.parse(localStorage.getItem('hf_rest_timer') || '{}')
  t.endsAt = Date.now() - ago
  localStorage.setItem('hf_rest_timer', JSON.stringify(t))
}, agoMs)
const inputs = (page) => page.evaluate(() =>
  [...document.querySelectorAll('input[inputmode="decimal"]')].map(i => i.value))
// The bar's clock in seconds, and how far it is from wall time since the start.
const clockSecs = async (page) => {
  const t = (await page.getByTestId('session-title').innerText()).match(/(\d+:)?\d{2}:\d{2}/)?.[0] || ''
  return t.split(':').map(Number).reduce((a, n) => a * 60 + n, 0)
}
const clockDrift = async (page, startedAt = ACTIVE.id) =>
  Math.abs((await clockSecs(page)) - Math.floor((Date.now() - startedAt) / 1000))
// A real finger, through the DevTools protocol: down, an optional drag, up.
async function finger(page, ctx, { x, y }, { dy = 0, holdMs = 60, steps = 15 } = {}) {
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  if (dy) {
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + (dy * i) / steps }] })
      await page.waitForTimeout(16)
    }
  } else {
    await page.waitForTimeout(holdMs)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
}
const centre = async (locator) => {
  const b = await locator.boundingBox()
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

// ══ 1. The core loop: set → rest → «جاهز» → set → done → next ════
{
  const { ctx, page, errors } = await open()

  ok('player: it opens on the first exercise, Arabic name first',
    (await page.getByTestId('exercise-name').textContent()) === 'ضغط صدر جهاز هامر')
  ok('player: the English name sits under it in its own LTR line',
    await page.locator('.s-name-en[dir="ltr"]').first().textContent() === 'Hammer Strength Machine Bench Press')
  ok('bar: the day as one word and the clock', /دفع\s*·\s*\d{2}:\d{2}/.test(await page.getByTestId('session-title').innerText()))
  const finishColor = await page.getByRole('button', { name: /^إنهاء$/ }).evaluate(el => getComputedStyle(el).color)
  ok('bar: «إنهاء» is green text, not red', finishColor === ACCENT, finishColor)
  ok('bar: no «تراجع» and no English counters anywhere', !/تراجع|sets \d|LVL/.test(await text(page)))
  ok('progress: one segment per exercise', await page.locator('.s-seg').count() === 3)
  ok('live: the live block names the set', /المجموعة\s*1\s*من\s*2/.test(await page.getByTestId('live-block').innerText()))
  ok('stage: the media stage shows before the first set', await page.getByTestId('exercise-stage').count() === 1)
  ok('stage: the muscle art appears once, not twice',
    await page.evaluate(() => [...document.querySelectorAll('[data-testid="session"] img')].filter(i => /muscle_chest/.test(i.src)).length) === 1)
  const greens = await page.evaluate((accent) => [...document.querySelectorAll('[data-testid="session"] button')]
    .filter(b => b.offsetParent && getComputedStyle(b).backgroundColor === accent).length, ACCENT)
  ok('one green fill: only the docked button is filled green', greens === 1, String(greens))
  const live = await page.evaluate(() => {
    const i = document.querySelector('[data-testid="weight-input"]')
    const b = document.querySelector('.s-step-btn').getBoundingClientRect()
    return { size: parseFloat(getComputedStyle(i).fontSize), btn: Math.round(b.width) }
  })
  ok('live: the weight is a 56px number with 56pt steppers', live.size === 56 && live.btn === 56, JSON.stringify(live))

  await completeBtn(page).click()
  await page.waitForTimeout(600)

  let st = await activeStored(page)
  ok('flow: completing marks the set done in storage', st.exercises[0].sets[0].done === true)
  ok('rest: the rest takes the docked button\'s place', await page.getByTestId('rest-bar').isVisible() && await completeBtn(page).count() === 0)
  ok('rest: the floating rest card stays away', await page.evaluate(() =>
    ![...document.querySelectorAll('div')].some(d => getComputedStyle(d).position === 'fixed' && /تمام ✓|انتهت الراحة/.test(d.textContent || ''))))
  ok('ack: no flying XP over the session', await page.evaluate(() =>
    [...document.querySelectorAll('.xp-float')].every(el => getComputedStyle(el).display === 'none')))
  ok('ack: the finished row draws its check', await page.locator('.s-trow[data-state="done"] .s-tick[data-on="1"][data-fresh="1"]').count() === 1)
  ok('stage: it folds into the 72pt row after the first set',
    await page.getByTestId('exercise-stage').count() === 0 && await page.getByTestId('exercise-row').count() === 1)
  ok('rest: the next set stays editable during the rest',
    (await inputs(page)).length === 2 && /المجموعة\s*2/.test(await page.getByTestId('live-block').innerText()))

  ok('clock: the bar tells wall time since the start', (await clockDrift(page)) <= 2, String(await clockSecs(page)))
  const restClock0 = await clockSecs(page)
  await page.waitForTimeout(2100)
  ok('clock: it keeps running through the rest', (await clockSecs(page)) - restClock0 >= 2,
    `${restClock0} → ${await clockSecs(page)}`)

  const tones = await page.evaluate(() => window.__tones)
  const freqs = tones.map(t => t.f).join(',')
  ok('sound: three ticks and an end tone, scheduled in the tap', freqs === '660,660,660,880', freqs)
  ok('sound: the end tone lands at the end of the rest', tones.length === 4 && Math.abs(tones[3].at - 90) < 2,
    JSON.stringify(tones.map(t => Math.round(t.at))))

  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_rest_timer'))?.endsAt)
  await page.getByRole('button', { name: 'زد 15 ثانية' }).click()
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_rest_timer'))?.endsAt)
  ok('rest: +15 pushes endsAt by 15s', after - before === 15000, String(after - before))
  await page.getByRole('button', { name: 'أنقص 15 ثانية' }).click()
  const back = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_rest_timer'))?.endsAt)
  ok('rest: −15 pulls it back', back - before === 0, String(back - before))
  ok('sound: ±15 reschedules the tones', (await page.evaluate(() => window.__tones.length)) === 12)

  const skipColor = await page.getByRole('button', { name: 'تخطي' }).evaluate(el => getComputedStyle(el).color)
  ok('rest: «تخطي» is plain grey text, never red', skipColor !== DANGER && skipColor !== ACCENT, skipColor)
  const drain = await page.locator('.s-rest-bar i').evaluate(el => {
    const cs = getComputedStyle(el)
    return { name: cs.animationName, origin: cs.transformOrigin, color: cs.backgroundColor }
  })
  ok('rest: a blue bar drains from the start edge', drain.name === 's-drain' && drain.origin.startsWith('0px')
    && drain.color === 'rgb(59, 157, 232)', JSON.stringify(drain))
  ok('rest: the countdown is 56px', await page.locator('.s-rest-time').evaluate(el => parseFloat(getComputedStyle(el).fontSize)) === 56)

  await page.getByRole('button', { name: 'تخطي' }).click()
  await page.waitForTimeout(400)
  ok('rest: skip brings the docked button back', await completeBtn(page).count() === 1 && await page.getByTestId('rest-bar').count() === 0)
  ok('rest: skip cleared the stored timer', await page.evaluate(() => localStorage.getItem('hf_rest_timer') === null))

  // Second set, then let the clock run out.
  await completeBtn(page).click()
  await page.waitForTimeout(500)
  ok('completion: the last set names the finished exercise', /اكتمل/.test(await text(page)))
  await endRest(page, 23000)
  const ready = page.getByTestId('rest-ready')
  await ready.waitFor({ timeout: 4000 }).catch(() => {})
  ok('ready: at zero the dock becomes the green «جاهز» field', /جاهز\s*·\s*المجموعة التالية/.test(await ready.innerText().catch(() => '')))
  ok('ready: it counts the overtime', /\+0:2\d/.test(await ready.innerText().catch(() => '')))
  const fullWidth = await ready.evaluate(el => Math.round(el.getBoundingClientRect().width) === window.innerWidth).catch(() => false)
  ok('ready: the field runs edge to edge', fullWidth)

  // Meanwhile the next exercise came on screen by itself.
  await page.waitForTimeout(2000)
  ok('completion: the next exercise comes on screen', (await page.locator('.s-name-en').first().textContent()) === 'Pec Deck')
  ok('ready: it waits for a tap instead of dismissing itself', await ready.isVisible().catch(() => false))
  await ready.click()
  await page.waitForTimeout(400)
  ok('ready: a tap brings the next set\'s button back', await completeBtn(page).count() === 1)
  ok('ready: and clears the stored timer', await page.evaluate(() => localStorage.getItem('hf_rest_timer') === null))

  ok('flow: no page errors', errors.length === 0, errors.join('; '))
  await page.screenshot({ path: `${OUT}/flow.png` })
  await ctx.close()
}

// ══ 2. Edits land only on the exercise on screen ══════════════
{
  const { ctx, page, errors } = await open()

  await page.getByRole('button', { name: /Machine Shoulder Press/ }).last().click()
  await page.waitForTimeout(500)
  await page.getByTestId('weight-input').fill('99')
  await page.waitForTimeout(300)

  let st = await activeStored(page)
  ok('protection: the edit landed on the exercise on screen',
    st.exercises[2].sets[0].weight === '99', JSON.stringify(st.exercises.map(e => e.sets[0].weight)))
  ok('protection: the other exercises are untouched',
    st.exercises[0].sets[0].weight === '75' && st.exercises[1].sets[0].weight === '50')
  ok('protection: only one live block exists', await page.getByTestId('live-block').count() === 1)

  // A past set opens in a labelled edit mode, with its own save.
  await page.getByRole('button', { name: /Hammer Strength/ }).last().click()
  await page.waitForTimeout(400)
  await completeBtn(page).click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'تخطي' }).click()
  await page.waitForTimeout(300)
  await page.locator('.s-trow[data-state="done"]').first().click()
  await page.waitForTimeout(300)
  ok('edit: a done row opens as «تعديل المجموعة»', /تعديل المجموعة\s*1/.test(await page.getByTestId('live-block').innerText()))
  ok('edit: the dock offers «حفظ التعديل»', await page.getByRole('button', { name: /حفظ التعديل/ }).count() === 1)
  await page.getByTestId('weight-input').fill('80')
  await page.waitForTimeout(200)
  st = await activeStored(page)
  ok('edit: the change lands on the past set', st.exercises[0].sets[0].weight === '80' && st.exercises[0].sets[0].done)
  await page.getByRole('button', { name: /حفظ التعديل/ }).click()
  await page.waitForTimeout(300)
  ok('edit: saving returns to the set being worked', /المجموعة\s*2/.test(await page.getByTestId('live-block').innerText()))

  // Hold to repeat, and a single press steps once.
  const before = parseFloat((await inputs(page))[0])
  await page.getByRole('button', { name: 'زد الوزن' }).click()
  await page.waitForTimeout(150)
  const once = parseFloat((await inputs(page))[0])
  ok('stepper: one press is one 2.5kg step', once - before === 2.5, `${before} → ${once}`)
  const box = await page.getByRole('button', { name: 'زد الوزن' }).boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(1300)
  await page.mouse.up()
  await page.waitForTimeout(150)
  const held = parseFloat((await inputs(page))[0])
  ok('stepper: holding repeats', held - once >= 12.5, `${once} → ${held}`)
  await page.waitForTimeout(400)
  ok('stepper: and stops on release', parseFloat((await inputs(page))[0]) === held)

  // A finger is not a mouse: a scroll that starts on a disc scrolls and
  // changes nothing; a tap steps once, on release; a still finger repeats.
  await page.evaluate(() => document.querySelector('.s-scroll').scrollTo(0, 0))
  await page.waitForTimeout(300)
  const plus = page.getByRole('button', { name: 'زد الوزن' })
  const w0 = (await inputs(page))[0]
  const top0 = await page.evaluate(() => document.querySelector('.s-scroll').scrollTop)
  await finger(page, ctx, await centre(plus), { dy: -150 })
  await page.waitForTimeout(500)
  const top1 = await page.evaluate(() => document.querySelector('.s-scroll').scrollTop)
  ok('touch: a drag that starts on a disc scrolls the page', top1 - top0 >= 60, `${top0} → ${top1}`)
  ok('touch: and leaves the weight alone', (await inputs(page))[0] === w0, `${w0} → ${(await inputs(page))[0]}`)
  ok('touch: the stored set is untouched too', (await activeStored(page)).exercises[0].sets[1].weight === w0)
  await page.evaluate(() => document.querySelector('.s-scroll').scrollTo(0, 0))
  await page.waitForTimeout(300)
  await finger(page, ctx, await centre(plus), { holdMs: 60 })
  await page.waitForTimeout(200)
  const tapped = parseFloat((await inputs(page))[0])
  ok('touch: a tap steps once', tapped - parseFloat(w0) === 2.5, `${w0} → ${tapped}`)
  await finger(page, ctx, await centre(plus), { holdMs: 1300 })
  await page.waitForTimeout(150)
  const fingerHeld = parseFloat((await inputs(page))[0])
  ok('touch: a still finger repeats', fingerHeld - tapped >= 12.5, `${tapped} → ${fingerHeld}`)
  await page.waitForTimeout(400)
  ok('touch: and stops when lifted', parseFloat((await inputs(page))[0]) === fingerHeld)

  ok('protection: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 2b. A swipe on the exercise head moves between exercises ══
{
  const { ctx, page, errors } = await open()
  const swipe = async (dx) => {
    const box = await page.locator('[data-testid="exercise-stage"], [data-testid="exercise-row"]').first().boundingBox()
    const y = box.y + box.height / 2, x = box.x + box.width / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + dx / 2, y, { steps: 4 })
    await page.mouse.move(x + dx, y, { steps: 4 })
    await page.mouse.up()
    await page.waitForTimeout(400)
  }
  ok('swipe: one exercise head, no clipped neighbour card peeking in',
    await page.locator('.s-strap-names').count() === 1 && await page.getByTestId('exercise-name').count() === 1)
  await swipe(140)
  ok('swipe: dragging right (RTL) brings the next exercise', (await page.locator('.s-name-en').first().textContent()) === 'Pec Deck')
  await swipe(-140)
  ok('swipe: dragging left goes back', (await page.locator('.s-name-en').first().textContent()) === 'Hammer Strength Machine Bench Press')
  ok('swipe: navigation never touches the data', JSON.stringify((await activeStored(page)).exercises) === JSON.stringify(ACTIVE.exercises))
  ok('swipe: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 3. A new exercise does not leave you with empty boxes ═════
{
  const FRESH = {
    id: Date.now() - 60000, date: new Date().toISOString(), name: 'Legs — اختبار',
    exercises: [
      { id: 'n', muscle: 'Legs', name: 'Leg Press',
        sets: [{ weight: '', reps: '', done: false }, { weight: '', reps: '', done: false }] },
    ],
  }
  const { ctx, page, errors } = await open({ active: FRESH })
  ok('fresh: an exercise with no history starts blank', (await inputs(page)).every(v => v === ''))
  ok('fresh: and says it is the first time', /أول مرة/.test(await page.getByTestId('live-block').innerText()))
  await page.getByTestId('weight-input').fill('80')
  await page.getByTestId('reps-input').fill('12')
  await completeBtn(page).click()
  await page.waitForTimeout(500)
  const after = await inputs(page)
  ok('fresh: the next set carries what you just lifted', after[0] === '80' && after[1] === '12', JSON.stringify(after))
  ok('fresh: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 4. Moving away during the completion line does not lock it ═
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
  await completeBtn(page).click()
  await page.waitForTimeout(300)
  ok('celebration: completing the last set raises the line', /اكتمل/.test(await text(page)))
  await page.getByRole('button', { name: /Leg Curl/ }).last().click()
  const cleared = await page
    .waitForFunction(() => !/اكتمل/.test(document.body.innerText), null, { timeout: 8000 })
    .then(() => true, () => false)
  ok('celebration: moving away clears the line instead of freezing it', cleared)
  await endRest(page)
  await page.getByTestId('rest-ready').click({ timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(400)
  ok('celebration: the next exercise is ready to log',
    (await inputs(page)).length === 2 && await completeBtn(page).count() === 1)
  ok('celebration: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 4b. A double tap on «جاهز» does not log the next set ═══════
{
  const THREE = {
    id: Date.now() - 60000, date: new Date().toISOString(), name: 'Legs — اختبار',
    exercises: [{ id: 'p', muscle: 'Legs', name: 'Leg Press',
      sets: [0, 1, 2].map(() => ({ weight: '40', reps: '12', done: false })) }],
  }
  const { ctx, page, errors } = await open({ active: THREE })
  await completeBtn(page).click()
  await page.waitForTimeout(400)
  await endRest(page)
  const ready = page.getByTestId('rest-ready')
  await ready.waitFor({ timeout: 4000 }).catch(() => {})
  // A point inside both the «جاهز» field and the button that replaces it.
  const vh = await page.evaluate(() => innerHeight)
  const x = (await page.evaluate(() => innerWidth)) / 2, y = vh - 40
  await page.mouse.click(x, y)
  await page.waitForTimeout(90)
  await page.mouse.click(x, y)
  await page.waitForTimeout(300)
  const st = await activeStored(page)
  ok('guard: the second tap of a double tap on «جاهز» logs nothing',
    st.exercises[0].sets.filter(s => s.done).length === 1, JSON.stringify(st.exercises[0].sets.map(s => s.done)))
  ok('guard: and starts no new rest', await page.getByTestId('rest-bar').count() === 0 && await completeBtn(page).count() === 1)
  await page.waitForTimeout(300)
  await completeBtn(page).click({ timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(300)
  ok('guard: a moment later the button logs as usual',
    (await activeStored(page)).exercises[0].sets.filter(s => s.done).length === 2)
  ok('guard: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 4c. Resting on the last of six sets (390×664, Safari's height) ══
{
  const six = Array.from({ length: 6 }, (_, i) => ({ weight: '75', reps: '12', done: i < 4 }))
  const { ctx, page, errors } = await open({ active: { ...ACTIVE, exercises: [{ ...ACTIVE.exercises[0], sets: six }, ACTIVE.exercises[1]] } })
  await completeBtn(page).click()          // set 5 → the rest, set 6 live
  await page.waitForTimeout(1200)
  const m = await page.evaluate(() => {
    const rest = document.querySelector('[data-testid="rest-bar"]').getBoundingClientRect()
    const steps = [...document.querySelectorAll('.s-step-btn')].map(e => e.getBoundingClientRect())
    return {
      vh: innerHeight, restTop: Math.round(rest.top), restH: Math.round(rest.height),
      stepsTop: Math.round(Math.min(...steps.map(s => s.top))), stepsBottom: Math.round(Math.max(...steps.map(s => s.bottom))),
      set: document.querySelector('.s-live-set').innerText.replace(/\s+/g, ' '),
      time: parseFloat(getComputedStyle(document.querySelector('.s-rest-time')).fontSize),
    }
  })
  ok('rest/664: the live block is set 6 of 6', /المجموعة 6 من 6/.test(m.set), m.set)
  ok('rest/664: the next set\'s steppers sit clear of the rest panel and its fade',
    m.stepsTop >= 0 && m.stepsBottom <= m.restTop - 28, JSON.stringify(m))
  ok('rest/664: the compact panel (~100px) keeps its 56px countdown', m.restH <= 100 && m.time === 56, JSON.stringify(m))
  await page.screenshot({ path: `${OUT}/rest-664.png` })
  ok('rest/664: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 5. The smallest screens: counters and dock above the fold ══
for (const [label, opts] of [['320×568', { device: 'iPhone SE', viewport: { width: 320, height: 568 } }], ['SE', { device: 'iPhone SE' }]]) {
  const { ctx, page, errors } = await open(opts)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  ok(`${label}: no horizontal overflow`, overflow <= 1, String(overflow))
  const fit = await page.evaluate(() => {
    const vh = window.innerHeight
    const r = (el) => el && el.getBoundingClientRect()
    const dock = r(document.querySelector('[data-testid="complete-set"]'))
    const w = r(document.querySelector('[data-testid="weight-input"]'))
    const reps = r(document.querySelector('[data-testid="reps-input"]'))
    const steppers = [...document.querySelectorAll('.s-step-btn')].map(r)
    return {
      dock: dock && dock.top >= 0 && dock.bottom <= vh,
      counters: w && reps && w.top >= 0 && reps.bottom <= dock.top,
      steppers: steppers.length === 4 && steppers.every(b => b.bottom <= dock.top && b.top >= 0),
    }
  })
  ok(`${label}: the docked button is on screen without scrolling`, fit.dock)
  ok(`${label}: both counters sit above it`, fit.counters)
  ok(`${label}: all four steppers are reachable`, fit.steppers)
  await page.screenshot({ path: `${OUT}/${label.replace('×', 'x')}.png` })
  await completeBtn(page).click()
  await page.waitForTimeout(500)
  const restFit = await page.evaluate(() => {
    const vh = window.innerHeight
    const bar = document.querySelector('[data-testid="rest-bar"]').getBoundingClientRect()
    const reps = document.querySelector('[data-testid="reps-input"]').getBoundingClientRect()
    return bar.bottom <= vh && reps.bottom <= bar.top
  })
  ok(`${label}: resting, the bar and the next set both fit`, restFit)
  ok(`${label}: no page errors`, errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 6. «Raise the weight» lives on the number ════════════════
// Three sessions at 75kg — two holding the bottom of the 12–15 range,
// the last hitting the top on half the sets — is exactly what opens
// `hint === 'raise'` (checked against analyzeProgression in
// tests/progression.test.mjs, so this is not a guess).
const RAISE_NAME = ACTIVE.exercises[0].name
const raiseDay = (n, sets) => ({
  id: n, date: new Date(2026, 8, n, 18).toISOString(), duration: 40,
  exercises: [{ id: 'a', muscle: 'Chest', name: RAISE_NAME,
    sets: sets.map(([w, r]) => ({ weight: String(w), reps: String(r), done: true })) }],
})
const RAISE_SESSIONS = [
  raiseDay(1, [[75, 12], [75, 12], [75, 11]]),
  raiseDay(3, [[75, 13], [75, 12], [75, 12]]),
  raiseDay(5, [[75, 15], [75, 15], [75, 14]]),
]

{
  const { ctx, page, errors } = await open({ sessions: RAISE_SESSIONS })
  await page.waitForTimeout(300)
  const w = page.getByTestId('weight-input')
  ok('raise: the weight arrives already raised', await w.inputValue() === '77.5', await w.inputValue())
  ok('raise: the number itself is gold', await w.evaluate(el => getComputedStyle(el).color) === GOLD)
  const st = await activeStored(page)
  ok('raise: every set still to do moved up, not just the first',
    st.exercises[0].sets.every(s => s.weight === '77.5'), JSON.stringify(st.exercises[0].sets))
  ok('raise: the ring is around the weight field, not the card',
    await page.locator('[data-testid="raise-ring"]').count() === 1
    && await page.locator('[data-testid="raise-ring"]').evaluate(svg => svg.parentElement.classList.contains('s-field')))
  const fit = await page.evaluate(() => {
    const svg = document.querySelector('[data-testid="raise-ring"]')
    return Number(svg.getAttribute('width')) === svg.parentElement.clientWidth
      && Number(svg.getAttribute('height')) === svg.parentElement.clientHeight
  })
  ok('raise: the ring fits the field exactly', fit)
  const live = await page.getByTestId('live-block').innerText()
  ok('raise: a chip says by how much', /\+2\.5\s*كجم عن آخر مرة/.test(live), live)
  ok('raise: the coach line says what to try', /آخر مرة\s*75×15\s*—\s*جرّب\s*77\.5/.test(live), live)
  ok('raise: no other gold on screen (the best weight goes quiet)', await page.locator('.s-meta-part[data-best="1"]').count() === 0)
  const anim = await page.locator('.s-raise-path').first().evaluate(el => {
    const cs = getComputedStyle(el)
    return { name: cs.animationName, count: cs.animationIterationCount }
  })
  ok('raise: the ring is drawn once, not looped', anim.name === 's-raise-draw' && anim.count === '1', JSON.stringify(anim))
  await page.waitForTimeout(1600)
  const trace = await page.evaluate(async () => {
    const out = []
    for (let i = 0; i < 12; i++) {
      out.push(parseFloat(getComputedStyle(document.querySelector('.s-raise-path')).strokeDashoffset))
      await new Promise(r => setTimeout(r, 100))
    }
    return out
  })
  ok('raise: then it stays whole and still', trace.every(v => v === 0), trace.join(','))
  await page.screenshot({ path: `${OUT}/raise.png` })

  await page.getByRole('button', { name: /خلّها\s*75/ }).click()
  await page.waitForTimeout(300)
  ok('raise: «خلّها 75» puts the weight back', await w.inputValue() === '75')
  ok('raise: for every set', (await activeStored(page)).exercises[0].sets.every(s => s.weight === '75'))
  ok('raise: and the gold goes with it', await page.locator('[data-testid="raise-ring"]').count() === 0
    && await w.evaluate(el => getComputedStyle(el).color) !== GOLD)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="session"]').waitFor({ timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(900)
  ok('raise: a declined raise is not put back on reload', await page.getByTestId('weight-input').inputValue() === '75')
  ok('raise: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

{
  // The raised block on the narrowest phone: chip, gold number and
  // «خلّها 75» all inside the block, nothing pushed off the edge.
  const { ctx, page, errors } = await open({ sessions: RAISE_SESSIONS, device: 'iPhone SE', viewport: { width: 320, height: 568 } })
  await page.waitForTimeout(300)
  const fit = await page.evaluate(() => {
    const live = document.querySelector('.s-live')
    const box = live.getBoundingClientRect()
    const inside = [...live.querySelectorAll('.s-step-btn, .s-raise-chip, .s-keep, .s-field')]
      .every(el => { const r = el.getBoundingClientRect(); return r.left >= box.left - 0.5 && r.right <= box.right + 0.5 })
    return { inside, overflow: live.scrollWidth - live.clientWidth }
  })
  ok('raise/320: everything stays inside the live block', fit.inside && fit.overflow <= 1, JSON.stringify(fit))
  ok('raise/320: the docked button is still on screen', await page.getByTestId('complete-set').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight))
  ok('raise/320: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

{
  // The same history in a deload week: the advice is silenced at its source.
  const { ctx, page, errors } = await open({ sessions: RAISE_SESSIONS, active: { ...ACTIVE, deload: { pct: 40 } } })
  await page.waitForTimeout(300)
  ok('raise/deload: no ring', await page.locator('[data-testid="raise-ring"]').count() === 0)
  ok('raise/deload: the weight is not raised', await page.getByTestId('weight-input').inputValue() === '75')
  ok('raise/deload: no page errors', errors.length === 0)
  await ctx.close()
}

{
  // Reduced motion: whole and still — the signal stays, the motion goes.
  const { ctx, page, errors } = await open({ sessions: RAISE_SESSIONS, reduced: true })
  await page.waitForTimeout(300)
  ok('raise/reduced: the ring is there', await page.locator('[data-testid="raise-ring"]').count() === 1)
  const st = await page.locator('.s-raise-path').first().evaluate(el => {
    const cs = getComputedStyle(el)
    return { anim: cs.animationName, off: cs.strokeDashoffset }
  })
  ok('raise/reduced: nothing animates, the ring is complete', st.anim === 'none' && parseFloat(st.off) === 0, JSON.stringify(st))
  ok('raise/reduced: no page errors', errors.length === 0)
  await ctx.close()
}

// ══ 7. Finishing asks; throwing away lives in ⋯ ═══════════════
{
  const { ctx, page, errors } = await open()
  await page.getByRole('button', { name: /^إنهاء$/ }).click()
  await page.waitForTimeout(500)
  ok('finish: with nothing logged, the sheet keeps you training',
    await page.locator('.k-sheet').last().getByRole('button', { name: 'متابعة التمرين' }).count() === 1)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  ok('finish: Escape closes it and the session stays', await page.locator('.k-sheet').count() === 0 && !!(await activeStored(page)))

  await completeBtn(page).click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'تخطي' }).click()
  await page.getByRole('button', { name: /^إنهاء$/ }).click()
  await page.waitForTimeout(500)
  const sheet = await page.locator('.k-sheet').last().innerText()
  const quoted = (sheet.match(/في\s*((\d+:)?\d{2}:\d{2})/)?.[1] || '').split(':').map(Number).reduce((a, n) => a * 60 + n, 0)
  ok('finish: the sheet quotes wall time, as the session will be saved',
    Math.abs(quoted - Math.floor((Date.now() - ACTIVE.id) / 1000)) <= 2, sheet)
  ok('finish: «احفظ وأنهِ» first, the cost on the discard', /احفظ وأنهِ/.test(sheet) && /ستُحذف مجموعة واحدة/.test(sheet), sheet)
  const discardColor = await page.locator('.s-discard').evaluate(el => getComputedStyle(el).color)
  ok('finish: only the discard is red', discardColor === DANGER, discardColor)
  await page.locator('.k-sheet').last().getByRole('button', { name: /^متابعة$/ }).click()
  await page.waitForTimeout(400)
  ok('finish: «متابعة» keeps the session', !!(await activeStored(page)))

  await page.getByRole('button', { name: /^إنهاء$/ }).click()
  await page.waitForTimeout(400)
  await page.locator('.k-sheet').last().getByRole('button', { name: 'احفظ وأنهِ' }).click()
  await page.waitForTimeout(800)
  const saved = await page.evaluate(() => ({
    active: JSON.parse(localStorage.getItem('hf_active')),
    sessions: JSON.parse(localStorage.getItem('hf_sessions') || '[]'),
  }))
  ok('finish: «احفظ وأنهِ» saves the session to history', saved.active === null && saved.sessions.length === 1)
  ok('finish: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

{
  const { ctx, page, errors } = await open()
  await page.getByRole('button', { name: 'خيارات التمرين' }).click()
  await page.waitForTimeout(500)
  const menu = page.locator('.k-sheet').last()
  ok('menu: the ⋯ sheet holds the exercise\'s tools', /إضافة مجموعة/.test(await menu.innerText()) && /معلومات ونصائح/.test(await menu.innerText()))
  await menu.getByRole('button', { name: /إضافة مجموعة/ }).click()
  await page.waitForTimeout(400)
  ok('menu: «إضافة مجموعة» adds a set', (await activeStored(page)).exercises[0].sets.length === 3)

  await page.getByRole('button', { name: 'خيارات التمرين' }).click()
  await page.waitForTimeout(500)
  await page.locator('.k-sheet').last().getByRole('button', { name: /إلغاء التمرين/ }).click()
  await page.waitForTimeout(600)
  const confirm = page.locator('.k-sheet').last()
  ok('discard: «إلغاء التمرين» asks first', /إلغاء التمرين؟/.test(await confirm.innerText()))
  await confirm.getByRole('button', { name: 'احذف الجلسة' }).click()
  await page.waitForTimeout(700)
  const after = await page.evaluate(() => ({
    active: JSON.parse(localStorage.getItem('hf_active')),
    sessions: JSON.parse(localStorage.getItem('hf_sessions') || '[]'),
  }))
  ok('discard: the session is gone and nothing was saved', after.active === null && after.sessions.length === 0)
  ok('discard: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 8. Chrome: ⌄, the live bar, the screen stays awake ════════
{
  const { ctx, page, errors } = await open()
  ok('wake lock: the screen is kept on during the session', await page.evaluate(() => window.__wakeLocks) >= 1)
  ok('chrome: one ⌄, in the session bar', await page.getByRole('button', { name: 'صغّر الجلسة' }).filter({ visible: true }).count() === 1)
  await page.getByRole('button', { name: 'صغّر الجلسة' }).filter({ visible: true }).click()
  await page.waitForTimeout(600)
  ok('chrome: ⌄ docks the session as the live bar', await page.getByTestId('session').count() === 0 && await page.getByTestId('live-bar').count() === 1)
  await page.waitForTimeout(1500)
  await page.getByTestId('live-bar').click()
  await page.locator('[data-testid="session"]').waitFor({ timeout: 4000 }).catch(() => {})
  await page.waitForTimeout(300)
  ok('clock: reopening shows the true elapsed time, no jump', (await clockDrift(page)) <= 2, String(await clockSecs(page)))
  ok('chrome: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 9. An empty session: add an exercise, or a routine ════════
{
  const { ctx, page, errors } = await open({ active: { ...ACTIVE, exercises: [] } })
  ok('empty: it offers both ways in', await page.getByRole('button', { name: /أضف أول تمرين/ }).count() === 1
    && await page.getByRole('button', { name: /روتين/ }).count() === 1)
  await page.getByRole('button', { name: /أضف أول تمرين/ }).click()
  await page.waitForTimeout(600)
  const add = page.locator('.k-sheet').last()
  ok('add: the sheet lists exercises Arabic first', /ضغط بنش بالبار/.test(await add.innerText()))
  await add.getByRole('button', { name: /ضغط بنش بالبار/ }).click()
  await add.getByRole('button', { name: /^أضف/ }).click()
  await page.waitForTimeout(700)
  const st = await activeStored(page)
  ok('add: the exercise joins the session', st.exercises.length === 1 && st.exercises[0].name === 'Bench Press')

  await page.getByRole('button', { name: 'خيارات التمرين' }).click()
  await page.waitForTimeout(400)
  await page.locator('.k-sheet').last().getByRole('button', { name: /إزالة التمرين/ }).click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /روتين/ }).click()
  await page.waitForTimeout(600)
  await page.locator('.k-sheet').last().getByRole('button', { name: /^دفع/ }).click()
  await page.waitForTimeout(700)
  ok('routines: picking «دفع» loads its exercises', (await activeStored(page)).exercises.length === 5)
  ok('routines: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 9b. Names: Arabic first, through the user's alias mapping ══
{
  const ALIAS = { id: Date.now() - 60000, date: new Date().toISOString(), name: 'Push — اختبار',
    exercises: [
      { id: 'm', muscle: 'Chest', name: 'My Hammer Press', sets: [{ weight: '70', reps: '10', done: false }] },
      { id: 'b', muscle: 'Chest', name: 'Pec Deck', sets: [{ weight: '50', reps: '12', done: false }] },
    ] }
  const { ctx, page, errors } = await open({ active: ALIAS, mapping: { 'My Hammer Press': 'Hammer Strength Machine Bench Press' } })
  ok('mapping: a renamed machine still shows its Arabic name', (await page.getByTestId('exercise-name').textContent()) === 'ضغط صدر جهاز هامر')
  ok('mapping: with the user\'s own name under it', (await page.locator('.s-name-en').first().textContent()) === 'My Hammer Press')
  ok('mapping: the equipment comes through the mapping too', /جهاز/.test(await page.locator('.s-stage .s-meta').innerText()))
  ok('mapping: the session list is Arabic first as well',
    /ضغط صدر جهاز هامر/.test(await page.locator('.s-qrow').first().innerText()))

  await page.getByRole('button', { name: /Pec Deck/ }).last().click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'خيارات التمرين' }).click()
  await page.waitForTimeout(500)
  const swapRow = page.locator('.k-sheet').last().getByRole('button', { name: /استبدال التمرين/ })
  const swapText = (await swapRow.innerText()).replace(/\s+/g, ' ')
  ok('swap: the next machine is named in Arabic first, English after', /التالي: تفتيح كيبل\s*·\s*Cable Fly/.test(swapText), swapText)
  await swapRow.click()
  await page.waitForTimeout(500)
  ok('swap: the swapped machine is on screen', (await page.getByTestId('exercise-name').textContent()) === 'تفتيح كيبل')
  const meta = (await page.locator('.s-stage .s-meta').innerText()).replace(/\s+/g, ' ')
  ok('swap: «بدل» names the original in Arabic, English after', /بدل تفتيح جهاز \(بك دك\)\s*—\s*Pec Deck/.test(meta), meta)
  ok('names: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 10. The media ladder decays, never breaks ═════════════════
{
  const { ctx, page, errors } = await open({ blockRemote: true })
  ok('media: with nothing else, the muscle art carries the stage', await page.evaluate(() =>
    [...document.querySelectorAll('.s-stage img')].some(i => /muscle_chest/.test(i.src))))
  ok('media: no page errors on the floor rung', errors.length === 0)
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
