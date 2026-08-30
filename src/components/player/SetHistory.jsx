import { toWesternDigits } from '../../day.js'

// ── The sets so far, compact ──────────────────────────────────
// One row per set: number, weight×reps, state. Tapping a completed row
// hands it to the working area in its loudly-labelled editing mode —
// the row itself never becomes an input, so a past set can't be
// changed by a stray thumb.

export default function SetHistory({ ex, currentIndex, editingIndex, onEdit }) {
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', padding: '10px 12px',
    }}>
      <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>
        المجموعات السابقة
      </div>
      {ex.sets.map((s, i) => {
        const isCurrent = i === currentIndex
        const isEditing = i === editingIndex
        const has = s.done && (parseFloat(s.weight) > 0 || parseInt(s.reps) > 0)
        return (
          <div
            key={i}
            onClick={() => s.done && onEdit(i)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 4px',
              borderTop: i ? '1px solid var(--border)' : 'none',
              cursor: s.done ? 'pointer' : 'default',
              background: isEditing ? 'var(--gold-lo)' : 'none',
              borderRadius: isEditing ? 8 : 0,
            }}
          >
            <span style={{
              width: 18, textAlign: 'center', flexShrink: 0,
              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
              color: isCurrent ? 'var(--cyan)' : 'var(--text3)',
            }}>{toWesternDigits(i + 1)}</span>
            <span style={{
              flex: 1, fontFamily: 'var(--font-mono)', fontSize: 13,
              color: has ? 'var(--text2)' : 'var(--text3)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {has ? `${s.weight} × ${s.reps}` : isCurrent ? '· · ·' : '—'}
            </span>
            <span style={{ fontSize: 13, flexShrink: 0 }}>
              {s.done
                ? <span style={{ color: '#22C55E' }}>✓</span>
                : <span style={{
                    display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
                    border: `1.5px solid ${isCurrent ? 'var(--cyan)' : 'var(--border2)'}`,
                  }} />}
            </span>
          </div>
        )
      })}
    </div>
  )
}
