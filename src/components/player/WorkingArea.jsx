import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Chip, Num } from '../kit/index.jsx'
import { ArrowUp, Minus, Plus, PencilSimple } from '../kit/icons.js'
import RaiseRing from './RaiseRing.jsx'
import RollNumber from '../RollNumber.jsx'
import { primeAudio } from './sessionAudio.js'
import { play } from '../../sound.js'
import { animate, reducedMotion, EASE } from '../../motion.js'
import { kg, setWords, repsWord } from './sessionWords.js'

// ── The live block: the set being worked ──────────────────────
//
// The active row of the sets table, opened up. The one place a hand
// with chalk on it touches the app, so the numbers are broadcast-sized
// (56px Archivo, tabular), the steppers are 56pt discs, and holding a
// stepper repeats it — 40 to 80kg is one press, not sixteen. Tapping a
// number opens the keyboard for direct entry and selects what is there,
// so a typed weight replaces it in one go.
//
// The steps are the gym's own: ±2.5kg, ±1 rep. Every change routes
// through the same handlers as before; this decides sizes, not rules.
//
// RAISE: when the progression engine says the weight should go up, the
// number itself turns gold and holds the new weight, a gold ring goes
// around it, a chip says by how much, and «خلّها 75» puts it back in one
// tap. No other gold on the screen. The first time an exercise shows it,
// it happens in front of you (the plan's «طلبك 2»):
//
//     250ms  the old weight rolls up to the new one and turns gold
//            (and the short «raise» sound plays)
//     300ms  the chip slides in; its arrow hops once at 600ms
//     450ms  «جرّب 77.5 كجم» fades in; «خلّها 75» at 700ms
//     500ms  the ring draws, bottom to top, 900ms
//    1400ms  one soft gold flare; a sheen crosses the number at 1500ms
//    2400ms  the ring starts to breathe, and keeps on until the number
//            is touched — the field, its steppers or «خلّها»
//
// Coming back to the exercise before starting it: only the sheen. Once a
// set is done, nothing: the next set's block simply has the gold, the
// ring and the chip. Whether the intro has played belongs to the
// exercise (WorkoutPlayer keeps it, `claimIntro`), not to this block,
// which mounts again for every set and after «حفظ التعديل».
// «خلّها 75» runs it backwards: the number rolls down, the gold goes,
// the ring withdraws and the chip leaves. Stepping the weight rolls it
// (180ms), and a press on a stepper or the field ends any moving copy at
// once, so what is shown is always what will be logged. Reduced motion:
// gold from the first frame, the ring whole and still, nothing
// breathing; the «raise» sound still plays.

// Hold to repeat: after 400ms every 150ms, stepping up to 100ms after
// 1.5s — never faster. Stops on release, cancel or losing the pointer.
//
// A finger is not a mouse. The four discs cover much of the live block,
// so a scroll often starts on one; a touch that stepped on pointerdown
// would scroll the page AND change the weight. So for touch and pen
// nothing happens on the way down: a tap steps once on release, if the
// finger stayed within 10px and the browser never took the gesture for
// a scroll (pointercancel); a finger held still for 400ms steps and
// starts repeating. A mouse has no scroll to confuse, so it steps on
// press. A keyboard press steps once.
const TAP_SLOP = 10
const HOLD_DELAY = 400

// The intro's beats, in ms from its start.
const T = { roll: 250, chip: 300, hop: 600, adv: 450, keep: 700, ring: 500, flare: 1400, sheen: 1500, done: 2110, breathe: 2400 }

const GOLD = 'rgb(251, 191, 36)'
const INK = 'rgb(244, 246, 248)'

function HoldButton({ label, onStep, onPress, children }) {
  const timer = useRef(null)
  const press = useRef(null)          // { id, x, y, touch, repeating, at }
  const step = useRef(onStep)
  step.current = onStep

  const clear = (el) => {
    clearTimeout(timer.current)
    timer.current = null
    press.current = null
    el?.removeAttribute?.('data-held')
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  const loop = () => {
    const p = press.current
    if (!p) return
    const held = performance.now() - p.at
    timer.current = setTimeout(() => {
      if (!press.current) return
      step.current()
      loop()
    }, held > 1500 ? 100 : 150)
  }

  const startRepeat = () => {
    const p = press.current
    if (!p) return
    p.repeating = true
    step.current()
    loop()
  }

  return (
    <button
      type="button"
      className="s-step-btn"
      aria-label={label}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        primeAudio()
        onPress?.()
        clearTimeout(timer.current)
        const touch = e.pointerType !== 'mouse'
        press.current = { id: e.pointerId, x: e.clientX, y: e.clientY, touch, repeating: false, at: performance.now() }
        e.currentTarget.setAttribute('data-held', '1')
        if (touch) {
          // Wait: a tap steps on release; a still finger starts the repeat.
          timer.current = setTimeout(startRepeat, HOLD_DELAY)
        } else {
          try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch {}
          step.current()
          press.current.repeating = true
          timer.current = setTimeout(loop, HOLD_DELAY)
        }
      }}
      onPointerMove={(e) => {
        const p = press.current
        if (!p || !p.touch || p.repeating || p.id !== e.pointerId) return
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > TAP_SLOP) clear(e.currentTarget)
      }}
      onPointerUp={(e) => {
        const p = press.current
        if (!p) { clear(e.currentTarget); return }
        if (p.id !== e.pointerId) return
        const tap = p.touch && !p.repeating && Math.hypot(e.clientX - p.x, e.clientY - p.y) <= TAP_SLOP
        clear(e.currentTarget)
        if (tap) step.current()
      }}
      onPointerCancel={(e) => clear(e.currentTarget)}
      onLostPointerCapture={(e) => { if (press.current?.id === e.pointerId) clear(e.currentTarget) }}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        // A pointer press already stepped (on press for a mouse, on release
        // for a finger); only a keyboard activation — a click with no
        // pointer behind it, detail 0 — steps here.
        if (e.detail > 0) return
        onPress?.()
        step.current()
      }}
    >
      {children}
    </button>
  )
}

/**
 * The number drawn over the input while it moves: a roll (the raise
 * coming in, «خلّها» taking it back) and/or a sheen. The input itself is
 * hidden meanwhile (still focusable: a tap ends this) and comes back when
 * this goes.
 */
function NumberOverlay({ show, onGone }) {
  const ref = useRef(null)
  const gone = useRef(onGone)
  gone.current = onGone
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const anims = []
    const now = performance.now()
    if (show.color) {
      anims.push(animate(el, [{ color: show.color[0] }, { color: show.color[1] }],
        { d: show.colorMs || 320, delay: Math.max(0, show.colorAt - now) }))
    }
    let t1 = 0, t2 = 0
    if (show.sheenAt != null) {
      t1 = setTimeout(() => {
        // On the number's own text: background-clip: text skips the text
        // of positioned children, and the rolled number is one.
        const n = el.querySelector('.k-roll') || el
        n.classList.add('s-gt')
        animate(n, [{ backgroundPosition: '100% 0' }, { backgroundPosition: '0% 0' }], { d: 600, e: EASE.io, fill: 'none' })
      }, Math.max(0, show.sheenAt - now))
    }
    if (show.until != null) t2 = setTimeout(() => gone.current?.(), Math.max(0, show.until - now))
    return () => { clearTimeout(t1); clearTimeout(t2); anims.forEach(a => a?.cancel?.()) }
  }, [show.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span className="s-field-roll" ref={ref} aria-hidden="true">
      {show.from != null
        ? <RollNumber from={show.from} to={show.to} delay={Math.max(0, show.rollAt - performance.now())}
            stagger={show.stagger ?? 40} up={show.up} duration={show.duration ?? null}
            onDone={show.until == null ? () => gone.current?.() : undefined} />
        : <span className="k-roll">{show.to}</span>}
    </span>
  )
}

function Stepper({ field, value, unit, unitLabel, onInput, onStep, onTouch, raise, ring, overlay, onOverlayGone, inputTestId }) {
  const fieldRef = useRef(null)
  // The number's width in digits (a point is half a digit). The CSS sizes
  // the input to it and shrinks the type when a long weight («202.5»)
  // would otherwise run into the steppers on a narrow phone.
  const len = Math.max(1, [...String(value ?? '')].reduce((n, c) => n + (c === '.' || c === ',' ? 0.5 : 1), 0))
  // A weight steps by 2.5, so «.5» comes and goes on every other tap. From
  // 100 up — where the type starts shrinking — it is sized for the whole
  // number plus room for «.5», so 100 → 102.5 → 105 keep one size and it
  // only steps down when a digit is added. (--len still sizes the box.)
  const whole = String(value ?? '').split(/[.,]/)[0].length
  const fit = field === 'weight' && whole >= 3 ? Math.max(len, whole + 1.5) : len
  // A press on a stepper ends a moving copy of the number at once: the
  // step then lands on the input in sight, never under a stale overlay.
  const press = () => { onTouch?.(); onOverlayGone?.() }
  return (
    <div className="s-step" data-field={field}>
      <HoldButton label={`أنقص ${unitLabel}`} onStep={() => onStep(-1)} onPress={press}>
        <Minus size={24} weight="bold" aria-hidden="true" />
      </HoldButton>
      <label className="s-field" ref={fieldRef} data-raise={raise ? '1' : undefined}
        onPointerDown={onTouch}>
        <span className="s-field-num" style={{ '--len': len, '--fit': fit }} data-rolling={overlay ? '1' : undefined}>
          <input
            type="text" inputMode="decimal" dir="ltr" size={1}
            aria-label={unitLabel}
            data-testid={inputTestId}
            placeholder="0"
            value={value ?? ''}
            onFocus={e => { onTouch?.(); onOverlayGone?.(); e.target.select() }}
            onChange={e => onInput(e.target.value)}
          />
          {overlay && <NumberOverlay key={overlay.id} show={overlay} onGone={onOverlayGone} />}
        </span>
        <span className="s-field-unit">{unit}</span>
        {ring && <RaiseRing hostRef={fieldRef} {...ring} />}
      </label>
      <HoldButton label={`زد ${unitLabel}`} onStep={() => onStep(1)} onPress={press}>
        <Plus size={24} weight="bold" aria-hidden="true" />
      </HoldButton>
    </div>
  )
}

export default function WorkingArea({
  ex, setIndex, editing = false,
  prevSet = null, coach = null,
  // When the engine says raise: { base, raised, intro: 'full' | 'sheen' | null,
  // introAt (performance.now() the intro counts from), breathe, onTouch,
  // claimIntro() — true once per showing, for the block that plays it }.
  raise = null,
  deloadPct = 0,           // a deload week: last time's numbers are the heavy ones
  onUpdateSet, onStepSet, onKeepBase,
}) {
  const set = ex.sets[setIndex]
  const [overlay, setOverlay] = useState(null)
  const [, force] = useState(0)
  const liveRef = useRef(null)
  const chipRef = useRef(null)
  const coachRef = useRef(null)
  const introRan = useRef(null)
  const introCur = useRef(null)     // the intro this render asks for (the sound checks it)
  const alive = useRef(true)
  const stepAt = useRef(0)          // when a stepper last changed the weight
  const lastW = useRef(set?.weight)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])
  // What the raise looked like on the last render of this exercise.
  const track = useRef({ ex: null, raised: null, delta: 0, leavingUntil: 0, quickUntil: 0 })

  const w = parseFloat(set?.weight)
  const raised = !!set && !!raise && Number.isFinite(w) && raise.base != null && w > raise.base
  const delta = raised ? Math.round((w - raise.base) * 100) / 100 : 0
  const reduce = reducedMotion()

  // Raised ↔ not, while this exercise is on screen: «خلّها» (or stepping
  // back down) sends the ring and the chip out; raising by hand redraws
  // the ring quickly. A new exercise starts with a clean slate.
  const now = typeof performance !== 'undefined' ? performance.now() : 0
  const inIntro = raise?.intro === 'full' && now < raise.introAt + T.ring + 900
  if (track.current.ex !== ex.id) track.current = { ex: ex.id, raised: null, delta: 0, leavingUntil: 0, quickUntil: 0 }
  if (raise) {
    const was = track.current.raised
    if (was != null && !reduce) {
      if (was && !raised) track.current.leavingUntil = now + 320
      if (!was && raised && !inIntro) track.current.quickUntil = now + 650
    }
    track.current.raised = raised
    if (delta) track.current.delta = delta
  }
  const retracting = !raised && now < track.current.leavingUntil
  useEffect(() => {
    if (!retracting) return
    const t = setTimeout(() => force(n => n + 1), Math.max(0, track.current.leavingUntil - performance.now()) + 10)
    return () => clearTimeout(t)
  }, [retracting])

  // A moving number belongs to the set it started on.
  useLayoutEffect(() => { setOverlay(null) }, [ex.id, setIndex])

  // A moving copy of the number only ever shows the number the input
  // holds: when the weight changes under it, it goes (and in this render
  // already — `shown` — so not even one frame shows a stale number). A
  // stepper's change rolls the new number in instead (180ms), while the
  // raise reminder is on this exercise.
  const wNow = kg(set?.weight)
  const shown = overlay && overlay.to === wNow ? overlay : null
  useLayoutEffect(() => {
    const before = lastW.current
    lastW.current = set?.weight
    if (before === set?.weight) return
    const a = kg(before)
    if (raise && !reduce && performance.now() - stepAt.current < 400 && a && wNow && a !== wNow) {
      const t = performance.now()
      setOverlay({ id: `step-${t}`, from: a, to: wNow, rollAt: t, stagger: 30, duration: 180 })
      return
    }
    setOverlay(o => (o && o.to !== wNow ? null : o))
  }, [set?.weight]) // eslint-disable-line react-hooks/exhaustive-deps

  // The intro, once per showing that asks for it — and only in the first
  // block to claim it, so a block that mounts again replays nothing.
  const introKey = raise?.intro && raised && !editing ? `${ex.id}|${raise.intro}|${raise.introAt}` : null
  introCur.current = introKey
  useLayoutEffect(() => {
    if (!introKey || introRan.current === introKey) return
    introRan.current = introKey
    if (raise.claimIntro && !raise.claimIntro()) return
    const at = raise.introAt
    const t = performance.now()
    if (raise.intro === 'full') {
      // The sound is not motion: it plays under reduced motion too. Not
      // cancelled by a re-run of this effect (StrictMode), only by the
      // block going or the intro being withdrawn (a set done first).
      setTimeout(() => {
        if (alive.current && introCur.current === introKey) play('raise')
      }, Math.max(0, at + T.roll - t))
      if (reduce) return
      setOverlay({ id: introKey, from: kg(raise.base), to: kg(set.weight), rollAt: at + T.roll, stagger: 45,
        color: [INK, GOLD], colorAt: at + T.roll, sheenAt: at + T.sheen, until: at + T.done })
      const chip = chipRef.current
      animate(chip, [{ opacity: 0, transform: 'translateX(-12px) scale(.96)' }, { opacity: 1, transform: 'none' }], { d: 260, delay: Math.max(0, at + T.chip - t) })
      animate(chip?.querySelector('svg'), [{ transform: 'translateY(0)' }, { transform: 'translateY(-4px)' }, { transform: 'translateY(0)' }], { d: 320, delay: Math.max(0, at + T.hop - t), fill: 'none' })
      animate(coachRef.current?.querySelector('.s-coach-adv'), [{ opacity: 0 }, { opacity: 1 }], { d: 240, delay: Math.max(0, at + T.adv - t) })
      animate(coachRef.current?.querySelector('.s-keep'), [{ opacity: 0 }, { opacity: 1 }], { d: 240, delay: Math.max(0, at + T.keep - t) })
      animate(liveRef.current?.querySelector('.s-field'), [
        { boxShadow: '0 0 0 0 rgba(251,191,36,0)' },
        { boxShadow: '0 0 0 0 rgba(251,191,36,0)', offset: 0.01 },
        { boxShadow: '0 0 26px 3px rgba(251,191,36,0.38)', offset: 0.45 },
        { boxShadow: '0 0 12px 0 rgba(251,191,36,0.16)' },
      ], { d: 600, delay: Math.max(0, at + T.flare - t), fill: 'backwards' })
      return
    }
    if (raise.intro === 'sheen' && !reduce) {
      setOverlay({ id: introKey, from: null, to: kg(set.weight), sheenAt: t + 150, until: t + 800 })
    }
  }, [introKey]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!set) return null

  const touch = () => raise?.onTouch?.()
  const keep = () => {
    touch()
    if (!reduce && raised) {
      setOverlay({ id: `keep-${performance.now()}`, from: kg(set.weight), to: kg(raise.base), rollAt: performance.now(),
        up: false, color: [GOLD, INK], colorAt: performance.now(), colorMs: 300 })
    }
    onKeepBase()
  }

  const showKeep = !!raise && raise.base != null && Number.isFinite(w) && w !== raise.base
  const prev = setWords(prevSet)
  // «حط أرقام آخر مرة» only when it would change something.
  const prevW = kg(prevSet?.weight)
  const prevR = parseInt(prevSet?.reps)
  const asLast = !!prev && (!prevW || kg(set.weight) === prevW) && (!(prevR > 0) || parseInt(set.reps) === prevR)

  // The ring: drawn in the intro, redrawn quickly when raised by hand,
  // withdrawn when the raise is put back; breathing until touched.
  const ring = raised ? {
    draw: reduce ? null : inIntro ? 'full' : now < track.current.quickUntil ? 'quick' : null,
    drawDelay: inIntro ? raise.introAt + T.ring - now : 0,
    breathe: !reduce && !!raise.breathe,
    breatheDelay: raise.intro === 'full' ? raise.introAt + T.breathe - now : 0,
  } : retracting ? { retract: true } : null
  const chipDelta = raised ? delta : retracting ? track.current.delta : 0
  // Raised by hand: the chip slides in with the quick ring. (In the intro
  // the intro moves it; on a new set's block it is simply there.)
  const chipEnter = raised && !inIntro && now < track.current.quickUntil

  return (
    <div className="s-live" data-testid="live-block" data-editing={editing ? '1' : undefined} ref={liveRef}>
      <div className="s-live-h">
        {editing ? (
          <span className="s-live-set">
            <PencilSimple size={18} weight="bold" aria-hidden="true" />
            تعديل المجموعة <Num>{setIndex + 1}</Num>
          </span>
        ) : (
          <span className="s-live-set">
            المجموعة <Num>{setIndex + 1}</Num>
            <span className="s-live-of">من <Num>{ex.sets.length}</Num></span>
          </span>
        )}
        {(raised || retracting) && chipDelta > 0 ? (
          <span ref={chipRef} className="s-raise-chip-w" data-leaving={retracting ? '1' : undefined}
            data-enter={chipEnter ? '1' : undefined}>
            <Chip tone="raise" icon={ArrowUp} className="s-raise-chip">
              <Num>+{kg(chipDelta)}</Num> كجم عن آخر مرة
            </Chip>
          </span>
        ) : prev && !editing && !asLast && !(deloadPct > 0) ? (
          // One tap puts last time's numbers back; the coach line under the
          // counters already says what they were, so this only says what it
          // does — as a command, like «خلّها 75» (a bare «زي آخر مرة» read as
          // a status, and a false one: it only shows when they differ). Not in
          // a deload week, where last time is the heavy week it is undoing.
          <button type="button" className="s-prev"
            aria-label={`حط أرقام آخر مرة: ${prev}`}
            onClick={() => {
              if (prevSet.weight !== '' && prevSet.weight != null) onUpdateSet(setIndex, 'weight', kg(prevSet.weight))
              if (parseInt(prevSet.reps) > 0) onUpdateSet(setIndex, 'reps', String(parseInt(prevSet.reps)))
            }}>
            حط أرقام آخر مرة
          </button>
        ) : null}
      </div>

      <Stepper
        field="weight" value={set.weight} unit="كجم" unitLabel="الوزن"
        inputTestId="weight-input"
        raise={raised} ring={ring}
        overlay={shown} onOverlayGone={() => setOverlay(null)}
        onTouch={raise ? touch : undefined}
        onInput={v => onUpdateSet(setIndex, 'weight', v)}
        onStep={dir => { stepAt.current = performance.now(); onStepSet(setIndex, 'weight', dir * 2.5) }}
      />
      <Stepper
        field="reps" value={set.reps} unit={repsWord(parseInt(set.reps))} unitLabel="العدّات"
        inputTestId="reps-input"
        onInput={v => onUpdateSet(setIndex, 'reps', v)}
        onStep={dir => onStepSet(setIndex, 'reps', dir)}
      />

      {(coach || showKeep) && (
        <div className="s-coach" ref={coachRef}>
          <span className="s-coach-text">{coach}</span>
          {showKeep && (
            <button type="button" className="s-keep" onClick={keep}>
              خلّها <Num>{kg(raise.base)}</Num>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
