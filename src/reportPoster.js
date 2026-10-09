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

import { urlFor } from './assets/registry.js'
import { arabicName } from './exerciseMedia.js'
import { todayKey } from './day.js'

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

/** What the poster says, decided apart from where it is drawn. */
export function posterFigures(report, { liveStreak = null, today } = {}) {
  const c = report.consistency || {}
  const over = isMonthOver(report.month, today)
  const streak = over ? c.endStreak : liveStreak
  const total = (c.calendar || []).length || 1
  const pct = Math.round((((c.trainedDays || 0) + (c.scheduledRests || 0)) / total) * 100)

  const figs = [
    { v: AR(report.sessionCount), l: 'جلسة' },
    { v: AR(report.sets?.completed), l: 'مجموعة مكتملة' },
  ]
  if (report.prs?.length) figs.push({ v: AR(report.prs.length), l: 'أعلى وزن', color: C.raise })
  if (Number.isFinite(streak) && streak > 0) {
    figs.push({ v: AR(streak), l: over ? `ستريك آخر ${monthName(report.monthLabel)}` : 'ستريك لين اليوم', color: C.streak, flame: true })
  }
  if (figs.length < 4) figs.push({ v: `${pct}%`, l: 'من أيام الخطة' })
  if (figs.length < 4) figs.push({ v: AR(report.reps?.total), l: 'تكرار' })
  return { figs: figs.slice(0, 4), pct }
}

// ── The poster ────────────────────────────────────────────────

export async function drawPoster(canvas, { report, profile = {}, mapping = {}, liveStreak = null, today } = {}) {
  canvas.width = POSTER_W
  canvas.height = POSTER_H
  const ctx = canvas.getContext('2d')

  await ensureFonts()
  const [cover, mark] = await Promise.all([loadImage(urlFor(report.cover)), loadImage(MARK.src)])

  // ── Ground and light ──
  ctx.fillStyle = C.ground
  ctx.fillRect(0, 0, POSTER_W, POSTER_H)

  if (cover) {
    // The month's art as the stage, cropped to fill the top, then sunk
    // into the ground so the number reads over it.
    const BAND = 900
    const scale = Math.max(POSTER_W / cover.width, BAND / cover.height)
    const w = cover.width * scale
    const h = cover.height * scale
    ctx.drawImage(cover, (POSTER_W - w) / 2, (BAND - h) / 2, w, h)
    const sink = ctx.createLinearGradient(0, 0, 0, BAND)
    sink.addColorStop(0, 'rgba(3,4,4,0.30)')
    sink.addColorStop(0.45, 'rgba(3,4,4,0.70)')
    sink.addColorStop(0.8, 'rgba(3,4,4,0.95)')
    sink.addColorStop(1, C.ground)
    ctx.fillStyle = sink
    ctx.fillRect(0, 0, POSTER_W, BAND + 2)
  } else {
    // One neutral stage light — light, not glow.
    const light = ctx.createRadialGradient(POSTER_W * 0.62, 470, 0, POSTER_W * 0.62, 470, 900)
    light.addColorStop(0, C.stage)
    light.addColorStop(0.72, C.ground)
    light.addColorStop(1, C.ground)
    ctx.fillStyle = light
    ctx.fillRect(0, 0, POSTER_W, POSTER_H)
  }

  // ── The month ──
  text(ctx, `تقرير الشهر · ${report.monthLabel}`, R, 300, { size: 38, weight: 600, color: C.ink3, maxWidth: COL })

  // ── The headline number: 96pt × 2.4, condensed, shrunk to fit ──
  const total = AR(report.volume.total)
  let size = total.replace(/\D/g, '').length >= 7 ? 200 : 240
  while (size > 140 && width(ctx, total, { size, weight: 800, stretch: 62, dir: 'ltr' }) > COL) size -= 8
  text(ctx, total, R, 300 + 24 + size * 0.86, { size, weight: 800, stretch: 62, dir: 'ltr', maxWidth: COL })
  const heroBase = 300 + 24 + size * 0.86
  text(ctx, 'كجم رفعتها', R, heroBase + 76, { size: 44, weight: 600, color: C.ink2 })

  // ── Four figures on hairlines, two by two ──
  const { figs, pct } = posterFigures(report, { liveStreak, today })
  const gridTop = heroBase + 140
  const ROW = 212
  const CELL = COL / 2
  hairline(ctx, gridTop)
  figs.forEach((f, i) => {
    const row = Math.floor(i / 2)
    const right = R - (i % 2) * CELL
    const base = gridTop + 40 + row * ROW + 104
    let x = right
    if (f.flame) {
      flame(ctx, right - 64, base - 76, 64, C.streak)
      x = right - 80
    }
    text(ctx, f.v, x, base, { size: 112, weight: 800, stretch: 85, color: f.color || C.ink, dir: 'ltr', maxWidth: CELL - 40 - (f.flame ? 80 : 0) })
    text(ctx, f.l, right, base + 56, { size: 34, weight: 600, color: C.ink3, maxWidth: CELL - 40 })
  })
  if (figs.length > 2) hairline(ctx, gridTop + ROW + 8)
  const gridBottom = gridTop + Math.ceil(figs.length / 2) * ROW + 16
  hairline(ctx, gridBottom)

  // ── The month's best lift — the one gold weight — or, without one,
  //    how much of the month went as planned. ──
  const best = report.prs?.[0]
  const blockTop = gridBottom + 72
  if (best) {
    const ar = arabicName(best.exercise, mapping)
    const kg = AR(Math.round(best.weight * 10) / 10)
    text(ctx, 'أقوى رقم', R, blockTop, { size: 34, weight: 600, color: C.ink3 })
    // The weight on the left, in gold; the name on the right.
    const wW = width(ctx, kg, { size: 132, weight: 800, stretch: 85, dir: 'ltr' })
    const unitW = width(ctx, 'كجم', { size: 38, weight: 600 })
    text(ctx, kg, L + unitW + 14, blockTop + 152, { size: 132, weight: 800, stretch: 85, color: C.raise, dir: 'ltr', align: 'left' })
    text(ctx, 'كجم', L, blockTop + 152, { size: 38, weight: 600, color: C.ink3, align: 'left' })
    const nameW = COL - wW - unitW - 64
    text(ctx, ar || best.exercise, R, blockTop + 76, { size: 54, weight: 700, color: C.ink, maxWidth: nameW, dir: ar ? 'rtl' : 'ltr' })
    if (ar) text(ctx, best.exercise, R, blockTop + 124, { size: 34, weight: 600, stretch: 85, color: C.ink3, maxWidth: nameW, dir: 'ltr' })
    const gain = Math.round((best.weight - best.prevBest) * 10) / 10
    text(ctx, `كان ${AR(best.prevBest)} كجم · \u2066+${AR(gain)}\u2069 كجم`, R, blockTop + 176, { size: 34, weight: 600, color: C.ink2, maxWidth: nameW })
  } else if (!figs.some(f => f.l === 'من أيام الخطة')) {
    text(ctx, 'الالتزام', R, blockTop, { size: 34, weight: 600, color: C.ink3 })
    text(ctx, `${pct}%`, R, blockTop + 140, { size: 132, weight: 800, stretch: 85, dir: 'ltr' })
    text(ctx, 'من أيام الخطة', R, blockTop + 196, { size: 34, weight: 600, color: C.ink3 })
  }

  // ── Who this is, and the mark ──
  const FOOT = 1452
  hairline(ctx, FOOT)
  const name = (profile.name || '').trim()
  const rank = report.progress?.rank?.label
  const level = `المستوى ${AR(report.progress?.level)}${rank ? ` · ${rank}` : ''}`
  if (name) {
    text(ctx, name, R, FOOT + 76, { size: 46, weight: 700, color: C.ink, maxWidth: COL - 260 })
    text(ctx, level, R, FOOT + 128, { size: 34, weight: 600, color: C.ink3, maxWidth: COL - 260 })
  } else {
    text(ctx, level, R, FOOT + 98, { size: 38, weight: 600, color: C.ink2, maxWidth: COL - 260 })
  }
  if (mark) {
    const h = 80
    const w = MARK.w * (h / MARK.h)
    ctx.drawImage(mark, MARK.x, MARK.y, MARK.w, MARK.h, L, FOOT + 88 - h / 2, w, h)
  }

  return canvas
}

/** The poster as a PNG blob. */
export async function buildPosterBlob(opts) {
  const canvas = document.createElement('canvas')
  await drawPoster(canvas, opts)
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

export async function sharePoster({ report, profile, mapping, liveStreak, today, onInline } = {}) {
  const blob = await buildPosterBlob({ report, profile, mapping, liveStreak, today })
  const filename = `meran-${report.month}.png`
  const file = typeof File === 'function'
    ? new File([blob], filename, { type: 'image/png' })
    : null

  // 1. The share sheet.
  if (file && canShareFiles(file)) {
    try {
      await navigator.share({ files: [file], title: `تقرير ${report.monthLabel}` })
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
