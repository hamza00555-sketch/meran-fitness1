import { useState, useEffect, useRef } from 'react'
import { Btn } from '../components/ui.jsx'
import ExerciseCard from '../components/ExerciseCard.jsx'
import AddExerciseModal from '../components/AddExerciseModal.jsx'
import { fmtTime, buildExercise, blankSet } from '../utils.js'

export default function TodayPage({ active, onUpdateActive, onFinish, onShowRest, onShowRoutines, sessions }) {
  const [showAdd, setShowAdd] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!active) return
    timerRef.current = setInterval(() => {
      setElapsed(Math.round((Date.now() - active.id) / 60000))
    }, 10000)
    setElapsed(Math.round((Date.now() - active.id) / 60000))
    return () => clearInterval(timerRef.current)
  }, [active?.id])

  if (!active) return (
    <div style={{ textAlign: 'center', padding: '80px 20px 100px' }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>💪</div>
      <div style={{ fontFamily: 'var(--font-ar)', fontSize: 18, color: 'var(--text3)', marginBottom: 8 }}>
        ما في جلسة نشطة
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text4)', marginBottom: 24 }}>
        ابدأ جلسة من الرئيسية
      </div>
      <Btn onClick={onShowRoutines} variant="secondary">
        📋 ابدأ بروتين
      </Btn>
    </div>
  )

  const exercises = active.exercises
  const allSets = exercises.flatMap(ex => ex.sets)
  const doneSets = allSets.filter(s => s.done).length
  const totalSets = allSets.length
  const pct = totalSets > 0 ? (doneSets / totalSets) * 100 : 0

  // Previous performance lookup
  const getPrev = (name) => {
    for (const s of sessions) {
      const ex = s.exercises?.find(e => e.name === name)
      if (ex) {
        const done = ex.sets.find(ss => ss.done && ss.weight)
        if (done) return `${done.weight}kg × ${done.r1}`
      }
    }
    return null
  }

  const updateEx = (exId, updater) => {
    onUpdateActive(prev => ({
      ...prev,
      exercises: prev.exercises.map(ex => ex.id === exId ? updater(ex) : ex),
    }))
  }

  const handleUpdateSet = (exId, si, field, val) => {
    updateEx(exId, ex => ({
      ...ex,
      sets: ex.sets.map((s, i) => i === si ? { ...s, [field]: val } : s),
    }))
  }

  const handleDoneSet = (exId, si, done) => {
    updateEx(exId, ex => ({
      ...ex,
      sets: ex.sets.map((s, i) => i === si ? { ...s, done } : s),
    }))
    if (done) onShowRest()
  }

  const handleAddSet = (exId) => {
    updateEx(exId, ex => {
      const prev = ex.sets.at(-1)?.weight || ''
      return { ...ex, sets: [...ex.sets, blankSet(prev)] }
    })
  }

  const handleRemoveSet = (exId, si) => {
    updateEx(exId, ex => ({ ...ex, sets: ex.sets.filter((_, i) => i !== si) }))
  }

  const handleRemoveEx = (exId) => {
    onUpdateActive(prev => ({ ...prev, exercises: prev.exercises.filter(e => e.id !== exId) }))
  }

  const handleAddExercise = ({ muscle, name, emoji, numSets }) => {
    const ex = buildExercise({ muscle, name, emoji, numSets })
    onUpdateActive(prev => ({ ...prev, exercises: [...prev.exercises, ex] }))
    setShowAdd(false)
  }

  return (
    <div style={{ paddingBottom: 110 }}>
      {/* Session toolbar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--orange)', letterSpacing: 1,
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span className="pulse-dot">●</span> LIVE SESSION
          </div>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            {fmtTime(active.date)} · {elapsed} دقيقة
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={onShowRest} variant="ghost" style={{ fontSize: 12, padding: '8px 12px' }}>⏱️ Rest</Btn>
          <Btn onClick={onFinish} variant="success" style={{ fontSize: 13, padding: '8px 16px' }}>✓ إنهاء</Btn>
        </div>
      </div>

      {/* Progress bar */}
      {totalSets > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)' }}>
              التقدم
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: pct === 100 ? 'var(--green)' : 'var(--orange)' }}>
              {doneSets}/{totalSets} sets
            </span>
          </div>
          <div style={{ background: 'var(--bg2)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${pct}%`,
              background: pct === 100
                ? 'var(--green)'
                : 'linear-gradient(90deg,var(--orange),var(--gold))',
              borderRadius: 4,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      )}

      {/* Empty state */}
      {exercises.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '40px 20px',
          border: '1px dashed var(--border2)', borderRadius: 12, marginBottom: 16,
        }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🏋️</div>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 15, color: 'var(--text3)', marginBottom: 16 }}>
            أضف تمرينك الأول
          </div>
          <Btn onClick={onShowRoutines} variant="secondary" style={{ marginLeft: 10 }}>
            📋 روتين جاهز
          </Btn>
        </div>
      )}

      {/* Exercise cards */}
      {exercises.map(ex => (
        <ExerciseCard
          key={ex.id}
          exercise={ex}
          prevPerf={getPrev(ex.name)}
          onUpdateSet={(si, field, val) => handleUpdateSet(ex.id, si, field, val)}
          onDoneSet={(si, done) => handleDoneSet(ex.id, si, done)}
          onAddSet={() => handleAddSet(ex.id)}
          onRemoveSet={(si) => handleRemoveSet(ex.id, si)}
          onRemove={() => handleRemoveEx(ex.id)}
        />
      ))}

      {/* Add exercise button */}
      <button
        onClick={() => setShowAdd(true)}
        style={{
          width: '100%', background: 'none',
          border: '1px dashed var(--border2)', borderRadius: 12,
          padding: '16px', color: 'var(--text3)',
          fontFamily: 'var(--font-ar)', fontSize: 15, cursor: 'pointer',
          marginTop: 4, transition: 'all 0.2s',
        }}
        onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--orange)'; e.currentTarget.style.color = 'var(--orange)' }}
        onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text3)' }}
      >
        ＋ إضافة تمرين
      </button>

      {showAdd && (
        <AddExerciseModal
          onAdd={handleAddExercise}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  )
}
