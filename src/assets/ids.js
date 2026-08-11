// ── The asset vocabulary ──────────────────────────────────────
// One id per icon the app can draw. This list is the contract
// between three things that must never drift apart:
//
//   • the JSX  — <Ico id="flame" emoji="🔥" />
//   • the pack — manifest entries are keyed by these ids
//   • the generator — scripts/ reads `en` to write the prompts
//
// `emoji` is the character this id replaces. It stays in the source
// as a lookup key and a last-resort fallback; once the pack is
// installed it is never rendered. Ids are defined generously on
// purpose: a manifest can add art for an id the app already draws,
// but it cannot invent a new place to draw one.

export const ASSETS = {
  // ── Strength & body ─────────────────────────────────────────
  flex:            { emoji: '💪', en: 'flexed bicep arm' },
  arm_mech:        { emoji: '🦾', en: 'powerful mechanical arm, deltoid' },
  leg:             { emoji: '🦵', en: 'muscular leg, quadriceps' },
  lungs:           { emoji: '🫁', en: 'chest, pectoral muscles' },
  files:           { emoji: '🗂️', en: 'back muscles, lat spread' },
  trident:         { emoji: '🔱', en: 'trident, tricep horseshoe' },
  core:            { emoji: '🎯', en: 'concentric target rings' },
  heart:           { emoji: '❤️', en: 'anatomical heart, cardio' },
  heart_green:     { emoji: '💚', en: 'green heart, health' },
  heart_purple:    { emoji: '💜', en: 'violet heart' },
  gorilla:         { emoji: '🦍', en: 'gorilla, raw power' },
  lion:            { emoji: '🦁', en: 'lion head, courage' },
  dna:             { emoji: '🧬', en: 'dna double helix' },
  brain:           { emoji: '🧠', en: 'brain, mental discipline' },
  fist:            { emoji: '👊', en: 'clenched fist forward' },
  fist_right:      { emoji: '🤜', en: 'forearm and fist from the side' },
  gymnast:         { emoji: '🤸', en: 'bodyweight athlete mid-move' },
  scarf:           { emoji: '🧣', en: 'neck measurement' },
  ruler:           { emoji: '📏', en: 'measuring tape' },
  peach:           { emoji: '🍑', en: 'hip measurement' },
  foot:            { emoji: '🦶', en: 'calf and foot' },

  // ── Equipment & gym ─────────────────────────────────────────
  lifter:          { emoji: '🏋️', en: 'athlete lifting a barbell overhead' },
  chain:           { emoji: '🔗', en: 'cable machine link' },
  robot:           { emoji: '🤖', en: 'gym machine, mechanical' },
  gear:            { emoji: '⚙️', en: 'smith machine gear' },
  circle_yellow:   { emoji: '🟡', en: 'resistance band loop' },
  bell:            { emoji: '🔔', en: 'kettlebell' },
  house:           { emoji: '🏠', en: 'home gym' },
  tree:            { emoji: '🌳', en: 'outdoor training' },
  arena:           { emoji: '🏟️', en: 'arena, stadium' },
  crane:           { emoji: '🏗️', en: 'construction crane, building mass' },
  tent:            { emoji: '🎪', en: 'big top tent' },
  wrench:          { emoji: '🔧', en: 'wrench, exercise settings' },

  // ── Progress & rank ─────────────────────────────────────────
  flame:           { emoji: '🔥', en: 'blazing flame, streak' },
  trophy:          { emoji: '🏆', en: 'victory trophy cup' },
  crown:           { emoji: '👑', en: 'ornate crown, mastery' },
  star:            { emoji: '⭐', en: 'five-point star, xp' },
  star_glow:       { emoji: '🌟', en: 'glowing star with sparkles' },
  medal_gold:      { emoji: '🥇', en: 'first place medal' },
  medal_silver:    { emoji: '🥈', en: 'second place medal' },
  gem:             { emoji: '💎', en: 'cut gemstone' },
  hundred:         { emoji: '💯', en: 'perfect hundred mark' },
  chart_up:        { emoji: '📈', en: 'rising line chart' },
  bar_chart:       { emoji: '📊', en: 'ascending bar chart' },
  box:             { emoji: '📦', en: 'shipping crate, tonnage' },
  sprout:          { emoji: '🌱', en: 'young sprout, beginner' },
  mountain:        { emoji: '🏔️', en: 'snow-capped peak' },
  volcano:         { emoji: '🌋', en: 'erupting volcano' },
  planet:          { emoji: '🪐', en: 'ringed planet' },
  wave:            { emoji: '🌊', en: 'cresting wave' },
  burst:           { emoji: '💥', en: 'impact burst' },
  bomb:            { emoji: '💣', en: 'lit bomb' },
  flag_white:      { emoji: '🏳️', en: 'plain flag on a pole' },

  // ── Combat & goals ──────────────────────────────────────────
  swords:          { emoji: '⚔️', en: 'crossed swords' },
  shield:          { emoji: '🛡️', en: 'heraldic shield' },
  ogre:            { emoji: '👹', en: 'menacing boss mask' },
  eye:             { emoji: '👁️', en: 'single watching eye' },
  bolt:            { emoji: '⚡', en: 'lightning bolt' },
  runner:          { emoji: '🏃', en: 'sprinting runner' },
  scale:           { emoji: '⚖️', en: 'balance scales' },

  // ── Time & schedule ─────────────────────────────────────────
  stopwatch:       { emoji: '⏱️', en: 'stopwatch' },
  clock:           { emoji: '🕐', en: 'analog clock face' },
  clock3:          { emoji: '🕒', en: 'clock showing three' },
  alarm:           { emoji: '⏰', en: 'ringing alarm clock' },
  hourglass:       { emoji: '⏳', en: 'running hourglass' },
  calendar:        { emoji: '📅', en: 'calendar page' },
  calendar_days:   { emoji: '📆', en: 'tear-off calendar' },
  calendar_spiral: { emoji: '🗓️', en: 'spiral-bound calendar' },
  moon:            { emoji: '🌙', en: 'crescent moon, rest' },
  sleep:           { emoji: '😴', en: 'sleeping face, recovery' },
  sunrise:         { emoji: '🌅', en: 'sunrise over the horizon' },
  sunrise_mountain:{ emoji: '🌄', en: 'sunrise behind mountains' },

  // ── Nutrition ───────────────────────────────────────────────
  droplet:         { emoji: '💧', en: 'water droplet' },
  cup:             { emoji: '🥤', en: 'drink cup with straw' },
  alembic:         { emoji: '⚗️', en: 'alembic flask' },
  steak:           { emoji: '🥩', en: 'cut of steak, protein' },

  // ── Interface & actions ─────────────────────────────────────
  check:           { emoji: '✅', en: 'confirmation check mark' },
  warn:            { emoji: '⚠️', en: 'warning triangle' },
  info:            { emoji: 'ℹ', en: 'information mark' },
  play:            { emoji: '▶️', en: 'play triangle' },
  pause:           { emoji: '⏸', en: 'pause bars' },
  skip:            { emoji: '⏭️', en: 'skip forward' },
  refresh:         { emoji: '🔄', en: 'circular refresh arrows' },
  save:            { emoji: '💾', en: 'save disk' },
  trash:           { emoji: '🗑️', en: 'waste bin' },
  pencil:          { emoji: '✏️', en: 'pencil, edit' },
  plus:            { emoji: '➕', en: 'plus sign' },
  clipboard:       { emoji: '📋', en: 'clipboard with a list' },
  folder:          { emoji: '📂', en: 'open folder' },
  inbox:           { emoji: '📥', en: 'inbox tray, import' },
  map:             { emoji: '🗺️', en: 'folded map' },
  ticket:          { emoji: '🎟️', en: 'admission ticket, rest credit' },
  lock:            { emoji: '🔒', en: 'closed padlock' },
  party:           { emoji: '🎉', en: 'party popper' },
  rocket:          { emoji: '🚀', en: 'launching rocket' },
  bulb:            { emoji: '💡', en: 'light bulb, tip' },
  microscope:      { emoji: '🔬', en: 'microscope, science' },
  brightness:      { emoji: '🔆', en: 'brightness sun' },
  palette:         { emoji: '🎨', en: 'artist palette' },
  camera:          { emoji: '📷', en: 'camera body' },
  camera_flash:    { emoji: '📸', en: 'camera with flash' },
  chat:            { emoji: '💬', en: 'speech bubble' },
  person:          { emoji: '👤', en: 'person silhouette' },
  people:          { emoji: '👥', en: 'two person silhouettes' },
  books:           { emoji: '📚', en: 'stack of books, library' },
  book_open:       { emoji: '📖', en: 'open book' },
  pray:            { emoji: '🙏', en: 'hands together, gratitude' },
  arrow_up:        { emoji: '⬆️', en: 'upward arrow, add weight' },
  arrow_down:      { emoji: '⬇️', en: 'downward arrow, drop weight' },
  swap:            { emoji: '⇄', en: 'two-way swap arrows' },
}

/** id → emoji, for the fallback prop. */
export const emojiFor = (id) => ASSETS[id]?.emoji || ''

/** emoji → id, built once. Used only where an id isn't known statically. */
export const ID_BY_EMOJI = (() => {
  const m = new Map()
  for (const [id, meta] of Object.entries(ASSETS)) {
    const key = meta.emoji.replace(/[\uFE0E\uFE0F]/g, '')
    if (key && !m.has(key)) m.set(key, id)
  }
  return m
})()

export const ALL_IDS = Object.keys(ASSETS)

// Ids whose art is also used by OS notifications. Those are fetched
// by the platform, not the page, so the publisher emits a PNG next
// to the WebP for these — Android's notification decoder is
// unreliable with WebP.
export const NOTIFICATION_IDS = [
  'sunrise', 'bulb', 'droplet', 'swords', 'moon', 'stopwatch',
]
