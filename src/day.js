// ── Calendar-day helpers (LOCAL time) ─────────────────────────
// A workout belongs to the day it STARTED — session.date is stamped
// when the session begins and is never rewritten on finish.
//
// The training day ends at 03:00, not midnight. The gym closes at
// three and a late session is common: at midnight-to-midnight, a
// session at 01:00 landed on the next day, so the day it really
// belonged to read as a missed workout day — spending a rest credit
// or breaking the streak — while the new day looked already trained.
// Every dated feature (streak, credits, deload, the month report,
// challenges, the greeting) reads days through dayKey, so the boundary
// lives here and only here.
//
// Days follow the user's OWN clock. Keying days with toISOString()
// used UTC and filed late sessions a day early.
//
// No imports here on purpose: both constants.js and utils.js need
// this, and utils.js already imports constants.js.

export const DAY_START_HOUR = 3

/** The plain local calendar date of a Date, with no day-boundary
 *  shift — for walking calendar cells, which are dates, not moments. */
export const calendarKey = (d) => {
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** The training day a moment belongs to. */
export const dayKey = (dateLike) => {
  // A key is already a day. Never shift it again — and never hand it
  // to new Date(), which reads 'YYYY-MM-DD' as UTC midnight.
  if (typeof dateLike === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateLike)) return dateLike
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike)
  if (Number.isNaN(d.getTime())) return String(dateLike).split('T')[0]
  return calendarKey(new Date(d.getTime() - DAY_START_HOUR * 3600000))
}

export const todayKey = () => dayKey(new Date())

// Local midnight of a YYYY-MM-DD key, as a timestamp
export const dayStart = (key) => {
  const [y, m, d] = String(key).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1).getTime()
}

/** The next moment the training day turns over (03:00 local). */
export const nextDayTurn = (now = new Date()) => {
  const t = new Date(now)
  t.setHours(DAY_START_HOUR, 0, 0, 0)
  if (t <= now) t.setDate(t.getDate() + 1)
  return t
}

// ── Arabic-Indic numerals ─────────────────────────────────────
// Typing ١٢٥ on an Arabic keyboard should just work — no switching
// languages to enter a weight. Maps Arabic-Indic (٠-٩) and Extended
// Arabic/Persian (۰-۹) digits to ASCII, plus the Arabic decimal mark.
const AR_DIGITS = { '\u0660':'0','\u0661':'1','\u0662':'2','\u0663':'3','\u0664':'4',
                    '\u0665':'5','\u0666':'6','\u0667':'7','\u0668':'8','\u0669':'9',
                    '\u06F0':'0','\u06F1':'1','\u06F2':'2','\u06F3':'3','\u06F4':'4',
                    '\u06F5':'5','\u06F6':'6','\u06F7':'7','\u06F8':'8','\u06F9':'9',
                    '\u066B':'.', '\u066C':'', '\u060C':'' }

export const toWesternDigits = (value) => {
  if (value === null || value === undefined) return value
  const str = String(value)
  let out = ''
  for (const ch of str) out += (ch in AR_DIGITS ? AR_DIGITS[ch] : ch)
  return out
}
