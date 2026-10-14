// Regressions from the fifth review round: the report, the planner and
// the session must judge the same plan the same way.
//
//   node --test tests/round5.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

globalThis.localStorage = {
  _d: new Map(),
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null },
  setItem(k, v) { this._d.set(k, String(v)) },
  removeItem(k) { this._d.delete(k) },
  key(i) { return [...this._d.keys()][i] ?? null },
  get length() { return this._d.size },
}

const { nextMonthPlan } = await import('../src/monthReport.js')
const { analyzeProgression, liftRepTarget, planRepTarget, DEFAULT_REP_TARGET } = await import('../src/progression.js')

// September on train-train-rest, every set at the top of a 10–10 range.
// target: 'own' — the range he set in the builder (target.own); 'old' —
// a target stored before ownership existed (not his); none — no target.
function topOfRangeMonth({ withTarget = 'own' } = {}) {
  const out = []
  for (let d = 1; d <= 30; d++) {
    if ((d - 1) % 3 === 2) continue
    const date = `2026-09-${String(d).padStart(2, '0')}T18:00:00`
    out.push({
      id: new Date(date).getTime(), date,
      exercises: [{
        name: 'Lat Pulldown', muscle: 'Back',
        ...(withTarget === 'own' ? { target: { min: 10, max: 10, own: true } } : withTarget === 'old' ? { target: { min: 10, max: 10 } } : null),
        sets: [1, 2, 3].map(() => ({ weight: '50', reps: '10', done: true })),
      }],
    })
  }
  return out.reverse()
}
// A 10–10 range he set himself in the builder, and the same range as a
// built-in template carries it (not his choice).
const PLAN_10 = { weeklySchedule: [{ name: 'A', exercises: [{ name: 'Lat Pulldown', sets: 3, repsMin: 10, repsMax: 10, repsOwn: true }] }] }
const TEMPLATE_10 = { weeklySchedule: [{ name: 'A', exercises: [{ name: 'Lat Pulldown', sets: 3, repsMin: 10, repsMax: 10 }] }] }

test('a 10–10 range he chose, hit at the top, never reads as «lower» in the report', () => {
  for (const withTarget of ['own', null]) {
    const sessions = topOfRangeMonth({ withTarget })
    const next = nextMonthPlan({ sessions, month: '2026-09', repTarget: DEFAULT_REP_TARGET, plan: PLAN_10 })
    assert.ok(!next.some(n => n.kind === 'lower'), JSON.stringify(next))
    const raise = next.find(n => n.kind === 'raise')
    assert.equal(raise?.exercise, 'Lat Pulldown')
  }
})

test('a 10–10 range from a template is not his: the report judges it on Settings (12–15)', () => {
  for (const withTarget of ['old', null]) {
    const sessions = topOfRangeMonth({ withTarget })
    const next = nextMonthPlan({ sessions, month: '2026-09', repTarget: DEFAULT_REP_TARGET, plan: TEMPLATE_10 })
    const lower = next.find(n => n.kind === 'lower')
    assert.equal(lower?.reps, 12, JSON.stringify(next))
  }
})

test('liftRepTarget: his latest session range, then his plan range, then Settings', () => {
  const sessions = topOfRangeMonth()
  assert.deepEqual(liftRepTarget(sessions, 'Lat Pulldown', {}, { plan: null }), planRepTarget({ repsMin: 10, repsMax: 10, repsOwn: true }))
  // a target stored before ownership (his last sessions on the template) no longer forces 10
  assert.equal(liftRepTarget(topOfRangeMonth({ withTarget: 'old' }), 'Lat Pulldown', {}, { plan: null }), DEFAULT_REP_TARGET)
  const bare = topOfRangeMonth({ withTarget: null })
  assert.equal(liftRepTarget(bare, 'Lat Pulldown', {}, { plan: PLAN_10 }).top, 10)
  assert.equal(liftRepTarget(bare, 'Lat Pulldown', {}, { plan: TEMPLATE_10 }), DEFAULT_REP_TARGET)
  assert.equal(liftRepTarget(bare, 'Lat Pulldown', {}, { plan: null }), DEFAULT_REP_TARGET)
  // and the deload count reads the same lift as not stalled
  const t = liftRepTarget(bare, 'Lat Pulldown', {}, { plan: PLAN_10 })
  const p = analyzeProgression(bare, 'Lat Pulldown', {}, t)
  assert.ok(!(p.hint === 'lower' || p.failedAtWeight >= 2))
})

const B = await import('../src/plan/builder.js')
const { BUILT_IN_PLANS } = await import('../src/constants.js')

test('his Upper/Lower plan switched to push·pull·legs: every exercise lands on a day that takes it', () => {
  const ul = BUILT_IN_PLANS.find(p => p.planId === 'upper_lower_4day')
  const st = B.fromHfPlan(ul, { days: 4 })
  const cycle = ['push', 'pull', 'legs']
  B.fitPins(st.picks, cycle)
  const plan = B.buildFromPicks({ days: 4, spw: 4.67, goal: 'muscle', eq: st.eq, excluded: new Set(), dismissed: new Set(), picks: st.picks, mtool: {}, cycle, split: 'ppl', keepOrder: true })
  const orphans = plan.days.flatMap(d => d.items.filter(it => it.orphan).map(it => it.id))
  assert.deepEqual(orphans, [])
  // a pin that still fits is kept: Upper A's chest press stays on day 1 (push)
  const st2 = B.fromHfPlan(ul, { days: 4 })
  const chest = st2.picks.find(p => p.day === 0 && B.EXI[p.id].area === 'chest')
  B.fitPins(st2.picks, cycle)
  assert.equal(chest.day, 0)
})

test('opening his plan and saving it unchanged keeps a back-off row and his cardio sets', () => {
  const hf = { planName: 'x', weeklySchedule: [{ name: 'Push — صدر', exercises: [
    { name: 'Bench Press', muscle: 'Chest', sets: 3, repsMin: 8, repsMax: 10 },
    { name: 'Bench Press', muscle: 'Chest', sets: 2, repsMin: 12, repsMax: 15 },
    { name: 'Treadmill Run', muscle: 'Cardio', sets: 3, repsMin: 10, repsMax: 10 },
  ] }] }
  const st = B.fromHfPlan(hf, { days: 3 })
  const cfg = { days: 3, goal: 'muscle', eq: st.eq, excluded: new Set(), dismissed: new Set(), picks: st.picks, mtool: {}, cycle: st.cycle, split: st.split, keepOrder: true }
  const plan = B.buildFromPicks(cfg)
  const back = B.toHfPlan(plan, cfg, { today: '2026-10-13', base: hf })
  const rows = back.weeklySchedule[0].exercises.map(e => `${e.name} ${e.sets}x${e.repsMin}-${e.repsMax}`)
  assert.ok(rows.includes('Bench Press 3x8-10'), rows.join(' | '))
  assert.ok(rows.includes('Bench Press 2x12-15'), rows.join(' | '))
  assert.ok(rows.some(r => r.startsWith('Treadmill Run 3x')), rows.join(' | '))
})

test('a timed move from the plan counts seconds or minutes in the session, never «عدّة»', async () => {
  const { repsWord, setWords, repsLabel } = await import('../src/components/player/sessionWords.js')
  assert.equal(repsWord(30, 'sec'), 'ثانية')
  assert.equal(repsWord(5, 'sec'), 'ثواني')
  assert.equal(repsWord(20, 'min'), 'دقيقة')
  assert.equal(repsWord(12), 'عدّة')
  assert.equal(setWords({ weight: '', reps: '45' }, 'sec'), '45 ثانية')
  assert.equal(repsLabel('min'), 'الدقائق')
})

test('the hamstring number reads the same before and after «كمّل خطتي»', () => {
  // the gap row and the «كان ← صار» line count with one helper (n0)
  const g = { a: 'hams', type: 'lop', cur: 4.67, ref: 17.1, pair: 'legs' }
  const w = B.gapWords(g, { days: [] })
  assert.match(w.sub, new RegExp(`والخلفي ${B.setsWord(B.n0(4.67))} بس`))
  assert.match(w.sub, /الأمامي 17 مجموعة/)
})

const RS = await import('../src/reportStory.js')

test('«طبّقها» is remembered per month, and its undo forgets it', () => {
  const m = RS.withApplied({}, '2026-09', '2026-10-01')
  assert.equal(RS.appliedOn(m, '2026-09'), '2026-10-01')
  assert.equal(RS.appliedOn(m, '2026-08'), null)
  assert.equal(RS.appliedOn(RS.withApplied(m, '2026-09', null), '2026-09'), null)
  assert.equal(RS.appliedOn([1], '2026-09'), null)
})

test('a story seen before its month is over plays once more when it is', () => {
  const early = RS.withStorySeen({}, '2026-09', '2026-09-29')
  assert.equal(RS.storySeen(early, '2026-09', '2026-09-30'), true, 'seen while the month runs')
  assert.equal(RS.storySeen(early, '2026-09', '2026-10-01'), false, 'the finished month plays again')
  const done = RS.withStorySeen(early, '2026-09', '2026-10-01')
  assert.equal(RS.storySeen(done, '2026-09', '2026-10-05'), true)
  // an old mark (true) stays seen
  assert.equal(RS.storySeen({ '2026-03': true }, '2026-03', '2026-10-01'), true)
})

test('a backup restore hands back the old plan too, and skips a plan both designs could not open', async () => {
  const { restorePlan } = await import('../src/utils.js')
  const plan = { planName: 'A', weeklySchedule: [{ name: 'Push', exercises: [{ name: 'Bench Press', muscle: 'Chest', sets: 3 }] }] }
  const prev = { plan: { ...plan, planName: 'B' }, planIndex: 2, savedAt: '2026-10-01' }
  const back = restorePlan({ plan, planIndex: 4, planPrev: prev })
  assert.deepEqual(back, { plan, planIndex: 4, planPrev: prev })
  assert.equal(restorePlan({ plan: { weeklySchedule: [{ name: 'x', exercises: [] }] } }), null, 'an empty day')
  assert.equal(restorePlan({ plan: { weeklySchedule: [{ name: 'x', exercises: [{ name: 'X', muscle: 'Forearms' }] }] } }), null)
})

// ══ the number shown and the judgement agree ══════════════════
// Just under a minimum the number rounds down: «6 من 6» never sits on a
// muscle flagged short. One rule for the deck card, the muscle view and
// the report (src/plan/count.js).

const CNT = await import('../src/plan/count.js')
const PB = await import('../src/plan/builder.js')
const UI_SRC = readFileSync(new URL('../src/pages/planner/ui.js', import.meta.url), 'utf8')

test('a short number rounds down, a covered one as usual', () => {
  assert.equal(CNT.setsShown(5.7, 6), 5)
  assert.equal(CNT.isShort(5.7, 6), true)
  assert.equal(CNT.setsShown(5.96, 6), 6, 'a rounding hair under is covered')
  assert.equal(CNT.isShort(5.96, 6), false)
  assert.equal(CNT.setsShown(6.4, 6), 6)
  assert.equal(CNT.setsShown(0.4, 6), 0)
  assert.equal(CNT.setsShown(8.6, null), 9, 'no minimum: plain rounding')
  for (let i = 0; i <= 2400; i++) {
    const cur = i / 100
    for (const min of [2, 4, 6, 10]) assert.equal(CNT.isShort(cur, min), CNT.setsShown(cur, min) < min, `${cur} of ${min}`)
  }
})

test('the deck card and the muscle view: under the line exactly when not covered', () => {
  const T = PB.targets('muscle')
  for (const c of PB.CARDS) {
    for (let i = 0; i <= 300; i++) {
      const vol = Object.fromEntries(PB.AREA_ORDER.map(a => [a, i / 20 + 0.013]))
      const cs = PB.cardState(c, { vol }, T)
      if (cs.opt) continue
      for (const s of cs.segs) assert.equal(PB.setsShown(s.cur, s.min) < s.min, PB.isShort(s.cur, s.min), `${c.id} ${s.a} ${s.cur}`)
      assert.equal(cs.ok, cs.segs.every(s => PB.setsShown(s.cur, s.min) >= s.min), `${c.id} at ${i / 20}`)
    }
  }
  // the planner's screens print the helper, not a plain round
  assert.ok(!/Math\.round\(s\.cur\)\} من/.test(UI_SRC), 'deck card «N من M»')
  assert.ok(!/Math\.round\(s\.cur\)\}<\/span> من/.test(UI_SRC), 'muscle view «N من M»')
  assert.match(UI_SRC, /\$\{setsShown\(s\.cur, s\.min\)\} من \$\{s\.min\} مجموعات بالأسبوع/)
})

test('the report: hamstrings just under their minimum say the lower number', async () => {
  const { muscleSets, nextMonthPlan, nextCopy } = await import('../src/monthReport.js')
  // strength: the back of the thigh wants 5 to 12. 21 leg-curl sets over
  // March (31/7 weeks) ≈ 4.7 a week: short, so «4», never «5 … من 5»
  const s = [...Array(21)].map((_, i) => ({
    id: i, date: `2026-03-${String(1 + i).padStart(2, '0')}T18:00:00`,
    exercises: [{ name: 'Leg Curl', muscle: 'Legs', sets: [{ weight: '40', reps: '10', done: true }] }],
  }))
  const m = muscleSets(s, '2026-03', { today: '2026-04-05', goal: 'strength' })
  const hams = m.find(x => x.key === 'Legs').areas.find(a => a.area === 'hams')
  assert.deepEqual([hams.cur, hams.min, hams.max, hams.status], [4.7, 5, 12, 'low'])
  assert.equal(hams.shown, 4)
  // the untouched parts (at 0) would take the three places first
  const only = m.map(x => x.key === 'Legs' ? { ...x, lowAreas: x.lowAreas.filter(a => a.area === 'hams') } : x)
  const item = nextMonthPlan({ sessions: [], month: '2026-03', muscles: only }).find(x => x.kind === 'sets' && x.area === 'hams')
  assert.equal(item.shown, 4)
  const why = nextCopy(item).reason
  assert.match(why, /أخذ 4 مجموعات بالأسبوع، والمناسب من 5 إلى 12\./, why)
  // an old item with no «shown» follows the same rule
  assert.match(nextCopy({ kind: 'sets', label: 'الفخذ الخلفي', perWeek: 5.7, min: 6, max: 12 }).reason, /أخذ 5 مجموعات/)
})

test('«خطتك الحين» is on the system his plan really uses', async () => {
  const { BUILT_IN_PLANS } = await import('../src/constants.js')
  const ul = BUILT_IN_PLANS.find(p => p.planId === 'upper_lower_4day')
  const ppl = BUILT_IN_PLANS.find(p => p.planId === 'machine_beginner_3day')
  assert.equal(PB.fromHfPlan(ul, { days: 4 }).split, 'ul')
  assert.equal(PB.fromHfPlan(ppl, { days: 4 }).split, 'ppl')
  const fn = UI_SRC.slice(UI_SRC.indexOf('function splitsHTML'), UI_SRC.indexOf('function freeHTML'))
  assert.match(fn, /id === CURRENT\.split/)
  assert.ok(!/'ppl'/.test(fn), 'never a fixed system')
})
