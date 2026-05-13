import { useState } from 'react'
import { Card, Badge, Btn } from '../components/ui.jsx'
import { fmtDate, fmtTime, sessionVolume } from '../utils.js'
import { MUSCLE_GROUPS } from '../constants.js'

export default function HistoryPage({ sessions, onDelete, onShowExport }) {
  const [expanded, setExpanded] = useState(null)

  if (!sessions.length) return (
    <div style={{ textAlign: 'center', padding: '80px 20px 100px' }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>📋</div>
      <div style={{ fontFamily: 'var(--font-ar)', fontSize: 18, color: 'var(--text3)' }}>
        لا يوجد سجل بعد
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text4)', marginTop: 8 }}>
        أنهِ جلسة لتظهر هنا
      </div>
    </div>
  )

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Export button */}
      <div style={{ marginBottom: 16 }}>
        <Btn onClick={onShowExport} variant="gold" full style={{ fontSize: 14, padding: 12 }}>
          📥 تصدير البيانات
        </Btn>
      </div>

      {/* Sessions list */}
      {sessions.map(s => {
        const muscles = [...new Set(s.exercises.map(e => e.muscle))]
        const allSets = s.exercises.flatMap(e => e.sets)
        const doneSets = allSets.filter(ss => ss.done).length
        const maxW = Math.max(...allSets.map(ss => parseFloat(ss.weight) || 0), 0)
        const vol = sessionVolume(s)
        const isOpen = expanded === s.id

        return (
          <Card
            key={s.id}
            style={{ marginBottom: 12, cursor: 'pointer' }}
            onClick={() => setExpanded(isOpen ? null : s.id)}
          >
            {/* Top row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 700, marginBottom: 3 }}>
                  {fmtDate(s.date)}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text4)', marginBottom: 8 }}>
                  {fmtTime(s.date)} · {s.duration ? `${s.duration} دقيقة` : '—'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {muscles.map(m => (
                    <Badge key={m} color={MUSCLE_GROUPS[m]?.color || 'var(--orange)'}>
                      {MUSCLE_GROUPS[m]?.emoji} {m}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Stats column */}
              <div style={{ display: 'flex', gap: 14, textAlign: 'center', flexShrink: 0, marginRight: 8 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--orange)' }}>
                    {s.exercises.length}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text4)', fontFamily: 'var(--font-ar)' }}>تمرين</div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>
                    {doneSets}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text4)', fontFamily: 'var(--font-ar)' }}>sets ✓</div>
                </div>
                {maxW > 0 && (
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--gold)' }}>
                      {maxW}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text4)', fontFamily: 'var(--font-ar)' }}>max kg</div>
                  </div>
                )}
              </div>
            </div>

            {/* Volume bar */}
            {vol > 0 && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text4)', marginBottom: isOpen ? 14 : 0 }}>
                📦 {(vol / 1000).toFixed(2)} طن volume
              </div>
            )}

            {/* Expanded detail */}
            {isOpen && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                {s.exercises.map((ex, ei) => (
                  <div key={ei} style={{ marginBottom: 12 }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 12,
                      color: MUSCLE_GROUPS[ex.muscle]?.color || 'var(--orange)',
                      marginBottom: 6,
                    }}>
                      {ex.emoji} {ex.name}
                    </div>
                    {ex.sets.map((ss, si) => (
                      <div key={si} style={{
                        fontFamily: 'var(--font-mono)', fontSize: 11,
                        color: ss.done ? 'var(--text3)' : 'var(--text4)',
                        marginBottom: 3, paddingRight: 8,
                      }}>
                        {ss.done ? '✓' : '○'} Set {si + 1}: {ss.weight || '—'}kg
                        {' '}— {ss.r1 || '—'}/{ss.r2 || '—'}/{ss.r3 || '—'} reps
                      </div>
                    ))}
                  </div>
                ))}

                {/* Delete */}
                <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                  <Btn
                    onClick={e => { e.stopPropagation(); onDelete(s.id) }}
                    variant="danger"
                    style={{ fontSize: 12, padding: '7px 14px' }}
                  >
                    🗑️ حذف الجلسة
                  </Btn>
                </div>
              </div>
            )}

            {/* Expand indicator */}
            <div style={{
              textAlign: 'center', marginTop: 8,
              color: 'var(--text4)', fontSize: 12,
            }}>
              {isOpen ? '▲' : '▼'}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
