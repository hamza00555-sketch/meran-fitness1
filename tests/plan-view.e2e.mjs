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
// حمزة again, on the first version: «مشاكل كثير في التصميم والتباين». So
// every line of text on «خطتي», its card sheet, the alternatives and the
// session swap is measured against the real pixels behind it (a screenshot
// with the text made transparent; the glyphs found by diffing it with the
// normal one) and must reach WCAG AA: 4.5:1, or 3:1 at 24px / 18.66px
// bold. The body figure must be 3:1 where it carries meaning (each lit
// state against every colour that touches it on screen), a card holds
// no box inside it, the English name sits under the Arabic on its edge
// (on the card and in its sheet), no green is drawn on the page and gold
// only on his best weight's figure — the player's colour for the same
// fact. The cards fade out under the day pills (a hairline once the day
// has scrolled), the pills' words sit in their middle, and «الأصلي» is a
// word over the name, not a badge on the machine.
//
// The pack is installed once, from Settings, the way pack-install.e2e
// does it: the preview serves dist/pack at /pack/.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { mkdirSync } from 'node:fs'
import { APP_VERSION, ACHIEVEMENTS, BUILT_IN_PLANS } from '../src/constants.js'
import { planTitle } from '../src/plan/title.js'
import { makeContrast } from './contrast.mjs'

const APP = process.env.APP || 'http://127.0.0.1:4901/'
const SHOTS = process.env.SHOTS || null
if (SHOTS) mkdirSync(SHOTS, { recursive: true })

const results = []
const ok = (name, cond, extra = '') => results.push([name, !!cond, extra])
let planBestColor = null   // the best weight's figure on «خطتي», compared with the player's

// His plan: the machines plan, on its Pull day today (index 7 of 3), with
// a set he added to the cable row (was: 4), his own 8–12 on the hammer
// press, and the pec deck remembered as its first alternative (the cable fly).
const machine = JSON.parse(JSON.stringify(BUILT_IN_PLANS.find(p => p.planId === 'machine_beginner_3day')))
machine.startDate = '2026-09-01'
// stored the day he started it, with the name as it was spelt then
const OLD_NAME = 'خطة المبتدأ — ماشينات فقط'
const NAME = planTitle(OLD_NAME)
machine.planName = OLD_NAME
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
  // a heavier day on the pulldown, before the last one: his best is more than last time
  sess(12, 1, [['Lat Pulldown', 'Back', 65, 8]]),
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
  const row = page.locator('.k-row').filter({ hasText: NAME }).first()
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

// ── Contrast, measured (tests/contrast.mjs) ──────────────────
// Every text run in view under some roots, against the real pixels behind
// its glyphs; AA: 4.5:1, or 3:1 for large text. `scroller` steps a
// scrolling box through its whole height so text below the fold counts.
const contrastLog = []
const { measure, neighbours, ratioOf, rgbOf } = await makeContrast(browser, page)
/* The grabber is the one sign a sheet pulls down to close: a control, 3:1 on the sheet. */
async function grabberContrast(label) {
  const c = await page.evaluate(() => {
    const g = [...document.querySelectorAll('.k-sheet .k-sheet-grab')].pop()
    const s = g?.closest('.k-sheet')
    return g && s ? { g: getComputedStyle(g).backgroundColor, s: getComputedStyle(s).backgroundColor } : null
  })
  const r = c ? ratioOf(rgbOf(c.g), rgbOf(c.s)) : 0
  ok(`${label} — the sheet's grabber shows: ${r.toFixed(2)}:1 on the sheet (≥ 3:1)`, r >= 3, JSON.stringify(c))
}
async function contrast(label, roots, opts = {}) {
  const r = await measure(roots, opts)
  contrastLog.push(`${label}: ${r.runs} text runs, lowest ${r.min.toFixed(2)}:1 (${r.minAt})`)
  ok(`${label} — every text run reaches ${opts.aaa ? 'AAA (7:1)' : 'AA'} against what is behind it (${r.runs} measured)`, r.runs > 0 && r.fails.length === 0, r.fails.slice(0, 6).join(' | '))
}
/* The body figure carries the day's muscles: 3:1 where it means something,
   against what really touches each part on the screen — the seams, the
   plates, the contour, the other lit state — not against one colour picked
   in the CSS. Each part is painted magenta once to find its pixels, and
   every colour within 1.5px outside them (3% of them or more) is compared. */
async function figureContrast(label, day) {
  const box = `.pv-page[data-page="${day}"] .pv-body`
  const parts = [['outline', '.pv-b-rim'], ['lit', '.pv-b-lit:not([data-s="some"])'], ['half-lit', '.pv-b-lit[data-s="some"]']]
  const said = [], bad = []
  for (const [name, sel] of parts) {
    const n = await neighbours(box, sel)
    if (!n) { if (name !== 'half-lit') bad.push(`${name}: not drawn`); continue }
    if (!n.marked || !n.neighbours.length) { bad.push(`${name}: no pixels found`); continue }
    said.push(`${name} ${n.min.toFixed(2)}`)
    for (const g of n.neighbours) if (g.ratio < 3) bad.push(`${name} rgb(${n.color}) vs rgb(${g.rgb}) ${g.ratio.toFixed(2)}:1 (${(g.share * 100).toFixed(1)}% of its neighbours)`)
  }
  ok(`${label} — the body figure reads against what touches it: ${said.join(', ')} (all ≥ 3:1)`, bad.length === 0, bad.join(' | '))
}
/* Palette: no green anywhere on «خطتي» (its pictures aside), and gold only
   on the figure of his best weight (.pv-best's number) — the raise/best
   colour, nothing else. */
async function noAccent(label) {
  const hits = await page.evaluate(() => {
    const bad = ['rgb(94, 195, 42)', 'rgb(251, 191, 36)', 'rgb(92, 201, 238)']
    const out = []
    for (const el of document.querySelectorAll('[data-testid="plan-view"] *')) {
      const cs = getComputedStyle(el)
      for (const p of ['color', 'backgroundColor', 'fill', 'borderTopColor']) {
        if (!bad.includes(cs[p]) || (p === 'color' && !el.textContent.trim())) continue
        // the best's figure: its text gold (and the border colour that follows it, drawn nowhere)
        if (cs[p] === 'rgb(251, 191, 36)' && el.matches('.pv-best .k-num, .pv-best .k-num *')
          && (p === 'color' || (p === 'borderTopColor' && cs.borderTopWidth === '0px'))) continue
        out.push(`${el.className?.baseVal ?? el.className} ${p}`)
      }
    }
    return out.slice(0, 4)
  })
  ok(`${label} — no green on the page, gold only on his best weight's figure`, hits.length === 0, hits.join(' | '))
}
/* The names block: the English directly under the Arabic, on the same right
   edge, and that edge beside the picture (nothing floating mid-row). */
async function namesBlock(root, arSel, enSel, artSel) {
  return page.locator(root).first().evaluate((c, [arSel, enSel, artSel]) => {
    const right = (el) => { const r = document.createRange(); r.selectNodeContents(el); return Math.max(...[...r.getClientRects()].map(x => x.right)) }
    const ar = c.querySelector(arSel), en = c.querySelector(enSel), art = c.querySelector(artSel)
    const a = ar.getBoundingClientRect(), e = en.getBoundingClientRect(), p = art.getBoundingClientRect()
    return { ar: Math.round(right(ar)), en: Math.round(right(en)), below: e.top >= a.bottom - 1, gapToArt: Math.round(p.left - right(ar)), artTop: Math.round(p.top), arTop: Math.round(a.top), artBottom: Math.round(p.bottom) }
  }, [arSel, enSel, artSel])
}
/* A day pill's words sit in its middle: as much room on the right as on the left. */
async function pillsCentred(label) {
  const r = await page.evaluate(() => [...document.querySelectorAll('.pv-tab')].map((t) => {
    const b = t.getBoundingClientRect()
    const range = document.createRange(); range.selectNodeContents(t)
    const rs = [...range.getClientRects()].filter(x => x.width > 1)
    const L = Math.min(...rs.map(x => x.left)), R = Math.max(...rs.map(x => x.right))
    return { day: t.innerText.replace(/\s+/g, ' '), right: Math.round(b.right - R), left: Math.round(L - b.left) }
  }))
  ok(`${label} — every day pill's words sit in its middle`, r.length > 0 && r.every(x => Math.abs(x.right - x.left) <= 2), JSON.stringify(r))
}
/* Where the cards go under the days: they fade out (a mask over the top of
   the day), a hairline once it has scrolled, none at the top. */
async function scrollEdge(label, day) {
  const pg = `.pv-page[data-page="${day}"]`
  const state = () => page.evaluate((pg) => {
    const v = document.querySelector('[data-testid="plan-view"]'), p = document.querySelector(pg)
    const cs = getComputedStyle(p)
    return {
      scrolled: v.hasAttribute('data-scrolled'),
      line: getComputedStyle(document.querySelector('.pv-pages')).boxShadow,
      mask: cs.maskImage || cs.webkitMaskImage || '',
      pad: parseFloat(cs.paddingTop),
    }
  }, pg)
  await page.locator(pg).evaluate(el => el.scrollTo(0, 0)); await settle(450)
  const top = await state()
  await page.locator(pg).evaluate(el => el.scrollTo(0, 260)); await settle(450)
  const mid = await state()
  await page.locator(pg).evaluate(el => el.scrollTo(0, 0)); await settle(450)
  const back = await state()
  const hairline = (s) => /rgba\(255, 255, 255, 0\.08\)/.test(s)
  ok(`${label} — the cards fade out under the days (a mask over the top), a hairline once the day scrolls, gone at its top`,
    /linear-gradient/.test(mid.mask) && mid.pad >= 4 && !top.scrolled && !hairline(top.line) && mid.scrolled && hairline(mid.line) && !back.scrolled,
    JSON.stringify({ top, mid, back }))
}

/* The alternatives: no half row left empty (a group with an odd count lays
   its last card across the row, the picture on the right, the names
   beside it); the meta line has no «·» that a wrap could leave at a
   line's start. */
async function altLayout(label) {
  const r = await page.evaluate(() => {
    const bad = []
    let wide = 0
    for (const grid of document.querySelectorAll('.k-sheet .ac-grid')) {
      const cards = [...grid.querySelectorAll(':scope > .ac')]
      const g = grid.getBoundingClientRect()
      const rows = new Map()
      for (const c of cards) { const b = c.getBoundingClientRect(); const k = Math.round(b.top); rows.set(k, (rows.get(k) || 0) + b.width) }
      for (const [top, w] of rows) if (w < g.width - 12) bad.push(`${grid.closest('.ac-group')?.dataset.group}: a row at ${top} filled ${Math.round(w)} of ${Math.round(g.width)}`)
      if (cards.length % 2) {
        const last = cards[cards.length - 1]
        const art = last.querySelector('.ac-art').getBoundingClientRect(), names = last.querySelector('.ac-names').getBoundingClientRect()
        wide++
        if (!(art.left > names.right - 1 && Math.abs(art.top + art.height / 2 - (names.top + names.height / 2)) < art.height / 2)) bad.push(`${last.dataset.name}: the picture not on the right of its names`)
      }
    }
    for (const el of document.querySelectorAll('.k-sheet .ac-meta *')) {
      const c = getComputedStyle(el, '::before').content
      if (c && c !== 'none' && c !== 'normal') bad.push(`${el.className}::before ${c}`)
    }
    return { bad, wide }
  })
  ok(`${label} — every row of the alternatives is full (${r.wide} odd last card${r.wide === 1 ? '' : 's'} across its row), no «·» to start a line`, r.bad.length === 0, r.bad.slice(0, 4).join(' | '))
}
/* A card's numbers: three columns as wide as what they hold, equal gaps
   between them, the outer two on the card's edges. */
async function statsRhythm(label, day) {
  const r = await page.locator(`.pv-page[data-page="${day}"] .pv-card`).evaluateAll((cards) => cards.slice(0, 3).map((c) => {
    const s = c.querySelector('.pv-stats'), cs = getComputedStyle(s), b = s.getBoundingClientRect()
    const L = b.left + parseFloat(cs.paddingLeft), R = b.right - parseFloat(cs.paddingRight)
    const cols = [...s.querySelectorAll('.pv-stat')].map(x => x.getBoundingClientRect()).sort((p, q) => q.left - p.left)
    const gaps = [cols[0].left - cols[1].right, cols[1].left - cols[2].right]
    return { gaps: gaps.map(Math.round), edges: [Math.round(R - cols[0].right), Math.round(cols[2].left - L)] }
  }))
  ok(`${label} — the numbers stand with equal gaps between them, edge to edge`, r.every(x => Math.abs(x.gaps[0] - x.gaps[1]) <= 1.5 && x.edges.every(e => Math.abs(e) <= 1)), JSON.stringify(r))
}
/* A centred footnote leaves no word alone on its last line: every line at least half the longest. */
async function noOrphans(label, sel) {
  const r = await page.evaluate((sel) => [...document.querySelectorAll(sel)].filter(p => p.offsetParent).map((p) => {
    const range = document.createRange()
    range.selectNodeContents(p)
    const lines = new Map()
    for (const b of range.getClientRects()) { if (b.width < 1) continue; const k = Math.round(b.top / 4); const l = lines.get(k) || [Infinity, -Infinity]; lines.set(k, [Math.min(l[0], b.left), Math.max(l[1], b.right)]) }
    const w = [...lines.values()].map(([a, b]) => b - a)
    return { text: p.textContent.slice(0, 24), lines: w.length, shortest: w.length > 1 ? Math.round(Math.min(...w) / Math.max(...w) * 100) : 100 }
  }), sel)
  ok(`${label} — no word left alone on a line (${r.map(x => `${x.lines} lines, shortest ${x.shortest}%`).join('; ')})`, r.length > 0 && r.every(x => x.shortest >= 50), JSON.stringify(r))
}
/* The card sheet's steppers: the discs of every row in one column, the number inside its slot. */
async function stepperColumn(label) {
  const r = await page.evaluate(() => [...document.querySelectorAll('.k-sheet .xs-step')].filter(s => s.querySelector('.xs-step-b')).map((s) => {
    const [dec, inc] = [...s.querySelectorAll('.xs-step-b')].map(b => b.getBoundingClientRect())
    const v = s.querySelector('.xs-step-v'), bv = v.querySelector('b')
    return { row: s.dataset.testid, dec: Math.round(dec.left), inc: Math.round(inc.left), fits: bv.scrollWidth <= v.clientWidth + 0.5 }
  }))
  const same = (k) => r.every(x => Math.abs(x[k] - r[0][k]) <= 1)
  ok(`${label} — the steppers' discs stand in one column, every number inside its slot`, r.length >= 3 && same('dec') && same('inc') && r.every(x => x.fits), JSON.stringify(r))
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
  const meta = await page.locator('.pv-page[data-page="1"] .pv-meta').innerText()
  ok('the day header: its muscles (the tab names the day), the count, the sets and minutes',
    /سحب/.test(await page.locator('.pv-page[data-page="1"]').getAttribute('aria-label'))
    && /ظهر/.test(await page.locator('.pv-page[data-page="1"] .pv-day-title').innerText())
    && /5 تمارين/.test(meta) && /مجموعة|مجموعات/.test(meta) && /≈\s*\d+ د/.test(meta), meta)
  ok('the day header: the muscles lit on the body', await page.locator('.pv-page[data-page="1"] .pv-body .pv-b-lit').count() > 0)
  const imgs = await page.locator('.pv-page[data-page="1"] [data-testid="plan-card"] .pv-art img').evaluateAll(els => els.map(i => i.src))
  ok('the cards show the machines\' own pictures, from the installed pack', imgs.length === 5 && imgs.every(s => s.startsWith('blob:')), imgs.slice(0, 2).join(' '))
  const lat = (await card(1, 'Lat Pulldown').innerText()).replace(/\s+/g, ' ')
  ok('a card: Arabic name, English, muscle, tool', /سحب أمامي/.test(lat) && /Lat Pulldown/.test(lat) && /ظهر · جهاز/.test(lat), lat)
  ok('a card: sets × his Settings reps (the template\'s 10 is not his) and rest', /4/.test(lat) && /12–15/.test(lat) && /راحة/.test(lat), lat)
  ok('a card: last time\'s weight × reps, and his best because it is more', /آخر مرة 62\.5 كجم × 10/.test(lat) && /أعلى 67\.5 كجم/.test(lat), lat)
  const row = (await card(1, 'Seated Cable Row').innerText()).replace(/\s+/g, ' ')
  ok('a set he added says so: «مجموعة زيادة», on 5 sets', /مجموعة زيادة/.test(row) && /\b5\b/.test(row), row)
  ok('his best is not said again when it is last time\'s weight', /آخر مرة 57\.5 كجم/.test(row) && !/أعلى/.test(row), row)
  ok('nothing changed, nothing said: no note on the pulldown', await card(1, 'Lat Pulldown').locator('.pv-note').count() === 0)
  // the name: the stored plan's old spelling printed right, the stored plan untouched
  const sub = await page.locator('.pv-title p').innerText()
  ok('the plan\'s name reads «خطة المبتدئ», his stored plan left as it was', sub === NAME && (await get('hf_plan')).planName === OLD_NAME, sub)
  // the English under the Arabic, on its edge; no box inside a card; no number on the picture
  const edges = await card(1, 'Lat Pulldown').evaluate((c) => {
    const right = (el) => { const r = document.createRange(); r.selectNodeContents(el); return Math.max(...[...r.getClientRects()].map(x => x.right)) }
    const ar = c.querySelector('.pv-ar'), en = c.querySelector('.pv-en')
    return { ar: right(ar), en: right(en), below: en.getBoundingClientRect().top >= ar.getBoundingClientRect().bottom - 1 }
  })
  ok('the English name sits under the Arabic, on the same edge', edges.below && Math.abs(edges.ar - edges.en) <= 2, JSON.stringify(edges))
  // his best, in the player's colour for it: the figure gold, the words not
  const best = await card(1, 'Lat Pulldown').evaluate((c) => {
    const b = c.querySelector('.pv-best')
    return b ? { words: getComputedStyle(b).color, num: getComputedStyle(b.querySelector('.k-num')).color } : null
  })
  ok('his best weight: the figure gold (rgb 251 191 36), its words not', best?.num === 'rgb(251, 191, 36)' && best.words !== best.num, JSON.stringify(best))
  planBestColor = best?.num
  await pillsCentred('390')
  await scrollEdge('390: pull day', 1)
  const boxes = await page.locator('.pv-page[data-page="1"] [data-testid="plan-card"]').first().evaluate((c) => [...c.querySelectorAll('*')]
    .filter(el => !el.closest('button.pv-swap') && (() => { const cs = getComputedStyle(el); return !/rgba\(.*,\s*0\)|transparent/.test(cs.backgroundColor) || (cs.boxShadow !== 'none' && !el.matches('img')) || cs.borderTopWidth !== '0px' && !el.matches('.pv-stats') })())
    .map(el => String(el.className?.baseVal ?? el.className)))
  ok('a card holds no box inside it (one surface, a hairline over the numbers)', boxes.length === 0, boxes.join(', '))
  ok('no number on the picture', await page.locator('.pv-card .pv-n').count() === 0)
  await figureContrast('390: pull day', 1)
  await statsRhythm('390: pull day', 1)
  // the day tabs are the builder's day pills: the one shown filled white, no underline
  const tabStyle = await page.evaluate(() => {
    const cs = (el, p) => getComputedStyle(el, p)
    const sel = document.querySelector('.pv-tab[aria-selected="true"]'), other = document.querySelector('.pv-tab[aria-selected="false"]')
    return { sel: cs(sel).backgroundColor, selR: cs(sel).borderTopLeftRadius, other: cs(other).backgroundColor, after: cs(sel, '::after').content }
  })
  ok('the day tabs are the builder\'s pills: the one shown white, the others on a surface, no underline',
    tabStyle.sel === 'rgb(244, 246, 248)' && tabStyle.selR === '18px' && tabStyle.other !== 'rgba(0, 0, 0, 0)' && /none|normal/.test(tabStyle.after), JSON.stringify(tabStyle))
  ok('a tab says only a true mark under its day (no count of exercises)', !/تمارين|تمرين/.test(await page.locator('.pv-tabs').innerText()))
  await noAccent('390: «خطتي»')
  await contrast('390: «خطتي», pull day (top to bottom)', '[data-testid="plan-view"]', { scroller: '.pv-page[data-page="1"]' })
  // what he reads to understand a card, the day and the tabs: no faint grey at all
  await contrast('390: the cards, the day header, the tabs, the title', '.pv-top, .pv-tabs, .pv-page[data-page="1"] .pv-day, .pv-page[data-page="1"] .pv-card',
    { scroller: '.pv-page[data-page="1"]', aaa: true })
  await shot('390-plan-view-today')
  await page.locator('.pv-tab[data-day="0"]').click(); await settle(1100)
  ok('a tab moves to its day', (await page.locator('.pv-tab[aria-selected="true"]').innerText()).includes('دفع'))
  const fly = card(0, 'Cable Fly')
  ok('a remembered swap shows what he really does: the cable fly, «بدّلته بدل» the pec deck',
    await fly.count() === 1 && /بدّلته بدل تفتيح جهاز \(بك دك\)/.test((await fly.innerText()).replace(/\s+/g, ' ')))
  const ham = (await card(0, 'Hammer Strength Machine Bench Press').innerText()).replace(/\s+/g, ' ')
  ok('his own reps: 8–12, «عدّاتك أنت»', /8–12/.test(ham) && /عدّاتك أنت/.test(ham), ham)
  await figureContrast('390: push day', 0)
  await contrast('390: «خطتي», push day (top to bottom)', '[data-testid="plan-view"]', { scroller: '.pv-page[data-page="0"]' })
  await shot('390-plan-view-push')
  // a swipe to the next day moves the tab with it
  await page.locator('.pv-pages').evaluate(el => el.scrollTo({ left: -el.clientWidth * 2, behavior: 'auto' })); await settle(700)
  ok('a swipe to a day moves its tab', (await page.locator('.pv-tab[aria-selected="true"]').innerText()).includes('أرجل'))
  await noOverflow('390: the plan view')
  await noCrowding('390: the cards')
  for (const w of [320, 430]) {
    await page.setViewportSize({ width: w, height: w === 320 ? 568 : 932 }); await settle(600)
    await noOverflow(`${w}: the plan view`)
    if (w === 430) {
      await page.locator('.pv-tab[data-day="1"]').click(); await settle(900)
      await statsRhythm('430: pull day', 1)
      await pillsCentred('430')
      await scrollEdge('430: pull day', 1)
    }
    if (w === 320) {
      await page.locator('.pv-tab[data-day="1"]').click(); await settle(900)
      await statsRhythm('320: pull day', 1)
      await pillsCentred('320')
      await scrollEdge('320: pull day', 1)
      await page.locator('.pv-page[data-page="1"]').evaluate(el => el.scrollTo(0, el.scrollHeight)); await settle(500)
      await noOrphans('320: the note under «عدّل الخطة كاملة»', '.pv-page[data-page="1"] .pv-end p')
      await page.locator('.pv-page[data-page="1"]').evaluate(el => el.scrollTo(0, 0)); await settle(400)
      await shot('320-plan-view')
      await contrast('320: «خطتي», pull day (top)', '[data-testid="plan-view"]')
      // the card sheet at 320: its rows keep the gutter on both sides
      await card(1, 'Seated Cable Row').click(); await settle(900)
      const g = await page.evaluate(() => {
        const body = document.querySelector('.k-sheet-body')
        const b = body.getBoundingClientRect(), cs = getComputedStyle(body)
        const L = b.left + parseFloat(cs.paddingLeft), R = b.right - parseFloat(cs.paddingRight)
        return ['.xs-head', '.xs-actions', '.xs-steps', '.xs-end'].map(s => {
          const r = document.querySelector(s).getBoundingClientRect()
          return { s, ok: r.left >= L - 1 && r.right <= R + 1, l: Math.round(r.left), r: Math.round(r.right), L: Math.round(L), R: Math.round(R) }
        })
      })
      ok('320: the card sheet keeps its gutter on both sides', g.every(x => x.ok), JSON.stringify(g.filter(x => !x.ok)))
      const nb = await namesBlock('.k-sheet .xs-head', '.xs-ar', '.xs-en', '.xs-art')
      ok('320: the card sheet\'s English sits under its Arabic, on the same edge, beside the picture',
        nb.below && Math.abs(nb.ar - nb.en) <= 2 && nb.gapToArt >= 10 && nb.gapToArt <= 20, JSON.stringify(nb))
      await stepperColumn('320: the card sheet')
      await noOrphans('320: the card sheet\'s footnote', '.k-sheet .xs-foot')
      await contrast('320: the card sheet', '.k-sheet', { scroller: '.k-sheet-body' })
      await shot('320-card-sheet')
      // its alternatives at 320: a one-line title, the exercise named under it
      await page.locator('[data-testid="xs-swap"]').click(); await settle(900)
      const t = await page.evaluate(() => ({
        lines: document.querySelector('.k-sheet [data-testid="xs-title"]').getClientRects().length,
        title: document.querySelector('.k-sheet [data-testid="xs-title"]').textContent,
        keeps: document.querySelector('[data-testid="xs-keeps"]').innerText.replace(/\s+/g, ' '),
      }))
      ok('320: the alternatives\' title fits one line beside ‹ and ×, the exercise named under it',
        t.lines === 1 && /^بدّل التمرين$/.test(t.title) && /^تجديف كيبل جالس يبقى نفس نظامه/.test(t.keeps), JSON.stringify(t))
      await altLayout('320: the alternatives')
      await noOverflow('320: the alternatives', '.k-sheet')
      await contrast('320: the alternatives', '.k-sheet', { scroller: '.k-sheet-body' })
      await page.locator('.k-sheet [aria-label="إغلاق"]').click(); await settle(600)
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
  // «بدّله» on a card: the sheet opens on the alternatives, a back arrow to its first page
  await card(1, 'Lat Pulldown').locator('[data-testid="plan-card-swap"]').click(); await settle(900)
  ok('«بدّله» on a card opens the sheet straight on the alternatives',
    await page.locator('[data-testid="exercise-sheet"][data-mode="swap"]').count() === 1 && await page.locator('.k-sheet [data-testid="alt-card"]').count() >= 4)
  ok('the alternatives say what the swap keeps: «4 × 12–15 · راحة 2 د»', /4 × 12–15 · راحة 2 د/.test((await page.locator('[data-testid="xs-keeps"]').innerText()).replace(/\s+/g, ' ')))
  await page.locator('[data-testid="sheet-back"]').click(); await settle(700)
  ok('its back arrow turns to the sheet\'s first page', await page.locator('[data-testid="exercise-sheet"][data-mode="main"]').count() === 1
    && await page.locator('[data-testid="sheet-back"]').count() === 0)
  await page.locator('.k-sheet [aria-label="إغلاق"]').click(); await settle(600)

  await card(1, 'Lat Pulldown').click(); await settle(800)
  ok('a card opens its sheet', await page.locator('[data-testid="exercise-sheet"]').count() === 1)
  // its names together beside the picture, as on the card: the title says
  // what the sheet does, not the Arabic name split from its English
  const xs = await namesBlock('.k-sheet .xs-head', '.xs-ar', '.xs-en', '.xs-art')
  ok('the card sheet: «عدّل التمرين», then the Arabic name with the English right under it, on its edge, beside the picture',
    (await page.locator('.k-sheet [data-testid="xs-title"]').innerText()) === 'عدّل التمرين'
    && (await page.locator('.k-sheet [data-testid="xs-name"]').innerText()) === 'سحب أمامي'
    && xs.below && Math.abs(xs.ar - xs.en) <= 2 && xs.gapToArt >= 10 && xs.gapToArt <= 20, JSON.stringify(xs))
  await shot('390-card-sheet')
  await noOverflow('390: a card\'s sheet', '.k-sheet')
  await contrast('390: the card sheet', '.k-sheet', { scroller: '.k-sheet-body' })
  await contrast('390: the card sheet\'s names, actions and steppers', '.k-sheet-h, .xs-head, .xs-actions, .xs-steps', { aaa: true })
  await grabberContrast('390: the card sheet')
  await stepperColumn('390: the card sheet')
  await page.locator('[data-testid="xs-swap"]').click(); await settle(800)
  await contrast('390: the alternatives', '.k-sheet', { scroller: '.k-sheet-body' })
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
  await altLayout('390: the alternatives')
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
  await contrast('390: «تراجع» in the card\'s place', '[data-testid="plan-undo"]')
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
  await page.setViewportSize({ width: 320, height: 568 }); await settle(600)
  await noOrphans('320: «جلستك شغّالة»', '.pv-live')
  await shot('320-plan-view-session')
  await page.setViewportSize({ width: 390, height: 844 }); await settle(500)
  await closeView()
  // the player's «أعلى وزن» and «خطتي»'s «أعلى»: one fact, one colour
  const playerBest = await page.evaluate(() => {
    const n = document.querySelector('.s-meta-part[data-best="1"] .k-num')
    return n ? getComputedStyle(n).color : null
  })
  ok('his best weight is the same gold in the player and on «خطتي»', playerBest && playerBest === planBestColor, `${playerBest} vs ${planBestColor}`)
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
  ok('session swap: nothing in the upcoming strip looks picked (no ring, no card)', await sheet.locator('[data-testid="swap-upcoming"] li').evaluateAll(els => els.every(li => {
    const cs = getComputedStyle(li); return cs.boxShadow === 'none' && /rgba\(.*,\s*0\)|transparent/.test(cs.backgroundColor)
  })))
  await contrast('390: the session swap, a pick made', '.k-sheet', { scroller: '.k-sheet-body' })
  await grabberContrast('390: the session swap')
  await altLayout('390: the session swap')
  await shot('390-session-swap')
  await noOverflow('390: the session swap', '.k-sheet')
  await page.setViewportSize({ width: 320, height: 568 }); await settle(600)
  await noOverflow('320: the session swap', '.k-sheet')
  await altLayout('320: the session swap')
  // the strip of what comes next fades at its far edge: the one cut there reads as «more»
  const strip = await page.locator('[data-testid="swap-upcoming"] ol').evaluate((ol) => {
    const cs = getComputedStyle(ol)
    return { mask: cs.maskImage || cs.webkitMaskImage, more: ol.scrollWidth > ol.clientWidth + 1 }
  })
  ok('320: «بعده بالجلسة» fades out at its far edge where more is cut off', strip.more && /linear-gradient/.test(strip.mask), JSON.stringify(strip))
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
  const orig = await sheet.locator('.ac-group[data-group="original"] [data-testid="alt-card"]').evaluate((c) => {
    const t = c.querySelector('.ac-tag'), a = c.querySelector('.ac-art').getBoundingClientRect(), ar = c.querySelector('.ac-ar').getBoundingClientRect()
    const b = t?.getBoundingClientRect()
    return t ? {
      text: t.textContent, inArt: !!t.closest('.ac-art'),
      overlaps: !(b.right <= a.left || b.left >= a.right || b.bottom <= a.top || b.top >= a.bottom),
      aboveName: b.bottom <= ar.top + 1,
    } : null
  })
  ok('«الأصلي» is a word over its name, nothing drawn on the machine\'s picture', orig?.text === 'الأصلي' && !orig.inArt && !orig.overlaps && orig.aboveName, JSON.stringify(orig))
  await shot('390-session-swap-original')
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
console.log('\ncontrast, measured:\n  ' + contrastLog.join('\n  '))
await browser.close()
const failed = results.filter(r => !r[1]).length
console.log(failed ? `\n${failed} failed` : `\nall ${results.length} passed`)
process.exit(failed ? 1 : 0)
