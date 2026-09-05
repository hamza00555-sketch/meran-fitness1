#!/usr/bin/env node
// Photograph every screen in the app, once, in a known state.
//
//   npm run build
//   node scripts/screens.mjs                 # boots the preview server itself
//   node scripts/screens.mjs --only 'page-*' # iterate on a few
//   node scripts/screens.mjs --audit         # what the manifest does not cover
//
// Output: screenshots/<id>.png plus screenshots/index.json, which carries
// enough about each shot — what state it is in, how it was reached, which
// files it covers, the accent it resolved to — that the set can be read
// without the app in front of you.
//
// This is a script and not an e2e test on purpose. The suites in tests/
// exist to fail when behaviour regresses; this exists to produce assets.
// Mixing them would mean `npm test` writes thirty PNGs and a renamed
// label breaks CI.
//
// What it will not do is hand you a picture of nothing. Every shot has
// to prove it rendered — the text it must contain, the accent the mode
// must have resolved to, no page errors — and then the PNG itself has to
// have some variance in it, or a black frame that passed every DOM check
// would sail through.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawn, execSync } from 'node:child_process'
import path from 'node:path'
import sharp from 'sharp'

import { FIXTURES, SCREENS, NAV_TABS, KNOWN_UNCOVERED } from './screens.manifest.mjs'

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf('--' + name)
  return i === -1 ? fallback : (process.argv[i + 1]?.startsWith('--') ? true : process.argv[i + 1] ?? true)
}
const has = (name) => process.argv.includes('--' + name)

const APP  = process.env.APP || 'http://localhost:4173/'
const OUT  = path.resolve(arg('out', 'screenshots'))
const ONLY = arg('only')

// ── --audit: what is not photographed, and is that on purpose ──
if (has('audit')) {
  const covered = new Set(SCREENS.flatMap(s => s.covers || []))
  const files = execSync(
    "ls src/pages/*.jsx src/components/*.jsx src/components/*/*.jsx", { encoding: 'utf8' },
  ).trim().split('\n')
  const uncovered = files.filter(f => !covered.has(f))
  console.log(`\n  ${covered.size} files covered by ${SCREENS.length} screens\n`)
  let surprise = 0
  for (const f of uncovered) {
    const why = KNOWN_UNCOVERED[f]
    if (why) console.log(`  ·  ${f}\n     ${why}`)
    else { surprise++; console.log(`  ?  ${f}`) }
  }
  console.log(`\n  ${uncovered.length} uncovered — ${Object.keys(KNOWN_UNCOVERED).length} known, ${surprise} unexplained\n`)
  process.exit(0)
}

// ── The preview server ────────────────────────────────────────

const alive = async () => {
  try {
    const r = await fetch(APP, { signal: AbortSignal.timeout(2500) })
    return r.ok
  } catch { return false }
}

let server = null
async function ensureServer() {
  if (await alive()) return
  if (has('no-server')) {
    console.error(`\n  ${APP} is not answering, and --no-server was passed.\n`)
    process.exit(1)
  }
  if (!existsSync('dist/index.html')) {
    console.error('\n  No dist/. Run `npm run build` first.\n')
    process.exit(1)
  }
  console.log('  starting vite preview…')
  server = spawn('npx', ['vite', 'preview', '--port', '4173', '--host', '127.0.0.1'],
    { stdio: 'ignore', detached: false })
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 800))
    if (await alive()) return
  }
  console.error('\n  vite preview never came up.\n')
  process.exit(1)
}
const stopServer = () => { if (server) { try { server.kill() } catch {} server = null } }

// ── Fixtures ──────────────────────────────────────────────────

/** Fixtures may `extend` another; the child's seed wins key by key, and
 *  a null value means "delete this key" rather than "store null". */
function resolveFixture(name, seen = new Set()) {
  const f = FIXTURES[name]
  if (!f) throw new Error(`no fixture named ${name}`)
  if (seen.has(name)) throw new Error(`fixture ${name} extends itself`)
  seen.add(name)
  const base = f.extend ? resolveFixture(f.extend, seen) : { seed: {}, device: 'iPhone 13' }
  return {
    clock: f.clock ?? base.clock ?? null,
    device: f.device ?? base.device,
    reducedMotion: f.reducedMotion ?? base.reducedMotion ?? 'no-preference',
    seed: { ...base.seed, ...f.seed },
  }
}

/** Runs before every page load. Clears storage first, so one context can
 *  serve many screens without yesterday's state leaking into today's.
 *
 *  Every value is written as JSON text, because ls.get() (src/utils.js:70)
 *  JSON.parses whatever it finds. Writing a bare string is the mistake
 *  that costs an hour: `hf_seen_version` stored as 2.2 parses back as the
 *  NUMBER 2.2, never equals the version string, and the What's New modal
 *  sits over the app swallowing every click. */
function initScript([seed, clock]) {
  try { localStorage.clear() } catch {}
  for (const [k, v] of Object.entries(seed)) {
    if (v === null || v === undefined) continue
    localStorage.setItem(k, JSON.stringify(v))
  }
  if (clock) {
    const real = Date
    const fixed = new real(clock).getTime()
    class D extends real {
      constructor(...a) { return a.length ? new real(...a) : new real(fixed) }
      static now() { return fixed }
    }
    globalThis.Date = D
  }
}

// ── The step vocabulary ───────────────────────────────────────
//
// Every way of reaching a screen lives here, so the manifest stays data
// and a selector strategy is fixed in one place rather than thirty.

const navIndex = (id) => NAV_TABS.findIndex(t => t.id === id)

const STEPS = {
  // Nav tabs are addressed by index, not by label: «تمرين» is a
  // substring of «التمارين», so a name selector picks the wrong one.
  async tab(page, id) {
    const i = navIndex(id)
    if (i === -1) throw new Error(`no nav tab "${id}"`)
    await page.locator('nav > button').nth(i).click()
    await page.waitForTimeout(700)
  },
  async settings(page) {
    await page.getByRole('button', { name: 'الإعدادات' }).click()
    await page.waitForTimeout(700)
  },
  async aria(page, name) {
    await page.getByRole('button', { name }).first().click()
    await page.waitForTimeout(400)
  },
  // Several tappables in this app are divs with cursor:pointer, so a
  // role-based selector misses them.
  //
  // getByText, not `text=`: the engine selector treats its argument as a
  // literal substring, so a pattern like «تقرير|مارس» matched nothing and
  // waited thirty seconds to say so. getByText takes the RegExp.
  async text(page, needle) {
    const el = page.getByText(needle, { exact: false }).first()
    await el.scrollIntoViewIfNeeded().catch(() => {})
    await el.click({ timeout: 8000 })
    await page.waitForTimeout(500)
  },
  // Rows in the exercise library are anonymous buttons — no label worth
  // matching on, and the first few belong to the header.
  async clickNth(page, [selector, n]) {
    await page.locator(selector).nth(n).click({ timeout: 8000 })
    await page.waitForTimeout(500)
  },
  async click(page, selector) {
    await page.locator(selector).first().click({ position: { x: 5, y: 5 } })
    await page.waitForTimeout(300)
  },
  async openDetails(page) {
    await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true }))
    await page.waitForTimeout(300)
  },
  async scrollTo(page, text) {
    await page.getByText(text, { exact: false }).first()
      .scrollIntoViewIfNeeded().catch(() => {})
    await page.waitForTimeout(400)
  },
  // The report scrolls inside its own element and its sections carry
  // content-visibility:auto, so the page scroller does nothing here.
  async scrollReport(page, screens) {
    await page.evaluate((n) => {
      const el = [...document.querySelectorAll('div')]
        .find(d => /auto|scroll/.test(getComputedStyle(d).overflowY) && d.scrollHeight > d.clientHeight * 1.2)
      if (el) el.scrollTop = el.clientHeight * n
    }, screens)
    await page.waitForTimeout(900)
  },
  async settle(page, ms) { await page.waitForTimeout(ms) },
  async waitFor(page, needle) {
    await page.getByText(needle, { exact: false }).first().waitFor({ timeout: 10000 })
  },
}

// ── Proof a screen actually rendered ──────────────────────────

async function verify(page, screen, errors) {
  const fail = []
  if (errors.length) fail.push(`page error: ${errors[0].slice(0, 140)}`)

  const body = await page.evaluate(() => document.body.innerText.trim())
  if (body.length < 40) fail.push(`only ${body.length} chars of text on the page`)

  const e = screen.expect || {}
  if (e.text && !e.text.test(body)) fail.push(`expected text ${e.text} not on the page`)
  if (e.selector && await page.locator(e.selector).count() === 0) {
    fail.push(`expected ${e.selector} — not there`)
  }

  // The design-system invariant: one attribute moves the whole accent.
  // A fixture that silently failed to apply shows up here and nowhere
  // else, because the layout is identical either way.
  const mode = await page.evaluate(() => ({
    accent: getComputedStyle(document.documentElement).getPropertyValue('--cyan').trim(),
    deload: document.documentElement.getAttribute('data-deload'),
  }))
  if (e.accent && mode.accent !== e.accent) fail.push(`accent is ${mode.accent}, expected ${e.accent}`)
  if (e.deload !== undefined && (mode.deload === '1') !== !!e.deload) {
    fail.push(`data-deload is ${mode.deload}, expected ${e.deload ? '1' : 'absent'}`)
  }
  return { fail, mode }
}

/** A frame with no variance in it is a black rectangle, whatever the DOM
 *  said. This is the check the DOM cannot make. */
async function notBlank(buf) {
  const { channels } = await sharp(buf).stats()
  const spread = Math.max(...channels.map(c => c.stdev))
  return { ok: spread > 8, spread: +spread.toFixed(1) }
}

// ── Run ───────────────────────────────────────────────────────

const match = (id) => {
  if (!ONLY || ONLY === true) return true
  const re = new RegExp('^' + String(ONLY).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$')
  return re.test(id)
}

const wanted = SCREENS.filter(s => match(s.id))
if (!wanted.length) {
  console.error(`\n  --only ${ONLY} matched nothing.\n`)
  process.exit(1)
}

await ensureServer()
// A full run starts clean. An --only run must NOT: wiping the directory
// to re-shoot one screen deletes the other thirty-four, which is exactly
// what happened the first time this was used to iterate.
mkdirSync(OUT, { recursive: true })
if (!ONLY) {
  for (const f of readdirSync(OUT)) rmSync(path.join(OUT, f), { force: true })
} else {
  for (const s of wanted) rmSync(path.join(OUT, `${s.id}.png`), { force: true })
}

const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
const browser = await chromium.launch()
const results = []

// One context per fixture, one page per screen. The init script reseeds
// on every load, so a fresh page inside a shared context is a clean
// slate — and the browser is launched once, not thirty times.
const byFixture = new Map()
for (const s of wanted) {
  if (!byFixture.has(s.fixture)) byFixture.set(s.fixture, [])
  byFixture.get(s.fixture).push(s)
}

for (const [fixtureName, screens] of byFixture) {
  const f = resolveFixture(fixtureName)
  const ctx = await browser.newContext({
    ...devices[f.device], timezoneId: 'Asia/Riyadh', locale: 'ar',
    reducedMotion: f.reducedMotion,
  })
  // The art pack lives on R2. Blocked, every call site falls back to a
  // local asset or an emoji in the same box — layout, spacing and tokens
  // are unaffected, only the picture inside differs. Recorded per shot
  // as art:"fallback" so nobody reads a placeholder as the design.
  await ctx.route('**/*.r2.dev/**', r => r.abort())
  await ctx.addInitScript(initScript, [f.seed, f.clock])

  for (const screen of screens) {
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(String(e)))
    const row = { ...screen, fixtureResolved: f }

    try {
      await page.goto(APP, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1400)

      for (const step of screen.reach || []) {
        const [name, value] = Object.entries(step)[0]
        if (!STEPS[name]) throw new Error(`unknown step "${name}"`)
        await STEPS[name](page, value)
      }

      // Toasts live 3.2s (SystemAlert.jsx). Anything that is not a
      // photograph OF a toast waits them out first.
      if (!screen.noSettle) await page.waitForTimeout(3400)

      const { fail, mode } = await verify(page, screen, errors)

      const buf = await page.screenshot({
        fullPage: screen.shot === 'full',
        animations: 'disabled',   // no half-played glowPulse or shimmer
        caret: 'hide',
        scale: 'device',
      })
      const blank = await notBlank(buf)
      if (!blank.ok) fail.push(`the image is flat (stdev ${blank.spread}) — nothing rendered`)

      if (fail.length) {
        results.push({ ...row, ok: false, why: fail.join(' · ') })
      } else {
        const file = `${screen.id}.png`
        writeFileSync(path.join(OUT, file), buf)
        const meta = await sharp(buf).metadata()
        results.push({
          ...row, ok: true, file,
          width: meta.width, height: meta.height, bytes: buf.length,
          sha256: createHash('sha256').update(buf).digest('hex'),
          accent: mode.accent, deload: mode.deload === '1',
        })
      }
    } catch (err) {
      results.push({ ...row, ok: false, why: String(err.message || err).split('\n')[0].slice(0, 200) })
    }
    await page.close()
  }
  await ctx.close()
}

await browser.close()
stopServer()

// ── Index and report ──────────────────────────────────────────

const good = results.filter(r => r.ok)
const bad  = results.filter(r => !r.ok)

// Merge rather than replace: an --only run refreshes its own entries and
// leaves every other screen's entry standing.
const previous = (() => {
  try { return JSON.parse(readFileSync(path.join(OUT, 'index.json'), 'utf8')).screens || [] }
  catch { return [] }
})()
const kept = ONLY ? previous.filter(p => !good.some(g => g.id === p.id)) : []

const index = {
  app: 'meran',
  commit,
  capturedAt: new Date().toISOString(),
  locale: 'ar',
  dir: 'rtl',
  colorScheme: 'dark-only',
  note: 'Art-pack images are served from a CDN that is blocked during capture; '
      + 'every art slot falls back to a local asset or an emoji in the same box, '
      + 'so layout and tokens are exact and only the picture inside differs.',
  screens: [...kept, ...good.map(r => ({
    id: r.id,
    label: r.label,
    labelEn: r.labelEn,
    group: r.group,
    file: r.file,
    width: r.width,
    height: r.height,
    bytes: r.bytes,
    sha256: r.sha256,
    device: r.fixtureResolved.device,
    shot: r.shot,
    accent: r.accent,
    deload: r.deload,
    art: 'fallback',
    state: r.state,
    fixture: r.fixture,
    covers: r.covers || [],
  }))].sort((a, b) => a.id.localeCompare(b.id)),
}
writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n')

console.log()
for (const r of results) {
  console.log(`${r.ok ? '✅' : '❌'} ${r.id.padEnd(28)} ${r.ok ? `${r.width}×${r.height}` : `— ${r.why}`}`)
}
console.log(`\n  ${good.length} of ${results.length} captured → ${OUT}`)
if (bad.length) console.log(`  ${bad.length} failed\n`)
else console.log(`  index at ${path.join(OUT, 'index.json')}\n`)

process.exit(bad.length ? 1 : 0)
