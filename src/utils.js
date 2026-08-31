import { RANKS, COMMITMENT_LEVELS } from './constants.js'
import { dayKey, todayKey, toWesternDigits } from './day.js'

// ── Multi-user storage namespacing ────────────────────────────
// Every hf_* key is namespaced by the active user so each person
// on the same device has fully isolated data (sessions, weights,
// XP, plans...). The first user ('default') keeps the legacy
// un-prefixed keys, so existing data is untouched.
const GLOBAL_KEYS = new Set([
  'hf_users', 'hf_current_user',           // user registry itself
  'hf_notif_enabled', 'hf_notif_scheduled', // device-level settings
  'hf_pack', 'hf_pack_prompted',           // art pack: one download per device
])

export const getCurrentUserId = () => {
  try { return localStorage.getItem('hf_current_user') || 'default' } catch { return 'default' }
}

const nsKey = (key) => {
  if (GLOBAL_KEYS.has(key)) return key
  const id = getCurrentUserId()
  return id === 'default' ? key : `u:${id}:${key}`
}

export const getUsers = () => {
  try {
    const v = localStorage.getItem('hf_users')
    const arr = v ? JSON.parse(v) : null
    if (Array.isArray(arr) && arr.length) return arr
  } catch {}
  return [{ id: 'default', name: 'المستخدم الرئيسي' }]
}

export const saveUsers = (users) => {
  try { localStorage.setItem('hf_users', JSON.stringify(users)) } catch {}
}

export const switchUser = (id) => {
  try { localStorage.setItem('hf_current_user', id) } catch {}
}

// All keys that belong to a single user's data
export const PER_USER_KEYS = [
  'hf_sessions', 'hf_xp', 'hf_active', 'hf_profile', 'hf_unlocked',
  'hf_challenges', 'hf_plan', 'hf_plan_index', 'hf_photos',
  'hf_exercise_mapping', 'hf_last_weights', 'hf_weight_backups',
  'hf_seen_version', 'hf_weights_reset_v2', 'hf_weights_reset_at',
  'hf_exercise_subs', 'hf_rest_timer', 'hf_recovery', 'hf_rep_target',
  'hf_unlocked_at',
]

export const deleteUserData = (id) => {
  try {
    if (id === 'default') {
      PER_USER_KEYS.forEach(k => localStorage.removeItem(k))
    } else {
      const prefix = `u:${id}:`
      const doomed = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(prefix)) doomed.push(k)
      }
      doomed.forEach(k => localStorage.removeItem(k))
    }
  } catch {}
}

// ── localStorage helpers ──────────────────────────────────────
export const ls = {
  get: (key, def) => {
    try {
      const v = localStorage.getItem(nsKey(key))
      return v !== null ? JSON.parse(v) : def
    } catch {
      return def
    }
  },
  set: (key, val) => {
    try { localStorage.setItem(nsKey(key), JSON.stringify(val)) } catch (e) {
      if (e && e.name === 'QuotaExceededError') console.warn('hf: storage full, could not save', key)
    }
  },
  remove: (key) => {
    try { localStorage.removeItem(nsKey(key)) } catch {}
  },
}

// ── ID generator ──────────────────────────────────────────────
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)

// ── Date helpers ──────────────────────────────────────────────
export const todayISO = todayKey

export const fmtDate = (iso) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('ar-SA', {
      weekday: 'short', month: 'short', day: 'numeric',
    })
  } catch {
    return iso
  }
}

export const fmtDuration = (minutes) => {
  if (!minutes && minutes !== 0) return '—'
  const m = Math.round(minutes)
  if (m < 60) return `${m} دقيقة`
  return `${Math.floor(m / 60)}س ${m % 60}د`
}

// ── Streak calculator ─────────────────────────────────────────
export const calcStreak = (sessions) => {
  if (!sessions || !sessions.length) return 0
  const days = [...new Set(sessions.map(s => dayKey(s.date)))]
    .sort()
    .reverse()
  let streak = 0
  let cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  for (const d of days) {
    const dd = new Date(d)
    const diff = Math.round((cursor - dd) / 86400000)
    if (diff <= 1) { streak++; cursor = dd } else break
  }
  return streak
}

// ── Exercise name resolver (alias → standard name) ────────────
export const resolveExerciseName = (name, mapping = {}) => {
  if (!name) return ''
  const trimmed = name.trim()
  const exact = mapping[trimmed]
  if (exact) return exact.toLowerCase()
  const lower = trimmed.toLowerCase()
  for (const [k, v] of Object.entries(mapping)) {
    if (k.toLowerCase() === lower) return v.toLowerCase()
  }
  return lower
}

// Sessions before this stamp are ignored for weight suggestions
// and PR stats (set by "تصفير الأوزان" — history itself is kept).
export const getWeightsResetAt = () => ls.get('hf_weights_reset_at', 0)

// ── Exercise substitutions (machine unavailable) ──────────────
// subs maps an original plan exercise name → index into its
// alternatives list (1-based). 0 / missing means "use the original".
export const substitutedName = (name, subs = {}, alternatives = {}) => {
  const idx = subs[name] || 0
  if (!idx) return name
  return alternatives[name]?.[idx - 1] || name
}

// Next index in the cycle: original → 1 → 2 → ... → original
export const nextSubIndex = (name, subs = {}, alternatives = {}) => {
  const total = alternatives[name]?.length || 0
  if (!total) return 0
  return ((subs[name] || 0) + 1) % (total + 1)
}

// Resolve a whole plan day's exercises through the user's substitutions
export const applySubsToDay = (exercises, subs = {}, alternatives = {}) =>
  (exercises || []).map(ex => {
    const name = substitutedName(ex.name, subs, alternatives)
    return name === ex.name ? ex : { ...ex, name, originalName: ex.name }
  })

// ── Exercise history stats ────────────────────────────────────
export const getExerciseStats = (sessions, exerciseName, mapping = {}) => {
  const resolved = resolveExerciseName(exerciseName, mapping)
  const resetAt  = getWeightsResetAt()
  let lastWeight = null
  let maxWeight  = null
  let lastId     = 0
  for (const session of sessions || []) {
    if ((session.id || 0) < resetAt) continue
    // Deload sessions are not what this exercise is being worked at.
    // This function is the fallback behind the saved snapshot, so
    // without the skip the light weight would resurface as the
    // suggestion for any exercise the snapshot happens to be missing.
    if (session.deload) continue
    for (const ex of session.exercises || []) {
      if (resolveExerciseName(ex.name, mapping) !== resolved) continue
      const ws = (ex.sets || [])
        .filter(s => parseFloat(s.weight) > 0)
        .map(s => parseFloat(s.weight))
      if (!ws.length) continue
      const sMax = Math.max(...ws)
      if (maxWeight === null || sMax > maxWeight) maxWeight = sMax
      if ((session.id || 0) > lastId) { lastId = session.id || 0; lastWeight = ws[ws.length - 1] }
    }
  }
  return { lastWeight, maxWeight }
}

// ── Session volume ────────────────────────────────────────────
export const sessionVolume = (session) => {
  if (!session || !session.exercises) return 0
  return session.exercises.flatMap(ex => ex.sets || []).reduce((total, s) => {
    if (!s.done && !(parseFloat(s.weight) > 0)) return total
    const w = parseFloat(s.weight) || 0
    const r = parseInt(s.reps) || 0
    return total + w * r
  }, 0)
}

// ── Plate granularity ─────────────────────────────────────────
// The smallest jump a rack actually offers. Every rounded weight in
// the app goes through here so the step is stated once instead of
// being repeated at each call site, where the three copies had already
// started to differ.
export const PLATE_STEP = 2.5

export const roundToPlate = (kg, step = PLATE_STEP) =>
  Math.round((Number(kg) || 0) / step) * step

// ── The weight to pre-fill ────────────────────────────────────
// The one producer of a suggested weight. It was written twice —
// once in App.jsx's planned-workout builder and once in WorkoutPage's
// getLastW — with the same three-step fallback in both, which is two
// places for a deload to be applied and two places to drift apart.
//
// The snapshot outranks session history deliberately: it is written at
// the moment a session is finished and reflects what was actually
// lifted, including any edit made afterwards.
//
// `transform` lightens the answer without touching anything stored —
// a deload passes one in. It is a callback rather than a percentage so
// the arithmetic stays in deload.js and exists exactly once; this
// module has no opinion about deloads and importing one here would
// close a cycle, since deload.js already reads from utils.
export const suggestedWeightFor = (name, { sessions = [], mapping = {}, transform } = {}) => {
  const snap = ls.get('hf_last_weights', {})
  const canonical = resolveExerciseName(name, mapping)
  const fromSnap = snap[canonical] ?? snap[String(name).toLowerCase()]
  const base = fromSnap != null
    ? fromSnap
    : (getExerciseStats(sessions, name, mapping).lastWeight ?? '')

  return transform ? transform(base) : base
}

// ── Estimated one-rep max ─────────────────────────────────────
// Epley. An estimate, not a measurement: it drifts high past about ten
// reps, so it is only worth showing on working sets, never on a burnout
// set of twenty.
export const calc1RM = (weight, reps) => {
  const w = parseFloat(weight) || 0
  const r = parseInt(reps) || 0
  if (w <= 0 || r <= 0) return 0
  if (r === 1) return w
  return Math.round(w * (1 + r / 30) * 10) / 10
}

// ── What to call a plan day ───────────────────────────────────
//
// Plan days are stored as "<type> — <muscles>": "Push — صدر، أكتاف،
// ترايسبس". The muscle list is what the day trains, not what the day
// IS — and as a heading it is both long and beside the point, since
// the exercises are one tap away in the day preview. The type is the
// name.
//
// Plans saved by older versions name their days "Day 1", "Day 2",
// which says nothing at all. When the leading label is that generic,
// the type is read off the muscles the day actually trains, so those
// plans get a real name too instead of a number.

const PUSH_MUSCLES = new Set(['Chest', 'Shoulders', 'Triceps'])
const PULL_MUSCLES = new Set(['Back', 'Biceps'])
const LEG_MUSCLES  = new Set(['Legs', 'Glutes', 'Calves', 'Hamstrings', 'Quads'])

// "Day 1", "يوم ٢", "3" — a label that numbers the day without naming it.
const GENERIC_DAY_LABEL = /^(?:day|يوم)?\s*[\d\u0660-\u0669]*$/i

export const planDayType = (day) => {
  const raw   = String(day?.name ?? '')
  const label = raw.split('—')[0].trim()
  if (label && !GENERIC_DAY_LABEL.test(label)) return label

  let push = 0, pull = 0, legs = 0
  for (const ex of day?.exercises || []) {
    if      (PUSH_MUSCLES.has(ex.muscle)) push++
    else if (PULL_MUSCLES.has(ex.muscle)) pull++
    else if (LEG_MUSCLES.has(ex.muscle))  legs++
  }
  // Core and cardio are accessories everywhere; they never name a day.
  if (!push && !pull && !legs) return label || raw.trim()
  if (legs >= push + pull)     return 'Legs'
  if (push && !pull)           return 'Push'
  if (pull && !push)           return 'Pull'
  return legs ? 'Full Body' : 'Upper'
}

/** The type said as a heading: "Push" → "Push Day". */
export const planDayTitle = (day) => {
  const type = planDayType(day)
  if (!type) return ''
  return /(?:day|يوم)$/i.test(type) ? type : `${type} Day`
}

// ── Blank set ─────────────────────────────────────────────────
export const blankSet = (prevWeight = '', prevReps = '') => ({
  weight: toWesternDigits(prevWeight ?? ''),
  reps: prevReps === null || prevReps === undefined ? '' : toWesternDigits(String(prevReps)),
  done: false,
})

// Belt and braces: whatever path a number arrives by, it is stored in
// ASCII digits. Arabic-Indic digits would silently break parseFloat and
// take volume, stats and progression down with them.
export const normalizeSetValue = (value) => toWesternDigits(value ?? '')

const isBlankValue = (v) => v == null || String(v).trim() === ''

// ── Completing a set ──────────────────────────────────────────
//
// Marks one set done and carries what was just lifted into the sets
// that follow it.
//
// A session pre-fills every set from history when the exercise has
// any, so this is invisible on a familiar lift. On a new one — a plan
// you just started, an exercise added mid-session, a swap — history is
// empty, every set is blank, and without this each rest ends on two
// empty boxes and the number you already lifted has to be typed again.
//
// Three rules keep it from destroying intent: forward only, never into
// a set already logged, and never over a value that is already there,
// so a deliberate ramp (60, 70, 80) survives untouched.
export const markSetDone = (sets, index, done) => {
  const src = sets[index]
  if (!src) return sets
  return sets.map((s, i) => {
    if (i === index) return { ...s, done }
    if (!done || i <= index || s.done) return s
    return {
      ...s,
      weight: isBlankValue(s.weight) ? src.weight : s.weight,
      reps:   isBlankValue(s.reps)   ? src.reps   : s.reps,
    }
  })
}

// ── Historical max weight for an exercise across completed sessions ──
export const getHistoricalMax = (sessions, exerciseName, mapping = {}) => {
  const resolved = resolveExerciseName(exerciseName, mapping)
  const resetAt  = getWeightsResetAt()
  let max = 0
  for (const session of sessions || []) {
    if ((session.id || 0) < resetAt) continue
    for (const ex of session.exercises || []) {
      if (resolveExerciseName(ex.name, mapping) === resolved) {
        for (const s of ex.sets || []) {
          if (parseFloat(s.weight) > 0) max = Math.max(max, parseFloat(s.weight))
        }
      }
    }
  }
  return max
}

// ── Detect equipment category from exercise name ──────────────
export const detectEquipment = (name) => {
  const n = name.toLowerCase()
  if (n.includes('smith machine'))                      return 'Smith Machine'
  if (n.includes('barbell'))                            return 'Barbell'
  if (n.includes('dumbbell'))                           return 'Dumbbell'
  if (n.includes('cable'))                              return 'Cable'
  if (n.includes('machine') || n.includes('pec deck')) return 'Machine'
  if (n.includes('band') || n.includes('banded'))      return 'Resistance Band'
  if (n.includes('kettlebell'))                         return 'Kettlebell'
  return 'Bodyweight'
}

// ── Equipment labels (Arabic) ─────────────────────────────────
export const EQUIPMENT_LABELS = {
  'Barbell':          { ar: 'باربل',          emoji: '🏋️' },
  'Dumbbell':         { ar: 'دمبل',            emoji: '💪' },
  'Cable':            { ar: 'كابل',            emoji: '🔗' },
  'Machine':          { ar: 'ماشين',           emoji: '🤖' },
  'Smith Machine':    { ar: 'سميث ماشين',      emoji: '⚙️' },
  'Resistance Band':  { ar: 'إيلاستيك',        emoji: '🟡' },
  'Kettlebell':       { ar: 'كيتل بيل',        emoji: '🔔' },
  'Bodyweight':       { ar: 'وزن الجسم',       emoji: '🤸' },
}

// ── Build exercise ────────────────────────────────────────────
export const buildExercise = ({ muscle, name, numSets = 3, prevWeight = '', prevReps = '' }) => ({
  id: uid(),
  muscle,
  name,
  sets: Array.from({ length: numSets }, () => blankSet(prevWeight, prevReps)),
})

// ── XP / Level formulas ───────────────────────────────────────
export const xpForNextLevel = (level) => 300 * level * level

export const totalXPForLevel = (level) => {
  if (level <= 1) return 0
  return 50 * (level - 1) * level * (2 * level - 1)
}

export const levelFromXP = (xp) => {
  let level = 1
  while (totalXPForLevel(level + 1) <= xp) level++
  return level
}

export const xpProgress = (xp) => {
  const level = levelFromXP(xp)
  const currentLevelXP = totalXPForLevel(level)
  const nextLevelXP = totalXPForLevel(level + 1)
  const currentXP = xp - currentLevelXP
  const neededXP = nextLevelXP - currentLevelXP
  const pct = neededXP > 0 ? Math.min(100, Math.round((currentXP / neededXP) * 100)) : 100
  return { level, currentXP, neededXP, pct }
}

// ── Rank lookup ───────────────────────────────────────────────
export const getRank = (level) => {
  let rank = RANKS[0]
  for (const r of RANKS) {
    if (level >= r.minLevel) rank = r
  }
  return rank
}

// ── Commitment level ──────────────────────────────────────────
export const getCommitmentLevel = (streak) => {
  let cl = COMMITMENT_LEVELS[0]
  for (const c of COMMITMENT_LEVELS) {
    if (streak >= c.min) cl = c
  }
  return cl
}

// ── BMI ───────────────────────────────────────────────────────
export const calcBMI = (weight, height) => {
  if (!weight || !height) return 0
  const h = height / 100
  return Math.round((weight / (h * h)) * 10) / 10
}

export const bmiCategory = (bmi) => {
  if (bmi < 18.5) return 'نقص وزن'
  if (bmi < 25)   return 'وزن طبيعي'
  if (bmi < 30)   return 'زيادة وزن'
  return 'سمنة'
}

// ── Age calculator ────────────────────────────────────────────
export const calcAge = (birthday) => {
  if (!birthday) return null
  const today = new Date()
  const birth = new Date(birthday)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

// ── Challenge state manager ───────────────────────────────────
export const getTodayChallenges = (challengeState, dailyPool, weeklyPool, bossPool) => {
  const today = todayISO()
  const weekNum = Math.floor(Date.now() / (7 * 86400000))

  // Pick stable daily IDs (deterministic by date seed)
  let dailyIds = challengeState?.dailyIds
  let weeklyIds = challengeState?.weeklyIds
  let bossId = challengeState?.bossId

  if (!dailyIds || challengeState?.date !== today) {
    // Seeded random based on date
    const seed = parseInt(today.replace(/-/g, ''))
    const pick3 = (arr) => {
      const shuffled = [...arr].map((x, i) => ({ x, r: Math.sin(seed + i) }))
        .sort((a, b) => a.r - b.r).map(o => o.x)
      return shuffled.slice(0, 3).map(c => c.id)
    }
    dailyIds = pick3(dailyPool)
  }

  if (!weeklyIds || challengeState?.week !== weekNum) {
    const seed = weekNum
    const pick2 = (arr) => {
      const shuffled = [...arr].map((x, i) => ({ x, r: Math.sin(seed + i * 7) }))
        .sort((a, b) => a.r - b.r).map(o => o.x)
      return shuffled.slice(0, 2).map(c => c.id)
    }
    weeklyIds = pick2(weeklyPool)
  }

  if (!bossId) {
    bossId = bossPool[weekNum % bossPool.length]?.id || bossPool[0]?.id
  }

  return { date: today, week: weekNum, dailyIds, weeklyIds, bossId }
}

// ── Notifications ─────────────────────────────────────────────
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)]

export const requestNotifPermission = async () => {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return await Notification.requestPermission()
}

export const scheduleNotificationsForToday = async (workoutTime, messages, workoutTimeHours) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const reg = await navigator.serviceWorker?.ready.catch(() => null)
  if (!reg) return

  const todayStamp = todayKey()
  if (localStorage.getItem('hf_notif_scheduled') === todayStamp) return
  localStorage.setItem('hf_notif_scheduled', todayStamp)

  const workoutHour = workoutTimeHours[workoutTime] ?? 17
  const schedule = [
    { hour: 8,           min: 0,  type: 'morning'   },
    { hour: 12,          min: 30, type: 'tip'        },
    { hour: 15,          min: 30, type: 'hydration'  },
    { hour: workoutHour, min: 0,  type: 'workout'    },
    { hour: 21,          min: 0,  type: 'evening'    },
  ]

  const now = new Date()
  schedule.forEach(({ hour, min, type }) => {
    const target = new Date(); target.setHours(hour, min, 0, 0)
    const delay = target - now
    if (delay > 0 && delay < 86400000) {
      setTimeout(async () => {
        try {
          const msg = pickRandom(messages[type])
          await reg.showNotification(msg.title, {
            body: msg.body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            dir: 'rtl', lang: 'ar',
            tag: type,
            vibrate: [100, 50, 100],
          })
        } catch {}
      }, delay)
    }
  })
}

// ── Export / Import ───────────────────────────────────────────
export const exportAllData = (sessions, xp, profile, unlockedAchievements, challengeState, photos) => {
  const data = {
    version: '2.1',
    exportDate: new Date().toISOString(),
    sessions, xp, profile, unlockedAchievements, challengeState, photos,
    // The streak and the rest-day balance are derived from these, not
    // stored. Left out of the backup, a restore came back with a broken
    // streak and no rest days, and no export could ever be audited.
    recovery: ls.get('hf_recovery', null),
  }
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `meran-backup-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export const importAllData = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    try { resolve(JSON.parse(e.target.result)) }
    catch { reject(new Error('ملف غير صالح')) }
  }
  reader.onerror = () => reject(new Error('خطأ في قراءة الملف'))
  reader.readAsText(file)
})

// ── Audio beep ────────────────────────────────────────────────
export const playBeep = (count = 3) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    Array.from({ length: count }).forEach((_, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.type = 'sine'
      o.frequency.value = i < count - 1 ? 660 : 880
      const t = ctx.currentTime + i * 0.2
      g.gain.setValueAtTime(0.4, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
      o.start(t); o.stop(t + 0.15)
    })
  } catch {}
}

// ── Calendar data builder ─────────────────────────────────────
export const buildCalendarData = (sessions, weeks = 14) => {
  const counts = {}
  sessions.forEach(s => {
    const d = dayKey(s.date)
    counts[d] = (counts[d] || 0) + 1
  })
  const end = new Date(); end.setHours(0, 0, 0, 0)
  const start = new Date(end); start.setDate(start.getDate() - weeks * 7 + 1)
  const days = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = dayKey(d)
    days.push({ iso, count: counts[iso] || 0 })
  }
  return days
}
