// ── Exercise media map ────────────────────────────────────────
// One explicit row per exercise the catalogue knows: a readable slot
// slug, an Arabic display name, and what the movement is performed
// with. Explicit rather than derived — a slug generator would be
// shorter, but the first renamed exercise would silently orphan its
// artwork, and nobody would notice until the picture vanished.
//
// `equip` drives two things at once: the equipment chip on the
// exercise card, and the prompt line that puts the right machine in
// the generated artwork. One source, so the picture can never
// contradict the tag.
//
// A test walks MUSCLE_GROUPS and fails if any exercise is missing a
// row here, so adding an exercise without media support is loud.

import { resolveExerciseName } from './utils.js'

export const EQUIP_LABELS = {
  barbell:    'بار',
  dumbbell:   'دمبل',
  machine:    'جهاز',
  cable:      'كيبل',
  bodyweight: 'وزن الجسم',
  smith:      'سميث',
  cardio:     'كارديو',
}

// name → { slug (slot id suffix), ar, equip }
export const EXERCISE_MEDIA = {
  // ── Chest ──
  'Bench Press':                         { slug: 'bench_press',            ar: 'ضغط بنش بالبار',        equip: 'barbell' },
  'Incline Bench Press':                 { slug: 'incline_bench_press',    ar: 'ضغط بنش مائل بالبار',   equip: 'barbell' },
  'Decline Bench Press':                 { slug: 'decline_bench_press',    ar: 'ضغط بنش منحدر',         equip: 'barbell' },
  'Cable Fly':                           { slug: 'cable_fly',              ar: 'تفتيح كيبل',            equip: 'cable' },
  'Dumbbell Fly':                        { slug: 'dumbbell_fly',           ar: 'تفتيح دمبل',            equip: 'dumbbell' },
  'Push-Up':                             { slug: 'push_up',                ar: 'ضغط أرضي',              equip: 'bodyweight' },
  'Chest Dip':                           { slug: 'chest_dip',              ar: 'متوازي للصدر',          equip: 'bodyweight' },
  'Pec Deck':                            { slug: 'pec_deck',               ar: 'تفتيح جهاز (بك دك)',    equip: 'machine' },
  'Landmine Press':                      { slug: 'landmine_press',         ar: 'ضغط لاندماين',          equip: 'barbell' },
  'Hammer Strength Machine Bench Press': { slug: 'hammer_bench_press',     ar: 'ضغط صدر جهاز هامر',     equip: 'machine' },
  'Machine Incline Press':               { slug: 'machine_incline_press',  ar: 'ضغط مائل جهاز',         equip: 'machine' },
  'Incline Dumbbell Press':              { slug: 'incline_db_press',       ar: 'ضغط مائل دمبل',         equip: 'dumbbell' },

  // ── Back ──
  'Deadlift':                            { slug: 'deadlift',               ar: 'ديدلفت',                equip: 'barbell' },
  'Pull-Up':                             { slug: 'pull_up',                ar: 'عقلة',                  equip: 'bodyweight' },
  'Barbell Row':                         { slug: 'barbell_row',            ar: 'تجديف بار',             equip: 'barbell' },
  'Seated Cable Row':                    { slug: 'seated_cable_row',       ar: 'تجديف كيبل جالس',       equip: 'cable' },
  'Lat Pulldown':                        { slug: 'lat_pulldown',           ar: 'سحب أمامي',             equip: 'machine' },
  'T-Bar Row':                           { slug: 't_bar_row',              ar: 'تجديف تي-بار',          equip: 'barbell' },
  'Face Pull':                           { slug: 'face_pull',              ar: 'سحب للوجه',             equip: 'cable' },
  'Single Arm Row':                      { slug: 'single_arm_row',         ar: 'تجديف بذراع واحدة',     equip: 'dumbbell' },
  'Chest-Supported Row':                 { slug: 'chest_supported_row',    ar: 'تجديف بسند الصدر',      equip: 'machine' },
  'Dumbbell Row':                        { slug: 'dumbbell_row',           ar: 'تجديف دمبل',            equip: 'dumbbell' },
  'Dumbbell Farmers Carry':              { slug: 'farmers_carry',          ar: 'حمل المزارع',           equip: 'dumbbell' },
  'Straight Arm Pulldown':               { slug: 'straight_arm_pulldown',  ar: 'سحب بذراع مستقيمة',     equip: 'cable' },
  'Dumbbell Shrug':                      { slug: 'dumbbell_shrug',         ar: 'هز أكتاف دمبل',         equip: 'dumbbell' },
  'Machine Pullover':                    { slug: 'machine_pullover',       ar: 'بلأوفر جهاز',           equip: 'machine' },

  // ── Shoulders ──
  'Overhead Press':                      { slug: 'overhead_press',         ar: 'ضغط عسكري بالبار',      equip: 'barbell' },
  'Dumbbell OHP':                        { slug: 'dumbbell_ohp',           ar: 'ضغط عسكري دمبل',        equip: 'dumbbell' },
  'Lateral Raise':                       { slug: 'lateral_raise',          ar: 'رفرفة جانبية',          equip: 'dumbbell' },
  'Front Raise':                         { slug: 'front_raise',            ar: 'رفرفة أمامية',          equip: 'dumbbell' },
  'Rear Delt Fly':                       { slug: 'rear_delt_fly',          ar: 'رفرفة خلفية',           equip: 'dumbbell' },
  'Arnold Press':                        { slug: 'arnold_press',           ar: 'ضغط أرنولد',            equip: 'dumbbell' },
  'Upright Row':                         { slug: 'upright_row',            ar: 'تجديف عمودي',           equip: 'barbell' },
  'Cable Lateral Raise':                 { slug: 'cable_lateral_raise',    ar: 'رفرفة جانبية كيبل',     equip: 'cable' },
  'Machine Shoulder Press':              { slug: 'machine_shoulder_press', ar: 'ضغط أكتاف جهاز',        equip: 'machine' },
  'Machine Lateral Raise':               { slug: 'machine_lateral_raise',  ar: 'رفرفة جانبية جهاز',     equip: 'machine' },
  'Dumbbell Shoulder Press':             { slug: 'db_shoulder_press',      ar: 'ضغط أكتاف دمبل',        equip: 'dumbbell' },
  'Machine Reverse Fly':                 { slug: 'machine_reverse_fly',    ar: 'رفرفة عكسية جهاز',      equip: 'machine' },
  'Reverse Fly':                         { slug: 'reverse_fly',            ar: 'رفرفة عكسية',           equip: 'dumbbell' },

  // ── Legs ──
  'Barbell Squat':                       { slug: 'barbell_squat',          ar: 'سكوات بالبار',          equip: 'barbell' },
  'Leg Press':                           { slug: 'leg_press',              ar: 'دفع أرجل جهاز',         equip: 'machine' },
  'Romanian Deadlift':                   { slug: 'romanian_deadlift',      ar: 'ديدلفت روماني',         equip: 'barbell' },
  'Leg Extension':                       { slug: 'leg_extension',          ar: 'مد أرجل جهاز',          equip: 'machine' },
  'Leg Curl':                            { slug: 'leg_curl',               ar: 'مرجحة خلفية جهاز',      equip: 'machine' },
  'Lunge':                               { slug: 'lunge',                  ar: 'طعنات',                 equip: 'bodyweight' },
  'Hip Thrust':                          { slug: 'hip_thrust',             ar: 'رفع حوض',               equip: 'barbell' },
  'Standing Calf Raise':                 { slug: 'standing_calf_raise',    ar: 'سمانة وقوف',            equip: 'machine' },
  'Hack Squat':                          { slug: 'hack_squat',             ar: 'هاك سكوات',             equip: 'machine' },
  'Bulgarian Split Squat':               { slug: 'bulgarian_split_squat',  ar: 'سكوات بلغاري',          equip: 'dumbbell' },
  'Dumbbell Romanian Deadlift':          { slug: 'db_romanian_deadlift',   ar: 'ديدلفت روماني دمبل',    equip: 'dumbbell' },
  'Dumbbell Lunge':                      { slug: 'dumbbell_lunge',         ar: 'طعنات دمبل',            equip: 'dumbbell' },
  'Seated Leg Curl':                     { slug: 'seated_leg_curl',        ar: 'مرجحة خلفية جالس',      equip: 'machine' },
  'Smith Machine Calf Raise':            { slug: 'smith_calf_raise',       ar: 'سمانة سميث',            equip: 'smith' },
  'Machine Hip Abduction':               { slug: 'hip_abduction',          ar: 'فتح ورك جهاز',          equip: 'machine' },
  'Lying Leg Curl':                      { slug: 'lying_leg_curl',         ar: 'مرجحة خلفية نائم',      equip: 'machine' },
  'Dumbbell Calf Raise':                 { slug: 'dumbbell_calf_raise',    ar: 'سمانة دمبل',            equip: 'dumbbell' },
  'Machine Hip Adduction':               { slug: 'hip_adduction',          ar: 'ضم ورك جهاز',           equip: 'machine' },
  'Machine Glute Kickbacks':             { slug: 'glute_kickback',         ar: 'ركلة خلفية جهاز',       equip: 'machine' },

  // ── Biceps ──
  'Barbell Curl':                        { slug: 'barbell_curl',           ar: 'مرجحة بار',             equip: 'barbell' },
  'Dumbbell Curl':                       { slug: 'dumbbell_curl',          ar: 'مرجحة دمبل',            equip: 'dumbbell' },
  'Hammer Curl':                         { slug: 'hammer_curl',            ar: 'مرجحة هامر',            equip: 'dumbbell' },
  'Preacher Curl':                       { slug: 'preacher_curl',          ar: 'مرجحة بريتشر',          equip: 'barbell' },
  'Cable Curl':                          { slug: 'cable_curl',             ar: 'مرجحة كيبل',            equip: 'cable' },
  'Incline Dumbbell Curl':               { slug: 'incline_db_curl',        ar: 'مرجحة مائلة دمبل',      equip: 'dumbbell' },
  'Concentration Curl':                  { slug: 'concentration_curl',     ar: 'مرجحة تركيز',           equip: 'dumbbell' },
  'Spider Curl':                         { slug: 'spider_curl',            ar: 'مرجحة سبايدر',          equip: 'dumbbell' },
  'Barbell Reverse Curl':                { slug: 'barbell_reverse_curl',   ar: 'مرجحة عكسية بار',       equip: 'barbell' },
  'Dumbbell Concentration Curl':         { slug: 'db_concentration_curl',  ar: 'مرجحة تركيز دمبل',      equip: 'dumbbell' },
  'Machine Preacher Curl':               { slug: 'machine_preacher_curl',  ar: 'مرجحة بريتشر جهاز',     equip: 'machine' },
  'Cable Hammer Curls':                  { slug: 'cable_hammer_curl',      ar: 'مرجحة هامر كيبل',       equip: 'cable' },

  // ── Triceps ──
  'Triceps Pushdown':                    { slug: 'triceps_pushdown',       ar: 'دفع ترايسبس كيبل',      equip: 'cable' },
  'Skull Crusher':                       { slug: 'skull_crusher',          ar: 'سكل كراشر',             equip: 'barbell' },
  'Overhead Triceps':                    { slug: 'overhead_triceps',       ar: 'ترايسبس خلف الرأس',     equip: 'dumbbell' },
  'Diamond Push-Up':                     { slug: 'diamond_push_up',        ar: 'ضغط ماسي',              equip: 'bodyweight' },
  'Triceps Dip':                         { slug: 'triceps_dip',            ar: 'متوازي ترايسبس',        equip: 'bodyweight' },
  'Close-Grip Bench':                    { slug: 'close_grip_bench',       ar: 'بنش قبضة ضيقة',         equip: 'barbell' },
  'Cable Kickback':                      { slug: 'cable_kickback',         ar: 'ركلة ترايسبس كيبل',     equip: 'cable' },
  'Cable Overhead Triceps Extension':    { slug: 'cable_overhead_triceps', ar: 'ترايسبس علوي كيبل',     equip: 'cable' },
  'Cable Triceps Kickback':              { slug: 'cable_triceps_kickback', ar: 'ركلة خلفية كيبل',       equip: 'cable' },

  // ── Core ──
  'Plank':                               { slug: 'plank',                  ar: 'بلانك',                 equip: 'bodyweight' },
  'Crunches':                            { slug: 'crunches',               ar: 'كرانش',                 equip: 'bodyweight' },
  'Leg Raise':                           { slug: 'leg_raise',              ar: 'رفع أرجل',              equip: 'bodyweight' },
  'Russian Twist':                       { slug: 'russian_twist',          ar: 'لفة روسية',             equip: 'bodyweight' },
  'Ab Wheel':                            { slug: 'ab_wheel',               ar: 'عجلة بطن',              equip: 'bodyweight' },
  'Cable Crunch':                        { slug: 'cable_crunch',           ar: 'كرانش كيبل',            equip: 'cable' },
  'Hanging Knee Raise':                  { slug: 'hanging_knee_raise',     ar: 'رفع ركب معلّق',         equip: 'bodyweight' },
  'Hollow Body Hold':                    { slug: 'hollow_body_hold',       ar: 'ثبات القارب',           equip: 'bodyweight' },
  'Cable Core Rotation':                 { slug: 'cable_core_rotation',    ar: 'لف جذع كيبل',           equip: 'cable' },
  'Hanging Leg Raise':                   { slug: 'hanging_leg_raise',      ar: 'رفع أرجل معلّق',        equip: 'bodyweight' },
  'Dumbbell Side Bend':                  { slug: 'db_side_bend',           ar: 'انحناء جانبي دمبل',     equip: 'dumbbell' },

  // ── Cardio ──
  'Treadmill Run':                       { slug: 'treadmill_run',          ar: 'جري سير',               equip: 'cardio' },
  'Rowing Machine':                      { slug: 'rowing_machine',         ar: 'جهاز تجديف',            equip: 'cardio' },
  'Jump Rope':                           { slug: 'jump_rope',              ar: 'نط حبل',                equip: 'cardio' },
  'Stationary Bike':                     { slug: 'stationary_bike',        ar: 'دراجة ثابتة',           equip: 'cardio' },
  'Stair Climber':                       { slug: 'stair_climber',          ar: 'جهاز درج',              equip: 'cardio' },
  'Battle Ropes':                        { slug: 'battle_ropes',           ar: 'حبال قتالية',           equip: 'cardio' },
  'Sled Push':                           { slug: 'sled_push',              ar: 'دفع زلاجة',             equip: 'cardio' },
}

// The exercises whose media includes a loop animation. Hamza's own
// plan (the machines programme, 17 lifts) plus the five free-weight
// staples — 22, the approved budget. The system does not care about
// this list beyond slot generation: any exercise gains an animation
// later by appearing here and republishing the pack. No code changes.
export const ANIMATED_EXERCISES = [
  'Hammer Strength Machine Bench Press', 'Machine Incline Press', 'Pec Deck',
  'Machine Shoulder Press', 'Machine Lateral Raise', 'Triceps Pushdown',
  'Lat Pulldown', 'Seated Cable Row', 'Machine Pullover',
  'Machine Preacher Curl', 'Cable Hammer Curls', 'Hack Squat', 'Leg Press',
  'Leg Curl', 'Leg Extension', 'Machine Glute Kickbacks', 'Standing Calf Raise',
  'Bench Press', 'Barbell Squat', 'Deadlift', 'Pull-Up', 'Barbell Row',
]

/** The still-image slot for an exercise, or null for one we don't know. */
export function mediaSlotFor(name, mapping = {}) {
  const row = rowFor(name, mapping)
  return row ? `ex_${row.slug}` : null
}

/** The animation slot, or null when the exercise has no animation. */
export function animSlotFor(name, mapping = {}) {
  const row = rowFor(name, mapping)
  if (!row || !row.anim) return null
  return `exa_${row.slug}`
}

/** Arabic display name, or null when there is none to show. */
export function arabicName(name, mapping = {}) {
  return rowFor(name, mapping)?.ar ?? null
}

/** Equipment chip label (Arabic), or null. */
export function equipLabel(name, mapping = {}) {
  const row = rowFor(name, mapping)
  return row ? EQUIP_LABELS[row.equip] ?? null : null
}

// Lookup goes through the same resolution the stats engines use, so a
// user-mapped alias finds the canonical exercise's artwork. Case falls
// back to a lowercase scan because resolveExerciseName lowercases.
const lower = new Map(Object.entries(EXERCISE_MEDIA).map(([k, v]) => [k.toLowerCase(), v]))
const animSet = new Set(ANIMATED_EXERCISES)
for (const [k, v] of Object.entries(EXERCISE_MEDIA)) v.anim = animSet.has(k)

// ── The last resort: the same words in a different order ──────
//
// People type «Tricep Rope Pushdown» for what the catalogue calls
// «Triceps Pushdown», and alternative lists carry «Overhead Cable
// Triceps Extension» for «Cable Overhead Triceps Extension». Same
// movement, same picture, no row of its own — and the exercise fell
// all the way to a generic emoji.
//
// The key is the set of a name's words, so order never matters, with
// two narrow normalisations: a handful of spellings that are the same
// word (tricep/triceps, db/dumbbell), and «rope», which names the
// handle rather than the movement.
//
// Deliberately narrow. Equipment and position words all stay
// significant, because «Cable Chest Press» and «Chest Press Machine»
// really are different exercises and must never share a picture. A
// spec asserts no two rows in the map collide on this key, so the day
// a new exercise would be ambiguous, the suite says so rather than the
// app quietly showing the wrong machine.
const SAME_WORD = {
  tricep: 'triceps', bicep: 'biceps',
  dumbell: 'dumbbell', db: 'dumbbell', bb: 'barbell', barbel: 'barbell',
  curls: 'curl', raises: 'raise', presses: 'press', rows: 'row',
  extensions: 'extension', flyes: 'fly', flys: 'fly', dips: 'dip',
  squats: 'squat', lunges: 'lunge', pulldowns: 'pulldown',
}
const HANDLE_WORDS = new Set(['rope'])

export function wordSetKey(name) {
  const words = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => SAME_WORD[w] || w)
    .filter(w => !HANDLE_WORDS.has(w))
  return [...new Set(words)].sort().join(' ')
}

const byWordSet = new Map()
for (const [name, row] of Object.entries(EXERCISE_MEDIA)) {
  const k = wordSetKey(name)
  if (k) byWordSet.set(k, row)
}

function rowFor(name, mapping = {}) {
  if (!name) return null
  const direct = EXERCISE_MEDIA[name]
  if (direct) return direct
  const resolved = lower.get(resolveExerciseName(name, mapping))
  if (resolved) return resolved
  return byWordSet.get(wordSetKey(name)) ?? null
}
