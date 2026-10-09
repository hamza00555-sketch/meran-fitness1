// ── What the pack contains ────────────────────────────────────
// Only the large artwork. Small interface glyphs — the gear, the
// bin, the pencil, the arrows — stay exactly as they are; turning
// those into downloaded rasters costs bandwidth and buys nothing.
//
// Seven families, 182 slots:
//   ach_<id>   one image per achievement, 40 of them
//   scene_*    the two full-screen celebration moments
//   empty_*    the large illustration on an empty page
//   cover_MM   the monthly report's cover, one per calendar month
//   deload_*   the three pictures the deload mode uses
//   ex_*       one still per catalogue exercise (97)
//   exa_*      a 5s loop animation for the trained ones (22)
//
// Achievement ids come straight from ACHIEVEMENTS, so adding an
// achievement automatically adds its slot — no second list to keep
// in sync.
//
// Every slot states its own width and height. The badges are square
// and keyed out of a white field; the covers are wide, full-bleed
// scenes that must not be squeezed into a square.

import { ACHIEVEMENTS, MUSCLE_GROUPS } from '../constants.js'
import { EXERCISE_MEDIA, ANIMATED_EXERCISES } from '../exerciseMedia.js'

export const achSlot = (achievementId) => `ach_${achievementId}`

const SQUARE = { w: 512, h: 512 }

export const SCENES = {
  scene_levelup: {
    ...SQUARE,
    en: 'a radiant crown marking a level-up, celebratory and triumphant',
  },
  scene_pr:      {
    ...SQUARE,
    en: 'a victory trophy bursting with light, marking a new personal record',
  },
}

export const EMPTIES = {
  empty_history:   { ...SQUARE, en: 'an empty training logbook waiting for its first entry' },
  empty_workout:   { ...SQUARE, en: 'a barbell resting on the gym floor before the session starts' },
  empty_progress:  { ...SQUARE, en: 'a blank progress chart with no bars yet, quiet and waiting' },
  empty_equipment: { ...SQUARE, en: 'gym equipment stacked and unused' },
  empty_challenge: { ...SQUARE, en: 'an untouched archery target, no arrows yet' },
  empty_photos:    { ...SQUARE, en: 'an empty photo frame awaiting a progress picture' },
}

// ── Monthly report covers ─────────────────────────────────────
// A banner, not a wallpaper: it heads the report on screen and the
// shared poster, with the text sitting below it rather than on top, so
// it stays legible and the pack stays small. Anything taller is bytes
// nobody sees.
//
// 1024×688 is the generator's own 3:2 output. Matching it exactly means
// the published piece is never resampled, and the poster's 1080 width
// is a 5% upscale nobody can see.
//
// Each month gets its own season and hour so a year of reports does not
// look like the same picture twelve times.
const COVER = { w: 1024, h: 688 }

export const COVERS = {
  cover_01: { ...COVER, month: 'يناير',  en: 'a cold winter dawn, breath fogging in freezing air, iron plates rimed with frost' },
  cover_02: { ...COVER, month: 'فبراير', en: 'late winter rain on a window, a lamp-lit gym floor at night' },
  cover_03: { ...COVER, month: 'مارس',  en: 'first spring light breaking through high windows, dust in the sunbeams' },
  cover_04: { ...COVER, month: 'أبريل', en: 'a bright clear spring morning, open shutters, fresh air and long shadows' },
  cover_05: { ...COVER, month: 'مايو',   en: 'warm late afternoon sun low across the floor, golden and calm' },
  cover_06: { ...COVER, month: 'يونيو', en: 'the first heat of summer, shimmering air, a fan turning slowly' },
  cover_07: { ...COVER, month: 'يوليو', en: 'blazing midsummer noon, hard white light and sharp black shadow' },
  cover_08: { ...COVER, month: 'أغسطس', en: 'a heavy humid dusk, orange horizon through open doors' },
  cover_09: { ...COVER, month: 'سبتمبر', en: 'early autumn, cooler light, the first leaves drifting past a doorway' },
  cover_10: { ...COVER, month: 'أكتوبر', en: 'deep autumn amber light, long low sun, warm and settled' },
  cover_11: { ...COVER, month: 'نوفمبر', en: 'a grey overcast afternoon, quiet and stark, cold blue light' },
  cover_12: { ...COVER, month: 'ديسمبر', en: 'a long winter night, warm interior light against darkness outside' },
}

// ── Deload ────────────────────────────────────────────────────
// The three places the deload mode wants its own picture. They share
// the badge geometry so they key out on the same pass, but their brief
// is the opposite of the achievements': nothing radiant, nothing
// celebratory. Cold, still, and unmistakably mid-training rather than
// mid-illness — a glacier, not a sickbed.
const DELOADS_STYLE_NOTE = 'glacier blue #5CC9EE, calm and cold, active recovery not illness'

export const DELOADS = {
  deload_hero: {
    ...SQUARE,
    en: 'a chunky frost-covered dumbbell resting on a slab of blue glacier ice, seen from a three-quarter angle, the subject large and filling the square frame edge to edge',
  },
  // The odd one out: this renders after the mode is already off, on a
  // green screen, and its job is the thaw rather than the freeze. It
  // opts out of the cold-only palette on purpose.
  deload_end: {
    ...SQUARE,
    thaw: true,
    en: 'the last of the frost breaking off a barbell as warm light returns to the steel, ready to be lifted heavy again',
  },
  deload_badge: {
    ...SQUARE,
    en: 'a single clear droplet of meltwater, simple and iconic, readable at a very small size',
  },
}

export { DELOADS_STYLE_NOTE }

// ── Exercise media ────────────────────────────────────────────
// Stills for every exercise the catalogue knows, animations for the
// ones actually trained. Both derive from the explicit media map, so
// adding an exercise there is what creates its slots — no second list.
//
// The muscle group rides along because the artwork lights the target
// muscle green on the figure; the prompt needs its English name.
const EX_STILL = { w: 1024, h: 688 }          // generator-native 3:2, like the covers

const groupOfExercise = (() => {
  const m = new Map()
  for (const [key, g] of Object.entries(MUSCLE_GROUPS)) {
    for (const e of g.exercises || []) m.set(e.name, key)
  }
  return m
})()

export const EXERCISE_STILLS = {}
export const EXERCISE_ANIMS = {}
for (const [name, row] of Object.entries(EXERCISE_MEDIA)) {
  EXERCISE_STILLS[`ex_${row.slug}`] = {
    ...EX_STILL,
    exercise: name,
    equip: row.equip,
    muscle: groupOfExercise.get(name) || 'Chest',
  }
}
for (const name of ANIMATED_EXERCISES) {
  const row = EXERCISE_MEDIA[name]
  EXERCISE_ANIMS[`exa_${row.slug}`] = {
    ...EX_STILL,
    video: true,
    exercise: name,
    equip: row.equip,
    muscle: groupOfExercise.get(name) || 'Chest',
    still: `ex_${row.slug}`,             // the frame the animation grows from
  }
}

/** Every slot the app can draw, with the copy the generator turns into a prompt. */
export function allSlots() {
  const out = []
  for (const a of ACHIEVEMENTS) {
    out.push({
      id: achSlot(a.id),
      kind: 'achievement',
      ...SQUARE,
      title: a.title,
      desc: a.desc,
      cat: a.cat,
      rarity: a.rarity,
    })
  }
  for (const [id, s] of Object.entries(SCENES)) out.push({ id, kind: 'scene', ...s })
  for (const [id, s] of Object.entries(EMPTIES)) out.push({ id, kind: 'empty', ...s })
  for (const [id, s] of Object.entries(COVERS)) out.push({ id, kind: 'cover', ...s })
  for (const [id, s] of Object.entries(DELOADS)) out.push({ id, kind: 'deload', ...s })
  for (const [id, s] of Object.entries(EXERCISE_STILLS)) out.push({ id, kind: 'exercise', ...s })
  for (const [id, s] of Object.entries(EXERCISE_ANIMS)) out.push({ id, kind: 'exanim', ...s })
  return out
}

export const ALL_SLOT_IDS = allSlots().map(s => s.id)
