import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Card, SectionTitle, ProgressBar } from '../components/ui.jsx'
import { DumbbellIcon, FlameIcon, DropletIcon } from '../components/Icons.jsx'
import { DeloadBanner, DeloadSuggestion } from '../components/DeloadBanner.jsx'
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
function findVideoUrl(name) {
  for (const group of Object.values(MUSCLE_GROUPS)) {
    const ex = group.exercises?.find(e => e.name === name)
    if (ex?.videoUrl) return ex.videoUrl
  }
  return null
}

// ── Day Preview bottom sheet ──────────────────────────────────────────
function DayPreviewSheet({ day, sessions, exerciseMapping, exerciseSubs = {}, onCycleSub, onStart, onSkip, onClose }) {
  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 750,
        background: 'rgba(0,0,0,0.68)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 560,
          background: 'var(--bg2)',
          borderRadius: '24px 24px 0 0',
          border: '1px solid var(--border2)',
          borderBottom: 'none',
          maxHeight: '88dvh',
          display: 'flex', flexDirection: 'column',
          animation: 'slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1)',
          boxShadow: '0 -8px 48px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '12px auto 0', flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: '14px 20px 12px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cyan)', letterSpacing: 2, marginBottom: 3 }}>
            تمارين اليوم
          </div>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 19, fontWeight: 800, color: 'var(--text)' }}>
            {day.name}
          </div>
        </div>

        {/* Exercise list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {day.exercises.map((ex, i) => {
            const muscle   = MUSCLE_GROUPS[ex.muscle]
            const shownName = substitutedName(ex.name, exerciseSubs, EXERCISE_ALTERNATIVES)
            const swapped   = shownName !== ex.name
            const alts      = EXERCISE_ALTERNATIVES[ex.name] || []
            const subIdx    = exerciseSubs[ex.name] || 0
            const videoUrl = findVideoUrl(shownName)
            const { lastWeight, maxWeight } = getExerciseStats(sessions, shownName, exerciseMapping)
            const color = muscle?.color || '#5EC32A'
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 20px',
                borderBottom: i < day.exercises.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                {/* Muscle emoji box */}
                <div style={{
                  width: 44, height: 44, flexShrink: 0, borderRadius: 12,
                  background: color + '1A',
                  border: `1px solid ${color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22,
                }}>{muscle?.emoji || '💪'}</div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                    color: swapped ? 'var(--gold)' : 'var(--text)', marginBottom: 4,
                    lineHeight: 1.35, overflowWrap: 'anywhere',
                  }}>{swapped && '⇄ '}{shownName}</div>

                  {swapped && (
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)',
                      marginBottom: 4, lineHeight: 1.35, overflowWrap: 'anywhere',
                    }}>بدلاً من {ex.name}</div>
                  )}

                  <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Muscle label tag */}
                    <span style={{
                      background: color + '1A', border: `1px solid ${color}40`,
                      borderRadius: 20, padding: '2px 10px',
                      fontFamily: 'var(--font-ar)', fontSize: 13, color, fontWeight: 700,
                    }}>{muscle?.label || ex.muscle}</span>

                    {/* Sets */}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)' }}>
                      ×{ex.sets || 3} سيت
                    </span>

                    {/* Weight history */}
                    {lastWeight != null && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)' }}>
                        آخر <span style={{ color: 'var(--text2)' }}>{lastWeight}kg</span>
                        {maxWeight != null && maxWeight !== lastWeight && (
                          <> · <span style={{ color: 'var(--gold)' }}>🏆{maxWeight}kg</span></>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Swap exercise (machine unavailable) */}
                {alts.length > 0 && (
                  <button
                    onClick={() => onCycleSub?.(ex.name, nextSubIndex(ex.name, exerciseSubs, EXERCISE_ALTERNATIVES))}
                    title={subIdx < alts.length ? `التالي: ${alts[subIdx]}` : 'رجوع للتمرين الأصلي'}
                    style={{
                      flexShrink: 0, height: 36, borderRadius: 10, padding: '0 10px',
                      background: swapped ? 'var(--gold-lo)' : 'var(--bg3)',
                      border: `1px solid ${swapped ? 'var(--gold-md)' : 'var(--border2)'}`,
                      color: swapped ? 'var(--gold)' : 'var(--text3)',
                      display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                      fontFamily: 'var(--font-ar)', fontSize: 12, fontWeight: 700,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>⇄</span>
                    {swapped ? `${subIdx}/${alts.length}` : 'استبدال'}
                  </button>
                )}

                {/* YouTube button */}
                {videoUrl && (
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flexShrink: 0, width: 36, height: 36, borderRadius: 10,
                      background: 'rgba(255,0,0,0.12)', border: '1px solid rgba(255,0,0,0.28)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      textDecoration: 'none', fontSize: 16,
                    }}
                  >▶️</a>
                )}
              </div>
            )
          })}
        </div>

        {/* CTA */}
        <div style={{ padding: '12px 20px calc(var(--safe-bottom) + 12px)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onStart} style={{
              flex: 1, padding: '14px',
              background: 'var(--grad-primary)', border: 'none', borderRadius: 14,
              color: 'white', fontFamily: 'var(--font-ar)', fontWeight: 800, fontSize: 16,
              cursor: 'pointer', boxShadow: '0 4px 16px rgba(var(--cyan-rgb),0.35)',
            }}>⚡ ابدأ التمرين</button>
            <button onClick={onSkip} style={{
              padding: '14px 16px',
              background: 'var(--bg3)', border: '1px solid var(--border2)',
              borderRadius: 14, color: 'var(--text3)',
              fontFamily: 'var(--font-ar)', fontSize: 14, cursor: 'pointer',
            }}>⏭️ تخطي</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Plan Day Card ─────────────────────────────────────────────────────
function PlanDayCard({ day, dayNum, totalDays, onStart, onSkip, sessions = [], exerciseMapping = {}, exerciseSubs = {}, onCycleSub }) {
  const [showSheet, setShowSheet] = useState(false)

  return (
    <>
      <Card style={{ padding: 'var(--hp-card-pad)', marginBottom: 'var(--hp-card-mb)', borderTop: '3px solid var(--cyan)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cyan)', letterSpacing: 2, marginBottom: 3 }}>
              PLAN · {dayNum}/{totalDays}
            </div>
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 16, fontWeight: 800 }}>{day.name}</div>
          </div>
          {/* Tappable exercises badge → opens sheet */}
          <button
            onClick={() => setShowSheet(true)}
            style={{
              background: 'var(--cyan-lo)', border: '1px solid var(--cyan-md)',
              borderRadius: 20, padding: '3px 10px',
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cyan)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            {day.exercises.length} تمارين
            <span style={{ fontSize: 9, opacity: 0.8 }}>←</span>
          </button>
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

        {/* Chips — tappable to open sheet */}
        <div
          onClick={() => setShowSheet(true)}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12, cursor: 'pointer' }}
        >
          {day.exercises.map((ex, i) => {
            const shown = substitutedName(ex.name, exerciseSubs, EXERCISE_ALTERNATIVES)
            const swapped = shown !== ex.name
            return (
              <span key={i} style={{
                background: swapped ? 'var(--gold-lo)' : 'var(--bg3)',
                border: `1px solid ${swapped ? 'var(--gold-md)' : 'var(--border)'}`,
                borderRadius: 20, padding: '3px 10px',
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: swapped ? 'var(--gold)' : 'var(--text2)',
              }}>{swapped ? '⇄ ' : ''}{shown}{ex.sets ? ` ×${ex.sets}` : ''}</span>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onStart} style={{
            flex: 1, padding: '11px',
            background: 'var(--grad-primary)', border: 'none', borderRadius: 12,
            color: 'white', fontFamily: 'var(--font-ar)', fontWeight: 800, fontSize: 15,
            cursor: 'pointer', boxShadow: '0 4px 16px rgba(var(--cyan-rgb),0.35)',
          }}>⚡ ابدأ</button>
          <button onClick={onSkip} style={{
            padding: '11px 14px',
            background: 'var(--bg2)', border: '1px solid var(--border2)',
            borderRadius: 12, color: 'var(--text3)',
            fontFamily: 'var(--font-ar)', fontSize: 14, cursor: 'pointer',
          }}>⏭️ تخطي</button>
        </div>
      </Card>

      {showSheet && (
        <DayPreviewSheet
          day={day}
          sessions={sessions}
          exerciseMapping={exerciseMapping}
          exerciseSubs={exerciseSubs}
          onCycleSub={onCycleSub}
          onStart={() => { setShowSheet(false); onStart() }}
          onSkip={() => { setShowSheet(false); onSkip() }}
          onClose={() => setShowSheet(false)}
        />
      )}
    </>
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

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'صباح الخير' : hour < 17 ? 'مساء الخير' : 'مساء النور'

  const schedule = plan?.weeklySchedule
  const currentPlanDay = schedule?.length
    ? schedule[(planIndex ?? 0) % schedule.length]
    : null
  const planDayNum   = schedule?.length ? ((planIndex ?? 0) % schedule.length) + 1 : 1
  const planTotal    = schedule?.length ?? 1

  return (
    <div style={{ paddingBottom: 200 }}>

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

      {/* ── Player Hero Card ─────────────────────────────────────
          Horizontal layout: text RIGHT (RTL-first) · icon LEFT   */}
      <div style={{
        position: 'relative',
        background: 'var(--grad-hero)',
        border: '1px solid rgba(var(--cyan-rgb),0.12)',
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
          background: 'radial-gradient(circle, rgba(var(--purple-rgb),0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* ── Inner row: text (right) + icon (left) ── */}
        <div className="hp-row" style={{ position: 'relative', zIndex: 1 }}>

          {/* TEXT SIDE — appears on RIGHT in RTL (first child) */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="hp-meta" style={{ fontFamily: 'var(--font-ar)', marginBottom: 2 }}>{greeting}</div>
            <div className="hp-title" style={{ fontFamily: 'var(--font-ar)', marginBottom: 6 }}>
              {profile?.name || 'البطل'}
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
              <CommitmentFlames streak={streak} deload={onDeload} />
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

      {/* ── Deload ────────────────────────────────────────────
          The counter while one runs; the app's own suggestion when one
          is due. Never both — suggestDeload returns null the moment a
          deload exists. Above the today card because it changes how the
          card should be read. */}
      <DeloadBanner state={deload} onOpen={onOpenDeload} />
      <DeloadSuggestion
        reason={deloadSuggestion}
        onAccept={onStartDeload}
        onDismiss={onDismissDeloadSuggestion}
      />

      {/* ── Today Card ────────────────────────────────────────────
          Horizontal: title/desc RIGHT · illustration LEFT         */}
      <Card style={{
        padding: 0,
        marginBottom: 'var(--hp-card-mb)',
        borderTop: `3px solid ${isTodayTraining ? 'var(--cyan)' : 'var(--purple)'}`,
        background: isTodayTraining
          ? 'linear-gradient(135deg, rgba(var(--cyan-rgb),0.07) 0%, rgba(var(--purple-rgb),0.04) 100%)'
          : 'linear-gradient(135deg, rgba(var(--purple-rgb),0.05) 0%, rgba(var(--cyan-rgb),0.03) 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative circle */}
        <div style={{
          position: 'absolute', left: -16, bottom: -16,
          width: 80, height: 80, borderRadius: '50%',
          background: isTodayTraining ? 'rgba(var(--cyan-rgb),0.08)' : 'rgba(var(--purple-rgb),0.06)',
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
              {/* The wording follows the mode. A deload week is still a
                  training week, so the line never becomes a rest line —
                  it just stops pushing. */}
              {recovery?.status === DAY_STATUS.COMPLETED ? 'تمرين مكتمل ✓'
                : isRecoveryDay ? 'اليوم يوم تعافٍ'
                : onDeload ? 'اليوم تمرين خفيف'
                : 'اليوم يوم تمرين 💪'}
            </div>
            <div className="hp-sub" style={{ fontFamily: 'var(--font-ar)' }}>
              {recovery?.status === DAY_STATUS.COMPLETED
                ? (onDeload ? 'أنهيت تمرين اليوم بأوزان الديلود — تمام.' : 'أنهيت تمرين اليوم — أحسنت!')
                : isRecoveryDay
                ? `أكملت ${recovery.workoutStreak} تمارين متتالية. خذ اليوم للراحة، وغداً تكمل خطتك.`
                : onDeload
                ? `نفس تمرين خطتك، بأوزان أخف بـ${deload.pct}٪. الحركة تكمل والحمل ينزل.`
                : 'التمرين التالي في خطتك جاهز — حان الوقت!'}
            </div>
          </div>

          {/* ILLUSTRATION (left in RTL) */}
          <div className="hp-icon" style={{ background: 'transparent', border: 'none', borderRadius: 0 }}>
            <HeroIllustration isTraining={isTodayTraining} />
          </div>
        </div>
      </Card>

      {/* ── Plan Progress Card ───────────────────────────────── */}
      {plan && !active && (
        <PlanProgressCard plan={plan} planIndex={planIndex ?? 0} />
      )}

      {/* ── Recovery day: next workout shown inactive ─────────── */}
      {isRecoveryDay && !active && (
        <Card style={{ padding: 'var(--hp-card-pad)', marginBottom: 'var(--hp-card-mb)', borderTop: '3px solid var(--purple)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--purple)', letterSpacing: 2, marginBottom: 6 }}>
            التمرين القادم بعد التعافي
          </div>
          {currentPlanDay ? (
            <>
              <div style={{ fontFamily: 'var(--font-ar)', fontSize: 16, fontWeight: 800, color: 'var(--text3)', marginBottom: 8 }}>
                {currentPlanDay.name}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12, opacity: 0.45 }}>
                {currentPlanDay.exercises.map((ex, i) => (
                  <span key={i} style={{
                    background: 'var(--bg3)', border: '1px solid var(--border)',
                    borderRadius: 20, padding: '3px 10px',
                    fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)',
                  }}>{substitutedName(ex.name, exerciseSubs, EXERCISE_ALTERNATIVES)}</span>
                ))}
              </div>
            </>
          ) : (
            <div style={{ fontFamily: 'var(--font-ar)', fontSize: 14, color: 'var(--text3)', marginBottom: 12 }}>
              تمرينك القادم محفوظ — يبدأ غداً من حيث توقفت.
            </div>
          )}
          <div style={{
            background: 'var(--purple-lo)', border: '1px solid var(--purple-md)',
            borderRadius: 12, padding: '10px 14px', marginBottom: 12,
            fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text2)', lineHeight: 1.7,
          }}>
            🌙 لن يُحتسب هذا اليوم تمريناً فائتاً، ولن يكسر ستريك الالتزام.
          </div>
          <button
            onClick={onOverrideRecovery}
            style={{
              width: '100%', padding: '11px',
              background: 'var(--bg3)', border: '1px dashed var(--border2)',
              borderRadius: 12, color: 'var(--text2)',
              fontFamily: 'var(--font-ar)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >أشعر أنني قادر على التمرين</button>
        </Card>
      )}

      {/* ── Plan Day Card ─────────────────────────────────────── */}
      {currentPlanDay && !active && !isRecoveryDay && (
        <PlanDayCard
          day={currentPlanDay}
          dayNum={planDayNum}
          totalDays={planTotal}
          onStart={() => onStartPlannedWorkout(currentPlanDay)}
          onSkip={onSkipPlanDay}
          sessions={sessions}
          exerciseMapping={exerciseMapping}
          exerciseSubs={exerciseSubs}
          onCycleSub={onCycleSub}
        />
      )}

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

      {/* ── Fixed Bottom CTA ─────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 0,
        left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 560,
        padding: '12px 16px calc(var(--safe-bottom) + 90px)',
        background: 'linear-gradient(transparent, var(--bg) 40%)',
        pointerEvents: 'none',
      }}>
        <div style={{ pointerEvents: 'all' }}>
          {active ? (
            <button className="btn-cyan btn-active-glow" onClick={onGoToWorkout}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'currentColor', animation: 'pulseDot 1.5s ease-in-out infinite' }} />
              متابعة الجلسة
            </button>
          ) : isRecoveryDay ? (
            // A recovery day must not push a start-workout CTA; training
            // today is available deliberately via the override above.
            <div style={{
              textAlign: 'center', padding: '12px',
              fontFamily: 'var(--font-ar)', fontSize: 13, color: 'var(--text3)',
            }}>🌙 اليوم للتعافي — غداً تكمل خطتك</div>
          ) : currentPlanDay ? (
            <button className="btn-cyan" onClick={() => onStartPlannedWorkout(currentPlanDay)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, paddingTop: 10, paddingBottom: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>⚡ ابدأ تمرين اليوم</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.8, fontWeight: 400 }}>
                {currentPlanDay.name}
              </span>
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
