// ── The shareable poster ──────────────────────────────────────
// The report is a page; a shared image cannot be. This draws the
// month's highlights onto a 1080×1920 story canvas and hands it to the
// share sheet.
//
// Drawn with the 2D context directly rather than by rasterising the
// DOM. html2canvas is a heavy dependency that mishandles @font-face,
// and DOM→SVG needs every font and image inlined by hand and fails
// silently when one is missed. A canvas is more code here and no
// surprises anywhere else.
//
// The layout is «تحت الأضواء»: near-black ground, one neutral stage
// light, the month's total as a broadcast number, figures on hairlines
// instead of tiles, gold only on the weight that went up, orange only
// on the streak, and the real wordmark — never a typed «مران». Every
// piece of content sits between y≈250 and y≈1600, clear of the Stories
// header above and the reply bar below.
//
// Canvas cannot read CSS custom properties, and the poster must look
// the same whichever mode the app is in, so the palette is repeated
// here as literals: the NORMAL values from src/styles/tokens.css, never
// the deload ones.

import { arabicName } from './exerciseMedia.js'
import { todayKey } from './day.js'
import { unitWord, fromWord, kgText } from './monthReport.js'
import { jumpChart } from './reportStory.js'
import { fmtDayAr } from './streak.js'

export const POSTER_W = 1080
export const POSTER_H = 1920

const C = {
  ground: '#030404', stage: '#2A3038',
  hairline: 'rgba(255,255,255,0.10)',
  ink: '#F4F6F8', ink2: '#B0B9C3', ink3: '#8A95A1',
  raise: '#FBBF24', streak: '#F97316',
}

// The content column: a 96px margin each side, text set from the right
// (the start edge in Arabic).
const L = 96
const R = POSTER_W - 96
const COL = R - L

// The poster's top and bottom limits for content (Stories safe area).
export const POSTER_SAFE = { top: 250, bottom: 1600 }

const AR = (n) => Number(n || 0).toLocaleString('en-US')

// The app's own self-hosted faces: Archivo for every digit and Latin
// letter, Changa for Arabic. unicode-range splits them per glyph, in a
// canvas exactly as on the page.
const FAMILY = "'Meran Latin','Meran Arabic',-apple-system,system-ui,sans-serif"
const STRETCH = { 62: 'extra-condensed', 75: 'condensed', 85: 'semi-condensed', 100: 'normal' }

function setFont(ctx, weight, size, stretch = 100) {
  const kw = STRETCH[stretch] || 'normal'
  ctx.font = `${weight} ${kw === 'normal' ? '' : kw + ' '}${size}px ${FAMILY}`
  // Some engines only honour the width through the dedicated property.
  if ('fontStretch' in ctx) {
    try { ctx.fontStretch = kw } catch { /* not supported: the auto-fit still holds */ }
  }
}

/**
 * Wait for the faces actually used here. Without this the first draw
 * lands in a fallback face — the text is there but wrong, and it is
 * baked into the PNG with no second chance.
 */
async function ensureFonts() {
  if (typeof document === 'undefined' || !document.fonts?.load) return
  try {
    await Promise.all([
      document.fonts.load("800 240px 'Meran Latin'", '0123456789,.%+'),
      document.fonts.load("600 40px 'Meran Latin'", 'Bench Press XP'),
      document.fonts.load("700 44px 'Meran Arabic'", 'تقرير الشهر كجم رفعتها'),
    ])
    await document.fonts.ready
  } catch {
    // A font that will not load is not a reason to refuse the poster.
  }
}

async function loadImage(src) {
  if (!src) return null
  try {
    const img = new Image()
    // Same-origin (a blob: URL or the app's own /assets), so the canvas
    // is never tainted.
    img.src = src
    await (img.decode ? img.decode() : new Promise((res, rej) => { img.onload = res; img.onerror = rej }))
    return img
  } catch {
    return null
  }
}

// ── Drawing helpers ───────────────────────────────────────────

function text(ctx, s, x, y, { size, weight = 600, color = C.ink, align = 'right', stretch = 100, maxWidth, dir = 'rtl' }) {
  ctx.direction = dir
  setFont(ctx, weight, size, stretch)
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = color
  if (maxWidth) ctx.fillText(String(s), x, y, maxWidth)
  else ctx.fillText(String(s), x, y)
}

function width(ctx, s, { size, weight = 600, stretch = 100, dir = 'rtl' }) {
  ctx.direction = dir
  setFont(ctx, weight, size, stretch)
  return ctx.measureText(String(s)).width
}

function hairline(ctx, y) {
  ctx.fillStyle = C.hairline
  ctx.fillRect(L, y, COL, 2)
}

// The flame from components/streak/StreakIcons.jsx, on its 24 grid.
const FLAME = 'M12.3 2.8c.6 3.6 5 5.3 5 10a5.3 5.3 0 0 1-10.6 0c0-2.8 1.5-3.9 2.1-5.4.9 1.4 1.9 1.9 1.9 1.9s-.6-4 1.6-6.5z'
function flame(ctx, x, y, size, color) {
  if (typeof Path2D !== 'function') return
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 24, size / 24)
  ctx.fillStyle = color
  ctx.fill(new Path2D(FLAME))
  ctx.restore()
}

// The wordmark: the bundled light mark, cropped to its ink box (the PNG
// is a 192×192 canvas whose letters fill 172×67 at 10,62).
const MARK = { src: '/assets/app_logo_full_light.png', x: 10, y: 62, w: 172, h: 67 }

const monthName = (label) => String(label || '').split(' ')[0]
const isMonthOver = (month, today = todayKey()) => String(today).slice(0, 7) > month

/** What the poster says, decided apart from where it is drawn.
 *  «وزن جديد» is the one name for a weight that went past its best,
 *  the same word the report uses; the «% of plan days» figure the
 *  report dropped is the sessions attended out of the planned ones. */
export function posterFigures(report, { liveStreak = null, today } = {}) {
  const c = report.consistency || {}
  const a = report.attendance || {}
  const over = isMonthOver(report.month, today)
  const streak = over ? c.endStreak : liveStreak

  const attended = a.attended ?? report.sessionCount
  // Each figure's word follows its number: «5 جلسات», «16 جلسة».
  const figs = [
    { v: AR(attended), l: `${unitWord(attended, 'session')} حضرتها` },
    { v: AR(report.sets?.completed), l: unitWord(report.sets?.completed, 'مجموعات مكتملة', 'مجموعة مكتملة') },
  ]
  if (report.prs?.length) figs.push({ v: AR(report.prs.length), l: unitWord(report.prs.length, 'أوزان جديدة', 'وزن جديد'), color: C.raise })
  if (Number.isFinite(streak) && streak > 0) {
    figs.push({ v: AR(streak), l: over ? `ستريك آخر ${monthName(report.monthLabel)}` : 'ستريك لين اليوم', color: C.streak, flame: true })
  }
  if (figs.length < 4 && a.planned) figs.push({ v: AR(a.planned), l: `${unitWord(a.planned, 'session')} في خطتك`, planned: true })
  if (figs.length < 4) figs.push({ v: AR(report.reps?.total), l: unitWord(report.reps?.total, 'تكرارات', 'تكرار') })
  return { figs: figs.slice(0, 4), attended: a.attended ?? report.sessionCount, planned: a.planned || 0 }
}

/** Who the poster is from: the name, and the level only while it is
 *  the month's own. A finished month's poster would otherwise print
 *  today's level as that month's (only today's XP is stored). */
export function posterFooter(report, profile = {}) {
  const name = (profile?.name || '').trim()
  const p = report?.progress
  if (!p || p.levelIsToday || !Number.isFinite(p.level)) return { name, level: '' }
  const rank = p.rank?.label
  return { name, level: `المستوى ${AR(p.level)}${rank ? ` · ${rank}` : ''}` }
}

// ── The posters ───────────────────────────────────────────────
// Two of them, as the approved design has it:
//
//   month — the month's sessions as the big lit number, the month's
//           squares lit like the calendar card, the streak, the new
//           weight, his name and the mark.
//   pr    — one new weight: the lift, the weight in gold, and under it
//           the same week-by-week line as the «أكبر قفزة» card, so who
//           sees it sees the jump and not only the number.
//
// Photos are never drawn into either.

const INK_RGB = '244,246,248'
const LEVEL_ALPHA = [0, 0.2, 0.36, 0.55, 0.76, 0.96]
const D = { deload: '#5CC9EE', deloadWash: 'rgba(92,201,238,0.14)', rest: '#3B9DE8', goldHi: '#FDE68A', on: '#0B0D10' }

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') { ctx.roundRect(x, y, w, h, r); return }
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** The floodlight from the top of the card: a soft cone and a lamp. */
function floodlight(ctx, { gold = false } = {}) {
  ctx.fillStyle = C.ground
  ctx.fillRect(0, 0, POSTER_W, POSTER_H)
  const cx = POSTER_W / 2
  if (typeof ctx.createConicGradient === 'function') {
    // CSS «from 150deg» is canvas 60°: the cone points straight down.
    const g = ctx.createConicGradient((60 * Math.PI) / 180, cx, -60)
    const s = (deg) => deg / 360
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(s(10), 'rgba(255,255,255,0.045)')
    g.addColorStop(s(22), 'rgba(255,255,255,0.10)')
    g.addColorStop(s(30), 'rgba(255,255,255,0.16)')
    g.addColorStop(s(38), 'rgba(255,255,255,0.10)')
    g.addColorStop(s(50), 'rgba(255,255,255,0.045)')
    g.addColorStop(s(60), 'rgba(255,255,255,0)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, POSTER_W, POSTER_H)
    // The cone fades into the ground before the bottom.
    const fade = ctx.createLinearGradient(0, 700, 0, 1700)
    fade.addColorStop(0, 'rgba(3,4,4,0)')
    fade.addColorStop(1, C.ground)
    ctx.fillStyle = fade
    ctx.fillRect(0, 700, POSTER_W, POSTER_H - 700)
  } else {
    const light = ctx.createRadialGradient(cx, 380, 0, cx, 380, 900)
    light.addColorStop(0, C.stage)
    light.addColorStop(0.72, C.ground)
    ctx.fillStyle = light
    ctx.fillRect(0, 0, POSTER_W, POSTER_H)
  }
  const lamp = ctx.createRadialGradient(cx, -40, 0, cx, -40, 320)
  lamp.addColorStop(0, 'rgba(255,255,255,0.35)')
  lamp.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = lamp
  ctx.fillRect(0, 0, POSTER_W, 400)
  if (gold) {
    const g = ctx.createRadialGradient(cx, 560, 0, cx, 560, 640)
    g.addColorStop(0, 'rgba(251,191,36,0.16)')
    g.addColorStop(1, 'rgba(251,191,36,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, POSTER_W, 1300)
  }
}

/** A number in lit metal: white to silver, or gold. */
function metalText(ctx, s, x, y, { size, gold = false, align = 'right' }) {
  ctx.direction = 'ltr'
  setFont(ctx, 800, size, 62)
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  const g = ctx.createLinearGradient(0, y - size * 0.86, 0, y)
  if (gold) { g.addColorStop(0, '#FFF3C4'); g.addColorStop(0.5, C.raise); g.addColorStop(1, '#C98A06') }
  else { g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.52, '#DCE1E6'); g.addColorStop(1, '#8A95A1') }
  ctx.save()
  ctx.shadowColor = gold ? 'rgba(251,191,36,0.40)' : 'rgba(255,255,255,0.20)'
  ctx.shadowBlur = 60
  ctx.fillStyle = g
  ctx.fillText(String(s), x, y)
  ctx.restore()
  return width(ctx, s, { size, weight: 800, stretch: 62, dir: 'ltr' })
}

function cross(ctx, x, y, s) {
  ctx.save()
  ctx.strokeStyle = C.ink
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s)
  ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s)
  ctx.stroke()
  ctx.restore()
}

/** The month's squares, lit like the calendar card, no numbers. */
function monthSquares(ctx, report, { top, w }) {
  const cal = report.consistency?.calendar || []
  const [y, m] = report.month.split('-').map(Number)
  const pad = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
  const gap = 16
  const cell = (w - gap * 6) / 7
  const left = (POSTER_W - w) / 2
  cal.forEach((day, i) => {
    const k = pad + i
    const col = k % 7, row = Math.floor(k / 7)
    // Sunday on the right, as the app's calendar reads.
    const x = left + w - (col + 1) * cell - col * gap
    const yy = top + row * (cell + gap)
    roundRect(ctx, x, yy, cell, cell, 14)
    if (day.kind === 'trained' && day.level) {
      const a = LEVEL_ALPHA[day.level]
      ctx.save()
      ctx.shadowColor = `rgba(${INK_RGB},${(a * 0.6).toFixed(2)})`
      ctx.shadowBlur = 26
      ctx.fillStyle = `rgba(${INK_RGB},${a})`
      ctx.fill()
      ctx.restore()
    } else if (day.kind === 'trained') {
      ctx.fillStyle = D.deloadWash
      ctx.fill()
      ctx.strokeStyle = D.deload
      ctx.lineWidth = 5
      roundRect(ctx, x + 2.5, yy + 2.5, cell - 5, cell - 5, 12)
      ctx.stroke()
    } else if (day.kind === 'miss') {
      ctx.strokeStyle = C.ink3
      ctx.lineWidth = 2
      ctx.stroke()
      cross(ctx, x + cell / 2, yy + cell / 2, cell * 0.16)
    } else if (day.kind === 'paid') {
      ctx.strokeStyle = D.rest
      ctx.lineWidth = 3
      ctx.stroke()
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  })
  const rows = Math.ceil((pad + cal.length) / 7)
  return top + rows * cell + (rows - 1) * gap
}

/** Who this is from, and the mark: the same foot on both posters. */
function foot(ctx, report, profile, mark) {
  const FOOT = 1476
  hairline(ctx, FOOT)
  const { name, level } = posterFooter(report, profile)
  if (name && level) {
    text(ctx, name, R, FOOT + 76, { size: 46, weight: 700, color: C.ink, maxWidth: COL - 260 })
    text(ctx, level, R, FOOT + 124, { size: 34, weight: 600, color: C.ink3, maxWidth: COL - 260 })
  } else if (name) {
    text(ctx, name, R, FOOT + 98, { size: 46, weight: 700, color: C.ink, maxWidth: COL - 260 })
  } else if (level) {
    text(ctx, level, R, FOOT + 94, { size: 38, weight: 600, color: C.ink2, maxWidth: COL - 260 })
  }
  if (mark) {
    const h = 70
    const w = MARK.w * (h / MARK.h)
    ctx.drawImage(mark, MARK.x, MARK.y, MARK.w, MARK.h, L, FOOT + 84 - h / 2, w, h)
  }
}

/** One figure on a hairline: the words on the right, the number on the left. */
function figureRow(ctx, y, { title, sub, value, color, flame: withFlame = false }) {
  hairline(ctx, y)
  text(ctx, title, R, y + 62, { size: 46, weight: 700, color: C.ink, maxWidth: COL - 320 })
  if (sub) text(ctx, sub, R, y + 108, { size: 34, weight: 600, color: C.ink3, maxWidth: COL - 320 })
  const size = 116
  const base = y + 112
  ctx.direction = 'ltr'
  setFont(ctx, 800, size, 62)
  ctx.textAlign = 'left'
  ctx.fillStyle = color
  ctx.fillText(String(value), withFlame ? L + 76 : L, base)
  if (withFlame) flame(ctx, L - 4, base - 84, 76, color)
  return y + 136
}

export async function drawMonthPoster(canvas, { report, profile = {}, mapping = {}, liveStreak = null, today } = {}) {
  canvas.width = POSTER_W
  canvas.height = POSTER_H
  const ctx = canvas.getContext('2d')
  await ensureFonts()
  const mark = await loadImage(MARK.src)

  floodlight(ctx)

  // The month, then the sessions he came to as the lit number.
  text(ctx, report.monthLabel, R, 300, { size: 40, weight: 600, color: C.ink3, maxWidth: COL })
  const attended = report.attendance?.attended ?? report.sessionCount ?? 0
  const heroBase = 330 + 280 * 0.86
  const numW = metalText(ctx, AR(attended), R, heroBase, { size: 280 })
  const wordX = R - numW - 30
  text(ctx, unitWord(attended, 'session'), wordX, heroBase - 78, { size: 56, weight: 700, color: C.ink2 })
  text(ctx, 'حضرتها', wordX, heroBase - 10, { size: 56, weight: 700, color: C.ink2 })

  // The month's squares.
  let y = monthSquares(ctx, report, { top: heroBase + 56, w: 640 }) + 44

  // The streak, and the month's biggest new weight.
  const c = report.consistency || {}
  const over = isMonthOver(report.month, today)
  const streak = over ? c.endStreak : liveStreak
  if (Number.isFinite(streak) && streak > 0) {
    y = figureRow(ctx, y, {
      title: `${unitWord(streak, 'day')} ستريك`,
      sub: over ? `آخر ${monthName(report.monthLabel)}` : 'لين اليوم',
      value: AR(streak), color: C.streak, flame: true,
    })
  }
  const best = report.prs?.[0]
  if (best && y < 1340) {
    const ar = arabicName(best.exercise, mapping)
    y = figureRow(ctx, y, {
      title: ar || best.exercise, sub: 'وزن جديد',
      value: AR(Math.round(best.weight * 10) / 10), color: C.raise,
    })
  }

  foot(ctx, report, profile, mark)
  return canvas
}

/** The old name, for anything still calling it. */
export const drawPoster = drawMonthPoster

export async function drawPrPoster(canvas, { report, profile = {}, mapping = {} } = {}) {
  canvas.width = POSTER_W
  canvas.height = POSTER_H
  const ctx = canvas.getContext('2d')
  await ensureFonts()
  const mark = await loadImage(MARK.src)
  const j = report.jump
  floodlight(ctx, { gold: true })
  if (!j) { foot(ctx, report, profile, mark); return canvas }

  const ar = arabicName(j.exercise, mapping)
  text(ctx, `وزن جديد · ${report.monthLabel}`, R, 300, { size: 40, weight: 600, color: C.ink3, maxWidth: COL })
  text(ctx, ar || j.exercise, R, 384, { size: 64, weight: 700, color: C.ink, maxWidth: COL, dir: ar ? 'rtl' : 'ltr' })
  const base = 420 + 300 * 0.86
  const kg = AR(Math.round(j.weight * 10) / 10)
  const w = metalText(ctx, kg, R, base, { size: 300, gold: true })
  text(ctx, 'كجم', R - w - 26, base - 8, { size: 56, weight: 700, color: C.ink2 })
  const gain = Math.round((j.weight - j.prevBest) * 10) / 10
  text(ctx, `${fromWord(j)} ${kgText(j.prevBest)} كجم · ⁦+${AR(gain)}⁩ كجم`, R, base + 74, { size: 38, weight: 600, color: C.ink2, maxWidth: COL })

  // The line, as on the card.
  const chart = jumpChart(j, report.month)
  if (chart) {
    const box = { x: L + 92, y: base + 196, w: COL - 100, h: 1360 - (base + 196) }
    const px = (p) => box.x + (p / 100) * box.w
    const py = (p) => box.y + (p / 100) * box.h
    for (const b of chart.deloads) {
      ctx.fillStyle = D.deloadWash
      roundRect(ctx, px(b.x), box.y - 10, (b.w / 100) * box.w, box.h + 10, 12)
      ctx.fill()
    }
    for (const t of chart.ticks) {
      ctx.fillStyle = 'rgba(255,255,255,0.14)'
      ctx.fillRect(box.x, py(t.y), box.w, 2)
      text(ctx, AR(t.v), box.x - 20, py(t.y) + 12, { size: 34, weight: 600, color: C.ink3, align: 'right', dir: 'ltr' })
    }
    text(ctx, 'كجم', box.x - 20, box.y - 40, { size: 30, weight: 600, color: C.ink3, align: 'right' })
    if (chart.refY != null) {
      ctx.fillStyle = C.ink3
      ctx.fillRect(box.x, py(chart.refY), box.w, 2)
      text(ctx, j.firstTime ? 'أول وزن بدأت فيه' : `أثقل وزن قبل ${monthName(report.monthLabel)}`, box.x, py(chart.refY) + 44,
        { size: 32, weight: 600, color: C.ink2, align: 'left' })
    }
    const pts = chart.pts.filter(p => p.kind !== 'dl')
    const path = () => {
      ctx.beginPath()
      pts.forEach((p, i) => (i ? ctx.lineTo(px(p.x), py(p.y)) : ctx.moveTo(px(p.x), py(p.y))))
    }
    if (pts.length > 1) {
      // The area under the line, then the line; the part above the old
      // best again in gold.
      path()
      ctx.lineTo(px(pts[pts.length - 1].x), box.y + box.h)
      ctx.lineTo(px(pts[0].x), box.y + box.h)
      ctx.closePath()
      const fill = ctx.createLinearGradient(0, box.y, 0, box.y + box.h)
      fill.addColorStop(0, 'rgba(244,246,248,0.14)')
      fill.addColorStop(1, 'rgba(244,246,248,0)')
      ctx.fillStyle = fill
      ctx.fill()
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      path()
      ctx.strokeStyle = C.ink2
      ctx.lineWidth = 6
      ctx.stroke()
      if (chart.refY != null) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, 0, POSTER_W, py(chart.refY))
        ctx.clip()
        path()
        ctx.strokeStyle = C.raise
        ctx.shadowColor = 'rgba(251,191,36,0.8)'
        ctx.shadowBlur = 16
        ctx.lineWidth = 7
        ctx.stroke()
        ctx.restore()
      }
    }
    for (const p of chart.pts) {
      if (p.kind === 'pr') continue
      ctx.beginPath()
      ctx.arc(px(p.x), py(p.y), 11, 0, Math.PI * 2)
      ctx.fillStyle = C.ground
      ctx.fill()
      ctx.beginPath()
      ctx.arc(px(p.x), py(p.y), p.kind === 'dl' ? 8 : 8, 0, Math.PI * 2)
      if (p.kind === 'dl') { ctx.strokeStyle = D.deload; ctx.lineWidth = 4; ctx.stroke() }
      else { ctx.fillStyle = p.kind === 'up' ? C.raise : C.ink2; ctx.fill() }
    }
    if (chart.pr) {
      const x = px(chart.pr.x), yy = py(chart.pr.y)
      ctx.save()
      ctx.shadowColor = 'rgba(251,191,36,0.7)'
      ctx.shadowBlur = 40
      ctx.beginPath()
      ctx.arc(x, yy, 17, 0, Math.PI * 2)
      ctx.fillStyle = D.goldHi
      ctx.fill()
      ctx.restore()
      text(ctx, kg, x, yy - 64, { size: 46, weight: 800, color: C.ink, align: 'center', dir: 'ltr', stretch: 85 })
      if (j.date) text(ctx, fmtDayAr(j.date, { weekday: false }), x, yy - 30, { size: 30, weight: 600, color: C.ink2, align: 'center' })
    }
    for (const l of chart.labels) text(ctx, l.text, px(l.x), box.y + box.h + 56, { size: 34, weight: 600, color: C.ink3, align: 'center' })
    if (chart.sep != null) {
      ctx.fillStyle = 'rgba(255,255,255,0.14)'
      ctx.fillRect(px(chart.sep), box.y - 20, 2, box.h + 50)
    }
  }

  foot(ctx, report, profile, mark)
  return canvas
}

/** The poster as a PNG blob. */
export async function buildPosterBlob({ kind = 'month', ...opts } = {}) {
  const canvas = document.createElement('canvas')
  await (kind === 'pr' ? drawPrPoster : drawMonthPoster)(canvas, opts)
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'))
  // toBlob answers null when it cannot allocate — 1080×1920 is large
  // enough for that to be a real outcome on an old phone.
  if (!blob) throw new Error('poster-encode-failed')
  return blob
}

// ── Getting it out of the app ─────────────────────────────────
// One path is not enough. Sharing files from a PWA is unreliable on
// iOS, and the <a download> fallback is unreliable there too, so the
// last rung hands the image to the page and lets the user press and
// hold — which always works.
//
// Each rung returns a name rather than a boolean, so the caller can say
// what actually happened instead of guessing.

export const SHARE_RESULT = {
  SHARED: 'shared',
  DOWNLOADED: 'downloaded',
  INLINE: 'inline',
  CANCELLED: 'cancelled',
}

export function canShareFiles(file, nav = typeof navigator !== 'undefined' ? navigator : null) {
  try {
    return !!(nav?.canShare?.({ files: [file] }) && nav?.share)
  } catch {
    return false
  }
}

export async function sharePoster({ kind = 'month', report, profile, mapping, liveStreak, today, onInline } = {}) {
  const blob = await buildPosterBlob({ kind, report, profile, mapping, liveStreak, today })
  const filename = kind === 'pr' ? `meran-${report.month}-new-weight.png` : `meran-${report.month}.png`
  const file = typeof File === 'function'
    ? new File([blob], filename, { type: 'image/png' })
    : null

  // 1. The share sheet.
  if (file && canShareFiles(file)) {
    try {
      await navigator.share({ files: [file], title: kind === 'pr' ? `وزن جديد · ${report.monthLabel}` : `تقرير ${report.monthLabel}` })
      return SHARE_RESULT.SHARED
    } catch (err) {
      // Closing the sheet is a decision, not a failure.
      if (err?.name === 'AbortError') return SHARE_RESULT.CANCELLED
      // Anything else falls through to the next rung.
    }
  }

  // 2. A download, the way the data export already does it.
  const url = URL.createObjectURL(blob)
  if (supportsDownload()) {
    try {
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      return SHARE_RESULT.DOWNLOADED
    } catch {
      // fall through
    }
  }

  // 3. Show it and let them press and hold. The caller owns the URL
  // from here and revokes it when the sheet closes.
  onInline?.(url)
  return SHARE_RESULT.INLINE
}

// iOS Safari — and a standalone PWA especially — quietly ignores the
// download attribute, so offering it there produces nothing at all.
export function supportsDownload(
  ua = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  standalone = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)')?.matches,
) {
  const iOS = /iP(hone|ad|od)/.test(ua) ||
    (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document)
  if (iOS) return false
  if (standalone && /Safari/.test(ua) && !/Chrome/.test(ua)) return false
  return typeof document !== 'undefined' && 'download' in document.createElement('a')
}
