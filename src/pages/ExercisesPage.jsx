import { useState, useMemo } from 'react'
import { MUSCLE_GROUPS } from '../constants.js'
import { detectEquipment, EQUIPMENT_LABELS } from '../utils.js'
import ExerciseInfoModal from '../components/ExerciseInfoModal.jsx'

function buildProgress(sessions) {
  const map = {}
  const sorted = [...(sessions || [])].sort((a, b) => a.id - b.id)
  for (const session of sorted) {
    for (const ex of session.exercises || []) {
      const doneSets = (ex.sets || []).filter(s => s.done && parseFloat(s.weight) > 0)
      if (!doneSets.length) continue
      const maxW = Math.max(...doneSets.map(s => parseFloat(s.weight)))
      const totalReps = doneSets.reduce((t, s) => t + (parseInt(s.reps) || 0), 0)
      if (!map[ex.name]) map[ex.name] = { name: ex.name, muscle: ex.muscle, entries: [] }
      map[ex.name].entries.push({ sessionId: session.id, date: session.date, maxW, sets: doneSets.length, totalReps })
    }
  }
  return Object.values(map)
}

export default function ExercisesPage({ sessions = [] }) {
  const [openGroup, setOpenGroup]  = useState(null)
  const [infoEx,    setInfoEx]     = useState(null)
  const [search,    setSearch]     = useState('')
  const [view,      setView]       = useState('all')

  const query    = search.trim().toLowerCase()
  const progress = useMemo(() => buildProgress(sessions), [sessions])

  const progressByMuscle = useMemo(() => {
    const grouped = {}
    for (const ex of progress) {
      if (!grouped[ex.muscle]) grouped[ex.muscle] = []
      grouped[ex.muscle].push(ex)
    }
    return grouped
  }, [progress])

  // Group progress by equipment — shared PR = max weight across all exercises in group
  const progressByEquipment = useMemo(() => {
    const grouped = {}
    for (const ex of progress) {
      const eq = detectEquipment(ex.name)
      if (!grouped[eq]) grouped[eq] = []
      const allMax = Math.max(...ex.entries.map(e => e.maxW))
      grouped[eq].push({ ...ex, allMax })
    }
    // Sort each group by allMax desc, compute group PR
    for (const eq of Object.keys(grouped)) {
      grouped[eq].sort((a, b) => b.allMax - a.allMax)
    }
    return grouped
  }, [progress])

  const groups = Object.entries(MUSCLE_GROUPS).map(([key, g]) => ({
    key, ...g,
    filtered: (g.exercises || []).filter(e => !query || e.name.toLowerCase().includes(query)),
  })).filter(g => g.filtered.length > 0)

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[
          { id: 'all',       label: '📚 جميع التمارين' },
          { id: 'progress',  label: `📊 تقدمي${progress.length > 0 ? ` (${progress.length})` : ''}` },
          { id: 'equipment', label: '🔧 معدات' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            style={{
              flex: 1,
              background: view === t.id ? 'var(--cyan-lo)' : 'var(--bg2)',
              border: `1px solid ${view === t.id ? 'var(--cyan)' : 'var(--border)'}`,
              borderRadius: 10, padding: '9px 0',
              color: view === t.id ? 'var(--cyan)' : 'var(--text3)',
              fontFamily: 'var(--font-ar)', fontSize: 13, fontWeight: view === t.id ? 700 : 400,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* ── ALL EXERCISES VIEW ── */}
      {view === 'all' && (
        <>
          <div style={{ marginBottom: 14 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث عن تمرين..."
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '11px 14px',
                color: 'var(--text)', fontFamily: 'var(--font-ar)', fontSize: 14,
                outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--cyan)'}
              onBlur={e  => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {groups.map(g => {
            const isOpen = openGroup === g.key || !!query
            return (
              <div key={g.key} style={{ marginBottom: 8 }}>
                <button
                  onClick={() => !query && setOpenGroup(isOpen ? null : g.key)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    background: 'var(--bg2)', border: `1px solid ${g.color}30`,
                    borderRadius: isOpen ? '12px 12px 0 0' : 12,
                    padding: '12px 14px', cursor: query ? 'default' : 'pointer',
                    transition: 'border-radius 0.2s',
                  }}
                >
                  {g.img
                    ? <img src={g.img} style={{ width: 84, height: 84, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }} alt="" />
                    : <span style={{ fontSize: 66 }}>{g.emoji}</span>
                  }
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <span style={{ fontFamily: 'var(--font-ar)', fontSize: 14, fontWeight: 700, color: g.color }}>{g.label}</span>
                    <span style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginRight: 8 }}>{g.filtered.length} تمرين</span>
                  </div>
                  {!query && (
                    <span style={{ color: 'var(--text3)', fontSize: 12, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
                  )}
                </button>

                {isOpen && (
                  <div style={{
                    background: 'var(--bg2)', borderRadius: '0 0 12px 12px',
                    border: `1px solid ${g.color}30`, borderTop: '1px solid var(--border)',
                    overflow: 'hidden',
                  }}>
                    {g.filtered.map((ex, i) => (
                      <button
                        key={i}
                        onClick={() => setInfoEx({ ...ex, muscle: g.key })}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          background: 'none', border: 'none',
                          borderBottom: i < g.filtered.length - 1 ? '1px solid var(--border)' : 'none',
                          padding: '11px 14px', cursor: 'pointer', textAlign: 'right',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)', marginBottom: 3 }}>{ex.name}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {ex.videoUrl && (
                              <span style={{ background: 'rgba(255,0,0,0.12)', border: '1px solid rgba(255,0,0,0.25)', borderRadius: 6, padding: '1px 7px', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#FF4444' }}>▶ YouTube</span>
                            )}
                            {ex.tips?.length > 0 && (
                              <span style={{ background: g.color + '15', border: `1px solid ${g.color}35`, borderRadius: 6, padding: '1px 7px', fontFamily: 'var(--font-ar)', fontSize: 12, color: g.color }}>⚡ {ex.tips.length} نصائح</span>
                            )}
                          </div>
                        </div>
                        <span style={{ color: 'var(--text3)', fontSize: 14 }}>ℹ</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {/* ── MY PROGRESS VIEW ── */}
      {view === 'progress' && (
        progress.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '50px 20px',
            fontFamily: 'var(--font-ar)', color: 'var(--text3)', fontSize: 14,
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            أنهِ جلسة تمرين أولاً لترى تقدمك هنا
          </div>
        ) : (
          Object.entries(progressByMuscle).map(([muscleKey, exercises]) => {
            const g = MUSCLE_GROUPS[muscleKey] || { label: muscleKey, color: 'var(--cyan)', emoji: '🏋️' }
            return (
              <div key={muscleKey} style={{ marginBottom: 16 }}>
                {/* Muscle group label */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginBottom: 8, paddingRight: 4,
                }}>
                  <span style={{ fontSize: 18 }}>{g.emoji}</span>
                  <span style={{ fontFamily: 'var(--font-ar)', fontSize: 13, fontWeight: 700, color: g.color }}>{g.label}</span>
                  <div style={{ flex: 1, height: 1, background: g.color + '25' }} />
                </div>

                {exercises.map(ex => {
                  const last    = ex.entries[ex.entries.length - 1]
                  const allMax  = Math.max(...ex.entries.map(e => e.maxW))
                  const recent  = ex.entries.slice(-6)
                  const isPR    = last.maxW >= allMax
                  const trend   = ex.entries.length >= 2
                    ? last.maxW - ex.entries[ex.entries.length - 2].maxW
                    : 0

                  return (
                    <div
                      key={ex.name}
                      style={{
                        background: 'var(--bg2)', border: '1px solid var(--border)',
                        borderRadius: 12, padding: '12px 14px', marginBottom: 8,
                      }}
                    >
                      {/* Name row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
                          {ex.name}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          {isPR && (
                            <span style={{
                              background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.35)',
                              borderRadius: 6, padding: '2px 7px',
                              fontFamily: 'var(--font-ar)', fontSize: 12, color: '#FBBF24',
                            }}>🏆 PR</span>
                          )}
                          {trend !== 0 && (
                            <span style={{
                              fontFamily: 'var(--font-ar)', fontSize: 12,
                              color: trend > 0 ? 'var(--green)' : 'var(--red)',
                            }}>
                              {trend > 0 ? '▲' : '▼'} {Math.abs(trend)}kg
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stats row */}
                      <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                        <div>
                          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginBottom: 2 }}>آخر جلسة</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                            {last.maxW}<span style={{ fontSize: 11, color: 'var(--text3)', marginRight: 2 }}>kg</span>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginBottom: 2 }}>الأعلى</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800, color: g.color }}>
                            {allMax}<span style={{ fontSize: 11, color: 'var(--text3)', marginRight: 2 }}>kg</span>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginBottom: 2 }}>جلسات</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800, color: 'var(--text2)' }}>
                            {ex.entries.length}
                          </div>
                        </div>
                      </div>

                      {/* Weight history chips */}
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {recent.map((entry, i) => {
                          const isLatest = i === recent.length - 1
                          const isMax    = entry.maxW === allMax
                          return (
                            <div
                              key={i}
                              style={{
                                background: isMax ? g.color + '20' : 'var(--bg3)',
                                border: `1px solid ${isMax ? g.color + '50' : 'var(--border)'}`,
                                borderRadius: 8, padding: '4px 8px',
                                fontFamily: 'var(--font-mono)', fontSize: 11,
                                color: isMax ? g.color : isLatest ? 'var(--text2)' : 'var(--text3)',
                                fontWeight: isMax ? 700 : 400,
                              }}
                            >
                              {entry.maxW}kg
                            </div>
                          )
                        })}
                        {ex.entries.length > 6 && (
                          <div style={{
                            background: 'var(--bg3)', border: '1px solid var(--border)',
                            borderRadius: 8, padding: '4px 8px',
                            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)',
                          }}>+{ex.entries.length - 6}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })
        )
      )}

      {/* ── EQUIPMENT VIEW ── */}
      {view === 'equipment' && (
        Object.keys(progressByEquipment).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', fontFamily: 'var(--font-ar)', color: 'var(--text3)', fontSize: 14 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔧</div>
            أنهِ جلسات أولاً لترى تمارينك مجمّعة حسب المعدة
          </div>
        ) : (
          Object.entries(progressByEquipment).map(([eq, exercises]) => {
            const label   = EQUIPMENT_LABELS[eq] || { ar: eq, emoji: '🏋️' }
            const groupPR = exercises[0]?.allMax || 0
            return (
              <div key={eq} style={{ marginBottom: 14 }}>
                {/* Equipment header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 8, paddingInline: 4,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{label.emoji}</span>
                    <span style={{ fontFamily: 'var(--font-ar)', fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
                      {label.ar}
                    </span>
                    <span style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)' }}>
                      · {exercises.length} تمرين
                    </span>
                  </div>
                  {/* Group PR badge */}
                  <div style={{
                    background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)',
                    borderRadius: 20, padding: '3px 10px',
                    fontFamily: 'var(--font-mono)', fontSize: 12, color: '#F59E0B', fontWeight: 700,
                  }}>🏆 {groupPR}kg</div>
                </div>

                {/* Exercise rows */}
                <div style={{
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  borderRadius: 12, overflow: 'hidden',
                }}>
                  {exercises.map((ex, i) => {
                    const last  = ex.entries[ex.entries.length - 1]
                    const trend = ex.entries.length >= 2
                      ? last.maxW - ex.entries[ex.entries.length - 2].maxW : 0
                    const isGroupPR = ex.allMax === groupPR

                    return (
                      <div key={ex.name} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '11px 14px',
                        borderBottom: i < exercises.length - 1 ? '1px solid var(--border)' : 'none',
                        background: isGroupPR ? 'rgba(245,158,11,0.04)' : 'transparent',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{ex.name}</div>
                          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                            {ex.entries.length} جلسة
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          {trend !== 0 && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: trend > 0 ? 'var(--green)' : 'var(--red)' }}>
                              {trend > 0 ? '▲' : '▼'}{Math.abs(trend)}
                            </span>
                          )}
                          <div style={{ textAlign: 'center' }}>
                            <div style={{
                              fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 800,
                              color: isGroupPR ? '#F59E0B' : 'var(--cyan)',
                            }}>{ex.allMax}kg</div>
                          </div>
                          {isGroupPR && <span style={{ fontSize: 14 }}>👑</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )
      )}

      {infoEx && <ExerciseInfoModal exercise={infoEx} onClose={() => setInfoEx(null)} />}
    </div>
  )
}
