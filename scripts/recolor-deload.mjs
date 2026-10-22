#!/usr/bin/env node
// ── The deload's copy of a picture ────────────────────────────
// Under a deload no lime survives the app (Hamza: «لازم نسوي نسخ للديلود
// برضو»), so the after-workout pictures have a twin in the deload's
// glacier blue: the same approved picture, its lime (#5EC32A, hue ~92°)
// turned pixel by pixel to #5CC9EE. Only the green band moves; the black
// figure, the props' greys and the alpha stay exactly as they were.
//
//   node scripts/recolor-deload.mjs <in.png> <out.png>
//   node scripts/recolor-deload.mjs --summaries     (assets-cut/summary_N → summary_N_deload)

import sharp from 'sharp'
import { readdir } from 'node:fs/promises'

export async function recolor(src, out) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
    if (d < 1e-6) continue
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    h *= 60; if (h < 0) h += 360
    if (h < 55 || h > 160) continue
    const s = d / max, v = max
    // full inside 70–135°, fading out to the band's edges so nothing seams
    const w = h < 70 ? (h - 55) / 15 : h > 135 ? (160 - h) / 25 : 1
    const nh = h + 104 * w
    const ns = s * (1 - 0.18 * w)
    const nv = Math.min(1, v * (1 + 0.22 * w))
    const c = nv * ns, x = c * (1 - Math.abs(((nh / 60) % 2) - 1)), m = nv - c
    const [rr, gg, bb] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(nh / 60) % 6]
    data[i] = Math.round((rr + m) * 255); data[i + 1] = Math.round((gg + m) * 255); data[i + 2] = Math.round((bb + m) * 255)
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(out)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv[2] === '--summaries') {
    const files = (await readdir('assets-cut')).filter(f => /^summary_\d+\.png$/.test(f))
    for (const f of files) await recolor(`assets-cut/${f}`, `assets-cut/${f.replace('.png', '_deload.png')}`)
    console.log(`✓ ${files.length} deload copies`)
  } else {
    await recolor(process.argv[2], process.argv[3])
  }
}
