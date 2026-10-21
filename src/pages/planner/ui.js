// ── The plan builder's page ──────────────────────────────────
//
// The approved round-2 prototype (plans/planner.html), as the app's own
// page: البداية، الأساسيات ونظامك، العضلات as cards, inside a muscle the
// tool chips over the list (remembered per muscle) and swipe-only adding
// with a first-time hint, «كثير» with its one-tap suggestion and تراجع,
// «وش ناقص», the build animation on «خلصت»/«كمّل خطتي»/«سوّ خطتي»,
// «خطتك بالأيام» with sets/reps/rest editing and reordering, the confirm
// sheet and «جاهزة».
//
// It is written as one imperative module over its own DOM, not as React
// components, on purpose: the motion here (the card growing into the
// muscle view, flights along arcs, the spring of a swipe, the build) is
// hand-run with the Web Animations API on live elements, exactly as in
// the prototype he approved. React (PlannerPage.jsx) owns when it is
// mounted and what goes in and out; this owns the inside.
//
// The engine is src/plan/builder.js. Sound is the app's library
// (src/sound.js), haptics src/haptics.js, reduced motion follows the
// phone (fades only), and the page holds the app's scroll lock while open.

import {
  AREAS, CARD, CARDS, EQ, EQ_ORDER, EVIDENCE, EX, EXI, FREE_TYPES, GOALS, GROUP, KIND, LONG, SCHEME, SPL, TYPE, allowed, alternatives, areaStates, buildFromPicks, cardState, cardStates, coverage, dayLabels, dayMinutes, dayMuscles, daysFromRecovery, fill, findGaps, findTips, findWarns, fitPins, fromHfPlan, gapWords, hasMove, fem, isShort, mkItem, muchFix, n0, setsShown, setsWord, sortDay, splitFreq, splitOpts, spwFor, spwFromPattern, stats, targets, toHfPlan, validatePlan, entryForName,
} from '../../plan/builder.js'
import { BODY, REGKEY } from './body.js'
import { planTitle } from '../../plan/title.js'
import { MUSCLE_GROUPS, GYM_TYPES } from '../../constants.js'
import { urlFor, remoteUrlFor } from '../../assets/registry.js'
import { play, unlock } from '../../sound.js'
import { haptic } from '../../haptics.js'
import { reducedMotion } from '../../motion.js'
import { ls } from '../../utils.js'
import { todayKey } from '../../day.js'
import { countAr } from '../../streak.js'
import { patternFor } from '../../recovery.js'
import { repTargetOf, DEFAULT_REP_TARGET } from '../../progression.js'

const MEM_KEY = 'meran_planner'

/**
 * Builds the page inside `HOST` and returns { destroy }.
 *   ctx.door        — which door opened it: settings | edit | progress | more | home | onb | view
 *   ctx.plan        — the plan in force (hf_plan) or null; ctx.planIndex
 *   ctx.day         — the day to open «خطتك» on (door 'view'), else today's
 *   ctx.planPrev    — hf_plan_prev ({ plan, planIndex, savedAt }) or null
 *   ctx.recoveryCfg, ctx.repTarget (Settings › التكرارات), ctx.profile, ctx.changeCooldownLeft, ctx.currentStreak
 *   ctx.onActivate(hf, { edit, days, breakStreak }), ctx.onRestorePrev({ breakStreak })
 *   ctx.onStart(), ctx.onClose()
 */
export function createPlanner(HOST, ctx) {
'use strict'
let RM = reducedMotion()
const mq = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)') } catch { return null } })()
const onMq = () => { RM = reducedMotion() }
const offs = []
const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)) }
if (mq) { try { mq.addEventListener('change', onMq); offs.push(() => mq.removeEventListener('change', onMq)) } catch { /* old Safari */ } }
const timers = new Set()
const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn() }, ms); timers.add(t); return t }
const $ = (s, r = HOST) => r.querySelector(s)
const $$ = (s, r = HOST) => [...r.querySelectorAll(s)]
HOST.innerHTML = `<div class="screen" id="screen" dir="rtl" lang="ar">
  <section class="scr" id="s-start" aria-label="البداية"></section>
  <section class="scr" id="s-basics" aria-label="الأساسيات" hidden></section>
  <section class="scr" id="s-deck" aria-label="اختر عضلاتك" hidden></section>
  <section class="scr" id="s-gaps" aria-label="وش ناقص" hidden></section>
  <section class="scr" id="s-plan" aria-label="خطتك" hidden></section>
  <section class="scr" id="s-done" aria-label="جاهزة" hidden></section>
  <div class="mview" id="mview" hidden></div>
</div>`
const SCREEN = $('#screen')
const FAST = { on: false }   // instant runs under the build animation
let GEN = 0                  // bumps on every reset, so a running fill stops
const quick = () => RM || FAST.on
const wait = (ms) => new Promise(r => later(r, ms))
// 12+ for a pick, lighter for arming a swipe or a landing (haptics.js).
const buzz = (ms = 8) => haptic(ms >= 10 ? 'set' : 'swipe')
const K = 1
const TODAY = todayKey()

/* What the app already knows: hf_recovery.daysPerWeek and profile.gymType. */
const RC = ctx.recoveryCfg || {}
const gymId = ctx.profile?.gymType || 'commercial'
const SETTINGS = {
  days: daysFromRecovery(RC),
  spw: spwFromPattern(patternFor(RC)),
  gym: gymId,
  gymAr: (GYM_TYPES.find(g => g.id === gymId) || GYM_TYPES[0]).label,
}

/* His reps (Settings › التكرارات, hf_rep_target). A row's range is his
   own only once he steps it here (it.own → repsOwn in hf_plan); until
   then the session runs on this, so this is what the row shows. */
const MY_REPS = repTargetOf({ ...DEFAULT_REP_TARGET, ...(ctx.repTarget || ls.get('hf_rep_target', {}) || {}) })
const effR = (it) => (it.own || it.mins || it.unit === 'sec' || it.unit === 'min') ? it.r : [MY_REPS.base, MY_REPS.top]

/* Per-phone conveniences: the tools picked per muscle and the swipe
   hint seen (meran_planner, a key of the new design's own). */
const MEM = Object.assign({ mtool: {}, swiped: false }, ls.get(MEM_KEY, {}) || {})
const saveMem = () => ls.set(MEM_KEY, { mtool: MEM.mtool, swiped: MEM.swiped })
const MT = Object.fromEntries(Object.entries(MEM.mtool || {}).map(([k, v]) => [k, new Set(v)]))
const saveMT = () => { MEM.mtool = Object.fromEntries(Object.entries(MT).filter(([, v]) => v.size).map(([k, v]) => [k, [...v]])); saveMem() }

/* ── pictures: the pack's still for an exercise, the muscle art otherwise ── */
const FALLBACK = new Map()
const mImg = (cardId) => (MUSCLE_GROUPS[CARD[cardId]?.key] || MUSCLE_GROUPS.Chest).img
function exImg(id) {
  const e = EXI[id]
  const fb = mImg(e ? e.card : 'chest')
  if (!e || e.foreign) return fb
  const slot = 'ex_' + id
  const url = urlFor(slot) || remoteUrlFor(slot)
  if (!url) return fb
  FALLBACK.set(url, fb)
  return url
}
const IMG = new Proxy({}, { get: (_, k) => String(k).startsWith('ex_') ? exImg(String(k).slice(3)) : mImg(String(k).slice(2)) })
on(HOST, 'error', (e) => {
  const img = e.target
  if (!img || img.tagName !== 'IMG' || img.dataset.fb) return
  const fb = FALLBACK.get(img.getAttribute('src'))
  if (fb) { img.dataset.fb = '1'; img.src = fb }
}, true)

/* ── sound: the app's library (Kenney, CC0) ── */
const SND = { tick: 'set-done', pr: 'pr', medal: 'medal' }
function audioInit() { try { unlock() } catch { /* quiet */ } }
function snd(k, { gain = 0.5, rate = 1 } = {}) { try { play(SND[k] || k, { gain, rate }) } catch { /* quiet */ } }

/* ── icons ── */
const P = {
  back: '<path d="M9 5l7 7-7 7"/>',
  chev: '<path d="M15 5l-7 7 7 7"/>',
  fwd: '<path d="M19 12H5M11 5l-7 7 7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  swap: '<path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  grip: '<circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.1"/>',
  loop: '<path d="M4 12a8 8 0 0 1 14-5.3M20 4v4.5h-4.5M20 12a8 8 0 0 1-14 5.3M4 20v-4.5h4.5"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  hand: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11.5v-2a1.5 1.5 0 0 1 3 0v2.5M14 12v-1a1.5 1.5 0 0 1 3 0v3.5c0 3.6-2.4 6.5-6 6.5-2.4 0-3.7-1.2-4.9-3.1L4.4 16a1.4 1.4 0 0 1 2.3-1.6L8 16"/>',
  machine: '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M6 8h12M6 12h12M6 16h12M13 12h3"/>',
  cable: '<circle cx="12" cy="5" r="2.5"/><path d="M12 7.5V17M8 17h8M8 17v3M16 17v3"/>',
  dumbbell: '<path d="M3 9.5v5M6 7v10M18 7v10M21 9.5v5M6 12h12"/>',
  barbell: '<path d="M2 12h20M5 8v8M8 6v12M16 6v12M19 8v8"/>',
  cardio: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  body: '<circle cx="12" cy="4.5" r="2"/><path d="M5 9h14M12 9v6M12 15l-3.5 6M12 15l3.5 6"/>',
}
const ic = (n, s = 20) => n === 'spark'
  ? `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.5l2.1 7.4 7.4 2.1-7.4 2.1L12 21.5l-2.1-7.4L2.5 12l7.4-2.1z"/></svg>`
  : n === 'grip'
    ? `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${P.grip}</svg>`
    : `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`
const inl = (svg) => svg.replace('class="ic"', 'class="ic" style="display:inline;vertical-align:-2px"')


/* ── state ── */
const ALL_EQ = ['machine', 'cable', 'dumbbell', 'barbell', 'cardio', 'body']
const GYM_TOOLS = { commercial: ALL_EQ, home: ['dumbbell', 'body'], outdoor: ['body'], crossfit: ['barbell', 'dumbbell', 'cardio', 'body'] }
const fresh = () => ({
  mode: 'build', days: SETTINGS.days, split: null, cycle: null, goal: 'muscle', eq: new Set(GYM_TOOLS[SETTINGS.gym] || ALL_EQ), picks: [], excluded: new Set(), dismissed: new Set(),
  plan: null, filled: false, card: null, hinted: false, day: 0, busy: false, open: null, toolsOpen: false, entry: ctx.door || 'settings',
})
const S = Object.assign(fresh(), { cur: 'start' })
/* The plan saved before the last change (hf_plan_prev): «رجّع خطتك القديمة». */
let PREV = ctx.planPrev && ctx.planPrev.plan ? { name: planTitle(ctx.planPrev.plan.planName) || 'خطتك القديمة', when: ctx.planPrev.savedAt === TODAY ? 'اليوم' : ctx.planPrev.savedAt, undo: !!ctx.planPrev.undo } : null
/* His plan in force, read as the builder's picks («عدّل خطتك الحالية»). */
const CURRENT = ctx.plan && Array.isArray(ctx.plan.weeklySchedule) && ctx.plan.weeklySchedule.length
  ? { name: planTitle(ctx.plan.planName) || 'خطتك', hf: ctx.plan, ...fromHfPlan(ctx.plan, { days: SETTINGS.days }) }
  : null
const splitId = () => S.split || splitOpts(S.days)[0]
const cycleOf = () => splitId() === 'free' ? (S.cycle || SPL[splitOpts(S.days)[0]].cycle).slice() : SPL[splitId()].cycle.slice()
// Sessions a week: his exact rest pattern while the days are his; the
// days' own number once he picks other days here.
const cfg = () => ({ days: S.days, spw: S.days === SETTINGS.days ? SETTINGS.spw : null, goal: S.goal, eq: S.eq, excluded: S.excluded, picks: S.picks, cycle: cycleOf(), split: splitId(), mtool: MT, aim: S.mode === 'auto' ? 'good' : null, dismissed: S.dismissed, keepOrder: S.mode === 'current' })
const PRESETS = [
  { id: 'gym', ar: 'جيم كامل', eq: ALL_EQ },
  { id: 'db', ar: 'دمبل بس', eq: ['dumbbell', 'body'] },
  { id: 'home', ar: 'بيت بدون أدوات', eq: ['body'] },
]
const PREF = ['dumbbell', 'machine', 'cable', 'barbell', 'cardio']



/* ── words ── */
const exWord = (n) => n === 0 ? 'ولا تمرين' : n === 1 ? 'تمرين واحد' : n === 2 ? 'تمرينين' : n <= 10 ? n + ' تمارين' : n + ' تمرين'
const rng = (it) => { const r = effR(it); return r[0] === r[1] ? `${r[0]}` : `${r[0]}–${r[1]}` }
const repsWord = (it) => it.mins ? 'جلسة 20 دقيقة' : `<span class="ltr">${rng(it)}</span> ${it.unit === 'sec' ? 'ثانية' : 'عدّة'}`
const setsLbl = (it) => it.mins ? '20 د' : `${it.sets} × ${rng(it)}${it.unit === 'sec' ? 'ث' : ''}`
const setsCap = (it) => it.mins ? 'جلسة كارديو' : it.unit === 'sec' ? 'مجموعات × ثواني' : 'مجموعات × عدّات'
const restLbl = (s) => s < 120 ? `${s} ث` : `${(s / 60) % 1 ? Math.floor(s / 60) + '½' : s / 60} د`
const eqList = () => ALL_EQ.filter(q => S.eq.has(q)).map(q => EQ[q].ar).join('، ')
const cardPicks = (cid) => S.picks.filter(p => EXI[p.id].card === cid)
const dayName = (L) => `${L.ar}${L.v ? ' ' + L.v : ''}`
const f1 = (x) => String(Math.round(x * 10) / 10)
const andJoin = (xs) => xs.length ? xs[0] + xs.slice(1).map(x => ' و' + x).join('') : ''
const lblOf = (a) => a === 'back' ? 'الظهر' : AREAS[a].lbl
const DAY_WHAT = {
  push: 'صدر، أكتاف، ذراع خلفي', pull: 'ظهر، ذراع أمامي، ورا الكتف', legs: 'فخذين، أرداف، سمانة', lower: 'فخذين، أرداف، سمانة',
  upper: 'صدر، ظهر، أكتاف، ذراعين', full: 'كل العضلات', chestback: 'صدر وظهر', chestd: 'صدر', backd: 'ظهر', shoulders: 'أكتاف', arms: 'ذراع أمامي وخلفي',
}


/* ── geometry + motion helpers ── */
function lr(el) {
  const s = SCREEN.getBoundingClientRect(), r = el.getBoundingClientRect()
  return { x: (r.left - s.left) / K, y: (r.top - s.top) / K, w: r.width / K, h: r.height / K }
}
function visible(el, pad = 0) { const r = lr(el); return r.y + r.h > pad && r.y < SCREEN.clientHeight - pad }
function fly(fromEl, toEl, src, { dur = 620, arc = -70, radius = 14, from, onLand, rot = -7 } = {}) {
  if (quick() || (!fromEl && !from) || !toEl) { onLand && onLand(); return Promise.resolve() }
  const a = from || lr(fromEl), b = lr(toEl)
  const g = document.createElement('div')
  g.className = 'ghost'
  g.style.cssText = `left:${a.x}px;top:${a.y}px;width:${a.w}px;height:${a.h}px;border-radius:${radius}px`
  g.innerHTML = `<img src="${src}" alt="">`
  SCREEN.appendChild(g)
  const k = Math.min(b.w / a.w, b.h / a.h)
  const dx = b.x + b.w / 2 - a.w * k / 2 - a.x, dy = b.y + b.h / 2 - a.h * k / 2 - a.y
  const mk = (1 + k) / 2 * 1.08
  const an = g.animate([
    { transform: 'translate(0,0) scale(1) rotate(0)' },
    { transform: `translate(${dx * 0.42}px, ${dy * 0.42 + arc}px) scale(${mk}) rotate(${rot}deg)`, offset: 0.45 },
    { transform: `translate(${dx}px, ${dy}px) scale(${k}) rotate(0)` },
  ], { duration: dur, easing: 'cubic-bezier(.45,0,.2,1)' })
  return an.finished.then(() => { g.remove(); onLand && onLand() }, () => { g.remove(); onLand && onLand() })
}
function flipFrom(el, from, dur = 560) {
  if (RM || !el) return
  const to = lr(el); if (!to.w) return
  const k = from.w / to.w
  const dx = (from.x + from.w / 2) - (to.x + to.w / 2), dy = (from.y + from.h / 2) - (to.y + to.h / 2)
  el.animate([{ transform: `translate(${dx}px,${dy}px) scale(${k})` }, { transform: 'none' }], { duration: dur, easing: 'cubic-bezier(.32,.72,0,1)' })
}
function springTo(apply, x0, v0 = 0, { k = 420, c = 24 } = {}) {
  if (RM) { apply(0); return Promise.resolve() }
  return new Promise(res => {
    let x = x0, v = v0, last = performance.now()
    function step(t) {
      const dt = Math.min(0.032, (t - last) / 1000); last = t
      const a = -k * x - c * v; v += a * dt; x += v * dt
      if (Math.abs(x) < 0.3 && Math.abs(v) < 8) { apply(0); res(); return }
      apply(x); requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}
function tween(el, to, dur = 600) {
  if (!el) return
  const from = parseFloat(el.textContent) || 0
  if (quick() || from === to) { el.textContent = to; return }
  const t0 = performance.now()
  const f = (t) => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(from + (to - from) * e); if (p < 1) requestAnimationFrame(f) }
  requestAnimationFrame(f)
}
const LAND = 'linear(0, 0.28, 0.775, 1.127, 1.234, 1.169, 1.053, 0.971, 0.945, 0.96, 0.988, 1.007, 1.013, 1.006, 1)'
const land = (el, delay = 0) => { if (!RM && el) el.animate([{ transform: 'scale(.9)', opacity: .4 }, { transform: 'none', opacity: 1 }], { duration: 520, delay, easing: LAND, fill: 'backwards' }) }
/* a digit that rolls into place, like the app's RollNumber */
const rollHTML = (n, id = '') => `<span class="roll num"${id ? ` id="${id}"` : ''} style="--v:${n}"><span class="roll-c">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<i>${d}</i>`).join('')}</span><span class="roll-sr">${n}</span></span>`
function setRoll(el, n) { if (!el) return; el.style.setProperty('--v', n); const s = el.querySelector('.roll-sr'); if (s) s.textContent = n }

/* toasts sit above the dock, carry an optional «تراجع», and leave when a sheet opens */
function clearToasts() { $$('.toast', SCREEN).forEach(t => { clearTimeout(t._t); t.remove() }) }
function toast(msg, act) {
  clearToasts()
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status')
  const sp = document.createElement('span'); sp.textContent = msg; t.appendChild(sp)
  const hide = () => {
    if (!t.isConnected) return
    if (RM) return t.remove()
    t.animate([{ opacity: 1 }, { opacity: 0, transform: 'translate(-50%,8px)' }], { duration: 220, fill: 'forwards' }).onfinish = () => t.remove()
  }
  if (act) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = act.label
    b.addEventListener('click', (e) => { e.stopPropagation(); clearTimeout(t._t); t.remove(); act.run() })
    t.appendChild(b)
  }
  SCREEN.appendChild(t)
  if (!RM) t.animate([{ opacity: 0, transform: 'translate(-50%,14px) scale(.96)' }, { opacity: 1, transform: 'translate(-50%,0)' }], { duration: 340, easing: 'cubic-bezier(.2,0,0,1)' })
  t._t = later(hide, act ? 4500 : 2400)
}
function ringSVG(segs, size = 46, sw = 4) {
  const r = (size - sw) / 2 - 0.5, c = size / 2, C = 2 * Math.PI * r, n = Math.max(1, segs.length), gap = n > 1 ? 5 : 0, L = (C - n * gap) / n
  let s = `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><g transform="rotate(-90 ${c} ${c})">`
  ;(segs.length ? segs : [{ a: 'x', f: 0 }]).forEach((sg, i) => {
    const off = -(i * (L + gap)) - gap / 2
    s += `<circle class="rt" cx="${c}" cy="${c}" r="${r}" stroke-width="${sw}" stroke-dasharray="${L} ${C - L}" stroke-dashoffset="${off}"/>`
    s += `<circle class="rf" data-a="${sg.a}" data-l="${L}" data-c="${C}" cx="${c}" cy="${c}" r="${r}" stroke-width="${sw}" style="stroke-dasharray:0 ${C}" stroke-dashoffset="${off}"/>`
  })
  return s + '</g></svg>'
}
function setRing(svg, segs) {
  if (!svg) return
  segs.forEach(sg => {
    const el = svg.querySelector(`.rf[data-a="${sg.a}"]`); if (!el) return
    const L = +el.dataset.l, C = +el.dataset.c, len = L * Math.min(1, sg.f)
    el.style.strokeDasharray = `${len} ${C - len}`
    el.classList.toggle('part', sg.f < 1)
  })
}

/* ── the lit body (front + back) ──
   Paths: react-native-body-highlighter 3.2.0 (MIT). Each region maps to
   one of the deck's areas; the back counts as one muscle. Lights green,
   like the muscle pictures (Hamza: «أخضر، زي صور العضلات»). */
const REG = []
function buildBody() {
  let defs = '', n = 0
  for (const side of ['front', 'back']) {
    const sd = BODY[side]; if (!sd) continue
    defs += `<path id="pbo-${side}" d="${sd.outline}"/>`
    for (const slug of Object.keys(sd)) {
      if (slug === 'outline') continue
      for (const half of ['left', 'right', 'common']) (sd[slug][half] || []).forEach(d => {
        const id = 'pbp' + (n++)
        defs += `<path id="${id}" d="${d}"/>`
        const m = /M\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/.exec(d)
        REG.push({ id, side, key: REGKEY[side][slug] || null, hair: slug === 'hair', y: m ? +m[2] : 0 })
      })
    }
  }
  const box = document.createElement('div'); box.setAttribute('aria-hidden', 'true')
  box.innerHTML = `<svg width="0" height="0" style="position:absolute" focusable="false"><defs><linearGradient id="pbLit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--art-hi)"/><stop offset=".55" style="stop-color:var(--art)"/><stop offset="1" style="stop-color:var(--art-lo)"/></linearGradient>${defs}</defs></svg>`
  HOST.appendChild(box)
}
function bodySVG() {
  let html = ''
  for (const side of ['front', 'back']) {
    let base = '', lit = ''
    for (const r of REG) {
      if (r.side !== side) continue
      base += `<use href="#${r.id}" class="${r.hair ? 'b-hair' : 'b-base'}"/>`
      if (r.key) lit += `<use href="#${r.id}" class="b-lit" data-k="${r.key}" style="--d:${Math.round(Math.max(0, (r.y - 140) / 1200) * 220)}ms"/>`
    }
    html += `<g transform="translate(${side === 'front' ? 724 : -724} 0)"><use href="#pbo-${side}" class="b-out"/>${base}${lit}</g>`
  }
  return `<svg class="bodymap" viewBox="0 86 1448 1284" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">${html}</svg>`
}
function paintBody(svg, st, pop) {
  if (!svg) return
  for (const el of svg.querySelectorAll('.b-lit')) {
    const s = st[el.dataset.k] || 'none'
    if (el.dataset.s === s) continue
    const was = el.dataset.s; el.dataset.s = s
    if (pop && !quick() && s === 'ok' && was && was !== 'ok') { el.classList.remove('pop'); void el.getBoundingClientRect(); el.classList.add('pop') }
  }
}
function dayStates(d) {
  const out = {}
  for (const it of d.items) for (const [a, c] of Object.entries(EXI[it.id].cr)) {
    const k = a === 'lats' || a === 'rows' ? 'back' : a
    if (out[k] !== 'ok') out[k] = c >= 1 ? 'ok' : 'some'
  }
  return out
}

/* ── navigation ── */
const ENTER = {}
function go(to, { back = false, render = true, instant = false } = {}) {
  clearToasts()
  const from = S.cur
  const a = $('#s-' + from), b = $('#s-' + to)
  if (to === from) {
    if (render && ENTER[to]) ENTER[to]()
    if (!RM && !instant) b.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 280 })
    updateRail(); return
  }
  if (render && ENTER[to]) ENTER[to]()
  b.hidden = false
  S.cur = to
  updateRail()
  a.getAnimations().forEach(x => x.cancel()); b.getAnimations().forEach(x => x.cancel())
  if (RM || instant) { a.hidden = true; a.style.zIndex = ''; b.style.zIndex = ''; if (RM && !instant) b.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 }); return }
  const ease = 'cubic-bezier(.32,.72,0,1)'
  b.style.zIndex = back ? 1 : 2; a.style.zIndex = back ? 2 : 1
  if (!back) {
    b.animate([{ transform: 'translateX(-100%)' }, { transform: 'none' }], { duration: 460, easing: ease })
    a.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateX(28%)', opacity: 0.3 }], { duration: 460, easing: ease }).onfinish = () => { if (S.cur !== from) a.hidden = true; a.style.zIndex = '' }
  } else {
    b.animate([{ transform: 'translateX(28%)', opacity: 0.3 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: ease })
    a.animate([{ transform: 'none' }, { transform: 'translateX(-100%)' }], { duration: 420, easing: ease }).onfinish = () => { if (S.cur !== from) a.hidden = true; a.style.zIndex = '' }
  }
}
function goBack() {
  const map = { start: null, basics: 'start', deck: S.mode === 'current' ? 'start' : 'basics', gaps: S.mode === 'auto' ? 'basics' : 'deck', plan: 'gaps', done: 'plan' }
  const to = map[S.cur]; if (!to) return close()
  GEN++; S.busy = false
  // a screen never shown yet (opened straight on «خطتك») is drawn first
  go(to, { back: true, render: to === 'deck' || to === 'basics' || !$('#s-' + to).innerHTML })
}
const topbar = (n, extra = '') => `<div class="topbar"><button class="icon-btn" data-act="back" aria-label="رجوع">${ic('back')}</button>${extra}<div class="steps" aria-label="الخطوة ${n} من 4">${[1, 2, 3, 4].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div></div>`


/* ══ 1 · start ══ */
const CRUMB = { settings: 'الإعدادات · الخطة', edit: 'الإعدادات · الخطة', home: 'الرئيسية', onb: 'أول مرة · خطتك', progress: 'الرئيسية · خطتي', more: 'الرئيسية · خيارات اليوم', view: 'خطتي' }
ENTER.start = function () {
  $('#s-start').innerHTML = `
  <div class="scroll">
    <div class="topbar"><button class="icon-btn" data-act="close" aria-label="إغلاق">${ic('x', 18)}</button><span class="crumb">${CRUMB[S.entry] || CRUMB.settings}</span></div>
    <div class="fan" aria-hidden="true">${['chest', 'back', 'legs'].map((c, i) => `<div class="fc fc${i}"><img src="${IMG['m_' + c]}" alt=""><b>${CARD[c].ar}</b></div>`).join('')}</div>
    <h1 class="hero">ابنِ خطتك<br>على كيفك</h1>
    <p class="lead">أي نظام تبيه، بالأدوات اللي عندك. التطبيق يقولك وش ناقص، ويكمّله لو تبي.</p>
    <div class="doors">
      <button class="door door-main" data-act="start-build"><span class="door-t">ابنِ خطتك</span><span class="door-s">أنت تختار، واحنا نقولك وش ناقص</span><span class="door-go">${ic('fwd', 24)}</span></button>
      <button class="door" data-act="start-auto"><span class="door-t">خلّ التطبيق يختار كل شي</span><span class="door-s">قل لنا أيامك وأدواتك بس</span><span class="door-go">${ic('spark', 22)}</span></button>
    </div>
    ${!CURRENT ? '' : `<button class="row-link" data-act="start-current"><span class="rl-thumb"><img src="${IMG.m_chest}" alt=""></span><span class="rl-t">عدّل خطتك الحالية<small><bdi>${esc(CURRENT.name)}</bdi> · ${exWord(CURRENT.picks.length)}</small></span>${ic('chev', 18)}</button>`}
    ${PREV ? `<button class="row-link" data-act="restore-prev"><span class="rl-thumb">${ic('undo', 20)}</span><span class="rl-t">رجّع خطتك القديمة<small><bdi>${esc(PREV.name)}</bdi> · محفوظة ${PREV.when === 'اليوم' ? 'اليوم' : 'من <bdi class="num">' + PREV.when + '</bdi>'}</small></span>${ic('chev', 18)}</button>` : ''}
  </div>`
}

/* ══ 2 · basics: days, system, tools, goal ══ */
function tileHTML(q) {
  const on = S.eq.has(q), n = EX.filter(e => e.eq === q).length, lock = q === 'body'
  return `<button class="tile ${on ? 'on' : ''} ${lock ? 'locked' : ''}" data-act="eq" data-v="${q}" aria-pressed="${on}"${lock ? ' aria-disabled="true"' : ''}>
    <span class="t-ic">${ic(q, 24)}</span><b>${EQ[q].ar}</b><small>${lock ? 'دايم معك' : n + ' تمارين'}</small><span class="t-ck">${ic(lock ? 'lock' : 'check', 13)}</span></button>`
}
const daysFrom = () => S.days === SETTINGS.days
  ? `من إعداداتك: ${SETTINGS.days} أيام بالأسبوع.`
  : `بالإعدادات ${SETTINGS.days} أيام. لما تفعّل الخطة، أيام الراحة تتغيّر معها وتنحسب تغيير واحد.`
const splitFq = (id) => SPL[id].cycle ? splitFreq(SPL[id].cycle, S.days) : 0
function splitLine(id) {
  const n = S.days, fq = f1(splitFq(id))
  switch (id) {
    case 'full2': return 'يومين جسم كامل بالتناوب. كل جلسة فيها شي لكل عضلة'
    case 'ppl': return n === 4 ? `الدور 3 أيام، فاليوم الرابع يرجع للدفع. كل عضلة تقريباً ${fq} مرة بالأسبوع` : `كل عضلة تقريباً ${fq} مرة بالأسبوع`
    case 'ul': return `علوي ثم سفلي بالدور. كل عضلة تقريباً ${fq} مرة بالأسبوع`
    case 'pplul': return 'دفع وسحب ورجل، ثم علوي وسفلي. كل عضلة مرتين بالأسبوع'
    case 'ppl2': return `كل عضلة تقريباً ${fq} مرة بالأسبوع`
    case 'bro': return 'صدر، ظهر، رجل، أكتاف، ذراعين. كل عضلة مرة بالأسبوع'
    case 'free': return 'تختار كم يوم بالدور، وكل يوم وش فيه'
  }
  return ''
}
function splitNote(id) {
  if (id === 'free') return 'أي ترتيب يمشي. لو عضلة ما لها يوم، نقولك ونقترح.'
  if (id === 'bro') return 'يمشي. بس العضلة كلها بجلسة وحدة، وبعد 10 مجموعات تقريباً الفايدة تقل، فبننبّهك لو صارت أكثر.'
  if (splitFq(id) < 1.3) return 'مرة بالأسبوع تمشي، المهم مجموعاتها بالأسبوع. والتطبيق يكمّلها لك.'
  if (id === 'full2' && S.days >= 4) return 'كل جلسة جسم كامل، فالجلسة أطول شوي.'
  return ''
}
const cycleChips = (cyc) => `<span class="sp-cyc" aria-hidden="true">${cyc.map(t => `<i>${TYPE[t].ar}</i>`).join('')}<em>${ic('loop', 13)}</em></span>`
function splitsHTML() {
  const cur = splitId(), opts = splitOpts(S.days)
  return opts.map((id, i) => {
    const on = id === cur, sp = SPL[id]
    // the system his plan really uses (fromHfPlan reads it off his days)
    const now = S.mode === 'current' && !!CURRENT && id === CURRENT.split
    const note = on ? splitNote(id) : ''
    return `<button class="split ${on ? 'on' : ''}" role="radio" aria-checked="${on}" data-act="split" data-v="${id}">
      <span class="sp-top"><span class="sp-dot" aria-hidden="true"></span><b>${sp.ar}</b>${i === 0 ? '<span class="rec">المقترح</span>' : ''}${now ? '<span class="rec">خطتك الحين</span>' : ''}</span>
      <span class="sp-line">${splitLine(id)}</span>
      ${on && sp.cycle ? cycleChips(sp.cycle) : ''}
      ${note ? `<span class="sp-note">${ic('info', 14)}<span>${note}</span></span>` : ''}</button>`
  }).join('')
}
function freeHTML() {
  if (splitId() !== 'free') return ''
  const cyc = cycleOf(), n = cyc.length, per = spwFor(S.days) / n
  return `<div class="free">
    <div class="free-h"><b>أيامك بالدور</b><div class="mini-step"><button data-act="free-n" data-v="-1" aria-label="يوم أقل" ${n <= 1 ? 'disabled' : ''}>${ic('minus', 16)}</button><span class="num">${n}</span><button data-act="free-n" data-v="1" aria-label="يوم زيادة" ${n >= 7 ? 'disabled' : ''}>${ic('plus', 16)}</button></div></div>
    <ol class="free-days">${cyc.map((t, i) => `<li><span class="fd-n num">${i + 1}</span><button class="fd-t" data-act="free-day" data-v="${i}" aria-label="اليوم ${i + 1}: ${TYPE[t].ar}، غيّره"><span><b>${TYPE[t].ar}</b><small>${DAY_WHAT[t]}</small></span><span class="fd-ch">غيّر</span></button></li>`).join('')}</ol>
    <p class="q-from">${n === 1 ? 'يوم واحد' : n === 2 ? 'يومين' : n + ' أيام'} بالدور على ${S.days} أيام بالأسبوع: كل يوم يرجع تقريباً ${f1(per)} مرة بالأسبوع.</p></div>`
}
function renderSplits(anim) {
  const box = $('#splits'); if (!box) return
  box.innerHTML = splitsHTML(); $('#free-ed').innerHTML = freeHTML()
  if (anim && !RM) { const on = $('.split.on', box); on && on.animate([{ transform: 'scale(.97)' }, { transform: 'none' }], { duration: 420, easing: LAND }) }
}
ENTER.basics = function () {
  const auto = S.mode === 'auto'
  $('#s-basics').innerHTML = `
  <div class="scroll" id="basics-scroll">
    ${topbar(1)}
    <h2 class="title">قبل نبدأ</h2>
    <p class="sub">أربع أسئلة سريعة، وجاوبنا عنك من إعداداتك${auto ? '. بعدها نسوي لك الخطة كاملة' : ''}.</p>
    <section class="q"><h3 class="q-h">كم يوم تتمرن بالأسبوع؟</h3>
      <div class="seg" role="radiogroup" aria-label="أيام التمرين">${[3, 4, 5, 6].map(d => `<button role="radio" aria-checked="${S.days === d}" data-act="days" data-v="${d}"><b>${d}</b><small>أيام</small></button>`).join('')}</div>
      <p class="q-from" id="days-from">${daysFrom()}</p></section>
    <section class="q"><h3 class="q-h">نظامك<small>أي نظام يمشي، والمقترح أول</small></h3>
      <div class="splits" id="splits" role="radiogroup" aria-label="نظامك">${splitsHTML()}</div>
      <div id="free-ed">${freeHTML()}</div></section>
    <section class="q"><h3 class="q-h">وش عندك من أدوات؟<small>من إعداداتك: ${SETTINGS.gymAr}</small></h3>
      <div class="pills presets">${PRESETS.map(p => `<button class="pill" data-act="preset" data-v="${p.id}">${p.ar}</button>`).join('')}<button class="pill more" data-act="tools-more" aria-expanded="${S.toolsOpen}">أخصّصها ${ic(S.toolsOpen ? 'minus' : 'plus', 14)}</button></div>
      <div class="tiles" id="tiles" ${S.toolsOpen ? '' : 'hidden'}>${ALL_EQ.map(tileHTML).join('')}</div>
      <p class="q-from" id="eq-line">${eqList()}</p></section>
    <section class="q"><h3 class="q-h">وش هدفك؟</h3>
      <div class="goals" role="radiogroup" aria-label="الهدف">${Object.entries(GOALS).map(([id, g]) => `<button role="radio" aria-checked="${S.goal === id}" data-act="goal" data-v="${id}"><b>${g.ar}</b><small>${g.sub}</small></button>`).join('')}</div></section>
  </div>
  <div class="dock"><button class="btn-primary" data-act="basics-next">${auto ? `${ic('spark', 18)} سوّ خطتي` : 'يلا نختار العضلات'}</button></div>`
  markPreset()
}
function markPreset() {
  $$('#s-basics [data-act="preset"]').forEach(b => {
    const p = PRESETS.find(x => x.id === b.dataset.v)
    b.classList.toggle('on', p.eq.length === S.eq.size && p.eq.every(q => S.eq.has(q)))
  })
  const l = $('#eq-line'); if (l) l.textContent = eqList()
}
function setEq(list) {
  S.eq = new Set(list)
  $$('#s-basics .tile').forEach((t, i) => {
    const q = t.dataset.v, on = S.eq.has(q)
    if (t.classList.contains('on') !== on) later(() => { t.classList.toggle('on', on); t.setAttribute('aria-pressed', on) }, RM ? 0 : i * 45)
  })
  markPreset()
}
/* a system change re-places the picks; «عدّل خطتك» keeps an exercise on
   its own day only when the new system's day there still takes it */
function setSplit(id) {
  const was = splitId()
  if (id === was) return
  if (id === 'free' && !S.cycle) S.cycle = (SPL[was] && SPL[was].cycle ? SPL[was].cycle : SPL[splitOpts(S.days)[0]].cycle).slice()
  S.split = id
  keepFittingPins()
}
function keepFittingPins() {
  if (S.mode === 'current') fitPins(S.picks, cycleOf())
  else S.picks.forEach(p => { delete p.day })
}
function freeTypeSheet(i) {
  const cur = cycleOf()[i]
  openSheet(`<div class="grab"></div><div class="eyebrow">نظامك الحر</div><h3 class="sh-title">اليوم ${i + 1}: وش فيه؟</h3>
    <div class="alts">${FREE_TYPES.map(t => `<button class="alt type ${t === cur ? 'added-now' : ''}" data-act="free-type" data-i="${i}" data-v="${t}" aria-pressed="${t === cur}"><span><b>${TYPE[t].ar}</b><small>${DAY_WHAT[t]}</small></span>${t === cur ? ic('check', 18) : '<span></span>'}</button>`).join('')}</div>
    <div class="sh-acts"><button class="btn-quiet" data-act="close-sheet" style="width:100%">ارجع</button></div>`)
}

/* ══ 3 · deck ══ */
function cardHTML(c) {
  return `<button class="mcard" data-act="open-card" data-card="${c.id}">
    <span class="mc-art"><img src="${IMG[c.img]}" alt=""></span>
    <span class="mc-ring">${ringSVG(c.areas.map(a => ({ a, f: 0 })))}<span class="mc-ck">${ic('check', 20)}</span></span>
    <span class="mc-stack"></span>
    <span class="mc-txt"><b class="mc-name">${c.ar}</b><span class="mc-status"></span></span></button>`
}
const splitShort = () => splitId() === 'free' ? `حر، ${cycleOf().length === 2 ? 'يومين' : cycleOf().length + ' أيام'} بالدور` : SPL[splitId()].ar
const basicsSummary = () => `${S.days} أيام · ${splitShort()} · ${GOALS[S.goal].ar}`
ENTER.deck = function () {
  $('#s-deck').innerHTML = `
  <div class="scroll" id="deck-scroll">
    ${topbar(2)}
    <h2 class="title">اختر عضلاتك</h2>
    <button class="basics-line" data-act="to-basics"><span>${basicsSummary()}</span><b>غيّر</b></button>
    <div class="cov"><div class="cov-n"><b id="cov-n">0</b><span id="cov-of">من 7</span></div><div class="cov-l">عضلات مغطاة<br><small id="cov-sub"></small></div><div class="cov-bar" id="cov-bar"></div></div>
    <div class="deck-key"><span><i></i>الحلقة: هل أخذت كفايتها بالأسبوع</span><span><em></em>الصور: تمارينك فيها</span></div>
    <div class="deck">${CARDS.map(cardHTML).join('')}</div>
  </div>
  <div class="dock"><button class="btn-primary" data-act="deck-done">خلصت</button></div>`
  updateDeck(true)
}
function cardStatus(c, cs, n) {
  if (cs.opt) return n ? `${exWord(n)} · اختياري` : 'اختياري'
  if (!n && cs.segs.every(s => s.cur < 0.5)) return 'فاضية'
  if (cs.ok) return `${ic('check', 13)} مغطاة${n ? '' : ' من تمارين ثانية'}`
  if (cs.segs.length === 1) { const s = cs.segs[0]; return `${setsShown(s.cur, s.min)} من ${s.min} مجموعات بالأسبوع` }
  const miss = cs.segs.filter(s => isShort(s.cur, s.min)).map(s => AREAS[s.a].row)
  if (miss.length === 1) return `ناقص ${miss[0]}`
  if (miss.length === 2) return `ناقص ${miss[0]} و${miss[1]}`
  return `ناقص ${miss.length} أجزاء`
}
function updateDeck(first) {
  const root = $('#s-deck'); if (!root.innerHTML) return
  const plan = buildFromPicks(cfg()), cov = coverage(plan, S.goal)
  const nEl = $('#cov-n', root); if (first) nEl.textContent = cov.n; else tween(nEl, cov.n)
  $('#cov-of', root).textContent = 'من ' + cov.of
  $('#cov-sub', root).textContent = S.picks.length ? `${exWord(S.picks.length)} اخترتها` : 'ما اخترت ولا تمرين للحين'
  const bar = $('#cov-bar', root), cards = CARDS.filter(c => !cardState(c, cov.st, cov.T).opt)
  if (bar.children.length !== cards.length) { bar.style.gridTemplateColumns = `repeat(${cards.length},1fr)`; bar.innerHTML = cards.map(() => '<i></i>').join('') }
  cards.forEach((c, i) => {
    const cs = cardState(c, cov.st, cov.T), f = cs.segs.reduce((s, x) => s + Math.min(1, x.f), 0) / cs.segs.length
    const el = bar.children[i]; el.style.setProperty('--f', f.toFixed(3)); el.classList.toggle('part', !cs.ok)
  })
  for (const c of CARDS) {
    const el = $(`.mcard[data-card="${c.id}"]`, root), cs = cardState(c, cov.st, cov.T), picks = cardPicks(c.id)
    el.classList.toggle('lit', picks.length > 0 || cs.segs.some(s => s.cur >= 0.5))
    el.classList.toggle('ok', !cs.opt && cs.ok)
    setRing($('svg', el), cs.segs)
    $('.mc-status', el).innerHTML = cardStatus(c, cs, picks.length)
    el.setAttribute('aria-label', `${c.ar}: ${exWord(picks.length)}، ${$('.mc-status', el).textContent}`)
    const stack = $('.mc-stack', el), ids = picks.slice().reverse().map(p => p.id), shown = ids.slice(0, 3)
    const key = ids.join(',')
    if (stack.dataset.k !== key) {
      const prev = (stack.dataset.k || '').split(',')
      stack.innerHTML = shown.map(id => `<span class="st ${first || prev.includes(id) ? '' : 'new'}"><img src="${IMG['ex_' + id]}" alt=""></span>`).join('') + (ids.length > 3 ? `<span class="st more">+${ids.length - 3}</span>` : '')
      stack.dataset.k = key
      if (!first && ids.length > prev.filter(Boolean).length) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump') }
    }
  }
}

/* ── muscle view: picture, sets meter, tool chips on top, then the list. One screen. ── */
function xcardHTML(e, { locked = false, on = null } = {}) {
  if (on === null) on = S.picks.some(p => p.id === e.id)
  return `<div class="xcard ${on ? 'on' : ''} ${locked ? 'locked' : ''}" data-id="${e.id}">
    ${locked ? '' : `<div class="xc-reveal" aria-hidden="true"><span class="rv">${ic(on ? 'x' : 'plus', 18)} ${on ? 'شيل' : 'أضف'}</span><span class="rv">${on ? 'شيل' : 'أضف'} ${ic(on ? 'x' : 'plus', 18)}</span></div>`}
    <div class="xc-in">
      <div class="xc-img"><img src="${IMG['ex_' + e.id]}" alt="" draggable="false"></div>
      <div class="xc-t"><div class="xc-ar">${e.ar}</div><div class="xc-en">${e.en}</div>
        <div class="xc-tags">${locked ? `<span class="tag">${ic('lock', 11)} يحتاج ${EQ[e.eq].one}</span>` : `<span class="tag">${ic(e.eq, 12)} ${EQ[e.eq].one}</span><span class="tag">${KIND[e.k]}</span>`}</div></div>
      ${locked ? '' : `<span class="xc-on" aria-hidden="true">${ic('check', 16)}</span><button class="sr" data-act="pick">${on ? 'شيل' : 'أضف'} ${e.ar}</button>`}
    </div></div>`
}
const selOf = (cid) => MT[cid] || (MT[cid] = new Set())
const toolsAr = (set) => [...set].map(q => EQ[q].one).join(' أو ')
let RESTORED = null   // the muscle that opened on a remembered tool choice
function mtNote(c) {
  const sel = selOf(c.id)
  if (!sel.size) return ''
  return RESTORED === c.id ? `فتحناها على آخر اختيار لك. «كمّل خطتي» يكمّل ${c.ar} بـ${toolsAr(sel)} بس` : `«كمّل خطتي» يكمّل ${c.ar} بـ${toolsAr(sel)} بس`
}
function mtoolsHTML(c) {
  const have = EQ_ORDER.filter(q => S.eq.has(q) && EX.some(e => e.card === c.id && e.eq === q))
  if (have.length < 2) return ''
  const sel = selOf(c.id)
  const n = (q) => EX.filter(e => e.card === c.id && (!q ? S.eq.has(e.eq) : e.eq === q)).length
  return `<div class="mtools"><div class="pills" role="group" aria-label="أدوات ${c.ar}، تختار وحدة أو أكثر">
    <button class="pill" data-act="mtool" data-v="all" aria-pressed="${!sel.size}">الكل<span class="cnt num">${n()}</span></button>${have.map(q => `<button class="pill" data-act="mtool" data-v="${q}" aria-pressed="${sel.has(q)}">${ic(q, 15)}${EQ[q].one}<span class="cnt num">${n(q)}</span></button>`).join('')}</div>
    <p class="mt-note" id="mt-note" ${sel.size ? '' : 'hidden'}>${mtNote(c)}</p></div>`
}
function mvListHTML(c) {
  const sel = selOf(c.id)
  const show = (e) => !sel.size || sel.has(e.eq) || S.picks.some(p => p.id === e.id)
  let h = ''
  for (const g of c.groups) {
    const all = EX.filter(e => e.card === c.id && e.area === g), av = all.filter(e => S.eq.has(e.eq)), vis = av.filter(show)
    if (!all.length) continue
    h += `<div class="grp"><div class="grp-h"><b>${GROUP[g].t}</b><span>${GROUP[g].hint}</span></div>`
    h += vis.length ? `<div class="xlist">${vis.map(e => xcardHTML(e)).join('')}</div>`
      : av.length ? `<div class="empty">ما فيه تمرين ${GROUP[g].t} بـ${toolsAr(sel)}. اختر أداة ثانية فوق.</div>`
        : `<div class="empty">ما فيه تمرين ${GROUP[g].t} بأدواتك. شوف تحت وش يفتحه.</div>`
    h += '</div>'
  }
  h += `<p class="legend"><b>أساسي</b> يشغّل أكثر من عضلة · <b>تركيز</b> يشتغل على عضلة وحدة</p>`
  const locked = EX.filter(e => e.card === c.id && !S.eq.has(e.eq))
  if (locked.length) {
    const qs = [...new Set(locked.map(e => e.eq))]
    h += `<div class="locked-box grp"><div class="grp-h"><b>تحتاج أدوات ما اخترتها</b><span class="num">${locked.length}</span></div>
      <div class="pills">${qs.map(q => `<button class="pill" data-act="have-mv" data-v="${q}">${ic('plus', 14)} عندي ${EQ[q].ar}</button>`).join('')}</div>
      <div class="xlist">${locked.map(e => xcardHTML(e, { locked: true })).join('')}</div></div>`
  }
  return h
}
const swipeHintHTML = () => MEM.swiped ? '' : `<div class="sw-hint" id="sw-hint" role="note"><span class="sw-demo" aria-hidden="true"><span class="sw-card"><i></i><i></i></span><span class="sw-hand">${ic('hand', 20)}</span></span><span class="sw-t"><b>اسحب التمرين يمين أو يسار</b>عشان تضيفه. وتسحبه مرة ثانية تشيله.</span></div>`
function mviewHTML(c) {
  const T = targets(S.goal), areas = c.areas.filter(a => T[a])
  return `
  <div class="mv-bar">
    <button class="icon-btn" data-act="mv-close" aria-label="رجوع للعضلات">${ic('back')}</button>
    <span class="mv-bt">${c.ar}</span>
    <div class="tray" aria-live="polite"><span class="tray-l"></span><div class="tray-stack"></div></div>
  </div>
  <div class="mv-scroll">
    <div class="mv-head">
      <div class="mv-art"><img src="${IMG[c.img]}" alt=""></div>
      <div class="mv-txt"><div class="eyebrow">${c.sub || 'عضلة'}</div><h3 class="mv-name ${c.ar.length > 6 ? 'long' : ''}">${c.ar}</h3></div>
    </div>
    <div class="areas">${areas.length ? `<div class="areas-h"><span>مجموعات بالأسبوع</span><span>الخط = أقل شي</span></div>` + areas.map(a => `<div class="arow" data-a="${a}"><span class="al">${AREAS[a].row}</span><span class="ab"><i></i><b></b></span><span class="av"></span></div>`).join('') : `<div class="anote">اختياري. للتنشيف ننصح بجلستين كارديو بالأسبوع.</div>`}
      ${c.id === 'shoulders' ? `<div class="anote">قدّام الكتف ياخذ شغله من تمارين الضغط، فما نحسب له.</div>` : ''}</div>
    <div id="mfix"></div>
    ${mtoolsHTML(c)}
    ${swipeHintHTML()}
    <div class="mv-list">${mvListHTML(c)}</div>
  </div>
  <div class="dock"><button class="btn-primary" data-act="mv-close">تم</button></div>`
}
function updateMview(first) {
  const mv = $('#mview'), c = CARD[S.card]; if (mv.hidden || !c) return []
  const plan = buildFromPicks(cfg()), cov = coverage(plan, S.goal), cs = cardState(c, cov.st, cov.T)
  for (const s of cs.segs) {
    const row = $(`.arow[data-a="${s.a}"]`, mv); if (!row) continue
    const t = cov.T[s.a], scale = Math.max(t[1] * 1.25, t[0] * 1.6, s.cur * 1.05), much = s.cur > t[2] + 0.5
    $('.ab i', row).style.setProperty('--f', Math.min(1, s.cur / scale).toFixed(3))
    row.style.setProperty('--min', (t[0] / scale * 100).toFixed(1) + '%')
    row.classList.toggle('ok', !isShort(s.cur, s.min)); row.classList.toggle('much', much)
    $('.av', row).innerHTML = much ? `<span class="num">${Math.round(s.cur)}</span> · كثير` : `<span class="num">${setsShown(s.cur, s.min)}</span> من <span class="num">${s.min}</span>`
  }
  renderMfix(plan, c)
  const ids = cardPicks(c.id).slice().reverse().map(p => p.id)
  const l = $('.tray-l', mv), was = l.dataset.n
  l.innerHTML = ids.length ? `اخترت <b class="num tray-n">${ids.length}</b>` : 'ما اخترت شي'
  l.dataset.n = ids.length
  if (!first && was !== String(ids.length) && ids.length) { const n = $('.tray-n', l); if (n && !RM) n.animate([{ transform: 'translateY(-8px) scale(1.3)' }, { transform: 'none' }], { duration: 450, easing: LAND }) }
  return ids
}
function renderTray(ids, waitFirst) {
  const st = $('#mview .tray-stack'); if (!st) return null
  st.innerHTML = ids.slice(0, 3).map((id, i) => `<span class="tt ${waitFirst && i === 0 ? 'wait' : ''}"><img src="${IMG['ex_' + id]}" alt=""></span>`).join('')
  return st.firstElementChild
}
function openMuscle(id, cardEl) {
  const c = CARD[id]; S.card = id
  RESTORED = selOf(id).size ? id : null
  const mv = $('#mview')
  mv.innerHTML = mviewHTML(c); mv.hidden = false; mv.classList.remove('scrolled')
  renderTray(updateMview(true))
  $('.mv-scroll', mv).addEventListener('scroll', (e) => mv.classList.toggle('scrolled', e.target.scrollTop > 120), { passive: true })
  if (RM) return
  const a = lr(cardEl), W = SCREEN.clientWidth, H = SCREEN.clientHeight, ease = 'cubic-bezier(.32,.72,0,1)'
  const cs = getComputedStyle(HOST)
  mv.animate([{ clipPath: `inset(${a.y}px ${W - a.x - a.w}px ${H - a.y - a.h}px ${a.x}px round 24px)`, backgroundColor: cs.getPropertyValue('--s1').trim() }, { clipPath: 'inset(0px 0px 0px 0px round 0px)', backgroundColor: cs.getPropertyValue('--ground').trim() }], { duration: 580, easing: ease })
  flipFrom($('.mv-art img', mv), lr($('.mc-art img', cardEl)), 580)
  flipFrom($('.mv-name', mv), lr($('.mc-name', cardEl)), 580)
  ;[$('.mv-bar', mv), $('.eyebrow', mv), $('.areas', mv), $('#mfix', mv), $('.mtools', mv), $('#sw-hint', mv), ...$$('.mv-list > .grp', mv).slice(0, 3), $('.dock', mv)].forEach((el, i) => {
    el && el.animate([{ opacity: 0, transform: 'translateY(22px)' }, { opacity: 1, transform: 'none' }], { duration: 440, delay: 70 + i * 38, easing: 'cubic-bezier(.2,0,0,1)', fill: 'backwards' })
  })
  $('#deck-scroll').animate([{ transform: 'none', filter: 'brightness(1)' }, { transform: 'scale(.93)', filter: 'brightness(.45)' }], { duration: 580, easing: ease, fill: 'forwards' })
  if (!S.hinted && !MEM.swiped) { S.hinted = true; later(() => nudge($('#mview .xcard:not(.locked):not(.on)')), 1000) }
}
/* the card slides aside and back, showing «أضف» under it: how a swipe looks */
function nudge(card) {
  if (!card || RM || card.classList.contains('nudge')) return
  const inner = $('.xc-in', card); card.classList.add('nudge')
  inner.animate([{ transform: 'none' }, { transform: 'translateX(-74px) rotate(-1.2deg)', offset: 0.42 }, { transform: 'translateX(-74px) rotate(-1.2deg)', offset: 0.6 }, { transform: 'none' }], { duration: 1300, easing: 'cubic-bezier(.4,0,.2,1)' }).onfinish = () => card.classList.remove('nudge')
}
function closeMuscleNow() { const mv = $('#mview'); mv.hidden = true; mv.innerHTML = ''; const ds = $('#deck-scroll'); ds && ds.getAnimations().forEach(x => x.cancel()) }
function closeMuscle() {
  const mv = $('#mview'); if (mv.hidden || S.busy) return
  clearToasts()
  const cardEl = $(`#s-deck .mcard[data-card="${S.card}"]`)
  updateDeck()
  const ds = $('#deck-scroll')
  ds.getAnimations().forEach(x => x.cancel())
  if (RM || !cardEl) { closeMuscleNow(); return }
  if (!visible(cardEl, 60)) cardEl.scrollIntoView({ block: 'center' })
  S.busy = true
  const a = lr(cardEl), W = SCREEN.clientWidth, H = SCREEN.clientHeight, ease = 'cubic-bezier(.32,.72,0,1)'
  const clip = `inset(${a.y}px ${W - a.x - a.w}px ${H - a.y - a.h}px ${a.x}px round 24px)`
  ds.animate([{ transform: 'scale(.93)', filter: 'brightness(.45)' }, { transform: 'none', filter: 'brightness(1)' }], { duration: 500, easing: ease })
  const art = $('.mv-art img', mv), ms = $('.mv-scroll', mv)
  if (art && ms.scrollTop < 120) {
    const from = lr(art), to = lr($('.mc-art img', cardEl)), k = to.w / from.w
    art.animate([{ transform: 'none' }, { transform: `translate(${(to.x + to.w / 2) - (from.x + from.w / 2)}px,${(to.y + to.h / 2) - (from.y + from.h / 2)}px) scale(${k})` }], { duration: 500, easing: ease, fill: 'forwards' })
  }
  mv.animate([{ clipPath: 'inset(0px 0px 0px 0px round 0px)', opacity: 1 }, { clipPath: clip, opacity: 1, offset: 0.78 }, { clipPath: clip, opacity: 0 }], { duration: 520, easing: ease }).onfinish = () => {
    mv.hidden = true; mv.innerHTML = ''; S.busy = false
    cardEl.animate([{ transform: 'scale(.96)' }, { transform: 'none' }], { duration: 520, easing: LAND })
  }
}
function restyleX(cardEl, id, on) {
  const tmp = document.createElement('div'); tmp.innerHTML = xcardHTML(EXI[id], { on }).trim()
  const nc = tmp.firstElementChild
  cardEl.className = nc.className
  $('.xc-reveal', cardEl).innerHTML = $('.xc-reveal', nc).innerHTML
  $('.sr', cardEl).textContent = $('.sr', nc).textContent
}
function hintDone() {
  if (MEM.swiped) return
  MEM.swiped = true; saveMem()
  const h = $('#sw-hint'); if (!h) return
  if (RM) return h.remove()
  h.animate([{ opacity: 1, height: h.offsetHeight + 'px' }, { opacity: 0, height: '0px', marginTop: '0px', marginBottom: '0px', paddingTop: '0px', paddingBottom: '0px' }], { duration: 360, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).onfinish = () => h.remove()
}
function togglePick(id, cardEl, viaSwipe) {
  clearToasts()   // an «تراجع» from before this pick would undo the wrong thing
  const i = S.picks.findIndex(p => p.id === id)
  const adding = i < 0
  if (adding) S.picks.push({ id }); else S.picks.splice(i, 1)
  if (cardEl) {
    restyleX(cardEl, id, adding)
    if (adding) { cardEl.classList.add('just'); later(() => cardEl.classList.remove('just'), 700) }
  }
  buzz(adding ? 12 : 6)
  snd('tick', { gain: adding ? 0.45 : 0.25, rate: adding ? 1.1 : 0.85 })
  if (adding && viaSwipe) hintDone()
  const ids = updateMview()
  if (adding && cardEl) {
    const target = renderTray(ids, true)
    fly($('.xc-img', cardEl), target, IMG['ex_' + id], { dur: viaSwipe ? 560 : 640, arc: -90, onLand: () => { target && target.classList.remove('wait'); buzz(4) } })
  } else renderTray(ids)
  updateDeck()
}

/* ── swipe: the only way to add (Hamza: «السحب بس»). Same gesture in the
   muscle list and in «أضف تمرين لهذا اليوم». A tap shows how. ── */
const TH = 84
let swipe = null, suppress = 0
on(HOST, 'pointerdown', (e) => {
  audioInit()
  const card = e.target.closest('#mview .xcard:not(.locked), #sheet .xcard:not(.locked)')
  if (!card || e.button > 0) return
  swipe = { card, inner: $('.xc-in', card), x0: e.clientX, y0: e.clientY, id: e.pointerId, mode: null, x: 0, v: 0, lx: e.clientX, lt: performance.now(), armed: false }
})
on(document, 'pointermove', (e) => {
  const s = swipe; if (!s || e.pointerId !== s.id) return
  const dx = (e.clientX - s.x0) / K, dy = (e.clientY - s.y0) / K
  if (!s.mode) {
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) { s.mode = 'h'; try { s.card.setPointerCapture(e.pointerId) } catch (er) { /* fine */ } s.card.classList.add('dragging') }
    else if (Math.abs(dy) > 8) { s.mode = 'v'; swipe = null; return }
  }
  if (s.mode !== 'h') return
  e.preventDefault()
  const now = performance.now(); s.v = ((e.clientX - s.lx) / K) / Math.max(1, now - s.lt) * 1000; s.lx = e.clientX; s.lt = now
  const ax = Math.abs(dx), x = Math.sign(dx) * (ax < TH ? ax : TH + (ax - TH) * 0.35)
  s.x = x
  s.inner.style.transform = `translateX(${x}px) rotate(${x * 0.018}deg)`
  s.card.style.setProperty('--p', Math.min(1, ax / TH).toFixed(3))
  const armed = ax >= TH
  if (armed !== s.armed) { s.armed = armed; s.card.classList.toggle('armed', armed); if (armed) { buzz(6); snd('tick', { gain: 0.18, rate: 1.5 }) } }
}, { passive: false })
function endSwipe(e) {
  const s = swipe; if (!s || e.pointerId !== s.id) return
  swipe = null
  if (s.mode !== 'h') return
  suppress = performance.now()
  s.card.classList.remove('dragging')
  if (s.armed) { if (s.card.closest('#sheet')) dayPick(s.card.dataset.id, s.card); else togglePick(s.card.dataset.id, s.card, true) }
  springTo((x) => { s.inner.style.transform = x ? `translateX(${x}px) rotate(${x * 0.018}deg)` : '' }, s.x, s.v * 0.4).then(() => {
    s.card.classList.remove('armed'); s.card.style.removeProperty('--p')
  })
}
on(document, 'pointerup', endSwipe)
on(document, 'pointercancel', endSwipe)
function tapHint(card) {
  nudge(card)
  const h = $('#sw-hint')
  if (h && !RM) h.animate([{ transform: 'none' }, { transform: 'scale(1.03)' }, { transform: 'none' }], { duration: 420, easing: LAND })
  else toast('اسحبه يمين أو يسار عشان تضيفه')
}

/* ── «كثير» inside the muscle: the suggestion right under the meter ── */
function muchWords(w, fix) {
  const n = EXI[fix.id].ar
  return fix.kind === 'rm' ? `شيل ${n}` : `نزّل ${n} ${fix.k === 1 ? 'مجموعة' : 'مجموعتين'}`
}
function renderMfix(plan, c) {
  const box = $('#mfix'); if (!box) return
  const ws = findWarns(plan, S.goal).filter(w => (w.a === 'back' ? c.id === 'back' : AREAS[w.a].card === c.id) && !S.dismissed.has('much:' + w.a))
  if (!ws.length) { box.innerHTML = ''; return }
  const w = ws[0], fix = muchFix(plan, S.goal, w)
  const sig = w.a + (fix ? fix.kind + fix.id + Math.round(fix.after) : '') + Math.round(w.cur)
  if (box.dataset.sig === sig) return
  box.dataset.sig = sig
  box.innerHTML = `<div class="mfix" role="status"><div class="mf-h"><span class="mf-ic" aria-hidden="true">!</span><b>كثير: ${setsWord(Math.round(w.cur))} بالأسبوع</b></div>
    <p>فوق ${w.max} الفايدة تقل والتعب يزيد. ${fix ? `اقتراحنا: <b>${muchWords(w, fix)}</b>، و${lblOf(w.a)} يصير ${Math.round(fix.after)}.` : 'خفّف لو تبي.'}</p>
    <div class="mf-acts">${fix ? `<button class="mf-yes" data-act="much-yes" data-a="${w.a}" data-ctx="mv">${fix.kind === 'rm' ? 'شيله' : 'نزّلها'}</button>` : ''}<button class="mf-no" data-act="much-no" data-a="${w.a}">خلّها كذا</button></div></div>`
  if (!RM) box.firstElementChild.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,0,0,1)' })
}

/* ══ 4 · gaps ══ */
function mergeRows(gaps, plan) {
  const rows = []
  const bm = gaps.filter(g => g.type === 'missing' && (g.a === 'lats' || g.a === 'rows'))
  for (const g of gaps) {
    if (bm.length === 2 && bm.includes(g)) {
      if (g !== bm[0]) continue
      const chest = hasMove(plan, e => e.cr.chest >= 1)
      rows.push({ areas: ['lats', 'rows'], type: 'missing', pair: 'back', title: 'الظهر: ما فيه ولا تمرين سحب', sub: chest ? 'عندك صدر، والصدر بدون ظهر يختل التوازن' : 'الظهر من أكبر عضلات جسمك', why: chest ? 'push' : 'volume', g: { ...g, cur: 0 } })
      continue
    }
    const w = gapWords(g, plan)
    rows.push({ areas: [g.a], type: g.type, pair: g.pair || '', title: w.title, sub: w.sub, why: w.why, g })
  }
  return rows
}
function markStyle(r) {
  if (r.type === 'missing') return ''
  const t = r.g.t, cur = r.g.cur
  const p = r.type === 'low' ? Math.max(8, Math.min(92, cur / (r.g.lowT || t[0]) * 100)) : 50
  return `--m:${p.toFixed(0)}%`
}
function gapRowHTML(r, i, fold) {
  const ev = EVIDENCE[r.why]
  return `<li class="gap in ${r.type} ${fold ? 'fold' : ''}" data-areas="${r.areas.join(' ')}" data-type="${r.type}" data-pair="${r.pair}" data-cur="${(r.g.cur || 0).toFixed(2)}" style="--i:${i}">
    <span class="mark" style="${markStyle(r)}">${ic('check', 15)}</span>
    <div class="g-body"><div class="gt">${r.title}</div><div class="gs">${r.sub}</div>
      <button class="why-btn" data-act="why" aria-expanded="false">ليش؟</button>
      <div class="why" hidden><p>${ev.t}</p><a href="${ev.url}" target="_blank" rel="noopener">${ev.src} ↗</a></div>
      <div class="adds"></div></div></li>`
}
function autoRowsHTML() {
  const T = targets(S.goal)
  return CARDS.filter(c => c.areas.some(a => T[a])).map((c, i) => {
    const ar = c.areas.filter(a => T[a])
    return `<li class="arow-auto gap in" data-areas="${ar.join(' ')}" data-card="${c.id}" style="--i:${i}">
      <span class="mark">${ic('check', 15)}</span>
      <div class="g-body"><div class="gt">${c.ar}</div><div class="gs">${ar.length > 1 ? ar.map(a => AREAS[a].row).join(' · ') : GROUP[ar[0]].hint}</div></div>
      <div class="athumbs"></div></li>`
  }).join('')
}
function autoRowSummary() {
  const st = stats(S.plan)
  $$('#gaps .arow-auto').forEach(li => {
    const c = CARD[li.dataset.card], n = S.plan.days.reduce((k, d) => k + d.items.filter(it => EXI[it.id].card === c.id).length, 0)
    const sets = c.id === 'back' ? st.vol.lats + st.vol.rows : c.areas.reduce((k, a) => Math.max(k, st.vol[a] || 0), 0)
    const gs = $('.gs', li); if (gs && n) gs.textContent = `${exWord(n)} · ${setsWord(Math.round(sets))} بالأسبوع`
  })
}
function chipsHTML(plan) {
  const cov = coverage(plan, S.goal)
  return CARDS.map(c => {
    const cs = cardState(c, cov.st, cov.T); if (cs.opt) return ''
    const any = cs.segs.some(s => s.cur >= 0.5)
    return `<span class="mchip ${cs.ok ? 'ok' : any ? 'part' : ''}" data-card="${c.id}"><span class="dot"></span>${c.ar}</span>`
  }).join('')
}
function updateChips(states) {
  $$('#mchips .mchip').forEach(ch => {
    const st = states[ch.dataset.card]
    ch.classList.toggle('ok', st === 'ok'); ch.classList.toggle('part', st === 'part')
  })
}
ENTER.gaps = function (keep) {
  GEN++; FAST.on = false; S.busy = false
  const auto = S.mode === 'auto'
  if (S._keep) { keep = true; S._keep = false }
  if (!keep || !S.plan) { S.plan = buildFromPicks(cfg()); S.filled = false }
  const { gaps } = findGaps(S.plan, S.goal)
  const rows = auto ? null : mergeRows(gaps, S.plan)
  const cov = coverage(S.plan, S.goal)
  const folded = rows ? Math.max(0, rows.length - 3) : 0
  $('#s-gaps').innerHTML = `
  <div class="scroll" id="gaps-scroll">
    ${topbar(3)}
    <h2 class="title">${auto ? 'خطتك' : rows.length ? 'وش ناقص خطتك؟' : 'خطتك مكتملة'}</h2>
    <p class="sub">${auto ? `من أدواتك (${eqList()})، ${S.days} أيام بالأسبوع، ${splitShort()}، هدفك ${GOALS[S.goal].ar}.` : rows.length ? 'رتّبناها من الأهم. اضغط «ليش؟» وتشوف السبب.' : 'كل عضلة واخذة حقها. تقدر تكمل.'}</p>
    <div class="gtop"><div class="gcov"><b id="gn">${cov.n}</b><span class="of">من ${cov.of}</span><span class="gl">عضلات<br>مغطاة</span></div><div class="gfig" id="gfig" role="img" aria-label="جسم من قدّام ومن ورا، تنوّر فيه العضلات المغطاة">${bodySVG()}</div></div>
    <div class="mchips" id="mchips">${chipsHTML(S.plan)}</div>
    <ol class="gaps" id="gaps">${auto ? autoRowsHTML() : rows.map((r, i) => gapRowHTML(r, i, i >= 3)).join('')}</ol>
    ${folded ? `<button class="pill" data-act="unfold" id="unfold" style="margin-top:12px">و${folded === 1 ? ' شي ثاني' : ` ${folded} أشياء ثانية`}</button>` : ''}
    ${!auto && !rows.length ? `<div class="complete"><b>${ic('check', 18)} ما فيه نقص</b><span>كل عضلة فوق أقل شي لها، والظهر قريب من الصدر.</span></div>` : ''}
    <div id="advice"></div>
    <div class="fill-sum" id="fill-sum"></div>
  </div>
  <div class="dock" id="gaps-dock">${auto ? '' : rows.length
    ? `<button class="btn-primary" data-act="fill">${ic('spark', 18)} كمّل خطتي</button><button class="btn-quiet" data-act="to-plan-raw">خلّها زي ما هي</button>`
    : `<button class="btn-primary" data-act="to-plan">شوف خطتك</button>`}</div>`
  $$('#gaps > li').forEach(li => { li._orig = { t: $('.gt', li).innerHTML, s: $('.gs', li).innerHTML } })
  paintBody($('#gfig svg'), areaStates(cov))
  renderAdvice('gaps')
}
function rowFor(area, cardId) {
  if (S.mode === 'auto') return $(`#gaps .arow-auto[data-card="${cardId}"]`)
  return $$('#gaps > .gap').find(li => li.dataset.areas.split(' ').includes(area))
}
function extraRow() {
  let li = $('#gaps .gap.extra')
  if (!li) {
    $('#gaps').insertAdjacentHTML('beforeend', `<li class="gap extra done"><span class="mark">${ic('check', 15)}</span><div class="g-body"><div class="gt">وأضفنا كمان</div><div class="gs">عشان الخطة تتوازن، وما يصير فيه يوم خفيف</div><div class="adds"></div></div></li>`)
    li = $('#gaps .gap.extra')
  }
  return li
}
function addedHTML(step, labels) {
  const it = step.item, e = EXI[it.id]
  if (step.kind === 'bump') return `<div class="bumped added">${ic('plus', 15)}<span>زدنا مجموعة على ${e.ar}، صارت ${it.sets}</span></div>`
  const L = labels[step.day]
  return `<div class="added" data-uid="${it.uid}"><span class="ad-img"><img src="${IMG['ex_' + it.id]}" alt=""></span>
    <span class="ad-t"><span class="ad-by">${ic('spark', 11)} أضافه التطبيق</span><b>${e.ar}</b><span class="ad-m">${it.mins ? 'جلسة 20 دقيقة' : `${setsWord(it.sets)} · ${repsWord(it)}`} · يوم ${dayName(L)}</span></span>
    <div class="ad-acts"><button data-act="ad-swap" data-uid="${it.uid}">${inl(ic('swap', 14))} غيّره</button><button data-act="ad-x" data-uid="${it.uid}">${inl(ic('x', 14))} شيله</button></div></div>`
}
function wasNowHTML(li) {
  const st = stats(S.plan), areas = li.dataset.areas.split(' ')
  const pair = li.dataset.pair === 'back' || (areas.includes('lats') && areas.includes('rows'))
  const now = pair ? st.vol.lats + st.vol.rows : areas.reduce((s, a) => s + st.vol[a], 0)
  const before = +li.dataset.cur
  return `<span class="wasnow"><s>كان ${before < 0.5 ? 'ولا تمرين' : setsWord(n0(before)) + ' بالأسبوع'}</s><i>←</i><b>صار ${setsWord(n0(now))} بالأسبوع</b></span>`
}
function doneTitle(li) {
  const areas = li.dataset.areas.split(' ')
  if (li.dataset.pair === 'back' || areas.includes('lats') && areas.includes('rows')) return 'الظهر'
  return AREAS[areas[0]].lbl
}
function setDone(li, on) {
  if (li.classList.contains('extra') || li.classList.contains('arow-auto')) { li.classList.toggle('done', on); return }
  li.classList.toggle('done', on)
  if (on) { $('.gt', li).textContent = doneTitle(li); $('.gs', li).innerHTML = wasNowHTML(li) }
  else if (li._orig) { $('.gt', li).innerHTML = li._orig.t; $('.gs', li).innerHTML = li._orig.s }
}
function refreshGaps(pop) {
  const cov = coverage(S.plan, S.goal)
  tween($('#gn'), cov.n, 300); updateChips(cardStates(cov)); paintBody($('#gfig svg'), areaStates(cov), pop)
  const open = new Set(findGaps(S.plan, S.goal).gaps.map(g => g.a))
  $$('#gaps > li').forEach(li => { if (!li.classList.contains('extra')) setDone(li, !li.dataset.areas.split(' ').some(a => open.has(a))) })
  renderAdvice('gaps')
  updateRail()
}

/* ── soft advice: «كثير» with a one-tap suggestion, and tips that never block.
   At most three show; the rest fold. «خلّها كذا» is remembered for this plan. ── */
function adviceItems(plan) {
  const out = []
  for (const w of findWarns(plan, S.goal)) {
    const key = 'much:' + w.a
    if (!S.dismissed.has(key)) out.push({ kind: 'much', key, w, fix: muchFix(plan, S.goal, w) })
  }
  const tips = findTips(plan, S.goal).filter(t => !S.dismissed.has(t.key))
  for (const t of tips) if (t.kind === 'orphan' || t.kind === 'session') out.push(t)
  const rare = tips.filter(t => t.kind === 'rare')
  if (rare.length) out.push({ kind: 'rare', key: rare.map(r => r.key).join('|'), list: rare, fix: rare.find(r => r.fix) ? { kind: 'split' } : null })
  return out
}
function adviceHTML(t, L) {
  let title = '', text = '', yes = ''
  if (t.kind === 'much') {
    title = `${lblOf(t.w.a)}: ${setsWord(Math.round(t.w.cur))} بالأسبوع`
    text = `فوق ${t.w.max} الفايدة تقل والتعب يزيد. ${t.fix ? `اقتراحنا: <b>${muchWords(t.w, t.fix)}</b>، و${lblOf(t.w.a)} يصير ${Math.round(t.fix.after)}.` : 'خفّف لو تبي.'}`
    yes = t.fix ? (t.fix.kind === 'rm' ? 'شيله' : 'نزّلها') : ''
  } else if (t.kind === 'session') {
    title = `${lblOf(t.a)}: ${t.n} مجموعة بيوم ${dayName(L[t.day])}`
    text = `بعد 10 تقريباً بالجلسة الفايدة تقل. ${t.fix ? `ننقل <b>${EXI[t.fix.id].ar}</b> ليوم ${dayName(L[t.fix.to])}؟` : 'لو تبي، خفّف شوي.'}`
    yes = t.fix ? 'انقله' : ''
  } else if (t.kind === 'rare') {
    const names = t.list.map(r => lblOf(r.a))
    title = t.list.length === 1 ? `${names[0]}: مرة بالأسبوع` : `${andJoin(names)}: كل وحدة مرة بالأسبوع`
    text = `يمشي، لأن مجموعاتها كاملة. ${t.fix ? 'لو تبي، نقسمها على يومين.' : 'لو تبي مرتين، اختر نظام فيه يومين لها.'}`
    yes = t.fix ? 'قسّمها' : ''
  } else if (t.kind === 'orphan') {
    title = `${EXI[t.id].ar}: ما له يوم ${t.want ? TYPE[t.want].ar : ''} بنظامك`
    text = `حطّيناه بيوم ${dayName(L[t.day])}.${t.fix && splitId() === 'free' ? ` نضيف يوم ${TYPE[t.want].ar} لنظامك؟` : ''}`
    yes = t.fix && splitId() === 'free' ? `أضف يوم ${TYPE[t.want].ar}` : ''
  }
  return `<li class="gap tip ${t.kind}" data-key="${t.key}"><span class="mark tipm" aria-hidden="true">${t.kind === 'much' ? '!' : ic('info', 16)}</span>
    <div class="g-body"><div class="gt">${title}</div><div class="gs">${text}</div>
    <div class="tip-acts">${yes ? `<button class="tip-yes" data-act="tip-yes" data-key="${t.key}">${yes}</button>` : ''}<button class="tip-no" data-act="tip-no" data-key="${t.key}">خلّها كذا</button></div></div></li>`
}
let ADV = []
function renderAdvice(where) {
  const box = where === 'plan' ? $('#plan-adv') : $('#advice'); if (!box || !S.plan) return
  ADV = adviceItems(S.plan)
  if (!ADV.length) { box.innerHTML = ''; return }
  const L = dayLabels(S.plan), open = box.dataset.open === '1'
  box.innerHTML = `<div class="adv-h"><b>انتبه لهذي</b><span>نصايح، ما تمنع شي</span></div>
    <ol class="gaps adv">${ADV.map((t, i) => adviceHTML(t, L).replace('class="gap tip', `class="gap tip ${i >= 3 && !open ? 'fold' : ''}`)).join('')}</ol>
    ${ADV.length > 3 && !open ? `<button class="pill" data-act="adv-unfold">و${ADV.length - 3 === 1 ? ' وحدة ثانية' : ` ${ADV.length - 3} ثانية`}</button>` : ''}`
}
function adviceCtx() { return S.cur === 'plan' ? 'plan' : 'gaps' }
function refreshCtx(ctx) {
  if (ctx === 'plan') { renderDay(); refreshPlan() }
  else { $$('#gaps .added[data-uid]').forEach(el => { if (!findItem(el.dataset.uid)) el.hidden = true }); refreshGaps(true) }
}
const pickOf = (id) => S.picks.find(p => p.id === id)
// The pick a row came from (two rows of one exercise are two picks),
// whoever added it: his plan opened to edit has the app's rows as picks
// too (by:'app'), and going back a screen builds the plan again from the
// picks, so a change that skips the pick quietly comes undone. A row
// «كمّل خطتي» just added has no pick (null); the id is only a fallback
// for his own rows, never for the app's (it would find his pick of the
// same exercise).
const pickFor = (it) => {
  if (!it) return null
  if (it.src && S.picks.includes(it.src)) return it.src
  return it.by === 'user' ? pickOf(it.id) || null : null
}
const linkPick = (it, p) => Object.defineProperty(it, 'src', { value: p, enumerable: false, writable: true, configurable: true })
const defSets = (id) => { const e = EXI[id]; return e.k === 'x' ? 1 : SCHEME[S.goal][e.k][0] }
function applyMuch(a, ctx) {
  if (ctx === 'mv') {
    const plan = buildFromPicks(cfg()), w = findWarns(plan, S.goal).find(x => x.a === a); if (!w) return
    const fix = muchFix(plan, S.goal, w); if (!fix) return
    const i = S.picks.findIndex(p => p.id === fix.id); if (i < 0) return
    const before = { ...S.picks[i] }, name = EXI[fix.id].ar
    if (fix.kind === 'rm') S.picks.splice(i, 1); else S.picks[i].sets = (S.picks[i].sets ?? defSets(fix.id)) - fix.k
    const card = $(`#mview .xcard[data-id="${fix.id}"]`); if (card && fix.kind === 'rm') { restyleX(card, fix.id, false); land(card) }
    renderTray(updateMview()); updateDeck(); buzz(8); snd('tick', { gain: 0.3, rate: 0.8 })
    toast(fix.kind === 'rm' ? `شلنا ${name}. ${lblOf(a)} صار ${Math.round(fix.after)}` : `نزّلنا ${name}. ${lblOf(a)} صار ${Math.round(fix.after)}`, { label: 'تراجع', run: () => {
      // swiped back in meanwhile: nothing to undo
      if (fix.kind === 'rm') { if (S.picks.some(p => p.id === fix.id)) return; S.picks.splice(Math.min(i, S.picks.length), 0, before) }
      else Object.assign(S.picks.find(p => p.id === fix.id) || {}, before)
      const c2 = $(`#mview .xcard[data-id="${fix.id}"]`); c2 && restyleX(c2, fix.id, true)
      const b = $('#mfix'); if (b) b.dataset.sig = ''
      renderTray(updateMview()); updateDeck()
    } })
    return
  }
  const t = ADV.find(x => x.kind === 'much' && x.w.a === a); if (!t || !t.fix) return
  const fix = t.fix, f = findItem(fix.uid); if (!f) return
  const name = EXI[f.it.id].ar, was = f.it.sets, pk = pickFor(f.it), pkBefore = pk && { ...pk }, pkIdx = S.picks.indexOf(pk)
  if (fix.kind === 'rm') { f.d.items.splice(f.ii, 1); if (pk) S.picks.splice(pkIdx, 1) }
  else { f.it.sets -= fix.k; if (pk) pk.sets = f.it.sets }
  refreshCtx(ctx); buzz(8)
  toast(fix.kind === 'rm' ? `شلنا ${name}. ${lblOf(a)} صار ${Math.round(fix.after)}` : `نزّلنا ${name}. ${lblOf(a)} صار ${Math.round(fix.after)}`, { label: 'تراجع', run: () => {
    if (fix.kind === 'rm') {
      if (!S.plan.days.includes(f.d) || findItem(f.it.uid)) return
      f.d.items.splice(Math.min(f.ii, f.d.items.length), 0, f.it)
      if (pk && !S.picks.includes(pk)) S.picks.splice(Math.min(Math.max(0, pkIdx), S.picks.length), 0, Object.assign(pk, pkBefore))
    }
    else { f.it.sets = was; if (pk) Object.assign(pk, pkBefore) }
    const el = $(`#gaps .added[data-uid="${f.it.uid}"]`); if (el) el.hidden = false
    refreshCtx(ctx)
  } })
}
function moveItem(fix) {
  const f = findItem(fix.uid); if (!f) return null
  f.d.items.splice(f.ii, 1); S.plan.days[fix.to].items.push(f.it); sortDay(S.plan.days[fix.to])
  const pk = pickFor(f.it)
  f.pinned = !!pk && pk.day != null   // a row of his plan opened to edit stays pinned on «تراجع»
  if (pk) pk.day = fix.to
  return f
}
function applyTip(key, ctx) {
  const t = ADV.find(x => x.key === key); if (!t) return
  if (t.kind === 'much') return applyMuch(t.w.a, ctx)
  const L = dayLabels(S.plan)
  if (t.kind === 'session' && t.fix) {
    const f = moveItem(t.fix); if (!f) return
    refreshCtx(ctx); toast(`نقلنا ${EXI[f.it.id].ar} ليوم ${dayName(L[t.fix.to])}`, { label: 'تراجع', run: () => { moveItem({ uid: f.it.uid, to: f.di }); const pk = pickFor(f.it); if (pk && !f.pinned) delete pk.day; refreshCtx(ctx) } })
  } else if (t.kind === 'rare') {
    const moved = []
    for (const r of t.list) if (r.fix) { const f = moveItem(r.fix); if (f) moved.push(f) }
    refreshCtx(ctx); toast(moved.length ? `قسّمناها: ${moved.map(f => EXI[f.it.id].ar).join('، ')} صار بيوم ثاني` : 'ما فيه يوم ثاني لها بنظامك')
  } else if (t.kind === 'orphan' && t.fix && splitId() === 'free') {
    S.cycle = cycleOf().concat(t.want)
    const filled = S.filled
    if (ctx === 'plan') { S.plan = buildFromPicks(cfg()); if (filled) fill(S.plan, cfg()); S.filled = filled; S.day = S.plan.days.length - 1; renderDay(); refreshPlan() }
    else { ENTER.gaps(); if (filled) instantFill() }
    toast(`أضفنا يوم ${TYPE[t.want].ar} لنظامك`)
  }
  buzz(8)
}
function dismissTip(key, ctx) {
  const t = ADV.find(x => x.key === key); if (!t) return
  key.split('|').forEach(k => S.dismissed.add(k))
  const li = $(`#${ctx === 'plan' ? 'plan-adv' : 'advice'} .tip[data-key="${CSS.escape(key)}"]`)
  const done = () => renderAdvice(ctx)
  if (!li || RM) return done()
  li.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-30px)' }], { duration: 240, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }).onfinish = done
  toast('خلّيناها كذا. ما نذكّرك فيها بهالخطة', { label: 'تراجع', run: () => { key.split('|').forEach(k => S.dismissed.delete(k)); renderAdvice(ctx) } })
}

/* ══ the build: the plan assembles itself day by day ══
   On «خلصت», «كمّل خطتي» and «سوّ خطتي». Exercise cards fly into their
   days, the green body lights up, the count rolls. About 2.5 s; a tap skips;
   reduced motion gets a fade with the finished plan. */
function snapCov(plan) { const cov = coverage(plan, S.goal); return { n: cov.n, of: cov.of, areas: areaStates(cov) } }
function playBuild({ plan, pre = new Set(), kind = 'picks' }) {
  const L = dayLabels(plan), n = plan.days.length
  const order = []
  plan.days.forEach((d, di) => d.items.forEach(it => { if (!pre.has(it.uid)) order.push({ it, di }) }))
  if (!order.length) return Promise.resolve()
  // a copy that grows one exercise at a time, for the count and the figure
  const part = { types: plan.types, spw: plan.spw, days: plan.days.map(d => ({ type: d.type, items: d.items.filter(it => pre.has(it.uid)) })) }
  const from = snapCov(part), to = snapCov(plan)
  const maxN = Math.max(...plan.days.map(d => d.items.length))
  const title = kind === 'picks' ? 'نرتّب اختياراتك بالأيام' : kind === 'auto' ? 'نبني خطتك' : 'نكمّل خطتك'
  const o = document.createElement('div')
  o.className = 'bld'; o.id = 'bld'; o.setAttribute('role', 'status'); o.setAttribute('aria-label', title)
  o.style.setProperty('--n', n); o.style.setProperty('--rows', maxN)
  o.innerHTML = `<div class="bld-glow" aria-hidden="true"></div>
    <div class="bld-top"><div class="bld-eb">${title}</div>
      <div class="bld-cov">${rollHTML(from.n, 'bld-n')}<span class="bld-of">من ${to.of}</span></div><div class="bld-l">عضلات مغطاة</div></div>
    <div class="bld-fig" aria-hidden="true">${bodySVG()}</div>
    <div class="bld-days" aria-hidden="true">${plan.days.map((d, i) => `<div class="bld-day" data-i="${i}"><div class="bd-h"><b>${L[i].ar}</b>${L[i].v ? `<sup>${L[i].v}</sup>` : ''}</div>
      <div class="bd-slots">${d.items.map(it => `<span class="bd-s ${pre.has(it.uid) ? 'in pre' : ''} ${it.by === 'app' && !pre.has(it.uid) ? 'app' : ''}" data-uid="${it.uid}"><img src="${IMG['ex_' + it.id]}" alt=""></span>`).join('')}</div>
      <div class="bd-n num">${d.items.filter(it => pre.has(it.uid)).length}</div></div>`).join('')}</div>
    <div class="bld-cap" id="bld-cap"></div>
    <div class="bld-skip">${RM ? '' : 'اضغط عشان تتخطّى'}</div>`
  SCREEN.appendChild(o)
  const fig = $('.bld-fig svg', o), nEl = $('#bld-n', o), cap = $('#bld-cap', o)
  paintBody(fig, from.areas)
  const FLIGHTS = []
  const capText = () => to.n >= to.of ? (kind === 'picks' ? 'كل عضلة واخذة حقها' : 'خطتك جاهزة') : `${to.n} من ${to.of}. نشوف وش ناقص`
  let skipped = false, finished = false
  const finalize = () => {
    $$('.bd-s', o).forEach(s => s.classList.add('in'))
    $$('.bld-day', o).forEach((d, i) => { $('.bd-n', d).textContent = plan.days[i].items.length; d.classList.remove('active') })
    paintBody(fig, to.areas); setRoll(nEl, to.n)
  }
  return new Promise((resolve) => {
    const exit = async () => {
      if (finished) return; finished = true
      o.classList.add('done'); cap.textContent = capText()
      snd(to.n >= to.of ? 'pr' : 'medal', { gain: to.n >= to.of ? 0.55 : 0.5 }); buzz(14)
      await wait(RM ? 900 : skipped ? 380 : 760)
      const a = o.animate(RM ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(1.04)' }], { duration: RM ? 300 : 380, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' })
      a.onfinish = () => { o.remove(); resolve() }
    }
    o.addEventListener('click', () => { if (skipped || finished) return; skipped = true; FLIGHTS.forEach(g => g.remove()); finalize(); exit() })
    o.tabIndex = -1
    o.addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); o.click() } })
    if (RM) { finalize(); o.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260 }); exit(); return }
    o.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'cubic-bezier(.2,0,0,1)' })
    $('.bld-top', o).animate([{ opacity: 0, transform: 'translateY(-14px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 60, easing: 'cubic-bezier(.2,0,0,1)', fill: 'backwards' })
    $('.bld-fig', o).animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 620, delay: 120, easing: 'cubic-bezier(.2,0,0,1)', fill: 'backwards' })
    $$('.bld-day', o).forEach((d, i) => d.animate([{ opacity: 0, transform: 'translateY(26px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 160 + i * 45, easing: 'cubic-bezier(.2,0,0,1)', fill: 'backwards' }))
    o.focus({ preventScroll: true })
    const per = Math.max(55, Math.min(150, 1250 / order.length))
    const W = SCREEN.clientWidth, H = SCREEN.clientHeight
    ;(async () => {
      await wait(420)
      let t = 0, last = -1
      const landed = []
      for (let k = 0; k < order.length; k++) {
        if (skipped) return
        const { it, di } = order[k]
        if (di !== last) {
          if (last >= 0) { await wait(70); $(`.bld-day[data-i="${last}"]`, o).classList.remove('active') }
          last = di; $(`.bld-day[data-i="${di}"]`, o).classList.add('active')
        }
        const slot = $(`.bd-s[data-uid="${it.uid}"]`, o), day = $(`.bld-day[data-i="${di}"]`, o)
        const sz = 56, from = { x: W / 2 - sz / 2 + (k % 2 ? 18 : -18), y: H - 40, w: sz, h: sz }
        const p = fly(null, slot, IMG['ex_' + it.id], { from, dur: 500, arc: -50 - (k % 3) * 18, radius: 12, rot: k % 2 ? 9 : -9, onLand: () => {
          if (skipped) return
          slot.classList.add('in'); day.classList.add('tick'); later(() => day.classList.remove('tick'), 300)
          const cnt = $('.bd-n', day); cnt.textContent = +cnt.textContent + 1
          part.days[di].items.push(it)
          const s = snapCov(part); paintBody(fig, s.areas, true); setRoll(nEl, s.n)
          buzz(3); snd('tick', { gain: 0.22 + 0.2 * (k / order.length), rate: 0.92 + 0.5 * (k / Math.max(1, order.length - 1)) })
        } })
        const g = SCREEN.lastElementChild; if (g && g.classList.contains('ghost')) FLIGHTS.push(g)
        landed.push(p)
        await wait(per); t += per
      }
      await Promise.all(landed)
      if (skipped) return
      $$('.bld-day', o).forEach(d => d.classList.remove('active'))
      await wait(120)
      exit()
    })()
  })
}

/* ── «كمّل خطتي»: fill instantly underneath, then let the build tell it ── */
function renderFillResult(res) {
  const auto = S.mode === 'auto', dock = $('#gaps-dock')
  $$('#gaps .gap.fold').forEach((li, i) => { li.classList.remove('fold'); li.style.setProperty('--i', i) })
  $('#unfold') && $('#unfold').remove()
  const labels = dayLabels(S.plan)
  for (const step of res.steps) {
    const row = step.gap.type === 'light' ? extraRow() : (rowFor(step.gap.a, AREAS[step.gap.a].card) || extraRow())
    if (auto && step.kind === 'add' && row.classList.contains('arow-auto')) {
      const th = $('.athumbs', row)
      th.insertAdjacentHTML('afterbegin', `<span class="tt"><img src="${IMG['ex_' + step.item.id]}" alt=""></span>`)
      const tts = $$('.tt', th)
      if (tts.length > 4) { tts.slice(4).forEach(t => t.remove()); let m = $('.more', th); if (!m) { th.insertAdjacentHTML('beforeend', '<span class="more">+0</span>'); m = $('.more', th) } m.textContent = '+' + (parseInt(m.textContent.slice(1)) + tts.length - 4) }
    } else if (!(auto && step.kind === 'bump')) {
      $('.adds', row).insertAdjacentHTML('beforeend', addedHTML(step, labels))
    }
  }
  refreshGaps(false)
  if (auto) autoRowSummary()
  const unlock = {}
  for (const [, b] of res.blocked) if (b.reason === 'eq') b.need.forEach(q => { unlock[q] = (unlock[q] || 0) + 1 })
  for (const [, b] of res.blocked) {
    const g = b.gap; const row = rowFor(g.a, AREAS[g.a].card); if (!row || $('.need', row)) continue
    const best = b.need.slice().sort((x, y) => (unlock[y] || 0) - (unlock[x] || 0) || PREF.indexOf(x) - PREF.indexOf(y))[0]
    const still = g.type === 'lop' ? `باقي: ${gapWords(g, S.plan).title}. ` : ''
    let txt, pill = best && b.reason === 'eq'
    if (g.a === 'cardio' && !S.eq.has('cardio')) { txt = 'امشِ أو اجرِ برّا 20 إلى 30 دقيقة، مرتين بالأسبوع. ما يحتاج جهاز.'; pill = false }
    else if (b.reason === 'split') txt = `${AREAS[g.a].lbl} ما ${fem(g.a) ? 'لها' : 'له'} يوم بنظامك، فما ${fem(g.a) ? 'كمّلناها' : 'كمّلناه'}. تقدر تضيف يوم من «نظامك».`
    else txt = still + (b.reason === 'time' ? 'ما بقى وقت بالجلسات. زد يوم بالأسبوع من الأساسيات.' : b.need.length ? `ما نقدر نكمّله بأدواتك، يحتاج ${b.need.map(q => EQ[q].one).join(' أو ')}.` : 'ما عندنا تمرين له بأدواتك.')
    const host = auto ? row : ($('.g-body', row) || row)
    const more = best && unlock[best] > 1 ? ` <small>(يفتح ${unlock[best]} عضلات)</small>` : ''
    host.insertAdjacentHTML('beforeend', `<div class="need"><span>${txt}</span>${pill ? `<button class="pill" data-act="have" data-v="${best}">${ic('plus', 14)} عندي ${EQ[best].ar}${more}</button>` : ''}</div>`)
  }
  const adds = res.steps.filter(s => s.kind === 'add').length, bumps = res.steps.length - adds
  $('#fill-sum').innerHTML = res.steps.length
    ? (auto ? `سوّينا ${exWord(adds)} على ${S.plan.days.length === 2 ? 'يومين' : S.plan.days.length + ' أيام'} بالدور.` : `أضفنا ${exWord(adds)}${bumps ? ` وزدنا ${bumps === 1 ? 'مجموعة' : bumps === 2 ? 'مجموعتين' : bumps + ' مجموعات'}` : ''}. ما لمسنا اختياراتك الـ${S.picks.length}.`)
    : 'ما قدرنا نضيف شي بأدواتك.'
  dock.innerHTML = `<button class="btn-primary" data-act="to-plan">شوف خطتك ${ic('fwd', 18)}</button>${auto ? `<button class="btn-quiet" data-act="back">غيّر الأساسيات</button>` : `<button class="btn-quiet" data-act="unfill">رجّع زي ما كان</button>`}`
}
function revealFill() {
  if (RM) return
  let i = 0
  $$('#gaps > li.done, #gaps .added:not([hidden]), #gaps .athumbs .tt').forEach(el => { if (visible(el, 0)) land(el, 40 * i++) })
  const b = $('#gaps-dock .btn-primary'); b && b.animate([{ transform: 'scale(.9)' }, { transform: 'none' }], { duration: 520, delay: 200, easing: LAND, fill: 'backwards' })
}
function instantFill() { const res = fill(S.plan, cfg()); S.filled = true; renderFillResult(res); return res }
async function runFill() {
  if (S.busy) return
  S.busy = true
  const gen = ++GEN
  const pre = new Set(S.plan.days.flatMap(d => d.items.map(it => it.uid)))
  const kind = S.mode === 'auto' ? 'auto' : 'fill'
  const res = fill(S.plan, cfg()); S.filled = true
  const show = playBuild({ plan: S.plan, pre, kind })
  renderFillResult(res)
  $('#gaps-scroll') && $('#gaps-scroll').scrollTo({ top: 0 })
  await show
  if (gen !== GEN) return
  revealFill()
  S.busy = false
  updateRail()
  if (!res.steps.length) toast('ما قدرنا نضيف شي بأدواتك')
}
/* «خلصت»: his own picks fly into his days first, then «وش ناقص» */
async function deckDone() {
  if (S.busy) return
  S.busy = true
  const plan = buildFromPicks(cfg())
  if (!plan.days.some(d => d.items.length)) { S.busy = false; return go('gaps') }
  S.plan = plan; S.filled = false; S._keep = true
  const show = playBuild({ plan, kind: 'picks' })
  go('gaps', { instant: true })   // ENTER.gaps keeps the same plan
  S.busy = true
  await show
  S.busy = false
  if (!RM) $$('#gaps > li').forEach((li, i) => li.animate([{ opacity: 0, transform: 'translateX(-26px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: i * 60, easing: 'cubic-bezier(.2,0,0,1)', fill: 'backwards' }))
}

/* ══ 5 · plan ══ */
ENTER.plan = function () {
  if (!S.plan) S.plan = buildFromPicks(cfg())
  S.day = Math.min(S.day, S.plan.days.length - 1); S.open = null
  $('#s-plan').innerHTML = `
  <div class="scroll" id="plan-scroll">
    ${topbar(4)}
    <h2 class="title">خطتك</h2>
    <div class="plan-meta" id="plan-meta"></div>
    <div class="daytabs" role="tablist" id="daytabs"></div>
    <div class="dayview" id="dayview"></div>
    <div id="plan-warn"></div>
    <div id="plan-adv"></div>
  </div>
  <div class="dock"><button class="btn-primary" data-act="plan-start">${S.mode === 'current' ? 'احفظ التعديل' : 'ابدأ الخطة'}</button></div>`
  refreshPlan(); renderDay()
}
const flagOf = (m) => m > LONG ? 'طويل' : m < 30 ? 'خفيف' : ''
const daySig = (plan) => plan ? plan.days.map(d => d.type).join() : ''
function refreshPlan() {
  S.daySig = daySig(S.plan)
  const cov = coverage(S.plan, S.goal), L = dayLabels(S.plan)
  const appN = S.plan.days.reduce((s, d) => s + d.items.filter(it => it.by === 'app').length, 0)
  $('#plan-meta').innerHTML = `<span><b>${S.days}</b> أيام بالأسبوع</span><span>${S.plan.days.length === 2 ? 'يومين' : `<b>${S.plan.days.length}</b> أيام`} بالدور</span><span>مغطاة <b>${cov.n}</b> من <b>${cov.of}</b></span>${appN ? `<span>${inl(ic('spark', 11))} <b>${appN}</b> أضافها التطبيق</span>` : ''}`
  $('#daytabs').innerHTML = S.plan.days.map((d, i) => { const m = Math.round(dayMinutes(d)), f = flagOf(m); return `<button class="dtab" role="tab" aria-selected="${i === S.day}" data-act="day" data-v="${i}"><b>${L[i].ar}${L[i].v ? `<sup>${L[i].v}</sup>` : ''}</b><span>${m} د${f ? ` · <em>${f}</em>` : ''}</span></button>` }).join('')
  const { gaps } = findGaps(S.plan, S.goal)
  const miss = [...new Set(gaps.slice(0, 3).map(g => AREAS[g.a].lbl))].join('، ')
  $('#plan-warn').innerHTML = gaps.length ? `<div class="warn"><span>${S.filled ? 'صار ناقص' : 'ناقصها'}: ${miss}</span><button class="pill" data-act="refill">${ic('spark', 13)} كمّل خطتي</button></div>` : ''
  renderAdvice('plan')
  updateRail()
}
function setsBlock(it) { return `<b>${setsLbl(it)}</b><small>${setsCap(it)}</small>` }
const REPS = [[3, 5], [4, 6], [5, 8], [6, 10], [8, 12], [10, 12], [10, 15], [12, 15], [12, 20], [15, 20], [15, 25]]
const SECS = [[20, 30], [30, 45], [45, 60], [60, 90]]
const RESTS = [30, 45, 60, 75, 90, 120, 150, 180, 240]
function stepList(list, cur, dir) {
  const key = (x) => Array.isArray(x) ? x[0] * 100 + x[1] : x, k = key(cur)
  let i = list.findIndex(x => key(x) >= k)
  if (i < 0) i = list.length
  const exact = i < list.length && key(list[i]) === k
  const j = dir > 0 ? (exact ? i + 1 : i) : i - 1
  return list[Math.max(0, Math.min(list.length - 1, j))]
}
function editHTML(it) {
  return `<div class="pr-edit">
    ${it.mins ? `<div class="pr-meta2">جلسة كارديو 20 دقيقة بعد التمرين</div>` : `<div class="stepper"><button data-act="sets-dec" aria-label="مجموعة أقل" ${it.sets <= 1 ? 'disabled' : ''}>${ic('minus', 20)}</button><span class="sv"><b class="num">${it.sets}</b>${it.sets === 1 ? 'مجموعة' : 'مجموعات'}</span><button data-act="sets-inc" aria-label="مجموعة زيادة" ${it.sets >= 6 ? 'disabled' : ''}>${ic('plus', 20)}</button></div>
    <div class="tunes">
      <div class="tune"><span class="tl">${it.unit === 'sec' ? 'الثواني' : 'العدّات'}</span><div class="tc"><button data-act="reps" data-v="-1" aria-label="أقل">${ic('minus', 16)}</button><b class="num"><bdi dir="ltr">${rng(it)}</bdi></b><button data-act="reps" data-v="1" aria-label="أكثر">${ic('plus', 16)}</button></div></div>
      <div class="tune"><span class="tl">الراحة</span><div class="tc"><button data-act="rest" data-v="-1" aria-label="راحة أقل">${ic('minus', 16)}</button><b class="num">${restLbl(it.rest)}</b><button data-act="rest" data-v="1" aria-label="راحة أكثر">${ic('plus', 16)}</button></div></div>
    </div>
    <div class="pr-meta2">الجلسة تمشي على هذي الأرقام</div>`}
    <div class="pr-btns"><button data-act="swap">${ic('swap', 16)} بدّله</button><button data-act="rm">${ic('x', 16)} شيله</button></div></div>`
}
/* «بالتناوب» (src/plan/rotate.js): a row that takes turns with others says
   so under its name; the builder keeps the list (builder.js rotateFor) —
   «خطتي» is where the turns are edited. */
function rotateLine(it) {
  const rest = Array.isArray(it.rotate) && it.rotate.length > 1 ? it.rotate.slice(1) : null
  if (!rest) return ''
  const arOf = (n) => { const x = entryForName(n); return (x && !x.foreign && x.ar) || n }
  return `<div class="pr-why pr-rot" data-testid="builder-rotate">${inl(ic('loop', 12))} بالتناوب مع ${rest.map(n => esc(arOf(n))).join(' و')}</div>`
}
function rowHTML(it) {
  const e = EXI[it.id], open = S.open === it.uid
  return `<li class="prow ${it.by} ${open ? 'open' : ''}" data-uid="${it.uid}" data-act="row">
    <button class="grip" data-grip aria-label="اسحب عشان ترتّب ${e.ar}">${ic('grip', 18)}</button>
    <span class="pr-img"><img src="${IMG['ex_' + it.id]}" alt=""></span>
    <div class="pr-main">
      <div class="pr-top"><b class="pr-ar">${e.ar}</b><span class="pr-sets">${setsBlock(it)}</span></div>
      ${it.by === 'app' ? `<div class="pr-badge"><span class="badge">${ic('spark', 11)} أضافه التطبيق</span></div>${it.why ? `<div class="pr-why">${it.why}</div>` : ''}` : ''}
      ${it.bumpWhy ? `<div class="pr-why">${it.bumpWhy}</div>` : ''}
      ${rotateLine(it)}
      <button class="sr" data-act="row" aria-expanded="${open}">${open ? 'سكّر' : 'عدّل'} ${e.ar}</button>
    </div>
    ${open ? editHTML(it) : ''}</li>`
}
function dayHeadHTML(d, L) {
  const m = Math.round(dayMinutes(d)), f = flagOf(m)
  return `<div class="dhead"><div class="dh-t"><div class="dw">${L.ar}${L.v ? `<sup>${L.v}</sup>` : ''}</div><div class="dm">${dayMuscles(d).join('، ') || 'ولا تمرين'}</div><div class="dx"><span class="num">${d.items.length}</span> تمارين · ≈ <span class="num">${m}</span> د</div>
    ${f === 'طويل' ? `<span class="dflag">${ic('clock', 14)} يوم طويل، انقل تمرين ليوم ثاني</span>` : f === 'خفيف' ? `<span class="dflag">${ic('clock', 14)} يوم خفيف، تقدر تضيف تمرين</span>` : ''}</div>
    <div class="dmini" role="img" aria-label="العضلات اللي يشغّلها يوم ${L.ar}">${bodySVG()}</div></div>`
}
function renderDay(dir = 0) {
  const d = S.plan.days[S.day], L = dayLabels(S.plan)[S.day], v = $('#dayview')
  const cards = CARDS.filter(c => c.id === 'core' || c.id === 'cardio' || c.areas.some(a => allowed(d.type, a)))
  v.innerHTML = `${dayHeadHTML(d, L)}
    <ol class="plist" id="plist">${d.items.map(rowHTML).join('')}</ol>
    <div class="addday"><h4>أضف تمرين لهذا اليوم</h4><div class="pills">${cards.map(c => `<button class="pill" data-act="add-day" data-v="${c.id}">${c.ar}</button>`).join('')}</div></div>
    <p class="phint">اضغط التمرين تعدّله · اسحب ${inl(ic('grip', 12))} عشان ترتّب · اسحب يمين ويسار تتنقل بين الأيام</p>`
  paintBody($('.dmini svg', v), dayStates(d))
  if (dir && !RM) {
    v.animate([{ transform: `translateX(${dir * -40}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,0,0,1)' })
    $$('.prow', v).forEach((r, i) => r.animate([{ transform: `translateX(${dir * -24}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, delay: 40 + i * 35, easing: 'cubic-bezier(.2,0,0,1)', fill: 'backwards' }))
  }
}
function refreshDayHead() {
  const d = S.plan.days[S.day], L = dayLabels(S.plan)[S.day], h = $('#dayview .dhead'); if (!h) return
  const tmp = document.createElement('div'); tmp.innerHTML = dayHeadHTML(d, L)
  h.replaceWith(tmp.firstElementChild)
  paintBody($('#dayview .dmini svg'), dayStates(d))
}
function setDay(i) {
  if (i < 0 || i >= S.plan.days.length || i === S.day) return
  const dir = i > S.day ? 1 : -1
  S.day = i; S.open = null
  $$('#daytabs .dtab').forEach((t, j) => t.setAttribute('aria-selected', j === i))
  const tab = $$('#daytabs .dtab')[i]; tab && tab.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: RM ? 'auto' : 'smooth' })
  renderDay(dir)
}
const findItem = (uid) => { for (const [di, d] of S.plan.days.entries()) { const ii = d.items.findIndex(x => x.uid === uid); if (ii >= 0) return { d, di, ii, it: d.items[ii] } } return null }
function toggleRow(uid) {
  const was = S.open
  S.open = was === uid ? null : uid
  renderDay(); refreshPlan()
  const li = $(`.prow[data-uid="${uid}"]`)
  if (S.open && li && !RM) { const ed = $('.pr-edit', li); ed && ed.animate([{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.2,0,0,1)' }) }
  if (S.open && li) { const sc = $('#plan-scroll'), r = lr(li); if (r.y + r.h > SCREEN.clientHeight - 120) sc.scrollBy({ top: r.y + r.h - SCREEN.clientHeight + 150, behavior: RM ? 'auto' : 'smooth' }) }
}
function removeItem(uid, { exclude = false } = {}) {
  const f = findItem(uid); if (!f) return
  const name = EXI[f.it.id].ar
  if (exclude) S.excluded.add(f.it.id)
  f.d.items.splice(f.ii, 1); S.open = null
  // The row leaves its pick too, whoever added it, or going back a screen
  // (which builds the plan again from the picks) would quietly bring it
  // back: his plan opened to edit has the app's rows as picks as well.
  const pk = pickFor(f.it), pkIdx = pk ? S.picks.indexOf(pk) : -1
  if (pkIdx >= 0) S.picks.splice(pkIdx, 1)
  const li = $(`.prow[data-uid="${uid}"]`)
  const done = () => { renderDay(); refreshPlan() }
  if (!li || RM) done()
  else {
    const h = li.offsetHeight
    li.animate([{ height: h + 'px', opacity: 1, transform: 'none' }, { height: '0px', opacity: 0, transform: 'translateX(-40px) scale(.96)', paddingTop: '0px', paddingBottom: '0px', marginBottom: '-8px' }], { duration: 320, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).onfinish = done
  }
  toast(exclude ? `شلنا ${name}، وما راح نقترحه لك مرة ثانية` : `شلنا ${name}`, { label: 'تراجع', run: () => {
    // only into the plan it left, and only once
    if (!S.plan || !S.plan.days.includes(f.d) || findItem(uid)) return
    if (exclude) S.excluded.delete(f.it.id)
    if (pk && !S.picks.includes(pk)) S.picks.splice(Math.min(Math.max(0, pkIdx), S.picks.length), 0, pk)
    f.d.items.splice(Math.min(f.ii, f.d.items.length), 0, f.it)
    if (S.day !== f.di) { S.day = f.di; refreshPlan() }
    renderDay(); refreshPlan(); land($(`.prow[data-uid="${uid}"]`))
  } })
}

/* reorder with the grip */
let drag = null
on(HOST, 'pointerdown', (e) => {
  const g = e.target.closest('#plist [data-grip]'); if (!g) return
  e.preventDefault()
  const li = g.closest('.prow'), list = $('#plist'), rows = $$('.prow', list)
  drag = { li, rows, idx: rows.indexOf(li), to: rows.indexOf(li), y0: e.clientY, id: e.pointerId, h: li.offsetHeight + 8, mids: rows.map(r => r.offsetTop + r.offsetHeight / 2), moved: false }
  try { g.setPointerCapture(e.pointerId) } catch (er) { /* fine */ }
  li.classList.add('lifted'); buzz(6)
  rows.forEach(r => { if (r !== li) r.style.transition = 'transform .28s cubic-bezier(.2,0,0,1)' })
})
on(document, 'pointermove', (e) => {
  const s = drag; if (!s || e.pointerId !== s.id) return
  const dy = (e.clientY - s.y0) / K
  if (Math.abs(dy) > 3) s.moved = true
  s.li.style.transform = `translateY(${dy}px) scale(1.02)`
  const mid = s.mids[s.idx] + dy
  let to = 0
  s.mids.forEach((m, i) => { if (i !== s.idx && mid > m) to++ })
  if (to !== s.to) { s.to = to; buzz(3) }
  s.rows.forEach((r, i) => {
    if (r === s.li) return
    let t = 0
    if (s.idx < to && i > s.idx && i <= to) t = -s.h
    if (s.idx > to && i < s.idx && i >= to) t = s.h
    r.style.transform = t ? `translateY(${t}px)` : ''
  })
})
function endDrag(e) {
  const s = drag; if (!s || e.pointerId !== s.id) return
  drag = null; suppress = performance.now()
  const before = lr(s.li), uid = s.li.dataset.uid
  const d = S.plan.days[S.day]
  const it = d.items.splice(s.idx, 1)[0]; d.items.splice(s.to, 0, it)
  if (s.to !== s.idx) d.manual = true
  renderDay()
  const nli = $(`.prow[data-uid="${uid}"]`)
  if (nli && !RM) { const after = lr(nli); nli.animate([{ transform: `translateY(${before.y - after.y}px) scale(1.02)` }, { transform: 'none' }], { duration: 420, easing: 'linear(0, 0.133, 0.403, 0.675, 0.883, 1.012, 1.071, 1.083, 1.069, 1.046, 1.024, 1.008, 0.998, 0.994, 0.994, 1)' }) }
  if (s.to !== s.idx) toast('رتّبناها')
}
on(document, 'pointerup', endDrag)
on(document, 'pointercancel', endDrag)

/* day swipe on the plan */
let dsw = null
on(HOST, 'pointerdown', (e) => {
  const v = e.target.closest('#dayview'); if (!v || e.target.closest('[data-grip]') || e.target.closest('button') || e.target.closest('.pr-edit')) return
  dsw = { x0: e.clientX, y0: e.clientY, id: e.pointerId }
})
on(document, 'pointerup', (e) => {
  const s = dsw; dsw = null; if (!s || e.pointerId !== s.id) return
  const dx = (e.clientX - s.x0) / K, dy = (e.clientY - s.y0) / K
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { suppress = performance.now(); setDay(S.day + (dx > 0 ? 1 : -1)) }
})

/* sheets: opening one dismisses any toast */
function openSheet(html) {
  closeSheet(true); clearToasts()
  const w = document.createElement('div'); w.className = 'sheet-wrap'; w.id = 'sheet'
  w.innerHTML = `<div class="sheet-scrim" data-act="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true">${html}</div>`
  SCREEN.appendChild(w)
  if (!RM) {
    $('.sheet-scrim', w).animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 })
    $('.sheet', w).animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 440, easing: 'cubic-bezier(.32,.72,0,1)' })
  }
  later(() => { const f = $('.sheet button', w); f && f.focus({ preventScroll: true }) }, 50)
}
function closeSheet(now) {
  const w = $('#sheet'); if (!w) return
  if (now || RM) return w.remove()
  w.id = ''
  $('.sheet-scrim', w).animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' })
  $('.sheet', w).animate([{ transform: 'none' }, { transform: 'translateY(100%)' }], { duration: 300, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }).onfinish = () => w.remove()
}
function swapSheet(uid) {
  const f = findItem(uid); if (!f) return
  const e = EXI[f.it.id], alts = alternatives(S.plan, cfg(), f.it), L = dayLabels(S.plan)
  const days = S.plan.days.map((d, i) => ({ d, i })).filter(x => x.i !== f.di && allowed(x.d.type, e.area))
  openSheet(`<div class="grab"></div>
    <div class="sh-h"><span class="pr-img"><img src="${IMG['ex_' + e.id]}" alt=""></span><div><div class="eyebrow">بدّل التمرين</div><b>${e.ar}</b></div></div>
    <h4>بدائل لنفس العضلة وبأدواتك</h4>
    ${alts.length ? `<div class="alts">${alts.map(x => `<button class="alt" data-act="alt" data-v="${x.id}" data-uid="${uid}"><span class="pr-img"><img src="${IMG['ex_' + x.id]}" alt=""></span><span><b>${x.ar}</b><small>${EQ[x.eq].one} · ${KIND[x.k]}${x.mv !== e.mv ? ' · حركة ثانية' : ''}</small></span>${ic('swap', 18)}</button>`).join('')}</div>` : `<div class="empty">ما فيه بديل له بأدواتك.</div>`}
    ${days.length ? `<h4>أو انقله ليوم ثاني</h4><div class="pills">${days.map(x => `<button class="pill" data-act="move" data-v="${x.i}" data-uid="${uid}">${dayName(L[x.i])} · ${Math.round(dayMinutes(x.d))} د</button>`).join('')}</div>` : ''}
    <div class="sh-acts">${f.it.by === 'app' ? `<button class="btn-ghost" data-act="never" data-uid="${uid}">شيله، ولا تقترحه لي مرة ثانية</button>` : ''}<button class="btn-quiet" data-act="close-sheet" style="width:100%">ارجع</button></div>`)
}
/* «أضف تمرين لهذا اليوم»: the same cards, the same swipe */
let ADDING = null
function addSheet(cid) {
  const d = S.plan.days[S.day], L = dayLabels(S.plan)[S.day], c = CARD[cid]
  ADDING = cid
  const list = EX.filter(e => e.card === cid && S.eq.has(e.eq))
  openSheet(`<div class="grab"></div><div class="eyebrow">أضف ليوم ${dayName(L)}</div><h3 class="sh-title">${c.ar}</h3>
    <p class="sh-hint">${inl(ic('hand', 15))} اسحب التمرين يمين أو يسار عشان تضيفه لهذا اليوم</p>
    ${list.length ? `<div class="xlist">${list.map(e => xcardHTML(e, { on: d.items.some(it => it.id === e.id) })).join('')}</div>` : `<div class="empty">ما فيه تمارين ${c.ar} بأدواتك.</div>`}
    <div class="sh-acts"><button class="btn-quiet" data-act="close-sheet" style="width:100%">تم</button></div>`)
}
function dayPick(id, cardEl) {
  const d = S.plan.days[S.day], L = dayLabels(S.plan)[S.day]
  const i = d.items.findIndex(it => it.id === id)
  if (i < 0) {
    // its own pick on this day, even when the same exercise is on another
    // day too, so going back a screen keeps both
    const it = mkItem(cfg(), id, 'user'), p = { id, day: S.day }; linkPick(it, p); d.items.push(it); sortDay(d)
    S.picks.push(p)
    restyleX(cardEl, id, true); cardEl.classList.add('just'); later(() => cardEl.classList.remove('just'), 700)
    buzz(12); snd('tick', { gain: 0.45, rate: 1.1 }); toast(`أضفنا ${EXI[id].ar} ليوم ${dayName(L)}`)
  } else {
    const pk = pickFor(d.items[i]); d.items.splice(i, 1); const pi = S.picks.indexOf(pk); if (pi >= 0) S.picks.splice(pi, 1)
    restyleX(cardEl, id, false); buzz(6); toast(`شلنا ${EXI[id].ar} من يوم ${dayName(L)}`)
  }
  renderDay(); refreshPlan()
}

/* ══ 6 · done ══ */
ENTER.done = function () {
  const d = S.plan.days[0], L = dayLabels(S.plan)[0], first = d.items[0] ? EXI[d.items[0].id] : null
  const art = first ? CARD[first.card].img : 'm_chest'
  $('#s-done').innerHTML = `
  <div class="scroll">
    <div class="topbar"><button class="icon-btn" data-act="close" aria-label="إغلاق">${ic('x', 18)}</button></div>
    <div class="done-mark"><svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
    <h2 class="title" style="font-size:40px">${S.mode === 'current' ? 'انحفظ التعديل' : 'خطتك شغّالة'}</h2>
    <p class="sub">${S.mode === 'current' ? 'نفس خطتك ونفس اليوم اللي وصلت له.' : 'تبدأ من اليوم الأول.'} هذا شكل الرئيسية في يوم تمرينك الجاي:</p>
    <div class="stage"><img class="st-art" src="${IMG[art]}" alt=""><div class="st-txt"><div class="eyebrow">اليوم</div><div class="st-word">${L.ar}${L.v ? `<sup style="font-size:.4em">${L.v}</sup>` : ''}</div><div class="st-m">${dayMuscles(d).join('، ')}</div><div class="st-x"><span class="num">${d.items.length}</span> تمارين · ≈ <span class="num">${Math.round(dayMinutes(d))}</span> د</div></div></div>
    <div class="st-rows">${d.items.slice(0, 3).map(it => `<div class="st-row"><span class="pr-img"><img src="${IMG['ex_' + it.id]}" alt=""></span><div><b>${EXI[it.id].ar}</b><span class="st-sr">${it.mins ? 'جلسة 20 دقيقة' : `<span class="ltr">${it.sets} × ${rng(it)}</span>${it.unit === 'sec' ? ' ثانية' : ' عدّة'} · راحة ${restLbl(it.rest)}`}</span></div></div>`).join('')}</div>
    ${PREV ? `<button class="row-link prev-row" data-act="restore-prev"><span class="rl-thumb">${ic('undo', 20)}</span><span class="rl-t">خطتك القديمة محفوظة<small>${PREV.name} · ترجع لها بضغطة</small></span>${ic('chev', 18)}</button>` : ''}
  </div>
  <div class="dock"><button class="btn-primary" data-act="start-workout">ابدأ التمرين</button></div>`
}

function updateRail() { /* the prototype's guide beside the phone; nothing to update in the app */ }
/* «عدّل خطتك الحالية»: his plan as it is, on its own days, in his order. */
function loadCurrent() {
  if (!CURRENT) return false
  S.mode = 'current'; S.days = SETTINGS.days; S.goal = CURRENT.goal; S.eq = new Set(CURRENT.eq)
  S.split = CURRENT.split; S.cycle = CURRENT.split === 'free' ? CURRENT.cycle.slice() : null
  S.excluded = new Set(CURRENT.excluded); S.dismissed = new Set(CURRENT.dismissed)
  for (const [k, v] of Object.entries(CURRENT.mtool || {})) if (!MT[k] || !MT[k].size) MT[k] = new Set(v)
  S.picks = CURRENT.picks.map(p => ({ ...p, r: p.r ? [...p.r] : undefined }))
  return true
}
const SPLIT_TOAST = (id) => id === 'free' ? `نظامك: ${cycleOf().map(t => TYPE[t].ar).join(' · ')}` : SPL[id].ar
const curToast = () => `حمّلنا خطتك: ${exWord(CURRENT.picks.length)}، ${SPLIT_TOAST(S.split)} على ${S.days} أيام`
/* «سوّ خطتي»: straight into the build */
async function autoBuild() {
  S.plan = buildFromPicks(cfg()); S.filled = false; S._keep = true
  go('gaps', { instant: S.cur !== 'gaps' })
  await runFill()
}
/* The five doors (حمزة: «صفحة لحالها بخمس أبواب»). Settings, the first run
   and Home with no plan open on «البداية»; Home's «خطتي», «⋯ › عدّل الخطة»
   and «عدّل» in Settings open his plan by days, on today's day; «خطتي»'s
   «عدّل الخطة كاملة» (door 'view') on the day he was looking at (ctx.day). */
function open(v) {
  S.entry = v
  if ((v === 'progress' || v === 'more' || v === 'edit' || v === 'view') && loadCurrent()) {
    S.plan = buildFromPicks(cfg()); S.filled = false
    const n = S.plan.days.length
    const at = Number.isInteger(ctx.day) ? ctx.day : (ctx.planIndex || 0)
    S.day = n ? (at % n + n) % n : 0
    go('plan', { instant: true })
    return
  }
  go('start', { instant: true })
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
/* The streak rule, said before it is paid: switching to another plan (or
   changing the days) is free once a month; editing his plan is free. */
/* His first plan is a setup, not a switch (App's commitPlan): no rule,
   no old plan to keep. COOLDOWN follows this page's own activation, so
   what a sheet says after it is what App will do. */
const FIRST = !(ctx.plan && Array.isArray(ctx.plan.weeklySchedule) && ctx.plan.weeklySchedule.length)
let COOLDOWN = Number(ctx.changeCooldownLeft) || 0
const cooldown = () => COOLDOWN
const breaksFor = (edit, daysChange) => !FIRST && cooldown() > 0 && (!edit || daysChange)
/* an undo the same day puts everything back (App's restorePrevPlan) */
const prevSameDay = () => !!PREV && PREV.when === 'اليوم'
const streakWord = () => (ctx.currentStreak || 0) > 0 ? ` (${countAr(ctx.currentStreak, 'day')})` : ''
function ruleFact(edit, daysChange) {
  if (FIRST) return ''
  if (edit && !daysChange) return `<li><b>التعديل ببلاش</b><span>تعدّل خطتك نفسها متى ما تبي، وما يلمس الستريك.</span></li>`
  if (breaksFor(edit, daysChange)) return `<li class="danger"><b>${edit ? 'تغيير الأيام' : 'التبديل'} الحين يكسر الستريك</b><span>بدّلت قبل أقل من 30 يوم، فالستريك${streakWord()} يبدأ من الصفر. التغيير المجاني الجاي بعد ${countAr(cooldown(), 'day')}.</span></li>`
  return `<li><b>${edit ? 'تغيير الأيام' : 'تبديل الخطة'} بالقاعدة</b><span>أول تغيير بالشهر ببلاش: الستريك${streakWord()} ما يتأثر. لو غيّرت مرة ثانية خلال 30 يوم ينكسر.</span></li>`
}
let closing = false
function close() {
  if (closing) return
  closing = true
  clearToasts()
  const done = () => ctx.onClose && ctx.onClose()
  if (RM) return done()
  const a = SCREEN.animate([{ transform: 'none' }, { transform: 'translateY(100%)' }], { duration: 320, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' })
  a.onfinish = done
}

/* ── one click handler for the whole prototype ── */
on(HOST, 'click', (e) => {
  const el = e.target.closest('[data-act]')
  const xcard = e.target.closest('#mview .xcard:not(.locked), #sheet .xcard:not(.locked)')
  if (xcard && (!el || el.dataset.act === 'pick')) {
    if (performance.now() - suppress < 350) return
    if (el && el.dataset.act === 'pick' && e.detail === 0) return xcard.closest('#sheet') ? dayPick(xcard.dataset.id, xcard) : togglePick(xcard.dataset.id, xcard)
    return tapHint(xcard)
  }
  if (!el) return
  const act = el.dataset.act, v = el.dataset.v
  const rowUid = () => el.closest('.prow') && el.closest('.prow').dataset.uid
  switch (act) {
    case 'close': return close()
    case 'start-workout': return ctx.onStart && ctx.onStart()
    case 'back': return goBack()
    case 'start-build': if (S.mode !== 'build') { S.picks = []; S.split = null; S.daySig = '' } S.mode = 'build'; return go('basics')
    case 'start-auto': if (S.mode !== 'auto') S.split = null; S.mode = 'auto'; S.picks = []; S.daySig = ''; return go('basics')
    case 'start-current': if (!loadCurrent()) return; go('deck'); later(() => toast(curToast()), RM ? 0 : 480); return
    case 'restore-prev': {
      if (!PREV) return
      // an undo the same day is free; later it is a switch like any other
      const sameDay = prevSameDay()
      return openSheet(`<div class="grab"></div><h3 class="sh-title">نرجّع خطتك القديمة؟</h3>
        <ul class="facts">
          <li><b><bdi>${esc(PREV.name)}</bdi></b><span>ترجع من اليوم اللي وصلت له فيها، وخطتك الحالية تنحفظ مكانها عشان ترجع لها لو بغيت.</span></li>
          ${sameDay ? `<li><b>ببلاش</b><span>${PREV.undo ? 'بدّلتها اليوم، فالرجوع يلغي التبديل كأنه ما صار: ما يحسب تغيير، والستريك يرجع زي ما كان.' : 'بدّلتها اليوم، فالرجوع ما يحسب تغيير.'}</span></li>` : ruleFact(false, false)}
        </ul>
        <div class="sh-foot">
          <button class="btn-primary" data-act="restore-yes">رجّعها</button>
          <button class="btn-quiet" data-act="close-sheet" style="width:100%">ارجع</button>
        </div>`)
    }
    case 'restore-yes': {
      const sameDay = prevSameDay()
      closeSheet(true); buzz(10)
      ctx.onRestorePrev && ctx.onRestorePrev({ breakStreak: !sameDay && breaksFor(false, false) })
      return close()
    }
    case 'days': {
      S.days = +v
      const opts = splitOpts(S.days)
      if (S.split && !opts.includes(S.split)) S.split = S.split === 'ppl' ? (opts.includes('ppl2') ? 'ppl2' : null) : S.split === 'ppl2' ? 'ppl' : null
      $$('#s-basics [data-act="days"]').forEach(b => b.setAttribute('aria-checked', b.dataset.v === v))
      $('#days-from').textContent = daysFrom()
      renderSplits(true); return
    }
    case 'split': setSplit(v); renderSplits(true); buzz(6); return
    case 'free-n': {
      const c = cycleOf(), n = Math.max(1, Math.min(7, c.length + +v))
      if (n > c.length) c.push(SPL[splitOpts(S.days)[0]].cycle[c.length % SPL[splitOpts(S.days)[0]].cycle.length] || 'full'); else c.length = n
      S.cycle = c; keepFittingPins(); renderSplits(); return
    }
    case 'free-day': return freeTypeSheet(+v)
    case 'free-type': { const c = cycleOf(); c[+el.dataset.i] = v; S.cycle = c; keepFittingPins(); closeSheet(); renderSplits(); buzz(6); return }
    case 'tools-more': {
      S.toolsOpen = !S.toolsOpen; const t = $('#tiles'); t.hidden = !S.toolsOpen
      el.setAttribute('aria-expanded', S.toolsOpen); el.innerHTML = `أخصّصها ${ic(S.toolsOpen ? 'minus' : 'plus', 14)}`
      if (S.toolsOpen && !RM) $$('.tile', t).forEach((x, i) => x.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: i * 30, easing: 'cubic-bezier(.2,0,0,1)', fill: 'backwards' }))
      return
    }
    case 'preset': return setEq(PRESETS.find(p => p.id === v).eq)
    case 'eq': {
      if (v === 'body') { toast('وزن الجسم دايم معك'); return }
      const on = !S.eq.has(v); if (on) S.eq.add(v); else S.eq.delete(v)
      el.classList.toggle('on', on); el.setAttribute('aria-pressed', on); buzz(6); markPreset(); return
    }
    case 'goal': S.goal = v; $$('#s-basics [data-act="goal"]').forEach(b => b.setAttribute('aria-checked', b.dataset.v === v)); return
    case 'basics-next': {
      const drop = S.picks.filter(p => !S.eq.has(EXI[p.id].eq)).length
      S.picks = S.picks.filter(p => S.eq.has(EXI[p.id].eq))
      if (drop) later(() => toast(`شلنا ${exWord(drop)} من اختياراتك تحتاج أدوات ما اخترتها`), 500)
      if (S.mode === 'auto') return autoBuild()
      return go('deck')
    }
    case 'to-basics': return go('basics', { back: true })
    case 'open-card': return openMuscle(el.dataset.card, el)
    case 'mv-close': return closeMuscle()
    case 'mtool': {
      const c = CARD[S.card], sel = selOf(c.id)
      if (v === 'all') sel.clear(); else if (sel.has(v)) sel.delete(v); else sel.add(v)
      RESTORED = null; saveMT()
      $$('#mview [data-act="mtool"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === 'all' ? !sel.size : sel.has(b.dataset.v)))
      const nt = $('#mt-note'); nt.textContent = mtNote(c); nt.hidden = !sel.size
      const list = $('#mview .mv-list'); list.innerHTML = mvListHTML(c); buzz(5)
      const sc = $('#mview .mv-scroll'), mt = $('#mview .mtools'); if (sc && mt && sc.scrollTop > mt.offsetTop) sc.scrollTo({ top: mt.offsetTop, behavior: RM ? 'auto' : 'smooth' })
      if (!RM) $$('.xcard, .empty', list).slice(0, 6).forEach((x, i) => x.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: i * 40, easing: 'cubic-bezier(.2,0,0,1)', fill: 'backwards' }))
      return
    }
    case 'have-mv': {
      S.eq.add(v); const mv = $('#mview'), list = $('.mv-list', mv)
      const tools = $('.mtools', mv); if (tools) tools.outerHTML = mtoolsHTML(CARD[S.card]); else { const at = $('#sw-hint', mv) || list; at.insertAdjacentHTML('beforebegin', mtoolsHTML(CARD[S.card])) }
      list.innerHTML = mvListHTML(CARD[S.card])
      $$('.xcard', list).forEach(c => { if (EXI[c.dataset.id].eq === v) c.classList.add('unlocked') })
      updateMview(); toast(`فعّلنا ${EQ[v].ar} لأدواتك`); buzz(10)
      const first = $$('.xcard.unlocked', list)[0]; first && first.scrollIntoView({ block: 'center', behavior: RM ? 'auto' : 'smooth' })
      return
    }
    case 'much-yes': return applyMuch(el.dataset.a, el.dataset.ctx || adviceCtx())
    case 'much-no': { S.dismissed.add('much:' + el.dataset.a); const b = $('#mfix'); if (b) { b.dataset.sig = ''; b.innerHTML = '' } toast('خلّيناها كذا. ما نذكّرك فيها بهالخطة'); return }
    case 'tip-yes': return applyTip(el.dataset.key, adviceCtx())
    case 'tip-no': return dismissTip(el.dataset.key, adviceCtx())
    case 'adv-unfold': { const box = el.closest('#advice, #plan-adv'); box.dataset.open = '1'; renderAdvice(box.id === 'plan-adv' ? 'plan' : 'gaps'); return }
    case 'deck-done': return deckDone()
    case 'why': {
      const w = el.nextElementSibling, open = w.hidden
      w.hidden = !open; el.setAttribute('aria-expanded', open)
      if (open && !RM) w.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.2,0,0,1)' })
      return
    }
    case 'unfold': $$('#gaps .gap.fold').forEach((li, i) => { li.classList.remove('fold'); li.style.setProperty('--i', i) }); el.remove(); return
    case 'fill': return runFill()
    case 'have': {
      S.eq.add(v); toast(`فعّلنا ${EQ[v].ar}، ونكمّل`)
      $$('#gaps .need').forEach(n => n.remove())
      return runFill()
    }
    case 'ad-x': {
      const f = findItem(el.dataset.uid); if (!f || S.busy) return
      const card = el.closest('.added'), name = EXI[f.it.id].ar
      f.d.items.splice(f.ii, 1)
      const hide = () => { card.hidden = true; refreshGaps() }
      if (RM) hide(); else card.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-30px) scale(.95)' }], { duration: 240, easing: 'cubic-bezier(.4,0,1,1)' }).onfinish = hide
      toast(`شلنا ${name}`, { label: 'تراجع', run: () => { f.d.items.splice(Math.min(f.ii, f.d.items.length), 0, f.it); card.hidden = false; land(card); refreshGaps(true) } })
      return
    }
    case 'ad-swap': {
      const f = findItem(el.dataset.uid); if (!f || S.busy) return
      const alt = alternatives(S.plan, cfg(), f.it)[0]
      if (!alt) return toast('ما فيه بديل له بأدواتك')
      const old = EXI[f.it.id].ar
      f.it.id = alt.id
      const card = el.closest('.added')
      $('.ad-img img', card).src = IMG['ex_' + alt.id]; $('.ad-t b', card).textContent = alt.ar
      land(card); refreshGaps(); toast(`بدّلنا ${old} بـ${alt.ar}`); return
    }
    case 'unfill': S.plan = buildFromPicks(cfg()); S.filled = false; ENTER.gaps(); return
    // back a screen and forward again: the same day tab, while the days
    // are the same days
    case 'to-plan': if (daySig(S.plan) !== S.daySig) S.day = 0; return go('plan')
    case 'to-plan-raw': S.plan = buildFromPicks(cfg()); S.filled = false; if (daySig(S.plan) !== S.daySig) S.day = 0; return go('plan')
    case 'day': return setDay(+v)
    case 'row': {
      if (performance.now() - suppress < 350) return
      if (e.target.closest('[data-grip]') || e.target.closest('.pr-edit')) return
      return toggleRow(rowUid())
    }
    case 'sets-inc': case 'sets-dec': {
      const f = findItem(rowUid()); if (!f || f.it.mins) return
      f.it.sets = Math.max(1, Math.min(6, f.it.sets + (act === 'sets-inc' ? 1 : -1)))
      const pk = pickFor(f.it); if (pk) pk.sets = f.it.sets
      const li = el.closest('.prow')
      $('.pr-sets', li).innerHTML = setsBlock(f.it)
      const sv = $('.stepper .sv', li); sv.innerHTML = `<b class="num roll-in">${f.it.sets}</b>${f.it.sets === 1 ? 'مجموعة' : 'مجموعات'}`
      $$('.stepper button', li).forEach(b => { b.disabled = b.dataset.act === 'sets-dec' ? f.it.sets <= 1 : f.it.sets >= 6 })
      buzz(4); refreshDayHead(); refreshPlan(); return
    }
    case 'reps': case 'rest': {
      const f = findItem(rowUid()); if (!f || f.it.mins) return
      // Stepping the reps makes the range his own, from the one shown.
      if (act === 'reps') { f.it.r = [...stepList(f.it.unit === 'sec' ? SECS : REPS, effR(f.it), +v)]; f.it.own = true }
      else f.it.rest = stepList(RESTS, f.it.rest, +v)
      const pk = pickFor(f.it); if (pk) { pk.r = [...f.it.r]; pk.rest = f.it.rest; if (f.it.own) pk.own = true }
      const li = el.closest('.prow'), b = el.parentElement.querySelector('b')
      b.innerHTML = act === 'reps' ? `<bdi dir="ltr">${rng(f.it)}</bdi>` : restLbl(f.it.rest)
      if (!RM) b.animate([{ transform: 'translateY(-6px)', opacity: .3 }, { transform: 'none', opacity: 1 }], { duration: 400, easing: LAND })
      $('.pr-sets', li).innerHTML = setsBlock(f.it)
      buzz(4); refreshDayHead(); refreshPlan(); return
    }
    case 'rm': return removeItem(rowUid())
    case 'swap': return swapSheet(rowUid())
    case 'close-sheet': ADDING = null; return closeSheet()
    case 'alt': {
      const f = findItem(el.dataset.uid); if (!f) return
      const old = EXI[f.it.id].ar
      // another exercise: not the old one's name or saved row, and its
      // pick follows, or going back a screen brings the old one back
      const pk = pickFor(f.it)
      // what his plan had here, kept for «خطتي» («بدّلته بدل …») once
      // the stored row it came from is let go
      const o = f.it.orig, was = { ...((o && o.was) || f.it.was || {}) }
      if (o && !('name' in was)) { was.name = o.name; was.muscle = o.muscle }
      if (o && !('sets' in was) && Number(o.sets) > 0) was.sets = Number(o.sets)
      f.it.id = v; delete f.it.name; delete f.it.orig
      if (Object.keys(was).length) f.it.was = was
      if (pk) { pk.id = v; delete pk.name; delete pk.orig; if (f.it.was) pk.was = f.it.was }
      closeSheet(); S.open = f.it.uid; renderDay(); refreshPlan()
      land($(`.prow[data-uid="${f.it.uid}"]`))
      toast(`بدّلنا ${old} بـ${EXI[v].ar}`); return
    }
    case 'move': {
      const f = findItem(el.dataset.uid); if (!f) return
      f.d.items.splice(f.ii, 1); S.plan.days[+v].items.push(f.it); sortDay(S.plan.days[+v])
      const pk = pickFor(f.it); if (pk) pk.day = +v
      const L = dayLabels(S.plan)[+v]; S.open = null
      closeSheet(); renderDay(); refreshPlan(); toast(`نقلناه ليوم ${dayName(L)}`); return
    }
    case 'never': closeSheet(); return removeItem(el.dataset.uid, { exclude: true })
    case 'add-day': return addSheet(v)
    case 'refill': {
      if (S.busy) return
      clearToasts()
      const pre = new Set(S.plan.days.flatMap(d => d.items.map(it => it.uid)))
      const res = fill(S.plan, cfg()); S.filled = true
      if (!res.steps.length) { renderDay(); refreshPlan(); return toast('ما قدرنا نكمّلها بأدواتك') }
      S.busy = true
      playBuild({ plan: S.plan, pre, kind: 'fill' }).then(() => { S.busy = false })
      renderDay(); refreshPlan(); return
    }
    case 'plan-start': {
      const d = S.plan.days[0], L = dayLabels(S.plan)[0]
      const daysChange = S.days !== SETTINGS.days, edit = S.mode === 'current'
      // the save refuses what the old design could not open: a day with nothing in it
      const empty = S.plan.days.findIndex(x => !x.items.length)
      if (empty >= 0) { S.day = empty; renderDay(); refreshPlan(); return toast(`يوم ${dayName(dayLabels(S.plan)[empty])} فاضي. أضف له تمرين، أو غيّر نظامك`) }
      return openSheet(`<div class="grab"></div><h3 class="sh-title">${edit ? 'نحفظ التعديل؟' : 'نبدأ الخطة؟'}</h3>
        <ul class="facts">
          ${edit ? `<li><b>تكمّل من مكانك</b><span>نفس الخطة، واليوم اللي وصلت له يبقى${daysChange ? '' : ''}.</span></li>` : `<li><b>تبدأ من اليوم الأول</b><span>${dayName(L)}: ${dayMuscles(d).join('، ')}</span></li>`}
          <li><b>الجلسة تمشي على أرقام الخطة</b><span>العدّات والراحة لكل تمرين زي ما هي هنا، وتقدر تغيّرها.</span></li>
          ${daysChange ? `<li><b>أيامك تتغيّر من ${SETTINGS.days} إلى ${S.days}</b><span>أيام الراحة تتغيّر مع الخطة بنفس الحفظ، وتنحسب تغيير واحد مو اثنين.</span></li>` : ''}
          ${ruleFact(edit, daysChange)}
          ${FIRST ? '' : `<li><b>${edit ? 'النسخة اللي قبل التعديل تنحفظ' : 'خطتك القديمة تنحفظ'}</b><span>ترجع لها بضغطة لو ما عجبتك. وتمارينك القديمة وأوزانك تبقى، والتصميم القديم يقرا نفس الخطة.</span></li>`}
        </ul>
        <div class="sh-foot">
          <button class="btn-primary" data-act="activate">${breaksFor(edit, daysChange) ? (edit ? 'احفظ واكسر الستريك' : 'فعّل واكسر الستريك') : edit ? 'احفظ' : 'فعّل الخطة'}</button>
          <button class="btn-quiet" data-act="close-sheet" style="width:100%">ارجع</button>
        </div>`)
    }
    case 'activate': {
      const edit = S.mode === 'current', daysChange = S.days !== SETTINGS.days
      const hf = toHfPlan(S.plan, cfg(), { today: TODAY, base: edit && CURRENT ? CURRENT.hf : null })
      const bad = validatePlan(hf)
      if (bad) { closeSheet(true); return toast(bad.error === 'day' ? 'فيه يوم فاضي بالخطة. أضف له تمرين' : 'ما قدرنا نحفظ الخطة') }
      const stamps = !FIRST && (!edit || daysChange)
      if (!FIRST) PREV = { name: planTitle(ctx.plan.planName) || 'خطتك القديمة', when: 'اليوم', undo: stamps }
      ctx.onActivate && ctx.onActivate(hf, { edit, days: daysChange ? S.days : null, breakStreak: breaksFor(edit, daysChange), first: FIRST })
      if (stamps) COOLDOWN = 30
      closeSheet(true); buzz(12); snd('pr', { gain: 0.5 })
      return go('done')
    }
  }
})
on(document, 'keydown', (e) => {
  if (e.key !== 'Escape') return
  if ($('#bld')) return $('#bld').click()
  if ($('#sheet')) return closeSheet()
  if (!$('#mview').hidden) return closeMuscle()
  close()
})

buildBody()
open(ctx.door || 'settings')
if (!RM) SCREEN.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.32,.72,0,1)' })

return {
  destroy() {
    GEN++
    offs.forEach(f => { try { f() } catch { /* gone */ } })
    timers.forEach(t => clearTimeout(t))
    HOST.innerHTML = ''
  },
  /* for the browser checks: the state the page is in */
  state: () => S,
}
}
