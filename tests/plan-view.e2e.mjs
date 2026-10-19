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
// And «تسويها بالجلسة» (section 5): his case — the machines plan, whose leg
// day has no hip abduction or adduction, and leg sessions that had both —
// shows the two as cards of their own under the day's, said on the day's
// header; «ثبّته بخطتي» writes one into his plan (the card moving up into
// the list), «ثبّت كلهم» both in one edit, «مو هنا» waves one off for good;
// the old design reads the plan; the new cards and their answers are
// measured like the rest (text AA, the controls 3:1 on the ground) at 320,
// 390 and 430; every English name on the day whole, in two lines at most.
//
// Section 6, only what he added: his leg sessions hold every row the plan
// put in them, so a row he takes out («شيله», or left out in the builder)
// or swaps away twice must not come back as «مو بخطتك», and after a switch
// from Settings (or a plan rebuilt today, its leg day of the same name)
// no day offers the old plan's exercises.
//
// The pack is installed once, from Settings, the way pack-install.e2e
// does it: the preview serves dist/pack at /pack/.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { mkdirSync } from 'node:fs'
import { APP_VERSION, ACHIEVEMENTS, BUILT_IN_PLANS } from '../src/constants.js'
import { planTitle } from '../src/plan/title.js'
import { arabicName } from '../src/exerciseMedia.js'
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
    // (meran_rest_announced: each seed is a first run for «كسبت يوم راحة»,
    // which says nothing of rest days he already had — no sheet over Home)
    for (const k of ['hf_active', 'hf_rest_timer', 'hf_plan_prev', 'meran_plan_dismissed', 'meran_plan_dropped', 'meran_rest_announced', 'meran_rotate_off']) localStorage.removeItem(k)
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
    // The two greens touch each other: told apart by depth (≥ 1.4:1), the
    // plates and seams around them carry the 3:1.
    const isGreen = (rgb) => { const [r, g2, b] = (Array.isArray(rgb) ? rgb : String(rgb).split(',')).map(Number); return g2 > r + 40 && g2 > b + 40 }
    for (const g of n.neighbours) if (g.ratio < (name !== 'outline' && isGreen(g.rgb) ? 1.4 : 3)) bad.push(`${name} rgb(${n.color}) vs rgb(${g.rgb}) ${g.ratio.toFixed(2)}:1 (${(g.share * 100).toFixed(1)}% of its neighbours)`)
  }
  ok(`${label} — the body figure reads against what touches it: ${said.join(', ')} (≥ 3:1 against plates, seams and contour; the two greens ≥ 1.4:1)`, bad.length === 0, bad.join(' | '))
}
/* Palette: no green anywhere on «خطتي» (its pictures and the body figure's
   muscles aside — Hamza chose green for those), and gold only
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
        // the day's muscles on the body: green by his choice
        if (cs[p] === 'rgb(94, 195, 42)' && p === 'fill' && el.matches('.pv-body .pv-b-lit')) continue
        out.push(`${el.className?.baseVal ?? el.className} ${p}`)
      }
    }
    return out.slice(0, 4)
  })
  ok(`${label} — no green on the page but the body's muscles, gold only on his best weight's figure`, hits.length === 0, hits.join(' | '))
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
/* A control's sign — its icon — against what it sits on: 3:1 (WCAG 1.4.11). */
async function controlContrast(label, sels) {
  const r = await page.evaluate((sels) => {
    const clear = (c) => /rgba\(.*,\s*0\)|transparent/.test(c)
    const bgOf = (el) => { for (let a = el; a; a = a.parentElement) { const c = getComputedStyle(a).backgroundColor; if (!clear(c)) return c } return 'rgb(3, 4, 4)' }
    const out = []
    for (const s of sels) for (const el of document.querySelectorAll(s)) if (el.getBoundingClientRect().width) out.push([s, getComputedStyle(el).color, bgOf(el.parentElement)])
    return out
  }, sels)
  const bad = [], said = new Set()
  for (const [s, c, bg] of r) {
    const x = ratioOf(rgbOf(c), rgbOf(bg))
    said.add(`${s.split(' ').slice(-2).join(' ')} ${x.toFixed(2)}`)
    if (!(x >= 3)) bad.push(`${s}: ${c} on ${bg} ${x.toFixed(2)}:1`)
  }
  ok(`${label} — the controls' signs stand out at 3:1 or more: ${[...said].join(', ')}`, r.length > 0 && bad.length === 0, bad.join(' | '))
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
  ok('a planned session says which plan it is a day of (planId, an optional field)', a2.planId === 'machine_beginner_3day', String(a2.planId))
  ok('«دايماً بخطتي» from the plan\'s own row: nothing noted as gone (the row says it was the pulldown)', !(await get('meran_plan_dropped')), JSON.stringify(await get('meran_plan_dropped')))
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

// ── 5. «تسويها بالجلسة»: what he does on a day that his plan doesn't say ─
// حمزة: «في خطتي تمارين الرجلين مالقيت تمرين abdication و addactor معناها في
// تمارين كثير مو مضافه». His last four leg days: the hip abduction and
// adduction machines added in the session in three of them (once logged
// under the mapping's «Hip Adduction»), a lunge once. Under the leg day's
// cards: the two, as cards of their own, «ثبّته بخطتي» / «ثبّت كلهم» /
// «مو هنا»; the old design reads the plan they go into.
{
  const AB = 'Machine Hip Abduction', AD = 'Machine Hip Adduction'
  // a leg day as the plan puts it in his session — all six of its rows — and what he adds
  const LEG_ROWS = [['Hack Squat', 'Legs', 100, 10], ['Leg Press', 'Legs', 160, 10], ['Leg Curl', 'Legs', 45, 12],
    ['Leg Extension', 'Legs', 50, 12], ['Machine Glute Kickbacks', 'Legs', 30, 12], ['Standing Calf Raise', 'Legs', 50, 10]]
  const legDay = (daysAgo, extra, rows = LEG_ROWS) => sess(daysAgo, 5, [...rows, ...extra])
  const HIS = [
    ...SESSIONS.filter(s => s.planDayIndex % 3 !== 2),
    legDay(1, [[AB, 'Legs', 30, 12], [AD, 'Legs', 25, 12]]),
    legDay(4, [[AB, 'Legs', 27.5, 12], ['Hip Adduction', 'Legs', 25, 10]]),
    legDay(8, [['Lunge', 'Legs', 20, 10]]),
    legDay(11, [[AB, 'Legs', 25, 12], [AD, 'Legs', 22.5, 12]]),
  ]
  const LEGS = '.pv-page[data-page="2"]'
  const extra = (name) => page.locator(`${LEGS} [data-testid="extra-card"][data-name="${name}"]`)
  const legsPlan = async () => (await get('hf_plan')).weeklySchedule[2].exercises
  const toLegs = async () => { await page.locator('.pv-tab[data-day="2"]').click(); await settle(1100) }
  const toExtras = async () => { await page.locator(`${LEGS} [data-testid="plan-extra-note"]`).click(); await settle(900) }
  // the new controls tell themselves from the ground at 3:1: the cards'
  // dashed edge, the header's note, «ثبّته بخطتي», «ثبّت كلهم»; «مو هنا» is a word
  async function uiContrast(label) {
    const r = await page.evaluate((LEGS) => {
      const ground = getComputedStyle(document.querySelector('[data-testid="plan-view"]')).backgroundColor
      const edge = (el) => { const cs = getComputedStyle(el); return cs.borderTopStyle !== 'none' && parseFloat(cs.borderTopWidth) > 0 ? cs.borderTopColor : (cs.boxShadow.match(/rgba?\([^)]*\)/) || [])[0] }
      const fill = (el) => getComputedStyle(el).backgroundColor
      const out = []
      const q = (s) => [...document.querySelectorAll(`${LEGS} ${s}`)]
      for (const el of q('.pv-xcard')) out.push(['the card\'s dashed edge', edge(el), getComputedStyle(el).borderTopStyle])
      for (const el of q('.pv-xnote')) out.push(['the header\'s note', edge(el), getComputedStyle(el).borderTopStyle])
      for (const el of q('.pv-xacts .pv-pin')) out.push(['«ثبّته بخطتي»', fill(el), 'fill'])
      for (const el of q('.pv-pin-all')) out.push(['«ثبّت كلهم»', edge(el), 'outline'])
      return { ground, out }
    }, LEGS)
    const bad = [], said = []
    for (const [what, c, how] of r.out) {
      const x = ratioOf(rgbOf(c), rgbOf(r.ground))
      said.push(`${what} ${x.toFixed(2)}`)
      if (!(x >= 3)) bad.push(`${what} (${how}) ${c} on ${r.ground}: ${x.toFixed(2)}:1`)
    }
    ok(`${label} — the new controls stand out from the ground at 3:1 or more: ${[...new Set(said)].join(', ')}`, r.out.length >= 4 && bad.length === 0, bad.join(' | '))
  }

  await seed({ hf_sessions: HIS })
  await openFromHome()
  await toLegs()
  const note = page.locator(`${LEGS} [data-testid="plan-extra-note"]`)
  ok('his legs: the day\'s header says «+2 تسويها بالجلسة»', await note.count() === 1 && /\+2\s*تسويها بالجلسة/.test((await note.innerText()).replace(/\s+/g, ' ')),
    await note.innerText().catch(() => ''))
  ok('the other days: nothing to say (all they had is in the plan)', await page.locator('[data-testid="plan-extra-note"]').count() === 1
    && await page.locator('[data-testid="extra-card"]').count() === 2)
  await shot('390-legs-suggested-top')
  await toExtras()
  const secTop = await page.locator(`${LEGS} .pv-extra`).evaluate(el => Math.round(el.getBoundingClientRect().top - el.closest('.pv-page').getBoundingClientRect().top))
  ok('the note takes him down to them', secTop >= 0 && secTop < 80, `section ${secTop}px under the top of the day`)
  const cards = page.locator(`${LEGS} [data-testid="extra-card"]`)
  ok('his legs: the two he does — the abduction and adduction machines — as cards after the plan\'s', await cards.count() === 2
    && JSON.stringify(await cards.evaluateAll(els => els.map(e => e.dataset.name))) === JSON.stringify([AB, AD])
    && await page.locator(`${LEGS} .pv-list:not(.pv-xlist) [data-testid="plan-card"]`).count() === 6)
  const abText = (await extra(AB).innerText()).replace(/\s+/g, ' ')
  ok('a card: marked «تسويه بالجلسة — مو بخطتك», its names, muscle and tool', /تسويه بالجلسة — مو بخطتك/.test(abText) && /فتح ورك جهاز/.test(abText)
    && /Machine Hip Abduction/.test(abText) && /أرجل · جهاز/.test(abText), abText)
  ok('a card: his last weight × reps and the sets he did, and how often', /آخر مرة 32\.5 كجم × 12 عدّة · 3 مجموعات/.test(abText) && /سوّيته بـ3 من آخر 4 جلسات/.test(abText), abText)
  ok('the one he logged under the mapping\'s «Hip Adduction» is the same machine', /ضم ورك جهاز/.test(await extra(AD).innerText()) && /سوّيته بـ3 من آخر 4/.test(await extra(AD).innerText()))
  ok('a one-off (the lunge, once in four) is not offered', await extra('Lunge').count() === 0)
  const ximgs = await cards.locator('.pv-art img').evaluateAll(els => els.map(i => i.src))
  ok('the cards show the machines\' pictures, from the pack', ximgs.length === 2 && ximgs.every(s => s.startsWith('blob:')), ximgs.join(' '))
  ok('a card offers «ثبّته بخطتي» and «مو هنا»; «ثبّت كلهم» over the two', await cards.locator('[data-testid="extra-pin"]').count() === 2
    && await cards.locator('[data-testid="extra-dismiss"]').count() === 2 && await page.locator(`${LEGS} [data-testid="extra-pin-all"]`).count() === 1)
  const xboxes = await extra(AB).evaluate((c) => [...c.querySelectorAll('*')]
    .filter(el => !el.closest('button.pv-pin, button.pv-skip') && (() => { const cs = getComputedStyle(el); return !/rgba\(.*,\s*0\)|transparent/.test(cs.backgroundColor) || (cs.boxShadow !== 'none' && !el.matches('img')) || cs.borderTopWidth !== '0px' })())
    .map(el => String(el.className?.baseVal ?? el.className)))
  ok('a card holds no box inside it (its answers aside)', xboxes.length === 0, xboxes.join(', '))
  const ground = await extra(AB).evaluate((c) => ({ bg: getComputedStyle(c).backgroundColor, style: getComputedStyle(c).borderTopStyle, plan: getComputedStyle(c.closest('.pv-page').querySelector('[data-testid="plan-card"]')).backgroundColor }))
  ok('not a plan card: no surface, a dashed edge (a plan card has its surface)', /rgba\(.*,\s*0\)|transparent/.test(ground.bg) && ground.style === 'dashed' && ground.plan !== ground.bg, JSON.stringify(ground))
  await noAccent('390: «خطتي» with «تسويها بالجلسة»')
  await uiContrast('390: «تسويها بالجلسة»')
  await contrast('390: the leg day with «تسويها بالجلسة» (top to bottom)', `${LEGS}`, { scroller: LEGS })
  await contrast('390: «تسويها بالجلسة» — the note, the heading, the cards and their answers', `${LEGS} .pv-xnote, ${LEGS} .pv-extra`, { scroller: LEGS })
  await noOverflow('390: «تسويها بالجلسة»')
  await toExtras()
  await shot('390-legs-suggested')
  for (const w of [320, 430]) {
    await page.setViewportSize({ width: w, height: w === 320 ? 568 : 932 }); await settle(700)
    await toExtras()
    await noOverflow(`${w}: «تسويها بالجلسة»`)
    const fit = await page.evaluate((LEGS) => [...document.querySelectorAll(`${LEGS} .pv-xtag, ${LEGS} .pv-xacts, ${LEGS} .pv-xnote`)].map(el => ({ c: el.className, lines: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight || 20)), over: el.scrollWidth > el.clientWidth + 1 })), LEGS)
    ok(`${w}: the mark, the answers and the note each keep to their line`, fit.every(x => !x.over) && fit.filter(x => /pv-xtag/.test(x.c)).every(x => x.lines <= 1), JSON.stringify(fit))
    // the English names whole — on his own cases and on the day's cards («Machine Hip Abducti…» at 320 before)
    const ens = await page.evaluate((LEGS) => [...document.querySelectorAll(`${LEGS} .pv-en`)].map(el => ({
      t: el.textContent, whole: el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1,
      lines: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)),
    })), LEGS)
    ok(`${w}: every English name on the leg day is whole (two lines at most)`, ens.length >= 8 && ens.every(x => x.whole && x.lines <= 2),
      JSON.stringify(ens.filter(x => !x.whole || x.lines > 2).concat(ens.filter(x => x.lines === 2).map(x => ({ twoLines: x.t })))))
    await uiContrast(`${w}: «تسويها بالجلسة»`)
    await contrast(`${w}: «تسويها بالجلسة»`, `${LEGS} .pv-extra`, { scroller: LEGS })
    if (w === 320) { await toExtras(); await shot('320-legs-suggested') }
  }
  await page.setViewportSize({ width: 390, height: 844 }); await settle(600)

  // «ثبّته بخطتي» on the abduction machine: into the plan, the card flies up into the list
  await toExtras()
  const before = await legsPlan()
  await extra(AB).locator('[data-testid="extra-pin"]').click()
  const flying = await page.evaluate((LEGS) => {
    const el = [...document.querySelectorAll(`${LEGS} .pv-list [data-testid="plan-card"]`)].find(c => c.dataset.name === 'Machine Hip Abduction')
    return el ? el.getAnimations().map(a => JSON.stringify(a.effect.getKeyframes()[0].transform || '')).filter(t => /translate/.test(t)).length : -1
  }, LEGS)
  ok('«ثبّته بخطتي»: the card moves into the plan\'s list (it flies from where it stood)', flying > 0, `animations: ${flying}`)
  await settle(1200)
  const after = await legsPlan()
  const row = after.at(-1)
  ok('«ثبّته بخطتي»: his leg day has it, at its end — his usual 3 sets, Settings\' 12–15 (not his own), the 90 s rest',
    after.length === before.length + 1 && row.name === AB && row.muscle === 'Legs' && row.sets === 3 && row.repsMin === 12 && row.repsMax === 15
    && !row.repsOwn && row.restSeconds === 90, JSON.stringify(row))
  ok('«ثبّته بخطتي»: free — the day he reached and the streak\'s rule untouched', await get('hf_plan_index') === 7 && !(await get('hf_recovery'))?.lastSettingsChangeAt)
  ok('«ثبّته بخطتي»: a plan card now, and one card left to pin; the note says «+1 تسويه بالجلسة»',
    await page.locator(`${LEGS} .pv-list [data-testid="plan-card"][data-name="${AB}"]`).count() === 1 && await cards.count() === 1
    && /\+1\s*تسويه بالجلسة/.test((await note.innerText()).replace(/\s+/g, ' ')) && await page.locator(`${LEGS} [data-testid="extra-pin-all"]`).count() === 0)
  const pinnedText = (await page.locator(`${LEGS} .pv-list [data-testid="plan-card"][data-name="${AB}"]`).innerText()).replace(/\s+/g, ' ')
  ok('the pinned card reads as his plan: 3 × 12–15, راحة 90, last time 32.5 × 12', /12–15/.test(pinnedText) && /90/.test(pinnedText) && /آخر مرة 32\.5 كجم × 12/.test(pinnedText), pinnedText)
  await contrast('390: the leg day after a pin', `${LEGS}`, { scroller: LEGS })
  await page.locator(`${LEGS} .pv-list [data-testid="plan-card"][data-name="${AB}"]`).scrollIntoViewIfNeeded(); await settle(400)
  await shot('390-legs-after-pin')
  await page.setViewportSize({ width: 320, height: 568 }); await settle(600)
  await page.locator(`${LEGS} .pv-list [data-testid="plan-card"][data-name="${AB}"]`).scrollIntoViewIfNeeded(); await settle(400)
  await shot('320-legs-after-pin')
  await page.setViewportSize({ width: 390, height: 844 }); await settle(500)
  await closeView()

  // «ثبّت كلهم»: both, in one edit
  await seed({ hf_sessions: HIS })
  await openFromHome(); await toLegs(); await toExtras()
  await page.locator(`${LEGS} [data-testid="extra-pin-all"]`).click(); await settle(1300)
  const all = await legsPlan()
  ok('«ثبّت كلهم»: both on his leg day, in the order he does them', all.length === 8 && all[6].name === AB && all[7].name === AD, all.map(x => x.name).join(', '))
  ok('«ثبّت كلهم»: one edit — «رجّع خطتك القديمة» goes back to the day without them', (await get('hf_plan_prev'))?.plan?.weeklySchedule?.[2]?.exercises?.length === 6)
  ok('«ثبّت كلهم»: nothing left to pin, the note gone, both plan cards', await cards.count() === 0 && await note.count() === 0
    && await page.locator(`${LEGS} .pv-list [data-testid="plan-card"]`).count() === 8)
  await closeView()
  // the old design reads the plan they went into
  {
    const cp = await ctx.newPage()
    const cerr = []
    cp.on('pageerror', e => cerr.push(String(e)))
    await cp.addInitScript(() => localStorage.setItem('meran_design', 'classic'))
    // its Home shows the day it is on: the leg day, for this look
    await cp.goto(new URL('/classic/', APP).href); await cp.waitForTimeout(1200)
    await cp.evaluate(() => localStorage.setItem('hf_plan_index', '2'))
    await cp.reload(); await cp.waitForTimeout(2200)
    // (a training day says «عرض التمارين»; after yesterday's session, a rest day says «تمارين الغد»)
    await cp.evaluate(() => [...document.querySelectorAll('button')].find(b => /عرض التمارين|تمارين الغد/.test(b.textContent))?.click())
    await cp.waitForTimeout(900)
    const ctext = await cp.locator('body').innerText()
    ok('classic: its leg day has the pinned exercises', ctext.includes(AB) && ctext.includes(AD) && ctext.includes('Hack Squat'), ctext.slice(0, 400))
    ok('classic: no NaN, no page errors', !ctext.includes('NaN') && cerr.length === 0, cerr.join(' | '))
    await cp.evaluate(() => localStorage.setItem('meran_design', 'new'))
    await cp.close()
  }

  // «مو هنا»: not on this day — remembered, the plan untouched
  await seed({ hf_sessions: HIS })
  await openFromHome(); await toLegs(); await toExtras()
  await extra(AD).locator('[data-testid="extra-dismiss"]').click(); await settle(900)
  ok('«مو هنا»: the card goes, the other stays, his plan untouched', await extra(AD).count() === 0 && await extra(AB).count() === 1 && (await legsPlan()).length === 6)
  ok('«مو هنا»: remembered for this day (meran_plan_dismissed)', JSON.stringify(await get('meran_plan_dismissed')) === JSON.stringify({ 'machine_beginner_3day|legs — أرجل': ['hip adduction'] }),
    JSON.stringify(await get('meran_plan_dismissed')))
  await closeView()
  await page.reload(); await settle(1300)
  await openFromHome(); await toLegs()
  ok('«مو هنا»: opened again, it stays waved off', await extra(AD).count() === 0 && await extra(AB).count() === 1
    && /\+1\s*تسويه بالجلسة/.test((await note.innerText().catch(() => '')).replace(/\s+/g, ' ')))
  await closeView()

  // ── 6. Only what he added: never what a plan put in his sessions ──
  // His leg sessions have every row of the leg day (the plan put them
  // there). What he takes out of the day — «شيله» here, a row left out in
  // the builder — or swaps away twice is not offered back; another plan,
  // switched to or rebuilt today, starts with nothing to offer.
  const extraNames = () => page.locator(`${LEGS} [data-testid="extra-card"]`).evaluateAll(els => els.map(e => e.dataset.name))
  const noteText = async () => (await note.innerText().catch(() => '')).replace(/\s+/g, ' ')
  const legsLeft = async () => (await get('meran_plan_dropped'))?.['machine_beginner_3day|legs — أرجل'] || {}

  // «شيله» the calf raise, a row in all four of his leg sessions
  await seed({ hf_sessions: HIS })
  await openFromHome(); await toLegs()
  await card(2, 'Standing Calf Raise').click(); await settle(800)
  await page.locator('[data-testid="xs-remove"]').click(); await settle(1200)
  ok('«شيله» a leg row: gone from his leg day', (await legsPlan()).length === 5 && !(await legsPlan()).some(x => x.name === 'Standing Calf Raise'))
  const afterRemove = await extraNames()
  ok('«شيله» a leg row: not offered back as «تسويه بالجلسة — مو بخطتك» (his sessions had it because the plan did)',
    JSON.stringify(afterRemove) === JSON.stringify([AB, AD]), JSON.stringify(afterRemove))
  ok('«شيله» a leg row: the day\'s note still says «+2»', /\+2\s*تسويها بالجلسة/.test(await noteText()), await noteText())
  ok('«شيله» a leg row: noted as gone from the leg day (meran_plan_dropped, a key of the new design\'s own)',
    typeof (await legsLeft())['standing calf raise'] === 'number', JSON.stringify(await legsLeft()))
  await toExtras(); await shot('390-legs-after-remove')
  await page.locator('[data-testid="plan-undo"]').getByRole('button', { name: 'تراجع' }).click(); await settle(1000)
  ok('«تراجع»: the calf raise is a plan card again, and nothing extra', await card(2, 'Standing Calf Raise').count() === 1
    && JSON.stringify(await extraNames()) === JSON.stringify([AB, AD]))
  // out again, and «خطتي» opened again after a reload: still not offered
  await card(2, 'Standing Calf Raise').click(); await settle(800)
  await page.locator('[data-testid="xs-remove"]').click(); await settle(1000)
  await closeView()
  await page.reload(); await settle(1300)
  await openFromHome(); await toLegs()
  ok('«شيله», reloaded: still only the two he adds', JSON.stringify(await extraNames()) === JSON.stringify([AB, AD]), JSON.stringify(await extraNames()))
  await closeView()

  // a row left out in the builder («عدّل الخطة كاملة» › شيله › احفظ)
  await seed({ hf_sessions: HIS })
  await openFromHome(); await toLegs()
  await page.locator(`${LEGS} [data-testid="plan-view-builder"]`).click(); await settle(1300)
  const ext = page.locator('#plist .prow').filter({ hasText: arabicName('Leg Extension') }).first()
  await ext.locator('.pr-main').click(); await settle(500)
  await ext.locator('[data-act="rm"]').click(); await settle(700)
  await page.locator('[data-act="plan-start"]').click(); await settle(700)
  await page.locator('[data-act="activate"]').click(); await settle(1300)
  ok('the builder: the leg extension left out of his leg day', !(await legsPlan()).some(x => x.name === 'Leg Extension') && (await legsPlan()).length === 5,
    (await legsPlan()).map(x => x.name).join(', '))
  await page.keyboard.press('Escape'); await settle(900)
  ok('the builder: back on «خطتي»', await view().count() === 1 && await page.locator('.pb').count() === 0)
  await toLegs()
  ok('the builder: what it left out is not offered back on «خطتي»', JSON.stringify(await extraNames()) === JSON.stringify([AB, AD]), JSON.stringify(await extraNames()))
  await closeView()

  // swapped twice: the hack squat → the smith squat (three sessions on it) → another
  const smith = JSON.parse(JSON.stringify(machine))
  Object.assign(smith.weeklySchedule[2].exercises[0], { name: 'Smith Machine Squat', was: { name: 'Hack Squat', muscle: 'Legs' } })
  const SMITH_ROWS = [['Smith Machine Squat', 'Legs', 60, 10], ...LEG_ROWS.slice(1)]
  await seed({ hf_plan: smith, hf_sessions: [...SESSIONS.filter(s => s.planDayIndex % 3 !== 2),
    legDay(1, [[AB, 'Legs', 30, 12]], SMITH_ROWS), legDay(4, [[AB, 'Legs', 30, 12]], SMITH_ROWS), legDay(8, [], SMITH_ROWS), legDay(11, [], LEG_ROWS)] })
  await openFromHome(); await toLegs()
  ok('swapped once: the smith squat is the plan\'s, only the abduction machine offered', JSON.stringify(await extraNames()) === JSON.stringify([AB]), JSON.stringify(await extraNames()))
  await card(2, 'Smith Machine Squat').locator('.pv-swap').click(); await settle(900)
  const twice = (await page.locator('.k-sheet .ac-group[data-group="muscle"] [data-testid="alt-card"]').evaluateAll(els => els.map(e => e.dataset.name)))
    .find(x => !['Hack Squat', 'Smith Machine Squat', 'Leg Press', AB, AD].includes(x))
  await page.locator(`.k-sheet [data-testid="alt-card"][data-name="${twice}"]`).click(); await settle(1200)
  const r0 = (await legsPlan())[0]
  ok(`swapped twice (→ ${twice}): the row is it, still noting the hack squat`, r0.name === twice && r0.was?.name === 'Hack Squat', JSON.stringify(r0))
  ok('swapped twice: the one in the middle is not offered back', JSON.stringify(await extraNames()) === JSON.stringify([AB]), JSON.stringify(await extraNames()))
  ok('swapped twice: the smith squat noted as gone from the day', typeof (await legsLeft())['smith machine squat'] === 'number', JSON.stringify(await legsLeft()))
  await closeView()

  // a switch from Settings (a ready-made plan, today): nothing of the machines plan is offered on its days
  const ppl = BUILT_IN_PLANS.find(p => p.planId === 'ppl_alex_lueth_v2')
  await seed({ hf_sessions: HIS })
  await page.getByRole('button', { name: 'الإعدادات' }).first().click(); await settle(700)
  await page.locator('.k-row').filter({ hasText: 'الخطة' }).first().click(); await settle(700)
  await page.getByText(planTitle(ppl.planName)).first().click(); await settle(800)
  await page.getByRole('button', { name: 'فعّل البرنامج' }).click(); await settle(800)
  await page.getByRole('button', { name: /أكّد التغيير|غيّر واكسر الستريك/ }).click(); await settle(1100)
  const switched = await get('hf_plan')
  ok('switch: PPL is in, starting today', switched?.planId === ppl.planId && switched.startDate === await page.evaluate(() => {
    const d = new Date(Date.now() - 3 * 3600000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }), JSON.stringify({ id: switched?.planId, start: switched?.startDate }))
  await home()
  const pplRow = page.locator('.k-row').filter({ hasText: planTitle(ppl.planName) }).first()
  await pplRow.scrollIntoViewIfNeeded(); await pplRow.click()
  await view().waitFor({ timeout: 8000 }).catch(() => {}); await settle(1100)
  const perDay = []
  for (let d = 0; d < ppl.weeklySchedule.length; d++) perDay.push(await page.locator(`.pv-page[data-page="${d}"] [data-testid="extra-card"]`).count())
  ok('switch: no day of the new plan offers the old plan\'s exercises (nor his additions to it)', perDay.every(x => x === 0)
    && await page.locator('[data-testid="plan-extra-note"]').count() === 0, JSON.stringify(perDay))
  await page.locator('.pv-tab[data-day="2"]').click(); await settle(900)
  await shot('390-switch-ppl-legs')
  await closeView()

  // a plan rebuilt today in the builder: a new plan, the same «Legs — أرجل» day, other rows
  const rebuilt = JSON.parse(JSON.stringify(machine))
  Object.assign(rebuilt, { planId: 'custom_rebuilt', planName: 'خطة الأرجل الجديدة', source: 'builder', startDate: await page.evaluate(() => {
    const d = new Date(Date.now() - 3 * 3600000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }) })
  rebuilt.weeklySchedule[2].exercises = [
    { name: 'Barbell Squat', muscle: 'Legs', sets: 4, repsMin: 6, repsMax: 10, restSeconds: 150 },
    { name: 'Romanian Deadlift', muscle: 'Legs', sets: 3, repsMin: 8, repsMax: 12, restSeconds: 120 },
    { name: AB, muscle: 'Legs', sets: 3, repsMin: 12, repsMax: 15, restSeconds: 90 },
  ]
  await seed({ hf_plan: rebuilt, hf_plan_index: 0, hf_sessions: HIS })
  await home()
  const rbRow = page.locator('.k-row').filter({ hasText: planTitle('خطة الأرجل الجديدة') }).first()
  await rbRow.scrollIntoViewIfNeeded(); await rbRow.click()
  await view().waitFor({ timeout: 8000 }).catch(() => {}); await settle(1100)
  await toLegs()
  ok('rebuilt today (the same day name): the old plan\'s leg rows are not offered', await page.locator(`${LEGS} [data-testid="extra-card"]`).count() === 0
    && await page.locator('[data-testid="extra-card"]').count() === 0, JSON.stringify(await extraNames()))
  await closeView()
}

// ── 7. «بالتناوب»: the hip machines take turns on his leg day ──
// حمزة: «نسوي ميزة تسمح انه تمرينين او اكثر يتبادلوا في الايام. يعني اليوم
// رجول بسوي هيب ابدكشن اجي يوم ثاني للرجول يعمل هيب اددكشن». His leg day
// with both hip machines as rows (as «ثبّت كلهم» pins them): each card
// offers «خلّهم بالتناوب»; one tap makes them one row that takes turns
// (src/plan/rotate.js) — one card of the two, the one due from his
// sessions marked — whose sheet edits the turns (↑, one more, ×, «فكّ
// التناوب»); any card's sheet starts them («بالتناوب مع…»); the old
// design reads the plan. Measured like the rest: text AA (the card AAA),
// the controls' signs 3:1, nothing sideways at 320, 390 and 430.
{
  const AB = 'Machine Hip Abduction', AD = 'Machine Hip Adduction'
  const LEGS = '.pv-page[data-page="2"]'
  const hips = JSON.parse(JSON.stringify(machine))
  hips.weeklySchedule[2].exercises.push(
    { name: AB, muscle: 'Legs', sets: 3, repsMin: 12, repsMax: 15, restSeconds: 90, by: 'user' },
    { name: AD, muscle: 'Legs', sets: 4, repsMin: 12, repsMax: 15, restSeconds: 90, by: 'user' },
  )
  // his last leg day had the abduction machine; the one before, the adduction one
  const legRot = (daysAgo, idx, name, w) => sess(daysAgo, idx, [['Hack Squat', 'Legs', 100, 10], [name, 'Legs', w, 12]])
  const HIPS = [...SESSIONS.filter(s => s.planDayIndex % 3 !== 2), legRot(3, 5, AB, 30), legRot(9, 2, AD, 25)]
  const legsPlan = async () => (await get('hf_plan')).weeklySchedule[2].exercises
  const toLegs = async () => { await page.locator('.pv-tab[data-day="2"]').click(); await settle(1100) }
  const plain = (name) => page.locator(`${LEGS} [data-testid="plan-card"]:not([data-rotate])[data-name="${name}"]`)
  const rcard = () => page.locator(`${LEGS} [data-testid="plan-card"][data-rotate="1"]`)
  const offers = () => page.locator(`${LEGS} [data-testid="rotate-offer"]`)
  const flat = async (loc) => (await loc.innerText().catch(() => '')).replace(/\s+/g, ' ')
  const title = () => page.locator('.k-sheet [data-testid="xs-title"]').innerText()
  const boxy = (root) => page.locator(root).first().evaluate((c) => [...c.querySelectorAll('*')]
    .filter(el => !el.closest('button.pv-swap') && (() => { const cs = getComputedStyle(el); return !/rgba\(.*,\s*0\)|transparent/.test(cs.backgroundColor) || (cs.boxShadow !== 'none' && !el.matches('img')) || cs.borderTopWidth !== '0px' && !el.matches('.pv-stats') })())
    .map(el => String(el.className?.baseVal ?? el.className)))

  // the offer, and «لا»
  await seed({ hf_plan: hips, hf_sessions: HIPS })
  await openFromHome(); await toLegs()
  ok('his leg day with both hip machines: each of their cards offers «خلّهم بالتناوب», naming the other; no other card does',
    await offers().count() === 2 && /خلّهم بالتناوب/.test(await flat(plain(AB).locator('.pv-offer'))) && /مرة هذا ومرة ضم ورك جهاز/.test(await flat(plain(AB).locator('.pv-offer')))
    && /مرة هذا ومرة فتح ورك جهاز/.test(await flat(plain(AD).locator('.pv-offer'))), await flat(plain(AB).locator('.pv-offer')))
  await plain(AB).scrollIntoViewIfNeeded(); await settle(400)
  await contrast('390: «خلّهم بالتناوب» on the card', `${LEGS} .pv-offer`, { aaa: true })
  await controlContrast('390: «خلّهم بالتناوب» and its ×', [`${LEGS} .pv-offer-go svg`, `${LEGS} .pv-offer-x svg`])
  await shot('390-rotate-offer')
  await page.setViewportSize({ width: 320, height: 568 }); await settle(600)
  await plain(AB).locator('.pv-offer').scrollIntoViewIfNeeded(); await settle(400)
  await noOverflow('320: «خلّهم بالتناوب»')
  await shot('320-rotate-offer')
  await page.setViewportSize({ width: 390, height: 844 }); await settle(500)
  await plain(AB).locator('[data-testid="rotate-offer-off"]').click(); await settle(700)
  ok('×: both offers go, remembered for the pair on this day (meran_rotate_off, a key of the new design\'s own), his plan untouched',
    await offers().count() === 0 && JSON.stringify(await get('meran_rotate_off')) === JSON.stringify(['machine_beginner_3day|legs — أرجل|machine hip abduction+machine hip adduction'])
    && (await legsPlan()).length === 8 && !(await legsPlan()).some(x => x.rotate), JSON.stringify(await get('meran_rotate_off')))
  await closeView()
  await page.reload(); await settle(1300)
  await openFromHome(); await toLegs()
  ok('×: opened again, still no offer', await offers().count() === 0 && await plain(AB).count() === 1)
  await closeView()

  // one tap: one row that takes turns
  await seed({ hf_plan: hips, hf_sessions: HIPS })
  await openFromHome(); await toLegs()
  await plain(AD).scrollIntoViewIfNeeded(); await settle(400)
  await plain(AD).locator('[data-testid="rotate-offer"]').click(); await settle(1400)
  const legs1 = await legsPlan()
  const row1 = legs1.at(-1)
  ok('«خلّهم بالتناوب»: one row taking turns between the two — the abduction machine first (in its place), the larger sets (4) noted against its 3',
    legs1.length === 7 && row1.name === AB && JSON.stringify(row1.rotate) === JSON.stringify([AB, AD]) && row1.sets === 4 && row1.was?.sets === 3 && row1.muscle === 'Legs', JSON.stringify(row1))
  ok('«خلّهم بالتناوب»: free — the day he reached and the streak\'s rule untouched', await get('hf_plan_index') === 7 && !(await get('hf_recovery'))?.lastSettingsChangeAt)
  ok('one card for the two, «بالتناوب» on its first line', await rcard().count() === 1 && await plain(AB).count() === 0 && await plain(AD).count() === 0
    && /^بالتناوب · واحد كل مرة/.test(await flat(rcard().locator('.pv-rtag'))))
  const order = await rcard().locator('.pv-rm').evaluateAll(els => els.map(e => [e.dataset.name, e.dataset.turn, e.querySelector('[data-testid="rotate-mark"]')?.textContent || '']))
  ok('the card: the one due first — the adduction machine (abduction was his last leg day), «الجاي» (today is the pull day) — then the abduction machine, «بعده»',
    JSON.stringify(order) === JSON.stringify([[AD, 'due', 'الجاي'], [AB, 'next', 'بعده']]), JSON.stringify(order))
  const rtext = await flat(rcard())
  ok('the card: both names, Arabic and English; the numbers they share (4 × 12–15, راحة 90); last time on the one due',
    /ضم ورك جهاز/.test(rtext) && /Machine Hip Adduction/.test(rtext) && /فتح ورك جهاز/.test(rtext) && /Machine Hip Abduction/.test(rtext)
    && /\b4\b/.test(rtext) && /12–15/.test(rtext) && /\b90\b/.test(rtext) && /آخر مرة 27\.5 كجم × 12/.test(rtext), rtext)
  const rimgs = await rcard().locator('img').evaluateAll(els => els.map(i => i.src))
  ok('the card: each machine\'s own picture, from the installed pack', rimgs.length === 2 && rimgs.every(s => s.startsWith('blob:')), rimgs.join(' '))
  ok('the card: nothing offered any more, nothing said swapped', await offers().count() === 0 && await rcard().locator('.pv-note').count() === 0)
  const rb = await boxy(`${LEGS} .pv-rcard`)
  ok('the card holds no box inside it (one surface, a hairline over the numbers)', rb.length === 0, rb.join(', '))
  const edge = await rcard().evaluate(c => [...c.querySelectorAll('.pv-rm-names')].map(n => Math.round(n.getBoundingClientRect().right)))
  ok('the card: the names stand on one edge, beside their pictures', edge.length === 2 && Math.abs(edge[0] - edge[1]) <= 1, JSON.stringify(edge))
  await noAccent('390: «خطتي» with a card that takes turns')
  await rcard().scrollIntoViewIfNeeded(); await settle(400)
  await contrast('390: the card that takes turns', `${LEGS} .pv-rcard`, { aaa: true })
  await controlContrast('390: the card\'s «التناوب»', [`${LEGS} .pv-rcard .pv-swap svg`, `${LEGS} .pv-rcard .pv-rtag svg`])
  await noOverflow('390: the card that takes turns')
  await shot('390-rotate-card')

  // its sheet
  await rcard().locator('.pv-open').click(); await settle(900)
  const xm = await page.locator('.k-sheet .xs-rm').evaluateAll(els => els.map(e => e.dataset.name))
  ok('its sheet opens on its names, the one due first; «عدّل التناوب» and «شوف الطريقة», no «بدّله»',
    await page.locator('[data-testid="exercise-sheet"][data-rotate="1"]').count() === 1 && JSON.stringify(xm) === JSON.stringify([AD, AB])
    && /عدّل التناوب/.test(await flat(page.locator('[data-testid="xs-rotate"]'))) && await page.locator('[data-testid="xs-watch"]').count() === 1
    && await page.locator('[data-testid="xs-swap"]').count() === 0, JSON.stringify(xm))
  ok('its sheet: «شيلهم من الخطة» takes the row as one', /شيلهم من الخطة/.test(await flat(page.locator('[data-testid="xs-remove"]'))))
  await contrast('390: the sheet of a card that takes turns', '.k-sheet', { scroller: '.k-sheet-body' })
  await contrast('390: its names and actions', '.k-sheet-h, .xs-rhead, .xs-actions', { aaa: true })
  await grabberContrast('390: the sheet of a card that takes turns')
  await noOverflow('390: the sheet of a card that takes turns', '.k-sheet')
  await stepperColumn('390: the sheet of a card that takes turns')
  await shot('390-rotate-sheet')
  await page.locator('[data-testid="xs-rotate"]').click(); await settle(900)
  const xr = await page.locator('.k-sheet .xr-m').evaluateAll(els => els.map(e => [e.dataset.name, e.dataset.turn || '', e.querySelector('.xr-mark')?.textContent || '']))
  ok('«عدّل التناوب»: its page, the names in their order — the word over the one due and the next', await title() === 'عدّل التناوب'
    && JSON.stringify(xr) === JSON.stringify([[AB, 'next', 'بعده'], [AD, 'due', 'الجاي']]), JSON.stringify(xr))
  ok('«عدّل التناوب»: ↑ on the second, × on each, «فكّ التناوب»', await page.locator('[data-testid="rotate-up"]').count() === 1
    && await page.locator('[data-testid="rotate-remove"]').count() === 2 && await page.locator('[data-testid="rotate-split"]').count() === 1)
  const groups = await page.locator('.k-sheet .ac-group').evaluateAll(els => els.map(e => e.dataset.group))
  const dayCards = await page.locator('.k-sheet .ac-group[data-group="day"] [data-testid="alt-card"]').evaluateAll(els => els.map(e => [e.dataset.name, e.querySelector('.ac-tag')?.textContent]))
  const legNames = (await legsPlan()).map(x => x.name)
  ok('«عدّل التناوب»: the day\'s own exercises for the same part first («بيومك» over each), then the same muscle',
    groups[0] === 'day' && groups.includes('muscle') && dayCards.length > 0 && dayCards.every(([n, t]) => legNames.includes(n) && t === 'بيومك'), JSON.stringify({ groups, dayCards }))
  await contrast('390: «عدّل التناوب»', '.k-sheet', { scroller: '.k-sheet-body' })
  await controlContrast('390: «عدّل التناوب»\'s ↑ and ×, «فكّ التناوب»', ['.k-sheet .xr-b svg', '.k-sheet .xr-split svg'])
  await altLayout('390: «عدّل التناوب»')
  await noOverflow('390: «عدّل التناوب»', '.k-sheet')
  await shot('390-rotate-editor')
  // ↑: the adduction machine leads
  await page.locator('[data-testid="rotate-up"]').click(); await settle(900)
  const r2 = (await legsPlan()).at(-1)
  ok('↑: the adduction machine leads — the row named for it, the list in that order', r2.name === AD && JSON.stringify(r2.rotate) === JSON.stringify([AD, AB]), JSON.stringify(r2))
  ok('↑: the card says nothing was swapped (both still take their turns)', await rcard().locator('.pv-note').count() === 0)
  // one more, from the alternatives
  const more = (await page.locator('.k-sheet .ac-group[data-group="muscle"] [data-testid="alt-card"]').evaluateAll(els => els.map(e => e.dataset.name)))[0]
  await page.locator(`.k-sheet .ac-group[data-group="muscle"] [data-testid="alt-card"][data-name="${more}"]`).click(); await settle(1000)
  const r3 = (await legsPlan()).at(-1)
  ok(`one more (${more}): three take turns, the page lists three`, JSON.stringify(r3.rotate) === JSON.stringify([AD, AB, more])
    && await page.locator('.k-sheet .xr-m').count() === 3 && await rcard().locator('.pv-rm').count() === 3, JSON.stringify(r3.rotate))
  await page.locator(`.k-sheet .xr-m[data-name="${more}"] [data-testid="rotate-remove"]`).click(); await settle(1000)
  ok('×: out of the turns, the two again', JSON.stringify((await legsPlan()).at(-1).rotate) === JSON.stringify([AD, AB]) && await page.locator('.k-sheet .xr-m').count() === 2)
  // «فكّ التناوب»
  await page.locator('[data-testid="rotate-split"]').click(); await settle(1400)
  const split = await legsPlan()
  ok('«فكّ التناوب»: each a row of its own again, on the row\'s numbers', split.length === 8 && split[6].name === AD && !split[6].rotate
    && split[7].name === AB && split[7].sets === 4 && split[7].restSeconds === 90 && split[7].muscle === 'Legs', JSON.stringify(split.slice(6)))
  ok('«فكّ التناوب»: two cards again, the sheet closed', await rcard().count() === 0 && await plain(AD).count() === 1 && await plain(AB).count() === 1
    && await page.locator('.k-sheet').count() === 0)

  // from a card's own sheet: «بالتناوب مع…», the other hip machine first
  await plain(AB).locator('.pv-open').click(); await settle(900)
  await page.locator('[data-testid="xs-rotate"]').click(); await settle(900)
  const first = await page.locator('.k-sheet .ac-group[data-group="day"] [data-testid="alt-card"]').first().evaluate(c => [c.dataset.name, c.querySelector('.ac-tag')?.textContent])
  ok('«بالتناوب مع…»: its page — the day\'s pair first, «بيومك» over it', await title() === 'بالتناوب مع…' && JSON.stringify(first) === JSON.stringify([AD, 'بيومك']), JSON.stringify(first))
  await contrast('390: «بالتناوب مع…»', '.k-sheet', { scroller: '.k-sheet-body' })
  await shot('390-rotate-create')
  await page.locator(`.k-sheet .ac-group[data-group="day"] [data-testid="alt-card"][data-name="${AD}"]`).click(); await settle(1200)
  const made = await legsPlan()
  ok('a tap: one row of the two (the abduction machine\'s, in the adduction one\'s place above it), the page now on its names',
    made.length === 7 && made[6].name === AB && JSON.stringify(made[6].rotate) === JSON.stringify([AB, AD]) && await title() === 'عدّل التناوب'
    && await page.locator('.k-sheet .xr-m').count() === 2 && await rcard().count() === 1, JSON.stringify(made.slice(6)))
  await page.locator('.k-sheet [aria-label="إغلاق"]').click(); await settle(700)

  for (const w of [320, 430]) {
    await page.setViewportSize({ width: w, height: w === 320 ? 568 : 932 }); await settle(700)
    await rcard().scrollIntoViewIfNeeded(); await settle(400)
    await noOverflow(`${w}: the card that takes turns`)
    const ens = await rcard().evaluate(c => [...c.querySelectorAll('.pv-rm-en, .pv-rm-ar')].map(el => ({ t: el.textContent, whole: el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1 })))
    ok(`${w}: every name on the card whole`, ens.length === 4 && ens.every(x => x.whole), JSON.stringify(ens))
    await contrast(`${w}: the card that takes turns`, `${LEGS} .pv-rcard`)
    if (w === 320) await shot('320-rotate-card')
    await rcard().locator('.pv-open').click(); await settle(900)
    await noOverflow(`${w}: the sheet of a card that takes turns`, '.k-sheet')
    await contrast(`${w}: the sheet of a card that takes turns`, '.k-sheet', { scroller: '.k-sheet-body' })
    if (w === 320) await shot('320-rotate-sheet')
    await page.locator('[data-testid="xs-rotate"]').click(); await settle(900)
    await noOverflow(`${w}: «عدّل التناوب»`, '.k-sheet')
    await altLayout(`${w}: «عدّل التناوب»`)
    await contrast(`${w}: «عدّل التناوب»`, '.k-sheet', { scroller: '.k-sheet-body' })
    if (w === 320) { await page.locator('.k-sheet-body').evaluate(el => el.scrollTo(0, 0)); await settle(300); await shot('320-rotate-editor') }
    await page.locator('.k-sheet [aria-label="إغلاق"]').click(); await settle(700)
  }
  await page.setViewportSize({ width: 390, height: 844 }); await settle(500)

  // the builder («عدّل الخطة كاملة»): its row says it, and a save keeps the turns
  await page.locator(`${LEGS} [data-testid="plan-view-builder"]`).click(); await settle(1300)
  const brow = page.locator('#plist .prow').filter({ has: page.locator('[data-testid="builder-rotate"]') })
  ok('the builder: the row says «بالتناوب مع ضم ورك جهاز»', await brow.count() === 1
    && /بالتناوب مع ضم ورك جهاز/.test(await flat(brow.locator('[data-testid="builder-rotate"]'))), await flat(brow))
  await page.locator('[data-act="plan-start"]').click(); await settle(700)
  await page.locator('[data-act="activate"]').click(); await settle(1300)
  const kept = (await legsPlan()).find(x => x.rotate)
  ok('the builder: saved, the row still takes its turns — the abduction machine first, then the adduction one', kept?.name === AB
    && JSON.stringify(kept.rotate) === JSON.stringify([AB, AD]) && (await legsPlan()).length === 7, JSON.stringify((await legsPlan()).map(x => [x.name, x.rotate])))
  await page.keyboard.press('Escape'); await settle(900)
  ok('the builder: back on «خطتي», the card of the two still there', await view().count() === 1 && await rcard().count() === 1)
  await closeView()

  // the old design reads the plan with the row that takes turns: by its first name
  {
    const cp = await ctx.newPage()
    const cerr = []
    cp.on('pageerror', e => cerr.push(String(e)))
    await cp.addInitScript(() => localStorage.setItem('meran_design', 'classic'))
    await cp.goto(new URL('/classic/', APP).href); await cp.waitForTimeout(1200)
    await cp.evaluate(() => localStorage.setItem('hf_plan_index', '2'))
    await cp.reload(); await cp.waitForTimeout(2200)
    await cp.evaluate(() => [...document.querySelectorAll('button')].find(b => /عرض التمارين|تمارين الغد/.test(b.textContent))?.click())
    await cp.waitForTimeout(900)
    const ctext = await cp.locator('body').innerText()
    ok('classic: its leg day shows the row that takes turns by its first name (the abduction machine), as one exercise',
      ctext.includes(AB) && !ctext.includes(AD) && ctext.includes('Hack Squat'), ctext.slice(0, 400))
    ok('classic (بالتناوب): no NaN, no page errors', !ctext.includes('NaN') && cerr.length === 0, cerr.join(' | '))
    await cp.evaluate(() => localStorage.setItem('meran_design', 'new'))
    await cp.close()
  }
}

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

for (const [n, p, e] of results) console.log(p ? '✅' : '❌', n, !p && e ? `— ${e}` : '')
console.log('\ncontrast, measured:\n  ' + contrastLog.join('\n  '))
await browser.close()
const failed = results.filter(r => !r[1]).length
console.log(failed ? `\n${failed} failed` : `\nall ${results.length} passed`)
process.exit(failed ? 1 : 0)
