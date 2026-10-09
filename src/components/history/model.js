// ── السجل — the numbers behind the history tab ────────────────
//
// Pure functions of the saved sessions: no React, no storage, so every
// line the tab prints can be pinned in a node test. Nothing here writes
// or reshapes stored data; it only reads what is already there.
//
//   · weeks are TRAINING weeks: a session belongs to its dayKey (the
//     03:00 turn), and the week starts on Saturday, as the Saudi week does
//   · dates are Gregorian with Western digits («الأحد 5 أكتوبر»), from
//     the same fmtDayAr the streak uses, never toLocaleDateString('ar-SA')
//   · the day is named in Arabic: Push → دفع, Pull → سحب, Legs → أرجل
//   · gold marks the session where an exercise's all-time best weight
//     was first lifted, and nowhere else

import { dayKey } from '../../day.js'
import { fmtDayAr } from '../../streak.js'
import { planDayType, resolveExerciseName, fmtDuration } from '../../utils.js'
import { setCounts, sessionVolume } from '../../sets.js'
import { MUSCLE_GROUPS } from '../../constants.js'

// ── Arabic counting ───────────────────────────────────────────
// 1 and 2 are words, 3–10 take the plural, 11+ the singular — the rule
// streak.js uses for days and tickets.
const NOUNS = {
  session:  { one: 'جلسة وحدة',    two: 'جلستين',    few: 'جلسات',   many: 'جلسة' },
  set:      { one: 'مجموعة وحدة',  two: 'مجموعتين',  few: 'مجموعات', many: 'مجموعة' },
  exercise: { one: 'تمرين واحد',   two: 'تمرينين',   few: 'تمارين',  many: 'تمرين' },
}

/** { n, word } for a count: n is null when the word already says it
 *  («جلستين»), so the caller draws the digit only when there is one. */
export const countParts = (n, noun) => {
  const f = NOUNS[noun]
  const k = Math.max(0, Math.round(Number(n) || 0))
  if (k === 1) return { n: null, word: f.one }
  if (k === 2) return { n: null, word: f.two }
  const r = k % 100
  return { n: k, word: (k === 0 || (r >= 3 && r <= 10)) ? f.few : f.many }
}

/** The same count as one plain string, for labels and aria. */
export const countText = (n, noun) => {
  const p = countParts(n, noun)
  return p.n == null ? p.word : `${p.n} ${p.word}`
}

// ── Training weeks (Saturday to Friday) ───────────────────────
const utcOf = (key) => { const [y, m, d] = String(key).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)) }
const keyOf = (dt) => dt.toISOString().slice(0, 10)

export const addDaysKey = (key, n) => {
  const dt = utcOf(key)
  dt.setUTCDate(dt.getUTCDate() + n)
  return keyOf(dt)
}

/** The Saturday that opens the training week a day belongs to. */
export const weekStartKey = (key) => {
  const wd = utcOf(key).getUTCDay()          // 0 Sunday … 6 Saturday
  return addDaysKey(key, -((wd + 1) % 7))
}

/** A week's name: «هذا الأسبوع», «الأسبوع الماضي», or its dates
 *  «21 – 27 يونيو» / «28 يونيو – 4 يوليو» (with the year when it is
 *  not this year's). */
export const weekLabel = (startKey, todayKey) => {
  const thisWeek = weekStartKey(todayKey)
  if (startKey === thisWeek) return 'هذا الأسبوع'
  if (startKey === addDaysKey(thisWeek, -7)) return 'الأسبوع الماضي'
  const endKey = addDaysKey(startKey, 6)
  const [sy, sm] = startKey.split('-')
  const [ey, em] = endKey.split('-')
  const thisYear = todayKey.slice(0, 4)
  const yearTail = ey !== thisYear ? ` ${ey}` : ''
  if (sy !== ey) return `${fmtDayAr(startKey, { weekday: false })} ${sy} – ${fmtDayAr(endKey, { weekday: false })} ${ey}`
  if (sm === em) return `${Number(startKey.slice(8))} – ${fmtDayAr(endKey, { weekday: false })}${yearTail}`
  return `${fmtDayAr(startKey, { weekday: false })} – ${fmtDayAr(endKey, { weekday: false })}${yearTail}`
}

/** A session's training day and its date as the tab prints it. */
export const sessionDay = (s) => dayKey(s?.date)
export const sessionDateText = (s, todayKey) => {
  const k = sessionDay(s)
  if (!k || !/^\d{4}-\d{2}-\d{2}$/.test(k)) return ''
  const base = fmtDayAr(k)
  return todayKey && k.slice(0, 4) !== todayKey.slice(0, 4) ? `${base} ${k.slice(0, 4)}` : base
}

// ── What a session did ────────────────────────────────────────
const doneSets = (ex) => (ex?.sets || []).filter(setCounts)
export const doneExercises = (s) => (s?.exercises || []).filter(ex => doneSets(ex).length > 0)
export const sessionSetCount = (s) => (s?.exercises || []).reduce((t, ex) => t + doneSets(ex).length, 0)
/** Ticked sets only — the same count every other volume in the app uses. */
export const sessionTonnage = sessionVolume

/** The heaviest done set (more reps breaks a tie), or the set with the
 *  most reps when nothing carried a weight. */
export const bestSet = (ex) => {
  let best = null
  for (const s of doneSets(ex)) {
    const w = parseFloat(s.weight) || 0
    const r = parseInt(s.reps) || 0
    if (!best || w > best.weight || (w === best.weight && r > best.reps)) best = { weight: w, reps: r }
  }
  return best
}

/**
 * Where each exercise's all-time best weight was first lifted:
 * Map<canonical name, session id>. Only a weight that beat an earlier
 * one is a record — the first time an exercise is logged sets the
 * baseline, so a new user's first session is not painted gold. Deload
 * sessions are light by design and can never hold the record; sessions
 * before a weights reset («تصفير الأوزان», resetAt) do not count, as in
 * getHistoricalMax.
 */
export const firstBestSessions = (sessions = [], mapping = {}, resetAt = 0) => {
  const best = new Map()       // name → { weight, id (null for the baseline) }
  const ordered = [...sessions].sort((a, b) => (Date.parse(a.date) || a.id || 0) - (Date.parse(b.date) || b.id || 0))
  for (const s of ordered) {
    if (!s || s.deload || (s.id || 0) < resetAt) continue
    for (const ex of s.exercises || []) {
      const w = Math.max(0, ...doneSets(ex).map(x => parseFloat(x.weight) || 0))
      if (!(w > 0)) continue
      const name = resolveExerciseName(ex.name, mapping)
      const cur = best.get(name)
      if (!cur) best.set(name, { weight: w, id: null })
      else if (w > cur.weight) best.set(name, { weight: w, id: s.id })
    }
  }
  const out = new Map()
  for (const [name, v] of best) if (v.id != null) out.set(name, v.id)
  return out
}

/** Is this the session where `ex` first reached its all-time best? */
export const isFirstBest = (firsts, session, ex, mapping = {}) =>
  !!session && firsts.get(resolveExerciseName(ex?.name, mapping)) === session.id

// ── Naming the day ────────────────────────────────────────────
// The plan names its days in English ('Push — صدر، أكتاف، ترايسبس',
// 'Upper A — …', 'Push Day'); the tab says them in Arabic.
const DAY_WORDS = {
  push: 'دفع', pull: 'سحب', legs: 'أرجل', leg: 'أرجل', lower: 'سفلي', upper: 'علوي',
  'full body': 'جسم كامل', fullbody: 'جسم كامل', full: 'جسم كامل',
  chest: 'صدر', back: 'ظهر', shoulders: 'أكتاف', arms: 'ذراعين', core: 'بطن', cardio: 'كارديو',
}

/** «Push A» → «دفع A»; an Arabic label stays as it is; an unknown
 *  English one is kept rather than guessed. */
export const dayWordOf = (label) => {
  const raw = String(label || '').replace(/\s*day$/i, '').trim()
  if (!raw) return ''
  const m = raw.match(/^(full body|[a-z]+)\s*([a-z0-9]{0,2})$/i)
  if (m) {
    const word = DAY_WORDS[m[1].toLowerCase()]
    if (word) return m[2] ? `${word} ${m[2].toUpperCase()}` : word
  }
  return raw
}

const bare = (label) => String(label || '').replace(/^ال/, '')

/** «صدر» · «صدر وترايسبس» · «صدر، أكتاف وترايسبس». */
export const musclePhrase = (muscles = []) => {
  const names = [...new Set(muscles)].map(m => bare(MUSCLE_GROUPS[m]?.label || m)).filter(Boolean)
  if (names.length <= 1) return names[0] || ''
  return `${names.slice(0, -1).join('، ')} و${names[names.length - 1]}`
}

/** «Pull — ظهر، بايسبس» → «سحب — ظهر، بايسبس»; the muscles part falls
 *  back to the given phrase, and «Legs — أرجل» does not say أرجل twice. */
const nameDay = (source, exercises, fallbackMuscles) => {
  const [head, ...rest] = String(source || '').split('—')
  const tail = rest.join('—').trim()
  const word = dayWordOf(planDayType({ name: head, exercises }) || head)
  const what = tail || fallbackMuscles
  if (word && what && word !== what) return `${word} — ${what}`
  return word || what || ''
}

/**
 * A session's title: «سحب — ظهر وبايسبس» for a plan day (or a named
 * session), the muscles alone for a free one, «جلسة حرة» when there is
 * nothing to go on.
 */
export const sessionTitle = (s, { planned = false } = {}) => {
  // A saved session is named by what was done; one still running, by
  // what it holds.
  const muscles = musclePhrase((planned ? (s?.exercises || []) : doneExercises(s)).map(ex => ex.muscle))
  const source = s?.planDayName || s?.name
  return (source ? nameDay(source, s.exercises, muscles) : muscles) || 'جلسة حرة'
}

/** A plan day's title before it is trained: same voice as above. */
export const planDayTitleAr = (day) => {
  if (!day) return ''
  return nameDay(day.name, day.exercises, musclePhrase((day.exercises || []).map(ex => ex.muscle))) || 'تمرين اليوم'
}

// ── Ready-made routines (ROUTINES in constants.js) ────────────
// Their stored names are English with an emoji tail ('Pull Day 🗂️',
// 'Upper Body 🏆'); the picker says them in the same voice as the
// history: «سحب — ظهر وبايسبس». A day word the muscles already say
// («صدر» before «صدر وترايسبس») is said once, and an English word with
// no Arabic match is dropped rather than shown.
export const routineTitle = (r) => {
  const clean = String(r?.name || '').replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim()
  const key = /^full\s*body/i.test(clean) ? clean : clean.replace(/\s*body$/i, '')
  const word = dayWordOf(key)
  const what = musclePhrase(r?.muscles?.length ? r.muscles : (r?.exercises || []).map(ex => ex.muscle))
  if (!word || /^[\x20-\x7E]+$/.test(word)) return what || 'روتين'
  if (!what || what === word || what.startsWith(word)) return what || word
  return `${word} — ${what}`
}

/** How many sets a routine starts with (3 for an exercise that says none). */
export const routineSetCount = (r) =>
  (r?.exercises || []).reduce((t, ex) => t + (Number(ex.defaultSets || ex.sets) || 3), 0)

// ── Durations ─────────────────────────────────────────────────
/** «48 دقيقة», «ساعة و5 دقيقة» (utils.fmtDuration); '' when the session has none. */
export const durationText = (minutes) => {
  if (minutes == null || minutes === '' || Number.isNaN(Number(minutes))) return ''
  return fmtDuration(minutes)
}

/** «5.7 طن» from a kilogram total, or «850 كجم» under a ton. */
export const tonnageText = (kg) => {
  const v = Number(kg) || 0
  if (v <= 0) return ''
  if (v < 1000) return `${Math.round(v).toLocaleString('en-US')} كجم`
  return `${(v / 1000).toFixed(1).replace(/\.0$/, '')} طن`
}

// ── The feed ──────────────────────────────────────────────────
/**
 * Sessions newest first, grouped into training weeks:
 * [{ key, label, sessions: [...] }]. Week totals are left to the
 * caller, which knows which rows are on screen.
 */
export const groupByWeek = (sessions = [], todayKey) => {
  const sorted = [...sessions].sort((a, b) => {
    const ka = sessionDay(a), kb = sessionDay(b)
    if (ka !== kb) return ka < kb ? 1 : -1
    return (b.id || 0) - (a.id || 0)
  })
  const weeks = []
  let cur = null
  for (const s of sorted) {
    const day = sessionDay(s)
    const key = /^\d{4}-\d{2}-\d{2}$/.test(day) ? weekStartKey(day) : 'unknown'
    if (!cur || cur.key !== key) {
      cur = { key, label: key === 'unknown' ? 'بدون تاريخ' : weekLabel(key, todayKey), sessions: [] }
      weeks.push(cur)
    }
    cur.sessions.push(s)
  }
  return weeks
}

/** «3 جلسات · 5.7 طن» for the rows of a week. */
export const weekTotalsText = (sessions = []) => {
  if (!sessions.length) return ''
  const tons = tonnageText(sessions.reduce((t, s) => t + sessionTonnage(s), 0))
  return [countText(sessions.length, 'session'), tons].filter(Boolean).join(' · ')
}
