#!/usr/bin/env node
// Send the captured screens to Miswadah, one request each.
//
//   MISWADAH_TOKEN=ms_live_… node scripts/push-screens.mjs
//   node scripts/push-screens.mjs --dry        # what would go, and how big
//   MISWADAH_TOKEN=… node scripts/push-screens.mjs --list   # what is up there now
//
// Run scripts/screens.mjs first. These are real captures of the running
// app, so every one goes up as kind:"capture" — the flag that tells a
// later agent this is evidence and not a mood board. Nothing generated
// is ever sent from here.
//
// PNG comes off the harvester at device scale (1170×1992, ~450 KB).
// Miswadah wants WebP around 1200px wide and under 250 KB, so each is
// re-encoded on the way out; anything still over the cap is refused
// rather than sent and silently rejected at the other end.

import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const API   = process.env.MISWADAH_API || 'https://design-system-web-9mj4.vercel.app'
const TOKEN = process.env.MISWADAH_TOKEN
const SHOTS = path.resolve(process.env.SHOTS || 'screenshots')
const has   = (f) => process.argv.includes('--' + f)

const MAX_BYTES = 250 * 1024
const WIDTH     = 1200
const CAP       = 40

// The art pack is served from a CDN that the harvester blocks, so every
// art slot falls back to a local asset or an emoji in the same box.
// Layout, spacing and every token are exact; the picture inside an
// achievement badge or the report cover is not. Said on every screen so
// nobody reads a placeholder as the design.
const ART_NOTE = ' (Art-pack images are CDN-served and were blocked during '
  + 'capture, so illustration slots show their local fallback; layout, '
  + 'spacing and colour are exact.)'

if (!TOKEN && !has('dry') ) {
  console.error(`
  MISWADAH_TOKEN is not set.

      MISWADAH_TOKEN=ms_live_… node scripts/push-screens.mjs
`)
  process.exit(1)
}

if (has('list')) {
  const res = await fetch(`${API}/api/systems/screens`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  const text = await res.text()
  try { console.log(JSON.stringify(JSON.parse(text), null, 2)) }
  catch { console.log(text.slice(0, 4000)) }
  process.exit(res.ok ? 0 : 1)
}

// ── Gather ────────────────────────────────────────────────────

const indexPath = path.join(SHOTS, 'index.json')
if (!existsSync(indexPath)) {
  console.error(`
  No ${indexPath}.

      npm run build && npm run screens
`)
  process.exit(1)
}

const index = JSON.parse(readFileSync(indexPath, 'utf8'))
const screens = index.screens

if (screens.length > CAP) {
  console.error(`\n  ${screens.length} screens, and the service takes ${CAP}.\n`)
  process.exit(1)
}

console.log(`\n  ${screens.length} screens from ${index.commit}\n`)

// ── Send ──────────────────────────────────────────────────────

let sent = 0
const failed = []
let totalOut = 0

for (const s of screens) {
  const png = readFileSync(path.join(SHOTS, s.file))
  const webp = await sharp(png).resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 }).toBuffer()
  totalOut += webp.length

  const kb = (webp.length / 1024).toFixed(0)
  if (webp.length > MAX_BYTES) {
    failed.push([s.id, `${kb} KB — over the ${MAX_BYTES / 1024} KB cap`])
    continue
  }

  // Everything the description can carry that the picture cannot: which
  // fixture state it is, whether the deload mode is on, and the art
  // caveat. A later agent reads this before deciding to fetch the bytes.
  const description = [
    s.labelEn || s.label,
    '—',
    s.state,
    s.deload ? '· deload mode (glacier accent)' : '',
    `· ${s.device}`,
  ].filter(Boolean).join(' ') + ART_NOTE

  if (has('dry')) {
    console.log(`  ${s.id.padEnd(28)} ${String(kb).padStart(4)} KB  ${s.group}`)
    sent++
    continue
  }

  const res = await fetch(`${API}/api/systems/screens`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: s.id,                 // stable, so a re-run replaces rather than duplicates
      description,
      kind: 'capture',            // a real screenshot of the running app
      data: webp.toString('base64'),
      mimeType: 'image/webp',
    }),
  })

  if (res.ok) {
    sent++
    console.log(`  ✅ ${s.id.padEnd(28)} ${String(kb).padStart(4)} KB`)
  } else {
    const body = (await res.text()).slice(0, 200).replace(/\s+/g, ' ')
    failed.push([s.id, `${res.status} ${body}`])
    console.log(`  ❌ ${s.id.padEnd(28)} ${res.status}`)
  }
}

console.log(`\n  ${sent} of ${screens.length} ${has('dry') ? 'ready' : 'sent'} · ${(totalOut / 1048576).toFixed(1)} MB of WebP`)
for (const [id, why] of failed) console.log(`  ❌ ${id}: ${why}`)
console.log()

process.exit(failed.length ? 1 : 0)
