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

const { allSlots, DELOADS_STYLE_NOTE } = await import(pathToFileURL(path.resolve('src/assets/slots.js')).href)

export const STYLE = [
  'flat anime illustration, premium mobile game asset',
  'clean bold linework, crisp silhouette readable at small size',
  'single centred subject with generous padding, no text, no letters, no numbers',
  // Asked for white rather than transparent on purpose: GPT Image
  // answers "transparent" by *painting* the checkerboard that
  // represents it. A flat white field is keyed out cleanly afterwards.
  'plain solid white background, no scenery, no shadow on the ground',
  'restrained glow, no lens flare, no photorealism',
  'square canvas',
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

// The app's titles are Arabic, which the image model has little to
// work with. These are the same meanings in English, and they are
// what makes each of the forty badges its own picture rather than
// forty variations of one.
const SUBJECT = {
  a1:  'a single first footprint on stone, the very beginning',
  a2:  'five small tally marks carved in a row',
  a3:  'ten tally marks filling a stone tablet',
  a4:  'a quarter-full progress ring over crossed dumbbells',
  a5:  'a half-full progress ring over crossed dumbbells',
  a6:  'a century milestone monolith, one hundred sessions',
  a7:  'a towering double monolith, two hundred sessions',
  a8:  'an hourglass beside a dumbbell, a full hour trained',
  a9:  'two hourglasses back to back, a marathon session',
  a10: 'a sunrise over three stacked training rings, three in one day',

  b1:  'a loaded barbell bending slightly under its first big plates',
  b2:  'a heavier barbell with thick plates and a firm grip',
  b3:  'a barbell bowing deeply under an enormous load',
  b4:  'a colossal barbell wreathed in energy, a peak lift',
  b5:  'fifteen small chevrons stacked into a column',
  b6:  'thirty chevrons packed into a dense column',
  b7:  'a deadlift bar and a bench press bar crossed together',
  b8:  'three crossed bars for squat, bench and deadlift, a trinity',
  b9:  'a six-sided rosette, each facet a different muscle',
  b10: 'a warrior helm above five hundred stacked marks, mental grit',

  c1:  'a small flame just catching, three days alive',
  c2:  'a steady week-long flame in a ring of seven',
  c3:  'twin flames in a fortnight ring',
  c4:  'a roaring month-long fire inside a calendar ring',
  c5:  'an unstoppable blaze breaking its frame',
  c6:  'an armoured gauntlet fist wreathed in eternal fire, iron will',
  c7:  'a phoenix ember rekindling from ash, a fresh start',
  c8:  'five flame marks around a weekly dial',
  c9:  'a shield guarding an unbroken chain, never absent',
  c10: 'a full calendar face densely marked, a complete month',

  d1:  'a single one-tonne weight block',
  d2:  'a stack of five tonne blocks',
  d3:  'a tall stack of ten tonne blocks',
  d4:  'a mountain built entirely of iron plates',
  d5:  'a star forged from iron plates, a million kilos',
  d6:  'a logbook with ten neat entries',
  d7:  'a thick ledger with a hundred precise entries',
  d8:  'five distinct exercise symbols arranged in a fan',
  d9:  'a library shelf of movement scrolls',
  d10: 'a cresting wave made of iron plates',
}

const SCENE_STYLE = 'dramatic hero illustration, radiant and celebratory, ' + STYLE

// The covers break the shared style deliberately. Everything else is a
// keyed-out badge on white; a cover is a full-bleed banner that the
// report's text sits below, so it wants edge-to-edge atmosphere and no
// white field to cut away.
const COVER_STYLE = [
  'cinematic wide banner illustration, full bleed to every edge',
  'atmospheric gym interior, deep dark background, moody volumetric light',
  'no text, no letters, no numbers, no logos',
  'no white background, no border, no frame, no vignette edges',
  'no people, no faces, no bodies — equipment and light only',
  'space at the lower edge free of detail so text can sit beneath it',
  'green #5EC32A and amber #F59E0B accents on near-black #080B14',
  'painted illustration, rich and clean, not photorealistic',
].join(', ')

// ── Exercise artwork ──────────────────────────────────────────
// The style is the app's own: the matte-black sculpted 3D figure from
// the muscle images, performing the lift on the correct equipment,
// with the working muscle lit green on its body. One picture carries
// both "how this movement looks" and "what it hits".
const EQUIP_PROMPT = {
  barbell:    'a black olympic barbell loaded with black weight plates with green rims',
  dumbbell:   'black dumbbells with green plate rims',
  machine:    'the correct black gym machine for this movement, with green accent pads and handles',
  cable:      'a black cable pulley station with a green-accented handle attachment',
  bodyweight: 'no equipment beyond what the movement itself needs (bar, dip bars, or floor)',
  smith:      'a black smith machine with green accents',
  cardio:     'the correct black cardio machine with green accents',
}

const MUSCLE_EN = {
  Chest: 'chest (pectorals)', Back: 'back (lats and rhomboids)',
  Shoulders: 'shoulders (deltoids)', Legs: 'legs (quadriceps, hamstrings and glutes)',
  Biceps: 'biceps', Triceps: 'triceps', Core: 'core (abdominals)',
  Cardio: 'full body',
}

const EXERCISE_STYLE = [
  // the mannequin IS the app's identity — everything else is negotiable
  'a glossy matte-black 3D mannequin figure with sculpted anatomical muscles, featureless dark face, the exact same figure as a premium fitness app muscle chart',
  'photorealistic 3D render, studio product lighting, subtle reflections on the black surface',
  'three-quarter camera angle, whole body and equipment fully in frame',
  'correct exercise form, anatomically accurate joint angles at the working part of the movement',
  'no text, no letters, no numbers, no logos, no interface elements',
  'plain solid white background, no floor shadow, no scenery',
  'wide 3:2 landscape composition with breathing room around the subject',
].join(', ')

function exercisePrompt(slot) {
  return [
    `the black 3D mannequin from the reference image performing ${slot.exercise}`,
    EQUIP_PROMPT[slot.equip] || EQUIP_PROMPT.machine,
    `the ${MUSCLE_EN[slot.muscle] || 'working'} muscles on the mannequin's body glow bright green #5EC32A, every other muscle stays glossy black`,
    EXERCISE_STYLE,
  ].join(', ')
}

// The animation grows out of the still: same frame, one clean
// instructional rep looping. The camera line is load-bearing — video
// models drift into cinematic orbits unless told not to, and a swaying
// camera teaches nothing.
export function animPromptFor(slot) {
  return [
    `the black 3D mannequin performs one slow, controlled repetition of ${slot.exercise} and returns exactly to the starting position`,
    'a single clean instructional movement, correct exercise form, constant tempo',
    'the camera is completely static, locked off, no zoom, no pan, no orbit',
    'the green-lit muscles stay lit, the lighting does not change',
    'seamless loop: the final frame matches the first frame',
  ].join(', ')
}

export function promptFor(slot) {
  if (slot.kind === 'exercise') return exercisePrompt(slot)
  if (slot.kind === 'exanim') return exercisePrompt(slot)   // the i2v call pairs this with animPromptFor
  if (slot.kind === 'cover') {
    return `${slot.en}, ${COVER_STYLE}`
  }
  if (slot.kind === 'achievement') {
    const r = RARITY[slot.rarity] || RARITY.common
    const motif = CATEGORY[slot.cat] || 'a training motif'
    const id = slot.id.replace(/^ach_/, '')
    const subject = SUBJECT[id] || motif
    return [
      `an ornate circular achievement badge, ${r.material}`,
      `at its centre ${subject}`,
      `${motif}`,
      `accent colour ${r.accent}`,
      `${slot.rarity} tier, heraldic and collectible`,
      STYLE,
    ].join(', ')
  }
  if (slot.kind === 'scene') return `${slot.en}, accent colour #F59E0B, ${SCENE_STYLE}`
  // The deload pieces share the badge geometry but invert its mood:
  // no glow to speak of, no celebration, no warmth. The one thing they
  // must not become is a picture of being unwell.
  if (slot.kind === 'deload') {
    return [
      slot.en,
      slot.thaw
        // The closing screen is the thaw, and it is drawn on a screen
        // that has already gone back to green. Ice giving way to warmth
        // is the whole subject, so the cold-only rule is lifted here.
        ? 'pale ice blue #5CC9EE giving way to warm green #5EC32A, the moment the cold lets go'
        : `${DELOADS_STYLE_NOTE}, cool desaturated palette, pale ice blues and cold greys only, no warm colours`,
      'still and quiet, no motion lines, no radiance, no sparkle',
      'not sad, not sickly, not broken — resting between efforts',
      STYLE,
    ].join(', ')
  }
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
  const n = { achievement: 0, scene: 0, empty: 0, cover: 0 }
  for (const s of slots) n[s.kind]++
  console.log(`# مران — ${slots.length} صورة`)
  console.log(`#   ${n.achievement} جائزة · ${n.scene} احتفال · ${n.empty} حالة فارغة · ${n.cover} غلاف شهر\n`)
  console.log('احفظ كل صورة باسم معرّفها في assets-src/<id>.png ثم:\n')
  console.log('  node scripts/build-manifest.mjs --base https://<your-domain>/')
  console.log('  node scripts/upload-r2.mjs\n')
  for (const s of slots) {
    const tag = s.title || s.month || ''
    console.log(`── ${s.id}.png   ${s.w}×${s.h}${tag ? `   (${tag})` : ''}`)
    console.log(promptFor(s))
    console.log()
  }
}
