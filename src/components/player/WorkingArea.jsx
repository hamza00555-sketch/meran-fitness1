import { useEffect, useRef } from 'react'
import { Chip, Num } from '../kit/index.jsx'
import { ArrowUp, Minus, Plus, PencilSimple } from '../kit/icons.js'
import RaiseRing from './RaiseRing.jsx'
import { primeAudio } from './sessionAudio.js'
import { kg, setWords } from './sessionWords.js'

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
// number itself is gold and already holds the new weight, with a gold
// ring drawn once around it, a chip saying by how much, and «خلّها 75»
// to put it back in one tap. No other gold on the screen.

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

function HoldButton({ label, onStep, children }) {
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
        step.current()
      }}
    >
      {children}
    </button>
  )
}

function Stepper({ field, value, unit, unitLabel, onInput, onStep, raise, ring, ringDraw, inputTestId }) {
  const fieldRef = useRef(null)
  // The number's width in digits (a point is half a digit). The CSS sizes
  // the input to it and shrinks the type when a long weight («202.5»)
  // would otherwise run into the steppers on a narrow phone.
  const len = Math.max(1, [...String(value ?? '')].reduce((n, c) => n + (c === '.' || c === ',' ? 0.5 : 1), 0))
  return (
    <div className="s-step" data-field={field}>
      <HoldButton label={`أنقص ${unitLabel}`} onStep={() => onStep(-1)}>
        <Minus size={24} weight="bold" aria-hidden="true" />
      </HoldButton>
      <label className="s-field" ref={fieldRef} data-raise={raise ? '1' : undefined}>
        <input
          type="text" inputMode="decimal" dir="ltr" size={1}
          aria-label={unitLabel}
          data-testid={inputTestId}
          placeholder="0"
          value={value ?? ''}
          style={{ '--len': len }}
          onFocus={e => e.target.select()}
          onChange={e => onInput(e.target.value)}
        />
        <span className="s-field-unit">{unit}</span>
        {ring && <RaiseRing hostRef={fieldRef} draw={ringDraw} />}
      </label>
      <HoldButton label={`زد ${unitLabel}`} onStep={() => onStep(1)}>
        <Plus size={24} weight="bold" aria-hidden="true" />
      </HoldButton>
    </div>
  )
}

export default function WorkingArea({
  ex, setIndex, editing = false,
  prevSet = null, coach = null,
  raise = null,            // { base, raised, ringDraw } when the engine says raise
  onUpdateSet, onStepSet, onKeepBase,
}) {
  const set = ex.sets[setIndex]
  if (!set) return null

  const w = parseFloat(set.weight)
  const raised = !!raise && Number.isFinite(w) && raise.base != null && w > raise.base
  const delta = raised ? Math.round((w - raise.base) * 100) / 100 : 0
  const showKeep = !!raise && raise.base != null && Number.isFinite(w) && w !== raise.base
  const prev = setWords(prevSet)
  // «زي آخر مرة» only when it would change something.
  const prevW = kg(prevSet?.weight)
  const prevR = parseInt(prevSet?.reps)
  const asLast = !!prev && (!prevW || kg(set.weight) === prevW) && (!(prevR > 0) || parseInt(set.reps) === prevR)

  return (
    <div className="s-live" data-testid="live-block" data-editing={editing ? '1' : undefined}>
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
        {raised ? (
          <Chip tone="raise" icon={ArrowUp} className="s-raise-chip">
            <Num>+{kg(delta)}</Num> كجم عن آخر مرة
          </Chip>
        ) : prev && !editing && !asLast ? (
          // One tap puts last time's numbers back; the coach line under the
          // counters already says what they were, so this only says what it does.
          <button type="button" className="s-prev"
            aria-label={`زي آخر مرة: ${prev}`}
            onClick={() => {
              if (prevSet.weight !== '' && prevSet.weight != null) onUpdateSet(setIndex, 'weight', kg(prevSet.weight))
              if (parseInt(prevSet.reps) > 0) onUpdateSet(setIndex, 'reps', String(parseInt(prevSet.reps)))
            }}>
            زي آخر مرة
          </button>
        ) : null}
      </div>

      <Stepper
        field="weight" value={set.weight} unit="كجم" unitLabel="الوزن"
        inputTestId="weight-input"
        raise={raised} ring={raised} ringDraw={!!raise?.ringDraw}
        onInput={v => onUpdateSet(setIndex, 'weight', v)}
        onStep={dir => onStepSet(setIndex, 'weight', dir * 2.5)}
      />
      <Stepper
        field="reps" value={set.reps} unit="عدّة" unitLabel="العدّات"
        inputTestId="reps-input"
        onInput={v => onUpdateSet(setIndex, 'reps', v)}
        onStep={dir => onStepSet(setIndex, 'reps', dir)}
      />

      {(coach || showKeep) && (
        <div className="s-coach">
          <span className="s-coach-text">{coach}</span>
          {showKeep && (
            <button type="button" className="s-keep" onClick={onKeepBase}>
              خلّها <Num>{kg(raise.base)}</Num>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
