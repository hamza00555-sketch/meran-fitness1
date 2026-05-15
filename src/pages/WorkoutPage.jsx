import { useState, useEffect, useRef } from 'react'
import { EmptyState, Card, Badge, SectionTitle } from '../components/ui.jsx'
import ExerciseCard from '../components/ExerciseCard.jsx'
import AddExerciseModal from '../components/AddExerciseModal.jsx'
import RoutinesModal from '../components/RoutinesModal.jsx'
import { buildExercise, blankSet, fmtDate, fmtDuration, sessionVolume } from '../utils.js'
import { MUSCLE_GROUPS, ROUTINES } from '../constants.js'

export default function WorkoutPage({ active, sessions, onUpdateActive, onFinish, onShowRest, addXP }) {
  const [showAdd,      setShowAdd]      = useState(false)
  const [showRoutines, setShowRoutines] = useState(false)
  const [elapsed,      setElapsed]      = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!active) return
    const tick = () => setElapsed(Math.round((Date.now() - active.id) / 60000))
    tick()
    timerRef.current = setInterval(tick, 10000)
    return () => clearInterval(timerRef.current)
  }, [active?.id])

  // ── History View ─────────────────────────────────────────────
  if (!active) {
    return <HistoryView sessions={sessions} onStartWorkout={() => setShowRoutines(true)} showRoutines={showRoutines} setShowRoutines={setShowRoutines} />
  }

  // ── Helpers ──────────────────────────────────────────────────
  const updateEx = (exId, updater) =>
    onUpdateActive(prev => ({
      ...prev,
      exercises: prev.exercises.map(ex => ex.id === exId ? updater(ex) : ex),
    }))

  const handleUpdateSet = (exId, si, field, val) =>
    updateEx(exId, ex => ({
      ...ex,
      sets: ex.sets.map((s, i) => i === si ? { ...s, [field]: val } : s),
    }))

  const handleDoneSet = (exId, si, done) => {
    updateEx(exId, ex => ({
      ...ex,
      sets: ex.sets.map((s, i) => i === si ? { ...s, done } : s),
    }))
    if (done) {
      if (addXP) addXP(10, '✓ سيت مكتمل')
      onShowRest()
    }
  }

  const handleAddSet = (exId) =>
    updateEx(exId, ex => {
      const prev = ex.sets.at(-1)?.weight || ''
      return { ...ex, sets: [...ex.sets, blankSet(prev)] }
    })

  const handleRemoveSet = (exId, si) =>
    updateEx(exId, ex => ({ ...ex, sets: ex.sets.filter((_, i) => i !== si) }))

  const handleRemoveEx = (exId) =>
    onUpdateActive(prev => ({ ...prev, exercises: prev.exercises.filter(e => e.id !== exId) }))

  const handleAddExercise = ({ muscle, name, numSets }) => {
    const ex = buildExercise({ muscle, name, numSets })
    onUpdateActive(prev => ({ ...prev, exercises: [...prev.exercises, ex] }))
    setShowAdd(false)
  }

  const handleLoadRoutine = (routine) => {
    const exercises = routine.exercises.map(ex =>
      buildExercise({ muscle: ex.muscle, name: ex.name, numSets: ex.defaultSets || 3 })
    )
    onUpdateActive(prev => ({ ...prev, exercises }))
    setShowRoutines(false)
  }

  const exercises = active.exercises || []
  const allSets   = exercises.flatMap(ex => ex.sets)
  const doneSets  = allSets.filter(s => s.done).length
  const totalSets = allSets.length
  const pct = totalSets > 0 ? (doneSets / totalSets) * 100 : 0

  return (
    <div style={{ paddingBottom: 120 }}>
      {/* Session Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cyan)', marginBottom: 2,
          }}>
            <span className="pulse-dot" style={{
              display: 'inline-block', width: 6, height: 6,
              borderRadius: '50%', background: 'var(--cyan)',
            }} />
            LIVE SESSION
          </div>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)' }}>
            {elapsed} دقيقة · {exercises.length} تمرين
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onShowRest}
            style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '8px 12px',
              color: 'var(--text2)', fontFamily: 'var(--font-ar)',
              fontSize: 12, cursor: 'pointer',
            }}
          >⏱️ راحة</button>
          <button
            onClick={onFinish}
            style={{
              background: 'var(--green-lo)', border: '1px solid #22C55E50',
              borderRadius: 10, padding: '8px 16px',
              color: 'var(--green)', fontFamily: 'var(--font-ar)',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >✓ إنهاء</button>
        </div>
      </div>

      {/* Progress bar */}
      {totalSets > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)' }}>التقدم</span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: pct === 100 ? 'var(--green)' : 'var(--cyan)',
            }}>
              {doneSets}/{totalSets} sets
            </span>
          </div>
          <div style={{ background: 'var(--bg2)', borderRadius: 4, height: 5, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: pct === 100 ? 'var(--green)' : 'linear-gradient(90deg, var(--cyan), #00B0A6)',
              borderRadius: 4, transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      )}

      {/* Empty state */}
      {exercises.length === 0 && (
        <div style={{
          border: '1px dashed var(--border2)', borderRadius: 14,
          padding: '30px 20px', textAlign: 'center', marginBottom: 14,
        }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🏋️</div>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 14, color: 'var(--text3)', marginBottom: 12 }}>
            أضف أول تمرين
          </div>
          <button
            onClick={() => setShowRoutines(true)}
            style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '8px 16px',
              color: 'var(--text2)', fontFamily: 'var(--font-ar)',
              fontSize: 13, cursor: 'pointer',
            }}
          >📋 روتين جاهز</button>
        </div>
      )}

      {/* Exercise cards */}
      {exercises.map(ex => (
        <ExerciseCard
          key={ex.id}
          exercise={ex}
          onUpdateSet={(si, field, val) => handleUpdateSet(ex.id, si, field, val)}
          onDoneSet={(si, done) => handleDoneSet(ex.id, si, done)}
          onAddSet={() => handleAddSet(ex.id)}
          onRemoveSet={si => handleRemoveSet(ex.id, si)}
          onRemove={() => handleRemoveEx(ex.id)}
        />
      ))}

      {/* Add exercise button */}
      <button
        onClick={() => setShowAdd(true)}
        style={{
          width: '100%', background: 'none',
          border: '1px dashed var(--border2)', borderRadius: 14,
          padding: '16px', color: 'var(--text3)',
          fontFamily: 'var(--font-ar)', fontSize: 15, cursor: 'pointer',
          marginTop: 4, transition: 'all 0.2s',
        }}
        onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--cyan)'; e.currentTarget.style.color = 'var(--cyan)' }}
        onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text3)' }}
      >
        ＋ إضافة تمرين
      </button>

      {/* Fixed Finish Button */}
      <div style={{
        position: 'fixed', bottom: 0,
        left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 560,
        padding: '12px 16px calc(var(--safe-bottom) + 76px)',
        background: 'linear-gradient(transparent, var(--bg) 40%)',
        pointerEvents: 'none',
      }}>
        <div style={{ pointerEvents: 'all' }}>
          <button className="btn-cyan" onClick={onFinish}>
            ✓ إنهاء الجلسة {doneSets > 0 ? `· ${doneSets} sets` : ''}
          </button>
        </div>
      </div>

      {showAdd      && <AddExerciseModal onAdd={handleAddExercise} onClose={() => setShowAdd(false)} />}
      {showRoutines && <RoutinesModal onSelect={handleLoadRoutine} onClose={() => setShowRoutines(false)} />}
    </div>
  )
}

// ── History sub-view ──────────────────────────────────────────
function HistoryView({ sessions, onStartWorkout, showRoutines, setShowRoutines }) {
  const [expanded, setExpanded] = useState(null)

  if (!sessions.length) {
    return (
      <div style={{ paddingBottom: 120 }}>
        <EmptyState icon="📋" title="لا يوجد سجل بعد" desc="أنهِ جلسة لتظهر هنا" />
        <div style={{
          position: 'fixed', bottom: 0,
          left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 560,
          padding: '12px 16px calc(var(--safe-bottom) + 76px)',
          background: 'linear-gradient(transparent, var(--bg) 40%)',
        }}>
          <button className="btn-cyan" onClick={onStartWorkout}>
            ⚔️ ابدأ التمرين
          </button>
        </div>
        {showRoutines && <RoutinesModal onSelect={() => {}} onClose={() => setShowRoutines(false)} />}
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 120 }}>
      <SectionTitle>سجل الجلسات</SectionTitle>
      {sessions.map(s => {
        const muscles   = [...new Set(s.exercises.map(e => e.muscle))]
        const allSets   = s.exercises.flatMap(e => e.sets)
        const doneSets  = allSets.filter(ss => ss.done).length
        const vol       = sessionVolume(s)
        const isOpen    = expanded === s.id

        return (
          <Card
            key={s.id}
            style={{ marginBottom: 10, padding: 16, cursor: 'pointer' }}
            onClick={() => setExpanded(isOpen ? null : s.id)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-ar)', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                  {fmtDate(s.date)}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)', marginBottom: 8 }}>
                  {fmtDuration(s.duration)}
                  {vol > 0 ? ` · ${(vol / 1000).toFixed(1)} طن` : ''}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {muscles.map(m => (
                    <Badge key={m} color={MUSCLE_GROUPS[m]?.color || 'var(--cyan)'}>
                      {MUSCLE_GROUPS[m]?.img
                        ? <img src={MUSCLE_GROUPS[m].img} style={{ width: 14, height: 14, objectFit: 'contain', borderRadius: 3 }} alt="" />
                        : MUSCLE_GROUPS[m]?.emoji
                      } {MUSCLE_GROUPS[m]?.label || m}
                    </Badge>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'center', marginRight: 8 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--cyan)' }}>
                  {doneSets}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--font-ar)' }}>sets</div>
              </div>
            </div>

            {isOpen && (
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
                {s.exercises.map((ex, ei) => (
                  <div key={ei} style={{ marginBottom: 10 }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 12,
                      color: MUSCLE_GROUPS[ex.muscle]?.color || 'var(--cyan)',
                      marginBottom: 4,
                    }}>
                      {ex.name}
                    </div>
                    {ex.sets.filter(ss => ss.done).map((ss, si) => (
                      <div key={si} style={{
                        fontFamily: 'var(--font-mono)', fontSize: 11,
                        color: 'var(--text3)', marginBottom: 2, paddingRight: 8,
                      }}>
                        ✓ Set {si + 1}: {ss.weight || '—'}kg × {ss.reps || '—'} reps
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: 8, color: 'var(--text3)', fontSize: 12 }}>
              {isOpen ? '▲' : '▼'}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
