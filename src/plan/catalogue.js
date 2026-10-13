// ── مران · the exercise catalogue, tagged for the plan builder ──────
//
// Split out of builder.js so the monthly report can count sets by the
// builder's own rules (direct = 1, indirect = ½; a range per area)
// without loading the whole engine into the main bundle.

import { EXERCISE_MEDIA, wordSetKey } from '../exerciseMedia.js'
import { MUSCLE_GROUPS } from '../constants.js'

// name → the app's muscle group (one of the eight MUSCLE_GROUPS keys)
const MUSCLE_OF = {}
for (const [g, v] of Object.entries(MUSCLE_GROUPS)) for (const e of v.exercises || []) MUSCLE_OF[e.name] = g
export const MUSCLES = Object.keys(MUSCLE_GROUPS)

const AREAS = {
  chest:  { lbl: 'الصدر',          row: 'صدر',          short: 'الصدر',     card: 'chest',     w: 3,   big: 1, pr: 'له'  },
  lats:   { lbl: 'السحب من فوق',   row: 'سحب من فوق',   short: 'سحب من فوق', card: 'back',      w: 3,   big: 1, pr: 'له'  },
  rows:   { lbl: 'السحب من قدّام', row: 'سحب من قدّام', short: 'السحب من قدّام', card: 'back',  w: 3,   big: 1, pr: 'له'  },
  front:  { lbl: 'قدّام الكتف',    row: 'قدّام الكتف',  short: 'القدّام',    card: 'shoulders', w: 0,   none: 1 },
  side:   { lbl: 'جنب الكتف',      row: 'جنب الكتف',    short: 'الجنب',     card: 'shoulders', w: 2,             pr: 'له'  },
  rear:   { lbl: 'ورا الكتف',      row: 'ورا الكتف',    short: 'الورا',     card: 'shoulders', w: 1.5,           pr: 'له'  },
  quads:  { lbl: 'الفخذ الأمامي',  row: 'فخذ أمامي',    short: 'الأمامي',   card: 'legs',      w: 3,   big: 1, pr: 'له'  },
  hams:   { lbl: 'الفخذ الخلفي',   row: 'فخذ خلفي',     short: 'الخلفي',    card: 'legs',      w: 3,   big: 1, pr: 'له'  },
  glutes: { lbl: 'الأرداف',        row: 'أرداف',        short: 'الأرداف',   card: 'legs',      w: 2,             pr: 'لها' },
  calves: { lbl: 'السمانة',        row: 'سمانة',        short: 'السمانة',   card: 'legs',      w: 1.5,           pr: 'لها' },
  biceps: { lbl: 'الذراع الأمامي', row: 'ذراع أمامي',   short: 'الأمامي',   card: 'biceps',    w: 1.5,           pr: 'له'  },
  triceps:{ lbl: 'الذراع الخلفي',  row: 'ذراع خلفي',    short: 'الخلفي',    card: 'triceps',   w: 1.5,           pr: 'له'  },
  core:   { lbl: 'البطن',          row: 'بطن',          short: 'البطن',     card: 'core',      w: 0.5,           pr: 'له'  },
  cardio: { lbl: 'الكارديو',       row: 'كارديو',       short: 'الكارديو',  card: 'cardio',    w: 0,             pr: 'له'  },
}
const AREA_ORDER = Object.keys(AREAS)

const CARDS = [
  { id: 'chest',     ar: 'صدر',       key: 'Chest',     img: 'm_chest',     areas: ['chest'],                          groups: ['chest'] },
  { id: 'back',      ar: 'ظهر',       key: 'Back',      img: 'm_back',      areas: ['lats', 'rows'],                   groups: ['lats', 'rows'] },
  { id: 'shoulders', ar: 'أكتاف',     key: 'Shoulders', img: 'm_shoulders', areas: ['side', 'rear'],                   groups: ['front', 'side', 'rear'] },
  { id: 'legs',      ar: 'أرجل',      key: 'Legs',      img: 'm_legs',      areas: ['quads', 'hams', 'glutes', 'calves'], groups: ['quads', 'hams', 'glutes', 'calves'] },
  { id: 'biceps',    ar: 'ذراع أمامي', sub: 'بايسبس',   key: 'Biceps',      img: 'm_biceps',    areas: ['biceps'],         groups: ['biceps'] },
  { id: 'triceps',   ar: 'ذراع خلفي', sub: 'ترايسبس',   key: 'Triceps',     img: 'm_triceps',   areas: ['triceps'],        groups: ['triceps'] },
  { id: 'core',      ar: 'بطن',       key: 'Core',      img: 'm_core',      areas: ['core'],                           groups: ['core'] },
  { id: 'cardio',    ar: 'كارديو',    key: 'Cardio',    img: 'm_cardio',    areas: ['cardio'],                         groups: ['cardio'] },
]
const CARD = Object.fromEntries(CARDS.map(c => [c.id, c]))

const GROUP = {
  chest:  { t: 'تمارين الصدر',   hint: 'ضغط وتفتيح' },
  lats:   { t: 'سحب من فوق',     hint: 'يعرّض الظهر' },
  rows:   { t: 'سحب من قدّام',   hint: 'يعطي الظهر سماكة' },
  front:  { t: 'قدّام الكتف',    hint: 'ضغط فوق الرأس · يشغّل الجنب شوي' },
  side:   { t: 'جنب الكتف',      hint: 'رفرفة · تعرّض الكتف' },
  rear:   { t: 'ورا الكتف',      hint: 'توازن الكتف' },
  quads:  { t: 'فخذ أمامي',      hint: 'قدّام الفخذ' },
  hams:   { t: 'فخذ خلفي',       hint: 'ورا الفخذ' },
  glutes: { t: 'أرداف',          hint: 'المؤخرة' },
  calves: { t: 'سمانة',          hint: 'تحت الركبة' },
  biceps: { t: 'الذراع الأمامي', hint: 'بايسبس' },
  triceps:{ t: 'الذراع الخلفي',  hint: 'ترايسبس' },
  core:   { t: 'البطن',          hint: 'بطن وجذع' },
  cardio: { t: 'كارديو',         hint: 'قلب ونَفَس' },
}

const EQ = {
  machine:  { ar: 'أجهزة',     one: 'جهاز',      app: 'machine' },
  cable:    { ar: 'كيبل',      one: 'كيبل',      app: 'cable' },
  dumbbell: { ar: 'دمبل',      one: 'دمبل',      app: 'dumbbell' },
  barbell:  { ar: 'بار',       one: 'بار',       app: 'barbell' },
  cardio:   { ar: 'كارديو',    one: 'جهاز كارديو', app: 'cardio' },
  body:     { ar: 'وزن الجسم', one: 'وزن الجسم', app: 'bodyweight' },
  other:    { ar: 'أداة ثانية', one: 'أداة ثانية', app: null },   // an exercise the catalogue does not know
}
const EQ_ORDER = ['machine', 'cable', 'dumbbell', 'barbell', 'cardio', 'body']
const KIND = { c: 'أساسي', i: 'تركيز', x: 'كارديو' }

const PRESS = { chest: 1, front: 0.5, triceps: 0.5 }
const ROW = { rows: 1, lats: 0.5, rear: 0.5, biceps: 0.5 }
const OHP = { front: 1, side: 0.5, triceps: 0.5 }
/* The app's own name (EXERCISE_MEDIA) is the key; its Arabic name and
   tool come from there too, so a picture and a tag never disagree.
   Smith counts as a machine. */
const EQ_FROM_APP = { machine: 'machine', smith: 'machine', cable: 'cable', dumbbell: 'dumbbell', barbell: 'barbell', cardio: 'cardio', bodyweight: 'body' }
const X = (id, en, ar, card, area, eq, k, mv, cr, fat = 1) => {
  const m = EXERCISE_MEDIA[en]
  return { id: m ? m.slug : id, en, ar: m ? m.ar : ar, card, area, eq: m ? EQ_FROM_APP[m.equip] || eq : eq, k, mv, cr, fat, key: MUSCLE_OF[en] || CARD[card].key }
}

/* Library order = tie-break order. Machines and cables first inside each
   area: Hamza trains on machines, and the fill prefers stable versions. */
const EX = [
  X('hammer_bench_press', 'Hammer Strength Machine Bench Press', 'ضغط صدر جهاز هامر', 'chest', 'chest', 'machine', 'c', 'press', PRESS),
  X('machine_incline_press', 'Machine Incline Press', 'ضغط مائل جهاز', 'chest', 'chest', 'machine', 'c', 'incline', PRESS),
  X('bench_press', 'Bench Press', 'ضغط بنش بالبار', 'chest', 'chest', 'barbell', 'c', 'press', PRESS, 2),
  X('incline_db_press', 'Incline Dumbbell Press', 'ضغط مائل دمبل', 'chest', 'chest', 'dumbbell', 'c', 'incline', PRESS),
  X('cable_fly', 'Cable Fly', 'تفتيح كيبل', 'chest', 'chest', 'cable', 'i', 'fly', { chest: 1 }),
  X('pec_deck', 'Pec Deck', 'تفتيح جهاز (بك دك)', 'chest', 'chest', 'machine', 'i', 'fly', { chest: 1 }),
  X('push_up', 'Push-Up', 'ضغط أرضي', 'chest', 'chest', 'body', 'c', 'press', PRESS),

  X('lat_pulldown', 'Lat Pulldown', 'سحب أمامي', 'back', 'lats', 'machine', 'c', 'vpull', { lats: 1, biceps: 0.5 }),
  X('pull_up', 'Pull-Up', 'عقلة', 'back', 'lats', 'body', 'c', 'vpull', { lats: 1, biceps: 0.5 }, 2),
  X('machine_pullover', 'Machine Pullover', 'بلأوفر جهاز', 'back', 'lats', 'machine', 'i', 'pullover', { lats: 1 }),
  X('straight_arm_pulldown', 'Straight Arm Pulldown', 'سحب بذراع مستقيمة', 'back', 'lats', 'cable', 'i', 'pullover', { lats: 1 }),
  X('seated_cable_row', 'Seated Cable Row', 'تجديف كيبل جالس', 'back', 'rows', 'cable', 'c', 'row', ROW),
  X('chest_supported_row', 'Chest-Supported Row', 'تجديف بسند الصدر', 'back', 'rows', 'machine', 'c', 'row', ROW),
  X('dumbbell_row', 'Dumbbell Row', 'تجديف دمبل', 'back', 'rows', 'dumbbell', 'c', 'row', ROW),
  X('barbell_row', 'Barbell Row', 'تجديف بار', 'back', 'rows', 'barbell', 'c', 'row', ROW, 2),
  X('t_bar_row', 'T-Bar Row', 'تجديف تي-بار', 'back', 'rows', 'barbell', 'c', 'row', ROW, 2),

  X('machine_shoulder_press', 'Machine Shoulder Press', 'ضغط أكتاف جهاز', 'shoulders', 'front', 'machine', 'c', 'ohp', OHP),
  X('db_shoulder_press', 'Dumbbell Shoulder Press', 'ضغط أكتاف دمبل', 'shoulders', 'front', 'dumbbell', 'c', 'ohp', OHP),
  X('machine_lateral_raise', 'Machine Lateral Raise', 'رفرفة جانبية جهاز', 'shoulders', 'side', 'machine', 'i', 'lateral', { side: 1 }),
  X('cable_lateral_raise', 'Cable Lateral Raise', 'رفرفة جانبية كيبل', 'shoulders', 'side', 'cable', 'i', 'lateral', { side: 1 }),
  X('lateral_raise', 'Lateral Raise', 'رفرفة جانبية', 'shoulders', 'side', 'dumbbell', 'i', 'lateral', { side: 1 }),
  X('machine_reverse_fly', 'Machine Reverse Fly', 'رفرفة عكسية جهاز', 'shoulders', 'rear', 'machine', 'i', 'rearfly', { rear: 1 }),
  X('face_pull', 'Face Pull', 'سحب للوجه', 'shoulders', 'rear', 'cable', 'i', 'facepull', { rear: 1, rows: 0.5 }, 1, 'Back'),
  X('reverse_fly', 'Reverse Fly', 'رفرفة عكسية', 'shoulders', 'rear', 'dumbbell', 'i', 'rearfly', { rear: 1 }),

  X('leg_press', 'Leg Press', 'دفع أرجل جهاز', 'legs', 'quads', 'machine', 'c', 'squat', { quads: 1, glutes: 0.5 }),
  X('hack_squat', 'Hack Squat', 'هاك سكوات', 'legs', 'quads', 'machine', 'c', 'squat', { quads: 1, glutes: 0.5 }, 2),
  X('leg_extension', 'Leg Extension', 'مد أرجل جهاز', 'legs', 'quads', 'machine', 'i', 'legext', { quads: 1 }),
  X('barbell_squat', 'Barbell Squat', 'سكوات بالبار', 'legs', 'quads', 'barbell', 'c', 'squat', { quads: 1, glutes: 0.5 }, 3),
  X('dumbbell_lunge', 'Dumbbell Lunge', 'طعنات دمبل', 'legs', 'quads', 'dumbbell', 'c', 'lunge', { quads: 1, glutes: 0.5 }),
  X('bulgarian_split_squat', 'Bulgarian Split Squat', 'سكوات بلغاري', 'legs', 'quads', 'dumbbell', 'c', 'lunge', { quads: 1, glutes: 0.5 }, 2),
  X('lunge', 'Lunge', 'طعنات', 'legs', 'quads', 'body', 'c', 'lunge', { quads: 1, glutes: 0.5 }),
  X('leg_curl', 'Leg Curl', 'مرجحة خلفية جهاز', 'legs', 'hams', 'machine', 'i', 'legcurl', { hams: 1 }),
  X('seated_leg_curl', 'Seated Leg Curl', 'مرجحة خلفية جالس', 'legs', 'hams', 'machine', 'i', 'legcurl', { hams: 1 }),
  X('romanian_deadlift', 'Romanian Deadlift', 'ديدلفت روماني', 'legs', 'hams', 'barbell', 'c', 'hinge', { hams: 1, glutes: 0.5 }, 3),
  X('db_romanian_deadlift', 'Dumbbell Romanian Deadlift', 'ديدلفت روماني دمبل', 'legs', 'hams', 'dumbbell', 'c', 'hinge', { hams: 1, glutes: 0.5 }, 2),
  X('glute_kickback', 'Machine Glute Kickbacks', 'ركلة خلفية جهاز', 'legs', 'glutes', 'machine', 'i', 'kickback', { glutes: 1 }),
  X('hip_thrust', 'Hip Thrust', 'رفع حوض', 'legs', 'glutes', 'barbell', 'c', 'thrust', { glutes: 1, hams: 0.5 }, 2),
  X('standing_calf_raise', 'Standing Calf Raise', 'سمانة وقوف', 'legs', 'calves', 'machine', 'i', 'calf', { calves: 1 }),
  X('dumbbell_calf_raise', 'Dumbbell Calf Raise', 'سمانة دمبل', 'legs', 'calves', 'dumbbell', 'i', 'calf', { calves: 1 }),

  X('machine_preacher_curl', 'Machine Preacher Curl', 'مرجحة بريتشر جهاز', 'biceps', 'biceps', 'machine', 'i', 'curl', { biceps: 1 }),
  X('cable_hammer_curl', 'Cable Hammer Curls', 'مرجحة هامر كيبل', 'biceps', 'biceps', 'cable', 'i', 'hammer', { biceps: 1 }),
  X('dumbbell_curl', 'Dumbbell Curl', 'مرجحة دمبل', 'biceps', 'biceps', 'dumbbell', 'i', 'curl', { biceps: 1 }),
  X('hammer_curl', 'Hammer Curl', 'مرجحة هامر', 'biceps', 'biceps', 'dumbbell', 'i', 'hammer', { biceps: 1 }),
  X('barbell_curl', 'Barbell Curl', 'مرجحة بار', 'biceps', 'biceps', 'barbell', 'i', 'curl', { biceps: 1 }),

  X('triceps_pushdown', 'Triceps Pushdown', 'دفع ترايسبس كيبل', 'triceps', 'triceps', 'cable', 'i', 'pushdown', { triceps: 1 }),
  X('cable_triceps_kickback', 'Cable Triceps Kickback', 'ركلة خلفية كيبل', 'triceps', 'triceps', 'cable', 'i', 'kickback', { triceps: 1 }),
  X('cable_overhead_triceps', 'Cable Overhead Triceps Extension', 'ترايسبس علوي كيبل', 'triceps', 'triceps', 'cable', 'i', 'ohext', { triceps: 1 }),
  X('overhead_triceps', 'Overhead Triceps', 'ترايسبس خلف الرأس', 'triceps', 'triceps', 'dumbbell', 'i', 'ohext', { triceps: 1 }),
  X('skull_crusher', 'Skull Crusher', 'سكل كراشر', 'triceps', 'triceps', 'barbell', 'i', 'skull', { triceps: 1 }),
  X('triceps_dip', 'Triceps Dip', 'متوازي ترايسبس', 'triceps', 'triceps', 'body', 'c', 'dip', { triceps: 1, chest: 0.5, front: 0.5 }),

  X('cable_crunch', 'Cable Crunch', 'كرانش كيبل', 'core', 'core', 'cable', 'i', 'crunch', { core: 1 }),
  X('plank', 'Plank', 'بلانك', 'core', 'core', 'body', 'i', 'plank', { core: 1 }),
  X('crunches', 'Crunches', 'كرانش', 'core', 'core', 'body', 'i', 'crunch', { core: 1 }),
  X('hanging_knee_raise', 'Hanging Knee Raise', 'رفع ركب معلّق', 'core', 'core', 'body', 'i', 'hang', { core: 1 }),

  X('treadmill_run', 'Treadmill Run', 'جري سير', 'cardio', 'cardio', 'cardio', 'x', 'run', { cardio: 1 }),
  X('stationary_bike', 'Stationary Bike', 'دراجة ثابتة', 'cardio', 'cardio', 'cardio', 'x', 'bike', { cardio: 1 }),
  X('jump_rope', 'Jump Rope', 'نط حبل', 'cardio', 'cardio', 'cardio', 'x', 'rope', { cardio: 1 }),

  /* ── the rest of the library (after the first 57, so ties still go
     the way the prototype's cases were checked) ── */
  X('incline_bench_press', 'Incline Bench Press', '', 'chest', 'chest', 'barbell', 'c', 'incline', PRESS, 2),
  X('decline_bench_press', 'Decline Bench Press', '', 'chest', 'chest', 'barbell', 'c', 'press', PRESS, 2),
  X('dumbbell_fly', 'Dumbbell Fly', '', 'chest', 'chest', 'dumbbell', 'i', 'fly', { chest: 1 }),
  X('chest_dip', 'Chest Dip', '', 'chest', 'chest', 'body', 'c', 'dip', { chest: 1, triceps: 0.5, front: 0.5 }),
  X('landmine_press', 'Landmine Press', '', 'chest', 'chest', 'barbell', 'c', 'incline', PRESS),
  X('single_arm_row', 'Single Arm Row', '', 'back', 'rows', 'dumbbell', 'c', 'row', ROW),
  X('farmers_carry', 'Dumbbell Farmers Carry', '', 'back', 'rows', 'dumbbell', 'i', 'carry', { rows: 0.5, core: 0.5 }),
  X('dumbbell_shrug', 'Dumbbell Shrug', '', 'back', 'rows', 'dumbbell', 'i', 'shrug', { rows: 0.5 }),
  X('deadlift', 'Deadlift', '', 'legs', 'hams', 'barbell', 'c', 'hinge', { hams: 1, glutes: 0.5, rows: 0.5 }, 3),
  X('overhead_press', 'Overhead Press', '', 'shoulders', 'front', 'barbell', 'c', 'ohp', OHP, 2),
  X('dumbbell_ohp', 'Dumbbell OHP', '', 'shoulders', 'front', 'dumbbell', 'c', 'ohp', OHP),
  X('arnold_press', 'Arnold Press', '', 'shoulders', 'front', 'dumbbell', 'c', 'ohp', OHP),
  X('front_raise', 'Front Raise', '', 'shoulders', 'front', 'dumbbell', 'i', 'frontraise', { front: 1 }),
  X('upright_row', 'Upright Row', '', 'shoulders', 'side', 'barbell', 'i', 'upright', { side: 1, rear: 0.5 }),
  X('rear_delt_fly', 'Rear Delt Fly', '', 'shoulders', 'rear', 'dumbbell', 'i', 'rearfly', { rear: 1 }),
  X('lying_leg_curl', 'Lying Leg Curl', '', 'legs', 'hams', 'machine', 'i', 'legcurl', { hams: 1 }),
  X('hip_abduction', 'Machine Hip Abduction', '', 'legs', 'glutes', 'machine', 'i', 'abduct', { glutes: 1 }),
  X('hip_adduction', 'Machine Hip Adduction', '', 'legs', 'quads', 'machine', 'i', 'adduct', { quads: 0.5 }),
  X('smith_calf_raise', 'Smith Machine Calf Raise', '', 'legs', 'calves', 'machine', 'i', 'calf', { calves: 1 }),
  X('preacher_curl', 'Preacher Curl', '', 'biceps', 'biceps', 'barbell', 'i', 'curl', { biceps: 1 }),
  X('cable_curl', 'Cable Curl', '', 'biceps', 'biceps', 'cable', 'i', 'curl', { biceps: 1 }),
  X('incline_db_curl', 'Incline Dumbbell Curl', '', 'biceps', 'biceps', 'dumbbell', 'i', 'curl', { biceps: 1 }),
  X('concentration_curl', 'Concentration Curl', '', 'biceps', 'biceps', 'dumbbell', 'i', 'curl', { biceps: 1 }),
  X('db_concentration_curl', 'Dumbbell Concentration Curl', '', 'biceps', 'biceps', 'dumbbell', 'i', 'curl', { biceps: 1 }),
  X('spider_curl', 'Spider Curl', '', 'biceps', 'biceps', 'dumbbell', 'i', 'curl', { biceps: 1 }),
  X('barbell_reverse_curl', 'Barbell Reverse Curl', '', 'biceps', 'biceps', 'barbell', 'i', 'revcurl', { biceps: 1 }),
  X('cable_kickback', 'Cable Kickback', '', 'triceps', 'triceps', 'cable', 'i', 'kickback', { triceps: 1 }),
  X('close_grip_bench', 'Close-Grip Bench', '', 'triceps', 'triceps', 'barbell', 'c', 'cgbench', { triceps: 1, chest: 0.5, front: 0.5 }, 2),
  X('diamond_push_up', 'Diamond Push-Up', '', 'triceps', 'triceps', 'body', 'c', 'dip', { triceps: 1, chest: 0.5 }),
  X('cable_core_rotation', 'Cable Core Rotation', '', 'core', 'core', 'cable', 'i', 'rotate', { core: 1 }),
  X('hanging_leg_raise', 'Hanging Leg Raise', '', 'core', 'core', 'body', 'i', 'hang', { core: 1 }),
  X('leg_raise', 'Leg Raise', '', 'core', 'core', 'body', 'i', 'legraise', { core: 1 }),
  X('ab_wheel', 'Ab Wheel', '', 'core', 'core', 'body', 'i', 'rollout', { core: 1 }),
  X('russian_twist', 'Russian Twist', '', 'core', 'core', 'body', 'i', 'rotate', { core: 1 }),
  X('hollow_body_hold', 'Hollow Body Hold', '', 'core', 'core', 'body', 'i', 'plank', { core: 1 }),
  X('db_side_bend', 'Dumbbell Side Bend', '', 'core', 'core', 'dumbbell', 'i', 'sidebend', { core: 1 }),
  X('rowing_machine', 'Rowing Machine', '', 'cardio', 'cardio', 'cardio', 'x', 'row', { cardio: 1 }),
  X('stair_climber', 'Stair Climber', '', 'cardio', 'cardio', 'cardio', 'x', 'stairs', { cardio: 1 }),
  X('battle_ropes', 'Battle Ropes', '', 'cardio', 'cardio', 'cardio', 'x', 'ropes', { cardio: 1 }),
  X('sled_push', 'Sled Push', '', 'cardio', 'cardio', 'cardio', 'x', 'sled', { cardio: 1 }),
]
const EXI = Object.fromEntries(EX.map((e, i) => [e.id, Object.assign(e, { ord: i })]))

// weekly sets [minimum, good, too much]
const BASE_T = {
  chest: [6, 10, 20], lats: [3, 5, 10], rows: [3, 5, 10], side: [4, 8, 16], rear: [3, 6, 12],
  quads: [6, 10, 20], hams: [4, 8, 16], glutes: [3, 4, 12], calves: [4, 6, 12],
  biceps: [4, 6, 14], triceps: [4, 6, 14], core: [2, 3, 10],
}
function targets(goal) {
  const T = {}
  for (const [a, v] of Object.entries(BASE_T)) T[a] = [...v]
  if (goal === 'strength') for (const a of ['chest', 'quads', 'hams']) T[a] = [5, 6, 12]
  if (goal === 'maintain') for (const a in T) T[a] = [Math.min(T[a][0], AREAS[a].big ? 4 : 3), Math.min(T[a][1], 6), T[a][2]]
  if (goal === 'fat') { for (const a of ['chest', 'quads', 'hams']) T[a] = [T[a][0], 8, 14]; T.cardio = [1.5, 2, 4] }
  return T
}

/* ── exercises the catalogue does not know ──
   A plan from an AI or an old file can hold any name («Squat Jump»). Opened
   to edit, such an exercise is kept exactly as written: it gets an entry of
   its own (never offered by the fill), counted as direct work for its
   muscle group, so nothing he wrote is ever dropped. */
const AREA_OF_MUSCLE = { Chest: 'chest', Back: 'rows', Shoulders: 'side', Legs: 'quads', Biceps: 'biceps', Triceps: 'triceps', Core: 'core', Cardio: 'cardio' }
const CARD_OF_MUSCLE = { Chest: 'chest', Back: 'back', Shoulders: 'shoulders', Legs: 'legs', Biceps: 'biceps', Triceps: 'triceps', Core: 'core', Cardio: 'cardio' }
const BY_EN = new Map(EX.map(e => [e.en.toLowerCase(), e]))
const BY_WORDS = new Map(EX.map(e => [wordSetKey(e.en), e]))

/** The catalogue entry for a stored exercise name, or null. */
export function entryForName(name) {
  if (!name) return null
  return BY_EN.get(String(name).toLowerCase()) || BY_WORDS.get(wordSetKey(name)) || null
}

/** An entry for any stored exercise: the catalogue's, or one of its own. */
export function ensureEntry(name, muscle) {
  const known = entryForName(name)
  if (known) return known
  const id = 'x:' + String(name)
  if (EXI[id]) return EXI[id]
  const m = MUSCLES.includes(muscle) ? muscle : 'Chest'
  const area = AREA_OF_MUSCLE[m]
  const e = { id, en: String(name), ar: String(name), card: CARD_OF_MUSCLE[m], area, eq: 'other', k: m === 'Cardio' ? 'x' : 'c', mv: 'other:' + name, cr: { [area]: 1 }, fat: 1, key: m, ord: 10000, foreign: true }
  EXI[id] = e
  return e
}


export { AREAS, AREA_ORDER, CARDS, CARD, GROUP, EQ, EQ_ORDER, KIND, EX, EXI, BASE_T, targets }
