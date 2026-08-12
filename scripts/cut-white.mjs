#!/usr/bin/env node
// ── Turn the flat white field into real transparency ──────────
//
//   node scripts/cut-white.mjs <in-dir> <out-dir>
//
// The generator is asked for a plain white background rather than a
// transparent one, because asking GPT Image for transparency makes it
// *paint* the checkerboard that usually represents transparency —
// fully opaque grey squares. A flat white field is unambiguous and
// keys out cleanly.
//
// This is a flood fill inward from the border, not a colour key: only
// white reachable from the edge is cleared, so a white highlight
// enclosed by the artwork survives. The subjects are centred with
// padding, which is what makes that safe.

import { readdir, mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const [IN, OUT] = process.argv.slice(2)
if (!IN || !OUT) { console.error('usage: cut-white.mjs <in-dir> <out-dir>'); process.exit(1) }

// The field measures 253-255 on every channel. The threshold sits
// just below that and demands near-zero chroma, so cream and pale
// gold inside the badges are never mistaken for background.
const WHITE = 244
const MAX_CHROMA = 8

const isBg = (r, g, b) =>
  r >= WHITE && g >= WHITE && b >= WHITE &&
  Math.max(r, g, b) - Math.min(r, g, b) <= MAX_CHROMA

async function cut(inPath, outPath) {
  const { data, info } = await sharp(inPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h, channels: ch } = info

  const seen = new Uint8Array(w * h)
  const stack = []
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const p = y * w + x
    if (seen[p]) return
    seen[p] = 1
    const i = p * ch
    if (!isBg(data[i], data[i + 1], data[i + 2])) return
    data[i + 3] = 0
    stack.push(p)
  }

  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1) }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y) }
  while (stack.length) {
    const p = stack.pop()
    const x = p % w, y = (p / w) | 0
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1)
  }

  // The subject fades into the field over an antialiased edge. Those
  // in-between pixels stay opaque and read as a pale rim on a dark
  // background, so they are faded in proportion to how close to white
  // they are and darkened back toward the artwork's own colour.
  for (let p = 0; p < w * h; p++) {
    const i = p * ch
    if (data[i + 3] === 0) continue
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const lum = (r + g + b) / 3
    if (lum <= WHITE - 40) continue
    if (Math.max(r, g, b) - Math.min(r, g, b) > MAX_CHROMA * 3) continue
    // Only fringe pixels — ones that touch cleared space — qualify.
    const x = p % w, y = (p / w) | 0
    const touchesVoid =
      (x > 0     && data[(p - 1) * ch + 3] === 0) ||
      (x < w - 1 && data[(p + 1) * ch + 3] === 0) ||
      (y > 0     && data[(p - w) * ch + 3] === 0) ||
      (y < h - 1 && data[(p + w) * ch + 3] === 0)
    if (!touchesVoid) continue
    const t = Math.min(1, (lum - (WHITE - 40)) / 40)   // 0 at the artwork, 1 at pure white
    data[i + 3] = Math.round(data[i + 3] * (1 - t))
  }

  await sharp(data, { raw: { width: w, height: h, channels: ch } })
    .trim({ threshold: 0 })              // drop the empty margin so the subject fills the frame
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath)

  let cleared = 0
  for (let p = 0; p < w * h; p++) if (!data[p * ch + 3]) cleared++
  return cleared / (w * h)
}

await mkdir(OUT, { recursive: true })
const files = (await readdir(IN)).filter(f => f.endsWith('.png')).sort()
const suspect = []
for (const f of files) {
  const ratio = await cut(path.join(IN, f), path.join(OUT, f))
  // A badge fills roughly 60-80% of its frame, so 20-45% cleared is
  // normal. Well outside that means the fill either leaked into the
  // artwork or never got started.
  const odd = ratio < 0.08 || ratio > 0.75
  if (odd) suspect.push(`${f} (${(ratio * 100).toFixed(0)}%)`)
}
console.log(`cut ${files.length} images`)
if (suspect.length) console.log(`! check these: ${suspect.join(', ')}`)
