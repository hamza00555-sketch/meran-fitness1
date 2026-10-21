import '../styles/screens/home.css'
import { useMemo } from 'react'
import { DeloadSuggestion } from '../components/DeloadBanner.jsx'
import TodayHero from '../components/TodayHero.jsx'
import StreakNumber, { useFlameIgnition } from '../components/streak/StreakNumber.jsx'
import { IconButton, ListRow, Num } from '../components/kit/index.jsx'
import { GearSix, ChartBar, CalendarBlank, Plus, ListChecks, PencilSimple } from '../components/kit/icons.js'
import { planTitle } from '../plan/title.js'
import { DAY_STATUS } from '../recovery.js'
import { todayStreak, fmtDayAr, streakView } from '../streak.js'
import { todayKey } from '../day.js'
import { DEFAULT_REP_TARGET } from '../progression.js'
import { withNums } from '../components/home/HomeBits.jsx'
import { reportRowLine } from '../monthReport.js'
import { resolveDay } from '../plan/rotate.js'

// ── Home — what's today, and one tap to start ─────────────────
//
//   the top     the streak number · date · greeting · profile · settings
//   Today       the day's badge, its word and one meta line, three
//               exercises, one green button
//   a notice    the deload suggestion, when the engine raises one
//   doors       «خطتي» · the month report (in its window)
//
// حمزة: «الشاشة الرئيسية مكدسة والصورة كبيرة مرة بشكل غير احترافي». So
// Home says each thing once: the plan's week is on «خطتي»'s row, not
// also on the date line; a deload is one mark on the day, not four; the
// rest-day cycle and the month's muscles left Home (the cycle is in
// «ليش N؟»'s days, the muscles in التقدم › الأرقام). Nothing under the
// button is a box: the doors are rows on the ground, hairlines between.
//
// The streak is its number and nothing else (حمزة: «انا اللي همني فقط
// رقم الستريك لا اكثر»): the flame, the number, «يوم/أيام». No status
// line, countdown, cost of a miss, seven days, tickets or milestone on
// Home — tapping the number opens «ليش N؟» (onOpenStreak), where all of
// that lives.

// The plan's row opens «خطتي» — his plan as cards, every day of it, with
// the builder one tap further («عدّل الخطة كاملة»). Where he stands is
// its second line: the week, or that the plan is done, then the plan.
function PlanRow({ plan, planIndex, onOpen }) {
  const days          = plan.weeklySchedule?.length || 1
  const durationWeeks = plan.durationWeeks || 6
  const totalSessions = durationWeeks * days
  const currentWeek   = Math.min(Math.floor(planIndex / days) + 1, durationWeeks)
  const isCompleted   = planIndex >= totalSessions
  const name = planTitle(plan.planName)

  return (
    <ListRow
      leading={onOpen ? ListChecks : CalendarBlank}
      title={onOpen ? 'خطتي' : <span className="hm-plan-name">{name}</span>}
      subtitle={(
        <span className="hm-plan-sub">
          {isCompleted
            ? (onOpen ? 'خلصت الخطة' : <>خلصت الخطة · <Num>{totalSessions}</Num> جلسة</>)
            : <>الأسبوع <Num>{currentWeek}</Num> من <Num>{durationWeeks}</Num></>}
          {onOpen && <> · <span className="hm-plan-name">{name}</span></>}
        </span>
      )}
      chevron={!!onOpen}
      onClick={onOpen}
      className="hm-plan-row"
    />
  )
}

// tickets, creditProgress, creditTarget, daysToNextCredit and
// onScoreboardVisible are still accepted (App passes them) but no longer
// drawn: they were the scoreboard's, and the streak's details now live
// in the sheet behind the number.
export default function HomePage({ sessions, profile, onStartWorkout, onStartPlannedWorkout, onSkipPlanDay, onGoToWorkout, active, plan, planIndex, exerciseMapping = {}, exerciseSubs = {}, onCycleSub, recovery, recoveryConfig = {}, streakToday = null, onOverrideRecovery, monthReport = null, onShowMonthReport, deload = null, deloadSuggestion = null,
  onStartDeload, onDismissDeloadSuggestion, greeting = '', onOpenProfile, onOpenSettings, onOpenStreak,
  repTarget = DEFAULT_REP_TARGET, hold = false, onOpenPlanner, onOpenPlanView }) {
  // Training vs recovery comes from the recovery engine — real completed
  // workouts and the chosen frequency — never from the weekday.
  const isRecoveryDay = recovery?.status === DAY_STATUS.RECOVERY

  const schedule = plan?.weeklySchedule
  // Today's day as the session will start it: a row that takes turns
  // («بالتناوب», src/plan/rotate.js) on the one due today.
  const currentPlanDay = useMemo(() => {
    if (!schedule?.length) return null
    const d = (planIndex ?? 0) % schedule.length
    return resolveDay(plan, d, sessions, { mapping: exerciseMapping })
  }, [plan, schedule, planIndex, sessions, exerciseMapping])

  // The top of Home: the streak number first, with the avatar for the
  // profile and the gear on the same line at the end; then today's date
  // across the full width, «أضف اسمك» at the end of that line while there
  // is no name (so the block keeps its height), and the greeting — a
  // fixed height so nothing under it jumps from one day to the next.
  // The flame lights once a day, when today counts — kept while the
  // summary or the level-up screen is still over Home (`hold`).
  const ignite = useFlameIgnition(
    streakView({ recovery, config: recoveryConfig, active, deload, today: streakToday }), hold)

  const initial = (profile?.name || 'م').trim().charAt(0)
  const unnamed = !profile?.name || profile.name === 'البطل'
  const openPlan = onOpenPlanView || (onOpenPlanner ? () => onOpenPlanner('progress') : undefined)
  const report = monthReport?.hasData
  const doors = (plan && !active) || report || (!plan && onOpenPlanner)

  return (
    <div className="hm">
      <div className="h-top">
        <div className="h-top-text">
          <StreakNumber recovery={recovery} config={recoveryConfig} active={active} deload={deload}
            today={streakToday} onOpen={onOpenStreak} ignite={ignite} />
          <div className="h-eyebrow-row">
            <span className="k-eyebrow">{withNums(fmtDayAr(streakToday || todayKey()))}</span>
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
        onEditPlan={onOpenPlanner ? () => onOpenPlanner('more') : undefined}
        calm={!!ignite?.on}
      />

      <div className="hm-below">
        {/* ── The deload suggestion ── */}
        <DeloadSuggestion
          reason={deloadSuggestion}
          onAccept={onStartDeload}
          onDismiss={onDismissDeloadSuggestion}
        />

        {/* ── The doors: rows on the ground ── */}
        {doors && (
          <div className="hm-doors" role="group" aria-label="خطتك وتقريرك">
            {plan && !active && <PlanRow plan={plan} planIndex={planIndex ?? 0} onOpen={openPlan} />}
            {/* Door 4 to the plan builder: no plan yet. A quiet row, not green. */}
            {!plan && onOpenPlanner && (
              <ListRow
                leading={PencilSimple}
                title="ابنِ خطتك"
                subtitle="على أيامك وأجهزتك، وتعدّلها متى ما بغيت"
                chevron
                onClick={() => onOpenPlanner('home')}
                data-testid="build-plan"
              />
            )}
            {/* The month report — only in its window, only with training */}
            {report && (
              <ListRow
                leading={ChartBar}
                title={withNums(`تقرير ${monthReport.monthLabel}`)}
                subtitle={withNums(reportRowLine(monthReport))}
                chevron
                onClick={onShowMonthReport}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
