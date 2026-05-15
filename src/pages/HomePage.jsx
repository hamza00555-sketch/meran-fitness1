import { Card, SectionTitle, ProgressBar } from '../components/ui.jsx'
import { DumbbellIcon } from '../components/Icons.jsx'
import { xpProgress, getRank, getCommitmentLevel } from '../utils.js'
import { MUSCLE_GROUPS, WEEK_DAYS_SHORT } from '../constants.js'

export default function HomePage({ sessions, xp, streak, profile, onStartWorkout, onGoToWorkout, active }) {
  const { level, currentXP, neededXP, pct } = xpProgress(xp)
  const rank        = getRank(level)
  const commitment  = getCommitmentLevel(streak)
  const today       = new Date().getDay() // 0=Sun

  // Training days from profile (array of 0-6)
  const trainingDays = profile?.trainingDays || []
  const isTodayTraining = trainingDays.includes(today)

  // Muscle progress this month (last 30 days)
  const monthAgo = Date.now() - 30 * 86400000
  const monthSessions = sessions.filter(s => new Date(s.date) > monthAgo)
  const muscleSets = {}
  monthSessions.forEach(s => {
    s.exercises.forEach(ex => {
      const count = ex.sets.filter(ss => ss.done).length
      muscleSets[ex.muscle] = (muscleSets[ex.muscle] || 0) + count
    })
  })
  const muscleEntries = Object.entries(muscleSets).sort((a, b) => b[1] - a[1])
  const maxSets = muscleEntries[0]?.[1] || 1

  // Greeting based on time of day
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'صباح الخير' : hour < 17 ? 'مساء الخير' : 'مساء النور'

  return (
    <div style={{ paddingBottom: 120 }}>

      {/* ── Greeting ──────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-ar)', fontSize: 14, color: 'var(--text3)', marginBottom: 4 }}>
          {greeting} 👋
        </div>
        <div style={{ fontFamily: 'var(--font-ar)', fontSize: 26, fontWeight: 900, lineHeight: 1.2 }}>
          {profile?.name || 'حمزة'}
        </div>
      </div>

      {/* ── XP Card ───────────────────────────────────────────── */}
      <Card style={{ padding: 24, marginBottom: 14 }} topColor="var(--gold)">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          {/* XP Badge */}
          <div style={{
            background: 'var(--gold-lo)', border: '1px solid var(--gold-md)',
            borderRadius: 20, padding: '6px 14px',
            fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--gold)', fontWeight: 700,
          }}>
            ⭐ {xp.toLocaleString()} XP
          </div>

          {/* Level Badge */}
          <div style={{
            background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.3)',
            borderRadius: 20, padding: '6px 14px',
            fontFamily: 'var(--font-mono)', fontSize: 15, color: '#F59E0B', fontWeight: 700,
          }}>
            LVL {level}
          </div>

          {/* Rank */}
          <div style={{ marginRight: 'auto' }}>
            <span style={{
              background: rank.bg, border: `1px solid ${rank.color}50`,
              borderRadius: 20, padding: '5px 12px',
              fontFamily: 'var(--font-mono)', fontSize: 13,
              color: rank.color, fontWeight: 700,
            }}>
              {rank.tier} · {rank.label}
            </span>
          </div>
        </div>

        {/* XP Progress Bar */}
        <ProgressBar value={currentXP} max={neededXP} color="var(--gold)" height={10} />
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text3)',
          marginTop: 8, textAlign: 'left',
        }}>
          {currentXP} / {neededXP} XP · {pct}%
        </div>
      </Card>

      {/* ── Today Card ────────────────────────────────────────── */}
      <Card
        style={{
          padding: 20, marginBottom: 14,
          borderTop: `3px solid ${isTodayTraining ? 'var(--cyan)' : 'var(--purple)'}`,
          background: isTodayTraining ? 'var(--cyan-lo)' : 'var(--purple-lo)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: isTodayTraining ? 'var(--cyan-md)' : 'var(--purple-md)',
            border: `2px solid ${isTodayTraining ? 'var(--cyan)' : 'var(--purple)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {isTodayTraining
              ? <DumbbellIcon size={26} color="var(--cyan)" />
              : <span style={{ fontSize: 24 }}>😴</span>
            }
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: 'var(--font-ar)', fontSize: 22, fontWeight: 900,
              color: isTodayTraining ? 'var(--cyan)' : 'var(--purple)',
              lineHeight: 1.2,
            }}>
              {isTodayTraining ? 'يوم تمرين 💪' : 'يوم راحة'}
            </div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 14, color: 'var(--text3)', marginTop: 3 }}>
              {isTodayTraining ? 'اليوم مقرر له التمرين — حان الوقت!' : 'استرح واستعد ليوم القوة القادم'}
            </div>
          </div>
          {streak > 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)',
              borderRadius: 12, padding: '8px 12px',
            }}>
              <span style={{ fontSize: 22 }}>🔥</span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 800,
                color: 'var(--orange)', lineHeight: 1,
              }}>{streak}</span>
              <span style={{ fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--text3)' }}>يوم</span>
            </div>
          )}
        </div>
      </Card>

      {/* ── Weekly Schedule ───────────────────────────────────── */}
      <Card style={{ padding: 20, marginBottom: 14 }}>
        <SectionTitle>الجدول الأسبوعي</SectionTitle>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
          {WEEK_DAYS_SHORT.map((day, idx) => {
            const isToday    = idx === today
            const isTraining = trainingDays.includes(idx)
            return (
              <div key={idx} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: isToday
                    ? 'var(--cyan)'
                    : isTraining
                      ? 'var(--cyan-lo)'
                      : 'var(--bg3)',
                  border: isToday
                    ? '2px solid var(--cyan)'
                    : isTraining
                      ? '2px solid var(--border2)'
                      : '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isToday ? '#0A0A0A' : isTraining ? 'var(--cyan)' : 'var(--text3)',
                  fontWeight: isToday ? 800 : 400,
                  transition: 'all 0.2s',
                  boxShadow: isToday
                    ? '0 0 16px var(--cyan-md)'
                    : isTraining
                      ? '0 0 8px var(--cyan-glow)'
                      : 'none',
                }}>
                  {isTraining
                    ? <DumbbellIcon
                        size={20}
                        color={isToday ? '#0A0A0A' : 'var(--cyan)'}
                      />
                    : (
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 12,
                        fontWeight: isToday ? 800 : 400,
                      }}>{day}</span>
                    )
                  }
                </div>
                {isToday && (
                  <div style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: 'var(--cyan)',
                  }} />
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* ── Muscle Progress (this month) ──────────────────────── */}
      {muscleEntries.length > 0 && (
        <Card style={{ padding: 20, marginBottom: 16 }}>
          <SectionTitle>تقدم العضلات (هذا الشهر)</SectionTitle>
          {muscleEntries.map(([muscle, count]) => {
            const g = MUSCLE_GROUPS[muscle]
            if (!g) return null
            return (
              <div key={muscle} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 600 }}>
                    {g.emoji} {g.label}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text3)' }}>
                    {count} sets
                  </span>
                </div>
                <ProgressBar value={count} max={maxSets} color={g.color} height={10} />
              </div>
            )
          })}
        </Card>
      )}

      {/* ── Fixed Bottom CTA ──────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 0,
        left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 560,
        padding: '12px 16px calc(var(--safe-bottom) + 76px)',
        background: 'linear-gradient(transparent, var(--bg) 40%)',
        pointerEvents: 'none',
      }}>
        <div style={{ pointerEvents: 'all' }}>
          {active ? (
            <button className="btn-cyan" onClick={onGoToWorkout}>
              <span className="pulse-dot" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'currentColor' }} />
              متابعة الجلسة
            </button>
          ) : (
            <button className="btn-cyan" onClick={onStartWorkout}>
              ⚔️ ابدأ التمرين
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
