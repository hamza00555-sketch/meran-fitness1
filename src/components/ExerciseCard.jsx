import { useState, useMemo } from 'react'
import { MUSCLE_GROUPS } from '../constants.js'
import { Badge } from './ui.jsx'
import { getExerciseStats } from '../utils.js'
import ExerciseInfoModal from './ExerciseInfoModal.jsx'

// PR celebration overlay
function PRFlash({ color }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <div style={{
        position: 'absolute',
        width: 120, height: 120, borderRadius: '50%',
        background: color + '40',
        animation: 'prRipple 0.6s ease-out forwards',
      }} />
      <div style={{
        background: color, borderRadius: 20,
        padding: '10px 24px',
        fontFamily: 'var(--font-ar)', fontSize: 18, fontWeight: 800,
        color: '#fff',
        animation: 'prFlash 0.5s ease forwards',
        boxShadow: `0 0 32px ${color}80`,
        zIndex: 1,
      }}>
        🏆 رقم قياسي جديد!
      </div>
    </div>
  )
}

// ± stepper buttons beside an input
function Stepper({ onUp, onDown, disabled }) {
  const base = {
    width: 30, height: 30, borderRadius: 7,
    border: '1px solid var(--border2)',
    background: 'var(--bg3)',
    color: 'var(--text2)',
    fontSize: 17, lineHeight: 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    opacity: disabled ? 0.38 : 1,
    transition: 'background 0.1s',
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <button
        onClick={disabled ? undefined : onUp}
        style={base}
        onPointerDown={e => !disabled && (e.currentTarget.style.background = 'var(--cyan-lo)')}
        onPointerUp={e => (e.currentTarget.style.background = 'var(--bg3)')}
        onPointerLeave={e => (e.currentTarget.style.background = 'var(--bg3)')}
      >+</button>
      <button
        onClick={disabled ? undefined : onDown}
        style={base}
        onPointerDown={e => !disabled && (e.currentTarget.style.background = 'var(--red-lo)')}
        onPointerUp={e => (e.currentTarget.style.background = 'var(--bg3)')}
        onPointerLeave={e => (e.currentTarget.style.background = 'var(--bg3)')}
      >−</button>
    </div>
  )
}

export default function ExerciseCard({ exercise: ex, onUpdateSet, onAddSet, onRemoveSet, onRemove, onDoneSet, sessions, allExercises = [], onMoveSet }) {
  const [showInfo,  setShowInfo]  = useState(false)
  const [showPR,    setShowPR]    = useState(false)
  const [copied,    setCopied]    = useState(false)
  const [movingSet, setMovingSet] = useState(null) // index of set being moved

  const group  = MUSCLE_GROUPS[ex.muscle] || {}
  const color  = group.color || 'var(--cyan)'
  const label  = group.label || ex.muscle
  const emoji  = group.emoji || '🏋️'
  const exDef  = (group.exercises || []).find(e => e.name === ex.name) || {}
  const ytUrl  = exDef.videoUrl ||
    `https://www.youtube.com/results?search_query=${encodeURIComponent(ex.name + ' proper form')}`

  const handleCopy = () => {
    navigator.clipboard.writeText(ex.name).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const { lastWeight, maxWeight } = useMemo(
    () => getExerciseStats(sessions, ex.name),
    [sessions, ex.name],
  )

  const handleDone = (si, done) => {
    if (done && maxWeight !== null) {
      const w = parseFloat(ex.sets[si]?.weight) || 0
      if (w > maxWeight) {
        setShowPR(true)
        setTimeout(() => setShowPR(false), 1800)
      }
    }
    onDoneSet(si, done)
  }

  const stepWeight = (si, delta) => {
    const cur = parseFloat(ex.sets[si]?.weight) || 0
    const next = Math.max(0, Math.round((cur + delta) * 10) / 10)
    onUpdateSet(si, 'weight', String(next))
  }

  const stepReps = (si, delta) => {
    const cur = parseInt(ex.sets[si]?.reps) || 0
    const next = Math.max(0, cur + delta)
    onUpdateSet(si, 'reps', String(next))
  }

  return (
    <>
      <div style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 12,
      }}>
        {/* Color accent bar */}
        <div style={{ height: 2, background: color }} />

        <div style={{ padding: '14px 14px 12px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Exercise name + copy button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
                  color: 'var(--text)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  flex: 1, minWidth: 0,
                }}>
                  {ex.name}
                </div>
                <button
                  onClick={handleCopy}
                  title="نسخ الاسم"
                  style={{
                    background: copied ? 'var(--green-lo)' : 'var(--bg3)',
                    border: `1px solid ${copied ? '#22C55E50' : 'var(--border)'}`,
                    borderRadius: 6, padding: '2px 7px',
                    color: copied ? 'var(--green)' : 'var(--text3)',
                    fontSize: 11, cursor: 'pointer', flexShrink: 0,
                    fontFamily: 'var(--font-mono)', transition: 'all 0.15s',
                    lineHeight: 1.6,
                  }}
                >{copied ? '✓' : '⎘'}</button>
              </div>

              {/* Badges row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Badge color={color}>{emoji} {label}</Badge>

                {/* YouTube tag */}
                {ytUrl && (
                  <a
                    href={ytUrl} target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: 'rgba(255,0,0,0.10)', border: '1px solid rgba(255,0,0,0.28)',
                      borderRadius: 10, padding: '2px 8px',
                      fontSize: 10, color: '#FF4444', fontWeight: 700,
                      textDecoration: 'none', fontFamily: 'var(--font-mono)',
                      transition: 'background 0.15s',
                      flexShrink: 0,
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,0,0,0.18)'}
                    onMouseOut={e => e.currentTarget.style.background = 'rgba(255,0,0,0.10)'}
                  >
                    ▶ YouTube
                  </a>
                )}

                {lastWeight !== null && (
                  <span style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)' }}>
                    آخر <span style={{ color: 'var(--text2)', fontWeight: 700 }}>{lastWeight}kg</span>
                    {maxWeight !== null && maxWeight !== lastWeight && (
                      <> · أعلى <span style={{ color, fontWeight: 700 }}>{maxWeight}kg</span></>
                    )}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginRight: 4 }}>
              <button
                onClick={() => setShowInfo(true)}
                title="معلومات التمرين"
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--text3)', fontSize: 16,
                  cursor: 'pointer', padding: '0 6px', lineHeight: 1,
                  transition: 'color 0.15s',
                }}
                onMouseOver={e => e.currentTarget.style.color = color}
                onMouseOut={e => e.currentTarget.style.color = 'var(--text3)'}
              >ℹ</button>
              <button
                onClick={onRemove}
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--text3)', fontSize: 20,
                  cursor: 'pointer', padding: '0 0 0 4px', lineHeight: 1,
                  transition: 'color 0.15s',
                }}
                onMouseOver={e => e.currentTarget.style.color = 'var(--red)'}
                onMouseOut={e => e.currentTarget.style.color = 'var(--text3)'}
              >×</button>
            </div>
          </div>

          {/* Column headers: # | weight | ± | reps | ± | ✓ */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '20px 1fr 32px 1fr 32px 42px',
            gap: 4, marginBottom: 6, alignItems: 'center',
          }}>
            {['#', 'الوزن', '', 'التكرار', '', ''].map((h, i) => (
              <div key={i} style={{
                fontFamily: (h === 'الوزن' || h === 'التكرار') ? 'var(--font-ar)' : 'var(--font-mono)',
                fontSize: (h === 'الوزن' || h === 'التكرار') ? 11 : 10,
                color: 'var(--text3)', textAlign: 'center',
              }}>{h}</div>
            ))}
          </div>

          {/* Set rows */}
          {ex.sets.map((s, si) => (
            <div key={si}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '20px 1fr 32px 1fr 32px 42px',
                  gap: 4, marginBottom: movingSet === si ? 2 : 7, alignItems: 'center',
                  opacity: s.done ? 0.55 : 1,
                  transition: 'opacity 0.25s',
                }}
              >
                {/* # — tap to open move picker */}
                <button
                  onClick={() => setMovingSet(movingSet === si ? null : si)}
                  title="نقل إلى تمرين آخر"
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    textAlign: 'center', cursor: 'pointer',
                    background: movingSet === si ? color : 'none',
                    border: movingSet === si ? `1px solid ${color}` : '1px solid transparent',
                    borderRadius: 5, color: movingSet === si ? '#0a0a0a' : 'var(--text3)',
                    width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 0, transition: 'all 0.15s',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >{movingSet === si ? '⇄' : si + 1}</button>

                {/* Weight */}
                <input
                  type="number" inputMode="decimal"
                  value={s.weight}
                  onChange={e => onUpdateSet(si, 'weight', e.target.value)}
                  placeholder={lastWeight !== null ? String(lastWeight) : '0'}
                  disabled={s.done}
                  style={{
                    background: s.done ? 'var(--bg)' : 'var(--bg3)',
                    border: `1px solid ${s.done ? 'var(--border)' : (s.weight ? color + '55' : 'var(--border)')}`,
                    borderRadius: 8, padding: '9px 4px',
                    color: s.done ? 'var(--text3)' : 'var(--text)',
                    fontFamily: 'var(--font-mono)', fontSize: 13,
                    textAlign: 'center', outline: 'none', width: '100%',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => !s.done && (e.target.style.borderColor = color)}
                  onBlur={e => e.target.style.borderColor = s.weight ? color + '55' : 'var(--border)'}
                />
                <Stepper disabled={s.done} onUp={() => stepWeight(si, 2.5)} onDown={() => stepWeight(si, -2.5)} />

                {/* Reps */}
                <input
                  type="number" inputMode="numeric"
                  value={s.reps}
                  onChange={e => onUpdateSet(si, 'reps', e.target.value)}
                  placeholder="0"
                  disabled={s.done}
                  style={{
                    background: s.done ? 'var(--bg)' : 'var(--bg3)',
                    border: `1px solid ${s.done ? 'var(--border)' : (s.reps ? color + '55' : 'var(--border)')}`,
                    borderRadius: 8, padding: '9px 4px',
                    color: s.done ? 'var(--text3)' : 'var(--text)',
                    fontFamily: 'var(--font-mono)', fontSize: 13,
                    textAlign: 'center', outline: 'none', width: '100%',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => !s.done && (e.target.style.borderColor = color)}
                  onBlur={e => e.target.style.borderColor = s.reps ? color + '55' : 'var(--border)'}
                />
                <Stepper disabled={s.done} onUp={() => stepReps(si, 1)} onDown={() => stepReps(si, -1)} />

                {/* Done button */}
                <button
                  onClick={() => handleDone(si, !s.done)}
                  style={{
                    width: 42, height: 42, borderRadius: '50%',
                    border: `2px solid ${s.done ? 'var(--green)' : 'var(--border2)'}`,
                    background: s.done ? 'var(--green)' : 'transparent',
                    cursor: 'pointer', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, color: s.done ? '#0a0a0a' : 'var(--text3)',
                    transition: 'all 0.2s',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >{s.done ? '✓' : ''}</button>
              </div>

              {/* Move picker — inline dropdown */}
              {movingSet === si && allExercises.filter(e => e.id !== ex.id).length > 0 && (
                <div style={{
                  marginBottom: 8, marginRight: 24,
                  background: 'var(--bg3)', border: `1px solid ${color}55`,
                  borderRadius: 10, overflow: 'hidden',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--text3)',
                    padding: '6px 10px 4px',
                  }}>نقل Set {si + 1} إلى:</div>
                  {allExercises.filter(e => e.id !== ex.id).map(target => (
                    <button
                      key={target.id}
                      onClick={() => {
                        onMoveSet?.(si, target.id)
                        setMovingSet(null)
                      }}
                      style={{
                        width: '100%', background: 'none',
                        border: 'none', borderTop: '1px solid var(--border)',
                        padding: '9px 10px', textAlign: 'right',
                        fontFamily: 'var(--font-mono)', fontSize: 12,
                        color: 'var(--text2)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                      onPointerDown={e => e.currentTarget.style.background = 'var(--bg2)'}
                      onPointerUp={e => e.currentTarget.style.background = 'none'}
                      onPointerLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <span style={{ color: MUSCLE_GROUPS[target.muscle]?.color || 'var(--cyan)', fontSize: 10 }}>●</span>
                      {target.name}
                    </button>
                  ))}
                </div>
              )}
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
                  color: 'var(--text3)', fontSize: 12,
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

      {showPR   && <PRFlash color={color} />}
      {showInfo && <ExerciseInfoModal exercise={ex} onClose={() => setShowInfo(false)} />}
    </>
  )
}
