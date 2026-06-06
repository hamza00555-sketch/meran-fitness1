import { Card, SectionTitle, ProgressBar } from '../components/ui.jsx'
import { DumbbellIcon, FlameIcon } from '../components/Icons.jsx'
import { xpProgress, getRank, getCommitmentLevel } from '../utils.js'
import { MUSCLE_GROUPS, WEEK_DAYS_SHORT, COMMITMENT_LEVELS } from '../constants.js'

function PlanDayCard({ day, dayNum, totalDays, onStart, onSkip }) {
  return (
    <Card style={{ padding: 'var(--hp-card-pad)', marginBottom: 'var(--hp-card-mb)', borderTop: '3px solid var(--cyan)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cyan)', letterSpacing: 2, marginBottom: 3 }}>
            PLAN · {dayNum}/{totalDays}
          </div>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 16, fontWeight: 800 }}>{day.name}</div>
        </div>
        <div style={{
          background: 'var(--cyan-lo)', border: '1px solid var(--cyan-md)',
          borderRadius: 20, padding: '3px 10px',
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cyan)',
        }}>{day.exercises.length} تمارين</div>
      </div>

      <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
        {Array.from({ length: totalDays }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i < (dayNum - 1) % totalDays || dayNum > totalDays
              ? 'var(--cyan)' : i === (dayNum - 1) % totalDays
              ? 'var(--cyan)' : 'var(--bg3)',
            opacity: i === (dayNum - 1) % totalDays ? 1 : i < (dayNum - 1) % totalDays ? 0.5 : 0.15,
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
        {day.exercises.map((ex, i) => (
          <span key={i} style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 20, padding: '3px 10px',
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)',
          }}>{ex.name}{ex.sets ? ` ×${ex.sets}` : ''}</span>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onStart} style={{
          flex: 1, padding: '11px',
          background: 'var(--grad-primary)', border: 'none', borderRadius: 12,
          color: 'white', fontFamily: 'var(--font-ar)', fontWeight: 800, fontSize: 15,
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(94,195,42,0.35)',
        }}>⚡ ابدأ</button>
        <button onClick={onSkip} style={{
          padding: '11px 14px',
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: 12, color: 'var(--text3)',
          fontFamily: 'var(--font-ar)', fontSize: 14, cursor: 'pointer',
        }}>⏭️ تخطي</button>
      </div>
    </Card>
  )
}

// Hero illustration — fills its container
function HeroIllustration({ isTraining }) {
  return (
    <img
      src={isTraining ? '/assets/hero_training.png' : '/assets/hero_rest.png'}
      alt=""
      style={{ width: '90%', height: '90%', objectFit: 'contain', filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.4))' }}
    />
  )
}

// Rank badge — fills its container
function RankRing({ rank, level }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {rank.img && (
        <img src={rank.img} alt={rank.label}
          style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 3px 12px rgba(0,0,0,0.5))' }} />
      )}
      <div style={{
        position: 'absolute', bottom: -4, left: '50%',
        transform: 'translateX(-50%)',
        background: rank.color, borderRadius: 8,
        padding: '2px 8px',
        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 800,
        color: '#0A0A0A', whiteSpace: 'nowrap',
        boxShadow: `0 2px 8px ${rank.color}60`,
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
          <FlameIcon size={14} color={i <= flames ? level.color : '#4B5563'} />
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

      {/* ── Logo Card ────────────────────────────────────────────── */}
      <Card style={{
        marginBottom: 'var(--hp-card-mb)',
        padding: '14px 20px',
        background: 'linear-gradient(135deg, rgba(94,195,42,0.07) 0%, rgba(15,28,46,0.95) 55%, rgba(59,157,232,0.05) 100%)',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        overflow: 'hidden',
        position: 'relative',
      }} topColor="var(--cyan)">
        {/* subtle background glow blob */}
        <div style={{
          position: 'absolute', insetInlineEnd: 10, top: '50%', transform: 'translateY(-50%)',
          width: 180, height: 60, borderRadius: 999,
          background: 'radial-gradient(ellipse, rgba(94,195,42,0.18) 0%, rgba(94,195,42,0.06) 45%, transparent 72%)',
          filter: 'blur(16px)',
          pointerEvents: 'none',
        }} />
        <img
          src="/assets/meran-wordmark-transparent-192.png"
          alt="MERAN"
          style={{
            position: 'relative', zIndex: 1,
            width: 138, maxWidth: '42vw', height: 'auto',
            objectFit: 'contain', display: 'block',
            filter: 'drop-shadow(0 0 12px rgba(94,195,42,0.30))',
          }}
        />
      </Card>

      {/* ── Player Hero Card ─────────────────────────────────────
          Horizontal layout: text RIGHT (RTL-first) · icon LEFT   */}
      <div style={{
        position: 'relative',
        background: 'var(--grad-hero)',
        border: '1px solid rgba(94,195,42,0.12)',
        borderBottom: `3px solid ${rank.color}`,
        borderRadius: 'var(--radius)',
        marginBottom: 'var(--hp-card-mb)',
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}>
        {/* App icon watermark */}
        <img src="/assets/meran-app-icon-transparent-512.png" alt="" style={{
          position: 'absolute', bottom: -18, left: -18,
          width: 110, height: 110, objectFit: 'contain',
          opacity: 0.045, pointerEvents: 'none',
          filter: 'blur(1px)',
        }} />

        {/* Decorative blobs */}
        <div style={{
          position: 'absolute', top: -30, left: -30, width: 130, height: 130, borderRadius: '50%',
          background: `radial-gradient(circle, ${rank.color}20 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -20, right: -20, width: 90, height: 90, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,157,232,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* ── Inner row: text (right) + icon (left) ── */}
        <div className="hp-row" style={{ position: 'relative', zIndex: 1 }}>

          {/* TEXT SIDE — appears on RIGHT in RTL (first child) */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="hp-meta" style={{ fontFamily: 'var(--font-ar)', marginBottom: 2 }}>{greeting}</div>
            <div className="hp-title" style={{ fontFamily: 'var(--font-ar)', marginBottom: 6 }}>
              {profile?.name || 'حمزة'}
            </div>

            {/* Rank + streak + flames */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{
                background: rank.bg, color: rank.color,
                border: `1px solid ${rank.color}40`,
                borderRadius: 20, padding: '2px 10px',
                fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
              }}>{rank.tier} · {rank.label}</span>
              {streak > 0 && (
                <span style={{
                  color: 'var(--orange)', fontFamily: 'var(--font-mono)',
                  fontSize: 12, fontWeight: 700,
                }}>🔥 {streak}</span>
              )}
              <CommitmentFlames streak={streak} />
            </div>

            {/* XP + Level badges */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 7, flexWrap: 'wrap' }}>
              <div style={{
                background: 'var(--gold-lo)', border: '1px solid var(--gold-md)',
                borderRadius: 20, padding: '3px 10px',
                fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gold)', fontWeight: 700,
              }}>⭐ {xp.toLocaleString()}</div>
              <div style={{
                background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.25)',
                borderRadius: 20, padding: '3px 10px',
                fontFamily: 'var(--font-mono)', fontSize: 12, color: '#F59E0B', fontWeight: 700,
              }}>LVL {level}</div>
            </div>

            <ProgressBar value={currentXP} max={neededXP} color="var(--gold)" height={7} gradient />
            <div className="hp-meta" style={{ fontFamily: 'var(--font-mono)', marginTop: 4, textAlign: 'left' }}>
              {currentXP} / {neededXP} XP · {pct}%
            </div>
          </div>

          {/* ICON SIDE — appears on LEFT in RTL (second child) */}
          <div className="hp-icon" style={{
            background: rank.color + '15',
            border: `1.5px solid ${rank.color}30`,
          }}>
            <RankRing rank={rank} level={level} />
          </div>
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

      {/* ── Today Card ────────────────────────────────────────────
          Horizontal: title/desc RIGHT · illustration LEFT         */}
      <Card style={{
        padding: 0,
        marginBottom: 'var(--hp-card-mb)',
        borderTop: `3px solid ${isTodayTraining ? 'var(--cyan)' : 'var(--purple)'}`,
        background: isTodayTraining
          ? 'linear-gradient(135deg, rgba(94,195,42,0.07) 0%, rgba(59,157,232,0.04) 100%)'
          : 'linear-gradient(135deg, rgba(59,157,232,0.05) 0%, rgba(94,195,42,0.03) 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative circle */}
        <div style={{
          position: 'absolute', left: -16, bottom: -16,
          width: 80, height: 80, borderRadius: '50%',
          background: isTodayTraining ? 'rgba(94,195,42,0.08)' : 'rgba(59,157,232,0.06)',
          pointerEvents: 'none',
        }} />

        <div className="hp-row" style={{ position: 'relative', zIndex: 1 }}>
          {/* TEXT (right in RTL) */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="hp-title" style={{
              fontFamily: 'var(--font-ar)',
              color: isTodayTraining ? 'var(--cyan)' : 'var(--text2)',
              marginBottom: 5,
            }}>
              {isTodayTraining ? 'يوم تمرين 💪' : 'يوم راحة'}
            </div>
            <div className="hp-sub" style={{ fontFamily: 'var(--font-ar)' }}>
              {isTodayTraining
                ? 'اليوم مقرر له التمرين — حان الوقت!'
                : 'استرح واستعد ليوم القوة القادم'}
            </div>
          </div>

          {/* ILLUSTRATION (left in RTL) */}
          <div className="hp-icon" style={{ background: 'transparent', border: 'none', borderRadius: 0 }}>
            <HeroIllustration isTraining={isTodayTraining} />
          </div>
        </div>
      </Card>

      {/* ── Weekly Schedule ───────────────────────────────────── */}
      <Card style={{ padding: 'var(--hp-card-pad)', marginBottom: 'var(--hp-card-mb)' }}>
        <SectionTitle>الجدول الأسبوعي</SectionTitle>
        <div style={{ display: 'flex', gap: 5, justifyContent: 'space-between' }}>
          {WEEK_DAYS_SHORT.map((day, idx) => {
            const isToday    = idx === today
            const isTraining = trainingDays.includes(idx)
            return (
              <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: isToday ? 'var(--cyan)' : isTraining ? 'var(--cyan-lo)' : 'var(--bg3)',
                  border: isToday ? '2px solid var(--cyan)' : isTraining ? '2px solid var(--border2)' : '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isToday ? '#F0F4FF' : isTraining ? 'var(--cyan)' : 'var(--text3)',
                  transition: 'all 0.2s',
                  boxShadow: isToday
                    ? '0 0 20px var(--cyan-md), 0 0 40px var(--cyan-glow)'
                    : isTraining ? '0 0 10px var(--cyan-glow)' : 'none',
                  animation: isToday ? 'glowPulse 2.5s ease-in-out infinite' : 'none',
                }}>
                  {isTraining
                    ? <DumbbellIcon size={16} color={isToday ? '#F0F4FF' : 'var(--cyan)'} />
                    : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: isToday ? 800 : 400 }}>{day}</span>
                  }
                </div>
                {isToday && (
                  <div className="pulse-dot" style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--cyan)' }} />
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* ── Muscle Progress ──────────────────────────────────── */}
      {muscleEntries.length > 0 && (
        <Card style={{ padding: 'var(--hp-card-pad)', marginBottom: 'var(--hp-card-mb)' }}>
          <SectionTitle>تقدم العضلات هذا الشهر</SectionTitle>
          {muscleEntries.map(([muscle, count]) => {
            const g = MUSCLE_GROUPS[muscle]
            if (!g) return null
            return (
              <div key={muscle} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontFamily: 'var(--font-ar)', fontSize: 14, fontWeight: 600 }}>
                    {g.emoji} {g.label}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text3)' }}>
                    {count} sets
                  </span>
                </div>
                <ProgressBar value={count} max={maxSets} color={g.color} height={8} />
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
            <button className="btn-cyan btn-active-glow" onClick={onGoToWorkout}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'currentColor', animation: 'pulseDot 1.5s ease-in-out infinite' }} />
              متابعة الجلسة
            </button>
          ) : (
            <button className="btn-cyan" onClick={onStartWorkout}>
              ⚡ ابدأ التمرين
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
