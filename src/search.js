// ── Exercise search that understands how people talk in a gym ──
//
// The library's field used to match the English name only, so «بنش» —
// the first word anyone in a Saudi gym would type — gave an empty black
// page (critique F62). This module is the fix, and it is shared: the
// library uses it now, and the add-exercise picker can use it later.
//
// Three things make a query land:
//
//   1. normalize(): one spelling for the letters people type
//      interchangeably — أ/إ/آ/ٱ→ا, ة→ه, ى→ي, ؤ→و, ئ→ي, the Persian
//      letters a phone keyboard offers (ک ی گ پ چ ڤ), no tashkeel, no
//      tatweel, Arabic-Indic digits → Western, Latin lower-cased.
//   2. An index per exercise: its Arabic name (src/exerciseMedia.js),
//      its English name, the colloquial words for each English word
//      (bench → بنش، press → برس…), the muscle and its colloquial names
//      (بايسبس، كتف، رجل…), and the equipment (جهاز، كيبل، دمبل…).
//   3. Ranking: a whole word beats the start of the name beats the start
//      of a word beats a substring — one flat list, best first. Every
//      word of the query has to land somewhere (AND), so «بنش مائل»
//      narrows instead of widening.
//
// Pure functions, no DOM, no storage: node tests import it directly.

import { MUSCLE_GROUPS } from './constants.js'
import { EXERCISE_MEDIA, EQUIP_LABELS } from './exerciseMedia.js'

// ── 1. Normalisation ──────────────────────────────────────────

const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭ]/g
const TATWEEL = /ـ/g
const LETTERS = {
  'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ٲ': 'ا', 'ٳ': 'ا',
  'ة': 'ه', 'ۀ': 'ه', 'ە': 'ه',
  'ى': 'ي', 'ی': 'ي', 'ې': 'ي', 'ئ': 'ي',
  'ؤ': 'و',
  'ک': 'ك', 'گ': 'ق', 'پ': 'ب', 'چ': 'ج', 'ڤ': 'ف', 'ژ': 'ز',
}
const LETTER_RE = new RegExp('[' + Object.keys(LETTERS).join('') + ']', 'g')

/** One spelling for a string: Arabic folded, digits Western, Latin lower. */
export function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(TASHKEEL, '')
    .replace(TATWEEL, '')
    .replace(LETTER_RE, ch => LETTERS[ch])
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0))
    .replace(/ء/g, '')
    // Anything that is not a letter or a digit is a word break: hyphens
    // (Push-Up), slashes, brackets («تفتيح جهاز (بك دك)»), punctuation.
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

// English spellings that are the same word (as in exerciseMedia.js).
const SAME_WORD = {
  tricep: 'triceps', bicep: 'biceps', dumbell: 'dumbbell', db: 'dumbbell',
  bb: 'barbell', barbel: 'barbell', curls: 'curl', raises: 'raise',
  presses: 'press', rows: 'row', extensions: 'extension', flyes: 'fly',
  flys: 'fly', flies: 'fly', dips: 'dip', squats: 'squat', lunges: 'lunge',
  pulldowns: 'pulldown', kickbacks: 'kickback', crunches: 'crunch',
  pushups: 'pushup', pullups: 'pullup', glutes: 'glute', ropes: 'rope',
  shrugs: 'shrug', thrusts: 'thrust', carries: 'carry',
}

/** The words of a normalised string, plus the forms people also mean:
 *  «الصدر» is also «صدر», «بالبار» is also «بار». */
function wordsOf(s) {
  const out = []
  for (const w of normalize(s).split(' ')) {
    if (!w) continue
    const same = SAME_WORD[w]
    out.push(same || w)
    if (same) out.push(w)
    if (w.length >= 4 && w.startsWith('ال')) out.push(w.slice(2))
    if (w.length >= 5 && (w.startsWith('بال') || w.startsWith('وال') || w.startsWith('لل'))) {
      out.push(w.startsWith('لل') ? w.slice(2) : w.slice(3))
    }
  }
  return out
}

// ── 2. The colloquial vocabulary ──────────────────────────────
//
// Keyed by the English word as it appears in catalogue names, so every
// exercise carrying «bench» answers to «بنش» without listing each one.
// Values are written the way people type them; normalize() folds the
// spelling at index time, so «رفرفة» and «رفرفه» are one entry.

export const WORD_ALIASES = {
  bench: ['بنش', 'بينش', 'بنج', 'بنتش'],
  press: ['برس', 'بريس', 'ضغط', 'دفع'],
  incline: ['مائل', 'مايل', 'انكلاين', 'انكلين', 'عالي'],
  decline: ['منحدر', 'نازل', 'دكلاين', 'سفلي'],
  fly: ['فلاي', 'تفتيح', 'فراشه'],
  pec: ['بك', 'بيك'],
  deck: ['دك', 'ديك'],
  dip: ['ديبس', 'دبس', 'ديب', 'متوازي'],
  push: ['بوش'],
  pull: ['بول', 'سحب'],
  up: ['اب', 'أب'],
  pulldown: ['بولداون', 'داون', 'سحب'],
  lat: ['لات', 'لاتس', 'اللات'],
  row: ['رو', 'روينق', 'تجديف'],
  rowing: ['تجديف', 'رو', 'روينق'],
  deadlift: ['ديدلفت', 'ديدليفت', 'ديد', 'رفعه ميته', 'دد'],
  romanian: ['روماني', 'رومانيان'],
  squat: ['سكوات', 'سكوت', 'اسكوات', 'سكواط', 'قرفصاء'],
  hack: ['هاك'],
  leg: ['ليق', 'ليج', 'لق', 'رجل', 'ارجل', 'رجول'],
  extension: ['اكستنشن', 'اكستينشن', 'اكستنشين', 'مد', 'تمديد'],
  curl: ['كيرل', 'كيرلز', 'كرل', 'مرجحه'],
  hammer: ['هامر', 'مطرقه'],
  preacher: ['بريتشر', 'بريجر', 'بريشر'],
  concentration: ['تركيز', 'كونسنتريشن'],
  spider: ['سبايدر'],
  reverse: ['عكسي', 'ريفيرس', 'ريفرس'],
  triceps: ['ترايسبس', 'ترايسيبس', 'تراي', 'ترايس'],
  biceps: ['بايسبس', 'بايسيبس', 'باي', 'بايس'],
  pushdown: ['بوشداون', 'بوش', 'داون'],
  kickback: ['كيك', 'كيكباك', 'ركله'],
  skull: ['سكل', 'سكال'],
  crusher: ['كراشر'],
  overhead: ['اوفرهيد', 'اوفر', 'هيد', 'عسكري'],
  shoulder: ['شولدر', 'كتف', 'اكتاف'],
  ohp: ['عسكري', 'اوفرهيد'],
  lateral: ['لاتيرال', 'جانبي', 'سايد'],
  raise: ['ريز', 'رفرفه', 'رفع'],
  front: ['فرونت', 'امامي'],
  rear: ['ريير', 'رير', 'خلفي'],
  delt: ['دلت', 'دالي', 'داليه'],
  arnold: ['ارنولد'],
  upright: ['ابرايت', 'عمودي'],
  face: ['فيس', 'وجه'],
  shrug: ['شرق', 'شراق', 'شرك', 'شرج', 'هز'],
  pullover: ['بلوفر', 'بولوفر', 'بلاوفر', 'بول اوفر'],
  t: ['تي'],
  bar: ['بار', 'باربل'],
  barbell: ['بار', 'باربل', 'حديد'],
  dumbbell: ['دمبل', 'دنبل', 'دامبل', 'دمبلز', 'دامبلز'],
  machine: ['جهاز', 'ماشين', 'مكينه', 'اله'],
  cable: ['كيبل', 'كابل', 'سلك'],
  smith: ['سميث'],
  calf: ['سمانه', 'كالف', 'بطه', 'بطات', 'سمانات'],
  standing: ['وقوف', 'واقف'],
  seated: ['جالس', 'جلوس'],
  lying: ['نايم', 'نائم', 'منبطح'],
  lunge: ['لانج', 'لانجز', 'طعن', 'طعنات'],
  bulgarian: ['بلغاري'],
  split: ['سبليت'],
  hip: ['هيب', 'ورك', 'حوض'],
  thrust: ['ثرست', 'جسر'],
  glute: ['قلوت', 'جلوت', 'قلوتس', 'جلوتس', 'مؤخره'],
  abduction: ['ابدكشن', 'فتح'],
  adduction: ['ادكشن', 'ضم'],
  plank: ['بلانك', 'لوح'],
  crunch: ['كرانش', 'كرنش'],
  russian: ['روسي'],
  twist: ['تويست', 'لف'],
  wheel: ['عجله', 'ويل', 'رولر'],
  hanging: ['معلق', 'تعلق'],
  knee: ['ركبه', 'ركب'],
  hollow: ['هولو'],
  core: ['كور', 'بطن'],
  rotation: ['لف', 'دوران'],
  side: ['سايد', 'جانبي'],
  bend: ['انحناء'],
  farmers: ['فارمر', 'فارمرز', 'مزارع'],
  carry: ['حمل', 'كاري'],
  chest: ['صدر', 'تشست'],
  supported: ['سند'],
  single: ['واحده', 'سنقل'],
  arm: ['ذراع', 'يد'],
  straight: ['مستقيم', 'ستريت'],
  close: ['ضيق', 'ضيقه'],
  grip: ['قبضه', 'مسكه', 'قريب'],
  diamond: ['دايموند', 'ماسي'],
  landmine: ['لاندماين'],
  treadmill: ['تريدمل', 'تردمل', 'سير', 'جري'],
  run: ['جري', 'ركض'],
  jump: ['نط'],
  rope: ['حبل'],
  stationary: ['ثابته'],
  bike: ['سيكل', 'دراجه', 'بايك'],
  stair: ['درج', 'سلالم', 'ستير'],
  climber: ['كلايمر'],
  battle: ['باتل'],
  sled: ['زلاجه', 'سليد'],
  strength: ['هامر'],
}

/** Names that need a word of their own beyond their English words. */
export const NAME_ALIASES = {
  'Romanian Deadlift': ['rdl'],
  'Dumbbell Romanian Deadlift': ['rdl'],
  'Overhead Press': ['ohp', 'عسكري'],
  'Lat Pulldown': ['سحب علوي', 'سحب ظهر'],
  'Pull-Up': ['عقله', 'pullup'],
  'Push-Up': ['ضغط', 'pushup'],
  'Hammer Strength Machine Bench Press': ['ضغط صدر'],
  'Pec Deck': ['فراشه'],
  'Triceps Pushdown': ['سحب ترايسبس'],
  'Leg Curl': ['هامسترنق', 'خلفيه'],
  'Leg Extension': ['امامي'],
}

export const MUSCLE_ALIASES = {
  Chest: ['صدر', 'تشست', 'chest', 'pecs'],
  Back: ['ظهر', 'باك', 'back'],
  Shoulders: ['كتف', 'اكتاف', 'كتوف', 'شولدر', 'دالي', 'shoulders', 'delts'],
  // Not «ليق»: that is «leg» in «ليق برس», and it should find the
  // three leg-machine lifts first, not every lift in the group.
  Legs: ['رجل', 'رجول', 'ارجل', 'فخذ', 'افخاذ', 'legs', 'quads'],
  Biceps: ['بايسبس', 'بايسيبس', 'باي', 'بايس', 'ذراع امامي', 'biceps'],
  Triceps: ['ترايسبس', 'ترايسيبس', 'تراي', 'ترايس', 'ذراع خلفي', 'triceps'],
  Core: ['كور', 'بطن', 'معده', 'سكس باك', 'core', 'abs'],
  Cardio: ['كارديو', 'لياقه', 'هوائي', 'cardio'],
}

export const EQUIP_ALIASES = {
  barbell: ['بار', 'باربل', 'حديد', 'barbell'],
  dumbbell: ['دمبل', 'دنبل', 'دامبل', 'dumbbell'],
  machine: ['جهاز', 'ماشين', 'مكينه', 'اله', 'machine'],
  cable: ['كيبل', 'كابل', 'سلك', 'cable'],
  bodyweight: ['وزن الجسم', 'بدون اوزان', 'bodyweight'],
  smith: ['سميث', 'smith'],
  cardio: ['كارديو', 'cardio'],
}

// ── 3. The index ──────────────────────────────────────────────

const lowerMedia = new Map(Object.entries(EXERCISE_MEDIA).map(([k, v]) => [k.toLowerCase(), v]))
const muscleOfName = new Map()
for (const [key, g] of Object.entries(MUSCLE_GROUPS)) {
  for (const e of g.exercises || []) muscleOfName.set(e.name, key)
}

/**
 * One searchable document. `entry` needs a `name`; `muscle` (a
 * MUSCLE_GROUPS key) is looked up from the catalogue when missing.
 */
function docFor(entry) {
  const name = entry.name
  const muscle = entry.muscle || muscleOfName.get(name) || null
  const media = EXERCISE_MEDIA[name] || lowerMedia.get(String(name).toLowerCase()) || null
  const en = wordsOf(name)
  const alias = []
  for (const w of en) for (const a of WORD_ALIASES[w] || []) alias.push(...wordsOf(a))
  for (const a of NAME_ALIASES[name] || []) alias.push(...wordsOf(a))
  const g = muscle ? MUSCLE_GROUPS[muscle] : null
  const muscleWords = [
    ...(g ? wordsOf(g.label) : []),
    ...(muscle ? (MUSCLE_ALIASES[muscle] || []).flatMap(wordsOf) : []),
  ]
  const equip = media?.equip
  const equipWords = equip
    ? [...wordsOf(EQUIP_LABELS[equip] || ''), ...(EQUIP_ALIASES[equip] || []).flatMap(wordsOf)]
    : []
  return {
    entry: { ...entry, muscle },
    ar: media ? normalize(media.ar) : '',
    arWords: media ? wordsOf(media.ar) : [],
    en: normalize(name),
    enWords: en,
    alias: [...new Set(alias)],
    muscle: [...new Set(muscleWords)],
    equip: [...new Set(equipWords)],
  }
}

/** Build an index over any list of `{ name, muscle? }`. */
export function buildIndex(entries) {
  return entries.map(docFor)
}

// How well one query word lands in a document.
//
//   4.5  a whole muscle word («صدر», «بايسبس»): the person named a muscle
//   4    a whole word of the name or an alias («بنش» in «ضغط بنش بالبار»)
//   3.5  the start of the name («سكو» → «سكوات بالبار»)
//   3    the start of a word of the name or an alias
//   2.5  a whole equipment word («كيبل»)
//   2    the start of a muscle word («باي»)
//   1.5  the start of an equipment word
//   1    anywhere inside the name (two letters or more)
function wordScore(doc, t) {
  let best = 0
  const has = (list, fn) => list.some(fn)
  if (has(doc.muscle, w => w === t)) best = Math.max(best, 4.5)
  if (has(doc.arWords, w => w === t) || has(doc.enWords, w => w === t) || has(doc.alias, w => w === t)) best = Math.max(best, 4)
  if (best >= 4) return best
  if ((doc.ar && doc.ar.startsWith(t)) || doc.en.startsWith(t)) best = Math.max(best, 3.5)
  if (best < 3 && (has(doc.arWords, w => w.startsWith(t)) || has(doc.enWords, w => w.startsWith(t)) || has(doc.alias, w => w.startsWith(t)))) best = 3
  if (best < 2.5 && has(doc.equip, w => w === t)) best = 2.5
  if (best < 2 && has(doc.muscle, w => w.startsWith(t))) best = 2
  if (best < 1.5 && has(doc.equip, w => w.startsWith(t))) best = 1.5
  if (best < 1 && t.length >= 2 && (doc.ar.includes(t) || doc.en.includes(t))) best = 1
  return best
}

/** The query's words, each with the alternative forms it may stand for. */
function queryWords(query) {
  const out = []
  for (const w of normalize(query).split(' ')) {
    if (!w) continue
    const forms = new Set([w, SAME_WORD[w] || w])
    if (w.length >= 4 && w.startsWith('ال')) forms.add(w.slice(2))
    out.push([...forms])
  }
  return out
}

/**
 * Search an index. Returns `[{ entry, score }]`, best first; ties keep
 * the index order (catalogue order: by muscle, then as listed). An
 * empty query returns an empty list — browsing is the caller's job.
 */
export function search(index, query) {
  const words = queryWords(query)
  if (!words.length) return []
  const phrase = normalize(query)
  const hits = []
  index.forEach((doc, i) => {
    let total = 0
    for (const forms of words) {
      const s = Math.max(...forms.map(f => wordScore(doc, f)))
      if (!s) return
      total += s
    }
    // The whole phrase, in order: «رفع أرجل» is the leg raise, even
    // though «أرجل» alone names a muscle.
    if (words.length > 1) {
      if (doc.ar === phrase || doc.en === phrase) total += 3
      else if ((doc.ar && doc.ar.startsWith(phrase)) || doc.en.startsWith(phrase)) total += 1.5
      else if ((doc.ar && doc.ar.includes(phrase)) || doc.en.includes(phrase)) total += 1
    }
    hits.push({ entry: doc.entry, score: total, i })
  })
  hits.sort((a, b) => b.score - a.score || a.i - b.i)
  return hits.map(({ entry, score }) => ({ entry, score }))
}

// ── The catalogue, indexed once ───────────────────────────────

let catalogueIndex = null

/** Every built-in exercise as `{ name, muscle }`, in catalogue order. */
export function catalogueEntries() {
  return Object.entries(MUSCLE_GROUPS).flatMap(([muscle, g]) =>
    (g.exercises || []).map(e => ({ name: e.name, muscle })))
}

/** Search the built-in catalogue. */
export function searchExercises(query) {
  if (!catalogueIndex) catalogueIndex = buildIndex(catalogueEntries())
  return search(catalogueIndex, query)
}
