// Specs for the optional rest days (أيام الراحة الاختيارية): how many he
// holds, the day each was earned, the ones used, the words, and the
// «كسبت يوم راحة» announcement that comes once per earned day.
//
//   node --test tests/rest-days.test.mjs
//
// The numbers come from the ledger computeRecovery writes, so the list
// must always agree with the balance (usableCredits).

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { computeRecovery } = await import('../src/recovery.js')
const {
  restDaysView, restDayCount, restDaysCopy, restDaysAr, earnedCopy,
  toAnnounce, markAnnounced, REST_ANNOUNCED_KEY,
} = await import('../src/restDays.js')
const { todayMark } = await import('../src/streak.js')

const S = (d) => ({ id: d, date: `${d}T18:00:00`, exercises: [{ name: 'Bench Press', sets: [{ weight: '80', reps: '10', done: true }] }] })
const july = (...days) => days.map(n => S(`2026-07-${String(n).padStart(2, '0')}`))
// Three days a week: train, rest, train, rest …
const CFG = { daysPerWeek: 3, overrides: [], restDays: [], autoSpendFrom: '2026-07-01' }
const rec = (days, today) => computeRecovery(july(...days), CFG, today)

test('each rest day held has the day it was earned and the streak it came at', () => {
  // 1–10 July, every workout done: the 5th and the 10th counted days earn one each.
  const r = rec([1, 3, 5, 7, 9], '2026-07-10')
  const v = restDaysView(r)
  assert.equal(v.count, 2)
  assert.equal(v.count, r.usableCredits, 'the list agrees with the balance')
  assert.deepEqual(v.held, [{ earnedOn: '2026-07-05', streak: 5 }, { earnedOn: '2026-07-10', streak: 10 }])
  assert.deepEqual(v.used, [])
  assert.equal(restDayCount(r), 2)
})

test('a missed workout day uses the oldest one, and says when', () => {
  // The 11th is a workout day with nothing done: the engine spends one.
  const r = rec([1, 3, 5, 7, 9], '2026-07-12')
  const v = restDaysView(r)
  assert.equal(v.count, r.usableCredits)
  assert.equal(v.count, 1)
  assert.deepEqual(v.held, [{ earnedOn: '2026-07-10', streak: 10 }])
  assert.deepEqual(v.used, [{ earnedOn: '2026-07-05', usedOn: '2026-07-11' }])
  // and the second miss uses the last one
  const r2 = rec([1, 3, 5, 7, 9], '2026-07-13')
  assert.equal(restDaysView(r2).count, r2.usableCredits)
  assert.equal(restDaysView(r2).count, 0)
  assert.deepEqual(restDaysView(r2).used.map(u => u.usedOn), ['2026-07-12', '2026-07-11'], 'newest first')
})

test('the count always matches the engine, day after day', () => {
  const days = [1, 3, 5, 7, 9, 15, 17, 19, 21, 23, 25, 27, 29]
  for (let d = 1; d <= 31; d++) {
    const today = `2026-07-${String(d).padStart(2, '0')}`
    const r = rec(days.filter(n => n <= d), today)
    assert.equal(restDaysView(r).count, r.usableCredits, today)
  }
})

test('nothing yet: zero, and when the next one comes', () => {
  const v = restDaysView(rec([1], '2026-07-02'))
  assert.equal(v.count, 0)
  const c = restDaysCopy(v, '2026-07-02')
  assert.equal(c.title, 'أيام الراحة الاختيارية: 0')
  assert.equal(c.next, 'الجاي بعد 3 أيام محسوبة')
  // the five slots: two counted days of the five so far
  assert.deepEqual([c.progress, c.every], [2, 5])
  assert.deepEqual(c.rows, [])
  assert.deepEqual(restDaysView(computeRecovery([], CFG, '2026-07-02')).held, [])
})

test('the words: short, dates in Arabic, Arabic counting', () => {
  // «ما قل ودل»: the day only — no weekday, no streak, no «كان من»
  const c = restDaysCopy(restDaysView(rec([1, 3, 5, 7, 9], '2026-07-12')), '2026-07-12')
  assert.equal(c.title, 'أيام الراحة الاختيارية: 1')
  assert.deepEqual(c.held.map(h => h.text), ['كسبته 10 يوليو'])
  assert.deepEqual(c.used.map(u => u.text), ['استخدمته 11 يوليو'])
  // one list, newest first
  assert.deepEqual(c.rows.map(r => r.text), ['استخدمته 11 يوليو', 'كسبته 10 يوليو'])
  const today = restDaysCopy(restDaysView(rec([1, 3, 5, 7, 9], '2026-07-10')), '2026-07-10')
  assert.equal(today.held[1].text, 'كسبته اليوم')
  assert.equal(restDaysAr(0), 'ولا يوم راحة اختياري')
  assert.equal(restDaysAr(1), 'يوم راحة اختياري واحد')
  assert.equal(restDaysAr(2), 'يومين راحة اختيارية')
  assert.equal(restDaysAr(3), '3 أيام راحة اختيارية')
  assert.equal(restDaysAr(11), '11 يوم راحة اختياري')
})

test('the list is three lines at most, and always shows the ones he holds', () => {
  const held = (...d) => d.map(n => ({ earnedOn: `2026-07-${String(n).padStart(2, '0')}`, streak: n }))
  const used = (...d) => d.map(n => ({ earnedOn: null, usedOn: `2026-07-${String(n).padStart(2, '0')}` }))
  // four held: the three newest
  const many = restDaysCopy({ count: 4, held: held(5, 10, 15, 20), used: used(12, 8, 3), toNext: 5, every: 5 }, '2026-07-21')
  assert.deepEqual(many.rows.map(r => r.text), ['كسبته 20 يوليو', 'كسبته 15 يوليو', 'كسبته 10 يوليو'])
  // one held after three uses: it is not pushed out by them
  const one = restDaysCopy({ count: 1, held: held(20), used: used(24, 23, 22), toNext: 2, every: 5 }, '2026-07-25')
  assert.deepEqual(one.rows.map(r => r.text), ['استخدمته 24 يوليو', 'استخدمته 23 يوليو', 'كسبته 20 يوليو'])
  // none held: the last three used
  const none = restDaysCopy({ count: 0, held: [], used: used(24, 23, 22, 21), toNext: 2, every: 5 }, '2026-07-25')
  assert.deepEqual(none.rows.map(r => r.kind), ['used', 'used', 'used'])
})

test('the sheet says «يوم راحة اختياري», never «تذاكر»', () => {
  for (const d of [2, 10, 12, 13]) {
    const today = `2026-07-${String(d).padStart(2, '0')}`
    const c = restDaysCopy(restDaysView(rec([1, 3, 5, 7, 9].filter(n => n <= d), today)), today)
    assert.doesNotMatch(JSON.stringify(c), /تذكر|تذاكر/, today)
  }
})

test('the announcement says what was earned and what he holds now', () => {
  const one = earnedCopy([{ earnedOn: '2026-07-10', streak: 10 }], 2)
  assert.equal(one.title, 'كسبت يوم راحة')
  assert.equal(one.total, 'صار عندك يومين راحة اختيارية')
  assert.match(one.line, /وصل ستريكك 10/)
  assert.ok(!/🔥|🎟|tick/i.test(JSON.stringify(one)), 'no emoji, no English')
  const two = earnedCopy([{ earnedOn: '2026-07-05', streak: 5 }, { earnedOn: '2026-07-10', streak: 10 }], 2)
  assert.equal(two.title, 'كسبت يومين راحة')
})

test('announced once: nothing the first time, then each new day once', () => {
  const held = [{ earnedOn: '2026-07-05', streak: 5 }, { earnedOn: '2026-07-10', streak: 10 }]
  // no list stored yet (an update, a fresh install): nothing is announced
  assert.deepEqual(toAnnounce(held, null), [])
  const seeded = markAnnounced([], held.map(h => h.earnedOn))
  assert.deepEqual(seeded, ['2026-07-05', '2026-07-10'])
  assert.deepEqual(toAnnounce(held, seeded), [])
  // a new one is earned: only it
  const more = [...held, { earnedOn: '2026-07-15', streak: 15 }]
  assert.deepEqual(toAnnounce(more, seeded), [{ earnedOn: '2026-07-15', streak: 15 }])
  const after = markAnnounced(seeded, ['2026-07-15'])
  assert.deepEqual(toAnnounce(more, after), [], 'never again')
  // one earned and already used before he looked is not announced
  assert.deepEqual(toAnnounce([{ earnedOn: '2026-07-10', streak: 10 }], ['2026-07-05']), [{ earnedOn: '2026-07-10', streak: 10 }])
  // kept short, newest kept
  const long = markAnnounced(Array.from({ length: 80 }, (_, i) => `2026-01-${String(i).padStart(2, '0')}`), ['2026-09-01'])
  assert.equal(long.length, 60)
  assert.equal(long[long.length - 1], '2026-09-01')
})

test('today counted or still needed, in words (it left the flame)', () => {
  assert.deepEqual(todayMark('counted-trained'), { done: true, text: 'اليوم انحسب' })
  assert.deepEqual(todayMark('counted-rest'), { done: true, text: 'اليوم راحة مجدولة وانحسب' })
  assert.deepEqual(todayMark('override'), { done: true, text: 'اليوم راحة مجدولة وانحسب' })
  // a paid day holds the streak and adds nothing: not «انحسب»
  assert.deepEqual(todayMark('held'), { done: true, text: 'اليوم مغطّى بيوم راحة اختياري' })
  assert.equal(todayMark('owed').done, false)
  assert.equal(todayMark('owed').text, 'اليوم لسا يبي تمرين')
  assert.equal(todayMark('running').text, 'اليوم ينحسب لما تنهي الجلسة')
})

test('the announced list is a new key: per user, cleared by a reset, never read by classic', async () => {
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} }
  const { PER_USER_KEYS } = await import('../src/utils.js')
  assert.equal(REST_ANNOUNCED_KEY, 'meran_rest_announced')
  assert.ok(PER_USER_KEYS.includes(REST_ANNOUNCED_KEY))
  const classic = ['classic/src/App.jsx', 'classic/src/utils.js'].map(f => { try { return readFileSync(new URL(`../${f}`, import.meta.url), 'utf8') } catch { return '' } }).join('\n')
  assert.ok(!classic.includes(REST_ANNOUNCED_KEY))
})

test('Home: the flame is filled by the rest days, and only the number is drawn', () => {
  const s = readFileSync(new URL('../src/components/streak/StreakNumber.jsx', import.meta.url), 'utf8')
  assert.match(s, /filled=\{rest > 0\}/)
  assert.match(s, /glow/)
  assert.match(s, /aria-label=\{`الستريك .*\$\{restSays\}/)
})
