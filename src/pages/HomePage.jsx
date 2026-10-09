import { Card, SectionTitle, ProgressBar } from '../components/ui.jsx'
import { DumbbellIcon } from '../components/Icons.jsx'
import { DeloadSuggestion } from '../components/DeloadBanner.jsx'
import TodayHero from '../components/TodayHero.jsx'
import Scoreboard from '../components/streak/Scoreboard.jsx'
import { xpProgress, getRank, planDayType } from '../utils.js'
import { MUSCLE_GROUPS } from '../constants.js'
import { DAY_STATUS } from '../recovery.js'
import { countAr, todayStreak, fmtDayAr } from '../streak.js'
import { IconButton } from '../components/kit/index.jsx'
import { GearSix } from '../components/kit/icons.js'
import { todayKey } from '../day.js'

function PlanProgressCard({ plan, planIndex }) {
  const schedule      = plan.weeklySchedule
  const durationWeeks = plan.durationWeeks || 6
  const totalSessions = durationWeeks * schedule.length
  const dayInCycle    = planIndex % schedule.length        // 0-based current day in weekly cycle
  const currentWeek   = Math.min(Math.floor(planIndex / schedule.length) + 1, durationWeeks)
  const overallPct    = Math.min(100, Math.round((planIndex / totalSessions) * 100))
  const isCompleted   = planIndex >= totalSessions


  return (
    <Card style={{ padding: '16px', marginBottom: 'var(--hp-card-mb)' }}>
      {/* Header: title + plan name, week/complete chip at the end */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
            تقدم البرنامج
          </div>
          <div style={{
            fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text3)', marginTop: 3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {plan.planName}
          </div>
        </div>
        <span style={{
          flexShrink: 0,
          background: isCompleted ? 'var(--gold-lo)' : 'var(--cyan-lo)',
          border: `1px solid ${isCompleted ? 'var(--gold-md)' : 'var(--cyan-md)'}`,
          borderRadius: 999, padding: '4px 12px',
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
          color: isCompleted ? 'var(--gold)' : 'var(--cyan)', whiteSpace: 'nowrap',
        }}>
          {isCompleted ? '🏆 مكتمل' : `W${currentWeek}/${durationWeeks}`}
        </span>
      </div>

      <ProgressBar value={planIndex} max={totalSessions} color="var(--cyan)" height={6} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6, marginBottom: 12 }}>
        <span style={{ fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--text3)' }}>
          {Math.min(planIndex, totalSessions)} من {totalSessions} جلسة
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>
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
                width: '100%', height: 26, borderRadius: 8,
                background: isDone ? 'var(--cyan)' : isCurrent ? 'var(--cyan-lo)' : 'var(--bg3)',
                border: isCurrent ? '2px solid var(--cyan)' : `1px solid ${isDone ? 'var(--cyan)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isDone ? '#0A0E14' : isCurrent ? 'var(--cyan)' : 'var(--text3)',
                fontSize: 12, fontWeight: 800,
                transition: 'all 0.2s',
              }}>
                {isDone ? '✓' : isCurrent ? '▶' : String(i + 1)}
              </div>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9,
                color: isDone ? 'var(--cyan)' : isCurrent ? 'var(--text)' : 'var(--text3)',
                fontWeight: isCurrent ? 700 : 400,
              }}>{planDayType(day)}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ── Helper: find videoUrl for an exercise name across all muscle groups ──



export default function HomePage({ sessions, xp, streak, profile, onStartWorkout, onStartPlannedWorkout, onSkipPlanDay, onGoToWorkout, active, plan, planIndex, exerciseMapping = {}, exerciseSubs = {}, onCycleSub, recovery, recoveryConfig = {}, streakToday = null, onOverrideRecovery, onScoreboardVisible, tickets = 0, creditProgress = 0, creditTarget = 5, daysToNextCredit = 5, monthReport = null, onShowMonthReport, deload = null, deloadSuggestion = null,
  onStartDeload, onDismissDeloadSuggestion, onOpenDeload, greeting = '', onOpenProfile, onOpenSettings }) {
  const { level, currentXP, neededXP, pct } = xpProgress(xp)
  const rank        = getRank(level)
  // Training vs recovery comes from the recovery engine — real completed
  // workouts and the chosen frequency — never from the weekday.
  const isRecoveryDay   = recovery?.status === DAY_STATUS.RECOVERY
  const isTodayTraining = !isRecoveryDay

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

  // The top of Home: today's date (and the plan week), the greeting
  // — on Home only now, and two lines at most — the avatar for the
  // profile and the gear for settings.
  const planWeek = schedule?.length && plan
    ? ` · الأسبوع ${Math.min(Math.floor((planIndex ?? 0) / schedule.length) + 1, plan.durationWeeks || 6)} من ${plan.durationWeeks || 6}`
    : ''
  const initial = (profile?.name || 'م').trim().charAt(0)
  const unnamed = !profile?.name || profile.name === 'البطل'

  return (
    <div>
      <div className="h-top">
        <div className="h-top-text">
          <span className="k-eyebrow">{fmtDayAr(streakToday || todayKey())}{planWeek}</span>
          <p className="h-greet">{greeting}</p>
          {unnamed && (
            <button type="button" className="h-name-hint" onClick={onOpenSettings}>أضف اسمك</button>
          )}
        </div>
        <div className="h-top-actions">
          <button type="button" className="h-avatar" onClick={onOpenProfile} aria-label="الملف الشخصي">{initial}</button>
          <IconButton icon={GearSix} label="الإعدادات" onClick={onOpenSettings} />
        </div>
      </div>

      {/* ── The streak, first ──────────────────────────────────
          The number, what today does to it, until when, at what cost,
          and the last seven days. Everything the old header pill, the
          five flames and the folded warning used to say in pieces. */}
      <Scoreboard
        recovery={recovery}
        config={recoveryConfig}
        active={active}
        deload={deload}
        today={streakToday}
        onVisibleChange={onScoreboardVisible}
      />

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
        completedToday={recovery?.status === DAY_STATUS.COMPLETED}
        streakKind={todayStreak(recovery, { config: recoveryConfig, active, today: streakToday || todayKey() })}
        deload={deload}
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

      {/* ── Rank and XP, one quiet strip ──────────────────────
          The streak moved up to its own card, so it is not repeated
          here: one number, in one place, under one name. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9,
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', padding: '10px 14px',
        marginBottom: 'var(--hp-card-mb)',
      }}>
        <span style={{
          flexShrink: 0, border: `1px solid ${rank.color}40`, color: rank.color,
          borderRadius: 999, padding: '2px 10px',
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
        }}>{rank.tier} · {rank.label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cyan)', fontWeight: 700, whiteSpace: 'nowrap' }}>
          Lv {level}
        </span>
        <div style={{ flex: 1, minWidth: 36 }}>
          <ProgressBar value={currentXP} max={neededXP} color="var(--cyan)" height={5} />
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)' }}>{pct}%</span>
      </div>

      {/* ── Month report ─────────────────────────────────────
          A slim strip below the fold-line of the hero — only in its
          window, and only for a month with training in it. */}
      {monthReport?.hasData && (
        <button
          onClick={onShowMonthReport}
          style={{
            all: 'unset', boxSizing: 'border-box',
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%', marginBottom: 'var(--hp-card-mb)', padding: '10px 14px',
            borderRadius: 14, cursor: 'pointer',
            background: 'var(--bg2)',
            border: '1px solid var(--border2)',
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
          <span style={{
            flex: 1, fontFamily: 'var(--font-ar)', fontSize: 13, lineHeight: 1.6, color: 'var(--text2)',
          }}>
            {isRecoveryDay
              ? 'اكتملت الدورة — اليوم للراحة'
              : (recovery?.cycleLimit || 0) - (recovery?.workoutStreak || 0) === 1
                ? 'باقي تمرين واحد على يوم الراحة'
                : `دورة التعافي · ${recovery?.workoutStreak || 0} من ${recovery?.cycleLimit || 0}`}
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
            : `${countAr(recovery?.cycleLimit || 0, 'workout')} ثم يوم راحة · أنجزت ${recovery?.workoutStreak || 0}`}
        </div>

        {/* Rest tickets. The bar tracks progress to the NEXT ticket,
            which is not the streak: a day a ticket covered holds the
            streak but is frozen out of this count. The balance is the
            real one the engine spends from — it used to stop at 5. */}
        <div style={{
          background: tickets > 0 ? 'rgba(var(--purple-rgb),0.08)' : 'var(--bg3)',
          border: `1px solid ${tickets > 0 ? 'var(--purple-md)' : 'var(--border)'}`,
          borderRadius: 12, padding: '12px 14px',
        }}>
          <div style={{
            fontFamily: 'var(--font-ar)', fontSize: 14, fontWeight: 700,
            color: tickets > 0 ? 'var(--rest)' : 'var(--text3)',
          }}>
            {tickets > 0 ? `عندك ${countAr(tickets, 'ticket')}` : 'ما عندك تذاكر'}
          </div>
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text2)', marginTop: 2, marginBottom: 10, lineHeight: 1.7 }}>
            {tickets > 0
              ? 'تنصرف لحالها الساعة 3 الفجر لو فاتك يوم تمرين، والستريك يوقف: ما يزيد ولا ينكسر'
              : 'بدون تذاكر، يوم التمرين اللي يفوتك يكسر الستريك'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
            <span style={{ fontFamily: 'var(--font-ar)', fontSize: 12, color: 'var(--text2)' }}>
              باقي {countAr(daysToNextCredit, 'day')} للتذكرة الجاية
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--rest)', fontWeight: 700 }}>
              {creditProgress}/{creditTarget}
            </span>
          </div>
          <ProgressBar value={creditProgress} max={creditTarget} color="var(--rest)" height={7} />
          <div style={{ fontFamily: 'var(--font-ar)', fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
            كل يوم تمرّنت فيه أو راحة مجدولة يقرّبك منها — اليوم اللي تغطّيه تذكرة ما ينعدّ
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
