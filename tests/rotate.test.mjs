// «بالتناوب» (src/plan/rotate.js): exercises that take turns on a plan day.
//
// حمزة: «اليوم رجول بسوي هيب ابدكشن اجي يوم ثاني للرجول يعمل هيب اددكشن.
// والميزة تسمح لي بالاختيار». Which one is due is never stored: it comes
// from his sessions of that plan day, so these check the derivation on
// his cases (the first time, a skipped day, the other one done by hand,
// swaps, his alias mapping, a deload), the edits «خطتي» writes (merge two
// rows, add, remove, reorder, split), and that the plan stays one both
// designs open — the builder keeping `rotate` on a round trip.
//
//   node --test tests/rotate.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import * as R from '../src/plan/rotate.js'
import * as V from '../src/plan/view.js'
import * as B from '../src/plan/builder.js'
import { BUILT_IN_PLANS, MUSCLE_GROUPS, DEFAULT_EXERCISE_MAPPING } from '../src/constants.js'
import { validatePlan } from '../src/plan/validate.js'
import { PER_USER_KEYS } from '../src/utils.js'

const clone = (x) => JSON.parse(JSON.stringify(x))
const AB = 'Machine Hip Abduction', AD = 'Machine Hip Adduction'
const LEGS = 2
const MAP = DEFAULT_EXERCISE_MAPPING

// The machines plan, started 1 Sep, its leg day ending with the two hip
// machines as rows of their own (as «ثبّت كلهم» pins them).
const base = clone(BUILT_IN_PLANS.find(p => p.planId === 'machine_beginner_3day'))
base.startDate = '2026-09-01'
base.weeklySchedule[LEGS].exercises.push(
  { name: AB, muscle: 'Legs', sets: 3, repsMin: 12, repsMax: 15, restSeconds: 90, by: 'user' },
  { name: AD, muscle: 'Legs', sets: 4, repsMin: 12, repsMax: 15, restSeconds: 90, by: 'user' },
)
// …and the same day with the two taking turns (one row, Abduction first).
const rotating = R.mergeRows(base, LEGS, 6, 7).plan

const DAY = 86400000
/** A saved session of plan day `d`, `daysAgo` before 19 Oct. */
const sess = (daysAgo, d, list, extra = {}) => {
  const t = Date.parse('2026-10-19T18:00:00Z') - daysAgo * DAY
  return {
    id: t, date: new Date(t).toISOString(), duration: 50, planDayIndex: d, planDayName: base.weeklySchedule[d].name,
    exercises: list.map((x, i) => (typeof x === 'string' ? { id: `e${i}`, name: x, muscle: 'Legs', sets: [{ weight: '30', reps: '12', done: true }] }
      : { id: `e${i}`, muscle: 'Legs', sets: [{ weight: '30', reps: '12', done: true }], ...x })),
    ...extra,
  }
}
const turn = (plan, sessions, opts = { mapping: MAP }) => {
  const j = plan.weeklySchedule[LEGS].exercises.findIndex(x => R.rotationOf(x))
  const t = R.rowTurn(plan, LEGS, j, sessions, opts)
  return t && { due: t.members[t.due], next: t.members[t.next] }
}

test('a row takes turns only with two names or more; its own name always one of them', () => {
  assert.deepEqual(R.rotationOf({ name: AB, rotate: [AB, AD] }), [AB, AD])
  assert.equal(R.rotationOf({ name: AB }), null)
  assert.equal(R.rotationOf({ name: AB, rotate: [AB] }), null, 'one name is not a rotation')
  assert.equal(R.rotationOf({ name: AB, rotate: [AB, ' machine hip abduction ', ''] }), null, 'the same name twice is one')
  assert.equal(R.rotationOf({ name: AB, rotate: 'Machine Hip Adduction' }), null, 'not a list')
  assert.deepEqual(R.rotationOf({ name: 'Leg Press', rotate: [AB, AD] }), ['Leg Press', AB, AD], 'a row whose name the list lacks: its name first')
  assert.deepEqual(R.rotationOf({ name: AD, rotate: [AB, AD, 7, null] }), [AB, AD], 'garbage dropped, the order kept')
})

test('merging two rows of a day: one row that takes turns, the larger sets, the plan one both designs open', () => {
  const legs = rotating.weeklySchedule[LEGS].exercises
  assert.equal(legs.length, 7, 'two rows became one')
  const row = legs[6]
  assert.deepEqual(row.rotate, [AB, AD])
  assert.equal(row.name, AB, 'the old design shows (and runs) the first, a real exercise')
  assert.ok(MUSCLE_GROUPS[row.muscle])
  assert.equal(row.sets, 4, 'the larger of 3 and 4')
  assert.deepEqual(row.was, { sets: 3 }, 'noted against what the row had, as every sets change is')
  assert.equal(validatePlan(rotating), null)
  // never in place
  assert.equal(base.weeklySchedule[LEGS].exercises.length, 8)
  // merged from the other card (k < j): in the earlier row's place, its names first
  const back = R.mergeRows(base, LEGS, 7, 6)
  assert.equal(back.at, 6)
  assert.deepEqual(back.plan.weeklySchedule[LEGS].exercises[6].rotate, [AD, AB])
  assert.equal(back.plan.weeklySchedule[LEGS].exercises[6].sets, 4)
  assert.equal(R.mergeRows(base, LEGS, 6, 6), null)
})

test('whose turn: the first when he never did either; then the other one, one leg day after another', () => {
  assert.deepEqual(turn(rotating, []), { due: AB, next: AD }, 'the first time: the first')
  const one = [sess(3, LEGS, ['Hack Squat', AB])]
  assert.deepEqual(turn(rotating, one), { due: AD, next: AB }, 'did abduction: adduction is due')
  const two = [sess(1, LEGS, ['Hack Squat', AD]), ...one]
  assert.deepEqual(turn(rotating, two), { due: AB, next: AD }, 'and back')
  // three names: each in its turn
  const three = R.setRotation(rotating, LEGS, 6, [AB, AD, 'Hip Thrust'])
  assert.deepEqual(turn(three, two), { due: 'Hip Thrust', next: AB })
  assert.deepEqual(turn(three, [sess(0, LEGS, ['Hip Thrust']), ...two]), { due: AB, next: AD })
})

test('a day he skipped ran nothing: the turn waits; another day doing one of them is not the leg day', () => {
  const s = [sess(6, LEGS, [AB])]
  // after it: a push day and a pull day, the leg day skipped (no session), a push day with abduction in it
  const later = [sess(1, 0, ['Hammer Strength Machine Bench Press', AB]), sess(3, 1, ['Lat Pulldown']), sess(5, 0, ['Pec Deck']), ...s]
  assert.deepEqual(turn(rotating, later), { due: AD, next: AB })
  // a leg day where he did neither: the turn still waits
  assert.deepEqual(turn(rotating, [sess(0, LEGS, ['Hack Squat', 'Leg Press']), ...later]), { due: AD, next: AB })
})

test('whatever he did counts: the other one by hand, a swap for this time, a remembered swap', () => {
  // the session started on abduction; he took it out and added adduction by hand
  assert.deepEqual(turn(rotating, [sess(2, LEGS, ['Hack Squat', AD])]), { due: AB, next: AD })
  // «بدّلها لـ … هالمرة» / the swap sheet to the other one: the name he did, not the one it replaced
  assert.deepEqual(turn(rotating, [sess(2, LEGS, [{ name: AD, originalName: AB }])]), { due: AB, next: AD })
  // a «بس هالمرة» swap to another machine: the turn of the one it replaced is used
  assert.deepEqual(turn(rotating, [sess(2, LEGS, [{ name: 'Hip Thrust', originalName: AB }])]), { due: AD, next: AB })
  // a remembered swap of abduction (hf_exercise_subs): its session runs the alternative for it
  assert.deepEqual(turn(rotating, [sess(2, LEGS, [{ name: 'Barbell Squat', originalName: AB }])]), { due: AD, next: AB })
  // both in one session (the two rows before he merged them): the latest in the list, so the first is due
  assert.deepEqual(turn(rotating, [sess(2, LEGS, [AB, AD])]), { due: AB, next: AD })
})

test('his alias mapping and his renamed names: «Hip Adduction» is the adduction machine', () => {
  const s = [sess(2, LEGS, ['Hip Adduction'])]
  assert.deepEqual(turn(rotating, s), { due: AB, next: AD })
  assert.deepEqual(turn(rotating, s, { mapping: {} }), { due: AB, next: AD }, 'nothing matched without the mapping: still the first')
  assert.deepEqual(turn(rotating, [sess(2, LEGS, ['Hip Abduction'])]), { due: AD, next: AB })
  // a session logged in another case
  assert.deepEqual(turn(rotating, [sess(2, LEGS, ['machine hip abduction'])]), { due: AD, next: AB })
})

test('a deload session counts as done; a session from before the plan began, or of another plan, does not', () => {
  const deload = [sess(2, LEGS, [AB], { deload: { pct: 40, start: '2026-10-10' } })]
  assert.deepEqual(turn(rotating, deload), { due: AD, next: AB })
  const before = [sess(60, LEGS, [AB])]   // 20 Aug, before the 1 Sep start
  assert.deepEqual(turn(rotating, before), { due: AB, next: AD })
  const other = [sess(2, LEGS, [AB], { planId: 'ppl_alex_lueth_v2' })]
  assert.deepEqual(turn(rotating, other), { due: AB, next: AD })
  // a session with nothing done on it is nothing
  const empty = [{ ...sess(2, LEGS, [AB]), exercises: [{ id: 'x', name: AB, muscle: 'Legs', sets: [{ weight: '', reps: '', done: false }] }] }]
  assert.deepEqual(turn(rotating, empty), { due: AB, next: AD })
})

test('the session starts on the one due: the day resolved, its list kept on the row', () => {
  const s = [sess(3, LEGS, [AB])]
  const day = R.resolveDay(rotating, LEGS, s, { mapping: MAP })
  const row = day.exercises[6]
  assert.equal(row.name, AD)
  assert.equal(row.muscle, 'Legs')
  assert.deepEqual(row.rotate, [AB, AD])
  assert.equal(day.exercises[0], rotating.weeklySchedule[LEGS].exercises[0], 'the other rows as they are')
  // a copy already resolved comes out the same (Home hands the session its resolved day)
  assert.equal(R.resolveDay(rotating, LEGS, s, { mapping: MAP }, day).exercises[6].name, AD)
  // a day with nothing taking turns: the same object
  assert.equal(R.resolveDay(rotating, 0, s), rotating.weeklySchedule[0])
  // and in the session: «المرة الجاية» is the one after what he is on
  assert.equal(R.nextMember([AB, AD], { name: AD }), AB)
  assert.equal(R.nextMember([AB, AD], { name: AB }), AD)
  assert.equal(R.nextMember([AB, AD, 'Hip Thrust'], { name: AD }), 'Hip Thrust')
})

test('«خطتي» reads the row: its names, which is due, the order from the one due; no «بدّلته» for a reorder', () => {
  const r = V.effectiveRow(rotating, LEGS, 6)
  assert.deepEqual(r.rotate, [AB, AD])
  assert.equal(r.swap, null)
  const turns = R.rotationTurns(rotating, [sess(3, LEGS, [AB])], { mapping: MAP })
  assert.equal(turns[LEGS][6].due, 1)
  assert.equal(turns[LEGS][0], null)
  assert.deepEqual(R.turnOrder(turns[LEGS][6]), [1, 0])
  // reordered: adduction leads, the row named for it — still no swap said
  const moved = R.moveInRotation(rotating, LEGS, 6, AD, -1)
  const row = moved.weeklySchedule[LEGS].exercises[6]
  assert.equal(row.name, AD)
  assert.deepEqual(row.rotate, [AD, AB])
  assert.equal(V.effectiveRow(moved, LEGS, 6).swap, null, 'abduction still takes its turns: nothing was swapped away')
  assert.equal(validatePlan(moved), null)
  // moved back: nothing noted
  const again = R.moveInRotation(moved, LEGS, 6, AB, -1)
  assert.equal(again.weeklySchedule[LEGS].exercises[6].was?.name, undefined)
  // a real swap of the leg press, then made to take turns: the swap is still said
  const swapped = V.swapRow(base, LEGS, 1, 'Hack Squat Machine')
  const turnsWith = R.addToRotation(swapped, LEGS, 1, 'Pendulum Squat').plan
  assert.deepEqual(V.effectiveRow(turnsWith, LEGS, 1).swap, { from: 'Leg Press', how: 'plan' })
})

test('«بالتناوب مع…»: one more, one out, the last one left alone; another row of the day joins instead', () => {
  const add = R.addToRotation(rotating, LEGS, 6, 'Hip Thrust')
  assert.deepEqual(add.plan.weeklySchedule[LEGS].exercises[6].rotate, [AB, AD, 'Hip Thrust'])
  assert.equal(add.at, 6)
  assert.equal(R.addToRotation(rotating, LEGS, 6, AD), null, 'already one of them')
  const out = R.removeFromRotation(add.plan, LEGS, 6, AD)
  assert.deepEqual(out.weeklySchedule[LEGS].exercises[6].rotate, [AB, 'Hip Thrust'])
  // the first out: the next leads, and the row is named for it (a swap of it, said honestly)
  const first = R.removeFromRotation(rotating, LEGS, 6, AB)
  const lone = first.weeklySchedule[LEGS].exercises[6]
  assert.equal(lone.name, AD)
  assert.equal(lone.rotate, undefined, 'one left: the row alone')
  assert.deepEqual(V.effectiveRow(first, LEGS, 6).swap, { from: AB, how: 'plan' })
  // from a card of the day: the leg curl joins the hack squat, its row goes
  const joined = R.addToRotation(base, LEGS, 0, 'Leg Curl')
  assert.equal(joined.at, 0)
  assert.deepEqual(joined.plan.weeklySchedule[LEGS].exercises[0].rotate, ['Hack Squat', 'Leg Curl'])
  assert.ok(!joined.plan.weeklySchedule[LEGS].exercises.some(x => x.name === 'Leg Curl'))
  // from the later card: the row moves up with the one removed above it
  const up = R.addToRotation(base, LEGS, 7, AB)
  assert.equal(up.at, 6)
  assert.deepEqual(up.plan.weeklySchedule[LEGS].exercises[6].rotate, [AD, AB])
  for (const p of [add.plan, out, first, joined.plan, up.plan]) assert.equal(validatePlan(p), null)
})

test('«فكّ التناوب»: each name a row again, on the row\'s numbers', () => {
  const own = V.setRowReps(rotating, LEGS, 6, [8, 12])
  const split = R.splitRotation(own, LEGS, 6)
  const legs = split.plan.weeklySchedule[LEGS].exercises
  assert.equal(split.count, 1)
  assert.equal(legs.length, 8)
  assert.equal(legs[6].name, AB)
  assert.equal(legs[6].rotate, undefined)
  assert.equal(legs[7].name, AD)
  assert.equal(legs[7].muscle, 'Legs')
  assert.deepEqual([legs[7].sets, legs[7].repsMin, legs[7].repsMax, legs[7].restSeconds, legs[7].repsOwn], [4, 8, 12, 90, true])
  assert.equal(legs[7].equip, 'machine')
  assert.equal(validatePlan(split.plan), null)
  assert.equal(R.splitRotation(base, LEGS, 0), null, 'a row that doesn\'t take turns')
})

test('the session finds the plan row of either name, and «دايماً بخطتي» swaps the one he is on', () => {
  assert.equal(V.findPlanRow(rotating, LEGS, { name: AD }), 6)
  assert.equal(V.findPlanRow(rotating, LEGS, { name: AB }), 6)
  assert.equal(V.findPlanRow(rotating, LEGS, { name: 'Hip Thrust', originalName: AD }), 6)
  const sw = R.swapMember(rotating, LEGS, 6, AD, 'Hip Thrust')
  assert.deepEqual(sw.weeklySchedule[LEGS].exercises[6].rotate, [AB, 'Hip Thrust'])
  assert.equal(R.swapMember(rotating, LEGS, 6, AD, AB), null, 'to the other one: the turns already have it')
  const first = R.swapMember(rotating, LEGS, 6, AB, 'Hip Thrust')
  assert.equal(first.weeklySchedule[LEGS].exercises[6].name, 'Hip Thrust')
  assert.deepEqual(first.weeklySchedule[LEGS].exercises[6].rotate, ['Hip Thrust', AD])
  // swapRow on a rotating row keeps its list in step
  const s = V.swapRow(rotating, LEGS, 6, 'Hip Thrust')
  assert.deepEqual(s.weeklySchedule[LEGS].exercises[6].rotate, ['Hip Thrust', AD])
})

test('«تسويها بالجلسة»: the one not due today is his plan\'s, never «مو بخطتك»', () => {
  const plan = clone(rotating)
  plan.weeklySchedule[LEGS].exercises.splice(6, 1, { name: AB, muscle: 'Legs', sets: 3, repsMin: 12, repsMax: 15, restSeconds: 90, rotate: [AB, AD] })
  const legRows = ['Hack Squat', 'Leg Press', 'Leg Curl', 'Leg Extension', 'Machine Glute Kickbacks', 'Standing Calf Raise']
  const his = [sess(1, LEGS, [...legRows, AD]), sess(4, LEGS, [...legRows, AB]), sess(8, LEGS, [...legRows, 'Hip Adduction']), sess(11, LEGS, [...legRows, AB])]
  assert.deepEqual(V.doneNotInPlan(plan, LEGS, his, { mapping: MAP }), [])
  // the same sessions without the rotation: both offered
  const plain = clone(plan)
  delete plain.weeklySchedule[LEGS].exercises[6].rotate
  assert.deepEqual(V.doneNotInPlan(plain, LEGS, his, { mapping: MAP }).map(x => x.name), [AD])
  // an edit: merging takes nothing off the day; a name out of the turns is noted as gone
  assert.deepEqual(V.dropsOf(base, rotating, { mapping: MAP }), [])
  const drops = V.dropsOf(rotating, R.removeFromRotation(rotating, LEGS, 6, AD), { mapping: MAP })
  assert.deepEqual(drops.map(x => x.keys), [['hip adduction', '#hip_adduction']])
})

test('the builder keeps the turns on a round trip, and a swap made in it takes the place of the first', () => {
  const st = B.fromHfPlan(rotating, { days: 4 })
  const cfg = { days: 4, goal: 'muscle', eq: st.eq, excluded: new Set(), dismissed: new Set(), picks: st.picks, mtool: {}, cycle: st.cycle, split: st.split, keepOrder: true }
  const same = B.toHfPlan(B.buildFromPicks(cfg), cfg, { today: '2026-10-19', base: rotating })
  const row = same.weeklySchedule[LEGS].exercises.find(x => x.rotate)
  assert.deepEqual(row?.rotate, [AB, AD])
  assert.equal(row.name, AB)
  assert.equal(validatePlan(same), null)
  assert.equal(same.weeklySchedule.flatMap(d => d.exercises).filter(x => x.rotate).length, 1, 'no other row picks it up')
  // a swap of the row in the builder (its «بدّله»): the new one leads, adduction still takes its turns
  const pick = st.picks.find(p => p.rotate)
  pick.was = { name: pick.orig.name, muscle: pick.orig.muscle }
  pick.id = 'hip_thrust'
  delete pick.name; delete pick.orig
  const swapped = B.toHfPlan(B.buildFromPicks(cfg), cfg, { today: '2026-10-19', base: rotating })
  const sr = swapped.weeklySchedule[LEGS].exercises.find(x => x.rotate)
  assert.equal(sr.rotate[0], sr.name)
  assert.equal(sr.rotate[1], AD)
  assert.equal(validatePlan(swapped), null)
  // and opened once more, the next save keeps it
  const st2 = B.fromHfPlan(swapped, { days: 4 })
  const cfg2 = { ...cfg, picks: st2.picks, eq: st2.eq }
  const again = B.toHfPlan(B.buildFromPicks(cfg2), cfg2, { today: '2026-10-20', base: swapped })
  assert.deepEqual(again.weeklySchedule[LEGS].exercises.find(x => x.rotate)?.rotate, sr.rotate)
})

test('«خلّهم بالتناوب» is offered on the two hip machines of one day, until he says «لا»', () => {
  const offers = R.rotationOffers(base, LEGS, { mapping: MAP })
  assert.equal(offers[6], 7)
  assert.equal(offers[7], 6)
  assert.ok(offers.slice(0, 6).every(x => x === -1), 'the hack squat and the leg press are not a pair')
  // already taking turns: nothing to offer
  assert.ok(R.rotationOffers(rotating, LEGS, { mapping: MAP }).every(x => x === -1))
  // a day without both: nothing
  assert.ok(R.rotationOffers(base, 0, { mapping: MAP }).every(x => x === -1))
  // under his mapping's name too
  const alias = clone(base)
  alias.weeklySchedule[LEGS].exercises[7].name = 'Hip Adduction'
  assert.equal(R.rotationOffers(alias, LEGS, { mapping: MAP })[6], 7)
  // waved off: never again on that day
  const id = R.offerId(base, LEGS, AB, AD)
  assert.equal(id, R.offerId(base, LEGS, AD, AB), 'one id for the pair, whichever card')
  assert.ok(R.rotationOffers(base, LEGS, { mapping: MAP, off: [id] }).every(x => x === -1))
  assert.equal(R.OFFERS_OFF_KEY, 'meran_rotate_off')
  assert.ok(PER_USER_KEYS.includes(R.OFFERS_OFF_KEY), 'his, per user: a data reset clears it')
})

test('every edit is a new plan; the stored one is never changed in place', () => {
  const before = JSON.stringify(rotating)
  R.addToRotation(rotating, LEGS, 6, 'Hip Thrust')
  R.removeFromRotation(rotating, LEGS, 6, AD)
  R.moveInRotation(rotating, LEGS, 6, AD, -1)
  R.splitRotation(rotating, LEGS, 6)
  R.swapMember(rotating, LEGS, 6, AD, 'Hip Thrust')
  R.mergeRows(rotating, LEGS, 0, 1)
  R.resolveDay(rotating, LEGS, [sess(1, LEGS, [AB])])
  assert.equal(JSON.stringify(rotating), before)
})
