// ── What the pack contains ────────────────────────────────────
// Only the large artwork. Small interface glyphs — the gear, the
// bin, the pencil, the arrows — stay exactly as they are; turning
// those into downloaded rasters costs bandwidth and buys nothing.
//
// Three families, 48 slots:
//   ach_<id>   one image per achievement, 40 of them
//   scene_*    the two full-screen celebration moments
//   empty_*    the large illustration on an empty page
//
// Achievement ids come straight from ACHIEVEMENTS, so adding an
// achievement automatically adds its slot — no second list to keep
// in sync.

import { ACHIEVEMENTS } from '../constants.js'

export const achSlot = (achievementId) => `ach_${achievementId}`

export const SCENES = {
  scene_levelup: {
    size: 512,
    en: 'a radiant crown marking a level-up, celebratory and triumphant',
  },
  scene_pr:      {
    size: 512,
    en: 'a victory trophy bursting with light, marking a new personal record',
  },
}

export const EMPTIES = {
  empty_history:   { size: 512, en: 'an empty training logbook waiting for its first entry' },
  empty_workout:   { size: 512, en: 'a barbell resting on the gym floor before the session starts' },
  empty_progress:  { size: 512, en: 'a blank progress chart with no bars yet, quiet and waiting' },
  empty_equipment: { size: 512, en: 'gym equipment stacked and unused' },
  empty_challenge: { size: 512, en: 'an untouched archery target, no arrows yet' },
  empty_photos:    { size: 512, en: 'an empty photo frame awaiting a progress picture' },
}

/** Every slot the app can draw, with the copy the generator turns into a prompt. */
export function allSlots() {
  const out = []
  for (const a of ACHIEVEMENTS) {
    out.push({
      id: achSlot(a.id),
      kind: 'achievement',
      size: 512,
      title: a.title,
      desc: a.desc,
      cat: a.cat,
      rarity: a.rarity,
    })
  }
  for (const [id, s] of Object.entries(SCENES)) out.push({ id, kind: 'scene', ...s })
  for (const [id, s] of Object.entries(EMPTIES)) out.push({ id, kind: 'empty', ...s })
  return out
}

export const ALL_SLOT_IDS = allSlots().map(s => s.id)
