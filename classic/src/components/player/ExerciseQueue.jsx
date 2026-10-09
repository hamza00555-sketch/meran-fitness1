import { toWesternDigits } from '../../day.js'

// ── The whole session at a glance ─────────────────────────────
// Secondary navigation under the working area: every exercise, its
// done-count, its state. A tap scrolls the carousel there — nothing
// more. The lock glyph on inactive rows is the reference design's way
// of saying "viewable, not editable", which is exactly the focus rule.

export default function ExerciseQueue({ exercises, activeIndex, onJump, onAdd }) {
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', padding: '8px 6px',
    }}>
      <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, fontWeight: 700, color: 'var(--text2)', padding: '2px 8px 6px' }}>
        التالي في التمرين
      </div>
      {exercises.map((ex, i) => {
        const done = ex.sets.filter(s => s.done).length
        const complete = ex.sets.length > 0 && done === ex.sets.length
        const isActive = i === activeIndex
        return (
          <button
            key={ex.id}
            onClick={() => onJump(i)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
              background: isActive ? 'var(--cyan-lo)' : 'none',
              border: isActive ? '1px solid var(--cyan-md)' : '1px solid transparent',
              opacity: isActive || complete ? 1 : 0.6,
            }}
          >
            <span style={{
              width: 18, textAlign: 'center', flexShrink: 0,
              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
              color: isActive ? 'var(--cyan)' : 'var(--text3)',
            }}>{toWesternDigits(i + 1)}</span>
            <span style={{
              flex: 1, textAlign: 'right', minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: isActive ? 800 : 600,
              color: isActive ? 'var(--cyan)' : complete ? 'var(--text3)' : 'var(--text2)',
            }}>{ex.name}</span>
            <span style={{
              flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 12,
              color: complete ? '#22C55E' : isActive ? 'var(--cyan)' : 'var(--text3)',
            }}>{toWesternDigits(done)}/{toWesternDigits(ex.sets.length)}</span>
            <span style={{ flexShrink: 0, fontSize: 12, width: 16, textAlign: 'center' }}>
              {complete ? <span style={{ color: '#22C55E' }}>✓</span>
                : isActive ? <span style={{ color: 'var(--cyan)' }}>▶</span>
                : <span style={{ opacity: 0.45 }}>🔒</span>}
            </span>
          </button>
        )
      })}
      <button
        onClick={onAdd}
        style={{
          display: 'block', width: '100%', marginTop: 4, padding: '10px',
          background: 'none', border: '1px dashed var(--border2)', borderRadius: 10,
          color: 'var(--text3)', fontFamily: 'var(--font-ar)', fontSize: 13, cursor: 'pointer',
        }}
      >＋ إضافة تمرين</button>
    </div>
  )
}
