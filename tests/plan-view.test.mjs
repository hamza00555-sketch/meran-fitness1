// «خطتي» (src/plan/view.js): his plan as he actually runs it, the
// alternatives the swap offers, and the edits the view and the session's
// «دايماً بخطتي» write into hf_plan.
//
//   node --test tests/plan-view.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import * as V from '../src/plan/view.js'
import * as B from '../src/plan/builder.js'
import { BUILT_IN_PLANS, EXERCISE_ALTERNATIVES, MUSCLE_GROUPS, DEFAULT_EXERCISE_MAPPING } from '../src/constants.js'
import { validatePlan } from '../src/plan/validate.js'
import { mediaSlotFor, arabicName } from '../src/exerciseMedia.js'
import { planTitle } from '../src/plan/title.js'
import { applyNext } from '../src/reportStory.js'
import { PER_USER_KEYS } from '../src/utils.js'

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
  // a row: the other rows are «another tool»; a shrug or a carry is not a row
  const row = V.rankAlternatives('Seated Cable Row')
  assert.ok(row.tool.includes('Dumbbell Row') && row.tool.includes('Barbell Row'))
  assert.ok(!row.muscle.includes('Dumbbell Shrug') && !row.muscle.includes('Dumbbell Farmers Carry'))
  assert.ok(row.muscle.includes('Lat Pulldown'), 'the rest of the back')
  // the table's «Chest Supported Row Machine» is the catalogue's own, with its picture
  assert.equal(row.muscle[0], 'Chest-Supported Row')
  // what he has done before comes first: his gym's machine, picture or not
  const H = 'Hammer Strength Machine Bench Press'
  assert.notEqual(V.rankAlternatives(H).muscle[0], 'Chest Press Machine')
  assert.equal(V.rankAlternatives(H, { tried: (n) => n === 'Chest Press Machine' }).muscle[0], 'Chest Press Machine')
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

test('the machines plan is «خطة المبتدئ», and a plan stored with the old «المبتدأ» prints right without being rewritten', () => {
  assert.equal(machine.planName, 'خطة المبتدئ — ماشينات فقط')
  const stored = { ...clone(machine), planName: 'خطة المبتدأ — ماشينات فقط' }   // as on his phone
  assert.equal(planTitle(stored.planName), 'خطة المبتدئ — ماشينات فقط')
  assert.equal(stored.planName, 'خطة المبتدأ — ماشينات فقط', 'his stored plan is left as it is')
  // anything else passes through untouched
  assert.equal(planTitle('خطتي'), 'خطتي')
  assert.equal(planTitle(undefined), '')
})

test('every alternative a swap can offer has an Arabic name to show', () => {
  const names = new Set()
  for (const p of BUILT_IN_PLANS) for (const d of p.weeklySchedule || []) for (const e of d.exercises || []) names.add(e.name)
  for (const g of Object.values(MUSCLE_GROUPS)) for (const e of g.exercises || []) names.add(e.name)
  const missing = []
  for (const n of names) {
    // every one it could ever offer, not just the first eight
    const a = V.rankAlternatives(n, { max: { muscle: 99, tool: 99 } })
    for (const x of [...a.muscle, ...a.tool]) if (!arabicName(x)) missing.push(x)
  }
  assert.deepEqual([...new Set(missing)], [])
})

// ── «تسويها بالجلسة»: what he does on a day that his plan doesn't say ──
// حمزة: «في خطتي تمارين الرجلين مالقيت تمرين abdication و addactor معناها في
// تمارين كثير مو مضافه». His plan is the machines plan; its leg day has no
// hip abduction or adduction, and he adds both in his leg sessions.

const MAP = DEFAULT_EXERCISE_MAPPING
const DAY_MS = 86400000
const T0 = Date.parse('2026-10-14T18:00:00Z')
const sets = (n, w, r) => Array.from({ length: n }, () => ({ weight: String(w), reps: String(r), done: true }))
const lift = (name, n = 3, w = 30, r = 12, extra = {}) => ({ id: name, name, muscle: 'Legs', sets: sets(n, w, r), ...extra })
const LEG_ROWS = machine.weeklySchedule[LEGS].exercises.map(e => lift(e.name, e.sets, 60, 10))
// a planned session, `ago` days back, at the plan's counter `idx` (App stores the day reached)
const planned = (ago, idx, list, plan = machine) => ({
  id: T0 - ago * DAY_MS, date: new Date(T0 - ago * DAY_MS).toISOString(), duration: 55,
  planDayIndex: idx, planDayName: plan.weeklySchedule[idx % plan.weeklySchedule.length].name, exercises: list,
})
// His last four leg days (counter 11, 8, 5, 2 — newest first): the abduction
// machine in three of them (once logged under the mapping's «Hip Abduction»),
// the adduction machine in three, a sissy squat once; two pull days between,
// both with a face pull.
const HIS = [
  planned(1, 11, [...LEG_ROWS, lift('Machine Hip Abduction', 3, 32), lift('Machine Hip Adduction', 3, 27)]),
  planned(3, 10, [lift('Lat Pulldown', 4, 60), lift('Face Pull', 3, 15)]),
  planned(5, 8, [...LEG_ROWS, lift('Hip Abduction', 4, 30)]),
  planned(6, 7, [lift('Lat Pulldown', 4, 60), lift('Face Pull', 3, 15)]),
  planned(8, 5, [...LEG_ROWS, lift('Machine Hip Adduction', 3, 25), lift('Sissy Squat', 2, 0, 12)]),
  planned(12, 2, [...LEG_ROWS, lift('Machine Hip Abduction', 3, 28), lift('Machine Hip Adduction', 3, 25)]),
]
const names = (list) => list.map(x => x.name)

test('his case: the abduction and adduction machines, in 3 of his last 4 leg days, are what he does and the plan doesn\'t say', () => {
  const got = V.doneNotInPlan(machine, LEGS, HIS, { mapping: MAP })
  assert.deepEqual(names(got), ['Machine Hip Abduction', 'Machine Hip Adduction'])
  const [ab, ad] = got
  assert.deepEqual({ count: ab.count, of: ab.of, muscle: ab.muscle, key: ab.key }, { count: 3, of: 4, muscle: 'Legs', key: 'hip abduction' },
    '«Hip Abduction» and «Machine Hip Abduction» are one exercise (his mapping)')
  assert.equal(ab.sets, 3, 'the sets he usually does (3, 4, 3)')
  assert.equal(ad.count, 3)
  // the other days: the face pull in both pull days; push never done
  const all = V.fromSessions(machine, HIS, { mapping: MAP })
  assert.deepEqual(all.map(names), [[], ['Face Pull'], ['Machine Hip Abduction', 'Machine Hip Adduction']])
  // never in place
  assert.equal(machine.weeklySchedule[LEGS].exercises.length, 6)
})

test('a one-off is not a habit: once in his last four leg days is not offered', () => {
  const got = names(V.doneNotInPlan(machine, LEGS, HIS, { mapping: MAP }))
  assert.ok(!got.includes('Sissy Squat') && !got.includes('Assisted Sissy Squat'), got.join(', '))
  // and only the last four count: twice, but five and six leg days back
  const old = [
    planned(1, 14, LEG_ROWS), planned(3, 11, LEG_ROWS), planned(5, 8, LEG_ROWS), planned(7, 5, LEG_ROWS),
    planned(9, 2, [...LEG_ROWS, lift('Machine Hip Abduction')]), planned(11, 2, [...LEG_ROWS, lift('Machine Hip Abduction')]),
  ]
  assert.deepEqual(V.doneNotInPlan(machine, LEGS, old, { mapping: MAP }), [])
  // twice in the four is a habit
  old[0].exercises = [...LEG_ROWS, lift('Machine Hip Abduction')]
  old[3].exercises = [...LEG_ROWS, lift('Machine Hip Abduction')]
  assert.deepEqual(names(V.doneNotInPlan(machine, LEGS, old, { mapping: MAP })), ['Machine Hip Abduction'])
})

test('a new day is no exception: twice at the least, a one-off (a warm-up, a plank) never', () => {
  const two = [planned(1, 5, [...LEG_ROWS, lift('Machine Hip Adduction')]), planned(4, 2, [...LEG_ROWS, lift('Machine Hip Abduction')])]
  assert.deepEqual(V.doneNotInPlan(machine, LEGS, two, { mapping: MAP }), [], 'each once in two: neither')
  assert.deepEqual(V.doneNotInPlan(machine, LEGS, two.slice(0, 1), { mapping: MAP }), [], 'a day done once: nothing yet')
  assert.deepEqual(V.doneNotInPlan(machine, LEGS, [], { mapping: MAP }), [])
  // both times: a habit already
  two[1].exercises = [...two[1].exercises, lift('Machine Hip Adduction')]
  assert.deepEqual(names(V.doneNotInPlan(machine, LEGS, two, { mapping: MAP })), ['Machine Hip Adduction'])
  // the review's cases: a one-set treadmill on a day done once, a plank once in two
  const tread = { ...lift('Treadmill', 1, 0, 10), muscle: 'Cardio' }
  assert.deepEqual(V.doneNotInPlan(machine, LEGS, [planned(1, 2, [tread, ...LEG_ROWS])], { mapping: MAP }), [])
  const plank = { ...lift('Plank', 1, 0, 60), muscle: 'Core' }
  assert.deepEqual(V.doneNotInPlan(machine, LEGS, [planned(1, 5, [plank, ...LEG_ROWS]), planned(4, 2, LEG_ROWS)], { mapping: MAP }), [])
  // a warm-up he does every other leg day is a habit, and offered
  const four = [1, 4, 7, 10].map((ago, k) => planned(ago, 2 + 3 * (3 - k), k % 2 ? LEG_ROWS : [tread, ...LEG_ROWS]))
  assert.deepEqual(names(V.doneNotInPlan(machine, LEGS, four, { mapping: MAP })), ['Treadmill'])
})

test('his usual sets are his ordinary sessions\' — a deload\'s fewer don\'t write the plan', () => {
  const deload = { pct: 0.6 }
  const mixed = [
    { ...planned(1, 11, [...LEG_ROWS, lift('Machine Hip Abduction', 2, 20)]), deload },
    { ...planned(4, 8, [...LEG_ROWS, lift('Machine Hip Abduction', 2, 20)]), deload },
    planned(7, 5, [...LEG_ROWS, lift('Machine Hip Abduction', 4, 30)]),
    planned(10, 2, [...LEG_ROWS, lift('Machine Hip Abduction', 4, 30)]),
  ]
  const [ab] = V.doneNotInPlan(machine, LEGS, mixed, { mapping: MAP })
  assert.equal(ab.sets, 4, 'not the deload\'s 2, though the deload is newer')
  assert.equal(ab.count, 4, 'a deload is still a session he did it in')
  // nothing but deloads: the plan's ordinary 3
  const only = mixed.map(s => ({ ...s, deload }))
  assert.equal(V.doneNotInPlan(machine, LEGS, only, { mapping: MAP })[0].sets, 3)
})

test('«مو هنا»: a dismissed one is not offered again on that day (and only that day)', () => {
  const got = V.doneNotInPlan(machine, LEGS, HIS, { mapping: MAP, dismissed: ['hip abduction'] })
  assert.deepEqual(names(got), ['Machine Hip Adduction'])
  // stored per day, under the plan and the day's name
  const stored = V.withDismissed({}, machine, LEGS, 'hip abduction')
  assert.deepEqual(stored, { [V.dayId(machine, LEGS)]: ['hip abduction'] })
  assert.equal(V.dayId(machine, LEGS), 'machine_beginner_3day|legs — أرجل')
  assert.equal(V.DISMISS_KEY, 'meran_plan_dismissed')
  assert.ok(PER_USER_KEYS.includes(V.DISMISS_KEY), 'his, per user: a data reset clears it')
  assert.equal(V.withDismissed(stored, machine, LEGS, 'hip abduction'), stored, 'twice is once')
  const all = V.fromSessions(machine, HIS, { mapping: MAP, dismissed: stored })
  assert.deepEqual(all.map(names), [[], ['Face Pull'], ['Machine Hip Adduction']])
  // the pull day's own is still offered, until it is waved off there
  const pullOff = V.withDismissed(stored, machine, 1, 'face pull')
  assert.deepEqual(V.fromSessions(machine, HIS, { mapping: MAP, dismissed: pullOff }).map(names), [[], [], ['Machine Hip Adduction']])
})

test('pinned is in the plan: «ثبّته بخطتي» once, and it is not offered again', () => {
  const [ab, ad] = V.doneNotInPlan(machine, LEGS, HIS, { mapping: MAP })
  const one = V.addRow(machine, LEGS, ab, { repTarget: SETTINGS })
  assert.deepEqual(names(V.doneNotInPlan(one, LEGS, HIS, { mapping: MAP })), ['Machine Hip Adduction'])
  // «ثبّت كلهم»: both, in one edit
  const both = V.addRows(machine, LEGS, [ab, ad], { repTarget: SETTINGS })
  assert.deepEqual(both.weeklySchedule[LEGS].exercises.slice(-2).map(x => x.name), ['Machine Hip Abduction', 'Machine Hip Adduction'])
  assert.deepEqual(V.doneNotInPlan(both, LEGS, HIS, { mapping: MAP }), [])
  assert.equal(V.addRows(both, LEGS, [ab, ad]), null, 'nothing new: no edit')
  assert.equal(V.addRow(both, LEGS, { name: 'Machine Hip Abduction', muscle: 'Legs' }), null, 'never twice on a day')
})

test('the row «ثبّته بخطتي» writes: his usual sets, the reps on Settings, the player\'s rest — a row both designs and the builder read', () => {
  const [ab] = V.doneNotInPlan(machine, LEGS, HIS, { mapping: MAP })
  const plan = V.addRow(machine, LEGS, ab, { repTarget: SETTINGS })
  const row = plan.weeklySchedule[LEGS].exercises[6]
  assert.deepEqual(row, { name: 'Machine Hip Abduction', muscle: 'Legs', sets: 3, repsMin: 12, repsMax: 15, restSeconds: 90, by: 'user', equip: 'machine', part: 'glutes' })
  assert.equal(validatePlan(plan), null)
  // the reps rule: not his own, so it follows Settings wherever Settings goes
  const eff = V.effectiveRow(plan, LEGS, 6, { repTarget: { id: 'custom', base: 8, top: 12 } })
  assert.equal(eff.own, false)
  assert.deepEqual(eff.reps, { base: 8, top: 12 })
  assert.equal(eff.rest, 90)
  assert.equal(eff.extra, 0, 'a new row says no «مجموعة زيادة»')
  assert.equal(eff.swap, null)
  // the builder opens it and saves it back as it is
  const st = B.fromHfPlan(plan, { days: 4 })
  const cfg = { days: 4, goal: 'muscle', eq: st.eq, excluded: new Set(), dismissed: new Set(), picks: st.picks, mtool: {}, cycle: st.cycle, split: st.split, keepOrder: true }
  const again = B.toHfPlan(B.buildFromPicks(cfg), cfg, { today: '2026-10-15', base: plan })
  const back = again.weeklySchedule[LEGS].exercises.find(x => x.name === 'Machine Hip Abduction')
  assert.ok(back, 'still on the leg day')
  assert.deepEqual([back.sets, back.repsMin, back.repsMax, back.restSeconds, back.repsOwn], [3, 12, 15, 90, undefined])
  assert.equal(validatePlan(again), null)
  // the original is untouched
  assert.equal(machine.weeklySchedule[LEGS].exercises.length, 6)
  // a name the app can't place in a group needs its muscle
  assert.equal(V.addRow(machine, LEGS, { name: 'Zercher Hold' }), null)
  assert.equal(V.addRow(machine, LEGS, { name: 'Zercher Hold', muscle: 'Legs', sets: 9 }).weeklySchedule[LEGS].exercises[6].sets, 6, 'sets stay 1–6')
})

test('after his swaps: what the session runs instead of a plan row is the plan\'s, not an addition', () => {
  const alt = EXERCISE_ALTERNATIVES['Leg Press'][1]       // a remembered swap: Leg Press → its second alternative
  const subs = { 'Leg Press': 2 }
  const rows = LEG_ROWS.filter(x => x.name !== 'Leg Press')
  const ran = [1, 4, 7, 10].map((ago, k) => planned(ago, 2 + 3 * (3 - k), [...rows, lift(alt, 4, 60, 10, { originalName: 'Leg Press' })]))
  assert.deepEqual(V.doneNotInPlan(machine, LEGS, ran, { subs, mapping: MAP }), [], 'the swap he keeps')
  // the plan's own, from before he swapped it: not offered back
  const before = [1, 4, 7, 10].map((ago, k) => planned(ago, 2 + 3 * (3 - k), LEG_ROWS))
  assert.deepEqual(V.doneNotInPlan(machine, LEGS, before, { subs, mapping: MAP }), [])
  // a swap written into the plan: what it replaced is not offered back either
  const written = V.swapRow(machine, LEGS, 1, 'Barbell Squat')
  assert.deepEqual(V.doneNotInPlan(written, LEGS, before, { mapping: MAP }), [])
  // «بس هالمرة»: the machine taken, another in its place for the session
  const once = [1, 4, 7].map((ago, k) => planned(ago, 2 + 3 * (2 - k), [...LEG_ROWS.slice(1), lift('Goblet Squat', 3, 20, 12, { originalName: 'Hack Squat' })]))
  assert.deepEqual(V.doneNotInPlan(machine, LEGS, once, { mapping: MAP }), [])
})

test('which day a saved session was: its day\'s name first, the counter only between two of one name', () => {
  const legs = machine.weeklySchedule[LEGS].name
  assert.equal(V.sessionPlanDay(machine, { planDayIndex: 11, planDayName: legs }), LEGS)
  assert.equal(V.sessionPlanDay(machine, { planDayIndex: 0, planDayName: legs }), LEGS, 'the counter starts again with a new plan; the name doesn\'t')
  assert.equal(V.sessionPlanDay(machine, { planDayIndex: 4 }), 1, 'no name: the counter')
  assert.equal(V.sessionPlanDay(machine, {}), null, 'a free session')
  assert.equal(V.sessionPlanDay(machine, { name: 'Pull Day 🗂️' }), null, 'a routine')
  // another plan's day is not one of this plan's — never a guess by kind
  // (the review: «Legs B» counted as the machines plan's legs)
  assert.equal(V.sessionPlanDay(machine, { planDayIndex: 5, planDayName: 'Legs B — أرجل' }), null)
  assert.equal(V.sessionPlanDay(machine, { planDayIndex: 0, planDayName: 'Push A — صدر، أكتاف، ترايسبس' }), null)
  assert.equal(V.sessionPlanDay(machine, { planDayIndex: 3, planDayName: 'Upper A — صدر، ظهر' }), null)
  // two leg days: each by its own name
  const ppl = BUILT_IN_PLANS.find(p => p.planId === 'ppl_alex_lueth_v2')
  assert.equal(V.sessionPlanDay(ppl, { planDayIndex: 0, planDayName: 'Legs B — أرجل' }), 5)
  assert.equal(V.sessionPlanDay(ppl, { planDayIndex: 2, planDayName: 'Legs A — أرجل' }), 2)
  assert.equal(V.sessionPlanDay(ppl, { planDayIndex: 2, planDayName: legs }), null)
  // free sessions and other days never count for a day
  const free = [1, 2, 3].map(ago => ({ ...planned(ago, 2, [lift('Machine Hip Abduction')]), planDayIndex: undefined, planDayName: undefined }))
  assert.deepEqual(V.doneNotInPlan(machine, LEGS, free, { mapping: MAP }), [])
})

// ── Only what he added: never what a plan (this one, or the last) put in his sessions ──

const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10)
// every row of each day, as the plan put them in his sessions
const fullDay = (plan, d) => plan.weeklySchedule[d].exercises.map(e => ({ ...lift(e.name, e.sets, 50, 10), muscle: e.muscle }))

test('a plan switch starts clean: the old plan\'s sessions are not the new plan\'s days', () => {
  // the review's probe: the machines plan's history, then PPL (6 days) activated today
  const ppl = { ...clone(BUILT_IN_PLANS.find(p => p.planId === 'ppl_alex_lueth_v2')), startDate: dayOf(T0) }
  const history = [2, 3, 5, 7, 9, 11].map((ago, k) => planned(ago, 5 - k, fullDay(machine, (5 - k) % 3)))
  assert.deepEqual(V.fromSessions(ppl, history, { mapping: MAP }).map(names), [[], [], [], [], [], []])
  // a new plan from the builder: the same «Legs — أرجل» day, other rows, started today
  const built = clone(machine)
  Object.assign(built, { planId: 'custom_20261014', planName: 'خطتي', source: 'builder', startDate: dayOf(T0) })
  built.weeklySchedule[LEGS].exercises = [
    { name: 'Barbell Squat', muscle: 'Legs', sets: 4, repsMin: 6, repsMax: 10 },
    { name: 'Romanian Deadlift', muscle: 'Legs', sets: 3, repsMin: 8, repsMax: 12 },
  ]
  const legsHistory = [2, 5, 8, 11].map((ago, k) => planned(ago, 2 + 3 * (3 - k), fullDay(machine, LEGS)))
  assert.deepEqual(V.doneNotInPlan(built, LEGS, legsHistory, { mapping: MAP }), [], 'the old leg rows are not «مو بخطتك»')
  // its own sessions count, from the day it began on
  const own = [0, -3].map(ago => planned(ago, 2, [
    { ...lift('Barbell Squat', 4, 80, 8) }, { ...lift('Romanian Deadlift', 3, 60, 10) }, lift('Machine Hip Abduction'),
  ], built))
  assert.deepEqual(names(V.doneNotInPlan(built, LEGS, [...own, ...legsHistory], { mapping: MAP })), ['Machine Hip Abduction'])
  // a session stamped with another plan's id is not this plan's, whatever its day and date
  const started = { ...machine, startDate: '2026-09-01' }
  assert.deepEqual(V.doneNotInPlan(started, LEGS, HIS.map(s => ({ ...s, planId: 'ppl_alex_lueth_v2' })), { mapping: MAP }), [])
  assert.deepEqual(names(V.doneNotInPlan(started, LEGS, HIS.map(s => ({ ...s, planId: machine.planId })), { mapping: MAP })),
    ['Machine Hip Abduction', 'Machine Hip Adduction'], 'its own id: counted')
  assert.deepEqual(names(V.doneNotInPlan(started, LEGS, HIS, { mapping: MAP })), ['Machine Hip Abduction', 'Machine Hip Adduction'],
    'no id (the old design\'s sessions): the start decides')
  // the start, as the training day reads it (the day turns at 03:00)
  assert.equal(V.ofThisPlan({ startDate: '2026-10-14' }, { date: '2026-10-14T00:30:00' }), false, '00:30 is still the 13th\'s training day')
  assert.equal(V.ofThisPlan({ startDate: '2026-10-14' }, { date: '2026-10-14T09:00:00' }), true)
  assert.equal(V.ofThisPlan({ startDate: '2026-10-14T00:00:00Z' }, { date: '2026-10-15T09:00:00' }), true, 'a start with a time is read as its day')
  assert.equal(V.ofThisPlan({}, { date: '2020-01-01T09:00:00' }), true, 'a plan with no start takes every session')
})

test('what an edit takes off a day (dropsOf) is offered only from the sessions after it left', () => {
  const plan = { ...clone(machine), startDate: '2026-09-01' }
  const at = (before, after, stored = {}, t = T0, opts = {}) => V.withDropped(stored, V.dropsOf(before, after, { mapping: MAP, ...opts }), t)
  const legsId = V.dayId(plan, LEGS)
  // his leg days had every row of the plan: the plan put them there
  const full = [1, 4, 7, 10].map((ago, k) => planned(ago, 2 + 3 * (3 - k), fullDay(plan, LEGS)))
  assert.deepEqual(V.doneNotInPlan(plan, LEGS, full, { mapping: MAP }), [])

  // «شيله» the calf raise in «خطتي»
  const out = V.removeRow(plan, LEGS, 5)
  assert.deepEqual(names(V.doneNotInPlan(out.plan, LEGS, full, { mapping: MAP })), ['Standing Calf Raise'], 'with nothing kept: the review\'s case')
  const dropped = at(plan, out.plan)
  assert.deepEqual(Object.keys(dropped), [legsId])
  assert.equal(dropped[legsId]['standing calf raise'], T0)
  assert.deepEqual(V.fromSessions(out.plan, full, { mapping: MAP, dropped }).map(names), [[], [], []])
  // «تراجع» puts it back: an edit that takes nothing off
  assert.deepEqual(V.dropsOf(out.plan, V.insertRow(out.plan, LEGS, 5, out.row), { mapping: MAP }), [])
  // he goes on doing it, by hand, in two sessions after: a habit of his again
  const after = [planned(-1, 14, fullDay(plan, LEGS)), planned(-3, 17, fullDay(plan, LEGS)), ...full]
  assert.deepEqual(V.fromSessions(out.plan, after, { mapping: MAP, dropped })[LEGS].map(x => [x.name, x.count, x.of]), [['Standing Calf Raise', 2, 4]])

  // swapped twice, A → B → C (in «خطتي», or the session's «دايماً بخطتي»)
  const p1 = V.swapRow(plan, LEGS, 0, 'Smith Machine Squat')
  assert.deepEqual(at(plan, p1), {}, 'the first swap takes nothing off: the row says it was the hack squat')
  const withB = [1, 4, 7].map((ago, k) => planned(ago, 2 + 3 * (2 - k), fullDay(p1, LEGS)))
  const p2 = V.swapRow(p1, LEGS, 0, 'Goblet Squat')
  assert.deepEqual(p2.weeklySchedule[LEGS].exercises[0].was, { name: 'Hack Squat', muscle: 'Legs' })
  assert.deepEqual(names(V.doneNotInPlan(p2, LEGS, withB, { mapping: MAP })), ['Smith Machine Squat'], 'with nothing kept: the review\'s case')
  const d2 = at(p1, p2)
  assert.deepEqual(Object.keys(d2[legsId]), ['smith machine squat'])
  assert.deepEqual(V.fromSessions(p2, withB, { mapping: MAP, dropped: d2 })[LEGS], [])

  // a row with a remembered swap taken out: its sessions ran the swap — both names leave
  const subs = { 'Leg Press': 2 }
  const alt = EXERCISE_ALTERNATIVES['Leg Press'][1]
  const ran = [1, 4, 7, 10].map((ago, k) => planned(ago, 2 + 3 * (3 - k), [...LEG_ROWS.filter(x => x.name !== 'Leg Press'), lift(alt, 4, 60, 10, { originalName: 'Leg Press' })]))
  const noPress = V.removeRow(plan, LEGS, 1).plan
  assert.deepEqual(V.fromSessions(noPress, ran, { subs, mapping: MAP, dropped: at(plan, noPress, {}, T0, { subs }) })[LEGS], [])

  // the builder: his plan opened and saved without the leg extension (the same plan, the day kept by name)
  const st = B.fromHfPlan(plan, { days: 3 })
  const cfg = { days: 3, goal: 'muscle', eq: st.eq, excluded: new Set(), dismissed: new Set(), picks: st.picks.filter(p => p.name !== 'Leg Extension'), mtool: {}, cycle: st.cycle, split: st.split, keepOrder: true }
  const edited = B.toHfPlan(B.buildFromPicks(cfg), cfg, { today: '2026-10-15', base: plan })
  assert.equal(edited.weeklySchedule[LEGS].name, plan.weeklySchedule[LEGS].name)
  assert.ok(!edited.weeklySchedule[LEGS].exercises.some(x => x.name === 'Leg Extension'))
  const d3 = at(plan, edited)
  assert.ok(d3[legsId]?.['leg extension'] === T0, JSON.stringify(d3))
  assert.ok(!V.fromSessions(edited, full, { mapping: MAP, dropped: d3 })[LEGS].some(x => x.name === 'Leg Extension'))

  // a switch takes nothing off (its start does that); nor does an edit that adds
  assert.deepEqual(V.dropsOf(plan, clone(BUILT_IN_PLANS.find(p => p.planId === 'ppl_alex_lueth_v2')), { mapping: MAP }), [])
  assert.deepEqual(V.dropsOf(plan, V.addRow(plan, LEGS, { name: 'Machine Hip Abduction', muscle: 'Legs' }), { mapping: MAP }), [])
  // kept together per day, the newest time a name left
  const both = V.withDropped(dropped, [{ id: legsId, keys: ['leg extension', 'standing calf raise'] }], T0 + 5)
  assert.equal(both[legsId]['standing calf raise'], T0 + 5)
  assert.equal(both[legsId]['leg extension'], T0 + 5)
  assert.equal(Object.keys(both[legsId]).length, Object.keys(dropped[legsId]).length + 1)
  assert.equal(V.withDropped(dropped, []), dropped, 'nothing taken off: the same store')
  // the key is his, per user — a new one the old design never reads
  assert.equal(V.DROPPED_KEY, 'meran_plan_dropped')
  assert.ok(PER_USER_KEYS.includes(V.DROPPED_KEY), 'a data reset clears it')
})
