import { useState, useEffect, useRef } from 'react'
import { EmptyState, Card, Badge, SectionTitle } from '../components/ui.jsx'
import ExerciseCard from '../components/ExerciseCard.jsx'
import AddExerciseModal from '../components/AddExerciseModal.jsx'
import RoutinesModal from '../components/RoutinesModal.jsx'
import { buildExercise, blankSet, fmtDate, fmtDuration, sessionVolume, getHistoricalMax } from '../utils.js'
import { MUSCLE_GROUPS, ROUTINES } from '../constants.js'

export default function WorkoutPage({ active, sessions, onUpdateActive, onFinish, onShowRest, addXP, onGoBack, isResting, exerciseMapping = {}, onUpdateSession, onDeleteSession }) {
  const [showAdd,      setShowAdd]      = useState(false)
  const [showRoutines, setShowRoutines] = useState(false)
  const [elapsed,      setElapsed]      = useState(0)
  const [prFlash,      setPrFlash]      = useState(null) // exercise name that just hit PR
  const timerRef      = useRef(null)
  const pausedMsRef   = useRef(0)
  const pauseStartRef = useRef(null)

  // pause timer when rest opens, resume when it closes
  useEffect(() => {
    if (!active) return
    if (isResting) {
      clearInterval(timerRef.current)
      pauseStartRef.current = Date.now()
    } else {
      if (pauseStartRef.current) {
        pausedMsRef.current += Date.now() - pauseStartRef.current
        pauseStartRef.current = null
      }
      const tick = () => setElapsed(Math.round((Date.now() - active.id - pausedMsRef.current) / 60000))
      tick()
      timerRef.current = setInterval(tick, 10000)
    }
    return () => clearInterval(timerRef.current)
  }, [active?.id, isResting])

  // ── History View ─────────────────────────────────────────────
  if (!active) {
    return <HistoryView sessions={sessions} onStartWorkout={() => setShowRoutines(true)} showRoutines={showRoutines} setShowRoutines={setShowRoutines} onUpdateSession={onUpdateSession} onDeleteSession={onDeleteSession} />
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
    if (done) {
      const ex  = exercises.find(e => e.id === exId)
      const set = ex?.sets[si]
      const w   = parseFloat(set?.weight) || 0
      if (w > 0 && ex) {
        const histMax = getHistoricalMax(sessions, ex.name, exerciseMapping)
        if (w > histMax) {
          setPrFlash(ex.name)
          setTimeout(() => setPrFlash(null), 2800)
        }
      }
      if (addXP) addXP(10, '✓ سيت مكتمل')
      onShowRest()
    }
    updateEx(exId, ex => ({
      ...ex,
      sets: ex.sets.map((s, i) => i === si ? { ...s, done } : s),
    }))
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

      {/* ── PR Flash Banner ── */}
      {prFlash && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
          zIndex: 500, whiteSpace: 'nowrap',
          background: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
          borderRadius: 22, padding: '10px 22px',
          fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 800, color: 'white',
          boxShadow: '0 4px 28px rgba(245,158,11,0.55)',
          animation: 'prFlash 0.4s ease forwards',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          🏆 رقم قياسي جديد!
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, opacity: 0.9 }}>{prFlash}</span>
        </div>
      )}

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
            onClick={onGoBack}
            style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '8px 14px',
              color: 'var(--text2)', fontFamily: 'var(--font-ar)',
              fontSize: 12, cursor: 'pointer',
            }}
          >← تراجع</button>
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
              background: pct === 100 ? 'var(--green)' : 'var(--cyan)',
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
          sessions={sessions || []}
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
        <div style={{ pointerEvents: 'all', display: 'flex', gap: 8 }}>
          <button
            onClick={onGoBack}
            style={{
              flex: '0 0 auto',
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '14px 18px',
              color: 'var(--text2)', fontFamily: 'var(--font-ar)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >← تراجع</button>
          <button className="btn-cyan" onClick={onFinish} style={{ flex: 1 }}>
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
function HistoryView({ sessions, onStartWorkout, showRoutines, setShowRoutines, onUpdateSession, onDeleteSession }) {
  const [expanded,   setExpanded]   = useState(null)
  const [editingId,  setEditingId]  = useState(null)
  const [editData,   setEditData]   = useState(null)
  const [confirmDel, setConfirmDel] = useState(null) // session id pending delete

  const startEdit = (e, session) => {
    e.stopPropagation()
    setEditingId(session.id)
    setExpanded(session.id)
    setEditData(session.exercises.map(ex => ({ ...ex, sets: ex.sets.map(s => ({ ...s })) })))
  }

  const cancelEdit = (e) => {
    e?.stopPropagation()
    setEditingId(null)
    setEditData(null)
  }

  const saveEdit = (e, sessionId) => {
    e.stopPropagation()
    const cleaned = editData.filter(ex => ex.sets.some(s => s.done))
    onUpdateSession?.(sessionId, s => ({ ...s, exercises: cleaned }))
    setEditingId(null)
    setEditData(null)
  }

  const updSet = (ei, si, field, val) =>
    setEditData(prev => prev.map((ex, i) => i !== ei ? ex : {
      ...ex, sets: ex.sets.map((s, j) => j !== si ? s : { ...s, [field]: val })
    }))

  const delSet = (ei, si) =>
    setEditData(prev => prev.map((ex, i) => i !== ei ? ex : {
      ...ex, sets: ex.sets.filter((_, j) => j !== si)
    }))

  const delExercise = (ei) =>
    setEditData(prev => prev.filter((_, i) => i !== ei))

  const inputStyle = {
    background: 'var(--bg3)', border: '1px solid var(--border2)',
    borderRadius: 7, padding: '4px 7px',
    color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 12,
    outline: 'none', width: 58, textAlign: 'center',
  }

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
          <button className="btn-cyan" onClick={onStartWorkout}>⚔️ ابدأ التمرين</button>
        </div>
        {showRoutines && <RoutinesModal onSelect={() => {}} onClose={() => setShowRoutines(false)} />}
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 120 }}>
      <SectionTitle>سجل الجلسات</SectionTitle>
      {sessions.map(s => {
        const muscles  = [...new Set(s.exercises.map(e => e.muscle))]
        const allSets  = s.exercises.flatMap(e => e.sets)
        const doneSets = allSets.filter(ss => ss.done).length
        const vol      = sessionVolume(s)
        const isOpen   = expanded === s.id
        const isEditing = editingId === s.id

        return (
          <Card
            key={s.id}
            style={{ marginBottom: 3, padding: 5, cursor: isEditing ? 'default' : 'pointer',
              border: isEditing ? '1px solid var(--cyan-md)' : undefined }}
            onClick={() => { if (!isEditing) setExpanded(isOpen ? null : s.id) }}
          >
            {/* ── Session header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-ar)', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                  {fmtDate(s.date)}
                </div>
                <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                  {fmtDuration(s.duration)}{vol > 0 ? ` · ${(vol / 1000).toFixed(1)} طن` : ''}
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

              {/* action buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginRight: 4 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--cyan)', textAlign: 'center' }}>
                  {doneSets}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>sets</div>
                {!isEditing && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={e => startEdit(e, s)}
                      title="تعديل"
                      style={{
                        background: 'var(--bg3)', border: '1px solid var(--border)',
                        borderRadius: 7, width: 28, height: 28, cursor: 'pointer',
                        color: 'var(--text2)', fontSize: 13,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >✏️</button>
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDel(s.id) }}
                      title="حذف الجلسة"
                      style={{
                        background: 'var(--bg3)', border: '1px solid var(--border)',
                        borderRadius: 7, width: 28, height: 28, cursor: 'pointer',
                        color: '#EF4444', fontSize: 13,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >🗑️</button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Delete session confirm ── */}
            {confirmDel === s.id && (
              <div onClick={e => e.stopPropagation()} style={{
                marginTop: 10, padding: '10px 12px',
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 10,
              }}>
                <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: '#EF4444', marginBottom: 8 }}>
                  حذف هذه الجلسة نهائياً؟
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={e => { e.stopPropagation(); onDeleteSession?.(s.id); setConfirmDel(null) }}
                    style={{
                      flex: 1, background: '#EF4444', border: 'none', borderRadius: 8,
                      padding: '7px', color: 'white',
                      fontFamily: 'var(--font-ar)', fontSize: 13, cursor: 'pointer',
                    }}
                  >نعم، احذف</button>
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDel(null) }}
                    style={{
                      flex: 1, background: 'var(--bg2)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '7px', color: 'var(--text2)',
                      fontFamily: 'var(--font-ar)', fontSize: 13, cursor: 'pointer',
                    }}
                  >إلغاء</button>
                </div>
              </div>
            )}

            {/* ── Expanded: read-only or edit ── */}
            {isOpen && !isEditing && (
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
                {s.exercises.map((ex, ei) => (
                  <div key={ei} style={{ marginBottom: 10 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: MUSCLE_GROUPS[ex.muscle]?.color || 'var(--cyan)', marginBottom: 4 }}>
                      {ex.name}
                    </div>
                    {ex.sets.filter(ss => ss.done).map((ss, si) => (
                      <div key={si} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)', marginBottom: 2, paddingRight: 8 }}>
                        ✓ Set {si + 1}: {ss.weight || '—'}kg × {ss.reps || '—'} reps
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* ── Edit mode ── */}
            {isEditing && editData && (
              <div onClick={e => e.stopPropagation()} style={{ borderTop: '1px solid var(--cyan-md)', marginTop: 12, paddingTop: 12 }}>
                {editData.map((ex, ei) => (
                  <div key={ei} style={{ marginBottom: 14, background: 'var(--bg2)', borderRadius: 10, padding: '10px 10px 6px' }}>
                    {/* Exercise header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: MUSCLE_GROUPS[ex.muscle]?.color || 'var(--cyan)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ex.name}
                      </span>
                      <button
                        onClick={() => delExercise(ei)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 15, padding: '0 4px', flexShrink: 0 }}
                        title="حذف التمرين"
                      >🗑️</button>
                    </div>
                    {/* Column labels */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 4, paddingRight: 4 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)', width: 36 }}>SET</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)', width: 58, textAlign: 'center' }}>KG</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)', width: 58, textAlign: 'center' }}>REPS</span>
                    </div>
                    {/* Sets */}
                    {ex.sets.map((ss, si) => (
                      <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)', width: 36, flexShrink: 0 }}>
                          {si + 1}
                        </span>
                        <input
                          value={ss.weight || ''}
                          onChange={e => updSet(ei, si, 'weight', e.target.value)}
                          placeholder="—"
                          style={inputStyle}
                        />
                        <span style={{ color: 'var(--text3)', fontSize: 13 }}>×</span>
                        <input
                          value={ss.reps || ''}
                          onChange={e => updSet(ei, si, 'reps', e.target.value)}
                          placeholder="—"
                          style={inputStyle}
                        />
                        <button
                          onClick={() => delSet(ei, si)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 16, padding: '0 2px', flexShrink: 0 }}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                ))}

                {/* Save / Cancel */}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button
                    onClick={e => saveEdit(e, s.id)}
                    style={{
                      flex: 1, background: 'var(--grad-primary)', border: 'none', borderRadius: 10,
                      padding: '10px', color: 'white',
                      fontFamily: 'var(--font-ar)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    }}
                  >✓ حفظ التعديلات</button>
                  <button
                    onClick={cancelEdit}
                    style={{
                      background: 'var(--bg2)', border: '1px solid var(--border)',
                      borderRadius: 10, padding: '10px 16px', color: 'var(--text2)',
                      fontFamily: 'var(--font-ar)', fontSize: 14, cursor: 'pointer',
                    }}
                  >إلغاء</button>
                </div>
              </div>
            )}

            {!isEditing && (
              <div style={{ textAlign: 'center', marginTop: 8, color: 'var(--text3)', fontSize: 12 }}>
                {isOpen ? '▲' : '▼'}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
