// Specs for what the streak SAYS.
//
//   node --test tests/streak.test.mjs
//
// recovery-credits pins the numbers. This pins the words built on them,
// because a line that promises what the engine does not do is worse
// than no line: the deload does not protect the streak, «تخطي اليوم»
// only moves the plan, tickets are spent at 03:00 without a tap, and
// the balance has no real ceiling.

import test from 'node:test'
import assert from 'node:assert/strict'

const { computeRecovery, DAY_STATUS, MAX_REST_CREDITS } = await import('../src/recovery.js')
const streakModule = await import('../src/streak.js')
const {
  streakView, todayStreak, missWouldCost, chain7, heldRun, countAr, fmtDayAr,
  nextMilestone, skipCopy, finishToast, spendToast,
} = streakModule
const { formatRemaining, isLateWindow } = await import('../src/day.js')

const S = (d, h = 18) => ({ id: `${d}-${h}`, date: `${d}T${String(h).padStart(2, '0')}:00:00`,
  exercises: [{ name: 'Bench Press', sets: [{ weight: '80', reps: '10', done: true }] }] })
const july = (...days) => days.map(n => S(`2026-07-${String(n).padStart(2, '0')}`))
// Three days a week: train, rest, train, rest …
const CFG = { daysPerWeek: 3, overrides: [], restDays: [], autoSpendFrom: '2026-07-01' }
const at = (iso) => new Date(iso)
const view = (sessions, cfg, clock, extra = {}) => {
  const now = at(clock)
  const today = clock.slice(0, 10)
  return streakView({ recovery: computeRecovery(sessions, cfg, extra.today || today), config: cfg, now, ...extra })
}

// ══ counting and dates ═════════════════════════════════════════

test('Arabic counts: 1 and 2 are words, 3–10 plural, 11+ singular', () => {
  assert.equal(countAr(0, 'ticket'), '0 تذاكر')
  assert.equal(countAr(1, 'ticket'), 'تذكرة وحدة')
  assert.equal(countAr(2, 'ticket'), 'تذكرتين')
  assert.equal(countAr(3, 'ticket'), '3 تذاكر')
  assert.equal(countAr(11, 'ticket'), '11 تذكرة')
  assert.equal(countAr(1, 'workout'), 'تمرين واحد')
  assert.equal(countAr(5, 'workout'), '5 تمارين')
  assert.equal(countAr(2, 'day'), 'يومين')
  assert.equal(countAr(103, 'day'), '103 أيام')
})

test('streak dates are Gregorian with Western digits', () => {
  assert.equal(fmtDayAr('2026-07-11'), 'السبت 11 يوليو')
  assert.equal(fmtDayAr('2026-10-08'), 'الخميس 8 أكتوبر')
  assert.equal(fmtDayAr('2026-10-08', { weekday: false }), '8 أكتوبر')
})

test('the countdown and the late window', () => {
  assert.equal(formatRemaining(17 * 3600e3), '17 س')
  assert.equal(formatRemaining(9 * 3600e3 + 40 * 60e3 + 59e3), '9 س 40 د')
  assert.equal(formatRemaining(40 * 60e3), '40 د')
  assert.equal(formatRemaining(30e3), 'أقل من دقيقة')
  assert.equal(isLateWindow(at('2026-07-13T22:59:00')), false)
  assert.equal(isLateWindow(at('2026-07-13T23:00:00')), true)
  assert.equal(isLateWindow(at('2026-07-14T02:59:00')), true)
  assert.equal(isLateWindow(at('2026-07-14T03:00:00')), false)
})

test('milestones', () => {
  assert.equal(nextMilestone(0), 7)
  assert.equal(nextMilestone(60), 75)
  assert.equal(nextMilestone(365), null)
})

// ══ the engine additions ═══════════════════════════════════════

test('the real balance has no ceiling; the old clamped one is kept for old readers', () => {
  // 40 days on a three-day plan, every workout done: 8 tickets earned.
  const days = []
  for (let d = 1; d <= 40; d += 2) days.push(S(new Date(Date.UTC(2026, 5, d)).toISOString().slice(0, 10)))
  const r = computeRecovery(days, CFG, '2026-07-10')
  assert.ok(r.creditsEarned > MAX_REST_CREDITS, String(r.creditsEarned))
  assert.equal(r.restCredits, MAX_REST_CREDITS)
  assert.equal(r.usableCredits, r.creditsEarned - r.creditsSpent)
})

test('tomorrow follows the cycle', () => {
  // Trained today on a 3-day plan → tomorrow is rest.
  const done = computeRecovery(july(1, 3, 5), CFG, '2026-07-05')
  assert.equal(done.tomorrowExpected, DAY_STATUS.RECOVERY)
  // A scheduled rest day → tomorrow is a workout.
  const rest = computeRecovery(july(1, 3), CFG, '2026-07-04')
  assert.equal(rest.status, DAY_STATUS.RECOVERY)
  assert.equal(rest.tomorrowExpected, DAY_STATUS.WORKOUT)
  // Five days a week [3,2]: after one workout, two more before rest.
  const five = computeRecovery([S('2026-07-01')], { daysPerWeek: 5 }, '2026-07-01')
  assert.equal(five.tomorrowExpected, DAY_STATUS.WORKOUT)
  assert.equal(five.workoutsBeforeRest, 2)
})

// ══ what today is ══════════════════════════════════════════════

test('today, in one word', () => {
  const kind = (sessions, today, cfg = CFG, active = null) =>
    todayStreak(computeRecovery(sessions, cfg, today), { config: cfg, active, today })
  assert.equal(kind([], '2026-07-01'), 'fresh')
  assert.equal(kind(july(1, 3, 5), '2026-07-05'), 'counted-trained')
  assert.equal(kind(july(1, 3), '2026-07-04'), 'counted-rest')
  assert.equal(kind(july(1, 3), '2026-07-05'), 'owed')
  assert.equal(kind(july(1, 3), '2026-07-05', CFG, { id: 1 }), 'running')
  assert.equal(kind(july(1, 3), '2026-07-04', { ...CFG, overrides: ['2026-07-04'] }), 'override')
  assert.equal(kind(july(1, 3, 5), '2026-07-05', { ...CFG, streakResetAt: '2026-07-05' }), 'reset')
})

test('what a miss would cost', () => {
  assert.equal(missWouldCost({ usableCredits: 2, consistencyStreak: 10 }), 'ticket')
  assert.equal(missWouldCost({ usableCredits: 0, consistencyStreak: 10 }), 'break')
  assert.equal(missWouldCost({ usableCredits: 0, consistencyStreak: 0 }), 'nothing')
})

// ══ the scoreboard, in the fixture states ══════════════════════
//
// Sessions on July 1, 3, 5, 7, 9 on a three-day plan: ten eligible
// days by the 10th, two tickets. The 11th and 12th are workout days
// he missed.

test('a ticket spent yesterday: the day is named, the streak held, the cost of today stated', () => {
  const v = view(july(1, 3, 5, 7, 9), CFG, '2026-07-12T10:00:00')
  assert.equal(v.kind, 'owed')
  assert.equal(v.number, 10)
  assert.equal(v.status, 'باقي تمرين اليوم — يرجع يزيد: 11')
  assert.equal(v.note, 'تذكرة غطّت أمس — وقف على 10، ما زاد ولا انكسر.')
  assert.equal(v.countdown, '17 س')
  assert.equal(v.cost, 'لو فاتك تنصرف آخر تذكرة')
  assert.equal(v.ticketsText, 'تذكرة وحدة')
  assert.equal(v.badge, 'ticket')
})

test('no tickets left, daytime: calm, but the cost is the whole streak', () => {
  const v = view(july(1, 3, 5, 7, 9), CFG, '2026-07-13T10:00:00')
  assert.equal(v.number, 10)
  assert.equal(v.tickets, 0)
  assert.equal(v.cost, 'خلصت تذاكرك — لو فاتك يرجع 10 إلى صفر')
  assert.equal(v.statusWarn, false)
  assert.equal(v.note, 'يومين ورا بعض غطّتها التذاكر — الستريك واقف على 10.')
})

test('no tickets left, late at night: it says so, with the time left', () => {
  const v = view(july(1, 3, 5, 7, 9), CFG, '2026-07-13T23:40:00')
  assert.equal(v.status, 'بدون تمرين الليلة يرجع 10 إلى صفر')
  assert.equal(v.statusWarn, true)
  assert.equal(v.countdown, '3 س 20 د')
  assert.equal(v.badge, 'hourglass')
  assert.equal(v.badgeTone, 'streak')
  assert.match(v.lateTail, /ابدأ قبل 3 وتنحسب حتى لو خلصت بعدها/)
})

test('after midnight the day is still the same training day', () => {
  // 01:30 on the 14th is still the 13th until 03:00.
  const v = view(july(1, 3, 5, 7, 9), CFG, '2026-07-14T01:30:00', { today: '2026-07-13' })
  assert.equal(v.today, '2026-07-13')
  assert.equal(v.countdown, '1 س 30 د')
})

test('late with a ticket: calm, in the rest colour', () => {
  const v = view(july(1, 3, 5, 7, 9), CFG, '2026-07-12T23:10:00')
  assert.equal(v.status, 'لو فاتك الليلة تنصرف تذكرة ويوقف على 10')
  assert.equal(v.statusWarn, false)
  assert.equal(v.badgeTone, 'rest')
  assert.equal(v.lateTail, 'وتخلص تذاكرك')
})

test('trained today: counted, with what tomorrow is', () => {
  const v = view(july(1, 3, 5, 7, 9), CFG, '2026-07-09T20:00:00')
  assert.equal(v.kind, 'counted-trained')
  assert.equal(v.status, 'انحسب اليوم — ستريكك 9')
  assert.equal(v.detail, 'بكرة راحة مجدولة، تنحسب لحالها')
  assert.equal(v.counted, true)
  assert.equal(v.countdown, null, 'nothing is owed, so no countdown')
})

test('a scheduled rest day is counted from 03:00 with nothing to do', () => {
  const v = view(july(1, 3, 5, 7, 9), CFG, '2026-07-10T09:00:00')
  assert.equal(v.kind, 'counted-rest')
  assert.equal(v.number, 10)
  assert.equal(v.status, 'راحة مجدولة — انحسبت لك من 3 الفجر')
  assert.equal(v.badge, 'moon')
})

test('first day: nothing to lose, no countdown pressure', () => {
  const v = view([], CFG, '2026-07-01T10:00:00')
  assert.equal(v.kind, 'fresh')
  assert.equal(v.number, 0)
  assert.equal(v.status, 'سجّل أول جلسة ويبدأ ستريكك من 1')
})

test('a deload is said not to protect the streak', () => {
  const v = view(july(1, 3, 5, 7, 9), CFG, '2026-07-11T10:00:00', { deload: { active: true, day: 3, totalDays: 7 } })
  // The 11th: yesterday was a counted rest day, today is owed.
  assert.equal(v.note, 'ديلود: الوزن أخف، والحساب نفسه.')
  assert.ok(v.cost.includes('تذكرة'), v.cost)
  assert.deepEqual(v.deload, { day: 3, total: 7 })
})

test('no line anywhere suggests the deload or skipping protects the streak', () => {
  for (const clock of ['2026-07-11T10:00:00', '2026-07-12T10:00:00', '2026-07-13T23:40:00']) {
    const v = view(july(1, 3, 5, 7, 9), CFG, clock, { deload: { active: true, day: 1, totalDays: 7 } })
    const all = [v.status, v.note, v.cost, v.detail, v.lateTail].join(' ')
    assert.doesNotMatch(all, /يحمي|محمي|ما ينكسر بالديلود/)
  }
})

// ══ the seven days ═════════════════════════════════════════════

test('the chain says what each day did', () => {
  const r = computeRecovery(july(1, 3, 5, 7, 9), CFG, '2026-07-13')
  const c = chain7(r, { config: CFG, today: '2026-07-13' })
  assert.equal(c.length, 7)
  assert.deepEqual(c.map(x => x.kind), ['trained', 'rest', 'trained', 'rest', 'credit', 'credit', 'today-pending'])
  assert.deepEqual(c.map(x => x.delta), ['+1', '+1', '+1', '+1', '0', '0', ''])
  assert.equal(c[6].letter, 'اليوم')
})

test('a break shows as «كسر», and the days before it are out of the run', () => {
  // No tickets yet (3 days in), then two missed workout days.
  const r = computeRecovery(july(1, 3), CFG, '2026-07-07')
  const c = chain7(r, { config: CFG, today: '2026-07-07' })
  assert.ok(c.some(x => x.kind === 'missed' && x.delta === 'كسر'), JSON.stringify(c.map(x => x.kind)))
  assert.equal(r.consistencyStreak, 0)
})

test('a short history pads with empty days', () => {
  const r = computeRecovery([S('2026-07-01')], CFG, '2026-07-01')
  const c = chain7(r, { config: CFG, today: '2026-07-01' })
  assert.deepEqual(c.map(x => x.kind), ['out', 'out', 'out', 'out', 'out', 'out', 'today-done'])
})

test('held run counts the tickets that end yesterday', () => {
  const r = computeRecovery(july(1, 3, 5, 7, 9), CFG, '2026-07-13')
  assert.deepEqual(heldRun(r, '2026-07-13'), { count: 2, from: '2026-07-11', to: '2026-07-12' })
  const r2 = computeRecovery(july(1, 3, 5, 7, 9), CFG, '2026-07-10')
  assert.equal(heldRun(r2, '2026-07-10').count, 0)
})

// ══ the other places the streak speaks ═════════════════════════

test('the skip sheet states the cost before the plan moves', () => {
  const owedTicket = view(july(1, 3, 5, 7, 9), CFG, '2026-07-11T10:00:00')
  const t = skipCopy(owedTicket)
  assert.match(t.body, /لو ما تمرّنت لين 3 الفجر تنصرف تذكرة ويوقف على 10 \(يبقى تذكرة وحدة\)/)
  assert.equal(t.toast, 'انتقلت الخطة لليوم الجاي — اليوم لسا يوم تمرين')

  const owedBreak = view(july(1, 3, 5, 7, 9), CFG, '2026-07-13T10:00:00')
  assert.match(skipCopy(owedBreak).body, /يرجع 10 إلى صفر/)
  assert.equal(skipCopy(owedBreak).warn, true)

  const counted = view(july(1, 3, 5, 7, 9), CFG, '2026-07-09T20:00:00')
  assert.equal(skipCopy(counted).toast, 'انتقلت الخطة لليوم الجاي — اليوم محسوب لك')
  assert.equal(skipCopy(counted).warn, false)
})

test('the finish toast says what the save did to the streak', () => {
  const after = computeRecovery(july(1, 3, 5, 7, 9), CFG, '2026-07-09')
  assert.equal(finishToast({ before: 'owed', after, sessionDay: '2026-07-09', today: '2026-07-09' }), 'انحسب اليوم — ستريكك 9')
  assert.equal(finishToast({ before: 'counted-trained', after, sessionDay: '2026-07-09', today: '2026-07-09' }), 'انحفظت الجلسة — اليوم كان محسوب')
  assert.equal(finishToast({ before: 'owed', after, sessionDay: '2026-07-08', today: '2026-07-09' }), 'انحسب الأربعاء 8 يوليو — بدأتها قبل 3 الفجر · ستريكك 9')
  assert.match(finishToast({ before: 'reset', after, sessionDay: '2026-07-09', today: '2026-07-09' }), /ما ينحسب بعد تغيير الخطة/)
})

test('the spend toast is dated and says what is left', () => {
  const r = computeRecovery(july(1, 3, 5, 7, 9), CFG, '2026-07-12')
  assert.equal(spendToast(['2026-07-11'], r), 'انصرفت تذكرة عن السبت 11 يوليو — الستريك وقف على 10. باقي تذكرة وحدة')
  const r2 = computeRecovery(july(1, 3, 5, 7, 9), CFG, '2026-07-13')
  assert.equal(spendToast(['2026-07-11', '2026-07-12'], r2), 'انصرفت تذكرتين (11 يوليو – 12 يوليو) — الستريك وقف على 10. وخلصت تذاكرك')
})

// ══ after review ═══════════════════════════════════════════════

test('only the miss that ended a run says «كسر»; the days after it are idle', () => {
  // Streak 4 into July 5, then nothing until the 10th.
  const r = computeRecovery(july(1, 3), CFG, '2026-07-10')
  const c = chain7(r, { config: CFG, today: '2026-07-10' })
  const breaks = c.filter(x => x.delta === 'كسر')
  assert.equal(breaks.length, 1, JSON.stringify(c.map(x => x.kind)))
  assert.ok(c.some(x => x.kind === 'idle'))
  const row = r.ledger.find(x => x.date === '2026-07-05')
  assert.equal(row.broke, 4, 'the miss records the run it ended')
})

test('the unit after a separately drawn number follows Arabic counting', () => {
  const { unitAr } = streakModule
  assert.equal(unitAr(1, 'day'), 'يوم')
  assert.equal(unitAr(9, 'day'), 'أيام')
  assert.equal(unitAr(10, 'day'), 'أيام')
  assert.equal(unitAr(11, 'day'), 'يوم')
  assert.equal(unitAr(60, 'day'), 'يوم')
  assert.equal(unitAr(0, 'day'), 'أيام')
})

test('the day comes from the ledger, not the clock, in the minute after 03:00', () => {
  // Numbers built for the 12th, viewed at 03:00:10 on the 13th before the
  // app has recomputed: still the 12th, not a fresh install.
  const r = computeRecovery(july(1, 3, 5, 7, 9), CFG, '2026-07-12')
  const v = streakView({ recovery: r, config: CFG, now: at('2026-07-13T03:00:10') })
  assert.equal(v.today, '2026-07-12')
  assert.notEqual(v.kind, 'fresh')
  assert.equal(v.countdown, 'أقل من دقيقة')
  assert.ok(!v.chain.some(x => x.delta === 'كسر'), 'a covered day is not a break')
})

test('a session started before 03:00 and still running: no deadline, the right day', () => {
  // The app freezes the streak's day at the session's day (App.jsx).
  const r = computeRecovery(july(1, 3, 5, 7, 9), CFG, '2026-07-13')
  const v = streakView({ recovery: r, config: CFG, active: { id: 1, date: '2026-07-14T02:30:00' },
    now: at('2026-07-14T03:20:00'), today: '2026-07-13' })
  assert.equal(v.kind, 'running')
  assert.equal(v.number, 10)
  assert.equal(v.countdown, null)
  assert.equal(v.cost, '')
  assert.match(v.status, /تنحسب لـالاثنين 13 يوليو/)
  assert.equal(v.detail, 'لما تنحفظ يصير ستريكك 11')
  assert.ok(!v.chain.some(x => x.delta === 'كسر'))
})

test('no tickets yet: the wording agrees for one and two days', () => {
  const v1 = view(july(1, 3), CFG, '2026-07-05T10:00:00')
  assert.equal(v1.cost, 'ما عندك تذاكر لسا — لو فاتك يرجع صفر')
  assert.equal(v1.ticketsText, '0 تذاكر · الجاية بعد يوم واحد')
})

test('finish toast: a crossed-03:00 session on a reset day is saved, not counted', () => {
  const cfg = { ...CFG, streakResetAt: '2026-07-11' }
  const after = computeRecovery([...july(1, 3, 5, 7, 9), S('2026-07-11')], cfg, '2026-07-12')
  assert.match(finishToast({ before: 'owed', after, sessionDay: '2026-07-11', today: '2026-07-12' }), /ما ينحسب بعد تغيير الخطة/)
})

test('finish toast: training on a ticket-held day gives the ticket back', () => {
  const after = computeRecovery([...july(1, 3, 5, 7, 9), S('2026-07-11')], { ...CFG, restDays: ['2026-07-11'] }, '2026-07-11')
  assert.match(finishToast({ before: 'held', after, sessionDay: '2026-07-11', today: '2026-07-11' }), /ورجعت لك التذكرة/)
})

// ══ step 2: runs, the best, and «ليش 60؟» ══════════════════════

test('the engine records each run that ended, and how', () => {
  // A 4-day run broken on the 5th, then a new run from the 10th.
  const r = computeRecovery([...july(1, 3), ...july(10, 12, 14)], CFG, '2026-07-15')
  assert.equal(r.runs.length, 1)
  assert.deepEqual(r.runs[0], { start: '2026-07-01', end: '2026-07-04', length: 4, endedBy: 'miss', breakDay: '2026-07-05' })
  assert.equal(r.lastBreak.breakDay, '2026-07-05')
  assert.equal(r.bestRun.length, Math.max(4, r.consistencyStreak))
})

test('a plan reset ends the run as «settings», not as a miss', () => {
  const r = computeRecovery(july(1, 3, 5, 7, 9), { ...CFG, streakResetAt: '2026-07-10' }, '2026-07-11')
  const last = r.runs[r.runs.length - 1]
  assert.equal(last.endedBy, 'settings')
  assert.equal(r.lastBreak, null, 'a reset is not a break')
})

test('«ليش 10؟»: the sum, what did not count, and why it is not 13', () => {
  const { explainerView } = streakModule
  const rec = computeRecovery(july(1, 3, 5, 7, 9), CFG, '2026-07-13')
  const e = explainerView({ recovery: rec, config: CFG, now: at('2026-07-13T10:00:00') })
  assert.deepEqual(e.equation, { trained: 5, plannedRest: 5, total: 10 })
  assert.equal(e.equation.trained + e.equation.plannedRest, e.n, 'the parts always make the number')
  assert.equal(e.notCounted, 'يومين غطّتها التذاكر — توقفه وما تزيده.')
  assert.match(e.whyNot, /13 يوم: 10 محسوبة \+ 2 بتذاكر \+ اليوم/)
  assert.equal(e.stage, 'شعلة')
  assert.match(e.startLine, /^بدأ الأربعاء 1 يوليو/)
})

test('«ليش 0؟» right after a break names the break', () => {
  const { explainerView } = streakModule
  const rec = computeRecovery(july(1, 3), CFG, '2026-07-07')
  const e = explainerView({ recovery: rec, config: CFG, now: at('2026-07-07T10:00:00') })
  assert.equal(e.n, 0)
  assert.match(e.startLine, /^انكسر ستريك 4 أيام — الأحد 5 يوليو كان يوم تمرين وما بقى تذاكر/)
  assert.equal(e.records.previous.length, 4)
})

test('the calendar marks every day from the ledger, and only real breaks', () => {
  const { explainerView, dayLine } = streakModule
  const rec = computeRecovery(july(1, 3), CFG, '2026-07-10')
  const e = explainerView({ recovery: rec, config: CFG, now: at('2026-07-10T10:00:00') })
  const cells = e.months.flatMap(g => g.cells).filter(Boolean)
  assert.equal(cells.filter(c => c.kind === 'missed').length, 1)
  const jul5 = rec.ledger.find(r => r.date === '2026-07-05')
  assert.equal(dayLine(jul5, '2026-07-10'), 'الأحد 5 يوليو · يوم تمرين بدون تمرين ولا تذكرة · انكسر ستريك 4')
})

test('the stored best outlives the replay', () => {
  const { explainerView } = streakModule
  const rec = computeRecovery(july(1, 3), CFG, '2026-07-04')
  const e = explainerView({ recovery: rec, config: CFG, now: at('2026-07-04T10:00:00'), storedBest: { value: 60 } })
  assert.equal(e.records.best, 60)
  assert.equal(e.records.bestIsCurrent, false)
})
