// ── Calendar-day helpers (LOCAL time) ─────────────────────────
// A workout belongs to the day it STARTED — session.date is stamped
// when the session begins and is never rewritten on finish, so a
// session started at 23:40 and finished at 00:20 still counts for the
// day it started.
//
// Day boundaries follow the user's OWN midnight. Keying days with
// toISOString() used UTC, which rolls over at 03:00 for UTC+3 — so a
// 01:00 workout landed on the previous day and the streak was judged
// against the wrong day.
//
// No imports here on purpose: both constants.js and utils.js need
// this, and utils.js already imports constants.js.

export const dayKey = (dateLike) => {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike)
  if (Number.isNaN(d.getTime())) return String(dateLike).split('T')[0]
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export const todayKey = () => dayKey(new Date())

// Local midnight of a YYYY-MM-DD key, as a timestamp
export const dayStart = (key) => {
  const [y, m, d] = String(key).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1).getTime()
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
