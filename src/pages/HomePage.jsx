import '../styles/screens/home.css'
import { DeloadSuggestion } from '../components/DeloadBanner.jsx'
import TodayHero from '../components/TodayHero.jsx'
import Scoreboard from '../components/streak/Scoreboard.jsx'
import { IconButton, ListGroup, ListRow, Gauge, Num } from '../components/kit/index.jsx'
import { GearSix, ChartBar, CalendarBlank, Moon, Ticket } from '../components/kit/icons.js'
import { MUSCLE_GROUPS } from '../constants.js'
import { DAY_STATUS } from '../recovery.js'
import { countAr, todayStreak, fmtDayAr } from '../streak.js'
import { todayKey } from '../day.js'
import { DEFAULT_REP_TARGET } from '../progression.js'
import { withNums } from '../components/home/HomeBits.jsx'
import { setsUnit } from '../components/home/dayParts.js'

// ── Home — «تحت الأضواء» ──────────────────────────────────────
//
//   the top           date · greeting · profile · settings
//   the streak        first, always (Scoreboard)
//   Today             the one lit stage, three exercises, one green button
//   a notice          the deload suggestion, when the engine raises one
//   quiet lists       month report · plan progress · recovery · muscles
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
        <Gauge value={doneSessions} max={totalSessions} tone="accent" label="تقدم البرنامج" className="hm-gauge" />
      </ListRow>
    </ListGroup>
  )
}

function RecoveryGroup({ recovery, isRecoveryDay, tickets, creditProgress, creditTarget, daysToNextCredit }) {
  const limit = recovery?.cycleLimit || 0
  const streak = recovery?.workoutStreak || 0
  const left = Math.max(0, limit - streak)
  const cycleTitle = isRecoveryDay
    ? 'اكتملت الدورة — اليوم راحة'
    : left === 0
      ? 'اكتملت الدورة — الراحة جاية'
      : left === 1
      ? 'باقي تمرين واحد على يوم الراحة'
      : `باقي ${countAr(left, 'workout')} على يوم الراحة`
  const footer = tickets > 0
    ? 'التذكرة تنصرف لحالها الساعة 3 الفجر لو فاتك يوم تمرين، والستريك يوقف: ما يزيد ولا ينكسر. اليوم اللي تغطّيه تذكرة ما ينعدّ للجاية.'
    : 'بدون تذاكر، يوم التمرين اللي يفوتك يكسر الستريك. كل يوم تمرّنت فيه أو راحة مجدولة يقرّبك من تذكرة.'

  return (
    <ListGroup header="دورة التعافي" footer={withNums(footer)} className="hm-group">
      <ListRow
        leading={<span className="k-row-icon hm-ic-rest"><Ticket size={22} weight="bold" aria-hidden="true" /></span>}
        title="التذكرة الجاية"
        subtitle={withNums(`باقي ${countAr(daysToNextCredit, 'day')} للتذكرة الجاية`)}
        trailing={<Num className="hm-rest-num">{creditProgress}/{creditTarget}</Num>}
      >
        <Gauge value={creditProgress} max={creditTarget} tone="rest" label="التقدم للتذكرة الجاية" className="hm-gauge" />
      </ListRow>
      <ListRow
        leading={<span className="k-row-icon hm-ic-rest"><Moon size={22} weight="fill" aria-hidden="true" /></span>}
        title={withNums(cycleTitle)}
        subtitle={withNums(`الدورة: ${countAr(limit, 'workout')} ثم يوم راحة`)}
        trailing={<Num>{Math.min(streak, limit)}/{limit}</Num>}
      />
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

export default function HomePage({ sessions, xp, streak, profile, onStartWorkout, onStartPlannedWorkout, onSkipPlanDay, onGoToWorkout, active, plan, planIndex, exerciseMapping = {}, exerciseSubs = {}, onCycleSub, recovery, recoveryConfig = {}, streakToday = null, onOverrideRecovery, onScoreboardVisible, tickets = 0, creditProgress = 0, creditTarget = 5, daysToNextCredit = 5, monthReport = null, onShowMonthReport, deload = null, deloadSuggestion = null,
  onStartDeload, onDismissDeloadSuggestion, onOpenDeload, greeting = '', onOpenProfile, onOpenSettings,
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

  // The top of Home: today's date (and the plan week), the greeting —
  // two lines at most, a fixed height so nothing under it jumps from
  // one day to the next — the avatar for the profile, the gear.
  const planWeek = schedule?.length && plan
    ? ` · الأسبوع ${Math.min(Math.floor((planIndex ?? 0) / schedule.length) + 1, plan.durationWeeks || 6)} من ${plan.durationWeeks || 6}`
    : ''
  const initial = (profile?.name || 'م').trim().charAt(0)
  const unnamed = !profile?.name || profile.name === 'البطل'

  return (
    <div className="hm">
      <div className="h-top">
        <div className="h-top-text">
          <span className="k-eyebrow">{withNums(`${fmtDayAr(streakToday || todayKey())}${planWeek}`)}</span>
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

      {/* ── The streak, first ── */}
      <Scoreboard
        recovery={recovery}
        config={recoveryConfig}
        active={active}
        deload={deload}
        today={streakToday}
        onVisibleChange={onScoreboardVisible}
      />

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

        {/* ── Recovery: the cycle and the next ticket ── */}
        <RecoveryGroup
          recovery={recovery}
          isRecoveryDay={isRecoveryDay}
          tickets={tickets}
          creditProgress={creditProgress}
          creditTarget={creditTarget}
          daysToNextCredit={daysToNextCredit}
        />

        {/* ── Muscles this month ── */}
        {muscleEntries.length > 0 && <MuscleGroup entries={muscleEntries} />}
      </div>
    </div>
  )
}
