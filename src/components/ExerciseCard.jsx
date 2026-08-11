import { useState, useMemo } from 'react'
import Art from '../assets/Art.jsx'
import { createPortal } from 'react-dom'
import { MUSCLE_GROUPS } from '../constants.js'
import { Badge } from './ui.jsx'
import { getExerciseStats } from '../utils.js'
import { toWesternDigits } from '../day.js'
import ExerciseInfoModal from './ExerciseInfoModal.jsx'

// Weight-up celebration. Portaled to <body> and fixed to the viewport
// so it lands dead-centre no matter how far down the exercise list the
// user has scrolled — the old banner sat at the top and was missed.
function PRFlash({ color, weight, prev, exerciseName }) {
  const gained = prev != null && weight > prev ? Math.round((weight - prev) * 10) / 10 : null
  const sparks = [
    { dx: '-120px', dy: '-90px' },  { dx: '120px',  dy: '-90px' },
    { dx: '-150px', dy: '30px' },   { dx: '150px',  dy: '30px' },
    { dx: '-70px',  dy: '-140px' }, { dx: '70px',   dy: '-140px' },
    { dx: '0px',    dy: '-160px' }, { dx: '0px',    dy: '120px' },
  ]
  return createPortal(
    <div
      className="pr-fade"
      style={{
        position: 'fixed', inset: 0, zIndex: 900,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
        background: 'radial-gradient(circle at center, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 65%)',
        animation: 'prFadeOut 2.2s ease forwards',
      }}
    >
      {/* expanding shockwave */}
      <div className="pr-shock" style={{
        position: 'absolute', width: 150, height: 150, borderRadius: '50%',
        border: `10px solid ${color}`,
        animation: 'prShock 0.9s cubic-bezier(0.2,0.8,0.3,1) forwards',
      }} />
      {/* sunburst rays */}
      <div className="pr-rays" style={{
        position: 'absolute', width: 220, height: 220,
        background: `conic-gradient(from 0deg, ${color}00 0deg, ${color}90 18deg, ${color}00 36deg,
                     ${color}00 90deg, ${color}90 108deg, ${color}00 126deg,
                     ${color}00 180deg, ${color}90 198deg, ${color}00 216deg,
                     ${color}00 270deg, ${color}90 288deg, ${color}00 306deg)`,
        borderRadius: '50%',
        animation: 'prRays 1.1s ease-out forwards',
      }} />
      {/* flying sparks */}
      {sparks.map((sp, i) => (
        <div key={i} className="pr-spark" style={{
          position: 'absolute', width: 9, height: 9, borderRadius: '50%',
          background: i % 2 ? '#FFD166' : color,
          boxShadow: `0 0 12px ${i % 2 ? '#FFD166' : color}`,
          '--dx': sp.dx, '--dy': sp.dy,
          animation: `prSpark ${0.75 + (i % 3) * 0.12}s ease-out forwards`,
        }} />
      ))}

      {/* the badge itself */}
      <div className="pr-burst" style={{
        position: 'relative', zIndex: 2, textAlign: 'center',
        animation: 'prBurst 0.55s cubic-bezier(0.2,1.4,0.4,1) forwards',
      }}>
        <div style={{ fontSize: 54, lineHeight: 1, marginBottom: 4, filter: `drop-shadow(0 0 18px ${color})` }}>
          <Art id="scene_pr" size={54} fallback="🏆" />
        </div>
        <div style={{
          background: `linear-gradient(135deg, ${color}, #FFD166)`,
          borderRadius: 18, padding: '12px 26px',
          fontFamily: 'var(--font-ar)', fontSize: 22, fontWeight: 900, color: '#08130A',
          boxShadow: `0 0 44px ${color}, 0 10px 30px rgba(0,0,0,0.55)`,
          whiteSpace: 'nowrap',
        }}>
          رقم قياسي جديد!
        </div>
        <div className="pr-weight" style={{
          marginTop: 10,
          fontFamily: 'var(--font-mono)', fontSize: 40, fontWeight: 800, color: '#fff',
          textShadow: `0 0 26px ${color}`,
          animation: 'prWeightPop 0.6s 0.12s cubic-bezier(0.2,1.5,0.4,1) both',
        }}>
          {weight}<span style={{ fontSize: 20, opacity: 0.85 }}>kg</span>
        </div>
        {gained != null && (
          <div style={{
            marginTop: 2, fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 800,
            color: '#FFD166', textShadow: '0 0 14px rgba(255,209,102,0.7)',
          }}>
            ↑ {gained}kg فوق رقمك السابق
          </div>
        )}
        <div style={{
          marginTop: 8, fontFamily: 'var(--font-ar)', fontSize: 13, color: '#DCE8FF', opacity: 0.9,
          maxWidth: 260, marginInline: 'auto', lineHeight: 1.6,
        }}>
          {exerciseName} — الحد القادم بانتظارك 💥
        </div>
      </div>
    </div>,
    document.body,
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

export default function ExerciseCard({ exercise: ex, onUpdateSet, onAddSet, onRemoveSet, onRemove, onDoneSet, sessions, exerciseMapping = {}, allExercises = [], onMoveSet, dimmed = false, isComplete = false, onFocus, progression = null, alternatives = [], subIndex = 0, originalName, onSwap }) {
  const [showInfo,  setShowInfo]  = useState(false)
  const [showPR,    setShowPR]    = useState(null)
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
    () => getExerciseStats(sessions, ex.name, exerciseMapping),
    [sessions, ex.name, exerciseMapping],
  )

  const handleDone = (si, done) => {
    if (done && maxWeight !== null) {
      const w = parseFloat(ex.sets[si]?.weight) || 0
      if (w > maxWeight) {
        setShowPR({ weight: w, prev: maxWeight })
        setTimeout(() => setShowPR(null), 2200)
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
      <div
        onClick={() => { if (dimmed) onFocus?.() }}
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          overflow: 'hidden',
          marginBottom: 12,
          opacity: dimmed ? 0.35 : 1,
          filter: dimmed ? 'brightness(0.5)' : 'none',
          transition: 'opacity 0.3s, filter 0.3s',
          cursor: dimmed ? 'pointer' : 'default',
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

              {originalName && originalName !== ex.name && (
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)',
                  marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>بدلاً من {originalName}</div>
              )}

              {/* Badges row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Badge color={color}>{emoji} {label}</Badge>

                {/* Exactly one coaching hint, driven by progression.hint
                    so two can never contradict each other. It pulses so a
                    change of advice is noticed mid-workout. */}
                {progression?.hint && (() => {
                  const HINTS = {
                    raise: {
                      text: '⬆️ ارفع وزنك',
                      color: 'var(--gold)', bg: 'var(--gold-lo)', glow: 'rgba(245,158,11,0.55)',
                      title: `أكملت ${progression.setsAtTop} من ${progression.totalSets} سيت بـ ${progression.target.top} عدة`,
                    },
                    lower: {
                      text: `⬇️ نزّل وزنك${progression.suggestedWeight ? ` · ${progression.suggestedWeight}kg` : ''}`,
                      color: 'var(--orange)', bg: 'var(--orange-lo)', glow: 'rgba(249,115,22,0.55)',
                      title: `لم تصل ${progression.target.base} عدة في آخر ${progression.failedAtWeight} جلسات على ${progression.workingWeight}kg`,
                    },
                    push: {
                      text: `🎯 حاول ${progression.target.top} عدة`,
                      color: 'var(--cyan)', bg: 'var(--cyan-lo)', glow: 'var(--cyan-md)',
                      title: `${progression.sessionsAtWeight} جلسات على ${progression.workingWeight}kg`,
                    },
                  }
                  const h = HINTS[progression.hint]
                  if (!h) return null
                  return (
                    <span
                      className="tag-pulse"
                      title={h.title}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: h.bg, border: `1px solid ${h.color}`,
                        borderRadius: 10, padding: '2px 9px',
                        fontFamily: 'var(--font-ar)', fontSize: 12,
                        color: h.color, fontWeight: 700,
                        '--tag-glow': h.glow,
                      }}
                    >{h.text}</span>
                  )
                })()}

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

                {isComplete && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.45)',
                    borderRadius: 10, padding: '2px 8px',
                    fontSize: 10, color: '#FBBF24', fontWeight: 700,
                    fontFamily: 'var(--font-ar)',
                  }}>
                    ⬆️ جرب ارفع الوزن المرة الجاية
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
                  type="text" inputMode="decimal"
                  value={s.weight}
                  onChange={e => onUpdateSet(si, 'weight', toWesternDigits(e.target.value))}
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
                  type="text" inputMode="numeric"
                  value={s.reps}
                  onChange={e => onUpdateSet(si, 'reps', toWesternDigits(e.target.value))}
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

            {/* Swap the machine mid-workout. Sits on its own down here
                rather than crowding the badges. Hidden once a set is
                ticked, so finished sets keep the exercise they were
                actually performed on. */}
            {alternatives.length > 0 && !ex.sets.some(st => st.done) && (
              <button
                onClick={onSwap}
                title={subIndex < alternatives.length ? `التالي: ${alternatives[subIndex]}` : 'رجوع للتمرين الأصلي'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: originalName ? 'var(--gold-lo)' : 'none',
                  border: `1px dashed ${originalName ? 'var(--gold)' : 'var(--border)'}`,
                  borderRadius: 8, padding: '5px 14px',
                  color: originalName ? 'var(--gold)' : 'var(--text3)',
                  fontFamily: 'var(--font-ar)', fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                ⇄ {originalName ? `استبدال ${subIndex}/${alternatives.length}` : 'استبدال'}
              </button>
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

      {showPR   && <PRFlash color={color} weight={showPR.weight} prev={showPR.prev} exerciseName={ex.name} />}
      {showInfo && <ExerciseInfoModal exercise={ex} onClose={() => setShowInfo(false)} />}
    </>
  )
}
