#!/usr/bin/env node
// ── Stand-in art ──────────────────────────────────────────────
//
//   node scripts/gen-placeholders.mjs <out-dir> [a|b]
//
// One flat disc per id, hue-stepped so every icon is visibly
// distinct. Not for shipping — this exists so the pipeline, the
// download, and the live swap can all be proven end to end before
// the real icons are generated. Pass `b` for a second, different
// pack to exercise the update path.

import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
const { ASSETS } = await import(pathToFileURL(path.resolve('src/assets/ids.js')).href)
const out = process.argv[2]
const variant = process.argv[3] || 'a'
await mkdir(out, { recursive: true })
const ids = Object.keys(ASSETS)
for (const [i, id] of ids.entries()) {
  const hue = Math.round((i / ids.length) * 360) + (variant === 'b' ? 40 : 0)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
    <circle cx="128" cy="128" r="120" fill="hsl(${hue} 70% 22%)" stroke="hsl(${hue} 80% 55%)" stroke-width="8"/>
    <circle cx="128" cy="128" r="52" fill="hsl(${hue} 80% 55%)"/>
    <rect x="60" y="180" width="136" height="14" rx="7" fill="hsl(${hue} 80% 55%)" opacity="0.7"/>
  </svg>`
  await writeFile(path.join(out, `${id}.png`), await sharp(Buffer.from(svg)).png().toBuffer())
}
console.log(`placeholders(${variant}): ${ids.length}`)
