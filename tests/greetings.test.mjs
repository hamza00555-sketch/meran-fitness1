// Specs for the line under the date on Home (src/greetings.js, the
// pools in src/constants.js GREETINGS).
//
//   node --test tests/greetings.test.mjs
//
// حمزة: «العبارات التشجيعية مكررة وكلها تتكلم عن الستريك». Pinned here:
//   · the copy — every pool big enough, every line short, one emoji at
//     most, the name only as «يا {name}», no tickets or balances on Home,
//     the streak only in the milestone pool, every placeholder fillable
//     and every count counted the Arabic way (1, 2, 3, 11)
//   · the situation — the most specific true thing about today wins,
//     and the training-day facts take turns instead of repeating
//   · the line — the same all day, a new one the next, no line again
//     before its pool is spent, deterministic
//   · a simulated month on the real engines — no repeats in 30 days,
//     the streak under 10% of what he sees

import test from 'node:test'
import assert from 'node:assert/strict'

globalThis.localStorage = {
  _d: new Map(),
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null },
  setItem(k, v) { this._d.set(k, String(v)) },
  removeItem(k) { this._d.delete(k) },
  clear() { this._d.clear() },
  key(i) { return [...this._d.keys()][i] ?? null },
  get length() { return this._d.size },
}

const { GREETINGS, NOTIFICATION_MESSAGES } = await import('../src/constants.js')
const {
  greetingFacts, greetingContext, pickGreeting, greetingToday, renderLine, fillable, lineId,
  GREETING_KEY, SOFT, isGreetingMilestone,
} = await import('../src/greetings.js')
const { PER_USER_KEYS, ls } = await import('../src/utils.js')
const { DAY_STATUS } = await import('../src/recovery.js')
const { simulate, shown } = await import('./greetings-sim.mjs')

const POOLS = Object.keys(GREETINGS)
const all = POOLS.flatMap(k => GREETINGS[k])
const emojiCount = (s) => (s.match(/\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*/gu) || []).length
const words = (s) => s.split(/\s+/).filter(w => /[\p{L}\p{N}{]/u.test(w)).length

// Every value a line can ask for, long on purpose.
const FULL = {
  day: 'أرجل', muscles: 'صدر، أكتاف، ترايسبس', tomorrow: 'سحب', restTomorrow: true,
  exercise: 'ضغط بنش مائل بالبار', weight: '102.5', kg: '2.5', when: 'قبل 3 أيام',
  month: 'سبتمبر', level: 12, pct: 40, n: 11,
}
const NOUN_FORMS = {
  day:     { 1: 'يوم واحد',   2: 'يومين',   3: '3 أيام',   11: '11 يوم' },
  session: { 1: 'جلسة وحدة',  2: 'جلستين',  3: '3 جلسات',  11: '11 جلسة' },
  set:     { 1: 'مجموعة وحدة', 2: 'مجموعتين', 3: '3 مجموعات', 11: '11 مجموعة' },
}
const TICKETS = /تذكر|تذاكر|🎟|رصيد|كريدت|credit/i
const STREAK_WORDS = /ستريك|سلسل|على التوالي|ورا بعض|متواصل|بدون توقف/

// ══ the copy ═══════════════════════════════════════════════════

test('a pool for every situation, none of them thin', () => {
  assert.ok(POOLS.length >= 12, `${POOLS.length} pools`)
  for (const k of ['fresh', 'milestone', 'deload', 'comeback', 'done', 'doneRecord', 'restTaken', 'afterRest',
                   'missed', 'rest', 'raise', 'newWeight', 'planChange', 'goal', 'report', 'level', 'firstOfWeek',
                   'early', 'late', 'friday', 'push', 'pull', 'legs', 'upper', 'lower', 'full', 'train']) {
    assert.ok(GREETINGS[k], `missing pool ${k}`)
    assert.ok(GREETINGS[k].length >= 8, `${k}: ${GREETINGS[k].length}`)
  }
  // Every training day ends in «done»: it needs a month's worth.
  assert.ok(GREETINGS.done.length >= 24, `done: ${GREETINGS.done.length}`)
  assert.ok(GREETINGS.rest.length >= 15, `rest: ${GREETINGS.rest.length}`)
})

test('no line is repeated, inside a pool or across them, and every id is unique', () => {
  assert.equal(new Set(all).size, all.length)
  assert.equal(new Set(all.map(lineId)).size, all.length)
})

test('short: ten words or fewer as written, and never past two rows once filled', () => {
  for (const l of all) assert.ok(words(l) <= 10, `${words(l)} words: ${l}`)
  // Measured in the real header (iPhone SE, 287px): 56 characters with
  // the longest exercise name still fit in the two-row clamp.
  for (const k of POOLS) for (const l of GREETINGS[k]) {
    const out = renderLine(l, { ...FULL, n: 11 }, 'حمزة')
    assert.ok(out.length <= 56, `${out.length} chars: ${out}`)
  }
})

test('an emoji now and then, never two, and most lines none', () => {
  for (const l of all) assert.ok(emojiCount(l) <= 1, l)
  const withEmoji = all.filter(l => emojiCount(l) === 1).length
  assert.ok(withEmoji < all.length / 3, `${withEmoji} of ${all.length} carry an emoji`)
})

test('the name only as «يا {name}», and not in every line', () => {
  for (const l of all) {
    const bare = l.replace(/يا \{name\}/g, '')
    assert.ok(!bare.includes('{name}'), l)
  }
  const named = all.filter(l => l.includes('{name}')).length
  assert.ok(named < all.length / 2, `${named} of ${all.length} name him`)
})

test('only known placeholders', () => {
  const known = new Set(['name', 'day', 'muscles', 'tomorrow', 'exercise', 'weight', 'kg', 'when', 'month', 'level', 'pct',
                         'n:day', 'n:session', 'n:set', '+restTomorrow'])
  for (const l of all) for (const [, t] of l.matchAll(/\{([^}]+)\}/g)) assert.ok(known.has(t), `{${t}} in ${l}`)
})

test('no line talks about tickets or balances — Home shows the streak number only', () => {
  for (const l of all) assert.ok(!TICKETS.test(l), l)
})

test('a rest paid from what he earned is never called a ticket, a credit or optional', () => {
  for (const k of ['restTaken', 'afterRest', 'missed']) {
    for (const l of GREETINGS[k]) assert.ok(!/تذكر|تذاكر|رصيد|كريدت|اختياري|ستريك|سلسل|محفوظ/.test(l), `${k}: ${l}`)
  }
})

test('the streak lives in the milestone pool only', () => {
  for (const k of POOLS.filter(k => k !== 'milestone')) {
    for (const l of GREETINGS[k]) assert.ok(!STREAK_WORDS.test(l), `${k}: ${l}`)
  }
  for (const l of GREETINGS.milestone) assert.ok(l.includes('{n:day}'), l)
})

test('no Latin runs in the copy (letter-spacing hazard)', () => {
  for (const l of all) assert.deepEqual(l.replace(/\{[^}]+\}/g, '').match(/[A-Za-z]+/g) || [], [], l)
})

test('every line renders whole with every value present — no braces, no undefined', () => {
  for (const k of POOLS) for (const l of GREETINGS[k]) {
    assert.ok(fillable(l, FULL), `${k}: not fillable: ${l}`)
    const out = renderLine(l, FULL, 'حمزة')
    assert.ok(!/[{}]|undefined|null|NaN/.test(out), `${k}: ${out}`)
    assert.ok(!/\s[،,]|\s{2}/.test(out), `${k}: spacing: ${out}`)
  }
})

test('counts are counted the Arabic way for 1, 2, 3 and 11', () => {
  let checked = 0
  for (const k of POOLS) for (const l of GREETINGS[k]) {
    const m = l.match(/\{n:(day|session|set)\}/)
    if (!m) continue
    for (const n of [1, 2, 3, 11]) {
      const out = renderLine(l, { ...FULL, n }, 'حمزة')
      assert.ok(out.includes(NOUN_FORMS[m[1]][n]), `${k} n=${n}: ${out}`)
      assert.ok(!/(^|\s)[12] (يوم|أيام|جلس|مجموع)/.test(out), `${k} n=${n}: ${out}`)
      checked++
    }
  }
  assert.ok(checked >= 40, `${checked} renders checked`)
})

test('a line whose value is missing today is not drawn', () => {
  assert.equal(fillable('بكرة {tomorrow}، فنم بدري الليلة', {}), false)
  assert.equal(fillable('بكرة راحة{+restTomorrow}، واستاهلتها', { restTomorrow: false }), false)
  assert.equal(fillable('{n:day} ورا بعض', { n: 0 }), false)
  assert.equal(renderLine('بكرة راحة{+restTomorrow}، واستاهلتها', { restTomorrow: true }), 'بكرة راحة، واستاهلتها')
})

test('without a name the line still reads: «يا بطل»', () => {
  assert.equal(renderLine('يلا يا {name}، الجيم يستناك', {}, ''), 'يلا يا بطل، الجيم يستناك')
  assert.equal(renderLine('يلا يا {name}، الجيم يستناك', {}, 'البطل'), 'يلا يا بطل، الجيم يستناك')
  assert.equal(renderLine('يلا يا {name}، الجيم يستناك', {}, 'حمزة'), 'يلا يا حمزة، الجيم يستناك')
})

test('notification pools stayed well-formed', () => {
  for (const [k, list] of Object.entries(NOTIFICATION_MESSAGES)) {
    for (const n of list) {
      assert.ok(n.title && n.body, `${k}: ${JSON.stringify(n)}`)
      assert.equal(emojiCount(n.title), 1, `${k}: ${n.title}`)
    }
  }
})

// ══ the situation ══════════════════════════════════════════════

const T = '2026-10-19'   // a Monday
const push = { word: 'دفع', muscles: 'صدر، أكتاف، ترايسبس', focus: 'push' }
const F = (o = {}) => ({ today: T, hour: 14, weekday: 1, month: 'أكتوبر', day: push, soft: {}, ...o })
const ctxOf = (o, mem) => greetingContext(F(o), mem).ctx

test('the states of the day, most specific first', () => {
  assert.equal(ctxOf({ fresh: true, rest: true }), 'fresh')
  assert.equal(ctxOf({ milestone: 30, done: true, record: { weight: '100', exercise: 'سكوات' } }), 'milestone')
  assert.equal(ctxOf({ done: true, record: { weight: '100', exercise: 'سكوات', id: 1 }, deload: { pct: 40, daysLeft: 3 } }), 'doneRecord')
  assert.equal(ctxOf({ done: true, deload: { pct: 40, daysLeft: 3 }, comeback: 9 }), 'done')
  assert.equal(ctxOf({ restTaken: true, deload: { pct: 40, daysLeft: 3 }, yesterday: 'miss' }), 'restTaken')
  assert.equal(ctxOf({ rest: true, deload: { pct: 40, daysLeft: 3 } }), 'rest', 'a deload says nothing on a rest day')
  assert.equal(ctxOf({ comeback: 9, deload: { pct: 40, daysLeft: 3 }, yesterday: 'miss' }), 'comeback')
  assert.equal(ctxOf({ deload: { pct: 40, daysLeft: 3 }, yesterday: 'paid' }), 'deload')
  assert.equal(ctxOf({ yesterday: 'paid' }), 'afterRest')
  assert.equal(ctxOf({ yesterday: 'miss' }), 'missed')
})

test('a training day: the facts in order, then the hour, Friday, and the day itself', () => {
  const soft = {
    newWeight: [{ key: 'pr:1', exercise: 'سكوات بالبار', weight: '102.5', when: 'أمس' }],
    raise: [{ key: 'raise:Bench Press', exercise: 'ضغط بنش بالبار', weight: '82.5' }],
    planChange: [{ key: 'plan:T-Bar Row', exercise: 'تجديف تي-بار' }],
    goal: [{ key: 'goal:2026-10', n: 2, month: 'أكتوبر' }],
    report: [{ key: 'report:2026-09', month: 'سبتمبر' }],
    level: [{ key: 'level:9', level: 9 }],
    firstOfWeek: [{ key: 'week:2026-10-17' }],
  }
  const order = SOFT.map(s => s.ctx)
  assert.deepEqual(order, ['newWeight', 'raise', 'planChange', 'goal', 'report', 'level', 'firstOfWeek'])
  for (let i = 0; i < order.length; i++) {
    const s = Object.fromEntries(order.slice(i).map(k => [k, soft[k]]))
    assert.equal(ctxOf({ soft: s, hour: 7, weekday: 5 }), order[i])
  }
  assert.equal(ctxOf({ hour: 7, weekday: 5, band: 'early' }), 'early')
  assert.equal(ctxOf({ hour: 23, band: 'late' }), 'late')
  assert.equal(ctxOf({ weekday: 5 }), 'friday')
  for (const [word, pool] of [['دفع', 'push'], ['سحب', 'pull'], ['أرجل', 'legs'], ['علوي', 'upper'], ['سفلي', 'lower'], ['شامل', 'full']]) {
    assert.equal(ctxOf({ day: { word, muscles: null, focus: pool } }), pool)
  }
  assert.equal(ctxOf({ day: null }), 'train', 'no plan: the generic training-day pool')
})

test('a fact once said rests, and a kind of fact waits its turn', () => {
  const raise = (key) => ({ soft: { raise: [{ key, exercise: 'ضغط بنش بالبار', weight: '82.5' }] } })
  const day1 = pickGreeting({ facts: F(raise('raise:Bench Press')) })
  assert.equal(day1.ctx, 'raise')
  assert.equal(day1.memory.facts['raise:Bench Press'], T)
  // Next day: the same raise, and another one — but a raise line led yesterday.
  const d2 = '2026-10-20'
  assert.equal(greetingContext(F({ today: d2, ...raise('raise:Squat') }), day1.memory).ctx, 'push')
  // Five days on, a different raise may lead; the same one rests a week.
  const d6 = '2026-10-24'
  assert.equal(greetingContext(F({ today: d6, ...raise('raise:Squat') }), day1.memory).ctx, 'raise')
  assert.equal(greetingContext(F({ today: d6, ...raise('raise:Bench Press') }), day1.memory).ctx, 'push')
  assert.equal(greetingContext(F({ today: '2026-10-26', ...raise('raise:Bench Press') }), day1.memory).ctx, 'raise')
})

test('a record greeted on its own day is not announced again the next morning', () => {
  const rec = { weight: '102.5', exercise: 'سكوات بالبار', id: 77 }
  const d1 = pickGreeting({ facts: F({ done: true, record: rec }) })
  assert.equal(d1.ctx, 'doneRecord')
  const next = F({ today: '2026-10-20', soft: { newWeight: [{ key: 'pr:77', exercise: 'سكوات بالبار', weight: '102.5', when: 'أمس' }] } })
  assert.notEqual(greetingContext(next, d1.memory).ctx, 'newWeight')
  assert.equal(greetingContext(next, null).ctx, 'newWeight', 'unless Home never greeted it')
})

// ── the facts, read from the app's own state ──

const sess = (day, hh, planDayName, exercises, extra = {}) => {
  const [y, m, d] = day.split('-').map(Number)
  const at = new Date(y, m - 1, d, hh, 0, 0)
  return { id: at.getTime(), date: at.toISOString(), planDayName, exercises, ...extra }
}
const ex = (name, muscle, weight, reps = ['12', '12', '11']) => ({ name, muscle, sets: reps.map(r => ({ weight: String(weight), reps: r, done: true })) })
const PLAN = { planId: 'p', weeklySchedule: [
  { name: 'Push — صدر، أكتاف، ترايسبس', exercises: [{ name: 'Bench Press', muscle: 'Chest', sets: 3 }, { name: 'Triceps Pushdown', muscle: 'Triceps', sets: 3 }] },
  { name: 'Pull — ظهر، بايسبس', exercises: [{ name: 'Lat Pulldown', muscle: 'Back', sets: 3 }, { name: 'Barbell Curl', muscle: 'Biceps', sets: 3 }] },
  { name: 'Legs — أرجل', exercises: [{ name: 'Barbell Squat', muscle: 'Legs', sets: 3 }] },
] }
const rec = (o = {}) => ({ status: DAY_STATUS.WORKOUT, consistencyStreak: 20, ledger: [], tomorrowExpected: DAY_STATUS.WORKOUT, daysSinceLastWorkout: 1, ...o })

test('facts: the milestone only on the day it lands, once today counts', () => {
  const counted = rec({ status: DAY_STATUS.COMPLETED, consistencyStreak: 14, ledger: [{ date: T, kind: 'eligible', completed: true }] })
  assert.equal(greetingFacts({ recovery: counted, today: T }).milestone, 14)
  const owed = rec({ consistencyStreak: 14, ledger: [{ date: T, kind: 'miss', completed: false }] })
  assert.equal(greetingFacts({ recovery: owed, today: T }).milestone, null, 'yesterday reached it; today is still owed')
  const between = rec({ status: DAY_STATUS.COMPLETED, consistencyStreak: 31, ledger: [{ date: T, kind: 'eligible', completed: true }] })
  assert.equal(greetingFacts({ recovery: between, today: T }).milestone, null)
  for (const n of [7, 14, 30, 50, 100, 365, 500]) assert.ok(isGreetingMilestone(n), String(n))
  for (const n of [8, 10, 21, 31, 99, 450]) assert.ok(!isGreetingMilestone(n), String(n))
})

test('facts: yesterday paid, yesterday missed, today rested', () => {
  const y = '2026-10-18'
  assert.equal(greetingFacts({ recovery: rec({ ledger: [{ date: y, kind: 'paid' }] }), today: T }).yesterday, 'paid')
  assert.equal(greetingFacts({ recovery: rec({ ledger: [{ date: y, kind: 'miss' }] }), today: T }).yesterday, 'miss')
  assert.equal(greetingFacts({ recovery: rec({ ledger: [{ date: y, kind: 'eligible' }] }), today: T }).yesterday, null)
  const f = greetingFacts({ recovery: rec({ status: DAY_STATUS.REST_TAKEN }), plan: PLAN, planIndex: 1, today: T })
  assert.equal(f.restTaken, true)
  assert.equal(f.tomorrow, 'سحب', 'tomorrow is the next plan day, as one word')
})

test('facts: today\'s plan day by its word and muscles; a free day falls back', () => {
  const f = greetingFacts({ recovery: rec(), plan: PLAN, planIndex: 3, today: T })
  assert.deepEqual(f.day, { word: 'دفع', muscles: 'صدر، أكتاف، ترايسبس', focus: 'push' })
  assert.equal(greetingFacts({ recovery: rec(), plan: PLAN, planIndex: 2, today: T }).day.focus, 'legs')
  assert.equal(greetingFacts({ recovery: rec(), today: T }).day, null)
})

test('facts: trained today — the day, the sets, a record against every day before', () => {
  const sessions = [
    sess(T, 18, 'Legs — أرجل', [ex('Barbell Squat', 'Legs', 105)]),
    sess('2026-10-16', 18, 'Legs — أرجل', [ex('Barbell Squat', 'Legs', 100)]),
  ]
  const f = greetingFacts({ sessions, recovery: rec({ status: DAY_STATUS.COMPLETED }), today: T })
  assert.equal(f.done, true)
  assert.equal(f.doneDay, 'أرجل')
  assert.equal(f.setsToday, 3)
  assert.equal(f.record.weight, '105')
  assert.equal(f.record.exercise, 'سكوات بالبار')
  // The first time an exercise is done is not a record: nothing to beat.
  const first = greetingFacts({ sessions: [sessions[0]], recovery: rec({ status: DAY_STATUS.COMPLETED }), today: T })
  assert.equal(first.record, null)
})

test('facts: a new weight last session is news for three days', () => {
  const older = sess('2026-10-13', 18, 'Push — صدر', [ex('Bench Press', 'Chest', 80)])
  const pr = sess('2026-10-17', 18, 'Push — صدر', [ex('Bench Press', 'Chest', 82.5)])
  const f = greetingFacts({ sessions: [pr, older], recovery: rec(), today: T })
  assert.deepEqual(f.soft.newWeight, [{ key: `pr:${pr.id}`, exercise: 'ضغط بنش بالبار', weight: '82.5', when: 'قبل يومين' }])
  assert.equal(greetingFacts({ sessions: [pr, older], recovery: rec(), today: '2026-10-21' }).soft.newWeight, undefined)
})

test('facts: a raise waiting in today\'s day, with the weight the player will suggest', () => {
  // Two sessions holding the bottom of 12–15, the last one at the top: raise.
  const sessions = [
    sess('2026-10-16', 18, 'Push', [ex('Bench Press', 'Chest', 80, ['15', '15', '14'])]),
    sess('2026-10-13', 18, 'Push', [ex('Bench Press', 'Chest', 80)]),
    sess('2026-10-10', 18, 'Push', [ex('Bench Press', 'Chest', 80)]),
  ]
  const f = greetingFacts({ sessions, plan: PLAN, planIndex: 0, recovery: rec(), today: T })
  // Keyed by the canonical (resolved, lower-case) name, as every engine matches lifts.
  assert.deepEqual(f.soft.raise, [{ key: 'raise:bench press', exercise: 'ضغط بنش بالبار', weight: '82.5' }])
  const deload = greetingFacts({ sessions, plan: PLAN, planIndex: 0, recovery: rec(), today: T, deload: { active: true, pct: 40, daysLeft: 3 } })
  assert.equal(deload.soft.raise, undefined, 'silent in a deload, as the player is')
})

test('facts: a swapped-in exercise never done yet', () => {
  const plan = structuredClone(PLAN)
  plan.weeklySchedule[1].exercises[0] = { name: 'T-Bar Row', muscle: 'Back', sets: 3, was: { name: 'Lat Pulldown', muscle: 'Back' } }
  const f = greetingFacts({ plan, planIndex: 1, recovery: rec(), today: T, sessions: [sess('2026-10-17', 18, 'Pull', [ex('Lat Pulldown', 'Back', 60)])] })
  assert.deepEqual(f.soft.planChange, [{ key: 'plan:t-bar row', exercise: 'تجديف تي-بار' }])
  const done = greetingFacts({ plan, planIndex: 1, recovery: rec(), today: T, sessions: [sess('2026-10-17', 18, 'Pull', [ex('T-Bar Row', 'Back', 50)])] })
  assert.equal(done.soft.planChange, undefined)
})

test('facts: the month goal in reach, the report unopened, a level close, the week\'s first session', () => {
  const days = ['2026-10-01', '2026-10-03', '2026-10-05', '2026-10-08', '2026-10-10', '2026-10-13', '2026-10-15']
  const sessions = days.map(d => sess(d, 18, 'Push', [ex('Bench Press', 'Chest', 80)]))
  const goals = { '2026-10': { kind: 'sessions', target: 9 } }
  assert.deepEqual(greetingFacts({ sessions, goals, recovery: rec(), today: T }).soft.goal, [{ key: 'goal:2026-10', n: 2, month: 'أكتوبر' }])
  assert.equal(greetingFacts({ sessions, goals: { '2026-10': { kind: 'sessions', target: 20 } }, recovery: rec(), today: T }).soft.goal, undefined)
  // Out of reach is not «in reach»: three to go on the last day of the month.
  assert.equal(greetingFacts({ sessions, goals: { '2026-10': { kind: 'sessions', target: 10 } }, recovery: rec(), today: '2026-10-31' }).soft.goal, undefined)
  // A lift goal stores the canonical name, as the report saves it (liftGains).
  const lift = { '2026-10': { kind: 'lift', lift: 'bench press', exercise: 'Bench Press', target: 82.5 } }
  assert.deepEqual(greetingFacts({ sessions, goals: lift, recovery: rec(), today: T }).soft.goal,
    [{ key: 'goal:2026-10', kg: '2.5', weight: '82.5', exercise: 'ضغط بنش بالبار' }])

  const nov = '2026-11-02'
  assert.deepEqual(greetingFacts({ sessions, recovery: rec(), today: nov }).soft.report, [{ key: 'report:2026-10', month: 'أكتوبر' }])
  assert.equal(greetingFacts({ sessions, recovery: rec(), today: nov, reportSeen: { '2026-10': true } }).soft.report, undefined)

  // Level 8 → 9 at 61200 XP.
  assert.deepEqual(greetingFacts({ xp: 60800, recovery: rec(), today: T }).soft.level, [{ key: 'level:9', level: 9 }])
  assert.equal(greetingFacts({ xp: 50000, recovery: rec(), today: T }).soft.level, undefined)

  // The training week starts on Saturday: Monday the 19th, last session Thursday the 15th.
  assert.deepEqual(greetingFacts({ sessions, recovery: rec(), today: T }).soft.firstOfWeek, [{ key: 'week:2026-10-17' }])
  const withSat = [sess('2026-10-17', 18, 'Push', [ex('Bench Press', 'Chest', 80)]), ...sessions]
  assert.equal(greetingFacts({ sessions: withSat, recovery: rec(), today: T }).soft.firstOfWeek, undefined)
  // By Wednesday the week is no longer young: no «أول الأسبوع».
  assert.equal(greetingFacts({ sessions, recovery: rec(), today: '2026-10-21' }).soft.firstOfWeek, undefined)
})

test('facts: the hour and the weekday', () => {
  const at = (h) => greetingFacts({ recovery: rec(), today: T, now: new Date(2026, 9, 19, h, 0) }).band
  assert.equal(at(4), null)
  assert.equal(at(6), 'early')
  assert.equal(at(14), null)
  assert.equal(at(23), 'late')
  assert.equal(at(1), 'late')
  assert.equal(greetingFacts({ recovery: rec(), today: '2026-10-23' }).weekday, 5, 'the 23rd is a Friday')
})

// ══ the line ═══════════════════════════════════════════════════

test('the same line all day: reopening changes nothing, not even the memory', () => {
  const a = pickGreeting({ facts: F(), name: 'حمزة' })
  const b = pickGreeting({ facts: F(), memory: a.memory, name: 'حمزة' })
  assert.equal(b.text, a.text)
  assert.equal(b.changed, false)
  assert.deepEqual(b.memory, a.memory)
})

test('a new line the next day', () => {
  const a = pickGreeting({ facts: F(), name: 'حمزة' })
  const b = pickGreeting({ facts: F({ today: '2026-10-20' }), memory: a.memory, name: 'حمزة' })
  assert.equal(b.ctx, a.ctx)
  assert.notEqual(b.text, a.text)
})

test('the day changes the line when the day itself changes: trained', () => {
  const a = pickGreeting({ facts: F() })
  const b = pickGreeting({ facts: F({ done: true, setsToday: 12, doneDay: 'دفع' }), memory: a.memory })
  assert.equal(b.ctx, 'done')
  assert.notEqual(b.text, a.text)
  const c = pickGreeting({ facts: F({ done: true, setsToday: 12, doneDay: 'دفع' }), memory: b.memory })
  assert.equal(c.text, b.text)
})

test('deterministic: the same day and memory give the same line', () => {
  for (const day of ['2026-10-19', '2026-11-03', '2027-01-01']) {
    assert.equal(pickGreeting({ facts: F({ today: day }) }).text, pickGreeting({ facts: F({ today: day }) }).text)
  }
})

test('no line comes round again before its pool is spent — then the oldest first', () => {
  const pool = GREETINGS.rest.filter(t => fillable(t, { tomorrow: 'دفع' }))
  let mem = null
  const seen = []
  for (let i = 0; i < pool.length * 2; i++) {
    const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)
    const r = pickGreeting({ facts: { today: day, rest: true, tomorrow: 'دفع', soft: {} }, memory: mem })
    assert.equal(r.ctx, 'rest')
    seen.push(r.id)
    mem = r.memory
  }
  assert.equal(new Set(seen.slice(0, pool.length)).size, pool.length, 'the whole pool before any repeat')
  assert.deepEqual(seen.slice(pool.length), seen.slice(0, pool.length), 'then round again, oldest first')
  assert.ok(mem.log.length <= 40, 'the memory stays small')
})

test('the app\'s call stores its own key and leaves the old design\'s alone', () => {
  localStorage.clear()
  const text = greetingToday({ name: 'حمزة', recovery: rec(), plan: PLAN, planIndex: 0, today: T, now: new Date(2026, 9, 19, 14) })
  assert.ok(text.length > 0)
  assert.ok(localStorage.getItem(GREETING_KEY), 'meran_greetings written')
  assert.equal(localStorage.getItem('hf_greeting_bags'), null)
  assert.equal(localStorage.getItem('hf_last_greeting'), null)
  assert.equal(greetingToday({ name: 'حمزة', recovery: rec(), plan: PLAN, planIndex: 0, today: T, now: new Date(2026, 9, 19, 20) }), text)
  assert.ok(PER_USER_KEYS.includes(GREETING_KEY), 'per user, and cleared with the rest of his data')
  ls.remove(GREETING_KEY)
})

// ══ a month on the real engines ════════════════════════════════

test('a normal month (PPL, two on one off): no line twice in 30 days, the streak a small minority', () => {
  const { entries } = simulate({
    topOn: { 'Bench Press': 1, 'Barbell Squat': 3 },
    opens: { '2026-10-24': { early: '06:40' }, '2026-11-05': { pre: '23:30', train: '00:10', post: '01:30' } },
  })
  const s = shown(entries)
  assert.ok(s.length >= 45, `${s.length} lines seen`)
  const ids = s.map(e => e.id)
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i)
  assert.deepEqual(dup, [], `repeated: ${dup.map(id => s.find(e => e.id === id).text).join(' | ')}`)
  const streaky = s.filter(e => e.ctx === 'milestone' || STREAK_WORDS.test(e.text)).length
  assert.ok(streaky / s.length < 0.1, `${streaky} of ${s.length} about the streak`)
  const kinds = new Set(s.map(e => e.ctx))
  assert.ok(kinds.size >= 10, `only ${[...kinds].join(', ')}`)
  for (const e of s) assert.ok(!TICKETS.test(e.text) && !/[{}]/.test(e.text), e.text)
})

test('his month — a paid rest, a missed day, two new weights — still true and never repeated', () => {
  let tapped = null, missed = null
  const { entries } = simulate({
    restTap: (day, i, r) => { if (!tapped && i >= 5 && r.usableCredits >= 1) { tapped = day; return true } return false },
    // After the tap he stays away: the rest days he still holds cover the
    // first workout days (from 21 Oct one comes every 3 counted days, so
    // he holds more than one), and the first with none left is the miss.
    miss: (day, i, r) => {
      if (missed || !tapped || day <= tapped) return false
      if (r.usableCredits === 0) missed = day
      return true
    },
    spendInHistory: (r) => (r.usableCredits || 0) >= 1,
    topOn: { 'Bench Press': 1, 'Barbell Squat': 4 },
  })
  assert.ok(tapped && missed, `tapped ${tapped}, missed ${missed}`)
  const s = shown(entries)
  const at = (day) => s.filter(e => e.day === day).map(e => e.ctx)
  assert.deepEqual(at(tapped), ['restTaken'])
  assert.ok(s.some(e => e.ctx === 'missed'), 'the day after the miss gets a kind line')
  for (const e of s.filter(e => ['restTaken', 'afterRest', 'missed'].includes(e.ctx))) {
    assert.ok(!/تذكر|تذاكر|رصيد|اختياري|ستريك/.test(e.text), e.text)
  }
  assert.equal(s.filter(e => e.ctx === 'doneRecord' || e.ctx === 'newWeight').length >= 2, true)
  const ids = s.map(e => e.id)
  assert.equal(new Set(ids).size, ids.length)
})
