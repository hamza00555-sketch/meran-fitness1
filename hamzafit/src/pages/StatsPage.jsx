import { useState } from 'react'
import { Card, StatBox } from '../components/ui.jsx'
import CalendarHeatmap from '../components/CalendarHeatmap.jsx'
import BarChart from '../components/BarChart.jsx'
import { calcStreak, sessionVolume, calc1RM } from '../utils.js'
import { MUSCLE_GROUPS } from '../constants.js'

export default function StatsPage({ sessions }) {
  const [selectedEx, setSelectedEx] = useState('')

  if (!sessions.length) return (
    <div style={{ textAlign: 'center', padding: '80px 20px 100px' }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>📊</div>
      <div style={{ fontFamily: 'var(--font-ar)', fontSize: 18, color: 'var(--text3)' }}>
        ابدأ جلسات لتظهر الإحصائيات
      </div>
    </div>
  )

  // ── Basic stats ───────────────────────────────────────────────
  const streak = calcStreak(sessions)
  const thisWeek = sessions.filter(s => (Date.now() - new Date(s.date)) < 7 * 86400000).length
  const totalVol = sessions.reduce((a, s) => a + sessionVolume(s), 0)
  const durSessions = sessions.filter(s => s.duration)
  const avgDur = durSessions.length
    ? Math.round(durSessions.reduce((a, s) => a + s.duration, 0) / durSessions.length)
    : 0
  const totalSets = sessions.flatMap(s => s.exercises.flatMap(e => e.sets)).filter(s => s.done).length

  // ── Volume per session (last 10) ──────────────────────────────
  const volumeData = sessions.slice(0, 10).reverse().map(s => ({
    label: s.date.split('T')[0],
    value: Math.round(sessionVolume(s)),
  }))

  // ── Muscle distribution ───────────────────────────────────────
  const muscleCount = {}
  sessions.flatMap(s => s.exercises).forEach(ex => {
    muscleCount[ex.muscle] = (muscleCount[ex.muscle] || 0) + ex.sets.length
  })
  const muscleTotal = Object.values(muscleCount).reduce((a, b) => a + b, 0) || 1
  const muscleSorted = Object.entries(muscleCount).sort((a, b) => b[1] - a[1])

  // ── All exercise names ────────────────────────────────────────
  const allExercises = [...new Set(sessions.flatMap(s => s.exercises.map(e => e.name)))]

  // ── 1RM history for selected exercise ─────────────────────────
  const ormData = selectedEx
    ? sessions
        .filter(s => s.exercises.some(e => e.name === selectedEx))
        .map(s => {
          const ex = s.exercises.find(e => e.name === selectedEx)
          const maxSet = ex.sets.reduce((best, ss) => {
            const r1 = parseInt(ss.r1) || 0
            const w = parseFloat(ss.weight) || 0
            const orm = calc1RM(w, r1)
            return orm > (calc1RM(parseFloat(best.weight) || 0, parseInt(best.r1) || 0)) ? ss : best
          }, ex.sets[0] || {})
          return {
            label: s.date.split('T')[0],
            value: calc1RM(parseFloat(maxSet.weight) || 0, parseInt(maxSet.r1) || 0),
          }
        })
        .reverse()
        .slice(0, 10)
    : []

  return (
    <div style={{ paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <StatBox label="إجمالي الجلسات"   value={sessions.length}              color="var(--orange)" />
        <StatBox label="هذا الأسبوع"      value={thisWeek}                     color="var(--green)"  />
        <StatBox label="Sets مكتملة"       value={totalSets}                    color="var(--blue)"   />
        <StatBox label="Streak 🔥"         value={streak}                       color="var(--gold)"   />
      </div>

      {/* Volume & avg */}
      <Card glow="var(--orange)">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)', marginBottom: 4 }}>
              إجمالي الحجم التدريبي
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, color: 'var(--gold)' }}>
              {(totalVol / 1000).toFixed(2)}{' '}
              <span style={{ fontSize: 14, color: 'var(--text4)' }}>طن</span>
            </div>
          </div>
          {avgDur > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--purple)' }}>
                {avgDur}
              </div>
              <div style={{ fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--text3)' }}>
                متوسط الدقائق
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Calendar heatmap */}
      <Card>
        <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, fontWeight: 700, color: 'var(--text3)', marginBottom: 12 }}>
          📅 نشاط ١٤ أسبوع
        </div>
        <CalendarHeatmap sessions={sessions} />
      </Card>

      {/* Volume bar chart */}
      <Card glow="var(--orange)">
        <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, fontWeight: 700, color: 'var(--text3)', marginBottom: 14 }}>
          📊 Volume آخر ١٠ جلسات (kg)
        </div>
        <BarChart data={volumeData} valueKey="value" labelKey="label" color="var(--orange)" />
      </Card>

      {/* Muscle distribution */}
      <Card glow="var(--blue)">
        <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, fontWeight: 700, color: 'var(--text3)', marginBottom: 14 }}>
          🎯 توزيع العضلات
        </div>
        {muscleSorted.map(([m, c]) => {
          const color = MUSCLE_GROUPS[m]?.color || 'var(--orange)'
          const pct = Math.round((c / muscleTotal) * 100)
          return (
            <div key={m} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontFamily: 'var(--font-ar)', fontSize: 13 }}>
                  {MUSCLE_GROUPS[m]?.emoji} {m}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text4)' }}>
                  {c} sets · {pct}%
                </span>
              </div>
              <div style={{ background: 'var(--bg3)', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: color, borderRadius: 4,
                  transition: 'width 0.8s ease',
                }} />
              </div>
            </div>
          )
        })}
      </Card>

      {/* 1RM tracker */}
      <Card glow="var(--gold)">
        <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, fontWeight: 700, color: 'var(--text3)', marginBottom: 12 }}>
          📈 تطور الـ 1RM المقدر
        </div>
        <select
          value={selectedEx}
          onChange={e => setSelectedEx(e.target.value)}
          style={{
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '9px 12px',
            color: 'var(--text)', fontFamily: 'var(--font-ar)',
            fontSize: 13, width: '100%', marginBottom: 14,
            outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="">— اختر تمرين —</option>
          {allExercises.map(ex => <option key={ex}>{ex}</option>)}
        </select>

        {selectedEx && ormData.length > 0 && (
          <>
            <BarChart data={ormData} valueKey="value" labelKey="label" color="var(--gold)" />
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--text4)', marginTop: 10, textAlign: 'center',
            }}>
              Max estimated 1RM: <span style={{ color: 'var(--gold)', fontWeight: 700 }}>
                {Math.max(...ormData.map(d => d.value))} kg
              </span>
            </div>
          </>
        )}
        {selectedEx && ormData.length === 0 && (
          <div style={{ color: 'var(--text4)', fontFamily: 'var(--font-ar)', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>
            لا يوجد بيانات كافية لهذا التمرين
          </div>
        )}
      </Card>
    </div>
  )
}
