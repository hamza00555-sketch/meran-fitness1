// Specs for what the history tab (السجل) prints, run against the real
// ES module.
//
//   node --test tests/history.test.mjs
//
// The critique found the tab printing Hijri dates in Arabic-Indic
// digits («١٣ محرم») one line above Western ones, a flat list with no
// sense of the week, and the English word «sets» under every card.

import test from 'node:test'
import assert from 'node:assert/strict'

globalThis.localStorage = {
  _d: new Map(),
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null },
  setItem(k, v) { this._d.set(k, String(v)) },
  removeItem(k) { this._d.delete(k) },
  key(i) { return [...this._d.keys()][i] ?? null },
  get length() { return this._d.size },
}

const M = await import('../src/components/history/model.js')

const at = (y, m, d, h = 18) => new Date(y, m - 1, d, h).toISOString()
const sess = (id, date, exercises, extra = {}) => ({ id, date, duration: 48, exercises, ...extra })
const ex = (name, muscle, sets) => ({ id: name, name, muscle, sets: sets.map(([weight, reps, done = true]) => ({ weight: String(weight), reps: String(reps), done })) })

test('the training week starts on Saturday', () => {
  assert.equal(M.weekStartKey('2026-07-04'), '2026-07-04')   // Saturday
  assert.equal(M.weekStartKey('2026-07-05'), '2026-07-04')   // Sunday
  assert.equal(M.weekStartKey('2026-07-10'), '2026-07-04')   // Friday
  assert.equal(M.weekStartKey('2026-07-11'), '2026-07-11')
})

test('weeks are named this week, last week, then by their dates', () => {
  const today = '2026-07-08'
  assert.equal(M.weekLabel('2026-07-04', today), 'هذا الأسبوع')
  assert.equal(M.weekLabel('2026-06-27', today), 'الأسبوع الماضي')
  assert.equal(M.weekLabel('2026-06-20', today), '20 – 26 يونيو')
  assert.equal(M.weekLabel('2026-05-30', today), '30 مايو – 5 يونيو')
  assert.equal(M.weekLabel('2025-12-27', today), '27 ديسمبر 2025 – 2 يناير 2026')
})

test('a 01:00 session belongs to the training day before (the 03:00 turn)', () => {
  const late = sess(1, new Date(2026, 6, 5, 1, 0).toISOString(), [])
  assert.equal(M.sessionDay(late), '2026-07-04')
  // …which also files it in the week that day opens
  const weeks = M.groupByWeek([late], '2026-07-08')
  assert.equal(weeks[0].key, '2026-07-04')
})

test('dates are Gregorian with Western digits', () => {
  const s = sess(1, at(2026, 10, 4), [])
  assert.equal(M.sessionDateText(s, '2026-10-09'), 'الأحد 4 أكتوبر')
  assert.doesNotMatch(M.sessionDateText(s, '2026-10-09'), /[٠-٩]/)
  assert.equal(M.sessionDateText(s, '2027-01-09'), 'الأحد 4 أكتوبر 2026')
})

test('sessions group newest first under their week', () => {
  const list = [
    sess(1, at(2026, 6, 22), []), sess(2, at(2026, 7, 6), []),
    sess(3, at(2026, 7, 4), []), sess(4, at(2026, 6, 30), []),
  ]
  const weeks = M.groupByWeek(list, '2026-07-08')
  assert.deepEqual(weeks.map(w => w.label), ['هذا الأسبوع', 'الأسبوع الماضي', '20 – 26 يونيو'])
  assert.deepEqual(weeks.map(w => w.sessions.map(s => s.id)), [[2, 3], [4], [1]])
})

test('Arabic counting: words for 1 and 2, plural to 10, singular after', () => {
  assert.equal(M.countText(1, 'session'), 'جلسة وحدة')
  assert.equal(M.countText(2, 'session'), 'جلستين')
  assert.equal(M.countText(3, 'session'), '3 جلسات')
  assert.equal(M.countText(11, 'session'), '11 جلسة')
  assert.equal(M.countText(18, 'set'), '18 مجموعة')
  assert.equal(M.countText(4, 'set'), '4 مجموعات')
  assert.equal(M.countText(3, 'exercise'), '3 تمارين')
})

test('week totals: sessions and tonnage, no English', () => {
  const s = sess(1, at(2026, 7, 6), [ex('Bench Press', 'Chest', [[80, 12], [80, 12], [80, 10, false]])])
  assert.equal(M.weekTotalsText([s, s, s]), '3 جلسات · 5.8 طن')
  assert.equal(M.weekTotalsText([sess(2, at(2026, 7, 6), [ex('Curl', 'Biceps', [[10, 12]])])]), 'جلسة وحدة · 120 كجم')
})

test('the best set is the heaviest done set; reps break a tie', () => {
  const e = ex('Bench Press', 'Chest', [[80, 8], [85, 5], [85, 6], [100, 1, false]])
  assert.deepEqual(M.bestSet(e), { weight: 85, reps: 6 })
  assert.deepEqual(M.bestSet(ex('Pull-Up', 'Back', [[0, 8], [0, 10]])), { weight: 0, reps: 10 })
  assert.equal(M.bestSet(ex('X', 'Back', [[50, 5, false]])), null)
})

test('gold goes to the session that first lifted the all-time best, only', () => {
  const list = [
    sess(1, at(2026, 6, 1), [ex('Bench Press', 'Chest', [[80, 12]])]),
    sess(2, at(2026, 6, 3), [ex('Bench Press', 'Chest', [[85, 8]])]),
    sess(3, at(2026, 6, 5), [ex('Bench Press', 'Chest', [[85, 10]])]),          // ties, not first
    sess(4, at(2026, 6, 7), [ex('Bench Press', 'Chest', [[90, 3]])], { deload: { pct: 40 } }),  // deload never counts
  ]
  const firsts = M.firstBestSessions(list)
  const bench = (i) => list[i].exercises[0]
  assert.deepEqual(list.map((s, i) => M.isFirstBest(firsts, s, bench(i))), [false, true, false, false])
  // a weights reset starts over: the first session after it is the new
  // baseline, not a record
  const after = M.firstBestSessions(list, {}, list[2].id)
  assert.equal(M.isFirstBest(after, list[2], bench(2)), false)
})

test('the first time an exercise is logged is a baseline, not a record', () => {
  const one = [sess(1, at(2026, 6, 1), [ex('Bench Press', 'Chest', [[80, 12]])])]
  assert.equal(M.isFirstBest(M.firstBestSessions(one), one[0], one[0].exercises[0]), false)
  // steady weights never paint anything gold
  const steady = [1, 3, 5].map((d, i) => sess(i + 1, at(2026, 6, d), [ex('Bench Press', 'Chest', [[80, 12]])]))
  assert.equal(M.firstBestSessions(steady).size, 0)
})

test('the day is named in Arabic', () => {
  assert.equal(M.dayWordOf('Push'), 'دفع')
  assert.equal(M.dayWordOf('Pull Day'), 'سحب')
  assert.equal(M.dayWordOf('Upper A'), 'علوي A')
  assert.equal(M.dayWordOf('Full Body'), 'جسم كامل')
  assert.equal(M.dayWordOf('يوم الصدر'), 'يوم الصدر')
  const plan = sess(1, at(2026, 7, 6), [ex('Lat Pulldown', 'Back', [[60, 10]])], { planDayName: 'Pull — ظهر وبايسبس' })
  assert.equal(M.sessionTitle(plan), 'سحب — ظهر وبايسبس')
  const old = sess(2, at(2026, 7, 6), [ex('Bench Press', 'Chest', [[60, 10]]), ex('Pushdown', 'Triceps', [[30, 12]])], { planDayName: 'Push Day' })
  assert.equal(M.sessionTitle(old), 'دفع — صدر وترايسبس')
  const free = sess(3, at(2026, 7, 6), [ex('Bench Press', 'Chest', [[60, 10]])])
  assert.equal(M.sessionTitle(free), 'صدر')
  assert.equal(M.sessionTitle(sess(4, at(2026, 7, 6), [])), 'جلسة حرة')
  assert.doesNotMatch(M.sessionTitle(old), /Push|Day|sets/i)
  // the built-in plan's leg day is «Legs — أرجل»: say it once
  const legs = { name: 'Legs — أرجل', exercises: [{ muscle: 'Legs', name: 'Leg Press' }] }
  assert.equal(M.planDayTitleAr(legs), 'أرجل')
  assert.equal(M.planDayTitleAr({ name: 'Pull — ظهر، بايسبس', exercises: [] }), 'سحب — ظهر، بايسبس')
})

test('durations read in Arabic with Western digits', () => {
  assert.equal(M.durationText(48), '48 دقيقة')
  assert.equal(M.durationText(65), '1 س 5 د')
  assert.equal(M.durationText(120), '2 س')
  assert.equal(M.durationText(null), '')
})
