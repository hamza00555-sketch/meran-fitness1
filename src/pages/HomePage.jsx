import '../styles/screens/home.css'
import { DeloadSuggestion } from '../components/DeloadBanner.jsx'
import TodayHero from '../components/TodayHero.jsx'
import StreakNumber from '../components/streak/StreakNumber.jsx'
import { IconButton, ListGroup, ListRow, Gauge, Num } from '../components/kit/index.jsx'
import { GearSix, ChartBar, CalendarBlank, Moon, Plus } from '../components/kit/icons.js'
import { MUSCLE_GROUPS } from '../constants.js'
import { DAY_STATUS } from '../recovery.js'
import { countAr, todayStreak, fmtDayAr } from '../streak.js'
import { todayKey } from '../day.js'
import { DEFAULT_REP_TARGET } from '../progression.js'
import { withNums } from '../components/home/HomeBits.jsx'
import { setsUnit } from '../components/home/dayParts.js'

// ── Home — «تحت الأضواء» ──────────────────────────────────────
//
//   the top           the streak number · date · greeting · profile · settings
//   Today             the one lit stage, three exercises, one green button
//   a notice          the deload suggestion, when the engine raises one
//   quiet lists       month report · plan progress · rest cycle · muscles
//
// The streak is its number and nothing else (حمزة: «انا اللي همني فقط
// رقم الستريك لا اكثر»): the flame, the number, «يوم/أيام». No status
// line, countdown, cost of a miss, seven days, tickets or milestone on
// Home — tapping the number opens «ليش N؟» (onOpenStreak), where all of
// that lives.
//
// One lit moment, one green fill. Everything under the stage is an
// inset list on the ground: hairlines, not boxes. Rank and XP left
// Home — they live with the profile and progress.

function PlanProgress({ plan, planIndex }) {
  const schedule      = plan.weeklySchedule || []
  const durationWeeks = plan.durationWeeks || 6
  const totalSessions = durationWeeks * (schedule.length || 1)
  const currentWeek   = Math.min(Math.floor(planIndex / (schedule.length || 1)) + 1, durationWeeks)
  const doneSessions  = Math.min(planIndex, totalSessions)
  const pct           = Math.min(100, Math.round((planIndex / totalSessions) * 100))
  const isCompleted   = planIndex >= totalSessions

  return (
    <ListGroup header="تقدم البرنامج" className="hm-group">
      <ListRow
        leading={CalendarBlank}
        title={<span className="hm-plan-name">{plan.planName}</span>}
        subtitle={isCompleted
          ? <>خلصت الخطة · <Num>{totalSessions}</Num> جلسة</>
          : <>الأسبوع <Num>{currentWeek}</Num> من <Num>{durationWeeks}</Num> · أنجزت <Num>{doneSessions}</Num> من <Num>{totalSessions}</Num> جلسة</>}
        trailing={<Num className="hm-pct">{pct}%</Num>}
      >
        <Gauge value={doneSessions} max={totalSessions} tone="ink" label="تقدم البرنامج" className="hm-gauge" />
      </ListRow>
    </ListGroup>
  )
}

// Where the rest-day cycle stands: workouts until the next scheduled
// rest. Tickets are the streak's business and live in «ليش N؟», not here.
function RestCycle({ recovery, isRecoveryDay }) {
  const limit = recovery?.cycleLimit || 0
  if (!limit) return null
  const streak = recovery?.workoutStreak || 0
  const left = Math.max(0, limit - streak)
  const cycleTitle = isRecoveryDay
    ? 'اليوم يوم الراحة'
    : left === 0
      ? 'الراحة جاية'
      : left === 1
      ? 'باقي تمرين واحد على الراحة'
      : `باقي ${countAr(left, 'workout')} على الراحة`

  return (
    <ListGroup header="دورة التعافي" className="hm-group">
      <ListRow
        leading={<span className="k-row-icon hm-ic-rest"><Moon size={22} weight="fill" aria-hidden="true" /></span>}
        title={withNums(cycleTitle)}
        subtitle={withNums(`كل ${countAr(limit, 'workout')} ثم يوم راحة`)}
        trailing={<Num className="hm-rest-num">{Math.min(streak, limit)}/{limit}</Num>}
      >
        <Gauge value={Math.min(streak, limit)} max={limit} tone="rest" label="التقدم ليوم الراحة" className="hm-gauge" />
      </ListRow>
    </ListGroup>
  )
}

function MuscleGroup({ entries }) {
  const max = entries[0]?.[1] || 1
  const many = entries.length > 1
  return (
    <ListGroup header="العضلات هذا الشهر" footer="المجموعات المنجزة في آخر 30 يوم" className="hm-group hm-muscles">
      {entries.map(([muscle, count]) => {
        const g = MUSCLE_GROUPS[muscle]
        if (!g) return null
        return (
          <ListRow
            key={muscle}
            leading={<span className="hm-thumb hm-thumb-sm" aria-hidden="true"><img src={g.img} alt="" loading="lazy" /></span>}
            title={g.label}
            trailing={<><Num>{count}</Num> <span className="hm-unit">{setsUnit(count)}</span></>}
          >
            {many && <Gauge value={count} max={max} tone="ink" label={`${g.label}: ${count}`} className="hm-gauge" />}
          </ListRow>
        )
      })}
    </ListGroup>
  )
}

// tickets, creditProgress, creditTarget, daysToNextCredit and
// onScoreboardVisible are still accepted (App passes them) but no longer
// drawn: they were the scoreboard's, and the streak's details now live
// in the sheet behind the number.
export default function HomePage({ sessions, profile, onStartWorkout, onStartPlannedWorkout, onSkipPlanDay, onGoToWorkout, active, plan, planIndex, exerciseMapping = {}, exerciseSubs = {}, onCycleSub, recovery, recoveryConfig = {}, streakToday = null, onOverrideRecovery, monthReport = null, onShowMonthReport, deload = null, deloadSuggestion = null,
  onStartDeload, onDismissDeloadSuggestion, greeting = '', onOpenProfile, onOpenSettings, onOpenStreak,
  repTarget = DEFAULT_REP_TARGET }) {
  // Training vs recovery comes from the recovery engine — real completed
  // workouts and the chosen frequency — never from the weekday.
  const isRecoveryDay = recovery?.status === DAY_STATUS.RECOVERY

  const monthAgo = Date.now() - 30 * 86400000
  const muscleSets = {}
  for (const s of sessions) {
    if (!(new Date(s.date) > monthAgo)) continue
    for (const ex of s.exercises || []) {
      const count = (ex.sets || []).filter(ss => ss.done).length
      if (count) muscleSets[ex.muscle] = (muscleSets[ex.muscle] || 0) + count
    }
  }
  const muscleEntries = Object.entries(muscleSets)
    .filter(([m]) => MUSCLE_GROUPS[m])
    .sort((a, b) => b[1] - a[1])

  const schedule = plan?.weeklySchedule
  const currentPlanDay = schedule?.length
    ? schedule[(planIndex ?? 0) % schedule.length]
    : null
  const planDayNum = schedule?.length ? ((planIndex ?? 0) % schedule.length) + 1 : 1
  const planTotal  = schedule?.length ?? 1

  // The top of Home: the streak number first, with the avatar for the
  // profile and the gear on the same line at the end; then today's date
  // (and the plan week) across the full width, «أضف اسمك» at the end of
  // that line while there is no name (so the block keeps its height),
  // and the greeting — two lines at most, a fixed height so nothing under
  // it jumps from one day to the next.
  const planWeek = schedule?.length && plan
    ? ` · الأسبوع ${Math.min(Math.floor((planIndex ?? 0) / schedule.length) + 1, plan.durationWeeks || 6)} من ${plan.durationWeeks || 6}`
    : ''
  const initial = (profile?.name || 'م').trim().charAt(0)
  const unnamed = !profile?.name || profile.name === 'البطل'

  return (
    <div className="hm">
      <div className="h-top">
        <div className="h-top-text">
          <StreakNumber recovery={recovery} config={recoveryConfig} active={active} deload={deload}
            today={streakToday} onOpen={onOpenStreak} />
          <div className="h-eyebrow-row">
            <span className="k-eyebrow">{withNums(`${fmtDayAr(streakToday || todayKey())}${planWeek}`)}</span>
            {unnamed && (
              <button type="button" className="h-name-hint" onClick={onOpenSettings}>
                <Plus size={14} weight="bold" aria-hidden="true" />أضف اسمك
              </button>
            )}
          </div>
          <p className="h-greet">{greeting}</p>
        </div>
        <div className="h-top-actions">
          <button type="button" className="h-avatar" onClick={onOpenProfile} aria-label="الملف الشخصي">{initial}</button>
          <IconButton icon={GearSix} label="الإعدادات" onClick={onOpenSettings} />
        </div>
      </div>

      {/* ── Today ── */}
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
        repTarget={repTarget}
        onStartPlanned={onStartPlannedWorkout}
        onStartEmpty={onStartWorkout}
        onSkip={onSkipPlanDay}
        onGoToWorkout={onGoToWorkout}
        onOverrideRecovery={onOverrideRecovery}
      />

      <div className="hm-below">
        {/* ── The deload suggestion ── */}
        <DeloadSuggestion
          reason={deloadSuggestion}
          onAccept={onStartDeload}
          onDismiss={onDismissDeloadSuggestion}
        />

        {/* ── Month report — only in its window, only with training ── */}
        {monthReport?.hasData && (
          <ListGroup className="hm-group">
            <ListRow
              leading={ChartBar}
              title={withNums(`تقرير ${monthReport.monthLabel}`)}
              subtitle={<>
                <Num>{monthReport.sessionCount}</Num> جلسة · <Num>{Number(monthReport.volume?.total || 0).toLocaleString('en-US')}</Num> كجم
                {monthReport.prs?.length ? <> · <Num>{monthReport.prs.length}</Num> رقم قياسي</> : null}
              </>}
              chevron
              onClick={onShowMonthReport}
            />
          </ListGroup>
        )}

        {/* ── Plan progress ── */}
        {plan && !active && <PlanProgress plan={plan} planIndex={planIndex ?? 0} />}

        {/* ── The rest-day cycle ── */}
        <RestCycle recovery={recovery} isRecoveryDay={isRecoveryDay} />

        {/* ── Muscles this month ── */}
        {muscleEntries.length > 0 && <MuscleGroup entries={muscleEntries} />}
      </div>
    </div>
  )
}
