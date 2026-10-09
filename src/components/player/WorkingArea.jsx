import { useEffect, useRef } from 'react'
import { Chip, Num } from '../kit/index.jsx'
import { ArrowUp, Minus, Plus, PencilSimple } from '../kit/icons.js'
import RaiseRing from './RaiseRing.jsx'
import { primeAudio } from './sessionAudio.js'
import { kg, setLabel } from './sessionWords.js'

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

// Hold to repeat: one step on press, then after 400ms every 150ms,
// stepping up to 100ms after 1.5s — never faster. Stops on release,
// cancel or leaving the button. A keyboard press still steps once.
function HoldButton({ label, onStep, children }) {
  const timer = useRef(null)
  const started = useRef(0)
  const step = useRef(onStep)
  step.current = onStep

  const stop = (e) => {
    clearTimeout(timer.current)
    timer.current = null
    e?.currentTarget?.removeAttribute?.('data-held')
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  const loop = () => {
    const held = performance.now() - started.current
    timer.current = setTimeout(() => { step.current(); loop() }, held > 1500 ? 100 : 150)
  }

  return (
    <button
      type="button"
      className="s-step-btn"
      aria-label={label}
      onPointerDown={(e) => {
        if (e.button != null && e.button !== 0) return
        primeAudio()
        e.currentTarget.setAttribute('data-held', '1')
        try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch {}
        started.current = performance.now()
        step.current()
        clearTimeout(timer.current)
        timer.current = setTimeout(loop, 400)
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        // A pointer press already stepped on pointerdown; only a keyboard
        // activation (a click with no pointer behind it, detail 0) steps here.
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
  const len = Math.max(1, String(value ?? '').length)
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
  const prev = setLabel(prevSet)

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
        ) : prev && !editing ? (
          <button type="button" className="s-prev"
            aria-label={`انسخ السابق ${prev}`}
            onClick={() => {
              if (prevSet.weight !== '' && prevSet.weight != null) onUpdateSet(setIndex, 'weight', kg(prevSet.weight))
              if (parseInt(prevSet.reps) > 0) onUpdateSet(setIndex, 'reps', String(parseInt(prevSet.reps)))
            }}>
            السابق <Num>{prev}</Num>
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
