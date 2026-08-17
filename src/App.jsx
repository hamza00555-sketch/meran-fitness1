import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ls, calcStreak, buildExercise, getExerciseStats, resolveExerciseName,
  levelFromXP, xpProgress, getTodayChallenges,
  scheduleNotificationsForToday, applySubsToDay,
} from './utils.js'
import {
  GREETINGS, NAV_TABS, ACHIEVEMENTS,
  DAILY_CHALLENGE_POOL, WEEKLY_CHALLENGE_POOL, BOSS_CHALLENGES,
  NOTIFICATION_MESSAGES, WORKOUT_TIME_HOURS,
  DEFAULT_EXERCISE_MAPPING, APP_VERSION, EXERCISE_ALTERNATIVES,
} from './constants.js'
import { PersonIcon, TrophyIcon, FlagIcon, DumbbellIcon, HomeIcon, SettingsIcon } from './components/Icons.jsx'
import { computeRecovery, DEFAULT_RECOVERY, DAY_STATUS, MAX_REST_CREDITS, changeCooldownLeft } from './recovery.js'
import { todayKey } from './day.js'
import { analyzeProgression, DEFAULT_REP_TARGET } from './progression.js'

const NAV_ICONS = {
  home:         HomeIcon,
  workout:      DumbbellIcon,
  exercises:    null,
  challenges:   FlagIcon,
  achievements: TrophyIcon,
  profile:      PersonIcon,
  settings:     SettingsIcon,
}

// Pages
import HomePage        from './pages/HomePage.jsx'
import WorkoutPage     from './pages/WorkoutPage.jsx'
import ChallengesPage  from './pages/ChallengesPage.jsx'
import AchievementsPage from './pages/AchievementsPage.jsx'
import ProfilePage     from './pages/ProfilePage.jsx'
import SettingsPage    from './pages/SettingsPage.jsx'
import PhotosPage      from './pages/PhotosPage.jsx'
import ExercisesPage   from './pages/ExercisesPage.jsx'

// Components
import RestTimer        from './components/RestTimer.jsx'
import RoutinesModal    from './components/RoutinesModal.jsx'
import LevelUpScreen    from './components/LevelUpScreen.jsx'
import SystemAlert      from './components/SystemAlert.jsx'
import WhatsNewModal    from './components/WhatsNewModal.jsx'
import AssetPackPrompt  from './components/AssetPackPrompt.jsx'
import MonthReport      from './components/report/MonthReport.jsx'
import { buildMonthReport, monthReportWindow } from './monthReport.js'
import { initPack, wasPrompted } from './assets/pack.js'

// Stable greeting index per session
const GREETING_IDX = Math.floor(Math.random() * GREETINGS.length)

// One-time weights reset (v2): the old exercise mapping wrongly
// merged machine/cable/dumbbell/barbell variants, polluting saved
// weight suggestions. Clear the snapshot, backups, and the stored
// stale mapping so suggestions rebuild from the precise mapping.
// Runs once per user (flag is per-user namespaced).
if (!ls.get('hf_weights_reset_v2', false)) {
  ls.remove('hf_last_weights')
  ls.remove('hf_weight_backups')
  ls.remove('hf_exercise_mapping')
  // Only users with existing sessions get the history cutoff —
  // fresh users have nothing to reset
  if ((ls.get('hf_sessions', []) || []).length) {
    ls.set('hf_weights_reset_at', Date.now())
  }
  ls.set('hf_weights_reset_v2', true)
}

// Default profile
const DEFAULT_PROFILE = {
  name: 'البطل',
  birthday: null,
  height: null,
  weight: null,
  bodyFat: null,
  goal: 'muscle',
  gymType: 'commercial',
  trainingSystem: 'ppl',
  trainingDays: [1, 3, 5], // Mon, Wed, Fri
  workoutTime: 'المساء',
  lastWeightUpdate: null,
}

export default function App() {
  // ── Persistent state ──────────────────────────────────────────
  const [sessions,            setSessions]            = useState(() => ls.get('hf_sessions', []))
  const [xp,                  setXP]                  = useState(() => ls.get('hf_xp', 0))
  const [active,              setActive]              = useState(() => ls.get('hf_active', null))
  const [profile,             setProfile]             = useState(() => ls.get('hf_profile', DEFAULT_PROFILE))
  const [unlockedAchievements,setUnlockedAchievements]= useState(() => ls.get('hf_unlocked', []))
  const [challengeState,      setChallengeState]      = useState(() => ls.get('hf_challenges', null))
  const [plan,                setPlan]                = useState(() => ls.get('hf_plan', null))
  const [planIndex,           setPlanIndex]           = useState(() => ls.get('hf_plan_index', 0))
  const [exerciseMapping,     setExerciseMapping]     = useState(() => ({ ...DEFAULT_EXERCISE_MAPPING, ...ls.get('hf_exercise_mapping', {}) }))
  const [exerciseSubs,        setExerciseSubs]        = useState(() => ls.get('hf_exercise_subs', {}))
  // Recovery config. Migrates existing users off the old weekday
  // picker by reading how many days a week they had selected —
  // workout history and plan order are left completely untouched.
  const [repTarget, setRepTarget] = useState(() => ({ ...DEFAULT_REP_TARGET, ...ls.get('hf_rep_target', {}) }))
  // When each achievement was earned: { id: epochMs }. Stored separately
  // so the existing unlocked-id list needs no migration.
  const [unlockedAt, setUnlockedAt] = useState(() => ls.get('hf_unlocked_at', {}))
  const [recoveryCfg, setRecoveryCfg] = useState(() => {
    const saved = ls.get('hf_recovery', null)
    if (saved) return { ...DEFAULT_RECOVERY, ...saved }
    const legacy = ls.get('hf_profile', null)?.trainingDays
    const perWeek = Array.isArray(legacy) && legacy.length >= 3 && legacy.length <= 6
      ? legacy.length : DEFAULT_RECOVERY.daysPerWeek
    return { ...DEFAULT_RECOVERY, daysPerWeek: perWeek }
  })

  // ── UI state ──────────────────────────────────────────────────
  const [tab,        setTab]        = useState('home')
  const [showRest,   setShowRest]   = useState(() => {
    // A rest timer left running when the app was closed keeps counting
    // on wall-clock time — bring it back so it isn't silently lost.
    const t = ls.get('hf_rest_timer', null)
    if (!t) return false
    if (t.pausedLeft != null) return t.pausedLeft > 0
    if (typeof t.endsAt !== 'number') return false
    // Still counting, or only just finished — coming back a few seconds
    // late should still greet you with "انتهت الراحة" rather than silence.
    return Date.now() - t.endsAt < 120_000
  })
  const [showLevelUp,setShowLevelUp]= useState(false)
  const [levelUpNum, setLevelUpNum] = useState(1)
  const [alertQueue, setAlertQueue] = useState([])
  const [restKey,    setRestKey]    = useState(0)
  const [photos,     setPhotos]     = useState(() => ls.get('hf_photos', []))
  const [showWhatsNew, setShowWhatsNew] = useState(() => ls.get('hf_seen_version') !== APP_VERSION)
  // Set by the boot reconciliation below, never by a stored flag alone.
  const [packOffer,  setPackOffer]  = useState(false)
  const [showReport, setShowReport] = useState(false)

  const prevLevelRef  = useRef(levelFromXP(xp))
  const sessionXPRef  = useRef(0) // XP earned in the current live session (refunded on تراجع)
  const activeRef     = useRef(active)
  useEffect(() => { activeRef.current = active }, [active])

  // ── Persist to localStorage ───────────────────────────────────
  useEffect(() => { ls.set('hf_sessions', sessions) },             [sessions])
  useEffect(() => { ls.set('hf_xp',       xp)       },             [xp])
  useEffect(() => { ls.set('hf_active',   active)   },             [active])
  useEffect(() => { ls.set('hf_profile',  profile)  },             [profile])
  useEffect(() => { ls.set('hf_unlocked', unlockedAchievements) }, [unlockedAchievements])
  useEffect(() => { ls.set('hf_challenges', challengeState) },     [challengeState])
  useEffect(() => { ls.set('hf_plan',             plan)            }, [plan])
  useEffect(() => { ls.set('hf_plan_index',       planIndex)       }, [planIndex])
  useEffect(() => { ls.set('hf_photos',           photos)          }, [photos])
  useEffect(() => { ls.set('hf_exercise_mapping', exerciseMapping) }, [exerciseMapping])
  useEffect(() => { ls.set('hf_exercise_subs',    exerciseSubs)    }, [exerciseSubs])
  useEffect(() => { ls.set('hf_recovery',         recoveryCfg)     }, [recoveryCfg])
  useEffect(() => { ls.set('hf_rep_target',       repTarget)       }, [repTarget])
  useEffect(() => { ls.set('hf_unlocked_at',      unlockedAt)      }, [unlockedAt])

  // ── Schedule daily notifications ─────────────────────────────
  useEffect(() => {
    if (ls.get('hf_notif_enabled', false)) {
      scheduleNotificationsForToday(
        profile?.workoutTime || 'المساء',
        NOTIFICATION_MESSAGES,
        WORKOUT_TIME_HOURS,
      )
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Initialize / refresh challenge state ──────────────────────
  useEffect(() => {
    const fresh = getTodayChallenges(challengeState, DAILY_CHALLENGE_POOL, WEEKLY_CHALLENGE_POOL, BOSS_CHALLENGES)
    if (
      !challengeState ||
      challengeState.date !== fresh.date ||
      challengeState.week !== fresh.week
    ) {
      setChallengeState(prev => ({
        ...fresh,
        completed: prev?.date === fresh.date ? (prev?.completed || []) : [],
      }))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Art pack ─────────────────────────────────────────────────
  // Bring whatever art is already on the device onto the screen, then
  // decide whether to offer the download. The answer comes from
  // counting the stored blobs, not from a flag: iOS can evict
  // script-writable storage without notice, and a flag left behind
  // would leave the app convinced it has art it no longer has.
  useEffect(() => {
    let alive = true
    initPack().then(rec => {
      if (!alive) return
      if (!rec.installed && !wasPrompted()) setPackOffer(true)
    }).catch(e => {
      // Never swallow this: a throw here once left the art un-hydrated
      // with no trace of why.
      console.error('meran/assets: boot failed', e)
    })
    return () => { alive = false }
  }, [])

  // ── WhatsNew dismiss ─────────────────────────────────────────
  const dismissWhatsNew = useCallback(() => {
    ls.set('hf_seen_version', APP_VERSION)
    setShowWhatsNew(false)
  }, [])

  // ── Alert helper ──────────────────────────────────────────────
  const pushAlert = useCallback((icon, msg) => {
    setAlertQueue(prev => {
      const [head, ...rest] = prev
      // Same icon as current → merge in place, bump timer
      if (head && head.icon === icon) {
        return [{ ...head, msg, count: (head.count || 1) + 1, bumpAt: Date.now() }, ...rest]
      }
      // Different icon → queue behind
      return [...prev, { id: Date.now() + Math.random(), icon, msg, count: 1, bumpAt: Date.now() }]
    })
  }, [])

  const removeAlert = useCallback(() => {
    setAlertQueue(prev => prev.slice(1))
  }, [])

  // ── XP float animation ────────────────────────────────────────
  const showXPFloat = useCallback((amount) => {
    const el = document.createElement('div')
    el.className = 'xp-float'
    el.textContent = `+${amount} XP`
    el.style.left = '50%'
    el.style.top  = '35%'
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 1600)
  }, [])

  // ── Add XP ───────────────────────────────────────────────────
  const addXP = useCallback((amount, label = '') => {
    setXP(prev => {
      const newXP      = prev + amount
      const oldLevel   = levelFromXP(prev)
      const newLevel   = levelFromXP(newXP)
      if (newLevel > oldLevel) {
        prevLevelRef.current = newLevel
        setLevelUpNum(newLevel)
        setShowLevelUp(true)
      }
      return newXP
    })
    showXPFloat(amount)
    if (label) pushAlert('⭐', `${label} +${amount} XP`)
  }, [showXPFloat, pushAlert])

  // XP during a live workout — tracked so it can be refunded on تراجع
  const addWorkoutXP = useCallback((amount, label = '') => {
    addXP(amount, label)
    sessionXPRef.current += amount
  }, [addXP])

  // ── Achievement checker ───────────────────────────────────────
  const checkAchievements = useCallback((newSessions, newXP, newStreak) => {
    setUnlockedAchievements(prev => {
      const newUnlocked = [...prev]
      const stamps = {}
      let gained = 0
      ACHIEVEMENTS.forEach(a => {
        if (newUnlocked.includes(a.id)) return
        try {
          if (a.check(newSessions, newXP, newStreak)) {
            newUnlocked.push(a.id)
            stamps[a.id] = Date.now()
            gained += a.xp
            pushAlert('🏆', `إنجاز: ${a.title}`)
          }
        } catch {}
      })
      if (Object.keys(stamps).length) {
        setUnlockedAt(p2 => ({ ...p2, ...stamps }))
      }
      if (gained > 0) {
        setTimeout(() => addXP(gained, 'إنجازات'), 300)
      }
      return newUnlocked
    })
  }, [addXP, pushAlert])

  // ── Achievements safety net ──────────────────────────────────
  // Re-check whenever sessions change (app load, history edits,
  // imports) — not only at finishSession. Idempotent: already
  // unlocked achievements are skipped, so no duplicate awards.
  useEffect(() => {
    if (!sessions.length) return
    const t = setTimeout(() => {
      checkAchievements(sessions, xp, computeRecovery(sessions, recoveryCfg).consistencyStreak)
    }, 1000)
    return () => clearTimeout(t)
  }, [sessions, recoveryCfg]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-backup every 10 min during active workout ───────────
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => {
      const cur = activeRef.current
      if (!cur) return
      const backups = ls.get('hf_weight_backups', [])
      backups.unshift({ savedAt: Date.now(), sessionId: cur.id, exercises: cur.exercises })
      ls.set('hf_weight_backups', backups.slice(0, 5))
      pushAlert('💾', 'حُفظت أوزانك تلقائياً')
    }, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [active?.id, pushAlert])

  // ── Session management ────────────────────────────────────────
  const startPlannedWorkout = useCallback((planDay) => {
    sessionXPRef.current = 0
    const lastWeightsMap = ls.get('hf_last_weights', {})
    const planExercises = applySubsToDay(planDay.exercises, exerciseSubs, EXERCISE_ALTERNATIVES)
    const exercises = planExercises.map(ex => {
      const canonical = resolveExerciseName(ex.name, exerciseMapping)
      const fromSnapshot = lastWeightsMap[canonical] ?? lastWeightsMap[ex.name.toLowerCase()]
      const prevWeight = fromSnapshot != null
        ? fromSnapshot
        : (getExerciseStats(sessions, ex.name, exerciseMapping).lastWeight ?? '')
      const prog = analyzeProgression(sessions, ex.name, exerciseMapping, repTarget)
      return buildExercise({ muscle: ex.muscle, name: ex.name, numSets: ex.sets || 3, prevWeight, prevReps: prog.suggestedReps })
    })
    const session = {
      id:           Date.now(),
      date:         new Date().toISOString(),
      duration:     null,
      exercises,
      planDayName:  planDay.name,
      planDayIndex: planIndex,
    }
    setActive(session)
    setTab('workout')
  }, [planIndex, sessions, exerciseMapping, exerciseSubs, repTarget])

  const skipPlanDay = useCallback(() => {
    setPlanIndex(prev => prev + 1)
    pushAlert('⏭️', 'تم تخطي يوم التمرين')
  }, [pushAlert])

  const startWorkout = useCallback((exercises = []) => {
    sessionXPRef.current = 0
    const session = {
      id:        Date.now(),
      date:      new Date().toISOString(),
      duration:  null,
      exercises,
    }
    setActive(session)
    setTab('workout')
  }, [])

  const finishSession = useCallback(() => {
    if (!active) return
    const duration = Math.round((Date.now() - active.id) / 60000)
    const finished = { ...active, duration }

    // Snapshot definitive weights at the exact moment of finishing
    const snapshot = {}
    for (const ex of finished.exercises || []) {
      const ws = (ex.sets || []).map(s => parseFloat(s.weight)).filter(w => w > 0)
      if (ws.length) {
        const canonical = resolveExerciseName(ex.name, exerciseMapping)
        snapshot[canonical] = ws[ws.length - 1]
      }
    }
    if (Object.keys(snapshot).length) {
      ls.set('hf_last_weights', { ...ls.get('hf_last_weights', {}), ...snapshot })
    }

    setSessions(prev => {
      const newSessions = [finished, ...prev]
      const streak = computeRecovery(newSessions, recoveryCfg).consistencyStreak

      // Bonus XP at session finish (per-set XP already awarded live)
      const finishBonus = 50 + Math.floor(duration / 30) * 30
      setTimeout(() => {
        addXP(finishBonus, '✓ جلسة مكتملة')
        checkAchievements(newSessions, xp + sessionXPRef.current + finishBonus, streak)
        sessionXPRef.current = 0
      }, 200)

      return newSessions
    })

    // Advance plan index when a planned session is completed
    if (active.planDayIndex !== undefined) {
      setPlanIndex(active.planDayIndex + 1)
    }

    setActive(null)
    // The workout is over — a rest timer left running has nothing left
    // to rest for, so close it and clear its saved state.
    setShowRest(false)
    ls.remove('hf_rest_timer')
    setTab('home')
    pushAlert('🎉', 'جلسة مكتملة! عمل رائع!')
  }, [active, exerciseMapping, recoveryCfg, addXP, checkAchievements, pushAlert, xp])

  const updateActive = useCallback((updater) => {
    setActive(prev => prev ? updater(prev) : prev)
  }, [])

  const updateSession = useCallback((sessionId, updater) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? updater(s) : s))
  }, [])

  const deleteSession = useCallback((sessionId) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId))
  }, [])

  // ── Challenge completion ──────────────────────────────────────
  const handleCompleteChallenge = useCallback((challengeId, xpReward) => {
    setChallengeState(prev => ({
      ...prev,
      completed: [...(prev?.completed || []), challengeId],
    }))
    addXP(xpReward, '🏳️ تحدي مكتمل')
  }, [addXP])

  // ── Profile update ────────────────────────────────────────────
  const handleUpdateProfile = useCallback((newProfile) => {
    setProfile(newProfile)
    pushAlert('✅', 'تم حفظ التغييرات')
  }, [pushAlert])

  // ── Derived values ────────────────────────────────────────────
  const recovery = computeRecovery(sessions, recoveryCfg)

  // A missed day zeroes the streak, and the streak is what funds the
  // rest-day balance — so the credit would vanish exactly when it is
  // needed. Re-run the engine with the pending days treated as covered
  // to see what the balance really is before deciding to spend it.
  const pendingDays = (recovery.missedDays || [])
    .filter(d => d >= (recoveryCfg.autoSpendFrom || ''))
  let affordable = recovery.restCredits
  if (pendingDays.length) {
    const covered = computeRecovery(sessions, {
      ...recoveryCfg,
      restDays: [...(recoveryCfg.restDays || []), ...pendingDays],
    })
    // What that streak has earned, less what it had already spent —
    // the pending days are what we are deciding to buy, so they must
    // not be counted as spent while working out the budget.
    const alreadySpent = covered.streakStart
      ? (recoveryCfg.restDays || []).filter(d => d >= covered.streakStart).length
      : 0
    affordable = Math.max(0, covered.creditsEarned - alreadySpent)
  }
  // ── Spend earned rest days automatically ─────────────────────
  // A day you miss is covered by a stored rest day if you have one, so
  // the streak survives without you having to open the app that day.
  // With no balance left, the streak breaks — that is the whole point.
  useEffect(() => {
    setRecoveryCfg(prev => {
      // Only ever cover days from when this started; never retro-drain
      // the balance across a user's whole past history.
      const from = prev.autoSpendFrom || todayKey()
      if (!prev.autoSpendFrom) return { ...prev, autoSpendFrom: from }

      const coverable = (recovery.missedDays || []).filter(d => d >= from)
      if (!coverable.length) return prev

      const credits = affordable ?? 0
      if (credits < 1) return prev

      const spend = coverable.slice(0, credits)   // oldest missed days first
      setTimeout(() => pushAlert('🎟️',
        spend.length === 1
          ? `استُخدم يوم راحة من رصيدك — ستريكك مجمّد لا مكسور`
          : `استُخدمت ${spend.length} أيام راحة من رصيدك — ستريكك مجمّد`), 0)
      // Only the spent days are recorded; the balance recomputes itself.
      return {
        ...prev,
        restDays: [...new Set([...(prev.restDays || []), ...spend])].slice(-120),
      }
    })
  }, [recovery.missedDays, affordable, pushAlert])

  // The streak shown everywhere is the CONSISTENCY streak: a recovery
  // day taken as planned keeps it alive. calcStreak() counted raw
  // consecutive calendar days, so any rest day wiped it.
  const streak  = recovery.consistencyStreak

  // ── Monthly report ───────────────────────────────────────────
  // Offered only in its window — the last days of a month and the first
  // week of the next — and only when that month has something in it.
  // Built once per change rather than on every render: it replays the
  // whole history to find record events.
  const reportMonth = monthReportWindow(todayKey())
  const monthReport = useMemo(
    () => (reportMonth
      ? buildMonthReport({
          sessions, config: recoveryCfg, unlockedAt, xp,
          mapping: exerciseMapping, repTarget, month: reportMonth,
        })
      : null),
    [reportMonth, sessions, recoveryCfg, unlockedAt, xp, exerciseMapping, repTarget],
  )

  // ── Changing frequency or plan ───────────────────────────────
  // Both keep the streak, because each past day is judged by the pattern
  // that was in force then. One change is free per cooldown; a further
  // change inside the window is allowed but ends the streak, and the
  // caller has already confirmed that.
  const applyFrequencyChange = useCallback((patch, { breakStreak = false } = {}) => {
    const today = todayKey()
    setRecoveryCfg(prev => {
      const next = { ...prev, ...patch }
      // Effective from today, never backdated — a change must not rescue
      // a day already missed.
      const segment = {
        from: today,
        daysPerWeek: next.daysPerWeek,
        customPattern: next.customPattern,
      }
      const history = (prev.patternHistory || []).filter(seg => seg.from !== today)
      // Seed the pre-change era so the past keeps being judged as it was.
      if (!history.length && !(prev.patternHistory || []).length) {
        history.push({
          from: '1970-01-01',
          daysPerWeek: prev.daysPerWeek,
          customPattern: prev.customPattern,
        })
      }
      return {
        ...next,
        patternHistory: [...history, segment].slice(-40),
        lastSettingsChangeAt: today,
        streakResetAt: breakStreak ? today : prev.streakResetAt,
      }
    })
    pushAlert(breakStreak ? '⚠️' : '✅',
      breakStreak ? 'تم التغيير — بدأ ستريك جديد' : 'تم التغيير — ستريكك محفوظ')
  }, [pushAlert])

  const applyPlanChange = useCallback((newPlan, { breakStreak = false } = {}) => {
    const today = todayKey()
    setPlan(newPlan)
    setPlanIndex(0)
    setRecoveryCfg(prev => ({
      ...prev,
      lastSettingsChangeAt: today,
      streakResetAt: breakStreak ? today : prev.streakResetAt,
    }))
    pushAlert(breakStreak ? '⚠️' : '📋',
      breakStreak ? `${newPlan.planName} — بدأ ستريك جديد` : `تم تفعيل: ${newPlan.planName}`)
  }, [pushAlert])

  const overrideRecoveryDay = useCallback(() => {
    const today = todayKey()
    setRecoveryCfg(prev => ({
      ...prev,
      overrides: [...new Set([...(prev.overrides || []), today])].slice(-60),
    }))
    pushAlert('💪', 'التعافي جزء من الخطة — لكن القرار لك')
  }, [pushAlert])
  const { level } = xpProgress(xp)

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(180deg, #0A0E1A 0%, var(--bg) 30%)',
      color: 'var(--text)',
      maxWidth: 560,
      margin: '0 auto',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <header style={{
        background: '#080B14',
        borderBottom: '1px solid rgba(94,195,42,0.12)',
        padding: `calc(var(--safe-top) + 14px) 18px 14px`,
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 0 rgba(94,195,42,0.08)',
        // No backdrop-filter: on iOS it makes this bar composite into a
        // layer that goes stale during scroll and paints at a wrong offset.
        transform: 'translateZ(0)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              letterSpacing: 4, color: 'var(--cyan)', marginBottom: 2,
              opacity: 0.8,
            }}>MERAN</div>
            <div style={{
              fontFamily: 'var(--font-ar)', fontSize: 13,
              fontWeight: 600, color: 'var(--text2)',
              maxWidth: 230, lineHeight: 1.4,
            }}>
              {GREETINGS[GREETING_IDX].replace('{name}', profile?.name || 'البطل')}
            </div>
            <div style={{
              fontFamily: 'var(--font-ar)', fontSize: 10,
              color: 'var(--text3)', marginTop: 3,
              display: 'flex', alignItems: 'center', gap: 3,
            }}>
              اضغط ⚙️ لتغيير اسمك
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {streak > 0 && (
              <div style={{
                background: 'var(--orange-lo)',
                border: '1px solid rgba(249,115,22,0.3)',
                borderRadius: 20, padding: '3px 10px',
                fontFamily: 'var(--font-mono)', fontSize: 12,
                color: 'var(--orange)', fontWeight: 700,
              }}>🔥 {streak}</div>
            )}
            <button
              onClick={() => setShowRest(true)}
              style={{
                background: 'rgba(94,195,42,0.07)', border: '1px solid rgba(94,195,42,0.18)',
                borderRadius: 10, width: 36, height: 36,
                color: 'var(--text2)', cursor: 'pointer',
                fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--cyan)'; e.currentTarget.style.color = 'var(--cyan)' }}
              onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(94,195,42,0.18)'; e.currentTarget.style.color = 'var(--text2)' }}
            >⏱️</button>
            <button
              onClick={() => setTab(t => t === 'settings' ? 'home' : 'settings')}
              style={{
                background: tab === 'settings' ? 'var(--cyan-lo)' : 'rgba(94,195,42,0.07)',
                border: `1px solid ${tab === 'settings' ? 'var(--cyan)' : 'rgba(94,195,42,0.18)'}`,
                borderRadius: 10, width: 36, height: 36,
                color: tab === 'settings' ? 'var(--cyan)' : 'var(--text2)', cursor: 'pointer',
                fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--cyan)'; e.currentTarget.style.color = 'var(--cyan)' }}
              onMouseOut={e => {
                if (tab !== 'settings') {
                  e.currentTarget.style.borderColor = 'rgba(94,195,42,0.18)'
                  e.currentTarget.style.color = 'var(--text2)'
                }
              }}
            ><SettingsIcon size={18} /></button>
          </div>
        </div>
      </header>

      {/* ── Page Content ────────────────────────────────────────── */}
      <main
        key={tab}
        className="page-enter"
        style={{ padding: '16px 14px 0', flex: 1 }}
      >
        {tab === 'home' && (
          <HomePage
            sessions={sessions}
            xp={xp}
            streak={streak}
            profile={profile}
            active={active}
            plan={plan}
            planIndex={planIndex}
            exerciseMapping={exerciseMapping}
            exerciseSubs={exerciseSubs}
            onCycleSub={(name, idx) => setExerciseSubs(prev => ({ ...prev, [name]: idx }))}
            recovery={recovery}
            onOverrideRecovery={overrideRecoveryDay}
            restCredits={recovery.restCredits}
            creditProgress={recovery.creditProgress}
            creditTarget={recovery.creditTarget}
            daysToNextCredit={recovery.daysToNextCredit}
            atMaxCredits={recovery.restCredits >= MAX_REST_CREDITS}
            onStartWorkout={() => startWorkout()}
            onStartPlannedWorkout={startPlannedWorkout}
            onSkipPlanDay={skipPlanDay}
            onGoToWorkout={() => setTab('workout')}
            monthReport={monthReport}
            onShowMonthReport={() => setShowReport(true)}
          />
        )}
        {tab === 'workout' && (
          <WorkoutPage
            active={active}
            sessions={sessions}
            plan={plan}
            planIndex={planIndex}
            onUpdateActive={updateActive}
            onFinish={finishSession}
            onShowRest={() => { ls.remove('hf_rest_timer'); setShowRest(true); setRestKey(k => k + 1) }}
            onStartPlannedWorkout={startPlannedWorkout}
            addXP={addWorkoutXP}
            onGoBack={() => {
              if (sessionXPRef.current > 0) {
                setXP(prev => Math.max(0, prev - sessionXPRef.current))
                sessionXPRef.current = 0
              }
              setActive(null); setShowRest(false); setTab('home')
            }}
            isResting={showRest}
            exerciseMapping={exerciseMapping}
            repTarget={repTarget}
            exerciseSubs={exerciseSubs}
            onCycleSub={(name, idx) => setExerciseSubs(prev => ({ ...prev, [name]: idx }))}
            onUpdateSession={updateSession}
            onDeleteSession={deleteSession}
          />
        )}
        {tab === 'exercises' && <ExercisesPage sessions={sessions} exerciseMapping={exerciseMapping} />}
        {tab === 'challenges' && (
          <ChallengesPage
            sessions={sessions}
            challengeState={challengeState}
            onCompleteChallenge={handleCompleteChallenge}
            xp={xp}
          />
        )}
        {tab === 'achievements' && (
          <AchievementsPage
            sessions={sessions}
            xp={xp}
            streak={streak}
            unlockedAchievements={unlockedAchievements}
            unlockedAt={unlockedAt}
            level={level}
          />
        )}
        {tab === 'profile' && (
          <ProfilePage
            profile={profile}
            sessions={sessions}
            xp={xp}
            streak={streak}
            level={level}
            recovery={recovery}
            onUpdateProfile={handleUpdateProfile}
            onGoToPhotos={() => setTab('photos')}
          />
        )}
        {tab === 'settings' && (
          <SettingsPage
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            sessions={sessions}
            xp={xp}
            unlockedAchievements={unlockedAchievements}
            challengeState={challengeState}
            photos={photos}
            plan={plan}
            onImportPlan={applyPlanChange}
            onClearPlan={() => { setPlan(null); setPlanIndex(0) }}
            exerciseMapping={exerciseMapping}
            recoveryCfg={recoveryCfg}
            onUpdateRecovery={applyFrequencyChange}
            changeCooldownLeft={changeCooldownLeft(recoveryCfg)}
            currentStreak={recovery.consistencyStreak}
            recovery={recovery}
            repTarget={repTarget}
            onUpdateRepTarget={(patch) => setRepTarget(prev => ({ ...prev, ...patch }))}
            onImportMapping={(newMapping) => {
              setExerciseMapping(prev => ({ ...prev, ...newMapping }))
              pushAlert('🗺️', `تم تحديث خريطة التمارين — ${Object.keys(newMapping).length} تمرين`)
            }}
            onImport={(data) => {
              if (data.type === 'exercise_mapping') {
                setExerciseMapping(prev => ({ ...prev, ...data.mapping }))
                pushAlert('🗺️', `تم استيراد خريطة التمارين — ${Object.keys(data.mapping).length} تمرين`)
                return
              }
              if (data.sessions !== undefined)           setSessions(data.sessions)
              if (data.xp !== undefined)                 setXP(data.xp)
              if (data.profile)                          setProfile(data.profile)
              if (data.unlockedAchievements)             setUnlockedAchievements(data.unlockedAchievements)
              if (data.challengeState)                   setChallengeState(data.challengeState)
              if (data.photos)                           setPhotos(data.photos)
              // Without this the restored history is judged against a
              // default cycle, which rewrites the streak and loses every
              // rest day. Older backups have no `recovery` key; they keep
              // whatever is configured on the device.
              if (data.recovery)                         setRecoveryCfg(prev => ({ ...prev, ...data.recovery }))
              pushAlert('✅', 'تم استيراد البيانات بنجاح!')
            }}
          />
        )}
        {tab === 'photos' && (
          <PhotosPage
            photos={photos}
            setPhotos={setPhotos}
            onBack={() => setTab('profile')}
          />
        )}
      </main>

      {/* ── Bottom Navigation ────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', bottom: 0,
        left: 0, right: 0,
        width: '100%', maxWidth: 560,
        background: '#080B14',
        borderTop: '1px solid rgba(94,195,42,0.10)',
        boxShadow: '0 -1px 0 rgba(94,195,42,0.06)',
        display: 'flex',
        padding: `10px 6px calc(env(safe-area-inset-bottom, 0px) + 10px)`,
        zIndex: 200,
        margin: '0 auto',
        // Centered with margin instead of translateX(-50%), and promoted to
        // its own layer, so iOS keeps repainting it correctly while scrolling.
        transform: 'translateZ(0)',
        willChange: 'transform',
      }}>
        {NAV_TABS.map(t => {
          const isActive = tab === t.id
          const hasActiveSession = t.id === 'workout' && !!active
          const IconComp = NAV_ICONS[t.id]
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, background: 'none', border: 'none',
                cursor: 'pointer', position: 'relative',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 4, padding: '4px 2px',
                transition: 'opacity 0.15s',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {hasActiveSession && (
                <div className="pulse-dot" style={{
                  position: 'absolute', top: 2, right: '50%',
                  transform: 'translateX(12px)',
                  width: 7, height: 7, borderRadius: '50%',
                  background: 'var(--cyan)',
                }} />
              )}

              <div style={{
                width: 38, height: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 8,
                background: isActive ? 'var(--cyan-lo)' : 'transparent',
                transition: 'background 0.2s',
              }}>
                {IconComp
                  ? <IconComp size={19} color={isActive ? 'var(--cyan)' : '#4B5563'} filled={isActive} />
                  : <span style={{ fontSize: 17, opacity: isActive ? 1 : 0.45 }}>{t.icon}</span>
                }
              </div>

              <span style={{
                fontFamily: 'var(--font-ar)', fontSize: 11,
                color: isActive ? 'var(--cyan)' : '#4B5563',
                fontWeight: isActive ? 700 : 500,
                transition: 'color 0.15s',
              }}>{t.label}</span>
            </button>
          )
        })}
      </nav>

      {/* ── Overlays ─────────────────────────────────────────────── */}
      {showRest    && <RestTimer key={restKey} onClose={() => setShowRest(false)} />}
      {showLevelUp && <LevelUpScreen level={levelUpNum} onDismiss={() => setShowLevelUp(false)} />}
      <SystemAlert alerts={alertQueue} onRemove={removeAlert} />
      {showWhatsNew && <WhatsNewModal version={APP_VERSION} onClose={dismissWhatsNew} />}
      {/* Queued behind the version notice so the two never stack. */}
      {packOffer && !showWhatsNew && <AssetPackPrompt onClose={() => setPackOffer(false)} />}
      {showReport && monthReport && (
        <MonthReport report={monthReport} onClose={() => setShowReport(false)} />
      )}
    </div>
  )
}
