// ── The streak, as the user is told it ────────────────────────
//
// recovery.js decides the numbers; this file decides what they mean
// today and says it. Every surface that talks about the streak — the
// scoreboard on Home, the header chip, the skip sheet, the toasts —
// reads from here, so they cannot drift into four numbers under four
// names again, which is what the audit found.
//
// Nothing here is allowed to promise what the engine does not do:
//   · a deload does not protect the streak (recovery.js never reads it)
//   · «تخطي اليوم» only moves the plan; the day still wants a workout
//   · credits are spent automatically at 03:00, never by a tap
//   · the balance has no real ceiling (see usableCredits)
//
// Pure functions of (recovery, config, active, now). No storage, no
// React, so every line can be pinned in node tests.

import { DAY_STATUS, REST_CREDIT_EVERY, addDays } from './recovery.js'
import { dayKey, formatRemaining, isLateWindow, DAY_START_HOUR } from './day.js'

export const STREAK_MILESTONES = new Set([7, 10, 14, 21, 30, 40, 50, 60, 75, 90, 100, 120, 150, 180, 200, 250, 300, 365])

/** The next milestone above n, or null past the last one. */
export const nextMilestone = (n) => {
  const next = [...STREAK_MILESTONES].sort((a, b) => a - b).find(m => m > n)
  return next ?? null
}

// ── Arabic counting ───────────────────────────────────────────
// 1 and 2 are words, 3–10 take the plural, 11+ the singular. The app
// used to print «1 تمارين» and «2 أيام».
const NOUNS = {
  day:     { one: 'يوم واحد',   two: 'يومين',   few: 'أيام',   many: 'يوم' },
  ticket:  { one: 'تذكرة وحدة', two: 'تذكرتين', few: 'تذاكر',  many: 'تذكرة' },
  workout: { one: 'تمرين واحد', two: 'تمرينين', few: 'تمارين', many: 'تمرين' },
}
export const countAr = (n, noun) => {
  const f = NOUNS[noun]
  const k = Math.max(0, Math.round(Number(n) || 0))
  if (k === 1) return f.one
  if (k === 2) return f.two
  const r = k % 100
  if (k === 0 || (r >= 3 && r <= 10)) return `${k} ${f.few}`
  return `${k} ${f.many}`
}

/** The unit word alone, for a number drawn separately: «10 أيام»,
 *  «60 يوم», «1 يوم». (A digit 2 reads «2 يوم», never «2 يومين».) */
export const unitAr = (n, noun) => {
  const k = Math.max(0, Math.round(Number(n) || 0))
  const r = k % 100
  return (k === 0 || (r >= 3 && r <= 10)) ? NOUNS[noun].few : NOUNS[noun].many
}

// ── Dates ─────────────────────────────────────────────────────
// Gregorian, Western digits. fmtDate printed «٢٦ محرم» on the one
// notice that tells you a credit was spent.
const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const WEEKDAY_LETTER = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const utcDay = (iso) => { const [y, m, d] = String(iso).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)) }

/** «السبت 11 يوليو», or «11 يوليو» without the weekday. */
export const fmtDayAr = (iso, { weekday = true } = {}) => {
  if (!iso) return ''
  const dt = utcDay(iso)
  const day = `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`
  return weekday ? `${WEEKDAYS[dt.getUTCDay()]} ${day}` : day
}
export const weekdayLetter = (iso) => WEEKDAY_LETTER[utcDay(iso).getUTCDay()]

/** The moment a training day ends: 03:00 local on the next calendar day. */
export const dayEnds = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number)
  return new Date(y, m - 1, d + 1, DAY_START_HOUR, 0, 0, 0)
}

// ── What today is, for the streak ─────────────────────────────
/**
 * One word for today, read from the last ledger row — the same row the
 * number came from:
 *   fresh            no history at all
 *   reset            a second settings change today; today cannot count
 *   counted-trained  a session is saved on today
 *   counted-rest     the cycle's own rest day, counted from 03:00
 *   override         a rest day the user opened for training; still counted
 *   held             today is a paid day (only an old backup can do this)
 *   running          a session is open and not yet saved
 *   owed             a workout day with nothing saved yet
 */
export function todayStreak(recovery, { config = {}, active = null, today } = {}) {
  const ledger = recovery?.ledger || []
  const row = ledger[ledger.length - 1]
  if (config?.streakResetAt && config.streakResetAt === today) return 'reset'
  if (!row || row.date !== today) return active ? 'running' : 'fresh'
  if (row.kind === 'eligible') {
    if (row.completed) return 'counted-trained'
    return recovery?.isOverride ? 'override' : 'counted-rest'
  }
  if (row.kind === 'paid') return 'held'
  return active ? 'running' : 'owed'
}

export const COUNTED = new Set(['counted-trained', 'counted-rest', 'override', 'held'])

/** What a miss today would cost: a ticket, the streak, or nothing. */
export const missWouldCost = (recovery) =>
  (recovery?.usableCredits ?? 0) >= 1 ? 'ticket'
    : (recovery?.consistencyStreak || 0) > 0 ? 'break'
    : 'nothing'

/** The run of paid days that ends yesterday: {count, from, to}. */
export function heldRun(recovery, today) {
  const ledger = recovery?.ledger || []
  const yesterday = addDays(today, -1)
  let count = 0, from = null, to = null
  for (let i = ledger.length - 1; i >= 0; i--) {
    const r = ledger[i]
    if (r.date === today) continue
    if (r.date > yesterday) continue
    if (r.kind !== 'paid' || !r.inRun) break
    if (!to) to = r.date
    from = r.date
    count++
  }
  if (to && to !== yesterday) return { count: 0, from: null, to: null }
  return { count, from, to }
}

// ── The last seven days ───────────────────────────────────────
/**
 * Seven cells, oldest first, today last. Each says what the day was
 * and what it did to the number:
 *   trained +1 · rest +1 · credit 0 · missed «كسر» (the miss that ended a
 *   run) · idle (a missed day with no streak left to lose) · out
 *   today-pending · today-done (+1) · today-reset
 */
export function chain7(recovery, { config = {}, today } = {}) {
  const byDate = new Map((recovery?.ledger || []).map(r => [r.date, r]))
  const cells = []
  for (let i = 6; i >= 0; i--) {
    const date = addDays(today, -i)
    const r = byDate.get(date)
    const isToday = i === 0
    let kind = 'out', delta = '', rest = false
    if (isToday) {
      if (config?.streakResetAt === today) kind = 'today-reset'
      else if (r && r.inRun && r.kind === 'eligible') { kind = 'today-done'; delta = '+1'; rest = !r.completed }
      else if (r && r.inRun && r.kind === 'paid') { kind = 'credit'; delta = '0' }
      else kind = 'today-pending'
    } else if (r) {
      if (r.kind === 'miss') { kind = r.broke ? 'missed' : 'idle'; delta = r.broke ? 'كسر' : '' }
      else if (!r.inRun) kind = 'out'
      else if (r.kind === 'paid') { kind = 'credit'; delta = '0' }
      else { kind = r.completed ? 'trained' : 'rest'; delta = '+1' }
    }
    cells.push({ date, kind, delta, rest, isToday, letter: isToday ? 'اليوم' : weekdayLetter(date) })
  }
  return cells
}

// ── The words ─────────────────────────────────────────────────
function tomorrowLine(recovery) {
  if (recovery?.tomorrowExpected === DAY_STATUS.RECOVERY) return 'بكرة راحة مجدولة، تنحسب لحالها'
  const w = recovery?.workoutsBeforeRest || 0
  if (w <= 1) return 'بكرة يوم تمرين، وبعده راحة'
  return `بكرة يوم تمرين — ${countAr(w, 'workout')} قبل الراحة`
}

function costLine(recovery, n) {
  const usable = recovery?.usableCredits ?? 0
  const cost = missWouldCost(recovery)
  // Short enough for one line on a 390pt phone: the board has to leave
  // the start button above the tab bar. When the next ticket comes is
  // already on the ticket row, so it is not repeated here.
  if (cost === 'ticket') {
    return usable - 1 > 0
      ? `لو فاتك تنصرف تذكرة (يبقى ${countAr(usable - 1, 'ticket')})`
      : 'لو فاتك تنصرف آخر تذكرة'
  }
  if (cost === 'break') {
    if ((recovery?.creditsEarned || 0) === 0) return 'ما عندك تذاكر لسا — لو فاتك يرجع صفر'
    return `خلصت تذاكرك — لو فاتك يرجع ${n} إلى صفر`
  }
  return ''
}

/**
 * Everything the scoreboard and the chip show, for this moment.
 * `now` is a Date; the countdown is computed from it, so the caller
 * re-renders once a minute.
 */
export function streakView({ recovery, config = {}, active = null, deload = null, now = new Date(), today: todayIn = null } = {}) {
  // The day comes from the ledger the numbers were built for, never
  // from this function's own clock: at 03:00 the clock turns a moment
  // before the app recomputes, and pairing the new day with yesterday's
  // ledger read as a fresh install with yesterday broken.
  const ledgerDay = recovery?.ledger?.length ? recovery.ledger[recovery.ledger.length - 1].date : null
  const today = todayIn || ledgerDay || dayKey(now)
  const kind = todayStreak(recovery, { config, active, today })
  const n = recovery?.consistencyStreak || 0
  const usable = recovery?.usableCredits ?? 0
  const cost = missWouldCost(recovery)
  const ends = dayEnds(today)
  const late = isLateWindow(now) && now < ends
  const remaining = formatRemaining(ends - now)
  const held = heldRun(recovery, today)
  const hasHistory = (recovery?.ledger || []).length > 0

  const v = {
    kind, number: n, counted: COUNTED.has(kind), today,
    status: '', statusWarn: false, note: '', detail: '',
    countdown: null, lateTail: '', cost: '',
    tone: 'calm', badge: null, badgeTone: null,
    tickets: usable, ticketsText: usable > 0 ? countAr(usable, 'ticket') : `0 تذاكر · الجاية بعد ${countAr(recovery?.daysToNextCredit ?? REST_CREDIT_EVERY, 'day')}`,
    next: nextMilestone(n),
    chain: chain7(recovery, { config, today }),
    deload: deload?.active ? { day: deload.day, total: deload.totalDays } : null,
  }

  switch (kind) {
    case 'fresh':
      v.status = 'سجّل أول جلسة ويبدأ ستريكك من 1'
      v.detail = 'أول جلسة تحفظها تبدأ ستريكك، وأيام الراحة المجدولة تنحسب لك بعدها'
      break
    case 'reset':
      v.status = 'اليوم ما ينحسب — العدّ يبدأ بكرة'
      v.detail = 'بدأ ستريك جديد بعد تغيير الخطة'
      v.tone = 'restart'
      break
    case 'counted-trained':
      v.status = `انحسب اليوم — ستريكك ${n}`
      v.detail = tomorrowLine(recovery)
      v.tone = 'done'
      break
    case 'counted-rest':
      v.status = 'راحة مجدولة — انحسبت لك من 3 الفجر'
      v.detail = `ما عليك شي اليوم · ${tomorrowLine(recovery)}`
      v.tone = 'rest'; v.badge = 'moon'; v.badgeTone = 'rest'
      break
    case 'override':
      v.status = 'اليوم راحة مجدولة وانحسب — تمرينك زيادة'
      v.detail = 'لو ما تمرّنت ما يضرّك شي · ولو تمرّنت تنتقل الراحة لبكرة'
      v.tone = 'rest'; v.badge = 'moon'; v.badgeTone = 'rest'
      break
    case 'held':
      v.status = `اليوم مغطّى بتذكرة — يوقف على ${n}`
      v.detail = 'بكرة يرجع يزيد'
      v.tone = 'rest'; v.badge = 'ticket'; v.badgeTone = 'rest'
      break
    case 'running':
    case 'owed': {
      v.cost = costLine(recovery, n)
      if (kind === 'running') {
        // A session counts for the day it started, whenever it ends, so
        // there is no deadline to show and nothing at risk while it runs.
        const crossed = dayKey(now) !== today
        v.status = crossed
          ? `الجلسة شغّالة — تنحسب لـ${fmtDayAr(today)} لما تضغط «إنهاء التمرين»`
          : 'الجلسة شغّالة — تنحسب لما تضغط «إنهاء التمرين»'
        v.detail = n > 0 ? `لما تنحفظ يصير ستريكك ${n + 1}` : 'لما تنحفظ يبدأ ستريكك من 1'
        v.cost = ''
        break
      } else if (n === 0) {
        v.status = 'باقي تمرين اليوم — يبدأ ستريكك من 1'
        if (hasHistory) v.tone = 'restart'
      } else if (held.count) {
        v.status = `باقي تمرين اليوم — يرجع يزيد: ${n + 1}`
      } else {
        v.status = `باقي تمرين اليوم — يخلّيه ${n + 1}`
      }

      if (late && kind === 'owed' && cost !== 'nothing') {
        v.countdown = remaining
        v.badge = 'hourglass'
        if (cost === 'break') {
          v.status = `بدون تمرين الليلة يرجع ${n} إلى صفر`
          v.statusWarn = true; v.tone = 'warning'; v.badgeTone = 'streak'
          v.lateTail = 'ابدأ قبل 3 وتنحسب حتى لو خلصت بعدها'
        } else {
          v.status = `لو فاتك الليلة تنصرف تذكرة ويوقف على ${n}`
          v.badgeTone = 'rest'
          v.lateTail = usable - 1 > 0 ? `يبقى لك ${countAr(usable - 1, 'ticket')}` : 'وتخلص تذاكرك'
        }
      } else {
        v.countdown = remaining
      }

      // The dates are in the spend notice and on the seven days below;
      // here, only what it did.
      if (held.count === 1) {
        v.note = `تذكرة غطّت أمس — وقف على ${n}، ما زاد ولا انكسر.`
      } else if (held.count > 1) {
        v.note = `${countAr(held.count, 'day')} ورا بعض غطّتها التذاكر — الستريك واقف على ${n}.`
      } else if (v.deload && cost !== 'nothing') {
        v.note = 'ديلود: الوزن أخف، والحساب نفسه.'
      }
      if (held.count && !v.badge) { v.badge = 'ticket'; v.badgeTone = 'rest' }
      break
    }
  }

  v.aria = [
    `الستريك ${n} ${unitAr(n, 'day')}`,
    v.status,
    usable > 0 ? `عندك ${countAr(usable, 'ticket')}` : 'ما عندك تذاكر',
  ].join('، ')
  return v
}

// ── The other places the streak speaks ────────────────────────

/** The sheet before «تخطي اليوم», and the toast after it. */
export function skipCopy(view) {
  const n = view.number
  const counted = view.counted
  let body
  if (counted) body = 'اليوم محسوب لك، والخطة بس تنتقل لليوم الجاي.'
  else if (missWouldCost({ usableCredits: view.tickets, consistencyStreak: n }) === 'ticket') {
    body = view.tickets - 1 > 0
      ? `الستريك لسا يبي تمرين اليوم. لو ما تمرّنت لين 3 الفجر تنصرف تذكرة ويوقف على ${n} (يبقى ${countAr(view.tickets - 1, 'ticket')}).`
      : `الستريك لسا يبي تمرين اليوم. لو ما تمرّنت لين 3 الفجر تنصرف آخر تذكرة ويوقف على ${n}.`
  } else if (n > 0) {
    body = `الستريك لسا يبي تمرين اليوم. لو ما تمرّنت لين 3 الفجر يرجع ${n} إلى صفر.`
  } else {
    body = 'الخطة تنتقل لليوم الجاي، وما عندك ستريك تخسره اليوم.'
  }
  return {
    title: 'تخطي اليوم ينقل الخطة بس',
    body,
    warn: !counted && n > 0,
    confirm: 'انقل الخطة',
    cancel: 'رجوع',
    toast: counted
      ? 'انتقلت الخطة لليوم الجاي — اليوم محسوب لك'
      : 'انتقلت الخطة لليوم الجاي — اليوم لسا يوم تمرين',
  }
}

/** The line after «إنهاء التمرين». `before` is todayStreak() from just
 *  before the save; `after` the recovery with the session in it. */
export function finishToast({ before, after, sessionDay, today }) {
  const n = after?.consistencyStreak || 0
  if (before === 'reset') return 'انحفظت الجلسة — اليوم ما ينحسب بعد تغيير الخطة، العدّ يبدأ بكرة'
  if (sessionDay && today && sessionDay !== today) {
    // Ask the ledger whether that day counted rather than assume it: a
    // plan reset excludes its own day.
    const row = after?.ledger?.find(r => r.date === sessionDay)
    if (!row?.inRun || !row.streakDelta) {
      return `انحفظت الجلسة — ${fmtDayAr(sessionDay)} ما ينحسب بعد تغيير الخطة · ستريكك ${n}`
    }
    return `انحسب ${fmtDayAr(sessionDay)} — بدأتها قبل 3 الفجر · ستريكك ${n}`
  }
  if (before === 'counted-rest' || before === 'override') return 'انحفظت الجلسة — اليوم كان محسوب، والراحة انتقلت لبكرة'
  // Training on a day a ticket held turns it into a counted day and
  // gives the ticket back.
  if (before === 'held') return `انحسب اليوم — ستريكك ${n}، ورجعت لك التذكرة`
  if (before === 'counted-trained') return 'انحفظت الجلسة — اليوم كان محسوب'
  return `انحسب اليوم — ستريكك ${n}`
}

/** The notice when the engine spent tickets on its own. */
export function spendToast(days, recovery) {
  const n = recovery?.consistencyStreak || 0
  const usable = recovery?.usableCredits ?? 0
  const left = usable > 0 ? `باقي ${countAr(usable, 'ticket')}` : 'وخلصت تذاكرك'
  if (days.length === 1) return `انصرفت تذكرة عن ${fmtDayAr(days[0])} — الستريك وقف على ${n}. ${left}`
  const sorted = [...days].sort()
  return `انصرفت ${countAr(days.length, 'ticket')} (${fmtDayAr(sorted[0], { weekday: false })} – ${fmtDayAr(sorted[sorted.length - 1], { weekday: false })}) — الستريك وقف على ${n}. ${left}`
}
