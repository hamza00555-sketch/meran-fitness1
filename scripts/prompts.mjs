#!/usr/bin/env node
// ── Generation prompts for the icon pack ──────────────────────
//
//   node scripts/prompts.mjs            # human-readable list
//   node scripts/prompts.mjs --json     # [{ id, prompt }] for an API
//   node scripts/prompts.mjs --only flame,trophy
//
// Every prompt shares one style string so the whole pack looks like
// one set. The style continues the art direction already in
// public/assets (flat anime, dark circular badge, clean linework) but
// on the palette the app actually uses today — the old prompt pack in
// the repo root is on a purple scheme the UI moved away from.

import { pathToFileURL } from 'node:url'
import path from 'node:path'

const { ASSETS } = await import(pathToFileURL(path.resolve('src/assets/ids.js')).href)

export const STYLE = [
  'flat anime illustration style',
  'clean bold linework',
  'dark circular badge background #0C1220',
  'minimal glow, no photorealism, no gradients beyond a single soft inner light',
  'centred single subject, generous padding, no text, no letters',
  'transparent PNG, square canvas 256x256px',
  'premium fitness game UI asset, Solo Leveling HUD aesthetic',
].join(', ')

// One accent per family so the set reads as a system rather than a
// pile of individually pretty icons.
const ACCENTS = {
  green:  '#5EC32A',   // primary — progress, confirmation, streak
  blue:   '#3B9DE8',   // secondary — schedule, rest, information
  gold:   '#F59E0B',   // reward — trophies, ranks, celebration
  red:    '#EF4444',   // alert — warnings, bosses, failure
  orange: '#F97316',   // effort — heat, intensity
}

const ACCENT_FOR = {
  gold:  ['trophy', 'crown', 'star', 'star_glow', 'medal_gold', 'gem', 'hundred', 'party', 'ticket', 'rocket', 'brightness', 'bulb'],
  red:   ['warn', 'ogre', 'eye', 'bomb', 'volcano', 'heart', 'trash', 'lion'],
  orange:['flame', 'burst', 'trident', 'crane'],
  blue:  ['moon', 'sleep', 'calendar', 'calendar_days', 'calendar_spiral', 'alarm', 'clock', 'clock3',
          'stopwatch', 'hourglass', 'droplet', 'cup', 'alembic', 'wave', 'planet', 'info', 'chat',
          'microscope', 'brain', 'sunrise', 'sunrise_mountain', 'map', 'books', 'book_open'],
}

const accentOf = (id) => {
  for (const [name, ids] of Object.entries(ACCENT_FOR)) if (ids.includes(id)) return ACCENTS[name]
  return ACCENTS.green
}

export const promptFor = (id) => {
  const meta = ASSETS[id]
  if (!meta) return null
  return `${meta.en}, accent colour ${accentOf(id)} on near-black #080B14, ${STYLE}`
}

const only = (() => {
  const i = process.argv.indexOf('--only')
  return i > -1 && process.argv[i + 1] ? new Set(process.argv[i + 1].split(',')) : null
})()

const ids = Object.keys(ASSETS).filter(id => !only || only.has(id))

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(ids.map(id => ({ id, file: `${id}.png`, prompt: promptFor(id) })), null, 2))
} else {
  console.log(`# مران — ${ids.length} أيقونة · أسلوب واحد\n`)
  console.log(`Save each as assets-src/<id>.png, then:\n`)
  console.log(`  node scripts/build-manifest.mjs --base https://<your-domain>/`)
  console.log(`  node scripts/upload-r2.mjs\n`)
  for (const id of ids) {
    console.log(`── ${id}.png   (replaces ${ASSETS[id].emoji})`)
    console.log(promptFor(id))
    console.log()
  }
}
