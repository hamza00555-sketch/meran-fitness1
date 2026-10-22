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
// And the motion (phase 1): the handoff between exercises, the raise
// reminder that breathes until the weight is touched, the personal
// record's moment (every set at a new weight, its trophy landing on the row),
// the reduced-motion paths, and sound that never breaks a session.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { mkdirSync } from 'node:fs'
import { APP_VERSION, ACHIEVEMENTS, BUILT_IN_PLANS } from '../src/constants.js'

const APP = process.env.APP || 'http://localhost:4173/'
const OUT = process.env.OUT || '/tmp/meran-player-e2e'
mkdirSync(OUT, { recursive: true })

const results = []
const ok = (name, cond, extra = '') => results.push([name, !!cond, extra])

const ACCENT = 'rgb(94, 195, 42)'
const GOLD   = 'rgb(251, 191, 36)'
const DANGER = 'rgb(255, 122, 122)'   // --danger (#FF7A7A: AA on every surface)

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
// (so the scheduled sounds can be read back: library files as named
// buffers in __sounds, synthesized fallbacks as frequencies in __tones),
// the sound files served as tagged stand-ins, a Wake Lock stub, and
// recorders for vibration, view transitions and Web Animations.
// `audio`: 'fake' (default), 'none' (no AudioContext at all), 'nodecode'
// (a context that can't decode files), 'real' (the browser's own).
function instruments(audio = 'fake') {
  window.__tones = []
  window.__sounds = []
  window.__wakeLocks = 0
  window.__vibes = []
  window.__vt = 0
  window.__anims = []
  try {
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: (p) => { window.__vibes.push(p); return true } })
  } catch {}
  try {
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request: async () => { window.__wakeLocks++; return { released: false, release: async () => {} } } },
    })
  } catch {}
  const vt = document.startViewTransition?.bind(document)
  if (vt) document.startViewTransition = (cb) => { window.__vt++; return vt(cb) }
  const animate = Element.prototype.animate
  Element.prototype.animate = function (kf, opts) {
    try {
      const cls = typeof this.className === 'string' ? this.className : (this.className?.baseVal || '')
      // Where it runs, too: a number rolling in the live block (field) or
      // in the rest's clock (rest) are different things.
      if (window.__anims.length < 2000) window.__anims.push({ cls, testid: this.getAttribute?.('data-testid'),
        field: !!this.closest?.('.s-field'), rest: !!this.closest?.('.s-rest, .s-dock'),
        kf: JSON.stringify(kf).slice(0, 200), at: performance.now(), d: opts?.duration ?? null, delay: opts?.delay ?? 0 })
    } catch {}
    return animate.call(this, kf, opts)
  }
  if (audio === 'real') return
  if (audio === 'none') {
    window.AudioContext = undefined
    window.webkitAudioContext = undefined
    return
  }
  class FakeParam { setValueAtTime() {} exponentialRampToValueAtTime() {} }
  class FakeOsc {
    constructor(ctx) { this.ctx = ctx; this.frequency = { value: 0 }; this.type = 'sine' }
    connect() {} disconnect() {}
    start(t) { window.__tones.push({ f: this.frequency.value, at: t - this.ctx.currentTime }) }
    stop() {}
  }
  class FakeSource {
    constructor(ctx) { this.ctx = ctx; this.buffer = null }
    connect() {} disconnect() {}
    start(t = 0) { if (this.buffer?.name) window.__sounds.push({ name: this.buffer.name, at: t - this.ctx.currentTime }) }
    stop() { if (this.buffer?.name) window.__sounds.push({ name: this.buffer.name, stopped: true }) }
  }
  class FakeCtx {
    constructor() { this.state = 'running'; this.destination = {}; this.t0 = performance.now() }
    get currentTime() { return (performance.now() - this.t0) / 1000 }
    resume() { this.state = 'running'; return Promise.resolve() }
    createOscillator() { return new FakeOsc(this) }
    createGain() { return { gain: new FakeParam(), connect() {}, disconnect() {} } }
    createBuffer() { return {} }
    createBufferSource() { return new FakeSource(this) }
  }
  if (audio === 'fake') {
    FakeCtx.prototype.decodeAudioData = function (data) {
      return data?.__sound ? Promise.resolve({ name: data.__sound, duration: 0.2 }) : Promise.reject(new Error('not audio'))
    }
    const fetch0 = window.fetch.bind(window)
    window.fetch = (url, ...rest) => {
      const m = String(url).match(/\/sounds\/([\w-]+)\.(m4a|mp3)$/)
      if (!m) return fetch0(url, ...rest)
      const ab = new ArrayBuffer(8)
      ab.__sound = m[1]
      return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(ab) })
    }
  }
  window.AudioContext = FakeCtx
  window.webkitAudioContext = FakeCtx
}

// WebGL, counted: contexts made and released (WEBGL_lose_context) — the
// medal stage must give its context back. `noGL` makes the browser one
// without WebGL (Lockdown Mode): getContext('webgl') answers null.
function glInstruments(noGL) {
  window.__gl = { made: 0, lost: 0 }
  const gc = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    if (/webgl/.test(type) && noGL) return null
    const c = gc.call(this, type, ...rest)
    if (c && /webgl/.test(type) && !c.__counted) {
      c.__counted = true
      window.__gl.made++
      const ge = c.getExtension.bind(c)
      c.getExtension = (n) => {
        const e = ge(n)
        if (e && n === 'WEBGL_lose_context' && !e.__counted) {
          e.__counted = true
          const lose = e.loseContext.bind(e)
          e.loseContext = () => { window.__gl.lost++; lose() }
        }
        return e
      }
    }
    return c
  }
}

async function open({ device = 'iPhone 13', viewport = null, blockRemote = true, active = ACTIVE,
  sessions = null, reduced = false, lastWeights = null, mapping = null, audio = 'fake', blockSounds = false,
  unlocked = null, noGL = false, xp = null, perf = false, route = null, extra = null } = {}) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', // the worker has its own suites (offline, pack-install); here it would serve past page.route
    ...devices[device], ...(viewport ? { viewport } : null),
    timezoneId: 'Asia/Riyadh', locale: 'ar',
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  if (blockRemote) await page.route(u => u.pathname.startsWith('/pack/'), r => r.abort())
  if (blockSounds) await page.route('**/sounds/**', r => r.abort())
  if (route) await page.route(route.url, route.handler)
  // the app's own timing marks (src/perf.js), read back by the medal checks
  if (perf) await page.addInitScript(() => localStorage.setItem('meran_perf', '1'))

  await page.addInitScript(instruments, audio)
  await page.addInitScript(glInstruments, noGL)
  // Seeded history unlocks achievements on the first paint, each one
  // adds XP, and the level-up screen would cover the session — so a
  // context with history starts with them already unlocked.
  await page.addInitScript(([active, sessions, version, lastWeights, unlocked, mapping, xp, extra]) => {
    for (const [k, v] of Object.entries(extra || {})) localStorage.setItem(k, JSON.stringify(v))
    if (sessions || unlocked.length < 40) localStorage.setItem('hf_unlocked', JSON.stringify(unlocked))
    localStorage.setItem('hf_profile', JSON.stringify({ name: 'حمزة' }))
    localStorage.setItem('hf_pack_prompted', '1')
    localStorage.setItem('hf_seen_version', JSON.stringify(version))
    localStorage.setItem('hf_onboarded', 'true')
    localStorage.setItem('hf_weights_reset_v2', 'true')
    if (active) localStorage.setItem('hf_active', JSON.stringify(active))
    if (sessions) localStorage.setItem('hf_sessions', JSON.stringify(sessions))
    if (lastWeights) localStorage.setItem('hf_last_weights', JSON.stringify(lastWeights))
    if (mapping) localStorage.setItem('hf_exercise_mapping', JSON.stringify(mapping))
    if (xp != null) localStorage.setItem('hf_xp', JSON.stringify(xp))
  }, [active, sessions, APP_VERSION, lastWeights, unlocked || ACHIEVEMENTS.map(a => a.id), mapping, xp, extra])

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
// Where each part of the middle is drawn, sideways (px): the computed
// transform, which a leftover animation would hold at 0 whatever the
// inline style says.
const drawnShift = (page) => page.evaluate(() => [...document.querySelector('.s-scroll').children]
  .map(c => Math.round(new DOMMatrixReadOnly(getComputedStyle(c).transform === 'none' ? undefined : getComputedStyle(c).transform).m41 * 10) / 10))
// A mouse drag on the exercise head that stops mid-way: returns what is
// drawn, then lets go (short of the line, so it springs back).
async function dragHead(page, dx = 40) {
  const b = await page.locator('[data-testid="exercise-stage"], [data-testid="exercise-row"]').first().boundingBox()
  const x = b.x + b.width / 2, y = b.y + Math.min(b.height / 2, 60)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx / 2, y, { steps: 3 })
  await page.mouse.move(x + dx, y, { steps: 3 })
  const drawn = await drawnShift(page)
  drawn.kids = await page.evaluate(() => [...document.querySelector('.s-scroll').children].map(c => c.className.split(' ')[0]))
  await page.waitForTimeout(250)
  await page.mouse.up()
  await page.waitForTimeout(700)
  return drawn
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
  ok('record: never on the first time an exercise is done (nothing on record to beat)', await page.getByTestId('pr-moment').count() === 0)
  ok('stage: it folds into the 72pt row after the first set',
    await page.getByTestId('exercise-stage').count() === 0 && await page.getByTestId('exercise-row').count() === 1)
  ok('rest: the next set stays editable during the rest',
    (await inputs(page)).length === 2 && /المجموعة\s*2/.test(await page.getByTestId('live-block').innerText()))

  ok('clock: the bar tells wall time since the start', (await clockDrift(page)) <= 2, String(await clockSecs(page)))
  const restClock0 = await clockSecs(page)
  await page.waitForTimeout(2100)
  ok('clock: it keeps running through the rest', (await clockSecs(page)) - restClock0 >= 2,
    `${restClock0} → ${await clockSecs(page)}`)

  const sounds = await page.evaluate(() => window.__sounds.filter(s => !s.stopped))
  const restSounds = sounds.filter(s => /^rest-/.test(s.name))
  ok('sound: three library ticks and the end chime, scheduled in the tap',
    restSounds.map(s => s.name).join(',') === 'rest-tick,rest-tick,rest-tick,rest-end', JSON.stringify(sounds))
  ok('sound: the ticks at −3/−2/−1 and the chime at the end of the rest', restSounds.length === 4
    && [87, 88, 89, 90].every((t, i) => Math.abs(restSounds[i].at - t) < 2), JSON.stringify(restSounds.map(t => Math.round(t.at))))
  ok('sound: the set itself made the short «set-done» sound, at once',
    sounds.filter(s => s.name === 'set-done').length === 1 && sounds.find(s => s.name === 'set-done').at < 0.3, JSON.stringify(sounds))
  ok('sound: no synthesized beeps while the files are there', (await page.evaluate(() => window.__tones.length)) === 0)
  ok('haptics: the set ticks (Android pattern; iOS uses the switch in the same tap)',
    JSON.stringify(await page.evaluate(() => window.__vibes)) === '[12]', JSON.stringify(await page.evaluate(() => window.__vibes)))

  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_rest_timer'))?.endsAt)
  await page.getByRole('button', { name: 'زد 15 ثانية' }).click()
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_rest_timer'))?.endsAt)
  ok('rest: +15 pushes endsAt by 15s', after - before === 15000, String(after - before))
  await page.getByRole('button', { name: 'أنقص 15 ثانية' }).click()
  const back = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_rest_timer'))?.endsAt)
  ok('rest: −15 pulls it back', back - before === 0, String(back - before))
  const resched = await page.evaluate(() => window.__sounds.filter(s => /^rest-/.test(s.name)))
  ok('sound: ±15 cancels and reschedules the rest sounds',
    resched.filter(s => !s.stopped).length === 12 && resched.filter(s => s.stopped).length === 8, JSON.stringify(resched.length))

  const skipColor = await page.getByRole('button', { name: 'تخطي' }).evaluate(el => getComputedStyle(el).color)
  ok('rest: «تخطي» is plain grey text, never red', skipColor !== DANGER && skipColor !== ACCENT, skipColor)
  const drain = await page.locator('.s-rest-bar i').evaluate(el => {
    const cs = getComputedStyle(el)
    return { name: cs.animationName, origin: cs.transformOrigin, color: cs.backgroundColor }
  })
  ok('rest: a blue bar drains from the start edge', /^s-drain\b/.test(drain.name) && drain.origin.startsWith('0px')
    && drain.color === 'rgb(59, 157, 232)', JSON.stringify(drain))
  ok('rest: the countdown is 56px', await page.locator('.s-rest-time').evaluate(el => parseFloat(getComputedStyle(el).fontSize)) === 56)

  await page.getByRole('button', { name: 'تخطي' }).click()
  await page.waitForTimeout(400)
  ok('rest: skip brings the docked button back', await completeBtn(page).count() === 1 && await page.getByTestId('rest-bar').count() === 0)
  ok('rest: skip cleared the stored timer', await page.evaluate(() => localStorage.getItem('hf_rest_timer') === null))

  // Second set, then let the clock run out. Every frame after the tap is
  // sampled: the first one without the live block must already name the
  // exercise and hold «التالي»'s place (no frame of the generic line).
  const vt0 = await page.evaluate(() => window.__vt)
  await page.evaluate(() => {
    window.__frames = []
    const tick = () => {
      const d = document.querySelector('.s-done-line')
      if (d) window.__frames.push({ text: d.querySelector('strong')?.textContent, fresh: d.dataset.fresh || null, next: !!document.querySelector('.s-next-line') })
      if (window.__frames.length < 12) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await completeBtn(page).click()
  const tapAt = Date.now()
  await page.waitForTimeout(500)
  ok('completion: the last set names the finished exercise', /اكتمل/.test(await text(page)))
  const frames = await page.evaluate(() => window.__frames)
  ok('completion: from its first frame the line names the exercise, rising, with «التالي» in place',
    frames.length > 0 && frames.every(f => f.text === 'اكتمل ضغط صدر جهاز هامر' && f.fresh === '1' && f.next), JSON.stringify(frames.slice(0, 3)))
  const nextLine = await page.getByTestId('exercise-next').innerText().catch(() => '')
  ok('handoff: «التالي» names the next exercise, under «اكتمل»', /التالي/.test(nextLine) && /تفتيح جهاز/.test(nextLine), nextLine)
  await page.evaluate(() => { window.__anims = [] })
  // The next exercise comes on by itself a second and a half after the last set.
  await page.waitForFunction(() => document.querySelector('.s-name-en')?.textContent === 'Pec Deck', null, { timeout: 4000, polling: 50 }).catch(() => {})
  const handoffMs = Date.now() - tapAt
  ok('handoff: the next exercise comes on by itself ~1.5s after the last set', handoffMs >= 1350 && handoffMs <= 2300, `${handoffMs}ms`)
  await page.waitForTimeout(700)
  const ho = await page.evaluate(() => ({
    vt: window.__vt, attr: document.documentElement.dataset.handoff ?? null,
    slide: window.__anims.some(a => /translateX\(-48px\)/.test(a.kf)),
    art: window.__anims.some(a => /s-stage-media/.test(a.cls) && /translateX\(-100px\) scale\(\.94\)/.test(a.kf)),
    names: window.__anims.filter(a => /s-name-ar|s-name-en|s-meta/.test(a.cls)).length,
    live: window.__anims.some(a => a.testid === 'live-block'),
  }))
  ok('handoff: it runs as a view transition (the outgoing screen is a snapshot that leaves)', ho.vt === vt0 + 1, JSON.stringify(ho))
  ok('handoff: the new screen slides in from the left, its picture deeper, names one by one, the set last',
    ho.slide && ho.art && ho.names === 3 && ho.live, JSON.stringify(ho))
  ok('handoff: and it tidies up after itself', ho.attr === null, JSON.stringify(ho))
  await endRest(page, 23000)
  const ready = page.getByTestId('rest-ready')
  await ready.waitFor({ timeout: 4000 }).catch(() => {})
  ok('ready: at zero the dock becomes the green «جاهز» field', /جاهز\s*·\s*المجموعة التالية/.test(await ready.innerText().catch(() => '')))
  ok('ready: it counts the overtime', /\+0:2\d/.test(await ready.innerText().catch(() => '')))
  const fullWidth = await ready.evaluate(el => Math.round(el.getBoundingClientRect().width) === window.innerWidth).catch(() => false)
  ok('ready: the field runs edge to edge', fullWidth)

  // Meanwhile the next exercise came on screen by itself.
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

  // The screen follows the finger — what is drawn, not just the inline
  // style: this exercise was reached by two swipes, and a finished
  // entrance animation must not pin it in place. The 10px of slop that
  // tell a drag from a tap are not a jump: a 40px drag moves it 30px.
  // Short of the line it springs back; at the first exercise, dragging
  // towards «before» resists.
  const box = await page.locator('[data-testid="exercise-stage"]').boundingBox()
  const hx = box.x + box.width / 2, hy = box.y + box.height / 2
  const shift = () => page.evaluate(() => [...document.querySelector('.s-scroll').children].map(c => c.style.transform))
  await page.mouse.move(hx, hy)
  await page.mouse.down()
  await page.mouse.move(hx + 20, hy, { steps: 3 })
  await page.mouse.move(hx + 40, hy, { steps: 3 })
  const following = await shift()
  const drawn = await drawnShift(page)
  ok('swipe: mid-drag, the whole middle moves with the finger', following.length >= 3 && following.every(t => t === 'translateX(30px)'), JSON.stringify(following))
  ok('swipe: and it is drawn there, after moves between exercises', drawn.length >= 3 && drawn.every(x => x === 30), JSON.stringify(drawn))
  await page.waitForTimeout(250)   // let go slowly: no flick
  await page.evaluate(() => { window.__anims = [] })
  await page.mouse.up()
  await page.waitForTimeout(100)
  const back = await page.evaluate(() => ({
    t: [...document.querySelector('.s-scroll').children].map(c => c.style.transform),
    spring: window.__anims.filter(a => /translateX\(30px\)/.test(a.kf) && /"none"/.test(a.kf)).length,
  }))
  ok('swipe: let go short of 56px, it springs back and stays on the exercise',
    back.t.every(t => t === '') && back.spring >= 3 && (await page.locator('.s-name-en').first().textContent()) === 'Hammer Strength Machine Bench Press', JSON.stringify(back))
  await page.waitForTimeout(800)
  await page.mouse.move(hx, hy)
  await page.mouse.down()
  await page.mouse.move(hx - 50, hy, { steps: 3 })
  await page.mouse.move(hx - 100, hy, { steps: 3 })
  const edge = await shift()
  ok('swipe: past the first exercise it resists (0.35×)', edge.every(t => t === 'translateX(-31.5px)'), JSON.stringify(edge))
  await page.mouse.up()
  await page.waitForTimeout(600)
  ok('swipe: and lands back where it was', (await page.locator('.s-name-en').first().textContent()) === 'Hammer Strength Machine Bench Press'
    && (await shift()).every(t => t === ''))
  ok('swipe: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 2b′. The swipe still follows after any move ════════════════
// Every way of arriving at an exercise — a tap in the list, the move
// that comes by itself after the last set — leaves it free to be dragged
// (an entrance that kept its last frame pinned the screen in place), and
// on an exercise just finished «اكتمل» and «التالي» move with the rest.
{
  const { ctx, page, errors } = await open()
  await page.getByRole('button', { name: /Pec Deck/ }).last().click()
  await page.waitForTimeout(900)
  const afterTap = await dragHead(page)
  ok('swipe/after a list tap: mid-drag, everything is drawn 30px along',
    afterTap.length >= 3 && afterTap.every(x => x === 30), JSON.stringify(afterTap))
  ok('swipe/after a list tap: and it stays on the exercise', (await page.locator('.s-name-en').first().textContent()) === 'Pec Deck')

  // The last exercise has one set: finish it, drag while «اكتمل» is up.
  await page.getByRole('button', { name: /Machine Shoulder Press/ }).last().click()
  await page.waitForTimeout(900)
  await completeBtn(page).click()
  await page.waitForTimeout(800)
  const done = await dragHead(page, -40)   // back towards the one before (the last has no «next» to resist into)
  ok('swipe/just finished: «اكتمل» and «التالي» move with the rest of the screen',
    done.kids.includes('s-done-line') && done.kids.includes('s-next-line') && done.every(x => x === -30), JSON.stringify({ kids: done.kids, done }))
  // …then the next unfinished exercise (the first) comes on by itself.
  await page.waitForFunction(() => document.querySelector('.s-name-en')?.textContent === 'Hammer Strength Machine Bench Press', null, { timeout: 4000 }).catch(() => {})
  await page.waitForTimeout(900)
  const afterAuto = await dragHead(page)
  ok('swipe/after the move that comes by itself: mid-drag, everything is drawn 30px along',
    afterAuto.length >= 3 && afterAuto.every(x => x === 30), JSON.stringify(afterAuto))
  ok('swipe/after moves: no page errors', errors.length === 0, errors.join('; '))
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
    // On the iPhone the app link goes out as a link click (src/youtube.js):
    // record it and play the YouTube app opening (the page goes hidden),
    // so the web fallback stays quiet, as on the phone.
    document.addEventListener('click', (e) => {
      const a = e.target.closest?.('a[href^="youtube:"]')
      if (!a) return
      e.preventDefault()
      window.__opened.push([a.href])
      if (window.__noApp) return   // the YouTube app isn't installed: the page stays in front
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
      setTimeout(() => { delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')) }, 30)
    }, true)
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
  ok('video: on the iPhone a tap opens the YouTube app directly — no in-app browser page',
    opened.length === 1 && /^youtube:\/\/www\.youtube\.com\/results\?search_query=/.test(opened[0][0]),
    JSON.stringify(opened))
  await page.waitForTimeout(1700)
  ok('video: and once the app opened, no web page follows', (await page.evaluate(() => window.__opened.length)) === 1,
    JSON.stringify(await page.evaluate(() => window.__opened)))
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
  // No YouTube app on the phone: the page is still in front 1.5s later, so
  // the web page opens after all, in a new tab without an opener.
  await page.evaluate(() => { window.__noApp = true })
  await disc.click()
  await page.waitForTimeout(1800)
  opened = await page.evaluate(() => window.__opened)
  ok('video: without the YouTube app, the web page opens as before',
    opened.length === 7 && /^youtube:/.test(opened[5][0]) && /^https:\/\/www\.youtube\.com\//.test(opened[6][0])
      && opened[6][1] === '_blank' && /noopener/.test(opened[6][2] || ''), JSON.stringify(opened.slice(5)))
  // The app opened and only blurred the page (no visibility change): the
  // web page must not follow — it was the white sheet waiting on his return.
  await disc.click()
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await page.waitForTimeout(1800)
  opened = await page.evaluate(() => window.__opened)
  ok('video: once the page loses focus to YouTube, no web page follows', opened.length === 8 && /^youtube:/.test(opened[7][0]),
    JSON.stringify(opened.slice(7)))
  await page.evaluate(() => { window.__noApp = false })

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

// ══ 4a. The move on by itself waits for him ════════════════════
// Opening ⋯ (or the info) or tapping a done row to correct it, in the
// second and a half after an exercise's last set, calls the move off:
// the sheet's actions and the numbers he types land on the exercise he
// finished, never on the next one that would have slid in under them.
{
  const TWO = () => ({
    id: Date.now() - 60000, date: new Date().toISOString(), name: 'Legs — اختبار',
    exercises: [
      { id: 'p', muscle: 'Legs', name: 'Leg Press', sets: [{ weight: '40', reps: '12', done: false }] },
      { id: 'c', muscle: 'Legs', name: 'Leg Curl',
        sets: [{ weight: '30', reps: '12', done: false }, { weight: '30', reps: '12', done: false }] },
    ],
  })
  {
    const { ctx, page, errors } = await open({ active: TWO() })
    const n0 = await page.getByTestId('exercise-name').textContent()
    await completeBtn(page).click()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: 'خيارات التمرين' }).click()
    await page.waitForTimeout(1600)
    const title = await page.locator('.k-sheet-h h2').textContent().catch(() => null)
    ok('wait: with ⋯ open the next exercise does not slide in under it',
      (await page.getByTestId('exercise-name').textContent()) === n0 && title === n0, `${n0} / sheet ${title}`)
    await page.getByText('إضافة مجموعة').click()
    await page.waitForTimeout(2000)
    const st = await activeStored(page)
    ok('wait: «إضافة مجموعة» adds to the exercise he finished, and the screen stays on it',
      st.exercises[0].sets.length === 2 && st.exercises[1].sets.length === 2
      && (await page.getByTestId('exercise-name').textContent()) === n0,
      `${st.exercises.map(e => e.sets.length)}`)
    ok('wait/⋯: no page errors', errors.length === 0, errors.join('; '))
    await ctx.close()
  }
  {
    const { ctx, page, errors } = await open({ active: TWO() })
    const n0 = await page.getByTestId('exercise-name').textContent()
    await completeBtn(page).click()
    await page.waitForTimeout(600)
    await page.locator('.s-trow[data-state="done"]').first().click()
    await page.waitForTimeout(1500)
    ok('wait: correcting a done set keeps the screen on it, still editing',
      (await page.getByTestId('exercise-name').textContent()) === n0
      && await page.getByRole('button', { name: 'حفظ التعديل' }).count() === 1)
    await page.getByTestId('reps-input').fill('10')
    await page.waitForTimeout(300)
    const st = await activeStored(page)
    ok('wait: the corrected reps land on the set being corrected',
      st.exercises[0].sets[0].reps === '10' && st.exercises[1].sets.every(s => s.reps === '12'),
      JSON.stringify(st.exercises.map(e => e.sets.map(s => `${s.weight}x${s.reps}${s.done ? '✓' : ''}`))))
    ok('wait/edit: no page errors', errors.length === 0, errors.join('; '))
    await ctx.close()
  }
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

// ══ 4b″. A double tap on «حفظ التعديل» logs nothing else ═════════
// «تمّت المجموعة» comes back in the very spot «حفظ التعديل» leaves.
{
  const { ctx, page, errors } = await open()
  await completeBtn(page).click()
  await page.waitForTimeout(600)
  await endRest(page)
  await page.getByTestId('rest-ready').click({ timeout: 5000 })
  await page.waitForTimeout(700)
  const bad = []
  for (const gap of [80, 250]) {
    await page.locator('.s-trow[data-state="done"]').first().click()
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: 'زد العدّات' }).click()
    await page.waitForTimeout(300)
    const at = await centre(page.getByRole('button', { name: 'حفظ التعديل' }))
    await finger(page, ctx, at, { holdMs: 30 })
    await page.waitForTimeout(gap)
    await finger(page, ctx, at, { holdMs: 30 })
    await page.waitForTimeout(700)
    const sets = (await activeStored(page)).exercises[0].sets
    const rest = await page.getByTestId('rest-bar').count()
    if (sets.filter(s => s.done).length !== 1 || rest) { bad.push(`${gap}ms: ${JSON.stringify(sets.map(s => `${s.reps}${s.done ? '✓' : ''}`))} rest ${rest}`); break }
  }
  const reps = (await activeStored(page)).exercises[0].sets[0].reps
  ok('save guard: a double tap on «حفظ التعديل» saves and logs no set it never did', bad.length === 0, bad.join('; '))
  ok('save guard: both edits landed on the set being corrected', bad.length || reps === '14', String(reps))
  await page.waitForTimeout(300)
  await completeBtn(page).click({ timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(300)
  ok('save guard: a moment later the button logs as usual', (await activeStored(page)).exercises[0].sets.filter(s => s.done).length === 2)
  ok('save guard: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 4b′. A double tap on «تمّت المجموعة» leaves the rest alone ════
// For the moment the button turns into the rest, only its copy shows (it
// takes no taps) while the rest's «تخطي» and ±15 are already under it.
// A thumb bouncing on the button — at its start, middle or end, 60 or
// 150ms later — must not skip the rest or move its end.
{
  const SIX = {
    id: Date.now() - 60000, date: new Date().toISOString(), name: 'Legs — اختبار',
    exercises: [{ id: 'p', muscle: 'Legs', name: 'Leg Press',
      sets: Array.from({ length: 7 }, () => ({ weight: '40', reps: '12', done: false })) }],
  }
  const { ctx, page, errors } = await open({ active: SIX, viewport: { width: 390, height: 664 } })
  const b = await completeBtn(page).boundingBox()
  const bad = []
  for (const fx of [0.1, 0.5, 0.9]) {
    for (const gap of [60, 150]) {
      const x = b.x + b.width * fx, y = b.y + b.height / 2
      await finger(page, ctx, { x, y }, { holdMs: 30 })
      const t0 = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_rest_timer'))?.endsAt ?? null)
      await page.waitForTimeout(gap)
      await finger(page, ctx, { x, y }, { holdMs: 30 })
      await page.waitForTimeout(600)
      const t1 = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_rest_timer'))?.endsAt ?? null)
      const panel = await page.getByTestId('rest-bar').count()
      if (t0 == null || t1 !== t0 || panel !== 1) bad.push(`${fx}@${gap}ms: ${t0} → ${t1}, panel ${panel}`)
      // Next round: skip the rest (after the morph), then wait out the guard.
      await page.getByRole('button', { name: 'تخطي' }).click({ timeout: 1500 }).catch(() => {})
      await page.waitForTimeout(500)
    }
  }
  ok('morph guard: a second tap through the turning button neither skips the rest nor moves its end', bad.length === 0, bad.join('; '))
  const done = (await activeStored(page)).exercises[0].sets.filter(s => s.done).length
  ok('morph guard: each double tap logged one set', done === 6, String(done))
  await completeBtn(page).click()
  await page.waitForTimeout(700)
  const e0 = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_rest_timer'))?.endsAt)
  await page.getByRole('button', { name: 'زد 15 ثانية' }).click()
  const e1 = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_rest_timer'))?.endsAt)
  ok('morph guard: once the rest is up, +15 works as usual', e1 - e0 === 15000, String(e1 - e0))
  ok('morph guard: no page errors', errors.length === 0, errors.join('; '))
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
  // The intro: the old weight rolls up to the new one over the input, gold.
  const rolled = await page.evaluate(() => {
    const o = document.querySelector('.s-field-roll')
    return !!o && !!o.querySelector('.k-roll-on') && o.querySelectorAll('.k-roll-s').length > 0
  })
  await page.waitForFunction(() => document.querySelector('.s-field-roll') && !document.querySelector('.s-field-roll .k-roll-on'), null, { timeout: 2000 }).catch(() => {})
  const roll = await page.evaluate(() => {
    const o = document.querySelector('.s-field-roll')
    const i = document.querySelector('[data-testid="weight-input"]')
    return o && { text: o.textContent, color: getComputedStyle(o).color, input: getComputedStyle(i).opacity }
  })
  ok('raise: the old weight rolls up to the new one, in gold, over the input',
    !!roll && roll.text === '77.5' && roll.color === GOLD && roll.input === '0', JSON.stringify({ rolled, roll }))
  ok('raise: the session list marks the exercise with a still gold arrow',
    await page.getByTestId('queue-raise').count() === 1
    && await page.getByTestId('queue-raise').evaluate(el => getComputedStyle(el).color) === GOLD)
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
  ok('raise: after the intro the input itself holds the number, in gold',
    await page.locator('.s-field-roll').count() === 0 && await w.evaluate(el => getComputedStyle(el).color) === GOLD
    && await w.evaluate(el => getComputedStyle(el).opacity) === '1')
  const trace = await page.evaluate(async () => {
    const out = []
    for (let i = 0; i < 16; i++) {
      const ring = document.querySelector('[data-testid="raise-ring"]')
      out.push({ off: parseFloat(getComputedStyle(document.querySelector('.s-raise-path')).strokeDashoffset), op: parseFloat(getComputedStyle(ring).opacity) })
      await new Promise(r => setTimeout(r, 100))
    }
    return out
  })
  ok('raise: then the ring stays whole', trace.every(v => v.off === 0), JSON.stringify(trace.map(t => t.off)))
  const breath = await page.locator('[data-testid="raise-ring"]').evaluate(el => {
    const cs = getComputedStyle(el)
    return { name: cs.animationName, count: cs.animationIterationCount, state: el.getAttribute('data-state') }
  })
  ok('raise: and breathes — dims and comes back — until the number is touched',
    breath.name === 's-raise-breathe' && breath.count === 'infinite' && breath.state === 'breathe'
    && Math.min(...trace.map(t => t.op)) < 0.6 && Math.max(...trace.map(t => t.op)) > 0.95, JSON.stringify({ breath, op: trace.map(t => t.op) }))
  await page.screenshot({ path: `${OUT}/raise.png` })
  await page.waitForTimeout(3000)
  ok('raise: still breathing seconds later (not three breaths and done)',
    await page.locator('[data-testid="raise-ring"]').getAttribute('data-state') === 'breathe')
  await w.click()
  await page.waitForTimeout(150)
  const still = await page.locator('[data-testid="raise-ring"]').evaluate(el => ({
    state: el.getAttribute('data-state'), name: getComputedStyle(el).animationName, op: getComputedStyle(el).opacity }))
  ok('raise: touching the number stops the breathing, the ring whole and still',
    still.state === 'still' && still.name === 'none' && still.op === '1', JSON.stringify(still))
  await w.evaluate(el => el.blur())

  await page.getByRole('button', { name: /خلّها\s*75/ }).click()
  await page.waitForTimeout(60)
  const reverse = await page.evaluate(() => ({
    ring: document.querySelector('[data-testid="raise-ring"]')?.getAttribute('data-state'),
    roll: !!document.querySelector('.s-field-roll .k-roll-on'),
  }))
  ok('raise: «خلّها 75» runs it backwards — the number rolls down, the ring withdraws',
    reverse.ring === 'retract' && reverse.roll, JSON.stringify(reverse))
  await page.waitForTimeout(450)
  ok('raise: «خلّها 75» puts the weight back', await w.inputValue() === '75')
  ok('raise: for every set', (await activeStored(page)).exercises[0].sets.every(s => s.weight === '75'))
  ok('raise: and the gold goes with it', await page.locator('[data-testid="raise-ring"]').count() === 0
    && await w.evaluate(el => getComputedStyle(el).color) !== GOLD && await page.locator('.s-raise-chip').count() === 0)
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
  // Once a set is done, nothing: the next set's block simply has the gold,
  // the ring and the chip — no «raise» sound again, no chip sliding in, no
  // flare, no number rolling — and the same after «حفظ التعديل». (An older
  // heavier session keeps 77.5 from being a record, so only the raise
  // reminder is on screen.) The tap unlocks the audio, so a replayed intro
  // would be heard here.
  const OLD = { ...raiseDay(1, [[90, 5]]), id: 0.5, date: new Date(2026, 5, 1, 18).toISOString() }
  const active = { ...ACTIVE, exercises: [{ ...ACTIVE.exercises[0], sets: [0, 1, 2].map(() => ({ weight: '75', reps: '12', done: false })) }, ...ACTIVE.exercises.slice(1)] }
  const { ctx, page, errors } = await open({ sessions: [OLD, ...RAISE_SESSIONS], active })
  await page.waitForTimeout(2600)
  const quiet = () => page.evaluate(() => ({
    raise: window.__sounds.filter(s => s.name === 'raise').length,
    setDone: window.__sounds.filter(s => s.name === 'set-done').length,
    chip: window.__anims.filter(a => /s-raise-chip-w/.test(a.cls)).length
      + [...document.querySelectorAll('.s-raise-chip-w')].flatMap(c => c.getAnimations()).length,
    flare: window.__anims.filter(a => /s-field/.test(a.cls) && /boxShadow/.test(a.kf)).length,
    roll: window.__anims.filter(a => /k-roll-s/.test(a.cls) && a.field).length,
    ring: document.querySelector('[data-testid="raise-ring"]')?.getAttribute('data-state') ?? null,
    chipShown: !!document.querySelector('.s-raise-chip'),
  }))
  await page.evaluate(() => {
    window.__sounds = []; window.__anims = []; window.__ringFrames = []
    const tick = () => {
      if (/المجموعة\s*2/.test(document.querySelector('.s-live-set')?.textContent || '')) {
        window.__ringFrames.push(!!document.querySelector('[data-testid="raise-ring"]'))
      }
      if (window.__ringFrames.length < 3) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await completeBtn(page).click()
  await page.waitForTimeout(900)
  const afterSet = await quiet()
  ok('raise/after a set: the set made its sound, and the raise did not play again',
    afterSet.setDone === 1 && afterSet.raise === 0, JSON.stringify(afterSet))
  ok('raise/after a set: no chip sliding in, no flare, no number rolling',
    afterSet.chip === 0 && afterSet.flare === 0 && afterSet.roll === 0, JSON.stringify(afterSet))
  ok('raise/after a set: the ring and the chip are simply there, the ring still', afterSet.ring === 'still' && afterSet.chipShown, JSON.stringify(afterSet))
  const ringFrames = await page.evaluate(() => window.__ringFrames)
  ok('raise/after a set: the ring is there from the next set\'s first frame', ringFrames.length > 0 && ringFrames.every(Boolean), JSON.stringify(ringFrames))

  await page.getByRole('button', { name: 'تخطي' }).click()
  await page.waitForTimeout(600)
  await page.locator('.s-trow[data-state="done"]').first().click()
  await page.waitForTimeout(400)
  await page.evaluate(() => { window.__sounds = []; window.__anims = [] })
  await page.getByRole('button', { name: 'حفظ التعديل' }).click()
  await page.waitForTimeout(900)
  const afterEdit = await quiet()
  ok('raise/after «حفظ التعديل»: nothing replays either',
    afterEdit.raise === 0 && afterEdit.chip === 0 && afterEdit.flare === 0 && afterEdit.roll === 0 && afterEdit.ring === 'still', JSON.stringify(afterEdit))

  // Raised by hand with +, the number rolls (and the gold, the ring and
  // the chip come with it).
  await page.getByRole('button', { name: /خلّها\s*75/ }).click()
  await page.waitForTimeout(700)
  await page.evaluate(() => { window.__anims = [] })
  await page.getByRole('button', { name: 'زد الوزن' }).click()
  await page.waitForTimeout(40)
  const byHand = await page.evaluate(() => ({
    roll: !!document.querySelector('.s-field-roll .k-roll-on'),
    ghost: document.querySelector('.s-field-roll .k-roll-ghost')?.textContent,
    input: document.querySelector('[data-testid="weight-input"]').value,
    ring: document.querySelector('[data-testid="raise-ring"]')?.getAttribute('class'),
    chip: document.querySelector('.s-raise-chip-w')?.dataset.enter,
  }))
  ok('raise/by hand: + rolls the number up to the raised weight, with the quick ring and the chip',
    byHand.roll && byHand.ghost === '77.5' && byHand.input === '77.5' && /s-raise-quick/.test(byHand.ring || '') && byHand.chip === '1', JSON.stringify(byHand))
  await page.waitForTimeout(500)
  ok('raise/by hand: then the input holds it again', await page.locator('.s-field-roll').count() === 0
    && await page.getByTestId('weight-input').evaluate(el => getComputedStyle(el).opacity) === '1')
  ok('raise/no replay: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

{
  // The intro draws a copy of the number over the input. A press on + or
  // − during it must not change a number nobody can see: what is shown is
  // always what «تمّت المجموعة» will log.
  const { ctx, page, errors } = await open({ sessions: RAISE_SESSIONS })
  await page.waitForTimeout(250)
  await page.getByRole('button', { name: 'زد الوزن' }).click()
  await page.getByRole('button', { name: 'زد الوزن' }).click()
  const seen = await page.evaluate(async () => {
    const out = []
    for (let i = 0; i < 20; i++) {
      const o = document.querySelector('.s-field-roll')
      const inp = document.querySelector('[data-testid="weight-input"]')
      const shown = o ? (o.querySelector('.k-roll-ghost') || o.querySelector('.k-roll') || o).textContent : null
      out.push({ input: inp.value, shown, inputVisible: getComputedStyle(inp).opacity === '1' })
      await new Promise(r => setTimeout(r, 100))
    }
    return out
  })
  ok('raise/steppers in the intro: the number on screen is always the one in the field',
    seen.every(s => (s.shown == null && s.inputVisible) || s.shown === s.input) && seen.at(-1).input === '82.5', JSON.stringify(seen.slice(0, 4)))
  ok('raise/steppers in the intro: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

{
  // In the session list, the gold arrow sits right after the exercise's
  // name, not out by its «0/2» count.
  const { ctx, page } = await open({ sessions: RAISE_SESSIONS })
  const place = await page.evaluate(() => {
    const a = document.querySelector('[data-testid="queue-raise"]')
    const row = a.closest('.s-qrow')
    const name = row.querySelector('.s-qrow-ar').getBoundingClientRect()
    const count = row.querySelector('.s-qrow-count').getBoundingClientRect()
    const r = a.getBoundingClientRect()
    return { gapToName: Math.round(name.left - r.right), gapToCount: Math.round(r.left - count.right), sameLine: Math.abs((r.top + r.bottom) / 2 - (name.top + name.bottom) / 2) < 6 }
  })
  ok('raise/list: the arrow is beside the name (RTL: just left of it), well clear of the count',
    place.gapToName >= 0 && place.gapToName <= 10 && place.gapToCount > 40 && place.sameLine, JSON.stringify(place))
  await ctx.close()
}

{
  // A set heavier than anything on record: the full celebration
  // («كاملة بالقصاصات»), then its trophy lands on the row, which wears
  // gold — the weight, and a trophy where its check would be.
  const { ctx, page, errors } = await open({ sessions: RAISE_SESSIONS })
  await page.waitForTimeout(300)
  await page.evaluate(() => { window.__vibes = []; window.__sounds = []; window.__anims = [] })
  await completeBtn(page).click()          // 77.5, over the 75 on record
  const tapAt = Date.now()
  await page.waitForTimeout(450)
  const moment = page.getByTestId('pr-moment')
  const said = await moment.innerText().catch(() => '')
  ok('record: the moment fires on the tap — «رقم قياسي جديد»', await moment.count() === 1 && /رقم قياسي جديد/.test(said), said)
  const sub = await page.evaluate(() => {
    const b = document.querySelector('.pr-sub bdi')
    return b && { dir: b.getAttribute('dir'), text: b.textContent, line: document.querySelector('.pr-sub').textContent.replace(/\s+/g, ' ') }
  })
  ok('record: «+2.5 كجم فوق أعلى وزن قبل», the sign held before the number in a <bdi dir=ltr>',
    sub?.dir === 'ltr' && sub.text === '+2.5' && /^\+2\.5 كجم فوق أعلى وزن قبل$/.test(sub.line), JSON.stringify(sub))
  ok('record: the phone buzzes twice, in the tap', JSON.stringify(await page.evaluate(() => window.__vibes)) === '[[12,70,28]]',
    JSON.stringify(await page.evaluate(() => window.__vibes)))
  const prSounds = await page.evaluate(() => window.__sounds.filter(s => !s.stopped && /set-done|pr/.test(s.name)))
  ok('record: the set sound, then the record sound a third of a second later',
    prSounds.map(s => s.name).join(',') === 'set-done,pr' && Math.abs(prSounds[1].at - 0.35) < 0.2, JSON.stringify(prSounds))
  ok('record: the rest is already counting underneath', await page.getByTestId('rest-bar').count() === 1)
  ok('record: the row\'s trophy waits, hidden, for the one flying in',
    await page.locator('.s-trow[data-state="done"] .s-pr-icon').getAttribute('data-hold') === '1')
  await page.waitForTimeout(300)
  const show = await page.evaluate(() => {
    const c = document.querySelector('.pr-conf')
    let gold = 0
    try {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
      for (let i = 0; i < d.length; i += 4 * 5) if (d[i + 3] > 0 && d[i] > 200 && d[i + 1] > 150) gold++
    } catch {}
    return { gold, shock: window.__anims.some(a => /pr-shock/.test(a.cls)), trophy: window.__anims.some(a => /pr-tro/.test(a.cls) && /rotate\(-10deg\)/.test(a.kf)),
      number: document.querySelector('.pr-num')?.textContent }
  })
  ok('record: the gold shock ring and the trophy dropping in on a spring', show.shock && show.trophy, JSON.stringify(show))
  ok('record: gold confetti, on its own canvas', show.gold > 30, JSON.stringify(show))
  await page.waitForFunction(() => !document.querySelector('[data-testid="pr-moment"]'), null, { timeout: 5000 }).catch(() => {})
  const landedMs = Date.now() - tapAt
  const landed = await page.evaluate(() => ({
    hold: document.querySelector('.s-trow[data-state="done"] .s-pr-icon')?.getAttribute('data-hold') ?? null,
    flew: window.__anims.some(a => /pr-fly/.test(a.cls) && /translate\(/.test(a.kf)),
    flash: window.__anims.some(a => /s-trow/.test(a.cls) && /backgroundColor/.test(a.kf)),
  }))
  ok('record: ~2.3s on, the trophy flies into the row and lands there', landedMs > 2200 && landedMs < 3800
    && landed.hold === null && landed.flew && landed.flash, JSON.stringify({ landedMs, ...landed }))
  await page.waitForTimeout(200)
  const pr = await page.evaluate(() => {
    const row = document.querySelector('.s-trow[data-state="done"]')
    const icon = row.querySelector('.s-cell-tick .s-pr-icon')
    return { icon: !!icon, tick: !!row.querySelector('.s-tick'), color: icon && getComputedStyle(icon).color,
      kg: getComputedStyle(row.querySelector('.s-cell-kg .k-num')).color, label: row.getAttribute('aria-label') }
  })
  ok('record: the row shows a gold trophy instead of the check', pr.icon && !pr.tick && pr.color === GOLD, JSON.stringify(pr))
  ok('record: its weight is gold', pr.kg === GOLD, JSON.stringify(pr))
  ok('record: and a screen reader hears it, in words', /رقم قياسي/.test(pr.label) && /77\.5 كجم × 12 عدّة/.test(pr.label), pr.label)

  // A second set at a new weight in the same exercise gets the whole moment
  // too (حمزة: «ابا احتفالية وكأس مدام رفعت الوزن الجديد»), measured from
  // the best before today, and its row keeps a trophy beside the first.
  await page.getByRole('button', { name: 'تخطي' }).click()
  await page.waitForTimeout(500)
  await page.getByTestId('weight-input').fill('80')
  await page.evaluate(() => { window.__vibes = []; window.__sounds = []; window.__anims = [] })
  await completeBtn(page).click()
  const lastTapAt = Date.now()
  await page.waitForTimeout(450)
  const again = await page.evaluate(() => ({
    moment: !!document.querySelector('[data-testid="pr-moment"]'),
    sub: document.querySelector('.pr-sub')?.textContent.replace(/\s+/g, ' '),
    vibes: JSON.stringify(window.__vibes),
    sound: window.__sounds.some(s => s.name === 'pr'),
  }))
  ok('record: a second set at a new weight gets the full moment again, from the best before today (+5 over 75)',
    again.moment && /^\+5 كجم فوق أعلى وزن قبل$/.test(again.sub || ''), JSON.stringify(again))
  ok('record: still felt and heard', again.vibes === '[[12,70,28]]' && again.sound, JSON.stringify(again))
  await page.waitForFunction(() => !document.querySelector('[data-testid="pr-moment"]'), null, { timeout: 5000 }).catch(() => {})
  ok('record: both rows wear the trophy', await page.locator('.s-trow[data-state="done"] .s-pr-icon').count() === 2)
  // That was the exercise's last set and its moment held the move: the
  // next exercise comes on the shorter wait after the landing.
  await page.waitForFunction(() => document.querySelector('.s-name-en')?.textContent === 'Pec Deck', null, { timeout: 6000, polling: 50 }).catch(() => {})
  const nextMs = Date.now() - lastTapAt
  ok('record: the moment holds the move on, then the next exercise comes (~2.3s + 1.2s)', nextMs >= 3000 && nextMs <= 4800, `${nextMs}ms`)
  ok('record: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

{
  // A double tap never reaches the session under the moment: the first
  // tap sends the trophy home, the second (still on the moment, or just
  // after it) must not skip the rest that is counting under it. And the
  // second tap of a double tap on «تمّت المجموعة» lands on the moment as
  // it opens — it must not skip it unseen.
  for (const gap of [120, 300]) {
    const { ctx, page, errors } = await open({ sessions: RAISE_SESSIONS })
    await page.waitForTimeout(300)
    await completeBtn(page).click()
    await page.waitForTimeout(700)
    const skip = await centre(page.getByRole('button', { name: 'تخطي' }))
    await page.touchscreen.tap(skip.x, skip.y)
    await page.waitForTimeout(gap)
    await page.touchscreen.tap(skip.x, skip.y)
    await page.waitForTimeout(700)
    const r = await page.evaluate(() => ({ moment: !!document.querySelector('[data-testid="pr-moment"]'),
      rest: !!document.querySelector('[data-testid="rest-bar"]'), timer: !!localStorage.getItem('hf_rest_timer') }))
    ok(`record/double tap ${gap}ms over «تخطي»: the moment goes, the rest stays`, !r.moment && r.rest && r.timer, JSON.stringify(r))
    ok(`record/double tap ${gap}ms: no page errors`, errors.length === 0, errors.join('; '))
    await ctx.close()
  }
  const { ctx, page, errors } = await open({ sessions: RAISE_SESSIONS })
  await page.waitForTimeout(300)
  const btn = await centre(completeBtn(page))
  await page.touchscreen.tap(btn.x, btn.y)
  await page.waitForTimeout(150)
  await page.touchscreen.tap(btn.x, btn.y)
  await page.waitForTimeout(500)
  ok('record/double tap on «تمّت المجموعة»: the moment stays up to be seen',
    await page.getByTestId('pr-moment').count() === 1 && (await activeStored(page)).exercises[0].sets.filter(s => s.done).length === 1)
  ok('record/double tap on «تمّت المجموعة»: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

{
  // ⌄ and back mounts the player again: a second set at a new weight
  // still gets its own moment and trophy.
  const { ctx, page, errors } = await open({ sessions: RAISE_SESSIONS })
  await page.waitForTimeout(300)
  await completeBtn(page).click()
  await page.waitForTimeout(500)
  const first = await page.getByTestId('pr-moment').count()
  await page.waitForFunction(() => !document.querySelector('[data-testid="pr-moment"]'), null, { timeout: 5000 }).catch(() => {})
  await page.getByRole('button', { name: 'تخطي' }).click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'صغّر الجلسة' }).filter({ visible: true }).click()
  await page.waitForTimeout(600)
  await page.getByTestId('live-bar').click()
  await page.locator('[data-testid="session"]').waitFor({ timeout: 4000 }).catch(() => {})
  await page.waitForTimeout(600)
  await page.getByTestId('weight-input').fill('80')
  await completeBtn(page).click()
  await page.waitForTimeout(500)
  ok('record/after ⌄ and back: a second set at a new weight gets the moment again',
    first === 1 && await page.getByTestId('pr-moment').count() === 1)
  await page.waitForFunction(() => !document.querySelector('[data-testid="pr-moment"]'), null, { timeout: 5000 }).catch(() => {})
  ok('record/after ⌄ and back: and both rows wear the trophy', await page.locator('.s-pr-icon').count() === 2)
  ok('record/after ⌄ and back: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

{
  // A tap anywhere skips to the landing.
  const { ctx, page, errors } = await open({ sessions: RAISE_SESSIONS })
  await page.waitForTimeout(300)
  await completeBtn(page).click()
  await page.waitForTimeout(600)
  ok('record/skip: the moment is up', await page.getByTestId('pr-moment').count() === 1)
  await page.mouse.click(195, 300)
  await page.waitForTimeout(500)
  ok('record/skip: one tap lands it at once', await page.getByTestId('pr-moment').count() === 0
    && await page.locator('.s-pr-icon').getAttribute('data-hold') === null)
  ok('record/skip: and that tap did nothing else (the rest still counts)', await page.getByTestId('rest-bar').count() === 1
    && (await activeStored(page)).exercises[0].sets.filter(s => s.done).length === 1)
  ok('record/skip: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

{
  // Reduced motion (the phone's setting): the card fades in with the
  // numbers already there — no confetti, no shock ring, no flight — and
  // the buzz stays.
  const { ctx, page, errors } = await open({ sessions: RAISE_SESSIONS, reduced: true })
  await page.waitForTimeout(300)
  await page.evaluate(() => { window.__vibes = []; window.__anims = [] })
  await completeBtn(page).click()
  await page.waitForTimeout(700)
  const calm = await page.evaluate(() => {
    const c = document.querySelector('.pr-conf')
    let drawn = 0
    try {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
      for (let i = 3; i < d.length; i += 4 * 5) if (d[i] > 0) drawn++
    } catch {}
    return { moment: !!document.querySelector('[data-testid="pr-moment"]'), drawn, number: document.querySelector('.pr-num')?.textContent,
      moving: window.__anims.filter(a => /pr-shock|pr-tro|pr-fly/.test(a.cls)).length, vibes: JSON.stringify(window.__vibes) }
  })
  ok('record/reduced: the card is there, the number already 77.5', calm.moment && calm.number === '77.5', JSON.stringify(calm))
  // The fade-in is on the scrim and the card's parts, and gone once done:
  // an animation left on an element around the scrim would cut its blur
  // off from the session, and the card's text would sit on sharp numbers.
  const around = await page.evaluate(() => ({
    root: document.querySelector('.pr').getAnimations().length,
    stage: document.querySelector('.pr-stage').getAnimations().length,
    scrim: document.querySelector('.pr-scrim').getAnimations().length,
    blur: getComputedStyle(document.querySelector('.pr-scrim')).backdropFilter,
  }))
  ok('record/reduced: nothing left animating around the blurred scrim', around.root === 0 && around.stage === 0 && around.scrim === 0
    && /blur\(10px\)/.test(around.blur), JSON.stringify(around))
  ok('record/reduced: no confetti, no shock ring, no trophy spring', calm.drawn === 0 && calm.moving === 0, JSON.stringify(calm))
  ok('record/reduced: the buzz stays', calm.vibes === '[[12,70,28]]', calm.vibes)
  await page.waitForFunction(() => !document.querySelector('[data-testid="pr-moment"]'), null, { timeout: 4000 }).catch(() => {})
  ok('record/reduced: it fades away and the row keeps the trophy', await page.getByTestId('pr-moment').count() === 0
    && await page.locator('.s-pr-icon').count() === 1 && await page.locator('.s-pr-icon').getAttribute('data-hold') === null)
  ok('record/reduced: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

{
  // The same history in a deload week: the advice is silenced at its source.
  const { ctx, page, errors } = await open({ sessions: RAISE_SESSIONS, active: { ...ACTIVE, deload: { pct: 40 } } })
  await page.waitForTimeout(300)
  ok('raise/deload: no ring', await page.locator('[data-testid="raise-ring"]').count() === 0)
  ok('raise/deload: the weight is not raised', await page.getByTestId('weight-input').inputValue() === '75')
  await page.getByTestId('weight-input').fill('85')
  await completeBtn(page).click()
  await page.waitForTimeout(500)
  ok('record/deload: no record in a deload week, even over the old best',
    await page.getByTestId('pr-moment').count() === 0 && await page.locator('.s-pr-icon').count() === 0)
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
  const calm = await page.evaluate(() => ({
    roll: !!document.querySelector('.s-field-roll'),
    breathe: document.querySelector('[data-testid="raise-ring"]').getAttribute('data-state'),
    color: getComputedStyle(document.querySelector('[data-testid="weight-input"]')).color,
  }))
  ok('raise/reduced: gold from the first frame — no roll, no breathing', !calm.roll && calm.breathe === 'still' && calm.color === GOLD, JSON.stringify(calm))
  ok('raise/reduced: no page errors', errors.length === 0)
  await ctx.close()
}

{
  // The «raise» sound is not motion: under reduced motion it still plays,
  // once, when the exercise comes on. (The raise exercise second, so a tap
  // has unlocked the audio by the time it shows.)
  const active = { ...ACTIVE, exercises: [ACTIVE.exercises[1], ACTIVE.exercises[0], ACTIVE.exercises[2]] }
  for (const reduced of [true, false]) {
    const { ctx, page, errors } = await open({ sessions: RAISE_SESSIONS, active, reduced })
    await page.getByTestId('session-title').click()
    await page.waitForTimeout(300)
    await page.evaluate(() => { window.__sounds = [] })
    await page.getByRole('button', { name: /Hammer Strength/ }).last().click()
    await page.waitForTimeout(1500)
    const sounds = await page.evaluate(() => window.__sounds.filter(s => s.name === 'raise').length)
    ok(`raise/${reduced ? 'reduced' : 'full'}: the «raise» sound plays once as the exercise comes on`, sounds === 1, String(sounds))
    ok(`raise/${reduced ? 'reduced' : 'full'} sound: no page errors`, errors.length === 0, errors.join('; '))
    await ctx.close()
  }
}

// ══ 6b. A swapped-in machine due a raise gets its own ═══════════
// Both the hammer press (75) and its alternative, the chest press (60),
// are due a raise. Swapped from ⋯ before the first set, the chest press
// is offered 62.5 on the number, with its ring — as when the session
// starts on it — not just in the coach line.
{
  const day = (n, name, w) => ({
    id: n, date: new Date(2026, 8, n, 18).toISOString(), duration: 40,
    exercises: [{ id: 'x' + n, muscle: 'Chest', name, sets: [[w, 15], [w, 15], [w, 14]].map(([w, r]) => ({ weight: String(w), reps: String(r), done: true })) }],
  })
  const H = 'Hammer Strength Machine Bench Press', C = 'Chest Press Machine'
  const SESS = [day(1, H, 75), day(2, C, 60), day(3, H, 75), day(4, C, 60), day(5, H, 75), day(6, C, 60)]
  const ACT = {
    id: Date.now() - 60000, date: new Date().toISOString(), name: 'Push',
    exercises: [{ id: 'a', muscle: 'Chest', name: H, sets: [{ weight: '75', reps: '12', done: false }, { weight: '75', reps: '12', done: false }] }],
  }
  const { ctx, page, errors } = await open({ sessions: SESS, active: ACT })
  await page.waitForTimeout(2600)
  const v0 = await inputs(page)
  await page.getByRole('button', { name: 'خيارات التمرين' }).click()
  await page.waitForTimeout(500)
  await page.locator('.k-sheet').last().getByRole('button', { name: /استبدال التمرين/ }).click()
  await page.waitForTimeout(700)
  // The swap sheet: his own machine (he has a weight on it) comes first.
  const firstAlt = await page.locator('[data-testid="swap-sheet"] [data-testid="alt-card"]').first().getAttribute('data-name')
  ok('swap raise: the machine he has used is the first picture offered', firstAlt === C, String(firstAlt))
  await page.locator(`[data-testid="swap-sheet"] [data-testid="alt-card"][data-name="${C}"]`).click()
  await page.waitForTimeout(300)
  await page.locator('[data-testid="swap-once"]').click()
  await page.waitForTimeout(2600)
  const v1 = await inputs(page)
  const ring = await page.locator('.s-field[data-raise="1"]').count()
  const st = await activeStored(page)
  ok('swap raise: the hammer press opens raised to 77.5', v0[0] === '77.5', JSON.stringify(v0))
  ok('swap raise: the chest press swapped in is raised to 62.5 on the number, ring and all',
    st.exercises[0].name === C && v1[0] === '62.5' && ring === 1 && st.exercises[0].sets.every(s => s.weight === '62.5'),
    `${JSON.stringify(v1)} ring=${ring} ${JSON.stringify(st.exercises[0].sets)}`)
  ok('swap raise: «خلّها 60» is there for it', await page.getByRole('button', { name: /خلّها\s*60/ }).count() === 1)
  ok('swap raise: no page errors', errors.length === 0, errors.join('; '))
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

// ══ 7b. A level crossed in a thrown-away session is forgotten ══
// 4125 XP is level 3 (4 starts at 4200). Eight sets take it to 4205 and
// hold «مستوى جديد · 4» for the summary; throwing the session away gives
// the XP back — and the level with it. A short session after that (60 XP,
// 4185) is still level 3: its summary claims no new level, and «تم» goes
// home without the level-up screen.
{
  const EIGHT = {
    id: Date.now() - 5 * 60000, date: new Date().toISOString(), name: 'Legs',
    exercises: [{ id: 'p', muscle: 'Legs', name: 'Leg Press', sets: Array.from({ length: 8 }, () => ({ weight: '40', reps: '12', done: false })) }],
  }
  // (sessions: [] seeds every achievement as earned, so none adds XP here)
  const { ctx, page, errors } = await open({ active: EIGHT, xp: 4125, sessions: [] })
  const xpNow = () => page.evaluate(() => JSON.parse(localStorage.getItem('hf_xp')))
  for (let i = 0; i < 8; i++) {
    await completeBtn(page).click()
    await page.waitForTimeout(600)
    await page.getByRole('button', { name: 'تخطي' }).click({ timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(450)
  }
  const x1 = await xpNow()
  await page.getByRole('button', { name: 'خيارات التمرين' }).click()
  await page.waitForTimeout(500)
  await page.locator('.k-sheet').last().getByRole('button', { name: /إلغاء التمرين/ }).click()
  await page.waitForTimeout(500)
  await page.locator('.k-sheet').last().getByRole('button', { name: 'احذف الجلسة' }).click()
  await page.waitForTimeout(900)
  const x2 = await xpNow()
  ok('level: the thrown-away session took its XP back', x1 === 4205 && x2 === 4125, `${x1} → ${x2}`)
  // A new, short session from Home, without a reload.
  await page.getByRole('button', { name: 'ابدأ التمرين' }).first().click()
  await page.waitForTimeout(900)
  await page.getByRole('button', { name: 'أضف أول تمرين' }).click()
  await page.waitForTimeout(700)
  await page.getByText('Cable Fly', { exact: true }).click()
  await page.waitForTimeout(300)
  await page.locator('.k-sheet button').filter({ hasText: /أضف/ }).last().click()
  await page.waitForTimeout(900)
  await completeBtn(page).click()
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: 'تخطي' }).click({ timeout: 2000 }).catch(() => {})
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /^إنهاء$/ }).click()
  await page.waitForTimeout(500)
  await page.locator('.k-sheet').last().getByRole('button', { name: 'احفظ وأنهِ' }).click()
  await page.getByTestId('session-summary').waitFor({ timeout: 4000 }).catch(() => {})
  await page.waitForTimeout(3500)
  const x3 = await xpNow()
  const sum = await page.getByTestId('session-summary').innerText().catch(() => '')
  ok('level: the next summary claims no level it hasn\'t reached', x3 < 4200 && !/مستوى جديد/.test(sum), `${x3}: ${sum.replace(/\s+/g, ' ').slice(0, 200)}`)
  await page.getByRole('button', { name: /^تم$/ }).click({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(1500)
  ok('level: «تم» goes home, no level-up screen', await page.getByTestId('level-up').count() === 0)
  ok('level: no page errors', errors.length === 0, errors.join('; '))
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

// ══ 8b. The rest card holds still through a tab switch ═════════
// The session docked with a rest running: the floating rest card is its
// own layer in the tab switch, like the tab bar and the live bar, so it
// isn't captured with the old page and faded out with it.
{
  const { ctx, page, errors } = await open()
  await completeBtn(page).click()
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: 'صغّر الجلسة' }).filter({ visible: true }).click()
  await page.waitForTimeout(700)
  await page.evaluate(() => {
    window.__vtNames = null
    new MutationObserver(() => {
      if (window.__vtNames || !document.documentElement.dataset.tabnav) return
      const name = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).viewTransitionName : null }
      window.__vtNames = { card: name('.rt-bar'), live: name('.f-livebar'), tabs: name('.f-tabs') }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-tabnav'] })
  })
  ok('rest card: on screen with the session docked', await page.locator('.rt-bar').count() === 1)
  await page.locator('nav.f-tabs > button').nth(2).click()
  await page.waitForTimeout(700)
  const names = await page.evaluate(() => window.__vtNames)
  ok('rest card: a layer of its own in the tab switch, beside the live bar and the tab bar',
    names?.card === 'rt-bar' && names.live === 'f-livebar' && names.tabs === 'f-tabs', JSON.stringify(names))
  ok('rest card: still there after the switch', await page.locator('.rt-bar').count() === 1)
  ok('rest card: no page errors', errors.length === 0, errors.join('; '))
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
  ok('swap: ⋯ offers the alternatives as pictures, nothing swapped blind', /شوف البدائل بالصور/.test(swapText), swapText)
  await swapRow.click()
  await page.waitForTimeout(700)
  const fly = page.locator('[data-testid="swap-sheet"] [data-testid="alt-card"][data-name="Cable Fly"]')
  const flyText = (await fly.innerText().catch(() => '')).replace(/\s+/g, ' ')
  ok('swap: each choice is a card, Arabic name first, English after', /تفتيح كيبل\s*Cable Fly/.test(flyText), flyText)
  ok('swap: with its picture', await fly.locator('img').count() === 1)
  ok('swap: nothing changes until he picks', (await page.getByTestId('exercise-name').textContent()) === 'تفتيح جهاز (بك دك)')
  await fly.click()
  await page.waitForTimeout(300)
  await page.locator('[data-testid="swap-once"]').click()
  await page.waitForTimeout(600)
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
  // (التقدم's root: .prog — .pv is «خطتي»)
  ok('session: and the other tabs still open', await page.locator('.prog').count() === 1)
  ok('session: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 11. Moving between exercises under reduced motion ══════════
// The phone's «تقليل الحركة»: a quick fade, no slide, no view transition.
{
  const { ctx, page, errors } = await open({ reduced: true })
  await page.evaluate(() => { window.__anims = [] })
  const vt0 = await page.evaluate(() => window.__vt)
  await page.getByRole('button', { name: /Pec Deck/ }).last().click()
  await page.waitForTimeout(400)
  const r = await page.evaluate(() => ({
    name: document.querySelector('.s-name-en')?.textContent, vt: window.__vt,
    slides: window.__anims.filter(a => /translate/.test(a.kf)).length,
    fades: window.__anims.filter(a => /opacity/.test(a.kf) && !/translate/.test(a.kf)).length,
  }))
  ok('handoff/reduced: it moves, with a fade and nothing sliding', r.name === 'Pec Deck' && r.vt === vt0 && r.slides === 0 && r.fades >= 2, JSON.stringify(r))
  ok('handoff/reduced: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 12. Sound never breaks the session ═════════════════════════
// No Web Audio at all; a context that can't decode the files (the rest
// keeps plain tones then); the files unreachable; and the real browser,
// which must decode the format the app picks for it.
for (const [label, opts] of [['no audio', { audio: 'none' }], ['no decoding', { audio: 'nodecode' }],
  ['files unreachable', { audio: 'real', blockSounds: true }], ['real audio', { audio: 'real' }]]) {
  const { ctx, page, errors } = await open({ ...opts, sessions: RAISE_SESSIONS })
  await page.waitForTimeout(300)
  await completeBtn(page).click()          // a record, too: its sound and buzz
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'زد 15 ثانية' }).click({ timeout: 4000 }).catch(() => {})
  await page.waitForTimeout(2600)          // the record lands
  await endRest(page)
  const ready = page.getByTestId('rest-ready')
  await ready.waitFor({ timeout: 4000 }).catch(() => {})
  ok(`sound/${label}: the session runs — set, record, rest, «جاهز»`, await ready.isVisible().catch(() => false)
    && (await activeStored(page)).exercises[0].sets[0].done)
  if (label === 'no decoding') {
    const tones = await page.evaluate(() => window.__tones.map(t => t.f))
    ok('sound/no decoding: the rest falls back to its plain 660/880 tones', tones.slice(0, 4).join(',') === '660,660,660,880', tones.join(','))
  }
  if (label === 'real audio') {
    const dec = await page.evaluate(async () => {
      const out = { pick: document.createElement('audio').canPlayType('audio/mp4; codecs="mp4a.40.2"') ? 'm4a' : 'mp3' }
      for (const ext of ['m4a', 'mp3']) {
        try {
          const ab = await (await fetch(`/sounds/set-done.${ext}`)).arrayBuffer()
          const b = await new OfflineAudioContext(1, 44100, 44100).decodeAudioData(ab)
          out[ext] = Math.round(b.duration * 1000)
        } catch (e) { out[ext] = String(e).slice(0, 60) }
      }
      return out
    })
    ok('sound/real audio: the browser decodes the format the app picks for it', typeof dec[dec.pick] === 'number' && dec[dec.pick] > 50, JSON.stringify(dec))
  }
  ok(`sound/${label}: no page errors`, errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 13. Every set (phase 3): «تمّت المجموعة» becomes the rest ═══
// Every frame from the tap is sampled: the button's copy and the rest
// are both there from the first frame, the panel starts as the button's
// footprint and grows to its full height, the clock starts at the tap,
// and once the copy has gone the panel does not fade in a second time.
const sampleFrames = (page, ms, fn) => page.evaluate(([ms, src]) => {
  const probe = new Function(`return (${src})()`)
  window.__mf = []
  const t0 = performance.now()
  return new Promise(resolve => {
    const tick = () => {
      try { window.__mf.push({ t: Math.round(performance.now() - t0), ...probe() }) } catch (e) { window.__mf.push({ err: String(e) }) }
      if (performance.now() - t0 < ms) requestAnimationFrame(tick)
      else resolve(window.__mf)
    }
    requestAnimationFrame(tick)
  })
}, [ms, fn.toString()])
const clipTop = (clip) => {
  const m = /inset\(\s*(-?[\d.]+)px/.exec(clip || '')
  return m ? parseFloat(m[1]) : (clip === 'none' || !clip ? 0 : NaN)
}
{
  const { ctx, page, errors } = await open()
  await page.evaluate(() => { window.__anims = [] })
  const frames = sampleFrames(page, 1100, () => {
    const ghost = document.querySelector('[data-testid="dock-ghost"]')
    const rest = document.querySelector('.s-rest')
    return {
      btn: !!document.querySelector('[data-testid="complete-set"]'),
      ghost: !!ghost, ghostOp: ghost ? +getComputedStyle(ghost).opacity : null,
      rest: !!rest, clip: rest ? getComputedStyle(rest).clipPath : null, restOp: rest ? +getComputedStyle(rest).opacity : null,
      cssAnim: rest ? getComputedStyle(rest).animationName : null,
      liveOp: (() => { const l = document.querySelector('[data-testid="live-block"]'); return l ? +getComputedStyle(l).opacity : null })(),
      // where the copy's words and check sit, against the copy's own centre
      stack: ghost ? (() => {
        const g = ghost.getBoundingClientRect(), mid = g.left + g.width / 2
        const c = (el) => { const r = el.getBoundingClientRect(); return Math.round(r.left + r.width / 2 - mid) }
        return { display: getComputedStyle(ghost).display, label: c(ghost.querySelector('.s-ghost-label')), ok: c(ghost.querySelector('.s-ghost-ok')) }
      })() : null,
    }
  })
  await page.waitForTimeout(50)
  const tapAt = Date.now()
  await completeBtn(page).click()
  const mf = await frames
  const after = mf.filter(f => !f.btn)
  const first = after[0] || {}
  ok('morph: in the frame the button goes, its copy and the rest panel are both there',
    first.ghost && first.rest && first.ghostOp > 0.9, JSON.stringify(first))
  ok('morph: the panel starts as the button\'s footprint (clipped to its bottom 56pt)',
    clipTop(first.clip) > 30, JSON.stringify(first.clip))
  const grown = after.filter(f => f.t - first.t >= 520)
  ok('morph: and grows into the whole panel (clip gone) within half a second',
    grown.length > 0 && grown.every(f => f.rest && Math.abs(clipTop(f.clip)) < 1), JSON.stringify(grown.slice(0, 2)))
  const rising = after.filter(f => f.t - first.t > 200 && f.t - first.t < 500)
  ok('morph: it grows continuously (the top edge rises through in-between heights)',
    new Set(rising.map(f => Math.round(clipTop(f.clip)))).size >= 3, JSON.stringify(rising.map(f => Math.round(clipTop(f.clip)))))
  ok('morph: the green copy fades as the panel grows, and is gone after',
    after.some(f => f.ghost && f.ghostOp > 0 && f.ghostOp < 0.9) && after.filter(f => f.t - first.t > 600).every(f => !f.ghost),
    JSON.stringify(after.map(f => f.ghostOp)))
  ok('morph: no second fade once the copy has gone (the panel never dips)',
    after.filter(f => f.t - first.t > 300).every(f => f.restOp === 1) && after.every(f => f.cssAnim === 'none'),
    JSON.stringify(after.filter(f => f.restOp !== 1 || f.cssAnim !== 'none').slice(0, 3)))
  ok('morph: never a frame without the button, its copy or the rest', mf.every(f => f.btn || f.ghost || f.rest))
  ok('morph: the copy\'s words and its check are stacked in its centre — the check replaces the words',
    first.stack?.display === 'grid' && Math.abs(first.stack.label) <= 3 && Math.abs(first.stack.ok) <= 3, JSON.stringify(first.stack))
  ok('morph: the next set\'s block is never a hole — it rises from half-seen, at once',
    after.length > 5 && after.every(f => f.liveOp != null && f.liveOp >= 0.45), JSON.stringify(after.slice(0, 6).map(f => [f.t, f.liveOp])))
  const endsAt = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_rest_timer'))?.endsAt)
  ok('morph: the rest\'s clock starts at the tap, not after the motion', Math.abs(endsAt - tapAt - 90000) < 400, String(endsAt - tapAt))
  const parts = await page.evaluate(() => ({
    tint: getComputedStyle(document.querySelector('.s-trow[data-state="done"]')).animationName,
    fresh: document.querySelector('.s-trow[data-state="done"]')?.dataset.fresh,
    live: window.__anims.filter(a => a.testid === 'live-block' && /translateY\(10px\)/.test(a.kf) && !a.delay).length,
    order: ['s-rest-label', 's-rest-time', 's-rest-nudges', 's-rest-bar']
      .map(c => window.__anims.find(a => a.cls.split(' ').includes(c))?.delay ?? null),
    check: window.__anims.some(a => /strokeDashoffset/.test(a.kf) && a.rest),
  }))
  ok('morph: the row just ticked takes its green from the start edge and settles',
    parts.fresh === '1' && /s-row-tint/.test(parts.tint) && /s-row-settle/.test(parts.tint), JSON.stringify(parts))
  ok('morph: the button\'s words give way to a check that draws', parts.check, JSON.stringify(parts))
  ok('morph: the next set\'s block rises into place', parts.live === 1, JSON.stringify(parts))
  ok('morph: the panel\'s parts come in one after another',
    parts.order.every(d => d != null) && parts.order.every((d, i) => i === 0 || d > parts.order[i - 1]), JSON.stringify(parts.order))
  ok('morph: the haptic and the sound still come with the tap',
    JSON.stringify(await page.evaluate(() => window.__vibes)) === '[12]'
    && await page.evaluate(() => window.__sounds.some(s => s.name === 'set-done')))
  ok('morph: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}
{
  // Reduced motion: the two cross-fade — no growing, no rising.
  const { ctx, page, errors } = await open({ reduced: true })
  await page.evaluate(() => { window.__anims = [] })
  await completeBtn(page).click()
  const copy = await page.evaluate(() => {
    const g = document.querySelector('[data-testid="dock-ghost"]')
    return g ? [...g.children].filter(el => getComputedStyle(el).display !== 'none').length : null
  })
  ok('morph/reduced: the fading copy shows its words alone, not «✓ تمّت المجموعة ✓»', copy === 1, String(copy))
  await page.waitForTimeout(700)
  const r = await page.evaluate(() => ({
    clip: window.__anims.filter(a => /clipPath/.test(a.kf)).length,
    moves: window.__anims.filter(a => a.rest && /translate|scale/.test(a.kf)).length,
    fades: window.__anims.filter(a => a.rest && /opacity/.test(a.kf)).length,
    ghost: !!document.querySelector('[data-testid="dock-ghost"]'),
    rest: !!document.querySelector('[data-testid="rest-bar"]'),
  }))
  ok('morph/reduced: a cross-fade, nothing grows or slides', r.clip === 0 && r.moves === 0 && r.fades >= 2 && !r.ghost && r.rest, JSON.stringify(r))
  ok('morph/reduced: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 13b. The last three seconds of the rest ═══════════════════
{
  const { ctx, page, errors } = await open()
  await completeBtn(page).click()
  await page.waitForTimeout(800)
  await page.evaluate(() => {
    const t = JSON.parse(localStorage.getItem('hf_rest_timer'))
    t.endsAt = Date.now() + 4600
    localStorage.setItem('hf_rest_timer', JSON.stringify(t))
    window.__anims = []
  })
  const mf = await sampleFrames(page, 6400, () => {
    const rest = document.querySelector('.s-rest:not(.s-rest-leaving)')
    const leaving = document.querySelector('.s-rest-leaving')
    const ready = document.querySelector('[data-testid="rest-ready"]')
    const bar = document.querySelector('.s-rest-bar i')
    return {
      time: rest?.querySelector('.s-rest-time .k-roll-ghost, .s-rest-time .k-roll')?.textContent ?? null,
      final: rest?.dataset.final ?? null,
      bar: bar ? getComputedStyle(bar).backgroundColor : null,
      track: bar ? getComputedStyle(bar.parentElement).backgroundColor : null,
      rest: !!rest, leaving: !!leaving, ready: !!ready,
    }
  })
  const at = (txt) => mf.filter(f => f.rest && f.time === txt)
  ok('last 3s: not yet at 0:04', at('0:04').length > 0 && at('0:04').every(f => !f.final), JSON.stringify(at('0:04')[0]))
  ok('last 3s: marked at 0:03, 0:02 and 0:01', ['0:03', '0:02', '0:01'].every(t => at(t).length > 0 && at(t).every(f => f.final === '1')),
    JSON.stringify(['0:03', '0:02', '0:01'].map(t => at(t).length)))
  const anims = await page.evaluate(() => ({
    pulse: window.__anims.filter(a => /s-rest-time/.test(a.cls) && /scale\(1\.12\)/.test(a.kf)).length,
    wave: window.__anims.filter(a => /s-rest-wave/.test(a.cls) && /boxShadow/.test(a.kf)).length,
    down: window.__anims.filter(a => /k-roll-s/.test(a.cls) && a.rest && /^\[\{"transform":"translateY\(-50%\)"/.test(a.kf)).length,
  }))
  ok('last 3s: with each of 3, 2 and 1 the number pulses once, and a wave leaves the panel',
    anims.pulse === 3 && anims.wave === 3, JSON.stringify(anims))
  ok('rest: the time rolls down every second', anims.down >= 4, JSON.stringify(anims))
  const rgb = (c) => (c || '').match(/[\d.]+/g)?.map(Number) || []
  const b4 = rgb(at('0:04')[0]?.bar), b1 = rgb(at('0:01').at(-1)?.bar)
  const t4 = rgb(at('0:04')[0]?.track), t1 = rgb(at('0:01').at(-1)?.track)
  ok('last 3s: the bar is the rest blue before, and turns to the green of «جاهز»',
    b4.join() === '59,157,232' && b1[1] > 180 && b1[2] < 120, `${b4} → ${b1}`)
  ok('last 3s: its track takes the tint too, so it shows when the fill is a sliver',
    t4[0] === 59 && t1[0] > 80 && t1[2] < 120, `${t4} → ${t1}`)
  const sounds = await page.evaluate(() => window.__sounds.filter(s => /^rest-/.test(s.name) && !s.stopped).slice(-4))
  ok('last 3s: the library ticks (rescheduled for the new end) land a second apart, the chime after',
    sounds.map(s => s.name).join() === 'rest-tick,rest-tick,rest-tick,rest-end'
    && [1, 2, 3].every(i => Math.abs(sounds[i].at - sounds[i - 1].at - 1) < 0.05), JSON.stringify(sounds))
  const firstReady = mf.findIndex(f => f.ready)
  ok('zero: «جاهز» wipes in over the counted-down panel — never an empty frame',
    firstReady > 0 && mf[firstReady].leaving && mf.slice(firstReady - 1).every(f => f.ready || f.rest), JSON.stringify(mf.slice(firstReady - 1, firstReady + 2)))
  ok('zero: the panel is gone under it within half a second', mf.filter(f => f.t - mf[firstReady].t > 500).every(f => !f.leaving && !f.rest && f.ready))
  await page.evaluate(() => { window.__anims = [] })
  await page.getByTestId('rest-ready').click()
  await page.waitForTimeout(400)
  const back = await page.evaluate(() => window.__anims.some(a => /k-btn/.test(a.cls) && a.rest && /translateY\(8px\)/.test(a.kf)))
  ok('«جاهز»: the button comes back with a short rise', back && await completeBtn(page).count() === 1)
  ok('last 3s: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 13c. + and − roll the numbers ══════════════════════════════
{
  const { ctx, page, errors } = await open()
  const rollIn = (field) => page.evaluate((field) => {
    const o = document.querySelector(`.s-step[data-field="${field}"] .s-field-roll`)
    return o ? { on: !!o.querySelector('.k-roll-on'), shown: o.querySelector('.k-roll-ghost')?.textContent ?? null } : null
  }, field)
  await page.evaluate(() => { window.__anims = [] })
  await page.getByRole('button', { name: 'زد العدّات' }).click()
  const r1 = await rollIn('reps')
  ok('steppers: + on the reps rolls the number up to the new one', r1?.on && r1.shown === '13'
    && await page.evaluate(() => window.__anims.some(a => a.field && /k-roll-s/.test(a.cls) && /^\[\{"transform":"translateY\(0\)"/.test(a.kf))), JSON.stringify(r1))
  await page.waitForTimeout(400)
  ok('steppers: then the input holds it again', await page.locator('.s-field-roll').count() === 0
    && (await inputs(page))[1] === '13')
  await page.evaluate(() => { window.__anims = [] })
  await page.getByRole('button', { name: 'أنقص الوزن' }).click()
  const r2 = await rollIn('weight')
  const down = await page.evaluate(() => window.__anims.filter(a => a.field && /k-roll-s/.test(a.cls)).map(a => ({ kf: a.kf.slice(0, 40), d: a.d })))
  ok('steppers: − on the weight rolls it down, in 160ms', r2?.on && r2.shown === '72.5'
    && down.length > 0 && down.every(a => /translateY\(-50%\)/.test(a.kf) && a.d === 160), JSON.stringify({ r2, down }))
  await page.waitForTimeout(400)
  // Held down: the repeat changes the number without rolling it.
  const b = await page.getByRole('button', { name: 'زد الوزن' }).boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.down()
  const held = await sampleFrames(page, 1400, () => ({
    v: document.querySelector('[data-testid="weight-input"]').value,
    roll: !!document.querySelector('.s-step[data-field="weight"] .s-field-roll'),
  }))
  await page.mouse.up()
  const late = held.filter(f => f.t > 450)
  ok('steppers: held, the repeat changes it without rolling, so it keeps up with the finger',
    new Set(late.map(f => f.v)).size >= 4 && late.every(f => !f.roll), JSON.stringify(late.filter(f => f.roll).slice(0, 2)) + ` ${[...new Set(held.map(f => f.v))]}`)
  ok('steppers: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}
{
  const { ctx, page, errors } = await open({ reduced: true })
  await page.getByRole('button', { name: 'زد العدّات' }).click()
  ok('steppers/reduced: the number simply changes', await page.locator('.s-field-roll').count() === 0 && (await inputs(page))[1] === '13')
  ok('steppers/reduced: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 14. The frame (phase 5): sheets you pull down ══════════════
// A finger on the ⋯ sheet's title row: a short slow pull springs back
// (the sheet still holds the page), a pull past the line closes it, and
// after it the page is free — the same window-level probe as the freeze
// above, and the same overlap that froze it (⋯ leaving as «معلومات
// ونصائح» arrives), closed by a pull this time.
// Probes the sheet at the given fractions of the way (the finger's offset
// then, and where the sheet is drawn).
async function pull(page, ctx, sel, dy, ms, { x = null, probes = [0.5, 1] } = {}) {
  const box = await page.locator(sel).last().boundingBox()
  const px = x ?? box.x + box.width / 2, py = box.y + Math.min(box.height / 2, 24)
  const cdp = await ctx.newCDPSession(page)
  const steps = Math.max(4, Math.round(ms / 16))
  const seen = []
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: px, y: py }] })
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: px, y: py + (dy * i) / steps }] })
    if (probes.some(f => i === Math.round(steps * f))) {
      seen.push(await page.evaluate((finger) => {
        const s = [...document.querySelectorAll('.k-sheet')].at(-1)
        const m = new DOMMatrixReadOnly(getComputedStyle(s).transform === 'none' ? undefined : getComputedStyle(s).transform)
        return { y: m.m42, finger, op: +getComputedStyle(s).opacity, shade: +getComputedStyle(s.parentElement.querySelector('.k-scrim-bg')).opacity }
      }, (dy * i) / steps))
    }
    await page.waitForTimeout(16)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
  return seen
}
const lockState = (page) => page.evaluate(() => ({ overflow: document.body.style.overflow, inert: !!document.getElementById('root')?.inert, sheets: document.querySelectorAll('.k-sheet').length }))
{
  const HIST = Array.from({ length: 24 }, (_, i) => ({ id: 100 + i, date: new Date(2026, 7, 1 + i, 18).toISOString(), duration: 50,
    exercises: [{ id: 'h', muscle: 'Chest', name: 'Pec Deck', sets: [{ weight: '50', reps: '12', done: true }] }] }))
  const { ctx, page, errors } = await open({ sessions: HIST })
  await page.getByRole('button', { name: 'خيارات التمرين' }).click()
  await page.waitForTimeout(700)
  const [a, b] = await pull(page, ctx, '.k-sheet-h', 48, 300)
  await page.waitForTimeout(700)
  let st = await lockState(page)
  // It takes over past the touch slop (Chrome only sends the first move
  // after ~15px), and from there moves with the finger, 1:1, no jump.
  ok('sheet drag: the sheet follows the finger 1:1, opaque, as the shade lightens',
    a && b && Math.abs((b.y - a.y) - (b.finger - a.finger)) < 1.5 && b.finger - b.y >= 0 && b.finger - b.y <= 18
    && b.op === 1 && b.shade < 1, JSON.stringify([a, b]))
  ok('sheet drag: a short slow pull springs back — still open, still holding the page',
    st.sheets === 1 && st.overflow === 'hidden' && st.inert && await page.evaluate(() => getComputedStyle(document.querySelector('.k-sheet')).transform === 'none'), JSON.stringify(st))
  const [up] = await pull(page, ctx, '.k-sheet-h', -200, 300, { probes: [1] })
  await page.waitForTimeout(700)
  ok('sheet drag: pulled up it gives like rubber — a little, never past its limit — and settles back',
    up && up.y < -20 && up.y > -72 && await page.evaluate(() => getComputedStyle(document.querySelector('.k-sheet')).transform === 'none'), JSON.stringify(up))
  await pull(page, ctx, '.k-sheet-h', 260, 220)
  await page.waitForTimeout(600)
  st = await lockState(page)
  ok('sheet drag: a real pull down closes it, and the page is free at once', st.sheets === 0 && st.overflow === '' && !st.inert, JSON.stringify(st))

  // The overlap that once froze the app: ⋯ leaving while «معلومات ونصائح» arrives.
  await page.getByRole('button', { name: 'خيارات التمرين' }).click()
  await page.waitForTimeout(500)
  await page.getByText('معلومات ونصائح').click()
  await page.waitForTimeout(600)
  await pull(page, ctx, '.k-sheet-grab', 320, 200)
  await page.waitForTimeout(600)
  st = await lockState(page)
  ok('sheet drag: after two sheets overlap and the second is pulled away, nothing holds the page', st.sheets === 0 && st.overflow === '' && !st.inert, JSON.stringify(st))
  await page.getByRole('button', { name: 'صغّر الجلسة' }).click()
  await page.waitForTimeout(500)
  await page.locator('nav.f-tabs > button').nth(1).click()
  await page.waitForTimeout(600)
  const y0 = await page.evaluate(() => window.scrollY)
  await page.mouse.wheel(0, 800)
  await page.waitForTimeout(400)
  ok('sheet drag: with the session minimised, History still scrolls', (await page.evaluate(() => window.scrollY)) > y0 + 100)
  ok('sheet drag: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 14a. A form with changes isn't flicked away ════════════════
// «تعديل الجلسة» in History: once a weight is changed, the flick down on
// its list (the way back to the top) scrolls, it never closes the sheet
// and throws the change away. Unchanged, the same flick closes it.
{
  const HIST = [{ id: 1001, date: new Date(2026, 9, 9, 18).toISOString(), duration: 50,
    exercises: ['Pec Deck', 'Cable Fly', 'Machine Shoulder Press', 'Lateral Raise', 'Triceps Pushdown', 'Leg Press'].map((name, i) => ({
      id: 'e' + i, muscle: 'Chest', name, sets: [1, 2, 3, 4].map(() => ({ weight: '50', reps: '12', done: true })) })) }]
  const { ctx, page, errors } = await open({ active: null, sessions: HIST })
  const openEdit = async () => {
    await page.getByRole('button', { name: /خيارات جلسة/ }).first().click()
    await page.waitForTimeout(600)
    await page.getByText('تعديل الجلسة').first().click()
    await page.waitForTimeout(800)
  }
  const flickDown = async () => {
    await page.evaluate(() => { document.querySelector('.k-sheet-body').scrollTop = 0 })
    await page.waitForTimeout(200)
    const body = await page.locator('.k-sheet-body').boundingBox()
    await finger(page, ctx, { x: body.x + 40, y: body.y + 120 }, { dy: 260, steps: 8 })
    await page.waitForTimeout(800)
  }
  await page.locator('nav.f-tabs > button').nth(1).click()
  await page.waitForTimeout(700)
  await openEdit()
  await flickDown()
  ok('edit sheet: unchanged, a flick down on the list closes it as any sheet', await page.locator('.k-sheet').count() === 0)
  await openEdit()
  await page.getByRole('textbox', { name: 'وزن المجموعة 1' }).first().fill('52.5')
  await page.waitForTimeout(200)
  await flickDown()
  ok('edit sheet: with a change, the same flick keeps it open and the change in it',
    await page.locator('.k-sheet').count() === 1
    && await page.getByRole('textbox', { name: 'وزن المجموعة 1' }).first().inputValue() === '52.5')
  await page.locator('.k-sheet').getByRole('button', { name: 'حفظ التعديلات' }).click({ timeout: 2000 }).catch(() => {})
  await page.waitForTimeout(600)
  const w = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_sessions'))[0].exercises[0].sets[0].weight)
  ok('edit sheet: and «حفظ التعديلات» saves it', w === '52.5', String(w))
  ok('edit sheet: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 14b. The tab bar: one capsule that slides; pages that slide ═══
{
  const HIST = Array.from({ length: 6 }, (_, i) => ({ id: 100 + i, date: new Date(2026, 7, 1 + i, 18).toISOString(), duration: 50,
    exercises: [{ id: 'h', muscle: 'Chest', name: 'Pec Deck', sets: [{ weight: '50', reps: '12', done: true }] }] }))
  for (const reduced of [false, true]) {
    const label = reduced ? 'tabs/reduced' : 'tabs'
    const { ctx, page, errors } = await open({ active: null, sessions: HIST, reduced })
    const capsule = () => page.evaluate(() => {
      const p = document.querySelector('.f-tab-pill').getBoundingClientRect()
      const on = document.querySelector('.f-tab.on .f-tab-icon').getBoundingClientRect()
      return { dx: Math.round(p.left - on.left), dy: Math.round(p.top - on.top), w: Math.round(p.width - on.width),
        op: +getComputedStyle(document.querySelector('.f-tab-pill')).opacity,
        bgs: [...document.querySelectorAll('.f-tab-icon')].filter(i => getComputedStyle(i).backgroundColor !== 'rgba(0, 0, 0, 0)').length }
    })
    const c0 = await capsule()
    ok(`${label}: one capsule, under the current tab's icon`, c0.dx === 0 && c0.dy === 0 && c0.w === 0 && c0.op === 1 && c0.bgs === 0, JSON.stringify(c0))
    await page.evaluate(() => { window.__anims = [] })
    const vt0 = await page.evaluate(() => window.__vt)
    await page.locator('nav.f-tabs > button').nth(3).click()
    const during = await page.evaluate(() => document.documentElement.dataset.tabnav ?? null)
    await page.waitForTimeout(700)
    const c1 = await capsule()
    const r = await page.evaluate(() => ({
      vt: window.__vt, attr: document.documentElement.dataset.tabnav ?? null,
      slide: window.__anims.filter(a => /f-tab-pill/.test(a.cls) && /translate/.test(a.kf)).length,
      swell: window.__anims.filter(a => /scale\(1\.14\)/.test(a.kf)).length,
      main: getComputedStyle(document.querySelector('main')).transform, mainStyle: document.querySelector('main').getAttribute('style'),
    }))
    ok(`${label}: the capsule lands under the tapped tab`, c1.dx === 0 && c1.dy === 0 && c1.op === 1, JSON.stringify(c1))
    // A rotation and back (a width change) leaves it under the same tab.
    const vp = page.viewportSize()
    await page.setViewportSize({ width: vp.height, height: vp.width })
    await page.waitForTimeout(400)
    const cWide = await capsule()
    await page.setViewportSize(vp)
    await page.waitForTimeout(400)
    const cBack = await capsule()
    ok(`${label}: after a rotation and back, the capsule is still under the current tab`,
      [cWide, cBack].every(c => c.dx === 0 && c.dy === 0 && c.w === 0 && c.op === 1), JSON.stringify({ cWide, cBack }))
    if (!reduced) {
      ok('tabs: the capsule slides there and the icon swells once', r.slide === 1 && r.swell === 1, JSON.stringify(r))
      ok('tabs: the page changes as a view transition, entering from the tab\'s side', r.vt === vt0 + 1 && during === 'fwd', JSON.stringify({ ...r, during }))
    } else {
      ok('tabs/reduced: no slide, no swell, no view transition', r.slide === 0 && r.swell === 0 && r.vt === vt0, JSON.stringify(r))
    }
    ok(`${label}: nothing is left on <main> (no transform to trap a fixed sheet), and it tidies up`,
      r.main === 'none' && !r.mainStyle && r.attr === null, JSON.stringify(r))
    await page.locator('nav.f-tabs > button').nth(0).click()
    await page.waitForTimeout(700)
    ok(`${label}: back home, the capsule follows`, JSON.stringify(await capsule()).startsWith('{"dx":0,"dy":0,"w":0,"op":1'))
    ok(`${label}: no page errors`, errors.length === 0, errors.join('; '))
    await ctx.close()
  }
}

// ══ 14c. Pictures come in softly ══════════════════════════════
// The muscle art held back 700ms: its place waits with a faint light,
// then it fades in; the same picture again (already in the phone) is
// simply there.
{
  const ctx = await browser.newContext({ serviceWorkers: 'block', // the worker has its own suites (offline, pack-install); here it would serve past page.route
    ...devices['iPhone 13'], locale: 'ar', timezoneId: 'Asia/Riyadh' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  await page.route(u => u.pathname.startsWith('/pack/'), r => r.abort())
  await page.route('**/assets/muscle_chest*', async r => { await new Promise(res => setTimeout(res, 700)); await r.continue() })
  await page.addInitScript(instruments, 'fake')
  await page.addInitScript(([active, version]) => {
    localStorage.setItem('hf_profile', JSON.stringify({ name: 'حمزة' }))
    localStorage.setItem('hf_pack_prompted', '1')
    localStorage.setItem('hf_seen_version', JSON.stringify(version))
    localStorage.setItem('hf_onboarded', 'true')
    localStorage.setItem('hf_weights_reset_v2', 'true')
    localStorage.setItem('hf_active', JSON.stringify(active))
  }, [ACTIVE, APP_VERSION])
  await page.goto(APP, { waitUntil: 'domcontentloaded' })
  await page.locator('.s-stage img').first().waitFor({ timeout: 8000 })
  // The light comes on once the picture is clearly not quick (120ms).
  await page.waitForFunction(() => document.querySelector('.s-stage img')?.dataset.wait === '1', null, { timeout: 500 }).catch(() => {})
  const waiting = await page.evaluate(() => {
    const i = document.querySelector('.s-stage img')
    return { wait: i.dataset.wait ?? null, anim: getComputedStyle(i).animationName, bg: getComputedStyle(i).backgroundImage.slice(0, 15) }
  })
  ok('media: on its way, the picture\'s place carries a faint light', waiting.wait === '1' && waiting.anim === 'k-wait' && /gradient/.test(waiting.bg), JSON.stringify(waiting))
  await page.waitForFunction(() => { const i = document.querySelector('.s-stage img'); return i && !i.dataset.wait }, null, { timeout: 4000 }).catch(() => {})
  const came = await page.evaluate(() => ({
    wait: document.querySelector('.s-stage img').dataset.wait ?? null,
    fade: window.__anims.filter(a => /s-stage-img/.test(a.cls) && /"opacity":0/.test(a.kf) && a.d === 200).length,
  }))
  ok('media: when it arrives the light goes and it fades in (200ms) instead of popping', came.wait === null && came.fade === 1, JSON.stringify(came))
  ok('media: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}
{
  // The next exercise (Pec Deck) shows the same chest art, already in the
  // phone. (No routes here: Playwright turns the browser's caches off
  // while any route is set.)
  const ctx = await browser.newContext({ serviceWorkers: 'block', // the worker has its own suites (offline, pack-install); here it would serve past page.route
    ...devices['iPhone 13'], locale: 'ar', timezoneId: 'Asia/Riyadh' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  await page.addInitScript(instruments, 'fake')
  await page.addInitScript(([active, version]) => {
    localStorage.setItem('hf_profile', JSON.stringify({ name: 'حمزة' }))
    localStorage.setItem('hf_pack_prompted', '1')
    localStorage.setItem('hf_seen_version', JSON.stringify(version))
    localStorage.setItem('hf_onboarded', 'true')
    localStorage.setItem('hf_weights_reset_v2', 'true')
    localStorage.setItem('hf_active', JSON.stringify(active))
  }, [ACTIVE, APP_VERSION])
  await page.goto(APP, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => { const i = document.querySelector('.s-stage img'); return i && i.complete && !i.dataset.wait }, null, { timeout: 6000 }).catch(() => {})
  await page.evaluate(() => { window.__anims = [] })
  const first = page.evaluate(() => new Promise(resolve => {
    const seen = []
    const tick = () => {
      const i = document.querySelector('.s-stage img')
      if (i && /Pec Deck/.test(document.querySelector('.s-name-en')?.textContent || '')) seen.push(i.dataset.wait ?? null)
      if (seen.length < 4) requestAnimationFrame(tick); else resolve(seen)
    }
    requestAnimationFrame(tick)
  }))
  await page.getByRole('button', { name: /Pec Deck/ }).last().click()
  const frames = await first
  await page.waitForTimeout(500)
  const fade = await page.evaluate(() => window.__anims.filter(a => /s-stage-img/.test(a.cls) && a.d === 200).length)
  ok('media: a picture already in the phone is simply there — no light, no fade', frames.every(w => w === null) && fade === 0, JSON.stringify({ frames, fade }))
  ok('media (cached): no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ 15. The end of a workout: medals that spin, numbers that count ══
// (motion phases 2 and 4). A lifter whose best was 95kg puts up 140kg:
// «أول 100 كجم» (common) and «140 كجم» (rare) are earned in one go.
// The medal stage is WebGL; a headless browser may have it (SwiftShader)
// or not, so every check below holds either way — the 3D stage or the
// flat medal turning — and one run forces each fallback.
const MEDAL_DAY = (n, w) => ({
  id: 500 + n, date: new Date(2026, 8, n, 18).toISOString(), duration: 45,
  exercises: [{ id: 'm', muscle: 'Chest', name: 'Bench Press',
    sets: [{ weight: String(w), reps: '10', done: true }, { weight: String(w), reps: '10', done: true }] }],
})
const MEDAL_HISTORY = [MEDAL_DAY(2, 90), MEDAL_DAY(4, 95)]
const HEAVY = {
  ...ACTIVE,
  exercises: [
    { id: 'a', muscle: 'Chest', name: 'Bench Press',
      sets: [{ weight: '140', reps: '5', done: true }, { weight: '140', reps: '5', done: true }] },
    { id: 'b', muscle: 'Shoulders', name: 'Machine Shoulder Press', sets: [{ weight: '40', reps: '12', done: true }] },
  ],
}
const allBut = (...ids) => ACHIEVEMENTS.map(a => a.id).filter(id => !ids.includes(id))
const finishNow = async (page) => {
  await page.getByRole('button', { name: /^إنهاء$/ }).click()
  await page.waitForTimeout(400)
  await page.locator('.k-sheet').last().getByRole('button', { name: 'احفظ وأنهِ' }).click()
}
const reveal = (page) => page.evaluate(() => {
  const e = document.querySelector('[data-testid="medal-reveal"]')
  if (!e) return null
  return {
    ...e.dataset, canvas: !!e.querySelector('canvas'), flat: e.querySelectorAll('.mr-flat .md').length,
    broken: [...e.querySelectorAll('img')].filter(i => i.complete && !i.naturalWidth).length,
  }
})
const waitLanded = (page, ms = 12000) => page.waitForFunction(
  () => document.querySelector('[data-testid="medal-reveal"]')?.dataset.state === 'landed', null, { timeout: ms }).catch(() => {})
const medalSounds = (page) => page.evaluate(() => window.__sounds.filter(s => /^medal/.test(s.name) && !s.stopped).map(s => s.name))
const setsShown = (page) => page.evaluate(() => document.querySelector('.sum-stats span:nth-child(2) b')?.textContent.trim())
// The summary's timeline (ms from its opening), from the app's own marks:
// the medals' beat, the first frame a medal is drawn (3D) or the flat
// medal setting off, each landing, and the level line's beat.
const timeline = (page) => page.evaluate(() => {
  const all = performance.getEntriesByType('mark').filter(m => m.name.startsWith('meran:'))
  const t0 = all.filter(m => m.name === 'meran:sum:open').pop()?.startTime
  if (t0 == null) return null
  const at = (n) => { const m = all.find(x => x.name === `meran:${n}` && x.startTime >= t0); return m ? Math.round(m.startTime - t0) : null }
  const r = { go: at('sum:medal-go'), drawn: at('m3:frame:0'), flat: at('medal:play-flat'), late: at('medal:late'), xp: at('sum:xp-beat'),
    land0: at('m3:land:0') ?? at('flat:land:0'), land1: at('m3:land:1') ?? at('flat:land:1') }
  // the flat medal is on screen the frame after it sets off (its turn starts from opacity 0)
  r.seen = r.drawn ?? (r.flat != null ? r.flat + 17 : null)
  return r
})

{
  const { ctx, page, errors } = await open({ sessions: MEDAL_HISTORY, active: HEAVY, unlocked: allBut('b1', 'b2'), perf: true })
  const chunks = []
  page.on('request', r => { if (/medal3d/.test(r.url())) chunks.push(r.url()) })
  await page.evaluate(() => { window.__sounds = []; window.__vibes = [] })
  await finishNow(page)
  await page.getByTestId('session-summary').waitFor({ timeout: 4000 }).catch(() => {})
  const early = await setsShown(page)
  await page.waitForSelector('[data-testid="medal-reveal"]', { timeout: 3000 }).catch(() => {})
  const order = await page.evaluate(() => [...(document.querySelector('.sum-body')?.children || [])]
    .map(e => e.classList.contains('sum-stats') ? 'stats' : e.classList.contains('sum-ach-sec') ? 'medals' : e.tagName.toLowerCase()))
  ok('summary medals: «إنجازات جديدة» sits right under the numbers', order.indexOf('medals') === order.indexOf('stats') + 1, order.join(','))
  const r0 = await reveal(page)
  ok('summary medals: the rarer one first — «140 كجم» (نادر), then «أول 100 كجم»', r0?.order === 'b2,b1', JSON.stringify(r0))
  const text = await page.getByTestId('session-summary').innerText()
  ok('summary medals: both titles are in the text, however they are drawn', /140 كجم/.test(text) && /أول 100 كجم/.test(text), text.slice(0, 160))
  ok('summary medals: «تم» is there from the first moment', await page.getByRole('button', { name: 'تم' }).count() === 1)
  ok('summary count: the sets start from zero', early === '0', String(early))
  await waitLanded(page)
  const r1 = await reveal(page)
  ok('summary count: and land on the number done', await setsShown(page) === '3', String(await setsShown(page)))
  ok('summary medals: the medal module arrives as its own chunk', chunks.length >= 1, String(chunks.length))
  ok('summary medals: both land', r1?.state === 'landed', JSON.stringify(r1))
  // On time: the stage was built while «إنهاء» was asked, so the medal sets
  // off on its own beat, right behind the numbers, and is on screen within
  // a second — it never waits for the lines under it, the level's least of all.
  const tl = await timeline(page)
  ok('summary medals: the first medal is on screen within a second of the summary opening', tl?.seen != null && tl.seen < 1000, JSON.stringify(tl))
  ok('summary medals: it sets off on its own beat (~0.7 s), not after the level line', tl?.go != null && tl.go < 900 && (tl.xp == null || tl.go < tl.xp), JSON.stringify(tl))
  ok('summary medals: the 3D stage was ready for the beat (built ahead)', r1?.mode === 'gl' ? tl?.late == null : true, JSON.stringify(tl))
  ok('summary medals: one, then the other, about a second apart', tl?.land0 != null && tl.land1 - tl.land0 > 600 && tl.land1 - tl.land0 < 1700, JSON.stringify(tl))
  ok(`summary medals: drawn (${r1?.mode}) — the 3D stage, or the flat medal — never a broken image`,
    ((r1?.mode === 'gl' && r1.canvas) || (r1?.mode === 'flat' && r1.flat === 2)) && r1.broken === 0, JSON.stringify(r1))
  const sounds = await medalSounds(page)
  ok('summary medals: each landing has its sound — the bell for the rare one, then the clink', sounds.join(',') === 'medal-heavy,medal', sounds.join(','))
  const buzz = await page.evaluate(() => window.__vibes.filter(v => v === 14).length)
  ok('summary medals: and its buzz', buzz === 2, String(buzz))
  // A tap on a landed medal turns it again — it is not the summary's tap-to-skip.
  const box = await page.locator('[data-testid="medal-reveal"] .mr-stage').boundingBox()
  if (r1?.mode === 'gl' && box) {
    const U = Math.min(98, box.width * 0.25, box.height * 0.29)
    await page.mouse.click(box.x + box.width / 2 + U, box.y + box.height * 0.41 + 0.16 * U)
    await page.waitForTimeout(300)
    ok('summary medals: a tap on a medal spins it, the summary stays as it is', await page.locator('.sum.sum-skip').count() === 0)
  }
  // Today's picture heads the summary (summaryArt.js), from the pack's stills.
  await page.waitForFunction(() => document.querySelector('.sum-art img')?.complete, null, { timeout: 5000 }).catch(() => {})
  const pic = await page.evaluate(() => {
    const i = document.querySelector('.sum-art img')
    return i && { id: i.dataset.art, w: i.naturalWidth, first: i.closest('.sum-body').firstElementChild === i.parentElement,
      kept: JSON.parse(localStorage.getItem('meran_summary_art') || 'null') }
  })
  ok('summary art: today\'s picture heads the summary, and is remembered for the day',
    /^summary_\d+$/.test(pic?.id || '') && pic.w > 0 && pic.first && pic.kept?.id === pic.id, JSON.stringify(pic))
  await page.getByRole('button', { name: 'تم' }).click()
  await page.waitForTimeout(700)
  const done = await page.evaluate(() => {
    const i = document.querySelector('.hm-stage-done img.hm-art-done')
    const st = document.querySelector('.hm-stage-done')?.getBoundingClientRect()
    const r = i?.getBoundingClientRect()
    return i && { w: i.naturalWidth, inside: !!st && r.left >= st.left && r.right <= st.right && r.top >= st.top && r.bottom <= st.bottom + 1 && r.right <= innerWidth }
  })
  ok('home done: the resting figure stands in the stage, whole and inside the screen', done?.w > 0 && done.inside, JSON.stringify(done))
  const gl = await page.evaluate(() => ({ ...window.__gl, left: document.querySelectorAll('[data-testid="medal-reveal"]').length }))
  ok('summary medals: closing gives the GL context back', gl.left === 0 && gl.lost >= gl.made, JSON.stringify(gl))
  ok('summary medals: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// A short phone (320×568): the medal stage pushes «أعلى وزن», the streak
// and the level out of view. Their moments wait to be seen instead of
// playing unseen, the medals don't wait for them, and scrolling down
// plays each one as it comes into view.
{
  const { ctx, page, errors } = await open({ sessions: MEDAL_HISTORY, active: HEAVY, unlocked: allBut('b1', 'b2'),
    device: 'iPhone SE', viewport: { width: 320, height: 568 } })
  await finishNow(page)
  await page.getByTestId('session-summary').waitFor({ timeout: 4000 }).catch(() => {})
  const t = Date.now()
  await page.waitForFunction(() => /playing|landed/.test(document.querySelector('[data-testid="medal-reveal"]')?.dataset.state || ''),
    null, { timeout: 4000, polling: 50 }).catch(() => {})
  const medalsAt = Date.now() - t
  await page.waitForTimeout(Math.max(0, 2600 - (Date.now() - t)))
  const lines = () => page.evaluate(() => {
    const sc = document.querySelector('.sum'), foot = document.querySelector('.sum-foot').getBoundingClientRect()
    return [...document.querySelectorAll('.sum-sec:not(.sum-ach-sec)')].map(el => {
      const r = el.getBoundingClientRect()
      return { go: el.dataset.go || null, seen: r.top >= sc.getBoundingClientRect().top && r.bottom <= foot.top + 1,
        text: el.innerText.replace(/\s+/g, ' ').slice(0, 60) }
    })
  })
  const before = await lines()
  ok('summary 320: the lines pushed out of view hold their moments', before.length === 3 && before.every(l => l.seen || !l.go), JSON.stringify(before))
  ok('summary 320: the hidden streak still shows where it stood, the level its +0',
    /0 ← 0/.test(before[1].text) && /\+0 XP/.test(before[2].text), JSON.stringify(before.map(l => l.text)))
  ok('summary 320: the medals start without waiting for lines nobody can see', medalsAt < 1300, `${medalsAt}ms`)
  await page.evaluate(() => { const sc = document.querySelector('.sum'); sc.scrollTop = sc.scrollHeight })
  await page.waitForTimeout(1800)
  const after = await lines()
  ok('summary 320: scrolled into view, each one plays — the new best, the streak, the level',
    after.every(l => l.go === '1') && /140/.test(after[0].text) && /0 ← 1/.test(after[1].text) && !/\+0 XP/.test(after[2].text),
    JSON.stringify(after))
  ok('summary 320: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// A tall phone (390×1400): every line is in view from the start. The
// medals still set off on their own beat, not after the level line, and
// the lines under them play on theirs meanwhile.
{
  const { ctx, page, errors } = await open({ sessions: MEDAL_HISTORY, active: HEAVY, unlocked: allBut('b1', 'b2'), perf: true,
    viewport: { width: 390, height: 1400 } })
  await finishNow(page)
  await page.getByTestId('session-summary').waitFor({ timeout: 4000 }).catch(() => {})
  await page.waitForTimeout(2600)
  const lines = await page.evaluate(() => [...document.querySelectorAll('.sum-sec:not(.sum-ach-sec)')].map(el => el.dataset.go || null))
  await waitLanded(page)
  const tl = await timeline(page)
  ok('summary tall: every line under the medals has played by 2.6 s', lines.length === 3 && lines.every(g => g === '1'), JSON.stringify(lines))
  ok('summary tall: the medals set off before the level line\'s beat, never after it', tl?.go != null && tl.xp != null && tl.go < tl.xp && tl.go < 900, JSON.stringify(tl))
  ok('summary tall: the first medal is on screen within a second', tl?.seen != null && tl.seen < 1000, JSON.stringify(tl))
  ok('summary tall: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// The 3D stage not ready on the beat (its module held up for 2.5 s): the
// flat medals set off on time instead of waiting, land with their sounds,
// and the 3D stage, when it comes, is let go — its context with it.
{
  const slow = { url: '**/assets/medal3d-*.js', handler: async (r) => { await new Promise(res => setTimeout(res, 2500)); r.continue().catch(() => {}) } }
  const { ctx, page, errors } = await open({ sessions: MEDAL_HISTORY, active: HEAVY, unlocked: allBut('b1', 'b2'), perf: true, route: slow })
  await page.evaluate(() => { window.__sounds = [] })
  await finishNow(page)
  await waitLanded(page, 12000)
  const r = await reveal(page)
  const tl = await timeline(page)
  ok('summary, stage late: the flat medals set off on the beat', r?.mode === 'flat' && tl?.flat != null && tl.flat < 900, JSON.stringify({ r, tl }))
  ok('summary, stage late: they land, one then the other, about a second apart', r?.state === 'landed' && tl.land1 - tl.land0 > 700 && tl.land1 - tl.land0 < 1500, JSON.stringify(tl))
  const sounds = await medalSounds(page)
  ok('summary, stage late: with their sounds', sounds.join(',') === 'medal-heavy,medal', sounds.join(','))
  await page.waitForTimeout(3000)
  const left = await page.evaluate(() => ({ inReveal: document.querySelectorAll('[data-testid="medal-reveal"] canvas').length, any: document.querySelectorAll('canvas').length }))
  ok('summary, stage late: the 3D stage that came after is let go', left.inReveal === 0 && left.any === 0, JSON.stringify(left))
  await page.getByRole('button', { name: 'تم' }).click()
  await page.waitForTimeout(700)
  const gl = await page.evaluate(() => window.__gl)
  ok('summary, stage late: every GL context given back', gl.lost >= gl.made, JSON.stringify(gl))
  ok('summary, stage late: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// No medal earned: the module is never fetched.
{
  const { ctx, page, errors } = await open({ sessions: MEDAL_HISTORY, active: HEAVY })
  const chunks = []
  page.on('request', r => { if (/medal3d/.test(r.url())) chunks.push(r.url()) })
  await finishNow(page)
  await page.waitForTimeout(3000)
  ok('summary, no medal: no «إنجازات جديدة», and the medal module never loads',
    await page.locator('[data-testid="medal-reveal"]').count() === 0 && chunks.length === 0, chunks.join(' '))
  ok('summary, no medal: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// A tap on the summary before the medals come: they land at once, facing
// front, with one sound — the heavier — and every number is final.
{
  const { ctx, page, errors } = await open({ sessions: MEDAL_HISTORY, active: HEAVY, unlocked: allBut('b1', 'b2') })
  await page.evaluate(() => { window.__sounds = [] })
  await finishNow(page)
  await page.waitForTimeout(450)
  await page.locator('.sum-title').click()
  await waitLanded(page, 6000)
  const r = await reveal(page)
  ok('summary skip: the medals are down', r?.state === 'landed', JSON.stringify(r))
  ok('summary skip: the numbers are final', await setsShown(page) === '3')
  await page.waitForTimeout(500)
  const sounds = await medalSounds(page)
  ok('summary skip: one landing sound, the heavier', sounds.join(',') === 'medal-heavy', sounds.join(','))
  ok('summary skip: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// No WebGL (Lockdown Mode): the flat medal turns instead, and still lands.
{
  const { ctx, page, errors } = await open({ sessions: MEDAL_HISTORY, active: HEAVY, unlocked: allBut('b1', 'b2'), noGL: true })
  await page.evaluate(() => { window.__sounds = [] })
  await finishNow(page)
  await waitLanded(page, 12000)
  const r = await reveal(page)
  ok('summary, no WebGL: the flat medals, turning', r?.mode === 'flat' && r.motion === 'flat' && r.flat === 2 && !r.canvas, JSON.stringify(r))
  ok('summary, no WebGL: they land', r?.state === 'landed', JSON.stringify(r))
  const sounds = await medalSounds(page)
  ok('summary, no WebGL: with their sounds', sounds.join(',') === 'medal-heavy,medal', sounds.join(','))
  ok('summary, no WebGL: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// The medal's picture can't be built (iOS refuses a 2D canvas once its
// canvas memory is spent): the flat medals take over and land, with their
// titles and sounds, instead of an empty stage that never finishes.
{
  const { ctx, page, errors } = await open({ sessions: MEDAL_HISTORY, active: HEAVY, unlocked: allBut('b1', 'b2') })
  await page.evaluate(() => {
    window.__sounds = []
    const gc = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (t, o) { return t === '2d' && this.width >= 512 ? null : gc.call(this, t, o) }
  })
  await finishNow(page)
  await waitLanded(page, 12000)
  const r = await reveal(page)
  ok('summary, picture fails: the flat medals take over and land', r?.mode === 'flat' && r.flat === 2 && r.state === 'landed', JSON.stringify(r))
  const sounds = await medalSounds(page)
  ok('summary, picture fails: with their sounds', sounds.join(',') === 'medal-heavy,medal', sounds.join(','))
  ok('summary, picture fails: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}
// Only the sharp back plate refused (made at 1024 once the medals are
// down): they spin and land as ever, the back stays at 512.
{
  const { ctx, page, errors } = await open({ sessions: MEDAL_HISTORY, active: HEAVY, unlocked: allBut('b1', 'b2') })
  await page.evaluate(() => {
    window.__sounds = []
    const gc = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (t, o) { return t === '2d' && this.width >= 1024 ? null : gc.call(this, t, o) }
  })
  await finishNow(page)
  await waitLanded(page, 12000)
  await page.waitForTimeout(1500)   // still: the sharp plate is tried
  const r = await reveal(page)
  ok('summary, sharp plate refused: the medals land all the same', r?.state === 'landed' && (r.mode === 'gl' ? r.canvas : r.flat === 2), JSON.stringify(r))
  const sounds = await medalSounds(page)
  ok('summary, sharp plate refused: with their sounds', sounds.join(',') === 'medal-heavy,medal', sounds.join(','))
  ok('summary, sharp plate refused: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}
// The pictures refused, with a tap on the summary before they come (a
// skip): the flat medals stand there at once.
{
  const { ctx, page, errors } = await open({ sessions: MEDAL_HISTORY, active: HEAVY, unlocked: allBut('b1', 'b2') })
  await page.evaluate(() => {
    const gc = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (t, o) { return t === '2d' && this.width >= 512 ? null : gc.call(this, t, o) }
  })
  await finishNow(page)
  await page.waitForTimeout(450)
  await page.locator('.sum-title').click()
  await waitLanded(page, 6000)
  const r = await reveal(page)
  ok('summary, picture fails, skipped: the flat medals are down', r?.mode === 'flat' && r.state === 'landed', JSON.stringify(r))
  ok('summary, picture fails, skipped: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// Reduced motion: no spin, a fade; the numbers are there from the start.
{
  const { ctx, page, errors } = await open({ sessions: MEDAL_HISTORY, active: HEAVY, unlocked: allBut('b1', 'b2'), reduced: true })
  // Every frame from the tap: once «أعلى وزن» or the streak can be seen at
  // all, it already says the new best and the new streak, the flame lit.
  await page.evaluate(() => {
    window.__sumFrames = []
    const t0 = performance.now()
    const tick = () => {
      const secs = [...document.querySelectorAll('.sum-sec:not(.sum-ach-sec)')]
      if (secs.length >= 2) {
        const [pr, st] = secs
        window.__sumFrames.push({ t: Math.round(performance.now() - t0),
          pr: [+getComputedStyle(pr).opacity, pr.querySelector('.sum-pr-v')?.innerText.replace(/\s+/g, ' ')],
          st: [+getComputedStyle(st).opacity, st.querySelector('.sum-streak-n')?.innerText.replace(/\s+/g, ' '),
            !!st.querySelector('.lf-fill')] })
      }
      if (performance.now() - t0 < 4000) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await finishNow(page)
  await page.getByTestId('session-summary').waitFor({ timeout: 4000 }).catch(() => {})
  const early = await setsShown(page)
  await waitLanded(page, 12000)
  const r = await reveal(page)
  ok('summary, reduced: the numbers are final from the first frame', early === '3', String(early))
  const frames = await page.evaluate(() => window.__sumFrames)
  const wrong = frames.filter(f => (f.pr[0] > 0.01 && !/^140 /.test(f.pr[1] || '')) || (f.st[0] > 0.01 && (!/0 ← 1/.test(f.st[1] || '') || !f.st[2])))
  ok('summary, reduced: the new best and the streak never show an old number first',
    frames.length > 10 && wrong.length === 0, JSON.stringify(wrong.slice(0, 2)))
  ok('summary, reduced: the medals fade in, no spin', /^(fade|flat-fade)$/.test(r?.motion || '') && r?.state === 'landed', JSON.stringify(r))
  ok('summary, reduced: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ «كسبت يوم راحة»: earned by the session, announced after it ══
// Three workouts, then the plan's own rest day yesterday: four counted
// days. The session finished today is the fifth — an optional rest day.
// The moment waits for the summary (and a level-up screen, if one comes)
// and plays once: the flame filled, the count, the medal's library sound
// and its light buzz.
{
  // The training day in Riyadh (it turns at 03:00, UTC+3): the UTC date of now.
  const rday = new Date().toISOString().slice(0, 10)
  const back = (k) => new Date(Date.parse(`${rday}T12:00:00Z`) - k * 86400000).toISOString().slice(0, 10)
  const EARN_HISTORY = [4, 3, 2].map((k, i) => ({
    id: 900 + i, date: new Date(`${back(k)}T18:00:00+03:00`).toISOString(), duration: 45,
    exercises: [{ id: 'r' + i, muscle: 'Chest', name: 'Bench Press',
      sets: [{ weight: '80', reps: '10', done: true }, { weight: '80', reps: '10', done: true }] }],
  }))
  const { ctx, page, errors } = await open({ sessions: EARN_HISTORY, active: HEAVY, unlocked: allBut('b1', 'b2') })
  const seeded = await page.evaluate(() => localStorage.getItem('meran_rest_announced'))
  ok('rest day earned: before, nothing held and the list starts empty', seeded === '[]', String(seeded))
  ok('rest day earned: before, the flame is an outline', await page.evaluate(() => {
    const b = document.querySelector('[data-testid="streak-number"]')
    return !b || b.dataset.restDays === '0'
  }))
  await finishNow(page)
  await page.getByTestId('session-summary').waitFor({ timeout: 6000 }).catch(() => {})
  await waitLanded(page)
  await page.waitForTimeout(1200)
  ok('rest day earned: not over the summary', await page.locator('[data-testid="rest-earned"]').count() === 0)
  await page.evaluate(() => { window.__vibes = []; window.__sounds = [] })
  await page.getByRole('button', { name: 'تم' }).click()
  // a level-up screen, if the session crossed one, comes first
  await page.waitForTimeout(600)
  if (await page.locator('[data-testid="level-up"]').count()) {
    await page.waitForTimeout(1500)
    ok('rest day earned: not over the level-up screen', await page.locator('[data-testid="rest-earned"]').count() === 0)
    await page.getByRole('button', { name: 'كمّل' }).click()
  }
  const shown = await page.waitForSelector('[data-testid="rest-earned"]', { timeout: 5000 }).then(() => true, () => false)
  ok('rest day earned: announced after the summary', shown)
  await page.waitForTimeout(1500)
  const txt = shown ? await page.getByTestId('rest-earned').innerText() : ''
  ok('rest day earned: «كسبت يوم راحة», he holds one now', /كسبت يوم راحة/.test(txt) && /صار عندك يوم راحة اختياري واحد/.test(txt), txt)
  const feel = await page.evaluate(() => ({ sounds: window.__sounds.filter(x => !x.stopped).map(x => x.name), vibes: window.__vibes }))
  ok('rest day earned: the medal\'s library sound, once', feel.sounds.join(',') === 'medal', JSON.stringify(feel))
  ok('rest day earned: and its light buzz', JSON.stringify(feel.vibes) === '[14]', JSON.stringify(feel))
  await page.getByTestId('rest-earned-ok').click()
  await page.waitForTimeout(600)
  const after = await page.evaluate(() => {
    const b = document.querySelector('[data-testid="streak-number"]')
    return { rest: b?.dataset.restDays, filled: !!b?.querySelector('.lf-fill'), glow: !!b?.querySelector('.lf-glow'),
      list: JSON.parse(localStorage.getItem('meran_rest_announced') || 'null') }
  })
  ok('rest day earned: Home\'s flame is filled now, with its glow', after.rest === '1' && after.filled && after.glow, JSON.stringify(after))
  ok('rest day earned: remembered as announced', Array.isArray(after.list) && after.list.length === 1 && after.list[0] === rday, JSON.stringify(after))
  // This suite re-seeds storage on every load; keep what the app wrote.
  const kept = await page.evaluate(() => localStorage.getItem('hf_sessions'))
  await page.addInitScript((v) => { localStorage.setItem('hf_sessions', v); localStorage.removeItem('hf_active') }, kept)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  const again = await page.evaluate(() => ({ rest: document.querySelector('[data-testid="streak-number"]')?.dataset.restDays,
    shown: document.querySelectorAll('[data-testid="rest-earned"]').length }))
  ok('rest day earned: once — not again after opening the app again', again.rest === '1' && again.shown === 0, JSON.stringify(again))
  ok('rest day earned: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ His reps win over a template's ═══════════════════════════
// حمزة: «متأكد انه خياري ١٢ الى ١٥ عدة الديفولت بس الحين يقترح علي ١٠».
// A built-in push·pull·legs plan whose chest press says 10–10, his
// Settings on 12–15 (volume), and his last session stored with that
// template's target ({ min: 10, max: 10 }, before ownership existed).
// The session he starts from Home aims for 12–15 — the stepper starts at
// 12 and the coach says «الهدف 12–15» — never 10.
{
  const PPL = BUILT_IN_PLANS.find(p => p.planId === 'machine_beginner_3day')
  const BENCH = PPL.weeklySchedule[0].exercises[0]
  const LAST = [{ id: Date.now() - 3 * 86400000, date: new Date(Date.now() - 3 * 86400000).toISOString(), duration: 40, planDayName: PPL.weeklySchedule[0].name,
    exercises: [{ id: 'x', muscle: 'Chest', name: BENCH.name, target: { min: 10, max: 10 },
      sets: [1, 2, 3, 4].map(() => ({ weight: '50', reps: '12', done: true })) }] }]
  const { ctx, page, errors } = await open({ active: null, sessions: LAST,
    extra: { hf_plan: PPL, hf_plan_index: 0, hf_rep_target: { id: 'volume', base: 12, top: 15 } } })
  await page.getByRole('button', { name: 'ابدأ التمرين' }).first().click()
  await page.locator('[data-testid="session"]').waitFor({ timeout: 6000 }).catch(() => {})
  await page.waitForTimeout(900)
  const stored = await activeStored(page)
  const ex0 = stored?.exercises?.[0]
  ok('his reps: the session is the template\'s push day, chest press first', ex0?.name === BENCH.name && BENCH.repsMin === 10 && BENCH.repsMax === 10, JSON.stringify(ex0?.name))
  ok('his reps: the template\'s 10–10 is not stored as a target', !ex0?.target, JSON.stringify(ex0?.target))
  ok('his reps: every set starts at 12, not 10', ex0?.sets?.every(x => x.reps === '12'), JSON.stringify(ex0?.sets))
  const vals = await inputs(page)
  ok('his reps: the stepper shows 12', vals[1] === '12', JSON.stringify(vals))
  const coach = (await page.locator('.s-coach-text').innerText().catch(() => '')).replace(/\s+/g, ' ')
  ok('his reps: the coach says «الهدف 12–15 عدّة», not 10', /الهدف 12–15 عدّة/.test(coach) && !/الهدف 10/.test(coach), coach)
  ok('his reps: no page errors', errors.length === 0, errors.join('; '))
  await page.screenshot({ path: `${OUT}/his-reps.png` })
  await ctx.close()
}

// ══ Every set at the new weight is a record ══════════════════
// حمزة (Machine Shoulder Press, set 4 of 4): «انا ابا احتفالية وكأس مدام
// رفعت الوزن الجديد». Last time 40×12 (the engine says raise: 42.5).
// Today 40×15, then 45×12 — the new weight — then 45×12 again, then set
// 4 at 45. Sets 2, 3 and 4 each wear the trophy and get the whole moment
// (sound, buzz, card); set 1 (40, not above the 40 on record) doesn't.
// The gold «+5» stays on the stepper at 45 (it is above last time), and
// the coach never tells him to try 42.5 after he lifted 45.
{
  const SP = 'Machine Shoulder Press'
  const spDay = (n, reps) => ({ id: new Date(2026, 8, n, 18).getTime(), date: new Date(2026, 8, n, 18).toISOString(), duration: 40,
    exercises: [{ id: 'c', muscle: 'Shoulders', name: SP, sets: reps.map(r => ({ weight: '40', reps: String(r), done: true })) }] })
  const HISTORY = [spDay(1, [12, 12, 12, 12]), spDay(3, [13, 12, 12, 12]), spDay(5, [15, 15, 12, 12])]
  const TODAY = { id: Date.now() - 20 * 60000, date: new Date().toISOString(), name: 'Push',
    exercises: [{ id: 'c', muscle: 'Shoulders', name: SP, sets: [1, 2, 3, 4].map(() => ({ weight: '40', reps: '12', done: false })) }] }
  const { ctx, page, errors } = await open({ active: TODAY, sessions: HISTORY })
  await page.waitForTimeout(400)
  const coachText = () => page.locator('.s-coach-text').innerText().catch(() => '').then(t => t.replace(/\s+/g, ' '))
  const momentGone = () => page.waitForFunction(() => !document.querySelector('[data-testid="pr-moment"]'), null, { timeout: 5000 }).catch(() => {})
  const doSet = async (w, r) => {
    await page.getByTestId('weight-input').fill(w)
    await page.getByTestId('reps-input').fill(r)
    await page.waitForTimeout(200)
    await page.evaluate(() => { window.__vibes = []; window.__sounds = [] })
    await completeBtn(page).click()
    await page.waitForTimeout(450)
    const got = await page.evaluate(() => ({
      moment: !!document.querySelector('[data-testid="pr-moment"]'),
      sub: document.querySelector('.pr-sub')?.textContent.replace(/\s+/g, ' ') || '',
      sound: window.__sounds.some(s => s.name === 'pr' && !s.stopped),
      vibes: JSON.stringify(window.__vibes),
    }))
    await momentGone()
    await page.getByRole('button', { name: 'تخطي' }).click().catch(() => {})
    await page.waitForTimeout(500)
    return got
  }
  ok('every-set record: the engine offers the raise (42.5) at the start', /جرّب 42\.5 كجم/.test(await coachText()), await coachText())
  const s1 = await doSet('40', '15')
  ok('every-set record: set 1 at 40 (not above the 40 on record) — no moment, no record sound', !s1.moment && !s1.sound, JSON.stringify(s1))
  const s2 = await doSet('45', '12')
  ok('every-set record: set 2 at 45 — the moment, «+5 كجم فوق أعلى وزن قبل», sound and buzz',
    s2.moment && /\+5 كجم فوق أعلى وزن قبل/.test(s2.sub) && s2.sound && s2.vibes === '[[12,70,28]]', JSON.stringify(s2))
  ok('every-set record: after 45, the coach doesn\'t say «جرّب 42.5» — it says hold 45', !/42\.5/.test(await coachText()) && /ثبّت على 45 كجم/.test(await coachText()), await coachText())
  const s3 = await doSet('45', '12')
  ok('every-set record: set 3 at 45 again — the moment again, sound and buzz (was a plain check)',
    s3.moment && /\+5 كجم فوق أعلى وزن قبل/.test(s3.sub) && s3.sound && s3.vibes === '[[12,70,28]]', JSON.stringify(s3))
  // Set 4, at 45, before the tap.
  await page.getByTestId('weight-input').fill('45')
  await page.waitForTimeout(300)
  const live = await page.evaluate(() => ({
    chip: document.querySelector('.s-raise-chip')?.textContent.replace(/\s+/g, ' ') || null,
    ring: !!document.querySelector('[data-testid="raise-ring"]'),
  }))
  ok('every-set record: set 4 at 45 still shows the gold «+5 كجم عن آخر مرة» and ring (a new weight vs last time)',
    /\+5 كجم عن آخر مرة/.test(live.chip || '') && live.ring, JSON.stringify(live))
  const c4 = await coachText()
  ok('every-set record: set 4\'s coach line never says 42.5 — «ثبّت على 45 كجم»', !/42\.5/.test(c4) && /ثبّت على 45 كجم/.test(c4), c4)
  await page.getByTestId('reps-input').fill('12')
  await page.waitForTimeout(200)
  await page.evaluate(() => { window.__vibes = []; window.__sounds = [] })
  await completeBtn(page).click()
  await page.waitForTimeout(450)
  const s4 = await page.evaluate(() => ({ moment: !!document.querySelector('[data-testid="pr-moment"]'),
    sound: window.__sounds.some(s => s.name === 'pr' && !s.stopped), vibes: JSON.stringify(window.__vibes) }))
  ok('every-set record: set 4 at 45 — the moment too', s4.moment && s4.sound && s4.vibes === '[[12,70,28]]', JSON.stringify(s4))
  await momentGone()
  await page.waitForTimeout(300)
  const rows = await page.evaluate(() => [...document.querySelectorAll('.s-table .s-trow[data-state="done"]')]
    .map(r => ({ set: r.getAttribute('data-set'), trophy: !!r.querySelector('.s-pr-icon'), hold: r.querySelector('.s-pr-icon')?.getAttribute('data-hold') ?? null })))
  ok('every-set record: trophies on sets 2, 3 and 4, a plain check on set 1',
    JSON.stringify(rows.map(r => r.trophy)) === '[false,true,true,true]' && rows.every(r => r.hold === null), JSON.stringify(rows))
  ok('every-set record: no page errors', errors.length === 0, errors.join('; '))
  await page.screenshot({ path: `${OUT}/every-set-record.png` })
  await ctx.close()
}

// ══ «إضافة تمرين» / «إضافة مجموعة» in a plan day: for this time, or his plan ══
// حمزة: «في خطتي تمارين الرجلين مالقيت تمرين abdication و addactor». He adds
// them in the session, and that never reached his plan. Now, in a plan day's
// session, the add sheet asks as the swap does: «بس هالمرة» (green, the
// default) or «دايماً بخطتي» (into today's day of his plan, free); a set more
// than his plan has asks quietly under the sets. A free session asks nothing.
{
  const SHOTS = process.env.SHOTS || OUT
  mkdirSync(SHOTS, { recursive: true })
  const machine = JSON.parse(JSON.stringify(BUILT_IN_PLANS.find(p => p.planId === 'machine_beginner_3day')))
  const legsNow = () => page.evaluate(() => JSON.parse(localStorage.getItem('hf_plan')).weeklySchedule[2].exercises)
  const { ctx, page, errors } = await open({ active: null, sessions: [], viewport: { width: 390, height: 844 },
    extra: { hf_plan: machine, hf_plan_index: 2, hf_rep_target: { id: 'volume', base: 12, top: 15 }, hf_recovery: { daysPerWeek: 3 } } })
  await page.getByRole('button', { name: 'ابدأ التمرين' }).first().click()
  await page.locator('[data-testid="session"]').waitFor({ timeout: 6000 }).catch(() => {})
  await page.waitForTimeout(900)
  const a0 = await activeStored(page)
  ok('plan add: the session is his leg day (the counter at 2)', a0?.planDayIndex === 2 && a0.exercises[0].name === 'Hack Squat', JSON.stringify(a0?.exercises?.map(e => e.name)))
  const addSheet = async (name) => {
    await page.getByRole('button', { name: 'خيارات التمرين' }).click(); await page.waitForTimeout(600)
    await page.locator('.k-sheet').last().getByRole('button', { name: /إضافة تمرين/ }).click(); await page.waitForTimeout(800)
    await page.locator('.k-sheet .ax-chips button').filter({ hasText: 'الأرجل' }).click(); await page.waitForTimeout(300)
    await page.locator('.k-sheet .k-row').filter({ hasText: name }).first().click(); await page.waitForTimeout(500)
  }
  await addSheet('Machine Hip Abduction')
  const foot = page.locator('[data-testid="add-foot"]')
  const once = page.locator('[data-testid="add-once"]'), always = page.locator('[data-testid="add-always"]')
  const footText = (await foot.innerText().catch(() => '')).replace(/\s+/g, ' ')
  ok('plan add: picked, the sheet asks as the swap does — «بس هالمرة» and «دايماً بخطتي»',
    await once.count() === 1 && await always.count() === 1 && /أضف فتح ورك جهاز للجلسة/.test(footText) && /ليوم أرجل بخطتك/.test(footText), footText)
  const looks = await page.evaluate(() => {
    const cs = (s) => getComputedStyle(document.querySelector(s))
    const o = document.querySelector('[data-testid="add-once"]').getBoundingClientRect(), a = document.querySelector('[data-testid="add-always"]').getBoundingClientRect()
    return { once: cs('[data-testid="add-once"]').backgroundColor, always: cs('[data-testid="add-always"]').backgroundColor, onceFirst: o.left > a.left }
  })
  ok('plan add: «بس هالمرة» is the green one, first (on the right); «دايماً بخطتي» beside it, not green',
    looks.once === ACCENT && looks.always !== ACCENT && looks.onceFirst, JSON.stringify(looks))
  await page.screenshot({ path: `${SHOTS}/390-session-add-prompt.png` })
  await page.setViewportSize({ width: 320, height: 568 }); await page.waitForTimeout(500)
  // (what a scrolling row clips — the muscle chips — is fine)
  const over = await page.evaluate(() => [...document.querySelectorAll('.k-sheet *')].filter(el => {
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return false
    let left = r.left, right = r.right
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      if (getComputedStyle(a).overflowX !== 'visible') { const b = a.getBoundingClientRect(); left = Math.max(left, b.left); right = Math.min(right, b.right) }
    }
    return right > left && (right > innerWidth + 1 || left < -1)
  }).map(el => el.className).slice(0, 3))
  ok('plan add: at 320 nothing in the sheet sticks out', over.length === 0, over.join(' | '))
  const fits = await page.evaluate(() => [...document.querySelectorAll('[data-testid="add-foot"] .k-btn')].every(b => b.scrollWidth <= b.clientWidth + 1))
  ok('plan add: at 320 both answers fit their buttons', fits)
  await page.screenshot({ path: `${SHOTS}/320-session-add-prompt.png` })
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400)
  await always.click(); await page.waitForTimeout(900)
  const legs1 = await legsNow()
  const added = legs1.find(x => x.name === 'Machine Hip Abduction')
  ok('«دايماً بخطتي»: his leg day has it now — 3 sets, Settings\' 12–15 (not his own), the 90 s rest', !!added && legs1.length === 7
    && added.sets === 3 && added.repsMin === 12 && added.repsMax === 15 && !added.repsOwn && added.restSeconds === 90 && added.muscle === 'Legs', JSON.stringify(added))
  const a1 = await activeStored(page)
  ok('«دايماً بخطتي»: and the session has it, at its end', a1.exercises.at(-1).name === 'Machine Hip Abduction' && a1.exercises.at(-1).sets.length === 3)
  ok('«دايماً بخطتي»: free — the day he reached and the streak\'s rule untouched',
    await page.evaluate(() => JSON.parse(localStorage.getItem('hf_plan_index'))) === 2
    && !(await page.evaluate(() => JSON.parse(localStorage.getItem('hf_recovery'))))?.lastSettingsChangeAt)

  await addSheet('Machine Hip Adduction')
  await once.click(); await page.waitForTimeout(900)
  const legs2 = await legsNow()
  const a2 = await activeStored(page)
  ok('«بس هالمرة»: the session has it', a2.exercises.at(-1).name === 'Machine Hip Adduction')
  ok('«بس هالمرة»: his plan untouched', legs2.length === 7 && !legs2.some(x => x.name === 'Machine Hip Adduction'), legs2.map(x => x.name).join(', '))

  // one the day already has: nothing to ask
  await addSheet('Leg Extension')
  ok('one his day already has: the one «أضف» button, no «دايماً بخطتي»', await always.count() === 0 && await foot.count() === 0
    && /أضف/.test(await page.locator('.k-sheet .k-btn-primary').last().innerText()))
  await page.locator('.k-sheet [aria-label="إغلاق"]').last().click(); await page.waitForTimeout(600)

  // «إضافة مجموعة» on the hack squat (4 in his plan): asked under its sets
  await page.getByRole('button', { name: 'خيارات التمرين' }).click(); await page.waitForTimeout(600)
  await page.locator('.k-sheet').last().getByRole('button', { name: /إضافة مجموعة/ }).click(); await page.waitForTimeout(900)
  const ask = page.locator('[data-testid="set-ask"]')
  const askText = (await ask.innerText().catch(() => '')).replace(/\s+/g, ' ')
  ok('a set more than his plan: a small question under the sets — «خطتك فيها 4 مجموعات», «دايماً بخطتي»',
    await ask.count() === 1 && /زدت مجموعة لهالجلسة/.test(askText) && /خطتك فيها 4 مجموعات/.test(askText)
    && (await activeStored(page)).exercises[0].sets.length === 5, askText)
  await page.screenshot({ path: `${SHOTS}/390-session-set-ask.png` })
  await page.locator('[data-testid="set-ask-always"]').click(); await page.waitForTimeout(700)
  const hack = (await legsNow())[0]
  ok('«دايماً بخطتي» (a set): the hack squat has 5 in his plan, noting the 4 it had', hack.name === 'Hack Squat' && hack.sets === 5 && hack.was?.sets === 4, JSON.stringify(hack))
  ok('«دايماً بخطتي» (a set): it says so — «صارت 5 مجموعات بخطتك»', /صارت 5 مجموعات بخطتك/.test((await ask.innerText().catch(() => '')).replace(/\s+/g, ' ')))
  await page.waitForTimeout(2800)
  ok('…and goes', await ask.count() === 0)
  // × is «بس هالمرة»: the plan keeps its number
  await page.getByRole('button', { name: 'خيارات التمرين' }).click(); await page.waitForTimeout(600)
  await page.locator('.k-sheet').last().getByRole('button', { name: /إضافة مجموعة/ }).click(); await page.waitForTimeout(900)
  ok('another set more: asked again, against the 5 now in his plan', /خطتك فيها 5 مجموعات/.test((await ask.innerText().catch(() => '')).replace(/\s+/g, ' ')))
  await page.locator('[data-testid="set-ask-close"]').click(); await page.waitForTimeout(500)
  ok('×: gone, his plan keeps 5', await ask.count() === 0 && (await legsNow())[0].sets === 5 && (await activeStored(page)).exercises[0].sets.length === 6)
  ok('plan add: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}
{
  // a free session: nothing of his plan to ask about
  const machine = BUILT_IN_PLANS.find(p => p.planId === 'machine_beginner_3day')
  const { ctx, page, errors } = await open({ extra: { hf_plan: machine, hf_plan_index: 2 } })
  await page.getByRole('button', { name: 'خيارات التمرين' }).click(); await page.waitForTimeout(600)
  await page.locator('.k-sheet').last().getByRole('button', { name: /إضافة تمرين/ }).click(); await page.waitForTimeout(800)
  await page.locator('.k-sheet .ax-chips button').filter({ hasText: 'الأرجل' }).click(); await page.waitForTimeout(300)
  await page.locator('.k-sheet .k-row').filter({ hasText: 'Machine Hip Abduction' }).first().click(); await page.waitForTimeout(500)
  ok('free session: adding asks nothing — the one «أضف» button', await page.locator('[data-testid="add-always"]').count() === 0
    && /أضف/.test(await page.locator('.k-sheet .k-btn-primary').last().innerText()))
  await page.locator('.k-sheet .k-btn-primary').last().click(); await page.waitForTimeout(700)
  ok('free session: added to the session, his plan untouched', (await activeStored(page)).exercises.at(-1).name === 'Machine Hip Abduction'
    && (await page.evaluate(() => JSON.parse(localStorage.getItem('hf_plan')).weeklySchedule[2].exercises.length)) === 6)
  await page.getByRole('button', { name: 'خيارات التمرين' }).click(); await page.waitForTimeout(600)
  await page.locator('.k-sheet').last().getByRole('button', { name: /إضافة مجموعة/ }).click(); await page.waitForTimeout(700)
  ok('free session: a set added asks nothing', await page.locator('[data-testid="set-ask"]').count() === 0)
  ok('free session add: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}

// ══ «بالتناوب»: the hip machines take turns on his leg day ══════
// حمزة: «اليوم رجول بسوي هيب ابدكشن اجي يوم ثاني للرجول يعمل هيب اددكشن.
// والميزة تسمح لي بالاختيار». His leg day ends with one row that takes
// turns between the abduction and adduction machines (src/plan/rotate.js:
// which is due comes from his sessions of the day, never from storage).
// The first leg day starts on the abduction machine; done and saved, the
// next leg day starts on the adduction one — and before his first set he
// can do the other one this time, which is what then counts.
{
  const SHOTS = process.env.SHOTS || OUT
  mkdirSync(SHOTS, { recursive: true })
  const AB = 'Machine Hip Abduction', AD = 'Machine Hip Adduction'
  const machine = JSON.parse(JSON.stringify(BUILT_IN_PLANS.find(p => p.planId === 'machine_beginner_3day')))
  machine.weeklySchedule[2].exercises.push({ name: AB, muscle: 'Legs', sets: 3, repsMin: 12, repsMax: 15, restSeconds: 90, by: 'user', rotate: [AB, AD] })
  const opened = await open({ active: null, sessions: [], viewport: { width: 390, height: 844 }, xp: 2400,
    extra: { hf_plan: machine, hf_plan_index: 2, hf_rep_target: { id: 'volume', base: 12, top: 15 }, hf_recovery: { daysPerWeek: 3 } } })
  const { ctx, errors } = opened
  let page = opened.page
  const start = async () => {
    await page.locator('nav.f-tabs > button').first().click().catch(() => {}); await page.waitForTimeout(500)
    await page.getByRole('button', { name: /^(ابدأ التمرين|جلسة زيادة)$/ }).first().click()
    await page.locator('[data-testid="session"]').waitFor({ timeout: 6000 }).catch(() => {})
    await page.waitForTimeout(900)
  }
  const toRotating = async () => {
    await page.locator('.s-qrow').filter({ hasText: /ورك جهاز/ }).first().click(); await page.waitForTimeout(900)
  }
  const doSets = async (n) => {
    for (let i = 0; i < n; i++) {
      await completeBtn(page).click(); await page.waitForTimeout(500)
      await page.getByRole('button', { name: 'تخطي' }).click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(400)
    }
  }
  const finish = async () => {
    await page.getByRole('button', { name: /^إنهاء$/ }).click(); await page.waitForTimeout(500)
    await page.locator('.k-sheet').last().getByRole('button', { name: 'احفظ وأنهِ' }).click()
    await page.getByTestId('session-summary').waitFor({ timeout: 4000 }).catch(() => {})
    await page.waitForTimeout(1200)
  }
  /** The next leg day: the plan's counter at `idx`, the app opened again —
   *  in a fresh tab of the same phone (open()'s seed would put the first
   *  day's data back on a reload of this one). */
  const nextLegDay = async (idx) => {
    await page.evaluate((i) => localStorage.setItem('hf_plan_index', JSON.stringify(i)), idx)
    const next = await ctx.newPage()
    next.on('pageerror', e => errors.push(String(e)))
    await page.close()
    page = next
    await page.goto(APP, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500)
  }
  const plan = () => page.evaluate(() => JSON.parse(localStorage.getItem('hf_plan')))

  await page.locator('nav.f-tabs > button').first().click(); await page.waitForTimeout(600)
  await page.locator('.hm-more').click().catch(() => {}); await page.waitForTimeout(800)
  const dp = (await page.locator('[data-testid="day-rotate"]').innerText().catch(() => '')).replace(/\s+/g, ' ')
  ok('rotate: Home\'s day sheet shows the one due — the abduction machine — and «بالتناوب · المرة الجاية: ضم ورك جهاز»',
    /بالتناوب · المرة الجاية: ضم ورك جهاز/.test(dp) && /فتح ورك جهاز/.test(await page.locator('.k-sheet .dp-list').innerText().catch(() => '')), dp)
  await page.keyboard.press('Escape'); await page.waitForTimeout(500)

  // ── the first leg day: the abduction machine
  await start()
  const a0 = await activeStored(page)
  const r0 = a0.exercises.at(-1)
  ok('rotate: the first leg day starts on the abduction machine, its turns on the session\'s exercise',
    r0.name === AB && JSON.stringify(r0.rotate) === JSON.stringify([AB, AD]) && !r0.originalName, JSON.stringify(r0))
  await toRotating()
  const bar = () => page.locator('[data-testid="rotate-bar"]')
  const barText = (await bar().innerText().catch(() => '')).replace(/\s+/g, ' ')
  ok('rotate: the session says «بالتناوب · المرة الجاية: ضم ورك جهاز» under the exercise', /بالتناوب · المرة الجاية: ضم ورك جهاز/.test(barText), barText)
  ok('rotate: before the first set, one tap offers the other one — «بدّلها لـ ضم ورك جهاز هالمرة»',
    /بدّلها لـ ضم ورك جهاز هالمرة/.test((await page.locator('[data-testid="rotate-switch"]').innerText().catch(() => '')).replace(/\s+/g, ' ')))
  const looks = await page.evaluate(() => {
    const b = document.querySelector('[data-testid="rotate-switch"]'), cs = getComputedStyle(b)
    return { bg: cs.backgroundColor, color: cs.color, h: b.getBoundingClientRect().height }
  })
  ok('rotate: the choice is a quiet pill, never the green (the green stays the dock\'s), a 44pt target', looks.bg !== ACCENT && looks.color !== ACCENT && looks.h >= 44, JSON.stringify(looks))
  await page.screenshot({ path: `${SHOTS}/390-session-rotate.png` })
  await page.setViewportSize({ width: 320, height: 568 }); await page.waitForTimeout(500)
  const over = await page.evaluate(() => [...document.querySelectorAll('[data-testid="rotate-bar"], [data-testid="rotate-bar"] *')]
    .filter(el => { const r = el.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1) }).map(el => el.className))
  ok('rotate: at 320 the line and the choice keep inside the screen', over.length === 0, over.join(' | '))
  ok('rotate: at 320 «تمّت المجموعة» is still on screen', await completeBtn(page).evaluate(el => el.getBoundingClientRect().bottom <= innerHeight))
  await page.screenshot({ path: `${SHOTS}/320-session-rotate.png` })
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400)
  await doSets(3)
  ok('rotate: a set done — the choice goes (sets are never moved to the other machine), the line stays',
    await page.locator('[data-testid="rotate-switch"]').count() === 0 && await bar().count() === 1)
  await finish()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('hf_sessions')))
  ok('rotate: the session is saved with the abduction machine done', saved?.[0]?.exercises?.some(e => e.name === AB && e.sets.length === 3), JSON.stringify(saved?.[0]?.exercises?.map(e => e.name)))
  ok('rotate: nothing about the turns was written to his plan', JSON.stringify((await plan()).weeklySchedule[2].exercises.at(-1).rotate) === JSON.stringify([AB, AD]))

  // ── the next leg day: the adduction machine
  await nextLegDay(5)
  await start()
  const a1 = await activeStored(page)
  ok('rotate: the next leg day starts on the adduction machine', a1.exercises.at(-1).name === AD && a1.planDayIndex === 5, JSON.stringify(a1.exercises.map(e => e.name)))
  await toRotating()
  ok('rotate: and says the abduction one is next', /المرة الجاية: فتح ورك جهاز/.test((await bar().innerText().catch(() => '')).replace(/\s+/g, ' ')))
  // the choice: the other one, this time
  await page.locator('[data-testid="rotate-switch"]').click(); await page.waitForTimeout(900)
  const a2 = await activeStored(page)
  const x2 = a2.exercises.at(-1)
  ok('rotate: «بدّلها لـ فتح ورك جهاز هالمرة» — the session runs on the abduction machine, no «بدل» (its own turn), the sets fresh',
    x2.name === AB && !x2.originalName && x2.sets.length === 3 && x2.sets.every(s => !s.done) && JSON.stringify(x2.rotate) === JSON.stringify([AB, AD]), JSON.stringify(x2))
  ok('rotate: the head shows it, and the line now says the adduction one is next', /فتح ورك جهاز/.test(await page.getByTestId('exercise-name').innerText())
    && /المرة الجاية: ضم ورك جهاز/.test((await bar().innerText().catch(() => '')).replace(/\s+/g, ' ')))
  ok('rotate: his plan untouched by the choice', JSON.stringify((await plan()).weeklySchedule[2].exercises.at(-1)) === JSON.stringify(machine.weeklySchedule[2].exercises.at(-1)))
  await page.screenshot({ path: `${SHOTS}/390-session-rotate-chosen.png` })
  await doSets(1)
  await finish()
  // what he did counts: the abduction machine again, so the adduction one is still due
  await nextLegDay(8)
  await start()
  ok('rotate: what he did is what counts — after the abduction machine (chosen), the adduction one is due again',
    (await activeStored(page)).exercises.at(-1).name === AD, JSON.stringify((await activeStored(page)).exercises.map(e => e.name)))
  ok('rotate: no page errors', errors.length === 0, errors.join('; '))
  await ctx.close()
}
{
  // «تسويها بالجلسة»: the one not due is his plan's — never offered as «مو بخطتك»
  const AB = 'Machine Hip Abduction', AD = 'Machine Hip Adduction'
  const machine = JSON.parse(JSON.stringify(BUILT_IN_PLANS.find(p => p.planId === 'machine_beginner_3day')))
  machine.weeklySchedule[2].exercises.push({ name: AB, muscle: 'Legs', sets: 3, repsMin: 12, repsMax: 15, restSeconds: 90, rotate: [AB, AD] })
  const DAY = 86400000
  const leg = (daysAgo, idx, name) => ({
    id: Date.now() - daysAgo * DAY, date: new Date(Date.now() - daysAgo * DAY).toISOString(), duration: 50, planDayIndex: idx, planDayName: machine.weeklySchedule[2].name,
    exercises: [['Hack Squat', 100], [name, 30]].map(([n, w], i) => ({ id: `r${daysAgo}${i}`, name: n, muscle: 'Legs', sets: [{ weight: String(w), reps: '12', done: true }, { weight: String(w), reps: '12', done: true }] })),
  })
  const sessions = [leg(2, 11, AD), leg(5, 8, AB), leg(8, 5, AD), leg(11, 2, AB)]
  const { ctx, page, errors } = await open({ active: null, sessions, viewport: { width: 390, height: 844 },
    extra: { hf_plan: machine, hf_plan_index: 12, hf_rep_target: { id: 'volume', base: 12, top: 15 }, hf_recovery: { daysPerWeek: 3 } } })
  await page.locator('nav.f-tabs > button').first().click(); await page.waitForTimeout(600)
  const row = page.locator('.k-row').filter({ hasText: 'خطتي' }).first()
  await row.scrollIntoViewIfNeeded(); await row.click()
  await page.locator('[data-testid="plan-view"]').waitFor({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(1100)
  await page.locator('.pv-tab[data-day="2"]').click(); await page.waitForTimeout(1000)
  const legs = '.pv-page[data-page="2"]'
  ok('rotate: the leg day\'s card takes turns — the abduction machine due (adduction was last)',
    await page.locator(`${legs} [data-testid="plan-card"][data-rotate="1"] .pv-rm[data-turn="due"]`).getAttribute('data-name') === AB)
  ok('rotate: «تسويها بالجلسة» offers neither hip machine — both are his plan\'s', await page.locator(`${legs} [data-testid="extra-card"]`).count() === 0
    && await page.locator(`${legs} [data-testid="plan-extra-note"]`).count() === 0)
  ok('rotate (تسويها بالجلسة): no page errors', errors.length === 0, errors.join('; '))
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
