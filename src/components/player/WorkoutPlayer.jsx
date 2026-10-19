import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Button, Num } from '../kit/index.jsx'
import { Check, CaretLeft, CheckCircle, ArrowUp } from '../kit/icons.js'
import ExerciseHero from './ExerciseHero.jsx'
import WorkingArea from './WorkingArea.jsx'
import SetHistory from './SetHistory.jsx'
import ExerciseQueue from './ExerciseQueue.jsx'
import InlineRest from './InlineRest.jsx'
import PRMoment from './PRMoment.jsx'
import SessionMedia from './SessionMedia.jsx'
import SetAsk from './SetAsk.jsx'
import RotateBar from './RotateBar.jsx'
import { primeAudio } from './sessionAudio.js'
import { play } from '../../sound.js'
import { haptic } from '../../haptics.js'
import { animate, reducedMotion, rise, fadeIn, EASE } from '../../motion.js'
import SetPhrase from './SetPhrase.jsx'
import { kg, setParts, setsPhrase, repsWord } from './sessionWords.js'
import { arabicName } from '../../exerciseMedia.js'
import { PLATE_STEP, roundToPlate } from '../../utils.js'
import { prSetsOf, todayTopOf, raiseAdvice } from './records.js'

// ── Session mode: the workout player ──────────────────────────
//
// One exercise on screen, top to bottom: a 4px segmented progress bar
// (one segment per exercise), the exercise head (a lit stage before the
// first set, a 72pt row after it), the sets table whose active row is
// the live block, and the rest of the session as a list. Under it all,
// docked at the bottom, the one green action — «تمّت المجموعة» — which
// the rest takes over in place while you rest.
//
// The exercise on screen is the only one with a live block, which is
// the old focus rule made structural: a weight typed now can only land
// on the exercise you are looking at. Moving between exercises is a tap
// in the list or a swipe on the head; it never completes, clears or
// reorders anything.
//
// Motion (the plan's «طلباتك» A–C; tokens in tokens.css, curves in
// motion.js, reduced motion follows the phone):
//
//   A · the handoff. Finishing an exercise draws the last check, fills
//       its segment with one sheen, raises «اكتمل» and «التالي» under
//       the table, and 1.5s later the next exercise comes on by itself
//       (حمزة approved). Any move between exercises — that, a tap in the
//       list, a swipe — is a broadcast cut: the screen leaves towards the
//       side it came from (220ms) while the next one slides in on a
//       spring, its picture a little slower for depth, then its names,
//       then the first set. With the View Transitions API the outgoing
//       screen is a snapshot that leaves; without it the new one simply
//       arrives. Reduced motion: a quick fade.
//   B · the raise reminder (WorkingArea): its intro plays once per
//       exercise; the ring breathes until the weight is touched.
//   C · the personal record (PRMoment): one definition — prSetsOf
//       (records.js) — for the gold rows and the celebration, decided
//       inside the tap so the iPhone can buzz. Every set at a new weight
//       (heavier than anything before today) gets its trophy and the full
//       moment, not only the first one (حمزة: «ابا احتفالية وكأس مدام
//       رفعت الوزن الجديد»).
//
// Every set: the «set-done» sound and a light haptic tick, in the tap.
//
// Phase 3 · every set (the plan's «اقتراح 1»): «تمّت المجموعة» turns into
// the rest instead of being swapped for it. The rest mounts in the tap
// (its clock starts at once); for the first 200ms a copy of the button
// stays on top — pressed, its words giving way to a check that draws —
// while the row behind it tints green from the start edge and draws its
// own check, and the next set's block rises in. Then the button's
// footprint grows up into the rest panel on the snappy spring (a clip,
// so nothing inside is squashed) as the green fades out of it, and the
// panel's parts come in one after another. When the rest goes, the
// button comes back with a short rise. Under 500ms in all; reduced
// motion cross-fades the two.

// The raise prefill happens once per exercise per session: after that
// the numbers are the lifter's, including a «خلّها 75». Kept in
// sessionStorage (tab-scoped, nothing the stored data or the old design
// ever sees) so a reload doesn't put back a weight he declined.
const RAISE_KEY = 'meran_raise_applied'
const raiseSeen = (key) => {
  try { return JSON.parse(sessionStorage.getItem(RAISE_KEY) || '[]').includes(key) } catch { return false }
}
const markRaiseSeen = (key) => {
  try {
    const list = JSON.parse(sessionStorage.getItem(RAISE_KEY) || '[]')
    if (!list.includes(key)) sessionStorage.setItem(RAISE_KEY, JSON.stringify([...list, key].slice(-60)))
  } catch {}
}

// What the motion has already said in this session, beside it and for
// the same reasons: the exercises whose raise intro has played in full,
// and those whose raised weight was touched (so the ring has stopped
// breathing). ⌄ and back mounts the player again, and a reload starts it
// from scratch; neither should replay the intro or wake the ring.
const MOTION_KEY = 'meran_session_motion'
const readMotion = (sid) => {
  try {
    const m = JSON.parse(sessionStorage.getItem(MOTION_KEY) || 'null')
    if (m && m.sid === sid) return { intro: m.intro || [], touched: m.touched || [] }
  } catch {}
  return { intro: [], touched: [] }
}
const writeMotion = (sid, part) => {
  try {
    const m = { ...readMotion(sid), ...part }
    sessionStorage.setItem(MOTION_KEY, JSON.stringify({ sid, intro: m.intro.slice(-60), touched: m.touched.slice(-60) }))
  } catch {}
}
// How long a showing's intro stays on offer: the full one to the ring's
// first breath (WorkingArea's T.breathe), the sheen a little past its end.
const INTRO_LIFE_MS = { full: 2400, sheen: 900 }
// The raise belongs to the machine in an exercise's place, not to the
// place: swapped for its alternative (same id, new name), the new machine
// gets its own prefill, intro and breathing ring.
const raiseKey = (e) => `${e.id}:${e.name}`

const firstUnfinished = (list, from = 0) => {
  const n = list.length
  for (let k = 0; k < n; k++) {
    const i = (from + k) % n
    const e = list[i]
    if (e.sets.length && !e.sets.every(s => s.done)) return i
  }
  return -1
}

// The coach line under the counters: what this set was last time, in the
// rows' own words («آخر مرة 72.5 كجم × 10 عدّات»), then what to do about
// it. The dash stays with the first part, so a narrow phone breaks the
// line after it and the advice («جرّب 77.5 كجم») starts its line whole.
// Never less than he already lifted today: after 45, not «جرّب 42.5» but
// «ثبّت على 45» (records.js).
function coachFor({ prog, prevSet, lastWeight, raisedW, todayTop, deloadPct, unit }) {
  const t = prog?.target
  const lead = setParts(prevSet) ? <>آخر مرة <SetPhrase set={prevSet} unit={unit} /></>
    : lastWeight != null ? <>آخر مرة <span className="s-pair"><Num>{kg(lastWeight)}</Num> كجم</span></>
    : <>أول مرة</>
  const line = (advice) => <>{lead}&nbsp;— <span className="s-coach-adv">{advice}</span></>
  if (deloadPct > 0) return line(<>ديلود، أخف بـ<Num>{deloadPct}%</Num></>)
  switch (prog?.hint) {
    case 'raise': {
      const a = raiseAdvice(raisedW, todayTop)
      if (!a) return lead
      return a.kind === 'hold'
        ? line(<>ثبّت على <Num>{kg(a.kg)}</Num> كجم</>)
        : line(<>جرّب <Num>{kg(a.kg)}</Num> كجم</>)
    }
    case 'lower':
      return prog.suggestedWeight != null
        ? line(<>خفّف إلى <Num>{kg(prog.suggestedWeight)}</Num> كجم</>)
        : line(<>خفّف الوزن شوي</>)
    case 'push':
      return t ? line(<>حاول توصل <Num>{t.top}</Num> {repsWord(t.top, unit)}</>) : lead
    default:
      return t ? line(<>الهدف <Num>{t.base === t.top ? t.base : `${t.base}–${t.top}`}</Num> {repsWord(t.top, unit)}</>) : lead
  }
}

// A second tap of the thumb that dismissed «جاهز» (or saved an edit)
// must not log a set: the field unmounts under the finger and «تمّت
// المجموعة» mounts in its place, so the dock ignores taps for this long.
const REST_CLOSE_GUARD_MS = 400

// How long the button's copy stays over the growing rest panel. The dock
// ignores taps for as long: the rest's controls are already there under
// the copy (which takes no taps), so a thumb bouncing on «تمّت المجموعة»
// would otherwise land on «تخطي» or ±15 it can't see yet.
const MORPH_MS = 520

// After the last set, the next exercise comes on screen by itself — in
// the rest, when its demo can actually be watched. After a record's
// trophy has landed, a little sooner (the record already held the screen).
const AUTO_NEXT_MS = 1500   // «بعد ثانية ونص» — what حمزة approved
const AUTO_NEXT_AFTER_PR_MS = 1200

export default function WorkoutPlayer({
  sessionId, exercises, mapping = {},
  deloadPct = 0, isResting,
  getLastW, progressionFor, ytUrlFor, statsFor, previousFor = () => [], swapOptions,
  onUpdateSet, onStepSet, onDoneSet, onAddSet, onRemoveSet, onRemoveEx, onMoveSet, onSwapTo,
  onAddExercise, onRequestFinish, onDiscard, onCloseRest, onOpenPlan,
  setAsk = null, onSetAskAlways, onSetAskClose, onRotate,
}) {
  const [index, setIndex] = useState(() => Math.max(0, firstUnfinished(exercises)))
  const [editingSet, setEditingSet] = useState(null)   // { exId, si }
  const [celebrating, setCelebrating] = useState(null) // { exId }
  const [stay, setStay] = useState(false)              // he took over this celebration: no move on by itself
  const [peek, setPeek] = useState(null)               // ex id whose stage was reopened
  const [fresh, setFresh] = useState(null)             // { exId, si } — the check to draw
  const [pr, setPr] = useState(null)                   // the record on screen: { exId, si, from, to, name }
  // Exercises whose raised weight was touched; kept for the session (above).
  const [touched, setTouched] = useState(() => new Set(readMotion(sessionId).touched))
  // What the player finds when it mounts (a reload, ⌄ and back) already
  // happened: an exercise already complete is not celebrated again (nor
  // moved on from by itself).
  const celebratedRef = useRef(null)
  if (!celebratedRef.current) {
    celebratedRef.current = new Set(exercises.filter(e => e.sets.length && e.sets.every(s => s.done)).map(e => e.id))
  }
  const introPlayed = useRef(null)                     // exercises whose raise intro played in full
  if (!introPlayed.current) introPlayed.current = new Set(readMotion(sessionId).intro)
  const prHeld = useRef(null)                          // the exercise whose completion a record's moment held
  const flash = useRef({ token: 0, done: 0, exId: null, si: null })
  const intro = useRef(new Map())                      // exId → { kind, at, showing, ran } — this showing's raise reminder
  const scrollRef = useRef(null)
  const dockRef = useRef(null)
  const dockQuietUntil = useRef(0)                     // the dock takes no tap before this (performance.now())
  const handoff = useRef({ token: 0, done: 0, dir: 0, at: -Infinity })
  const morph = useRef({ token: 0, done: 0 })
  const [ghost, setGhost] = useState(0)                // the morph whose button copy is on screen (0: none)

  const safeIndex = Math.min(index, Math.max(0, exercises.length - 1))
  const ex = exercises[safeIndex]
  const indexRef = useRef(safeIndex)
  indexRef.current = safeIndex

  // ── A · moving between exercises ──
  const apply = (i) => {
    setIndex(i)
    setEditingSet(null)
    setPeek(null)
    setFresh(null)
    setCelebrating(null)   // the «اكتمل» line belongs to the exercise being left
    const sc = scrollRef.current
    if (sc) {
      for (const c of sc.children) c.style.transform = ''
      sc.scrollTo?.({ top: 0 })
    }
  }

  const jump = (i) => {
    if (i < 0 || i >= exercises.length) return
    const from = indexRef.current
    const dir = i > from ? 1 : i < from ? -1 : 0
    if (!dir) { apply(i); return }
    const token = handoff.current.token + 1
    handoff.current = { ...handoff.current, token, dir, at: performance.now() }
    const root = document.documentElement
    const vt = typeof document.startViewTransition === 'function' && !reducedMotion()
      && document.visibilityState === 'visible'
    if (!vt) { apply(i); return }
    root.dataset.handoff = dir > 0 ? 'next' : 'prev'
    const clear = () => { if (handoff.current.token === token) delete root.dataset.handoff }
    try {
      const t = document.startViewTransition(() => { flushSync(() => apply(i)) })
      t.ready?.catch?.(() => {})   // a skipped transition (a second move mid-way) is fine
      t.finished.then(clear, clear)
    } catch {
      clear()
      apply(i)
    }
  }

  // The new exercise arrives: everything in the middle slides in from the
  // side the finger (or the list) sent it, on the smooth spring; the
  // picture travels further and a beat later; the names follow one by
  // one; the set to do comes last. Runs in the same commit as the change,
  // so inside a view transition the incoming screen is already moving.
  useLayoutEffect(() => {
    const h = handoff.current
    if (h.token === h.done) return
    h.done = h.token
    const sc = scrollRef.current
    if (!sc) return
    const kids = [...sc.children]
    if (reducedMotion()) {
      kids.forEach(k => animate(k, fadeIn, { d: 160, e: 'linear' }))
      return
    }
    const dx = -48 * h.dir
    kids.forEach(k => animate(k, [{ opacity: 0, transform: `translateX(${dx}px)` }, { opacity: 1, transform: 'none' }], { spring: 'smooth', delay: 50 }))
    const art = sc.querySelector('.s-stage-media, .s-thumb')
    animate(art, [{ opacity: 0, transform: `translateX(${-100 * h.dir}px) scale(.94)` }, { opacity: 1, transform: 'none' }], { spring: 'smooth', delay: 110 })
    ;['.s-name-ar', '.s-name-en', '.s-meta'].forEach((sel, k) => animate(sc.querySelector(sel), rise(10), { d: 260, delay: 120 + 60 * k }))
    animate(sc.querySelector('[data-testid="live-block"]'), rise(16), { d: 300, delay: 300 })
  }, [ex?.id])

  // Another machine in the same place — «بدّلها لـ … هالمرة» (the other
  // one of a rotation), or a swap — comes in where the old one stood: the
  // picture slides in a little behind, the names and the line under them
  // rise. Reduced motion: a quick fade.
  const shownEx = useRef({ id: ex?.id, name: ex?.name })
  useLayoutEffect(() => {
    const was = shownEx.current
    shownEx.current = { id: ex?.id, name: ex?.name }
    if (!ex || was.id !== ex.id || was.name === ex.name) return
    const sc = scrollRef.current
    if (!sc) return
    if (reducedMotion()) { animate(sc.querySelector('.s-stage, .s-exrow'), fadeIn, { d: 160, e: 'linear' }); return }
    animate(sc.querySelector('.s-stage-media, .s-thumb'), [{ opacity: 0, transform: 'translateX(-36px) scale(.94)' }, { opacity: 1, transform: 'none' }], { spring: 'smooth' })
    ;['.s-name-ar', '.s-name-en', '.s-meta', '.s-rot'].forEach((sel, k) => animate(sc.querySelector(sel), rise(8), { d: 240, delay: 60 + 50 * k }))
  }, [ex?.id, ex?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  // The swipe carries the whole middle with the finger; past either end
  // of the session it resists (0.35×). Let go short of the line and it
  // springs back. The finger takes over at once: an entrance or a spring
  // back still running on a part would hold it where it is, so they end.
  const drag = (phase, dx = 0) => {
    const sc = scrollRef.current
    if (!sc) return
    const kids = [...sc.children]
    if (phase === 'move') {
      const target = indexRef.current + (dx > 0 ? 1 : -1)
      const x = target < 0 || target >= exercises.length ? dx * 0.35 : dx
      kids.forEach(k => {
        try { k.getAnimations?.().forEach(a => a.cancel()) } catch {}
        k.style.transform = `translateX(${x}px)`
      })
      return
    }
    kids.forEach(k => {
      const from = k.style.transform
      k.style.transform = ''
      if (from && !reducedMotion()) animate(k, [{ transform: from }, { transform: 'none' }], { spring: 'bouncy', fill: 'none' })
    })
  }
  const swipeTo = (dir) => {
    const target = indexRef.current + dir
    if (target < 0 || target >= exercises.length) { drag('cancel'); return }
    haptic('swipe')
    jump(target)
  }

  // The set being worked: the first unticked one.
  const currentSetIndex = ex ? ex.sets.findIndex(s => !s.done) : -1
  const exComplete = !!ex && ex.sets.length > 0 && currentSetIndex === -1
  const editing = editingSet && editingSet.exId === ex?.id && ex.sets[editingSet.si] ? editingSet.si : null
  const liveIndex = editing != null ? editing : currentSetIndex

  // Completing an exercise's last set earns a short line — what was
  // done, whether it beat last time, what's next — then the next
  // unfinished exercise comes on screen by itself. Once per exercise.
  // Decided before the first paint (a layout effect), so the first frame
  // without the live block already names the exercise, holds «التالي»'s
  // place and starts the rise — no frame of «اكتمل هذا التمرين», no list
  // jumping up and back.
  useLayoutEffect(() => {
    if (!ex || !exComplete || celebratedRef.current.has(ex.id)) return
    celebratedRef.current.add(ex.id)
    setCelebrating({ exId: ex.id })
    setStay(false)
    // Its segment fills, then one sheen crosses it.
    const seg = document.querySelectorAll('.s-seg')[safeIndex]?.querySelector('b')
    if (seg && !reducedMotion()) {
      animate(seg, [{ opacity: 1, transform: 'translateX(120%)' }, { opacity: 1, transform: 'translateX(-120%)' }], { d: 450, delay: 240, fill: 'none' })
    }
  }, [exComplete, ex?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // The celebration owns its own lifetime, keyed on itself — never on
  // the exercise on screen. The line stays up until the next exercise
  // takes the screen (jump clears it in the same commit, so the outgoing
  // snapshot still carries «اكتمل» and «التالي»); with nothing left to
  // move to, it simply stays. Moving away by hand clears it too. A
  // record's moment holds the move until its trophy has landed, and then
  // the wait is the shorter one — only when that moment held this
  // completion, not for a record set earlier in the exercise.
  //
  // He can take over before it comes: opening ⋯ or the exercise's info,
  // or tapping a done row to correct it, calls the move off for good (he
  // moves on by hand, with «التمرين التالي»), so a sheet's actions or the
  // numbers he types still land on the exercise he finished. At the
  // moment it would come, any sheet up, an exercise no longer complete
  // (a set added) or the screen elsewhere also keep it where it is.
  const exercisesRef = useRef(exercises)
  exercisesRef.current = exercises
  const prBusy = !!pr && pr.exId === celebrating?.exId
  const holdAuto = () => { if (celebrating) setStay(true) }
  useEffect(() => {
    if (!celebrating || stay) return
    if (prBusy) { prHeld.current = celebrating.exId; return }
    const t = setTimeout(() => {
      const list = exercisesRef.current
      const at = list.findIndex(e => e.id === celebrating.exId)
      const done = at !== -1 && list[at].sets.length > 0 && list[at].sets.every(s => s.done)
      const next = firstUnfinished(list, at + 1)
      const sheetUp = !!document.querySelector('.k-sheet:not(.k-leaving)')
      if (done && !sheetUp && next !== -1 && list[indexRef.current]?.id === celebrating.exId) jump(next)
    }, prHeld.current === celebrating.exId ? AUTO_NEXT_AFTER_PR_MS : AUTO_NEXT_MS)
    return () => clearTimeout(t)
  }, [celebrating?.exId, prBusy, stay]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the live block in view as sets go by — clear of the dock, its
  // fade, and whatever the dock currently is (the 56pt button, the taller
  // rest panel, the «جاهز» field). scroll-padding on .s-scroll carries
  // the dock's real height, measured below.
  const showLive = (smooth = true) => {
    const el = scrollRef.current?.querySelector('[data-testid="live-block"]')
    if (el) el.scrollIntoView({ block: 'nearest', behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' })
  }
  useEffect(() => { showLive() }, [ex?.id, liveIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // The dock's height is measured, not assumed: it changes when the rest
  // takes the button's place (and with the phone's height), and the
  // scroller's bottom padding and scroll-padding follow it. When the dock
  // grows over the page — a rest starting — the live block is brought
  // back above it a frame later, so the next set's steppers are never
  // left under the rest panel or its fade.
  useLayoutEffect(() => {
    const dock = dockRef.current, scroller = scrollRef.current
    if (!dock || !scroller || typeof ResizeObserver === 'undefined') return
    let last = null
    let raf = 0
    const measure = () => {
      const h = Math.ceil(dock.getBoundingClientRect().height)
      if (h === last) return
      const grew = last != null && h > last
      last = h
      scroller.style.setProperty('--s-dock-h', `${h}px`)
      if (grew) {
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(() => showLive())
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(dock)
    return () => { ro.disconnect(); cancelAnimationFrame(raf) }
  }, [!!ex]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── The exercise on screen ──
  const prog = ex ? progressionFor(ex.name) : null
  const stats = ex ? statsFor(ex.name) : { lastWeight: null, maxWeight: null }
  const prevSets = useMemo(() => (ex ? previousFor(ex.name) : []), [ex?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  // RAISE: the engine said add weight (it is silent during a deload).
  // The new number is last + one plate step, computed here.
  const raiseOn = !!ex && prog?.hint === 'raise'
  const snapW = ex ? parseFloat(getLastW(ex.name)) : NaN
  const base = raiseOn
    ? (prog.workingWeight ?? (Number.isFinite(snapW) ? snapW : null))
    : null
  const raisedW = base != null ? roundToPlate(base + PLATE_STEP) : null

  // Prefill once: every set still to do that holds the old weight now
  // holds the new one, so set 2 doesn't fall back to 75.
  useEffect(() => {
    if (!ex || !raiseOn || base == null || raisedW == null) return
    if (ex.sets.some(s => s.done)) return
    const key = `${sessionId}:${raiseKey(ex)}`
    if (raiseSeen(key)) return
    markRaiseSeen(key)
    ex.sets.forEach((s, i) => {
      if (s.done) return
      const w = parseFloat(s.weight)
      if (String(s.weight ?? '').trim() === '' || w === base || w === snapW) {
        onUpdateSet(ex.id, i, 'weight', kg(raisedW))
      }
    })
  }, [ex?.id, ex?.name, raiseOn, base]) // eslint-disable-line react-hooks/exhaustive-deps

  const touchRaise = (k) => setTouched(t => (t.has(k) ? t : new Set(t).add(k)))
  useEffect(() => { writeMotion(sessionId, { touched: [...touched] }) }, [touched]) // eslint-disable-line react-hooks/exhaustive-deps

  const keepBase = () => {
    if (!ex || base == null) return
    ex.sets.forEach((s, i) => {
      if (!s.done && parseFloat(s.weight) !== base) onUpdateSet(ex.id, i, 'weight', kg(base))
    })
  }

  // The reminder plays in full the first time an exercise shows it (after
  // the handoff has brought the set in, when it arrived by one); coming
  // back to it before the first set, only a sheen; once a set is done,
  // nothing — the ring is simply there. A showing is one stay on the
  // exercise (a move away and back is a new one). Whether its intro has
  // played lives here, with the exercise: the live block mounts again for
  // every set and after «حفظ التعديل», and must find nothing to replay.
  const liveSet = ex && liveIndex >= 0 ? ex.sets[liveIndex] : null
  const liveRaised = raiseOn && base != null && liveSet && parseFloat(liveSet.weight) > base
  const started = !!ex && ex.sets.some(s => s.done)
  const rk = ex ? raiseKey(ex) : null
  if (ex && liveRaised && editing == null) {
    const showing = `${rk}|${handoff.current.token}`
    const cur = intro.current.get(rk)
    if (!cur || cur.showing !== showing) {
      const kind = started ? null
        : !introPlayed.current.has(rk) ? 'full'
        : touched.has(rk) ? null : 'sheen'
      const arriving = performance.now() - handoff.current.at < 600
      intro.current.set(rk, { kind, at: performance.now() + (kind === 'full' && arriving ? 450 : 0), showing, ran: false })
    }
  }
  const introNow = ex ? intro.current.get(rk) : null
  // Over once a set is done, or once it has had its time.
  if (introNow?.kind && (started || performance.now() > introNow.at + INTRO_LIFE_MS[introNow.kind])) introNow.kind = null
  // The first live block to ask plays it; any later one (or a re-run) is told no.
  const claimIntro = (k) => () => {
    const e = intro.current.get(k)
    if (!e || !e.kind || e.ran) return false
    e.ran = true
    if (e.kind === 'full' && !introPlayed.current.has(k)) {
      introPlayed.current.add(k)
      writeMotion(sessionId, { intro: [...introPlayed.current] })
    }
    return true
  }
  // The ring breathes until the weight is touched — or a set is done on it.
  const breathing = !!ex && !started && !touched.has(rk)

  // The sets at a new weight (heavier than anything before today): each wears the trophy.
  const prSets = useMemo(
    () => (ex ? prSetsOf(ex.sets, stats.maxWeight, deloadPct) : []),
    [ex, stats.maxWeight, deloadPct],
  )
  // The heaviest already done today: the coach never suggests less.
  const todayTop = ex ? todayTopOf(ex.sets) : null

  const summary = useMemo(() => {
    if (!ex || !exComplete) return null
    const weights = ex.sets.filter(s => s.done).map(s => parseFloat(s.weight)).filter(w => w > 0)
    const top = weights.length ? Math.max(...weights) : null
    const delta = top != null && stats.lastWeight != null ? Math.round((top - stats.lastWeight) * 10) / 10 : null
    return { sets: ex.sets.filter(s => s.done).length, top, delta }
  }, [ex, exComplete, stats.lastWeight])

  // The row flashes gold when a record's trophy lands on it: the tint
  // warms and cools back to the done green, the trophy pops.
  useLayoutEffect(() => {
    const f = flash.current
    if (f.token === f.done) return
    f.done = f.token
    const row = scrollRef.current?.querySelector(`.s-table[data-ex="${f.exId}"] [data-set="${f.si}"]`)
    if (!row) return
    const reduce = reducedMotion()
    animate(row, [{ backgroundColor: 'rgba(251,191,36,0.30)' }, { backgroundColor: 'rgba(94,195,42,0.10)' }], { d: reduce ? 600 : 900, fill: 'none' })
    if (reduce) return
    animate(row.querySelector('.s-pr-icon'), [{ transform: 'scale(1.5)' }, { transform: 'none' }], { spring: 'bouncy' })
  })

  // ── Phase 3 · the button becomes the rest ──
  const restOnTop = isResting && editing == null
  useEffect(() => {
    if (!ghost) return
    const t = setTimeout(() => setGhost(g => (g === ghost ? 0 : g)), MORPH_MS)
    return () => clearTimeout(t)
  }, [ghost])
  useLayoutEffect(() => {
    const m = morph.current
    if (!ghost || m.done === ghost) return
    m.done = ghost
    const dock = dockRef.current
    const copy = dock?.querySelector('.s-dock-ghost')
    const panel = dock?.querySelector('.s-rest')
    if (!copy) return
    if (reducedMotion()) {
      animate(copy, [{ opacity: 1 }, { opacity: 0 }], { d: 160, e: 'linear', fill: 'forwards' })
      animate(panel, fadeIn, { d: 160, e: 'linear' })
      return
    }
    // The button: pressed, and its words give way to a check.
    animate(copy, [{ transform: 'scale(0.98)' }, { transform: 'scale(0.97)', offset: 0.3 }, { transform: 'none' }], { d: 260 })
    animate(copy.querySelector('.s-ghost-label'), [{ opacity: 1 }, { opacity: 0 }], { d: 120, fill: 'forwards' })
    animate(copy.querySelector('.s-ghost-ok path'), [{ strokeDashoffset: 30 }, { strokeDashoffset: 0 }], { d: 180, delay: 40 })
    animate(copy, [{ opacity: 1 }, { opacity: 0 }], { d: 180, delay: 200, e: EASE.exit, fill: 'forwards' })
    // The next set's block rises into place — at once, and from half-seen:
    // the block it replaces is already gone, so a start from nothing (or a
    // later one) would leave a hole where the set should be.
    animate(scrollRef.current?.querySelector('[data-testid="live-block"]'),
      [{ opacity: 0.5, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { d: 240 })
    if (!panel) return
    // The button's footprint grows up into the panel.
    const cut = Math.max(0, panel.offsetHeight - copy.offsetHeight)
    animate(panel, [{ clipPath: `inset(${cut}px 0px 0px 0px round 16px)` }, { clipPath: 'inset(0px 0px 0px 0px round 16px)' }],
      { spring: 'snappy', delay: 200 })
    ;[['.s-rest-label', 240], ['.s-rest-skip', 240], ['.s-rest-time', 280], ['.s-rest-nudges', 320]].forEach(([sel, at]) =>
      animate(panel.querySelector(sel), rise(6), { d: 220, delay: at }))
    animate(panel.querySelector('.s-rest-bar'), fadeIn, { d: 200, delay: 360 })
  }, [ghost, restOnTop])
  // The rest goes (a tap on «جاهز», «تخطي»): the button comes back with a short rise.
  const wasResting = useRef(restOnTop)
  useLayoutEffect(() => {
    const was = wasResting.current
    wasResting.current = restOnTop
    if (!was || restOnTop) return
    const btn = dockRef.current?.querySelector(':scope > .k-btn')
    if (reducedMotion()) animate(btn, fadeIn, { d: 160, e: 'linear' })
    else animate(btn, [{ opacity: 0, transform: 'translateY(8px) scale(0.98)' }, { opacity: 1, transform: 'none' }], { spring: 'snappy' })
  }, [restOnTop])

  if (!ex) return null

  // Whenever what is under the thumb changes in the dock, it stays quiet
  // for a moment, so the second tap of a double tap lands on nothing:
  // closing the rest (a tap on «جاهز» or «تخطي»), «حفظ التعديل» giving
  // way, and the button turning into the rest. One guard for everything
  // in the dock, taken before any of its buttons sees the tap.
  const quietDock = (ms) => { dockQuietUntil.current = Math.max(dockQuietUntil.current, performance.now() + ms) }
  const swallowIfQuiet = (e) => {
    if (performance.now() >= dockQuietUntil.current) return
    e.stopPropagation()
    e.preventDefault()
  }
  const closeRest = () => {
    quietDock(REST_CLOSE_GUARD_MS)
    onCloseRest?.()
  }

  const name = arabicName(ex.name, mapping) || ex.name

  // «تمّت المجموعة». Everything that must happen inside the tap happens
  // here: the sound, the haptic (iOS only allows it in a tap), and the
  // record decision — the same prSetsOf the rows are painted by, run on
  // the sets as they will be. Every set at a new weight gets the moment.
  const complete = () => {
    if (currentSetIndex < 0) return
    const si = currentSetIndex
    primeAudio()
    play('set-done')
    const after = ex.sets.map((s, i) => (i === si ? { ...s, done: true } : s))
    const isPR = prSetsOf(after, stats.maxWeight, deloadPct).includes(si)
    if (isPR) {
      haptic('pr')
      play('pr', { at: 0.35 })
      // Measured against the best before today, as the record itself is.
      setPr({ exId: ex.id, si, from: stats.maxWeight, to: parseFloat(ex.sets[si].weight), name })
    } else {
      haptic('set')
    }
    touchRaise(raiseKey(ex))
    setPeek(null)
    setFresh({ exId: ex.id, si })
    quietDock(MORPH_MS)
    morph.current.token += 1
    setGhost(morph.current.token)
    onDoneSet(ex.id, si, true)
  }

  const landPR = () => {
    const p = pr
    setPr(null)
    if (!p) return
    flash.current = { ...flash.current, token: flash.current.token + 1, exId: p.exId, si: p.si }
  }
  // The row's trophy, if it is on screen and clear of the dock.
  const prTarget = (p) => () => {
    const sc = scrollRef.current
    const icon = sc?.querySelector(`.s-table[data-ex="${p.exId}"] [data-set="${p.si}"] .s-pr-icon`)
    if (!icon || !sc) return null
    const r = icon.getBoundingClientRect(), box = sc.getBoundingClientRect()
    const dockTop = dockRef.current?.getBoundingClientRect().top ?? box.bottom
    return r.top >= box.top && r.bottom <= Math.min(box.bottom, dockTop) ? icon : null
  }

  const hasDone = ex.sets.some(s => s.done)
  const expanded = !hasDone || peek === ex.id
  const nextIdx = firstUnfinished(exercises, safeIndex + 1)
  const swap = swapOptions ? swapOptions(ex) : null
  // What comes after it in the session, for the swap sheet: the unfinished
  // ones, in order, starting after this one.
  const upcoming = exercises.slice(safeIndex + 1).filter(e => !(e.sets.length && e.sets.every(s => s.done)))
  const ar = arabicName(ex.name, mapping)
  const raiseFor = (e) => !deloadPct && progressionFor(e.name)?.hint === 'raise'

  const live = liveIndex >= 0 ? (
    <WorkingArea
      ex={ex} setIndex={liveIndex} editing={editing != null}
      prevSet={prevSets[liveIndex] || null}
      coach={editing != null ? null : coachFor({
        prog, prevSet: prevSets[liveIndex] || prevSets[prevSets.length - 1] || null,
        lastWeight: stats.lastWeight ?? (deloadPct === 0 && Number.isFinite(snapW) && snapW > 0 ? snapW : null),
        raisedW, todayTop, deloadPct, unit: ex.unit,
      })}
      raise={raiseOn && base != null && editing == null ? {
        base, raised: raisedW,
        intro: introNow?.kind || null, introAt: introNow?.at || 0,
        claimIntro: claimIntro(rk),
        breathe: breathing,
        onTouch: () => touchRaise(rk),
      } : null}
      deloadPct={deloadPct}
      onUpdateSet={(si, f, v) => onUpdateSet(ex.id, si, f, v)}
      onStepSet={(si, f, d) => onStepSet(ex.id, si, f, d)}
      onKeepBase={keepBase}
    />
  ) : null

  // ── The dock: one green action, or the rest in its place ──
  let dock = null
  if (editing != null) {
    // «تمّت المجموعة» (or the rest) takes its place under the thumb.
    dock = <Button variant="primary" size="lg" full icon={Check} onClick={() => { quietDock(REST_CLOSE_GUARD_MS); setEditingSet(null) }}>حفظ التعديل</Button>
  } else if (isResting) {
    dock = null   // InlineRest below
  } else if (currentSetIndex >= 0) {
    dock = <Button variant="primary" size="lg" full icon={Check} onClick={complete} data-testid="complete-set">تمّت المجموعة</Button>
  } else if (nextIdx !== -1) {
    dock = <Button variant="primary" size="lg" full icon={CaretLeft} onClick={() => jump(nextIdx)}>التمرين التالي</Button>
  } else {
    dock = <Button variant="primary" size="lg" full icon={Check} onClick={() => onRequestFinish()}>إنهاء الجلسة</Button>
  }
  const phrase = summary ? setsPhrase(summary.sets) : null
  const celebratingHere = celebrating?.exId === ex.id
  const nextEx = celebratingHere && nextIdx !== -1 ? exercises[nextIdx] : null

  return (
    <>
      {/* ── One segment per exercise, filled by its done sets ── */}
      <div className="s-segs" role="progressbar" aria-label="تقدّم الجلسة"
        aria-valuemin={0} aria-valuemax={exercises.length}
        aria-valuenow={exercises.filter(e => e.sets.length && e.sets.every(s => s.done)).length}>
        {exercises.map((e, i) => {
          const done = e.sets.filter(s => s.done).length
          const frac = e.sets.length ? done / e.sets.length : 0
          return (
            <span key={e.id} className="s-seg" data-on={i === safeIndex ? '1' : undefined}>
              <i style={{ transform: `scaleX(${frac})` }} />
              <b aria-hidden="true" />
            </span>
          )
        })}
      </div>

      <div className="s-scroll" ref={scrollRef}>
        <ExerciseHero
          ex={ex}
          mapping={mapping}
          expanded={expanded}
          collapsible={hasDone && peek === ex.id}
          animate
          onToggleStage={() => setPeek(p => (p === ex.id ? null : ex.id))}
          maxWeight={stats.maxWeight}
          quietBest={raiseOn}
          deloadPct={deloadPct}
          ytUrl={ytUrlFor(ex.name)}
          swap={swap}
          onSwapTo={(name, opts) => onSwapTo?.(ex.id, name, opts)}
          upcoming={upcoming}
          position={{ at: safeIndex + 1, of: exercises.length }}
          lastFor={(n) => statsFor(n)?.lastWeight ?? null}
          onOpenPlan={onOpenPlan}
          onRemove={() => onRemoveEx(ex.id)}
          onAddSet={() => onAddSet(ex.id)}
          onRemoveSet={() => onRemoveSet(ex.id, ex.sets.length - 1)}
          onMoveSet={(toId) => onMoveSet(ex.id, ex.sets.length - 1, toId)}
          moveTargets={exercises.filter(o => o.id !== ex.id).map(o => ({ id: o.id, name: o.name }))}
          onAddExercise={onAddExercise}
          onDiscard={onDiscard}
          onSheet={holdAuto}
          onSwipe={swipeTo}
          onDrag={drag}
        />

        <RotateBar ex={ex} mapping={mapping} canSwitch={!hasDone && !!onRotate}
          onSwitch={(name) => { haptic('swipe'); onRotate?.(ex.id, name) }} />

        {ex.sets.length > 0 ? (
          <SetHistory
            ex={ex}
            liveIndex={liveIndex}
            currentIndex={currentSetIndex}
            editingIndex={editing}
            prevSets={prevSets}
            freshIndex={fresh && fresh.exId === ex.id ? fresh.si : null}
            prSets={prSets}
            holdIndex={pr && pr.exId === ex.id ? pr.si : null}
            onEdit={(si) => { setFresh(null); holdAuto(); setEditingSet(cur => (cur && cur.exId === ex.id && cur.si === si ? null : { exId: ex.id, si })) }}
            live={live}
          />
        ) : (
          <p className="s-note">ما فيه مجموعات — أضف مجموعة من <span aria-hidden="true">⋯</span>.</p>
        )}

        {setAsk && setAsk.exId === ex.id && editing == null && (
          <SetAsk key={`${setAsk.exId}:${setAsk.n}`} ask={setAsk} onAlways={onSetAskAlways} onClose={onSetAskClose} />
        )}

        {exComplete && editing == null && summary && (
          <div className="s-done-line" data-testid="exercise-done" role="status" data-fresh={celebratingHere ? '1' : undefined}>
            <CheckCircle size={22} weight="fill" className="s-done-icon" aria-hidden="true" />
            <div className="s-done-text">
              <strong>{celebratingHere ? `اكتمل ${ar || ex.name}` : 'اكتمل هذا التمرين'}</strong>
              <span>
                {phrase.num != null && <><Num>{phrase.num}</Num> </>}{phrase.word}
                {summary.top != null && <> · أعلى <Num>{kg(summary.top)}</Num> كجم</>}
                {summary.delta > 0 && (
                  <span className="s-done-delta">
                    {' · '}<ArrowUp size={14} weight="bold" aria-hidden="true" /><Num>+{kg(summary.delta)}</Num> عن آخر مرة
                  </span>
                )}
              </span>
            </div>
          </div>
        )}
        {nextEx && editing == null && (
          <div className="s-next-line" data-testid="exercise-next">
            <span className="s-next-thumb" aria-hidden="true">
              <SessionMedia name={nextEx.name} mapping={mapping} muscle={nextEx.muscle} className="s-thumb-img" />
            </span>
            <span className="s-next-text">
              <small>التالي</small>
              <b>
                {arabicName(nextEx.name, mapping) || nextEx.name}
                {raiseFor(nextEx) && <ArrowUp size={14} weight="bold" className="s-raise-arrow" role="img" aria-label="ارفع الوزن" />}
              </b>
            </span>
          </div>
        )}

        <ExerciseQueue
          exercises={exercises}
          mapping={mapping}
          activeIndex={safeIndex}
          onJump={jump}
          onAdd={onAddExercise}
          raiseFor={raiseFor}
        />
      </div>

      <div className="s-dock" ref={dockRef} data-mode={restOnTop ? 'rest' : 'button'} onClickCapture={swallowIfQuiet}>
        {isResting && (
          <InlineRest onDone={closeRest} onSkip={closeRest} hidden={!restOnTop} morph={!!ghost}
            seconds={ex?.rest > 0 ? ex.rest : undefined} />
        )}
        {dock}
        {ghost && restOnTop ? (
          // The button, for the moment it takes to become the rest: not a
          // button any more (nothing to tap, nothing to read out).
          <span className="k-btn k-btn-primary k-btn-lg k-full s-dock-ghost" aria-hidden="true" data-testid="dock-ghost">
            <span className="s-ghost-label"><Check size={20} weight="bold" />تمّت المجموعة</span>
            <svg className="s-ghost-ok" width="30" height="30" viewBox="0 0 24 24">
              <path d="M5.5 12.5l4.2 4.2L18.5 7.5" fill="none" stroke="currentColor"
                strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" pathLength="30" />
            </svg>
          </span>
        ) : null}
      </div>

      {pr && (
        <PRMoment key={`${pr.exId}:${pr.si}`} from={pr.from} to={pr.to} name={pr.name}
          findTarget={prTarget(pr)} onLand={landPR} />
      )}
    </>
  )
}
