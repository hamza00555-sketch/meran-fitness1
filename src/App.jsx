import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ls, calcStreak, buildExercise, getExerciseStats, resolveExerciseName, suggestedWeightFor, fmtDate, pickGreeting, keepDone, normalizeSession, setCounts,
  levelFromXP, xpProgress, getTodayChallenges,
  scheduleNotificationsForToday, applySubsToDay, planDayTitle, getHistoricalMax, sessionVolume,
} from './utils.js'
import {
  NAV_TABS, ACHIEVEMENTS,
  DAILY_CHALLENGE_POOL, WEEKLY_CHALLENGE_POOL, BOSS_CHALLENGES,
  NOTIFICATION_MESSAGES, WORKOUT_TIME_HOURS,
  DEFAULT_EXERCISE_MAPPING, APP_VERSION, EXERCISE_ALTERNATIVES,
} from './constants.js'
import { PersonIcon, TrophyIcon, FlagIcon, DumbbellIcon, HomeIcon, SettingsIcon } from './components/Icons.jsx'
import { computeRecovery, DEFAULT_RECOVERY, DAY_STATUS, changeCooldownLeft, dayDiff } from './recovery.js'
import { streakView, todayStreak, skipCopy, finishToast, spendToast } from './streak.js'
import { planReminders } from './notify.js'
import { todayKey, dayKey, nextDayTurn } from './day.js'
import { analyzeProgression, DEFAULT_REP_TARGET } from './progression.js'
import { deloadState, sessionDeloadStamp, isDeloadSession, startDeload, endDeload, deloadWeight,
         suggestDeload, dismissSuggestion } from './deload.js'

// ── The four tabs ──
// Home, what you did, how you are progressing, and the library. The
// profile opens from the avatar on Home and settings from the gear;
// achievements live inside التقدم. «تمرين» and «التمارين» used to sit
// side by side and mean different things.
const NAV = [
  { id: 'home',     label: 'الرئيسية', icon: House },
  { id: 'history',  label: 'السجل',    icon: ClockCounterClockwise },
  { id: 'progress', label: 'التقدم',   icon: ChartLineUp },
  { id: 'library',  label: 'المكتبة',  icon: Books },
]

// Pages
import HomePage        from './pages/HomePage.jsx'
import WorkoutPage     from './pages/WorkoutPage.jsx'
import HistoryPage     from './pages/HistoryPage.jsx'
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
import DeloadEndScreen  from './components/DeloadEndScreen.jsx'
import AssetPackPrompt  from './components/AssetPackPrompt.jsx'
import StreakChip       from './components/streak/StreakChip.jsx'
import LiveBar          from './components/frame/LiveBar.jsx'
import SessionSummary   from './components/frame/SessionSummary.jsx'
import Onboarding       from './components/frame/Onboarding.jsx'
import ProgressPage     from './pages/ProgressPage.jsx'
import { LargeTitle, NavBar, IconButton } from './components/kit/index.jsx'
import { House, ClockCounterClockwise, ChartLineUp, Books, GearSix, CaretDown } from './components/kit/icons.js'
import SkipSheet        from './components/streak/SkipSheet.jsx'
import StreakSheet      from './components/streak/StreakSheet.jsx'
import MonthReport      from './components/report/MonthReport.jsx'
import SavePosterSheet  from './components/report/SavePosterSheet.jsx'
import { sharePoster, SHARE_RESULT } from './reportPoster.js'
import { buildMonthReport, monthReportWindow } from './monthReport.js'
import { initPack, wasPrompted, syncPack } from './assets/pack.js'

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

// History repair. The first cleanup (hf_history_cleaned_v1) dropped
// every session with no ticked set — but a workout could always be
// finished by typing the numbers without ticking, and a month of real
// sessions went with it, breaking a 30-day streak. The untouched
// original was kept in hf_sessions_backup_v1; rebuild from it with the
// corrected rule (normalizeSession: a saved session is never dropped),
// keep any session saved since, and write down which days came back so
// the Settings ledger can show them. Runs once per user.
if (!ls.get('hf_history_restored_v2', false)) {
  const backup  = ls.get('hf_sessions_backup_v1', null)
  const current = ls.get('hf_sessions', []) || []
  const source  = backup || current
  if (source.length || current.length) {
    const rebuilt  = source.map(normalizeSession).filter(Boolean)
    const known    = new Set(rebuilt.map(s => s.id))
    const newer    = current.filter(s => !known.has(s.id)).map(normalizeSession).filter(Boolean)
    const had      = new Set(current.map(s => s.id))
    const returned = rebuilt.filter(s => !had.has(s.id))
    const merged   = [...newer, ...rebuilt].sort((a, b) => (b.id || 0) - (a.id || 0))
    ls.set('hf_sessions', merged)
    if (backup && !ls.get('hf_sessions_backup_v2', null)) ls.set('hf_sessions_backup_v2', current)
    ls.set('hf_history_restore_report', {
      at: Date.now(),
      count: returned.length,
      dates: returned.map(s => dayKey(s.date)).sort(),
    })
  }
  ls.set('hf_history_cleaned_v1', true)
  ls.set('hf_history_restored_v2', true)
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
  // Pages pushed over a tab (profile → settings → …), and whether the
  // running session is open full screen or docked as the live bar.
  const [pages,      setPages]      = useState([])
  const [sessionOpen, setSessionOpen] = useState(() => !!ls.get('hf_active', null))
  const page = pages[pages.length - 1] || null
  const pushPage = useCallback((p) => setPages(prev => [...prev.filter(x => x !== p), p]), [])
  const popPage  = useCallback(() => setPages(prev => prev.slice(0, -1)), [])
  const goTab    = useCallback((t) => {
    setPages([])
    setTab(prev => {
      if (prev === t) window.scrollTo({ top: 0, behavior: 'smooth' })
      return t
    })
  }, [])

  // Each view keeps its own scroll position, so a tab switch does not
  // dump you at the top of a long list, or halfway down the next one.
  const viewKey = page || tab
  const scrollPos = useRef({})
  const viewRef = useRef(viewKey)
  useEffect(() => {
    const onScroll = () => { scrollPos.current[viewRef.current] = window.scrollY }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    viewRef.current = viewKey
    window.scrollTo(0, scrollPos.current[viewKey] || 0)
  }, [viewKey])
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
  // A fresh install has nothing to be told is new: no changelog on the
  // first run (critique F45). It is marked seen silently instead.
  const firstRun = !ls.get('hf_onboarded', false) && !(ls.get('hf_sessions', []) || []).length && !ls.get('hf_plan', null)
  const [showWhatsNew, setShowWhatsNew] = useState(() => {
    if (ls.get('hf_seen_version') === APP_VERSION) return false
    if (firstRun) { ls.set('hf_seen_version', APP_VERSION); return false }
    return true
  })
  const [onboarding, setOnboarding] = useState(firstRun)
  // Set by the boot reconciliation below, never by a stored flag alone.
  const [packOffer,  setPackOffer]  = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [sharing,    setSharing]    = useState(false)
  // Set only when neither the share sheet nor a download is available.
  const [posterUrl,  setPosterUrl]  = useState(null)

  const prevLevelRef  = useRef(levelFromXP(xp))
  const sessionXPRef  = useRef(0) // XP earned in the current live session (refunded on تراجع)
  // While the end-of-workout summary is being composed, XP, a level-up
  // and achievements are collected into it instead of firing toasts and
  // full-screen interruptions one after another.
  const collectRef      = useRef(false)
  const pendingLevelRef = useRef(null)
  const [summary, setSummary] = useState(null)
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
      // Not on a fresh install: setup comes first, the art offer waits
      // for the next launch.
      if (!rec.installed && !wasPrompted() && !firstRun) setPackOffer(true)
      // An installed pack is only as new as the day it was downloaded.
      // Check the published version in the background so art added
      // after that day actually arrives; silent by design, and a
      // failure here leaves the app exactly as it already was.
      else if (rec.installed) syncPack().catch(() => {})
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

  // Storage full: tell the user what did not save and what to do.
  useEffect(() => {
    let last = 0
    const onFull = (e) => {
      if (Date.now() - last < 15000) return
      last = Date.now()
      const what = e.detail?.key === 'hf_photos' ? 'الصورة' : e.detail?.key === 'hf_sessions' ? 'الجلسة' : 'آخر تعديل'
      pushAlert('⚠️', `التخزين ممتلئ — ${what} ما انحفظت. احذف صور تقدم قديمة أو خذ نسخة احتياطية من الإعدادات.`)
    }
    window.addEventListener('meran:storage-full', onFull)
    return () => window.removeEventListener('meran:storage-full', onFull)
  }, [pushAlert])

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
  // quiet: no float, no toast, and a level-up waits for the summary —
  // used for XP earned set by set, which used to interrupt every set.
  const addXP = useCallback((amount, label = '', { quiet = false } = {}) => {
    const deferred = quiet || collectRef.current
    setXP(prev => {
      const newXP      = prev + amount
      const oldLevel   = levelFromXP(prev)
      const newLevel   = levelFromXP(newXP)
      if (newLevel > oldLevel) {
        prevLevelRef.current = newLevel
        if (deferred) {
          pendingLevelRef.current = newLevel
          setSummary(sm => (sm ? { ...sm, levelUp: newLevel } : sm))
        } else {
          setLevelUpNum(newLevel)
          setShowLevelUp(true)
        }
      }
      return newXP
    })
    if (collectRef.current) { setSummary(sm => (sm ? { ...sm, xp: sm.xp + amount } : sm)); return }
    if (quiet) return
    showXPFloat(amount)
    if (label) pushAlert('⭐', `${label} +${amount} XP`)
  }, [showXPFloat, pushAlert])

  // XP during a live workout — tracked so it can be refunded on تراجع,
  // and silent: the summary at the end says it once.
  const addWorkoutXP = useCallback((amount, label = '') => {
    addXP(amount, label, { quiet: true })
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
            if (collectRef.current) setSummary(sm => (sm ? { ...sm, achievements: [...sm.achievements, a] } : sm))
            else pushAlert('🏆', `إنجاز: ${a.title}`)
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
    const deloadStamp = sessionDeloadStamp(recoveryCfg, todayKey())
    const lighten = deloadStamp ? (w => deloadWeight(w, deloadStamp.pct)) : undefined
    const planExercises = applySubsToDay(planDay.exercises, exerciseSubs, EXERCISE_ALTERNATIVES)
    const exercises = planExercises.map(ex => {
      const prevWeight = suggestedWeightFor(ex.name, {
        sessions, mapping: exerciseMapping, transform: lighten,
      })
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
      // Decided once, here, and it stays decided. A deload that ends
      // mid-workout does not turn the light weights already on screen
      // into normal training. Null when there is no deload running, so
      // ordinary sessions carry no extra field.
      ...(deloadStamp ? { deload: deloadStamp } : null),
    }
    setActive(session)
    setSessionOpen(true)
  }, [planIndex, sessions, exerciseMapping, exerciseSubs, repTarget, recoveryCfg])

  // Skipping only moves the plan. The streak still wants today's
  // workout, which is why the skip sheet states the cost before this
  // runs, and why the toast says the day is still a workout day.
  const skipPlanDay = useCallback((message) => {
    setPlanIndex(prev => prev + 1)
    pushAlert('⏭️', message || 'انتقلت الخطة لليوم الجاي')
  }, [pushAlert])

  const startWorkout = useCallback((exercises = []) => {
    sessionXPRef.current = 0
    const deloadStamp = sessionDeloadStamp(recoveryCfg, todayKey())
    const session = {
      id:        Date.now(),
      date:      new Date().toISOString(),
      duration:  null,
      exercises,
      ...(deloadStamp ? { deload: deloadStamp } : null),
    }
    setActive(session)
    setSessionOpen(true)
  }, [recoveryCfg])

  const finishSession = useCallback(() => {
    if (!active) return
    const duration = Math.round((Date.now() - active.id) / 60000)
    // Only what was actually done goes into the history. The planner
    // lays out every set of the day with a suggested weight in it; an
    // exercise skipped because the machine was taken, or because there
    // was no time, is not something that happened.
    const finished = normalizeSession({ ...active, duration })
    if (!finished) {
      setActive(null)
      setShowRest(false)
      setSessionOpen(false)
      ls.remove('hf_rest_timer')
      setTab('home')
      pushAlert('ℹ️', 'الجلسة فاضية — ما انكتب فيها ولا وزن، فما انحفظت ولا تنحسب للستريك')
      return
    }

    // Snapshot definitive weights at the exact moment of finishing.
    //
    // Except under a deload. hf_last_weights outranks session history
    // in every weight suggestion, so writing the lighter numbers here
    // would make them the new baseline and the deload would never end —
    // it would just be a permanent drop. Leaving the snapshot alone is
    // the entire restore mechanism: the pre-deload weights were never
    // overwritten, so they are simply there again afterwards.
    if (!isDeloadSession(finished)) {
      const snapshot = {}
      for (const ex of finished.exercises || []) {
        const ws = (ex.sets || []).filter(setCounts).map(s => parseFloat(s.weight)).filter(w => w > 0)
        if (ws.length) {
          const canonical = resolveExerciseName(ex.name, exerciseMapping)
          snapshot[canonical] = ws[ws.length - 1]
        }
      }
      if (Object.keys(snapshot).length) {
        ls.set('hf_last_weights', { ...ls.get('hf_last_weights', {}), ...snapshot })
      }
    }

    // What the save does to the streak, said in place of «عمل رائع»:
    // counted today, already counted, counted for the night before
    // (started before 03:00), or not counting after a plan reset.
    const dayNow = todayKey()
    const streakBefore = todayStreak(computeRecovery(sessions, recoveryCfg), { config: recoveryCfg, today: dayNow })
    const recoveryAfter = computeRecovery([finished, ...sessions], recoveryCfg)
    const streakLine = finishToast({
      before: streakBefore,
      after: recoveryAfter,
      sessionDay: dayKey(finished.date),
      today: dayNow,
    })

    // The summary: what was done, any best weights, what it did to the
    // streak; XP, a level-up and achievements arrive into it as they are
    // awarded below.
    const doneSets = (finished.exercises || []).flatMap(e => (e.sets || []).filter(setCounts))
    const prs = (finished.exercises || []).map(ex => {
      const top = Math.max(0, ...(ex.sets || []).filter(setCounts).map(x => parseFloat(x.weight) || 0))
      const prev = getHistoricalMax(sessions, ex.name, exerciseMapping)
      return top > 0 && prev > 0 && top > prev ? { name: ex.name, top, prev } : null
    }).filter(Boolean)
    collectRef.current = true
    setSummary({
      title: planDayTitle(finished) || finished.name || 'جلسة حرة',
      duration, sets: doneSets.length, volume: sessionVolume(finished), prs,
      streakLine,
      streakBefore: computeRecovery(sessions, recoveryCfg).consistencyStreak,
      streakAfter: recoveryAfter.consistencyStreak,
      xp: sessionXPRef.current,
      levelUp: pendingLevelRef.current,
      achievements: [],
    })

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
    setSessionOpen(false)
    setPages([])
    setTab('home')
  }, [active, sessions, exerciseMapping, recoveryCfg, addXP, checkAchievements, pushAlert, xp])

  const closeSummary = useCallback(() => {
    collectRef.current = false
    pendingLevelRef.current = null
    setSummary(null)
  }, [])

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
  // While a session is open, the streak's day is the day it started.
  // A session counts for that day whenever it ends, so a workout begun
  // at 02:30 must not see its own day judged as missed at 03:00 — no
  // false «كسر», no ticket spent and written down for a day it covers.
  // Only for a session started in the last 12 hours: a forgotten one
  // must not freeze the streak indefinitely.
  const activeDay = active && Date.now() - (Number(active.id) || 0) < 12 * 3600e3 ? dayKey(active.date) : null
  const calendarToday = todayKey()
  const streakToday = activeDay && activeDay < calendarToday ? activeDay : calendarToday
  const recovery = computeRecovery(sessions, recoveryCfg, streakToday)

  // ── Record what the engine already decided ───────────────────
  // The engine spends credits itself while it replays the calendar, so
  // the balance and the streak on screen are already true. This effect
  // only writes those days down so the record survives, and tells you
  // once when a day came out of your balance. If it never runs, nothing
  // the user sees changes.
  const autoPaidKey = (recovery.autoPaidDays || []).join(',')
  useEffect(() => {
    const paid = autoPaidKey ? autoPaidKey.split(',') : []
    setRecoveryCfg(prev => {
      const from = prev.autoSpendFrom || todayKey()
      if (!prev.autoSpendFrom) return { ...prev, autoSpendFrom: from }

      const known = new Set(prev.restDays || [])
      const fresh = paid.filter(d => !known.has(d))
      if (!fresh.length) return prev

      // Only announce days from when auto-spending started; older ones
      // are recorded silently.
      const news = fresh.filter(d => d >= from)
      if (news.length) {
        // Dated, Gregorian, with what is left — the engine already
        // spent these, so the numbers in `recovery` are after the spend.
        setTimeout(() => pushAlert('🎟️', spendToast(news, recovery)), 0)
      }
      return {
        ...prev,
        restDays: [...known, ...fresh].sort().slice(-120),
      }
    })
  }, [autoPaidKey, pushAlert])

  // The streak shown everywhere is the CONSISTENCY streak: a recovery
  // day taken as planned keeps it alive. calcStreak() counted raw
  // consecutive calendar days, so any rest day wiped it.
  const streak  = recovery.consistencyStreak

  // The header chip stands in for the scoreboard wherever the
  // scoreboard is not on screen: every other tab, and Home once it has
  // scrolled away.
  const [boardVisible, setBoardVisible] = useState(true)
  const onBoardVisible = useCallback((v) => setBoardVisible(v), [])
  const [askSkip, setAskSkip] = useState(false)

  const [showStreak, setShowStreak] = useState(false)

  // The best streak, kept as a high-water mark. The engine can only
  // replay the last 400 days, and a record must outlive that window. A
  // new key, ignored by the old design, so the shared data stays
  // readable on both sides.
  const [storedBest, setStoredBest] = useState(() => ls.get('hf_streak_best', null))
  useEffect(() => {
    const cur = recovery.consistencyStreak
    if (cur > 0 && cur > (storedBest?.value || 0)) {
      const next = { value: cur, start: recovery.streakStart, end: streakToday }
      setStoredBest(next)
      ls.set('hf_streak_best', next)
    }
  }, [recovery.consistencyStreak, recovery.streakStart, streakToday]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Today, as the app currently believes it ──────────────────
  // Left open overnight, nothing would notice the date changing: every
  // dated feature reads todayKey() at render, and React has no reason
  // to render when the day turns. This bumps a counter exactly when the
  // training day turns, so a deload that ended in the night ends on screen too.
  const [dayTick, setDayTick] = useState(0)
  useEffect(() => {
    // The training day turns at 03:00, not midnight (see day.js). A
    // second past, not a minute: the streak card counts down to 03:00
    // and must not spend a minute pairing the new day with old numbers.
    const id = setTimeout(() => setDayTick(n => n + 1), nextDayTurn() - Date.now() + 1_000)
    // A phone asleep at 03:00 never runs that timer on time; catch up
    // the moment the app is back in front.
    const wake = () => { if (document.visibilityState === 'visible') setDayTick(n => n + 1) }
    document.addEventListener('visibilitychange', wake)
    return () => { clearTimeout(id); document.removeEventListener('visibilitychange', wake) }
  }, [dayTick])

  const today = useMemo(() => todayKey(), [dayTick])

  // ── Deload ───────────────────────────────────────────────────
  const deload = useMemo(() => deloadState(recoveryCfg, today), [recoveryCfg, today])

  // ── Reminders follow the streak (src/notify.js) ──
  // Re-planned whenever what today means for the streak changes; saving
  // a session cancels them. Nothing random, nothing on a counted day.
  const reminderView = streakView({ recovery, config: recoveryCfg, active, deload, today: streakToday })
  const reminderKey = `${reminderView.kind}|${reminderView.number}|${reminderView.tickets}|${streakToday}|${profile?.workoutTime}`
  useEffect(() => {
    planReminders({
      view: reminderView,
      workoutHour: WORKOUT_TIME_HOURS[profile?.workoutTime || 'المساء'] ?? 17,
      enabled: ls.get('hf_notif_enabled', false),
    })
  }, [reminderKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // The greeting knows what day it is. Re-drawn when the day turns or
  // the day's state changes, not on every render — otherwise the line
  // would flicker to a new one each time a set is logged.
  const yesterdayKey = useMemo(() => dayKey(new Date(Date.now() - 86400000)), [today])
  const greeting = useMemo(() => pickGreeting({
    name: profile?.name,
    isRecoveryDay: recovery.status === DAY_STATUS.RECOVERY,
    isRestTaken: recovery.status === DAY_STATUS.REST_TAKEN,
    trainedToday: recovery.status === DAY_STATUS.COMPLETED,
    deload: !!deload?.active,
    streak,
    daysSinceLast: Number.isFinite(recovery.daysSinceLastWorkout) ? recovery.daysSinceLastWorkout : null,
    creditSpentYesterday: (recovery.restTakenHistory || []).includes(yesterdayKey),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [today, profile?.name, recovery.status, deload?.active, streak, recovery.daysSinceLastWorkout])

  // A stretch whose last day passed while the app was shut is still
  // stored. File it once, here, rather than leaving every reader to
  // cope with a deload that is over but not closed.
  useEffect(() => {
    if (deload.lapsed) setRecoveryCfg(prev => endDeload(prev, today))
  }, [deload.lapsed, today])

  const beginDeload = useCallback(({ days, pct } = {}) => {
    setRecoveryCfg(prev => startDeload(prev, todayKey(), { days, pct }))
    setPages([])
    setTab('home')
    pushAlert('💧', `بدأت فترة ديلود — أوزانك أخف بـ${pct}٪`)
  }, [pushAlert])

  // Ending early and ending on time run through the same call. The
  // difference is recorded by endDeload itself, from the date.
  const finishDeload = useCallback(() => {
    setRecoveryCfg(prev => endDeload(prev, todayKey()))
    pushAlert('💪', 'انتهى الديلود — رجعت أوزانك كما كانت')
  }, [pushAlert])

  // Does the app have grounds to raise one?
  //
  // suggestDeload deliberately knows nothing about the progression
  // engine, so the count of stalled lifts is worked out here and passed
  // in. Only exercises actually trained in the last month are asked —
  // a lift dropped six months ago is not stalled, it is gone.
  const deloadSuggestion = useMemo(() => {
    if (recoveryCfg.deload) return null
    const cutoff = Date.now() - 35 * 86400000
    const names = new Set()
    for (const s of sessions) {
      if (new Date(s.date).getTime() < cutoff) continue
      for (const ex of s.exercises || []) names.add(ex.name)
    }
    let stalled = 0
    for (const name of names) {
      const p = analyzeProgression(sessions, name, exerciseMapping, repTarget)
      if (p.hint === 'lower' || p.failedAtWeight >= 2) stalled++
    }
    return suggestDeload({ sessions, config: recoveryCfg, today, stalledCount: stalled })
  }, [sessions, recoveryCfg, today, exerciseMapping, repTarget])

  // The closing screen, offered once. `deloadEndSeenAt` holds the end
  // date rather than a boolean, so the next deload gets its own screen
  // without anything having to reset the flag.
  const lastDeload = recoveryCfg.deloadHistory?.[recoveryCfg.deloadHistory.length - 1] || null
  const showDeloadEnd = !!lastDeload
    && !deload.active
    && recoveryCfg.deloadEndSeenAt !== (lastDeload.until || lastDeload.plannedUntil)
    // Someone opening the app a fortnight later does not need a
    // congratulations screen about a week they have forgotten.
    && dayDiff(lastDeload.until || lastDeload.plannedUntil, today) <= 3

  // The lift the end screen names: the heaviest weight still on record.
  //
  // Read from the sessions rather than from hf_last_weights, because
  // that snapshot is keyed by the canonical lowercase name — an
  // internal key, not something to show anyone. The history carries the
  // name as it was actually written. Deload sessions are skipped, so
  // the number quoted is the one being returned to, not the light one
  // just finished.
  const heaviestLift = useMemo(() => {
    if (!showDeloadEnd) return null
    let best = null
    for (const session of sessions) {
      if (isDeloadSession(session)) continue
      for (const ex of session.exercises || []) {
        for (const set of ex.sets || []) {
          if (!set?.done) continue
          const w = parseFloat(set.weight)
          if (w > 0 && (!best || w > best.weight)) best = { name: ex.name, weight: w }
        }
      }
    }
    return best
  }, [showDeloadEnd, sessions])

  // The palette, softness and pacing all hang off this one attribute,
  // so nothing downstream has to know the rule.
  useEffect(() => {
    const root = document.documentElement
    if (deload.active) root.setAttribute('data-deload', '1')
    else root.removeAttribute('data-deload')
    return () => root.removeAttribute('data-deload')
  }, [deload.active])

  // ── Monthly report ───────────────────────────────────────────
  // Offered only in its window — the last days of a month and the first
  // week of the next — and only when that month has something in it.
  // Built once per change rather than on every render: it replays the
  // whole history to find record events.
  const reportMonth = monthReportWindow(today)
  const monthReport = useMemo(
    () => (reportMonth
      ? buildMonthReport({
          sessions, config: recoveryCfg, unlockedAt, xp,
          mapping: exerciseMapping, repTarget, month: reportMonth,
        })
      : null),
    [reportMonth, sessions, recoveryCfg, unlockedAt, xp, exerciseMapping, repTarget],
  )

  // The share button's whole job: draw the poster, then take whichever
  // route out of the app actually works on this device. The ladder
  // itself lives in reportPoster.js; this only decides what to say.
  const handleSharePoster = useCallback(async () => {
    if (!monthReport || sharing) return
    setSharing(true)
    try {
      const how = await sharePoster({
        report: monthReport,
        profile,
        onInline: setPosterUrl,
      })
      if (how === SHARE_RESULT.DOWNLOADED) pushAlert('📥', 'تم حفظ صورة التقرير')
      // SHARED needs no confirmation — the share sheet was the
      // confirmation. CANCELLED was a decision, not a failure. INLINE
      // opens its own sheet.
    } catch (err) {
      pushAlert('⚠️', err?.message === 'poster-encode-failed'
        ? 'تعذّر تجهيز الصورة — الذاكرة لم تكفِ. أغلق تطبيقات أخرى وحاول مجدداً.'
        : 'تعذّرت مشاركة التقرير')
    } finally {
      setSharing(false)
    }
  }, [monthReport, profile, sharing, pushAlert])

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
      background: 'var(--ground)',
      color: 'var(--text)',
      maxWidth: 560,
      margin: '0 auto',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── Page content ──
          No shared header any more: Home has its own top (date, greeting,
          avatar, gear), every other tab a large title with the streak
          chip, pushed pages a back bar. */}
      <main key={viewKey} className="page-enter f-main" data-live={active && !sessionOpen ? '1' : undefined}>
        {!page && tab === 'home' && (
          <HomePage
            sessions={sessions}
            xp={xp}
            streak={streak}
            profile={profile}
            greeting={greeting}
            onOpenProfile={() => pushPage('profile')}
            onOpenStreak={() => setShowStreak(true)}
            onOpenSettings={() => pushPage('settings')}
            active={active}
            plan={plan}
            planIndex={planIndex}
            exerciseMapping={exerciseMapping}
            exerciseSubs={exerciseSubs}
            onCycleSub={(name, idx) => setExerciseSubs(prev => ({ ...prev, [name]: idx }))}
            recovery={recovery}
            recoveryConfig={recoveryCfg}
            streakToday={streakToday}
            onScoreboardVisible={onBoardVisible}
            onOverrideRecovery={overrideRecoveryDay}
            tickets={recovery.usableCredits}
            creditProgress={recovery.creditProgress}
            creditTarget={recovery.creditTarget}
            daysToNextCredit={recovery.daysToNextCredit}
            onStartWorkout={() => startWorkout()}
            onStartPlannedWorkout={startPlannedWorkout}
            onSkipPlanDay={() => setAskSkip(true)}
            onGoToWorkout={() => setSessionOpen(true)}
            monthReport={monthReport}
            onShowMonthReport={() => setShowReport(true)}
            deload={deload}
            deloadSuggestion={deloadSuggestion}
            onStartDeload={beginDeload}
            onDismissDeloadSuggestion={() => setRecoveryCfg(prev => dismissSuggestion(prev, today))}
            onOpenDeload={() => pushPage('settings')}
          />
        )}
        {!page && tab === 'history' && (
          <>
            <LargeTitle title="السجل" actions={<StreakChip recovery={recovery} config={recoveryCfg} active={active} deload={deload} today={streakToday} onOpen={() => setShowStreak(true)} />} />
            <HistoryPage
              sessions={sessions}
              plan={plan}
              planIndex={planIndex}
              onStartPlannedWorkout={startPlannedWorkout}
              onStartWorkout={() => startWorkout()}
              exerciseMapping={exerciseMapping}
              onUpdateSession={updateSession}
              onDeleteSession={deleteSession}
            />
          </>
        )}
        {!page && tab === 'progress' && (
          <>
            <LargeTitle title="التقدم" actions={<StreakChip recovery={recovery} config={recoveryCfg} active={active} deload={deload} today={streakToday} onOpen={() => setShowStreak(true)} />} />
            <ProgressPage
              achievements={{ sessions, xp, streak, unlockedAchievements, unlockedAt, level }}
              photos={{ photos, setPhotos, onBack: () => goTab('progress') }}
            />
          </>
        )}
        {!page && tab === 'library' && (
          <>
            <LargeTitle title="المكتبة" actions={<StreakChip recovery={recovery} config={recoveryCfg} active={active} deload={deload} today={streakToday} onOpen={() => setShowStreak(true)} />} />
            <ExercisesPage sessions={sessions} exerciseMapping={exerciseMapping} />
          </>
        )}
        {page === 'profile' && (
          <>
            <NavBar title="الملف" onBack={popPage}
              actions={<IconButton icon={GearSix} label="الإعدادات" onClick={() => pushPage('settings')} />} />
            <ProfilePage
              profile={profile}
              sessions={sessions}
              xp={xp}
              streak={streak}
              level={level}
              recovery={recovery}
              onUpdateProfile={handleUpdateProfile}
              onGoToPhotos={() => pushPage('photos')}
            />
          </>
        )}
        {page === 'settings' && (
          <>
            <NavBar title="الإعدادات" onBack={popPage} />
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
              today={today}
              onStartDeload={beginDeload}
              onEndDeload={finishDeload}
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
                if (data.sessions !== undefined)           setSessions((data.sessions || []).map(normalizeSession).filter(Boolean))
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
          </>
        )}
        {page === 'photos' && (
          <>
            <NavBar title="صور التقدم" onBack={popPage} />
            <PhotosPage photos={photos} setPhotos={setPhotos} onBack={popPage} embedded />
          </>
        )}
      </main>

      {/* ── The running session ──
          Full screen while you train: no tabs to wander into mid-set. ⌄
          docks it as the live bar above the tabs. */}
      {active && sessionOpen && (
        <div className="f-cover" role="dialog" aria-modal="true" aria-label="الجلسة" data-testid="session-cover">
          <div className="f-cover-bar">
            <IconButton icon={CaretDown} label="صغّر الجلسة" weight="bold" onClick={() => setSessionOpen(false)} />
          </div>
          <WorkoutPage
            active={active}
            sessions={sessions}
            plan={plan}
            planIndex={planIndex}
            onUpdateActive={updateActive}
            onFinish={finishSession}
            onShowRest={() => { ls.remove('hf_rest_timer'); setShowRest(true); setRestKey(k => k + 1) }}
            onCloseRest={() => { ls.remove('hf_rest_timer'); setShowRest(false) }}
            onStartPlannedWorkout={startPlannedWorkout}
            addXP={addWorkoutXP}
            onGoBack={() => {
              if (sessionXPRef.current > 0) {
                setXP(prev => Math.max(0, prev - sessionXPRef.current))
                sessionXPRef.current = 0
              }
              setActive(null); setShowRest(false); setSessionOpen(false); setTab('home')
            }}
            onMinimize={() => setSessionOpen(false)}
            isResting={showRest}
            exerciseMapping={exerciseMapping}
            repTarget={repTarget}
            exerciseSubs={exerciseSubs}
            onCycleSub={(name, idx) => setExerciseSubs(prev => ({ ...prev, [name]: idx }))}
            onUpdateSession={updateSession}
            onDeleteSession={deleteSession}
          />
        </div>
      )}

      {/* ── Live bar + tabs ── */}
      {active && !sessionOpen && (
        <LiveBar active={active} title={planDayTitle(active) || active.name || 'تمرين'} onOpen={() => setSessionOpen(true)} />
      )}
      <nav className="f-tabs" aria-label="التنقل">
        {NAV.map(t => {
          const on = !page && tab === t.id
          const Icon = t.icon
          return (
            <button key={t.id} type="button" className={`f-tab${on ? ' on' : ''}`}
              aria-current={on ? 'page' : undefined} onClick={() => goTab(t.id)}>
              <span className="f-tab-icon"><Icon size={24} weight={on ? 'fill' : 'regular'} aria-hidden="true" /></span>
              <span className="f-tab-label">{t.label}</span>
            </button>
          )
        })}
      </nav>

      {/* ── Overlays ─────────────────────────────────────────────── */}
      {/* The player owns rest inline while the workout tab is open —
          the floating card would be a second clock for the same rest. */}
      {showRest && !(sessionOpen && active) && (
        <RestTimer key={restKey} onClose={() => setShowRest(false)} />
      )}
      {showLevelUp && !summary && <LevelUpScreen level={levelUpNum} onDismiss={() => setShowLevelUp(false)} />}
      {summary && <SessionSummary summary={summary} xp={xp} onDone={closeSummary} />}
      {onboarding && (
        <Onboarding
          initialName={profile?.name && profile.name !== DEFAULT_PROFILE.name ? profile.name : ''}
          onDone={({ name, daysPerWeek, plan: chosen }) => {
            // Set directly, not through the settings-change paths: a first
            // setup must not spend the one free change per 30 days.
            if (name) setProfile(prev => ({ ...prev, name }))
            setRecoveryCfg(prev => ({ ...prev, daysPerWeek }))
            if (chosen) { setPlan(chosen); setPlanIndex(0) }
            ls.set('hf_onboarded', true)
            setOnboarding(false)
          }}
        />
      )}
      <SystemAlert alerts={alertQueue} onRemove={removeAlert} />

      <StreakSheet
        open={showStreak}
        onClose={() => setShowStreak(false)}
        recovery={recovery}
        config={recoveryCfg}
        active={active}
        deload={deload}
        today={streakToday}
        storedBest={storedBest}
      />

      {askSkip && (() => {
        const copy = skipCopy(streakView({ recovery, config: recoveryCfg, active, deload, today: streakToday }))
        return (
          <SkipSheet
            copy={copy}
            onConfirm={() => { setAskSkip(false); skipPlanDay(copy.toast) }}
            onClose={() => setAskSkip(false)}
          />
        )
      })()}
      {showDeloadEnd && (
        <DeloadEndScreen
          entry={lastDeload}
          heaviest={heaviestLift}
          onDismiss={() => setRecoveryCfg(prev => ({
            ...prev,
            deloadEndSeenAt: lastDeload.until || lastDeload.plannedUntil,
          }))}
        />
      )}
      {showWhatsNew && <WhatsNewModal version={APP_VERSION} onClose={dismissWhatsNew} />}
      {/* Queued behind the version notice so the two never stack. */}
      {packOffer && !showWhatsNew && !onboarding && <AssetPackPrompt onClose={() => setPackOffer(false)} />}
      {showReport && monthReport && (
        <MonthReport
          report={monthReport}
          sharing={sharing}
          onShare={handleSharePoster}
          onClose={() => setShowReport(false)}
        />
      )}
      {posterUrl && (
        <SavePosterSheet
          url={posterUrl}
          onClose={() => { URL.revokeObjectURL(posterUrl); setPosterUrl(null) }}
        />
      )}
    </div>
  )
}
