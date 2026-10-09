import { useState } from 'react'
import { Card, SectionTitle, EmptyState, Badge } from '../components/ui.jsx'
import RoutinesModal from '../components/RoutinesModal.jsx'
import { fmtDate, fmtDuration, sessionVolume, planDayType, resolveExerciseName, ls } from '../utils.js'
import { MUSCLE_GROUPS } from '../constants.js'
import { toWesternDigits } from '../day.js'

// ── السجل — what you did ──────────────────────────────────────
// Split out of WorkoutPage, which now only runs the session.

export default function HistoryPage({ sessions, onUpdateSession, onDeleteSession, exerciseMapping = {}, onStartPlannedWorkout, onStartWorkout, plan, planIndex }) {
  const [showRoutines, setShowRoutines] = useState(false)
  return <HistoryView sessions={sessions} onStartWorkout={() => setShowRoutines(true)} showRoutines={showRoutines} setShowRoutines={setShowRoutines} onUpdateSession={onUpdateSession} onDeleteSession={onDeleteSession} exerciseMapping={exerciseMapping} />
}

// ── History sub-view ──────────────────────────────────────────
function HistoryView({ sessions, onStartWorkout, showRoutines, setShowRoutines, onUpdateSession, onDeleteSession, exerciseMapping = {} }) {
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

    // Update weight snapshot if this is the most recent session
    const mostRecentId = sessions.length > 0 ? Math.max(...sessions.map(s => s.id)) : null
    if (sessionId === mostRecentId) {
      const snapshot = {}
      for (const ex of cleaned) {
        const ws = (ex.sets || []).map(s => parseFloat(s.weight)).filter(w => w > 0)
        if (ws.length) {
          const canonical = resolveExerciseName(ex.name, exerciseMapping)
          snapshot[canonical] = ws[ws.length - 1]
        }
      }
      if (Object.keys(snapshot).length) {
        ls.set('hf_last_weights', { ...ls.get('hf_last_weights', {}), ...snapshot })
      }
    }

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
        <EmptyState art="empty_history" icon="📋" title="لا يوجد سجل بعد" desc="أنهِ جلسة لتظهر هنا" />
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
        const muscles  = [...new Set(s.exercises.filter(e => e.sets.some(ss => ss.done)).map(e => e.muscle))]
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
                {s.planDayName && (
                  <span style={{
                    display: 'inline-block',
                    background: 'rgba(0,210,255,0.08)', border: '1px solid rgba(0,210,255,0.25)',
                    borderRadius: 20, padding: '2px 9px',
                    fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cyan)',
                    fontWeight: 700, marginBottom: 5, letterSpacing: 0.3,
                  }}>{planDayType({ name: s.planDayName, exercises: s.exercises })}</span>
                )}
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
                {/* Sessions saved before only-done-is-kept still carry the
                    exercises that were skipped; show what happened. */}
                {s.exercises.filter(ex => ex.sets.some(ss => ss.done)).map((ex, ei) => (
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
                          type="text" inputMode="decimal"
                          value={ss.weight || ''}
                          onChange={e => updSet(ei, si, 'weight', toWesternDigits(e.target.value))}
                          placeholder="—"
                          style={inputStyle}
                        />
                        <span style={{ color: 'var(--text3)', fontSize: 13 }}>×</span>
                        <input
                          type="text" inputMode="numeric"
                          value={ss.reps || ''}
                          onChange={e => updSet(ei, si, 'reps', toWesternDigits(e.target.value))}
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
