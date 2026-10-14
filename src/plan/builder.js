// ── مران · the plan builder's engine ─────────────────────────
//
// Pure logic, no DOM, no storage: the exercise catalogue tagged for the
// builder, weekly sets per body area, the gaps, the «كمّل خطتي» fill,
// «كثير» with its one-tap suggestion (muchFix), the soft tips (findTips),
// and the conversion to and from hf_plan — the shape both designs read.
//
// Rules follow the research notes in the approved prototype
// (plans/planner.html, round 2): direct work = 1 set, indirect = ½
// (Pelland 2024); targets per area; any split works — a split is only a
// cycle of day types, each session takes the next day (so push·pull·legs
// on 4 days a week just starts again on the 4th); the fill uses only the
// user's tools (Fitbod) and never touches his own picks.
//
// The UI (src/pages/planner/) mutates the plan objects these functions
// return; nothing here keeps state between calls except the uid counter.

import {
  MUSCLES, AREAS, AREA_ORDER, CARDS, CARD, GROUP, EQ, EQ_ORDER, KIND, EX, EXI, BASE_T, targets,
  entryForName, ensureEntry,
} from './catalogue.js'
import { isShort, setsShown } from './count.js'

export { MUSCLES, entryForName, ensureEntry, isShort, setsShown }


/* Rotation per days-a-week, from مران's rest cycle (src/recovery.js):
   3 = [1] train, rest → 3.5 sessions/week; 4 = [2] → 4.67; 5 = [3,2] → 5;
   6 = [3,3] → 5.25. The plan runs in turn (each session takes the next day
   of the cycle), so ANY system works on any number of days: a 3-day cycle on
   4 days a week just starts again on the 4th. Nothing here blocks a choice. */
const SPLITS = {
  3: ['full', 'full'],
  4: ['upper', 'lower', 'upper', 'lower'],
  5: ['push', 'pull', 'legs', 'upper', 'lower'],
  6: ['push', 'pull', 'legs', 'push', 'pull', 'legs'],
}
const SPW = { 3: 3.5, 4: 4.67, 5: 5, 6: 5.25 }
/* A custom rest pattern can give any number: never crash on it.
   ≤2 → full body A/B; 7+ → push/pull/legs twice. */
const splitFor = (d) => SPLITS[d] || (d <= 2 ? ['full', 'full'] : ['push', 'pull', 'legs', 'push', 'pull', 'legs'])
const spwFor = (d) => SPW[d] || Math.min(d, 7 * d / (d + 1))
/* Sessions a week, from cfg: the exact number from the rest pattern when
   the caller has it (a custom pattern), otherwise from the days. */
const spwOf = (cfg) => cfg.spw || spwFor(cfg.days)
/** Sessions a week for a rest pattern (src/recovery.js): [2] → 4.67. */
export function spwFromPattern(pattern = [2]) {
  const p = (pattern || []).map(n => Math.max(1, Math.round(n || 0))).filter(Boolean)
  if (!p.length) return SPW[4]
  const work = p.reduce((s, n) => s + n, 0)
  return Math.round(7 * work / (work + p.length) * 100) / 100
}
/** The builder's days (3–6) for a recovery config: the number itself, or
 *  for a custom pattern the nearest of the four. */
export function daysFromRecovery(rc = {}) {
  const d = rc.daysPerWeek
  if ([3, 4, 5, 6].includes(d)) return d
  if (d === 'custom') {
    const spw = spwFromPattern(rc.customPattern)
    return [3, 4, 5, 6].reduce((b, x) => Math.abs(SPW[x] - spw) < Math.abs(SPW[b] - spw) ? x : b, 4)
  }
  return 5
}
const PUSH = ['chest', 'front', 'side', 'triceps']
const PULL = ['lats', 'rows', 'rear', 'biceps']
const LOW = ['quads', 'hams', 'glutes', 'calves', 'core']
const TYPE = {
  push:  { ar: 'دفع',  en: 'Push',      areas: PUSH },
  pull:  { ar: 'سحب',  en: 'Pull',      areas: PULL },
  legs:  { ar: 'أرجل', en: 'Legs',      areas: LOW },
  lower: { ar: 'سفلي', en: 'Lower',     areas: LOW },
  upper: { ar: 'علوي', en: 'Upper',     areas: [...PUSH, ...PULL] },
  full:  { ar: 'شامل', en: 'Full Body', areas: AREA_ORDER },
  /* «عضلة لكل يوم» and the free builder's own days */
  chestd:    { ar: 'صدر',      en: 'Chest',        areas: ['chest', 'front'] },
  backd:     { ar: 'ظهر',      en: 'Back',         areas: ['lats', 'rows', 'rear'] },
  shoulders: { ar: 'أكتاف',    en: 'Shoulders',    areas: ['front', 'side', 'rear'] },
  arms:      { ar: 'ذراعين',   en: 'Arms',         areas: ['biceps', 'triceps'] },
  chestback: { ar: 'صدر وظهر', en: 'Chest & Back', areas: ['chest', 'front', 'lats', 'rows'] },
}
/* The systems you can pick, per days a week. The first is the suggestion;
   «حر» is always last. A system is only a cycle of day types. */
const SPL = {
  full2: { ar: 'جسم كامل', cycle: ['full', 'full'] },
  ppl:   { ar: 'دفع · سحب · أرجل', cycle: ['push', 'pull', 'legs'] },
  ul:    { ar: 'علوي · سفلي', cycle: ['upper', 'lower', 'upper', 'lower'] },
  pplul: { ar: 'دفع · سحب · أرجل · علوي · سفلي', cycle: ['push', 'pull', 'legs', 'upper', 'lower'] },
  ppl2:  { ar: 'دفع · سحب · أرجل، مرتين', cycle: ['push', 'pull', 'legs', 'push', 'pull', 'legs'] },
  bro:   { ar: 'عضلة لكل يوم', cycle: ['chestd', 'backd', 'legs', 'shoulders', 'arms'] },
  free:  { ar: 'حر: أبنيها بنفسي', cycle: null },
}
const SPLIT_OPTS = { 3: ['full2', 'ppl', 'ul', 'free'], 4: ['ul', 'ppl', 'full2', 'free'], 5: ['pplul', 'ppl', 'ul', 'bro', 'free'], 6: ['ppl2', 'ul', 'bro', 'free'] }
const splitOpts = (d) => SPLIT_OPTS[d] || ['full2', 'ppl', 'ul', 'free']
const FREE_TYPES = ['push', 'pull', 'legs', 'upper', 'lower', 'full', 'chestback', 'chestd', 'backd', 'shoulders', 'arms']
/* How often one muscle comes round in a week on this cycle: the days that
   may train it, times how often each day comes (sessions a week ÷ cycle). */
function splitFreq(cycle, days) {
  const f = spwFor(days) / cycle.length
  const big = ['chest', 'lats', 'quads', 'hams']
  return big.reduce((s, a) => s + cycle.filter(t => allowed(t, a)).length * f, 0) / big.length
}
const LOWERISH = new Set(['legs', 'lower', 'full'])
const allowed = (type, a) => a === 'core' || a === 'cardio' || TYPE[type].areas.includes(a)

const GOALS = {
  muscle:   { ar: 'عضل أكبر', sub: 'تكبّر العضل وتشدّه' },
  strength: { ar: 'أقوى',     sub: 'ترفع أوزان أثقل' },
  fat:      { ar: 'تنشيف',    sub: 'تحرق دهون وتحفظ عضلك' },
  maintain: { ar: 'أحافظ',    sub: 'تثبت على مستواك بوقت أقل' },
}
// [sets, repsMin, repsMax, restSeconds]
const SCHEME = {
  muscle:   { c: [3, 6, 10, 120], i: [3, 10, 15, 75] },
  strength: { c: [3, 4, 6, 180],  i: [2, 8, 12, 75] },
  fat:      { c: [3, 8, 12, 90],  i: [3, 12, 15, 60] },
  maintain: { c: [2, 8, 12, 90],  i: [2, 10, 15, 60] },
}
const areaW = (a, goal) => a === 'cardio' ? (goal === 'fat' ? 2 : 0) : AREAS[a].w
const BUDGET = 70        // minutes per session, warm-up included
const LONG = 70          // a day past this gets a «طويل» flag
const LIGHT = 35         // a day under this gets topped up, or a «خفيف» flag
const MAX_ITEMS = 7

let _uid = 0
const uid = () => 'u' + (++_uid)

/* Bodyweight moves need their own reps: 6–10 push-ups is too few,
   4 × 6–10 pull-ups is too many for a beginner. [repsMin, repsMax, rest, unit] */
const BW = {
  push_up: [10, 20, 75], pull_up: [3, 8, 120], lunge: [10, 15, 75], triceps_dip: [6, 12, 90],
  plank: [30, 45, 60, 'sec'], hanging_knee_raise: [10, 15, 60], crunches: [12, 20, 60],
  chest_dip: [6, 12, 90], diamond_push_up: [8, 15, 75], hanging_leg_raise: [8, 15, 60], leg_raise: [10, 15, 60],
  ab_wheel: [6, 12, 60], russian_twist: [16, 24, 60], hollow_body_hold: [20, 40, 60, 'sec'],
}
function mkItem(cfg, id, by, sets) {
  const e = EXI[id]
  if (e.k === 'x') return { uid: uid(), id, sets: 1, r: [20, 20], rest: 0, by, mins: true, unit: 'min' }
  const sc = SCHEME[cfg.goal][e.k]
  const it = { uid: uid(), id, sets: sets ?? sc[0], r: [sc[1], sc[2]], rest: sc[3], by }
  const bw = BW[id]
  if (bw) { it.r = [bw[0], bw[1]]; it.rest = cfg.goal === 'fat' ? Math.min(bw[2], 60) : bw[2]; if (bw[3]) it.unit = bw[3] }
  return it
}
const itemMinutes = (it) => it.mins ? 20 : it.sets * (40 + it.rest) / 60 + 1
const dayMinutes = (d) => 6 + d.items.reduce((s, it) => s + itemMinutes(it), 0)

const RANK = { quads: 0, hams: 1, lats: 2, rows: 2, chest: 2, glutes: 3, front: 4, side: 5, rear: 5, calves: 6, biceps: 7, triceps: 7, core: 90, cardio: 99 }
function sortDay(d) {
  if (d.manual) return
  d.items.sort((a, b) => key(a) - key(b))
  function key(it) { const e = EXI[it.id]; const r = RANK[e.area]; return r >= 90 ? r : (e.k === 'c' ? 0 : 20) + r }
}

function newPlan(types, spw) { return { types, spw, days: types.map(t => ({ type: t, items: [] })) } }

function placeDay(plan, e, o = {}) {
  const a = e.area
  let best = -1, bs = Infinity
  plan.days.forEach((d, i) => {
    if (!allowed(d.type, a)) return
    const areaSets = d.items.reduce((s, it) => s + ((EXI[it.id].cr[a] || 0) >= 1 ? it.sets : 0), 0)
    if (o.avoidHit && areaSets > 0) return
    if (o.budget) {
      const probe = o.item || { sets: 3, rest: 90 }
      if (dayMinutes(d) + itemMinutes(probe) > BUDGET || d.items.length >= MAX_ITEMS) return
    }
    // fewer sets of this area first, then the shorter day (keeps days even)
    let sc = areaSets * 10 + d.items.length * 2 + dayMinutes(d) * 0.12 + i * 0.01
    if ((a === 'core' || a === 'cardio') && !LOWERISH.has(d.type)) sc += 25
    if (e.fat === 3 && d.items.some(it => EXI[it.id].fat === 3)) sc += 15
    if (sc < bs) { bs = sc; best = i }
  })
  return best
}

/* A pick whose muscle has no day in the cycle (a free system with no leg
   day, say) still goes in: on the lightest day, flagged, and the app says so
   softly. Never refused. A pick may carry the day it was put on. */
const lightestDay = (plan) => plan.days.reduce((b, d, i) => dayMinutes(d) < dayMinutes(plan.days[b]) ? i : b, 0)
function buildFromPicks(cfg) {
  const types = cfg.cycle || cfg.keepSplit || splitFor(cfg.days)
  const plan = newPlan(types, spwOf(cfg))
  for (const p of cfg.picks) {
    if (!EXI[p.id]) continue
    let di = (p.day != null && p.day < types.length) ? p.day : placeDay(plan, EXI[p.id])
    let orphan = false
    if (di < 0) { orphan = true; di = lightestDay(plan) }
    const it = mkItem(cfg, p.id, p.by || 'user', p.sets)
    if (p.r) it.r = [...p.r]
    // reps he set himself in the builder (hf_plan repsOwn): they beat Settings
    if (p.own) it.own = true
    // his own number of cardio sessions is kept (mkItem's default is one)
    if (EXI[p.id].k === 'x' && Number(p.sets) > 0) it.sets = Math.round(Number(p.sets))
    // the pick this row came from: two rows of one exercise on one day
    // (a back-off row) are two picks, and an edit goes to its own
    Object.defineProperty(it, 'src', { value: p, enumerable: false, writable: true, configurable: true })
    if (p.rest != null) it.rest = p.rest
    if (p.unit) it.unit = p.unit
    if (p.name) it.name = p.name
    if (p.orig) it.orig = p.orig
    if (p.why) it.why = p.why
    if (orphan || !allowed(types[di], EXI[p.id].area)) it.orphan = true
    plan.days[di].items.push(it)
  }
  // An existing plan opened to edit keeps his order inside each day.
  if (cfg.keepOrder) plan.days.forEach(d => { d.manual = true })
  plan.days.forEach(sortDay)
  return plan
}

function stats(plan) {
  const f = plan.spw / plan.days.length
  const vol = {}, hit = {}
  for (const a of AREA_ORDER) { vol[a] = 0; hit[a] = new Set() }
  plan.days.forEach((d, di) => d.items.forEach(it => {
    const e = EXI[it.id]
    for (const [a, c] of Object.entries(e.cr)) {
      vol[a] += (e.k === 'x' ? 1 : it.sets) * c * f
      if (c >= 1) hit[a].add(di)
    }
  }))
  const freq = {}
  for (const a of AREA_ORDER) freq[a] = hit[a].size * f
  return { vol, freq, f, hit }
}
const matchingDays = (plan, a) => plan.days.filter(d => allowed(d.type, a)).length

function cardState(card, st, T) {
  const areas = card.areas.filter(a => T[a])
  if (!areas.length) return { opt: true, segs: [], ok: true }
  const segs = areas.map(a => ({ a, cur: st.vol[a], min: T[a][0], f: Math.min(1, st.vol[a] / T[a][0]) }))
  return { segs, ok: segs.every(s => !isShort(s.cur, s.min)) }
}
function coverage(plan, goal) {
  const st = stats(plan), T = targets(goal)
  let n = 0, of = 0
  for (const c of CARDS) { const cs = cardState(c, st, T); if (cs.opt) continue; of++; if (cs.ok) n++ }
  return { n, of, st, T }
}

function cardStates(cov) {
  const out = {}
  for (const c of CARDS) { const cs = cardState(c, cov.st, cov.T); out[c.id] = cs.opt ? 'opt' : cs.ok ? 'ok' : cs.segs.some(x => x.cur >= 0.5) ? 'part' : '' }
  return out
}

function findGaps(plan, goal, aim) {
  const st = stats(plan), T = targets(goal), out = []
  for (const a of AREA_ORDER) {
    const t = T[a]
    if (!t) continue
    const cur = st.vol[a], lowT = aim === 'good' ? t[1] : t[0]
    if (cur < 1) out.push({ a, type: 'missing', sev: 1.5, cur, t })
    else if (isShort(cur, lowT)) out.push({ a, type: 'low', sev: (lowT - cur) / lowT, cur, t, lowT })
    /* «once a week» is no longer a gap: what grows a muscle is its sets a
       week, not how they are split (Schoenfeld 2019, Pelland 2026). It is a
       soft tip now — see findTips — and never lowers «7 من 7». */
  }
  const back = st.vol.lats + st.vol.rows
  if (st.vol.chest >= 4 && back >= 1 && back < 0.67 * st.vol.chest && !out.some(g => g.a === 'lats' || g.a === 'rows'))
    out.push({ a: st.vol.rows <= st.vol.lats ? 'rows' : 'lats', type: 'lop', sev: 1 - back / (0.67 * st.vol.chest), w: 2, cur: back, ref: st.vol.chest, pair: 'back' })
  if (st.vol.quads >= 4 && st.vol.hams >= 1 && st.vol.hams < 0.5 * st.vol.quads && !out.some(g => g.a === 'hams'))
    out.push({ a: 'hams', type: 'lop', sev: 1 - st.vol.hams / (0.5 * st.vol.quads), w: 2, cur: st.vol.hams, ref: st.vol.quads, pair: 'legs' })
  for (const g of out) {
    g.score = (g.w || areaW(g.a, goal)) * g.sev
    // weekly sets still missing — drives «add a set before a new exercise»
    g.short = g.type === 'lop' ? (g.pair === 'back' ? 0.67 : 0.5) * g.ref - g.cur
      : g.type === 'rare' ? 0 : (g.lowT || g.t[0]) - g.cur
  }
  out.sort((x, y) => y.score - x.score || AREA_ORDER.indexOf(x.a) - AREA_ORDER.indexOf(y.a))
  return { gaps: out.filter(g => g.score > 0), st, T }
}

/* «كثير»: above the top of the range. A warning only — never removes a pick. */
function findWarns(plan, goal) {
  const st = stats(plan), T = targets(goal), out = []
  for (const a of AREA_ORDER) {
    const t = T[a]; if (!t || a === 'cardio' || a === 'lats' || a === 'rows') continue
    if (st.vol[a] > t[2] + 0.5) out.push({ a, cur: st.vol[a], max: t[2] })
  }
  // the back is one muscle here too: 10–20 for both kinds of pulling together
  const back = st.vol.lats + st.vol.rows
  if (back > 20.5) out.push({ a: 'back', cur: back, max: 20 })
  return out
}

/* «كثير» → a suggestion, one tap to accept (Hamza: «يقترح وش أشيل»).
   Tries removing one exercise, or a set or two from one, that brings the
   muscle back under the top of its range without dropping it — or anything
   else — under the minimum. Exercises the app added go before his own. */
function muchFix(plan, goal, w) {
  const T = targets(goal), areas = w.a === 'back' ? ['lats', 'rows'] : [w.a]
  const top = w.max, good = w.a === 'back' ? 10 : T[w.a][1]
  const volOf = (st) => areas.reduce((s, a) => s + st.vol[a], 0)
  const below = (st) => AREA_ORDER.filter(a => T[a] && a !== 'cardio' && st.vol[a] < T[a][0] - 0.05).length
  const base = below(stats(plan))
  const opts = []
  plan.days.forEach((d, di) => d.items.forEach((it, ii) => {
    const e = EXI[it.id]
    if (it.mins || !areas.some(a => (e.cr[a] || 0) >= 1)) return
    const twin = plan.days.some(dd => dd.items.some(x => x !== it && EXI[x.id].mv === e.mv && areas.includes(EXI[x.id].area)))
    // a) take the exercise out
    d.items.splice(ii, 1)
    let st = stats(plan); const after = volOf(st), lost = below(st) - base
    d.items.splice(ii, 0, it)
    opts.push({ kind: 'rm', di, uid: it.uid, id: it.id, after, score: (after > top + 0.5 ? 40 : 0) + (after < good - 0.5 ? 12 : 0) + lost * 60 + (e.k === 'c' ? 5 : 0) + (it.by === 'user' ? 3 : 0) - (twin ? 3 : 0) + Math.abs(after - (top + good) / 2) * 0.15 - ii * 0.01 })
    // b) fewer sets on it, never under 2
    for (let k = 1; it.sets - k >= 2 && k <= 2; k++) {
      it.sets -= k; st = stats(plan); const af = volOf(st), l2 = below(st) - base; it.sets += k
      if (af <= top + 0.5) { opts.push({ kind: 'sets', di, uid: it.uid, id: it.id, k, after: af, score: 4 + k * 1.5 + l2 * 60 + (it.by === 'user' ? 2 : 0) + Math.abs(af - (top + good) / 2) * 0.15 }); break }
    }
  }))
  opts.sort((x, y) => x.score - y.score)
  const best = opts[0]
  return best && best.after <= top + 0.5 ? best : null
}

/* Soft tips: never a gap, never a gate. Two buttons each: «عدّلها لي» (when
   there is a fix) and «خلّها كذا» (remembered for this plan).
   - session: more than ~10 sets of one muscle in one session — past that the
     extra sets help less (Remmert 2025). Over 11 so it does not nag at 11.
   - rare: a big muscle comes round once a week. Fine when its sets are there.
   - orphan: a pick whose muscle has no day in the system. */
const SESSION_CAP = 11
function sessionLoad(d, a) {
  const areas = a === 'back' ? ['lats', 'rows'] : [a]
  return d.items.reduce((s, it) => s + (!it.mins && areas.includes(EXI[it.id].area) ? it.sets : 0), 0)
}
function findTips(plan, goal) {
  const st = stats(plan), T = targets(goal), out = []
  const gapAreas = new Set(findGaps(plan, goal).gaps.map(g => g.a))
  for (const a of ['chest', 'back', 'quads', 'hams', 'side', 'biceps', 'triceps', 'glutes', 'calves', 'rear']) {
    plan.days.forEach((d, di) => {
      const n = sessionLoad(d, a)
      if (n <= SESSION_CAP) return
      // move one exercise to another day that may train it and has room
      const areas = a === 'back' ? ['lats', 'rows'] : [a]
      const mine = d.items.filter(it => !it.mins && areas.includes(EXI[it.id].area)).sort((x, y) => x.sets - y.sets)
      let fix = null
      for (const it of mine) {
        const to = plan.days.map((x, i) => ({ x, i })).filter(o => o.i !== di && allowed(o.x.type, EXI[it.id].area) && sessionLoad(o.x, a) + it.sets <= SESSION_CAP && dayMinutes(o.x) + itemMinutes(it) <= BUDGET + 5)
          .sort((p, q) => sessionLoad(p.x, a) - sessionLoad(q.x, a))[0]
        if (to) { fix = { kind: 'move', uid: it.uid, id: it.id, from: di, to: to.i, sets: it.sets }; break }
      }
      out.push({ kind: 'session', a, day: di, n, fix, key: 'session:' + a + ':' + di })
    })
  }
  for (const a of ['chest', 'back', 'quads', 'hams']) {
    const areas = a === 'back' ? ['lats', 'rows'] : [a]
    if (areas.some(x => gapAreas.has(x))) continue
    const hit = new Set(areas.flatMap(x => [...st.hit[x]]))
    if (!hit.size || hit.size * st.f >= 1.3) continue
    // split it: move one exercise to another day that may train it and does not yet
    const src = plan.days.flatMap((d, di) => d.items.filter(it => !it.mins && areas.includes(EXI[it.id].area)).map(it => ({ it, di })))
    let fix = null
    if (src.length >= 2) {
      const s = src.slice().sort((p, q) => p.it.sets - q.it.sets)[0]
      const to = plan.days.findIndex((d, i) => i !== s.di && !hit.has(i) && allowed(d.type, EXI[s.it.id].area) && dayMinutes(d) + itemMinutes(s.it) <= BUDGET + 5)
      if (to >= 0) fix = { kind: 'move', uid: s.it.uid, id: s.it.id, from: s.di, to, sets: s.it.sets }
    }
    out.push({ kind: 'rare', a, times: hit.size * st.f, fix, key: 'rare:' + a })
  }
  plan.days.forEach((d, di) => d.items.forEach(it => {
    if (!it.orphan) return
    const e = EXI[it.id]
    const want = ['legs', 'push', 'pull', 'upper', 'lower', 'arms', 'full'].find(t => TYPE[t].areas.includes(e.area))
    out.push({ kind: 'orphan', a: e.area, day: di, uid: it.uid, id: it.id, want, fix: want ? { kind: 'addday', type: want } : null, key: 'orphan:' + it.id })
  }))
  return out
}

/* ── words ── */
const n0 = (x) => Math.floor(x + 0.001)
const n1 = (x) => Math.round(x)
function setsWord(n) {
  n = Math.max(0, Math.round(n))
  if (n === 0) return 'ولا مجموعة'
  if (n === 1) return 'مجموعة وحدة'
  if (n === 2) return 'مجموعتين'
  if (n <= 10) return n + ' مجموعات'
  return n + ' مجموعة'
}
const fem = (a) => AREAS[a].pr === 'لها'
function hasMove(plan, pred) { return plan.days.some(d => d.items.some(it => pred(EXI[it.id]))) }

function gapWords(g, plan) {
  const A = AREAS[g.a], L = A.lbl
  const has = (pred) => hasMove(plan, pred)
  if (g.type === 'missing') {
    const title = {
      chest: 'الصدر: ولا تمرين له', lats: 'الظهر: ما فيه سحب من فوق', rows: 'الظهر: ما فيه سحب من قدّام',
      side: 'جنب الكتف: ما له تمرين خاص', rear: 'ورا الكتف: ما له تمرين خاص', quads: 'الفخذ الأمامي: ولا تمرين له',
      hams: 'الفخذ الخلفي: ولا تمرين له', glutes: 'الأرداف: ما لها تمرين خاص', calves: 'السمانة: ما لها ولا تمرين',
      biceps: 'الذراع الأمامي: ما له تمرين خاص', triceps: 'الذراع الخلفي: ما له تمرين خاص', core: 'البطن: ولا تمرين له',
      cardio: 'الكارديو: ولا جلسة',
    }[g.a]
    const sub = {
      chest: 'أي خطة كاملة تحتاج ضغط للصدر',
      lats: has(e => e.mv === 'row') ? 'السحب من قدّام وحده ما يكفي، الظهر يبي سحب من فوق بعد' : 'السحب من فوق هو اللي يعرّض الظهر',
      rows: has(e => e.cr.chest >= 1) ? 'عندك ضغط للصدر، والظهر بدون سحب من قدّام يختل التوازن' : 'السحب من قدّام يعطي الظهر سماكة',
      side: has(e => ['press', 'ohp', 'incline'].includes(e.mv)) ? 'الضغط يشغّل قدّام الكتف أكثر من جنبه' : 'الرفرفة الجانبية هي اللي تعرّض الكتف',
      rear: has(e => e.mv === 'row') ? 'يجيه شوي من السحب، وما يكفي' : 'تمرين صغير يوازن الكتف',
      quads: 'أكبر عضلة في رجلك',
      hams: has(e => e.area === 'quads') ? 'دفع الأرجل والسكوات يشغّلون الأمامي بس' : 'يحتاج تمرين خاص فيه',
      glutes: has(e => e.area === 'quads') ? 'تشتغل نص من تمارين الفخذ، وما يكفي' : 'تحتاج تمرين خاص فيها',
      calves: 'ما تشتغل من تمارين الفخذ',
      biceps: has(e => e.card === 'back') ? 'يجيه نص من السحب، وما يكفي' : 'يحتاج تمرين خاص فيه',
      triceps: has(e => e.cr.triceps === 0.5) ? 'يجيه نص من الضغط، وما يكفي' : 'يحتاج تمرين خاص فيه',
      core: 'تمرين أو تمرينين بالأسبوع يكفون',
      cardio: 'للتنشيف: جلستين كارديو بالأسبوع على الأقل',
    }[g.a]
    const why = g.a === 'hams' && has(e => e.area === 'quads') ? 'kubo' : (g.a === 'rows' && has(e => e.cr.chest >= 1)) ? 'push' : g.a === 'side' ? 'side' : g.a === 'cardio' ? 'who' : 'volume'
    return { title, sub, why }
  }
  if (g.type === 'low') {
    if (g.a === 'cardio') return { title: `${L}: جلسة وحدة بالأسبوع بس`, sub: 'للتنشيف: جلستين على الأقل', why: 'who' }
    const need = g.lowT || g.t[0]
    return { title: `${L}: ${setsWord(n0(g.cur))} بالأسبوع بس`, sub: `${fem(g.a) ? 'تحتاج' : 'يحتاج'} ${need} على الأقل، والأحسن ${g.t[1]} إلى ${g.t[2]}`, why: 'volume' }
  }
  if (g.type === 'rare') return { title: `${g.pair === 'back' ? 'الظهر' : L}: مرة وحدة بالأسبوع`, sub: 'العضلة تكبر أكثر لو تمرّنها مرتين', why: 'freq' }
  if (g.pair === 'back') return { title: 'الظهر أقل من الصدر بكثير', sub: `الصدر ${setsWord(n0(g.ref))} بالأسبوع، والظهر ${setsWord(n0(g.cur))} بس`, why: 'push' }
  return { title: 'الفخذ الخلفي أقل من الأمامي بكثير', sub: `الأمامي ${setsWord(n0(g.ref))} بالأسبوع، والخلفي ${setsWord(n0(g.cur))} بس`, why: 'kubo' }
}

function whyText(g, plan, how) {
  const A = AREAS[g.a], has = (pred) => hasMove(plan, pred)
  const kan = fem(g.a) ? 'كانت' : 'كان', verb = fem(g.a) ? 'تشتغل' : 'يشتغل'
  if (how === 'repeat') return g.type === 'rare'
    ? `كررناه بيوم ثاني عشان ${g.pair === 'back' ? 'الظهر' : A.lbl} ${g.pair === 'back' ? 'يشتغل' : verb} مرتين بالأسبوع`
    : `كررناه بيوم ثاني: ${A.lbl} ${kan} ${setsWord(n0(g.cur))} بالأسبوع بس`
  if (g.type === 'missing') return {
    chest: 'الصدر ما كان له ولا تمرين',
    lats: 'الظهر ما كان فيه سحب من فوق',
    rows: has(e => e.cr.chest >= 1) ? 'الظهر ما كان فيه سحب من قدّام، والصدر بدونه يختل التوازن' : 'الظهر ما كان فيه سحب من قدّام',
    side: has(e => ['press', 'ohp', 'incline'].includes(e.mv)) ? 'جنب الكتف ما كان له تمرين، والضغط ما يكفيه' : 'جنب الكتف ما كان له تمرين',
    rear: 'ورا الكتف ما كان له تمرين خاص',
    quads: 'الفخذ الأمامي ما كان له ولا تمرين',
    hams: has(e => e.area === 'quads') ? 'الفخذ الخلفي ما كان له تمرين، ودفع الأرجل ما يشغّله' : 'الفخذ الخلفي ما كان له ولا تمرين',
    glutes: 'الأرداف ما كان لها تمرين خاص',
    calves: 'السمانة ما كان لها ولا تمرين',
    biceps: 'الذراع الأمامي ما كان له تمرين خاص',
    triceps: 'الذراع الخلفي ما كان له تمرين خاص',
    core: 'البطن ما كان له ولا تمرين',
    cardio: 'للتنشيف: جلسة كارديو بعد التمرين',
  }[g.a]
  if (g.type === 'low') return g.a === 'cardio' ? 'للتنشيف: جلسة كارديو ثانية' : `${A.lbl} ${kan} ${setsWord(n0(g.cur))} بالأسبوع بس`
  if (g.type === 'rare') return `عشان ${g.pair === 'back' ? 'الظهر' : A.lbl} ${g.pair === 'back' ? 'يشتغل' : verb} مرتين بالأسبوع بدل مرة`
  if (g.pair === 'back') return 'الظهر كان أقل من الصدر بكثير'
  return 'الفخذ الخلفي كان أقل من الأمامي بكثير'
}

const EVIDENCE = {
  volume: { t: 'العضلة تكبر أكثر كل ما زادت مجموعاتها بالأسبوع، لين حوالي 10 وأكثر.', src: 'Schoenfeld وزملاؤه 2017', url: 'https://pubmed.ncbi.nlm.nih.gov/27433992/' },
  freq:   { t: 'تمرين العضلة مرتين بالأسبوع طلع أحسن من مرة وحدة.', src: 'Schoenfeld وزملاؤه 2016', url: 'https://pubmed.ncbi.nlm.nih.gov/27102172/' },
  kubo:   { t: 'في دراسة، السكوات كبّر الفخذ الأمامي وما كبّر الخلفي أبد.', src: 'Kubo وزملاؤه 2019', url: 'https://doi.org/10.1007/s00421-019-04181-y' },
  push:   { t: 'أغلب الناس يدفعون أكثر من ما يسحبون. التوازن بينهم قاعدة مدربين، مو قانون مثبت.', src: 'Negrete وزملاؤه 2013', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3625793/' },
  side:   { t: 'قاعدة مدربين: الضغط يشغّل قدّام الكتف، والجنب يحتاج رفرفة جانبية.', src: 'إرشادات ACSM 2026', url: 'https://acsm.org/resistance-training-guidelines-update-2026/' },
  who:    { t: 'منظمة الصحة تنصح بنشاط هوائي كل أسبوع، وتمارين مقاومة لكل العضلات يومين أو أكثر.', src: 'منظمة الصحة العالمية 2020', url: 'https://www.who.int/publications/i/item/9789240015128' },
}

/* ── fill ── */
const GYM_EQ = ['machine', 'cable', 'dumbbell', 'barbell']
/* «بأي أداة؟» per muscle card: a Set of tools, empty = all his tools. */
const toolOk = (cfg, e) => { const p = cfg.mtool && cfg.mtool[e.card]; return !p || !p.size || p.has(e.eq) }
function candidates(plan, cfg, g, openAreas, userEq, userMoves, onlyNew = true) {
  const inPlan = new Set(plan.days.flatMap(d => d.items.map(it => it.id)))
  const big = AREAS[g.a].big
  const hasGym = GYM_EQ.some(q => cfg.eq.has(q))
  const base = EX.filter(e => cfg.eq.has(e.eq) && (!onlyNew || !inPlan.has(e.id)) && !cfg.excluded.has(e.id) && (e.cr[g.a] || 0) >= 1)
  // the per-muscle tool choice wins; fall back to all his tools only if it has nothing
  const strict = base.filter(e => toolOk(cfg, e))
  // nothing new with his chosen tool, but one already in the plan trains it:
  // repeat or add a set to that one instead of switching tools
  const pref = cfg.mtool && cfg.mtool[AREAS[g.a].card]
  if (!strict.length && pref && pref.size && hasMove(plan, x => (x.cr[g.a] || 0) >= 1 && toolOk(cfg, x))) { const none = []; none.fallback = false; return none }
  const list = strict.length ? strict : base
  const out = list.map(e => {
      let s = 0
      if (e.area === g.a) s += 4
      for (const b of openAreas) if (b !== g.a && (e.cr[b] || 0) > 0 && e.cr[b] < 1) s += e.cr[b]
      if (userEq.has(e.eq)) s += 1
      if ((big && e.k === 'c') || (!big && e.k !== 'c')) s += 1
      if (e.eq === 'machine' || e.eq === 'cable') s += 0.5
      // has gym tools → a push-up or a lunge is not the second chest or leg move
      if (e.eq === 'body' && hasGym) s -= g.a === 'core' ? 1 : 3
      if (userMoves.has(e.mv + ':' + e.area)) s -= 2
      else if (hasMove(plan, x => x.mv === e.mv && x.area === e.area)) s -= 1
      return { e, s }
    })
    .sort((x, y) => y.s - x.s || x.e.ord - y.e.ord)
    .map(x => x.e)
  out.fallback = !strict.length && base.length > 0
  return out
}

function setsFor(cfg, e, g, st) {
  if (e.k === 'x') return 1
  const t = g.t || targets(cfg.goal)[g.a]
  if (!t) return SCHEME[cfg.goal][e.k][0]
  const need = g.type === 'rare' ? t[1] / 2 : g.type === 'lop' ? g.short : (t[1] - st.vol[g.a])
  return Math.max(2, Math.min(4, Math.ceil(need / st.f)))
}
const fallbackNote = (cfg, e) => { const p = cfg.mtool && cfg.mtool[e.card]; return p && p.size ? ` (ما فيه له بـ${[...p].map(q => EQ[q].one).join(' أو ')}، فاخترنا ${EQ[e.eq].one})` : '' }

// the app's own additions first: his picks keep the sets he chose when possible
function bumpFor(plan, g, cap = 5) {
  for (const by of ['app', 'user']) for (const d of plan.days) {
    const it = d.items.find(x => x.by === by && (EXI[x.id].cr[g.a] || 0) >= 1 && !x.mins && x.sets < cap)
    if (it && dayMinutes(d) + (40 + it.rest) / 60 <= BUDGET + 3) return { d, it }
  }
  return null
}
function doBump(plan, g, f) {
  const { d, it } = f
  it.sets += 1
  it.bumped = (it.bumped || 0) + 1
  const why = `زدنا مجموعة: ${AREAS[g.a].lbl} ${fem(g.a) ? 'كانت' : 'كان'} ${setsWord(n0(g.cur))} بالأسبوع بس`
  it.bumpWhy = why
  return { kind: 'bump', item: it, day: plan.days.indexOf(d), gap: g, why }
}

/* One step of «كمّل»: returns the change it made, or null. */
function fillStep(plan, cfg, blocked) {
  const { gaps, st } = findGaps(plan, cfg.goal, cfg.aim)
  const open = gaps.filter(g => !blocked.has(g.a + ':' + g.type))
  if (!open.length) return null
  const openAreas = new Set(gaps.map(g => g.a))
  const userItems = plan.days.flatMap(d => d.items.filter(it => it.by === 'user'))
  const userEq = new Set(userItems.map(it => EXI[it.id].eq))
  const userMoves = new Set(userItems.map(it => EXI[it.id].mv + ':' + EXI[it.id].area))
  for (const g of open) {
    // a free system may have no day for this muscle: say so, do not force it
    if (!matchingDays(plan, g.a)) { blocked.set(g.a + ':' + g.type, { gap: g, reason: 'split', need: [] }); continue }
    // 0) short by about one set's worth: add a set before adding an exercise
    if ((g.type === 'low' || g.type === 'lop') && g.short <= st.f + 0.05) {
      const f = bumpFor(plan, g); if (f) return doBump(plan, g, f)
    }
    const cands = candidates(plan, cfg, g, openAreas, userEq, userMoves)
    let noRoom = false
    for (const e of cands) {
      const it = mkItem(cfg, e.id, 'app', setsFor(cfg, e, g, st))
      const di = placeDay(plan, e, { avoidHit: g.type === 'rare', budget: true, item: it })
      if (di < 0) { noRoom = true; continue }
      it.why = whyText(g, plan) + (cands.fallback ? fallbackNote(cfg, e) : '')
      it.gap = g.a
      plan.days[di].items.push(it)
      sortDay(plan.days[di])
      return { kind: 'add', item: it, day: di, gap: g }
    }
    // No other exercise fits. 1) one more set on one that already trains it.
    if (g.type === 'low' || g.type === 'lop') {
      const f = bumpFor(plan, g, 4); if (f) return doBump(plan, g, f)
    }
    // 2) the same exercise again on another day that does not train it yet.
    if (g.type !== 'missing') {
      const src = plan.days.flatMap(d => d.items).filter(x => (EXI[x.id].cr[g.a] || 0) >= 1 && !x.mins)
      for (const s0 of src) {
        const e = EXI[s0.id]
        const di = placeDay(plan, e, { avoidHit: true, budget: true, item: s0 })
        if (di < 0 || plan.days[di].items.some(x => x.id === s0.id)) continue
        const it = mkItem(cfg, s0.id, 'app', s0.sets)
        it.r = [...s0.r]; it.rest = s0.rest; it.repeat = true; if (s0.unit) it.unit = s0.unit; if (s0.own) it.own = true
        it.why = whyText(g, plan, 'repeat'); it.gap = g.a
        plan.days[di].items.push(it)
        sortDay(plan.days[di])
        return { kind: 'add', item: it, day: di, gap: g }
      }
    }
    blocked.set(g.a + ':' + g.type, { gap: g, reason: cands.length || noRoom ? 'time' : 'eq', need: unlockFor(cfg, g.a) })
  }
  return fillStep(plan, cfg, blocked)
}

/* Light days: a 6-day split can leave 2-exercise, 25-minute days. Top the
   lightest day up with an area it trains that is still under its good range. */
function evenStep(plan, cfg, tried) {
  const T = targets(cfg.goal), st = stats(plan), L = dayLabels(plan)
  const light = plan.days.map((d, i) => ({ d, i, m: dayMinutes(d) }))
    .filter(x => x.m < LIGHT && x.d.items.filter(it => !it.mins).length < 4 && !tried.has(x.i))
    .sort((p, q) => p.m - q.m)
  for (const { d, i } of light) {
    const areas = TYPE[d.type].areas.filter(a => T[a] && a !== 'cardio' && st.vol[a] < T[a][1] * 1.3)
      .sort((p, q) => st.vol[p] / T[p][1] - st.vol[q] / T[q][1])
    for (const a of areas) {
      if (d.items.some(it => EXI[it.id].area === a)) continue
      const g = { a, type: 'light', t: T[a], cur: st.vol[a] }
      const userItems = plan.days.flatMap(x => x.items.filter(it => it.by === 'user'))
      const userEq = new Set(userItems.map(it => EXI[it.id].eq))
      let cands = candidates(plan, cfg, g, new Set(), userEq, new Set())
      if (!cands.length) cands = candidates(plan, cfg, g, new Set(), userEq, new Set(), false).filter(e => !d.items.some(it => it.id === e.id))
      const e = cands[0]; if (!e) continue
      const it = mkItem(cfg, e.id, 'app')
      if (dayMinutes(d) + itemMinutes(it) > BUDGET) continue
      it.why = `يوم ${L[i].ar}${L[i].v ? ' ' + L[i].v : ''} كان خفيف، و${AREAS[a].lbl} ${fem(a) ? 'تتحمّل' : 'يتحمّل'} زيادة`
      it.gap = a
      d.items.push(it); sortDay(d)
      return { kind: 'add', item: it, day: i, gap: g }
    }
    tried.add(i)
  }
  return null
}

function fill(plan, cfg) {
  const blocked = new Map(), steps = []
  const snap = (s) => {
    const cov = coverage(plan, cfg.goal)
    s.snap = { n: cov.n, of: cov.of, open: new Set(findGaps(plan, cfg.goal).gaps.map(g => g.a)), cards: cardStates(cov), areas: areaStates(cov) }
    steps.push(s)
  }
  for (let i = 0; i < 40; i++) {
    const s = fillStep(plan, cfg, blocked)
    if (!s) break
    snap(s)
  }
  const tried = new Set()
  for (let i = 0; i < 12; i++) {
    const s = evenStep(plan, cfg, tried)
    if (!s) break
    snap(s)
  }
  // keep only what is still a real gap (below the minimum or out of balance)
  const still = new Map(findGaps(plan, cfg.goal).gaps.map(g => [g.a + ':' + g.type, g]))
  for (const k of [...blocked.keys()]) { if (!still.has(k)) blocked.delete(k); else blocked.get(k).gap = still.get(k) }
  return { steps, blocked }
}

/* Per body area: 'ok' at or above its minimum, 'some' started, 'none'. The back
   is one muscle on the figure. Used by the lit body. */
function areaStates(cov) {
  const out = {}
  for (const a of AREA_ORDER) {
    const t = cov.T[a]; if (!t) continue
    const v = cov.st.vol[a]
    out[a] = !isShort(v, t[0]) ? 'ok' : v >= 0.5 ? 'some' : 'none'
  }
  const b = cardState(CARD.back, cov.st, cov.T)
  out.back = b.ok ? 'ok' : b.segs.some(x => x.cur >= 0.5) ? 'some' : 'none'
  return out
}

function unlockFor(cfg, a) {
  return EQ_ORDER.filter(q => !cfg.eq.has(q) && EX.some(e => e.eq === q && (e.cr[a] || 0) >= 1))
}

function alternatives(plan, cfg, it) {
  const e = EXI[it.id]
  const inPlan = new Set(plan.days.flatMap(d => d.items.map(x => x.id)))
  return EX.filter(x => x.id !== e.id && x.area === e.area && cfg.eq.has(x.eq) && !inPlan.has(x.id))
    .map(x => ({ x, s: (x.mv !== e.mv ? 1 : 0) + (x.eq === e.eq ? 0.5 : 0) + (x.k === e.k ? 0.5 : 0) + (toolOk(cfg, x) ? 1 : 0) - (x.eq === 'body' && GYM_EQ.some(q => cfg.eq.has(q)) ? 1 : 0) }))
    .sort((p, q) => q.s - p.s || p.x.ord - q.x.ord).slice(0, 3).map(p => p.x)
}

/* Day labels: the app's own words (src/components/home/dayParts.js). */
function dayLabels(plan) {
  const count = {}, seen = {}
  plan.days.forEach(d => { count[d.type] = (count[d.type] || 0) + 1 })
  return plan.days.map(d => {
    seen[d.type] = (seen[d.type] || 0) + 1
    const v = count[d.type] > 1 ? String.fromCharCode(64 + seen[d.type]) : ''
    return { ar: TYPE[d.type].ar, v, en: TYPE[d.type].en + (v ? ' ' + v : '') }
  })
}
function dayMuscles(d) {
  const seen = []
  for (const it of d.items) { const c = CARD[EXI[it.id].card]; const w = c.id === 'legs' ? 'أرجل' : c.ar; if (!seen.includes(w)) seen.push(w) }
  return seen
}

/* ── day types from a stored day's name ── */
const TYPE_WORDS = [
  [/chest\s*(&|and|و)\s*back/i, 'chestback'],
  [/full\s*body|^full\b/i, 'full'],
  [/^push/i, 'push'], [/^pull/i, 'pull'], [/^legs?\b/i, 'legs'],
  [/^upper/i, 'upper'], [/^lower/i, 'lower'],
  [/^chest/i, 'chestd'], [/^back/i, 'backd'], [/^shoulders?/i, 'shoulders'], [/^arms/i, 'arms'],
]
/** The builder's day type for a stored day: from its English head
 *  («Push A — …»), or else from what it trains. */
export function inferDayType(day) {
  const head = String(day?.name || '').split('—')[0].trim()
  for (const [re, t] of TYPE_WORDS) if (re.test(head)) return t
  const groups = new Set((day?.exercises || []).map(e => e.muscle))
  const has = (...g) => g.some(x => groups.has(x))
  const upper = has('Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'), lower = has('Legs')
  if (upper && lower) return 'full'
  if (lower) return 'legs'
  if (has('Chest') && has('Back')) return 'upper'
  if (has('Chest', 'Triceps') && !has('Back', 'Biceps')) return 'push'
  if (has('Back', 'Biceps') && !has('Chest', 'Triceps')) return 'pull'
  return 'full'
}

const GOAL_IN = { muscle: 'muscle', strength: 'strength', fat_loss: 'fat', fat: 'fat', maintain: 'maintain' }
const EQ_IN = { machine: 'machine', smith: 'machine', cable: 'cable', dumbbell: 'dumbbell', barbell: 'barbell', cardio: 'cardio', bodyweight: 'body', body: 'body' }

/** The split id for a cycle on this many days: one of the listed systems
 *  when it matches exactly, else «حر» with that cycle. */
export function splitIdFor(cycle, days) {
  const same = (a, b) => a && b && a.length === b.length && a.every((x, i) => x === b[i])
  const hit = splitOpts(days).find(id => SPL[id].cycle && same(SPL[id].cycle, cycle))
  return hit || 'free'
}

/**
 * An existing hf_plan opened in the builder: its days as a cycle, its
 * exercises as picks pinned to their days (keeping his sets, reps, rest
 * and order), and what the builder saved last time (tools, «خلّها كذا»).
 */
export function fromHfPlan(hf, { days = 4 } = {}) {
  const schedule = Array.isArray(hf?.weeklySchedule) ? hf.weeklySchedule : []
  const cycle = Array.isArray(hf?.split?.cycle) && hf.split.cycle.length === schedule.length && hf.split.cycle.every(t => TYPE[t])
    ? hf.split.cycle.slice()
    : schedule.map(inferDayType)
  const picks = []
  // one pick per row: the same lift twice on one day (a back-off row) is
  // two picks, so opening and saving never drops either
  schedule.forEach((d, di) => (d.exercises || []).forEach(ex => {
    const e = ensureEntry(ex.name, ex.muscle)
    const p = { id: e.id, day: di, orig: ex, name: ex.name }
    if (Number(ex.sets) > 0) p.sets = Math.round(Number(ex.sets))
    const lo = Number(ex.repsMin), hi = Number(ex.repsMax)
    if (lo > 0) p.r = [lo, hi >= lo ? hi : lo]
    if (Number.isFinite(Number(ex.restSeconds)) && ex.restSeconds !== '' && ex.restSeconds != null) p.rest = Math.max(0, Number(ex.restSeconds))
    if (ex.unit === 'sec') p.unit = 'sec'
    if (ex.repsOwn === true) p.own = true
    if (ex.by === 'app') { p.by = 'app'; if (ex.why) p.why = ex.why }
    picks.push(p)
  }))
  const b = hf?.builder || {}
  let eq = Array.isArray(b.equipment) && b.equipment.length ? b.equipment.map(q => EQ_IN[q]).filter(Boolean) : null
  if (!eq) {
    eq = [...new Set(picks.map(p => EXI[p.id].eq).filter(q => q !== 'other'))]
    if (!eq.includes('body')) eq.push('body')
  }
  const mtool = {}
  for (const [k, v] of Object.entries(b.toolsPerMuscle || {})) {
    const c = CARDS.find(x => x.key === k)
    if (c && Array.isArray(v)) mtool[c.id] = new Set(v.map(q => EQ_IN[q]).filter(Boolean))
  }
  const excluded = new Set((b.neverSuggest || []).map(n => entryForName(n)?.id).filter(Boolean))
  return {
    cycle, split: splitIdFor(cycle, days), picks, goal: GOAL_IN[hf?.goal] || 'muscle',
    eq: new Set(eq), mtool, excluded, dismissed: new Set(b.keepAsIs || []),
  }
}

/** A new cycle for picks pinned to days (his plan opened to edit): a
 *  pin stays only where the new day still takes that exercise's area;
 *  the rest are placed again like any pick. Changes `picks` in place. */
export function fitPins(picks, cycle) {
  for (const p of picks || []) {
    if (p.day == null) continue
    const e = EXI[p.id]
    if (!(e && p.day < cycle.length && TYPE[cycle[p.day]] && allowed(cycle[p.day], e.area))) delete p.day
  }
  return picks
}

/* hf_plan — the shape both designs read. Only optional fields are new
   (source, split, builder, and per exercise equip/part/by/why/unit/repsOwn); the
   old design ignores them. */
const PART = { quads: 'quads', hams: 'hamstrings', glutes: 'glutes', calves: 'calves' }
/**
 * The plan the builder made, as hf_plan.
 *   base — the stored plan this one edits (keeps its id, name, start and
 *          the names of days whose type did not change), or null for a
 *          new plan.
 */
export function toHfPlan(plan, cfg, { today, base = null } = {}) {
  const L = dayLabels(plan)
  const baseDays = Array.isArray(base?.weeklySchedule) ? base.weeklySchedule : []
  return {
    ...(base ? Object.fromEntries(Object.entries(base).filter(([k]) => !['weeklySchedule', 'builder', 'split'].includes(k))) : {}),
    planId: base?.planId || 'custom_' + String(today).replace(/-/g, ''),
    planName: base?.planName || 'خطتي',
    source: 'builder',
    durationWeeks: base?.durationWeeks || 8,
    startDate: base?.startDate || today,
    daysPerWeek: String(cfg.days),
    goal: cfg.goal === 'fat' ? 'fat_loss' : cfg.goal,
    split: { id: cfg.split || 'auto', cycle: plan.days.map(d => d.type) },
    weeklySchedule: plan.days.map((d, i) => {
      const old = baseDays[i]
      const keepName = old && old.name && inferDayType(old) === d.type
      return {
        name: keepName ? old.name : `${L[i].en} — ${dayMuscles(d).join('، ') || 'راحة'}`,
        exercises: d.items.map(it => {
          const e = EXI[it.id]
          const x = { ...(it.orig || {}), name: it.name || e.en, muscle: (it.orig && MUSCLES.includes(it.orig.muscle)) ? it.orig.muscle : e.key, sets: it.sets, repsMin: it.r[0], repsMax: it.r[1], restSeconds: it.rest }
          if (EQ[e.eq] && EQ[e.eq].app) x.equip = EQ[e.eq].app
          x.by = it.by
          if (PART[e.area]) x.part = PART[e.area]
          if (it.by === 'app' && it.why) x.why = it.why; else delete x.why
          if (it.unit) x.unit = it.unit; else delete x.unit
          // his own reps (stepped in the builder) beat Settings; any other range — the
          // builder's defaults, a template's, an import's — does not (progression.js)
          if (it.own) x.repsOwn = true; else delete x.repsOwn
          return x
        }),
      }
    }),
    builder: {
      version: 1, equipment: [...cfg.eq].map(q => EQ[q] && EQ[q].app).filter(Boolean),
      toolsPerMuscle: Object.fromEntries(Object.entries(cfg.mtool || {}).filter(([, v]) => v && v.size).map(([k, v]) => [CARD[k].key, [...v].map(q => EQ[q].app)])),
      picks: (cfg.picks || []).map(p => EXI[p.id] && (p.name || EXI[p.id].en)).filter(Boolean),
      filledByApp: plan.days.flatMap(d => d.items.filter(it => it.by === 'app').map(it => it.name || EXI[it.id].en)),
      neverSuggest: [...(cfg.excluded || [])].map(id => EXI[id] && EXI[id].en).filter(Boolean),
      keepAsIs: [...(cfg.dismissed || [])],
    },
  }
}

// validatePlan lives in ./validate.js (small, so the main bundle can use
// it without loading this engine); re-exported here.
export { validatePlan } from './validate.js'

export {
  AREAS, AREA_ORDER, CARDS, CARD, GROUP, EQ, EQ_ORDER, KIND, EX, EXI, SPLITS, SPW, splitFor, spwFor, spwOf, PUSH, PULL, LOW, TYPE,
  SPL, SPLIT_OPTS, splitOpts, FREE_TYPES, splitFreq, allowed, GOALS, SCHEME, targets, areaW, BUDGET, LONG, LIGHT, MAX_ITEMS,
  uid, BW, mkItem, itemMinutes, dayMinutes, sortDay, newPlan, placeDay, lightestDay, buildFromPicks, stats, matchingDays,
  cardState, coverage, cardStates, findGaps, findWarns, muchFix, SESSION_CAP, sessionLoad, findTips,
  n0, n1, setsWord, fem, hasMove, gapWords, whyText, EVIDENCE, GYM_EQ, toolOk, candidates, setsFor, fill, fillStep, evenStep,
  areaStates, unlockFor, alternatives, dayLabels, dayMuscles,
}
