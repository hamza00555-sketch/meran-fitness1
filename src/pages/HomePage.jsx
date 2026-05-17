import { Card, SectionTitle, ProgressBar } from '../components/ui.jsx'
import { DumbbellIcon, FlameIcon } from '../components/Icons.jsx'
import { xpProgress, getRank, getCommitmentLevel } from '../utils.js'
import { MUSCLE_GROUPS, WEEK_DAYS_SHORT, COMMITMENT_LEVELS } from '../constants.js'

function PlanDayCard({ day, dayNum, totalDays, onStart, onSkip }) {
  return (
    <Card style={{ padding: 18, marginBottom: 14, borderTop: '3px solid var(--purple)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--purple)', letterSpacing: 2, marginBottom: 4 }}>
            PLAN · {dayNum}/{totalDays}
          </div>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 17, fontWeight: 800 }}>{day.name}</div>
        </div>
        <div style={{
          background: 'rgba(155,89,182,0.15)', border: '1px solid rgba(155,89,182,0.3)',
          borderRadius: 20, padding: '3px 10px',
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--purple)',
        }}>{day.exercises.length} تمارين</div>
      </div>

      {/* Cycle indicator */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {Array.from({ length: totalDays }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i < (dayNum - 1) % totalDays || dayNum > totalDays
              ? 'var(--purple)' : i === (dayNum - 1) % totalDays
              ? 'var(--purple)' : 'var(--bg3)',
            opacity: i === (dayNum - 1) % totalDays ? 1 : i < (dayNum - 1) % totalDays ? 0.5 : 0.2,
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
        {day.exercises.map((ex, i) => (
          <span key={i} style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 20, padding: '3px 10px',
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)',
          }}>{ex.name}{ex.sets ? ` ×${ex.sets}` : ''}</span>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onStart}
          style={{
            flex: 1, padding: '12px',
            background: 'linear-gradient(135deg, #9B59B6, #7D3C98)',
            border: 'none', borderRadius: 12,
            color: 'white', fontFamily: 'var(--font-ar)', fontWeight: 800, fontSize: 15,
            cursor: 'pointer', boxShadow: '0 4px 16px rgba(155,89,182,0.35)',
          }}
        >⚔️ ابدأ</button>
        <button
          onClick={onSkip}
          style={{
            padding: '12px 16px',
            background: 'var(--bg2)', border: '1px solid var(--border2)',
            borderRadius: 12, color: 'var(--text3)',
            fontFamily: 'var(--font-ar)', fontSize: 14, cursor: 'pointer',
          }}
        >⏭️ تخطي</button>
      </div>
    </Card>
  )
}

// Hero illustration using custom artwork
function HeroIllustration({ isTraining }) {
  return (
    <img
      src={isTraining ? '/assets/hero_training.png' : '/assets/hero_rest.png'}
      alt=""
      style={{ width: 80, height: 80, objectFit: 'contain' }}
    />
  )
}

// Rank display using custom rank badge artwork
function RankRing({ rank, level }) {
  return (
    <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
      {rank.img && (
        <img src={rank.img} alt={rank.label}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      )}
      {/* Level number overlay */}
      <div style={{
        position: 'absolute', bottom: -6, left: '50%',
        transform: 'translateX(-50%)',
        background: rank.color, borderRadius: 10,
        padding: '1px 7px',
        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800,
        color: '#0A0A0A', whiteSpace: 'nowrap',
      }}>LV{level}</div>
    </div>
  )
}

// Commitment flames display
function CommitmentFlames({ streak }) {
  const level = COMMITMENT_LEVELS.slice().reverse().find(c => streak >= c.min) || COMMITMENT_LEVELS[0]
  const flames = level.flames || 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{
          opacity: i <= flames ? 1 : 0.18,
          animation: i <= flames ? `floatUp ${2 + i * 0.3}s ease-in-out infinite` : 'none',
          animationDelay: `${i * 0.15}s`,
        }}>
          <FlameIcon size={16} color={i <= flames ? level.color : '#4B5563'} />
        </div>
      ))}
    </div>
  )
}

export default function HomePage({ sessions, xp, streak, profile, onStartWorkout, onStartPlannedWorkout, onSkipPlanDay, onGoToWorkout, active, plan, planIndex }) {
  const { level, currentXP, neededXP, pct } = xpProgress(xp)
  const rank        = getRank(level)
  const today       = new Date().getDay()
  const trainingDays = profile?.trainingDays || []
  const isTodayTraining = trainingDays.includes(today)

  // Month muscle progress
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

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'صباح الخير' : hour < 17 ? 'مساء الخير' : 'مساء النور'

  const schedule = plan?.weeklySchedule
  const currentPlanDay = schedule?.length
    ? schedule[(planIndex ?? 0) % schedule.length]
    : null
  const planDayNum   = schedule?.length ? ((planIndex ?? 0) % schedule.length) + 1 : 1
  const planTotal    = schedule?.length ?? 1

  return (
    <div style={{ paddingBottom: 140 }}>

      {/* ── Player Hero Card ─────────────────────────────────── */}
      <div style={{
        position: 'relative',
        background: 'var(--bg1)',
        border: '1px solid var(--border)',
        borderBottom: `3px solid ${rank.color}`,
        borderRadius: 'var(--radius)',
        padding: '20px 18px',
        marginBottom: 14,
        overflow: 'hidden',
      }}>
        {/* Decorative glow blob */}
        <div style={{
          position: 'absolute', top: -30, left: -30,
          width: 140, height: 140, borderRadius: '50%',
          background: `radial-gradient(circle, ${rank.color}18 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
          <RankRing rank={rank} level={level} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)', marginBottom: 2 }}>
              {greeting}
            </div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 26, fontWeight: 900, lineHeight: 1.1, marginBottom: 6 }}>
              {profile?.name || 'حمزة'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                background: rank.bg, color: rank.color,
                border: `1px solid ${rank.color}40`,
                borderRadius: 20, padding: '2px 10px',
                fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
              }}>
                {rank.tier} · {rank.label}
              </span>
              <CommitmentFlames streak={streak} />
            </div>
          </div>
          {streak > 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)',
              borderRadius: 12, padding: '8px 10px',
            }}>
              <span style={{ fontSize: 20 }}>🔥</span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800,
                color: 'var(--orange)', lineHeight: 1,
              }}>{streak}</span>
              <span style={{ fontFamily: 'var(--font-ar)', fontSize: 10, color: 'var(--text3)' }}>يوم</span>
            </div>
          )}
        </div>

        {/* XP Bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{
            background: 'var(--gold-lo)', border: '1px solid var(--gold-md)',
            borderRadius: 20, padding: '4px 12px',
            fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gold)', fontWeight: 700,
          }}>⭐ {xp.toLocaleString()}</div>
          <div style={{
            background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.25)',
            borderRadius: 20, padding: '4px 12px',
            fontFamily: 'var(--font-mono)', fontSize: 13, color: '#F59E0B', fontWeight: 700,
          }}>LVL {level}</div>
        </div>
        <ProgressBar value={currentXP} max={neededXP} color="var(--gold)" height={10} />
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)',
          marginTop: 6, textAlign: 'left',
        }}>
          {currentXP} / {neededXP} XP · {pct}%
        </div>
      </div>

      {/* ── Plan Day Card ─────────────────────────────────────── */}
      {currentPlanDay && !active && (
        <PlanDayCard
          day={currentPlanDay}
          dayNum={planDayNum}
          totalDays={planTotal}
          onStart={() => onStartPlannedWorkout(currentPlanDay)}
          onSkip={onSkipPlanDay}
        />
      )}

      {/* ── Today Card ────────────────────────────────────────── */}
      <Card
        style={{
          padding: 20, marginBottom: 14,
          borderTop: `3px solid ${isTodayTraining ? 'var(--cyan)' : 'var(--purple)'}`,
          background: isTodayTraining ? 'rgba(155,89,182,0.06)' : 'rgba(155,89,182,0.04)',
          position: 'relative', overflow: 'hidden',
        }}
      >
        {/* Decorative circle */}
        <div style={{
          position: 'absolute', left: -20, bottom: -20,
          width: 100, height: 100, borderRadius: '50%',
          background: isTodayTraining
            ? 'rgba(155,89,182,0.08)'
            : 'rgba(155,89,182,0.05)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <HeroIllustration isTraining={isTodayTraining} />
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: 'var(--font-ar)', fontSize: 22, fontWeight: 900,
              color: isTodayTraining ? 'var(--cyan)' : 'var(--text2)',
              lineHeight: 1.2,
            }}>
              {isTodayTraining ? 'يوم تمرين 💪' : 'يوم راحة'}
            </div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
              {isTodayTraining
                ? 'اليوم مقرر له التمرين — حان الوقت!'
                : 'استرح واستعد ليوم القوة القادم'}
            </div>
          </div>
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
                  color: isToday ? '#F0F4FF' : isTraining ? 'var(--cyan)' : 'var(--text3)',
                  transition: 'all 0.2s',
                  boxShadow: isToday
                    ? '0 0 20px var(--cyan-md), 0 0 40px var(--cyan-glow)'
                    : isTraining
                      ? '0 0 10px var(--cyan-glow)'
                      : 'none',
                  animation: isToday ? 'glowPulse 2.5s ease-in-out infinite' : 'none',
                }}>
                  {isTraining
                    ? <DumbbellIcon size={18} color={isToday ? '#F0F4FF' : 'var(--cyan)'} />
                    : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: isToday ? 800 : 400 }}>{day}</span>
                  }
                </div>
                {isToday && (
                  <div className="pulse-dot" style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: 'var(--cyan)',
                  }} />
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* ── Muscle Progress ──────────────────────────────────── */}
      {muscleEntries.length > 0 && (
        <Card style={{ padding: 20, marginBottom: 16 }}>
          <SectionTitle>تقدم العضلات هذا الشهر</SectionTitle>
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

      {/* ── Fixed Bottom CTA ─────────────────────────────────── */}
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
            <button className="btn-cyan" onClick={onGoToWorkout} style={{
              boxShadow: '0 0 30px rgba(155,89,182,0.4)',
              animation: 'glowPulse 2s ease-in-out infinite',
            }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'currentColor', animation: 'pulseDot 1.5s ease-in-out infinite' }} />
              متابعة الجلسة
            </button>
          ) : (
            <button className="btn-cyan" onClick={onStartWorkout} style={{
              boxShadow: '0 0 24px rgba(155,89,182,0.35)',
            }}>
              ⚔️ ابدأ التمرين
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
