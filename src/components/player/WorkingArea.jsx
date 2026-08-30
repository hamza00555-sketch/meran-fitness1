import { useRef } from 'react'
import { toWesternDigits } from '../../day.js'

// ── The current set, made the size it deserves ────────────────
//
// The one place a hand with chalk on it interacts with the app. The
// numbers are enormous, the buttons are thumb-sized, and tapping a
// number opens the keyboard for direct entry. The steppers move by the
// same amounts the old card used — ±2.5kg, ±1 rep — because that is
// the granularity the gym actually has.
//
// Everything routes through the same handlers the old card called:
// completing a set here IS onDoneSet, with its XP, its rest timer and
// its PR check. This component decides sizes, never rules.

function BigStepper({ value, unit, onInput, onStep }) {
  const inputRef = useRef(null)
  const round = {
    width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
    background: 'var(--bg3)', border: '1px solid var(--border2)',
    color: 'var(--text)', fontSize: 24, fontWeight: 700,
    cursor: 'pointer', lineHeight: 1,
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <button style={round} onClick={() => onStep(-1)} aria-label={`أنقص ${unit}`}>−</button>
      <div
        onClick={() => inputRef.current?.focus()}
        style={{
          // minWidth 0 lets the flex item shrink below the input's
          // intrinsic width — without it, a text input's default size
          // blows the whole card past a small phone's viewport.
          flex: 1, minWidth: 0, background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '8px 6px', textAlign: 'center', cursor: 'text',
        }}
      >
        <input
          ref={inputRef}
          type="text" inputMode="decimal" size={1}
          value={value}
          onChange={e => onInput(e.target.value)}
          style={{
            width: '100%', minWidth: 0, background: 'none', border: 'none', outline: 'none',
            textAlign: 'center', color: 'var(--text)',
            fontFamily: 'var(--font-mono)', fontSize: 34, fontWeight: 800,
            fontVariantNumeric: 'tabular-nums', padding: 0,
          }}
        />
        <div style={{ fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--text3)', marginTop: -2 }}>
          {unit}
        </div>
      </div>
      <button style={round} onClick={() => onStep(1)} aria-label={`زد ${unit}`}>+</button>
    </div>
  )
}

export default function WorkingArea({
  ex, setIndex, editing = false,
  lastWeight, suggested, target,
  onUpdateSet, onStepWeight, onStepReps, onComplete, onDoneEditing,
}) {
  const set = ex.sets[setIndex]
  if (!set) return null

  const ctxCell = { flex: 1, textAlign: 'center', minWidth: 0 }
  const ctxLabel = { fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--text3)', marginBottom: 2 }
  const ctxValue = { fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 800, color: 'var(--text2)' }

  return (
    <div style={{
      background: 'var(--bg2)',
      border: `1px solid ${editing ? 'var(--gold-md)' : 'var(--border)'}`,
      borderRadius: 'var(--radius)', padding: 16,
    }}>
      {/* Which set — or a loud flag that this is surgery on a past one */}
      {editing ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontFamily: 'var(--font-ar)', fontSize: 14, fontWeight: 800,
          color: 'var(--gold)', marginBottom: 12,
        }}>
          ✏️ تعديل مجموعة سابقة · سيت {toWesternDigits(setIndex + 1)}
        </div>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8, marginBottom: 12,
        }}>
          <span style={{ fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
            المجموعة الحالية
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 800, color: 'var(--cyan)' }}>
            {toWesternDigits(setIndex + 1)} من {toWesternDigits(ex.sets.length)}
          </span>
        </div>
      )}

      {/* Context: what happened, what's suggested, what's the aim */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 14,
        borderBlock: '1px solid var(--border)', padding: '9px 0',
      }}>
        <div style={ctxCell}>
          <div style={ctxLabel}>آخر مرة</div>
          <div style={ctxValue}>{lastWeight != null ? `${lastWeight}kg` : '—'}</div>
        </div>
        <div style={{ width: 1, background: 'var(--border)' }} />
        <div style={ctxCell}>
          <div style={ctxLabel}>الوزن المقترح</div>
          <div style={{ ...ctxValue, color: 'var(--cyan)' }}>{suggested ? `${suggested}kg` : '—'}</div>
        </div>
        <div style={{ width: 1, background: 'var(--border)' }} />
        <div style={ctxCell}>
          <div style={ctxLabel}>هدفك</div>
          <div style={ctxValue}>{target ? `${target.base}–${target.top} تكرار` : '—'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
        <BigStepper
          value={set.weight} unit="كغ"
          onInput={v => onUpdateSet(setIndex, 'weight', v)}
          onStep={dir => onStepWeight(setIndex, dir * 2.5)}
        />
        <BigStepper
          value={set.reps} unit="تكرار"
          onInput={v => onUpdateSet(setIndex, 'reps', v)}
          onStep={dir => onStepReps(setIndex, dir * 1)}
        />
      </div>

      {editing ? (
        <button
          onClick={onDoneEditing}
          style={{
            width: '100%', padding: '15px', borderRadius: 14, border: 'none',
            background: 'var(--gold)', color: '#0A0A0A',
            fontFamily: 'var(--font-ar)', fontSize: 16, fontWeight: 800, cursor: 'pointer',
          }}
        >✓ حفظ التعديل</button>
      ) : (
        <button
          className="btn-cyan"
          onClick={() => onComplete(setIndex)}
          style={{ padding: '15px', fontSize: 17 }}
        >✓ إنهاء المجموعة</button>
      )}

      <div style={{
        marginTop: 8, textAlign: 'center',
        fontFamily: 'var(--font-ar)', fontSize: 10, color: 'var(--text3)', opacity: 0.75,
      }}>
        🔒 يمكنك تعديل الأوزان والتكرارات للمجموعة النشطة فقط
      </div>
    </div>
  )
}
