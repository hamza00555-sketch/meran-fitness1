import { MUSCLE_GROUPS } from '../constants.js'
import { Badge, Btn } from './ui.jsx'

export default function ExerciseCard({ exercise: ex, onUpdateSet, onAddSet, onRemoveSet, onRemove, prevPerf, onDoneSet }) {
  const color = MUSCLE_GROUPS[ex.muscle]?.color || 'var(--orange)'
  const groupEmoji = MUSCLE_GROUPS[ex.muscle]?.emoji || ''

  return (
    <div style={{
      background: 'var(--bg2)',
      border: `1px solid var(--border)`,
      borderRadius: 14,
      overflow: 'hidden',
      marginBottom: 12,
      transition: 'border-color 0.2s',
    }}>
      {/* Color top bar */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${color}, transparent)` }} />

      <div style={{ padding: '14px 14px 12px' }}>
        {/* Exercise header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{ex.emoji}</span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600,
                color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>{ex.name}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge color={color}>{groupEmoji} {ex.muscle}</Badge>
              {prevPerf && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text4)',
                }}>prev: {prevPerf}</span>
              )}
            </div>
          </div>
          <button
            onClick={onRemove}
            style={{
              background: 'none', border: 'none',
              color: 'var(--text4)', fontSize: 18,
              cursor: 'pointer', padding: '0 0 0 8px', lineHeight: 1,
              flexShrink: 0, transition: 'color 0.15s',
            }}
            onMouseOver={e => e.currentTarget.style.color = '#EF4444'}
            onMouseOut={e => e.currentTarget.style.color = 'var(--text4)'}
          >×</button>
        </div>

        {/* Sets rows — no header, no set-number column: [Weight][R1][R2][R3][✓] */}
        {ex.sets.map((s, si) => (
          <div
            key={si}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr 32px',
              gap: 4, marginBottom: 5,
              opacity: s.done ? 0.45 : 1,
              transition: 'opacity 0.25s',
            }}
          >
            {/* Weight + Reps inputs */}
            {['weight', 'r1', 'r2', 'r3'].map(field => (
              <input
                key={field}
                type="number"
                inputMode="decimal"
                value={s[field]}
                onChange={e => onUpdateSet(si, field, e.target.value)}
                placeholder={field === 'weight' ? 'kg' : '—'}
                disabled={s.done}
                style={{
                  background: s.done ? 'var(--bg)' : '#0d0d0d',
                  border: `1px solid ${s.done ? 'var(--border)' : (s[field] ? color + '44' : 'var(--border)')}`,
                  borderRadius: 6,
                  padding: '7px 2px',
                  color: s.done ? 'var(--text3)' : 'var(--text)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  textAlign: 'center',
                  outline: 'none',
                  width: '100%',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => !s.done && (e.target.style.borderColor = color)}
                onBlur={e => e.target.style.borderColor = s[field] ? color + '44' : 'var(--border)'}
              />
            ))}

            {/* Done toggle */}
            <button
              onClick={() => onDoneSet(si, !s.done)}
              style={{
                width: 32, height: 32,
                borderRadius: '50%',
                border: `2px solid ${s.done ? 'var(--green)' : 'var(--border2)'}`,
                background: s.done ? 'var(--green)' : 'transparent',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: s.done ? 14 : 0,
                color: '#0a0a0a',
                transition: 'all 0.2s',
                flexShrink: 0,
              }}
            >{s.done ? '✓' : ''}</button>
          </div>
        ))}

        {/* Footer actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={onAddSet}
            style={{
              background: 'none', border: '1px dashed var(--border)',
              borderRadius: 8, padding: '5px 13px',
              color: 'var(--text3)', fontSize: 12,
              fontFamily: 'var(--font-ar)', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color }}
            onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text3)' }}
          >+ سيت</button>

          {ex.sets.length > 1 && (
            <button
              onClick={() => onRemoveSet(ex.sets.length - 1)}
              style={{
                background: 'none', border: 'none',
                color: 'var(--text4)', fontSize: 11,
                fontFamily: 'var(--font-ar)', cursor: 'pointer',
              }}
            >حذف آخر سيت</button>
          )}

          <div style={{ flex: 1 }} />

          {/* Mini stats */}
          {ex.sets.some(s => s.done && s.weight) && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text4)', alignSelf: 'center' }}>
              max: {Math.max(...ex.sets.filter(s => s.done).map(s => parseFloat(s.weight) || 0))}kg
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
