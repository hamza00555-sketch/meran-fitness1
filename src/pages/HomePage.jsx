import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Card, SectionTitle, ProgressBar } from '../components/ui.jsx'
import Art from '../assets/Art.jsx'
import { DumbbellIcon, FlameIcon, DropletIcon } from '../components/Icons.jsx'
import { DeloadSuggestion } from '../components/DeloadBanner.jsx'
import DayPreviewSheet from '../components/DayPreviewSheet.jsx'
import TodayHero from '../components/TodayHero.jsx'
import { xpProgress, getRank, getCommitmentLevel, getExerciseStats, substitutedName, nextSubIndex, fmtDate } from '../utils.js'
import { MUSCLE_GROUPS, COMMITMENT_LEVELS, EXERCISE_ALTERNATIVES } from '../constants.js'
import { DAY_STATUS } from '../recovery.js'

function PlanProgressCard({ plan, planIndex }) {
  const schedule      = plan.weeklySchedule
  const durationWeeks = plan.durationWeeks || 6
  const totalSessions = durationWeeks * schedule.length
  const dayInCycle    = planIndex % schedule.length        // 0-based current day in weekly cycle
  const currentWeek   = Math.min(Math.floor(planIndex / schedule.length) + 1, durationWeeks)
  const overallPct    = Math.min(100, Math.round((planIndex / totalSessions) * 100))
  const isCompleted   = planIndex >= totalSessions

  // Day type label abbreviation: "Push A" → "Push", "Legs B" → "Legs"
  const shortLabel = (name) => name.split('—')[0].trim().split(' ')[0]

  return (
    <Card style={{ padding: 'var(--hp-card-pad)', marginBottom: 'var(--hp-card-mb)' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cyan)', letterSpacing: 2, marginBottom: 2 }}>
            PROGRAM PROGRESS
          </div>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, fontWeight: 700, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {plan.planName}
          </div>
        </div>
        <div style={{
          flexShrink: 0, marginRight: 10,
          background: isCompleted ? 'var(--gold-lo)' : 'var(--cyan-lo)',
          border: `1px solid ${isCompleted ? 'var(--gold-md)' : 'var(--cyan-md)'}`,
          borderRadius: 20, padding: '3px 12px',
          fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
          color: isCompleted ? 'var(--gold)' : 'var(--cyan)',
        }}>
          {isCompleted ? '🏆 مكتمل' : `W${currentWeek}/${durationWeeks}`}
        </div>
      </div>

      {/* Overall progress bar + stats */}
      <ProgressBar value={planIndex} max={totalSessions} color="var(--cyan)" height={7} gradient />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, marginBottom: 14 }}>
        <span style={{ fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--text3)' }}>
          {planIndex} من {totalSessions} جلسة
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cyan)', fontWeight: 700 }}>
          {overallPct}%
        </span>
      </div>

      {/* This cycle's day bubbles */}
      <div style={{ display: 'flex', gap: 4 }}>
        {schedule.map((day, i) => {
          const isDone    = i < dayInCycle
          const isCurrent = i === dayInCycle && !isCompleted
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: '100%', height: 30, borderRadius: 8,
                background: isDone ? 'var(--cyan)' : isCurrent ? 'var(--cyan-lo)' : 'var(--bg3)',
                border: isCurrent ? '2px solid var(--cyan)' : `1px solid ${isDone ? 'var(--cyan)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isDone ? '#0A0E14' : isCurrent ? 'var(--cyan)' : 'var(--text3)',
                fontSize: 13, fontWeight: 800,
                animation: isCurrent ? 'glowPulse 2.5s ease-in-out infinite' : 'none',
                boxShadow: isCurrent ? '0 0 12px var(--cyan-glow)' : 'none',
                transition: 'all 0.2s',
              }}>
                {isDone ? '✓' : isCurrent ? '▶' : String(i + 1)}
              </div>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9,
                color: isDone ? 'var(--cyan)' : isCurrent ? 'var(--text)' : 'var(--text3)',
                fontWeight: isCurrent ? 700 : 400,
              }}>{shortLabel(day.name)}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ── Helper: find videoUrl for an exercise name across all muscle groups ──



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

// Commitment meter. Five marks, filled by the streak.
//
// Normally they are flames and they carry the tier's own colour — that
// colour is the tier's identity, not the app's accent, which is why it
// stays put when everything else changes.
//
// Under a deload the metaphor itself changes: flames say push harder,
// and this is a week that says the opposite. They become droplets, they
// take the accent, and they drift more slowly. The streak underneath is
// untouched — a deload lightens the load, it does not change what
// counts as showing up.
function CommitmentFlames({ streak, deload = false }) {
  const level = COMMITMENT_LEVELS.slice().reverse().find(c => streak >= c.min) || COMMITMENT_LEVELS[0]
  const flames = level.flames || 0
  const Mark = deload ? DropletIcon : FlameIcon
  const lit  = deload ? 'var(--cyan)' : level.color
  const beat = deload ? 1.6 : 1
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{
          opacity: i <= flames ? (deload ? 0.9 : 1) : 0.18,
          animation: i <= flames ? `floatUp ${(2 + i * 0.3) * beat}s ease-in-out infinite` : 'none',
          animationDelay: `${i * 0.15 * beat}s`,
        }}>
          <Mark size={14} color={i <= flames ? lit : '#4B5563'} />
        </div>
      ))}
    </div>
  )
}

export default function HomePage({ sessions, xp, streak, profile, onStartWorkout, onStartPlannedWorkout, onSkipPlanDay, onGoToWorkout, active, plan, planIndex, exerciseMapping = {}, exerciseSubs = {}, onCycleSub, recovery, onOverrideRecovery, restCredits = 0, creditProgress = 0, creditTarget = 5, daysToNextCredit = 5, atMaxCredits = false, monthReport = null, onShowMonthReport, deload = null, deloadSuggestion = null,
  onStartDeload, onDismissDeloadSuggestion, onOpenDeload }) {
  const { level, currentXP, neededXP, pct } = xpProgress(xp)
  const rank        = getRank(level)
  // Training vs recovery comes from the recovery engine — real completed
  // workouts and the chosen frequency — never from the weekday.
  const isRecoveryDay   = recovery?.status === DAY_STATUS.RECOVERY
  const isTodayTraining = !isRecoveryDay
  // A deload never turns a training day into a rest day (it lightens the
  // load, nothing else), so this rides alongside the day status rather
  // than replacing it.
  const onDeload = !!deload?.active

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


  const schedule = plan?.weeklySchedule
  const currentPlanDay = schedule?.length
    ? schedule[(planIndex ?? 0) % schedule.length]
    : null
  const planDayNum   = schedule?.length ? ((planIndex ?? 0) % schedule.length) + 1 : 1
  const planTotal    = schedule?.length ?? 1

  return (
    <div style={{ paddingBottom: 110 }}>

      {/* ── Logo Banner ──────────────────────────────────────────── */}
      <div style={{
        marginTop: 14, marginBottom: 'var(--hp-card-mb)',
        height: 64, borderRadius: 22,
        position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, rgba(8,11,20,0.96), rgba(15,32,38,0.82))',
        border: '1px solid rgba(var(--cyan-rgb),0.34)',
        boxShadow: '0 0 0 1px rgba(var(--cyan-rgb),0.08), 0 12px 32px rgba(0,0,0,0.28)',
      }}>
        {/* centre glow */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%,-50%)',
          width: 180, height: 64, borderRadius: 999,
          background: 'radial-gradient(circle, rgba(var(--cyan-rgb),0.18) 0%, rgba(var(--cyan-rgb),0.07) 40%, rgba(var(--cyan-rgb),0) 74%)',
          filter: 'blur(12px)', opacity: 0.85, pointerEvents: 'none',
        }} />
        {/* diagonal speed lines */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 22,
          pointerEvents: 'none', opacity: 0.35,
          background: 'linear-gradient(115deg, transparent 0%, rgba(var(--cyan-rgb),0.10) 16%, transparent 28%, transparent 62%, rgba(var(--cyan-rgb),0.09) 78%, transparent 100%)',
        }} />
        <div style={{
          position: 'absolute', insetInlineStart: 18, top: 20,
          width: 130, height: 1,
          background: 'linear-gradient(90deg, rgba(var(--cyan-rgb),0), rgba(var(--cyan-rgb),0.34), rgba(var(--cyan-rgb),0))',
          transform: 'rotate(-12deg)', opacity: 0.45, pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', insetInlineEnd: 18, bottom: 18,
          width: 130, height: 1,
          background: 'linear-gradient(90deg, rgba(var(--cyan-rgb),0), rgba(var(--cyan-rgb),0.28), rgba(var(--cyan-rgb),0))',
          transform: 'rotate(-12deg)', opacity: 0.38, pointerEvents: 'none',
        }} />
        {/* logo */}
        <img
          src="/assets/app_logo_full_light.png"
          alt="MERAN"
          style={{
            position: 'relative', zIndex: 2,
            width: 96, maxWidth: '32vw', height: 'auto',
            objectFit: 'contain', display: 'block',
            opacity: 0.94,
            filter: 'drop-shadow(0 0 10px rgba(var(--cyan-rgb),0.22))',
          }}
        />
      </div>

      {/* ── Month report ─────────────────────────────────────
          A slim strip, not a hero-sized card — a smaller footprint
          reads clearer here than a bigger one would, because contrast
          against the surrounding cards is what draws the eye, not
          size. Only in its window, and only for a month with training
          in it — an empty report is worse than no button. */}
      {monthReport?.hasData && (
        <button
          onClick={onShowMonthReport}
          style={{
            all: 'unset', boxSizing: 'border-box',
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%', marginBottom: 10, padding: '10px 14px',
            borderRadius: 14, cursor: 'pointer',
            background: 'linear-gradient(100deg, var(--cyan-lo), var(--gold-lo))',
            border: '1px solid var(--cyan-md)',
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>📊</span>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'start' }}>
            <div style={{ fontWeight: 800, fontSize: 13 }}>تقرير {monthReport.monthLabel}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
              {monthReport.sessionCount} جلسة · {Number(monthReport.volume.total).toLocaleString('en-US')} كجم
              {monthReport.prs.length ? ` · ${monthReport.prs.length} رقم قياسي` : ''}
            </div>
          </div>
          <span style={{ color: 'var(--cyan)', fontSize: 17 }}>‹</span>
        </button>
      )}
      {/* ── Today Hero ────────────────────────────────────────
          One card, one question: what should I do now? It absorbs the
          old today card, the plan-day card, the recovery-day card and
          the bottom CTA — and carries the deload as a state line. */}
      <TodayHero
        active={active}
        currentPlanDay={currentPlanDay}
        planDayNum={planDayNum}
        planTotal={planTotal}
        isRecoveryDay={isRecoveryDay}
        deload={deload}
        restCredits={restCredits}
        sessions={sessions}
        exerciseMapping={exerciseMapping}
        exerciseSubs={exerciseSubs}
        onCycleSub={onCycleSub}
        onStartPlanned={onStartPlannedWorkout}
        onStartEmpty={onStartWorkout}
        onSkip={onSkipPlanDay}
        onGoToWorkout={onGoToWorkout}
        onOverrideRecovery={onOverrideRecovery}
      />

      {/* ── Deload suggestion (unchanged) ─────────────────────── */}
      <DeloadSuggestion
        reason={deloadSuggestion}
        onAccept={onStartDeload}
        onDismiss={onDismissDeloadSuggestion}
      />

      {/* ── Gamification, compressed to one line ──────────────
          Streak, rank, level and XP all survive — they just stop
          competing with today's workout for the top of the screen. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', padding: '10px 14px',
        marginBottom: 'var(--hp-card-mb)', flexWrap: 'wrap',
      }}>
        {streak > 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800, color: 'var(--orange)' }}>
            🔥 {streak}
          </span>
        )}
        <CommitmentFlames streak={streak} deload={onDeload} />
        <span style={{
          background: rank.bg, color: rank.color,
          border: `1px solid ${rank.color}40`,
          borderRadius: 20, padding: '1px 9px',
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
        }}>{rank.tier} · {rank.label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gold)', fontWeight: 700 }}>
          Lv{level}
        </span>
        <div style={{ flex: 1, minWidth: 60 }}>
          <ProgressBar value={currentXP} max={neededXP} color="var(--gold)" height={5} />
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)' }}>{pct}%</span>
      </div>

      {/* ── Plan progress (slimmed, same numbers) ─────────────── */}
      {plan && !active && (
        <PlanProgressCard plan={plan} planIndex={planIndex ?? 0} />
      )}

      {/* ── Recovery: one insight, details on demand ──────────
          The full cycle card — bubbles, credits, both streaks — is
          intact below; it just waits behind a fold instead of
          occupying half the page. */}
      <details style={{ marginBottom: 'var(--hp-card-mb)' }}>
        <summary style={{
          listStyle: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', padding: '12px 14px',
        }}>
          <span style={{ fontSize: 16 }}>{isRecoveryDay ? '🌙' : '♻️'}</span>
          <span style={{ flex: 1, fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
            {isRecoveryDay
              ? 'اكتملت الدورة — اليوم للتعافي'
              : (recovery?.cycleLimit || 0) - (recovery?.workoutStreak || 0) === 1
                ? 'باقي تمرين واحد على يوم الراحة'
                : `التعافي على المسار · ${recovery?.workoutStreak || 0} من ${recovery?.cycleLimit || 0} في الدورة`}
          </span>
          <span style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--cyan)', fontWeight: 700 }}>
            التفاصيل
          </span>
        </summary>
        <div style={{ marginTop: 8 }}>

      {/* ── Recovery cycle + streaks ──────────────────────────── */}
      <Card style={{ padding: 'var(--hp-card-pad)', marginBottom: 'var(--hp-card-mb)' }}>
        <SectionTitle>دورة التعافي</SectionTitle>

        {/* Where you are in the current cycle */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {Array.from({ length: recovery?.cycleLimit || 0 }).map((_, i) => {
            const filled = i < (recovery?.workoutStreak || 0)
            return (
              <div key={i} style={{
                width: 38, height: 38, borderRadius: '50%',
                background: filled ? 'var(--cyan-lo)' : 'var(--bg3)',
                border: `2px solid ${filled ? 'var(--cyan)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: filled ? '0 0 10px var(--cyan-glow)' : 'none',
                transition: 'all 0.2s',
              }}>
                <DumbbellIcon size={16} color={filled ? 'var(--cyan)' : 'var(--text3)'} />
              </div>
            )
          })}
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: isRecoveryDay ? 'var(--purple-lo)' : 'var(--bg3)',
            border: `2px solid ${isRecoveryDay ? 'var(--purple)' : 'var(--border)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
            boxShadow: isRecoveryDay ? '0 0 10px var(--purple-md)' : 'none',
            animation: isRecoveryDay ? 'glowPulse 2.5s ease-in-out infinite' : 'none',
          }}>🌙</div>
        </div>

        <div style={{ fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)', lineHeight: 1.7, marginBottom: 12 }}>
          {isRecoveryDay
            ? 'اكتملت الدورة — اليوم راحة، وغداً تبدأ دورة جديدة.'
            : `${recovery?.cycleLimit || 0} تمارين ثم يوم راحة · أنجزت ${recovery?.workoutStreak || 0}`}
        </div>

        {/* Earned optional rest days.
            The bar tracks progress to the NEXT reward, which is not the
            same thing as the streak beside it: an optional rest day
            holds the streak but is frozen out of this count. Keeping
            them in separate blocks stops one being read as the other. */}
        <div style={{
          background: restCredits > 0 ? 'var(--gold-lo)' : 'var(--bg3)',
          border: `1px solid ${restCredits > 0 ? 'var(--gold-md)' : 'var(--border)'}`,
          borderRadius: 12, padding: '12px 14px', marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 18 }}>🎟️</span>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: 'var(--font-ar)', fontSize: 14, fontWeight: 700,
                color: restCredits > 0 ? 'var(--gold)' : 'var(--text3)',
              }}>
                {restCredits === 0 ? 'لا يوجد رصيد راحة'
                  : restCredits === 1 ? 'يوم راحة اختياري واحد'
                  : restCredits === 2 ? 'يوما راحة اختيارية'
                  : `${restCredits} أيام راحة اختيارية`}
              </div>
              <div style={{ fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                {restCredits > 0
                  ? 'يُصرف تلقائياً لو غبت، فيجمّد ستريكك بلا زيادة ولا كسر'
                  : 'بلا رصيد، الغياب يكسر الستريك'}
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            marginBottom: 5,
          }}>
            <span style={{ fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--text3)' }}>
              {atMaxCredits
                ? 'رصيدك ممتلئ'
                : daysToNextCredit === 1
                  ? 'باقي لك يوم واحد للحصول على يوم راحة اختياري'
                  : daysToNextCredit === 2
                    ? 'باقي لك يومان للحصول على يوم راحة اختياري'
                    : `باقي لك ${daysToNextCredit} أيام للحصول على يوم راحة اختياري`}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gold)', fontWeight: 700 }}>
              {atMaxCredits ? `${creditTarget}/${creditTarget}` : `${creditProgress}/${creditTarget}`}
            </span>
          </div>
          <ProgressBar
            value={atMaxCredits ? creditTarget : creditProgress}
            max={creditTarget}
            color="var(--gold)"
            height={7}
          />
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 10, color: 'var(--text3)', marginTop: 6, opacity: 0.8 }}>
            يُحسب هنا كل يوم تمرين أنجزته أو راحة مجدولة من خطتك — يوم الراحة
            الاختياري يحمي ستريكك لكنه لا يُحتسب في هذا العدّاد
          </div>
        </div>

        {/* The two distinct streaks */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{
            flex: 1, background: 'var(--bg2)', border: '1px solid var(--border)',
            borderTop: '3px solid var(--cyan)', borderRadius: 12, padding: '12px 10px', textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: 'var(--cyan)' }}>
              {recovery?.workoutStreak || 0}
            </div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
              تمارين متتالية
            </div>
          </div>
          <div style={{
            flex: 1, background: 'var(--bg2)', border: '1px solid var(--border)',
            borderTop: '3px solid var(--gold)', borderRadius: 12, padding: '12px 10px', textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: 'var(--gold)' }}>
              {recovery?.consistencyStreak || 0}
            </div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
              أيام التزام
            </div>
          </div>
        </div>
      </Card>
        </div>
      </details>

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
                  <span style={{ fontFamily: 'var(--font-ar)', fontSize: 16, fontWeight: 700 }}>
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
    </div>
  )
}
