// The plan builder's engine (src/plan/builder.js), run on the cases the
// approved prototype was checked against (plans/planner.html, round 2):
// Hamza's own push·pull·legs on 4 days, «حر» with no leg day, dumbbells
// only, and too much biceps. Plus the hf_plan round trip both designs read.
import test from 'node:test'
import assert from 'node:assert/strict'
import * as B from '../src/plan/builder.js'
import { BUILT_IN_PLANS } from '../src/constants.js'
import { EXERCISE_MEDIA } from '../src/exerciseMedia.js'

const machinePlan = BUILT_IN_PLANS.find(p => p.planId === 'machine_beginner_3day')
const cfgOf = (o) => ({
  days: 4, goal: 'muscle', eq: new Set(['machine', 'cable', 'dumbbell', 'barbell', 'cardio', 'body']),
  excluded: new Set(), dismissed: new Set(), picks: [], mtool: {}, aim: null, ...o,
})
const byName = (plan, name) => plan.days.flatMap((d, di) => d.items.map(it => ({ it, di }))).filter(x => B.EXI[x.it.id].en === name)

// His plan opened in the builder, as «عدّل خطتك الحالية» does.
function current() {
  const st = B.fromHfPlan(machinePlan, { days: 4 })
  const cfg = cfgOf({ cycle: st.cycle, split: st.split, picks: st.picks, eq: st.eq, keepOrder: true })
  return { st, cfg, plan: B.buildFromPicks(cfg) }
}

test('every exercise in the library is tagged, with the app\'s own tool and Arabic name', () => {
  assert.equal(B.EX.length, Object.keys(EXERCISE_MEDIA).length)
  for (const e of B.EX) {
    const m = EXERCISE_MEDIA[e.en]
    assert.ok(m, e.en)
    assert.equal(e.id, m.slug)
    assert.equal(e.ar, m.ar)
    assert.ok(B.CARD[e.card] && B.AREAS[e.area], e.en)
    assert.ok(B.CARD[e.card].groups.includes(e.area), `${e.en}: ${e.area} is not shown under ${e.card}`)
    assert.ok(B.MUSCLES.includes(e.key))
  }
  assert.equal(B.entryForName('Smith Machine Calf Raise').eq, 'machine')
})

test('the systems per days: the suggestion first, «حر» last, push·pull·legs on 4', () => {
  assert.deepEqual(B.splitOpts(4), ['ul', 'ppl', 'full2', 'free'])
  for (const d of [3, 4, 5, 6]) assert.equal(B.splitOpts(d).at(-1), 'free')
  // 3-day cycle on 4.67 sessions a week: each day comes about 1.56 times
  assert.ok(Math.abs(B.splitFreq(['push', 'pull', 'legs'], 4) - 4.67 / 3) < 0.01)
  assert.equal(B.spwFromPattern([2]), 4.67)
  assert.equal(B.spwFromPattern([3, 2]), 5)
  assert.equal(B.daysFromRecovery({ daysPerWeek: 4 }), 4)
  assert.equal(B.daysFromRecovery({ daysPerWeek: 'custom', customPattern: [1] }), 3)
})

test('his plan, push·pull·legs on 4 days: 6 of 7, hamstrings and abs short', () => {
  const { st, plan } = current()
  assert.deepEqual(st.cycle, ['push', 'pull', 'legs'])
  assert.equal(st.split, 'ppl')
  assert.deepEqual([...st.eq].sort(), ['body', 'cable', 'machine'])
  assert.equal(plan.days.flatMap(d => d.items).length, 17)
  // his order is kept on each day
  assert.deepEqual(plan.days[0].items.map(it => B.EXI[it.id].en), machinePlan.weeklySchedule[0].exercises.map(x => x.name))
  const cov = B.coverage(plan, 'muscle')
  assert.equal(cov.of, 7)
  assert.equal(cov.n, 6)
  assert.equal(Math.round(cov.st.vol.hams), 5)
  assert.equal(Math.round(cov.st.vol.quads), 17)
  const gaps = B.findGaps(plan, 'muscle').gaps.map(g => g.a + ':' + g.type)
  assert.ok(gaps.includes('core:missing'))
  assert.ok(gaps.includes('hams:lop'))
})

test('«كمّل خطتي» on his plan adds a seated leg curl and a cable crunch, and touches none of his 17', () => {
  const { cfg, plan } = current()
  const before = plan.days.map(d => d.items.map(it => `${it.id}:${it.sets}`).join(','))
  const res = B.fill(plan, cfg)
  const adds = res.steps.filter(s => s.kind === 'add').map(s => ({ en: B.EXI[s.item.id].en, day: s.day, sets: s.item.sets }))
  assert.deepEqual(adds.slice(0, 2), [
    { en: 'Seated Leg Curl', day: 2, sets: 3 },
    { en: 'Cable Crunch', day: 1, sets: 2 },
  ])
  const cov = B.coverage(plan, 'muscle')
  assert.equal(cov.n, 7)
  assert.equal(Math.round(cov.st.vol.hams), 9)
  // his own exercises are untouched (same ids, same sets, same order)
  plan.days.forEach((d, i) => {
    const mine = d.items.filter(it => it.by === 'user').map(it => `${it.id}:${it.sets}`).join(',')
    assert.equal(mine, before[i])
  })
  // the leg day stays under the budget
  assert.ok(B.dayMinutes(plan.days[2]) <= B.BUDGET)
  // no «once a week» or session tips on this plan
  const tips = B.findTips(plan, 'muscle')
  assert.equal(tips.filter(t => t.kind === 'rare' || t.kind === 'session').length, 0)
})

test('too much biceps: «شيل مرجحة هامر كيبل», and it comes down to 11', () => {
  const { plan } = current()
  const warns = B.findWarns(plan, 'muscle')
  const w = warns.find(x => x.a === 'biceps')
  assert.ok(w, 'biceps is over the top')
  assert.equal(Math.round(w.cur), 16)
  assert.equal(w.max, 14)
  const fix = B.muchFix(plan, 'muscle', w)
  assert.equal(fix.kind, 'rm')
  assert.equal(B.EXI[fix.id].en, 'Cable Hammer Curls')
  assert.equal(Math.round(fix.after), 11)
  // the fix never drops another muscle under its minimum
  const f = plan.days[fix.di]
  f.items = f.items.filter(it => it.uid !== fix.uid)
  const st = B.stats(plan), T = B.targets('muscle')
  assert.ok(st.vol.biceps >= T.biceps[0])
})

test('«حر» with no leg day: a leg press is placed anyway, flagged, and a soft tip offers a leg day', () => {
  const ids = ['hammer_bench_press', 'pec_deck', 'lat_pulldown', 'seated_cable_row', 'leg_press']
  const cfg = cfgOf({ days: 4, split: 'free', cycle: ['push', 'pull'], eq: new Set(['machine', 'cable', 'body']), picks: ids.map(id => ({ id })) })
  const plan = B.buildFromPicks(cfg)
  const lp = byName(plan, 'Leg Press')[0]
  assert.ok(lp, 'the leg press is in the plan')
  assert.equal(lp.it.orphan, true)
  const tip = B.findTips(plan, 'muscle').find(t => t.kind === 'orphan')
  assert.ok(tip)
  assert.equal(tip.want, 'legs')
  assert.deepEqual(tip.fix, { kind: 'addday', type: 'legs' })
  // the fill says so for muscles with no day, instead of forcing them in
  const res = B.fill(plan, cfg)
  const blockedSplit = [...res.blocked.values()].filter(b => b.reason === 'split').map(b => b.gap.a)
  assert.ok(blockedSplit.includes('hams'))
})

test('dumbbells only, 4 days, «خلّ التطبيق يختار»: 7 of 7, upper/lower, bodyweight reps', () => {
  const cfg = cfgOf({ days: 4, eq: new Set(['dumbbell', 'body']), aim: 'good', cycle: B.SPL.ul.cycle.slice(), split: 'ul' })
  const plan = B.buildFromPicks(cfg)
  B.fill(plan, cfg)
  const all = plan.days.flatMap(d => d.items)
  assert.ok(all.length >= 14 && all.length <= 18, `${all.length} exercises`)
  assert.ok(all.every(it => ['dumbbell', 'body'].includes(B.EXI[it.id].eq)))
  assert.equal(B.coverage(plan, 'muscle').n, 7)
  const pull = all.find(it => it.id === 'pull_up')
  if (pull) assert.deepEqual(pull.r, [3, 8])
  const push = all.find(it => it.id === 'push_up')
  if (push) assert.deepEqual(push.r, [10, 20])
  assert.ok(byName(plan, 'Dumbbell Romanian Deadlift').length >= 1)
  plan.days.forEach(d => assert.ok(B.dayMinutes(d) <= B.BUDGET + 5))
})

test('chest and biceps only on machines, 3 days: the fill completes it with machines', () => {
  const cfg = cfgOf({ days: 3, eq: new Set(['machine', 'body']), cycle: B.SPL.full2.cycle.slice(), split: 'full2',
    picks: ['hammer_bench_press', 'machine_incline_press', 'pec_deck', 'machine_preacher_curl'].map(id => ({ id })) })
  const plan = B.buildFromPicks(cfg)
  assert.equal(B.coverage(plan, 'muscle').n, 3)
  B.fill(plan, cfg)
  assert.equal(B.coverage(plan, 'muscle').n, 7)
  const added = plan.days.flatMap(d => d.items.filter(it => it.by === 'app'))
  assert.ok(added.every(it => ['machine', 'body'].includes(B.EXI[it.id].eq)))
  assert.ok(added.every(it => it.why && it.why.length > 4))
})

test('hf_plan out: the shape the app and the old design read, with only optional extras', () => {
  const { cfg, plan } = current()
  B.fill(plan, cfg)
  const hf = B.toHfPlan(plan, { ...cfg, days: 4, goal: 'muscle', split: 'ppl' }, { today: '2026-10-13', base: machinePlan })
  assert.equal(B.validatePlan(hf), null)
  assert.equal(hf.planId, machinePlan.planId)
  assert.equal(hf.planName, machinePlan.planName)
  assert.equal(hf.weeklySchedule.length, 3)
  // a kept day keeps its name, so the history and the old design read the same day
  assert.equal(hf.weeklySchedule[0].name, machinePlan.weeklySchedule[0].name)
  for (const d of hf.weeklySchedule) {
    assert.match(d.name, /^[A-Za-z].* — /)
    for (const x of d.exercises) {
      assert.ok(B.MUSCLES.includes(x.muscle))
      assert.ok(x.sets >= 1 && x.repsMin >= 1 && x.repsMax >= x.repsMin && x.restSeconds >= 0)
    }
  }
  const crunch = hf.weeklySchedule[1].exercises.find(x => x.name === 'Cable Crunch')
  assert.equal(crunch.by, 'app')
  assert.ok(crunch.why)
  assert.deepEqual(hf.split, { id: 'ppl', cycle: ['push', 'pull', 'legs'] })
  // a new plan gets its own id, never a built-in one
  const fresh = B.toHfPlan(plan, { ...cfg, days: 4, split: 'ppl' }, { today: '2026-10-13' })
  assert.equal(fresh.planId, 'custom_20261013')
  assert.equal(fresh.startDate, '2026-10-13')
})

test('reps he stepped in the builder are saved as his own (repsOwn); the rest are not', () => {
  const tpl = BUILT_IN_PLANS.find(p => p.planId === 'home_workout_explosive')
  const st = B.fromHfPlan(tpl, { days: 4 })
  assert.ok(st.picks.every(p => !p.own), 'a template range is not his')
  st.picks[0].r = [8, 12]; st.picks[0].own = true      // what stepping «العدّات» does
  const cfg = cfgOf({ cycle: st.cycle, split: st.split, picks: st.picks, eq: st.eq, keepOrder: true })
  const hf = B.toHfPlan(B.buildFromPicks(cfg), { ...cfg, split: st.split }, { today: '2026-10-13', base: tpl })
  const all = hf.weeklySchedule.flatMap(d => d.exercises)
  const mine = all.filter(x => x.repsOwn === true)
  assert.equal(mine.length, 1)
  assert.deepEqual([mine[0].repsMin, mine[0].repsMax], [8, 12])
  assert.ok(all.filter(x => x !== mine[0]).every(x => !('repsOwn' in x)))
  // and it survives opening the plan again
  assert.equal(B.fromHfPlan(hf, { days: 4 }).picks.filter(p => p.own).length, 1)
})

test('hf_plan round trip keeps names the catalogue does not know', () => {
  const home = BUILT_IN_PLANS.find(p => p.planId === 'home_workout_explosive')
  const st = B.fromHfPlan(home, { days: 4 })
  assert.equal(st.cycle.length, 4)
  assert.equal(st.cycle[3], 'full')
  const cfg = cfgOf({ cycle: st.cycle, split: st.split, picks: st.picks, eq: st.eq, keepOrder: true })
  const plan = B.buildFromPicks(cfg)
  const hf = B.toHfPlan(plan, { ...cfg, split: st.split }, { today: '2026-10-13', base: home })
  assert.equal(B.validatePlan(hf), null)
  const names = (p) => p.weeklySchedule.flatMap(d => d.exercises.map(x => x.name))
  assert.deepEqual(names(hf), names(home))
})

test('validatePlan refuses what would break the old design', () => {
  assert.deepEqual(B.validatePlan({ weeklySchedule: [] }), { error: 'empty' })
  assert.deepEqual(B.validatePlan({ weeklySchedule: [{ name: 'Push', exercises: [] }] }), { error: 'day', at: 0 })
  assert.deepEqual(B.validatePlan({ weeklySchedule: [{ name: 'Push', exercises: [{ name: 'X', muscle: 'Glutes' }] }] }), { error: 'muscle', at: 0 })
  for (const p of BUILT_IN_PLANS) assert.equal(B.validatePlan(p), null, p.planId)
})

test('the Upper/Lower plan: 4 days, two upper and two lower, every exercise with a picture', () => {
  const ul = BUILT_IN_PLANS.find(p => p.planId === 'upper_lower_4day')
  assert.ok(ul)
  assert.equal(ul.daysPerWeek, '4')
  assert.deepEqual(ul.weeklySchedule.map(B.inferDayType), ['upper', 'lower', 'upper', 'lower'])
  for (const d of ul.weeklySchedule) for (const x of d.exercises) assert.ok(EXERCISE_MEDIA[x.name], x.name)
  const st = B.fromHfPlan(ul, { days: 4 })
  assert.equal(st.split, 'ul')
  const plan = B.buildFromPicks(cfgOf({ cycle: st.cycle, picks: st.picks, eq: st.eq, keepOrder: true }))
  assert.equal(B.coverage(plan, 'muscle').n, 7)
})
