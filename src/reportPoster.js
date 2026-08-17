// ── The shareable poster ──────────────────────────────────────
// The report itself is a moving thing; a shared image cannot be. This
// draws the month's highlights onto a 1080×1920 story canvas and hands
// it to the share sheet.
//
// Drawn with the 2D context directly rather than by rasterising the
// DOM. html2canvas is a heavy dependency that mishandles @font-face,
// and DOM→SVG needs every font and image inlined by hand and fails
// silently when one is missed. A canvas is more code here and no
// surprises anywhere else.
//
// Canvas cannot read CSS custom properties, so the palette is repeated
// as literals. These are the values in index.css :root.

import { urlFor } from './assets/registry.js'

export const POSTER_W = 1080
export const POSTER_H = 1920

const C = {
  bg: '#080B14', bg2: '#101928', border: '#1E2D40',
  cyan: '#5EC32A', gold: '#F59E0B', purple: '#3B9DE8',
  text: '#EEF4FF', text2: '#B8D0E8', text3: '#607888',
}

const AR = (n) => Number(n || 0).toLocaleString('en-US')

// Changa is the app's Arabic face and comes from Google Fonts;
// Zanjabeel is bundled locally and precached by the service worker.
// Naming both means an offline poster still renders Arabic properly,
// just in the fallback face.
const FAMILY = "'Changa','Zanjabeel',sans-serif"
const font = (weight, size) => `${weight} ${size}px ${FAMILY}`

/**
 * Wait for the faces actually used here. Without this the first draw
 * lands in a fallback face — the text is there but wrong, and it is
 * baked into the PNG with no second chance.
 */
async function ensureFonts() {
  if (!document.fonts?.load) return
  const wanted = [font(900, 128), font(900, 64), font(800, 46), font(700, 34), font(400, 28)]
  try {
    await Promise.all(wanted.map(f => document.fonts.load(f, 'مران 0123456789')))
    await document.fonts.ready
  } catch {
    // A font that will not load is not a reason to refuse the poster.
  }
}

/** The cover, or null when the art pack is not installed. */
async function loadCover(slot) {
  const url = urlFor(slot)
  if (!url) return null
  try {
    const img = new Image()
    // A blob: URL is same-origin, so this never taints the canvas.
    img.src = url
    await (img.decode ? img.decode() : new Promise((res, rej) => { img.onload = res; img.onerror = rej }))
    return img
  } catch {
    return null
  }
}

// ── Drawing helpers ───────────────────────────────────────────

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Centred text with an optional glow, the poster's only text idiom. */
function centred(ctx, text, y, { size, weight = 700, color = C.text, glow, maxWidth }) {
  ctx.font = font(weight, size)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = color
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = size * 0.5 }
  ctx.fillText(text, POSTER_W / 2, y, maxWidth)
  ctx.shadowBlur = 0
  ctx.shadowColor = 'transparent'
}

function tile(ctx, x, y, w, h, value, label, color) {
  ctx.fillStyle = C.bg2
  roundRect(ctx, x, y, w, h, 26)
  ctx.fill()
  ctx.strokeStyle = C.border
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.fillStyle = color
  ctx.font = font(900, 56)
  ctx.fillText(value, x + w / 2, y + h * 0.52, w - 20)

  ctx.fillStyle = C.text3
  ctx.font = font(600, 26)
  ctx.fillText(label, x + w / 2, y + h * 0.78, w - 16)
}

// ── The poster ────────────────────────────────────────────────

export async function drawPoster(canvas, { report, profile = {} } = {}) {
  canvas.width = POSTER_W
  canvas.height = POSTER_H
  const ctx = canvas.getContext('2d')

  // Arabic shapes and orders itself in the engine, but only when the
  // context is told the text is right-to-left.
  ctx.direction = 'rtl'

  await ensureFonts()

  // ── Background ──
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, POSTER_W, POSTER_H)

  // ── Cover band ──
  const BAND = 640
  const cover = await loadCover(report.cover)
  if (cover) {
    // Fill the band and crop the overflow rather than squashing it.
    const scale = Math.max(POSTER_W / cover.width, BAND / cover.height)
    const w = cover.width * scale
    const h = cover.height * scale
    ctx.drawImage(cover, (POSTER_W - w) / 2, (BAND - h) / 2, w, h)
  } else {
    // No pack installed. A flat wash reads as a picture that failed to
    // load, so the fallback is built up until the band looks intended:
    // the app's own palette, then two soft lights over it.
    const g = ctx.createLinearGradient(0, 0, POSTER_W, BAND)
    g.addColorStop(0, '#0E1A24')
    g.addColorStop(0.55, '#17331E')
    g.addColorStop(1, '#3A2A0C')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, POSTER_W, BAND)

    for (const [x, yy, r, color] of [
      [POSTER_W * 0.24, BAND * 0.34, 380, 'rgba(94,195,42,0.34)'],
      [POSTER_W * 0.82, BAND * 0.22, 300, 'rgba(245,158,11,0.28)'],
    ]) {
      const glow = ctx.createRadialGradient(x, yy, 0, x, yy, r)
      glow.addColorStop(0, color)
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, POSTER_W, BAND)
    }
  }

  // Dissolve the band into the page so the title has somewhere to sit.
  const fade = ctx.createLinearGradient(0, BAND * 0.35, 0, BAND)
  fade.addColorStop(0, 'rgba(8,11,20,0)')
  fade.addColorStop(1, C.bg)
  ctx.fillStyle = fade
  ctx.fillRect(0, BAND * 0.35, POSTER_W, BAND * 0.65 + 2)

  // ── Title ──
  centred(ctx, 'تقرير الشهر', 606, { size: 30, weight: 600, color: C.text3 })
  centred(ctx, report.monthLabel, 706, { size: 72, weight: 900, color: C.text, maxWidth: POSTER_W - 120 })

  // ── The headline number ──
  const heroY = 900
  const halo = ctx.createRadialGradient(POSTER_W / 2, heroY - 40, 0, POSTER_W / 2, heroY - 40, 320)
  halo.addColorStop(0, 'rgba(94,195,42,0.30)')
  halo.addColorStop(1, 'rgba(94,195,42,0)')
  ctx.fillStyle = halo
  ctx.fillRect(0, heroY - 360, POSTER_W, 720)

  centred(ctx, AR(report.volume.total), heroY, {
    size: 132, weight: 900, color: C.text, glow: 'rgba(94,195,42,0.55)', maxWidth: POSTER_W - 100,
  })
  centred(ctx, 'كيلوغراماً رفعتها', heroY + 74, { size: 38, weight: 700, color: C.cyan })

  // ── Four figures ──
  const pad = 60
  const gap = 22
  const tw = (POSTER_W - pad * 2 - gap) / 2
  const th = 168
  const ty = 1055

  tile(ctx, pad, ty, tw, th, AR(report.sessionCount), 'جلسة', C.cyan)
  tile(ctx, pad + tw + gap, ty, tw, th, AR(report.sets.completed), 'مجموعة مكتملة', C.text)
  tile(ctx, pad, ty + th + gap, tw, th, AR(report.consistency.bestStreak), 'أطول سلسلة', C.purple)
  tile(ctx, pad + tw + gap, ty + th + gap, tw, th, AR(report.prs.length), 'رقم قياسي', C.gold)

  // ── The month's best lift ──
  // The footer is anchored to the bottom edge, so the content above it
  // has a fixed budget rather than pushing into it. Stacking the two
  // ran the name straight through the wordmark.
  let y = ty + (th + gap) * 2 + 24
  const best = report.prs[0]
  if (best) {
    const h = 168
    ctx.fillStyle = 'rgba(245,158,11,0.10)'
    roundRect(ctx, pad, y, POSTER_W - pad * 2, h, 28)
    ctx.fill()
    ctx.strokeStyle = 'rgba(245,158,11,0.45)'
    ctx.lineWidth = 2
    ctx.stroke()

    centred(ctx, '🏆 أقوى رقم قياسي', y + 50, { size: 28, weight: 700, color: C.gold })
    centred(ctx, best.exercise, y + 96, { size: 38, weight: 800, color: C.text, maxWidth: POSTER_W - pad * 2 - 60 })
    centred(ctx, `${AR(best.weight)} كجم · من ${AR(best.prevBest)}`, y + 140, {
      size: 28, weight: 600, color: C.text2,
    })
  }

  // ── Who this is ──
  const rank = report.progress.rank
  const name = (profile.name || '').trim()
  const line = [name, rank?.label, `المستوى ${AR(report.progress.level)}`].filter(Boolean).join('  ·  ')
  centred(ctx, line, POSTER_H - 215, { size: 36, weight: 700, color: C.text2, maxWidth: POSTER_W - 120 })

  // ── Signature ──
  ctx.strokeStyle = C.border
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(POSTER_W / 2 - 90, POSTER_H - 170)
  ctx.lineTo(POSTER_W / 2 + 90, POSTER_H - 170)
  ctx.stroke()

  centred(ctx, 'مران', POSTER_H - 112, { size: 50, weight: 900, color: C.cyan, glow: 'rgba(94,195,42,0.4)' })
  centred(ctx, 'MERAN', POSTER_H - 68, { size: 22, weight: 600, color: C.text3 })

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

export async function sharePoster({ report, profile, onInline } = {}) {
  const blob = await buildPosterBlob({ report, profile })
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
