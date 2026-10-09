// ── A level-up card to share ──────────────────────────────────
//
// 1080×1920, drawn on a canvas from the same tokens as the screen: the
// crest under one neutral light, «مستوى جديد», the number, the rank.
// Shared the way the monthly report is: the share sheet, else a
// download, else handed back as a URL for the screen to show inline.

import { canShareFiles, supportsDownload, SHARE_RESULT } from '../../reportPoster.js'
import { crestSrc } from './RankCrest.jsx'

const W = 1080
const H = 1920

const token = (name, fallback) => {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || fallback
  } catch { return fallback }
}

const loadImage = (src) => new Promise((resolve) => {
  const img = new Image()
  img.onload = () => resolve(img)
  img.onerror = () => resolve(null)
  img.src = src
})

export async function drawLevelCard(canvas, { level, rank }) {
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const ground = token('--ground', '#030404')
  const light = token('--stage-light', '#2A3038')
  const ink = token('--ink', '#F4F6F8')
  const ink2 = token('--ink-2', '#B0B9C3')
  const ink3 = token('--ink-3', '#8A95A1')
  const accent = token('--accent', '#5EC32A')

  try {
    await Promise.all([
      document.fonts?.load?.('800 300px "Meran Latin"'),
      document.fonts?.load?.('800 60px "Meran Arabic"'),
    ])
  } catch { /* the system face will do */ }

  ctx.fillStyle = ground
  ctx.fillRect(0, 0, W, H)
  const g = ctx.createRadialGradient(W / 2, 720, 40, W / 2, 720, 760)
  g.addColorStop(0, light)
  g.addColorStop(1, ground)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  const crest = await loadImage(crestSrc(rank)) || await loadImage(rank?.img)
  if (crest) ctx.drawImage(crest, (W - 600) / 2, 400, 600, 600)

  ctx.textAlign = 'center'
  ctx.direction = 'rtl'
  ctx.fillStyle = accent
  ctx.font = '600 56px "Meran Arabic", "Meran Latin", system-ui, sans-serif'
  ctx.fillText('مستوى جديد', W / 2, 1150)

  ctx.direction = 'ltr'
  ctx.fillStyle = ink
  ctx.font = '800 320px "Meran Latin", system-ui, sans-serif'
  ctx.fillText(String(level), W / 2, 1450)

  ctx.direction = 'rtl'
  ctx.fillStyle = ink2
  ctx.font = '700 64px "Meran Arabic", "Meran Latin", system-ui, sans-serif'
  if (rank) ctx.fillText(`${rank.label} · ${rank.tier}`, W / 2, 1590)

  ctx.fillStyle = ink3
  ctx.font = '600 44px "Meran Arabic", "Meran Latin", system-ui, sans-serif'
  ctx.fillText('مران', W / 2, 1800)
}

export async function shareLevelCard({ level, rank, onInline }) {
  const canvas = document.createElement('canvas')
  await drawLevelCard(canvas, { level, rank })
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('card-encode-failed')
  const filename = `meran-level-${level}.png`
  const file = typeof File === 'function' ? new File([blob], filename, { type: 'image/png' }) : null

  if (file && canShareFiles(file)) {
    try {
      await navigator.share({ files: [file], title: `مستوى جديد · ${level}` })
      return SHARE_RESULT.SHARED
    } catch (err) {
      if (err?.name === 'AbortError') return SHARE_RESULT.CANCELLED
    }
  }

  const url = URL.createObjectURL(blob)
  if (supportsDownload()) {
    try {
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      return SHARE_RESULT.DOWNLOADED
    } catch { /* fall through */ }
  }
  onInline?.(url)
  return SHARE_RESULT.INLINE
}
