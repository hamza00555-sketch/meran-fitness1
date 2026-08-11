#!/usr/bin/env node
// ── Generation prompts for the art pack ───────────────────────
//
//   node scripts/prompts.mjs            # readable list
//   node scripts/prompts.mjs --json     # [{ id, file, prompt }]
//   node scripts/prompts.mjs --only ach_c3,scene_pr
//
// Every prompt shares one style string so the 48 pieces read as one
// set. These are illustrated badges and scenes, not interface icons —
// the small glyphs in the app stay as they are.
//
// The style continues the art direction already in public/assets
// (flat anime, heraldic, clean bold linework) but on the palette the
// app actually uses now; the prompt pack in the repo root is on a
// purple scheme the UI moved away from.

import { pathToFileURL } from 'node:url'
import path from 'node:path'

const { allSlots } = await import(pathToFileURL(path.resolve('src/assets/slots.js')).href)

export const STYLE = [
  'flat anime illustration, premium mobile game asset',
  'clean bold linework, crisp silhouette readable at small size',
  'single centred subject with generous padding, no text, no letters, no numbers',
  'deep near-black background #080B14, transparent PNG',
  'restrained glow, no lens flare, no photorealism',
  'square canvas 512x512px',
].join(', ')

// Rarity drives the material, so the four tiers read as a progression
// at a glance rather than needing a label.
const RARITY = {
  common:    { material: 'rough grey stone with worn edges',            accent: '#9CA3AF' },
  rare:      { material: 'brushed steel with a cool blue sheen',        accent: '#3B9DE8' },
  epic:      { material: 'polished emerald-green alloy, faint runes',   accent: '#5EC32A' },
  legendary: { material: 'gleaming gold with ornate filigree',          accent: '#F59E0B' },
}

// Category drives the motif that sits inside the badge.
const CATEGORY = {
  sessions: 'a training session tally motif',
  strength: 'a heavy barbell and raw power motif',
  streak:   'a burning flame and continuity motif',
  volume:   'a stacked-weight tonnage motif',
}

const SCENE_STYLE = 'dramatic hero illustration, radiant and celebratory, ' + STYLE

export function promptFor(slot) {
  if (slot.kind === 'achievement') {
    const r = RARITY[slot.rarity] || RARITY.common
    const motif = CATEGORY[slot.cat] || 'a training motif'
    return [
      `an ornate circular achievement badge, ${r.material}`,
      `${motif}, representing "${slot.title}" — ${slot.desc}`,
      `accent colour ${r.accent}`,
      `${slot.rarity} tier, heraldic and collectible`,
      STYLE,
    ].join(', ')
  }
  if (slot.kind === 'scene') return `${slot.en}, accent colour #F59E0B, ${SCENE_STYLE}`
  return `${slot.en}, muted and understated, accent colour #3B9DE8, ${STYLE}`
}

const only = (() => {
  const i = process.argv.indexOf('--only')
  return i > -1 && process.argv[i + 1] ? new Set(process.argv[i + 1].split(',')) : null
})()

const slots = allSlots().filter(s => !only || only.has(s.id))

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(
    slots.map(s => ({ id: s.id, file: `${s.id}.png`, kind: s.kind, prompt: promptFor(s) })),
    null, 2,
  ))
} else {
  const n = { achievement: 0, scene: 0, empty: 0 }
  for (const s of slots) n[s.kind]++
  console.log(`# مران — ${slots.length} صورة · أسلوب واحد`)
  console.log(`#   ${n.achievement} جائزة · ${n.scene} احتفال · ${n.empty} حالة فارغة\n`)
  console.log('احفظ كل صورة باسم معرّفها في assets-src/<id>.png ثم:\n')
  console.log('  node scripts/build-manifest.mjs --base https://<your-domain>/')
  console.log('  node scripts/upload-r2.mjs\n')
  for (const s of slots) {
    console.log(`── ${s.id}.png${s.title ? `   (${s.title})` : ''}`)
    console.log(promptFor(s))
    console.log()
  }
}
