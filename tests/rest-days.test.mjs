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
  assert.match(c.lead, /ما عندك ولا يوم راحة اختياري/)
  assert.equal(c.keep, '')
  assert.equal(c.next, 'الجاي بعد 3 أيام محسوبة')
  assert.deepEqual(restDaysView(computeRecovery([], CFG, '2026-07-02')).held, [])
})

test('the words: dates in Arabic, Arabic counting', () => {
  const c = restDaysCopy(restDaysView(rec([1, 3, 5, 7, 9], '2026-07-12')), '2026-07-12')
  assert.equal(c.title, 'أيام الراحة الاختيارية: 1')
  assert.match(c.lead, /^عندك يوم راحة اختياري واحد\./)
  assert.deepEqual(c.held.map(h => h.text), ['كسبته الجمعة 10 يوليو لما وصل ستريكك 10'])
  assert.equal(c.keep, 'ما ينتهي — يبقى لك لين يفوتك يوم تمرين.')
  assert.deepEqual(c.used.map(u => u.text), ['استخدمته السبت 11 يوليو — كان من 5 يوليو'])
  const today = restDaysCopy(restDaysView(rec([1, 3, 5, 7, 9], '2026-07-10')), '2026-07-10')
  assert.equal(today.held[1].text, 'كسبته اليوم لما وصل ستريكك 10')
  assert.equal(restDaysAr(0), 'ولا يوم راحة اختياري')
  assert.equal(restDaysAr(1), 'يوم راحة اختياري واحد')
  assert.equal(restDaysAr(2), 'يومين راحة اختيارية')
  assert.equal(restDaysAr(3), '3 أيام راحة اختيارية')
  assert.equal(restDaysAr(11), '11 يوم راحة اختياري')
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
  assert.deepEqual(todayMark('counted-rest'), { done: true, text: 'اليوم انحسب' })
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
