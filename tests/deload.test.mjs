// Specs for the deload engine, run against the real module.
//
//   node --test tests/deload.test.mjs
//
// A deload is a stretch of lighter weights that has to leave no trace
// once it is over. What is pinned here is mostly the not-happening:
// the stored baseline is not touched, the progression engine does not
// read the lighter sessions as a decline, the suggestion does not
// pester someone who has nothing to deload from, and the streak gets
// no protection it did not earn.

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

const {
  deloadState, deloadWeight, startDeload, endDeload,
  sessionDeloadStamp, isDeloadSession, wasDeloadDay,
  daysSinceLastDeload, weeksOfHistory, suggestDeload, dismissSuggestion,
  DELOAD_DAYS, DELOAD_PCT, MIN_PCT, MAX_PCT,
  SUGGEST_AFTER_WEEKS, SUGGEST_COOLDOWN_DAYS, SUGGEST_MIN_STALLED,
} = await import('../src/deload.js')
const { roundToPlate, PLATE_STEP } = await import('../src/utils.js')

const CFG = { daysPerWeek: 3, deload: null, deloadHistory: [], deloadSuggestDismissedAt: null }
const day = (n) => `2026-03-${String(n).padStart(2, '0')}`

// ══ the lighter weight ════════════════════════════════════════

test('forty percent off is sixty percent left', () => {
  assert.equal(deloadWeight(100, 40), 60)
  assert.equal(deloadWeight(50, 40), 30)
})

test('the result lands on a real plate step', () => {
  // 62.5 × 0.6 = 37.5 exactly; 67.5 × 0.6 = 40.5, which no rack offers.
  assert.equal(deloadWeight(62.5, 40), 37.5)
  assert.equal(deloadWeight(67.5, 40) % PLATE_STEP, 0)
  assert.equal(deloadWeight(97.5, 40) % PLATE_STEP, 0)
})

test('it never suggests nothing', () => {
  // A suggestion of zero is not a suggestion.
  assert.equal(deloadWeight(2.5, 60), PLATE_STEP)
  assert.equal(deloadWeight(1, 60), PLATE_STEP)
})

test('a percentage outside the sane band is clamped, not obeyed', () => {
  assert.equal(deloadWeight(100, 99), 100 * (1 - MAX_PCT / 100))
  assert.equal(deloadWeight(100, 1), 100 * (1 - MIN_PCT / 100))
})

test('a bodyweight exercise is left exactly as it was', () => {
  assert.equal(deloadWeight('', 40), '')
  assert.equal(deloadWeight(0, 40), 0)
})

test('the plate step is shared, not re-guessed', () => {
  assert.equal(roundToPlate(41), 40)      // 1.0 below 40, 1.5 above → down
  assert.equal(roundToPlate(41.3), 42.5)  // 1.3 above 40, 1.2 below 42.5 → up
  assert.equal(roundToPlate(43.8), 45)
  assert.equal(roundToPlate(40), 40, 'a weight already on a step does not move')
})

// ══ where today sits ══════════════════════════════════════════

test('no deload stored is simply inactive', () => {
  const s = deloadState(CFG, day(10))
  assert.equal(s.active, false)
  assert.equal(s.lapsed, false)
})

test('the first day is day one of seven', () => {
  const cfg = startDeload(CFG, day(10))
  const s = deloadState(cfg, day(10))
  assert.equal(s.active, true)
  assert.equal(s.day, 1)
  assert.equal(s.totalDays, DELOAD_DAYS)
  assert.equal(s.daysLeft, DELOAD_DAYS - 1)
  assert.equal(s.pct, DELOAD_PCT)
})

test('the last day is still inside it', () => {
  const cfg = startDeload(CFG, day(10))
  const s = deloadState(cfg, day(16))   // 10 + 7 - 1
  assert.equal(s.active, true)
  assert.equal(s.day, DELOAD_DAYS)
  assert.equal(s.daysLeft, 0)
})

test('the day after is over, and says it lapsed', () => {
  // Nobody closed it because the app was shut when the day turned.
  const cfg = startDeload(CFG, day(10))
  const s = deloadState(cfg, day(17))
  assert.equal(s.active, false)
  assert.equal(s.lapsed, true, 'the caller needs to know there is one to file')
})

test('a deload dated in the future has not started', () => {
  const cfg = { ...CFG, deload: { from: day(20), plannedUntil: day(26), pct: 40 } }
  assert.equal(deloadState(cfg, day(10)).active, false)
  assert.equal(deloadState(cfg, day(10)).lapsed, false)
})

// ══ ending it ═════════════════════════════════════════════════

test('running to term files it with planned and actual the same', () => {
  const cfg = endDeload(startDeload(CFG, day(10)), day(16))
  const h = cfg.deloadHistory.at(-1)
  assert.equal(cfg.deload, null)
  assert.equal(h.from, day(10))
  assert.equal(h.plannedUntil, day(16))
  assert.equal(h.until, day(16))
  assert.equal(h.endedEarly, false)
})

test('ending early keeps the planned end and the real one apart', () => {
  // Otherwise the four unused days keep reading as deload days to
  // anything that looks at the history later.
  const cfg = endDeload(startDeload(CFG, day(10)), day(12))
  const h = cfg.deloadHistory.at(-1)
  assert.equal(h.plannedUntil, day(16))
  assert.equal(h.until, day(12))
  assert.equal(h.endedEarly, true)
})

test('the days after an early end are not deload days', () => {
  const cfg = endDeload(startDeload(CFG, day(10)), day(12))
  assert.equal(wasDeloadDay(cfg, day(12)), true, 'the day it ended still counts')
  assert.equal(wasDeloadDay(cfg, day(13)), false)
  assert.equal(wasDeloadDay(cfg, day(16)), false, 'the planned end is not the real one')
})

test('ending nothing is a no-op, not a crash', () => {
  assert.deepEqual(endDeload(CFG, day(10)), CFG)
})

// ══ the session stamp ═════════════════════════════════════════

test('a session started under a deload carries the context, not a flag', () => {
  // A bare boolean stops meaning anything the moment the rules change.
  const cfg = startDeload(CFG, day(10))
  const stamp = sessionDeloadStamp(cfg, day(12))
  assert.deepEqual(stamp, { pct: DELOAD_PCT, from: day(10), until: day(16) })
})

test('outside a deload there is nothing to stamp', () => {
  assert.equal(sessionDeloadStamp(CFG, day(10)), null)
})

test('the stamp is what makes a session a deload session', () => {
  const cfg = startDeload(CFG, day(10))
  const session = { id: 1, date: day(12), deload: sessionDeloadStamp(cfg, day(12)) }
  const normal = { id: 2, date: day(20) }
  assert.equal(isDeloadSession(session), true)
  assert.equal(isDeloadSession(normal), false)
})

test('a session keeps its stamp after the deload is over', () => {
  // The decision is made when the session starts and stays made. A
  // stretch ending mid-workout does not turn the light weights already
  // on screen into normal training.
  const started = startDeload(CFG, day(10))
  const session = { id: 1, date: day(12), deload: sessionDeloadStamp(started, day(12)) }
  const after = endDeload(started, day(12))
  assert.equal(deloadState(after, day(13)).active, false)
  assert.equal(isDeloadSession(session), true, 'the stamp does not un-write itself')
  assert.equal(session.deload.pct, DELOAD_PCT)
})

// ══ history ═══════════════════════════════════════════════════

test('a day inside the running deload is a deload day', () => {
  const cfg = startDeload(CFG, day(10))
  assert.equal(wasDeloadDay(cfg, day(9)), false)
  assert.equal(wasDeloadDay(cfg, day(10)), true)
  assert.equal(wasDeloadDay(cfg, day(16)), true)
  assert.equal(wasDeloadDay(cfg, day(17)), false)
})

test('never having had one is null, not zero days ago', () => {
  assert.equal(daysSinceLastDeload(CFG, day(10)), null)
})

test('days since counts from the day it actually ended', () => {
  const cfg = endDeload(startDeload(CFG, day(1)), day(3))   // early
  assert.equal(daysSinceLastDeload(cfg, day(13)), 10)
})

test('weeks of history come from the earliest session, not install date', () => {
  const sessions = [{ date: day(1) }, { date: day(15) }, { date: day(8) }]
  assert.equal(weeksOfHistory(sessions, day(29)), 4)
  assert.equal(weeksOfHistory([], day(29)), 0)
})

// ══ the suggestion ════════════════════════════════════════════

const longHistory = (weeks = 12) => {
  const out = []
  for (let i = 0; i < weeks * 3; i++) {
    const d = new Date(2026, 0, 1)
    d.setDate(d.getDate() + i * 2)
    out.push({ id: i + 1, date: d.toISOString() })
  }
  return out
}
const TODAY = '2026-06-01'

test('both conditions together, or nothing', () => {
  const sessions = longHistory()
  assert.ok(suggestDeload({ sessions, config: CFG, today: TODAY, stalledCount: SUGGEST_MIN_STALLED }))
})

test('stalled lifts alone are a bad week, not a deload', () => {
  // Plenty of stalling, but no history to have accumulated fatigue in.
  const sessions = longHistory(2)
  assert.equal(suggestDeload({ sessions, config: CFG, today: '2026-01-20', stalledCount: 5 }), null)
})

test('time alone is just a calendar', () => {
  const sessions = longHistory()
  assert.equal(suggestDeload({ sessions, config: CFG, today: TODAY, stalledCount: 0 }), null)
  assert.equal(suggestDeload({ sessions, config: CFG, today: TODAY, stalledCount: SUGGEST_MIN_STALLED - 1 }), null)
})

test('a new user is never asked', () => {
  // Weeks of real training, not weeks since the app was installed.
  const sessions = longHistory(SUGGEST_AFTER_WEEKS - 2)
  const today = '2026-02-20'
  assert.ok(weeksOfHistory(sessions, today) < SUGGEST_AFTER_WEEKS)
  assert.equal(suggestDeload({ sessions, config: CFG, today, stalledCount: 5 }), null)
})

test('turning it down buys silence, and only for a while', () => {
  const sessions = longHistory()
  const dismissed = dismissSuggestion(CFG, TODAY)
  const args = { sessions, config: dismissed, stalledCount: 5 }

  assert.equal(suggestDeload({ ...args, today: TODAY }), null, 'silent the same day')
  assert.equal(
    suggestDeload({ ...args, today: '2026-06-10' }), null,
    `still silent inside ${SUGGEST_COOLDOWN_DAYS} days`,
  )
  assert.ok(suggestDeload({ ...args, today: '2026-07-01' }), 'it comes back afterwards')
})

test('it does not interrupt a deload already running', () => {
  const sessions = longHistory()
  const cfg = startDeload(CFG, TODAY)
  assert.equal(suggestDeload({ sessions, config: cfg, today: TODAY, stalledCount: 5 }), null)
})

test('one deload does not immediately suggest the next', () => {
  const sessions = longHistory()
  const cfg = endDeload(startDeload(CFG, '2026-05-20'), '2026-05-26')
  assert.equal(suggestDeload({ sessions, config: cfg, today: TODAY, stalledCount: 5 }), null)
})

test('starting one clears a previous dismissal', () => {
  const cfg = startDeload(dismissSuggestion(CFG, TODAY), TODAY)
  assert.equal(cfg.deloadSuggestDismissedAt, null)
})

test('the reason carries the numbers behind it', () => {
  const sessions = longHistory()
  const r = suggestDeload({ sessions, config: CFG, today: TODAY, stalledCount: 3 })
  assert.equal(r.stalledCount, 3)
  assert.ok(r.weeksOfHistory >= SUGGEST_AFTER_WEEKS)
  assert.equal(r.suggestedDays, DELOAD_DAYS)
  assert.equal(r.suggestedPct, DELOAD_PCT)
})

// ══ the baseline survives ═════════════════════════════════════
// The hazard this whole design exists to avoid: hf_last_weights
// outranks session history in every weight suggestion, so if a deload
// session wrote into it the lighter numbers would become the new
// normal and the deload would never end. finishSession skips the
// snapshot for a stamped session; this reproduces both halves of that
// rule against the real predicate.

/** What App.jsx does at the end of a session, reduced to its decision. */
function finishInto(store, session, exerciseMapping = {}) {
  if (isDeloadSession(session)) return store   // the guard
  const next = { ...store }
  for (const ex of session.exercises || []) {
    const ws = (ex.sets || []).map(s => parseFloat(s.weight)).filter(w => w > 0)
    if (ws.length) next[ex.name.toLowerCase()] = ws[ws.length - 1]
  }
  return next
}

const sessionAt = (d, weight, stamp = null) => ({
  id: Date.parse(d), date: d,
  exercises: [{ name: 'Bench Press', sets: [{ weight: String(weight), reps: '10', done: true }] }],
  ...(stamp ? { deload: stamp } : null),
})

test('a deload session does not touch the stored baseline', () => {
  const cfg = startDeload(CFG, day(10))
  let store = { 'bench press': 100 }

  store = finishInto(store, sessionAt(day(11), 60, sessionDeloadStamp(cfg, day(11))))
  assert.equal(store['bench press'], 100, 'the light weight was not written')
})

test('the weight is exactly what it was when the deload ends', () => {
  // No restore step exists, and none is needed — nothing was overwritten.
  const started = startDeload(CFG, day(10))
  let store = { 'bench press': 100 }

  for (const d of [day(11), day(13), day(15)]) {
    store = finishInto(store, sessionAt(d, deloadWeight(100, DELOAD_PCT), sessionDeloadStamp(started, d)))
  }
  const after = endDeload(started, day(16))
  assert.equal(deloadState(after, day(17)).active, false)
  assert.equal(store['bench press'], 100, 'back to the pre-deload weight, to the kilo')
})

test('a normal session still writes the baseline', () => {
  // The guard must not have quietly broken ordinary training.
  let store = { 'bench press': 100 }
  store = finishInto(store, sessionAt(day(20), 105))
  assert.equal(store['bench press'], 105)
})

test('training heavy the day after it ends is recorded normally', () => {
  const cfg = endDeload(startDeload(CFG, day(10)), day(16))
  let store = { 'bench press': 100 }
  const stamp = sessionDeloadStamp(cfg, day(17))
  assert.equal(stamp, null, 'no stamp once it is over')
  store = finishInto(store, sessionAt(day(17), 102.5, stamp))
  assert.equal(store['bench press'], 102.5)
})

// ══ the engines ignore the light week ═════════════════════════

const { analyzeProgression } = await import('../src/progression.js')
const { getExerciseStats } = await import('../src/utils.js')

const lift = (d, weight, reps, stamp = null) => ({
  id: Date.parse(d), date: d,
  exercises: [{
    name: 'Bench Press',
    sets: Array.from({ length: 3 }, () => ({ weight: String(weight), reps: String(reps), done: true })),
  }],
  ...(stamp ? { deload: stamp } : null),
})

const TARGET = { id: 'volume', base: 12, top: 15 }

test('a deload week leaves the progression exactly where it was', () => {
  // Read as ordinary training the light week is a collapse: the working
  // weight drops and the rep target goes unmet, and the engine answers
  // a planned taper with advice to taper further.
  const real = [lift(day(1), 60, 12), lift(day(3), 60, 12)]
  const stamp = { pct: 40, from: day(5), until: day(11) }
  const withDeload = [...real, lift(day(6), 36, 12, stamp), lift(day(8), 36, 12, stamp)]

  const before = analyzeProgression(real, 'Bench Press', {}, TARGET)
  const after  = analyzeProgression(withDeload, 'Bench Press', {}, TARGET)

  assert.equal(after.workingWeight, before.workingWeight, 'still 60, not 36')
  assert.equal(after.hint, before.hint)
  assert.equal(after.failedAtWeight, 0, 'a light week is not a failed week')
})

test('a deload week cannot trigger the drop-the-weight advice', () => {
  const stamp = { pct: 40, from: day(5), until: day(11) }
  const sessions = [
    lift(day(1), 60, 12),
    lift(day(6), 36, 5, stamp),   // far under the target, twice
    lift(day(8), 36, 5, stamp),
  ]
  const r = analyzeProgression(sessions, 'Bench Press', {}, TARGET)
  assert.notEqual(r.hint, 'lower')
  assert.equal(r.workingWeight, 60)
})

test('the last-weight fallback skips the light week too', () => {
  // getExerciseStats is what answers when the saved snapshot has no
  // entry for an exercise, so the skip has to be here as well.
  const stamp = { pct: 40, from: day(5), until: day(11) }
  const sessions = [lift(day(1), 60, 12), lift(day(6), 36, 12, stamp)]
  assert.equal(getExerciseStats(sessions, 'Bench Press').lastWeight, 60)
})

test('ordinary sessions are still read normally', () => {
  // The skips must not have quietly broken training that was not a deload.
  const sessions = [lift(day(1), 60, 12), lift(day(3), 65, 12)]
  assert.equal(getExerciseStats(sessions, 'Bench Press').lastWeight, 65)
  assert.equal(analyzeProgression(sessions, 'Bench Press', {}, TARGET).workingWeight, 65)
})

// ══ dates are local, always ═══════════════════════════════════

test('a late-night session lands on its own local day', () => {
  // 01:00 local in UTC+3 is still the previous day in UTC. Anything
  // built on toISOString would file this a day early.
  const cfg = startDeload(CFG, day(10))
  const lateNight = new Date(2026, 2, 12, 1, 0, 0)
  assert.equal(deloadState(cfg, lateNight).active, true)
  assert.equal(deloadState(cfg, lateNight).day, 3)
  assert.equal(wasDeloadDay(cfg, lateNight), true)
})
