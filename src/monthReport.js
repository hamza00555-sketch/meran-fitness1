// ── Monthly report ────────────────────────────────────────────
// One month of training, derived in one pass and handed to the UI as
// plain data. No React, no DOM, no storage — so it runs under
// `node --test` and the numbers can be checked without a browser.
//
// Everything here reuses the engines that already decide these facts
// elsewhere in the app: sessionVolume for tonnage, computeRecovery for
// the day-by-day calendar, analyzeProgression for whether a lift is
// stalling. The report must never disagree with the screen that shows
// the same number.

import { dayKey } from './day.js'
import {
  sessionVolume, resolveExerciseName, getWeightsResetAt,
  xpProgress, getRank,
} from './utils.js'
import { analyzeProgression, isCompleted, DEFAULT_REP_TARGET } from './progression.js'
import { computeRecovery, MAX_REST_CREDITS } from './recovery.js'
import { MUSCLE_GROUPS, ACHIEVEMENTS } from './constants.js'

// ── Calendar arithmetic ───────────────────────────────────────

/** 'YYYY-MM' for anything date-like, on the user's own midnight. */
export const monthKey = (dateLike) => dayKey(dateLike).slice(0, 7)

export const daysInMonth = (month) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export const prevMonth = (month) => {
  const [y, m] = month.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

const MONTH_NAMES = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

export const monthLabel = (month) => {
  const [y, m] = month.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

/** The cover slot for a month — one piece of art per calendar month. */
export const coverSlot = (month) => `cover_${month.slice(5, 7)}`

// ── When the button is offered ────────────────────────────────
// The report is about a month that has finished, so it appears while
// that is still fresh: the last two days of the month (the result is
// settled by then) and the first week of the next one.
//
// Pure on purpose — the date window is the one piece of this feature
// that is painful to test through a browser clock.
export const REPORT_WINDOW_TAIL = 2   // last N days of the month itself
export const REPORT_WINDOW_HEAD = 7   // first N days of the month after

/** The month a report should cover today, or null when out of window. */
export function monthReportWindow(today) {
  const key = dayKey(today)
  const month = key.slice(0, 7)
  const day = Number(key.slice(8, 10))

  if (day <= REPORT_WINDOW_HEAD) return prevMonth(month)
  if (day > daysInMonth(month) - REPORT_WINDOW_TAIL) return month
  return null
}

// ── Volume, split the same way sessionVolume splits it ────────
// sessionVolume counts a set once it is either ticked or has a weight
// typed in. Per-muscle volume has to use the identical rule or the
// slices will not add up to the total.
const setVolume = (s) => {
  if (!s.done && !(parseFloat(s.weight) > 0)) return 0
  return (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0)
}

const exerciseVolume = (ex) => (ex.sets || []).reduce((n, s) => n + setVolume(s), 0)

// A plan the user imported can carry any muscle string it likes. The
// home screen drops unknown ones on the floor; a report that quietly
// loses tonnage is worse than one that says "other".
const OTHER = { key: 'Other', label: 'أخرى', color: '#6B7280' }

const groupOf = (muscle) => {
  const g = MUSCLE_GROUPS[muscle]
  if (!g) return OTHER
  return { key: muscle, label: g.label, color: g.color }
}

// ── Personal records inside a date range ──────────────────────
// getHistoricalMax only knows the all-time best. A record is an event:
// the moment a weight beat everything before it. That needs a forward
// walk over the whole history, with the month used only as a filter on
// which events to report.
// One entry per exercise, not one per improvement. Adding 2kg every
// session is the whole point of the programme, and reporting each step
// as its own record buries the two lifts that actually moved under
// thirteen rows of the same squat. What a month's records mean is:
// this lift ended higher than it has ever been, and here is the jump.
function personalRecordsIn(sessions, month, mapping, resetAt) {
  const best = new Map()          // resolved name → heaviest before this month
  const gains = new Map()         // resolved name → the month's own high point

  const chronological = [...(sessions || [])]
    .filter(s => (s.id || 0) >= resetAt)
    .sort((a, b) => (a.id || 0) - (b.id || 0))

  for (const session of chronological) {
    const key = monthKey(session.date)
    if (key > month) break                   // the future cannot set this month's records
    const inMonth = key === month

    for (const ex of session.exercises || []) {
      const name = resolveExerciseName(ex.name, mapping)
      let top = 0
      for (const s of ex.sets || []) {
        if (!isCompleted(s)) continue        // a record has to be lifted, not typed
        top = Math.max(top, parseFloat(s.weight))
      }
      if (!top) continue

      if (!inMonth) {
        best.set(name, Math.max(best.get(name) || 0, top))
        continue
      }

      const bar = best.get(name) || 0
      // The first weight ever logged is a starting point, not a record.
      if (bar <= 0) { best.set(name, top); continue }

      const held = gains.get(name)
      if (top > bar && (!held || top > held.weight)) {
        gains.set(name, {
          exercise: ex.name,
          weight: top,
          prevBest: bar,
          date: dayKey(session.date),
          steps: (held?.steps || 0) + 1,
        })
      } else if (top > bar && held) {
        held.steps += 1
      }
    }
  }

  return [...gains.values()].sort((a, b) => (b.weight - b.prevBest) - (a.weight - a.prevBest))
}

// ── Consistency, read off the recovery ledger ─────────────────
// computeRecovery already classifies every day as eligible / paid /
// miss and we trust that classification everywhere else, so the report
// filters it rather than re-deriving it.
function consistencyIn(sessions, config, month) {
  const lastDay = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`
  const recovery = computeRecovery(sessions, config, lastDay)
  const rows = (recovery.ledger || []).filter(r => r.date.startsWith(month))

  let trainedDays = 0, scheduledRests = 0, paidRests = 0
  const missedDays = []
  let run = 0, bestStreak = 0

  for (const r of rows) {
    if (r.kind === 'miss') { missedDays.push(r.date); run = 0; continue }
    if (r.kind === 'paid') { paidRests++; continue }          // holds the run, adds nothing
    if (r.completed) trainedDays++
    else scheduledRests++
    run++
    if (run > bestStreak) bestStreak = run
  }

  return {
    trainedDays, scheduledRests, paidRests,
    missedDays,
    bestStreak,
    endStreak: recovery.consistencyStreak,
    restCredits: recovery.restCredits,
    calendar: rows.map(r => ({
      date: r.date,
      kind: r.completed ? 'trained' : r.kind === 'paid' ? 'paid' : r.kind === 'miss' ? 'miss' : 'rest',
    })),
    // Which weekday gets skipped most — 0 is Sunday, matching Date.getDay.
    weakestWeekday: (() => {
      if (missedDays.length < 2) return null
      const tally = new Array(7).fill(0)
      for (const d of missedDays) {
        const [y, m, dd] = d.split('-').map(Number)
        tally[new Date(y, m - 1, dd).getDay()]++
      }
      const top = Math.max(...tally)
      return top >= 2 ? { day: tally.indexOf(top), count: top } : null
    })(),
  }
}

// ── The report ────────────────────────────────────────────────

export function buildMonthReport({
  sessions = [],
  config = {},
  unlockedAt = {},
  xp = 0,
  mapping = {},
  repTarget = DEFAULT_REP_TARGET,
  month,
} = {}) {
  const resetAt = getWeightsResetAt()
  const inMonth = sessions.filter(s => monthKey(s.date) === month)
  const label = monthLabel(month)

  if (!inMonth.length) {
    return { month, monthLabel: label, cover: coverSlot(month), hasData: false, sessionCount: 0 }
  }

  // ── Volume, sets, reps, time ──
  const total = inMonth.reduce((n, s) => n + sessionVolume(s), 0)
  const prev = sessions.filter(s => monthKey(s.date) === prevMonth(month))
  const prevTotal = prev.reduce((n, s) => n + sessionVolume(s), 0)

  let setsTotal = 0, setsCompleted = 0, repsTotal = 0
  for (const s of inMonth) {
    for (const ex of s.exercises || []) {
      for (const set of ex.sets || []) {
        const counted = set.done || parseFloat(set.weight) > 0
        if (!counted) continue
        setsTotal++
        if (isCompleted(set)) { setsCompleted++; repsTotal += parseInt(set.reps) || 0 }
      }
    }
  }

  const timed = inMonth.filter(s => s.duration > 0)
  const totalMinutes = timed.reduce((n, s) => n + s.duration, 0)

  // ── The month's shape ──
  // One point per training day, oldest first, so the chart traces the
  // month as it was actually lived. Days are merged rather than
  // sessions listed: two sessions on one day is one day's work, and
  // plotting them as two points would draw a spike that never
  // happened.
  const byDay = new Map()
  for (const s of inMonth) {
    const key = dayKey(s.date)
    byDay.set(key, (byDay.get(key) || 0) + sessionVolume(s))
  }
  const series = [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, value]) => ({ date, value: Math.round(value) }))

  // The direction the month moved, as the slope of a least-squares fit
  // through those points. A first-to-last comparison would call a month
  // that dipped once at the end a decline; the fit answers for every
  // session, which is what "trending up or down" actually means.
  const slope = (() => {
    const n = series.length
    if (n < 3) return 0
    const meanX = (n - 1) / 2
    const meanY = series.reduce((a, p) => a + p.value, 0) / n
    let num = 0, den = 0
    for (let i = 0; i < n; i++) {
      num += (i - meanX) * (series[i].value - meanY)
      den += (i - meanX) ** 2
    }
    return den ? num / den : 0
  })()

  // ── Muscles ──
  const byMuscle = new Map()
  for (const s of inMonth) {
    for (const ex of s.exercises || []) {
      const v = exerciseVolume(ex)
      if (!v) continue
      const g = groupOf(ex.muscle)
      const row = byMuscle.get(g.key) || { ...g, volume: 0, sessions: 0 }
      row.volume += v
      byMuscle.set(g.key, row)
    }
  }
  const muscles = [...byMuscle.values()]
    .map(m => ({ ...m, pct: total ? Math.round((m.volume / total) * 100) : 0 }))
    .sort((a, b) => b.volume - a.volume)

  const volumeOf = (...keys) => keys.reduce((n, k) => n + (byMuscle.get(k)?.volume || 0), 0)
  const push = volumeOf('Chest', 'Shoulders', 'Triceps')
  const pull = volumeOf('Back', 'Biceps')

  // ── Progress ──
  const { level } = xpProgress(xp)
  const achievements = Object.entries(unlockedAt)
    .filter(([, at]) => monthKey(new Date(at)) === month)
    .map(([id]) => ACHIEVEMENTS.find(a => a.id === id))
    .filter(Boolean)
    .map(a => ({ id: a.id, title: a.title, rarity: a.rarity, icon: a.icon, xp: a.xp }))

  const report = {
    month,
    monthLabel: label,
    cover: coverSlot(month),
    hasData: true,
    sessionCount: inMonth.length,

    volume: {
      total: Math.round(total),
      perSession: Math.round(total / inMonth.length),
      prevTotal: Math.round(prevTotal),
      // No previous month to compare against is not a 0% change.
      trendPct: prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null,
      // The month day by day, and which way it leaned overall.
      series,
      slope: Math.round(slope),
      direction: slope > 0 ? 'up' : slope < 0 ? 'down' : 'flat',
    },
    sets: {
      total: setsTotal,
      completed: setsCompleted,
      untrackedPct: setsTotal ? Math.round(((setsTotal - setsCompleted) / setsTotal) * 100) : 0,
    },
    reps: { total: repsTotal },
    time: {
      // duration is absent on imported and in-progress sessions, so the
      // averages are only offered when at least two thirds of the month
      // has it. Compared as integers: ceil(3 * 0.67) is 3, which would
      // have failed two-timed-out-of-three.
      known: timed.length * 3 >= inMonth.length * 2,
      totalMinutes,
      avgMinutes: timed.length ? Math.round(totalMinutes / timed.length) : 0,
      sessionsTimed: timed.length,
    },
    prs: personalRecordsIn(sessions, month, mapping, resetAt),
    muscles,
    balance: {
      pushPull: pull > 0 ? Math.round((push / pull) * 100) / 100 : null,
      dominant: muscles[0] || null,
      neglected: muscles.length > 1 ? muscles[muscles.length - 1] : null,
    },
    consistency: consistencyIn(sessions, config, month),
    progress: {
      level,
      rank: getRank(level),
      achievements,
    },
  }

  report.tips = buildTips(report, { sessions, mapping, repTarget, month })
  return report
}

// ── Tips ──────────────────────────────────────────────────────
// Rule-based and computed from the month that just happened, so the
// report works offline and every line can point at the number that
// produced it. `evidence` is that number: advice without it is just
// an opinion.
//
// Severity orders the list; only the strongest few are shown, because
// a report that lists eleven faults is a scolding, not a report.
const SEV = { alert: 3, nudge: 2, praise: 1, info: 0 }

// ── Talking about a ratio without sounding absurd ─────────────
// A month with one back session and twelve chest sessions produces a
// push/pull figure like 79.63, which is arithmetically correct and
// completely useless to read. Past a few times over, the ratio stops
// being a ratio and becomes "one of these barely happened".
export const PUSH_PULL_BAND = [0.7, 1.4]

export const formatRatio = (r) =>
  r >= 10 || r <= 0.1 ? `×${Math.round(r >= 1 ? r : 1 / r)}` : String(Math.round(r * 100) / 100)

export function describeRatio(r) {
  if (r >= 10) return `حجم الدفع يقارب ${Math.round(r)} أضعاف السحب`
  if (r <= 0.1) return `حجم السحب يقارب ${Math.round(1 / r)} أضعاف الدفع`
  if (r > 1) return `نسبة الدفع إلى السحب ${Math.round(r * 100) / 100}`
  return `نسبة السحب إلى الدفع ${Math.round((1 / r) * 100) / 100}`
}

// A split that lopsided is no longer a nudge — one side is missing.
const pushPullSeverity = (r) => (r >= 4 || r <= 0.25 ? 'alert' : 'nudge')

const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

export const MAX_TIPS = 4

export function buildTips(report, { sessions = [], mapping = {}, repTarget, month } = {}) {
  const tips = []
  const add = (id, severity, title, body, evidence) =>
    tips.push({ id, severity, weight: SEV[severity] ?? 0, title, body, evidence })

  const { muscles, balance, sets, volume, consistency, prs, time } = report

  // Neglected muscle — only when the split is genuinely lopsided.
  if (muscles.length >= 3 && balance.neglected && balance.dominant) {
    const lo = balance.neglected, hi = balance.dominant
    if (lo.pct <= 8 && hi.pct >= 30) {
      add('neglected', 'alert',
        `${lo.label} شبه غائب`,
        `${lo.label} أخذ ٪${lo.pct} من حجمك هذا الشهر مقابل ٪${hi.pct} لـ${hi.label}. أضف له تمريناً أو صفّاً إضافياً.`,
        `٪${lo.pct} / ٪${hi.pct}`)
    }
  }

  // Push/pull balance. Anything outside this band pulls the shoulders forward.
  if (balance.pushPull !== null && (balance.pushPull < 0.7 || balance.pushPull > 1.4)) {
    const pushHeavy = balance.pushPull > 1.4
    const heavy = pushHeavy ? 'الدفع' : 'السحب'
    const light = pushHeavy ? 'السحب' : 'الدفع'
    add('pushpull', pushPullSeverity(balance.pushPull),
      'توازن الدفع والسحب مائل',
      `${describeRatio(balance.pushPull)} — ${heavy} يغلب على ${light}. وازنها حتى لا تتقدّم الأكتاف.`,
      formatRatio(balance.pushPull))
  }

  // Untracked sets: the engine cannot progress a set that was never ticked.
  if (sets.untrackedPct >= 15) {
    add('untracked', 'alert',
      'مجموعات لم تؤكّدها',
      `٪${sets.untrackedPct} من مجموعاتك هذا الشهر بلا علامة إكمال. نظام التقدم يحتسب المؤكَّد فقط، فهذه المجموعات لا ترفع أوزانك.`,
      `${sets.total - sets.completed}/${sets.total}`)
  }

  // Stalled and ready-to-raise lifts, straight from the progression engine.
  const trained = new Set()
  for (const s of sessions) {
    if (monthKey(s.date) !== month) continue
    for (const ex of s.exercises || []) trained.add(ex.name)
  }
  const stalled = [], ready = []
  for (const name of trained) {
    const a = analyzeProgression(sessions, name, mapping, repTarget)
    if (a.hint === 'raise') ready.push(name)
    else if (a.hint === 'lower' || a.failedAtWeight >= 2) stalled.push(name)
  }
  if (ready.length) {
    add('ready', 'praise',
      `${ready.length === 1 ? 'تمرين جاهز' : `${ready.length} تمارين جاهزة`} لزيادة الوزن`,
      `${ready.slice(0, 3).join(' · ')} — أتممت شرط الزيادة عليها. ارفع الوزن في الجلسة القادمة.`,
      ready.join(', '))
  }
  if (stalled.length) {
    add('stalled', 'nudge',
      `${stalled.length === 1 ? 'تمرين متعثّر' : `${stalled.length} تمارين متعثّرة`}`,
      `${stalled.slice(0, 3).join(' · ')} — لم تصل العدد المطلوب مرتين متتاليتين. خفّف الوزن قليلاً وابنِ منه.`,
      stalled.join(', '))
  }

  // Volume trend, but only against a month that actually had data.
  if (volume.trendPct !== null && Math.abs(volume.trendPct) >= 15) {
    const up = volume.trendPct > 0
    add('trend', up ? 'praise' : 'nudge',
      up ? `حجمك ارتفع ٪${volume.trendPct}` : `حجمك نزل ٪${Math.abs(volume.trendPct)}`,
      up
        ? `${volume.total.toLocaleString('en')} كجم هذا الشهر مقابل ${volume.prevTotal.toLocaleString('en')} في السابق. حافظ على الوتيرة.`
        : `${volume.total.toLocaleString('en')} كجم هذا الشهر مقابل ${volume.prevTotal.toLocaleString('en')} في السابق. راجع عدد الجلسات قبل الأوزان.`,
      `٪${volume.trendPct}`)
  }

  // The weekday that keeps getting skipped.
  if (consistency.weakestWeekday) {
    const { day, count } = consistency.weakestWeekday
    add('weekday', 'nudge',
      `${WEEKDAYS[day]} هو يومك الضعيف`,
      `غبت ${count} مرات في ${WEEKDAYS[day]} هذا الشهر. إما تنقل تمرينه ليوم آخر، أو تجعله يوم راحة مجدولاً.`,
      `${count}× ${WEEKDAYS[day]}`)
  }

  // Rest credits earned and never spent.
  if (consistency.restCredits >= 3) {
    add('credits', 'info',
      `${consistency.restCredits} أيام راحة في رصيدك`,
      consistency.restCredits >= MAX_REST_CREDITS
        ? 'رصيدك ممتلئ ولا يزيد أكثر. استعمل يوماً منه بدل أن يضيع.'
        : 'كسبتها بالتزامك. استعملها في يوم تحتاجه فعلاً — تحفظ الستريك بلا كسر.',
      String(consistency.restCredits))
  }

  // No new record all month.
  if (!prs.length && report.sessionCount >= 6) {
    add('prdrought', 'nudge',
      'لا رقم قياسي هذا الشهر',
      `${report.sessionCount} جلسة بلا وزن جديد. جرّب زيادة صغيرة على تمرين واحد تشعر أنك تسيطر عليه.`,
      '0 PR')
  } else if (prs.length) {
    add('prs', 'praise',
      `${prs.length} ${prs.length === 1 ? 'رقم قياسي' : 'أرقام قياسية'} جديدة`,
      `أثقلها ${prs[0].exercise} على ${prs[0].weight} كجم، بعد ${prs[0].prevBest} كجم.`,
      `${prs.length} PR`)
  }

  // Session length drift — the weakest signal here, and it is skipped
  // outright when duration is missing from too much of the month.
  if (time.known && time.avgMinutes > 0) {
    if (time.avgMinutes < 25) {
      add('short', 'info',
        'جلساتك قصيرة',
        `متوسط جلستك ${time.avgMinutes} دقيقة. إن كان هذا مقصوداً فلا مشكلة، وإلا فقد تكون تتخطى مجموعات.`,
        `${time.avgMinutes} د`)
    } else if (time.avgMinutes > 100) {
      add('long', 'info',
        'جلساتك طويلة',
        `متوسط جلستك ${time.avgMinutes} دقيقة. راحات أقصر بين المجموعات ترفع الكثافة وتقصّر الوقت.`,
        `${time.avgMinutes} د`)
    }
  }

  // A curated form tip for the exercise he trained most — real content
  // from constants.js, not invented advice.
  const formTip = pickFormTip(sessions, month, muscles)
  if (formTip) add('form', 'info', `نصيحة أداء — ${formTip.exercise}`, formTip.tip, formTip.exercise)

  return tips
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_TIPS)
    .map(({ weight, ...t }) => t)
}

// The most-trained exercise this month, paired with one of its own
// coaching notes. Seeded by the month so it is stable on re-render but
// differs month to month.
function pickFormTip(sessions, month, muscles) {
  const count = new Map()
  for (const s of sessions) {
    if (monthKey(s.date) !== month) continue
    for (const ex of s.exercises || []) count.set(ex.name, (count.get(ex.name) || 0) + 1)
  }
  if (!count.size) return null
  const [top] = [...count.entries()].sort((a, b) => b[1] - a[1])[0]

  for (const g of Object.values(MUSCLE_GROUPS)) {
    const found = (g.exercises || []).find(e => e.name === top)
    if (found?.tips?.length) {
      const seed = Number(month.slice(5, 7))
      return { exercise: top, tip: found.tips[seed % found.tips.length] }
    }
  }
  return null
}
