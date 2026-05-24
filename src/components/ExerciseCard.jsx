import { useState, useMemo } from 'react'
import { MUSCLE_GROUPS } from '../constants.js'
import { Badge } from './ui.jsx'
import { getExerciseStats } from '../utils.js'
import ExerciseInfoModal from './ExerciseInfoModal.jsx'

export default function ExerciseCard({ exercise: ex, onUpdateSet, onAddSet, onRemoveSet, onRemove, onDoneSet, sessions }) {
  const [showInfo, setShowInfo] = useState(false)

  const group = MUSCLE_GROUPS[ex.muscle] || {}
  const color = group.color || 'var(--cyan)'
  const label = group.label || ex.muscle
  const emoji = group.emoji || '🏋️'

  const { lastWeight, maxWeight } = useMemo(
    () => getExerciseStats(sessions, ex.name),
    [sessions, ex.name],
  )

  return (
    <>
      <div style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 12,
      }}>
        {/* Color top bar */}
        <div style={{ height: 3, background: `linear-gradient(90deg, ${color}, transparent)` }} />

        <div style={{ padding: '14px 14px 12px' }}>
          {/* Exercise header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
                color: 'var(--text)', marginBottom: 4,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {ex.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Badge color={color}>{emoji} {label}</Badge>
                {/* Last / Max weight badges */}
                {lastWeight !== null && (
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10,
                    color: 'var(--text3)',
                  }}>
                    آخر <span style={{ color: 'var(--text2)', fontWeight: 700 }}>{lastWeight}kg</span>
                    {maxWeight !== null && maxWeight !== lastWeight && (
                      <> · أعلى <span style={{ color, fontWeight: 700 }}>{maxWeight}kg</span></>
                    )}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              {/* Info button */}
              <button
                onClick={() => setShowInfo(true)}
                title="معلومات التمرين"
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--text3)', fontSize: 16,
                  cursor: 'pointer', padding: '0 6px',
                  lineHeight: 1, transition: 'color 0.15s',
                }}
                onMouseOver={e => e.currentTarget.style.color = color}
                onMouseOut={e => e.currentTarget.style.color = 'var(--text3)'}
              >ℹ</button>
              {/* Remove button */}
              <button
                onClick={onRemove}
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--text3)', fontSize: 20,
                  cursor: 'pointer', padding: '0 0 0 4px',
                  lineHeight: 1, transition: 'color 0.15s',
                }}
                onMouseOver={e => e.currentTarget.style.color = 'var(--red)'}
                onMouseOut={e => e.currentTarget.style.color = 'var(--text3)'}
              >×</button>
            </div>
          </div>

          {/* Sets header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '24px 1fr 1fr 32px',
            gap: 6, marginBottom: 6, marginTop: 10,
          }}>
            {['#', 'الوزن kg', 'التكرار', '✓'].map(h => (
              <div key={h} style={{
                fontFamily: 'var(--font-mono)', fontSize: 9,
                color: 'var(--text3)', textAlign: 'center',
              }}>{h}</div>
            ))}
          </div>

          {/* Sets rows */}
          {ex.sets.map((s, si) => (
            <div
              key={si}
              style={{
                display: 'grid',
                gridTemplateColumns: '24px 1fr 1fr 32px',
                gap: 6, marginBottom: 6,
                opacity: s.done ? 0.5 : 1,
                transition: 'opacity 0.25s',
              }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)',
              }}>{si + 1}</div>

              <input
                type="number" inputMode="decimal"
                value={s.weight}
                onChange={e => onUpdateSet(si, 'weight', e.target.value)}
                placeholder={lastWeight !== null ? String(lastWeight) : '0'}
                disabled={s.done}
                style={{
                  background: s.done ? 'var(--bg)' : 'var(--bg3)',
                  border: `1px solid ${s.done ? 'var(--border)' : (s.weight ? color + '55' : 'var(--border)')}`,
                  borderRadius: 8, padding: '8px 4px',
                  color: s.done ? 'var(--text3)' : 'var(--text)',
                  fontFamily: 'var(--font-mono)', fontSize: 13,
                  textAlign: 'center', outline: 'none', width: '100%',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => !s.done && (e.target.style.borderColor = color)}
                onBlur={e => e.target.style.borderColor = s.weight ? color + '55' : 'var(--border)'}
              />

              <input
                type="number" inputMode="numeric"
                value={s.reps}
                onChange={e => onUpdateSet(si, 'reps', e.target.value)}
                placeholder="0"
                disabled={s.done}
                style={{
                  background: s.done ? 'var(--bg)' : 'var(--bg3)',
                  border: `1px solid ${s.done ? 'var(--border)' : (s.reps ? color + '55' : 'var(--border)')}`,
                  borderRadius: 8, padding: '8px 4px',
                  color: s.done ? 'var(--text3)' : 'var(--text)',
                  fontFamily: 'var(--font-mono)', fontSize: 13,
                  textAlign: 'center', outline: 'none', width: '100%',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => !s.done && (e.target.style.borderColor = color)}
                onBlur={e => e.target.style.borderColor = s.reps ? color + '55' : 'var(--border)'}
              />

              <button
                onClick={() => onDoneSet(si, !s.done)}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  border: `2px solid ${s.done ? 'var(--green)' : 'var(--border2)'}`,
                  background: s.done ? 'var(--green)' : 'transparent',
                  cursor: 'pointer', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: '#0a0a0a',
                  transition: 'all 0.2s',
                }}
              >{s.done ? '✓' : ''}</button>
            </div>
          ))}

          {/* Footer */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <button
              onClick={onAddSet}
              style={{
                background: 'none', border: '1px dashed var(--border)',
                borderRadius: 8, padding: '5px 14px',
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
                  color: 'var(--text3)', fontSize: 11,
                  fontFamily: 'var(--font-ar)', cursor: 'pointer',
                  transition: 'color 0.15s',
                }}
                onMouseOver={e => e.currentTarget.style.color = 'var(--red)'}
                onMouseOut={e => e.currentTarget.style.color = 'var(--text3)'}
              >حذف آخر سيت</button>
            )}

            <div style={{ flex: 1 }} />

            {ex.sets.some(s => s.done && s.weight && s.reps) && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)' }}>
                vol: {ex.sets.filter(s => s.done)
                  .reduce((t, s) => t + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0)}kg
              </span>
            )}
          </div>
        </div>
      </div>

      {showInfo && (
        <ExerciseInfoModal exercise={ex} onClose={() => setShowInfo(false)} />
      )}
    </>
  )
}
