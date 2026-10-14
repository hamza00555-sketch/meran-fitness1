// «خطتي» (src/plan/view.js): his plan as he actually runs it, the
// alternatives the swap offers, and the edits the view and the session's
// «دايماً بخطتي» write into hf_plan.
//
//   node --test tests/plan-view.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import * as V from '../src/plan/view.js'
import * as B from '../src/plan/builder.js'
import { BUILT_IN_PLANS, EXERCISE_ALTERNATIVES, MUSCLE_GROUPS } from '../src/constants.js'
import { validatePlan } from '../src/plan/validate.js'
import { mediaSlotFor } from '../src/exerciseMedia.js'
import { applyNext } from '../src/reportStory.js'

const machine = BUILT_IN_PLANS.find(p => p.planId === 'machine_beginner_3day')
const clone = (x) => JSON.parse(JSON.stringify(x))
const LEGS = 2   // Hack Squat, Leg Press, Leg Curl, Leg Extension, Kickbacks, Calf Raise
const SETTINGS = { id: 'volume', base: 12, top: 15 }

test('a remembered swap (hf_exercise_subs) shows what he will actually do, and what it replaced', () => {
  const subs = { 'Leg Press': 2 }   // Leg Press → its second alternative
  const row = V.effectiveRow(machine, LEGS, 1, { subs, repTarget: SETTINGS })
  assert.equal(row.planName, 'Leg Press')
  assert.equal(row.name, EXERCISE_ALTERNATIVES['Leg Press'][1])
  assert.deepEqual(row.swap, { from: 'Leg Press', how: 'sub' })
  // everything else stays the plan's: its sets and rest
  assert.equal(row.sets, 4)
  assert.equal(row.rest, 150)
  // and a row with no remembered swap says nothing
  assert.equal(V.effectiveRow(machine, LEGS, 0, { subs, repTarget: SETTINGS }).swap, null)
  // the effective day carries the names a session would start with
  assert.equal(V.effectiveDay(machine, LEGS, { subs }).exercises[1].name, row.name)
})

test('a swap written into the plan says what it replaced (was), until it is swapped back', () => {
  let plan = V.swapRow(machine, LEGS, 1, 'Barbell Squat')
  const row = plan.weeklySchedule[LEGS].exercises[1]
  assert.equal(row.name, 'Barbell Squat')
  assert.equal(row.muscle, 'Legs')
  assert.deepEqual(row.was, { name: 'Leg Press', muscle: 'Legs' })
  assert.equal(row.equip, 'barbell', 'the tool, as the builder tags it')
  assert.equal(row.sets, 4, 'his sets stay')
  assert.deepEqual(V.effectiveRow(plan, LEGS, 1).swap, { from: 'Leg Press', how: 'plan' })
  // a second swap still remembers the first thing the plan had
  plan = V.swapRow(plan, LEGS, 1, 'Hack Squat')
  assert.equal(plan.weeklySchedule[LEGS].exercises[1].was.name, 'Leg Press')
  // and back to it: nothing left to say
  plan = V.swapRow(plan, LEGS, 1, 'Leg Press')
  const back = plan.weeklySchedule[LEGS].exercises[1]
  assert.equal(back.name, 'Leg Press')
  assert.equal(back.was, undefined)
  assert.equal(V.effectiveRow(plan, LEGS, 1).swap, null)
  // never in place
  assert.equal(machine.weeklySchedule[LEGS].exercises[1].name, 'Leg Press')
  assert.equal(machine.weeklySchedule[LEGS].exercises[1].was, undefined)
})

test('a swap keeps the plan one both designs open', () => {
  const plan = V.swapRow(machine, 0, 2, 'Cable Fly')
  assert.equal(validatePlan(plan), null)
  for (const day of plan.weeklySchedule) for (const x of day.exercises) {
    assert.ok(MUSCLE_GROUPS[x.muscle], x.name)
    assert.ok(Number.isInteger(x.sets) && x.sets > 0, x.name)
  }
  // across groups (a curated alternative), the muscle follows the new exercise
  const face = V.swapRow(machine, 0, 4, 'Face Pull')
  assert.equal(face.weeklySchedule[0].exercises[4].muscle, V.muscleOf('Face Pull'))
  // a name the app does not know keeps the row's muscle
  const odd = V.swapRow(machine, 0, 4, 'Banded Pull Apart')
  assert.equal(odd.weeklySchedule[0].exercises[4].muscle, 'Shoulders')
  assert.equal(validatePlan(odd), null)
})

test('the reps: his own range only when he set it (repsOwn), else Settings', () => {
  assert.deepEqual(V.effectiveRow(machine, 0, 0, { repTarget: SETTINGS }).reps, { base: 12, top: 15 }, 'the template\'s 10 is not his')
  assert.equal(V.effectiveRow(machine, 0, 0, { repTarget: SETTINGS }).own, false)
  const mine = V.setRowReps(machine, 0, 0, [8, 12])
  const x = mine.weeklySchedule[0].exercises[0]
  assert.equal(x.repsOwn, true)
  assert.deepEqual([x.repsMin, x.repsMax], [8, 12])
  const row = V.effectiveRow(mine, 0, 0, { repTarget: SETTINGS })
  assert.deepEqual(row.reps, { base: 8, top: 12 })
  assert.equal(row.own, true)
  // back to Settings: the range stays written, but is not his
  const off = V.clearRowReps(mine, 0, 0)
  assert.equal(off.weeklySchedule[0].exercises[0].repsOwn, undefined)
  assert.deepEqual(V.effectiveRow(off, 0, 0, { repTarget: SETTINGS }).reps, { base: 12, top: 15 })
})

test('sets added or taken away are said against what the row had (was), or the template', () => {
  let plan = V.setRowSets(machine, 0, 1, 4)
  assert.equal(plan.weeklySchedule[0].exercises[1].sets, 4)
  assert.equal(plan.weeklySchedule[0].exercises[1].was.sets, 3)
  assert.equal(V.effectiveRow(plan, 0, 1).extra, 1)
  plan = V.setRowSets(plan, 0, 1, 5)
  assert.equal(plan.weeklySchedule[0].exercises[1].was.sets, 3, 'noted once')
  assert.equal(V.effectiveRow(plan, 0, 1).extra, 2)
  plan = V.setRowSets(plan, 0, 1, 3)
  assert.equal(plan.weeklySchedule[0].exercises[1].was, undefined, 'back to what it was: nothing to say')
  assert.equal(V.effectiveRow(plan, 0, 1).extra, 0)
  // 1 to 6, as the builder's stepper
  assert.equal(V.setRowSets(machine, 0, 1, 9).weeklySchedule[0].exercises[1].sets, V.MAX_SETS)
  assert.equal(V.setRowSets(machine, 0, 1, 0).weeklySchedule[0].exercises[1].sets, V.MIN_SETS)
  // a built-in plan's row changed with no note (an older edit): the template says
  const old = clone(machine)
  old.weeklySchedule[0].exercises[1].sets = 4
  assert.equal(V.effectiveRow(old, 0, 1).extra, 1)
  // a plan of his own with no note: nothing to compare, nothing said
  const own = { ...clone(machine), planId: 'custom_20261001' }
  own.weeklySchedule[0].exercises[1].sets = 4
  assert.equal(V.effectiveRow(own, 0, 1).extra, 0)
})

test('«مجموعة زيادة» in Arabic counting', () => {
  assert.equal(V.extraWords(1), 'مجموعة زيادة')
  assert.equal(V.extraWords(2), 'مجموعتين زيادة')
  assert.equal(V.extraWords(3), '3 مجموعات زيادة')
  assert.equal(V.extraWords(11), '11 مجموعة زيادة')
  assert.equal(V.extraWords(-1), 'مجموعة أقل')
  assert.equal(V.extraWords(-2), 'مجموعتين أقل')
  assert.equal(V.extraWords(0), '')
})

test('the rest: the plan\'s seconds, else the player\'s 90', () => {
  assert.equal(V.effectiveRow(machine, 0, 0).rest, 120)
  const bare = clone(machine)
  delete bare.weeklySchedule[0].exercises[0].restSeconds
  const row = V.effectiveRow(bare, 0, 0)
  assert.equal(row.rest, V.DEFAULT_REST)
  assert.equal(row.restSet, false)
  const set = V.setRowRest(machine, 0, 0, 75)
  assert.equal(set.weeklySchedule[0].exercises[0].restSeconds, 75)
  assert.equal(V.restLabel(90), '90 ث')
  assert.equal(V.restLabel(120), '2 د')
  assert.equal(V.restLabel(150), '2½ د')
})

test('the steppers walk the builder\'s own steps', () => {
  assert.deepEqual(V.stepList(V.REP_STEPS, [12, 15], 1), [12, 20])
  assert.deepEqual(V.stepList(V.REP_STEPS, [12, 15], -1), [10, 15])
  assert.deepEqual(V.stepList(V.REP_STEPS, [11, 13], 1), [12, 15], 'off the list: to its neighbour')
  assert.equal(V.stepList(V.REST_STEPS, 90, 1), 120)
  assert.equal(V.stepList(V.REST_STEPS, 240, 1), 240, 'stops at the end')
})

test('remove, and «تراجع» puts back exactly what was there; never the day\'s last exercise', () => {
  const out = V.removeRow(machine, 1, 2)
  assert.equal(out.plan.weeklySchedule[1].exercises.length, 4)
  assert.equal(out.row.name, 'Machine Pullover')
  assert.deepEqual(V.insertRow(out.plan, 1, 2, out.row), machine)
  const one = clone(machine)
  one.weeklySchedule[1].exercises = [one.weeklySchedule[1].exercises[0]]
  assert.equal(V.removeRow(one, 1, 0), null, 'a day with nothing in it is a plan the old design cannot open')
})

test('the day it opens on, and what each day tab says', () => {
  assert.deepEqual(V.dayMarks({ n: 3, planIndex: 7, status: 'training' }), { first: 1, marks: { 1: 'today' } })
  // done today: today's day is done, the next one is next
  assert.deepEqual(V.dayMarks({ n: 3, planIndex: 8, status: 'completed', doneToday: 7 }), { first: 2, marks: { 1: 'done', 2: 'next' } })
  // a rest day
  assert.deepEqual(V.dayMarks({ n: 3, planIndex: 8, status: 'recovery' }), { first: 2, marks: { 2: 'next' } })
  // a session running: its day
  assert.deepEqual(V.dayMarks({ n: 3, planIndex: 8, liveIndex: 8 }), { first: 2, marks: { 2: 'live' } })
  assert.deepEqual(V.dayMarks({ n: 0 }), { first: 0, marks: {} })
})

test('alternatives: the same muscle first (the swap table leading), then the same movement with another tool', () => {
  const lp = V.rankAlternatives('Leg Press')
  assert.equal(lp.muscle[0], 'Hack Squat', 'the swap table\'s first answer stays first')
  assert.ok(lp.muscle.includes('Leg Extension'), 'the catalogue\'s other front-thigh exercises')
  assert.ok(lp.tool.includes('Barbell Squat'), 'the squat on a bar: same movement, another tool')
  assert.ok(!lp.muscle.includes('Leg Press') && !lp.tool.includes('Leg Press'), 'never itself')
  const msp = V.rankAlternatives('Machine Shoulder Press')
  assert.ok(msp.tool.includes('Dumbbell Shoulder Press'))
  assert.ok(msp.muscle.every(n => !msp.tool.includes(n)), 'a name is offered once')
  // Pec Deck → the cable fly first, as the table says
  assert.equal(V.rankAlternatives('Pec Deck').muscle[0], 'Cable Fly')
  // pictured ones first: a card without a picture never comes before one with
  for (const g of [lp.muscle, lp.tool, msp.muscle, msp.tool]) {
    const pics = g.map(n => !!mediaSlotFor(n))
    assert.deepEqual(pics, [...pics].sort((a, b) => b - a))
  }
  // the day's other exercises are left out
  assert.ok(!V.rankAlternatives('Leg Press', { exclude: ['Hack Squat'] }).muscle.includes('Hack Squat'))
  // an exercise the catalogue does not know: its group's own exercises
  const odd = V.rankAlternatives('Squat Jump', { muscle: 'Legs' })
  assert.ok(odd.muscle.length >= 3 && odd.muscle.every(n => V.muscleOf(n) === 'Legs'))
  assert.deepEqual(V.rankAlternatives('Squat Jump', { muscle: 'Legs' }), odd, 'the same every time')
})

test('the session\'s exercise finds its plan row: by the plan\'s name, its own, or a remembered swap', () => {
  assert.equal(V.findPlanRow(machine, LEGS, { name: 'Barbell Squat', originalName: 'Leg Press' }), 1)
  assert.equal(V.findPlanRow(machine, LEGS, { name: 'Leg Curl' }), 2)
  const subs = { 'Leg Press': 2 }
  assert.equal(V.findPlanRow(machine, LEGS, { name: EXERCISE_ALTERNATIVES['Leg Press'][1], subs }), 1)
  assert.equal(V.findPlanRow(machine, LEGS, { name: 'Bench Press' }), -1)
  assert.equal(V.sessionDay(machine, { planDayIndex: 7 }), 1)
  assert.equal(V.sessionDay(machine, {}), null)
})

test('the builder keeps what a row was before he changed it — and a round trip with no change adds nothing', () => {
  const st = B.fromHfPlan(machine, { days: 4 })
  const cfg = { days: 4, goal: 'muscle', eq: st.eq, excluded: new Set(), dismissed: new Set(), picks: st.picks, mtool: {}, cycle: st.cycle, split: st.split, keepOrder: true }
  const same = B.toHfPlan(B.buildFromPicks(cfg), cfg, { today: '2026-10-14', base: machine })
  assert.ok(same.weeklySchedule.every(d => d.exercises.every(x => x.was === undefined)), 'nothing changed, nothing noted')
  // a set more on one row, in the builder
  st.picks[1].sets = 4
  const more = B.toHfPlan(B.buildFromPicks(cfg), cfg, { today: '2026-10-14', base: machine })
  assert.deepEqual(more.weeklySchedule[0].exercises[1].was, { sets: 3 })
  assert.equal(V.effectiveRow(more, 0, 1).extra, 1)
  // a swap made in the builder: the pick lets its stored row go and keeps a note
  const pick = st.picks[2]
  pick.was = { name: pick.orig.name, muscle: pick.orig.muscle }
  pick.id = 'cable_fly'; delete pick.name; delete pick.orig
  const swapped = B.toHfPlan(B.buildFromPicks(cfg), cfg, { today: '2026-10-14', base: machine })
  const row = swapped.weeklySchedule[0].exercises[2]
  assert.equal(row.name, 'Cable Fly')
  assert.deepEqual(V.effectiveRow(swapped, 0, 2).swap, { from: 'Pec Deck', how: 'plan' })
  // and a note opened again in the builder survives the next save
  const st2 = B.fromHfPlan(swapped, { days: 4 })
  const cfg2 = { ...cfg, picks: st2.picks, eq: st2.eq }
  const again = B.toHfPlan(B.buildFromPicks(cfg2), cfg2, { today: '2026-10-15', base: swapped })
  assert.equal(again.weeklySchedule[0].exercises[2].was?.name, 'Pec Deck')
  assert.equal(validatePlan(again), null)
})

test('«طبّقها على خطتي» notes the sets a row had before it added one', () => {
  const plan = clone(machine)
  const item = { kind: 'sets', muscle: 'Legs', area: 'hams', label: 'الفخذ الخلفي', perWeek: 4, min: 6, max: 20 }
  const out = applyNext({ plan, items: [item], config: { daysPerWeek: 4 } })
  const curl = out.plan.weeklySchedule[LEGS].exercises.find(x => x.name === 'Leg Curl')
  assert.ok(curl.sets > 3)
  assert.equal(curl.was.sets, 3)
  assert.equal(machine.weeklySchedule[LEGS].exercises[2].was, undefined, 'never in place')
})
