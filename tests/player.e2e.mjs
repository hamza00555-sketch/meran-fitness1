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
async function finger(page, ctx, { x, y }, { dx = 0, dy = 0, holdMs = 60, steps = 15 } = {}) {
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  if (dx || dy) {
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * i) / steps, y: y + (dy * i) / steps }] })
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

// ══ 2c. The demo video stays in sight, quietly ════════════════
// Before the first set it is a frosted pill in the stage's top start
// corner; after it, the same filled mark on the same glass, as a disc
// beside ⋯ and 12pt clear of it. Monochrome, never YouTube red, never a
// second green. A swipe that starts on it — mouse or finger — still
// swipes and opens nothing, and leaves nothing stale for the keyboard.
// Reopening the stage leaves the pill where it was.
{
  const { ctx, page, errors } = await open()
  await page.evaluate(() => {
    window.__opened = []
    window.open = (...a) => { window.__opened.push(a); return null }
  })
  const openedCount = () => page.evaluate(() => window.__opened.length)
  const nameEn = () => page.locator('.s-name-en').first().textContent()
  const pill = page.locator('[data-testid="exercise-stage"] [data-testid="watch-video"]')
  ok('video: the stage carries «شوف الطريقة»', await pill.count() === 1 && /شوف الطريقة/.test(await pill.innerText()))
  const geo = await page.evaluate(() => {
    const r = (el) => el.getBoundingClientRect()
    const stage = r(document.querySelector('[data-testid="exercise-stage"]'))
    const btn = document.querySelector('[data-testid="exercise-stage"] [data-testid="watch-video"]')
    const b = r(btn), glass = r(btn.querySelector('.s-glass'))
    const names = r(document.querySelector('.s-stage .s-strap-names'))
    const more = r(document.querySelector('.s-stage .s-more'))
    const cs = getComputedStyle(btn.querySelector('.s-glass'))
    return {
      top: Math.round(b.top - stage.top), startGap: Math.round(stage.right - glass.right),
      btnTop: b.top - stage.top, btnStart: stage.right - b.right,
      w: Math.round(b.width), h: Math.round(b.height),
      clearOfStrap: b.bottom <= names.top && b.bottom <= more.top,
      color: getComputedStyle(btn.querySelector('svg')).color, bg: cs.backgroundColor, blur: cs.backdropFilter || cs.webkitBackdropFilter,
      mark: btn.querySelector('svg').innerHTML, fold: !!document.querySelector('[data-testid="stage-fold"]'),
    }
  })
  ok('video: before the first set there is nothing to fold, so no chevron beside it', !geo.fold)
  ok('video: the pill sits in the stage\'s top start corner, lined up with the strap',
    geo.top <= 8 && Math.abs(geo.startGap - 20) <= 2, JSON.stringify(geo))
  ok('video: its target is at least 44pt', geo.w >= 44 && geo.h >= 44, JSON.stringify(geo))
  ok('video: it stays clear of the name strap and ⋯', geo.clearOfStrap, JSON.stringify(geo))
  ok('video: monochrome glass — no YouTube red, no green', /blur/.test(geo.blur)
    && ![DANGER, ACCENT, 'rgb(255, 0, 0)'].includes(geo.color) && ![DANGER, ACCENT].includes(geo.bg), JSON.stringify(geo))
  const greens = await page.evaluate((accent) => [...document.querySelectorAll('[data-testid="session"] button')]
    .filter(b => b.offsetParent && getComputedStyle(b).backgroundColor === accent).length, ACCENT)
  ok('video: the docked button is still the one green fill', greens === 1, String(greens))

  await pill.click()
  await page.waitForTimeout(200)
  let opened = await page.evaluate(() => window.__opened)
  ok('video: a tap opens YouTube in a new tab, without an opener',
    opened.length === 1 && /youtube\.com/.test(opened[0][0]) && opened[0][1] === '_blank' && /noopener/.test(opened[0][2] || ''),
    JSON.stringify(opened))
  ok('video: and the session stays on screen', await page.getByTestId('session').count() === 1)

  // A swipe that starts on the pill is the head's swipe, and opens nothing
  // — even when it ends on the pill too. (RTL: dragging right is «next».)
  const pb = await pill.boundingBox()
  const sx = pb.x + 14, sy = pb.y + pb.height / 2
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx + 50, sy, { steps: 4 })
  await page.mouse.move(sx + 100, sy, { steps: 4 })
  await page.mouse.up()
  await page.waitForTimeout(400)
  ok('video: a mouse drag inside the pill opens nothing', (await openedCount()) === 1)
  ok('video: and still moves to the other exercise', (await nameEn()) === 'Pec Deck')

  // A finger, through the DevTools protocol: the same, and back.
  await finger(page, ctx, await centre(pill), { dx: -140 })
  await page.waitForTimeout(500)
  ok('video: a finger swipe from the pill goes back', (await nameEn()) === ACTIVE.exercises[0].name)
  ok('video: and opens nothing either', (await openedCount()) === 1)
  await pill.focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  ok('video: right after a finger swipe, a keyboard press still opens it', (await openedCount()) === 2)

  // A mouse drag that moves on the pill and then leaves it: the click lands
  // elsewhere, and nothing stale is left behind for the next activation.
  const ex0 = pb.x + pb.width - 16
  await page.mouse.move(ex0, sy)
  await page.mouse.down()
  await page.mouse.move(ex0 - 60, sy, { steps: 4 })          // still on the pill
  await page.mouse.move(ex0 - 200, sy + 60, { steps: 4 })    // off it
  await page.mouse.up()
  await page.waitForTimeout(300)
  ok('video: a drag that leaves the pill opens nothing', (await openedCount()) === 2)
  await pill.focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  ok('video: and the next keyboard press opens it — no stale gesture swallows it', (await openedCount()) === 3)
  await finger(page, ctx, await centre(pill), { holdMs: 60 })
  await page.waitForTimeout(300)
  ok('video: a finger tap on the pill opens it', (await openedCount()) === 4)

  await page.getByRole('button', { name: 'خيارات التمرين' }).click()
  await page.waitForTimeout(400)
  ok('video: it no longer hides behind ⋯', !/يوتيوب|شاهد الأداء/.test(await page.locator('.k-sheet').last().innerText()))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  // After the first set: the 72pt row; the video is the pill's own mark on
  // the pill's own glass, as a disc — 12pt clear of ⋯.
  await completeBtn(page).click()
  await page.waitForTimeout(500)
  const disc = page.locator('[data-testid="exercise-row"] [data-testid="watch-video"]')
  const row = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="exercise-row"] [data-testid="watch-video"]')
    const more = document.querySelector('[data-testid="exercise-row"] .s-more')
    const glass = btn.querySelector('.s-glass')
    const b = btn.getBoundingClientRect(), m = more.getBoundingClientRect(), g = glass.getBoundingClientRect()
    return { w: Math.round(b.width), h: Math.round(b.height), next: btn.nextElementSibling === more,
      gap: Math.round(b.left - m.right), text: btn.innerText.trim(),
      disc: [Math.round(g.width), Math.round(g.height)], bg: getComputedStyle(glass).backgroundColor,
      ink: getComputedStyle(btn.querySelector('svg')).color, mark: btn.querySelector('svg').innerHTML }
  })
  ok('video/row: the folded row keeps it — a 44pt target beside ⋯, a disc, no words',
    await disc.count() === 1 && row.w >= 44 && row.h >= 44 && row.next && row.text === '' && row.disc[0] === row.disc[1], JSON.stringify(row))
  ok('video/row: its target is 12pt clear of ⋯ (swap, remove)', row.gap >= 12, JSON.stringify(row))
  ok('video/row: the same filled YouTube mark as the stage pill', row.mark === geo.mark && row.mark.length > 0)
  ok('video/row: on the same glass, monochrome', row.bg === geo.bg && ![DANGER, ACCENT, 'rgb(255, 0, 0)'].includes(row.ink), JSON.stringify(row))
  ok('video/row: labelled for a screen reader', /يوتيوب/.test(await disc.getAttribute('aria-label')))
  await disc.click()
  await page.waitForTimeout(200)
  opened = await page.evaluate(() => window.__opened)
  ok('video/row: a tap opens YouTube too', opened.length === 5 && /youtube\.com/.test(opened[4][0]), JSON.stringify(opened))

  // Peek: the stage reopened from the thumbnail. The pill keeps its exact
  // place; «أخفِ الصورة» takes the opposite corner, far from it.
  await page.getByRole('button', { name: 'اعرض صورة التمرين' }).click()
  await page.waitForTimeout(400)
  for (const [width, height] of [[390, 664], [320, 568]]) {
    await page.setViewportSize({ width, height })
    await page.waitForTimeout(250)
    const peek = await page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect()
      const stage = r('[data-testid="exercise-stage"]')
      const pill = r('[data-testid="exercise-stage"] [data-testid="watch-video"]')
      const fold = r('[data-testid="stage-fold"]')
      return { pillTop: pill.top - stage.top, pillStart: stage.right - pill.right,
        foldTop: fold.top - stage.top, foldEnd: fold.left - stage.left, gap: Math.round(pill.left - fold.right),
        fold: [Math.round(fold.width), Math.round(fold.height)] }
    })
    if (width === 390) {
      ok('peek: the pill stays exactly where it was on first view',
        Math.abs(peek.pillTop - geo.btnTop) <= 0.5 && Math.abs(peek.pillStart - geo.btnStart) <= 0.5, JSON.stringify({ peek, geo }))
    }
    ok(`peek/${width}: «أخفِ الصورة» is a 44pt target in the opposite top corner, far from the pill`,
      peek.fold[0] >= 44 && peek.fold[1] >= 44 && Math.abs(peek.foldTop - peek.pillTop) <= 0.5
      && peek.foldEnd <= 20 && peek.gap >= 80, JSON.stringify(peek))
  }
  await page.setViewportSize({ width: 390, height: 664 })
  await page.waitForTimeout(250)
  await page.getByTestId('stage-fold').click()
  await page.waitForTimeout(400)
  ok('peek: a tap on it folds the stage back into the row',
    await page.getByTestId('exercise-stage').count() === 0 && await page.getByTestId('exercise-row').count() === 1)
  ok('video: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 2d. No column header: every row says what it is ═══════════
// One format for a set, everywhere: «102.5 كجم × 8 عدّات», and under it
// «آخر مرة 72.5 كجم × 9 عدّات». Weight first (on the right), units
// always, Arabic counting, the same words in the coach line — and the
// list keeps one rhythm at every width, with nothing cut.
{
  const HIST_NAME = ACTIVE.exercises[0].name
  const HIST = [{ id: 2, date: new Date(2026, 8, 2, 18).toISOString(), duration: 40,
    exercises: [{ id: 'a', muscle: 'Chest', name: HIST_NAME,
      sets: [[70, 12], [72.5, 9], [202.5, 8]].map(([w, r]) => ({ weight: String(w), reps: String(r), done: true })) }] }]
  const THREE = { ...ACTIVE, exercises: [{ ...ACTIVE.exercises[0],
    sets: [['75', '12'], ['102.5', '8'], ['202.5', '12']].map(([weight, reps]) => ({ weight, reps, done: false })) }, ACTIVE.exercises[1]] }
  const { ctx, page, errors } = await open({ sessions: HIST, active: THREE })
  const session = await page.getByTestId('session').innerText()
  ok('rows: no header row over the live block', await page.locator('.s-thead, [role="columnheader"]').count() === 0)
  ok('rows: no «السابق» jargon anywhere in the session', !/السابق/.test(session))
  ok('rows: no bare «72.5×9» shorthand anywhere in the session', !/\d\s*×\s*\d/.test(session), session)
  const rows = await page.locator('.s-trow').evaluateAll(els => els.map(e => e.innerText.replace(/\s+/g, ' ').trim()))
  ok('rows: each row is a set in words — «102.5 كجم × 8 عدّات», «202.5 كجم × 12 عدّة»',
    rows.length === 2 && /102\.5 كجم × 8 عدّات/.test(rows[0]) && /202\.5 كجم × 12 عدّة/.test(rows[1]), JSON.stringify(rows))
  ok('rows: last time is labelled, in the same words — «آخر مرة 72.5 كجم × 9 عدّات»',
    /آخر مرة 72\.5 كجم × 9 عدّات/.test(rows[0]) && /آخر مرة 202\.5 كجم × 8 عدّات/.test(rows[1]), JSON.stringify(rows))
  const units = await page.evaluate(() => [...document.querySelectorAll('.s-cell-reps .s-unit')].map(e => e.textContent))
  ok('rows: the reps word counts in Arabic — 8 عدّات, 12 عدّة', JSON.stringify(units) === JSON.stringify(['عدّات', 'عدّة']), JSON.stringify(units))
  const order = await page.evaluate(() => [...document.querySelectorAll('.s-trow')].map(r => {
    const kg = r.querySelector('.s-cell-kg').getBoundingClientRect()
    const reps = r.querySelector('.s-cell-reps').getBoundingClientRect()
    const pairs = [...r.querySelectorAll('.s-cell-prev .s-pair')].map(p => p.getBoundingClientRect())
    return { main: kg.left >= reps.right - 1, prev: pairs.length === 2 && pairs[0].left >= pairs[1].right - 1 }
  }))
  ok('rows: weight on the right, reps on the left — on both lines', order.every(o => o.main && o.prev), JSON.stringify(order))
  const coach = (await page.locator('.s-coach-text').innerText()).replace(/\s+/g, ' ')
  ok('coach: the same words — «آخر مرة 70 كجم × 12 عدّة — الهدف 12–15 عدّة»',
    /آخر مرة 70 كجم × 12 عدّة —/.test(coach) && /الهدف 12–15 عدّة/.test(coach), coach)

  // The live block's copy action, in plain words, only when it would change something.
  const asLast = page.getByRole('button', { name: /حط أرقام آخر مرة/ })
  ok('live: «حط أرقام آخر مرة» offers last time\'s numbers, as a command', await asLast.count() === 1)
  await asLast.click()
  await page.waitForTimeout(250)
  ok('live: one tap puts 70 × 12 back', JSON.stringify((await inputs(page))) === JSON.stringify(['70', '12']), JSON.stringify(await inputs(page)))
  ok('live: and it steps aside once they match', await asLast.count() === 0)

  // 102.5 and 202.5 never cut, at any width, and the list keeps one
  // rhythm: every row two lines, all the same height.
  for (const width of [390, 375, 360, 320]) {
    await page.setViewportSize({ width, height: 740 })
    await page.waitForTimeout(250)
    const fit = await page.evaluate(() => [...document.querySelectorAll('.s-trow')].map(r => {
      const box = r.getBoundingClientRect()
      const cells = [...r.querySelectorAll('.s-cell-kg, .s-cell-reps, .s-cell-prev, .s-cell-x')]
      const kg = r.querySelector('.s-cell-kg').getBoundingClientRect()
      const prev = r.querySelector('.s-cell-prev').getBoundingClientRect()
      const lh = parseFloat(getComputedStyle(r.querySelector('.s-cell-prev')).lineHeight)
      return {
        cut: cells.some(c => c.scrollWidth > c.clientWidth + 1),
        out: cells.some(c => { const b = c.getBoundingClientRect(); return b.left < box.left - 0.5 || b.right > box.right + 0.5 }),
        under: prev.top >= kg.bottom - 1, prevOneLine: prev.height <= lh + 1, h: Math.round(box.height),
      }
    }))
    ok(`rows/${width}: 102.5 and 202.5 — nothing cut, nothing outside its row`, fit.every(f => !f.cut && !f.out), JSON.stringify(fit))
    const hs = fit.map(f => f.h)
    ok(`rows/${width}: one rhythm — last time on its own line under the numbers, every row the same height`,
      fit.every(f => f.under && f.prevOneLine) && Math.max(...hs) - Math.min(...hs) <= 1, JSON.stringify(fit))
  }

  // A long weight in the live block shrinks to fit between the steppers
  // instead of running into −; a short one keeps the full 56px.
  for (const [width, height] of [[390, 740], [360, 740], [320, 568]]) {
    await page.setViewportSize({ width, height })
    await page.getByTestId('weight-input').fill('202.5')
    await page.waitForTimeout(250)
    const m = await page.evaluate(() => {
      const i = document.querySelector('[data-testid="weight-input"]')
      const field = i.closest('.s-field')
      const [minus, plus] = [...i.closest('.s-step').querySelectorAll('.s-step-btn')].map(b => b.getBoundingClientRect())
      const ir = i.getBoundingClientRect(), unit = field.querySelector('.s-field-unit').getBoundingClientRect()
      return { fs: parseFloat(getComputedStyle(i).fontSize), sw: i.scrollWidth, cw: i.clientWidth,
        toMinus: Math.round(minus.left - ir.right), toPlus: Math.round(unit.left - plus.right) }
    })
    ok(`live/${width}: «202.5» is whole and keeps clear of both steppers`,
      m.sw <= m.cw + 1 && m.toMinus >= 8 && m.toPlus >= 8, JSON.stringify(m))
    if (width === 390) ok('live/390: and there it keeps the full 56px', m.fs === 56, JSON.stringify(m))
  }
  // Above 100 the type does not jump on every 2.5 step: 100, 102.5 and
  // 105 are one size.
  for (const [width, height] of [[360, 740], [320, 568]]) {
    await page.setViewportSize({ width, height })
    const sizes = []
    for (const v of ['100', '102.5', '105']) {
      await page.getByTestId('weight-input').fill(v)
      await page.waitForTimeout(120)
      sizes.push(await page.getByTestId('weight-input').evaluate(i => parseFloat(getComputedStyle(i).fontSize)))
    }
    ok(`live/${width}: 100 → 102.5 → 105 keep one size`, Math.max(...sizes) - Math.min(...sizes) < 0.5, JSON.stringify(sizes))
  }
  ok('rows: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// Rows with and without a last time in one list (today has more sets
// than last time), a bodyweight set, and a deload week.
{
  const HIST_NAME = ACTIVE.exercises[0].name
  const HIST = [{ id: 3, date: new Date(2026, 8, 2, 18).toISOString(), duration: 40,
    exercises: [{ id: 'a', muscle: 'Chest', name: HIST_NAME,
      sets: [[70, 12]].map(([w, r]) => ({ weight: String(w), reps: String(r), done: true })) }] }]
  const MIXED = { ...ACTIVE, exercises: [{ ...ACTIVE.exercises[0],
    sets: [['75', '12'], ['75', '12'], ['', '10'], ['80', '']].map(([weight, reps]) => ({ weight, reps, done: false })) }, ACTIVE.exercises[1]] }
  const { ctx, page, errors } = await open({ sessions: HIST, active: MIXED })
  const rows = await page.locator('.s-trow').evaluateAll(els => els.map(r => {
    const n = r.querySelector('.s-cell-n').getBoundingClientRect()
    const kg = r.querySelector('.s-cell-kg').getBoundingClientRect()
    const reps = r.querySelector('.s-cell-reps').getBoundingClientRect()
    const line = kg.width ? kg : reps
    return { text: r.innerText.replace(/\s+/g, ' ').trim(), prev: !!r.querySelector('.s-cell-prev'),
      off: Math.round((line.top + line.height / 2) - (n.top + n.height / 2)) }
  }))
  ok('rows/mixed: a row without a last time is centred on its number, not riding high',
    rows.filter(r => !r.prev).length >= 2 && rows.filter(r => !r.prev).every(r => Math.abs(r.off) <= 1), JSON.stringify(rows))
  ok('rows/bodyweight: a set with no weight reads «10 عدّات», not «— كجم × 10 عدّات»',
    rows.some(r => /10 عدّات/.test(r.text) && !/كجم/.test(r.text) && !/×/.test(r.text)), JSON.stringify(rows))
  ok('rows/no reps: a set with no reps reads «80 كجم», no dangling ×',
    rows.some(r => /80 كجم/.test(r.text) && !/×/.test(r.text) && !/عدّ/.test(r.text)), JSON.stringify(rows))
  ok('rows/mixed: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}
{
  const HIST_NAME = ACTIVE.exercises[0].name
  const HIST = [{ id: 4, date: new Date(2026, 8, 2, 18).toISOString(), duration: 40,
    exercises: [{ id: 'a', muscle: 'Chest', name: HIST_NAME,
      sets: [[75, 15], [75, 15]].map(([w, r]) => ({ weight: String(w), reps: String(r), done: true })) }] }]
  const DL = { ...ACTIVE, deload: { pct: 40 }, exercises: [{ ...ACTIVE.exercises[0],
    sets: [['45', '12'], ['45', '12']].map(([weight, reps]) => ({ weight, reps, done: false })) }, ACTIVE.exercises[1]] }
  const { ctx, page, errors } = await open({ sessions: HIST, active: DL })
  ok('deload: no «حط أرقام آخر مرة» — last time is the heavy week being undone',
    await page.getByRole('button', { name: /حط أرقام آخر مرة/ }).count() === 0)
  ok('live: the reps unit counts in Arabic, matching the rows — «12 عدّة»',
    (await page.locator('[data-field="reps"] .s-field-unit').innerText()).trim() === 'عدّة')
  await page.getByTestId('reps-input').fill('8')
  await page.waitForTimeout(150)
  ok('live: «8 عدّات» in the stepper too',
    (await page.locator('[data-field="reps"] .s-field-unit').innerText()).trim() === 'عدّات')
  ok('deload rows: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 2e. An English-only name reads in its own order ═══════════
// With no Arabic name, the heading is an LTR paragraph: its two lines and
// its clamp run «Smith Machine / Incline Close-…», not «…ncline Close-»,
// and the box still sits on the strap's side.
{
  const LONG_NAME = 'Smith Machine Incline Close-Grip Bench Press Variation'
  const LONG = { ...ACTIVE, exercises: [{ id: 'l', muscle: 'Chest', name: LONG_NAME,
    sets: [0, 1].map(() => ({ weight: '40', reps: '12', done: false })) }, ACTIVE.exercises[1]] }
  const { ctx, page, errors } = await open({ active: LONG, device: 'iPhone SE', viewport: { width: 320, height: 568 } })
  const look = () => page.evaluate(() => {
    const h = document.querySelector('[data-testid="exercise-name"]')
    const r = h.getBoundingClientRect(), n = h.parentElement.getBoundingClientRect()
    return { dir: h.getAttribute('dir'), align: getComputedStyle(h).textAlign, hug: Math.abs(r.right - n.right) <= 1,
      lines: Math.round(r.height / parseFloat(getComputedStyle(h).lineHeight)) }
  })
  const stage = await look()
  ok('names: an English-only name is its own LTR paragraph, on the strap\'s side',
    stage.dir === 'ltr' && stage.align === 'start' && stage.hug, JSON.stringify(stage))
  await completeBtn(page).click()
  await page.waitForTimeout(500)
  const row = await look()
  ok('names/row: folded, it clamps to two LTR lines that still hug the strap\'s side',
    row.dir === 'ltr' && row.lines <= 2 && row.hug, JSON.stringify(row))
  await page.getByRole('button', { name: /Pec Deck/ }).last().click()
  await page.waitForTimeout(400)
  ok('names: an Arabic name stays in the page\'s direction', (await look()).dir === null)
  ok('names: no page errors', errors.length === 0, errors.join('; '))
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
  ok('raise: the coach line says what to try, in words', /آخر مرة\s*75\s*كجم\s*×\s*15\s*عدّة\s*—\s*جرّب\s*77\.5\s*كجم/.test(live), live)
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
  // A set heavier than anything on record wears gold on its row: the
  // weight, and a trophy where its check would be.
  const { ctx, page, errors } = await open({ sessions: RAISE_SESSIONS })
  await page.waitForTimeout(300)
  await completeBtn(page).click()          // 77.5, over the 75 on record
  await page.waitForTimeout(500)
  const pr = await page.evaluate(() => {
    const row = document.querySelector('.s-trow[data-state="done"]')
    const icon = row.querySelector('.s-cell-tick .s-pr-icon')
    return { icon: !!icon, tick: !!row.querySelector('.s-tick'), color: icon && getComputedStyle(icon).color,
      kg: getComputedStyle(row.querySelector('.s-cell-kg .k-num')).color, label: row.getAttribute('aria-label') }
  })
  ok('record: the row shows a gold trophy instead of the check', pr.icon && !pr.tick && pr.color === GOLD, JSON.stringify(pr))
  ok('record: its weight is gold', pr.kg === GOLD, JSON.stringify(pr))
  ok('record: and a screen reader hears it, in words', /رقم قياسي/.test(pr.label) && /77\.5 كجم × 12 عدّة/.test(pr.label), pr.label)
  ok('record: no page errors', errors.length === 0, errors.join('; '))
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

// ══ The rest of the app stays usable during a session ═══════════
// حمزة: «لما ابدأ التمرين باقي اقسام التطبيق تعلق ومااقدر اتصفحها». Two
// sheets overlapping (⋯ leaving while «معلومات ونصائح» arrives) used to
// leave body overflow «hidden» after both closed, so no other tab could
// scroll until the app was restarted.
{
  const HIST = Array.from({ length: 24 }, (_, i) => ({ id: 100 + i, date: new Date(2026, 7, 1 + i, 18).toISOString(), duration: 50,
    exercises: [{ id: 'h', muscle: 'Chest', name: 'Pec Deck', sets: [{ weight: '50', reps: '12', done: true }] }] }))
  const { ctx, page, errors } = await open({ sessions: HIST })
  await page.getByRole('button', { name: 'خيارات التمرين' }).click()
  await page.waitForTimeout(350)
  await page.getByText('معلومات ونصائح').click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'إغلاق' }).last().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'صغّر الجلسة' }).click()
  await page.waitForTimeout(500)
  const st = await page.evaluate(() => ({ overflow: document.body.style.overflow, inert: !!document.getElementById('root')?.inert }))
  ok('session: after two sheets overlap and close, the page is not left locked', st.overflow === '' && !st.inert, JSON.stringify(st))
  await page.locator('nav.f-tabs > button').nth(1).click()
  await page.waitForTimeout(500)
  const y0 = await page.evaluate(() => window.scrollY)
  await page.mouse.wheel(0, 800)
  await page.waitForTimeout(400)
  ok('session: with the session minimised, History still scrolls', (await page.evaluate(() => window.scrollY)) > y0 + 100)
  await page.locator('nav.f-tabs > button').nth(2).click()
  await page.waitForTimeout(400)
  ok('session: and the other tabs still open', await page.locator('.pv').count() === 1)
  ok('session: no page errors', errors.length === 0, errors.join('; '))
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
